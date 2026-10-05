import { describe, expect, it } from 'vitest'

import type { LocationView } from '../../domain/location-views.ts'

import { announceLocation, summarizeLocation } from './location-summary.ts'

function view(overrides: Partial<LocationView> = {}): LocationView {
  return { id: 'gijon', name: 'Gijón', x: 0, y: 0, region: 'main', pokemonId: 'charmeleon', minC: 16.6, maxC: 25.2, ...overrides }
}

describe('summarizeLocation', () => {
  it('conserva el área administrativa cuando aporta algo', () => {
    expect(summarizeLocation(view(), 'Asturias').administrativeArea).toBe('Asturias')
  })

  it('la omite cuando coincide con el nombre', () => {
    expect(summarizeLocation(view({ id: 'madrid', name: 'Madrid' }), 'Madrid').administrativeArea).toBeNull()
  })

  it('redondea las temperaturas igual que el marcador', () => {
    const summary = summarizeLocation(view(), 'Asturias')
    expect([summary.minC, summary.maxC]).toEqual([17, 25])
  })

  it('separa el nombre propio del Pokémon de la condición que representa', () => {
    const summary = summarizeLocation(view({ pokemonId: 'castform-ice' }), 'Asturias')
    expect(summary.pokemonName).toBe('Castform')
    expect(summary.condition).toBe('Niebla')
  })

  it('sin previsión, sin Pokémon ni temperaturas', () => {
    const summary = summarizeLocation(view({ pokemonId: null, minC: null, maxC: null }), 'Asturias')
    expect([summary.pokemonName, summary.condition, summary.minC, summary.maxC]).toEqual([null, null, null, null])
  })
})

describe('announceLocation', () => {
  it('dice lugar, área, Pokémon, condición y temperaturas, en frases cortas', () => {
    expect(announceLocation(summarizeLocation(view(), 'Asturias'))).toBe(
      'Gijón, Asturias. Charmeleon. Muy caluroso. Mínima 17 grados, máxima 25 grados.',
    )
  })

  it('sin área cuando coincide con el nombre', () => {
    expect(announceLocation(summarizeLocation(view({ id: 'madrid', name: 'Madrid' }), 'Madrid'))).toMatch(/^Madrid\. /)
  })

  it('sin previsión, lo dice', () => {
    expect(announceLocation(summarizeLocation(view({ pokemonId: null, minC: null, maxC: null }), 'Asturias'))).toBe(
      'Gijón, Asturias. Sin previsión para hoy.',
    )
  })
})
