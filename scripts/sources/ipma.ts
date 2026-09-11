import type { AlertLevel, AlertPhenomenon, OfficialAlert, SkyCondition, WeatherBlock } from '../../src/domain/types.ts'

/**
 * Cliente y normalización de la predicción de IPMA (previsión diaria por
 * `globalIdLocal`, sin key ni doble llamada) y de sus avisos oficiales
 * (`warnings_www.json`, `idAreaAviso` = zona, sin mapeo adicional: los
 * `idAreaAviso` de `Location.alertZoneIds.ipma` son literalmente los mismos
 * que trae el catálogo de distritos, ver Bloque 1).
 *
 * IPMA da un único `idWeatherType` para el día entero (sin franjas horarias
 * como AEMET) y nunca da mm de lluvia reales, cm de nieve reales, viento en
 * km/h real ni categoría de calima — solo clases/probabilidad. Esos campos
 * quedan `null` aquí; los completa Open-Meteo (ver `002-plan.md`).
 */

// --- Formas mínimas de la respuesta real de IPMA (solo lo que se usa) -----

interface IpmaDailyEntry {
  precipitaProb: string
  tMin: string
  tMax: string
  idWeatherType: number
  forecastDate: string
}

export interface IpmaDailyResponse {
  data: IpmaDailyEntry[]
  globalIdLocal: number
}

export interface IpmaWarningEntry {
  awarenessTypeName: string
  idAreaAviso: string
  startTime: string
  endTime: string
  awarenessLevelID: 'green' | 'yellow' | 'orange' | 'red'
  text: string
}

// --- Cliente -------------------------------------------------------------
//
// Reintentos ante fallos transitorios (antes no tenía ninguno: un blip de
// red excluía el lugar a la primera) — mismo patrón que `open-meteo.ts`
// (backoff exponencial simple), sin el throttle de `aemet-client.ts` porque
// IPMA no tiene rate limit documentado ni key. La política de fallback
// (`002-plan.md`) asume que "falla tras sus reintentos" es cierto para las
// tres fuentes, no solo AEMET.

const MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`${url}: HTTP ${response.status}`)
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

export async function fetchIpmaDaily(globalIdLocal: number): Promise<IpmaDailyResponse> {
  return fetchJson<IpmaDailyResponse>(
    `https://api.ipma.pt/open-data/forecast/meteorology/cities/daily/${globalIdLocal}.json`,
  )
}

export async function fetchIpmaWarnings(): Promise<IpmaWarningEntry[]> {
  return fetchJson<IpmaWarningEntry[]>('https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json')
}

// --- Catálogo de idWeatherType --------------------------------------------
//
// Copiado literal de https://api.ipma.pt/open-data/weather-type-classe.json
// (campo `descWeatherTypePT`) — es el mismo catálogo estable que usa
// cualquier consumidor de IPMA, no una interpretación propia.
const WEATHER_TYPE_DESCRIPTIONS: Record<number, string> = {
  [-99]: '---',
  0: 'Sem informação',
  1: 'Céu limpo',
  2: 'Céu pouco nublado',
  3: 'Céu parcialmente nublado',
  4: 'Céu muito nublado ou encoberto',
  5: 'Céu nublado por nuvens altas',
  6: 'Aguaceiros/chuva',
  7: 'Aguaceiros/chuva fracos',
  8: 'Aguaceiros/chuva fortes',
  9: 'Chuva/aguaceiros',
  10: 'Chuva fraca ou chuvisco',
  11: 'Chuva/aguaceiros forte',
  12: 'Períodos de chuva',
  13: 'Períodos de chuva fraca',
  14: 'Períodos de chuva forte',
  15: 'Chuvisco',
  16: 'Neblina',
  17: 'Nevoeiro ou nuvens baixas',
  18: 'Neve',
  19: 'Trovoada',
  20: 'Aguaceiros e possibilidade de trovoada',
  21: 'Granizo',
  22: 'Geada',
  23: 'Chuva e possibilidade de trovoada',
  24: 'Nebulosidade convectiva',
  25: 'Céu com períodos de muito nublado',
  26: 'Nevoeiro',
  27: 'Céu nublado',
  28: 'Aguaceiros de neve',
  29: 'Chuva e Neve',
  30: 'Chuva e Neve',
}

// A diferencia de AEMET (cuyo código combina nubosidad + fenómeno en un
// único número graduado), el catálogo de IPMA es una lista plana: unos
// códigos describen solo nubosidad y otros solo un fenómeno (lluvia, nieve,
// tormenta, niebla...) sin indicar nubosidad. Para los segundos, `sky`
// queda `null` — IPMA no dio ese dato, inventarlo sería fabricarlo.
const CLOUD_ONLY_WEATHER_TYPES: Record<number, SkyCondition> = {
  1: 'despejado',
  2: 'poco_nuboso',
  3: 'poco_nuboso',
  4: 'cubierto',
  5: 'poco_nuboso', // nuvens altas: apenas tapan el sol
  24: 'nuboso', // nebulosidade convectiva: nubes de tormenta en formación, sin tormenta confirmada aún
  25: 'nuboso',
  27: 'nuboso',
}

const STORM_WEATHER_TYPES = new Set([19, 20, 23])
const FOG_WEATHER_TYPES = new Set([17, 26])
const SNOW_WEATHER_TYPES = new Set([18, 28, 29, 30])
// 16 (Neblina/mist) no es niebla (17/26) ni calima: IPMA no tiene categoría
// de calima (confirmado, no aparece en su catálogo), así que ese eje queda
// siempre null viniendo de esta fuente.
//
// -99/0 son los códigos propios de IPMA para "sin información". Un código
// que no aparece ni siquiera en `WEATHER_TYPE_DESCRIPTIONS` (catálogo no
// documentado, o IPMA añade uno nuevo) se trata igual: no es evidencia de
// que el fenómeno esté ausente, es que no hay información fiable — nunca
// se interpreta un código desconocido como "sin tormenta/niebla/nieve".
const NO_INFO_WEATHER_TYPES = new Set([-99, 0])

// --- Normalización ---------------------------------------------------------

export type IpmaNormalizedForecast = WeatherBlock

export function normalizeIpma(daily: IpmaDailyResponse, targetDate: string): IpmaNormalizedForecast {
  const day = daily.data.find((entry) => entry.forecastDate === targetDate)
  if (!day) {
    throw new Error(`IPMA: no hay predicción para ${targetDate}`)
  }
  const weatherType = day.idWeatherType
  const isKnownCode = weatherType in WEATHER_TYPE_DESCRIPTIONS
  const hasInfo = isKnownCode && !NO_INFO_WEATHER_TYPES.has(weatherType)

  return {
    date: day.forecastDate,
    temperature: { maxC: Number(day.tMax), minC: Number(day.tMin) },
    sky: hasInfo ? (CLOUD_ONLY_WEATHER_TYPES[weatherType] ?? null) : null,
    precipitation: {
      // IPMA nunca da mm reales, solo probabilidad — lo completa Open-Meteo.
      mm: null,
      probabilityPercent: Number(day.precipitaProb),
    },
    snow: {
      // IPMA nunca da cm reales — lo completa Open-Meteo.
      cm: null,
      present: hasInfo ? SNOW_WEATHER_TYPES.has(weatherType) : null,
    },
    // IPMA solo da una clase de viento (1-5), no km/h reales — no se
    // convierte, lo completa Open-Meteo.
    wind: { speedKmh: null, gustKmh: null },
    storm: hasInfo ? STORM_WEATHER_TYPES.has(weatherType) : null,
    calima: null, // sin categoría en IPMA, confirmado
    fog: hasInfo ? FOG_WEATHER_TYPES.has(weatherType) : null,
    primarySourceDescription: WEATHER_TYPE_DESCRIPTIONS[weatherType] ?? null,
  }
}

// --- Avisos ----------------------------------------------------------------
//
// Catálogo real confirmado contra `warnings_www.json` (8 tipos, ninguno sin
// mapear — a diferencia de AEMET, IPMA no tiene categorías fuera del
// vocabulario del dominio en su catálogo actual).
const IPMA_PHENOMENON_MAP: Record<string, AlertPhenomenon> = {
  'Precipitação': 'lluvia',
  Neve: 'nieve',
  Vento: 'viento',
  Trovoada: 'tormenta',
  'Tempo Quente': 'temperatura_maxima',
  'Tempo Frio': 'temperatura_minima',
  'Agitação Marítima': 'costero',
  Nevoeiro: 'niebla',
}

const IPMA_LEVEL_MAP: Record<string, AlertLevel> = {
  yellow: 'amarillo',
  orange: 'naranja',
  red: 'rojo',
  // green: sin entrada — el nivel "sin aviso" no se representa.
}

export function normalizeIpmaAlert(raw: IpmaWarningEntry): OfficialAlert | null {
  const level = IPMA_LEVEL_MAP[raw.awarenessLevelID]
  if (!level) return null

  return {
    level,
    phenomenon: IPMA_PHENOMENON_MAP[raw.awarenessTypeName] ?? 'desconocido',
    sourcePhenomenon: raw.awarenessTypeName,
    startsAt: raw.startTime,
    endsAt: raw.endTime,
    source: 'ipma',
    officialZoneId: raw.idAreaAviso,
  }
}
