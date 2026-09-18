import { useEffect, useRef, useState } from 'react'

import backgroundDesktop from '../../assets/shared/background-desktop.jpg'
import backgroundMobile from '../../assets/shared/background-mobile.jpg'

import './Loader.scss'

// Duración mínima para evitar un parpadeo instantáneo cuando la imagen ya
// está en caché — no sustituye la condición real (imagen lista), solo la
// retrasa un poco si hiciera falta (006-plan.md).
const MIN_VISIBLE_MS = 400

interface LoaderProps {
  onReady: () => void
}

/**
 * Pantalla de carga inicial (006-plan.md): además del spinner, precarga la
 * imagen de portada que usará `Landing` (móvil/desktop vía `<picture>`) y
 * avisa con `onReady` solo cuando esa imagen está lista y ya ha pasado
 * `MIN_VISIBLE_MS` — nunca por el simple paso del tiempo.
 */
function Loader({ onReady }: LoaderProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const notifiedRef = useRef(false)
  const [minDurationElapsed, setMinDurationElapsed] = useState(false)
  const [imageReady, setImageReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinDurationElapsed(true), MIN_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (imgRef.current?.complete) {
      setImageReady(true)
    }
  }, [])

  useEffect(() => {
    if (minDurationElapsed && imageReady && !notifiedRef.current) {
      notifiedRef.current = true
      onReady()
    }
  }, [minDurationElapsed, imageReady, onReady])

  return (
    <div className="loader" role="status" aria-label="Cargando">
      <div className="loader__pokeball" />
      <picture className="loader__preload" aria-hidden="true">
        {/* 767px debe coincidir con $breakpoint-tablet (_breakpoints.scss) */}
        <source media="(max-width: 767px)" srcSet={backgroundMobile} />
        <img
          ref={imgRef}
          src={backgroundDesktop}
          alt=""
          onLoad={() => setImageReady(true)}
          onError={() => setImageReady(true)}
        />
      </picture>
    </div>
  )
}

export default Loader
