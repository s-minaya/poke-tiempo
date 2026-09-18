import backgroundDesktop from '../../assets/shared/background-desktop.jpg'
import backgroundMobile from '../../assets/shared/background-mobile.jpg'
import gameStartSound from '../../assets/shared/game-start.mp3'

import './Landing.scss'

interface LandingProps {
  onStart: () => void
  leaving?: boolean
}

/**
 * Portada fullscreen (006-plan.md): cuando se monta, la imagen ya está en
 * caché del navegador (la precargó `Loader`), así que no necesita ninguna
 * lógica de carga propia. `leaving` la deja de fondo durante el cruce hacia
 * `WeatherApp` — ya no interactiva, fuera del árbol de accesibilidad.
 */
function Landing({ onStart, leaving = false }: LandingProps) {
  function handleStart() {
    // `play()` puede no devolver una promesa real (entornos sin soporte
    // completo de audio) — el efecto es puramente decorativo, así que un
    // fallo o un bloqueo del navegador nunca debe impedir continuar.
    new Audio(gameStartSound).play()?.catch(() => {})
    onStart()
  }

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
