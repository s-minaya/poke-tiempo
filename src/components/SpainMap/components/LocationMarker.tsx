import { memo } from 'react'

import type { PokedexId } from '../../../domain/pokedex.ts'

import { spriteSources } from '../sprite-sources.ts'

import './LocationMarker.scss'

// Unidades del `viewBox`, no CSS — mismo tamaño de icono en el mapa
// principal y en el recuadro de Canarias, para que escale siempre junto
// con la silueta (004-plan.md → "Responsive"). El Pokémon es el
// protagonista visual del mapa, no un icono discreto — 62u, coherente con
// el margen (`POINT_PADDING`) que deja `build-map.ts` en los bordes del
// recuadro de Canarias.
const SPRITE_SIZE = 62

interface LocationMarkerProps {
  x: number
  y: number
  name: string
  pokemonId: PokedexId | null
}

/**
 * Un lugar del mapa: nombre accesible siempre presente (también sirve de
 * tooltip nativo al pasar el ratón), y como mucho un sprite — el que
 * decidió `pickMapPokemon`. Un lugar sin forecast no pinta ningún sprite,
 * pero conserva su `<title>`.
 */
function LocationMarker({ x, y, name, pokemonId }: LocationMarkerProps) {
  return (
    <g className="location-marker" transform={`translate(${x}, ${y})`} role="img" aria-label={name}>
      {/* El `aria-label` es lo que expone el nombre de forma fiable a
          tecnología de asistencia; el `<title>` de aquí abajo es además el
          tooltip nativo del navegador al pasar el ratón. */}
      <title>{name}</title>
      {pokemonId && (
        <image
          className="location-marker__sprite"
          href={spriteSources[pokemonId]}
          x={-SPRITE_SIZE / 2}
          y={-SPRITE_SIZE / 2}
          width={SPRITE_SIZE}
          height={SPRITE_SIZE}
        />
      )}
    </g>
  )
}

export default memo(LocationMarker)
