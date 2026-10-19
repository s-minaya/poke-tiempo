import { describe, expect, it } from 'vitest'

import type { DayClaims } from '../../src/domain/oak/claims.ts'
import type { OakDialogues } from '../../src/domain/oak/plan-dialogues.ts'
import type { RequiredBySlot } from './claim-tokens.ts'
import { buildRequiredClaims, checkTokens, expandTokens } from './claim-tokens.ts'

const EMPTY = { numbers: [], places: [], pokemon: [], alertLevels: [] }

const CLAIMS: DayClaims = {
  dayMode: 'parte',
  serious: false,
  dialogues: [
    { id: 'dialogue-1', role: 'apertura', tone: 'neutral', leitmotif: null, claims: ['A.', 'B.'], required: ['A.'], allowed: EMPTY },
    { id: 'dialogue-2', role: 'foco', tone: 'neutral', leitmotif: null, claims: ['C.'], required: ['C.'], allowed: EMPTY },
    {
      id: 'dialogue-3',
      role: 'cierre',
      tone: 'neutral',
      leitmotif: null,
      claims: ['D.', 'E.', 'F.'],
      required: ['D.', 'E.'],
      allowed: EMPTY,
    },
  ],
}

const REQUIRED: RequiredBySlot = buildRequiredClaims(CLAIMS)

function dialogues(texts: readonly [string, string, string]): OakDialogues {
  return [
    { id: 'dialogue-1', text: texts[0] },
    { id: 'dialogue-2', text: texts[1] },
    { id: 'dialogue-3', text: texts[2] },
  ]
}

const GOOD = dialogues(['Vaya. [[CLAIM_D1_1]] Sigamos.', '[[CLAIM_D2_1]]', '[[CLAIM_D3_1]] y [[CLAIM_D3_2]]'])

describe('buildRequiredClaims', () => {
  it('numera por hueco, en el orden de los claims obligatorios', () => {
    expect(REQUIRED['dialogue-1']).toEqual([{ token: '[[CLAIM_D1_1]]', claim: 'A.' }])
    expect(REQUIRED['dialogue-3']).toEqual([
      { token: '[[CLAIM_D3_1]]', claim: 'D.' },
      { token: '[[CLAIM_D3_2]]', claim: 'E.' },
    ])
  })

  it('es determinista', () => {
    expect(buildRequiredClaims(CLAIMS)).toEqual(REQUIRED)
  })
})

describe('checkTokens', () => {
  it('acepta cada obligatorio una vez en su hueco', () => {
    expect(checkTokens(GOOD, REQUIRED)).toEqual({ ok: true })
  })

  it('rechaza un obligatorio ausente', () => {
    const missing = dialogues(['Vaya. Sigamos.', '[[CLAIM_D2_1]]', '[[CLAIM_D3_1]] y [[CLAIM_D3_2]]'])

    expect(checkTokens(missing, REQUIRED)).toEqual({ ok: false, reason: 'dialogue-1: falta [[CLAIM_D1_1]]' })
  })

  it('rechaza un obligatorio repetido', () => {
    const repeated = dialogues(['[[CLAIM_D1_1]] y [[CLAIM_D1_1]]', '[[CLAIM_D2_1]]', '[[CLAIM_D3_1]] y [[CLAIM_D3_2]]'])

    expect(checkTokens(repeated, REQUIRED)).toEqual({ ok: false, reason: 'dialogue-1: [[CLAIM_D1_1]] aparece 2 veces' })
  })

  it('rechaza un token desconocido, aunque exista en otro hueco', () => {
    const foreign = dialogues(['[[CLAIM_D1_1]] y [[CLAIM_D2_1]]', '[[CLAIM_D2_1]]', '[[CLAIM_D3_1]] y [[CLAIM_D3_2]]'])

    expect(checkTokens(foreign, REQUIRED)).toEqual({ ok: false, reason: 'dialogue-1: token desconocido [[CLAIM_D2_1]]' })
  })

  it('rechaza restos de sintaxis a medias', () => {
    const leftover = dialogues(['[[CLAIM_D1_1]] y [[ roto', '[[CLAIM_D2_1]]', '[[CLAIM_D3_1]] y [[CLAIM_D3_2]]'])

    expect(checkTokens(leftover, REQUIRED)).toEqual({ ok: false, reason: 'dialogue-1: quedan restos de marcador' })
  })
})

describe('expandTokens', () => {
  it('sustituye cada token por su claim, sin tocar el resto', () => {
    expect(expandTokens(GOOD, REQUIRED).map((dialogue) => dialogue.text)).toEqual([
      'Vaya. A. Sigamos.',
      'C.',
      'D. y E.',
    ])
  })
})
