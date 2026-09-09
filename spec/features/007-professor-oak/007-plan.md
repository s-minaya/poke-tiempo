# 007 · Profesor Oak — Plan

## Enfoque

Toda decisión de contenido (qué Pokémon, qué fenómeno, si hay alerta, qué modo narrativo toca hoy) es determinista y vive en `src/domain/oak/` — sin red, sin IA, testeable en aislamiento. La IA (Groq, capa gratuita) solo redacta la prosa final a partir de una decisión ya cerrada; nunca decide contenido. Si la IA falla, una capa de plantillas locales (igual de determinista) genera los 3 diálogos igualmente — Poketiempo nunca se queda sin diálogos de Oak, igual que nunca se queda sin mapa.

## Arquitectura de capas (importante, no se difumina)

```
002 (datos) → detecta y normaliza señales crudas: temperatura, cielo, precipitación,
              nieve, viento, tormenta, calima, niebla, mar, avisos oficiales. Oak lee
              estas señales directamente cuando las necesita (p. ej. para `alerta`),
              no a través de la 003. El contrato de la 002 NO representa DANA — no es
              una responsabilidad actual de esta capa, solo una posible ampliación
              futura si aparece una fuente fiable (ver roadmap.md).
003 (asignación) → transforma condiciones ya disponibles en Pokémon. No detecta nada.
Oak (007) → lee el Pokémon/los Pokémon que decidió la 003 + las señales crudas de la
              002 que necesite, y decide cómo narrarlo. No reasigna ni reinterpreta
              lo que ya decidió la 003.
```

## Implementación

1. `src/domain/oak/types.ts` — tipos del dominio de Oak (`DayMode`, `Tone`, `Flavour`, `DialogueSlot`, `DayReport`, `OakHistoryEntry`, `OakToday`). **No declara ningún tipo para lo que devuelve la 003** — cuando esta feature se implemente de verdad, importará el tipo público que exporte `src/domain/` de la 003 en ese momento. Mientras la 003 no exista, esto se documenta como dependencia abierta, sin placeholder de tipo.
2. `src/domain/oak/day-mode.ts` — tabla de elegibilidad por modo (ver más abajo) y selección con semilla determinista por fecha.
3. `src/domain/oak/priority.ts` — protagonistas del día a partir de lo que devuelva la 003. **Sin ranking fijo todavía** — qué hace a un Pokémon "protagonista" depende de la metadata de prioridad/intensidad que 003 acabe exportando (si es que exporta alguna), no se inventa aquí un orden `legendario máximo > legendario base > ...` por adelantado. `alerta` **no participa en este ranking** — es un estado narrativo/de riesgo aparte, gestionado en `day-mode.ts`, sin relación con qué Pokémon protagoniza el día.
4. `src/domain/oak/leitmotifs.ts` — catálogo editable de gags recurrentes (`{ id, pokemonId, region, phenomenon, cooldownDays }` — `pokemonId` es el identificador estable de la 003, no el nombre de presentación), candidatos solo si el dato del día los justifica.
5. `src/domain/oak/history.ts` — **pura, sin I/O**: recibe el historial ya leído (`OakHistoryEntry[]`) como argumento y devuelve las decisiones/estado actualizado (cooldowns resueltos, nueva entrada a persistir). No lee ni escribe `src/data/oak-history.json` — eso es responsabilidad de `scripts/oak/`.
6. `src/domain/oak/plan-dialogues.ts` — construye los 3 `DialogueSlot` repartiendo los hechos del día sin solapar.
7. `src/domain/oak/fallback-templates.ts` — genera los 3 textos sin IA a partir del mismo `dialoguePlan`. Es pura (sin red), por eso vive en `domain/`, no en `scripts/`.
8. `scripts/oak/build-day-report.ts` — **solo I/O**: lee `forecast.json` (002) e invoca el motor de la 003 — como función pura importada, no como archivo en filesystem; no se asume que la 003 produzca ningún output propio en disco. Se adapta al contrato real de la 003 cuando exista. Arma el `DayReport` llamando a las funciones puras de `domain/oak/`.
9. `scripts/oak/generate.ts` — **solo I/O**: lee `src/data/oak-history.json`, llama a Groq con el `DayReport`, valida la respuesta contra el schema de salida, decide si usa la redacción de IA o el fallback, y escribe `src/data/oak-today.json` **y** el historial actualizado (usando las funciones puras de `domain/oak/history.ts` para calcular qué escribir).
10. `src/components/ProfessorOak/` — consumo del JSON en build-time, sin lógica narrativa propia. Se diseña cuando se implemente, no aquí.

## Modelo de datos

```ts
// INCOMPLETO A PROPÓSITO — no se declara aún el campo de hechos concretos que cada
// diálogo redacta. Sin él, `DialogueSlot` no está terminado: falta el payload que
// Groq va a redactar. No se tipa como `unknown` (sería un pseudo-contrato disfrazado)
// ni se omite en silencio — queda documentado como hueco explícito hasta que existan
// la 002 y la 003. Cuando ambas existan, se diseña un tipo propio de Oak, algo como
// `NarrativeFact[]` (Pokémon, lugar/fenómeno, valores y cualquier otro hecho
// autorizado para ese diálogo), derivado de sus contratos reales — no antes.
interface DialogueSlot {
  role: 'apertura' | 'foco' | 'cierre'
  mode: DayMode
  tone: Tone
  flavour: Flavour | null
  // ← aquí va el payload factual (`NarrativeFact[]` o el nombre que se decida)
  leitmotif: string | null
  continuityNote: string | null
}

interface DayReport {
  date: string
  dayMode: DayMode
  dialoguePlan: DialogueSlot[]   // siempre 3
}

interface OakHistoryEntry {      // solo IDs/categorías, nunca frases completas
  date: string
  dayMode: DayMode
  tone: Tone
  flavour: Flavour | null
  leitmotifIds: string[]
  protagonists: string[]          // IDs estables de Pokémon (los de la 003), nunca nombres de presentación
  openingStyle: string             // ID de categoría de arranque, no el texto literal
}

interface OakToday {
  date: string
  generatedAt: string
  source: 'ai' | 'fallback'
  dayMode: DayMode
  dialogues: { id: string; text: string }[]
}
```

**Contrato con la IA (Groq):** input = el `DayReport` completo (ya con todo decidido) + instrucción corta de estilo. Output esperado, validado antes de publicar:

```ts
interface OakGeneration {
  dialogues: [
    { id: 'dialogue-1'; text: string },
    { id: 'dialogue-2'; text: string },
    { id: 'dialogue-3'; text: string },
  ]
}
```
3 elementos exactos, `text` no vacío, longitud máxima acotada, sin campos inventados — cualquier fallo activa el fallback.

## Modos narrativos y su elegibilidad

```
parte, batalla, avistamiento, expedicion, laboratorio, pokedex, duelo,
invasion, calma, consejo, misterio, fin_de_semana, efemeride
```
— elegibles según los datos del día, sin dependencias externas pendientes.

**Deshabilitados hasta que exista su dato, con motivo explícito:**

| Modo | Depende de |
|---|---|
| `anomalia` | Histórico/climatología de referencia (no existe hoy) |
| `alerta` | El dato ya existe en el contrato de la 002 (`alerts: AlertsAvailability`) y el mapeo de los 74 lugares a zona oficial ya está implementado (002, Bloque 7); falta decidir qué nivel(es) lo activan (decisión de producto, ver `roadmap.md`) y resolver el requisito de cobertura más allá de los 74 proxies — ver nota debajo de esta tabla |
| `relevo` | Franjas mañana/tarde — capacidad contemplada en el dominio de la 002, sin forma de dato comprometida todavía (ningún consumidor real hasta ahora) |
| `migracion` | Información temporal/espacial suficiente (no existe hoy) |

Cuando cada dependencia se resuelva, se cambia `enabled: true` en un único sitio — el resto del motor no cambia.

**Cobertura de avisos más allá de los 74 proxies — pendiente de resolver cuando se implemente `alerta`, no ahora.** Cada uno de los 74 lugares usa un único punto/proxy representativo (Mallorca → Palma, Tenerife → Santa Cruz, Cantabria → Santander, País Vasco → Bilbao/Bizkaia...), y `LocationForecast.alerts` solo lleva los avisos de la(s) zona(s) oficial(es) de ese proxy concreto — nunca las de todo el territorio que el lugar representa visualmente en el mapa. Es una decisión deliberada de la 002 (cierre del Bloque 7): `Location.alertZoneIds` no se amplía a todas las zonas de una isla/CCAA precisamente para no mezclar el forecast de una ciudad con un aviso ocurrido en otra parte — el punto de Mallorca representa el tiempo de Palma, no el de toda la isla.

Eso es correcto para el forecast, pero es una limitación real para Oak: un aviso rojo en, por ejemplo, la Sierra de Tramuntana no aparecería en `alerts` de "Mallorca" si su zona oficial no es la de Palma. Oak no debe limitar sus comentarios sobre avisos a `LocationForecast.alerts` — durante su generación diaria necesita poder consultar el **conjunto completo de avisos oficiales activos** (AEMET + IPMA, antes de filtrar por lugar) para poder destacar avisos relevantes — especialmente nivel rojo — aunque afecten a una zona que no coincide con el proxy de ninguno de los 74 lugares.

El propio pipeline de la 002 ya obtiene ese conjunto completo antes de recortarlo por lugar: `fetchAemetAreaAlerts` + `normalizeAemetAlert` (`scripts/sources/aemet-alerts.ts`) y `fetchIpmaWarnings` + `normalizeIpmaAlert` (`scripts/sources/ipma.ts`) dan todos los avisos activos de un área/país; el recorte a `Location.alertZoneIds` (`selectAlertsForZones`, `src/domain/alerts.ts`) es un paso aparte, posterior. Cómo le llega ese conjunto sin filtrar a Oak (si se persiste en algún sitio que su script de generación pueda leer, o si Oak vuelve a consultar las fuentes) es una decisión de diseño de **esta** feature, no de la 002 — se toma cuando se implemente, sin comprometer ahora ninguna forma de dato ni infraestructura nueva.

## Decisiones

- **Proveedor de IA — requisitos arquitectónicos, no una cifra de proveedor concreta** (los límites de cualquier free tier dependen del modelo y cambian sin aviso, no se fijan como propiedad del sistema):
  - proveedor/modelo configurable, detrás de una interfaz pequeña;
  - permanece exclusivamente en capa gratuita — nunca se habilita billing/upgrade;
  - una única generación diaria de los 3 diálogos (1 llamada, no 3);
  - cualquier `429`, indisponibilidad o cambio de cuota activa el fallback local automáticamente;
  - coste operativo de IA obligatorio: **0 €**.
  - Groq es el candidato de partida (sin tarjeta, con modo de salida JSON estructurada), pero el sistema no depende de sus cifras concretas de cuota.
- **`src/data/oak-today.json`**, no `public/` — mismo patrón que `forecast.json`: JSON estático empaquetado por Vite, no servido suelto.
- **Historial — retención mínima, no un número fijo.** Se retienen como mínimo los días que cubran el `cooldownDays` más largo configurado entre todos los leitmotifs (y el cooldown de modos/flavours, si es mayor) — no un "7 días" fijo que pueda quedarse corto el día que exista un leitmotiv con cooldown mayor. Solo IDs/categorías, nunca frases completas; sin base de datos, versionado en git como el propio `forecast.json`.

## Riesgos

- **Acoplarse antes de tiempo al contrato de la 003** — mitigado no declarando ningún tipo propio para su salida; se importa literalmente lo que exporte cuando exista.
- **Que `SkyCondition` colapse información que Oak necesita** — resuelto en el contrato cerrado de la 002 (`features/002-weather-data-pipeline/002-plan.md`): cada eje meteorológico es un campo independiente, `SkyCondition` describe solo nubosidad.
- **Coste de IA** — mitigado eligiendo un proveedor con capa gratuita real en vez de una de pago con límite bajo.
