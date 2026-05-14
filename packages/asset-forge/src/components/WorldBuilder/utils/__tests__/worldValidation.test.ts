/**
 * `worldValidation` — type-guard + migration + game-export +
 * reference-check tests.
 *
 * Four exports, each operating on the same WorldData shape but
 * producing different result types:
 *
 *   - `validateWorldData(data: unknown): data is SerializedWorldData`
 *     Type guard for the on-disk shape — must reject every category
 *     of malformation independently (top-level scalar types,
 *     foundation arrays, layer arrays + override Records).
 *
 *   - `migrateWorldData(data)` — best-effort backfill of missing
 *     fields with sensible defaults. Bumps version to ≥ 1.
 *
 *   - `validateGameExport(world)` — emits structured
 *     ExportValidationError[] (errors block export, warnings allow
 *     it). Pinned: world-size 10 floor, 1000 perf warning;
 *     seed=0 warning; duplicate town name; close-spacing (<100m)
 *     warning; orphaned building tied to non-existent town;
 *     empty-town warning; invalid building type / dims.
 *
 *   - `validateWorldReferences(world)` — referential-integrity
 *     check for buildings→towns, roads→towns, NPC parentContext,
 *     quest giver/turn-in/locations, difficultyZone bounds,
 *     orphaned biome/town overrides.
 */

import { describe, expect, it } from "vitest";
import {
  migrateWorldData,
  validateGameExport,
  validateWorldData,
  validateWorldReferences,
} from "../worldValidation";
import type { SerializedWorldData } from "../worldSerialization";
import type {
  GeneratedBuilding,
  GeneratedRoad,
  GeneratedTown,
  PlacedNPC,
  PlacedQuest,
  WorldCreationConfig,
  WorldData,
} from "../../types";

// ----- fixtures -------------------------------------------------------------

function makeConfig(): WorldCreationConfig {
  return {
    seed: 42,
    terrain: {
      tileSize: 32,
      worldSize: 16,
      tileResolution: 32,
      maxHeight: 200,
      waterThreshold: 8,
    },
    towns: { townCount: 3, minTownSpacing: 100, biomePreferences: {} },
    roads: {
      roadWidth: 4,
      pathStepSize: 2,
      extraConnectionsRatio: 0.2,
      smoothingIterations: 2,
      costSlopeMultiplier: 1.5,
      costWaterPenalty: 5,
      heuristicWeight: 1,
    },
  } as unknown as WorldCreationConfig;
}

function makeSerialized(
  overrides: Partial<SerializedWorldData> = {},
): SerializedWorldData {
  return {
    id: "w",
    name: "n",
    description: "",
    version: 1,
    createdAt: 1,
    modifiedAt: 2,
    foundationLocked: true,
    foundation: {
      version: 1,
      createdAt: 1,
      config: makeConfig(),
      biomes: [],
      towns: [],
      buildings: [],
      roads: [],
    },
    layers: {
      biomeOverrides: {},
      townOverrides: {},
      npcs: [],
      quests: [],
      bosses: [],
      events: [],
      lore: [],
      difficultyZones: [],
      customPlacements: [],
    },
    ...overrides,
  };
}

function makeWorld(overrides: Partial<WorldData> = {}): WorldData {
  return {
    id: "w",
    name: "n",
    description: "",
    version: 1,
    createdAt: 1,
    modifiedAt: 2,
    foundationLocked: true,
    foundation: {
      version: 1,
      createdAt: 1,
      config: makeConfig(),
      biomes: [],
      towns: [],
      buildings: [],
      roads: [],
      heightmapCache: new Map(),
    },
    layers: {
      biomeOverrides: new Map(),
      townOverrides: new Map(),
      npcs: [],
      quests: [],
      bosses: [],
      events: [],
      lore: [],
      difficultyZones: [],
      customPlacements: [],
      customRoads: [],
    },
    ...overrides,
  };
}

function makeTown(over: Partial<GeneratedTown> = {}): GeneratedTown {
  return {
    id: "t1",
    name: "Hamlet",
    position: { x: 0, y: 0, z: 0 },
    size: "hamlet",
    ...over,
  } as GeneratedTown;
}

function makeBuilding(
  over: Partial<GeneratedBuilding> = {},
): GeneratedBuilding {
  return {
    id: "b1",
    name: "Inn",
    townId: "t1",
    type: "inn",
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width: 10, depth: 10, height: 5 },
    ...over,
  } as GeneratedBuilding;
}

// ============================================================================
// validateWorldData (type guard)
// ============================================================================

describe("validateWorldData — rejection cases", () => {
  it("rejects null / non-objects", () => {
    expect(validateWorldData(null)).toBe(false);
    expect(validateWorldData(42)).toBe(false);
    expect(validateWorldData("string")).toBe(false);
  });

  it("rejects missing or wrong-typed top-level scalars", () => {
    expect(validateWorldData(makeSerialized({ id: 42 as never }))).toBe(false);
    expect(validateWorldData(makeSerialized({ name: 0 as never }))).toBe(false);
    expect(validateWorldData(makeSerialized({ version: "1" as never }))).toBe(
      false,
    );
    expect(
      validateWorldData(makeSerialized({ foundationLocked: "true" as never })),
    ).toBe(false);
  });

  it("rejects when foundation arrays are not arrays", () => {
    expect(
      validateWorldData(
        makeSerialized({
          foundation: {
            ...makeSerialized().foundation,
            biomes: {} as never,
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects when layer arrays are not arrays", () => {
    expect(
      validateWorldData(
        makeSerialized({
          layers: {
            ...makeSerialized().layers,
            npcs: {} as never,
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects when override Records are not objects", () => {
    expect(
      validateWorldData(
        makeSerialized({
          layers: {
            ...makeSerialized().layers,
            biomeOverrides: "no" as never,
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("validateWorldData — happy path", () => {
  it("accepts the canonical fixture", () => {
    expect(validateWorldData(makeSerialized())).toBe(true);
  });

  it("acts as a TS type guard (compile-time narrowing)", () => {
    const data: unknown = makeSerialized();
    if (validateWorldData(data)) {
      // TS now sees `data` as SerializedWorldData.
      expect(data.id).toBe("w");
    }
  });
});

// ============================================================================
// migrateWorldData
// ============================================================================

describe("migrateWorldData", () => {
  it("backfills missing top-level fields with sensible defaults", () => {
    const partial = {
      id: "w",
      name: "n",
      foundation: makeSerialized().foundation,
      layers: makeSerialized().layers,
    } as unknown as SerializedWorldData;
    const out = migrateWorldData(partial);
    expect(out.description).toBe("");
    // version was missing → 0, then bumped to >= 1
    expect(out.version).toBeGreaterThanOrEqual(1);
    expect(typeof out.createdAt).toBe("number");
    expect(typeof out.modifiedAt).toBe("number");
    expect(out.foundationLocked).toBe(false);
  });

  it("bumps version from 0 to 1", () => {
    const out = migrateWorldData(makeSerialized({ version: 0 as never }));
    expect(out.version).toBe(1);
  });

  it("does NOT regress version when already > 1", () => {
    const out = migrateWorldData(makeSerialized({ version: 3 }));
    expect(out.version).toBe(3);
  });

  it("backfills missing foundation arrays + layer arrays to []", () => {
    const partial = {
      id: "w",
      name: "n",
      foundation: { config: makeConfig() },
      layers: {},
    } as unknown as SerializedWorldData;
    const out = migrateWorldData(partial);
    expect(out.foundation.biomes).toEqual([]);
    expect(out.foundation.towns).toEqual([]);
    expect(out.foundation.buildings).toEqual([]);
    expect(out.foundation.roads).toEqual([]);
    expect(out.layers.npcs).toEqual([]);
    expect(out.layers.quests).toEqual([]);
    expect(out.layers.bosses).toEqual([]);
    expect(out.layers.events).toEqual([]);
    expect(out.layers.lore).toEqual([]);
    expect(out.layers.difficultyZones).toEqual([]);
    expect(out.layers.customPlacements).toEqual([]);
    expect(out.layers.customRoads).toEqual([]);
    expect(out.layers.biomeOverrides).toEqual({});
    expect(out.layers.townOverrides).toEqual({});
  });
});

// ============================================================================
// validateGameExport
// ============================================================================

describe("validateGameExport — top-level errors", () => {
  it("errors when id is empty", () => {
    const r = validateGameExport(makeWorld({ id: "" }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "id")).toBe(true);
  });

  it("errors when name is missing or whitespace", () => {
    expect(
      validateGameExport(makeWorld({ name: "   " })).errors.some(
        (e) => e.field === "name",
      ),
    ).toBe(true);
  });

  it("errors when worldSize < 10", () => {
    const w = makeWorld();
    w.foundation.config = { ...w.foundation.config };
    w.foundation.config.terrain = {
      ...w.foundation.config.terrain,
      worldSize: 5,
    };
    const r = validateGameExport(w);
    expect(r.errors.some((e) => e.field === "terrain.worldSize")).toBe(true);
  });

  it("warns when worldSize > 1000", () => {
    const w = makeWorld();
    w.foundation.config.terrain = {
      ...w.foundation.config.terrain,
      worldSize: 1500,
    };
    const r = validateGameExport(w);
    expect(r.warnings.some((x) => x.field === "terrain.worldSize")).toBe(true);
  });

  it("warns when seed is 0", () => {
    const w = makeWorld();
    w.foundation.config = { ...w.foundation.config, seed: 0 };
    const r = validateGameExport(w);
    expect(r.warnings.some((x) => x.field === "seed")).toBe(true);
  });
});

describe("validateGameExport — town validation", () => {
  it("warns when there are no towns", () => {
    const r = validateGameExport(makeWorld());
    expect(r.warnings.some((x) => x.field === "towns")).toBe(true);
  });

  it("errors on NaN position", () => {
    const w = makeWorld();
    w.foundation.towns = [
      makeTown({ id: "t1", position: { x: NaN, y: 0, z: 0 } }),
    ];
    const r = validateGameExport(w);
    expect(r.errors.some((e) => e.field === "town.t1.position")).toBe(true);
  });

  it("warns on unknown town size", () => {
    const w = makeWorld();
    w.foundation.towns = [makeTown({ id: "t1", size: "metropolis" as never })];
    const r = validateGameExport(w);
    expect(r.warnings.some((x) => x.field === "town.t1.size")).toBe(true);
  });

  it("warns on duplicate town names", () => {
    const w = makeWorld();
    w.foundation.towns = [
      makeTown({ id: "a", name: "Duplicate" }),
      makeTown({
        id: "b",
        name: "Duplicate",
        position: { x: 500, y: 0, z: 500 },
      }),
    ];
    const r = validateGameExport(w);
    expect(
      r.warnings.some(
        (x) => x.field === "towns.names" && x.message.includes("Duplicate"),
      ),
    ).toBe(true);
  });

  it("warns when two towns are within 100m of each other", () => {
    const w = makeWorld();
    w.foundation.towns = [
      makeTown({ id: "a", name: "A", position: { x: 0, y: 0, z: 0 } }),
      makeTown({ id: "b", name: "B", position: { x: 50, y: 0, z: 0 } }),
    ];
    const r = validateGameExport(w);
    expect(r.warnings.some((x) => x.field === "town.a.spacing")).toBe(true);
  });
});

describe("validateGameExport — building validation", () => {
  it("errors on invalid dimensions (zero or negative)", () => {
    const w = makeWorld();
    w.foundation.towns = [makeTown()];
    w.foundation.buildings = [
      makeBuilding({
        dimensions: { width: 0, depth: 10, height: 5 } as never,
      }),
    ];
    const r = validateGameExport(w);
    expect(r.errors.some((e) => e.field === "building.b1.dimensions")).toBe(
      true,
    );
  });

  it("counts orphaned buildings (townId not in towns)", () => {
    const w = makeWorld();
    w.foundation.towns = [makeTown({ id: "t1" })];
    w.foundation.buildings = [makeBuilding({ id: "b1", townId: "ghostTown" })];
    const r = validateGameExport(w);
    expect(r.stats.orphanedBuildings).toBe(1);
    expect(r.warnings.some((x) => x.field === "building.b1.townId")).toBe(true);
  });

  it("warns on unknown building type", () => {
    const w = makeWorld();
    w.foundation.towns = [makeTown()];
    w.foundation.buildings = [
      makeBuilding({ id: "b1", type: "castle" as never }),
    ];
    const r = validateGameExport(w);
    expect(r.warnings.some((x) => x.field === "building.b1.type")).toBe(true);
  });

  it("counts empty towns (zero buildings)", () => {
    const w = makeWorld();
    w.foundation.towns = [
      makeTown({ id: "t1", name: "Ghost" }),
      makeTown({
        id: "t2",
        name: "Populated",
        position: { x: 500, y: 0, z: 500 },
      }),
    ];
    w.foundation.buildings = [makeBuilding({ townId: "t2" })];
    const r = validateGameExport(w);
    expect(r.stats.emptyTowns).toBe(1);
    expect(r.warnings.some((x) => x.field === "town.t1.buildings")).toBe(true);
  });
});

describe("validateGameExport — world bounds + stats", () => {
  it("warns when a town is outside the world bounds (centered origin)", () => {
    const w = makeWorld();
    // worldSize=16 × tileSize=32 = 512m total, half=256.
    w.foundation.towns = [makeTown({ position: { x: 1000, y: 0, z: 0 } })];
    const r = validateGameExport(w);
    expect(r.warnings.some((x) => x.field === "town.t1.position")).toBe(true);
  });

  it("stats reflect totals", () => {
    const w = makeWorld();
    w.foundation.towns = [
      makeTown({ id: "t1" }),
      makeTown({ id: "t2", name: "Other", position: { x: 500, y: 0, z: 500 } }),
    ];
    w.foundation.buildings = [
      makeBuilding({ id: "b1", townId: "t1" }),
      makeBuilding({ id: "b2", townId: "t1" }),
    ];
    const r = validateGameExport(w);
    expect(r.stats.townCount).toBe(2);
    expect(r.stats.buildingCount).toBe(2);
    expect(r.stats.worldSizeMeters).toBe(16 * 32);
  });
});

// ============================================================================
// validateWorldReferences
// ============================================================================

describe("validateWorldReferences — buildings + roads", () => {
  it("errors on building referencing missing town", () => {
    const w = makeWorld();
    w.foundation.buildings = [makeBuilding({ townId: "missing" })];
    const r = validateWorldReferences(w);
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(
        (e) => e.layer === "buildings" && e.message.includes("missing"),
      ),
    ).toBe(true);
  });

  it("errors on road referencing missing endpoints", () => {
    const w = makeWorld();
    w.foundation.towns = [makeTown({ id: "tA" })];
    w.foundation.roads = [
      {
        id: "r1",
        connectedTowns: ["tA", "tGhost"] as [string, string],
        points: [],
      } as GeneratedRoad,
    ];
    const r = validateWorldReferences(w);
    expect(
      r.errors.some((e) => e.layer === "roads" && e.message.includes("tGhost")),
    ).toBe(true);
  });

  it("returns valid=true when all references resolve", () => {
    const w = makeWorld();
    w.foundation.towns = [makeTown({ id: "t1" })];
    w.foundation.buildings = [makeBuilding({ townId: "t1" })];
    const r = validateWorldReferences(w);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

describe("validateWorldReferences — NPC parentContext", () => {
  function makeNpc(over: Partial<PlacedNPC>): PlacedNPC {
    return {
      id: "n1",
      name: "Guard",
      parentContext: { type: "town", townId: "t1" },
      ...over,
    } as PlacedNPC;
  }

  it("errors when NPC parentContext type=town references missing town", () => {
    const w = makeWorld();
    w.foundation.towns = [makeTown({ id: "t1" })];
    w.layers.npcs = [
      makeNpc({
        parentContext: { type: "town", townId: "ghost" } as never,
      }),
    ];
    const r = validateWorldReferences(w);
    expect(
      r.errors.some((e) => e.layer === "npcs" && e.message.includes("ghost")),
    ).toBe(true);
  });

  it("errors when NPC parentContext type=building references missing building", () => {
    const w = makeWorld();
    w.foundation.buildings = [makeBuilding({ id: "b1" })];
    w.layers.npcs = [
      makeNpc({
        parentContext: { type: "building", buildingId: "noBuilding" } as never,
      }),
    ];
    const r = validateWorldReferences(w);
    expect(
      r.errors.some(
        (e) => e.layer === "npcs" && e.message.includes("noBuilding"),
      ),
    ).toBe(true);
  });
});

describe("validateWorldReferences — quests", () => {
  function makeQuest(over: Partial<PlacedQuest>): PlacedQuest {
    return {
      id: "q1",
      name: "Errand",
      questGiverNpcId: undefined,
      turnInNpcId: undefined,
      locations: [],
      ...over,
    } as PlacedQuest;
  }

  it("errors on dangling questGiverNpcId", () => {
    const w = makeWorld();
    // NPC needs parentContext.type; use parent=world so we don't drag in a town.
    w.layers.npcs = [
      {
        id: "validNpc",
        name: "Valid",
        parentContext: { type: "world" },
      } as never,
    ];
    w.layers.quests = [makeQuest({ questGiverNpcId: "missingNpc" })];
    const r = validateWorldReferences(w);
    expect(
      r.errors.some(
        (e) =>
          e.message.includes("missingNpc") && e.message.includes("quest giver"),
      ),
    ).toBe(true);
  });

  it("errors on dangling turnInNpcId", () => {
    const w = makeWorld();
    w.layers.quests = [makeQuest({ turnInNpcId: "ghostNpc" })];
    const r = validateWorldReferences(w);
    expect(
      r.errors.some(
        (e) => e.message.includes("ghostNpc") && e.message.includes("turn-in"),
      ),
    ).toBe(true);
  });

  it("errors on quest location referencing missing town/building", () => {
    const w = makeWorld();
    w.layers.quests = [
      makeQuest({
        locations: [
          { type: "town", id: "ghostTown" } as never,
          { type: "building", id: "ghostBuilding" } as never,
        ],
      }),
    ];
    const r = validateWorldReferences(w);
    expect(
      r.errors.filter((e) => e.layer === "quests").length,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe("validateWorldReferences — bounds + orphan overrides", () => {
  it("warns on difficulty zone with inverted bounds (min >= max)", () => {
    const w = makeWorld();
    w.layers.difficultyZones = [
      {
        id: "dz1",
        name: "Bad",
        bounds: { minX: 10, maxX: 5, minZ: 0, maxZ: 10 },
      } as never,
    ];
    const r = validateWorldReferences(w);
    expect(r.warnings.some((x) => x.layer === "difficultyZones")).toBe(true);
  });

  it("warns on biome override referencing missing biome", () => {
    const w = makeWorld();
    w.layers.biomeOverrides.set("ghostBiome", {
      biomeId: "ghostBiome",
    } as never);
    const r = validateWorldReferences(w);
    expect(r.warnings.some((x) => x.layer === "biomeOverrides")).toBe(true);
  });

  it("warns on town override referencing missing town", () => {
    const w = makeWorld();
    w.layers.townOverrides.set("ghostTown", { townId: "ghostTown" } as never);
    const r = validateWorldReferences(w);
    expect(r.warnings.some((x) => x.layer === "townOverrides")).toBe(true);
  });

  it("returns valid=true for an empty world", () => {
    expect(validateWorldReferences(makeWorld()).valid).toBe(true);
  });
});
