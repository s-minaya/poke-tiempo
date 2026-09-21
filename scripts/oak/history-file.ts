import { readFile } from 'node:fs/promises'

import type { PokedexId } from '../../src/domain/pokedex.ts'
import { POKEMON_NAMES } from '../../src/domain/pokemon-names.ts'
import type { OakHistoryEntry } from '../../src/domain/oak/history.ts'
import { LEITMOTIFS } from '../../src/domain/oak/leitmotifs.ts'
import type { LeitmotifId } from '../../src/domain/oak/leitmotifs.ts'

/**
 * Lectura de `oak-history.json`, que es un archivo que escribimos nosotros
 * y volvemos a leer al día siguiente.
 *
 * **Que no exista es normal** — el primer día no hay historial y `[]` es la
 * respuesta correcta. **Que exista y esté mal no lo es**: un JSON roto, una
 * forma inesperada, un `PokedexId` que ya no existe o una fecha imposible
 * son fallos nuestros, y tratarlos como "historial vacío" haría que Oak
 * olvidara en silencio su continuidad y repitiera foco y gag sin que nadie
 * se enterase. Ahí se aborta y no se escribe nada.
 */

const POKEDEX_IDS: ReadonlySet<string> = new Set(Object.keys(POKEMON_NAMES))
const LEITMOTIF_IDS: ReadonlySet<string> = new Set(LEITMOTIFS.map((leitmotif) => leitmotif.id))

export class OakHistoryError extends Error {}

function fail(detail: string): never {
  throw new OakHistoryError(`oak-history.json inválido: ${detail}`)
}

/** `YYYY-MM-DD` que además existe en el calendario: "2026-02-30" no vale. */
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const ENTRY_KEYS = ['date', 'focusPokemonId', 'leitmotifIds']

function parseEntry(value: unknown, index: number, targetDate: string): OakHistoryEntry {
  const where = `entrada ${index}`
  if (!isPlainObject(value)) fail(`${where} no es un objeto`)

  const extra = Object.keys(value).filter((key) => !ENTRY_KEYS.includes(key))
  if (extra.length > 0) fail(`${where} trae campos desconocidos (${extra.join(', ')})`)

  if (!isCalendarDate(value.date)) fail(`${where} tiene una fecha inválida (${JSON.stringify(value.date)})`)

  // Una fecha posterior al objetivo no puede haberla escrito esta máquina en
  // su sano juicio: o el reloj iba mal cuando se generó, o el archivo viene
  // de otra rama. Fiarse de ella envenenaría el cooldown y la racha de focos
  // durante días, así que se aborta. La del propio día sí vale — es un rerun,
  // y `recentHistory` ya sabe que no cuenta como historial previo.
  if (value.date > targetDate) {
    fail(`${where} es del futuro (${value.date}, después del objetivo ${targetDate})`)
  }

  const { focusPokemonId } = value
  if (focusPokemonId !== null && (typeof focusPokemonId !== 'string' || !POKEDEX_IDS.has(focusPokemonId))) {
    fail(`${where} tiene un focusPokemonId desconocido (${JSON.stringify(focusPokemonId)})`)
  }

  const { leitmotifIds } = value
  if (!Array.isArray(leitmotifIds)) fail(`${where} no trae una lista de leitmotifIds`)
  for (const id of leitmotifIds) {
    if (typeof id !== 'string' || !LEITMOTIF_IDS.has(id)) fail(`${where} tiene un leitmotiv desconocido (${JSON.stringify(id)})`)
  }

  return {
    date: value.date,
    focusPokemonId: focusPokemonId as PokedexId | null,
    leitmotifIds: leitmotifIds as LeitmotifId[],
  }
}

export function parseHistory(raw: string, targetDate: string): OakHistoryEntry[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    fail(`no es JSON válido (${error instanceof Error ? error.message : String(error)})`)
  }

  if (!Array.isArray(parsed)) fail('la raíz no es una lista')
  return parsed.map((entry, index) => parseEntry(entry, index, targetDate))
}

/**
 * `[]` si el archivo todavía no existe; cualquier otro problema aborta.
 *
 * `targetDate` entra porque parte de lo que hace válido a este archivo
 * depende de la ejecución, no solo de su forma: una entrada posterior al día
 * que se está generando es un error de contexto. Por eso la comprobación
 * vive aquí y no en `history.ts`, que es dominio puro y no sabe qué día se
 * está generando.
 */
export async function readHistory(path: string, targetDate: string): Promise<OakHistoryEntry[]> {
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (error) {
    if (isNotFound(error)) return []
    throw error
  }
  return parseHistory(raw, targetDate)
}

function isNotFound(error: unknown): boolean {
  return isPlainObject(error) && error.code === 'ENOENT'
}
