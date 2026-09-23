import { useEffect, useRef } from 'react'

import backgroundDesktop from '../../assets/shared/background-desktop.jpg'
import backgroundMobile from '../../assets/shared/background-mobile.jpg'
import gameStartSound from '../../assets/shared/game-start.mp3'

import './Landing.scss'

interface LandingProps {
  onStart: () => void
  leaving?: boolean
}

/**
 * La salida de la portada dura 350 ms ($landing-fade-ms en Landing.scss,
 * TRANSITION_MS en App.tsx), pero este efecto no arranca con ella: se monta
 * el mapa entero en el mismo commit, y medido en el build de producción el
 * fundido no empieza hasta ~100 ms después del clic, con la portada ya
 * desmontándose a los ~370. Un fundido de 350 ms se quedaría cortado a
 * media bajada —el chasquido que se trata de evitar—, así que baja en 250 y
 * los últimos milisegundos de la imagen se van ya en silencio.
 */
const FADE_MS = 250

// Diez escalones de volumen. No hay que seguir ninguna animación de CSS con
// precisión: solo bajar sin que se oiga el escalón.
const FADE_STEP_MS = 25

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function stop(audio: HTMLAudioElement): void {
  audio.pause()
  audio.currentTime = 0
}

/**
 * Portada fullscreen (006-plan.md): cuando se monta, la imagen ya está en
 * caché del navegador (la precargó `Loader`), así que no necesita ninguna
 * lógica de carga propia. `leaving` la deja de fondo durante el cruce hacia
 * la escena siguiente — ya no interactiva, fuera del árbol de accesibilidad.
 */
function Landing({ onStart, leaving = false }: LandingProps) {
  // El jingle vive en un ref, no en estado: es una instancia mutable del
  // navegador, y hay que conservarla para poder apagarla al salir.
  const jingleRef = useRef<HTMLAudioElement | null>(null)

  function handleStart() {
    const jingle = new Audio(gameStartSound)
    jingleRef.current = jingle
    // `play()` puede no devolver una promesa real (entornos sin soporte
    // completo de audio) — el efecto es puramente decorativo, así que un
    // fallo o un bloqueo del navegador nunca debe impedir continuar.
    jingle.play()?.catch(() => {})
    onStart()
  }

  /**
   * El jingle dura ~1,4 s y la portada se va en 350 ms: sin esto, su cola
   * se oiría encima de la escena siguiente. Se apaga con la imagen, no
   * esperando a su `ended` — nadie tiene que esperar a que termine un
   * sonido para seguir.
   *
   * Si el navegador bloqueó el `play()`, aquí no hay nada que apagar y el
   * cruce sigue exactamente igual.
   */
  useEffect(() => {
    if (!leaving) return
    const jingle = jingleRef.current
    if (!jingle) return

    // Con movimiento reducido no hay nada que acompañar: la portada
    // desaparece sin transición, y el jingle se corta con ella.
    if (prefersReducedMotion()) {
      stop(jingle)
      return
    }

    const steps = Math.round(FADE_MS / FADE_STEP_MS)
    const from = jingle.volume
    let step = 0
    const timer = setInterval(() => {
      step += 1
      jingle.volume = Math.max(from * (1 - step / steps), 0)
      if (step >= steps) {
        clearInterval(timer)
        stop(jingle)
      }
    }, FADE_STEP_MS)

    // También al desmontar: la portada se quita justo al acabar el fundido,
    // y el sonido no puede sobrevivirla.
    return () => {
      clearInterval(timer)
      stop(jingle)
    }
  }, [leaving])

  return (
    <div className={`landing${leaving ? ' landing--leaving' : ''}`} aria-hidden={leaving}>
      <picture className="landing__picture">
        {/* 767px debe coincidir con $breakpoint-tablet (_breakpoints.scss) */}
        <source media="(max-width: 767px)" srcSet={backgroundMobile} />
        <img className="landing__image" src={backgroundDesktop} alt="" />
      </picture>
      <button type="button" className="landing__button" onClick={handleStart} disabled={leaving}>
        EMPEZAR
      </button>
    </div>
  )
}

export default Landing
