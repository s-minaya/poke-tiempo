import type { Forecast } from './types.ts'

/**
 * Política de tolerancia a fallos (`002-plan.md`): dos condiciones de aborto
 * **independientes**, nunca convertidas en una sola cifra. Fallo de fuente
 * principal excluye el lugar entero y cuenta para `primaryFailureRatio`;
 * fallo de una fuente complementaria degrada solo esa métrica y nunca
 * cuenta ahí — alimenta, aparte, el ratio de fallo sistémico de su propio
 * grupo (fuente complementaria × lugares que la usan).
 */

export const MAX_FAILED_LOCATIONS_RATIO = 0.1
export const SYSTEMIC_COMPLEMENT_FAILURE_RATIO = 0.5

export function computePrimaryFailureRatio(totalLocations: number, failedLocationsCount: number): number {
  return totalLocations === 0 ? 0 : failedLocationsCount / totalLocations
}

/**
 * Un intento de complemento por lugar (no por métrica): el complemento de
 * Open-Meteo para un lugar es una única llamada — si falla, degrada varias
 * métricas a la vez (2 en España, 4 en Portugal), pero es **un solo intento
 * fallido**, no varios. Contar `degradations.length` aquí sobrecontaría
 * Portugal el cuádruple que España para el mismo fallo real.
 */
export interface ComplementGroupTally {
  attempted: number
  failed: number
}

export function computeGroupFailureRatio(tally: ComplementGroupTally): number {
  return tally.attempted === 0 ? 0 : tally.failed / tally.attempted
}

/**
 * `tallies` es un intento por lugar y grupo (p. ej. "open-meteo→españa",
 * "open-meteo→portugal", "open-meteo-marine") — nunca una cuenta de
 * `Degradation[]`. Ver la nota de `ComplementGroupTally`.
 */
export function hasSystemicComplementFailure(
  tallies: Record<string, ComplementGroupTally>,
  ratioThreshold: number = SYSTEMIC_COMPLEMENT_FAILURE_RATIO,
): boolean {
  return Object.values(tallies).some((tally) => computeGroupFailureRatio(tally) > ratioThreshold)
}

export type AbortReason = 'primary_failure_ratio' | 'systemic_complement_failure' | 'both'

export interface AbortDecision {
  shouldAbort: boolean
  reason?: AbortReason
  primaryFailureRatio: number
  hasSystemicComplementFailure: boolean
}

/**
 * Las dos condiciones se evalúan y se reciben ya calculadas, cada una por
 * su cuenta — esta función solo las combina con OR para la decisión final,
 * nunca las mezcla en una cifra intermedia.
 */
export function decideAbort(
  primaryFailureRatio: number,
  systemicComplementFailure: boolean,
  maxFailedLocationsRatio: number = MAX_FAILED_LOCATIONS_RATIO,
): AbortDecision {
  const primaryExceeded = primaryFailureRatio > maxFailedLocationsRatio
  const reason: AbortReason | undefined =
    primaryExceeded && systemicComplementFailure
      ? 'both'
      : primaryExceeded
        ? 'primary_failure_ratio'
        : systemicComplementFailure
          ? 'systemic_complement_failure'
          : undefined

  return {
    shouldAbort: primaryExceeded || systemicComplementFailure,
    reason,
    primaryFailureRatio,
    hasSystemicComplementFailure: systemicComplementFailure,
  }
}

export function buildMeta(totalLocations: number, failedLocationIds: string[]): Forecast['meta'] {
  return {
    totalLocations,
    successfulLocations: totalLocations - failedLocationIds.length,
    failedLocations: failedLocationIds,
  }
}
