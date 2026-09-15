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

## Histórico de snapshots conocidos

Indexado por `forecast.date` (el día que retrata el snapshot, no el día en
que se generó — ese es siempre la víspera). Fuente de verdad: `git log` sobre
`src/data/forecast.json` + la API de runs de GitHub Actions del workflow
`Deploy` (`.github/workflows/deploy.yml`).

| `forecast.date` | Estado | Commit | `generatedAt` | Notas |
|---|---|---|---|---|
| 2026-09-11 | ✅ Válido | `0126e91` | 2026-09-10T08:03:35.999Z | 74/74. Generado en local durante el desarrollo de la 002, no por el workflow diario (el primer run de `Deploy` es del 8 de septiembre) — sigue sirviendo como snapshot D→D+1 real, solo cambia quién lo generó. |
| 2026-09-13 | ❌ Sin snapshot | — | — | Run del 12/09 (`34686486452`, `schedule`), falló en el paso "Fetch forecast" — ver causa raíz abajo. |
| 2026-09-14 | ❌ Sin snapshot | — | — | Run del 13/09 (`34752532995`, `schedule`), mismo fallo — ver causa raíz abajo. |
| 2026-09-15 | ✅ Válido | **`8f3d773`** (canónico) / `99dd6de` (alternativo) | 11:13:50Z / 07:10:34Z | 74/74 en ambos. Dos runs exitosos el mismo día — ver política de snapshot canónico arriba. |
| 2026-09-16 | ✅ Válido | `4da10bc` | 2026-09-15T07:07:16.102Z | 74/74. |

**2026-09-13 y 2026-09-14 no se reconstruyen consultando AEMET/IPMA/Open-Meteo ahora ni en ningún momento posterior** — cualquier consulta en vivo después del día `D` correspondiente ya no sería el snapshot D→D+1 real que habría visto Gabriel, sería una previsión distinta reconstruida a toro pasado (mismo motivo que ya invalidó la comparación original del 14, ver `003-plan.md`). Esos dos días quedan sin snapshot, permanentemente.

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
