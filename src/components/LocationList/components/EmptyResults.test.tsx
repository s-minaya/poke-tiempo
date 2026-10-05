import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import EmptyResults from './EmptyResults.tsx'

describe('EmptyResults', () => {
  it('Castform en silueta con «?», el título, una frase que invita a quitar filtros y el botón', () => {
    const { container } = render(<EmptyResults focusSearch={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Ni rastro por aquí' })).toBeInTheDocument()
    expect(screen.getByText(/Quita alguno o empieza de cero/)).toBeInTheDocument()
    expect(container.querySelector('.empty-results__art')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.empty-results__sprite')!.getAttribute('src')).toContain('castform')
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument()
  })

  it('«Limpiar filtros» los quita y lleva el foco al buscador', () => {
    const onClearFilters = vi.fn()
    const focusSearch = vi.fn()
    render(<EmptyResults onClearFilters={onClearFilters} focusSearch={focusSearch} />)

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(onClearFilters).toHaveBeenCalledTimes(1)
    expect(focusSearch).toHaveBeenCalledTimes(1)
  })
})
