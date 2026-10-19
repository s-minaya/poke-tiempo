import type { DayClaims } from '../../src/domain/oak/claims.ts'
import type { DialogueId, OakDialogues } from '../../src/domain/oak/plan-dialogues.ts'

/**
 * La conversión entre los claims obligatorios (texto plano, sin sintaxis) y
 * los tokens que viajan al proveedor. Vive en `scripts/oak/` a propósito: el
 * dominio no conoce `[[…]]`, y el fallback tampoco —verbaliza los hechos
 * directamente—. Aquí, en la única frontera con la IA, se crean los tokens,
 * se comprueba que están donde toca y se expanden a su afirmación
 * determinista antes de validar y publicar.
 *
 * Un token se coloca **a nivel de frase**: lo que se sustituye es una
 * afirmación entera, así que al expandir la gramática del diálogo no se
 * rompe. Un token ausente, repetido, desconocido o a medias cuesta un texto
 * de IA y publica el fallback, que es bueno.
 */

/** Una afirmación obligatoria con su token estable. */
export interface RequiredClaim {
  token: string
  claim: string
}

/** Los tokens obligatorios de cada hueco, en el orden de sus claims. */
export type RequiredBySlot = Record<DialogueId, RequiredClaim[]>

const DIALOGUE_NUMBERS: Record<DialogueId, number> = {
  'dialogue-1': 1,
  'dialogue-2': 2,
  'dialogue-3': 3,
}

export function tokenFor(id: DialogueId, index: number): string {
  return `[[CLAIM_D${DIALOGUE_NUMBERS[id]}_${index + 1}]]`
}

/** Los tokens de un encargo, derivados solo de los claims obligatorios del dominio. */
export function buildRequiredClaims(claims: DayClaims): RequiredBySlot {
  const required = {} as RequiredBySlot

  for (const slot of claims.dialogues) {
    required[slot.id] = slot.required.map((claim, index) => ({ token: tokenFor(slot.id, index), claim }))
  }

  return required
}

/** Todo `[[…]]`, bien formado o no: lo que sobre después de expandir es un resto. */
const TOKEN_PATTERN = /\[\[[^\]]*\]\]/g

export type TokensCheck = { ok: true } | { ok: false; reason: string }

function tokensIn(text: string): string[] {
  return [...text.matchAll(TOKEN_PATTERN)].map((match) => match[0])
}

/**
 * La comprobación estructural: cada token obligatorio, en el texto de **su**
 * hueco, exactamente una vez; ningún otro token; y ningún resto de sintaxis
 * `[[…]]` a medias. No interpreta lenguaje natural.
 */
export function checkTokens(dialogues: OakDialogues, required: RequiredBySlot): TokensCheck {
  for (const dialogue of dialogues) {
    const expected = required[dialogue.id]
    const found = tokensIn(dialogue.text)

    for (const token of found) {
      if (!expected.some((entry) => entry.token === token)) return { ok: false, reason: `${dialogue.id}: token desconocido ${token}` }
    }

    for (const entry of expected) {
      const count = found.filter((token) => token === entry.token).length
      if (count === 0) return { ok: false, reason: `${dialogue.id}: falta ${entry.token}` }
      if (count > 1) return { ok: false, reason: `${dialogue.id}: ${entry.token} aparece ${count} veces` }
    }

    const leftovers = dialogue.text.replace(TOKEN_PATTERN, '')
    if (leftovers.includes('[[') || leftovers.includes(']]')) return { ok: false, reason: `${dialogue.id}: quedan restos de marcador` }
  }

  return { ok: true }
}

/** Cada token por su claim. La forma ya la comprobó `checkTokens`. */
export function expandTokens(dialogues: OakDialogues, required: RequiredBySlot): OakDialogues {
  return dialogues.map((dialogue) => {
    let text = dialogue.text
    for (const entry of required[dialogue.id]) text = text.split(entry.token).join(entry.claim)
    return { ...dialogue, text }
  }) as OakDialogues
}
