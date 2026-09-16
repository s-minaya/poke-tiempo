import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import LocationMarker from './LocationMarker.tsx'

describe('LocationMarker', () => {
  it('expone el nombre del lugar como nombre accesible, incluso sin Pokémon ni temperatura', () => {
    const { container } = render(
      <svg>
        <LocationMarker x={10} y={20} name="A Coruña" pokemonId={null} />
      </svg>,
    )

    expect(screen.getByRole('img', { name: 'A Coruña' })).toBeInTheDocument()
    expect(container.querySelector('image')).not.toBeInTheDocument()
    expect(container.querySelector('text')).not.toBeInTheDocument()
  })

  it('pinta un único sprite cuando hay Pokémon asignado', () => {
    const { container } = render(
      <svg>
        <LocationMarker x={10} y={20} name="Madrid" pokemonId="zapdos" />
      </svg>,
    )

    const images = container.querySelectorAll('image')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('href')).toContain('zapdos')
  })

  it('coloca el grupo en la posición proyectada', () => {
    const { container } = render(
      <svg>
        <LocationMarker x={10} y={20} name="Madrid" pokemonId={null} />
      </svg>,
    )

    expect(container.querySelector('g')).toHaveAttribute('transform', 'translate(10, 20)')
  })

  it('con minC/maxC: nombre accesible incluye las temperaturas redondeadas, mínima primero', () => {
    render(
      <svg>
        <LocationMarker x={10} y={20} name="Granada" pokemonId={null} minC={12.4} maxC={23.6} />
      </svg>,
    )

    expect(screen.getByRole('img', { name: 'Granada, mínima 12 grados, máxima 24 grados' })).toBeInTheDocument()
  })

  it('pinta mínima y máxima como texto, mínima primero, con °', () => {
    const { container } = render(
      <svg>
        <LocationMarker x={10} y={20} name="Granada" pokemonId={null} minC={8} maxC={23} />
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
        <LocationMarker x={10} y={20} name="Granada" pokemonId={null} minC={-2} maxC={36} />
      </svg>,
    )

    const tspans = container.querySelectorAll('.location-marker__temp-value')
    expect(tspans[0]).toHaveClass('location-marker__temp-value--freezing')
    expect(tspans[1]).toHaveClass('location-marker__temp-value--scorching')
  })

  it('sin minC/maxC (marcador sin forecast): sigue siendo válido, sin pintar temperatura', () => {
    const { container } = render(
      <svg>
        <LocationMarker x={10} y={20} name="A Coruña" pokemonId={null} minC={null} maxC={null} />
      </svg>,
    )

    expect(container.querySelector('text')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'A Coruña' })).toBeInTheDocument()
  })
})
