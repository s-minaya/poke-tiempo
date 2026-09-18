import { describe, expect, it } from 'vitest'

import type { Forecast, Location, LocationForecast } from '../../domain/types.ts'
import { buildLocationViews } from './location-views.ts'

function location(overrides: Partial<Location> = {}): Location {
  return {
    id: 'a-coruna',
    name: 'A Coruña',
    country: 'ES',
    latitude: 43.3701,
    longitude: -8.3911,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    sourceIds: { aemet: '15030' },
    coastal: false,
    ...overrides,
  }
}

// Lugar de interior, día sin ningún fenómeno más allá de la temperatura —
// mismo patrón que `assign-pokemon.test.ts`.
function locationForecast(overrides: Partial<LocationForecast> = {}): LocationForecast {
  return {
    locationId: 'a-coruna',
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

describe('buildLocationViews', () => {
  it('lugar con forecast: cruza assignPokemon + pickMapPokemon y arrastra la posición proyectada', () => {
    const views = buildLocationViews(
      [location({ id: 'a-coruna' })],
      forecast([locationForecast({ locationId: 'a-coruna', temperature: { maxC: 42, minC: 30 }, storm: true })]),
    )

    expect(views).toHaveLength(1)
    // storm=true → zapdos (assignPokemon); zapdos gana la prioridad sobre la
    // temperatura (groudon) en pickMapPokemon.
    expect(views[0].pokemonId).toBe('zapdos')
    expect(views[0].id).toBe('a-coruna')
    expect(views[0].name).toBe('A Coruña')
    expect(typeof views[0].x).toBe('number')
    expect(typeof views[0].y).toBe('number')
    expect(views[0].region).toBe('main')
    expect(views[0].minC).toBe(30)
    expect(views[0].maxC).toBe(42)
  })

  it('lugar sin entrada en forecast.locations: sin Pokémon, sin temperatura, pero con posición', () => {
    const views = buildLocationViews([location({ id: 'a-coruna' })], forecast([]))

    expect(views[0].pokemonId).toBeNull()
    expect(views[0].minC).toBeNull()
    expect(views[0].maxC).toBeNull()
    expect(typeof views[0].x).toBe('number')
    expect(typeof views[0].y).toBe('number')
  })

  it('lugar de Canarias: la región viene de map-geometry, no se decide aquí', () => {
    const views = buildLocationViews(
      [location({ id: 'tenerife', name: 'Tenerife' }), location({ id: 'ceuta', name: 'Ceuta' })],
      forecast([locationForecast({ locationId: 'tenerife' }), locationForecast({ locationId: 'ceuta' })]),
    )

    // Ceuta no tiene región propia: entra en el `fitExtent` del mapa
    // principal, en su posición geográfica real, igual que cualquier lugar
    // peninsular (004-plan.md → punto 3).
    expect(views[0].region).toBe('canary')
    expect(views[1].region).toBe('main')
  })

  it('respeta la prioridad de selección con varios ejes disparando a la vez (lluvia por delante de viento)', () => {
    const views = buildLocationViews(
      [location({ id: 'a-coruna' })],
      forecast([
        locationForecast({
          locationId: 'a-coruna',
          precipitation: { mm: 5, probabilityPercent: 80 },
          wind: { speedKmh: 45, gustKmh: 70 },
        }),
      ]),
    )

    expect(views[0].pokemonId).toBe('castform-rain')
  })

  it('conserva el orden y el número de lugares de entrada', () => {
    const views = buildLocationViews(
      [location({ id: 'a-coruna' }), location({ id: 'madrid', name: 'Madrid' })],
      forecast([locationForecast({ locationId: 'a-coruna' }), locationForecast({ locationId: 'madrid' })]),
    )

    expect(views.map((view) => view.id)).toEqual(['a-coruna', 'madrid'])
  })

  it('lugar sin coordenadas en map-geometry.ts: falla de forma visible, no en silencio', () => {
    expect(() => buildLocationViews([location({ id: 'lugar-inventado' })], forecast([]))).toThrow(
      /lugar-inventado/,
    )
  })
})
