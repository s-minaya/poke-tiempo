import type { Degradation, MetricPath, Provenance, SourceId, WeatherBlock } from './types.ts'

/**
 * Combina el bloque meteorológico de la fuente principal con el resultado
 * de intentar una fuente complementaria (Open-Meteo), produciendo el bloque
 * final, su `Provenance` y sus `Degradation[]` — la lógica pura que describe
 * `002-plan.md` ("Combinación de fuentes"), sin I/O.
 */

// Qué métricas complementa Open-Meteo según la fuente principal del lugar,
// tal como fija la tabla de `002-plan.md`. Andorra (`open-meteo` como
// principal) no aparece: no tiene complemento, es fuente única.
export const COMPLEMENT_METRICS_BY_PRIMARY_SOURCE: Record<'aemet' | 'ipma', MetricPath[]> = {
  aemet: ['precipitation.mm', 'snow.cm'],
  ipma: ['precipitation.mm', 'snow.cm', 'wind.speedKmh', 'wind.gustKmh'],
}

export type ComplementAttempt =
  | { status: 'ok'; values: Partial<Record<MetricPath, number>> }
  | { status: 'error' }

/**
 * Regla de coherencia entre `snow.cm` y `snow.present`: cuando hay un valor
 * real de `cm` (no `null`), `present` se deriva de él (`cm > 0`) en vez de
 * tomarse independiente — un único origen de verdad para el eje. Solo si
 * `cm` es `null` se cae de vuelta a la señal categórica de la fuente
 * principal.
 */
export function deriveSnowPresent(cm: number | null, categoricalPresent: boolean | null): boolean | null {
  return cm !== null ? cm > 0 : categoricalPresent
}

function applyMetric(block: WeatherBlock, metric: MetricPath, value: number): void {
  switch (metric) {
    case 'precipitation.mm':
      if (block.precipitation) block.precipitation = { ...block.precipitation, mm: value }
      break
    case 'snow.cm':
      if (block.snow) block.snow = { ...block.snow, cm: value }
      break
    case 'wind.speedKmh':
      if (block.wind) block.wind = { ...block.wind, speedKmh: value }
      break
    case 'wind.gustKmh':
      if (block.wind) block.wind = { ...block.wind, gustKmh: value }
      break
    case 'marine.waveHeightM':
    case 'marine.wavePeriodS':
    case 'marine.waveDirectionDeg':
      // marine no se combina aquí — vive fuera de WeatherBlock, es de otro bloque.
      break
  }
}

export interface CombinedWeather {
  block: WeatherBlock
  provenance: Provenance
  degradations: Degradation[]
}

/**
 * `complementMetrics` son las métricas que este lugar intenta complementar
 * (según su fuente principal — ver `COMPLEMENT_METRICS_BY_PRIMARY_SOURCE`).
 * Cada una que el intento no resuelva (fallo de fuente, o `status: 'ok'`
 * pero sin esa métrica concreta en la respuesta) genera una `Degradation`;
 * las que sí resuelve quedan en `provenance.complementary`.
 */
export function combineWeatherBlock(
  primary: WeatherBlock,
  primarySourceId: SourceId,
  complementSourceId: SourceId,
  complementMetrics: MetricPath[],
  complementAttempt: ComplementAttempt,
): CombinedWeather {
  const block: WeatherBlock = {
    ...primary,
    precipitation: primary.precipitation ? { ...primary.precipitation } : null,
    snow: primary.snow ? { ...primary.snow } : null,
    wind: primary.wind ? { ...primary.wind } : null,
  }

  const complementary: Partial<Record<MetricPath, SourceId>> = {}
  const degradations: Degradation[] = []

  for (const metric of complementMetrics) {
    const value = complementAttempt.status === 'ok' ? complementAttempt.values[metric] : undefined
    if (value !== undefined) {
      applyMetric(block, metric, value)
      complementary[metric] = complementSourceId
    } else {
      degradations.push({ metric, reason: 'source_error', attemptedSource: complementSourceId })
    }
  }

  if (block.snow) {
    block.snow = { ...block.snow, present: deriveSnowPresent(block.snow.cm, block.snow.present) }
  }

  return {
    block,
    provenance: {
      primary: primarySourceId,
      ...(Object.keys(complementary).length > 0 ? { complementary } : {}),
    },
    degradations,
  }
}
