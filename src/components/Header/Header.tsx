import { useMemo } from 'react'

import type { ForecastFreshness } from '../../domain/forecast-freshness.ts'
import type { Forecast } from '../../domain/types.ts'

import { FRESHNESS_LABELS, oneDayLateText } from '../FreshnessNotice/freshness-texts.ts'
import { formatForecastHeadline } from './format-forecast-headline.ts'
import { formatGeneratedAt } from './format-generated-at.ts'
import { resolveThermalMood } from './thermal-mood.ts'

import './Header.scss'

interface HeaderProps {
  forecast: Forecast
  freshness: ForecastFreshness
}

/**
 * Cabecera de la página: "POKETIEMPO" a la izquierda y, a la derecha, para
 * qué fecha es la previsión y cuán fresca es (`010-spec.md`). La fecha sale
 * siempre de `forecast.date` y la hora de generación, de
 * `forecast.generatedAt`; la frescura solo decide la etiqueta y la frase de
 * un día de retraso. La línea de la fecha conserva el mood térmico que
 * predomina entre los 74 `temperature.maxC` (`thermal-mood.ts`); la
 * etiqueta y las frases van en la paleta de interfaz.
 */
function Header({ forecast, freshness }: HeaderProps) {
  const mood = useMemo(() => resolveThermalMood(forecast.locations.map((location) => location.temperature.maxC)), [forecast])
  const headline = useMemo(() => formatForecastHeadline(forecast.date), [forecast.date])
  const generated = useMemo(() => formatGeneratedAt(forecast.generatedAt), [forecast.generatedAt])
  const label = FRESHNESS_LABELS[freshness.status]

  return (
    <header className={`header header--${mood}`}>
      <h1 className="header__title">POKETIEMPO</h1>
      <div className="header__dateline">
        <p className="header__forecast">
          <span className="header__date">{headline}</span>
          {label && (
            <>
              {/* La coma, solo para el lector de pantalla: la etiqueta se lee
                  como parte de la frase, «…5 de octubre, hoy». El espacio,
                  visible, es por donde la etiqueta baja de línea si no cabe. */}
              <span className="header__separator">,</span>{' '}
              <span className={`header__label${label.late ? ' header__label--late' : ''}`}>
                {label.late && (
                  <svg className="header__label-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                )}
                {label.text}
              </span>
            </>
          )}
        </p>
        {freshness.status === 'late' && (
          <p className="header__delay">{oneDayLateText(forecast.date)}</p>
        )}
        <p className="header__generated">{generated}</p>
      </div>
    </header>
  )
}

export default Header
