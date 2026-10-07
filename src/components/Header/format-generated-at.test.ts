import { describe, expect, it } from 'vitest'

import { formatGeneratedAt } from './format-generated-at.ts'

describe('formatGeneratedAt', () => {
  it.each([
    { label: 'verano (CEST, UTC+2)', generatedAt: '2026-10-04T11:34:48.201Z', expected: 'domingo 4 de octubre a las 13:34' },
    { label: 'invierno (CET, UTC+1)', generatedAt: '2026-12-15T11:05:00.000Z', expected: 'martes 15 de diciembre a las 12:05' },
    { label: 'medianoche de Madrid, ya del día siguiente que en UTC', generatedAt: '2026-10-04T22:00:00.000Z', expected: 'lunes 5 de octubre a las 00:00' },
    { label: '25-10-2026, la hora repetida en CEST', generatedAt: '2026-10-25T00:30:00.000Z', expected: 'domingo 25 de octubre a las 02:30' },
    { label: '25-10-2026, la hora repetida en CET', generatedAt: '2026-10-25T01:30:00.000Z', expected: 'domingo 25 de octubre a las 02:30' },
    { label: '28-03-2027, justo tras el salto', generatedAt: '2027-03-28T01:00:00.000Z', expected: 'domingo 28 de marzo a las 03:00' },
    { label: 'cambio de año en Madrid', generatedAt: '2026-12-31T23:15:00.000Z', expected: 'viernes 1 de enero a las 00:15' },
  ])('$label', ({ generatedAt, expected }) => {
    expect(formatGeneratedAt(generatedAt)).toBe(`Previsión generada el ${expected} (hora peninsular)`)
  })
})
