const REFERENCE_TIMEZONE = 'Europe/Madrid'

/**
 * La fecha calendario de referencia de todo el pipeline (`002-plan.md` →
 * `targetDate`): PokéTiempo muestra la previsión de mañana, no la de hoy.
 * "Mañana" se calcula respecto a `Europe/Madrid`, no a UTC — a las 06:00 UTC
 * del cron de producción da el mismo resultado, pero una ejecución manual
 * cerca de medianoche en Madrid podría no coincidir con "mañana" en UTC.
 *
 * `Intl.DateTimeFormat` (parte del runtime, sin dependencia de fechas) da
 * los componentes año/mes/día de `now` en esa zona horaria; sumar un día a
 * partir de ahí es aritmética de calendario pura (`Date.UTC` normaliza un
 * "día 32" al mes siguiente él solo) — no una instancia real de tiempo, así
 * que no hay zona horaria ni DST que pueda desplazarla.
 */
export function computeTargetDate(now: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: REFERENCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')!.value)
  const month = Number(parts.find((part) => part.type === 'month')!.value)
  const day = Number(parts.find((part) => part.type === 'day')!.value)

  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1))
  return tomorrow.toISOString().slice(0, 10)
}
