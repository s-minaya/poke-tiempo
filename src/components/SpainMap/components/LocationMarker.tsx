import { memo } from 'react'

import type { PokedexId } from '../../../domain/pokedex.ts'

import { classifyMarkerTemperature } from './marker-temperature.ts'

import { spriteSources } from '../sprite-sources.ts'

import './LocationMarker.scss'

// Unidades del `viewBox`, no CSS — mismo tamaño de icono en el mapa
// principal y en el recuadro de Canarias, para que escale siempre junto
// con la silueta (004-plan.md → "Responsive"). El Pokémon es el
// protagonista visual del mapa, no un icono discreto — 62u, coherente con
// el margen (`POINT_PADDING`) que deja `build-map.ts` en los bordes del
// recuadro de Canarias.
const SPRITE_SIZE = 62

const TEMPERATURE_FONT_SIZE = 13
// Línea de base del texto de temperatura, relativa al centro del
// marcador: superpuesta en la zona inferior del sprite (radio SPRITE_SIZE/2),
// con un pequeño margen respecto a su borde inferior.
const TEMPERATURE_BASELINE_Y = SPRITE_SIZE / 2 - 9

interface LocationMarkerProps {
  x: number
  y: number
  name: string
  pokemonId: PokedexId | null
  /**
   * Opcionales para que el componente siga siendo válido en tests/casos de
   * robustez sin forecast — en producción los 74 lugares siempre lo traen
   * (`002-plan.md`, tolerancia cero).
   */
  minC?: number | null
  maxC?: number | null
}

function formatDegrees(roundedCelsius: number): string {
  return `${roundedCelsius}°`
}

function accessibleName(name: string, roundedMinC: number | null, roundedMaxC: number | null): string {
  if (roundedMinC === null || roundedMaxC === null) return name
  return `${name}, mínima ${roundedMinC} grados, máxima ${roundedMaxC} grados`
}

/**
 * Un lugar del mapa: nombre accesible siempre presente (también sirve de
 * tooltip nativo al pasar el ratón), como mucho un sprite — el que decidió
 * `pickMapPokemon` — y, cuando hay forecast, su mínima y máxima
 * superpuestas en la zona inferior del sprite (mínima primero). Cada
 * cifra se colorea de forma independiente según su propia franja
 * (`marker-temperature.ts`) — la máxima nunca decide el color de la
 * mínima. Un lugar sin forecast no pinta ningún sprite ni temperatura,
 * pero conserva su `<title>`.
 */
function LocationMarker({ x, y, name, pokemonId, minC, maxC }: LocationMarkerProps) {
  const roundedMinC = minC != null ? Math.round(minC) : null
  const roundedMaxC = maxC != null ? Math.round(maxC) : null
  const hasTemperature = roundedMinC !== null && roundedMaxC !== null

  return (
    <g className="location-marker" transform={`translate(${x}, ${y})`} role="img" aria-label={accessibleName(name, roundedMinC, roundedMaxC)}>
      {/* El `aria-label` es lo que expone el nombre (y la temperatura) de
          forma fiable a tecnología de asistencia; el `<title>` de aquí
          abajo es además el tooltip nativo del navegador al pasar el
          ratón. */}
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
      {hasTemperature && (
        <text className="location-marker__temperature" y={TEMPERATURE_BASELINE_Y} textAnchor="middle" fontSize={TEMPERATURE_FONT_SIZE}>
          <tspan className={`location-marker__temp-value location-marker__temp-value--${classifyMarkerTemperature(roundedMinC)}`}>
            {formatDegrees(roundedMinC)}
          </tspan>{' '}
          <tspan className={`location-marker__temp-value location-marker__temp-value--${classifyMarkerTemperature(roundedMaxC)}`}>
            {formatDegrees(roundedMaxC)}
          </tspan>
        </text>
      )}
    </g>
  )
}

export default memo(LocationMarker)
