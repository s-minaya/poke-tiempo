import { describe, expect, it } from 'vitest'

import type { Forecast, LocationForecast } from '../../domain/types.ts'
import { getVisibleMapPokemonIds } from './visible-map-pokemon.ts'

function locationForecast(locationId: string, overrides: Partial<LocationForecast> = {}): LocationForecast {
  return {
    locationId,
    date: '2026-09-08',
    temperature: { maxC: 20, minC: 10 },
    sky: 'despejado',
    precipitation: { mm: 0, probabilityPercent: 5 },
    snow: { cm: 0, present: false },
    wind: { speedKmh: 10, gustKmh: 15 },
    storm: false,
    calima: false,
    fog: false,
    marine: { status: 'not_applicable' },
    alerts: { status: 'ok', alerts: [] },
    provenance: { primary: 'aemet' },
    primarySourceDescription: 'Despejado',
    ...overrides,
  }
}

function forecast(locations: LocationForecast[]): Forecast {
  return {
    date: '2026-09-08',
    generatedAt: '2026-09-08T06:00:00.000Z',
    locations,
    meta: { totalLocations: locations.length, successfulLocations: locations.length, failedLocations: [] },
  }
}

describe('getVisibleMapPokemonIds', () => {
  it('deduplica: dos lugares con el mismo Pokémon visible solo aparecen una vez', () => {
    const ids = getVisibleMapPokemonIds(
      forecast([locationForecast('a-coruna', { storm: true }), locationForecast('madrid', { storm: true })]),
    )

    expect(ids).toEqual(['zapdos'])
  })

  it('solo incluye lo realmente visible ese día, nunca los 25 PokedexId fijos', () => {
    const ids = getVisibleMapPokemonIds(forecast([locationForecast('a-coruna', { storm: true })]))

    expect(ids).toEqual(['zapdos'])
    expect(ids.length).toBeLessThan(25)
  })

  it('ordena igual que MAP_PRIORITY (zapdos por delante de castform-rain), sin importar el orden de entrada', () => {
    const rain = locationForecast('lisboa', { precipitation: { mm: 5, probabilityPercent: 80 } })
    const storm = locationForecast('a-coruna', { storm: true })

    expect(getVisibleMapPokemonIds(forecast([rain, storm]))).toEqual(['zapdos', 'castform-rain'])
    expect(getVisibleMapPokemonIds(forecast([storm, rain]))).toEqual(['zapdos', 'castform-rain'])
  })

  it('sin ningún lugar con forecast: lista vacía', () => {
    expect(getVisibleMapPokemonIds(forecast([]))).toEqual([])
  })
})
