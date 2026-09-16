# 003 · Motor de asignación de Pokémon — Plan

**Estado:** implementado ✅

## Enfoque

Un único módulo de dominio, sin dependencias externas ni abstracciones genéricas: por cada eje meteorológico de `LocationForecast` hay una función pura que evalúa su franja/condición y devuelve un `PokedexId` o `null`. `assignPokemon` las llama todas y descarta los `null`. Las franjas se escriben como comparaciones explícitas, no como una tabla genérica de umbrales parametrizada — con 9 ejes ya cerrados y cada uno con su propia combinación de operadores (`<=`, `<`, mezclados), una función `pickTier` reutilizable añadiría una capa de indirección sin ahorrar código real.

## Implementación

1. `src/domain/pokedex.ts` — `PokedexId`, unión de los identificadores de Pokémon/forma que el motor puede producir hoy. No incluye `'thundurus'`: la regla que lo usaría (tormenta + DANA) está deshabilitada.
2. `src/domain/assign-pokemon.ts` — una función `assignBy*` por eje (temperatura, cielo, lluvia, nieve, viento, calima, tormenta, niebla, oleaje) y `assignPokemon(forecast): PokedexId[]`, que las combina y descarta los `null`.
3. `src/domain/assign-pokemon.test.ts` — table-driven (`it.each`), con foco en los valores frontera de cada franja numérica y en que cada eje `null`/`false`/`0` no asigna nada.
4. Mover `spec/img/*.png` a `src/assets/sprites/` (nombres ya en kebab-case, uno por `PokedexId`; `thundurus.png` se mueve también aunque hoy ninguna regla lo use, para no perder el asset ya preparado).

## Reglas por eje

**Temperatura** (`temperature.maxC`, siempre presente — nunca `null`):

| Rango | Pokémon |
|---|---|
| ≤ 7 | Snorunt |
| (7, 14] | Solrock |
| (14, 25] | Castform (forma sol) — `castform-sun` |
| (25, 29] | Charmander |
| (29, 33] | Charmeleon |
| (33, 39] | Magmar |
| (39, 44] | Groudon |
| > 44 | Groudon primigenio — `groudon-primal` |

> La tabla original de `roadmap.md` dice "40-43° Groudon · más de 44° Groudon primigenio", dejando 44°C sin cubrir. Se cierra extendiendo Groudon hasta 44°C inclusive — el único cambio que hace la frontera continua sin contradecir "más de 44" para la forma primigenia.

**Nubes** (`sky`):

- `'despejado'` → Castform (forma sol) — `castform-sun`. Ampliado en la 005: además del tramo de temperatura 15–25°C (tabla de arriba), un cielo despejado también asigna esta forma, sea cual sea la temperatura — `assignPokemon` deduplica, así que un día despejado dentro de esa franja no la repite.
- `'poco_nuboso'` → Altaria
- `'nuboso'` o `'cubierto'` → Castform (forma normal) — `castform`
- `null` → ninguno

**Lluvia** (`precipitation.mm`, solo si `mm > 0`):

| Rango | Pokémon |
|---|---|
| (0, 10] | Castform (forma lluvia) — `castform-rain` |
| (10, 60] | Kyogre |
| > 60 | Kyogre primigenio — `kyogre-primal` |
| `mm <= 0` o `null` | ninguno |

**Nieve** (`snow.cm`, solo si `cm > 0`; nunca se deriva de `snow.present`):

| Rango | Pokémon |
|---|---|
| (0, 10] | Cryogonal |
| > 10 | Abomasnow |
| `cm <= 0` o `null` | ninguno |

**Viento** (`wind.speedKmh`, nunca `gustKmh`):

| Rango | Pokémon |
|---|---|
| < 20 | ninguno |
| [20, 40) | Hoppip |
| [40, 60) | Dragonite |
| [60, 90] | Rayquaza |
| > 90 | Tornadus |
| `null` | ninguno |

**Viento cálido** (`wind.speedKmh` + `temperature.maxC`, ampliado en la 005): `wind.speedKmh >= 40` **y** `temperature.maxC >= 30` → Moltres. Regla inferida combinando dos ejes ya existentes — ninguna fuente (AEMET/IPMA/Open-Meteo) da "viento cálido" como categoría propia. Eje independiente del viento simple de arriba: ambos pueden asignar a la vez (`assignByWind` y `assignByWarmWind` son funciones separadas).

**Calima** (`calima`): `true` → Hippowdon · `false`/`null` → ninguno.

**Tormenta** (`storm`): `true` → Zapdos · `false`/`null` → ninguno. DANA deshabilitada: nunca Thundurus.

**Niebla** (`fog`): `true` → Castform (forma hielo) — `castform-ice` · `false`/`null` → ninguno.

**Oleaje** (`marine`, `alerts`):

1. Si `alerts.status === 'ok'` y existe algún aviso con `level === 'rojo'` y `phenomenon === 'costero'` cuya ventana (`startsAt`/`endsAt`) solapa el día de `forecast.date` → Mega Gyarados (prioridad sobre la regla numérica, sea cual sea `waveHeightM`).
2. Si no, y `marine.status === 'ok'` y `marine.data.waveHeightM !== null` y `waveHeightM >= 2,5` → Mega Gyarados también por dato físico, sin necesitar aviso. Ampliado en la 005: antes Mega Gyarados dependía solo del aviso oficial.
3. Si no, y `waveHeightM >= 1,25` → Gyarados.
4. En cualquier otro caso → ninguno.

> Umbral de Gyarados, 1,25 m: coincide con el paso de "marejada" a "fuerte marejada" en la escala Douglas de estado de la mar (AEMET/Puertos del Estado). Con los datos reales del pipeline (28 lugares costeros, `forecast.json` del 2026-09-08) dispara en 8 de esos lugares. Umbral de Mega Gyarados por dato físico, 2,5 m: siguiente escalón de la misma escala Douglas ("muy fuerte marejada").

## Decisiones

- **Sin tabla genérica de umbrales parametrizada** — cada eje es una función explícita con sus propios operadores de comparación; una única función reutilizable habría tenido que aceptar el operador como parámetro para 9 casos que no se repiten entre sí.
- **`assignPokemon` devuelve `PokedexId[]`, no `PokedexEntry[]`** — nombre, etiqueta de leyenda y descripción son contenido de producto para la 005; esta feature no inventa copy.
- **Frontera de 44°C cerrada extendiendo Groudon** (ver tabla de temperatura) — cambio mínimo que hace continua la franja sin contradecir "más de 44" para Groudon primigenio.
- **Nieve exige `cm > 0`, igual que lluvia** — misma regla ("`null` nunca fabrica asignación", cero confirmado no dispara la forma") aplicada por coherencia entre los dos únicos ejes de acumulado.
- **Mega Gyarados no depende de `marine.status`, pero sí exige que el aviso esté activo el día del forecast** — el aviso oficial es la fuente de verdad para "muy fuerte" (`002-plan.md`: "la oficialidad se conserva ahí, no en el dato físico"), así que dispara aunque la consulta física de oleaje de ese día haya fallado; pero un aviso rojo costero que no cubre `forecast.date` no adelanta la forma. La comparación es por prefijo `YYYY-MM-DD` de texto (`startsAt`/`endsAt` contra `date`), no vía `Date`: IPMA entrega esos campos sin offset, y `new Date(...)` los interpretaría con la zona horaria del entorno de ejecución en vez de la del aviso.
- **Umbral de Gyarados: 1,25 m** — confirmado por el propietario del producto, ver tabla de oleaje arriba.
- **Ampliaciones de la 005** (`005-plan.md` → ampliación de alcance): `'despejado'` también asigna castform-sun (además del tramo de temperatura), y Mega Gyarados suma un segundo camino por dato físico (`waveHeightM >= 2,5`) junto al aviso oficial, que se mantiene. `assignPokemon` deduplica su salida — necesario desde que dos ejes distintos pueden coincidir en el mismo `PokedexId` (cielo + temperatura en castform-sun). `MAP_PRIORITY` (004) también se ajustó: castform-sun pasa al final de los tramos de temperatura para que la temperatura real de un lugar nunca quede tapada por el disparador de cielo. Además, nuevo eje "viento cálido" → Moltres (`wind.speedKmh >= 40` y `temperature.maxC >= 30`), 25º `PokedexId` — única regla inferida del proyecto además de la ya rechazada para DANA, aceptada aquí como decisión de producto explícita.
- **Calima también por aviso oficial, no solo por código de cielo** (`assignByCalima`, ampliación de la 005): además de `calima === true`, dispara si hay un `OfficialAlert` con `phenomenon === 'calima'` activo el día del forecast — cualquier nivel (amarillo/naranja/rojo) basta, a diferencia del aviso costero de Mega Gyarados, que exige rojo. Reutiliza la misma `isActiveOnDate` que ya usa `assignByMarine`, sin una segunda implementación. Sin propagación entre lugares: `alerts` ya llega filtrado a la zona propia de cada lugar. Ver "Hipótesis provisional de prioridad (005)" más abajo para el porqué.

## Hipótesis provisional de prioridad (005 — comparación con publicaciones reales)

**Carácter provisional, explícito:** tras la primera comparación de una previsión real contra una publicación de la cuenta de Instagram original, se ajustaron `MAP_PRIORITY` (004) y `assignByCalima`/la detección de niebla de AEMET. Esta comparación **no pretende reproducir la lógica privada de Gabriel** (el propietario de la cuenta original) de forma definitiva — es una hipótesis basada en un único día de evidencia, que se irá contrastando y ajustando contra publicaciones futuras. No se toca hasta entonces sin una comparación nueva que la confirme o la contradiga.

Tres cambios, ninguno toca umbrales de temperatura, viento u oleaje, ni las reglas de `assignBySky`/`assignByFog`/`assignByStorm`:

1. **`MAP_PRIORITY` (`pick-map-pokemon.ts`, 004): la temperatura gana a "poco nuboso" (Altaria).** En los casos comparados, ningún lugar con cielo ligeramente nuboso mostraba Altaria en vez de su Pokémon de temperatura — el cielo parece secundario frente al termómetro cuando la nubosidad es solo parcial. `castform` (nuboso/cubierto) no se toca: sigue por delante de temperatura, sin evidencia todavía que lo cuestione. `altaria` se queda por delante de `castform-sun` (que solo compite cuando es el único candidato de temperatura).
2. **Niebla de AEMET, solo en ventana diurna (`scripts/sources/aemet.ts`).** El booleano diario de `fog` miraba cualquier periodo horario del día — una única aparición nocturna (p. ej. 22h-23h) bastaba para tapar un día despejado el resto de horas. Ahora solo cuentan periodos entre las 08:00 y las 20:59 hora local. `storm`/`calima` no se tocan, siguen mirando el día completo.
3. **Calima también por aviso oficial (`assignByCalima`, `assign-pokemon.ts`).** El pipeline ya descarga los avisos oficiales de AEMET (para Mega Gyarados) pero la regla de calima solo miraba el código de cielo horario. Ahora también dispara con un aviso oficial de `calima` activo el día del forecast, cualquier nivel.

**Lo que queda sin resolver, deliberadamente:** si viento/oleaje deben ganar siempre a temperatura al superar su umbral o solo a veces; y por qué la calima de dos de cuatro islas canarias comparadas no queda cubierta ni por código de cielo ni por aviso oficial en la zona/fecha consultada. Ninguno de los dos se resuelve sin más evidencia — no se ha forzado ningún ajuste para que una publicación concreta "cuadre". (El tercer punto que quedaba abierto aquí — si `castform` debería ceder ante temperatura igual que Altaria — se resuelve más abajo, pero como decisión editorial propia, no porque nueva evidencia lo haya confirmado.)

### Validez de la comparación del 14 de septiembre — limitada, no descartada

**La comparación que originó estos tres cambios se hizo consultando AEMET/IPMA/Open-Meteo en vivo el propio 14 de septiembre**, varias horas después de que Gabriel publicara su mapa de ese mismo día. Información confirmada después: **Gabriel consulta la previsión el día anterior y publica el mapa del día siguiente** (genera con `targetDate = D+1` el día `D`, igual que ya hace `computeTargetDate` en este proyecto — `target-date.ts`). Eso significa que la comparación del 14 enfrentó dos fotos meteorológicas de instantes distintos, no la misma previsión: la propia auditoría demostró en vivo que AEMET cambia sus datos varias veces al día (viento de Teruel: 26→11 km/h en 2 minutos; sky de Ciudad Real cambiando de categoría en la misma ventana — ver histórico de la conversación de auditoría). Por eso **la comparación del 14 no vale como validación definitiva de las reglas de Gabriel** — sirve como primera hipótesis razonada (los tres cambios de arriba), pero no como confirmación. No se revierten los cambios por esto: quedan como hipótesis provisional, ahora con una advertencia de validez más explícita, a la espera de contrastarse con el método correcto.

**Protocolo correcto a partir de aquí, para cualquier comparación futura:** `forecast.json` generado el día `D` (con `targetDate = D+1`, el que ya escribe el pipeline diario) contra la publicación de Gabriel correspondiente a `D+1` — nunca reconstruyendo una publicación antigua con una consulta en vivo posterior. El histórico de git no contiene ningún `forecast.json` generado el 13 de septiembre con `date: "2026-09-14"` (comprobado commit a commit: solo existen dos snapshots en todo el historial, `date: "2026-09-09"` y `date: "2026-09-11"` — ninguno de los dos sirve para el 14). El 14 de septiembre queda por tanto **sin snapshot reproducible**; el seguimiento por este método empieza el primer día para el que exista un `forecast.json` guardado desde la víspera.

## Prioridad de Hoppip / viento moderado — criterio editorial propio (no reproduce a Gabriel)

**A partir de aquí, reproducir exactamente las decisiones editoriales de
Gabriel deja de ser el objetivo.** Las comparaciones
(`spec/research/gabriel-comparisons/`) siguen siendo evidencia útil para
motivar revisiones de la prioridad, pero PokéTiempo construye su propia
jerarquía meteorológica, coherente y defendible por sí misma — no una
imitación de la cuenta de Instagram original. Ningún hallazgo de esas
comparaciones se cita aquí como "la regla de Gabriel confirmada", solo
como el motivo que llevó a revisar `MAP_PRIORITY`.

**Decisión:** Hoppip (viento moderado — `assignByWind` y su umbral de
20 km/h, sin tocar) es una condición secundaria en el mapa. El mapa
muestra un único Pokémon por ubicación; el viento moderado se representa
solo cuando no existe un fenómeno significativo ni una temperatura no
neutral que comunique mejor el estado meteorológico del lugar. Cambio
exclusivo de `MAP_PRIORITY` (presentación, 004) — `assignPokemon` (003) y
`assignByWind` no se tocan, ambos siguen devolviendo exactamente lo mismo
que antes.

Orden resultante en la zona afectada de `MAP_PRIORITY` (de más a menos
prioridad):

1. Fenómenos significativos ya prioritarios, sin cambios: aviso rojo
   costero, tormenta, nieve, calima, niebla, lluvia, oleaje.
2. Viento fuerte o superior (`dragonite`, `rayquaza`, `tornadus`) — sube
   por encima de Hoppip: si el viento ya es lo bastante fuerte para una
   forma más severa que Hoppip, esa forma debe ganar, no quedar tapada
   por el propio viento moderado. `moltres` no se toca.
3. Temperatura relevante — todos los tramos térmicos excepto
   `castform-sun`: `snorunt`, `solrock`, `charmander`, `charmeleon`,
   `magmar`, `groudon`, `groudon-primal`. Suben por encima de Hoppip: una
   temperatura no neutral comunica mejor el día que un viento moderado.
4. `hoppip` — viento moderado, cuando nada de lo anterior aplica.
5. Representaciones ordinarias/neutrales, por debajo de Hoppip: `castform`
   (nuboso/cubierto), `altaria` (poco nuboso), `castform-sun` (banda
   térmica neutral + despejado). Ninguna de las tres se considera un
   fenómeno significativo al nivel de tormenta/nieve/calima/niebla/
   lluvia/oleaje — son la lectura por defecto de un día sin nada más que
   contar, y ahora ceden tanto ante temperatura relevante como ante
   viento moderado.

Esto resuelve, como decisión editorial explícita — no como conclusión de
las comparaciones — el punto que quedaba abierto arriba sobre si
`castform` debía ceder ante temperatura igual que Altaria: ahora sí cede,
tanto ante temperatura como ante Hoppip. La evidencia acumulada sobre esa
relación nunca fue concluyente en ninguna dirección (día 11: 3 casos a
favor de "nuboso gana a temperatura"; día 15: 2 contraejemplos directos;
día 16: n=3 tras corregir un error de categoría, insuficiente) — no se
zanja aquí el criterio de Gabriel, se fija el criterio propio de
PokéTiempo.

Moltres, oleaje, lluvia, calima, tormenta, niebla, nieve, Zapdos/Thundurus
y todos los umbrales térmicos y de viento quedan exactamente igual que
antes de este cambio.

## Riesgos

- **Sprites de `src/assets/sprites/` sin redimensionar** — ya están indexados a paleta (colorType 3, comprimidos en ese sentido), pero varios superan los 2000px de lado (Rayquaza 3200×3200, Mega Gyarados 2779×2488, Solrock 3136×3200), muy por encima de lo que necesitará un sprite en el mapa. El proyecto no tiene ninguna herramienta de redimensionado de imágenes instalada. Queda para la 004, que es quien fija el tamaño real de render — redimensionar antes obligaría a adivinar un target y a añadir una dependencia sin necesidad confirmada.
