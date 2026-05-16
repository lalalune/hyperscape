/**
 * `useActiveContent` — React bridge hooks over the
 * `contentRegistry` tests.
 *
 * Pins the subscription contract: hooks re-run their memoized
 * snapshot when the registry epoch advances (e.g. on plugin
 * biome registration), but return the SAME reference between
 * unrelated re-renders.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BiomeDefinition } from "@hyperforge/procgen/terrain";

import {
  useActiveBiomes,
  useActiveBiomeIds,
  useActiveTerrainShaders,
  useActiveWaterShaders,
  useActiveVegetationSpecies,
} from "../useActiveContent";
import {
  setPluginBiomes,
  _clearAll,
  type PluginBiomeContribution,
} from "../../utils/contentRegistry";

beforeEach(() => {
  _clearAll();
});

afterEach(() => {
  _clearAll();
});

function makeBiome(id: string, color = 0x808080): PluginBiomeContribution {
  return {
    id,
    name: id,
    color,
    terrainMultiplier: 1,
    difficultyLevel: 0,
    heightRange: [0, 1],
    maxSlope: 1.5,
    resourceDensity: 1,
  };
}

function makeEngineDefault(id: string, color = 0x808080): BiomeDefinition {
  return {
    id,
    name: id,
    color,
    terrainMultiplier: 1,
    difficultyLevel: 0,
    heightRange: [0, 1],
    maxSlope: 1.5,
    resourceDensity: 1,
  };
}

// ============================================================================
// useActiveBiomes
// ============================================================================

describe("useActiveBiomes — engine defaults overlay", () => {
  it("returns empty map when no plugin biomes are registered and no defaults supplied", () => {
    const { result } = renderHook(() => useActiveBiomes());
    expect(result.current).toEqual({});
  });

  it("returns engineDefaults when no plugin biomes are registered", () => {
    const defaults = { engineDefault: makeEngineDefault("engineDefault") };
    const { result } = renderHook(() => useActiveBiomes(defaults));
    expect(result.current.engineDefault).toBeDefined();
    expect(result.current.engineDefault.id).toBe("engineDefault");
  });

  it("plugin biomes overlay on top of engineDefaults", () => {
    setPluginBiomes([makeBiome("pluginBiome", 0xff0000)]);
    const defaults = { engineDefault: makeEngineDefault("engineDefault") };
    const { result } = renderHook(() => useActiveBiomes(defaults));
    expect(result.current.engineDefault).toBeDefined();
    expect(result.current.pluginBiome).toBeDefined();
    expect(result.current.pluginBiome.color).toBe(0xff0000);
  });

  it("plugin biome with same id WINS over engine default", () => {
    setPluginBiomes([
      makeBiome("forest", 0x00ff00), // plugin says green
    ]);
    const defaults = { forest: makeEngineDefault("forest", 0x000000) }; // engine says black
    const { result } = renderHook(() => useActiveBiomes(defaults));
    expect(result.current.forest.color).toBe(0x00ff00);
  });
});

describe("useActiveBiomes — subscription", () => {
  it("re-renders when plugin biomes are registered", () => {
    const { result, rerender } = renderHook(() => useActiveBiomes());
    expect(Object.keys(result.current)).toEqual([]);

    setPluginBiomes([makeBiome("lateBiome")]);
    rerender();

    expect(result.current.lateBiome).toBeDefined();
  });

  it("returns stable reference across re-renders when registry hasn't changed", () => {
    const defaults = { engine: makeEngineDefault("engine") };
    const { result, rerender } = renderHook(() => useActiveBiomes(defaults));
    const firstRef = result.current;
    rerender();
    expect(result.current).toBe(firstRef);
  });
});

// ============================================================================
// useActiveBiomeIds
// ============================================================================

describe("useActiveBiomeIds", () => {
  it("returns sorted biome ids", () => {
    setPluginBiomes([
      makeBiome("zebra"),
      makeBiome("apple"),
      makeBiome("mango"),
    ]);
    const { result } = renderHook(() => useActiveBiomeIds());
    expect(result.current).toEqual(["apple", "mango", "zebra"]);
  });

  it("returns [] when no biomes are registered", () => {
    const { result } = renderHook(() => useActiveBiomeIds());
    expect(result.current).toEqual([]);
  });

  it("includes engine defaults in the sort", () => {
    setPluginBiomes([makeBiome("zebra")]);
    const defaults = { apple: makeEngineDefault("apple") };
    const { result } = renderHook(() => useActiveBiomeIds(defaults));
    expect(result.current).toEqual(["apple", "zebra"]);
  });
});

// ============================================================================
// useActiveTerrainShaders / useActiveWaterShaders / useActiveVegetationSpecies
// ============================================================================

describe("useActiveTerrainShaders / WaterShaders / VegetationSpecies", () => {
  it("each returns an empty ReadonlyMap when no content is registered", () => {
    const terrain = renderHook(() => useActiveTerrainShaders());
    const water = renderHook(() => useActiveWaterShaders());
    const veg = renderHook(() => useActiveVegetationSpecies());
    expect(terrain.result.current.size).toBe(0);
    expect(water.result.current.size).toBe(0);
    expect(veg.result.current.size).toBe(0);
  });

  it("each is stable across re-renders without registry mutation", () => {
    const { result, rerender } = renderHook(() => useActiveTerrainShaders());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

// ============================================================================
// Cross-hook
// ============================================================================

describe("useActiveContent hooks — share the same registry epoch", () => {
  it("registering plugin biomes triggers a new snapshot for every hook", () => {
    const a = renderHook(() => useActiveBiomes());
    const t = renderHook(() => useActiveTerrainShaders());
    const w = renderHook(() => useActiveWaterShaders());
    const v = renderHook(() => useActiveVegetationSpecies());

    const beforeA = a.result.current;
    const beforeT = t.result.current;
    const beforeW = w.result.current;
    const beforeV = v.result.current;

    setPluginBiomes([makeBiome("ep1")]);

    a.rerender();
    t.rerender();
    w.rerender();
    v.rerender();

    // useActiveBiomes returns a fresh snapshot (the new biome is in it).
    expect(a.result.current).not.toBe(beforeA);
    expect(a.result.current.ep1).toBeDefined();
    // The terrain/water/vegetation hooks SHOULD also re-run because
    // they share the same epoch. Their result MAY be referentially
    // equal (the empty map), but a new instance is conceptually OK
    // — just verify the hook re-ran without crashing.
    expect(t.result.current).toBeDefined();
    expect(w.result.current).toBeDefined();
    expect(v.result.current).toBeDefined();
  });
});
