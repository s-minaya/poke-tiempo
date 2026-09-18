import type { Forecast } from '../../domain/types.ts'

import Credits from '../Credits/Credits.tsx'
import Header from '../Header/Header.tsx'
import Legend from '../Legend/Legend.tsx'
import SpainMap from '../SpainMap/SpainMap.tsx'

import './WeatherApp.scss'

interface WeatherAppProps {
  forecast: Forecast
}

function WeatherApp({ forecast }: WeatherAppProps) {
  return (
    <main>
      {/* Grid con nombres de área (WeatherApp.scss): cabecera arriba, ocupando
          todo el ancho; leyenda bajo el título; mapa como cuerpo
          (mission.md). Cada componente fija su propio `grid-area` en su
          `.scss` — este contenedor solo define la plantilla. `Credits`
          comparte celda con `SpainMap` (Credits.scss): montado después en
          el DOM para pintarse encima. */}
      <div className="app__layout">
        <Header forecast={forecast} />
        <Legend forecast={forecast} />
        <SpainMap forecast={forecast} />
        <Credits />
      </div>
    </main>
  )
}

export default WeatherApp
