import { describe, expect, it } from 'vitest'

import type { ForecastFreshness, FreshnessStatus } from './forecast-freshness.ts'
import {
  CLOCK_DRIFT_TOLERANCE_MS,
  canShowOak,
  isFresh,
  resolveFreshness,
  shouldOfferReload,
} from './forecast-freshness.ts'

// Previsión del lunes 5 de octubre de 2026, generada el domingo 4 a las 13:34
// de Madrid (CEST, UTC+2). Todos los instantes son explícitos: ningún test
// depende de la hora real.
const FORECAST_DATE = '2026-10-05'
const GENERATED_AT = '2026-10-04T11:34:48.000Z'
const GENERATED_AT_MS = Date.parse(GENERATED_AT)

function freshnessAt(now: string | number, forecastDate = FORECAST_DATE, generatedAt = GENERATED_AT) {
  return resolveFreshness({ forecastDate, generatedAt, now: new Date(now) })
}

describe('resolveFreshness — estados', () => {
  it.each([
    { label: 'domingo por la tarde: MAÑANA', now: '2026-10-04T15:00:00.000Z', status: 'tomorrow', daysLate: 0 },
    { label: 'domingo, último instante: MAÑANA', now: '2026-10-04T21:59:59.999Z', status: 'tomorrow', daysLate: 0 },
    { label: 'lunes, medianoche de Madrid: HOY', now: '2026-10-04T22:00:00.000Z', status: 'today', daysLate: 0 },
    { label: 'lunes, último instante: HOY', now: '2026-10-05T21:59:59.999Z', status: 'today', daysLate: 0 },
    { label: 'martes, medianoche de Madrid: un día', now: '2026-10-05T22:00:00.000Z', status: 'late', daysLate: 1 },
    { label: 'martes, último instante: un día', now: '2026-10-06T21:59:59.999Z', status: 'late', daysLate: 1 },
    { label: 'miércoles, medianoche de Madrid: dos días', now: '2026-10-06T22:00:00.000Z', status: 'very-late', daysLate: 2 },
    { label: 'jueves: tres días', now: '2026-10-08T09:00:00.000Z', status: 'very-late', daysLate: 3 },
    { label: 'un mes después, pasado el cambio de hora: treinta días', now: '2026-11-04T10:00:00.000Z', status: 'very-late', daysLate: 30 },
  ])('$label', ({ now, status, daysLate }) => {
    expect(freshnessAt(now)).toEqual({ status, daysLate })
  })
})

describe('resolveFreshness — reloj por detrás de la generación', () => {
  it.each([
    { label: '14 min 59 s antes: dentro de la tolerancia', offsetMs: -(14 * 60 + 59) * 1000, status: 'tomorrow' },
    { label: 'exactamente 15 min antes: dentro de la tolerancia', offsetMs: -CLOCK_DRIFT_TOLERANCE_MS, status: 'tomorrow' },
    { label: '15 min y 1 ms antes: fuera de la tolerancia', offsetMs: -CLOCK_DRIFT_TOLERANCE_MS - 1, status: 'unknown' },
    { label: 'en el instante de la generación', offsetMs: 0, status: 'tomorrow' },
    { label: '1 ms después de la generación', offsetMs: 1, status: 'tomorrow' },
  ])('$label', ({ offsetMs, status }) => {
    expect(freshnessAt(GENERATED_AT_MS + offsetMs).status).toBe(status)
  })

  it('la tolerancia es de 15 minutos', () => {
    expect(CLOCK_DRIFT_TOLERANCE_MS).toBe(15 * 60 * 1000)
  })

  it('un instante posterior a la generación nunca da unknown por deriva, por antiguo que sea el dataset', () => {
    expect(freshnessAt(GENERATED_AT_MS + 10 * 24 * 60 * 60 * 1000)).toEqual({ status: 'very-late', daysLate: 9 })
  })
})

describe('resolveFreshness — fecha del dataset por delante de la de Madrid', () => {
  // Generación anterior al instante actual, para que solo cuente la fecha.
  const EARLY_GENERATION = '2026-10-01T11:00:00.000Z'

  it.each([
    { label: '+1: MAÑANA', now: '2026-10-04T10:00:00.000Z', status: 'tomorrow' },
    { label: '+2: unknown', now: '2026-10-03T10:00:00.000Z', status: 'unknown' },
    { label: '+3: unknown', now: '2026-10-02T10:00:00.000Z', status: 'unknown' },
  ])('$label', ({ now, status }) => {
    expect(freshnessAt(now, FORECAST_DATE, EARLY_GENERATION).status).toBe(status)
  })

  it('con las dos señales a la vez, unknown sin días de retraso', () => {
    expect(freshnessAt('2026-10-02T10:00:00.000Z')).toEqual({ status: 'unknown', daysLate: 0 })
  })
})

describe('resolveFreshness — días de cambio de hora', () => {
  it.each([
    { label: 'previsión del 26-10, último instante del día de 25 horas: MAÑANA', forecastDate: '2026-10-26', generatedAt: '2026-10-25T11:00:00.000Z', now: '2026-10-25T22:59:59.999Z', status: 'tomorrow' },
    { label: 'previsión del 26-10, medianoche en CET: HOY', forecastDate: '2026-10-26', generatedAt: '2026-10-25T11:00:00.000Z', now: '2026-10-25T23:00:00.000Z', status: 'today' },
    { label: 'previsión del 25-10, en la hora repetida: HOY', forecastDate: '2026-10-25', generatedAt: '2026-10-24T11:00:00.000Z', now: '2026-10-25T01:30:00.000Z', status: 'today' },
    { label: 'previsión del 29-03, último instante del día de 23 horas: MAÑANA', forecastDate: '2027-03-29', generatedAt: '2027-03-28T11:00:00.000Z', now: '2027-03-28T21:59:59.999Z', status: 'tomorrow' },
    { label: 'previsión del 29-03, medianoche en CEST: HOY', forecastDate: '2027-03-29', generatedAt: '2027-03-28T11:00:00.000Z', now: '2027-03-28T22:00:00.000Z', status: 'today' },
    { label: 'previsión del 28-03, justo tras el salto: HOY', forecastDate: '2027-03-28', generatedAt: '2027-03-27T12:00:00.000Z', now: '2027-03-28T01:00:00.000Z', status: 'today' },
  ])('$label', ({ forecastDate, generatedAt, now, status }) => {
    expect(freshnessAt(now, forecastDate, generatedAt).status).toBe(status)
  })
})

describe('resolveFreshness — cambios de mes y de año', () => {
  it.each([
    { label: 'previsión del 1-10 vista el 30-09: MAÑANA', forecastDate: '2026-10-01', generatedAt: '2026-09-30T11:00:00.000Z', now: '2026-09-30T21:59:59.999Z', status: 'tomorrow', daysLate: 0 },
    { label: 'previsión del 30-09 vista el 1-10: un día', forecastDate: '2026-09-30', generatedAt: '2026-09-29T11:00:00.000Z', now: '2026-09-30T22:00:00.000Z', status: 'late', daysLate: 1 },
    { label: 'previsión del 1-1 vista el 31-12: MAÑANA', forecastDate: '2027-01-01', generatedAt: '2026-12-31T11:00:00.000Z', now: '2026-12-31T22:59:59.999Z', status: 'tomorrow', daysLate: 0 },
    { label: 'previsión del 31-12 vista el 2-1: dos días', forecastDate: '2026-12-31', generatedAt: '2026-12-30T11:00:00.000Z', now: '2027-01-01T23:00:00.000Z', status: 'very-late', daysLate: 2 },
  ])('$label', ({ forecastDate, generatedAt, now, status, daysLate }) => {
    expect(freshnessAt(now, forecastDate, generatedAt)).toEqual({ status, daysLate })
  })
})

const ALL_STATES: ForecastFreshness[] = [
  { status: 'tomorrow', daysLate: 0 },
  { status: 'today', daysLate: 0 },
  { status: 'late', daysLate: 1 },
  { status: 'very-late', daysLate: 2 },
  { status: 'unknown', daysLate: 0 },
]

const FRESH: Record<FreshnessStatus, boolean> = {
  tomorrow: true,
  today: true,
  late: false,
  'very-late': false,
  unknown: false,
}

describe('isFresh', () => {
  it.each(ALL_STATES)('$status', (freshness) => {
    expect(isFresh(freshness)).toBe(FRESH[freshness.status])
  })
})

describe('canShowOak', () => {
  it.each(ALL_STATES)('$status', (freshness) => {
    expect(canShowOak(freshness)).toBe(FRESH[freshness.status])
  })
})

describe('shouldOfferReload', () => {
  const [tomorrow, today, late, veryLate, unknown] = ALL_STATES

  it.each([
    { freshAtLoad: true, current: tomorrow, expected: false },
    { freshAtLoad: true, current: today, expected: false },
    { freshAtLoad: true, current: late, expected: true },
    { freshAtLoad: true, current: veryLate, expected: true },
    { freshAtLoad: true, current: unknown, expected: false },
    { freshAtLoad: false, current: tomorrow, expected: false },
    { freshAtLoad: false, current: today, expected: false },
    { freshAtLoad: false, current: late, expected: false },
    { freshAtLoad: false, current: veryLate, expected: false },
    { freshAtLoad: false, current: unknown, expected: false },
  ])('fresca al cargar: $freshAtLoad, ahora $current.status → $expected', ({ freshAtLoad, current, expected }) => {
    expect(shouldOfferReload(freshAtLoad, current)).toBe(expected)
  })
})
