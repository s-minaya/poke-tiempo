import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import type { ComponentProps } from 'react'

import { NO_FILTERS } from '../../WeatherApp/location-filters.ts'
import { COUNT_ANNOUNCEMENT_DELAY_MS, countText } from './count-text.ts'
import ActiveFilters from './ActiveFilters.tsx'

type Props = ComponentProps<typeof ActiveFilters>

function props(overrides: Partial<Props> = {}): Props {
  return {
    filters: NO_FILTERS,
    total: 74,
    matchCount: null,
    onQueryChange: vi.fn(),
    onZoneChange: vi.fn(),
    onToggleCondition: vi.fn(),
    onClearFilters: vi.fn(),
    focusSearch: vi.fn(),
    ...overrides,
  }
}

function announcement(container: HTMLElement) {
  return container.querySelector('[aria-live="polite"]')!.textContent
}

afterEach(() => {
  vi.useRealTimers()
})

describe('countText', () => {
  it.each([
    [null, '74 lugares'],
    [8, '8 de 74 lugares'],
    [1, '1 de 74 lugares'],
    [74, '74 de 74 lugares'],
    [0, 'Ningún lugar coincide'],
  ])('%s → «%s»', (matchCount, expected) => {
    expect(countText(74, matchCount)).toBe(expected)
  })
})

describe('ActiveFilters', () => {
  it('sin filtros: el recuento, ninguna pastilla y sin «Limpiar filtros»', () => {
    render(<ActiveFilters {...props()} />)

    expect(screen.getByText('74 lugares')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Filtros activos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
  })

  it('una pastilla por filtro activo, con un nombre que empieza por su texto visible', () => {
    render(<ActiveFilters {...props({ filters: { query: ' coruña ', zone: 'ES', conditions: ['magmar', 'zapdos'] }, matchCount: 3 })} />)

    const chips = screen.getAllByRole('button', { name: /quitar filtro$/ })
    expect(chips.map((chip) => chip.textContent)).toEqual(['Sofocante', 'Tormenta', 'Zona: Toda España', '“coruña”'])
    for (const chip of chips) expect(chip.getAttribute('aria-label')!.startsWith(chip.textContent!)).toBe(true)
  })

  it('la pastilla de una condición lleva su Pokémon en un disco, decorativo', () => {
    const { container } = render(<ActiveFilters {...props({ filters: { ...NO_FILTERS, conditions: ['kyogre'] }, matchCount: 1 })} />)

    const sprite = container.querySelector('.active-filters__disc img')!
    expect(sprite).toHaveAttribute('alt', '')
    expect(sprite.getAttribute('src')).toContain('kyogre')
  })

  it('una búsqueda de solo espacios no es un filtro: sin pastilla', () => {
    render(<ActiveFilters {...props({ filters: { ...NO_FILTERS, query: '   ' } })} />)

    expect(screen.queryByRole('button', { name: /quitar filtro$/ })).not.toBeInTheDocument()
  })

  it.each([
    ['la condición', 'Sofocante, quitar filtro', 'onToggleCondition', 'magmar'],
    ['la zona', 'Zona: Andalucía, quitar filtro', 'onZoneChange', null],
    ['la búsqueda', '“sevilla”, quitar filtro', 'onQueryChange', ''],
  ] as const)('quitar %s llama solo a su manejador', (_, name, handler, argument) => {
    const all = props({ filters: { query: 'sevilla', zone: 'Andalucía', conditions: ['magmar'] }, matchCount: 1 })
    render(<ActiveFilters {...all} />)

    fireEvent.click(screen.getByRole('button', { name }))

    expect(all[handler]).toHaveBeenCalledWith(argument)
    const others = (['onToggleCondition', 'onZoneChange', 'onQueryChange', 'onClearFilters'] as const).filter((other) => other !== handler)
    for (const other of others) expect(all[other]).not.toHaveBeenCalled()
  })

  it('«Limpiar filtros» los quita todos y lleva el foco al buscador', () => {
    const all = props({ filters: { query: 'a', zone: null, conditions: [] }, matchCount: 40 })
    render(<ActiveFilters {...all} />)

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(all.onClearFilters).toHaveBeenCalledTimes(1)
    expect(all.focusSearch).toHaveBeenCalledTimes(1)
  })

  it('el recuento cambia al instante; la región viva lo repite medio segundo después del último cambio', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<ActiveFilters {...props()} />)
    expect(announcement(container)).toBe('')

    // Tres «teclas» seguidas.
    for (const [query, matchCount] of [
      ['s', 40],
      ['se', 12],
      ['sev', 1],
    ] as const) {
      rerender(<ActiveFilters {...props({ filters: { ...NO_FILTERS, query }, matchCount })} />)
      act(() => vi.advanceTimersByTime(COUNT_ANNOUNCEMENT_DELAY_MS - 100))
    }

    expect(screen.getByText('1 de 74 lugares')).toBeInTheDocument()
    expect(announcement(container)).toBe('')

    act(() => vi.advanceTimersByTime(100))
    expect(announcement(container)).toBe('1 de 74 lugares')
  })

  it('el recuento con el que se carga no se anuncia', () => {
    vi.useFakeTimers()
    const { container } = render(<ActiveFilters {...props()} />)

    act(() => vi.advanceTimersByTime(COUNT_ANNOUNCEMENT_DELAY_MS * 4))

    expect(announcement(container)).toBe('')
  })
})
