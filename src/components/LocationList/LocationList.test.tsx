import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import type { Forecast, LocationForecast } from '../../domain/types.ts'

import { LOCATION_ZONES } from '../../domain/location-zones.ts'
import { NO_FILTERS } from '../WeatherApp/location-filters.ts'

import LocationList from './LocationList.tsx'

import { locations } from '../../data/locations.ts'
import forecastData from '../../data/forecast.json'

function locationForecast(overrides: Partial<LocationForecast> = {}): LocationForecast {
  return {
    locationId: 'gijon',
    date: '2026-09-08',
    temperature: { maxC: 25.2, minC: 16.6 },
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

function rowOf(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name}`) })
}

describe('LocationList', () => {
  it('los 74 lugares van en listas reales, una por grupo, y cada fila es un botón dentro de su elemento de lista', () => {
    const { container } = render(<LocationList forecast={forecast([])} />)

    // Por zona, que es el orden de partida: un `<ul>` por grupo.
    const lists = container.querySelectorAll('ul.location-list__items')
    expect(lists.length).toBeGreaterThan(1)
    const items = [...lists].flatMap((list) => within(list as HTMLElement).getAllByRole('listitem'))
    expect(items).toHaveLength(74)
    for (const item of items) expect(within(item).getAllByRole('button')).toHaveLength(1)
  })

  it('los sprites se cargan en diferido: la lista queda por debajo del pliegue', () => {
    const { container } = render(
      <LocationList forecast={forecast([locationForecast({ locationId: 'gijon' }), locationForecast({ locationId: 'madrid' })])} />,
    )

    const sprites = [...container.querySelectorAll('img')]
    expect(sprites).toHaveLength(2)
    for (const sprite of sprites) {
      expect(sprite).toHaveAttribute('loading', 'lazy')
      expect(sprite).toHaveAttribute('alt', '')
    }
  })

  it('muestra el área administrativa solo cuando aporta información', () => {
    render(<LocationList forecast={forecast([])} />)

    expect(rowOf('Gijón')).toHaveTextContent('Asturias')
    expect(rowOf('Madrid').querySelector('.location-list__detail')).not.toHaveTextContent('Madrid')
  })

  it('cada fila dice condición y mínima/máxima, redondeadas como en el marcador', () => {
    render(<LocationList forecast={forecast([locationForecast({ locationId: 'gijon' })])} />)

    expect(rowOf('Gijón')).toHaveTextContent('Mín 17°')
    expect(rowOf('Gijón')).toHaveTextContent('Máx 25°')
  })

  it('sin previsión, lo dice', () => {
    render(<LocationList forecast={forecast([])} />)

    expect(rowOf('Gijón')).toHaveTextContent('Sin previsión')
  })

  it('refleja el lugar seleccionado: solo su fila está pulsada', () => {
    render(<LocationList forecast={forecast([])} selectedLocationId="gijon" />)

    expect(rowOf('Gijón')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('activar una fila pide seleccionar su lugar, y Escape pide cerrar la tarjeta', () => {
    const onToggleLocation = vi.fn()
    const onClearLocation = vi.fn()
    render(<LocationList forecast={forecast([])} onToggleLocation={onToggleLocation} onClearLocation={onClearLocation} />)

    fireEvent.click(rowOf('Gijón'))
    fireEvent.keyDown(rowOf('Gijón'), { key: 'Escape' })

    expect(onToggleLocation).toHaveBeenCalledWith('gijon')
    expect(onClearLocation).toHaveBeenCalledTimes(1)
  })
})

describe('LocationList — barra, órdenes y grupos', () => {
  const today = forecastData as Forecast

  function headings() {
    return screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.querySelector('.location-list__group-title')!.textContent)
  }

  it('la banda de título dice «Todos los lugares», con la Poké Ball decorativa', () => {
    const { container } = render(<LocationList forecast={today} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Todos los lugares' })).toBeInTheDocument()
    expect(container.querySelector('.location-list__titlebar svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('por defecto ordena por zona: un encabezado por zona con lugares, en el orden de LOCATION_ZONES', () => {
    render(<LocationList forecast={today} />)

    expect(screen.getByRole('radio', { name: /Zona/ })).toBeChecked()
    const used = new Set(locations.map((location) => location.zone))
    expect(headings()).toEqual(LOCATION_ZONES.filter((zone) => used.has(zone)))
  })

  it('cada encabezado dice cuántos lugares tiene, también al lector de pantalla', () => {
    render(<LocationList forecast={today} />)

    const andalucia = screen.getByRole('heading', { level: 3, name: /^Andalucía/ })
    expect(andalucia).toHaveAccessibleName(/Andalucía\s*, 9 lugares/)
    expect(andalucia.querySelector('.location-list__badge')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('heading', { level: 3, name: /^Cantabria/ })).toHaveAccessibleName(/, 1 lugar$/)
  })

  it('A–Z: una sola lista, sin encabezados', () => {
    const { container } = render(<LocationList forecast={today} />)

    fireEvent.click(screen.getByRole('radio', { name: /A–Z/ }))

    expect(headings()).toEqual([])
    expect(container.querySelectorAll('ul.location-list__items')).toHaveLength(1)
    const names = [...container.querySelectorAll('.location-list__name')].map((name) => name.textContent!)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')))
  })

  it.each([
    ['Más calor', 'max', /^Máxima /],
    ['Más frío', 'min', /^Mínima /],
  ] as const)('%s: grupos por franja con su rango escrito, y la cifra por la que ordena destacada', (label, metric, title) => {
    const { container } = render(<LocationList forecast={today} />)

    fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }))

    expect(headings().length).toBeGreaterThan(0)
    for (const heading of headings()) expect(heading).toMatch(title)
    const emphasised = [...container.querySelectorAll('.location-list__figure--emphasis')]
    expect(emphasised).toHaveLength(74)
    expect(emphasised.every((figure) => figure.textContent!.startsWith(metric === 'max' ? 'Máx' : 'Mín'))).toBe(true)
    expect(container.querySelectorAll('.location-list__swatch')).toHaveLength(headings().length)
  })

  it('cambiar el orden no toca la selección', () => {
    const onToggleLocation = vi.fn()
    const onClearLocation = vi.fn()
    render(<LocationList forecast={today} selectedLocationId="gijon" onToggleLocation={onToggleLocation} onClearLocation={onClearLocation} />)

    for (const label of [/A–Z/, /Más calor/, /Más frío/, /Zona/]) fireEvent.click(screen.getByRole('radio', { name: label }))

    expect(onToggleLocation).not.toHaveBeenCalled()
    expect(onClearLocation).not.toHaveBeenCalled()
    // Por la fila pulsada: tras reordenar, buscar por nombre recalcularía el de las 74.
    const pressed = screen.getAllByRole('button', { pressed: true })
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveAccessibleName(/^Gijón/)
  })

  it('con filtros, solo las filas que coinciden, y el recuento lo dice', () => {
    render(<LocationList forecast={today} filters={{ ...NO_FILTERS, zone: 'Galicia' }} matchingIds={new Set(['a-coruna', 'lugo'])} />)

    expect(screen.getAllByRole('button', { name: /^(A Coruña|Lugo)/ })).toHaveLength(2)
    expect(document.querySelectorAll('.location-list__row')).toHaveLength(2)
    expect(screen.getByText('2 de 74 lugares')).toBeInTheDocument()
  })

  it('sin resultados: el estado vacío, con los controles y los filtros activos todavía a mano', () => {
    const { container } = render(<LocationList forecast={today} filters={{ ...NO_FILTERS, query: 'zzz' }} matchingIds={new Set()} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Ni rastro por aquí' })).toBeInTheDocument()
    expect(screen.getByText('Ningún lugar coincide')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('zzz')
    expect(screen.getByRole('combobox', { name: 'Zona' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '“zzz”, quitar filtro' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Limpiar filtros' })).toHaveLength(2)
    expect(container.querySelectorAll('.location-list__row')).toHaveLength(0)
  })

  it('con resultados, el estado vacío no está en el DOM', () => {
    const { container } = render(<LocationList forecast={today} filters={{ ...NO_FILTERS, query: 'a' }} matchingIds={new Set(['madrid'])} />)

    expect(container.querySelector('.empty-results')).not.toBeInTheDocument()
  })
})
