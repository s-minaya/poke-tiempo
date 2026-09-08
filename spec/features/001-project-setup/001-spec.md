# 001 · Setup base del proyecto

**Estado:** implementado ✅

## Qué hace

Deja el repositorio listo para construir features de producto: proyecto Vite + React + TypeScript funcionando en local, con la estructura de carpetas obligatoria, estilos base (breakpoints, variables, reset), linting (ESLint + Stylelint), testing (Vitest + React Testing Library) y el workflow de despliegue a GitHub Pages configurados. No añade ninguna pantalla ni componente de producto.

## Por qué

Es el primer punto de `roadmap.md` ("Siguiente 🔜"): ninguna de las features posteriores (pipeline de datos, motor de Pokémon, mapa, cabecera) tiene dónde vivir sin esta base.

## Criterios de aceptación

- [x] `npm run dev` levanta un servidor local sin errores.
- [x] `npm run build` genera `dist/` sin errores ni warnings de TypeScript.
- [x] `npm run test` ejecuta y pasa (al menos un test de humo).
- [x] `npm run lint` ejecuta ESLint (TS/TSX) y Stylelint (Sass) sin errores.
- [x] Estructura de carpetas obligatoria creada: `src/components/`, `src/domain/`, `src/data/`, `src/styles/abstracts/`, `src/assets/{sprites,map,fonts,shared}/`, `scripts/`.
- [x] `_breakpoints.scss`, `_variables.scss`, `_reset.scss` creados según `constitution/tech-stack.md`.
- [x] `src/test/setup.ts` configurado con `jest-dom`.
- [x] Workflow de GitHub Actions que construye y despliega a GitHub Pages, con `vite.config.ts` → `base` apuntando al subdirectorio real del repositorio (`/poke-tiempo/`). El cambio de **Settings → Pages a modo "GitHub Actions"** es un ajuste manual en GitHub que no se puede hacer desde el repositorio — pendiente de que lo active quien tenga acceso de administración.
- [x] HTML semántico y accesible desde el placeholder inicial (sin contenido de producto que evaluar todavía).
- [x] `.env.example` y `.gitignore` ya existentes se respetan: `AEMET_API_KEY` nunca se commitea.

## Fuera de alcance

- Cualquier componente de producto (mapa, cabecera, leyenda) — features 004/005.
- Script de descarga de AEMET/IPMA/Open-Meteo y workflow diario de datos — feature 002.
- Motor de asignación de Pokémon — feature 003.
- Identidad visual (paleta, tipografía aplicada, sprites) — se define en las features de diseño.
