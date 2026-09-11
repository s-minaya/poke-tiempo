import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { Forecast, LocationForecast } from '../../domain/types.ts'
import SpainMap from './SpainMap.tsx'

function locationForecast(overrides: Partial<LocationForecast> = {}): LocationForecast {
  return {
    locationId: 'a-coruna',
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

describe('SpainMap', () => {
  it('renderiza el SVG raíz con nombre accesible, como grupo (no como imagen única)', () => {
    render(<SpainMap forecast={forecast([])} />)

    const root = screen.getByRole('group', { name: /Mapa de España/ })
    expect(root.tagName.toLowerCase()).toBe('svg')
  })

  it('renderiza los 74 lugares, incluso sin ningún forecast', () => {
    const { container } = render(<SpainMap forecast={forecast([])} />)

    expect(container.querySelectorAll('.location-marker')).toHaveLength(74)
    expect(container.querySelectorAll('image')).toHaveLength(0)
  })

  it('cada uno de los 74 lugares sigue expuesto individualmente a tecnología de asistencia', () => {
    render(<SpainMap forecast={forecast([])} />)

    // Si algún contenedor ancestro llevara `role="img"`, estos 74 quedarían
    // colapsados en un único nombre accesible — la razón del cambio a
    // `role="group"` en el SVG raíz y en cada recuadro de territorio.
    expect(screen.getAllByRole('img')).toHaveLength(74)
  })

  it('un lugar con forecast pinta su único sprite; el resto sigue sin ninguno', () => {
    const { container } = render(
      <SpainMap forecast={forecast([locationForecast({ locationId: 'a-coruna', storm: true })])} />,
    )

    expect(container.querySelectorAll('image')).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'A Coruña' })).toBeInTheDocument()
  })

  it('Canarias se renderiza en su propio recuadro, como grupo accesible', () => {
    const { container } = render(<SpainMap forecast={forecast([locationForecast({ locationId: 'tenerife' })])} />)

    const canarias = screen.getByRole('group', { name: 'Canarias' })
    expect(canarias.querySelector('.location-marker')).toBeInTheDocument()
    expect(canarias.tagName.toLowerCase()).toBe('svg')
    expect(container.querySelectorAll('.location-marker')).toHaveLength(74)
  })

  it('Ceuta y Melilla se renderizan como lugares normales del mapa principal, no en un recuadro aparte', () => {
    render(
      <SpainMap
        forecast={forecast([locationForecast({ locationId: 'ceuta' }), locationForecast({ locationId: 'melilla' })])}
      />,
    )

    expect(screen.getByRole('img', { name: 'Ceuta' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Melilla' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Ceuta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Melilla' })).not.toBeInTheDocument()
  })

  it('el contexto norteafricano es puramente decorativo: sin lugar propio ni rol accesible', () => {
    const { container } = render(<SpainMap forecast={forecast([])} />)

    expect(container.querySelectorAll('.spain-map__north-africa-context')).toHaveLength(2)
    expect(screen.queryByRole('img', { name: /Marruecos|Argelia/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Marruecos|Argelia/ })).not.toBeInTheDocument()
    // Ningún lugar nuevo: los 74 de siempre, ninguno de más por la
    // geometría decorativa.
    expect(container.querySelectorAll('.location-marker')).toHaveLength(74)
  })
})
