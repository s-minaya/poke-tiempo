import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import type { OakToday } from '../../domain/oak/oak-today.ts'
import ProfessorOak, { MS_PER_CHAR, START_DELAY_MS } from './ProfessorOak.tsx'

const TEXTS = [
  'Vaya... hoy hay 7 lugares bajo algún aviso.',
  '¡Vaya! Charmeleon aparece en 33 lugares del mapa.',
  'Curioso... Gyarados asoma en 6 lugares del mapa.',
] as const

function today(overrides: Partial<OakToday> = {}): OakToday {
  return {
    date: '2026-09-23',
    generatedAt: '2026-09-22T06:00:00.000Z',
    source: 'ai',
    dayMode: 'invasion',
    serious: false,
    dialogues: [
      { id: 'dialogue-1', role: 'apertura', tone: 'neutral', text: TEXTS[0] },
      { id: 'dialogue-2', role: 'foco', tone: 'epico', text: TEXTS[1] },
      { id: 'dialogue-3', role: 'cierre', tone: 'guasa', text: TEXTS[2] },
    ],
    ...overrides,
  }
}

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
  // Antes de restaurar los espías: al desmontar, la escena para el blip, y
  // un `pause()` de verdad no existe en jsdom.
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/**
 * Monta la escena y salta el respiro inicial: salvo el bloque que lo
 * comprueba, ningún test habla de esos 200 ms.
 */
function scene(props: Partial<{ today: OakToday; ready: boolean; onClose: () => void }> = {}) {
  const onClose = props.onClose ?? vi.fn()
  const result = render(<ProfessorOak today={props.today ?? today()} ready={props.ready ?? true} onClose={onClose} />)
  act(() => {
    vi.advanceTimersByTime(START_DELAY_MS)
  })
  return { ...result, onClose }
}

/** Lo que se ve escrito en la caja, sin la parte reservada que aún no ha salido. */
function typed(container: HTMLElement): string {
  return container.querySelector('.oak-dialogue__typed')?.textContent ?? ''
}

function pose(container: HTMLElement): string {
  return container.querySelector('.oak-portrait__image')?.getAttribute('src') ?? ''
}

function nextArrow(container: HTMLElement): Element | null {
  return container.querySelector('.oak-dialogue__next')
}

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function typeOut(text: string) {
  tick((Array.from(text).length + 1) * MS_PER_CHAR)
}

function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(document, { key, ...init })
}

function tap() {
  fireEvent.click(screen.getByRole('dialog'))
}

describe('pose', () => {
  it('cambia con el tono de cada bocadillo', () => {
    const { container } = scene()

    expect(pose(container)).toContain('oak-neutral')
    typeOut(TEXTS[0])
    tap()
    expect(pose(container)).toContain('oak-epic')
    typeOut(TEXTS[1])
    tap()
    expect(pose(container)).toContain('oak-playful')
  })

  it('en un día serio no hay cara de asombro ni de broma, aunque el tono las pidiera', () => {
    const { container } = scene({ today: today({ serious: true }) })

    expect(pose(container)).toContain('oak-neutral')
    typeOut(TEXTS[0])
    tap()
    expect(pose(container)).toContain('oak-warning')
    typeOut(TEXTS[1])
    tap()
    expect(pose(container)).toContain('oak-neutral')
  })
})

describe('los tres bocadillos, en orden, y luego el mapa', () => {
  it('apertura → foco → cierre → onClose', () => {
    const { onClose } = scene()

    for (const text of TEXTS) {
      expect(screen.getByRole('dialog')).toHaveTextContent(text)
      typeOut(text)
      tap()
    }

    expect(onClose).not.toHaveBeenCalled()
    tick(300)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('los textos son los de oak-today, sin tocar', () => {
    scene()

    expect(screen.getByRole('dialog')).toHaveTextContent(TEXTS[0])
  })

  it('el ▼ solo aparece cuando el texto está entero', () => {
    const { container } = scene()

    expect(nextArrow(container)).toBeNull()
    typeOut(TEXTS[0])
    expect(nextArrow(container)).not.toBeNull()
  })

  it('se anuncia como la escena del Profesor Oak, sin escribir su nombre en la caja', () => {
    const { container } = scene()

    expect(screen.getByRole('dialog', { name: 'Profesor Oak' })).toBeInTheDocument()
    expect(container.textContent).not.toContain('Profesor Oak')
  })
})

describe('máquina de escribir', () => {
  it('escribe a MS_PER_CHAR por carácter', () => {
    const { container } = scene()

    expect(typed(container)).toBe('')
    tick(MS_PER_CHAR * 5)
    expect(typed(container)).toBe(Array.from(TEXTS[0]).slice(0, 5).join(''))
  })

  it('un clic mientras escribe solo completa el texto: no pasa de bocadillo', () => {
    const { container } = scene()

    tick(MS_PER_CHAR * 3)
    tap()

    expect(typed(container)).toBe(TEXTS[0])
    expect(pose(container)).toContain('oak-neutral')
    expect(nextArrow(container)).not.toBeNull()

    tap()
    expect(typed(container)).toBe('')
    expect(screen.getByRole('dialog')).toHaveTextContent(TEXTS[1])
  })

  it('Intro y Espacio hacen lo mismo que un clic', () => {
    const { container, onClose } = scene()

    press('Enter')
    expect(typed(container)).toBe(TEXTS[0])
    press(' ')
    expect(screen.getByRole('dialog')).toHaveTextContent(TEXTS[1])

    press(' ')
    press('Enter')
    press('Enter')
    press('Enter')
    tick(300)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('mantener la tecla pulsada no pasa bocadillos en cadena', () => {
    const { container } = scene()

    press('Enter')
    press('Enter', { repeat: true })
    press('Enter', { repeat: true })

    expect(typed(container)).toBe(TEXTS[0])
    expect(pose(container)).toContain('oak-neutral')
  })

  it('otras teclas no hacen nada', () => {
    const { container } = scene()

    press('a')
    press('Escape')
    press('Tab')

    expect(typed(container)).toBe('')
  })

  it('cambiar de bocadillo vuelve a escribir desde el principio', () => {
    const { container } = scene()

    typeOut(TEXTS[0])
    tap()

    expect(typed(container)).toBe('')
    tick(MS_PER_CHAR * 4)
    expect(typed(container)).toBe(Array.from(TEXTS[1]).slice(0, 4).join(''))
  })
})

describe('audio', () => {
  it('suena desde 0 al empezar a escribir', () => {
    scene()

    expect(seek).toHaveBeenCalledWith(0)
    expect(play).toHaveBeenCalledTimes(1)
    expect(seek.mock.invocationCallOrder[0]).toBeLessThan(play.mock.invocationCallOrder[0])
  })

  it('se para y se rebobina cuando el texto termina de escribirse solo', () => {
    scene()
    seek.mockClear()

    typeOut(TEXTS[0])

    expect(pause).toHaveBeenCalledTimes(1)
    expect(seek).toHaveBeenCalledWith(0)
  })

  it('se para y se rebobina cuando el usuario completa el texto', () => {
    scene()
    seek.mockClear()

    tick(MS_PER_CHAR * 2)
    tap()

    expect(pause).toHaveBeenCalledTimes(1)
    expect(seek).toHaveBeenCalledWith(0)
  })

  it('vuelve a empezar desde 0 en cada bocadillo, sin bucle', () => {
    scene()

    typeOut(TEXTS[0])
    seek.mockClear()
    tap()

    expect(play).toHaveBeenCalledTimes(2)
    expect(seek).toHaveBeenCalledWith(0)
    expect((play.mock.contexts[1] as HTMLAudioElement).loop).toBe(false)
  })

  it('una sola pista para toda la escena, no un sonido por carácter, y a volumen discreto', () => {
    scene()

    typeOut(TEXTS[0])
    expect(play).toHaveBeenCalledTimes(1)

    tap()
    const [first, second] = play.mock.contexts as HTMLAudioElement[]
    expect(second).toBe(first)
    expect(first.volume).toBeLessThanOrEqual(0.5)
  })

  it('si el navegador bloquea play(), la escena sigue igual', async () => {
    play.mockRejectedValue(new DOMException('autoplay', 'NotAllowedError'))
    const { container, onClose } = scene()

    await act(async () => {})
    tick(MS_PER_CHAR * 3)
    expect(typed(container)).toBe(Array.from(TEXTS[0]).slice(0, 3).join(''))

    for (const text of TEXTS) {
      typeOut(text)
      tap()
    }
    tick(300)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ni siquiera un play() que lanza al llamarlo rompe nada', () => {
    play.mockImplementation(() => {
      throw new Error('sin audio')
    })
    const { container } = scene()

    tick(MS_PER_CHAR * 3)
    expect(typed(container)).toBe(Array.from(TEXTS[0]).slice(0, 3).join(''))
  })

  it('desmontar a media escritura para el audio y no deja temporizadores', () => {
    const { unmount } = scene()

    tick(MS_PER_CHAR * 2)
    unmount()

    expect(pause).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('movimiento reducido', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {} })),
    )
  })

  it('el texto sale entero de inmediato y no suena nada', () => {
    const { container } = scene()

    expect(typed(container)).toBe(TEXTS[0])
    expect(nextArrow(container)).not.toBeNull()
    expect(play).not.toHaveBeenCalled()
  })

  it('cada interacción pasa de bocadillo, y el último cierra sin esperar a ninguna animación', () => {
    const { container, onClose } = scene()

    tap()
    expect(typed(container)).toBe(TEXTS[1])
    tap()
    expect(typed(container)).toBe(TEXTS[2])
    tap()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(play).not.toHaveBeenCalled()
  })
})

describe('antes de estar en escena', () => {
  it('durante el cruce desde la portada no escribe, no suena y no escucha', () => {
    const { container, onClose } = scene({ ready: false })

    tick(MS_PER_CHAR * 10)
    fireEvent.click(screen.getByRole('dialog', { hidden: true }))
    press('Enter')

    expect(typed(container)).toBe('')
    expect(play).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('aparece callado: ni escribe ni suena hasta pasado el respiro', () => {
    const { container } = render(<ProfessorOak today={today()} ready onClose={vi.fn()} />)

    tick(START_DELAY_MS - 1)
    expect(typed(container)).toBe('')
    expect(play).not.toHaveBeenCalled()

    // Termina el respiro, y solo entonces empieza el primer carácter.
    tick(1)
    tick(MS_PER_CHAR)

    expect(play).toHaveBeenCalledTimes(1)
    expect(typed(container)).toBe(Array.from(TEXTS[0])[0])
  })

  it('cuando entra en escena, empieza a escribir y se lleva el foco', () => {
    const onClose = vi.fn()
    const { container, rerender } = render(<ProfessorOak today={today()} ready={false} onClose={onClose} />)

    rerender(<ProfessorOak today={today()} ready onClose={onClose} />)
    tick(START_DELAY_MS)
    tick(MS_PER_CHAR * 2)

    expect(typed(container)).toBe(Array.from(TEXTS[0]).slice(0, 2).join(''))
    expect(screen.getByRole('dialog')).toHaveFocus()
  })
})
