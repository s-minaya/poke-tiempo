import { describe, expect, it } from "vitest";

import type { LocationZone } from "../location-zones.ts";
import type {
  AlertLevel,
  AlertPhenomenon,
  Location,
  LocationForecast,
  OfficialAlert,
  SkyCondition,
} from "../types.ts";
import {
  MATERIAL_CONTRAST_MIN_OVER_REPRESENTATION,
  OCCURRENCE_POLARITIES,
  briefingCandidates,
  buildBriefing,
  buildPatternFact,
} from "./briefing.ts";
import type { BriefingCandidate } from "./briefing.ts";
import type { DayModeDecision } from "./day-mode.ts";
import type { LocationEntry } from "./facts.ts";
import type {
  AlertFact,
  CalendarFact,
  DayShapeFact,
  NarrativeFact,
  OccurrencePhenomenon,
  PatternCondition,
  PatternFact,
  PatternMeasures,
  PatternScope,
  RainFact,
  TemperatureFact,
} from "./types.ts";

const DATE = "2026-09-18"; // viernes

type Country = Location["country"];

function zoneFor(country: Country): LocationZone {
  if (country === "PT") return "Portugal";
  if (country === "AD") return "Andorra";
  return "Galicia";
}

function place(id: string, country: Country = "ES"): Location {
  return {
    id,
    name: id,
    administrativeArea: id,
    zone: zoneFor(country),
    country,
    latitude: 40,
    longitude: -3,
    timezone: "Europe/Madrid",
    primarySource: "aemet",
    sourceIds: { aemet: "00000" },
    coastal: false,
  };
}

function forecastOf(
  locationId: string,
  overrides: Partial<LocationForecast> = {},
): LocationForecast {
  return {
    locationId,
    date: DATE,
    temperature: { maxC: 20, minC: 10 },
    sky: "despejado",
    precipitation: { mm: 0, probabilityPercent: 0 },
    snow: { cm: 0, present: false },
    wind: { speedKmh: 10, gustKmh: 10 },
    storm: false,
    calima: false,
    fog: false,
    marine: { status: "not_applicable" },
    alerts: { status: "ok", alerts: [] },
    provenance: { primary: "aemet" },
    primarySourceDescription: null,
    ...overrides,
  };
}

function entry(
  id: string,
  country: Country = "ES",
  overrides: Partial<LocationForecast> = {},
): LocationEntry {
  const location = place(id, country);
  return {
    location,
    forecast: forecastOf(id, overrides),
    mapLocation: {
      locationId: id,
      locationName: location.name,
      mapPokemonId: "charmander",
    },
  };
}

function measure(
  entries: LocationEntry[],
  scope: PatternScope,
  condition: PatternCondition,
) {
  return buildPatternFact(scope, condition, { entries, date: DATE });
}

function calimaAlert(): OfficialAlert {
  return {
    level: "amarillo",
    phenomenon: "calima",
    sourcePhenomenon: "Calima",
    startsAt: `${DATE}T00:00:00+02:00`,
    endsAt: `${DATE}T23:59:59+02:00`,
    source: "aemet",
    officialZoneId: "0000",
  };
}

function occurrence(
  phenomenon: OccurrencePhenomenon,
  polarity: "presente" | "ausente",
): PatternCondition {
  return { family: "occurrence", phenomenon, polarity };
}

describe("OCCURRENCE_POLARITIES", () => {
  it("viento y olas no admiten polaridad ausente", () => {
    expect(OCCURRENCE_POLARITIES.viento).toEqual(["presente"]);
    expect(OCCURRENCE_POLARITIES.olas).toEqual(["presente"]);
  });

  it("los demás fenómenos admiten presencia y ausencia", () => {
    for (const phenomenon of [
      "lluvia",
      "nieve",
      "tormenta",
      "niebla",
      "calima",
    ] as const) {
      expect(OCCURRENCE_POLARITIES[phenomenon]).toEqual([
        "presente",
        "ausente",
      ]);
    }
  });
});

describe("elegibilidad y recuento por eje", () => {
  it("lluvia: un mm null no es elegible; presente es mm > 0", () => {
    const entries = [
      entry("a", "ES", { precipitation: { mm: 3, probabilityPercent: 0 } }),
      entry("b", "ES", { precipitation: { mm: 0, probabilityPercent: 0 } }),
      entry("c", "ES", { precipitation: null }),
    ];

    expect(
      measure(entries, "map", occurrence("lluvia", "presente")).eligibleCount,
    ).toBe(2);
    expect(
      measure(entries, "map", occurrence("lluvia", "presente")).affectedCount,
    ).toBe(1);
    expect(
      measure(entries, "map", occurrence("lluvia", "ausente")).affectedCount,
    ).toBe(1);
  });

  it("nieve: exige cm numérico y cm > 0 para la presencia", () => {
    const entries = [
      entry("a", "ES", { snow: { cm: 5, present: true } }),
      entry("b", "ES", { snow: { cm: 0, present: false } }),
      entry("c", "ES", { snow: null }),
    ];

    expect(
      measure(entries, "map", occurrence("nieve", "presente")).eligibleCount,
    ).toBe(2);
    expect(
      measure(entries, "map", occurrence("nieve", "presente")).affectedCount,
    ).toBe(1);
  });

  it("viento: exige speedKmh numérico; presente solo si assignByWind lo asigna", () => {
    const entries = [
      entry("a", "ES", { wind: { speedKmh: 30, gustKmh: 40 } }),
      entry("b", "ES", { wind: { speedKmh: 10, gustKmh: 12 } }),
      entry("c", "ES", { wind: null }),
    ];

    expect(
      measure(entries, "map", occurrence("viento", "presente")).eligibleCount,
    ).toBe(2);
    expect(
      measure(entries, "map", occurrence("viento", "presente")).affectedCount,
    ).toBe(1);
  });

  it("tormenta y niebla: un booleano null no es elegible", () => {
    const storm = [
      entry("a", "ES", { storm: true }),
      entry("b", "ES", { storm: false }),
      entry("c", "ES", { storm: null }),
    ];
    expect(
      measure(storm, "map", occurrence("tormenta", "presente")).eligibleCount,
    ).toBe(2);
    expect(
      measure(storm, "map", occurrence("tormenta", "presente")).affectedCount,
    ).toBe(1);
    expect(
      measure(storm, "map", occurrence("tormenta", "ausente")).affectedCount,
    ).toBe(1);

    const fog = [
      entry("a", "ES", { fog: true }),
      entry("b", "ES", { fog: false }),
      entry("c", "ES", { fog: null }),
    ];
    expect(
      measure(fog, "map", occurrence("niebla", "presente")).eligibleCount,
    ).toBe(2);
    expect(
      measure(fog, "map", occurrence("niebla", "ausente")).affectedCount,
    ).toBe(1);
  });

  it("calima: un null sin aviso no es elegible; un aviso sí lo hace elegible y presente", () => {
    const entries = [
      entry("a", "ES", { calima: true }),
      entry("b", "ES", { calima: false }),
      entry("c", "ES", { calima: null }),
      entry("d", "ES", {
        calima: null,
        alerts: { status: "ok", alerts: [calimaAlert()] },
      }),
    ];

    const present = measure(entries, "map", occurrence("calima", "presente"));
    expect(present.eligibleCount).toBe(3);
    expect(present.affectedCount).toBe(2);
    expect(
      measure(entries, "map", occurrence("calima", "ausente")).affectedCount,
    ).toBe(1);
  });

  it("olas: solo con marine ok y waveHeightM no null cuenta como elegible", () => {
    const ok = (waveHeightM: number | null) =>
      ({
        status: "ok",
        data: {
          waveHeightM,
          wavePeriodS: 8,
          waveDirectionDeg: 90,
          source: "aemet",
        },
      }) as const;
    const entries = [
      entry("a", "ES", { marine: ok(1.5) }),
      entry("b", "ES", { marine: ok(0.5) }),
      entry("c", "ES", { marine: ok(null) }),
      entry("d", "ES", { marine: { status: "error" } }),
      entry("e", "ES", { marine: { status: "not_applicable" } }),
    ];

    const fact = measure(entries, "map", occurrence("olas", "presente"));
    expect(fact.eligibleCount).toBe(2);
    expect(fact.affectedCount).toBe(1);
  });

  it("cielo: un sky null no es elegible y la condición es una de las cuatro categorías", () => {
    const entries = [
      entry("a", "ES", { sky: "cubierto" }),
      entry("b", "ES", { sky: "despejado" }),
      entry("c", "ES", { sky: null }),
    ];

    const fact = measure(entries, "map", { family: "sky", value: "cubierto" });
    expect(fact.eligibleCount).toBe(2);
    expect(fact.affectedCount).toBe(1);
  });

  it("temperatura: la banda más baja es la realmente ocupada y nunca publica umbral", () => {
    const entries = [
      entry("a", "ES", { temperature: { maxC: 30, minC: 20 } }), // charmeleon
      entry("b", "ES", { temperature: { maxC: 10, minC: 2 } }), // solrock
      entry("c", "ES", { temperature: { maxC: 40, minC: 25 } }), // groudon
    ];

    expect(
      measure(entries, "map", { family: "temperature", extreme: "lowest" })
        .affectedCount,
    ).toBe(1);
    expect(
      measure(entries, "map", { family: "temperature", extreme: "highest" })
        .affectedCount,
    ).toBe(1);
  });
});

describe("affectedCount mide elegibles que cumplen, no el total del ámbito", () => {
  it("una ausencia uniforme cuenta todos los elegibles", () => {
    const entries = [
      entry("a", "ES", { precipitation: { mm: 0, probabilityPercent: 0 } }),
      entry("b", "ES", { precipitation: { mm: 0, probabilityPercent: 0 } }),
      entry("c", "PT", { precipitation: { mm: 0, probabilityPercent: 0 } }),
    ];

    const fact = measure(entries, "spain", occurrence("lluvia", "ausente"));
    expect(fact.eligibleCount).toBe(2);
    expect(fact.affectedCount).toBe(2);
    expect(fact.measures.prevalenceInternal).toBe(1);
  });
});

describe("las cinco medidas, contra el ámbito padre", () => {
  const entries = [
    entry("a", "ES", { precipitation: { mm: 5, probabilityPercent: 0 } }),
    entry("b", "ES", { precipitation: { mm: 0, probabilityPercent: 0 } }),
    entry("c", "PT", { precipitation: { mm: 0, probabilityPercent: 0 } }),
    entry("d", "AD", { precipitation: { mm: 8, probabilityPercent: 0 } }),
  ];
  const fact = measure(entries, "spain", occurrence("lluvia", "presente"));

  it("el respaldo: 1 de 2 en España", () => {
    expect(fact.kind).toBe("pattern");
    expect(fact.scope).toBe("spain");
    expect(fact.parentScope).toBe("map");
    expect(fact.scopeSize).toBe(2);
    expect(fact.eligibleCount).toBe(2);
    expect(fact.affectedCount).toBe(1);
    expect(fact.affectedLocations).toEqual([
      { locationId: "a", locationName: "a" },
    ]);
  });

  it("prevalenceInternal y prevalenceRest", () => {
    expect(fact.measures.prevalenceInternal).toBe(0.5);
    expect(fact.measures.prevalenceRest).toBe(0.5);
  });

  it("contrast = interno − resto", () => {
    expect(fact.measures.contrast).toBe(0);
  });

  it("concentration y overRepresentation", () => {
    expect(fact.measures.concentration).toBe(0.5);
    expect(fact.measures.overRepresentation).toBe(1);
  });
});

describe("las cinco medidas, para las tres familias", () => {
  const occurrenceUniverse = [
    entry("a", "ES", { precipitation: { mm: 5, probabilityPercent: 0 } }),
    entry("b", "ES", { precipitation: { mm: 0, probabilityPercent: 0 } }),
    entry("c", "PT", { precipitation: { mm: 0, probabilityPercent: 0 } }),
    entry("d", "AD", { precipitation: { mm: 8, probabilityPercent: 0 } }),
  ];

  const skyUniverse = [
    entry("a", "ES", { sky: "cubierto" }),
    entry("b", "ES", { sky: "cubierto" }),
    entry("c", "ES", { sky: "cubierto" }),
    entry("d", "ES", { sky: "nuboso" }),
    entry("e", "PT", { sky: "cubierto" }),
    entry("f", "PT", { sky: "nuboso" }),
    entry("g", "PT", { sky: "nuboso" }),
    entry("h", "PT", { sky: "nuboso" }),
  ];

  // El extremo de cada banda cae en un lado distinto: la más alta, en España
  // (46 °C, banda de Groudon primigenio); la más baja, en Portugal (8 °C, banda
  // de Solrock). Así se ve que la banda se fija en el universo global, no en la
  // región. Los valores caen en bandas claramente separadas.
  const temperatureUniverse = [
    entry("a", "ES", { temperature: { maxC: 46, minC: 30 } }),
    entry("b", "ES", { temperature: { maxC: 20, minC: 12 } }),
    entry("c", "ES", { temperature: { maxC: 20, minC: 12 } }),
    entry("d", "ES", { temperature: { maxC: 20, minC: 12 } }),
    entry("e", "PT", { temperature: { maxC: 8, minC: 2 } }),
    entry("f", "PT", { temperature: { maxC: 20, minC: 12 } }),
    entry("g", "PT", { temperature: { maxC: 20, minC: 12 } }),
    entry("h", "PT", { temperature: { maxC: 20, minC: 12 } }),
  ];

  const cases: {
    name: string;
    entries: LocationEntry[];
    condition: PatternCondition;
    size: number;
    expected: PatternMeasures;
  }[] = [
    {
      name: "occurrence",
      entries: occurrenceUniverse,
      condition: occurrence("lluvia", "presente"),
      size: 2,
      expected: {
        prevalenceInternal: 0.5,
        prevalenceRest: 0.5,
        contrast: 0,
        concentration: 0.5,
        overRepresentation: 1,
      },
    },
    {
      name: "sky",
      entries: skyUniverse,
      condition: { family: "sky", value: "cubierto" },
      size: 4,
      expected: {
        prevalenceInternal: 0.75,
        prevalenceRest: 0.25,
        contrast: 0.5,
        concentration: 0.75,
        overRepresentation: 1.5,
      },
    },
    {
      name: "temperature: la banda más alta",
      entries: temperatureUniverse,
      condition: { family: "temperature", extreme: "highest" },
      size: 4,
      expected: {
        prevalenceInternal: 0.25,
        prevalenceRest: 0,
        contrast: 0.25,
        concentration: 1,
        overRepresentation: 2,
      },
    },
    {
      name: "temperature: la banda más baja",
      entries: temperatureUniverse,
      condition: { family: "temperature", extreme: "lowest" },
      size: 4,
      expected: {
        prevalenceInternal: 0,
        prevalenceRest: 0.25,
        contrast: -0.25,
        concentration: 0,
        overRepresentation: 0,
      },
    },
  ];

  it.each(cases)(
    "$name: las cinco medidas exactas contra el ámbito padre",
    ({ entries, condition, size, expected }) => {
      const fact = measure(entries, "spain", condition);

      expect(fact.scopeSize).toBe(size);
      expect(fact.measures).toEqual(expected);
    },
  );

  it("la banda se decide en el universo global y luego se mide dentro del ámbito", () => {
    const hottest = measure(temperatureUniverse, "spain", {
      family: "temperature",
      extreme: "highest",
    });
    expect(hottest.affectedLocations).toEqual([
      { locationId: "a", locationName: "a" },
    ]);

    // La banda más baja del universo la fija Portugal (8 °C).
    // España no tiene ningún lugar en esa banda, así que `lowest` no afecta
    // a ningún lugar español: la banda no se recalcula dentro del ámbito.
    const coldest = measure(temperatureUniverse, "spain", {
      family: "temperature",
      extreme: "lowest",
    });
    expect(coldest.affectedCount).toBe(0);
    expect(coldest.affectedLocations).toEqual([]);
  });
});

describe("casos sin base", () => {
  it("sin elegibles en ningún lado, todas las medidas valen 0", () => {
    const entries = [
      entry("a", "ES", { precipitation: null }),
      entry("c", "PT", { precipitation: null }),
    ];

    const fact = measure(entries, "spain", occurrence("lluvia", "presente"));
    expect(fact.eligibleCount).toBe(0);
    expect(fact.affectedCount).toBe(0);
    expect(fact.measures).toEqual({
      prevalenceInternal: 0,
      prevalenceRest: 0,
      contrast: 0,
      concentration: 0,
      overRepresentation: 0,
    });
  });

  it("sin base en el resto el contraste es 0: la falta de dato no es prevalencia real", () => {
    const entries = [
      entry("a", "ES", { precipitation: { mm: 5, probabilityPercent: 0 } }),
      entry("b", "ES", { precipitation: { mm: 0, probabilityPercent: 0 } }),
    ];

    const fact = measure(entries, "spain", occurrence("lluvia", "presente"));
    expect(fact.measures.prevalenceInternal).toBe(0.5);
    expect(fact.measures.prevalenceRest).toBe(0);
    expect(fact.measures.contrast).toBe(0);
    expect(fact.measures.concentration).toBe(1);
    expect(fact.measures.overRepresentation).toBe(1);
  });

  it("el mapa no tiene padre: su contraste es 0 aunque haya presencia", () => {
    const entries = [
      entry("a", "ES", { precipitation: { mm: 5, probabilityPercent: 0 } }),
      entry("b", "ES", { precipitation: { mm: 0, probabilityPercent: 0 } }),
    ];

    const fact = measure(entries, "map", occurrence("lluvia", "presente"));
    expect(fact.parentScope).toBeNull();
    expect(fact.measures.prevalenceInternal).toBe(0.5);
    expect(fact.measures.prevalenceRest).toBe(0);
    expect(fact.measures.contrast).toBe(0);
    expect(fact.measures.concentration).toBe(0);
    expect(fact.measures.overRepresentation).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Candidatos, compuertas y selección de los tres roles.
// ---------------------------------------------------------------------------

const NORTHWEST = [
  "a-coruna",
  "lugo",
  "ourense",
  "pontevedra",
  "oviedo",
  "gijon",
];
const SOUTHEAST = ["jaen", "huescar", "granada", "almeria", "murcia", "alicante"];

const sky = (value: SkyCondition): PatternCondition => ({
  family: "sky",
  value,
});
const raining = occurrence("lluvia", "presente");
const dry = occurrence("lluvia", "ausente");

function spot({
  id,
  country = "ES",
  zone,
  forecast = {},
}: {
  id: string;
  country?: Country;
  zone?: LocationZone;
  forecast?: Partial<LocationForecast>;
}): LocationEntry {
  const location = place(id, country);
  return {
    location: zone ? { ...location, zone } : location,
    forecast: forecastOf(id, forecast),
    mapLocation: { locationId: id, locationName: id, mapPokemonId: "charmander" },
  };
}

function row(
  count: number,
  prefix: string,
  forecast: Partial<LocationForecast> = {},
): LocationEntry[] {
  return Array.from({ length: count }, (_, index) =>
    spot({ id: `${prefix}${index}`, forecast }),
  );
}

const QUIET: Partial<LocationForecast> = {
  sky: null,
  snow: null,
  wind: null,
  storm: null,
  fog: null,
  calima: null,
  marine: { status: "not_applicable" },
};

function marineOk(waveHeightM: number | null) {
  return {
    status: "ok",
    data: { waveHeightM, wavePeriodS: 8, waveDirectionDeg: 90, source: "aemet" },
  } as const;
}

function candidatesOf(entries: LocationEntry[]): BriefingCandidate[] {
  return briefingCandidates({ entries, date: DATE });
}

function candidateFor(
  candidates: BriefingCandidate[],
  scope: PatternScope,
  condition: PatternCondition,
): BriefingCandidate | undefined {
  return candidates.find(
    (candidate) =>
      candidate.fact.scope === scope &&
      JSON.stringify(candidate.fact.condition) === JSON.stringify(condition),
  );
}

function calendarFact(): CalendarFact {
  return { kind: "calendar", date: DATE, weekday: "viernes", weekend: false };
}

function dayShapeFact(totalLocations: number): DayShapeFact {
  return {
    kind: "day_shape",
    totalLocations,
    rainingLocations: 0,
    alertedLocations: 0,
    distinctPokemonCount: 1,
  };
}

function temperatureFact(locationId: string, maxC: number): TemperatureFact {
  return {
    kind: "temperature",
    locationId,
    locationName: locationId,
    mapPokemonId: "charmander",
    mapRepresentsFact: true,
    role: "hottest",
    maxC,
    minC: 0,
  };
}

function rainFact(locationId: string, mm: number): RainFact {
  return {
    kind: "rain",
    locationId,
    locationName: locationId,
    mapPokemonId: "kyogre",
    mapRepresentsFact: true,
    mm,
    probabilityPercent: null,
  };
}

function alertFact(
  level: AlertLevel,
  phenomenon: AlertPhenomenon = "calima",
): AlertFact {
  return {
    kind: "alert",
    level,
    phenomenon,
    sourcePhenomenon: phenomenon,
    officialZoneId: "0000",
    source: "aemet",
    affectedLocations: [],
    affectedLocationCount: 0,
  };
}

function brief(
  entries: LocationEntry[],
  decision: DayModeDecision,
  facts?: NarrativeFact[],
) {
  return buildBriefing({
    source: { entries, date: DATE },
    facts: facts ?? [calendarFact(), dayShapeFact(entries.length)],
    decision,
  });
}

const PARTE: DayModeDecision = { mode: "parte", trigger: null };
const ALERT: DayModeDecision = { mode: "alerta", trigger: alertFact("naranja") };

describe("la constante de materialidad", () => {
  it("fija el contraste material en 2", () => {
    expect(MATERIAL_CONTRAST_MIN_OVER_REPRESENTATION).toBe(2);
  });
});

describe("materialización de candidatos", () => {
  it("nunca genera una ausencia de viento ni de olas", () => {
    const entries = [
      spot({
        id: "a",
        forecast: { wind: { speedKmh: 40, gustKmh: 50 }, marine: marineOk(2) },
      }),
      spot({
        id: "b",
        forecast: { wind: { speedKmh: 5, gustKmh: 6 }, marine: marineOk(0.5) },
      }),
    ];

    const offender = candidatesOf(entries).find(
      (candidate) =>
        candidate.fact.condition.family === "occurrence" &&
        (candidate.fact.condition.phenomenon === "viento" ||
          candidate.fact.condition.phenomenon === "olas") &&
        candidate.fact.condition.polarity === "ausente",
    );
    expect(offender).toBeUndefined();
  });

  it("una sola banda ocupada no produce ningún candidato térmico", () => {
    const candidates = candidatesOf(row(6, "x"));
    expect(
      candidates.some(
        (candidate) => candidate.fact.condition.family === "temperature",
      ),
    ).toBe(false);
  });

  it("con más de una banda sí hay temperatura, pero jamás en el mapa", () => {
    // La banda superior se concentra en el noroeste: así localiza (contraste
    // positivo) y compite; en el mapa seguiría siendo tautológica.
    const entries = [
      ...NORTHWEST.map((id) =>
        spot({ id, forecast: { temperature: { maxC: 46, minC: 30 } } }),
      ),
      ...row(12, "mid", { temperature: { maxC: 20, minC: 10 } }),
    ];
    const candidates = candidatesOf(entries);

    expect(
      candidates.some(
        (candidate) => candidate.fact.condition.family === "temperature",
      ),
    ).toBe(true);
    expect(
      candidates.some(
        (candidate) =>
          candidate.fact.scope === "map" &&
          candidate.fact.condition.family === "temperature",
      ),
    ).toBe(false);
  });
});

describe("compuerta de tamaño por región", () => {
  const cases: Array<[number, readonly string[]]> = [
    [6, ["overview", "highlight", "secondary"]],
    [5, ["secondary"]],
    [3, ["secondary"]],
    [2, []],
  ];

  it.each(cases)(
    "el noroeste con %i elegibles juega los roles %j",
    (size, expected) => {
      const entries = NORTHWEST.slice(0, size).map((id) =>
        spot({ id, forecast: { sky: "cubierto" } }),
      );
      const candidate = candidateFor(
        candidatesOf(entries),
        "region:northwest",
        sky("cubierto"),
      );
      expect(candidate?.roles ?? []).toEqual(expected);
    },
  );

  it("la compuerta también aplica a un grupo derivado", () => {
    const entries = Array.from({ length: 6 }, (_, index) =>
      spot({
        id: `canaria-${index}`,
        zone: "Canarias",
        forecast: { sky: "cubierto" },
      }),
    );
    const candidate = candidateFor(
      candidatesOf(entries),
      "region:canarias",
      sky("cubierto"),
    );
    expect(candidate?.roles).toEqual(["overview", "highlight", "secondary"]);
  });
});

describe("condición informativa", () => {
  it("una ausencia uniforme en el mapa se descarta", () => {
    const entries = row(3, "x", {
      precipitation: { mm: 0, probabilityPercent: 0 },
    });
    expect(candidateFor(candidatesOf(entries), "map", dry)).toBeUndefined();
  });

  it("una presencia uniforme sí es candidata", () => {
    const entries = row(3, "x", {
      precipitation: { mm: 5, probabilityPercent: 0 },
    });
    expect(
      candidateFor(candidatesOf(entries), "map", raining)?.fact.affectedCount,
    ).toBe(3);
  });

  it("una ausencia regional contrasta cuando el padre tiene lluvia", () => {
    const entries = [
      ...NORTHWEST.map((id) =>
        spot({ id, forecast: { precipitation: { mm: 0, probabilityPercent: 0 } } }),
      ),
      ...row(4, "wet", { precipitation: { mm: 5, probabilityPercent: 0 } }),
    ];
    const candidate = candidateFor(
      candidatesOf(entries),
      "region:northwest",
      dry,
    );
    expect(candidate?.fact.affectedCount).toBe(6);
    expect(candidate?.fact.measures.contrast).toBeGreaterThan(0);
  });

  it("una ausencia uniforme no se vuelve informativa por un resto sin elegibles", () => {
    const entries = NORTHWEST.map((id) =>
      spot({ id, forecast: { precipitation: { mm: 0, probabilityPercent: 0 } } }),
    );
    expect(candidateFor(candidatesOf(entries), "region:northwest", dry)).toBeUndefined();
  });
});

describe("compuerta de España", () => {
  it("pasa con cobertura amplia, tres zonas y concentración moderada", () => {
    const entries = [
      spot({ id: "g1", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "g2", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "a1", zone: "Andalucía", forecast: { sky: "cubierto" } }),
      spot({ id: "a2", zone: "Andalucía", forecast: { sky: "cubierto" } }),
      spot({ id: "c1", zone: "Cataluña", forecast: { sky: "cubierto" } }),
      spot({ id: "c2", zone: "Cataluña", forecast: { sky: "cubierto" } }),
      spot({ id: "ar1", zone: "Aragón", forecast: { sky: "cubierto" } }),
    ];
    expect(
      candidateFor(candidatesOf(entries), "spain", sky("cubierto")),
    ).toBeDefined();
  });

  it("cae si no alcanza dos tercios de cobertura", () => {
    const entries = [
      spot({ id: "g1", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "a1", zone: "Andalucía", forecast: { sky: "cubierto" } }),
      spot({ id: "c1", zone: "Cataluña", forecast: { sky: "cubierto" } }),
      spot({ id: "ar1", zone: "Aragón", forecast: { sky: "despejado" } }),
      spot({
        id: "v1",
        zone: "Comunidad Valenciana",
        forecast: { sky: "despejado" },
      }),
      spot({
        id: "m1",
        zone: "Comunidad de Madrid",
        forecast: { sky: "despejado" },
      }),
      spot({ id: "e1", zone: "Extremadura", forecast: { sky: "despejado" } }),
    ];
    expect(
      candidateFor(candidatesOf(entries), "spain", sky("cubierto")),
    ).toBeUndefined();
  });

  it("cae si los afectados viven en menos de tres zonas", () => {
    const entries = [
      spot({ id: "g1", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "g2", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "g3", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "g4", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "a1", zone: "Andalucía", forecast: { sky: "cubierto" } }),
      spot({ id: "a2", zone: "Andalucía", forecast: { sky: "cubierto" } }),
      spot({ id: "a3", zone: "Andalucía", forecast: { sky: "cubierto" } }),
    ];
    expect(
      candidateFor(candidatesOf(entries), "spain", sky("cubierto")),
    ).toBeUndefined();
  });

  it("cae si una zona concentra más de dos tercios de los afectados", () => {
    const entries = [
      spot({ id: "g1", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "g2", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "g3", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "g4", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "g5", zone: "Galicia", forecast: { sky: "cubierto" } }),
      spot({ id: "a1", zone: "Andalucía", forecast: { sky: "cubierto" } }),
      spot({ id: "c1", zone: "Cataluña", forecast: { sky: "cubierto" } }),
    ];
    expect(
      candidateFor(candidatesOf(entries), "spain", sky("cubierto")),
    ).toBeUndefined();
  });
});

describe("selección de highlight", () => {
  it("en modo alerta es exactamente el hecho que ya decide la 007", () => {
    const trigger = alertFact("rojo");
    const decision: DayModeDecision = { mode: "alerta", trigger };
    const entries = NORTHWEST.map((id) =>
      spot({ id, forecast: { sky: "cubierto" } }),
    );
    const briefing = brief(entries, decision, [
      calendarFact(),
      dayShapeFact(entries.length),
      trigger,
    ]);

    expect(briefing.highlight.role).toBe("highlight");
    expect(briefing.highlight.fact).toBe(trigger);
  });

  it("un aviso amarillo no tiene prioridad absoluta", () => {
    const entries = NORTHWEST.map((id) =>
      spot({ id, forecast: { sky: "cubierto" } }),
    );
    const yellow = alertFact("amarillo");
    const briefing = brief(entries, PARTE, [
      calendarFact(),
      dayShapeFact(entries.length),
      yellow,
    ]);

    expect(briefing.highlight.fact).not.toBe(yellow);
    expect(briefing.highlight.fact.kind).toBe("pattern");
  });
});

describe("selección de overview", () => {
  it("toma el patrón de mayor extensión — la categoría de cielo dominante", () => {
    // Portugal, Andorra y Canarias dan un «resto» real a cada ámbito: así el
    // contraste de los patrones regionales se mide sobre una base de verdad y
    // no sobre un resto vacío (`eligibleRest === 0`).
    const entries = [
      ...NORTHWEST.map((id) => spot({ id, forecast: { sky: "nuboso" } })),
      ...SOUTHEAST.map((id) => spot({ id, forecast: { sky: "nuboso" } })),
      ...row(6, "mid", { sky: "nuboso" }),
      spot({ id: "pt0", country: "PT" }),
      spot({ id: "pt1", country: "PT" }),
      spot({ id: "ad0", country: "AD" }),
      spot({ id: "gc0", zone: "Canarias" }),
    ];
    const overview = brief(entries, ALERT).overview.fact;

    expect(overview.kind).toBe("pattern");
    const fact = overview as PatternFact;
    expect(fact.condition).toEqual(sky("nuboso"));
    expect(fact.affectedCount).toBe(18);
  });
});

describe("selección de secondary", () => {
  it("toma el patrón regional de contraste material", () => {
    const entries = [
      ...NORTHWEST.map((id) =>
        spot({ id, forecast: { sky: "cubierto" } }),
      ),
      ...row(12, "dry", { sky: "despejado" }),
    ];
    const secondary = brief(entries, ALERT).secondary.fact;

    expect(secondary.kind).toBe("pattern");
    const fact = secondary as PatternFact;
    expect(fact.scope).toBe("region:northwest");
    expect(fact.measures.overRepresentation).toBe(3);
  });

  // El resto (Portugal, Andorra y Canarias) da base a cada ámbito: así las
  // ausencias uniformes se descartan y la selección se decide por el cielo.
  function thresholdUniverse(
    northwestCovered: number,
    rest: number,
    restCovered: number,
  ): LocationEntry[] {
    return [
      ...NORTHWEST.map((id, index) =>
        spot({ id, forecast: { sky: index < northwestCovered ? "cubierto" : "despejado" } }),
      ),
      ...Array.from({ length: rest }, (_, index) =>
        spot({ id: `n${index}`, forecast: { sky: index < restCovered ? "cubierto" : "despejado" } }),
      ),
      spot({ id: "c0", zone: "Canarias" }),
      spot({ id: "pt0", country: "PT" }),
      spot({ id: "pt1", country: "PT" }),
      spot({ id: "ad0", country: "AD" }),
    ];
  }

  const thresholdCases: Array<{
    name: string;
    northwestCovered: number;
    rest: number;
    restCovered: number;
    material: boolean;
  }> = [
    { name: "por debajo del límite", northwestCovered: 4, rest: 12, restCovered: 4, material: false },
    { name: "justo en el límite", northwestCovered: 5, rest: 5, restCovered: 0, material: true },
    { name: "por encima del límite", northwestCovered: 5, rest: 11, restCovered: 0, material: true },
  ];

  it.each(thresholdCases)(
    "$name: $material como contraste material",
    ({ northwestCovered, rest, restCovered, material }) => {
      const entries = thresholdUniverse(northwestCovered, rest, restCovered);
      const secondary = brief(entries, ALERT).secondary.fact;
      const isNorthwest =
        secondary.kind === "pattern" &&
        (secondary as PatternFact).scope === "region:northwest" &&
        (secondary as PatternFact).condition.family === "sky";

      expect(isNorthwest).toBe(material);
    },
  );
});

describe("A4 — la ausencia global no compite por overview", () => {
  const ZONES = ["Galicia", "Aragón", "Comunidad de Madrid"] as const;

  function globalAbsenceUniverse(): LocationEntry[] {
    return Array.from({ length: 9 }, (_, index) =>
      spot({
        id: `g${index}`,
        zone: ZONES[index % ZONES.length],
        forecast: {
          precipitation:
            index < 8
              ? { mm: 0, probabilityPercent: 0 }
              : { mm: 3, probabilityPercent: 0 },
          sky: index < 4 ? "nuboso" : "cubierto",
        },
      }),
    );
  }

  it.each(["map", "spain", "iberian-peninsula"] as const)(
    "%s + occurrence/ausente sigue siendo candidato pero no gana overview",
    (scope) => {
      const entries = globalAbsenceUniverse();
      expect(candidateFor(candidatesOf(entries), scope, dry)).toBeDefined();

      const overview = brief(entries, ALERT).overview.fact as PatternFact;
      const isGlobalAbsence =
        overview.scope === scope &&
        overview.condition.family === "occurrence" &&
        overview.condition.polarity === "ausente";

      expect(overview.kind).toBe("pattern");
      expect(isGlobalAbsence).toBe(false);
      expect(overview.condition.family).toBe("sky");
    },
  );

  it("una ausencia regional con contraste y compuerta suficiente sí puede ser overview", () => {
    const entries = [
      ...NORTHWEST.map((id) =>
        spot({
          id,
          forecast: {
            precipitation: { mm: 0, probabilityPercent: 0 },
            sky: "nuboso",
          },
        }),
      ),
      ...row(6, "wet", {
        precipitation: { mm: 3, probabilityPercent: 0 },
        sky: "cubierto",
      }),
    ];

    const overview = brief(entries, ALERT).overview.fact as PatternFact;
    expect(overview.kind).toBe("pattern");
    expect(overview.scope).toBe("region:northwest");
    expect(overview.condition).toEqual(dry);
    expect(overview.measures.contrast).toBeGreaterThan(0);
  });

  it("una ausencia regional sin contraste no compite por overview", () => {
    const entries = [
      ...NORTHWEST.map((id, index) =>
        spot({
          id,
          forecast: {
            precipitation:
              index < 4
                ? { mm: 0, probabilityPercent: 0 }
                : { mm: 3, probabilityPercent: 0 },
            sky: "nuboso",
          },
        }),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        spot({
          id: `dry${index}`,
          forecast: {
            precipitation:
              index < 4
                ? { mm: 0, probabilityPercent: 0 }
                : { mm: 3, probabilityPercent: 0 },
            sky: "cubierto",
          },
        }),
      ),
    ];

    const candidate = candidateFor(candidatesOf(entries), "region:northwest", dry);
    expect(candidate).toBeDefined();
    expect(candidate?.fact.measures.contrast).toBe(0);

    const overview = brief(entries, ALERT).overview.fact as PatternFact;
    const isNorthwestAbsence =
      overview.scope === "region:northwest" &&
      overview.condition.family === "occurrence" &&
      overview.condition.polarity === "ausente";

    expect(overview.kind).toBe("pattern");
    expect(isNorthwestAbsence).toBe(false);
  });

  it("una occurrence presente sigue compitiendo por overview", () => {
    const entries = Array.from({ length: 9 }, (_, index) =>
      spot({
        id: `p${index}`,
        zone: ZONES[index % ZONES.length],
        forecast: {
          precipitation:
            index < 8
              ? { mm: 3, probabilityPercent: 0 }
              : { mm: 0, probabilityPercent: 0 },
          sky: index < 4 ? "nuboso" : "cubierto",
        },
      }),
    );

    const overview = brief(entries, ALERT).overview.fact as PatternFact;
    expect(overview.kind).toBe("pattern");
    expect(overview.scope).toBe("map");
    expect(overview.condition).toEqual(raining);
  });

  it("el cielo conserva su regla y gana overview sin cambios", () => {
    const entries = Array.from({ length: 9 }, (_, index) =>
      spot({
        id: `s${index}`,
        forecast: {
          precipitation: null,
          sky: index < 7 ? "nuboso" : "despejado",
        },
      }),
    );

    const overview = brief(entries, ALERT).overview.fact as PatternFact;
    expect(overview.kind).toBe("pattern");
    expect(overview.condition).toEqual(sky("nuboso"));
  });

  it("la temperatura conserva su regla y puede ganar overview", () => {
    const entries = [
      ...NORTHWEST.map((id, index) =>
        spot({
          id,
          forecast: {
            temperature: { maxC: 30, minC: 10 },
            sky: index < 3 ? "nuboso" : "cubierto",
            precipitation: null,
          },
        }),
      ),
      ...row(2, "cool", {
        temperature: { maxC: 20, minC: 10 },
        sky: "despejado",
        precipitation: null,
      }),
    ];

    const overview = brief(entries, ALERT).overview.fact as PatternFact;
    expect(overview.kind).toBe("pattern");
    expect(overview.scope).toBe("region:northwest");
    expect(overview.condition).toEqual({
      family: "temperature",
      extreme: "highest",
    });
  });
});

describe("B — olas/presente no compite por secondary", () => {
  function olasUniverse(): LocationEntry[] {
    return [
      ...NORTHWEST.map((id) =>
        spot({
          id,
          forecast: {
            marine: marineOk(2),
            sky: "despejado",
            precipitation: { mm: 0, probabilityPercent: 0 },
          },
        }),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        spot({
          id: `rest${index}`,
          forecast: {
            marine: marineOk(0.5),
            sky: "cubierto",
            precipitation: { mm: 0, probabilityPercent: 0 },
          },
        }),
      ),
    ];
  }

  it("olas/presente nunca es secondary y gana el siguiente material", () => {
    const entries = olasUniverse();
    expect(
      candidateFor(
        candidatesOf(entries),
        "region:northwest",
        occurrence("olas", "presente"),
      ),
    ).toBeDefined();

    const secondary = brief(entries, ALERT).secondary.fact as PatternFact;
    expect(secondary.kind).toBe("pattern");
    expect(secondary.condition).not.toEqual(occurrence("olas", "presente"));
    expect(secondary.scope).toBe("region:northwest");
    expect(secondary.condition).toEqual(sky("despejado"));
  });

  it("olas sigue siendo candidato y puede ocupar highlight", () => {
    const entries = olasUniverse();
    expect(
      candidateFor(
        candidatesOf(entries),
        "region:northwest",
        occurrence("olas", "presente"),
      ),
    ).toBeDefined();

    const highlight = brief(entries, PARTE).highlight.fact as PatternFact;
    expect(highlight.kind).toBe("pattern");
    expect(highlight.scope).toBe("region:northwest");
    expect(highlight.condition).toEqual(occurrence("olas", "presente"));
  });

  it("otro phenomenon de ocurrencia no recibe la excepción", () => {
    const entries = [
      ...NORTHWEST.map((id) =>
        spot({
          id,
          forecast: {
            precipitation: { mm: 3, probabilityPercent: 0 },
            sky: "despejado",
          },
        }),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        spot({
          id: `dry${index}`,
          forecast: {
            precipitation: { mm: 0, probabilityPercent: 0 },
            sky: "despejado",
          },
        }),
      ),
    ];

    const secondary = brief(entries, ALERT).secondary.fact as PatternFact;
    expect(secondary.kind).toBe("pattern");
    expect(secondary.scope).toBe("region:northwest");
    expect(secondary.condition).toEqual(raining);
  });
});

describe("no repetición", () => {
  it("un ámbito global y una región con el mismo conjunto no repiten", () => {
    const entries = NORTHWEST.map((id) =>
      spot({ id, forecast: { sky: "cubierto" } }),
    );
    const briefing = brief(entries, ALERT);
    const patterns = [briefing.overview.fact, briefing.highlight.fact, briefing.secondary.fact].filter(
      (fact): fact is PatternFact => fact.kind === "pattern",
    );

    const seen = new Set<string>();
    const duplicated = patterns.some((fact) => {
      const key = `${JSON.stringify(fact.condition)}#${fact.affectedLocations
        .map((place) => place.locationId)
        .sort()
        .join("|")}`;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });

    expect(duplicated).toBe(false);
    expect(patterns.map((fact) => fact.scope)).not.toContain("region:northwest");
  });

  it("como mucho una afirmación regional por fenómeno y día", () => {
    const entries = [
      ...NORTHWEST.map((id) =>
        spot({ id, forecast: { sky: "cubierto" } }),
      ),
      ...SOUTHEAST.map((id) =>
        spot({ id, forecast: { sky: "cubierto" } }),
      ),
      ...row(12, "dry", { sky: "despejado" }),
    ];
    const briefing = brief(entries, ALERT);
    const regionalCubierto = [briefing.overview.fact, briefing.highlight.fact, briefing.secondary.fact].filter(
      (fact): fact is PatternFact =>
        fact.kind === "pattern" &&
        fact.condition.family === "sky" &&
        fact.condition.value === "cubierto" &&
        (fact.scope === "region:northwest" || fact.scope === "region:southeast"),
    );

    expect(regionalCubierto).toHaveLength(1);
    expect(regionalCubierto[0].scope).toBe("region:northwest");
  });
});

describe("deduplicación por eje", () => {
  it("lluvia presente y lluvia ausente no conviven como dos afirmaciones regionales del mismo fenómeno", () => {
    const entries = [
      ...NORTHWEST.map((id) =>
        spot({ id, forecast: { ...QUIET, precipitation: { mm: 5, probabilityPercent: 0 } } }),
      ),
      ...SOUTHEAST.map((id) =>
        spot({ id, forecast: { ...QUIET, precipitation: { mm: 0, probabilityPercent: 0 } } }),
      ),
      ...row(12, "mid", { ...QUIET, precipitation: { mm: 5, probabilityPercent: 0 } }),
    ];

    const regionalRain = candidatesOf(entries).filter(
      (candidate) =>
        candidate.regional &&
        candidate.fact.condition.family === "occurrence" &&
        candidate.fact.condition.phenomenon === "lluvia",
    );
    const polarities = new Set(
      regionalRain.map((candidate) =>
        candidate.fact.condition.family === "occurrence" ? candidate.fact.condition.polarity : null,
      ),
    );
    expect(polarities).toEqual(new Set(["presente", "ausente"]));

    const briefing = brief(entries, PARTE);
    const chosenRegionalRain = [
      briefing.overview.fact,
      briefing.highlight.fact,
      briefing.secondary.fact,
    ].filter(
      (fact): fact is PatternFact =>
        fact.kind === "pattern" &&
        fact.condition.family === "occurrence" &&
        fact.condition.phenomenon === "lluvia" &&
        fact.scope.startsWith("region:"),
    );
    expect(chosenRegionalRain).toHaveLength(1);
  });

  it("temperatura highest y lowest no conviven como dos afirmaciones térmicas regionales", () => {
    const entries = [
      ...NORTHWEST.map((id) =>
        spot({ id, forecast: { ...QUIET, temperature: { maxC: 46, minC: 30 } } }),
      ),
      ...SOUTHEAST.map((id) =>
        spot({ id, forecast: { ...QUIET, temperature: { maxC: 0, minC: -10 } } }),
      ),
      ...row(12, "mid", { ...QUIET, temperature: { maxC: 20, minC: 10 } }),
    ];

    const regionalThermal = candidatesOf(entries).filter(
      (candidate) => candidate.regional && candidate.fact.condition.family === "temperature",
    );
    const extremes = new Set(
      regionalThermal.map((candidate) =>
        candidate.fact.condition.family === "temperature" ? candidate.fact.condition.extreme : null,
      ),
    );
    expect(extremes).toEqual(new Set(["highest", "lowest"]));

    const briefing = brief(entries, PARTE);
    const chosenThermalRegional = [
      briefing.overview.fact,
      briefing.highlight.fact,
      briefing.secondary.fact,
    ].filter(
      (fact): fact is PatternFact =>
        fact.kind === "pattern" &&
        fact.condition.family === "temperature" &&
        fact.scope.startsWith("region:"),
    );
    expect(chosenThermalRegional).toHaveLength(1);
  });
});

describe("día degenerado", () => {
  it("sin cielo y con todos los ejes a null rellena los tres roles sin abortar", () => {
    const bare: Partial<LocationForecast> = {
      sky: null,
      precipitation: null,
      snow: null,
      wind: null,
      storm: null,
      fog: null,
      calima: null,
      marine: { status: "not_applicable" },
      alerts: { status: "ok", alerts: [] },
    };
    const entries = row(4, "x", bare);
    const facts: NarrativeFact[] = [
      calendarFact(),
      dayShapeFact(4),
      temperatureFact("x0", 20),
    ];

    const briefing = brief(entries, PARTE, facts);

    expect(briefing.highlight.fact).toBe(facts[2]);
    expect(briefing.overview.fact).toBe(facts[0]);
    expect(briefing.secondary.fact).toBe(facts[1]);
  });
});

describe("reducción de hechos locales por severidad", () => {
  // Un día degenerado: ningún patrón compite, así que los roles degradan a los
  // hechos locales y se puede observar qué sobrevive a la reducción intra-fenómeno.
  const entries = row(4, "x", { ...QUIET, precipitation: null });

  it("a igual banda sobrevive el primero por orden estable", () => {
    // 20 °C y 22 °C caen en la misma banda de la 003 (castform-sun).
    const first = temperatureFact("x0", 20);
    const second = temperatureFact("x1", 22);
    const briefing = brief(entries, PARTE, [
      calendarFact(),
      dayShapeFact(4),
      first,
      second,
    ]);

    expect(briefing.highlight.fact).toBe(first);
  });

  it("entre bandas distintas sobrevive el de la banda superior", () => {
    // 20 °C es castform-sun; 27 °C es charmander, una banda superior.
    const lower = temperatureFact("x0", 20);
    const higher = temperatureFact("x1", 27);
    const briefing = brief(entries, PARTE, [
      calendarFact(),
      dayShapeFact(4),
      lower,
      higher,
    ]);

    expect(briefing.highlight.fact).toBe(higher);
  });

  it("fenómenos distintos sobreviven los dos a la reducción", () => {
    const heat = temperatureFact("x0", 20);
    const rain = rainFact("x1", 5);
    const briefing = brief(entries, PARTE, [
      calendarFact(),
      dayShapeFact(4),
      heat,
      rain,
    ]);

    expect(briefing.highlight.fact).toBe(heat);
    expect(briefing.secondary.fact).toBe(rain);
  });
});

describe("determinismo", () => {
  it("la misma entrada produce el mismo parte", () => {
    const entries = [
      ...NORTHWEST.map((id) =>
        spot({ id, forecast: { sky: "cubierto" } }),
      ),
      ...row(12, "dry", { sky: "despejado" }),
    ];
    const facts = [calendarFact(), dayShapeFact(entries.length)];
    const decision: DayModeDecision = { mode: "alerta", trigger: alertFact("naranja") };

    const first = buildBriefing({ source: { entries, date: DATE }, facts, decision });
    const second = buildBriefing({ source: { entries, date: DATE }, facts, decision });

    expect(second).toEqual(first);
  });
});
