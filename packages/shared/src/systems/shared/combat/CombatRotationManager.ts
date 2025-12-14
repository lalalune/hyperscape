/**
 * CombatRotationManager - Entity rotation during combat
 *
 * Single Responsibility: Handle entity facing/rotation towards targets
 * Uses pooled quaternions to avoid allocations in hot paths.
 */

import type { World } from "../../../core/World";
import { quaternionPool } from "../../../utils/pools/QuaternionPool";
import { getEntityPosition } from "../../../utils/game/EntityPositionUtils";

/**
 * Position interface for entities
 */
interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Quaternion-like interface for rotation
 */
interface QuaternionLike {
  set(x: number, y: number, z: number, w: number): void;
  copy(source: { x: number; y: number; z: number; w: number }): void;
}

/**
 * Entity interface for rotation operations
 */
interface RotatableEntity {
  id: string;
  position?: Position3D;
  getPosition?: () => Position3D | undefined;
  base?: {
    quaternion?: QuaternionLike;
  };
  node?: {
    position?: {
      x: number;
      y: number;
      z: number;
    };
    quaternion?: QuaternionLike;
  };
  markNetworkDirty?: () => void;
}

export class CombatRotationManager {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Rotate an entity to face a target (RuneScape-style instant rotation)
   * @param entityId - Entity to rotate
   * @param targetId - Target to face
   * @param entityType - Whether entity is player or mob
   * @param targetType - Whether target is player or mob
   */
  rotateTowardsTarget(
    entityId: string,
    targetId: string,
    entityType: "player" | "mob",
    targetType: "player" | "mob",
  ): void {
    // Get entities properly based on type
    const entity = this.getEntity(entityId, entityType);
    const target = this.getEntity(targetId, targetType);

    if (!entity || !target) {
      return;
    }

    // Get positions using centralized utility
    const entityPos = getEntityPosition(entity);
    const targetPos = getEntityPosition(target);

    if (!entityPos || !targetPos) {
      return;
    }

    // Calculate angle to target (XZ plane only)
    const dx = targetPos.x - entityPos.x;
    const dz = targetPos.z - entityPos.z;
    let angle = Math.atan2(dx, dz);

    // VRM 1.0+ models have 180° base rotation, so we need to compensate
    // Otherwise entities face AWAY from each other instead of towards
    angle += Math.PI;

    // Set rotation using pooled quaternion to avoid allocations
    this.applyRotation(entity, entityType, angle);
  }

  /**
   * Get entity by type (player or mob)
   */
  private getEntity(
    entityId: string,
    entityType: "player" | "mob",
  ): RotatableEntity | null {
    if (entityType === "player") {
      return this.world.getPlayer?.(entityId) as RotatableEntity | null;
    }
    return this.world.entities.get(entityId) as RotatableEntity | null;
  }

  /**
   * Apply Y-axis rotation to entity using pooled quaternion
   */
  private applyRotation(
    entity: RotatableEntity,
    entityType: "player" | "mob",
    angle: number,
  ): void {
    const tempQuat = quaternionPool.acquire();
    quaternionPool.setYRotation(tempQuat, angle);

    try {
      if (entityType === "player" && entity.base?.quaternion) {
        // For players, set on base and node
        entity.base.quaternion.set(
          tempQuat.x,
          tempQuat.y,
          tempQuat.z,
          tempQuat.w,
        );
        if (entity.node?.quaternion) {
          entity.node.quaternion.copy(tempQuat);
        }
      } else if (entity.node?.quaternion) {
        // For mobs and other entities, set on node
        entity.node.quaternion.set(
          tempQuat.x,
          tempQuat.y,
          tempQuat.z,
          tempQuat.w,
        );
      }
    } finally {
      // Always release back to pool
      quaternionPool.release(tempQuat);
    }

    // Mark network dirty
    entity.markNetworkDirty?.();
  }

  /**
   * Calculate angle from one position to another (Y-axis rotation)
   * Useful for preview/debug purposes
   */
  calculateFacingAngle(from: Position3D, to: Position3D): number {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    // Include VRM 1.0+ compensation
    return Math.atan2(dx, dz) + Math.PI;
  }
}
