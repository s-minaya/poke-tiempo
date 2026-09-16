const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: 'UTC' })
const MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' })

/**
 * "PREVISIÓN · [día de la semana] [día] DE [mes]" a partir de
 * `forecast.date` (`YYYY-MM-DD`) tal cual llega — no calcula ningún día,
 * `forecast.date` ya es la fecha final (`target-date.ts`, 002). Los
 * componentes se pasan por `Date.UTC` solo para formatearlos con `Intl` con
 * `timeZone: 'UTC'` explícito — mismo motivo que `target-date.ts`: sin eso,
 * `Intl.DateTimeFormat` usaría la zona horaria del entorno de ejecución y
 * podría mostrar un día distinto al que trae `forecast.date`.
 */
export function formatForecastHeadline(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const reference = new Date(Date.UTC(year, month - 1, day))
  const weekday = WEEKDAY_FORMATTER.format(reference).toUpperCase()
  const monthName = MONTH_FORMATTER.format(reference).toUpperCase()
  return `PREVISIÓN · ${weekday} ${day} DE ${monthName}`
}
