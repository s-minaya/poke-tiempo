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
