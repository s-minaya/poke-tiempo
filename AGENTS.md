# AGENTS.md

_Instrucciones para cualquier agente de IA (Copilot, Cursor, Claude, OpenCode, etc.) que trabaje en este repositorio: **Poketiempo**, el mapa meteorológico de España con Pokémon._

## Regla de oro

Este proyecto sigue **Spec Driven Development**. Ningún código se escribe sin que exista antes su `NNN-spec.md` → `NNN-plan.md` → `NNN-tasks.md` dentro de `spec/features/NNN-nombre-feature/`.

**Nombrado de archivos:** dentro de cada carpeta de feature, los tres archivos llevan el número de la feature como prefijo — `001-spec.md`, `001-plan.md`, `001-tasks.md`, `002-spec.md`, etc. — igual que la propia carpeta (`NNN-nombre-feature/`). Nunca `spec.md`/`plan.md`/`tasks.md` a secas (esos nombres solo existen sin prefijo dentro de `spec/features/_template/`, que se renombran al copiar).

**Nombrado de la carpeta:** `NNN-nombre-feature/` en inglés, kebab-case, descriptivo de qué hace la feature.

Antes de tocar código, el agente debe:

1. Leer `spec/constitution/mission.md`, `spec/constitution/tech-stack.md` y `spec/constitution/roadmap.md`.
2. Comprobar si existe una carpeta de feature relevante en `spec/features/`. Si no existe, crearla a partir de `spec/features/_template/` con el siguiente número disponible, renombrando los archivos con el prefijo `NNN-` — pero dejando el contenido tal cual la plantilla (los placeholders `<...>` sin rellenar).
3. **No diseñar la feature por libre.** Rellenar `NNN-spec.md`/`NNN-plan.md` con contenido real (qué hace, enfoque técnico, decisiones de arquitectura/UX) requiere haber recibido antes indicaciones concretas del usuario sobre cómo la quiere — no inventar el diseño ni proponerlo ya redactado como si fuera la dirección a seguir. Si el usuario da la orden de crear la feature sin más detalle, la carpeta se crea vacía (paso 2) y se le pregunta qué tiene en mente antes de rellenar nada.
4. Con esa dirección ya dada, rellenar `NNN-spec.md` y `NNN-plan.md` y enseñárselos al usuario. **Nunca se empieza a escribir código sin su confirmación explícita** — un "sí, adelante" (o equivalente) a esa spec/plan concretos. Esto aplica siempre, también cuando se **rediseña o amplía** una spec ya aprobada anteriormente: la confirmación de la versión anterior no cubre la nueva.
5. Dividir `NNN-tasks.md` en **bloques** (agrupaciones lógicas de tareas relacionadas, no una lista plana). Se implementa un bloque, se para, y se enseña al usuario lo hecho para que lo confirme **antes de pasar al siguiente bloque**.
6. Si una petición choca con la constitución (`mission.md` o `tech-stack.md`), señalarlo y proponer replantear la feature — no romper la constitución en silencio.
7. **Antes de dar una feature por cerrada** (o moverla a "Hecho" en `roadmap.md`), barrer `NNN-spec.md`/`NNN-plan.md`/`NNN-tasks.md` y los comentarios de código de cualquier narración del proceso (ver regla de comentarios más abajo). Es normal que se haya ido acumulando mientras la feature estaba en marcha — este paso es una limpieza real, no una simple comprobación. Lo único que se queda anotado es un hallazgo con impacto más allá de esta feature, redactado como hecho técnico final, sin narrar cómo se llegó a él.

## Stack

- **React + TypeScript.**
- **Vite** como bundler.
- **Sass (SCSS) + BEM** como única metodología de estilos — nada de CSS Modules ni styled-components.
- **Vitest + React Testing Library** para tests, colocados junto al componente.
- **Sin backend, sin base de datos y sin gestor de estado.** Los datos son un JSON estático generado en CI.
- **Página única.** No hay routing.
- Detalle completo, comandos exactos y estructura de carpetas en `spec/constitution/tech-stack.md` — esa es la fuente de verdad, no este resumen.

## Convenciones de código (resumen — ver tech-stack.md para el detalle)

- Código (variables, funciones, componentes, tipos, nombres de archivo) **en inglés**. Comentarios y toda la documentación de `spec/` **en español**.
- **Excepción deliberada:** los **valores literales** del dominio meteorológico y de Pokémon se escriben en español cuando corresponden a un valor que llega tal cual de una fuente o que se muestra al usuario (`'despejado'`, `'poco_nuboso'`). Los nombres estructurales (tipos, interfaces, campos, funciones) van siempre en inglés — `skyCondition: SkyCondition`, nunca `estadoCielo: EstadoCielo`. Traducir los valores a inglés obligaría a mantener un diccionario ida y vuelta sin ganar nada; los nombres estructurales no tienen ese problema.
- Componentes React: **PascalCase**, siempre `function`, un componente = una responsabilidad. Cuando un componente supera aproximadamente 150–200 líneas de JSX y lógica combinadas, evaluar dividirlo antes de seguir ampliándolo.
- Funciones y hooks: **camelCase**, nombre descriptivo de qué hacen.
- Componentes no usados se **desmontan del DOM** (renderizado condicional), nunca `display: none`.
- **Comentarios (código y `spec.md`/`plan.md`) en su versión final una vez cerrada la feature.** Mientras la feature está en marcha sí pueden narrar el proceso; al cerrarla (paso 7) se barre y se reescribe como si el resultado final hubiera estado claro desde el principio. Aplica también al eliminar código: un comentario que explicaba algo que ya no existe se borra o se reescribe entero, no se deja a medias.
- No añadir dependencias nuevas sin avisar explícitamente antes de instalarlas.
- **Exportaciones:** No crear archivos `index.ts` o `index.tsx` para reexportar componentes.

Correcto:

```ts
import CityMarker from '../components/CityMarker/CityMarker';
```

Incorrecto:

```ts
import CityMarker from '../components/CityMarker';
```

### Orden de imports

Dentro de cada archivo `.tsx`, mantener este orden:

1. Librerías externas (`react`, etc.).
2. Tipos (`import type ...`).
3. Hooks y utilidades.
4. Componentes.
5. Datos (`src/data`).
6. Assets (`src/assets`).
7. Estilos (`./Component.scss`) siempre al final.

## Estructura de carpetas (obligatoria)

### Componentes reutilizables

`src/components/` contiene únicamente componentes reutilizables en varios sitios o pertenecientes al sistema de diseño.

```text
src/components/
  CityMarker/
    CityMarker.tsx
    CityMarker.scss
    CityMarker.test.tsx
```

**Reglas**

- Un componente = una carpeta.
- El archivo `.tsx`, `.scss` y `.test.tsx` tienen el mismo nombre.
- El `.tsx` importa siempre su propio `.scss`.
- No mezclar varios componentes distintos en un mismo archivo.
- Al ser una página única, no existe `src/pages/`. Un componente que hoy solo se usa dentro de otro y no es candidato a reutilización vive dentro de la carpeta de su componente padre (`SpainMap/components/`).

### Dominio

`src/domain/` contiene la lógica pura del proyecto: tipos compartidos y el motor de asignación de Pokémon. **Sin dependencias de React ni de DOM**, para que sea testeable en aislamiento y reutilizable desde los scripts de build.

### Scripts de build

`scripts/` contiene los scripts que solo se ejecutan en Node (descarga de datos de AEMET, generación de listados). **Nunca se importan desde `src/`**: son código de build, no de runtime.

### Assets

```text
src/assets/
  sprites/     ← sprites de Pokémon
  map/         ← SVG base del mapa
  fonts/
  shared/
```

**Reglas**

- Nunca una carpeta `images/` con archivos mezclados.
- Nombres en inglés, minúsculas, `kebab-case`. Evitar sufijos como `final`, `new`, `copy`, `v2`.

## Commits

En inglés, siguiendo **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `style:`, `test:`, `docs:`, `chore:`. Presente e imperativo. Ejemplo: `feat: add pokemon assignment engine`.

Los commits automáticos del workflow diario usan `chore(datos):` y los firma el bot, no la persona.

## Identidad visual

Concepto: **pixel art / interfaz de Game Boy**. La referencia es la Pokédex y los menús de los juegos de primera generación, no una app del tiempo moderna.

- **Tipografía del título:** la tipografía de símbolos de Pokémon (pendiente de fijar el archivo concreto y su licencia — ver `tech-stack.md`).
- **Sprites:** pixel art, coherentes entre sí (una sola generación/estilo, no mezclados).
- **Composición fijada por el usuario:** título "Poketiempo" arriba a la izquierda; "Previsión (día y mes)" arriba a la derecha; leyenda en columna bajo el título, con un Pokémon por condición y su descripción; el mapa de España ocupa el cuerpo de la página.
- El resto de la identidad (paleta, texturas, tratamiento del mapa) **está sin definir**. Un agente no la inventa: la propone como opciones y espera decisión.

## Testing

- Vitest + React Testing Library para componentes.
- Toda feature nueva incluye al menos un test de renderizado y, si aplica, de interacción.
- **El motor de asignación de Pokémon (`src/domain/`) se testea de forma exhaustiva y table-driven** (`it.each`): límites de cada franja de temperatura, prioridad entre reglas y el caso de respaldo. Es la lógica propia del proyecto; el resto es presentación.
- El renderizado condicional se testea comprobando que el nodo no está en el DOM, no que está oculto.

## Límites duros (no negociables)

**Del proyecto:**

- **Nunca llamar a la API de AEMET desde el navegador.** La key iría en el bundle y el rate limit se comparte entre todos los visitantes. Los datos se descargan en CI y se sirven como JSON estático.
- **No subir `.env*` ni la API key** al repositorio, ni pegarla en ningún archivo de `spec/`.
- **Citar a AEMET como fuente** de forma visible: su licencia de reutilización lo exige.
- **Disclaimer de Pokémon visible** y cero monetización: sin anuncios, sin donaciones, sin tienda. Es un proyecto de portfolio sin ánimo de lucro.
- **No incorporar una fuente o un sprite sin comprobar su licencia** y anotarla en `tech-stack.md`.

**De código:**

- No dependencias nuevas sin avisar.
- No `display: none` para componentes no usados — desmontar del DOM.
- No `px` hardcodeado para breakpoints.
- No estilos inline salvo justificación.
- No mezclar metodologías de estilos.
- **No comunicar significado solo mediante el color** — cada condición meteorológica se distingue por su Pokémon y por texto, nunca solo por un tono. El mapa debe seguir siendo legible en escala de grises.
- No diseñar/rellenar el `spec.md`/`plan.md` de una feature nueva por libre.
- No empezar a implementar sin confirmación explícita del usuario sobre la spec/plan concreta.
- No encadenar bloques de `tasks.md` sin parar a que el usuario confirme cada bloque.
- No dejar narración del proceso en comentarios ni en `spec.md`/`plan.md`/`tasks.md` al cerrar una feature.

## Definición de "hecho" (además de los criterios de la spec)

- [ ] Funciona en los 5 breakpoints (320 / 480 / 768 / 1200 / 1600px).
- [ ] La información del mapa está disponible también en forma textual accesible.
- [ ] Ningún valor de espaciado/color nuevo se escribe como literal si ya existe un token para ese valor.
- [ ] Grep de variables SCSS tocadas en esta feature: 0 quedan sin uso.
- [ ] Ninguna lista con interacción por fila queda sin memoizar.
- [ ] Los sprites de la lista de respaldo en móvil llevan `loading="lazy"`; los del mapa **no** (están por encima del pliegue).
- [ ] Ningún dato nuevo se pide a AEMET en runtime.

## Despliegue

**GitHub Pages**, publicado desde GitHub Actions (no desde una rama). El workflow diario descarga la previsión, construye y despliega. Detalle en `spec/constitution/tech-stack.md` → Despliegue.
