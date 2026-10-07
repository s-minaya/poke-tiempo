import { describe, expect, it } from 'vitest'

import { formatForecastDay, formatForecastHeadline } from './format-forecast-headline.ts'

describe('formatForecastDay', () => {
  it.each([
    { date: '2026-09-12', expected: 'sábado 12 de septiembre' },
    { date: '2026-10-05', expected: 'lunes 5 de octubre' },
    { date: '2026-01-01', expected: 'jueves 1 de enero' },
    { date: '2026-10-07', expected: 'miércoles 7 de octubre' },
  ])('$date → $expected, sin ceros a la izquierda ni zona horaria del entorno', ({ date, expected }) => {
    expect(formatForecastDay(date)).toBe(expected)
  })
})

describe('formatForecastHeadline', () => {
  it('dice para qué fecha es la previsión, en minúsculas', () => {
    expect(formatForecastHeadline('2026-10-05')).toBe('Previsión para el lunes 5 de octubre')
  })
})
