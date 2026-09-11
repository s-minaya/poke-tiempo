import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { OpenMeteoMarineResponse } from './open-meteo-marine.ts'
import { normalizeOpenMeteoMarine } from './open-meteo-marine.ts'

function readFixture<T>(name: string): T {
  const path = join(import.meta.dirname, '__fixtures__', name)
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

describe('normalizeOpenMeteoMarine — dato real (costa de Lisboa)', () => {
  it('lee altura, periodo y dirección de ola sin conversión de unidades', () => {
    const marine = readFixture<OpenMeteoMarineResponse>('open-meteo-marine-lisboa.json')
    expect(normalizeOpenMeteoMarine(marine, '2026-09-08')).toEqual({
      waveHeightM: 1.52,
      wavePeriodS: 9.05,
      waveDirectionDeg: 299,
      source: 'open-meteo',
    })
  })

  it('targetDate ausente de la respuesta: falla en vez de caer al primer día (Marine se pide con start_date/end_date=targetDate, así que esto solo pasaría si la API devolviera algo distinto a lo pedido)', () => {
    const marine = readFixture<OpenMeteoMarineResponse>('open-meteo-marine-lisboa.json')
    expect(() => normalizeOpenMeteoMarine(marine, '2026-09-09')).toThrow(/2026-09-09/)
  })
})

describe('normalizeOpenMeteoMarine — sin dato válido', () => {
  it('devuelve null en vez de fabricar un valor si algún campo concreto falta, aunque el día sí aparezca', () => {
    const marine: OpenMeteoMarineResponse = {
      daily: { time: ['2026-09-08'], wave_height_max: [], wave_period_max: [], wave_direction_dominant: [] },
    }
    expect(normalizeOpenMeteoMarine(marine, '2026-09-08')).toEqual({
      waveHeightM: null,
      wavePeriodS: null,
      waveDirectionDeg: null,
      source: 'open-meteo',
    })
  })
})
