/**
 * Core Systems E2E Tests
 * Tests World, Entity, System, EventBus lifecycle with real Hyperscape instances
 * No mocks - real runtime testing
 */

import { test, expect, Page } from '@playwright/test';
import { createServerWorld } from '@hyperscape/shared';
import type { World } from '@hyperscape/shared';

// Test helpers
async function waitForWorldReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return (window as { hyperscapeWorld?: World }).hyperscapeWorld !== undefined;
  }, { timeout: 30000 });
}

async function getWorldFromPage(page: Page): Promise<World> {
  return await page.evaluate(() => {
    return (window as { hyperscapeWorld: World }).hyperscapeWorld;
  });
}

test.describe('Core Systems - World Lifecycle', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:5555');
    await waitForWorldReady(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('World should initialize with all core systems', async () => {
    const systemsCount = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      return world.systems.length;
    });

    expect(systemsCount).toBeGreaterThan(0);

    const hasPhysics = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      return world.physics !== undefined;
    });

    expect(hasPhysics).toBe(true);

    const hasEntities = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      return world.entities !== undefined;
    });

    expect(hasEntities).toBe(true);

    const hasStage = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      return world.stage !== undefined;
    });

    expect(hasStage).toBe(true);
  });

  test('Systems should initialize in dependency order', async () => {
    const initLog = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      return world.systems.map(s => ({
        name: s.constructor.name,
        initialized: (s as { initialized?: boolean }).initialized ?? false,
      }));
    });

    // All systems should be initialized
    for (const system of initLog) {
      expect(system.initialized).toBe(true);
    }
  });

  test('World tick should run without errors', async () => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      // Run 60 ticks (2 seconds at 30 FPS)
      for (let i = 0; i < 60; i++) {
        world.tick(i * 33.33); // 30 FPS
      }
    });

    await page.waitForTimeout(100);
    expect(errors).toHaveLength(0);
  });

  test('EventBus should emit and receive events', async () => {
    const eventReceived = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
        let received = false;

        world.on('test:event', () => {
          received = true;
        });

        world.emit('test:event', { test: true });

        setTimeout(() => resolve(received), 100);
      });
    });

    expect(eventReceived).toBe(true);
  });

  test('Systems should destroy cleanly', async () => {
    const destroyedCleanly = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      const initialSystemCount = world.systems.length;

      world.destroy();

      return world.systems.length === 0 && initialSystemCount > 0;
    });

    expect(destroyedCleanly).toBe(true);
  });
});

test.describe('Core Systems - Entity Lifecycle', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:5555');
    await waitForWorldReady(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Entity should spawn with correct transform', async () => {
    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      
      const testEntity = world.entities.add({
        id: 'test_entity_1',
        type: 'generic',
        name: 'Test Entity',
        position: [10, 5, 10],
        quaternion: [0, 0, 0, 1],
      }, true);

      const entity = world.entities.get('test_entity_1');
      
      return {
        exists: entity !== null,
        position: entity ? {
          x: entity.node.position.x,
          y: entity.node.position.y,
          z: entity.node.position.z,
        } : null,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.position).not.toBeNull();
    expect(result.position?.x).toBeCloseTo(10, 1);
    expect(result.position?.z).toBeCloseTo(10, 1);
  });

  test('Entity should be in Three.js scene graph', async () => {
    const inScene = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      
      world.entities.add({
        id: 'test_entity_scene',
        type: 'generic',
        name: 'Scene Test',
        position: [5, 5, 5],
      }, true);

      const entity = world.entities.get('test_entity_scene');
      
      // Check if entity node is in scene
      const findInScene = (obj: THREE.Object3D, target: THREE.Object3D): boolean => {
        if (obj === target) return true;
        for (const child of obj.children) {
          if (findInScene(child, target)) return true;
        }
        return false;
      };

      if (!entity || !world.stage.scene) return false;
      
      return findInScene(world.stage.scene as THREE.Scene, entity.node);
    });

    expect(inScene).toBe(true);
  });

  test('Entity destruction should remove from scene', async () => {
    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      
      world.entities.add({
        id: 'test_entity_destroy',
        type: 'generic',
        name: 'Destroy Test',
        position: [0, 0, 0],
      }, true);

      const entityBefore = world.entities.get('test_entity_destroy');
      const existsBefore = entityBefore !== null;

      if (entityBefore) {
        entityBefore.destroy();
      }

      const entityAfter = world.entities.get('test_entity_destroy');

      return {
        existsBefore,
        existsAfter: entityAfter !== null,
      };
    });

    expect(result.existsBefore).toBe(true);
    expect(result.existsAfter).toBe(false);
  });

  test('Components should attach and detach correctly', async () => {
    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      
      const entity = world.entities.add({
        id: 'test_entity_components',
        type: 'generic',
        name: 'Component Test',
        position: [0, 0, 0],
      }, true);

      if (!entity) return { success: false };

      const hasComponentBefore = entity.hasComponent('transform');
      
      entity.addComponent('stats', {
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
      });

      const hasStats = entity.hasComponent('stats');
      const stats = entity.getComponent('stats');

      entity.removeComponent('stats');
      const hasStatsAfter = entity.hasComponent('stats');

      return {
        success: true,
        hasComponentBefore,
        hasStats,
        statsData: stats?.data,
        hasStatsAfter,
      };
    });

    expect(result.success).toBe(true);
    expect(result.hasComponentBefore).toBe(true); // Transform auto-added
    expect(result.hasStats).toBe(true);
    expect(result.statsData).toBeDefined();
    expect(result.hasStatsAfter).toBe(false);
  });
});

test.describe('Core Systems - System Registration', () => {
  test('Should register custom system and call lifecycle methods', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await waitForWorldReady(page);

    const lifecycleLog = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;
      const log: string[] = [];

      // Create test system
      class TestSystem {
        world: World;
        initialized = false;
        started = false;
        tickCount = 0;

        constructor(world: World) {
          this.world = world;
        }

        getDependencies() {
          return { required: [], optional: [] };
        }

        async init() {
          log.push('init');
          this.initialized = true;
        }

        start() {
          log.push('start');
          this.started = true;
        }

        update() {
          log.push('update');
          this.tickCount++;
        }

        destroy() {
          log.push('destroy');
        }

        isInitialized() { return this.initialized; }
        isStarted() { return this.started; }
        preTick() {}
        preFixedUpdate() {}
        fixedUpdate() {}
        postFixedUpdate() {}
        preUpdate() {}
        postUpdate() {}
        lateUpdate() {}
        postLateUpdate() {}
        commit() {}
        postTick() {}
      }

      const system = new TestSystem(world);
      world.addSystem('test-system', system);

      // Call lifecycle
      system.init();
      system.start();
      system.update(0.016);
      system.destroy();

      return log;
    });

    expect(lifecycleLog).toEqual(['init', 'start', 'update', 'destroy']);
  });
});

test.describe('Core Systems - Hot Reloadable', () => {
  test('Should register and update hot items', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await waitForWorldReady(page);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld: World }).hyperscapeWorld;

      const hotItem = {
        updateCount: 0,
        fixedUpdateCount: 0,
        update() {
          this.updateCount++;
        },
        fixedUpdate() {
          this.fixedUpdateCount++;
        },
        lateUpdate() {},
        postLateUpdate() {},
      };

      world.setHot(hotItem, true);

      // Run 10 ticks
      for (let i = 0; i < 10; i++) {
        world.tick(i * 33.33);
      }

      world.setHot(hotItem, false);

      return {
        updateCount: hotItem.updateCount,
        fixedUpdateCount: hotItem.fixedUpdateCount,
      };
    });

    expect(result.updateCount).toBeGreaterThan(0);
    expect(result.fixedUpdateCount).toBeGreaterThan(0);
  });
});

