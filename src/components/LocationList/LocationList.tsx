import { memo, useCallback, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import type { LocationGroup, LocationOrder } from './location-groups.ts'
import type { LocationSummary } from '../LocationCard/location-summary.ts'
import type { LocationFilters as Filters, ZoneFilter } from '../WeatherApp/location-filters.ts'
import type { PokedexId } from '../../domain/pokedex.ts'
import type { Forecast } from '../../domain/types.ts'

import { buildLocationViews } from '../../domain/location-views.ts'
import { summarizeView } from '../LocationCard/location-summary.ts'
import { useRevealWhenSelected } from '../LocationCard/use-reveal-when-selected.ts'
import { NO_FILTERS } from '../WeatherApp/location-filters.ts'
import { groupLocations } from './location-groups.ts'

import ActiveFilters from './components/ActiveFilters.tsx'
import EmptyResults from './components/EmptyResults.tsx'
import LocationFilters from './components/LocationFilters.tsx'

import { spriteSources } from '../SpainMap/sprite-sources.ts'

import { locations } from '../../data/locations.ts'

import './LocationList.scss'

interface LocationListProps {
  forecast: Forecast
  /** Los filtros de `WeatherApp`, los mismos que atenúan el mapa. */
  filters?: Filters
  /** El mismo estado que el mapa (`WeatherApp`): una sola selección, dos vías. */
  selectedLocationId?: string | null
  /**
   * Los lugares que cumplen los filtros, o `null` sin filtros: la lista
   * muestra solo los que coinciden, los mismos que el mapa deja operables.
   */
  matchingIds?: ReadonlySet<string> | null
  /** Activar una fila: la selecciona, o cierra la tarjeta si ya lo estaba. */
  onToggleLocation?: (id: string) => void
  onClearLocation?: () => void
  onQueryChange?: (query: string) => void
  onZoneChange?: (zone: ZoneFilter) => void
  onToggleCondition?: (id: PokedexId) => void
  onClearFilters?: () => void
}

/** La cifra por la que se ordena, que la fila destaca. */
type Emphasis = 'min' | 'max' | null

interface LocationRowProps {
  summary: LocationSummary
  selected: boolean
  emphasis: Emphasis
  onToggle?: (id: string) => void
  onDismiss?: () => void
}

const ZONE_BY_ID = new Map(locations.map((location) => [location.id, location.zone]))

/**
 * Una fila: un `<button>` de verdad, así que Intro y Espacio los pone el
 * navegador. Memoizada, con props estables (`summary` sale de un `useMemo`,
 * los manejadores de `useCallback` en `WeatherApp`): al cambiar la selección
 * solo se vuelven a pintar las dos filas cuyo `selected` cambia.
 */
const LocationRow = memo(function LocationRow({ summary, selected, emphasis, onToggle, onDismiss }: LocationRowProps) {
  const button = useRef<HTMLButtonElement | null>(null)
  const markActivated = useRevealWhenSelected(button, selected)

  function activate() {
    markActivated()
    onToggle?.(summary.id)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    // Como en el marcador: cierra la tarjeta sin mover el foco de aquí.
    if (event.key === 'Escape') onDismiss?.()
  }

  const hasTemperatures = summary.minC != null && summary.maxC != null
  const condition = summary.condition ?? 'Sin previsión'
  const figure = (metric: 'min' | 'max') => `location-list__figure${emphasis === metric ? ' location-list__figure--emphasis' : ''}`

  return (
    <li className="location-list__item">
      <button ref={button} type="button" className="location-list__row" aria-pressed={selected} onClick={activate} onKeyDown={handleKeyDown}>
        {summary.pokemonId ? (
          // Decorativo: la condición va en texto al lado. En diferido: la
          // lista queda por debajo del pliegue en todas las composiciones.
          <img className="location-list__sprite" src={spriteSources[summary.pokemonId]} alt="" width={40} height={40} loading="lazy" />
        ) : (
          <span className="location-list__sprite" />
        )}
        <span className="location-list__text">
          <span className="location-list__name">{summary.name}</span>
          <span className="location-list__detail">
            {summary.administrativeArea && (
              <>
                {summary.administrativeArea}
                <span aria-hidden="true"> · </span>
              </>
            )}
            {condition}
          </span>
        </span>
        {hasTemperatures && (
          <span className="location-list__temperatures">
            <span className={figure('min')}>Mín {summary.minC}°</span> <span className={figure('max')}>Máx {summary.maxC}°</span>
          </span>
        )}
      </button>
    </li>
  )
})

/** Encabezado de un grupo: su título, la muestra de su franja y cuántos lugares tiene. */
function GroupHeading({ group }: { group: LocationGroup }) {
  const count = group.rows.length
  return (
    <h3 className="location-list__group-heading">
      {group.band && <span className={`location-list__swatch location-list__swatch--${group.band}`} aria-hidden="true" />}
      <span className="location-list__group-title">{group.title}</span>
      <span className="location-list__badge" aria-hidden="true">
        {count}
      </span>
      <span className="location-list__visually-hidden">
        , {count} {count === 1 ? 'lugar' : 'lugares'}
      </span>
    </h3>
  )
}

/**
 * Los 74 lugares, con su barra para buscar, filtrar y ordenar. Es la
 * alternativa textual completa del mapa y la segunda vía de selección: cada
 * fila hace exactamente lo mismo que su marcador —mismo estado, misma
 * tarjeta, el mismo marcador pulsado—, que es lo que permite acogerse a la
 * excepción «Equivalent» de WCAG 2.5.8 donde los marcadores no llegan a
 * 24×24 (008-spec.md). Con filtros muestra exactamente los lugares cuyo
 * marcador sigue siendo operable. No es una tabla de datos: es un control.
 *
 * El orden es suyo y no un filtro: no quita ningún lugar, no toca la
 * selección y «Limpiar filtros» lo conserva.
 */
function LocationList({
  forecast,
  filters = NO_FILTERS,
  selectedLocationId = null,
  matchingIds = null,
  onToggleLocation,
  onClearLocation,
  onQueryChange,
  onZoneChange,
  onToggleCondition,
  onClearFilters,
}: LocationListProps) {
  const headingId = useId()
  const [order, setOrder] = useState<LocationOrder>('zone')
  const summaries = useMemo(() => buildLocationViews(locations, forecast).map(summarizeView), [forecast])
  const visible = useMemo(() => (matchingIds === null ? summaries : summaries.filter((summary) => matchingIds.has(summary.id))), [summaries, matchingIds])
  const groups = useMemo(() => groupLocations(visible, order, ZONE_BY_ID), [visible, order])
  const emphasis: Emphasis = order === 'warmest' ? 'max' : order === 'coldest' ? 'min' : null

  const search = useRef<HTMLInputElement | null>(null)
  const focusSearch = useCallback(() => search.current?.focus(), [])

  return (
    <section className="location-list" aria-labelledby={headingId}>
      <div className="location-list__titlebar">
        {/* Poké Ball en trazo blanco: círculo, franja y botón. Decorativa. */}
        <svg className="location-list__ball" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12 H8.8 M15.2 12 H21" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
        <h2 id={headingId} className="location-list__heading">
          Todos los lugares
        </h2>
      </div>
      <div className="location-list__controls">
        <LocationFilters
          query={filters.query}
          zone={filters.zone}
          order={order}
          searchRef={search}
          onQueryChange={onQueryChange}
          onZoneChange={onZoneChange}
          onOrderChange={setOrder}
        />
        <ActiveFilters
          filters={filters}
          total={summaries.length}
          matchCount={matchingIds === null ? null : visible.length}
          onQueryChange={onQueryChange}
          onZoneChange={onZoneChange}
          onToggleCondition={onToggleCondition}
          onClearFilters={onClearFilters}
          focusSearch={focusSearch}
        />
      </div>
      {visible.length === 0 && <EmptyResults onClearFilters={onClearFilters} focusSearch={focusSearch} />}
      {groups.map((group) => (
        <div key={group.key} className="location-list__group">
          {group.title && <GroupHeading group={group} />}
          <ul className="location-list__items">
            {group.rows.map((summary) => (
              <LocationRow
                key={summary.id}
                summary={summary}
                selected={summary.id === selectedLocationId}
                emphasis={emphasis}
                onToggle={onToggleLocation}
                onDismiss={onClearLocation}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default LocationList
