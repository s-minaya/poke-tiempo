import './Credits.scss'

/**
 * Créditos de la página: fuentes de datos meteorológicos y autoría de la
 * cuenta original (`005-plan.md` → punto 6) — HTML semántico, sin URLs
 * inventadas.
 */
function Credits() {
  return (
    <footer className="credits">
      <p className="credits__line">Datos meteorológicos: AEMET · IPMA · Open-Meteo</p>
      <p className="credits__line">PokéTiempo original: Gabriel Ortega Díaz</p>
    </footer>
  )
}

export default Credits
