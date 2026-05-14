/**
 * `worldGeneration` — difficulty-zone + wilderness + mob-spawn tests.
 *
 * Five of six exports covered here (generateBosses is heavily
 * data-driven and warrants its own file):
 *
 *   - generateDifficultyZones: Voronoi-style zones around towns +
 *     grid wilderness fills. Pinned: starter towns get a safe zone
 *     only (no danger zone); safe-zone radius scales with town
 *     size (hamlet=100, village=150, town=200); each non-starter
 *     gets BOTH a safe AND a danger zone; grid cells >500m from
 *     every town spawn a "wild zone".
 *
 *   - generateWilderness: pure factory — just packs args into a
 *     WildernessZone with defaults.
 *
 *   - isInWilderness: directional threshold check. For
 *     `direction: "north"` the wilderness occupies z > threshold;
 *     "south" mirrors via worldSizeMeters - threshold; "east"/"west"
 *     do the same on x.
 *
 *   - getWildernessLevel: 0 outside the wilderness; otherwise
 *     baseLevelAtBoundary + (distanceIntoBoundary / 100) *
 *     levelPerHundredMeters, floored to ≥ 1.
 *
 *   - generateMobSpawns: produces a per-biome spawn config + a
 *     per-non-safe-difficulty-zone override. Pinned: biome
 *     typeOverride wins over biome.type; custom mob config shorts
 *     the defaults; difficulty-bumped levels clamp at 99.
 */

import { describe, expect, it } from "vitest";
import {
  generateDifficultyZones,
  generateMobSpawns,
  generateWilderness,
  getWildernessLevel,
  isInWilderness,
} from "../worldGeneration";
import type {
  DifficultyZone,
  GeneratedBiome,
  GeneratedTown,
  WildernessZone,
  WorldData,
} from "../../types";

function makeTown(over: Partial<GeneratedTown> = {}): GeneratedTown {
  return {
    id: "t1",
    name: "Hamlet",
    position: { x: 256, y: 0, z: 256 },
    size: "hamlet",
    ...over,
  } as GeneratedTown;
}

function makeBiome(over: Partial<GeneratedBiome> = {}): GeneratedBiome {
  return {
    id: "b1",
    type: "plains",
    center: { x: 0, z: 0 },
    influenceRadius: 100,
    ...over,
  } as GeneratedBiome;
}

function makeWorld(over: Partial<WorldData> = {}): WorldData {
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
      config: {
        seed: 1,
        terrain: {
          tileSize: 32,
          worldSize: 16,
          tileResolution: 32,
          maxHeight: 200,
          waterThreshold: 8,
        },
      } as never,
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
// generateDifficultyZones
// ============================================================================

describe("generateDifficultyZones — town-anchored zones", () => {
  it("emits exactly one safe zone for a starter town (no danger zone)", () => {
    const towns = [
      makeTown({ id: "t-starter", position: { x: 256, y: 0, z: 256 } }),
    ];
    const zones = generateDifficultyZones(towns, 16, 32, ["t-starter"]);
    const forStarter = zones.filter((z) => z.linkedTownId === "t-starter");
    expect(forStarter).toHaveLength(1);
    expect(forStarter[0].isSafeZone).toBe(true);
    expect(forStarter[0].id).toBe("safe-zone-t-starter");
    expect(forStarter[0].mobLevelRange).toEqual([0, 0]);
  });

  it("emits BOTH safe AND danger zones for non-starter towns", () => {
    const towns = [
      makeTown({ id: "t-starter", position: { x: 256, y: 0, z: 256 } }),
      makeTown({ id: "t-far", position: { x: 100, y: 0, z: 100 } }),
    ];
    const zones = generateDifficultyZones(towns, 16, 32, ["t-starter"]);
    const farZones = zones.filter((z) => z.linkedTownId === "t-far");
    expect(farZones).toHaveLength(2);
    expect(farZones.some((z) => z.isSafeZone)).toBe(true);
    expect(farZones.some((z) => !z.isSafeZone)).toBe(true);
  });

  it("safe-zone radius scales with town size (hamlet=100, village=150, town=200)", () => {
    const towns = [
      makeTown({ id: "h", size: "hamlet" }),
      makeTown({
        id: "v",
        size: "village",
        position: { x: 300, y: 0, z: 300 },
      }),
      makeTown({ id: "T", size: "town", position: { x: 100, y: 0, z: 100 } }),
    ];
    const zones = generateDifficultyZones(towns, 16, 32, ["h", "v", "T"]);
    const safeFor = (id: string) =>
      zones.find((z) => z.linkedTownId === id && z.isSafeZone)!;
    const radius = (z: DifficultyZone): number => z.bounds.maxX - z.center!.x;
    expect(radius(safeFor("h"))).toBe(100);
    expect(radius(safeFor("v"))).toBe(150);
    expect(radius(safeFor("T"))).toBe(200);
  });

  it("uses the 10% closest-to-center towns as default starters when none specified", () => {
    // World center for 16×32 = (256, 256). 11 towns spread out so 10% = 1 starter.
    const towns = Array.from({ length: 11 }, (_, i) =>
      makeTown({
        id: `t${i}`,
        position: { x: 256 + i * 20, y: 0, z: 256 + i * 20 },
      }),
    );
    const zones = generateDifficultyZones(towns, 16, 32);
    // t0 is the closest to center → should be the starter (only safe zone, no danger).
    const t0Zones = zones.filter((z) => z.linkedTownId === "t0");
    expect(t0Zones).toHaveLength(1);
    expect(t0Zones[0].isSafeZone).toBe(true);
  });

  it("includes wild-zone grid cells when no town is within 500m of the cell center", () => {
    // Massive world, single town at corner — most grid cells are >500m away.
    const towns = [makeTown({ id: "t1", position: { x: 0, y: 0, z: 0 } })];
    const zones = generateDifficultyZones(towns, 100, 32, ["t1"]);
    const wildZones = zones.filter((z) => z.id.startsWith("wild-zone-"));
    expect(wildZones.length).toBeGreaterThan(0);
    for (const w of wildZones) {
      expect(w.isSafeZone).toBe(false);
      expect(w.zoneType).toBe("bounds");
    }
  });

  it("does NOT create wild zones when every grid cell is within 500m of a town", () => {
    // Tiny 16-tile × 32-meter = 512m world; many towns densely packed.
    const towns = [
      makeTown({ id: "a", position: { x: 100, y: 0, z: 100 } }),
      makeTown({ id: "b", position: { x: 100, y: 0, z: 400 } }),
      makeTown({ id: "c", position: { x: 400, y: 0, z: 100 } }),
      makeTown({ id: "d", position: { x: 400, y: 0, z: 400 } }),
    ];
    const zones = generateDifficultyZones(towns, 16, 32, ["a", "b", "c", "d"]);
    expect(zones.filter((z) => z.id.startsWith("wild-zone-"))).toEqual([]);
  });
});

// ============================================================================
// generateWilderness
// ============================================================================

describe("generateWilderness — factory shape", () => {
  it("packs args into the canonical WildernessZone shape", () => {
    const w = generateWilderness(100, 32);
    expect(w.id).toBe("wilderness-main");
    expect(w.name).toBe("The Wilderness");
    expect(w.direction).toBe("north"); // default
    expect(w.startBoundary).toBe(0.3); // default
    expect(w.multiCombat).toBe(true);
    expect(w.baseLevelAtBoundary).toBe(1);
    expect(w.levelPerHundredMeters).toBe(1);
  });

  it("respects direction + startBoundary args", () => {
    const w = generateWilderness(100, 32, "south", 0.7);
    expect(w.direction).toBe("south");
    expect(w.startBoundary).toBe(0.7);
  });
});

// ============================================================================
// isInWilderness
// ============================================================================

describe("isInWilderness — directional threshold", () => {
  const wilderness: WildernessZone = {
    id: "w",
    name: "Wilderness",
    direction: "north",
    startBoundary: 0.5,
    multiCombat: true,
    baseLevelAtBoundary: 1,
    levelPerHundredMeters: 1,
  };

  it("north: in when z > worldSizeMeters * startBoundary", () => {
    // worldSize=16, tileSize=32 → 512m. threshold = 256.
    expect(isInWilderness({ x: 0, y: 0, z: 300 }, wilderness, 16, 32)).toBe(
      true,
    );
    expect(isInWilderness({ x: 0, y: 0, z: 200 }, wilderness, 16, 32)).toBe(
      false,
    );
  });

  it("south: mirrors via worldSizeMeters - threshold", () => {
    const s = { ...wilderness, direction: "south" as const };
    // threshold=256, southern wild = z < 512-256 = 256
    expect(isInWilderness({ x: 0, y: 0, z: 100 }, s, 16, 32)).toBe(true);
    expect(isInWilderness({ x: 0, y: 0, z: 300 }, s, 16, 32)).toBe(false);
  });

  it("east: x > threshold", () => {
    const e = { ...wilderness, direction: "east" as const };
    expect(isInWilderness({ x: 300, y: 0, z: 0 }, e, 16, 32)).toBe(true);
    expect(isInWilderness({ x: 200, y: 0, z: 0 }, e, 16, 32)).toBe(false);
  });

  it("west: x < worldSizeMeters - threshold", () => {
    const w = { ...wilderness, direction: "west" as const };
    expect(isInWilderness({ x: 100, y: 0, z: 0 }, w, 16, 32)).toBe(true);
    expect(isInWilderness({ x: 300, y: 0, z: 0 }, w, 16, 32)).toBe(false);
  });
});

// ============================================================================
// getWildernessLevel
// ============================================================================

describe("getWildernessLevel — level scales with depth into wilderness", () => {
  const w: WildernessZone = {
    id: "w",
    name: "Wilderness",
    direction: "north",
    startBoundary: 0.5,
    multiCombat: true,
    baseLevelAtBoundary: 1,
    levelPerHundredMeters: 1,
  };

  it("returns 0 outside the wilderness", () => {
    expect(getWildernessLevel({ x: 0, y: 0, z: 100 }, w, 16, 32)).toBe(0);
  });

  it("returns baseLevelAtBoundary just past the threshold", () => {
    // threshold = 256, position z = 257 → depth 1m → level = floor(1 + 1/100) = 1
    expect(getWildernessLevel({ x: 0, y: 0, z: 257 }, w, 16, 32)).toBe(1);
  });

  it("scales linearly with depth (1 level per 100m)", () => {
    // depth = 100m → level = floor(1 + 100/100 * 1) = 2
    expect(getWildernessLevel({ x: 0, y: 0, z: 356 }, w, 16, 32)).toBe(2);
    // depth = 200m → level = floor(1 + 200/100 * 1) = 3
    expect(getWildernessLevel({ x: 0, y: 0, z: 456 }, w, 16, 32)).toBe(3);
  });

  it("floors at 1 (no fractional levels)", () => {
    // depth 50m → 1 + 0.5 = 1.5 → floor → 1
    expect(getWildernessLevel({ x: 0, y: 0, z: 306 }, w, 16, 32)).toBe(1);
  });

  it("respects levelPerHundredMeters multiplier", () => {
    const fast = { ...w, levelPerHundredMeters: 5 };
    // depth 100m × 5 levels/100m = 5 → level = floor(1 + 5) = 6
    expect(getWildernessLevel({ x: 0, y: 0, z: 356 }, fast, 16, 32)).toBe(6);
  });
});

// ============================================================================
// generateMobSpawns
// ============================================================================

describe("generateMobSpawns — per-biome + per-difficulty-zone spawns", () => {
  it("emits one spawn config per biome", () => {
    const world = makeWorld();
    world.foundation.biomes = [
      makeBiome({ id: "b1", type: "plains" }),
      makeBiome({
        id: "b2",
        type: "forest",
        center: { x: 500, z: 500 },
        influenceRadius: 200,
      }),
    ];
    const manifest = generateMobSpawns(world);
    expect(manifest.spawns).toHaveLength(2);
    expect(manifest.spawns.map((s) => s.biomeId)).toEqual(["b1", "b2"]);
  });

  it("uses biome bounds derived from center + influenceRadius", () => {
    const world = makeWorld();
    world.foundation.biomes = [
      makeBiome({ id: "b1", center: { x: 100, z: 200 }, influenceRadius: 50 }),
    ];
    const manifest = generateMobSpawns(world);
    expect(manifest.spawns[0].bounds).toEqual({
      minX: 50,
      maxX: 150,
      minZ: 150,
      maxZ: 250,
    });
  });

  it("biome override typeOverride wins over the biome's own type", () => {
    const world = makeWorld();
    world.foundation.biomes = [makeBiome({ id: "b1", type: "plains" })];
    world.layers.biomeOverrides.set("b1", {
      biomeId: "b1",
      typeOverride: "forest",
    } as never);
    const manifest = generateMobSpawns(world);
    expect(manifest.spawns[0].biomeType).toBe("forest");
  });

  it("difficulty override raises spawn levels (clamped to 99)", () => {
    const world = makeWorld();
    world.foundation.biomes = [makeBiome({ id: "b1", type: "plains" })];
    world.layers.biomeOverrides.set("b1", {
      biomeId: "b1",
      difficultyOverride: 9, // 9 * 10 = +90 level modifier → most clamp at 99
    } as never);
    const manifest = generateMobSpawns(world);
    for (const entry of manifest.spawns[0].spawnTable) {
      expect(entry.levelRange[0]).toBeLessThanOrEqual(99);
      expect(entry.levelRange[1]).toBeLessThanOrEqual(99);
    }
  });

  it("falls back to plains spawn table for unknown biome types", () => {
    const world = makeWorld();
    world.foundation.biomes = [
      makeBiome({ id: "b1", type: "alien-tundra" as never }),
    ];
    const manifest = generateMobSpawns(world);
    // Plains table includes rabbit and goblin.
    const types = manifest.spawns[0].spawnTable.map((e) => e.mobTypeId);
    expect(types).toContain("rabbit");
    expect(types).toContain("goblin");
  });

  it("emits an extra spawn config for each non-safe difficulty zone", () => {
    const world = makeWorld();
    world.layers.difficultyZones = [
      {
        id: "dz1",
        name: "Safe",
        isSafeZone: true,
        difficultyLevel: 0,
        mobLevelRange: [0, 0],
        bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
      } as never,
      {
        id: "dz2",
        name: "Danger",
        isSafeZone: false,
        difficultyLevel: 3,
        mobLevelRange: [30, 50],
        bounds: { minX: 100, maxX: 200, minZ: 100, maxZ: 200 },
      } as never,
    ];
    const manifest = generateMobSpawns(world);
    // Only the danger zone (zone_dz2) should appear — safe zone excluded.
    const zoneSpawns = manifest.spawns.filter((s) =>
      s.biomeId.startsWith("zone_"),
    );
    expect(zoneSpawns).toHaveLength(1);
    expect(zoneSpawns[0].biomeId).toBe("zone_dz2");
    expect(zoneSpawns[0].zoneOverride).toBe(true);
  });

  it("output has version=1 + worldId from input + timestamp", () => {
    const world = makeWorld({ id: "specific-world" });
    const manifest = generateMobSpawns(world);
    expect(manifest.version).toBe(1);
    expect(manifest.worldId).toBe("specific-world");
    expect(typeof manifest.generatedAt).toBe("number");
  });
});
