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
    {
      input: ['charmander', 'castform'],
      expected: 'charmander',
      label: 'temperatura relevante por delante de cielo nuboso/cubierto (criterio editorial Hoppip/viento moderado, 003-plan.md)',
    },
    { input: ['castform', 'hoppip'], expected: 'hoppip', label: 'viento por delante de cielo' },
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

  // Hipótesis provisional (005, tras la primera comparación con publicaciones
  // reales): la temperatura gana a "poco nuboso" — ver Decisiones en
  // 003-plan.md.
  describe('temperatura por delante de altaria (poco nuboso) — hipótesis provisional', () => {
    it.each([
      { input: ['magmar', 'altaria'] as PokedexId[], expected: 'magmar', label: 'Magmar + Altaria → Magmar' },
      { input: ['charmeleon', 'altaria'] as PokedexId[], expected: 'charmeleon', label: 'Charmeleon + Altaria → Charmeleon' },
      { input: ['snorunt', 'altaria'] as PokedexId[], expected: 'snorunt', label: 'Snorunt + Altaria → Snorunt' },
      { input: ['castform-sun', 'altaria'] as PokedexId[], expected: 'altaria', label: 'Castform-sun + Altaria → Altaria (altaria sigue por delante de castform-sun)' },
      { input: ['magmar', 'castform'] as PokedexId[], expected: 'magmar', label: 'Castform nuboso/cubierto + Magmar → Magmar (criterio editorial Hoppip/viento moderado, ver describe de abajo)' },
    ])('$label', ({ input, expected }) => {
      expect(pickMapPokemon(input)).toBe(expected)
    })
  })

  // Criterio editorial propio de PokéTiempo (003-plan.md → "Prioridad de
  // Hoppip / viento moderado") — no reproduce la regla exacta de Gabriel.
  // Hoppip sigue significando "viento moderado" (assignByWind sin tocar);
  // lo que cambia es solo su prioridad en pickMapPokemon: pierde frente a
  // temperatura relevante y frente a viento fuerte/extremo, pero sigue
  // ganando a las representaciones ordinarias/neutrales (castform,
  // altaria, castform-sun).
  describe('Hoppip / viento moderado como condición secundaria — criterio editorial', () => {
    it.each([
      { input: ['hoppip', 'magmar'] as PokedexId[], expected: 'magmar', label: 'Hoppip + Magmar → Magmar' },
      { input: ['hoppip', 'charmeleon'] as PokedexId[], expected: 'charmeleon', label: 'Hoppip + Charmeleon → Charmeleon' },
      { input: ['hoppip', 'charmander'] as PokedexId[], expected: 'charmander', label: 'Hoppip + Charmander → Charmander' },
      { input: ['hoppip', 'solrock'] as PokedexId[], expected: 'solrock', label: 'Hoppip + Solrock → Solrock' },
      { input: ['hoppip', 'snorunt'] as PokedexId[], expected: 'snorunt', label: 'Hoppip + Snorunt → Snorunt' },
      { input: ['hoppip', 'castform-sun'] as PokedexId[], expected: 'hoppip', label: 'Hoppip + Castform-sun → Hoppip' },
      { input: ['hoppip', 'altaria'] as PokedexId[], expected: 'hoppip', label: 'Hoppip + Altaria → Hoppip' },
      { input: ['hoppip', 'castform'] as PokedexId[], expected: 'hoppip', label: 'Hoppip + Castform normal → Hoppip' },
      { input: ['hoppip', 'zapdos'] as PokedexId[], expected: 'zapdos', label: 'Hoppip + Zapdos → Zapdos' },
      { input: ['hoppip', 'gyarados'] as PokedexId[], expected: 'gyarados', label: 'Hoppip + Gyarados → Gyarados' },
      { input: ['hoppip', 'dragonite'] as PokedexId[], expected: 'dragonite', label: 'Hoppip + Dragonite → Dragonite' },
      { input: ['magmar', 'castform'] as PokedexId[], expected: 'magmar', label: 'Magmar + Castform → Magmar' },
      { input: ['magmar', 'hoppip', 'castform'] as PokedexId[], expected: 'magmar', label: 'Magmar + Hoppip + Castform → Magmar' },
      { input: ['hoppip', 'castform', 'castform-sun'] as PokedexId[], expected: 'hoppip', label: 'Hoppip + Castform + Castform-sun → Hoppip' },
      { input: ['castform'] as PokedexId[], expected: 'castform', label: 'Castform sin temperatura relevante ni Hoppip → Castform' },
    ])('$label', ({ input, expected }) => {
      expect(pickMapPokemon(input)).toBe(expected)
    })
  })
})
