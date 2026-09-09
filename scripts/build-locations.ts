import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { Location } from '../src/domain/types.ts'
import { locationsManualConfig } from './config/locations.manual.ts'
import { fetchAemetJson } from './sources/aemet-client.ts'

/**
 * Genera `src/data/locations.ts` a partir de `scripts/config/locations.manual.ts`,
 * resolviendo `sourceIds` (código de municipio AEMET / `globalIdLocal` IPMA)
 * contra los catálogos reales de cada fuente. No se ejecuta en el workflow
 * diario — solo cuando cambia la lista de lugares.
 */

interface AemetMunicipio {
  id: string
  nombre: string
}

interface IpmaLocation {
  local: string
  globalIdLocal: number
}

async function fetchAemetMunicipios(apiKey: string): Promise<AemetMunicipio[]> {
  return fetchAemetJson<AemetMunicipio[]>('/api/maestro/municipios', apiKey)
}

async function fetchIpmaLocations(): Promise<IpmaLocation[]> {
  const response = await fetch('https://api.ipma.pt/open-data/distrits-islands.json')
  if (!response.ok) {
    throw new Error(`IPMA distrits-islands: HTTP ${response.status}`)
  }
  const body = (await response.json()) as { data: IpmaLocation[] }
  return body.data
}

function resolveAemetMunicipioId(lookupName: string, municipios: AemetMunicipio[]): string {
  const matches = municipios.filter((m) => m.nombre.toLowerCase() === lookupName.toLowerCase())
  if (matches.length !== 1) {
    throw new Error(
      `AEMET: "${lookupName}" resolvió a ${matches.length} municipios, se esperaba exactamente 1`,
    )
  }
  return matches[0].id.replace(/^id/, '')
}

function resolveIpmaGlobalId(lookupName: string, locations: IpmaLocation[]): number {
  const matches = locations.filter((l) => l.local === lookupName)
  if (matches.length !== 1) {
    throw new Error(
      `IPMA: "${lookupName}" resolvió a ${matches.length} ubicaciones, se esperaba exactamente 1`,
    )
  }
  return matches[0].globalIdLocal
}

const EXPECTED_LOCATION_COUNT = 74

function validateLocations(locations: Location[]): void {
  if (locations.length !== EXPECTED_LOCATION_COUNT) {
    throw new Error(`Se esperaban ${EXPECTED_LOCATION_COUNT} lugares, se generaron ${locations.length}`)
  }

  const seenIds = new Set<string>()
  for (const location of locations) {
    if (seenIds.has(location.id)) {
      throw new Error(`Id duplicado en locations: "${location.id}"`)
    }
    seenIds.add(location.id)

    if (location.coastal && !location.marineCoordinates) {
      throw new Error(`"${location.id}" es coastal pero no tiene marineCoordinates`)
    }
  }
}

async function buildLocations(): Promise<void> {
  const apiKey = process.env.AEMET_API_KEY
  if (!apiKey) {
    throw new Error('Falta AEMET_API_KEY en el entorno (.env en local, Secrets en Actions)')
  }

  const [municipios, ipmaLocations] = await Promise.all([
    fetchAemetMunicipios(apiKey),
    fetchIpmaLocations(),
  ])

  const locations: Location[] = locationsManualConfig.map((config) => {
    const { sourceLookupName, ...location } = config
    const lookupName = sourceLookupName ?? config.name

    const sourceIds: Location['sourceIds'] =
      config.primarySource === 'aemet'
        ? { aemet: resolveAemetMunicipioId(lookupName, municipios) }
        : config.primarySource === 'ipma'
          ? { ipma: resolveIpmaGlobalId(lookupName, ipmaLocations) }
          : {}

    return { ...location, sourceIds }
  })

  validateLocations(locations)

  const outputPath = fileURLToPath(new URL('../src/data/locations.ts', import.meta.url))
  const header =
    '// ARCHIVO GENERADO — no editar a mano.\n' +
    '// Generado por `npm run build:locations` a partir de `scripts/config/locations.manual.ts`.\n\n' +
    "import type { Location } from '../domain/types.ts'\n\n"
  const body = `export const locations: Location[] = ${JSON.stringify(locations, null, 2)}\n`
  await writeFile(outputPath, header + body, 'utf-8')

  console.log(`locations.ts generado con ${locations.length} lugares.`)
}

buildLocations().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
