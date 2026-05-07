/**
 * Terrain Generation Types
 *
 * Type definitions for the terrain generation system.
 * These are pure data types with no Three.js dependencies.
 */

// ============== NOISE CONFIGURATION ==============

/**
 * Configuration for a single noise layer
 */
export interface NoiseLayerConfig {
  /** Scale multiplier for the noise frequency */
  scale: number;
  /** Weight/amplitude of this layer in the final height */
  weight: number;
  /** Number of octaves for fractal noise (default: 4) */
  octaves?: number;
  /** Persistence for fractal noise (default: 0.5) */
  persistence?: number;
  /** Lacunarity for fractal noise (default: 2.0) */
  lacunarity?: number;
}

/**
 * Complete noise configuration for terrain generation
 */
export interface TerrainNoiseConfig {
  /** Large landmass shapes */
  continent: NoiseLayerConfig;
  /** Mountain ridges using ridge noise */
  ridge: NoiseLayerConfig;
  /** Rolling hills */
  hill: NoiseLayerConfig;
  /** Erosion valleys */
  erosion: NoiseLayerConfig;
  /** Fine detail variation */
  detail: NoiseLayerConfig;
}

// ============== BIOME CONFIGURATION ==============

/**
 * RGB color representation (0-1 range)
 */
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Biome definition for terrain coloring and generation
 */
export interface BiomeDefinition {
  /** Unique biome identifier */
  id: string;
  /** Display name */
  name: string;
  /** Base terrain color (hex number) */
  color: number;
  /** Terrain height multiplier (1.0 = normal) */
  terrainMultiplier: number;
  /** Difficulty level for gameplay (0-4) */
  difficultyLevel: number;
  /** Height range where this biome naturally occurs [min, max] normalized 0-1 */
  heightRange?: [number, number];
  /** Maximum terrain slope for this biome */
  maxSlope?: number;
  /** Resource density multiplier */
  resourceDensity?: number;
}

/**
 * A biome center point in the world
 */
export interface BiomeCenter {
  /** World X coordinate */
  x: number;
  /** World Z coordinate */
  z: number;
  /** Biome type identifier */
  type: string;
  /** Influence radius in meters */
  influence: number;
}

/**
 * Biome influence at a position
 */
export interface BiomeInfluence {
  /** Biome type */
  type: string;
  /** Normalized weight (0-1, all influences sum to 1) */
  weight: number;
}

/**
 * Configuration for biome generation
 */
export interface BiomeConfig {
  /** Grid size for biome center placement (e.g., 3 = 3x3 grid). Ignored when explicitCenters is set. */
  gridSize: number;
  /** Jitter amount for randomizing positions within grid cells (0-0.5). Ignored when explicitCenters is set. */
  jitter: number;
  /** Minimum influence radius in meters. Ignored when explicitCenters is set. */
  minInfluence: number;
  /** Maximum influence radius in meters. Ignored when explicitCenters is set. */
  maxInfluence: number;
  /** Gaussian falloff coefficient for influence calculation */
  gaussianCoeff: number;
  /** Noise scale for organic boundary variation */
  boundaryNoiseScale: number;
  /** Noise amount for boundary variation */
  boundaryNoiseAmount: number;
  /** Pre-computed biome centers. When provided, grid-jitter placement is skipped. */
  explicitCenters?: BiomeCenter[];
}

// ============== ISLAND CONFIGURATION ==============

/**
 * Configuration for island mask generation
 */
export interface IslandConfig {
  /** Whether island mask is enabled */
  enabled: boolean;
  /** Maximum world size in tiles when island is enabled */
  maxWorldSizeTiles: number;
  /** Coastline falloff width in tiles */
  falloffTiles: number;
  /** Noise scale for coastline irregularity */
  edgeNoiseScale: number;
  /** Noise strength for radius variance (fraction of radius) */
  edgeNoiseStrength: number;
}

// ============== SHORELINE CONFIGURATION ==============

/**
 * Configuration for shoreline shaping
 */
export interface ShorelineConfig {
  /** Normalized height where water starts (0-1) */
  waterLevelNormalized: number;
  /** Normalized height where shoreline effect ends */
  threshold: number;
  /** Strength of shoreline color tinting (0-1) */
  colorStrength: number;
  /** Minimum slope to enforce near shorelines */
  minSlope: number;
  /** Sample distance for shoreline slope checks */
  slopeSampleDistance: number;
  /** Meters above water to shape shoreline */
  landBand: number;
  /** Max land steepening multiplier */
  landMaxMultiplier: number;
  /** Meters below water to deepen shoreline */
  underwaterBand: number;
  /** Max depth multiplier near shoreline */
  underwaterDepthMultiplier: number;
}

// ============== MAIN TERRAIN CONFIGURATION ==============

/**
 * Complete terrain generation configuration
 */
export interface TerrainConfig {
  /** Size of each terrain tile in meters */
  tileSize: number;
  /** World grid size in tiles */
  worldSize: number;
  /** Vertices per tile for mesh resolution */
  tileResolution: number;
  /** Maximum terrain height variation in meters */
  maxHeight: number;
  /** Height threshold below which water appears */
  waterThreshold: number;
  /** World seed for deterministic generation */
  seed: number;

  /** Noise layer configuration */
  noise: TerrainNoiseConfig;

  /** Biome generation configuration */
  biomes: BiomeConfig;

  /** Island mask configuration */
  island: IslandConfig;

  /** Shoreline configuration */
  shoreline: ShorelineConfig;
}

// ============== OUTPUT TYPES ==============

/**
 * Generated heightmap data for a terrain tile
 */
export interface HeightmapData {
  /** Tile X coordinate */
  tileX: number;
  /** Tile Z coordinate */
  tileZ: number;
  /** Height values (one per vertex) */
  heights: Float32Array;
  /** Biome ID per vertex */
  biomeIds: Float32Array;
  /** Dominant biome for the tile */
  dominantBiome: string;
  /** Resolution of the heightmap (vertices per side) */
  resolution: number;
}

/**
 * Vertex color data for terrain rendering
 */
export interface TerrainColorData {
  /** RGB colors per vertex (r, g, b interleaved) */
  colors: Float32Array;
  /** Road influence per vertex (0-1) */
  roadInfluences: Float32Array;
}

/**
 * Complete terrain tile data
 */
export interface TerrainTileData {
  /** Heightmap information */
  heightmap: HeightmapData;
  /** Vertex colors */
  colors: TerrainColorData;
  /** Normal vectors per vertex (optional, can be computed from heightmap) */
  normals?: Float32Array;
}

/**
 * Point query result from terrain generator
 */
export interface TerrainPointQuery {
  /** Height at the queried position */
  height: number;
  /** Dominant biome at the position */
  biome: string;
  /** All biome influences at the position */
  biomeInfluences: BiomeInfluence[];
  /**
   * Pre-blended biome color for this position (RGB 0-1). Populated
   * by `TerrainGenerator.queryPoint` from `BiomeSystem.blendBiomeColors`.
   *
   * Borrowed reference into `BiomeSystem._pooledBlendColor` — must
   * be consumed synchronously by the caller. This matches the
   * `GameTerrainAdapter.createGameTerrainQuerier` path which also
   * returns a pooled color object on its query result, so
   * downstream consumers like `terrainHelpers.generateTileGeometry`
   * can read `query.color` uniformly without branching on the
   * pipeline.
   */
  color: { r: number; g: number; b: number };
  /** Island mask value (0 = ocean, 1 = full land) */
  islandMask: number;
  /** Surface normal at the position */
  normal: { x: number; y: number; z: number };
}

// ============== PRESET TYPES ==============

/**
 * Named terrain preset
 */
export interface TerrainPreset {
  /** Preset identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Configuration values */
  config: Partial<TerrainConfig>;
}
