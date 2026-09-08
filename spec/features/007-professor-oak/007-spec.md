# 007 · Profesor Oak

**Estado:** propuesta — diseño cerrado, **bloqueada hasta que existan la 002 y la 003**

## Qué hace

Cada día, el Profesor Oak narra la previsión ya decidida por el resto del sistema en **3 diálogos cortos** (pensados para un bocadillo de diálogo, no párrafos largos). Oak no inventa datos ni decide qué Pokémon corresponde a qué fenómeno — eso ya está resuelto por la 003. Su trabajo es exclusivamente narrativo: elegir qué contar, en qué tono, y redactarlo con la personalidad de Poketiempo.

## Por qué

Encaja con la broma central del proyecto (`mission.md`): un mapa que asigna Pokémon a la meteorología ya es el chiste visual; Oak le añade una voz que lo comenta, sin salirse del mismo principio de que la meteorología manda y la narrativa se adapta a ella, nunca al revés.

## Dependencia dura

Oak no genera contenido real hasta que:

- **La 002** exponga los campos que le faltan hoy al modelo de datos: precipitación en mm, nieve en cm, y (si se puede) franjas mañana/tarde y avisos oficiales. Ver `roadmap.md` → punto 2.
- **La 003** tenga su contrato de salida cerrado (uno o varios Pokémon por lugar, cómo se resuelven condiciones simultáneas). Oak consume ese contrato tal cual quede — no lo define ni lo anticipa.

Hasta entonces, esta feature se desarrolla y testea contra *fixtures* (datos de ejemplo), no contra datos reales.

## Criterios de aceptación

- [ ] El sistema nunca decide qué Pokémon corresponde a un fenómeno — esa decisión llega ya tomada desde la 003.
- [ ] Los 3 diálogos siempre se generan, aunque falle la IA (fallback local sin red).
- [ ] Ningún dato meteorológico (temperatura, mm, avisos, niveles de riesgo) puede ser inventado por el modelo de IA — solo redacta sobre datos ya cerrados.
- [ ] El modo `alerta` tiene prioridad absoluta cuando se activa, y solo se activa a partir de una señal explícita de aviso/riesgo — nunca inferido de qué Pokémon salió asignado.
- [ ] Los modos `anomalia`, `alerta`, `relevo` y `migracion` existen en el código pero quedan deshabilitados mientras no exista el dato del que dependen (ver `007-plan.md`).
- [ ] `GROQ_API_KEY` (o la que corresponda) vive solo en GitHub Secrets — nunca en el bundle, nunca en `VITE_*`, nunca en el JSON público.
- [ ] `src/data/oak-today.json` se importa en build-time desde el frontend, igual que el resto de datos — sin `fetch` en runtime.
- [ ] Los 3 diálogos son accesibles por teclado, no solo por gesto de ratón/touch.
- [ ] Si falta el JSON de hoy, se sigue mostrando el de ayer en vez de un componente vacío o roto.

## Fuera de alcance

- Definir el contrato de salida de la 003 — se hace en su propia spec.
- Definir la estructura de avisos oficiales o la señal de DANA — se hace en la spec de la 002.
- La UX final del componente (carrusel, flechas, indicador) — se decide en el `007-plan.md` cuando se implemente, no aquí.
