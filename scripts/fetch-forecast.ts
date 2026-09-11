import { writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type {
  AlertsAvailability,
  Forecast,
  Location,
  LocationForecast,
  MarineAvailability,
  OfficialAlert,
} from '../src/domain/types.ts'
import { computeTargetDate } from '../src/domain/target-date.ts'
import { buildMeta, decideAbort, hasSystemicComplementFailure } from '../src/domain/fault-tolerance.ts'
import type { ComplementGroupTally } from '../src/domain/fault-tolerance.ts'
import { checkForecastReadiness } from '../src/domain/forecast-readiness.ts'
import { selectAlertsForZones } from '../src/domain/alerts.ts'
import { locations } from '../src/data/locations.ts'
import { orchestrateLocationWeather } from './orchestrate-location.ts'
import { AemetAuthError } from './sources/aemet-client.ts'
import type { AemetRawAlert } from './sources/aemet-alerts.ts'
import { areaCodeForZone, fetchAemetAreaAlerts, normalizeAemetAlert } from './sources/aemet-alerts.ts'
import { fetchIpmaWarnings, normalizeIpmaAlert } from './sources/ipma.ts'
import { fetchOpenMeteoMarine, normalizeOpenMeteoMarine } from './sources/open-meteo-marine.ts'

/**
 * Entrypoint del pipeline: calcula `targetDate` (mañana, `Europe/Madrid`,
 * `002-plan.md`) una única vez, orquesta las tres fuentes para los 74
 * lugares — con fallback completo de Open-Meteo si la principal falla —,
 * oleaje y avisos, aplica la política de tolerancia a fallos y escribe
 * `src/data/forecast.json` — o no escribe nada si el aborto se dispara,
 * dejando en línea la previsión anterior. Nunca se llama desde `src/` en
 * runtime.
 */

// Nº de lugares procesados en paralelo. El throttle real de AEMET lo impone
// `aemet-client.ts` (cola compartida) pase lo que pase aquí — este límite
// es solo para no lanzar ~100 peticiones simultáneas a Open-Meteo/IPMA de
// golpe.
const LOCATION_CONCURRENCY = 8

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex++
      results[current] = await fn(items[current])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// --- Avisos: se piden una vez por área/país y se reparten por lugar --------

export async function prefetchAemetAreaAlerts(
  targets: Location[],
  apiKey: string,
): Promise<Map<string, AemetRawAlert[] | null>> {
  const areaCodes = new Set<string>()
  for (const location of targets) {
    const zoneId = location.alertZoneIds?.aemet?.[0]
    if (location.primarySource === 'aemet' && zoneId) {
      areaCodes.add(areaCodeForZone(zoneId))
    }
  }

  const byArea = new Map<string, AemetRawAlert[] | null>()
  for (const areaCode of areaCodes) {
    try {
      byArea.set(areaCode, await fetchAemetAreaAlerts(areaCode, apiKey))
    } catch (error) {
      // Un 401/403 (key caducada) no es "hoy no hay avisos": es la misma
      // credencial rota que usa el weather de AEMET, y tiene que abortar el
      // run igual de ruidoso — nunca quedar absorbido como un simple
      // `alerts.status: 'error'` (tech-stack.md → Despliegue).
      if (error instanceof AemetAuthError) {
        throw error
      }
      console.error(`Avisos AEMET, área ${areaCode}:`, error)
      byArea.set(areaCode, null)
    }
  }
  return byArea
}

async function prefetchIpmaAlerts(): Promise<OfficialAlert[] | null> {
  try {
    const raw = await fetchIpmaWarnings()
    return raw.map(normalizeIpmaAlert).filter((alert): alert is OfficialAlert => alert !== null)
  } catch (error) {
    console.error('Avisos IPMA:', error)
    return null
  }
}

function buildAlertsAvailability(
  location: Location,
  aemetAlertsByArea: Map<string, AemetRawAlert[] | null>,
  ipmaAlerts: OfficialAlert[] | null,
): AlertsAvailability {
  if (location.primarySource === 'open-meteo') {
    return { status: 'unsupported' }
  }

  if (location.primarySource === 'aemet') {
    const zoneIds = location.alertZoneIds?.aemet ?? []
    const areaAlerts = zoneIds[0] ? aemetAlertsByArea.get(areaCodeForZone(zoneIds[0])) : undefined
    if (!areaAlerts) {
      return { status: 'error' }
    }
    const normalized = areaAlerts
      .map(normalizeAemetAlert)
      .filter((alert): alert is OfficialAlert => alert !== null)
    return { status: 'ok', alerts: selectAlertsForZones(normalized, zoneIds) }
  }

  if (ipmaAlerts === null) {
    return { status: 'error' }
  }
  return { status: 'ok', alerts: selectAlertsForZones(ipmaAlerts, location.alertZoneIds?.ipma ?? []) }
}

// --- Marine ------------------------------------------------------------

interface MarineResult {
  availability: MarineAvailability
  attempted: boolean
  failed: boolean
}

async function buildMarineAvailability(location: Location, targetDate: string): Promise<MarineResult> {
  if (!location.coastal || !location.marineCoordinates) {
    return { availability: { status: 'not_applicable' }, attempted: false, failed: false }
  }

  try {
    const raw = await fetchOpenMeteoMarine(
      location.marineCoordinates.latitude,
      location.marineCoordinates.longitude,
      location.timezone,
      targetDate,
    )
    return {
      availability: { status: 'ok', data: normalizeOpenMeteoMarine(raw, targetDate) },
      attempted: true,
      failed: false,
    }
  } catch (error) {
    console.error(`Marine, "${location.id}":`, error)
    return { availability: { status: 'error' }, attempted: true, failed: true }
  }
}

// --- Un lugar completo ---------------------------------------------------

interface LocationResult {
  forecast: LocationForecast
  complementGroup: string | null
  complementFailed: boolean
  marineAttempted: boolean
  marineFailed: boolean
}

function complementGroupFor(location: Location): string | null {
  if (location.primarySource === 'aemet') return 'open-meteo→españa'
  if (location.primarySource === 'ipma') return 'open-meteo→portugal'
  return null // Andorra: sin complemento
}

async function buildLocationForecast(
  location: Location,
  aemetApiKey: string,
  targetDate: string,
  aemetAlertsByArea: Map<string, AemetRawAlert[] | null>,
  ipmaAlerts: OfficialAlert[] | null,
): Promise<LocationResult> {
  // Fallo de fuente principal Y del fallback de Open-Meteo: se propaga (no
  // se captura aquí), lo excluye el bucle de arriba — tolerancia cero
  // (`002-plan.md`). `AemetAuthError` también se propaga hasta aquí sin
  // capturar, y de ahí hasta `run()`, que aborta el proceso entero.
  const weather = await orchestrateLocationWeather(location, aemetApiKey, targetDate)
  const marine = await buildMarineAvailability(location, targetDate)
  const alerts = buildAlertsAvailability(location, aemetAlertsByArea, ipmaAlerts)

  const forecast: LocationForecast = {
    locationId: location.id,
    // `targetDate`, no `weather.block.date`: ambos deberían coincidir por
    // construcción (las fuentes seleccionan su bloque por esa misma fecha),
    // pero el forecast final se escribe con la fecha de referencia del
    // pipeline, no con el eco de lo que devolvió la fuente.
    date: targetDate,
    temperature: weather.block.temperature,
    sky: weather.block.sky,
    precipitation: weather.block.precipitation,
    snow: weather.block.snow,
    wind: weather.block.wind,
    storm: weather.block.storm,
    calima: weather.block.calima,
    fog: weather.block.fog,
    marine: marine.availability,
    alerts,
    provenance: weather.provenance,
    degradations: weather.degradations.length > 0 ? weather.degradations : undefined,
    primarySourceDescription: weather.block.primarySourceDescription,
  }

  return {
    forecast,
    // Un lugar que usó el fallback completo de Open-Meteo no cuenta como
    // intento de complemento: Open-Meteo ya sustituyó a la principal, no la
    // está complementando (`orchestrate-location.ts`).
    complementGroup: weather.usedFallback ? null : complementGroupFor(location),
    // Un lugar cuenta como fallo del complemento tanto si la petición entera
    // falló (weather.complementAttempt === 'error') como si respondió pero
    // le faltó alguna de las métricas que debía complementar (degradación
    // parcial) — degradations ya representa exactamente eso, así que basta
    // con mirar si hay alguna, sin duplicar el criterio. Sigue siendo un
    // único hecho por lugar (booleano), no una cuenta por métrica.
    complementFailed: weather.degradations.length > 0,
    marineAttempted: marine.attempted,
    marineFailed: marine.failed,
  }
}

// --- Orquestación de los 74 lugares ---------------------------------------

async function run(): Promise<void> {
  const apiKey = process.env.AEMET_API_KEY
  if (!apiKey) {
    throw new Error('Falta AEMET_API_KEY en el entorno (.env en local, Secrets en Actions)')
  }

  const targetDate = computeTargetDate(new Date())
  console.log(`targetDate: ${targetDate}`)

  const [aemetAlertsByArea, ipmaAlerts] = await Promise.all([
    prefetchAemetAreaAlerts(locations, apiKey),
    prefetchIpmaAlerts(),
  ])

  const locationForecasts: LocationForecast[] = []
  const failedLocationIds: string[] = []
  const complementTallies: Record<string, ComplementGroupTally> = {}
  const marineTally: ComplementGroupTally = { attempted: 0, failed: 0 }

  await mapWithConcurrency(locations, LOCATION_CONCURRENCY, async (location) => {
    try {
      const result = await buildLocationForecast(location, apiKey, targetDate, aemetAlertsByArea, ipmaAlerts)
      locationForecasts.push(result.forecast)

      if (result.complementGroup) {
        const tally = complementTallies[result.complementGroup] ?? { attempted: 0, failed: 0 }
        tally.attempted += 1
        if (result.complementFailed) tally.failed += 1
        complementTallies[result.complementGroup] = tally
      }
      if (result.marineAttempted) {
        marineTally.attempted += 1
        if (result.marineFailed) marineTally.failed += 1
      }
    } catch (error) {
      // AemetAuthError nunca se cuenta como un lugar fallido más: se
      // relanza sin capturar, aborta `mapWithConcurrency` entero (y con él
      // `run()`) de inmediato — una key caducada no es un fallo por lugar,
      // es un fallo de todo el run (`002-plan.md`).
      if (error instanceof AemetAuthError) {
        throw error
      }
      console.error(`Fuente principal + fallback, "${location.id}":`, error)
      failedLocationIds.push(location.id)
    }
  })

  if (marineTally.attempted > 0) {
    complementTallies['open-meteo-marine'] = marineTally
  }

  const systemicComplementFailure = hasSystemicComplementFailure(complementTallies)
  const decision = decideAbort(failedLocationIds.length, systemicComplementFailure)

  console.log(
    `Lugares: ${locationForecasts.length}/${locations.length} ok. ` +
      `hasSystemicComplementFailure=${systemicComplementFailure}`,
  )
  if (failedLocationIds.length > 0) {
    console.log('Fallidos:', failedLocationIds.join(', '))
  }

  if (decision.shouldAbort) {
    console.error(`Abortando (${decision.reason}) — no se escribe forecast.json.`, decision)
    process.exitCode = 1
    return
  }

  // Última comprobación, aparte de la tolerancia a fallos de arriba: ningún
  // lugar se publica sin Pokémon (`002-plan.md`). No se inventa uno por
  // defecto — si esto falla, el dataset entero es inválido y se aborta sin
  // tocar el `forecast.json` anterior.
  const readiness = checkForecastReadiness(
    locations.map((location) => location.id),
    locationForecasts,
  )
  if (!readiness.ready) {
    console.error(`Abortando (dataset inválido: ${readiness.reason}) — no se escribe forecast.json.`)
    process.exitCode = 1
    return
  }

  const forecast: Forecast = {
    date: targetDate,
    generatedAt: new Date().toISOString(),
    locations: locationForecasts,
    meta: buildMeta(locations.length, failedLocationIds),
  }

  const outputPath = fileURLToPath(new URL('../src/data/forecast.json', import.meta.url))
  await writeFile(outputPath, `${JSON.stringify(forecast, null, 2)}\n`, 'utf-8')
  console.log(`forecast.json escrito: ${forecast.meta.successfulLocations}/${forecast.meta.totalLocations} lugares (${targetDate}).`)
}

// Solo se auto-ejecuta cuando el archivo se lanza directamente (`tsx
// scripts/fetch-forecast.ts`), nunca al importarlo (p. ej. desde un test que
// solo necesita `prefetchAemetAreaAlerts`) — equivalente al
// `if __name__ == "__main__":` de Python. `process.argv[1]` puede faltar
// (algunos runners no lo rellenan), así que la comprobación no asume que
// exista.
const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  run().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
