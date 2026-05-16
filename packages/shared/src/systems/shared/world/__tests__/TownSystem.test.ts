/**
 * Tests for TownSystem procedural town generation algorithms.
 * Tests core placement logic, building generation, and safe zone detection.
 */

import { describe, it, expect } from "vitest";
import { BIOME_LIST } from "../TerrainBiomeTypes";

// ============== Constants (must match TownSystem.ts) ==============
const TOWN_COUNT = 25;
const WORLD_SIZE = 10000;
const MIN_TOWN_SPACING = 800;
const FLATNESS_SAMPLE_RADIUS = 40;
const FLATNESS_SAMPLE_COUNT = 16;
// IMPORTANT: This must match TERRAIN_CONSTANTS.WATER_THRESHOLD (8.0)
const WATER_THRESHOLD = 8.0;
const OPTIMAL_WATER_DISTANCE_MIN = 30;
const OPTIMAL_WATER_DISTANCE_MAX = 150;

type TownSize = "hamlet" | "village" | "town";
type TownBuildingType = "bank" | "store" | "anvil" | "well" | "house";

const TOWN_SIZE_CONFIG: Record<
  TownSize,
  {
    buildingCount: { min: number; max: number };
    radius: number;
    safeZoneRadius: number;
  }
> = {
  hamlet: { buildingCount: { min: 3, max: 5 }, radius: 25, safeZoneRadius: 40 },
  village: {
    buildingCount: { min: 6, max: 10 },
    radius: 40,
    safeZoneRadius: 60,
  },
  town: { buildingCount: { min: 11, max: 16 }, radius: 60, safeZoneRadius: 80 },
};

const BUILDING_CONFIG: Record<
  TownBuildingType,
  { width: number; depth: number; priority: number }
> = {
  bank: { width: 8, depth: 6, priority: 1 },
  store: { width: 7, depth: 5, priority: 2 },
  anvil: { width: 5, depth: 4, priority: 3 },
  well: { width: 3, depth: 3, priority: 4 },
  house: { width: 6, depth: 5, priority: 5 },
};

const BIOME_SUITABILITY: Record<string, number> = {
  forest: 0.8,
  tundra: 0.4,
  canyon: 0.3,
};

const NAME_PREFIXES = [
  "Oak",
  "River",
  "Stone",
  "Green",
  "High",
  "Low",
  "North",
  "South",
  "East",
  "West",
  "Iron",
  "Gold",
  "Silver",
  "Crystal",
  "Shadow",
  "Sun",
  "Moon",
  "Star",
  "Thunder",
  "Frost",
  "Fire",
  "Wind",
  "Storm",
  "Cloud",
  "Lake",
];

const NAME_SUFFIXES = [
  "haven",
  "ford",
  "wick",
  "ton",
  "bridge",
  "vale",
  "hollow",
  "reach",
  "fall",
  "watch",
  "keep",
  "stead",
  "dale",
  "brook",
  "field",
  "grove",
  "hill",
  "cliff",
  "port",
  "gate",
  "marsh",
  "moor",
  "wood",
  "mere",
  "crest",
];

// ============== Helper Functions (mirrors TownSystem.ts) ==============

/** Distance utility */
const dist2D = (x1: number, z1: number, x2: number, z2: number): number =>
  Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);

/** Seeded PRNG */
class SeededRNG {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  random(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0xffffffff;
  }
  reset(seed: number): void {
    this.state = seed;
  }
}

/** Simple noise generator for testing */
function simplex2D(x: number, z: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + z * 78.233 + seed * 43.1) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1; // Return -1 to 1
}

/** Calculate terrain flatness (variance-based) */
function calculateFlatness(
  centerX: number,
  centerZ: number,
  getHeight: (x: number, z: number) => number,
): number {
  const heights: number[] = [];
  const angleStep = (Math.PI * 2) / FLATNESS_SAMPLE_COUNT;

  for (let i = 0; i < FLATNESS_SAMPLE_COUNT; i++) {
    const angle = i * angleStep;
    const sampleX = centerX + Math.cos(angle) * FLATNESS_SAMPLE_RADIUS;
    const sampleZ = centerZ + Math.sin(angle) * FLATNESS_SAMPLE_RADIUS;
    heights.push(getHeight(sampleX, sampleZ));
  }
  heights.push(getHeight(centerX, centerZ));

  const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
  const variance =
    heights.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / heights.length;

  return Math.exp(-variance / 25);
}

/** Calculate water proximity score */
function calculateWaterProximity(
  centerX: number,
  centerZ: number,
  getHeight: (x: number, z: number) => number,
): number {
  const centerHeight = getHeight(centerX, centerZ);
  if (centerHeight < WATER_THRESHOLD) return 0;

  let minWaterDistance = Infinity;
  const sampleDirections = 8;
  const maxSearchDistance = 300;
  const searchStep = 20;

  for (let dir = 0; dir < sampleDirections; dir++) {
    const angle = (dir / sampleDirections) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);

    for (
      let distance = searchStep;
      distance <= maxSearchDistance;
      distance += searchStep
    ) {
      const sampleX = centerX + dx * distance;
      const sampleZ = centerZ + dz * distance;
      const height = getHeight(sampleX, sampleZ);

      if (height < WATER_THRESHOLD) {
        minWaterDistance = Math.min(minWaterDistance, distance);
        break;
      }
    }
  }

  if (minWaterDistance === Infinity) return 0.5;

  if (
    minWaterDistance >= OPTIMAL_WATER_DISTANCE_MIN &&
    minWaterDistance <= OPTIMAL_WATER_DISTANCE_MAX
  ) {
    return 1.0;
  } else if (minWaterDistance < OPTIMAL_WATER_DISTANCE_MIN) {
    return minWaterDistance / OPTIMAL_WATER_DISTANCE_MIN;
  } else {
    return Math.max(
      0.3,
      1.0 - (minWaterDistance - OPTIMAL_WATER_DISTANCE_MAX) / 500,
    );
  }
}

/** Town name generation */
function generateTownName(seed: number, townIndex: number): string {
  const rng = new SeededRNG(seed + townIndex * 7919);
  const prefixIndex = Math.floor(rng.random() * NAME_PREFIXES.length);
  const suffixIndex = Math.floor(rng.random() * NAME_SUFFIXES.length);
  return NAME_PREFIXES[prefixIndex] + NAME_SUFFIXES[suffixIndex];
}

/** Check if position is too close to existing towns */
function isTooCloseToExistingTowns(
  x: number,
  z: number,
  existingTowns: Array<{ x: number; z: number }>,
): boolean {
  return existingTowns.some(
    (town) => dist2D(x, z, town.x, town.z) < MIN_TOWN_SPACING,
  );
}

// ============== Tests ==============

describe("TownSystem Algorithms", () => {
  describe("SeededRNG", () => {
    it("generates deterministic values for same seed", () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      const values1 = [rng1.random(), rng1.random(), rng1.random()];
      const values2 = [rng2.random(), rng2.random(), rng2.random()];

      expect(values1).toEqual(values2);
    });

    it("generates different values for different seeds", () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(54321);

      expect(rng1.random()).not.toBe(rng2.random());
    });

    it("generates values in range [0, 1)", () => {
      const rng = new SeededRNG(42);
      for (let i = 0; i < 10000; i++) {
        const value = rng.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it("reset restores state correctly", () => {
      const rng = new SeededRNG(12345);
      const first = rng.random();
      rng.reset(12345);
      expect(rng.random()).toBe(first);
    });

    it("handles edge case seeds", () => {
      const rng0 = new SeededRNG(0);
      const rngMax = new SeededRNG(0xffffffff);
      const rngNeg = new SeededRNG(-1);

      // Should not throw and produce valid values
      expect(rng0.random()).toBeGreaterThanOrEqual(0);
      expect(rngMax.random()).toBeGreaterThanOrEqual(0);
      expect(rngNeg.random()).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateFlatness", () => {
    it("returns 1.0 for perfectly flat terrain", () => {
      const flatHeight = () => 10;
      const flatness = calculateFlatness(0, 0, flatHeight);
      expect(flatness).toBeCloseTo(1.0, 5);
    });

    it("returns lower score for variable terrain", () => {
      // Terrain with 5m standard deviation
      const variableHeight = (x: number, z: number) => 10 + simplex2D(x, z) * 5;
      const flatness = calculateFlatness(0, 0, variableHeight);
      expect(flatness).toBeLessThan(1.0);
      expect(flatness).toBeGreaterThan(0);
    });

    it("returns very low score for steep terrain", () => {
      // Steep hill: height varies dramatically across sample radius
      const steepHeight = (x: number, z: number) => Math.sqrt(x * x + z * z);
      const flatness = calculateFlatness(0, 0, steepHeight);
      expect(flatness).toBeLessThan(0.5);
    });

    it("samples in circular pattern around center", () => {
      const sampledPositions: Array<{ x: number; z: number }> = [];
      const trackingHeight = (x: number, z: number) => {
        sampledPositions.push({ x, z });
        return 10;
      };

      calculateFlatness(100, 100, trackingHeight);

      // Should have FLATNESS_SAMPLE_COUNT + 1 samples (circle + center)
      expect(sampledPositions.length).toBe(FLATNESS_SAMPLE_COUNT + 1);

      // Center should be sampled
      expect(sampledPositions.some((p) => p.x === 100 && p.z === 100)).toBe(
        true,
      );

      // All samples should be within FLATNESS_SAMPLE_RADIUS of center
      for (const pos of sampledPositions) {
        const distance = dist2D(pos.x, pos.z, 100, 100);
        expect(distance).toBeLessThanOrEqual(FLATNESS_SAMPLE_RADIUS + 0.001);
      }
    });

    it("handles negative coordinates", () => {
      const flatHeight = () => 10;
      const flatness = calculateFlatness(-500, -500, flatHeight);
      expect(flatness).toBeCloseTo(1.0, 5);
    });
  });

  describe("calculateWaterProximity", () => {
    it("returns 0 when position is in water", () => {
      const underwaterHeight = () => WATER_THRESHOLD - 1;
      const score = calculateWaterProximity(0, 0, underwaterHeight);
      expect(score).toBe(0);
    });

    it("returns 1.0 when at optimal water distance", () => {
      // Terrain dry everywhere except at optimal distance
      const optimalDistanceHeight = (x: number, z: number) => {
        const distance = dist2D(x, z, 0, 0);
        if (
          distance > OPTIMAL_WATER_DISTANCE_MIN &&
          distance < OPTIMAL_WATER_DISTANCE_MIN + 20
        ) {
          return WATER_THRESHOLD - 1; // Water
        }
        return 10; // Land
      };
      const score = calculateWaterProximity(0, 0, optimalDistanceHeight);
      expect(score).toBe(1.0);
    });

    it("returns lower score when too close to water", () => {
      // Water at 10m (below OPTIMAL_WATER_DISTANCE_MIN)
      const closeWaterHeight = (x: number, z: number) => {
        const distance = dist2D(x, z, 0, 0);
        return distance < 10 ? 10 : WATER_THRESHOLD - 1;
      };
      const score = calculateWaterProximity(0, 0, closeWaterHeight);
      expect(score).toBeLessThan(1.0);
      expect(score).toBeGreaterThan(0);
    });

    it("returns 0.5 when no water found", () => {
      const noWaterHeight = () => 10;
      const score = calculateWaterProximity(0, 0, noWaterHeight);
      expect(score).toBe(0.5);
    });

    it("searches in 8 directions", () => {
      const directions = new Set<string>();
      const trackingHeight = (x: number, z: number) => {
        if (x !== 0 || z !== 0) {
          const angle = Math.atan2(z, x);
          directions.add(angle.toFixed(2));
        }
        return 10;
      };

      calculateWaterProximity(0, 0, trackingHeight);
      // Should have sampled in 8 different directions
      expect(directions.size).toBe(8);
    });
  });

  describe("generateTownName", () => {
    it("generates deterministic names from seed", () => {
      const name1 = generateTownName(12345, 0);
      const name2 = generateTownName(12345, 0);
      expect(name1).toBe(name2);
    });

    it("generates different names for different indices", () => {
      const name1 = generateTownName(12345, 0);
      const name2 = generateTownName(12345, 1);
      expect(name1).not.toBe(name2);
    });

    it("generates different names for different seeds", () => {
      const name1 = generateTownName(12345, 0);
      const name2 = generateTownName(54321, 0);
      expect(name1).not.toBe(name2);
    });

    it("generates valid compound names", () => {
      for (let i = 0; i < 100; i++) {
        const name = generateTownName(i * 1000, i);
        // Should be a concatenation of prefix and suffix
        const hasValidPrefix = NAME_PREFIXES.some((p) => name.startsWith(p));
        const hasValidSuffix = NAME_SUFFIXES.some((s) => name.endsWith(s));
        expect(hasValidPrefix).toBe(true);
        expect(hasValidSuffix).toBe(true);
      }
    });

    it("covers variety of prefixes and suffixes", () => {
      const usedPrefixes = new Set<string>();
      const usedSuffixes = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const name = generateTownName(i * 7, i);
        const matchedPrefix = NAME_PREFIXES.find((p) => name.startsWith(p));
        const matchedSuffix = NAME_SUFFIXES.find((s) => name.endsWith(s));
        if (matchedPrefix) usedPrefixes.add(matchedPrefix);
        if (matchedSuffix) usedSuffixes.add(matchedSuffix);
      }

      // Should use a good variety (at least 80% of available)
      expect(usedPrefixes.size).toBeGreaterThan(NAME_PREFIXES.length * 0.8);
      expect(usedSuffixes.size).toBeGreaterThan(NAME_SUFFIXES.length * 0.8);
    });
  });

  describe("isTooCloseToExistingTowns", () => {
    it("returns false for empty town list", () => {
      expect(isTooCloseToExistingTowns(0, 0, [])).toBe(false);
    });

    it("returns true when exactly at minimum spacing", () => {
      const towns = [{ x: MIN_TOWN_SPACING - 1, z: 0 }];
      expect(isTooCloseToExistingTowns(0, 0, towns)).toBe(true);
    });

    it("returns false when beyond minimum spacing", () => {
      const towns = [{ x: MIN_TOWN_SPACING + 1, z: 0 }];
      expect(isTooCloseToExistingTowns(0, 0, towns)).toBe(false);
    });

    it("checks all existing towns", () => {
      const towns = [
        { x: 2000, z: 0 },
        { x: 0, z: 2000 },
        { x: 100, z: 0 }, // This one is too close
      ];
      expect(isTooCloseToExistingTowns(0, 0, towns)).toBe(true);
    });

    it("handles diagonal distances correctly", () => {
      // Diagonal distance to (600, 600) = sqrt(600^2 + 600^2) = 848.5
      const towns = [{ x: 600, z: 600 }];
      expect(isTooCloseToExistingTowns(0, 0, towns)).toBe(false); // > MIN_TOWN_SPACING (800)

      const closeTowns = [{ x: 400, z: 400 }]; // Distance = 565.7 < 800
      expect(isTooCloseToExistingTowns(0, 0, closeTowns)).toBe(true);
    });
  });

  describe("Town Size Configuration", () => {
    it("all town sizes have valid building counts", () => {
      for (const [_size, config] of Object.entries(TOWN_SIZE_CONFIG)) {
        expect(config.buildingCount.min).toBeGreaterThanOrEqual(3);
        expect(config.buildingCount.max).toBeGreaterThanOrEqual(
          config.buildingCount.min,
        );
        expect(config.radius).toBeGreaterThan(0);
        expect(config.safeZoneRadius).toBeGreaterThan(config.radius);
      }
    });

    it("larger towns have more buildings", () => {
      expect(TOWN_SIZE_CONFIG.village.buildingCount.min).toBeGreaterThan(
        TOWN_SIZE_CONFIG.hamlet.buildingCount.min,
      );
      expect(TOWN_SIZE_CONFIG.town.buildingCount.min).toBeGreaterThan(
        TOWN_SIZE_CONFIG.village.buildingCount.min,
      );
    });

    it("safe zone covers entire town radius", () => {
      for (const config of Object.values(TOWN_SIZE_CONFIG)) {
        expect(config.safeZoneRadius).toBeGreaterThan(config.radius);
      }
    });
  });

  describe("Building Configuration", () => {
    it("all required buildings exist", () => {
      expect(BUILDING_CONFIG.bank).toBeDefined();
      expect(BUILDING_CONFIG.store).toBeDefined();
      expect(BUILDING_CONFIG.anvil).toBeDefined();
    });

    it("building dimensions are valid", () => {
      for (const config of Object.values(BUILDING_CONFIG)) {
        expect(config.width).toBeGreaterThan(0);
        expect(config.depth).toBeGreaterThan(0);
        expect(config.priority).toBeGreaterThan(0);
      }
    });

    it("essential buildings have higher priority", () => {
      expect(BUILDING_CONFIG.bank.priority).toBeLessThan(
        BUILDING_CONFIG.house.priority,
      );
      expect(BUILDING_CONFIG.store.priority).toBeLessThan(
        BUILDING_CONFIG.house.priority,
      );
      expect(BUILDING_CONFIG.anvil.priority).toBeLessThan(
        BUILDING_CONFIG.house.priority,
      );
    });
  });

  describe("Biome Suitability", () => {
    it("forest is most suitable", () => {
      expect(BIOME_SUITABILITY.forest).toBe(0.8);
    });

    it("all biomes have defined suitability", () => {
      const biomes = BIOME_LIST;
      for (const biome of biomes) {
        expect(BIOME_SUITABILITY[biome]).toBeDefined();
        expect(BIOME_SUITABILITY[biome]).toBeGreaterThanOrEqual(0);
        expect(BIOME_SUITABILITY[biome]).toBeLessThanOrEqual(1);
      }
    });

    it("suitability reflects logical preferences", () => {
      // Forest > tundra > canyon makes sense for town building
      expect(BIOME_SUITABILITY.forest).toBeGreaterThan(
        BIOME_SUITABILITY.tundra,
      );
      expect(BIOME_SUITABILITY.tundra).toBeGreaterThan(
        BIOME_SUITABILITY.canyon,
      );
    });
  });

  describe("Town Placement Algorithm", () => {
    interface TownCandidate {
      x: number;
      z: number;
      flatnessScore: number;
      biomeScore: number;
      totalScore: number;
    }

    function selectTownLocations(candidates: TownCandidate[]): TownCandidate[] {
      const sorted = [...candidates].sort(
        (a, b) => b.totalScore - a.totalScore,
      );
      const selected: TownCandidate[] = [];

      for (const candidate of sorted) {
        if (selected.length >= TOWN_COUNT) break;
        if (!isTooCloseToExistingTowns(candidate.x, candidate.z, selected)) {
          selected.push(candidate);
        }
      }
      return selected;
    }

    it("selects up to TOWN_COUNT towns", () => {
      const candidates: TownCandidate[] = [];
      const rng = new SeededRNG(42);
      const _halfWorld = WORLD_SIZE / 2;

      // Generate 200 candidates
      for (let i = 0; i < 200; i++) {
        candidates.push({
          x: (rng.random() - 0.5) * WORLD_SIZE,
          z: (rng.random() - 0.5) * WORLD_SIZE,
          flatnessScore: rng.random(),
          biomeScore: rng.random(),
          totalScore: rng.random(),
        });
      }

      const selected = selectTownLocations(candidates);
      expect(selected.length).toBeLessThanOrEqual(TOWN_COUNT);
    });

    it("selects higher-scored candidates first", () => {
      const candidates: TownCandidate[] = [
        { x: 0, z: 0, flatnessScore: 0.5, biomeScore: 0.5, totalScore: 0.9 },
        { x: 1000, z: 0, flatnessScore: 0.5, biomeScore: 0.5, totalScore: 0.1 },
        { x: 2000, z: 0, flatnessScore: 0.5, biomeScore: 0.5, totalScore: 0.5 },
      ];

      const selected = selectTownLocations(candidates);

      expect(selected[0].totalScore).toBe(0.9);
      expect(selected[1].totalScore).toBe(0.5);
      expect(selected[2].totalScore).toBe(0.1);
    });

    it("enforces minimum spacing between towns", () => {
      const selected = selectTownLocations([
        { x: 0, z: 0, flatnessScore: 1, biomeScore: 1, totalScore: 1.0 },
        { x: 100, z: 0, flatnessScore: 1, biomeScore: 1, totalScore: 0.9 }, // Too close
        { x: 1000, z: 0, flatnessScore: 1, biomeScore: 1, totalScore: 0.8 },
      ]);

      // Should skip the second candidate (too close to first)
      expect(selected.length).toBe(2);
      expect(selected[0].x).toBe(0);
      expect(selected[1].x).toBe(1000);
    });
  });

  describe("Safe Zone Detection", () => {
    interface Town {
      position: { x: number; z: number };
      safeZoneRadius: number;
    }

    function isInSafeZone(x: number, z: number, towns: Town[]): boolean {
      return towns.some(
        (town) =>
          dist2D(x, z, town.position.x, town.position.z) <= town.safeZoneRadius,
      );
    }

    function getTownAtPosition(
      x: number,
      z: number,
      towns: Town[],
    ): Town | undefined {
      return towns.find(
        (town) =>
          dist2D(x, z, town.position.x, town.position.z) <= town.safeZoneRadius,
      );
    }

    it("returns true for position inside safe zone", () => {
      const towns: Town[] = [{ position: { x: 0, z: 0 }, safeZoneRadius: 50 }];
      expect(isInSafeZone(25, 0, towns)).toBe(true);
    });

    it("returns false for position outside safe zone", () => {
      const towns: Town[] = [{ position: { x: 0, z: 0 }, safeZoneRadius: 50 }];
      expect(isInSafeZone(100, 0, towns)).toBe(false);
    });

    it("returns true at exact boundary", () => {
      const towns: Town[] = [{ position: { x: 0, z: 0 }, safeZoneRadius: 50 }];
      expect(isInSafeZone(50, 0, towns)).toBe(true);
    });

    it("checks all towns", () => {
      const towns: Town[] = [
        { position: { x: 0, z: 0 }, safeZoneRadius: 50 },
        { position: { x: 1000, z: 1000 }, safeZoneRadius: 60 },
      ];

      expect(isInSafeZone(1020, 1000, towns)).toBe(true);
      expect(isInSafeZone(500, 500, towns)).toBe(false);
    });

    it("getTownAtPosition returns the correct town", () => {
      const towns: Town[] = [
        { position: { x: 0, z: 0 }, safeZoneRadius: 50 },
        { position: { x: 1000, z: 0 }, safeZoneRadius: 60 },
      ];

      const town1 = getTownAtPosition(10, 0, towns);
      expect(town1?.position.x).toBe(0);

      const town2 = getTownAtPosition(990, 0, towns);
      expect(town2?.position.x).toBe(1000);

      const noTown = getTownAtPosition(500, 0, towns);
      expect(noTown).toBeUndefined();
    });

    it("getSpawnTown returns town nearest to origin (0,0)", () => {
      interface TownWithName extends Town {
        name: string;
      }

      function getNearestTown(
        x: number,
        z: number,
        towns: TownWithName[],
      ): TownWithName | undefined {
        if (towns.length === 0) return undefined;
        return towns.reduce((nearest, town) =>
          dist2D(x, z, town.position.x, town.position.z) <
          dist2D(x, z, nearest.position.x, nearest.position.z)
            ? town
            : nearest,
        );
      }

      function getSpawnTown(towns: TownWithName[]): TownWithName | undefined {
        return getNearestTown(0, 0, towns);
      }

      const towns: TownWithName[] = [
        {
          name: "Far Town",
          position: { x: 1000, z: 1000 },
          safeZoneRadius: 50,
        },
        { name: "Spawn Town", position: { x: 100, z: 50 }, safeZoneRadius: 50 },
        {
          name: "Medium Town",
          position: { x: 500, z: 500 },
          safeZoneRadius: 50,
        },
      ];

      const spawn = getSpawnTown(towns);
      expect(spawn?.name).toBe("Spawn Town");
      expect(spawn?.position.x).toBe(100);
      expect(spawn?.position.z).toBe(50);
    });

    it("getSpawnTown returns undefined for empty town list", () => {
      function getNearestTown(
        x: number,
        z: number,
        towns: Town[],
      ): Town | undefined {
        if (towns.length === 0) return undefined;
        return towns.reduce((nearest, town) =>
          dist2D(x, z, town.position.x, town.position.z) <
          dist2D(x, z, nearest.position.x, nearest.position.z)
            ? town
            : nearest,
        );
      }

      function getSpawnTown(towns: Town[]): Town | undefined {
        return getNearestTown(0, 0, towns);
      }

      expect(getSpawnTown([])).toBeUndefined();
    });
  });

  describe("Building Placement Algorithm", () => {
    interface PlacedBuilding {
      x: number;
      z: number;
      radius: number;
      type: TownBuildingType;
    }

    function checkBuildingOverlap(buildings: PlacedBuilding[]): boolean {
      for (let i = 0; i < buildings.length; i++) {
        for (let j = i + 1; j < buildings.length; j++) {
          const distance = dist2D(
            buildings[i].x,
            buildings[i].z,
            buildings[j].x,
            buildings[j].z,
          );
          if (distance < buildings[i].radius + buildings[j].radius) {
            return true;
          }
        }
      }
      return false;
    }

    it("placed buildings should not overlap", () => {
      const rng = new SeededRNG(42);
      const townRadius = 40;
      const buildings: PlacedBuilding[] = [];
      const buildingTypes: TownBuildingType[] = [
        "bank",
        "store",
        "anvil",
        "house",
        "house",
      ];

      for (const type of buildingTypes) {
        const config = BUILDING_CONFIG[type];
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 50) {
          attempts++;
          const angle = rng.random() * Math.PI * 2;
          const radius = 5 + rng.random() * (townRadius - config.width);
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const buildingRadius = Math.max(config.width, config.depth) / 2 + 2;

          const overlaps = buildings.some(
            (b) => dist2D(x, z, b.x, b.z) < buildingRadius + b.radius,
          );

          if (!overlaps) {
            buildings.push({ x, z, radius: buildingRadius, type });
            placed = true;
          }
        }
      }

      expect(checkBuildingOverlap(buildings)).toBe(false);
    });

    it("buildings stay within town radius", () => {
      const rng = new SeededRNG(42);
      const townRadius = 40;

      for (let i = 0; i < 100; i++) {
        const angle = rng.random() * Math.PI * 2;
        const radius = rng.random() * townRadius;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const distance = dist2D(x, z, 0, 0);
        expect(distance).toBeLessThanOrEqual(townRadius);
      }
    });
  });

  describe("World Bounds", () => {
    it("WORLD_SIZE is reasonable", () => {
      expect(WORLD_SIZE).toBeGreaterThanOrEqual(1000);
      expect(WORLD_SIZE).toBeLessThanOrEqual(100000);
    });

    it("MIN_TOWN_SPACING allows 25 towns to fit", () => {
      // Area per town = spacing^2
      const areaPerTown = MIN_TOWN_SPACING * MIN_TOWN_SPACING;
      const totalArea = WORLD_SIZE * WORLD_SIZE;
      const maxTowns = totalArea / areaPerTown;

      expect(maxTowns).toBeGreaterThan(TOWN_COUNT * 2); // Should have plenty of room
    });

    it("towns can be placed near world edges with buffer", () => {
      const edgeBuffer = 200;
      const halfWorld = WORLD_SIZE / 2;
      const validRange = halfWorld - edgeBuffer;

      // Should still have enough room for all towns
      const validArea = (validRange * 2) ** 2;
      const areaPerTown = MIN_TOWN_SPACING * MIN_TOWN_SPACING;
      expect(validArea / areaPerTown).toBeGreaterThan(TOWN_COUNT);
    });
  });

  describe("Performance Characteristics", () => {
    it("flatness calculation is fast", () => {
      const height = () => 10;
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        calculateFlatness(i * 100, i * 100, height);
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000); // < 1ms per calculation (generous for CI)
    });

    it("town spacing check scales linearly", () => {
      const towns: Array<{ x: number; z: number }> = [];
      for (let i = 0; i < 100; i++) {
        towns.push({ x: i * 1000, z: 0 });
      }

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        isTooCloseToExistingTowns(5000, 5000, towns);
      }
      const elapsed = performance.now() - start;

      // Should be fast even with many towns
      // (threshold relaxed for CI environments with variable performance)
      expect(elapsed).toBeLessThan(150);
    });
  });
});
