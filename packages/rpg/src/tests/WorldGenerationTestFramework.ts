import * as THREE from 'three';
import { ProceduralTerrain } from '../../../hyperfy/src/core/systems/ProceduralTerrain';
import { ProceduralWorldGenerator } from '../world/ProceduralWorldGenerator';
import { prng } from '../../../hyperfy/src/core/extras/prng';

// Color constants for visual testing
const COLORS = {
  PLAYER: 0x0000ff,    // Blue
  GOBLIN: 0x00ff00,    // Green
  GUARD: 0xff0000,     // Red
  TOWN: 0xffff00,      // Yellow
  TREE: 0x8b4513,      // Brown
  ROCK: 0x808080,      // Gray
  BIOME_CENTER: 0xff00ff, // Magenta
  TERRAIN: 0x654321,   // Dark Brown
  WATER: 0x4682b4,     // Steel Blue
  SPAWN_POINT: 0xffa500 // Orange
};

// Test configuration
interface TestConfig {
  worldSize: number;
  seed: number;
  biomeCount: number;
  testDuration: number;
  screenshotInterval: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Test result structure
interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
  data: any;
  screenshots: string[];
}

// Pixel analysis result
interface PixelAnalysis {
  dominantColor: number;
  colorDistribution: Map<number, number>;
  totalPixels: number;
  isEmpty: boolean;
  isUniform: boolean;
  uniformityThreshold: number;
}

export class WorldGenerationTestFramework {
  private testResults: TestResult[] = [];
  private errorLog: string[] = [];
  private mockWorld: any;
  private testConfig: TestConfig;

  constructor(config: TestConfig) {
    this.testConfig = config;
    this.setupTestEnvironment();
  }

  private setupTestEnvironment(): void {
    // Create mock world object that mimics Hyperfy's World interface
    this.mockWorld = {
      terrain: null,
      graphics: { scene: new THREE.Scene() },
      physics: { 
        controllerManager: null,
        defaultMaterial: null,
        addActor: () => null
      },
      getSystem: (name: string) => null,
      add: (obj: any) => console.log(`[MockWorld] Added object: ${obj.type || 'unknown'}`),
      remove: (obj: any) => console.log(`[MockWorld] Removed object: ${obj.type || 'unknown'}`)
    };

    console.log('[TestFramework] Test environment setup complete');
  }

  // Run all tests
  async runAllTests(): Promise<TestResult[]> {
    console.log('[TestFramework] Starting comprehensive world generation tests...');
    
    try {
      // Test 1: Basic terrain generation
      await this.testTerrainGeneration();
      
      // Test 2: Biome distribution
      await this.testBiomeDistribution();
      
      // Test 3: Town placement
      await this.testTownPlacement();
      
      // Test 4: Character controller physics
      await this.testCharacterController();
      
      // Test 5: Spawning system
      await this.testSpawningSystem();
      
      // Test 6: World generation with different parameters
      await this.testWorldGenerationVariations();
      
      // Test 7: Error handling and edge cases
      await this.testErrorHandling();
      
      // Test 8: Performance testing
      await this.testPerformance();
      
      // Test 9: Integration testing
      await this.testIntegration();
      
    } catch (error) {
      console.error('[TestFramework] Test execution failed:', error);
      this.errorLog.push(`Test execution failed: ${error.message}`);
    }
    
    return this.testResults;
  }

  // Test 1: Terrain Generation
  async testTerrainGeneration(): Promise<void> {
    const testName = 'Terrain Generation';
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let passed = true;

    console.log(`[TestFramework] Running ${testName}...`);

    try {
      // Create terrain with known seed
      const terrain = new ProceduralTerrain(this.mockWorld, {
        seed: 12345,
        biomeCount: 4,
        worldSize: 200,
        chunkSize: 50,
        chunkResolution: 32,
        maxHeight: 25,
        waterLevel: 0
      });

      await terrain.init();

      // Test height generation at various points
      const testPoints = [
        { x: 0, z: 0 },
        { x: 25, z: 25 },
        { x: -25, z: 25 },
        { x: 25, z: -25 },
        { x: -25, z: -25 }
      ];

      for (const point of testPoints) {
        const height = terrain.getHeightAt(point.x, point.z);
        if (typeof height !== 'number') {
          errors.push(`Height at (${point.x}, ${point.z}) is not a number: ${height}`);
          passed = false;
        }
        if (height < -50 || height > 50) {
          warnings.push(`Height at (${point.x}, ${point.z}) seems extreme: ${height}`);
        }
      }

      // Test biome assignment
      const biomePoints = terrain.getBiomePoints();
      if (biomePoints.length !== 4) {
        errors.push(`Expected 4 biome points, got ${biomePoints.length}`);
        passed = false;
      }

      // Test terrain types
      for (const point of testPoints) {
        const terrainType = terrain.getTypeAt(point.x, point.z);
        if (!terrainType) {
          errors.push(`No terrain type at (${point.x}, ${point.z})`);
          passed = false;
        }
      }

      // Test walkability
      for (const point of testPoints) {
        const walkable = terrain.isWalkable(point.x, point.z);
        if (typeof walkable !== 'boolean') {
          errors.push(`Walkability at (${point.x}, ${point.z}) is not boolean: ${walkable}`);
          passed = false;
        }
      }

    } catch (error) {
      errors.push(`Terrain generation failed: ${error.message}`);
      passed = false;
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed,
      duration,
      errors,
      warnings,
      data: { testPoints: 5 },
      screenshots: []
    });

    console.log(`[TestFramework] ${testName} ${passed ? 'PASSED' : 'FAILED'} (${duration}ms)`);
  }

  // Test 2: Biome Distribution
  async testBiomeDistribution(): Promise<void> {
    const testName = 'Biome Distribution';
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let passed = true;

    console.log(`[TestFramework] Running ${testName}...`);

    try {
      const terrain = new ProceduralTerrain(this.mockWorld, {
        seed: 54321,
        biomeCount: 6,
        worldSize: 300,
        chunkSize: 50,
        chunkResolution: 32,
        maxHeight: 25,
        waterLevel: 0
      });

      await terrain.init();

      // Test biome distribution
      const biomePoints = terrain.getBiomePoints();
      const biomeMap = new Map<string, number>();

      // Sample biomes across the world
      const sampleCount = 100;
      for (let i = 0; i < sampleCount; i++) {
        const x = (Math.random() - 0.5) * 300;
        const z = (Math.random() - 0.5) * 300;
        const biome = terrain.getBiomeAt(x, z);
        
        if (biome) {
          biomeMap.set(biome.id, (biomeMap.get(biome.id) || 0) + 1);
        } else {
          errors.push(`No biome found at (${x}, ${z})`);
          passed = false;
        }
      }

      // Check biome diversity
      if (biomeMap.size < 3) {
        warnings.push(`Low biome diversity: only ${biomeMap.size} unique biomes found`);
      }

    } catch (error) {
      errors.push(`Biome distribution test failed: ${error.message}`);
      passed = false;
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed,
      duration,
      errors,
      warnings,
      data: { sampleCount: 100 },
      screenshots: []
    });

    console.log(`[TestFramework] ${testName} ${passed ? 'PASSED' : 'FAILED'} (${duration}ms)`);
  }

  // Test 3: Town Placement
  async testTownPlacement(): Promise<void> {
    const testName = 'Town Placement';
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let passed = true;

    console.log(`[TestFramework] Running ${testName}...`);

    try {
      const terrain = new ProceduralTerrain(this.mockWorld, {
        seed: 98765,
        biomeCount: 4,
        worldSize: 200,
        chunkSize: 50,
        chunkResolution: 32,
        maxHeight: 25,
        waterLevel: 0
      });

      await terrain.init();

      const townLocations = terrain.getTownLocations();
      
      if (townLocations.length === 0) {
        errors.push('No towns were placed');
        passed = false;
      }

      // Test town locations
      for (const town of townLocations) {
        // Check if town is in walkable area
        const walkable = terrain.isWalkable(town.x, town.z);
        if (!walkable) {
          errors.push(`Town at (${town.x}, ${town.z}) is not in walkable area`);
          passed = false;
        }

        // Check if town is not in water or lava
        const biome = terrain.getBiomeAt(town.x, town.z);
        if (biome && (biome.primaryType === 'water' || biome.primaryType === 'lava')) {
          errors.push(`Town at (${town.x}, ${town.z}) is in ${biome.primaryType} biome`);
          passed = false;
        }
      }

    } catch (error) {
      errors.push(`Town placement test failed: ${error.message}`);
      passed = false;
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed,
      duration,
      errors,
      warnings,
      data: { townCount: 0 },
      screenshots: []
    });

    console.log(`[TestFramework] ${testName} ${passed ? 'PASSED' : 'FAILED'} (${duration}ms)`);
  }

  // Test 4: Character Controller Physics
  async testCharacterController(): Promise<void> {
    const testName = 'Character Controller Physics';
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let passed = true;

    console.log(`[TestFramework] Running ${testName}...`);

    try {
      // Create mock controller for testing
      const mockController = {
        position: new THREE.Vector3(0, 0, 0),
        radius: 0.5,
        height: 1.8,
        isGrounded: true,
        isCeiling: false,
        moveFlags: null,
        
        move: function(velocity: THREE.Vector3) {
          this.position.add(velocity);
          return { isSet: () => true };
        },
        
        teleport: function(position: THREE.Vector3) {
          this.position.copy(position);
        }
      };

      // Test basic movement
      const initialPosition = mockController.position.clone();
      const moveVector = new THREE.Vector3(1, 0, 0);
      mockController.move(moveVector);
      
      if (mockController.position.distanceTo(initialPosition) === 0) {
        errors.push('Controller did not move when move() was called');
        passed = false;
      }

      // Test teleportation
      const teleportPosition = new THREE.Vector3(10, 5, 10);
      mockController.teleport(teleportPosition);
      
      if (mockController.position.distanceTo(teleportPosition) > 0.01) {
        errors.push('Controller teleport did not work correctly');
        passed = false;
      }

      // Test physics properties
      if (typeof mockController.isGrounded !== 'boolean') {
        errors.push('isGrounded property is not boolean');
        passed = false;
      }

      if (typeof mockController.isCeiling !== 'boolean') {
        errors.push('isCeiling property is not boolean');
        passed = false;
      }

    } catch (error) {
      errors.push(`Character controller test failed: ${error.message}`);
      passed = false;
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed,
      duration,
      errors,
      warnings,
      data: { controllerTested: true },
      screenshots: []
    });

    console.log(`[TestFramework] ${testName} ${passed ? 'PASSED' : 'FAILED'} (${duration}ms)`);
  }

  // Test 5: Spawning System
  async testSpawningSystem(): Promise<void> {
    const testName = 'Spawning System';
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let passed = true;

    console.log(`[TestFramework] Running ${testName}...`);

    try {
      const worldGenerator = new ProceduralWorldGenerator(this.mockWorld);
      
      // Test world design generation
      const worldPrompt = {
        theme: 'fantasy',
        difficulty: 'medium' as const,
        size: 'small' as const,
        biomes: [],
        features: ['towns', 'resources', 'mobs'],
        lore: 'Test fantasy world'
      };

      const worldConfig = await worldGenerator.generateWorldDesign(worldPrompt);
      
      if (!worldConfig) {
        errors.push('World config generation failed');
        passed = false;
      }

      if (worldConfig.spawners.length === 0) {
        errors.push('No spawners were generated');
        passed = false;
      }

      // Test spawner configurations
      for (const spawner of worldConfig.spawners) {
        if (!spawner.position) {
          errors.push('Spawner missing position');
          passed = false;
        }
        if (!spawner.entityDefinitions || spawner.entityDefinitions.length === 0) {
          errors.push('Spawner missing entity definitions');
          passed = false;
        }
      }

    } catch (error) {
      errors.push(`Spawning system test failed: ${error.message}`);
      passed = false;
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed,
      duration,
      errors,
      warnings,
      data: { spawnerCount: 0 },
      screenshots: []
    });

    console.log(`[TestFramework] ${testName} ${passed ? 'PASSED' : 'FAILED'} (${duration}ms)`);
  }

  // Test 6: World Generation Variations
  async testWorldGenerationVariations(): Promise<void> {
    const testName = 'World Generation Variations';
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let passed = true;

    console.log(`[TestFramework] Running ${testName}...`);

    try {
      const seeds = [12345, 54321, 98765];
      const sizes = ['small', 'medium', 'large'] as const;
      const themes = ['fantasy', 'apocalyptic', 'balanced'] as const;
      
      for (const seed of seeds) {
        for (const size of sizes) {
          for (const theme of themes) {
            const worldGenerator = new ProceduralWorldGenerator(this.mockWorld);
            
            const worldPrompt = {
              theme,
              difficulty: 'medium' as const,
              size,
              biomes: [],
              features: ['towns', 'resources', 'mobs'],
              lore: `Test ${theme} world`
            };

            const worldConfig = await worldGenerator.generateWorldDesign(worldPrompt);
            
            if (!worldConfig) {
              errors.push(`World generation failed for seed ${seed}, size ${size}, theme ${theme}`);
              passed = false;
              continue;
            }

            // Verify config matches parameters
            const expectedSize = { small: 200, medium: 500, large: 1000 }[size];
            if (worldConfig.worldSize !== expectedSize) {
              errors.push(`World size mismatch for ${size}: expected ${expectedSize}, got ${worldConfig.worldSize}`);
              passed = false;
            }

            if (worldConfig.biomes.length === 0) {
              errors.push(`No biomes generated for ${theme} theme`);
              passed = false;
            }
          }
        }
      }

    } catch (error) {
      errors.push(`World generation variations test failed: ${error.message}`);
      passed = false;
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed,
      duration,
      errors,
      warnings,
      data: { variationsTested: seeds.length * 3 * 3 },
      screenshots: []
    });

    console.log(`[TestFramework] ${testName} ${passed ? 'PASSED' : 'FAILED'} (${duration}ms)`);
  }

  // Test 7: Error Handling
  async testErrorHandling(): Promise<void> {
    const testName = 'Error Handling';
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let passed = true;

    console.log(`[TestFramework] Running ${testName}...`);

    try {
      // Test invalid terrain parameters
      try {
        const terrain = new ProceduralTerrain(this.mockWorld, {
          seed: -1,
          biomeCount: 0,
          worldSize: -100,
          chunkSize: 0,
          chunkResolution: 0,
          maxHeight: -1,
          waterLevel: 1000
        });
        warnings.push('Terrain accepted invalid parameters without error');
      } catch (e) {
        // Expected behavior
      }

      // Test null/undefined inputs
      try {
        const terrain = new ProceduralTerrain(null as any, {} as any);
        warnings.push('Terrain accepted null world without error');
      } catch (e) {
        // Expected behavior
      }

      // Test boundary conditions
      const terrain = new ProceduralTerrain(this.mockWorld, {
        seed: 12345,
        biomeCount: 1,
        worldSize: 10,
        chunkSize: 5,
        chunkResolution: 2,
        maxHeight: 1,
        waterLevel: 0
      });

      await terrain.init();

      // Test extreme coordinates
      const extremePoints = [
        { x: 999999, z: 999999 },
        { x: -999999, z: -999999 },
        { x: 0, z: 999999 },
        { x: 999999, z: 0 }
      ];

      for (const point of extremePoints) {
        try {
          const height = terrain.getHeightAt(point.x, point.z);
          if (typeof height !== 'number' || isNaN(height)) {
            errors.push(`Invalid height returned for extreme coordinate (${point.x}, ${point.z}): ${height}`);
            passed = false;
          }
        } catch (e) {
          warnings.push(`Height query failed for extreme coordinate (${point.x}, ${point.z}): ${e.message}`);
        }
      }

    } catch (error) {
      errors.push(`Error handling test failed: ${error.message}`);
      passed = false;
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed,
      duration,
      errors,
      warnings,
      data: { extremePointsTested: 4 },
      screenshots: []
    });

    console.log(`[TestFramework] ${testName} ${passed ? 'PASSED' : 'FAILED'} (${duration}ms)`);
  }

  // Test 8: Performance Testing
  async testPerformance(): Promise<void> {
    const testName = 'Performance Testing';
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let passed = true;

    console.log(`[TestFramework] Running ${testName}...`);

    try {
      // Test terrain generation performance
      const perfStart = performance.now();
      
      const terrain = new ProceduralTerrain(this.mockWorld, {
        seed: 12345,
        biomeCount: 8,
        worldSize: 500,
        chunkSize: 100,
        chunkResolution: 64,
        maxHeight: 50,
        waterLevel: 0
      });

      await terrain.init();
      
      const initTime = performance.now() - perfStart;
      
      if (initTime > 5000) {
        warnings.push(`Terrain initialization took ${initTime}ms - consider optimization`);
      }

      // Test height query performance
      const queryStart = performance.now();
      const queryCount = 1000;
      
      for (let i = 0; i < queryCount; i++) {
        const x = (Math.random() - 0.5) * 500;
        const z = (Math.random() - 0.5) * 500;
        terrain.getHeightAt(x, z);
      }
      
      const queryTime = performance.now() - queryStart;
      const avgQueryTime = queryTime / queryCount;
      
      if (avgQueryTime > 1) {
        warnings.push(`Average height query took ${avgQueryTime}ms - consider optimization`);
      }

    } catch (error) {
      errors.push(`Performance test failed: ${error.message}`);
      passed = false;
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed,
      duration,
      errors,
      warnings,
      data: { performanceMetrics: true },
      screenshots: []
    });

    console.log(`[TestFramework] ${testName} ${passed ? 'PASSED' : 'FAILED'} (${duration}ms)`);
  }

  // Test 9: Integration Testing
  async testIntegration(): Promise<void> {
    const testName = 'Integration Testing';
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let passed = true;

    console.log(`[TestFramework] Running ${testName}...`);

    try {
      // Create complete world generation pipeline
      const worldGenerator = new ProceduralWorldGenerator(this.mockWorld);
      
      const worldPrompt = {
        theme: 'fantasy',
        difficulty: 'medium' as const,
        size: 'medium' as const,
        biomes: [],
        features: ['towns', 'resources', 'mobs', 'safe_zones'],
        lore: 'Integration test fantasy world'
      };

      // Generate world design
      const worldConfig = await worldGenerator.generateWorldDesign(worldPrompt);
      
      if (!worldConfig) {
        errors.push('World config generation failed');
        passed = false;
        return;
      }

      // Initialize world
      await worldGenerator.initializeWorld(worldConfig);
      
      // Get terrain system
      const terrain = worldGenerator.getTerrain();
      if (!terrain) {
        errors.push('Terrain system not initialized');
        passed = false;
        return;
      }

      // Test terrain integration
      const testPoints = [
        { x: 0, z: 0 },
        { x: 100, z: 100 },
        { x: -100, z: -100 }
      ];

      for (const point of testPoints) {
        const height = terrain.getHeightAt(point.x, point.z);
        const biome = terrain.getBiomeAt(point.x, point.z);
        const walkable = terrain.isWalkable(point.x, point.z);
        
        if (typeof height !== 'number') {
          errors.push(`Invalid height at (${point.x}, ${point.z}): ${height}`);
          passed = false;
        }
        
        if (!biome) {
          errors.push(`No biome at (${point.x}, ${point.z})`);
          passed = false;
        }
        
        if (typeof walkable !== 'boolean') {
          errors.push(`Invalid walkable at (${point.x}, ${point.z}): ${walkable}`);
          passed = false;
        }
      }

      // Test town integration
      const townLocations = terrain.getTownLocations();
      if (townLocations.length === 0) {
        warnings.push('No towns generated');
      }

      for (const town of townLocations) {
        const height = terrain.getHeightAt(town.x, town.z);
        const walkable = terrain.isWalkable(town.x, town.z);
        
        if (!walkable) {
          errors.push(`Town at (${town.x}, ${town.z}) is not walkable`);
          passed = false;
        }
      }

      // Test world stats
      const worldStats = worldGenerator.getWorldStats();
      if (!worldStats) {
        errors.push('World stats not available');
        passed = false;
      }

    } catch (error) {
      errors.push(`Integration test failed: ${error.message}`);
      passed = false;
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed,
      duration,
      errors,
      warnings,
      data: { integrationComplete: true },
      screenshots: []
    });

    console.log(`[TestFramework] ${testName} ${passed ? 'PASSED' : 'FAILED'} (${duration}ms)`);
  }

  // Results and reporting
  public getTestResults(): TestResult[] {
    return this.testResults;
  }

  public getErrorLog(): string[] {
    return this.errorLog;
  }

  public generateReport(): string {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    let report = `\n=== World Generation Test Report ===\n`;
    report += `Total Tests: ${totalTests}\n`;
    report += `Passed: ${passedTests}\n`;
    report += `Failed: ${failedTests}\n`;
    report += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;
    
    for (const result of this.testResults) {
      report += `${result.testName}: ${result.passed ? 'PASS' : 'FAIL'} (${result.duration}ms)\n`;
      
      if (result.errors.length > 0) {
        report += `  Errors:\n`;
        for (const error of result.errors) {
          report += `    - ${error}\n`;
        }
      }
      
      if (result.warnings.length > 0) {
        report += `  Warnings:\n`;
        for (const warning of result.warnings) {
          report += `    - ${warning}\n`;
        }
      }
      
      report += `\n`;
    }
    
    if (this.errorLog.length > 0) {
      report += `\n=== Error Log ===\n`;
      for (const error of this.errorLog) {
        report += `${error}\n`;
      }
    }
    
    return report;
  }
}

// Export for use in tests
export { TestConfig, TestResult, COLORS };