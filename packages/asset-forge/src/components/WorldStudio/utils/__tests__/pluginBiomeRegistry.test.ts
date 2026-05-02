/**
 * R3.P3 — pluginBiomeRegistry contract.
 *
 * Asserts the merge semantics that consumers rely on: empty
 * registry returns engine defaults verbatim; registered plugin
 * biomes append to the engine map; ids that collide with
 * defaults override (last-plugin-wins on contributions).
 */
import { describe, it, expect, afterEach } from "vitest";
import type { BiomeDefinition } from "@hyperforge/procgen/terrain";
import {
  setPluginBiomes,
  setBiomePackBiomes,
  getActiveBiomeDefinitions,
  _clearAllBiomes,
  type PluginBiomeContribution,
} from "../pluginBiomeRegistry";

const FOREST: BiomeDefinition = {
  id: "forest",
  name: "Forest",
  color: 0x388e3c,
  terrainMultiplier: 1,
  difficultyLevel: 0,
  heightRange: [0, 0.5],
  maxSlope: 0.8,
  resourceDensity: 1,
};
const TUNDRA: BiomeDefinition = {
  id: "tundra",
  name: "Tundra",
  color: 0xe8e4e0,
  terrainMultiplier: 1,
  difficultyLevel: 1,
  heightRange: [0.3, 0.8],
  maxSlope: 1.5,
  resourceDensity: 0.4,
};

const ENGINE_DEFAULTS: Record<string, BiomeDefinition> = {
  forest: FOREST,
  tundra: TUNDRA,
};

const DESERT: PluginBiomeContribution = {
  id: "desert",
  name: "Desert",
  color: 0xddc89a,
  terrainMultiplier: 0.8,
  difficultyLevel: 1,
  heightRange: [0.0, 0.3],
  maxSlope: 1.0,
  resourceDensity: 0.5,
};

describe("pluginBiomeRegistry", () => {
  afterEach(() => {
    _clearAllBiomes();
  });

  it("returns engine defaults verbatim when no plugin biomes registered", () => {
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(merged).toBe(ENGINE_DEFAULTS);
  });

  it("appends plugin biomes to engine defaults under new ids", () => {
    setPluginBiomes([DESERT]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(Object.keys(merged).sort()).toEqual(["desert", "forest", "tundra"]);
    expect(merged.desert?.name).toBe("Desert");
  });

  it("plugin biome with same id overrides engine default", () => {
    const customForest: PluginBiomeContribution = {
      id: "forest",
      name: "Tropical Forest",
      color: 0x1a8e3c,
      heightRange: [0, 0.4],
    };
    setPluginBiomes([customForest]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(merged.forest?.name).toBe("Tropical Forest");
    expect(merged.forest?.color).toBe(0x1a8e3c);
    // Other engine defaults still present.
    expect(merged.tundra).toBeDefined();
  });

  it("setPluginBiomes([]) clears prior plugin biomes", () => {
    setPluginBiomes([DESERT]);
    setPluginBiomes([]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(merged).toBe(ENGINE_DEFAULTS);
  });

  it("re-registering replaces the prior set entirely", () => {
    const swamp: PluginBiomeContribution = {
      id: "swamp",
      name: "Swamp",
      color: 0x4a5d3a,
      heightRange: [0, 0.2],
    };
    setPluginBiomes([DESERT]);
    setPluginBiomes([swamp]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(merged.swamp).toBeDefined();
    expect(merged.desert).toBeUndefined();
  });

  it("applies defaults for omitted optional fields", () => {
    const minimal: PluginBiomeContribution = {
      id: "minimal",
      name: "Minimal",
      color: 0x808080,
      heightRange: [0, 1],
    };
    setPluginBiomes([minimal]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    const entry = merged.minimal!;
    expect(entry.terrainMultiplier).toBe(1);
    expect(entry.difficultyLevel).toBe(0);
    expect(entry.maxSlope).toBe(1.5);
    expect(entry.resourceDensity).toBe(1);
  });

  // ──────────────────────────────────────────────────────────
  // PLAN_PACK_TYPES Phase 3 — biome-pack contributions
  // compose alongside plugin contributions.
  // ──────────────────────────────────────────────────────────
  it("biome pack contributions overlay engine defaults", () => {
    const beach: PluginBiomeContribution = {
      id: "beach",
      name: "Beach",
      color: 0xf5deb3,
      heightRange: [0, 0.1],
    };
    setBiomePackBiomes([beach]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(Object.keys(merged).sort()).toEqual(["beach", "forest", "tundra"]);
    expect(merged.beach?.color).toBe(0xf5deb3);
  });

  it("plugin biomes win over biome-pack biomes on id collision", () => {
    const packDesert: PluginBiomeContribution = {
      id: "desert",
      name: "Visual-Theme Desert",
      color: 0xddc89a,
      heightRange: [0, 0.3],
    };
    const pluginDesert: PluginBiomeContribution = {
      id: "desert",
      name: "Gameplay Desert",
      color: 0xc8a878,
      heightRange: [0, 0.3],
    };
    setBiomePackBiomes([packDesert]);
    setPluginBiomes([pluginDesert]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(merged.desert?.name).toBe("Gameplay Desert");
    expect(merged.desert?.color).toBe(0xc8a878);
  });

  it("biome pack and plugin contributions both compose into the merged map", () => {
    const beach: PluginBiomeContribution = {
      id: "beach",
      name: "Beach",
      color: 0xf5deb3,
      heightRange: [0, 0.1],
    };
    const swamp: PluginBiomeContribution = {
      id: "swamp",
      name: "Swamp",
      color: 0x4a5d3a,
      heightRange: [0, 0.2],
    };
    setBiomePackBiomes([beach]);
    setPluginBiomes([swamp]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(Object.keys(merged).sort()).toEqual([
      "beach",
      "forest",
      "swamp",
      "tundra",
    ]);
  });

  it("setBiomePackBiomes([]) clears prior biome-pack biomes only", () => {
    const beach: PluginBiomeContribution = {
      id: "beach",
      name: "Beach",
      color: 0xf5deb3,
      heightRange: [0, 0.1],
    };
    setPluginBiomes([DESERT]);
    setBiomePackBiomes([beach]);
    setBiomePackBiomes([]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(merged.desert).toBeDefined();
    expect(merged.beach).toBeUndefined();
  });
});
