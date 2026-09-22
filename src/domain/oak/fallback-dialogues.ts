import { POKEMON_NAMES, displayPokemonName, hasSharedName } from '../pokemon-names.ts'
import type { AlertPhenomenon } from '../types.ts'
import type { LeitmotifId } from './leitmotifs.ts'
import { DIALOGUE_MAX_LENGTH, DIALOGUE_MIN_LENGTH } from './plan-dialogues.ts'
import type { DayPlan, DialogueSlot, OakDialogue, OakDialogues, Tone } from './plan-dialogues.ts'
import type {
  AlertFact,
  CalendarFact,
  CalimaFact,
  DayShapeFact,
  FogFact,
  MarineFact,
  NarrativeFact,
  PokemonSpotlightFact,
  RainFact,
  SnowFact,
  StormFact,
  TemperatureFact,
  Weekday,
  WindFact,
} from './types.ts'

/**
 * Los tres bocadillos de Oak sin red: el mismo `DayPlan`, las mismas
 * decisiones, solo puestos en palabras. No es un mensaje de emergencia —
 * es contenido del producto, y el día que la IA no conteste nadie debería
 * notar la diferencia salvo por el matiz de la redacción.
 *
 * **Este módulo no decide nada.** No toca los hechos, no elige protagonista,
 * no cambia el modo, no busca otro leitmotiv, no vuelve al forecast y no
 * llama a `assignPokemon` ni mira `MAP_PRIORITY`. Recibe un plan cerrado y
 * lo verbaliza.
 *
 * Regla factual: toda afirmación comprobable sale de los hechos del slot.
 * La personalidad ("¡Vaya!", "Yo tendría cuidado") no aporta datos, y un
 * chiste nunca introduce un fenómeno, un lugar, un Pokémon ni una cifra que
 * no estuviera ya en un hecho.
 */

// ---------------------------------------------------------------------------
// Formato — presentación, nunca semántica
// ---------------------------------------------------------------------------

// Coma decimal española y un decimal como mucho: `7.6000000001` se lee
// "7,6" sin perder el valor. No se redondea al entero: 19,3 °C es 19,3 °C.
const DECIMAL = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
const WHOLE = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

function decimal(value: number): string {
  return DECIMAL.format(value)
}

function whole(value: number): string {
  return WHOLE.format(value)
}

/** Los `Weekday` del contrato van sin tilde (son identificadores); al leerlos sí llevan. */
const WEEKDAY_TEXT: Record<Weekday, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  domingo: 'domingo',
}

/** Cómo se lee en voz alta el fenómeno de un aviso. No reinterpreta el nivel ni la categoría. */
const PHENOMENON_TEXT: Record<AlertPhenomenon, string> = {
  lluvia: 'lluvia',
  nieve: 'nieve',
  viento: 'viento',
  tormenta: 'tormentas',
  temperatura_maxima: 'temperaturas altas',
  temperatura_minima: 'temperaturas bajas',
  costero: 'fenómenos costeros',
  niebla: 'niebla',
  calima: 'calima',
  deshielo: 'deshielo',
  desconocido: 'un fenómeno sin clasificar',
}

/**
 * "Lugares", no "puntos": un punto es la chincheta del mapa y Oak no habla
 * de chinchetas. El recuento es el mismo; la palabra es la de una persona.
 */
function places(count: number): string {
  return count === 1 ? 'un lugar' : `${whole(count)} lugares`
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// ---------------------------------------------------------------------------
// Variación determinista
// ---------------------------------------------------------------------------

/**
 * Reparto estable entre variantes. No es un PRNG: es una suma posicional
 * sobre las partes que identifican esa elección (fecha, diálogo, hecho o
 * gag), así que el mismo `DayPlan` produce siempre los mismos textos y dos
 * fechas distintas pueden caer en variantes distintas.
 */
function seedOf(parts: readonly string[]): number {
  const text = parts.join('|')
  let seed = 0
  for (let index = 0; index < text.length; index += 1) {
    seed = (seed * 31 + text.charCodeAt(index)) % 1_000_003
  }
  return seed
}

function pick<T>(variants: readonly T[], parts: readonly string[]): T {
  return variants[seedOf(parts) % variants.length]
}

/**
 * Como `pick`, pero evitando lo que ya se ha dicho hoy: tres bocadillos
 * seguidos abriendo con "Veamos." cantan. Si todas las variantes están
 * gastadas se reutiliza el repertorio entero — repetirse es mejor que
 * quedarse sin voz.
 */
function pickFresh(variants: readonly string[], parts: readonly string[], used: ReadonlySet<string>): string {
  const fresh = variants.filter((variant) => variant === '' || !used.has(variant))
  return pick(fresh.length > 0 ? fresh : variants, parts)
}

// ---------------------------------------------------------------------------
// Cláusulas — una por `kind`, doce en total
// ---------------------------------------------------------------------------

/**
 * Un hecho puesto en palabras: un fragmento sin punto final, que empieza en
 * minúscula o por un nombre propio para poder encadenarse con otro.
 */
interface Clause {
  fragment: string
}

interface ClauseContext {
  /** Semilla: fecha + diálogo, para que la variante sea estable y varíe entre días. */
  parts: readonly string[]
  /** Formulación corta cuando la completa no cabe en 160 caracteres. */
  compact: boolean
  /** La frase del gag, si el hueco lleva uno: el spotlight mira si ya ha dicho el nombre. */
  gag: string | null
  /** Un hecho anterior del mismo hueco ya nombró este lugar: se dice "allí" y no se repite. */
  samePlace: boolean
}

function temperatureClause(fact: TemperatureFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'temperature', fact.role, fact.locationId]
  const place = fact.locationName

  if (fact.role === 'coldest_night') {
    const value = `${decimal(fact.minC)} °C`
    if (context.samePlace) return { fragment: `allí la mínima baja hasta ${value}` }
    if (context.compact) return { fragment: `mínima más baja en ${place}: ${value}` }
    return {
      fragment: pick(
        [`la noche más fresca se la lleva ${place}, con ${value}`, `en ${place} la mínima baja hasta ${value}`],
        parts,
      ),
    }
  }

  const value = `${decimal(fact.maxC)} °C`

  if (fact.role === 'coldest_day') {
    if (context.samePlace) return { fragment: `allí la máxima no pasa de ${value}` }
    if (context.compact) return { fragment: `máxima más baja en ${place}: ${value}` }
    return {
      fragment: pick(
        [`${place} se queda con la máxima más baja del día, ${value}`, `en ${place} la máxima no pasa de ${value}`],
        parts,
      ),
    }
  }

  if (context.samePlace) return { fragment: `allí está la máxima del día, ${value}` }
  if (context.compact) return { fragment: `máxima del día en ${place}: ${value}` }
  return {
    fragment: pick([`${place} marca la máxima del día con ${value}`, `la máxima del día se va hasta ${value}, en ${place}`], parts),
  }
}

function rainClause(fact: RainFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'rain', fact.locationId]
  const place = fact.locationName
  const amount = `${decimal(fact.mm)} mm`

  // La probabilidad se cuenta como probabilidad: un 60 % no es una certeza.
  const chance = fact.probabilityPercent === null ? '' : `, con un ${whole(fact.probabilityPercent)} % de probabilidad`
  if (context.samePlace) return { fragment: `allí se esperan ${amount}${chance}` }
  if (context.compact) return { fragment: `en ${place}, ${amount} previstos` }
  return { fragment: pick([`en ${place} se esperan ${amount}`, `${place} recoge ${amount} previstos`], parts) + chance }
}

function snowClause(fact: SnowFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'snow', fact.locationId]
  const amount = `${decimal(fact.cm)} cm`

  if (context.samePlace) return { fragment: `allí se prevén ${amount} de nieve` }
  if (context.compact) return { fragment: `en ${fact.locationName}, ${amount} de nieve` }
  return {
    fragment: pick([`se prevén ${amount} de nieve en ${fact.locationName}`, `${fact.locationName} espera ${amount} de nieve`], parts),
  }
}

function windClause(fact: WindFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'wind', fact.locationId]
  const place = fact.locationName
  const speed = `${whole(fact.speedKmh)} km/h`

  // Sin racha no se menciona la racha, y la dirección no existe en el dato.
  const gust = fact.gustKmh === null ? '' : `, con rachas de ${whole(fact.gustKmh)} km/h`
  if (context.samePlace) return { fragment: fact.warm ? `allí sopla viento cálido, a ${speed}${gust}` : `allí el viento sopla a ${speed}${gust}` }
  if (context.compact) return { fragment: `viento de ${speed} en ${place}` }

  const base = fact.warm
    ? pick([`sopla viento cálido en ${place}, a ${speed}`, `${place} recibe viento cálido de ${speed}`], parts)
    : pick([`el viento sopla a ${speed} en ${place}`, `${place} tiene viento de ${speed}`], parts)
  return { fragment: base + gust }
}

function stormClause(fact: StormFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'storm', fact.locationId]
  if (context.samePlace) return { fragment: 'allí hay tormenta prevista' }
  if (context.compact) return { fragment: `tormenta prevista en ${fact.locationName}` }
  return { fragment: pick([`hay tormenta prevista en ${fact.locationName}`, `se espera tormenta en ${fact.locationName}`], parts) }
}

function fogClause(fact: FogFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'fog', fact.locationId]
  if (context.samePlace) return { fragment: 'allí se espera niebla' }
  if (context.compact) return { fragment: `niebla prevista en ${fact.locationName}` }
  return { fragment: pick([`se espera niebla en ${fact.locationName}`, `hay niebla prevista en ${fact.locationName}`], parts) }
}

function calimaClause(fact: CalimaFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'calima', fact.locationId]
  const place = fact.locationName

  // Solo con `fromAlert` se puede citar el aviso: sin él, el respaldo oficial
  // no existe y decir que lo hay sería inventarlo.
  if (fact.fromAlert) {
    if (context.samePlace) return { fragment: 'allí hay calima, con aviso oficial detrás' }
    if (context.compact) return { fragment: `calima con aviso oficial en ${place}` }
    return { fragment: pick([`hay calima en ${place}, con aviso oficial detrás`, `la calima de ${place} viene con aviso oficial`], parts) }
  }

  if (context.samePlace) return { fragment: 'allí hay calima prevista' }
  if (context.compact) return { fragment: `calima prevista en ${place}` }
  return { fragment: pick([`hay calima prevista en ${place}`, `se espera calima en ${place}`], parts) }
}

function marineClause(fact: MarineFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'marine', fact.locationId]
  const place = fact.locationName
  const height = `${decimal(fact.waveHeightM)} m`

  const period = fact.wavePeriodS === null ? '' : `, con periodos de ${decimal(fact.wavePeriodS)} s`
  if (context.samePlace) return { fragment: `allí el mar levanta ${height} de ola${period}` }
  if (context.compact) return { fragment: `olas de ${height} frente a ${place}` }
  return { fragment: pick([`el mar frente a ${place} levanta ${height} de ola`, `frente a ${place} se esperan olas de ${height}`], parts) + period }
}

/**
 * Un aviso oficial: nivel, fenómeno y a quién afecta. `officialZoneId`,
 * `source` y `sourcePhenomenon` son trazabilidad y no se leen en voz alta.
 * El nivel se conserva tal cual — un naranja nunca se cuenta como rojo — y
 * no se añade ninguna instrucción oficial: nuestros datos no traen ninguna.
 */
function alertClause(fact: AlertFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'alert', fact.officialZoneId, fact.phenomenon]
  const phenomenon = PHENOMENON_TEXT[fact.phenomenon]
  const names = fact.affectedLocations.map((place) => place.locationName)

  let where: string
  if (names.length === 0) where = `en ${places(fact.affectedLocationCount)}`
  else if (fact.affectedLocationCount > names.length) where = `en ${places(fact.affectedLocationCount)}, entre ellos ${listNames(names)}`
  else where = `en ${listNames(names)}`

  if (context.compact) return { fragment: `hay aviso ${fact.level} por ${phenomenon} ${where}` }
  // Nada de "se ha emitido": el aviso es de un organismo oficial, pero quien
  // lo cuenta es Oak, no el organismo.
  return {
    fragment: pick([`hay un aviso ${fact.level} por ${phenomenon} ${where}`, `tenemos un aviso oficial ${fact.level} por ${phenomenon} ${where}`], parts),
  }
}

/**
 * El hecho natural para nombrar a un Pokémon: quién es, en cuántos sitios
 * está y unos cuantos de ellos.
 *
 * **`label` solo aclara nombres compartidos.** `POKEMON_LABELS` mezcla
 * sustantivos ("Niebla"), adjetivos ("Caluroso") y sintagmas ("Nevadas
 * intensas"), así que nunca se interpola como pieza de la frase: ahí
 * cualquier plantilla universal rompe la gramática la mitad de las veces.
 * Pero cuando varios `PokedexId` comparten nombre humano — hoy las cuatro
 * formas de Castform — el nombre solo no basta para decir de cuál se habla,
 * y la etiqueta entra **entre paréntesis**, como aclaración explícita y no
 * como sintagma: "Castform (Niebla)". Un Charmander no necesita aclaración
 * y no la lleva.
 *
 * `locationCount` es el total real y `locations` como mucho tres: cuando no
 * coinciden, la lista se presenta como muestra ("entre ellos"), nunca como
 * completa. "Solo" se reserva al único caso que lo justifica: un lugar.
 */
function spotlightClause(fact: PokemonSpotlightFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'spotlight', fact.pokemonId]
  const plainName = POKEMON_NAMES[fact.pokemonId]
  const shared = hasSharedName(fact.pokemonId)
  const name = displayPokemonName(fact.pokemonId, fact.label)
  const sample = listNames(fact.locations.map((place) => place.locationName))
  const exhaustive = fact.locationCount === fact.locations.length && sample !== ''
  const count = places(fact.locationCount)

  // Solo se pronominaliza si el chiste ya ha dicho el nombre: tras "Alguien ha
  // vuelto a tocar el termostato", un "se le ve" no tendría antecedente.
  if (context.gag !== null && context.gag.includes(plainName)) {
    // Con nombre compartido el chiste tampoco ha dicho de cuál hablamos, así
    // que la etiqueta se anuncia como tal en vez de repetir el nombre.
    const opening = shared ? `esta vez, ${fact.label}: ` : ''
    if (exhaustive && fact.locationCount === 1) return { fragment: `${opening}solo aparece en ${sample}` }
    if (context.compact || sample === '') return { fragment: `${opening}aparece en ${count}` }
    if (shared) return { fragment: `${opening}aparece en ${count}, entre ellos ${sample}` }
    return { fragment: pick([`se le ve en ${count}, entre ellos ${sample}`, `se deja ver en ${count}`], parts) }
  }

  if (context.compact || sample === '') return { fragment: `${name} aparece en ${count}` }

  if (exhaustive && fact.locationCount === 1) {
    return { fragment: pick([`${name} solo aparece en ${sample}`, `${name} solo asoma en ${sample}`], parts) }
  }

  if (exhaustive) {
    return { fragment: pick([`${name} aparece en ${sample}`, `${name} se deja ver en ${sample}`], parts) }
  }

  return {
    fragment: pick([`${name} aparece en ${count}, entre ellos ${sample}`, `${name} se deja ver en ${count}, entre ellos ${sample}`], parts),
  }
}

/**
 * La forma del día. Cuatro recuentos, pero no los cuatro en la misma frase:
 * Oak sitúa la jornada, no recita una tabla.
 *
 * **Qué recuento sitúa la jornada, en este orden: avisos, lluvia, y si no hay
 * ninguno de los dos, decirlo.** `distinctPokemonCount` no abre nunca: "hoy
 * tenemos 8 Pokémon distintos" es cierto y no informa de nada — casi
 * cualquier día del año da un número parecido. El campo sigue en
 * `DayShapeFact` porque el hecho no cambia; lo que cambia es qué merece ser
 * la primera frase. Mismo criterio que los claims que recibe la IA, para que
 * las dos vías no prioricen cosas distintas.
 *
 * El total entra como referencia del recuento que sí importa, nunca solo.
 */
function dayShapeClause(fact: DayShapeFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'day_shape']
  const everywhere = `los ${whole(fact.totalLocations)} lugares del mapa`

  if (fact.alertedLocations > 0) {
    if (context.compact) return { fragment: `hay aviso en ${places(fact.alertedLocations)}` }
    return {
      fragment: pick(
        fact.alertedLocations === 1
          ? [`hoy hay aviso en uno de ${everywhere}`, `hoy solo uno de ${everywhere} está bajo aviso`]
          : [`hoy hay avisos en ${whole(fact.alertedLocations)} de ${everywhere}`, `hoy ${whole(fact.alertedLocations)} de ${everywhere} están bajo aviso`],
        parts,
      ),
    }
  }

  if (fact.rainingLocations > 0) {
    if (context.compact) return { fragment: `llueve en ${places(fact.rainingLocations)}` }
    return {
      fragment: pick(
        fact.rainingLocations === 1
          ? [`hoy solo llueve en uno de ${everywhere}`, `hoy llueve en uno de ${everywhere}`]
          : [`hoy llueve en ${whole(fact.rainingLocations)} de ${everywhere}`, `hoy ${whole(fact.rainingLocations)} de ${everywhere} tienen lluvia`],
        parts,
      ),
    }
  }

  if (context.compact) return { fragment: `sin lluvia ni avisos en ${everywhere}` }
  return { fragment: pick([`hoy no llueve en ninguno de ${everywhere}`, `hoy no hay lluvia ni avisos en ${everywhere}`], parts) }
}

/** Día de la semana y poco más: ni efemérides, ni estaciones, ni fiestas. */
function calendarClause(fact: CalendarFact, context: ClauseContext): Clause {
  const parts = [...context.parts, 'calendar', fact.date]
  const weekday = WEEKDAY_TEXT[fact.weekday]

  if (context.compact) return { fragment: `hoy, ${weekday}` }
  if (fact.weekend) return { fragment: pick([`hoy es ${weekday}, fin de semana`, `estamos a ${weekday}`], parts) }
  return { fragment: pick([`hoy es ${weekday}`, `estamos a ${weekday}`], parts) }
}

function clauseFor(fact: NarrativeFact, context: ClauseContext): Clause {
  switch (fact.kind) {
    case 'temperature':
      return temperatureClause(fact, context)
    case 'rain':
      return rainClause(fact, context)
    case 'snow':
      return snowClause(fact, context)
    case 'wind':
      return windClause(fact, context)
    case 'storm':
      return stormClause(fact, context)
    case 'fog':
      return fogClause(fact, context)
    case 'calima':
      return calimaClause(fact, context)
    case 'marine':
      return marineClause(fact, context)
    case 'alert':
      return alertClause(fact, context)
    case 'pokemon_spotlight':
      return spotlightClause(fact, context)
    case 'day_shape':
      return dayShapeClause(fact, context)
    case 'calendar':
      return calendarClause(fact, context)
  }
}

// ---------------------------------------------------------------------------
// Voz — aperturas, remates y gags
// ---------------------------------------------------------------------------

/** El tono ya viene decidido por el plan: aquí solo se obedece. */
const OPENERS: Record<Tone, readonly string[]> = {
  neutral: ['', 'Veamos.', 'Bien.'],
  cientifico: ['Curioso...', 'Interesante.', 'Vaya, esto merece una nota.'],
  epico: ['¡Atención!', '¡Vaya!', 'Esto hay que contarlo.'],
  consejo: ['', 'Un apunte.', 'Atención un momento.'],
  guasa: [''],
}

/**
 * El remate. En `consejo` es prudencia genérica atada al hecho, nunca una
 * instrucción oficial: nuestros datos no traen ninguna y no se inventa.
 */
const TAILS: Record<Tone, readonly string[]> = {
  neutral: ['Seguimos observando.', 'Tomo nota.'],
  cientifico: ['Habrá que anotarlo.', 'Me lo apunto en el cuaderno.'],
  epico: ['Días así no se olvidan.', 'Vaya con el mapa de hoy.'],
  consejo: ['Yo tendría cuidado.', 'Conviene estar atento.', 'Yo saldría preparado.'],
  guasa: [],
}

/**
 * Las redacciones de los cinco gags. El Bloque 3 ya ha comprobado que existe
 * un hecho que los sostiene, así que aquí no se vuelve a comprobar nada ni
 * se cambia de gag. Ninguna de estas frases aporta un dato: la broma se hace
 * con lo que ya hay.
 */
const LEITMOTIF_LINES: Record<LeitmotifId, readonly string[]> = {
  'hoppip-vuela': [
    'Hoppip lo va a tener difícil para quedarse quieto.',
    'A Hoppip le espera un viaje más largo de lo que querría.',
    'Espero que Hoppip recuerde el camino de vuelta al laboratorio.',
  ],
  'castform-vestuario': [
    'Castform ha vuelto a cambiarse de ropa.',
    'Castform se ha vestido para la ocasión, como siempre.',
    'Otra vez Castform de mudanza en el vestuario.',
  ],
  'groudon-termostato': [
    'Alguien ha vuelto a tocar el termostato.',
    'Me hago una idea de quién anda cerca del termostato.',
    'El termostato del laboratorio no se toca solo.',
  ],
  'gyarados-mar': [
    'Yo miraría el mar desde una distancia prudente.',
    'Gyarados parece tener la agenda llena.',
    'Mejor no molestar a quien está de guardia en el mar.',
  ],
  'snorunt-frio': [
    'Snorunt está encantado. Yo buscaría una bufanda.',
    'A Snorunt le va este tiempo; a mí, algo menos.',
    'Snorunt no piensa entrar en casa.',
  ],
}

/**
 * Cómo se encadenan dos hechos. Ninguno de los tres insinúa causa: son dos
 * cosas ciertas el mismo día, no una consecuencia de la otra. `mientras`
 * solo se ofrece entre dos hechos de lugar, donde la simultaneidad se lee
 * natural; con un recuento del día o un aviso suena forzado, y ahí dos
 * frases cortas serían peores que una unión limpia pero una unión rara sería
 * peor que las dos.
 */
const JOINERS = [' y ', '; además, '] as const
const SIMULTANEOUS_KINDS: ReadonlySet<NarrativeFact['kind']> = new Set([
  'temperature',
  'rain',
  'snow',
  'wind',
  'storm',
  'fog',
  'calima',
  'marine',
])

function joinerFor(facts: readonly NarrativeFact[], first: string, parts: readonly string[]): string {
  const simultaneous = facts.every((fact) => SIMULTANEOUS_KINDS.has(fact.kind))
  const pool = simultaneous ? [...JOINERS, ' mientras '] : [...JOINERS]
  // Si el primer fragmento ya termina en una enumeración ("Ourense, Huesca y
  // Jaca"), otro " y " se leería como un elemento más de la lista.
  const usable = first.includes(' y ') ? pool.filter((joiner) => joiner !== ' y ') : pool
  return pick(usable, parts)
}

// ---------------------------------------------------------------------------
// Composición
// ---------------------------------------------------------------------------

/** Los lugares que una cláusula de este hecho va a nombrar. Un recuento del día y el calendario no nombran ninguno. */
function placeNamesOf(fact: NarrativeFact): string[] {
  if (fact.kind === 'alert') return fact.affectedLocations.map((place) => place.locationName)
  if (fact.kind === 'pokemon_spotlight') return fact.locations.map((place) => place.locationName)
  if (fact.kind === 'day_shape' || fact.kind === 'calendar') return []
  return [fact.locationName]
}

function composeBody(slot: DialogueSlot, date: string, compact: boolean, gag: string | null): string {
  // Un aviso y su hecho acompañante hablan del mismo sitio: nombrarlo dos
  // veces en la misma frase suena a formulario, así que el segundo dice "allí".
  const named = new Set<string>()
  const clauses = slot.facts.map((fact) => {
    const places = placeNamesOf(fact)
    // Solo si no hay duda de a dónde apunta: con dos lugares ya nombrados,
    // "allí" sería ambiguo y se repite el nombre.
    const samePlace = named.size === 1 && places.length === 1 && named.has(places[0])
    for (const place of places) named.add(place)
    return clauseFor(fact, { parts: [date, slot.id], compact, gag, samePlace })
  })
  const joiner = clauses.length > 1 ? joinerFor(slot.facts, clauses[0].fragment, [date, slot.id, 'joiner']) : ''
  return `${capitalize(clauses[0].fragment)}${joiner}${clauses.slice(1).map((clause) => clause.fragment).join(joiner)}.`
}

function withParts(...parts: readonly (string | null)[]): string {
  return parts.filter((part): part is string => part !== null && part !== '').join(' ')
}

/**
 * Los 20–160 caracteres se respetan **redactando**, nunca cortando: se
 * ofrecen varias formulaciones de la misma verdad, de la más suelta a la más
 * apretada, y se usa la primera que entra. Lo que se pierde por el camino
 * son detalles opcionales del propio hecho (la lista de lugares, la racha,
 * la etiqueta), nunca el hecho. Si ni la más compacta cabe, es un fallo
 * nuestro de redacción y se lanza un error en vez de publicar una frase
 * partida por la mitad.
 */
/**
 * Con qué voz se dice un tono. Casi siempre la suya — salvo el `epico` de un
 * día serio, que toma prestada la del `consejo`.
 *
 * `epico` se escribió para una invasión de Charmeleon, y sus remates lo
 * celebran: "Días así no se olvidan" delante de un aviso rojo no es humor,
 * pero sí es espectacularizar un fenómeno peligroso. En un día serio épico
 * significa gravedad y atención, así que se usa el registro que ya estaba
 * escrito para atender. No hay voz nueva: hay una voz prestada.
 */
function voiceFor(tone: Tone, serious: boolean): Tone {
  return serious && tone === 'epico' ? 'consejo' : tone
}

function renderSlot(slot: DialogueSlot, date: string, serious: boolean, used: Set<string>): string {
  const candidates: string[] = []
  const voice = voiceFor(slot.tone, serious)

  if (slot.leitmotif) {
    const gag = pick(LEITMOTIF_LINES[slot.leitmotif], [date, slot.id, slot.leitmotif])
    candidates.push(
      withParts(gag, composeBody(slot, date, false, gag)),
      withParts(gag, composeBody(slot, date, true, gag)),
    )
  } else {
    const opener = pickFresh(OPENERS[voice], [date, slot.id, 'opener'], used)
    const tails = TAILS[voice]
    const tail = tails.length > 0 ? pickFresh(tails, [date, slot.id, 'tail'], used) : null
    if (opener !== '') used.add(opener)
    if (tail !== null) used.add(tail)
    // En `consejo` el remate es el sentido del tono, así que va primero;
    // en el resto lo decide la semilla, para que no todo acabe en coletilla.
    const tailFirst = voice === 'consejo' || seedOf([date, slot.id, 'tail-first']) % 2 === 0

    for (const compact of [false, true]) {
      const body = composeBody(slot, date, compact, null)
      const withTail = tail === null ? null : withParts(opener, body, tail)
      const plain = withParts(opener, body)
      candidates.push(...(tailFirst ? [withTail, plain] : [plain, withTail]).filter((text): text is string => text !== null))
      candidates.push(body)
    }
  }

  const chosen = candidates.find((text) => text.length >= DIALOGUE_MIN_LENGTH && text.length <= DIALOGUE_MAX_LENGTH)
  if (!chosen) {
    throw new Error(`Oak no sabe redactar ${slot.id} dentro de ${DIALOGUE_MIN_LENGTH}-${DIALOGUE_MAX_LENGTH} caracteres con los hechos de ese hueco.`)
  }
  return chosen
}

/**
 * Los tres bocadillos del día, en orden y con los `id` del plan. Misma
 * entrada, misma salida: aquí no hay azar ni reloj.
 */
export function generateFallbackDialogues(dayPlan: DayPlan): OakDialogues {
  const [opening, focus, closing] = dayPlan.dialoguePlan
  // Compartido entre los tres huecos, y siempre en el mismo orden: es lo que
  // evita que el día entero suene a la misma muletilla sin romper el
  // determinismo.
  const used = new Set<string>()
  const render = (slot: DialogueSlot): OakDialogue => ({ id: slot.id, text: renderSlot(slot, dayPlan.date, dayPlan.serious, used) })
  return [render(opening), render(focus), render(closing)]
}
