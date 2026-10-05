import type { LocationSummary } from '../LocationCard/location-summary.ts'
import type { LocationZone } from '../../domain/location-zones.ts'
import type { PokedexId } from '../../domain/pokedex.ts'
import type { Location } from '../../domain/types.ts'

/**
 * Filtro de zona: una de las 21 zonas, `'ES'` para «Toda España» —un filtro
 * por país, no una zona: separa los 65 lugares de AEMET de Portugal y
 * Andorra sin inventar una zona que no existe en los datos— o `null`, sin
 * filtro.
 */
export type ZoneFilter = 'ES' | LocationZone | null

export interface LocationFilters {
  query: string
  zone: ZoneFilter
  /** Condiciones pulsadas en la leyenda: basta con una. */
  conditions: readonly PokedexId[]
}

export const NO_FILTERS: LocationFilters = { query: '', zone: null, conditions: [] }

/** Lo que se sabe de un lugar para filtrarlo, con su texto ya normalizado. */
export interface SearchEntry {
  id: string
  country: Location['country']
  zone: LocationZone
  pokemonId: PokedexId | null
  /** Nombre, área administrativa, zona, Pokémon y condición, normalizados. */
  text: string
}

/**
 * Texto comparable: sin diacríticos —la eñe incluida: «Coruña» y «coruna» son
 * lo mismo—, en minúsculas y con cualquier signo convertido en espacio, para
 * que «vila-real» encuentre «Vila Real» y «castilla la mancha», «Castilla-La
 * Mancha».
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Las palabras de una búsqueda; ninguna si solo trae espacios o signos. */
export function searchWords(query: string): string[] {
  const normalized = normalizeForSearch(query)
  return normalized ? normalized.split(' ') : []
}

/**
 * El índice de búsqueda de un día: una entrada por lugar. El área
 * administrativa sale del propio lugar y no del resumen, que la omite cuando
 * coincide con el nombre.
 */
export function buildSearchIndex(locations: readonly Location[], summaries: readonly LocationSummary[]): SearchEntry[] {
  const summaryById = new Map(summaries.map((summary) => [summary.id, summary]))
  return locations.map((location) => {
    const summary = summaryById.get(location.id)
    const fields = [location.name, location.administrativeArea, location.zone, summary?.pokemonName, summary?.condition]
    return {
      id: location.id,
      country: location.country,
      zone: location.zone,
      pokemonId: summary?.pokemonId ?? null,
      text: fields
        .filter((field): field is string => Boolean(field))
        .map(normalizeForSearch)
        .join(' '),
    }
  })
}

export function hasActiveFilters(filters: LocationFilters): boolean {
  return searchWords(filters.query).length > 0 || filters.zone !== null || filters.conditions.length > 0
}

/**
 * Los lugares que cumplen a la vez los tres filtros. `null` significa que no
 * hay ningún filtro activo —se muestra todo y el mapa no se atenúa—, y es
 * distinto de un conjunto vacío: hay filtros y ningún lugar los cumple.
 *
 * En la búsqueda deben aparecer todas las palabras, cada una en cualquier
 * campo del lugar; en las condiciones basta con una de las pulsadas.
 */
export function matchingLocationIds(index: readonly SearchEntry[], filters: LocationFilters): ReadonlySet<string> | null {
  if (!hasActiveFilters(filters)) return null

  const words = searchWords(filters.query)
  const matches = new Set<string>()
  for (const entry of index) {
    if (!matchesZone(entry, filters.zone)) continue
    if (filters.conditions.length > 0 && (entry.pokemonId === null || !filters.conditions.includes(entry.pokemonId))) continue
    if (!words.every((word) => entry.text.includes(word))) continue
    matches.add(entry.id)
  }
  return matches
}

function matchesZone(entry: SearchEntry, zone: ZoneFilter): boolean {
  if (zone === null) return true
  if (zone === 'ES') return entry.country === 'ES'
  return entry.zone === zone
}

/**
 * Lo que la exploración recuerda: los filtros y el lugar seleccionado. Van
 * juntos en un solo estado para que un cambio de filtros y el cierre de la
 * tarjeta que provoca ocurran en la misma actualización, sin un render
 * intermedio con la tarjeta de un lugar ya en sombra.
 */
export interface ExplorationState {
  filters: LocationFilters
  selectedLocationId: string | null
}

export const INITIAL_EXPLORATION: ExplorationState = { filters: NO_FILTERS, selectedLocationId: null }

/**
 * Aplica unos filtros nuevos. Si el lugar seleccionado deja de cumplirlos,
 * la selección se anula: su marcador pasa a sombra y su fila sale de la
 * lista, así que su tarjeta no puede seguir abierta (009-spec.md).
 */
export function applyFilters(state: ExplorationState, filters: LocationFilters, index: readonly SearchEntry[]): ExplorationState {
  const matching = matchingLocationIds(index, filters)
  const stillSelected = state.selectedLocationId !== null && (matching === null || matching.has(state.selectedLocationId))
  return { filters, selectedLocationId: stillSelected ? state.selectedLocationId : null }
}
