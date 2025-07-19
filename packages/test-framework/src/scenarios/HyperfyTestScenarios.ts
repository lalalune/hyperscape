import { TestScenario, TestContext, TestValidation } from '../types';
import { HyperfyFramework, WorldConfig } from '../hyperfy';

/**
 * Standard test scenarios for Hyperfy worlds and applications
 */
export class HyperfyTestScenarios {
  
  /**
   * Test basic world creation and initialization
   */
  static createWorldCreationTest(): TestScenario {
    return {
      id: 'world-creation',
      name: 'World Creation Test',
      description: 'Test that worlds can be created and initialized properly',
      category: 'core',
      tags: ['world', 'initialization'],
      timeout: 30000,

      async setup(context: TestContext): Promise<void> {
        context.log('Setting up world creation test');
        context.data.set('worldConfig', {
          id: 'test-world',
          name: 'Test World',
          type: 'server',
          persistence: { type: 'sqlite' }
        });
      },

      async execute(context: TestContext): Promise<void> {
        const framework = new HyperfyFramework();
        await framework.initialize();
        
        const worldConfig = context.data.get('worldConfig') as WorldConfig;
        const world = await framework.createWorld(worldConfig);
        
        context.data.set('framework', framework);
        context.data.set('world', world);
        
        context.log(`World created successfully: ${(world as any).id || 'unknown-id'}`);
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const world = context.data.get('world');
        const failures = [];

        if (!world) {
          failures.push({
            type: 'assertion' as const,
            message: 'World was not created',
            expected: 'World object',
            actual: world
          });
        }

        if (world && !world.id) {
          failures.push({
            type: 'assertion' as const,
            message: 'World does not have an ID',
            expected: 'string',
            actual: world.id
          });
        }

        if (world && world.systems.length === 0) {
          failures.push({
            type: 'assertion' as const,
            message: 'World has no systems',
            expected: 'Array with length > 0',
            actual: world.systems.length
          });
        }

        return {
          passed: failures.length === 0,
          failures,
          warnings: []
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        const framework = context.data.get('framework');
        if (framework) {
          const world = context.data.get('world');
          if (world && world.id) {
            await framework.destroyWorld(world.id);
          }
          await framework.shutdown();
        }
        context.log('World creation test cleanup complete');
      }
    };
  }

  /**
   * Test multi-world isolation
   */
  static createMultiWorldIsolationTest(): TestScenario {
    return {
      id: 'multi-world-isolation',
      name: 'Multi-World Isolation Test',
      description: 'Test that multiple worlds are properly isolated from each other',
      category: 'core',
      tags: ['world', 'isolation', 'multi-world'],
      timeout: 60000,

      async setup(context: TestContext): Promise<void> {
        context.log('Setting up multi-world isolation test');
        const framework = new HyperfyFramework();
        await framework.initialize();
        context.data.set('framework', framework);
      },

      async execute(context: TestContext): Promise<void> {
        const framework = context.data.get('framework') as HyperfyFramework;
        
        // Create two worlds
        const world1 = await framework.createWorld({
          id: 'isolation-test-1',
          name: 'Isolation Test World 1',
          type: 'server',
          persistence: { type: 'sqlite' },
          settings: { testData: 'world1-data' }
        });

        const world2 = await framework.createWorld({
          id: 'isolation-test-2',
          name: 'Isolation Test World 2',
          type: 'server',
          persistence: { type: 'sqlite' },
          settings: { testData: 'world2-data' }
        });

        // Store different data in each world's storage
        const storage1 = framework.getStorageManager().getWorldStorage('isolation-test-1');
        const storage2 = framework.getStorageManager().getWorldStorage('isolation-test-2');

        await storage1.set('test-key', 'world1-value');
        await storage2.set('test-key', 'world2-value');

        context.data.set('world1', world1);
        context.data.set('world2', world2);
        context.data.set('storage1', storage1);
        context.data.set('storage2', storage2);

        context.log('Created two isolated worlds');
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const world1 = context.data.get('world1');
        const world2 = context.data.get('world2');
        const storage1 = context.data.get('storage1');
        const storage2 = context.data.get('storage2');
        const failures = [];

        // Verify worlds have different IDs
        if (world1.id === world2.id) {
          failures.push({
            type: 'assertion' as const,
            message: 'Worlds have the same ID',
            expected: 'Different IDs',
            actual: `Both: ${world1.id}`
          });
        }

        // Verify storage isolation
        const value1 = await storage1.get('test-key');
        const value2 = await storage2.get('test-key');

        if (value1 !== 'world1-value') {
          failures.push({
            type: 'assertion' as const,
            message: 'World 1 storage has wrong value',
            expected: 'world1-value',
            actual: value1
          });
        }

        if (value2 !== 'world2-value') {
          failures.push({
            type: 'assertion' as const,
            message: 'World 2 storage has wrong value',
            expected: 'world2-value',
            actual: value2
          });
        }

        return {
          passed: failures.length === 0,
          failures,
          warnings: []
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        const framework = context.data.get('framework');
        if (framework) {
          await framework.destroyWorld('isolation-test-1');
          await framework.destroyWorld('isolation-test-2');
          await framework.shutdown();
        }
        context.log('Multi-world isolation test cleanup complete');
      }
    };
  }

  /**
   * Test world app loading and execution
   */
  static createAppLoadingTest(): TestScenario {
    return {
      id: 'app-loading',
      name: 'App Loading Test',
      description: 'Test that world apps can be loaded and execute properly',
      category: 'apps',
      tags: ['apps', 'loading', 'execution'],
      timeout: 45000,

      async setup(context: TestContext): Promise<void> {
        context.log('Setting up app loading test');
        const framework = new HyperfyFramework();
        await framework.initialize();
        context.data.set('framework', framework);
      },

      async execute(context: TestContext): Promise<void> {
        const framework = context.data.get('framework') as HyperfyFramework;
        
        const world = await framework.createWorld({
          id: 'app-test-world',
          name: 'App Test World',
          type: 'server',
          persistence: { type: 'sqlite' }
        });

        context.data.set('world', world);
        
        // Wait for world systems to initialize
        await context.wait(2000);
        
        context.log('World created for app testing');
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const world = context.data.get('world');
        const failures = [];

        if (!world) {
          failures.push({
            type: 'assertion' as const,
            message: 'No world available for app testing',
            expected: 'World object',
            actual: world
          });
          return { passed: false, failures, warnings: [] };
        }

        // Check that the world has the necessary systems for apps
        const requiredSystems = ['apps', 'collections', 'scripts'];
        for (const systemName of requiredSystems) {
          if (!world[systemName]) {
            failures.push({
              type: 'assertion' as const,
              message: `World missing required system: ${systemName}`,
              expected: `${systemName} system`,
              actual: 'undefined'
            });
          }
        }

        return {
          passed: failures.length === 0,
          failures,
          warnings: []
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        const framework = context.data.get('framework');
        if (framework) {
          await framework.destroyWorld('app-test-world');
          await framework.shutdown();
        }
        context.log('App loading test cleanup complete');
      }
    };
  }

  /**
   * Test world persistence and data recovery
   */
  static createPersistenceTest(): TestScenario {
    return {
      id: 'world-persistence',
      name: 'World Persistence Test',
      description: 'Test that world data persists correctly across restarts',
      category: 'persistence',
      tags: ['persistence', 'database', 'data'],
      timeout: 60000,

      async setup(context: TestContext): Promise<void> {
        context.log('Setting up persistence test');
        const framework = new HyperfyFramework();
        await framework.initialize();
        context.data.set('framework', framework);
      },

      async execute(context: TestContext): Promise<void> {
        const framework = context.data.get('framework') as HyperfyFramework;
        
        // Create world with specific persistence path
        const world = await framework.createWorld({
          id: 'persistence-test-world',
          name: 'Persistence Test World',
          type: 'server',
          persistence: {
            type: 'sqlite',
            path: './test-results/persistence-test.db'
          }
        });

        // Store some test data
        const storage = framework.getStorageManager().getWorldStorage('persistence-test-world');
        await storage.set('persistent-key', 'persistent-value');
        await storage.set('test-number', 12345);

        context.data.set('world', world);
        context.data.set('testDbPath', './test-results/persistence-test.db');

        // Wait for data to be written
        await context.wait(1000);
        
        context.log('Created world with persistence');
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const world = context.data.get('world');
        const failures = [];

        if (!world) {
          failures.push({
            type: 'assertion' as const,
            message: 'World was not created',
            expected: 'World object',
            actual: world
          });
        }

        // Check if database file exists
        const fs = await import('fs-extra');
        const dbPath = context.data.get('testDbPath');
        const dbExists = await fs.pathExists(dbPath);

        if (!dbExists) {
          failures.push({
            type: 'assertion' as const,
            message: 'Database file was not created',
            expected: `File at ${dbPath}`,
            actual: 'File does not exist'
          });
        }

        return {
          passed: failures.length === 0,
          failures,
          warnings: []
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        const framework = context.data.get('framework');
        if (framework) {
          await framework.destroyWorld('persistence-test-world');
          await framework.shutdown();
        }
        context.log('Persistence test cleanup complete');
      }
    };
  }

  /**
   * Get all standard test scenarios
   */
  static getAllScenarios(): TestScenario[] {
    return [
      this.createWorldCreationTest(),
      this.createMultiWorldIsolationTest(),
      this.createAppLoadingTest(),
      this.createPersistenceTest()
    ];
  }
}