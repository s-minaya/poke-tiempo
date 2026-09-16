import type { Forecast } from './domain/types.ts'

import Header from './components/Header/Header.tsx'
import Legend from './components/Legend/Legend.tsx'
import SpainMap from './components/SpainMap/SpainMap.tsx'

import forecastData from './data/forecast.json'

import './App.scss'

function App() {
  const forecast = forecastData as Forecast

  return (
    <main>
      {/* Grid con nombres de área (App.scss): cabecera arriba, ocupando
          todo el ancho; leyenda bajo el título; mapa como cuerpo
          (mission.md). Cada componente fija su propio `grid-area` en su
          `.scss` — este contenedor solo define la plantilla. */}
      <div className="app__layout">
        <Header forecast={forecast} />
        <Legend forecast={forecast} />
        <SpainMap forecast={forecast} />
      </div>
    </main>
  )
}

export default App
