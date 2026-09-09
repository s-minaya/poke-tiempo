import { describe, expect, it } from 'vitest'

import {
  assignByCalima,
  assignByFog,
  assignByMarine,
  assignByRain,
  assignBySky,
  assignBySnow,
  assignByStorm,
  assignByTemperature,
  assignByWind,
  assignPokemon,
  GYARADOS_WAVE_HEIGHT_THRESHOLD_M,
} from './assign-pokemon.ts'
import type { AlertsAvailability, LocationForecast, OfficialAlert } from './types.ts'

function alert(overrides: Partial<OfficialAlert> = {}): OfficialAlert {
  return {
    level: 'rojo',
    phenomenon: 'costero',
    sourcePhenomenon: 'fenómenos costeros',
    startsAt: '2026-09-08T00:00:00Z',
    endsAt: '2026-09-08T23:59:00Z',
    source: 'aemet',
    officialZoneId: 'costera-galicia',
    ...overrides,
  }
}

// Lugar de interior, día sin ningún fenómeno más allá de la temperatura —
// el único campo obligatorio de LocationForecast. Cada test sobreescribe
// solo lo que necesita evaluar.
const baseForecast: LocationForecast = {
  locationId: 'test-location',
  date: '2026-09-08',
  temperature: { maxC: 20, minC: 10 },
  sky: 'despejado',
  precipitation: { mm: 0, probabilityPercent: 5 },
  snow: { cm: 0, present: false },
  wind: { speedKmh: 10, gustKmh: 15 },
  storm: false,
  calima: false,
  fog: false,
  marine: { status: 'not_applicable' },
  alerts: { status: 'ok', alerts: [] },
  provenance: { primary: 'aemet' },
  primarySourceDescription: 'Despejado',
}

describe('assignByTemperature', () => {
  it.each([
    { maxC: -10, expected: 'snorunt', label: 'muy por debajo de 0' },
    { maxC: 7, expected: 'snorunt', label: 'frontera 7 (inclusive, tramo bajo)' },
    { maxC: 7.01, expected: 'solrock', label: 'justo por encima de 7' },
    { maxC: 14, expected: 'solrock', label: 'frontera 14 (inclusive, tramo bajo)' },
    { maxC: 14.01, expected: 'castform-sun', label: 'justo por encima de 14' },
    { maxC: 25, expected: 'castform-sun', label: 'frontera 25 (inclusive, tramo bajo)' },
    { maxC: 25.01, expected: 'charmander', label: 'justo por encima de 25' },
    { maxC: 29, expected: 'charmander', label: 'frontera 29 (inclusive, tramo bajo)' },
    { maxC: 29.01, expected: 'charmeleon', label: 'justo por encima de 29' },
    { maxC: 33, expected: 'charmeleon', label: 'frontera 33 (inclusive, tramo bajo)' },
    { maxC: 33.01, expected: 'magmar', label: 'justo por encima de 33' },
    { maxC: 39, expected: 'magmar', label: 'frontera 39 (inclusive, tramo bajo)' },
    { maxC: 39.01, expected: 'groudon', label: 'justo por encima de 39' },
    { maxC: 44, expected: 'groudon', label: 'frontera 44 (inclusive, cierra el hueco de la tabla original)' },
    { maxC: 44.01, expected: 'groudon-primal', label: 'justo por encima de 44' },
    { maxC: 60, expected: 'groudon-primal', label: 'muy por encima de 44' },
  ])('$maxC °C → $expected ($label)', ({ maxC, expected }) => {
    expect(assignByTemperature({ maxC, minC: maxC })).toBe(expected)
  })
})

describe('assignBySky', () => {
  it.each([
    { sky: 'despejado' as const, expected: null },
    { sky: 'poco_nuboso' as const, expected: 'altaria' },
    { sky: 'nuboso' as const, expected: 'castform' },
    { sky: 'cubierto' as const, expected: 'castform' },
    { sky: null, expected: null },
  ])('sky=$sky → $expected', ({ sky, expected }) => {
    expect(assignBySky(sky)).toBe(expected)
  })
})

describe('assignByRain', () => {
  it.each([
    { mm: null, expected: null, label: 'sin dato' },
    { mm: 0, expected: null, label: 'acumulado confirmado en 0, no llovió' },
    { mm: 0.01, expected: 'castform-rain', label: 'justo por encima de 0' },
    { mm: 10, expected: 'castform-rain', label: 'frontera 10 (inclusive, tramo bajo)' },
    { mm: 10.01, expected: 'kyogre', label: 'justo por encima de 10' },
    { mm: 60, expected: 'kyogre', label: 'frontera 60 (inclusive, tramo bajo)' },
    { mm: 60.01, expected: 'kyogre-primal', label: 'justo por encima de 60' },
  ])('mm=$mm → $expected ($label)', ({ mm, expected }) => {
    expect(assignByRain({ mm, probabilityPercent: null })).toBe(expected)
  })

  it('precipitation === null → null', () => {
    expect(assignByRain(null)).toBeNull()
  })
})

describe('assignBySnow', () => {
  it.each([
    { cm: null, expected: null, label: 'sin dato, nunca se cae a snow.present' },
    { cm: 0, expected: null, label: 'acumulado confirmado en 0, no nevó' },
    { cm: 0.01, expected: 'cryogonal', label: 'justo por encima de 0' },
    { cm: 10, expected: 'cryogonal', label: 'frontera 10 (inclusive, tramo bajo)' },
    { cm: 10.01, expected: 'abomasnow', label: 'justo por encima de 10' },
  ])('cm=$cm → $expected ($label)', ({ cm, expected }) => {
    expect(assignBySnow({ cm, present: true })).toBe(expected)
  })

  it('snow === null → null (no deriva de snow.present)', () => {
    expect(assignBySnow(null)).toBeNull()
  })
})

describe('assignByWind', () => {
  it.each([
    { speedKmh: null, expected: null, label: 'sin dato' },
    { speedKmh: 19.99, expected: null, label: 'justo por debajo de 20' },
    { speedKmh: 20, expected: 'hoppip', label: 'frontera 20 (inclusive, tramo Hoppip)' },
    { speedKmh: 39.99, expected: 'hoppip', label: 'justo por debajo de 40' },
    { speedKmh: 40, expected: 'dragonite', label: 'frontera 40 (inclusive, tramo Dragonite)' },
    { speedKmh: 59.99, expected: 'dragonite', label: 'justo por debajo de 60' },
    { speedKmh: 60, expected: 'rayquaza', label: 'frontera 60 (inclusive, tramo Rayquaza)' },
    { speedKmh: 90, expected: 'rayquaza', label: 'frontera 90 (inclusive, tramo Rayquaza)' },
    { speedKmh: 90.01, expected: 'tornadus', label: 'justo por encima de 90' },
  ])('speedKmh=$speedKmh → $expected ($label)', ({ speedKmh, expected }) => {
    expect(assignByWind({ speedKmh, gustKmh: null })).toBe(expected)
  })

  it('wind === null → null', () => {
    expect(assignByWind(null)).toBeNull()
  })

  it('ignora gustKmh, aunque supere cualquier franja', () => {
    expect(assignByWind({ speedKmh: 10, gustKmh: 150 })).toBeNull()
  })
})

describe('assignByCalima', () => {
  it.each([
    { calima: true, expected: 'hippowdon' },
    { calima: false, expected: null },
    { calima: null, expected: null },
  ])('calima=$calima → $expected', ({ calima, expected }) => {
    expect(assignByCalima(calima)).toBe(expected)
  })
})

describe('assignByStorm', () => {
  it.each([
    { storm: true, expected: 'zapdos' },
    { storm: false, expected: null },
    { storm: null, expected: null },
  ])('storm=$storm → $expected (DANA deshabilitada, nunca Thundurus)', ({ storm, expected }) => {
    expect(assignByStorm(storm)).toBe(expected)
  })
})

describe('assignByFog', () => {
  it.each([
    { fog: true, expected: 'castform-ice' },
    { fog: false, expected: null },
    { fog: null, expected: null },
  ])('fog=$fog → $expected', ({ fog, expected }) => {
    expect(assignByFog(fog)).toBe(expected)
  })
})

describe('assignByMarine', () => {
  const okNoAlerts: AlertsAvailability = { status: 'ok', alerts: [] }
  const date = '2026-09-08'

  it.each([
    { waveHeightM: 1.24, expected: null, label: 'justo por debajo del umbral' },
    { waveHeightM: GYARADOS_WAVE_HEIGHT_THRESHOLD_M, expected: 'gyarados', label: 'frontera 1.25 (inclusive)' },
    { waveHeightM: 5, expected: 'gyarados', label: 'muy por encima del umbral' },
  ])('waveHeightM=$waveHeightM, sin aviso rojo costero → $expected ($label)', ({ waveHeightM, expected }) => {
    const marine = { status: 'ok' as const, data: { waveHeightM, wavePeriodS: 8, waveDirectionDeg: 300, source: 'open-meteo' as const } }
    expect(assignByMarine(marine, okNoAlerts, date)).toBe(expected)
  })

  it('waveHeightM === null (marine ok pero sin ese dato concreto) → null', () => {
    const marine = { status: 'ok' as const, data: { waveHeightM: null, wavePeriodS: null, waveDirectionDeg: null, source: 'open-meteo' as const } }
    expect(assignByMarine(marine, okNoAlerts, date)).toBeNull()
  })

  it('marine not_applicable (lugar de interior) → null', () => {
    expect(assignByMarine({ status: 'not_applicable' }, okNoAlerts, date)).toBeNull()
  })

  it('marine error, sin aviso rojo → null', () => {
    expect(assignByMarine({ status: 'error' }, okNoAlerts, date)).toBeNull()
  })

  it('aviso rojo costero activo el día del forecast → Mega Gyarados, aunque el numérico no llegue al umbral', () => {
    const marine = { status: 'ok' as const, data: { waveHeightM: 0.5, wavePeriodS: 8, waveDirectionDeg: 300, source: 'open-meteo' as const } }
    const alerts: AlertsAvailability = { status: 'ok', alerts: [alert()] } // startsAt/endsAt cubren el 2026-09-08
    expect(assignByMarine(marine, alerts, date)).toBe('gyarados-mega')
  })

  it('aviso rojo costero con timestamps estilo IPMA (sin offset) que cubren el día → Mega Gyarados', () => {
    const marine = { status: 'ok' as const, data: { waveHeightM: 0.5, wavePeriodS: 8, waveDirectionDeg: 300, source: 'open-meteo' as const } }
    const alerts: AlertsAvailability = {
      status: 'ok',
      alerts: [alert({ startsAt: '2026-09-08T12:00:00', endsAt: '2026-09-08T23:00:00' })],
    }
    expect(assignByMarine(marine, alerts, date)).toBe('gyarados-mega')
  })

  it('aviso rojo costero que empieza otro día → sin Mega Gyarados, cae al numérico', () => {
    const marine = { status: 'ok' as const, data: { waveHeightM: 2, wavePeriodS: 8, waveDirectionDeg: 300, source: 'open-meteo' as const } }
    const alerts: AlertsAvailability = {
      status: 'ok',
      alerts: [alert({ startsAt: '2026-09-09T00:00:00Z', endsAt: '2026-09-09T23:59:00Z' })],
    }
    expect(assignByMarine(marine, alerts, date)).toBe('gyarados')
  })

  it('aviso rojo costero manda aunque marine haya fallado hoy (la oficialidad vive en alerts, no en el dato físico)', () => {
    const alerts: AlertsAvailability = { status: 'ok', alerts: [alert()] }
    expect(assignByMarine({ status: 'error' }, alerts, date)).toBe('gyarados-mega')
  })

  it('aviso rojo pero de otro fenómeno (no costero) → cae al numérico', () => {
    const marine = { status: 'ok' as const, data: { waveHeightM: 2, wavePeriodS: 8, waveDirectionDeg: 300, source: 'open-meteo' as const } }
    const alerts: AlertsAvailability = { status: 'ok', alerts: [alert({ phenomenon: 'lluvia' })] }
    expect(assignByMarine(marine, alerts, date)).toBe('gyarados')
  })

  it('aviso costero pero no rojo (naranja) → cae al numérico', () => {
    const marine = { status: 'ok' as const, data: { waveHeightM: 2, wavePeriodS: 8, waveDirectionDeg: 300, source: 'open-meteo' as const } }
    const alerts: AlertsAvailability = { status: 'ok', alerts: [alert({ level: 'naranja' })] }
    expect(assignByMarine(marine, alerts, date)).toBe('gyarados')
  })

  it.each([{ status: 'error' as const }, { status: 'unsupported' as const }])(
    'alerts.status=$status → sin mega, cae al numérico',
    (alerts) => {
      const marine = { status: 'ok' as const, data: { waveHeightM: 2, wavePeriodS: 8, waveDirectionDeg: 300, source: 'open-meteo' as const } }
      expect(assignByMarine(marine, alerts, date)).toBe('gyarados')
    },
  )
})

describe('assignPokemon', () => {
  it('día tranquilo de interior: solo la temperatura asigna (es el único eje siempre presente)', () => {
    expect(assignPokemon(baseForecast)).toEqual(['castform-sun'])
  })

  it('varios ejes disparan a la vez: la lista los incluye todos, sin un único ganador', () => {
    const forecast: LocationForecast = {
      ...baseForecast,
      temperature: { maxC: 42, minC: 30 },
      sky: 'poco_nuboso',
      wind: { speedKmh: 45, gustKmh: 70 },
      storm: true,
    }
    expect(assignPokemon(forecast)).toEqual(['groudon', 'altaria', 'dragonite', 'zapdos'])
  })

  it('todos los ejes en null (salvo temperature, obligatorio): solo la temperatura asigna', () => {
    const forecast: LocationForecast = {
      ...baseForecast,
      sky: null,
      precipitation: null,
      snow: null,
      wind: null,
      storm: null,
      calima: null,
      fog: null,
      marine: { status: 'not_applicable' },
      alerts: { status: 'unsupported' },
    }
    expect(assignPokemon(forecast)).toEqual(['castform-sun'])
  })
})
