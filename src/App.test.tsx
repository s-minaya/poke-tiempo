import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import App from './App.tsx'

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function reachLanding(container: HTMLElement) {
    const preloadImage = container.querySelector('picture img')!
    fireEvent.load(preloadImage)
    act(() => {
      vi.runAllTimers()
    })
  }

  it('muestra primero el loader, no la aplicación', () => {
    render(<App />)

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'POKETIEMPO' })).not.toBeInTheDocument()
  })

  it('llega a la portada cuando la imagen de portada está lista', () => {
    const { container } = render(<App />)

    reachLanding(container)

    expect(screen.queryByRole('status', { name: 'Cargando' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'EMPEZAR' })).toBeInTheDocument()
  })

  it('pulsar EMPEZAR termina mostrando la aplicación, sin dejar la portada interactiva a la vez', () => {
    const { container } = render(<App />)

    reachLanding(container)
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))

    // Durante el cruce, la portada puede seguir montada de fondo, pero ya
    // no es interactiva (criterio de aceptación: nunca ambas a la vez).
    expect(screen.getByRole('button', { name: 'EMPEZAR', hidden: true })).toBeDisabled()

    act(() => {
      vi.runAllTimers()
    })

    expect(screen.getByRole('heading', { name: 'POKETIEMPO' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'EMPEZAR', hidden: true })).not.toBeInTheDocument()
  })
})
