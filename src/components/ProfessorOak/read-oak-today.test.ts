import { describe, expect, it } from 'vitest'

import { readOakToday } from './read-oak-today.ts'

const DATE = '2026-09-23'

function oakToday(overrides: Record<string, unknown> = {}) {
  return {
    date: DATE,
    generatedAt: '2026-09-22T06:00:00.000Z',
    source: 'ai',
    dayMode: 'invasion',
    serious: false,
    dialogues: [
      { id: 'dialogue-1', role: 'apertura', tone: 'neutral', text: 'Vaya... hoy hay 7 lugares bajo algún aviso.' },
      { id: 'dialogue-2', role: 'foco', tone: 'epico', text: 'Charmeleon aparece en 33 lugares del mapa.' },
      { id: 'dialogue-3', role: 'cierre', tone: 'guasa', text: 'Gyarados asoma en 6 lugares. Yo miraría desde lejos.' },
    ],
    ...overrides,
  }
}

describe('readOakToday', () => {
  it('un JSON con el contrato completo y del mismo día que el mapa se cuenta tal cual', () => {
    const data = oakToday()

    expect(readOakToday(data, DATE)).toBe(data)
  })

  it('el contrato anterior —sin tono ni día serio— no se cuenta: no se deduce lo que falta', () => {
    const previous = oakToday({
      dialogues: oakToday().dialogues.map((dialogue) => ({ id: dialogue.id, role: dialogue.role, text: dialogue.text })),
    }) as Record<string, unknown>
    delete previous.serious

    expect(readOakToday(previous, DATE)).toBeNull()
  })

  it('sin serious no se presupone que el día sea tranquilo', () => {
    const data = oakToday() as Record<string, unknown>
    delete data.serious

    expect(readOakToday(data, DATE)).toBeNull()
  })

  it('con un tono desconocido no se inventa la pose', () => {
    const [first, second, third] = oakToday().dialogues

    expect(readOakToday(oakToday({ dialogues: [first, { ...second, tone: 'misterio' }, third] }), DATE)).toBeNull()
  })

  it('si habla de otro día que el mapa, no sale', () => {
    expect(readOakToday(oakToday(), '2026-09-24')).toBeNull()
  })

  it('tres bocadillos con texto, ni más ni menos', () => {
    const [first, second, third] = oakToday().dialogues

    expect(readOakToday(oakToday({ dialogues: [first, second] }), DATE)).toBeNull()
    expect(readOakToday(oakToday({ dialogues: [first, second, { ...third, text: '   ' }] }), DATE)).toBeNull()
  })

  it('lo que ni siquiera es un objeto, tampoco', () => {
    for (const value of [null, undefined, 'oak', 42, []]) expect(readOakToday(value, DATE)).toBeNull()
  })
})
