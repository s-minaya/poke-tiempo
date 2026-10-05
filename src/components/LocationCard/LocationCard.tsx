import { useId } from 'react'
import type { CSSProperties, KeyboardEvent, Ref } from 'react'

import type { LocationSummary } from './location-summary.ts'

import { spriteSources } from '../SpainMap/sprite-sources.ts'

import './LocationCard.scss'

interface LocationCardProps {
  summary: LocationSummary
  /**
   * Hacia qué lado del marcador se abre en la composición de dos columnas
   * — hacia donde hay más mapa libre. En la apilada no cuenta: ahí es una
   * hoja inferior a todo el ancho.
   */
  side: 'east' | 'west'
  /** Posición del marcador (`--anchor-x`, `--anchor-y`, `--anchor-clearance`), en fracciones del mapa. */
  style: CSSProperties
  onClose: () => void
  /** Para saber, al cerrar, si el foco estaba dentro de la tarjeta. */
  ref?: Ref<HTMLElement>
}

/**
 * La tarjeta de un lugar: nombre, área administrativa (solo si aporta algo),
 * el Pokémon con su condición, y mínima/máxima. Una sola tarjeta con dos vías
 * de llegada —el marcador del mapa o su fila en la lista— que llevan al mismo
 * sitio. Dónde se coloca lo decide su CSS según la composición (008-plan.md
 * → punto 6).
 *
 * No es un diálogo: no atrapa el foco ni lo recibe al abrirse. El foco se
 * queda en el marcador para poder seguir recorriendo el mapa, y lo que la
 * tarjeta muestra lo anuncia aparte una región viva (`SpainMap.tsx`).
 */
function LocationCard({ summary, side, style, onClose, ref }: LocationCardProps) {
  const titleId = useId()
  const hasTemperatures = summary.minC != null && summary.maxC != null

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') onClose()
  }

  return (
    <section ref={ref} className={`location-card location-card--${side}`} style={style} aria-labelledby={titleId} onKeyDown={handleKeyDown}>
      <div className="location-card__heading">
        <h2 id={titleId} className="location-card__name">
          {summary.name}
        </h2>
        {summary.administrativeArea && <p className="location-card__area">{summary.administrativeArea}</p>}
      </div>
      <button type="button" className="location-card__close" onClick={onClose} aria-label="Cerrar">
        <span aria-hidden="true">✕</span>
      </button>
      {summary.pokemonId && (
        <div className="location-card__weather">
          {/* Decorativo: el nombre del Pokémon va justo al lado en texto. */}
          <img className="location-card__sprite" src={spriteSources[summary.pokemonId]} alt="" width={56} height={56} />
          <div>
            <p className="location-card__pokemon">{summary.pokemonName}</p>
            <p className="location-card__condition">{summary.condition}</p>
          </div>
        </div>
      )}
      {hasTemperatures ? (
        <p className="location-card__temperatures">
          Mínima <strong>{summary.minC}°</strong> · Máxima <strong>{summary.maxC}°</strong>
        </p>
      ) : (
        <p className="location-card__temperatures">Sin previsión para hoy.</p>
      )}
    </section>
  )
}

export default LocationCard
