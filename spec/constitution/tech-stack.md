# Tech stack y convenciones

_Cómo está construido el proyecto y las reglas que todo el código debe respetar. Es la referencia técnica que ningún plan de feature debería contradecir._

## Tecnologías

- **Lenguaje:** TypeScript.
- **Framework / runtime:** React. Bundler: Vite.
- **Routing:** no aplica. Poketiempo es una página única; no entra `react-router-dom`.
- **Gestión de estado:** no aplica. Los datos llegan como un JSON estático importado; el único estado de la interfaz es local (`useState`) y vive en el componente que lo necesita. No entra Zustand, Redux ni TanStack Query.
- **Base de datos:** no aplica. Ver "Arquitectura de datos".
- **Tests:** Vitest + React Testing Library; globals activados. Dos entornos según la extensión (`projects` en `vite.config.ts`): los `.test.tsx` montan componentes y corren en `jsdom` con el setup de `src/test/setup.ts` (jest-dom); los `.test.ts` son lógica pura —dominio, datos, scripts y helpers de componentes— y corren en Node, sin DOM.
- **Estilos:** Sass (SCSS) + BEM.
- **Proyección geográfica:** **d3-geo** (solo build) — convierte latitud/longitud a coordenadas del `viewBox` del SVG. Se ejecuta en el script de build, no en runtime: el front recibe las coordenadas ya calculadas.
- **Geometría del mapa (`scripts/config/*.geo.json`):** [Natural Earth](https://www.naturalearthdata.com/) — capas *Admin 0 – Map Subunits* (silueta de España/Portugal/Andorra/Baleares/Ceuta/Melilla/Canarias/Marruecos/Argelia) y *Admin 1 – States/Provinces (lines)* (fronteras internas de comunidad autónoma/distrito), ambas 1:10m, distribuidas en GeoJSON por [martynafford/natural-earth-geojson](https://github.com/martynafford/natural-earth-geojson). **Dominio público** (Natural Earth no exige atribución; el repo de conversión es CC0). Se filtran y redondean una vez y se commitean — no hay descarga en runtime ni en el workflow diario.
- **Redacción de los diálogos del Profesor Oak (007):** **Groq**, capa gratuita, modelo `openai/gpt-oss-120b` por defecto y configurable con `GROQ_MODEL` (que no es secreto). Se llama con el `fetch` de Node desde el workflow diario, sin SDK y sin dependencia nueva: la API es OpenAI-compatible y una sola llamada por generación no la justifica. **Coste operativo obligatorio: 0 €** — nunca se habilita billing, y cualquier `429`, timeout o indisponibilidad cae al fallback local determinista del dominio. La IA no decide ningún hecho: recibe claims ya resueltos y solo pone la voz.
- **Ejecución de scripts TS en Node:** **tsx** (solo dev).
- **Cobertura de tests:** **@vitest/coverage-v8** (solo dev) — proveedor V8 de Vitest, misma versión que Vitest. Sin umbrales obligatorios: es una medida, no una puerta de CI. El informe se genera en `coverage/`, ignorado por git y fuera del deploy.
- **Verificación visual:** **playwright** (solo dev) — navegador headless para comprobar visualmente el mapa cuando el repaso de código y los tests no bastan. No es el framework de tests de la suite habitual (esa es Vitest + RTL).

_Ninguna dependencia se añade sin avisar antes. Al añadirla, se anota aquí con su rol y si es de runtime o solo de desarrollo._

## Arquitectura de datos

**El navegador nunca habla con AEMET, IPMA ni Open-Meteo.** Es la decisión estructural del proyecto y de ella dependen casi todas las demás.

```
cron diario (GitHub Actions)
   → script Node lee AEMET_API_KEY de GitHub Secrets
   → descarga la previsión de los 74 lugares (AEMET / IPMA / Open-Meteo según la zona)
   → normaliza cada fuente al vocabulario propio del dominio y escribe src/data/forecast.json
   → genera los diálogos del día (dominio puro → claims → Groq o fallback local)
     y escribe src/data/oak-today.json y src/data/oak-history.json
   → npm run build  (Vite empaqueta los JSON)
   → deploy a GitHub Pages
```

**El navegador tampoco habla con la IA.** Vale lo mismo que para la meteorología: la generación de los diálogos ocurre en el runner, la clave vive en los secrets y lo que llega al bundle es un JSON ya escrito.

**Tres fuentes, un único `forecast.json` normalizado:**

| Zona | Fuente | Auth | Notas |
|---|---|---|---|
| España (65 lugares) | AEMET OpenData | API key (secret) | Doble llamada, ISO-8859-1, rate limit 50/min |
| Portugal (8 lugares) | IPMA | Sin key | JSON directo por localidad, sin doble llamada |
| Andorra (1 lugar) | Open-Meteo | Sin key (uso no comercial) | Licencia CC BY 4.0; no es la agencia oficial de Andorra — meteo.ad (Servei Meteorològic Nacional) exige alta manual e IP fija, incompatible con un runner efímero de GitHub Actions |

Motivos, para que nadie los reabra por costumbre:

- **La API key de AEMET no puede llegar al cliente.** Está asociada a un correo, tiene caducidad y es una credencial del proveedor meteorológico.
- **AEMET usa doble llamada:** la primera petición devuelve una URL temporal en el campo `datos` y hay que hacer una segunda a esa URL. Son 2 peticiones por ciudad.
- **El rate limit de AEMET es de 50 peticiones por minuto y API key**, compartido entre todos los visitantes si se llamara desde el navegador.
- **La respuesta de AEMET viene en ISO-8859-1**, no en UTF-8. Hay que decodificarla explícitamente o las tildes se rompen.
- **Cada fuente tiene su propio vocabulario de estado del cielo/viento** (códigos numéricos de AEMET, códigos de IPMA, WMO weather codes de Open-Meteo) — el script de descarga normaliza los tres al mismo `SkyCondition`/dominio propio antes de escribir `forecast.json`; el resto de la aplicación no sabe de qué fuente vino cada dato.
- Además, el resultado es idéntico para todos los visitantes y cambia una vez al día: no hay nada que personalizar en runtime.

**Regla derivada:** si una feature futura necesita datos que no están en `forecast.json`, se amplía el script de descarga y el esquema del JSON — nunca se añade una llamada de red desde `src/`.

**Tolerancia a fallos:** el contrato de la [002](../features/002-weather-data-pipeline/002-spec.md) exige los 74 lugares completos y con algún Pokémon asignable tras el fallback meteorológico. Los errores de autenticación/configuración no se enmascaran con ese fallback. El fallo sistémico de una fuente complementaria (>50% de sus lugares dependientes) es una condición de aborto independiente. Si no se cumplen estas condiciones, no se sobrescribe la previsión ni se despliega una nueva.

**Referencia temporal:** `Europe/Madrid` es la referencia temporal canónica. El pipeline fija `forecast.date` como el día siguiente al de la ejecución en Madrid (D+1); la página decide con ese mismo calendario si la previsión está al día, y muestra la hora de generación en hora peninsular. Los días se cuentan como días de calendario (`src/domain/madrid-calendar.ts`), nunca dividiendo milisegundos, para que los días de 23 y 25 horas del cambio de hora no alteren el resultado.

## Archivos / módulos clave

- `src/components/` — componentes reutilizables. Un componente por carpeta, con su `.tsx`, `.scss` y `.test.tsx` del mismo nombre. El `.tsx` importa siempre su propio `.scss`.
- `src/domain/` — lógica pura del proyecto: tipos compartidos, el motor de asignación de Pokémon, el criterio editorial del mapa (`map-priority.ts`, `pokemon-labels.ts`, `pokemon-names.ts`, `location-views.ts`, `alerts.ts`) y el dominio narrativo de Oak (`oak/`). Sin React ni DOM. Es lo único que se testea de forma exhaustiva.
- `src/data/` — `locations.ts` (generado), `forecast.json` (generado a diario) y los dos JSON de Oak: `oak-today.json` (los 3 diálogos del día) y `oak-history.json` (solo IDs y categorías, una entrada por fecha, para la continuidad narrativa). Ninguno se edita a mano.
- `src/styles/abstracts/` — `_breakpoints.scss` (los dos puntos de corte y el umbral del mapa), `_variables.scss` (paleta, capas y tipografía), `_reset.scss` (reseteo base, raíz fija `62.5%` y anillo de foco de dos tonos) y `_accessibility.scss` (el mixin `visually-hidden`, sin salida CSS propia: `_reset.scss` no puede alojar mixins, porque cada componente que lo usara volvería a emitir el reseteo) — ver "Composición y puntos de corte".
- `src/styles/main.scss` — estilos globales.
- `src/test/setup.ts` — setup de Vitest.
- `scripts/` — código que solo se ejecuta en Node (descarga de AEMET, generación de listados, proyección de coordenadas). Nunca se importa desde `src/`.
- `src/assets/` — recursos por tipo de uso: `sprites/`, `map/`, `fonts/`, `oak/`, `shared/`.

## Comandos

- `npm run dev` — entorno local (Vite).
- `npm run test` — tests una vez. `npm run test:watch` para modo watch. `npm run test:coverage` — la suite con informe de cobertura (V8) en `coverage/`.
- `npm run lint` — ESLint (TS/TSX, flat config) + Stylelint (Sass).
- `npm run build` — compila para producción (`dist/`). `npm run preview` para previsualizar.
- `npm run fetch:forecast` — descarga la previsión de D+1 (`targetDate`, respecto a `Europe/Madrid`) de las tres fuentes (AEMET, IPMA, Open-Meteo) y reescribe `src/data/forecast.json`. Necesita `AEMET_API_KEY`.
- `npm run generate:oak` — regenera `src/data/oak-today.json` y `src/data/oak-history.json` a partir del `forecast.json` actual. Sin `GROQ_API_KEY` funciona igual y publica el fallback local: es el camino normal en desarrollo.
- `npm run build:locations` — regenera `src/data/locations.ts` a partir de la lista fija de 74 lugares (no del maestro completo de municipios de AEMET, que solo cubriría España). Solo hace falta al cambiar la lista de lugares. Necesita `AEMET_API_KEY`: resuelve el identificador de cada lugar en el maestro de municipios de AEMET y en la lista de localidades de IPMA.

## Modelo de datos / dominio

El contrato meteorológico (ejes simultáneos, provenance por fuente principal + complementaria, semántica `null` vs `false`/`0`, avisos oficiales) vive en [002-plan.md](../features/002-weather-data-pipeline/002-plan.md). El modelo de lugares incorpora además `administrativeArea` en la [008](../features/008-responsive-and-accessibility/008-plan.md) y `zone` en la [009](../features/009-location-explorer/009-plan.md); los tipos implementados están en `src/domain/types.ts`. Cada ampliación se documenta en su feature, sin duplicar aquí el esquema completo. Resumen de alto nivel, siempre en inglés como nombres estructurales (`Location`, `LocationForecast`, `SkyCondition`, `Temperature`, `Precipitation`, `Snow`, `Wind`, `Marine`, `OfficialAlert`...) y con los valores literales del vocabulario meteorológico en español cuando vienen tal cual de una fuente (`'poco_nuboso'`, `'despejado'`) — ver la excepción en "Convenciones":

- **`Location`** — identidad del lugar (id, nombre, país, área administrativa, zona de exploración, coordenadas, huso horario, fuente principal, si es costero). No lleva datos meteorológicos.
- **`LocationForecast`** — un lugar + un día, con cada eje meteorológico (temperatura, cielo, precipitación, nieve, viento, tormenta, calima, niebla, mar, avisos) como campo independiente y nullable — nunca un único valor que los colapse todos. Se llama `LocationForecast`, no `CityForecast`, porque varios de los 74 lugares son regiones (Cantabria, La Rioja, País Vasco), no ciudades.
- **`PokedexEntry`** — el Pokémon asignado a una condición: identificador, nombre, etiqueta corta (la que sale en la leyenda) y descripción.
- **`Forecast`** — el JSON completo: fecha de previsión, momento de generación, lista de `LocationForecast` y metadata de cobertura (lugares totales/con éxito/fallidos).

## Convenciones

- **Idioma del código:** todo en **inglés** (variables, funciones, componentes, tipos, nombres de archivo). Comentarios y documentación de `spec/` en **español**.
  - **Excepción deliberada:** los **valores literales** del dominio meteorológico se escriben en español cuando corresponden a un valor que llega tal cual de una fuente o que se muestra al usuario (`'poco_nuboso'`, `'despejado'`). Los nombres estructurales (tipos, interfaces, campos, funciones) van siempre en inglés — `skyCondition: SkyCondition`, nunca `estadoCielo: EstadoCielo`. Traducir los valores obligaría a mantener un diccionario ida y vuelta sin ganar nada; los nombres estructurales no tienen ese problema.
- **Nombrado de archivos:** componentes React en **PascalCase**; funciones, hooks y utilidades en **camelCase**; archivos de estilos con el mismo nombre que el componente que estilan.
- **Componentes:** siempre `function` (function declarations), no `class` ni arrow-function-const salvo excepción justificada.
- **Tipos:** `interface` para formas de objeto, `type` para uniones y alias. Los tipos del dominio viven en `src/domain/`, no duplicados por componente. `import type` para importaciones que solo se usan como tipo.
- **Renderizado condicional:** los componentes que no están en uso se desmontan del DOM, no se ocultan con `display: none`.
- **Tests:** junto al componente (`ComponentName.test.tsx` al lado de `ComponentName.tsx`). Nunca agrupados en una carpeta global `tests/`.
- **Manejo de errores:** fallar de forma visible y controlada, nunca en silencio. En el dominio, preferir un caso de respaldo explícito a lanzar una excepción: un código de cielo desconocido no debe tumbar el mapa entero.
- **Commits:** en inglés, Conventional Commits, presente e imperativo.
- **Assets:** nombres en inglés, minúsculas, `kebab-case`. Evitar sufijos como `final`, `new`, `copy`, `v2`.
- **Orden de imports:** externas → tipos → hooks y utilidades → componentes → datos → assets → estilos del componente.

## Convenciones de rendimiento (React)

- Toda lista renderizada con `.map()` que tenga interacción por fila usa callbacks estables (`useCallback`, id como argumento, no capturado en closure) y el componente de fila envuelto en `React.memo`. **Aplica directamente al mapa:** son 74 marcadores con hover/foco.
- `loading="lazy"` en `<img>` dentro de listas **solo cuando el contenido está por debajo del pliegue**. Los sprites de la lista de lugares lo llevan: queda por debajo del pliegue en las dos composiciones. Los del mapa no, porque están a la vista en la carga inicial; y los de la leyenda tampoco, porque son los mismos archivos que ya pinta el mapa —la leyenda solo muestra Pokémon que salen hoy en él—, así que diferirlos no ahorra ninguna descarga.
- Ningún cálculo derivado (`filter`/`sort`/`map` sobre los datos) va sin `useMemo` si el componente se re-renderiza por motivos ajenos a ese cálculo.

## Convenciones de variables SCSS

- Antes de crear una variable nueva, comprobar si ya existe una con ese valor exacto en `_variables.scss` — no duplicar colores/tamaños.
- Ningún valor de espaciado (`padding`/`margin`/`gap`) se escribe como literal si ya existe un token `$space-*` con ese valor; si no existe y se repite en más de un archivo, se propone como token nuevo antes de copiarlo por tercera vez.
- Una variable sin ningún consumidor real (grep de 0 usos) se elimina en el mismo PR que la deja huérfana.

### CSS / Sass — metodología

- **Sass (SCSS) + BEM**, un único enfoque. Sin CSS Modules ni styled-components.
- Nomenclatura BEM: bloque `.component-name`, elemento `.component-name__part`, modificador `.component-name--variant`.
- Un `.scss` por componente, junto a su `.tsx`, con el bloque BEM como selector raíz y elementos/modificadores anidados (`&__part`, `&--variant`).
- **El `.scss` se importa siempre desde su `.tsx`.** Sin ese import, Vite no lo incluye en el bundle y el componente se queda sin ninguna regla propia, sin error ni warning: es un fallo silencioso.
- **Unidades:** `rem` por defecto, sobre una raíz fija `html { font-size: 62.5%; }`: `1rem` son 10px con la base de 16px que traen los navegadores, y proporcionalmente más si el usuario la sube. La raíz no depende del viewport (ver "Composición y puntos de corte"). Excepciones, cada una con su motivo:
  - **`em`** en lo que debe pesar lo mismo respecto a su glifo sea cual sea el tamaño: el halo del texto de mood (`$mood-text-halo`), el espaciado entre letras, el relleno, el borde y el radio del botón de la portada, y las piezas del bocadillo de Oak que se miden en líneas de su propio texto.
  - **`px`** en los suelos duros, que no pueden depender de la base del navegador (`max(19px, …)` en el texto de cabecera y leyenda, `min-height: 48px` en EMPEZAR); en la portada y la escena del Profesor Oak, que dimensionan con `clamp()` entre un mínimo en `px` y un término en `vw`; en los bordes finos; y en `$map-temperature-threshold`, que mide una caja y no texto.
- **Sin valores hardcodeados:** los breakpoints se definen en `_breakpoints.scss` y se importan; nunca se escribe un `px` de breakpoint en un componente.
- **Sin estilos inline** salvo necesidad justificada (p. ej. un valor dinámico calculado en runtime que no tiene sentido como clase).
- **Modificador BEM que cambia el color de varios elementos hijos: custom properties, no selectores anidados literales.** Stylelint exige kebab-case estricto en cualquier selector de clase escrito con `.`, y un elemento BEM escrito así fuera de la nomenclatura `&__`/`&--` lo rechaza por llevar `__`. Solución: declarar custom properties en el bloque raíz que cada hijo lee con `var(--foo)`, y redefinirlas dentro del modificador.

### Composición y puntos de corte

**La composición se reorganiza en vez de escalarse entera** (`mission.md` → "Una sola composición, que se adapta en vez de encogerse"). Dos plantillas de grid de `<main>` sobre las mismas áreas nombradas (`WeatherApp.scss`): apilada por debajo de `$breakpoint-desktop` —cabecera, mapa a todo el ancho, leyenda y lista— y de dos columnas a partir de ahí —cabecera arriba, leyenda en columna junto al mapa y lista en una banda debajo—. En la de dos columnas, la leyenda mide lo que el mapa, con la atribución de los datos que lleva debajo, y sus entradas se reparten ese alto con el aire entre ellas; solo si ni juntas caben, sobresale y la lista empieza tras ella. El tope de alto del mapa es el 80 % de la ventana en la apilada, y en la de dos columnas, la ventana menos la cabecera, para que el mapa entero quepa en la primera pantalla. Los créditos, fuera de `<main>`, quedan al final de la página en las dos. A partir de `$breakpoint-desktop-large` la composición deja de crecer y queda centrada. `$breakpoint-tablet` no decide maquetación: solo qué ilustración de portada se sirve. Las temperaturas del mapa aparecen con `@container` sobre la propia caja del mapa, no sobre el viewport: el mismo mapa mide distinto en cada composición.

No llevan punto de corte, a propósito: el número de columnas de leyenda y lista (`auto-fit` + `minmax`), el tamaño del mapa (el menor de su ancho y su alto disponibles), la tipografía (`clamp()`) y la orientación. Ninguna decisión de maquetación se toma en JS a partir del viewport, la orientación o el dispositivo. Motivos y medidas en `features/008-responsive-and-accessibility/008-plan.md`.

```scss
// src/styles/abstracts/_breakpoints.scss
$breakpoint-tablet: 768px; // solo el <picture> de la portada
$breakpoint-desktop: 1200px; // apilado → dos columnas
$breakpoint-desktop-large: 1600px; // tope de la composición
$map-temperature-threshold: 1063px; // @container sobre la caja del mapa

@mixin respond-from($breakpoint) {
  @media (min-width: $breakpoint) {
    @content;
  }
}
```

## Estilo visual

_Identidad: pixel art, interfaz de Game Boy, Pokédex de primera generación. No una app del tiempo moderna._

- **Composición** (fijada por el usuario): título arriba a la izquierda, fecha de previsión arriba a la derecha, leyenda en columna bajo el título, mapa en el cuerpo, con la atribución de los datos justo debajo; la lista de los 74 lugares, en una banda debajo, y los créditos, un pie simple al final de la página. Es la composición de dos columnas; en pantallas estrechas se apila —mapa a todo el ancho, y leyenda, lista y créditos debajo— (ver "Composición y puntos de corte").
- **Tipografía del título:** **"Poketiempo Unown"**, fuente propia construida para el proyecto — no un archivo de terceros. Se vectorizó cada letra A–Z a partir de imágenes de referencia del alfabeto Unown con `potrace` y se compiló a `.woff2`/`.ttf` con `opentype.js`/`wawoff2` (herramientas de build, ninguna se añade como dependencia de la app) — las imágenes de referencia eran solo entrada de ese proceso puntual, no se conservan en el repositorio. Como el propio glifo reproduce el diseño de Unown, queda cubierto por el mismo disclaimer de Pokémon que los sprites (fan project, sin monetización) — no hay licencia de fuente de terceros que anotar. Archivos en `src/assets/fonts/` (`poketiempo-unown.woff2` para web, `.ttf` de respaldo).
  - _Descartadas:_ dos fuentes "Unown" de terceros (MangaShino/FontStruct, CC BY-SA 3.0; y "elementcollector1", que prohibía explícitamente su uso como webfont) — sustituidas por la vectorización propia porque ninguna reproducía el trazo original con suficiente fidelidad.
- **Tipografía de la interfaz:** **Pixelify Sans** (`$font-heading`) y **Nunito Sans** (`$font-body`), servidas desde Google Fonts (`index.html`). Las dos tienen licencia **SIL Open Font License 1.1**, según su ficha en el repositorio oficial de Google Fonts (`github.com/google/fonts`: `ofl/pixelifysans` y `ofl/nunitosans`).
- **Sprites:** pixel art de una sola generación/estilo, no mezclados. Redimensionados a 160px de lado máximo (el tamaño real de render en el mapa, 004, es muy inferior) y servidos como PNG indexado — comparado contra WebP sobre el mismo redimensionado, PNG queda por debajo en peso para este conjunto de sprites, así que WebP no entra. Se sirven desde el repositorio (`src/assets/sprites/`), no en caliente desde un servicio externo, y los originales de alta resolución no se commitean. ⚠️ **Origen y licencia pendientes de fijar.**
- **Retratos del Profesor Oak** (`src/assets/oak/`): seis poses ilustradas, **WebP con alfa** (calidad 0,9, plano alfa sin pérdida). Es el caso contrario al de los sprites: son ilustraciones grandes con degradados, donde WebP baja a un tercio del PNG sin diferencia visible, mientras que en los sprites pixel art indexados ganaba PNG. El formato se elige midiendo cada conjunto, no por norma general.
- **Favicon** (`public/favicon-32.png` y `public/favicon-192.png`): ilustración propia del proyecto, dibujada en Procreate —una Poké Ball con el sol y las nubes, sobre un cuadrado azul redondeado—, no un archivo de terceros. Como reproduce el diseño de la Poké Ball, queda cubierto por el mismo disclaimer de Pokémon que los sprites (fan project, sin monetización). Transparente fuera del cuadrado, en PNG indexado: a este tamaño la paleta aplana el grano del original sin diferencia visible. En `public/` porque `index.html` lo pide por ruta fija; el original de alta resolución no se commitea.
- **Paleta:** dos sistemas de color, centralizados en `src/styles/abstracts/_variables.scss` — un hex repetido en más de un sitio usa una única variable, nunca dos con el mismo valor (ver "Convenciones de variables SCSS" más abajo):
  - **Significado meteorológico** (005): el mar y los territorios del mapa, el mood térmico de la previsión y de las etiquetas de la leyenda, y las franjas de temperatura de las cifras del mapa. Ningún control lo usa.
  - **Interfaz** (009): tres colores de la paleta de pokemon.com para lo que se escribe, se pulsa o se elige, y para el título y «Leyenda». Ninguno repite un color que ya significa algo.

  | Uso | Valor | Variable |
  |---|---|---|
  | Mar (cabecera, leyenda, mapa) | `#B9FFFD` | `$map-sea` |
  | España, Baleares, Ceuta, Melilla, Canarias | `#FFEBF6` | `$map-spain` |
  | Portugal | `#F6FFEC` | `$map-portugal` |
  | Andorra | `#FFF3B0` | `$map-andorra` |
  | Contexto norteafricano (Marruecos/Argelia) | mismo que España, opacidad `0.5` | `$map-spain` + `$map-north-africa-opacity` |
  | Marco de Canarias | `#42C7EC` | `$color-sky-blue` |
  | Mood térmico "gelid" (< 0°C) | relleno `#3F6FE0` / borde `#163989` | `$header-mood-gelid` / `-border` |
  | Mood térmico "cold" (0–<10°C) | relleno `#42C7EC` (`$color-sky-blue`) / borde `#10809F` | `$header-mood-cold-border` |
  | Mood térmico "neutral" (10–<26°C) | relleno `#09E230` (`$color-green`) / borde `#046716` | `$header-mood-neutral-border` |
  | Mood térmico "heat" (26–<35°C) | relleno `#EB6B59` / borde `#AF2815` | `$header-mood-heat` / `-border` |
  | Mood térmico "sweltering" (>= 35°C) | relleno `#E54343` / borde `#941414` | `$header-mood-sweltering-fill` / `-border` |
  | Temperatura de marcador "freezing" (< 0°C) | relleno blanco, borde `#7B2CBF` | `$marker-temp-freezing-stroke` |
  | Temperatura de marcador "cool" (0–<10°C) | `#848DEE`, sin borde | `$marker-temp-cool` |
  | Temperatura de marcador "mild" (10–20°C) | relleno blanco, borde `#09E230` (`$color-green`) | — |
  | Temperatura de marcador "pleasant" (21–25°C) | relleno `#09E230` (`$color-green`), borde blanco | — |
  | Temperatura de marcador "hot" (26–34°C) | `#E53935`, borde `#FFD54F` | `$marker-temp-hot` / `-stroke` |
  | Temperatura de marcador "scorching" (>= 35°C) | `#9B1C31`, borde `#C69214` | `$marker-temp-scorching` / `-stroke` |
  | Interfaz: texto, bordes de campos y controles, banda de la lista, insignias de recuento y «Leyenda» | `#323232` | `$ui-ink` |
  | Interfaz: superficie de la zona de controles y de los encabezados de grupo | `#F5F5F5` | `$ui-surface` |
  | Interfaz: lo elegido y el hover de los controles, y el título POKETIEMPO | `#1B53BA` | `$ui-accent` |
  | Portada: relleno de EMPEZAR, con texto blanco (12,56:1). Color de identidad decidido por el usuario, ni del tiempo ni de estado | `#0F3A32` | `$landing-button-fill` |

  Los tonos de borde de mood son el mismo matiz que su relleno, un 25% más oscuro (HSL, mismo h/s, `-0.25` de lightness), y son el halo de la previsión y de las etiquetas de la leyenda. El título y «Leyenda» no llevan color de mood: van sin halo en `$ui-accent` y `$ui-ink` (008).

  De la paleta de pokemon.com se descartan `#2F2F2F` (la misma tinta), `#30A7D7` (el celeste del mood frío), `#B89355` (el trazo de 35° o más), `#B32A0A` y `#FD7D24` (calor, y niveles de aviso de AEMET) y `#734BB2` (el trazo bajo cero): repiten un color que ya significa algo. Detalle y contrastes medidos en `features/009-location-explorer/009-plan.md` → Paleta de interfaz y Contrastes medidos.
- **Estados de los controles** (009): reposo, blanco con borde `$ui-ink`; hover, el control toma `$ui-accent` sin rellenarse; elegido, `$ui-accent` con una señal que no es color (▸, ✓, ✕ o una barra); foco, el anillo de dos tonos de `_reset.scss`, igual en toda la app y nunca azul.
- **Accesibilidad — daltonismo:** ningún significado depende solo del matiz. Cada condición se distingue por su Pokémon y por texto; el mapa debe seguir siendo legible en escala de grises. Cualquier estado que dependa del color (activo, hover, foco) se refuerza con una señal no cromática.

## Legal y atribución

- **Fuentes de datos:** AEMET OpenData (España), IPMA (Portugal) y Open-Meteo (Andorra, CC BY 4.0). Las tres exigen o recomiendan cita visible como autoras/proveedoras — el crédito no es opcional para ninguna, y Open-Meteo pide además enlazar su web y su licencia, indicar si los datos se han cambiado y poner el enlace junto a donde se muestran sus datos (`https://open-meteo.com/en/licence`). La cita va en una sola atribución, justo bajo el mapa (`SpainMap`).
- **Permiso de la cuenta original:** la versión web se hace con permiso del propietario de la cuenta de Instagram Poketiempo.
- **Pokémon:** proyecto de fan sin ánimo de lucro. Disclaimer visible que deja claro que PokéTiempo es un proyecto fan no oficial, sin afiliación ni patrocinio de los titulares de los derechos de Pokémon, y que Pokémon, sus personajes y sus nombres pertenecen a sus respectivos titulares; va en el pie de la página. Y cero monetización de ningún tipo.
- **Fuentes y sprites:** ninguno entra sin comprobar su licencia y anotarla en este documento.

## Despliegue

**GitHub Pages**, publicado desde GitHub Actions (Settings → Pages en modo "GitHub Actions", no en modo rama).

- `vite.config.ts` necesita `base: '/poke-tiempo/'` para que las rutas de los assets resuelvan bajo el subdirectorio del repositorio (nombre real: `github.com/s-minaya/poke-tiempo`).
- Workflow diario: cron configurado `0 6 * * *` (06:00 UTC; 07:00 en invierno y 08:00 en verano en `Europe/Madrid`), más `workflow_dispatch` manual. Es la hora programada, no una garantía de inicio o publicación: [GitHub Actions puede retrasar o descartar ejecuciones programadas bajo carga](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). La hora efectiva se consulta en cada run. El workflow también se dispara por push a `main`; en ese caso construye y despliega los datos versionados, sin ejecutar la generación diaria.
- `AEMET_API_KEY` y `GROQ_API_KEY` viven en los secrets del repositorio. En local, en un `.env` ignorado por git. Nunca como `VITE_*`: eso las metería en el bundle. La de Groq, además, puede faltar sin consecuencias — el paso se ejecuta igual y publica el fallback local.

**Dos mantenimientos conocidos, para que no sorprendan:**

1. **GitHub desactiva los workflows programados tras ~60 días sin actividad en el repositorio.** Si el mapa aparece congelado, mirar aquí primero.
2. **La API key de AEMET caduca** y hay que volver a solicitarla. El script falla de forma ruidosa ante un 401/403 precisamente para que llegue el aviso de workflow fallido por correo en vez de descubrirlo tarde.

## Baseline de compilación y navegadores

Con Vite 8.2.2 y sin `build.target` personalizado, el target por defecto es `baseline-widely-available`: Chrome 111, Edge 111, Firefox 114 y Safari/iOS 16.4. Es un objetivo de transformación del build, no una matriz de soporte de Poketiempo ni una provisión automática de polyfills ([guía de Vite](https://vite.dev/guide/build.html)). La compatibilidad de las APIs y del CSS usados, incluidos `inert` y las consultas de contenedor, requiere verificación en los navegadores que se decida soportar. Las comprobaciones manuales registradas en 008/009 no fijan por sí solas esa política de soporte.

## Límites duros

- No llamar a AEMET desde el navegador.
- No llamar a ningún proveedor de IA desde el navegador, ni exponer su clave o su modelo al bundle.
- No monetizar ni habilitar billing en el proveedor de IA: el coste operativo del proyecto es 0 €.
- No dejar que la IA decida ningún dato: redacta afirmaciones ya resueltas por el dominio, y lo que devuelve se valida antes de publicarse.
- No subir `.env*` ni credenciales al repositorio.
- No añadir dependencias nuevas sin avisar antes.
- No `display: none` para ocultar componentes que no están en uso — se desmontan del DOM.
- No hardcodear valores de `px` de breakpoints en componentes.
- No estilos inline salvo necesidad justificada y documentada.
- No mezclar metodologías de estilos.
- No crear un `.scss` de componente sin importarlo desde su `.tsx`.
- No incorporar una fuente o un sprite sin comprobar licencia y anotarla aquí.
- No comunicar significado solo mediante el color.
- No monetizar el proyecto de ninguna forma.
