import { memo, useCallback, useEffect, useRef, useState } from 'react'

import type { LocationFilters, ZoneFilter } from '../../WeatherApp/location-filters.ts'
import type { PokedexId } from '../../../domain/pokedex.ts'

import { searchWords } from '../../WeatherApp/location-filters.ts'
import { COUNT_ANNOUNCEMENT_DELAY_MS, countText } from './count-text.ts'
import { POKEMON_LABELS } from '../../../domain/pokemon-labels.ts'

import { spriteSources } from '../../SpainMap/sprite-sources.ts'

import './ActiveFilters.scss'

interface ActiveFiltersProps {
  filters: LocationFilters
  /** Lugares en total, con o sin previsión. */
  total: number
  /** Los que cumplen los filtros; `null` si no hay ninguno activo. */
  matchCount: number | null
  onQueryChange?: (query: string) => void
  onZoneChange?: (zone: ZoneFilter) => void
  onToggleCondition?: (id: PokedexId) => void
  onClearFilters?: () => void
  /** A dónde va el foco cuando ya no queda ningún filtro que quitar. */
  focusSearch: () => void
}

type ChipKind = 'condition' | 'zone' | 'query'

interface Chip {
  kind: ChipKind
  /** Solo en las de condición. */
  pokemonId: PokedexId | null
  label: string
}

function chipsOf(filters: LocationFilters): Chip[] {
  const chips: Chip[] = filters.conditions.map((id) => ({ kind: 'condition', pokemonId: id, label: POKEMON_LABELS[id] }))
  if (filters.zone !== null) chips.push({ kind: 'zone', pokemonId: null, label: `Zona: ${filters.zone === 'ES' ? 'Toda España' : filters.zone}` })
  if (searchWords(filters.query).length > 0) chips.push({ kind: 'query', pokemonId: null, label: `“${filters.query.trim()}”` })
  return chips
}

interface FilterChipProps extends Chip {
  index: number
  onRemove: (kind: ChipKind, pokemonId: PokedexId | null, index: number) => void
}

/**
 * Un filtro activo, que se quita al pulsarlo. Su nombre accesible empieza
 * por el texto visible (WCAG 2.5.3). Memoizado, con props primitivas y un
 * callback estable: escribir en el buscador solo vuelve a pintar la pastilla
 * de la búsqueda.
 */
const FilterChip = memo(function FilterChip({ kind, pokemonId, label, index, onRemove }: FilterChipProps) {
  return (
    <li>
      <button
        type="button"
        className={`active-filters__chip${pokemonId ? ' active-filters__chip--pokemon' : ''}`}
        aria-label={`${label}, quitar filtro`}
        onClick={() => onRemove(kind, pokemonId, index)}
      >
        {pokemonId && (
          // El disco blanco: un Pokémon azul no desaparece sobre la pastilla azul.
          <span className="active-filters__disc">
            <img className="active-filters__sprite" src={spriteSources[pokemonId]} alt="" width={28} height={28} />
          </span>
        )}
        {label}
        <svg className="active-filters__remove" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6 L18 18 M18 6 L6 18" />
        </svg>
      </button>
    </li>
  )
})

/**
 * El recuento, los filtros activos y «Limpiar filtros». El recuento está
 * siempre a la vista y cambia al instante; una región viva lo repite cuando
 * lleva medio segundo quieto. El orden de la lista no es un filtro: no sale
 * aquí y «Limpiar filtros» no lo toca.
 */
function ActiveFilters({ filters, total, matchCount, onQueryChange, onZoneChange, onToggleCondition, onClearFilters, focusSearch }: ActiveFiltersProps) {
  const text = countText(total, matchCount)
  const chips = chipsOf(filters)

  // Solo se anuncian los cambios, no el recuento con el que se carga.
  const [announced, setAnnounced] = useState('')
  const lastText = useRef(text)
  useEffect(() => {
    if (lastText.current === text) return
    const timer = setTimeout(() => {
      lastText.current = text
      setAnnounced(text)
    }, COUNT_ANNOUNCEMENT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text])

  // Al quitar un filtro, el foco pasa al siguiente si existe —el que ocupa
  // ahora su sitio—; si no, al anterior; si no queda ninguno, al buscador. Se
  // resuelve después de pintar, cuando la pastilla ya no está.
  const list = useRef<HTMLUListElement | null>(null)
  const pendingFocus = useRef<number | null>(null)
  useEffect(() => {
    if (pendingFocus.current === null) return
    const index = pendingFocus.current
    pendingFocus.current = null
    const buttons = list.current?.querySelectorAll('button') ?? []
    const target = buttons[index] ?? buttons[index - 1]
    if (target) target.focus()
    else focusSearch()
  })

  const removeChip = useCallback(
    (kind: ChipKind, pokemonId: PokedexId | null, index: number) => {
      pendingFocus.current = index
      if (kind === 'condition' && pokemonId) onToggleCondition?.(pokemonId)
      else if (kind === 'zone') onZoneChange?.(null)
      else onQueryChange?.('')
    },
    [onToggleCondition, onZoneChange, onQueryChange],
  )

  function clear() {
    onClearFilters?.()
    focusSearch()
  }

  return (
    <div className="active-filters">
      <p className="active-filters__count">{text}</p>
      <p className="active-filters__announcement" aria-live="polite">
        {announced}
      </p>
      {chips.length > 0 && (
        <ul ref={list} className="active-filters__chips" aria-label="Filtros activos">
          {chips.map((chip, index) => (
            <FilterChip key={chip.pokemonId ?? chip.kind} {...chip} index={index} onRemove={removeChip} />
          ))}
        </ul>
      )}
      {chips.length > 0 && (
        <button type="button" className="active-filters__clear" onClick={clear}>
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

export default ActiveFilters
