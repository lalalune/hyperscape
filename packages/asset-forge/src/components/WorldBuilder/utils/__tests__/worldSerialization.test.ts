/**
 * `worldSerialization` — WorldData JSON marshalling tests.
 *
 * The module bridges in-memory `WorldData` (uses Maps for
 * biomeOverrides / townOverrides + Float32Array heightmapCache)
 * to a JSON-safe `SerializedWorldData` (uses Records) for disk
 * + network persistence. Drift in this conversion silently
 * breaks save/load.
 *
 * Tests pin:
 *   - serialize / deserialize: Map ↔ Record conversion;
 *     heightmapCache always reset to empty Map on deserialize
 *     (Float32Array isn't JSON-safe — it's expected to be
 *     repopulated by the runtime after load).
 *   - round-trip equality at the value level.
 *   - JSON import/export: pretty-print toggle; rejects non-object
 *     and missing-id/name; pipes through migrateWorldData +
 *     validateWorldData (so invalid migrations throw).
 *   - generateWorldId: shape + uniqueness.
 *   - generateWorldName: deterministic adjective+noun from seed.
 *   - createNewWorld: foundationLocked=true, generated id/name
 *     fallback, default empty layers.
 *   - calculateWorldStats: counts + worldSizeKm + hasOverrides
 *     flag (true when EITHER override Map non-empty).
 *   - importWorldFromFile: file-extension guard (.json or .world).
 *
 * downloadWorldAsFile is DOM-dependent — covered by a smoke test
 * that asserts the click + url-revoke sequence without leaking
 * the anchor.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateWorldStats,
  createNewWorld,
  deserializeWorld,
  downloadWorldAsFile,
  exportWorldToJSON,
  generateWorldId,
  generateWorldName,
  importWorldFromFile,
  importWorldFromJSON,
  serializeWorld,
  type SerializedWorldData,
} from "../worldSerialization";
import type {
  WorldCreationConfig,
  WorldData,
  WorldFoundation,
} from "../../types";

// ----- fixtures --------------------------------------------------------------

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
  } as unknown as WorldCreationConfig;
}

function makeFoundation(): WorldFoundation {
  return {
    version: 1,
    createdAt: 1700000000000,
    config: makeConfig(),
    biomes: [],
    towns: [],
    buildings: [],
    roads: [],
    heightmapCache: new Map([["0,0", new Float32Array([1, 2, 3])]]),
  };
}

function makeWorld(): WorldData {
  return {
    id: "world-test",
    name: "Test World",
    description: "fixture",
    version: 1,
    createdAt: 1700000000000,
    modifiedAt: 1700000001000,
    foundationLocked: true,
    foundation: makeFoundation(),
    layers: {
      biomeOverrides: new Map([
        ["b1", { biomeId: "b1", name: "Forest" } as never],
      ]),
      townOverrides: new Map([
        ["t1", { townId: "t1", name: "Hamlet" } as never],
      ]),
      npcs: [],
      quests: [],
      bosses: [],
      events: [],
      lore: [],
      difficultyZones: [],
      customPlacements: [],
      customRoads: [],
    },
  };
}

// ============================================================================
// serialize / deserialize
// ============================================================================

describe("serializeWorld", () => {
  it("converts Maps to plain object Records", () => {
    const world = makeWorld();
    const out = serializeWorld(world);
    expect(out.layers.biomeOverrides).toEqual({
      b1: { biomeId: "b1", name: "Forest" },
    });
    expect(out.layers.townOverrides).toEqual({
      t1: { townId: "t1", name: "Hamlet" },
    });
  });

  it("flows scalar metadata + foundation through unchanged", () => {
    const world = makeWorld();
    const out = serializeWorld(world);
    expect(out.id).toBe("world-test");
    expect(out.name).toBe("Test World");
    expect(out.version).toBe(1);
    expect(out.createdAt).toBe(1700000000000);
    expect(out.modifiedAt).toBe(1700000001000);
    expect(out.foundationLocked).toBe(true);
    expect(out.foundation.config).toEqual(world.foundation.config);
  });

  it("does NOT include the heightmapCache (not JSON-safe)", () => {
    const world = makeWorld();
    const out = serializeWorld(world);
    expect(
      (out.foundation as Record<string, unknown>).heightmapCache,
    ).toBeUndefined();
  });
});

describe("deserializeWorld", () => {
  it("converts Records back to Maps", () => {
    const serialized: SerializedWorldData = {
      id: "w",
      name: "n",
      description: "",
      version: 1,
      createdAt: 0,
      modifiedAt: 0,
      foundationLocked: false,
      foundation: {
        version: 1,
        createdAt: 0,
        config: makeConfig(),
        biomes: [],
        towns: [],
        buildings: [],
        roads: [],
      },
      layers: {
        biomeOverrides: { b1: { biomeId: "b1" } as never },
        townOverrides: {},
        npcs: [],
        quests: [],
        bosses: [],
        events: [],
        lore: [],
        difficultyZones: [],
        customPlacements: [],
      },
    };
    const out = deserializeWorld(serialized);
    expect(out.layers.biomeOverrides).toBeInstanceOf(Map);
    expect(out.layers.biomeOverrides.get("b1")).toEqual({ biomeId: "b1" });
    expect(out.layers.townOverrides).toBeInstanceOf(Map);
    expect(out.layers.townOverrides.size).toBe(0);
  });

  it("always resets heightmapCache to an empty Map (runtime repopulates)", () => {
    const out = deserializeWorld({
      id: "w",
      name: "n",
      description: "",
      version: 1,
      createdAt: 0,
      modifiedAt: 0,
      foundationLocked: false,
      foundation: {
        version: 1,
        createdAt: 0,
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
    });
    expect(out.foundation.heightmapCache).toBeInstanceOf(Map);
    expect(out.foundation.heightmapCache.size).toBe(0);
  });

  it("defaults missing array layers to []", () => {
    const out = deserializeWorld({
      id: "w",
      name: "n",
      description: "",
      version: 1,
      createdAt: 0,
      modifiedAt: 0,
      foundationLocked: false,
      foundation: {
        version: 1,
        createdAt: 0,
        config: makeConfig(),
        biomes: [],
        towns: [],
        buildings: [],
        roads: [],
      },
      layers: {} as never,
    });
    expect(out.layers.npcs).toEqual([]);
    expect(out.layers.quests).toEqual([]);
    expect(out.layers.bosses).toEqual([]);
    expect(out.layers.customPlacements).toEqual([]);
    expect(out.layers.customRoads).toEqual([]);
  });
});

describe("serialize → deserialize round-trip", () => {
  it("preserves Map contents through the trip (heightmapCache aside)", () => {
    const world = makeWorld();
    const round = deserializeWorld(serializeWorld(world));
    expect(round.layers.biomeOverrides.get("b1")).toEqual({
      biomeId: "b1",
      name: "Forest",
    });
    expect(round.layers.townOverrides.get("t1")).toEqual({
      townId: "t1",
      name: "Hamlet",
    });
    expect(round.id).toBe(world.id);
    expect(round.name).toBe(world.name);
    expect(round.foundation.config).toEqual(world.foundation.config);
  });
});

// ============================================================================
// exportWorldToJSON / importWorldFromJSON
// ============================================================================

describe("exportWorldToJSON", () => {
  it("pretty-prints with 2-space indent by default", () => {
    const json = exportWorldToJSON(makeWorld());
    expect(json).toContain("\n  ");
  });

  it("emits compact JSON when prettyPrint=false", () => {
    const json = exportWorldToJSON(makeWorld(), false);
    expect(json).not.toContain("\n  ");
  });
});

describe("importWorldFromJSON", () => {
  it("round-trips through exportWorldToJSON", () => {
    const world = makeWorld();
    const round = importWorldFromJSON(exportWorldToJSON(world));
    expect(round.id).toBe(world.id);
    expect(round.layers.biomeOverrides.get("b1")).toBeDefined();
  });

  it("throws on non-object JSON", () => {
    expect(() => importWorldFromJSON("42")).toThrow(
      /Invalid world data: expected object/,
    );
  });

  it("throws when id or name is missing", () => {
    expect(() => importWorldFromJSON(JSON.stringify({ foo: "bar" }))).toThrow(
      /missing id or name/,
    );
  });

  it("throws SyntaxError on malformed JSON", () => {
    expect(() => importWorldFromJSON("{ not json")).toThrow();
  });
});

// ============================================================================
// generateWorldId / generateWorldName
// ============================================================================

describe("generateWorldId", () => {
  it("starts with the 'world-' prefix", () => {
    expect(generateWorldId()).toMatch(/^world-/);
  });

  it("produces distinct ids on repeated calls", () => {
    const a = generateWorldId();
    const b = generateWorldId();
    expect(a).not.toBe(b);
  });

  it("body is timestamp-base36 + 9-char random-base36", () => {
    const id = generateWorldId();
    // world-<base36 ts>-<9 base36 chars>
    expect(id).toMatch(/^world-[a-z0-9]+-[a-z0-9]{1,9}$/);
  });
});

describe("generateWorldName", () => {
  it("is deterministic given the same seed", () => {
    expect(generateWorldName(42)).toBe(generateWorldName(42));
  });

  it("returns an 'Adjective Noun' two-word string", () => {
    const name = generateWorldName(0);
    expect(name.split(" ")).toHaveLength(2);
  });

  it("cycles through adjectives + nouns by seed", () => {
    // 8 adjectives × 8 nouns = 64 unique pairings before repeat.
    const names = new Set<string>();
    for (let s = 0; s < 64; s++) names.add(generateWorldName(s));
    expect(names.size).toBe(64);
  });
});

// ============================================================================
// createNewWorld
// ============================================================================

describe("createNewWorld", () => {
  it("locks the foundation, sets v1, and seeds id + name when omitted", () => {
    const w = createNewWorld(makeFoundation());
    expect(w.foundationLocked).toBe(true);
    expect(w.version).toBe(1);
    expect(w.id).toMatch(/^world-/);
    expect(typeof w.name).toBe("string");
    expect(w.name.length).toBeGreaterThan(0);
  });

  it("uses the supplied name and description when provided", () => {
    const w = createNewWorld(makeFoundation(), "MyWorld", "MyDesc");
    expect(w.name).toBe("MyWorld");
    expect(w.description).toBe("MyDesc");
  });

  it("falls back to a 'Generated world with seed N' description", () => {
    const w = createNewWorld(makeFoundation());
    expect(w.description).toBe("Generated world with seed 42");
  });

  it("starts with all layers empty", () => {
    const w = createNewWorld(makeFoundation());
    expect(w.layers.biomeOverrides.size).toBe(0);
    expect(w.layers.townOverrides.size).toBe(0);
    expect(w.layers.npcs).toEqual([]);
    expect(w.layers.customRoads).toEqual([]);
  });
});

// ============================================================================
// calculateWorldStats
// ============================================================================

describe("calculateWorldStats", () => {
  it("computes totals from foundation + layers arrays", () => {
    const world = makeWorld();
    world.foundation.biomes = Array(3).fill({}) as never;
    world.foundation.towns = Array(2).fill({}) as never;
    world.foundation.buildings = Array(20).fill({}) as never;
    world.foundation.roads = Array(5).fill({}) as never;
    world.layers.npcs = Array(7).fill({}) as never;
    world.layers.quests = Array(4).fill({}) as never;
    world.layers.bosses = Array(1).fill({}) as never;
    world.layers.events = Array(6).fill({}) as never;
    const stats = calculateWorldStats(world);
    expect(stats.totalBiomes).toBe(3);
    expect(stats.totalTowns).toBe(2);
    expect(stats.totalBuildings).toBe(20);
    expect(stats.totalRoads).toBe(5);
    expect(stats.totalNPCs).toBe(7);
    expect(stats.totalQuests).toBe(4);
    expect(stats.totalBosses).toBe(1);
    expect(stats.totalEvents).toBe(6);
  });

  it("computes totalTiles = worldSize² and km from worldSize × tileSize", () => {
    const world = makeWorld();
    // Config defaults: worldSize=16, tileSize=32 → tiles=256, km=512/1000=0.512.
    const stats = calculateWorldStats(world);
    expect(stats.totalTiles).toBe(256);
    expect(stats.worldSizeKm).toBeCloseTo(0.512);
  });

  it("hasOverrides is true when EITHER override map is non-empty", () => {
    const a = makeWorld();
    expect(calculateWorldStats(a).hasOverrides).toBe(true);

    const b = makeWorld();
    b.layers.biomeOverrides = new Map();
    b.layers.townOverrides = new Map([["t1", { townId: "t1" } as never]]);
    expect(calculateWorldStats(b).hasOverrides).toBe(true);

    const c = makeWorld();
    c.layers.biomeOverrides = new Map();
    c.layers.townOverrides = new Map();
    expect(calculateWorldStats(c).hasOverrides).toBe(false);
  });
});

// ============================================================================
// importWorldFromFile
// ============================================================================

describe("importWorldFromFile", () => {
  it("rejects files with unrecognized extensions", async () => {
    const file = new File(["{}"], "world.txt", { type: "text/plain" });
    await expect(importWorldFromFile(file)).rejects.toThrow(
      /Invalid file type/,
    );
  });

  it("accepts .json files and pipes through importWorldFromJSON", async () => {
    const json = exportWorldToJSON(makeWorld());
    const file = new File([json], "world.json", { type: "application/json" });
    const world = await importWorldFromFile(file);
    expect(world.id).toBe("world-test");
  });

  it("accepts .world files", async () => {
    const json = exportWorldToJSON(makeWorld());
    const file = new File([json], "world.world", { type: "application/json" });
    const world = await importWorldFromFile(file);
    expect(world.id).toBe("world-test");
  });
});

// ============================================================================
// downloadWorldAsFile
// ============================================================================

describe("downloadWorldAsFile", () => {
  let origCreateObjectURL: typeof URL.createObjectURL;
  let origRevokeObjectURL: typeof URL.revokeObjectURL;
  let revokedUrls: string[];

  beforeEach(() => {
    revokedUrls = [];
    origCreateObjectURL = URL.createObjectURL;
    origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn((u: string) => {
      revokedUrls.push(u);
    });
  });

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  });

  it("creates + clicks an anchor, then revokes the object URL", () => {
    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        const el = origCreateElement(tag) as HTMLElement;
        if (tag === "a") {
          (el as HTMLAnchorElement).click = clickSpy;
        }
        return el;
      });

    downloadWorldAsFile(makeWorld());

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokedUrls).toContain("blob:mock");
    createSpy.mockRestore();
  });

  it("derives the filename from the world's name + id-prefix", () => {
    const created: HTMLAnchorElement[] = [];
    const origCreateElement = document.createElement.bind(document);
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        const el = origCreateElement(tag);
        if (tag === "a") {
          (el as HTMLAnchorElement).click = () => undefined;
          created.push(el as HTMLAnchorElement);
        }
        return el;
      });
    downloadWorldAsFile(makeWorld());
    const anchor = created[0];
    expect(anchor.download).toBe("test-world-world-te.json");
    createSpy.mockRestore();
  });
});
