import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import type { PokedexId } from '../../domain/pokedex.ts'
import type { Forecast, LocationForecast } from '../../domain/types.ts'
import Legend from './Legend.tsx'

function locationForecast(locationId: string, overrides: Partial<LocationForecast> = {}): LocationForecast {
  return {
    locationId,
    date: '2026-09-08',
    temperature: { maxC: 20, minC: 10 },
    sky: 'despejado',
    precipitation: { mm: 0, probabilityPercent: 5 },
    snow: { cm: 0, present: false },
    wind: { speedKmh: 10, gustKmh: 15 },
    storm: false,
    calima: false,
    fog: false,
    marine: { status: 'not_applicable' },
    alerts: { status: 'ok', alerts: [] },
    provenance: { primary: 'aemet' },
    primarySourceDescription: 'Despejado',
    ...overrides,
  }
}

function forecast(locations: LocationForecast[]): Forecast {
  return {
    date: '2026-09-08',
    generatedAt: '2026-09-08T06:00:00.000Z',
    locations,
    meta: { totalLocations: locations.length, successfulLocations: locations.length, failedLocations: [] },
  }
}

describe('Legend', () => {
  it('muestra el encabezado "Leyenda", que también da el nombre accesible a la sección', () => {
    render(<Legend forecast={forecast([locationForecast('a-coruna')])} />)

    expect(screen.getByRole('heading', { name: 'Leyenda' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Leyenda' })).toBeInTheDocument()
  })

  it('lista solo los Pokémon realmente visibles, con su descripción', () => {
    render(<Legend forecast={forecast([locationForecast('a-coruna', { storm: true })])} />)

    expect(screen.getByText('Tormenta')).toBeInTheDocument()
    expect(screen.queryByText('Helado')).not.toBeInTheDocument()
  })

  it('deduplica: dos lugares con el mismo Pokémon dan una sola entrada', () => {
    render(
      <Legend
        forecast={forecast([locationForecast('a-coruna', { storm: true }), locationForecast('madrid', { storm: true })])}
      />,
    )

    expect(screen.getAllByText('Tormenta')).toHaveLength(1)
  })

  it('sin ningún lugar con forecast: leyenda vacía, sin romper', () => {
    const { container } = render(<Legend forecast={forecast([])} />)

    expect(container.querySelectorAll('.legend__item')).toHaveLength(0)
  })
})

describe('Legend como filtro', () => {
  // Tres Pokémon distintos: tormenta (Zapdos), niebla (Castform de hielo) y
  // el de un día tranquilo.
  const today = forecast([
    locationForecast('a-coruna', { storm: true }),
    locationForecast('madrid', { fog: true }),
    locationForecast('sevilla'),
  ])

  function entries() {
    return within(screen.getByRole('region', { name: 'Leyenda' })).getAllByRole('button')
  }

  it('sin nada pulsado: las mismas entradas que sin filtro, todas botones sin pulsar, sin ✓ ni siluetas', () => {
    const { container } = render(<Legend forecast={today} />)

    expect(entries().map((entry) => entry.textContent)).toEqual([...container.querySelectorAll('.legend__label')].map((label) => label.textContent))
    expect(entries()).toHaveLength(3)
    for (const entry of entries()) expect(entry).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelectorAll('.legend__check')).toHaveLength(0)
    expect(container.querySelectorAll('.legend__sprite--dimmed')).toHaveLength(0)
  })

  it('la columna de estado existe en todas las entradas, también en reposo', () => {
    const { container } = render(<Legend forecast={today} />)

    expect(container.querySelectorAll('.legend__entry > .legend__state')).toHaveLength(3)
  })

  it('el nombre de cada botón es su etiqueta: el sprite es decorativo', () => {
    render(<Legend forecast={today} />)

    expect(screen.getByRole('button', { name: 'Tormenta' })).toBeInTheDocument()
    for (const entry of entries()) expect(entry.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('explica que se puede pulsar', () => {
    render(<Legend forecast={today} />)

    expect(screen.getByText('Pulsa un Pokémon para verlo en el mapa')).toBeInTheDocument()
  })

  it('pulsar avisa con el id de su Pokémon', () => {
    const onToggleCondition = vi.fn()
    render(<Legend forecast={today} onToggleCondition={onToggleCondition} />)

    fireEvent.click(screen.getByRole('button', { name: 'Tormenta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tormenta' }))

    expect(onToggleCondition).toHaveBeenCalledTimes(2)
    expect(onToggleCondition).toHaveBeenNthCalledWith(1, 'zapdos')
  })

  it.each([
    ['una pulsada', ['zapdos']],
    ['varias pulsadas', ['zapdos', 'castform-ice']],
  ] as [string, PokedexId[]][])('%s: pulsadas con ✓, y el resto en silueta y todavía pulsable', (_, selected) => {
    const { container } = render(<Legend forecast={today} selectedConditions={selected} />)

    const pressed = entries().filter((entry) => entry.getAttribute('aria-pressed') === 'true')
    const rest = entries().filter((entry) => entry.getAttribute('aria-pressed') === 'false')
    expect(pressed).toHaveLength(selected.length)
    expect(pressed.every((entry) => entry.querySelector('.legend__check') !== null)).toBe(true)
    expect(pressed.every((entry) => entry.querySelector('.legend__sprite--dimmed') === null)).toBe(true)
    expect(rest.every((entry) => entry.querySelector('.legend__check') === null)).toBe(true)
    expect(rest.every((entry) => entry.querySelector('.legend__sprite--dimmed') !== null)).toBe(true)
    expect(rest.every((entry) => !entry.hasAttribute('disabled'))).toBe(true)
    expect(container.querySelectorAll('.legend__check')).toHaveLength(selected.length)
  })

  it('el ✓ es decorativo: no cambia el nombre del botón', () => {
    render(<Legend forecast={today} selectedConditions={['zapdos']} />)

    expect(screen.getByRole('button', { name: 'Tormenta', pressed: true })).toBeInTheDocument()
    expect(document.querySelector('.legend__check')).toHaveAttribute('aria-hidden', 'true')
  })
})
