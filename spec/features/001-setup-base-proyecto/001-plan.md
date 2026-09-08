# 001 · Setup base del proyecto — Plan

## Enfoque

Scaffolding estándar de Vite (plantilla `react-ts`), ajustado desde el primer commit a las convenciones de `constitution/tech-stack.md`: Sass + BEM, mobile-first con breakpoints propios, ESLint flat config + Stylelint, Vitest + RTL con `jsdom`. No hay decisiones de producto en esta feature — solo infraestructura.

## Implementación

1. Scaffold base con Vite (plantilla `react-ts`).
2. `vite.config.ts` — `base` apuntando al subdirectorio del repositorio en GitHub Pages.
3. Estructura de carpetas obligatoria (vacía salvo lo mínimo): `src/components/`, `src/domain/`, `src/data/`, `src/styles/abstracts/`, `src/assets/{sprites,map,fonts,shared}/`, `scripts/`.
4. `src/styles/abstracts/_breakpoints.scss` — mixin `respond-from` y las 4 variables de breakpoint, tal cual `tech-stack.md`.
5. `src/styles/abstracts/_variables.scss` — vacío/placeholder; se rellena en las features que fijen paleta y espaciados.
6. `src/styles/abstracts/_reset.scss` — reseteo base con `font-size: 62.5%`.
7. `src/styles/main.scss` — importa abstracts y reset.
8. ESLint (flat config, TS/TSX) + Stylelint (Sass) — configuración estándar, sin reglas custom más allá de lo ya fijado.
9. Vitest + RTL: `jsdom`, `globals` activados, `src/test/setup.ts` con `jest-dom`.
10. Un test de humo (renderiza `App` sin errores) para validar que el pipeline de test funciona.
11. `.github/workflows/deploy.yml` — build + deploy a GitHub Pages en cada push a `main`. Sin cron todavía (eso llega con la 002).
12. `package.json` — scripts `dev`, `test`, `test:watch`, `lint`, `build`, `preview` de `tech-stack.md` → Comandos. `fetch:forecast` y `build:capitales` no se añaden aquí: son de la 002.

## Decisiones

- **Sin dependencias más allá de las ya fijadas** en `tech-stack.md` (React, Vite, Sass, Vitest, RTL, ESLint, Stylelint). Nada nuevo sin avisar antes.
- **`App.tsx` queda como placeholder mínimo**, sin identidad visual — esta feature no toca diseño.

## Riesgos

- **`base` de Vite debe coincidir con el nombre real del repositorio en GitHub** — si no, las rutas de assets se rompen al desplegar. Se confirma contra el repositorio real antes de dar la feature por cerrada.
- **Stylelint con BEM estricto desde el primer componente** — evita arrastrar deuda de nomenclatura más adelante.
