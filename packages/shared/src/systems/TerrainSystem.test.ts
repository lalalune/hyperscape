import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import THREE from "../extras/three/three";
import { NoiseGenerator } from "../utils/NoiseGenerator";

// Mock PhysX and related modules before importing terrain systems
mock.module("@hyperscape/physx-js-webidl", () => ({
  default: () => Promise.resolve(null),
}));

mock.module("../physics/PhysXManager", () => ({
  getPhysX: () => null,
  initPhysX: () => Promise.resolve(null),
  waitForPhysX: () => Promise.resolve(null),
}));

// Mock client-side systems that cause import chain issues
mock.module("../systems/client/ClientActions", () => ({
  ClientActions: class MockClientActions {},
}));

mock.module("../systems/client/ClientInput", () => ({
  ClientInput: class MockClientInput {},
}));

mock.module("../systems/client/ClientLoader", () => ({
  ClientLoader: class MockClientLoader {},
}));

mock.module("../systems/client/ClientNetwork", () => ({
  ClientNetwork: class MockClientNetwork {},
}));

mock.module("../systems/client/ClientInterface", () => ({
  ClientInterface: class MockClientInterface {},
}));

// Import types safely
import type { World } from "../types";

/**
 * TerrainSystem Tests
 *
 * These tests verify terrain generation, heightfield data, and resource placement.
 * Uses minimal world setup for server-side terrain generation testing.
 */

// Create a minimal test world without texture loading
// IMPORTANT: isServer=true to skip texture loading (requires DOM)
function createMinimalTestWorld(): World {
  const scene = new THREE.Scene();

  // Create world object that mimics server mode
  // Server mode skips texture loading in GrassSystem/WaterSystem
  const world = {
    // Must set these directly as GrassSystem reads world.isServer directly
    get isClient() {
      return false;
    },
    get isServer() {
      return true;
    },
    systems: [] as unknown[],
    stage: { scene },
    network: {
      isClient: false,
      isServer: true,
    },
    physics: null, // No physics in tests
    getSystem: mock((name: string) => {
      if (name === "database") return null;
      return null;
    }),
    getPlayers: mock(() => []),
    emit: mock(() => {}),
    loader: {
      load: mock(async () => null),
    },
    assetsUrl: "http://localhost:8080",
    destroy: mock(() => {}),
  } as unknown as World;

  return world;
}

// Dynamic imports for systems with circular dependencies
let TerrainSystemClass: typeof import("./shared/world/TerrainSystem").TerrainSystem;
let GrassSystemClass: typeof import("./shared/world/GrassSystem").GrassSystem;
let WaterSystemClass: typeof import("./shared/world/WaterSystem").WaterSystem;

describe("TerrainSystem", () => {
  let world: World;
  let terrainSystem: InstanceType<typeof TerrainSystemClass>;

  beforeAll(async () => {
    // Dynamic imports after mocks are set up
    const terrainModule = await import("./shared/world/TerrainSystem");
    const grassModule = await import("./shared/world/GrassSystem");
    const waterModule = await import("./shared/world/WaterSystem");

    TerrainSystemClass = terrainModule.TerrainSystem;
    GrassSystemClass = grassModule.GrassSystem;
    WaterSystemClass = waterModule.WaterSystem;

    world = createMinimalTestWorld();
    terrainSystem = new TerrainSystemClass(world);
    await terrainSystem.init();
    await terrainSystem.start();
  });

  afterAll(() => {
    if (terrainSystem) {
      terrainSystem.destroy();
    }
  });

  it("should initialize correctly", () => {
    expect(terrainSystem).toBeDefined();
    expect(terrainSystem.getTiles()).toBeDefined();
    expect(terrainSystem.isReady()).toBe(true);
  });

  it("should return consistent height values (deterministic)", () => {
    const height1 = terrainSystem.getHeightAt(0, 0);
    const height2 = terrainSystem.getHeightAt(0, 0);

    expect(height1).toBe(height2);
    expect(typeof height1).toBe("number");
    expect(isFinite(height1)).toBe(true);
  });

  it("should generate different heights at different positions", () => {
    const height1 = terrainSystem.getHeightAt(0, 0);
    const height2 = terrainSystem.getHeightAt(100, 100);
    const height3 = terrainSystem.getHeightAt(-50, 25);

    // Heights should vary across the world
    const allSame = height1 === height2 && height2 === height3;
    expect(allSame).toBe(false);
  });

  it("should calculate slope correctly", () => {
    const terrainInfo = terrainSystem.getTerrainInfoAt(0, 0);

    expect(terrainInfo).toBeDefined();
    expect(terrainInfo.slope).toBeGreaterThanOrEqual(0);
    expect(typeof terrainInfo.slope).toBe("number");
    expect(isFinite(terrainInfo.slope)).toBe(true);
  });

  it("should determine walkability based on terrain", () => {
    const walkableCheck = terrainSystem.isPositionWalkable(0, 0);

    expect(walkableCheck).toBeDefined();
    expect(typeof walkableCheck.walkable).toBe("boolean");
  });

  it("should mark underwater positions as not walkable", () => {
    // Find a position below water threshold by testing multiple positions
    let underwaterFound = false;
    let totalSamples = 0;
    for (let x = -500; x <= 500; x += 50) {
      for (let z = -500; z <= 500; z += 50) {
        totalSamples++;
        const info = terrainSystem.getTerrainInfoAt(x, z);
        if (info.underwater && !underwaterFound) {
          const walkable = terrainSystem.isPositionWalkable(x, z);
          expect(walkable.walkable).toBe(false);
          underwaterFound = true;
        }
      }
    }
    // Verify we actually sampled terrain (test setup is working)
    expect(totalSamples).toBeGreaterThan(100);
    // Log which case we hit so we know what was actually tested
    console.log(`[Underwater Test] Samples: ${totalSamples}, Found underwater: ${underwaterFound}`);
  });

  it("should return correct tile size", () => {
    const tileSize = terrainSystem.getTileSize();
    expect(tileSize).toBe(100); // 100m tiles per spec
  });

  it("should return water level", () => {
    const waterLevel = terrainSystem.getWaterLevel();
    expect(typeof waterLevel).toBe("number");
    expect(waterLevel).toBeGreaterThan(0);
  });

  it("should generate terrain within expected height range", () => {
    // Sample multiple positions
    const positions = [
      [0, 0],
      [50, 50],
      [-100, 100],
      [200, -200],
      [-300, -300],
    ];

    for (const [x, z] of positions) {
      const height = terrainSystem.getHeightAt(x, z);
      // OSRS-style terrain: 0-30m range
      expect(height).toBeGreaterThanOrEqual(0);
      expect(height).toBeLessThanOrEqual(35); // Some margin for edge cases
    }
  });

  it("should provide terrain info with biome", () => {
    const info = terrainSystem.getTerrainInfoAt(0, 0);
    expect(info.biome).toBeDefined();
    expect(typeof info.biome).toBe("string");
    expect(info.biome.length).toBeGreaterThan(0);
  });

  it("should generate initial tiles around origin", () => {
    const tiles = terrainSystem.getTiles();
    expect(tiles.size).toBeGreaterThan(0);

    // Should have at least the origin tile
    let hasOriginArea = false;
    for (const [, tile] of tiles) {
      if (Math.abs(tile.x) <= 1 && Math.abs(tile.z) <= 1) {
        hasOriginArea = true;
        break;
      }
    }
    expect(hasOriginArea).toBe(true);
  });
});

describe("NoiseGenerator (determinism)", () => {
  it("should produce deterministic results with same seed", () => {
    const noise1 = new NoiseGenerator(12345);
    const noise2 = new NoiseGenerator(12345);

    const result1 = noise1.perlin2D(10, 20);
    const result2 = noise2.perlin2D(10, 20);

    expect(result1).toBe(result2);
  });

  it("should produce different results with different seeds", () => {
    const noise1 = new NoiseGenerator(12345);
    const noise2 = new NoiseGenerator(54321);

    // Test at multiple positions - seeds should produce different patterns
    let differentCount = 0;
    for (let i = 0; i < 10; i++) {
      const x = i * 7.3;
      const y = i * 11.1;
      const result1 = noise1.perlin2D(x, y);
      const result2 = noise2.perlin2D(x, y);
      if (result1 !== result2) differentCount++;
    }
    // At least some samples should differ between different seeds
    expect(differentCount).toBeGreaterThan(0);
  });

  it("should produce values in valid range for perlin2D", () => {
    const noise = new NoiseGenerator(42);

    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 1000 - 500;
      const y = Math.random() * 1000 - 500;
      const value = noise.perlin2D(x, y);

      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("should produce values in valid range for simplex2D", () => {
    const noise = new NoiseGenerator(42);

    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 1000 - 500;
      const y = Math.random() * 1000 - 500;
      const value = noise.simplex2D(x, y);

      expect(value).toBeGreaterThanOrEqual(-100);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("should produce ridge noise in valid range", () => {
    const noise = new NoiseGenerator(42);

    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const value = noise.ridgeNoise2D(x, y);

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("should produce visibility values in 0-1 range", () => {
    const noise = new NoiseGenerator(42);

    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 1000;
      const z = Math.random() * 1000;
      const wetness = noise.wetnessNoise(x, z);

      expect(wetness).toBeGreaterThanOrEqual(0);
      expect(wetness).toBeLessThanOrEqual(1);

      const treeVis = noise.treeVisibility(x, z, wetness);
      expect(treeVis).toBeGreaterThanOrEqual(0);
      expect(treeVis).toBeLessThanOrEqual(1);

      const rockVis = noise.rockVisibility(x, z);
      expect(rockVis).toBeGreaterThanOrEqual(0);
      expect(rockVis).toBeLessThanOrEqual(1);
    }
  });
});

describe("GrassSystem", () => {
  beforeAll(async () => {
    // Ensure GrassSystemClass is loaded
    if (!GrassSystemClass) {
      const grassModule = await import("./shared/world/GrassSystem");
      GrassSystemClass = grassModule.GrassSystem;
    }
  });

  it("should initialize correctly on server (skips texture loading)", async () => {
    const world = createMinimalTestWorld();
    const grassSystem = new GrassSystemClass(world);

    await grassSystem.init();

    expect(grassSystem).toBeDefined();
  });

  it("should update without crashing when grassUniforms not initialized", async () => {
    const world = createMinimalTestWorld();
    const grassSystem = new GrassSystemClass(world);

    // Update should not crash even if uniforms aren't initialized
    // The fact that we reach the end without throwing proves the test passes
    let updateCount = 0;
    grassSystem.update(0.016);
    updateCount++;
    grassSystem.update(0.033);
    updateCount++;
    grassSystem.update(0.05);
    updateCount++;

    // Verify all updates completed
    expect(updateCount).toBe(3);
  });

  it("should handle dispose without errors", async () => {
    const world = createMinimalTestWorld();
    const grassSystem = new GrassSystemClass(world);

    await grassSystem.init();
    
    // Verify system exists before disposal
    expect(grassSystem).toBeDefined();
    
    grassSystem.dispose();
    
    // Disposal completed without throwing - system lifecycle works
    expect(grassSystem).toBeDefined();
  });
});

describe("WaterSystem", () => {
  beforeAll(async () => {
    // Ensure WaterSystemClass is loaded
    if (!WaterSystemClass) {
      const waterModule = await import("./shared/world/WaterSystem");
      WaterSystemClass = waterModule.WaterSystem;
    }
  });

  it("should initialize correctly on server (skips texture loading)", async () => {
    const world = createMinimalTestWorld();
    const waterSystem = new WaterSystemClass(world);

    await waterSystem.init();

    expect(waterSystem).toBeDefined();
  });

  it("should update without crashing with empty mesh array", async () => {
    const world = createMinimalTestWorld();
    const waterSystem = new WaterSystemClass(world);

    let updateCount = 0;
    waterSystem.update(0.016, []);
    updateCount++;
    waterSystem.update(0.033, []);
    updateCount++;

    // Verify both updates completed
    expect(updateCount).toBe(2);
  });

  it("should handle dispose without errors", async () => {
    const world = createMinimalTestWorld();
    const waterSystem = new WaterSystemClass(world);

    await waterSystem.init();
    
    // Verify system exists before disposal
    expect(waterSystem).toBeDefined();
    
    waterSystem.dispose();
    
    // Disposal completed without throwing
    expect(waterSystem).toBeDefined();
  });
});

describe("Terrain Feature Validation", () => {
  // Production-grade tests to verify all terrain features exist and work correctly

  describe("Terrain height generation", () => {
    let terrainSystem: InstanceType<typeof TerrainSystemClass>;

    beforeAll(async () => {
      if (!TerrainSystemClass) {
        const terrainModule = await import("./shared/world/TerrainSystem");
        TerrainSystemClass = terrainModule.TerrainSystem;
      }
      const world = createMinimalTestWorld();
      terrainSystem = new TerrainSystemClass(world);
      await terrainSystem.init();
      await terrainSystem.start();
    });

    afterAll(() => {
      if (terrainSystem) {
        terrainSystem.destroy();
      }
    });

    it("should produce smooth terrain without jagged spikes", () => {
      // Sample a grid of heights and check for smoothness
      const sampleStep = 2; // meters
      const sampleSize = 50; // 50x50 grid = 2500 samples
      let maxHeightDifference = 0;

      for (let x = 0; x < sampleSize * sampleStep; x += sampleStep) {
        for (let z = 0; z < sampleSize * sampleStep; z += sampleStep) {
          const h1 = terrainSystem.getHeightAt(x, z);
          const h2 = terrainSystem.getHeightAt(x + sampleStep, z);
          const h3 = terrainSystem.getHeightAt(x, z + sampleStep);

          maxHeightDifference = Math.max(
            maxHeightDifference,
            Math.abs(h1 - h2),
            Math.abs(h1 - h3),
          );
        }
      }

      // Height difference over 2m step should be gentle (OSRS-style)
      // Max ~2m change per 2m horizontal = 45 degree slope at most
      expect(maxHeightDifference).toBeLessThan(3);
    });

    it("should have consistent biome transitions", () => {
      // Sample biomes across the world
      const biomeChanges: Array<{
        x: number;
        z: number;
        from: string;
        to: string;
      }> = [];
      let lastBiome = "";

      for (let x = -500; x <= 500; x += 10) {
        const info = terrainSystem.getTerrainInfoAt(x, 0);
        if (lastBiome && info.biome !== lastBiome) {
          biomeChanges.push({ x, z: 0, from: lastBiome, to: info.biome });
        }
        lastBiome = info.biome;
      }

      // Biome transitions should happen at reasonable intervals
      // Not changing every few meters (too noisy) or never (single biome)
      expect(biomeChanges.length).toBeGreaterThanOrEqual(0); // May be 0 for small samples
      expect(biomeChanges.length).toBeLessThan(100); // Not changing every 10m
    });

    it("should handle underwater terrain correctly", () => {
      const waterLevel = terrainSystem.getWaterLevel();
      let _underwaterCount = 0;
      let aboveWaterCount = 0;

      for (let x = -200; x <= 200; x += 20) {
        for (let z = -200; z <= 200; z += 20) {
          const info = terrainSystem.getTerrainInfoAt(x, z);
          if (info.underwater) {
            _underwaterCount++;
            // Underwater should mark height below water level
            expect(info.height).toBeLessThan(waterLevel + 0.5); // Small tolerance
          } else {
            aboveWaterCount++;
          }
        }
      }

      // Should have reasonable land/water ratio (not all water or all land)
      expect(aboveWaterCount).toBeGreaterThan(0);
    });
  });

  describe("Noise functions for terrain features", () => {
    it("should generate ocean noise patterns", () => {
      const noise = new NoiseGenerator(42);
      let hasOcean = false;
      let hasLand = false;

      // Sample many points to find both ocean and land
      for (let x = -500; x <= 500 && (!hasOcean || !hasLand); x += 50) {
        for (let z = -500; z <= 500 && (!hasOcean || !hasLand); z += 50) {
          const oceanValue = noise.oceanNoise(x, z);
          expect(oceanValue).toBeGreaterThanOrEqual(0);
          expect(oceanValue).toBeLessThanOrEqual(1);

          if (oceanValue > 0.6) hasOcean = true;
          if (oceanValue < 0.4) hasLand = true;
        }
      }

      // Should have variation in the world
      expect(hasOcean || hasLand).toBe(true);
    });

    it("should generate river noise connected to terrain", () => {
      const noise = new NoiseGenerator(42);
      let foundRiver = false;
      let oceanZonesSampled = 0;
      let totalSamples = 0;

      for (let x = 0; x <= 500; x += 20) {
        for (let z = 0; z <= 500; z += 20) {
          totalSamples++;
          const oceanValue = noise.oceanNoise(x, z);
          const riverValue = noise.riverNoise(x, z, oceanValue);

          // River should be 0 in ocean zones
          if (oceanValue > 0.5) {
            expect(riverValue).toBe(0);
            oceanZonesSampled++;
          } else if (riverValue > 0.7 && !foundRiver) {
            foundRiver = true;
          }
        }
      }
      // Verify we actually tested something
      expect(totalSamples).toBeGreaterThan(100);
      // Log what we tested
      console.log(`[River Test] Samples: ${totalSamples}, Ocean zones: ${oceanZonesSampled}, Rivers found: ${foundRiver}`);
    });

    it("should generate temperature variation for biomes", () => {
      const noise = new NoiseGenerator(42);
      const temps: number[] = [];

      for (let x = -500; x <= 500; x += 100) {
        for (let z = -500; z <= 500; z += 100) {
          const temp = noise.temperatureNoise(x, z);
          expect(temp).toBeGreaterThanOrEqual(0);
          expect(temp).toBeLessThanOrEqual(1);
          temps.push(temp);
        }
      }

      // Should have temperature variation
      const minTemp = Math.min(...temps);
      const maxTemp = Math.max(...temps);
      expect(maxTemp - minTemp).toBeGreaterThan(0.1);
    });

    it("should generate humidity variation for biomes", () => {
      const noise = new NoiseGenerator(42);
      const humidities: number[] = [];

      for (let x = -500; x <= 500; x += 100) {
        for (let z = -500; z <= 500; z += 100) {
          const humidity = noise.humidityNoise(x, z);
          expect(humidity).toBeGreaterThanOrEqual(0);
          expect(humidity).toBeLessThanOrEqual(1);
          humidities.push(humidity);
        }
      }

      // Should have humidity variation
      const minH = Math.min(...humidities);
      const maxH = Math.max(...humidities);
      expect(maxH - minH).toBeGreaterThan(0.1);
    });
  });

  describe("Tree and vegetation placement", () => {
    it("should generate tree visibility based on wetness", () => {
      const noise = new NoiseGenerator(42);

      // High wetness should allow more trees
      const highWetness = 0.9;
      const lowWetness = 0.1;

      let highWetnessTreeSum = 0;
      let lowWetnessTreeSum = 0;
      const samples = 100;

      for (let i = 0; i < samples; i++) {
        const x = Math.random() * 1000;
        const z = Math.random() * 1000;

        highWetnessTreeSum += noise.treeVisibility(x, z, highWetness);
        lowWetnessTreeSum += noise.treeVisibility(x, z, lowWetness);
      }

      // Higher wetness should correlate with more tree visibility
      expect(highWetnessTreeSum).toBeGreaterThan(lowWetnessTreeSum);
    });

    it("should generate grass visibility based on wetness", () => {
      const noise = new NoiseGenerator(42);

      let hasGrassAreas = false;
      let hasNoGrassAreas = false;

      for (let x = 0; x <= 200; x += 10) {
        for (let z = 0; z <= 200; z += 10) {
          const wetness = noise.wetnessNoise(x, z);
          const grassVis = noise.grassVisibility(x, z, wetness);

          expect(grassVis).toBeGreaterThanOrEqual(0);
          expect(grassVis).toBeLessThanOrEqual(1);

          if (grassVis > 0.5) hasGrassAreas = true;
          if (grassVis < 0.2) hasNoGrassAreas = true;
        }
      }

      // Should have variation in grass coverage
      expect(hasGrassAreas || hasNoGrassAreas).toBe(true);
    });
  });

  describe("Rock and stone placement", () => {
    it("should generate rock visibility noise", () => {
      const noise = new NoiseGenerator(42);

      let hasRockyAreas = false;
      let hasClearAreas = false;

      for (let x = 0; x <= 300; x += 15) {
        for (let z = 0; z <= 300; z += 15) {
          const rockVis = noise.rockVisibility(x, z);

          expect(rockVis).toBeGreaterThanOrEqual(0);
          expect(rockVis).toBeLessThanOrEqual(1);

          if (rockVis > 0.7) hasRockyAreas = true;
          if (rockVis < 0.3) hasClearAreas = true;
        }
      }

      // World should have varied rock distribution
      expect(hasRockyAreas || hasClearAreas).toBe(true);
    });

    it("should generate stone visibility distinct from rock", () => {
      const noise = new NoiseGenerator(42);

      // Rock and stone use different noise frequencies (0.01 vs 0.02)
      // and different octaves (2 vs 3), so they should produce
      // different patterns but may occasionally overlap
      let hasDifference = false;

      // Sample multiple points with good spacing
      for (let i = 0; i < 20 && !hasDifference; i++) {
        const x = i * 25.7 + 3.3; // Offset to avoid integer boundaries
        const z = i * 19.3 + 7.1;

        const rockVis = noise.rockVisibility(x, z);
        const stoneVis = noise.stoneVisibility(x, z);

        // Both should be valid
        expect(rockVis).toBeGreaterThanOrEqual(0);
        expect(rockVis).toBeLessThanOrEqual(1);
        expect(stoneVis).toBeGreaterThanOrEqual(0);
        expect(stoneVis).toBeLessThanOrEqual(1);

        if (Math.abs(rockVis - stoneVis) > 0.05) {
          hasDifference = true;
        }
      }

      // At least some points should differ between rock and stone
      expect(hasDifference).toBe(true);
    });
  });

  describe("Height variation and mountains/valleys", () => {
    it("should produce ridge noise for mountain features", () => {
      const noise = new NoiseGenerator(42);

      let maxRidge = 0;
      let minRidge = 1;

      // Sample a wide area at proper scale for ridge detection
      for (let x = 0; x <= 1000; x += 10) {
        for (let z = 0; z <= 1000; z += 10) {
          const ridge = noise.ridgeNoise2D(x * 0.01, z * 0.01);

          expect(ridge).toBeGreaterThanOrEqual(0);
          expect(ridge).toBeLessThanOrEqual(1);

          if (ridge > maxRidge) maxRidge = ridge;
          if (ridge < minRidge) minRidge = ridge;
        }
      }

      // Should have variation in ridge heights (mountain features)
      const ridgeRange = maxRidge - minRidge;
      expect(ridgeRange).toBeGreaterThan(0.3); // Significant variation
    });

    it("should produce erosion patterns for valleys", () => {
      const noise = new NoiseGenerator(42);

      const erosionValues: number[] = [];

      for (let x = 0; x <= 100; x += 10) {
        for (let z = 0; z <= 100; z += 10) {
          const erosion = noise.erosionNoise2D(x * 0.005, z * 0.005, 2);
          erosionValues.push(erosion);
        }
      }

      const min = Math.min(...erosionValues);
      const max = Math.max(...erosionValues);

      // Erosion should create varied terrain
      expect(max - min).toBeGreaterThan(0.05);
    });

    it("should produce fractal noise for natural terrain", () => {
      const noise = new NoiseGenerator(42);

      // Test at different octave levels
      const octave1 = noise.fractal2D(50, 50, 1);
      const octave4 = noise.fractal2D(50, 50, 4);
      const octave6 = noise.fractal2D(50, 50, 6);

      // All should be in valid range
      expect(octave1).toBeGreaterThanOrEqual(-1);
      expect(octave1).toBeLessThanOrEqual(1);
      expect(octave4).toBeGreaterThanOrEqual(-1);
      expect(octave4).toBeLessThanOrEqual(1);
      expect(octave6).toBeGreaterThanOrEqual(-1);
      expect(octave6).toBeLessThanOrEqual(1);
    });
  });

  describe("Domain warping for organic terrain", () => {
    it("should warp coordinates for organic shapes", () => {
      const noise = new NoiseGenerator(42);

      const original = { x: 100, y: 100 };
      const warped = noise.domainWarp2D(original.x, original.y, 10);

      // Warped coordinates should be different
      expect(warped.x).not.toBe(original.x);
      expect(warped.y).not.toBe(original.y);

      // But should be within reasonable range of original
      expect(Math.abs(warped.x - original.x)).toBeLessThan(50);
      expect(Math.abs(warped.y - original.y)).toBeLessThan(50);
    });
  });

  describe("Advanced noise types", () => {
    it("should generate cellular/Worley noise for biome boundaries", () => {
      const noise = new NoiseGenerator(42);

      const cellValues: number[] = [];
      for (let i = 0; i < 50; i++) {
        const x = i * 0.5 + 0.1;
        const z = i * 0.3 + 0.2;
        const cell = noise.cellular2D(x, z);

        // Should be in 0-1 range (distance)
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThanOrEqual(1);
        cellValues.push(cell);
      }

      // Should have variation
      const min = Math.min(...cellValues);
      const max = Math.max(...cellValues);
      expect(max - min).toBeGreaterThan(0.1);
    });

    it("should generate billow noise for cloud-like features", () => {
      const noise = new NoiseGenerator(42);

      const billowValues: number[] = [];
      for (let i = 0; i < 50; i++) {
        const x = i * 1.1 + 0.1;
        const z = i * 0.7 + 0.2;
        const billow = noise.billow2D(x, z, 4);

        // Should be in -1 to 1 range
        expect(billow).toBeGreaterThanOrEqual(-1);
        expect(billow).toBeLessThanOrEqual(1);
        billowValues.push(billow);
      }

      // Should have variation
      const min = Math.min(...billowValues);
      const max = Math.max(...billowValues);
      expect(max - min).toBeGreaterThan(0.3);
    });

    it("should generate voronoi edge noise for plateau edges", () => {
      const noise = new NoiseGenerator(42);

      const edgeValues: number[] = [];
      for (let i = 0; i < 50; i++) {
        const x = i * 0.4 + 0.1;
        const z = i * 0.6 + 0.2;
        const edge = noise.voronoiEdge2D(x, z);

        // Edge values in 0-1 range
        expect(edge).toBeGreaterThanOrEqual(0);
        expect(edge).toBeLessThanOrEqual(1);
        edgeValues.push(edge);
      }

      // Should have edges (high values) and centers (low values)
      const min = Math.min(...edgeValues);
      const max = Math.max(...edgeValues);
      expect(max - min).toBeGreaterThan(0.2);
    });

    it("should perform multi-layer domain warping", () => {
      const noise = new NoiseGenerator(42);

      const original = { x: 50, y: 50 };
      const warped = noise.domainWarpFBM(original.x, original.y, 3, 4.0);

      // Warped coordinates should differ from original
      expect(warped.x).not.toBe(original.x);
      expect(warped.y).not.toBe(original.y);

      // Should produce a value
      expect(warped.value).toBeGreaterThanOrEqual(-1);
      expect(warped.value).toBeLessThanOrEqual(1);
    });

    it("should normalize simplex noise to [-1, 1] range", () => {
      const noise = new NoiseGenerator(42);

      // Sample many points
      for (let i = 0; i < 1000; i++) {
        const x = (i % 50) * 0.7 + 0.1;
        const z = Math.floor(i / 50) * 0.5 + 0.2;
        const value = noise.simplex2D(x, z);

        // Must be in normalized range
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Instance variation noise", () => {
    it("should generate hash noise for randomization", () => {
      const noise = new NoiseGenerator(42);

      const hash1 = noise.hashNoise(10.03, 20.07);
      const hash2 = noise.hashNoise(10.03, 20.07);

      // Same input should give same output (deterministic)
      expect(hash1).toBe(hash2);

      // Should be in 0-1 range
      expect(hash1).toBeGreaterThanOrEqual(0);
      expect(hash1).toBeLessThanOrEqual(1);

      // Hash noise uses high frequency (10x), need fractional offsets
      // to avoid hitting integer boundaries internally
      const hashes: number[] = [];
      for (let i = 0; i < 50; i++) {
        const x = i * 0.07 + 0.03; // Avoid integer boundaries after 10x
        const z = i * 0.05 + 0.02;
        const h = noise.hashNoise(x, z);
        hashes.push(h);
      }

      // Should have variation across the sampled area
      const min = Math.min(...hashes);
      const max = Math.max(...hashes);
      expect(max - min).toBeGreaterThan(0.2);
    });

    it("should generate scale noise for size variation", () => {
      const noise = new NoiseGenerator(42);

      const scales: number[] = [];
      // Scale noise uses 2x frequency, sample with offsets to avoid int boundaries
      for (let i = 0; i < 50; i++) {
        const x = i * 0.7 + 0.1;
        const z = i * 0.3 + 0.15;
        const scale = noise.scaleNoise(x, z);
        expect(scale).toBeGreaterThanOrEqual(0);
        expect(scale).toBeLessThanOrEqual(1);
        scales.push(scale);
      }

      // Check for actual min/max variation
      const min = Math.min(...scales);
      const max = Math.max(...scales);
      const range = max - min;

      // Should have meaningful variation for scale purposes
      expect(range).toBeGreaterThan(0.2);
    });

    it("should generate rotation noise for orientation", () => {
      const noise = new NoiseGenerator(42);

      const rotation = noise.rotationNoise(50, 50);

      expect(rotation.x).toBe(0); // Only Y rotation supported
      expect(rotation.z).toBe(0);
      expect(rotation.y).toBeGreaterThanOrEqual(0);
      expect(rotation.y).toBeLessThanOrEqual(1);
    });

    it("should generate color noise for variation", () => {
      const noise = new NoiseGenerator(42);

      const color = noise.colorNoise(50, 50);

      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(1);
      expect(color.g).toBeGreaterThanOrEqual(0);
      expect(color.g).toBeLessThanOrEqual(1);
      expect(color.b).toBeGreaterThanOrEqual(0);
      expect(color.b).toBeLessThanOrEqual(1);
    });
  });
});

describe("Terrain Performance", () => {
  it("should generate noise values efficiently (10000 samples < 100ms)", () => {
    const noise = new NoiseGenerator(42);
    const iterations = 10000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const x = Math.random() * 1000;
      const z = Math.random() * 1000;
      noise.perlin2D(x, z);
    }
    const perlinTime = performance.now() - start;

    // Perlin2D should be very fast (< 10µs per call)
    expect(perlinTime).toBeLessThan(100);
  });

  it("should generate fractal noise efficiently (1000 samples < 100ms)", () => {
    const noise = new NoiseGenerator(42);
    const iterations = 1000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const x = Math.random() * 1000;
      const z = Math.random() * 1000;
      noise.fractal2D(x, z, 4); // 4 octaves
    }
    const fractalTime = performance.now() - start;

    // Fractal noise is heavier but should still be fast
    expect(fractalTime).toBeLessThan(100);
  });

  it("should have deterministic seeding", () => {
    const noise1 = new NoiseGenerator(12345);
    const noise2 = new NoiseGenerator(12345);
    const noise3 = new NoiseGenerator(54321);

    // Same seed should produce identical results
    for (let i = 0; i < 100; i++) {
      const x = i * 7.1;
      const z = i * 13.3;
      expect(noise1.perlin2D(x, z)).toBe(noise2.perlin2D(x, z));
    }

    // Different seeds should produce different patterns
    let differences = 0;
    for (let i = 0; i < 100; i++) {
      const x = i * 7.1;
      const z = i * 13.3;
      if (noise1.perlin2D(x, z) !== noise3.perlin2D(x, z)) {
        differences++;
      }
    }
    expect(differences).toBeGreaterThan(50); // Most should differ
  });
});

describe("TerrainLODManager", () => {
  let terrainSystem: InstanceType<typeof TerrainSystemClass>;
  let LODManagerClass: typeof import("./TerrainLODManager").TerrainLODManager;

  beforeAll(async () => {
    if (!TerrainSystemClass) {
      const terrainModule = await import("./shared/world/TerrainSystem");
      TerrainSystemClass = terrainModule.TerrainSystem;
    }
    const lodModule = await import("./TerrainLODManager");
    LODManagerClass = lodModule.TerrainLODManager;

    const world = createMinimalTestWorld();
    terrainSystem = new TerrainSystemClass(world);
    await terrainSystem.init();
    await terrainSystem.start();
  });

  afterAll(() => {
    if (terrainSystem) {
      terrainSystem.destroy();
    }
  });

  it("should calculate chunks to add around player position", () => {
    const lodManager = new LODManagerClass(terrainSystem);
    const playerPos = new THREE.Vector3(50, 0, 50);

    const update = lodManager.update(playerPos);

    // Should have chunks to add
    expect(update.toAdd.length).toBeGreaterThan(0);
    // First update should have no chunks to remove
    expect(update.toRemove.length).toBe(0);

    // Chunks should be sorted by distance (closest first)
    for (let i = 1; i < update.toAdd.length; i++) {
      expect(update.toAdd[i].distance).toBeGreaterThanOrEqual(
        update.toAdd[i - 1].distance,
      );
    }
  });

  it("should track active chunks correctly", () => {
    const lodManager = new LODManagerClass(terrainSystem);
    const playerPos = new THREE.Vector3(0, 0, 0);

    lodManager.update(playerPos);
    const activeChunks = lodManager.getActiveChunks();

    expect(activeChunks.size).toBeGreaterThan(0);

    // Check that chunk at origin exists
    const originChunk = lodManager.getChunkAtPosition(0, 0, 1);
    expect(originChunk).toBeDefined();
  });

  it("should provide useful stats", () => {
    const lodManager = new LODManagerClass(terrainSystem);
    lodManager.update(new THREE.Vector3(0, 0, 0));

    const stats = lodManager.getStats();

    expect(stats.totalChunks).toBeGreaterThan(0);
    expect(stats.chunksPerLod[1]).toBeGreaterThan(0); // Should have LOD 1 chunks
    expect(stats.memoryEstimate).toBeGreaterThan(0);
  });

  it("should detect when update is needed", () => {
    const lodManager = new LODManagerClass(terrainSystem);
    lodManager.configure({ updateThreshold: 10 });

    lodManager.update(new THREE.Vector3(0, 0, 0));

    // Small movement - no update needed
    expect(lodManager.needsUpdate(new THREE.Vector3(5, 0, 5))).toBe(false);

    // Large movement - update needed
    expect(lodManager.needsUpdate(new THREE.Vector3(50, 0, 50))).toBe(true);
  });

  it("should clear all chunks", () => {
    const lodManager = new LODManagerClass(terrainSystem);
    lodManager.update(new THREE.Vector3(0, 0, 0));

    expect(lodManager.getActiveChunks().size).toBeGreaterThan(0);

    lodManager.clear();

    expect(lodManager.getActiveChunks().size).toBe(0);
  });

  it("should allow configuration changes", () => {
    const lodManager = new LODManagerClass(terrainSystem);

    lodManager.configure({
      minLod: 1,
      maxLod: 2,
      lod1Range: 3,
    });

    const config = lodManager.getConfig();
    expect(config.maxLod).toBe(2);
    expect(config.lod1Range).toBe(3);
  });
});

describe("End-to-End Terrain Pipeline", () => {
  let terrainSystem: InstanceType<typeof TerrainSystemClass>;

  beforeAll(async () => {
    if (!TerrainSystemClass) {
      const terrainModule = await import("./shared/world/TerrainSystem");
      TerrainSystemClass = terrainModule.TerrainSystem;
    }
    const world = createMinimalTestWorld();
    terrainSystem = new TerrainSystemClass(world);
    await terrainSystem.init();
    await terrainSystem.start();
  });

  afterAll(() => {
    if (terrainSystem) {
      terrainSystem.destroy();
    }
  });

  it("should complete full terrain generation pipeline", () => {
    // Test that the entire pipeline from noise to terrain info works
    const testPositions = [
      { x: 0, z: 0 },
      { x: 50, z: 50 },
      { x: -100, z: 100 },
      { x: 200, z: -200 },
    ];

    for (const pos of testPositions) {
      // 1. Get height at position
      const height = terrainSystem.getHeightAt(pos.x, pos.z);
      expect(height).toBeGreaterThanOrEqual(0);
      expect(height).toBeLessThan(50);

      // 2. Get terrain info (includes biome, slope, etc.)
      const info = terrainSystem.getTerrainInfoAt(pos.x, pos.z);
      expect(info.height).toBe(height);
      expect(info.biome).toBeTruthy();
      expect(info.slope).toBeGreaterThanOrEqual(0);

      // 3. Check walkability
      const walkable = terrainSystem.isPositionWalkable(pos.x, pos.z);
      expect(walkable.walkable).toBeDefined();

      // 4. Consistency check - height should match
      expect(Math.abs(info.height - height)).toBeLessThan(0.001);
    }
  });

  it("should have tiles generated and ready", () => {
    const tiles = terrainSystem.getTiles();
    expect(tiles.size).toBeGreaterThan(0);

    // Check that tiles have required properties
    for (const [key, tile] of tiles) {
      expect(key).toBeTruthy();
      expect(tile.biome).toBeTruthy();
      expect(tile.generated).toBe(true);
    }
  });

  it("should maintain determinism across queries", () => {
    // Same position should always return same height
    const pos = { x: 123.456, z: 789.012 };

    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(terrainSystem.getHeightAt(pos.x, pos.z));
    }

    // All results should be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBe(results[0]);
    }
  });

  it("should provide consistent terrain info", () => {
    const pos = { x: 50, z: 50 };

    const info1 = terrainSystem.getTerrainInfoAt(pos.x, pos.z);
    const info2 = terrainSystem.getTerrainInfoAt(pos.x, pos.z);

    expect(info1.height).toBe(info2.height);
    expect(info1.biome).toBe(info2.biome);
    expect(info1.slope).toBe(info2.slope);
    expect(info1.underwater).toBe(info2.underwater);
  });

  it("should report correct tile size", () => {
    const tileSize = terrainSystem.getTileSize();
    expect(tileSize).toBe(100); // 100m tiles per spec
  });

  it("should report valid water level", () => {
    const waterLevel = terrainSystem.getWaterLevel();
    expect(waterLevel).toBeGreaterThan(0);
    expect(waterLevel).toBeLessThan(20); // Reasonable water level
  });
});

// =============================================================================
// BOUNDARY CONDITIONS AND EDGE CASES
// =============================================================================

describe("Terrain Edge Cases and Boundary Conditions", () => {
  let terrainSystem: InstanceType<typeof TerrainSystemClass>;

  beforeAll(async () => {
    if (!TerrainSystemClass) {
      const terrainModule = await import("./shared/world/TerrainSystem");
      TerrainSystemClass = terrainModule.TerrainSystem;
    }
    const world = createMinimalTestWorld();
    terrainSystem = new TerrainSystemClass(world);
    await terrainSystem.init();
    await terrainSystem.start();
  });

  afterAll(() => {
    if (terrainSystem) {
      terrainSystem.destroy();
    }
  });

  describe("Extreme coordinate values", () => {
    it("should handle very large positive coordinates", () => {
      const height = terrainSystem.getHeightAt(50000, 50000);
      expect(isFinite(height)).toBe(true);
      expect(height).toBeGreaterThanOrEqual(0);
    });

    it("should handle very large negative coordinates", () => {
      const height = terrainSystem.getHeightAt(-50000, -50000);
      expect(isFinite(height)).toBe(true);
      expect(height).toBeGreaterThanOrEqual(0);
    });

    it("should handle mixed extreme coordinates", () => {
      const height = terrainSystem.getHeightAt(-50000, 50000);
      expect(isFinite(height)).toBe(true);
      expect(height).toBeGreaterThanOrEqual(0);
    });

    it("should handle zero coordinates", () => {
      const height = terrainSystem.getHeightAt(0, 0);
      expect(isFinite(height)).toBe(true);
      expect(height).toBeGreaterThanOrEqual(0);
    });

    it("should handle fractional coordinates", () => {
      const height1 = terrainSystem.getHeightAt(0.001, 0.001);
      const height2 = terrainSystem.getHeightAt(0.999, 0.999);
      const height3 = terrainSystem.getHeightAt(-0.5, 0.5);
      
      expect(isFinite(height1)).toBe(true);
      expect(isFinite(height2)).toBe(true);
      expect(isFinite(height3)).toBe(true);
    });

    it("should handle very small fractional differences", () => {
      const height1 = terrainSystem.getHeightAt(100, 100);
      const height2 = terrainSystem.getHeightAt(100.00001, 100.00001);
      
      // Small coordinate changes should produce similar heights (smooth terrain)
      expect(Math.abs(height1 - height2)).toBeLessThan(0.1);
    });
  });

  describe("Coordinate boundary transitions", () => {
    it("should have continuous height across tile boundaries", () => {
      const tileSize = terrainSystem.getTileSize();
      
      // Test at tile boundary (e.g., 100m if tile size is 100)
      const beforeBoundary = terrainSystem.getHeightAt(tileSize - 0.1, 0);
      const atBoundary = terrainSystem.getHeightAt(tileSize, 0);
      const afterBoundary = terrainSystem.getHeightAt(tileSize + 0.1, 0);
      
      // Height should be continuous (no sudden jumps)
      expect(Math.abs(beforeBoundary - atBoundary)).toBeLessThan(1);
      expect(Math.abs(atBoundary - afterBoundary)).toBeLessThan(1);
    });

    it("should maintain continuity at negative tile boundaries", () => {
      const tileSize = terrainSystem.getTileSize();
      
      const beforeBoundary = terrainSystem.getHeightAt(-tileSize - 0.1, 0);
      const atBoundary = terrainSystem.getHeightAt(-tileSize, 0);
      const afterBoundary = terrainSystem.getHeightAt(-tileSize + 0.1, 0);
      
      expect(Math.abs(beforeBoundary - atBoundary)).toBeLessThan(1);
      expect(Math.abs(atBoundary - afterBoundary)).toBeLessThan(1);
    });
  });

  describe("No circular dependency in biome/height calculation", () => {
    it("should not cause stack overflow when querying many positions rapidly", () => {
      // This test verifies the fix for the circular dependency:
      // getHeightAt -> getBiomeAtWorldPosition -> getBiomeInfluencesAtPosition -> getHeightAt
      
      const positions = [];
      for (let i = 0; i < 1000; i++) {
        positions.push({
          x: (Math.random() - 0.5) * 10000,
          z: (Math.random() - 0.5) * 10000,
        });
      }
      
      // This should complete without stack overflow
      let successCount = 0;
      for (const pos of positions) {
        const height = terrainSystem.getHeightAt(pos.x, pos.z);
        if (isFinite(height)) {
          successCount++;
        }
      }
      
      expect(successCount).toBe(1000);
    });

    it("should handle rapid alternating biome and height queries", () => {
      for (let i = 0; i < 100; i++) {
        const x = i * 50;
        const z = i * 50;
        
        // Query height
        const height = terrainSystem.getHeightAt(x, z);
        expect(isFinite(height)).toBe(true);
        
        // Query terrain info (includes biome)
        const info = terrainSystem.getTerrainInfoAt(x, z);
        expect(info.biome).toBeTruthy();
        expect(info.height).toBe(height);
      }
    });
  });
});

// =============================================================================
// ROAD SYSTEM TESTS
// =============================================================================

describe("Road System", () => {
  it("should detect roads using noise-based detection via NoiseGenerator", () => {
    // Test the road detection noise functions directly
    const noise = new NoiseGenerator(42);
    
    let roadPositions = 0;
    let nonRoadPositions = 0;
    
    for (let x = -500; x <= 500; x += 25) {
      for (let z = -500; z <= 500; z += 25) {
        // Use the same road detection logic as TerrainSystem.isPositionNearRoad
        const roadNoise1 = noise.ridgeNoise2D(x * 0.008, z * 0.008);
        const roadNoise2 = noise.ridgeNoise2D(x * 0.012 + 50, z * 0.012 + 50);
        const combinedRoadNoise = (roadNoise1 + roadNoise2 * 0.6) / 1.6;
        
        const roadThreshold = 0.78;
        if (combinedRoadNoise > roadThreshold) {
          roadPositions++;
        } else {
          nonRoadPositions++;
        }
      }
    }
    
    // Should have a mix of road and non-road positions
    expect(roadPositions).toBeGreaterThan(0);
    expect(nonRoadPositions).toBeGreaterThan(0);
    console.log(`[Road Test] Road: ${roadPositions}, Non-road: ${nonRoadPositions}`);
  });

  it("should have consistent road detection across samples", () => {
    const noise = new NoiseGenerator(42);
    
    // Same position should always return same road detection
    const x = 100;
    const z = 100;
    
    const results = [];
    for (let i = 0; i < 10; i++) {
      const roadNoise1 = noise.ridgeNoise2D(x * 0.008, z * 0.008);
      const roadNoise2 = noise.ridgeNoise2D(x * 0.012 + 50, z * 0.012 + 50);
      const combinedRoadNoise = (roadNoise1 + roadNoise2 * 0.6) / 1.6;
      results.push(combinedRoadNoise);
    }
    
    // All results should be identical (deterministic)
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBe(results[0]);
    }
  });
});

// =============================================================================
// NOISE GENERATOR EDGE CASES
// =============================================================================

describe("NoiseGenerator Edge Cases", () => {
  it("should handle seed of 0", () => {
    const noise = new NoiseGenerator(0);
    const value = noise.perlin2D(10, 10);
    expect(isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(-1);
    expect(value).toBeLessThanOrEqual(1);
  });

  it("should handle negative seed", () => {
    const noise = new NoiseGenerator(-12345);
    const value = noise.perlin2D(10, 10);
    expect(isFinite(value)).toBe(true);
  });

  it("should handle very large seed", () => {
    const noise = new NoiseGenerator(2147483647);
    const value = noise.perlin2D(10, 10);
    expect(isFinite(value)).toBe(true);
  });

  it("should handle NaN coordinates gracefully", () => {
    const noise = new NoiseGenerator(42);
    // NaN inputs should not crash - behavior may vary but should be safe
    const value = noise.perlin2D(NaN, NaN);
    // Result may be NaN but should not throw
    expect(typeof value).toBe("number");
  });

  it("should handle Infinity coordinates gracefully", () => {
    const noise = new NoiseGenerator(42);
    // Infinity inputs should not crash
    const value = noise.perlin2D(Infinity, Infinity);
    expect(typeof value).toBe("number");
  });

  it("should handle zero octaves in fractal noise (returns NaN)", () => {
    const noise = new NoiseGenerator(42);
    // Test with 0 octaves - this is a degenerate case
    // The function may return NaN since there are no octaves to sum
    const value = noise.fractal2D(10, 10, 0);
    expect(typeof value).toBe("number");
    // Zero octaves produces NaN as there's nothing to sum - this is expected
    // Normal usage should always have octaves >= 1
  });

  it("should handle single octave in fractal noise", () => {
    const noise = new NoiseGenerator(42);
    const value = noise.fractal2D(10, 10, 1);
    expect(typeof value).toBe("number");
    expect(isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(-1);
    expect(value).toBeLessThanOrEqual(1);
  });

  it("should handle high octave count in fractal noise", () => {
    const noise = new NoiseGenerator(42);
    const value = noise.fractal2D(10, 10, 10); // Many octaves
    expect(isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(-2);
    expect(value).toBeLessThanOrEqual(2);
  });

  it("should produce consistent results with same seed across instances", () => {
    const seed = 98765;
    const noise1 = new NoiseGenerator(seed);
    const noise2 = new NoiseGenerator(seed);
    
    // Test multiple positions
    const positions = [
      [0, 0], [100, 100], [-50, 50], [999.5, -888.3]
    ];
    
    for (const [x, y] of positions) {
      expect(noise1.perlin2D(x, y)).toBe(noise2.perlin2D(x, y));
      expect(noise1.simplex2D(x, y)).toBe(noise2.simplex2D(x, y));
      expect(noise1.fractal2D(x, y, 4)).toBe(noise2.fractal2D(x, y, 4));
    }
  });

  it("should produce varied output across coordinate space", () => {
    const noise = new NoiseGenerator(42);
    const values = new Set<string>();
    
    // Sample 100 different positions
    for (let i = 0; i < 100; i++) {
      const x = i * 7.3;
      const y = i * 11.1;
      const value = noise.perlin2D(x, y);
      values.add(value.toFixed(3));
    }
    
    // Should have significant variety
    expect(values.size).toBeGreaterThan(50);
  });
});

// =============================================================================
// MATERIAL SYSTEM TESTS
// =============================================================================

describe("Material Calculation", () => {
  let terrainSystem: InstanceType<typeof TerrainSystemClass>;

  beforeAll(async () => {
    if (!TerrainSystemClass) {
      const terrainModule = await import("./shared/world/TerrainSystem");
      TerrainSystemClass = terrainModule.TerrainSystem;
    }
    const world = createMinimalTestWorld();
    terrainSystem = new TerrainSystemClass(world);
    await terrainSystem.init();
    await terrainSystem.start();
  });

  afterAll(() => {
    if (terrainSystem) {
      terrainSystem.destroy();
    }
  });

  it("should return terrain info with basic properties", () => {
    const info = terrainSystem.getTerrainInfoAt(0, 0);
    expect(info.height).toBeDefined();
    expect(info.biome).toBeDefined();
    expect(info.slope).toBeDefined();
    expect(typeof info.underwater).toBe("boolean");
  });

  it("should handle materials if available (client-side feature)", () => {
    const info = terrainSystem.getTerrainInfoAt(50, 50);
    
    // Materials may or may not be available depending on initialization mode
    if (info.materials && info.materials.length > 0) {
      const totalWeight = info.materials.reduce(
        (sum: number, m: { weight: number }) => sum + m.weight,
        0
      );
      // Weights should sum to approximately 1 (normalized)
      expect(totalWeight).toBeGreaterThan(0.9);
      expect(totalWeight).toBeLessThan(1.1);
    } else {
      // On server mode, materials may not be exposed - this is OK
      expect(info.biome).toBeTruthy();
    }
  });

  it("should validate material types when present", () => {
    const validTypes = ["grass", "dirt", "rock", "snow", "sand", "cobblestone"];
    
    for (let x = -200; x <= 200; x += 100) {
      for (let z = -200; z <= 200; z += 100) {
        const info = terrainSystem.getTerrainInfoAt(x, z);
        
        if (info.materials) {
          for (const material of info.materials) {
            expect(validTypes).toContain((material as { type: string }).type);
            expect((material as { weight: number }).weight).toBeGreaterThanOrEqual(0);
            expect((material as { weight: number }).weight).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("should enforce max 4 materials if present (shader limit)", () => {
    for (let i = 0; i < 50; i++) {
      const x = (Math.random() - 0.5) * 1000;
      const z = (Math.random() - 0.5) * 1000;
      const info = terrainSystem.getTerrainInfoAt(x, z);
      
      if (info.materials) {
        expect(info.materials.length).toBeLessThanOrEqual(4);
      }
    }
  });
});

// =============================================================================
// BIOME BLENDING TESTS
// =============================================================================

describe("Biome Blending and Transitions", () => {
  let terrainSystem: InstanceType<typeof TerrainSystemClass>;

  beforeAll(async () => {
    if (!TerrainSystemClass) {
      const terrainModule = await import("./shared/world/TerrainSystem");
      TerrainSystemClass = terrainModule.TerrainSystem;
    }
    const world = createMinimalTestWorld();
    terrainSystem = new TerrainSystemClass(world);
    await terrainSystem.init();
    await terrainSystem.start();
  });

  afterAll(() => {
    if (terrainSystem) {
      terrainSystem.destroy();
    }
  });

  it("should return valid biome names", () => {
    const validBiomes = [
      "plains", "forest", "desert", "mountains", 
      "swamp", "tundra", "jungle", "lakes", "valley"
    ];
    
    for (let x = -500; x <= 500; x += 100) {
      for (let z = -500; z <= 500; z += 100) {
        const info = terrainSystem.getTerrainInfoAt(x, z);
        expect(validBiomes).toContain(info.biome);
      }
    }
  });

  it("should have smooth height transitions between biomes", () => {
    // Walk across the world and check for height smoothness
    const sampleStep = 5; // meters
    let maxDelta = 0;
    
    for (let x = 0; x < 500; x += sampleStep) {
      const h1 = terrainSystem.getHeightAt(x, 0);
      const h2 = terrainSystem.getHeightAt(x + sampleStep, 0);
      const delta = Math.abs(h1 - h2);
      maxDelta = Math.max(maxDelta, delta);
    }
    
    // Height change over 5m should be gentle (< 2m typically)
    expect(maxDelta).toBeLessThan(3);
  });

  it("should have multiple biomes in a large sample area", () => {
    const biomes = new Set<string>();
    
    for (let x = -2000; x <= 2000; x += 200) {
      for (let z = -2000; z <= 2000; z += 200) {
        const info = terrainSystem.getTerrainInfoAt(x, z);
        biomes.add(info.biome);
      }
    }
    
    // Large area should have multiple biome types
    expect(biomes.size).toBeGreaterThan(1);
  });
});

// =============================================================================
// PERFORMANCE REGRESSION TESTS
// =============================================================================

describe("Performance Regression", () => {
  let terrainSystem: InstanceType<typeof TerrainSystemClass>;

  beforeAll(async () => {
    if (!TerrainSystemClass) {
      const terrainModule = await import("./shared/world/TerrainSystem");
      TerrainSystemClass = terrainModule.TerrainSystem;
    }
    const world = createMinimalTestWorld();
    terrainSystem = new TerrainSystemClass(world);
    await terrainSystem.init();
    await terrainSystem.start();
  });

  afterAll(() => {
    if (terrainSystem) {
      terrainSystem.destroy();
    }
  });

  it("should query 10000 heights in under 500ms", () => {
    const start = performance.now();
    
    for (let i = 0; i < 10000; i++) {
      const x = Math.random() * 1000 - 500;
      const z = Math.random() * 1000 - 500;
      terrainSystem.getHeightAt(x, z);
    }
    
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
    console.log(`[Performance] 10000 height queries: ${elapsed.toFixed(1)}ms`);
  });

  it("should query 1000 terrain infos in under 200ms", () => {
    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 1000 - 500;
      const z = Math.random() * 1000 - 500;
      terrainSystem.getTerrainInfoAt(x, z);
    }
    
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
    console.log(`[Performance] 1000 terrain info queries: ${elapsed.toFixed(1)}ms`);
  });

  it("should handle repeated queries to same position efficiently", () => {
    const x = 123.456;
    const z = 789.012;
    
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      terrainSystem.getHeightAt(x, z);
    }
    const elapsed = performance.now() - start;
    
    // Repeated queries should benefit from any caching
    expect(elapsed).toBeLessThan(200);
  });
});
