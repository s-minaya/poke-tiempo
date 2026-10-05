import { describe, expect, it } from 'vitest'

import type { MarkerTemperatureBand } from './marker-temperature.ts'
import { MARKER_TEMPERATURE_BANDS, classifyMarkerTemperature, markerTemperatureRange } from './marker-temperature.ts'

describe('classifyMarkerTemperature', () => {
  // Los dos lados de cada límite, más los extremos.
  const cases: [number, MarkerTemperatureBand][] = [
    [-40, 'freezing'],
    [-15, 'freezing'],
    [-1, 'freezing'],
    [0, 'cool'],
    [9, 'cool'],
    [10, 'mild'],
    [20, 'mild'],
    [21, 'pleasant'],
    [25, 'pleasant'],
    [26, 'hot'],
    [34, 'hot'],
    [35, 'scorching'],
    [45, 'scorching'],
    [60, 'scorching'],
  ]

  it.each(cases)('%d° → %s', (celsius, expected) => {
    expect(classifyMarkerTemperature(celsius)).toBe(expected)
  })

  it.each([
    [-0.5, 'freezing'],
    [9.5, 'cool'],
    [20.5, 'mild'],
    [34.9, 'hot'],
  ] as [number, MarkerTemperatureBand][])('sin huecos entre franjas: %d° → %s', (celsius, expected) => {
    expect(classifyMarkerTemperature(celsius)).toBe(expected)
  })
})

describe('MARKER_TEMPERATURE_BANDS', () => {
  it('van de frío a calor, con los límites crecientes y solo la primera sin suelo', () => {
    const froms = MARKER_TEMPERATURE_BANDS.map((range) => range.from)
    expect(froms[0]).toBeNull()
    const floors = froms.slice(1) as number[]
    expect(floors).toEqual(floors.toSorted((a, b) => a - b))
    expect(new Set(floors).size).toBe(floors.length)
  })
})

describe('markerTemperatureRange', () => {
  it.each([
    ['freezing', null, -1],
    ['cool', 0, 9],
    ['mild', 10, 20],
    ['pleasant', 21, 25],
    ['hot', 26, 34],
    ['scorching', 35, null],
  ] as [MarkerTemperatureBand, number | null, number | null][])('%s: de %s a %s', (band, from, to) => {
    expect(markerTemperatureRange(band)).toEqual({ from, to })
  })

  it('cada grado entero de -60 a 60 cae en la franja cuyo rango lo contiene: el color y el título no pueden discrepar', () => {
    for (let celsius = -60; celsius <= 60; celsius++) {
      const { from, to } = markerTemperatureRange(classifyMarkerTemperature(celsius))
      expect(from === null || celsius >= from).toBe(true)
      expect(to === null || celsius <= to).toBe(true)
    }
  })
})
