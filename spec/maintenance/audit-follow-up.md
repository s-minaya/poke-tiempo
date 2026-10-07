# Seguimiento de la auditoría documental y de tests

**Estado:** propuesta de mantenimiento; sin implementación de tests autorizada en esta entrega.

## Referencia y alcance

La auditoría del 5 de octubre de 2026 (DOCUMENTACION.md, TESTS.md, inventario y documentation.patch, entregados en la copia aislada poketiempo-audit-10cef8b09c8d4d50bf93c87051f79fb0) se conserva como referencia del snapshot 7ffb6f2717b6b9cb1b7ff227ca88cdfb536775bc. Sus resultados y tiempos no son un benchmark del HEAD posterior.

El contraste documental se hace contra HEAD 9ac2e62d52421256837b59b8c4bd588f3bae842b y el working tree con la propuesta de la 010. Los informes y el parche originales se conservan sin modificación ni aplicación en bloque.

## Reconciliación documental

Siguen siendo válidas las correcciones de identidad/SDD/lazy y anchuras de verificación; fallback meteorológico y de Oak; credenciales; selección de fecha, husos y degradations; modelo de lugares y zonas manuales; cron configurado frente a ejecución real; historia de la composición fija; raíz fija con ajustes locales y baseline técnico del Vite instalado. Se preservan las incorporaciones de HEAD en tech-stack.md: entornos Node/jsdom, proveedor V8 y comando de coverage.

**Diferido por la 010:** las sustituciones temporales de mission.md y el párrafo del parche sobre la fecha de visita. La decisión sobre `mission.md` de [010-spec.md](../features/010-forecast-freshness/010-spec.md) reserva esa revisión para el cierre; no se anticipa su decisión. La corrección geográfica de Andorra, Ceuta y Melilla sí sigue vigente. Las frases temporales de Oak y del estado sin previsión quedan en el ámbito de la 010, sin implementar ni cambiar sus documentos.

El roadmap y los documentos de la 010 mantienen su contenido previo a esta reconciliación. El soporte de navegadores del producto, licencias/disclaimer y estructura de componentes siguen abiertos.

**WCAG 2.5.8:** la lista es nuestra estrategia para ofrecer controles equivalentes en la misma página. El criterio no prescribe una lista; la equivalencia funcional mapa/lista sigue siendo contrato de Poketiempo. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Tests conservados expresamente

- C1–C3: redundancias demostradas, conservadas. No mezclar su eliminación con la estabilización previa al push.
- Conservar el test exhaustivo de activación de los 74 lugares y equivalencia fila/marcador.
- Conservar el flujo corto H/B: exclusión del seleccionado y ausencia de recuperación al limpiar.
- No aumentar timeouts para ocultar fallos ni perseguir una reducción del recuento.
- Este documento no autoriza implementación. Antes de escribir código, concretar spec/plan/tasks y obtener aprobación según AGENTS.md; confirmar cada bloque antes de continuar.

## Plan de mantenimiento por bloques

### Bloque 1 — Aserciones existentes: T05, T12 y T13

- [ ] T05, src/App.test.tsx: en «tras el tercer bocadillo, Oak se va y queda el mapa, ya interactivo» y «con un oak-today.json del contrato anterior, EMPEZAR lleva directo al mapa», comprobar ausencia de inert en el contenedor que realmente lo recibe. HEAD ya comprueba .app al entrar, pero estas dos salidas siguen mirando main. Conservar ambos flujos. Una aserción jsdom no sustituye una comprobación de operabilidad nativa.
- [ ] T12, WeatherApp.test.tsx: completar el test actual de Escape con una condición seleccionada compatible y comprobar que se conserva junto con zona, orden y selección.
- [ ] T13, LocationList.test.tsx: comprobar también la condición en «cada fila dice condición y mínima/máxima, redondeadas como en el marcador», conservando las cifras.
- [ ] Validar los archivos afectados y presentar el bloque.

### Bloque 2 — Fixtures deterministas: T06, T08 y T09

- [ ] Sustituir la dependencia del forecast diario en estos escenarios de WeatherApp por datos de prueba controlados, sin modificar src/data/forecast.json.
- [ ] T06: condiciones conocidas, inclusión/exclusión del seleccionado y limpieza de tres filtros; contemplar una sola condición y cero resultados. Acotar el botón Limpiar filtros cuando existan dos controles válidos.
- [ ] T08: mantener equivalencia operable/visible con condiciones y búsqueda/zona, añadiendo conjuntos de IDs esperados independientes. No sustituir toda la garantía de integración por helpers.
- [ ] T09: comprobar con datos fijos que ordenar conserva recuento y filtros.
- [ ] Mantener el exhaustivo de 74 y el flujo corto H/B.
- [ ] Ejecutar casos afectados y suite con los proyectos Node/jsdom vigentes; medir antes de proponer optimizaciones. Los tiempos antiguos no justifican cambiar timeouts.
- [ ] Presentar el bloque para confirmación.

### Bloque 3 — Carrera controlada: T10

- [ ] En scripts/orchestrate-location.test.ts, sustituir el timer real de 5 ms del caso «AemetAuthError gana aunque la otra petición (horaria) rechace primero con un error genérico — no se pierde por una carrera de promesas» por promesas diferidas controladas.
- [ ] Rechazar primero la petición con error genérico y después la de autenticación; comprobar que auth sigue siendo fatal y no se oculta con fallback.
- [ ] Conservar la carrera concurrente; dos tests independientes no aportan esa garantía.
- [ ] Validar el archivo y presentar el bloque.

## Propuesta posterior — tres huecos críticos

Trabajo separado de la estabilización anterior; no implementado ni incorporado a la 010.

| Área | Garantía | Alcance posterior |
|---|---|---|
| Transporte AEMET | El cliente real traduce 401/403 a AemetAuthError, distingue errores recuperables y procesa dos pasos/Latin1. | Fetch simulado, sin red ni secretos. La orquestación fabrica el error y no prueba la traducción del transporte. |
| Persistencia del forecast | Solo se publica el conjunto completo y válido; fallo tras fallback, auth o fallo sistémico complementario no pisan el último archivo válido. | Integración del pipeline con fuentes controladas y FS temporal. Diseñar el aislamiento antes de modificar producción; nunca escribir src/data real desde tests. |
| Filtros integrados | AND entre ejes, OR entre condiciones, una condición y cero resultados producen IDs correctos además de equivalencia. | Completar matriz tras el bloque 2 y reutilizar sus fixtures. Revisar casos ya cubiertos para no duplicarlos; comparar dos conjuntos incorrectos no basta. |

Cada hueco requiere propuesta concreta y aprobación antes de implementar. Coverage puede orientar la revisión de ramas; no decide por sí solo qué test eliminar.

## Verificación documental

Comprobar git diff --check y revisar el diff sobre HEAD distinguiendo el cambio previo del roadmap. Verificar que roadmap, carpeta 010 y archivos no documentales conservan su contenido. Esta entrega no cambia código, tests, timeouts, dependencias ni CI; no requiere repetir la suite. Los resultados de la primera auditoría permanecen históricos.

