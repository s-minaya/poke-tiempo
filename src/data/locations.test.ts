import { describe, expect, it } from 'vitest'

import { LOCATION_ZONES } from '../domain/location-zones'
import { locations } from './locations'

describe('locations', () => {
  it('tiene exactamente 74 lugares', () => {
    expect(locations).toHaveLength(74)
  })

  it('no tiene ids duplicados', () => {
    const ids = locations.map((location) => location.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todo lugar trae administrativeArea, no vacío', () => {
    const withoutArea = locations.filter((location) => !location.administrativeArea?.trim())
    expect(withoutArea).toEqual([])
  })

  it('todo lugar trae una zona de LOCATION_ZONES', () => {
    const withoutZone = locations.filter((location) => !(LOCATION_ZONES as readonly string[]).includes(location.zone))
    expect(withoutZone).toEqual([])
  })

  it('las zonas en uso son exactamente las 21 de LOCATION_ZONES: ninguna sobra ni falta', () => {
    const used = new Set(locations.map((location) => location.zone))
    expect([...used].sort()).toEqual([...LOCATION_ZONES].sort())
  })

  // España reparte sus 65 lugares entre las 19 comunidades y ciudades
  // autónomas; Portugal y Andorra son cada uno una zona.
  it.each([
    { country: 'PT', expected: ['Portugal'] },
    { country: 'AD', expected: ['Andorra'] },
    { country: 'ES', expected: LOCATION_ZONES.filter((zone) => zone !== 'Portugal' && zone !== 'Andorra') },
  ])('los lugares de $country van en su zona', ({ country, expected }) => {
    const zones = new Set(locations.filter((location) => location.country === country).map((location) => location.zone))
    expect([...zones].sort()).toEqual([...expected].sort())
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
