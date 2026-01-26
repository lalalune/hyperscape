/**
 * Combat Testing Helpers for Hyperscape E2E Tests
 *
 * Provides functions for testing combat interactions and verifying damage.
 * Per project rules: Tests use real Hyperscape instances, no mocks.
 *
 * @packageDocumentation
 */

import type { Page } from "@playwright/test";
import {
  getEntityById,
  getLocalPlayer,
  waitForEntitiesAdjacent,
} from "./entities";

/**
 * Combat state information
 */
interface CombatState {
  isInCombat: boolean;
  targetId: string | null;
  lastDamageDealt: number;
  lastDamageTaken: number;
}

/**
 * Health change result
 */
interface HealthDelta {
  before: number;
  after: number;
  delta: number;
}

/**
 * Gets the current combat state of the local player
 */
export async function getCombatState(page: Page): Promise<CombatState> {
  return await page.evaluate(() => {
    const win = window as unknown as {
      world?: {
        entities?: {
          player?: {
            combat?: {
              isInCombat?: boolean;
              targetId?: string | null;
              lastDamageDealt?: number;
              lastDamageTaken?: number;
            };
          };
        };
      };
    };

    const combat = win.world?.entities?.player?.combat;
    return {
      isInCombat: combat?.isInCombat ?? false,
      targetId: combat?.targetId ?? null,
      lastDamageDealt: combat?.lastDamageDealt ?? 0,
      lastDamageTaken: combat?.lastDamageTaken ?? 0,
    };
  });
}

/**
 * Initiates an attack on a target entity
 */
export async function performAttack(
  page: Page,
  targetId: string,
): Promise<void> {
  await page.evaluate((id) => {
    const win = window as unknown as {
      world?: {
        network?: {
          send?: (packet: string, data: unknown) => void;
        };
        entities?: {
          player?: { id: string };
        };
      };
    };

    const playerId = win.world?.entities?.player?.id;
    if (!playerId) return;

    win.world?.network?.send?.("attack", {
      playerId,
      targetId: id,
    });
  }, targetId);
}

/**
 * Clicks on an entity to interact/attack
 */
export async function clickOnEntity(
  page: Page,
  entityId: string,
): Promise<void> {
  // Get entity screen position and click
  const pos = await page.evaluate((id) => {
    const win = window as unknown as {
      world?: {
        getEntityById?: (id: string) => {
          mesh?: { position: { x: number; y: number; z: number } };
        } | null;
        camera?: {
          projectionMatrix: unknown;
          matrixWorldInverse: unknown;
        };
      };
      THREE?: {
        Vector3: new (
          x: number,
          y: number,
          z: number,
        ) => {
          project: (camera: unknown) => { x: number; y: number };
        };
      };
    };

    const entity = win.world?.getEntityById?.(id);
    if (!entity?.mesh?.position) return null;

    const camera = win.world?.camera;
    const THREE = win.THREE;
    if (!camera || !THREE) return null;

    const pos = entity.mesh.position;
    const vector = new THREE.Vector3(pos.x, pos.y, pos.z);
    const projected = vector.project(camera as never);

    // Convert to screen coordinates
    const canvas = document.querySelector("canvas");
    if (!canvas) return null;

    return {
      x: ((projected.x + 1) / 2) * canvas.clientWidth,
      y: ((-projected.y + 1) / 2) * canvas.clientHeight,
    };
  }, entityId);

  if (!pos) {
    throw new Error(`Could not find entity ${entityId} on screen`);
  }

  await page.mouse.click(pos.x, pos.y);
}

/**
 * Waits for combat to end (player no longer in combat)
 */
export async function waitForCombatEnd(
  page: Page,
  timeout: number = 30000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const state = await getCombatState(page);
    if (!state.isInCombat) return;
    await page.waitForTimeout(100);
  }

  throw new Error(`Combat did not end within ${timeout}ms`);
}

/**
 * Waits for combat to start
 */
export async function waitForCombatStart(
  page: Page,
  timeout: number = 10000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const state = await getCombatState(page);
    if (state.isInCombat) return;
    await page.waitForTimeout(100);
  }

  throw new Error(`Combat did not start within ${timeout}ms`);
}

/**
 * Monitors entity health and returns the change
 */
export async function checkHealthDelta(
  page: Page,
  entityId: string,
  action: () => Promise<void>,
): Promise<HealthDelta> {
  // Get initial health
  const entityBefore = await getEntityById(page, entityId);
  const healthBefore = entityBefore?.health ?? 0;

  // Perform the action
  await action();

  // Wait a bit for the action to take effect
  await page.waitForTimeout(500);

  // Get final health
  const entityAfter = await getEntityById(page, entityId);
  const healthAfter = entityAfter?.health ?? 0;

  return {
    before: healthBefore,
    after: healthAfter,
    delta: healthAfter - healthBefore,
  };
}

/**
 * Simulates taking damage (for testing death/respawn)
 */
export async function takeDamage(page: Page, amount: number): Promise<void> {
  await page.evaluate((dmg) => {
    const win = window as unknown as {
      world?: {
        entities?: {
          player?: {
            takeDamage?: (amount: number) => void;
            health?: number;
          };
        };
        emit?: (event: string, data: unknown) => void;
      };
    };

    const player = win.world?.entities?.player;
    if (!player) return;

    if (player.takeDamage) {
      player.takeDamage(dmg);
    } else if (typeof player.health === "number") {
      player.health = Math.max(0, player.health - dmg);
    }

    // Emit damage event for UI updates
    win.world?.emit?.("player:damaged", { amount: dmg });
  }, amount);
}

/**
 * Gets the health of an entity
 */
export async function getEntityHealth(
  page: Page,
  entityId: string,
): Promise<{ current: number; max: number } | null> {
  const entity = await getEntityById(page, entityId);
  if (!entity || entity.health === undefined) return null;

  return {
    current: entity.health,
    max: entity.maxHealth ?? entity.health,
  };
}

/**
 * Gets the local player's health
 */
export async function getPlayerHealth(
  page: Page,
): Promise<{ current: number; max: number } | null> {
  const player = await getLocalPlayer(page);
  if (!player || player.health === undefined) return null;

  return {
    current: player.health,
    max: player.maxHealth ?? player.health,
  };
}

/**
 * Waits for an entity to die (health reaches 0)
 */
export async function waitForEntityDeath(
  page: Page,
  entityId: string,
  timeout: number = 30000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const health = await getEntityHealth(page, entityId);
    if (!health || health.current <= 0) return;
    await page.waitForTimeout(100);
  }

  throw new Error(`Entity ${entityId} did not die within ${timeout}ms`);
}

/**
 * Engages in combat with a target until one party dies
 */
export async function engageInCombat(
  page: Page,
  targetId: string,
  options: {
    approachFirst?: boolean;
    maxDuration?: number;
  } = {},
): Promise<{ playerDied: boolean; targetDied: boolean }> {
  const { approachFirst = true, maxDuration = 60000 } = options;

  const player = await getLocalPlayer(page);
  if (!player) throw new Error("No local player found");

  // Move close to target if needed
  if (approachFirst) {
    await waitForEntitiesAdjacent(page, player.id, targetId, 3.0, 15000);
  }

  // Start combat
  await performAttack(page, targetId);
  await waitForCombatStart(page, 5000);

  const startTime = Date.now();

  // Combat loop
  while (Date.now() - startTime < maxDuration) {
    const playerHealth = await getPlayerHealth(page);
    const targetHealth = await getEntityHealth(page, targetId);

    if (playerHealth && playerHealth.current <= 0) {
      return { playerDied: true, targetDied: false };
    }

    if (!targetHealth || targetHealth.current <= 0) {
      return { playerDied: false, targetDied: true };
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`Combat did not conclude within ${maxDuration}ms`);
}

/**
 * Requests respawn after death
 */
export async function requestRespawn(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as {
      world?: {
        network?: {
          send?: (packet: string, data: unknown) => void;
        };
        entities?: {
          player?: { id: string };
        };
      };
    };

    const playerId = win.world?.entities?.player?.id;
    if (!playerId) return;

    win.world?.network?.send?.("requestRespawn", { playerId });
  });
}

/**
 * Waits for player to respawn after death
 */
export async function waitForRespawn(
  page: Page,
  timeout: number = 10000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const health = await getPlayerHealth(page);
    if (health && health.current > 0) return;
    await page.waitForTimeout(100);
  }

  throw new Error(`Player did not respawn within ${timeout}ms`);
}
