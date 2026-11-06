import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { isActiveOnDate, selectAlertsForZones } from './alerts.ts'
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

describe('isActiveOnDate', () => {
  const DAY = '2026-10-06'

  // La vigencia es el solape de [startsAt, endsAt) con el día natural
  // [DAY 00:00, DAY+1 00:00), leído en la hora de pared del propio aviso.
  // AEMET trae offset (`+02:00`, `+01:00` en Canarias) e IPMA no trae ninguno:
  // en ambos casos el reloj del aviso es el del lugar, no el del entorno.
  const cases: { label: string; startsAt: string; endsAt: string; active: boolean }[] = [
    // IPMA, sin offset
    { label: 'IPMA: termina exactamente a las 00:00 del día → inactivo', startsAt: '2026-10-05T12:00:00', endsAt: '2026-10-06T00:00:00', active: false },
    { label: 'IPMA: termina un segundo después de las 00:00 del día → activo', startsAt: '2026-10-05T12:00:00', endsAt: '2026-10-06T00:00:01', active: true },
    { label: 'IPMA: empieza exactamente a las 00:00 del día → activo', startsAt: '2026-10-06T00:00:00', endsAt: '2026-10-06T18:00:00', active: true },
    { label: 'IPMA: empieza a las 00:00 del día siguiente → inactivo', startsAt: '2026-10-07T00:00:00', endsAt: '2026-10-07T18:00:00', active: false },
    { label: 'IPMA: empieza un segundo antes de acabar el día → activo', startsAt: '2026-10-06T23:59:59', endsAt: '2026-10-07T12:00:00', active: true },
    { label: 'IPMA: empieza ayer y acaba pasada la medianoche → activo', startsAt: '2026-10-05T15:00:00', endsAt: '2026-10-06T03:00:00', active: true },
    { label: 'IPMA: cubre el día entero (empieza antes y acaba después) → activo', startsAt: '2026-10-05T12:00:00', endsAt: '2026-10-08T00:00:00', active: true },
    { label: 'IPMA: termina a las 00:00 del día siguiente → activo (cubre todo el día)', startsAt: '2026-10-06T00:00:00', endsAt: '2026-10-07T00:00:00', active: true },
    { label: 'IPMA: dura cero segundos a las 00:00 del día → inactivo', startsAt: '2026-10-06T00:00:00', endsAt: '2026-10-06T00:00:00', active: false },
    // AEMET, con el offset de la zona
    { label: 'AEMET península: termina a las 00:00:00+02:00 del día → inactivo', startsAt: '2026-10-05T12:00:00+02:00', endsAt: '2026-10-06T00:00:00+02:00', active: false },
    { label: 'AEMET península: termina ayer a las 23:59:59 → inactivo', startsAt: '2026-10-05T00:00:00+02:00', endsAt: '2026-10-05T23:59:59+02:00', active: false },
    { label: 'AEMET península: empieza a las 00:00:00 del día y acaba a las 23:59:59 → activo', startsAt: '2026-10-06T00:00:00+02:00', endsAt: '2026-10-06T23:59:59+02:00', active: true },
    { label: 'AEMET península: empieza ayer a las 23:00 y acaba mañana → activo', startsAt: '2026-10-05T23:00:00+02:00', endsAt: '2026-10-07T19:59:59+02:00', active: true },
    { label: 'AEMET península: empieza mañana a las 00:00:00 → inactivo', startsAt: '2026-10-07T00:00:00+02:00', endsAt: '2026-10-07T23:59:59+02:00', active: false },
    { label: 'AEMET Canarias (+01:00): termina a las 00:00:00+01:00 del día → inactivo', startsAt: '2026-10-05T12:00:00+01:00', endsAt: '2026-10-06T00:00:00+01:00', active: false },
    { label: 'AEMET Canarias (+01:00): termina a las 00:00:01+01:00 del día → activo', startsAt: '2026-10-05T12:00:00+01:00', endsAt: '2026-10-06T00:00:01+01:00', active: true },
    { label: 'AEMET Canarias (+01:00): empieza a las 23:59:59+01:00 del día → activo', startsAt: '2026-10-06T23:59:59+01:00', endsAt: '2026-10-07T10:00:00+01:00', active: true },
  ]

  it.each(cases)('$label', ({ startsAt, endsAt, active }) => {
    expect(isActiveOnDate({ ...alert('X', 'lluvia'), startsAt, endsAt }, DAY)).toBe(active)
  })

  it('el cambio de mes y de año no rompe el límite de medianoche', () => {
    const ended = { ...alert('X', 'lluvia'), startsAt: '2026-12-31T12:00:00', endsAt: '2027-01-01T00:00:00' }
    expect(isActiveOnDate(ended, '2027-01-01')).toBe(false)
    expect(isActiveOnDate(ended, '2026-12-31')).toBe(true)
  })

  it('el cambio de hora de otoño (25-oct-2026) no mueve el límite: se compara la hora de pared', () => {
    const ended = { ...alert('X', 'lluvia'), startsAt: '2026-10-24T12:00:00+02:00', endsAt: '2026-10-25T00:00:00+02:00' }
    expect(isActiveOnDate(ended, '2026-10-25')).toBe(false)
    expect(isActiveOnDate(ended, '2026-10-24')).toBe(true)
  })

  // La zona horaria del proceso no puede decidir el resultado: se repite la
  // tabla entera con husos muy distintos al de Madrid.
  describe.each(['UTC', 'Pacific/Auckland', 'America/Los_Angeles', 'Atlantic/Canary'])('con TZ=%s en el entorno', (timeZone) => {
    beforeAll(() => {
      vi.stubEnv('TZ', timeZone)
    })
    afterAll(() => {
      vi.unstubAllEnvs()
    })

    it.each(cases)('$label', ({ startsAt, endsAt, active }) => {
      expect(isActiveOnDate({ ...alert('X', 'lluvia'), startsAt, endsAt }, DAY)).toBe(active)
    })
  })
})
