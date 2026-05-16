/**
 * Single source of truth for biome type identifiers and per-biome configs.
 *
 * All terrain files (TerrainSystem, TerrainHeightParams, TerrainShader,
 * QuadChunkWorker, TerrainWorker, TerrainQuadChunkGenerator) MUST import
 * from here instead of using string literals.
 */

import type { BiomeTreeConfig } from "../../../types/world/world-types";
import { TreeId } from "../../../constants/TreeTypes";

/**
 * Biome id — an opaque string identifier sourced from the
 * content registry (plugin contributions or content packs).
 *
 * Replaces the legacy `BiomeType` enum (Phase 3.2 deeper of
 * PLAN_AAA_MASTER_AUDIT). The enum hardcoded 3 Hyperia values
 * (tundra / forest / canyon) and blocked plugins from
 * contributing new biomes with non-Hyperia names. `BiomeId`
 * is structurally `string` so any contributed id (arctic,
 * tropical, volcanic, etc.) flows through.
 */
export type BiomeId = string;

/** Hyperia's default biome id. New projects with no content
 *  pack installed see this as the engine fallback. */
export const DEFAULT_BIOME: BiomeId = "forest";

/**
 * @deprecated The hardcoded 3-biome list is being phased out.
 *   Callers wanting the active biome set should read from
 *   `useActiveBiomes` / `getActiveBiomeDefinitions` instead.
 *   Kept for backward compat with the worker JS path that
 *   needs an in-bundle list before the registry is populated.
 */
export const BIOME_LIST: BiomeId[] = ["tundra", "forest", "canyon"];

/**
 * Worker-injectable JS that defines BiomeType constants.
 * Injected once at the top of inline worker code so the worker
 * can reference BT_TUNDRA, BT_FOREST, BT_CANYON without magic
 * strings. These remain hardcoded for the Hyperia 3-biome path
 * (`biomeForestWeight` / `biomeCanyonWeight` vertex attrs);
 * Phase 2.1 follow-up moves the worker to an N-channel pattern
 * that reads from the registry instead.
 */
export function buildBiomeConstantsJS(): string {
  return `
  var BT_TUNDRA = "tundra";
  var BT_FOREST = "forest";
  var BT_CANYON = "canyon";
  var BT_DEFAULT = BT_FOREST;
  `;
}

// ---------------------------------------------------------------------------
// Per-biome tree configs
// ---------------------------------------------------------------------------

const FOREST_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  trees: {
    [TreeId.General]: { weight: 50, maxHeight: 60 },
    [TreeId.Eucalyptus]: { weight: 10, maxHeight: 60 },
    [TreeId.Oak]: { weight: 30, maxHeight: 60 },
    [TreeId.Mahogany]: { weight: 20, maxHeight: 60 },
    [TreeId.Pine]: { weight: 50, minHeight: 60 },
    [TreeId.Bamboo]: { weight: 20, minHeight: 50 },
    [TreeId.Palm]: {
      weight: 25,
      waterAffinity: 0.8,
      waterSearchRadius: 100,
      waterMaxDistance: 80,
    },
    [TreeId.Banana]: {
      weight: 25,
      waterAffinity: 0.8,
      waterSearchRadius: 100,
      waterMaxDistance: 80,
    },
  },
  density: 50,
  minSpacing: 5,
  clustering: true,
  clusterSize: 40,
  clusterRadius: 120,
  clusterSpacing: 80,
  scaleVariation: [1.0, 1.2],
  maxSlope: 1.5,
};

const CANYON_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  trees: {
    [TreeId.Palm]: {
      weight: 25,
      waterAffinity: 0.8,
      waterSearchRadius: 100,
      waterMaxDistance: 80,
    },
    [TreeId.Banana]: {
      weight: 25,
      waterAffinity: 0.8,
      waterSearchRadius: 100,
      waterMaxDistance: 80,
    },
    [TreeId.Maple]: { weight: 20, maxHeight: 60 },
    [TreeId.Magic]: { weight: 5, maxHeight: 60 },
    [TreeId.Dead]: { weight: 25 },
  },
  density: 10,
  minSpacing: 12,
  clustering: false,
  scaleVariation: [1.0, 1.2],
  maxSlope: 0.1,
};

const TUNDRA_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  enableSnow: true,
  trees: {
    [TreeId.Pine]: { weight: 50, minHeight: 35 },
    [TreeId.PineDead]: { weight: 30, minHeight: 38 },
    [TreeId.Dead]: { weight: 20, minHeight: 38 },
  },
  density: 25,
  minSpacing: 5,
  clustering: true,
  clusterSize: 30,
  clusterRadius: 120,
  clusterSpacing: 100,
  scaleVariation: [1.0, 1.2],
  maxSlope: 1.5,
};

// Keyed by `BiomeId` (string) so plugins / content packs can
// contribute new entries via `registerBiomeTreeConfig` (future).
// Until that registry exists, Hyperia's 3 baseline configs ship
// here; non-Hyperia biome ids fall through to the forest config
// via `getTreeConfigForBiome`.
const BIOME_TREE_CONFIGS: Record<BiomeId, BiomeTreeConfig> = {
  forest: FOREST_TREE_CONFIG,
  canyon: CANYON_TREE_CONFIG,
  tundra: TUNDRA_TREE_CONFIG,
};

/**
 * Get the tree config for a specific biome.
 * Falls back to the forest config for unknown biomes.
 */
export function getTreeConfigForBiome(biomeId: BiomeId): BiomeTreeConfig {
  return BIOME_TREE_CONFIGS[biomeId] ?? FOREST_TREE_CONFIG;
}

// ---------------------------------------------------------------------------
// Per-biome grass configs
// ---------------------------------------------------------------------------

export interface BiomeGrassConfig {
  /** Overall density multiplier (0 = no grass, 1 = full density) */
  density: number;
  /** Max terrain slope (0-1, same metric as GPU shader) for grass placement */
  maxSlope: number;
  /** Minimum grassWeight from terrain color to allow placement */
  minGrassWeight: number;
  /** Blade height scale relative to global BLADE_HEIGHT_MIN/MAX */
  heightScale: number;
  /** Patchiness (0 = uniform spread, 1 = highly clustered islands) */
  patchiness: number;
  /** World-space noise frequency for patch mask (higher = smaller patches) */
  patchScale: number;
  /** Optional grass tint color [r, g, b] in 0-1 range. Blended over the terrain color. */
  tintColor?: [number, number, number];
  /** How strongly tintColor is applied (0 = terrain color, 1 = full tint). Default 0. */
  tintStrength?: number;
}

const FOREST_GRASS_CONFIG: BiomeGrassConfig = {
  density: 1.0,
  maxSlope: 0.1,
  minGrassWeight: 0.6,
  heightScale: 1.0,
  patchiness: 0.0,
  patchScale: 0.02,
};

const CANYON_GRASS_CONFIG: BiomeGrassConfig = {
  density: 0.8,
  maxSlope: 0.15,
  minGrassWeight: 0.8,
  heightScale: 0.8,
  patchiness: 0.95,
  patchScale: 0.05,
  tintColor: [0.35, 0.4, 0.15],
  tintStrength: 0.4,
};

const TUNDRA_GRASS_CONFIG: BiomeGrassConfig = {
  density: 1.0,
  maxSlope: 0.3,
  minGrassWeight: 0.8,
  heightScale: 1.0,
  patchiness: 0.6,
  patchScale: 0.018,
  tintColor: [1.0, 1.0, 1.0],
  tintStrength: 0.4,
};

const BIOME_GRASS_CONFIGS: Record<BiomeId, BiomeGrassConfig> = {
  forest: FOREST_GRASS_CONFIG,
  canyon: CANYON_GRASS_CONFIG,
  tundra: TUNDRA_GRASS_CONFIG,
};

export function getGrassConfigForBiome(biomeId: BiomeId): BiomeGrassConfig {
  return BIOME_GRASS_CONFIGS[biomeId] ?? FOREST_GRASS_CONFIG;
}

/** Biome IDs whose tree config has enableSnow set to true. */
export const SNOW_BIOMES: ReadonlySet<string> = new Set(
  Object.entries(BIOME_TREE_CONFIGS)
    .filter(([, cfg]) => cfg.enableSnow)
    .map(([id]) => id),
);
