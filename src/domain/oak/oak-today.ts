import type { DayMode } from './day-mode.ts'
import type { DialogueRole, OakDialogue, Tone } from './plan-dialogues.ts'

/**
 * Lo que se publica en `src/data/oak-today.json` y lo único que el frontend
 * llega a ver de la 007. No lleva los hechos ni el `DialoguePlan`: la
 * interfaz no los necesita y el JSON público no debe cargar con el andamiaje
 * que los produjo.
 *
 * `role` y `tone` no los decide quien redacta — salen del `DialoguePlan`,
 * igual que el `id`. Por eso el diálogo publicado es el `OakDialogue`
 * compartido más lo que ya tenía asignado en el plan, y no un tipo nuevo.
 * El frontend necesita el tono para elegir la pose de Oak, y lo recibe
 * resuelto: no lo deduce del texto ni del modo.
 */
export interface OakTodayDialogue extends OakDialogue {
  role: DialogueRole
  tone: Tone
}

export interface OakToday {
  /** Siempre igual que `forecast.date`: Oak habla del día que dibuja el mapa. */
  date: string
  /** ISO UTC del momento de la generación. */
  generatedAt: string
  /**
   * `'ai'` solo si la respuesta del proveedor pasó **nuestra** validación
   * completa. Un 200 no basta.
   */
  source: 'ai' | 'fallback'
  dayMode: DayMode
  /**
   * Día sin humor, copiado de `DayPlan.serious`. Viaja aparte del modo por
   * la misma razón que en el payload de la IA: quien lo lee reacciona a la
   * bandera, no a la causa.
   */
  serious: boolean
  dialogues: [OakTodayDialogue, OakTodayDialogue, OakTodayDialogue]
}
