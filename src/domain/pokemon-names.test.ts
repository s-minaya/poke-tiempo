import { describe, expect, it } from 'vitest'

import type { PokedexId } from './pokedex.ts'
import { POKEMON_LABELS } from './pokemon-labels.ts'
import { POKEMON_NAMES } from './pokemon-names.ts'

const CASTFORM_IDS: PokedexId[] = ['castform', 'castform-sun', 'castform-rain', 'castform-ice']

describe('POKEMON_NAMES', () => {
  it('cubre los 25 PokedexId, ninguno vacío', () => {
    expect(Object.keys(POKEMON_NAMES)).toHaveLength(25)
    for (const name of Object.values(POKEMON_NAMES)) {
      expect(name).toBeTruthy()
    }
  })

  it('exactamente los mismos ids que las etiquetas: las dos tablas no pueden desincronizarse en silencio', () => {
    expect(Object.keys(POKEMON_NAMES).sort()).toEqual(Object.keys(POKEMON_LABELS).sort())
  })

  it('ningún nombre es el id crudo', () => {
    for (const [id, name] of Object.entries(POKEMON_NAMES)) {
      expect(name).not.toBe(id)
      // Nada de `castform-ice`: tras un guion va mayúscula ("Mega-Gyarados"), nunca un sufijo de id.
      expect(name).not.toMatch(/-[a-z]/)
      expect(name).toMatch(/^[A-ZÁÉÍÓÚÑ]/)
    }
  })

  it('las cuatro formas de Castform comparten nombre: quien desambigua es la etiqueta', () => {
    for (const id of CASTFORM_IDS) {
      expect(POKEMON_NAMES[id]).toBe('Castform')
    }
    expect(new Set(CASTFORM_IDS.map((id) => POKEMON_LABELS[id])).size).toBe(CASTFORM_IDS.length)
  })

  it('las formas con nombre propio usan la grafía oficial en español', () => {
    expect(POKEMON_NAMES['gyarados-mega']).toBe('Mega-Gyarados')
    expect(POKEMON_NAMES['groudon-primal']).toBe('Groudon Primigenio')
    expect(POKEMON_NAMES['kyogre-primal']).toBe('Kyogre Primigenio')
  })

  it('no es la tabla de etiquetas con otro nombre: nombre y fenómeno son ejes distintos', () => {
    expect(POKEMON_NAMES['castform-ice']).toBe('Castform')
    expect(POKEMON_LABELS['castform-ice']).toBe('Niebla')
  })
})
