import type { PokedexId } from './pokedex.ts'
import type { AlertsAvailability, LocationForecast, MarineAvailability, OfficialAlert, SkyCondition, Temperature } from './types.ts'

/**
 * Motor de asignación de Pokémon (`003-plan.md`): traduce el `LocationForecast`
 * de un lugar en la lista de Pokémon que le corresponden ese día
 * (`forecast.date` — mañana, no hoy, ver `target-date.ts`). Cada eje
 * meteorológico se evalúa por su cuenta y aporta como mucho un `PokedexId` —
 * no hay prioridad entre ejes ni un único ganador, `assignPokemon` simplemente
 * junta lo que cada uno produzca. Un eje con dato `null` nunca fabrica una
 * asignación.
 */

/**
 * `temperature.maxC` es el único campo obligatorio de `LocationForecast`, así
 * que esta es la única regla que siempre devuelve un Pokémon. La franja
 * original de `roadmap.md` ("40-43° Groudon · más de 44° Groudon primigenio")
 * deja 44°C sin cubrir — se cierra extendiendo Groudon hasta 44°C inclusive,
 * el único cambio que respeta el "más de 44" literal sin dejar hueco.
 */
export function assignByTemperature(temperature: Temperature): PokedexId {
  const { maxC } = temperature
  if (maxC <= 7) return 'snorunt'
  if (maxC <= 14) return 'solrock'
  if (maxC <= 25) return 'castform-sun'
  if (maxC <= 29) return 'charmander'
  if (maxC <= 33) return 'charmeleon'
  if (maxC <= 39) return 'magmar'
  if (maxC <= 44) return 'groudon'
  return 'groudon-primal'
}

// 'despejado' también dispara Castform (forma sol) — además de la franja
// de temperatura (`assignByTemperature`, 15–25°C), no en su lugar: un día
// despejado fuera de esa franja también es "castform-sun". `assignPokemon`
// deduplica, así que un día despejado dentro de la franja no produce la
// forma dos veces.
export function assignBySky(sky: SkyCondition | null): PokedexId | null {
  switch (sky) {
    case 'despejado':
      return 'castform-sun'
    case 'poco_nuboso':
      return 'altaria'
    case 'nuboso':
    case 'cubierto':
      return 'castform'
    default:
      return null
  }
}

// Solo asigna con acumulado real (`mm > 0`) — un `0` confirmado es "no
// llovió", no "llovió poco".
export function assignByRain(precipitation: LocationForecast['precipitation']): PokedexId | null {
  const mm = precipitation?.mm ?? null
  if (mm === null || mm <= 0) return null
  if (mm <= 10) return 'castform-rain'
  if (mm <= 60) return 'kyogre'
  return 'kyogre-primal'
}

// Mismo criterio que la lluvia: `cm > 0` requerido, nunca se cae a
// `snow.present` cuando `cm` es `null`.
export function assignBySnow(snow: LocationForecast['snow']): PokedexId | null {
  const cm = snow?.cm ?? null
  if (cm === null || cm <= 0) return null
  if (cm <= 10) return 'cryogonal'
  return 'abomasnow'
}

// `wind.speedKmh` (sostenido), nunca `gustKmh` (racha).
export function assignByWind(wind: LocationForecast['wind']): PokedexId | null {
  const speedKmh = wind?.speedKmh ?? null
  if (speedKmh === null || speedKmh < 20) return null
  if (speedKmh < 40) return 'hoppip'
  if (speedKmh < 60) return 'dragonite'
  if (speedKmh <= 90) return 'rayquaza'
  return 'tornadus'
}

/**
 * Hippowdon tiene dos caminos independientes, cualquiera de los dos basta
 * — mismo patrón que Mega Gyarados (`assignByMarine`):
 *
 * 1. `calima === true` (código de cielo 83 en alguna hora diurna de la
 *    horaria de AEMET, ver `aemet.ts`).
 * 2. Un `OfficialAlert` de `phenomenon === 'calima'` activo el día del
 *    forecast (`startsAt`/`endsAt` solapan `date`, misma `isActiveOnDate`
 *    que usa Mega Gyarados — sin reimplementarla) — cualquier nivel
 *    (amarillo, naranja, rojo) basta, a diferencia del aviso costero de
 *    Mega Gyarados, que exige rojo. Un aviso que empieza otro día no
 *    cuenta. `alerts.status` distinto de `'ok'` nunca fabrica calima.
 *
 * No hay propagación entre lugares: `alerts` ya llega filtrado a la zona
 * propia de cada lugar (`buildAlertsAvailability`, `fetch-forecast.ts`).
 */
export function assignByCalima(calima: boolean | null, alerts: AlertsAvailability, date: string): PokedexId | null {
  if (calima === true) return 'hippowdon'
  return hasActiveCalimaAlert(alerts, date) ? 'hippowdon' : null
}

// "Viento cálido": ninguna fuente (AEMET/IPMA/Open-Meteo) da esto como
// categoría propia — regla inferida combinando dos ejes ya existentes,
// a diferencia de DANA ("no se infiere combinando lluvia+tormenta",
// roadmap.md), que sigue deshabilitada.
export const WARM_WIND_SPEED_THRESHOLD_KMH = 40
export const WARM_WIND_TEMPERATURE_THRESHOLD_C = 30

export function assignByWarmWind(wind: LocationForecast['wind'], temperature: Temperature): PokedexId | null {
  const speedKmh = wind?.speedKmh ?? null
  if (speedKmh === null || speedKmh < WARM_WIND_SPEED_THRESHOLD_KMH) return null
  if (temperature.maxC < WARM_WIND_TEMPERATURE_THRESHOLD_C) return null
  return 'moltres'
}

// DANA sigue deshabilitada (`roadmap.md`): tormenta siempre asigna Zapdos,
// nunca Thundurus.
export function assignByStorm(storm: boolean | null): PokedexId | null {
  return storm === true ? 'zapdos' : null
}

export function assignByFog(fog: boolean | null): PokedexId | null {
  return fog === true ? 'castform-ice' : null
}

// Coincide con el paso de "marejada" a "fuerte marejada" en la escala
// Douglas de estado de la mar (AEMET/Puertos del Estado).
export const GYARADOS_WAVE_HEIGHT_THRESHOLD_M = 1.25

// Siguiente escalón de la misma escala Douglas: "muy fuerte marejada"
// empieza en 2,5 m. Segundo camino (físico) hacia Mega Gyarados, además
// del aviso rojo costero oficial.
export const GYARADOS_MEGA_WAVE_HEIGHT_THRESHOLD_M = 2.5

// Compara los prefijos YYYY-MM-DD como texto, sin pasar por Date: IPMA
// entrega startsAt/endsAt sin offset (ej. "2026-09-08T12:00:00"), que
// `new Date(...)` interpretaría con la zona horaria del entorno de
// ejecución en vez de la del aviso — justo la ambigüedad que se evita
// quedándose en el día calendario, sin necesidad de zona horaria.
function isActiveOnDate(alert: OfficialAlert, date: string): boolean {
  return alert.startsAt.slice(0, 10) <= date && alert.endsAt.slice(0, 10) >= date
}

function hasActiveRedCoastalAlert(alerts: AlertsAvailability, date: string): boolean {
  return (
    alerts.status === 'ok' &&
    alerts.alerts.some((alert) => alert.level === 'rojo' && alert.phenomenon === 'costero' && isActiveOnDate(alert, date))
  )
}

function hasActiveCalimaAlert(alerts: AlertsAvailability, date: string): boolean {
  return (
    alerts.status === 'ok' && alerts.alerts.some((alert) => alert.phenomenon === 'calima' && isActiveOnDate(alert, date))
  )
}

/**
 * Mega Gyarados tiene dos caminos independientes, cualquiera de los dos
 * basta:
 *
 * 1. El aviso oficial de "muy fuerte" (`002-plan.md`: "la oficialidad se
 *    conserva ahí, no en el dato físico"), así que dispara aunque la
 *    consulta física de oleaje de esta ejecución haya fallado — no depende
 *    de `marine.status`. Solo cuenta si el aviso está activo el día del
 *    forecast (`startsAt`/`endsAt` solapan `date`); un aviso rojo que
 *    empieza otro día no adelanta Mega Gyarados.
 * 2. El dato físico, si llega a `GYARADOS_MEGA_WAVE_HEIGHT_THRESHOLD_M`
 *    (2,5 m) — sin necesitar ningún aviso.
 *
 * Sin ninguno de los dos, cae a Gyarados normal si llega a
 * `GYARADOS_WAVE_HEIGHT_THRESHOLD_M` (1,25 m).
 */
export function assignByMarine(marine: MarineAvailability, alerts: AlertsAvailability, date: string): PokedexId | null {
  if (hasActiveRedCoastalAlert(alerts, date)) return 'gyarados-mega'
  if (marine.status !== 'ok' || marine.data.waveHeightM === null) return null
  if (marine.data.waveHeightM >= GYARADOS_MEGA_WAVE_HEIGHT_THRESHOLD_M) return 'gyarados-mega'
  return marine.data.waveHeightM >= GYARADOS_WAVE_HEIGHT_THRESHOLD_M ? 'gyarados' : null
}

// Deduplicado: desde que 'despejado' también asigna castform-sun
// (assignBySky), un día despejado dentro de la franja 15–25°C dispara la
// misma forma por dos ejes distintos — la lista no debe repetirla.
export function assignPokemon(forecast: LocationForecast): PokedexId[] {
  const ids = [
    assignByTemperature(forecast.temperature),
    assignBySky(forecast.sky),
    assignByRain(forecast.precipitation),
    assignBySnow(forecast.snow),
    assignByWind(forecast.wind),
    assignByWarmWind(forecast.wind, forecast.temperature),
    assignByCalima(forecast.calima, forecast.alerts, forecast.date),
    assignByStorm(forecast.storm),
    assignByFog(forecast.fog),
    assignByMarine(forecast.marine, forecast.alerts, forecast.date),
  ].filter((id): id is PokedexId => id !== null)

  return [...new Set(ids)]
}
