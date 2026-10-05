import { memo, useMemo } from 'react'

import type { PokedexId } from '../../domain/pokedex.ts'
import type { Forecast } from '../../domain/types.ts'

import { resolveThermalMood } from '../Header/thermal-mood.ts'
import { getVisibleMapPokemonIds } from './visible-map-pokemon.ts'
import { POKEMON_LABELS } from '../../domain/pokemon-labels.ts'

import { spriteSources } from '../SpainMap/sprite-sources.ts'

import './Legend.scss'

interface LegendProps {
  forecast: Forecast
  /** Las condiciones pulsadas: el filtro de condición de `WeatherApp`. */
  selectedConditions?: readonly PokedexId[]
  /** Pulsar o soltar una entrada. */
  onToggleCondition?: (id: PokedexId) => void
}

interface LegendEntryProps {
  id: PokedexId
  pressed: boolean
  /** Hay otra entrada pulsada y esta no: su sprite pasa a silueta. */
  dimmed: boolean
  onToggle?: (id: PokedexId) => void
}

/**
 * El ✓ de una entrada pulsada: 8 × 5 celdas cuadradas, en el color del texto
 * del botón y sin fondo. Decorativo: el estado lo dice `aria-pressed`.
 */
function PixelCheck() {
  return (
    <svg className="legend__check" viewBox="0 0 8 5" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path d="M6 0h2v1H6zM5 1h2v1H5zM0 2h2v1H0zM4 2h2v1H4zM1 3h4v1H1zM2 4h2v1H2z" />
    </svg>
  )
}

/**
 * Una entrada: un `<button>` con `aria-pressed`, cuyo nombre accesible es su
 * etiqueta (el sprite es decorativo). Memoizada, con un callback estable que
 * recibe el id: pulsar una entrada solo vuelve a pintar las que cambian.
 */
const LegendEntry = memo(function LegendEntry({ id, pressed, dimmed, onToggle }: LegendEntryProps) {
  return (
    <li>
      <button type="button" className="legend__entry" aria-pressed={pressed} onClick={() => onToggle?.(id)}>
        <img className={`legend__sprite${dimmed ? ' legend__sprite--dimmed' : ''}`} src={spriteSources[id]} alt="" width={60} height={60} />
        <span className="legend__label">{POKEMON_LABELS[id]}</span>
        {/* La columna de estado existe también sin pulsar, vacía: pulsar o
            soltar no mueve ni ensancha nada. */}
        <span className="legend__state">{pressed && <PixelCheck />}</span>
      </button>
    </li>
  )
})

/**
 * Solo los Pokémon que de verdad aparecen hoy en el mapa
 * (`getVisibleMapPokemonIds`, cruce `assignPokemon` → `pickMapPokemon`
 * reutilizado tal cual) — nunca los 25 fijos, sin duplicados, en el mismo
 * orden que `MAP_PRIORITY`. HTML, no SVG: es una lista de contenido, no
 * parte del dibujo del mapa. Fondo y color de texto comparten el mismo
 * mar y el mismo mood térmico que la cabecera (`thermal-mood.ts`). El
 * nombre accesible de la sección viene del propio encabezado visible
 * ("Leyenda", `aria-labelledby`), no de un `aria-label` redundante.
 *
 * Cada entrada es además el filtro de su condición (009): varias pulsadas
 * suman, y el mapa y la lista muestran los lugares de cualquiera de ellas.
 */
function Legend({ forecast, selectedConditions = [], onToggleCondition }: LegendProps) {
  const visibleIds = useMemo(() => getVisibleMapPokemonIds(forecast), [forecast])
  const mood = useMemo(() => resolveThermalMood(forecast.locations.map((location) => location.temperature.maxC)), [forecast])
  const anyPressed = selectedConditions.length > 0

  return (
    <section className={`legend legend--${mood}`} aria-labelledby="legend-heading">
      <h2 id="legend-heading" className="legend__heading">
        Leyenda
      </h2>
      <p className="legend__hint">Pulsa un Pokémon para verlo en el mapa</p>
      <ul className="legend__list">
        {visibleIds.map((id) => {
          const pressed = selectedConditions.includes(id)
          return <LegendEntry key={id} id={id} pressed={pressed} dimmed={anyPressed && !pressed} onToggle={onToggleCondition} />
        })}
      </ul>
    </section>
  )
}

export default Legend
