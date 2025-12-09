import { IAgentRuntime, logger, UUID } from "@elizaos/core";
import { Entity, World } from "../types/core-types";
import type { Vector3 } from "@hyperscape/shared";
import type { BuildManager as IBuildManager } from "../types/core-interfaces";
import { THREE } from "@hyperscape/shared";

/**
 * BuildManager handles entity creation, modification, and build system operations
 * for agents in Hyperscape worlds
 */
export class BuildManager implements IBuildManager {
  private runtime: IAgentRuntime;
  private world: World | null = null;
  private buildPermissions: Map<UUID, string[]> = new Map();
  private _tempVec3 = new THREE.Vector3();

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  /**
   * Set the current world for build operations
   */
  setWorld(world: World | null): void {
    this.world = world;
  }

  /**
   * Create a new entity in the world
   */
  createEntity(
    type: string,
    position: Vector3,
    data?: Record<string, unknown>,
  ): Entity {
    // Get the entities system from the world
    const entities = this.world!.entities;

    // Create entity data
    const entityData = {
      id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      position: [position.x, position.y, position.z] as [
        number,
        number,
        number,
      ],
      active: true,
      visible: true,
      ...data,
    };

    // Add entity to world
    const entity = entities.add(entityData) as Entity;
    logger.info(
      `BuildManager: Created entity ${entityData.id} of type ${type}`,
    );

    return entity;
  }

  /**
   * Destroy an entity by ID
   */
  destroyEntity(entityId: string): boolean {
    const entities = this.world!.entities;

    const success = entities.remove(entityId);
    logger.info(`BuildManager: Destroyed entity ${entityId}`);

    return success;
  }

  /**
   * Update an entity with new data
   */
  updateEntity(entityId: string, data: Record<string, unknown>): boolean {
    const entities = this.world!.entities;
    const entity = entities.get(entityId)!;

    // Update entity properties
    Object.assign(entity.data, data);
    logger.info(`BuildManager: Updated entity ${entityId}`);
    return true;
  }

  /**
   * Check if building is allowed at a position
   */
  canBuild(position: Vector3, _type: string): boolean {
    // Check if position is within world bounds (basic check)
    const maxDistance = 1000; // Max distance from origin
    const distance = Math.sqrt(
      position.x ** 2 + position.y ** 2 + position.z ** 2,
    );

    if (distance > maxDistance) {
      return false;
    }

    // Check for overlapping entities (basic collision check)
    const entities = this.world!.entities;
    for (const entity of entities.values()) {
      const entityPos = entity.position!;
      const dx = entityPos.x - position.x;
      const dy = entityPos.y - position.y;
      const dz = entityPos.z - position.z;
      const distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);

      // Minimum spacing between entities
      if (distance < 2.0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get build permissions for an agent
   */
  getBuildPermissions(agentId: UUID): string[] {
    return this.buildPermissions.get(agentId) || ["basic_build"];
  }

  /**
   * Set build permissions for an agent
   */
  setBuildPermissions(agentId: UUID, permissions: string[]): void {
    this.buildPermissions.set(agentId, permissions);
    logger.info(
      `BuildManager: Set permissions for agent ${agentId}: ${permissions.join(", ")}`,
    );
  }

  /**
   * Clear all build permissions
   */
  clearPermissions(): void {
    this.buildPermissions.clear();
    logger.info("BuildManager: Cleared all build permissions");
  }

  /**
   * Get stats about the current world
   */
  getWorldStats(): { entityCount: number; activeEntities: number } {
    let entityCount = 0;
    let activeEntities = 0;

    for (const entity of this.world!.entities.values()) {
      entityCount++;
      if (entity.active !== false) {
        activeEntities++;
      }
    }

    return { entityCount, activeEntities };
  }

  /**
   * Translate an entity to a new position
   */
  translate(entityId: string, position: Vector3): boolean {
    const entity = this.world!.entities.get(entityId)!;

    // Update entity position
    entity.position!.copy(position);

    logger.info(
      `BuildManager: Translated entity ${entityId} to position`,
      `(${position.x}, ${position.y}, ${position.z})`,
    );
    return true;
  }

  /**
   * Rotate an entity
   */
  rotate(entityId: string, rotation: THREE.Quaternion): boolean {
    const entity = this.world!.entities.get(entityId)!;

    // Update entity rotation
    if (entity.node.quaternion) {
      entity.node.quaternion.copy(rotation);
    } else {
      entity.rotation!.copy(rotation);
    }

    logger.info(`BuildManager: Rotated entity ${entityId}`);
    return true;
  }

  /**
   * Scale an entity
   */
  scale(entityId: string, scale: Vector3): boolean {
    const entity = this.world!.entities.get(entityId)!;

    // Update entity scale
    entity.scale!.copy(scale);

    logger.info(
      `BuildManager: Scaled entity ${entityId} to`,
      `(${scale.x}, ${scale.y}, ${scale.z})`,
    );
    return true;
  }

  /**
   * Duplicate an entity
   */
  duplicate(entityId: string): Entity {
    const originalEntity = this.world!.entities.get(entityId)!;

    // Create a duplicate with offset position
    const position = originalEntity.position || { x: 0, y: 0, z: 0 };
    const duplicatePosition = this._tempVec3.set(
      position.x + 1,
      position.y,
      position.z + 1,
    );

    // Create new entity with same type and modified position
    const entityData = originalEntity.data || {};
    const cleanedData = { ...entityData } as Record<string, unknown>;
    // Remove position if it's in array format to avoid type conflicts
    if (Array.isArray(cleanedData.position)) {
      delete cleanedData.position;
    }
    const duplicate = this.createEntity(
      originalEntity.type || "group",
      duplicatePosition,
      cleanedData,
    );

    logger.info(
      `BuildManager: Duplicated entity ${entityId} as ${duplicate.id}`,
    );

    return duplicate;
  }

  /**
   * Delete an entity
   */
  delete(entityId: string): boolean {
    return this.destroyEntity(entityId);
  }

  /**
   * Import an entity from external data
   */
  importEntity(
    entityData: Record<string, unknown>,
    position?: Vector3,
  ): Entity {
    // Use provided position or default
    const importPosition = position || this._tempVec3.set(0, 0, 0);

    // Create entity from imported data
    const entity = this.createEntity(
      (entityData.type as string) || "group",
      importPosition,
      entityData,
    );

    logger.info(`BuildManager: Imported entity as ${entity.id}`);

    return entity;
  }
}
