import { describe, expect, it } from 'vitest'

import { formatForecastHeadline } from './format-forecast-headline.ts'

describe('formatForecastHeadline', () => {
  it('formatea día de la semana, día y mes en mayúsculas', () => {
    expect(formatForecastHeadline('2026-09-12')).toBe('PREVISIÓN · SÁBADO 12 DE SEPTIEMBRE')
  })

  it('no depende de ceros a la izquierda ni de la zona horaria del entorno', () => {
    expect(formatForecastHeadline('2026-01-01')).toBe('PREVISIÓN · JUEVES 1 DE ENERO')
  })
})
