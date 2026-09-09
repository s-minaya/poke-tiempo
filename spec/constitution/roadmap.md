# Roadmap

_Orden y estado de las features. Es la vista de "qué hay hecho, qué toca ahora y qué viene". Cada entrada apunta a su carpeta en `features/`._

## Hecho ✅

**001 · Setup base del proyecto** — estructura de carpetas, Vite + React + TypeScript, `_breakpoints.scss`, `_variables.scss`, `_reset.scss`, ESLint + Stylelint, Vitest + React Testing Library, workflow de despliegue a GitHub Pages. Ver `features/001-project-setup/`.

**002 · Pipeline de datos (AEMET + IPMA + Open-Meteo)** — script de descarga de las tres fuentes para los 74 lugares, normalización a un dominio común (fuente principal + complementarias por métrica, semántica `null`/`false`/`0` cerrada, coherencia `snow.cm`/`snow.present`), tolerancia a fallos de tres niveles con aborto por umbral independiente, mapeo de cada lugar a su zona oficial de aviso AEMET/IPMA y workflow diario en GitHub Actions (cron 06:00 UTC + manual, fetch → lint/test/build → commit → deploy en la misma cadena). Ver `features/002-weather-data-pipeline/`.

**003 · Motor de asignación de Pokémon** — `assignPokemon(forecast): PokedexId[]` en `src/domain/`, una función pura por eje meteorológico (temperatura, nubes, lluvia, nieve, viento, calima, tormenta, niebla, oleaje) que devuelve todos los Pokémon que le corresponden a un lugar ese día, sin un único ganador. Franjas numéricas sin huecos ni solapamientos, `null` nunca fabrica asignación, lluvia/nieve exigen acumulado `> 0`, viento usa `wind.speedKmh` (nunca `gustKmh`), tormenta siempre Zapdos (DANA deshabilitada), oleaje usa `waveHeightM >= 1.25` para Gyarados y un aviso rojo `costero` activo ese día para Mega Gyarados. 25 sprites en `src/assets/sprites/` (24 `PokedexId` + `thundurus.png` sin uso). Ver `features/003-pokemon-assignment-engine/`.

> **Los 74 lugares del mapa** (fijados a partir de la cuenta original de Instagram, no de una regla administrativa):
> - **España — AEMET (65):** A Coruña, Lugo, Ourense, Pontevedra, Oviedo, Gijón, Cantabria, La Rioja, País Vasco (un único punto para las 3 provincias), Navarra, Huesca, Jaca, Benasque, Teruel, Alcañiz, Zaragoza, Barcelona, Lleida, Girona, Tarragona, Castellón, Valencia, Alicante, Murcia, León, Palencia, Burgos, Zamora, Salamanca, Ávila, Segovia, Soria, Valladolid, Guadalajara, Cuenca, Tarancón, Albacete, Toledo, Ciudad Real, Manzanares, Madrid, Cáceres, Plasencia, Badajoz, Mérida, Huelva, Sevilla, Cádiz, Córdoba, Jaén, Huéscar, Málaga, Granada, Almería, Ceuta, Melilla, Ibiza, Mallorca, Menorca, La Palma, La Gomera, Tenerife, Gran Canaria, Fuerteventura, Lanzarote.
> - **Portugal — IPMA (8):** Porto, Vila Real, Leiria, Guarda, Lisboa, Évora, Beja, Faro.
> - **Andorra — Open-Meteo (1):** Andorra la Vella.
>
> **DANA — sigue sin señal fiable, deshabilitada.** No es una categoría de avisos oficiales de ninguna fuente (verificado contra el catálogo real de ambas) — no se infiere combinando lluvia+tormenta. La regla tormenta+DANA→Thundurus queda documentada pero sin campo en el dominio hasta que exista un criterio legítimo.
>
> **Franjas mañana/tarde — capacidad contemplada, no comprometida.** Ninguna feature actual la consume (el modo `relevo` de la 007 depende de esto y sigue deshabilitado), así que no se fija forma de dato todavía — se diseña cuando haya un consumidor real.

## Siguiente 🔜

**004 · Mapa de España** — ver el detalle en "Orden previsto" más abajo.

## Orden previsto 📋

_Orden razonado, no comprometido. Cada una necesita su spec antes de tocar código._

1. **004 · Mapa de España** — el SVG base con las ciudades y sus sprites, proyección de coordenadas incluida. Primera feature que produce algo que se ve.

2. **005 · Cabecera y leyenda** — título, fecha de previsión y la columna de Pokémon del día con su descripción.

3. **006 · Responsive, accesibilidad y cierre** — solución para móvil (el mapa de 52 ciudades no es legible en 320px y necesita su propia forma), alternativa textual del mapa, atribución a AEMET y disclaimer de Pokémon.

4. **007 · Profesor Oak** — 3 diálogos narrativos diarios que traducen la previsión ya decidida (002 + 003) a texto, con Groq (capa gratuita) como redactor y una capa de fallback local sin IA. Diseño detallado en `features/007-professor-oak/`. La lógica de asignación Pokémon (qué Pokémon toca hoy) sigue siendo exclusivamente de la 003 — Oak nunca decide eso, solo lo narra.

## Decisiones pendientes 🤔

_Bloquean o condicionan alguna de las features de arriba. Ninguna se resuelve por iniciativa de un agente._

- **Origen y licencia de los sprites** en `src/assets/sprites/` (Snorunt, Solrock, Castform y sus formas, Charmander/Charmeleon, Magmar, Groudon y Groudon primigenio, Altaria, Kyogre y Kyogre primigenio, Cryogonal, Abomasnow, Hoppip, Dragonite, Rayquaza, Tornadus, Hippowdon, Zapdos, Thundurus, Gyarados y Mega Gyarados). Puede seguir creciendo si aparecen más matices.
- **Redimensionado de los sprites de `src/assets/sprites/`** — varios superan los 2000px de lado, muy por encima de lo que necesitará un sprite en el mapa. Se resuelve en la 004, que es quien fija el tamaño real de render; puede requerir añadir una herramienta de imagen (avisando antes, ver `AGENTS.md`).
- **Paleta de color.**
- **Alta en meteo.ad.** Se descartó como fuente para Andorra (exige registro manual e IP fija, ver `tech-stack.md`), pero si en algún momento se quiere la fuente oficial en vez de Open-Meteo, el alta la tiene que hacer una persona, no un agente.
- **Señal de DANA** — capacidad futura, fuera del alcance de la 002 (confirmado: no es una categoría de avisos oficiales de AEMET ni de IPMA). Se añadiría como ampliación explícita el día que exista una fuente/criterio fiable.
- **Umbral de nivel de aviso que activa el modo `alerta`** de Profesor Oak (007) — el dato y su estructura ya existen (002); qué nivel(es) lo disparan es decisión de producto de la 007. La 007 también necesita, cuando se implemente, acceso al conjunto completo de avisos activos (no solo los de la zona de cada uno de los 74 proxies) — ver `features/007-professor-oak/007-plan.md`.
- **Franjas mañana/tarde** — capacidad contemplada en el dominio de la 002 sin comprometer forma de dato; se diseña cuando exista un consumidor real (el modo `relevo` de la 007 sigue deshabilitado por esto).

## Backlog / ideas 💡

_Sin comprometer ni ordenar. Ideas que respetan la constitución._

- **Histórico de previsiones** — guardar un `forecast.json` por día en vez de sobrescribir. No necesita base de datos: el propio historial de git ya versiona cada día, y un archivo por fecha permitiría navegar hacia atrás.
- **Más de un día de previsión** — AEMET devuelve hasta 7 días en la misma respuesta; hoy solo se usa el primero, así que ampliarlo no cuesta peticiones extra.
- **Optimización SEO** — metadatos, imagen de previsualización para redes (que sería el mapa del día, generado en el mismo pipeline).

> Cada feature nueva se crea como `features/NNN-nombre-feature/` con `NNN-spec.md`, `NNN-plan.md` y `NNN-tasks.md` (número de la feature como prefijo del archivo, no solo de la carpeta) antes de tocar código. **El nombre de la carpeta va en inglés** (`AGENTS.md`) — nombres ya fijados para que no se repita en inglés/español mezclado: `001-project-setup`, `002-weather-data-pipeline`, `003-pokemon-assignment-engine`, `004-spain-map`, `005-header-and-legend`, `006-responsive-and-accessibility`, `007-professor-oak`.
