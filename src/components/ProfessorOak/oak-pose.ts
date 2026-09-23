import type { Tone } from '../../domain/oak/plan-dialogues.ts'

import confused from '../../assets/oak/oak-confused.webp'
import epic from '../../assets/oak/oak-epic.webp'
import neutral from '../../assets/oak/oak-neutral.webp'
import playful from '../../assets/oak/oak-playful.webp'
import warning from '../../assets/oak/oak-warning.webp'

/**
 * Las caras de Oak que usa la escena. `oak-tired.webp` también vive en
 * `assets/oak/`, pero ningún tono la pide todavía y no se importa: una pose
 * no entra en el mapping solo porque exista.
 */
export type OakPose = 'neutral' | 'confused' | 'epic' | 'warning' | 'playful'

/**
 * Un tono, una cara. Es un `Record` completo a propósito: si el dominio
 * añade un tono, esto deja de compilar hasta que alguien le elija pose.
 */
const TONE_POSE: Record<Tone, OakPose> = {
  neutral: 'neutral',
  cientifico: 'confused',
  epico: 'epic',
  consejo: 'warning',
  guasa: 'playful',
}

export const POSE_SOURCES: Record<OakPose, string> = {
  neutral,
  confused,
  epic,
  warning,
  playful,
}

export function isTone(value: unknown): value is Tone {
  return typeof value === 'string' && Object.hasOwn(TONE_POSE, value)
}

/**
 * La cara que pone Oak al decir un bocadillo.
 *
 * En un día serio no hay sonrisa ni asombro: lo que pide atención —`consejo`,
 * y el `epico` de un aviso rojo— va con la cara de aviso, y el resto con la
 * neutra. El plan ya impide que un día serio lleve `guasa`, pero si llegara,
 * aquí tampoco saldría la cara de broma: la pose no depende de que el plan
 * acierte.
 */
export function poseFor(tone: Tone, serious: boolean): OakPose {
  if (!serious) return TONE_POSE[tone]
  return tone === 'consejo' || tone === 'epico' ? 'warning' : 'neutral'
}
