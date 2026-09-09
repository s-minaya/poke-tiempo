import type { PokedexId } from './pokedex.ts'
import type { AlertsAvailability, LocationForecast, MarineAvailability, OfficialAlert, SkyCondition, Temperature } from './types.ts'

/**
 * Motor de asignación de Pokémon (`003-plan.md`): traduce el `LocationForecast`
 * de un lugar en la lista de Pokémon que le corresponden hoy. Cada eje
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

export function assignBySky(sky: SkyCondition | null): PokedexId | null {
  switch (sky) {
    case 'poco_nuboso':
      return 'altaria'
    case 'nuboso':
    case 'cubierto':
      return 'castform'
    default:
      return null // 'despejado' no tiene Pokémon propio en la tabla; null no asigna
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

export function assignByCalima(calima: boolean | null): PokedexId | null {
  return calima === true ? 'hippowdon' : null
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
// Douglas de estado de la mar (AEMET/Puertos del Estado) — confirmado como
// decisión de producto en `003-plan.md`.
export const GYARADOS_WAVE_HEIGHT_THRESHOLD_M = 1.25

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

/**
 * El aviso oficial de "muy fuerte" es la fuente de verdad para Mega Gyarados
 * (`002-plan.md`: "la oficialidad se conserva ahí, no en el dato físico"),
 * así que dispara aunque la consulta física de oleaje de hoy haya fallado —
 * no depende de `marine.status`. Solo cuenta si el aviso está activo el día
 * del forecast (`startsAt`/`endsAt` solapan `date`); un aviso rojo que
 * empieza otro día no adelanta Mega Gyarados. Sin aviso activo, Gyarados
 * normal solo necesita el dato físico y el umbral numérico.
 */
export function assignByMarine(marine: MarineAvailability, alerts: AlertsAvailability, date: string): PokedexId | null {
  if (hasActiveRedCoastalAlert(alerts, date)) return 'gyarados-mega'
  if (marine.status !== 'ok' || marine.data.waveHeightM === null) return null
  return marine.data.waveHeightM >= GYARADOS_WAVE_HEIGHT_THRESHOLD_M ? 'gyarados' : null
}

export function assignPokemon(forecast: LocationForecast): PokedexId[] {
  return [
    assignByTemperature(forecast.temperature),
    assignBySky(forecast.sky),
    assignByRain(forecast.precipitation),
    assignBySnow(forecast.snow),
    assignByWind(forecast.wind),
    assignByCalima(forecast.calima),
    assignByStorm(forecast.storm),
    assignByFog(forecast.fog),
    assignByMarine(forecast.marine, forecast.alerts, forecast.date),
  ].filter((id): id is PokedexId => id !== null)
}
