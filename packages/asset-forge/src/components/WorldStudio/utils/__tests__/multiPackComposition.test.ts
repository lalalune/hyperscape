/**
 * Phase 5.4 — multi-pack composition acceptance test.
 *
 * The AAA framework promise: a single project can install
 * MULTIPLE content packs (e.g. tropical + arctic + hyperia)
 * AND a gameplay plugin (hyperscape), and the renderer + agent
 * see the UNION of every section every pack contributes.
 *
 * This test exercises the full end-to-end composition story
 * by feeding fixtures that mirror the real content-pack
 * manifests through:
 *
 *   1. `mergeContentPackManifests` — the input-side merger that
 *      `useProjectLoader` calls when it fetches
 *      `/api/content-packs/installed`.
 *   2. `setContentPackContent` — writes the merged input into
 *      the runtime registry.
 *   3. `setPluginBiomes` — adds the gameplay plugin's biome
 *      contributions on top.
 *   4. `getActive*` readers — what the renderer + agent see.
 *
 * Validates the composition rule from `PLAN_AAA_MASTER_AUDIT`:
 * sections concatenate, later packs win on intra-section id
 * conflicts, plugin biomes overlay content-pack biomes
 * field-by-field.
 */

import { afterEach, describe, expect, it } from "vitest";

import type { BiomeDefinition } from "@hyperforge/procgen/terrain";
import type {
  BiomeContribution,
  TerrainHeightmapPreset,
  VegetationSpecies,
  VegetationDensityRule,
} from "@hyperforge/manifest-schema";

import {
  _clearAll,
  getActiveBiomeDefinitions,
  getActiveTerrainHeightmapPresets,
  getActiveVegetationSpecies,
  getActiveVegetationDensityRules,
  setContentPackContent,
  setPluginBiomes,
  type PluginBiomeContribution,
} from "../contentRegistry";
import {
  mergeContentPackManifests,
  type ContentPackManifestSlice,
} from "../mergeContentPackManifests";

// ───────── Fixtures: realistic content-pack manifest slices ─────────
//
// These mirror the shapes the `server/builtins/content-packs.ts`
// builtin pack catalog actually ships. Kept terse — we only need
// enough field surface to exercise the merge + registry.

const TROPICAL_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "tropical_beach",
    name: "Tropical Beach",
    color: 0xf2e8c9,
    heightRange: [0, 0.2],
  },
  {
    id: "jungle",
    name: "Jungle",
    color: 0x2f6f3f,
    heightRange: [0.2, 0.6],
  },
  {
    id: "mangrove",
    name: "Mangrove",
    color: 0x3a5f3a,
    heightRange: [0, 0.3],
  },
];

const ARCTIC_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "snow_plain",
    name: "Snow Plain",
    color: 0xe8e8f0,
    heightRange: [0, 0.4],
  },
  {
    id: "frozen_lake",
    name: "Frozen Lake",
    color: 0xb8d0e0,
    heightRange: [0, 0.1],
  },
  {
    id: "glacier",
    name: "Glacier",
    color: 0xd0e8f5,
    heightRange: [0.4, 0.9],
  },
];

const TROPICAL_HEIGHTMAP: TerrainHeightmapPreset = {
  id: "tropical-atoll",
  name: "Tropical atoll",
  description: "Low atoll-like landmass.",
  params: {
    terrain: { maxHeight: 30, waterThreshold: 12 },
    island: { enabled: true, maxWorldSizeTiles: 800 },
  },
};

const ARCTIC_HEIGHTMAP: TerrainHeightmapPreset = {
  id: "arctic-tundra",
  name: "Arctic tundra",
  description: "Low rolling icefield.",
  params: {
    terrain: { maxHeight: 40, waterThreshold: 8 },
    island: { enabled: false },
  },
};

const TROPICAL_SPECIES: ReadonlyArray<VegetationSpecies> = [
  {
    id: "tropical_palm",
    name: "Tropical Palm",
    description: "Coastal palm.",
    modelRefs: [],
    scaleRange: [0.8, 1.2],
    maxSlope: 0.6,
    tags: ["tropical", "palm"],
  },
  {
    id: "tropical_banana",
    name: "Tropical Banana",
    description: "Banana tree.",
    modelRefs: [],
    scaleRange: [0.7, 1.1],
    maxSlope: 0.7,
    tags: ["tropical", "fruit"],
  },
];

const ARCTIC_SPECIES: ReadonlyArray<VegetationSpecies> = [
  {
    id: "arctic_pine",
    name: "Arctic Pine",
    description: "Cold-tolerant pine.",
    modelRefs: [],
    scaleRange: [0.9, 1.4],
    maxSlope: 1.0,
    tags: ["arctic", "pine"],
  },
];

// Density rules are keyed by `id` in the registry; biomeId
// names the biome they target. Each fixture has a unique `id`.
const TROPICAL_DENSITY: ReadonlyArray<VegetationDensityRule> = [
  {
    id: "tropical_beach_trees",
    biomeId: "tropical_beach",
    category: "tree",
    density: 25,
    minSpacing: 6,
    clustering: true,
    noiseScale: 1,
    noiseThreshold: 0.5,
    avoidWater: true,
    avoidSteepSlopes: true,
  },
];

const ARCTIC_DENSITY: ReadonlyArray<VegetationDensityRule> = [
  {
    id: "snow_plain_trees",
    biomeId: "snow_plain",
    category: "tree",
    density: 8,
    minSpacing: 10,
    clustering: false,
    noiseScale: 1,
    noiseThreshold: 0.5,
    avoidWater: true,
    avoidSteepSlopes: true,
  },
];

const TROPICAL_PACK: ContentPackManifestSlice = {
  biomes: TROPICAL_BIOMES,
  terrainHeightmapPresets: [TROPICAL_HEIGHTMAP],
  vegetationSpecies: TROPICAL_SPECIES,
  vegetationDensityRules: TROPICAL_DENSITY,
};

const ARCTIC_PACK: ContentPackManifestSlice = {
  biomes: ARCTIC_BIOMES,
  terrainHeightmapPresets: [ARCTIC_HEIGHTMAP],
  vegetationSpecies: ARCTIC_SPECIES,
  vegetationDensityRules: ARCTIC_DENSITY,
};

// Hyperia plugin's biomes (3 hardcoded — matches HYPERIA_LIVE_GAME_BIOMES).
const HYPERIA_PLUGIN_BIOMES: ReadonlyArray<PluginBiomeContribution> = [
  {
    id: "tundra",
    name: "Tundra",
    color: 0xe8e4e0,
    heightRange: [0.3, 0.8],
  },
  {
    id: "forest",
    name: "Forest",
    color: 0x388e3c,
    heightRange: [0, 0.5],
  },
  {
    id: "canyon",
    name: "Canyon",
    color: 0x8d6e63,
    heightRange: [0.2, 0.6],
  },
];

const ENGINE_DEFAULTS: Record<string, BiomeDefinition> = {
  default: {
    id: "default",
    name: "Default",
    color: 0x808080,
    terrainMultiplier: 1,
    difficultyLevel: 0,
    heightRange: [0, 1],
    maxSlope: 1,
    resourceDensity: 1,
  },
};

// ─────────────────────────── Tests ────────────────────────────

describe("Phase 5.4 — tropical + arctic content packs compose", () => {
  afterEach(() => _clearAll());

  it("biome union surfaces every biome from both packs (engine default excluded — themed project)", () => {
    const merged = mergeContentPackManifests([TROPICAL_PACK, ARCTIC_PACK]);
    setContentPackContent(merged);
    const biomes = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    // The engine's neutral `default` biome is deliberately
    // omitted when ANY content pack ships biomes (themed
    // project — no unthemed-default leak into the palette).
    expect(Object.keys(biomes).sort()).toEqual(
      [
        "frozen_lake", // arctic
        "glacier", // arctic
        "jungle", // tropical
        "mangrove", // tropical
        "snow_plain", // arctic
        "tropical_beach", // tropical
      ].sort(),
    );
  });

  it("heightmap presets from both packs are reachable", () => {
    setContentPackContent(
      mergeContentPackManifests([TROPICAL_PACK, ARCTIC_PACK]),
    );
    const presets = getActiveTerrainHeightmapPresets();
    expect(presets.size).toBe(2);
    expect(presets.has("tropical-atoll")).toBe(true);
    expect(presets.has("arctic-tundra")).toBe(true);
  });

  it("vegetation species union surfaces every species from both packs", () => {
    setContentPackContent(
      mergeContentPackManifests([TROPICAL_PACK, ARCTIC_PACK]),
    );
    const species = getActiveVegetationSpecies();
    expect(Array.from(species.keys()).sort()).toEqual([
      "arctic_pine",
      "tropical_banana",
      "tropical_palm",
    ]);
  });

  it("density rules from both packs land in the registry", () => {
    setContentPackContent(
      mergeContentPackManifests([TROPICAL_PACK, ARCTIC_PACK]),
    );
    const rules = getActiveVegetationDensityRules();
    expect(rules.size).toBe(2);
    // Rules are keyed by `id` in the internal Map; verify
    // each rule's biomeId targets the right biome.
    const tropicalRule = rules.get("tropical_beach_trees");
    const arcticRule = rules.get("snow_plain_trees");
    expect(tropicalRule?.biomeId).toBe("tropical_beach");
    expect(arcticRule?.biomeId).toBe("snow_plain");
  });
});

describe("Phase 5.4 — hyperia plugin + tropical + arctic all coexist", () => {
  afterEach(() => _clearAll());

  it("plugin biomes (tundra/forest/canyon) coexist with content-pack biomes", () => {
    setPluginBiomes(HYPERIA_PLUGIN_BIOMES);
    setContentPackContent(
      mergeContentPackManifests([TROPICAL_PACK, ARCTIC_PACK]),
    );
    const biomes = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    // 3 plugin + 3 tropical + 3 arctic = 9 (engine default
    // excluded — themed project).
    expect(Object.keys(biomes).length).toBe(9);
    // Plugin biomes
    expect(biomes.tundra?.name).toBe("Tundra");
    expect(biomes.forest?.name).toBe("Forest");
    expect(biomes.canyon?.name).toBe("Canyon");
    // Tropical pack biomes
    expect(biomes.tropical_beach?.name).toBe("Tropical Beach");
    expect(biomes.jungle?.name).toBe("Jungle");
    // Arctic pack biomes
    expect(biomes.snow_plain?.name).toBe("Snow Plain");
    expect(biomes.glacier?.name).toBe("Glacier");
  });

  it("registering packs first, then plugins, lands the same final state", () => {
    setContentPackContent(
      mergeContentPackManifests([TROPICAL_PACK, ARCTIC_PACK]),
    );
    setPluginBiomes(HYPERIA_PLUGIN_BIOMES);
    const biomes = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    // Order independence — the final composed set has the same shape.
    expect(Object.keys(biomes).length).toBe(9);
  });
});

describe("Phase 5.4 — composition rules / precedence", () => {
  afterEach(() => _clearAll());

  it("later content pack wins when two packs ship the same biome id", () => {
    const earlyPack: ContentPackManifestSlice = {
      biomes: [
        {
          id: "shared_biome",
          name: "Early pack name",
          color: 0xff0000,
          heightRange: [0, 0.5],
        },
      ],
    };
    const latePack: ContentPackManifestSlice = {
      biomes: [
        {
          id: "shared_biome",
          name: "Late pack name",
          color: 0x00ff00,
          heightRange: [0, 0.5],
        },
      ],
    };
    setContentPackContent(mergeContentPackManifests([earlyPack, latePack]));
    const biomes = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(biomes.shared_biome?.name).toBe("Late pack name");
  });

  it("a pack with no contributions doesn't blank others (additive merge)", () => {
    const empty: ContentPackManifestSlice = {};
    setContentPackContent(mergeContentPackManifests([TROPICAL_PACK, empty]));
    const species = getActiveVegetationSpecies();
    expect(species.size).toBe(TROPICAL_SPECIES.length);
  });

  it("an empty pack list clears prior state cleanly", () => {
    // Seed something
    setContentPackContent(mergeContentPackManifests([TROPICAL_PACK]));
    expect(getActiveVegetationSpecies().size).toBeGreaterThan(0);

    // Empty merge → empty input → registry clears
    setContentPackContent(mergeContentPackManifests([]));
    expect(getActiveVegetationSpecies().size).toBe(0);
    expect(getActiveTerrainHeightmapPresets().size).toBe(0);
  });

  it("plugin biomes override content-pack biomes on id conflict", () => {
    // Pack ships "forest" biome with one color
    const packForest: ContentPackManifestSlice = {
      biomes: [
        {
          id: "forest",
          name: "Pack Forest",
          color: 0x111111,
          heightRange: [0, 0.5],
        },
      ],
    };
    setContentPackContent(mergeContentPackManifests([packForest]));
    // Plugin ships "forest" too — plugin wins (registry layer)
    setPluginBiomes(HYPERIA_PLUGIN_BIOMES);

    const biomes = getActiveBiomeDefinitions(ENGINE_DEFAULTS);
    expect(biomes.forest?.name).toBe("Forest");
  });
});

describe("Phase 5.4 — pack uninstall removes contributions", () => {
  afterEach(() => _clearAll());

  it("removing one pack from the merge drops its contributions", () => {
    // Start with both
    setContentPackContent(
      mergeContentPackManifests([TROPICAL_PACK, ARCTIC_PACK]),
    );
    expect(getActiveVegetationSpecies().size).toBe(3);

    // User uninstalls arctic — useProjectLoader re-fetches and
    // re-merges with just tropical
    setContentPackContent(mergeContentPackManifests([TROPICAL_PACK]));
    const species = getActiveVegetationSpecies();
    expect(species.size).toBe(TROPICAL_SPECIES.length);
    expect(species.has("arctic_pine")).toBe(false);
  });
});

describe("Phase 5.4 — mergeContentPackManifests (in isolation)", () => {
  it("returns all-empty-arrays on empty input (clears prior state)", () => {
    expect(mergeContentPackManifests([])).toEqual({
      biomes: [],
      terrainShaders: [],
      terrainHeightmapPresets: [],
      terrainNoiseFunctions: [],
      waterShaders: [],
      waterAnimations: [],
      vegetationSpecies: [],
      vegetationDensityRules: [],
    });
  });

  it("concatenates each section across packs in input order", () => {
    const merged = mergeContentPackManifests([TROPICAL_PACK, ARCTIC_PACK]);
    expect(merged.biomes!.length).toBe(
      TROPICAL_BIOMES.length + ARCTIC_BIOMES.length,
    );
    // Order preserved
    expect((merged.biomes![0] as BiomeContribution).id).toBe(
      TROPICAL_BIOMES[0].id,
    );
    expect(
      (merged.biomes![merged.biomes!.length - 1] as BiomeContribution).id,
    ).toBe(ARCTIC_BIOMES[ARCTIC_BIOMES.length - 1].id);
  });

  it("skips sections that the pack doesn't ship (undefined-safe)", () => {
    const biomeOnly: ContentPackManifestSlice = {
      biomes: TROPICAL_BIOMES,
      // No vegetation, no shaders, no presets
    };
    const merged = mergeContentPackManifests([biomeOnly]);
    expect(merged.biomes!.length).toBe(TROPICAL_BIOMES.length);
    expect(merged.vegetationSpecies!.length).toBe(0);
    expect(merged.terrainShaders!.length).toBe(0);
  });
});
