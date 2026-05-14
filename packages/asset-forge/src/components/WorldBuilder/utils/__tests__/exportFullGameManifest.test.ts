/**
 * `exportFullGameManifest` — aggregator tests.
 *
 * Composes the WorldData into 8 sub-manifests (buildings, worldConfig,
 * npcs, mobs, bosses, quests, difficultyZones, wilderness, biomes).
 * Most of the per-sub-manifest detail is covered by adjacent tests
 * (exportToGameManifest, generateMobSpawns); this file verifies the
 * **composition**:
 *
 *   - Output frame (version=1, worldId/worldName from input, exportedAt timestamp).
 *   - npcs: parentContext → townId/buildingId/undefined projection.
 *   - mobs: spawnConfigs derived from generateMobSpawns output (no
 *     zone-override-only fields beyond the public spawn shape).
 *   - bosses + quests + difficultyZones: 1:1 mapping from layer arrays.
 *   - wilderness: hardcoded "wilderness-main" defaults (enabled=true).
 *   - biomes: override.typeOverride wins over biome.type;
 *     materialConfig present only when override.materialOverride is set.
 */

import { describe, expect, it } from "vitest";
import { exportFullGameManifest } from "../worldManifestExport";
import type {
  BiomeOverride,
  GeneratedBiome,
  PlacedBoss,
  PlacedNPC,
  PlacedQuest,
  WorldCreationConfig,
  WorldData,
} from "../../types";

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

function makeWorld(over: Partial<WorldData> = {}): WorldData {
  return {
    id: "specific-world",
    name: "Specific Name",
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
    ...over,
  };
}

// ============================================================================
// Output frame
// ============================================================================

describe("exportFullGameManifest — output frame", () => {
  it("version=1, worldId/worldName from input, exportedAt timestamp", () => {
    const before = Date.now();
    const out = exportFullGameManifest(makeWorld());
    expect(out.version).toBe(1);
    expect(out.worldId).toBe("specific-world");
    expect(out.worldName).toBe("Specific Name");
    expect(out.exportedAt).toBeGreaterThanOrEqual(before);
  });

  it("includes all 9 sub-manifest fields", () => {
    const out = exportFullGameManifest(makeWorld());
    for (const key of [
      "buildings",
      "worldConfig",
      "npcs",
      "mobs",
      "bosses",
      "quests",
      "difficultyZones",
      "wilderness",
      "biomes",
    ]) {
      expect((out as unknown as Record<string, unknown>)[key]).toBeDefined();
    }
  });
});

// ============================================================================
// NPCs: parentContext projection
// ============================================================================

describe("exportFullGameManifest — npcs", () => {
  it("flattens parentContext into townId/buildingId/undefined fields", () => {
    const world = makeWorld();
    world.layers.npcs = [
      {
        id: "townN",
        name: "T",
        position: { x: 0, y: 0, z: 0 },
        parentContext: { type: "town", townId: "tX" },
      } as PlacedNPC,
      {
        id: "bldN",
        name: "B",
        position: { x: 0, y: 0, z: 0 },
        parentContext: { type: "building", buildingId: "bX" },
      } as PlacedNPC,
      {
        id: "freeN",
        name: "F",
        position: { x: 0, y: 0, z: 0 },
        parentContext: { type: "world" },
      } as PlacedNPC,
    ];
    const out = exportFullGameManifest(world);
    const byId: Record<string, { townId?: string; buildingId?: string }> = {};
    for (const n of out.npcs.npcs) {
      byId[n.id] = n as never;
    }
    expect(byId.townN).toMatchObject({ townId: "tX" });
    expect(byId.townN.buildingId).toBeUndefined();
    expect(byId.bldN).toMatchObject({ buildingId: "bX" });
    expect(byId.bldN.townId).toBeUndefined();
    expect(byId.freeN.townId).toBeUndefined();
    expect(byId.freeN.buildingId).toBeUndefined();
  });
});

// ============================================================================
// Bosses + Quests + Difficulty zones: 1:1 mapping
// ============================================================================

describe("exportFullGameManifest — bosses + quests + difficultyZones", () => {
  it("maps bossTemplateId → templateId in the output shape", () => {
    const world = makeWorld();
    world.layers.bosses = [
      {
        id: "boss1",
        name: "BossOne",
        bossTemplateId: "tmpl_a",
        position: { x: 0, y: 0, z: 0 },
        requiredLevel: 30,
      } as PlacedBoss,
    ];
    const out = exportFullGameManifest(world);
    expect(out.bosses.bosses[0].templateId).toBe("tmpl_a");
    expect(out.bosses.bosses[0].name).toBe("BossOne");
  });

  it("maps questTemplateId → templateId in the output shape", () => {
    const world = makeWorld();
    world.layers.quests = [
      {
        id: "q1",
        name: "Errand",
        questTemplateId: "qt_a",
        locations: [],
      } as PlacedQuest,
    ];
    const out = exportFullGameManifest(world);
    expect(out.quests.quests[0].templateId).toBe("qt_a");
  });

  it("emits one difficulty-zone entry per layer entry", () => {
    const world = makeWorld();
    world.layers.difficultyZones = [
      {
        id: "dz1",
        name: "Zone",
        difficultyLevel: 2,
        isSafeZone: false,
        bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
        mobLevelRange: [10, 20],
      } as never,
    ];
    const out = exportFullGameManifest(world);
    expect(out.difficultyZones.zones).toHaveLength(1);
    expect(out.difficultyZones.zones[0].id).toBe("dz1");
  });
});

// ============================================================================
// Wilderness: hardcoded defaults
// ============================================================================

describe("exportFullGameManifest — wilderness", () => {
  it("emits the hardcoded 'wilderness-main' zone with default direction/boundary/scaling", () => {
    const out = exportFullGameManifest(makeWorld());
    expect(out.wilderness.enabled).toBe(true);
    expect(out.wilderness.zone.id).toBe("wilderness-main");
    expect(out.wilderness.zone.direction).toBe("north");
    expect(out.wilderness.zone.startBoundary).toBe(0.3);
    expect(out.wilderness.zone.baseLevelAtBoundary).toBe(1);
    expect(out.wilderness.zone.levelPerHundredMeters).toBe(1);
  });
});

// ============================================================================
// Biomes: override projection
// ============================================================================

describe("exportFullGameManifest — biomes", () => {
  function makeBiome(over: Partial<GeneratedBiome>): GeneratedBiome {
    return {
      id: "b1",
      type: "plains",
      center: { x: 0, z: 0 },
      influenceRadius: 100,
      tileKeys: ["0,0", "1,0"],
      ...over,
    } as GeneratedBiome;
  }

  it("override.typeOverride wins over biome.type", () => {
    const world = makeWorld();
    world.foundation.biomes = [makeBiome({ id: "b1", type: "plains" })];
    world.layers.biomeOverrides.set("b1", {
      biomeId: "b1",
      typeOverride: "forest",
    } as BiomeOverride);
    const out = exportFullGameManifest(world);
    expect(out.biomes.biomes[0].type).toBe("forest");
  });

  it("biome.type carries through when no override exists", () => {
    const world = makeWorld();
    world.foundation.biomes = [makeBiome({ id: "b1", type: "desert" })];
    const out = exportFullGameManifest(world);
    expect(out.biomes.biomes[0].type).toBe("desert");
  });

  it("tileCount = tileKeys.length", () => {
    const world = makeWorld();
    world.foundation.biomes = [
      makeBiome({ id: "b1", tileKeys: ["0,0", "1,0", "2,0"] }),
    ];
    const out = exportFullGameManifest(world);
    expect(out.biomes.biomes[0].tileCount).toBe(3);
  });

  it("materialConfig is undefined when override has no materialOverride", () => {
    const world = makeWorld();
    world.foundation.biomes = [makeBiome({ id: "b1" })];
    world.layers.biomeOverrides.set("b1", {
      biomeId: "b1",
    } as BiomeOverride);
    const out = exportFullGameManifest(world);
    expect(out.biomes.biomes[0].materialConfig).toBeUndefined();
  });

  it("materialConfig is populated when override.materialOverride is set", () => {
    const world = makeWorld();
    world.foundation.biomes = [makeBiome({ id: "b1" })];
    world.layers.biomeOverrides.set("b1", {
      biomeId: "b1",
      materialOverride: {
        baseTextureId: "tex_a",
        roughness: 0.7,
        colorTint: "#abc",
        uvScale: 2,
        blendMode: "slope",
        blendThreshold: 0.5,
      } as never,
    } as BiomeOverride);
    const out = exportFullGameManifest(world);
    const mat = out.biomes.biomes[0].materialConfig!;
    expect(mat.baseTextureId).toBe("tex_a");
    expect(mat.roughness).toBe(0.7);
    expect(mat.blendMode).toBe("slope");
  });
});

// ============================================================================
// mobs: derived from generateMobSpawns
// ============================================================================

describe("exportFullGameManifest — mobs sub-manifest", () => {
  it("emits one spawnConfig per biome (plus per-non-safe-difficulty-zone)", () => {
    const world = makeWorld();
    world.foundation.biomes = [
      {
        id: "b1",
        type: "plains",
        center: { x: 0, z: 0 },
        influenceRadius: 100,
        tileKeys: [],
      } as never,
      {
        id: "b2",
        type: "forest",
        center: { x: 200, z: 200 },
        influenceRadius: 50,
        tileKeys: [],
      } as never,
    ];
    const out = exportFullGameManifest(world);
    // 2 biomes → at least 2 spawn configs.
    expect(out.mobs.spawnConfigs.length).toBeGreaterThanOrEqual(2);
    const biomeIds = out.mobs.spawnConfigs.map((s) => s.biomeId);
    expect(biomeIds).toContain("b1");
    expect(biomeIds).toContain("b2");
  });
});
