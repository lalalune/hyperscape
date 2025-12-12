/**
 * Test Fixtures - Positions
 *
 * Pre-defined world positions for consistent testing.
 * These represent common spawn points, landmarks, and test areas.
 */

import type { TestPosition } from "../validation";

// =============================================================================
// SPAWN POINTS
// =============================================================================

/**
 * Default player spawn position
 */
export const SPAWN_POINT: TestPosition = {
  x: 10,
  y: 0,
  z: 10,
};

/**
 * Alternative spawn for multiplayer tests
 */
export const SPAWN_POINT_2: TestPosition = {
  x: 15,
  y: 0,
  z: 15,
};

/**
 * Safe zone spawn (no combat)
 */
export const SAFE_ZONE_SPAWN: TestPosition = {
  x: 50,
  y: 0,
  z: 50,
};

// =============================================================================
// BANK LOCATIONS
// =============================================================================

/**
 * Main bank position
 */
export const BANK_POSITION: TestPosition = {
  x: 100,
  y: 0,
  z: 100,
};

/**
 * Position adjacent to bank (within interaction range)
 */
export const NEAR_BANK_POSITION: TestPosition = {
  x: 101,
  y: 0,
  z: 100,
};

/**
 * Position far from bank (outside interaction range)
 */
export const FAR_FROM_BANK_POSITION: TestPosition = {
  x: 110,
  y: 0,
  z: 100,
};

// =============================================================================
// STORE LOCATIONS
// =============================================================================

/**
 * General store position
 */
export const GENERAL_STORE_POSITION: TestPosition = {
  x: 120,
  y: 0,
  z: 80,
};

/**
 * Weapon shop position
 */
export const WEAPON_SHOP_POSITION: TestPosition = {
  x: 130,
  y: 0,
  z: 80,
};

// =============================================================================
// COMBAT TEST POSITIONS
// =============================================================================

/**
 * Position for attacker in melee range
 */
export const MELEE_ATTACKER_POSITION: TestPosition = {
  x: 50,
  y: 0,
  z: 50,
};

/**
 * Position for target adjacent to melee attacker
 */
export const MELEE_TARGET_POSITION: TestPosition = {
  x: 51,
  y: 0,
  z: 50,
};

/**
 * Position for ranged attacker
 */
export const RANGED_ATTACKER_POSITION: TestPosition = {
  x: 60,
  y: 0,
  z: 60,
};

/**
 * Position for target within ranged range
 */
export const RANGED_TARGET_IN_RANGE: TestPosition = {
  x: 68,
  y: 0,
  z: 60,
};

/**
 * Position for target outside ranged range
 */
export const RANGED_TARGET_OUT_OF_RANGE: TestPosition = {
  x: 80,
  y: 0,
  z: 60,
};

// =============================================================================
// RESOURCE GATHERING LOCATIONS
// =============================================================================

/**
 * Tree position for woodcutting
 */
export const TREE_POSITION: TestPosition = {
  x: 200,
  y: 0,
  z: 150,
};

/**
 * Fishing spot position
 */
export const FISHING_SPOT_POSITION: TestPosition = {
  x: 180,
  y: 0,
  z: 200,
};

/**
 * Mining rock position
 */
export const MINING_ROCK_POSITION: TestPosition = {
  x: 220,
  y: 0,
  z: 180,
};

// =============================================================================
// WILDERNESS / PVP ZONES
// =============================================================================

/**
 * Wilderness entry position
 */
export const WILDERNESS_ENTRY: TestPosition = {
  x: 300,
  y: 0,
  z: 300,
};

/**
 * Deep wilderness position
 */
export const DEEP_WILDERNESS: TestPosition = {
  x: 400,
  y: 0,
  z: 400,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a position offset from another position
 */
export function offsetPosition(
  base: TestPosition,
  dx: number,
  dy: number = 0,
  dz: number,
): TestPosition {
  return {
    x: base.x + dx,
    y: base.y + dy,
    z: base.z + dz,
  };
}

/**
 * Create an array of positions in a line
 */
export function createPositionLine(
  start: TestPosition,
  direction: { dx: number; dz: number },
  count: number,
  spacing: number = 1,
): TestPosition[] {
  const positions: TestPosition[] = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      x: start.x + direction.dx * spacing * i,
      y: start.y,
      z: start.z + direction.dz * spacing * i,
    });
  }
  return positions;
}

/**
 * Create positions in a grid
 */
export function createPositionGrid(
  origin: TestPosition,
  width: number,
  height: number,
  spacing: number = 1,
): TestPosition[] {
  const positions: TestPosition[] = [];
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      positions.push({
        x: origin.x + x * spacing,
        y: origin.y,
        z: origin.z + z * spacing,
      });
    }
  }
  return positions;
}

/**
 * Calculate 2D distance between positions
 */
export function distance2D(a: TestPosition, b: TestPosition): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Calculate 3D distance between positions
 */
export function distance3D(a: TestPosition, b: TestPosition): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate Chebyshev (tile) distance between positions
 */
export function chebyshevDistance(
  a: TestPosition,
  b: TestPosition,
  tileSize: number = 1,
): number {
  const tileAX = Math.floor(a.x / tileSize);
  const tileAZ = Math.floor(a.z / tileSize);
  const tileBX = Math.floor(b.x / tileSize);
  const tileBZ = Math.floor(b.z / tileSize);
  return Math.max(Math.abs(tileAX - tileBX), Math.abs(tileAZ - tileBZ));
}
