/**
 * Distance Calculation Utilities
 *
 * OSRS uses Chebyshev distance (square range), not Euclidean (circular range).
 * All game systems MUST use these functions for consistency.
 */

export interface Position2D {
  readonly x: number;
  readonly z: number;
}

/**
 * Calculate Chebyshev distance between two positions.
 *
 * Chebyshev = max(|x1-x2|, |z1-z2|)
 *
 * This creates "square" range checks matching OSRS tile-based mechanics.
 * Example: (3,4) from origin = Chebyshev 4, Euclidean 5
 */
export function chebyshevDistance(a: Position2D, b: Position2D): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

/**
 * Check if two positions are within interaction range.
 */
export function isWithinDistance(
  a: Position2D,
  b: Position2D,
  maxDistance: number,
): boolean {
  return chebyshevDistance(a, b) <= maxDistance;
}
