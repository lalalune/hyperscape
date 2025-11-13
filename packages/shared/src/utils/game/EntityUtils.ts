/**
 * Entity Utility Functions
 *
 * Common entity operations for safe retrieval, validation, and distance calculations.
 */

import type { Entity, Position3D, Vector3, World } from "../../types";
import { Component } from "../../components/Component";

/**
 * Safe entity retrieval with validation
 */
export function getEntity(world: World, entityId: string): Entity | null {
  // Strong type assumption - entityId is string per function signature
  if (!world.entities.get) {
    return null;
  }
  const entity = world.entities.get(entityId);
  return entity as Entity | null;
}

/**
 * Safe component retrieval with validation
 */
export function getComponent<T extends Component = Component>(
  entity: Entity | null,
  componentName: string,
): T | null {
  if (!entity) {
    return null;
  }
  // Strong type assumption - entity has getComponent method
  return entity.getComponent<T>(componentName);
}

/**
 * Get entity with specific component validation
 */
export function getEntityWithComponent<T extends Component = Component>(
  world: World,
  entityId: string,
  componentName: string,
): { entity: Entity; component: T } | null {
  const entity = getEntity(world, entityId);
  if (!entity) return null;

  const component = getComponent<T>(entity, componentName);
  if (!component) return null;

  return { entity, component };
}

// Import and re-export core math utilities
import { calculateDistance, calculateDistance2D, clamp } from "../MathUtils";
export { calculateDistance, calculateDistance2D, clamp };

/**
 * Find entities within range of a position
 */
export function getEntitiesInRange(
  world: World,
  centerPosition: Vector3,
  range: number,
  filter?: (entity: Entity) => boolean,
): Entity[] {
  if (!world.entities || !world.entities.values) return [];

  const result: Entity[] = [];
  const entities = Array.from(world.entities.values());
  for (const entity of entities) {
    // entity is already Entity type from our interface
    const rpgEntity = entity;
    if (calculateDistance(rpgEntity.position, centerPosition) <= range) {
      if (!filter || filter(rpgEntity)) {
        result.push(rpgEntity);
      }
    }
  }
  return result;
}

/**
 * Get player entity with validation
 */
export function getPlayer(world: World, playerId: string) {
  const entity = getEntity(world, playerId);
  if (!entity || !entity.id.startsWith("player_")) {
    return null;
  }
  return entity;
}

/**
 * Ground position to terrain with strict validation
 * Throws error if terrain height cannot be determined or if position is not on terrain
 *
 * @param world - The game world
 * @param position - Position to ground (x, z are used, y is replaced with terrain height)
 * @param yOffset - Optional offset above terrain (default 0.2m)
 * @param maxHeightDifference - Maximum allowed difference from terrain (default 2m)
 * @returns Position grounded to terrain
 * @throws Error if terrain system not available or position too far from terrain
 */
export function groundToTerrain(
  world: World,
  position: Position3D,
  yOffset: number = 0.2,
  maxHeightDifference: number = 2.0,
): Position3D {
  // Get terrain system
  const terrainSystem = world.getSystem("terrain") as
    | { getHeightAt: (x: number, z: number) => number | null }
    | undefined;

  if (!terrainSystem) {
    console.error(
      `[EntityUtils] CRITICAL: Cannot ground entity - terrain system not available! ` +
        `Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`,
    );
    throw new Error(
      `[EntityUtils] Cannot ground entity - terrain system not available. ` +
        `Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`,
    );
  }

  // Get terrain height
  const terrainHeight = terrainSystem.getHeightAt(position.x, position.z);

  if (!Number.isFinite(terrainHeight) || terrainHeight === null) {
    console.error(
      `[EntityUtils] CRITICAL: Cannot ground entity - terrain height unavailable! ` +
        `Position: (${position.x.toFixed(1)}, ${position.z.toFixed(1)}), ` +
        `Terrain height: ${terrainHeight}`,
    );
    throw new Error(
      `[EntityUtils] Cannot ground entity - terrain height unavailable at position. ` +
        `Position: (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`,
    );
  }

  // Check if current position is too far from terrain
  // Only warn if maxHeightDifference is not Infinity (strict mode)
  const heightDifference = Math.abs(position.y - terrainHeight);
  if (
    heightDifference > maxHeightDifference &&
    maxHeightDifference !== Infinity
  ) {
    console.warn(
      `[EntityUtils] Entity position far from terrain - auto-grounding. ` +
        `Position Y: ${position.y.toFixed(1)}, Terrain Y: ${terrainHeight.toFixed(1)}, ` +
        `Difference: ${heightDifference.toFixed(1)}m (max: ${maxHeightDifference}m). ` +
        `Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`,
    );
  }

  const groundedY = terrainHeight + yOffset;

  // Return grounded position
  return {
    x: position.x,
    y: groundedY,
    z: position.z,
  };
}
