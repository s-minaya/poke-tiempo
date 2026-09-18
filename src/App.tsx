import { useEffect, useState } from 'react'

import type { Forecast } from './domain/types.ts'

import Landing from './components/Landing/Landing.tsx'
import Loader from './components/Loader/Loader.tsx'
import WeatherApp from './components/WeatherApp/WeatherApp.tsx'

import forecastData from './data/forecast.json'

type EntryStage = 'loading' | 'landing' | 'entering' | 'app'

// Duración del cruce landing → WeatherApp (006-plan.md) — el loader no
// necesita una constante equivalente: su salida no se demora, `Landing` ya
// está montada debajo y el propio fundido de salida del loader (Loader.scss)
// no depende de ningún cambio de stage.
const TRANSITION_MS = 350

/**
 * Orquesta el flujo de entrada (006-plan.md): loader → portada → aplicación.
 * Recargar la página siempre vuelve a `'loading'` — no hay persistencia de
 * "portada ya vista", es intencionado.
 */
function App() {
  const forecast = forecastData as Forecast
  const [stage, setStage] = useState<EntryStage>('loading')

  useEffect(() => {
    if (stage !== 'entering') {
      return
    }

    const timer = setTimeout(() => setStage('app'), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [stage])

  return (
    <>
      {stage === 'loading' && <Loader onReady={() => setStage('landing')} />}
      {(stage === 'landing' || stage === 'entering') && (
        <Landing onStart={() => setStage('entering')} leaving={stage === 'entering'} />
      )}
      {(stage === 'entering' || stage === 'app') && <WeatherApp forecast={forecast} />}
    </>
  )
}

export default App
