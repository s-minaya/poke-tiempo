import { spriteSources } from '../../SpainMap/sprite-sources.ts'

import './EmptyResults.scss'

interface EmptyResultsProps {
  onClearFilters?: () => void
  /** Tras limpiar, el foco va al buscador: este bloque desaparece. */
  focusSearch: () => void
}

/**
 * Lo que ocupa el sitio de la lista cuando ningún lugar cumple los filtros.
 * Solo se monta en ese caso. La barra sigue encima, con sus controles y sus
 * filtros activos, así que también se puede salir quitando uno.
 */
function EmptyResults({ onClearFilters, focusSearch }: EmptyResultsProps) {
  function clear() {
    onClearFilters?.()
    focusSearch()
  }

  return (
    <div className="empty-results">
      <div className="empty-results__art" aria-hidden="true">
        <img className="empty-results__sprite" src={spriteSources.castform} alt="" width={92} height={92} />
        <span className="empty-results__mark">?</span>
      </div>
      <h3 className="empty-results__title">Ni rastro por aquí</h3>
      <p className="empty-results__text">Ningún lugar cumple a la vez estos filtros. Quita alguno o empieza de cero.</p>
      <button type="button" className="empty-results__clear" onClick={clear}>
        Limpiar filtros
      </button>
    </div>
  )
}

export default EmptyResults
