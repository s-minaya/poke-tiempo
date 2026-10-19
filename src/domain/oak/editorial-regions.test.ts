import { describe, expect, it } from 'vitest'

import { locations } from '../../data/locations.ts'
import { DERIVED_REGION_IDS, EDITORIAL_REGIONS, PARENT_SCOPE, PATTERN_SCOPES, scopeLabel, scopeLocationIds } from './editorial-regions.ts'
import type { EditorialRegionId } from './types.ts'

const EXPECTED_REGION_SIZES: Record<EditorialRegionId, number> = {
  northwest: 6,
  north: 13,
  northeast: 10,
  meseta: 17,
  southwest: 8,
  southeast: 6,
  mediterranean: 9,
}

/**
 * La composición normativa aprobada por la 013, escrita a mano y **sin derivar**
 * de `EDITORIAL_REGIONS`: si un lugar cambia de región, este test lo caza.
 */
const EXPECTED_EDITORIAL_REGIONS: Record<EditorialRegionId, readonly string[]> = {
  northwest: ['a-coruna', 'lugo', 'ourense', 'pontevedra', 'oviedo', 'gijon'],
  north: [
    'a-coruna',
    'lugo',
    'ourense',
    'pontevedra',
    'oviedo',
    'gijon',
    'cantabria',
    'pais-vasco',
    'navarra',
    'la-rioja',
    'huesca',
    'jaca',
    'benasque',
  ],
  northeast: ['huesca', 'jaca', 'benasque', 'teruel', 'alcaniz', 'zaragoza', 'barcelona', 'lleida', 'girona', 'tarragona'],
  meseta: [
    'leon',
    'palencia',
    'burgos',
    'zamora',
    'salamanca',
    'avila',
    'segovia',
    'soria',
    'valladolid',
    'guadalajara',
    'cuenca',
    'tarancon',
    'albacete',
    'toledo',
    'ciudad-real',
    'manzanares',
    'madrid',
  ],
  southwest: ['caceres', 'plasencia', 'badajoz', 'merida', 'huelva', 'sevilla', 'cadiz', 'cordoba'],
  southeast: ['jaen', 'huescar', 'granada', 'almeria', 'murcia', 'alicante'],
  mediterranean: ['barcelona', 'girona', 'tarragona', 'castellon', 'valencia', 'alicante', 'murcia', 'almeria', 'malaga'],
}

const KNOWN_LOCATION_IDS = new Set(locations.map((location) => location.id))

describe('EDITORIAL_REGIONS', () => {
  it('tiene las siete regiones con el tamaño fijado', () => {
    expect(Object.keys(EDITORIAL_REGIONS)).toHaveLength(7)
    for (const [region, size] of Object.entries(EXPECTED_REGION_SIZES)) {
      expect(EDITORIAL_REGIONS[region as EditorialRegionId]).toHaveLength(size)
    }
  })

  it('coincide lugar a lugar con la composición normativa de la 013', () => {
    for (const region of Object.keys(EXPECTED_EDITORIAL_REGIONS) as EditorialRegionId[]) {
      expect(EDITORIAL_REGIONS[region]).toEqual([...EXPECTED_EDITORIAL_REGIONS[region]])
    }
  })

  it('solo nombra locationId reales de src/data/locations.ts', () => {
    for (const members of Object.values(EDITORIAL_REGIONS)) {
      for (const id of members) expect(KNOWN_LOCATION_IDS.has(id)).toBe(true)
    }
  })

  it('declara los solapes deliberados, sin resolverlos por descarte', () => {
    const north = new Set(EDITORIAL_REGIONS.north)
    expect(EDITORIAL_REGIONS.northwest.every((id) => north.has(id))).toBe(true)

    const northeast = new Set(EDITORIAL_REGIONS.northeast)
    expect(['huesca', 'jaca', 'benasque'].every((id) => north.has(id) && northeast.has(id))).toBe(true)

    const mediterranean = new Set(EDITORIAL_REGIONS.mediterranean)
    expect(['barcelona', 'girona', 'tarragona'].every((id) => northeast.has(id) && mediterranean.has(id))).toBe(true)

    const southeast = new Set(EDITORIAL_REGIONS.southeast)
    expect(['murcia', 'alicante', 'almeria'].every((id) => southeast.has(id) && mediterranean.has(id))).toBe(true)
  })
})

describe('scopeLocationIds', () => {
  it('los tres ámbitos globales tienen 74, 65 y 63 lugares', () => {
    expect(scopeLocationIds('map', locations)).toHaveLength(74)
    expect(scopeLocationIds('spain', locations)).toHaveLength(65)
    expect(scopeLocationIds('iberian-peninsula', locations)).toHaveLength(63)
  })

  it('la península deja fuera Canarias, Baleares, Ceuta y Melilla, y suma Portugal y Andorra', () => {
    const peninsula = new Set(scopeLocationIds('iberian-peninsula', locations))

    for (const id of ['la-palma', 'mallorca', 'ceuta', 'melilla']) expect(peninsula.has(id)).toBe(false)
    for (const id of ['lisboa', 'porto', 'andorra-la-vella']) expect(peninsula.has(id)).toBe(true)
  })

  it('los grupos derivados salen de la zona o el país, no de una tabla', () => {
    expect(DERIVED_REGION_IDS).toEqual(['canarias', 'baleares', 'portugal'])
    expect(scopeLocationIds('region:canarias', locations)).toHaveLength(6)
    expect(scopeLocationIds('region:baleares', locations)).toHaveLength(3)
    expect(scopeLocationIds('region:portugal', locations)).toHaveLength(8)
  })

  it('una región explícita devuelve sus locationId en el orden de la tabla', () => {
    expect(scopeLocationIds('region:northwest', locations)).toEqual([...EDITORIAL_REGIONS.northwest])
  })

  it('respeta el orden de `locations`, para que un empate no dependa del azar', () => {
    const ids = scopeLocationIds('map', locations)
    expect(ids).toEqual(locations.map((location) => location.id))
  })
})

describe('PARENT_SCOPE', () => {
  it('cubre los trece ámbitos sin repetir y coincide con PATTERN_SCOPES', () => {
    expect(PATTERN_SCOPES).toHaveLength(13)
    expect(new Set(PATTERN_SCOPES).size).toBe(13)
    expect(new Set(Object.keys(PARENT_SCOPE))).toEqual(new Set(PATTERN_SCOPES))
  })

  it('sigue la jerarquía fijada', () => {
    expect(PARENT_SCOPE.map).toBeNull()
    expect(PARENT_SCOPE.spain).toBe('map')
    expect(PARENT_SCOPE['iberian-peninsula']).toBe('map')

    for (const region of Object.keys(EDITORIAL_REGIONS) as EditorialRegionId[]) {
      expect(PARENT_SCOPE[`region:${region}`]).toBe('spain')
    }
    expect(PARENT_SCOPE['region:canarias']).toBe('spain')
    expect(PARENT_SCOPE['region:baleares']).toBe('spain')
    expect(PARENT_SCOPE['region:portugal']).toBe('iberian-peninsula')
  })
})

describe('scopeLabel', () => {
  it('es la única etiqueta base y no lleva ningún recuento', () => {
    for (const scope of PATTERN_SCOPES) {
      expect(scopeLabel(scope)).not.toMatch(/\d/)
    }
  })

  it('Portugal no se generaliza ni con sus ocho lugares', () => {
    expect(scopeLabel('region:portugal')).toBe('los lugares de Portugal representados en el mapa')
  })
})
