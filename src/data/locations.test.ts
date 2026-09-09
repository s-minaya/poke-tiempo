import { describe, expect, it } from 'vitest'

import { locations } from './locations'

describe('locations', () => {
  it('tiene exactamente 74 lugares', () => {
    expect(locations).toHaveLength(74)
  })

  it('no tiene ids duplicados', () => {
    const ids = locations.map((location) => location.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todo lugar costero tiene marineCoordinates', () => {
    const coastalWithoutMarine = locations.filter(
      (location) => location.coastal && !location.marineCoordinates,
    )
    expect(coastalWithoutMarine).toEqual([])
  })

  it('ningún lugar no costero tiene marineCoordinates', () => {
    const nonCoastalWithMarine = locations.filter(
      (location) => !location.coastal && location.marineCoordinates,
    )
    expect(nonCoastalWithMarine).toEqual([])
  })

  it('cada lugar AEMET tiene sourceIds.aemet resuelto', () => {
    const withoutId = locations.filter(
      (location) => location.primarySource === 'aemet' && !location.sourceIds.aemet,
    )
    expect(withoutId).toEqual([])
  })

  it('cada lugar IPMA tiene sourceIds.ipma resuelto', () => {
    const withoutId = locations.filter(
      (location) => location.primarySource === 'ipma' && !location.sourceIds.ipma,
    )
    expect(withoutId).toEqual([])
  })

  it('la cobertura por país coincide con la mission (65 ES / 8 PT / 1 AD)', () => {
    const byCountry = { ES: 0, PT: 0, AD: 0 }
    for (const location of locations) {
      byCountry[location.country] += 1
    }
    expect(byCountry).toEqual({ ES: 65, PT: 8, AD: 1 })
  })
})
