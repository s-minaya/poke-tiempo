import { describe, expect, it } from 'vitest'

import type { PokedexId } from '../pokedex.ts'
import { POKEMON_LABELS } from '../pokemon-labels.ts'
import { resolveDayMode } from './day-mode.ts'
import type { AlertFact, DayShapeFact, NarrativeFact, PokemonSpotlightFact } from './types.ts'

type AlertLevel = AlertFact['level']

function spotlight(pokemonId: PokedexId, locationCount: number): PokemonSpotlightFact {
  return {
    kind: 'pokemon_spotlight',
    pokemonId,
    label: POKEMON_LABELS[pokemonId],
    locations: [{ locationId: 'x', locationName: 'X', mapPokemonId: pokemonId }],
    locationCount,
  }
}

function dayShape(totalLocations: number): DayShapeFact {
  return { kind: 'day_shape', totalLocations, rainingLocations: 0, alertedLocations: 0, distinctPokemonCount: 1 }
}

function alert(level: AlertLevel, overrides: Partial<AlertFact> = {}): AlertFact {
  return {
    kind: 'alert',
    level,
    phenomenon: 'lluvia',
    sourcePhenomenon: 'Lluvias',
    officialZoneId: '774602',
    source: 'aemet',
    affectedLocations: [{ locationId: 'valencia', locationName: 'Valencia' }],
    affectedLocationCount: 1,
    ...overrides,
  }
}

// Día sin nada que destaque: un Pokémon ordinario repartido por medio mapa no
// llega a invasión (74 / 3 → 25) y no es significativo.
const QUIET: NarrativeFact[] = [dayShape(74), spotlight('castform', 20), spotlight('altaria', 10)]

describe('resolveDayMode', () => {
  describe('alerta', () => {
    it.each<AlertLevel>(['rojo', 'naranja'])('un aviso %s activa el modo y viaja como trigger', (level) => {
      const severe = alert(level)
      const decision = resolveDayMode([...QUIET, severe])

      expect(decision.mode).toBe('alerta')
      expect(decision.trigger).toBe(severe)
    })

    it('un aviso amarillo, solo, no activa el modo — sigue existiendo como hecho', () => {
      expect(resolveDayMode([...QUIET, alert('amarillo')])).toEqual({ mode: 'parte', trigger: null })
    })

    it('el amarillo no estorba ni puede ser el trigger: manda el naranja', () => {
      const severe = alert('naranja', { phenomenon: 'tormenta', sourcePhenomenon: 'Tormentas' })
      const decision = resolveDayMode([...QUIET, alert('amarillo'), severe])

      expect(decision.mode).toBe('alerta')
      expect(decision.trigger).toBe(severe)
    })

    it('el rojo manda sobre el naranja aunque llegue después', () => {
      const red = alert('rojo', { officialZoneId: '611001' })
      const decision = resolveDayMode([...QUIET, alert('naranja'), red, alert('naranja')])

      expect(decision.trigger).toBe(red)
    })

    it('entre avisos del mismo nivel decide el orden estable, sin jerarquía de fenómenos', () => {
      const first = alert('naranja', { phenomenon: 'lluvia', officialZoneId: '645301' })
      const second = alert('naranja', { phenomenon: 'tormenta', officialZoneId: '645404' })

      expect(resolveDayMode([...QUIET, first, second]).trigger).toBe(first)
      // Invertido: gana el que ahora llega primero, no un fenómeno concreto.
      expect(resolveDayMode([...QUIET, second, first]).trigger).toBe(second)
    })

    it('gana a invasion', () => {
      const severe = alert('naranja')
      const decision = resolveDayMode([dayShape(74), spotlight('castform', 40), severe])

      expect(decision.mode).toBe('alerta')
      expect(decision.trigger).toBe(severe)
    })

    it('gana a avistamiento', () => {
      const severe = alert('rojo')
      const decision = resolveDayMode([dayShape(74), spotlight('cryogonal', 1), severe])

      expect(decision.mode).toBe('alerta')
      expect(decision.trigger).toBe(severe)
    })
  })

  describe('invasion', () => {
    it('exactamente un tercio del mapa, redondeando hacia arriba, activa el modo', () => {
      // 74 / 3 = 24,67 → 25.
      const invader = spotlight('castform', 25)
      const decision = resolveDayMode([dayShape(74), invader])

      expect(decision.mode).toBe('invasion')
      expect(decision.trigger).toBe(invader)
    })

    it('un lugar por debajo del umbral no lo activa', () => {
      expect(resolveDayMode([dayShape(74), spotlight('castform', 24)])).toEqual({ mode: 'parte', trigger: null })
    })

    it('el umbral es una proporción, no 25: con otro tamaño de mapa se mueve', () => {
      expect(resolveDayMode([dayShape(30), spotlight('castform', 10)]).mode).toBe('invasion')
      expect(resolveDayMode([dayShape(30), spotlight('castform', 9)]).mode).toBe('parte')
      expect(resolveDayMode([dayShape(9), spotlight('castform', 3)]).mode).toBe('invasion')
    })

    it('el trigger es el más extendido cuando varios superan el umbral', () => {
      const biggest = spotlight('castform', 40)
      const decision = resolveDayMode([dayShape(74), spotlight('charmander', 26), biggest])

      expect(decision.trigger).toBe(biggest)
    })

    it('un empate de recuento lo rompe MAP_PRIORITY', () => {
      // castform-rain (7º) va por delante de charmander (17º).
      const rain = spotlight('castform-rain', 30)
      const decision = resolveDayMode([dayShape(74), spotlight('charmander', 30), rain])

      expect(decision.trigger).toBe(rain)
    })

    it('un Pokémon ordinario también invade: el modo va de cuántos, no de qué', () => {
      expect(resolveDayMode([dayShape(74), spotlight('castform-sun', 30)]).mode).toBe('invasion')
    })

    it('gana a avistamiento', () => {
      const invader = spotlight('castform', 30)
      const decision = resolveDayMode([dayShape(74), invader, spotlight('cryogonal', 1)])

      expect(decision.mode).toBe('invasion')
      expect(decision.trigger).toBe(invader)
    })

    it('sin day_shape no se inventa el total: el modo no se activa', () => {
      expect(resolveDayMode([spotlight('castform', 60)])).toEqual({ mode: 'parte', trigger: null })
    })
  })

  describe('avistamiento', () => {
    it.each([1, 2])('un Pokémon significativo en %i lugar(es) activa el modo y es el trigger', (locationCount) => {
      const rare = spotlight('cryogonal', locationCount)
      const decision = resolveDayMode([dayShape(74), spotlight('castform', 20), rare])

      expect(decision.mode).toBe('avistamiento')
      expect(decision.trigger).toBe(rare)
    })

    it('tres lugares ya no son un avistamiento', () => {
      expect(resolveDayMode([dayShape(74), spotlight('castform', 20), spotlight('cryogonal', 3)]).mode).toBe('parte')
    })

    const ordinaryCases: PokedexId[] = ['castform', 'altaria', 'castform-sun', 'hoppip']

    it.each(ordinaryCases)('un %s en un único lugar no es un avistamiento', (ordinary) => {
      expect(resolveDayMode([dayShape(74), spotlight('charmander', 20), spotlight(ordinary, 1)]).mode).toBe('parte')
    })

    it('con varios candidatos, el trigger es el menos visto', () => {
      const rarest = spotlight('cryogonal', 1)
      const decision = resolveDayMode([dayShape(74), spotlight('abomasnow', 2), rarest, spotlight('castform', 20)])

      expect(decision.mode).toBe('avistamiento')
      expect(decision.trigger).toBe(rarest)
    })

    it('un empate de recuento lo rompe MAP_PRIORITY', () => {
      // cryogonal (3º) va por delante de castform-ice (6º).
      const cryogonal = spotlight('cryogonal', 1)
      const decision = resolveDayMode([dayShape(74), spotlight('castform-ice', 1), cryogonal, spotlight('castform', 20)])

      expect(decision.trigger).toBe(cryogonal)
    })
  })

  describe('parte', () => {
    it('sin ninguna condición, es el respaldo y no arrastra hecho focal', () => {
      expect(resolveDayMode(QUIET)).toEqual({ mode: 'parte', trigger: null })
    })

    it('sin ningún hecho tampoco falla', () => {
      expect(resolveDayMode([])).toEqual({ mode: 'parte', trigger: null })
    })
  })

  it('prioridad completa: alerta > invasion > avistamiento > parte', () => {
    const invader = spotlight('castform', 30)
    const sighting = spotlight('cryogonal', 1)
    const severe = alert('naranja')
    const base = [dayShape(74)]

    expect(resolveDayMode([...base, invader, sighting, severe])).toEqual({ mode: 'alerta', trigger: severe })
    expect(resolveDayMode([...base, invader, sighting])).toEqual({ mode: 'invasion', trigger: invader })
    expect(resolveDayMode([...base, sighting, spotlight('castform', 5)])).toEqual({ mode: 'avistamiento', trigger: sighting })
    expect(resolveDayMode([...base, spotlight('castform', 5)])).toEqual({ mode: 'parte', trigger: null })
  })

  it('no reordena ni consume los hechos que recibe', () => {
    const facts = [...QUIET, alert('naranja')]
    const snapshot = [...facts]

    resolveDayMode(facts)

    expect(facts).toEqual(snapshot)
  })
})
