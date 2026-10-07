import { calendarDaysBetween, madridDateOf } from './madrid-calendar.ts'

/**
 * Cuán fresca es la previsión que contiene la página respecto al calendario
 * de Madrid (`010-spec.md` → Estados de frescura):
 * - `tomorrow` y `today`: la fecha del dataset es mañana u hoy. Es «al día».
 * - `late`: es de ayer.
 * - `very-late`: es de anteayer o de antes.
 * - `unknown`: el reloj del dispositivo no es fiable respecto al dataset.
 */
export type FreshnessStatus = 'tomorrow' | 'today' | 'late' | 'very-late' | 'unknown'

export interface ForecastFreshness {
  status: FreshnessStatus
  /** Días de calendario de retraso: 0 salvo en `late` y `very-late`. */
  daysLate: number
}

/**
 * Cuánto puede ir el reloj del dispositivo por detrás de la generación del
 * dataset antes de dejar de confiar en él: la deriva normal de un reloj, no
 * un margen para relojes mal puestos.
 */
export const CLOCK_DRIFT_TOLERANCE_MS = 15 * 60 * 1000

interface FreshnessInput {
  /** `forecast.date`, `YYYY-MM-DD`. */
  forecastDate: string
  /** `forecast.generatedAt`, instante ISO 8601. */
  generatedAt: string
  now: Date
}

const UNKNOWN: ForecastFreshness = { status: 'unknown', daysLate: 0 }

/**
 * El estado se decide por diferencia de días de calendario —fecha del dataset
 * menos fecha de Madrid—, nunca por horas transcurridas: una previsión para
 * hoy generada ayer está al día.
 *
 * Antes que nada, las dos señales de un reloj imposible, que dan `unknown`:
 * ningún dataset se genera después del instante actual (con la tolerancia de
 * deriva) y el pipeline nunca publica una fecha más allá de mañana. Un reloj
 * adelantado no deja ninguna señal sin consultar la red, y no se intenta
 * detectar.
 */
export function resolveFreshness({ forecastDate, generatedAt, now }: FreshnessInput): ForecastFreshness {
  if (now.getTime() < Date.parse(generatedAt) - CLOCK_DRIFT_TOLERANCE_MS) return UNKNOWN

  const daysAhead = calendarDaysBetween(madridDateOf(now), forecastDate)
  if (daysAhead >= 2) return UNKNOWN
  if (daysAhead === 1) return { status: 'tomorrow', daysLate: 0 }
  if (daysAhead === 0) return { status: 'today', daysLate: 0 }
  if (daysAhead === -1) return { status: 'late', daysLate: 1 }
  return { status: 'very-late', daysLate: -daysAhead }
}

export function isFresh(freshness: ForecastFreshness): boolean {
  return freshness.status === 'today' || freshness.status === 'tomorrow'
}

/**
 * Oak solo aparece con la previsión al día: con ella atrasada, o sin poder
 * establecer su frescura, la capa narrativa y sus avisos no se presentan.
 */
export function canShowOak(freshness: ForecastFreshness): boolean {
  return isFresh(freshness)
}

/**
 * Recargar se ofrece por un cambio de estado, no por tiempo abierto: solo a
 * una página que cargó al día (`freshAtLoad`, fijo durante esa carga) y que
 * ahora está atrasada. Una que cargó atrasada o indeterminada no tiene nada
 * que indique que recargar cambie su dataset.
 */
export function shouldOfferReload(freshAtLoad: boolean, current: ForecastFreshness): boolean {
  return freshAtLoad && (current.status === 'late' || current.status === 'very-late')
}
