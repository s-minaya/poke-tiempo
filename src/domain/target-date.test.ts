import { describe, expect, it } from 'vitest'

import { computeTargetDate } from './target-date.ts'

describe('computeTargetDate', () => {
  it('mañana en un momento normal del día (CEST, UTC+2 en verano)', () => {
    expect(computeTargetDate(new Date('2026-09-09T10:00:00Z'))).toBe('2026-09-10')
  })

  it('cerca de medianoche en Madrid (CET, UTC+1 en invierno): "hoy" ya es el día siguiente en Madrid aunque no en UTC', () => {
    // 2026-01-14T23:30:00Z son las 2026-01-15T00:30 en Madrid (UTC+1) — un
    // cálculo puramente en UTC diría "hoy es 14, mañana 15"; en Madrid "hoy"
    // ya es 15, así que "mañana" tiene que ser 16.
    expect(computeTargetDate(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-16')
  })

  it('cerca de medianoche en Madrid (CEST, UTC+2 en verano)', () => {
    // 2026-07-14T22:30:00Z son las 2026-07-15T00:30 en Madrid (UTC+2).
    expect(computeTargetDate(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-16')
  })

  it('cambio de mes', () => {
    expect(computeTargetDate(new Date('2026-01-31T10:00:00Z'))).toBe('2026-02-01')
  })

  it('cambio de año', () => {
    expect(computeTargetDate(new Date('2026-12-31T10:00:00Z'))).toBe('2027-01-01')
  })

  it('29 de febrero en año bisiesto', () => {
    expect(computeTargetDate(new Date('2028-02-28T10:00:00Z'))).toBe('2028-02-29')
  })
})
