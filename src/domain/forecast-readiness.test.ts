import { describe, expect, it, vi } from 'vitest'

import type { LocationForecast } from './types.ts'

// `assignPokemon` real por defecto (los 74 lugares "válidos" del happy path
// deben producir Pokémon de verdad, no un mock inventado) — solo se
// sobreescribe puntualmente en el test que necesita forzar una lista vacía,
// caso que el motor real de 003 no puede producir actualmente (temperature
// siempre asigna), pero que esta función tiene que seguir protegiendo si eso
// cambiara alguna vez.
vi.mock('./assign-pokemon.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./assign-pokemon.ts')>()
  return { ...actual, assignPokemon: vi.fn(actual.assignPokemon) }
})

const { assignPokemon } = await import('./assign-pokemon.ts')
const { checkForecastReadiness } = await import('./forecast-readiness.ts')

function forecastFor(locationId: string): LocationForecast {
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
  }
}

const IDS = Array.from({ length: 74 }, (_, i) => `lugar-${i + 1}`)

describe('checkForecastReadiness', () => {
  it('74 lugares esperados, cada uno con Pokémon asignado: listo para publicar', () => {
    const forecasts = IDS.map(forecastFor)
    expect(checkForecastReadiness(IDS, forecasts)).toEqual({ ready: true })
  })

  it('falta un lugar: no está listo', () => {
    const forecasts = IDS.slice(0, 73).map(forecastFor)
    const result = checkForecastReadiness(IDS, forecasts)
    expect(result.ready).toBe(false)
    expect(result.reason).toMatch(/se esperaban 74/)
  })

  it('un locationId duplicado sustituyendo al que falta: no está listo (nunca se cuenta como "74 completos")', () => {
    const forecasts = IDS.slice(0, 73).map(forecastFor)
    forecasts.push(forecastFor(IDS[0])) // duplica el primero en vez de traer el 74º real
    const result = checkForecastReadiness(IDS, forecasts)
    expect(result.ready).toBe(false)
    expect(result.reason).toMatch(/duplicado/)
  })

  it('un LocationForecast cuya asignación de Pokémon es vacía: no está listo, no se inventa un Pokémon por defecto', () => {
    const forecasts = IDS.map(forecastFor)
    vi.mocked(assignPokemon).mockImplementationOnce(() => [])

    const result = checkForecastReadiness(IDS, forecasts)

    expect(result.ready).toBe(false)
    expect(result.reason).toMatch(/no asignó ningún Pokémon/)
  })
})
