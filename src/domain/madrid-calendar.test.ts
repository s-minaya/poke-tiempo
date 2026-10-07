import { describe, expect, it } from 'vitest'

import { addCalendarDays, calendarDaysBetween, madridDateOf } from './madrid-calendar.ts'

describe('madridDateOf', () => {
  // Madrid va a UTC+1 en invierno (CET) y a UTC+2 en verano (CEST). Los
  // cambios de hora son a la 01:00 UTC: el 25 de octubre de 2026 el reloj
  // vuelve de las 03:00 a las 02:00 (día de 25 horas) y el 28 de marzo de
  // 2027 salta de las 02:00 a las 03:00 (día de 23 horas).
  it.each([
    { label: 'invierno, último instante antes de la medianoche', instant: '2026-01-14T22:59:59.999Z', expected: '2026-01-14' },
    { label: 'invierno, medianoche', instant: '2026-01-14T23:00:00.000Z', expected: '2026-01-15' },
    { label: 'verano, último instante antes de la medianoche', instant: '2026-07-14T21:59:59.999Z', expected: '2026-07-14' },
    { label: 'verano, medianoche', instant: '2026-07-14T22:00:00.000Z', expected: '2026-07-15' },
    { label: '25-10-2026, justo antes de su medianoche (aún CEST)', instant: '2026-10-24T21:59:59.999Z', expected: '2026-10-24' },
    { label: '25-10-2026, 00:00 CEST', instant: '2026-10-24T22:00:00.000Z', expected: '2026-10-25' },
    { label: '25-10-2026, 02:00 CEST', instant: '2026-10-25T00:00:00.000Z', expected: '2026-10-25' },
    { label: '25-10-2026, 02:00 CET, la hora repetida', instant: '2026-10-25T01:00:00.000Z', expected: '2026-10-25' },
    { label: '25-10-2026, 03:00 CET', instant: '2026-10-25T02:00:00.000Z', expected: '2026-10-25' },
    { label: '25-10-2026, último instante de su día de 25 horas', instant: '2026-10-25T22:59:59.999Z', expected: '2026-10-25' },
    { label: '26-10-2026, medianoche ya en CET', instant: '2026-10-25T23:00:00.000Z', expected: '2026-10-26' },
    { label: '28-03-2027, justo antes de su medianoche (aún CET)', instant: '2027-03-27T22:59:59.999Z', expected: '2027-03-27' },
    { label: '28-03-2027, 00:00 CET', instant: '2027-03-27T23:00:00.000Z', expected: '2027-03-28' },
    { label: '28-03-2027, 01:59 CET, antes del salto', instant: '2027-03-28T00:59:59.999Z', expected: '2027-03-28' },
    { label: '28-03-2027, 03:00 CEST, tras el salto', instant: '2027-03-28T01:00:00.000Z', expected: '2027-03-28' },
    { label: '28-03-2027, último instante de su día de 23 horas', instant: '2027-03-28T21:59:59.999Z', expected: '2027-03-28' },
    { label: '29-03-2027, medianoche ya en CEST', instant: '2027-03-28T22:00:00.000Z', expected: '2027-03-29' },
    { label: 'cambio de mes, 30 de septiembre a última hora', instant: '2026-09-30T21:59:59.999Z', expected: '2026-09-30' },
    { label: 'cambio de mes, 1 de octubre a medianoche', instant: '2026-09-30T22:00:00.000Z', expected: '2026-10-01' },
    { label: 'cambio de año, 31 de diciembre a última hora', instant: '2026-12-31T22:59:59.999Z', expected: '2026-12-31' },
    { label: 'cambio de año, 1 de enero a medianoche', instant: '2026-12-31T23:00:00.000Z', expected: '2027-01-01' },
    { label: 'mes y día de una cifra, rellenados', instant: '2027-02-03T10:00:00.000Z', expected: '2027-02-03' },
  ])('$label', ({ instant, expected }) => {
    const result = madridDateOf(new Date(instant))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe(expected)
  })
})

describe('addCalendarDays', () => {
  it.each([
    { date: '2026-10-05', days: 0, expected: '2026-10-05' },
    { date: '2026-10-05', days: 1, expected: '2026-10-06' },
    { date: '2026-10-05', days: -3, expected: '2026-10-02' },
    { date: '2026-10-24', days: 1, expected: '2026-10-25' },
    { date: '2026-10-25', days: 1, expected: '2026-10-26' },
    { date: '2027-03-28', days: 1, expected: '2027-03-29' },
    { date: '2026-09-30', days: 1, expected: '2026-10-01' },
    { date: '2026-12-31', days: 1, expected: '2027-01-01' },
    { date: '2027-01-01', days: -1, expected: '2026-12-31' },
    { date: '2028-02-28', days: 1, expected: '2028-02-29' },
  ])('$date + $days → $expected', ({ date, days, expected }) => {
    expect(addCalendarDays(date, days)).toBe(expected)
  })
})

describe('calendarDaysBetween', () => {
  it.each([
    { from: '2026-10-05', to: '2026-10-05', expected: 0 },
    { from: '2026-10-05', to: '2026-10-06', expected: 1 },
    { from: '2026-10-06', to: '2026-10-05', expected: -1 },
    { from: '2026-10-24', to: '2026-10-26', expected: 2 },
    { from: '2027-03-27', to: '2027-03-29', expected: 2 },
    { from: '2026-09-30', to: '2026-10-01', expected: 1 },
    { from: '2026-12-31', to: '2027-01-01', expected: 1 },
    { from: '2028-02-28', to: '2028-03-01', expected: 2 },
    { from: '2026-10-05', to: '2026-11-04', expected: 30 },
  ])('de $from a $to → $expected', ({ from, to, expected }) => {
    expect(calendarDaysBetween(from, to)).toBe(expected)
  })
})
