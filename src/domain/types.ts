// Contrato de datos de la 002 (pipeline meteorológico). Fuente de verdad del
// dominio: features/002-weather-data-pipeline/002-plan.md — cualquier cambio
// de forma pasa primero por ese documento, no por este archivo.

export type SourceId = 'aemet' | 'ipma' | 'open-meteo'

// Solo nubosidad. Lluvia, tormenta, calima, niebla y nieve son ejes propios,
// no se absorben aquí.
export type SkyCondition = 'despejado' | 'poco_nuboso' | 'nuboso' | 'cubierto'

export interface Temperature {
  maxC: number
  minC: number
}

export interface Precipitation {
  mm: number | null
  probabilityPercent: number | null
}

export interface Snow {
  cm: number | null
  present: boolean | null
}

export interface Wind {
  speedKmh: number | null
  gustKmh: number | null
}

// Rutas de métrica que alguna vez pueden venir de una fuente complementaria —
// vocabulario único compartido por `Degradation` y `Provenance`.
export type MetricPath =
  | 'precipitation.mm'
  | 'snow.cm'
  | 'wind.speedKmh'
  | 'wind.gustKmh'
  | 'marine.waveHeightM'
  | 'marine.wavePeriodS'
  | 'marine.waveDirectionDeg'

export interface Degradation {
  metric: MetricPath
  reason: 'source_error'
  attemptedSource: SourceId
}

export interface Marine {
  waveHeightM: number | null
  wavePeriodS: number | null
  waveDirectionDeg: number | null
  source: SourceId
}

export type MarineAvailability =
  | { status: 'ok'; data: Marine }
  | { status: 'not_applicable' } // Location.coastal === false: hecho estructural, nunca va a haber dato
  | { status: 'error' } // Location.coastal === true, pero la consulta de hoy falló

export type AlertLevel = 'amarillo' | 'naranja' | 'rojo' // 'verde' = sin entrada, no se representa como nivel

export type AlertPhenomenon =
  | 'lluvia'
  | 'nieve'
  | 'viento'
  | 'tormenta'
  | 'temperatura_maxima'
  | 'temperatura_minima'
  | 'costero'
  | 'niebla'
  | 'calima'
  | 'deshielo'
  | 'desconocido' // fallback honesto si algo no mapea, en vez de forzar una categoría existente

export interface OfficialAlert {
  level: AlertLevel
  phenomenon: AlertPhenomenon
  sourcePhenomenon: string // literal tal cual lo da la fuente — trazabilidad, nunca se pierde
  startsAt: string // ISO datetime
  endsAt: string
  source: 'aemet' | 'ipma' // nunca 'open-meteo' — no tiene este producto
  officialZoneId: string // zona propia de la fuente, sin mapear a nuestros 74 lugares
}

export type AlertsAvailability =
  | { status: 'ok'; alerts: OfficialAlert[] } // consultado; alerts puede ser [] (sin avisos activos)
  | { status: 'unsupported' } // la fuente no tiene este producto (Open-Meteo/Andorra, siempre)
  | { status: 'error' } // el producto existe pero la consulta de hoy falló

// Trazabilidad por métrica, no por bloque entero: un mismo eje puede mezclar
// fuentes (ej. Lisboa: precipitation.mm de Open-Meteo, .probabilityPercent de IPMA).
export interface Provenance {
  primary: SourceId
  complementary?: Partial<Record<MetricPath, SourceId>>
}

export interface Location {
  id: string // slug estable: 'a-coruna', 'lisboa', 'andorra-la-vella'
  name: string
  country: 'ES' | 'PT' | 'AD'
  latitude: number
  longitude: number
  timezone: string // IANA — Canarias no comparte huso con la España peninsular
  primarySource: SourceId
  sourceIds: { aemet?: string; ipma?: number }
  coastal: boolean
  marineCoordinates?: { latitude: number; longitude: number } // solo si coastal
  alertZoneIds?: Partial<Record<'aemet' | 'ipma', string[]>>
}

// Se llama LocationForecast, no CityForecast: varios de los 74 lugares son
// regiones enteras (Cantabria, La Rioja, País Vasco), no ciudades.
export interface LocationForecast {
  locationId: string // referencia a Location.id
  date: string

  temperature: Temperature // obligatorio, las 3 fuentes lo dan siempre
  sky: SkyCondition | null
  precipitation: Precipitation | null
  snow: Snow | null
  wind: Wind | null
  storm: boolean | null
  calima: boolean | null
  fog: boolean | null

  marine: MarineAvailability
  alerts: AlertsAvailability

  provenance: Provenance
  degradations?: Degradation[] // solo métricas con complemento intentado y fallido hoy
  primarySourceDescription: string | null // texto literal SOLO de la fuente principal
}

// Lo que aporta un cliente de fuente (AEMET/IPMA/Open-Meteo) antes de
// combinar principal + complementarias: los ejes meteorológicos propiamente
// dichos, sin `locationId`, `marine`, `alerts`, `provenance` ni
// `degradations` — esos se construyen aparte al combinar (ver Bloque 5).
export type WeatherBlock = Pick<
  LocationForecast,
  | 'date'
  | 'temperature'
  | 'sky'
  | 'precipitation'
  | 'snow'
  | 'wind'
  | 'storm'
  | 'calima'
  | 'fog'
  | 'primarySourceDescription'
>

export interface Forecast {
  date: string // fecha de la previsión
  generatedAt: string // ISO datetime — cuándo corrió el pipeline
  locations: LocationForecast[] // puede tener menos de 74 entradas si alguna falló por completo
  meta: {
    totalLocations: number
    successfulLocations: number
    failedLocations: string[]
  }
}
