import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import type { Forecast, LocationForecast } from '../../domain/types.ts'
import type { SelectionOrigin } from '../WeatherApp/location-filters.ts'
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

    expect(onToggleLocation).toHaveBeenCalledWith('gijon', false)
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

  describe('cerrar desde la tarjeta vuelve al origen', () => {
    function renderFrom(origin: { via: 'map' | 'list'; keyboard: boolean }, rowPresent = true) {
      const onClearLocation = vi.fn()
      render(
        <>
          <SpainMap
            forecast={forecast([])}
            selectedLocationId="gijon"
            selectionOrigin={origin}
            findRow={() => (rowPresent ? screen.getByRole('button', { name: 'Fila de Gijón' }) : null)}
            onClearLocation={onClearLocation}
          />
          <button type="button">Fila de Gijón</button>
        </>,
      )
      const close = screen.getByRole('button', { name: 'Cerrar' })
      close.focus()
      return { close, onClearLocation }
    }

    it('abierta desde la lista, el foco vuelve a su fila', () => {
      const { close, onClearLocation } = renderFrom({ via: 'list', keyboard: false })
      fireEvent.click(close)

      expect(onClearLocation).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Fila de Gijón' })).toHaveFocus()
    })

    it('abierta desde el mapa, vuelve al marcador aunque haya una fila', () => {
      const { close } = renderFrom({ via: 'map', keyboard: false })
      fireEvent.click(close)

      expect(screen.getByRole('button', { name: 'Gijón' })).toHaveFocus()
    })

    it('abierta desde la lista pero sin fila —un filtro la quitó—, vuelve al marcador', () => {
      const { close } = renderFrom({ via: 'list', keyboard: false }, false)
      fireEvent.click(close)

      expect(screen.getByRole('button', { name: 'Gijón' })).toHaveFocus()
    })

    it('con la tarjeta en el flujo, devolver el foco no desplaza: de eso se ocupa la vuelta', () => {
      const focus = vi.spyOn(HTMLElement.prototype, 'focus')
      const { close } = renderFrom({ via: 'list', keyboard: false })
      focus.mockClear()
      fireEvent.click(close)

      expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    })

    it('con la tarjeta anclada, el foco vuelve desplazando como siempre', () => {
      const anchored = document.head.appendChild(document.createElement('style'))
      anchored.textContent = '.location-card { position: absolute; }'
      try {
        const focus = vi.spyOn(HTMLElement.prototype, 'focus')
        const { close } = renderFrom({ via: 'list', keyboard: false })
        focus.mockClear()
        fireEvent.click(close)

        expect(focus).toHaveBeenCalledWith({ preventScroll: false })
      } finally {
        anchored.remove()
      }
    })
  })

  // Con la tarjeta en el flujo, abrirla con teclado lleva el foco a Cerrar: se
  // quedaría en el origen, fuera de la vista. Con puntero, toque o tecnología de
  // asistencia no se mueve, y la tarjeta anclada junto al marcador tampoco lo
  // recibe.
  describe('abrirla con teclado lleva el foco a Cerrar', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    /** Ancla la tarjeta junto a su marcador, como en escritorio. Devuelve cómo quitarlo. */
    function anchorCard() {
      const style = document.head.appendChild(document.createElement('style'))
      style.textContent = '.location-card { position: absolute; }'
      return () => style.remove()
    }

    /** Con el foco en el marcador de Gijón, abre su tarjeta como se indica. */
    function open(origin: SelectionOrigin) {
      const view = render(<SpainMap forecast={forecast([])} />)
      const marker = screen.getByRole('button', { name: 'Gijón' })
      marker.focus()
      view.rerender(<SpainMap forecast={forecast([])} selectedLocationId="gijon" selectionOrigin={origin} />)
      return { view, marker, close: screen.getByRole('button', { name: 'Cerrar' }) }
    }

    it.each([
      ['desde el mapa', { via: 'map', keyboard: true }],
      ['desde la lista', { via: 'list', keyboard: true }],
    ] as const)('con teclado, %s, el foco pasa a Cerrar', (_via, origin) => {
      const { close } = open(origin)

      expect(close).toHaveFocus()
    })

    it.each([
      ['desde el mapa', { via: 'map', keyboard: false }],
      ['desde la lista', { via: 'list', keyboard: false }],
    ] as const)('con puntero, toque o tecnología de asistencia, %s, el foco se queda donde estaba', (_via, origin) => {
      const { marker, close } = open(origin)

      expect(marker).toHaveFocus()
      expect(close).not.toHaveFocus()
    })

    it('el foco llega sin desplazar: la vista ya está en el detalle', () => {
      const focus = vi.spyOn(HTMLElement.prototype, 'focus')
      const { close } = open({ via: 'map', keyboard: true })

      const call = focus.mock.contexts.indexOf(close)
      expect(call).toBeGreaterThanOrEqual(0)
      expect(focus.mock.calls[call]).toEqual([{ preventScroll: true }])
    })

    it('con la tarjeta anclada junto a su marcador, el foco no se mueve aunque se abra con teclado', () => {
      const unanchor = anchorCard()
      try {
        const { marker, close } = open({ via: 'map', keyboard: true })

        expect(marker).toHaveFocus()
        expect(close).not.toHaveFocus()
      } finally {
        unanchor()
      }
    })

    it('al cambiar de lugar con teclado, el foco pasa a Cerrar del nuevo; con puntero, no', () => {
      const { view, marker } = open({ via: 'map', keyboard: false })
      expect(marker).toHaveFocus()

      screen.getByRole('button', { name: 'Jaca' }).focus()
      view.rerender(<SpainMap forecast={forecast([])} selectedLocationId="jaca" selectionOrigin={{ via: 'map', keyboard: true }} />)
      expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()

      marker.focus()
      view.rerender(<SpainMap forecast={forecast([])} selectedLocationId="gijon" selectionOrigin={{ via: 'map', keyboard: false }} />)
      expect(marker).toHaveFocus()
    })

    it('un cambio de origen sin cambio de selección no vuelve a llevar el foco', () => {
      const { view, marker } = open({ via: 'map', keyboard: false })
      marker.focus()

      view.rerender(<SpainMap forecast={forecast([])} selectedLocationId="gijon" selectionOrigin={{ via: 'list', keyboard: true }} />)

      expect(marker).toHaveFocus()
    })
  })

  // Al abrir, la página va al comienzo del detalle: desde el mapa, el mínimo
  // (`nearest`); desde la lista, alineando su borde superior (`start`), para que
  // una tarjeta más alta que la ventana visual no pierda su comienzo.
  describe('abrirla lleva la vista al comienzo del detalle', () => {
    let scrolled: { element: Element; options?: ScrollIntoViewOptions }[]
    const original = Element.prototype.scrollIntoView

    beforeEach(() => {
      scrolled = []
      Element.prototype.scrollIntoView = function (this: Element, options?: boolean | ScrollIntoViewOptions) {
        scrolled.push({ element: this, options: options as ScrollIntoViewOptions })
      }
    })

    afterEach(() => {
      Element.prototype.scrollIntoView = original
    })

    it.each([
      ['desde el mapa', { via: 'map', keyboard: false }, 'nearest'],
      ['desde el mapa, con teclado', { via: 'map', keyboard: true }, 'nearest'],
      ['desde la lista', { via: 'list', keyboard: false }, 'start'],
      ['desde la lista, con teclado', { via: 'list', keyboard: true }, 'start'],
    ] as const)('%s, una sola vez y con la alineación de su origen', (_via, origin, block) => {
      const view = render(<SpainMap forecast={forecast([])} />)

      view.rerender(<SpainMap forecast={forecast([])} selectedLocationId="gijon" selectionOrigin={origin} />)

      expect(scrolled).toEqual([{ element: screen.getByRole('region', { name: 'Gijón' }), options: { block, inline: 'start' } }])
    })

    it('un cambio de origen sin cambio de selección no vuelve a desplazar', () => {
      const view = render(<SpainMap forecast={forecast([])} selectedLocationId="gijon" selectionOrigin={{ via: 'map', keyboard: false }} />)
      scrolled.length = 0

      view.rerender(<SpainMap forecast={forecast([])} selectedLocationId="gijon" selectionOrigin={{ via: 'list', keyboard: false }} />)

      expect(scrolled).toEqual([])
    })

    it('con la tarjeta anclada junto a su marcador no desplaza, venga de donde venga', () => {
      const style = document.head.appendChild(document.createElement('style'))
      style.textContent = '.location-card { position: absolute; }'
      try {
        const view = render(<SpainMap forecast={forecast([])} />)

        view.rerender(<SpainMap forecast={forecast([])} selectedLocationId="gijon" selectionOrigin={{ via: 'list', keyboard: false }} />)

        expect(scrolled).toEqual([])
      } finally {
        style.remove()
      }
    })
  })

  // Escape (o Intro) en la fila con el detalle abierto lo cierra y deja el foco
  // en ella; Escape en el marcador, en él. Si la vista quedó lejos al ir al
  // detalle, se lleva a la vista; si no, no se mueve nada. Con la tarjeta
  // anclada no se toca.
  describe('cerrarla sin volver al origen deja a la vista lo que conserva el foco', () => {
    const VIEWPORT_HEIGHT = 800
    let scrolled: { element: Element; options?: ScrollIntoViewOptions }[]
    const original = Element.prototype.scrollIntoView

    beforeEach(() => {
      scrolled = []
      Element.prototype.scrollIntoView = function (this: Element, options?: boolean | ScrollIntoViewOptions) {
        scrolled.push({ element: this, options: options as ScrollIntoViewOptions })
      }
      Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: VIEWPORT_HEIGHT })
    })

    afterEach(() => {
      Element.prototype.scrollIntoView = original
      Reflect.deleteProperty(document.documentElement, 'clientHeight')
      vi.restoreAllMocks()
    })

    function closeWith({ top, bottom, focusRow = true, anchored = false }: { top: number; bottom: number; focusRow?: boolean; anchored?: boolean }) {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const [from, to] = this.id === 'row-gijon' ? [top, bottom] : [0, 0]
        return { top: from, y: from, bottom: to, left: 0, x: 0, right: 0, width: 0, height: to - from, toJSON: () => ({}) }
      })
      const style = document.head.appendChild(document.createElement('style'))
      if (anchored) style.textContent = '.location-card { position: absolute; }'

      const page = (selected: string | null) => (
        <>
          <SpainMap
            forecast={forecast([])}
            selectedLocationId={selected}
            selectionOrigin={{ via: 'list', keyboard: false }}
            findRow={() => screen.getByRole('button', { name: 'Fila de Gijón' })}
          />
          <button type="button" id="row-gijon">
            Fila de Gijón
          </button>
        </>
      )
      const view = render(page('gijon'))
      const row = screen.getByRole('button', { name: 'Fila de Gijón' })
      if (focusRow) row.focus()
      else screen.getByRole('button', { name: 'Gijón' }).focus()
      scrolled.length = 0

      view.rerender(page(null))
      style.remove()
      return row
    }

    it.each([
      ['entera fuera de la vista, por arriba', { top: -900, bottom: -850 }],
      ['entera fuera de la vista, por abajo', { top: 900, bottom: 950 }],
      ['cortada por el borde de arriba', { top: -20, bottom: 30 }],
      ['cortada por el borde de abajo', { top: 770, bottom: 820 }],
    ])('la fila que conserva el foco, %s, se lleva a la vista', (_where, box) => {
      const row = closeWith(box)

      expect(scrolled).toEqual([{ element: row, options: { block: 'center', inline: 'start' } }])
      expect(row).toHaveFocus()
    })

    it('la fila que ya se ve, entera, no se mueve', () => {
      closeWith({ top: 100, bottom: 150 })

      expect(scrolled).toEqual([])
    })

    it('si el foco no está en la fila, no se va a ella', () => {
      closeWith({ top: -900, bottom: -850, focusRow: false })

      expect(scrolled).toEqual([])
    })

    it('con la tarjeta anclada junto a su marcador no se mueve nada', () => {
      closeWith({ top: -900, bottom: -850, anchored: true })

      expect(scrolled).toEqual([])
    })

    // El marcador solo se lleva a la vista si el cierre fue con Escape en él.
    function closeFromMarker({ top, bottom, how, focused = true, anchored = false }: { top: number; bottom: number; how: 'Escape' | 'Enter' | 'filtro'; focused?: boolean; anchored?: boolean }) {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const [from, to] = this.classList.contains('location-marker') && this.getAttribute('aria-label') === 'Gijón' ? [top, bottom] : [0, 0]
        return { top: from, y: from, bottom: to, left: 0, x: 0, right: 0, width: 0, height: to - from, toJSON: () => ({}) }
      })
      const style = document.head.appendChild(document.createElement('style'))
      if (anchored) style.textContent = '.location-card { position: absolute; }'

      const view = render(<SpainMap forecast={forecast([])} selectedLocationId="gijon" />)
      const marker = screen.getByRole('button', { name: 'Gijón' })
      if (focused) marker.focus()
      scrolled.length = 0

      if (how !== 'filtro') fireEvent.keyDown(marker, { key: how })
      view.rerender(<SpainMap forecast={forecast([])} selectedLocationId={null} />)
      style.remove()
      return marker
    }

    it.each([
      ['entero fuera de la vista, por arriba', { top: -900, bottom: -850 }],
      ['entero fuera de la vista, por abajo', { top: 900, bottom: 950 }],
      ['cortado por el borde de arriba', { top: -20, bottom: 30 }],
      ['cortado por el borde de abajo', { top: 770, bottom: 820 }],
    ])('Escape en el marcador, %s: se lleva a la vista y conserva el foco', (_where, box) => {
      const marker = closeFromMarker({ ...box, how: 'Escape' })

      expect(scrolled).toEqual([{ element: marker, options: { block: 'center', inline: 'center' } }])
      expect(marker).toHaveFocus()
    })

    it('Escape en el marcador que ya se ve, entero, no lo mueve', () => {
      closeFromMarker({ top: 100, bottom: 150, how: 'Escape' })

      expect(scrolled).toEqual([])
    })

    it.each([
      ['Intro en el marcador', { how: 'Enter' }],
      ['un cierre que no pasa por el marcador (un filtro)', { how: 'filtro' }],
      ['Escape con el foco fuera del marcador', { how: 'Escape', focused: false }],
      ['Escape con la tarjeta anclada junto a su marcador', { how: 'Escape', anchored: true }],
    ] as const)('%s no lleva el marcador a la vista', (_how, options) => {
      closeFromMarker({ top: -900, bottom: -850, ...options })

      expect(scrolled).toEqual([])
    })

    it('un Escape que no llegó a cerrar nada no se arrastra al siguiente cierre', () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: -900, y: -900, bottom: -850, left: 0, x: 0, right: 0, width: 0, height: 50, toJSON: () => ({}) })
      const view = render(<SpainMap forecast={forecast([])} selectedLocationId="gijon" />)
      const gijon = screen.getByRole('button', { name: 'Gijón' })
      gijon.focus()
      // Quien aloja el mapa no cierra: la selección sigue, y después cambia de lugar.
      fireEvent.keyDown(gijon, { key: 'Escape' })
      view.rerender(<SpainMap forecast={forecast([])} selectedLocationId="jaca" />)
      screen.getByRole('button', { name: 'Jaca' }).focus()
      scrolled.length = 0

      view.rerender(<SpainMap forecast={forecast([])} selectedLocationId={null} />)

      expect(scrolled).toEqual([])
    })
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

  it('el dibujo y la atribución van juntos en un único envoltorio, el único hijo del mapa', () => {
    const { container } = render(<SpainMap forecast={forecast([])} />)

    const body = container.querySelector('.spain-map__body')
    expect([...container.querySelector('.spain-map')!.children]).toEqual([body])
    expect([...body!.children]).toEqual([container.querySelector('.spain-map__drawing'), container.querySelector('.spain-map__attribution')])
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

  // La selección llega a las dos capas de sprites, la del mapa y la del
  // recuadro de Canarias, y no desmonta ningún marcador.
  it.each([
    ['en el mapa principal', 'madrid'],
    ['en el recuadro de Canarias', views.find((view) => view.region === 'canary' && view.pokemonId !== null)!.id],
  ])('con un lugar seleccionado %s, solo su sprite conserva el color y los 74 marcadores siguen montados', (_where, selectedId) => {
    const { container } = render(<SpainMap forecast={today} selectedLocationId={selectedId} />)

    const selected = views.find((view) => view.id === selectedId)!
    const inColor = sprites(container).filter((sprite) => !sprite.silhouette)
    expect(inColor).toHaveLength(1)
    expect(inColor[0].place).toContain(`translate(${selected.x}, ${selected.y})`)
    expect(sprites(container).filter((sprite) => sprite.silhouette)).toHaveLength(withSprite(ALL) - 1)
    expect(container.querySelectorAll('.location-marker')).toHaveLength(74)
  })
})
