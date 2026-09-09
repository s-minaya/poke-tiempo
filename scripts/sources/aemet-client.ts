/**
 * Transporte HTTP compartido para AEMET OpenData: doble llamada (la primera
 * devuelve una URL temporal en `datos`, la segunda trae el JSON real en
 * ISO-8859-1), con throttle para respetar el rate limit de la API key y
 * reintentos ante fallos transitorios. Lo usan tanto `build-locations.ts`
 * (maestro de municipios) como `sources/aemet.ts` (predicción).
 *
 * tech-stack.md documenta 50 peticiones/minuto por API key, pero una
 * ejecución real de los 74 lugares (~150 peticiones) a 45/min produjo 429
 * repartidos a lo largo de toda la tanda, no solo al final — el límite
 * sostenido real es más estricto que el documentado, o hay variabilidad de
 * servidor que el ritmo documentado no cubre. `AEMET_MAX_REQUESTS_PER_MINUTE`
 * baja con margen adicional, y un 429 recibe un backoff propio, más largo
 * que el de un fallo de red genérico — 3 reintentos rápidos no bastan para
 * dejar pasar la ventana de limitación.
 */

const AEMET_MAX_REQUESTS_PER_MINUTE = 28
const AEMET_MIN_REQUEST_INTERVAL_MS = Math.ceil(60_000 / AEMET_MAX_REQUESTS_PER_MINUTE)

const AEMET_MAX_ATTEMPTS = 4
const AEMET_RETRY_BASE_DELAY_MS = 500
const AEMET_RATE_LIMIT_RETRY_DELAY_MS = 15_000

export class AemetAuthError extends Error {}
export class AemetRateLimitError extends Error {}

interface AemetEnvelope {
  estado: number
  descripcion: string
  datos: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Cola simple de un único hueco: cada llamada espera su turno antes de
// disparar la petición envelope (la que consume cupo de la api_key).
let nextRequestAt = 0

async function waitForTurn(): Promise<void> {
  const now = Date.now()
  const scheduledAt = Math.max(now, nextRequestAt)
  nextRequestAt = scheduledAt + AEMET_MIN_REQUEST_INTERVAL_MS
  const waitMs = scheduledAt - now
  if (waitMs > 0) {
    await sleep(waitMs)
  }
}

async function resolveDatosUrl(path: string, apiKey: string): Promise<string> {
  await waitForTurn()

  const envelopeResponse = await fetch(`https://opendata.aemet.es/opendata${path}`, {
    headers: { api_key: apiKey },
  })
  if (envelopeResponse.status === 401 || envelopeResponse.status === 403) {
    throw new AemetAuthError(
      `AEMET ${path}: HTTP ${envelopeResponse.status} — la API key puede haber caducado`,
    )
  }
  if (envelopeResponse.status === 429) {
    throw new AemetRateLimitError(`AEMET ${path}: HTTP 429 — límite de peticiones alcanzado`)
  }
  if (!envelopeResponse.ok) {
    throw new Error(`AEMET ${path}: HTTP ${envelopeResponse.status}`)
  }
  const envelope = (await envelopeResponse.json()) as AemetEnvelope
  if (envelope.estado !== 200) {
    throw new Error(`AEMET ${path}: estado ${envelope.estado} (${envelope.descripcion})`)
  }
  return envelope.datos
}

async function requestJsonOnce<T>(path: string, apiKey: string): Promise<T> {
  const datosUrl = await resolveDatosUrl(path, apiKey)
  const dataResponse = await fetch(datosUrl)
  if (!dataResponse.ok) {
    throw new Error(`AEMET ${path} (datos): HTTP ${dataResponse.status}`)
  }
  // Respuesta en ISO-8859-1, no UTF-8 — hay que decodificarla explícitamente.
  const buffer = await dataResponse.arrayBuffer()
  const text = new TextDecoder('iso-8859-1').decode(buffer)
  return JSON.parse(text) as T
}

async function requestBinaryOnce(path: string, apiKey: string): Promise<ArrayBuffer> {
  const datosUrl = await resolveDatosUrl(path, apiKey)
  const dataResponse = await fetch(datosUrl)
  if (!dataResponse.ok) {
    throw new Error(`AEMET ${path} (datos): HTTP ${dataResponse.status}`)
  }
  return dataResponse.arrayBuffer()
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= AEMET_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof AemetAuthError) {
        throw error
      }
      lastError = error
      if (attempt < AEMET_MAX_ATTEMPTS) {
        const delay =
          error instanceof AemetRateLimitError
            ? AEMET_RATE_LIMIT_RETRY_DELAY_MS * attempt // backoff lineal, más paciente que el genérico
            : AEMET_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
        await sleep(delay)
      }
    }
  }
  throw lastError
}

/**
 * Llama a un endpoint de AEMET OpenData con la doble llamada, decodificación
 * ISO-8859-1, throttle bajo el rate limit y reintentos con backoff ante
 * fallos transitorios. Un 401/403 (key caducada) nunca se reintenta: falla
 * de inmediato y de forma ruidosa, tal como fija `tech-stack.md`.
 */
export async function fetchAemetJson<T>(path: string, apiKey: string): Promise<T> {
  return withRetry(() => requestJsonOnce<T>(path, apiKey))
}

/**
 * Igual que `fetchAemetJson`, pero para endpoints cuya `datos` no es JSON
 * (p. ej. `avisos_cap`, que sirve un `.tar` con ficheros CAP XML dentro) —
 * mismo throttle, mismos reintentos, sin decodificar ni parsear el cuerpo.
 */
export async function fetchAemetBinary(path: string, apiKey: string): Promise<ArrayBuffer> {
  return withRetry(() => requestBinaryOnce(path, apiKey))
}
