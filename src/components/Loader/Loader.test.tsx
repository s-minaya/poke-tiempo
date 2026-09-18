import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import Loader from './Loader.tsx'

describe('Loader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders without crashing', () => {
    render(<Loader onReady={() => {}} />)

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
  })

  it('no avisa de que está listo solo por el paso del tiempo si la imagen no ha cargado', () => {
    const onReady = vi.fn()
    const { container } = render(<Loader onReady={onReady} />)

    act(() => {
      vi.runAllTimers()
    })

    expect(onReady).not.toHaveBeenCalled()
    expect(container.querySelector('picture img')).toBeInTheDocument()
  })

  it('avisa de que está listo cuando la imagen carga y ya pasó la duración mínima', () => {
    const onReady = vi.fn()
    const { container } = render(<Loader onReady={onReady} />)

    const img = container.querySelector('picture img')!
    fireEvent.load(img)
    expect(onReady).not.toHaveBeenCalled()

    act(() => {
      vi.runAllTimers()
    })

    expect(onReady).toHaveBeenCalledTimes(1)
  })
})
