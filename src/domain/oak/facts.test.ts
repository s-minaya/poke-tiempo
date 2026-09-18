import { describe, expect, it } from 'vitest'

import { assignPokemon } from '../assign-pokemon.ts'
import { buildLocationViews } from '../location-views.ts'
import { pickMapPokemon } from '../map-priority.ts'
import type { Forecast, Location, LocationForecast, OfficialAlert } from '../types.ts'
import { collectFacts } from './facts.ts'
import type { NarrativeFact } from './types.ts'

const DATE = '2026-09-18' // viernes

// Ids reales de `locations.ts`: el test de integración de abajo los cruza con
// `buildLocationViews`, que sí necesita coordenadas.
function location(id: string, name: string): Location {
  return {
    id,
    name,
    country: 'ES',
    latitude: 40,
    longitude: -3,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    sourceIds: { aemet: '28079' },
    coastal: false,
  }
}

// Día tranquilo: solo temperatura y cielo, ningún eje ocasional activo.
function locationForecast(locationId: string, overrides: Partial<LocationForecast> = {}): LocationForecast {
  return {
    locationId,
    date: DATE,
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
    ...overrides,
  }
}

function forecast(locationForecasts: LocationForecast[]): Forecast {
  return {
    date: DATE,
    generatedAt: '2026-09-17T06:00:00.000Z',
    locations: locationForecasts,
    meta: { totalLocations: locationForecasts.length, successfulLocations: locationForecasts.length, failedLocations: [] },
  }
}

function alert(overrides: Partial<OfficialAlert> = {}): OfficialAlert {
  return {
    level: 'naranja',
    phenomenon: 'lluvia',
    sourcePhenomenon: 'Lluvias',
    startsAt: `${DATE}T00:00:00+02:00`,
    endsAt: `${DATE}T23:59:59+02:00`,
    source: 'aemet',
    officialZoneId: '774602',
    ...overrides,
  }
}

function factsOfKind<K extends NarrativeFact['kind']>(facts: NarrativeFact[], kind: K): Extract<NarrativeFact, { kind: K }>[] {
  return facts.filter((fact): fact is Extract<NarrativeFact, { kind: K }> => fact.kind === kind)
}

const MADRID = [location('madrid', 'Madrid')]

describe('collectFacts — hechos por kind', () => {
  it('calendar: día de la semana y fin de semana derivados de forecast.date, sin dataset', () => {
    const [calendar] = factsOfKind(collectFacts(MADRID, forecast([locationForecast('madrid')])), 'calendar')

    expect(calendar).toEqual({ kind: 'calendar', date: DATE, weekday: 'viernes', weekend: false })
  })

  it('calendar: un sábado sí es fin de semana', () => {
    const saturday: Forecast = { ...forecast([locationForecast('madrid')]), date: '2026-09-19' }
    const [calendar] = factsOfKind(collectFacts(MADRID, saturday), 'calendar')

    expect(calendar.weekday).toBe('sabado')
    expect(calendar.weekend).toBe(true)
  })

  it('day_shape: recuentos reales sobre los lugares con previsión', () => {
    const facts = collectFacts(
      [location('madrid', 'Madrid'), location('a-coruna', 'A Coruña'), location('tenerife', 'Tenerife')],
      forecast([
        locationForecast('madrid', { precipitation: { mm: 4, probabilityPercent: 80 } }),
        locationForecast('a-coruna', { precipitation: { mm: 2, probabilityPercent: 70 } }),
        locationForecast('tenerife', { alerts: { status: 'ok', alerts: [alert()] } }),
      ]),
    )
    const [dayShape] = factsOfKind(facts, 'day_shape')

    expect(dayShape).toEqual({
      kind: 'day_shape',
      totalLocations: 3,
      rainingLocations: 2,
      alertedLocations: 1,
      distinctPokemonCount: 2,
    })
  })

  it('day_shape: no dice qué Pokémon domina — ese dato vive en pokemon_spotlight', () => {
    const facts = collectFacts(
      [location('madrid', 'Madrid'), location('a-coruna', 'A Coruña')],
      forecast([locationForecast('madrid', { storm: true }), locationForecast('a-coruna', { storm: true })]),
    )

    expect(Object.keys(factsOfKind(facts, 'day_shape')[0])).not.toContain('dominantPokemonId')
    // El recuento por Pokémon está donde le corresponde, sin duplicarse.
    expect(factsOfKind(facts, 'pokemon_spotlight')[0]).toMatchObject({ pokemonId: 'zapdos', locationCount: 2 })
  })

  it('pokemon_spotlight: un hecho por Pokémon visible, con el total real aunque se nombren como mucho tres lugares', () => {
    const names = ['madrid', 'a-coruna', 'tenerife', 'sevilla', 'lugo']
    const facts = collectFacts(
      names.map((id) => location(id, id)),
      forecast(names.map((id) => locationForecast(id, { storm: true }))),
    )
    const [spotlight] = factsOfKind(facts, 'pokemon_spotlight')

    expect(spotlight.pokemonId).toBe('zapdos')
    expect(spotlight.label).toBe('Tormenta')
    expect(spotlight.locationCount).toBe(5)
    expect(spotlight.locations).toHaveLength(3)
    expect(spotlight.locations.every((place) => place.mapPokemonId === 'zapdos')).toBe(true)
  })

  it('temperature: solo los extremos del día, nunca un hecho por lugar', () => {
    const facts = collectFacts(
      [location('sevilla', 'Sevilla'), location('madrid', 'Madrid'), location('benasque', 'Benasque')],
      forecast([
        locationForecast('sevilla', { temperature: { maxC: 33, minC: 18 } }),
        locationForecast('madrid', { temperature: { maxC: 28, minC: 14 } }),
        locationForecast('benasque', { temperature: { maxC: 23, minC: 5 } }),
      ]),
    )
    const temperatures = factsOfKind(facts, 'temperature')

    expect(temperatures.map((fact) => [fact.role, fact.locationId])).toEqual([
      ['hottest', 'sevilla'],
      ['coldest_day', 'benasque'],
    ])
    // Benasque es a la vez el día más fresco y la noche más fría: un solo
    // hecho, no dos del mismo sitio.
    expect(temperatures[0].maxC).toBe(33)
    expect(temperatures[0].minC).toBe(18)
  })

  it('temperature: los empates los rompe el orden de entrada de locations, no un criterio propio', () => {
    const tied = (ids: string[]) =>
      collectFacts(
        ids.map((id) => location(id, id)),
        forecast([
          locationForecast('zamora', { temperature: { maxC: 30, minC: 10 } }),
          locationForecast('avila', { temperature: { maxC: 30, minC: 10 } }),
          locationForecast('soria', { temperature: { maxC: 25, minC: 5 } }),
        ]),
      )

    // Mismos datos, distinto orden de `locations`: gana el primero de la lista.
    // Si el criterio fuera alfabético, "avila" ganaría en los dos casos.
    expect(factsOfKind(tied(['zamora', 'avila', 'soria']), 'temperature')[0]).toMatchObject({ role: 'hottest', locationId: 'zamora' })
    expect(factsOfKind(tied(['avila', 'zamora', 'soria']), 'temperature')[0]).toMatchObject({ role: 'hottest', locationId: 'avila' })
  })

  it('temperature: los tres papeles cuando son tres lugares distintos', () => {
    const facts = collectFacts(
      [location('sevilla', 'Sevilla'), location('oviedo', 'Oviedo'), location('soria', 'Soria')],
      forecast([
        locationForecast('sevilla', { temperature: { maxC: 33, minC: 18 } }),
        locationForecast('oviedo', { temperature: { maxC: 19, minC: 12 } }),
        locationForecast('soria', { temperature: { maxC: 24, minC: 6 } }),
      ]),
    )

    expect(factsOfKind(facts, 'temperature').map((fact) => [fact.role, fact.locationId])).toEqual([
      ['hottest', 'sevilla'],
      ['coldest_day', 'oviedo'],
      ['coldest_night', 'soria'],
    ])
  })

  it('rain, snow, wind, storm, fog, marine: valores copiados tal cual, sin redondear', () => {
    const facts = collectFacts(
      [location('madrid', 'Madrid')],
      forecast([
        locationForecast('madrid', {
          precipitation: { mm: 7.6, probabilityPercent: 100 },
          snow: { cm: 12.5, present: true },
          wind: { speedKmh: 37, gustKmh: 54 },
          storm: true,
          fog: true,
          marine: { status: 'ok', data: { waveHeightM: 2.7, wavePeriodS: 12.75, waveDirectionDeg: 320, source: 'open-meteo' } },
        }),
      ]),
    )

    expect(factsOfKind(facts, 'rain')[0]).toMatchObject({ mm: 7.6, probabilityPercent: 100 })
    expect(factsOfKind(facts, 'snow')[0]).toMatchObject({ cm: 12.5 })
    expect(factsOfKind(facts, 'wind')[0]).toMatchObject({ speedKmh: 37, gustKmh: 54, warm: false })
    expect(factsOfKind(facts, 'storm')).toHaveLength(1)
    expect(factsOfKind(facts, 'fog')).toHaveLength(1)
    expect(factsOfKind(facts, 'marine')[0]).toMatchObject({ waveHeightM: 2.7, wavePeriodS: 12.75 })
  })

  it('wind: warm marca el viento cálido sin inventar un hecho aparte', () => {
    const facts = collectFacts(
      [location('sevilla', 'Sevilla')],
      forecast([locationForecast('sevilla', { temperature: { maxC: 34, minC: 20 }, wind: { speedKmh: 45, gustKmh: 60 } })]),
    )

    expect(factsOfKind(facts, 'wind')[0]).toMatchObject({ speedKmh: 45, warm: true })
  })

  it('marine: un Mega Gyarados que solo sale del aviso rojo no fabrica metros de ola', () => {
    const facts = collectFacts(
      [location('a-coruna', 'A Coruña')],
      forecast([
        locationForecast('a-coruna', {
          marine: { status: 'error' },
          alerts: { status: 'ok', alerts: [alert({ level: 'rojo', phenomenon: 'costero', sourcePhenomenon: 'Fenómenos costeros' })] },
        }),
      ]),
    )

    expect(factsOfKind(facts, 'marine')).toHaveLength(0)
    // El aviso sigue estando, como aviso.
    expect(factsOfKind(facts, 'alert')[0]).toMatchObject({ level: 'rojo', phenomenon: 'costero' })
  })
})

describe('collectFacts — 0, null y false no fabrican hechos', () => {
  const quietCases: { label: string; overrides: Partial<LocationForecast>; kind: NarrativeFact['kind'] }[] = [
    { label: 'lluvia con mm = 0', overrides: { precipitation: { mm: 0, probabilityPercent: 90 } }, kind: 'rain' },
    { label: 'lluvia con mm = null', overrides: { precipitation: { mm: null, probabilityPercent: 90 } }, kind: 'rain' },
    { label: 'lluvia con precipitation = null', overrides: { precipitation: null }, kind: 'rain' },
    { label: 'nieve con cm = 0', overrides: { snow: { cm: 0, present: false } }, kind: 'snow' },
    { label: 'nieve con cm = null pese a present = true', overrides: { snow: { cm: null, present: true } }, kind: 'snow' },
    { label: 'viento por debajo del umbral de la 003', overrides: { wind: { speedKmh: 19, gustKmh: 40 } }, kind: 'wind' },
    { label: 'viento con speedKmh = null', overrides: { wind: { speedKmh: null, gustKmh: 80 } }, kind: 'wind' },
    { label: 'tormenta = false', overrides: { storm: false }, kind: 'storm' },
    { label: 'tormenta = null', overrides: { storm: null }, kind: 'storm' },
    { label: 'niebla = false', overrides: { fog: false }, kind: 'fog' },
    { label: 'niebla = null', overrides: { fog: null }, kind: 'fog' },
    { label: 'calima = false', overrides: { calima: false }, kind: 'calima' },
    { label: 'calima = null', overrides: { calima: null }, kind: 'calima' },
    { label: 'oleaje por debajo del umbral de la 003', overrides: { marine: { status: 'ok', data: { waveHeightM: 1.2, wavePeriodS: 8, waveDirectionDeg: 0, source: 'open-meteo' } } }, kind: 'marine' },
    { label: 'oleaje con waveHeightM = null', overrides: { marine: { status: 'ok', data: { waveHeightM: null, wavePeriodS: null, waveDirectionDeg: null, source: 'open-meteo' } } }, kind: 'marine' },
    { label: 'oleaje no consultado (lugar de interior)', overrides: { marine: { status: 'not_applicable' } }, kind: 'marine' },
  ]

  it.each(quietCases)('$label → ningún hecho de ese eje', ({ overrides, kind }) => {
    const facts = collectFacts(MADRID, forecast([locationForecast('madrid', overrides)]))

    expect(factsOfKind(facts, kind)).toHaveLength(0)
  })

  it('un lugar sin entrada en forecast.locations no genera ningún hecho', () => {
    const facts = collectFacts([location('madrid', 'Madrid'), location('lugo', 'Lugo')], forecast([locationForecast('madrid')]))

    expect(facts.every((fact) => !('locationId' in fact) || fact.locationId === 'madrid')).toBe(true)
    expect(factsOfKind(facts, 'day_shape')[0].totalLocations).toBe(1)
  })
})

describe('collectFacts — Oak solo nombra el Pokémon que se ve', () => {
  // Tormenta + lluvia + viento + temperatura extrema a la vez: `assignPokemon`
  // devuelve seis candidatos y el mapa solo dibuja Zapdos.
  const crowded = forecast([
    locationForecast('madrid', {
      temperature: { maxC: 42, minC: 30 },
      precipitation: { mm: 5, probabilityPercent: 90 },
      wind: { speedKmh: 45, gustKmh: 70 },
      storm: true,
    }),
  ])

  it('el lugar produce varios candidatos pero un único mapPokemonId', () => {
    const candidates = assignPokemon(crowded.locations[0])

    expect(candidates.length).toBeGreaterThan(1)
    expect(pickMapPokemon(candidates)).toBe('zapdos')
    expect(collectFacts(MADRID, crowded).every((fact) => !('mapPokemonId' in fact) || fact.mapPokemonId === 'zapdos')).toBe(true)
  })

  it('ningún candidato descartado aparece en ninguna parte de los hechos', () => {
    const facts = collectFacts(MADRID, crowded)
    const discarded = assignPokemon(crowded.locations[0]).filter((id) => id !== 'zapdos')
    const serialized = JSON.stringify(facts)

    expect(discarded).not.toHaveLength(0)
    for (const id of discarded) {
      expect(serialized).not.toContain(id)
    }
  })

  it('mapRepresentsFact: true solo para el eje que coincide con el sprite visible', () => {
    const facts = collectFacts(MADRID, crowded)

    expect(factsOfKind(facts, 'storm')[0].mapRepresentsFact).toBe(true)
    expect(factsOfKind(facts, 'rain')[0].mapRepresentsFact).toBe(false)
    expect(factsOfKind(facts, 'wind')[0].mapRepresentsFact).toBe(false)
    expect(factsOfKind(facts, 'temperature')[0].mapRepresentsFact).toBe(false)
  })

  it('mapRepresentsFact: la temperatura sí representa el mapa cuando nada la tapa', () => {
    const facts = collectFacts(MADRID, forecast([locationForecast('madrid', { temperature: { maxC: 31, minC: 20 } })]))

    expect(factsOfKind(facts, 'temperature')[0].mapRepresentsFact).toBe(true)
  })

  it('mapRepresentsFact: el viento cálido cuenta como parte del mismo eje', () => {
    const facts = collectFacts(
      [location('sevilla', 'Sevilla')],
      // 34 °C → magmar; viento 45 km/h → dragonite y, por cálido, Moltres.
      // Moltres gana la prioridad: el hecho de viento sigue representando el mapa.
      forecast([locationForecast('sevilla', { temperature: { maxC: 34, minC: 20 }, wind: { speedKmh: 45, gustKmh: 60 } })]),
    )

    expect(factsOfKind(facts, 'wind')[0]).toMatchObject({ mapPokemonId: 'moltres', mapRepresentsFact: true })
  })
})

describe('collectFacts — avisos oficiales', () => {
  it('un aviso activo en forecast.date produce AlertFact con su literal de origen', () => {
    const facts = collectFacts(MADRID, forecast([locationForecast('madrid', { alerts: { status: 'ok', alerts: [alert()] } })]))

    expect(factsOfKind(facts, 'alert')[0]).toEqual({
      kind: 'alert',
      level: 'naranja',
      phenomenon: 'lluvia',
      sourcePhenomenon: 'Lluvias',
      officialZoneId: '774602',
      source: 'aemet',
      affectedLocations: [{ locationId: 'madrid', locationName: 'Madrid' }],
      affectedLocationCount: 1,
    })
  })

  it('un aviso no arrastra Pokémon: no dibuja ninguno y no finge corresponder a uno', () => {
    const [alertFact] = factsOfKind(
      collectFacts(MADRID, forecast([locationForecast('madrid', { storm: true, alerts: { status: 'ok', alerts: [alert()] } })])),
      'alert',
    )

    expect(alertFact).not.toHaveProperty('mapPokemonId')
    expect(alertFact).not.toHaveProperty('mapRepresentsFact')
    expect(alertFact.affectedLocations[0]).toEqual({ locationId: 'madrid', locationName: 'Madrid' })
  })

  it('un aviso amarillo también produce hecho — el nivel no se filtra aquí', () => {
    const facts = collectFacts(MADRID, forecast([locationForecast('madrid', { alerts: { status: 'ok', alerts: [alert({ level: 'amarillo' })] } })]))

    expect(factsOfKind(facts, 'alert')[0].level).toBe('amarillo')
  })

  const inactiveCases: { label: string; overrides: Partial<OfficialAlert> }[] = [
    { label: 'aviso ya expirado (terminó ayer)', overrides: { startsAt: '2026-09-16T00:00:00+02:00', endsAt: '2026-09-17T19:59:59+02:00' } },
    { label: 'aviso futuro (empieza pasado mañana)', overrides: { startsAt: '2026-09-20T00:00:00+02:00', endsAt: '2026-09-20T23:59:59+02:00' } },
  ]

  it.each(inactiveCases)('$label: guardado en forecast.json pero sin AlertFact', ({ overrides }) => {
    const facts = collectFacts(MADRID, forecast([locationForecast('madrid', { alerts: { status: 'ok', alerts: [alert(overrides)] } })]))

    expect(factsOfKind(facts, 'alert')).toHaveLength(0)
    expect(factsOfKind(facts, 'day_shape')[0].alertedLocations).toBe(0)
  })

  it('el mismo aviso compartido por varios lugares es un único hecho que los conserva todos', () => {
    const shared = alert()
    const facts = collectFacts(
      [location('madrid', 'Madrid'), location('toledo', 'Toledo'), location('cuenca', 'Cuenca')],
      forecast([
        locationForecast('madrid', { alerts: { status: 'ok', alerts: [shared] } }),
        locationForecast('toledo', { alerts: { status: 'ok', alerts: [{ ...shared }] } }),
        locationForecast('cuenca', { alerts: { status: 'ok', alerts: [{ ...shared }] } }),
      ]),
    )
    const alerts = factsOfKind(facts, 'alert')

    expect(alerts).toHaveLength(1)
    expect(alerts[0].affectedLocationCount).toBe(3)
    expect(alerts[0].affectedLocations.map((place) => place.locationId)).toEqual(['madrid', 'toledo', 'cuenca'])
    // Deduplicar avisos no cambia cuántos lugares están avisados.
    expect(factsOfKind(facts, 'day_shape')[0].alertedLocations).toBe(3)
  })

  it('dos avisos de la misma zona con distinto fenómeno o nivel no se deduplican entre sí', () => {
    const facts = collectFacts(
      MADRID,
      forecast([
        locationForecast('madrid', {
          alerts: {
            status: 'ok',
            alerts: [alert(), alert({ phenomenon: 'tormenta', sourcePhenomenon: 'Tormentas' }), alert({ level: 'amarillo' })],
          },
        }),
      ]),
    )

    expect(factsOfKind(facts, 'alert')).toHaveLength(3)
  })

  it('alerts.status distinto de ok no produce hechos ni cuenta como lugar avisado', () => {
    const facts = collectFacts(MADRID, forecast([locationForecast('madrid', { alerts: { status: 'error' } })]))

    expect(factsOfKind(facts, 'alert')).toHaveLength(0)
    expect(factsOfKind(facts, 'day_shape')[0].alertedLocations).toBe(0)
  })
})

describe('collectFacts — calima', () => {
  const calimaAlert = alert({ phenomenon: 'calima', sourcePhenomenon: 'Polvo en suspensión', level: 'amarillo' })

  it('por dato físico: fromAlert = false', () => {
    const facts = collectFacts(MADRID, forecast([locationForecast('madrid', { calima: true })]))

    expect(factsOfKind(facts, 'calima')[0]).toMatchObject({ fromAlert: false, mapPokemonId: 'hippowdon', mapRepresentsFact: true })
  })

  it('por aviso oficial activo, sin dato físico: fromAlert = true', () => {
    const facts = collectFacts(MADRID, forecast([locationForecast('madrid', { calima: false, alerts: { status: 'ok', alerts: [calimaAlert] } })]))

    expect(factsOfKind(facts, 'calima')[0]).toMatchObject({ fromAlert: true, mapPokemonId: 'hippowdon' })
  })

  it('con las dos señales a la vez: fromAlert = true, el aviso manda porque es lo citable', () => {
    const facts = collectFacts(MADRID, forecast([locationForecast('madrid', { calima: true, alerts: { status: 'ok', alerts: [calimaAlert] } })]))

    expect(factsOfKind(facts, 'calima')).toHaveLength(1)
    expect(factsOfKind(facts, 'calima')[0].fromAlert).toBe(true)
  })

  it('un aviso de calima que no está activo ese día no fabrica calima', () => {
    const facts = collectFacts(
      MADRID,
      forecast([
        locationForecast('madrid', {
          calima: false,
          alerts: { status: 'ok', alerts: [alert({ phenomenon: 'calima', startsAt: '2026-09-20T00:00:00+02:00', endsAt: '2026-09-20T23:59:59+02:00' })] },
        }),
      ]),
    )

    expect(factsOfKind(facts, 'calima')).toHaveLength(0)
  })
})

describe('collectFacts — no diverge del mapa', () => {
  // La garantía que importa a futuro: si alguien cambia MAP_PRIORITY,
  // assignPokemon o pickMapPokemon, Oak y el mapa siguen contando lo mismo.
  it('mapPokemonId coincide con el pokemonId que pinta buildLocationViews, lugar a lugar', () => {
    const locations = [location('madrid', 'Madrid'), location('a-coruna', 'A Coruña'), location('tenerife', 'Tenerife'), location('sevilla', 'Sevilla')]
    const day = forecast([
      // Cuatro perfiles con varios ejes disparando a la vez.
      locationForecast('madrid', { temperature: { maxC: 42, minC: 30 }, storm: true, precipitation: { mm: 5, probabilityPercent: 90 } }),
      locationForecast('a-coruna', {
        fog: true,
        precipitation: { mm: 3, probabilityPercent: 80 },
        wind: { speedKmh: 25, gustKmh: 40 },
        marine: { status: 'ok', data: { waveHeightM: 2.6, wavePeriodS: 11, waveDirectionDeg: 300, source: 'open-meteo' } },
      }),
      locationForecast('tenerife', { calima: true, temperature: { maxC: 29, minC: 21 }, sky: 'nuboso' }),
      locationForecast('sevilla', { temperature: { maxC: 34, minC: 20 }, wind: { speedKmh: 45, gustKmh: 60 }, sky: 'poco_nuboso' }),
    ])

    const views = new Map(buildLocationViews(locations, day).map((view) => [view.id, view.pokemonId]))
    const facts = collectFacts(locations, day)
    const seen = new Set<string>()

    for (const fact of facts) {
      if (!('mapPokemonId' in fact)) continue
      seen.add(fact.locationId)
      expect(fact.mapPokemonId).toBe(views.get(fact.locationId))
    }

    expect(seen).toEqual(new Set(['madrid', 'a-coruna', 'tenerife', 'sevilla']))
  })

  it('cada pokemon_spotlight agrupa exactamente los lugares que muestran ese Pokémon en el mapa', () => {
    const locations = [location('madrid', 'Madrid'), location('a-coruna', 'A Coruña'), location('tenerife', 'Tenerife')]
    const day = forecast([
      locationForecast('madrid', { storm: true }),
      locationForecast('a-coruna', { storm: true }),
      locationForecast('tenerife', { calima: true }),
    ])

    const views = buildLocationViews(locations, day)
    for (const spotlight of factsOfKind(collectFacts(locations, day), 'pokemon_spotlight')) {
      const expected = views.filter((view) => view.pokemonId === spotlight.pokemonId).map((view) => view.id)
      expect(spotlight.locationCount).toBe(expected.length)
      expect(spotlight.locations.map((place) => place.locationId)).toEqual(expected.slice(0, 3))
    }
  })
})
