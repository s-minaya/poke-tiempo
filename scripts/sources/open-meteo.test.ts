import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { OpenMeteoDailyResponse } from './open-meteo.ts'
import { normalizeOpenMeteoComplement, normalizeOpenMeteoPrimary } from './open-meteo.ts'

function readFixture<T>(name: string): T {
  const path = join(import.meta.dirname, '__fixtures__', name)
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function dailyWithCode(weatherCode: number, overrides: Partial<OpenMeteoDailyResponse['daily']> = {}): OpenMeteoDailyResponse {
  return {
    daily: {
      time: ['2026-01-15'],
      temperature_2m_max: [10],
      temperature_2m_min: [2],
      rain_sum: [0],
      showers_sum: [0],
      snowfall_sum: [0],
      precipitation_probability_max: [0],
      wind_speed_10m_max: [10],
      wind_gusts_10m_max: [20],
      weather_code: [weatherCode],
      ...overrides,
    },
  }
}

describe('normalizeOpenMeteoPrimary — día real con fenómeno (Andorra)', () => {
  const dailyAndorra = readFixture<OpenMeteoDailyResponse>('open-meteo-daily-andorra.json')
  const result = normalizeOpenMeteoPrimary(dailyAndorra, '2026-09-08')

  it('targetDate ausente de la respuesta: falla en vez de caer al primer día (se pide con start_date/end_date=targetDate, así que esto solo pasaría si la API devolviera otra cosa)', () => {
    expect(() => normalizeOpenMeteoPrimary(dailyAndorra, '2026-09-09')).toThrow(/2026-09-09/)
  })

  it('lee fecha y temperatura', () => {
    expect(result.date).toBe('2026-09-08')
    expect(result.temperature).toEqual({ maxC: 31.1, minC: 19.9 })
  })

  it('construye mm de lluvia como rain_sum + showers_sum, con la probabilidad aparte', () => {
    expect(result.precipitation?.mm).toBeCloseTo(0.1, 5)
    expect(result.precipitation?.probabilityPercent).toBe(18)
  })

  it('código 51 (light drizzle) es un fenómeno sin nubosidad asociada: sky null', () => {
    expect(result.sky).toBeNull()
    expect(result.primarySourceDescription).toBe('Light drizzle')
  })

  it('no detecta nieve, tormenta ni niebla; calima siempre null', () => {
    expect(result.snow).toEqual({ cm: 0, present: false })
    expect(result.storm).toBe(false)
    expect(result.fog).toBe(false)
    expect(result.calima).toBeNull()
  })

  it('toma viento sostenido y racha del día', () => {
    expect(result.wind).toEqual({ speedKmh: 13.5, gustKmh: 39.2 })
  })
})

describe('normalizeOpenMeteoPrimary — códigos de solo nubosidad (0-3)', () => {
  it('mapea 0/1/2/3 a despejado/poco_nuboso/nuboso/cubierto', () => {
    expect(normalizeOpenMeteoPrimary(dailyWithCode(0), '2026-01-15').sky).toBe('despejado')
    expect(normalizeOpenMeteoPrimary(dailyWithCode(1), '2026-01-15').sky).toBe('poco_nuboso')
    expect(normalizeOpenMeteoPrimary(dailyWithCode(2), '2026-01-15').sky).toBe('nuboso')
    expect(normalizeOpenMeteoPrimary(dailyWithCode(3), '2026-01-15').sky).toBe('cubierto')
  })
})

describe('normalizeOpenMeteoPrimary — fenómenos', () => {
  it('tormenta (95, 96, 99): sky null, storm true', () => {
    for (const code of [95, 96, 99]) {
      const result = normalizeOpenMeteoPrimary(dailyWithCode(code), '2026-01-15')
      expect(result.storm).toBe(true)
      expect(result.sky).toBeNull()
    }
  })

  it('niebla (45, 48): sky null, fog true', () => {
    for (const code of [45, 48]) {
      const result = normalizeOpenMeteoPrimary(dailyWithCode(code), '2026-01-15')
      expect(result.fog).toBe(true)
      expect(result.sky).toBeNull()
    }
  })

  it('nieve (71/73/75/77/85/86): snow.present true derivado de cm, sky null', () => {
    for (const code of [71, 73, 75, 77, 85, 86]) {
      const result = normalizeOpenMeteoPrimary(dailyWithCode(code, { snowfall_sum: [2] }), '2026-01-15')
      expect(result.snow).toEqual({ cm: 2, present: true })
      expect(result.sky).toBeNull()
    }
  })

  it('snow.present se deriva de cm incluso si el código no es de nieve (coherencia snow.cm/present)', () => {
    // Código de lluvia (61) pero con snowfall_sum > 0: cm manda sobre el código.
    const result = normalizeOpenMeteoPrimary(dailyWithCode(61, { snowfall_sum: [1.5] }), '2026-01-15')
    expect(result.snow).toEqual({ cm: 1.5, present: true })
  })

  it('código desconocido: sky/storm/fog quedan null (sin respaldo numérico), no fenómenos ausentes', () => {
    const result = normalizeOpenMeteoPrimary(dailyWithCode(999, { snowfall_sum: [0] }), '2026-01-15')
    expect(result.sky).toBeNull()
    expect(result.storm).toBeNull()
    expect(result.fog).toBeNull()
    expect(result.primarySourceDescription).toBeNull()
  })

  it('snow.present sigue derivándose de snowfall_sum aunque el código sea desconocido (sí tiene respaldo numérico)', () => {
    expect(normalizeOpenMeteoPrimary(dailyWithCode(999, { snowfall_sum: [0] }), '2026-01-15').snow?.present).toBe(false)
    expect(normalizeOpenMeteoPrimary(dailyWithCode(999, { snowfall_sum: [3] }), '2026-01-15').snow?.present).toBe(true)
  })
})

describe('normalizeOpenMeteoComplement — solo campos numéricos (Madrid)', () => {
  const dailyMadrid = readFixture<OpenMeteoDailyResponse>('open-meteo-daily-madrid.json')
  const result = normalizeOpenMeteoComplement(dailyMadrid, '2026-09-08')

  it('targetDate ausente de la respuesta: falla en vez de caer al primer día', () => {
    expect(() => normalizeOpenMeteoComplement(dailyMadrid, '2026-09-09')).toThrow(/2026-09-09/)
  })

  it('suma rain_sum + showers_sum para precipitationMm', () => {
    expect(result.precipitationMm).toBe(0)
  })

  it('toma snowfall_sum tal cual (ya en cm, sin conversión)', () => {
    expect(result.snowCm).toBe(0)
  })

  it('toma viento sostenido y racha máximos del día', () => {
    expect(result.windSpeedKmh).toBe(17.9)
    expect(result.windGustKmh).toBe(45.4)
  })
})
