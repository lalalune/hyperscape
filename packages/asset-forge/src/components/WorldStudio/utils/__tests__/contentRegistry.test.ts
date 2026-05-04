/**
 * PLAN_AAA_CONTENT_SYSTEM Phase B — contentRegistry contract.
 *
 * Replaces the prior `pluginBiomeRegistry.test.ts` (plugin
 * biomes only) with coverage of every section type the unified
 * registry now holds.
 */
import { describe, it, expect, afterEach } from "vitest";
import type { BiomeDefinition } from "@hyperforge/procgen/terrain";
import type {
  BiomeContribution,
  TerrainShaderRecipe,
  WaterShaderRecipe,
  VegetationSpecies,
  VegetationDensityRule,
} from "@hyperforge/manifest-schema";
import {
  setPluginBiomes,
  setContentPackContent,
  getActiveBiomeDefinitions,
  getActiveTerrainShaders,
  getActiveWaterShaders,
  getActiveVegetationSpecies,
  getActiveVegetationDensityRules,
  getDensityRulesForBiome,
  _clearAll,
  type PluginBiomeContribution,
} from "../contentRegistry";

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
  heightRange: [0, 0.3],
};

describe("contentRegistry — biomes (plugin path)", () => {
  afterEach(() => _clearAll());

  it("returns engine defaults verbatim when nothing is registered", () => {
    expect(getActiveBiomeDefinitions(ENGINE_DEFAULTS)).toBe(ENGINE_DEFAULTS);
  });

  it("plugin biomes overlay engine defaults", () => {
    setPluginBiomes([DESERT]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(Object.keys(merged).sort()).toEqual(["desert", "forest", "tundra"]);
    expect(merged.desert?.name).toBe("Desert");
  });

  it("plugin biome with same id overrides an engine default", () => {
    const customForest: PluginBiomeContribution = {
      id: "forest",
      name: "Tropical Forest",
      color: 0x1a8e3c,
      heightRange: [0, 0.4],
    };
    setPluginBiomes([customForest]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(merged.forest?.name).toBe("Tropical Forest");
  });

  it("setPluginBiomes([]) clears prior plugin biomes", () => {
    setPluginBiomes([DESERT]);
    setPluginBiomes([]);
    expect(getActiveBiomeDefinitions(ENGINE_DEFAULTS)).toBe(ENGINE_DEFAULTS);
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
    expect(merged.minimal?.terrainMultiplier).toBe(1);
    expect(merged.minimal?.maxSlope).toBe(1.5);
  });
});

describe("contentRegistry — biomes (content pack path)", () => {
  afterEach(() => _clearAll());

  it("content pack biomes REPLACE engine defaults (project is fully themed)", () => {
    // When a content pack ships biomes, the project is fully themed:
    // engine defaults must NOT leak into the palette alongside content
    // pack biomes — otherwise procgen distributes ~1/Nth of tiles to
    // the unthemed `default` biome, leaving "Default (137 tiles)"
    // entries alongside the themed ones in the outliner.
    const beach: BiomeContribution = {
      id: "beach",
      name: "Beach",
      color: 0xf5deb3,
      terrainMultiplier: 1,
      difficultyLevel: 0,
      heightRange: [0, 0.1],
      maxSlope: 1.5,
      resourceDensity: 1,
    };
    setContentPackContent({ biomes: [beach] });
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(merged.beach?.color).toBe(0xf5deb3);
    // Only the content pack biome — engine defaults dropped.
    expect(Object.keys(merged).sort()).toEqual(["beach"]);
  });

  it("plugin biomes win over content pack biomes on id collision", () => {
    const packDesert: BiomeContribution = {
      id: "desert",
      name: "Visual-Theme Desert",
      color: 0xddc89a,
      terrainMultiplier: 1,
      difficultyLevel: 0,
      heightRange: [0, 0.3],
      maxSlope: 1.5,
      resourceDensity: 1,
    };
    const pluginDesert: PluginBiomeContribution = {
      id: "desert",
      name: "Gameplay Desert",
      color: 0xc8a878,
      heightRange: [0, 0.3],
    };
    setContentPackContent({ biomes: [packDesert] });
    setPluginBiomes([pluginDesert]);
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(merged.desert?.name).toBe("Gameplay Desert");
  });

  it("setContentPackContent omitted sections leave existing maps untouched", () => {
    const beach: BiomeContribution = {
      id: "beach",
      name: "Beach",
      color: 0xf5deb3,
      terrainMultiplier: 1,
      difficultyLevel: 0,
      heightRange: [0, 0.1],
      maxSlope: 1.5,
      resourceDensity: 1,
    };
    setContentPackContent({ biomes: [beach] });
    setContentPackContent({ terrainShaders: [] }); // does NOT clear biomes
    const merged = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(merged.beach).toBeDefined();
  });
});

describe("contentRegistry — terrain shaders", () => {
  afterEach(() => _clearAll());

  it("registers and returns terrain shader recipes", () => {
    const recipe: TerrainShaderRecipe = {
      id: "tsl-stylized-cell",
      name: "Stylized Cell-Shaded",
      description: "",
      recipeId: "tsl-cell",
      params: { ramp: 4 },
    };
    setContentPackContent({ terrainShaders: [recipe] });
    const shaders = getActiveTerrainShaders();
    expect(shaders.size).toBe(1);
    expect(shaders.get("tsl-stylized-cell")?.recipeId).toBe("tsl-cell");
  });
});

describe("contentRegistry — water shaders", () => {
  afterEach(() => _clearAll());

  it("registers and returns water shader recipes", () => {
    const recipe: WaterShaderRecipe = {
      id: "cartoon-water",
      name: "Cartoon Water",
      description: "",
      recipeId: "tsl-flat-cartoon",
      params: { foamThreshold: 0.5 },
    };
    setContentPackContent({ waterShaders: [recipe] });
    expect(getActiveWaterShaders().get("cartoon-water")?.recipeId).toBe(
      "tsl-flat-cartoon",
    );
  });
});

describe("contentRegistry — vegetation", () => {
  afterEach(() => _clearAll());

  const OAK: VegetationSpecies = {
    id: "oak",
    name: "Oak",
    description: "",
    category: "tree",
    modelRef: "@hyperforge/asset-pack-hyperia-trees-v1/oak",
    baseScale: 1,
    scaleVariation: [0.9, 1.1],
    randomRotation: true,
    alignToNormal: false,
    yOffset: 0,
    maxSlope: 0.4,
    tags: ["tree"],
  };
  const FOREST_TREES: VegetationDensityRule = {
    id: "forest-trees",
    biomeId: "forest",
    category: "tree",
    density: 0.05,
    minSpacing: 2,
    clustering: false,
    noiseScale: 1,
    noiseThreshold: 0.4,
    avoidWater: true,
    avoidSteepSlopes: true,
  };
  const BEACH_PALMS: VegetationDensityRule = {
    id: "beach-palms",
    biomeId: "beach",
    category: "tree",
    density: 0.02,
    minSpacing: 5,
    clustering: true,
    clusterSize: 3,
    noiseScale: 1,
    noiseThreshold: 0.5,
    avoidWater: true,
    avoidSteepSlopes: true,
  };

  it("registers species and density rules", () => {
    setContentPackContent({
      vegetationSpecies: [OAK],
      vegetationDensityRules: [FOREST_TREES, BEACH_PALMS],
    });
    expect(getActiveVegetationSpecies().get("oak")?.name).toBe("Oak");
    expect(getActiveVegetationDensityRules().size).toBe(2);
  });

  it("getDensityRulesForBiome filters by biomeId", () => {
    setContentPackContent({
      vegetationDensityRules: [FOREST_TREES, BEACH_PALMS],
    });
    expect(getDensityRulesForBiome("forest")).toHaveLength(1);
    expect(getDensityRulesForBiome("beach")).toHaveLength(1);
    expect(getDensityRulesForBiome("tundra")).toHaveLength(0);
  });
});
