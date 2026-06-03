/**
 * Town Generation Types
 * Core interfaces for procedural town generation
 */

// ============================================================
// TOWN SIZE AND BUILDING TYPES
// ============================================================

/**
 * Town size category determines building count and services
 */
export type TownSize = "hamlet" | "village" | "town";

/**
 * Town layout type - how roads pass through the town
 */
export type TownLayoutType =
  | "terminus" // Single road ends here (dead end)
  | "throughway" // Single road passes through (2 entry points opposite)
  | "fork" // Road forks into two (3 entry points, Y-shape)
  | "crossroads"; // Two roads cross (4 entry points, X-shape)

/**
 * Building types available in towns
 */
export type TownBuildingType =
  | "bank"
  | "store"
  | "anvil"
  | "house"
  | "well"
  | "inn"
  | "smithy"
  | "simple-house"
  | "long-house"
  | "church"
  | "cathedral"
  | "chapel"
  | "keep"
  | "fortress"
  | "castle"
  | "guild-hall"
  | "town-hall"
  | "mansion"
  | "manor";

/**
 * Entry point where a road enters the town
 */
export interface TownEntryPoint {
  /** Direction angle in radians (0 = +X, PI/2 = +Z) */
  angle: number;
  /** Position at the edge of the safe zone */
  position: { x: number; z: number };
}

/**
 * Internal road segment within a town
 */
export interface TownInternalRoad {
  /** Start position (world coordinates) */
  start: { x: number; z: number };
  /** End position (world coordinates) */
  end: { x: number; z: number };
  /** Whether this is the main street */
  isMain: boolean;
  /** Road width in meters */
  width?: number;
}

/**
 * Walkway path from road to building entrance
 */
export interface TownPath {
  /** Start position - connection point on road edge */
  start: { x: number; z: number };
  /** End position - building entrance */
  end: { x: number; z: number };
  /** Path width in meters (typically 1-2m) */
  width: number;
  /** ID of building this path leads to */
  buildingId: string;
}

/**
 * Landmark/decoration placed in the town
 */
export interface TownLandmark {
  /** Unique landmark ID */
  id: string;
  /** Type of landmark */
  type: TownLandmarkType;
  /** World position */
  position: { x: number; y: number; z: number };
  /** Y-axis rotation in radians */
  rotation: number;
  /** Size in meters */
  size: { width: number; depth: number; height: number };
  /** Optional metadata for specific landmark types */
  metadata?: TownLandmarkMetadata;
}

/**
 * Metadata for specific landmark types
 */
export interface TownLandmarkMetadata {
  /** For signposts: destination town name */
  destination?: string;
  /** For signposts: destination town ID */
  destinationId?: string;
  /** For fence posts: which building lot this belongs to */
  lotBuildingId?: string;
  /** For fence posts: corner index (0-3 for rectangular lots) */
  cornerIndex?: number;
  /** For building signs: the building type */
  buildingType?: string;
  /** For building signs: display name on the sign */
  buildingName?: string;
  /** For building signs: the building ID */
  buildingId?: string;
}

/**
 * Types of landmarks that can appear in towns
 */
export type TownLandmarkType =
  | "well" // Central water source
  | "fountain" // Decorative fountain (larger towns)
  | "market_stall" // Trading booth
  | "signpost" // Direction sign at entrances
  | "building_sign" // Hanging sign on building facade (clickable)
  | "bench" // Seating
  | "barrel" // Storage decoration
  | "crate" // Cargo decoration
  | "lamppost" // Street lighting
  | "tree" // Decorative tree
  | "planter" // Flower planter
  | "fence_post" // Fence post at lot boundaries
  | "fence_gate"; // Gate in fence (at building entrances)

/**
 * Central plaza/public square
 */
export interface TownPlaza {
  /** Center position (world coordinates) */
  position: { x: number; z: number };
  /** Radius of the plaza */
  radius: number;
  /** Shape of the plaza */
  shape: "circle" | "square" | "octagon";
  /** Surface material */
  material: "cobblestone" | "dirt" | "grass";
}

// ============================================================
// BUILDING AND TOWN STRUCTURES
// ============================================================

/**
 * A building placed within a town
 */
export interface TownBuilding {
  /** Unique building ID */
  id: string;
  /** Type of building */
  type: TownBuildingType;
  /** World position of building center */
  position: { x: number; y: number; z: number };
  /** Y-axis rotation in radians (building faces this direction) */
  rotation: number;
  /** Building footprint size */
  size: { width: number; depth: number };
  /** Entrance/door position (world coordinates) */
  entrance?: { x: number; z: number };
  /** ID of the road this building faces */
  roadId?: number;
}

/**
 * Procedurally generated town data
 */
export interface GeneratedTown {
  /** Unique town ID */
  id: string;
  /** Town name (generated from seed) */
  name: string;
  /** World position of town center */
  position: { x: number; y: number; z: number };
  /** Town size category */
  size: TownSize;
  /** Safe zone radius in meters */
  safeZoneRadius: number;
  /** Biome the town is located in */
  biome: string;
  /** Buildings placed in this town */
  buildings: TownBuilding[];
  /** Suitability score used for placement (higher = better location) */
  suitabilityScore: number;
  /** Connected road IDs */
  connectedRoads: string[];
  /** Town layout type (how roads pass through) */
  layoutType?: TownLayoutType;
  /** Entry points where roads enter the town */
  entryPoints?: TownEntryPoint[];
  /** Internal road segments within the town */
  internalRoads?: TownInternalRoad[];
  /** Walkway paths from roads to building entrances */
  paths?: TownPath[];
  /** Landmarks and decorations (wells, benches, etc.) */
  landmarks?: TownLandmark[];
  /** Central plaza/public square */
  plaza?: TownPlaza;
}

// ============================================================
// CONFIGURATION TYPES
// ============================================================

/**
 * Town size configuration
 */
export interface TownSizeConfig {
  buildingCount: { min: number; max: number };
  radius: number;
  safeZoneRadius: number;
}

/**
 * Building type configuration
 */
export interface BuildingConfig {
  width: number;
  depth: number;
  priority: number;
}

/**
 * Landmark generation configuration
 */
export interface LandmarkConfig {
  /** Enable fences around building lots (villages and towns) */
  fencesEnabled: boolean;
  /** Probability of fence post at each valid corner (0-1) */
  fenceDensity: number;
  /** Fence post height in meters */
  fencePostHeight: number;
  /** Enable lampposts for villages (always enabled for towns) */
  lamppostsInVillages: boolean;
  /** Spacing between lampposts in meters */
  lamppostSpacing: number;
  /** Enable market stalls in town plazas */
  marketStallsEnabled: boolean;
  /** Enable decorative elements (barrels, crates, planters) */
  decorationsEnabled: boolean;
}

/**
 * Town generator configuration
 */
export interface TownGeneratorConfig {
  /** Number of towns to generate */
  townCount: number;
  /** World size in meters */
  worldSize: number;
  /** Minimum spacing between towns in meters */
  minTownSpacing: number;
  /** Radius for flatness sampling */
  flatnessSampleRadius: number;
  /** Number of points to sample for flatness */
  flatnessSampleCount: number;
  /** Water threshold height */
  waterThreshold: number;
  /** Minimum optimal distance from water */
  optimalWaterDistanceMin: number;
  /** Maximum optimal distance from water */
  optimalWaterDistanceMax: number;
  /** Configuration for each town size */
  townSizes: Record<TownSize, TownSizeConfig>;
  /** Biome suitability scores (0-1) */
  biomeSuitability: Record<string, number>;
  /** Building type configurations */
  buildingTypes: Record<TownBuildingType, BuildingConfig>;
  /** Landmark generation configuration */
  landmarks: LandmarkConfig;
}

// ============================================================
// PLACEMENT TYPES
// ============================================================

/**
 * Candidate location for town placement
 */
export interface TownCandidate {
  x: number;
  z: number;
  flatnessScore: number;
  waterProximityScore: number;
  biomeScore: number;
  totalScore: number;
  biome: string;
}

/**
 * Terrain query interface for town placement
 * Implement this to provide terrain data to the TownGenerator
 *
 * This interface can be implemented by:
 * - TerrainGenerator from @hyperforge/procgen/terrain
 * - TerrainSystem from @hyperforge/shared
 * - Custom terrain implementations
 */
export interface TerrainProvider {
  /**
   * Get terrain height at world position
   */
  getHeightAt(x: number, z: number): number;

  /**
   * Get biome at world position (optional)
   * Returns biome name string
   */
  getBiomeAt?(x: number, z: number): string;

  /**
   * Check if a position is underwater (optional)
   * If not provided, uses waterThreshold from config
   */
  isUnderwater?(x: number, z: number): boolean;

  /**
   * Get the water threshold height (optional)
   * Used for water proximity calculations
   */
  getWaterThreshold?(): number;
}

/**
 * Simplex noise generator interface
 */
export interface NoiseProvider {
  /**
   * 2D simplex noise (-1 to 1)
   */
  simplex2D(x: number, y: number): number;
}

/**
 * Helper type for creating TerrainProvider from TerrainGenerator
 * This interface matches the TerrainGenerator API from @hyperforge/procgen/terrain
 */
export interface TerrainGeneratorLike {
  getHeightAt(worldX: number, worldZ: number): number;
  getBiomeAtTile?(tileX: number, tileZ: number): string;
  isUnderwater?(worldX: number, worldZ: number): boolean;
  getWaterThreshold?(): number;
  queryPoint?(worldX: number, worldZ: number): { biome: string };
}

// ============================================================
// GENERATION OPTIONS
// ============================================================

/**
 * Options for town generation
 */
export interface TownGenerationOptions {
  /** Random seed for deterministic generation */
  seed?: number;
  /** Terrain provider for height queries */
  terrain?: TerrainProvider;
  /** Noise provider for procedural variation */
  noise?: NoiseProvider;
  /** Custom configuration overrides */
  config?: Partial<TownGeneratorConfig>;
}

/**
 * Create a TerrainProvider from a TerrainGenerator-like object
 * This allows seamless integration with @hyperforge/procgen/terrain
 */
export function createTerrainProviderFromGenerator(
  generator: TerrainGeneratorLike,
): TerrainProvider {
  return {
    getHeightAt(x: number, z: number): number {
      return generator.getHeightAt(x, z);
    },
    getBiomeAt(x: number, z: number): string {
      // Try queryPoint first (full API), then fallback to tile-based
      if (generator.queryPoint) {
        return generator.queryPoint(x, z).biome;
      }
      if (generator.getBiomeAtTile) {
        // Estimate tile from world position (assuming 100m tiles)
        const tileX = Math.floor(x / 100);
        const tileZ = Math.floor(z / 100);
        return generator.getBiomeAtTile(tileX, tileZ);
      }
      return "plains";
    },
    isUnderwater(x: number, z: number): boolean {
      if (generator.isUnderwater) {
        return generator.isUnderwater(x, z);
      }
      const threshold = generator.getWaterThreshold?.() ?? 5.4;
      return generator.getHeightAt(x, z) < threshold;
    },
    getWaterThreshold(): number {
      return generator.getWaterThreshold?.() ?? 5.4;
    },
  };
}

/**
 * Town generation result
 */
export interface TownGenerationResult {
  /** Generated towns */
  towns: GeneratedTown[];
  /** Statistics about generation */
  stats: TownGenerationStats;
}

/**
 * Statistics about town generation
 */
export interface TownGenerationStats {
  totalTowns: number;
  hamlets: number;
  villages: number;
  towns: number;
  totalBuildings: number;
  buildingCounts: Record<TownBuildingType, number>;
  candidatesEvaluated: number;
  generationTime: number;
}

// ============================================================
// VIEWER TYPES
// ============================================================

/**
 * Town viewer display options
 */
export interface TownViewerOptions {
  /** Show building labels */
  showLabels?: boolean;
  /** Show safe zone radius */
  showSafeZone?: boolean;
  /** Show building footprints */
  showFootprints?: boolean;
  /** Camera zoom level */
  zoom?: number;
  /** Town center position */
  centerOn?: { x: number; z: number };
}
