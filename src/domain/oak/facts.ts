import { isActiveOnDate } from '../alerts.ts'
import {
  GYARADOS_WAVE_HEIGHT_THRESHOLD_M,
  assignByCalima,
  assignByFog,
  assignByMarine,
  assignByRain,
  assignBySnow,
  assignByStorm,
  assignByTemperature,
  assignByWarmWind,
  assignByWind,
  assignPokemon,
} from '../assign-pokemon.ts'
import { MAP_PRIORITY, pickMapPokemon } from '../map-priority.ts'
import { POKEMON_LABELS } from '../pokemon-labels.ts'
import type { PokedexId } from '../pokedex.ts'
import type { Forecast, Location, LocationForecast, OfficialAlert } from '../types.ts'
import type {
  AlertFact,
  CalendarFact,
  CalimaFact,
  DayShapeFact,
  FactLocation,
  FogFact,
  MapFactLocation,
  MarineFact,
  NarrativeFact,
  PokemonSpotlightFact,
  RainFact,
  SnowFact,
  StormFact,
  TemperatureFact,
  TemperatureRole,
  Weekday,
  WindFact,
} from './types.ts'

/**
 * Inventario de hechos narrables del día (`007-plan.md`): traduce el
 * `Forecast` ya cerrado por la 002 a `NarrativeFact[]`, sin medir ni asignar
 * nada por su cuenta. Todo `PokedexId` sale de la 003 (`assignPokemon`) y de
 * `pickMapPokemon`; todo número se copia tal cual del `LocationForecast`, sin
 * redondear — cómo se muestra un decimal es una decisión posterior de
 * redacción.
 *
 * **Un hecho existe cuando hay algo que contar.** Los ejes ocasionales
 * (lluvia, nieve, viento, tormenta, niebla, calima, oleaje) producen un hecho
 * en cada lugar donde ocurren; la temperatura, que existe siempre y en todas
 * partes, solo lo produce en sus extremos — "20 °C en un sitio cualquiera" no
 * es noticia.
 *
 * Esto es el inventario completo, no el guion: el reparto en tres diálogos
 * elige de aquí (`plan-dialogues.ts`), y es ahí donde se decide qué entra.
 */

// Cuántos lugares puede nombrar un `PokemonSpotlightFact`. El hecho tiene que
// seguir siendo redactable de un vistazo: el total real viaja en
// `locationCount`, no se pierde.
const SPOTLIGHT_LOCATION_LIMIT = 3

// `Date.UTC` solo para calendario, nunca como instante real: evita que el día
// de la semana dependa de la zona horaria del entorno de ejecución, igual que
// en `target-date.ts` y `format-forecast-headline.ts`.
const WEEKDAYS: readonly Weekday[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

/** Un lugar con previsión, ya resuelto a su Pokémon visible. */
interface LocationEntry {
  location: Location
  forecast: LocationForecast
  mapLocation: MapFactLocation
}

/** El lugar sin Pokémon: lo que necesita un aviso, que no dibuja ninguno. */
function plainLocation(entry: LocationEntry): FactLocation {
  return { locationId: entry.location.id, locationName: entry.location.name }
}

/**
 * El mismo cruce que pinta el mapa (`assignPokemon` → `pickMapPokemon`), sin
 * pasar por `location-views.ts`: Oak no necesita coordenadas ni geometría
 * para saber qué Pokémon se ve en un lugar. Un lugar sin previsión, o del que
 * `assignPokemon` no saque nada, simplemente no genera hechos.
 */
function buildEntries(locations: readonly Location[], forecast: Forecast): LocationEntry[] {
  const forecastByLocationId = new Map(forecast.locations.map((locationForecast) => [locationForecast.locationId, locationForecast]))

  const entries: LocationEntry[] = []
  for (const location of locations) {
    const locationForecast = forecastByLocationId.get(location.id)
    if (!locationForecast) continue

    const mapPokemonId = pickMapPokemon(assignPokemon(locationForecast))
    if (mapPokemonId === null) continue

    entries.push({
      location,
      forecast: locationForecast,
      mapLocation: { locationId: location.id, locationName: location.name, mapPokemonId },
    })
  }
  return entries
}

/**
 * `mapRepresentsFact`: ¿el Pokémon visible en el lugar es uno de los que
 * asigna este eje? Comprobación de coincidencia, no de procedencia — se
 * comparan los candidatos del eje con el `PokedexId` ya elegido, sin
 * pretender saber cuál de los ejes lo produjo (`pickMapPokemon` no lo
 * conserva). El candidato nunca sale de esta función: no se expone en ningún
 * hecho ni se vuelve a calcular después.
 */
function matchesMapPokemon(entry: LocationEntry, candidates: readonly (PokedexId | null)[]): boolean {
  return candidates.some((candidate) => candidate !== null && candidate === entry.mapLocation.mapPokemonId)
}

// Los empates los resuelve el orden estable de `locations` — solo se sustituye
// al mejor con una diferencia estricta, así que gana el primero que aparece.
// No hace falta ningún criterio propio.
function pickExtreme(
  entries: readonly LocationEntry[],
  value: (entry: LocationEntry) => number,
  direction: 'max' | 'min',
): LocationEntry {
  return entries.reduce((best, current) => {
    const difference = value(current) - value(best)
    return (direction === 'max' ? difference > 0 : difference < 0) ? current : best
  })
}

/**
 * Los extremos térmicos del día. Si un mismo lugar se lleva más de un papel
 * (pasa con conjuntos pequeños, no con los 74), se queda solo con el primero:
 * tres hechos del mismo sitio no son tres noticias.
 */
function temperatureFacts(entries: readonly LocationEntry[]): TemperatureFact[] {
  if (entries.length === 0) return []

  const byRole: [TemperatureRole, LocationEntry][] = [
    ['hottest', pickExtreme(entries, (entry) => entry.forecast.temperature.maxC, 'max')],
    ['coldest_day', pickExtreme(entries, (entry) => entry.forecast.temperature.maxC, 'min')],
    ['coldest_night', pickExtreme(entries, (entry) => entry.forecast.temperature.minC, 'min')],
  ]

  const claimed = new Set<string>()
  const facts: TemperatureFact[] = []
  for (const [role, entry] of byRole) {
    if (claimed.has(entry.location.id)) continue
    claimed.add(entry.location.id)

    facts.push({
      kind: 'temperature',
      ...entry.mapLocation,
      role,
      maxC: entry.forecast.temperature.maxC,
      minC: entry.forecast.temperature.minC,
      mapRepresentsFact: matchesMapPokemon(entry, [assignByTemperature(entry.forecast.temperature)]),
    })
  }
  return facts
}

function rainFacts(entries: readonly LocationEntry[]): RainFact[] {
  const facts: RainFact[] = []
  for (const entry of entries) {
    const { precipitation } = entry.forecast
    const mm = precipitation?.mm ?? null
    if (mm === null || mm <= 0) continue

    facts.push({
      kind: 'rain',
      ...entry.mapLocation,
      mm,
      probabilityPercent: precipitation?.probabilityPercent ?? null,
      mapRepresentsFact: matchesMapPokemon(entry, [assignByRain(precipitation)]),
    })
  }
  return facts
}

function snowFacts(entries: readonly LocationEntry[]): SnowFact[] {
  const facts: SnowFact[] = []
  for (const entry of entries) {
    const { snow } = entry.forecast
    const cm = snow?.cm ?? null
    if (cm === null || cm <= 0) continue

    facts.push({
      kind: 'snow',
      ...entry.mapLocation,
      cm,
      mapRepresentsFact: matchesMapPokemon(entry, [assignBySnow(snow)]),
    })
  }
  return facts
}

/**
 * Hay hecho de viento cuando la 003 asigna algo por ese eje — el umbral vive
 * allí, no se copia aquí. El eje puede aportar dos Pokémon a la vez (el de
 * intensidad y Moltres), así que los dos cuentan para `mapRepresentsFact`.
 */
function windFacts(entries: readonly LocationEntry[]): WindFact[] {
  const facts: WindFact[] = []
  for (const entry of entries) {
    const { wind, temperature } = entry.forecast
    const byIntensity = assignByWind(wind)
    if (byIntensity === null || wind?.speedKmh == null) continue

    const warmWind = assignByWarmWind(wind, temperature)
    facts.push({
      kind: 'wind',
      ...entry.mapLocation,
      speedKmh: wind.speedKmh,
      gustKmh: wind.gustKmh,
      warm: warmWind !== null,
      mapRepresentsFact: matchesMapPokemon(entry, [byIntensity, warmWind]),
    })
  }
  return facts
}

function stormFacts(entries: readonly LocationEntry[]): StormFact[] {
  const facts: StormFact[] = []
  for (const entry of entries) {
    if (entry.forecast.storm !== true) continue

    facts.push({
      kind: 'storm',
      ...entry.mapLocation,
      mapRepresentsFact: matchesMapPokemon(entry, [assignByStorm(entry.forecast.storm)]),
    })
  }
  return facts
}

function fogFacts(entries: readonly LocationEntry[]): FogFact[] {
  const facts: FogFact[] = []
  for (const entry of entries) {
    if (entry.forecast.fog !== true) continue

    facts.push({
      kind: 'fog',
      ...entry.mapLocation,
      mapRepresentsFact: matchesMapPokemon(entry, [assignByFog(entry.forecast.fog)]),
    })
  }
  return facts
}

/**
 * La calima tiene dos señales independientes en la 003 (el dato físico y el
 * aviso oficial). `fromAlert` dice si existe el aviso, lo confirme o no el
 * dato: es lo que permite a Oak citarlo.
 */
function calimaFacts(entries: readonly LocationEntry[], date: string): CalimaFact[] {
  const facts: CalimaFact[] = []
  for (const entry of entries) {
    const { calima, alerts } = entry.forecast
    if (assignByCalima(calima, alerts, date) === null) continue

    facts.push({
      kind: 'calima',
      ...entry.mapLocation,
      fromAlert: alerts.status === 'ok' && alerts.alerts.some((alert) => alert.phenomenon === 'calima' && isActiveOnDate(alert, date)),
      mapRepresentsFact: matchesMapPokemon(entry, [assignByCalima(calima, alerts, date)]),
    })
  }
  return facts
}

/**
 * Solo con dato físico de oleaje: un Mega Gyarados que salga únicamente del
 * aviso rojo costero no trae metros que contar, y ese aviso ya viaja como
 * `AlertFact`.
 */
function marineFacts(entries: readonly LocationEntry[], date: string): MarineFact[] {
  const facts: MarineFact[] = []
  for (const entry of entries) {
    const { marine, alerts } = entry.forecast
    if (marine.status !== 'ok') continue

    const { waveHeightM, wavePeriodS } = marine.data
    if (waveHeightM === null || waveHeightM < GYARADOS_WAVE_HEIGHT_THRESHOLD_M) continue

    facts.push({
      kind: 'marine',
      ...entry.mapLocation,
      waveHeightM,
      wavePeriodS,
      mapRepresentsFact: matchesMapPokemon(entry, [assignByMarine(marine, alerts, date)]),
    })
  }
  return facts
}

/**
 * Los avisos activos el día del forecast, agrupados por
 * `officialZoneId + phenomenon + level + startsAt`: varios de los 74 lugares
 * comparten zona oficial y traerían el mismo aviso repetido. El aviso sigue
 * siendo uno solo y conserva todos los puntos del mapa a los que afecta, en
 * el orden estable de `locations` — no se elige un lugar representativo.
 *
 * Aquí no se decide ningún modo narrativo: un aviso amarillo produce hecho
 * igual que uno rojo, y qué nivel activa el modo `alerta` se resuelve en
 * `day-mode.ts`.
 */
function alertFacts(entries: readonly LocationEntry[], date: string): AlertFact[] {
  const groups = new Map<string, { alert: OfficialAlert; places: FactLocation[] }>()

  for (const entry of entries) {
    const { alerts } = entry.forecast
    if (alerts.status !== 'ok') continue

    for (const alert of alerts.alerts) {
      if (!isActiveOnDate(alert, date)) continue

      const key = `${alert.officialZoneId}|${alert.phenomenon}|${alert.level}|${alert.startsAt}`
      const group = groups.get(key) ?? { alert, places: [] }
      group.places.push(plainLocation(entry))
      groups.set(key, group)
    }
  }

  return [...groups.values()].map(({ alert, places }) => ({
    kind: 'alert',
    level: alert.level,
    phenomenon: alert.phenomenon,
    sourcePhenomenon: alert.sourcePhenomenon,
    officialZoneId: alert.officialZoneId,
    source: alert.source,
    affectedLocations: places,
    affectedLocationCount: places.length,
  }))
}

/** Un hecho por Pokémon visible hoy, en el orden editorial de `MAP_PRIORITY`. */
function spotlightFacts(entries: readonly LocationEntry[]): PokemonSpotlightFact[] {
  const byPokemon = new Map<PokedexId, MapFactLocation[]>()
  for (const entry of entries) {
    const { mapPokemonId } = entry.mapLocation
    const places = byPokemon.get(mapPokemonId) ?? []
    places.push(entry.mapLocation)
    byPokemon.set(mapPokemonId, places)
  }

  return MAP_PRIORITY.filter((id) => byPokemon.has(id)).map((id) => {
    const places = byPokemon.get(id) ?? []
    return {
      kind: 'pokemon_spotlight',
      pokemonId: id,
      label: POKEMON_LABELS[id],
      locations: places.slice(0, SPOTLIGHT_LOCATION_LIMIT),
      locationCount: places.length,
    }
  })
}

/**
 * `alertedLocations` cuenta lugares con algún aviso activo, no avisos: es
 * "cuántos sitios están avisados", así que no se deduplica por zona — dos
 * lugares de la misma zona son dos sitios avisados.
 *
 * Qué Pokémon domina el día no se responde aquí: eso es el `locationCount`
 * de cada `PokemonSpotlightFact`, y duplicarlo sería tener el mismo hecho en
 * dos sitios que pueden desincronizarse.
 */
function dayShapeFacts(entries: readonly LocationEntry[], date: string): DayShapeFact[] {
  if (entries.length === 0) return []

  const visiblePokemon = new Set<PokedexId>()
  let rainingLocations = 0
  let alertedLocations = 0

  for (const entry of entries) {
    visiblePokemon.add(entry.mapLocation.mapPokemonId)

    if ((entry.forecast.precipitation?.mm ?? 0) > 0) rainingLocations += 1

    const { alerts } = entry.forecast
    if (alerts.status === 'ok' && alerts.alerts.some((alert) => isActiveOnDate(alert, date))) alertedLocations += 1
  }

  return [
    {
      kind: 'day_shape',
      totalLocations: entries.length,
      rainingLocations,
      alertedLocations,
      distinctPokemonCount: visiblePokemon.size,
    },
  ]
}

function calendarFact(date: string): CalendarFact {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return { kind: 'calendar', date, weekday, weekend: weekday === 'sabado' || weekday === 'domingo' }
}

export function collectFacts(locations: readonly Location[], forecast: Forecast): NarrativeFact[] {
  const entries = buildEntries(locations, forecast)
  const { date } = forecast

  return [
    calendarFact(date),
    ...dayShapeFacts(entries, date),
    ...spotlightFacts(entries),
    ...alertFacts(entries, date),
    ...temperatureFacts(entries),
    ...stormFacts(entries),
    ...snowFacts(entries),
    ...rainFacts(entries),
    ...windFacts(entries),
    ...marineFacts(entries, date),
    ...fogFacts(entries),
    ...calimaFacts(entries, date),
  ]
}
