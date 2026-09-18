# 006 · Portada de entrada (Loader + Landing) — Plan

_Cómo se implementa lo descrito en `006-spec.md`. Debe respetar la `constitution/` (mission.md y tech-stack.md)._

## Enfoque

Cambio mínimo sobre lo que ya existe, sin arquitectura nueva:

- `App.tsx` pasa de renderizar directamente la composición a ser un pequeño orquestador de un estado local (`useState`, sin Context ni librería de estado) con cuatro valores: `type EntryStage = 'loading' | 'landing' | 'entering' | 'app'`.
- La composición actual (cabecera + leyenda + mapa + créditos) se extrae tal cual a un nuevo componente `WeatherApp` (mismo JSX y estilos que hoy tiene `App.tsx`/`App.scss`, sin renombrar nada más que el archivo) para que `App.tsx` pueda montarla u ocultarla detrás del loader/portada sin duplicar su lógica.
- `Loader` (ya existe) pasa a ser responsable de su propia precarga: además del spinner visible, monta un `<picture>` oculto (visualmente, no con `display:none`/`hidden`) con las mismas dos fuentes de imagen que usará la portada, y avisa por prop cuando la imagen está lista y ha pasado una duración mínima corta.
- `Landing` (nuevo) es una portada "tonta": cuando se monta, la imagen ya está en caché del navegador (la pidió el `Loader` antes), así que no necesita lógica de carga propia — solo el `<picture>` visible y el botón EMPEZAR.
- Las transiciones son CSS (`opacity` + `transition`/`animation`), sin librería de animación. `prefers-reduced-motion: reduce` anula esas animaciones y transiciones.

## Implementación

1. **Assets** (`src/assets/shared/`): `background-desktop.jpg`, `background-mobile.jpg` (recomprimidos desde los PNG originales, ver Decisiones) y `game-start.mp3`.
2. **`src/components/Loader/Loader.tsx`**: añade prop `onReady: () => void`. Internamente:
   - Renderiza el spinner existente (`loader__pokeball`) sin cambios visuales.
   - Renderiza un `<picture>` oculto visualmente (clase `loader__preload`, `aria-hidden="true"`, sin `display:none` para no arriesgar que el navegador difiera la petición) con `<source media="(max-width: 767px)">` (móvil) e `<img>` por defecto (desktop/tablet).
   - Guarda si la imagen ya está lista (`onLoad`/`onError` del `<img>`, más una comprobación de `img.complete` al montar para el caso de caché) y si ya pasó una duración mínima corta (`setTimeout`, limpiado en el cleanup del `useEffect`).
   - Cuando ambas condiciones se cumplen, llama a `onReady()` una única vez.
3. **`src/components/Landing/Landing.tsx`** (nuevo): recibe `onStart: () => void`. Renderiza:
   - `<picture>` visible con las mismas dos fuentes (`background-mobile.jpg` / `background-desktop.jpg`), `object-fit: cover`, cubriendo el viewport.
   - `<button type="button" className="landing__button">EMPEZAR</button>` — al pulsar, reproduce `game-start.mp3` (`new Audio(...)`, sin librería) y llama a `onStart()`.
   - Animación de entrada propia (fade-in al montar) y una animación discreta del botón para invitar a pulsarlo — ambas ancladas a `prefers-reduced-motion`.
4. **`src/components/WeatherApp/WeatherApp.tsx`** (nuevo, extraído de `App.tsx` sin cambios de comportamiento): recibe `forecast: Forecast` y renderiza exactamente el `<main>` que hoy tiene `App.tsx` (Header, Legend, SpainMap, Credits). `App.scss` se mueve a `WeatherApp.scss` tal cual — se mantiene el bloque BEM `.app` sin renombrar: no hay ninguna razón funcional para tocar el selector, solo cambia de archivo.
5. **`src/App.tsx`**: nuevo componente orquestador.
   - `const [stage, setStage] = useState<EntryStage>('loading')`.
   - `stage === 'loading'` → `<Loader onReady={() => setStage('landing')} />`.
   - `stage === 'landing'` → `<Landing onStart={() => setStage('entering')} leaving={false} />`.
   - `stage === 'entering'` → misma `<Landing>` con `leaving` a `true` (ya no interactivo: `disabled` en el botón, `aria-hidden` en el contenedor) + `<WeatherApp forecast={forecast} />` montada. Un único `useEffect` con `setTimeout` (limpiado en cleanup) pasa a `stage = 'app'` tras la duración de la transición.
   - `stage === 'app'` → solo `<WeatherApp forecast={forecast} />`.
6. **`src/App.scss`**: no hizo falta — `Loader` y `Landing` son overlays `position: fixed; inset: 0;` autosuficientes (con su propio fondo), así que no existe ningún contenedor intermedio que necesite estilos propios. El archivo se eliminó en vez de dejarlo vacío.
7. **Tests**: `Loader.test.tsx` (precarga + `onReady`), `Landing.test.tsx` (renderiza EMPEZAR, dispara `onStart` y el sonido al pulsar), `WeatherApp.test.tsx` (hereda las aserciones que hoy tiene `App.test.tsx`), `App.test.tsx` (el flujo completo: loader visible al inicio, llega a portada cuando la imagen está lista, EMPEZAR lleva a la app, portada no queda montada ni interactiva al terminar).

## Decisiones

- **Imágenes de portada recomprimidas a JPEG, calidad 82** — los PNG originales (`spec/constitution/background-*.png`) pesaban ~860KB/900KB como PNG indexado de 8 bits. Antes de decidir el formato final se comparó visualmente, a resolución 1:1, el PNG original contra el JPEG recomprimido en dos zonas de detalle fino (follaje del árbol, banda de nubes/degradado de cielo): sin diferencia apreciable pese a bajar a ~300KB/310KB — el arte ya usa una paleta reducida estilo Game Boy con bordes suavizados (no píxel duro 1:1), que JPEG comprime bien sin bloques visibles a esta calidad. No se generó una variante WebP: no hay codificador WebP disponible en el entorno sin sumar una dependencia nueva, y con la ganancia ya obtenida solo pasando de PNG a JPEG, añadir un tercer formato de imagen solo para exprimir unos KB más no compensa la complejidad extra de un `<picture>` con doble criterio (formato + dispositivo) — el propio criterio del proyecto para los sprites (`tech-stack.md`) ya prioriza simplicidad sobre el mínimo peso posible.
- **El `Loader` posee la precarga, no `Landing`** — así `Landing` no necesita ningún estado de carga propio: cuando se monta, la imagen ya está en la caché HTTP del navegador (la pidió el `<picture>` oculto del loader), y el nombre `Loader` ya encaja con esa responsabilidad (el propio comentario que traía el componente antes de esta feature ya anticipaba este uso).
- **Corte móvil/desktop en 767/768px** — coincide con `$breakpoint-tablet` de `_breakpoints.scss`. El atributo `media` de `<source>` es HTML, no SCSS, así que no puede importar la variable; se deja un comentario en el código señalando que debe mantenerse igual a `$breakpoint-tablet` si esa variable cambia.
- **`WeatherApp` como extracción, no como refactor más amplio** — se mueve el JSX/SCSS de `App.tsx`/`App.scss` tal cual (bloque BEM `.app` incluido, sin renombrar a `.weather-app`), sin tocar `Header`/`Legend`/`SpainMap`/`Credits`; es el cambio mínimo necesario para que `App.tsx` pueda decidir cuándo montarla.
- **Loader→portada: solo fade-in de la portada** — el spinner del loader desaparece de golpe al desmontarse (sin fade-out propio) porque no arrastra información visual que deba "revelarse" con cuidado; el fondo compartido de loader y portada evita cualquier parpadeo en blanco en el corte. Portada→aplicación sí es un cruce con solape (`stage: 'entering'`) porque ahí sí hay dos composiciones visuales distintas que conviene fundir.
- **Duración mínima del loader y de las transiciones como constantes locales** — no se exponen como props/config: solo hay un consumidor de cada una, así que una constante en el propio archivo es más simple que una prop sin más uso que ese único caso.
- **Colores del `Loader` explícitos, no heredados de `currentColor`** — los tres bordes de la pokéball (anillo, línea divisoria, botón central) fijan `$color-near-black` en vez de depender del color de texto heredado; y el botón central se centra con `top/left/transform` en vez de un desplazamiento fijo (`right`/`bottom`), que lo dejaba ligeramente descuadrado del centro real del círculo.
- **`useEffect` con `setTimeout` limpiado en cleanup, en `Loader` y en `App`** — necesario porque `StrictMode` (activo en `main.tsx`) monta/desmonta cada componente dos veces en desarrollo; sin la limpieza se duplicarían las llamadas a `onReady`/el cambio de stage o quedarían temporizadores huérfanos.
- **`play()` con encadenamiento opcional (`?.catch()`)** — el efecto de sonido es decorativo: si el navegador bloquea el audio o `play()` no devuelve una promesa real, nunca debe impedir que la transición continúe.
