# Roadmap

_Orden y estado de las features. Es la vista de "qué hay hecho, qué toca ahora y qué viene". Cada entrada apunta a su carpeta en `features/`._

## Hecho ✅

_Nada todavía. El proyecto acaba de arrancar._

## Siguiente 🔜

**001 · Setup base del proyecto** — estructura de carpetas, Vite + React + TypeScript, `_breakpoints.scss`, `_variables.scss`, `_reset.scss`, ESLint + Stylelint, Vitest + React Testing Library, configuración de despliegue a GitHub Pages.

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

3. **003 · Motor de asignación de Pokémon** — la función pura que traduce una condición meteorológica en un Pokémon, con su tabla de reglas declarativa y su batería de tests. Se puede cerrar con un puñado de Pokémon de prueba: no hace falta tener la lista completa para dar la feature por hecha, porque ampliarla después es tocar datos, no código.

4. **004 · Mapa de España** — el SVG base con las ciudades y sus sprites, proyección de coordenadas incluida. Primera feature que produce algo que se ve.

5. **005 · Cabecera y leyenda** — título, fecha de previsión y la columna de Pokémon del día con su descripción.

6. **006 · Responsive, accesibilidad y cierre** — solución para móvil (el mapa de 52 ciudades no es legible en 320px y necesita su propia forma), alternativa textual del mapa, atribución a AEMET y disclaimer de Pokémon.

## Decisiones pendientes 🤔

_Bloquean o condicionan alguna de las features de arriba. Ninguna se resuelve por iniciativa de un agente._

- **La lista de Pokémon.** Se irá descubriendo poco a poco. El motor de la 003 está pensado para que ampliarla no toque código.
- **Origen y licencia de los sprites.**
- **Paleta de color.**
- **Alta en meteo.ad.** Se descartó como fuente para Andorra (exige registro manual e IP fija, ver `tech-stack.md`), pero si en algún momento se quiere la fuente oficial en vez de Open-Meteo, el alta la tiene que hacer una persona, no un agente.

## Backlog / ideas 💡

_Sin comprometer ni ordenar. Ideas que respetan la constitución._

- **Histórico de previsiones** — guardar un `forecast.json` por día en vez de sobrescribir. No necesita base de datos: el propio historial de git ya versiona cada día, y un archivo por fecha permitiría navegar hacia atrás.
- **Más de un día de previsión** — AEMET devuelve hasta 7 días en la misma respuesta; hoy solo se usa el primero, así que ampliarlo no cuesta peticiones extra.
- **Optimización SEO** — metadatos, imagen de previsualización para redes (que sería el mapa del día, generado en el mismo pipeline).

> Cada feature nueva se crea como `features/NNN-nombre-feature/` con `NNN-spec.md`, `NNN-plan.md` y `NNN-tasks.md` (número de la feature como prefijo del archivo, no solo de la carpeta) antes de tocar código.
