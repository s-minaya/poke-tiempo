import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import LocationMarker from './LocationMarker.tsx'

describe('LocationMarker', () => {
  it('expone el nombre del lugar como nombre accesible, incluso sin temperatura, y no pinta ningún sprite', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="a-coruna" x={10} y={20} name="A Coruña" />
      </svg>,
    )

    expect(screen.getByRole('button', { name: 'A Coruña' })).toBeInTheDocument()
    expect(container.querySelector('image')).not.toBeInTheDocument()
    expect(container.querySelector('text')).not.toBeInTheDocument()
  })

  it('coloca el grupo en la posición proyectada', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="madrid" x={10} y={20} name="Madrid" />
      </svg>,
    )

    expect(container.querySelector('g')).toHaveAttribute('transform', 'translate(10, 20)')
  })

  it('con minC/maxC: nombre accesible incluye las temperaturas redondeadas, mínima primero', () => {
    render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" minC={12.4} maxC={23.6} />
      </svg>,
    )

    expect(screen.getByRole('button', { name: 'Granada, mínima 12 grados, máxima 24 grados' })).toBeInTheDocument()
  })

  it('pinta mínima y máxima como texto, mínima primero, con °', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" minC={8} maxC={23} />
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
        <LocationMarker id="granada" x={10} y={20} name="Granada" minC={-2} maxC={36} />
      </svg>,
    )

    const tspans = container.querySelectorAll('.location-marker__temp-value')
    expect(tspans[0]).toHaveClass('location-marker__temp-value--freezing')
    expect(tspans[1]).toHaveClass('location-marker__temp-value--scorching')
  })

  it('sin minC/maxC (marcador sin forecast): sigue siendo válido, sin pintar temperatura', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="a-coruna" x={10} y={20} name="A Coruña" minC={null} maxC={null} />
      </svg>,
    )

    expect(container.querySelector('text')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A Coruña' })).toBeInTheDocument()
  })

  it('la copia de contorno de las cifras queda fuera del árbol accesible', () => {
    const { container } = render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" minC={8} maxC={23} />
      </svg>,
    )

    expect(container.querySelector('.location-marker__temperature--contour')).toHaveAttribute('aria-hidden', 'true')
  })

  it('es un botón enfocable en el orden del documento, sin pulsar por defecto', () => {
    render(
      <svg>
        <LocationMarker id="granada" x={10} y={20} name="Granada" />
      </svg>,
    )

    const marker = screen.getByRole('button', { name: 'Granada' })
    expect(marker).toHaveAttribute('tabindex', '0')
    expect(marker).toHaveAttribute('aria-pressed', 'false')
  })

  it('seleccionado, se anuncia como pulsado y no dibuja nada propio', () => {
    const props = { id: 'granada', x: 10, y: 20, name: 'Granada', minC: 8, maxC: 23 } as const
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
        <LocationMarker id="granada" x={10} y={20} name="Granada" onActivate={onActivate} />
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
        <LocationMarker id="granada" x={10} y={20} name="Granada" onActivate={onActivate} />
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
        <LocationMarker id="granada" x={10} y={20} name="Granada" onDismiss={onDismiss} />
      </svg>,
    )

    fireEvent.keyDown(screen.getByRole('button', { name: 'Granada' }), { key: 'Escape' })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
