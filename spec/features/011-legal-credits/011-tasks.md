# 011 · Créditos y disclaimer — Tareas

**Estado.** Implementada; falta la comprobación en producción tras el push.

## Bloque 1 — Atribución, pie y tests

- [x] `SpainMap.tsx` y `SpainMap.scss`: el envoltorio del dibujo y la atribución bajo el mapa (`011-plan.md`, pasos 1 y 2).
- [x] `_variables.scss`: `$font-size-note`, compartido por el pie y la atribución.
- [x] `Credits.tsx`: sale la cita de los datos y entra el disclaimer.
- [x] `SpainMap.test.tsx` y `Credits.test.tsx`.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.
- [x] Sobre la build local, los criterios de `011-spec.md`:
  - contenido y destinos;
  - subrayado y foco;
  - tamaño del mapa y anclaje de la tarjeta;
  - el recorrido del tabulador;
  - las 5 anchuras, 200 % y 400 %, y el espaciado de 1.4.12.

## Bloque 2 — Documentación

- [x] `tech-stack.md`: Legal y Estilo visual (`011-plan.md`, paso 6).
- [x] `008-plan.md`: las filas 1.3.2, 2.4.3, 2.4.4 y 2.4.7, y la frase sobre con qué features está al día la matriz.

## Bloque 3 — Cierre

- [x] `008-spec.md` y `004-spec.md`: el disclaimer, en la 011.
- [x] `roadmap.md`: la 011 en «Siguiente», pendiente de la comprobación en producción, y el disclaimer fuera de «Decisiones pendientes».
- [x] Barrer la narración del proceso de comentarios y de los tres archivos de la 011 (`AGENTS.md`, paso 7).
- [x] Validar contra los criterios de aceptación de `011-spec.md`.
- [ ] Tras el push autorizado: el despliegue en verde, y en producción, la atribución bajo el mapa, el pie con sus dos líneas y los dos enlaces con su destino.
- [ ] Con la comprobación en producción hecha: la 011 en «Hecho» en `roadmap.md` y su estado, cerrada.

## Definición de "hecho"

- [x] La atribución usa los mismos tokens que el pie (`$font-body`, `$font-size-note` y `$ui-ink`): ningún color ni tamaño se escribe como literal.
