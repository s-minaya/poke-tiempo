import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import type { LocationView } from '../../../domain/location-views.ts'
import MarkerLayers from './MarkerLayers.tsx'

const LOCATIONS: LocationView[] = [
  { id: 'granada', name: 'Granada', x: 10, y: 20, region: 'main', pokemonId: 'zapdos', minC: 8, maxC: 23 },
  { id: 'madrid', name: 'Madrid', x: 40, y: 50, region: 'main', pokemonId: 'castform', minC: 11, maxC: 20 },
  { id: 'gijon', name: 'Gijón', x: 70, y: 80, region: 'main', pokemonId: null, minC: null, maxC: null },
]

function layers(props: Partial<Parameters<typeof MarkerLayers>[0]> = {}) {
  return render(
    <svg>
      <MarkerLayers locations={LOCATIONS} {...props} />
    </svg>,
  )
}

const spriteLayer = (container: HTMLElement) => container.querySelector('.marker-layers__sprites')!
const sprites = (container: HTMLElement) => [...spriteLayer(container).querySelectorAll('image')]

describe('MarkerLayers', () => {
  it('pinta primero todos los sprites, en una capa decorativa, y después los marcadores', () => {
    const { container } = layers()

    const children = [...container.querySelector('svg')!.children]
    expect(children[0]).toBe(spriteLayer(container))
    expect(children.slice(1).every((child) => child.classList.contains('location-marker'))).toBe(true)
    expect(children).toHaveLength(1 + LOCATIONS.length)

    expect(spriteLayer(container)).toHaveAttribute('aria-hidden', 'true')
    expect(spriteLayer(container).querySelectorAll('[tabindex], [role], title, text')).toHaveLength(0)
    expect(container.querySelectorAll('.location-marker image')).toHaveLength(0)
  })

  it('un sprite por lugar con Pokémon, en el orden de los lugares, en su punto y del lado del sprite', () => {
    const { container } = layers()

    const markers = [...container.querySelectorAll('.location-marker')]
    expect(sprites(container).map((sprite) => sprite.getAttribute('href'))).toEqual([expect.stringContaining('zapdos'), expect.stringContaining('castform')])
    sprites(container).forEach((sprite, index) => {
      expect(sprite).toHaveAttribute('transform', markers[index].getAttribute('transform')!)
      expect(sprite).toHaveAttribute('x', '-31')
      expect(sprite).toHaveAttribute('y', '-31')
      expect(sprite).toHaveAttribute('width', '62')
      expect(sprite).toHaveAttribute('height', '62')
      expect(sprite).not.toHaveAttribute('filter')
    })
  })

  it('sin filtros, un marcador operable por lugar, en el orden de los lugares', () => {
    layers()

    expect(screen.getAllByRole('button').map((marker) => marker.getAttribute('aria-label'))).toEqual([
      'Granada, mínima 8 grados, máxima 23 grados',
      'Madrid, mínima 11 grados, máxima 20 grados',
      'Gijón',
    ])
  })

  it('pasa la selección al marcador de su lugar', () => {
    layers({ selectedLocationId: 'madrid' })

    expect(screen.getByRole('button', { name: /^Madrid/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })
})

describe('MarkerLayers en sombra', () => {
  it('el lugar no monta marcador: ni botón, ni foco, ni nombre, ni cifras', () => {
    const { container } = layers({ matchingIds: new Set(['madrid']) })

    expect(screen.getAllByRole('button').map((marker) => marker.getAttribute('aria-label'))).toEqual(['Madrid, mínima 11 grados, máxima 20 grados'])
    expect(container.querySelectorAll('.location-marker')).toHaveLength(1)
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(1)
    expect(container.querySelectorAll('title')).toHaveLength(1)
  })

  it('su sprite se queda en la capa, en la misma posición y al mismo tamaño, pasado por el filtro de silueta', () => {
    const { container: normal } = layers()
    const { container: filtered } = layers({ matchingIds: new Set(['madrid']) })

    const attributes = (sprite: Element) => ['href', 'transform', 'x', 'y', 'width', 'height'].map((attribute) => sprite.getAttribute(attribute))
    expect(sprites(filtered).map(attributes)).toEqual(sprites(normal).map(attributes))
    expect(sprites(filtered).map((sprite) => sprite.getAttribute('filter'))).toEqual(['url(#location-marker-silhouette)', null])
  })

  it('con todos en sombra, todas las siluetas y ningún marcador', () => {
    const { container } = layers({ matchingIds: new Set() })

    expect(container.querySelectorAll('.location-marker')).toHaveLength(0)
    expect(sprites(container)).toHaveLength(2)
    expect(sprites(container).every((sprite) => sprite.getAttribute('filter') === 'url(#location-marker-silhouette)')).toBe(true)
  })

  it('deja de ser destino del foco, y vuelve a serlo al coincidir de nuevo', () => {
    const registerMarker = vi.fn()
    const { rerender } = render(
      <svg>
        <MarkerLayers locations={LOCATIONS} registerMarker={registerMarker} />
      </svg>,
    )
    expect(registerMarker).toHaveBeenCalledWith('granada', expect.any(SVGGElement))

    registerMarker.mockClear()
    rerender(
      <svg>
        <MarkerLayers locations={LOCATIONS} matchingIds={new Set(['madrid', 'gijon'])} registerMarker={registerMarker} />
      </svg>,
    )
    expect(registerMarker).toHaveBeenCalledTimes(1)
    expect(registerMarker).toHaveBeenCalledWith('granada', null)

    registerMarker.mockClear()
    rerender(
      <svg>
        <MarkerLayers locations={LOCATIONS} matchingIds={null} registerMarker={registerMarker} />
      </svg>,
    )
    expect(registerMarker).toHaveBeenCalledTimes(1)
    expect(registerMarker).toHaveBeenCalledWith('granada', expect.any(SVGGElement))
    expect(screen.getByRole('button', { name: /^Granada/ })).toBeInTheDocument()
  })
})

// Dos causas distintas dan la misma silueta: estar en sombra por los filtros
// (sin marcador) y no ser el lugar seleccionado (con marcador operable).
describe('MarkerLayers — silueta por selección', () => {
  type Props = Partial<Parameters<typeof MarkerLayers>[0]>

  const SILHOUETTE = 'url(#location-marker-silhouette)'
  const GRANADA = 'Granada, mínima 8 grados, máxima 23 grados'
  const MADRID = 'Madrid, mínima 11 grados, máxima 20 grados'
  const GIJON = 'Gijón'

  // El filtro de los dos sprites que hay (Gijón no tiene Pokémon), en el orden de los lugares.
  const filters = (container: HTMLElement) => sprites(container).map((sprite) => sprite.getAttribute('filter'))
  const buttons = () => screen.getAllByRole('button').map((marker) => marker.getAttribute('aria-label'))

  it.each<[string, Props, (string | null)[], string[]]>([
    ['sin selección ni filtros, todos en color', {}, [null, null], [GRANADA, MADRID, GIJON]],
    ['el seleccionado conserva el color y el resto va en silueta', { selectedLocationId: 'granada' }, [null, SILHOUETTE], [GRANADA, MADRID, GIJON]],
    ['si el seleccionado es otro, esos dos pasan a silueta', { selectedLocationId: 'gijon' }, [SILHOUETTE, SILHOUETTE], [GRANADA, MADRID, GIJON]],
    ['excluido por los filtros, silueta y sin marcador', { matchingIds: new Set(['madrid', 'gijon']) }, [SILHOUETTE, null], [MADRID, GIJON]],
    [
      'excluido con otro seleccionado, ambos en silueta y solo el excluido sin marcador',
      { matchingIds: new Set(['madrid', 'gijon']), selectedLocationId: 'gijon' },
      [SILHOUETTE, SILHOUETTE],
      [MADRID, GIJON],
    ],
  ])('%s', (_name, props, expectedFilters, expectedButtons) => {
    const { container } = layers(props)

    expect(filters(container)).toEqual(expectedFilters)
    expect(buttons()).toEqual(expectedButtons)
  })

  it('un lugar en silueta por la selección sigue con su marcador, enfocable y operable', () => {
    const onActivateLocation = vi.fn()
    const { container } = layers({ selectedLocationId: 'granada', onActivateLocation })
    expect(filters(container)).toEqual([null, SILHOUETTE])

    const madrid = screen.getByRole('button', { name: MADRID })
    expect(madrid).toHaveAttribute('tabindex', '0')
    madrid.focus()
    expect(madrid).toHaveFocus()

    fireEvent.click(madrid)
    fireEvent.keyDown(madrid, { key: 'Enter' })

    expect(onActivateLocation.mock.calls).toEqual([
      ['madrid', false],
      ['madrid', true],
    ])
  })

  it('cambiar de lugar intercambia color y silueta, y cerrar los devuelve salvo a los excluidos', () => {
    const { container, rerender } = layers()
    const steps: [Props, (string | null)[]][] = [
      [{ selectedLocationId: 'granada' }, [null, SILHOUETTE]],
      [{ selectedLocationId: 'madrid' }, [SILHOUETTE, null]],
      [{ selectedLocationId: null }, [null, null]],
      [{ selectedLocationId: null, matchingIds: new Set(['madrid', 'gijon']) }, [SILHOUETTE, null]],
    ]

    for (const [props, expected] of steps) {
      rerender(
        <svg>
          <MarkerLayers locations={LOCATIONS} {...props} />
        </svg>,
      )
      expect(filters(container)).toEqual(expected)
    }
  })
})
