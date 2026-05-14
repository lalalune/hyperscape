/**
 * `worldManifestExport.exportToGameManifest` — tests for the core
 * WorldData → (buildingsManifest, worldConfig) lowering.
 *
 * exportToGameManifest is the entrypoint the game runtime consumes:
 * it maps WorldBuilder authoring data to the on-disk manifest the
 * TownSystem + DataManager read. Tests pin the moving parts:
 *
 *   - Town size mapping: hamlet → sm, village → md, town → lg,
 *     unknown → md fallback.
 *   - Town overrides: name, safeZoneRadius, building modifications
 *     (typeOverride, positionOffset, rotationOverride, disabled).
 *   - Building positions are relative to town center in output.
 *   - Disabled buildings are dropped entirely.
 *   - World size is converted to meters (tiles × tileSize).
 *   - Hardcoded buildingTypes registry + size definitions.
 *   - DEFAULT_MERGE_OPTIONS exposes the strategy defaults the merge
 *     function falls back to.
 *
 * The heavier downstream functions (exportFullGameManifest with
 * its 7 sub-manifests, mergeManifestIntoWorld with its per-entity
 * merge strategies, the DOM download/clipboard helpers, and the
 * file-dialog importManifestFromFile) are out of scope here and
 * deserve their own focused files.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MERGE_OPTIONS,
  exportToGameManifest,
} from "../worldManifestExport";
import type {
  GeneratedBuilding,
  GeneratedTown,
  TownOverride,
  WorldCreationConfig,
  WorldData,
} from "../../types";

function makeConfig(): WorldCreationConfig {
  return {
    seed: 42,
    preset: null,
    terrain: {
      tileSize: 32,
      worldSize: 16,
      tileResolution: 32,
      maxHeight: 200,
      waterThreshold: 8,
    },
    towns: {
      townCount: 3,
      minTownSpacing: 100,
      biomePreferences: {},
      landmarks: { enabled: true } as never,
    },
    roads: {
      roadWidth: 4,
      pathStepSize: 2,
      extraConnectionsRatio: 0.2,
      smoothingIterations: 2,
      costSlopeMultiplier: 1.5,
      costWaterPenalty: 5,
      heuristicWeight: 1,
    },
    shoreline: { waterLevelNormalized: 0.32 } as never,
  } as unknown as WorldCreationConfig;
}

function makeWorld(overrides: Partial<WorldData> = {}): WorldData {
  return {
    id: "w",
    name: "n",
    description: "",
    version: 1,
    createdAt: 0,
    modifiedAt: 0,
    foundationLocked: true,
    foundation: {
      version: 1,
      createdAt: 0,
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
    position: { x: 100, y: 0, z: 200 },
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
    position: { x: 105, y: 0, z: 205 },
    rotation: 0,
    dimensions: { width: 10, depth: 10, height: 5 },
    ...over,
  } as GeneratedBuilding;
}

// ============================================================================
// town size mapping
// ============================================================================

describe("exportToGameManifest — town size → manifest size", () => {
  it("maps hamlet → sm, village → md, town → lg", () => {
    const world = makeWorld();
    world.foundation.towns = [
      makeTown({ id: "h", size: "hamlet", position: { x: 0, y: 0, z: 0 } }),
      makeTown({
        id: "v",
        size: "village",
        position: { x: 300, y: 0, z: 0 },
      }),
      makeTown({ id: "T", size: "town", position: { x: 600, y: 0, z: 0 } }),
    ];
    const { buildingsManifest } = exportToGameManifest(world);
    const sizeOf = (id: string) =>
      buildingsManifest.towns.find((t) => t.id === id)!.size;
    expect(sizeOf("h")).toBe("sm");
    expect(sizeOf("v")).toBe("md");
    expect(sizeOf("T")).toBe("lg");
  });

  it("unknown size falls back to md", () => {
    const world = makeWorld();
    world.foundation.towns = [makeTown({ size: "metropolis" as never })];
    const { buildingsManifest } = exportToGameManifest(world);
    expect(buildingsManifest.towns[0].size).toBe("md");
  });
});

// ============================================================================
// town overrides
// ============================================================================

describe("exportToGameManifest — town overrides", () => {
  it("nameOverride wins over town.name", () => {
    const world = makeWorld();
    world.foundation.towns = [makeTown({ id: "t1", name: "Original" })];
    world.layers.townOverrides.set("t1", {
      townId: "t1",
      nameOverride: "Renamed",
    } as TownOverride);
    const { buildingsManifest } = exportToGameManifest(world);
    expect(buildingsManifest.towns[0].name).toBe("Renamed");
  });

  it("safeZoneRadiusOverride wins over the size-derived default", () => {
    const world = makeWorld();
    world.foundation.towns = [makeTown({ size: "hamlet" })];
    world.layers.townOverrides.set("t1", {
      townId: "t1",
      safeZoneRadiusOverride: 999,
    } as TownOverride);
    const { buildingsManifest } = exportToGameManifest(world);
    expect(buildingsManifest.towns[0].safeZoneRadius).toBe(999);
  });

  it("defaults safeZoneRadius from size: hamlet=40, village=60, town=80", () => {
    const world = makeWorld();
    world.foundation.towns = [
      makeTown({ id: "h", size: "hamlet" }),
      makeTown({ id: "v", size: "village", position: { x: 300, y: 0, z: 0 } }),
      makeTown({ id: "T", size: "town", position: { x: 600, y: 0, z: 0 } }),
    ];
    const { buildingsManifest } = exportToGameManifest(world);
    const safeFor = (id: string) =>
      buildingsManifest.towns.find((t) => t.id === id)!.safeZoneRadius;
    expect(safeFor("h")).toBe(40);
    expect(safeFor("v")).toBe(60);
    expect(safeFor("T")).toBe(80);
  });
});

// ============================================================================
// building positioning + overrides
// ============================================================================

describe("exportToGameManifest — building positions are relative to town center", () => {
  it("emits building.position as (building - town) on each axis", () => {
    const world = makeWorld();
    world.foundation.towns = [
      makeTown({ id: "t1", position: { x: 100, y: 5, z: 200 } }),
    ];
    world.foundation.buildings = [
      makeBuilding({
        id: "b1",
        townId: "t1",
        position: { x: 110, y: 7, z: 215 },
      }),
    ];
    const { buildingsManifest } = exportToGameManifest(world);
    const out = buildingsManifest.towns[0].buildings[0];
    expect(out.position).toEqual({ x: 10, y: 2, z: 15 });
  });

  it("only includes buildings that belong to the town (filter by townId)", () => {
    const world = makeWorld();
    world.foundation.towns = [
      makeTown({ id: "t1" }),
      makeTown({ id: "t2", position: { x: 500, y: 0, z: 500 } }),
    ];
    world.foundation.buildings = [
      makeBuilding({ id: "b-t1", townId: "t1" }),
      makeBuilding({ id: "b-t2", townId: "t2" }),
      makeBuilding({ id: "b-orphan", townId: "ghost" }),
    ];
    const { buildingsManifest } = exportToGameManifest(world);
    const t1 = buildingsManifest.towns.find((t) => t.id === "t1")!;
    const t2 = buildingsManifest.towns.find((t) => t.id === "t2")!;
    expect(t1.buildings.map((b) => b.id)).toEqual(["b-t1"]);
    expect(t2.buildings.map((b) => b.id)).toEqual(["b-t2"]);
    // Orphan doesn't end up anywhere.
    expect(
      buildingsManifest.towns.flatMap((t) => t.buildings).map((b) => b.id),
    ).not.toContain("b-orphan");
  });
});

describe("exportToGameManifest — building modifications", () => {
  it("disabled buildings are dropped entirely", () => {
    const world = makeWorld();
    world.foundation.towns = [makeTown({ id: "t1" })];
    world.foundation.buildings = [
      makeBuilding({ id: "keep", townId: "t1" }),
      makeBuilding({ id: "drop", townId: "t1" }),
    ];
    world.layers.townOverrides.set("t1", {
      townId: "t1",
      buildingModifications: [{ buildingId: "drop", disabled: true } as never],
    } as TownOverride);
    const { buildingsManifest } = exportToGameManifest(world);
    expect(buildingsManifest.towns[0].buildings.map((b) => b.id)).toEqual([
      "keep",
    ]);
  });

  it("typeOverride wins over building.type", () => {
    const world = makeWorld();
    world.foundation.towns = [makeTown({ id: "t1" })];
    world.foundation.buildings = [
      makeBuilding({ id: "b1", townId: "t1", type: "house" }),
    ];
    world.layers.townOverrides.set("t1", {
      townId: "t1",
      buildingModifications: [
        { buildingId: "b1", typeOverride: "smithy" } as never,
      ],
    } as TownOverride);
    const { buildingsManifest } = exportToGameManifest(world);
    expect(buildingsManifest.towns[0].buildings[0].type).toBe("smithy");
  });

  it("positionOffset adds to absolute position BEFORE town-relative subtraction", () => {
    const world = makeWorld();
    world.foundation.towns = [
      makeTown({ id: "t1", position: { x: 100, y: 0, z: 200 } }),
    ];
    world.foundation.buildings = [
      makeBuilding({
        id: "b1",
        townId: "t1",
        position: { x: 110, y: 0, z: 210 },
      }),
    ];
    world.layers.townOverrides.set("t1", {
      townId: "t1",
      buildingModifications: [
        { buildingId: "b1", positionOffset: { x: 5, z: -3 } } as never,
      ],
    } as TownOverride);
    const { buildingsManifest } = exportToGameManifest(world);
    // absolute: (110+5, 0, 210-3) = (115, 0, 207); relative: (15, 0, 7)
    expect(buildingsManifest.towns[0].buildings[0].position).toEqual({
      x: 15,
      y: 0,
      z: 7,
    });
  });

  it("rotationOverride replaces building.rotation", () => {
    const world = makeWorld();
    world.foundation.towns = [makeTown({ id: "t1" })];
    world.foundation.buildings = [
      makeBuilding({ id: "b1", townId: "t1", rotation: 0 }),
    ];
    world.layers.townOverrides.set("t1", {
      townId: "t1",
      buildingModifications: [
        { buildingId: "b1", rotationOverride: Math.PI / 4 } as never,
      ],
    } as TownOverride);
    const { buildingsManifest } = exportToGameManifest(world);
    expect(buildingsManifest.towns[0].buildings[0].rotation).toBe(Math.PI / 4);
  });
});

// ============================================================================
// world config + canonical hardcoded tables
// ============================================================================

describe("exportToGameManifest — world config", () => {
  it("converts worldSize from tiles to meters via tileSize", () => {
    const world = makeWorld();
    world.foundation.config.terrain = {
      ...world.foundation.config.terrain,
      worldSize: 100,
      tileSize: 32,
    };
    const { worldConfig } = exportToGameManifest(world);
    expect(worldConfig.terrain.worldSize).toBe(3200);
    expect(worldConfig.terrain.tileSize).toBe(32);
  });

  it("flows seed, tileResolution, townCount, minTownSpacing through unchanged", () => {
    const world = makeWorld();
    world.foundation.config = {
      ...world.foundation.config,
      seed: 99,
    };
    world.foundation.config.terrain = {
      ...world.foundation.config.terrain,
      tileResolution: 64,
    };
    world.foundation.config.towns = {
      ...world.foundation.config.towns,
      townCount: 7,
      minTownSpacing: 250,
    } as never;
    const { worldConfig } = exportToGameManifest(world);
    expect(worldConfig.terrain.seed).toBe(99);
    expect(worldConfig.terrain.tileResolution).toBe(64);
    expect(worldConfig.towns.townCount).toBe(7);
    expect(worldConfig.towns.minTownSpacing).toBe(250);
  });

  it("waterThreshold flows from shoreline.waterLevelNormalized (not terrain.waterThreshold)", () => {
    const world = makeWorld();
    world.foundation.config = {
      ...world.foundation.config,
      shoreline: { waterLevelNormalized: 0.55 } as never,
    };
    const { worldConfig } = exportToGameManifest(world);
    expect(worldConfig.towns.waterThreshold).toBe(0.55);
  });
});

describe("exportToGameManifest — manifest contains canonical tables", () => {
  it("emits buildingTypes for all 9 known types", () => {
    const { buildingsManifest } = exportToGameManifest(makeWorld());
    const expected = [
      "bank",
      "store",
      "inn",
      "smithy",
      "house",
      "simple-house",
      "long-house",
      "well",
      "anvil",
    ];
    for (const t of expected) {
      expect(buildingsManifest.buildingTypes[t]).toBeDefined();
    }
  });

  it("emits sizeDefinitions for sm / md / lg with consistent safeZoneRadius matching the defaults above", () => {
    const { buildingsManifest } = exportToGameManifest(makeWorld());
    expect(buildingsManifest.sizeDefinitions.sm.safeZoneRadius).toBe(40);
    expect(buildingsManifest.sizeDefinitions.md.safeZoneRadius).toBe(60);
    expect(buildingsManifest.sizeDefinitions.lg.safeZoneRadius).toBe(80);
  });

  it("emits version=1", () => {
    expect(exportToGameManifest(makeWorld()).buildingsManifest.version).toBe(1);
  });
});

// ============================================================================
// DEFAULT_MERGE_OPTIONS
// ============================================================================

describe("DEFAULT_MERGE_OPTIONS — strategy defaults", () => {
  it("has a strategy for each of the 5 mergeable entity types", () => {
    expect(DEFAULT_MERGE_OPTIONS.npcs).toBeDefined();
    expect(DEFAULT_MERGE_OPTIONS.bosses).toBeDefined();
    expect(DEFAULT_MERGE_OPTIONS.quests).toBeDefined();
    expect(DEFAULT_MERGE_OPTIONS.difficultyZones).toBeDefined();
    expect(DEFAULT_MERGE_OPTIONS.biomeOverrides).toBeDefined();
  });

  it("every default is one of replace / merge / skip_existing", () => {
    const validStrategies = ["replace", "merge", "skip_existing"] as const;
    for (const v of Object.values(DEFAULT_MERGE_OPTIONS)) {
      expect(validStrategies).toContain(v);
    }
  });
});
