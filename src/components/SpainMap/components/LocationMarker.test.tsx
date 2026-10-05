import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import LocationMarker from './LocationMarker.tsx'

describe('LocationMarker', () => {
  it('expone el nombre del lugar como nombre accesible, incluso sin Pokémon ni temperatura', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="a-coruna" x={10} y={20} name="A Coruña" pokemonId={null} />
      </svg>,
    )

    expect(screen.getByRole('button', { name: 'A Coruña' })).toBeInTheDocument()
    expect(container.querySelector('image')).not.toBeInTheDocument()
    expect(container.querySelector('text')).not.toBeInTheDocument()
  })

  it('pinta un único sprite cuando hay Pokémon asignado', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="madrid" x={10} y={20} name="Madrid" pokemonId="zapdos" />
      </svg>,
    )

    const images = container.querySelectorAll('image')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('href')).toContain('zapdos')
  })

  it('coloca el grupo en la posición proyectada', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="madrid" x={10} y={20} name="Madrid" pokemonId={null} />
      </svg>,
    )

    expect(container.querySelector('g')).toHaveAttribute('transform', 'translate(10, 20)')
  })

  it('con minC/maxC: nombre accesible incluye las temperaturas redondeadas, mínima primero', () => {
    render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" pokemonId={null} minC={12.4} maxC={23.6} />
      </svg>,
    )

    expect(screen.getByRole('button', { name: 'Granada, mínima 12 grados, máxima 24 grados' })).toBeInTheDocument()
  })

  it('pinta mínima y máxima como texto, mínima primero, con °', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" pokemonId={null} minC={8} maxC={23} />
      </svg>,
    )

    const tspans = container.querySelectorAll('.location-marker__temp-value')
    expect(tspans).toHaveLength(2)
    expect(tspans[0]).toHaveTextContent('8°')
    expect(tspans[1]).toHaveTextContent('23°')
  })

  it('cada cifra lleva la clase de su propia franja — la máxima no decide el color de la mínima', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" pokemonId={null} minC={-2} maxC={36} />
      </svg>,
    )

    const tspans = container.querySelectorAll('.location-marker__temp-value')
    expect(tspans[0]).toHaveClass('location-marker__temp-value--freezing')
    expect(tspans[1]).toHaveClass('location-marker__temp-value--scorching')
  })

  it('sin minC/maxC (marcador sin forecast): sigue siendo válido, sin pintar temperatura', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="a-coruna" x={10} y={20} name="A Coruña" pokemonId={null} minC={null} maxC={null} />
      </svg>,
    )

    expect(container.querySelector('text')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A Coruña' })).toBeInTheDocument()
  })

  it('la copia de contorno de las cifras queda fuera del árbol accesible', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" pokemonId={null} minC={8} maxC={23} />
      </svg>,
    )

    expect(container.querySelector('.location-marker__temperature--contour')).toHaveAttribute('aria-hidden', 'true')
  })

  it('es un botón enfocable en el orden del documento, sin pulsar por defecto', () => {
    render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" pokemonId={null} />
      </svg>,
    )

    const marker = screen.getByRole('button', { name: 'Granada' })
    expect(marker).toHaveAttribute('tabindex', '0')
    expect(marker).toHaveAttribute('aria-pressed', 'false')
  })

  it('seleccionado, se anuncia como pulsado y no dibuja nada propio', () => {
    const props = { id: 'granada', x: 10, y: 20, name: 'Granada', pokemonId: 'zapdos', minC: 8, maxC: 23 } as const
    const { container: idle } = render(
      <svg>
        <LocationMarker {...props} />
      </svg>,
    )
    const { container: selected } = render(
      <svg>
        <LocationMarker {...props} selected />
      </svg>,
    )

    const idleMarker = within(idle).getByRole('button')
    const selectedMarker = within(selected).getByRole('button')
    expect(idleMarker).toHaveAttribute('aria-pressed', 'false')
    expect(selectedMarker).toHaveAttribute('aria-pressed', 'true')

    // Ni disco ni ninguna otra marca: fuera de ese estado, ni una clase ni un
    // nodo cambia.
    expect(selectedMarker).toHaveAttribute('class', idleMarker.getAttribute('class')!)
    expect(selectedMarker.innerHTML).toBe(idleMarker.innerHTML)
  })

  it('se activa con clic, con Intro y con Espacio, y avisa con su id', () => {
    const onActivate = vi.fn()
    render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" pokemonId={null} onActivate={onActivate} />
      </svg>,
    )

    const marker = screen.getByRole('button', { name: 'Granada' })
    fireEvent.click(marker)
    fireEvent.keyDown(marker, { key: 'Enter' })
    fireEvent.keyDown(marker, { key: ' ' })

    expect(onActivate).toHaveBeenCalledTimes(3)
    expect(onActivate).toHaveBeenNthCalledWith(1, 'granada')
    expect(onActivate).toHaveBeenNthCalledWith(2, 'granada')
    expect(onActivate).toHaveBeenNthCalledWith(3, 'granada')
  })

  it('mantener pulsado Intro no lo activa en bucle', () => {
    const onActivate = vi.fn()
    render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" pokemonId={null} onActivate={onActivate} />
      </svg>,
    )

    const marker = screen.getByRole('button', { name: 'Granada' })
    fireEvent.keyDown(marker, { key: 'Enter' })
    fireEvent.keyDown(marker, { key: 'Enter', repeat: true })

    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('Escape pide cerrar la tarjeta', () => {
    const onDismiss = vi.fn()
    render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" pokemonId={null} onDismiss={onDismiss} />
      </svg>,
    )

    fireEvent.keyDown(screen.getByRole('button', { name: 'Granada' }), { key: 'Escape' })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('LocationMarker en sombra', () => {
  const props = { id: 'granada', x: 10, y: 20, name: 'Granada', pokemonId: 'zapdos', minC: 8, maxC: 23 } as const

  it('no es un botón: sin rol, foco, nombre, estado, título, cifras ni aro de foco, y fuera del árbol accesible', () => {
    const { container } = render(
      <svg>
        <LocationMarker {...props} dimmed />
      </svg>,
    )

    const marker = container.querySelector('.location-marker')!
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(marker).toHaveAttribute('aria-hidden', 'true')
    for (const attribute of ['role', 'tabindex', 'aria-label', 'aria-pressed']) expect(marker).not.toHaveAttribute(attribute)
    expect(marker.querySelector('title')).not.toBeInTheDocument()
    expect(marker.querySelector('text')).not.toBeInTheDocument()
    expect(marker.querySelector('.location-marker__focus-ring')).not.toBeInTheDocument()
  })

  it('conserva la posición y el sprite, al mismo tamaño, pasado por el filtro de silueta', () => {
    const { container: normal } = render(
      <svg>
        <LocationMarker {...props} />
      </svg>,
    )
    const { container: dimmed } = render(
      <svg>
        <LocationMarker {...props} dimmed />
      </svg>,
    )

    const sprite = (container: HTMLElement) => container.querySelector('image')!
    expect(dimmed.querySelector('g')).toHaveAttribute('transform', normal.querySelector('g')!.getAttribute('transform')!)
    for (const attribute of ['href', 'x', 'y', 'width', 'height']) {
      expect(sprite(dimmed)).toHaveAttribute(attribute, sprite(normal).getAttribute(attribute)!)
    }
    expect(sprite(dimmed)).toHaveAttribute('filter', 'url(#location-marker-silhouette)')
    expect(sprite(normal)).not.toHaveAttribute('filter')
  })

  it('no se registra como destino del foco, y vuelve a hacerlo al coincidir de nuevo', () => {
    const register = vi.fn()
    const { rerender } = render(
      <svg>
        <LocationMarker {...props} register={register} />
      </svg>,
    )
    expect(register).toHaveBeenLastCalledWith('granada', expect.any(SVGGElement))

    rerender(
      <svg>
        <LocationMarker {...props} register={register} dimmed />
      </svg>,
    )
    expect(register).toHaveBeenLastCalledWith('granada', null)

    rerender(
      <svg>
        <LocationMarker {...props} register={register} />
      </svg>,
    )
    expect(register).toHaveBeenLastCalledWith('granada', expect.any(SVGGElement))
    expect(screen.getByRole('button', { name: /^Granada/ })).toBeInTheDocument()
  })
})
