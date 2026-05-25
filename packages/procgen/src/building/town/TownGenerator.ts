/**
 * TownGenerator - Procedural Town Generation
 * Generates towns with building placement, scoring, and layout algorithms.
 *
 * This is a standalone module that can be used with or without a full game engine.
 * Provide a TerrainProvider to enable terrain-aware placement.
 */

import type {
  TownSize,
  TownBuildingType,
  TownBuilding,
  GeneratedTown,
  TownCandidate,
  TownGeneratorConfig,
  TownGenerationOptions,
  TownGenerationResult,
  TownGenerationStats,
  TerrainProvider,
  NoiseProvider,
  TownLayoutType,
  TownEntryPoint,
  TownInternalRoad,
  TownPath,
  TownLandmark,
  TownLandmarkType,
  TownPlaza,
  TerrainGeneratorLike,
} from "./types";

import { createTerrainProviderFromGenerator } from "./types";

import {
  createDefaultConfig,
  NAME_PREFIXES,
  NAME_SUFFIXES,
  WATER_CHECK_DIRECTIONS,
  WATER_CHECK_MAX_DISTANCE,
  WATER_CHECK_STEP,
  DEFAULT_WATER_THRESHOLD,
} from "./constants";

// Import grid alignment utilities from building generator
import { snapToBuildingGrid } from "../generator/constants";

// ============================================================
// CONSTANTS - Single source of truth for all dimensions
// Grid-aligned to CELL_SIZE (4m) for proper tile alignment
// ============================================================

import { CELL_SIZE } from "../generator/constants";

const TOWN_CONSTANTS = {
  // Road dimensions (grid-aligned)
  ROAD_WIDTH: 2 * CELL_SIZE, // 8m = 2 cells wide
  ROAD_HALF_WIDTH: CELL_SIZE, // 4m = 1 cell

  // Building placement (grid-aligned)
  BUILDING_PADDING: CELL_SIZE, // 4m = 1 cell gap between road edge and building
  MAX_BUILDING_HALF_DEPTH: 2.5 * CELL_SIZE, // 10m = half of largest building (long-house: 5 cells deep)
  LOT_WIDTH: 4 * CELL_SIZE, // 16m = 4 cells spacing between buildings

  // Buffer for floating point precision and grid snap alignment
  SETBACK_BUFFER: 1, // 1m extra clearance to avoid edge cases

  // Computed setback: roadHalfWidth + buildingPadding + maxBuildingHalfDepth + buffer
  // = 4 + 4 + 10 + 1 = 19m (will be snapped to grid by snapToBuildingGrid)
  get SETBACK() {
    return (
      this.ROAD_HALF_WIDTH +
      this.BUILDING_PADDING +
      this.MAX_BUILDING_HALF_DEPTH +
      this.SETBACK_BUFFER
    );
  },

  // Path dimensions
  PATH_WIDTH: 3, // 3m path width - visible walkway to building doors

  // Minimum distances (grid-aligned)
  MIN_BUILDING_SPACING: CELL_SIZE, // 4m = 1 cell gap between buildings
  MIN_ROAD_LENGTH: 3 * CELL_SIZE, // 12m = 3 cells minimum road length
  ROAD_TRIM_PADDING: 2 * CELL_SIZE, // 8m = 2 cells past last building
} as const;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

const dist2D = (x1: number, z1: number, x2: number, z2: number): number =>
  Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);

/**
 * Check if two axis-aligned bounding boxes overlap (in 2D XZ plane)
 */
function boxesOverlap(
  ax: number,
  az: number,
  aWidth: number,
  aDepth: number,
  _aRotation: number,
  bx: number,
  bz: number,
  bWidth: number,
  bDepth: number,
  _bRotation: number,
  padding: number = 0,
): boolean {
  // For simplicity, use circular approximation with max dimension
  const aRadius = Math.max(aWidth, aDepth) / 2 + padding;
  const bRadius = Math.max(bWidth, bDepth) / 2 + padding;
  const dist = dist2D(ax, az, bx, bz);
  return dist < aRadius + bRadius;
}

/**
 * Check if a line segment intersects a circle
 */
function lineIntersectsCircle(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  // Vector from start to end
  const dx = x2 - x1;
  const dz = z2 - z1;

  // Vector from start to circle center
  const fx = x1 - cx;
  const fz = z1 - cz;

  const a = dx * dx + dz * dz;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - radius * radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  // Check if intersection is within segment
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

// Simple simplex-like noise fallback (when no provider)
function createSimpleNoise(seed: number): NoiseProvider {
  return {
    simplex2D(x: number, y: number): number {
      // Simple hash-based pseudo-random
      const hash =
        Math.sin(x * 12.9898 + y * 78.233 + seed * 0.001) * 43758.5453;
      return (hash - Math.floor(hash)) * 2 - 1;
    },
  };
}

// Simple terrain fallback (flat terrain). Returns height comfortably
// above the current `DEFAULT_WATER_THRESHOLD` (16) so callers that
// construct a TownGenerator without their own terrain still produce
// land — not ocean. The previous value (10) pre-dated the height-
// pass that raised the threshold from 5.4 to 16; with the old
// constant the fallback was above water, with the new one it
// silently drowned every spawn candidate.
function createFlatTerrain(): TerrainProvider {
  return {
    getHeightAt(_x: number, _z: number): number {
      return 25;
    },
    getBiomeAt(_x: number, _z: number): string {
      return "plains";
    },
  };
}

// ============================================================
// TOWN GENERATOR CLASS
// ============================================================

export class TownGenerator {
  private config: TownGeneratorConfig;
  private seed: number;
  private randomState: number;
  private terrain: TerrainProvider;
  private noise: NoiseProvider;

  constructor(options: TownGenerationOptions = {}) {
    this.seed = options.seed ?? Date.now();
    this.randomState = this.seed;
    this.config = this.mergeConfig(options.config);
    this.terrain = options.terrain ?? createFlatTerrain();
    this.noise = options.noise ?? createSimpleNoise(this.seed);
  }

  /**
   * Create a TownGenerator from a TerrainGenerator
   * This provides seamless integration with @hyperforge/procgen/terrain
   *
   * @example
   * ```typescript
   * import { TerrainGenerator } from '@hyperforge/procgen/terrain';
   * import { TownGenerator } from '@hyperforge/procgen/building/town';
   *
   * const terrainGen = new TerrainGenerator({ seed: 12345 });
   * const townGen = TownGenerator.fromTerrainGenerator(terrainGen);
   * const result = townGen.generate();
   * ```
   */
  static fromTerrainGenerator(
    terrainGenerator: TerrainGeneratorLike,
    options: Omit<TownGenerationOptions, "terrain"> = {},
  ): TownGenerator {
    const terrain = createTerrainProviderFromGenerator(terrainGenerator);

    // Extract water threshold from terrain generator if available
    const waterThreshold =
      terrainGenerator.getWaterThreshold?.() ?? DEFAULT_WATER_THRESHOLD;

    return new TownGenerator({
      ...options,
      terrain,
      config: {
        ...options.config,
        waterThreshold,
      },
    });
  }

  private mergeConfig(
    overrides?: Partial<TownGeneratorConfig>,
  ): TownGeneratorConfig {
    const defaults = createDefaultConfig();
    if (!overrides) return defaults;

    return {
      ...defaults,
      ...overrides,
      townSizes: overrides.townSizes
        ? { ...defaults.townSizes, ...overrides.townSizes }
        : defaults.townSizes,
      biomeSuitability: overrides.biomeSuitability
        ? { ...defaults.biomeSuitability, ...overrides.biomeSuitability }
        : defaults.biomeSuitability,
      buildingTypes: overrides.buildingTypes
        ? { ...defaults.buildingTypes, ...overrides.buildingTypes }
        : defaults.buildingTypes,
    };
  }

  // ============================================================
  // RANDOM NUMBER GENERATION
  // ============================================================

  private random(): number {
    this.randomState = (this.randomState * 1664525 + 1013904223) >>> 0;
    return this.randomState / 0xffffffff;
  }

  private resetRandom(seed: number): void {
    this.randomState = seed;
  }

  // ============================================================
  // NAME GENERATION
  // ============================================================

  private generateTownName(townIndex: number): string {
    this.resetRandom(this.seed + townIndex * 7919);
    const prefixIndex = Math.floor(this.random() * NAME_PREFIXES.length);
    const suffixIndex = Math.floor(this.random() * NAME_SUFFIXES.length);
    return NAME_PREFIXES[prefixIndex] + NAME_SUFFIXES[suffixIndex];
  }

  // ============================================================
  // SCORING ALGORITHMS
  // ============================================================

  /** Returns 0-1 where 1 is perfectly flat */
  private calculateFlatness(centerX: number, centerZ: number): number {
    const { flatnessSampleCount, flatnessSampleRadius } = this.config;
    const heights: number[] = [];
    const angleStep = (Math.PI * 2) / flatnessSampleCount;

    for (let i = 0; i < flatnessSampleCount; i++) {
      const angle = i * angleStep;
      const sampleX = centerX + Math.cos(angle) * flatnessSampleRadius;
      const sampleZ = centerZ + Math.sin(angle) * flatnessSampleRadius;
      heights.push(this.terrain.getHeightAt(sampleX, sampleZ));
    }
    heights.push(this.terrain.getHeightAt(centerX, centerZ));

    const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
    const variance =
      heights.reduce((sum, h) => sum + (h - mean) ** 2, 0) / heights.length;
    return Math.exp(-variance / 25);
  }

  /** Returns 0-1 where 1 is optimal distance from water */
  private calculateWaterProximity(centerX: number, centerZ: number): number {
    const { waterThreshold, optimalWaterDistanceMin, optimalWaterDistanceMax } =
      this.config;
    const centerHeight = this.terrain.getHeightAt(centerX, centerZ);

    if (centerHeight < waterThreshold) return 0;

    let minWaterDistance = Infinity;

    for (let dir = 0; dir < WATER_CHECK_DIRECTIONS; dir++) {
      const angle = (dir / WATER_CHECK_DIRECTIONS) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);

      for (
        let distance = WATER_CHECK_STEP;
        distance <= WATER_CHECK_MAX_DISTANCE;
        distance += WATER_CHECK_STEP
      ) {
        const height = this.terrain.getHeightAt(
          centerX + dx * distance,
          centerZ + dz * distance,
        );
        if (height < waterThreshold) {
          minWaterDistance = Math.min(minWaterDistance, distance);
          break;
        }
      }
    }

    if (minWaterDistance === Infinity) return 0.5;
    if (
      minWaterDistance >= optimalWaterDistanceMin &&
      minWaterDistance <= optimalWaterDistanceMax
    ) {
      return 1.0;
    }
    if (minWaterDistance < optimalWaterDistanceMin) {
      return minWaterDistance / optimalWaterDistanceMin;
    }
    return Math.max(
      0.3,
      1.0 - (minWaterDistance - optimalWaterDistanceMax) / 500,
    );
  }

  private getBiomeAt(x: number, z: number): string {
    if (this.terrain.getBiomeAt) {
      return this.terrain.getBiomeAt(x, z);
    }
    // Fallback: use noise to determine biome
    const biomeNoise = this.noise.simplex2D(x * 0.0005, z * 0.0005);
    if (biomeNoise > 0.3) return "plains";
    if (biomeNoise > 0) return "forest";
    if (biomeNoise > -0.3) return "valley";
    return "mountains";
  }

  // ============================================================
  // CANDIDATE GENERATION AND SELECTION
  // ============================================================

  private isTooCloseToExistingTowns(
    x: number,
    z: number,
    existingTowns: TownCandidate[],
  ): boolean {
    const minSpacing = this.config.minTownSpacing;
    return existingTowns.some(
      (town) => dist2D(x, z, town.x, town.z) < minSpacing,
    );
  }

  private generateTownCandidates(): TownCandidate[] {
    const { worldSize, biomeSuitability, placementGridSize } = this.config;
    const halfWorld = worldSize / 2;
    const gridSize = placementGridSize;
    const cellSize = worldSize / gridSize;
    const candidates: TownCandidate[] = [];

    // Debug: Track rejection reasons
    let edgeSkipped = 0;
    let underwaterSkipped = 0;
    let biomeSkipped = 0;
    let totalEvaluated = 0;
    const sampleHeights: number[] = [];

    this.resetRandom(this.seed + 12345);

    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        const baseX = (gx + 0.5) * cellSize - halfWorld;
        const baseZ = (gz + 0.5) * cellSize - halfWorld;
        const x = baseX + (this.random() - 0.5) * cellSize * 0.8;
        const z = baseZ + (this.random() - 0.5) * cellSize * 0.8;

        totalEvaluated++;

        // Skip positions too close to world edge
        if (Math.abs(x) > halfWorld - 200 || Math.abs(z) > halfWorld - 200) {
          edgeSkipped++;
          continue;
        }

        // Sample height for diagnostics (first 10 candidates)
        if (sampleHeights.length < 10) {
          sampleHeights.push(this.terrain.getHeightAt(x, z));
        }

        const flatnessScore = this.calculateFlatness(x, z);
        const waterProximityScore = this.calculateWaterProximity(x, z);
        const biome = this.getBiomeAt(x, z);
        const biomeScore = biomeSuitability[biome] ?? 0.3;

        // Skip unsuitable locations - track rejection reasons
        if (waterProximityScore === 0) {
          underwaterSkipped++;
          continue;
        }
        if (biomeScore < 0.1) {
          biomeSkipped++;
          continue;
        }

        const suitabilityNoise =
          (this.noise.simplex2D(x * 0.002, z * 0.002) + 1) * 0.5;
        const totalScore =
          flatnessScore * 0.4 +
          waterProximityScore * 0.2 +
          biomeScore * 0.25 +
          suitabilityNoise * 0.15;

        candidates.push({
          x,
          z,
          flatnessScore,
          waterProximityScore,
          biomeScore,
          totalScore,
          biome,
        });
      }
    }

    // Debug: Log candidate evaluation statistics
    console.log(
      `[TownGenerator] Candidate evaluation: ${totalEvaluated} total, ` +
        `${edgeSkipped} edge-skipped, ${underwaterSkipped} underwater, ${biomeSkipped} bad-biome, ` +
        `${candidates.length} passed (waterThreshold=${this.config.waterThreshold})`,
    );
    if (sampleHeights.length > 0) {
      const avgHeight =
        sampleHeights.reduce((a, b) => a + b, 0) / sampleHeights.length;
      console.log(
        `[TownGenerator] Sample heights: [${sampleHeights.map((h) => h.toFixed(1)).join(", ")}] avg=${avgHeight.toFixed(1)}m`,
      );
    }

    return candidates;
  }

  private selectTownLocations(
    candidates: TownCandidate[],
    existingTowns: GeneratedTown[] = [],
  ): TownCandidate[] {
    const sorted = [...candidates].sort((a, b) => b.totalScore - a.totalScore);
    const selectedTowns: TownCandidate[] = [];

    // Convert existing towns to candidate format for spacing check
    const existingCandidates: TownCandidate[] = existingTowns.map((t) => ({
      x: t.position.x,
      z: t.position.z,
      flatnessScore: 1,
      waterProximityScore: 1,
      biomeScore: 1,
      totalScore: 1,
      biome: t.biome,
    }));

    for (const candidate of sorted) {
      if (selectedTowns.length >= this.config.townCount) break;

      const allExisting = [...selectedTowns, ...existingCandidates];
      if (
        !this.isTooCloseToExistingTowns(candidate.x, candidate.z, allExisting)
      ) {
        selectedTowns.push(candidate);
      }
    }

    return selectedTowns;
  }

  // ============================================================
  // TOWN SIZE DETERMINATION
  // ============================================================

  private determineTownSize(
    suitabilityScore: number,
    townIndex: number,
  ): TownSize {
    this.resetRandom(this.seed + townIndex * 3571);
    const roll = this.random();

    if (suitabilityScore > 0.7 && roll > 0.6) return "town";
    if (suitabilityScore > 0.5 && roll > 0.4) return "village";
    return "hamlet";
  }

  // ============================================================
  // TOWN LAYOUT GENERATION - GRID-BASED PLANNING
  // ============================================================

  /**
   * Generate a proper grid-based town layout with main street and cross streets
   */
  generateTownLayout(town: GeneratedTown, layoutType?: TownLayoutType): void {
    this.resetRandom(this.seed + town.position.x * 1000 + town.position.z);

    // Determine layout type based on town size if not specified
    if (!layoutType) {
      const roll = this.random();
      if (town.size === "hamlet") {
        layoutType = roll < 0.6 ? "terminus" : "throughway";
      } else if (town.size === "village") {
        layoutType =
          roll < 0.2 ? "terminus" : roll < 0.7 ? "throughway" : "crossroads";
      } else {
        layoutType = roll < 0.3 ? "throughway" : "crossroads";
      }
    }

    // Base orientation - strictly NESW aligned (0°, 90°, 180°, 270°)
    // Buildings and roads must align to the grid for proper navigation
    // Choose one of four cardinal directions randomly
    const cardinalIndex = Math.floor(this.random() * 4);
    const baseAngle = cardinalIndex * (Math.PI / 2); // 0, π/2, π, or 3π/2 radians
    const edgeDistance = town.safeZoneRadius * 0.9;

    // Generate grid-based road network
    const roads: TownInternalRoad[] = [];
    const entryPoints: TownEntryPoint[] = [];

    // Main street always runs through center
    const mainStreetStart = {
      x: town.position.x + Math.cos(baseAngle) * edgeDistance,
      z: town.position.z + Math.sin(baseAngle) * edgeDistance,
    };
    const mainStreetEnd = {
      x: town.position.x + Math.cos(baseAngle + Math.PI) * edgeDistance,
      z: town.position.z + Math.sin(baseAngle + Math.PI) * edgeDistance,
    };

    roads.push({
      start: mainStreetStart,
      end: mainStreetEnd,
      isMain: true,
    });

    entryPoints.push(
      { angle: baseAngle, position: mainStreetStart },
      { angle: baseAngle + Math.PI, position: mainStreetEnd },
    );

    // Add cross streets based on layout type and town size
    if (
      layoutType === "crossroads" ||
      (layoutType === "throughway" && town.size === "town")
    ) {
      // Cross street perpendicular to main
      const crossAngle = baseAngle + Math.PI / 2;
      const crossStreetStart = {
        x: town.position.x + Math.cos(crossAngle) * edgeDistance,
        z: town.position.z + Math.sin(crossAngle) * edgeDistance,
      };
      const crossStreetEnd = {
        x: town.position.x + Math.cos(crossAngle + Math.PI) * edgeDistance,
        z: town.position.z + Math.sin(crossAngle + Math.PI) * edgeDistance,
      };

      roads.push({
        start: crossStreetStart,
        end: crossStreetEnd,
        isMain: false,
      });

      entryPoints.push(
        { angle: crossAngle, position: crossStreetStart },
        { angle: crossAngle + Math.PI, position: crossStreetEnd },
      );
    }

    // For larger towns, add parallel side streets
    if (town.size === "town") {
      const sideStreetOffset = 18; // Distance from main street
      const sideStreetLength = town.safeZoneRadius * 0.6;

      // Direction perpendicular to main street
      const perpX = -Math.sin(baseAngle);
      const perpZ = Math.cos(baseAngle);

      // Two parallel side streets
      for (const side of [-1, 1]) {
        const offsetX = perpX * sideStreetOffset * side;
        const offsetZ = perpZ * sideStreetOffset * side;

        roads.push({
          start: {
            x:
              town.position.x +
              offsetX +
              Math.cos(baseAngle) * sideStreetLength,
            z:
              town.position.z +
              offsetZ +
              Math.sin(baseAngle) * sideStreetLength,
          },
          end: {
            x:
              town.position.x +
              offsetX +
              Math.cos(baseAngle + Math.PI) * sideStreetLength,
            z:
              town.position.z +
              offsetZ +
              Math.sin(baseAngle + Math.PI) * sideStreetLength,
          },
          isMain: false,
        });
      }
    }

    // For terminus layout, keep the full road length but only mark ONE entry point
    // This creates a "dead-end" feel while still allowing buildings along the entire road
    if (layoutType === "terminus") {
      // Keep the main street at full length (edge to edge through center)
      // Just reduce entry points to 1 (the "approach" side)
      entryPoints.length = 1;
    }

    town.layoutType = layoutType;
    town.entryPoints = entryPoints;
    town.internalRoads = roads;
  }

  // ============================================================
  // BUILDING PLACEMENT - GRID-BASED LOTS
  // ============================================================

  private generateBuildings(
    town: GeneratedTown,
    townIndex: number,
  ): TownBuilding[] {
    const buildings: TownBuilding[] = [];
    const sizeConfig = this.config.townSizes[town.size];
    const buildingConfigs = this.config.buildingTypes;

    this.resetRandom(this.seed + townIndex * 9973 + 100000);

    const { min, max } = sizeConfig.buildingCount;
    const buildingCount = min + Math.floor(this.random() * (max - min + 1));

    // Generate building lots along roads
    const lots = this.generateBuildingLots(town);

    // Sort lots by distance from center (central lots get commercial buildings)
    lots.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter);

    // ── Building assignment by town size ──
    // Essential services every settlement needs
    const essentialTypes: TownBuildingType[] = ["bank", "store", "smithy"];
    if (town.size !== "hamlet") essentialTypes.push("inn");

    // Notable buildings that appear based on town size
    // These give each settlement its unique character
    const notableTypes: TownBuildingType[] = [];
    if (town.size === "village") {
      // Villages get a church or chapel and maybe a guild hall
      notableTypes.push(this.random() > 0.5 ? "church" : "chapel");
      if (this.random() > 0.6) notableTypes.push("guild-hall");
    } else if (town.size === "town") {
      // Towns get more substantial civic and religious buildings
      notableTypes.push("church");
      if (this.random() > 0.3) notableTypes.push("cathedral");
      if (this.random() > 0.4) notableTypes.push("guild-hall");
      if (this.random() > 0.5) notableTypes.push("town-hall");
      // Fortifications — at most one
      if (this.random() > 0.5) {
        const fortTypes: TownBuildingType[] = ["keep", "fortress", "castle"];
        notableTypes.push(
          fortTypes[Math.floor(this.random() * fortTypes.length)],
        );
      }
      // Larger residences
      if (this.random() > 0.5) {
        notableTypes.push(this.random() > 0.5 ? "mansion" : "manor");
      }
    }

    const houseTypes: TownBuildingType[] = ["simple-house", "long-house"];

    // Assign building types to lots
    const assignments: Array<{
      lot: (typeof lots)[0];
      type: TownBuildingType;
    }> = [];

    // Essential buildings go in the most central lots
    let nextLot = 0;
    for (
      let i = 0;
      nextLot < lots.length && i < essentialTypes.length;
      i++, nextLot++
    ) {
      assignments.push({ lot: lots[nextLot], type: essentialTypes[i] });
    }

    // Notable buildings go in the next-most-central lots
    for (
      let i = 0;
      nextLot < lots.length && i < notableTypes.length;
      i++, nextLot++
    ) {
      assignments.push({ lot: lots[nextLot], type: notableTypes[i] });
    }

    // Fill remaining lots with houses up to building count
    for (; nextLot < Math.min(lots.length, buildingCount); nextLot++) {
      const houseType =
        houseTypes[Math.floor(this.random() * houseTypes.length)];
      assignments.push({ lot: lots[nextLot], type: houseType });
    }

    // Create buildings from assignments
    for (let i = 0; i < assignments.length; i++) {
      const { lot, type } = assignments[i];
      const config = buildingConfigs[type];
      const buildingY = this.terrain.getHeightAt(lot.x, lot.z);

      // Calculate entrance position on the front face of the building
      // The front face should be the one facing the road (away from lot's perpendicular offset)
      // Door should be on the outer edge of that face (furthest from town center)

      // Front direction (building faces this way, toward road)
      const frontDirX = Math.sin(lot.facingAngle);
      const frontDirZ = Math.cos(lot.facingAngle);

      // Side direction (perpendicular to front, for offsetting along facade)
      const sideDirX = Math.cos(lot.facingAngle);
      const sideDirZ = -Math.sin(lot.facingAngle);

      // Front face center (just outside the building)
      const frontCenterX = lot.x + frontDirX * (config.depth / 2 + 0.3);
      const frontCenterZ = lot.z + frontDirZ * (config.depth / 2 + 0.3);

      // Offset door toward the side furthest from town center
      const toTownCenterX = town.position.x - frontCenterX;
      const toTownCenterZ = town.position.z - frontCenterZ;

      // Project onto side direction to determine which way is "away from center"
      const dotProduct = toTownCenterX * sideDirX + toTownCenterZ * sideDirZ;
      const awayFromCenterSign = dotProduct > 0 ? -1 : 1; // Move opposite to center

      // Offset door along facade (25% of width toward outer edge)
      const sideOffset = (config.width / 2) * 0.4 * awayFromCenterSign;

      const entrance = {
        x: frontCenterX + sideDirX * sideOffset,
        z: frontCenterZ + sideDirZ * sideOffset,
      };

      buildings.push({
        id: `${town.id}_building_${i}`,
        type,
        position: { x: lot.x, y: buildingY, z: lot.z },
        rotation: lot.facingAngle,
        size: { width: config.width, depth: config.depth },
        entrance,
        roadId: lot.roadIndex,
      });
    }

    return buildings;
  }

  /**
   * Generate building lots in a grid pattern along roads
   * Uses proper bounding box calculations to ensure no road overlap
   */
  private generateBuildingLots(town: GeneratedTown): Array<{
    x: number;
    z: number;
    facingAngle: number;
    distanceFromCenter: number;
    roadIndex: number;
  }> {
    const lots: Array<{
      x: number;
      z: number;
      facingAngle: number;
      distanceFromCenter: number;
      roadIndex: number;
    }> = [];

    const internalRoads = town.internalRoads ?? [];
    if (internalRoads.length === 0) {
      return this.generateRadialLots(town);
    }

    // Use centralized constants
    const {
      ROAD_HALF_WIDTH,
      BUILDING_PADDING,
      MAX_BUILDING_HALF_DEPTH,
      LOT_WIDTH,
      SETBACK,
    } = TOWN_CONSTANTS;

    // Calculate intersection exclusion zone - keep it minimal to allow more buildings
    const plazaRadius =
      town.plaza?.radius ??
      (town.size === "town" ? 6 : town.size === "village" ? 4 : 2);
    // Only exclude the immediate plaza area, not the whole road intersection
    const intersectionClearance = plazaRadius + BUILDING_PADDING;

    for (let roadIndex = 0; roadIndex < internalRoads.length; roadIndex++) {
      const road = internalRoads[roadIndex];
      const roadDx = road.end.x - road.start.x;
      const roadDz = road.end.z - road.start.z;
      const roadLength = Math.sqrt(roadDx * roadDx + roadDz * roadDz);

      if (roadLength < LOT_WIDTH * 2) continue;

      // Road direction and perpendicular
      const dirX = roadDx / roadLength;
      const dirZ = roadDz / roadLength;
      const perpX = -dirZ;
      const perpZ = dirX;

      // Facing angles (buildings face the road)
      // Three.js: rotation.y = θ means local +Z points to (sin(θ), cos(θ))
      // Left lot needs to face -perp direction (toward road): θ = atan2(-perpX, -perpZ)
      // Right lot needs to face +perp direction (toward road): θ = atan2(perpX, perpZ)
      // Snap to nearest 90° increment to ensure strict NESW alignment
      const rawFacingLeft = Math.atan2(-perpX, -perpZ);
      const rawFacingRight = Math.atan2(perpX, perpZ);
      const facingLeft =
        Math.round(rawFacingLeft / (Math.PI / 2)) * (Math.PI / 2);
      const facingRight =
        Math.round(rawFacingRight / (Math.PI / 2)) * (Math.PI / 2);

      // Leave space at ends for road entries
      // Use smaller offsets to fit more buildings
      const idealOffset = LOT_WIDTH * 0.75; // 12m
      const minOffset = LOT_WIDTH * 0.25; // 4m minimum

      // Calculate how much space we need and scale offsets if road is short
      const minUsableForOneLot = LOT_WIDTH; // Need at least one lot width
      const idealTotalOffset = idealOffset * 2;
      const availableAfterIdeal =
        roadLength - idealTotalOffset - minUsableForOneLot;

      let startOffset: number;
      let endOffset: number;

      if (availableAfterIdeal >= 0) {
        // Road is long enough for ideal offsets
        startOffset = idealOffset;
        endOffset = idealOffset;
      } else {
        // Scale down offsets proportionally, but keep a minimum
        const excessNeeded = -availableAfterIdeal;
        const offsetReduction = Math.min(
          excessNeeded / 2,
          idealOffset - minOffset,
        );
        startOffset = idealOffset - offsetReduction;
        endOffset = idealOffset - offsetReduction;
      }

      const usableLength = roadLength - startOffset - endOffset;
      const numLots = Math.floor(usableLength / LOT_WIDTH);

      if (numLots < 1) continue;

      // Generate lots on both sides of the road
      for (let i = 0; i < numLots; i++) {
        const t = startOffset + (i + 0.5) * LOT_WIDTH;
        const baseX = road.start.x + dirX * t;
        const baseZ = road.start.z + dirZ * t;

        // Skip lots too close to town center (intersection/plaza area)
        const distFromCenter = dist2D(
          baseX,
          baseZ,
          town.position.x,
          town.position.z,
        );
        if (distFromCenter < intersectionClearance) continue;

        // Check if lot positions would overlap with other roads
        // Snap lot positions to building grid for proper tile alignment
        const leftLotRaw = {
          x: baseX + perpX * SETBACK,
          z: baseZ + perpZ * SETBACK,
        };
        const rightLotRaw = {
          x: baseX - perpX * SETBACK,
          z: baseZ - perpZ * SETBACK,
        };
        const leftLotSnapped = snapToBuildingGrid(leftLotRaw.x, leftLotRaw.z);
        const rightLotSnapped = snapToBuildingGrid(
          rightLotRaw.x,
          rightLotRaw.z,
        );
        const leftLotX = leftLotSnapped.x;
        const leftLotZ = leftLotSnapped.z;
        const rightLotX = rightLotSnapped.x;
        const rightLotZ = rightLotSnapped.z;

        // Check left lot against all roads
        const leftClear = this.isBuildingClearOfRoads(
          leftLotX,
          leftLotZ,
          MAX_BUILDING_HALF_DEPTH,
          internalRoads,
          ROAD_HALF_WIDTH + BUILDING_PADDING,
        );

        if (leftClear) {
          lots.push({
            x: leftLotX,
            z: leftLotZ,
            facingAngle: facingLeft,
            distanceFromCenter: distFromCenter,
            roadIndex,
          });
        }

        // Check right lot against all roads
        const rightClear = this.isBuildingClearOfRoads(
          rightLotX,
          rightLotZ,
          MAX_BUILDING_HALF_DEPTH,
          internalRoads,
          ROAD_HALF_WIDTH + BUILDING_PADDING,
        );

        if (rightClear) {
          lots.push({
            x: rightLotX,
            z: rightLotZ,
            facingAngle: facingRight,
            distanceFromCenter: distFromCenter,
            roadIndex,
          });
        }
      }
    }

    // Remove overlapping lots
    const filteredLots = this.removeOverlappingLots(
      lots,
      TOWN_CONSTANTS.LOT_WIDTH * 0.85,
    );

    return filteredLots;
  }

  /**
   * Check if a building position is clear of all roads
   * Uses simple distance check (building center to road)
   */
  private isBuildingClearOfRoads(
    buildingX: number,
    buildingZ: number,
    buildingHalfSize: number,
    roads: TownInternalRoad[],
    minClearance: number,
  ): boolean {
    const requiredDistance = buildingHalfSize + minClearance;

    for (const road of roads) {
      const dist = this.distanceToSegment(
        buildingX,
        buildingZ,
        road.start.x,
        road.start.z,
        road.end.x,
        road.end.z,
      );
      if (dist < requiredDistance) {
        return false;
      }
    }
    return true;
  }

  /**
   * Distance from point to line segment
   */
  private distanceToSegment(
    px: number,
    pz: number,
    ax: number,
    az: number,
    bx: number,
    bz: number,
  ): number {
    const closest = this.closestPointOnSegment(px, pz, ax, az, bx, bz);
    return dist2D(px, pz, closest.x, closest.z);
  }

  /**
   * Remove lots that overlap with each other
   */
  private removeOverlappingLots<T extends { x: number; z: number }>(
    lots: T[],
    minSpacing: number,
  ): T[] {
    const kept: T[] = [];

    for (const lot of lots) {
      const overlaps = kept.some(
        (existing) => dist2D(lot.x, lot.z, existing.x, existing.z) < minSpacing,
      );
      if (!overlaps) {
        kept.push(lot);
      }
    }

    return kept;
  }

  /**
   * Generate radial lots when no roads exist (fallback for small hamlets)
   * Buildings are placed in rings around the town center, facing inward.
   * All buildings are NESW aligned (0°, 90°, 180°, 270°) for proper grid navigation.
   */
  private generateRadialLots(town: GeneratedTown): Array<{
    x: number;
    z: number;
    facingAngle: number;
    distanceFromCenter: number;
    roadIndex: number;
  }> {
    const lots: Array<{
      x: number;
      z: number;
      facingAngle: number;
      distanceFromCenter: number;
      roadIndex: number;
    }> = [];

    const sizeConfig = this.config.townSizes[town.size];

    // Simple radial arrangement for hamlets
    const ringRadii = [12, 22, 32];
    const lotsPerRing = [4, 6, 8];

    for (let ring = 0; ring < ringRadii.length; ring++) {
      const radius = ringRadii[ring];
      if (radius > sizeConfig.radius) break;

      const numLots = lotsPerRing[ring];
      const angleOffset = ring * 0.3; // Stagger rings

      for (let i = 0; i < numLots; i++) {
        const angle = (i / numLots) * Math.PI * 2 + angleOffset;
        const rawX = town.position.x + Math.cos(angle) * radius;
        const rawZ = town.position.z + Math.sin(angle) * radius;

        // Snap to building grid for proper tile alignment
        const snapped = snapToBuildingGrid(rawX, rawZ);
        const x = snapped.x;
        const z = snapped.z;

        // Face toward center, but snap to nearest NESW direction
        // Direction toward center is (centerX - x, centerZ - z)
        const towardCenterX = town.position.x - x;
        const towardCenterZ = town.position.z - z;
        // Three.js: to face direction (fx, fz), rotation = atan2(fx, fz)
        const rawFacingAngle = Math.atan2(towardCenterX, towardCenterZ);

        // Snap to nearest 90° increment (0, π/2, π, 3π/2 radians)
        // This ensures buildings are NESW aligned for proper grid navigation
        const facingAngle =
          Math.round(rawFacingAngle / (Math.PI / 2)) * (Math.PI / 2);

        lots.push({
          x,
          z,
          facingAngle,
          distanceFromCenter: radius,
          roadIndex: -1,
        });
      }
    }

    return lots;
  }

  // ============================================================
  // PLAZA GENERATION
  // ============================================================

  /**
   * Generate central plaza/public square
   */
  private generatePlaza(town: GeneratedTown): TownPlaza | undefined {
    // Only villages and towns get plazas
    if (town.size === "hamlet") return undefined;

    const plazaRadius = town.size === "town" ? 8 : 5;
    const shape = town.layoutType === "crossroads" ? "octagon" : "circle";
    const material = town.size === "town" ? "cobblestone" : "dirt";

    return {
      position: { x: town.position.x, z: town.position.z },
      radius: plazaRadius,
      shape,
      material,
    };
  }

  // ============================================================
  // PATH GENERATION - WALKWAYS TO BUILDING ENTRANCES
  // ============================================================

  /**
   * Generate perpendicular walkways from roads to building entrances.
   * Uses building's assigned road when available, otherwise finds closest road.
   */
  private generatePaths(town: GeneratedTown): TownPath[] {
    const paths: TownPath[] = [];
    const roads = town.internalRoads ?? [];
    if (roads.length === 0) return paths;

    for (const building of town.buildings) {
      if (!building.entrance) continue;

      // Find road connection point (perpendicular projection of building onto road)
      const roadPoint = this.findRoadConnectionPoint(building, roads);
      if (!roadPoint) continue;

      // Calculate direction from road to building
      const dx = building.position.x - roadPoint.x;
      const dz = building.position.z - roadPoint.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Skip if building is too close to road
      if (dist < 2) continue;

      // Normalize and offset by road half-width
      const dirX = dx / dist;
      const dirZ = dz / dist;
      const pathStartX = roadPoint.x + dirX * TOWN_CONSTANTS.ROAD_HALF_WIDTH;
      const pathStartZ = roadPoint.z + dirZ * TOWN_CONSTANTS.ROAD_HALF_WIDTH;

      // Validate path length
      const pathLength = dist2D(
        pathStartX,
        pathStartZ,
        building.entrance.x,
        building.entrance.z,
      );
      if (pathLength < 0.5 || pathLength > 30) continue;

      paths.push({
        start: { x: pathStartX, z: pathStartZ },
        end: { x: building.entrance.x, z: building.entrance.z },
        width: TOWN_CONSTANTS.PATH_WIDTH,
        buildingId: building.id,
      });
    }

    return paths;
  }

  /**
   * Find the perpendicular connection point from a building to its road.
   */
  private findRoadConnectionPoint(
    building: TownBuilding,
    roads: TownInternalRoad[],
  ): { x: number; z: number } | null {
    const { x, z } = building.position;

    // Use assigned road if valid
    if (
      building.roadId !== undefined &&
      building.roadId >= 0 &&
      building.roadId < roads.length
    ) {
      const road = roads[building.roadId];
      return this.closestPointOnSegment(
        x,
        z,
        road.start.x,
        road.start.z,
        road.end.x,
        road.end.z,
      );
    }

    // Fallback: find closest road
    let closest: { x: number; z: number } | null = null;
    let minDist = Infinity;

    for (const road of roads) {
      const point = this.closestPointOnSegment(
        x,
        z,
        road.start.x,
        road.start.z,
        road.end.x,
        road.end.z,
      );
      const d = dist2D(x, z, point.x, point.z);
      if (d < minDist) {
        minDist = d;
        closest = point;
      }
    }

    return closest;
  }

  /**
   * Find closest point on a line segment to a given point
   */
  private closestPointOnSegment(
    px: number,
    pz: number,
    ax: number,
    az: number,
    bx: number,
    bz: number,
  ): { x: number; z: number } {
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSq = dx * dx + dz * dz;

    if (lengthSq === 0) return { x: ax, z: az };

    const t = Math.max(
      0,
      Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSq),
    );
    return {
      x: ax + t * dx,
      z: az + t * dz,
    };
  }

  // ============================================================
  // LANDMARK GENERATION - WELLS, BENCHES, LAMPPOSTS, ETC.
  // ============================================================

  /**
   * Generate town landmarks and decorations
   */
  private generateLandmarks(town: GeneratedTown): TownLandmark[] {
    const landmarks: TownLandmark[] = [];
    let landmarkIndex = 0;
    const landmarkConfig = this.config.landmarks;

    // Central well or fountain
    const centerLandmark = this.generateCenterLandmark(town, landmarkIndex++);
    if (centerLandmark) landmarks.push(centerLandmark);

    // Signposts at entry points
    const signposts = this.generateSignposts(town, landmarkIndex);
    landmarks.push(...signposts);
    landmarkIndex += signposts.length;

    // Building signs on commercial/civic buildings
    const buildingSigns = this.generateBuildingSigns(town, landmarkIndex);
    landmarks.push(...buildingSigns);
    landmarkIndex += buildingSigns.length;

    // Benches near plaza (villages and towns)
    if (town.size !== "hamlet" && town.plaza) {
      const benches = this.generateBenches(town, landmarkIndex);
      landmarks.push(...benches);
      landmarkIndex += benches.length;
    }

    // Lampposts along roads (towns always, villages if enabled)
    const enableLampposts =
      town.size === "town" ||
      (town.size === "village" && landmarkConfig.lamppostsInVillages);
    if (enableLampposts) {
      const lampposts = this.generateLampposts(town, landmarkIndex);
      landmarks.push(...lampposts);
      landmarkIndex += lampposts.length;
    }

    // Market stalls (towns only, along main street)
    if (town.size === "town" && landmarkConfig.marketStallsEnabled) {
      const stalls = this.generateMarketStalls(town, landmarkIndex);
      landmarks.push(...stalls);
      landmarkIndex += stalls.length;
    }

    // Fences around building lots (villages and towns, if enabled)
    if (town.size !== "hamlet" && landmarkConfig.fencesEnabled) {
      const fences = this.generateFences(town, landmarkIndex);
      landmarks.push(...fences);
      landmarkIndex += fences.length;
    }

    // Decorative elements (barrels, crates, planters)
    if (landmarkConfig.decorationsEnabled) {
      const decorations = this.generateDecorations(town, landmarkIndex);
      landmarks.push(...decorations);
    }

    return landmarks;
  }

  private generateCenterLandmark(
    town: GeneratedTown,
    index: number,
  ): TownLandmark | undefined {
    const y = this.terrain.getHeightAt(town.position.x, town.position.z);

    // Towns get fountains, villages and hamlets get wells
    const type: TownLandmarkType = town.size === "town" ? "fountain" : "well";
    const size =
      type === "fountain"
        ? { width: 4.2, depth: 4.2, height: 2.5 } // 4m diameter fountain
        : { width: 2.2, depth: 2.2, height: 3 }; // 2m diameter well with roof

    return {
      id: `${town.id}_landmark_${index}`,
      type,
      position: { x: town.position.x, y, z: town.position.z },
      rotation: this.random() * Math.PI * 2,
      size,
    };
  }

  private generateSignposts(
    town: GeneratedTown,
    startIndex: number,
  ): TownLandmark[] {
    const signposts: TownLandmark[] = [];
    const entryPoints = town.entryPoints ?? [];

    for (let i = 0; i < entryPoints.length; i++) {
      const entry = entryPoints[i];
      // Offset signpost slightly inside town from entry point
      const inwardDist = 5;
      const dx = town.position.x - entry.position.x;
      const dz = town.position.z - entry.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);

      if (len > 0) {
        const x = entry.position.x + (dx / len) * inwardDist;
        const z = entry.position.z + (dz / len) * inwardDist;
        const y = this.terrain.getHeightAt(x, z);

        signposts.push({
          id: `${town.id}_landmark_${startIndex + i}`,
          type: "signpost",
          position: { x, y, z },
          rotation: entry.angle + Math.PI, // Face outward
          size: { width: 0.5, depth: 0.5, height: 2.6 },
          // Metadata will be populated with destination after roads are generated
          // Store entry point index for later matching with road connections
          metadata: {
            cornerIndex: i, // Entry point index for road matching
          },
        });
      }
    }

    return signposts;
  }

  /**
   * Generate hanging signs on building facades.
   * Commercial and civic buildings get signs that players can click to read.
   * Signs are placed near the building entrance, facing the road.
   */
  private generateBuildingSigns(
    town: GeneratedTown,
    startIndex: number,
  ): TownLandmark[] {
    const signs: TownLandmark[] = [];

    // Building types that should have signs
    const signTypes = new Set([
      "bank",
      "store",
      "inn",
      "smithy",
      "church",
      "cathedral",
      "chapel",
      "keep",
      "fortress",
      "castle",
      "guild-hall",
      "town-hall",
      "mansion",
      "manor",
    ]);

    // Human-readable names for building signs
    const signNames: Record<string, string> = {
      bank: "Bank",
      store: "General Store",
      inn: "The Traveller's Rest",
      smithy: "Smithy & Forge",
      church: "Church",
      cathedral: "Cathedral",
      chapel: "Chapel",
      keep: "The Keep",
      fortress: "Fortress",
      castle: "Castle",
      "guild-hall": "Guild Hall",
      "town-hall": "Town Hall",
      mansion: "Manor Estate",
      manor: "Manor House",
    };

    let index = 0;
    for (const building of town.buildings) {
      if (!signTypes.has(building.type)) continue;

      // Place the sign near the entrance, offset slightly to the side
      // The sign hangs on the wall next to the door
      const entrance = building.entrance;
      if (!entrance) continue;

      // Direction from building center to entrance
      const dx = entrance.x - building.position.x;
      const dz = entrance.z - building.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.1) continue;

      // Position the sign slightly to the side of the entrance
      // (perpendicular to the entrance direction)
      const perpX = -dz / len;
      const perpZ = dx / len;
      const signOffset = 1.2; // Offset from entrance along the wall
      const wallOffset = 0.3; // Slight offset from wall face

      const signX = entrance.x + perpX * signOffset + (dx / len) * wallOffset;
      const signZ = entrance.z + perpZ * signOffset + (dz / len) * wallOffset;
      const signY = this.terrain.getHeightAt(signX, signZ);

      // Sign faces outward (same direction as the entrance faces)
      const signRotation = Math.atan2(dx, dz);

      signs.push({
        id: `${town.id}_landmark_${startIndex + index}`,
        type: "building_sign",
        position: { x: signX, y: signY, z: signZ },
        rotation: signRotation,
        size: { width: 0.6, depth: 0.1, height: 0.6 },
        metadata: {
          buildingType: building.type,
          buildingName: signNames[building.type] || building.type,
          buildingId: building.id,
        },
      });
      index += 1;
    }

    return signs;
  }

  private generateBenches(
    town: GeneratedTown,
    startIndex: number,
  ): TownLandmark[] {
    const benches: TownLandmark[] = [];
    const plaza = town.plaza;
    if (!plaza) return benches;

    const benchCount = town.size === "town" ? 4 : 2;
    const benchRadius = plaza.radius + 3; // Moved further out from plaza edge
    const roads = town.internalRoads ?? [];

    let benchIndex = 0;
    // Place benches at 45-degree angles (between roads which are at 0/90/180/270)
    const benchAngles = [
      Math.PI / 4,
      (Math.PI * 3) / 4,
      (Math.PI * 5) / 4,
      (Math.PI * 7) / 4,
    ];

    for (let i = 0; i < benchAngles.length && benchIndex < benchCount; i++) {
      const angle = benchAngles[i];
      const x = plaza.position.x + Math.cos(angle) * benchRadius;
      const z = plaza.position.z + Math.sin(angle) * benchRadius;

      // Skip if too close to a road
      if (!this.isPositionClearOfRoads(x, z, roads, 4)) continue;

      const y = this.terrain.getHeightAt(x, z);

      benches.push({
        id: `${town.id}_landmark_${startIndex + benchIndex}`,
        type: "bench",
        position: { x, y, z },
        rotation: angle + Math.PI / 2, // Face toward plaza
        size: { width: 1.5, depth: 0.5, height: 0.8 },
      });
      benchIndex++;
    }

    return benches;
  }

  private generateLampposts(
    town: GeneratedTown,
    startIndex: number,
  ): TownLandmark[] {
    const lampposts: TownLandmark[] = [];
    const roads = town.internalRoads ?? [];
    const landmarkConfig = this.config.landmarks;

    // Get all roads to place lampposts on (main road for villages, all roads for towns)
    const roadsToLight =
      town.size === "town" ? roads : roads.filter((r) => r.isMain);

    if (roadsToLight.length === 0) return lampposts;

    const roadWidth = 5;
    // Adjust spacing based on town size (villages get sparser lampposts)
    const baseSpacing = landmarkConfig.lamppostSpacing;
    const lampSpacing =
      town.size === "village" ? baseSpacing * 1.5 : baseSpacing;
    const lampOffset = roadWidth / 2 + 1;

    let lampIndex = 0;

    for (const road of roadsToLight) {
      const dx = road.end.x - road.start.x;
      const dz = road.end.z - road.start.z;
      const length = Math.sqrt(dx * dx + dz * dz);

      if (length < lampSpacing) continue;

      const dirX = dx / length;
      const dirZ = dz / length;
      const perpX = -dirZ;
      const perpZ = dirX;

      const numLamps = Math.floor(length / lampSpacing);

      for (let i = 1; i < numLamps; i++) {
        const t = i * lampSpacing;
        const baseX = road.start.x + dirX * t;
        const baseZ = road.start.z + dirZ * t;

        // Skip lamps too close to center (plaza area)
        const centerDist = dist2D(
          baseX,
          baseZ,
          town.position.x,
          town.position.z,
        );
        if (centerDist < 8) continue;

        // For villages, skip some lamps for a sparser feel
        if (town.size === "village" && this.random() > 0.7) continue;

        // Alternate sides
        const side = i % 2 === 0 ? 1 : -1;
        const x = baseX + perpX * lampOffset * side;
        const z = baseZ + perpZ * lampOffset * side;
        const y = this.terrain.getHeightAt(x, z);

        lampposts.push({
          id: `${town.id}_landmark_${startIndex + lampIndex}`,
          type: "lamppost",
          position: { x, y, z },
          rotation: 0,
          size: { width: 0.35, depth: 0.35, height: 4.1 },
        });
        lampIndex++;
      }
    }

    return lampposts;
  }

  private generateMarketStalls(
    town: GeneratedTown,
    startIndex: number,
  ): TownLandmark[] {
    const stalls: TownLandmark[] = [];
    const plaza = town.plaza;
    if (!plaza) return stalls;

    const roads = town.internalRoads ?? [];

    // Place 2-3 market stalls at diagonal corners of plaza (away from roads)
    const stallCount = 2 + Math.floor(this.random() * 2);
    const stallRadius = plaza.radius + 5; // Further from plaza center

    // Diagonal angles (between roads)
    const stallAngles = [
      Math.PI / 4,
      (Math.PI * 3) / 4,
      (Math.PI * 5) / 4,
      (Math.PI * 7) / 4,
    ];
    let stallIndex = 0;

    for (let i = 0; i < stallAngles.length && stallIndex < stallCount; i++) {
      const angle = stallAngles[i] + (this.random() - 0.5) * 0.2; // Small random offset
      const x = plaza.position.x + Math.cos(angle) * stallRadius;
      const z = plaza.position.z + Math.sin(angle) * stallRadius;

      // Skip if too close to a road
      if (!this.isPositionClearOfRoads(x, z, roads, 5)) continue;

      const y = this.terrain.getHeightAt(x, z);

      stalls.push({
        id: `${town.id}_landmark_${startIndex + stallIndex}`,
        type: "market_stall",
        position: { x, y, z },
        rotation: angle + Math.PI, // Face plaza
        size: { width: 3.2, depth: 1.4, height: 2.4 },
      });
      stallIndex++;
    }

    return stalls;
  }

  private generateDecorations(
    town: GeneratedTown,
    startIndex: number,
  ): TownLandmark[] {
    const decorations: TownLandmark[] = [];
    const decorTypes: TownLandmarkType[] = ["barrel", "crate", "planter"];

    // Place decorations near buildings (on the side away from road)
    const maxDecorations =
      town.size === "town" ? 12 : town.size === "village" ? 6 : 3;
    let decorIndex = 0;

    for (const building of town.buildings) {
      if (decorIndex >= maxDecorations) break;
      if (this.random() > 0.5) continue; // 50% chance per building

      // Place decoration on side of building (perpendicular to facing direction)
      // This keeps it away from the entrance and road
      const sideAngle =
        building.rotation + (this.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const offsetDist = building.size.width / 2 + 1.5;
      const x = building.position.x + Math.cos(sideAngle) * offsetDist;
      const z = building.position.z + Math.sin(sideAngle) * offsetDist;

      // Check if this position is clear of roads
      if (!this.isPositionClearOfRoads(x, z, town.internalRoads ?? [], 4))
        continue;

      const y = this.terrain.getHeightAt(x, z);

      const decorType =
        decorTypes[Math.floor(this.random() * decorTypes.length)];
      const size =
        decorType === "planter"
          ? { width: 0.75, depth: 0.75, height: 0.8 } // Planter with flowers
          : decorType === "barrel"
            ? { width: 0.58, depth: 0.58, height: 1.0 } // Wooden barrel
            : { width: 0.72, depth: 0.58, height: 0.58 }; // Wooden crate

      decorations.push({
        id: `${town.id}_landmark_${startIndex + decorIndex}`,
        type: decorType,
        position: { x, y, z },
        rotation: this.random() * Math.PI * 2,
        size,
      });
      decorIndex++;
    }

    return decorations;
  }

  /**
   * Generate fence posts around building lots
   * Fences are placed at the corners and edges of building properties
   */
  private generateFences(
    town: GeneratedTown,
    startIndex: number,
  ): TownLandmark[] {
    const fences: TownLandmark[] = [];
    const roads = town.internalRoads ?? [];
    const paths = town.paths ?? [];
    const landmarkConfig = this.config.landmarks;
    const fencePostHeight = landmarkConfig.fencePostHeight;
    const fenceDensity = landmarkConfig.fenceDensity;

    let fenceIndex = 0;

    // For each building, place fence posts around its lot boundary
    for (const building of town.buildings) {
      // Get building dimensions with some padding for the "lot"
      const lotPadding = 2; // 2m padding around building for lot boundary
      const halfWidth = building.size.width / 2 + lotPadding;
      const halfDepth = building.size.depth / 2 + lotPadding;

      // Calculate lot corners based on building rotation
      const cos = Math.cos(building.rotation);
      const sin = Math.sin(building.rotation);

      // Define corner offsets (relative to building center)
      const corners = [
        { dx: -halfWidth, dz: -halfDepth }, // Back-left
        { dx: halfWidth, dz: -halfDepth }, // Back-right
        { dx: halfWidth, dz: halfDepth }, // Front-right
        { dx: -halfWidth, dz: halfDepth }, // Front-left
      ];

      // Rotate corners to match building rotation
      const worldCorners = corners.map((c) => ({
        x: building.position.x + c.dx * cos - c.dz * sin,
        z: building.position.z + c.dx * sin + c.dz * cos,
      }));

      // Place fence posts at corners (with probability based on density)
      for (let i = 0; i < worldCorners.length; i++) {
        const corner = worldCorners[i];
        const nextCorner = worldCorners[(i + 1) % worldCorners.length];

        // Skip posts near roads (front of building)
        if (!this.isPositionClearOfRoads(corner.x, corner.z, roads, 5))
          continue;

        // Skip posts that would block paths
        if (this.isPositionOnPath(corner.x, corner.z, paths, 2)) continue;

        // Apply fence density probability
        if (this.random() > fenceDensity) continue;

        const y = this.terrain.getHeightAt(corner.x, corner.z);

        // Calculate rotation to face along fence line
        const dx = nextCorner.x - corner.x;
        const dz = nextCorner.z - corner.z;
        const fenceAngle = Math.atan2(dx, dz);

        fences.push({
          id: `${town.id}_landmark_${startIndex + fenceIndex}`,
          type: "fence_post",
          position: { x: corner.x, y, z: corner.z },
          rotation: fenceAngle,
          size: { width: 0.15, depth: 0.15, height: fencePostHeight },
          metadata: {
            lotBuildingId: building.id,
            cornerIndex: i,
          },
        });
        fenceIndex++;

        // Add intermediate fence posts along edges (not front edge near road)
        // Only for side and back edges
        const edgeLength = dist2D(
          corner.x,
          corner.z,
          nextCorner.x,
          nextCorner.z,
        );
        const postSpacing = 3; // 3m between posts

        if (edgeLength > postSpacing * 1.5) {
          const numIntermediatePosts = Math.floor(edgeLength / postSpacing) - 1;
          for (let j = 1; j <= numIntermediatePosts; j++) {
            const t = j / (numIntermediatePosts + 1);
            const px = corner.x + dx * t;
            const pz = corner.z + dz * t;

            // Check if this intermediate post would be clear of roads
            if (!this.isPositionClearOfRoads(px, pz, roads, 5)) continue;
            if (this.isPositionOnPath(px, pz, paths, 2)) continue;

            // Apply density check for intermediate posts too
            if (this.random() > fenceDensity) continue;

            const py = this.terrain.getHeightAt(px, pz);

            fences.push({
              id: `${town.id}_landmark_${startIndex + fenceIndex}`,
              type: "fence_post",
              position: { x: px, y: py, z: pz },
              rotation: fenceAngle,
              size: { width: 0.15, depth: 0.15, height: fencePostHeight },
              metadata: {
                lotBuildingId: building.id,
              },
            });
            fenceIndex++;
          }
        }
      }

      // Note: Gates are not placed at entrances because:
      // 1. Fences only go on sides/back of lots (away from roads)
      // 2. Building entrances face the road where there's no fence
      // Gates could be added if side/back paths are implemented
    }

    return fences;
  }

  /**
   * Check if a position is on or near a path
   */
  private isPositionOnPath(
    x: number,
    z: number,
    paths: TownPath[],
    minDistance: number,
  ): boolean {
    for (const path of paths) {
      const dist = this.distanceToSegment(
        x,
        z,
        path.start.x,
        path.start.z,
        path.end.x,
        path.end.z,
      );
      if (dist < minDistance + path.width / 2) return true;
    }
    return false;
  }

  /**
   * Check if a position is clear of all roads
   */
  private isPositionClearOfRoads(
    x: number,
    z: number,
    roads: TownInternalRoad[],
    minDistance: number,
  ): boolean {
    for (const road of roads) {
      const dist = this.distanceToSegment(
        x,
        z,
        road.start.x,
        road.start.z,
        road.end.x,
        road.end.z,
      );
      if (dist < minDistance) return false;
    }
    return true;
  }

  // ============================================================
  // ROAD TRIMMING - ONLY EXTEND ROADS TO BUILDINGS
  // ============================================================

  /**
   * Trim roads to only extend as far as the outermost buildings.
   * Removes roads with no buildings, shortens roads to match building extent.
   */
  private trimRoadsToBuildings(town: GeneratedTown): void {
    const roads = town.internalRoads;
    const buildings = town.buildings;
    const entryPoints = town.entryPoints;

    if (!roads || roads.length === 0 || buildings.length === 0) return;

    const roadPadding = 8; // How far past the last building the road should extend
    const minRoadLength = 10; // Minimum road length to keep
    const trimmedRoads: TownInternalRoad[] = [];
    const trimmedEntryPoints: TownEntryPoint[] = [];

    for (let roadIndex = 0; roadIndex < roads.length; roadIndex++) {
      const road = roads[roadIndex];

      // Find buildings along this road (within reasonable distance)
      const roadDx = road.end.x - road.start.x;
      const roadDz = road.end.z - road.start.z;
      const roadLength = Math.sqrt(roadDx * roadDx + roadDz * roadDz);

      if (roadLength < 1) continue;

      const dirX = roadDx / roadLength;
      const dirZ = roadDz / roadLength;

      // Find min and max t values for buildings along this road
      let minT = Infinity;
      let maxT = -Infinity;
      let hasBuildingsOnRoad = false;

      for (const building of buildings) {
        // Check if this building is associated with this road
        if (building.roadId !== roadIndex) continue;

        // Project building position onto road
        const bx = building.position.x - road.start.x;
        const bz = building.position.z - road.start.z;
        const t = bx * dirX + bz * dirZ;

        minT = Math.min(minT, t);
        maxT = Math.max(maxT, t);
        hasBuildingsOnRoad = true;
      }

      // If no buildings on this road, check if it's the main road
      // Main roads should at least go through the town center
      if (!hasBuildingsOnRoad) {
        if (road.isMain) {
          // Keep main road but trim to just past center
          const centerT = this.projectPointOntoRoad(
            town.position.x,
            town.position.z,
            road.start.x,
            road.start.z,
            dirX,
            dirZ,
          );
          minT = centerT - minRoadLength;
          maxT = centerT + minRoadLength;
        } else {
          // Skip non-main roads with no buildings
          continue;
        }
      }

      // Add padding
      minT = Math.max(0, minT - roadPadding);
      maxT = Math.min(roadLength, maxT + roadPadding);

      // Ensure minimum road length
      if (maxT - minT < minRoadLength) {
        const center = (minT + maxT) / 2;
        minT = center - minRoadLength / 2;
        maxT = center + minRoadLength / 2;
      }

      // Create trimmed road
      const newStart = {
        x: road.start.x + dirX * minT,
        z: road.start.z + dirZ * minT,
      };
      const newEnd = {
        x: road.start.x + dirX * maxT,
        z: road.start.z + dirZ * maxT,
      };

      trimmedRoads.push({
        start: newStart,
        end: newEnd,
        isMain: road.isMain,
      });

      // Update entry points if they correspond to this road
      if (entryPoints) {
        for (const entry of entryPoints) {
          // Check if this entry point was at the start or end of the original road
          const distToStart = dist2D(
            entry.position.x,
            entry.position.z,
            road.start.x,
            road.start.z,
          );
          const distToEnd = dist2D(
            entry.position.x,
            entry.position.z,
            road.end.x,
            road.end.z,
          );

          if (distToStart < 1) {
            // Entry was at start - update to new start
            trimmedEntryPoints.push({
              angle: entry.angle,
              position: newStart,
            });
          } else if (distToEnd < 1) {
            // Entry was at end - update to new end
            trimmedEntryPoints.push({
              angle: entry.angle,
              position: newEnd,
            });
          }
        }
      }
    }

    town.internalRoads = trimmedRoads;
    if (trimmedEntryPoints.length > 0) {
      town.entryPoints = trimmedEntryPoints;
    }
  }

  /**
   * Project a point onto a road and return the t parameter
   */
  private projectPointOntoRoad(
    px: number,
    pz: number,
    roadStartX: number,
    roadStartZ: number,
    dirX: number,
    dirZ: number,
  ): number {
    const dx = px - roadStartX;
    const dz = pz - roadStartZ;
    return dx * dirX + dz * dirZ;
  }

  // ============================================================
  // MAIN GENERATION METHOD
  // ============================================================

  /**
   * Generate towns procedurally
   * @param existingTowns - Optional array of existing towns to avoid
   * @returns Generation result with towns and statistics
   */
  generate(existingTowns: GeneratedTown[] = []): TownGenerationResult {
    const startTime = performance.now();

    // Generate candidates
    const candidates = this.generateTownCandidates();

    // Select best locations
    const selectedLocations = this.selectTownLocations(
      candidates,
      existingTowns,
    );

    // Generate towns at selected locations
    const towns: GeneratedTown[] = [];

    for (let i = 0; i < selectedLocations.length; i++) {
      const location = selectedLocations[i];
      const centerY = this.terrain.getHeightAt(location.x, location.z);
      const townSize = this.determineTownSize(location.totalScore, i);
      const sizeConfig = this.config.townSizes[townSize];

      const town: GeneratedTown = {
        id: `town_${i}`,
        name: this.generateTownName(i),
        position: { x: location.x, y: centerY, z: location.z },
        size: townSize,
        safeZoneRadius: sizeConfig.safeZoneRadius,
        biome: location.biome,
        buildings: [],
        suitabilityScore: location.totalScore,
        connectedRoads: [],
      };

      // Generate complete town layout and features
      this.generateTownLayout(town);
      town.plaza = this.generatePlaza(town);
      town.buildings = this.generateBuildings(town, i);
      this.trimRoadsToBuildings(town); // Trim roads to only go where buildings exist
      town.paths = this.generatePaths(town);
      town.landmarks = this.generateLandmarks(town);
      towns.push(town);
    }

    // Calculate statistics
    const stats = this.calculateStats(towns, candidates.length, startTime);

    return { towns, stats };
  }

  /**
   * Generate a single town at a specific location
   * Useful for manual town placement or editing
   */
  generateSingleTown(
    x: number,
    z: number,
    size: TownSize,
    options: { id?: string; name?: string; layoutType?: TownLayoutType } = {},
  ): GeneratedTown {
    const centerY = this.terrain.getHeightAt(x, z);
    const biome = this.getBiomeAt(x, z);
    const sizeConfig = this.config.townSizes[size];

    this.resetRandom(this.seed + Math.floor(x * 1000 + z));

    const town: GeneratedTown = {
      id: options.id ?? `town_custom_${Date.now()}`,
      name: options.name ?? this.generateTownName(Math.floor(x + z)),
      position: { x, y: centerY, z },
      size,
      safeZoneRadius: sizeConfig.safeZoneRadius,
      biome,
      buildings: [],
      suitabilityScore: 1.0,
      connectedRoads: [],
    };

    // Generate complete town layout and features
    this.generateTownLayout(town, options.layoutType);
    town.plaza = this.generatePlaza(town);
    town.buildings = this.generateBuildings(town, 0);
    this.trimRoadsToBuildings(town); // Trim roads to only go where buildings exist
    town.paths = this.generatePaths(town);
    town.landmarks = this.generateLandmarks(town);
    return town;
  }

  private calculateStats(
    towns: GeneratedTown[],
    candidatesEvaluated: number,
    startTime: number,
  ): TownGenerationStats {
    const stats: TownGenerationStats = {
      totalTowns: towns.length,
      hamlets: 0,
      villages: 0,
      towns: 0,
      totalBuildings: 0,
      buildingCounts: {
        bank: 0,
        store: 0,
        anvil: 0,
        well: 0,
        house: 0,
        inn: 0,
        smithy: 0,
        "simple-house": 0,
        "long-house": 0,
        church: 0,
        cathedral: 0,
        chapel: 0,
        keep: 0,
        fortress: 0,
        castle: 0,
        "guild-hall": 0,
        "town-hall": 0,
        mansion: 0,
        manor: 0,
      },
      candidatesEvaluated,
      generationTime: performance.now() - startTime,
    };

    for (const town of towns) {
      if (town.size === "hamlet") stats.hamlets++;
      else if (town.size === "village") stats.villages++;
      else stats.towns++;

      stats.totalBuildings += town.buildings.length;
      for (const building of town.buildings) {
        stats.buildingCounts[building.type]++;
      }
    }

    return stats;
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Update terrain provider
   */
  setTerrain(terrain: TerrainProvider): void {
    this.terrain = terrain;
  }

  /**
   * Update noise provider
   */
  setNoise(noise: NoiseProvider): void {
    this.noise = noise;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<TownGeneratorConfig>): void {
    this.config = this.mergeConfig(config);
  }

  /**
   * Get current configuration
   */
  getConfig(): TownGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Reset random seed
   */
  setSeed(seed: number): void {
    this.seed = seed;
    this.randomState = seed;
  }

  // ============================================================
  // VALIDATION - Verify town generation is correct
  // ============================================================

  /**
   * Validate a generated town for common issues
   * Returns list of validation errors (empty = valid)
   */
  validateTown(town: GeneratedTown): TownValidationError[] {
    const errors: TownValidationError[] = [];
    const buildings = town.buildings;
    const roads = town.internalRoads ?? [];
    const paths = town.paths ?? [];
    const landmarks = town.landmarks ?? [];

    // Rule 1: No building-building overlap
    for (let i = 0; i < buildings.length; i++) {
      for (let j = i + 1; j < buildings.length; j++) {
        const a = buildings[i];
        const b = buildings[j];
        if (
          boxesOverlap(
            a.position.x,
            a.position.z,
            a.size.width,
            a.size.depth,
            a.rotation,
            b.position.x,
            b.position.z,
            b.size.width,
            b.size.depth,
            b.rotation,
            TOWN_CONSTANTS.MIN_BUILDING_SPACING,
          )
        ) {
          errors.push({
            type: "building_overlap",
            message: `Buildings ${a.id} and ${b.id} overlap`,
            entities: [a.id, b.id],
          });
        }
      }
    }

    // Rule 2: No building-road overlap
    for (const building of buildings) {
      const buildingRadius =
        Math.max(building.size.width, building.size.depth) / 2;
      for (const road of roads) {
        const dist = this.distanceToSegment(
          building.position.x,
          building.position.z,
          road.start.x,
          road.start.z,
          road.end.x,
          road.end.z,
        );
        const minDist = buildingRadius + TOWN_CONSTANTS.ROAD_HALF_WIDTH + 1;
        if (dist < minDist) {
          errors.push({
            type: "building_road_overlap",
            message: `Building ${building.id} overlaps with road (dist=${dist.toFixed(1)}m, min=${minDist.toFixed(1)}m)`,
            entities: [building.id],
          });
        }
      }
    }

    // Rule 3: All buildings have entrances
    for (const building of buildings) {
      if (!building.entrance) {
        errors.push({
          type: "missing_entrance",
          message: `Building ${building.id} has no entrance`,
          entities: [building.id],
        });
      }
    }

    // Rule 4: Paths don't cross other buildings
    for (const path of paths) {
      for (const building of buildings) {
        if (building.id === path.buildingId) continue; // Skip the building this path leads to

        const buildingRadius =
          Math.max(building.size.width, building.size.depth) / 2;
        if (
          lineIntersectsCircle(
            path.start.x,
            path.start.z,
            path.end.x,
            path.end.z,
            building.position.x,
            building.position.z,
            buildingRadius,
          )
        ) {
          errors.push({
            type: "path_building_intersection",
            message: `Path to ${path.buildingId} crosses building ${building.id}`,
            entities: [path.buildingId, building.id],
          });
        }
      }
    }

    // Rule 5: Landmarks don't overlap buildings
    for (const landmark of landmarks) {
      const landmarkRadius =
        Math.max(landmark.size.width, landmark.size.depth) / 2;
      for (const building of buildings) {
        const buildingRadius =
          Math.max(building.size.width, building.size.depth) / 2;
        const dist = dist2D(
          landmark.position.x,
          landmark.position.z,
          building.position.x,
          building.position.z,
        );
        if (dist < landmarkRadius + buildingRadius + 1) {
          errors.push({
            type: "landmark_building_overlap",
            message: `Landmark ${landmark.id} overlaps building ${building.id}`,
            entities: [landmark.id, building.id],
          });
        }
      }
    }

    // Rule 6: Roads have reasonable length
    for (let i = 0; i < roads.length; i++) {
      const road = roads[i];
      const length = dist2D(road.start.x, road.start.z, road.end.x, road.end.z);
      if (length < TOWN_CONSTANTS.MIN_ROAD_LENGTH) {
        errors.push({
          type: "road_too_short",
          message: `Road ${i} is only ${length.toFixed(1)}m (min=${TOWN_CONSTANTS.MIN_ROAD_LENGTH}m)`,
          entities: [`road_${i}`],
        });
      }
    }

    // Rule 7: Town has minimum buildings for its size
    const minBuildings = this.config.townSizes[town.size].buildingCount.min;
    if (buildings.length < minBuildings) {
      errors.push({
        type: "insufficient_buildings",
        message: `Town has ${buildings.length} buildings, needs at least ${minBuildings}`,
        entities: [],
      });
    }

    return errors;
  }

  /**
   * Get validation summary for a town
   */
  getValidationSummary(town: GeneratedTown): TownValidationSummary {
    const errors = this.validateTown(town);
    return {
      isValid: errors.length === 0,
      errorCount: errors.length,
      errors,
      stats: {
        buildingCount: town.buildings.length,
        roadCount: town.internalRoads?.length ?? 0,
        pathCount: town.paths?.length ?? 0,
        landmarkCount: town.landmarks?.length ?? 0,
      },
    };
  }
}

// ============================================================
// VALIDATION TYPES
// ============================================================

export interface TownValidationError {
  type:
    | "building_overlap"
    | "building_road_overlap"
    | "missing_entrance"
    | "path_building_intersection"
    | "landmark_building_overlap"
    | "road_too_short"
    | "insufficient_buildings";
  message: string;
  entities: string[];
}

export interface TownValidationSummary {
  isValid: boolean;
  errorCount: number;
  errors: TownValidationError[];
  stats: {
    buildingCount: number;
    roadCount: number;
    pathCount: number;
    landmarkCount: number;
  };
}

/**
 * Default town generator instance
 */
export const defaultTownGenerator = new TownGenerator();

/**
 * Export constants for external use
 */
export { TOWN_CONSTANTS };
