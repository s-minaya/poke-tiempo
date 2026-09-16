import { describe, expect, it } from 'vitest'

import type { MarkerTemperatureBand } from './marker-temperature.ts'
import { classifyMarkerTemperature } from './marker-temperature.ts'

describe('classifyMarkerTemperature', () => {
  const cases: [number, MarkerTemperatureBand][] = [
    [-1, 'freezing'],
    [-15, 'freezing'],
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
  ]

  it.each(cases)('%d° → %s', (celsius, expected) => {
    expect(classifyMarkerTemperature(celsius)).toBe(expected)
  })
})
