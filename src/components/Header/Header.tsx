import { useMemo } from 'react'

import type { Forecast } from '../../domain/types.ts'

import { formatForecastHeadline } from './format-forecast-headline.ts'
import { resolveThermalMood } from './thermal-mood.ts'

import './Header.scss'

interface HeaderProps {
  forecast: Forecast
}

/**
 * Cabecera de la página: "POKETIEMPO" a la izquierda y la línea de
 * previsión a la derecha (`mission.md`), ambas con el mismo aspecto
 * dinámico — el mood térmico que predomina entre los 74 `temperature.maxC`
 * del día (`thermal-mood.ts`, capa de presentación, no dominio).
 */
function Header({ forecast }: HeaderProps) {
  const mood = useMemo(() => resolveThermalMood(forecast.locations.map((location) => location.temperature.maxC)), [forecast])
  const headline = useMemo(() => formatForecastHeadline(forecast.date), [forecast.date])

  return (
    <header className={`header header--${mood}`}>
      <h1 className="header__title">POKETIEMPO</h1>
      <p className="header__forecast">{headline}</p>
    </header>
  )
}

export default Header
