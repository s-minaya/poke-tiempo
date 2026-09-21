import { rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { generateFallbackDialogues } from '../../src/domain/oak/fallback-dialogues.ts'
import type { OakHistoryEntry } from '../../src/domain/oak/history.ts'
import { nextHistory } from '../../src/domain/oak/history.ts'
import type { OakToday, OakTodayDialogue } from '../../src/domain/oak/oak-today.ts'
import type { DayPlan, OakDialogues } from '../../src/domain/oak/plan-dialogues.ts'
import { HISTORY_FILE, TODAY_FILE, buildDayPlan, defaultDataDir } from './build-day-plan.ts'
import { generateOakDialogues } from './groq-adapter.ts'
import { assertValidOakToday } from './validate.ts'

/**
 * Entrypoint de la generación diaria (`npm run generate:oak`).
 *
 * La distinción que ordena todo el archivo:
 *
 *     IA rota     → fallback → se escribe → éxito
 *     lógica rota → no se escribe → fallo
 *
 * Por eso no hay ningún `try` general. Lo único recuperable es la frontera
 * del proveedor, y esa la captura el adapter devolviendo `null`. Un bug
 * nuestro sube hasta arriba, deja los JSON anteriores intactos y sale con
 * código 1.
 */

export interface GenerateOptions {
  dataDir?: string | undefined
  now: Date
  /** Inyectable para poder probar sin red. Por defecto, el adapter de Groq. */
  generateDialogues?: (dayPlan: DayPlan) => Promise<OakDialogues | null>
}

export interface GenerateResult {
  today: OakToday
  history: OakHistoryEntry[]
}

/**
 * El papel de cada bocadillo sale del plan, nunca de quien redacta: la IA
 * solo devuelve `id` y `text`, y el `id` es lo que los empareja.
 */
function withRoles(dayPlan: DayPlan, dialogues: OakDialogues): [OakTodayDialogue, OakTodayDialogue, OakTodayDialogue] {
  const roles = dayPlan.dialoguePlan.map((slot) => {
    const dialogue = dialogues.find((candidate) => candidate.id === slot.id)
    if (!dialogue) throw new Error(`Falta el diálogo ${slot.id} en la redacción: no se escribe nada.`)
    return { id: slot.id, role: slot.role, text: dialogue.text }
  })

  return roles as [OakTodayDialogue, OakTodayDialogue, OakTodayDialogue]
}

export async function generateOak({ dataDir, now, generateDialogues = generateOakDialogues }: GenerateOptions): Promise<GenerateResult> {
  const directory = dataDir ?? defaultDataDir()
  const { dayPlan, history } = await buildDayPlan({ dataDir: directory, now })

  const fromAi = await generateDialogues(dayPlan)
  const dialogues = fromAi ?? generateFallbackDialogues(dayPlan)

  const today: OakToday = {
    date: dayPlan.date,
    generatedAt: now.toISOString(),
    source: fromAi ? 'ai' : 'fallback',
    dayMode: dayPlan.dayMode,
    dialogues: withRoles(dayPlan, dialogues),
  }
  assertValidOakToday(today, dayPlan.date)

  const updatedHistory = nextHistory(history, dayPlan.historyEntry)

  // Todo serializado antes de tocar el disco: si algo de arriba falla, los
  // dos JSON anteriores siguen enteros.
  await publish(directory, serialize(updatedHistory), serialize(today))

  return { today, history: updatedHistory }
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/**
 * Temporal y `rename` por archivo. Cada `rename` sí es atómico, pero **dos
 * `rename` no forman una transacción conjunta**: entre el primero y el
 * segundo hay un instante en el que uno está publicado y el otro no, y un
 * corte de corriente justo ahí lo dejaría así. No se monta nada para
 * evitarlo; se elige el orden en el que ese estado intermedio es inofensivo.
 *
 * Por eso el historial va primero y **`oak-today.json` siempre el último**:
 * es el artefacto publicable, el que mira el frontend, y solo debe cambiar
 * cuando ya está todo lo demás en su sitio. Un historial adelantado sin su
 * `oak-today` se corrige solo en la siguiente ejecución (el upsert por fecha
 * reescribe esa misma entrada); un `oak-today` nuevo con el historial viejo
 * repetiría foco o gag al día siguiente.
 */
async function publish(directory: string, historyJson: string, todayJson: string): Promise<void> {
  const historyPath = join(directory, HISTORY_FILE)
  const todayPath = join(directory, TODAY_FILE)

  // Los dos temporales antes de renombrar ninguno: si escribir falla, no se
  // ha publicado nada todavía.
  await writeFile(`${historyPath}.tmp`, historyJson, 'utf-8')
  await writeFile(`${todayPath}.tmp`, todayJson, 'utf-8')

  await rename(`${historyPath}.tmp`, historyPath)
  await rename(`${todayPath}.tmp`, todayPath)
}

async function run(): Promise<void> {
  const { today, history } = await generateOak({ now: new Date() })
  console.log(
    `oak-today.json escrito: ${today.date}, modo ${today.dayMode}, source ${today.source}. ` +
      `oak-history.json: ${history.length} ${history.length === 1 ? 'entrada' : 'entradas'}.`,
  )
}

// Solo se auto-ejecuta al lanzarlo directamente, nunca al importarlo desde
// un test — mismo patrón que `fetch-forecast.ts`.
const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
