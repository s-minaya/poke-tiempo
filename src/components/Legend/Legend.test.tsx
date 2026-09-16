import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

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
