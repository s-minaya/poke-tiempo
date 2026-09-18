import type { PokedexId } from './pokedex.ts'
import type { Forecast, Location } from './types.ts'
import { assignPokemon } from './assign-pokemon.ts'
import { mapPoints } from '../data/map-geometry.ts'
import { pickMapPokemon } from './map-priority.ts'

/** Un lugar ya listo para dibujarse en el mapa: posición + Pokémon visible. */
export interface LocationView {
  id: string
  name: string
  x: number
  y: number
  region: 'main' | 'canary'
  pokemonId: PokedexId | null
  minC: number | null
  maxC: number | null
}

/**
 * Cruza los 74 `Location` con el `forecast` del día: `assignPokemon` (003)
 * decide qué Pokémon le corresponden a cada lugar y `pickMapPokemon` (004)
 * elige cuál de esos se dibuja; `minC`/`maxC` viajan tal cual de
 * `temperature` para que el marcador (005) pinte su propia mínima/máxima.
 * Un lugar sin entrada en `forecast.locations` (falló en el pipeline, ver
 * `002-plan.md`) no rompe nada — se queda sin Pokémon ni temperatura, con
 * su posición intacta.
 */
export function buildLocationViews(locations: readonly Location[], forecast: Forecast): LocationView[] {
  const forecastByLocationId = new Map(forecast.locations.map((locationForecast) => [locationForecast.locationId, locationForecast]))

  return locations.map((location) => {
    const point = mapPoints[location.id]
    if (!point) {
      throw new Error(`"${location.id}" no tiene coordenadas en map-geometry.ts — ¿falta un "npm run build:map"?`)
    }

    const locationForecast = forecastByLocationId.get(location.id)
    const pokemonId = locationForecast ? pickMapPokemon(assignPokemon(locationForecast)) : null

    return {
      id: location.id,
      name: location.name,
      x: point.x,
      y: point.y,
      region: point.region,
      pokemonId,
      minC: locationForecast?.temperature.minC ?? null,
      maxC: locationForecast?.temperature.maxC ?? null,
    }
  })
}
