/**
 * Faithfulness test: a world-areas manifest with all five top-level
 * categories (starter towns, level 1/2/3 wilderness, special areas) MUST
 * parse cleanly.
 */

import { describe, expect, it } from "vitest";

import { WorldAreasManifestSchema, type WorldArea } from "./world-areas.js";

const brookhaven: WorldArea = {
  id: "brookhaven",
  name: "Brookhaven",
  description: "A sleepy river town",
  difficultyLevel: 0,
  bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
  biomeType: "grassland",
  safeZone: true,
  pvpEnabled: false,
  npcs: [
    {
      id: "innkeeper_brookhaven",
      type: "quest_giver",
      name: "Maud",
      position: { x: 0, y: 0, z: 0 },
      dialogue: { greet: "Welcome, traveler." },
    },
    {
      id: "brookhaven_general_store",
      type: "shop",
      position: { x: 10, y: 0, z: 0 },
      storeId: "general_store_brookhaven",
    },
  ],
  resources: [],
  mobSpawns: [],
  stations: [
    { id: "bank_brookhaven", type: "bank", position: { x: -10, y: 0, z: 0 } },
  ],
  fishing: { enabled: true, spotCount: 3, spotTypes: ["shrimp", "sardine"] },
};

const goblinPlains: WorldArea = {
  id: "goblin_plains",
  name: "Goblin Plains",
  description: "Overrun plains east of Brookhaven",
  difficultyLevel: 1,
  bounds: { minX: 60, maxX: 200, minZ: -100, maxZ: 100 },
  biomeType: "grassland",
  safeZone: false,
  pvpEnabled: false,
  mobSpawns: [
    {
      mobId: "goblin",
      position: { x: 100, y: 0, z: 0 },
      maxCount: 6,
      spawnRadius: 12,
    },
  ],
};

const reference = {
  starterTowns: { brookhaven },
  level1Areas: { goblin_plains: goblinPlains },
  level2Areas: {},
  level3Areas: {},
  specialAreas: {},
};

describe("WorldAreasManifestSchema", () => {
  it("parses the reference manifest cleanly", () => {
    const result = WorldAreasManifestSchema.safeParse(reference);
    if (!result.success) {
      throw new Error(
        `Reference manifest failed validation:\n${JSON.stringify(result.error.format(), null, 2)}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it("rejects a manifest missing one of the five required category keys", () => {
    const bad: Record<string, unknown> = { ...reference };
    delete bad.specialAreas;
    const result = WorldAreasManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects an area with empty id", () => {
    const bad = {
      ...reference,
      starterTowns: { brookhaven: { ...brookhaven, id: "" } },
    };
    const result = WorldAreasManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a mob spawn with non-positive maxCount", () => {
    const bad = {
      ...reference,
      level1Areas: {
        goblin_plains: {
          ...goblinPlains,
          mobSpawns: [
            {
              mobId: "goblin",
              position: { x: 0, y: 0, z: 0 },
              maxCount: 0,
              spawnRadius: 10,
            },
          ],
        },
      },
    };
    const result = WorldAreasManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects negative spawnRadius", () => {
    const bad = {
      ...reference,
      level1Areas: {
        goblin_plains: {
          ...goblinPlains,
          mobSpawns: [
            {
              mobId: "goblin",
              position: { x: 0, y: 0, z: 0 },
              maxCount: 1,
              spawnRadius: -1,
            },
          ],
        },
      },
    };
    const result = WorldAreasManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("accepts area-level passthrough fields (extra content-creator metadata)", () => {
    const ok = {
      ...reference,
      starterTowns: {
        brookhaven: { ...brookhaven, patronDeity: "river_mother" },
      },
    };
    const result = WorldAreasManifestSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it("accepts authored teleport nodes within an area (lodestone, portal, shortcut)", () => {
    const withTeleports = {
      ...reference,
      starterTowns: {
        brookhaven: {
          ...brookhaven,
          teleports: [
            {
              id: "brookhaven_lodestone",
              name: "Brookhaven Lodestone",
              position: { x: 0, y: 0, z: 0 },
              type: "lodestone",
            },
            {
              id: "brookhaven_portal",
              name: "Ancient Portal",
              position: { x: 5, y: 0, z: 5 },
              type: "portal",
              cost: 100,
            },
            {
              id: "brookhaven_shortcut",
              name: "Mountain Pass",
              position: { x: 10, y: 0, z: 10 },
              type: "shortcut",
              requirements: {
                questComplete: "mountain_quest",
                level: 50,
                itemId: "climbing_boots",
              },
            },
          ],
        },
      },
    };
    const result = WorldAreasManifestSchema.safeParse(withTeleports);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown teleport type (only lodestone/portal/shortcut allowed)", () => {
    const bad = {
      ...reference,
      starterTowns: {
        brookhaven: {
          ...brookhaven,
          teleports: [
            {
              id: "weird",
              name: "Weird",
              position: { x: 0, y: 0, z: 0 },
              type: "wormhole",
            },
          ],
        },
      },
    };
    const result = WorldAreasManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects negative teleport cost", () => {
    const bad = {
      ...reference,
      starterTowns: {
        brookhaven: {
          ...brookhaven,
          teleports: [
            {
              id: "x",
              name: "X",
              position: { x: 0, y: 0, z: 0 },
              type: "portal",
              cost: -1,
            },
          ],
        },
      },
    };
    const result = WorldAreasManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

// ──────────────── P1 — placement-common parity ────────────────
//
// Every WorldArea* placement schema accepts the shared placement-
// common fields (rotation, scale, properties bag, source,
// sourceRegionId). These need to round-trip cleanly so the studio's
// gizmo / property panels / outliner-by-source can read them.

import {
  PlacementCommonSchema,
  WorldAreaMobSpawnSchema,
  WorldAreaNPCSchema,
  WorldAreaResourceSchema,
  WorldAreaStationSchema,
  WorldAreaTeleportNodeSchema,
} from "./world-areas.js";

describe("P1 — placement-common fields round-trip on every placement schema", () => {
  const common = {
    rotation: 1.5708, // π/2
    scale: 1.5,
    source: "agent" as const,
    sourceRegionId: "starter-village-procgen-r1",
    properties: { hp: 100, faction: "merchants" },
  };

  it("PlacementCommonSchema accepts the canonical shape", () => {
    expect(PlacementCommonSchema.safeParse(common).success).toBe(true);
  });

  it("rejects a non-positive scale", () => {
    expect(
      PlacementCommonSchema.safeParse({ ...common, scale: -0.5 }).success,
    ).toBe(false);
    expect(
      PlacementCommonSchema.safeParse({ ...common, scale: 0 }).success,
    ).toBe(false);
  });

  it("rejects an unknown source value", () => {
    expect(
      PlacementCommonSchema.safeParse({ ...common, source: "alien" }).success,
    ).toBe(false);
  });

  it("WorldAreaNPC accepts placement-common fields", () => {
    const r = WorldAreaNPCSchema.safeParse({
      id: "npc1",
      type: "shopkeeper",
      position: { x: 0, y: 0, z: 0 },
      ...common,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.rotation).toBe(common.rotation);
      expect(r.data.scale).toBe(common.scale);
      expect(r.data.source).toBe("agent");
      expect(r.data.properties).toEqual(common.properties);
    }
  });

  it("WorldAreaMobSpawn accepts placement-common + new mob-specific fields", () => {
    const r = WorldAreaMobSpawnSchema.safeParse({
      id: "spawn-goblin-1",
      name: "Goblin Patrol",
      mobId: "goblin",
      position: { x: 12, y: 0, z: 8 },
      maxCount: 3,
      spawnRadius: 5,
      respawnTicks: 100,
      ...common,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBe("spawn-goblin-1");
      expect(r.data.respawnTicks).toBe(100);
      expect(r.data.rotation).toBe(common.rotation);
    }
  });

  it("WorldAreaResource accepts placement-common + modelVariant", () => {
    const r = WorldAreaResourceSchema.safeParse({
      id: "tree-1",
      name: "Old Oak",
      resourceId: "tree_oak",
      type: "tree",
      position: { x: 18, y: 0, z: -12 },
      modelVariant: 2,
      ...common,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.modelVariant).toBe(2);
      expect(r.data.scale).toBe(common.scale);
    }
  });

  it("WorldAreaStation accepts placement-common + bankId/runeType", () => {
    const r = WorldAreaStationSchema.safeParse({
      id: "town-bank",
      name: "Town Bank",
      type: "bank",
      position: { x: 4, y: 0, z: -2 },
      bankId: "main",
      ...common,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.bankId).toBe("main");
      expect(r.data.source).toBe("agent");
    }
  });

  it("WorldAreaTeleportNode accepts placement-common + connections", () => {
    const r = WorldAreaTeleportNodeSchema.safeParse({
      id: "lodestone-village",
      name: "Village Lodestone",
      type: "lodestone",
      position: { x: 0, y: 0, z: 0 },
      connections: ["lodestone-mountain", "lodestone-coast"],
      ...common,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.connections).toHaveLength(2);
      expect(r.data.rotation).toBe(common.rotation);
    }
  });

  it("rejects negative modelVariant on resource", () => {
    expect(
      WorldAreaResourceSchema.safeParse({
        resourceId: "tree_oak",
        type: "tree",
        position: { x: 0, y: 0, z: 0 },
        modelVariant: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects negative respawnTicks on mob spawn", () => {
    expect(
      WorldAreaMobSpawnSchema.safeParse({
        mobId: "goblin",
        position: { x: 0, y: 0, z: 0 },
        maxCount: 1,
        spawnRadius: 0,
        respawnTicks: -10,
      }).success,
    ).toBe(false);
  });

  it("legacy payloads without placement-common fields still parse (backward compat)", () => {
    // Pre-P1 payloads only had id/type/position. Adding optional
    // fields cannot break existing data — verify explicitly.
    expect(
      WorldAreaNPCSchema.safeParse({
        id: "n1",
        type: "shopkeeper",
        position: { x: 0, y: 0, z: 0 },
      }).success,
    ).toBe(true);
    expect(
      WorldAreaMobSpawnSchema.safeParse({
        mobId: "goblin",
        position: { x: 0, y: 0, z: 0 },
        maxCount: 1,
        spawnRadius: 5,
      }).success,
    ).toBe(true);
    expect(
      WorldAreaResourceSchema.safeParse({
        resourceId: "tree_oak",
        type: "tree",
        position: { x: 0, y: 0, z: 0 },
      }).success,
    ).toBe(true);
    expect(
      WorldAreaStationSchema.safeParse({
        id: "anvil-1",
        type: "anvil",
        position: { x: 0, y: 0, z: 0 },
      }).success,
    ).toBe(true);
    expect(
      WorldAreaTeleportNodeSchema.safeParse({
        id: "tp1",
        name: "Lodestone",
        type: "lodestone",
        position: { x: 0, y: 0, z: 0 },
      }).success,
    ).toBe(true);
  });
});

// ─────────── P2.a — WorldAreaRoad ───────────

import { WorldAreaRoadSchema } from "./world-areas.js";

describe("WorldAreaRoadSchema (P2.a)", () => {
  const validRoad = {
    id: "north-trade-road",
    name: "Northern Trade Road",
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 50, y: 0, z: 30 },
      { x: 120, y: 0, z: 80 },
    ],
    width: 8,
  };

  it("accepts a canonical road shape", () => {
    expect(WorldAreaRoadSchema.safeParse(validRoad).success).toBe(true);
  });

  it("requires at least 2 waypoints in the path", () => {
    expect(
      WorldAreaRoadSchema.safeParse({
        ...validRoad,
        path: [{ x: 0, y: 0, z: 0 }],
      }).success,
    ).toBe(false);
    expect(
      WorldAreaRoadSchema.safeParse({
        ...validRoad,
        path: [],
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive width", () => {
    expect(
      WorldAreaRoadSchema.safeParse({ ...validRoad, width: 0 }).success,
    ).toBe(false);
    expect(
      WorldAreaRoadSchema.safeParse({ ...validRoad, width: -5 }).success,
    ).toBe(false);
  });

  it("requires id + name + path + width", () => {
    expect(
      WorldAreaRoadSchema.safeParse({ ...validRoad, id: undefined }).success,
    ).toBe(false);
    expect(
      WorldAreaRoadSchema.safeParse({ ...validRoad, name: undefined }).success,
    ).toBe(false);
  });

  it("accepts optional placement-common fields", () => {
    const r = WorldAreaRoadSchema.safeParse({
      ...validRoad,
      source: "agent",
      properties: { surface: "cobblestone" },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.source).toBe("agent");
      expect(r.data.properties).toEqual({ surface: "cobblestone" });
    }
  });

  it("accepts optional assetRef", () => {
    expect(
      WorldAreaRoadSchema.safeParse({
        ...validRoad,
        assetRef: "@hyperforge/asset-pack-roads-v1/cobblestone",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed assetRef", () => {
    expect(
      WorldAreaRoadSchema.safeParse({ ...validRoad, assetRef: "no-slash" })
        .success,
    ).toBe(false);
  });
});
