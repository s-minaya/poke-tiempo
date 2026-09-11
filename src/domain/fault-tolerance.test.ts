import { describe, expect, it } from 'vitest'

import {
  buildMeta,
  computeGroupFailureRatio,
  decideAbort,
  hasSystemicComplementFailure,
  SYSTEMIC_COMPLEMENT_FAILURE_RATIO,
} from './fault-tolerance.ts'

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

describe('decideAbort — dos condiciones independientes, nunca mezcladas en una cifra; tolerancia cero a lugares fallidos', () => {
  it('sin lugares fallidos ni fallo sistémico: no aborta', () => {
    const result = decideAbort(0, false)
    expect(result.shouldAbort).toBe(false)
    expect(result.reason).toBeUndefined()
  })

  it('un único lugar fallido ya aborta — no hay margen tolerable', () => {
    const result = decideAbort(1, false)
    expect(result.shouldAbort).toBe(true)
    expect(result.reason).toBe('location_failure')
    expect(result.failedLocationsCount).toBe(1)
  })

  it('solo fallo sistémico de complemento (sin lugares fallidos): aborta igual, por esa razón', () => {
    const result = decideAbort(0, true)
    expect(result.shouldAbort).toBe(true)
    expect(result.reason).toBe('systemic_complement_failure')
    expect(result.failedLocationsCount).toBe(0)
  })

  it('las dos condiciones a la vez: aborta con razón "both", sin combinar nada en un número', () => {
    const result = decideAbort(3, true)
    expect(result.shouldAbort).toBe(true)
    expect(result.reason).toBe('both')
    expect(result.failedLocationsCount).toBe(3)
    expect(result.hasSystemicComplementFailure).toBe(true)
  })
})

describe('constantes', () => {
  it('el umbral sistémico de complemento sigue siendo el aprobado', () => {
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
