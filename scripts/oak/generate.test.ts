import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { OakHistoryEntry } from '../../src/domain/oak/history.ts'
import type { OakToday } from '../../src/domain/oak/oak-today.ts'
import type { DayPlan, OakDialogues } from '../../src/domain/oak/plan-dialogues.ts'
import { generateOak } from './generate.ts'

/**
 * El generador se prueba contra un directorio temporal: nunca toca
 * `src/data`, y nunca sale a la red — la IA entra inyectada.
 */

const REAL_FORECAST = join(import.meta.dirname, '../../src/data/forecast.json')
const FORECAST_JSON = readFileSync(REAL_FORECAST, 'utf-8')

/**
 * Las fechas salen del propio forecast, nunca escritas a mano: el commit
 * diario del bot reescribe `forecast.json` con la fecha de cada día, y una
 * constante aquí dejaría la suite roja a la mañana siguiente.
 */
const TARGET_DATE = (JSON.parse(FORECAST_JSON) as { date: string }).date

/** Aritmética de calendario pura sobre `YYYY-MM-DD`, sin zonas horarias. */
function plusDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

// Un instante cuyo "mañana" en Europe/Madrid es exactamente `TARGET_DATE`:
// mediodía UTC del día anterior, lejos de cualquier frontera de día tanto en
// UTC+1 como en UTC+2.
const NOW = new Date(`${plusDays(TARGET_DATE, -1)}T12:00:00.000Z`)

// Una semana después, para que el objetivo ya no case con el forecast.
const MISALIGNED_NOW = new Date(`${plusDays(TARGET_DATE, 6)}T12:00:00.000Z`)
const MISALIGNED_TARGET = plusDays(TARGET_DATE, 7)

const YESTERDAY = plusDays(TARGET_DATE, -1)
const TOMORROW = plusDays(TARGET_DATE, 1)

let dataDir: string

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'oak-generate-'))
  await writeFile(join(dataDir, 'forecast.json'), FORECAST_JSON, 'utf-8')
})

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

const noAi = async (): Promise<OakDialogues | null> => null

function aiReturning(texts: [string, string, string]) {
  return async (): Promise<OakDialogues> => [
    { id: 'dialogue-1', text: texts[0] },
    { id: 'dialogue-2', text: texts[1] },
    { id: 'dialogue-3', text: texts[2] },
  ]
}

const AI_TEXTS: [string, string, string] = [
  'Vaya, hoy el mapa viene con seis avisos repartidos. Habrá que estar atentos.',
  'Hay aviso naranja por lluvia en Ibiza, y allí se esperan 7,6 mm. Yo llevaría paraguas.',
  'Castform ha vuelto a cambiarse de ropa. Esta vez le toca niebla en cuatro sitios.',
]

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(join(dataDir, name), 'utf-8')) as T
}

async function exists(name: string): Promise<boolean> {
  try {
    await readFile(join(dataDir, name), 'utf-8')
    return true
  } catch {
    return false
  }
}

describe('guarda de fecha', () => {
  it('un forecast desalineado aborta y no escribe nada', async () => {
    await expect(generateOak({ dataDir, now: MISALIGNED_NOW, generateDialogues: noAi })).rejects.toThrow(/no se genera nada/)
    expect(await exists('oak-today.json')).toBe(false)
    expect(await exists('oak-history.json')).toBe(false)
  })

  it('el mensaje dice las dos fechas, para poder diagnosticarlo de un vistazo', async () => {
    await expect(generateOak({ dataDir, now: MISALIGNED_NOW, generateDialogues: noAi })).rejects.toThrow(
      new RegExp(`${TARGET_DATE}.*${MISALIGNED_TARGET}`),
    )
  })
})

describe('historial de entrada', () => {
  it('sin archivo previo, el primer día arranca con historial vacío', async () => {
    const { history } = await generateOak({ dataDir, now: NOW, generateDialogues: noAi })

    expect(history).toHaveLength(1)
    expect(history[0].date).toBe(TARGET_DATE)
  })

  it('un JSON corrupto aborta y no pisa nada', async () => {
    await writeFile(join(dataDir, 'oak-history.json'), '{ esto no es', 'utf-8')

    await expect(generateOak({ dataDir, now: NOW, generateDialogues: noAi })).rejects.toThrow(/oak-history\.json inválido/)
    expect(await exists('oak-today.json')).toBe(false)
  })

  const invalidHistories: { name: string; content: unknown }[] = [
    { name: 'la raíz no es una lista', content: { date: TARGET_DATE } },
    { name: 'una entrada sin forma', content: [YESTERDAY] },
    { name: 'una fecha imposible', content: [{ date: '2026-02-30', focusPokemonId: null, leitmotifIds: [] }] },
    { name: 'una fecha con otro formato', content: [{ date: '17/09/2026', focusPokemonId: null, leitmotifIds: [] }] },
    { name: 'un Pokémon que no existe', content: [{ date: YESTERDAY, focusPokemonId: 'pikachu', leitmotifIds: [] }] },
    { name: 'un leitmotiv que no existe', content: [{ date: YESTERDAY, focusPokemonId: null, leitmotifIds: ['oak-baila'] }] },
    { name: 'campos desconocidos', content: [{ date: YESTERDAY, focusPokemonId: null, leitmotifIds: [], text: '...' }] },
  ]

  it.each(invalidHistories)('$name aborta en vez de empezar de cero en silencio', async ({ content }) => {
    await writeFile(join(dataDir, 'oak-history.json'), JSON.stringify(content), 'utf-8')

    await expect(generateOak({ dataDir, now: NOW, generateDialogues: noAi })).rejects.toThrow(/oak-history\.json inválido/)
    expect(await exists('oak-today.json')).toBe(false)
  })

  it('una entrada posterior al día objetivo aborta: o el reloj iba mal o el archivo es de otra rama', async () => {
    const future: OakHistoryEntry[] = [
      { date: TOMORROW, focusPokemonId: 'zapdos', leitmotifIds: [] },
      { date: YESTERDAY, focusPokemonId: 'charmander', leitmotifIds: [] },
    ]
    await writeFile(join(dataDir, 'oak-history.json'), JSON.stringify(future), 'utf-8')

    await expect(generateOak({ dataDir, now: NOW, generateDialogues: noAi })).rejects.toThrow(new RegExp(`es del futuro \\(${TOMORROW}`))
    expect(await exists('oak-today.json')).toBe(false)
  })

  it('la entrada del propio día objetivo sí vale: es un rerun, no una fecha futura', async () => {
    // Cómo queda el día partiendo de cero, sea cual sea el tiempo que haga.
    const clean = await generateOak({ dataDir, now: NOW, generateDialogues: noAi })

    const stale: OakHistoryEntry[] = [{ date: TARGET_DATE, focusPokemonId: 'zapdos', leitmotifIds: ['gyarados-mar'] }]
    await writeFile(join(dataDir, 'oak-history.json'), JSON.stringify(stale), 'utf-8')
    const rerun = await generateOak({ dataDir, now: NOW, generateDialogues: noAi })

    // Ni se acumula ni condiciona la decisión: se reemplaza por la misma
    // entrada que habría salido sin ella.
    expect(rerun.history).toHaveLength(1)
    expect(rerun.history[0]).toEqual(clean.history[0])
  })

  it('un historial válido previo se conserva junto al día nuevo', async () => {
    const previous: OakHistoryEntry[] = [{ date: YESTERDAY, focusPokemonId: 'charmander', leitmotifIds: ['hoppip-vuela'] }]
    await writeFile(join(dataDir, 'oak-history.json'), JSON.stringify(previous), 'utf-8')

    const { history } = await generateOak({ dataDir, now: NOW, generateDialogues: noAi })

    expect(history.map((entry) => entry.date)).toEqual([TARGET_DATE, YESTERDAY])
  })
})

describe('idempotencia', () => {
  it('dos ejecuciones del mismo día dejan una sola entrada', async () => {
    await generateOak({ dataDir, now: NOW, generateDialogues: noAi })
    await generateOak({ dataDir, now: NOW, generateDialogues: noAi })

    const history = await readJson<OakHistoryEntry[]>('oak-history.json')
    expect(history).toHaveLength(1)
    expect(history[0].date).toBe(TARGET_DATE)
  })

  it('el rerun decide lo mismo: la entrada del propio día no cuenta como historial previo', async () => {
    const first = await generateOak({ dataDir, now: NOW, generateDialogues: noAi })
    const second = await generateOak({ dataDir, now: NOW, generateDialogues: noAi })

    expect(second.today.dialogues).toEqual(first.today.dialogues)
    expect(second.history).toEqual(first.history)
  })
})

describe('OakToday', () => {
  it('sin IA se publica el fallback, y es un OakToday completo', async () => {
    const { today } = await generateOak({ dataDir, now: NOW, generateDialogues: noAi })

    expect(today.source).toBe('fallback')
    expect(today.date).toBe(TARGET_DATE)
    // El modo depende del tiempo que haga ese día, no del contrato: se
    // comprueba que sea uno de los cuatro, no cuál.
    expect(['alerta', 'invasion', 'avistamiento', 'parte']).toContain(today.dayMode)
    expect(today.dialogues).toHaveLength(3)
    for (const dialogue of today.dialogues) {
      expect(dialogue.text.length).toBeGreaterThanOrEqual(20)
      expect(dialogue.text.length).toBeLessThanOrEqual(160)
    }
  })

  it('con IA válida se publica su texto y source es ai', async () => {
    const { today } = await generateOak({ dataDir, now: NOW, generateDialogues: aiReturning(AI_TEXTS) })

    expect(today.source).toBe('ai')
    expect(today.dialogues.map((dialogue) => dialogue.text)).toEqual(AI_TEXTS)
  })

  it('el role sale del plan, no de la IA', async () => {
    const { today } = await generateOak({ dataDir, now: NOW, generateDialogues: aiReturning(AI_TEXTS) })

    expect(today.dialogues.map((dialogue) => dialogue.role)).toEqual(['apertura', 'foco', 'cierre'])
    expect(today.dialogues.map((dialogue) => dialogue.id)).toEqual(['dialogue-1', 'dialogue-2', 'dialogue-3'])
  })

  it('generatedAt es el instante real de la ejecución, en ISO', async () => {
    const { today } = await generateOak({ dataDir, now: NOW, generateDialogues: noAi })

    expect(today.generatedAt).toBe(NOW.toISOString())
    expect(Number.isNaN(Date.parse(today.generatedAt))).toBe(false)
  })

  it('el JSON escrito coincide con lo devuelto, con formato y salto final', async () => {
    const { today } = await generateOak({ dataDir, now: NOW, generateDialogues: noAi })
    const raw = await readFile(join(dataDir, 'oak-today.json'), 'utf-8')

    expect(JSON.parse(raw)).toEqual(today)
    expect(raw.endsWith('\n')).toBe(true)
    expect(raw).toContain('\n  "date"')
  })
})

describe('un bug nuestro no se disfraza de fallback', () => {
  it('si la redacción no cubre los tres huecos, se aborta en vez de publicar', async () => {
    const incomplete = async (): Promise<OakDialogues> =>
      [
        { id: 'dialogue-1', text: AI_TEXTS[0] },
        { id: 'dialogue-1', text: AI_TEXTS[1] },
        { id: 'dialogue-3', text: AI_TEXTS[2] },
      ] as unknown as OakDialogues

    await expect(generateOak({ dataDir, now: NOW, generateDialogues: incomplete })).rejects.toThrow(/Falta el diálogo dialogue-2/)
    expect(await exists('oak-today.json')).toBe(false)
  })

  it('un error dentro de la redacción sube, no cae al fallback', async () => {
    const broken = async (): Promise<OakDialogues> => {
      throw new Error('bug nuestro')
    }

    await expect(generateOak({ dataDir, now: NOW, generateDialogues: broken })).rejects.toThrow('bug nuestro')
    expect(await exists('oak-today.json')).toBe(false)
  })
})

describe('escritura segura', () => {
  it('un fallo de validación no pisa los JSON válidos anteriores', async () => {
    await generateOak({ dataDir, now: NOW, generateDialogues: noAi })
    const goodToday = await readFile(join(dataDir, 'oak-today.json'), 'utf-8')
    const goodHistory = await readFile(join(dataDir, 'oak-history.json'), 'utf-8')

    const tooLong = async (): Promise<OakDialogues> => [
      { id: 'dialogue-1', text: 'x'.repeat(200) },
      { id: 'dialogue-2', text: AI_TEXTS[1] },
      { id: 'dialogue-3', text: AI_TEXTS[2] },
    ]

    await expect(generateOak({ dataDir, now: NOW, generateDialogues: tooLong })).rejects.toThrow(/OakToday inválido/)
    expect(await readFile(join(dataDir, 'oak-today.json'), 'utf-8')).toBe(goodToday)
    expect(await readFile(join(dataDir, 'oak-history.json'), 'utf-8')).toBe(goodHistory)
  })

  it('oak-today.json se publica el último: el artefacto que mira el frontend cambia al final', async () => {
    // Un directorio con ese nombre hace fallar el rename final sin tocar el
    // anterior: dos renames no son una transacción conjunta, así que lo que
    // se comprueba es que el estado intermedio sea el inofensivo.
    await mkdir(join(dataDir, 'oak-today.json'))

    await expect(generateOak({ dataDir, now: NOW, generateDialogues: noAi })).rejects.toThrow()

    // El historial llegó a publicarse; el artefacto que mira el frontend, no.
    const history = await readJson<OakHistoryEntry[]>('oak-history.json')
    expect(history[0].date).toBe(TARGET_DATE)
  })

  it('no queda ningún temporal detrás', async () => {
    await generateOak({ dataDir, now: NOW, generateDialogues: noAi })

    expect(await exists('oak-today.json.tmp')).toBe(false)
    expect(await exists('oak-history.json.tmp')).toBe(false)
  })

  it('el historial publicado es exactamente el devuelto', async () => {
    const { history } = await generateOak({ dataDir, now: NOW, generateDialogues: noAi })

    expect(await readJson<OakHistoryEntry[]>('oak-history.json')).toEqual(history)
  })

  it('el JSON publicado no lleva los hechos ni el plan: el frontend no los necesita', async () => {
    await generateOak({ dataDir, now: NOW, generateDialogues: noAi })
    const today = await readJson<OakToday>('oak-today.json')

    expect(Object.keys(today).sort()).toEqual(['date', 'dayMode', 'dialogues', 'generatedAt', 'source'])
    expect(JSON.stringify(today)).not.toContain('mapPokemonId')
    expect(JSON.stringify(today)).not.toContain('officialZoneId')
  })
})

describe('el plan no se recalcula en el script', () => {
  it('la IA recibe el mismo DayPlan que usaría el fallback', async () => {
    const seen: DayPlan[] = []
    const spy = async (dayPlan: DayPlan): Promise<null> => {
      seen.push(dayPlan)
      return null
    }

    const { today } = await generateOak({ dataDir, now: NOW, generateDialogues: spy })

    expect(seen).toHaveLength(1)
    expect(seen[0].dayMode).toBe(today.dayMode)
    expect(seen[0].date).toBe(today.date)
    expect(seen[0].dialoguePlan.map((slot) => slot.role)).toEqual(today.dialogues.map((dialogue) => dialogue.role))
  })
})
