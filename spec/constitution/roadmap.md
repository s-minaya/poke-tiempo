# Roadmap

_Orden y estado de las features. Es la vista de "qué hay hecho, qué toca ahora y qué viene". Cada entrada apunta a su carpeta en `features/`._

## Hecho ✅

**001 · Setup base del proyecto** — estructura de carpetas, Vite + React + TypeScript, `_breakpoints.scss`, `_variables.scss`, `_reset.scss`, ESLint + Stylelint, Vitest + React Testing Library, workflow de despliegue a GitHub Pages. Ver `features/001-project-setup/`.

## Siguiente 🔜

**002 · Pipeline de datos (AEMET + IPMA + Open-Meteo)** — ver el detalle en "Orden previsto" más abajo.

## Orden previsto 📋

_Orden razonado, no comprometido. Cada una necesita su spec antes de tocar código._

2. **002 · Pipeline de datos (AEMET + IPMA + Open-Meteo)** — script de descarga de las tres fuentes, generación del listado de 74 lugares, workflow diario en GitHub Actions y el esquema de `forecast.json`, con la normalización de cada fuente a un vocabulario de dominio común. **Va antes que cualquier UI a propósito:** es la parte con más incertidumbre del proyecto y define la forma de los datos con los que trabaja todo lo demás. Construir la interfaz contra datos inventados y adaptarla después sería trabajo tirado.

   > Existe ya un spike validado para la parte de AEMET (cliente con doble llamada, decodificación ISO-8859-1, throttle y reintentos; generación de `capitales.ts` desde el maestro de municipios; workflow de Actions). Entra al repositorio a través de esta feature, con su spec y su plan, no antes. IPMA y Open-Meteo son integraciones nuevas, sin spike previo.

   > **Los 74 lugares del mapa** (fijados a partir de la cuenta original de Instagram, no de una regla administrativa):
   > - **España — AEMET (65):** A Coruña, Lugo, Ourense, Pontevedra, Oviedo, Gijón, Cantabria, La Rioja, País Vasco (un único punto para las 3 provincias), Navarra, Huesca, Jaca, Benasque, Teruel, Alcañiz, Zaragoza, Barcelona, Lleida, Girona, Tarragona, Castellón, Valencia, Alicante, Murcia, León, Palencia, Burgos, Zamora, Salamanca, Ávila, Segovia, Soria, Valladolid, Guadalajara, Cuenca, Tarancón, Albacete, Toledo, Ciudad Real, Manzanares, Madrid, Cáceres, Plasencia, Badajoz, Mérida, Huelva, Sevilla, Cádiz, Córdoba, Jaén, Huéscar, Málaga, Granada, Almería, Ceuta, Melilla, Ibiza, Mallorca, Menorca, La Palma, La Gomera, Tenerife, Gran Canaria, Fuerteventura, Lanzarote.
   > - **Portugal — IPMA (8):** Porto, Vila Real, Leiria, Guarda, Lisboa, Évora, Beja, Faro.
   > - **Andorra — Open-Meteo (1):** Andorra la Vella.
   >
   > Nota aparte para cuando se construya el script: existe un municipio español real llamado **"Andorra" (Teruel)**, sin relación con el país — cuidado al resolver nombres contra el maestro de municipios de AEMET.

   > **Contrato de datos cerrado.** Dominio por ejes simultáneos (temperatura, cielo, precipitación, nieve, viento, tormenta, calima, niebla, mar, avisos), arquitectura de fuente principal + complementarias por métrica (nunca un único `source` por forecast), y semántica `null` = "la fuente no puede detectarlo" vs. `false`/`0` = "lo detecta y confirma su ausencia". Detalle completo, tipos y ejemplos en `features/002-weather-data-pipeline/002-plan.md`. Sigue habiendo trabajo de implementación explícito pendiente (no de diseño): el mapeo de cada uno de los 74 lugares a su zona oficial de aviso en AEMET/IPMA.
   >
   > **DANA — sigue sin señal fiable, deshabilitada.** No es una categoría de avisos oficiales de ninguna fuente (verificado contra el catálogo real de ambas) — no se infiere combinando lluvia+tormenta. La regla tormenta+DANA→Thundurus queda documentada pero sin campo en el dominio hasta que exista un criterio legítimo.
   >
   > **Franjas mañana/tarde — capacidad contemplada, no comprometida.** Ninguna feature actual la consume (el modo `relevo` de la 007 depende de esto y sigue deshabilitado), así que no se fija forma de dato todavía — se diseña cuando haya un consumidor real.

3. **003 · Motor de asignación de Pokémon** — la función pura que traduce una condición meteorológica en un Pokémon, con su tabla de reglas declarativa y su batería de tests. Se puede cerrar con un puñado de Pokémon de prueba: no hace falta tener la lista completa para dar la feature por hecha, porque ampliarla después es tocar datos, no código.

   > **Reglas de asignación confirmadas por el propietario de la cuenta original.** No son una propuesta: es la tabla real que usa Poketiempo, y define franjas mucho más finas que las 12 categorías de `SkyCondition` en `tech-stack.md` — cada categoría se resuelve internamente por umbral numérico. El motor de la 003 se diseña contra esta tabla directamente.
   >
   > - **Temperatura** (un único eje continuo, cubre frío y calor — no son "soleado" y "caluroso" por separado): hasta 7° Snorunt · 8-14° Solrock · 15-25° Castform (forma sol) · 26-29° Charmander · 30-33° Charmeleon · 34-39° Magmar · 40-43° Groudon · más de 44° Groudon primigenio.
   > - **Nubes:** poco nuboso → Altaria · nuboso o muy nuboso → Castform (forma normal/nube).
   > - **Lluvia** (mm acumulados): hasta 10mm Castform (forma lluvia) · hasta 60mm Kyogre · más de 60mm Kyogre primigenio.
   > - **Nieve** (cm): hasta 10cm Cryogonal · más de 10cm Abomasnow.
   > - **Viento** (km/h): 20-40 Hoppip · 40-60 Dragonite · 60-90 Rayquaza · más de 90 Tornadus.
   > - **Calima:** Hippowdon.
   > - **Tormenta:** Zapdos — salvo que sea una DANA, en cuyo caso Thundurus. El contrato actual de la 002 no representa DANA y no está previsto que lo haga como parte de esa feature — es una posible ampliación futura si algún día aparece una fuente/criterio fiable (ver nota en el punto 2 y "Decisiones pendientes"); mientras tanto, la regla no distingue y siempre sale Zapdos.
   > - **Niebla:** Castform (forma hielo).
   > - **Oleaje:** Gyarados · oleaje muy fuerte (aviso rojo) → Mega Gyarados.
   >
   > "Muy fuerte" se define contra el sistema de avisos (nivel rojo, `phenomenon: 'costero'`), no contra un umbral numérico propio — al menos para oleaje; para el resto de categorías ya hay número exacto.
   >
   > **Dato de oleaje resuelto en la 002** (Open-Meteo Marine para toda la costa de España y Portugal, avisos costeros vía AEMET/IPMA para "muy fuerte") — ver `features/002-weather-data-pipeline/002-plan.md`. Lo que sigue sin decidir, ya de producto de esta feature: **el umbral numérico de `waveHeightM` que activa Gyarados** (siempre hay alguna altura de ola, hace falta un corte real) y **qué métrica de viento usa la tabla** (`wind.speedKmh` sostenido vs `wind.gustKmh` de racha).

4. **004 · Mapa de España** — el SVG base con las ciudades y sus sprites, proyección de coordenadas incluida. Primera feature que produce algo que se ve.

5. **005 · Cabecera y leyenda** — título, fecha de previsión y la columna de Pokémon del día con su descripción.

6. **006 · Responsive, accesibilidad y cierre** — solución para móvil (el mapa de 52 ciudades no es legible en 320px y necesita su propia forma), alternativa textual del mapa, atribución a AEMET y disclaimer de Pokémon.

7. **007 · Profesor Oak** — 3 diálogos narrativos diarios que traducen la previsión ya decidida (002 + 003) a texto, con Groq (capa gratuita) como redactor y una capa de fallback local sin IA. Diseño detallado en `features/007-professor-oak/`. **Depende por completo de la 002 y la 003:** no genera nada real hasta que ambas existan, aunque su diseño ya está cerrado en paralelo. La lógica de asignación Pokémon (qué Pokémon toca hoy) sigue siendo exclusivamente de la 003 — Oak nunca decide eso, solo lo narra.

## Decisiones pendientes 🤔

_Bloquean o condicionan alguna de las features de arriba. Ninguna se resuelve por iniciativa de un agente._

- **Origen y licencia de los sprites** de la tabla de la 003 (Snorunt, Solrock, Castform y sus formas, Charmander/Charmeleon, Magmar, Groudon y Groudon primigenio, Altaria, Kyogre y Kyogre primigenio, Cryogonal, Abomasnow, Hoppip, Dragonite, Rayquaza, Tornadus, Hippowdon, Zapdos, Thundurus, Gyarados y Mega Gyarados). Puede seguir creciendo si aparecen más matices.
- **Umbral numérico de `waveHeightM` para Gyarados** (003) — el dato ya existe (002), falta el corte de producto.
- **Qué métrica de viento usa la tabla de la 003** — `wind.speedKmh` (sostenido) vs `wind.gustKmh` (racha).
- **Paleta de color.**
- **Alta en meteo.ad.** Se descartó como fuente para Andorra (exige registro manual e IP fija, ver `tech-stack.md`), pero si en algún momento se quiere la fuente oficial en vez de Open-Meteo, el alta la tiene que hacer una persona, no un agente.
- **Señal de DANA** — capacidad futura, fuera del alcance actual de la 002 (confirmado: no es una categoría de avisos oficiales de AEMET ni de IPMA). Se añadiría como ampliación explícita el día que exista una fuente/criterio fiable, no como parte de esta ronda de la feature.
- **Mapeo de los 74 lugares a su zona oficial de aviso** (AEMET e IPMA usan zonas propias, distintas entre sí y de nuestra lista de lugares) — configuración explícita a construir en la implementación de la 002, nunca aproximada.
- **Umbral de nivel de aviso que activa el modo `alerta`** de Profesor Oak (007) — el dato y su estructura ya existen (002); qué nivel(es) lo disparan es decisión de producto de la 007.
- **Franjas mañana/tarde** — capacidad contemplada en el dominio de la 002 sin comprometer forma de dato; se diseña cuando exista un consumidor real (el modo `relevo` de la 007 sigue deshabilitado por esto).

## Backlog / ideas 💡

_Sin comprometer ni ordenar. Ideas que respetan la constitución._

- **Histórico de previsiones** — guardar un `forecast.json` por día en vez de sobrescribir. No necesita base de datos: el propio historial de git ya versiona cada día, y un archivo por fecha permitiría navegar hacia atrás.
- **Más de un día de previsión** — AEMET devuelve hasta 7 días en la misma respuesta; hoy solo se usa el primero, así que ampliarlo no cuesta peticiones extra.
- **Optimización SEO** — metadatos, imagen de previsualización para redes (que sería el mapa del día, generado en el mismo pipeline).

> Cada feature nueva se crea como `features/NNN-nombre-feature/` con `NNN-spec.md`, `NNN-plan.md` y `NNN-tasks.md` (número de la feature como prefijo del archivo, no solo de la carpeta) antes de tocar código. **El nombre de la carpeta va en inglés** (`AGENTS.md`) — nombres ya fijados para que no se repita en inglés/español mezclado: `001-project-setup`, `002-weather-data-pipeline`, `003-pokemon-assignment-engine`, `004-spain-map`, `005-header-and-legend`, `006-responsive-and-accessibility`, `007-professor-oak`.
