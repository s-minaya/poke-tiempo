import { describe, expect, it } from 'vitest'

import type { PokedexId } from '../../domain/pokedex.ts'
import { LEGEND_METADATA } from './legend-metadata.ts'

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

describe('LEGEND_METADATA', () => {
  it('cubre los 25 PokedexId, ninguno vacío', () => {
    for (const id of ALL_POKEDEX_IDS) {
      expect(LEGEND_METADATA[id]).toBeTruthy()
    }
    expect(Object.keys(LEGEND_METADATA)).toHaveLength(25)
  })

  it('castform-sun no promete "soleado" — también se asigna por temperatura sola, puede tocar un día nublado', () => {
    expect(LEGEND_METADATA['castform-sun']).toBe('Templado')
    expect(LEGEND_METADATA['castform-sun'].toLowerCase()).not.toContain('sol')
  })
})
