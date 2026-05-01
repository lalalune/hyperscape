/**
 * mergeProcgenConfig — unit tests.
 *
 * Locks down the deep-merge behavior that's load-bearing for
 * terrain regen. The naive shallow spread silently corrupts
 * nested config sections; this helper recurses one level deep
 * so partial agent overrides only override the fields they
 * specify.
 */

import { describe, expect, it } from "vitest";
import { mergeProcgenConfig } from "../mergeProcgenConfig";

const BASE = {
  seed: 42,
  preset: null,
  terrain: {
    tileSize: 100,
    worldSize: 50,
    tileResolution: 32,
    maxHeight: 256,
    waterThreshold: 5.4,
  },
  biomes: {
    gridSize: 1,
    jitter: 0,
    minInfluence: 200,
    maxInfluence: 600,
  },
  island: {
    enabled: false,
    maxWorldSizeTiles: 50,
  },
};

describe("mergeProcgenConfig — deep merge", () => {
  it("preserves base terrain fields when agent only overrides one", () => {
    const merged = mergeProcgenConfig(
      BASE as unknown as Record<string, unknown>,
      { terrain: { worldSize: 100 } },
      42,
    );
    const t = merged.terrain as Record<string, unknown>;
    expect(t.worldSize).toBe(100); // agent's override
    expect(t.tileSize).toBe(100); // PRESERVED from base — naive spread loses this
    expect(t.tileResolution).toBe(32); // PRESERVED
    expect(t.maxHeight).toBe(256); // PRESERVED
    expect(t.waterThreshold).toBe(5.4); // PRESERVED
  });

  it("overrides multiple nested sections independently", () => {
    const merged = mergeProcgenConfig(
      BASE as unknown as Record<string, unknown>,
      {
        terrain: { worldSize: 80 },
        biomes: { gridSize: 4, jitter: 0.3 },
      },
      42,
    );
    const t = merged.terrain as Record<string, unknown>;
    const b = merged.biomes as Record<string, unknown>;
    expect(t.worldSize).toBe(80);
    expect(t.tileSize).toBe(100); // base
    expect(b.gridSize).toBe(4); // agent
    expect(b.jitter).toBe(0.3); // agent
    expect(b.minInfluence).toBe(200); // base
    expect(b.maxInfluence).toBe(600); // base
  });

  it("always overrides seed with the resolved value", () => {
    const merged = mergeProcgenConfig(
      BASE as unknown as Record<string, unknown>,
      { seed: 999 },
      777,
    );
    expect(merged.seed).toBe(777); // resolved seed wins, not agent's 999
  });

  it("agent can override top-level primitives like preset", () => {
    const merged = mergeProcgenConfig(
      BASE as unknown as Record<string, unknown>,
      { preset: "mountain-range" },
      42,
    );
    expect(merged.preset).toBe("mountain-range");
  });

  it("arrays are replaced wholesale, not merged", () => {
    const baseWithArr = {
      ...BASE,
      towns: [{ id: "a" }, { id: "b" }],
    };
    const merged = mergeProcgenConfig(
      baseWithArr as unknown as Record<string, unknown>,
      { towns: [{ id: "c" }] },
      42,
    );
    expect(merged.towns).toEqual([{ id: "c" }]);
  });

  it("null at agent overrides base value", () => {
    const merged = mergeProcgenConfig(
      BASE as unknown as Record<string, unknown>,
      { preset: null },
      42,
    );
    expect(merged.preset).toBeNull();
  });

  it("agent fields not in base are added", () => {
    const merged = mergeProcgenConfig(
      BASE as unknown as Record<string, unknown>,
      { useGamePipeline: true },
      42,
    );
    expect(merged.useGamePipeline).toBe(true);
  });

  it("does not produce NaN-prone configs from partial nested input (regression)", () => {
    // The original shallow-spread bug: agent emits terrain with
    // only worldSize → procgen reads tileSize=undefined and
    // produces NaN heights. Deep-merge preserves the base values.
    const merged = mergeProcgenConfig(
      BASE as unknown as Record<string, unknown>,
      { terrain: { worldSize: 200 } },
      42,
    );
    const t = merged.terrain as Record<string, unknown>;
    expect(typeof t.tileSize).toBe("number");
    expect(typeof t.tileResolution).toBe("number");
    expect(typeof t.maxHeight).toBe("number");
    expect(t.tileSize).not.toBeNaN();
    expect(t.tileResolution).not.toBeNaN();
    expect(t.maxHeight).not.toBeNaN();
  });
});
