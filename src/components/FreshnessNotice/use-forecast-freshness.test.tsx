import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import type { FreshnessStatus } from '../../domain/forecast-freshness.ts'

import { FRESHNESS_RECHECK_MS, useForecastFreshness } from './use-forecast-freshness.ts'

// La previsión del lunes 5 de octubre de 2026, generada el domingo a las
// 13:34 de Madrid. En octubre, Madrid va a UTC+2: su medianoche son las
// 22:00 UTC del día anterior.
const FORECAST_DATE = '2026-10-05'
const GENERATED_AT = '2026-10-04T11:34:48.000Z'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

const MONDAY_MIDNIGHT = Date.parse('2026-10-04T22:00:00.000Z')
const TUESDAY_MIDNIGHT = Date.parse('2026-10-05T22:00:00.000Z')

/** Un instante de cada estado. */
const AT: Record<FreshnessStatus, number> = {
  tomorrow: Date.parse('2026-10-04T18:00:00.000Z'), // domingo, 20:00
  today: Date.parse('2026-10-05T10:00:00.000Z'), // lunes, 12:00
  late: Date.parse('2026-10-06T10:00:00.000Z'), // martes, 12:00
  'very-late': Date.parse('2026-10-07T10:00:00.000Z'), // miércoles, 12:00
  unknown: Date.parse('2026-10-04T11:00:00.000Z'), // 34 min antes de la generación
}

// jsdom no oculta nunca la pestaña: la visibilidad la decide el test.
let visibility: DocumentVisibilityState = 'visible'

function hideTab() {
  visibility = 'hidden'
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function showTab() {
  visibility = 'visible'
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function restoreFromCache() {
  act(() => {
    window.dispatchEvent(new Event('pageshow'))
  })
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function mountAt(instant: number) {
  vi.setSystemTime(instant)
  return renderHook(() => useForecastFreshness(FORECAST_DATE, GENERATED_AT))
}

describe('useForecastFreshness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    // Vuelve el getter de jsdom, que vive en el prototipo.
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it.each(Object.keys(AT) as FreshnessStatus[])('al cargar en %s, ese es el estado, sin oferta de recargar', (status) => {
    const { result } = mountAt(AT[status])

    expect(result.current.freshness.status).toBe(status)
    expect(result.current.offerReload).toBe(false)
  })

  describe('recalcula sin recargar', () => {
    it('por el intervalo, con la pestaña visible: de MAÑANA a HOY a la medianoche de Madrid y de HOY a late a la siguiente', () => {
      const { result } = mountAt(MONDAY_MIDNIGHT - 30 * 1000)
      expect(result.current.freshness.status).toBe('tomorrow')

      // A los 30 s ya es lunes, pero el intervalo todavía no ha pasado.
      wait(30 * 1000)
      expect(result.current.freshness.status).toBe('tomorrow')
      wait(30 * 1000)
      expect(result.current.freshness.status).toBe('today')

      vi.setSystemTime(TUESDAY_MIDNIGHT - 30 * 1000)
      wait(FRESHNESS_RECHECK_MS)
      expect(result.current.freshness).toEqual({ status: 'late', daysLate: 1 })
    })

    it('por visibilitychange, al volver a la pestaña y sin esperar al intervalo', () => {
      const { result } = mountAt(AT.tomorrow)

      hideTab()
      vi.setSystemTime(AT.today)
      expect(result.current.freshness.status).toBe('tomorrow')
      showTab()
      expect(result.current.freshness.status).toBe('today')

      hideTab()
      vi.setSystemTime(AT.late)
      showTab()
      expect(result.current.freshness.status).toBe('late')
    })

    it('por pageshow, al restaurarse desde la caché del navegador', () => {
      const { result } = mountAt(AT.tomorrow)

      vi.setSystemTime(AT.today)
      restoreFromCache()
      expect(result.current.freshness.status).toBe('today')

      vi.setSystemTime(AT.late)
      restoreFromCache()
      expect(result.current.freshness.status).toBe('late')
    })

    it('con la pestaña oculta el intervalo no corre: horas después sigue el estado de antes', () => {
      const { result } = mountAt(MONDAY_MIDNIGHT - 30 * 1000)

      hideTab()
      wait(6 * HOUR_MS)

      expect(result.current.freshness.status).toBe('tomorrow')
    })

    it('recalcular el mismo estado no cambia nada: el mismo objeto y ningún render', () => {
      let renders = 0
      vi.setSystemTime(AT.tomorrow)
      const { result } = renderHook(() => {
        renders += 1
        return useForecastFreshness(FORECAST_DATE, GENERATED_AT)
      })
      const first = result.current.freshness
      const rendersAtLoad = renders

      showTab()
      restoreFromCache()
      wait(FRESHNESS_RECHECK_MS * 3)
      hideTab()
      showTab()

      expect(result.current.freshness).toBe(first)
      expect(renders).toBe(rendersAtLoad)
    })
  })

  describe('un solo intervalo, y solo con la pestaña visible', () => {
    it('visible, un intervalo; al ocultarse se detiene; al volver, otro', () => {
      mountAt(AT.tomorrow)
      expect(vi.getTimerCount()).toBe(1)

      hideTab()
      expect(vi.getTimerCount()).toBe(0)

      showTab()
      expect(vi.getTimerCount()).toBe(1)
    })

    it('cargada con la pestaña oculta, no arranca hasta que se ve', () => {
      visibility = 'hidden'
      mountAt(AT.tomorrow)
      expect(vi.getTimerCount()).toBe(0)

      showTab()
      expect(vi.getTimerCount()).toBe(1)
    })

    it('varios visibilitychange y pageshow seguidos no lo multiplican', () => {
      mountAt(AT.tomorrow)

      showTab()
      showTab()
      restoreFromCache()
      showTab()
      restoreFromCache()

      expect(vi.getTimerCount()).toBe(1)
    })

    it('al desmontarse retira el intervalo y las dos escuchas', () => {
      const addToDocument = vi.spyOn(document, 'addEventListener')
      const addToWindow = vi.spyOn(window, 'addEventListener')
      const removeFromDocument = vi.spyOn(document, 'removeEventListener')
      const removeFromWindow = vi.spyOn(window, 'removeEventListener')
      const { unmount } = mountAt(AT.tomorrow)

      const onVisibilityChange = addToDocument.mock.calls.find(([type]) => type === 'visibilitychange')?.[1]
      const onPageShow = addToWindow.mock.calls.find(([type]) => type === 'pageshow')?.[1]
      expect(onVisibilityChange).toBeTypeOf('function')
      expect(onPageShow).toBeTypeOf('function')

      unmount()

      expect(vi.getTimerCount()).toBe(0)
      expect(removeFromDocument).toHaveBeenCalledWith('visibilitychange', onVisibilityChange)
      expect(removeFromWindow).toHaveBeenCalledWith('pageshow', onPageShow)
    })
  })

  describe('freshAtLoad se fija al cargar y no cambia en toda la carga', () => {
    it.each<{ loaded: FreshnessStatus; later: FreshnessStatus }>([
      { loaded: 'tomorrow', later: 'late' },
      { loaded: 'tomorrow', later: 'very-late' },
      { loaded: 'today', later: 'late' },
      { loaded: 'today', later: 'very-late' },
    ])('cargada en $loaded y después $later: ofrece recargar', ({ loaded, later }) => {
      const { result } = mountAt(AT[loaded])

      vi.setSystemTime(AT[later])
      wait(FRESHNESS_RECHECK_MS)

      expect(result.current.freshness.status).toBe(later)
      expect(result.current.offerReload).toBe(true)
    })

    it.each<FreshnessStatus>(['late', 'very-late', 'unknown'])(
      'cargada en %s: no ofrece recargar, ni al volver a la pestaña ni tras horas abierta',
      (loaded) => {
        const { result } = mountAt(AT[loaded])

        vi.setSystemTime(AT['very-late'])
        hideTab()
        showTab()
        expect(result.current.freshness.status).toBe('very-late')
        expect(result.current.offerReload).toBe(false)

        wait(12 * HOUR_MS)
        expect(result.current.freshness.status).toBe('very-late')
        expect(result.current.offerReload).toBe(false)
      },
    )

    it('cargada fresca y después unknown: no ofrece recargar', () => {
      const { result } = mountAt(AT.today)

      vi.setSystemTime(AT.unknown)
      wait(FRESHNESS_RECHECK_MS)

      expect(result.current.freshness.status).toBe('unknown')
      expect(result.current.offerReload).toBe(false)
    })

    it('cargada en unknown, después today y después late: no ofrece recargar', () => {
      const { result } = mountAt(AT.unknown)

      vi.setSystemTime(AT.today)
      wait(FRESHNESS_RECHECK_MS)
      expect(result.current.freshness.status).toBe('today')
      expect(result.current.offerReload).toBe(false)

      vi.setSystemTime(AT.late)
      wait(FRESHNESS_RECHECK_MS)
      expect(result.current.freshness.status).toBe('late')
      expect(result.current.offerReload).toBe(false)
    })

    it('restaurar desde la caché no lo redefine: cargada fresca, sigue ofreciendo recargar', () => {
      const { result } = mountAt(AT.tomorrow)

      vi.setSystemTime(AT.late)
      restoreFromCache()
      expect(result.current.offerReload).toBe(true)

      // Con el reloj corregido hacia atrás, al día otra vez: nada que recargar…
      vi.setSystemTime(AT.today)
      restoreFromCache()
      expect(result.current.offerReload).toBe(false)

      // …y atrasada de nuevo, la oferta vuelve: la carga sigue siendo la misma.
      vi.setSystemTime(AT['very-late'])
      restoreFromCache()
      expect(result.current.offerReload).toBe(true)
    })

    it('restaurar desde la caché no lo redefine: cargada atrasada, pasar por today no habilita la oferta', () => {
      const { result } = mountAt(AT.late)

      vi.setSystemTime(AT.today)
      restoreFromCache()
      expect(result.current.freshness.status).toBe('today')

      vi.setSystemTime(AT['very-late'])
      restoreFromCache()
      expect(result.current.freshness.status).toBe('very-late')
      expect(result.current.offerReload).toBe(false)
    })
  })
})
