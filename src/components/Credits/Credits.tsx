import './Credits.scss'

/**
 * Pie de la página: la autoría de la cuenta original y el disclaimer de
 * Pokémon, en HTML semántico. La cita de los datos va bajo el mapa
 * (`SpainMap`), junto a lo que los muestra.
 */
function Credits() {
  return (
    <footer className="credits">
      <p className="credits__line">PokéTiempo original: Gabriel Ortega Díaz</p>
      <p className="credits__line">
        PokéTiempo es un proyecto fan no oficial, sin afiliación ni patrocinio de los titulares de los derechos de Pokémon. Pokémon, sus personajes y sus nombres pertenecen a sus respectivos titulares.
      </p>
    </footer>
  )
}

export default Credits
