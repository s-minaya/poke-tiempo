import type { ForecastFreshness, FreshnessStatus } from '../../domain/forecast-freshness.ts'

import { formatForecastDay, formatForecastHeadline } from '../Header/format-forecast-headline.ts'

/**
 * Los textos de frescura de la página (`010-spec.md` → Textos), en un solo
 * sitio: la cabecera y el aviso los pintan, y la región viva los repite.
 * Solo dicen la fecha del dataset y cuántos días lleva de retraso; nunca qué
 * hay publicado.
 */

export interface FreshnessLabel {
  text: string
  late: boolean
}

// La etiqueta relativa, junto a la fecha. En minúsculas por el mismo motivo
// que la fecha: la mayúscula la pone el CSS. `unknown` no lleva ninguna.
export const FRESHNESS_LABELS: Record<FreshnessStatus, FreshnessLabel | null> = {
  today: { text: 'hoy', late: false },
  tomorrow: { text: 'mañana', late: false },
  late: { text: 'atrasada', late: true },
  'very-late': { text: 'atrasada', late: true },
  unknown: null,
}

/** `late`, en la cabecera. */
export function oneDayLateText(forecastDate: string): string {
  return `Esta previsión corresponde al ${formatForecastDay(forecastDate)} y lleva 1 día de retraso.`
}

/** `very-late`, título del aviso. */
export function daysLateText(daysLate: number): string {
  return `Esta previsión lleva ${daysLate} días de retraso.`
}

/** `very-late`, debajo del título del aviso. */
export function correspondsToText(forecastDate: string): string {
  return `Corresponde al ${formatForecastDay(forecastDate)}.`
}

/** La oferta de recargar: «comprobar», sin afirmar que haya una más reciente. */
export function reloadOfferText(forecastDate: string): string {
  return `Esta página sigue mostrando la previsión del ${formatForecastDay(forecastDate)}. Recarga para comprobar si hay una más reciente.`
}

/**
 * Lo que dice la región viva cuando cambia el estado: los textos de
 * frescura que la página muestra en ese momento, en su orden —la fecha con
 * su etiqueta, como la lee la cabecera; la frase o el aviso de retraso; y la
 * oferta de recargar—. Ningún texto propio.
 */
export function announceFreshness(forecastDate: string, freshness: ForecastFreshness, offerReload: boolean): string {
  const label = FRESHNESS_LABELS[freshness.status]
  const parts = [`${formatForecastHeadline(forecastDate)}${label ? `, ${label.text}` : ''}.`]

  if (freshness.status === 'late') parts.push(oneDayLateText(forecastDate))
  if (freshness.status === 'very-late') parts.push(daysLateText(freshness.daysLate), correspondsToText(forecastDate))
  if (offerReload) parts.push(reloadOfferText(forecastDate))

  return parts.join(' ')
}
