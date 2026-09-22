import type { DialogueClaims } from '../../src/domain/oak/claims.ts'
import { KNOWN_POKEMON_NAMES, extractNumbers } from '../../src/domain/oak/claims.ts'
import type { OakDialogues } from '../../src/domain/oak/plan-dialogues.ts'
import type { AlertLevel } from '../../src/domain/types.ts'

/**
 * La segunda aduana: `validateDialogues` mira la forma, esto mira el
 * contenido.
 *
 * No es un verificador semántico y no pretende serlo — no comprueba que lo
 * que dice Oak signifique lo mismo que el claim, porque eso no se puede hacer
 * con reglas deterministas. Comprueba algo mucho más estrecho y decidible:
 * **que no haya entrado ninguna entidad factual nueva**. Una cifra, un
 * nombre propio, un Pokémon o un nivel de aviso que no estuvieran en los
 * claims de ese hueco.
 *
 * Es la red por debajo del diseño, no el diseño: la defensa primera es que
 * el payload ya no lleva nada que invite a inventar (la `maximaC` de una
 * noche fría no viaja). Esto solo recoge lo que se escape.
 *
 * Un falso positivo cuesta un texto de IA y publicamos el fallback, que es
 * bueno. Un falso negativo publica una mentira. La asimetría manda: ante la
 * duda, se rechaza.
 */

export type FactualCheck = { ok: true } | { ok: false; reason: string }

/**
 * Raíces de los tres niveles de aviso, no las palabras exactas: "alerta
 * roja" y "aviso rojo" son el mismo nivel dicho con otro género.
 */
const ALERT_LEVEL_STEMS: Record<AlertLevel, string> = {
  amarillo: 'amarill',
  naranja: 'naranja',
  rojo: 'roj',
}

/**
 * Mayúsculas que no nombran a nadie. Oak puede escribirlas en mitad de una
 * frase sin estar introduciendo una entidad.
 */
const NEUTRAL_CAPITALS: ReadonlySet<string> = new Set(['Pokémon', 'Pokemon', 'Oak', 'Profesor', 'PokéTiempo'])

/** Signos que abren y no cierran: entre ellos y la palabra no hay frase nueva. */
const OPENERS = '¡¿"«»“”‘’\'()[]-–—*'
const SENTENCE_END = '.!?…'

/**
 * Marca de hueco. No es un espacio a propósito: tras tapar un nombre, la
 * palabra siguiente tiene que seguir viéndose como interior de la frase, y
 * un espacio la dejaría mirando al punto de la frase anterior.
 */
const MASK = '·'

const CAPITALIZED = /\p{Lu}[\p{L}\p{M}'’-]*/gu

/**
 * La única unidad nuestra que lleva mayúscula. La "C" de "10 °C" no nombra a
 * nadie, y se tapa antes de buscar nombres propios para que no lo parezca.
 * También con la ordinal masculina, que es el error de teclado de siempre.
 */
const DEGREES = /[°º]\s?C/gu

function maskUnits(text: string): string {
  return text.replace(DEGREES, (match) => MASK.repeat(match.length))
}

function isLetterOrDigit(char: string): boolean {
  return char !== '' && /[\p{L}\p{N}]/u.test(char)
}

function isWholeWord(text: string, start: number, end: number): boolean {
  return !isLetterOrDigit(text[start - 1] ?? '') && !isLetterOrDigit(text[end] ?? '')
}

function isSentenceStart(text: string, index: number): boolean {
  let cursor = index - 1
  while (cursor >= 0 && (/\s/u.test(text[cursor]) || OPENERS.includes(text[cursor]))) cursor -= 1
  return cursor < 0 || SENTENCE_END.includes(text[cursor])
}

/**
 * Busca los nombres que conocemos —los lugares y Pokémon de cualquier hueco
 * del día, más el censo entero de Pokémon— y devuelve el primero que este
 * hueco no autorizaba, junto al texto con los encontrados ya tapados.
 *
 * De más largo a más corto: "Mega-Gyarados" tiene que resolverse antes de
 * que "Gyarados" se lo coma por dentro y lo dé por autorizado.
 */
function scanKnownNames(text: string, known: readonly string[], allowed: ReadonlySet<string>): { masked: string; foreign: string | null } {
  const covered = new Array<boolean>(text.length).fill(false)
  let foreign: string | null = null

  for (const name of [...known].sort((a, b) => b.length - a.length)) {
    for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + name.length)) {
      const end = at + name.length
      if (!isWholeWord(text, at, end)) continue
      if (covered.slice(at, end).some(Boolean)) continue

      covered.fill(true, at, end)
      if (!allowed.has(name) && foreign === null) foreign = name
    }
  }

  let masked = ''
  for (let index = 0; index < text.length; index += 1) masked += covered[index] ? MASK : text[index]

  return { masked, foreign }
}

/**
 * Un nombre propio que no conocemos: cualquier palabra en mayúscula que no
 * sea principio de frase y no esté ya tapada por un nombre autorizado.
 *
 * Así se cubre también el Pokémon inventado que no está en nuestro censo:
 * "Pikachu" en mitad de una frase es un nombre propio sin respaldo, se llame
 * como se llame.
 *
 * El hueco conocido: una entidad nueva **al empezar una frase** se confunde
 * con la mayúscula normal del español y pasa. Distinguirlas pediría un
 * diccionario, y un diccionario es otro proyecto.
 */
function foreignProperNoun(masked: string): string | null {
  for (const match of masked.matchAll(CAPITALIZED)) {
    if (NEUTRAL_CAPITALS.has(match[0])) continue
    if (isSentenceStart(masked, match.index)) continue
    return match[0]
  }
  return null
}

function foreignAlertLevel(text: string, allowed: ReadonlySet<string>): AlertLevel | null {
  const words = text.toLowerCase().split(/[^\p{L}]+/u)

  for (const [level, stem] of Object.entries(ALERT_LEVEL_STEMS) as [AlertLevel, string][]) {
    if (allowed.has(level)) continue
    if (words.some((word) => word.startsWith(stem))) return level
  }
  return null
}

function checkOne(text: string, slot: DialogueClaims, known: readonly string[]): string | null {
  const allowedNames = new Set([...slot.allowed.places, ...slot.allowed.pokemon])

  const number = extractNumbers(text).find((value) => !slot.allowed.numbers.includes(value))
  if (number !== undefined) return `cifra ${number} que no está en sus claims`

  const level = foreignAlertLevel(text, new Set<string>(slot.allowed.alertLevels))
  if (level !== null) return `nivel de aviso "${level}" que no está en sus claims`

  const { masked, foreign } = scanKnownNames(text, known, allowedNames)
  if (foreign !== null) return `nombra "${foreign}", que no está en sus claims`

  const invented = foreignProperNoun(maskUnits(masked))
  if (invented !== null) return `nombra "${invented}", que no existe en los datos del día`

  return null
}

/**
 * Los tres textos contra los tres encargos. El censo de nombres conocidos es
 * el del día entero, no el del hueco: mover un lugar del tercer diálogo al
 * segundo tampoco vale, aunque el lugar sea real.
 */
export function checkFactualFit(dialogues: OakDialogues, brief: readonly DialogueClaims[]): FactualCheck {
  const known = [
    ...new Set([...brief.flatMap((slot) => [...slot.allowed.places, ...slot.allowed.pokemon]), ...KNOWN_POKEMON_NAMES]),
  ]

  for (const [index, dialogue] of dialogues.entries()) {
    const slot = brief[index]
    if (!slot || slot.id !== dialogue.id) return { ok: false, reason: `${dialogue.id} no corresponde al encargo de la posición ${index}` }

    const problem = checkOne(dialogue.text, slot, known)
    if (problem !== null) return { ok: false, reason: `${dialogue.id}: ${problem}` }
  }

  return { ok: true }
}
