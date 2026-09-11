import type { Forecast } from './types.ts'

/**
 * Política de tolerancia a fallos (`002-plan.md`): dos condiciones de aborto
 * **independientes**, nunca convertidas en una sola cifra.
 *
 * **Tolerancia cero a lugares sin weather.** Con el fallback completo de
 * Open-Meteo de por medio (`scripts/orchestrate-location.ts`), un lugar solo
 * queda fuera de `locations` si falló tanto en su fuente principal como en
 * el fallback — y eso ya no es tolerable: `forecast.json` solo se escribe
 * con los 74 lugares. No hay ratio que calcular cuando el umbral es "cero".
 *
 * El fallo de una fuente **complementaria** (Open-Meteo enriqueciendo
 * `precipitation`/`snow`/`wind` para un lugar cuya principal sí respondió)
 * es un problema distinto, sin cambios: degrada solo esa métrica sin
 * invalidar el lugar, y alimenta, aparte, el ratio de fallo sistémico de su
 * propio grupo (fuente complementaria × lugares que la usan).
 */

export const SYSTEMIC_COMPLEMENT_FAILURE_RATIO = 0.5

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
 * `Degradation[]`. Ver la nota de `ComplementGroupTally`. Un lugar que usó
 * el fallback completo (`usedFallback: true`) no entra en ningún grupo — ver
 * `orchestrate-location.ts`.
 */
export function hasSystemicComplementFailure(
  tallies: Record<string, ComplementGroupTally>,
  ratioThreshold: number = SYSTEMIC_COMPLEMENT_FAILURE_RATIO,
): boolean {
  return Object.values(tallies).some((tally) => computeGroupFailureRatio(tally) > ratioThreshold)
}

export type AbortReason = 'location_failure' | 'systemic_complement_failure' | 'both'

export interface AbortDecision {
  shouldAbort: boolean
  reason?: AbortReason
  failedLocationsCount: number
  hasSystemicComplementFailure: boolean
}

/**
 * Las dos condiciones se evalúan y se reciben ya calculadas, cada una por
 * su cuenta — esta función solo las combina con OR para la decisión final,
 * nunca las mezcla en una cifra intermedia.
 */
export function decideAbort(failedLocationsCount: number, systemicComplementFailure: boolean): AbortDecision {
  const hasFailedLocations = failedLocationsCount > 0
  const reason: AbortReason | undefined =
    hasFailedLocations && systemicComplementFailure
      ? 'both'
      : hasFailedLocations
        ? 'location_failure'
        : systemicComplementFailure
          ? 'systemic_complement_failure'
          : undefined

  return {
    shouldAbort: hasFailedLocations || systemicComplementFailure,
    reason,
    failedLocationsCount,
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
