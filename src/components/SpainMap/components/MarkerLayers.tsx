import { memo } from 'react'

import type { LocationView } from '../../../domain/location-views.ts'
import type { PokedexId } from '../../../domain/pokedex.ts'

import { MARKER_SILHOUETTE_FILTER_ID } from './marker-silhouette.ts'
import { SPRITE_SIZE } from './marker-size.ts'

import LocationMarker from './LocationMarker.tsx'

import { spriteSources } from '../sprite-sources.ts'

import './MarkerLayers.scss'

interface MarkerLayersProps {
  locations: LocationView[]
  /** El lugar que muestra ahora la tarjeta (`SpainMap.tsx`). */
  selectedLocationId?: string | null
  /** Los lugares que cumplen los filtros, o `null` sin filtros (`SpainMap.tsx`). */
  matchingIds?: ReadonlySet<string> | null
  onActivateLocation?: (id: string) => void
  onDismissLocation?: () => void
  registerMarker?: (id: string, element: SVGGElement | null) => void
}

interface MarkerSpriteProps {
  x: number
  y: number
  pokemonId: PokedexId
  dimmed: boolean
}

/**
 * El Pokémon de un lugar, centrado en su punto y del lado del sprite
 * (`SPRITE_SIZE`). En sombra, su silueta: el filtro SVG que el mapa define
 * una vez (`marker-silhouette.ts`), en la misma posición y al mismo tamaño.
 */
const MarkerSprite = memo(function MarkerSprite({ x, y, pokemonId, dimmed }: MarkerSpriteProps) {
  return (
    <image
      className="marker-layers__sprite"
      href={spriteSources[pokemonId]}
      transform={`translate(${x}, ${y})`}
      x={-SPRITE_SIZE / 2}
      y={-SPRITE_SIZE / 2}
      width={SPRITE_SIZE}
      height={SPRITE_SIZE}
      filter={dimmed ? `url(#${MARKER_SILHOUETTE_FILTER_ID})` : undefined}
    />
  )
})

/**
 * Los lugares de un `<svg>` del mapa —el principal o el recuadro de
 * Canarias— en dos capas: primero todos los sprites, después todos los
 * marcadores. En SVG manda el orden del documento, y así ningún sprite se
 * pinta encima de las cifras ni del aro de foco de un vecino, sea cual sea el
 * Pokémon del día. Los sprites se pisan entre sí en el mismo orden que los
 * lugares.
 *
 * La capa de sprites es decoración: fuera del árbol accesible, sin nada
 * enfocable y sin recibir el puntero. A cada lugar lo nombra y lo hace
 * operable su `LocationMarker`.
 *
 * Si un lugar está en sombra (hay filtros y no los cumple) se decide aquí,
 * una vez, para las dos capas. En sombra no monta marcador: ni botón, ni
 * nombre, ni cifras, ni nada que enfocar o pulsar. Solo queda su silueta, y
 * su fila tampoco está en la lista, así que cada marcador operable sigue
 * teniendo una fila equivalente (009-spec.md).
 */
function MarkerLayers({ locations, selectedLocationId = null, matchingIds = null, onActivateLocation, onDismissLocation, registerMarker }: MarkerLayersProps) {
  const places = locations.map((location) => ({ location, dimmed: matchingIds !== null && !matchingIds.has(location.id) }))

  return (
    <>
      <g className="marker-layers__sprites" aria-hidden="true">
        {places.map(
          ({ location, dimmed }) =>
            location.pokemonId && <MarkerSprite key={location.id} x={location.x} y={location.y} pokemonId={location.pokemonId} dimmed={dimmed} />,
        )}
      </g>
      {places.map(
        ({ location, dimmed }) =>
          !dimmed && (
            <LocationMarker
              key={location.id}
              id={location.id}
              x={location.x}
              y={location.y}
              name={location.name}
              minC={location.minC}
              maxC={location.maxC}
              selected={location.id === selectedLocationId}
              onActivate={onActivateLocation}
              onDismiss={onDismissLocation}
              register={registerMarker}
            />
          ),
      )}
    </>
  )
}

export default MarkerLayers
