import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import type { LocationSummary } from './location-summary.ts'

import LocationCard from './LocationCard.tsx'

function summary(overrides: Partial<LocationSummary> = {}): LocationSummary {
  return {
    id: 'gijon',
    name: 'Gijón',
    administrativeArea: 'Asturias',
    pokemonId: 'charmeleon',
    pokemonName: 'Charmeleon',
    condition: 'Muy caluroso',
    minC: 17,
    maxC: 25,
    ...overrides,
  }
}

function renderCard(overrides: Partial<LocationSummary> = {}, onClose = vi.fn()) {
  render(<LocationCard summary={summary(overrides)} side="east" style={{}} onClose={onClose} />)
  return onClose
}

describe('LocationCard', () => {
  it('es una región con el nombre del lugar como título', () => {
    renderCard()

    const card = screen.getByRole('region', { name: 'Gijón' })
    expect(within(card).getByRole('heading', { name: 'Gijón' })).toBeInTheDocument()
  })

  it('muestra área administrativa, Pokémon, condición y mínima/máxima', () => {
    renderCard()

    const card = screen.getByRole('region', { name: 'Gijón' })
    expect(card).toHaveTextContent('Asturias')
    expect(card).toHaveTextContent('Charmeleon')
    expect(card).toHaveTextContent('Muy caluroso')
    expect(card).toHaveTextContent('Mínima 17° · Máxima 25°')
  })

  it('sin área cuando no aporta nada', () => {
    renderCard({ id: 'madrid', name: 'Madrid', administrativeArea: null })

    expect(screen.getByRole('region', { name: 'Madrid' }).querySelector('.location-card__area')).not.toBeInTheDocument()
  })

  it('el sprite es decorativo: el nombre del Pokémon ya va en texto', () => {
    const { container } = render(<LocationCard summary={summary()} side="east" style={{}} onClose={vi.fn()} />)

    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('sin previsión, lo dice en vez de dejar huecos', () => {
    renderCard({ pokemonId: null, pokemonName: null, condition: null, minC: null, maxC: null })

    const card = screen.getByRole('region', { name: 'Gijón' })
    expect(card.querySelector('img')).not.toBeInTheDocument()
    expect(card).toHaveTextContent('Sin previsión.')
  })

  it('se cierra con su botón y con Escape', () => {
    const onClose = renderCard()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cerrar' }), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
