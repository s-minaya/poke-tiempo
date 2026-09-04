# NNN · <Nombre de la feature> — Tareas

_Al copiar esta plantilla, renombra este archivo a `NNN-tasks.md` (con el número real de la feature). Ver `AGENTS.md`._

_Checklist derivada del `NNN-plan.md`, **agrupada en bloques**. Se implementa un bloque, se para y se enseña al usuario antes de pasar al siguiente (ver `AGENTS.md`, paso 5)._

## Bloque 1 — <nombre del bloque>

- [ ] <Tarea concreta de implementación.>
- [ ] <Tarea concreta de implementación.>

## Bloque 2 — <nombre del bloque>

- [ ] <Tarea concreta de implementación.>
- [ ] Tests (Vitest + React Testing Library).

## Bloque 3 — cierre

- [ ] Comprobar los 5 breakpoints (320 / 480 / 768 / 1200 / 1600px).
- [ ] Revisar accesibilidad (semántica, foco, contraste, alternativa textual).
- [ ] Actualizar `constitution/tech-stack.md` si la feature fija una dependencia, una licencia o una decisión técnica nueva.
- [ ] Barrer la narración del proceso de comentarios, `NNN-spec.md`, `NNN-plan.md` y este archivo (`AGENTS.md`, paso 7).
- [ ] Validar contra los criterios de aceptación de `NNN-spec.md`.
- [ ] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.

## Definición de "hecho" (además de los criterios de la spec)

- [ ] Ninguna lista con interacción por fila queda sin memoizar.
- [ ] Los sprites de listas por debajo del pliegue llevan `loading="lazy"`; los del mapa no.
- [ ] Ningún dato nuevo se pide a AEMET en runtime.
- [ ] Ningún valor de espaciado/color nuevo se escribe como literal si ya existe un token para ese valor.
- [ ] Grep de variables SCSS tocadas en esta feature: 0 quedan sin uso.

## Mantenimiento (checklist recurrente)

_Opcional. Pasos a repetir cada vez que se toque esta feature en el futuro (revisar datos, regenerar algo, etc.). Borra esta sección si no aplica._

- [ ] <Acción recurrente.>
