# 011 · Créditos y disclaimer

**Estado:** cerrada.

## Qué hace

- **Bajo el mapa**, en las dos composiciones, una sola línea de atribución de los datos: «Datos meteorológicos: AEMET · IPMA · Open-Meteo.com (CC BY 4.0), adaptados para el mapa.» «Open-Meteo.com» enlaza a `https://open-meteo.com/` y «CC BY 4.0», a `https://creativecommons.org/licenses/by/4.0/`.
- **El pie de la página**, al final, se queda con dos líneas:
  1. «PokéTiempo original: Gabriel Ortega Díaz», como hasta ahora.
  2. El disclaimer: «PokéTiempo es un proyecto fan no oficial, sin afiliación ni patrocinio de los titulares de los derechos de Pokémon. Pokémon, sus personajes y sus nombres pertenecen a sus respectivos titulares.»

Los dos enlaces se distinguen del texto por el subrayado, no por el color.

## Por qué

`tech-stack.md` → Legal exige un disclaimer de Pokémon visible y la cita de las tres fuentes de datos. La página de licencia de Open-Meteo (`https://open-meteo.com/en/licence`) pide además:

- enlazar la licencia CC BY 4.0;
- indicar si los datos se han cambiado;
- incluir un enlace «next to any location Open-Meteo data are displayed».

Por eso la cita de los datos va junto al mapa y no en el pie. El pie queda después de los 74 lugares, entre 3 y 8 pantallas por debajo del final del mapa.

## Criterios de aceptación

- [x] La atribución va justo debajo del dibujo del mapa, alineada con su caja, en las dos composiciones y con el texto exacto.
- [x] «Open-Meteo.com» lleva a `https://open-meteo.com/` y «CC BY 4.0» a `https://creativecommons.org/licenses/by/4.0/`, en la misma pestaña.
- [x] Los dos enlaces van subrayados. Con el foco, muestran el anillo de dos tonos de `_reset.scss`.
- [x] La atribución usa el cuerpo, el tamaño y el color del pie.
- [x] El pie muestra sus dos líneas, y sus estilos no cambian.
- [x] El tamaño del mapa no cambia, y la tarjeta anclada queda en el mismo sitio respecto a su marcador.
- [x] En las 5 anchuras de verificación (320 / 480 / 768 / 1200 / 1600px), al 200 % y al 400 % y con el espaciado de texto de 1.4.12, ni la atribución ni el pie recortan texto ni provocan scroll horizontal.
- [x] Con el tabulador, los dos enlaces van después de los marcadores, y del botón de cerrar si la tarjeta está abierta, y antes del buscador. Muestran el anillo y no quedan tapados.
- [x] Ni la página ni la documentación añaden nombres de empresa, símbolos ® o ™ ni fórmulas jurídicas.
- [x] Las filas de la matriz WCAG de `008-plan.md` sobre los enlaces y el orden del DOM y del foco dicen la verdad.
- [x] `tech-stack.md` describe el disclaimer sin nombrar titulares concretos, dice dónde va la cita de los datos y anota la licencia de Pixelify Sans y Nunito Sans comprobada en su fuente oficial.

## Fuera de alcance

- Una atribución por lugar, por marcador o en la tarjeta.
- El origen y la licencia de los sprites, los retratos de Oak, las ilustraciones de portada y los sonidos.
- Una licencia para el código.
- El disclaimer en la portada o en la escena de Oak.
- Retirar `opentype.js` de las dependencias.
- El README, que tendrá su propia versión del disclaimer.
- Cambiar cómo se cargan las fuentes de Google.
