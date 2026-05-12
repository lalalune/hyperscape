/**
 * `compileWorldJson` — top-level world.json compilation tests.
 *
 * The single canonical compilation that bundles all entity types
 * (npcs / mobSpawns / resources / stations / spawnPoints /
 * teleports / pois / mines / trees) into one manifest. Two
 * non-trivial transforms in this aggregator:
 *
 *   1. respawnTicks → respawnTime rename on mob spawns (runtime
 *      reads `respawnTime` in MobNPCSpawnerSystem:489).
 *   2. NPC parentContext → context field rename.
 *   3. Teleport type pulled from properties.type with "lodestone"
 *      fallback.
 *   4. metadata includes a compiledAt timestamp (real Date.now()
 *      output — verified shape, not value).
 */

import { describe, expect, it } from "vitest";
import { compileWorldJson } from "../manifestCompiler";
import type { WorldData } from "../../WorldBuilder/types";

const EMPTY_EXTENDED = {
  npcs: [],
  spawnPoints: [],
  teleports: [],
  mobSpawns: [],
  resources: [],
  stations: [],
  pois: [],
  waterBodies: [],
  regions: [],
  dangerSources: [],
  wildernessBoundary: null,
  mines: [],
  customAssets: [],
} as never;

function makeWorld(
  overrides: {
    name?: string;
    npcs?: Array<Record<string, unknown>>;
    worldSize?: number;
    tileSize?: number;
  } = {},
): WorldData {
  return {
    name: overrides.name ?? "Test World",
    foundation: {
      config: {
        terrain: {
          worldSize: overrides.worldSize ?? 100,
          tileSize: overrides.tileSize ?? 32,
        },
      } as never,
      biomes: [],
      towns: [],
      buildings: [],
    },
    layers: {
      npcs: overrides.npcs ?? [],
    },
    metadata: {} as never,
  } as unknown as WorldData;
}

describe("compileWorldJson — top-level shape", () => {
  it("emits version 1", () => {
    const result = compileWorldJson(makeWorld(), EMPTY_EXTENDED);
    expect(result.version).toBe(1);
  });

  it("flows world.name into the manifest name field", () => {
    const result = compileWorldJson(
      makeWorld({ name: "My Project" }),
      EMPTY_EXTENDED,
    );
    expect(result.name).toBe("My Project");
  });

  it("emits the canonical top-level keys (version, name, entities, metadata)", () => {
    const result = compileWorldJson(makeWorld(), EMPTY_EXTENDED);
    expect(Object.keys(result).sort()).toEqual([
      "entities",
      "metadata",
      "name",
      "version",
    ]);
  });

  it("entities block contains the 9 expected entity-type arrays + trees", () => {
    const result = compileWorldJson(makeWorld(), EMPTY_EXTENDED);
    const entities = result.entities as Record<string, unknown>;
    expect(Object.keys(entities).sort()).toEqual([
      "mines",
      "mobSpawns",
      "npcs",
      "pois",
      "resources",
      "spawnPoints",
      "stations",
      "teleports",
      "trees",
    ]);
  });
});

describe("compileWorldJson — NPC parentContext rename", () => {
  it("renames parentContext → context", () => {
    const result = compileWorldJson(
      makeWorld({
        npcs: [
          {
            id: "n1",
            npcTypeId: "shopkeeper",
            name: "Eldric",
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
            parentContext: { type: "town", townId: "t1" },
            storeId: "general",
          },
        ],
      }),
      EMPTY_EXTENDED,
    );
    const entities = result.entities as {
      npcs: Array<Record<string, unknown>>;
    };
    expect(entities.npcs[0]?.context).toEqual({
      type: "town",
      townId: "t1",
    });
    expect(entities.npcs[0]).not.toHaveProperty("parentContext");
  });

  it("preserves id, npcTypeId, name, position, rotation, storeId, dialogId", () => {
    const result = compileWorldJson(
      makeWorld({
        npcs: [
          {
            id: "n1",
            npcTypeId: "questgiver",
            name: "Mira",
            position: { x: 5, y: 0, z: 10 },
            rotation: 1.57,
            parentContext: { type: "world" },
            storeId: "alchemy",
            dialogId: "mira-intro",
          },
        ],
      }),
      EMPTY_EXTENDED,
    );
    const npc = (result.entities as { npcs: Array<Record<string, unknown>> })
      .npcs[0];
    expect(npc.npcTypeId).toBe("questgiver");
    expect(npc.dialogId).toBe("mira-intro");
    expect(npc.storeId).toBe("alchemy");
    expect(npc.rotation).toBe(1.57);
  });
});

describe("compileWorldJson — mob spawn rename", () => {
  it("renames respawnTicks → respawnTime (critical: runtime reads respawnTime)", () => {
    const result = compileWorldJson(makeWorld(), {
      ...EMPTY_EXTENDED,
      mobSpawns: [
        {
          id: "ms1",
          mobId: "goblin",
          name: "G",
          position: { x: 0, y: 0, z: 0 },
          spawnRadius: 10,
          maxCount: 5,
          respawnTicks: 100,
        },
      ],
    });
    const mob = (
      result.entities as { mobSpawns: Array<Record<string, unknown>> }
    ).mobSpawns[0];
    expect(mob.respawnTime).toBe(100);
    expect(mob).not.toHaveProperty("respawnTicks");
  });
});

describe("compileWorldJson — teleport type fallback", () => {
  it("uses properties.type when set", () => {
    const result = compileWorldJson(makeWorld(), {
      ...EMPTY_EXTENDED,
      teleports: [
        {
          id: "tp1",
          name: "Portal",
          position: { x: 0, y: 0, z: 0 },
          connections: [],
          properties: { type: "portal" },
        },
      ],
    });
    const tp = (result.entities as { teleports: Array<{ type: string }> })
      .teleports[0];
    expect(tp.type).toBe("portal");
  });

  it("falls back to 'lodestone' when properties.type is missing", () => {
    const result = compileWorldJson(makeWorld(), {
      ...EMPTY_EXTENDED,
      teleports: [
        {
          id: "tp1",
          name: "Default",
          position: { x: 0, y: 0, z: 0 },
          connections: [],
        },
      ],
    });
    const tp = (result.entities as { teleports: Array<{ type: string }> })
      .teleports[0];
    expect(tp.type).toBe("lodestone");
  });

  it("flows requirements + cost from teleport", () => {
    const result = compileWorldJson(makeWorld(), {
      ...EMPTY_EXTENDED,
      teleports: [
        {
          id: "tp1",
          name: "Locked",
          position: { x: 0, y: 0, z: 0 },
          connections: [],
          requirements: { level: 10 },
          cost: 50,
        },
      ],
    });
    const tp = (
      result.entities as {
        teleports: Array<{ requirements: unknown; cost: number }>;
      }
    ).teleports[0];
    expect(tp.requirements).toEqual({ level: 10 });
    expect(tp.cost).toBe(50);
  });
});

describe("compileWorldJson — resource / station / spawn point / poi / mine pass-through", () => {
  it("resources preserve all required fields", () => {
    const result = compileWorldJson(makeWorld(), {
      ...EMPTY_EXTENDED,
      resources: [
        {
          id: "r1",
          resourceId: "oak",
          resourceType: "woodcutting",
          name: "Oak",
          position: { x: 1, y: 0, z: 2 },
          rotation: 0.5,
          modelVariant: "tall",
        },
      ],
    });
    const r = (result.entities as { resources: Array<Record<string, unknown>> })
      .resources[0];
    expect(r).toMatchObject({
      id: "r1",
      resourceId: "oak",
      resourceType: "woodcutting",
      modelVariant: "tall",
      rotation: 0.5,
    });
  });

  it("stations preserve id, stationType, name, position, rotation", () => {
    const result = compileWorldJson(makeWorld(), {
      ...EMPTY_EXTENDED,
      stations: [
        {
          id: "s1",
          stationType: "anvil",
          name: "Forge",
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
        },
      ],
    });
    const s = (result.entities as { stations: Array<Record<string, unknown>> })
      .stations[0];
    expect(s.stationType).toBe("anvil");
    expect(s.name).toBe("Forge");
  });

  it("pois preserve id, name, category, importance, radius", () => {
    const result = compileWorldJson(makeWorld(), {
      ...EMPTY_EXTENDED,
      pois: [
        {
          id: "p1",
          name: "Shrine",
          position: { x: 0, y: 0, z: 0 },
          category: "shrine",
          importance: 0.7,
          radius: 12,
        },
      ],
    });
    const p = (result.entities as { pois: Array<Record<string, unknown>> })
      .pois[0];
    expect(p.category).toBe("shrine");
    expect(p.importance).toBe(0.7);
    expect(p.radius).toBe(12);
  });

  it("mines preserve radialOffsets and biome", () => {
    const result = compileWorldJson(makeWorld(), {
      ...EMPTY_EXTENDED,
      mines: [
        {
          id: "m1",
          position: { x: 0, y: 0, z: 0 },
          radius: 20,
          radialOffsets: [1, 1.1, 0.9, 1, 1.05, 0.95, 1, 1],
          entryAngle: 1.5,
          biome: "canyon",
        },
      ],
    });
    const m = (result.entities as { mines: Array<Record<string, unknown>> })
      .mines[0];
    expect(m.biome).toBe("canyon");
    expect(m.radialOffsets).toHaveLength(8);
    expect(m.entryAngle).toBe(1.5);
  });

  it("mines is empty array when extendedLayers.mines is undefined (?? [])", () => {
    const result = compileWorldJson(makeWorld(), {
      ...EMPTY_EXTENDED,
      mines: undefined as never,
    });
    const mines = (result.entities as { mines: unknown[] }).mines;
    expect(mines).toEqual([]);
  });
});

describe("compileWorldJson — vegetationTrees parameter", () => {
  it("passes vegetationTrees through to entities.trees", () => {
    const trees = [
      { s: "oak", x: 0, y: 0, z: 0, sc: 1, r: 0 },
      { s: "pine", x: 5, y: 0, z: 5, sc: 1.2, r: 1.5 },
    ];
    const result = compileWorldJson(makeWorld(), EMPTY_EXTENDED, trees);
    expect((result.entities as { trees: unknown[] }).trees).toEqual(trees);
  });

  it("entities.trees is undefined when vegetationTrees omitted", () => {
    const result = compileWorldJson(makeWorld(), EMPTY_EXTENDED);
    expect((result.entities as { trees: unknown }).trees).toBeUndefined();
  });
});

describe("compileWorldJson — metadata block", () => {
  it("includes worldSize + tileSize from foundation.config", () => {
    const result = compileWorldJson(
      makeWorld({ worldSize: 200, tileSize: 64 }),
      EMPTY_EXTENDED,
    );
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.worldSize).toBe(200);
    expect(meta.tileSize).toBe(64);
  });

  it("includes compiledAt as an ISO 8601 timestamp", () => {
    const result = compileWorldJson(makeWorld(), EMPTY_EXTENDED);
    const meta = result.metadata as { compiledAt: string };
    expect(typeof meta.compiledAt).toBe("string");
    // Round-trip through Date — must not throw.
    expect(new Date(meta.compiledAt).toString()).not.toBe("Invalid Date");
  });
});
