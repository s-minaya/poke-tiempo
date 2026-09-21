import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { locations } from '../../src/data/locations.ts'
import { computeTargetDate } from '../../src/domain/target-date.ts'
import type { Forecast } from '../../src/domain/types.ts'
import { resolveDayMode } from '../../src/domain/oak/day-mode.ts'
import { collectFacts } from '../../src/domain/oak/facts.ts'
import type { OakHistoryEntry } from '../../src/domain/oak/history.ts'
import type { DayPlan } from '../../src/domain/oak/plan-dialogues.ts'
import { planDialogues } from '../../src/domain/oak/plan-dialogues.ts'
import { selectProtagonists } from '../../src/domain/oak/protagonists.ts'
import { readHistory } from './history-file.ts'

/**
 * El guion del día, armado a partir de lo que hay en disco. Aquí solo hay
 * I/O y encadenado: **ninguna decisión narrativa se toma ni se recalcula en
 * `scripts/`**. Los hechos, los protagonistas, el modo y el reparto salen
 * tal cual de las funciones puras de `src/domain/oak/`.
 */

/**
 * Dónde viven los JSON cuando nadie dice otra cosa. Se resuelve al llamarla
 * y no al cargar el módulo: bajo el runner de tests `import.meta.url` no es
 * una URL `file:`, y los tests siempre pasan su propio directorio.
 */
export function defaultDataDir(): string {
  return join(import.meta.dirname, '../../src/data')
}

export const FORECAST_FILE = 'forecast.json'
export const HISTORY_FILE = 'oak-history.json'
export const TODAY_FILE = 'oak-today.json'

export interface DayPlanSources {
  /** Dónde viven los JSON. Parametrizado para que los tests no toquen `src/data`. */
  dataDir?: string | undefined
  /** El instante de la ejecución; se inyecta para poder probar la guarda de fecha. */
  now: Date
}

export interface BuiltDayPlan {
  dayPlan: DayPlan
  /** El historial tal y como estaba en disco, para poder hacer el upsert después. */
  history: OakHistoryEntry[]
}

export async function readForecast(path: string): Promise<Forecast> {
  return JSON.parse(await readFile(path, 'utf-8')) as Forecast
}

export async function buildDayPlan({ dataDir, now }: DayPlanSources): Promise<BuiltDayPlan> {
  const directory = dataDir ?? defaultDataDir()
  const forecast = await readForecast(join(directory, FORECAST_FILE))

  // Oak habla del día que dibuja el mapa. Si el forecast se ha quedado atrás
  // —el fetch de hoy falló y quedó en línea el de ayer— generar igualmente
  // publicaría un texto que contradice al mapa, así que se aborta antes de
  // gastar una sola llamada a la IA.
  const targetDate = computeTargetDate(now)
  if (forecast.date !== targetDate) {
    throw new Error(`forecast.json es del ${forecast.date} y el objetivo de hoy es ${targetDate}: no se genera nada.`)
  }

  const history = await readHistory(join(directory, HISTORY_FILE), targetDate)

  const facts = collectFacts(locations, forecast)
  const dayPlan = planDialogues({
    date: forecast.date,
    facts,
    protagonists: selectProtagonists(facts),
    decision: resolveDayMode(facts),
    history,
  })

  return { dayPlan, history }
}
