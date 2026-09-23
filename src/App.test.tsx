import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import App from './App.tsx'

import forecastData from './data/forecast.json'

/**
 * `oak-today.json` lo reescribe el workflow cada día, y con él cambiaría lo
 * que hace `App` — con el contrato viejo la escena de Oak no sale, con el
 * nuevo sí. Estos tests no pueden depender de lo que haya publicado el bot,
 * así que el JSON se sustituye por uno propio, del mismo día que el
 * `forecast.json` real para que la guarda de fecha lo acepte.
 */
const oak = vi.hoisted(() => ({ data: {} as Record<string, unknown> }))
vi.mock('./data/oak-today.json', () => ({ default: oak.data }))

const TEXTS = [
  'Vaya... hoy hay 7 lugares bajo algún aviso.',
  '¡Vaya! Charmeleon aparece en 33 lugares del mapa.',
  'Curioso... Gyarados asoma en 6 lugares del mapa.',
]

function publishOak(overrides: Record<string, unknown> = {}) {
  for (const key of Object.keys(oak.data)) delete oak.data[key]
  Object.assign(oak.data, {
    date: forecastData.date,
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
  })
}

// Duración del cruce de la portada (App.tsx) y de la salida de Oak (ProfessorOak.tsx).
const TRANSITION_MS = 350
const OAK_EXIT_MS = 300

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set').mockImplementation(() => {})
    publishOak()
  })

  afterEach(() => {
    // Antes de restaurar los espías: al desmontar se paran jingle y blip, y
    // un `pause()` de verdad no existe en jsdom.
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function reachLanding(container: HTMLElement) {
    const preloadImage = container.querySelector('picture img')!
    fireEvent.load(preloadImage)
    act(() => {
      vi.runAllTimers()
    })
  }

  function start(container: HTMLElement) {
    reachLanding(container)
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
  }

  function wait(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  /** Intro completa el bocadillo; la segunda pasa al siguiente. */
  function readAllOfOak() {
    for (let dialogue = 0; dialogue < 3; dialogue += 1) {
      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'Enter' })
    }
    wait(OAK_EXIT_MS)
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

  it('durante el cruce la portada ya no es interactiva, y Oak todavía no habla', () => {
    const { container } = render(<App />)

    start(container)

    expect(screen.getByRole('button', { name: 'EMPEZAR', hidden: true })).toBeDisabled()
    expect(screen.queryByRole('dialog', { name: 'Profesor Oak' })).not.toBeInTheDocument()
  })

  it('pulsar EMPEZAR lleva a Oak, con el mapa ya montado debajo e inerte', () => {
    const { container } = render(<App />)

    start(container)
    wait(TRANSITION_MS)

    expect(screen.getByRole('dialog', { name: 'Profesor Oak' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'EMPEZAR', hidden: true })).not.toBeInTheDocument()
    expect(container.querySelector('main')).toHaveAttribute('inert')
  })

  it('Oak dice los textos de oak-today.json, en orden', () => {
    const { container } = render(<App />)

    start(container)
    wait(TRANSITION_MS)

    for (const text of TEXTS) {
      expect(screen.getByRole('dialog', { name: 'Profesor Oak' })).toHaveTextContent(text)
      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'Enter' })
    }
  })

  it('tras el tercer bocadillo, Oak se va y queda el mapa, ya interactivo', () => {
    const { container } = render(<App />)

    start(container)
    wait(TRANSITION_MS)
    readAllOfOak()

    expect(screen.queryByRole('dialog', { name: 'Profesor Oak' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'POKETIEMPO' })).toBeInTheDocument()
    expect(container.querySelector('main')).not.toHaveAttribute('inert')
  })

  it('con un oak-today.json del contrato anterior, EMPEZAR lleva directo al mapa', () => {
    publishOak({ serious: undefined })
    const { container } = render(<App />)

    start(container)
    wait(TRANSITION_MS)

    expect(screen.queryByRole('dialog', { name: 'Profesor Oak', hidden: true })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'POKETIEMPO' })).toBeInTheDocument()
    expect(container.querySelector('main')).not.toHaveAttribute('inert')
  })

  it('si oak-today.json habla de otro día que el mapa, Oak no sale', () => {
    publishOak({ date: '1999-01-01' })
    const { container } = render(<App />)

    start(container)
    wait(TRANSITION_MS)

    expect(screen.queryByRole('dialog', { name: 'Profesor Oak', hidden: true })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'POKETIEMPO' })).toBeInTheDocument()
  })
})
