import { describe, expect, it } from 'vitest'

import type { PokedexId } from './pokedex.ts'
import { POKEMON_LABELS } from './pokemon-labels.ts'

const ALL_POKEDEX_IDS: PokedexId[] = [
  'snorunt',
  'solrock',
  'castform-sun',
  'charmander',
  'charmeleon',
  'magmar',
  'groudon',
  'groudon-primal',
  'altaria',
  'castform',
  'castform-rain',
  'kyogre',
  'kyogre-primal',
  'cryogonal',
  'abomasnow',
  'hoppip',
  'dragonite',
  'rayquaza',
  'tornadus',
  'hippowdon',
  'zapdos',
  'castform-ice',
  'gyarados',
  'gyarados-mega',
  'moltres',
]

describe('POKEMON_LABELS', () => {
  it('cubre los 25 PokedexId, ninguno vacío', () => {
    for (const id of ALL_POKEDEX_IDS) {
      expect(POKEMON_LABELS[id]).toBeTruthy()
    }
    expect(Object.keys(POKEMON_LABELS)).toHaveLength(25)
  })

  it('castform-sun no promete "soleado" — también se asigna por temperatura sola, puede tocar un día nublado', () => {
    expect(POKEMON_LABELS['castform-sun']).toBe('Templado')
    expect(POKEMON_LABELS['castform-sun'].toLowerCase()).not.toContain('sol')
  })
})
