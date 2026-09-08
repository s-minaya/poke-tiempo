# Tech stack y convenciones

_Cómo está construido el proyecto y las reglas que todo el código debe respetar. Es la referencia técnica que ningún plan de feature debería contradecir._

## Tecnologías

- **Lenguaje:** TypeScript.
- **Framework / runtime:** React. Bundler: Vite.
- **Routing:** no aplica. Poketiempo es una página única; no entra `react-router-dom`.
- **Gestión de estado:** no aplica. Los datos llegan como un JSON estático importado; el único estado de la interfaz es local (`useState`) y vive en el componente que lo necesita. No entra Zustand, Redux ni TanStack Query.
- **Base de datos:** no aplica. Ver "Arquitectura de datos".
- **Tests:** Vitest + React Testing Library con `jsdom`; globals activados y setup en `src/test/setup.ts` (jest-dom).
- **Estilos:** Sass (SCSS) + BEM.
- **Proyección geográfica:** **d3-geo** (solo build) — convierte latitud/longitud a coordenadas del `viewBox` del SVG. Se ejecuta en el script de build, no en runtime: el front recibe las coordenadas ya calculadas.
- **Ejecución de scripts TS en Node:** **tsx** (solo dev).
- **Verificación visual:** **playwright** (solo dev) — navegador headless para comprobar visualmente el mapa cuando el repaso de código y los tests no bastan. No es el framework de tests de la suite habitual (esa es Vitest + RTL).

_Ninguna dependencia se añade sin avisar antes. Al añadirla, se anota aquí con su rol y si es de runtime o solo de desarrollo._

## Arquitectura de datos

**El navegador nunca habla con AEMET, IPMA ni Open-Meteo.** Es la decisión estructural del proyecto y de ella dependen casi todas las demás.

```
cron diario (GitHub Actions)
   → script Node lee AEMET_API_KEY de GitHub Secrets
   → descarga la previsión de los 74 lugares (AEMET / IPMA / Open-Meteo según la zona)
   → normaliza cada fuente al vocabulario propio del dominio y escribe src/data/forecast.json
   → npm run build  (Vite empaqueta el JSON)
   → deploy a GitHub Pages
```

**Tres fuentes, un único `forecast.json` normalizado:**

| Zona | Fuente | Auth | Notas |
|---|---|---|---|
| España (65 lugares) | AEMET OpenData | API key (secret) | Doble llamada, ISO-8859-1, rate limit 50/min |
| Portugal (8 lugares) | IPMA | Sin key | JSON directo por localidad, sin doble llamada |
| Andorra (1 lugar) | Open-Meteo | Sin key (uso no comercial) | Licencia CC BY 4.0; no es la agencia oficial de Andorra — meteo.ad (Servei Meteorològic Nacional) exige alta manual e IP fija, incompatible con un runner efímero de GitHub Actions |

Motivos, para que nadie los reabra por costumbre:

- **La API key de AEMET no puede llegar al cliente.** Está asociada a un correo, tiene caducidad y es la única credencial del proyecto.
- **AEMET usa doble llamada:** la primera petición devuelve una URL temporal en el campo `datos` y hay que hacer una segunda a esa URL. Son 2 peticiones por ciudad.
- **El rate limit de AEMET es de 50 peticiones por minuto y API key**, compartido entre todos los visitantes si se llamara desde el navegador.
- **La respuesta de AEMET viene en ISO-8859-1**, no en UTF-8. Hay que decodificarla explícitamente o las tildes se rompen.
- **Cada fuente tiene su propio vocabulario de estado del cielo/viento** (códigos numéricos de AEMET, códigos de IPMA, WMO weather codes de Open-Meteo) — el script de descarga normaliza los tres al mismo `EstadoCielo`/dominio propio antes de escribir `forecast.json`; el resto de la aplicación no sabe de qué fuente vino cada dato.
- Además, el resultado es idéntico para todos los visitantes y cambia una vez al día: no hay nada que personalizar en runtime.

**Regla derivada:** si una feature futura necesita datos que no están en `forecast.json`, se amplía el script de descarga y el esquema del JSON — nunca se añade una llamada de red desde `src/`.

**Tolerancia a fallos:** un lugar que falla se registra y se continúa, sea cual sea su fuente. Si falla más de un umbral del total, el script sale con error y el workflow **no despliega**, dejando en línea la previsión anterior. Un mapa de ayer es preferible a un mapa roto.

## Archivos / módulos clave

- `src/components/` — componentes reutilizables. Un componente por carpeta, con su `.tsx`, `.scss` y `.test.tsx` del mismo nombre. El `.tsx` importa siempre su propio `.scss`.
- `src/domain/` — lógica pura del proyecto: tipos compartidos y el motor de asignación de Pokémon. Sin React ni DOM. Es lo único que se testea de forma exhaustiva.
- `src/data/` — `capitales.ts` (generado) y `forecast.json` (generado a diario). Ninguno se edita a mano.
- `src/styles/abstracts/` — `_breakpoints.scss`, `_variables.scss`, `_reset.scss` (reseteo base con `font-size: 62.5%`).
- `src/styles/main.scss` — estilos globales.
- `src/test/setup.ts` — setup de Vitest.
- `scripts/` — código que solo se ejecuta en Node (descarga de AEMET, generación de listados, proyección de coordenadas). Nunca se importa desde `src/`.
- `src/assets/` — recursos por tipo de uso: `sprites/`, `map/`, `fonts/`, `shared/`.

## Comandos

- `npm run dev` — entorno local (Vite).
- `npm run test` — tests una vez. `npm run test:watch` para modo watch.
- `npm run lint` — ESLint (TS/TSX, flat config) + Stylelint (Sass).
- `npm run build` — compila para producción (`dist/`). `npm run preview` para previsualizar.
- `npm run fetch:forecast` — descarga la previsión del día de las tres fuentes (AEMET, IPMA, Open-Meteo) y reescribe `src/data/forecast.json`. Necesita `AEMET_API_KEY`.
- `npm run build:capitales` — regenera `src/data/capitales.ts` a partir de la lista fija de 74 lugares (no del maestro completo de municipios de AEMET, que solo cubriría España). Solo hace falta al cambiar la lista de lugares.

## Modelo de datos / dominio

- **Capital** — identificador propio del lugar (código INE de 5 dígitos para España; código de localidad IPMA para Portugal; coordenadas para Andorra, que no tiene identificador de agencia), nombre, latitud, longitud, fuente (`aemet` | `ipma` | `open-meteo`).
- **CiudadPrevision** — lugar + temperatura máxima y mínima, estado de cielo normalizado, descripción literal de la fuente, probabilidad de precipitación y **velocidad del viento en km/h** (dato propio del dominio: AEMET y Open-Meteo la mandan cruda, la clase 1-4 de IPMA se traduce a un equivalente en km/h con los mismos cortes — así el motor de asignación trabaja siempre con el mismo número, sea cual sea la fuente).
- **EstadoCielo** — vocabulario propio cerrado, más rico que el binario nublado/despejado porque cada estado es una ranura para un Pokémon distinto: `despejado`, `poco_nuboso`, `nuboso`, `cubierto`, `niebla`, `calima`, `viento_moderado`, `viento_fuerte`, `lluvia`, `lluvia_barro`, `tormenta`, `nieve`. Cada fuente usa su propio código (AEMET: numéricos con sufijo `n` para la noche, calima = 83; IPMA: `idWeatherType`; Open-Meteo: WMO weather code — sin código propio de calima, así que en Andorra ese estado nunca se detecta) y se traducen por familias, no enumerando cada valor posible, con un caso de respaldo para cualquier código no previsto. `lluvia_barro` no viene de ninguna fuente: es una regla compuesta del motor de asignación (003) que combina lluvia + calima del mismo lugar y día en un único estado, con prioridad sobre elegir uno de los dos por separado.
- **EntradaPokedex** — el Pokémon asignado a una condición: identificador, nombre, etiqueta corta (la que sale en la leyenda) y descripción.
- **Forecast** — el JSON completo: fecha de previsión, momento de generación, fuente y lista de ciudades.

## Convenciones

- **Idioma del código:** todo en **inglés** (variables, funciones, componentes, tipos, nombres de archivo). Comentarios y documentación de `spec/` en **español**.
  - **Excepción deliberada:** los identificadores del dominio meteorológico se escriben en español cuando corresponden a un valor que llega literal de AEMET o que se muestra al usuario (`estadoCielo`, `'poco_nuboso'`). Traducirlos obligaría a mantener un diccionario ida y vuelta sin ganar nada.
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

- Toda lista renderizada con `.map()` que tenga interacción por fila usa callbacks estables (`useCallback`, id como argumento, no capturado en closure) y el componente de fila envuelto en `React.memo`. **Aplica directamente al mapa:** son ~52 marcadores con hover/foco.
- `loading="lazy"` en `<img>` dentro de listas **solo cuando el contenido está por debajo del pliegue**. Los sprites del mapa no lo llevan: están todos visibles en la carga inicial y diferirlos empeoraría la carga percibida. La lista de respaldo en móvil sí lo lleva.
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
- **Unidades:** `rem` por defecto; `px` solo cuando sea técnicamente necesario (p. ej. `1px` de borde). Nada de `em`. Reseteo base con `html { font-size: 62.5%; }` para que `1rem = 10px`.
- **Sin valores hardcodeados:** los breakpoints se definen en `_breakpoints.scss` y se importan; nunca se escribe un `px` de breakpoint en un componente.
- **Sin estilos inline** salvo necesidad justificada (p. ej. un valor dinámico calculado en runtime que no tiene sentido como clase).
- **Modificador BEM que cambia el color de varios elementos hijos: custom properties, no selectores anidados literales.** Stylelint exige kebab-case estricto en cualquier selector de clase escrito con `.`, y un elemento BEM escrito así fuera de la nomenclatura `&__`/`&--` lo rechaza por llevar `__`. Solución: declarar custom properties en el bloque raíz que cada hijo lee con `var(--foo)`, y redefinirlas dentro del modificador.

### Breakpoints (mobile-first, `min-width`)

- `320px` — móvil pequeño (base, sin media query).
- `480px` — móvil normal.
- `768px` — tablet.
- `1200px` — desktop.
- `1600px` — desktop grande.

```scss
// src/styles/abstracts/_breakpoints.scss
$breakpoint-mobile: 480px;
$breakpoint-tablet: 768px;
$breakpoint-desktop: 1200px;
$breakpoint-desktop-large: 1600px;

@mixin respond-from($breakpoint) {
  @media (min-width: $breakpoint) {
    @content;
  }
}
```

## Estilo visual

_Identidad: pixel art, interfaz de Game Boy, Pokédex de primera generación. No una app del tiempo moderna._

- **Composición** (fijada por el usuario): título arriba a la izquierda, fecha de previsión arriba a la derecha, leyenda en columna bajo el título, mapa en el cuerpo.
- **Tipografía del título:** fuente **"Unown"** de MangaShino (FontStruct), licencia **Creative Commons Attribution-ShareAlike 3.0** (CC BY-SA 3.0) — https://fontstruct.com/fontstructions/show/148310. Sin restricción de uso web ni de redistribución del archivo; la única condición es atribución visible al autor y a esa URL de origen, que se añade junto al crédito de AEMET/IPMA/Open-Meteo y el disclaimer de Pokémon. Archivo en `src/assets/fonts/unown/`.
  - _Descartada:_ una fuente "Unown" anterior de "elementcollector1" (misma carpeta, ya sustituida) prohibía explícitamente su uso como webfont (cláusula 2.6 de su EULA) y la redistribución del archivo (2.3).
- **Sprites:** pixel art de una sola generación/estilo, no mezclados. ⚠️ **Origen y licencia pendientes de fijar.** Se descargan al repositorio en un paso de build, no se enlazan en caliente desde un servicio externo.
- **Paleta:** ⚠️ **sin definir.** No inventar colores por libre: se proponen como opciones y se anotan aquí una vez elegidos.
- **Accesibilidad — daltonismo:** ningún significado depende solo del matiz. Cada condición se distingue por su Pokémon y por texto; el mapa debe seguir siendo legible en escala de grises. Cualquier estado que dependa del color (activo, hover, foco) se refuerza con una señal no cromática.

## Legal y atribución

- **Fuentes de datos:** AEMET OpenData (España), IPMA (Portugal) y Open-Meteo (Andorra, CC BY 4.0). Las tres exigen o recomiendan cita visible como autoras/proveedoras — el crédito no es opcional para ninguna, y Open-Meteo pide además enlace a su licencia.
- **Permiso de la cuenta original:** la versión web se hace con permiso del propietario de la cuenta de Instagram Poketiempo.
- **Pokémon:** proyecto de fan sin ánimo de lucro. Disclaimer visible reconociendo que Pokémon es marca registrada de Nintendo / Game Freak / The Pokémon Company, y cero monetización de ningún tipo.
- **Fuentes y sprites:** ninguno entra sin comprobar su licencia y anotarla en este documento.

## Despliegue

**GitHub Pages**, publicado desde GitHub Actions (Settings → Pages en modo "GitHub Actions", no en modo rama).

- `vite.config.ts` necesita `base: '/poketiempo/'` para que las rutas de los assets resuelvan bajo el subdirectorio del repositorio.
- Workflow diario: cron a las 06:00 UTC (la pasada de las 00 UTC de AEMET ya está publicada), más `workflow_dispatch` para poder lanzarlo a mano.
- `AEMET_API_KEY` vive en los secrets del repositorio. En local, en un `.env` ignorado por git.

**Dos mantenimientos conocidos, para que no sorprendan:**

1. **GitHub desactiva los workflows programados tras ~60 días sin actividad en el repositorio.** Si el mapa aparece congelado, mirar aquí primero.
2. **La API key de AEMET caduca** y hay que volver a solicitarla. El script falla de forma ruidosa ante un 401/403 precisamente para que llegue el aviso de workflow fallido por correo en vez de descubrirlo tarde.

## Límites duros

- No llamar a AEMET desde el navegador.
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
