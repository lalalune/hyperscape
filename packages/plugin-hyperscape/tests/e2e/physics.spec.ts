/**
 * Physics E2E Tests
 * Tests collision, movement, terrain, and PhysX integration
 * Spatial verification with real physics simulation
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Physics - PhysX Initialization', () => {
  test('PhysX should initialize on client', async ({ page }) => {
    await page.goto('http://localhost:5555');
    
    const physxReady = await page.waitForFunction(() => {
      const world = (window as { hyperscapeWorld?: { physics?: { isReady?: () => boolean } } }).hyperscapeWorld;
      return world?.physics?.isReady?.() === true;
    }, { timeout: 30000 });

    expect(physxReady).toBeTruthy();

    const physicsInfo = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { physics?: { scene?: unknown; foundation?: unknown } } }).hyperscapeWorld;
      return {
        hasPhysics: world?.physics !== undefined,
        hasScene: world?.physics?.scene !== undefined,
        hasFoundation: world?.physics?.foundation !== undefined,
      };
    });

    expect(physicsInfo.hasPhysics).toBe(true);
    expect(physicsInfo.hasScene).toBe(true);
  });
});

test.describe('Physics - Collision Detection', () => {
  test('Raycast should detect static geometry', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(3000);

    const hitResult = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { raycast?: (origin: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, maxDistance?: number) => { hit: boolean; distance: number } | null } }).hyperscapeWorld;
      if (!world?.raycast) return null;

      // Cast ray downward from above terrain
      const hit = world.raycast(
        { x: 0, y: 100, z: 0 },
        { x: 0, y: -1, z: 0 },
        200
      );

      return {
        hasHit: hit !== null && (hit as { hit?: boolean }).hit === true,
        distance: hit ? (hit as { distance: number }).distance : 0,
      };
    });

    expect(hitResult?.hasHit).toBe(true);
    expect(hitResult?.distance).toBeGreaterThan(0);
  });

  test('Character controller should collide with terrain', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { node: { position: { x: number; y: number; z: number } } } }; tick: (time: number) => void; physics?: { isReady?: () => boolean } } }).hyperscapeWorld;
      if (!world || !world.physics?.isReady?.()) return null;

      const player = world.entities.add({
        id: 'player_collision',
        type: 'player',
        position: [0, 100, 0], // High above terrain
        hasPhysics: true,
      }, true);

      const initialY = player.node.position.y;

      // Run physics simulation
      for (let i = 0; i < 90; i++) { // 3 seconds at 30 FPS
        world.tick(i * 33.33);
      }

      const finalY = player.node.position.y;

      return {
        initialY,
        finalY,
        fell: finalY < initialY,
      };
    });

    expect(result?.fell).toBe(true);
    expect(result?.finalY).toBeGreaterThan(0); // Should land on terrain, not fall through
  });
});

test.describe('Physics - Movement Validation', () => {
  test('Player should move at correct speed', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { node: { position: { x: number; y: number; z: number } }; setVelocity?: (vel: { x: number; y: number; z: number }) => void } }; tick: (time: number) => void; fixedDeltaTime: number } }).hyperscapeWorld;
      if (!world) return null;

      const player = world.entities.add({
        id: 'player_speed',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const startPos = {
        x: player.node.position.x,
        z: player.node.position.z,
      };

      // Set velocity (5 units/sec forward)
      player.setVelocity?.({ x: 5, y: 0, z: 0 });

      // Run for 1 second (30 ticks)
      for (let i = 0; i < 30; i++) {
        world.tick((i + 1) * world.fixedDeltaTime * 1000);
      }

      const endPos = {
        x: player.node.position.x,
        z: player.node.position.z,
      };

      const distance = Math.sqrt(
        Math.pow(endPos.x - startPos.x, 2) +
        Math.pow(endPos.z - startPos.z, 2)
      );

      return {
        startPos,
        endPos,
        distance,
      };
    });

    // Should have moved approximately 5 units in 1 second
    expect(result?.distance).toBeGreaterThan(4);
    expect(result?.distance).toBeLessThan(6);
  });
});

test.describe('Terrain - Height and Collision', () => {
  test('Terrain should provide height at any position', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(3000);

    const heightInfo = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { terrain?: { getHeightAt?: (x: number, z: number) => number } } }).hyperscapeWorld;
      if (!world?.terrain) return null;

      return {
        height1: world.terrain.getHeightAt?.(0, 0) ?? 0,
        height2: world.terrain.getHeightAt?.(10, 10) ?? 0,
        height3: world.terrain.getHeightAt?.(50, 50) ?? 0,
      };
    });

    expect(heightInfo?.height1).toBeDefined();
    expect(Number.isFinite(heightInfo?.height1)).toBe(true);
    expect(Number.isFinite(heightInfo?.height2)).toBe(true);
    expect(Number.isFinite(heightInfo?.height3)).toBe(true);
  });

  test('Entities should be grounded to terrain', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { node: { position: { x: number; y: number; z: number } } } }; terrain?: { getHeightAt?: (x: number, z: number) => number } } }).hyperscapeWorld;
      if (!world || !world.terrain) return null;

      const entity = world.entities.add({
        id: 'grounded_entity',
        type: 'generic',
        position: { x: 5, y: 999, z: 5 }, // High Y
      }, true);

      const terrainHeight = world.terrain.getHeightAt?.(5, 5);
      const entityY = entity.node.position.y;

      return {
        terrainHeight: terrainHeight ?? 0,
        entityY,
        isGrounded: Math.abs(entityY - (terrainHeight ?? 0)) < 5, // Within 5 units
      };
    });

    expect(result?.isGrounded).toBe(true);
  });
});

