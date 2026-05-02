/**
 * Terrain Presets
 *
 * Pre-configured terrain settings for common world types.
 * Each preset provides a complete or partial TerrainConfig.
 */

import type { TerrainConfig, TerrainPreset } from "./types";
import { DEFAULT_TERRAIN_CONFIG } from "./TerrainGenerator";
import { DEFAULT_MAX_HEIGHT, DEFAULT_WATER_THRESHOLD } from "./constants";

/**
 * Small Island preset
 * Creates a compact island suitable for starter areas
 */
export const SMALL_ISLAND_PRESET: TerrainPreset = {
  id: "small-island",
  name: "Small Island",
  description:
    "Compact island with natural coastline, suitable for starter areas",
  config: {
    tileSize: 100,
    worldSize: 10, // 1km x 1km
    maxHeight: DEFAULT_MAX_HEIGHT,
    waterThreshold: DEFAULT_WATER_THRESHOLD,
    island: {
      enabled: true,
      maxWorldSizeTiles: 10,
      falloffTiles: 2,
      edgeNoiseScale: 0.003,
      edgeNoiseStrength: 0.05,
    },
    biomes: {
      gridSize: 2,
      jitter: 0.3,
      minInfluence: 400,
      maxInfluence: 600,
      gaussianCoeff: 0.2,
      boundaryNoiseScale: 0.005,
      boundaryNoiseAmount: 0.1,
    },
  },
};

/**
 * Large Island preset
 * Creates a large island with diverse biomes
 */
export const LARGE_ISLAND_PRESET: TerrainPreset = {
  id: "large-island",
  name: "Large Island",
  description: "Large island with diverse biomes and terrain features",
  config: {
    tileSize: 100,
    worldSize: 100, // 10km x 10km
    maxHeight: DEFAULT_MAX_HEIGHT,
    waterThreshold: DEFAULT_WATER_THRESHOLD,
    island: {
      enabled: true,
      maxWorldSizeTiles: 100,
      falloffTiles: 4,
      // See DEFAULT_ISLAND_CONFIG comment in IslandMask.ts —
      // increased edge noise so coastline visibly varies per
      // seed instead of always producing the same Hyperia
      // outline.
      edgeNoiseScale: 0.005,
      edgeNoiseStrength: 0.12,
    },
  },
};

/**
 * Archipelago preset
 * Creates multiple islands with ocean between them
 */
export const ARCHIPELAGO_PRESET: TerrainPreset = {
  id: "archipelago",
  name: "Archipelago",
  description: "Multiple islands separated by ocean channels",
  config: {
    tileSize: 100,
    worldSize: 50, // 5km x 5km
    maxHeight: 25,
    waterThreshold: 8.0, // Higher water level = more ocean
    island: {
      enabled: true,
      maxWorldSizeTiles: 50,
      falloffTiles: 3,
      edgeNoiseScale: 0.005,
      edgeNoiseStrength: 0.15, // More coastline variation
    },
    noise: {
      continent: {
        scale: 0.002,
        weight: 0.5,
        octaves: 4,
        persistence: 0.6,
        lacunarity: 2.0,
      },
      ridge: { scale: 0.005, weight: 0.15 },
      hill: {
        scale: 0.015,
        weight: 0.15,
        octaves: 3,
        persistence: 0.5,
        lacunarity: 2.0,
      },
      erosion: { scale: 0.008, weight: 0.05, octaves: 2 },
      detail: {
        scale: 0.05,
        weight: 0.02,
        octaves: 2,
        persistence: 0.3,
        lacunarity: 2.5,
      },
    },
  },
};

/**
 * Continent preset
 * Creates large continental landmass with no island masking
 */
export const CONTINENT_PRESET: TerrainPreset = {
  id: "continent",
  name: "Continent",
  description: "Large continental landmass with diverse terrain",
  config: {
    tileSize: 100,
    worldSize: 200, // 20km x 20km
    maxHeight: 50, // Taller mountains
    waterThreshold: 10.0,
    island: {
      enabled: false,
      maxWorldSizeTiles: 200,
      falloffTiles: 0,
      edgeNoiseScale: 0,
      edgeNoiseStrength: 0,
    },
    biomes: {
      gridSize: 5, // More biome variety
      jitter: 0.4,
      minInfluence: 3000,
      maxInfluence: 5000,
      gaussianCoeff: 0.12,
      boundaryNoiseScale: 0.002,
      boundaryNoiseAmount: 0.2,
    },
    noise: {
      continent: {
        scale: 0.0005,
        weight: 0.45,
        octaves: 6,
        persistence: 0.65,
        lacunarity: 2.0,
      },
      ridge: { scale: 0.002, weight: 0.15 },
      hill: {
        scale: 0.008,
        weight: 0.15,
        octaves: 5,
        persistence: 0.5,
        lacunarity: 2.2,
      },
      erosion: { scale: 0.004, weight: 0.1, octaves: 4 },
      detail: {
        scale: 0.03,
        weight: 0.04,
        octaves: 3,
        persistence: 0.3,
        lacunarity: 2.5,
      },
    },
  },
};

/**
 * Mountain Range preset
 * Creates dramatic mountainous terrain
 */
export const MOUNTAIN_RANGE_PRESET: TerrainPreset = {
  id: "mountain-range",
  name: "Mountain Range",
  description: "Dramatic mountainous terrain with deep valleys",
  config: {
    tileSize: 100,
    worldSize: 50,
    maxHeight: 80, // Very tall mountains
    waterThreshold: 15.0,
    island: {
      enabled: false,
      maxWorldSizeTiles: 50,
      falloffTiles: 0,
      edgeNoiseScale: 0,
      edgeNoiseStrength: 0,
    },
    biomes: {
      gridSize: 3,
      jitter: 0.3,
      minInfluence: 1500,
      maxInfluence: 2500,
      gaussianCoeff: 0.1,
      boundaryNoiseScale: 0.003,
      boundaryNoiseAmount: 0.15,
    },
    noise: {
      continent: {
        scale: 0.001,
        weight: 0.3,
        octaves: 5,
        persistence: 0.7,
        lacunarity: 2.0,
      },
      ridge: { scale: 0.004, weight: 0.35 }, // Strong ridges
      hill: {
        scale: 0.01,
        weight: 0.15,
        octaves: 4,
        persistence: 0.55,
        lacunarity: 2.3,
      },
      erosion: { scale: 0.006, weight: 0.12, octaves: 4 },
      detail: {
        scale: 0.04,
        weight: 0.05,
        octaves: 2,
        persistence: 0.35,
        lacunarity: 2.5,
      },
    },
  },
};

/**
 * Flat Plains preset
 * Creates gentle rolling plains with minimal height variation
 */
export const FLAT_PLAINS_PRESET: TerrainPreset = {
  id: "flat-plains",
  name: "Flat Plains",
  description: "Gentle rolling plains with minimal height variation",
  config: {
    tileSize: 100,
    worldSize: 100,
    maxHeight: 15, // Low height variation
    waterThreshold: 3.0,
    island: {
      enabled: false,
      maxWorldSizeTiles: 100,
      falloffTiles: 0,
      edgeNoiseScale: 0,
      edgeNoiseStrength: 0,
    },
    biomes: {
      gridSize: 4,
      jitter: 0.4,
      minInfluence: 2500,
      maxInfluence: 4000,
      gaussianCoeff: 0.18,
      boundaryNoiseScale: 0.002,
      boundaryNoiseAmount: 0.1,
    },
    noise: {
      continent: {
        scale: 0.0005,
        weight: 0.2,
        octaves: 3,
        persistence: 0.4,
        lacunarity: 2.0,
      },
      ridge: { scale: 0.002, weight: 0.05 },
      hill: {
        scale: 0.008,
        weight: 0.25,
        octaves: 3,
        persistence: 0.4,
        lacunarity: 2.0,
      },
      erosion: { scale: 0.005, weight: 0.05, octaves: 2 },
      detail: {
        scale: 0.04,
        weight: 0.08,
        octaves: 2,
        persistence: 0.3,
        lacunarity: 2.5,
      },
    },
  },
};

/**
 * Desert preset
 * Creates sandy dune-like terrain
 */
export const DESERT_PRESET: TerrainPreset = {
  id: "desert",
  name: "Desert",
  description: "Sandy dune-like terrain with gentle undulations",
  config: {
    tileSize: 100,
    worldSize: 80,
    maxHeight: 20,
    waterThreshold: 2.0, // Very little water
    island: {
      enabled: false,
      maxWorldSizeTiles: 80,
      falloffTiles: 0,
      edgeNoiseScale: 0,
      edgeNoiseStrength: 0,
    },
    noise: {
      continent: {
        scale: 0.0008,
        weight: 0.15,
        octaves: 3,
        persistence: 0.5,
        lacunarity: 2.0,
      },
      ridge: { scale: 0.003, weight: 0.05 },
      hill: {
        scale: 0.015,
        weight: 0.35,
        octaves: 4,
        persistence: 0.6,
        lacunarity: 1.8,
      }, // Dune-like
      erosion: { scale: 0.007, weight: 0.03, octaves: 2 },
      detail: {
        scale: 0.05,
        weight: 0.15,
        octaves: 3,
        persistence: 0.5,
        lacunarity: 2.0,
      },
    },
  },
};

/**
 * Demo Island preset
 * RuneScape Tutorial Island-sized: small, mostly flat, walkable in a few minutes.
 * Gentle terrain with 2-3 biomes — perfect for prototyping gameplay loops.
 */
export const DEMO_ISLAND_PRESET: TerrainPreset = {
  id: "demo-island",
  name: "Demo Island",
  description:
    "Tiny, mostly flat island inspired by RuneScape Tutorial Island — ideal for gameplay prototyping",
  config: {
    tileSize: 100,
    worldSize: 20, // 2km × 2km — crossable in ~2 min at walk speed
    maxHeight: 15, // Gentle hills, nothing steep
    waterThreshold: 3.0,
    island: {
      enabled: true,
      maxWorldSizeTiles: 20,
      falloffTiles: 2,
      edgeNoiseScale: 0.004, // Organic coastline wobble
      edgeNoiseStrength: 0.06,
    },
    biomes: {
      gridSize: 2, // 2-3 biomes max for this size
      jitter: 0.3,
      minInfluence: 300,
      maxInfluence: 500,
      gaussianCoeff: 0.25,
      boundaryNoiseScale: 0.006,
      boundaryNoiseAmount: 0.08,
    },
    noise: {
      continent: {
        scale: 0.0006,
        weight: 0.55, // Dominant — broad gentle shape
        octaves: 3, // Few octaves = smoother
        persistence: 0.35,
        lacunarity: 2.0,
      },
      ridge: { scale: 0.002, weight: 0.02 }, // Nearly zero — no sharp ridges
      hill: {
        scale: 0.008,
        weight: 0.05, // Very subtle rolling
        octaves: 2,
        persistence: 0.3,
        lacunarity: 2.0,
      },
      erosion: { scale: 0.005, weight: 0.02, octaves: 2 }, // Minimal erosion detail
      detail: {
        scale: 0.04,
        weight: 0.01, // Almost no micro-detail
        octaves: 1,
        persistence: 0.2,
        lacunarity: 2.0,
      },
    },
  },
};

/**
 * All terrain presets
 */
export const TERRAIN_PRESETS: Record<string, TerrainPreset> = {
  "demo-island": DEMO_ISLAND_PRESET,
  "small-island": SMALL_ISLAND_PRESET,
  "large-island": LARGE_ISLAND_PRESET,
  archipelago: ARCHIPELAGO_PRESET,
  continent: CONTINENT_PRESET,
  "mountain-range": MOUNTAIN_RANGE_PRESET,
  "flat-plains": FLAT_PLAINS_PRESET,
  desert: DESERT_PRESET,
};

/**
 * Get a terrain preset by ID
 */
export function getTerrainPreset(presetId: string): TerrainPreset | undefined {
  return TERRAIN_PRESETS[presetId];
}

/**
 * Create a TerrainConfig from a preset with optional overrides
 */
export function createConfigFromPreset(
  presetId: string,
  overrides: Partial<TerrainConfig> = {},
): TerrainConfig {
  const preset = TERRAIN_PRESETS[presetId];
  if (!preset) {
    console.warn(`Unknown terrain preset: ${presetId}, using default`);
    return { ...DEFAULT_TERRAIN_CONFIG, ...overrides };
  }

  // Deep merge preset config with defaults and overrides
  return {
    ...DEFAULT_TERRAIN_CONFIG,
    ...preset.config,
    ...overrides,
    noise: {
      ...DEFAULT_TERRAIN_CONFIG.noise,
      ...preset.config.noise,
      ...overrides.noise,
    },
    biomes: {
      ...DEFAULT_TERRAIN_CONFIG.biomes,
      ...preset.config.biomes,
      ...overrides.biomes,
    },
    island: {
      ...DEFAULT_TERRAIN_CONFIG.island,
      ...preset.config.island,
      ...overrides.island,
    },
    shoreline: {
      ...DEFAULT_TERRAIN_CONFIG.shoreline,
      ...preset.config.shoreline,
      ...overrides.shoreline,
    },
  };
}

/**
 * List all available preset IDs
 */
export function listPresetIds(): string[] {
  return Object.keys(TERRAIN_PRESETS);
}
