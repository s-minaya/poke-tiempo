# Comparaciones contra las publicaciones de Gabriel

Un Markdown por `forecast.date`, nunca un log único acumulativo — para poder
acumular evidencia de varios días sin mezclar actualizaciones distintas de
AEMET/IPMA/Open-Meteo entre sí. Copiar `_template.md` a `YYYY-MM-DD.md` (la
fecha es `forecast.date`, no la fecha en la que se escribe el archivo).

**Protocolo** (ver `spec/features/003-pokemon-assignment-engine/003-plan.md`
→ "Hipótesis provisional de prioridad"): solo cuenta como comparación válida
un `forecast.json` generado el día `D` con `targetDate = D+1`, ya commiteado
por el pipeline (workflow diario o un fetch manual equivalente) — nunca una
previsión reconstruida en vivo un día después o más tarde. Cada archivo
referencia el commit que contiene ese `forecast.json` por su SHA en vez de
copiar los 74 `LocationForecast`: el snapshot meteorológico ya vive versionado
ahí, este archivo solo guarda el resultado de la comparación.

**Snapshot canónico cuando hay varios runs exitosos el mismo día `D`:**

- Siempre se compara la publicación de `D+1` contra un forecast generado en `D`.
- Si hubo más de un run programado exitoso en `D` para el mismo `targetDate`
  (p. ej. un `workflow_dispatch` manual seguido del `schedule` normal), el
  **canónico** es el último run programado exitoso que quedó realmente
  desplegado — nunca el primero solo porque llegó antes.
- Los demás runs exitosos de ese mismo día/`targetDate` se registran como
  **snapshots alternativos**, sin mezclarlos en la comparación principal. Solo
  se usan aparte, si una discrepancia concreta parece deberse a volatilidad de
  la fuente entre esos dos instantes — nunca junto al canónico en la misma
  tabla.

Ejemplo ya resuelto: para `targetDate: "2026-09-15"` hubo dos runs exitosos el
14 — `99dd6de` (07:10Z, `workflow_dispatch` manual) y `8f3d773` (11:13Z,
`schedule`, el que quedó desplegado). `8f3d773` es el canónico de la
comparación del 15; `99dd6de` queda como alternativo.

## Inventario histórico completo

Recorrido de **todos** los commits que han tocado `src/data/forecast.json`
en el historial completo de `main` (`git log --all --follow`, 5 commits en
total — no hay otras ramas ni remotos adicionales). Sin llamadas a
AEMET/IPMA/Open-Meteo, sin reconstrucciones: solo lectura de lo ya
commiteado. Un snapshot cuenta como **válido** para comparar con Gabriel
únicamente si cumple los cuatro criterios a la vez: `forecast.date` es la
víspera+1 de `generatedAt` en Europe/Madrid (D→D+1), `totalLocations===74`,
`successfulLocations===74` y `failedLocations` vacío.

| `forecast.date` | `generatedAt` | Commit | 74/74 | D→D+1 | Estado | Canónico/alternativo |
|---|---|---|---|---|---|---|
| 2026-09-09 | 2026-09-09T07:44:36.811Z | `1f52a60` | ❌ (69/74, faltan cantabria/lleida/valladolid/merida/ceuta) | ❌ (mismo día calendario en Europe/Madrid: generado y fechado el 09-09) | **inválido — forecast del mismo día + incompleto** | no aplica |
| 2026-09-11 | 2026-09-10T08:03:35.999Z | `0126e91` | ✅ | ✅ | **válido** | canónico (único) |
| 2026-09-13 | — | — | — | — | **missing** | — |
| 2026-09-14 | — | — | — | — | **missing** | — |
| 2026-09-15 | 2026-09-14T07:10:34.798Z | `99dd6de` | ✅ | ✅ | **válido** | alternativo (run anterior, `workflow_dispatch`, no desplegado) |
| 2026-09-15 | 2026-09-14T11:13:50.295Z | `8f3d773` | ✅ | ✅ | **válido** | **canónico** (`schedule`, el que quedó desplegado) |
| 2026-09-16 | 2026-09-15T07:07:16.102Z | `4da10bc` | ✅ | ✅ | **válido** | canónico (único) |

**Hallazgo nuevo: `1f52a60` (2026-09-09), el primer `forecast.json` que
existió en el repo, es inválido por partida doble** — se generó y fecha el
mismo día calendario (sin patrón D→D+1: `computeTargetDate` como se conoce
hoy no estaba terminado en ese commit) y además le faltan 5 de los 74
lugares (cantabria, lleida, valladolid, merida, ceuta), fruto del desarrollo
en curso de la 002 en ese momento. No es utilizable como snapshot de
comparación con Gabriel — no cumple ninguno de los dos criterios
obligatorios (D→D+1 ni 74/74), así que no hace falta ni evaluar el resto.

**2026-09-13 y 2026-09-14 no se reconstruyen consultando AEMET/IPMA/Open-Meteo ahora ni en ningún momento posterior** — cualquier consulta en vivo después del día `D` correspondiente ya no sería el snapshot D→D+1 real que habría visto Gabriel, sería una previsión distinta reconstruida a toro pasado (mismo motivo que ya invalidó la comparación original del 14, ver `003-plan.md`). Esos dos días quedan sin snapshot, permanentemente.

**Fechas disponibles para comparar con Gabriel, a día de hoy:** 2026-09-11
(commit `0126e91`), 2026-09-15 (`8f3d773` canónico) y 2026-09-16 (`4da10bc`)
— las tres con `forecast.json` completo y validado, y **las tres ya
comparadas**: 2026-09-11 (`2026-09-11.md`), 2026-09-15 (`2026-09-15.md`) y
2026-09-16 (`2026-09-16.md`). 2026-09-13 y 2026-09-14 siguen sin snapshot
recuperable (ver más abajo).

**Recuento formal de comparaciones válidas D→D+1:** 11 → primera; 15 →
segunda; 16 → tercera. La comparación exploratoria original del 14 (con
una reconstrucción same-day, ya invalidada como comparación definitiva en
`003-plan.md`) no cuenta en este recuento — se cita solo como antecedente
orientativo cuando corresponda, nunca como "1er/2º día" de evidencia
formal.

### Causa raíz de los runs del 12 y 13 de septiembre

El paso "Fetch forecast" de ambos runs falló de inmediato con:

```
Error: Falta AEMET_API_KEY en el entorno (.env en local, Secrets en Actions)
```

`AEMET_API_KEY` llegó vacía al workflow — no es un fallo de AEMET, de IPMA ni de Open-Meteo, ni del pipeline meteorológico: es un fallo de configuración del Secret en GitHub Actions. Consecuencias, en orden:

- No hubo ninguna llamada real a ninguna de las tres fuentes.
- No se ejecutó el pipeline meteorológico (el fallo ocurre antes de la primera petición).
- No hubo forecast parcial de ningún lugar.
- No se generó ningún `forecast.json` nuevo.
- No hay snapshot recuperable para esos dos días, por ninguna vía (sin artifact — el paso murió antes de llegar a build — y sin commit).

**`fetch-forecast.ts` no se toca por esto.** Abortar de inmediato y de forma ruidosa cuando falta una credencial obligatoria es el comportamiento correcto (`tech-stack.md` → "el script falla de forma ruidosa ante un 401/403... para que llegue el aviso de workflow fallido por correo") — el mismo principio aplica a que la key ni siquiera llegue. No se añade tolerancia ni fallback para este caso.
