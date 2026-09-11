import type { Forecast } from './domain/types.ts'

import SpainMap from './components/SpainMap/SpainMap.tsx'

import forecastData from './data/forecast.json'

function App() {
  return (
    <main>
      <h1>Poketiempo</h1>
      <SpainMap forecast={forecastData as Forecast} />
    </main>
  )
}

export default App
