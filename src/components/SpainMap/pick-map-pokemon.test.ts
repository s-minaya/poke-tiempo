import { describe, expect, it } from 'vitest'

import type { PokedexId } from '../../domain/pokedex.ts'
import { pickMapPokemon } from './pick-map-pokemon.ts'

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
    { input: ['charmander', 'castform'], expected: 'castform', label: 'cielo por delante de temperatura' },
    { input: ['castform', 'hoppip'], expected: 'hoppip', label: 'viento por delante de cielo' },
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
})
