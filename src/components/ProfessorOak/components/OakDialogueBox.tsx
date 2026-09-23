import './OakDialogueBox.scss'

interface OakDialogueBoxProps {
  text: string
  /** Cuántos caracteres se ven ya. Se cuentan por punto de código, no por unidad UTF-16. */
  shown: number
  /** El texto está entero y se puede seguir: aparece el ▼. */
  finished: boolean
  last: boolean
  /** Solo cuando la escena ya está en pantalla: antes no hay nada que anunciar. */
  announce: boolean
  hintId: string
}

/**
 * El cuadro de texto de los juegos clásicos, en HTML y SCSS.
 *
 * Lo que se escribe letra a letra es solo lo que se ve. Un lector de
 * pantalla recibe el bocadillo entero de una vez, en una región viva: oír
 * la misma frase repetida cada 30 ms, un carácter más larga, no es una
 * lectura sino ruido.
 */
function OakDialogueBox({ text, shown, finished, last, announce, hintId }: OakDialogueBoxProps) {
  const characters = Array.from(text)

  return (
    <div className="oak-dialogue">
      {/* Lo que falta por escribir ya ocupa su sitio, invisible: las líneas
          se cortan desde el principio donde se cortarán al final, y ninguna
          palabra salta de renglón a media escritura. */}
      <p className="oak-dialogue__text" aria-hidden="true">
        <span className="oak-dialogue__typed">{characters.slice(0, shown).join('')}</span>
        <span className="oak-dialogue__pending">{characters.slice(shown).join('')}</span>
      </p>

      <p className="oak-dialogue__sr" aria-live="polite">
        {announce ? text : ''}
      </p>
      <p className="oak-dialogue__sr" id={hintId}>
        {last ? 'Intro, Espacio o un toque para ver el mapa.' : 'Intro, Espacio o un toque para continuar.'}
      </p>

      {finished && <span className="oak-dialogue__next" aria-hidden="true" />}
    </div>
  )
}

export default OakDialogueBox
