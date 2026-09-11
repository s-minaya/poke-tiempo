import type { Degradation, Location, MetricPath, Provenance, WeatherBlock } from '../src/domain/types.ts'
import type { ComplementAttempt } from '../src/domain/combine-weather.ts'
import { COMPLEMENT_METRICS_BY_PRIMARY_SOURCE, combineWeatherBlock } from '../src/domain/combine-weather.ts'
import { AemetAuthError } from './sources/aemet-client.ts'
import { fetchAemetDaily, fetchAemetHourly, normalizeAemet } from './sources/aemet.ts'
import { fetchIpmaDaily, normalizeIpma } from './sources/ipma.ts'
import {
  fetchOpenMeteoDaily,
  normalizeOpenMeteoComplement,
  normalizeOpenMeteoPrimary,
} from './sources/open-meteo.ts'

/**
 * Orquesta la fuente principal (con fallback completo de Open-Meteo si
 * falla) y la complementaria de un único lugar, y devuelve el bloque
 * meteorológico ya combinado (ver `src/domain/combine-weather.ts` para la
 * lógica pura). No incluye `marine` ni `alerts` — eso es de otros bloques.
 *
 * **Fallback de fuente principal (`002-plan.md`):** si AEMET/IPMA falla,
 * ya no excluye el lugar directamente — se intenta Open-Meteo como bloque
 * completo, el mismo camino que ya usa como fuente única de Andorra. Si
 * responde, `provenance.primary` pasa a `'open-meteo'`. Si también falla,
 * se lanza `LocationWeatherUnavailableError` para que quien orqueste todos
 * los lugares lo cuente como fallo real (tolerancia cero tras el fallback).
 *
 * **Excepción — `AemetAuthError` nunca dispara el fallback.** Un 401/403 de
 * AEMET (key caducada) se relanza tal cual, sin capturar, antes de
 * intentar nada con Open-Meteo — enmascararlo escondería una credencial
 * rota detrás de un resultado aparentemente sano. `fetchPrimaryBlock`
 * resuelve diaria + horaria con `Promise.allSettled` en vez de
 * `Promise.all` específicamente para esto: si ambas piden a la vez y una
 * rechaza con `AemetAuthError` mientras la otra rechaza con un error
 * cualquiera, `Promise.all` propagaría el que gane la carrera — con
 * `allSettled` el `AemetAuthError` siempre tiene prioridad sobre el otro,
 * nunca se pierde por timing.
 *
 * **Un `sourceIds` ausente es un error de configuración, no un fallo de
 * proveedor — nunca dispara el fallback.** Se comprueba antes de entrar en
 * el `try/catch` que activa Open-Meteo, así que un lugar mal configurado en
 * `locations.manual.ts` no queda enmascarado como "AEMET/IPMA no
 * respondió": falla con un error claro y ahí se queda.
 *
 * El fallo de la complementaria, en cambio, nunca se propaga: se captura
 * aquí mismo y se convierte en degradación — el lugar sigue siendo válido.
 */

export class LocationWeatherUnavailableError extends Error {}

export interface LocationWeatherResult {
  block: WeatherBlock
  provenance: Provenance
  degradations: Degradation[]
  /**
   * Resultado del intento de complemento como **un único hecho por lugar**
   * (`undefined` cuando no hay complemento configurado — Andorra, o cuando
   * `usedFallback` es `true`) — no se deriva de `degradations.length`, que
   * cuenta por métrica (2 en España, 4 en Portugal) y sobrecontaría un
   * mismo fallo. Es lo que `fetch-forecast.ts` usa para construir el
   * `ComplementGroupTally` del Bloque 6: cada lugar cuenta como máximo un
   * intento y como máximo un fallo, sea cual sea el número de métricas
   * degradadas.
   */
  complementAttempt: 'ok' | 'error' | undefined
  /**
   * `true` cuando la fuente principal falló y Open-Meteo respondió como
   * fallback de bloque completo. Ese lugar no participa en el tally de
   * complemento de su grupo — Open-Meteo ya sustituyó a la principal, no
   * la está complementando; contarlo además como intento de complemento
   * inflaría el ratio de fallo sistémico con la misma petición.
   */
  usedFallback: boolean
}

export async function orchestrateLocationWeather(
  location: Location,
  aemetApiKey: string,
  targetDate: string,
): Promise<LocationWeatherResult> {
  if (location.primarySource === 'open-meteo') {
    const daily = await fetchOpenMeteoDaily(location.latitude, location.longitude, location.timezone, targetDate)
    return {
      block: normalizeOpenMeteoPrimary(daily, targetDate),
      provenance: { primary: 'open-meteo' },
      degradations: [],
      complementAttempt: undefined,
      usedFallback: false,
    }
  }

  assertSourceIdConfigured(location)

  const primary = await fetchPrimaryBlockOrFallback(location, aemetApiKey, targetDate)
  if (primary.usedFallback) {
    return {
      block: primary.block,
      provenance: { primary: 'open-meteo' },
      degradations: [],
      complementAttempt: undefined,
      usedFallback: true,
    }
  }

  const complementMetrics = COMPLEMENT_METRICS_BY_PRIMARY_SOURCE[location.primarySource]
  const complementAttempt = await attemptOpenMeteoComplement(location, targetDate)
  const combined = combineWeatherBlock(
    primary.block,
    location.primarySource,
    'open-meteo',
    complementMetrics,
    complementAttempt,
  )

  return { ...combined, complementAttempt: complementAttempt.status, usedFallback: false }
}

// Fuera del try/catch de `fetchPrimaryBlockOrFallback` a propósito: esto es
// un error de configuración (falta un id en `locations.ts`), no un fallo de
// AEMET/IPMA — no debe activar el fallback de Open-Meteo.
function assertSourceIdConfigured(location: Location): void {
  if (location.primarySource === 'aemet' && !location.sourceIds.aemet) {
    throw new Error(`"${location.id}": falta sourceIds.aemet (error de configuración, no se intenta fallback)`)
  }
  if (location.primarySource === 'ipma' && location.sourceIds.ipma === undefined) {
    throw new Error(`"${location.id}": falta sourceIds.ipma (error de configuración, no se intenta fallback)`)
  }
}

interface PrimaryOrFallbackResult {
  block: WeatherBlock
  usedFallback: boolean
}

async function fetchPrimaryBlockOrFallback(
  location: Location,
  aemetApiKey: string,
  targetDate: string,
): Promise<PrimaryOrFallbackResult> {
  try {
    return { block: await fetchPrimaryBlock(location, aemetApiKey, targetDate), usedFallback: false }
  } catch (error) {
    if (error instanceof AemetAuthError) {
      throw error
    }
    try {
      const daily = await fetchOpenMeteoDaily(location.latitude, location.longitude, location.timezone, targetDate)
      return { block: normalizeOpenMeteoPrimary(daily, targetDate), usedFallback: true }
    } catch {
      throw new LocationWeatherUnavailableError(
        `"${location.id}": falló tanto la fuente principal (${location.primarySource}) como el fallback de Open-Meteo`,
      )
    }
  }
}

async function fetchPrimaryBlock(location: Location, aemetApiKey: string, targetDate: string): Promise<WeatherBlock> {
  if (location.primarySource === 'aemet') {
    const municipioId = location.sourceIds.aemet
    if (!municipioId) {
      throw new Error(`"${location.id}": falta sourceIds.aemet`)
    }
    const [dailyResult, hourlyResult] = await Promise.allSettled([
      fetchAemetDaily(municipioId, aemetApiKey),
      fetchAemetHourly(municipioId, aemetApiKey),
    ])
    // AemetAuthError siempre gana, sea cual sea el orden en que resuelvan
    // las dos promesas — ver comentario de cabecera.
    for (const result of [dailyResult, hourlyResult]) {
      if (result.status === 'rejected' && result.reason instanceof AemetAuthError) {
        throw result.reason
      }
    }
    if (dailyResult.status === 'rejected') throw dailyResult.reason
    if (hourlyResult.status === 'rejected') throw hourlyResult.reason
    return normalizeAemet(dailyResult.value, hourlyResult.value, targetDate)
  }

  const globalIdLocal = location.sourceIds.ipma
  if (globalIdLocal === undefined) {
    throw new Error(`"${location.id}": falta sourceIds.ipma`)
  }
  return normalizeIpma(await fetchIpmaDaily(globalIdLocal), targetDate)
}

async function attemptOpenMeteoComplement(location: Location, targetDate: string): Promise<ComplementAttempt> {
  try {
    const daily = await fetchOpenMeteoDaily(location.latitude, location.longitude, location.timezone, targetDate)
    const complement = normalizeOpenMeteoComplement(daily, targetDate)

    const values: Partial<Record<MetricPath, number>> = {}
    if (complement.precipitationMm !== null) values['precipitation.mm'] = complement.precipitationMm
    if (complement.snowCm !== null) values['snow.cm'] = complement.snowCm
    if (complement.windSpeedKmh !== null) values['wind.speedKmh'] = complement.windSpeedKmh
    if (complement.windGustKmh !== null) values['wind.gustKmh'] = complement.windGustKmh

    return { status: 'ok', values }
  } catch {
    return { status: 'error' }
  }
}
