/**
 * Terrain Generation Module
 *
 * Procedural terrain generation for games and simulations.
 * Includes heightmap generation, biome systems, and island masking.
 *
 * @example
 * ```typescript
 * import { TerrainGenerator, createConfigFromPreset } from '@hyperforge/procgen/terrain';
 *
 * // Create from preset
 * const config = createConfigFromPreset('large-island', { seed: 12345 });
 * const generator = new TerrainGenerator(config);
 *
 * // Generate a tile
 * const tileData = generator.generateTile(0, 0);
 *
 * // Query a point
 * const point = generator.queryPoint(50, 75);
 * console.log(`Height: ${point.height}, Biome: ${point.biome}`);
 * ```
 */

// Shared constants (single source of truth for procgen terrain defaults)
export {
  DEFAULT_MAX_HEIGHT,
  DEFAULT_WATER_THRESHOLD,
  GAME_WATER_LEVEL,
} from "./constants";

// Core generator
export {
  TerrainGenerator,
  DEFAULT_TERRAIN_CONFIG,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_SHORELINE_CONFIG,
  SHORELINE_COLOR,
} from "./TerrainGenerator";

// Noise generation
export {
  NoiseGenerator,
  createSeededRNG,
  createTileRNG,
} from "./NoiseGenerator";

// Biome system
export { BiomeSystem, DEFAULT_BIOME_CONFIG } from "./BiomeSystem";

// Island mask
export {
  IslandMask,
  DEFAULT_ISLAND_CONFIG,
  DEFAULT_POND_CONFIG,
  type PondConfig,
} from "./IslandMask";

// Presets
export {
  TERRAIN_PRESETS,
  SMALL_ISLAND_PRESET,
  LARGE_ISLAND_PRESET,
  ARCHIPELAGO_PRESET,
  CONTINENT_PRESET,
  MOUNTAIN_RANGE_PRESET,
  FLAT_PLAINS_PRESET,
  DESERT_PRESET,
  getTerrainPreset,
  createConfigFromPreset,
  listPresetIds,
} from "./presets";

// Types
export type {
  // Configuration types
  TerrainConfig,
  TerrainNoiseConfig,
  NoiseLayerConfig,
  BiomeConfig,
  IslandConfig,
  ShorelineConfig,
  // Data types
  BiomeDefinition,
  BiomeCenter,
  BiomeInfluence,
  RGBColor,
  // Output types
  HeightmapData,
  TerrainColorData,
  TerrainTileData,
  TerrainPointQuery,
  // Preset types
  TerrainPreset,
} from "./types";

// Terrain Shader (TSL material - same as game engine)
export type {
  TerrainUniforms,
  TerrainMaterialOptions,
} from "./TerrainShaderTSL";

export {
  TERRAIN_CONSTANTS,
  generateNoiseTexture,
  getNoiseTexture,
  sampleNoiseAtPosition,
  getGrassiness,
  calculateSlope,
  createTerrainMaterial,
  updateTerrainFog,
  setTerrainFogEnabled,
} from "./TerrainShaderTSL";
