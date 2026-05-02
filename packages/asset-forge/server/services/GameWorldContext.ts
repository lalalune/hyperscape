/**
 * GameWorldContext — Shared terrain height + biome infrastructure for server-side world generation.
 *
 * Provides the exact same terrain height computation and biome system as the live game.
 * Used by WorldTreeService, WorldLayoutService, and any future world generation services.
 *
 * Created once (expensive ~50ms), cached for reuse.
 */

import { NoiseGenerator, BiomeSystem } from "@hyperforge/procgen/terrain";
import type { BiomeDefinition, BiomeConfig } from "@hyperforge/procgen/terrain";

// ============== GAME CONSTANTS ==============
// Mirrored from TerrainHeightParams.ts / TerrainSystem.ts / GameTerrainAdapter.ts

export const GAME_SEED = 0;
export const GAME_TILE_SIZE = 100;
export const GAME_WORLD_SIZE = 100; // 100x100 tiles
export const GAME_MAX_HEIGHT = 50;
export const GAME_WATER_THRESHOLD = 8.0;

// Island shape
const ISLAND_RADIUS = 788;
const ISLAND_FALLOFF = 450;
const ISLAND_DEEP_OCEAN_BUFFER = 113;
const OCEAN_FLOOR_HEIGHT = 0.05;
const BEACH_PROFILE_POWER = 3.0;

// Coastline noise
const COASTLINE_CIRCLE_SAMPLE_RADIUS = 2;
const COAST_LARGE = {
  octaves: 3,
  persistence: 0.5,
  lacunarity: 2.0,
  weight: 0.2,
};
const COAST_MEDIUM = {
  freqMultiplier: 3,
  octaves: 2,
  persistence: 0.5,
  lacunarity: 2.0,
  weight: 0.08,
};
const COAST_SMALL = { freqMultiplier: 8, weight: 0.02 };

// Noise layers
const CONTINENT_LAYER = {
  scale: 0.0004,
  octaves: 5,
  persistence: 0.7,
  lacunarity: 2.0,
};
const RIDGE_LAYER = { scale: 0.0015 };
const HILL_LAYER = {
  scale: 0.008,
  octaves: 4,
  persistence: 0.6,
  lacunarity: 2.2,
};
const EROSION_LAYER = { scale: 0.0025, iterations: 3 };
const DETAIL_LAYER = {
  scale: 0.02,
  octaves: 2,
  persistence: 0.3,
  lacunarity: 2.5,
};

// Terracing
const TERRACE_STEPS = 10;

// Biome noise profiles
interface BiomeNoiseProfile {
  continentWeight: number;
  ridgeWeight: number;
  hillWeight: number;
  erosionWeight: number;
  detailWeight: number;
  powerCurve: number;
  terraceStrength: number;
  terraceSharpness: number;
  terraceHeightScale: number;
  terraceSlope: number;
}

const BIOME_PROFILES: Record<string, BiomeNoiseProfile> = {
  tundra: {
    continentWeight: 0.32,
    ridgeWeight: 0.15,
    hillWeight: 0.28,
    erosionWeight: 0.1,
    detailWeight: 0.1,
    powerCurve: 1.1,
    terraceStrength: 0.4,
    terraceSharpness: 0.7,
    terraceHeightScale: 2.5,
    terraceSlope: 0.25,
  },
  forest: {
    continentWeight: 0.15,
    ridgeWeight: 0.08,
    hillWeight: 0.1,
    erosionWeight: 0.05,
    detailWeight: 0.05,
    powerCurve: 1,
    terraceStrength: 0,
    terraceSharpness: 0,
    terraceHeightScale: 1,
    terraceSlope: 0,
  },
  canyon: {
    continentWeight: 0.32,
    ridgeWeight: 0.25,
    hillWeight: 0.18,
    erosionWeight: 0.2,
    detailWeight: 0.05,
    powerCurve: 1.45,
    terraceStrength: 0.6,
    terraceSharpness: 0.8,
    terraceHeightScale: 7,
    terraceSlope: 0.35,
  },
};

// Landscape features
interface LandscapeFeatureDef {
  type: "mountain" | "pond";
  x: number;
  z: number;
  radius: number;
  strength: number;
  layers: number;
  shapePower: number;
  edgeSharpness: number;
  layerSlope: number;
  noiseScale: number;
  noiseAmount: number;
}

const LANDSCAPE_FEATURES: LandscapeFeatureDef[] = [
  {
    type: "mountain",
    x: -168.5,
    z: -352.5,
    radius: 250,
    strength: 5.5,
    layers: 5,
    shapePower: 2.0,
    edgeSharpness: 0.2,
    layerSlope: 0.9,
    noiseScale: 0.025,
    noiseAmount: 0.6,
  },
  {
    type: "mountain",
    x: 265.5,
    z: 322.5,
    radius: 130,
    strength: 2.5,
    layers: 5,
    shapePower: 1.3,
    edgeSharpness: 0.3,
    layerSlope: 0.55,
    noiseScale: 0.025,
    noiseAmount: 0.55,
  },
  {
    type: "pond",
    x: -28.5,
    z: 327.5,
    radius: 90,
    strength: 1.5,
    layers: 1,
    shapePower: 3.5,
    edgeSharpness: 0.1,
    layerSlope: 0.8,
    noiseScale: 0.015,
    noiseAmount: 0.06,
  },
  {
    type: "pond",
    x: -120,
    z: -290,
    radius: 35,
    strength: 1.8,
    layers: 1,
    shapePower: 3.0,
    edgeSharpness: 0.1,
    layerSlope: 0.8,
    noiseScale: 0.015,
    noiseAmount: 0.06,
  },
];

// Biome config
const BIOME_CONFIG = {
  gaussianCoeff: 12.0,
  boundaryNoiseScale: 0.003,
  boundaryNoiseAmount: 0.15,
  placementRadius: ISLAND_RADIUS * 0.45,
  influenceRadius: ISLAND_RADIUS * 0.6,
};

/**
 * Hyperia-specific biome data — the server-side mirror of
 * `HYPERIA_LIVE_GAME_BIOMES` in
 * `src/components/WorldBuilder/GameTerrainAdapter.ts`. Used by
 * `getGameWorldContext` (the live Hyperia world reproducer for
 * server-side tile / tree / layout queries).
 *
 * Phase D of `PLAN_AAA_CONTENT_SYSTEM.md` migrates this data
 * (along with the rest of `getGameWorldContext`) into the
 * Hyperscape plugin / content pack. Until then the constant
 * stays here as a private module-local fallback.
 *
 * This entire module's exports are Hyperia-specific by design —
 * called from `WorldLayoutService` / `WorldTreeService` for
 * Hyperia-template projects. Non-Hyperia projects don't reach
 * this code path.
 */
const HYPERIA_LIVE_GAME_BIOMES: Record<string, BiomeDefinition> = {
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

// ============== NOISE ADAPTER ==============

interface NoiseAdapter {
  fractal2D(
    x: number,
    z: number,
    octaves: number,
    persistence: number,
    lacunarity: number,
  ): number;
  ridgeNoise2D(x: number, z: number): number;
  erosionNoise2D(x: number, z: number, iterations: number): number;
  simplex2D(x: number, z: number): number;
}

// ============== TERRAIN HEIGHT COMPUTATION ==============

function applyLandscapeFeatures(
  height: number,
  worldX: number,
  worldZ: number,
  features: ReadonlyArray<LandscapeFeatureDef>,
  noise: NoiseAdapter,
): number {
  const waterLevelNorm = GAME_WATER_THRESHOLD / GAME_MAX_HEIGHT;
  for (const feat of features) {
    const dx = worldX - feat.x;
    const dz = worldZ - feat.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (feat.type === "pond" && dist >= feat.radius && dist < feat.radius + 5) {
      const bermT = 1 - (dist - feat.radius) / 5;
      const minH = waterLevelNorm + 0.005;
      if (height < minH) height += (minH - height) * bermT;
      continue;
    }
    if (dist >= feat.radius) continue;

    const t = Math.max(0, 1 - dist / feat.radius);
    const envelope = Math.pow(t, feat.shapePower);

    const warpScale = feat.noiseScale * 0.4;
    const warpStr = feat.radius * feat.noiseAmount * 0.3;
    const warpX =
      noise.simplex2D(worldX * warpScale, worldZ * warpScale) * warpStr;
    const warpZ =
      noise.simplex2D(worldX * warpScale + 31.7, worldZ * warpScale + 47.3) *
      warpStr;

    const sx = (worldX + warpX) * feat.noiseScale;
    const sz = (worldZ + warpZ) * feat.noiseScale;
    const ridgeN = noise.ridgeNoise2D(sx, sz);
    const detailN = noise.fractal2D(sx * 2.3, sz * 2.3, 3, 0.5, 2.0);
    const mNoise = (ridgeN * 0.6 + detailN * 0.4 + 1) * 0.5;

    let rawH = envelope * (1 - feat.noiseAmount + feat.noiseAmount * mNoise);
    rawH = Math.max(0, Math.min(1, rawH));

    let influence: number;
    if (feat.layers >= 1) {
      const stepped = Math.floor(rawH * feat.layers) / feat.layers;
      const nextStep = Math.min(1, stepped + 1 / feat.layers);
      const frac = (rawH - stepped) * feat.layers;
      const blendStart = 1 - feat.edgeSharpness;
      const edgeBlend =
        frac <= blendStart ? 0 : (frac - blendStart) / (1 - blendStart);
      const flatStep = stepped + edgeBlend * (nextStep - stepped);
      const slopedStep = stepped + frac * (nextStep - stepped);
      influence = flatStep + feat.layerSlope * (slopedStep - flatStep);
    } else {
      influence = rawH;
    }

    if (feat.type === "pond") height -= influence * feat.strength;
    else height += influence * feat.strength;
  }
  return height;
}

function computeBaseHeight(
  worldX: number,
  worldZ: number,
  noise: NoiseAdapter,
  biomeWeights: Record<string, number>,
): number {
  const cN = noise.fractal2D(
    worldX * CONTINENT_LAYER.scale,
    worldZ * CONTINENT_LAYER.scale,
    CONTINENT_LAYER.octaves,
    CONTINENT_LAYER.persistence,
    CONTINENT_LAYER.lacunarity,
  );
  const rN = noise.ridgeNoise2D(
    worldX * RIDGE_LAYER.scale,
    worldZ * RIDGE_LAYER.scale,
  );
  const hN = noise.fractal2D(
    worldX * HILL_LAYER.scale,
    worldZ * HILL_LAYER.scale,
    HILL_LAYER.octaves,
    HILL_LAYER.persistence,
    HILL_LAYER.lacunarity,
  );
  const eN = noise.erosionNoise2D(
    worldX * EROSION_LAYER.scale,
    worldZ * EROSION_LAYER.scale,
    EROSION_LAYER.iterations,
  );
  const dN = noise.fractal2D(
    worldX * DETAIL_LAYER.scale,
    worldZ * DETAIL_LAYER.scale,
    DETAIL_LAYER.octaves,
    DETAIL_LAYER.persistence,
    DETAIL_LAYER.lacunarity,
  );

  let cW = 0,
    rW = 0,
    hW = 0,
    eW = 0,
    dW = 0,
    pC = 0,
    tS = 0,
    tSh = 0,
    tHS = 0,
    tSl = 0;
  const defaultP = BIOME_PROFILES.forest;
  for (const key of Object.keys(biomeWeights)) {
    const w = biomeWeights[key];
    const p = BIOME_PROFILES[key] ?? defaultP;
    cW += p.continentWeight * w;
    rW += p.ridgeWeight * w;
    hW += p.hillWeight * w;
    eW += p.erosionWeight * w;
    dW += p.detailWeight * w;
    pC += p.powerCurve * w;
    tS += p.terraceStrength * w;
    tSh += p.terraceSharpness * w;
    tHS += p.terraceHeightScale * w;
    tSl += p.terraceSlope * w;
  }

  let height = cN * cW + rN * rW + hN * hW + eN * eW + dN * dW;
  height = (height + 1) * 0.5;
  height = Math.max(0, Math.min(1, height));
  height = Math.pow(height, pC);

  const steps = TERRACE_STEPS;
  const ths = Math.max(1, tHS);
  if (tS > 0.01 && steps >= 2) {
    const stepped = Math.floor(height * steps) / steps;
    const nextStep = Math.min(1, stepped + 1 / steps);
    const frac = (height - stepped) * steps;
    const edgeBlend = frac < tSh ? 0 : (frac - tSh) / (1 - tSh + 0.001);
    const flatStep = stepped + edgeBlend * (nextStep - stepped);
    const slopedStep = stepped + frac * (nextStep - stepped);
    const terraced = flatStep + tSl * (slopedStep - flatStep);
    const scaled = Math.max(0, Math.min(1, 0.5 + (terraced - 0.5) * ths));
    height = height + (scaled - height) * tS;
  }

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

  let islandMask = 1.0;
  if (distFromCenter > effectiveRadius - ISLAND_FALLOFF) {
    const edgeDist = distFromCenter - (effectiveRadius - ISLAND_FALLOFF);
    const tt = Math.min(1.0, edgeDist / ISLAND_FALLOFF);
    islandMask = 1.0 - Math.pow(tt, BEACH_PROFILE_POWER);
  }
  if (distFromCenter > effectiveRadius + ISLAND_DEEP_OCEAN_BUFFER)
    islandMask = 0;

  height = height * islandMask;
  height = applyLandscapeFeatures(
    height,
    worldX,
    worldZ,
    LANDSCAPE_FEATURES,
    noise,
  );
  if (islandMask === 0) height = OCEAN_FLOOR_HEIGHT;

  return height * GAME_MAX_HEIGHT;
}

// ============== RNG ==============

export function createTileRng(
  baseSeed: number,
  tileX: number,
  tileZ: number,
  salt: string,
): () => number {
  const seed = baseSeed >>> 0;
  let saltHash = 5381 >>> 0;
  for (let i = 0; i < salt.length; i++) {
    saltHash = (((saltHash << 5) + saltHash) ^ salt.charCodeAt(i)) >>> 0;
  }
  let state =
    (seed ^
      ((tileX * 73856093) >>> 0) ^
      ((tileZ * 19349663) >>> 0) ^
      saltHash) >>>
    0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

// ============== CONTEXT ==============

export interface GameWorldContext {
  noise: NoiseGenerator;
  biomeSystem: BiomeSystem;
  biomeCenters: ReadonlyArray<{
    x: number;
    z: number;
    type: string;
    influence: number;
  }>;
  noiseAdapter: NoiseAdapter;
  getHeightAt: (worldX: number, worldZ: number) => number;
  getDominantBiome: (worldX: number, worldZ: number) => string;
  computeBiomeWeights: (
    worldX: number,
    worldZ: number,
  ) => Record<string, number>;
}

const cachedContexts = new Map<number, GameWorldContext>();

/**
 * Get (or create) a GameWorldContext for the given seed.
 * Defaults to GAME_SEED (0) for the live game world.
 * The editor may pass a different seed for custom worlds — each seed
 * produces a unique biome map and terrain, so tree generation must match.
 */
export function getGameWorldContext(
  seed: number = GAME_SEED,
): GameWorldContext {
  const existing = cachedContexts.get(seed);
  if (existing) return existing;

  const noise = new NoiseGenerator(seed);
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
    HYPERIA_LIVE_GAME_BIOMES,
  );
  const biomeCenters = biomeSystem.getBiomeCenters();

  const noiseAdapter: NoiseAdapter = {
    fractal2D: (x, z, octaves, persistence, lacunarity) =>
      noise.fractal2D(x, z, octaves, persistence, lacunarity),
    ridgeNoise2D: (x, z) => noise.ridgeNoise2D(x, z),
    erosionNoise2D: (x, z, iterations) =>
      noise.erosionNoise2D(x, z, iterations),
    simplex2D: (x, z) => noise.simplex2D(x, z),
  };

  function computeBiomeWeights(
    worldX: number,
    worldZ: number,
  ): Record<string, number> {
    const boundaryNoise = noise.simplex2D(
      worldX * BIOME_CONFIG.boundaryNoiseScale,
      worldZ * BIOME_CONFIG.boundaryNoiseScale,
    );
    const weights: Record<string, number> = {};
    let totalWeight = 0;
    for (const center of biomeCenters) {
      const dx = worldX - center.x;
      const dz = worldZ - center.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const noisyDist =
        distance * (1 + boundaryNoise * BIOME_CONFIG.boundaryNoiseAmount);
      const normDist = noisyDist / center.influence;
      const w = Math.exp(-normDist * normDist * BIOME_CONFIG.gaussianCoeff);
      weights[center.type] = (weights[center.type] || 0) + w;
      totalWeight += w;
    }
    if (totalWeight > 0) {
      for (const key of Object.keys(weights)) weights[key] /= totalWeight;
    } else {
      weights.forest = 1.0;
    }
    return weights;
  }

  function getDominantBiome(worldX: number, worldZ: number): string {
    const weights = computeBiomeWeights(worldX, worldZ);
    let max = 0,
      dominant = "forest";
    for (const [key, w] of Object.entries(weights)) {
      if (w > max) {
        max = w;
        dominant = key;
      }
    }
    return dominant;
  }

  function getHeightAt(worldX: number, worldZ: number): number {
    const biomeWeights = computeBiomeWeights(worldX, worldZ);
    return computeBaseHeight(worldX, worldZ, noiseAdapter, biomeWeights);
  }

  const context: GameWorldContext = {
    noise,
    biomeSystem,
    biomeCenters,
    noiseAdapter,
    getHeightAt,
    getDominantBiome,
    computeBiomeWeights,
  };

  cachedContexts.set(seed, context);
  return context;
}
