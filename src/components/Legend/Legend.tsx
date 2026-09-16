import { useMemo } from 'react'

import type { Forecast } from '../../domain/types.ts'

import { resolveThermalMood } from '../Header/thermal-mood.ts'
import { getVisibleMapPokemonIds } from './visible-map-pokemon.ts'

import { LEGEND_METADATA } from './legend-metadata.ts'

import { spriteSources } from '../SpainMap/sprite-sources.ts'

import './Legend.scss'

interface LegendProps {
  forecast: Forecast
}

/**
 * Solo los Pokémon que de verdad aparecen hoy en el mapa
 * (`getVisibleMapPokemonIds`, cruce `assignPokemon` → `pickMapPokemon`
 * reutilizado tal cual) — nunca los 25 fijos, sin duplicados, en el mismo
 * orden que `MAP_PRIORITY`. HTML, no SVG: es una lista de contenido, no
 * parte del dibujo del mapa. Fondo y color de texto comparten el mismo
 * mar y el mismo mood térmico que la cabecera (`thermal-mood.ts`). El
 * nombre accesible de la sección viene del propio encabezado visible
 * ("Leyenda", `aria-labelledby`), no de un `aria-label` redundante.
 */
function Legend({ forecast }: LegendProps) {
  const visibleIds = useMemo(() => getVisibleMapPokemonIds(forecast), [forecast])
  const mood = useMemo(() => resolveThermalMood(forecast.locations.map((location) => location.temperature.maxC)), [forecast])

  return (
    <section className={`legend legend--${mood}`} aria-labelledby="legend-heading">
      <h2 id="legend-heading" className="legend__heading">
        Leyenda
      </h2>
      <ul className="legend__list">
        {visibleIds.map((id) => (
          <li key={id} className="legend__item">
            <img className="legend__sprite" src={spriteSources[id]} alt="" width={60} height={60} />
            <span className="legend__label">{LEGEND_METADATA[id]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default Legend
