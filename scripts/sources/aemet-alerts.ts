import type { AlertLevel, AlertPhenomenon, OfficialAlert } from '../../src/domain/types.ts'
import { fetchAemetBinary } from './aemet-client.ts'
import { parseTar } from './tar.ts'

/**
 * Avisos oficiales de AEMET (`avisos_cap`): una llamada por área (CCAA +
 * Ceuta + Melilla, códigos 61-79) devuelve un `.tar` con un CAP XML por
 * zona/fenómeno. El código de área es siempre los dos primeros dígitos de
 * `Location.alertZoneIds.aemet` (confirmado contra la API real: zona
 * "610403" vive en el área "61") — nunca hace falta un catálogo aparte de
 * área↔zona.
 *
 * El área devuelve TODAS las zonas del área, con nivel "verde" como línea
 * base cuando no hay nada activo — se filtran aquí, antes de llegar a
 * `OfficialAlert` (que nunca representa "verde", ver `002-plan.md`).
 */

export interface AemetRawAlert {
  zoneId: string // "AEMET-Meteoalerta zona", p. ej. "610403" o "610403C" (costero)
  level: string // "AEMET-Meteoalerta nivel": verde | amarillo | naranja | rojo
  phenomenonCode: string // p. ej. "PR"
  phenomenonLabel: string // p. ej. "Lluvias" — literal de la fuente
  startsAt: string
  endsAt: string
}

export function areaCodeForZone(zoneId: string): string {
  return zoneId.slice(0, 2)
}

export function parseAemetCapXml(xml: string): AemetRawAlert[] {
  const alerts: AemetRawAlert[] = []

  // Cada fichero CAP trae el mismo aviso en varios idiomas — nos quedamos
  // solo con el bloque en español (es-ES), nunca mezclado con el inglés.
  const infoBlocks = xml.split('<info>').slice(1).map((block) => block.split('</info>')[0])

  for (const info of infoBlocks) {
    if (!info.includes('<language>es-ES</language>')) continue

    const nivel = info.match(/AEMET-Meteoalerta nivel<\/valueName>\s*<value>(.*?)<\/value>/)?.[1]
    const eventCodeValue = info.match(
      /AEMET-Meteoalerta fenomeno<\/valueName>\s*<value>(.*?)<\/value>/,
    )?.[1]
    const onset = info.match(/<onset>(.*?)<\/onset>/)?.[1]
    const effective = info.match(/<effective>(.*?)<\/effective>/)?.[1]
    const expires = info.match(/<expires>(.*?)<\/expires>/)?.[1]
    const startsAt = onset ?? effective

    if (!nivel || !eventCodeValue || !startsAt || !expires) continue
    const [phenomenonCode, phenomenonLabel] = eventCodeValue.split(';')
    if (!phenomenonCode || !phenomenonLabel) continue

    const areaBlocks = info.split('<area>').slice(1).map((block) => block.split('</area>')[0])
    for (const area of areaBlocks) {
      const zoneId = area.match(/AEMET-Meteoalerta zona<\/valueName>\s*<value>(.*?)<\/value>/)?.[1]
      if (!zoneId) continue
      alerts.push({ zoneId, level: nivel, phenomenonCode, phenomenonLabel, startsAt, endsAt: expires })
    }
  }

  return alerts
}

export async function fetchAemetAreaAlerts(areaCode: string, apiKey: string): Promise<AemetRawAlert[]> {
  const buffer = await fetchAemetBinary(`/api/avisos_cap/ultimoelaborado/area/${areaCode}`, apiKey)
  const entries = parseTar(Buffer.from(buffer))

  const alerts: AemetRawAlert[] = []
  for (const entry of entries) {
    if (!entry.name.endsWith('.xml')) continue
    alerts.push(...parseAemetCapXml(entry.content.toString('utf-8')))
  }
  return alerts
}

// Catálogo real confirmado contra `avisos_cap` (no supuesto): AL y GA y RI
// no tienen categoría en el dominio — caen en 'desconocido' a propósito, es
// la válvula de escape que ya prevé el contrato, no un hueco por rellenar.
const AEMET_PHENOMENON_MAP: Record<string, AlertPhenomenon> = {
  PR: 'lluvia',
  NE: 'nieve',
  VI: 'viento',
  TO: 'tormenta',
  AT: 'temperatura_maxima',
  BT: 'temperatura_minima',
  CO: 'costero',
  NI: 'niebla',
  VS: 'calima',
  DH: 'deshielo',
}

const AEMET_LEVEL_MAP: Record<string, AlertLevel> = {
  amarillo: 'amarillo',
  naranja: 'naranja',
  rojo: 'rojo',
  // verde: sin entrada — el nivel "sin aviso" no se representa (ver arriba).
}

export function normalizeAemetAlert(raw: AemetRawAlert): OfficialAlert | null {
  const level = AEMET_LEVEL_MAP[raw.level]
  if (!level) return null

  return {
    level,
    phenomenon: AEMET_PHENOMENON_MAP[raw.phenomenonCode] ?? 'desconocido',
    sourcePhenomenon: raw.phenomenonLabel,
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    source: 'aemet',
    officialZoneId: raw.zoneId,
  }
}
