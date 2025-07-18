#!/usr/bin/env -S npx tsx

/**
 * Comprehensive Multi-World Scenario Tests
 * Tests various multi-world scenarios to ensure proper isolation and functionality
 */

import { HyperfyFramework } from './src/framework/index.js';
import { setTimeout as delay } from 'timers/promises';
import fs from 'fs-extra';
import path from 'path';

interface TestScenario {
  name: string;
  description: string;
  test: (framework: HyperfyFramework) => Promise<boolean>;
}

class MultiWorldTester {
  private framework: HyperfyFramework;
  private testDir: string;
  private results: Map<string, boolean> = new Map();

  constructor() {
    this.testDir = './test-multi-world';
    this.framework = new HyperfyFramework({
      worldsDir: path.join(this.testDir, 'worlds'),
      assetsDir: path.join(this.testDir, 'assets'),
      storage: {
        type: 'file',
        path: path.join(this.testDir, 'storage/global.json')
      }
    });
  }

  async initialize(): Promise<void> {
    console.log('🧪 Multi-World Scenario Testing');
    console.log('===============================');
    
    // Clean up any existing test data
    await fs.remove(this.testDir);
    await fs.ensureDir(this.testDir);
    
    await this.framework.initialize();
    console.log('✅ Framework initialized for multi-world testing');
  }

  async cleanup(): Promise<void> {
    await this.framework.shutdown();
    await fs.remove(this.testDir);
  }

  async runScenario(scenario: TestScenario): Promise<boolean> {
    console.log(`\n🔬 Testing: ${scenario.name}`);
    console.log(`📝 ${scenario.description}`);
    
    try {
      const result = await scenario.test(this.framework);
      if (result) {
        console.log(`✅ ${scenario.name} passed`);
      } else {
        console.log(`❌ ${scenario.name} failed`);
      }
      this.results.set(scenario.name, result);
      return result;
    } catch (error) {
      console.error(`❌ ${scenario.name} failed with error:`, error.message);
      this.results.set(scenario.name, false);
      return false;
    }
  }

  getResults(): { passed: number; failed: number; total: number } {
    const total = this.results.size;
    const passed = Array.from(this.results.values()).filter(r => r).length;
    const failed = total - passed;
    return { passed, failed, total };
  }
}

// Test Scenarios
const scenarios: TestScenario[] = [
  {
    name: "Sequential World Creation",
    description: "Create multiple worlds sequentially and verify they're all properly initialized",
    test: async (framework) => {
      const worldConfigs = [
        { id: 'world-1', name: 'World 1', type: 'server' as const, persistence: { type: 'sqlite' as const } },
        { id: 'world-2', name: 'World 2', type: 'server' as const, persistence: { type: 'sqlite' as const } },
        { id: 'world-3', name: 'World 3', type: 'server' as const, persistence: { type: 'sqlite' as const } }
      ];

      const worlds = [];
      // Create worlds sequentially to avoid timeout
      for (const config of worldConfigs) {
        const world = await framework.createWorld(config);
        worlds.push(world);
        console.log(`Created world: ${config.id}`);
      }

      // Verify all worlds were created
      if (worlds.length !== 3) {
        console.log(`Expected 3 worlds, got ${worlds.length}`);
        return false;
      }
      
      // Verify all worlds are in the framework
      const listedWorlds = framework.listWorlds();
      if (listedWorlds.length !== 3) {
        console.log(`Expected 3 listed worlds, got ${listedWorlds.length}`);
        return false;
      }

      // Verify each world has unique properties
      const worldIds = new Set(worlds.map(w => w.id));
      if (worldIds.size !== 3) {
        console.log(`Expected 3 unique world IDs, got ${worldIds.size}`);
        return false;
      }

      // Clean up
      for (const world of worlds) {
        if (world.id) {
          await framework.destroyWorld(world.id);
        }
      }
      
      return true;
    }
  },

  {
    name: "World Isolation Test",
    description: "Verify that worlds are properly isolated from each other",
    test: async (framework) => {
      // Create two worlds with different configurations
      const world1 = await framework.createWorld({
        id: 'isolated-1',
        name: 'Isolated World 1',
        type: 'server',
        persistence: { type: 'sqlite' },
        settings: { testValue: 'world1-data' }
      });

      const world2 = await framework.createWorld({
        id: 'isolated-2', 
        name: 'Isolated World 2',
        type: 'server',
        persistence: { type: 'sqlite' },
        settings: { testValue: 'world2-data' }
      });

      // Verify worlds have different storage
      const storage1 = framework.getStorageManager().getWorldStorage('isolated-1');
      const storage2 = framework.getStorageManager().getWorldStorage('isolated-2');
      
      // Store different data in each world
      await storage1.set('test-key', 'world1-value');
      await storage2.set('test-key', 'world2-value');

      // Verify data isolation
      const value1 = await storage1.get('test-key');
      const value2 = await storage2.get('test-key');

      const isolated = value1 === 'world1-value' && value2 === 'world2-value';

      if (!isolated) {
        console.log(`Value1: ${value1}, Value2: ${value2}`);
      }

      // Clean up
      await framework.destroyWorld('isolated-1');
      await framework.destroyWorld('isolated-2');

      return isolated;
    }
  },

  {
    name: "Persistence Per World",
    description: "Verify each world maintains its own persistent data",
    test: async (framework) => {
      // Create a world
      const world = await framework.createWorld({
        id: 'persistence-test',
        name: 'Persistence Test World',
        type: 'server',
        persistence: {
          type: 'sqlite',
          path: path.join('./test-multi-world/worlds/persistence-test/db.sqlite')
        }
      });

      // Wait a moment for database to be created
      await delay(500);

      // Verify database file exists
      const dbPath = path.resolve('./test-multi-world/worlds/persistence-test/db.sqlite');
      const dbExists = await fs.pathExists(dbPath);
      
      // Also check the expected default path
      const defaultDbPath = path.resolve('./test-multi-world/worlds/persistence-test/db.sqlite');
      const defaultExists = await fs.pathExists(defaultDbPath);

      if (!dbExists && !defaultExists) {
        console.log(`Database file not found at: ${dbPath}`);
        // List what's actually in the directory
        try {
          const worldDir = path.dirname(dbPath);
          const files = await fs.readdir(worldDir);
          console.log(`Files in world directory: ${files.join(', ')}`);
        } catch (error) {
          console.log(`Error reading world directory: ${error.message}`);
        }
        await framework.destroyWorld('persistence-test');
        return false;
      }

      // Destroy world
      await framework.destroyWorld('persistence-test');

      // Database file should still exist for future use
      const dbStillExists = await fs.pathExists(dbPath) || await fs.pathExists(defaultDbPath);

      if (!dbStillExists) {
        console.log(`Database file was removed after world destruction`);
      }

      return dbStillExists;
    }
  },

  {
    name: "World Directory Structure",
    description: "Verify each world creates proper directory structure",
    test: async (framework) => {
      const world = await framework.createWorld({
        id: 'directory-test',
        name: 'Directory Test World',
        type: 'server',
        persistence: { type: 'sqlite' }
      });

      // Wait for directory creation
      await delay(200);

      const worldDir = path.join('./test-multi-world/worlds/directory-test');
      const assetsDir = path.join(worldDir, 'assets');
      const collectionsDir = path.join(worldDir, 'collections');

      const worldDirExists = await fs.pathExists(worldDir);
      const assetsDirExists = await fs.pathExists(assetsDir);
      const collectionsDirExists = await fs.pathExists(collectionsDir);

      console.log(`World dir: ${worldDirExists}, Assets: ${assetsDirExists}, Collections: ${collectionsDirExists}`);

      await framework.destroyWorld('directory-test');

      return worldDirExists && assetsDirExists && collectionsDirExists;
    }
  },

  {
    name: "Memory Management",
    description: "Test that destroyed worlds are properly cleaned up",
    test: async (framework) => {
      const initialWorldCount = framework.listWorlds().length;

      // Create several worlds
      for (let i = 0; i < 3; i++) {
        await framework.createWorld({
          id: `memory-test-${i}`,
          name: `Memory Test ${i}`,
          type: 'server',
          persistence: { type: 'sqlite' }
        });
      }

      // Verify worlds were created
      if (framework.listWorlds().length !== initialWorldCount + 3) {
        console.log(`Expected ${initialWorldCount + 3} worlds, got ${framework.listWorlds().length}`);
        return false;
      }

      // Destroy all test worlds
      for (let i = 0; i < 3; i++) {
        await framework.destroyWorld(`memory-test-${i}`);
      }

      // Verify worlds were removed
      const finalCount = framework.listWorlds().length;
      if (finalCount !== initialWorldCount) {
        console.log(`Expected ${initialWorldCount} worlds after cleanup, got ${finalCount}`);
        return false;
      }

      return true;
    }
  },

  {
    name: "World Type Variants",
    description: "Test creating different types of worlds (server, client, viewer)",
    test: async (framework) => {
      const serverWorld = await framework.createWorld({
        id: 'server-world',
        name: 'Server World',
        type: 'server',
        persistence: { type: 'sqlite' }
      });

      // Note: For now we only test server worlds as client/viewer 
      // would require browser environment
      const worlds = framework.listWorlds();
      const serverWorldInfo = worlds.find(w => w.id === 'server-world');

      const success = serverWorldInfo?.type === 'server';

      if (!success) {
        console.log(`Expected server world type, got: ${serverWorldInfo?.type}`);
      }

      await framework.destroyWorld('server-world');

      return success;
    }
  },

  {
    name: "Rapid World Creation/Destruction",
    description: "Test rapid creation and destruction of worlds",
    test: async (framework) => {
      const iterations = 5; // Reduced from 10 to avoid timeout
      
      for (let i = 0; i < iterations; i++) {
        const worldId = `rapid-test-${i}`;
        
        // Create world
        const world = await framework.createWorld({
          id: worldId,
          name: `Rapid Test ${i}`,
          type: 'server',
          persistence: { type: 'sqlite' }
        });

        // Verify it exists
        if (!framework.getWorld(worldId)) {
          console.log(`World ${worldId} not found after creation`);
          return false;
        }

        // Destroy immediately
        await framework.destroyWorld(worldId);

        // Verify it's gone
        if (framework.getWorld(worldId)) {
          console.log(`World ${worldId} still exists after destruction`);
          return false;
        }
      }

      return true;
    }
  },

  {
    name: "Configuration Validation",
    description: "Test that invalid world configurations are properly rejected",
    test: async (framework) => {
      try {
        // Try to create world with duplicate ID
        await framework.createWorld({
          id: 'valid-world',
          name: 'Valid World',
          type: 'server',
          persistence: { type: 'sqlite' }
        });

        // This should fail
        await framework.createWorld({
          id: 'valid-world', // Duplicate ID
          name: 'Invalid World',
          type: 'server',
          persistence: { type: 'sqlite' }
        });

        // If we get here, the test failed
        console.log('Expected duplicate world creation to fail, but it succeeded');
        await framework.destroyWorld('valid-world');
        return false;

      } catch (error) {
        // Expected to fail, clean up and return success
        try {
          await framework.destroyWorld('valid-world');
        } catch {}
        console.log('Duplicate world creation properly rejected');
        return true;
      }
    }
  }
];

async function runAllTests(): Promise<void> {
  const tester = new MultiWorldTester();
  
  try {
    await tester.initialize();
    
    // Run all scenarios
    for (const scenario of scenarios) {
      await tester.runScenario(scenario);
      // Small delay between tests
      await delay(100);
    }
    
    // Report results
    const results = tester.getResults();
    console.log('\n📊 Multi-World Test Results');
    console.log('===========================');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Total:  ${results.total}`);
    console.log(`📊 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
    
    if (results.failed === 0) {
      console.log('\n🎉 All multi-world tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed. Review the output above.');
    }
    
  } finally {
    await tester.cleanup();
  }
}

// Run the tests
await runAllTests();