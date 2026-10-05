/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/poke-tiempo/',
  plugins: [react()],
  test: {
    globals: true,
    // Solo con `npm run test:coverage`. Sin umbrales: de momento es una
    // línea base, no una puerta de CI. Los datos generados (`src/data/`)
    // no son lógica y solo inflarían el porcentaje.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/__fixtures__/**', 'src/test/**', 'src/data/**', '**/*.d.ts'],
      reporter: ['text-summary', 'html'],
    },
    // Un entorno por tipo de test. Los `.test.tsx` montan componentes y
    // necesitan jsdom y jest-dom. Los `.test.ts` son lógica pura —dominio,
    // datos, scripts de build y helpers de componentes— y corren en Node:
    // crear un jsdom por archivo que no lo usa era la mayor parte del tiempo
    // de la suite.
    projects: [
      {
        extends: true,
        test: { name: 'dom', environment: 'jsdom', include: ['src/**/*.test.tsx'], setupFiles: ['./src/test/setup.ts'] },
      },
      {
        extends: true,
        test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
      },
    ],
  },
})
