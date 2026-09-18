import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import Landing from './Landing.tsx'

describe('Landing', () => {
  it('muestra el botón EMPEZAR', () => {
    render(<Landing onStart={() => {}} />)

    expect(screen.getByRole('button', { name: 'EMPEZAR' })).toBeInTheDocument()
  })

  it('llama a onStart al pulsar EMPEZAR', () => {
    const onStart = vi.fn()
    render(<Landing onStart={onStart} />)

    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))

    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('con leaving, el botón deja de ser interactivo y sale del árbol de accesibilidad', () => {
    render(<Landing onStart={() => {}} leaving />)

    expect(screen.getByRole('button', { name: 'EMPEZAR', hidden: true })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'EMPEZAR' })).not.toBeInTheDocument()
  })
})
