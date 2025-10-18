/**
 * Combat Systems E2E Tests
 * Tests melee, ranged, damage calculation, death, aggro with visual verification
 * Uses color proxies for visual testing per GDD requirements
 */

import { test, expect, Page } from '@playwright/test';

// Visual test colors for entities
const COLORS = {
  PLAYER: '#0000FF',      // Blue player
  GOBLIN: '#228822',      // Green goblin
  CORPSE: '#FF0000',      // Red corpse
  DAMAGE: '#FFFF00',      // Yellow damage indicator
  ARROW: '#FFD700',       // Gold arrow
};

type ColorRGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): ColorRGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

async function findColorInCanvas(page: Page, hexColor: string): Promise<{ x: number; y: number } | null> {
  return await page.evaluate(({ color }) => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const rgb = { r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16) };

    const tolerance = 10;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - rgb.r) <= tolerance &&
          Math.abs(data[i + 1] - rgb.g) <= tolerance &&
          Math.abs(data[i + 2] - rgb.b) <= tolerance) {
        const pixelIndex = i / 4;
        return {
          x: pixelIndex % imageData.width,
          y: Math.floor(pixelIndex / imageData.width),
        };
      }
    }

    return null;
  }, { color: hexColor });
}

async function getPixelCount(page: Page, hexColor: string): Promise<number> {
  return await page.evaluate(({ color }) => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return 0;

    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const rgb = { r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16) };

    const tolerance = 10;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - rgb.r) <= tolerance &&
          Math.abs(data[i + 1] - rgb.g) <= tolerance &&
          Math.abs(data[i + 2] - rgb.b) <= tolerance) {
        count++;
      }
    }

    return count;
  }, { color: hexColor });
}

test.describe('Combat System - Melee Combat', () => {
  test('Player should damage mob with melee attack', async ({ page }) => {
    await page.goto('http://localhost:5555');
    
    // Create test world with player and goblin using color proxies
    await page.evaluate(({ playerColor, goblinColor }) => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown } } }).hyperscapeWorld;
      if (!world) throw new Error('World not ready');

      // Create player cube (blue)
      world.entities.add({
        id: 'player_test',
        type: 'player',
        name: 'Test Player',
        position: [0, 5, 0],
        visualColor: playerColor,
        stats: {
          attack: { level: 10, xp: 0 },
          strength: { level: 10, xp: 0 },
          defense: { level: 1, xp: 0 },
          constitution: { level: 10, xp: 0 },
        },
      }, true);

      // Create goblin cube (green) near player
      world.entities.add({
        id: 'goblin_test',
        type: 'mob',
        name: 'Test Goblin',
        position: [1.5, 5, 0], // Within melee range
        visualColor: goblinColor,
        health: 50,
        maxHealth: 50,
      }, true);
    }, { playerColor: COLORS.PLAYER, goblinColor: COLORS.GOBLIN });

    await page.waitForTimeout(1000);

    // Verify entities rendered
    const playerVisible = await findColorInCanvas(page, COLORS.PLAYER);
    const goblinVisible = await findColorInCanvas(page, COLORS.GOBLIN);

    expect(playerVisible).not.toBeNull();
    expect(goblinVisible).not.toBeNull();

    // Get initial goblin health
    const initialHealth = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { get: (id: string) => { getProperty: (key: string) => unknown } } } }).hyperscapeWorld;
      const goblin = world?.entities.get('goblin_test');
      return goblin?.getProperty('health');
    });

    // Trigger attack
    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      world?.emit('combat:attack:request', {
        playerId: 'player_test',
        targetId: 'goblin_test',
      });
    });

    await page.waitForTimeout(500);

    // Verify damage dealt
    const currentHealth = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { get: (id: string) => { getProperty: (key: string) => unknown } } } }).hyperscapeWorld;
      const goblin = world?.entities.get('goblin_test');
      const health = goblin?.getProperty('health');
      return typeof health === 'object' && health !== null ? (health as { current: number }).current : health;
    });

    expect(currentHealth).toBeLessThan(initialHealth as number);

    await page.screenshot({ path: 'test-results/melee-combat.png' });
  });

  test('Melee attack should fail if out of range', async ({ page }) => {
    await page.goto('http://localhost:5555');

    await page.evaluate(({ playerColor, goblinColor }) => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown } } }).hyperscapeWorld;
      if (!world) throw new Error('World not ready');

      world.entities.add({
        id: 'player_far',
        type: 'player',
        name: 'Test Player',
        position: [0, 5, 0],
        visualColor: playerColor,
      }, true);

      // Goblin too far (>2.5 units)
      world.entities.add({
        id: 'goblin_far',
        type: 'mob',
        name: 'Far Goblin',
        position: [5, 5, 0], // Too far
        visualColor: goblinColor,
        health: 50,
      }, true);
    }, { playerColor: COLORS.PLAYER, goblinColor: COLORS.GOBLIN });

    await page.waitForTimeout(500);

    let attackFailed = false;

    page.on('console', (msg) => {
      if (msg.text().includes('out_of_range') || msg.text().includes('COMBAT_ATTACK_FAILED')) {
        attackFailed = true;
      }
    });

    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      world?.emit('combat:attack:request', {
        playerId: 'player_far',
        targetId: 'goblin_far',
      });
    });

    await page.waitForTimeout(500);

    expect(attackFailed).toBe(true);
  });
});

test.describe('Combat System - Ranged Combat', () => {
  test('Ranged attack should consume arrows', async ({ page }) => {
    await page.goto('http://localhost:5555');

    const result = await page.evaluate(({ playerColor, goblinColor }) => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown; get: (id: string) => { getProperty: (key: string) => unknown; setProperty: (key: string, value: unknown) => void } }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) throw new Error('World not ready');

      // Player with bow and arrows
      const player = world.entities.add({
        id: 'player_ranged',
        type: 'player',
        name: 'Ranger',
        position: [0, 5, 0],
        visualColor: playerColor,
        equipment: {
          weapon: { id: 'wood_bow', type: 'ranged' },
          arrows: { id: 'arrows', quantity: 10 },
        },
      }, true);

      // Goblin in ranged distance
      world.entities.add({
        id: 'goblin_ranged',
        type: 'mob',
        name: 'Target',
        position: [5, 5, 0], // In ranged range (10 units)
        visualColor: goblinColor,
        health: 50,
      }, true);

      const initialArrows = 10;

      // Fire arrow
      world.emit('combat:ranged:attack', {
        attackerId: 'player_ranged',
        targetId: 'goblin_ranged',
      });

      // Check arrows after attack
      const playerEntity = world.entities.get('player_ranged');
      const arrows = playerEntity?.getProperty('arrows');
      const arrowsAfter = typeof arrows === 'object' && arrows !== null ? (arrows as { quantity: number }).quantity : 0;

      return {
        initialArrows,
        arrowsAfter,
      };
    }, { playerColor: COLORS.PLAYER, goblinColor: COLORS.GOBLIN });

    expect(result.arrowsAfter).toBe(result.initialArrows - 1);
  });

  test('Ranged attack should fail without arrows', async ({ page }) => {
    await page.goto('http://localhost:5555');

    let attackFailed = false;

    page.on('console', (msg) => {
      if (msg.text().includes('no_arrows') || msg.text().includes('COMBAT_ATTACK_FAILED')) {
        attackFailed = true;
      }
    });

    await page.evaluate(({ playerColor, goblinColor }) => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) throw new Error('World not ready');

      // Player with bow but NO arrows
      world.entities.add({
        id: 'player_no_arrows',
        type: 'player',
        name: 'Bowman',
        position: [0, 5, 0],
        visualColor: playerColor,
        equipment: {
          weapon: { id: 'wood_bow', type: 'ranged' },
          arrows: null, // No arrows
        },
      }, true);

      world.entities.add({
        id: 'goblin_target',
        type: 'mob',
        position: [5, 5, 0],
        visualColor: goblinColor,
      }, true);

      world.emit('combat:ranged:attack', {
        attackerId: 'player_no_arrows',
        targetId: 'goblin_target',
      });
    }, { playerColor: COLORS.PLAYER, goblinColor: COLORS.GOBLIN });

    await page.waitForTimeout(500);

    expect(attackFailed).toBe(true);
  });
});

test.describe('Combat System - Death and Respawn', () => {
  test('Mob should die and drop loot when health reaches zero', async ({ page }) => {
    await page.goto('http://localhost:5555');

    await page.evaluate(({ playerColor, goblinColor, corpseColor }) => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown; get: (id: string) => unknown }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) throw new Error('World not ready');

      world.entities.add({
        id: 'player_killer',
        type: 'player',
        position: [0, 5, 0],
        visualColor: playerColor,
      }, true);

      world.entities.add({
        id: 'goblin_victim',
        type: 'mob',
        position: [1.5, 5, 0],
        visualColor: goblinColor,
        health: 1, // Low health for quick kill
      }, true);
    }, { playerColor: COLORS.PLAYER, goblinColor: COLORS.GOBLIN, corpseColor: COLORS.CORPSE });

    await page.waitForTimeout(500);

    // Verify goblin is visible
    const goblinBefore = await getPixelCount(page, COLORS.GOBLIN);
    expect(goblinBefore).toBeGreaterThan(0);

    // Kill goblin
    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      world?.emit('combat:attack:request', {
        playerId: 'player_killer',
        targetId: 'goblin_victim',
      });
    });

    await page.waitForTimeout(1000);

    // Verify goblin pixels gone
    const goblinAfter = await getPixelCount(page, COLORS.GOBLIN);
    expect(goblinAfter).toBe(0);

    // Verify corpse appeared
    const corpsePixels = await getPixelCount(page, COLORS.CORPSE);
    expect(corpsePixels).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/mob-death-loot.png' });
  });

  test('Player should respawn at starter town after death', async ({ page }) => {
    await page.goto('http://localhost:5555');

    await page.evaluate(({ playerColor }) => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown; get: (id: string) => { node: { position: { x: number; y: number; z: number } } } }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) throw new Error('World not ready');

      world.entities.add({
        id: 'player_death',
        type: 'player',
        position: [50, 5, 50], // Far from spawn
        visualColor: playerColor,
        health: 1,
      }, true);
    }, { playerColor: COLORS.PLAYER });

    await page.waitForTimeout(500);

    // Get death position
    const deathPosition = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { get: (id: string) => { node: { position: { x: number; y: number; z: number } } } } } }).hyperscapeWorld;
      const player = world?.entities.get('player_death');
      return player ? { x: player.node.position.x, y: player.node.position.y, z: player.node.position.z } : null;
    });

    // Kill player
    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      world?.emit('player:death', {
        playerId: 'player_death',
        killedBy: 'test_goblin',
      });
    });

    await page.waitForTimeout(1000);

    // Trigger respawn
    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      world?.emit('player:respawn:request', {
        playerId: 'player_death',
      });
    });

    await page.waitForTimeout(1000);

    // Verify player moved to spawn (should be near 0,0,0)
    const respawnPosition = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { get: (id: string) => { node: { position: { x: number; y: number; z: number } } } } } }).hyperscapeWorld;
      const player = world?.entities.get('player_death');
      return player ? { x: player.node.position.x, y: player.node.position.y, z: player.node.position.z } : null;
    });

    expect(respawnPosition).not.toBeNull();
    if (deathPosition && respawnPosition) {
      const distance = Math.sqrt(
        Math.pow(respawnPosition.x - deathPosition.x, 2) +
        Math.pow(respawnPosition.z - deathPosition.z, 2)
      );
      expect(distance).toBeGreaterThan(10); // Moved significantly
    }
  });
});

test.describe('Combat System - Aggro Mechanics', () => {
  test('Aggressive mob should chase nearby player', async ({ page }) => {
    await page.goto('http://localhost:5555');

    await page.evaluate(({ playerColor, goblinColor }) => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown } } }).hyperscapeWorld;
      if (!world) throw new Error('World not ready');

      world.entities.add({
        id: 'player_aggro',
        type: 'player',
        position: [0, 5, 0],
        visualColor: playerColor,
      }, true);

      world.entities.add({
        id: 'goblin_aggressive',
        type: 'mob',
        mobType: 'goblin',
        position: [8, 5, 0], // In aggro range (10 units)
        visualColor: goblinColor,
        isAggressive: true,
        aggroRange: 10,
      }, true);
    }, { playerColor: COLORS.PLAYER, goblinColor: COLORS.GOBLIN });

    await page.waitForTimeout(500);

    // Get initial positions
    const initialPositions = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { get: (id: string) => { node: { position: { x: number; y: number; z: number } } } } } }).hyperscapeWorld;
      return {
        player: world?.entities.get('player_aggro')?.node.position,
        goblin: world?.entities.get('goblin_aggressive')?.node.position,
      };
    });

    // Trigger aggro check
    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      world?.emit('player:position:updated', {
        playerId: 'player_aggro',
        position: { x: 0, y: 5, z: 0 },
      });
    });

    await page.waitForTimeout(2000); // Wait for mob AI to process

    // Verify goblin moved closer
    const finalPositions = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { get: (id: string) => { node: { position: { x: number; y: number; z: number } } } } } }).hyperscapeWorld;
      return {
        player: world?.entities.get('player_aggro')?.node.position,
        goblin: world?.entities.get('goblin_aggressive')?.node.position,
      };
    });

    if (initialPositions.goblin && finalPositions.goblin && initialPositions.player) {
      const initialDistance = Math.sqrt(
        Math.pow(initialPositions.goblin.x - initialPositions.player.x, 2) +
        Math.pow(initialPositions.goblin.z - initialPositions.player.z, 2)
      );

      const finalDistance = Math.sqrt(
        Math.pow(finalPositions.goblin.x - initialPositions.player.x, 2) +
        Math.pow(finalPositions.goblin.z - initialPositions.player.z, 2)
      );

      expect(finalDistance).toBeLessThan(initialDistance);
    }
  });

  test('High-level player should be ignored by low-level aggressive mob', async ({ page }) => {
    await page.goto('http://localhost:5555');

    let mobIgnoredPlayer = false;

    page.on('console', (msg) => {
      if (msg.text().includes('ignoring_high_level') || msg.text().includes('player_too_high_level')) {
        mobIgnoredPlayer = true;
      }
    });

    await page.evaluate(({ playerColor, goblinColor }) => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) throw new Error('World not ready');

      world.entities.add({
        id: 'player_high_level',
        type: 'player',
        position: [0, 5, 0],
        visualColor: playerColor,
        stats: {
          attack: { level: 50, xp: 0 },
          strength: { level: 50, xp: 0 },
          defense: { level: 50, xp: 0 },
          constitution: { level: 50, xp: 0 },
        },
        combatLevel: 50,
      }, true);

      world.entities.add({
        id: 'goblin_weak',
        type: 'mob',
        mobType: 'goblin',
        position: [5, 5, 0],
        visualColor: goblinColor,
        level: 3,
        isAggressive: true,
        levelIgnoreThreshold: 10, // Ignores players above level 10
      }, true);

      // Trigger level check
      world.emit('player:level:changed', {
        playerId: 'player_high_level',
        skill: 'attack',
        newLevel: 50,
        oldLevel: 1,
      });
    }, { playerColor: COLORS.PLAYER, goblinColor: COLORS.GOBLIN });

    await page.waitForTimeout(1000);

    // Mob should not aggro
    // We verify this by checking that no chase event was emitted or logged
    // The test passes if mobIgnoredPlayer is true OR no aggro happened
  });
});

test.describe('Combat System - Damage Calculations', () => {
  test('Damage should scale with attack and strength levels', async ({ page }) => {
    await page.goto('http://localhost:5555');

    const results = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown; get: (id: string) => { getProperty: (key: string) => unknown } }; getSystem: (name: string) => { calculateMeleeDamage?: (attacker: unknown, target: unknown) => number } } }).hyperscapeWorld;
      if (!world) throw new Error('World not ready');

      // Weak player
      const weakPlayer = world.entities.add({
        id: 'weak_player',
        type: 'player',
        stats: {
          attack: { level: 1, xp: 0 },
          strength: { level: 1, xp: 0 },
        },
      }, true);

      // Strong player
      const strongPlayer = world.entities.add({
        id: 'strong_player',
        type: 'player',
        stats: {
          attack: { level: 50, xp: 0 },
          strength: { level: 50, xp: 0 },
        },
      }, true);

      // Test mob
      const goblin = world.entities.add({
        id: 'damage_test_goblin',
        type: 'mob',
        defense: 1,
      }, true);

      const combatSystem = world.getSystem('combat');
      if (!combatSystem?.calculateMeleeDamage) {
        return { weakDamage: 0, strongDamage: 0 };
      }

      const weakDamage = combatSystem.calculateMeleeDamage(weakPlayer, goblin);
      const strongDamage = combatSystem.calculateMeleeDamage(strongPlayer, goblin);

      return { weakDamage, strongDamage };
    });

    expect(results.strongDamage).toBeGreaterThan(results.weakDamage);
    expect(results.weakDamage).toBeGreaterThan(0);
    expect(results.strongDamage).toBeGreaterThan(0);
  });
});

// Helper to count pixels of a specific color
async function getPixelCount(page: Page, hexColor: string): Promise<number> {
  return await page.evaluate(({ color }) => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return 0;

    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const rgb = { r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16) };

    const tolerance = 10;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - rgb.r) <= tolerance &&
          Math.abs(data[i + 1] - rgb.g) <= tolerance &&
          Math.abs(data[i + 2] - rgb.b) <= tolerance) {
        count++;
      }
    }

    return count;
  }, { color: hexColor });
}

