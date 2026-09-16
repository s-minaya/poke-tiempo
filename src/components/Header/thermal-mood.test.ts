import { describe, expect, it } from 'vitest'

import type { ThermalMoodCategory } from './thermal-mood.ts'
import { classifyTemperatureMood, resolveThermalMood } from './thermal-mood.ts'

describe('classifyTemperatureMood', () => {
  const cases: [number, ThermalMoodCategory][] = [
    [-0.1, 'gelid'],
    [-15, 'gelid'],
    [0, 'cold'],
    [9.9, 'cold'],
    [10, 'neutral'],
    [25.9, 'neutral'],
    [26, 'heat'],
    [34.9, 'heat'],
    [35, 'sweltering'],
    [45, 'sweltering'],
  ]

  it.each(cases)('%d°C → %s', (maxC, expected) => {
    expect(classifyTemperatureMood(maxC)).toBe(expected)
  })
})

describe('resolveThermalMood', () => {
  it('array vacío → neutral como respaldo explícito', () => {
    expect(resolveThermalMood([])).toBe('neutral')
  })

  it('la categoría con más lugares gana, sin importar el orden de entrada', () => {
    const values = [5, 20, 20, 20, 30]
    expect(resolveThermalMood(values)).toBe('neutral')
    expect(resolveThermalMood([...values].reverse())).toBe('neutral')
  })

  it.each<[ThermalMoodCategory, number]>([
    ['gelid', -5],
    ['cold', 5],
    ['neutral', 18],
    ['heat', 30],
    ['sweltering', 38],
  ])('todos los lugares en la misma categoría (%s) → esa categoría', (expected, maxC) => {
    expect(resolveThermalMood(Array(74).fill(maxC))).toBe(expected)
  })

  it('empate → desempata con la categoría de la mediana de todas las máximas, aunque no sea una de las empatadas', () => {
    // cold (2) y heat (2) empatan; mediana de [5, 5, 30, 30] = 17.5 → neutral.
    const values = [5, 5, 30, 30]
    expect(resolveThermalMood(values)).toBe('neutral')
    expect(resolveThermalMood([...values].reverse())).toBe('neutral')
  })

  it('empate cuya mediana cae en una de las categorías empatadas', () => {
    // cold (2) y neutral (2) empatan; mediana de [5, 5, 15, 15] = 10 → neutral.
    const values = [5, 5, 15, 15]
    expect(resolveThermalMood(values)).toBe('neutral')
  })
})
