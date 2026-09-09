import { describe, expect, it } from 'vitest'

import {
  buildMeta,
  computeGroupFailureRatio,
  computePrimaryFailureRatio,
  decideAbort,
  hasSystemicComplementFailure,
  MAX_FAILED_LOCATIONS_RATIO,
  SYSTEMIC_COMPLEMENT_FAILURE_RATIO,
} from './fault-tolerance.ts'

describe('computePrimaryFailureRatio', () => {
  it.each([
    { total: 74, failed: 0, expected: 0 },
    { total: 74, failed: 7, expected: 7 / 74 },
    { total: 74, failed: 74, expected: 1 },
    { total: 0, failed: 0, expected: 0 },
  ])('total=$total failed=$failed -> $expected', ({ total, failed, expected }) => {
    expect(computePrimaryFailureRatio(total, failed)).toBeCloseTo(expected, 10)
  })
})

describe('computeGroupFailureRatio', () => {
  it.each([
    { attempted: 0, failed: 0, expected: 0 },
    { attempted: 65, failed: 0, expected: 0 },
    { attempted: 65, failed: 33, expected: 33 / 65 },
    { attempted: 8, failed: 8, expected: 1 },
  ])('attempted=$attempted failed=$failed -> $expected', ({ attempted, failed, expected }) => {
    expect(computeGroupFailureRatio({ attempted, failed })).toBeCloseTo(expected, 10)
  })
})

describe('hasSystemicComplementFailure — cuenta intentos por lugar, no entradas de degradations', () => {
  it('un intento por lugar, no una entrada por métrica: España (2 métricas/lugar) y Portugal (4 métricas/lugar) se comparan igual', () => {
    // Mismo escenario real: falla el complemento de Open-Meteo para 5 de los
    // 8 lugares de Portugal (62.5% de LUGARES, no de degradaciones — cada
    // fallo ahí generaría 4 entradas en `degradations`, pero cuenta 1 aquí).
    const tallies = {
      'open-meteo→portugal': { attempted: 8, failed: 5 },
    }
    expect(hasSystemicComplementFailure(tallies)).toBe(true)
  })

  it('ningún grupo supera el umbral: no hay fallo sistémico', () => {
    const tallies = {
      'open-meteo→españa': { attempted: 65, failed: 30 }, // 46% < 50%
      'open-meteo→portugal': { attempted: 8, failed: 3 }, // 37.5% < 50%
    }
    expect(hasSystemicComplementFailure(tallies)).toBe(false)
  })

  it('basta con que un grupo supere el umbral, aunque los demás estén bien', () => {
    const tallies = {
      'open-meteo→españa': { attempted: 65, failed: 5 }, // ~7.7%, bien
      'open-meteo-marine': { attempted: 28, failed: 20 }, // ~71%, mal
    }
    expect(hasSystemicComplementFailure(tallies)).toBe(true)
  })

  it('exactamente el umbral (50%) no cuenta como fallo sistémico — es un ">", no un ">="', () => {
    const tallies = { grupo: { attempted: 10, failed: 5 } } // exactamente 50%
    expect(hasSystemicComplementFailure(tallies)).toBe(false)
  })

  it('sin grupos: no hay fallo sistémico', () => {
    expect(hasSystemicComplementFailure({})).toBe(false)
  })

  it('acepta un umbral distinto al de partida', () => {
    const tallies = { grupo: { attempted: 10, failed: 3 } } // 30%
    expect(hasSystemicComplementFailure(tallies, 0.2)).toBe(true)
    expect(hasSystemicComplementFailure(tallies, 0.4)).toBe(false)
  })
})

describe('decideAbort — dos condiciones independientes, nunca mezcladas en una cifra', () => {
  it('ninguna condición superada: no aborta', () => {
    const result = decideAbort(0.05, false)
    expect(result.shouldAbort).toBe(false)
    expect(result.reason).toBeUndefined()
  })

  it('solo primaryFailureRatio superado: aborta por esa razón', () => {
    const result = decideAbort(0.15, false)
    expect(result.shouldAbort).toBe(true)
    expect(result.reason).toBe('primary_failure_ratio')
    expect(result.hasSystemicComplementFailure).toBe(false)
  })

  it('solo fallo sistémico de complemento (primaryFailureRatio bajo): aborta igual, por esa razón', () => {
    const result = decideAbort(0.02, true)
    expect(result.shouldAbort).toBe(true)
    expect(result.reason).toBe('systemic_complement_failure')
    expect(result.primaryFailureRatio).toBeCloseTo(0.02, 10)
  })

  it('las dos condiciones a la vez: aborta con razón "both", sin combinar los ratios en un número', () => {
    const result = decideAbort(0.2, true)
    expect(result.shouldAbort).toBe(true)
    expect(result.reason).toBe('both')
    // Cada condición se conserva tal cual se recibió, no una mezcla.
    expect(result.primaryFailureRatio).toBeCloseTo(0.2, 10)
    expect(result.hasSystemicComplementFailure).toBe(true)
  })

  it('exactamente en el umbral de primaryFailureRatio no aborta por sí solo — es un ">", no un ">="', () => {
    const result = decideAbort(MAX_FAILED_LOCATIONS_RATIO, false)
    expect(result.shouldAbort).toBe(false)
  })

  it('respeta un umbral de primaryFailureRatio distinto al de partida', () => {
    expect(decideAbort(0.15, false, 0.2).shouldAbort).toBe(false)
    expect(decideAbort(0.15, false, 0.1).shouldAbort).toBe(true)
  })
})

describe('constantes', () => {
  it('los valores de partida son los aprobados', () => {
    expect(MAX_FAILED_LOCATIONS_RATIO).toBe(0.1)
    expect(SYSTEMIC_COMPLEMENT_FAILURE_RATIO).toBe(0.5)
  })
})

describe('buildMeta', () => {
  it('calcula successfulLocations como total menos fallidos, sin necesidad de contar locations[] a mano', () => {
    expect(buildMeta(74, ['huescar', 'alcaniz'])).toEqual({
      totalLocations: 74,
      successfulLocations: 72,
      failedLocations: ['huescar', 'alcaniz'],
    })
  })

  it('sin fallos: successfulLocations igual al total, failedLocations vacío', () => {
    expect(buildMeta(74, [])).toEqual({
      totalLocations: 74,
      successfulLocations: 74,
      failedLocations: [],
    })
  })
})
