import type { OakToday } from '../../src/domain/oak/oak-today.ts'
import type { DialogueId, OakDialogues } from '../../src/domain/oak/plan-dialogues.ts'
import { DIALOGUE_MAX_LENGTH, DIALOGUE_MIN_LENGTH } from '../../src/domain/oak/plan-dialogues.ts'

/**
 * La aduana antes de publicar. Dos controles distintos con dos respuestas
 * distintas:
 *
 * - `validateDialogues` mira lo que ha devuelto un tercero. Un fallo suyo
 *   es esperado, así que devuelve un motivo y el programa cae al fallback.
 * - `assertValidOakToday` mira lo que hemos construido nosotros. Un fallo
 *   ahí es un bug, así que lanza y no se escribe nada.
 *
 * Que el proveedor prometa un esquema estricto no exime de mirar: nuestras
 * invariantes se comprueban aquí, no se delegan.
 */

export const DIALOGUE_IDS: readonly DialogueId[] = ['dialogue-1', 'dialogue-2', 'dialogue-3']

export type DialoguesCheck = { ok: true; dialogues: OakDialogues } | { ok: false; reason: string }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function checkText(text: unknown, id: string): string | null {
  if (typeof text !== 'string') return `${id}: text no es una cadena`
  if (text.trim() === '') return `${id}: text vacío`
  if (text.length < DIALOGUE_MIN_LENGTH) return `${id}: ${text.length} caracteres, por debajo de ${DIALOGUE_MIN_LENGTH}`
  if (text.length > DIALOGUE_MAX_LENGTH) return `${id}: ${text.length} caracteres, por encima de ${DIALOGUE_MAX_LENGTH}`
  return null
}

/** Exactamente `{ dialogues: [{id, text} × 3] }`, en orden y sin nada más. */
export function validateDialogues(value: unknown): DialoguesCheck {
  if (!isPlainObject(value)) return { ok: false, reason: 'la respuesta no es un objeto' }

  const extraRoot = Object.keys(value).filter((key) => key !== 'dialogues')
  if (extraRoot.length > 0) return { ok: false, reason: `campos extra en la raíz (${extraRoot.join(', ')})` }

  const { dialogues } = value
  if (!Array.isArray(dialogues)) return { ok: false, reason: 'dialogues no es una lista' }
  if (dialogues.length !== DIALOGUE_IDS.length) return { ok: false, reason: `${dialogues.length} diálogos en vez de ${DIALOGUE_IDS.length}` }

  for (const [index, dialogue] of dialogues.entries()) {
    const expectedId = DIALOGUE_IDS[index]
    if (!isPlainObject(dialogue)) return { ok: false, reason: `${expectedId}: no es un objeto` }

    const extra = Object.keys(dialogue).filter((key) => key !== 'id' && key !== 'text')
    if (extra.length > 0) return { ok: false, reason: `${expectedId}: campos extra (${extra.join(', ')})` }

    if (dialogue.id !== expectedId) return { ok: false, reason: `en la posición ${index} llega ${JSON.stringify(dialogue.id)} y tocaba ${expectedId}` }

    const textProblem = checkText(dialogue.text, expectedId)
    if (textProblem) return { ok: false, reason: textProblem }
  }

  return { ok: true, dialogues: dialogues as OakDialogues }
}

/** Lo que estamos a punto de escribir. Un fallo aquí es nuestro, no del proveedor. */
export function assertValidOakToday(today: OakToday, expectedDate: string): void {
  const problems: string[] = []

  if (today.date !== expectedDate) problems.push(`date ${today.date} no coincide con el objetivo ${expectedDate}`)
  if (Number.isNaN(Date.parse(today.generatedAt))) problems.push(`generatedAt no es una fecha ISO (${today.generatedAt})`)
  if (today.source !== 'ai' && today.source !== 'fallback') problems.push(`source desconocido (${String(today.source)})`)
  if (today.dialogues.length !== DIALOGUE_IDS.length) problems.push(`${today.dialogues.length} diálogos`)

  for (const [index, dialogue] of today.dialogues.entries()) {
    const expectedId = DIALOGUE_IDS[index]
    if (dialogue.id !== expectedId) problems.push(`posición ${index}: id ${dialogue.id}`)
    if (dialogue.role === undefined) problems.push(`${expectedId}: sin role`)
    const textProblem = checkText(dialogue.text, expectedId)
    if (textProblem) problems.push(textProblem)
  }

  if (problems.length > 0) {
    throw new Error(`OakToday inválido, no se escribe nada: ${problems.join('; ')}`)
  }
}
