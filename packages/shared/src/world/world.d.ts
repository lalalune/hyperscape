/**
 * Type declarations for @hyperforge/shared/world
 *
 * This hand-maintained declaration file provides types for the world algorithm
 * module. It is copied to build/world.d.ts during `bun run build:shared`.
 *
 * When adding exports to src/world/index.ts, update this file to match.
 */

// ---------- TerrainHeightParams ----------

export interface ShorelineConfig {
  waterThreshold: number;
  shorelineLandBand: number;
  shorelineUnderwaterBand: number;
  shorelineMinSlope: number;
  shorelineLandMaxMultiplier: number;
  underwaterDepthMultiplier: number;
}

export interface BiomeTerrainConfig {
  seedOffset: number;
  frequency: number;
  amplitude: number;
  octaves: number;
  gain: number;
  lacunarity: number;
  noiseOffset: number;
  altitude: number;
  altitudeVariation: number;
  erosion: number;
  erosionSoftness: number;
  rivers: number;
  riverWidth: number;
  lakes: number;
  lakesFalloff: number;
  heightScale: number;
  powerCurve: number;
  smoothLowerPlanes: number;
  canyonMode: boolean;
  canyonFreqScale: number;
  canyonAmpScale: number;
  cliffLow: number;
  cliffHigh: number;
  terraceSteps: number;
  terraceStrength: number;
  terraceSharpness: number;
  terraceHeightScale: number;
  terraceSlope: number;
}

export interface TerrainNoiseAdapter {
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

export interface BiomeNoiseAdapter {
  simplexFbm2D(
    x: number,
    y: number,
    octaves: number,
    amplitude: number,
    frequency: number,
    gain: number,
    lacunarity: number,
    offset: number,
  ): number;
}

export interface BiomeNoiseSet {
  main: BiomeNoiseAdapter;
  variation: BiomeNoiseAdapter;
  erosion: BiomeNoiseAdapter;
}

export declare enum LandscapeType {
  Lake = "lake",
}

export interface LandscapeFeatureDef {
  type: LandscapeType;
  x: number;
  z: number;
  radius: number;
  strength: number;
  shapePower: number;
  noiseScale: number;
  noiseAmount: number;
  lakes: number;
  lakesFalloff: number;
}

export declare const MAX_HEIGHT: number;
export declare const WATER_LEVEL_NORMALIZED: number;
export declare const ISLAND_RADIUS: number;
export declare const ISLAND_FALLOFF: number;
export declare const ISLAND_DEEP_OCEAN_BUFFER: number;
export declare const OCEAN_FLOOR_HEIGHT: number;
export declare const BEACH_PROFILE_POWER: number;
export declare const SHORELINE_CONFIG: {
  readonly THRESHOLD: number;
  readonly STRENGTH: number;
  readonly MIN_SLOPE: number;
  readonly SLOPE_SAMPLE_DISTANCE: number;
  readonly LAND_BAND: number;
  readonly LAND_MAX_MULTIPLIER: number;
  readonly UNDERWATER_BAND: number;
  readonly UNDERWATER_DEPTH_MULTIPLIER: number;
};
export declare const BIOME_CONFIG: {
  readonly gaussianCoeff: number;
  readonly boundaryNoiseScale: number;
  readonly boundaryNoiseAmount: number;
  readonly placementRadius: number;
  readonly influenceRadius: number;
};
export declare const BIOME_CONFIGS: Record<string, BiomeTerrainConfig>;
export declare const LANDSCAPE_FEATURES: LandscapeFeatureDef[];
export declare const COASTLINE_CIRCLE_SAMPLE_RADIUS: number;
export declare const COAST_LARGE: {
  readonly octaves: number;
  readonly persistence: number;
  readonly lacunarity: number;
  readonly weight: number;
};
export declare const COAST_MEDIUM: {
  readonly freqMultiplier: number;
  readonly octaves: number;
  readonly persistence: number;
  readonly lacunarity: number;
  readonly weight: number;
};
export declare const COAST_SMALL: {
  readonly freqMultiplier: number;
  readonly weight: number;
};

export declare function computeBaseHeight(
  worldX: number,
  worldZ: number,
  noise: TerrainNoiseAdapter,
  biomeNoiseSets: Record<string, BiomeNoiseSet>,
  biomeWeights: Record<string, number>,
): number;

export declare function adjustShorelineHeight(
  baseHeight: number,
  slope: number,
  config: ShorelineConfig,
): number;

// ---------- NoiseGenerator ----------

export declare class NoiseGenerator {
  constructor(seed?: number);
  perlin2D(x: number, y: number): number;
  simplex2D(x: number, y: number): number;
  ridgeNoise2D(x: number, y: number): number;
  turbulence2D(x: number, y: number, octaves?: number): number;
  fractal2D(
    x: number,
    y: number,
    octaves?: number,
    persistence?: number,
    lacunarity?: number,
  ): number;
  domainWarp2D(
    x: number,
    y: number,
    warpStrength?: number,
  ): { x: number; y: number };
  erosionNoise2D(x: number, y: number, iterations?: number): number;
  temperatureMap(x: number, y: number, latitude?: number): number;
  moistureMap(x: number, y: number): number;
  simplexFbm2D(
    x: number,
    y: number,
    octaves: number,
    amplitude: number,
    frequency: number,
    gain: number,
    lacunarity: number,
    offset: number,
  ): number;
}

// ---------- TerrainBiomeTypes ----------

/**
 * Biome id — opaque string identifier sourced from the content
 * registry. Replaces `BiomeType` (kept as a deprecated alias).
 */
export type BiomeId = string;

/** @deprecated Use `BiomeId` instead. */
export declare enum BiomeType {
  Tundra = "tundra",
  Forest = "forest",
  Canyon = "canyon",
}

export declare const DEFAULT_BIOME: BiomeId;
export declare const BIOME_LIST: BiomeId[];
export declare function getTreeConfigForBiome(biomeId: string): BiomeTreeConfig;

// ---------- TreeTypes ----------

export declare enum TreeId {
  Pine = "tree_pine",
  Oak = "tree_oak",
  Maple = "tree_maple",
  Palm = "tree_palm",
  Banana = "tree_banana",
  Dead = "tree_dead",
  PineDead = "tree_pineDead",
  Bamboo = "tree_bamboo",
  Eucalyptus = "tree_eucalyptus",
  General = "tree_general",
  Magic = "tree_magic",
  Mahogany = "tree_mahogany",
}

export interface TreeSpawnConfig {
  weight: number;
  waterAffinity?: number;
  waterSearchRadius?: number;
  waterMaxDistance?: number;
  waterProximityHeight?: number;
  avoidsWaterBelow?: number;
  minHeight?: number;
  maxHeight?: number;
}

// ---------- BiomeTreeConfig ----------

export interface BiomeTreeConfig {
  enabled: boolean;
  trees: Record<string, TreeSpawnConfig>;
  density: number;
  minSpacing: number;
  clustering: boolean;
  enableSnow?: boolean;
  clusterSize?: number;
  clusterRadius?: number;
  clusterSpacing?: number;
  scaleVariation?: [number, number];
  maxSlope?: number;
}

// ---------- BiomeResourceGenerator ----------

export interface ResourceGenerationContext {
  tileX: number;
  tileZ: number;
  tileKey: string;
  tileSize: number;
  waterThreshold: number;
  getHeightAt: (worldX: number, worldZ: number) => number;
  isOnRoad?: (worldX: number, worldZ: number) => boolean;
  getWaterSurfaceAt?: (worldX: number, worldZ: number) => number;
  getDominantBiome?: (worldX: number, worldZ: number) => string;
  resolveTreeConfig?: (biomeId: string) => BiomeTreeConfig;
  createRng: (salt: string) => () => number;
}

export declare function generateTrees(
  ctx: ResourceGenerationContext,
  treeConfig: BiomeTreeConfig,
): Array<{
  id: string;
  type: string;
  subType?: string;
  position: { x: number; y: number; z: number };
  mesh: null;
  health: number;
  maxHealth: number;
  respawnTime: number;
  harvestable: boolean;
  requiredLevel: number;
  scale?: number;
  rotation?: number;
}>;

// ---------- terrain-flatten ----------

export interface FlattenableTown {
  position: { x: number; z: number };
  safeZoneRadius: number;
}

export declare const TOWN_FLATTEN_INNER_RATIO: number;
export declare const TOWN_FLATTEN_OUTER_RATIO: number;

export declare function applyTownCircularFlatten(
  worldX: number,
  worldZ: number,
  naturalHeight: number,
  towns: ReadonlyArray<FlattenableTown>,
  getCenterHeight: (x: number, z: number) => number,
): number | null;

// ---------- road-influence ----------

export interface RoadPathLike {
  path: ReadonlyArray<{ x: number; y?: number; z: number }>;
  width: number;
}

export interface RoadBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export declare const ROAD_BLEND_WIDTH: number;
export declare const ROAD_MINIMUM_WIDTH: number;

export declare function calculateRoadInfluence(
  worldX: number,
  worldZ: number,
  roads: ReadonlyArray<RoadPathLike>,
  blendWidth?: number,
  minimumWidth?: number,
): number;

export declare function getRoadHeightAtPoint(
  worldX: number,
  worldZ: number,
  roads: ReadonlyArray<RoadPathLike>,
  blendWidth?: number,
  minimumWidth?: number,
): { height: number; influence: number } | null;

export declare function getRoadHeightAndInfluence(
  worldX: number,
  worldZ: number,
  roads: ReadonlyArray<RoadPathLike>,
  blendWidth?: number,
  minimumWidth?: number,
): { height: number; heightInfluence: number; influence: number };

export declare function computeRoadBounds(
  road: RoadPathLike,
  blendWidth?: number,
  minimumWidth?: number,
): RoadBounds;

// ---------- biome-colors ----------

export interface MineBiomePalette {
  primary: [number, number, number];
  secondary: [number, number, number];
  tertiary: [number, number, number];
}

export declare const MINE_BIOME_PALETTES: {
  readonly forest: MineBiomePalette;
  readonly tundra: MineBiomePalette;
  readonly desert: MineBiomePalette;
  readonly mountains: MineBiomePalette;
  readonly plains: MineBiomePalette;
  readonly swamp: MineBiomePalette;
  readonly valley: MineBiomePalette;
};

export declare const ROAD_COLORS: {
  readonly earthBaseA: readonly [number, number, number];
  readonly earthBaseB: readonly [number, number, number];
  readonly dust: readonly [number, number, number];
  readonly gravel: readonly [number, number, number];
};

// ---------- mine-influence ----------

export interface MineArea {
  position: { x: number; y: number; z: number };
  radius: number;
  radialOffsets: number[];
  entryAngle: number;
  biome: string;
}

export declare function calculateMineInfluenceAtPoint(
  worldX: number,
  worldZ: number,
  mines: ReadonlyArray<MineArea> | undefined,
): { influence: number; biomeIndex: number };

export declare function calculateMineBowlHeight(
  worldX: number,
  worldZ: number,
  baseHeight: number,
  mine: MineArea,
): number;

export declare function getMineEffectiveRadius(
  baseRadius: number,
  offsets: number[],
  angle: number,
): number;

export declare function findNearestInfluencingMine(
  worldX: number,
  worldZ: number,
  mines: ReadonlyArray<MineArea> | undefined,
): MineArea | null;

// ---------- vegetation-filter ----------

export interface VegetationExclusionInput {
  circles: Array<{ x: number; z: number; radius: number }>;
  roads: Array<{ path: Array<{ x: number; z: number }>; halfWidth: number }>;
  towns?: Array<{ x: number; z: number; safeZoneRadius: number }>;
}

export interface PrecomputedExclusions {
  circles: Array<{ x: number; z: number; rSq: number }>;
  roadSegs: Array<{
    ax: number;
    az: number;
    abx: number;
    abz: number;
    abLenSq: number;
    hwSq: number;
  }>;
  towns: Array<{
    x: number;
    z: number;
    innerR: number;
    outerR: number;
    maxDSq: number;
  }>;
}

export interface FilterableTree {
  x: number;
  z: number;
  sc: number;
}

export declare const VEG_NOISE_FREQ: number;
export declare const VEG_NOISE_AMP: number;
export declare const VEG_TOWN_INNER_FRAC: number;
export declare const VEG_TOWN_OUTER_FRAC: number;
export declare const VEG_MIN_EDGE_SCALE: number;

export declare function vegFbm(x: number, z: number): number;
export declare function vegRand(x: number, z: number): number;
export declare function vegSmoothstep(
  edge0: number,
  edge1: number,
  x: number,
): number;

export declare function precomputeExclusions(
  input: VegetationExclusionInput,
): PrecomputedExclusions;

export declare function filterTreesByExclusions<T extends FilterableTree>(
  trees: T[],
  exclusions: PrecomputedExclusions,
): T[];
