import { useId } from 'react'

import type { ForecastFreshness } from '../../domain/forecast-freshness.ts'

import { correspondsToText, daysLateText, reloadOfferText } from './freshness-texts.ts'

import './FreshnessNotice.scss'

interface FreshnessNoticeProps {
  freshness: ForecastFreshness
  /** `forecast.date`: el aviso dice siempre la fecha absoluta. */
  forecastDate: string
  offerReload: boolean
  /** Lo que hace «Recargar». Por defecto, recargar la página. */
  onReload?: () => void
}

function reloadPage() {
  window.location.reload()
}

/**
 * Aviso antes del mapa (`010-spec.md`). Quien lo usa lo monta solo con la
 * previsión de dos días o más de retraso o con la oferta de recargar; si se
 * dan las dos cosas, van en el mismo bloque.
 *
 * Solo describe lo que la página sabe: la fecha de su dataset y cuántos días
 * lleva de retraso. Nunca dice qué hay publicado: la recarga se ofrece «para
 * comprobar», sin afirmar que exista una previsión más reciente.
 */
function FreshnessNotice({ freshness, forecastDate, offerReload, onReload = reloadPage }: FreshnessNoticeProps) {
  const titleId = useId()
  const veryLate = freshness.status === 'very-late'

  return (
    <div className="freshness-notice">
      <section
        className={`freshness-notice__box${veryLate ? ' freshness-notice__box--very-late' : ''}`}
        aria-labelledby={veryLate ? titleId : undefined}
      >
        <div className="freshness-notice__message">
          {veryLate ? (
            // Calendario tachado: el dataset es de otro día.
            <svg className="freshness-notice__icon freshness-notice__icon--large" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="3" y="5" width="18" height="16" />
              <path d="M3 10h18M8 3v4M16 3v4" />
              <path d="M9.5 13.5l5 5M14.5 13.5l-5 5" />
            </svg>
          ) : (
            // Flecha circular: recargar.
            <svg className="freshness-notice__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M20 12a8 8 0 1 1-2.3-5.6" />
              <path d="M20 4v5h-5" />
            </svg>
          )}
          <div className="freshness-notice__body">
            {veryLate && (
              <>
                <h2 id={titleId} className="freshness-notice__title">
                  {daysLateText(freshness.daysLate)}
                </h2>
                <p className="freshness-notice__text">{correspondsToText(forecastDate)}</p>
              </>
            )}
            {offerReload && <p className="freshness-notice__text">{reloadOfferText(forecastDate)}</p>}
          </div>
        </div>
        {offerReload && (
          <button type="button" className="freshness-notice__reload" onClick={onReload}>
            Recargar
          </button>
        )}
      </section>
    </div>
  )
}

export default FreshnessNotice
