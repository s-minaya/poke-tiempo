# Misión

_Define la razón de ser del proyecto. Es la referencia que decide si una feature "encaja" o no._

## Qué construimos

**Poketiempo**: la versión web de la cuenta de Instagram del mismo nombre, hecha con permiso de su propietario. Un mapa de la península ibérica que muestra la previsión meteorológica publicada asignando un Pokémon a cada condición, en vez de los iconos habituales de sol y nube. Cada día se publica la previsión del día siguiente (D+1), y la página dice siempre para qué fecha es.

La pantalla es una sola y tiene cuatro piezas:

1. **Título** — "Poketiempo", arriba a la izquierda, con el alfabeto Unown como tipografía (ver `tech-stack.md` → Identidad visual).
2. **Fecha de previsión** — "Previsión (día y mes)", arriba a la derecha.
3. **Leyenda** — bajo el título, en columna: cada Pokémon que aparece en el mapa para la fecha de la previsión, con la condición que representa (caluroso, nuboso, lluvia…).
4. **Mapa** — España (con Baleares, Canarias, Ceuta y Melilla), Portugal y Andorra, dividido por ciudades/islas, con el Pokémon correspondiente sobre cada una según su previsión.

## Para quién

- **Quien mira el tiempo por gusto** — quiere ver de un vistazo qué Pokémon le ha tocado a su ciudad en la previsión publicada. La gracia está en el chiste visual, no en la precisión meteorológica.
- **Quien revisa el portfolio** — reclutadores y perfiles técnicos que van a mirar el código, el repositorio y las decisiones de arquitectura tanto como el resultado.
- **La cuenta original de Instagram** — la web debe respetar la idea que ya funciona ahí, no reinterpretarla.

## Principios

- **La broma se entiende sin explicación** — si alguien necesita leer la leyenda para pillar de qué va, la asignación de Pokémon está mal elegida.
- **Sin backend ni servicios de pago** — el proyecto se sostiene con un repositorio de GitHub y nada más. Cualquier feature que requiera un servidor, una base de datos o una suscripción se replantea.
- **Una sola composición, que se adapta en vez de encogerse** — la identidad es la del post de Instagram original y en escritorio se respeta al pie de la letra: título arriba a la izquierda, previsión arriba a la derecha, leyenda en columna bajo el título, mapa como cuerpo. Pero la web no es una imagen: en pantallas estrechas la composición **se reorganiza** —el mapa pasa a ocupar todo el ancho y la leyenda se coloca donde quepa— en vez de reducirse entera. Nunca existe una versión miniatura del mapa, nunca hace falta zoom manual para leer la interfaz, y ninguna información desaparece por ser una pantalla pequeña: cambia de sitio o de forma. Lo que no cambia en ningún tamaño es la identidad visual (paleta, tipografías, siluetas, sprites) ni lo que el usuario puede saber y hacer.
- **Accesibilidad no es un extra** — la información que da el mapa tiene que estar disponible también en texto, y toda función disponible con el ratón lo está también con el teclado y con el dedo. El listón es **WCAG 2.2 nivel AA**: HTML semántico antes que ARIA, contraste comprobado con números, foco visible, orden de foco lógico, `prefers-reduced-motion`, zoom del navegador al 200 % funcional y áreas táctiles de al menos 24 × 24 px (o su excepción documentada). Los 44 × 44 px son **objetivo de diseño**, no requisito de conformidad. Todo esto es parte de la definición de "hecho", no una ronda posterior.
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
