/**
 * Terrain Generator
 *
 * Main class for procedural terrain generation. Combines noise generation,
 * biome systems, and island masking to create complete terrain heightmaps.
 *
 * This is a pure generation library with no rendering dependencies.
 * It produces data that can be used by Three.js, WebGL, or any other renderer.
 */

import { NoiseGenerator, createTileRNG } from "./NoiseGenerator";
import { BiomeSystem } from "./BiomeSystem";
import { IslandMask, DEFAULT_ISLAND_CONFIG } from "./IslandMask";
import { DEFAULT_MAX_HEIGHT, DEFAULT_WATER_THRESHOLD } from "./constants";
import type {
  TerrainConfig,
  TerrainNoiseConfig,
  HeightmapData,
  TerrainColorData,
  TerrainTileData,
  TerrainPointQuery,
  BiomeDefinition,
  ShorelineConfig,
  RGBColor,
} from "./types";

// ============== DEFAULT CONFIGURATIONS ==============

/**
 * Default noise configuration for tile-based-MMORPG-style gentle rolling terrain
 */
export const DEFAULT_NOISE_CONFIG: TerrainNoiseConfig = {
  continent: {
    scale: 0.0008,
    weight: 0.4,
    octaves: 5,
    persistence: 0.7,
    lacunarity: 2.0,
  },
  ridge: { scale: 0.003, weight: 0.1 },
  hill: {
    scale: 0.012,
    weight: 0.12,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.2,
  },
  erosion: { scale: 0.005, weight: 0.08, octaves: 3 },
  detail: {
    scale: 0.04,
    weight: 0.03,
    octaves: 2,
    persistence: 0.3,
    lacunarity: 2.5,
  },
};

/**
 * Default shoreline configuration
 */
export const DEFAULT_SHORELINE_CONFIG: ShorelineConfig = {
  waterLevelNormalized: 0.32, // 16/50 = waterThreshold/maxHeight
  threshold: 0.25,
  colorStrength: 0.6,
  minSlope: 0.06,
  slopeSampleDistance: 1.0,
  landBand: 3.0,
  landMaxMultiplier: 1.6,
  underwaterBand: 3.0,
  underwaterDepthMultiplier: 1.8,
};

/**
 * Default terrain configuration
 */
export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  tileSize: 100,
  worldSize: 100,
  tileResolution: 64,
  maxHeight: DEFAULT_MAX_HEIGHT,
  waterThreshold: DEFAULT_WATER_THRESHOLD,
  seed: 0,
  noise: DEFAULT_NOISE_CONFIG,
  biomes: {
    gridSize: 3,
    jitter: 0.35,
    minInfluence: 2000,
    maxInfluence: 3500,
    gaussianCoeff: 0.15,
    boundaryNoiseScale: 0.003,
    boundaryNoiseAmount: 0.15,
  },
  island: DEFAULT_ISLAND_CONFIG,
  shoreline: DEFAULT_SHORELINE_CONFIG,
};

/** Sandy brown color for shorelines (0x8b7355) */
export const SHORELINE_COLOR: RGBColor = { r: 0.545, g: 0.451, b: 0.333 };

// ============== TERRAIN GENERATOR CLASS ==============

/**
 * TerrainGenerator produces terrain heightmaps, colors, and metadata
 */
export class TerrainGenerator {
  private readonly config: TerrainConfig;
  private readonly noise: NoiseGenerator;
  private readonly biomeSystem: BiomeSystem;
  private readonly islandMask: IslandMask;

  constructor(
    config: Partial<TerrainConfig> = {},
    biomeDefinitions: Record<string, BiomeDefinition> = {},
  ) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_TERRAIN_CONFIG,
      ...config,
      noise: { ...DEFAULT_NOISE_CONFIG, ...config.noise },
      biomes: { ...DEFAULT_TERRAIN_CONFIG.biomes, ...config.biomes },
      island: { ...DEFAULT_TERRAIN_CONFIG.island, ...config.island },
      shoreline: { ...DEFAULT_TERRAIN_CONFIG.shoreline, ...config.shoreline },
    };

    // Initialize sub-systems
    this.noise = new NoiseGenerator(this.config.seed);

    const worldSizeMeters = this.config.tileSize * this.config.worldSize;
    this.biomeSystem = new BiomeSystem(
      this.config.seed,
      worldSizeMeters,
      this.config.biomes,
      biomeDefinitions,
    );

    this.islandMask = new IslandMask(
      this.config.seed,
      this.config.tileSize,
      this.config.island,
    );
  }

  // ============== CONFIGURATION ACCESSORS ==============

  /**
   * Get the full terrain configuration
   */
  getConfig(): TerrainConfig {
    return { ...this.config };
  }

  /**
   * Get the biome system for external queries
   */
  getBiomeSystem(): BiomeSystem {
    return this.biomeSystem;
  }

  /**
   * Get the island mask system
   */
  getIslandMask(): IslandMask {
    return this.islandMask;
  }

  /**
   * Get the active world size in meters (accounts for island mask)
   */
  getActiveWorldSizeMeters(): number {
    if (this.config.island.enabled) {
      return this.islandMask.getActiveWorldSizeMeters();
    }
    return this.config.tileSize * this.config.worldSize;
  }

  // ============== HEIGHT GENERATION ==============

  /**
   * Get base terrain height WITHOUT biome boost (for biome influence calculation)
   * @returns Height in meters
   */
  getBaseHeightAt(worldX: number, worldZ: number): number {
    const { noise: noiseConfig, maxHeight, island } = this.config;

    // Multi-layered noise for realistic terrain
    const continentNoise = this.noise.fractal2D(
      worldX * noiseConfig.continent.scale,
      worldZ * noiseConfig.continent.scale,
      noiseConfig.continent.octaves ?? 5,
      noiseConfig.continent.persistence ?? 0.7,
      noiseConfig.continent.lacunarity ?? 2.0,
    );

    const ridgeNoise = this.noise.ridgeNoise2D(
      worldX * noiseConfig.ridge.scale,
      worldZ * noiseConfig.ridge.scale,
    );

    const hillNoise = this.noise.fractal2D(
      worldX * noiseConfig.hill.scale,
      worldZ * noiseConfig.hill.scale,
      noiseConfig.hill.octaves ?? 4,
      noiseConfig.hill.persistence ?? 0.5,
      noiseConfig.hill.lacunarity ?? 2.2,
    );

    const erosionNoise = this.noise.erosionNoise2D(
      worldX * noiseConfig.erosion.scale,
      worldZ * noiseConfig.erosion.scale,
      noiseConfig.erosion.octaves ?? 3,
    );

    const detailNoise = this.noise.fractal2D(
      worldX * noiseConfig.detail.scale,
      worldZ * noiseConfig.detail.scale,
      noiseConfig.detail.octaves ?? 2,
      noiseConfig.detail.persistence ?? 0.3,
      noiseConfig.detail.lacunarity ?? 2.5,
    );

    // Combine layers with configured weights
    let height = 0;
    height += continentNoise * noiseConfig.continent.weight;
    height += ridgeNoise * noiseConfig.ridge.weight;
    height += hillNoise * noiseConfig.hill.weight;
    height += erosionNoise * noiseConfig.erosion.weight;
    height += detailNoise * noiseConfig.detail.weight;

    // Normalize to [0, 1] range
    height = (height + 1) * 0.5;
    height = Math.max(0, Math.min(1, height));

    // Apply gentle power curve for tile-based-MMORPG-style terrain
    height = Math.pow(height, 1.1);

    // Apply island shaping if enabled
    if (island.enabled) {
      height = this.islandMask.applyNaturalCoastlineShaping(
        worldX,
        worldZ,
        height,
        350, // Island radius
        100, // Coastline falloff
        0.42, // Base elevation
      );
    }

    return height * maxHeight;
  }

  /**
   * Calculate terrain slope at a position
   */
  private calculateSlopeAt(
    worldX: number,
    worldZ: number,
    centerHeight: number,
  ): number {
    const { slopeSampleDistance } = this.config.shoreline;

    const northHeight = this.getBaseHeightAt(
      worldX,
      worldZ + slopeSampleDistance,
    );
    const southHeight = this.getBaseHeightAt(
      worldX,
      worldZ - slopeSampleDistance,
    );
    const eastHeight = this.getBaseHeightAt(
      worldX + slopeSampleDistance,
      worldZ,
    );
    const westHeight = this.getBaseHeightAt(
      worldX - slopeSampleDistance,
      worldZ,
    );

    const slopes = [
      Math.abs(northHeight - centerHeight) / slopeSampleDistance,
      Math.abs(southHeight - centerHeight) / slopeSampleDistance,
      Math.abs(eastHeight - centerHeight) / slopeSampleDistance,
      Math.abs(westHeight - centerHeight) / slopeSampleDistance,
    ];

    return Math.max(...slopes);
  }

  /**
   * Adjust height for shoreline steepening
   */
  private adjustHeightForShoreline(baseHeight: number, slope: number): number {
    const { waterThreshold } = this.config;
    const {
      landBand,
      landMaxMultiplier,
      underwaterBand,
      underwaterDepthMultiplier,
      minSlope,
    } = this.config.shoreline;

    if (baseHeight === waterThreshold) return baseHeight;

    const isLand = baseHeight > waterThreshold;
    const band = isLand ? landBand : underwaterBand;
    if (band <= 0) return baseHeight;

    const delta = Math.abs(baseHeight - waterThreshold);
    if (delta >= band) return baseHeight;

    if (minSlope <= 0) return baseHeight;

    const maxMultiplier = isLand
      ? landMaxMultiplier
      : underwaterDepthMultiplier;
    if (maxMultiplier <= 1) return baseHeight;

    const slopeSafe = Math.max(0.0001, slope);
    const targetMultiplier = Math.min(
      maxMultiplier,
      Math.max(1, minSlope / slopeSafe),
    );
    const falloff = 1 - delta / band;
    const multiplier = 1 + (targetMultiplier - 1) * falloff;
    const adjustedDelta = delta * multiplier;

    return isLand
      ? waterThreshold + adjustedDelta
      : waterThreshold - adjustedDelta;
  }

  /**
   * Get final terrain height with all adjustments
   * @returns Height in meters
   */
  getHeightAt(worldX: number, worldZ: number): number {
    const { waterThreshold } = this.config;
    const { landBand, underwaterBand } = this.config.shoreline;

    const baseHeight = this.getBaseHeightAt(worldX, worldZ);

    // Skip shoreline adjustment if far from water
    if (
      baseHeight >= waterThreshold + landBand ||
      baseHeight <= waterThreshold - underwaterBand
    ) {
      return baseHeight;
    }

    const slope = this.calculateSlopeAt(worldX, worldZ, baseHeight);
    return this.adjustHeightForShoreline(baseHeight, slope);
  }

  /**
   * Compute the terrain surface normal at a world position
   * Uses central differences on the scalar height field
   */
  getNormalAt(
    worldX: number,
    worldZ: number,
  ): { x: number; y: number; z: number } {
    const sampleDistance = 0.5;

    const hL = this.getHeightAt(worldX - sampleDistance, worldZ);
    const hR = this.getHeightAt(worldX + sampleDistance, worldZ);
    const hD = this.getHeightAt(worldX, worldZ - sampleDistance);
    const hU = this.getHeightAt(worldX, worldZ + sampleDistance);

    const dhdx = (hR - hL) / (2 * sampleDistance);
    const dhdz = (hU - hD) / (2 * sampleDistance);

    // Normalize the normal vector
    const length = Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
    return {
      x: -dhdx / length,
      y: 1 / length,
      z: -dhdz / length,
    };
  }

  // ============== TILE GENERATION ==============

  /**
   * Generate heightmap data for a terrain tile
   */
  generateHeightmap(tileX: number, tileZ: number): HeightmapData {
    const { tileSize, tileResolution, maxHeight } = this.config;
    const vertexCount = tileResolution * tileResolution;

    const heights = new Float32Array(vertexCount);
    const biomeIds = new Float32Array(vertexCount);

    // Track biome weights for dominant biome calculation
    const biomeWeights = new Map<string, number>();

    // Vertex spacing
    const step = tileSize / (tileResolution - 1);

    for (let iz = 0; iz < tileResolution; iz++) {
      for (let ix = 0; ix < tileResolution; ix++) {
        const index = iz * tileResolution + ix;

        // Calculate world position
        let worldX = tileX * tileSize + ix * step - tileSize / 2;
        let worldZ = tileZ * tileSize + iz * step - tileSize / 2;

        // Snap edge vertices to exact tile boundaries to prevent seams
        const epsilon = 0.001;
        const tileMinX = tileX * tileSize;
        const tileMaxX = (tileX + 1) * tileSize;
        const tileMinZ = tileZ * tileSize;
        const tileMaxZ = (tileZ + 1) * tileSize;

        if (Math.abs(worldX - tileMinX) < epsilon) worldX = tileMinX;
        if (Math.abs(worldX - tileMaxX) < epsilon) worldX = tileMaxX;
        if (Math.abs(worldZ - tileMinZ) < epsilon) worldZ = tileMinZ;
        if (Math.abs(worldZ - tileMaxZ) < epsilon) worldZ = tileMaxZ;

        // Generate height
        const height = this.getHeightAt(worldX, worldZ);
        heights[index] = height;

        // Get biome info
        const normalizedHeight = height / maxHeight;
        const influences = this.biomeSystem.getBiomeInfluencesAtPosition(
          worldX,
          worldZ,
          normalizedHeight,
        );
        if (influences.length === 0) {
          throw new Error(
            `[TerrainGenerator] No biome influences at position (${worldX}, ${worldZ})`,
          );
        }
        const dominantBiome = influences[0].type;
        biomeIds[index] = this.biomeSystem.getBiomeId(dominantBiome);

        // Track biome weights for tile dominant biome
        const currentWeight = biomeWeights.get(dominantBiome) ?? 0;
        biomeWeights.set(dominantBiome, currentWeight + 1);
      }
    }

    // Determine dominant biome for the tile
    let tileDominantBiome = "unknown";
    let maxWeight = 0;
    for (const [biome, weight] of biomeWeights) {
      if (weight > maxWeight) {
        maxWeight = weight;
        tileDominantBiome = biome;
      }
    }

    return {
      tileX,
      tileZ,
      heights,
      biomeIds,
      dominantBiome: tileDominantBiome,
      resolution: tileResolution,
    };
  }

  /**
   * Generate vertex colors for a terrain tile
   */
  generateColors(heightmap: HeightmapData): TerrainColorData {
    const { tileSize, tileResolution, maxHeight } = this.config;
    const {
      waterLevelNormalized,
      threshold: shorelineThreshold,
      colorStrength,
    } = this.config.shoreline;

    const vertexCount = tileResolution * tileResolution;
    const colors = new Float32Array(vertexCount * 3);
    const roadInfluences = new Float32Array(vertexCount);

    const step = tileSize / (tileResolution - 1);

    for (let iz = 0; iz < tileResolution; iz++) {
      for (let ix = 0; ix < tileResolution; ix++) {
        const index = iz * tileResolution + ix;

        // Calculate world position
        const worldX = heightmap.tileX * tileSize + ix * step - tileSize / 2;
        const worldZ = heightmap.tileZ * tileSize + iz * step - tileSize / 2;

        const height = heightmap.heights[index];
        const normalizedHeight = height / maxHeight;

        // Get biome influences for smooth color blending
        const influences = this.biomeSystem.getBiomeInfluencesAtPosition(
          worldX,
          worldZ,
          normalizedHeight,
        );

        // Blend biome colors
        const color = this.biomeSystem.blendBiomeColors(influences);

        // Apply shoreline tinting
        if (
          normalizedHeight > waterLevelNormalized &&
          normalizedHeight < shorelineThreshold
        ) {
          const shoreFactor =
            (1.0 -
              (normalizedHeight - waterLevelNormalized) /
                (shorelineThreshold - waterLevelNormalized)) *
            colorStrength;

          color.r = color.r + (SHORELINE_COLOR.r - color.r) * shoreFactor;
          color.g = color.g + (SHORELINE_COLOR.g - color.g) * shoreFactor;
          color.b = color.b + (SHORELINE_COLOR.b - color.b) * shoreFactor;
        }

        // Store color (road influences are 0 by default, applied separately)
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
        roadInfluences[index] = 0;
      }
    }

    return { colors, roadInfluences };
  }

  /**
   * Generate complete terrain tile data
   */
  generateTile(tileX: number, tileZ: number): TerrainTileData {
    const heightmap = this.generateHeightmap(tileX, tileZ);
    const colors = this.generateColors(heightmap);

    return {
      heightmap,
      colors,
    };
  }

  // ============== POINT QUERIES ==============

  /**
   * Query all terrain information at a world position
   */
  queryPoint(worldX: number, worldZ: number): TerrainPointQuery {
    const { maxHeight } = this.config;

    const height = this.getHeightAt(worldX, worldZ);
    const normalizedHeight = height / maxHeight;

    const biomeInfluences = this.biomeSystem.getBiomeInfluencesAtPosition(
      worldX,
      worldZ,
      normalizedHeight,
    );

    if (biomeInfluences.length === 0) {
      throw new Error(
        `[TerrainGenerator] No biome influences at position (${worldX}, ${worldZ})`,
      );
    }
    const dominantBiome = biomeInfluences[0].type;
    const islandMaskValue = this.islandMask.getIslandMaskAt(worldX, worldZ);
    const normal = this.getNormalAt(worldX, worldZ);
    // Phase 0.3 — populate `query.color` so the procgen path
    // matches the game pipeline (GameTerrainAdapter also returns
    // a pre-blended color on its query result). Downstream
    // consumers in `terrainHelpers.generateTileGeometry` can now
    // read `query.color` uniformly without a fallback to the
    // registry-cached `lookupBiomeColor`. Both `biomeInfluences`
    // and `color` are borrowed pooled references — must be
    // consumed synchronously per vertex.
    const color = this.biomeSystem.blendBiomeColors(biomeInfluences);

    return {
      height,
      biome: dominantBiome,
      biomeInfluences,
      color,
      islandMask: islandMaskValue,
      normal,
    };
  }

  /**
   * Check if a position is underwater
   */
  isUnderwater(worldX: number, worldZ: number): boolean {
    const height = this.getHeightAt(worldX, worldZ);
    return height < this.config.waterThreshold;
  }

  /**
   * Get the dominant biome at a tile (for quick lookups)
   */
  getBiomeAtTile(tileX: number, tileZ: number): string {
    return this.biomeSystem.getBiomeForTile(tileX, tileZ, this.config.tileSize);
  }

  // ============== UTILITY METHODS ==============

  /**
   * Create a deterministic RNG for a tile
   */
  createTileRNG(tileX: number, tileZ: number, salt: string): () => number {
    return createTileRNG(this.config.seed, tileX, tileZ, salt);
  }

  /**
   * Get water threshold height
   */
  getWaterThreshold(): number {
    return this.config.waterThreshold;
  }

  /**
   * Get max terrain height
   */
  getMaxHeight(): number {
    return this.config.maxHeight;
  }

  /**
   * Get tile size in meters
   */
  getTileSize(): number {
    return this.config.tileSize;
  }

  /**
   * Get tile resolution (vertices per side)
   */
  getTileResolution(): number {
    return this.config.tileResolution;
  }
}
