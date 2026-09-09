import type { SourceId } from '../../src/domain/types.ts'

/**
 * Configuración manual de los 74 lugares del mapa. Única fuente de verdad
 * humana: todo lo que aquí aparece es una decisión de producto/geografía, no
 * un dato consultable en un catálogo — se edita a mano cuando haga falta
 * (añadir un lugar, corregir un huso horario).
 *
 * `npm run build:locations` cruza este archivo contra el maestro de
 * municipios de AEMET y el catálogo de api.ipma.pt para resolver
 * `sourceIds` automáticamente y escribe `src/data/locations.ts` — ese
 * archivo generado no se edita nunca a mano.
 *
 * `alertZoneIds` sale del catálogo real de zonas de aviso: para AEMET, del
 * PDF oficial "Detalle de municipios por zonas meteorológicas"
 * (aemet.es/documentos/.../detalle_municipios_zonas_meteorologicas.pdf),
 * cruzado por código INE; para IPMA, de `idAreaAviso` en
 * `api.ipma.pt/open-data/distrits-islands.json`. Un lugar costero lleva dos
 * zonas AEMET: la terrestre y su compañera marítima, que siempre es el mismo
 * código con sufijo "C" (confirmado contra `avisos_cap` real — nunca un
 * sistema de numeración distinto).
 */
export interface LocationManualConfig {
  id: string
  name: string
  country: 'ES' | 'PT' | 'AD'
  latitude: number
  longitude: number
  timezone: string
  primarySource: SourceId
  coastal: boolean
  marineCoordinates?: { latitude: number; longitude: number }
  alertZoneIds?: Partial<Record<'aemet' | 'ipma', string[]>>
  /**
   * Nombre oficial que usa la fuente principal (nombre de municipio en el
   * maestro de AEMET, o `local` en el catálogo de IPMA) para resolver
   * `sourceIds`, solo cuando difiere del `name` mostrado al usuario —
   * p. ej. mostramos "Ibiza" pero AEMET solo reconoce "Eivissa". Es un
   * detalle de resolución que usa exclusivamente `build-locations.ts`; no
   * llega a `Location` ni a ningún dato de dominio.
   */
  sourceLookupName?: string
}

export const locationsManualConfig: LocationManualConfig[] = [
  // --- España — AEMET (65) --------------------------------------------
  // Galicia
  {
    id: 'a-coruna',
    name: 'A Coruña',
    country: 'ES',
    latitude: 43.3701,
    longitude: -8.3911,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 43.39, longitude: -8.45 },
    alertZoneIds: { aemet: ['711501', '711501C'] }, // Noroeste de A Coruña
    sourceLookupName: 'Coruña, A',
  },
  {
    id: 'lugo',
    name: 'Lugo',
    country: 'ES',
    latitude: 43.0091,
    longitude: -7.5582,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['712702'] }, // Centro de Lugo
  },
  {
    id: 'ourense',
    name: 'Ourense',
    country: 'ES',
    latitude: 42.3365,
    longitude: -7.8637,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['713202'] }, // Miño de Ourense
  },
  {
    id: 'pontevedra',
    name: 'Pontevedra',
    country: 'ES',
    latitude: 42.4338,
    longitude: -8.6480,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 42.39, longitude: -8.85 },
    alertZoneIds: { aemet: ['713601', '713601C'] }, // Rías Baixas
  },

  // Asturias
  {
    id: 'oviedo',
    name: 'Oviedo',
    country: 'ES',
    latitude: 43.3623,
    longitude: -5.8437,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['633304'] }, // Central y Valles mineros
  },
  {
    id: 'gijon',
    name: 'Gijón',
    country: 'ES',
    latitude: 43.5392,
    longitude: -5.6595,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 43.58, longitude: -5.66 },
    alertZoneIds: { aemet: ['633302', '633302C'] }, // Litoral oriental asturiano
  },

  // Regiones representadas por un único punto
  {
    id: 'cantabria',
    name: 'Cantabria',
    country: 'ES',
    latitude: 43.4630,
    longitude: -3.8047,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 43.49, longitude: -3.79 },
    alertZoneIds: { aemet: ['663901', '663901C'] }, // Litoral cántabro
    sourceLookupName: 'Santander',
  },
  {
    id: 'la-rioja',
    name: 'La Rioja',
    country: 'ES',
    latitude: 42.4664,
    longitude: -2.4457,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['762601'] }, // Ribera del Ebro de La Rioja
    sourceLookupName: 'Logroño',
  },
  {
    // Un único punto para Álava/Guipúzcoa/Vizcaya. Bilbao como proxy
    // terrestre (más poblada, portuaria) — decisión explícita del
    // propietario del proyecto, con marineCoordinates hacia la costa
    // real de Vizcaya (no hacia el propio punto de Bilbao). El municipio de
    // Bilbao cae en la zona de aviso "Bizkaia interior" (754802) — sin
    // compañera "C" — así que se añade también "Bizkaia litoral" (754801)
    // y su compañera marítima, para no perder los avisos costeros que sí
    // representa `marineCoordinates`.
    id: 'pais-vasco',
    name: 'País Vasco',
    country: 'ES',
    latitude: 43.2572,
    longitude: -2.9239,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 43.38, longitude: -3.03 },
    alertZoneIds: { aemet: ['754802', '754801', '754801C'] },
    sourceLookupName: 'Bilbao',
  },
  {
    id: 'navarra',
    name: 'Navarra',
    country: 'ES',
    latitude: 42.8141,
    longitude: -1.6452,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['743102'] }, // Centro de Navarra
    sourceLookupName: 'Pamplona/Iruña',
  },

  // Aragón — Huesca
  {
    id: 'huesca',
    name: 'Huesca',
    country: 'ES',
    latitude: 42.1406,
    longitude: -0.4084,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['622202'] }, // Centro de Huesca
  },
  {
    id: 'jaca',
    name: 'Jaca',
    country: 'ES',
    latitude: 42.5707,
    longitude: -0.5496,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['622201'] }, // Pirineo oscense
  },
  {
    id: 'benasque',
    name: 'Benasque',
    country: 'ES',
    latitude: 42.6050,
    longitude: 0.5238,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['622201'] }, // Pirineo oscense (misma zona que Jaca)
  },

  // Aragón — Teruel
  {
    id: 'teruel',
    name: 'Teruel',
    country: 'ES',
    latitude: 40.3441,
    longitude: -1.1093,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['624401'] }, // Albarracín y Jiloca
  },
  {
    id: 'alcaniz',
    name: 'Alcañiz',
    country: 'ES',
    latitude: 41.0513,
    longitude: -0.1328,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['624403'] }, // Bajo Aragón de Teruel
  },

  // Aragón — Zaragoza
  {
    id: 'zaragoza',
    name: 'Zaragoza',
    country: 'ES',
    latitude: 41.6565,
    longitude: -0.8793,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['625003'] }, // Ribera del Ebro de Zaragoza
  },

  // Cataluña
  {
    id: 'barcelona',
    name: 'Barcelona',
    country: 'ES',
    latitude: 41.3842,
    longitude: 2.1763,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 41.36, longitude: 2.22 },
    alertZoneIds: { aemet: ['690804', '690804C'] }, // Litoral de Barcelona
  },
  {
    id: 'lleida',
    name: 'Lleida',
    country: 'ES',
    latitude: 41.6153,
    longitude: 0.6206,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['692503'] }, // Depresión central de Lleida
  },
  {
    // Capital de provincia con Costa Brava, pero el punto en sí (centro de
    // Girona) está a ~30km del litoral: no coastal, mismo criterio que
    // Murcia/Sevilla/Granada/Leiria.
    id: 'girona',
    name: 'Girona',
    country: 'ES',
    latitude: 41.9819,
    longitude: 2.8241,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['691702'] }, // Prelitoral de Girona
  },
  {
    id: 'tarragona',
    name: 'Tarragona',
    country: 'ES',
    latitude: 41.1191,
    longitude: 1.2584,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 41.09, longitude: 1.28 },
    alertZoneIds: { aemet: ['694303', '694303C'] }, // Litoral norte de Tarragona
  },

  // Comunidad Valenciana
  {
    id: 'castellon',
    name: 'Castellón',
    country: 'ES',
    latitude: 39.9864,
    longitude: -0.0369,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 39.97, longitude: 0.05 },
    alertZoneIds: { aemet: ['771204', '771204C'] }, // Litoral sur de Castellón
    sourceLookupName: 'Castelló de la Plana',
  },
  {
    id: 'valencia',
    name: 'Valencia',
    country: 'ES',
    latitude: 39.4753,
    longitude: -0.3757,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 39.45, longitude: -0.30 },
    alertZoneIds: { aemet: ['774602', '774602C'] }, // Litoral norte de Valencia
  },
  {
    id: 'alicante',
    name: 'Alicante',
    country: 'ES',
    latitude: 38.3455,
    longitude: -0.4832,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 38.33, longitude: -0.45 },
    alertZoneIds: { aemet: ['770303', '770303C'] }, // Litoral sur de Alicante
    sourceLookupName: 'Alicante/Alacant',
  },

  // Murcia
  {
    // Ciudad de interior (~30km del litoral): no coastal, mismo criterio
    // que Girona/Sevilla/Granada/Leiria.
    id: 'murcia',
    name: 'Murcia',
    country: 'ES',
    latitude: 37.9844,
    longitude: -1.1285,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['733003'] }, // Vega del Segura
  },

  // Castilla y León
  {
    id: 'leon',
    name: 'León',
    country: 'ES',
    latitude: 42.5991,
    longitude: -5.5671,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['672403'] }, // Meseta de León
  },
  {
    id: 'palencia',
    name: 'Palencia',
    country: 'ES',
    latitude: 42.0078,
    longitude: -4.5346,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['673402'] }, // Meseta de Palencia
  },
  {
    id: 'burgos',
    name: 'Burgos',
    country: 'ES',
    latitude: 42.3411,
    longitude: -3.7042,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['670904'] }, // Meseta de Burgos
  },
  {
    id: 'zamora',
    name: 'Zamora',
    country: 'ES',
    latitude: 41.4991,
    longitude: -5.7549,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['674902'] }, // Meseta de Zamora
  },
  {
    id: 'salamanca',
    name: 'Salamanca',
    country: 'ES',
    latitude: 40.9674,
    longitude: -5.6654,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['673701'] }, // Meseta de Salamanca
  },
  {
    id: 'avila',
    name: 'Ávila',
    country: 'ES',
    latitude: 40.6559,
    longitude: -4.6977,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['670502'] }, // Sistema Central de Ávila
  },
  {
    id: 'segovia',
    name: 'Segovia',
    country: 'ES',
    latitude: 40.9499,
    longitude: -4.1252,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['674002'] }, // Sistema Central de Segovia
  },
  {
    id: 'soria',
    name: 'Soria',
    country: 'ES',
    latitude: 41.7633,
    longitude: -2.4662,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['674201'] }, // Ibérica de Soria
  },
  {
    id: 'valladolid',
    name: 'Valladolid',
    country: 'ES',
    latitude: 41.6523,
    longitude: -4.7233,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['674701'] }, // Meseta de Valladolid
  },

  // Castilla-La Mancha
  {
    id: 'guadalajara',
    name: 'Guadalajara',
    country: 'ES',
    latitude: 40.6344,
    longitude: -3.1621,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['681903'] }, // Alcarria de Guadalajara
  },
  {
    id: 'cuenca',
    name: 'Cuenca',
    country: 'ES',
    latitude: 40.0765,
    longitude: -2.1315,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['681602'] }, // Serranía de Cuenca
  },
  {
    id: 'tarancon',
    name: 'Tarancón',
    country: 'ES',
    latitude: 40.0110,
    longitude: -3.0030,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['681603'] }, // La Mancha conquense
  },
  {
    id: 'albacete',
    name: 'Albacete',
    country: 'ES',
    latitude: 38.9959,
    longitude: -1.8557,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['680201'] }, // La Mancha albaceteña
  },
  {
    id: 'toledo',
    name: 'Toledo',
    country: 'ES',
    latitude: 39.8572,
    longitude: -4.0243,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['684502'] }, // Valle del Tajo
  },
  {
    id: 'ciudad-real',
    name: 'Ciudad Real',
    country: 'ES',
    latitude: 38.9865,
    longitude: -3.9313,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['681303'] }, // Valle del Guadiana
  },
  {
    id: 'manzanares',
    name: 'Manzanares',
    country: 'ES',
    latitude: 38.9982,
    longitude: -3.3702,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['681302'] }, // La Mancha de Ciudad Real
  },

  // Madrid
  {
    id: 'madrid',
    name: 'Madrid',
    country: 'ES',
    latitude: 40.4084,
    longitude: -3.6876,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['722802'] }, // Metropolitana y Henares
  },

  // Extremadura
  {
    id: 'caceres',
    name: 'Cáceres',
    country: 'ES',
    latitude: 39.4732,
    longitude: -6.3712,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['701003'] }, // Meseta cacereña
  },
  {
    id: 'plasencia',
    name: 'Plasencia',
    country: 'ES',
    latitude: 40.0294,
    longitude: -6.0927,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['701002'] }, // Tajo y Alagón
  },
  {
    id: 'badajoz',
    name: 'Badajoz',
    country: 'ES',
    latitude: 38.8787,
    longitude: -6.9710,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['700601'] }, // Vegas Del Guadiana
  },
  {
    id: 'merida',
    name: 'Mérida',
    country: 'ES',
    latitude: 38.9174,
    longitude: -6.3442,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['700601'] }, // Vegas Del Guadiana (misma zona que Badajoz)
  },

  // Andalucía
  {
    id: 'huelva',
    name: 'Huelva',
    country: 'ES',
    latitude: 37.2600,
    longitude: -6.9504,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 37.13, longitude: -6.95 },
    alertZoneIds: { aemet: ['612103', '612103C'] }, // Litoral de Huelva
  },
  {
    // Ciudad fluvial a ~90km de la costa atlántica por el estuario del
    // Guadalquivir: no coastal, mismo criterio que Girona/Murcia/Granada/Leiria.
    id: 'sevilla',
    name: 'Sevilla',
    country: 'ES',
    latitude: 37.3862,
    longitude: -5.9925,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['614102'] }, // Campiña sevillana
  },
  {
    id: 'cadiz',
    name: 'Cádiz',
    country: 'ES',
    latitude: 36.5217,
    longitude: -6.2841,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 36.50, longitude: -6.35 },
    alertZoneIds: { aemet: ['611103', '611103C'] }, // Litoral gaditano
  },
  {
    id: 'cordoba',
    name: 'Córdoba',
    country: 'ES',
    latitude: 37.8795,
    longitude: -4.7803,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['611402'] }, // Campiña cordobesa
  },
  {
    id: 'jaen',
    name: 'Jaén',
    country: 'ES',
    latitude: 37.7652,
    longitude: -3.7904,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['612303'] }, // Valle de Guadalquivir de Jaén
  },
  {
    id: 'huescar',
    name: 'Huéscar',
    country: 'ES',
    latitude: 37.8098,
    longitude: -2.5401,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['611802'] }, // Guadix y Baza
  },
  {
    id: 'malaga',
    name: 'Málaga',
    country: 'ES',
    latitude: 36.7203,
    longitude: -4.4200,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 36.68, longitude: -4.42 },
    alertZoneIds: { aemet: ['612903', '612903C'] }, // Sol y Guadalhorce
  },
  {
    // A ~50km de la Costa Tropical, ciudad de interior/montaña: no coastal,
    // mismo criterio que Girona/Murcia/Sevilla/Leiria.
    id: 'granada',
    name: 'Granada',
    country: 'ES',
    latitude: 37.1764,
    longitude: -3.6000,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: false,
    alertZoneIds: { aemet: ['611801'] }, // Cuenca del Genil
  },
  {
    id: 'almeria',
    name: 'Almería',
    country: 'ES',
    latitude: 36.8389,
    longitude: -2.4641,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 36.78, longitude: -2.45 },
    alertZoneIds: { aemet: ['610403', '610403C'] }, // Poniente y Almería Capital
  },

  // Ceuta y Melilla
  {
    id: 'ceuta',
    name: 'Ceuta',
    country: 'ES',
    latitude: 35.8881,
    longitude: -5.3068,
    timezone: 'Africa/Ceuta',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 35.92, longitude: -5.32 },
    alertZoneIds: { aemet: ['785101', '785101C'] },
  },
  {
    id: 'melilla',
    name: 'Melilla',
    country: 'ES',
    latitude: 35.2907,
    longitude: -2.9472,
    timezone: 'Africa/Ceuta', // IANA cubre Ceuta y Melilla bajo la misma zona
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 35.28, longitude: -2.93 },
    alertZoneIds: { aemet: ['795201', '795201C'] },
  },

  // Baleares
  {
    id: 'ibiza',
    name: 'Ibiza',
    country: 'ES',
    latitude: 38.9067,
    longitude: 1.4362,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 38.88, longitude: 1.45 },
    alertZoneIds: { aemet: ['645301', '645301C'] }, // Ibiza y Formentera
    sourceLookupName: 'Eivissa',
  },
  {
    id: 'mallorca',
    name: 'Mallorca',
    country: 'ES',
    latitude: 39.5711,
    longitude: 2.6518,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 39.52, longitude: 2.62 },
    alertZoneIds: { aemet: ['645404', '645404C'] }, // Sur de Mallorca
    sourceLookupName: 'Palma de Mallorca',
  },
  {
    id: 'menorca',
    name: 'Menorca',
    country: 'ES',
    latitude: 39.8875,
    longitude: 4.2655,
    timezone: 'Europe/Madrid',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 39.87, longitude: 4.30 },
    alertZoneIds: { aemet: ['645501', '645501C'] }, // Menorca
    sourceLookupName: 'Maó-Mahón',
  },

  // Canarias
  {
    id: 'la-palma',
    name: 'La Palma',
    country: 'ES',
    latitude: 28.6819,
    longitude: -17.7631,
    timezone: 'Atlantic/Canary',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 28.68, longitude: -17.75 },
    alertZoneIds: { aemet: ['659303', '659303C'] }, // Este de La Palma
    sourceLookupName: 'Santa Cruz de la Palma',
  },
  {
    id: 'la-gomera',
    name: 'La Gomera',
    country: 'ES',
    latitude: 28.0899,
    longitude: -17.1093,
    timezone: 'Atlantic/Canary',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 28.08, longitude: -17.10 },
    alertZoneIds: { aemet: ['659401', '659401C'] }, // La Gomera
    sourceLookupName: 'San Sebastián de la Gomera',
  },
  {
    id: 'tenerife',
    name: 'Tenerife',
    country: 'ES',
    latitude: 28.4629,
    longitude: -16.2472,
    timezone: 'Atlantic/Canary',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 28.45, longitude: -16.22 },
    alertZoneIds: { aemet: ['659602', '659602C'] }, // Área metropolitana de Tenerife
    sourceLookupName: 'Santa Cruz de Tenerife',
  },
  {
    id: 'gran-canaria',
    name: 'Gran Canaria',
    country: 'ES',
    latitude: 28.0994,
    longitude: -15.4134,
    timezone: 'Atlantic/Canary',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 28.10, longitude: -15.40 },
    alertZoneIds: { aemet: ['659001', '659001C'] }, // Norte de Gran Canaria
    sourceLookupName: 'Palmas de Gran Canaria, Las',
  },
  {
    id: 'fuerteventura',
    name: 'Fuerteventura',
    country: 'ES',
    latitude: 28.4976,
    longitude: -13.8592,
    timezone: 'Atlantic/Canary',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 28.48, longitude: -13.85 },
    alertZoneIds: { aemet: ['659201', '659201C'] }, // Fuerteventura
    sourceLookupName: 'Puerto del Rosario',
  },
  {
    id: 'lanzarote',
    name: 'Lanzarote',
    country: 'ES',
    latitude: 28.9602,
    longitude: -13.5515,
    timezone: 'Atlantic/Canary',
    primarySource: 'aemet',
    coastal: true,
    marineCoordinates: { latitude: 28.95, longitude: -13.50 },
    alertZoneIds: { aemet: ['659101', '659101C'] }, // Lanzarote
    sourceLookupName: 'Arrecife',
  },

  // --- Portugal — IPMA (8) ----------------------------------------------
  {
    id: 'porto',
    name: 'Porto',
    country: 'PT',
    latitude: 41.1580,
    longitude: -8.6294,
    timezone: 'Europe/Lisbon',
    primarySource: 'ipma',
    coastal: true,
    marineCoordinates: { latitude: 41.14, longitude: -8.70 },
    alertZoneIds: { ipma: ['PTO'] },
  },
  {
    id: 'vila-real',
    name: 'Vila Real',
    country: 'PT',
    latitude: 41.3053,
    longitude: -7.7440,
    timezone: 'Europe/Lisbon',
    primarySource: 'ipma',
    coastal: false,
    alertZoneIds: { ipma: ['VRL'] },
  },
  {
    // Capital de distrito a ~20-25km del Atlántico: no coastal, mismo
    // criterio que Girona/Murcia/Sevilla/Granada.
    id: 'leiria',
    name: 'Leiria',
    country: 'PT',
    latitude: 39.7473,
    longitude: -8.8069,
    timezone: 'Europe/Lisbon',
    primarySource: 'ipma',
    coastal: false,
    alertZoneIds: { ipma: ['LRA'] },
  },
  {
    id: 'guarda',
    name: 'Guarda',
    country: 'PT',
    latitude: 40.5379,
    longitude: -7.2647,
    timezone: 'Europe/Lisbon',
    primarySource: 'ipma',
    coastal: false,
    alertZoneIds: { ipma: ['GDA'] },
  },
  {
    id: 'lisboa',
    name: 'Lisboa',
    country: 'PT',
    latitude: 38.7660,
    longitude: -9.1286,
    timezone: 'Europe/Lisbon',
    primarySource: 'ipma',
    coastal: true,
    marineCoordinates: { latitude: 38.66, longitude: -9.35 },
    alertZoneIds: { ipma: ['LSB'] },
  },
  {
    id: 'evora',
    name: 'Évora',
    country: 'PT',
    latitude: 38.5701,
    longitude: -7.9104,
    timezone: 'Europe/Lisbon',
    primarySource: 'ipma',
    coastal: false,
    alertZoneIds: { ipma: ['EVR'] },
  },
  {
    id: 'beja',
    name: 'Beja',
    country: 'PT',
    latitude: 38.0200,
    longitude: -7.8700,
    timezone: 'Europe/Lisbon',
    primarySource: 'ipma',
    coastal: false,
    alertZoneIds: { ipma: ['BJA'] },
  },
  {
    id: 'faro',
    name: 'Faro',
    country: 'PT',
    latitude: 37.0146,
    longitude: -7.9331,
    timezone: 'Europe/Lisbon',
    primarySource: 'ipma',
    coastal: true,
    marineCoordinates: { latitude: 36.95, longitude: -7.87 },
    alertZoneIds: { ipma: ['FAR'] },
  },

  // --- Andorra — Open-Meteo (1) ------------------------------------------
  {
    // Sin alertZoneIds: Open-Meteo no tiene producto de avisos oficiales
    // (AlertsAvailability.status será 'unsupported', no un catálogo vacío).
    id: 'andorra-la-vella',
    name: 'Andorra la Vella',
    country: 'AD',
    latitude: 42.5063,
    longitude: 1.5218,
    timezone: 'Europe/Andorra',
    primarySource: 'open-meteo',
    coastal: false,
  },
]
