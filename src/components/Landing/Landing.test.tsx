import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import Landing from './Landing.tsx'

// Debe coincidir con FADE_MS (Landing.tsx).
const FADE_MS = 250

let play: ReturnType<typeof vi.spyOn>
let pause: ReturnType<typeof vi.spyOn>
let seek: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set').mockImplementation(() => {})
})

afterEach(() => {
  // Antes de restaurar los espías: al desmontar, la portada para el jingle,
  // y un `pause()` de verdad no existe en jsdom.
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/** Pulsa EMPEZAR y deja la portada saliendo, que es cuando el jingle se apaga. */
function startAndLeave() {
  const onStart = vi.fn()
  const view = render(<Landing onStart={onStart} />)

  fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
  view.rerender(<Landing onStart={onStart} leaving />)

  return { ...view, onStart, jingle: play.mock.contexts[0] as HTMLAudioElement }
}

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

describe('el jingle de EMPEZAR', () => {
  it('se apaga con la portada, sin esperar a que el sonido termine', () => {
    const { jingle } = startAndLeave()

    expect(play).toHaveBeenCalledTimes(1)
    expect(jingle.volume).toBe(1)

    tick(FADE_MS / 2)
    expect(jingle.volume).toBeLessThan(1)
    expect(jingle.volume).toBeGreaterThan(0)
    expect(pause).not.toHaveBeenCalled()

    tick(FADE_MS / 2)
    expect(jingle.volume).toBe(0)
    expect(pause).toHaveBeenCalledTimes(1)
    expect(seek).toHaveBeenCalledWith(0)
  })

  it('con movimiento reducido se corta en seco, sin fundido que seguir', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {} })),
    )

    const { jingle } = startAndLeave()

    expect(pause).toHaveBeenCalledTimes(1)
    expect(seek).toHaveBeenCalledWith(0)
    expect(jingle.volume).toBe(1)
  })

  it('si la portada se va antes de acabar el fundido, el sonido no la sobrevive', () => {
    const { unmount } = startAndLeave()

    tick(FADE_MS / 2)
    unmount()

    expect(pause).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('si el navegador bloquea el jingle, salir de la portada no cambia en nada', async () => {
    play.mockRejectedValue(new DOMException('autoplay', 'NotAllowedError'))
    const { onStart } = startAndLeave()

    await act(async () => {})
    tick(FADE_MS)

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'EMPEZAR', hidden: true })).toBeDisabled()
  })
})
