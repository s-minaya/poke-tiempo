# 008 · Responsive, accesibilidad y cierre

**Estado:** implementado ✅ (parcial — ver "Fuera de alcance")

## Qué hace

La composición (cabecera, leyenda, mapa) es una réplica fija que **escala como una sola unidad** a cualquier tamaño de pantalla, igual que el post de Instagram original (`mission.md` → "Réplica fija, no una app adaptativa"). La cabecera, la leyenda y el mapa mantienen siempre la misma disposición relativa (título arriba a la izquierda, previsión arriba a la derecha, leyenda en columna bajo el título, mapa como cuerpo): lo único que cambia con el tamaño de pantalla es el tamaño de esa composición completa, nunca su forma ni las proporciones entre sus piezas. En pantallas estrechas el usuario hace zoom para leerla; la web nunca fuerza scroll horizontal ni vertical, ni reorganiza el layout en una columna.

Corrige además dos defectos visuales concretos, detectados al comparar con la imagen de referencia real de la cuenta de Instagram:

1. El contexto norteafricano (Marruecos + norte de Argelia) muestra el mismo tipo de línea que delimita el resto de siluetas del mapa (España/Portugal/Andorra/Baleares/Ceuta/Melilla).
2. Ningún `LocationMarker` de los 74 queda completamente tapado por otro — un defecto real de la imagen de referencia original (un Pokémon aparece oculto tras otro) que esta web no reproduce.

## Por qué

Cierra la identidad visual fijada en `mission.md`: la web es una réplica fija de la cuenta de Instagram, no una app que se reorganiza por breakpoint. La legibilidad y la fidelidad a la imagen de referencia dependen de que cabecera, leyenda y mapa escalen siempre juntos y en las mismas proporciones, en vez de que cada componente decida su propio tamaño en cada punto de corte.

## Criterios de aceptación

- [x] La composición completa (cabecera + leyenda + mapa) mantiene la misma disposición relativa — cabecera arriba a todo el ancho, leyenda en columna bajo el título, mapa como cuerpo a la derecha de la leyenda — en los 5 anchos de referencia (320 / 480 / 768 / 1200 / 1600px) y por debajo de ellos. Ninguno reorganiza el layout en una sola columna.
- [x] Ningún tamaño de pantalla produce scroll horizontal ni vertical, ni corta contenido — el conjunto se reduce en pantallas estrechas o bajas en vez de desbordar.
- [x] El tamaño relativo entre cabecera, leyenda y mapa es el mismo a cualquier tamaño — ninguna pieza crece o se reduce de forma independiente a las demás.
- [x] A partir de `$breakpoint-desktop-large` (1600px de ancho, o el equivalente en alto) la composición deja de crecer y queda centrada con el espacio sobrante — no ocupa un ancho o alto ilimitado en monitores muy grandes.
- [x] El contexto norteafricano muestra el mismo trazo (`currentcolor`, mismo grosor) que el resto de siluetas del mapa, sin costura visible en la frontera compartida entre Marruecos y Argelia.
- [x] Ningún `LocationMarker` de los 74 queda completamente oculto por otro, verificado con datos reales.
- [x] La leyenda nunca se extiende por debajo del mapa, sea cual sea el número de Pokémon visibles ese día.
- [x] Ningún test existente de componente se rompe por el cambio de mecanismo de escala.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.

## Fuera de alcance

- **Alternativa textual completa del mapa, atribución visible a AEMET/IPMA/Open-Meteo y disclaimer de Pokémon** — siguen pendientes en `roadmap.md` → 008, pero no forman parte de esta ronda: se abordan en una ampliación posterior de esta misma spec, con su propia confirmación (`AGENTS.md`, paso 4). El nombre accesible por marcador (`role="img"` + `aria-label`, ya implementado en 004/005) ya cubre el criterio de "hecho" de tener la información del mapa también en forma textual a nivel de cada lugar.
- **Auditoría completa de accesibilidad** (foco, contraste exhaustivo, navegación por teclado) — no forma parte de esta ronda.
- **Terminar el bloque 7/8 de la 005** (componente `Credits` + composición final, cierre de esa feature) — es trabajo pendiente de una feature distinta y ya aprobada; no se mezcla aquí.
- **Cambios de contenido**: ninguna regla de `assignPokemon()`, dato de `forecast.json` ni posición geográfica de los 74 lugares cambia.
- **Sistema general de anti-colisión de marcadores** — solo se corregiría un solape real y concreto si apareciera; no existe uno hoy, así que no se construye ningún algoritmo de separación automática para los 74 puntos.
