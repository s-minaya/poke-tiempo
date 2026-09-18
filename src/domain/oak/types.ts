import type { PokedexId } from '../pokedex.ts'
import type { AlertLevel, AlertPhenomenon } from '../types.ts'

/**
 * Los hechos que el Profesor Oak puede narrar (`007-plan.md`). Cada hecho es
 * autocontenido y verificable: lleva exactamente lo necesario para redactar
 * esa frase y nada más, con los valores copiados tal cual del
 * `LocationForecast` — sin redondeos ni reinterpretación. La IA solo recibe
 * hechos de este tipo, nunca el `forecast.json`, así que no puede afirmar
 * nada que no esté aquí.
 */

/** Un lugar del mapa, solo identidad: no todo hecho de un lugar tiene Pokémon. */
export interface FactLocation {
  locationId: string
  locationName: string
}

/**
 * Un lugar con el Pokémon que de verdad se dibuja en él (`assignPokemon` →
 * `pickMapPokemon`, el mismo cruce que hace el mapa): Oak narra lo que el
 * usuario puede ver, así que un candidato descartado por `pickMapPokemon`
 * nunca llega hasta aquí.
 */
export interface MapFactLocation extends FactLocation {
  mapPokemonId: PokedexId
}

/**
 * Hecho de un lugar cuyo eje meteorológico tiene Pokémon asociado en la 003.
 *
 * `mapRepresentsFact` responde a "¿el Pokémon que se ve en este lugar es uno
 * de los que asigna este eje?" — una comprobación de **coincidencia**, no de
 * procedencia: `pickMapPokemon` devuelve un `PokedexId` y no conserva de qué
 * eje salió, así que afirmar cuál "ganó" sería inventar información. Sirve
 * para que el reparto de diálogos (`plan-dialogues.ts`) prefiera hechos
 * coherentes con el sprite visible, y se calcula una única vez aquí.
 */
export interface RepresentableFact extends MapFactLocation {
  mapRepresentsFact: boolean
}

/** Por qué esta temperatura es noticia: el resultado de ordenar los valores reales del día. */
export type TemperatureRole = 'hottest' | 'coldest_day' | 'coldest_night'

export interface TemperatureFact extends RepresentableFact {
  kind: 'temperature'
  role: TemperatureRole
  maxC: number
  minC: number
}

export interface RainFact extends RepresentableFact {
  kind: 'rain'
  mm: number // > 0 siempre: sin acumulado real no hay hecho
  probabilityPercent: number | null
}

export interface SnowFact extends RepresentableFact {
  kind: 'snow'
  cm: number // > 0 siempre
}

export interface WindFact extends RepresentableFact {
  kind: 'wind'
  speedKmh: number
  gustKmh: number | null
  // El eje del viento puede aportar dos Pokémon a la vez (el de intensidad y
  // Moltres): `warm` dice si además se cumple el umbral de viento cálido.
  warm: boolean
}

export interface StormFact extends RepresentableFact {
  kind: 'storm'
}

export interface FogFact extends RepresentableFact {
  kind: 'fog'
}

export interface CalimaFact extends RepresentableFact {
  kind: 'calima'
  /**
   * `true` cuando hay un aviso oficial de calima activo ese día que respalda
   * el hecho — tenga o no el dato físico también. `false` significa que la
   * única señal es el dato físico (`calima === true`). Es lo que Oak
   * necesita saber para poder citar el aviso; no hay tercera categoría.
   */
  fromAlert: boolean
}

export interface MarineFact extends RepresentableFact {
  kind: 'marine'
  waveHeightM: number
  wavePeriodS: number | null
}

/**
 * Un aviso oficial activo el día del forecast. Es **un** aviso, emitido para
 * una zona oficial, no para un lugar nuestro: por eso no lleva
 * `mapPokemonId` ni `mapRepresentsFact` — un aviso no es un eje
 * meteorológico y no dibuja Pokémon. `affectedLocations` dice qué puntos de
 * nuestro mapa caen bajo esa zona, que pueden ser varios.
 */
export interface AlertFact {
  kind: 'alert'
  level: AlertLevel
  phenomenon: AlertPhenomenon
  sourcePhenomenon: string // literal de la fuente — trazabilidad
  officialZoneId: string
  source: 'aemet' | 'ipma'
  affectedLocations: FactLocation[]
  affectedLocationCount: number
}

/**
 * Un Pokémon visible hoy y dónde se le ve. Siempre Pokémon visibles: cada
 * lugar de `locations` tiene exactamente este `mapPokemonId`. `locations` se
 * acota a tres para que el hecho siga siendo redactable de un vistazo;
 * `locationCount` conserva el total real.
 */
export interface PokemonSpotlightFact {
  kind: 'pokemon_spotlight'
  pokemonId: PokedexId
  label: string // POKEMON_LABELS[pokemonId]
  locations: MapFactLocation[]
  locationCount: number
}

/**
 * Forma agregada del día: recuentos reales sobre los lugares con previsión.
 * Deliberadamente **no** dice qué Pokémon domina — ese hecho vive en
 * `PokemonSpotlightFact.locationCount` y no se duplica aquí.
 */
export interface DayShapeFact {
  kind: 'day_shape'
  totalLocations: number
  rainingLocations: number
  alertedLocations: number
  distinctPokemonCount: number
}

export type Weekday = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'

/** Único hecho no meteorológico y el único sin lugar. Se deriva de `forecast.date`, sin dataset. */
export interface CalendarFact {
  kind: 'calendar'
  date: string
  weekday: Weekday
  weekend: boolean
}

export type NarrativeFact =
  | TemperatureFact
  | RainFact
  | SnowFact
  | WindFact
  | StormFact
  | FogFact
  | CalimaFact
  | MarineFact
  | AlertFact
  | PokemonSpotlightFact
  | DayShapeFact
  | CalendarFact
