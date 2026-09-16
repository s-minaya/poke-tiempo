# Misión

_Define la razón de ser del proyecto. Es la referencia que decide si una feature "encaja" o no._

## Qué construimos

**Poketiempo**: la versión web de la cuenta de Instagram del mismo nombre, hecha con permiso de su propietario. Un mapa de la península ibérica que muestra la previsión meteorológica del día asignando un Pokémon a cada condición, en vez de los iconos habituales de sol y nube.

La pantalla es una sola y tiene cuatro piezas:

1. **Título** — "Poketiempo", arriba a la izquierda, con la tipografía de símbolos de Pokémon.
2. **Fecha de previsión** — "Previsión (día y mes)", arriba a la derecha.
3. **Leyenda** — bajo el título, en columna: cada Pokémon que aparece hoy en el mapa, con la condición que representa (caluroso, nuboso, lluvia…).
4. **Mapa** — España (con Baleares y Canarias) y Portugal, dividido por ciudades/islas, con el Pokémon correspondiente sobre cada una según su previsión.

## Para quién

- **Quien mira el tiempo por gusto** — quiere ver de un vistazo qué Pokémon le ha tocado hoy a su ciudad. La gracia está en el chiste visual, no en la precisión meteorológica.
- **Quien revisa el portfolio** — reclutadores y perfiles técnicos que van a mirar el código, el repositorio y las decisiones de arquitectura tanto como el resultado.
- **La cuenta original de Instagram** — la web debe respetar la idea que ya funciona ahí, no reinterpretarla.

## Principios

- **La broma se entiende sin explicación** — si alguien necesita leer la leyenda para pillar de qué va, la asignación de Pokémon está mal elegida.
- **Sin backend ni servicios de pago** — el proyecto se sostiene con un repositorio de GitHub y nada más. Cualquier feature que requiera un servidor, una base de datos o una suscripción se replantea.
- **Réplica fija, no una app adaptativa** — la composición (cabecera, leyenda, mapa, créditos) es la misma a cualquier tamaño de pantalla, igual que el post de Instagram original: escala como una sola unidad, sin una reorganización de layout distinta para móvil. En pantallas pequeñas el usuario hace zoom para leerla, igual que haría con la imagen del post — no existe una versión "miniatura" del mapa.
- **Accesibilidad no es un extra** — la información que da el mapa tiene que estar disponible también en texto. HTML semántico, contraste, foco visible y alternativas textuales son parte de la definición de "hecho".
- **Sobriedad técnica** — sin dependencias innecesarias, sin overengineering. Es un mapa con imágenes, no una aplicación compleja: si una librería no resuelve un problema real que ya existe, no entra.
- **Mantenible por humanos** — componentes con una responsabilidad, nombres descriptivos, lógica de dominio separada de la presentación.

## Cobertura geográfica

El mapa cubre **74 lugares** fijados a partir de la cuenta original de Instagram, con tres fuentes de datos distintas — cada zona con la agencia meteorológica que le corresponde, salvo Andorra:

| Zona | Lugares | Fuente |
|---|---|---|
| España (peninsular + Baleares + Canarias + Ceuta/Melilla) | 65 | AEMET |
| Portugal | 8 | IPMA |
| Andorra | 1 | Open-Meteo (CC BY 4.0) — Andorra no publica una API pública de autoservicio; ver `tech-stack.md` |

No es una capital por provincia de forma sistemática: hay provincias con varios puntos (zonas de montaña, interés turístico) y otras agrupadas en uno solo (País Vasco). La lista exacta de los 74 nombres vive en `roadmap.md` → feature 002.

## Qué NO es

- **No es un servicio meteorológico.** No compite con AEMET/IPMA ni pretende ser preciso: las fuentes se citan de forma visible, pero la lectura es un chiste visual.
- **No tiene ánimo de lucro.** Sin anuncios, sin donaciones, sin tienda, sin tracking. Es un proyecto de portfolio y de fan.
- **No es una app con cuentas de usuario, favoritos ni notificaciones.**
- **No busca todos los municipios de España, distritos de Portugal ni parroquias de Andorra.** Una selección de 74 lugares legible en un mapa, no la cobertura completa de cada fuente.
- **No es multi-idioma.** Solo español: el contenido es meteorología ibérica y los textos que llegan en otro idioma (IPMA en portugués) se normalizan al vocabulario propio del dominio.
- **No incluye backend, base de datos ni CMS.**
