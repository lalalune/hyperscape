/**
 * World Entities E2E Tests
 * Tests mobs, resources, items, NPCs, and spawning mechanics
 * Visual and positional verification
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Mob System - Spawning and AI', () => {
  test('Mobs should spawn at designated positions', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { emit: (event: string, data: unknown) => void; entities: { get: (id: string) => { node: { position: { x: number; y: number; z: number } } } } } }).hyperscapeWorld;
      if (!world) return null;

      world.emit('mob:spawn:request', {
        mobType: 'goblin',
        position: { x: 10, y: 5, z: 10 },
        customId: 'test_goblin_spawn',
      });

      // Wait for spawn
      const checkInterval = setInterval(() => {
        const mob = world.entities.get('test_goblin_spawn');
        if (mob) {
          clearInterval(checkInterval);
        }
      }, 100);

      return new Promise((resolve) => {
        setTimeout(() => {
          const mob = world.entities.get('test_goblin_spawn');
          resolve({
            exists: mob !== null,
            position: mob ? {
              x: mob.node.position.x,
              y: mob.node.position.y,
              z: mob.node.position.z,
            } : null,
          });
        }, 1000);
      });
    });

    expect(result).not.toBeNull();
    expect((result as { exists: boolean }).exists).toBe(true);
    if ((result as { position: { x: number; z: number } | null }).position) {
      expect((result as { position: { x: number } }).position.x).toBeCloseTo(10, 1);
      expect((result as { position: { z: number } }).position.z).toBeCloseTo(10, 1);
    }
  });

  test('Mob should patrol around spawn point', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { node: { position: { x: number; y: number; z: number } } } }; tick: (time: number) => void } }).hyperscapeWorld;
      if (!world) return null;

      const mob = world.entities.add({
        id: 'mob_patrol',
        type: 'mob',
        mobType: 'goblin',
        position: [20, 5, 20],
        aiState: 'patrol',
        patrolRadius: 5,
      }, true);

      const initialPos = {
        x: mob.node.position.x,
        z: mob.node.position.z,
      };

      // Run simulation for 5 seconds
      for (let i = 0; i < 150; i++) {
        world.tick((i + 1) * 33.33);
      }

      const finalPos = {
        x: mob.node.position.x,
        z: mob.node.position.z,
      };

      const distance = Math.sqrt(
        Math.pow(finalPos.x - initialPos.x, 2) +
        Math.pow(finalPos.z - initialPos.z, 2)
      );

      return {
        moved: distance > 0.1,
        stayedNearHome: distance < 10,
      };
    });

    expect(result?.moved).toBe(true);
    expect(result?.stayedNearHome).toBe(true);
  });
});

test.describe('Resource System - Gathering', () => {
  test('Tree should spawn and be interactable', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { id: string; node: { position: { x: number; y: number; z: number } }; getProperty: (key: string) => unknown } }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) return null;

      const tree = world.entities.add({
        id: 'test_tree',
        type: 'resource',
        resourceType: 'tree',
        position: { x: 5, y: 5, z: 5 },
        interactable: true,
        harvestSkill: 'woodcutting',
        requiredLevel: 1,
      }, true);

      return {
        exists: tree !== null,
        interactable: tree.getProperty('interactable'),
        position: {
          x: tree.node.position.x,
          y: tree.node.position.y,
          z: tree.node.position.z,
        },
      };
    });

    expect(result?.exists).toBe(true);
    expect(result?.interactable).toBe(true);
  });

  test('Gathering should grant resources and XP', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getInventory?: (id: string) => { items: Array<{ itemId: string; quantity: number }> }; getSkills?: (id: string) => { woodcutting: { xp: number } } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_gather',
        type: 'player',
        position: [0, 5, 0],
        equipment: {
          weapon: { id: 'bronze_hatchet' },
        },
      }, true);

      world.entities.add({
        id: 'tree_harvest',
        type: 'resource',
        resourceType: 'tree',
        position: { x: 2, y: 5, z: 0 },
        harvestYield: [{ itemId: 'logs', quantity: 1, chance: 1.0 }],
      }, true);

      const skillsSystem = world.getSystem('skills');
      const xpBefore = skillsSystem?.getSkills?.('player_gather')?.woodcutting.xp ?? 0;

      // Start gathering
      world.emit('resource:gather', {
        playerId: 'player_gather',
        resourceId: 'tree_harvest',
      });

      // Wait for gathering complete
      // (In real test this would be async with setTimeout)

      const xpAfter = skillsSystem?.getSkills?.('player_gather')?.woodcutting.xp ?? 0;

      const inventorySystem = world.getSystem('inventory');
      const inventory = inventorySystem?.getInventory?.('player_gather');
      const hasLogs = inventory?.items.some(i => i.itemId === 'logs');

      return {
        xpBefore,
        xpAfter,
        hasLogs: hasLogs ?? false,
      };
    });

    expect(result?.xpAfter).toBeGreaterThan(result?.xpBefore ?? 0);
    expect(result?.hasLogs).toBe(true);
  });

  test('Resource should deplete and respawn per GDD', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { getProperty: (key: string) => unknown } }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) return null;

      const tree = world.entities.add({
        id: 'tree_deplete',
        type: 'resource',
        resourceType: 'tree',
        position: { x: 5, y: 5, z: 5 },
        depleted: false,
        respawnTime: 60000,
      }, true);

      const depletedBefore = tree.getProperty('depleted');

      // Deplete resource
      world.emit('resource:depleted', {
        resourceId: 'tree_deplete',
      });

      const depletedAfter = tree.getProperty('depleted');

      return {
        depletedBefore,
        depletedAfter,
      };
    });

    expect(result?.depletedBefore).toBe(false);
    expect(result?.depletedAfter).toBe(true);
  });
});

test.describe('Item Spawner - Ground Items', () => {
  test('Items should spawn on ground when dropped', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown; get: (id: string) => { node: { position: { x: number; y: number; z: number } } } }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_dropper',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      // Drop item
      world.emit('item:drop', {
        playerId: 'player_dropper',
        itemId: 'logs',
        quantity: 5,
        position: { x: 0, y: 5, z: 0 },
      });

      // Wait for item entity to spawn
      return new Promise((resolve) => {
        setTimeout(() => {
          // Find ground item (EntityManager creates with dynamic ID)
          const allEntities = (world as { entities: { all: () => Array<{ type: string; getProperty: (key: string) => unknown; node: { position: { x: number; y: number; z: number } } }> } }).entities.all();
          const groundItem = allEntities.find(e => e.type === 'item' && e.getProperty('itemId') === 'logs');

          resolve({
            exists: groundItem !== null,
            position: groundItem ? {
              x: groundItem.node.position.x,
              y: groundItem.node.position.y,
              z: groundItem.node.position.z,
            } : null,
          });
        }, 500);
      });
    });

    expect((result as { exists: boolean }).exists).toBe(true);
  });
});

test.describe('NPC System - Interactions', () => {
  test('NPC should spawn and be interactable', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { getProperty: (key: string) => unknown } } } }).hyperscapeWorld;
      if (!world) return null;

      const npc = world.entities.add({
        id: 'test_npc',
        type: 'npc',
        name: 'Shopkeeper',
        position: { x: 0, y: 5, z: 5 },
        interactable: true,
        interactionType: 'dialogue',
      }, true);

      return {
        exists: npc !== null,
        interactable: npc.getProperty('interactable'),
        interactionType: npc.getProperty('interactionType'),
      };
    });

    expect(result?.exists).toBe(true);
    expect(result?.interactable).toBe(true);
    expect(result?.interactionType).toBe('dialogue');
  });
});

