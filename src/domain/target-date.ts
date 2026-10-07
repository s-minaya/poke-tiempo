import { addCalendarDays, madridDateOf } from './madrid-calendar.ts'

/**
 * La fecha calendario de referencia de todo el pipeline (`002-plan.md` →
 * `targetDate`): PokéTiempo muestra la previsión de mañana, no la de hoy.
 * "Mañana" se calcula respecto a `Europe/Madrid`, no a UTC — a las 06:00 UTC
 * del cron de producción da el mismo resultado, pero una ejecución manual
 * cerca de medianoche en Madrid podría no coincidir con "mañana" en UTC.
 *
 * La fecha de Madrid de `now` sale de `madridDateOf`, la misma que usa la
 * página para decidir qué día es hoy; sumar un día es aritmética de
 * calendario pura (`madrid-calendar.ts`), sin zona horaria ni DST que pueda
 * desplazarla.
 */
export function computeTargetDate(now: Date): string {
  return addCalendarDays(madridDateOf(now), 1)
}
