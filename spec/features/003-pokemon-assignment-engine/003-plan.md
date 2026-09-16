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

- `'despejado'` → Castform (forma sol) — `castform-sun`, sea cual sea la temperatura (no solo dentro del tramo 15–25°C de la tabla de arriba) — `assignPokemon` deduplica, así que un día despejado dentro de esa franja no la repite.
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

**Viento cálido** (`wind.speedKmh` + `temperature.maxC`): `wind.speedKmh >= 40` **y** `temperature.maxC >= 30` → Moltres. Regla inferida combinando dos ejes ya existentes — ninguna fuente (AEMET/IPMA/Open-Meteo) da "viento cálido" como categoría propia. Eje independiente del viento simple de arriba: ambos pueden asignar a la vez (`assignByWind` y `assignByWarmWind` son funciones separadas).

**Calima** (`calima`): `true` → Hippowdon · `false`/`null` → ninguno.

**Tormenta** (`storm`): `true` → Zapdos · `false`/`null` → ninguno. DANA deshabilitada: nunca Thundurus.

**Niebla** (`fog`): `true` → Castform (forma hielo) — `castform-ice` · `false`/`null` → ninguno.

**Oleaje** (`marine`, `alerts`):

1. Si `alerts.status === 'ok'` y existe algún aviso con `level === 'rojo'` y `phenomenon === 'costero'` cuya ventana (`startsAt`/`endsAt`) solapa el día de `forecast.date` → Mega Gyarados (prioridad sobre la regla numérica, sea cual sea `waveHeightM`).
2. Si no, y `marine.status === 'ok'` y `marine.data.waveHeightM !== null` y `waveHeightM >= 2,5` → Mega Gyarados también por dato físico, sin necesitar aviso.
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
- **`assignPokemon` deduplica su salida** — necesario porque dos ejes distintos pueden coincidir en el mismo `PokedexId` (cielo despejado + temperatura en el tramo 15–25°C asignan ambos `castform-sun`).
- **Calima también por aviso oficial, no solo por código de cielo** (`assignByCalima`): además de `calima === true`, dispara si hay un `OfficialAlert` con `phenomenon === 'calima'` activo el día del forecast — cualquier nivel (amarillo/naranja/rojo) basta, a diferencia del aviso costero de Mega Gyarados, que exige rojo. Reutiliza la misma `isActiveOnDate` que ya usa `assignByMarine`, sin una segunda implementación. Sin propagación entre lugares: `alerts` ya llega filtrado a la zona propia de cada lugar.

## Prioridad de presentación (`MAP_PRIORITY`, mapa)

`assignPokemon` no tiene prioridad entre ejes — puede devolver varios
Pokémon a la vez para el mismo lugar. El mapa dibuja solo uno por
ubicación; `MAP_PRIORITY` (`pick-map-pokemon.ts`, 004) es el orden fijo
que decide cuál, de más a menos "noticia":

1. Aviso rojo costero (Mega Gyarados), por delante de cualquier otro
   fenómeno.
2. Fenómenos severos: tormenta, nieve, calima, niebla.
3. Lo frecuente: lluvia, oleaje sin aviso (Gyarados normal), viento
   cálido (Moltres).
4. Viento fuerte o superior — Dragonite, Rayquaza, Tornadus.
5. Temperatura relevante — todos los tramos térmicos excepto
   `castform-sun`: Snorunt, Solrock, Charmander, Charmeleon, Magmar,
   Groudon, Groudon primigenio.
6. Hoppip — viento moderado.
7. Representaciones ordinarias/neutrales: Castform (nuboso/cubierto),
   Altaria (poco nuboso), Castform-sun (banda térmica neutral +
   despejado).

**Principio:** el viento moderado (Hoppip) y las lecturas de cielo
ordinarias (Castform, Altaria, Castform-sun) son condiciones
secundarias — se muestran solo cuando no hay un fenómeno más
significativo ni una temperatura no neutral que comunique mejor el
estado del lugar. Ninguna de las tres representaciones neutrales se
considera un fenómeno al nivel de tormenta/nieve/calima/niebla/
lluvia/oleaje.

`castform-sun` va el último de todos: desde que `assignBySky` también lo
asigna por cielo despejado (no solo por el tramo de temperatura
15–25°C), un día despejado fuera de esa franja produce dos candidatos de
temperatura a la vez (el real, y `castform-sun` por el cielo) — puesto
el último, solo gana cuando es el único candidato de temperatura
posible, que es exactamente cuando cielo y temperatura real coinciden.

Este orden es exclusivamente de presentación: ni `assignPokemon` ni
ningún umbral de dominio (`assignByWind` incluido) se ven afectados por
él.

## Riesgos

- **Sprites de `src/assets/sprites/` sin redimensionar** — ya están indexados a paleta (colorType 3, comprimidos en ese sentido), pero varios superan los 2000px de lado (Rayquaza 3200×3200, Mega Gyarados 2779×2488, Solrock 3136×3200), muy por encima de lo que necesitará un sprite en el mapa. El proyecto no tiene ninguna herramienta de redimensionado de imágenes instalada. Queda para la 004, que es quien fija el tamaño real de render — redimensionar antes obligaría a adivinar un target y a añadir una dependencia sin necesidad confirmada.
