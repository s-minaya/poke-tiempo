import { useEffect, useEffectEvent, useState } from 'react'

import type { Forecast } from './domain/types.ts'

import { canShowOak } from './domain/forecast-freshness.ts'
import { useForecastFreshness } from './components/FreshnessNotice/use-forecast-freshness.ts'

import FreshnessAnnouncement from './components/FreshnessAnnouncement/FreshnessAnnouncement.tsx'
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
 * `read-oak-today.ts`), o la previsión no está al día (`canShowOak`),
 * EMPEZAR lleva directamente al mapa.
 */
function App() {
  const forecast = forecastData as Forecast
  const oakToday = readOakToday(oakData, forecast.date)
  const [stage, setStage] = useState<EntryStage>('loading')
  // La frescura con la pestaña abierta (`use-forecast-freshness.ts`).
  const { freshness, offerReload } = useForecastFreshness(forecast.date, forecast.generatedAt)
  // Si Oak forma parte de esta entrada. Se decide al pulsar EMPEZAR y después
  // solo puede pasar a falso.
  const [withOak, setWithOak] = useState(false)

  // La previsión deja de estar al día con Oak en escena, o a punto de
  // entrar: la escena se cierra y queda el mapa. Ajuste durante el render,
  // para que Oak no llegue a pintarse con la frescura nueva. No vuelve aunque
  // la previsión vuelva a estar al día.
  if (withOak && !canShowOak(freshness)) {
    setWithOak(false)
    if (stage === 'oak') setStage('app')
  }

  function start() {
    setWithOak(oakToday !== null && canShowOak(freshness))
    setStage('entering')
  }

  // Al terminar el cruce, con lo que valga `withOak` en ese momento: si la
  // frescura cambia durante el cruce, el temporizador no vuelve a empezar.
  const finishEntering = useEffectEvent(() => setStage(withOak ? 'oak' : 'app'))

  useEffect(() => {
    if (stage !== 'entering') {
      return
    }

    const timer = setTimeout(() => finishEntering(), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [stage])

  const oakOnStage = withOak && (stage === 'entering' || stage === 'oak')

  return (
    <>
      {/* Montada desde la carga y en todas las etapas, como hija directa del
          fragmento: fuera de lo que se vuelve inerte u oculto —`.app` con Oak
          delante, `.landing` al irse y la escena de Oak mientras entra—, así
          un cambio de frescura se anuncia también con Oak en escena. */}
      <FreshnessAnnouncement forecastDate={forecast.date} freshness={freshness} offerReload={offerReload} />
      {stage === 'loading' && <Loader onReady={() => setStage('landing')} />}
      {(stage === 'landing' || stage === 'entering') && (
        <Landing onStart={start} leaving={stage === 'entering'} />
      )}
      {(stage === 'entering' || stage === 'oak' || stage === 'app') && <WeatherApp forecast={forecast} freshness={freshness} offerReload={offerReload} inert={oakOnStage} />}
      {oakToday && oakOnStage && <ProfessorOak today={oakToday} ready={stage === 'oak'} onClose={() => setStage('app')} />}
    </>
  )
}

export default App
