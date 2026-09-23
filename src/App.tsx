import { useEffect, useState } from 'react'

import type { Forecast } from './domain/types.ts'

import Landing from './components/Landing/Landing.tsx'
import Loader from './components/Loader/Loader.tsx'
import ProfessorOak from './components/ProfessorOak/ProfessorOak.tsx'
import { readOakToday } from './components/ProfessorOak/read-oak-today.ts'
import WeatherApp from './components/WeatherApp/WeatherApp.tsx'

import forecastData from './data/forecast.json'
import oakData from './data/oak-today.json'

type EntryStage = 'loading' | 'landing' | 'entering' | 'oak' | 'app'

// Duración del cruce landing → escena siguiente (006-plan.md) — el loader no
// necesita una constante equivalente: su salida no se demora, `Landing` ya
// está montada debajo y el propio fundido de salida del loader (Loader.scss)
// no depende de ningún cambio de stage.
const TRANSITION_MS = 350

/**
 * Orquesta el flujo de entrada (006-plan.md, 007): loader → portada → Oak →
 * mapa. Recargar la página siempre vuelve a `'loading'` — no hay
 * persistencia de "portada ya vista", es intencionado.
 *
 * El mapa se monta en cuanto se pulsa EMPEZAR y se queda debajo de Oak,
 * inerte: cuando Oak termina, la escena se funde y el mapa ya está ahí. Si
 * `oak-today.json` no trae lo que la escena necesita (ver
 * `read-oak-today.ts`), EMPEZAR lleva directamente al mapa.
 */
function App() {
  const forecast = forecastData as Forecast
  const oakToday = readOakToday(oakData, forecast.date)
  const [stage, setStage] = useState<EntryStage>('loading')

  useEffect(() => {
    if (stage !== 'entering') {
      return
    }

    const timer = setTimeout(() => setStage(oakToday ? 'oak' : 'app'), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [stage, oakToday])

  const oakOnStage = oakToday !== null && (stage === 'entering' || stage === 'oak')

  return (
    <>
      {stage === 'loading' && <Loader onReady={() => setStage('landing')} />}
      {(stage === 'landing' || stage === 'entering') && (
        <Landing onStart={() => setStage('entering')} leaving={stage === 'entering'} />
      )}
      {(stage === 'entering' || stage === 'oak' || stage === 'app') && <WeatherApp forecast={forecast} inert={oakOnStage} />}
      {oakToday && oakOnStage && <ProfessorOak today={oakToday} ready={stage === 'oak'} onClose={() => setStage('app')} />}
    </>
  )
}

export default App
