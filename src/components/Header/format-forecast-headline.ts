const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: 'UTC' })
const MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' })

/**
 * «lunes 5 de octubre» a partir de `forecast.date` (`YYYY-MM-DD`) tal cual
 * llega — no calcula ningún día, `forecast.date` ya es la fecha final
 * (`target-date.ts`, 002). Los componentes se pasan por `Date.UTC` solo para
 * formatearlos con `Intl` con `timeZone: 'UTC'` explícito: sin eso,
 * `Intl.DateTimeFormat` usaría la zona horaria del entorno de ejecución y
 * podría mostrar un día distinto al que trae `forecast.date`.
 */
export function formatForecastDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const reference = new Date(Date.UTC(year, month - 1, day))
  return `${WEEKDAY_FORMATTER.format(reference)} ${day} de ${MONTH_FORMATTER.format(reference)}`
}

/**
 * «Previsión para el lunes 5 de octubre». En minúsculas: la mayúscula de la
 * cabecera la pone el CSS, para que un lector de pantalla no deletree.
 */
export function formatForecastHeadline(date: string): string {
  return `Previsión para el ${formatForecastDay(date)}`
}
