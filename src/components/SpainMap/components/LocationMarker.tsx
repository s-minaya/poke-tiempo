import { memo, useCallback, useRef } from 'react'
import type { KeyboardEvent } from 'react'

import type { PokedexId } from '../../../domain/pokedex.ts'

import { useRevealWhenSelected } from '../../LocationCard/use-reveal-when-selected.ts'
import { classifyMarkerTemperature } from './marker-temperature.ts'
import { MARKER_SILHOUETTE_FILTER_ID } from './marker-silhouette.ts'
import { SPRITE_SIZE } from './marker-size.ts'

import { spriteSources } from '../sprite-sources.ts'

import './LocationMarker.scss'

const TEMPERATURE_FONT_SIZE = 13
// Línea de base del texto de temperatura, relativa al centro del
// marcador: superpuesta en la zona inferior del sprite (radio SPRITE_SIZE/2),
// con un pequeño margen respecto a su borde inferior.
const TEMPERATURE_BASELINE_Y = SPRITE_SIZE / 2 - 9

// Aro de foco, algo mayor que el sprite: lo rodea sin taparlo.
const FOCUS_RING_SIZE = SPRITE_SIZE + 12
const FOCUS_RING_RADIUS = 12

interface LocationMarkerProps {
  id: string
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
  /** Es el lugar que muestra ahora la tarjeta. */
  selected?: boolean
  /** Hay filtros y este lugar no los cumple: sombra, fuera de alcance. */
  dimmed?: boolean
  /** Clic, toque, Intro o Espacio. */
  onActivate?: (id: string) => void
  /** Escape: cerrar la tarjeta sin mover el foco de aquí. */
  onDismiss?: () => void
  /** Para que el mapa pueda devolverle el foco al cerrar la tarjeta desde ella. */
  register?: (id: string, element: SVGGElement | null) => void
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
 *
 * Es un botón: se selecciona con clic, toque, Intro o Espacio, y
 * `aria-pressed` dice si es el lugar que muestra la tarjeta. Seleccionado no
 * dibuja nada propio: lo dicen la tarjeta y la fila de la lista, y una marca
 * alrededor del sprite competiría con el dibujo (008-spec.md). Dentro de un
 * SVG no existe `<button>`, así que el rol y el `tabIndex` van a mano — la
 * única excepción de la 008 a "HTML semántico antes que ARIA". El nombre
 * accesible es único por lugar (los 74 `name` lo son): con rol y teclado
 * pero sin nombre, un lector de pantalla anunciaría 74 botones iguales
 * (WCAG 4.1.2).
 *
 * Las cifras se pintan dos veces: debajo, una copia con el contorno
 * exterior oscuro; encima, la real con el relleno y el trazo de su franja.
 * SVG no admite dos trazos en un mismo elemento y los trazos de franja se
 * conservan (008-spec.md), así que el contorno necesita una capa propia. La
 * copia de abajo es decorativa y lo declara con `aria-hidden`. El dato viaja
 * en el `aria-label`, que sigue presente cuando el mapa es demasiado
 * pequeño para pintar las cifras.
 *
 * En sombra (`dimmed`, hay filtros y el lugar no los cumple) deja de ser un
 * botón: ni rol, ni `tabIndex`, ni nombre, ni `<title>`, ni manejadores, ni
 * cifras. Solo queda la silueta de su Pokémon, en la misma posición y al
 * mismo tamaño, con `aria-hidden`: nada que se oculte al lector de pantalla
 * sigue siendo enfocable u operable. Su fila tampoco está en la lista, así
 * que cada marcador operable sigue teniendo una fila equivalente (009-spec.md).
 */
function LocationMarker({ id, x, y, name, pokemonId, minC, maxC, selected = false, dimmed = false, onActivate, onDismiss, register }: LocationMarkerProps) {
  const roundedMinC = minC != null ? Math.round(minC) : null
  const roundedMaxC = maxC != null ? Math.round(maxC) : null
  const hasTemperature = roundedMinC !== null && roundedMaxC !== null

  const element = useRef<SVGGElement | null>(null)
  // En sombra no se registra: no es un sitio al que devolver el foco.
  const setElement = useCallback(
    (node: SVGGElement | null) => {
      element.current = node
      register?.(id, dimmed ? null : node)
    },
    [id, register, dimmed],
  )

  const markActivated = useRevealWhenSelected(element, selected)

  function activate() {
    markActivated()
    onActivate?.(id)
  }

  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      // Espacio desplazaría la página, como haría un botón nativo si no.
      event.preventDefault()
      // Mantener la tecla pulsada no puede abrir y cerrar la tarjeta en bucle.
      if (!event.repeat) activate()
    } else if (event.key === 'Escape') {
      onDismiss?.()
    }
  }

  if (dimmed) {
    return (
      <g ref={setElement} className="location-marker location-marker--dimmed" transform={`translate(${x}, ${y})`} aria-hidden="true">
        {pokemonId && (
          <image
            className="location-marker__sprite"
            href={spriteSources[pokemonId]}
            x={-SPRITE_SIZE / 2}
            y={-SPRITE_SIZE / 2}
            width={SPRITE_SIZE}
            height={SPRITE_SIZE}
            filter={`url(#${MARKER_SILHOUETTE_FILTER_ID})`}
          />
        )}
      </g>
    )
  }

  return (
    <g
      ref={setElement}
      className="location-marker"
      transform={`translate(${x}, ${y})`}
      role="button"
      tabIndex={0}
      aria-label={accessibleName(name, roundedMinC, roundedMaxC)}
      aria-pressed={selected}
      onClick={activate}
      onKeyDown={handleKeyDown}
    >
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
        <text className="location-marker__temperature location-marker__temperature--contour" y={TEMPERATURE_BASELINE_Y} textAnchor="middle" fontSize={TEMPERATURE_FONT_SIZE} aria-hidden="true">
          {`${formatDegrees(roundedMinC)} ${formatDegrees(roundedMaxC)}`}
        </text>
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
      {/* Área de toque: el cuadrado entero del sprite, también donde la
          imagen es transparente o donde no hay Pokémon. */}
      <rect className="location-marker__hit" x={-SPRITE_SIZE / 2} y={-SPRITE_SIZE / 2} width={SPRITE_SIZE} height={SPRITE_SIZE} />
      {/* Aro de foco de dos tonos: la línea clara va por el centro de la
          oscura, que la enmarca por los dos lados. */}
      <g className="location-marker__focus-ring" aria-hidden="true">
        <rect className="location-marker__focus-edge" x={-FOCUS_RING_SIZE / 2} y={-FOCUS_RING_SIZE / 2} width={FOCUS_RING_SIZE} height={FOCUS_RING_SIZE} rx={FOCUS_RING_RADIUS} />
        <rect className="location-marker__focus-core" x={-FOCUS_RING_SIZE / 2} y={-FOCUS_RING_SIZE / 2} width={FOCUS_RING_SIZE} height={FOCUS_RING_SIZE} rx={FOCUS_RING_RADIUS} />
      </g>
    </g>
  )
}

export default memo(LocationMarker)
