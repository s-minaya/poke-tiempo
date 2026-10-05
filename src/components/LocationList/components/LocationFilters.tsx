import { memo, useId } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

import type { LocationOrder } from '../location-groups.ts'
import type { ZoneFilter } from '../../WeatherApp/location-filters.ts'

import { LOCATION_ZONES } from '../../../domain/location-zones.ts'
import { LOCATION_SEARCH_ID } from './location-search-id.ts'

import './LocationFilters.scss'

interface LocationFiltersProps {
  query: string
  zone: ZoneFilter
  order: LocationOrder
  searchRef: RefObject<HTMLInputElement | null>
  onQueryChange?: (query: string) => void
  onZoneChange?: (zone: ZoneFilter) => void
  onOrderChange: (order: LocationOrder) => void
}

const ORDERS: { value: LocationOrder; label: string }[] = [
  { value: 'zone', label: 'Zona' },
  { value: 'name', label: 'A–Z' },
  { value: 'warmest', label: 'Más calor' },
  { value: 'coldest', label: 'Más frío' },
]

// España va en su propio grupo del selector, encabezado por «Toda España»;
// Portugal y Andorra, fuera.
const SPANISH_ZONES = LOCATION_ZONES.filter((zone) => zone !== 'Portugal' && zone !== 'Andorra')

interface OrderOptionProps {
  value: LocationOrder
  label: string
  checked: boolean
  name: string
  onSelect: (order: LocationOrder) => void
}

/** Una opción de orden, memoizada: escribir en el buscador no la vuelve a pintar. */
const OrderOption = memo(function OrderOption({ value, label, checked, name, onSelect }: OrderOptionProps) {
  return (
    <label className="location-filters__segment">
      <input className="location-filters__radio" type="radio" name={name} value={value} checked={checked} onChange={() => onSelect(value)} />
      <span className="location-filters__segment-face">
        {/* La señal que no es color del orden elegido (WCAG 1.4.1). */}
        {checked && (
          <svg className="location-filters__cursor" viewBox="0 0 9 11" aria-hidden="true" focusable="false">
            <path d="M0 0 L9 5.5 L0 11 Z" />
          </svg>
        )}
        {label}
      </span>
    </label>
  )
})

/**
 * Buscar, zona y ordenar: controles nativos con etiqueta visible. «Ordenar»
 * son radios, así que es una sola parada de tabulación y se cambia con las
 * flechas. Escape en el buscador lo vacía, y no toca nada más.
 */
function LocationFilters({ query, zone, order, searchRef, onQueryChange, onZoneChange, onOrderChange }: LocationFiltersProps) {
  const zoneId = useId()
  const orderName = useId()

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && query !== '') {
      // El navegador también vacía un `type="search"` con Escape; así no lo
      // hace dos veces ni sube a quien escuche Escape más arriba.
      event.preventDefault()
      event.stopPropagation()
      onQueryChange?.('')
    }
  }

  return (
    <div className="location-filters">
      <div className="location-filters__field location-filters__field--search">
        <label className="location-filters__label" htmlFor={LOCATION_SEARCH_ID}>
          Buscar
        </label>
        <div className="location-filters__control">
          <svg className="location-filters__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 L21 21" />
          </svg>
          <input
            ref={searchRef}
            id={LOCATION_SEARCH_ID}
            className="location-filters__input location-filters__input--search"
            type="search"
            autoComplete="off"
            placeholder="Lugar, provincia o Pokémon"
            value={query}
            onChange={(event) => onQueryChange?.(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
      </div>

      <div className="location-filters__field location-filters__field--zone">
        <label className="location-filters__label" htmlFor={zoneId}>
          Zona
        </label>
        <div className="location-filters__control">
          <select
            id={zoneId}
            className="location-filters__input location-filters__input--select"
            value={zone ?? ''}
            onChange={(event) => onZoneChange?.(event.target.value === '' ? null : (event.target.value as ZoneFilter))}
          >
            <option value="">Todas las zonas</option>
            <optgroup label="España">
              <option value="ES">Toda España</option>
              {SPANISH_ZONES.map((spanishZone) => (
                <option key={spanishZone} value={spanishZone}>
                  {spanishZone}
                </option>
              ))}
            </optgroup>
            <option value="Portugal">Portugal</option>
            <option value="Andorra">Andorra</option>
          </select>
          <svg className="location-filters__icon location-filters__icon--chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 9 L12 15 L18 9" />
          </svg>
        </div>
      </div>

      <fieldset className="location-filters__field location-filters__field--order">
        <legend className="location-filters__label">Ordenar</legend>
        <div className="location-filters__segments">
          {ORDERS.map(({ value, label }) => (
            <OrderOption key={value} value={value} label={label} checked={order === value} name={orderName} onSelect={onOrderChange} />
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export default LocationFilters
