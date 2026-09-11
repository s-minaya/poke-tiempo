import type { Marine } from '../../src/domain/types.ts'

/**
 * Cliente y normalización de Open-Meteo Marine — altura, periodo y
 * dirección de ola para las localidades costeras de España y Portugal (ver
 * `Location.marineCoordinates` y la estrategia de marine en `002-plan.md`).
 * Sin key. Unidades ya vienen en las que necesita el dominio (m, s, °), sin
 * conversión.
 */

interface OpenMeteoMarineDailyBlock {
  time: string[]
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

/**
 * `start_date`/`end_date` en vez de `forecast_days` — mismo motivo que
 * `open-meteo.ts`: se pide explícitamente `targetDate`, y la normalización
 * comprueba igualmente que la fecha devuelta es la pedida (defensa en
 * profundidad, `002-plan.md`).
 */
export async function fetchOpenMeteoMarine(
  latitude: number,
  longitude: number,
  timezone: string,
  targetDate: string,
): Promise<OpenMeteoMarineResponse> {
  const url = new URL('https://marine-api.open-meteo.com/v1/marine')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('timezone', timezone)
  url.searchParams.set('start_date', targetDate)
  url.searchParams.set('end_date', targetDate)
  url.searchParams.set('daily', 'wave_height_max,wave_period_max,wave_direction_dominant')
  return fetchJson<OpenMeteoMarineResponse>(url)
}

function findDayIndex(time: string[], targetDate: string): number {
  const index = time.indexOf(targetDate)
  if (index === -1) {
    throw new Error(`Open-Meteo Marine: no hay datos para ${targetDate} (fechas disponibles: ${time.join(', ')})`)
  }
  return index
}

function valueAt(values: number[], index: number): number | null {
  const value = values[index]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function normalizeOpenMeteoMarine(marine: OpenMeteoMarineResponse, targetDate: string): Marine {
  const day = marine.daily
  const index = findDayIndex(day.time, targetDate)
  return {
    waveHeightM: valueAt(day.wave_height_max, index),
    wavePeriodS: valueAt(day.wave_period_max, index),
    waveDirectionDeg: valueAt(day.wave_direction_dominant, index),
    source: 'open-meteo',
  }
}
