import { describe, expect, it } from 'vitest'

import type { DialogueClaims } from '../../src/domain/oak/claims.ts'
import type { OakDialogues } from '../../src/domain/oak/plan-dialogues.ts'
import { checkFactualFit } from './factual-guard.ts'

/**
 * El encargo real del 2026-09-23, que es el día del que salieron las
 * desviaciones que estamos cerrando. Los textos de cada caso se escriben
 * como los escribiría el modelo, no como los escribiría el fallback.
 */
const BRIEF: DialogueClaims[] = [
  {
    id: 'dialogue-1',
    role: 'apertura',
    tone: 'neutral',
    leitmotif: null,
    claims: ['Hoy hay 7 lugares del mapa bajo algún aviso y 2 con lluvia.'],
    allowed: { numbers: [7, 2], places: [], pokemon: [], alertLevels: [] },
  },
  {
    id: 'dialogue-2',
    role: 'foco',
    tone: 'epico',
    leitmotif: null,
    claims: [
      'Charmeleon aparece en 35 lugares del mapa. La Rioja, Navarra y Huesca son algunos ejemplos.',
      'En Benasque, la mínima nocturna baja hasta 10 °C.',
    ],
    allowed: {
      numbers: [35, 10],
      places: ['La Rioja', 'Navarra', 'Huesca', 'Benasque'],
      pokemon: ['Charmeleon'],
      alertLevels: [],
    },
  },
  {
    id: 'dialogue-3',
    role: 'cierre',
    tone: 'guasa',
    leitmotif: 'gyarados-mar',
    claims: ['Gyarados aparece en 6 lugares del mapa. A Coruña, Pontevedra y Gijón son algunos ejemplos.'],
    allowed: { numbers: [6], places: ['A Coruña', 'Pontevedra', 'Gijón'], pokemon: ['Gyarados'], alertLevels: [] },
  },
]

const GOOD: [string, string, string] = [
  'Veamos... hoy hay 7 lugares bajo aviso y 2 con lluvia. Sigamos atentos.',
  '¡Vaya! Charmeleon aparece en 35 lugares, entre ellos La Rioja, Navarra y Huesca. En Benasque la mínima baja hasta 10 °C.',
  'Gyarados asoma en 6 lugares, por ejemplo A Coruña, Pontevedra y Gijón. Yo miraría desde lejos.',
]

function dialogues(texts: readonly [string, string, string]): OakDialogues {
  return [
    { id: 'dialogue-1', text: texts[0] },
    { id: 'dialogue-2', text: texts[1] },
    { id: 'dialogue-3', text: texts[2] },
  ]
}

/** Cambia un solo hueco y deja los otros dos correctos. */
function withText(index: 0 | 1 | 2, text: string): OakDialogues {
  const texts: [string, string, string] = [...GOOD]
  texts[index] = text
  return dialogues(texts)
}

function check(index: 0 | 1 | 2, text: string, brief: DialogueClaims[] = BRIEF) {
  return checkFactualFit(withText(index, text), brief)
}

describe('paráfrasis válidas', () => {
  it('acepta los tres textos de un día bien redactado', () => {
    expect(checkFactualFit(dialogues(GOOD), BRIEF)).toEqual({ ok: true })
  })

  it('acepta reordenar, resumir y quitar cifras', () => {
    expect(check(1, 'Curioso... Charmeleon se deja ver por 35 lugares. En Benasque refresca de noche.').ok).toBe(true)
  })

  it('acepta el decimal escrito con punto en vez de con coma', () => {
    const brief = [BRIEF[0], { ...BRIEF[1], claims: ['En Vigo se esperan 12,4 mm de lluvia.'], allowed: { ...BRIEF[1].allowed, numbers: [12.4], places: ['Vigo'] } }, BRIEF[2]]

    expect(check(1, 'Vaya, en Vigo se esperan 12.4 mm. Esto merece una anotación.', brief).ok).toBe(true)
  })

  it('acepta el nombre a secas cuando el claim lo trae desambiguado', () => {
    const brief = [
      BRIEF[0],
      { ...BRIEF[1], claims: ['Castform (Niebla) aparece en 4 lugares del mapa.'], allowed: { numbers: [4], places: [], pokemon: ['Castform (Niebla)', 'Castform'], alertLevels: [] } },
      BRIEF[2],
    ]

    expect(check(1, 'Interesante... Castform aparece hoy en 4 lugares. Otra vez cambiando de ropa.', brief).ok).toBe(true)
    expect(check(1, 'Interesante... Castform (Niebla) aparece hoy en 4 lugares del mapa.', brief).ok).toBe(true)
  })

  it('no confunde un nombre compuesto con el simple que contiene', () => {
    const brief = [BRIEF[0], BRIEF[1], { ...BRIEF[2], allowed: { ...BRIEF[2].allowed, pokemon: ['Mega-Gyarados'] } }]

    expect(check(2, 'Mega-Gyarados asoma en 6 lugares. Prefiero mirarlo desde la orilla.', brief).ok).toBe(true)
  })
})

describe('entidades que nadie autorizó', () => {
  it('rechaza una cifra nueva: el 10-30 °C del run real', () => {
    const result = check(1, 'En Benasque la noche más fría: 10-30 °C. Charmeleon anda por 35 lugares.')

    expect(result).toEqual({ ok: false, reason: 'dialogue-2: cifra 30 que no está en sus claims' })
  })

  it('rechaza una cifra nueva aunque sea de otro hueco', () => {
    expect(check(2, 'Gyarados asoma en 6 lugares, y Charmeleon en 35. Curioso.').ok).toBe(false)
  })

  it('rechaza un lugar que solo estaba en otro hueco', () => {
    const result = check(2, 'Benasque también tiene su Gyarados, y asoma en 6 lugares más.')

    expect(result).toEqual({ ok: false, reason: 'dialogue-3: nombra "Benasque", que no está en sus claims' })
  })

  it('rechaza un lugar inventado en mitad de la frase', () => {
    expect(check(1, 'Vaya, Charmeleon aparece en 35 lugares. En Madrid lo tenemos también.').ok).toBe(false)
  })

  it('rechaza un Pokémon de nuestro censo que hoy no le tocaba', () => {
    const result = check(1, 'Curioso: Snorunt aparece en 35 lugares, entre ellos La Rioja y Navarra.')

    expect(result).toEqual({ ok: false, reason: 'dialogue-2: nombra "Snorunt", que no está en sus claims' })
  })

  it('rechaza un Pokémon que ni siquiera es de los nuestros', () => {
    expect(check(1, 'Vaya, ese Pikachu aparece en 35 lugares, entre ellos La Rioja.').ok).toBe(false)
  })

  it('distingue a Gyarados de Mega-Gyarados: son dos Pokémon', () => {
    expect(check(2, 'Mega-Gyarados asoma en 6 lugares. Prefiero mirarlo desde la orilla.').ok).toBe(false)
  })

  it('rechaza un nivel de aviso que no está en el claim', () => {
    const brief = [
      BRIEF[0],
      {
        ...BRIEF[1],
        claims: ['Hay un aviso oficial naranja por lluvia que afecta a nuestro lugar de Ibiza.'],
        allowed: { numbers: [], places: ['Ibiza'], pokemon: [], alertLevels: ['naranja' as const] },
      },
      BRIEF[2],
    ]

    expect(check(1, 'Atención: hay aviso rojo por lluvia en Ibiza. Yo no saldría sin paraguas.', brief)).toEqual({
      ok: false,
      reason: 'dialogue-2: nivel de aviso "rojo" que no está en sus claims',
    })
    expect(check(1, 'Atención: tenemos una alerta roja por lluvia en Ibiza. Prudencia.', brief).ok).toBe(false)
    expect(check(1, 'Atención: hay aviso naranja por lluvia en Ibiza. Yo no saldría sin paraguas.', brief).ok).toBe(true)
  })

  it('el motivo dice qué hueco y qué entidad, para poder leerlo en el log', () => {
    const result = check(0, 'Hoy hay 7 lugares bajo aviso y 2 con lluvia. En Teruel, 19 grados.')

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('dialogue-1')
  })
})

describe('lo que esta guarda no ve', () => {
  /**
   * Documentado a propósito, no es un descuido: son los dos límites reales
   * de una comprobación determinista sin diccionario ni semántica.
   *
   * La defensa contra esto no es la guarda, es el payload —el claim ya no
   * ofrece esa lectura— y el prompt, que la prohíbe expresamente.
   */
  it('no distingue "7 avisos" de "7 lugares bajo aviso": las dos usan el mismo 7', () => {
    expect(check(0, 'Veamos... hoy tenemos 7 avisos y 2 lugares con lluvia.').ok).toBe(true)
  })

  it('un nombre nuevo al empezar una frase se confunde con la mayúscula normal', () => {
    expect(check(1, 'Charmeleon aparece en 35 lugares. Madrid queda al margen, curiosamente.').ok).toBe(true)
  })
})

describe('correspondencia con el encargo', () => {
  it('rechaza un id que no corresponde a su posición', () => {
    const wrong: OakDialogues = [
      { id: 'dialogue-2', text: GOOD[1] },
      { id: 'dialogue-1', text: GOOD[0] },
      { id: 'dialogue-3', text: GOOD[2] },
    ]

    expect(checkFactualFit(wrong, BRIEF).ok).toBe(false)
  })
})
