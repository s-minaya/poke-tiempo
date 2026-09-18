# 008 · Responsive, accesibilidad y cierre — Plan

**Estado:** implementado ✅ (parcial — ver `008-spec.md` → "Fuera de alcance")

## Enfoque

Todo el proyecto ya usa `rem` como unidad por defecto (`tech-stack.md` → convenciones), con el reseteo base `html { font-size: 62.5% }` (1rem = 10px). Esa es la palanca: el tamaño de raíz es **fluido** — proporcional al más restrictivo de ancho y alto del viewport, con un tope fijo (`62.5%`) cuando ninguno de los dos aprieta. Como todo (fuentes, gaps, anchos de columna) está en `rem`, escalar solo la raíz escala la composición completa como una unidad, sin ninguna otra regla de tamaño por breakpoint. Es el equivalente en CSS a escalar una imagen manteniendo proporciones, en los dos ejes.

El grid de `App.scss` es siempre de dos columnas (cabecera arriba a todo el ancho, leyenda + mapa debajo) — nunca se apila en una sola columna, porque la imagen de referencia tampoco lo hace. Los 5 anchos de `AGENTS.md` (320/480/768/1200/1600px) son la verificación obligatoria de que la composición escala sin desbordar y sin reorganizarse.

## Implementación

1. **`src/styles/abstracts/_reset.scss`** — `html { font-size }` con `min()` de tres términos: uno de ancho (`100vw`), uno de alto (`100vh`) y el tope fijo (`62.5%`).
   ```scss
   html {
     font-size: min(calc(100vw / #{$fluid-root-divisor}), calc(100vh / #{$fluid-root-height-divisor}), 62.5%);
   }
   ```
   `$fluid-root-divisor` (160) y `$fluid-root-height-divisor` (95.01) son el ancho y el alto reales de la composición a `$breakpoint-desktop-large` con la raíz a 10px, divididos entre 10 — el punto en el que cada fórmula da exactamente `10px`. El término de alto existe porque el mapa vive en una columna `1fr` del grid, ligada al ancho crudo del viewport y no a la raíz por sí sola: sin él, un viewport ancho pero bajo (un portátil típico) no encogía lo suficiente y Canarias quedaba por debajo del pliegue. Sin mínimo en ninguno de los dos términos: la composición nunca desborda ni fuerza scroll, se reduce.

2. **`src/components/Header/Header.scss`** — título a un único tamaño (`4.8rem`, sin pasos por breakpoint: escala junto con la raíz fluida); línea de previsión a `2.4rem`, con un peso visual comparable al título, como en la imagen de referencia original.

3. **`src/App.scss`** — el grid `app__layout` es una única plantilla:
   ```scss
   grid-template-areas:
     'header header'
     'legend map';
   grid-template-columns: minmax(22rem, 26rem) 1fr;
   max-width: 160rem;
   margin-inline: auto;
   ```
   El `max-width` + `margin-inline: auto` viven en el **contenedor**, no en el mapa por separado: así `1fr` nunca pide más ancho del que el mapa realmente ocupa (160rem − 26rem de columna de leyenda = 134rem) y no queda hueco en blanco a los lados cuando el viewport sobra en ancho o en alto.

4. **`src/components/SpainMap/SpainMap.scss`/`.tsx`**:
   - Sin `max-width` propio en el mapa — el tope de ancho vive en el contenedor (punto 3).
   - El contexto norteafricano (Marruecos + norte de Argelia) lleva el mismo trazo que el resto de territorios (`stroke: currentcolor; stroke-width: 1` sobre `__north-africa-context`) y `fill-opacity: $map-north-africa-opacity` — variable que ya existía en `_variables.scss` desde la 005 pero nunca se había aplicado.
   - La caja del `<svg>` se recorta a la altura real con contenido (`seaBottom`, el punto más bajo de Canarias/el contexto norteafricano), no a `ROOT_VIEW_BOX.height` completo — por debajo de `seaBottom` el `viewBox` solo reserva aire (`BOTTOM_BAND`, 004-plan.md). El recorte usa `aspect-ratio: ROOT_VIEW_BOX.width / seaBottom` más `preserveAspectRatio="xMidYMin slice"` (un recorte de verdad, no un reencuadre que reduzca el mapa) — sin tocar `ROOT_VIEW_BOX` ni ninguna coordenada de `map-geometry.ts`. Es lo que permite que `align-items: stretch` (App.scss) iguale la leyenda a la altura *visible* del mapa, no a la de una caja con aire de más.

5. **`src/components/Legend/Legend.scss`/`.tsx`**:
   - Sprite (`6rem`), etiqueta (`2.2rem`) y encabezado (`3.2rem`) a juego con la escala real del mapa y del título — la leyenda es la referencia visual de cada Pokémon, no una lista discreta de iconos pequeños.
   - `.legend` con `display: flex; flex-direction: column` y `max-height` fija (`$legend-max-height`, la altura real y visible del mapa a `$breakpoint-desktop-large`); `.legend__list` con `flex: 1; min-height: 0; overflow-y: auto`. `align-items: stretch` (App.scss) ya iguala la leyenda a la altura del mapa en el caso normal; el `max-height` es la salvaguarda para un día con más Pokémon visibles de los habituales — la lista desliza dentro de su propio hueco en vez de estirar la fila del grid (y con ella el mapa) por debajo.

6. **Solape de marcadores** — verificado con `forecast.json` real en los 5 anchos (bounding box de cada sprite, solape por pares): ningún `LocationMarker` de los 74 queda completamente tapado por otro. No hizo falta ninguna corrección puntual.

## Decisiones

- **Escalar la raíz (`html { font-size }`) en vez de un `transform: scale()` en un contenedor** — más simple, no necesita un wrapper adicional ni gestionar el alto resultante a mano, y ya es coherente con que todo el proyecto usa `rem` (`tech-stack.md`).
- **1600px (`$breakpoint-desktop-large`) como tamaño de referencia de la escala** — el punto en el que la composición alcanza su tamaño de diseño; por debajo, todo escala en proporción directa.
- **Fórmula fluida con término de alto, no solo de ancho** — el mapa vive en una columna `1fr`, que solo responde al ancho crudo del viewport; sin un término de `100vh`, un viewport ancho pero bajo no encogía lo suficiente y Canarias quedaba por debajo del pliegue.
- **Sin mínimo en la fórmula fluida** — a propósito: el objetivo es que nunca haya scroll, ni siquiera en anchos por debajo de 320px; el "aguantar" del usuario es hacer zoom, no encontrarse una barra de scroll.
- **Tope de ancho en el contenedor del grid (`App.scss`), no en el mapa por separado** — un `max-width` solo en `.spain-map` deja su columna (`1fr`) más ancha que él una vez topado, y al centrarse dentro de ella deja un hueco en blanco a cada lado, sin el azul del mar.
- **Trazo real sobre Marruecos/Argelia, no una línea sintética** — Marruecos y Argelia son dos polígonos de Natural Earth digitalizados por separado, pero su frontera compartida no deja una costura perceptible al trazarla de verdad (comprobado visualmente, coloreando cada polígono por separado para localizar esa frontera) — el mismo `stroke` que el resto de territorios basta y traza la silueta real, no un sustituto.
- **La caja del `<svg>` del mapa se recorta a su contenido visible** — sin esto, `align-items: stretch` iguala la leyenda a una caja que incluye el `BOTTOM_BAND` (aire reservado bajo Canarias), y la leyenda, que sí rellena toda su caja de azul, se ve más larga que el mapa aunque ambas cajas midan lo mismo.
- **Tamaño de leyenda y cabecera fijado a juego con la escala del mapa y con la imagen de referencia** — sprite, etiqueta y encabezado de la leyenda, y la línea de previsión de la cabecera, todos a un tamaño que guarda proporción con el resto de la composición.
- **`max-height` en la leyenda como salvaguarda, con scroll interno** — `align-items: stretch` basta en el caso normal, pero un día con muchos más Pokémon visibles de los habituales podría estirar la fila del grid (y con ella el mapa) por encima de la altura real de este; un tope fijo en `rem`, con la lista desplazándose dentro de su propio hueco, evita ese caso sin depender de cuántos Pokémon aparezcan.
- **El grid de `App.scss` no tiene una plantilla de una columna** — consecuencia directa del principio fijado en `mission.md`: la composición no se reorganiza en móvil, solo se reduce de tamaño.

## Riesgos

- **Legibilidad a tamaños muy reducidos** — al no haber suelo en la escala, a anchos muy estrechos el texto puede volverse difícil de leer sin zoom. Es el comportamiento pedido explícitamente (equivalente a ver una imagen pequeña reducida); se verifica que sigue siendo legible *con* zoom, no a simple vista.
- **`$fluid-root-height-divisor` y `$legend-max-height` son valores medidos, no derivados de un token** — ambos dependen de la altura real y visible del mapa (`seaBottom`) y de la cabecera a `$breakpoint-desktop-large`. Si alguno de los dos cambia de forma sustancial (una cabecera multilínea, una silueta de mapa con otra proporción), hay que remedir ambas constantes con Playwright.
