import { describe, expect, it } from 'vitest'

import type { LocationGroup, LocationOrder } from './location-groups.ts'
import type { LocationSummary } from '../LocationCard/location-summary.ts'
import type { MarkerTemperatureBand } from '../SpainMap/components/marker-temperature.ts'
import type { LocationZone } from '../../domain/location-zones.ts'

import { NO_FORECAST_GROUP_TITLE, groupLocations, temperatureBandTitle } from './location-groups.ts'
import { MARKER_TEMPERATURE_BANDS, classifyMarkerTemperature } from '../SpainMap/components/marker-temperature.ts'

function row(id: string, name: string, minC: number | null, maxC: number | null): LocationSummary {
  return { id, name, administrativeArea: null, pokemonId: null, pokemonName: null, condition: null, minC, maxC }
}

function shape(groups: LocationGroup[]) {
  return groups.map((group) => ({ key: group.key, title: group.title, band: group.band, ids: group.rows.map((summary) => summary.id) }))
}

const ORDERS: LocationOrder[] = ['zone', 'name', 'warmest', 'coldest']

describe('temperatureBandTitle', () => {
  it.each([
    ['scorching', 'Máxima de 35° o más', 'Mínima de 35° o más'],
    ['hot', 'Máxima entre 26° y 34°', 'Mínima entre 26° y 34°'],
    ['pleasant', 'Máxima entre 21° y 25°', 'Mínima entre 21° y 25°'],
    ['mild', 'Máxima entre 10° y 20°', 'Mínima entre 10° y 20°'],
    ['cool', 'Máxima entre 0° y 9°', 'Mínima entre 0° y 9°'],
    ['freezing', 'Máxima bajo cero', 'Mínima bajo cero'],
  ] as [MarkerTemperatureBand, string, string][])('%s → «%s» / «%s»', (band, max, min) => {
    expect(temperatureBandTitle(band, 'max')).toBe(max)
    expect(temperatureBandTitle(band, 'min')).toBe(min)
  })

  it('cada franja tiene un título distinto', () => {
    const titles = MARKER_TEMPERATURE_BANDS.map(({ band }) => temperatureBandTitle(band, 'max'))
    expect(new Set(titles).size).toBe(MARKER_TEMPERATURE_BANDS.length)
  })
})

describe('groupLocations: zona', () => {
  const zones = new Map<string, LocationZone>([
    ['burgos', 'Castilla y León'],
    ['avila', 'Castilla y León'],
    ['albacete', 'Castilla-La Mancha'],
    ['lisboa', 'Portugal'],
    ['andorra', 'Andorra'],
    ['sevilla', 'Andalucía'],
    ['zamora', 'Castilla y León'],
  ])
  const rows = [
    row('lisboa', 'Lisboa', 15, 25),
    row('zamora', 'Zamora', 8, 22),
    row('andorra', 'Andorra la Vella', null, null),
    row('avila', 'Ávila', 5, 20),
    row('albacete', 'Albacete', 12, 30),
    row('sevilla', 'Sevilla', 18, 36),
    row('burgos', 'Burgos', 6, 19),
  ]

  it('un grupo por zona con lugares, en el orden de LOCATION_ZONES; las zonas vacías no salen', () => {
    expect(shape(groupLocations(rows, 'zone', zones))).toEqual([
      { key: 'zone:Andalucía', title: 'Andalucía', band: null, ids: ['sevilla'] },
      { key: 'zone:Castilla y León', title: 'Castilla y León', band: null, ids: ['avila', 'burgos', 'zamora'] },
      { key: 'zone:Castilla-La Mancha', title: 'Castilla-La Mancha', band: null, ids: ['albacete'] },
      { key: 'zone:Portugal', title: 'Portugal', band: null, ids: ['lisboa'] },
      { key: 'zone:Andorra', title: 'Andorra', band: null, ids: ['andorra'] },
    ])
  })

  it('un lugar sin previsión se queda en su zona', () => {
    expect(groupLocations(rows, 'zone', zones).at(-1)?.rows.map((summary) => summary.id)).toEqual(['andorra'])
  })

  it('un lugar sin zona es un error visible, no un grupo inventado', () => {
    expect(() => groupLocations([row('atlantida', 'Atlántida', 1, 2)], 'zone', zones)).toThrow('atlantida')
  })
})

describe('groupLocations: nombre', () => {
  it('un solo grupo sin título, en orden alfabético español: «Ávila» entre «Albacete» y «Burgos»', () => {
    const rows = [row('zamora', 'Zamora', 1, 2), row('avila', 'Ávila', 1, 2), row('burgos', 'Burgos', 1, 2), row('albacete', 'Albacete', 1, 2)]
    expect(shape(groupLocations(rows, 'name', new Map()))).toEqual([{ key: 'name', title: null, band: null, ids: ['albacete', 'avila', 'burgos', 'zamora'] }])
  })

  it('mayúsculas y tildes no rompen el orden', () => {
    const rows = [row('b', 'Évora', 1, 2), row('a', 'evora', 1, 2), row('c', 'Elvas', 1, 2)]
    expect(groupLocations(rows, 'name', new Map())[0].rows.map((summary) => summary.name)).toEqual(['Elvas', 'evora', 'Évora'])
  })
})

describe('groupLocations: temperatura', () => {
  const rows = [
    row('sevilla', 'Sevilla', 20, 38),
    row('cordoba', 'Córdoba', 19, 38),
    row('badajoz', 'Badajoz', 17, 35),
    row('toledo', 'Toledo', 15, 34),
    row('madrid', 'Madrid', 14, 26),
    row('gijon', 'Gijón', 13, 25),
    row('soria', 'Soria', 0, 21),
    row('leon', 'León', -1, 20),
    row('benasque', 'Benasque', -8, 10),
    row('burgos', 'Burgos', -1, 9),
    row('andorra', 'Andorra la Vella', -3, -1),
    row('sin-datos', 'Sin datos', null, null),
  ]

  it('más calor: por máxima de mayor a menor, un grupo por franja, y los lugares sin previsión al final', () => {
    expect(shape(groupLocations(rows, 'warmest', new Map()))).toEqual([
      { key: 'max:scorching', title: 'Máxima de 35° o más', band: 'scorching', ids: ['cordoba', 'sevilla', 'badajoz'] },
      { key: 'max:hot', title: 'Máxima entre 26° y 34°', band: 'hot', ids: ['toledo', 'madrid'] },
      { key: 'max:pleasant', title: 'Máxima entre 21° y 25°', band: 'pleasant', ids: ['gijon', 'soria'] },
      { key: 'max:mild', title: 'Máxima entre 10° y 20°', band: 'mild', ids: ['leon', 'benasque'] },
      { key: 'max:cool', title: 'Máxima entre 0° y 9°', band: 'cool', ids: ['burgos'] },
      { key: 'max:freezing', title: 'Máxima bajo cero', band: 'freezing', ids: ['andorra'] },
      { key: 'no-forecast', title: NO_FORECAST_GROUP_TITLE, band: null, ids: ['sin-datos'] },
    ])
  })

  it('más frío: por mínima de menor a mayor, con las franjas en el mismo sentido', () => {
    expect(shape(groupLocations(rows, 'coldest', new Map()))).toEqual([
      { key: 'min:freezing', title: 'Mínima bajo cero', band: 'freezing', ids: ['benasque', 'andorra', 'burgos', 'leon'] },
      { key: 'min:cool', title: 'Mínima entre 0° y 9°', band: 'cool', ids: ['soria'] },
      { key: 'min:mild', title: 'Mínima entre 10° y 20°', band: 'mild', ids: ['gijon', 'madrid', 'toledo', 'badajoz', 'cordoba', 'sevilla'] },
      { key: 'no-forecast', title: NO_FORECAST_GROUP_TITLE, band: null, ids: ['sin-datos'] },
    ])
  })

  it('cada lugar va en el grupo de la franja con la que el mapa colorea su cifra, también en los valores límite', () => {
    const limits = [-1, 0, 9, 10, 20, 21, 25, 26, 34, 35].map((celsius) => row(`t${celsius}`, `Lugar ${celsius}`, celsius, celsius))
    for (const order of ['warmest', 'coldest'] as const) {
      for (const group of groupLocations(limits, order, new Map())) {
        for (const summary of group.rows) expect(classifyMarkerTemperature(summary.maxC!)).toBe(group.band)
      }
    }
  })

  it('solo falta la cifra por la que se ordena: sin máxima va al grupo sin previsión en «más calor», no en «más frío»', () => {
    const partial = [row('solo-minima', 'Solo mínima', 5, null), row('completo', 'Completo', 5, 15)]
    expect(shape(groupLocations(partial, 'warmest', new Map())).map((group) => group.ids)).toEqual([['completo'], ['solo-minima']])
    expect(shape(groupLocations(partial, 'coldest', new Map())).map((group) => group.ids)).toEqual([['completo', 'solo-minima']])
  })

  it('el grupo sin previsión es siempre el último, y va en orden alfabético', () => {
    const noForecast = [row('z', 'Zamora', null, null), row('a', 'Ávila', null, null), row('m', 'Madrid', 30, 40)]
    for (const order of ['warmest', 'coldest'] as const) {
      const groups = groupLocations(noForecast, order, new Map())
      expect(groups.at(-1)).toMatchObject({ key: 'no-forecast', title: 'Sin previsión' })
      expect(groups.at(-1)?.rows.map((summary) => summary.id)).toEqual(['a', 'z'])
    }
  })

  it('sin ningún lugar con previsión, solo el grupo sin previsión', () => {
    expect(shape(groupLocations([row('x', 'X', null, null)], 'warmest', new Map()))).toEqual([{ key: 'no-forecast', title: 'Sin previsión', band: null, ids: ['x'] }])
  })
})

describe('groupLocations: desempates deterministas', () => {
  // Misma cifra y hasta el mismo nombre: el resultado no puede depender del
  // orden en que llegan.
  const rows = [row('b-2', 'Beja', 10, 30), row('a', 'Aveiro', 10, 30), row('b-1', 'Beja', 10, 30), row('c', 'Cádiz', 10, 30)]
  const permutations = [rows, rows.toReversed(), [rows[2], rows[0], rows[3], rows[1]]]
  const zones = new Map<string, LocationZone>(rows.map((summary) => [summary.id, 'Portugal']))

  it.each(ORDERS)('%s: el mismo resultado con la entrada en cualquier orden', (order) => {
    const results = permutations.map((input) => shape(groupLocations(input, order, zones)))
    expect(results[1]).toEqual(results[0])
    expect(results[2]).toEqual(results[0])
    expect(results[0].flatMap((group) => group.ids)).toEqual(['a', 'b-1', 'b-2', 'c'])
  })
})

describe('groupLocations: pureza', () => {
  it.each(ORDERS)('%s: sin lugares, ningún grupo', (order) => {
    expect(groupLocations([], order, new Map())).toEqual([])
  })

  it.each(ORDERS)('%s: no cambia la entrada y devuelve arrays nuevos', (order) => {
    const input = Object.freeze([row('z', 'Zamora', 2, 30), row('a', 'Ávila', null, null), row('m', 'Madrid', -2, 12)].map((summary) => Object.freeze(summary)))
    const zones = new Map<string, LocationZone>([
      ['z', 'Castilla y León'],
      ['a', 'Castilla y León'],
      ['m', 'Comunidad de Madrid'],
    ])
    const before = structuredClone([...input])

    const groups = groupLocations(input, order, zones)

    expect([...input]).toEqual(before)
    for (const group of groups) expect(group.rows).not.toBe(input)
  })
})
