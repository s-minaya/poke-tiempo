import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Location } from '../src/domain/types.ts'
import { AemetAuthError } from './sources/aemet-client.ts'

// Solo se mockea la capa de red (`fetchAemetAreaAlerts`) — `areaCodeForZone`
// y el resto de `aemet-alerts.ts` corren de verdad, igual que el resto de
// tests de `scripts/`.
vi.mock('./sources/aemet-alerts.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sources/aemet-alerts.ts')>()
  return { ...actual, fetchAemetAreaAlerts: vi.fn() }
})

const { fetchAemetAreaAlerts } = await import('./sources/aemet-alerts.ts')
const { prefetchAemetAreaAlerts } = await import('./fetch-forecast.ts')

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
    alertZoneIds: { aemet: ['722802'] }, // área 72
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(fetchAemetAreaAlerts).mockReset()
})

describe('prefetchAemetAreaAlerts', () => {
  it('AemetAuthError se relanza tal cual, sin absorberlo como un fallo puntual de área', async () => {
    vi.mocked(fetchAemetAreaAlerts).mockRejectedValue(new AemetAuthError('401'))

    await expect(prefetchAemetAreaAlerts([aemetLocation()], AEMET_API_KEY)).rejects.toBeInstanceOf(AemetAuthError)
  })

  it('un fallo normal de un área degrada esa área a null y sigue con el resto', async () => {
    vi.mocked(fetchAemetAreaAlerts).mockImplementation(async (areaCode) => {
      if (areaCode === '72') throw new Error('AEMET caído')
      return []
    })

    const result = await prefetchAemetAreaAlerts(
      [
        aemetLocation({ id: 'madrid', alertZoneIds: { aemet: ['722802'] } }), // área 72: falla
        aemetLocation({ id: 'lugo', alertZoneIds: { aemet: ['712702'] } }), // área 71: responde bien
      ],
      AEMET_API_KEY,
    )

    expect(result.get('72')).toBeNull()
    expect(result.get('71')).toEqual([])
  })
})
