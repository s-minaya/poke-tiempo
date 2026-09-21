# 007 · Profesor Oak

**Estado:** diseño reconciliado con el repositorio actual — pendiente de confirmación del usuario antes de implementar.

## Qué hace

Cada día, el Profesor Oak narra la previsión **ya decidida** por el resto del sistema en **3 diálogos cortos**, pensados para un bocadillo de diálogo de videojuego, no para un boletín. Oak no mide el tiempo ni decide qué Pokémon corresponde a qué fenómeno: la meteorología la fija la 002 y la asignación Pokémon la fija la 003. Su trabajo es exclusivamente narrativo.

## Por qué

Encaja con la broma central del proyecto (`mission.md`): el mapa que asigna Pokémon a la meteorología ya es el chiste visual; Oak le añade una voz que lo comenta, sin salirse del principio de que la meteorología manda y la narrativa se adapta a ella, nunca al revés.

## Regla arquitectónica central

**Oak nunca decide qué Pokémon corresponde al tiempo.**

- La meteorología viene de la 002 (`Forecast` / `LocationForecast`, `src/domain/types.ts`).
- La asignación Pokémon viene de la 003 (`assignPokemon`, `src/domain/assign-pokemon.ts`).
- El "qué es más noticia" —y, sobre todo, **qué Pokémon ve el usuario en cada lugar**— viene de `MAP_PRIORITY` / `pickMapPokemon`, el criterio editorial ya fijado en el proyecto. Oak lo **reutiliza**; no crea un ranking paralelo.

**Oak narra el mapa que se ve.** `assignPokemon` devuelve todos los candidatos de un lugar, pero solo uno se dibuja. Oak nombra únicamente ese; un candidato descartado por `pickMapPokemon` nunca llega al relato.

Oak únicamente:

1. selecciona hechos reales e interesantes del día,
2. decide cómo repartirlos entre tres diálogos,
3. aplica tono y continuidad,
4. deja que la IA redacte esos hechos ya cerrados,
5. usa un fallback local determinista si la IA falla.

La IA **nunca** puede: reasignar Pokémon, inventar temperaturas, inventar lluvia/viento/avisos, añadir lugares que no estén en el hecho que redacta, ni afirmar fenómenos que no existan en el `DayPlan`. Recibe hechos cerrados y tipados (`NarrativeFact`), nunca el `forecast.json` completo.

## Estado de las dependencias

Ya no hay ninguna dependencia bloqueante:

- **002 implementada** — `src/data/forecast.json` se genera a diario con los 74 lugares, incluidos `alerts` con los `OfficialAlert` completos por lugar.
- **003 implementada** — `assignPokemon()` y las funciones por eje son públicas y puras; `PokedexId` es el identificador estable.
- **Prioridad editorial cerrada** — `MAP_PRIORITY` y `pickMapPokemon()`, que además fijan qué Pokémon ve realmente el usuario en cada lugar.
- **006 cerrada** — el botón `EMPEZAR` existe y hay un punto natural donde montar a Oak dentro de `WeatherApp`.

## Alcance de esta feature

Dentro:

- El dominio puro de Oak (`src/domain/oak/`): hechos, protagonistas, modo del día, plan de diálogos, historial y fallback.
- El script de generación diaria y el adapter de IA (`scripts/oak/`).
- El contrato de `src/data/oak-today.json` y su consumo en build-time.
- La integración en el workflow diario.

Fuera:

- **Voz / TTS de Oak.** No se implementa en esta fase. Si algún día existe, se diseña dentro de su propia UX; el gesto de `EMPEZAR` (006) no se da por hecho como solución permanente de las políticas de autoplay.
- **La UX visual final del componente** (bocadillo, carrusel, avance, indicador). Esta fase cierra el contrato de datos y cómo lo consume el frontend, no el diseño visual.
- **Representar DANA** — sin señal fiable (`roadmap.md`).
- **Modos que dependen de datos inexistentes** — `anomalia` (climatología de referencia), `relevo` (franjas mañana/tarde), `migracion` (información temporal/espacial multi-día). Siguen fuera.
- **Ampliar la 002 con un dataset de avisos fuera de los 74 proxies.** Descartado: la cobertura es la de los 74 lugares y no se añade ningún `alerts-today.json`.
- **Los modos `duelo` y `calma`.** Descartados con datos del forecast real (ver `007-plan.md`); pueden volver el día que haya una razón medida para ello.

## Criterios de aceptación

- [ ] Oak no contiene ninguna regla meteorológica ni de asignación Pokémon propia.
- [ ] **Oak nunca nombra un Pokémon que no se vea en el mapa.** Todo `PokedexId` de un hecho procede de `pickMapPokemon`; ningún candidato descartado por `assignPokemon` llega al relato.
- [ ] No existe ninguna tabla nueva de "qué Pokémon es importante". La importancia se deriva de `MAP_PRIORITY` y de recuentos reales del día.
- [ ] "Condición significativa" se decide con la frontera que `MAP_PRIORITY` ya documenta (por delante de `hoppip`), no con una lista nueva.
- [ ] Los 3 diálogos se generan siempre, aunque falle la IA: fallback local determinista, sin red.
- [ ] Ningún dato meteorológico (temperatura, mm, km/h, avisos, niveles) puede ser inventado por la IA — solo redacta `NarrativeFact` cerrados.
- [ ] Ningún hecho se repite en más de un diálogo del mismo día.
- [ ] Los diálogos hablan de **mañana**: `forecast.date` es `targetDate` (`target-date.ts`), no hoy.
- [ ] El modo `alerta` solo se activa desde una señal explícita de aviso oficial activo en `forecast.date`, nunca inferida del Pokémon asignado, y tiene prioridad absoluta sobre los demás modos.
- [ ] Un aviso solo cuenta si está activo en `forecast.date` — mismo criterio de solape que ya aplica la 003, sin reimplementarlo.
- [ ] La API key del proveedor de IA vive solo en GitHub Secrets: nunca en el bundle, nunca en `VITE_*`, nunca en el JSON público. El proveedor/modelo es configurable y permanece exclusivamente en capa gratuita — coste operativo obligatorio: **0 €**.
- [ ] Una sola llamada a la IA **por generación** para los 3 diálogos, nunca tres. El `schedule` hace una al día; un rerun manual hace otra, y eso es esperado.
- [ ] Cualquier error, timeout, `429`, indisponibilidad o JSON inválido activa el fallback local y el run **continúa**.
- [ ] Un fallo de nuestra propia lógica o validación que impida producir 3 diálogos válidos falla de forma ruidosa y **no** escribe `oak-today.json`.
- [ ] `src/data/oak-today.json` se importa en build-time, igual que `forecast.json` — sin `fetch` en runtime.
- [ ] `oak-today.json` solo se genera sobre un `forecast.json` cuya `date` coincide con el `targetDate` de esa misma ejecución.
- [ ] El pipeline nunca sobrescribe un `oak-today.json` válido con uno inválido.
- [ ] El historial guarda solo IDs y categorías, nunca el texto generado.
- [ ] **El historial es idempotente por fecha.** Varias generaciones para el mismo `forecast.date` no cuentan como varios días: al leer se ignora la entrada de la fecha objetivo, al escribir se hace upsert, y nunca hay dos entradas con la misma `date`.
- [ ] El artifact del `forecast.json` se sigue subiendo inmediatamente después del fetch: un fallo de Oak nunca puede impedir conservar un forecast válido.
- [ ] Sin dependencias nuevas de runtime. Sin SDK de IA si `fetch` de Node resuelve el contrato.
