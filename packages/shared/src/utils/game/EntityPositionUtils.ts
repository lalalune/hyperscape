/**
 * Entity Position Utilities
 *
 * Centralized position retrieval for entities.
 * Handles the various ways entities store position data:
 * - Direct .position property
 * - .getPosition() method
 * - Three.js .node.position
 *
 * This eliminates the duplicated pattern:
 *   const pos = entity.position || entity.getPosition();
 *
 * @see COMBAT_SYSTEM_IMPROVEMENTS.md Section 2.1
 */

/**
 * 3D position interface
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Entity interface for position retrieval
 * Supports multiple position access patterns
 */
interface PositionableEntity {
  position?: Position3D;
  getPosition?: () => Position3D | undefined;
  node?: {
    position?: {
      x: number;
      y: number;
      z: number;
    };
  };
}

/**
 * Get position from an entity using any available method.
 *
 * Checks in order:
 * 1. Direct .position property
 * 2. .getPosition() method
 * 3. Three.js .node.position
 *
 * @param entity - Entity to get position from
 * @returns Position3D or null if no position available
 *
 * @example
 * ```typescript
 * const pos = getEntityPosition(attacker);
 * if (!pos) return; // Entity has no position
 *
 * const distance = calculateDistance(pos, targetPos);
 * ```
 */
export function getEntityPosition(
  entity: PositionableEntity | null | undefined,
): Position3D | null {
  if (!entity) {
    return null;
  }

  // Check direct position property first (most common)
  if (entity.position) {
    return entity.position;
  }

  // Check getPosition() method
  if (typeof entity.getPosition === "function") {
    const pos = entity.getPosition();
    if (pos) {
      return pos;
    }
  }

  // Check Three.js node.position (for rendered entities)
  if (entity.node?.position) {
    return {
      x: entity.node.position.x,
      y: entity.node.position.y,
      z: entity.node.position.z,
    };
  }

  return null;
}

/**
 * Get position from an entity, throwing if not available.
 * Use when position is required and missing position is a bug.
 *
 * @param entity - Entity to get position from
 * @param entityId - ID for error message
 * @returns Position3D
 * @throws Error if no position available
 *
 * @example
 * ```typescript
 * const pos = getEntityPositionRequired(attacker, attackerId);
 * // pos is guaranteed to be Position3D here
 * ```
 */
export function getEntityPositionRequired(
  entity: PositionableEntity | null | undefined,
  entityId: string,
): Position3D {
  const pos = getEntityPosition(entity);
  if (!pos) {
    throw new Error(`Entity ${entityId} has no position`);
  }
  return pos;
}

/**
 * Check if two positions are equal (within epsilon for floating point)
 *
 * @param a - First position
 * @param b - Second position
 * @param epsilon - Tolerance for floating point comparison (default 0.001)
 * @returns true if positions are equal within epsilon
 */
export function positionsEqual(
  a: Position3D,
  b: Position3D,
  epsilon: number = 0.001,
): boolean {
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.z - b.z) < epsilon
  );
}

/**
 * Copy position values to avoid mutations
 *
 * @param pos - Position to copy
 * @returns New Position3D object with same values
 */
export function copyPosition(pos: Position3D): Position3D {
  return {
    x: pos.x,
    y: pos.y,
    z: pos.z,
  };
}
