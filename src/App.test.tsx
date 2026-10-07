import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import type { ForecastFreshness, FreshnessStatus } from './domain/forecast-freshness.ts'

import { addCalendarDays, madridDateOf } from './domain/madrid-calendar.ts'
import { announceFreshness } from './components/FreshnessNotice/freshness-texts.ts'
import { FRESHNESS_RECHECK_MS } from './components/FreshnessNotice/use-forecast-freshness.ts'
import { formatForecastDay, formatForecastHeadline } from './components/Header/format-forecast-headline.ts'
import { watchLiveRegion } from './test/watch-live-region.ts'

import App from './App.tsx'

import forecastData from './data/forecast.json'

// La frescura depende del reloj, y el `forecast.json` real cambia cada día:
// todos los tests fijan el instante. Por defecto, el de la propia
// generación: un reloj válido respecto al dataset, sin cruzar ningún día, y
// con la previsión de mañana, como cuando el pipeline la publica.
const HOUR_MS = 60 * 60 * 1000
const GENERATION_INSTANT = Date.parse(forecastData.generatedAt)

const RELATIVE_DAY_WORD = /(?<![\p{L}\p{N}])(hoy|mañana|ayer)(?![\p{L}\p{N}])/iu

/** Mediodía en Madrid de esa fecha: 11:30 en invierno, 12:30 en verano. */
function middayInMadrid(date: string): number {
  return Date.parse(`${date}T10:30:00.000Z`)
}

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
  'Vaya... hay 7 lugares bajo algún aviso.',
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

// Mínimo del loader (Loader.tsx), duración del cruce de la portada (App.tsx)
// y de la salida de Oak (ProfessorOak.tsx).
const LOADER_MS = 400
const TRANSITION_MS = 350
const OAK_EXIT_MS = 300

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(GENERATION_INSTANT)
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
    vi.unstubAllGlobals()
  })

  function reachLanding(container: HTMLElement) {
    const preloadImage = container.querySelector('picture img')!
    fireEvent.load(preloadImage)
    // No `runAllTimers`: el intervalo de la frescura no se acaba nunca.
    wait(LOADER_MS)
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

    // Dentro de la portada: con el mapa ya montado, buscar en todo el
    // documento calcularía el nombre de cada marcador y cada fila.
    const landing = container.querySelector<HTMLElement>('.landing')!
    expect(within(landing).getByRole('button', { name: 'EMPEZAR', hidden: true })).toBeDisabled()
    expect(screen.queryByRole('dialog', { name: 'Profesor Oak' })).not.toBeInTheDocument()
  })

  it('pulsar EMPEZAR lleva a Oak, con el mapa ya montado debajo e inerte', () => {
    const { container } = render(<App />)

    start(container)
    wait(TRANSITION_MS)

    expect(screen.getByRole('dialog', { name: 'Profesor Oak' })).toBeInTheDocument()
    // Por texto: comprobar por rol que no queda en ninguna parte calcularía
    // el nombre de cada marcador y cada fila del mapa ya montado.
    expect(screen.queryByText('EMPEZAR')).not.toBeInTheDocument()
    // `inert` vive en el contenedor de la escena, no en `<main>`: cubre
    // también los créditos, que son hermanos suyos y no descendientes.
    expect(container.querySelector('.app')).toHaveAttribute('inert')
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

  describe('la frescura se calcula al cargar, y la fecha sale siempre de forecast.date', () => {
    const date = forecastData.date

    it.each([
      { label: 'en el instante de la generación: MAÑANA', now: () => GENERATION_INSTANT, tag: 'mañana', delay: false, notice: false },
      { label: 'el mismo día: HOY', now: () => middayInMadrid(date), tag: 'hoy', delay: false, notice: false },
      { label: 'un día después: ATRASADA con la frase', now: () => middayInMadrid(addCalendarDays(date, 1)), tag: 'atrasada', delay: true, notice: false },
      { label: 'tres días después: ATRASADA con el aviso', now: () => middayInMadrid(addCalendarDays(date, 3)), tag: 'atrasada', delay: false, notice: true },
      { label: 'un día antes de la generación: sin etiqueta', now: () => GENERATION_INSTANT - 24 * HOUR_MS, tag: null, delay: false, notice: false },
    ])('$label', ({ now, tag, delay, notice }) => {
      vi.setSystemTime(now())
      // Sin Oak, EMPEZAR lleva directo al mapa.
      publishOak({ date: '1999-01-01' })
      const { container } = render(<App />)

      start(container)
      wait(TRANSITION_MS)

      const header = container.querySelector<HTMLElement>('.header')!
      expect(within(header).getByText(formatForecastHeadline(date))).toBeInTheDocument()
      expect(header.querySelector('.header__label')?.textContent ?? null).toBe(tag)
      expect(header.querySelector('.header__delay') !== null).toBe(delay)
      expect(container.querySelector('.freshness-notice') !== null).toBe(notice)
    })
  })

  it('con un oak-today.json que depende del momento de lectura, EMPEZAR lleva directo al mapa', () => {
    publishOak({
      dialogues: [
        { id: 'dialogue-1', role: 'apertura', tone: 'neutral', text: 'Hoy hay 33 lugares bajo aviso y 69 con lluvia.' },
        { id: 'dialogue-2', role: 'foco', tone: 'epico', text: TEXTS[1] },
        { id: 'dialogue-3', role: 'cierre', tone: 'guasa', text: TEXTS[2] },
      ],
    })
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

  describe('con la pestaña abierta', () => {
    const date = forecastData.date

    /** Un instante de cada estado respecto al `forecast.json` real. */
    const AT: Record<FreshnessStatus, number> = {
      tomorrow: GENERATION_INSTANT,
      today: middayInMadrid(date),
      late: middayInMadrid(addCalendarDays(date, 1)),
      'very-late': middayInMadrid(addCalendarDays(date, 3)),
      unknown: GENERATION_INSTANT - 24 * HOUR_MS,
    }

    /** Medianoche de Madrid al empezar esa fecha: las 22:00 o las 23:00 UTC del día anterior, según el horario. */
    function madridMidnight(day: string): number {
      const summer = Date.parse(`${addCalendarDays(day, -1)}T22:00:00.000Z`)
      return madridDateOf(new Date(summer)) === day ? summer : summer + HOUR_MS
    }

    function returnToTab() {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }

    function restoreFromCache() {
      act(() => {
        window.dispatchEvent(new Event('pageshow'))
      })
    }

    function nextRecheck() {
      wait(FRESHNESS_RECHECK_MS)
    }

    /** El estado que pinta la página: la etiqueta, la frase de un día y el aviso fuerte. */
    function shownStatus(container: HTMLElement): FreshnessStatus {
      const label = container.querySelector('.header__label')?.textContent
      if (label === 'mañana') return 'tomorrow'
      if (label === 'hoy') return 'today'
      if (label === undefined) return 'unknown'
      return container.querySelector('.freshness-notice__box--very-late') ? 'very-late' : 'late'
    }

    function oakIsOnStage() {
      return screen.queryByRole('dialog', { name: 'Profesor Oak', hidden: true }) !== null
    }

    function enterWithoutOak(container: HTMLElement) {
      start(container)
      wait(TRANSITION_MS)
    }

    function region(container: HTMLElement) {
      return container.querySelector<HTMLElement>('.freshness-announcement')!
    }

    /** Ni dentro de un nodo `inert` ni de uno `aria-hidden`: la región sigue en el árbol de accesibilidad. */
    function expectReachable(live: HTMLElement) {
      expect(live.closest('[inert], [aria-hidden="true"]')).toBeNull()
    }

    it('una pestaña visible cruza la medianoche de Madrid: de MAÑANA a HOY, de HOY a ATRASADA, y entonces ofrece recargar', () => {
      publishOak({ date: '1999-01-01' })
      vi.setSystemTime(madridMidnight(date) - 30 * 1000)
      const { container } = render(<App />)
      enterWithoutOak(container)
      expect(shownStatus(container)).toBe('tomorrow')

      nextRecheck()
      expect(shownStatus(container)).toBe('today')
      expect(container.querySelector('.freshness-notice')).toBeNull()

      vi.setSystemTime(madridMidnight(addCalendarDays(date, 1)) - 30 * 1000)
      nextRecheck()
      expect(shownStatus(container)).toBe('late')
      expect(container.querySelector('.header__delay')).toBeInTheDocument()
      const notice = container.querySelector<HTMLElement>('.freshness-notice')!
      expect(notice).toHaveTextContent(`Esta página sigue mostrando la previsión del ${formatForecastDay(date)}.`)
      expect(within(notice).getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    })

    it('cargada atrasada, no ofrece recargar ni al volver a la pestaña ni tras horas abierta', () => {
      publishOak({ date: '1999-01-01' })
      vi.setSystemTime(AT.late)
      const { container } = render(<App />)
      enterWithoutOak(container)

      returnToTab()
      restoreFromCache()
      expect(shownStatus(container)).toBe('late')
      expect(container.querySelector('.freshness-notice')).toBeNull()

      // Doce horas después ya es de anteayer: el aviso fuerte, sin recargar.
      wait(12 * HOUR_MS)
      expect(shownStatus(container)).toBe('very-late')
      expect(container.querySelector('.freshness-notice__reload')).toBeNull()
    })

    describe('la región viva', () => {
      it('montada desde la carga: una sola, la misma en todas las etapas, vacía y fuera de lo inerte u oculto', () => {
        const { container } = render(<App />)
        const live = region(container)

        // Cargando, en la portada, en el cruce (portada inerte y Oak oculto),
        // con Oak (el mapa inerte) y en el mapa.
        const checkpoints = [
          () => {},
          () => reachLanding(container),
          () => fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' })),
          () => wait(TRANSITION_MS),
          () => readAllOfOak(),
        ]
        for (const step of checkpoints) {
          step()
          expect(container.querySelectorAll('.freshness-announcement')).toHaveLength(1)
          expect(region(container)).toBe(live)
          expect(live).toBeEmptyDOMElement()
          expectReachable(live)
        }
      })

      it('empieza vacía, no anuncia la carga y recalcular el mismo estado no anuncia nada', () => {
        publishOak({ date: '1999-01-01' })
        const { container } = render(<App />)
        enterWithoutOak(container)
        const live = watchLiveRegion(region(container))

        expect(region(container)).toBeEmptyDOMElement()
        returnToTab()
        restoreFromCache()
        nextRecheck()

        expect(live.announcements()).toEqual([])
        expect(region(container)).toBeEmptyDOMElement()
        live.disconnect()
      })

      it('un cambio de estado se anuncia una vez, aunque varios mecanismos recalculen seguidos; el siguiente cambio, otra vez', () => {
        publishOak({ date: '1999-01-01' })
        const { container } = render(<App />)
        enterWithoutOak(container)
        const live = watchLiveRegion(region(container))

        // Primer cambio: MAÑANA → HOY, al volver a la pestaña.
        vi.setSystemTime(AT.today)
        returnToTab()
        expect(live.announcements()).toEqual([`${formatForecastHeadline(date)}, hoy.`])

        // El mismo estado, por los tres mecanismos: ningún anuncio más.
        restoreFromCache()
        nextRecheck()
        returnToTab()
        expect(live.announcements()).toHaveLength(1)

        // Segundo cambio, y los tres mecanismos seguidos sobre él: un anuncio.
        vi.setSystemTime(AT.late)
        restoreFromCache()
        returnToTab()
        nextRecheck()
        const announcements = live.announcements()
        expect(announcements).toHaveLength(2)
        expect(announcements[1]).toBe(
          `${formatForecastHeadline(date)}, atrasada. Esta previsión corresponde al ${formatForecastDay(date)} y lleva 1 día de retraso. ` +
            `Esta página sigue mostrando la previsión del ${formatForecastDay(date)}. Recarga para comprobar si hay una más reciente.`,
        )
        live.disconnect()
      })

      it('fuera de las etiquetas HOY y MAÑANA y de su anuncio en la región viva, ningún texto de la página dice hoy, mañana ni ayer', () => {
        publishOak({ date: '1999-01-01' })
        const { container } = render(<App />)
        enterWithoutOak(container)
        const headline = formatForecastHeadline(date)

        // Por los cinco estados y de vuelta a MAÑANA: la región dice «hoy» y
        // «mañana» en algún momento del recorrido.
        const walk: FreshnessStatus[] = ['today', 'late', 'very-late', 'unknown', 'tomorrow']
        const announcedLabels: string[] = []
        for (const status of walk) {
          vi.setSystemTime(AT[status])
          restoreFromCache()
          expect(shownStatus(container)).toBe(status)

          const page = container.cloneNode(true) as HTMLElement
          const announced = page.querySelector('.freshness-announcement')!.textContent ?? ''
          page.querySelectorAll('.header__label, .freshness-announcement').forEach((node) => node.remove())
          const labels = [...page.querySelectorAll('[aria-label]')].map((node) => node.getAttribute('aria-label'))
          expect(page.textContent).not.toMatch(RELATIVE_DAY_WORD)
          expect(labels.join(' ')).not.toMatch(RELATIVE_DAY_WORD)

          // La única excepción: en la región, la etiqueta justo tras la fecha,
          // como la lee la cabecera.
          const label = [`${headline}, hoy.`, `${headline}, mañana.`].find((form) => announced.startsWith(form))
          if (label) announcedLabels.push(label)
          expect(announced.replace(label ?? '', '')).not.toMatch(RELATIVE_DAY_WORD)
        }
        expect(announcedLabels).toEqual([`${headline}, hoy.`, `${headline}, mañana.`])
      })

      it('anunciar no mueve el foco', () => {
        publishOak({ date: '1999-01-01' })
        const { container } = render(<App />)
        enterWithoutOak(container)
        const skip = container.querySelector<HTMLElement>('.app__skip-link')!
        skip.focus()

        vi.setSystemTime(AT.late)
        restoreFromCache()

        expect(region(container)).not.toBeEmptyDOMElement()
        expect(skip).toHaveFocus()
      })
    })

    describe('Oak', () => {
      it.each<{ status: FreshnessStatus; oak: boolean }>([
        { status: 'tomorrow', oak: true },
        { status: 'today', oak: true },
        { status: 'late', oak: false },
        { status: 'very-late', oak: false },
        { status: 'unknown', oak: false },
      ])('cargada en $status, EMPEZAR lleva a Oak: $oak', ({ status, oak }) => {
        vi.setSystemTime(AT[status])
        const { container } = render(<App />)

        start(container)
        wait(TRANSITION_MS)

        expect(oakIsOnStage()).toBe(oak)
        expect(container.querySelector('.app')?.hasAttribute('inert')).toBe(oak)
      })

      /** Lo que pinta cada estado no fresco tras cargar al día: con la oferta de recargar, salvo `unknown`. */
      const STALE: Record<'late' | 'very-late' | 'unknown', { freshness: ForecastFreshness; offerReload: boolean }> = {
        late: { freshness: { status: 'late', daysLate: 1 }, offerReload: true },
        'very-late': { freshness: { status: 'very-late', daysLate: 3 }, offerReload: true },
        unknown: { freshness: { status: 'unknown', daysLate: 0 }, offerReload: false },
      }

      it.each<{ from: FreshnessStatus; to: keyof typeof STALE }>([
        { from: 'tomorrow', to: 'late' },
        { from: 'tomorrow', to: 'very-late' },
        { from: 'tomorrow', to: 'unknown' },
        { from: 'today', to: 'late' },
        { from: 'today', to: 'very-late' },
        { from: 'today', to: 'unknown' },
      ])('en escena con $from, si pasa a $to: la región lo anuncia una vez, Oak se cierra, queda el mapa y no vuelve', ({ from, to }) => {
        vi.setSystemTime(AT[from])
        const { container } = render(<App />)
        start(container)
        wait(TRANSITION_MS)
        expect(oakIsOnStage()).toBe(true)

        // Con Oak delante, `.app` es el nodo inerte, y la región no está dentro.
        const inertNode = container.querySelector('.app')!
        const live = region(container)
        expect(inertNode).toHaveAttribute('inert')
        expect(inertNode.contains(live)).toBe(false)
        expectReachable(live)
        const heard = watchLiveRegion(live)

        vi.setSystemTime(AT[to])
        nextRecheck()
        nextRecheck()

        expect(heard.announcements()).toEqual([announceFreshness(date, STALE[to].freshness, STALE[to].offerReload)])
        expect(shownStatus(container)).toBe(to)
        expect(oakIsOnStage()).toBe(false)
        expect(screen.getByRole('heading', { name: 'POKETIEMPO' })).toBeInTheDocument()
        expect(container.querySelector('.app')).not.toHaveAttribute('inert')
        expect(region(container)).toBe(live)
        expectReachable(live)

        // Al día otra vez: la escena no se abre sola.
        vi.setSystemTime(AT[from])
        nextRecheck()
        expect(shownStatus(container)).toBe(from)
        expect(oakIsOnStage()).toBe(false)
        heard.disconnect()
      })

      it('en escena, MAÑANA → HOY no la cierra, y la región, fuera del nodo inerte, anuncia HOY una vez', () => {
        const { container } = render(<App />)
        start(container)
        wait(TRANSITION_MS)
        const live = region(container)
        const heard = watchLiveRegion(live)

        vi.setSystemTime(AT.today)
        nextRecheck()
        returnToTab()
        restoreFromCache()
        nextRecheck()

        expect(shownStatus(container)).toBe('today')
        expect(oakIsOnStage()).toBe(true)
        expect(heard.announcements()).toEqual([`${formatForecastHeadline(date)}, hoy.`])
        const inertNode = container.querySelector('.app')!
        expect(inertNode).toHaveAttribute('inert')
        expect(inertNode.contains(live)).toBe(false)
        expectReachable(live)
        heard.disconnect()
      })

      it('si deja de estar al día durante el cruce desde la portada, EMPEZAR acaba en el mapa, y no vuelve', () => {
        const { container } = render(<App />)
        start(container)

        vi.setSystemTime(AT.late)
        restoreFromCache()
        wait(TRANSITION_MS)

        expect(oakIsOnStage()).toBe(false)
        expect(container.querySelector('.app')).not.toHaveAttribute('inert')

        vi.setSystemTime(AT.tomorrow)
        restoreFromCache()
        expect(oakIsOnStage()).toBe(false)
      })
    })

    it('sin red: recorrer los cinco estados no hace ninguna petición', () => {
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      const open = vi.spyOn(XMLHttpRequest.prototype, 'open')
      const send = vi.spyOn(XMLHttpRequest.prototype, 'send')
      publishOak({ date: '1999-01-01' })
      const { container } = render(<App />)
      enterWithoutOak(container)

      const shown = [shownStatus(container)]
      vi.setSystemTime(AT.today)
      nextRecheck()
      shown.push(shownStatus(container))
      vi.setSystemTime(AT.late)
      returnToTab()
      shown.push(shownStatus(container))
      vi.setSystemTime(AT['very-late'])
      restoreFromCache()
      shown.push(shownStatus(container))
      vi.setSystemTime(AT.unknown)
      nextRecheck()
      shown.push(shownStatus(container))

      expect(shown).toEqual(['tomorrow', 'today', 'late', 'very-late', 'unknown'])
      expect(fetch).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
      expect(send).not.toHaveBeenCalled()
    })
  })
})
