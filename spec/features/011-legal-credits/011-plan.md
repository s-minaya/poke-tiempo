# 011 · Créditos y disclaimer — Plan

**Estado:** cerrada.

## Enfoque

Hay dos cambios de contenido, sin componentes ni dependencias nuevas:

- La cita de los datos sale del pie y pasa a ir **bajo el mapa**, con los enlaces de Open-Meteo.
- El pie se queda con el crédito de la cuenta original y suma el disclaimer. Se ve igual que antes.

## Implementación

1. **`src/components/SpainMap/SpainMap.tsx`:**
   - El dibujo (`spain-map__viewport`), la tarjeta y la región viva van en un envoltorio, `spain-map__drawing`.
   - Detrás va `<p className="spain-map__attribution">`, con sus dos enlaces (`spain-map__attribution-link`).
2. **`src/components/SpainMap/SpainMap.scss`:**
   - `position: relative` va en `&__drawing`, y no en `.spain-map`, para que la tarjeta se ancle en fracciones del dibujo.
   - `&__attribution` lleva el cuerpo, el tamaño y el color del pie.
   - `&__attribution-link` va subrayado, porque `_reset.scss` quita el subrayado a todos los enlaces. Tampoco se parte: el nombre de la fuente y el de la licencia se leen enteros.
3. **`src/styles/abstracts/_variables.scss`:** `$font-size-note`, el tamaño de letra del pie y de la atribución.
4. **`src/components/Credits/Credits.tsx`:**
   - Lleva la autoría de la cuenta original y el disclaimer.
   - En `Credits.scss`, el tamaño de letra sale de `$font-size-note`, con el mismo valor que antes.
5. **Tests:**
   - `SpainMap.test.tsx`: el texto de la atribución, el destino de los dos enlaces, que no abren otra pestaña y que la atribución va detrás del dibujo, fuera de la caja de la tarjeta.
   - `Credits.test.tsx`: las dos líneas del pie, y que el pie no lleva la cita ni ningún enlace.
6. **`spec/constitution/tech-stack.md`:**
   - En Legal: el disclaimer en su formulación neutral, el requisito de Open-Meteo con su página de licencia y dónde va la cita.
   - En Estilo visual: la atribución bajo el mapa, y la licencia SIL Open Font License 1.1 de Pixelify Sans y Nunito Sans, según su ficha en `github.com/google/fonts` (`ofl/pixelifysans` y `ofl/nunitosans`).
7. **`spec/features/008-responsive-and-accessibility/008-plan.md`:**
   - 1.3.2: la atribución, en el orden del DOM.
   - 2.4.3: los dos enlaces, en el recorrido.
   - 2.4.4: los tres enlaces dicen adónde llevan.
   - 2.4.7: el anillo también se comprueba en los dos enlaces.
   - La frase que dice con qué features está al día la matriz.
8. **`roadmap.md`, `008-spec.md` y `004-spec.md`:** el disclaimer deja de figurar como pendiente.

## Decisiones

- **Una sola atribución, bajo el mapa.**
  - Open-Meteo pide el enlace junto a donde se muestran sus datos.
  - En el pie, la cita quedaba entre 3 y 8 pantallas por debajo del final del mapa: 3.064px a 1600×900 y 7.031px a 390×844, porque la lista de los 74 lugares va antes.
  - El mapa es donde se muestran los datos de todos los lugares a la vez. Bajo él, la atribución queda pegada al mapa en las dos composiciones; en la de dos columnas, también justo encima de la lista.
  - La leyenda, la tarjeta, la lista y Oak muestran ese mismo conjunto de datos, así que una atribución común los cubre sin repetirla en ninguno.
- **Descartadas:**
  - El pie, por lejano.
  - La cabecera: cambia la composición fijada y el alto de cabecera del que sale el tope del mapa.
  - Una superposición sobre el mapa: en mapas estrechos tapa marcadores.
  - Una atribución por lugar, marcador o tarjeta: repetiría el mismo enlace.
- **El tamaño del mapa no cambia.** La atribución va detrás del dibujo. Donde el mapa lo limita el alto, como a 1600×900, queda justo debajo de la primera pantalla.
- **El dibujo y la tarjeta, en su propio envoltorio.** La tarjeta se ancla en fracciones del alto del dibujo. Si la atribución entrara en esa caja de referencia, la desplazaría.
- **Un token para el tamaño de letra.** La atribución lleva el tamaño del pie, que solo existía como literal en `Credits.scss`. `$font-size-note` lo comparten los dos sin repetir el valor. El espaciado usa los mismos valores que los bloques vecinos, `2rem` de margen lateral como la cabecera, la leyenda y el pie: el proyecto no tiene tokens de espaciado.
- **Con «adaptados para el mapa».** Cubre la indicación de cambios que pide la CC BY 4.0, y vale para las tres fuentes: todo se normaliza al vocabulario del dominio y se traduce a Pokémon.
- **El disclaimer, en el pie.** Es un texto sobre el proyecto, no sobre los datos. La portada es una pantalla de título y Oak una escena a pantalla completa, y ninguna lleva texto de ese tipo.
- **Los enlaces se abren en la misma pestaña.** Abrir otra sin avisar es un cambio de contexto que aquí no aporta nada.
- **Subrayado, no color.** El enlace hereda el color del texto, y el subrayado es la señal que no depende del matiz (1.4.1). Al estar dentro de una frase, se acoge a la excepción de tamaño mínimo de 2.5.8.
- **Sin nombres de titulares.** El disclaimer dice lo necesario sin afirmar titularidades concretas, y la constitución se alinea con ese texto.

## Riesgos

- **No está junto a cada pieza que deriva de los datos:** ni junto a la escena de Oak, ni junto a la hoja de la tarjeta en la composición apilada, ni junto a las filas del final de la lista. Es el límite de una atribución común. Va junto al mapa, que es lo que esas piezas cuentan, detallan o listan.
- **Open-Meteo puede cambiar su requisito.** Su página de licencia queda citada en `tech-stack.md` para poder revisarla.

## Verificación

Sobre la build, comparada con la anterior a esta feature:

- **Geometría.** En siete vistas, de 320×640 a 1920×1080, son idénticos el dibujo, su contenedor de consulta, los sprites, las cifras visibles y la posición de la tarjeta respecto a su marcador (A Coruña, Girona, Madrid, Cádiz y Tenerife). Lo que va después del mapa baja lo que mide la atribución, entre 0 y 70px.
- **Atribución.** Empieza justo donde acaba el dibujo y tiene su mismo ancho. Sin recortes, solapes ni scroll horizontal:
  - a 320, 480, 768, 1200 y 1600px;
  - a 1280×1024 al 200 % y al 400 %;
  - en todos los casos, también con el espaciado de 1.4.12.
- **Tabulador.**
  - A 1600×900 y a 390×844, el recorrido va de los marcadores a «Open-Meteo.com» y «CC BY 4.0» y de ahí al buscador; con la tarjeta abierta, pasa antes por su botón de cerrar.
  - En los dos enlaces, el anillo de dos tonos se ve entero y nada lo tapa.
- **Enlaces.** Llevan a `https://open-meteo.com/` y a `https://creativecommons.org/licenses/by/4.0/` (los dos responden 200), en la misma pestaña.
- **Pie.** Calcula los mismos estilos que antes, y sus dos líneas se ven enteras.
