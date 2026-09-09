import type { Marine } from '../../src/domain/types.ts'

/**
 * Cliente y normalización de Open-Meteo Marine — altura, periodo y
 * dirección de ola para las localidades costeras de España y Portugal (ver
 * `Location.marineCoordinates` y la estrategia de marine en `002-plan.md`).
 * Sin key. Unidades ya vienen en las que necesita el dominio (m, s, °), sin
 * conversión.
 */

interface OpenMeteoMarineDailyBlock {
  wave_height_max: number[]
  wave_period_max: number[]
  wave_direction_dominant: number[]
}

export interface OpenMeteoMarineResponse {
  daily: OpenMeteoMarineDailyBlock
}

const MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson<T>(url: URL): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`${url.pathname}: HTTP ${response.status}`)
      }
      return (await response.json()) as T
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
      }
    }
  }
  throw lastError
}

export async function fetchOpenMeteoMarine(
  latitude: number,
  longitude: number,
  timezone: string,
): Promise<OpenMeteoMarineResponse> {
  const url = new URL('https://marine-api.open-meteo.com/v1/marine')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('timezone', timezone)
  url.searchParams.set('forecast_days', '1')
  url.searchParams.set('daily', 'wave_height_max,wave_period_max,wave_direction_dominant')
  return fetchJson<OpenMeteoMarineResponse>(url)
}

function todayValue(values: number[]): number | null {
  const value = values[0]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function normalizeOpenMeteoMarine(marine: OpenMeteoMarineResponse): Marine {
  const day = marine.daily
  return {
    waveHeightM: todayValue(day.wave_height_max),
    wavePeriodS: todayValue(day.wave_period_max),
    waveDirectionDeg: todayValue(day.wave_direction_dominant),
    source: 'open-meteo',
  }
}
