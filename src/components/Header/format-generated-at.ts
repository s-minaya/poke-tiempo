import { MADRID_TIME_ZONE } from '../../domain/madrid-calendar.ts'

const GENERATED_AT_PARTS = new Intl.DateTimeFormat('es-ES', {
  timeZone: MADRID_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * «Previsión generada el domingo 4 de octubre a las 13:34 (hora peninsular)»
 * a partir de `forecast.generatedAt`: el instante de generación del
 * forecast, fijado justo antes de escribir `forecast.json`, después de
 * obtener y validar el dataset (`010-plan.md`). No es la hora en que se
 * consultó cada proveedor. Se compone con las partes de `formatToParts`, en
 * hora de Madrid, sin depender del texto que el locale arme con ellas.
 */
export function formatGeneratedAt(generatedAt: string): string {
  const parts = GENERATED_AT_PARTS.formatToParts(new Date(generatedAt))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)!.value

  const hour = part('hour').padStart(2, '0')
  const minute = part('minute').padStart(2, '0')
  return `Previsión generada el ${part('weekday')} ${Number(part('day'))} de ${part('month')} a las ${hour}:${minute} (hora peninsular)`
}
