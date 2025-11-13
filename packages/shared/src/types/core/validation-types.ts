/**
 * Validation system types
 *
 * These types are used for system validation, terrain validation,
 * and other testing/validation functionality across the engine.
 */

/**
 * Generic validation result
 */
// Note: ValidationResult is used in multiple contexts; keep this generic
export interface ValidationResult {
  test?: string;
  passed: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Terrain validation error
 */
export interface TerrainValidationError {
  type:
    | "height_discontinuity"
    | "physx_mismatch"
    | "underground_entity"
    | "invalid_slope"
    | "missing_collision"
    | "resource_placement_error";
  position: { x: number; y: number; z: number };
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: number;
  additionalData: unknown;
}

/**
 * Walkability analysis data
 */
export interface WalkabilityData {
  position: { x: number; z: number };
  height: number;
  slope: number;
  isWalkable: boolean;
  navMeshDistance: number;
  biome: string;
  surfaceType: "solid" | "water" | "void";
}

/**
 * Heightmap validation result
 */
export interface HeightmapValidationResult {
  isValid: boolean;
  errors: TerrainValidationError[];
  coverage: number; // Percentage of world validated
  averageFrameTime: number;
  totalValidationTime: number;
  walkabilityMap: Map<string, WalkabilityData>;
}

// Data validation result used by DataManager
export interface DataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  itemCount: number;
  npcCount: number;
  areaCount: number;
  treasureCount: number;
}

/**
 * Terrain chunk for validation
 */
export interface TerrainChunk {
  x: number;
  z: number;
  size: number;
}

/**
 * Terrain NaN test data
 */
export interface TerrainNaNTestData {
  testType:
    | "terrain_getHeightAt"
    | "player_spawn"
    | "entity_spawn"
    | "ground_positioning"
    | "comprehensive";
  startTime: number;
  nanInputsDetected: number;
  validatedPositions: Array<{
    input: { x: number; y: number; z: number };
    output: { x: number; y: number; z: number };
  }>;
  errors: string[];
  consoleErrors: string[];
}
