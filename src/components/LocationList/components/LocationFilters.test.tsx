import { describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import type { ComponentProps } from 'react'

import { LOCATION_ZONES } from '../../../domain/location-zones.ts'
import LocationFilters from './LocationFilters.tsx'

function setup(overrides: Partial<ComponentProps<typeof LocationFilters>> = {}) {
  const props = {
    query: '',
    zone: null,
    order: 'zone' as const,
    searchRef: createRef<HTMLInputElement>(),
    onQueryChange: vi.fn(),
    onZoneChange: vi.fn(),
    onOrderChange: vi.fn(),
    ...overrides,
  }
  render(<LocationFilters {...props} />)
  return props
}

describe('LocationFilters', () => {
  it('controles nativos, todos con etiqueta visible', () => {
    setup()

    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveAttribute('id', 'location-search')
    expect(screen.getByRole('combobox', { name: 'Zona' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Ordenar' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((radio) => radio.closest('label')!.textContent)).toEqual(['Zona', 'A–Z', 'Más calor', 'Más frío'])
  })

  it('la zona ofrece «Todas las zonas», «Toda España» y las 19, y después Portugal y Andorra', () => {
    setup()

    const options = within(screen.getByRole('combobox', { name: 'Zona' }))
      .getAllByRole('option')
      .map((option) => option.textContent)
    const spanish = LOCATION_ZONES.filter((zone) => zone !== 'Portugal' && zone !== 'Andorra')
    expect(options).toEqual(['Todas las zonas', 'Toda España', ...spanish, 'Portugal', 'Andorra'])
    expect(screen.getByRole('group', { name: 'España' })).toContainElement(screen.getByRole('option', { name: 'Toda España' }))
  })

  it.each([
    ['', null],
    ['ES', 'ES'],
    ['Andalucía', 'Andalucía'],
    ['Portugal', 'Portugal'],
  ])('elegir la zona «%s» avisa con %s', (value, expected) => {
    const props = setup({ zone: 'Galicia' })

    fireEvent.change(screen.getByRole('combobox', { name: 'Zona' }), { target: { value } })

    expect(props.onZoneChange).toHaveBeenCalledWith(expected)
  })

  it('escribir avisa con el texto', () => {
    const props = setup()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'coruña' } })

    expect(props.onQueryChange).toHaveBeenCalledWith('coruña')
  })

  it('Escape con texto vacía el buscador y no toca nada más', () => {
    const props = setup({ query: 'coruña', zone: 'Galicia' })

    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Buscar' }), { key: 'Escape' })

    expect(props.onQueryChange).toHaveBeenCalledWith('')
    expect(props.onZoneChange).not.toHaveBeenCalled()
    expect(props.onOrderChange).not.toHaveBeenCalled()
  })

  it('Escape con el buscador vacío no hace nada', () => {
    const props = setup()

    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Buscar' }), { key: 'Escape' })

    expect(props.onQueryChange).not.toHaveBeenCalled()
  })

  it('«Ordenar» es un grupo de radios: una sola parada de tabulación, y el elegido lleva ▸', () => {
    setup({ order: 'warmest' })

    const radios = screen.getAllByRole('radio')
    expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1)
    expect(screen.getByRole('radio', { name: /Más calor/ })).toBeChecked()
    const cursors = document.querySelectorAll('.location-filters__cursor')
    expect(cursors).toHaveLength(1)
    expect(cursors[0].closest('label')).toHaveTextContent('Más calor')
    expect(cursors[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it('elegir un orden avisa con él', () => {
    const props = setup()

    fireEvent.click(screen.getByRole('radio', { name: /A–Z/ }))

    expect(props.onOrderChange).toHaveBeenCalledWith('name')
  })

  it('el buscador queda en la ref, para poder llevarle el foco', () => {
    const props = setup()

    expect(props.searchRef.current).toBe(screen.getByRole('searchbox', { name: 'Buscar' }))
  })
})
