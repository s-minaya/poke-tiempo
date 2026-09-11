# Roadmap

_Orden y estado de las features. Es la vista de "qué hay hecho, qué toca ahora y qué viene". Cada entrada apunta a su carpeta en `features/`._

## Hecho ✅

**001 · Setup base del proyecto** — estructura de carpetas, Vite + React + TypeScript, `_breakpoints.scss`, `_variables.scss`, `_reset.scss`, ESLint + Stylelint, Vitest + React Testing Library, workflow de despliegue a GitHub Pages. Ver `features/001-project-setup/`.

**002 · Pipeline de datos (AEMET + IPMA + Open-Meteo)** — la previsión es siempre la de **mañana**: un único `targetDate` (respecto a `Europe/Madrid`, sin librería de fechas) calculado una vez por ejecución, seleccionado explícitamente por fecha en las cuatro fuentes (nunca por posición). Script de descarga de las tres fuentes para los 74 lugares, normalización a un dominio común (fuente principal + complementarias por métrica, semántica `null`/`false`/`0` cerrada, coherencia `snow.cm`/`snow.present`). Si la fuente principal de un lugar (AEMET/IPMA) falla tras sus reintentos, Open-Meteo entra como **fallback meteorológico completo** — mismo camino que su uso como fuente única de Andorra —, salvo que el fallo sea un `AemetAuthError` (401/403) o un `sourceIds` ausente (ambos son errores que abortan directo, nunca se enmascaran con el fallback). **Tolerancia cero tras el fallback**: `forecast.json` solo se escribe con los 74 lugares completos, cada uno con al menos un Pokémon asignable — cualquier otro resultado aborta sin sobrescribir, dejando en línea la previsión anterior. Fallo sistémico de una fuente complementaria (>50% de los lugares que dependen de ella) sigue siendo condición de aborto aparte. Mapeo de cada lugar a su zona oficial de aviso AEMET/IPMA y workflow diario en GitHub Actions (cron 06:00 UTC + manual, fetch → lint/test/build → commit → deploy en la misma cadena). Ver `features/002-weather-data-pipeline/`.

**003 · Motor de asignación de Pokémon** — `assignPokemon(forecast): PokedexId[]` en `src/domain/`, una función pura por eje meteorológico (temperatura, nubes, lluvia, nieve, viento, calima, tormenta, niebla, oleaje) que devuelve todos los Pokémon que le corresponden a un lugar ese día, sin un único ganador. Franjas numéricas sin huecos ni solapamientos, `null` nunca fabrica asignación, lluvia/nieve exigen acumulado `> 0`, viento usa `wind.speedKmh` (nunca `gustKmh`), tormenta siempre Zapdos (DANA deshabilitada), oleaje usa `waveHeightM >= 1.25` para Gyarados y un aviso rojo `costero` activo ese día para Mega Gyarados. 25 sprites en `src/assets/sprites/` (24 `PokedexId` + `thundurus.png` sin uso). Ver `features/003-pokemon-assignment-engine/`.

> **Los 74 lugares del mapa** (fijados a partir de la cuenta original de Instagram, no de una regla administrativa):
> - **España — AEMET (65):** A Coruña, Lugo, Ourense, Pontevedra, Oviedo, Gijón, Cantabria, La Rioja, País Vasco (un único punto para las 3 provincias), Navarra, Huesca, Jaca, Benasque, Teruel, Alcañiz, Zaragoza, Barcelona, Lleida, Girona, Tarragona, Castellón, Valencia, Alicante, Murcia, León, Palencia, Burgos, Zamora, Salamanca, Ávila, Segovia, Soria, Valladolid, Guadalajara, Cuenca, Tarancón, Albacete, Toledo, Ciudad Real, Manzanares, Madrid, Cáceres, Plasencia, Badajoz, Mérida, Huelva, Sevilla, Cádiz, Córdoba, Jaén, Huéscar, Málaga, Granada, Almería, Ceuta, Melilla, Ibiza, Mallorca, Menorca, La Palma, La Gomera, Tenerife, Gran Canaria, Fuerteventura, Lanzarote.
> - **Portugal — IPMA (8):** Porto, Vila Real, Leiria, Guarda, Lisboa, Évora, Beja, Faro.
> - **Andorra — Open-Meteo (1):** Andorra la Vella.
>
> **DANA — sigue sin señal fiable, deshabilitada.** No es una categoría de avisos oficiales de ninguna fuente (verificado contra el catálogo real de ambas) — no se infiere combinando lluvia+tormenta. La regla tormenta+DANA→Thundurus queda documentada pero sin campo en el dominio hasta que exista un criterio legítimo.
>
> **Franjas mañana/tarde — capacidad contemplada, no comprometida.** Ninguna feature actual la consume (el modo `relevo` de la 007 depende de esto y sigue deshabilitado), así que no se fija forma de dato todavía — se diseña cuando haya un consumidor real.

**004 · Mapa de España** — SVG del mapa (España peninsular, Portugal, Andorra, Baleares, Ceuta y Melilla en su posición geográfica real dentro de un mismo `fitExtent`, con sus fronteras internas de comunidad autónoma/distrito, más una franja decorativa de contexto norteafricano detrás de Ceuta/Melilla) generado en build time con `d3-geo` (`scripts/build-map.ts`, nunca en el navegador) a partir de GeoJSON de Natural Earth. Los 74 lugares de `locations.ts` proyectados a su posición real, cada uno con el Pokémon más representativo del día (`pickMapPokemon`, prioridad fija sobre lo que devuelve `assignPokemon`, 003) como único sprite. Canarias en su propio recuadro (`TerritoryInset`), desplazado a la izquierda mediante una extensión pura del `viewBox` — sin alterar la escala del mapa principal ni las coordenadas de `locations.ts`. Responsive con un único `viewBox` + SCSS (sin JS de resize), accesibilidad con `role="group"` en los contenedores y `role="img"` + nombre accesible individual en cada uno de los 74 marcadores. Ver `features/004-spain-map/`.

## Siguiente 🔜

**005 · Cabecera y leyenda** — ver el detalle en "Orden previsto" más abajo.

## Orden previsto 📋

_Orden razonado, no comprometido. Cada una necesita su spec antes de tocar código._

1. **005 · Cabecera y leyenda** — título, fecha de previsión y la columna de Pokémon del día con su descripción.

2. **006 · Responsive, accesibilidad y cierre** — solución para móvil (el mapa de 74 lugares no es legible en 320px y necesita su propia forma), alternativa textual del mapa, atribución a AEMET y disclaimer de Pokémon.

3. **007 · Profesor Oak** — 3 diálogos narrativos diarios que traducen la previsión ya decidida (002 + 003) a texto, con Groq (capa gratuita) como redactor y una capa de fallback local sin IA. Diseño detallado en `features/007-professor-oak/`. La lógica de asignación Pokémon (qué Pokémon toca hoy) sigue siendo exclusivamente de la 003 — Oak nunca decide eso, solo lo narra.

## Decisiones pendientes 🤔

_Bloquean o condicionan alguna de las features de arriba. Ninguna se resuelve por iniciativa de un agente._

- **Origen y licencia de los sprites** en `src/assets/sprites/` (Snorunt, Solrock, Castform y sus formas, Charmander/Charmeleon, Magmar, Groudon y Groudon primigenio, Altaria, Kyogre y Kyogre primigenio, Cryogonal, Abomasnow, Hoppip, Dragonite, Rayquaza, Tornadus, Hippowdon, Zapdos, Thundurus, Gyarados y Mega Gyarados). Puede seguir creciendo si aparecen más matices. (El redimensionado a 160px y la elección de formato, PNG sobre WebP, ya están resueltos en la 004 — ver `tech-stack.md`; lo que queda pendiente aquí es solo origen/licencia.)
- **Paleta de color.**
- **Alta en meteo.ad.** Se descartó como fuente para Andorra (exige registro manual e IP fija, ver `tech-stack.md`), pero si en algún momento se quiere la fuente oficial en vez de Open-Meteo, el alta la tiene que hacer una persona, no un agente.
- **Señal de DANA** — capacidad futura, fuera del alcance de la 002 (confirmado: no es una categoría de avisos oficiales de AEMET ni de IPMA). Se añadiría como ampliación explícita el día que exista una fuente/criterio fiable.
- **Umbral de nivel de aviso que activa el modo `alerta`** de Profesor Oak (007) — el dato y su estructura ya existen (002); qué nivel(es) lo disparan es decisión de producto de la 007. La 007 también necesita, cuando se implemente, acceso al conjunto completo de avisos activos (no solo los de la zona de cada uno de los 74 proxies) — ver `features/007-professor-oak/007-plan.md`.
- **Franjas mañana/tarde** — capacidad contemplada en el dominio de la 002 sin comprometer forma de dato; se diseña cuando exista un consumidor real (el modo `relevo` de la 007 sigue deshabilitado por esto).

## Backlog / ideas 💡

_Sin comprometer ni ordenar. Ideas que respetan la constitución._

- **Portada de entrada** — `Loader` → portada/landing → botón "Empezar" → aplicación. Ese botón serviría también como la interacción explícita del usuario que los navegadores exigen antes de habilitar el audio de Profesor Oak (007). `src/components/Loader/` ya existe como pieza aislada a la espera de esta feature (sin montar en `App.tsx`); no representa una espera de red — `forecast.json` ya llega generado estáticamente en build time — así que su uso previsto es precarga/preparación de assets de esa pantalla de entrada, no datos meteorológicos.
- **Histórico de previsiones** — guardar un `forecast.json` por día en vez de sobrescribir. No necesita base de datos: el propio historial de git ya versiona cada día, y un archivo por fecha permitiría navegar hacia atrás.
- **Más de un día de previsión** — AEMET devuelve hasta 7 días en la misma respuesta; hoy solo se usa el correspondiente a `targetDate` (mañana), así que ampliarlo no cuesta peticiones extra.
- **Optimización SEO** — metadatos, imagen de previsualización para redes (que sería el mapa del día, generado en el mismo pipeline).

> Cada feature nueva se crea como `features/NNN-nombre-feature/` con `NNN-spec.md`, `NNN-plan.md` y `NNN-tasks.md` (número de la feature como prefijo del archivo, no solo de la carpeta) antes de tocar código. **El nombre de la carpeta va en inglés** (`AGENTS.md`) — nombres ya fijados para que no se repita en inglés/español mezclado: `001-project-setup`, `002-weather-data-pipeline`, `003-pokemon-assignment-engine`, `004-spain-map`, `005-header-and-legend`, `006-responsive-and-accessibility`, `007-professor-oak`.
