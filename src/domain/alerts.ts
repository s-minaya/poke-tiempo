import type { OfficialAlert } from './types.ts'

/**
 * Filtra los avisos de una fuente (ya normalizados a `OfficialAlert`, para
 * toda un área/país de una vez) a los que aplican a un lugar concreto según
 * su `Location.alertZoneIds`. Un lugar costero puede tener más de una zona
 * (terrestre + marítima); esta función no distingue entre ellas, solo
 * selecciona por pertenencia.
 */
export function selectAlertsForZones(alerts: OfficialAlert[], zoneIds: string[]): OfficialAlert[] {
  const zoneSet = new Set(zoneIds)
  return alerts.filter((alert) => zoneSet.has(alert.officialZoneId))
}

// El aviso rige en [startsAt, endsAt) y el día `date` es [date 00:00, date+1
// 00:00): hay solape si empieza el propio día o antes, y termina después de
// su primera medianoche. Un fin exacto a las 00:00 (IPMA) es el comienzo de
// ese día, no una hora dentro de él.
//
// Se compara la hora de pared de los primeros 19 caracteres como texto, sin
// pasar por Date: IPMA entrega startsAt/endsAt sin offset (ej.
// "2026-09-08T12:00:00"), que `new Date(...)` interpretaría con la zona
// horaria del entorno de ejecución en vez de la del aviso. AEMET sí trae
// offset, el de su propia zona (`+01:00` en Canarias), y también se lee en su
// reloj local, que es el del día natural del lugar.
export function isActiveOnDate(alert: OfficialAlert, date: string): boolean {
  return alert.startsAt.slice(0, 10) <= date && alert.endsAt.slice(0, 19) > `${date}T00:00:00`
}
