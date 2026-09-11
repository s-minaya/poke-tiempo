import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import LocationMarker from './LocationMarker.tsx'

describe('LocationMarker', () => {
  it('expone el nombre del lugar como nombre accesible, incluso sin Pokémon', () => {
    const { container } = render(
      <svg>
        <LocationMarker x={10} y={20} name="A Coruña" pokemonId={null} />
      </svg>,
    )

    expect(screen.getByRole('img', { name: 'A Coruña' })).toBeInTheDocument()
    expect(container.querySelector('image')).not.toBeInTheDocument()
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
})
