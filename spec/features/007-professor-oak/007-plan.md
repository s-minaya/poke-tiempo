# 007 · Profesor Oak — Plan

## Enfoque

Toda decisión de contenido (qué Pokémon, qué fenómeno, si hay alerta, qué modo narrativo toca hoy) es determinista y vive en `src/domain/oak/` — sin red, sin IA, testeable en aislamiento. La IA (Groq, capa gratuita) solo redacta la prosa final a partir de una decisión ya cerrada; nunca decide contenido. Si la IA falla, una capa de plantillas locales (igual de determinista) genera los 3 diálogos igualmente — Poketiempo nunca se queda sin diálogos de Oak, igual que nunca se queda sin mapa.

## Arquitectura de capas (importante, no se difumina)

```
002 (datos) → detecta y normaliza señales crudas (DANA si se puede, avisos si existen,
              oleaje, precipitación, franjas...). Oak lee estas señales directamente
              cuando las necesita (p. ej. para `alerta`), no a través de la 003.
003 (asignación) → transforma condiciones ya disponibles en Pokémon. No detecta nada.
Oak (007) → lee el Pokémon/los Pokémon que decidió la 003 + las señales crudas de la
              002 que necesite, y decide cómo narrarlo. No reasigna ni reinterpreta
              lo que ya decidió la 003.
```

## Implementación

1. `src/domain/oak/types.ts` — tipos del dominio de Oak (`DayMode`, `Tone`, `Flavour`, `DialogueSlot`, `DayReport`, `OakHistoryEntry`, `OakToday`). **No declara ningún tipo para lo que devuelve la 003** — cuando esta feature se implemente de verdad, importará el tipo público que exporte `src/domain/` de la 003 en ese momento. Mientras la 003 no exista, esto se documenta como dependencia abierta, sin placeholder de tipo.
2. `src/domain/oak/day-mode.ts` — tabla de elegibilidad por modo (ver más abajo) y selección con semilla determinista por fecha.
3. `src/domain/oak/priority.ts` — protagonistas del día a partir de lo que devuelva la 003, con el criterio de prioridad `alerta > legendario de intensidad máxima > legendario base > fenómeno de scope amplio > resto` (el propio ranking de intensidad depende del contrato final de la 003).
4. `src/domain/oak/leitmotifs.ts` — catálogo editable de gags recurrentes (`{ id, pokemon, region, phenomenon, cooldownDays }`), candidatos solo si el dato del día los justifica.
5. `src/domain/oak/history.ts` — lectura/actualización de `src/data/oak-history.json` (últimos 7 días), y cálculo de cooldowns.
6. `src/domain/oak/plan-dialogues.ts` — construye los 3 `DialogueSlot` repartiendo los hechos del día sin solapar.
7. `src/domain/oak/fallback-templates.ts` — genera los 3 textos sin IA a partir del mismo `dialoguePlan`. Es pura (sin red), por eso vive en `domain/`, no en `scripts/`.
8. `scripts/oak/build-day-report.ts` — **solo I/O**: lee `forecast.json` (002) y la salida de la 003 del filesystem, arma el `DayReport` llamando a las funciones puras de `domain/oak/`.
9. `scripts/oak/generate.ts` — **solo I/O**: llama a Groq con el `DayReport`, valida la respuesta contra el schema de salida, decide si usa la redacción de IA o el fallback, y escribe `src/data/oak-today.json`.
10. `src/components/ProfessorOak/` — consumo del JSON en build-time, sin lógica narrativa propia. Se diseña cuando se implemente, no aquí.

## Modelo de datos

```ts
interface DialogueSlot {
  role: 'apertura' | 'foco' | 'cierre'
  mode: DayMode
  tone: Tone
  flavour: Flavour | null
  facts: unknown[]              // hechos concretos que cubre este diálogo — forma exacta depende del contrato de la 003
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
  protagonists: string[]          // nombres de Pokémon
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
| `alerta` | Señal fiable de avisos/riesgo en la 002 (no existe hoy) — el umbral exacto de qué activa `alerta` es una decisión de producto **posterior** a que exista el dato, no se fija aquí |
| `relevo` | Franjas mañana/tarde en la 002 (no existe hoy) |
| `migracion` | Información temporal/espacial suficiente (no existe hoy) |

Cuando la 002 incorpore cada dato, se cambia `enabled: true` en un único sitio — el resto del motor no cambia.

## Decisiones

- **Groq como proveedor de IA** — capa gratuita real (sin tarjeta, ~14.400 peticiones/día, muy por encima de 1/día), soporta salida JSON estructurada. Detrás de una interfaz pequeña para poder cambiarlo sin tocar el resto del sistema.
- **`src/data/oak-today.json`**, no `public/` — mismo patrón que `forecast.json`: JSON estático empaquetado por Vite, no servido suelto.
- **Historial de 7 días**, solo IDs/categorías — sin frases completas, sin base de datos, versionado en git como el propio `forecast.json`.

## Riesgos

- **Acoplarse antes de tiempo al contrato de la 003** — mitigado no declarando ningún tipo propio para su salida; se importa literalmente lo que exporte cuando exista.
- **Que `SkyCondition` (decisión de la 002) colapse información que Oak necesita** — señalado como decisión pendiente en `roadmap.md`, no asumido resuelto aquí.
- **Coste de IA** — mitigado eligiendo un proveedor con capa gratuita real en vez de una de pago con límite bajo.
