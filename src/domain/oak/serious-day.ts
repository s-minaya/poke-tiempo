import type { DayModeDecision } from './day-mode.ts'

/**
 * Los días en los que Oak no bromea.
 *
 * La regla no vive en el prompt: vive aquí y se aplica en el reparto de
 * diálogos, de forma que un día serio **no puede** salir con un gag ni con
 * tono `guasa` aunque quien redacte se despiste. El prompt la repite porque
 * el texto también tiene que sonar sobrio, pero si el prompt fallara el día
 * seguiría sin humor.
 *
 * Hoy la única causa es un aviso oficial, que es lo único grave que nuestros
 * datos saben reconocer: `alerta` solo se activa con naranja o rojo. Cuando
 * aparezca otra —y no tiene por qué ser meteorológica— se añade a este
 * módulo y al resto del sistema no le cambia nada: `DayPlan.serious` ya es
 * la respuesta que todos consultan.
 */
export type SeriousDayReason = 'aviso-oficial'

/**
 * Por qué hoy es un día serio, o `null` si no lo es. Devuelve el motivo y no
 * un booleano para que añadir una causa nueva sea añadir una rama con
 * nombre, no un `||` más largo.
 */
export function seriousDayReason(decision: DayModeDecision): SeriousDayReason | null {
  return decision.mode === 'alerta' ? 'aviso-oficial' : null
}

export function isSeriousDay(decision: DayModeDecision): boolean {
  return seriousDayReason(decision) !== null
}
