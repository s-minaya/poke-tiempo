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

// Compara los prefijos YYYY-MM-DD como texto, sin pasar por Date: IPMA
// entrega startsAt/endsAt sin offset (ej. "2026-09-08T12:00:00"), que
// `new Date(...)` interpretaría con la zona horaria del entorno de
// ejecución en vez de la del aviso — justo la ambigüedad que se evita
// quedándose en el día calendario, sin necesidad de zona horaria.
export function isActiveOnDate(alert: OfficialAlert, date: string): boolean {
  return alert.startsAt.slice(0, 10) <= date && alert.endsAt.slice(0, 10) >= date
}
