/**
 * GameTerrainAdapter — Thin wrapper around @hyperforge/shared/world pure functions.
 *
 * Provides the same public API (createGameTerrainQuerier, GAME_* constants) but
 * imports the actual terrain algorithm from shared instead of duplicating it.
 */

import {
  computeBaseHeight,
  adjustShorelineHeight,
  NoiseGenerator,
  MAX_HEIGHT,
  WATER_LEVEL_NORMALIZED,
  SHORELINE_CONFIG,
  BIOME_CONFIG,
  BIOME_CONFIGS,
  ISLAND_RADIUS,
  ISLAND_FALLOFF,
  ISLAND_DEEP_OCEAN_BUFFER,
  BEACH_PROFILE_POWER,
  COASTLINE_CIRCLE_SAMPLE_RADIUS,
  COAST_LARGE,
  COAST_MEDIUM,
  COAST_SMALL,
  type BiomeNoiseSet,
} from "@hyperforge/shared/world";
import { BiomeSystem } from "@hyperforge/procgen/terrain";
import type { BiomeDefinition, BiomeConfig } from "@hyperforge/procgen/terrain";
import { TERRAIN_CONSTANTS } from "@hyperforge/shared";
import { getActiveBiomeDefinitions } from "../WorldStudio/utils/contentRegistry";

// ============== GAME CONSTANTS (re-exported for consumers) ==============

export const GAME_MAX_HEIGHT = MAX_HEIGHT;
export const GAME_WATER_THRESHOLD = TERRAIN_CONSTANTS.WATER_THRESHOLD;
export const GAME_WATER_LEVEL_NORMALIZED = WATER_LEVEL_NORMALIZED;
export const GAME_SEED = 0;
export const GAME_TILE_SIZE = 100;
export const GAME_WORLD_SIZE = 100;
export const GAME_TILE_RESOLUTION = 64;

// Biome definitions for procgen BiomeSystem.
//
// Note: an earlier `GAME_BIOME_COLORS` const was removed —
// `_biomeRGB` inside `createGameTerrainQuerier` now derives its
// hex→RGB lookup from `GAME_BIOME_DEFINITIONS` (single source
// of truth) and merges in plugin biome contributions via
// `getActiveBiomeDefinitions`, so plugin-contributed biomes
// (R3.P3 — see `contentRegistry.ts`) get the same
// color treatment as engine defaults.
//
// R3.P3 leak status: engine still defaults to Hyperia's three
// biomes (tundra / forest / canyon). Hyperia's plugin.json now
// contributes the same three (commit `63e8e2992`); shooter-demo
// contributes arena / wasteland / fortifications (commit
// `d29712023`). Plugin contributions WIN on id collision, so
// Hyperia projects see no behavior change. Non-Hyperia projects
// see plugin biomes layered on top of these defaults — the
// leak narrows but isn't fully closed (that needs the
// `biomeForestWeight`/`biomeCanyonWeight` named-field refactor
// at terrainHelpers.ts:635-636 + the `["tundra","forest","canyon"]`
// hardcoded array below at line ~117 to be fully generalized).
export const GAME_BIOME_DEFINITIONS: Record<string, BiomeDefinition> = {
  tundra: {
    id: "tundra",
    name: "Tundra",
    color: 0xe8e4e0,
    terrainMultiplier: 1,
    difficultyLevel: 1,
    heightRange: [0.3, 0.8],
    maxSlope: 1.5,
    resourceDensity: 0.4,
  },
  forest: {
    id: "forest",
    name: "Forest",
    color: 0x388e3c,
    terrainMultiplier: 1,
    difficultyLevel: 0,
    heightRange: [0, 0.5],
    maxSlope: 0.8,
    resourceDensity: 1.0,
  },
  canyon: {
    id: "canyon",
    name: "Canyon",
    color: 0x8d6e63,
    terrainMultiplier: 1,
    difficultyLevel: 2,
    heightRange: [0.2, 1.0],
    maxSlope: 2.0,
    resourceDensity: 0.6,
  },
};

// Shoreline config
const SHORELINE = {
  landBand: SHORELINE_CONFIG.LAND_BAND,
  landMaxMultiplier: SHORELINE_CONFIG.LAND_MAX_MULTIPLIER,
  underwaterBand: SHORELINE_CONFIG.UNDERWATER_BAND,
  underwaterDepthMultiplier: SHORELINE_CONFIG.UNDERWATER_DEPTH_MULTIPLIER,
  minSlope: SHORELINE_CONFIG.MIN_SLOPE,
  slopeSampleDistance: SHORELINE_CONFIG.SLOPE_SAMPLE_DISTANCE,
};

const DEFAULT_BIOME = "forest";

// ============== PUBLIC API ==============

export interface GameTerrainQuery {
  height: number;
  biomeId: string;
  biomeColor: { r: number; g: number; b: number };
  islandMask: number;
  biomeForestWeight: number;
  biomeCanyonWeight: number;
}

/**
 * Creates a terrain querier that produces the EXACT same terrain as the live game.
 * Uses shared computeBaseHeight from @hyperforge/shared/world.
 */
export function createGameTerrainQuerier(seed: number = GAME_SEED) {
  const noise = new NoiseGenerator(seed);

  // Build per-biome noise sets (mirrors TerrainSystem.ensureNoiseInitialized)
  const biomeNoiseSets: Record<string, BiomeNoiseSet> = {};
  for (const [key, cfg] of Object.entries(BIOME_CONFIGS)) {
    const base = seed + cfg.seedOffset;
    biomeNoiseSets[key] = {
      main: new NoiseGenerator(base),
      variation: new NoiseGenerator(base + 4),
      erosion: new NoiseGenerator(base + 1),
    };
  }

  const biomeTypes = ["tundra", "forest", "canyon"];
  const explicitCenters = BiomeSystem.computePolygonCenters(
    biomeTypes,
    BIOME_CONFIG.placementRadius,
    BIOME_CONFIG.influenceRadius,
  );

  const biomeConfig: BiomeConfig = {
    gridSize: 3,
    jitter: 0,
    minInfluence: BIOME_CONFIG.influenceRadius,
    maxInfluence: BIOME_CONFIG.influenceRadius,
    gaussianCoeff: BIOME_CONFIG.gaussianCoeff,
    boundaryNoiseScale: BIOME_CONFIG.boundaryNoiseScale,
    boundaryNoiseAmount: BIOME_CONFIG.boundaryNoiseAmount,
    explicitCenters,
  };

  const worldSizeMeters = GAME_TILE_SIZE * GAME_WORLD_SIZE;
  const biomeSystem = new BiomeSystem(
    seed,
    worldSizeMeters,
    biomeConfig,
    GAME_BIOME_DEFINITIONS,
  );

  const biomeCenters = biomeSystem.getBiomeCenters();

  // Pre-allocated biome weight pool — avoids per-vertex Record<string,number> allocation.
  // Only 3 biome types exist (tundra, forest, canyon), so a fixed object is sufficient.
  const _weightsPool: Record<string, number> = {
    tundra: 0,
    forest: 0,
    canyon: 0,
  };

  function computeBiomeWeights(
    worldX: number,
    worldZ: number,
  ): Record<string, number> {
    const boundaryNoise = noise.simplex2D(
      worldX * BIOME_CONFIG.boundaryNoiseScale,
      worldZ * BIOME_CONFIG.boundaryNoiseScale,
    );

    // Reset pool instead of allocating new object
    _weightsPool.tundra = 0;
    _weightsPool.forest = 0;
    _weightsPool.canyon = 0;
    let totalWeight = 0;

    for (const center of biomeCenters) {
      const dx = worldX - center.x;
      const dz = worldZ - center.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const noisyDist =
        distance * (1 + boundaryNoise * BIOME_CONFIG.boundaryNoiseAmount);
      const normDist = noisyDist / center.influence;
      const w = Math.exp(-normDist * normDist * BIOME_CONFIG.gaussianCoeff);

      _weightsPool[center.type] = (_weightsPool[center.type] || 0) + w;
      totalWeight += w;
    }

    if (totalWeight > 0) {
      for (const key of biomeTypes) _weightsPool[key] /= totalWeight;
    } else {
      _weightsPool[DEFAULT_BIOME] = 1.0;
    }

    return _weightsPool;
  }

  function getDominantBiome(weights: Record<string, number>): string {
    let max = 0;
    let dominant = DEFAULT_BIOME;
    for (const [key, w] of Object.entries(weights)) {
      if (w > max) {
        max = w;
        dominant = key;
      }
    }
    return dominant;
  }

  // Pre-computed biome colors (avoid per-call hex→RGB conversion).
  // R3.P3 — derive from the merged biome map (engine defaults +
  // active plugin contributions) so a plugin's contributed biome
  // (e.g. shooter-demo's "arena", "wasteland", "fortifications")
  // gets a real RGB lookup instead of falling through to the
  // default-biome color.
  const _biomeRGB: Record<string, { r: number; g: number; b: number }> = {};
  const _activeBiomes = getActiveBiomeDefinitions(GAME_BIOME_DEFINITIONS);
  for (const [id, def] of Object.entries(_activeBiomes)) {
    const hex = def.color;
    _biomeRGB[id] = {
      r: ((hex >> 16) & 0xff) / 255,
      g: ((hex >> 8) & 0xff) / 255,
      b: (hex & 0xff) / 255,
    };
  }
  const _defaultBiomeRGB = _biomeRGB[DEFAULT_BIOME]!;

  // Pre-allocated color pool — avoids per-vertex {r,g,b} allocation
  const _colorPool = { r: 0, g: 0, b: 0 };

  function blendBiomeColor(weights: Record<string, number>): {
    r: number;
    g: number;
    b: number;
  } {
    _colorPool.r = 0;
    _colorPool.g = 0;
    _colorPool.b = 0;
    for (const biomeId of biomeTypes) {
      const w = weights[biomeId];
      if (!w) continue;
      const c = _biomeRGB[biomeId] ?? _defaultBiomeRGB;
      _colorPool.r += c.r * w;
      _colorPool.g += c.g * w;
      _colorPool.b += c.b * w;
    }
    return _colorPool;
  }

  /**
   * Compute base height using shared algorithm.
   * Uses the new per-biome independent noise system (same as TerrainSystem).
   */
  function computeHeight(
    worldX: number,
    worldZ: number,
    biomeWeights: Record<string, number>,
  ): number {
    return computeBaseHeight(
      worldX,
      worldZ,
      noise,
      biomeNoiseSets,
      biomeWeights,
    );
  }

  /**
   * Compute island mask for a world position.
   */
  function computeIslandMask(worldX: number, worldZ: number): number {
    const distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
    const angle = Math.atan2(worldZ, worldX);
    const cnx = Math.cos(angle) * COASTLINE_CIRCLE_SAMPLE_RADIUS;
    const cnz = Math.sin(angle) * COASTLINE_CIRCLE_SAMPLE_RADIUS;
    const cst1 = noise.fractal2D(
      cnx,
      cnz,
      COAST_LARGE.octaves,
      COAST_LARGE.persistence,
      COAST_LARGE.lacunarity,
    );
    const cst2 = noise.fractal2D(
      cnx * COAST_MEDIUM.freqMultiplier,
      cnz * COAST_MEDIUM.freqMultiplier,
      COAST_MEDIUM.octaves,
      COAST_MEDIUM.persistence,
      COAST_MEDIUM.lacunarity,
    );
    const cst3 = noise.simplex2D(
      cnx * COAST_SMALL.freqMultiplier,
      cnz * COAST_SMALL.freqMultiplier,
    );
    const coastVar =
      cst1 * COAST_LARGE.weight +
      cst2 * COAST_MEDIUM.weight +
      cst3 * COAST_SMALL.weight;
    const effectiveRadius = ISLAND_RADIUS * (1 + coastVar);
    let mask = 1.0;
    if (distFromCenter > effectiveRadius - ISLAND_FALLOFF) {
      const edgeDist = distFromCenter - (effectiveRadius - ISLAND_FALLOFF);
      const tt = Math.min(1.0, edgeDist / ISLAND_FALLOFF);
      mask = 1.0 - Math.pow(tt, BEACH_PROFILE_POWER);
    }
    if (distFromCenter > effectiveRadius + ISLAND_DEEP_OCEAN_BUFFER) mask = 0;
    return mask;
  }

  // Pre-allocated shoreline config — avoids per-vertex object literal
  const _shorelineConfig = {
    waterThreshold: GAME_WATER_THRESHOLD,
    shorelineLandBand: SHORELINE.landBand,
    shorelineUnderwaterBand: SHORELINE.underwaterBand,
    shorelineMinSlope: SHORELINE.minSlope,
    shorelineLandMaxMultiplier: SHORELINE.landMaxMultiplier,
    underwaterDepthMultiplier: SHORELINE.underwaterDepthMultiplier,
  };

  // Pre-allocated query result — avoids per-vertex {height,biomeId,...} allocation.
  // IMPORTANT: Callers must consume or copy values before the next queryPoint call.
  const _queryResult: GameTerrainQuery = {
    height: 0,
    biomeId: DEFAULT_BIOME,
    biomeColor: _colorPool,
    islandMask: 0,
    biomeForestWeight: 0,
    biomeCanyonWeight: 0,
  };

  const sampleDist = SHORELINE.slopeSampleDistance;
  // Max band distance from waterThreshold where shoreline adjustment applies.
  // Vertices outside this band skip 4 extra computeHeight calls entirely.
  const shorelineBandMax = Math.max(
    SHORELINE.landBand,
    SHORELINE.underwaterBand,
  );

  function queryPoint(worldX: number, worldZ: number): GameTerrainQuery {
    const biomeWeights = computeBiomeWeights(worldX, worldZ);
    const baseHeight = computeHeight(worldX, worldZ, biomeWeights);

    // Fast path: skip slope computation for vertices far from the shoreline
    let finalHeight = baseHeight;
    const delta = Math.abs(baseHeight - GAME_WATER_THRESHOLD);
    if (delta < shorelineBandMax) {
      const hn = computeHeight(worldX, worldZ + sampleDist, biomeWeights);
      const hs = computeHeight(worldX, worldZ - sampleDist, biomeWeights);
      const he = computeHeight(worldX + sampleDist, worldZ, biomeWeights);
      const hw = computeHeight(worldX - sampleDist, worldZ, biomeWeights);
      const slope = Math.max(
        Math.abs(hn - baseHeight) / sampleDist,
        Math.abs(hs - baseHeight) / sampleDist,
        Math.abs(he - baseHeight) / sampleDist,
        Math.abs(hw - baseHeight) / sampleDist,
      );
      finalHeight = adjustShorelineHeight(baseHeight, slope, _shorelineConfig);
    }

    const color = blendBiomeColor(biomeWeights);
    const mask = computeIslandMask(worldX, worldZ);

    // Write into pooled result (no allocation)
    _queryResult.height = finalHeight;
    _queryResult.biomeId = getDominantBiome(biomeWeights);
    _queryResult.biomeColor = color;
    _queryResult.islandMask = mask;
    _queryResult.biomeForestWeight = biomeWeights["forest"] ?? 0;
    _queryResult.biomeCanyonWeight = biomeWeights["canyon"] ?? 0;

    return _queryResult;
  }

  function getHeightAt(worldX: number, worldZ: number): number {
    const biomeWeights = computeBiomeWeights(worldX, worldZ);
    return computeHeight(worldX, worldZ, biomeWeights);
  }

  return {
    queryPoint,
    getHeightAt,
    getBiomeSystem: () => biomeSystem,
    getNoiseGenerator: () => noise,
    config: {
      maxHeight: GAME_MAX_HEIGHT,
      waterThreshold: GAME_WATER_THRESHOLD,
      tileSize: GAME_TILE_SIZE,
      worldSize: GAME_WORLD_SIZE,
      tileResolution: GAME_TILE_RESOLUTION,
      seed,
    },
  };
}
