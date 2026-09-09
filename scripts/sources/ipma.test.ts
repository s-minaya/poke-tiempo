import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { IpmaDailyResponse, IpmaWarningEntry } from './ipma.ts'
import { normalizeIpma, normalizeIpmaAlert } from './ipma.ts'

function readFixture<T>(name: string): T {
  const path = join(import.meta.dirname, '__fixtures__', name)
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function dailyWithType(idWeatherType: number): IpmaDailyResponse {
  return {
    globalIdLocal: 1110600,
    data: [
      {
        precipitaProb: '0.0',
        tMin: '10.0',
        tMax: '20.0',
        idWeatherType,
        forecastDate: '2026-01-15',
      },
    ],
  }
}

describe('normalizeIpma — día real sin fenómenos (Lisboa)', () => {
  const dailyLisboa = readFixture<IpmaDailyResponse>('ipma-daily-lisboa.json')
  const result = normalizeIpma(dailyLisboa)

  it('lee fecha y temperatura del primer día', () => {
    expect(result.date).toBe('2026-09-08')
    expect(result.temperature).toEqual({ maxC: 28.2, minC: 18.3 })
  })

  it('lee la probabilidad de precipitación (nunca mm)', () => {
    expect(result.precipitation).toEqual({ mm: null, probabilityPercent: 4 })
  })

  it('mapea el idWeatherType (2) a poco_nuboso, con el texto literal de IPMA', () => {
    expect(result.sky).toBe('poco_nuboso')
    expect(result.primarySourceDescription).toBe('Céu pouco nublado')
  })

  it('no detecta tormenta, niebla ni nieve; calima siempre null; viento siempre null', () => {
    expect(result.storm).toBe(false)
    expect(result.fog).toBe(false)
    expect(result.snow).toEqual({ cm: null, present: false })
    expect(result.calima).toBeNull()
    expect(result.wind).toEqual({ speedKmh: null, gustKmh: null })
  })
})

describe('normalizeIpma — códigos de fenómeno (sin nubosidad asociada)', () => {
  it('tormenta (19): sky null, storm true', () => {
    const result = normalizeIpma(dailyWithType(19))
    expect(result.sky).toBeNull()
    expect(result.storm).toBe(true)
    expect(result.primarySourceDescription).toBe('Trovoada')
  })

  it('lluvia y posible tormenta (23) también cuenta como tormenta', () => {
    expect(normalizeIpma(dailyWithType(23)).storm).toBe(true)
  })

  it('niebla (17 y 26): sky null, fog true', () => {
    expect(normalizeIpma(dailyWithType(17)).fog).toBe(true)
    expect(normalizeIpma(dailyWithType(26)).fog).toBe(true)
    expect(normalizeIpma(dailyWithType(17)).sky).toBeNull()
  })

  it('neblina (16, mist) no cuenta como niebla ni como calima', () => {
    const result = normalizeIpma(dailyWithType(16))
    expect(result.fog).toBe(false)
    expect(result.calima).toBeNull()
  })

  it('nieve (18, 28, 29, 30): snow.present true, sky null', () => {
    for (const code of [18, 28, 29, 30]) {
      const result = normalizeIpma(dailyWithType(code))
      expect(result.snow?.present).toBe(true)
      expect(result.sky).toBeNull()
    }
  })

  it('sin información (-99, 0): sky/storm/fog/snow.present quedan null, no false', () => {
    for (const code of [-99, 0]) {
      const result = normalizeIpma(dailyWithType(code))
      expect(result.sky).toBeNull()
      expect(result.storm).toBeNull()
      expect(result.fog).toBeNull()
      expect(result.snow?.present).toBeNull()
    }
  })

  it('código desconocido (fuera del catálogo): se trata como sin información, no como fenómenos ausentes', () => {
    const result = normalizeIpma(dailyWithType(999))
    expect(result.sky).toBeNull()
    expect(result.storm).toBeNull()
    expect(result.fog).toBeNull()
    expect(result.snow?.present).toBeNull()
    expect(result.primarySourceDescription).toBeNull()
  })
})

describe('normalizeIpma — códigos de solo nubosidad', () => {
  it('4 (muy nublado/encoberto) mapea a cubierto', () => {
    expect(normalizeIpma(dailyWithType(4)).sky).toBe('cubierto')
  })

  it('25 y 27 (nublado) mapean a nuboso', () => {
    expect(normalizeIpma(dailyWithType(25)).sky).toBe('nuboso')
    expect(normalizeIpma(dailyWithType(27)).sky).toBe('nuboso')
  })
})

describe('fetchIpmaWarnings — forma de la respuesta real', () => {
  it('cada entrada trae zona, tipo, nivel y ventana temporal', () => {
    const warnings = readFixture<IpmaWarningEntry[]>('ipma-warnings.json')

    expect(warnings.length).toBeGreaterThan(0)
    for (const warning of warnings) {
      expect(typeof warning.idAreaAviso).toBe('string')
      expect(typeof warning.awarenessTypeName).toBe('string')
      expect(['green', 'yellow', 'orange', 'red']).toContain(warning.awarenessLevelID)
      expect(typeof warning.startTime).toBe('string')
      expect(typeof warning.endTime).toBe('string')
    }
  })

  it('incluye al menos un aviso activo (no verde) en la captura real', () => {
    const warnings = readFixture<IpmaWarningEntry[]>('ipma-warnings.json')
    expect(warnings.some((warning) => warning.awarenessLevelID !== 'green')).toBe(true)
  })
})

describe('normalizeIpmaAlert', () => {
  it('normaliza el aviso amarillo real de la captura ("Tempo Quente" en MPS)', () => {
    const warnings = readFixture<IpmaWarningEntry[]>('ipma-warnings.json')
    const activo = warnings.find(
      (warning) => warning.awarenessLevelID !== 'green' && warning.idAreaAviso === 'MPS',
    )
    expect(activo).toBeDefined()

    expect(normalizeIpmaAlert(activo!)).toEqual({
      level: 'amarillo',
      phenomenon: 'temperatura_maxima',
      sourcePhenomenon: 'Tempo Quente',
      startsAt: activo!.startTime,
      endsAt: activo!.endTime,
      source: 'ipma',
      officialZoneId: 'MPS',
    })
  })

  it('el nivel "green" se filtra: nunca llega a OfficialAlert', () => {
    const warnings = readFixture<IpmaWarningEntry[]>('ipma-warnings.json')
    const inactivo = warnings.find((warning) => warning.awarenessLevelID === 'green')
    expect(inactivo).toBeDefined()
    expect(normalizeIpmaAlert(inactivo!)).toBeNull()
  })

  it.each([
    ['Precipitação', 'lluvia'],
    ['Neve', 'nieve'],
    ['Vento', 'viento'],
    ['Trovoada', 'tormenta'],
    ['Tempo Quente', 'temperatura_maxima'],
    ['Tempo Frio', 'temperatura_minima'],
    ['Agitação Marítima', 'costero'],
    ['Nevoeiro', 'niebla'],
  ] as const)('%s -> %s', (awarenessTypeName, expected) => {
    const raw: IpmaWarningEntry = {
      awarenessTypeName,
      idAreaAviso: 'LSB',
      startTime: '2026-09-09T00:00:00',
      endTime: '2026-09-09T23:59:59',
      awarenessLevelID: 'yellow',
      text: '',
    }
    expect(normalizeIpmaAlert(raw)?.phenomenon).toBe(expected)
  })
})
