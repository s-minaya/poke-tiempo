/**
 * La única referencia temporal del producto (`010-spec.md`): el pipeline
 * decide con ella qué día publica y la página, qué día es «hoy».
 */
export const MADRID_TIME_ZONE = 'Europe/Madrid'

// Calendario gregoriano y dígitos latinos explícitos: el resultado no depende
// del locale por defecto del runtime. Solo se leen las partes, nunca el texto
// que `format()` compondría con ellas.
const madridDateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: MADRID_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

const MS_PER_CALENDAR_DAY = 24 * 60 * 60 * 1000

function partValue(parts: Intl.DateTimeFormatPart[], type: 'year' | 'month' | 'day'): number {
  return Number(parts.find((part) => part.type === type)!.value)
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function utcMidnight(date: string, plusDays = 0): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day + plusDays)
}

/** La fecha `YYYY-MM-DD` que marca el calendario de Madrid en ese instante. */
export function madridDateOf(instant: Date): string {
  const parts = madridDateParts.formatToParts(instant)
  return toIsoDate(partValue(parts, 'year'), partValue(parts, 'month'), partValue(parts, 'day'))
}

/**
 * Suma días a una fecha de calendario. Es aritmética sobre la medianoche UTC
 * de esa fecha, no sobre un instante real: `Date.UTC` normaliza un «día 32»
 * al mes siguiente él solo, y en UTC no hay cambios de hora que la desplacen.
 */
export function addCalendarDays(date: string, days: number): string {
  return new Date(utcMidnight(date, days)).toISOString().slice(0, 10)
}

/**
 * Cuántos días de calendario van de `from` a `to`: positivo si `to` es
 * posterior. Divide la distancia entre dos medianoches UTC, que siempre es un
 * múltiplo exacto de 24 horas; nunca la de dos instantes reales, que en los
 * días de 23 y 25 horas de Madrid no lo es.
 */
export function calendarDaysBetween(from: string, to: string): number {
  return (utcMidnight(to) - utcMidnight(from)) / MS_PER_CALENDAR_DAY
}
