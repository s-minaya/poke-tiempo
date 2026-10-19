/**
 * Lo que Oak no puede decir (`010-spec.md`): expresiones cuyo significado
 * depende del momento en que se lee. El mapa se publica la víspera y puede
 * leerse días después, así que «hoy» sería falso buena parte del tiempo.
 * Oak sitúa el día anclado a la fecha de la previsión —«el lunes», «la noche
 * del lunes»— y nunca al momento de quien lee.
 *
 * Es la única fuente del contrato: el prompt, la guarda factual, la lectura
 * de `oak-today.json` y los tests del respaldo importan de aquí. Añadir o
 * quitar una expresión es decisión del usuario, no un ajuste de redacción.
 */

/** Exactamente estas cinco. «Mañana» también como franja del día: «por la mañana» se rechaza a propósito. */
export const RELATIVE_DAY_WORDS = ['hoy', 'mañana', 'ayer', 'anoche', 'anteayer'] as const

/** Frases relativas inequívocas. Nada de palabras sueltas como «esta» o «ahora», que darían falsos positivos. */
export const RELATIVE_TIME_PHRASES = ['esta mañana', 'esta tarde', 'esta noche', 'esta madrugada'] as const

/**
 * Las familias que amplían la restricción (`013-spec.md` → Restricciones
 * temporales). Es una lista **cerrada**: no hay que detectar equivalentes que
 * no estén enumerados. «Fin de semana» suelto no aparece en ninguna: describir
 * que la fecha de previsión cae en fin de semana sigue permitido, lo que se
 * prohíbe son las cuatro formulaciones que lo tratan como periodo.
 */
export const RELATIVE_WEEK_PHRASES = ['esta semana', 'la próxima semana', 'la semana que viene', 'la semana pasada'] as const

export const RELATIVE_MONTH_PHRASES = ['este mes', 'el próximo mes', 'el mes que viene', 'el mes pasado'] as const

export const RELATIVE_DAYS_PHRASES = [
  'los próximos días',
  'en los próximos días',
  'durante los próximos días',
  'los siguientes días',
  'en los siguientes días',
  'los últimos días',
] as const

/**
 * Los desplazamientos relativos. La `N` es variable, así que se resuelven con
 * un patrón cerrado y no enumerando números: «dentro de unos días» es la única
 * forma sin cifra.
 */
export const RELATIVE_SHIFT_PHRASES = ['dentro de N días', 'en N días', 'hace N días', 'dentro de unos días'] as const

export const RELATIVE_SEASON_PHRASES = ['esta temporada', 'la próxima temporada', 'la temporada que viene', 'la temporada pasada'] as const

export const RELATIVE_STATION_PHRASES = [
  'esta primavera',
  'este verano',
  'este otoño',
  'este invierno',
  'la próxima primavera',
  'el próximo verano',
  'el próximo otoño',
  'el próximo invierno',
  'la primavera pasada',
  'el verano pasado',
  'el otoño pasado',
  'el invierno pasado',
] as const

export const RELATIVE_WEEKEND_PERIOD_PHRASES = ['este fin de semana', 'el próximo fin de semana', 'el fin de semana que viene', 'el fin de semana pasado'] as const

export const RELATIVE_OTHER_PHRASES = ['más adelante', 'en adelante'] as const

/** Las familias anteriores en una sola lista, para el matcher. Sin las cuatro frases ya existentes. */
export const RELATIVE_PERIOD_PHRASES = [
  ...RELATIVE_WEEK_PHRASES,
  ...RELATIVE_MONTH_PHRASES,
  ...RELATIVE_DAYS_PHRASES,
  ...RELATIVE_SEASON_PHRASES,
  ...RELATIVE_STATION_PHRASES,
  ...RELATIVE_WEEKEND_PERIOD_PHRASES,
  ...RELATIVE_OTHER_PHRASES,
] as const

/**
 * «Estamos a» solo cuando sitúa el momento de lectura: seguido de un día de
 * la semana («estamos a lunes») o de una fecha («estamos a 5 de octubre»).
 * Suelto no se rechaza: «estamos a 30 grados» o «estamos a 1000 metros» no
 * hablan del momento de lectura.
 */
export const READING_DATE_RULE = '«estamos a» seguido de un día de la semana o de una fecha'

const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export interface RelativeTimeMatch {
  kind: 'word' | 'phrase' | 'reading-date'
  /** La entrada de la lista que coincide; en `reading-date`, el texto encontrado, ya normalizado. */
  expression: string
}

/**
 * Sin tildes ni diéresis, en minúsculas y con los espacios consecutivos
 * reducidos a uno: «Estamos  a   Miércoles» y «estamos a miercoles» son la
 * misma frase. La «ñ» pierde también su tilde, así que «mañana» y «manana»
 * coinciden igual.
 */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/gu, ' ')
}

/** Palabra o frase completa: ni pegada a una letra o cifra por delante, ni por detrás. «hoyo» no contiene «hoy». */
function wholeTerm(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${source}(?![\\p{L}\\p{N}])`, 'u')
}

const WORD_PATTERNS = RELATIVE_DAY_WORDS.map((word) => ({ expression: word, pattern: wholeTerm(normalize(word)) }))

/**
 * Las frases se ordenan de más larga a más corta para que gane la más
 * específica: «durante los próximos días» se informa como tal, no como el
 * trozo «los próximos días» que contiene. Las cuatro frases de la 010 van
 * primero por si alguna compartiera texto con las nuevas.
 */
const PHRASE_PATTERNS = [
  ...RELATIVE_TIME_PHRASES,
  ...[...RELATIVE_PERIOD_PHRASES].sort((first, second) => second.length - first.length),
].map((phrase) => ({ expression: phrase, pattern: wholeTerm(normalize(phrase)) }))

const SHIFT_SOURCE = '(?:dentro de (?:\\d{1,3}|unos) días|en \\d{1,3} días|hace \\d{1,3} días)'
const SHIFT_PATTERN = wholeTerm(normalize(SHIFT_SOURCE))

const READING_DATE_PATTERN = wholeTerm(
  `estamos a (?:${WEEKDAYS.map(normalize).join('|')}|\\d{1,2} de (?:${MONTHS.join('|')}))`,
)

/**
 * La primera expresión relativa al momento de lectura que contiene el texto,
 * o `null`. Busca primero las frases y la regla de «estamos a», así que
 * «esta mañana» se informa como frase y no como la palabra «mañana».
 */
export function findRelativeTimeExpression(text: string): RelativeTimeMatch | null {
  const normalized = normalize(text)

  for (const { expression, pattern } of PHRASE_PATTERNS) {
    if (pattern.test(normalized)) return { kind: 'phrase', expression }
  }

  const shift = SHIFT_PATTERN.exec(normalized)
  if (shift) return { kind: 'phrase', expression: shift[0] }

  const readingDate = READING_DATE_PATTERN.exec(normalized)
  if (readingDate) return { kind: 'reading-date', expression: readingDate[0] }

  for (const { expression, pattern } of WORD_PATTERNS) {
    if (pattern.test(normalized)) return { kind: 'word', expression }
  }

  return null
}
