import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { AemetDailyResponse, AemetHourlyResponse } from './aemet.ts'
import { normalizeAemet, normalizeAemetDaily, normalizeAemetHourly } from './aemet.ts'

function readFixture<T>(name: string): T {
  const path = join(import.meta.dirname, '__fixtures__', name)
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

const dailyMadrid = readFixture<AemetDailyResponse[]>('aemet-diaria-madrid.json')[0]
const hourlyMadrid = readFixture<AemetHourlyResponse[]>('aemet-horaria-madrid.json')[0]
const hourlyEdgeCases = readFixture<AemetHourlyResponse[]>('aemet-horaria-edge-cases.json')[0]

describe('normalizeAemetDaily', () => {
  it('lee la temperatura máxima/mínima oficial del día', () => {
    const result = normalizeAemetDaily(dailyMadrid)
    expect(result.temperature).toEqual({ maxC: 35, minC: 23 })
  })

  it('toma la probabilidad de precipitación del periodo 00-24', () => {
    const result = normalizeAemetDaily(dailyMadrid)
    expect(result.precipitationProbabilityPercent).toBe(0)
  })

  it('recorta la fecha a YYYY-MM-DD', () => {
    const result = normalizeAemetDaily(dailyMadrid)
    expect(result.date).toBe('2026-09-08')
  })
})

describe('normalizeAemetHourly — día real sin fenómenos (Madrid)', () => {
  const result = normalizeAemetHourly(hourlyMadrid)

  it('no detecta tormenta, niebla, calima ni nieve', () => {
    expect(result.storm).toBe(false)
    expect(result.fog).toBe(false)
    expect(result.calima).toBe(false)
    expect(result.snowPresent).toBe(false)
  })

  it('toma el estado del cielo de la hora más cercana al mediodía', () => {
    // periodo "12" -> value "11" -> Despejado
    expect(result.sky).toBe('despejado')
    expect(result.primarySourceDescription).toBe('Despejado')
  })

  it('toma el máximo de velocidad y racha de viento del día', () => {
    expect(result.windSpeedKmh).toBe(23) // periodo 16
    expect(result.windGustKmh).toBe(43) // periodo 15
  })
})

describe('normalizeAemetHourly — día con fenómenos (fixture de bordes)', () => {
  const result = normalizeAemetHourly(hourlyEdgeCases)

  it('detecta tormenta (código 52 en alguna hora)', () => {
    expect(result.storm).toBe(true)
  })

  it('detecta niebla (código 81) aunque otra hora sea bruma (82, no cuenta como niebla)', () => {
    expect(result.fog).toBe(true)
  })

  it('detecta calima (código 83)', () => {
    expect(result.calima).toBe(true)
  })

  it('detecta nieve por el código de cielo (34) y por el campo nieve > 0', () => {
    expect(result.snowPresent).toBe(true)
  })

  it('detecta nieve solo por el código de cielo, con el campo nieve en 0 en todas las horas', () => {
    const hourly: AemetHourlyResponse = {
      prediccion: {
        dia: [
          {
            estadoCielo: [
              { value: '11', periodo: '10', descripcion: 'Despejado' },
              { value: '71', periodo: '12', descripcion: 'Intervalos nubosos con nieve escasa' },
              { value: '11', periodo: '14', descripcion: 'Despejado' },
            ],
            nieve: [
              { value: '0', periodo: '10' },
              { value: '0', periodo: '12' },
              { value: '0', periodo: '14' },
            ],
            vientoAndRachaMax: [],
            fecha: '2026-01-15T00:00:00',
          },
        ],
      },
    }

    expect(normalizeAemetHourly(hourly).snowPresent).toBe(true)
  })

  it('el cielo representativo es el de la hora más cercana al mediodía (12 -> Nuboso)', () => {
    expect(result.sky).toBe('nuboso')
    expect(result.primarySourceDescription).toBe('Nuboso')
  })

  it('toma el máximo de velocidad y racha del día', () => {
    expect(result.windSpeedKmh).toBe(30) // periodo 11
    expect(result.windGustKmh).toBe(65) // periodo 11
  })
})

describe('normalizeAemetHourly — sin datos horarios', () => {
  it('devuelve todo null en vez de fabricar un valor', () => {
    const empty: AemetHourlyResponse = { prediccion: { dia: [] } }
    const result = normalizeAemetHourly(empty)
    expect(result).toEqual({
      sky: null,
      snowPresent: null,
      windSpeedKmh: null,
      windGustKmh: null,
      storm: null,
      calima: null,
      fog: null,
      primarySourceDescription: null,
    })
  })
})

describe('normalizeAemet', () => {
  it('combina diaria y horaria en un bloque parcial de LocationForecast', () => {
    const result = normalizeAemet(dailyMadrid, hourlyMadrid)

    expect(result.date).toBe('2026-09-08')
    expect(result.temperature).toEqual({ maxC: 35, minC: 23 })
    expect(result.sky).toBe('despejado')
    // mm queda null: la horaria de AEMET nunca cubre el día completo para
    // "hoy" — lo complementa Open-Meteo (Bloque 5).
    expect(result.precipitation).toEqual({ mm: null, probabilityPercent: 0 })
    // AEMET nunca da snow.cm directo: cm queda null, present viene de la
    // hora — lo completa Open-Meteo como complemento (Bloque 5).
    expect(result.snow).toEqual({ cm: null, present: false })
    expect(result.storm).toBe(false)
    expect(result.calima).toBe(false)
    expect(result.fog).toBe(false)
    expect(result.primarySourceDescription).toBe('Despejado')
  })
})
