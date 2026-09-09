# Fixtures

## AEMET

- `aemet-diaria-madrid.json` / `aemet-horaria-madrid.json` — respuesta real
  capturada de AEMET OpenData para Madrid (municipio `28079`), decodificada
  de ISO-8859-1 a UTF-8 y recortada a `prediccion.dia[0]` (el resto de días
  no se usa en la normalización). Día soleado sin lluvia/nieve/tormenta.
- `aemet-horaria-edge-cases.json` — construida a mano a partir de esa misma
  forma real para ejercitar ramas que un día cualquiera no produce: niebla
  (81), bruma (82), nieve (34 + campo `nieve` > 0), tormenta (52) y calima
  (83) en distintas horas del mismo día. No es una captura real de AEMET.

Ambos ficheros conservan el campo `precipitacion` tal cual lo da AEMET
aunque `normalizeAemetHourly` ya no lo consuma: su horaria de "hoy" nunca
cubre el día completo (solo desde la hora de generación en adelante), así
que no sirve como acumulado diario — `precipitation.mm` lo aporta Open-Meteo
como complemento en España también (ver `002-plan.md`).

- `aemet-aviso-lluvias-naranja.xml` — CAP real (avisos_cap, área 61) de un
  aviso naranja de lluvias activo, con sus bloques es-ES y en-GB completos
  tal como los sirve AEMET — prueba que solo se usa el es-ES.
- `aemet-aviso-temperatura-verde-multizona.xml` — CAP real recortado a 3 de
  sus ~29 zonas (mismo aviso baseline "verde" que cubre toda un área cada
  día): prueba que un único `<info>` con varias `<area>` produce varios
  avisos, y que el nivel "verde" se filtra antes de llegar a `OfficialAlert`.

## IPMA

- `ipma-daily-lisboa.json` — respuesta real de
  `forecast/meteorology/cities/daily/1110600.json` (Lisboa). Día con cielo
  poco nuboso, sin fenómenos — los códigos de tormenta/niebla/nieve/sin-info
  se prueban con objetos construidos en el propio test (`dailyWithType`),
  no necesitan fixture aparte al ser un único campo (`idWeatherType`).
- `ipma-warnings.json` — respuesta real de `forecast/warnings/warnings_www.json`,
  con un aviso amarillo activo real ("Tempo Quente" en las zonas MPS/MCS) —
  usado tanto para la forma del fetcher (Bloque 3) como para
  `normalizeIpmaAlert` (Bloque 7).

## Open-Meteo

- `open-meteo-daily-andorra.json` — respuesta real del forecast estándar
  para Andorra la Vella, con `weather_code: 51` (light drizzle, un fenómeno
  sin nubosidad asociada — sirve para probar `sky: null` con un dato real).
- `open-meteo-daily-madrid.json` — respuesta real para Madrid, usada solo
  para probar `normalizeOpenMeteoComplement` (los campos numéricos que
  complementan a AEMET en España).
- `open-meteo-marine-lisboa.json` — respuesta real de Open-Meteo Marine para
  el punto costero de Lisboa (`marineCoordinates` del Bloque 1).
  Los 28 puntos costeros de `locations.ts` se verificaron uno a uno contra
  la API real de Marine antes de cerrar este bloque: todos devuelven un
  `wave_height_max` válido, ninguno cae en tierra.
