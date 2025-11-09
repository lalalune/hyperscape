/**
 * Core math utilities for spatial calculations
 * Used by multiple systems throughout the engine
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Calculate 3D distance between two positions
 */
export function calculateDistance(pos1: Vector3, pos2: Vector3): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate 2D distance (ignoring Y axis)
 */
export function calculateDistance2D(pos1: Vector3, pos2: Vector3): number {
  const dx = pos2.x - pos1.x;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
