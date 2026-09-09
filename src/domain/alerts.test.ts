import { describe, expect, it } from 'vitest'

import { selectAlertsForZones } from './alerts.ts'
import type { OfficialAlert } from './types.ts'

function alert(officialZoneId: string, phenomenon: OfficialAlert['phenomenon']): OfficialAlert {
  return {
    level: 'amarillo',
    phenomenon,
    sourcePhenomenon: phenomenon,
    startsAt: '2026-09-09T00:00:00+02:00',
    endsAt: '2026-09-09T23:59:59+02:00',
    source: 'aemet',
    officialZoneId,
  }
}

describe('selectAlertsForZones', () => {
  it('devuelve solo los avisos cuya zona está en la lista', () => {
    const alerts = [alert('610403', 'lluvia'), alert('610404', 'viento'), alert('610403C', 'costero')]
    expect(selectAlertsForZones(alerts, ['610403', '610403C'])).toEqual([alerts[0], alerts[2]])
  })

  it('sin coincidencias: lista vacía, no un error', () => {
    const alerts = [alert('610403', 'lluvia')]
    expect(selectAlertsForZones(alerts, ['754802'])).toEqual([])
  })

  it('un lugar con varias zonas (terrestre + costera) recoge avisos de ambas', () => {
    const alerts = [alert('754802', 'nieve'), alert('754801C', 'costero')]
    expect(selectAlertsForZones(alerts, ['754802', '754801', '754801C'])).toEqual(alerts)
  })
})
