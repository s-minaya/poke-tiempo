import { describe, expect, it } from 'vitest'

import type { PokedexId } from '../pokedex.ts'
import { POKEMON_LABELS } from '../pokemon-labels.ts'
import { POKEMON_NAMES } from '../pokemon-names.ts'
import { generateFallbackDialogues } from './fallback-dialogues.ts'
import type { LeitmotifId } from './leitmotifs.ts'
import { LEITMOTIFS } from './leitmotifs.ts'
import type { DayPlan, DialoguePlan, DialogueSlot, Tone } from './plan-dialogues.ts'
import type { AlertFact, CalendarFact, DayShapeFact, NarrativeFact, PokemonSpotlightFact } from './types.ts'

const TODAY = '2026-09-18'
const MIN = 20
const MAX = 160

// --- hechos de prueba ------------------------------------------------------

const dayShape: DayShapeFact = {
  kind: 'day_shape',
  totalLocations: 74,
  rainingLocations: 23,
  alertedLocations: 6,
  distinctPokemonCount: 10,
}

const calendar: CalendarFact = { kind: 'calendar', date: TODAY, weekday: 'sabado', weekend: true }

function place(locationName: string) {
  return { locationId: locationName.toLowerCase(), locationName }
}

function mapPlace(locationName: string, mapPokemonId: PokedexId) {
  return { ...place(locationName), mapPokemonId }
}

function spotlight(pokemonId: PokedexId, locationCount: number, names: string[] = ['Ourense', 'Huesca', 'Jaca']): PokemonSpotlightFact {
  return {
    kind: 'pokemon_spotlight',
    pokemonId,
    label: POKEMON_LABELS[pokemonId],
    locations: names.map((name) => mapPlace(name, pokemonId)),
    locationCount,
  }
}

function rain(mm: number, probabilityPercent: number | null, options: { locationName?: string; mapPokemonId?: PokedexId; mapRepresentsFact?: boolean } = {}): NarrativeFact {
  return {
    kind: 'rain',
    ...mapPlace(options.locationName ?? 'Ibiza', options.mapPokemonId ?? 'castform-rain'),
    mapRepresentsFact: options.mapRepresentsFact ?? true,
    mm,
    probabilityPercent,
  }
}

function wind(speedKmh: number, gustKmh: number | null, warm = false): NarrativeFact {
  return { kind: 'wind', ...mapPlace('Tarifa', 'hoppip'), mapRepresentsFact: true, speedKmh, gustKmh, warm }
}

function alert(level: AlertFact['level'], overrides: Partial<AlertFact> = {}): AlertFact {
  return {
    kind: 'alert',
    level,
    phenomenon: 'lluvia',
    sourcePhenomenon: 'Lluvias y tormentas persistentes',
    officialZoneId: '645301',
    source: 'aemet',
    affectedLocations: [place('Ibiza')],
    affectedLocationCount: 1,
    ...overrides,
  }
}

/** Un hecho de cada uno de los doce `kind`, para poder recorrerlos todos. */
const ONE_PER_KIND: Record<NarrativeFact['kind'], NarrativeFact> = {
  temperature: { kind: 'temperature', ...mapPlace('Sevilla', 'charmander'), mapRepresentsFact: true, role: 'hottest', maxC: 33.2, minC: 21 },
  rain: rain(7.6, 100),
  snow: { kind: 'snow', ...mapPlace('Benasque', 'cryogonal'), mapRepresentsFact: true, cm: 12.5 },
  wind: wind(45, 70),
  storm: { kind: 'storm', ...mapPlace('Teruel', 'zapdos'), mapRepresentsFact: true },
  fog: { kind: 'fog', ...mapPlace('Burgos', 'castform-ice'), mapRepresentsFact: true },
  calima: { kind: 'calima', ...mapPlace('Las Palmas', 'hippowdon'), mapRepresentsFact: true, fromAlert: true },
  marine: { kind: 'marine', ...mapPlace('Gijón', 'gyarados-mega'), mapRepresentsFact: true, waveHeightM: 2.7, wavePeriodS: 12.8 },
  alert: alert('naranja'),
  pokemon_spotlight: spotlight('charmander', 21),
  day_shape: dayShape,
  calendar,
}

// --- utilidades ------------------------------------------------------------

function slot(id: DialogueSlot['id'], role: DialogueSlot['role'], facts: NarrativeFact[], tone: Tone = 'neutral', leitmotif: LeitmotifId | null = null): DialogueSlot {
  return { id, role, tone, facts, leitmotif }
}

function dayPlan(dialoguePlan: DialoguePlan, date = TODAY): DayPlan {
  return {
    date,
    dayMode: 'parte',
    focusPokemonId: null,
    leitmotif: dialoguePlan[2].leitmotif,
    dialoguePlan,
    historyEntry: { date, focusPokemonId: null, leitmotifIds: [] },
  }
}

/** El plan más neutro posible, con los hechos bajo prueba en el hueco de apertura. */
function planWith(facts: NarrativeFact[], options: { tone?: Tone; leitmotif?: LeitmotifId | null; date?: string } = {}): DayPlan {
  return dayPlan(
    [
      slot('dialogue-1', 'apertura', facts, options.tone ?? 'neutral', options.leitmotif ?? null),
      slot('dialogue-2', 'foco', [spotlight('kyogre', 9)]),
      slot('dialogue-3', 'cierre', [dayShape]),
    ],
    options.date ?? TODAY,
  )
}

/** El texto que produce un hueco concreto, aislado del resto del día. */
function render(facts: NarrativeFact[], options: { tone?: Tone; leitmotif?: LeitmotifId | null; date?: string } = {}): string {
  return generateFallbackDialogues(planWith(facts, options))[0].text
}

// --- contrato --------------------------------------------------------------

describe('contrato de salida', () => {
  const dialogues = generateFallbackDialogues(planWith([dayShape, calendar]))

  it('siempre exactamente tres diálogos', () => {
    expect(dialogues).toHaveLength(3)
  })

  it('conserva los tres id del plan, en orden', () => {
    expect(dialogues.map((dialogue) => dialogue.id)).toEqual(['dialogue-1', 'dialogue-2', 'dialogue-3'])
  })

  it('no añade ningún campo al contrato', () => {
    for (const dialogue of dialogues) {
      expect(Object.keys(dialogue).sort()).toEqual(['id', 'text'])
    }
  })

  it('los tres textos caben en 20–160 caracteres', () => {
    for (const dialogue of dialogues) {
      expect(dialogue.text.length).toBeGreaterThanOrEqual(MIN)
      expect(dialogue.text.length).toBeLessThanOrEqual(MAX)
    }
  })

  it('ninguno queda cortado a media frase', () => {
    for (const dialogue of dialogues) {
      expect(dialogue.text.trimEnd()).toMatch(/[.!?]$/)
    }
  })
})

describe('determinismo', () => {
  it('mismo DayPlan, mismos textos', () => {
    const first = generateFallbackDialogues(planWith([dayShape, calendar]))

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(generateFallbackDialogues(planWith([dayShape, calendar]))).toEqual(first)
    }
  })

  it('fechas distintas pueden caer en variantes distintas', () => {
    const dates = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']
    const texts = new Set(dates.map((date) => render([spotlight('charmander', 21)], { date })))

    expect(texts.size).toBeGreaterThan(1)
  })

  it('no depende del reloj ni del azar: dos ejecuciones separadas coinciden carácter a carácter', () => {
    expect(render([ONE_PER_KIND.marine])).toBe(render([ONE_PER_KIND.marine]))
  })
})

// --- las doce cláusulas ----------------------------------------------------

describe('los doce kind', () => {
  const kinds = Object.keys(ONE_PER_KIND) as NarrativeFact['kind'][]

  it('son doce, ni uno más: no han vuelto sky ni contrast', () => {
    expect(kinds).toHaveLength(12)
    expect(kinds).not.toContain('sky')
    expect(kinds).not.toContain('contrast')
  })

  it.each(kinds)('%s produce un texto válido', (kind) => {
    const text = render([ONE_PER_KIND[kind]])

    expect(text.length).toBeGreaterThanOrEqual(MIN)
    expect(text.length).toBeLessThanOrEqual(MAX)
  })
})

describe('temperatura', () => {
  const base = { kind: 'temperature', ...mapPlace('Oviedo', 'hoppip'), mapRepresentsFact: true, maxC: 19.3, minC: 8.4 } as const

  it('hottest habla de la máxima más alta y con su valor', () => {
    const text = render([{ ...base, role: 'hottest', ...mapPlace('Sevilla', 'charmander'), maxC: 33, minC: 21 }])

    expect(text).toContain('Sevilla')
    expect(text).toContain('33 °C')
    expect(text.toLowerCase()).toContain('máxima')
  })

  it('coldest_day es la máxima más baja, no la mínima', () => {
    const text = render([{ ...base, role: 'coldest_day' }])

    expect(text).toContain('19,3 °C')
    expect(text).not.toContain('8,4')
    expect(text.toLowerCase()).toContain('máxima')
  })

  it('coldest_night usa la mínima y habla de la noche', () => {
    const text = render([{ ...base, role: 'coldest_night' }])

    expect(text).toContain('8,4 °C')
    expect(text).not.toContain('19,3')
    expect(text.toLowerCase()).toMatch(/noche|mínima/)
  })

  it('no inventa calificativos que el hecho no trae', () => {
    const text = render([{ ...base, role: 'hottest', maxC: 44.1, minC: 30 }])

    expect(text.toLowerCase()).not.toMatch(/abrasador|infernal|helador|insoportable/)
  })
})

describe('lluvia', () => {
  it('dice los milímetros con coma decimal, sin arrastrar flotante', () => {
    expect(render([rain(7.6000000001, 100)])).toContain('7,6 mm')
  })

  it('la probabilidad se cuenta como probabilidad, nunca como certeza', () => {
    const text = render([rain(4.2, 60)])

    expect(text).toContain('60 %')
    expect(text.toLowerCase()).not.toMatch(/seguro|con toda seguridad|va a llover sin/)
  })

  it('sin probabilidad no aparece ningún porcentaje ni hueco raro', () => {
    const text = render([rain(4.2, null)])

    expect(text).not.toContain('%')
    expect(text).not.toContain('null')
    expect(text).not.toMatch(/\s,|\s{2}/)
  })
})

describe('nieve', () => {
  it('usa los centímetros tal cual, sin convertirlos en riesgo', () => {
    const text = render([{ kind: 'snow', ...mapPlace('Benasque', 'abomasnow'), mapRepresentsFact: true, cm: 20 }])

    expect(text).toContain('20 cm')
    expect(text).toContain('Benasque')
    expect(text.toLowerCase()).not.toMatch(/aviso|peligro|riesgo/)
  })
})

describe('viento', () => {
  it('con racha, la dice', () => {
    expect(render([wind(45, 70)])).toContain('70 km/h')
  })

  it('sin racha, no la menciona', () => {
    const text = render([wind(45, null)])

    expect(text).toContain('45 km/h')
    expect(text.toLowerCase()).not.toContain('racha')
    expect(text).not.toContain('null')
  })

  it('warm permite hablar de viento cálido; sin warm, no', () => {
    expect(render([wind(45, null, true)]).toLowerCase()).toContain('cálido')
    expect(render([wind(45, null, false)]).toLowerCase()).not.toContain('cálido')
  })

  it('no inventa dirección: no tenemos ese dato', () => {
    const text = render([wind(45, 70, false)]).toLowerCase()

    expect(text).not.toMatch(/norte|sur|levante|poniente|nordeste|noroeste|sureste|suroeste/)
  })
})

describe('tormenta, niebla y calima', () => {
  it('tormenta no se convierte en nivel de riesgo', () => {
    const text = render([ONE_PER_KIND.storm]).toLowerCase()

    expect(text).toContain('tormenta')
    expect(text).not.toMatch(/aviso|amarillo|naranja|rojo/)
  })

  it('niebla tampoco', () => {
    const text = render([ONE_PER_KIND.fog]).toLowerCase()

    expect(text).toContain('niebla')
    expect(text).not.toMatch(/aviso|peligro/)
  })

  it('calima con fromAlert puede citar el aviso oficial', () => {
    const text = render([{ kind: 'calima', ...mapPlace('Las Palmas', 'hippowdon'), mapRepresentsFact: true, fromAlert: true }])

    expect(text.toLowerCase()).toContain('aviso oficial')
  })

  it('calima sin fromAlert no puede decir que hay aviso', () => {
    const text = render([{ kind: 'calima', ...mapPlace('Las Palmas', 'hippowdon'), mapRepresentsFact: true, fromAlert: false }])

    expect(text.toLowerCase()).toContain('calima')
    expect(text.toLowerCase()).not.toContain('aviso')
  })
})

describe('marine', () => {
  it('altura siempre, periodo solo si existe', () => {
    const withPeriod = render([ONE_PER_KIND.marine])

    expect(withPeriod).toContain('2,7 m')
    expect(withPeriod).toContain('12,8 s')
  })

  it('sin periodo no aparece ningún segundo suelto', () => {
    const text = render([{ kind: 'marine', ...mapPlace('Gijón', 'gyarados'), mapRepresentsFact: true, waveHeightM: 1.4, wavePeriodS: null }])

    expect(text).toContain('1,4 m')
    // Ningún "12,8 s" suelto: el periodo no existe, así que no se nombra.
    expect(text).not.toMatch(/\d+(,\d+)? s(\s|$|[.,;])/)
    expect(text.toLowerCase()).not.toContain('periodo')
    expect(text).not.toContain('null')
  })

  it('no traduce la altura en una categoría de riesgo nueva', () => {
    const text = render([{ kind: 'marine', ...mapPlace('Gijón', 'gyarados-mega'), mapRepresentsFact: true, waveHeightM: 4.2, wavePeriodS: null }]).toLowerCase()

    expect(text).not.toMatch(/temporal|peligros|mar gruesa|extremo/)
  })
})

describe('avisos oficiales', () => {
  it.each(['amarillo', 'naranja', 'rojo'] as const)('conserva el nivel %s tal cual', (level) => {
    const text = render([alert(level)])
    const others = (['amarillo', 'naranja', 'rojo'] as const).filter((other) => other !== level)

    expect(text).toContain(level)
    for (const other of others) expect(text).not.toContain(other)
  })

  it('no imprime la trazabilidad: ni zona oficial, ni fuente, ni literal de origen', () => {
    const text = render([alert('naranja')])

    expect(text).not.toContain('645301')
    expect(text).not.toContain('aemet')
    expect(text).not.toContain('Lluvias y tormentas persistentes')
  })

  it('nombra a los afectados cuando son pocos', () => {
    const text = render([alert('amarillo', { affectedLocations: [place('Ibiza'), place('Palma')], affectedLocationCount: 2 })])

    expect(text).toContain('Ibiza')
    expect(text).toContain('Palma')
  })

  it('con más afectados que nombres, la lista es una muestra y no el total', () => {
    const text = render([alert('rojo', { affectedLocations: [place('Ibiza'), place('Palma')], affectedLocationCount: 9 })])

    expect(text).toContain('9 lugares')
    expect(text).toContain('entre ellos')
  })

  it('lo cuenta Oak, no el organismo: nada de lenguaje administrativo', () => {
    const texts = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'].map((date) => render([alert('naranja')], { date }).toLowerCase())

    for (const text of texts) {
      expect(text).toContain('aviso')
      expect(text).not.toMatch(/se ha emitido|queda emitido|emisión|en vigor desde/)
    }
  })

  it('no inventa instrucciones oficiales que nuestros datos no traen', () => {
    const text = render([alert('rojo')], { tone: 'consejo' }).toLowerCase()

    expect(text).not.toMatch(/no salgas|evacu|quédate en casa|protección civil|112/)
  })
})

describe('spotlight de Pokémon', () => {
  it('usa el nombre humano, nunca el id crudo', () => {
    const text = render([spotlight('gyarados-mega', 2, ['Gijón', 'Cantabria'])])

    expect(text).toContain('Mega-Gyarados')
    expect(text).not.toContain('gyarados-mega')
  })

  it('las cuatro formas de Castform se llaman Castform, sin sufijo de forma inventado', () => {
    for (const id of ['castform', 'castform-sun', 'castform-rain', 'castform-ice'] as PokedexId[]) {
      const text = render([spotlight(id, 4)])

      expect(text).toContain('Castform')
      expect(text).not.toMatch(/forma (sol|lluvia|nieve)/i)
    }
  })

  it('un nombre compartido se aclara con su etiqueta entre paréntesis, y así las cuatro se distinguen', () => {
    const ids: PokedexId[] = ['castform', 'castform-sun', 'castform-rain', 'castform-ice']
    const texts = ids.map((id) => render([spotlight(id, 4)]))

    for (const [index, id] of ids.entries()) {
      expect(texts[index]).toContain(`Castform (${POKEMON_LABELS[id]})`)
    }
    expect(new Set(texts).size).toBe(ids.length)
  })

  it('un nombre inequívoco no lleva aclaración: la etiqueta no se verbaliza porque sí', () => {
    for (const id of ['charmander', 'abomasnow', 'groudon', 'kyogre'] as PokedexId[]) {
      const text = render([spotlight(id, 4)])

      expect(text).not.toContain('(')
      expect(text.toLowerCase()).not.toContain(POKEMON_LABELS[id].toLowerCase())
    }
  })

  it('la etiqueta nunca se interpola como sintagma: solo aparece entre paréntesis o anunciada', () => {
    for (const id of ['castform', 'castform-sun', 'castform-rain', 'castform-ice'] as PokedexId[]) {
      const label = POKEMON_LABELS[id].toLowerCase()
      const text = render([spotlight(id, 4)]).toLowerCase()

      expect(text).not.toMatch(new RegExp(`(con|de|va de|le toca) ${label}`))
    }
  })

  it('con más lugares que nombres, la lista se presenta como muestra', () => {
    const text = render([spotlight('charmander', 21)])

    expect(text).toContain('21 lugares')
    expect(text).toContain('entre ellos')
    expect(text).not.toContain('solo')
  })

  it('con el recuento completo, la lista sí puede ser la lista', () => {
    const text = render([spotlight('charmander', 3)])

    expect(text).toContain('Ourense')
    expect(text).not.toContain('entre ellos')
  })

  it('"solo" se reserva al único caso que lo justifica: un lugar', () => {
    const text = render([spotlight('abomasnow', 1, ['Benasque'])])

    expect(text).toContain('solo')
    expect(text).toContain('Benasque')
  })

  it('en frase conversacional se dice "solo", no "únicamente"', () => {
    const texts = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'].map((date) => render([spotlight('abomasnow', 1, ['Benasque'])], { date }))

    for (const text of texts) expect(text).not.toContain('únicamente')
  })

  it('un lugar no se escribe nunca como "1 lugares"', () => {
    expect(render([spotlight('abomasnow', 1, ['Benasque'])])).not.toContain('1 lugares')
  })
})

describe('forma del día y calendario', () => {
  it('no vuelca los cuatro recuentos en la misma frase', () => {
    const text = render([dayShape])
    const numbers = ['74', '23', '6', '10'].filter((value) => text.includes(value))

    expect(numbers.length).toBeLessThanOrEqual(2)
  })

  it('un día sin lluvia ni avisos no produce recuentos raros', () => {
    const quiet: DayShapeFact = { kind: 'day_shape', totalLocations: 74, rainingLocations: 0, alertedLocations: 0, distinctPokemonCount: 4 }
    const texts = new Set(['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22'].map((date) => render([quiet], { date })))

    for (const text of texts) {
      expect(text).not.toMatch(/\b0 (lugares|de los)/)
      expect(text.length).toBeGreaterThanOrEqual(MIN)
    }
  })

  it('el calendario dice el día de la semana, con tilde y sin efemérides', () => {
    const text = render([{ kind: 'calendar', date: '2026-09-16', weekday: 'miercoles', weekend: false }])

    expect(text).toContain('miércoles')
    expect(text).not.toContain('miercoles')
    expect(text.toLowerCase()).not.toMatch(/santo|festiv|otoño|verano|equinoccio/)
  })
})

// --- las reglas que más duelen si se rompen --------------------------------

describe('mapRepresentsFact', () => {
  it('en false, el Pokémon visible no se lleva el fenómeno', () => {
    const text = render([rain(6.4, 90, { mapPokemonId: 'zapdos', mapRepresentsFact: false })])

    expect(text).toContain('6,4 mm')
    expect(text).not.toContain('Zapdos')
    expect(text).not.toContain('zapdos')
  })

  it('tampoco en true se afirma que el Pokémon salga por culpa del fenómeno', () => {
    const text = render([rain(6.4, 90, { mapPokemonId: 'castform-rain', mapRepresentsFact: true })])

    expect(text.toLowerCase()).not.toMatch(/porque|por culpa|a causa/)
  })

  it('el Pokémon se nombra por el spotlight, que es el hecho que existe para eso', () => {
    expect(render([spotlight('kyogre', 5)])).toContain('Kyogre')
  })
})

describe('composición de dos hechos', () => {
  const two = [alert('naranja'), rain(7.6, 100)]

  it('no pierde ninguno de los dos', () => {
    const text = render(two)

    expect(text).toContain('naranja')
    expect(text).toContain('7,6 mm')
  })

  it('los une en vez de soltar dos frases sueltas', () => {
    const text = render(two)

    expect(text).toMatch(/ y |; además, | mientras /)
  })

  it('no repite el lugar dos veces en la misma frase', () => {
    const text = render(two)

    expect(text.split('Ibiza')).toHaveLength(2)
  })

  it('no inventa causa entre los dos', () => {
    const text = render([ONE_PER_KIND.temperature, wind(30, null)]).toLowerCase()

    expect(text).not.toMatch(/porque|así que|por eso|debido a/)
  })
})

describe('longitud', () => {
  const longNames = ['Santa Cruz de la Palma', 'Villanueva de la Serena', 'San Sebastián de los Reyes']

  it('un hueco muy cargado usa una formulación compacta en vez de cortar', () => {
    const text = render([spotlight('kyogre-primal', 31, longNames), rain(7.6, 100, { locationName: 'Santiago de Compostela' })], { tone: 'consejo' })

    expect(text.length).toBeLessThanOrEqual(MAX)
    expect(text.trimEnd()).toMatch(/[.!?]$/)
    // Se cae el detalle opcional (la muestra de lugares), nunca el hecho.
    expect(text).toContain('31 lugares')
    expect(text).toContain('7,6 mm')
    expect(text).not.toContain('San Sebastián de los Reyes')
  })

  it('un hueco mínimo sigue llegando al suelo de 20 caracteres', () => {
    const text = render([{ kind: 'fog', ...mapPlace('Lugo', 'castform-ice'), mapRepresentsFact: true }])

    expect(text.length).toBeGreaterThanOrEqual(MIN)
  })

  it('si ni la formulación más compacta cabe, es un error, no un recorte', () => {
    // El hecho principal no cabe ni dicho de la forma más corta posible: no
    // hay nada que recortar sin mentir, así que se falla en vez de publicar.
    const unspeakable: NarrativeFact = { kind: 'fog', ...mapPlace('X'.repeat(400), 'castform-ice'), mapRepresentsFact: true }

    expect(() => render([unspeakable])).toThrow(/no sabe redactar/)
  })
})

// --- gags ------------------------------------------------------------------

describe('leitmotivs', () => {
  const supporting: Record<LeitmotifId, PokedexId> = {
    'hoppip-vuela': 'hoppip',
    'castform-vestuario': 'castform-ice',
    'groudon-termostato': 'groudon',
    'gyarados-mar': 'gyarados',
    'snorunt-frio': 'snorunt',
  }

  it('los cinco del catálogo tienen redacción', () => {
    expect(Object.keys(supporting).sort()).toEqual(LEITMOTIFS.map((leitmotif) => leitmotif.id).sort())
  })

  it.each(LEITMOTIFS.map((leitmotif) => leitmotif.id))('%s produce un cierre con gag y con su hecho', (id) => {
    const pokemonId = supporting[id]
    const text = render([spotlight(pokemonId, 6)], { tone: 'guasa', leitmotif: id })

    expect(text.length).toBeGreaterThanOrEqual(MIN)
    expect(text.length).toBeLessThanOrEqual(MAX)
    // El dato del hecho sobrevive al chiste.
    expect(text).toContain('6 lugares')
  })

  it('mismo gag y misma fecha, misma variante', () => {
    const once = render([spotlight('hoppip', 6)], { tone: 'guasa', leitmotif: 'hoppip-vuela' })

    expect(render([spotlight('hoppip', 6)], { tone: 'guasa', leitmotif: 'hoppip-vuela' })).toBe(once)
  })

  it('fechas distintas pueden contar el mismo gag de otra manera', () => {
    const dates = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23']
    const texts = new Set(dates.map((date) => render([spotlight('hoppip', 6)], { tone: 'guasa', leitmotif: 'hoppip-vuela', date })))

    expect(texts.size).toBeGreaterThan(1)
  })

  it('el gag no introduce ningún dato nuevo: solo aparece el Pokémon que lo sostiene', () => {
    const text = render([spotlight('snorunt', 6)], { tone: 'guasa', leitmotif: 'snorunt-frio' })
    const otherNames = Object.entries(POKEMON_NAMES)
      .filter(([id]) => id !== 'snorunt')
      .map(([, name]) => name)
      .filter((name) => name !== 'Snorunt')

    for (const name of otherNames) expect(text).not.toContain(name)
  })

  it('no repite el nombre del Pokémon que el chiste ya ha dicho', () => {
    const text = render([spotlight('castform-ice', 4)], { tone: 'guasa', leitmotif: 'castform-vestuario' })

    expect(text.split('Castform')).toHaveLength(2)
  })

  it('con nombre compartido, el chiste anuncia la etiqueta en vez de repetir el nombre', () => {
    const text = render([spotlight('castform-ice', 4)], { tone: 'guasa', leitmotif: 'castform-vestuario' })

    expect(text).toContain('Niebla')
    expect(text).not.toContain('Castform (')
  })

  it('con nombre inequívoco, el chiste no necesita anunciar nada', () => {
    const text = render([spotlight('hoppip', 6)], { tone: 'guasa', leitmotif: 'hoppip-vuela' })

    expect(text).not.toContain('(')
    expect(text.toLowerCase()).not.toContain('viento moderado')
  })
})

describe('voz', () => {
  it('no abre los tres bocadillos del día con la misma muletilla', () => {
    const dialogues = generateFallbackDialogues(
      dayPlan([
        slot('dialogue-1', 'apertura', [dayShape]),
        slot('dialogue-2', 'foco', [spotlight('kyogre', 9)]),
        slot('dialogue-3', 'cierre', [spotlight('altaria', 18)]),
      ]),
    )
    const openers = dialogues.map((dialogue) => dialogue.text.split(/(?<=[.!?])\s/)[0]).filter((opener) => opener.length < 30)

    expect(new Set(openers).size).toBe(openers.length)
  })

  it('el tono consejo remata con prudencia, no con una orden', () => {
    const text = render([rain(18.4, 90)], { tone: 'consejo' }).toLowerCase()

    expect(text).toMatch(/cuidado|atento|preparado/)
  })

  it('el tono épico no recurre al catastrofismo', () => {
    const text = render([alert('rojo')], { tone: 'epico' }).toLowerCase()

    expect(text).not.toMatch(/catástrofe|desastre|tragedia|terrible|huid/)
  })

  it('no usa lenguaje de interfaz ni de depuración', () => {
    const everything = Object.values(ONE_PER_KIND).map((fact) => render([fact]).toLowerCase())

    for (const text of everything) {
      expect(text).not.toMatch(/etiqueta del día|etiqueta:|id:|kind|null|undefined/)
    }
  })

  it('habla de lugares, no de puntos: el mapa es un sitio, no una hoja de cálculo', () => {
    const everything = Object.values(ONE_PER_KIND).map((fact) => render([fact]).toLowerCase())

    for (const text of everything) {
      expect(text).not.toMatch(/\bpuntos?\b/)
    }
  })

  it('no habla como un boletín meteorológico', () => {
    const text = render([ONE_PER_KIND.temperature, rain(4.2, 60)]).toLowerCase()

    expect(text).not.toMatch(/tercio norte|cota de nieve|se esperan precipitaciones en|litoral peninsular/)
  })
})
