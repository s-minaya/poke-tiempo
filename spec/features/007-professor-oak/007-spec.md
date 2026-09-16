# 007 · Profesor Oak

**Estado:** propuesta — diseño cerrado, **bloqueada hasta que existan la 002 y la 003**

## Qué hace

Cada día, el Profesor Oak narra la previsión ya decidida por el resto del sistema en **3 diálogos cortos** (pensados para un bocadillo de diálogo, no párrafos largos). Oak no inventa datos ni decide qué Pokémon corresponde a qué fenómeno — eso ya está resuelto por la 003. Su trabajo es exclusivamente narrativo: elegir qué contar, en qué tono, y redactarlo con la personalidad de Poketiempo.

## Por qué

Encaja con la broma central del proyecto (`mission.md`): un mapa que asigna Pokémon a la meteorología ya es el chiste visual; Oak le añade una voz que lo comenta, sin salirse del mismo principio de que la meteorología manda y la narrativa se adapta a ella, nunca al revés.

## Dependencia dura

Oak no genera contenido real hasta que:

- **La 002 esté implementada**, no solo diseñada — el contrato de datos ya está cerrado (`features/002-weather-data-pipeline/002-plan.md`), pero hasta que el pipeline corra de verdad no hay `forecast.json` real que leer. El mapeo de lugares a zona oficial de aviso (necesario para `alerta`) es trabajo de esa implementación.
- **La 003** tenga su contrato de salida cerrado (uno o varios Pokémon por lugar, cómo se resuelven condiciones simultáneas). Oak consume ese contrato tal cual quede — no lo define ni lo anticipa.

Mientras tanto, esta feature **no se implementa** — está bloqueada, no en desarrollo. Cuando le llegue el turno (002 implementada y 003 con contrato cerrado), sus tests podrán apoyarse en *fixtures* derivados de esos contratos reales para no depender de una ejecución real del pipeline en cada test.

## Criterios de aceptación

- [ ] El sistema nunca decide qué Pokémon corresponde a un fenómeno — esa decisión llega ya tomada desde la 003.
- [ ] Los 3 diálogos siempre se generan, aunque falle la IA (fallback local sin red).
- [ ] Ningún dato meteorológico (temperatura, mm, avisos, niveles de riesgo) puede ser inventado por el modelo de IA — solo redacta sobre datos ya cerrados.
- [ ] El modo `alerta` tiene prioridad absoluta cuando se activa, y solo se activa a partir de una señal explícita de aviso/riesgo — nunca inferido de qué Pokémon salió asignado.
- [ ] Los modos `anomalia`, `alerta`, `relevo` y `migracion` existen en el código pero quedan deshabilitados mientras no exista el dato del que dependen (ver `007-plan.md`).
- [ ] La API key del proveedor de IA que corresponda vive solo en GitHub Secrets — nunca en el bundle, nunca en `VITE_*`, nunca en el JSON público. El proveedor/modelo es configurable, permanece exclusivamente en capa gratuita (nunca se habilita billing/upgrade) y cualquier `429`/indisponibilidad/cambio de cuota activa el fallback local — coste operativo de IA obligatorio: 0 €.
- [ ] `src/data/oak-today.json` se importa en build-time desde el frontend, igual que el resto de datos — sin `fetch` en runtime.
- [ ] Los 3 diálogos son accesibles por teclado, no solo por gesto de ratón/touch.
- [ ] El pipeline **nunca sobrescribe** un `oak-today.json` válido con un resultado inválido; si el workflow falla antes de generar uno válido, no despliega. GitHub Pages sigue sirviendo entonces la versión previamente desplegada — no es un comportamiento del frontend ("mostrar el de ayer"), es que nunca llega a publicarse nada roto. El frontend puede detectar que `date` es anterior a hoy y mostrarlo con esa fecha visible, pero no "recupera" un archivo que no existe.

## Fuera de alcance

- Definir el contrato de salida de la 003 — se hace en su propia spec.
- Definir la estructura de avisos oficiales — ya está cerrada en la 002 (`AlertsAvailability`, vocabulario de `AlertPhenomenon`), Oak solo la consume.
- **Representar DANA** — el contrato actual de la 002 no la incluye; queda como capacidad futura del roadmap si algún día aparece una fuente fiable.
- La UX final del componente (carrusel, flechas, indicador) — se decide en el `007-plan.md` cuando se implemente, no aquí.
