import type { DayMode } from './day-mode.ts'
import type { DialogueRole, OakDialogue } from './plan-dialogues.ts'

/**
 * Lo que se publica en `src/data/oak-today.json` y lo único que el frontend
 * llega a ver de la 007. No lleva los hechos ni el `DialoguePlan`: la
 * interfaz no los necesita y el JSON público no debe cargar con el andamiaje
 * que los produjo.
 *
 * `role` no lo decide quien redacta — sale del `DialoguePlan`, igual que el
 * `id`. Por eso el diálogo publicado es el `OakDialogue` compartido más el
 * papel que ya tenía asignado en el plan, y no un tipo nuevo.
 */
export interface OakTodayDialogue extends OakDialogue {
  role: DialogueRole
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
  dialogues: [OakTodayDialogue, OakTodayDialogue, OakTodayDialogue]
}
