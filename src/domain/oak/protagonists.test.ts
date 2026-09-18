import { describe, expect, it } from 'vitest'

import type { PokedexId } from '../pokedex.ts'
import { POKEMON_LABELS } from '../pokemon-labels.ts'
import { selectProtagonists } from './protagonists.ts'
import type { NarrativeFact, PokemonSpotlightFact } from './types.ts'

function spotlight(pokemonId: PokedexId, locationCount: number): PokemonSpotlightFact {
  const locations = Array.from({ length: Math.min(locationCount, 3) }, (_, index) => ({
    locationId: `${pokemonId}-${index}`,
    locationName: `Lugar ${index}`,
    mapPokemonId: pokemonId,
  }))
  return { kind: 'pokemon_spotlight', pokemonId, label: POKEMON_LABELS[pokemonId], locations, locationCount }
}

function rolesOf(facts: NarrativeFact[]): [string, PokedexId][] {
  return selectProtagonists(facts).map((protagonist) => [protagonist.role, protagonist.spotlight.pokemonId])
}

describe('selectProtagonists', () => {
  it('headline: el mejor situado en MAP_PRIORITY de los presentes hoy', () => {
    // castform-rain (7º) va por delante de charmander (17º); zapdos (2º) de los dos.
    const protagonists = selectProtagonists([spotlight('charmander', 30), spotlight('castform-rain', 12), spotlight('zapdos', 1)])

    expect(protagonists[0].role).toBe('headline')
    expect(protagonists[0].spotlight.pokemonId).toBe('zapdos')
  })

  it('headline no es el más repetido: manda la posición editorial, no el recuento', () => {
    expect(rolesOf([spotlight('charmander', 40), spotlight('cryogonal', 1)])[0]).toEqual(['headline', 'cryogonal'])
  })

  it('spread: el de mayor locationCount', () => {
    const roles = rolesOf([spotlight('zapdos', 2), spotlight('charmander', 30), spotlight('castform', 9)])

    expect(roles).toContainEqual(['spread', 'charmander'])
  })

  it('spread: un empate de recuento lo rompe MAP_PRIORITY', () => {
    // castform-rain (7º) y charmander (17º) empatan a 10 lugares.
    const roles = rolesOf([spotlight('zapdos', 1), spotlight('charmander', 10), spotlight('castform-rain', 10)])

    expect(roles).toContainEqual(['spread', 'castform-rain'])
  })

  it('si el más repetido ya es headline, spread pasa al siguiente distinto', () => {
    // zapdos es a la vez el mejor de MAP_PRIORITY y el más repetido.
    const roles = rolesOf([spotlight('zapdos', 40), spotlight('charmander', 20), spotlight('castform', 5)])

    expect(roles[0]).toEqual(['headline', 'zapdos'])
    expect(roles[1]).toEqual(['spread', 'charmander'])
  })

  it('rarity: el de menor recuento entre los significativos', () => {
    const roles = rolesOf([spotlight('zapdos', 20), spotlight('charmander', 30), spotlight('cryogonal', 2), spotlight('kyogre', 7)])

    expect(roles).toContainEqual(['rarity', 'cryogonal'])
  })

  it('rarity: un empate de recuento lo rompe MAP_PRIORITY', () => {
    // cryogonal (3º) y castform-ice (6º) empatan a 1 lugar.
    const roles = rolesOf([spotlight('zapdos', 20), spotlight('charmander', 30), spotlight('castform-ice', 1), spotlight('cryogonal', 1)])

    expect(roles).toContainEqual(['rarity', 'cryogonal'])
  })

  const ordinaryCases: PokedexId[] = ['castform', 'altaria', 'castform-sun', 'hoppip']

  it.each(ordinaryCases)('rarity: %s aunque salga en un único lugar, nunca es una rareza interesante', (ordinary) => {
    const roles = rolesOf([spotlight('zapdos', 20), spotlight('charmander', 30), spotlight(ordinary, 1)])

    expect(roles.map(([role]) => role)).not.toContain('rarity')
  })

  it('rarity: un Pokémon significativo en 1–2 lugares sí lo es', () => {
    const roles = rolesOf([spotlight('zapdos', 20), spotlight('charmander', 30), spotlight('castform-sun', 1), spotlight('abomasnow', 2)])

    expect(roles).toContainEqual(['rarity', 'abomasnow'])
  })

  it('los tres papeles caen en un único Pokémon: solo se reparte una vez', () => {
    // gyarados-mega es el mejor de MAP_PRIORITY, el más repetido y el único
    // significativo: no puede ocupar tres papeles.
    expect(rolesOf([spotlight('gyarados-mega', 5), spotlight('castform', 2)])).toEqual([
      ['headline', 'gyarados-mega'],
      ['spread', 'castform'],
    ])
  })

  it('un único Pokémon visible: un único protagonista', () => {
    expect(rolesOf([spotlight('charmander', 74)])).toEqual([['headline', 'charmander']])
  })

  it('sin ningún Pokémon visible: sin protagonistas, no un error', () => {
    expect(selectProtagonists([])).toEqual([])
  })

  it('los tres papeles cuando hay candidatos de sobra', () => {
    expect(rolesOf([spotlight('charmander', 30), spotlight('zapdos', 4), spotlight('cryogonal', 1), spotlight('castform', 8)])).toEqual([
      ['headline', 'zapdos'],
      ['spread', 'charmander'],
      ['rarity', 'cryogonal'],
    ])
  })

  it('el resultado no depende del orden en que lleguen los hechos', () => {
    const facts = [spotlight('charmander', 30), spotlight('zapdos', 4), spotlight('cryogonal', 1), spotlight('castform', 8), spotlight('kyogre', 4)]
    const expected = rolesOf(facts)

    expect(rolesOf([...facts].reverse())).toEqual(expected)
    expect(rolesOf([facts[2], facts[4], facts[0], facts[3], facts[1]])).toEqual(expected)
  })

  it('no copia los datos del spotlight: los arrastra tal cual', () => {
    const zapdos = spotlight('zapdos', 3)
    const [headline] = selectProtagonists([zapdos])

    expect(headline.spotlight).toBe(zapdos)
    expect(Object.keys(headline)).toEqual(['role', 'spotlight'])
  })

  it('ignora los hechos que no son spotlight', () => {
    const facts: NarrativeFact[] = [
      { kind: 'calendar', date: '2026-09-18', weekday: 'viernes', weekend: false },
      { kind: 'day_shape', totalLocations: 74, rainingLocations: 3, alertedLocations: 0, distinctPokemonCount: 2 },
      spotlight('zapdos', 2),
    ]

    expect(rolesOf(facts)).toEqual([['headline', 'zapdos']])
  })
})
