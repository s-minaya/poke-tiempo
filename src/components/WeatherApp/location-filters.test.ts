import { describe, expect, it } from 'vitest'

import type { ExplorationState, LocationFilters, SearchEntry } from './location-filters.ts'
import type { LocationSummary } from '../LocationCard/location-summary.ts'
import type { LocationZone } from '../../domain/location-zones.ts'
import type { PokedexId } from '../../domain/pokedex.ts'
import type { Location } from '../../domain/types.ts'

import { LOCATION_ZONES } from '../../domain/location-zones.ts'
import { INITIAL_EXPLORATION, NO_FILTERS, applyFilters, buildSearchIndex, hasActiveFilters, matchingLocationIds, normalizeForSearch, searchWords } from './location-filters.ts'

function place(id: string, name: string, administrativeArea: string, zone: LocationZone, country: Location['country'] = 'ES'): Location {
  return {
    id,
    name,
    administrativeArea,
    zone,
    country,
    latitude: 40,
    longitude: -3,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    sourceIds: {},
    coastal: false,
  }
}

function summary(id: string, name: string, pokemon: [PokedexId, string, string] | null): LocationSummary {
  return {
    id,
    name,
    administrativeArea: null,
    pokemonId: pokemon?.[0] ?? null,
    pokemonName: pokemon?.[1] ?? null,
    condition: pokemon?.[2] ?? null,
    minC: pokemon ? 10 : null,
    maxC: pokemon ? 20 : null,
  }
}

// Un día pequeño con los casos difíciles: eñe, tildes, nombres compuestos y
// portugueses, un lugar sin previsión y dos lugares con el mismo Pokémon.
const LOCATIONS: Location[] = [
  place('a-coruna', 'A Coruña', 'A Coruña', 'Galicia'),
  place('madrid', 'Madrid', 'Madrid', 'Comunidad de Madrid'),
  place('toledo', 'Toledo', 'Toledo', 'Castilla-La Mancha'),
  place('avila', 'Ávila', 'Ávila', 'Castilla y León'),
  place('gran-canaria', 'Gran Canaria', 'Las Palmas', 'Canarias'),
  place('sevilla', 'Sevilla', 'Sevilla', 'Andalucía'),
  place('vila-real', 'Vila Real', 'Vila Real', 'Portugal', 'PT'),
  place('evora', 'Évora', 'Évora', 'Portugal', 'PT'),
  place('andorra-la-vella', 'Andorra la Vella', 'Andorra', 'Andorra', 'AD'),
]

const SUMMARIES: LocationSummary[] = [
  summary('a-coruna', 'A Coruña', ['castform', 'Castform', 'Niebla']),
  summary('madrid', 'Madrid', ['charmeleon', 'Charmeleon', 'Muy caluroso']),
  summary('toledo', 'Toledo', ['magmar', 'Magmar', 'Sofocante']),
  summary('avila', 'Ávila', ['charmander', 'Charmander', 'Caluroso']),
  summary('gran-canaria', 'Gran Canaria', ['castform-sun', 'Castform', 'Soleado']),
  summary('sevilla', 'Sevilla', ['magmar', 'Magmar', 'Sofocante']),
  summary('vila-real', 'Vila Real', ['castform-rain', 'Castform', 'Lluvia']),
  summary('evora', 'Évora', ['charmeleon', 'Charmeleon', 'Muy caluroso']),
  summary('andorra-la-vella', 'Andorra la Vella', null),
]

const INDEX = buildSearchIndex(LOCATIONS, SUMMARIES)

function filters(overrides: Partial<LocationFilters>): LocationFilters {
  return { ...NO_FILTERS, ...overrides }
}

function ids(result: ReadonlySet<string> | null): string[] | null {
  return result === null ? null : [...result].sort()
}

describe('normalizeForSearch', () => {
  it.each([
    ['A Coruña', 'a coruna'],
    ['CORUÑA', 'coruna'],
    ['Ávila', 'avila'],
    ['ÉVORA', 'evora'],
    ['Castellón', 'castellon'],
    ['Castilla-La Mancha', 'castilla la mancha'],
    ['Vila Real', 'vila real'],
    ['vila-real', 'vila real'],
    ['São Brás de Alportel', 'sao bras de alportel'],
    ["L'Hospitalet", 'l hospitalet'],
    ['  Gran   Canaria  ', 'gran canaria'],
    ['Máxima 35°', 'maxima 35'],
    ['', ''],
  ])('«%s» → «%s»', (text, expected) => {
    expect(normalizeForSearch(text)).toBe(expected)
  })
})

describe('searchWords', () => {
  it.each([
    ['', []],
    ['   ', []],
    ['— · -', []],
    ['coruña', ['coruna']],
    ['  la   CORUÑA ', ['la', 'coruna']],
    ['castilla-la mancha', ['castilla', 'la', 'mancha']],
  ])('«%s» → %j', (query, expected) => {
    expect(searchWords(query)).toEqual(expected)
  })
})

describe('buildSearchIndex', () => {
  it('una entrada por lugar, con nombre, área administrativa, zona, Pokémon y condición normalizados', () => {
    expect(INDEX).toHaveLength(LOCATIONS.length)
    expect(INDEX.find((entry) => entry.id === 'gran-canaria')).toEqual({
      id: 'gran-canaria',
      country: 'ES',
      zone: 'Canarias',
      pokemonId: 'castform-sun',
      text: 'gran canaria las palmas canarias castform soleado',
    })
  })

  it('el área administrativa entra aunque el resumen la omita por coincidir con el nombre', () => {
    expect(INDEX.find((entry) => entry.id === 'madrid')?.text).toBe('madrid madrid comunidad de madrid charmeleon muy caluroso')
  })

  it('un lugar sin previsión se indexa sin Pokémon ni condición', () => {
    expect(INDEX.find((entry) => entry.id === 'andorra-la-vella')).toMatchObject({ pokemonId: null, text: 'andorra la vella andorra andorra' })
  })
})

describe('matchingLocationIds: null frente a conjunto vacío', () => {
  it.each([
    ['sin ningún filtro', NO_FILTERS],
    ['una búsqueda vacía', filters({ query: '' })],
    ['una búsqueda de solo espacios', filters({ query: '    ' })],
    ['una búsqueda de solo signos', filters({ query: '-·—' })],
  ])('%s → null: no hay filtro activo y se muestra todo', (_, value) => {
    expect(hasActiveFilters(value)).toBe(false)
    expect(matchingLocationIds(INDEX, value)).toBeNull()
  })

  it.each([
    ['una búsqueda sin coincidencias', filters({ query: 'zzz' })],
    ['palabras que existen, pero en lugares distintos', filters({ query: 'madrid coruña' })],
    ['una condición que hoy no sale', filters({ conditions: ['kyogre'] })],
    ['zona y condición incompatibles', filters({ zone: 'Portugal', conditions: ['magmar'] })],
  ])('%s → conjunto vacío, no null: hay filtros y ningún lugar los cumple', (_, value) => {
    expect(hasActiveFilters(value)).toBe(true)
    const result = matchingLocationIds(INDEX, value)
    expect(result).not.toBeNull()
    expect(result?.size).toBe(0)
  })
})

describe('matchingLocationIds: búsqueda', () => {
  it.each([
    ['coruña', ['a-coruna']],
    ['coruna', ['a-coruna']],
    ['CORUÑA', ['a-coruna']],
    ['a coruña', ['a-coruna']],
    ['avila', ['avila']],
    ['ÁVILA', ['avila']],
    ['évora', ['evora']],
    ['EVORA', ['evora']],
    ['vila real', ['vila-real']],
    ['vila-real', ['vila-real']],
    ['real vila', ['vila-real']],
    ['andorra la vella', ['andorra-la-vella']],
    ['gran canaria', ['gran-canaria']],
    ['canaria gran', ['gran-canaria']],
    ['castilla la mancha', ['toledo']],
    ['castilla-la mancha', ['toledo']],
    ['castilla', ['avila', 'toledo']],
    ['las palmas', ['gran-canaria']],
    ['magmar', ['sevilla', 'toledo']],
    ['sofocante', ['sevilla', 'toledo']],
    ['castform', ['a-coruna', 'gran-canaria', 'vila-real']],
  ])('«%s» → %j', (query, expected) => {
    expect(ids(matchingLocationIds(INDEX, filters({ query })))).toEqual(expected)
  })

  it.each([
    ['nombre + condición', 'madrid caluroso', ['madrid']],
    ['nombre + Pokémon', 'toledo magmar', ['toledo']],
    ['zona + condición', 'andalucia sofocante', ['sevilla']],
    ['área administrativa + Pokémon', 'palmas castform', ['gran-canaria']],
    ['zona + Pokémon, con tilde en la búsqueda', 'andalucía MAGMAR', ['sevilla']],
    ['condición + zona que no coinciden en el mismo lugar', 'sofocante galicia', []],
  ])('varias palabras en campos distintos del mismo lugar (%s): «%s» → %j', (_, query, expected) => {
    expect(ids(matchingLocationIds(INDEX, filters({ query })))).toEqual(expected)
  })
})

describe('matchingLocationIds: zona', () => {
  it("'ES' es «Toda España»: un filtro por país, no una zona", () => {
    expect((LOCATION_ZONES as readonly string[]).includes('ES')).toBe(false)
    expect(ids(matchingLocationIds(INDEX, filters({ zone: 'ES' })))).toEqual(['a-coruna', 'avila', 'gran-canaria', 'madrid', 'sevilla', 'toledo'])
  })

  it.each([
    ['Portugal', ['evora', 'vila-real']],
    ['Andorra', ['andorra-la-vella']],
    ['Galicia', ['a-coruna']],
    ['Canarias', ['gran-canaria']],
    ['Cataluña', []],
  ] as [LocationZone, string[]][])('%s → %j', (zone, expected) => {
    expect(ids(matchingLocationIds(INDEX, filters({ zone })))).toEqual(expected)
  })
})

describe('matchingLocationIds: condiciones', () => {
  it.each([
    ['una condición', ['magmar'], ['sevilla', 'toledo']],
    ['basta con una de las pulsadas', ['magmar', 'castform'], ['a-coruna', 'sevilla', 'toledo']],
    ['formas distintas del mismo Pokémon son condiciones distintas', ['castform-rain'], ['vila-real']],
  ] as [string, PokedexId[], string[]][])('%s: %j → %j', (_, conditions, expected) => {
    expect(ids(matchingLocationIds(INDEX, filters({ conditions })))).toEqual(expected)
  })

  it('un lugar sin previsión no cumple ninguna condición', () => {
    const all = SUMMARIES.flatMap((row) => (row.pokemonId ? [row.pokemonId] : []))
    expect(matchingLocationIds(INDEX, filters({ conditions: all }))?.has('andorra-la-vella')).toBe(false)
  })
})

describe('matchingLocationIds: combinaciones', () => {
  it.each([
    ['Toda España + condición', { zone: 'ES', conditions: ['charmeleon'] }, ['madrid']],
    ['Portugal + condición', { zone: 'Portugal', conditions: ['charmeleon'] }, ['evora']],
    ['zona + búsqueda', { zone: 'Castilla y León', query: 'castilla' }, ['avila']],
    ['los tres a la vez', { zone: 'ES', conditions: ['magmar', 'charmander'], query: 'castilla' }, ['avila', 'toledo']],
    ['los tres, sin resultado', { zone: 'Andalucía', conditions: ['magmar'], query: 'toledo' }, []],
  ] as [string, Partial<LocationFilters>, string[]][])('%s → %j', (_, value, expected) => {
    expect(ids(matchingLocationIds(INDEX, filters(value)))).toEqual(expected)
  })
})

describe('pureza', () => {
  it('ni el índice ni los filtros cambian, y cada llamada devuelve un conjunto nuevo', () => {
    const index: readonly SearchEntry[] = Object.freeze(INDEX.map((entry) => Object.freeze({ ...entry })))
    const value = Object.freeze(filters({ zone: 'ES', query: 'Castilla', conditions: Object.freeze(['magmar', 'charmander'] as PokedexId[]) }))
    const snapshot = structuredClone({ index, value })

    const first = matchingLocationIds(index, value)
    const second = matchingLocationIds(index, value)

    expect({ index, value }).toEqual(snapshot)
    expect(first).not.toBe(second)
    expect(ids(first)).toEqual(ids(second))
  })

  it('construir el índice no cambia los lugares ni los resúmenes', () => {
    const snapshot = structuredClone({ LOCATIONS, SUMMARIES })
    buildSearchIndex(Object.freeze([...LOCATIONS]), Object.freeze([...SUMMARIES]))
    expect({ LOCATIONS, SUMMARIES }).toEqual(snapshot)
  })
})

describe('applyFilters: la selección ante unos filtros nuevos', () => {
  const selected = (selectedLocationId: string | null): ExplorationState => ({ filters: NO_FILTERS, selectedLocationId })

  it.each([
    ['sin selección, sigue sin ella', null, filters({ zone: 'Portugal' }), null],
    ['el seleccionado sigue cumpliendo los filtros: se conserva', 'evora', filters({ zone: 'Portugal' }), 'evora'],
    ['el seleccionado deja de cumplirlos: se anula', 'madrid', filters({ zone: 'Portugal' }), null],
    ['por una búsqueda que lo excluye', 'madrid', filters({ query: 'coruña' }), null],
    ['por una condición que no es la suya', 'madrid', filters({ conditions: ['magmar'] }), null],
    ['por unos filtros sin ningún resultado', 'madrid', filters({ query: 'zzz' }), null],
    ['quitar todos los filtros lo conserva', 'madrid', NO_FILTERS, 'madrid'],
    ['una búsqueda de solo espacios no es un filtro: lo conserva', 'madrid', filters({ query: '   ' }), 'madrid'],
  ] as [string, string | null, LocationFilters, string | null][])('%s', (_, before, next, after) => {
    expect(applyFilters(selected(before), next, INDEX)).toEqual({ filters: next, selectedLocationId: after })
  })

  it('filtros y selección cambian en un único estado nuevo, sin tocar el anterior', () => {
    const state = Object.freeze(selected('madrid'))
    const next = filters({ zone: 'Portugal' })

    const result = applyFilters(state, next, INDEX)

    expect(result).not.toBe(state)
    expect(state).toEqual({ filters: NO_FILTERS, selectedLocationId: 'madrid' })
    expect(result.filters).toBe(next)
    expect(result.selectedLocationId).toBeNull()
  })

  it('el estado inicial no tiene filtros ni selección', () => {
    expect(INITIAL_EXPLORATION).toEqual({ filters: NO_FILTERS, selectedLocationId: null })
    expect(matchingLocationIds(INDEX, INITIAL_EXPLORATION.filters)).toBeNull()
  })
})
