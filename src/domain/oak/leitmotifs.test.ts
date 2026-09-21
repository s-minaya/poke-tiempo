import { describe, expect, it } from 'vitest'

import type { PokedexId } from '../pokedex.ts'
import { POKEMON_LABELS } from '../pokemon-labels.ts'
import type { OakHistoryEntry } from './history.ts'
import { recentHistory } from './history.ts'
import type { LeitmotifId } from './leitmotifs.ts'
import { LEITMOTIFS, eligibleLeitmotifs, selectLeitmotif } from './leitmotifs.ts'
import type { NarrativeFact, PokemonSpotlightFact } from './types.ts'

const TODAY = '2026-09-18'

function spotlight(pokemonId: PokedexId): PokemonSpotlightFact {
  return {
    kind: 'pokemon_spotlight',
    pokemonId,
    label: POKEMON_LABELS[pokemonId],
    locations: [{ locationId: 'x', locationName: 'X', mapPokemonId: pokemonId }],
    locationCount: 3,
  }
}

function entry(date: string, leitmotifIds: LeitmotifId[]): OakHistoryEntry {
  return { date, focusPokemonId: null, leitmotifIds }
}

function idsOf(facts: NarrativeFact[], recent: OakHistoryEntry[] = [], date = TODAY): LeitmotifId[] {
  return eligibleLeitmotifs(facts, recent, date).map((leitmotif) => leitmotif.id)
}

describe('catálogo de leitmotivs', () => {
  it('son exactamente los cinco acordados, con el mismo cooldown', () => {
    expect(LEITMOTIFS.map((leitmotif) => leitmotif.id)).toEqual([
      'hoppip-vuela',
      'castform-vestuario',
      'groudon-termostato',
      'gyarados-mar',
      'snorunt-frio',
    ])
    expect(LEITMOTIFS.every((leitmotif) => leitmotif.cooldownDays === 5)).toBe(true)
  })

  it('solo usa PokedexId que existen de verdad en el contrato', () => {
    for (const leitmotif of LEITMOTIFS) {
      expect(leitmotif.pokemonIds.length).toBeGreaterThan(0)
      for (const id of leitmotif.pokemonIds) {
        expect(POKEMON_LABELS[id]).toBeTruthy()
      }
    }
  })
})

describe('eligibleLeitmotifs', () => {
  const eligibilityCases: { id: LeitmotifId; triggers: PokedexId[] }[] = [
    { id: 'hoppip-vuela', triggers: ['hoppip'] },
    { id: 'castform-vestuario', triggers: ['castform', 'castform-sun', 'castform-rain', 'castform-ice'] },
    { id: 'groudon-termostato', triggers: ['groudon', 'groudon-primal'] },
    { id: 'gyarados-mar', triggers: ['gyarados', 'gyarados-mega'] },
    { id: 'snorunt-frio', triggers: ['snorunt'] },
  ]

  it.each(eligibilityCases)('$id es elegible con su Pokémon y con ningún otro', ({ id, triggers }) => {
    for (const pokemonId of triggers) {
      expect(idsOf([spotlight(pokemonId)])).toEqual([id])
    }
    // Un Pokémon ajeno a los cinco catálogos no activa ninguno.
    expect(idsOf([spotlight('zapdos')])).toEqual([])
  })

  it('sin ningún spotlight no hay candidatos', () => {
    expect(idsOf([])).toEqual([])
  })

  it('un leitmotiv usado dentro de su cooldown queda bloqueado', () => {
    const recent = [entry('2026-09-17', ['snorunt-frio']), entry('2026-09-16', []), entry('2026-09-15', [])]

    expect(idsOf([spotlight('snorunt')], recent)).toEqual([])
  })

  // El cooldown son días de calendario: usado el 12, bloqueado del 13 al 17,
  // libre el 18.
  const calendarCases: { used: string; date: string; blocked: boolean }[] = [
    { used: '2026-09-17', date: TODAY, blocked: true },
    { used: '2026-09-14', date: TODAY, blocked: true },
    { used: '2026-09-13', date: TODAY, blocked: true },
    { used: '2026-09-12', date: TODAY, blocked: false },
    { used: '2026-09-11', date: TODAY, blocked: false },
  ]

  it.each(calendarCases)('usado el $used, el $date está bloqueado: $blocked', ({ used, date, blocked }) => {
    const recent = [entry(used, ['snorunt-frio'])]

    expect(idsOf([spotlight('snorunt')], recent, date)).toEqual(blocked ? [] : ['snorunt-frio'])
  })

  it('un hueco de runs no alarga el cooldown: cuentan los días, no las ejecuciones', () => {
    // Una única entrada, hace seis días naturales, y ni rastro de los cinco
    // días intermedios. Contando ejecuciones seguiría dentro del cooldown;
    // contando calendario ya está libre.
    const withGap = [entry('2026-09-12', ['snorunt-frio'])]

    expect(idsOf([spotlight('snorunt')], withGap)).toEqual(['snorunt-frio'])
  })

  it('un hueco tampoco lo acorta: dos días naturales siguen bloqueando aunque sea la única entrada', () => {
    const withGap = [entry('2026-09-16', ['snorunt-frio'])]

    expect(idsOf([spotlight('snorunt')], withGap)).toEqual([])
  })

  it('cruza el cambio de mes sin contar mal los días', () => {
    const recent = [entry('2026-08-30', ['snorunt-frio'])]

    expect(idsOf([spotlight('snorunt')], recent, '2026-09-04')).toEqual([])
    expect(idsOf([spotlight('snorunt')], recent, '2026-09-05')).toEqual(['snorunt-frio'])
  })

  it('una entrada duplicada del mismo día se comporta igual que una sola', () => {
    const duplicated = [entry('2026-09-17', ['snorunt-frio']), entry('2026-09-17', ['snorunt-frio'])]

    expect(idsOf([spotlight('snorunt')], recentHistory(duplicated, TODAY))).toEqual(
      idsOf([spotlight('snorunt')], [entry('2026-09-17', ['snorunt-frio'])]),
    )
  })
})

describe('selectLeitmotif', () => {
  const crowded = [spotlight('hoppip'), spotlight('castform'), spotlight('snorunt'), spotlight('gyarados')]

  it('como mucho uno al día', () => {
    const chosen = selectLeitmotif(crowded, [], TODAY)

    expect(chosen).not.toBeNull()
    expect(idsOf(crowded).length).toBeGreaterThan(1)
  })

  it('siempre elige entre los elegibles del día', () => {
    expect(idsOf(crowded)).toContain(selectLeitmotif(crowded, [], TODAY))
  })

  it('mismo input, mismo resultado', () => {
    const first = selectLeitmotif(crowded, [], TODAY)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(selectLeitmotif(crowded, [], TODAY)).toBe(first)
    }
  })

  it('no depende del orden en que lleguen los hechos', () => {
    expect(selectLeitmotif([...crowded].reverse(), [], TODAY)).toBe(selectLeitmotif(crowded, [], TODAY))
  })

  it('fechas distintas pueden repartir gags distintos', () => {
    const chosen = new Set(
      ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'].map((date) =>
        selectLeitmotif(crowded, [], date),
      ),
    )

    expect(chosen.size).toBeGreaterThan(1)
  })

  it('ninguno elegible → null, sin forzar un gag', () => {
    expect(selectLeitmotif([spotlight('zapdos')], [], TODAY)).toBeNull()
    expect(selectLeitmotif([], [], TODAY)).toBeNull()
  })

  it('el cooldown también se respeta al elegir, no solo al listar', () => {
    const recent = [entry('2026-09-17', ['hoppip-vuela', 'castform-vestuario', 'gyarados-mar'])]
    const chosen = selectLeitmotif(crowded, recent, TODAY)

    expect(chosen).toBe('snorunt-frio')
  })
})
