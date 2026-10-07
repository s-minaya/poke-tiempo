import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

import type { ForecastFreshness } from '../../domain/forecast-freshness.ts'
import type { Forecast } from '../../domain/types.ts'

import { COUNT_ANNOUNCEMENT_DELAY_MS } from '../LocationList/components/count-text.ts'

import WeatherApp from './WeatherApp.tsx'

import forecastData from '../../data/forecast.json'

// La frescura llega como prop: estos tests no dependen del reloj. MAÑANA es
// el estado con el que el pipeline publica cada `forecast.json`.
const TOMORROW: ForecastFreshness = { status: 'tomorrow', daysLate: 0 }

// Marcador y fila comparten el nombre del lugar: cada test busca en la vía
// que ejerce.
function map() {
  return within(screen.getByRole('group', { name: /Mapa de España/ }))
}

function list() {
  return within(screen.getByRole('region', { name: 'Todos los lugares' }))
}

describe('WeatherApp', () => {
  it('renders without crashing', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    expect(screen.getByRole('heading', { name: 'POKETIEMPO' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('sin filtros, el mapa es el de la 008: 74 marcadores operables y ninguno en sombra', () => {
    const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    expect(map().getAllByRole('button')).toHaveLength(74)
    expect(container.querySelectorAll('.location-marker--dimmed')).toHaveLength(0)
  })

  it('activar un marcador abre su tarjeta, y activarlo otra vez la cierra', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    const gijon = map().getByRole('button', { name: /^Gijón/ })
    fireEvent.click(gijon)

    expect(screen.getByRole('region', { name: 'Gijón' })).toBeInTheDocument()
    expect(gijon).toHaveAttribute('aria-pressed', 'true')

    fireEvent.keyDown(gijon, { key: 'Enter' })

    expect(screen.queryByRole('region', { name: 'Gijón' })).not.toBeInTheDocument()
    expect(gijon).toHaveAttribute('aria-pressed', 'false')
  })

  it('activar otro lugar cambia la tarjeta en vez de abrir una segunda', () => {
    const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    fireEvent.click(map().getByRole('button', { name: /^Gijón/ }))
    fireEvent.click(map().getByRole('button', { name: /^Jaca/ }))

    // Por clase y no por rol: la leyenda también es una región con nombre.
    expect(container.querySelectorAll('.location-card')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Jaca' })).toHaveTextContent('Huesca')
    expect(map().getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('Escape sobre un marcador cierra la tarjeta y deja el foco donde estaba', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    const gijon = map().getByRole('button', { name: /^Gijón/ })
    fireEvent.click(gijon)
    const oviedo = map().getByRole('button', { name: /^Oviedo/ })
    oviedo.focus()
    fireEvent.keyDown(oviedo, { key: 'Escape' })

    expect(screen.queryByRole('region', { name: 'Gijón' })).not.toBeInTheDocument()
    expect(oviedo).toHaveFocus()
  })

  it('equivalencia: para cada uno de los 74 lugares, su fila y su marcador producen exactamente el mismo resultado', () => {
    const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    const markers = map().getAllByRole('button')
    const rows = list().getAllByRole('button')
    const markerByName = new Map(markers.map((marker) => [marker.getAttribute('aria-label')!.split(',')[0], marker]))
    const rowByName = new Map(rows.map((row) => [row.querySelector('.location-list__name')!.textContent!, row]))
    expect(markerByName.size).toBe(74)
    expect([...rowByName.keys()].sort()).toEqual([...markerByName.keys()].sort())

    // Todo lo que un usuario puede percibir de la selección, venga de donde
    // venga: qué marcador está pulsado, qué fila está pulsada, qué dice la
    // tarjeta y qué se anuncia.
    function outcome() {
      return {
        pressedMarkers: markers.filter((marker) => marker.getAttribute('aria-pressed') === 'true').map((marker) => marker.getAttribute('aria-label')),
        pressedRows: rows.filter((row) => row.getAttribute('aria-pressed') === 'true').map((row) => row.textContent),
        card: container.querySelector('.location-card')?.textContent ?? null,
        announcement: container.querySelector('[aria-live="polite"]')!.textContent,
      }
    }

    for (const [name, marker] of markerByName) {
      const row = rowByName.get(name)!

      fireEvent.click(marker)
      const viaMarker = outcome()
      fireEvent.click(marker)

      fireEvent.click(row)
      const viaRow = outcome()
      fireEvent.click(row)

      expect(viaRow).toEqual(viaMarker)
      expect(viaMarker.pressedMarkers).toEqual([marker.getAttribute('aria-label')])
      expect(viaMarker.pressedRows).toEqual([row.textContent])
      expect(viaMarker.card).toContain(name)
    }

    // Y cada ida y vuelta deja todo como estaba.
    expect(outcome()).toEqual({ pressedMarkers: [], pressedRows: [], card: null, announcement: '' })
    // Exhaustivo a propósito —74 lugares, cuatro activaciones cada uno sobre
    // la aplicación entera—: con la suite en paralelo pasa de los 5 s por
    // defecto. Una muestra dejaría sin comprobar justo el lugar que falle.
  }, 30_000)

  it('la alternancia cruza las vías: lo abierto desde el marcador se cierra desde su fila, y al revés', () => {
    const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
    // Marcador y fila siguen montados al seleccionar: se buscan una vez. La
    // fila, por ser la pulsada, sin calcular el nombre de las otras 73.
    const marker = map().getByRole('button', { name: /^Jaca/ })
    fireEvent.click(marker)
    const row = list().getByRole('button', { pressed: true })
    expect(row).toHaveAccessibleName(/^Jaca/)

    fireEvent.click(row)
    expect(container.querySelector('.location-card')).not.toBeInTheDocument()

    fireEvent.click(row)
    fireEvent.click(marker)
    expect(container.querySelector('.location-card')).not.toBeInTheDocument()
  })

  it('abierta desde una fila, cerrarla desde la tarjeta devuelve el foco a esa fila, no al mapa', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    const row = list().getByRole('button', { name: /^Jaca/ })
    row.focus()
    fireEvent.click(row)
    const close = within(screen.getByRole('region', { name: 'Jaca' })).getByRole('button', { name: 'Cerrar' })
    close.focus()
    fireEvent.click(close)

    expect(screen.queryByRole('region', { name: 'Jaca' })).not.toBeInTheDocument()
    expect(row).toHaveFocus()
  })

  it('abierta desde un marcador, cerrarla desde la tarjeta devuelve el foco a ese marcador', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    const marker = map().getByRole('button', { name: /^Jaca/ })
    marker.focus()
    fireEvent.keyDown(marker, { key: 'Enter' })
    const close = within(screen.getByRole('region', { name: 'Jaca' })).getByRole('button', { name: 'Cerrar' })
    close.focus()
    fireEvent.click(close)

    expect(screen.queryByRole('region', { name: 'Jaca' })).not.toBeInTheDocument()
    expect(marker).toHaveFocus()
  })

  it('Tab no toca la selección: ni sobre el marcador, ni sobre la fila, ni dentro de la tarjeta', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    const marker = map().getByRole('button', { name: /^Jaca/ })
    fireEvent.click(marker)
    const row = list().getByRole('button', { pressed: true })
    const close = within(screen.getByRole('region', { name: 'Jaca' })).getByRole('button', { name: 'Cerrar' })

    for (const element of [marker, row, close]) fireEvent.keyDown(element, { key: 'Tab' })

    expect(screen.getByRole('region', { name: 'Jaca' })).toBeInTheDocument()
    expect(marker).toHaveAttribute('aria-pressed', 'true')
    expect(row).toHaveAttribute('aria-pressed', 'true')
  })

  it('al seleccionar, lleva a la vista lo que se activó, aunque un toque no lo enfoque', () => {
    // jsdom no implementa `scrollIntoView`: se anota a quién se le pide.
    const original = Element.prototype.scrollIntoView
    const revealed: Element[] = []
    Element.prototype.scrollIntoView = function (this: Element) {
      revealed.push(this)
    }
    try {
      render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

      const row = list().getByRole('button', { name: /^Jaca/ })
      fireEvent.click(row)
      expect(row).not.toHaveFocus()
      expect(revealed).toEqual([row])

      // Cerrar no mueve nada.
      fireEvent.click(row)
      expect(revealed).toEqual([row])

      const marker = map().getByRole('button', { name: /^Jaca/ })
      fireEvent.keyDown(marker, { key: 'Enter' })
      expect(revealed).toEqual([row, marker])
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it('el orden de tabulación es el del DOM: ningún tabindex positivo, y los 74 marcadores enfocables', () => {
    const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    const positive = [...container.querySelectorAll('[tabindex]')].filter((element) => Number(element.getAttribute('tabindex')) > 0)
    expect(positive).toEqual([])

    const markers = [...container.querySelectorAll('.location-marker')]
    expect(markers).toHaveLength(74)
    expect(markers.every((marker) => marker.getAttribute('tabindex') === '0')).toBe(true)
  })
})

describe('WeatherApp — la leyenda filtra', () => {
  function legend() {
    return within(screen.getByRole('region', { name: 'Leyenda' }))
  }

  // Lo que se puede hacer ahora mismo con cada vía: los lugares con marcador
  // operable y los lugares con fila.
  function operableMarkers() {
    return map()
      .queryAllByRole('button')
      .map((marker) => marker.getAttribute('aria-label')!.split(',')[0])
      .sort()
  }
  // Solo las filas: la región también tiene los filtros activos y «Limpiar filtros».
  function visibleRows() {
    return [...screen.getByRole('region', { name: 'Todos los lugares' }).querySelectorAll('.location-list__row')]
      .map((row) => row.querySelector('.location-list__name')!.textContent!)
      .sort()
  }

  // Pulsa y suelta en la leyenda hasta dejar pulsadas exactamente estas.
  function press(labels: string[]) {
    for (const entry of legend().getAllByRole('button')) {
      const shouldBe = labels.includes(entry.textContent!)
      if ((entry.getAttribute('aria-pressed') === 'true') !== shouldBe) fireEvent.click(entry)
    }
  }

  it('equivalencia: con cualquier combinación de condiciones, los marcadores operables son exactamente las filas visibles', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
    const labels = legend()
      .getAllByRole('button')
      .map((entry) => entry.textContent!)
    expect(labels.length).toBeGreaterThan(1)

    const combinations = [
      [],
      ...labels.map((label) => [label]),
      ...labels.slice(1).map((label, index) => [labels[index], label]),
      labels.filter((_, index) => index % 2 === 0),
      labels,
      [],
    ]
    for (const combination of combinations) {
      press(combination)

      const markers = operableMarkers()
      expect(markers).toEqual(visibleRows())
      expect(legend().queryAllByRole('button', { pressed: true }).map((entry) => entry.textContent)).toEqual(labels.filter((label) => combination.includes(label)))
      // Sin filtros, los 74; con alguna condición, al menos un lugar por cada una.
      expect(markers.length).toBeGreaterThanOrEqual(combination.length === 0 ? 74 : combination.length)
      expect(markers.length).toBeLessThanOrEqual(74)
    }
  }, 30_000)

  it('pulsar una condición deja operables solo sus lugares, y soltarla devuelve los 74', () => {
    const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
    const first = legend().getAllByRole('button')[0]

    fireEvent.click(first)
    const operable = operableMarkers().length
    expect(operable).toBeLessThan(74)
    expect(container.querySelectorAll('.location-marker--dimmed')).toHaveLength(74 - operable)

    fireEvent.click(first)
    expect(operableMarkers()).toHaveLength(74)
    expect(container.querySelectorAll('.location-marker--dimmed')).toHaveLength(0)
  })

  it('una condición que excluye el lugar seleccionado cierra su tarjeta y suelta fila y marcador en la misma actualización', () => {
    const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    const madrid = map().getByRole('button', { name: /^Madrid,/ })
    fireEvent.click(madrid)
    expect(screen.getByRole('region', { name: 'Madrid' })).toBeInTheDocument()
    const madridCondition = container.querySelector('.location-card')!.textContent!

    // Una condición del día que no es la de Madrid.
    const other = legend()
      .getAllByRole('button')
      .find((entry) => !madridCondition.includes(entry.textContent!))!
    fireEvent.click(other)

    // Un solo evento: tarjeta, fila y marcador cambian a la vez.
    expect(screen.queryByRole('region', { name: 'Madrid' })).not.toBeInTheDocument()
    expect(container.querySelector('.location-card')).not.toBeInTheDocument()
    expect(map().queryByRole('button', { name: /^Madrid,/ })).not.toBeInTheDocument()
    expect(list().queryByRole('button', { name: /^Madrid/ })).not.toBeInTheDocument()
    expect(container.querySelector('[aria-live="polite"]')!.textContent).toBe('')

    // Soltarla no la vuelve a abrir: la selección se anuló, no se escondió.
    fireEvent.click(other)
    expect(container.querySelector('.location-card')).not.toBeInTheDocument()
    expect(map().getByRole('button', { name: /^Madrid,/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('una condición que incluye el lugar seleccionado lo deja abierto', () => {
    const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    fireEvent.click(map().getByRole('button', { name: /^Madrid,/ }))
    const madridCondition = container.querySelector('.location-card')!.textContent!
    const own = legend()
      .getAllByRole('button')
      .find((entry) => madridCondition.includes(entry.textContent!))!
    fireEvent.click(own)

    expect(screen.getByRole('region', { name: 'Madrid' })).toBeInTheDocument()
    expect(map().getByRole('button', { name: /^Madrid,/ })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('WeatherApp — buscar, zona y ordenar', () => {
  function searchbox() {
    return screen.getByRole('searchbox', { name: 'Buscar' })
  }
  function zone() {
    return screen.getByRole('combobox', { name: 'Zona' })
  }
  function rowNames() {
    return [...screen.getByRole('region', { name: 'Todos los lugares' }).querySelectorAll('.location-list__row')].map(
      (row) => row.querySelector('.location-list__name')!.textContent!,
    )
  }
  function operableNames() {
    return map()
      .queryAllByRole('button')
      .map((marker) => marker.getAttribute('aria-label')!.split(',')[0])
      .sort()
  }
  // Dentro de su propia lista: en todo el documento entrarían en la búsqueda
  // los nombres de los 74 marcadores y las 74 filas.
  function chips() {
    const active = screen.queryByRole('list', { name: 'Filtros activos' })
    return active ? within(active).getAllByRole('button', { name: /quitar filtro$/ }).map((chip) => chip.textContent) : []
  }
  function card() {
    return document.querySelector('.location-card')
  }
  function checkedOrder() {
    return (screen.getAllByRole('radio') as HTMLInputElement[]).find((radio) => radio.checked)!.value
  }

  it('equivalencia: con búsqueda y zona, los marcadores operables son exactamente las filas visibles', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
    const firstCondition = within(screen.getByRole('region', { name: 'Leyenda' })).getAllByRole('button')[0]

    const steps: [string, () => void][] = [
      ['búsqueda por nombre', () => fireEvent.change(searchbox(), { target: { value: 'coruña' } })],
      ['búsqueda sin tildes de una zona', () => fireEvent.change(searchbox(), { target: { value: 'andalucia' } })],
      ['búsqueda de dos palabras', () => fireEvent.change(searchbox(), { target: { value: 'castilla leon' } })],
      ['búsqueda sin resultados', () => fireEvent.change(searchbox(), { target: { value: 'zzz' } })],
      ['sin búsqueda, una zona', () => (fireEvent.change(searchbox(), { target: { value: '' } }), fireEvent.change(zone(), { target: { value: 'Galicia' } }))],
      ['Toda España', () => fireEvent.change(zone(), { target: { value: 'ES' } })],
      ['Portugal', () => fireEvent.change(zone(), { target: { value: 'Portugal' } })],
      ['Andorra', () => fireEvent.change(zone(), { target: { value: 'Andorra' } })],
      ['Toda España y una condición', () => (fireEvent.change(zone(), { target: { value: 'ES' } }), fireEvent.click(firstCondition))],
      ['los tres filtros', () => fireEvent.change(searchbox(), { target: { value: 'a' } })],
      ['todas las zonas', () => fireEvent.change(zone(), { target: { value: '' } })],
    ]
    for (const [, step] of steps) {
      step()
      expect(operableNames()).toEqual([...rowNames()].sort())
    }
  }, 30_000)

  it('los resultados cambian al instante, con cada tecla; el anuncio espera medio segundo', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
      const live = () => [...container.querySelectorAll('[aria-live="polite"]')].map((region) => region.textContent).join('|')
      const before = live()

      fireEvent.change(searchbox(), { target: { value: 'gij' } })
      expect(rowNames()).toEqual(['Gijón'])
      expect(operableNames()).toEqual(['Gijón'])
      expect(screen.getByText('1 de 74 lugares')).toBeInTheDocument()
      expect(live()).toBe(before)

      act(() => vi.advanceTimersByTime(COUNT_ANNOUNCEMENT_DELAY_MS))
      expect(live()).toContain('1 de 74 lugares')
    } finally {
      vi.useRealTimers()
    }
  })

  it('buscar no selecciona nada por su cuenta, aunque quede un solo resultado', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    fireEvent.change(searchbox(), { target: { value: 'gijón' } })

    expect(rowNames()).toEqual(['Gijón'])
    expect(card()).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  it('Escape en el buscador vacía solo la búsqueda: zona, condición, orden y selección siguen', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
    fireEvent.change(zone(), { target: { value: 'ES' } })
    fireEvent.click(screen.getByRole('radio', { name: /A–Z/ }))
    fireEvent.change(searchbox(), { target: { value: 'gijón' } })
    fireEvent.click(list().getByRole('button', { name: /^Gijón/ }))

    fireEvent.keyDown(searchbox(), { key: 'Escape' })

    expect(searchbox()).toHaveValue('')
    expect(zone()).toHaveValue('ES')
    expect(checkedOrder()).toBe('name')
    expect(screen.getByRole('region', { name: 'Gijón' })).toBeInTheDocument()
    expect(chips()).toEqual(['Zona: Toda España'])
  })

  it('el orden no es un filtro: no crea pastilla ni cambia el recuento', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    fireEvent.click(screen.getByRole('radio', { name: /Más calor/ }))

    expect(chips()).toEqual([])
    expect(screen.getByText('74 lugares')).toBeInTheDocument()
    expect(screen.queryByText('Limpiar filtros')).not.toBeInTheDocument()
    expect(map().getAllByRole('button')).toHaveLength(74)
  })

  it('cambiar el orden no afecta a la selección', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
    fireEvent.click(map().getByRole('button', { name: /^Jaca,/ }))

    for (const label of [/A–Z/, /Más calor/, /Más frío/, /Zona/]) {
      fireEvent.click(screen.getByRole('radio', { name: label }))
      expect(screen.getByRole('region', { name: 'Jaca' })).toBeInTheDocument()
      // Por la fila pulsada, no por nombre: reordenar rehace las 74 filas, y
      // buscar por nombre volvería a calcular el de todas en cada vuelta.
      const pressed = list().getAllByRole('button', { pressed: true })
      expect(pressed).toHaveLength(1)
      expect(pressed[0]).toHaveAccessibleName(/^Jaca/)
    }
  })

  it('«Limpiar filtros» quita los tres, conserva el orden y lleva el foco al buscador', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
    fireEvent.click(screen.getByRole('radio', { name: /Más frío/ }))
    fireEvent.change(searchbox(), { target: { value: 'a' } })
    fireEvent.change(zone(), { target: { value: 'ES' } })
    fireEvent.click(within(screen.getByRole('region', { name: 'Leyenda' })).getAllByRole('button')[0])

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(chips()).toEqual([])
    expect(searchbox()).toHaveValue('')
    expect(zone()).toHaveValue('')
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(checkedOrder()).toBe('coldest')
    expect(searchbox()).toHaveFocus()
    expect(rowNames()).toHaveLength(74)
  })

  it('sin resultados, los controles y los filtros activos siguen a mano, y el estado vacío deja empezar de cero', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
    fireEvent.change(searchbox(), { target: { value: 'zzz' } })

    expect(screen.getByRole('heading', { name: 'Ni rastro por aquí' })).toBeInTheDocument()
    expect(map().queryAllByRole('button')).toHaveLength(0)
    expect(zone()).toBeEnabled()
    expect(screen.getByRole('button', { name: '“zzz”, quitar filtro' })).toBeInTheDocument()

    fireEvent.click(within(document.querySelector<HTMLElement>('.empty-results')!).getByRole('button', { name: 'Limpiar filtros' }))

    expect(screen.queryByRole('heading', { name: 'Ni rastro por aquí' })).not.toBeInTheDocument()
    expect(searchbox()).toHaveFocus()
    expect(map().getAllByRole('button')).toHaveLength(74)
  })

  describe('al quitar una pastilla, el foco', () => {
    // Condición, zona y búsqueda: tres pastillas, en ese orden.
    function withThreeChips() {
      render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
      fireEvent.click(within(screen.getByRole('region', { name: 'Leyenda' })).getAllByRole('button')[0])
      fireEvent.change(zone(), { target: { value: 'ES' } })
      fireEvent.change(searchbox(), { target: { value: 'a' } })
      const all = screen.getAllByRole('button', { name: /quitar filtro$/ })
      expect(all).toHaveLength(3)
      return all.map((chip) => chip.textContent!)
    }
    function chip(text: string) {
      return screen.getByRole('button', { name: `${text}, quitar filtro` })
    }

    it('pasa a la siguiente al quitar la primera', () => {
      const [condition, zoneChip] = withThreeChips()
      fireEvent.click(chip(condition))
      expect(chip(zoneChip)).toHaveFocus()
    })

    it('pasa a la siguiente al quitar una intermedia', () => {
      const [, zoneChip, query] = withThreeChips()
      fireEvent.click(chip(zoneChip))
      expect(chip(query)).toHaveFocus()
    })

    it('pasa a la anterior al quitar la última', () => {
      const [, zoneChip, query] = withThreeChips()
      fireEvent.click(chip(query))
      expect(chip(zoneChip)).toHaveFocus()
    })

    it('va al buscador al quitar la única que quedaba', () => {
      render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
      fireEvent.change(zone(), { target: { value: 'Galicia' } })

      fireEvent.click(chip('Zona: Galicia'))

      expect(chips()).toEqual([])
      expect(searchbox()).toHaveFocus()
    })
  })

  it('un filtro que excluye el lugar seleccionado cierra su tarjeta, y limpiar los filtros no la devuelve', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)
    fireEvent.click(map().getByRole('button', { name: /^Gijón,/ }))

    fireEvent.change(zone(), { target: { value: 'Andalucía' } })
    expect(card()).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(card()).not.toBeInTheDocument()
    expect(map().getByRole('button', { name: /^Gijón,/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('flujo: seleccionar → buscar sin perderlo → reordenar → excluirlo por zona → limpiar filtros', () => {
    render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    // Seleccionar desde el mapa.
    fireEvent.click(map().getByRole('button', { name: /^Sevilla,/ }))
    expect(screen.getByRole('region', { name: 'Sevilla' })).toBeInTheDocument()

    // Una búsqueda que lo sigue incluyendo: la tarjeta sigue abierta.
    fireEvent.change(searchbox(), { target: { value: 'andalucia' } })
    expect(rowNames()).toContain('Sevilla')
    expect(screen.getByRole('region', { name: 'Sevilla' })).toBeInTheDocument()
    expect(list().getByRole('button', { name: /^Sevilla/ })).toHaveAttribute('aria-pressed', 'true')

    // Reordenar no toca ni la selección ni los filtros.
    fireEvent.click(screen.getByRole('radio', { name: /Más calor/ }))
    expect(screen.getByRole('region', { name: 'Sevilla' })).toBeInTheDocument()
    expect(chips()).toEqual(['“andalucia”'])

    // Una zona que lo excluye: tarjeta, fila y marcador desaparecen a la vez.
    fireEvent.change(zone(), { target: { value: 'Galicia' } })
    expect(card()).not.toBeInTheDocument()
    expect(rowNames()).not.toContain('Sevilla')
    expect(map().queryByRole('button', { name: /^Sevilla,/ })).not.toBeInTheDocument()

    // Limpiar: vuelven los 74, el orden se queda y la selección no reaparece.
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0])
    expect(rowNames()).toHaveLength(74)
    expect(map().getAllByRole('button')).toHaveLength(74)
    expect(checkedOrder()).toBe('warmest')
    expect(card()).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  it('«Saltar al buscador» es lo primero que se enfoca y lleva al buscador', () => {
    const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={TOMORROW} offerReload={false} />)

    const skip = screen.getByRole('link', { name: 'Saltar al buscador' })
    expect(container.querySelector('a, button, input, select, [tabindex]')).toBe(skip)
    expect(skip).toHaveAttribute('href', `#${searchbox().id}`)
  })

  describe('aviso de frescura', () => {
    // Por clase: comprobar por rol en todo el documento calcularía el nombre
    // de cada marcador y cada fila.
    it.each([
      { status: 'tomorrow', daysLate: 0, offerReload: false, mounted: false },
      { status: 'today', daysLate: 0, offerReload: false, mounted: false },
      { status: 'late', daysLate: 1, offerReload: false, mounted: false },
      { status: 'unknown', daysLate: 0, offerReload: false, mounted: false },
      { status: 'very-late', daysLate: 2, offerReload: false, mounted: true },
      { status: 'late', daysLate: 1, offerReload: true, mounted: true },
      { status: 'very-late', daysLate: 2, offerReload: true, mounted: true },
    ] as const)('$status, con oferta de recargar: $offerReload → en el DOM: $mounted', ({ status, daysLate, offerReload, mounted }) => {
      const { container } = render(<WeatherApp forecast={forecastData as Forecast} freshness={{ status, daysLate }} offerReload={offerReload} />)

      expect(container.querySelector('.freshness-notice') !== null).toBe(mounted)
    })

    it('va entre la cabecera y el contenido', () => {
      const { container } = render(
        <WeatherApp forecast={forecastData as Forecast} freshness={{ status: 'very-late', daysLate: 2 }} offerReload={false} />,
      )

      const notice = container.querySelector('.freshness-notice')!
      expect(notice.previousElementSibling).toBe(container.querySelector('.header'))
      expect(notice.nextElementSibling).toBe(container.querySelector('.legend'))
    })
  })
})
