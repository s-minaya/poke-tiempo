import { describe, expect, it } from 'vitest'

import type { DayModeDecision } from './day-mode.ts'
import { isSeriousDay, seriousDayReason } from './serious-day.ts'
import type { AlertFact, PokemonSpotlightFact } from './types.ts'

const alert: AlertFact = {
  kind: 'alert',
  level: 'naranja',
  phenomenon: 'lluvia',
  sourcePhenomenon: 'Lluvias',
  officialZoneId: '774602',
  source: 'aemet',
  affectedLocations: [{ locationId: 'ibiza', locationName: 'Ibiza' }],
  affectedLocationCount: 1,
}

const spotlight: PokemonSpotlightFact = {
  kind: 'pokemon_spotlight',
  pokemonId: 'zapdos',
  label: 'Tormenta',
  locations: [{ locationId: 'teruel', locationName: 'Teruel', mapPokemonId: 'zapdos' }],
  locationCount: 3,
}

describe('seriousDayReason', () => {
  it('un aviso oficial hace serio el día, y dice por qué', () => {
    expect(seriousDayReason({ mode: 'alerta', trigger: alert })).toBe('aviso-oficial')
  })

  it('los demás modos no lo son', () => {
    const ordinary: DayModeDecision[] = [
      { mode: 'invasion', trigger: spotlight },
      { mode: 'avistamiento', trigger: spotlight },
      { mode: 'parte', trigger: null },
    ]

    for (const decision of ordinary) expect(seriousDayReason(decision)).toBeNull()
  })

  it('el nivel del aviso no cambia la respuesta: naranja y rojo pesan igual', () => {
    for (const level of ['naranja', 'rojo'] as const) {
      expect(isSeriousDay({ mode: 'alerta', trigger: { ...alert, level } })).toBe(true)
    }
  })
})
