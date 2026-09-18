import { describe, expect, it } from 'vitest'

import type { PokedexId } from './pokedex.ts'
import { MAP_PRIORITY, isSignificantPokemon, pickMapPokemon } from './map-priority.ts'
import { POKEMON_LABELS } from './pokemon-labels.ts'

interface PriorityCase {
  input: PokedexId[]
  expected: PokedexId
  label: string
}

describe('pickMapPokemon', () => {
  it('lista vacía → null', () => {
    expect(pickMapPokemon([])).toBeNull()
  })

  it('un único Pokémon → ese mismo', () => {
    expect(pickMapPokemon(['charmander'])).toBe('charmander')
  })

  const priorityCases: PriorityCase[] = [
    { input: ['charmander', 'castform'], expected: 'charmander', label: 'temperatura relevante por delante de cielo nuboso/cubierto' },
    { input: ['castform', 'hoppip'], expected: 'hoppip', label: 'viento por delante de cielo' },
    { input: ['hoppip', 'dragonite'], expected: 'dragonite', label: 'viento fuerte por delante de viento moderado' },
    { input: ['hoppip', 'moltres'], expected: 'moltres', label: 'viento cálido por delante del resto de la familia de viento' },
    { input: ['moltres', 'gyarados'], expected: 'gyarados', label: 'oleaje (sin aviso) por delante de viento cálido' },
    { input: ['hoppip', 'gyarados'], expected: 'gyarados', label: 'oleaje (sin aviso) por delante de viento' },
    {
      input: ['gyarados', 'castform-rain'],
      expected: 'castform-rain',
      label: 'lluvia por delante de oleaje sin aviso — Gyarados es demasiado frecuente en costa para tapar la lluvia',
    },
    { input: ['castform-rain', 'castform-ice'], expected: 'castform-ice', label: 'niebla por delante de lluvia' },
    { input: ['castform-ice', 'hippowdon'], expected: 'hippowdon', label: 'calima por delante de niebla' },
    { input: ['hippowdon', 'abomasnow'], expected: 'abomasnow', label: 'nieve por delante de calima' },
    { input: ['cryogonal', 'zapdos'], expected: 'zapdos', label: 'tormenta por delante de nieve' },
    { input: ['zapdos', 'gyarados-mega'], expected: 'gyarados-mega', label: 'Mega Gyarados por delante de todo' },
  ]

  it.each(priorityCases)('$label', ({ input, expected }) => {
    expect(pickMapPokemon(input)).toBe(expected)
  })

  it('Mega Gyarados gana aunque aparezca junto a cualquier otra combinación', () => {
    expect(pickMapPokemon(['groudon-primal', 'tornadus', 'kyogre-primal', 'gyarados-mega', 'zapdos'])).toBe(
      'gyarados-mega',
    )
  })

  it('el orden de entrada no importa, solo la prioridad', () => {
    expect(pickMapPokemon(['charmander', 'castform-rain'])).toBe('castform-rain')
    expect(pickMapPokemon(['castform-rain', 'charmander'])).toBe('castform-rain')
  })

  it('temperatura es el respaldo cuando ningún otro eje asigna nada', () => {
    expect(pickMapPokemon(['groudon'])).toBe('groudon')
  })

  it('la temperatura real gana sobre castform-sun cuando el cielo despejado coincide con otro tramo (evita tapar un día caluroso despejado)', () => {
    expect(pickMapPokemon(['charmeleon', 'castform-sun'])).toBe('charmeleon')
    expect(pickMapPokemon(['snorunt', 'castform-sun'])).toBe('snorunt')
  })

  it('castform-sun sí gana cuando es el único candidato de temperatura (despejado y 15–25°C a la vez)', () => {
    expect(pickMapPokemon(['castform-sun'])).toBe('castform-sun')
  })

  // Hoppip (viento moderado) y las representaciones ordinarias de cielo
  // (Castform, Altaria, Castform-sun) son condiciones secundarias: ceden
  // ante temperatura relevante y ante viento fuerte, pero ganan entre sí
  // salvo Altaria/Castform-sun, que se ordenan por especificidad.
  describe('Hoppip y las representaciones de cielo ordinarias como condiciones secundarias', () => {
    it.each([
      { input: ['magmar', 'altaria'] as PokedexId[], expected: 'magmar', label: 'Magmar + Altaria → Magmar' },
      { input: ['charmeleon', 'altaria'] as PokedexId[], expected: 'charmeleon', label: 'Charmeleon + Altaria → Charmeleon' },
      { input: ['snorunt', 'altaria'] as PokedexId[], expected: 'snorunt', label: 'Snorunt + Altaria → Snorunt' },
      { input: ['castform-sun', 'altaria'] as PokedexId[], expected: 'altaria', label: 'Castform-sun + Altaria → Altaria' },
      { input: ['magmar', 'castform'] as PokedexId[], expected: 'magmar', label: 'Magmar + Castform → Magmar' },
      { input: ['hoppip', 'magmar'] as PokedexId[], expected: 'magmar', label: 'Hoppip + Magmar → Magmar' },
      { input: ['hoppip', 'charmeleon'] as PokedexId[], expected: 'charmeleon', label: 'Hoppip + Charmeleon → Charmeleon' },
      { input: ['hoppip', 'charmander'] as PokedexId[], expected: 'charmander', label: 'Hoppip + Charmander → Charmander' },
      { input: ['hoppip', 'solrock'] as PokedexId[], expected: 'solrock', label: 'Hoppip + Solrock → Solrock' },
      { input: ['hoppip', 'snorunt'] as PokedexId[], expected: 'snorunt', label: 'Hoppip + Snorunt → Snorunt' },
      { input: ['hoppip', 'castform-sun'] as PokedexId[], expected: 'hoppip', label: 'Hoppip + Castform-sun → Hoppip' },
      { input: ['hoppip', 'altaria'] as PokedexId[], expected: 'hoppip', label: 'Hoppip + Altaria → Hoppip' },
      { input: ['hoppip', 'castform'] as PokedexId[], expected: 'hoppip', label: 'Hoppip + Castform → Hoppip' },
      { input: ['hoppip', 'zapdos'] as PokedexId[], expected: 'zapdos', label: 'Hoppip + Zapdos → Zapdos' },
      { input: ['hoppip', 'gyarados'] as PokedexId[], expected: 'gyarados', label: 'Hoppip + Gyarados → Gyarados' },
      { input: ['magmar', 'hoppip', 'castform'] as PokedexId[], expected: 'magmar', label: 'Magmar + Hoppip + Castform → Magmar' },
      { input: ['hoppip', 'castform', 'castform-sun'] as PokedexId[], expected: 'hoppip', label: 'Hoppip + Castform + Castform-sun → Hoppip' },
      { input: ['castform'] as PokedexId[], expected: 'castform', label: 'Castform sin temperatura relevante ni Hoppip → Castform' },
    ])('$label', ({ input, expected }) => {
      expect(pickMapPokemon(input)).toBe(expected)
    })
  })
})

describe('isSignificantPokemon', () => {
  // Estos dos tests son la red que impide que la frontera y `MAP_PRIORITY` se
  // separen: no comprueban una lista escrita a mano, sino que la respuesta se
  // derive siempre de la posición respecto a `hoppip`.
  it('coincide, Pokémon a Pokémon, con estar por delante de hoppip en MAP_PRIORITY', () => {
    for (const id of MAP_PRIORITY) {
      expect(isSignificantPokemon(id)).toBe(MAP_PRIORITY.indexOf(id) < MAP_PRIORITY.indexOf('hoppip'))
    }
  })

  it('MAP_PRIORITY cubre los 25 PokedexId, así que la frontera nunca cae fuera del array', () => {
    expect(new Set(MAP_PRIORITY)).toEqual(new Set(Object.keys(POKEMON_LABELS) as PokedexId[]))
    expect(MAP_PRIORITY).toHaveLength(25)
  })

  it('un id ausente de MAP_PRIORITY no es significativo por el -1 de indexOf', () => {
    // `thundurus` tiene sprite pero no es un `PokedexId` (DANA deshabilitada),
    // así que no está en el array: sirve para comprobar la guarda sin esperar
    // a que aparezca un Pokémon nuevo sin colocar.
    expect(isSignificantPokemon('thundurus' as unknown as PokedexId)).toBe(false)
  })

  it('las condiciones secundarias no son significativas: hoppip incluido', () => {
    for (const id of ['hoppip', 'castform', 'altaria', 'castform-sun'] as PokedexId[]) {
      expect(isSignificantPokemon(id)).toBe(false)
    }
  })

  it('los fenómenos y los tramos térmicos sí lo son', () => {
    for (const id of ['gyarados-mega', 'zapdos', 'cryogonal', 'castform-ice', 'kyogre', 'moltres', 'snorunt', 'groudon'] as PokedexId[]) {
      expect(isSignificantPokemon(id)).toBe(true)
    }
  })
})
