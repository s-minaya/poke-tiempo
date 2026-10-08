import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import type { Forecast, LocationForecast } from '../../domain/types.ts'
import { buildLocationViews } from '../../domain/location-views.ts'

import SpainMap from './SpainMap.tsx'

import { locations } from '../../data/locations.ts'
import { canaryBox, mapPoints, ROOT_VIEW_BOX } from '../../data/map-geometry.ts'
import forecastData from '../../data/forecast.json'

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
    expect(screen.getAllByRole('button')).toHaveLength(74)
  })

  it('un lugar con forecast pinta su único sprite; el resto sigue sin ninguno', () => {
    const { container } = render(
      <SpainMap forecast={forecast([locationForecast({ locationId: 'a-coruna', storm: true })])} />,
    )

    expect(container.querySelectorAll('image')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'A Coruña, mínima 10 grados, máxima 20 grados' })).toBeInTheDocument()
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

    expect(screen.getByRole('button', { name: 'Ceuta, mínima 10 grados, máxima 20 grados' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Melilla, mínima 10 grados, máxima 20 grados' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Ceuta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Melilla' })).not.toBeInTheDocument()
  })

  it('el contexto norteafricano es puramente decorativo: sin lugar propio ni rol accesible', () => {
    const { container } = render(<SpainMap forecast={forecast([])} />)

    expect(container.querySelectorAll('.spain-map__north-africa-context')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Marruecos|Argelia/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Marruecos|Argelia/ })).not.toBeInTheDocument()
    // Ningún lugar nuevo: los 74 de siempre, ninguno de más por la
    // geometría decorativa.
    expect(container.querySelectorAll('.location-marker')).toHaveLength(74)
  })
  it('los sprites van en su propia capa, justo antes de los marcadores, en el mapa y en Canarias', () => {
    const today = forecastData as Forecast
    const { container } = render(<SpainMap forecast={today} />)

    const views = buildLocationViews(locations, today)
    const svgs = [
      [container.querySelector('.spain-map__canvas')!, 'main'],
      [container.querySelector('.territory-inset')!, 'canary'],
    ] as const
    for (const [svg, region] of svgs) {
      const children = [...svg.children]
      const layer = children.find((child) => child.classList.contains('marker-layers__sprites'))!
      expect(children.indexOf(layer)).toBe(children.findIndex((child) => child.classList.contains('location-marker')) - 1)
      expect(layer.querySelectorAll('image')).toHaveLength(views.filter((view) => view.region === region && view.pokemonId !== null).length)
    }
    expect(container.querySelectorAll('.location-marker image')).toHaveLength(0)
  })
})

describe('SpainMap — selección de un lugar', () => {
  it('los 74 marcadores tienen nombre accesible y no se repite ninguno (WCAG 4.1.2)', () => {
    render(<SpainMap forecast={forecast([])} />)

    const names = screen.getAllByRole('button').map((marker) => marker.getAttribute('aria-label') ?? '')
    expect(names).toHaveLength(74)
    expect(names.filter((name) => name.trim() === '')).toEqual([])
    expect(new Set(names).size).toBe(74)
  })

  it('activar un marcador pide seleccionar su lugar', () => {
    const onToggleLocation = vi.fn()
    render(<SpainMap forecast={forecast([])} onToggleLocation={onToggleLocation} />)

    fireEvent.click(screen.getByRole('button', { name: 'Gijón' }))

    expect(onToggleLocation).toHaveBeenCalledWith('gijon')
  })

  it('solo el lugar seleccionado se anuncia como pulsado', () => {
    render(<SpainMap forecast={forecast([])} selectedLocationId="gijon" />)

    expect(screen.getByRole('button', { name: 'Gijón' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('sin selección no hay tarjeta', () => {
    render(<SpainMap forecast={forecast([])} />)

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('la tarjeta nombra el lugar y su área administrativa', () => {
    render(
      <SpainMap
        forecast={forecast([locationForecast({ locationId: 'gijon', temperature: { minC: 16.6, maxC: 25.2 } })])}
        selectedLocationId="gijon"
      />,
    )

    const card = screen.getByRole('region', { name: 'Gijón' })
    expect(within(card).getByText('Asturias')).toBeInTheDocument()
    expect(card).toHaveTextContent('Mínima 17° · Máxima 25°')
  })

  it('la tarjeta omite el área cuando coincide con el nombre', () => {
    const { container } = render(<SpainMap forecast={forecast([])} selectedLocationId="madrid" />)

    expect(screen.getByRole('region', { name: 'Madrid' })).toBeInTheDocument()
    expect(container.querySelector('.location-card__area')).not.toBeInTheDocument()
  })

  it('anuncia el lugar seleccionado en una región viva que existe desde antes', () => {
    const { container, rerender } = render(<SpainMap forecast={forecast([])} />)

    const live = container.querySelector('[aria-live="polite"]')
    expect(live).toHaveTextContent('')

    rerender(<SpainMap forecast={forecast([])} selectedLocationId="jaca" />)

    expect(container.querySelector('[aria-live="polite"]')).toBe(live)
    expect(live).toHaveTextContent('Jaca, Huesca. Sin previsión.')
  })

  it('cerrar la tarjeta con el foco dentro lo devuelve al marcador si no se sabe quién la abrió', () => {
    const onClearLocation = vi.fn()
    render(<SpainMap forecast={forecast([])} selectedLocationId="gijon" onClearLocation={onClearLocation} />)

    const close = screen.getByRole('button', { name: 'Cerrar' })
    close.focus()
    fireEvent.click(close)

    expect(onClearLocation).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Gijón' })).toHaveFocus()
  })

  it('cerrar con un toque que no enfoca el botón no mueve el foco', () => {
    const onClearLocation = vi.fn()
    render(<SpainMap forecast={forecast([])} selectedLocationId="gijon" onClearLocation={onClearLocation} />)

    // Así se comportan Safari y los navegadores táctiles: el botón recibe
    // el clic pero no el foco. Mover el foco al marcador haría saltar la
    // página hasta el mapa.
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onClearLocation).toHaveBeenCalledTimes(1)
    expect(document.body).toHaveFocus()
  })

  it('la tarjeta se abre hacia el lado del mapa con más espacio libre', () => {
    const { container, rerender } = render(<SpainMap forecast={forecast([])} selectedLocationId="a-coruna" />)
    expect(container.querySelector('.location-card')).toHaveClass('location-card--east')

    rerender(<SpainMap forecast={forecast([])} selectedLocationId="menorca" />)
    expect(container.querySelector('.location-card')).toHaveClass('location-card--west')
  })

  it('los lugares de Canarias anclan la tarjeta dentro de su recuadro, no en su posición local', () => {
    const { container } = render(<SpainMap forecast={forecast([])} selectedLocationId="tenerife" />)

    const card = container.querySelector<HTMLElement>('.location-card')!
    const tenerife = mapPoints.tenerife
    const seaBottom = canaryBox.y + canaryBox.height
    expect(Number(card.style.getPropertyValue('--anchor-x'))).toBeCloseTo((canaryBox.x + tenerife.x - ROOT_VIEW_BOX.x) / ROOT_VIEW_BOX.width)
    expect(Number(card.style.getPropertyValue('--anchor-y'))).toBeCloseTo((canaryBox.y + tenerife.y - ROOT_VIEW_BOX.y) / seaBottom)
  })

  it('cita las fuentes de los datos bajo el mapa, con los enlaces de Open-Meteo y de su licencia', () => {
    const { container } = render(<SpainMap forecast={forecast([])} />)

    const attribution = container.querySelector('.spain-map__attribution')
    expect(attribution?.textContent).toBe('Datos meteorológicos: AEMET · IPMA · Open-Meteo.com (CC BY 4.0), adaptados para el mapa.')

    const links = within(container).getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Open-Meteo.com' })).toHaveAttribute('href', 'https://open-meteo.com/')
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/')
    for (const link of links) {
      expect(attribution).toContainElement(link)
      expect(link).not.toHaveAttribute('target')
    }
  })

  it('la atribución va justo detrás del dibujo, fuera de la caja en la que se ancla la tarjeta', () => {
    const { container } = render(<SpainMap forecast={forecast([])} selectedLocationId="madrid" />)

    const drawing = container.querySelector('.spain-map__drawing')
    const attribution = container.querySelector('.spain-map__attribution')
    expect(drawing?.nextElementSibling).toBe(attribution)
    expect(drawing).toContainElement(screen.getByRole('group', { name: /Mapa de España/ }))
    expect(drawing).toContainElement(container.querySelector<HTMLElement>('.location-card'))
    expect(drawing).not.toContainElement(attribution as HTMLElement)
  })
})

describe('SpainMap — filtros', () => {
  // La previsión real: los 74 con sprite y cifras, que es lo que la sombra
  // tiene que quitar y devolver.
  const today = forecastData as Forecast
  const views = buildLocationViews(locations, today)
  const withSprite = (ids: readonly string[]) => views.filter((view) => ids.includes(view.id) && view.pokemonId !== null).length

  // Cada marcador en el orden del DOM, con todo lo que lo hace un botón.
  function markers(container: HTMLElement) {
    return [...container.querySelectorAll<SVGGElement>('.location-marker')].map((marker) => ({
      transform: marker.getAttribute('transform'),
      role: marker.getAttribute('role'),
      tabindex: marker.getAttribute('tabindex'),
      label: marker.getAttribute('aria-label'),
      pressed: marker.getAttribute('aria-pressed'),
      hidden: marker.getAttribute('aria-hidden'),
      title: marker.querySelector('title')?.textContent ?? null,
      temperatures: marker.querySelector('.location-marker__temperature:not(.location-marker__temperature--contour)')?.textContent ?? null,
      focusRing: marker.querySelector('.location-marker__focus-ring') !== null,
    }))
  }

  // Cada sprite de las capas de sprites, en el orden del DOM: dónde, cuál y
  // si es una silueta.
  function sprites(container: HTMLElement) {
    return [...container.querySelectorAll('.marker-layers__sprites image')].map((sprite) => ({
      place: ['transform', 'x', 'y', 'width', 'height', 'href'].map((attribute) => sprite.getAttribute(attribute)).join(' '),
      silhouette: sprite.getAttribute('filter'),
    }))
  }

  const ALL = locations.map((location) => location.id)

  it('matchingIds null: exactamente el mapa de la 008, los 74 botones y ninguna silueta', () => {
    const { container: without } = render(<SpainMap forecast={today} />)
    const { container: explicit } = render(<SpainMap forecast={today} matchingIds={null} />)

    expect(explicit.innerHTML).toBe(without.innerHTML)
    expect(within(explicit).getAllByRole('button')).toHaveLength(74)
    expect(sprites(explicit).filter((sprite) => sprite.silhouette)).toEqual([])
  })

  it('un conjunto con los 74: igual que sin filtros', () => {
    const { container: without } = render(<SpainMap forecast={today} />)
    const { container: all } = render(<SpainMap forecast={today} matchingIds={new Set(ALL)} />)

    expect(markers(all)).toEqual(markers(without))
    expect(sprites(all)).toEqual(sprites(without))
  })

  it('un conjunto vacío: ningún marcador, y cada lugar con Pokémon queda como silueta', () => {
    const { container } = render(<SpainMap forecast={today} matchingIds={new Set()} />)

    expect(within(container).queryAllByRole('button')).toHaveLength(0)
    expect(container.querySelectorAll('.location-marker')).toHaveLength(0)
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0)
    expect(sprites(container).filter((sprite) => sprite.silhouette)).toHaveLength(withSprite(ALL))
    expect(sprites(container).filter((sprite) => !sprite.silhouette)).toHaveLength(0)
  })

  it.each([
    ['del mapa principal', 'madrid', /^Madrid,/],
    ['de Canarias', 'tenerife', /^Tenerife,/],
  ])('un conjunto de un lugar %s: exactamente 1 operable, y el resto como silueta', (_, id, name) => {
    const { container } = render(<SpainMap forecast={today} matchingIds={new Set([id])} />)

    const operable = within(container).getAllByRole('button')
    expect(operable).toHaveLength(1)
    expect(operable[0]).toHaveAccessibleName(name)
    expect(container.querySelectorAll('.location-marker')).toHaveLength(1)
    expect(sprites(container).filter((sprite) => sprite.silhouette)).toHaveLength(withSprite(ALL.filter((other) => other !== id)))
  })

  it.each([
    ['sin filtros', null],
    ['vacío', new Set<string>()],
    ['un lugar', new Set(['madrid'])],
    ['medio mapa', new Set(ALL.filter((_, index) => index % 2 === 0))],
  ])('%s: cada marcador es un botón completo, y los sprites no tienen nada operable', (_, matchingIds) => {
    const { container } = render(<SpainMap forecast={today} matchingIds={matchingIds} />)

    const matching = matchingIds === null ? ALL : ALL.filter((id) => matchingIds.has(id))
    const all = markers(container)
    expect(all).toHaveLength(matching.length)
    expect(all.filter((marker) => marker.role !== 'button' || marker.tabindex !== '0' || !marker.label || !marker.title || !marker.focusRing || marker.hidden !== null)).toEqual([])

    // Los sprites, siempre dentro de una capa oculta y sin nada que enfocar
    // o pulsar; silueta los de los lugares que no coinciden.
    for (const layer of container.querySelectorAll('.marker-layers__sprites')) {
      expect(layer).toHaveAttribute('aria-hidden', 'true')
      expect(layer.querySelectorAll('[tabindex], [role], title, text')).toHaveLength(0)
    }
    expect(sprites(container).filter((sprite) => sprite.silhouette)).toHaveLength(withSprite(ALL.filter((id) => !matching.includes(id))))
  })

  it('una silueta no responde a clic ni a teclado', () => {
    const onToggleLocation = vi.fn()
    const onClearLocation = vi.fn()
    const { container } = render(<SpainMap forecast={today} matchingIds={new Set()} onToggleLocation={onToggleLocation} onClearLocation={onClearLocation} />)

    for (const sprite of container.querySelectorAll('.marker-layers__sprites image')) {
      fireEvent.click(sprite)
      fireEvent.keyDown(sprite, { key: 'Enter' })
      fireEvent.keyDown(sprite, { key: ' ' })
      fireEvent.keyDown(sprite, { key: 'Escape' })
    }

    expect(onToggleLocation).not.toHaveBeenCalled()
    expect(onClearLocation).not.toHaveBeenCalled()
  })

  it('la sombra no cambia coordenadas, tamaños, sprites ni su orden, ni la caja del mapa', () => {
    const { container: without } = render(<SpainMap forecast={today} />)
    const { container: empty } = render(<SpainMap forecast={today} matchingIds={new Set()} />)
    const { container: half } = render(<SpainMap forecast={today} matchingIds={new Set(ALL.slice(0, 37))} />)

    const places = (container: HTMLElement) => sprites(container).map(({ place }) => place)
    expect(places(empty)).toEqual(places(without))
    expect(places(half)).toEqual(places(without))

    // Los marcadores que quedan, en su sitio y en el mismo orden.
    const kept = new Set(views.filter((view) => ALL.slice(0, 37).includes(view.id)).map((view) => view.name))
    expect(markers(half).map(({ transform }) => transform)).toEqual(markers(without).filter(({ title }) => kept.has(title!)).map(({ transform }) => transform))

    const box = (container: HTMLElement) => {
      const svg = container.querySelector('.spain-map__canvas')!
      return [svg.getAttribute('viewBox'), svg.getAttribute('style'), svg.getAttribute('preserveAspectRatio')]
    }
    expect(box(empty)).toEqual(box(without))
    expect(box(half)).toEqual(box(without))
  })

  it('la sombra es la silueta del sprite: un único filtro en el mapa, al que apuntan todas, también las de Canarias', () => {
    const { container } = render(<SpainMap forecast={today} matchingIds={new Set()} />)

    const filters = container.querySelectorAll('defs filter')
    expect(filters).toHaveLength(1)
    const reference = `url(#${filters[0].id})`
    const silhouettes = sprites(container)
    expect(silhouettes.length).toBeGreaterThan(0)
    expect(silhouettes.every((sprite) => sprite.silhouette === reference)).toBe(true)
    const canary = views.filter((view) => view.region === 'canary').map((view) => view.id)
    expect(container.querySelectorAll('.territory-inset .marker-layers__sprites image[filter]')).toHaveLength(withSprite(canary))
  })

  it('las cifras desaparecen en sombra y vuelven, las mismas, al volver a coincidir', () => {
    const { container, rerender } = render(<SpainMap forecast={today} />)
    const before = markers(container)
    expect(before.every((marker) => marker.temperatures !== null)).toBe(true)

    rerender(<SpainMap forecast={today} matchingIds={new Set(['madrid'])} />)
    const filtered = markers(container)
    expect(filtered.filter((marker) => marker.temperatures !== null).map((marker) => marker.label)).toEqual([before.find((marker) => marker.label?.startsWith('Madrid,'))!.label])
    // Las de Madrid, con su copia de contorno: ninguna más en todo el mapa.
    expect(container.querySelectorAll('text')).toHaveLength(2)

    rerender(<SpainMap forecast={today} matchingIds={new Set(ALL)} />)
    expect(markers(container)).toEqual(before)

    rerender(<SpainMap forecast={today} matchingIds={null} />)
    expect(markers(container)).toEqual(before)
  })

  it('el lugar seleccionado que sigue coincidiendo conserva su tarjeta y su estado pulsado', () => {
    const { container } = render(<SpainMap forecast={today} selectedLocationId="madrid" matchingIds={new Set(['madrid', 'toledo'])} />)

    expect(within(container).getByRole('button', { name: /^Madrid,/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: 'Madrid' })).toBeInTheDocument()
  })
})
