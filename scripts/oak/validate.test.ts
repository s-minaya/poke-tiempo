import { describe, expect, it } from 'vitest'

import type { OakToday, OakTodayDialogue } from '../../src/domain/oak/oak-today.ts'
import { assertValidOakToday, checkDialogueLengths, validateDialogues } from './validate.ts'

/**
 * La aduana propia (`assertValidOakToday`) y los límites de la vía IA
 * (`validateDialogues` + `checkDialogueLengths`). Los segundos existen porque
 * el proveedor devuelve el texto con tokens: hasta que no se expanden no se
 * sabe cuánto mide lo que se publica.
 */

const DATE = '2026-09-18'
const GENERATED_AT = '2026-09-17T12:00:00.000Z'

const GOOD_TEXTS: [string, string, string] = [
  'Veamos, el mapa viene tranquilo esta vez.',
  'Ourense se queda con la niebla de la mañana.',
  'Seguimos observando el resto del mapa.',
]

const IDS = ['dialogue-1', 'dialogue-2', 'dialogue-3'] as const
const ROLES = ['apertura', 'foco', 'cierre'] as const

function todayWith(texts: [string, string, string]): OakToday {
  return {
    date: DATE,
    generatedAt: GENERATED_AT,
    source: 'fallback',
    dayMode: 'parte',
    serious: false,
    dialogues: IDS.map((id, index) => ({ id, role: ROLES[index], tone: 'neutral', text: texts[index] })) as [
      OakTodayDialogue,
      OakTodayDialogue,
      OakTodayDialogue,
    ],
  }
}

describe('assertValidOakToday', () => {
  it('acepta un OakToday completo', () => {
    expect(() => assertValidOakToday(todayWith(GOOD_TEXTS), DATE)).not.toThrow()
  })

  it('un emoji en el texto propio es un fallo nuestro: lanza', () => {
    const texts: [string, string, string] = ['Veamos, el mapa viene tranquilo 😀.', GOOD_TEXTS[1], GOOD_TEXTS[2]]

    expect(() => assertValidOakToday(todayWith(texts), DATE)).toThrow(/emoji/)
  })

  it('mide la longitud sobre el texto final: 19 no pasa y 20 sí', () => {
    expect(() => assertValidOakToday(todayWith(['x'.repeat(19), GOOD_TEXTS[1], GOOD_TEXTS[2]]), DATE)).toThrow(/19 caracteres/)
    expect(() => assertValidOakToday(todayWith(['x'.repeat(20), GOOD_TEXTS[1], GOOD_TEXTS[2]]), DATE)).not.toThrow()
  })

  it('161 no pasa y 160 sí', () => {
    expect(() => assertValidOakToday(todayWith(['x'.repeat(161), GOOD_TEXTS[1], GOOD_TEXTS[2]]), DATE)).toThrow(/161 caracteres/)
    expect(() => assertValidOakToday(todayWith(['x'.repeat(160), GOOD_TEXTS[1], GOOD_TEXTS[2]]), DATE)).not.toThrow()
  })
})

describe('límites sobre el texto final (vía IA)', () => {
  const raw = {
    dialogues: [
      { id: 'dialogue-1', text: 'x'.repeat(19) },
      { id: 'dialogue-2', text: GOOD_TEXTS[1] },
      { id: 'dialogue-3', text: GOOD_TEXTS[2] },
    ],
  }

  it('validateDialogues sin medir acepta, y checkDialogueLengths rechaza el texto final corto', () => {
    const shape = validateDialogues(raw, { checkLength: false })

    expect(shape.ok).toBe(true)
    if (!shape.ok) return
    expect(checkDialogueLengths(shape.dialogues)).toEqual({ ok: false, reason: 'dialogue-1: 19 caracteres, por debajo de 20' })
  })

  it('validateDialogues por defecto sí mide el texto final', () => {
    expect(validateDialogues(raw)).toEqual({ ok: false, reason: 'dialogue-1: 19 caracteres, por debajo de 20' })
  })
})
