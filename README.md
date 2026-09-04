# spec/ — Spec Driven Development (Poketiempo)

> Desarrollo dirigido por especificación (SDD) para **Poketiempo**: primero se escribe la spec, luego el plan, luego las tareas, y solo entonces se toca el código. Ver `AGENTS.md` en la raíz del repo para las instrucciones que sigue cualquier agente de IA que trabaje en este proyecto.

## Estructura

```
spec/
├── constitution/            ← reglas estables del proyecto (cambian poco)
│   ├── mission.md           ← qué construimos y para quién
│   ├── tech-stack.md        ← tecnologías, convenciones, identidad visual y límites
│   └── roadmap.md           ← orden de las features
└── features/                ← una carpeta por feature
    ├── _template/           ← plantilla base: copiar para cada feature nueva
    │   ├── spec.md
    │   ├── plan.md
    │   └── tasks.md
    └── NNN-nombre-feature/
        ├── NNN-spec.md      ← qué hace + criterios de aceptación
        ├── NNN-plan.md      ← cómo se implementa
        └── NNN-tasks.md     ← checklist de tareas por bloques
```

## Flujo para una feature nueva

1. Copiar `features/_template/` a `features/NNN-nombre-feature/` con el siguiente número libre (`001`, `002`, …), renombrando los tres archivos con el prefijo `NNN-`.
2. Escribir `NNN-spec.md`: qué hace, por qué y criterios de aceptación medibles (incluye siempre breakpoints y accesibilidad).
3. Escribir `NNN-plan.md`: enfoque técnico y decisiones, respetando `constitution/tech-stack.md` (React + TypeScript, Sass + BEM, mobile-first, sin backend, sin dependencias sin avisar).
4. Desglosar en `NNN-tasks.md` **por bloques** y marcar el progreso, parando al final de cada bloque.
5. Implementar y validar (tests, lint, breakpoints, accesibilidad).
6. Limpiar `NNN-spec.md`/`NNN-plan.md`/`NNN-tasks.md` y los comentarios de código: quitar la narración del proceso (qué dijo el usuario, decisiones revertidas, intentos corregidos) y dejarlos como si el resultado final hubiera estado claro desde el principio — solo se queda anotado un hallazgo importante con impacto más allá de esta feature (ver `AGENTS.md`).
7. Actualizar `constitution/roadmap.md` (mover la feature a "Hecho").

> La constitución manda: si una feature choca con `mission.md` o `tech-stack.md`, se replantea la feature, no la constitución. Si la constitución necesita cambiar, es una decisión explícita y consciente, no un efecto colateral de una feature.
