/** Handles entity facing/rotation towards targets using pooled quaternions */

import type { World } from "@hyperforge/shared";
import type { Position3D } from "@hyperforge/shared";
import { quaternionPool } from "@hyperforge/shared";
import { getEntityPosition } from "@hyperforge/shared";
import { Logger } from "@hyperforge/shared";

const DEBUG_PVP_ROTATION = process.env.DEBUG_PVP_ROTATION === "true";

/**
 * Quaternion-like interface for rotation
 */
interface QuaternionLike {
  set(x: number, y: number, z: number, w: number): void;
  copy(source: { x: number; y: number; z: number; w: number }): void;
}

/**
 * Simple quaternion-like object for server-side rotation storage
 * (used by Entity.rotation on server, different from THREE.Quaternion)
 */
interface QuaternionObject {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Entity interface for rotation operations
 */
interface RotatableEntity {
  id: string;
  position?: Position3D;
  getPosition?: () => Position3D | undefined;
  // Server-side rotation (plain object with x,y,z,w)
  rotation?: QuaternionObject;
  // Client-side base transform (THREE.Object3D with quaternion)
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
   * Rotate an entity to face a target (tile-based-MMORPG-style instant rotation)
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
      if (entityType === "player" && targetType === "player") {
        Logger.systemWarn(
          "CombatRotationManager",
          `PvP rotation failed - attacker ${entityId}: ${entity ? "found" : "MISSING"}, target ${targetId}: ${target ? "found" : "MISSING"}`,
        );
      }
      return;
    }

    // Get positions using centralized utility
    const entityPos = getEntityPosition(entity);
    const targetPos = getEntityPosition(target);

    if (!entityPos || !targetPos) {
      if (entityType === "player" && targetType === "player") {
        Logger.systemWarn(
          "CombatRotationManager",
          `PvP rotation failed - entityPos: ${entityPos ? "found" : "NOT FOUND"}, targetPos: ${targetPos ? "found" : "NOT FOUND"}`,
        );
      }
      return;
    }

    // Calculate angle to target (XZ plane only)
    const dx = targetPos.x - entityPos.x;
    const dz = targetPos.z - entityPos.z;
    let angle = Math.atan2(dx, dz);

    // VRM 1.0+ models have 180° base rotation, so we need to compensate
    // Otherwise entities face AWAY from each other instead of towards
    angle += Math.PI;

    if (
      DEBUG_PVP_ROTATION &&
      entityType === "player" &&
      targetType === "player"
    ) {
      Logger.system(
        "CombatRotationManager",
        `PvP rotation: ${entityId} -> ${targetId}, angle: ${((angle * 180) / Math.PI).toFixed(1)}°`,
      );
    }

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
   *
   * Sets rotation on:
   * - entity.rotation (server-side storage, used for network sync)
   * - entity.base.quaternion (client-side THREE.js transform)
   * - entity.node.quaternion (client-side visual node)
   */
  private applyRotation(
    entity: RotatableEntity,
    entityType: "player" | "mob",
    angle: number,
  ): void {
    const tempQuat = quaternionPool.acquire();
    quaternionPool.setYRotation(tempQuat, angle);

    try {
      // CRITICAL: Always set entity.rotation for server-side sync
      // This is what EntityManager.syncNetworkDirtyEntities() reads to broadcast
      // Without this, rotation changes on server are never sent to clients
      if (entity.rotation) {
        entity.rotation.x = tempQuat.x;
        entity.rotation.y = tempQuat.y;
        entity.rotation.z = tempQuat.z;
        entity.rotation.w = tempQuat.w;
      }

      // For client-side rendering, also set THREE.js objects
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

    // Mark network dirty so EntityManager broadcasts the rotation change
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
