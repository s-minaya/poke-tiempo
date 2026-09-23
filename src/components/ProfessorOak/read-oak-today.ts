import type { OakToday } from '../../domain/oak/oak-today.ts'
import { isTone } from './oak-pose.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDialogue(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.text === 'string' && value.text.trim() !== '' && isTone(value.tone)
}

/**
 * El `oak-today.json` que la escena sabe contar, o `null` si no lo es.
 *
 * El JSON se importa en el bundle, pero lo escribe otro proceso y en otro
 * momento: el commit que cambia el contrato llega a `main` antes que la
 * primera generación con el contrato nuevo, y un deploy por push publica el
 * JSON que haya. Entre medias, la escena no se inventa lo que falta — sin
 * `tone` no deduce la pose del texto, y sin `serious` no presupone que el día
 * sea tranquilo —: simplemente no sale, y EMPEZAR lleva al mapa como antes
 * de la 007.
 *
 * Tampoco sale si habla de otro día que el mapa. El workflow los publica
 * juntos, así que no debería pasar; si pasara, Oak estaría comentando un
 * mapa que el usuario no está viendo.
 */
export function readOakToday(data: unknown, forecastDate: string): OakToday | null {
  if (!isRecord(data)) return null
  if (data.date !== forecastDate) return null
  if (typeof data.serious !== 'boolean') return null

  const { dialogues } = data
  if (!Array.isArray(dialogues) || dialogues.length !== 3 || !dialogues.every(isDialogue)) return null

  return data as unknown as OakToday
}
