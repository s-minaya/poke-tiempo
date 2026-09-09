# 003 · Motor de asignación de Pokémon

**Estado:** implementado ✅

## Qué hace

Una función pura que traduce el `LocationForecast` de un lugar (contrato de la 002) en la lista de Pokémon que le corresponden hoy. Puede devolver ninguno, uno o varios simultáneamente: temperatura, nubes, lluvia, nieve, viento, calima, tormenta, niebla y oleaje son ejes meteorológicos independientes, y cada uno aporta su propio Pokémon (o ninguno) a la lista final — no hay un único "ganador".

## Por qué

Es el corazón del chiste de Poketiempo: sin esta traducción no hay mapa que enseñar. Las reglas ya están confirmadas por el propietario de la cuenta original (`constitution/roadmap.md`); esta feature las convierte en código puro, testeado exhaustivamente en sus límites, para que 004 (mapa), 005 (leyenda) y 007 (Profesor Oak) tengan encima algo estable sobre lo que construir.

## Criterios de aceptación

- [x] `assignPokemon(forecast: LocationForecast): PokedexId[]` devuelve los Pokémon de todos los ejes que disparan regla ese día, sin límite de uno.
- [x] Cada eje se evalúa de forma independiente; ningún eje bloquea o prioriza a otro.
- [x] Ningún campo `null` de `LocationForecast` fabrica una asignación — un eje con dato ausente no aporta Pokémon.
- [x] Las franjas numéricas (temperatura, viento, lluvia, nieve, oleaje) no dejan huecos ni se solapan; el valor de cada frontera está testeado explícitamente.
- [x] Lluvia y nieve solo asignan Pokémon cuando el acumulado es mayor que 0.
- [x] Tormenta siempre asigna Zapdos — la regla tormenta+DANA→Thundurus queda documentada como deshabilitada, sin campo que la active.
- [x] Oleaje: `waveHeightM >= 1.25` asigna Gyarados; un aviso oficial de nivel rojo con `phenomenon: 'costero'` activo el día del forecast asigna Mega Gyarados en su lugar (nunca ambos a la vez).
- [x] Formas que necesitan sprite distinto llevan un `PokedexId` propio (`castform-sun`, `castform-rain`, `castform-ice`, `castform`, `groudon`/`groudon-primal`, `kyogre`/`kyogre-primal`, `gyarados`/`gyarados-mega`).
- [x] Batería de tests table-driven (`it.each`) que cubre cada eje y, en especial, los valores frontera de cada franja numérica.
- [x] Sin dependencias nuevas, sin I/O, sin componentes React — vive en `src/domain/`, tal y como fija `tech-stack.md`.

## Fuera de alcance

- Texto de leyenda (`label`/`description` de cada Pokémon) — contenido de producto para la 005 (Cabecera y leyenda), no de esta feature.
- Prioridad entre Pokémon, un "ganador" único o cualquier lógica de composición para el mapa/leyenda — si hace falta, se decide en 004/005 con esta lista como entrada.
- Sprites renderizados en pantalla — esta feature entrega identificadores, no imágenes montadas en componentes.
- Tormenta + DANA → Thundurus — deshabilitada, sin campo en el contrato de la 002 (ver `roadmap.md`).
- Franjas mañana/tarde — no existen en el contrato de la 002 todavía.
