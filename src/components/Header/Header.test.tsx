import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { Forecast, LocationForecast } from '../../domain/types.ts'
import Header from './Header.tsx'

function locationForecast(maxC: number): LocationForecast {
  return {
    locationId: 'a-coruna',
    date: '2026-09-12',
    temperature: { maxC, minC: maxC - 8 },
    sky: 'despejado',
    precipitation: { mm: 0, probabilityPercent: 0 },
    snow: { cm: 0, present: false },
    wind: { speedKmh: 5, gustKmh: 8 },
    storm: false,
    calima: false,
    fog: false,
    marine: { status: 'not_applicable' },
    alerts: { status: 'ok', alerts: [] },
    provenance: { primary: 'aemet' },
    primarySourceDescription: 'Despejado',
  }
}

function forecast(maxCValues: number[]): Forecast {
  const locations = maxCValues.map((maxC) => locationForecast(maxC))
  return {
    date: '2026-09-12',
    generatedAt: '2026-09-11T06:00:00.000Z',
    locations,
    meta: { totalLocations: locations.length, successfulLocations: locations.length, failedLocations: [] },
  }
}

describe('Header', () => {
  it('muestra el título y la línea de previsión derivada de forecast.date', () => {
    render(<Header forecast={forecast([20])} />)

    expect(screen.getByRole('heading', { name: 'POKETIEMPO' })).toBeInTheDocument()
    expect(screen.getByText('PREVISIÓN · SÁBADO 12 DE SEPTIEMBRE')).toBeInTheDocument()
  })

  it('aplica el modificador de mood según la temperatura máxima que predomina', () => {
    const { container } = render(<Header forecast={forecast([5, 5, 30])} />)

    expect(container.querySelector('.header--cold')).toBeInTheDocument()
  })

  it('cambia de modificador con un forecast dominado por temperaturas extremas', () => {
    const { container } = render(<Header forecast={forecast([38, 38, 5])} />)

    expect(container.querySelector('.header--sweltering')).toBeInTheDocument()
  })
})
