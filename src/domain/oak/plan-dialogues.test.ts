import { describe, expect, it } from 'vitest'

import type { PokedexId } from '../pokedex.ts'
import { POKEMON_LABELS } from '../pokemon-labels.ts'
import type { OakHistoryEntry } from './history.ts'
import type { LeitmotifId } from './leitmotifs.ts'
import type { DayPlanInput } from './plan-dialogues.ts'
import { planDialogues } from './plan-dialogues.ts'
import type { Protagonist, ProtagonistRole } from './protagonists.ts'
import type {
  AlertFact,
  CalendarFact,
  DayShapeFact,
  NarrativeFact,
  PokemonSpotlightFact,
  RainFact,
  TemperatureFact,
} from './types.ts'

const TODAY = '2026-09-18' // viernes

function spotlight(pokemonId: PokedexId, locationCount = 4): PokemonSpotlightFact {
  return {
    kind: 'pokemon_spotlight',
    pokemonId,
    label: POKEMON_LABELS[pokemonId],
    locations: [{ locationId: `${pokemonId}-place`, locationName: 'Lugar', mapPokemonId: pokemonId }],
    locationCount,
  }
}

function protagonist(role: ProtagonistRole, spotlightFact: PokemonSpotlightFact): Protagonist {
  return { role, spotlight: spotlightFact }
}

const calendar: CalendarFact = { kind: 'calendar', date: TODAY, weekday: 'viernes', weekend: false }
const weekendCalendar: CalendarFact = { kind: 'calendar', date: '2026-09-19', weekday: 'sabado', weekend: true }
const dayShape: DayShapeFact = { kind: 'day_shape', totalLocations: 74, rainingLocations: 12, alertedLocations: 2, distinctPokemonCount: 6 }

function temperature(locationId: string, mapPokemonId: PokedexId, mapRepresentsFact = true): TemperatureFact {
  return {
    kind: 'temperature',
    locationId,
    locationName: locationId,
    mapPokemonId,
    mapRepresentsFact,
    role: 'hottest',
    maxC: 33,
    minC: 18,
  }
}

function rain(locationId: string, mapPokemonId: PokedexId, mapRepresentsFact = true): RainFact {
  return {
    kind: 'rain',
    locationId,
    locationName: locationId,
    mapPokemonId,
    mapRepresentsFact,
    mm: 7.6,
    probabilityPercent: 100,
  }
}

function alert(level: AlertFact['level'], overrides: Partial<AlertFact> = {}): AlertFact {
  return {
    kind: 'alert',
    level,
    phenomenon: 'lluvia',
    sourcePhenomenon: 'Lluvias',
    officialZoneId: '774602',
    source: 'aemet',
    affectedLocations: [{ locationId: 'ibiza', locationName: 'Ibiza' }],
    affectedLocationCount: 1,
    ...overrides,
  }
}

function entry(date: string, focusPokemonId: PokedexId | null, leitmotifIds: LeitmotifId[] = []): OakHistoryEntry {
  return { date, focusPokemonId, leitmotifIds }
}

/** Día normal: tres protagonistas, algo de lluvia y un extremo térmico. */
function ordinaryDay(overrides: Partial<DayPlanInput> = {}): DayPlanInput {
  const headline = spotlight('zapdos', 3)
  const spread = spotlight('charmander', 21)
  const rarity = spotlight('cryogonal', 2)

  return {
    date: TODAY,
    facts: [calendar, dayShape, headline, spread, rarity, temperature('sevilla', 'charmander'), rain('ibiza', 'zapdos', false)],
    protagonists: [protagonist('headline', headline), protagonist('spread', spread), protagonist('rarity', rarity)],
    decision: { mode: 'parte', trigger: null },
    history: [],
    ...overrides,
  }
}

function allFacts(plan: ReturnType<typeof planDialogues>): NarrativeFact[] {
  return plan.dialoguePlan.flatMap((slot) => slot.facts)
}

describe('planDialogues — forma del plan', () => {
  it('siempre exactamente tres slots, con sus ids y roles en orden', () => {
    const { dialoguePlan } = planDialogues(ordinaryDay())

    expect(dialoguePlan).toHaveLength(3)
    expect(dialoguePlan.map((slot) => slot.id)).toEqual(['dialogue-1', 'dialogue-2', 'dialogue-3'])
    expect(dialoguePlan.map((slot) => slot.role)).toEqual(['apertura', 'foco', 'cierre'])
  })

  it('ningún slot vacío y ninguno con más de dos hechos', () => {
    for (const slot of planDialogues(ordinaryDay()).dialoguePlan) {
      expect(slot.facts.length).toBeGreaterThanOrEqual(1)
      expect(slot.facts.length).toBeLessThanOrEqual(2)
    }
  })

  it('ningún objeto NarrativeFact aparece en dos slots', () => {
    const facts = allFacts(planDialogues(ordinaryDay()))

    expect(new Set(facts).size).toBe(facts.length)
  })

  it('mismo input, mismo plan', () => {
    const input = ordinaryDay()
    const first = planDialogues(input)

    expect(planDialogues(input)).toEqual(first)
  })

  it('un día mínimo sigue produciendo tres slots', () => {
    const only = spotlight('castform', 74)
    const plan = planDialogues({
      date: TODAY,
      facts: [calendar, dayShape, only, temperature('madrid', 'castform')],
      protagonists: [protagonist('headline', only)],
      decision: { mode: 'parte', trigger: null },
      history: [],
    })

    expect(plan.dialoguePlan.every((slot) => slot.facts.length >= 1)).toBe(true)
    expect(new Set(allFacts(plan)).size).toBe(allFacts(plan).length)
  })

  it('sin hechos suficientes falla de forma visible, no en silencio', () => {
    expect(() =>
      planDialogues({ date: TODAY, facts: [calendar], protagonists: [], decision: { mode: 'parte', trigger: null }, history: [] }),
    ).toThrow(/Oak no puede/)
  })
})

describe('planDialogues — apertura', () => {
  it('sitúa el día con DayShapeFact y no gasta el hecho focal', () => {
    const input = ordinaryDay()
    const [opening] = planDialogues(input).dialoguePlan

    expect(opening.facts).toEqual([dayShape])
    // Neutral siempre: DayShapeFact existe casi a diario y el registro
    // científico se reserva a otros slots.
    expect(opening.tone).toBe('neutral')
    expect(opening.leitmotif).toBeNull()
  })

  it('en fin de semana el calendario acompaña', () => {
    const input = ordinaryDay({ date: '2026-09-19', facts: [weekendCalendar, dayShape, ...ordinaryDay().facts.slice(2)] })
    const [opening] = planDialogues(input).dialoguePlan

    expect(opening.facts).toEqual([dayShape, weekendCalendar])
  })

  it('entre semana no menciona el día: la apertura no es un formulario', () => {
    const [opening] = planDialogues(ordinaryDay()).dialoguePlan

    expect(opening.facts).not.toContain(calendar)
  })
})

describe('planDialogues — foco', () => {
  it('alerta: el AlertFact exacto del trigger va en el foco', () => {
    const trigger = alert('naranja')
    const input = ordinaryDay({ decision: { mode: 'alerta', trigger }, facts: [...ordinaryDay().facts, trigger] })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts[0]).toBe(trigger)
    expect(focus.tone).toBe('consejo')
  })

  it('alerta: un aviso rojo sí se cuenta en épico, un naranja no se dramatiza', () => {
    const red = alert('rojo')
    const input = ordinaryDay({ decision: { mode: 'alerta', trigger: red }, facts: [...ordinaryDay().facts, red] })

    expect(planDialogues(input).dialoguePlan[1].tone).toBe('epico')
  })

  it('alerta: añade el hecho del mismo fenómeno y lugar cuando la correspondencia es explícita', () => {
    const trigger = alert('naranja')
    const companion = rain('ibiza', 'castform-rain')
    const input = ordinaryDay({ decision: { mode: 'alerta', trigger }, facts: [calendar, dayShape, spotlight('zapdos'), trigger, companion] })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts).toEqual([trigger, companion])
  })

  it('alerta: no arrastra un hecho de otro lugar aunque sea del mismo fenómeno', () => {
    const trigger = alert('naranja')
    const elsewhere = rain('madrid', 'castform-rain')
    const input = ordinaryDay({ decision: { mode: 'alerta', trigger }, facts: [calendar, dayShape, spotlight('zapdos'), trigger, elsewhere] })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts).toEqual([trigger])
  })

  it('alerta: no arrastra un hecho de otro fenómeno aunque sea del mismo lugar', () => {
    const trigger = alert('naranja', { phenomenon: 'viento', sourcePhenomenon: 'Vientos' })
    const sameLocation = rain('ibiza', 'castform-rain')
    const input = ordinaryDay({ decision: { mode: 'alerta', trigger }, facts: [calendar, dayShape, spotlight('zapdos'), trigger, sameLocation] })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts).toEqual([trigger])
  })

  it('invasion: el spotlight exacto del trigger va en el foco, en épico', () => {
    const trigger = spotlight('castform', 30)
    const input = ordinaryDay({
      decision: { mode: 'invasion', trigger },
      facts: [calendar, dayShape, trigger, spotlight('zapdos', 2), temperature('madrid', 'castform')],
      protagonists: [protagonist('headline', spotlight('zapdos', 2))],
    })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts[0]).toBe(trigger)
    expect(focus.tone).toBe('epico')
  })

  it('avistamiento: el spotlight exacto del trigger va en el foco, en científico', () => {
    const trigger = spotlight('cryogonal', 1)
    const input = ordinaryDay({
      decision: { mode: 'avistamiento', trigger },
      facts: [calendar, dayShape, trigger, spotlight('charmander', 20), temperature('madrid', 'charmander')],
      protagonists: [protagonist('headline', spotlight('charmander', 20))],
    })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts[0]).toBe(trigger)
    expect(focus.tone).toBe('cientifico')
  })

  it('parte: headline por defecto, en neutral', () => {
    const input = ordinaryDay()
    const [, focus] = planDialogues(input).dialoguePlan

    expect((focus.facts[0] as PokemonSpotlightFact).pokemonId).toBe('zapdos')
    expect(focus.tone).toBe('neutral')
  })

  it('parte: tras tres días distintos con el mismo foco, usa la alternativa', () => {
    const history = [entry('2026-09-17', 'zapdos'), entry('2026-09-16', 'zapdos'), entry('2026-09-15', 'zapdos')]
    const plan = planDialogues(ordinaryDay({ history }))

    expect((plan.dialoguePlan[1].facts[0] as PokemonSpotlightFact).pokemonId).toBe('charmander')
    expect(plan.focusPokemonId).toBe('charmander')
  })

  it('parte: dos días todavía no cambian el foco', () => {
    const history = [entry('2026-09-17', 'zapdos'), entry('2026-09-16', 'zapdos')]

    expect(planDialogues(ordinaryDay({ history })).focusPokemonId).toBe('zapdos')
  })

  it('la lista de protagonistas no se modifica al elegir foco', () => {
    const input = ordinaryDay({ history: [entry('2026-09-17', 'zapdos'), entry('2026-09-16', 'zapdos'), entry('2026-09-15', 'zapdos')] })
    const snapshot = [...input.protagonists]

    planDialogues(input)

    expect(input.protagonists).toEqual(snapshot)
  })
})

describe('planDialogues — cierre', () => {
  it('usa un hecho distinto, todavía sin consumir', () => {
    const plan = planDialogues(ordinaryDay())
    const [opening, focus, closing] = plan.dialoguePlan

    expect(closing.facts).toHaveLength(1)
    expect([...opening.facts, ...focus.facts]).not.toContain(closing.facts[0])
  })

  it('prefiere otro protagonista sin usar', () => {
    const [, , closing] = planDialogues(ordinaryDay()).dialoguePlan

    expect(closing.facts[0].kind).toBe('pokemon_spotlight')
  })

  it('el leitmotiv va en el cierre, nunca en apertura ni foco', () => {
    const snorunt = spotlight('snorunt', 2)
    const input = ordinaryDay({
      facts: [calendar, dayShape, spotlight('zapdos', 3), snorunt, temperature('madrid', 'snorunt')],
      protagonists: [protagonist('headline', spotlight('zapdos', 3)), protagonist('rarity', snorunt)],
    })
    const [opening, focus, closing] = planDialogues(input).dialoguePlan

    expect(closing.leitmotif).toBe('snorunt-frio')
    expect(opening.leitmotif).toBeNull()
    expect(focus.leitmotif).toBeNull()
  })

  it('un cierre con leitmotiv sigue llevando un hecho real', () => {
    const snorunt = spotlight('snorunt', 2)
    const input = ordinaryDay({
      facts: [calendar, dayShape, spotlight('zapdos', 3), snorunt, temperature('madrid', 'snorunt')],
      protagonists: [protagonist('headline', spotlight('zapdos', 3)), protagonist('rarity', snorunt)],
    })
    const [, , closing] = planDialogues(input).dialoguePlan

    expect(closing.facts).toHaveLength(1)
    expect(closing.tone).toBe('guasa')
  })

  it('sin leitmotiv, un hecho accionable se cierra con consejo', () => {
    const input = ordinaryDay({
      facts: [calendar, dayShape, spotlight('zapdos', 3), rain('ibiza', 'castform-rain')],
      protagonists: [protagonist('headline', spotlight('zapdos', 3))],
    })
    const [, , closing] = planDialogues(input).dialoguePlan

    expect(closing.facts[0].kind).toBe('rain')
    expect(closing.tone).toBe('consejo')
  })

  it('sin leitmotiv ni hecho accionable, cierra en neutral', () => {
    const input = ordinaryDay({
      facts: [calendar, dayShape, spotlight('zapdos', 3), temperature('sevilla', 'charmander')],
      protagonists: [protagonist('headline', spotlight('zapdos', 3))],
    })
    const [, , closing] = planDialogues(input).dialoguePlan

    expect(closing.facts[0].kind).toBe('temperature')
    expect(closing.tone).toBe('neutral')
  })
})

describe('planDialogues — entrada de historial', () => {
  it('registra el foco y el leitmotiv del día, sin texto', () => {
    const plan = planDialogues(ordinaryDay())

    expect(Object.keys(plan.historyEntry).sort()).toEqual(['date', 'focusPokemonId', 'leitmotifIds'])
    expect(plan.historyEntry.date).toBe(TODAY)
    expect(plan.historyEntry.focusPokemonId).toBe('zapdos')
  })

  it('en invasion y avistamiento el foco histórico es el Pokémon del trigger', () => {
    const invader = spotlight('castform', 30)
    const invasion = planDialogues(
      ordinaryDay({
        decision: { mode: 'invasion', trigger: invader },
        facts: [calendar, dayShape, invader, spotlight('zapdos', 2), temperature('madrid', 'castform')],
        protagonists: [protagonist('headline', spotlight('zapdos', 2))],
      }),
    )

    expect(invasion.historyEntry.focusPokemonId).toBe('castform')
  })

  it('en alerta sin Pokémon acompañante, el foco histórico es null', () => {
    const trigger = alert('naranja', { phenomenon: 'deshielo', sourcePhenomenon: 'Deshielo' })
    const plan = planDialogues(ordinaryDay({ decision: { mode: 'alerta', trigger }, facts: [...ordinaryDay().facts, trigger] }))

    expect(plan.historyEntry.focusPokemonId).toBeNull()
  })

  it('en alerta, el hecho acompañante no convierte a su Pokémon en foco del día', () => {
    const trigger = alert('naranja')
    const companion = rain('ibiza', 'castform-rain')
    const plan = planDialogues(
      ordinaryDay({ decision: { mode: 'alerta', trigger }, facts: [calendar, dayShape, spotlight('zapdos'), trigger, companion] }),
    )

    // El RainFact está en el foco y su mapa dibuja Castform, pero el
    // protagonista elegido del día no es Castform: es el aviso.
    expect(plan.dialoguePlan[1].facts).toContain(companion)
    expect(plan.historyEntry.focusPokemonId).toBeNull()
  })

  it('el leitmotiv del cierre tampoco cambia el foco del día', () => {
    const trigger = alert('naranja')
    const castform = spotlight('castform-rain', 20)
    const plan = planDialogues(
      ordinaryDay({ decision: { mode: 'alerta', trigger }, facts: [calendar, dayShape, castform, trigger, temperature('sevilla', 'charmander')] }),
    )

    expect(plan.dialoguePlan[2].leitmotif).toBe('castform-vestuario')
    expect(plan.historyEntry.focusPokemonId).toBeNull()
  })

  it('el leitmotiv elegido queda registrado para su cooldown', () => {
    const snorunt = spotlight('snorunt', 2)
    const plan = planDialogues(
      ordinaryDay({
        facts: [calendar, dayShape, spotlight('zapdos', 3), snorunt, temperature('madrid', 'snorunt')],
        protagonists: [protagonist('headline', spotlight('zapdos', 3)), protagonist('rarity', snorunt)],
      }),
    )

    expect(plan.historyEntry.leitmotifIds).toEqual(['snorunt-frio'])
  })

  it('sin leitmotiv, la lista queda vacía en vez de forzar uno', () => {
    expect(planDialogues(ordinaryDay()).historyEntry.leitmotifIds).toEqual([])
  })
})

describe('planDialogues — el historial nunca toca el modo', () => {
  const repeated = [entry('2026-09-17', 'castform'), entry('2026-09-16', 'castform'), entry('2026-09-15', 'castform')]

  it('alerta sigue siendo alerta tres días seguidos, con su trigger intacto', () => {
    const trigger = alert('naranja')
    const input = ordinaryDay({ decision: { mode: 'alerta', trigger }, facts: [...ordinaryDay().facts, trigger], history: repeated })
    const plan = planDialogues(input)

    expect(plan.dayMode).toBe('alerta')
    expect(plan.dialoguePlan[1].facts[0]).toBe(trigger)
  })

  it('invasion no se convierte en otra cosa por repetirse', () => {
    const trigger = spotlight('castform', 30)
    const plan = planDialogues(
      ordinaryDay({
        decision: { mode: 'invasion', trigger },
        facts: [calendar, dayShape, trigger, spotlight('zapdos', 2), temperature('madrid', 'castform')],
        protagonists: [protagonist('headline', spotlight('zapdos', 2))],
        history: repeated,
      }),
    )

    expect(plan.dayMode).toBe('invasion')
    expect(plan.dialoguePlan[1].facts[0]).toBe(trigger)
  })

  it('avistamiento tampoco', () => {
    const trigger = spotlight('cryogonal', 1)
    const plan = planDialogues(
      ordinaryDay({
        decision: { mode: 'avistamiento', trigger },
        facts: [calendar, dayShape, trigger, spotlight('charmander', 20), temperature('madrid', 'charmander')],
        protagonists: [protagonist('headline', spotlight('charmander', 20))],
        history: [entry('2026-09-17', 'cryogonal'), entry('2026-09-16', 'cryogonal'), entry('2026-09-15', 'cryogonal')],
      }),
    )

    expect(plan.dayMode).toBe('avistamiento')
    expect(plan.dialoguePlan[1].facts[0]).toBe(trigger)
  })

  it('una entrada de hoy en el historial no cambia la decisión de hoy', () => {
    const history = [entry('2026-09-17', 'zapdos'), entry('2026-09-16', 'zapdos'), entry('2026-09-15', 'zapdos')]
    const withToday = [entry(TODAY, 'charmander'), ...history]

    expect(planDialogues(ordinaryDay({ history: withToday }))).toEqual(planDialogues(ordinaryDay({ history })))
  })
})

describe('planDialogues — el gag va sobre su propio hecho', () => {
  it('el cierre usa un hecho del Pokémon del leitmotiv, no otro cualquiera', () => {
    const castform = spotlight('castform-rain', 20)
    const gyaradosMega = spotlight('gyarados-mega', 2)
    const input = ordinaryDay({
      // gyarados-mega es headline y quedaría libre para el cierre, pero el gag
      // elegido habla de Castform: manda el hecho que lo sostiene.
      facts: [calendar, dayShape, gyaradosMega, castform, temperature('sevilla', 'charmander')],
      protagonists: [protagonist('headline', gyaradosMega), protagonist('spread', castform)],
      decision: { mode: 'parte', trigger: null },
    })
    const [, , closing] = planDialogues(input).dialoguePlan

    expect(closing.leitmotif).toBe('castform-vestuario')
    expect(closing.facts[0]).toBe(castform)
  })

  it('sin ningún hecho libre del leitmotiv, se cae el gag y no el hecho', () => {
    const castform = spotlight('castform-rain', 20)
    const input = ordinaryDay({
      // El único hecho de Castform se gasta en el foco: el gag se queda sin
      // sostén y desaparece en vez de chocar con otro Pokémon.
      facts: [calendar, dayShape, castform, temperature('sevilla', 'charmander')],
      protagonists: [protagonist('headline', castform)],
      decision: { mode: 'parte', trigger: null },
    })
    const plan = planDialogues(input)
    const [, , closing] = plan.dialoguePlan

    expect(closing.leitmotif).toBeNull()
    expect(closing.facts).toHaveLength(1)
    // Un gag que no se cuenta tampoco consume su cooldown.
    expect(plan.historyEntry.leitmotifIds).toEqual([])
  })
})
