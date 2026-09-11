import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Location } from '../src/domain/types.ts'
import { AemetAuthError } from './sources/aemet-client.ts'
import type { AemetDailyResponse, AemetHourlyResponse } from './sources/aemet.ts'
import type { IpmaDailyResponse } from './sources/ipma.ts'
import type { OpenMeteoDailyResponse } from './sources/open-meteo.ts'

// Solo se mockea la capa de red (`fetch*`) — las funciones `normalize*` son
// puras y corren de verdad, contra formas de respuesta mínimas pero
// realistas, igual que el resto de tests de `scripts/sources/`.
vi.mock('./sources/aemet.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sources/aemet.ts')>()
  return { ...actual, fetchAemetDaily: vi.fn(), fetchAemetHourly: vi.fn() }
})
vi.mock('./sources/ipma.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sources/ipma.ts')>()
  return { ...actual, fetchIpmaDaily: vi.fn() }
})
vi.mock('./sources/open-meteo.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sources/open-meteo.ts')>()
  return { ...actual, fetchOpenMeteoDaily: vi.fn() }
})

const { fetchAemetDaily, fetchAemetHourly } = await import('./sources/aemet.ts')
const { fetchIpmaDaily } = await import('./sources/ipma.ts')
const { fetchOpenMeteoDaily } = await import('./sources/open-meteo.ts')
const { orchestrateLocationWeather, LocationWeatherUnavailableError } = await import('./orchestrate-location.ts')

const TARGET_DATE = '2026-09-09'
const AEMET_API_KEY = 'test-key'

function aemetLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'madrid',
    name: 'Madrid',
    country: 'ES',
    latitude: 40.4084,
    longitude: -3.6876,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    sourceIds: { aemet: '28079' },
    coastal: false,
    ...overrides,
  }
}

function ipmaLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'lisboa',
    name: 'Lisboa',
    country: 'PT',
    latitude: 38.766,
    longitude: -9.1286,
    timezone: 'Europe/Lisbon',
    primarySource: 'ipma',
    sourceIds: { ipma: 1110600 },
    coastal: false,
    ...overrides,
  }
}

function aemetDaily(): AemetDailyResponse {
  return {
    prediccion: {
      dia: [
        {
          probPrecipitacion: [{ value: 10, periodo: '00-24' }],
          temperatura: { maxima: 30, minima: 18 },
          fecha: `${TARGET_DATE}T00:00:00`,
        },
      ],
    },
  }
}

function aemetHourly(): AemetHourlyResponse {
  return {
    prediccion: {
      dia: [
        {
          estadoCielo: [{ value: '11', periodo: '12', descripcion: 'Despejado' }],
          nieve: [],
          vientoAndRachaMax: [],
          fecha: `${TARGET_DATE}T00:00:00`,
        },
      ],
    },
  }
}

function ipmaDaily(): IpmaDailyResponse {
  return {
    globalIdLocal: 1110600,
    data: [{ precipitaProb: '5.0', tMin: '18.0', tMax: '27.0', idWeatherType: 1, forecastDate: TARGET_DATE }],
  }
}

function openMeteoDaily(): OpenMeteoDailyResponse {
  return {
    daily: {
      time: [TARGET_DATE],
      temperature_2m_max: [26],
      temperature_2m_min: [17],
      rain_sum: [0],
      showers_sum: [0],
      snowfall_sum: [0],
      precipitation_probability_max: [10],
      wind_speed_10m_max: [15],
      wind_gusts_10m_max: [30],
      weather_code: [1],
    },
  }
}

beforeEach(() => {
  vi.mocked(fetchAemetDaily).mockReset()
  vi.mocked(fetchAemetHourly).mockReset()
  vi.mocked(fetchIpmaDaily).mockReset()
  vi.mocked(fetchOpenMeteoDaily).mockReset()
})

describe('orchestrateLocationWeather — la fuente principal normal tiene prioridad', () => {
  it('AEMET responde: no se llama a Open-Meteo como fallback', async () => {
    vi.mocked(fetchAemetDaily).mockResolvedValue(aemetDaily())
    vi.mocked(fetchAemetHourly).mockResolvedValue(aemetHourly())

    const result = await orchestrateLocationWeather(aemetLocation(), AEMET_API_KEY, TARGET_DATE)

    expect(result.provenance.primary).toBe('aemet')
    expect(result.usedFallback).toBe(false)
    // El complemento SÍ se intenta (es independiente del fallback) — se
    // mockea para que falle y así queda aislado de este caso.
  })

  it('IPMA responde: provenance.primary sigue siendo ipma', async () => {
    vi.mocked(fetchIpmaDaily).mockResolvedValue(ipmaDaily())
    vi.mocked(fetchOpenMeteoDaily).mockRejectedValue(new Error('complemento no disponible en este test'))

    const result = await orchestrateLocationWeather(ipmaLocation(), AEMET_API_KEY, TARGET_DATE)

    expect(result.provenance.primary).toBe('ipma')
    expect(result.usedFallback).toBe(false)
  })
})

describe('orchestrateLocationWeather — fallo normal de la principal activa el fallback de Open-Meteo', () => {
  it('AEMET falla (red): Open-Meteo responde como bloque completo, provenance.primary pasa a open-meteo', async () => {
    vi.mocked(fetchAemetDaily).mockRejectedValue(new Error('AEMET caído'))
    vi.mocked(fetchAemetHourly).mockResolvedValue(aemetHourly())
    vi.mocked(fetchOpenMeteoDaily).mockResolvedValue(openMeteoDaily())

    const result = await orchestrateLocationWeather(aemetLocation(), AEMET_API_KEY, TARGET_DATE)

    expect(result.provenance).toEqual({ primary: 'open-meteo' })
    expect(result.usedFallback).toBe(true)
    expect(result.degradations).toEqual([])
    expect(result.complementAttempt).toBeUndefined()
    expect(result.block.temperature).toEqual({ maxC: 26, minC: 17 })
  })

  it('IPMA falla: Open-Meteo responde como fallback', async () => {
    vi.mocked(fetchIpmaDaily).mockRejectedValue(new Error('IPMA caído'))
    vi.mocked(fetchOpenMeteoDaily).mockResolvedValue(openMeteoDaily())

    const result = await orchestrateLocationWeather(ipmaLocation(), AEMET_API_KEY, TARGET_DATE)

    expect(result.provenance).toEqual({ primary: 'open-meteo' })
    expect(result.usedFallback).toBe(true)
  })

})

describe('orchestrateLocationWeather — un sourceId ausente es un error de configuración, no dispara el fallback', () => {
  it('falta sourceIds.aemet: falla directamente, sin llamar a Open-Meteo', async () => {
    await expect(
      orchestrateLocationWeather(aemetLocation({ sourceIds: {} }), AEMET_API_KEY, TARGET_DATE),
    ).rejects.toThrow(/sourceIds\.aemet/)

    expect(fetchAemetDaily).not.toHaveBeenCalled()
    expect(fetchOpenMeteoDaily).not.toHaveBeenCalled()
  })

  it('falta sourceIds.ipma: falla directamente, sin llamar a Open-Meteo', async () => {
    await expect(
      orchestrateLocationWeather(ipmaLocation({ sourceIds: {} }), AEMET_API_KEY, TARGET_DATE),
    ).rejects.toThrow(/sourceIds\.ipma/)

    expect(fetchIpmaDaily).not.toHaveBeenCalled()
    expect(fetchOpenMeteoDaily).not.toHaveBeenCalled()
  })
})

describe('orchestrateLocationWeather — AemetAuthError nunca activa el fallback', () => {
  it('401/403 de AEMET: se relanza tal cual, Open-Meteo no llega a llamarse', async () => {
    vi.mocked(fetchAemetDaily).mockRejectedValue(new AemetAuthError('401'))
    vi.mocked(fetchAemetHourly).mockResolvedValue(aemetHourly())

    await expect(orchestrateLocationWeather(aemetLocation(), AEMET_API_KEY, TARGET_DATE)).rejects.toBeInstanceOf(
      AemetAuthError,
    )
    expect(fetchOpenMeteoDaily).not.toHaveBeenCalled()
  })

  it('AemetAuthError gana aunque la otra petición (horaria) rechace primero con un error genérico — no se pierde por una carrera de promesas', async () => {
    // `hourly` rechaza en el siguiente tick (más "rápido" en microtareas);
    // `daily` rechaza después, con el AemetAuthError. Si el código usara
    // `Promise.all` en vez de `allSettled` + comprobación explícita, este
    // test fallaría de forma intermitente: a veces ganaría el genérico.
    vi.mocked(fetchAemetHourly).mockRejectedValue(new Error('horaria: fallo genérico'))
    vi.mocked(fetchAemetDaily).mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new AemetAuthError('401')), 5)),
    )

    await expect(orchestrateLocationWeather(aemetLocation(), AEMET_API_KEY, TARGET_DATE)).rejects.toBeInstanceOf(
      AemetAuthError,
    )
    expect(fetchOpenMeteoDaily).not.toHaveBeenCalled()
  })
})

describe('orchestrateLocationWeather — la principal y el fallback fallan los dos', () => {
  it('lanza LocationWeatherUnavailableError, sin fabricar un bloque parcial', async () => {
    vi.mocked(fetchAemetDaily).mockRejectedValue(new Error('AEMET caído'))
    vi.mocked(fetchAemetHourly).mockRejectedValue(new Error('AEMET caído'))
    vi.mocked(fetchOpenMeteoDaily).mockRejectedValue(new Error('Open-Meteo también caído'))

    await expect(orchestrateLocationWeather(aemetLocation(), AEMET_API_KEY, TARGET_DATE)).rejects.toBeInstanceOf(
      LocationWeatherUnavailableError,
    )
  })
})
