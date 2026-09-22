import type { DayClaims, DialogueClaims } from '../../src/domain/oak/claims.ts'
import { buildDayClaims } from '../../src/domain/oak/claims.ts'
import type { DayPlan, OakDialogues } from '../../src/domain/oak/plan-dialogues.ts'
import { checkFactualFit } from './factual-guard.ts'
import { LEITMOTIF_DIRECTIONS, SYSTEM_PROMPT } from './oak-prompt.ts'
import { DIALOGUE_IDS, validateDialogues } from './validate.ts'

/**
 * La única frontera con la IA. `src/domain/oak/` no sabe que Groq existe:
 * este adapter recibe un `DayPlan` ya cerrado y devuelve tres textos, o
 * `null` si el proveedor no ha podido dárnoslos.
 *
 * **`null` no es una excepción, es una respuesta.** Que falte la clave, que
 * haya un 429, que el JSON llegue torcido o que el texto se invente una
 * cifra son cosas que pasan y que el fallback local cubre; el programa sigue
 * y termina en éxito. Lo único que se captura aquí es esa frontera: un error
 * nuestro no se disfraza de indisponibilidad del proveedor.
 *
 * Sin SDK — la API es compatible con OpenAI y una sola llamada al día no
 * justifica una dependencia.
 */

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
export const DEFAULT_MODEL = 'openai/gpt-oss-120b'

// Tres frases de 160 caracteres son ~150 tokens; el resto es margen para el
// razonamiento interno del modelo. `max_tokens` está deprecado en Groq.
const MAX_COMPLETION_TOKENS = 1024

// Corto y explícito: si el proveedor tarda más, el fallback ya está escrito.
const TIMEOUT_MS = 20_000

// --- El payload: verdades cerradas, no hechos que interpretar --------------

/**
 * Lo que la IA llega a ver. Ya no son `NarrativeFact` serializados: son los
 * claims que el dominio ha resuelto, más el papel, el tono y la dirección
 * del gag.
 *
 * El cambio viene de dos generaciones reales. Mientras el modelo recibía
 * campos —`papel`, `maximaC`, `minimaC`, `lugaresConAviso`,
 * `algunosLugares`— tenía que decidir qué significaba cada uno, y decidía
 * mal: "la noche más fría: 10-30 °C", "7 avisos", "desde La Rioja hasta
 * Huesca". Ninguna de las tres es un fallo de redacción; las tres son
 * interpretaciones de nuestro modelo de dominio. Así que ya no interpreta:
 * recibe la frase verdadera y le pone voz.
 *
 * Mínimo privilegio informativo, igual que antes: si no hace falta para
 * escribir la frase, no viaja. Fuera quedan los ids técnicos, la
 * trazabilidad del aviso, el Pokémon del mapa de un hecho meteorológico, el
 * recuento que decidimos no contar y el valor térmico que el papel no
 * señala. También la fecha: Oak no la dice, y lo único que aportaría son
 * dígitos que no le están permitidos.
 */
export interface PromptLeitmotif {
  id: string
  direction: string
}

export interface PromptSlot {
  id: string
  role: string
  tone: string
  claims: string[]
  leitmotif: PromptLeitmotif | null
}

export interface PromptPayload {
  dayMode: string
  /**
   * Día sin humor. Va como bandera propia y no deducido de `dayMode` a
   * propósito: el día que algo no meteorológico marque el día como serio, el
   * prompt no se entera — ya reacciona a la bandera, no a la causa.
   */
  seriousDay: boolean
  dialogues: PromptSlot[]
}

function toPromptSlot(slot: DialogueClaims): PromptSlot {
  return {
    id: slot.id,
    role: slot.role,
    tone: slot.tone,
    claims: slot.claims,
    leitmotif: slot.leitmotif === null ? null : { id: slot.leitmotif, direction: LEITMOTIF_DIRECTIONS[slot.leitmotif] },
  }
}

export function buildPromptPayload(claims: DayClaims): PromptPayload {
  return {
    dayMode: claims.dayMode,
    seriousDay: claims.serious,
    dialogues: claims.dialogues.map(toPromptSlot),
  }
}

// --- Esquema ---------------------------------------------------------------

/**
 * Solo los tres textos. Ni modo, ni papel, ni claims, ni razonamiento: el
 * papel se lo pone después el programa desde el plan, y todo lo demás ya
 * estaba decidido antes de preguntar.
 *
 * El esquema se queda en el subconjunto que la documentación de Groq lista
 * explícitamente (tipos, `enum`, `object`, `array`, `required`,
 * `additionalProperties`). Los límites de longitud y el recuento exacto no
 * se le piden al proveedor: los comprueba `validateDialogues`.
 */
export const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dialogues'],
  properties: {
    dialogues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', enum: [...DIALOGUE_IDS] },
          text: { type: 'string' },
        },
      },
    },
  },
} as const

export function buildRequestBody(payload: PromptPayload, model: string): Record<string, unknown> {
  return {
    model,
    reasoning_effort: 'low',
    stream: false,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'oak_dialogues', strict: true, schema: RESPONSE_SCHEMA },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  }
}

// --- La llamada ------------------------------------------------------------

function unavailable(reason: string): null {
  console.warn(`Oak AI unavailable/invalid → using local fallback (${reason})`)
  return null
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : error.message
  return String(error)
}

/**
 * Una variable en blanco es una variable sin poner. `GROQ_API_KEY=` y
 * `GROQ_API_KEY="   "` son lo mismo que no tenerla: un `.env` recién copiado
 * del ejemplo no debe mandar un Bearer de espacios a Groq.
 */
function envValue(name: string): string | null {
  const value = process.env[name]?.trim()
  return value === undefined || value === '' ? null : value
}

export async function generateOakDialogues(dayPlan: DayPlan): Promise<OakDialogues | null> {
  const apiKey = envValue('GROQ_API_KEY')
  if (apiKey === null) return unavailable('no hay GROQ_API_KEY')

  const model = envValue('GROQ_MODEL') ?? DEFAULT_MODEL
  // El mismo encargo sirve dos veces: es lo que se manda y es contra lo que
  // se comprueba la respuesta. Construirlo dos veces sería poder discrepar.
  const claims = buildDayClaims(dayPlan)
  const body = buildRequestBody(buildPromptPayload(claims), model)

  let response: Response
  try {
    // Sin reintentos: un segundo intento no arregla un 429 y el fallback ya
    // está listo.
    response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    return unavailable(describe(error))
  }

  if (!response.ok) return unavailable(`HTTP ${response.status}`)

  let content: unknown
  try {
    const payload = (await response.json()) as { choices?: { message?: { content?: unknown } }[] }
    content = payload.choices?.[0]?.message?.content
  } catch (error) {
    return unavailable(`cuerpo ilegible (${describe(error)})`)
  }

  if (typeof content !== 'string' || content.trim() === '') return unavailable('respuesta sin content')

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return unavailable('content no es JSON')
  }

  const check = validateDialogues(parsed)
  if (!check.ok) return unavailable(check.reason)

  // La forma estaba bien; ahora, si ha metido una entidad que nadie le
  // autorizó, también es una respuesta inválida.
  const factual = checkFactualFit(check.dialogues, claims.dialogues)
  if (!factual.ok) return unavailable(factual.reason)

  return check.dialogues
}
