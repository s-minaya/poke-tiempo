import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { areaCodeForZone, normalizeAemetAlert, parseAemetCapXml } from './aemet-alerts.ts'

function readFixture(name: string): string {
  return readFileSync(join(import.meta.dirname, '__fixtures__', name), 'utf-8')
}

describe('areaCodeForZone', () => {
  it.each([
    ['610403', '61'],
    ['610403C', '61'],
    ['754801', '75'],
  ])('%s -> área %s', (zoneId, expected) => {
    expect(areaCodeForZone(zoneId)).toBe(expected)
  })
})

describe('parseAemetCapXml — aviso real activo (naranja, lluvias)', () => {
  const raw = parseAemetCapXml(readFixture('aemet-aviso-lluvias-naranja.xml'))

  it('lee una sola entrada (el bloque en-GB se ignora)', () => {
    expect(raw).toHaveLength(1)
  })

  it('extrae zona, nivel, fenómeno y ventana temporal', () => {
    expect(raw[0]).toEqual({
      zoneId: '610401',
      level: 'naranja',
      phenomenonCode: 'PR',
      phenomenonLabel: 'Lluvias',
      startsAt: '2026-09-09T16:00:00+02:00',
      endsAt: '2026-09-09T23:59:59+02:00',
    })
  })

  it('normaliza a OfficialAlert con el literal de AEMET en sourcePhenomenon', () => {
    expect(normalizeAemetAlert(raw[0])).toEqual({
      level: 'naranja',
      phenomenon: 'lluvia',
      sourcePhenomenon: 'Lluvias',
      startsAt: '2026-09-09T16:00:00+02:00',
      endsAt: '2026-09-09T23:59:59+02:00',
      source: 'aemet',
      officialZoneId: '610401',
    })
  })
})

describe('parseAemetCapXml — aviso real multizona en verde (baseline)', () => {
  const raw = parseAemetCapXml(readFixture('aemet-aviso-temperatura-verde-multizona.xml'))

  it('un único <info> con varias <area> produce una entrada por zona', () => {
    expect(raw).toHaveLength(3)
    expect(raw.map((alert) => alert.zoneId)).toEqual(['610401', '610402', '610403'])
    expect(raw.every((alert) => alert.level === 'verde')).toBe(true)
  })

  it('el nivel "verde" se filtra al normalizar: nunca llega a OfficialAlert', () => {
    const normalized = raw.map(normalizeAemetAlert)
    expect(normalized.every((alert) => alert === null)).toBe(true)
  })
})

describe('normalizeAemetAlert — catálogo de fenómenos', () => {
  function alertWith(phenomenonCode: string, phenomenonLabel: string) {
    return {
      zoneId: '610401',
      level: 'amarillo',
      phenomenonCode,
      phenomenonLabel,
      startsAt: '2026-09-09T00:00:00+02:00',
      endsAt: '2026-09-09T23:59:59+02:00',
    }
  }

  it.each([
    ['PR', 'lluvia'],
    ['NE', 'nieve'],
    ['VI', 'viento'],
    ['TO', 'tormenta'],
    ['AT', 'temperatura_maxima'],
    ['BT', 'temperatura_minima'],
    ['CO', 'costero'],
    ['NI', 'niebla'],
    ['VS', 'calima'],
    ['DH', 'deshielo'],
  ] as const)('%s -> %s', (code, expected) => {
    expect(normalizeAemetAlert(alertWith(code, 'Lo que sea'))?.phenomenon).toBe(expected)
  })

  it('un código real pero sin categoría en el dominio (aludes, galernas, rissagas) cae en "desconocido"', () => {
    for (const [code, label] of [
      ['AL', 'Aludes'],
      ['GA', 'Galernas'],
      ['RI', 'Rissagas'],
    ] as const) {
      const result = normalizeAemetAlert(alertWith(code, label))
      expect(result?.phenomenon).toBe('desconocido')
      expect(result?.sourcePhenomenon).toBe(label) // el literal nunca se pierde
    }
  })
})
