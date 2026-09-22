import { POKEMON_NAMES, displayPokemonName } from '../pokemon-names.ts'
import type { AlertLevel, AlertPhenomenon } from '../types.ts'
import type { DayMode } from './day-mode.ts'
import type { LeitmotifId } from './leitmotifs.ts'
import type { DayPlan, DialogueId, DialogueRole, DialogueSlot, Tone } from './plan-dialogues.ts'
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
 * La verdad del día ya resuelta en español: una afirmación cerrada por hecho,
 * sin campos que interpretar.
 *
 * Existe porque la IA no debe leer nuestro modelo de dominio. Mandarle
 * `{ papel: 'coldest_night', maximaC: 30, minimaC: 10 }` es pedirle que
 * decida cuál de los dos números es la noche — y las dos generaciones reales
 * demostraron que acaba decidiendo mal ("la noche más fría: 10-30 °C").
 * Aquí se decide antes: el claim dice `10 °C` y el `30` **no viaja**. Lo que
 * no está en el payload no se puede publicar.
 *
 * Mismo principio para el resto: `lugaresConAviso: 7` se convierte en "7 de
 * 74 lugares del mapa están bajo algún aviso" para que "7 avisos" deje de
 * ser una lectura posible, y una muestra de tres lugares se anuncia como
 * muestra en la propia frase.
 *
 * **No es una segunda redacción.** Los claims son secos a propósito: enuncian
 * el hecho y se callan. La voz la pone quien redacta después — la IA con su
 * personalidad, o el fallback con la suya, que no pasa por aquí y sigue
 * verbalizando los hechos por su cuenta.
 *
 * Vive en el dominio, no en `scripts/`, porque un claim es una afirmación
 * sobre nuestros datos dicha en nuestro idioma: la misma categoría que las
 * cláusulas del fallback, que ya viven aquí. Ningún vocabulario de proveedor
 * entra en este archivo; la forma del JSON que recibe Groq es del adapter.
 */

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

// Mismo criterio que el fallback —coma decimal española, un decimal como
// mucho— pero con su propia copia: son dos verbalizaciones independientes de
// los mismos hechos y ninguna debe poder arrastrar a la otra.
const DECIMAL = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
const WHOLE = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

function decimal(value: number): string {
  return DECIMAL.format(value)
}

function whole(value: number): string {
  return WHOLE.format(value)
}

/**
 * Toda cantidad de un claim va en dígitos, incluido el uno: "1 lugar" y no
 * "un lugar". No es estilo, es la condición que hace sólida la guarda
 * numérica — si el claim dijera "un lugar" y la IA escribiera "1 lugar",
 * ese `1` sería una cifra sin respaldo y caeríamos al fallback por una
 * paráfrasis correcta.
 */
function places(count: number): string {
  return `${whole(count)} ${count === 1 ? 'lugar' : 'lugares'}`
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
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

/** Cómo se lee el fenómeno de un aviso. No reinterpreta el nivel ni la categoría. */
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

// ---------------------------------------------------------------------------
// Contrato
// ---------------------------------------------------------------------------

/**
 * El vocabulario factual que ese diálogo autoriza. Es la otra cara del
 * claim: si una entidad no está aquí, nombrarla es inventar.
 *
 * Los números **se leen de los propios claims**, no se acumulan aparte: así
 * no pueden desincronizarse de la frase que los contiene.
 */
export interface AllowedEntities {
  numbers: number[]
  places: string[]
  pokemon: string[]
  alertLevels: AlertLevel[]
}

export interface DialogueClaims {
  id: DialogueId
  role: DialogueRole
  tone: Tone
  leitmotif: LeitmotifId | null
  claims: string[]
  allowed: AllowedEntities
}

export interface DayClaims {
  dayMode: DayMode
  dialogues: [DialogueClaims, DialogueClaims, DialogueClaims]
}

/** Lo que aporta un hecho: la afirmación y las entidades que quedan autorizadas al decirla. */
interface ClaimSet {
  claims: string[]
  places: string[]
  pokemon: string[]
  alertLevels: AlertLevel[]
}

function claim(text: string, parts: Partial<Omit<ClaimSet, 'claims'>> = {}): ClaimSet {
  return { claims: [text], places: parts.places ?? [], pokemon: parts.pokemon ?? [], alertLevels: parts.alertLevels ?? [] }
}

// ---------------------------------------------------------------------------
// Un claim por hecho — doce en total
// ---------------------------------------------------------------------------

/**
 * Solo el valor que el papel hace pertinente. `TemperatureFact` lleva siempre
 * los dos extremos del lugar porque el hecho es del lugar, pero la noticia es
 * uno solo de ellos: el otro no es contexto, es una cifra que se puede
 * publicar por error.
 */
function temperatureClaims(fact: TemperatureFact): ClaimSet {
  const place = fact.locationName

  if (fact.role === 'coldest_night') {
    return claim(`En ${place}, la mínima nocturna baja hasta ${decimal(fact.minC)} °C.`, { places: [place] })
  }
  if (fact.role === 'coldest_day') {
    return claim(`${place} registra la máxima diurna más baja, con ${decimal(fact.maxC)} °C.`, { places: [place] })
  }
  return claim(`En ${place}, la máxima del día alcanza ${decimal(fact.maxC)} °C.`, { places: [place] })
}

function rainClaims(fact: RainFact): ClaimSet {
  // La probabilidad se cuenta como probabilidad: un 60 % no es una certeza.
  const chance = fact.probabilityPercent === null ? '' : `, con un ${whole(fact.probabilityPercent)} % de probabilidad`
  return claim(`En ${fact.locationName} se esperan ${decimal(fact.mm)} mm de lluvia${chance}.`, { places: [fact.locationName] })
}

function snowClaims(fact: SnowFact): ClaimSet {
  return claim(`En ${fact.locationName} se esperan ${decimal(fact.cm)} cm de nieve.`, { places: [fact.locationName] })
}

function windClaims(fact: WindFact): ClaimSet {
  // Sin racha no se menciona la racha, y la dirección no existe en el dato.
  const gust = fact.gustKmh === null ? '' : `, con rachas de ${whole(fact.gustKmh)} km/h`
  const wind = fact.warm ? 'viento cálido' : 'viento'
  return claim(`En ${fact.locationName} se espera ${wind} de ${whole(fact.speedKmh)} km/h${gust}.`, { places: [fact.locationName] })
}

function stormClaims(fact: StormFact): ClaimSet {
  return claim(`En ${fact.locationName} se esperan tormentas.`, { places: [fact.locationName] })
}

function fogClaims(fact: FogFact): ClaimSet {
  return claim(`En ${fact.locationName} se espera niebla.`, { places: [fact.locationName] })
}

function calimaClaims(fact: CalimaFact): ClaimSet {
  // Solo con `fromAlert` se puede citar el aviso: sin él, el respaldo oficial
  // no existe y decir que lo hay sería inventarlo.
  const backing = fact.fromAlert ? ', respaldada por un aviso oficial' : ''
  return claim(`En ${fact.locationName} se espera calima${backing}.`, { places: [fact.locationName] })
}

function marineClaims(fact: MarineFact): ClaimSet {
  const period = fact.wavePeriodS === null ? '' : `, con periodos de ${decimal(fact.wavePeriodS)} s`
  return claim(`Frente a ${fact.locationName} se esperan olas de ${decimal(fact.waveHeightM)} m${period}.`, {
    places: [fact.locationName],
  })
}

/**
 * Un aviso oficial. La frase separa el aviso —que es uno— de los lugares
 * nuestros que caen bajo su zona, que pueden ser varios: "7 avisos" salió de
 * mandar el recuento a secas, así que el recuento ya no viaja solo.
 *
 * `officialZoneId`, `source` y `sourcePhenomenon` son trazabilidad y no
 * entran en ninguna frase.
 */
function alertClaims(fact: AlertFact): ClaimSet {
  const phenomenon = PHENOMENON_TEXT[fact.phenomenon]
  const names = fact.affectedLocations.map((place) => place.locationName)
  const head = `Hay un aviso oficial ${fact.level} por ${phenomenon}`
  const meta = { places: names, alertLevels: [fact.level] }

  if (names.length === 0) {
    return claim(`${head} que afecta a ${places(fact.affectedLocationCount)} de nuestro mapa.`, meta)
  }
  if (fact.affectedLocationCount === names.length) {
    if (names.length === 1) return claim(`${head} que afecta a nuestro lugar de ${names[0]}.`, meta)
    return claim(`${head} que afecta a ${places(names.length)} de nuestro mapa: ${listNames(names)}.`, meta)
  }
  const some = names.length === 1 ? `${names[0]} es uno de ellos` : `${listNames(names)} son algunos de ellos`
  return claim(`${head} que afecta a ${places(fact.affectedLocationCount)} de nuestro mapa; ${some}.`, meta)
}

/**
 * Quién es y en cuántos sitios está. La lista se declara muestra **en la
 * propia frase** cuando lo es: "desde La Rioja hasta Huesca" nació de mandar
 * `algunosLugares` como si fuera la lista entera.
 *
 * El nombre va resuelto por `displayPokemonName`, con la aclaración entre
 * paréntesis de las cuatro Castform.
 */
function spotlightClaims(fact: PokemonSpotlightFact): ClaimSet {
  const name = displayPokemonName(fact.pokemonId, fact.label)
  const names = fact.locations.map((place) => place.locationName)
  // El nombre a secas también queda autorizado: el claim dice "Castform
  // (Niebla)" y quien redacte puede repetir solo "Castform" sin estar
  // nombrando a nadie nuevo.
  const meta = { places: names, pokemon: [name, POKEMON_NAMES[fact.pokemonId]] }

  if (names.length === 0) {
    return claim(`${name} aparece en ${places(fact.locationCount)} del mapa.`, meta)
  }
  if (fact.locationCount === names.length) {
    if (names.length === 1) return claim(`${name} aparece en 1 lugar del mapa: ${names[0]}.`, meta)
    return claim(`${name} aparece en ${places(names.length)} del mapa: ${listNames(names)}.`, meta)
  }
  const some = names.length === 1 ? `${names[0]} es uno de ellos` : `${listNames(names)} son algunos ejemplos`
  return claim(`${name} aparece en ${places(fact.locationCount)} del mapa. ${some}.`, meta)
}

/**
 * La forma del día, pero elegida por nosotros. `DayShapeFact` sigue trayendo
 * sus cuatro recuentos —no se toca el hecho—; lo que cambia es que a Oak solo
 * le llega el que sitúa la jornada.
 *
 * `distinctPokemonCount` no se verbaliza nunca: "aparecen 8 Pokémon en 74
 * sitios" es cierto y no dice nada. Y el total solo entra como referencia del
 * recuento que sí importa, nunca como tercer número: dos cifras son una
 * observación, cuatro son una tabla.
 */
function dayShapeClaims(fact: DayShapeFact): ClaimSet {
  const { alertedLocations: alerted, rainingLocations: raining } = fact
  const total = places(fact.totalLocations)

  if (alerted > 0 && raining > 0) {
    return claim(`Hoy hay ${places(alerted)} del mapa bajo algún aviso y ${whole(raining)} con lluvia.`)
  }
  if (alerted > 0) {
    return claim(`Hoy, ${alerted} de ${total} del mapa ${alerted === 1 ? 'está' : 'están'} bajo algún aviso.`)
  }
  if (raining > 0) {
    return claim(`Hoy, ${raining} de ${total} del mapa ${raining === 1 ? 'tiene' : 'tienen'} lluvia.`)
  }
  return claim(`Hoy no hay lluvia ni avisos en ninguno de ${total} del mapa.`)
}

/**
 * Día de la semana y nada más. La fecha no se verbaliza: Oak no la dice y
 * mandarla solo aportaría dígitos que no puede usar.
 */
function calendarClaims(fact: CalendarFact): ClaimSet {
  const weekday = WEEKDAY_TEXT[fact.weekday]
  return claim(fact.weekend ? `Hoy es ${weekday}, fin de semana.` : `Hoy es ${weekday}.`)
}

function claimsFor(fact: NarrativeFact): ClaimSet {
  switch (fact.kind) {
    case 'temperature':
      return temperatureClaims(fact)
    case 'rain':
      return rainClaims(fact)
    case 'snow':
      return snowClaims(fact)
    case 'wind':
      return windClaims(fact)
    case 'storm':
      return stormClaims(fact)
    case 'fog':
      return fogClaims(fact)
    case 'calima':
      return calimaClaims(fact)
    case 'marine':
      return marineClaims(fact)
    case 'alert':
      return alertClaims(fact)
    case 'pokemon_spotlight':
      return spotlightClaims(fact)
    case 'day_shape':
      return dayShapeClaims(fact)
    case 'calendar':
      return calendarClaims(fact)
  }
}

// ---------------------------------------------------------------------------
// Vocabulario autorizado
// ---------------------------------------------------------------------------

/**
 * Una cifra escrita en dígitos, con coma o punto decimal. La misma función
 * lee los claims y la respuesta de la IA: si fueran dos, podrían discrepar y
 * la guarda rechazaría paráfrasis correctas.
 */
const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g

export function extractNumbers(text: string): number[] {
  return [...text.matchAll(NUMBER_PATTERN)].map((match) => Number(match[0].replace(',', '.')))
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function toDialogueClaims(slot: DialogueSlot): DialogueClaims {
  const sets = slot.facts.map(claimsFor)
  const claims = sets.flatMap((set) => set.claims)

  return {
    id: slot.id,
    role: slot.role,
    tone: slot.tone,
    leitmotif: slot.leitmotif,
    claims,
    allowed: {
      numbers: [...new Set(claims.flatMap(extractNumbers))],
      places: unique(sets.flatMap((set) => set.places)),
      pokemon: unique(sets.flatMap((set) => set.pokemon)),
      alertLevels: [...new Set(sets.flatMap((set) => set.alertLevels))],
    },
  }
}

/**
 * El encargo del día: los mismos tres huecos del `DialoguePlan`, con sus
 * hechos ya convertidos en afirmaciones. No decide nada — ni protagonista,
 * ni modo, ni gag, ni qué hecho va en qué hueco: todo eso venía decidido en
 * el `DayPlan`.
 */
export function buildDayClaims(dayPlan: DayPlan): DayClaims {
  return {
    dayMode: dayPlan.dayMode,
    dialogues: dayPlan.dialoguePlan.map(toDialogueClaims) as [DialogueClaims, DialogueClaims, DialogueClaims],
  }
}

/** Los nombres de Pokémon que existen para nosotros: fuera de esta lista, nadie. */
export const KNOWN_POKEMON_NAMES: readonly string[] = unique(Object.values(POKEMON_NAMES))
