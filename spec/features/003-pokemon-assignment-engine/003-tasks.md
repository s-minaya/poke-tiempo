# 003 · Motor de asignación de Pokémon — Tareas

## Bloque 1 — Catálogo y motor de asignación

- [x] `src/domain/pokedex.ts` — tipo `PokedexId` con todos los identificadores que el motor puede producir hoy.
- [x] `src/domain/assign-pokemon.ts` — una función por eje (temperatura, cielo, lluvia, nieve, viento, calima, tormenta, niebla, oleaje) y `assignPokemon(forecast): PokedexId[]`.
- [x] Tests (`src/domain/assign-pokemon.test.ts`, Vitest, table-driven con `it.each`): cada eje, sus valores frontera, y los casos `null`/`false`/`0` que no deben asignar nada.

## Bloque 2 — Assets

- [x] Mover `spec/img/*.png` a `src/assets/sprites/` (25 archivos, nombres ya en kebab-case: los 24 `PokedexId` producibles + `thundurus.png`, conservado sin uso mientras DANA esté deshabilitada).
- [x] Confirmar que cada `PokedexId` tiene su archivo correspondiente en `src/assets/sprites/`.

## Bloque 3 — cierre

- [x] `npm run lint` y `npm run test` en verde.
- [x] Revisar accesibilidad: no aplica directamente (sin componentes React en esta feature).
- [x] Barrer la narración del proceso de comentarios, `003-spec.md`, `003-plan.md` y este archivo.
- [x] Validar contra los criterios de aceptación de `003-spec.md`.
- [x] Mover la feature a "Hecho" en `../../constitution/roadmap.md` y actualizar la fila de "Decisiones pendientes" (umbral de Gyarados y métrica de viento, ya cerradas).

## Definición de "hecho" (además de los criterios de la spec)

- [x] Ningún dato nuevo se pide a AEMET/IPMA/Open-Meteo en runtime (esta feature no toca I/O).
- [x] Sin dependencias nuevas.
