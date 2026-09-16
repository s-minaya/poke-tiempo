import type { SkyCondition, Temperature, WeatherBlock } from '../../src/domain/types.ts'
import { fetchAemetJson } from './aemet-client.ts'

/**
 * Cliente y normalización de la predicción de AEMET (diaria + horaria) para
 * un municipio. La diaria da los agregados oficiales del día (temperatura
 * máx/mín, probabilidad de precipitación); la horaria da el código de
 * estado del cielo (que también revela tormenta/niebla/calima/nieve) y el
 * viento real por hora.
 *
 * `precipitation.mm` NO sale de AEMET: su horaria no da un campo de
 * precipitación en mm por hora en el que se pueda confiar para sumar un
 * acumulado diario fiable (decisión documentada en `002-plan.md`). Ese
 * campo queda `null` aquí y lo complementa Open-Meteo.
 */

// --- Formas mínimas de la respuesta real de AEMET (solo lo que se usa) ----

interface AemetDailyPeriodValue {
  value: number
  periodo: string
}

interface AemetDailyDay {
  probPrecipitacion: AemetDailyPeriodValue[]
  temperatura: { maxima: number; minima: number }
  fecha: string
}

export interface AemetDailyResponse {
  prediccion: { dia: AemetDailyDay[] }
}

interface AemetSkyPeriod {
  value: string
  periodo: string
  descripcion: string
}

interface AemetHourlyPeriodValue {
  value: string
  periodo: string
}

interface AemetWindEntry {
  direccion?: string[]
  velocidad?: string[]
  value?: string
  periodo: string
}

interface AemetHourlyDay {
  estadoCielo: AemetSkyPeriod[]
  nieve: AemetHourlyPeriodValue[]
  vientoAndRachaMax: AemetWindEntry[]
  fecha: string
}

export interface AemetHourlyResponse {
  prediccion: { dia: AemetHourlyDay[] }
}

// --- Cliente ----------------------------------------------------------

export async function fetchAemetDaily(municipioId: string, apiKey: string): Promise<AemetDailyResponse> {
  const [response] = await fetchAemetJson<AemetDailyResponse[]>(
    `/api/prediccion/especifica/municipio/diaria/${municipioId}`,
    apiKey,
  )
  return response
}

export async function fetchAemetHourly(municipioId: string, apiKey: string): Promise<AemetHourlyResponse> {
  const [response] = await fetchAemetJson<AemetHourlyResponse[]>(
    `/api/prediccion/especifica/municipio/horaria/${municipioId}`,
    apiKey,
  )
  return response
}

// --- Tabla de estado del cielo -----------------------------------------
//
// Catálogo real de AEMET: cada familia de 10 (2x lluvia, 3x nieve, 4x lluvia
// escasa, 5x tormenta, 6x tormenta+lluvia escasa, 7x nieve escasa) repite la
// misma escala de nubosidad en su dígito de unidades (3=intervalos nubosos,
// 4=nuboso, 5=muy nuboso, 6=cubierto) que la familia base 1x. `SkyCondition`
// solo tiene 4 valores frente a los ~6 niveles de AEMET, así que se agrupan
// por pares: intervalos nubosos con poco_nuboso, muy nuboso con nuboso.
const SKY_CODE_TO_CONDITION: Record<string, SkyCondition> = {
  '11': 'despejado',
  '12': 'poco_nuboso',
  '13': 'poco_nuboso',
  '14': 'nuboso',
  '15': 'nuboso',
  '16': 'cubierto',
  '17': 'poco_nuboso', // nubes altas: apenas tapan el sol, se agrupan con poco_nuboso
  '23': 'poco_nuboso',
  '24': 'nuboso',
  '25': 'nuboso',
  '26': 'cubierto',
  '33': 'poco_nuboso',
  '34': 'nuboso',
  '35': 'nuboso',
  '36': 'cubierto',
  '43': 'poco_nuboso',
  '44': 'nuboso',
  '45': 'nuboso',
  '46': 'cubierto',
  '51': 'poco_nuboso',
  '52': 'nuboso',
  '53': 'nuboso',
  '54': 'cubierto',
  '61': 'poco_nuboso',
  '62': 'nuboso',
  '63': 'nuboso',
  '64': 'cubierto',
  '71': 'poco_nuboso',
  '72': 'nuboso',
  '73': 'nuboso',
  '74': 'cubierto',
  // 81 (niebla), 82 (bruma) y 83 (calima) no llevan nubosidad asociada:
  // AEMET sustituye la categoría de nubes por el fenómeno de visibilidad.
}

const STORM_CODES = new Set(['51', '52', '53', '54', '61', '62', '63', '64'])
const SNOW_CODES = new Set(['33', '34', '35', '36', '71', '72', '73', '74'])
const FOG_CODE = '81'
const CALIMA_CODE = '83'

// Niebla, solo en ventana diurna: una única aparición nocturna (p. ej.
// 22h-23h) no debe tapar un día despejado el resto de horas. `periodo` en
// la horaria de AEMET es la hora en punto ("08", "21"...), sin el sufijo
// "n" que sí lleva `value` — se compara como número, sin construir un
// sistema genérico de franjas horarias.
const DAYTIME_FOG_START_HOUR = 8
const DAYTIME_FOG_END_HOUR = 20

function isDaytimePeriod(periodo: string): boolean {
  const hour = Number(periodo)
  return Number.isFinite(hour) && hour >= DAYTIME_FOG_START_HOUR && hour <= DAYTIME_FOG_END_HOUR
}

// El código lleva sufijo 'n' en horario nocturno (ej. '17n') — mismo
// significado que su versión diurna a efectos de este dominio.
function baseSkyCode(value: string): string {
  return value.endsWith('n') ? value.slice(0, -1) : value
}

function findRepresentativeHour<T extends { periodo: string }>(entries: T[]): T | undefined {
  if (entries.length === 0) return undefined
  return entries.reduce((closest, entry) =>
    Math.abs(Number(entry.periodo) - 12) < Math.abs(Number(closest.periodo) - 12) ? entry : closest,
  )
}

// --- Normalización ------------------------------------------------------

// AEMET devuelve varios días por petición (la ventana completa que cubre su
// predicción, no solo "hoy") — nunca se asume qué posición ocupa `targetDate`
// dentro de ese array, se busca por `fecha` (`002-plan.md` → `targetDate`).
function findDayByDate<T extends { fecha: string }>(days: T[], targetDate: string): T | undefined {
  return days.find((day) => day.fecha.slice(0, 10) === targetDate)
}

export interface AemetDailyNormalized {
  date: string
  temperature: Temperature
  precipitationProbabilityPercent: number | null
}

export function normalizeAemetDaily(daily: AemetDailyResponse, targetDate: string): AemetDailyNormalized {
  const day = findDayByDate(daily.prediccion.dia, targetDate)
  if (!day) {
    throw new Error(`AEMET diaria: no hay predicción para ${targetDate}`)
  }
  const dayProbability = day.probPrecipitacion.find((entry) => entry.periodo === '00-24')

  return {
    date: day.fecha.slice(0, 10),
    temperature: { maxC: day.temperatura.maxima, minC: day.temperatura.minima },
    precipitationProbabilityPercent: dayProbability ? dayProbability.value : null,
  }
}

export interface AemetHourlyNormalized {
  sky: SkyCondition | null
  snowPresent: boolean | null
  windSpeedKmh: number | null
  windGustKmh: number | null
  storm: boolean | null
  calima: boolean | null
  fog: boolean | null
  primarySourceDescription: string | null
}

const EMPTY_HOURLY_NORMALIZED: AemetHourlyNormalized = {
  sky: null,
  snowPresent: null,
  windSpeedKmh: null,
  windGustKmh: null,
  storm: null,
  calima: null,
  fog: null,
  primarySourceDescription: null,
}

export function normalizeAemetHourly(hourly: AemetHourlyResponse, targetDate: string): AemetHourlyNormalized {
  const day = findDayByDate(hourly.prediccion.dia, targetDate)
  if (!day || day.estadoCielo.length === 0) {
    return EMPTY_HOURLY_NORMALIZED
  }

  const skyCodes = day.estadoCielo.map((entry) => baseSkyCode(entry.value))
  const storm = skyCodes.some((code) => STORM_CODES.has(code))
  const calima = skyCodes.some((code) => code === CALIMA_CODE)
  // Solo periodos diurnos (ver DAYTIME_FOG_START_HOUR/END_HOUR arriba) —
  // a diferencia de storm/calima, que miran el día completo.
  const fog = day.estadoCielo.some((entry) => isDaytimePeriod(entry.periodo) && baseSkyCode(entry.value) === FOG_CODE)

  // El campo `nieve` (mm de equivalente en agua) es la señal cuantitativa,
  // pero el propio código de cielo (familias 33-36 y 71-74) ya confirma
  // nieve aunque ese campo salga en 0 para esa hora — ambas cuentan.
  const snowPresent =
    day.nieve.some((entry) => Number(entry.value) > 0) || skyCodes.some((code) => SNOW_CODES.has(code))

  const windSpeeds = day.vientoAndRachaMax
    .filter((entry): entry is AemetWindEntry & { velocidad: string[] } => Array.isArray(entry.velocidad))
    .map((entry) => Number(entry.velocidad[0]))
    .filter((value) => Number.isFinite(value))
  const windGusts = day.vientoAndRachaMax
    .filter((entry): entry is AemetWindEntry & { value: string } => typeof entry.value === 'string')
    .map((entry) => Number(entry.value))
    .filter((value) => Number.isFinite(value))

  const representativeHour = findRepresentativeHour(day.estadoCielo)
  const representativeCode = representativeHour ? baseSkyCode(representativeHour.value) : undefined
  const sky = representativeCode ? (SKY_CODE_TO_CONDITION[representativeCode] ?? null) : null

  return {
    sky,
    snowPresent,
    windSpeedKmh: windSpeeds.length > 0 ? Math.max(...windSpeeds) : null,
    windGustKmh: windGusts.length > 0 ? Math.max(...windGusts) : null,
    storm,
    calima,
    fog,
    primarySourceDescription: representativeHour?.descripcion ?? null,
  }
}

export type AemetNormalizedForecast = WeatherBlock

export function normalizeAemet(
  daily: AemetDailyResponse,
  hourly: AemetHourlyResponse,
  targetDate: string,
): AemetNormalizedForecast {
  const dailyNormalized = normalizeAemetDaily(daily, targetDate)
  const hourlyNormalized = normalizeAemetHourly(hourly, targetDate)

  return {
    date: dailyNormalized.date,
    temperature: dailyNormalized.temperature,
    sky: hourlyNormalized.sky,
    // mm queda null: ver comentario de cabecera — lo complementa Open-Meteo
    // (Bloque 5), igual que en Portugal.
    precipitation: {
      mm: null,
      probabilityPercent: dailyNormalized.precipitationProbabilityPercent,
    },
    // cm queda null: AEMET solo da nieve en mm de equivalente en agua, no se
    // convierte — lo completa Open-Meteo como complemento (ver Bloque 5).
    snow: { cm: null, present: hourlyNormalized.snowPresent },
    wind: { speedKmh: hourlyNormalized.windSpeedKmh, gustKmh: hourlyNormalized.windGustKmh },
    storm: hourlyNormalized.storm,
    calima: hourlyNormalized.calima,
    fog: hourlyNormalized.fog,
    primarySourceDescription: hourlyNormalized.primarySourceDescription,
  }
}
