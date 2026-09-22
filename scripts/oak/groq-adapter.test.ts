import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POKEMON_LABELS } from '../../src/domain/pokemon-labels.ts'
import { buildDayClaims } from '../../src/domain/oak/claims.ts'
import type { DayPlan, DialoguePlan } from '../../src/domain/oak/plan-dialogues.ts'
import type { NarrativeFact, PokemonSpotlightFact } from '../../src/domain/oak/types.ts'
import { DEFAULT_MODEL, GROQ_ENDPOINT, buildPromptPayload, generateOakDialogues } from './groq-adapter.ts'

const TODAY = '2026-09-18'

const spotlight: PokemonSpotlightFact = {
  kind: 'pokemon_spotlight',
  pokemonId: 'gyarados-mega',
  label: POKEMON_LABELS['gyarados-mega'],
  locations: [{ locationId: 'gijon', locationName: 'Gijón', mapPokemonId: 'gyarados-mega' }],
  locationCount: 2,
}

const alert: NarrativeFact = {
  kind: 'alert',
  level: 'naranja',
  phenomenon: 'lluvia',
  sourcePhenomenon: 'Lluvias persistentes',
  officialZoneId: '645301',
  source: 'aemet',
  affectedLocations: [{ locationId: 'ibiza', locationName: 'Ibiza' }],
  affectedLocationCount: 1,
}

const rain: NarrativeFact = {
  kind: 'rain',
  locationId: 'ibiza',
  locationName: 'Ibiza',
  mapPokemonId: 'zapdos',
  mapRepresentsFact: false,
  mm: 7.6,
  probabilityPercent: 100,
}

const dialoguePlan: DialoguePlan = [
  { id: 'dialogue-1', role: 'apertura', tone: 'neutral', facts: [{ kind: 'day_shape', totalLocations: 74, rainingLocations: 23, alertedLocations: 6, distinctPokemonCount: 10 }], leitmotif: null },
  { id: 'dialogue-2', role: 'foco', tone: 'consejo', facts: [alert, rain], leitmotif: null },
  { id: 'dialogue-3', role: 'cierre', tone: 'guasa', facts: [spotlight], leitmotif: 'gyarados-mar' },
]

// Plan de transporte, montado a mano: existe para comprobar qué viaja y qué
// no. No es un día serio a propósito — con un aviso naranja el reparto real
// no habría elegido gag, y aquí hace falta uno para ver viajar su dirección
// editorial. La regla de los días serios se prueba donde se aplica, en
// `plan-dialogues.test.ts`.
const dayPlan: DayPlan = {
  date: TODAY,
  dayMode: 'parte',
  serious: false,
  focusPokemonId: null,
  leitmotif: 'gyarados-mar',
  dialoguePlan,
  historyEntry: { date: TODAY, focusPokemonId: null, leitmotifIds: ['gyarados-mar'] },
}

const VALID_TEXTS = [
  'Bien. Hoy hay 6 lugares bajo aviso y 23 con lluvia. Seguimos observando.',
  'Tenemos un aviso naranja por lluvia en Ibiza, y allí se esperan 7,6 mm.',
  'Yo miraría el mar desde una distancia prudente. Mega-Gyarados anda por Gijón.',
]

function completion(content: unknown, status = 200): Response {
  const body = typeof content === 'string' ? content : JSON.stringify(content)
  return new Response(JSON.stringify({ choices: [{ message: { content: body } }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function validPayload() {
  return { dialogues: VALID_TEXTS.map((text, index) => ({ id: `dialogue-${index + 1}`, text })) }
}

/** La misma respuesta válida con un solo texto cambiado. */
function replacing(index: number, text: string) {
  return { dialogues: validPayload().dialogues.map((dialogue, at) => (at === index ? { ...dialogue, text } : dialogue)) }
}

function mockFetch(implementation: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const spy = vi.fn(implementation)
  vi.stubGlobal('fetch', spy)
  return spy
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.stubEnv('GROQ_API_KEY', 'test-key-not-a-real-secret')
  vi.stubEnv('GROQ_MODEL', '')
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  warn.mockRestore()
})

describe('payload enviado a la IA', () => {
  const payload = buildPromptPayload(buildDayClaims(dayPlan))
  const serialized = JSON.stringify(payload)

  it('lleva solo el modo, la bandera de día serio y los tres huecos', () => {
    expect(Object.keys(payload).sort()).toEqual(['dayMode', 'dialogues', 'seriousDay'])
    expect(payload.dialogues).toHaveLength(3)
  })

  it('la bandera de día serio viaja resuelta, no deducida del modo', () => {
    expect(payload.seriousDay).toBe(false)
    expect(buildPromptPayload(buildDayClaims({ ...dayPlan, serious: true })).seriousDay).toBe(true)
  })

  it('cada hueco lleva su papel, su tono y sus claims, no sus hechos', () => {
    expect(payload.dialogues[2]).toMatchObject({ id: 'dialogue-3', role: 'cierre', tone: 'guasa' })
    expect(payload.dialogues[2].claims[0]).toContain('Mega-Gyarados aparece en 2 lugares del mapa')
    expect(serialized).not.toContain('"kind"')
  })

  it('el leitmotiv viaja con su dirección editorial, no como un identificador suelto', () => {
    expect(payload.dialogues[2].leitmotif?.id).toBe('gyarados-mar')
    expect(payload.dialogues[2].leitmotif?.direction).toContain('distancia prudente')
    expect(payload.dialogues[0].leitmotif).toBeNull()
  })

  it('el nombre humano va resuelto: el modelo no tiene que deducirlo del id', () => {
    expect(serialized).toContain('Mega-Gyarados')
    expect(serialized).not.toContain('gyarados-mega')
  })

  it('no viaja la trazabilidad del aviso', () => {
    expect(serialized).not.toContain('645301')
    expect(serialized).not.toContain('aemet')
    expect(serialized).not.toContain('Lluvias persistentes')
  })

  it('no viaja el Pokémon del mapa de un hecho meteorológico: no hay por dónde nombrarlo', () => {
    expect(serialized).not.toContain('zapdos')
    expect(serialized).not.toContain('mapRepresentsFact')
  })

  it('no viaja el forecast, ni el historial, ni la entrada de historial', () => {
    expect(serialized).not.toContain('historyEntry')
    expect(serialized).not.toContain('locationId')
    expect(serialized).not.toContain('focusPokemonId')
  })

  it('no viaja la fecha: Oak no la dice y solo aportaría dígitos prohibidos', () => {
    expect(serialized).not.toContain(TODAY)
  })

  it('no viaja el recuento de Pokémon distintos: decidimos no contarlo', () => {
    expect(payload.dialogues[0].claims.join(' ')).not.toContain('10')
    expect(serialized).not.toContain('distinctPokemonCount')
  })
})

describe('petición', () => {
  it('una sola llamada, al endpoint de chat completions', async () => {
    const spy = mockFetch(() => completion(validPayload()))
    await generateOakDialogues(dayPlan)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe(GROQ_ENDPOINT)
  })

  it('modelo por defecto y modelo configurable por entorno', async () => {
    const spy = mockFetch(() => completion(validPayload()))

    await generateOakDialogues(dayPlan)
    expect(JSON.parse(String(spy.mock.calls[0][1].body)).model).toBe(DEFAULT_MODEL)

    vi.stubEnv('GROQ_MODEL', 'openai/gpt-oss-20b')
    await generateOakDialogues(dayPlan)
    expect(JSON.parse(String(spy.mock.calls[1][1].body)).model).toBe('openai/gpt-oss-20b')
  })

  it('pide salida estructurada estricta, sin herramientas y sin streaming', async () => {
    const spy = mockFetch(() => completion(validPayload()))
    await generateOakDialogues(dayPlan)
    const body = JSON.parse(String(spy.mock.calls[0][1].body))

    expect(body.response_format.type).toBe('json_schema')
    expect(body.response_format.json_schema.strict).toBe(true)
    expect(body.response_format.json_schema.schema.additionalProperties).toBe(false)
    expect(body.response_format.json_schema.schema.properties.dialogues.items.additionalProperties).toBe(false)
    expect(body.response_format.json_schema.schema.properties.dialogues.items.required).toEqual(['id', 'text'])
    expect(body.stream).toBe(false)
    expect(body.reasoning_effort).toBe('low')
    expect(body.tools).toBeUndefined()
  })

  it('usa max_completion_tokens, no el deprecado max_tokens', async () => {
    const spy = mockFetch(() => completion(validPayload()))
    await generateOakDialogues(dayPlan)
    const body = JSON.parse(String(spy.mock.calls[0][1].body))

    expect(body.max_completion_tokens).toBeGreaterThan(0)
    expect(body.max_tokens).toBeUndefined()
  })

  it('el system prompt lleva el personaje, los cinco tonos y la política de días serios', async () => {
    const spy = mockFetch(() => completion(validPayload()))
    await generateOakDialogues(dayPlan)
    const system = JSON.parse(String(spy.mock.calls[0][1].body)).messages[0]

    expect(system.role).toBe('system')
    expect(system.content).toContain('Profesor Oak')
    expect(system.content).toContain('DÍAS SERIOS')
    expect(system.content).toContain('seriousDay')
    for (const tone of ['neutral', 'cientifico', 'epico', 'consejo', 'guasa']) {
      expect(system.content).toContain(`- ${tone}:`)
    }
  })

  it('la clave viaja en la cabecera y en ningún otro sitio', async () => {
    const spy = mockFetch(() => completion(validPayload()))
    await generateOakDialogues(dayPlan)
    const [url, init] = spy.mock.calls[0]

    expect(url).not.toContain('test-key-not-a-real-secret')
    expect(String(init.body)).not.toContain('test-key-not-a-real-secret')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-key-not-a-real-secret')
  })
})

describe('respuesta válida', () => {
  it('devuelve los tres textos exactos y en orden', async () => {
    mockFetch(() => completion(validPayload()))
    const dialogues = await generateOakDialogues(dayPlan)

    expect(dialogues?.map((dialogue) => dialogue.id)).toEqual(['dialogue-1', 'dialogue-2', 'dialogue-3'])
    expect(dialogues?.map((dialogue) => dialogue.text)).toEqual(VALID_TEXTS)
  })
})

describe('todo lo que cae al fallback', () => {
  const tooShort = { dialogues: validPayload().dialogues.map((dialogue, index) => (index === 0 ? { ...dialogue, text: 'Hola.' } : dialogue)) }
  const tooLong = { dialogues: validPayload().dialogues.map((dialogue, index) => (index === 1 ? { ...dialogue, text: 'x'.repeat(161) } : dialogue)) }
  const reversed = { dialogues: [...validPayload().dialogues].reverse() }
  const extraField = { dialogues: validPayload().dialogues.map((dialogue) => ({ ...dialogue, mode: 'alerta' })) }
  const extraRoot = { ...validPayload(), reasoning: 'porque sí' }

  const cases: { name: string; respond: () => Promise<Response> | Response }[] = [
    { name: 'HTTP 429', respond: () => new Response('rate limited', { status: 429 }) },
    { name: 'HTTP 500', respond: () => new Response('boom', { status: 500 }) },
    { name: 'error de red', respond: () => Promise.reject(new TypeError('fetch failed')) },
    {
      name: 'timeout',
      respond: () => {
        const error = new Error('The operation was aborted due to timeout')
        error.name = 'TimeoutError'
        return Promise.reject(error)
      },
    },
    { name: 'sin content', respond: () => new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }) },
    { name: 'choices vacío', respond: () => new Response(JSON.stringify({ choices: [] }), { status: 200 }) },
    { name: 'cuerpo que no es JSON', respond: () => new Response('<html>502</html>', { status: 200 }) },
    { name: 'content que no es JSON', respond: () => completion('esto no es json') },
    { name: 'dos diálogos en vez de tres', respond: () => completion({ dialogues: validPayload().dialogues.slice(0, 2) }) },
    { name: 'ids en orden invertido', respond: () => completion(reversed) },
    { name: 'texto demasiado corto', respond: () => completion(tooShort) },
    { name: 'texto demasiado largo', respond: () => completion(tooLong) },
    { name: 'campo extra en un diálogo', respond: () => completion(extraField) },
    { name: 'campo extra en la raíz', respond: () => completion(extraRoot) },
    { name: 'texto vacío', respond: () => completion({ dialogues: validPayload().dialogues.map((d) => ({ ...d, text: '' })) }) },
    { name: 'text que no es cadena', respond: () => completion({ dialogues: validPayload().dialogues.map((d) => ({ ...d, text: 42 })) }) },
    // La forma es correcta y el contenido no: una respuesta que se inventa
    // una entidad es tan inválida como una que llega torcida.
    { name: 'una cifra que no estaba en los claims', respond: () => completion(replacing(0, 'Bien. Hoy hay 6 lugares bajo aviso y 40 con lluvia. Seguimos observando.')) },
    { name: 'un lugar que no estaba en los claims', respond: () => completion(replacing(1, 'Tenemos un aviso naranja por lluvia en Ibiza, y en Teruel se esperan 7,6 mm.')) },
    { name: 'un Pokémon que no estaba en los claims', respond: () => completion(replacing(2, 'Yo miraría el mar desde lejos. Snorunt anda por Gijón, como siempre.')) },
    { name: 'un nivel de aviso que no estaba en los claims', respond: () => completion(replacing(1, 'Tenemos un aviso rojo por lluvia en Ibiza, y allí se esperan 7,6 mm.')) },
  ]

  it.each(cases)('$name → null', async ({ respond }) => {
    mockFetch(() => respond())

    expect(await generateOakDialogues(dayPlan)).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Oak AI unavailable/invalid'))
  })

  it.each(['', '   ', '\t\n'])('una GROQ_API_KEY en blanco (%j) es no tenerla: nadie recibe un Bearer de espacios', async (value) => {
    vi.stubEnv('GROQ_API_KEY', value)
    const spy = mockFetch(() => completion(validPayload()))

    expect(await generateOakDialogues(dayPlan)).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('un GROQ_MODEL en blanco cae al modelo por defecto en vez de pedir el modelo ""', async () => {
    vi.stubEnv('GROQ_MODEL', '   ')
    const spy = mockFetch(() => completion(validPayload()))
    await generateOakDialogues(dayPlan)

    expect(JSON.parse(String(spy.mock.calls[0][1].body)).model).toBe(DEFAULT_MODEL)
  })

  it('un GROQ_MODEL con espacios alrededor se usa recortado', async () => {
    vi.stubEnv('GROQ_MODEL', '  openai/gpt-oss-20b  ')
    const spy = mockFetch(() => completion(validPayload()))
    await generateOakDialogues(dayPlan)

    expect(JSON.parse(String(spy.mock.calls[0][1].body)).model).toBe('openai/gpt-oss-20b')
  })

  it('nunca reintenta: un fallo es un fallo', async () => {
    const spy = mockFetch(() => new Response('rate limited', { status: 429 }))
    await generateOakDialogues(dayPlan)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('el motivo se registra, pero la clave no aparece en el log', async () => {
    mockFetch(() => new Response('nope', { status: 401 }))
    await generateOakDialogues(dayPlan)

    const logged = warn.mock.calls.flat().join(' ')
    expect(logged).toContain('HTTP 401')
    expect(logged).not.toContain('test-key-not-a-real-secret')
  })
})
