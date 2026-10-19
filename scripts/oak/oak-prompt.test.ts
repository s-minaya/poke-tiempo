import { describe, expect, it } from 'vitest'

import { SYSTEM_PROMPT } from './oak-prompt.ts'

describe('el encargo con tokens', () => {
  it('pide cada marca obligatoria una vez, a nivel de frase, y prohíbe inventar otras', () => {
    expect(SYSTEM_PROMPT).toContain('requiredClaims')
    expect(SYSTEM_PROMPT).toContain('[[…]]')
    expect(SYSTEM_PROMPT).toContain('exactamente una vez')
    expect(SYSTEM_PROMPT).toContain('no puedes inventarte ninguna otra marca')
  })

  it('impide negar, invertir o parafrasear el claim que la marca representa', () => {
    expect(SYSTEM_PROMPT).toContain('sin negar, invertir ni matizar')
    expect(SYSTEM_PROMPT).toContain('se expande por el claim entero')
  })

  it('el resto de los claims de la entrada queda como material opcional', () => {
    expect(SYSTEM_PROMPT).toContain('material autorizado, pero opcional')
  })
})
