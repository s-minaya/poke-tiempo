import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'

import type { OakToday } from '../../domain/oak/oak-today.ts'

import textBlip from '../../assets/oak/oak-text-blip.mp3'

import OakDialogueBox from './components/OakDialogueBox.tsx'
import OakPortrait from './components/OakPortrait.tsx'
import { POSE_SOURCES, poseFor } from './oak-pose.ts'

import './ProfessorOak.scss'

/**
 * 30 ms por carácter: 160 caracteres se escriben en 4,8 s, muy por debajo de
 * los ~9 s del audio, que por eso no necesita bucle.
 */
export const MS_PER_CHAR = 30

// Debe coincidir con $oak-exit-ms (ProfessorOak.scss).
const EXIT_MS = 300

/**
 * El respiro entre aparecer y empezar a hablar. Mientras la portada se va,
 * su jingle se está apagando con ella (`Landing.tsx`); esta pausa deja que
 * el blip entre en silencio limpio, como el hueco que dejan los juegos
 * entre confirmar y la primera línea de texto.
 */
export const START_DELAY_MS = 200

// Acompaña a la escritura, no la tapa.
const BLIP_VOLUME = 0.3

interface ProfessorOakProps {
  today: OakToday
  /**
   * Falso durante el cruce desde la portada: la escena ya está montada debajo
   * para que el fundido la revele, pero Oak todavía no habla ni escucha.
   */
  ready: boolean
  onClose: () => void
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Una sola pista para toda la escena, no un sonido por carácter: el audio
 * es un blip continuo de ~9 s (freesound_community, "medium text blip"
 * #14855) que suena mientras se escribe y se corta cuando se deja de
 * escribir.
 */
function createBlip(): HTMLAudioElement {
  const audio = new Audio(textBlip)
  audio.preload = 'auto'
  audio.volume = BLIP_VOLUME
  return audio
}

/**
 * `play()` puede rechazarse (autoplay bloqueado) o ni siquiera devolver una
 * promesa (entornos sin audio completo). El sonido es decoración: pase lo que
 * pase, Oak sigue escribiendo.
 */
function play(audio: HTMLAudioElement): void {
  try {
    audio.play()?.catch(() => {})
  } catch {
    // Sin sonido, la escena sigue igual.
  }
}

function restart(audio: HTMLAudioElement): void {
  audio.currentTime = 0
  play(audio)
}

function stop(audio: HTMLAudioElement): void {
  audio.pause()
  audio.currentTime = 0
}

/**
 * La escena de Oak entre la portada y el mapa: los tres bocadillos de
 * `oak-today.json`, uno detrás de otro.
 *
 * No decide nada narrativo. El texto, el tono y si el día es serio llegan
 * hechos; aquí solo se elige la cara que corresponde, se escribe letra a
 * letra y se espera a que el usuario pase.
 *
 * Un clic, un toque, Intro o Espacio hacen una sola cosa cada vez: si Oak
 * está escribiendo, completa el texto; si ya ha terminado, pasa al
 * siguiente; y tras el tercero, deja ver el mapa.
 */
function ProfessorOak({ today, ready, onClose }: ProfessorOakProps) {
  const [reducedMotion] = useState(prefersReducedMotion)
  // Una instancia mutable del navegador, no estado de React: vive en un ref
  // y se crea la primera vez que hace falta sonar.
  const blipRef = useRef<HTMLAudioElement | null>(null)
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(0)
  const [closing, setClosing] = useState(false)
  const [settled, setSettled] = useState(false)
  const sceneRef = useRef<HTMLDivElement>(null)
  const hintId = useId()

  const dialogue = today.dialogues[index]
  const length = Array.from(dialogue.text).length
  // Con movimiento reducido no hay máquina de escribir: el texto está entero
  // desde el principio, y por tanto nunca suena el blip.
  const shown = reducedMotion ? length : Math.min(typed, length)
  const finished = shown >= length
  const typing = settled && !finished && !closing
  const last = index === today.dialogues.length - 1

  // Oak aparece, espera un momento y entonces habla. Con movimiento
  // reducido el texto ya está entero, así que esta espera no retiene nada.
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => setSettled(true), START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [ready])

  // La máquina de escribir. Se para sola al completar el texto: `typing`
  // pasa a falso y la limpieza cancela el intervalo.
  useEffect(() => {
    if (!typing) return
    const timer = setInterval(() => setTyped((count) => count + 1), MS_PER_CHAR)
    return () => clearInterval(timer)
  }, [typing])

  // El audio sigue exactamente a la escritura: empieza desde 0 cuando empieza
  // un bocadillo, y se para y se rebobina cuando deja de escribirse — porque
  // ha terminado, porque el usuario lo ha completado, o porque la escena se
  // desmonta.
  useEffect(() => {
    if (!typing) return
    const blip = (blipRef.current ??= createBlip())
    restart(blip)
    return () => stop(blip)
  }, [typing])

  // Solo se precargan las caras de hoy: el cambio de pose no parpadea.
  useEffect(() => {
    const sources = new Set(today.dialogues.map((entry) => POSE_SOURCES[poseFor(entry.tone, today.serious)]))
    for (const source of sources) {
      const image = new Image()
      image.src = source
    }
  }, [today])

  useEffect(() => {
    if (ready) sceneRef.current?.focus()
  }, [ready])

  function advance() {
    if (!ready || closing) return

    if (!finished) {
      setTyped(length)
      return
    }

    if (!last) {
      setIndex(index + 1)
      setTyped(0)
      return
    }

    if (reducedMotion) {
      onClose()
      return
    }
    setClosing(true)
  }

  const finishClosing = useEffectEvent(() => onClose())

  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(() => finishClosing(), EXIT_MS)
    return () => clearTimeout(timer)
  }, [closing])

  // Un único oyente de teclado para toda la escena, y ningún botón dentro:
  // así Intro o Espacio no pueden disparar a la vez un clic nativo y este
  // manejador. Mantener la tecla pulsada tampoco pasa bocadillos en cadena.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (event.repeat) return
    advance()
  })

  useEffect(() => {
    if (!ready) return
    const listener = (event: KeyboardEvent) => onKeyDown(event)
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [ready])

  const className = ['professor-oak', ready && 'professor-oak--ready', closing && 'professor-oak--closing']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={sceneRef}
      className={className}
      role="dialog"
      aria-modal="true"
      // La caja no lleva placa con el nombre: quien no ve la escena no
      // sabría de quién es la voz, así que el diálogo la nombra aquí.
      aria-label="Profesor Oak"
      aria-describedby={hintId}
      aria-hidden={!ready}
      tabIndex={-1}
      onClick={advance}
    >
      <div className="professor-oak__stage">
        <OakPortrait pose={poseFor(dialogue.tone, today.serious)} />
        <OakDialogueBox
          text={dialogue.text}
          shown={shown}
          finished={ready && finished && !closing}
          last={last}
          announce={ready}
          hintId={hintId}
        />
      </div>
    </div>
  )
}

export default ProfessorOak
