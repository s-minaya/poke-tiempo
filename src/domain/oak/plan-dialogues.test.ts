import { describe, expect, it } from 'vitest'

import type { PokedexId } from '../pokedex.ts'
import { POKEMON_LABELS } from '../pokemon-labels.ts'
import type { DayBriefing } from './briefing.ts'
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

/** El parte del día, referencia a hechos sueltos: es lo que manda sobre el reparto. */
function brief(overview: NarrativeFact, highlight: NarrativeFact, secondary: NarrativeFact): DayBriefing {
  return {
    overview: { role: 'overview', fact: overview },
    highlight: { role: 'highlight', fact: highlight },
    secondary: { role: 'secondary', fact: secondary },
  }
}

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

function spotlightsIn(facts: readonly NarrativeFact[]): PokemonSpotlightFact[] {
  return facts.filter((fact): fact is PokemonSpotlightFact => fact.kind === 'pokemon_spotlight')
}

/**
 * Día normal: tres protagonistas, algo de lluvia y un extremo térmico. El
 * parte reparte `overview` (el recuento del día), `highlight` (la lluvia) y
 * `secondary` (el extremo térmico).
 */
function ordinaryDay(overrides: Partial<DayPlanInput> = {}): DayPlanInput {
  const headline = spotlight('zapdos', 3)
  const spread = spotlight('charmander', 21)
  const rarity = spotlight('cryogonal', 2)
  const panorama = temperature('sevilla', 'charmander')
  const highlight = rain('ibiza', 'zapdos', false)

  return {
    date: TODAY,
    facts: [calendar, dayShape, headline, spread, rarity, panorama, highlight],
    protagonists: [protagonist('headline', headline), protagonist('spread', spread), protagonist('rarity', rarity)],
    decision: { mode: 'parte', trigger: null },
    history: [],
    briefing: brief(dayShape, highlight, panorama),
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
    const madrid = temperature('madrid', 'castform')
    const plan = planDialogues({
      date: TODAY,
      facts: [calendar, dayShape, only, madrid],
      protagonists: [protagonist('headline', only)],
      decision: { mode: 'parte', trigger: null },
      history: [],
      briefing: brief(dayShape, madrid, calendar),
    })

    expect(plan.dialoguePlan.every((slot) => slot.facts.length >= 1)).toBe(true)
    expect(new Set(allFacts(plan)).size).toBe(allFacts(plan).length)
  })

  it('el parte completa un inventario vacío: no hay ningún camino que aborte', () => {
    const overview = temperature('madrid', 'castform')
    const highlight = rain('ibiza', 'zapdos')
    const secondary = temperature('sevilla', 'charmander')
    const plan = planDialogues({
      date: TODAY,
      facts: [],
      protagonists: [],
      decision: { mode: 'parte', trigger: null },
      history: [],
      briefing: brief(overview, highlight, secondary),
    })

    expect(plan.dialoguePlan.map((slot) => slot.facts)).toEqual([[overview], [highlight], [secondary]])
  })
})

describe('planDialogues — apertura', () => {
  it('abre con el panorama del parte y no gasta el hecho focal', () => {
    const input = ordinaryDay()
    const [opening] = planDialogues(input).dialoguePlan

    expect(opening.facts).toEqual([dayShape])
    // Neutral siempre: el panorama existe casi a diario y el registro
    // científico se reserva a otros slots.
    expect(opening.tone).toBe('neutral')
    expect(opening.leitmotif).toBeNull()
  })

  it('con un panorama del parte, no añade el recuento del día como relleno', () => {
    const input = ordinaryDay({
      briefing: brief(temperature('madrid', 'castform'), rain('ibiza', 'zapdos'), temperature('sevilla', 'charmander')),
    })
    const [opening] = planDialogues(input).dialoguePlan

    expect(opening.facts).toEqual([input.briefing.overview.fact])
    expect(opening.facts).not.toContain(dayShape)
  })

  it('en fin de semana el calendario acompaña', () => {
    const input = ordinaryDay({ date: '2026-09-19', facts: [weekendCalendar, dayShape, ...ordinaryDay().facts.slice(2)] })
    const [opening] = planDialogues(input).dialoguePlan

    expect(opening.facts).toEqual([dayShape, weekendCalendar])
  })

  it('si el panorama del parte ya es el calendario, no lo repite', () => {
    const input = ordinaryDay({
      date: '2026-09-19',
      facts: [weekendCalendar, dayShape, ...ordinaryDay().facts.slice(2)],
      briefing: brief(weekendCalendar, rain('ibiza', 'zapdos'), temperature('sevilla', 'charmander')),
    })
    const [opening] = planDialogues(input).dialoguePlan

    expect(opening.facts).toEqual([weekendCalendar])
  })

  it('entre semana no menciona el día: la apertura no es un formulario', () => {
    const [opening] = planDialogues(ordinaryDay()).dialoguePlan

    expect(opening.facts).not.toContain(calendar)
  })
})

describe('planDialogues — foco', () => {
  it('alerta: el hecho del parte es el aviso del trigger y va en el foco', () => {
    const trigger = alert('naranja')
    const input = ordinaryDay({
      decision: { mode: 'alerta', trigger },
      facts: [...ordinaryDay().facts, trigger],
      briefing: brief(dayShape, trigger, temperature('sevilla', 'charmander')),
    })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts[0]).toBe(trigger)
    expect(focus.tone).toBe('consejo')
  })

  it('alerta: un aviso rojo sí se cuenta en épico, un naranja no se dramatiza', () => {
    const red = alert('rojo')
    const input = ordinaryDay({
      decision: { mode: 'alerta', trigger: red },
      facts: [...ordinaryDay().facts, red],
      briefing: brief(dayShape, red, temperature('sevilla', 'charmander')),
    })

    expect(planDialogues(input).dialoguePlan[1].tone).toBe('epico')
  })

  it('alerta: añade el hecho del mismo fenómeno y lugar cuando la correspondencia es explícita', () => {
    const trigger = alert('naranja')
    const companion = rain('ibiza', 'castform-rain')
    const input = ordinaryDay({
      decision: { mode: 'alerta', trigger },
      facts: [calendar, dayShape, spotlight('zapdos'), trigger, companion],
      briefing: brief(dayShape, trigger, temperature('sevilla', 'charmander')),
    })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts).toEqual([trigger, companion])
  })

  it('alerta: no arrastra un hecho de otro lugar aunque sea del mismo fenómeno', () => {
    const trigger = alert('naranja')
    const elsewhere = rain('madrid', 'castform-rain')
    const input = ordinaryDay({
      decision: { mode: 'alerta', trigger },
      facts: [calendar, dayShape, spotlight('zapdos'), trigger, elsewhere],
      briefing: brief(dayShape, trigger, temperature('sevilla', 'charmander')),
    })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts).toEqual([trigger])
  })

  it('alerta: no arrastra un hecho de otro fenómeno aunque sea del mismo lugar', () => {
    const trigger = alert('naranja', { phenomenon: 'viento', sourcePhenomenon: 'Vientos' })
    const sameLocation = rain('ibiza', 'castform-rain')
    const input = ordinaryDay({
      decision: { mode: 'alerta', trigger },
      facts: [calendar, dayShape, spotlight('zapdos'), trigger, sameLocation],
      briefing: brief(dayShape, trigger, temperature('sevilla', 'charmander')),
    })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts).toEqual([trigger])
  })

  it('invasion: el spotlight del trigger acompaña al hecho del parte, en épico', () => {
    const trigger = spotlight('castform', 30)
    const input = ordinaryDay({
      decision: { mode: 'invasion', trigger },
      facts: [calendar, dayShape, trigger, spotlight('zapdos', 2), temperature('madrid', 'castform')],
      protagonists: [protagonist('headline', spotlight('zapdos', 2))],
      briefing: brief(dayShape, rain('madrid', 'castform-rain'), temperature('madrid', 'castform')),
    })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts).toContain(trigger)
    expect(focus.tone).toBe('epico')
  })

  it('avistamiento: el spotlight del trigger acompaña al hecho del parte, en científico', () => {
    const trigger = spotlight('cryogonal', 1)
    const input = ordinaryDay({
      decision: { mode: 'avistamiento', trigger },
      facts: [calendar, dayShape, trigger, spotlight('charmander', 20), temperature('madrid', 'charmander')],
      protagonists: [protagonist('headline', spotlight('charmander', 20))],
      briefing: brief(dayShape, rain('madrid', 'castform-rain'), temperature('madrid', 'charmander')),
    })
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts).toContain(trigger)
    expect(focus.tone).toBe('cientifico')
  })

  it('parte: el protagonista elegido acompaña al hecho del parte, en neutral', () => {
    const input = ordinaryDay()
    const [, focus] = planDialogues(input).dialoguePlan

    expect(focus.facts).toContain(input.protagonists[0].spotlight)
    expect(focus.tone).toBe('neutral')
  })

  it('parte: tras tres días distintos con el mismo foco, usa la alternativa', () => {
    const history = [entry('2026-09-17', 'zapdos'), entry('2026-09-16', 'zapdos'), entry('2026-09-15', 'zapdos')]
    const plan = planDialogues(ordinaryDay({ history }))

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
  it('empieza con el hecho del parte y añade otro sin consumir', () => {
    const plan = planDialogues(ordinaryDay())
    const [opening, focus, closing] = plan.dialoguePlan

    expect(closing.facts[0]).toBe(plan.briefing.secondary.fact)
    expect(closing.facts.length).toBeGreaterThanOrEqual(1)
    for (const fact of closing.facts) {
      expect([...opening.facts, ...focus.facts]).not.toContain(fact)
    }
  })

  it('prefiere otro protagonista sin usar para acompañar el cierre', () => {
    const [, , closing] = planDialogues(ordinaryDay()).dialoguePlan

    expect(spotlightsIn(closing.facts)).toHaveLength(1)
  })

  it('el leitmotiv va en el cierre, nunca en apertura ni foco', () => {
    const snorunt = spotlight('snorunt', 2)
    const madrid = temperature('madrid', 'snorunt')
    const input = ordinaryDay({
      facts: [calendar, dayShape, spotlight('zapdos', 3), snorunt, madrid],
      protagonists: [protagonist('headline', spotlight('zapdos', 3)), protagonist('rarity', snorunt)],
      briefing: brief(dayShape, rain('ibiza', 'zapdos'), madrid),
    })
    const [opening, focus, closing] = planDialogues(input).dialoguePlan

    expect(closing.leitmotif).toBe('snorunt-frio')
    expect(opening.leitmotif).toBeNull()
    expect(focus.leitmotif).toBeNull()
  })

  it('un cierre con leitmotiv sigue llevando un hecho real', () => {
    const snorunt = spotlight('snorunt', 2)
    const madrid = temperature('madrid', 'snorunt')
    const input = ordinaryDay({
      facts: [calendar, dayShape, spotlight('zapdos', 3), snorunt, madrid],
      protagonists: [protagonist('headline', spotlight('zapdos', 3)), protagonist('rarity', snorunt)],
      briefing: brief(dayShape, rain('ibiza', 'zapdos'), madrid),
    })
    const [, , closing] = planDialogues(input).dialoguePlan

    expect(spotlightsIn(closing.facts)).toHaveLength(1)
    expect(closing.tone).toBe('guasa')
  })

  it('sin leitmotiv, un hecho accionable se cierra con consejo', () => {
    const zapdos = spotlight('zapdos', 3)
    const ibiza = rain('ibiza', 'castform-rain')
    const input = ordinaryDay({
      facts: [calendar, dayShape, zapdos, ibiza],
      protagonists: [protagonist('headline', zapdos)],
      briefing: brief(dayShape, temperature('sevilla', 'charmander'), temperature('madrid', 'castform')),
    })
    const [, , closing] = planDialogues(input).dialoguePlan

    expect(closing.facts).toContain(ibiza)
    expect(closing.tone).toBe('consejo')
  })

  it('sin leitmotiv ni hecho accionable, cierra en neutral', () => {
    const zapdos = spotlight('zapdos', 3)
    const sevilla = temperature('sevilla', 'charmander')
    const input = ordinaryDay({
      facts: [calendar, dayShape, zapdos, sevilla],
      protagonists: [protagonist('headline', zapdos)],
      briefing: brief(dayShape, rain('ibiza', 'castform-rain'), temperature('madrid', 'castform')),
    })
    const [, , closing] = planDialogues(input).dialoguePlan

    expect(closing.facts).toContain(sevilla)
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
        briefing: brief(dayShape, rain('madrid', 'castform-rain'), temperature('madrid', 'castform')),
      }),
    )

    expect(invasion.historyEntry.focusPokemonId).toBe('castform')
  })

  it('en alerta sin Pokémon acompañante, el foco histórico es null', () => {
    const trigger = alert('naranja', { phenomenon: 'deshielo', sourcePhenomenon: 'Deshielo' })
    const plan = planDialogues(
      ordinaryDay({
        decision: { mode: 'alerta', trigger },
        facts: [...ordinaryDay().facts, trigger],
        briefing: brief(dayShape, trigger, temperature('sevilla', 'charmander')),
      }),
    )

    expect(plan.historyEntry.focusPokemonId).toBeNull()
  })

  it('en alerta, el hecho acompañante no convierte a su Pokémon en foco del día', () => {
    const trigger = alert('naranja')
    const companion = rain('ibiza', 'castform-rain')
    const plan = planDialogues(
      ordinaryDay({
        decision: { mode: 'alerta', trigger },
        facts: [calendar, dayShape, spotlight('zapdos'), trigger, companion],
        briefing: brief(dayShape, trigger, temperature('sevilla', 'charmander')),
      }),
    )

    // El RainFact está en el foco y su mapa dibuja Castform, pero el
    // protagonista elegido del día no es Castform: es el aviso.
    expect(plan.dialoguePlan[1].facts).toContain(companion)
    expect(plan.historyEntry.focusPokemonId).toBeNull()
  })

  // Antes este caso comprobaba que el gag del cierre no se colara como foco
  // del día. En alerta ya no hay gag que pueda colarse: el día serio lo
  // impide antes. Que el foco siga siendo null lo cubren los dos casos de
  // arriba, que no dependen de ningún leitmotiv.
  it('alerta: el gag que habría encajado no llega a elegirse', () => {
    const trigger = alert('naranja')
    const castform = spotlight('castform-rain', 20)
    const heat = temperature('sevilla', 'charmander')
    const plan = planDialogues(
      ordinaryDay({
        decision: { mode: 'alerta', trigger },
        facts: [calendar, dayShape, castform, trigger, heat],
        briefing: brief(dayShape, trigger, heat),
      }),
    )

    expect(plan.dialoguePlan[2].leitmotif).toBeNull()
    expect(plan.historyEntry.focusPokemonId).toBeNull()
  })

  it('el leitmotiv elegido queda registrado para su cooldown', () => {
    const snorunt = spotlight('snorunt', 2)
    const madrid = temperature('madrid', 'snorunt')
    const plan = planDialogues(
      ordinaryDay({
        facts: [calendar, dayShape, spotlight('zapdos', 3), snorunt, madrid],
        protagonists: [protagonist('headline', spotlight('zapdos', 3)), protagonist('rarity', snorunt)],
        briefing: brief(dayShape, rain('ibiza', 'zapdos'), madrid),
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
    const input = ordinaryDay({
      decision: { mode: 'alerta', trigger },
      facts: [...ordinaryDay().facts, trigger],
      briefing: brief(dayShape, trigger, temperature('sevilla', 'charmander')),
      history: repeated,
    })
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
        briefing: brief(dayShape, rain('madrid', 'castform-rain'), temperature('madrid', 'castform')),
        history: repeated,
      }),
    )

    expect(plan.dayMode).toBe('invasion')
    expect(plan.dialoguePlan[1].facts).toContain(trigger)
  })

  it('avistamiento tampoco', () => {
    const trigger = spotlight('cryogonal', 1)
    const plan = planDialogues(
      ordinaryDay({
        decision: { mode: 'avistamiento', trigger },
        facts: [calendar, dayShape, trigger, spotlight('charmander', 20), temperature('madrid', 'charmander')],
        protagonists: [protagonist('headline', spotlight('charmander', 20))],
        briefing: brief(dayShape, rain('madrid', 'castform-rain'), temperature('madrid', 'charmander')),
        history: [entry('2026-09-17', 'cryogonal'), entry('2026-09-16', 'cryogonal'), entry('2026-09-15', 'cryogonal')],
      }),
    )

    expect(plan.dayMode).toBe('avistamiento')
    expect(plan.dialoguePlan[1].facts).toContain(trigger)
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
      briefing: brief(dayShape, temperature('sevilla', 'charmander'), temperature('madrid', 'castform')),
    })
    const [, , closing] = planDialogues(input).dialoguePlan

    expect(closing.leitmotif).toBe('castform-vestuario')
    expect(closing.facts).toContain(castform)
  })

  it('sin ningún hecho libre del leitmotiv, se cae el gag y no el hecho', () => {
    const castform = spotlight('castform-rain', 20)
    const input = ordinaryDay({
      // El único hecho de Castform se gasta en el foco: el gag se queda sin
      // sostén y desaparece en vez de chocar con otro Pokémon.
      facts: [calendar, dayShape, castform, temperature('sevilla', 'charmander')],
      protagonists: [protagonist('headline', castform)],
      decision: { mode: 'parte', trigger: null },
      briefing: brief(dayShape, temperature('sevilla', 'charmander'), temperature('madrid', 'castform')),
    })
    const plan = planDialogues(input)
    const [, , closing] = plan.dialoguePlan

    expect(closing.leitmotif).toBeNull()
    // El cierre sigue llevando el hecho del parte aunque el gag se caiga.
    expect(closing.facts[0]).toBe(plan.briefing.secondary.fact)
    // Un gag que no se cuenta tampoco consume su cooldown.
    expect(plan.historyEntry.leitmotifIds).toEqual([])
  })
})

describe('planDialogues — el parte manda sobre el reparto', () => {
  it('cada hueco contiene el hecho de su rol, por identidad', () => {
    const input = ordinaryDay()
    const plan = planDialogues(input)

    expect(plan.dialoguePlan[0].facts).toContain(input.briefing.overview.fact)
    expect(plan.dialoguePlan[1].facts).toContain(input.briefing.highlight.fact)
    expect(plan.dialoguePlan[2].facts).toContain(input.briefing.secondary.fact)
  })

  it('el hecho de un rol no se repite en otro hueco', () => {
    const plan = planDialogues(ordinaryDay())
    const facts = allFacts(plan)

    expect(new Set(facts).size).toBe(facts.length)
  })

  it('un protagonista, un modo y un leitmotiv añaden texto pero no eliminan el parte', () => {
    const castform = spotlight('castform-rain', 20)
    const snorunt = spotlight('snorunt', 2)
    const heat = temperature('sevilla', 'charmander')
    const input = ordinaryDay({
      facts: [calendar, dayShape, castform, snorunt, heat],
      protagonists: [protagonist('headline', castform)],
      decision: { mode: 'invasion', trigger: castform },
      briefing: brief(dayShape, rain('madrid', 'castform-rain'), heat),
    })
    const plan = planDialogues(input)
    const facts = allFacts(plan)

    for (const role of ['overview', 'highlight', 'secondary'] as const) {
      expect(facts).toContain(input.briefing[role].fact)
    }
    expect(plan.leitmotif).not.toBeNull()
  })
})

/**
 * Un día serio es un día sin humor, y no por convenio de redacción: el plan
 * no puede producirlo. El fixture pone a propósito un Castform con 20
 * lugares —el gag perfecto, libre y sin cooldown— para que el día tenga algo
 * que rechazar.
 */
describe('planDialogues — días serios', () => {
  const castform = spotlight('castform-rain', 20)

  function alertDay(level: AlertFact['level'], overrides: Partial<DayPlanInput> = {}): DayPlanInput {
    const trigger = alert(level)
    const heat = temperature('sevilla', 'charmander')
    return ordinaryDay({
      decision: { mode: 'alerta', trigger },
      facts: [calendar, dayShape, castform, trigger, heat],
      briefing: brief(dayShape, trigger, heat),
      ...overrides,
    })
  }

  it.each(['naranja', 'rojo'] as const)('aviso %s: ningún slot puede ir en guasa', (level) => {
    const { dialoguePlan } = planDialogues(alertDay(level))

    expect(dialoguePlan.map((slot) => slot.tone)).not.toContain('guasa')
  })

  it.each(['naranja', 'rojo'] as const)('aviso %s: ningún slot lleva leitmotiv', (level) => {
    const plan = planDialogues(alertDay(level))

    expect(plan.leitmotif).toBeNull()
    expect(plan.dialoguePlan.map((slot) => slot.leitmotif)).toEqual([null, null, null])
  })

  it.each(['naranja', 'rojo'] as const)('aviso %s: el día queda marcado como serio', (level) => {
    expect(planDialogues(alertDay(level)).serious).toBe(true)
  })

  it('no entra nada en el historial, así que no se consume ningún cooldown', () => {
    const plan = planDialogues(alertDay('naranja'))

    expect(plan.historyEntry.leitmotifIds).toEqual([])
  })

  it('el gag que no se contó sigue disponible al día siguiente', () => {
    const serious = planDialogues(alertDay('naranja'))
    const headline = spotlight('zapdos', 3)
    const heat = temperature('sevilla', 'charmander')
    // El día siguiente hereda el historial del día serio: si aquel hubiera
    // gastado el gag, este no podría contarlo. El foco se lo lleva Zapdos
    // para que el hecho de Castform llegue libre al cierre.
    const next = planDialogues(
      ordinaryDay({
        date: '2026-09-19',
        facts: [calendar, dayShape, headline, castform, heat],
        protagonists: [protagonist('headline', headline), protagonist('spread', castform)],
        decision: { mode: 'parte', trigger: null },
        history: [serious.historyEntry],
        briefing: brief(dayShape, heat, temperature('madrid', 'castform')),
      }),
    )

    expect(next.dialoguePlan[2].leitmotif).toBe('castform-vestuario')
  })

  it('el tono del foco no cambia: naranja aconseja, rojo es grave', () => {
    expect(planDialogues(alertDay('naranja')).dialoguePlan[1].tone).toBe('consejo')
    expect(planDialogues(alertDay('rojo')).dialoguePlan[1].tone).toBe('epico')
  })

  it('el cierre se queda en un tono no humorístico', () => {
    for (const level of ['naranja', 'rojo'] as const) {
      expect(['neutral', 'cientifico', 'consejo']).toContain(planDialogues(alertDay(level)).dialoguePlan[2].tone)
    }
  })

  it('los demás modos siguen pudiendo llevar gag y no son serios', () => {
    const heat = temperature('sevilla', 'charmander')
    const modes: DayPlanInput['decision'][] = [
      { mode: 'parte', trigger: null },
      { mode: 'invasion', trigger: castform },
      { mode: 'avistamiento', trigger: castform },
    ]

    for (const decision of modes) {
      const plan = planDialogues(
        ordinaryDay({
          facts: [calendar, dayShape, castform, spotlight('snorunt', 2), heat],
          protagonists: [protagonist('headline', castform)],
          decision,
          briefing: brief(dayShape, rain('madrid', 'castform-rain'), heat),
        }),
      )

      expect(plan.serious).toBe(false)
      expect(plan.dialoguePlan[2].leitmotif).not.toBeNull()
      expect(plan.dialoguePlan[2].tone).toBe('guasa')
    }
  })
})
