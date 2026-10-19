import { describe, expect, it } from 'vitest'

import { POKEMON_LABELS } from '../pokemon-labels.ts'
import { buildDayClaims, extractNumbers } from './claims.ts'
import { PARENT_SCOPE } from './editorial-regions.ts'
import { findRelativeTimeExpression } from './relative-time-expressions.ts'
import type { DayPlan, DialoguePlan, DialogueSlot, Tone } from './plan-dialogues.ts'
import type { NarrativeFact, PatternCondition, PatternScope, TemperatureRole } from './types.ts'

/**
 * Los claims son la frontera entre nuestro modelo de dominio y quien redacta
 * con IA. Se prueban por lo que **no** dicen tanto como por lo que dicen: un
 * valor que no debía viajar no se puede publicar por error.
 */

function slot(facts: NarrativeFact[], tone: Tone = 'neutral'): DialogueSlot {
  return { id: 'dialogue-1', role: 'apertura', tone, facts, leitmotif: null }
}

function planWith(...slots: DialogueSlot[]): DayPlan {
  const dialoguePlan = [
    { ...slots[0], id: 'dialogue-1' as const, role: 'apertura' as const },
    { ...(slots[1] ?? slots[0]), id: 'dialogue-2' as const, role: 'foco' as const },
    { ...(slots[2] ?? slots[0]), id: 'dialogue-3' as const, role: 'cierre' as const },
  ] as DialoguePlan

  return {
    date: '2026-09-23',
    dayMode: 'parte',
    serious: false,
    briefing: {
      overview: { role: 'overview', fact: dialoguePlan[0].facts[0] },
      highlight: { role: 'highlight', fact: dialoguePlan[1].facts[0] },
      secondary: { role: 'secondary', fact: dialoguePlan[2].facts[0] },
    },
    focusPokemonId: null,
    leitmotif: null,
    dialoguePlan,
    historyEntry: { date: '2026-09-23', focusPokemonId: null, leitmotifIds: [] },
  }
}

/** Los claims del primer hueco, que es donde se colocan los hechos de cada caso. */
function claimsOf(facts: NarrativeFact[]): string[] {
  return buildDayClaims(planWith(slot(facts))).dialogues[0].claims
}

function textOf(facts: NarrativeFact[]): string {
  return claimsOf(facts).join(' ')
}

function temperature(role: TemperatureRole): NarrativeFact {
  return {
    kind: 'temperature',
    locationId: 'benasque',
    locationName: 'Benasque',
    mapPokemonId: 'charmeleon',
    mapRepresentsFact: true,
    role,
    maxC: 30,
    minC: 10,
  }
}

function spotlight(locationCount: number, names: string[], pokemonId: 'charmeleon' | 'castform-ice' = 'charmeleon'): NarrativeFact {
  return {
    kind: 'pokemon_spotlight',
    pokemonId,
    label: POKEMON_LABELS[pokemonId],
    locations: names.map((name) => ({ locationId: name.toLowerCase(), locationName: name, mapPokemonId: pokemonId })),
    locationCount,
  }
}

function dayShape(alertedLocations: number, rainingLocations: number): NarrativeFact {
  return { kind: 'day_shape', totalLocations: 74, rainingLocations, alertedLocations, distinctPokemonCount: 8 }
}

function alert(affected: string[], affectedLocationCount: number): NarrativeFact {
  return {
    kind: 'alert',
    level: 'naranja',
    phenomenon: 'lluvia',
    sourcePhenomenon: 'Lluvias persistentes',
    officialZoneId: '645301',
    source: 'aemet',
    affectedLocations: affected.map((name) => ({ locationId: name.toLowerCase(), locationName: name })),
    affectedLocationCount,
  }
}

const PRESENT_FOG: PatternCondition = { family: 'occurrence', phenomenon: 'niebla', polarity: 'presente' }

function pattern(
  condition: PatternCondition,
  scope: PatternScope = 'region:northwest',
  counts: { eligible: number; affected: number } = { eligible: 6, affected: 5 },
): NarrativeFact {
  return {
    kind: 'pattern',
    scope,
    parentScope: PARENT_SCOPE[scope],
    scopeSize: 6,
    condition,
    eligibleCount: counts.eligible,
    affectedCount: counts.affected,
    affectedLocations: [],
    measures: { prevalenceInternal: 0, prevalenceRest: 0, contrast: 0, concentration: 0, overRepresentation: 0 },
  }
}

describe('temperatura: solo viaja el valor que el papel señala', () => {
  it('coldest_night lleva la mínima y no la máxima', () => {
    const text = textOf([temperature('coldest_night')])

    expect(text).toContain('10 °C')
    expect(text).not.toContain('30')
    expect(text).toContain('mínima nocturna')
  })

  it('hottest lleva la máxima y no la mínima', () => {
    const text = textOf([temperature('hottest')])

    expect(text).toContain('30 °C')
    expect(text).not.toContain('10')
    expect(text).toContain('máxima del día')
  })

  it('coldest_day lleva la máxima y no la mínima', () => {
    const text = textOf([temperature('coldest_day')])

    expect(text).toContain('30 °C')
    expect(text).not.toContain('10')
    expect(text).toContain('máxima diurna más baja')
  })

  it('el valor descartado tampoco queda autorizado como cifra', () => {
    const { allowed } = buildDayClaims(planWith(slot([temperature('coldest_night')]))).dialogues[0]

    expect(allowed.numbers).toContain(10)
    expect(allowed.numbers).not.toContain(30)
  })
})

describe('spotlight', () => {
  it('con muestra, la frase dice que son ejemplos', () => {
    const text = textOf([spotlight(35, ['La Rioja', 'Navarra', 'Huesca'])])

    expect(text).toContain('35 lugares')
    expect(text).toContain('son algunos ejemplos')
  })

  it('cuando la lista es completa, no la presenta como muestra', () => {
    const text = textOf([spotlight(3, ['La Rioja', 'Navarra', 'Huesca'])])

    expect(text).toContain('3 lugares del mapa: La Rioja, Navarra y Huesca')
    expect(text).not.toContain('ejemplos')
  })

  it('un solo lugar se dice con dígito, como el resto de cantidades', () => {
    expect(textOf([spotlight(1, ['Gijón'])])).toBe('Charmeleon aparece en 1 lugar del mapa: Gijón.')
  })

  it('sin muestra, solo el recuento', () => {
    expect(textOf([spotlight(6, [])])).toBe('Charmeleon aparece en 6 lugares del mapa.')
  })

  it('un nombre compartido llega desambiguado, y el nombre a secas también queda autorizado', () => {
    const { claims, allowed } = buildDayClaims(planWith(slot([spotlight(4, ['Vigo'], 'castform-ice')]))).dialogues[0]

    expect(claims[0]).toContain('Castform (Niebla)')
    expect(allowed.pokemon).toContain('Castform (Niebla)')
    expect(allowed.pokemon).toContain('Castform')
  })
})

describe('day_shape: elegimos nosotros qué es interesante', () => {
  it('nunca verbaliza cuántos Pokémon distintos hay', () => {
    for (const fact of [dayShape(7, 2), dayShape(7, 0), dayShape(0, 2), dayShape(0, 0)]) {
      const text = textOf([fact])

      expect(text).not.toContain('8')
      expect(text).not.toContain('Pokémon')
    }
  })

  it('no vuelca los cuatro recuentos: dos cifras como mucho', () => {
    for (const fact of [dayShape(7, 2), dayShape(7, 0), dayShape(0, 2), dayShape(0, 0)]) {
      expect(extractNumbers(textOf([fact])).length).toBeLessThanOrEqual(2)
    }
  })

  it('con avisos y lluvia, los dos recuentos y sin el total', () => {
    const text = textOf([dayShape(7, 2)])

    expect(text).toBe('Hay 7 lugares del mapa bajo algún aviso y 2 con lluvia.')
    expect(text).not.toContain('74')
  })

  it('con un solo recuento, el total entra como referencia', () => {
    expect(textOf([dayShape(7, 0)])).toBe('En el mapa, 7 de 74 lugares están bajo algún aviso.')
    expect(textOf([dayShape(0, 2)])).toBe('En el mapa, 2 de 74 lugares tienen lluvia.')
  })

  it('el singular concuerda', () => {
    expect(textOf([dayShape(1, 0)])).toContain('1 de 74 lugares está bajo')
    expect(textOf([dayShape(0, 1)])).toContain('1 de 74 lugares tiene lluvia')
  })

  it('sin lluvia ni avisos, lo dice', () => {
    expect(textOf([dayShape(0, 0)])).toBe('No hay lluvia ni avisos en ninguno de 74 lugares del mapa.')
  })
})

describe('aviso: un aviso no es un lugar', () => {
  it('el recuento se dice como lugares afectados, no como número de avisos', () => {
    const text = textOf([alert(['Ibiza', 'Denia', 'Gandía'], 4)])

    expect(text).toBe(
      'Hay un aviso oficial naranja por lluvia que afecta a 4 lugares de nuestro mapa; Ibiza, Denia y Gandía son algunos de ellos.',
    )
    // Un solo aviso: en la frase no hay ningún recuento de avisos.
    expect(text).not.toContain('4 avisos')
  })

  it('un único lugar afectado se nombra, sin recuento', () => {
    expect(textOf([alert(['Ibiza'], 1)])).toBe('Hay un aviso oficial naranja por lluvia que afecta a nuestro lugar de Ibiza.')
  })

  it('cuando la lista está completa, no se presenta como muestra', () => {
    const text = textOf([alert(['Ibiza', 'Denia'], 2)])

    expect(text).toContain('2 lugares de nuestro mapa: Ibiza y Denia')
    expect(text).not.toContain('algunos de ellos')
  })

  it('sin nombres, solo el recuento de lugares', () => {
    expect(textOf([alert([], 4)])).toContain('afecta a 4 lugares de nuestro mapa')
  })

  it('no viaja la trazabilidad ni el nivel se reinterpreta', () => {
    const { claims, allowed } = buildDayClaims(planWith(slot([alert(['Ibiza'], 1)]))).dialogues[0]

    expect(claims.join(' ')).not.toContain('645301')
    expect(claims.join(' ')).not.toContain('aemet')
    expect(claims.join(' ')).not.toContain('Lluvias persistentes')
    expect(allowed.alertLevels).toEqual(['naranja'])
  })
})

describe('el resto de hechos', () => {
  const cases: [string, NarrativeFact, string][] = [
    [
      'lluvia con probabilidad',
      { kind: 'rain', locationId: 'vigo', locationName: 'Vigo', mapPokemonId: 'castform-rain', mapRepresentsFact: true, mm: 12.4, probabilityPercent: 80 },
      'En Vigo se esperan 12,4 mm de lluvia, con un 80 % de probabilidad.',
    ],
    [
      'lluvia sin probabilidad',
      { kind: 'rain', locationId: 'vigo', locationName: 'Vigo', mapPokemonId: 'castform-rain', mapRepresentsFact: true, mm: 12.4, probabilityPercent: null },
      'En Vigo se esperan 12,4 mm de lluvia.',
    ],
    [
      'nieve',
      { kind: 'snow', locationId: 'benasque', locationName: 'Benasque', mapPokemonId: 'abomasnow', mapRepresentsFact: true, cm: 6 },
      'En Benasque se esperan 6 cm de nieve.',
    ],
    [
      'viento con racha',
      { kind: 'wind', locationId: 'tarifa', locationName: 'Tarifa', mapPokemonId: 'tornadus', mapRepresentsFact: true, speedKmh: 45, gustKmh: 80, warm: false },
      'En Tarifa se espera viento de 45 km/h, con rachas de 80 km/h.',
    ],
    [
      'viento cálido sin racha',
      { kind: 'wind', locationId: 'tarifa', locationName: 'Tarifa', mapPokemonId: 'moltres', mapRepresentsFact: true, speedKmh: 45, gustKmh: null, warm: true },
      'En Tarifa se espera viento cálido de 45 km/h.',
    ],
    [
      'tormenta',
      { kind: 'storm', locationId: 'teruel', locationName: 'Teruel', mapPokemonId: 'zapdos', mapRepresentsFact: true },
      'En Teruel se esperan tormentas.',
    ],
    [
      'niebla',
      { kind: 'fog', locationId: 'lugo', locationName: 'Lugo', mapPokemonId: 'castform-ice', mapRepresentsFact: true },
      'En Lugo se espera niebla.',
    ],
    [
      'calima con aviso',
      { kind: 'calima', locationId: 'almeria', locationName: 'Almería', mapPokemonId: 'hippowdon', mapRepresentsFact: true, fromAlert: true },
      'En Almería se espera calima, respaldada por un aviso oficial.',
    ],
    [
      'calima sin aviso',
      { kind: 'calima', locationId: 'almeria', locationName: 'Almería', mapPokemonId: 'hippowdon', mapRepresentsFact: true, fromAlert: false },
      'En Almería se espera calima.',
    ],
    [
      'marítimo con periodo',
      { kind: 'marine', locationId: 'gijon', locationName: 'Gijón', mapPokemonId: 'gyarados', mapRepresentsFact: true, waveHeightM: 3.5, wavePeriodS: 9 },
      'Frente a Gijón se esperan olas de 3,5 m, con periodos de 9 s.',
    ],
    ['calendario entre semana', { kind: 'calendar', date: '2026-09-23', weekday: 'miercoles', weekend: false }, 'La previsión es para el miércoles.'],
    ['calendario en fin de semana', { kind: 'calendar', date: '2026-09-23', weekday: 'sabado', weekend: true }, 'La previsión es para el sábado, fin de semana.'],
  ]

  it.each(cases)('%s', (_name, fact, expected) => {
    expect(textOf([fact])).toBe(expected)
  })

  it('ningún claim depende del momento de lectura', () => {
    const facts = [...cases.map(([, fact]) => fact), dayShape(7, 2), dayShape(7, 0), dayShape(0, 2), dayShape(0, 0), dayShape(1, 0), dayShape(0, 1)]

    for (const fact of facts) {
      expect(findRelativeTimeExpression(textOf([fact]))).toBeNull()
    }
  })

  it('la fecha no se verbaliza: solo aportaría dígitos que Oak no puede usar', () => {
    const { claims, allowed } = buildDayClaims(
      planWith(slot([{ kind: 'calendar', date: '2026-09-23', weekday: 'miercoles', weekend: false }])),
    ).dialogues[0]

    expect(claims.join(' ')).not.toContain('2026')
    expect(allowed.numbers).toEqual([])
  })
})

describe('el encargo completo', () => {
  const plan = planWith(
    slot([dayShape(7, 2)]),
    { ...slot([spotlight(35, ['La Rioja', 'Navarra', 'Huesca']), temperature('coldest_night')], 'epico'), id: 'dialogue-2', role: 'foco' },
    { ...slot([spotlight(6, ['Gijón'])], 'guasa'), id: 'dialogue-3', role: 'cierre', leitmotif: 'gyarados-mar' },
  )

  it('conserva los tres huecos con su papel, su tono y su gag', () => {
    const { dialogues, dayMode } = buildDayClaims(plan)

    expect(dayMode).toBe('parte')
    expect(dialogues.map((dialogue) => [dialogue.id, dialogue.role, dialogue.tone])).toEqual([
      ['dialogue-1', 'apertura', 'neutral'],
      ['dialogue-2', 'foco', 'epico'],
      ['dialogue-3', 'cierre', 'guasa'],
    ])
    expect(dialogues[2].leitmotif).toBe('gyarados-mar')
  })

  it('un claim por hecho, en el mismo orden', () => {
    const { dialogues } = buildDayClaims(plan)

    expect(dialogues[1].claims).toHaveLength(2)
    expect(dialogues[1].claims[0]).toContain('Charmeleon')
    expect(dialogues[1].claims[1]).toContain('Benasque')
  })

  it('las cifras autorizadas salen de los propios claims', () => {
    const { dialogues } = buildDayClaims(plan)

    expect(dialogues[1].allowed.numbers).toEqual([35, 10])
    expect(dialogues[0].allowed.numbers).toEqual([7, 2])
  })

  it('el vocabulario de un hueco no autoriza el del vecino', () => {
    const { dialogues } = buildDayClaims(plan)

    expect(dialogues[1].allowed.places).toContain('Navarra')
    expect(dialogues[2].allowed.places).not.toContain('Navarra')
    expect(dialogues[2].allowed.numbers).not.toContain(35)
  })

  it('es determinista: el mismo plan da el mismo encargo', () => {
    expect(buildDayClaims(plan)).toEqual(buildDayClaims(plan))
  })
})

describe('patrón: un hecho agregado, no un punto', () => {
  it('la ocurrencia presente se afirma con su ámbito', () => {
    expect(claimsOf([pattern(PRESENT_FOG)])[0]).toBe('En el noroeste hay niebla.')
  })

  it('la nieve ausente se dice sin acumulación, no sin nieve', () => {
    const text = claimsOf([pattern({ family: 'occurrence', phenomenon: 'nieve', polarity: 'ausente' })])[0]

    expect(text).toBe('Sin acumulación de nieve en el noroeste.')
    expect(text).not.toContain('sin nieve')
  })

  it('viento y olas tienen su propia forma, no un "hay"', () => {
    expect(claimsOf([pattern({ family: 'occurrence', phenomenon: 'viento', polarity: 'presente' })])[0]).toBe(
      'El viento gana protagonismo en el noroeste.',
    )
    expect(claimsOf([pattern({ family: 'occurrence', phenomenon: 'olas', polarity: 'presente' })])[0]).toBe(
      'El oleaje destaca en el noroeste.',
    )
  })

  it('el cielo se afirma sobre el ámbito', () => {
    expect(claimsOf([pattern({ family: 'sky', value: 'cubierto' }, 'map')])[0]).toBe('En el mapa domina el cielo cubierto.')
  })

  it('la banda térmica no se nombra: ni el corte ni un adjetivo de intensidad', () => {
    const highest = claimsOf([pattern({ family: 'temperature', extreme: 'highest' }, 'region:southwest')])[0]
    const lowest = claimsOf([pattern({ family: 'temperature', extreme: 'lowest' }, 'region:southwest')])[0]

    expect(highest).toBe('En el suroeste se concentran las máximas más altas.')
    expect(lowest).toBe('En el suroeste se concentran las máximas más bajas.')
  })

  it('Portugal no generaliza y el obligatorio no fuerza un N', () => {
    const { required } = buildDayClaims(planWith(slot([pattern(PRESENT_FOG, 'region:portugal')]))).dialogues[0]

    expect(required).toEqual(['Entre los lugares de Portugal representados en el mapa hay niebla.'])
    expect(extractNumbers(required[0])).toEqual([])
  })
})

describe('patrón: el recuento es apoyo opcional', () => {
  it('con una fracción, el apoyo lleva el N/M y el obligatorio se queda sin cifras', () => {
    const { claims, required } = buildDayClaims(planWith(slot([pattern(PRESENT_FOG)]))).dialogues[0]

    expect(claims).toHaveLength(2)
    expect(claims[1]).toBe('Hay niebla en 5 de los 6 lugares con dato del noroeste.')
    expect(required).toEqual(['En el noroeste hay niebla.'])
  })

  it('con la presencia uniforme no hay nada que contar', () => {
    const { claims } = buildDayClaims(planWith(slot([pattern(PRESENT_FOG, 'region:northwest', { eligible: 6, affected: 6 })]))).dialogues[0]

    expect(claims).toEqual(['En el noroeste hay niebla.'])
  })

  it('la nieve ausente también admite apoyo', () => {
    const { claims } = buildDayClaims(
      planWith(slot([pattern({ family: 'occurrence', phenomenon: 'nieve', polarity: 'ausente' }, 'region:northwest', { eligible: 6, affected: 2 })])),
    ).dialogues[0]

    expect(claims[1]).toBe('Sin acumulación de nieve en 2 de los 6 lugares con dato del noroeste.')
  })

  it('el cielo con fracción lleva su apoyo', () => {
    const { claims } = buildDayClaims(planWith(slot([pattern({ family: 'sky', value: 'cubierto' }, 'map', { eligible: 74, affected: 40 })]))).dialogues[0]

    expect(claims[1]).toBe('Hay cielo cubierto en 40 de los 74 lugares con dato del mapa.')
  })

  it('la banda térmica no tiene apoyo: contarla obligaría a nombrar el corte', () => {
    const { claims } = buildDayClaims(
      planWith(slot([pattern({ family: 'temperature', extreme: 'highest' }, 'region:southwest', { eligible: 10, affected: 4 })])),
    ).dialogues[0]

    expect(claims).toHaveLength(1)
  })

  it('las cifras del apoyo quedan autorizadas sin acumularlas a mano', () => {
    const { allowed } = buildDayClaims(planWith(slot([pattern(PRESENT_FOG)]))).dialogues[0]

    expect(allowed.numbers).toEqual([5, 6])
  })
})

describe('obligatorios: solo el hecho que ocupa el rol del parte', () => {
  it('el hecho del rol queda marcado como obligatorio', () => {
    const { claims, required } = buildDayClaims(planWith(slot([dayShape(7, 2)]))).dialogues[0]

    expect(required).toEqual(claims)
  })

  it('con un patrón, solo el claim mínimo es obligatorio y el apoyo no', () => {
    const { claims, required } = buildDayClaims(planWith(slot([pattern(PRESENT_FOG)]))).dialogues[0]

    expect(required).toEqual([claims[0]])
    expect(required).not.toContain(claims[1])
  })

  it('los hechos de relleno del hueco no son obligatorios', () => {
    const { claims, required } = buildDayClaims(planWith(slot([pattern(PRESENT_FOG), dayShape(7, 2)]))).dialogues[0]

    expect(claims).toHaveLength(3)
    expect(required).toEqual([claims[0]])
  })
})

describe('extractNumbers', () => {
  it('lee enteros y decimales con coma o con punto', () => {
    expect(extractNumbers('12,4 mm y 3.5 m en 74 lugares')).toEqual([12.4, 3.5, 74])
  })

  it('un rango son dos cifras: así se ve un 10-30 °C que no tocaba', () => {
    expect(extractNumbers('la noche más fría: 10-30 °C')).toEqual([10, 30])
  })

  it('sin cifras, lista vacía', () => {
    expect(extractNumbers('Vaya, esto merece una anotación.')).toEqual([])
  })
})
