# 001 · Setup base del proyecto — Tareas

## Bloque 1 — Scaffold y estructura de carpetas

- [x] Inicializar Vite + React + TypeScript.
- [x] `vite.config.ts` con `base` correcto para GitHub Pages.
- [x] Crear estructura de carpetas obligatoria: `src/components/`, `src/domain/`, `src/data/`, `src/styles/abstracts/`, `src/assets/{sprites,map,fonts,shared}/`, `scripts/`.

## Bloque 2 — Estilos base

- [x] `_breakpoints.scss` con el mixin `respond-from` y las 4 variables.
- [x] `_variables.scss` (placeholder).
- [x] `_reset.scss` con `font-size: 62.5%`.
- [x] `main.scss` importando abstracts y reset.

## Bloque 3 — Calidad: lint y tests

- [x] ESLint flat config (TS/TSX).
- [x] Stylelint (Sass).
- [x] Vitest + RTL configurado (`jsdom`, `globals`, `src/test/setup.ts` con `jest-dom`).
- [x] Test de humo (`App` renderiza sin errores).

## Bloque 4 — Despliegue y cierre

- [x] `package.json` con los scripts de `tech-stack.md` → Comandos.
- [x] Workflow de GitHub Actions: build + deploy a GitHub Pages.
- [x] Comprobar los 5 breakpoints (320/480/768/1200/1600px) sobre el placeholder.
- [x] Barrer la narración del proceso de comentarios y de `001-spec.md`/`001-plan.md`/este archivo.
- [x] Validar contra los criterios de aceptación de `001-spec.md`.
- [x] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.

## Definición de "hecho" (además de los criterios de la spec)

- [x] Ningún dato nuevo se pide a AEMET/IPMA/Open-Meteo en runtime.
- [x] Ningún valor de espaciado/color nuevo se escribe como literal si ya existe un token para ese valor.
- [ ] Grep de variables SCSS tocadas en esta feature: 0 quedan sin uso. **Excepción documentada:** las 4 variables de `_breakpoints.scss` no tienen consumidor todavía — es infraestructura mandatada por `tech-stack.md` (mixin `respond-from`), a la espera de su primer componente responsive en una feature posterior. No es deuda de esta feature.
