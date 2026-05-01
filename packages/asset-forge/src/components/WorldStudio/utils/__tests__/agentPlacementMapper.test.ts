/**
 * agentPlacementMapper — bidirectional translation tests.
 *
 * P0.1 of `PLAN_AGENT_STUDIO_PARITY.md`. Every forward mapper is
 * paired with a reverse mapper; the round-trip MUST be lossless
 * for every field that survived from agent → studio → agent.
 *
 * The five placement kinds:
 *   - NPC
 *   - MobSpawn
 *   - Resource
 *   - Station
 *   - Teleport
 *
 * Each gets four buckets of tests:
 *   1. Forward mapper translates coords + fields + defaults
 *   2. Reverse mapper translates coords + fields + defaults
 *   3. Round-trip lossless on the agent's full surface
 *   4. Defaults applied correctly for absent optional fields
 */

import { describe, it, expect } from "vitest";

import {
  worldAreaNpcToPlaced,
  worldAreaMobSpawnToPlaced,
  worldAreaResourceToPlaced,
  worldAreaStationToPlaced,
  worldAreaTeleportToPlaced,
  worldAreaRoadToPlaced,
  placedNpcToWorldArea,
  placedMobSpawnToWorldArea,
  placedResourceToWorldArea,
  placedStationToWorldArea,
  placedTeleportToWorldArea,
  placedCustomRoadToWorldArea,
} from "../agentPlacementMapper";

// World tests use a 5km world (50 tiles × 100m = 5000m total),
// so worldCenterOffset = 2500. Game-space (0,0,0) maps to scene-
// space (2500, 0, 2500).
const OFFSET = 2500;

describe("Coordinate-space conversion", () => {
  it("game-space origin maps to scene-space center", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "n1",
        type: "shopkeeper",
        position: { x: 0, y: 0, z: 0 },
      },
      OFFSET,
    );
    expect(placed.position).toEqual({ x: 2500, y: 0, z: 2500 });
  });

  it("game-space (-half, -half) maps to scene-space (0, 0)", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "n1",
        type: "shopkeeper",
        position: { x: -2500, y: 0, z: -2500 },
      },
      OFFSET,
    );
    expect(placed.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("game-space (+half, +half) maps to scene-space (worldSize, worldSize)", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "n1",
        type: "shopkeeper",
        position: { x: 2500, y: 0, z: 2500 },
      },
      OFFSET,
    );
    expect(placed.position).toEqual({ x: 5000, y: 0, z: 5000 });
  });

  it("y is preserved verbatim — no offset applied to vertical", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "n1",
        type: "shopkeeper",
        position: { x: 10, y: 42, z: 20 },
      },
      OFFSET,
    );
    expect(placed.position.y).toBe(42);
  });

  it("reverse: scene-space center maps back to game-space origin", () => {
    const npc = placedNpcToWorldArea(
      {
        id: "n1",
        npcTypeId: "shopkeeper",
        name: "n1",
        position: { x: 2500, y: 0, z: 2500 },
        rotation: 0,
        parentContext: { type: "world" },
        properties: {},
      },
      OFFSET,
    );
    expect(npc.position).toEqual({ x: 0, y: 0, z: 0 });
  });
});

// ───────────────── NPC ─────────────────

describe("NPC mapper", () => {
  it("maps required fields verbatim", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "eldric",
        type: "shopkeeper",
        name: "Eldric the Merchant",
        position: { x: 0, y: 0, z: 0 },
        storeId: "general-store",
      },
      OFFSET,
    );
    expect(placed.id).toBe("eldric");
    expect(placed.npcTypeId).toBe("shopkeeper");
    expect(placed.name).toBe("Eldric the Merchant");
    expect(placed.storeId).toBe("general-store");
  });

  it("defaults name to id when absent", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "anon",
        type: "guard",
        position: { x: 0, y: 0, z: 0 },
      },
      OFFSET,
    );
    expect(placed.name).toBe("anon");
  });

  it("defaults rotation to 0 when absent", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "n1",
        type: "guard",
        position: { x: 0, y: 0, z: 0 },
      },
      OFFSET,
    );
    expect(placed.rotation).toBe(0);
  });

  it("preserves rotation when set", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "n1",
        type: "guard",
        position: { x: 0, y: 0, z: 0 },
        rotation: 1.5708,
      },
      OFFSET,
    );
    expect(placed.rotation).toBeCloseTo(1.5708);
  });

  it("places agent NPCs in the world parentContext by default", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "n1",
        type: "guard",
        position: { x: 0, y: 0, z: 0 },
      },
      OFFSET,
    );
    expect(placed.parentContext).toEqual({ type: "world" });
  });

  it("captures dialogue + first key as dialogId", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "questgiver",
        type: "questgiver",
        position: { x: 0, y: 0, z: 0 },
        dialogue: { greeting: "Hi", farewell: "Bye" },
      },
      OFFSET,
    );
    expect(placed.dialogId).toBe("greeting");
    expect(placed.properties.dialogue).toEqual({
      greeting: "Hi",
      farewell: "Bye",
    });
  });

  it("folds assetRef into properties for round-trip", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "n1",
        type: "shopkeeper",
        position: { x: 0, y: 0, z: 0 },
        assetRef: "@hyperforge/asset-pack-hyperia-npcs-v1/shopkeeper",
      },
      OFFSET,
    );
    expect(placed.properties.assetRef).toBe(
      "@hyperforge/asset-pack-hyperia-npcs-v1/shopkeeper",
    );
  });

  it("merges agent's properties bag into Placed's properties", () => {
    const placed = worldAreaNpcToPlaced(
      {
        id: "n1",
        type: "shopkeeper",
        position: { x: 0, y: 0, z: 0 },
        properties: { faction: "merchants", hp: 100 },
      },
      OFFSET,
    );
    expect(placed.properties.faction).toBe("merchants");
    expect(placed.properties.hp).toBe(100);
  });

  it("round-trips lossless: agent → studio → agent", () => {
    const original = {
      id: "eldric",
      type: "shopkeeper",
      name: "Eldric",
      position: { x: 12, y: 0, z: -8 },
      storeId: "general-store",
      dialogue: { greet: "Hi" },
      assetRef: "@hyperforge/asset-pack-hyperia-npcs-v1/shopkeeper",
      rotation: 1.5708,
      source: "agent" as const,
      properties: { faction: "merchants" },
    };
    const placed = worldAreaNpcToPlaced(original, OFFSET);
    const back = placedNpcToWorldArea(placed, OFFSET);
    expect(back.id).toBe(original.id);
    expect(back.type).toBe(original.type);
    expect(back.name).toBe(original.name);
    expect(back.position.x).toBeCloseTo(original.position.x);
    expect(back.position.z).toBeCloseTo(original.position.z);
    expect(back.storeId).toBe(original.storeId);
    expect(back.dialogue).toEqual(original.dialogue);
    expect(back.assetRef).toBe(original.assetRef);
    expect(back.rotation).toBeCloseTo(original.rotation);
    expect(back.properties).toEqual({ faction: "merchants" });
  });
});

// ───────────────── MobSpawn ─────────────────

describe("MobSpawn mapper", () => {
  it("synthesizes a composite id when absent", () => {
    const placed = worldAreaMobSpawnToPlaced(
      {
        mobId: "goblin",
        position: { x: 12, y: 0, z: 8 },
        maxCount: 3,
        spawnRadius: 5,
      },
      OFFSET,
    );
    expect(placed.id).toBe("goblin@12,0,8");
  });

  it("uses provided id when present", () => {
    const placed = worldAreaMobSpawnToPlaced(
      {
        id: "spawn-1",
        mobId: "goblin",
        position: { x: 0, y: 0, z: 0 },
        maxCount: 1,
        spawnRadius: 5,
      },
      OFFSET,
    );
    expect(placed.id).toBe("spawn-1");
  });

  it("defaults respawnTicks to 50 (~30s)", () => {
    const placed = worldAreaMobSpawnToPlaced(
      {
        mobId: "goblin",
        position: { x: 0, y: 0, z: 0 },
        maxCount: 1,
        spawnRadius: 5,
      },
      OFFSET,
    );
    expect(placed.respawnTicks).toBe(50);
  });

  it("defaults source to 'agent'", () => {
    const placed = worldAreaMobSpawnToPlaced(
      {
        mobId: "goblin",
        position: { x: 0, y: 0, z: 0 },
        maxCount: 1,
        spawnRadius: 5,
      },
      OFFSET,
    );
    expect(placed.source).toBe("agent");
  });

  it("preserves explicit source when set (e.g. procgen)", () => {
    const placed = worldAreaMobSpawnToPlaced(
      {
        mobId: "goblin",
        position: { x: 0, y: 0, z: 0 },
        maxCount: 1,
        spawnRadius: 5,
        source: "procgen",
        sourceRegionId: "wilderness-r1",
      },
      OFFSET,
    );
    expect(placed.source).toBe("procgen");
    expect(placed.sourceRegionId).toBe("wilderness-r1");
  });

  it("round-trips lossless", () => {
    const original = {
      id: "spawn-goblin-1",
      mobId: "goblin",
      name: "Goblin Patrol",
      position: { x: 30, y: 0, z: 30 },
      maxCount: 3,
      spawnRadius: 5,
      respawnTicks: 100,
      assetRef: "@hyperforge/asset-pack-hyperia-mobs-v1/goblin",
      source: "agent" as const,
    };
    const placed = worldAreaMobSpawnToPlaced(original, OFFSET);
    const back = placedMobSpawnToWorldArea(placed, OFFSET);
    expect(back.id).toBe(original.id);
    expect(back.mobId).toBe(original.mobId);
    expect(back.name).toBe(original.name);
    expect(back.position.x).toBeCloseTo(original.position.x);
    expect(back.position.z).toBeCloseTo(original.position.z);
    expect(back.maxCount).toBe(original.maxCount);
    expect(back.spawnRadius).toBe(original.spawnRadius);
    expect(back.respawnTicks).toBe(original.respawnTicks);
    expect(back.assetRef).toBe(original.assetRef);
  });
});

// ───────────────── Resource ─────────────────

describe("Resource mapper", () => {
  it("maps known agent types to studio resourceType enum", () => {
    expect(
      worldAreaResourceToPlaced(
        {
          resourceId: "tree_oak",
          type: "tree",
          position: { x: 0, y: 0, z: 0 },
        },
        OFFSET,
      ).resourceType,
    ).toBe("woodcutting");
    expect(
      worldAreaResourceToPlaced(
        {
          resourceId: "ore_iron",
          type: "rock",
          position: { x: 0, y: 0, z: 0 },
        },
        OFFSET,
      ).resourceType,
    ).toBe("mining");
    expect(
      worldAreaResourceToPlaced(
        {
          resourceId: "fishing_spot_river",
          type: "fishing-spot",
          position: { x: 0, y: 0, z: 0 },
        },
        OFFSET,
      ).resourceType,
    ).toBe("fishing");
  });

  it("falls back to 'mining' for unknown types but preserves originalType", () => {
    const placed = worldAreaResourceToPlaced(
      {
        resourceId: "weird_resource",
        type: "exotic_unobtainium",
        position: { x: 0, y: 0, z: 0 },
      },
      OFFSET,
    );
    expect(placed.resourceType).toBe("mining");
    expect(placed.properties.originalType).toBe("exotic_unobtainium");
  });

  it("defaults modelVariant to 0", () => {
    const placed = worldAreaResourceToPlaced(
      { resourceId: "tree_oak", type: "tree", position: { x: 0, y: 0, z: 0 } },
      OFFSET,
    );
    expect(placed.modelVariant).toBe(0);
  });

  it("preserves modelVariant when set", () => {
    const placed = worldAreaResourceToPlaced(
      {
        resourceId: "tree_oak",
        type: "tree",
        position: { x: 0, y: 0, z: 0 },
        modelVariant: 2,
      },
      OFFSET,
    );
    expect(placed.modelVariant).toBe(2);
  });

  it("round-trips lossless including unknown agent type", () => {
    const original = {
      id: "res-1",
      name: "Strange Crystal",
      resourceId: "crystal_blue",
      type: "crystal",
      position: { x: 25, y: 0, z: -18 },
      rotation: 0.5,
      modelVariant: 1,
      assetRef: "@my-pack/crystal_blue",
    };
    const placed = worldAreaResourceToPlaced(original, OFFSET);
    const back = placedResourceToWorldArea(placed, OFFSET);
    expect(back.id).toBe(original.id);
    expect(back.name).toBe(original.name);
    expect(back.resourceId).toBe(original.resourceId);
    expect(back.type).toBe(original.type); // recovered from properties.originalType
    expect(back.position.x).toBeCloseTo(original.position.x);
    expect(back.modelVariant).toBe(original.modelVariant);
    expect(back.assetRef).toBe(original.assetRef);
  });
});

// ───────────────── Station ─────────────────

describe("Station mapper", () => {
  it("maps required fields", () => {
    const placed = worldAreaStationToPlaced(
      {
        id: "smithy-anvil",
        type: "anvil",
        position: { x: 4, y: 0, z: -2 },
      },
      OFFSET,
    );
    expect(placed.id).toBe("smithy-anvil");
    expect(placed.stationType).toBe("anvil");
  });

  it("preserves bankId + runeType", () => {
    const placed = worldAreaStationToPlaced(
      {
        id: "town-bank",
        type: "bank",
        position: { x: 0, y: 0, z: 0 },
        bankId: "main",
      },
      OFFSET,
    );
    expect(placed.bankId).toBe("main");
  });

  it("round-trips lossless", () => {
    const original = {
      id: "town-bank",
      name: "Town Bank",
      type: "bank",
      position: { x: 4, y: 0, z: -2 },
      rotation: 0,
      bankId: "main",
      runeType: undefined,
      assetRef: "@hyperforge/asset-pack-hyperia-stations-v1/bank",
    };
    const placed = worldAreaStationToPlaced(original, OFFSET);
    const back = placedStationToWorldArea(placed, OFFSET);
    expect(back.id).toBe(original.id);
    expect(back.name).toBe(original.name);
    expect(back.type).toBe(original.type);
    expect(back.position.x).toBeCloseTo(original.position.x);
    expect(back.bankId).toBe(original.bankId);
    expect(back.assetRef).toBe(original.assetRef);
  });
});

// ───────────────── Teleport ─────────────────

describe("Teleport mapper", () => {
  it("maps required fields + folds type into properties for round-trip", () => {
    const placed = worldAreaTeleportToPlaced(
      {
        id: "village-lodestone",
        name: "Village Lodestone",
        type: "lodestone",
        position: { x: 0, y: 0, z: 0 },
      },
      OFFSET,
    );
    expect(placed.id).toBe("village-lodestone");
    expect(placed.name).toBe("Village Lodestone");
    expect(placed.properties.teleportType).toBe("lodestone");
  });

  it("maps requirements (questComplete → questId, level → minLevel)", () => {
    const placed = worldAreaTeleportToPlaced(
      {
        id: "ancient-portal",
        name: "Ancient Portal",
        type: "portal",
        position: { x: 0, y: 0, z: 0 },
        requirements: {
          questComplete: "lost_city",
          level: 30,
          itemId: "ancient_key",
        },
      },
      OFFSET,
    );
    expect(placed.requirements.questId).toBe("lost_city");
    expect(placed.requirements.minLevel).toBe(30);
    expect(placed.requirements.itemId).toBe("ancient_key");
  });

  it("defaults connections to empty array", () => {
    const placed = worldAreaTeleportToPlaced(
      {
        id: "tp1",
        name: "Lodestone",
        type: "lodestone",
        position: { x: 0, y: 0, z: 0 },
      },
      OFFSET,
    );
    expect(placed.connections).toEqual([]);
  });

  it("defaults cost to 0 when absent", () => {
    const placed = worldAreaTeleportToPlaced(
      {
        id: "tp1",
        name: "Lodestone",
        type: "lodestone",
        position: { x: 0, y: 0, z: 0 },
      },
      OFFSET,
    );
    expect(placed.cost).toBe(0);
  });

  it("round-trips lossless with all teleport types", () => {
    for (const type of ["lodestone", "portal", "shortcut"] as const) {
      const original = {
        id: `tp-${type}`,
        name: `${type} test`,
        type,
        position: { x: 10, y: 0, z: 20 },
        requirements: { level: 5 },
        cost: 100,
        connections: ["other-tp"],
        assetRef: `@my-pack/${type}`,
      };
      const placed = worldAreaTeleportToPlaced(original, OFFSET);
      const back = placedTeleportToWorldArea(placed, OFFSET);
      expect(back.type).toBe(original.type);
      expect(back.id).toBe(original.id);
      expect(back.name).toBe(original.name);
      expect(back.position.x).toBeCloseTo(original.position.x);
      expect(back.cost).toBe(original.cost);
      expect(back.requirements?.level).toBe(5);
      expect(back.connections).toEqual(original.connections);
      expect(back.assetRef).toBe(original.assetRef);
    }
  });

  it("falls back to 'lodestone' if teleportType property is missing", () => {
    // Hand-construct a Placed with no teleportType in properties
    // (simulating a designer-created teleport that came in via the
    // palette, not via the agent mapper).
    const placed = {
      id: "custom-tp",
      name: "Custom",
      position: { x: 2500, y: 0, z: 2500 },
      connections: [],
      requirements: {},
      cost: 0,
      properties: {},
    };
    const back = placedTeleportToWorldArea(placed, OFFSET);
    expect(back.type).toBe("lodestone");
  });
});

// ───────────────── Road (P2.a) ─────────────────

describe("Road mapper", () => {
  it("converts each waypoint independently from game→scene", () => {
    const placed = worldAreaRoadToPlaced(
      {
        id: "north-road",
        name: "Northern Trade Road",
        path: [
          { x: 0, y: 0, z: 0 },
          { x: 50, y: 0, z: 30 },
          { x: -100, y: 0, z: 80 },
        ],
        width: 8,
      },
      OFFSET,
    );
    expect(placed.id).toBe("north-road");
    expect(placed.path).toHaveLength(3);
    // Each waypoint gets the offset added independently.
    expect(placed.path[0]).toEqual({ x: 2500, y: 0, z: 2500 });
    expect(placed.path[1]).toEqual({ x: 2550, y: 0, z: 2530 });
    expect(placed.path[2]).toEqual({ x: 2400, y: 0, z: 2580 });
    expect(placed.width).toBe(8);
  });

  it("preserves Y values verbatim across waypoints", () => {
    const placed = worldAreaRoadToPlaced(
      {
        id: "mountain-pass",
        name: "Mountain Pass",
        path: [
          { x: 0, y: 100, z: 0 },
          { x: 50, y: 250, z: 0 },
          { x: 100, y: 100, z: 0 },
        ],
        width: 4,
      },
      OFFSET,
    );
    expect(placed.path[0]?.y).toBe(100);
    expect(placed.path[1]?.y).toBe(250);
    expect(placed.path[2]?.y).toBe(100);
  });

  it("round-trips lossless: agent → studio → agent", () => {
    const original = {
      id: "village-to-mine",
      name: "Old Mining Trail",
      path: [
        { x: -50, y: 0, z: 100 },
        { x: 0, y: 0, z: 50 },
        { x: 80, y: 0, z: -20 },
      ],
      width: 6,
    };
    const placed = worldAreaRoadToPlaced(original, OFFSET);
    const back = placedCustomRoadToWorldArea(placed, OFFSET);
    expect(back.id).toBe(original.id);
    expect(back.name).toBe(original.name);
    expect(back.width).toBe(original.width);
    expect(back.path).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(back.path[i]?.x).toBeCloseTo(original.path[i]!.x);
      expect(back.path[i]?.z).toBeCloseTo(original.path[i]!.z);
    }
  });

  it("handles 2-waypoint minimum (the schema's minimum)", () => {
    const placed = worldAreaRoadToPlaced(
      {
        id: "short-road",
        name: "Short Road",
        path: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 10 },
        ],
        width: 4,
      },
      OFFSET,
    );
    expect(placed.path).toHaveLength(2);
  });
});
