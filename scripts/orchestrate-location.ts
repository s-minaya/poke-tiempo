import type { Degradation, Location, MetricPath, Provenance, WeatherBlock } from '../src/domain/types.ts'
import type { ComplementAttempt } from '../src/domain/combine-weather.ts'
import { COMPLEMENT_METRICS_BY_PRIMARY_SOURCE, combineWeatherBlock } from '../src/domain/combine-weather.ts'
import { fetchAemetDaily, fetchAemetHourly, normalizeAemet } from './sources/aemet.ts'
import { fetchIpmaDaily, normalizeIpma } from './sources/ipma.ts'
import {
  fetchOpenMeteoDaily,
  normalizeOpenMeteoComplement,
  normalizeOpenMeteoPrimary,
} from './sources/open-meteo.ts'

/**
 * Orquesta la fuente principal + complementaria de un único lugar y devuelve
 * el bloque meteorológico ya combinado (ver `src/domain/combine-weather.ts`
 * para la lógica pura). No incluye `marine` ni `alerts` — eso es de otros
 * bloques — ni decide qué hacer si la fuente principal falla: ese fallo se
 * propaga (lanza) para que quien orqueste todos los lugares decida excluirlo
 * (política de tolerancia a fallos, Bloque 6).
 *
 * El fallo de la complementaria, en cambio, nunca se propaga: se captura
 * aquí mismo y se convierte en degradación — el lugar sigue siendo válido.
 */

export interface LocationWeatherResult {
  block: WeatherBlock
  provenance: Provenance
  degradations: Degradation[]
  /**
   * Resultado del intento de complemento como **un único hecho por lugar**
   * (`undefined` cuando no hay complemento configurado, como Andorra) — no
   * se deriva de `degradations.length`, que cuenta por métrica (2 en
   * España, 4 en Portugal) y sobrecontaría un mismo fallo. Es lo que
   * `fetch-forecast.ts` usa para construir el `ComplementGroupTally` del
   * Bloque 6: cada lugar cuenta como máximo un intento y como máximo un
   * fallo, sea cual sea el número de métricas degradadas.
   */
  complementAttempt: 'ok' | 'error' | undefined
}

export async function orchestrateLocationWeather(
  location: Location,
  aemetApiKey: string,
): Promise<LocationWeatherResult> {
  if (location.primarySource === 'open-meteo') {
    const daily = await fetchOpenMeteoDaily(location.latitude, location.longitude, location.timezone)
    return {
      block: normalizeOpenMeteoPrimary(daily),
      provenance: { primary: 'open-meteo' },
      degradations: [],
      complementAttempt: undefined,
    }
  }

  const primaryBlock = await fetchPrimaryBlock(location, aemetApiKey)
  const complementMetrics = COMPLEMENT_METRICS_BY_PRIMARY_SOURCE[location.primarySource]
  const complementAttempt = await attemptOpenMeteoComplement(location)
  const combined = combineWeatherBlock(
    primaryBlock,
    location.primarySource,
    'open-meteo',
    complementMetrics,
    complementAttempt,
  )

  return { ...combined, complementAttempt: complementAttempt.status }
}

async function fetchPrimaryBlock(location: Location, aemetApiKey: string): Promise<WeatherBlock> {
  if (location.primarySource === 'aemet') {
    const municipioId = location.sourceIds.aemet
    if (!municipioId) {
      throw new Error(`"${location.id}": falta sourceIds.aemet`)
    }
    const [daily, hourly] = await Promise.all([
      fetchAemetDaily(municipioId, aemetApiKey),
      fetchAemetHourly(municipioId, aemetApiKey),
    ])
    return normalizeAemet(daily, hourly)
  }

  const globalIdLocal = location.sourceIds.ipma
  if (globalIdLocal === undefined) {
    throw new Error(`"${location.id}": falta sourceIds.ipma`)
  }
  return normalizeIpma(await fetchIpmaDaily(globalIdLocal))
}

async function attemptOpenMeteoComplement(location: Location): Promise<ComplementAttempt> {
  try {
    const daily = await fetchOpenMeteoDaily(location.latitude, location.longitude, location.timezone)
    const complement = normalizeOpenMeteoComplement(daily)

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
