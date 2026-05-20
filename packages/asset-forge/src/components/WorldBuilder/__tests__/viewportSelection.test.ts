/**
 * viewportSelection — type smoke tests.
 *
 * `ViewportSelection` is the discriminated union returned by
 * the viewport's raycast on click. These tests are purely
 * compile-time guards expressed as runtime literals that
 * exercise the optional-field shape — they fail only if a
 * future schema change drops or renames a field that callers
 * (WorldTab, ViewportContainer) depend on.
 */

import { describe, expect, it } from "vitest";

import type {
  TerrainTileInspectorData,
  ViewportSelection,
} from "../viewportSelection";

describe("ViewportSelection — type literals compile", () => {
  it("accepts a minimal terrain selection", () => {
    const sel: ViewportSelection = {
      type: "terrain",
      id: "t-0-0",
      position: { x: 0, y: 0, z: 0 },
    };
    expect(sel.type).toBe("terrain");
  });

  it("accepts an entity selection with optional fields", () => {
    const sel: ViewportSelection = {
      type: "entity",
      id: "ent-1",
      position: { x: 5, y: 0, z: 5 },
      entityType: "mobSpawn",
      entityId: "goblin-1",
      entityDisplayName: "Goblin Spawn",
      entityData: { aggressive: true },
    };
    expect(sel.entityType).toBe("mobSpawn");
  });

  it("accepts a town selection with townId + townName", () => {
    const sel: ViewportSelection = {
      type: "town",
      id: "town-1",
      position: { x: 0, y: 0, z: 0 },
      townId: "starter-village",
      townName: "Starter Village",
    };
    expect(sel.townId).toBe("starter-village");
  });

  it("accepts a vegetation selection with species + instance index", () => {
    const sel: ViewportSelection = {
      type: "vegetation",
      id: "veg-42",
      position: { x: 10, y: 0, z: 10 },
      vegetationSpecies: "tree_oak",
      vegetationInstanceIndex: 42,
    };
    expect(sel.vegetationSpecies).toBe("tree_oak");
  });
});

describe("TerrainTileInspectorData — type literal compiles", () => {
  it("accepts a fully-populated tile inspector payload", () => {
    const data: TerrainTileInspectorData = {
      tileX: 0,
      tileZ: 0,
      chunkX: 0,
      chunkZ: 0,
      worldX: 0,
      worldZ: 0,
      height: 12.5,
      biome: "forest",
      slope: 0.1,
      walkable: true,
      inTown: false,
      inWilderness: false,
      difficultyLevel: 0,
    };
    expect(data.biome).toBe("forest");
  });

  it("accepts townId as optional", () => {
    const data: TerrainTileInspectorData = {
      tileX: 0,
      tileZ: 0,
      chunkX: 0,
      chunkZ: 0,
      worldX: 0,
      worldZ: 0,
      height: 12.5,
      biome: "town",
      slope: 0.1,
      walkable: true,
      inTown: true,
      townId: "starter-village",
      inWilderness: false,
      difficultyLevel: 0,
    };
    expect(data.inTown).toBe(true);
  });
});

describe("ViewportSelection.type — discriminator covers all renderable kinds", () => {
  it("covers all 11 selection kinds", () => {
    const kinds: Array<ViewportSelection["type"]> = [
      "terrain",
      "chunk",
      "tile",
      "biome",
      "town",
      "building",
      "road",
      "entity",
      "vegetation",
      "bridge",
      "duelArena",
    ];
    expect(kinds).toHaveLength(11);
  });
});
