/**
 * @hyperforge/shared/world — Pure world algorithm exports.
 *
 * Single source of truth for terrain height, road influence, town flattening,
 * biome types, noise generation, and vegetation used by both the game client
 * and World Studio (asset-forge).
 */

// Pure terrain height computation
export {
  computeBaseHeight,
  adjustShorelineHeight,
  type TerrainNoiseAdapter,
  type BiomeNoiseAdapter,
  type BiomeNoiseSet,
  type BiomeTerrainConfig,
  type LandscapeFeatureDef,
  type ShorelineConfig,
  LandscapeType,
  MAX_HEIGHT,
  WATER_LEVEL_NORMALIZED,
  ISLAND_RADIUS,
  ISLAND_FALLOFF,
  ISLAND_DEEP_OCEAN_BUFFER,
  OCEAN_FLOOR_HEIGHT,
  BEACH_PROFILE_POWER,
  SHORELINE_CONFIG,
  BIOME_CONFIG,
  BIOME_CONFIGS,
  LANDSCAPE_FEATURES,
  COASTLINE_CIRCLE_SAMPLE_RADIUS,
  COAST_LARGE,
  COAST_MEDIUM,
  COAST_SMALL,
} from "../systems/shared/world/TerrainHeightParams";

// Noise generator
export { NoiseGenerator } from "../utils/NoiseGenerator";

// Biome types & tree config
export {
  type BiomeId,
  DEFAULT_BIOME,
  BIOME_LIST,
  getTreeConfigForBiome,
} from "../systems/shared/world/TerrainBiomeTypes";

// Tree type definitions (single source of truth for tree IDs & spawn config shapes)
export { TreeId, type TreeSpawnConfig } from "../constants/TreeTypes";

// Biome tree config type (used by World Studio to match game vegetation configs)
export { type BiomeTreeConfig } from "../types/world/world-types";

// Vegetation (already used by asset-forge)
export {
  generateTrees,
  type ResourceGenerationContext,
} from "../systems/shared/world/BiomeResourceGenerator";

// Town circular terrain flattening
export {
  applyTownCircularFlatten,
  type FlattenableTown,
  TOWN_FLATTEN_INNER_RATIO,
  TOWN_FLATTEN_OUTER_RATIO,
} from "./terrain-flatten";

// Road influence & height blending
export {
  calculateRoadInfluence,
  getRoadHeightAtPoint,
  getRoadHeightAndInfluence,
  computeRoadBounds,
  type RoadPathLike,
  type RoadBounds,
  ROAD_BLEND_WIDTH,
  ROAD_MINIMUM_WIDTH,
} from "./road-influence";

// Shared biome color palettes for terrain shaders
export {
  MINE_BIOME_PALETTES,
  ROAD_COLORS,
  type MineBiomePalette,
} from "./biome-colors";

// Mine influence & bowl terrain deformation
export {
  calculateMineInfluenceAtPoint,
  calculateMineBowlHeight,
  getMineEffectiveRadius,
  findNearestInfluencingMine,
  type MineArea,
} from "./mine-influence";

// Vegetation exclusion filtering (shared between World Studio & game client)
export {
  precomputeExclusions,
  filterTreesByExclusions,
  vegFbm,
  vegRand,
  vegSmoothstep,
  VEG_NOISE_FREQ,
  VEG_NOISE_AMP,
  VEG_TOWN_INNER_FRAC,
  VEG_TOWN_OUTER_FRAC,
  VEG_MIN_EDGE_SCALE,
  type VegetationExclusionInput,
  type PrecomputedExclusions,
  type FilterableTree,
} from "./vegetation-filter";

// Shared Perlin noise (single source of truth for terrain noise pipeline)
export {
  createPermutation,
  perlin2D,
  seamlessPerlin2D,
  seamlessFbm,
  buildPerlinNoiseJS,
} from "../utils/noise/PerlinNoise";

// Shared terrain shader constants & biome palettes
export {
  TERRAIN_SHADER,
  TUNDRA,
  FOREST,
  CANYON,
  ACCENT,
  type RGB,
} from "../systems/shared/world/TerrainConstants";
