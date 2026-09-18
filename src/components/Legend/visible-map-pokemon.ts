import type { PokedexId } from '../../domain/pokedex.ts'
import type { Forecast } from '../../domain/types.ts'
import { buildLocationViews } from '../../domain/location-views.ts'
import { MAP_PRIORITY } from '../../domain/map-priority.ts'

import { locations } from '../../data/locations.ts'

/**
 * Los `PokedexId` que de verdad aparecen hoy en el mapa — el mismo
 * `pokemonId` que pinta cada `LocationMarker` (`buildLocationViews`,
 * reutilizado tal cual, sin repetir el cruce `assignPokemon` →
 * `pickMapPokemon`), deduplicados y en el mismo orden que `MAP_PRIORITY`.
 * Nunca los 25 `PokedexId` fijos: la leyenda solo lista lo que se ve hoy.
 */
export function getVisibleMapPokemonIds(forecast: Forecast): PokedexId[] {
  const views = buildLocationViews(locations, forecast)
  const present = new Set(views.map((view) => view.pokemonId).filter((id): id is PokedexId => id !== null))
  return MAP_PRIORITY.filter((id) => present.has(id))
}
