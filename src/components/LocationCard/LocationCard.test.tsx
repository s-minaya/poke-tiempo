import { createRef } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

  it('su ref apunta a la región y queda a null al desmontarse', () => {
    const ref = createRef<HTMLElement>()
    const { unmount } = render(<LocationCard ref={ref} summary={summary()} side="east" style={{}} onClose={vi.fn()} />)

    expect(ref.current).toBe(screen.getByRole('region', { name: 'Gijón' }))

    unmount()
    expect(ref.current).toBeNull()
  })

  it('su botón Cerrar se expone por closeRef, para llevarle el foco al abrirla con teclado', () => {
    const closeRef = createRef<HTMLButtonElement>()
    render(<LocationCard closeRef={closeRef} summary={summary()} side="east" style={{}} onClose={vi.fn()} />)

    expect(closeRef.current).toBe(screen.getByRole('button', { name: 'Cerrar' }))
  })

  // Al abrirla con Intro o Espacio el foco llega a Cerrar con la tecla aún
  // pulsada: sus repeticiones no deben activarlo ni cerrar la tarjeta.
  it.each([
    ['la repetición de Intro mantenida se impide', { key: 'Enter', repeat: true }, true],
    ['la repetición de Espacio mantenido se impide', { key: ' ', repeat: true }, true],
    ['Intro pulsada de verdad actúa como siempre', { key: 'Enter' }, false],
    ['Espacio pulsado de verdad actúa como siempre', { key: ' ' }, false],
    ['otra tecla mantenida no se toca', { key: 'ArrowDown', repeat: true }, false],
    ['Tab no se atrapa', { key: 'Tab' }, false],
    ['Mayús+Tab tampoco', { key: 'Tab', shiftKey: true }, false],
  ])('%s', (_name, key, prevented) => {
    renderCard()

    const notPrevented = fireEvent.keyDown(screen.getByRole('button', { name: 'Cerrar' }), key)

    expect(notPrevented).toBe(!prevented)
  })

  it('avisa una sola vez justo antes de salir del DOM, con la tarjeta aún montada', () => {
    const attached: boolean[] = []
    const ref = createRef<HTMLElement>()
    const onRemove = vi.fn(() => attached.push(document.contains(ref.current)))
    const { rerender, unmount } = render(<LocationCard ref={ref} summary={summary()} side="east" style={{}} onClose={vi.fn()} onRemove={onRemove} />)

    rerender(<LocationCard ref={ref} summary={summary({ maxC: 26 })} side="east" style={{}} onClose={vi.fn()} onRemove={onRemove} />)
    expect(onRemove).not.toHaveBeenCalled()

    unmount()
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(attached).toEqual([true])
  })

  it('avisa con el último aviso recibido, sin repetir los anteriores', () => {
    const first = vi.fn()
    const last = vi.fn()
    const { rerender, unmount } = render(<LocationCard summary={summary()} side="east" style={{}} onClose={vi.fn()} onRemove={first} />)

    rerender(<LocationCard summary={summary()} side="east" style={{}} onClose={vi.fn()} onRemove={last} />)
    unmount()

    expect(first).not.toHaveBeenCalled()
    expect(last).toHaveBeenCalledTimes(1)
  })
})
