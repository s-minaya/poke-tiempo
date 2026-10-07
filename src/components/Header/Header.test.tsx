import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { ForecastFreshness } from '../../domain/forecast-freshness.ts'
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
    generatedAt: '2026-09-11T11:34:48.000Z',
    locations,
    meta: { totalLocations: locations.length, successfulLocations: locations.length, failedLocations: [] },
  }
}

const TODAY: ForecastFreshness = { status: 'today', daysLate: 0 }

const STATES: ForecastFreshness[] = [
  { status: 'tomorrow', daysLate: 0 },
  TODAY,
  { status: 'late', daysLate: 1 },
  { status: 'very-late', daysLate: 3 },
  { status: 'unknown', daysLate: 0 },
]

const RELATIVE_DAY_WORD = /(?<![\p{L}\p{N}])(hoy|mañana|ayer)(?![\p{L}\p{N}])/iu
const PUBLISHED_VERSION_CLAIM = /más reciente publicad|era la más reciente|versión nueva|hay una nueva/i

/** El texto de la cabecera sin la etiqueta HOY / MAÑANA / ATRASADA. */
function textOutsideLabel(container: HTMLElement): string {
  const header = container.querySelector('.header')!.cloneNode(true) as HTMLElement
  header.querySelectorAll('.header__label').forEach((label) => label.remove())
  return header.textContent ?? ''
}

describe('Header', () => {
  it('muestra el título y la línea de previsión derivada de forecast.date', () => {
    render(<Header forecast={forecast([20])} freshness={TODAY} />)

    expect(screen.getByRole('heading', { name: 'POKETIEMPO' })).toBeInTheDocument()
    expect(screen.getByText('Previsión para el sábado 12 de septiembre')).toBeInTheDocument()
  })

  it('aplica el modificador de mood según la temperatura máxima que predomina', () => {
    const { container } = render(<Header forecast={forecast([5, 5, 30])} freshness={TODAY} />)

    expect(container.querySelector('.header--cold')).toBeInTheDocument()
  })

  it('cambia de modificador con un forecast dominado por temperaturas extremas', () => {
    const { container } = render(<Header forecast={forecast([38, 38, 5])} freshness={TODAY} />)

    expect(container.querySelector('.header--sweltering')).toBeInTheDocument()
  })

  describe('frescura', () => {
    it.each([
      { status: 'tomorrow', daysLate: 0, label: 'mañana', reads: 'Previsión para el sábado 12 de septiembre, mañana' },
      { status: 'today', daysLate: 0, label: 'hoy', reads: 'Previsión para el sábado 12 de septiembre, hoy' },
      { status: 'late', daysLate: 1, label: 'atrasada', reads: 'Previsión para el sábado 12 de septiembre, atrasada' },
      { status: 'very-late', daysLate: 3, label: 'atrasada', reads: 'Previsión para el sábado 12 de septiembre, atrasada' },
    ] as const)('$status: etiqueta «$label», leída en la misma frase que la fecha', ({ status, daysLate, label, reads }) => {
      const { container } = render(<Header forecast={forecast([20])} freshness={{ status, daysLate }} />)

      expect(container.querySelector('.header__label')).toHaveTextContent(label)
      expect(container.querySelector('.header__forecast')).toHaveTextContent(reads)
    })

    it('atrasada lleva el icono de reloj, oculto a los lectores de pantalla; HOY y MAÑANA no', () => {
      const late = render(<Header forecast={forecast([20])} freshness={{ status: 'late', daysLate: 1 }} />)
      expect(late.container.querySelector('.header__label--late svg')).toHaveAttribute('aria-hidden', 'true')
      late.unmount()

      const today = render(<Header forecast={forecast([20])} freshness={TODAY} />)
      expect(today.container.querySelector('.header__label svg')).not.toBeInTheDocument()
    })

    it('unknown: ni etiqueta ni separador, solo la fecha', () => {
      const { container } = render(<Header forecast={forecast([20])} freshness={{ status: 'unknown', daysLate: 0 }} />)

      expect(container.querySelector('.header__label')).not.toBeInTheDocument()
      expect(container.querySelector('.header__separator')).not.toBeInTheDocument()
      expect(container.querySelector('.header__forecast')).toHaveTextContent(/^Previsión para el sábado 12 de septiembre$/)
    })

    it('con un día de retraso, la cabecera lo dice con la fecha absoluta', () => {
      render(<Header forecast={forecast([20])} freshness={{ status: 'late', daysLate: 1 }} />)

      expect(screen.getByText('Esta previsión corresponde al sábado 12 de septiembre y lleva 1 día de retraso.')).toBeInTheDocument()
    })

    it.each(STATES.filter((freshness) => freshness.status !== 'late'))('$status: sin la frase de un día de retraso', (freshness) => {
      const { container } = render(<Header forecast={forecast([20])} freshness={freshness} />)

      expect(container.querySelector('.header__delay')).not.toBeInTheDocument()
    })

    it.each(STATES)('$status: la hora de generación, en hora peninsular, desde forecast.generatedAt', (freshness) => {
      render(<Header forecast={forecast([20])} freshness={freshness} />)

      expect(screen.getByText('Previsión generada el viernes 11 de septiembre a las 13:34 (hora peninsular)')).toBeInTheDocument()
    })

    it.each(STATES)('$status: fuera de la etiqueta, ni hoy, ni mañana, ni ayer, ni nada sobre lo publicado', (freshness) => {
      const { container } = render(<Header forecast={forecast([20])} freshness={freshness} />)

      const text = textOutsideLabel(container)
      expect(text).not.toMatch(RELATIVE_DAY_WORD)
      expect(text).not.toMatch(PUBLISHED_VERSION_CLAIM)
    })
  })
})
