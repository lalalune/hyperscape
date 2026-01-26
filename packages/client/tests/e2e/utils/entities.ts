/**
 * Entity Testing Utilities for Hyperscape E2E Tests
 *
 * Provides functions for querying and verifying entity state in the Three.js scene.
 * Per project rules: Tests use real Hyperscape instances, no mocks.
 *
 * @packageDocumentation
 */

import type { Page } from "@playwright/test";

/**
 * Position in 3D space
 */
interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Basic entity information
 */
interface EntityInfo {
  id: string;
  type: string;
  position: Position3D;
  name?: string;
  health?: number;
  maxHealth?: number;
}

/**
 * Gets an entity by its ID from the game world
 */
export async function getEntityById(
  page: Page,
  entityId: string,
): Promise<EntityInfo | null> {
  return await page.evaluate((id) => {
    const win = window as unknown as {
      world?: {
        getEntityById?: (id: string) => {
          id: string;
          type?: string;
          name?: string;
          health?: number;
          maxHealth?: number;
          mesh?: {
            position: { x: number; y: number; z: number };
          };
        } | null;
      };
    };

    const entity = win.world?.getEntityById?.(id);
    if (!entity) return null;

    return {
      id: entity.id,
      type: entity.type ?? "unknown",
      position: entity.mesh?.position
        ? {
            x: entity.mesh.position.x,
            y: entity.mesh.position.y,
            z: entity.mesh.position.z,
          }
        : { x: 0, y: 0, z: 0 },
      name: entity.name,
      health: entity.health,
      maxHealth: entity.maxHealth,
    };
  }, entityId);
}

/**
 * Gets all entities of a specific type from the game world
 */
export async function getEntitiesByType(
  page: Page,
  entityType: string,
): Promise<EntityInfo[]> {
  return await page.evaluate((type) => {
    const win = window as unknown as {
      world?: {
        entities?: {
          all?: Array<{
            id: string;
            type?: string;
            name?: string;
            health?: number;
            maxHealth?: number;
            mesh?: {
              position: { x: number; y: number; z: number };
            };
          }>;
        };
      };
    };

    const entities = win.world?.entities?.all ?? [];
    return entities
      .filter((e) => e.type === type)
      .map((entity) => ({
        id: entity.id,
        type: entity.type ?? "unknown",
        position: entity.mesh?.position
          ? {
              x: entity.mesh.position.x,
              y: entity.mesh.position.y,
              z: entity.mesh.position.z,
            }
          : { x: 0, y: 0, z: 0 },
        name: entity.name,
        health: entity.health,
        maxHealth: entity.maxHealth,
      }));
  }, entityType);
}

/**
 * Gets the position of an entity by ID
 */
export async function getEntityPosition(
  page: Page,
  entityId: string,
): Promise<Position3D | null> {
  const entity = await getEntityById(page, entityId);
  return entity?.position ?? null;
}

/**
 * Calculates the distance between two entities
 */
export async function getDistanceBetweenEntities(
  page: Page,
  entityId1: string,
  entityId2: string,
): Promise<number | null> {
  const pos1 = await getEntityPosition(page, entityId1);
  const pos2 = await getEntityPosition(page, entityId2);

  if (!pos1 || !pos2) return null;

  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Gets distance between two positions
 */
export function getDistance(pos1: Position3D, pos2: Position3D): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Waits for an entity to spawn in the world
 */
export async function waitForEntitySpawn(
  page: Page,
  entityId: string,
  timeout: number = 10000,
): Promise<EntityInfo> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const entity = await getEntityById(page, entityId);
    if (entity) return entity;
    await page.waitForTimeout(100);
  }

  throw new Error(`Entity ${entityId} did not spawn within ${timeout}ms`);
}

/**
 * Waits for an entity to despawn from the world
 */
export async function waitForEntityDespawn(
  page: Page,
  entityId: string,
  timeout: number = 10000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const entity = await getEntityById(page, entityId);
    if (!entity) return;
    await page.waitForTimeout(100);
  }

  throw new Error(`Entity ${entityId} did not despawn within ${timeout}ms`);
}

/**
 * Waits for an entity to reach a specific position (within threshold)
 */
export async function waitForEntityAtPosition(
  page: Page,
  entityId: string,
  targetPos: Position3D,
  threshold: number = 1.0,
  timeout: number = 10000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const pos = await getEntityPosition(page, entityId);
    if (pos && getDistance(pos, targetPos) <= threshold) {
      return;
    }
    await page.waitForTimeout(100);
  }

  throw new Error(
    `Entity ${entityId} did not reach position within ${timeout}ms`,
  );
}

/**
 * Waits for entities to be adjacent (within threshold distance)
 */
export async function waitForEntitiesAdjacent(
  page: Page,
  entityId1: string,
  entityId2: string,
  threshold: number = 2.0,
  timeout: number = 10000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const distance = await getDistanceBetweenEntities(
      page,
      entityId1,
      entityId2,
    );
    if (distance !== null && distance <= threshold) {
      return;
    }
    await page.waitForTimeout(100);
  }

  throw new Error(
    `Entities ${entityId1} and ${entityId2} did not become adjacent within ${timeout}ms`,
  );
}

/**
 * Gets the local player entity
 */
export async function getLocalPlayer(page: Page): Promise<EntityInfo | null> {
  return await page.evaluate(() => {
    const win = window as unknown as {
      world?: {
        entities?: {
          player?: {
            id: string;
            type?: string;
            name?: string;
            health?: number;
            maxHealth?: number;
            mesh?: {
              position: { x: number; y: number; z: number };
            };
          };
        };
      };
    };

    const player = win.world?.entities?.player;
    if (!player) return null;

    return {
      id: player.id,
      type: player.type ?? "player",
      position: player.mesh?.position
        ? {
            x: player.mesh.position.x,
            y: player.mesh.position.y,
            z: player.mesh.position.z,
          }
        : { x: 0, y: 0, z: 0 },
      name: player.name,
      health: player.health,
      maxHealth: player.maxHealth,
    };
  });
}

/**
 * Gets the number of entities in the world
 */
export async function getEntityCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const win = window as unknown as {
      world?: {
        entities?: {
          all?: unknown[];
        };
      };
    };

    return win.world?.entities?.all?.length ?? 0;
  });
}

/**
 * Checks if an entity exists in the world
 */
export async function entityExists(
  page: Page,
  entityId: string,
): Promise<boolean> {
  const entity = await getEntityById(page, entityId);
  return entity !== null;
}

/**
 * Gets all entities within a radius of a position
 */
export async function getEntitiesInRadius(
  page: Page,
  center: Position3D,
  radius: number,
): Promise<EntityInfo[]> {
  return await page.evaluate(
    ({ c, r }) => {
      const win = window as unknown as {
        world?: {
          entities?: {
            all?: Array<{
              id: string;
              type?: string;
              name?: string;
              health?: number;
              maxHealth?: number;
              mesh?: {
                position: { x: number; y: number; z: number };
              };
            }>;
          };
        };
      };

      const entities = win.world?.entities?.all ?? [];
      return entities
        .filter((entity) => {
          if (!entity.mesh?.position) return false;
          const pos = entity.mesh.position;
          const dx = pos.x - c.x;
          const dy = pos.y - c.y;
          const dz = pos.z - c.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          return dist <= r;
        })
        .map((entity) => ({
          id: entity.id,
          type: entity.type ?? "unknown",
          position: {
            x: entity.mesh!.position.x,
            y: entity.mesh!.position.y,
            z: entity.mesh!.position.z,
          },
          name: entity.name,
          health: entity.health,
          maxHealth: entity.maxHealth,
        }));
    },
    { c: center, r: radius },
  );
}

/**
 * Verifies entity hierarchy in Three.js scene
 */
export async function verifyEntityInScene(
  page: Page,
  entityId: string,
): Promise<boolean> {
  return await page.evaluate((id) => {
    const win = window as unknown as {
      world?: {
        scene?: {
          getObjectByName?: (name: string) => unknown | null;
        };
        getEntityById?: (id: string) => {
          mesh?: { parent?: unknown };
        } | null;
      };
    };

    const entity = win.world?.getEntityById?.(id);
    if (!entity?.mesh) return false;

    // Check if mesh is in scene hierarchy
    return entity.mesh.parent !== null && entity.mesh.parent !== undefined;
  }, entityId);
}
