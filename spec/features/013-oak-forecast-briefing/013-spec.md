# 013 · Briefing meteorológico para el Profesor Oak

**Estado:** cerrada.

## Qué hace

Cada día, el pipeline deriva **de forma determinista y sin edición manual** un *parte meteorológico* del día a partir del `forecast.json` que ya existe, y lo convierte en el material que Oak narra. El parte tiene tres roles:

- **`overview`** — el patrón dominante del día: el que presenta mayor extensión entre los lugares considerados.
- **`highlight`** — el fenómeno de mayor relevancia del día: el hecho que más merece contarse, con su extensión, su concentración o su valor.
- **`secondary`** — el contraste más relevante del día **si existe**, y si no, otro hecho meteorológico legítimo. Nunca se fuerza una excepción.

Un aviso oficial activo de nivel naranja o rojo —cuando exista— tiene prioridad absoluta: es el `highlight` del día y ningún otro material lo desplaza.

El parte se genera todos los días como parte del pipeline diario, igual que hoy, y alimenta las mismas dos vías de redacción: el proveedor de IA y el fallback local.

## Por qué

El Profesor Oak ya tiene una arquitectura factual controlada (007): el dominio decide los hechos, la IA solo los verbaliza. Lo que no tiene es **criterio editorial meteorológico**. El reparto actual de los tres diálogos se hace por papeles narrativos de Pokémon —protagonistas, modo del día, leitmotiv— y la única forma agregada del día son cuatro recuentos sueltos. Con ese material, el modelo recibe una lista de lugares aislados y llena con adjetivos los huecos que el dominio no cubre: el panorama, el énfasis y los contrastes. Esos adjetivos no los ve ninguna guarda.

La consecuencia es que la calidad editorial del texto depende de la redacción del proveedor, no de los datos. Esta feature mueve esa decisión al dominio, donde es determinista, comprobable y la comparten las dos vías de redacción: **la meteorología decide qué se cuenta**.

No se resuelve con un mero cambio de prompt: la pieza principal es una capa de selección determinista.

La 013 puede requerir adaptar el prompt del proveedor para que consuma el parte, exija los claims obligatorios y pierda libertad editorial. Lo que está prohibido es tratar el prompt como la solución del problema: la selección vive en el dominio y el prompt solo la obedece.

## Regla central

**La meteorología decide QUÉ se cuenta. Todo lo demás decide CÓMO se cuenta.**

- Pokémon, `dayMode`, tonos, leitmotivs y el proveedor de IA solo pueden afectar la forma: la voz, el registro, el gag, la pose.
- Un protagonista Pokémon, un leitmotiv o una preferencia de continuidad **nunca** desplaza, sustituye ni degrada un hecho seleccionado por el parte.
- Un hecho seleccionado por el parte nunca se cae del día porque el reparto quiera contar otra cosa.
- Si un gag y un hecho del parte piden el mismo sitio, gana el parte; el gag se acompaña o no se cuenta.

## Conceptos

- **Hecho** — lo que ya produce el dominio de Oak (007): un hecho cerrado y verificable sobre el forecast. No cambia.
- **Parte (briefing)** — la selección del día en tres roles. **No contiene claims**: es la decisión de qué se cuenta, no su redacción. **No copia campos de los hechos: los referencia**, igual que los papeles de protagonista referencian el hecho entero. El objeto que cierra el día sigue siendo el plan de diálogos de la 007.
- **Claim** — la afirmación en español ya resuelta que recibe quien redacta (007, `claims.ts`). Sigue siendo una capa posterior al parte: el parte se convierte en claims, no los lleva dentro.
- **Ámbito (scope)** — el conjunto de lugares sobre el que se afirma y su denominador.
- **Región editorial** — un grupo de lugares, solapable, que existe solo para poder expresar patrones y contrastes en lenguaje natural.
- **Elegible** — lugar con dato utilizable para el eje concreto del que habla la afirmación. Es la base de todo denominador.

La cadena conceptual permanece:

```
forecast → hechos → parte → claims → verbalizador (IA o fallback) → guardas → oak-today.json
```

## Los números del parte

Toda afirmación del parte queda respaldada internamente por:

- el **conjunto de lugares afectados** que la sostiene;
- el **denominador elegible** sobre el que se mide;
- los **recuentos** necesarios para demostrarla.

**Oak no está obligado a verbalizarlos.** La cifra se dice solo cuando editorialmente aporta, y nunca para rellenar. Un diálogo detrás de otro con «N de M lugares» convierte el parte en un boletín, que es justo lo que se quiere evitar.

Lo que sí es obligatorio es que el respaldo exista: una afirmación sin conjunto de lugares, sin denominador o sin recuento no se selecciona, la publique quien la publique.

## Ámbitos

Un ámbito es el conjunto de lugares sobre el que se afirma, y **viaja con la afirmación**:

| Ámbito | Lugares | Composición |
|---|---|---|
| `map` | 74 | todos los lugares del mapa |
| `spain` | 65 | los de España: península, islas y ciudades autónomas |
| `iberian-peninsula` | 63 | los 54 peninsulares de España + los 8 de Portugal + Andorra |
| `region:<id>` | el n del grupo | una de las 7 regiones editoriales explícitas, o `canarias`, `baleares` y `portugal`, derivados de la zona del lugar |

`region:<id>` cubre por tanto diez identificadores: las siete regiones editoriales explícitas y los tres grupos derivados de la zona del lugar. Canarias, Baleares y Portugal **no se declaran en ninguna tabla**: salen de `Location.zone`, que ya existe y ya usa el producto. Declararlos aparte crearía dos listas que pueden desincronizarse.

**Denominadores elegibles, no totales fijos.** Todo recuento se expresa sobre los lugares del ámbito que tienen dato utilizable para el eje del que se habla, nunca sobre el total del ámbito. El total del ámbito es contexto, no denominador.

Qué es elegible depende del eje: para hablar de oleaje, los lugares con dato de mar utilizable; para hablar de avisos, los lugares cuya consulta de avisos ha funcionado; para hablar de precipitación, los lugares con acumulado normalizado. Una afirmación sobre temperaturas no usa el mismo denominador que una sobre oleaje, y ninguna de las dos lo hardcodea.

**Frases prohibidas en cualquier ámbito:**

- «gran parte del territorio» — promete superficie, y 74 puntos no miden superficie.
- «el país» / «gran parte del país» — ambiguo entre dos países, y ninguno se mide como superficie.
- Una afirmación sobre España sin ámbito `spain`.
- Generalizar Portugal a partir de sus 8 lugares: solo formulaciones referidas explícitamente a los lugares de Portugal representados en el mapa, o nombres de lugar. El tamaño del grupo no levanta esta restricción.
- Cualquier generalización agregada a partir de Andorra: es un lugar.

**Condición para el ámbito `spain`, medida con la agrupación exclusiva de zonas.**

La dispersión nacional se demuestra con `Location.zone`, la agrupación exclusiva que ya existe en el modelo de lugares, **no con las regiones editoriales**, que son solapables y no pueden probar dispersión. Las tres condiciones, todas comprobables:

1. **Cobertura:** los lugares afectados son al menos dos tercios de los lugares españoles elegibles para ese eje.
2. **Dispersión:** los lugares afectados están presentes en al menos tres zonas españolas distintas. Una zona con un solo lugar cuenta como una zona.
3. **No concentración en una sola zona:** ninguna zona retiene por sí sola más de dos tercios de los lugares afectados.

La tercera existe para que una mayoría dentro de una única zona no salga al exterior disfrazada de afirmación sobre España.

Las regiones editoriales siguen sirviendo para **encontrar y narrar** patrones regionales. No se usan para justificar alcance nacional, y superar la compuerta de tamaño de una región no concede ninguno.

**El ámbito `iberian-peninsula` no incluye Canarias, Baleares, Ceuta ni Melilla.** Una afirmación con ese ámbito no puede arrastrar recuentos de islas, y una afirmación sobre islas no puede presentarse como peninsular.

## Regiones editoriales

Siete regiones explícitas, **solapables**: un lugar puede pertenecer a varias. No existe ninguna obligación de que formen una partición del mapa, y ningún lugar necesita pertenecer a una región para poder ser contado — el panorama global se calcula sobre los lugares del ámbito, no sobre regiones.

| id | Nombre | Lugares | Composición admitida |
|---|---|---|---|
| `northwest` | Noroeste | 6 | Galicia y Asturias. Sin Cantabria |
| `north` | Norte | 13 | el noroeste más Cantabria, País Vasco, Navarra, La Rioja, Huesca, Jaca y Benasque |
| `northeast` | Noreste | 10 | Aragón y Cataluña |
| `meseta` | Meseta | 17 | Castilla y León, Castilla-La Mancha y Madrid |
| `southwest` | Suroeste | 8 | Extremadura y la Andalucía atlántica y del valle del Guadalquivir |
| `southeast` | Sureste | 6 | Andalucía oriental, Murcia y Alicante |
| `mediterranean` | Mediterráneo | 9 | el arco mediterráneo peninsular: costa de Cataluña, arco levantino, Murcia, Almería y Málaga |

**Qué solapes son deliberados**, porque son editorialmente válidos y así se han decidido:

- El norte amplio contiene el noroeste: pertenecer al noroeste no impide pertenecer al norte.
- Huesca, Jaca y Benasque pertenecen al norte y al noreste a la vez. Son pirenaicos y las dos lecturas son correctas.
- La costa de Cataluña —Barcelona, Girona y Tarragona— pertenece al noreste y al Mediterráneo a la vez.
- Murcia, Alicante y Almería pertenecen al sureste y al Mediterráneo a la vez. Una pertenencia no excluye la otra.

Ninguna pertenencia se decide por descarte: cuando dos lecturas regionales son válidas, el lugar está en las dos.

**Grupos derivados**, no declarados en la tabla editorial: Canarias, Baleares y Portugal salen de la zona del lugar (`Location.zone`), que ya existe y ya usa el producto. No se duplican.

**Sin región editorial:** Andorra, Ceuta y Melilla. Son lugares y entidades puntuales; no necesitan región para completar nada.

**No se añade ninguna región editorial adicional en esta feature.** En particular, ni el Pirineo ni el Cantábrico: con los lugares que tenemos, ninguno de los dos aportaría una afirmación que no se pueda ya expresar con las siete regiones o nombrando lugares.

## Elegibilidad regional

Una región o grupo derivado solo puede sostener una afirmación si tiene lugares suficientes con dato utilizable. Completado el número de lugares elegibles del grupo:

- **6 o más** — puede aspirar a `overview`.
- **3 a 5** — puede aspirar a `secondary`.
- **2 o menos** — no genera ninguna afirmación regional agregada; a lo sumo se nombran sus lugares.

La compuerta aplica igual a las siete regiones explícitas y a los grupos derivados. Superarla no levanta ninguna restricción propia del grupo: Portugal, con 8 lugares, pasa la compuerta y sigue sin poder generalizarse.

Eso es solo una compuerta de tamaño. La selección real usa cinco medidas, todas sobre recuentos exactos de lugares y sin umbrales fijados todavía:

- **Prevalencia interna** — de los lugares elegibles del grupo, cuántos cumplen la condición.
- **Prevalencia del resto** — lo mismo sobre el resto de los lugares elegibles del ámbito.
- **Contraste** — la diferencia entre las dos. Es la medida de la excepción y lleva signo.
- **Concentración** — de todos los lugares afectados del ámbito, qué fracción cae en este grupo.
- **Sobre-representación** — la concentración comparada con lo que al grupo le tocaría por su tamaño, para que un grupo grande no gane por ser grande.

Las cinco se calculan igual si la afirmación habla de que algo **ocurre** o de que **no ocurre**: la ausencia de un fenómeno es también un patrón, y el parte no puede depender de que exista.

**No se derivan adjetivos de intensidad.** «Débil», «moderado» o «fuerte» no salen de estas medidas en esta feature. No se reutilizan como etiquetas meteorológicas las bandas internas de asignación de Pokémon: pueden servir para ordenar relevancia, nunca para afirmar una intensidad que los datos no llevan escrita.

## Los tres roles

- **`overview`** — el patrón de mayor extensión sobre el ámbito que corresponda. Es la afirmación que sitúa la jornada.
- **`highlight`** — el fenómeno de mayor relevancia del día. Cuando hay aviso naranja o rojo, es el aviso.
- **`secondary`** — el contraste más fuerte entre un grupo y el resto, **si existe**. Si no existe contraste real, el rol se cubre con otro hecho meteorológico legítimo: un segundo patrón, un fenómeno localizado, un valor extremo. La excepción no es obligatoria y no se fabrica.

Los tres roles se rellenan siempre que haya forecast; el día no se publica sin parte. Un rol sin candidato real degrada, no aborta.

## Restricciones de candidatura por rol

Dos restricciones acotan qué patrón puede ocupar cada rol. Ninguna de las dos elimina hechos del motor ni cambia las medidas, la elegibilidad de los ejes, el valor de `overRepresentation` ni el comparador de `secondary`: solo impiden que un patrón concreto compita por un rol concreto.

### `overview`: la ausencia global no compite

Una ocurrencia `ausente` con ámbito global —`map`, `spain` o `iberian-peninsula`— **no puede competir por `overview`**. La restricción afecta solo a ese rol: la ausencia sigue siendo un `PatternFact` válido y puede competir por los demás roles para los que ya sea elegible según las reglas existentes.

Una ocurrencia `ausente` con ámbito regional (`region:<id>`) **sí** puede competir por `overview` cuando supera las compuertas regionales normales y tiene `contrast > 0`. No se añade ningún umbral nuevo de contraste.

Las presencias, las categorías de cielo y las bandas térmicas conservan sus reglas actuales.

Objetivo editorial: evitar que una ausencia casi universal gane `overview` únicamente por tener el mayor `affectedCount`, manteniendo las ausencias regionales que localizan una diferencia real.

### `secondary`: `olas/presente` no compite

`occurrence / olas / presente` **no puede competir por `secondary`**. La restricción afecta solo a ese rol.

El patrón `olas/presente` sigue siendo un `PatternFact` válido y puede competir por los demás roles que ya tenga permitidos. Los hechos locales de oleaje y su uso narrativo no cambian.

No cambian las medidas, `overRepresentation = 2`, el ranking general de `secondary`, los pesos entre fenómenos ni la elegibilidad de ningún otro fenómeno. Cuando el mejor candidato de `secondary` sea `olas/presente`, se toma el siguiente candidato regional material según el comparador actual.

### Justificación

**A4.** Una ausencia global uniforme no describe un panorama: gana `overview` por el mayor `affectedCount` sin aportar una diferencia que contar. A4 elimina esa tautología sin añadir thresholds y conserva las ausencias regionales que localizan un contraste real.

**B.** El oleaje es un hecho localizado y recurrente en la costa, no el contraste editorial que debe presidir el cierre. Reservarlo fuera de `secondary` deja ese rol a patrones regionales con contraste material y mantiene el oleaje disponible para los demás roles.

## Selección de `highlight`

«Más relevante» no queda al criterio de nadie: es un orden lexicográfico fijo, y cada escalón solo se consulta si el anterior no ha decidido.

1. **Aviso oficial activo de nivel naranja o rojo.** Gana siempre, sobre cualquier otro candidato. Si hay varios avisos candidatos, el elegido entre ellos es el que determina el criterio determinista de selección de avisos que ya existe en la 007. La 013 no introduce ningún ranking nuevo de avisos, ningún peso nuevo ni ninguna tabla nueva de prioridad.
2. **Severidad ya existente en el dominio**, con un límite estricto: dos niveles o umbrales solo se comparan directamente cuando **pertenecen al mismo fenómeno** o cuando **ya comparten una escala comparable definida por el dominio**. Nunca se ordenan entre sí escalas heterogéneas: un nivel interno de viento no es por sí solo mayor que una banda interna de oleaje, ni una banda térmica mayor que un acumulado de lluvia. Si el escalón no puede decidir de forma legítima, se pasa al siguiente. **No se inventa ninguna escala transversal nueva.**
3. **Las medidas aprobadas** de contraste, cobertura y concentración, consultadas en ese orden.
4. **Orden estable ya existente en el dominio** para los empates, nunca una tabla nueva de «fenómenos importantes».

**No se inventan pesos numéricos entre fenómenos.** Cada escalón decide por comparación directa con el criterio que ya existía, no con una puntuación.

Los umbrales existentes ordenan relevancia internamente. No autorizan vocabulario público: ningún umbral interno convierte un dato en «débil», «moderado» o «fuerte».

## Cobertura de claims

La garantía que cierra la frontera con la IA por el otro lado: **el proveedor no puede omitir lo que el dominio decidió contar.**

- Cada rol produce uno o más **claims obligatorios**, que son la selección del parte puesta en palabras.
- Tras la respuesta del proveedor hay una comprobación determinista de que los claims obligatorios de ese hueco han quedado representados en el texto.
- Si la cobertura no se puede demostrar, la respuesta se rechaza y se publica el fallback.

Es una comprobación distinta de la que ya existe:

| Comprobación | Qué mira | Ante un fallo |
|---|---|---|
| Ajuste factual (007) | que la IA no haya **añadido** hechos no autorizados | fallback |
| Cobertura de claims (013) | que la IA no haya **omitido** hechos que el parte decidió contar | fallback |

Las dos se aplican, en ese orden, y las dos caen al mismo sitio. La mecánica exacta se decide en el plan; la garantía pertenece a esta spec.

La IA y el fallback verbalizan **la misma selección**: ni uno puede quedarse con un subconjunto ni el otro puede completar lo que falta.

## Restricciones temporales

El dataset es de una fecha. El parte solo puede hablar de esa fecha.

- Se mantienen **todas** las restricciones vigentes de la 010, que son la fuente de verdad: sus cinco palabras, sus cuatro frases y la regla de «estamos a» con una fecha. No se repiten aquí.
- Esa lista se **amplía**, sin sustituirla ni duplicar ninguna entrada ya existente, con las siguientes familias:

| Familia | Entradas que se añaden |
|---|---|
| Semana | «esta semana», «la próxima semana», «la semana que viene», «la semana pasada» |
| Mes | «este mes», «el próximo mes», «el mes que viene», «el mes pasado» |
| Varios días | «los próximos días», «en los próximos días», «durante los próximos días», «los siguientes días», «en los siguientes días», «los últimos días» |
| Desplazamientos relativos | «dentro de N días», «en N días», «hace N días», «dentro de unos días» — con `N` resuelto por un patrón cerrado, no enumerando números |
| Temporada | «esta temporada», «la próxima temporada», «la temporada que viene», «la temporada pasada» |
| Estaciones | «esta primavera», «este verano», «este otoño», «este invierno», «la próxima primavera», «el próximo verano», «el próximo otoño», «el próximo invierno», «la primavera pasada», «el verano pasado», «el otoño pasado», «el invierno pasado» |
| Fin de semana como periodo | «este fin de semana», «el próximo fin de semana», «el fin de semana que viene», «el fin de semana pasado» |
| Otras | «más adelante», «en adelante» |

- «Fin de semana» sigue permitido cuando describe exclusivamente que la fecha de previsión cae en fin de semana, que es el uso que ya existe. Lo que se prohíbe son las cuatro formulaciones de la tabla, porque describen un periodo y no una propiedad de la fecha.
- La implementación trabaja contra la **lista y los patrones cerrados** de la fuente de verdad existente. No queda ninguna obligación de detectar equivalentes no enumerados: si una expresión no está en la lista, no es una violación.
- El enumerado de esta spec es decisión del usuario y queda cerrado aquí. Cualquier ampliación futura sigue siendo decisión del usuario, no un ajuste de redacción.

## Restricciones del texto

- **Los diálogos de Oak no contienen emojis.** No hay hoy ninguna fuente normativa que lo prohíba, así que esta feature lo establece. Aplica a las dos vías: la respuesta del proveedor y el fallback local.
- La comprobación es determinista y con patrón cerrado, como el resto de las guardas: un emoji en el texto del proveedor invalida la respuesta y cae al fallback; un emoji en el fallback sería un fallo propio, y un fallo propio no publica.
- El resto de prohibiciones de redacción —expresiones relativas, frases de ámbito, adjetivos de intensidad, hechos no autorizados— vive en sus propias secciones y no se duplica aquí.

## Contrato público

**No cambia `oak-today.json`.** Sigue publicando tres diálogos con `id`, `role`, `tone` y `text`, con el vocabulario actual de roles y tonos, que es lo que consume la escena de Oak.

`overview`, `highlight` y `secondary` son **roles internos del parte**: la estructura con la que el dominio decide qué se cuenta. No se publican, no se traducen a `role` nuevos y el frontend no los conoce.

## Qué NO cambia

Referencias, no duplicado: la meteorología y la asignación Pokémon son de la 002 y la 003; la frontera factual de Oak, la capa de claims, la guarda factual, el fallback determinista y el contrato de expresiones relativas son de la 007 y la 010; el proveedor de IA, los secrets, el workflow y el presupuesto de 0 € están en `tech-stack.md`.

En concreto, esta feature no cambia:

- La meteorología, el motor de asignación de Pokémon y la prioridad editorial de Pokémon.
- La frontera factual de Oak: sigue sin medir ni asignar nada.
- La capa de claims y el fallback local determinista.
- El proveedor y el modelo de IA, y el presupuesto de 0 €.
- El workflow diario y el orden de sus pasos.
- El contrato publicado de `oak-today.json` y el frontend.
- `forecast.json`: ni un campo nuevo, ni una fuente nueva, ni una petición nueva.
- La agrupación exclusiva de zonas del modelo de lugares.

La guarda de expresiones relativas se **amplía**, no se reescribe, y se le añaden la comprobación de cobertura de claims y la de emojis.

## Relación con las fuentes normativas

- **`AGENTS.md` y la constitución** mandan sobre esta spec. Esta feature no introduce stack, dependencias, convenciones ni arquitectura nuevas.
- **La 007** es la fuente de la frontera factual, de la capa de claims, de los tonos, de los modos del día, de los leitmotivs y del fallback. Esta feature añade la selección meteorológica por delante de todo eso, sin sustituir ninguno de esos mecanismos.
- **La 010** es la fuente de las restricciones temporales de Oak y de la lista de expresiones relativas, que esta feature amplía sin sustituir.
- **`tech-stack.md` → Arquitectura de datos** fija la cadena «dominio puro → parte → claims → Groq o fallback local».

## Alcance

Dentro:

- La derivación determinista del parte diario a partir de los datos existentes.
- Los ámbitos, las regiones editoriales y las medidas de elegibilidad.
- La selección de `overview`, `highlight` y `secondary` con su degradación.
- La comprobación de cobertura de claims obligatorios sobre la respuesta del proveedor.
- La ampliación de la lista de expresiones temporales prohibidas, con el enumerado cerrado en esta spec.
- La prohibición de emojis en los diálogos de Oak, con su comprobación determinista.
- La extensión de las guardas a la no repetición entre diálogos.
- El reparto del parte en los tres diálogos, respetando que la meteorología manda sobre el material narrativo.
- Tests de selección, cobertura, contraste, concentración, no repetición, restricciones temporales, avisos, cobertura de claims, emojis y fallback.

Fuera:

- Cambiar de proveedor o de modelo de IA.
- Tocar el workflow, el contrato público, el frontend o el `forecast.json`.
- Adjetivos de intensidad meteorológica («débil», «moderado», «fuerte»).
- Climatología de referencia, anomalías y récords.
- Franjas horarias o varios días de previsión.
- Edición manual diaria del parte.
- Cambiar la agrupación exclusiva de zonas del modelo de lugares.
- Reordenar la prioridad editorial de Pokémon.

## Criterios de aceptación

### Generación

- [x] El parte se genera todos los días dentro del pipeline diario, sin ningún paso manual y sin red nueva.
- [x] El parte existe siempre que haya forecast: los tres roles se rellenan, y un rol sin candidato real degrada a otro hecho legítimo en vez de abortar la generación.
- [x] La misma entrada produce el mismo parte, sin azar ni reloj.

### Roles y selección

- [x] El día tiene exactamente `overview`, `highlight` y `secondary`.
- [x] `overview` describe el patrón de mayor extensión y queda respaldado internamente por su conjunto de lugares afectados, su denominador elegible y su recuento.
- [x] Verbalizar la cifra del `overview` es opcional: se hace solo cuando aporta, y ningún diálogo se convierte en una relación de «N de M lugares».
- [x] `highlight` se elige por el orden lexicográfico fijado en esta spec: aviso naranja o rojo, severidad ya existente en el dominio, medidas de contraste/cobertura/concentración, y por último orden estable existente.
- [x] Con aviso naranja o rojo activo, el `highlight` es el aviso, sin excepción.
- [x] Con varios avisos naranja o rojo candidatos, el elegido es el que determina el criterio determinista de selección de avisos ya existente en la 007.
- [x] La 013 no introduce ningún ranking de avisos, ningún peso nuevo ni ninguna tabla de prioridad nueva.
- [x] El escalón de severidad solo compara niveles del **mismo fenómeno** o de una **escala comparable ya definida por el dominio**; nunca escalas heterogéneas entre sí.
- [x] Cuando el escalón de severidad no puede decidir de forma legítima, la selección continúa con contraste, cobertura, concentración y desempate estable.
- [x] No existe ninguna escala transversal nueva entre fenómenos y ningún peso numérico que los ordene.
- [x] Los umbrales existentes no autorizan en ningún texto vocabulario público de intensidad.
- [x] `secondary` es un contraste real si existe, y otro hecho legítimo si no. En ningún día se construye una excepción que los datos no sostengan.
- [x] Un protagonista Pokémon, un leitmotiv, un tono o el modo del día no sustituyen ni eliminan ningún hecho seleccionado por el parte.
- [x] El parte referencia los hechos; no duplica sus campos.

### Números y respaldo

- [x] Toda afirmación del parte conserva su conjunto de lugares afectados, su denominador elegible y sus recuentos.
- [x] Una afirmación sin respaldo interno no se selecciona, la publique quien la publique.

### Ámbitos y denominadores

- [x] Toda afirmación lleva el ámbito sobre el que se hace.
- [x] Todo recuento usa como denominador los lugares elegibles de ese ámbito para el eje en cuestión, nunca un total fijo del ámbito.
- [x] `map` = 74, `spain` = 65, `iberian-peninsula` = 63 en lugares, con denominador elegible por eje.
- [x] `region:<id>` admite las siete regiones explícitas y los grupos derivados `canarias`, `baleares` y `portugal`.
- [x] Canarias, Baleares y Portugal no aparecen declarados en ninguna tabla: salen de la zona del lugar.
- [x] Portugal no se generaliza a partir de sus 8 lugares, ni siquiera superando la compuerta de tamaño.
- [x] Andorra no produce ninguna afirmación agregada.
- [x] Ninguna afirmación contiene «gran parte del territorio», «el país» ni «gran parte del país».
- [x] Una afirmación de ámbito `spain` cumple: cobertura ≥ 2/3 de los lugares españoles elegibles, afectados en al menos 3 zonas españolas, y ninguna zona con más de 2/3 de los afectados.
- [x] La dispersión nacional se mide con `Location.zone`, nunca con las regiones editoriales solapables.
- [x] `iberian-peninsula` no incluye Canarias, Baleares, Ceuta ni Melilla, y ninguna afirmación peninsular arrastra recuentos de islas.

### Regiones y elegibilidad

- [x] Las siete regiones tienen su composición fijada, con los solapes deliberados declarados.
- [x] Un lugar puede pertenecer a varias regiones, y ninguna pertenencia se decide por descarte.
- [x] Andorra, Ceuta y Melilla no tienen región editorial.
- [x] No se añade ninguna región editorial adicional.
- [x] Un grupo con 6 o más lugares elegibles puede dar `overview`; con 3 a 5 solo `secondary`; con 2 o menos ninguna afirmación agregada.
- [x] Las medidas de prevalencia interna, prevalencia del resto, contraste, concentración y sobre-representación se calculan sobre recuentos exactos de lugares.
- [x] La misma ausencia de fenómeno se mide igual que su presencia.

### Repetición

- [x] Como máximo una afirmación regional por fenómeno y día.
- [x] La deduplicación compara conjuntos de `locationId` y sus denominadores, nunca el texto redactado.
- [x] Ninguna afirmación del parte se sostiene sobre el mismo conjunto de lugares y el mismo fenómeno que otra.
- [x] La comprobación ocurre sobre el parte, antes de que nadie redacte.

### Temporal

- [x] Ningún texto del parte —de la IA o del fallback— contiene las expresiones relativas prohibidas hoy.
- [x] La lista de expresiones prohibidas queda ampliada con las entradas concretas de esta spec, enumeradas en la única fuente de verdad del proyecto, sin duplicar ninguna entrada ya existente.
- [x] Las entradas con cantidad variable («N días») se resuelven con un patrón cerrado, no enumerando números.
- [x] La comprobación se hace contra esa lista cerrada; ninguna expresión fuera de ella se trata como violación.
- [x] «Fin de semana» sigue permitido únicamente como propiedad calendaria de la fecha de previsión; las cuatro formulaciones de fin de semana como periodo quedan prohibidas.
- [x] El parte no contiene ninguna tendencia, evolución ni comparación con otra fecha.

### Emojis

- [x] Ningún diálogo de Oak, de la IA o del fallback, contiene emojis.
- [x] La comprobación es determinista y con patrón cerrado, y un emoji en la respuesta del proveedor invalida la respuesta y publica el fallback.

### Cobertura de claims

- [x] Cada rol produce uno o más claims obligatorios, derivados de la selección del parte.
- [x] Existe una comprobación determinista, sobre la respuesta del proveedor, de que los claims obligatorios del hueco han quedado representados.
- [x] Si la cobertura no se puede demostrar, la respuesta se rechaza y se publica el fallback.
- [x] La comprobación de cobertura es independiente de la de ajuste factual, y ambas se aplican.
- [x] La IA y el fallback verbalizan la misma selección.

### Fallback

- [x] El fallback cubre los hechos de cada rol y no introduce ninguno fuera de ellos.
- [x] Cualquier fallo del proveedor sigue cayendo al fallback sin romper el run; un fallo propio sigue sin publicar nada.

### Límites

- [x] Sin dependencias nuevas.
- [x] Sin datos nuevos pedidos a ninguna fuente.
- [x] El contrato publicado de `oak-today.json` no cambia.
- [x] El proveedor y el modelo de IA no cambian.
- [x] La agrupación exclusiva de zonas del modelo de lugares no cambia.

## Fuera de alcance

- Adjetivos de intensidad, climatología de referencia, anomalías, franjas horarias y varios días de previsión.
- Cambios en el mapa, la leyenda, la lista de lugares o la escena de Oak.
- Reordenar la prioridad editorial de Pokémon.
- Regiones editoriales nuevas.
- Cambiar la agrupación exclusiva de zonas del modelo de lugares.

## Preguntas abiertas

Ninguna.
