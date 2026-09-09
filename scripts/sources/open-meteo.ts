import type { SkyCondition, WeatherBlock } from '../../src/domain/types.ts'

/**
 * Cliente y normalización de Open-Meteo (forecast estándar, sin key). Se usa
 * de dos formas: como **fuente única** para Andorra (`normalizeOpenMeteoPrimary`,
 * bloque completo) y como **complemento numérico** para España/Portugal
 * (`normalizeOpenMeteoComplement`, solo los campos que AEMET/IPMA no pueden
 * dar con la unidad real — ver `002-plan.md`).
 *
 * `precipitation.mm` se construye como `rain_sum + showers_sum`, nunca
 * `precipitation_sum`: Open-Meteo documenta `precipitation_sum` como "rain,
 * showers and snowfall" — incluye el equivalente en agua de la nieve, que
 * mediría otra cosa que la regla de lluvia de la 003 no busca. `rain_sum` y
 * `showers_sum` son las dos formas de precipitación líquida (de sistemas de
 * gran escala y convectiva respectivamente); sumadas dan la lluvia real del
 * día sin mezclar nieve.
 */

interface OpenMeteoDailyBlock {
  time: string[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  rain_sum: number[]
  showers_sum: number[]
  snowfall_sum: number[]
  precipitation_probability_max: number[]
  wind_speed_10m_max: number[]
  wind_gusts_10m_max: number[]
  weather_code: number[]
}

export interface OpenMeteoDailyResponse {
  daily: OpenMeteoDailyBlock
}

const DAILY_PARAMS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'rain_sum',
  'showers_sum',
  'snowfall_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'weather_code',
].join(',')

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

export async function fetchOpenMeteoDaily(
  latitude: number,
  longitude: number,
  timezone: string,
): Promise<OpenMeteoDailyResponse> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('timezone', timezone)
  url.searchParams.set('forecast_days', '1')
  url.searchParams.set('daily', DAILY_PARAMS)
  return fetchJson<OpenMeteoDailyResponse>(url)
}

// --- Complemento numérico (España/Portugal) --------------------------------

export interface OpenMeteoComplement {
  precipitationMm: number | null
  snowCm: number | null
  windSpeedKmh: number | null
  windGustKmh: number | null
}

function todayValue(values: number[]): number | null {
  const value = values[0]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function normalizeOpenMeteoComplement(daily: OpenMeteoDailyResponse): OpenMeteoComplement {
  const day = daily.daily
  const rain = todayValue(day.rain_sum)
  const showers = todayValue(day.showers_sum)

  return {
    precipitationMm: rain !== null && showers !== null ? rain + showers : null,
    snowCm: todayValue(day.snowfall_sum),
    windSpeedKmh: todayValue(day.wind_speed_10m_max),
    windGustKmh: todayValue(day.wind_gusts_10m_max),
  }
}

// --- Fuente única (Andorra) -------------------------------------------------
//
// Catálogo WMO estándar que usa `weather_code` — mismo catálogo internacional
// que documenta Open-Meteo (https://open-meteo.com/en/docs), no una
// interpretación propia. Como en IPMA, cada código es nubosidad pura O un
// fenómeno sin nubosidad asociada, nunca ambas cosas — para los segundos
// `sky` queda `null`.
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
}

const CLOUD_ONLY_WMO_CODES: Record<number, SkyCondition> = {
  0: 'despejado',
  1: 'poco_nuboso',
  2: 'nuboso',
  3: 'cubierto',
}

const FOG_WMO_CODES = new Set([45, 48])
const STORM_WMO_CODES = new Set([95, 96, 99])
const SNOW_WMO_CODES = new Set([71, 73, 75, 77, 85, 86])
// Open-Meteo no tiene categoría de calima en weather_code — ese eje queda
// siempre null viniendo de esta fuente, igual que en IPMA.

export type OpenMeteoNormalizedForecast = WeatherBlock

export function normalizeOpenMeteoPrimary(daily: OpenMeteoDailyResponse): OpenMeteoNormalizedForecast {
  const day = daily.daily
  const weatherCode = day.weather_code[0]
  const hasInfo = weatherCode in WMO_DESCRIPTIONS
  const complement = normalizeOpenMeteoComplement(daily)

  return {
    date: day.time[0],
    temperature: { maxC: day.temperature_2m_max[0], minC: day.temperature_2m_min[0] },
    sky: hasInfo ? (CLOUD_ONLY_WMO_CODES[weatherCode] ?? null) : null,
    precipitation: {
      mm: complement.precipitationMm,
      probabilityPercent: todayValue(day.precipitation_probability_max),
    },
    snow: {
      cm: complement.snowCm,
      // Regla de coherencia del dominio: si hay cm real, present se deriva
      // de ahí (cm > 0), no del código categórico por separado.
      present:
        complement.snowCm !== null
          ? complement.snowCm > 0
          : hasInfo
            ? SNOW_WMO_CODES.has(weatherCode)
            : null,
    },
    wind: { speedKmh: complement.windSpeedKmh, gustKmh: complement.windGustKmh },
    storm: hasInfo ? STORM_WMO_CODES.has(weatherCode) : null,
    calima: null,
    fog: hasInfo ? FOG_WMO_CODES.has(weatherCode) : null,
    primarySourceDescription: WMO_DESCRIPTIONS[weatherCode] ?? null,
  }
}
