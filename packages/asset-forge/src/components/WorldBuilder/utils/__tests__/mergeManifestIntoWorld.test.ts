/**
 * `mergeManifestIntoWorld` — per-entity merge-strategy tests.
 *
 * The merger applies a `FullGameManifest` onto a `WorldData`, with
 * per-entity strategy (replace / merge / skip_existing) selected by
 * `ManifestMergeOptions`. Five entity types each have their own
 * branch:
 *
 *   - npcs / bosses / quests: per-id strategy switch. New ids
 *     always inserted; existing ids replaced / merged-in-place /
 *     skipped.
 *   - difficultyZones: special — `replace` replaces the ENTIRE
 *     array; `merge` is per-id (so the strategy is asymmetric
 *     between merge and replace).
 *   - biomeOverrides: only replace and merge are honored (no
 *     skip-existing branch in the source).
 *
 * Tests pin each strategy's contract + the input-mutation
 * isolation (the function MUST deep-clone layer arrays + Maps so
 * the caller's WorldData remains untouched).
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MERGE_OPTIONS,
  mergeManifestIntoWorld,
  type FullGameManifest,
} from "../worldManifestExport";
import type { WorldData } from "../../types";

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
    ...overrides,
  };
}

function makeEmptyManifest(): FullGameManifest {
  return {
    version: 1,
    worldId: "w",
    worldName: "n",
    exportedAt: 0,
    buildings: {} as never,
    worldConfig: {} as never,
    npcs: { version: 1, npcs: [] } as never,
    mobs: { version: 1, mobs: [] } as never,
    bosses: { version: 1, bosses: [] } as never,
    quests: { version: 1, quests: [] } as never,
    difficultyZones: { version: 1, zones: [] } as never,
    wilderness: { version: 1 } as never,
    biomes: { version: 1, biomes: [] } as never,
  };
}

// ============================================================================
// input isolation
// ============================================================================

describe("mergeManifestIntoWorld — input isolation", () => {
  it("does NOT mutate the caller's WorldData (deep-clones layers + Maps)", () => {
    const world = makeWorld();
    world.layers.npcs = [{ id: "existing", name: "Existing" } as never];
    world.layers.biomeOverrides.set("b1", { biomeId: "b1" } as never);

    const manifest = makeEmptyManifest();
    manifest.npcs.npcs = [
      { id: "new", name: "Imported", position: { x: 0, y: 0, z: 0 } } as never,
    ];

    const out = mergeManifestIntoWorld(world, manifest);

    // Returned object is distinct.
    expect(out).not.toBe(world);
    expect(out.layers).not.toBe(world.layers);
    expect(out.layers.npcs).not.toBe(world.layers.npcs);
    expect(out.layers.biomeOverrides).not.toBe(world.layers.biomeOverrides);

    // Original world's npcs untouched (still just "existing").
    expect(world.layers.npcs.map((n) => n.id)).toEqual(["existing"]);

    // Output has both.
    expect(out.layers.npcs.map((n) => n.id).sort()).toEqual([
      "existing",
      "new",
    ]);
  });

  it("bumps modifiedAt to a fresh timestamp", () => {
    const world = makeWorld();
    world.modifiedAt = 100;
    const before = Date.now();
    const out = mergeManifestIntoWorld(world, makeEmptyManifest());
    expect(out.modifiedAt).toBeGreaterThanOrEqual(before);
  });
});

// ============================================================================
// NPCs: per-id strategy switch
// ============================================================================

describe("mergeManifestIntoWorld — NPCs", () => {
  function withNpc(world: WorldData, id: string, name: string) {
    world.layers.npcs.push({
      id,
      name,
      position: { x: 0, y: 0, z: 0 },
    } as never);
  }

  it("always inserts new NPCs regardless of strategy", () => {
    const world = makeWorld();
    const manifest = makeEmptyManifest();
    manifest.npcs.npcs = [
      { id: "fresh", name: "Fresh", position: { x: 0, y: 0, z: 0 } } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, {
      npcs: "skip_existing",
    });
    expect(out.layers.npcs.find((n) => n.id === "fresh")?.name).toBe("Fresh");
  });

  it("strategy=replace: existing id gets removed-then-inserted with new fields", () => {
    const world = makeWorld();
    withNpc(world, "n1", "OldName");
    const manifest = makeEmptyManifest();
    manifest.npcs.npcs = [
      { id: "n1", name: "NewName", position: { x: 1, y: 0, z: 1 } } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, { npcs: "replace" });
    const got = out.layers.npcs.filter((n) => n.id === "n1");
    expect(got).toHaveLength(1);
    expect(got[0].name).toBe("NewName");
  });

  it("strategy=merge: in-place field update of name/position/dialog/store", () => {
    const world = makeWorld();
    withNpc(world, "n1", "OldName");
    const manifest = makeEmptyManifest();
    manifest.npcs.npcs = [
      {
        id: "n1",
        name: "MergedName",
        position: { x: 5, y: 0, z: 5 },
        dialogId: "d1",
        storeId: "s1",
      } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, { npcs: "merge" });
    const got = out.layers.npcs.find((n) => n.id === "n1")!;
    expect(got.name).toBe("MergedName");
    expect(got.position).toEqual({ x: 5, y: 0, z: 5 });
    expect(got.dialogId).toBe("d1");
    expect(got.storeId).toBe("s1");
  });

  it("strategy=skip_existing: existing id is left untouched", () => {
    const world = makeWorld();
    withNpc(world, "n1", "OldName");
    const manifest = makeEmptyManifest();
    manifest.npcs.npcs = [
      { id: "n1", name: "Ignored", position: { x: 0, y: 0, z: 0 } } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, {
      npcs: "skip_existing",
    });
    expect(out.layers.npcs.find((n) => n.id === "n1")?.name).toBe("OldName");
  });

  it("parentContext derived from townId / buildingId / world fallback", () => {
    const world = makeWorld();
    const manifest = makeEmptyManifest();
    manifest.npcs.npcs = [
      {
        id: "townNpc",
        name: "T",
        position: { x: 0, y: 0, z: 0 },
        townId: "townX",
      } as never,
      {
        id: "buildingNpc",
        name: "B",
        position: { x: 0, y: 0, z: 0 },
        buildingId: "bld1",
      } as never,
      {
        id: "freeNpc",
        name: "F",
        position: { x: 0, y: 0, z: 0 },
      } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest);
    const ctxOf = (
      id: string,
    ): { type: string; townId?: string; buildingId?: string } =>
      out.layers.npcs.find((n) => n.id === id)!.parentContext as never;
    expect(ctxOf("townNpc")).toEqual({ type: "town", townId: "townX" });
    expect(ctxOf("buildingNpc")).toEqual({
      type: "building",
      buildingId: "bld1",
    });
    expect(ctxOf("freeNpc")).toEqual({ type: "world" });
  });
});

// ============================================================================
// Bosses: same per-id strategy pattern
// ============================================================================

describe("mergeManifestIntoWorld — Bosses", () => {
  it("strategy=replace: existing boss removed-then-inserted", () => {
    const world = makeWorld();
    world.layers.bosses.push({ id: "b1", name: "OldBoss" } as never);
    const manifest = makeEmptyManifest();
    manifest.bosses.bosses = [
      {
        id: "b1",
        name: "NewBoss",
        position: { x: 0, y: 0, z: 0 },
        templateId: "tmpl",
      } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, { bosses: "replace" });
    expect(out.layers.bosses.find((b) => b.id === "b1")?.name).toBe("NewBoss");
  });

  it("strategy=merge: in-place field patch", () => {
    const world = makeWorld();
    world.layers.bosses.push({
      id: "b1",
      name: "Old",
      bossTemplateId: "keep",
    } as never);
    const manifest = makeEmptyManifest();
    manifest.bosses.bosses = [
      {
        id: "b1",
        name: "Merged",
        position: { x: 9, y: 0, z: 9 },
        requiredLevel: 50,
      } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, { bosses: "merge" });
    const got = out.layers.bosses.find((b) => b.id === "b1")!;
    expect(got.name).toBe("Merged");
    expect((got as never as { bossTemplateId: string }).bossTemplateId).toBe(
      "keep",
    );
    expect(got.requiredLevel).toBe(50);
  });
});

// ============================================================================
// DifficultyZones: special — "replace" replaces ENTIRE array
// ============================================================================

describe("mergeManifestIntoWorld — DifficultyZones", () => {
  it("strategy=replace replaces the ENTIRE zone array (not per-id)", () => {
    const world = makeWorld();
    world.layers.difficultyZones.push({ id: "old1" } as never);
    world.layers.difficultyZones.push({ id: "old2" } as never);
    const manifest = makeEmptyManifest();
    manifest.difficultyZones.zones = [
      {
        id: "new1",
        name: "New",
        difficultyLevel: 2,
        bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
        isSafeZone: false,
        mobLevelRange: [10, 20],
      } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, {
      difficultyZones: "replace",
    });
    // Only the new zone survives — old1 and old2 are GONE.
    expect(out.layers.difficultyZones.map((z) => z.id)).toEqual(["new1"]);
  });

  it("strategy=merge: new ids inserted, existing ids field-patched", () => {
    const world = makeWorld();
    world.layers.difficultyZones.push({
      id: "z1",
      name: "OldName",
      difficultyLevel: 1,
    } as never);
    const manifest = makeEmptyManifest();
    manifest.difficultyZones.zones = [
      {
        id: "z1",
        name: "MergedName",
        difficultyLevel: 5,
        bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
        isSafeZone: false,
        mobLevelRange: [50, 60],
      } as never,
      {
        id: "z-new",
        name: "Fresh",
        difficultyLevel: 0,
        bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
        isSafeZone: true,
        mobLevelRange: [0, 0],
      } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, {
      difficultyZones: "merge",
    });
    const z1 = out.layers.difficultyZones.find((z) => z.id === "z1")!;
    expect(z1.name).toBe("MergedName");
    expect(z1.difficultyLevel).toBe(5);
    expect(
      out.layers.difficultyZones.find((z) => z.id === "z-new"),
    ).toBeDefined();
  });

  it("zoneType derived from .center: voronoi when present, bounds when absent", () => {
    const world = makeWorld();
    const manifest = makeEmptyManifest();
    manifest.difficultyZones.zones = [
      {
        id: "withCenter",
        name: "V",
        difficultyLevel: 0,
        center: { x: 0, y: 0, z: 0 },
        bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
        isSafeZone: false,
        mobLevelRange: [0, 0],
      } as never,
      {
        id: "withoutCenter",
        name: "B",
        difficultyLevel: 0,
        bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
        isSafeZone: false,
        mobLevelRange: [0, 0],
      } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, {
      difficultyZones: "replace",
    });
    expect(
      out.layers.difficultyZones.find((z) => z.id === "withCenter")?.zoneType,
    ).toBe("voronoi");
    expect(
      out.layers.difficultyZones.find((z) => z.id === "withoutCenter")
        ?.zoneType,
    ).toBe("bounds");
  });
});

// ============================================================================
// BiomeOverrides: replace OR merge (no skip_existing branch)
// ============================================================================

describe("mergeManifestIntoWorld — BiomeOverrides", () => {
  it("creates a fresh override when none exists", () => {
    const world = makeWorld();
    world.foundation.biomes = [{ id: "b1", type: "plains" } as never];
    const manifest = makeEmptyManifest();
    manifest.biomes.biomes = [{ id: "b1", type: "plains" } as never];
    const out = mergeManifestIntoWorld(world, manifest);
    expect(out.layers.biomeOverrides.has("b1")).toBe(true);
  });

  it("typeOverride is set ONLY when manifest type differs from foundation type", () => {
    const world = makeWorld();
    world.foundation.biomes = [{ id: "b1", type: "plains" } as never];
    const manifest = makeEmptyManifest();
    manifest.biomes.biomes = [
      { id: "same", type: "plains" } as never,
      { id: "b1", type: "forest" } as never, // differs from foundation
    ];
    const out = mergeManifestIntoWorld(world, manifest);
    const b1 = out.layers.biomeOverrides.get("b1")!;
    expect(b1.typeOverride).toBe("forest");
  });

  it("strategy=replace overwrites the existing override entirely", () => {
    const world = makeWorld();
    // Foundation matches the manifest's type so typeOverride is NOT set
    // (the function only sets typeOverride when manifest type differs from
    // foundation type).
    world.foundation.biomes = [{ id: "b1", type: "plains" } as never];
    world.layers.biomeOverrides.set("b1", {
      biomeId: "b1",
      typeOverride: "stale",
    } as never);
    const manifest = makeEmptyManifest();
    manifest.biomes.biomes = [
      {
        id: "b1",
        type: "plains",
        materialConfig: {
          baseTextureId: "tex_a",
          roughness: 0.5,
          colorTint: "#fff",
          uvScale: 1,
          blendMode: "height",
        },
      } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, {
      biomeOverrides: "replace",
    });
    const b1 = out.layers.biomeOverrides.get("b1")!;
    // The "stale" typeOverride is GONE — replace builds a fresh override
    // and types match so no new typeOverride is set.
    expect(b1.typeOverride).toBeUndefined();
    expect(b1.materialOverride?.baseTextureId).toBe("tex_a");
  });

  it("strategy=merge patches material + height onto the existing override", () => {
    const world = makeWorld();
    world.layers.biomeOverrides.set("b1", {
      biomeId: "b1",
      typeOverride: "keepme",
      materialOverride: {
        baseTextureId: "old",
        roughness: 0,
        colorTint: "#000",
        uvScale: 0.5,
        blendMode: "height",
        blendThreshold: 0.5,
      } as never,
    } as never);
    const manifest = makeEmptyManifest();
    manifest.biomes.biomes = [
      {
        id: "b1",
        type: "plains",
        materialConfig: {
          baseTextureId: "new",
          roughness: 0.9,
          colorTint: "#fff",
          uvScale: 2,
          blendMode: "slope",
        },
      } as never,
    ];
    const out = mergeManifestIntoWorld(world, manifest, {
      biomeOverrides: "merge",
    });
    const b1 = out.layers.biomeOverrides.get("b1")!;
    // typeOverride preserved by merge.
    expect(b1.typeOverride).toBe("keepme");
    // materialOverride patched.
    expect(b1.materialOverride?.baseTextureId).toBe("new");
    expect(b1.materialOverride?.roughness).toBe(0.9);
    expect(b1.materialOverride?.blendMode).toBe("slope");
  });
});

// ============================================================================
// Defaults
// ============================================================================

describe("mergeManifestIntoWorld — default options", () => {
  it("uses DEFAULT_MERGE_OPTIONS when none supplied", () => {
    const world = makeWorld();
    world.layers.npcs.push({
      id: "n1",
      name: "Default",
    } as never);
    const manifest = makeEmptyManifest();
    manifest.npcs.npcs = [
      {
        id: "n1",
        name: "MergedFromDefault",
        position: { x: 0, y: 0, z: 0 },
      } as never,
    ];
    // Default npcs strategy is "merge".
    expect(DEFAULT_MERGE_OPTIONS.npcs).toBe("merge");
    const out = mergeManifestIntoWorld(world, manifest);
    expect(out.layers.npcs.find((n) => n.id === "n1")?.name).toBe(
      "MergedFromDefault",
    );
  });
});
