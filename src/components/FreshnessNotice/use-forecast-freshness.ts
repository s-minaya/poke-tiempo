import { useEffect, useState } from 'react'

import type { ForecastFreshness } from '../../domain/forecast-freshness.ts'

import { isFresh, resolveFreshness, shouldOfferReload } from '../../domain/forecast-freshness.ts'

/** Cada cuánto se recalcula la frescura mientras la pestaña está visible. */
export const FRESHNESS_RECHECK_MS = 60 * 1000

export interface ForecastFreshnessState {
  freshness: ForecastFreshness
  /** La página cargó al día y ahora está atrasada (`shouldOfferReload`). */
  offerReload: boolean
}

function sameFreshness(a: ForecastFreshness, b: ForecastFreshness): boolean {
  return a.status === b.status && a.daysLate === b.daysLate
}

/**
 * La frescura de la previsión con la pestaña abierta (`010-plan.md`).
 *
 * Se calcula al cargar y se recalcula al volver a la pestaña
 * (`visibilitychange`), al restaurarla desde la caché del navegador
 * (`pageshow`) y cada `FRESHNESS_RECHECK_MS` mientras está visible. El
 * intervalo cubre también la vuelta de una suspensión del equipo, que no
 * siempre dispara eventos.
 *
 * Recalcular el mismo estado no cambia nada: el estado conserva el mismo
 * objeto, React no vuelve a pintar y nadie ve un cambio, por muchos
 * mecanismos que recalculen seguidos.
 */
export function useForecastFreshness(forecastDate: string, generatedAt: string): ForecastFreshnessState {
  // El estado al cargar, sin setter: nada puede redefinirlo durante esta
  // carga. Una restauración desde la caché del navegador no es una carga
  // nueva —la página sigue montada— y tampoco lo toca.
  const [atLoad] = useState(() => resolveFreshness({ forecastDate, generatedAt, now: new Date() }))
  const [freshness, setFreshness] = useState(atLoad)

  useEffect(() => {
    // Un solo intervalo por montaje: arrancarlo siempre detiene antes el que
    // hubiera, así que varios `visibilitychange` o `pageshow` seguidos no lo
    // multiplican.
    let interval: ReturnType<typeof setInterval> | undefined

    function recalculate() {
      const next = resolveFreshness({ forecastDate, generatedAt, now: new Date() })
      setFreshness((current) => (sameFreshness(current, next) ? current : next))
    }

    function stopInterval() {
      clearInterval(interval)
      interval = undefined
    }

    function startInterval() {
      stopInterval()
      interval = setInterval(recalculate, FRESHNESS_RECHECK_MS)
    }

    function isVisible() {
      return document.visibilityState === 'visible'
    }

    // Al volver, recalcula en el acto y vuelve a arrancar el intervalo; al
    // ocultarse, lo detiene.
    function onVisibilityChange() {
      if (isVisible()) {
        recalculate()
        startInterval()
      } else {
        stopInterval()
      }
    }

    // También llega en la carga normal, y entonces recalcula el mismo estado.
    function onPageShow() {
      recalculate()
      if (isVisible()) startInterval()
    }

    if (isVisible()) startInterval()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      stopInterval()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [forecastDate, generatedAt])

  return { freshness, offerReload: shouldOfferReload(isFresh(atLoad), freshness) }
}
