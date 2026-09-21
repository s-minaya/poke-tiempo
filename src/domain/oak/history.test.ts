import { describe, expect, it } from 'vitest'

import type { PokedexId } from '../pokedex.ts'
import { POKEMON_LABELS } from '../pokemon-labels.ts'
import type { DayModeDecision } from './day-mode.ts'
import type { OakHistoryEntry } from './history.ts'
import { isFocusExhausted, recentHistory, resolveFocusSpotlight } from './history.ts'
import type { Protagonist, ProtagonistRole } from './protagonists.ts'
import type { AlertFact, PokemonSpotlightFact } from './types.ts'

const TODAY = '2026-09-18'

function spotlight(pokemonId: PokedexId, locationCount = 4): PokemonSpotlightFact {
  return {
    kind: 'pokemon_spotlight',
    pokemonId,
    label: POKEMON_LABELS[pokemonId],
    locations: [{ locationId: 'x', locationName: 'X', mapPokemonId: pokemonId }],
    locationCount,
  }
}

function protagonist(role: ProtagonistRole, pokemonId: PokedexId): Protagonist {
  return { role, spotlight: spotlight(pokemonId) }
}

function entry(date: string, focusPokemonId: PokedexId | null, leitmotifIds: OakHistoryEntry['leitmotifIds'] = []): OakHistoryEntry {
  return { date, focusPokemonId, leitmotifIds }
}

const ALERT: AlertFact = {
  kind: 'alert',
  level: 'naranja',
  phenomenon: 'lluvia',
  sourcePhenomenon: 'Lluvias',
  officialZoneId: '774602',
  source: 'aemet',
  affectedLocations: [{ locationId: 'valencia', locationName: 'Valencia' }],
  affectedLocationCount: 1,
}

describe('recentHistory', () => {
  it('la entrada de la fecha objetivo no cuenta como historial previo', () => {
    const history = [entry(TODAY, 'zapdos'), entry('2026-09-17', 'charmander')]

    expect(recentHistory(history, TODAY).map((item) => item.date)).toEqual(['2026-09-17'])
  })

  it('dos entradas del mismo día son un día, no dos', () => {
    const history = [entry('2026-09-17', 'zapdos'), entry('2026-09-17', 'charmander'), entry('2026-09-16', 'kyogre')]
    const recent = recentHistory(history, TODAY)

    expect(recent).toHaveLength(2)
    // De un día duplicado gana la última escritura.
    expect(recent[0]).toEqual(entry('2026-09-17', 'charmander'))
  })

  it('ordena del día más reciente al más antiguo, sin depender del orden de entrada', () => {
    const history = [entry('2026-09-15', 'kyogre'), entry('2026-09-17', 'zapdos'), entry('2026-09-16', 'charmander')]

    expect(recentHistory(history, TODAY).map((item) => item.date)).toEqual(['2026-09-17', '2026-09-16', '2026-09-15'])
  })

  it('historial vacío no es un error', () => {
    expect(recentHistory([], TODAY)).toEqual([])
  })
})

describe('isFocusExhausted', () => {
  const threeDays = [entry('2026-09-17', 'zapdos'), entry('2026-09-16', 'zapdos'), entry('2026-09-15', 'zapdos')]

  it('tres días distintos con el mismo foco lo agotan', () => {
    expect(isFocusExhausted(threeDays, 'zapdos')).toBe(true)
  })

  it('dos días todavía no', () => {
    expect(isFocusExhausted(threeDays.slice(0, 2), 'zapdos')).toBe(false)
  })

  it('una racha interrumpida tampoco', () => {
    const broken = [entry('2026-09-17', 'zapdos'), entry('2026-09-16', 'charmander'), entry('2026-09-15', 'zapdos')]

    expect(isFocusExhausted(broken, 'zapdos')).toBe(false)
  })

  it('tres entradas del mismo día repetido no son tres días', () => {
    const duplicated = [entry('2026-09-17', 'zapdos'), entry('2026-09-17', 'zapdos'), entry('2026-09-17', 'zapdos')]

    expect(isFocusExhausted(recentHistory(duplicated, TODAY), 'zapdos')).toBe(false)
  })
})

describe('resolveFocusSpotlight', () => {
  const protagonists = [protagonist('headline', 'zapdos'), protagonist('spread', 'charmander'), protagonist('rarity', 'cryogonal')]
  const exhausted = [entry('2026-09-17', 'zapdos'), entry('2026-09-16', 'zapdos'), entry('2026-09-15', 'zapdos')]

  it('invasion: el trigger es el foco y el historial no lo desplaza', () => {
    const trigger = spotlight('castform', 30)
    const decision: DayModeDecision = { mode: 'invasion', trigger }
    const history = [entry('2026-09-17', 'castform'), entry('2026-09-16', 'castform'), entry('2026-09-15', 'castform')]

    expect(resolveFocusSpotlight(decision, protagonists, history)).toBe(trigger)
  })

  it('avistamiento: el trigger es el foco y el historial no lo desplaza', () => {
    const trigger = spotlight('cryogonal', 1)
    const decision: DayModeDecision = { mode: 'avistamiento', trigger }
    const history = [entry('2026-09-17', 'cryogonal'), entry('2026-09-16', 'cryogonal'), entry('2026-09-15', 'cryogonal')]

    expect(resolveFocusSpotlight(decision, protagonists, history)).toBe(trigger)
  })

  it('alerta: el centro es el aviso, no hay Pokémon de foco por esta vía', () => {
    expect(resolveFocusSpotlight({ mode: 'alerta', trigger: ALERT }, protagonists, [])).toBeNull()
  })

  it('parte: headline por defecto', () => {
    const focus = resolveFocusSpotlight({ mode: 'parte', trigger: null }, protagonists, [])

    expect(focus?.pokemonId).toBe('zapdos')
  })

  it('parte: dos días con el mismo foco todavía no lo cambian', () => {
    const focus = resolveFocusSpotlight({ mode: 'parte', trigger: null }, protagonists, exhausted.slice(0, 2))

    expect(focus?.pokemonId).toBe('zapdos')
  })

  it('parte: tres días distintos con el mismo foco ceden el turno a spread', () => {
    const focus = resolveFocusSpotlight({ mode: 'parte', trigger: null }, protagonists, exhausted)

    expect(focus?.pokemonId).toBe('charmander')
  })

  it('parte: si spread también está agotado, pasa a rarity', () => {
    const bothExhausted = [
      entry('2026-09-17', 'zapdos'),
      entry('2026-09-16', 'zapdos'),
      entry('2026-09-15', 'zapdos'),
    ]
    // headline agotado y, además, spread agotado en los mismos tres días.
    const spreadExhausted = [protagonist('headline', 'charmander'), protagonist('spread', 'charmander'), protagonist('rarity', 'cryogonal')]
    const history = [entry('2026-09-17', 'charmander'), entry('2026-09-16', 'charmander'), entry('2026-09-15', 'charmander')]

    expect(resolveFocusSpotlight({ mode: 'parte', trigger: null }, spreadExhausted, history)?.pokemonId).toBe('cryogonal')
    expect(resolveFocusSpotlight({ mode: 'parte', trigger: null }, protagonists, bothExhausted)?.pokemonId).toBe('charmander')
  })

  it('parte: sin alternativa, se repite sin problema', () => {
    const alone = [protagonist('headline', 'zapdos')]

    expect(resolveFocusSpotlight({ mode: 'parte', trigger: null }, alone, exhausted)?.pokemonId).toBe('zapdos')
  })

  it('parte: sin protagonistas, no hay foco', () => {
    expect(resolveFocusSpotlight({ mode: 'parte', trigger: null }, [], [])).toBeNull()
  })

  it('no toca la lista de protagonistas', () => {
    const snapshot = [...protagonists]
    resolveFocusSpotlight({ mode: 'parte', trigger: null }, protagonists, exhausted)

    expect(protagonists).toEqual(snapshot)
  })
})
