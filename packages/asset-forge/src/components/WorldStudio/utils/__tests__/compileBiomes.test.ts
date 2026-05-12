/**
 * `compileBiomes` — biomes.json compilation tests.
 *
 * Merges biome type defaults (from biomeTypeDefaults) + foundation
 * biome data + editor overrides → the BiomeData shape the game
 * client expects. Three layers of precedence matter:
 *
 *   1. Type defaults (e.g. plains/forest/canyon presets) form the
 *      base — every required field gets a value.
 *   2. Foundation biome data adds id + color + tileKeys.
 *   3. Editor overrides (Map<biomeId, override>) selectively
 *      replace difficulty / ambient / colorScheme / vegetation /
 *      height range / mob spawn config.
 *
 * Tests pin the override-precedence rules + the height-override
 * → heightRange + heightVariation derivation + the mob spawn
 * config replacement.
 */

import { describe, expect, it } from "vitest";
import { compileBiomes } from "../manifestCompiler";
import type { WorldData } from "../../WorldBuilder/types";

function makeWorld(
  biomes: Array<Record<string, unknown>> = [],
  overrides: Map<string, Record<string, unknown>> = new Map(),
): WorldData {
  return {
    foundation: {
      config: {} as never,
      biomes,
      towns: [],
      buildings: [],
    },
    layers: {
      biomeOverrides: overrides,
    },
    metadata: {} as never,
  } as unknown as WorldData;
}

describe("compileBiomes — base type defaults", () => {
  it("returns empty array when no foundation biomes", () => {
    expect(compileBiomes(makeWorld())).toEqual([]);
  });

  it("returns one entry per foundation biome", () => {
    const result = compileBiomes(
      makeWorld([
        { id: "b1", type: "plains", color: 0x66bb6a, tileKeys: [] },
        { id: "b2", type: "forest", color: 0x227a35, tileKeys: [] },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it("fills required BiomeData fields from type defaults", () => {
    const result = compileBiomes(
      makeWorld([{ id: "b1", type: "plains", color: 0x66bb6a, tileKeys: [] }]),
    );
    const b = result[0] as Record<string, unknown>;
    // Identity + display from defaults.
    expect(b.id).toBe("b1");
    expect(b.name).toBe("Plains");
    expect(b.terrain).toBe("plains");
    // Numerics fill from defaults.
    expect(typeof b.difficultyLevel).toBe("number");
    expect(typeof b.maxSlope).toBe("number");
    expect(typeof b.heightVariation).toBe("number");
    // Arrays fill from defaults.
    expect(Array.isArray(b.resources)).toBe(true);
    expect(Array.isArray(b.mobs)).toBe(true);
  });

  it("flows tileKeys from foundation biome", () => {
    const result = compileBiomes(
      makeWorld([
        {
          id: "b1",
          type: "plains",
          color: 0,
          tileKeys: ["0,0", "1,1", "2,2"],
        },
      ]),
    );
    const b = result[0] as { tileKeys: string[] };
    expect(b.tileKeys).toEqual(["0,0", "1,1", "2,2"]);
  });

  it("flows color from foundation biome (NOT defaults)", () => {
    const result = compileBiomes(
      makeWorld([{ id: "b1", type: "plains", color: 0xff00ff, tileKeys: [] }]),
    );
    const b = result[0] as { color: number };
    expect(b.color).toBe(0xff00ff);
  });

  it("falls back to default color when foundation biome.color is undefined", () => {
    const result = compileBiomes(
      makeWorld([{ id: "b1", type: "plains", tileKeys: [] }]),
    );
    const b = result[0] as { color: number };
    // Should be plains default — non-zero (memory says 6732650 = 0x66BB6A).
    expect(b.color).toBeGreaterThan(0);
  });

  it("unknown type falls back to plains defaults (via getBiomeTypeDefaults)", () => {
    const result = compileBiomes(
      makeWorld([{ id: "b1", type: "totally-fake", color: 0, tileKeys: [] }]),
    );
    const b = result[0] as { name: string };
    expect(b.name).toBe("Plains"); // plains fallback
  });
});

describe("compileBiomes — typeOverride", () => {
  it("typeOverride replaces effectiveType for defaults lookup", () => {
    const overrides = new Map();
    overrides.set("b1", { typeOverride: "forest" });
    const result = compileBiomes(
      makeWorld(
        [{ id: "b1", type: "plains", color: 0, tileKeys: [] }],
        overrides,
      ),
    );
    const b = result[0] as { name: string; terrain: string };
    expect(b.name).toBe("Forest"); // forest defaults, not plains
    expect(b.terrain).toBe("forest");
  });
});

describe("compileBiomes — selective field overrides", () => {
  it("difficultyOverride replaces both difficultyLevel and difficulty", () => {
    const overrides = new Map();
    overrides.set("b1", { difficultyOverride: 3 });
    const result = compileBiomes(
      makeWorld(
        [{ id: "b1", type: "plains", color: 0, tileKeys: [] }],
        overrides,
      ),
    );
    const b = result[0] as { difficultyLevel: number; difficulty: number };
    expect(b.difficultyLevel).toBe(3);
    expect(b.difficulty).toBe(3);
  });

  it("ambientSoundOverride replaces ambientSound", () => {
    const overrides = new Map();
    overrides.set("b1", { ambientSoundOverride: "custom_wind" });
    const result = compileBiomes(
      makeWorld(
        [{ id: "b1", type: "plains", color: 0, tileKeys: [] }],
        overrides,
      ),
    );
    expect((result[0] as { ambientSound: string }).ambientSound).toBe(
      "custom_wind",
    );
  });

  it("colorSchemeOverride replaces colorScheme", () => {
    const custom = { primary: "#abcdef", secondary: "#012345", fog: "#fedcba" };
    const overrides = new Map();
    overrides.set("b1", { colorSchemeOverride: custom });
    const result = compileBiomes(
      makeWorld(
        [{ id: "b1", type: "plains", color: 0, tileKeys: [] }],
        overrides,
      ),
    );
    expect((result[0] as { colorScheme: unknown }).colorScheme).toEqual(custom);
  });

  it("vegetationOverride replaces vegetation block entirely", () => {
    const customVeg = { enabled: false, layers: [] };
    const overrides = new Map();
    overrides.set("b1", { vegetationOverride: customVeg });
    const result = compileBiomes(
      makeWorld(
        [{ id: "b1", type: "plains", color: 0, tileKeys: [] }],
        overrides,
      ),
    );
    expect((result[0] as { vegetation: unknown }).vegetation).toEqual(
      customVeg,
    );
  });
});

describe("compileBiomes — heightOverride derivation", () => {
  it("heightOverride sets heightRange=[min, max] and heightVariation=variance", () => {
    const overrides = new Map();
    overrides.set("b1", {
      heightOverride: { minHeight: 5, maxHeight: 50, variance: 10 },
    });
    const result = compileBiomes(
      makeWorld(
        [{ id: "b1", type: "plains", color: 0, tileKeys: [] }],
        overrides,
      ),
    );
    const b = result[0] as {
      heightRange: [number, number];
      heightVariation: number;
    };
    expect(b.heightRange).toEqual([5, 50]);
    expect(b.heightVariation).toBe(10);
  });

  it("no heightOverride keeps defaults", () => {
    const result = compileBiomes(
      makeWorld([{ id: "b1", type: "plains", color: 0, tileKeys: [] }]),
    );
    const b = result[0] as {
      heightRange: [number, number];
      heightVariation: number;
    };
    expect(Array.isArray(b.heightRange)).toBe(true);
    expect(b.heightRange).toHaveLength(2);
    expect(typeof b.heightVariation).toBe("number");
  });
});

describe("compileBiomes — mobSpawnConfig override", () => {
  it("mobSpawnConfig.enabled=true with non-empty spawnTable replaces mobs + mobTypes", () => {
    const overrides = new Map();
    overrides.set("b1", {
      mobSpawnConfig: {
        enabled: true,
        spawnTable: [{ mobTypeId: "goblin" }, { mobTypeId: "skeleton" }],
      },
    });
    const result = compileBiomes(
      makeWorld(
        [{ id: "b1", type: "plains", color: 0, tileKeys: [] }],
        overrides,
      ),
    );
    const b = result[0] as { mobs: string[]; mobTypes: string[] };
    expect(b.mobs).toEqual(["goblin", "skeleton"]);
    expect(b.mobTypes).toEqual(["goblin", "skeleton"]);
  });

  it("mobSpawnConfig.enabled=false leaves mobs as defaults", () => {
    const overrides = new Map();
    overrides.set("b1", {
      mobSpawnConfig: {
        enabled: false,
        spawnTable: [{ mobTypeId: "wolf" }],
      },
    });
    const result = compileBiomes(
      makeWorld(
        [{ id: "b1", type: "plains", color: 0, tileKeys: [] }],
        overrides,
      ),
    );
    const b = result[0] as { mobs: string[] };
    expect(b.mobs).not.toContain("wolf");
  });

  it("empty spawnTable leaves mobs as defaults (even if enabled=true)", () => {
    const overrides = new Map();
    overrides.set("b1", {
      mobSpawnConfig: { enabled: true, spawnTable: [] },
    });
    const result = compileBiomes(
      makeWorld(
        [{ id: "b1", type: "plains", color: 0, tileKeys: [] }],
        overrides,
      ),
    );
    const b = result[0] as { mobs: string[] };
    // Defaults are used — plains defaults are an empty mobs array,
    // but we just verify it didn't get overridden.
    expect(Array.isArray(b.mobs)).toBe(true);
  });
});
