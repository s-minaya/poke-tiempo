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
    expect(normalizeOpenMeteoMarine(marine)).toEqual({
      waveHeightM: 1.52,
      wavePeriodS: 9.05,
      waveDirectionDeg: 299,
      source: 'open-meteo',
    })
  })
})

describe('normalizeOpenMeteoMarine — sin dato válido', () => {
  it('devuelve null en vez de fabricar un valor si algún campo falta', () => {
    const marine: OpenMeteoMarineResponse = {
      daily: { wave_height_max: [], wave_period_max: [], wave_direction_dominant: [] },
    }
    expect(normalizeOpenMeteoMarine(marine)).toEqual({
      waveHeightM: null,
      wavePeriodS: null,
      waveDirectionDeg: null,
      source: 'open-meteo',
    })
  })
})
