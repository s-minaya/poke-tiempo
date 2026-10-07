import { useCallback, useMemo, useState } from 'react'

import type { ExplorationState, LocationFilters, ZoneFilter } from './location-filters.ts'
import type { ForecastFreshness } from '../../domain/forecast-freshness.ts'
import type { PokedexId } from '../../domain/pokedex.ts'
import type { Forecast } from '../../domain/types.ts'

import { buildLocationViews } from '../../domain/location-views.ts'
import { summarizeView } from '../LocationCard/location-summary.ts'
import { INITIAL_EXPLORATION, NO_FILTERS, applyFilters, buildSearchIndex, matchingLocationIds } from './location-filters.ts'
import { LOCATION_SEARCH_ID } from '../LocationList/components/location-search-id.ts'

import Credits from '../Credits/Credits.tsx'
import FreshnessNotice from '../FreshnessNotice/FreshnessNotice.tsx'
import Header from '../Header/Header.tsx'
import Legend from '../Legend/Legend.tsx'
import LocationList from '../LocationList/LocationList.tsx'
import SpainMap from '../SpainMap/SpainMap.tsx'

import { locations } from '../../data/locations.ts'

import './WeatherApp.scss'

interface WeatherAppProps {
  forecast: Forecast
  /** Cuán fresca es la previsión respecto al calendario de Madrid (`forecast-freshness.ts`). */
  freshness: ForecastFreshness
  /** Si se ofrece recargar: la página cargó al día y ahora está atrasada. */
  offerReload: boolean
  /** Montada pero fuera de alcance mientras otra escena está delante (Oak): ni foco, ni clics, ni lectores de pantalla. */
  inert?: boolean
}

function WeatherApp({ forecast, freshness, offerReload, inert = false }: WeatherAppProps) {
  // Los filtros y el lugar cuya tarjeta está abierta. Es estado de
  // interacción, no de maquetación: lo comparten la leyenda, el mapa y la
  // lista. Un solo objeto, para que un filtro que excluye el lugar
  // seleccionado cierre su tarjeta en la misma actualización
  // (`applyFilters`).
  const [exploration, setExploration] = useState<ExplorationState>(INITIAL_EXPLORATION)
  const { selectedLocationId } = exploration

  const summaries = useMemo(() => buildLocationViews(locations, forecast).map(summarizeView), [forecast])
  const searchIndex = useMemo(() => buildSearchIndex(locations, summaries), [summaries])
  // `null` sin filtros; si no, los lugares que los cumplen, que pueden ser
  // ninguno.
  const matchingIds = useMemo(() => matchingLocationIds(searchIndex, exploration.filters), [searchIndex, exploration.filters])

  // Activar el lugar que ya está abierto lo cierra, como un botón que se
  // suelta (`aria-pressed`). Estables, para no invalidar la memoización de
  // los 74 marcadores en cada selección.
  const toggleLocation = useCallback((id: string) => {
    setExploration((current) => ({ ...current, selectedLocationId: current.selectedLocationId === id ? null : id }))
  }, [])
  const clearLocation = useCallback(() => {
    setExploration((current) => ({ ...current, selectedLocationId: null }))
  }, [])

  // Todo cambio de filtros pasa por `applyFilters`, que en el mismo estado
  // nuevo anula la selección si deja de coincidir. Estables mientras no
  // cambie la previsión.
  const updateFilters = useCallback(
    (update: (filters: LocationFilters) => LocationFilters) => {
      setExploration((current) => applyFilters(current, update(current.filters), searchIndex))
    },
    [searchIndex],
  )
  const toggleCondition = useCallback(
    (id: PokedexId) => {
      updateFilters((filters) => ({
        ...filters,
        conditions: filters.conditions.includes(id) ? filters.conditions.filter((condition) => condition !== id) : [...filters.conditions, id],
      }))
    },
    [updateFilters],
  )
  const changeQuery = useCallback((query: string) => updateFilters((filters) => ({ ...filters, query })), [updateFilters])
  const changeZone = useCallback((zone: ZoneFilter) => updateFilters((filters) => ({ ...filters, zone })), [updateFilters])
  // Quita los filtros y nada más: el orden de la lista es suyo y se queda
  // como estaba, y una selección que ya se anuló no vuelve.
  const clearFilters = useCallback(() => updateFilters(() => NO_FILTERS), [updateFilters])

  return (
    // `inert` vive en el contenedor, no en `<main>`: así cubre también los
    // créditos, que son hermanos de `main` y no descendientes suyos.
    <div className="app" inert={inert}>
      {/* Primer elemento enfocable: salta la leyenda y los 74 marcadores. */}
      <a className="app__skip-link" href={`#${LOCATION_SEARCH_ID}`}>
        Saltar al buscador
      </a>
      {/* Grid con nombres de área (WeatherApp.scss): una columna en la
          composición apilada; a partir de `$breakpoint-desktop`, dos, con la
          plantilla en `.app` y adoptada aquí con `subgrid`. Cada componente
          fija su propio `grid-area` en su `.scss`. */}
      <main className="app__layout">
        <Header forecast={forecast} freshness={freshness} />
        {/* Solo con dos días de retraso o más, o con la oferta de recargar:
            en cualquier otro caso no está en el DOM. */}
        {(freshness.status === 'very-late' || offerReload) && (
          <FreshnessNotice freshness={freshness} forecastDate={forecast.date} offerReload={offerReload} />
        )}
        <Legend forecast={forecast} selectedConditions={exploration.filters.conditions} onToggleCondition={toggleCondition} />
        <SpainMap
          forecast={forecast}
          selectedLocationId={selectedLocationId}
          matchingIds={matchingIds}
          onToggleLocation={toggleLocation}
          onClearLocation={clearLocation}
        />
        <LocationList
          forecast={forecast}
          filters={exploration.filters}
          selectedLocationId={selectedLocationId}
          matchingIds={matchingIds}
          onToggleLocation={toggleLocation}
          onClearLocation={clearLocation}
          onQueryChange={changeQuery}
          onZoneChange={changeZone}
          onToggleCondition={toggleCondition}
          onClearFilters={clearFilters}
        />
      </main>
      {/* Fuera de `<main>` a propósito: un `<footer>` descendiente de `main`
          no es el landmark `contentinfo`, sino un pie genérico de esa
          sección. */}
      <Credits />
    </div>
  )
}

export default WeatherApp
