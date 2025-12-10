/**
 * Utility functions for type conversions and helpers
 *
 * This file contains strongly-typed utility functions for working with Position3D
 * and THREE.js Vector3 types, ensuring type safety across position calculations.
 */

import type { Position3D } from "./core";
import THREE from "../../extras/three/three";

// Position conversion utilities
export function toVector3(
  pos: Position3D | THREE.Vector3,
  target: THREE.Vector3,
): THREE.Vector3 {
  // Both Position3D and THREE.Vector3 have x, y, z properties
  return target.set(pos.x, pos.y, pos.z);
}

export function toPosition3D(pos: Position3D | THREE.Vector3): Position3D {
  return { x: pos.x, y: pos.y, z: pos.z };
}

/**
 * Convert to Position3D with zero allocation by writing to target object
 * Use this in hot paths where you don't need a new object
 */
export function toPosition3DInto(
  pos: Position3D | THREE.Vector3,
  target: Position3D,
): Position3D {
  target.x = pos.x;
  target.y = pos.y;
  target.z = pos.z;
  return target;
}

// Position comparison
export function positionsEqual(
  a: Position3D,
  b: Position3D,
  tolerance = 0.001,
): boolean {
  return (
    Math.abs(a.x - b.x) < tolerance &&
    Math.abs(a.y - b.y) < tolerance &&
    Math.abs(a.z - b.z) < tolerance
  );
}

// Distance calculation
export function distance3D(a: Position3D, b: Position3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Linear interpolation (alpha should be between 0 and 1)
export function lerpPosition(
  from: Position3D,
  to: Position3D,
  alpha: number,
  target: Position3D,
): Position3D {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  target.x = from.x + (to.x - from.x) * clampedAlpha;
  target.y = from.y + (to.y - from.y) * clampedAlpha;
  target.z = from.z + (to.z - from.z) * clampedAlpha;
  return target;
}

// Clamping utilities
export function clampPosition(
  pos: Position3D,
  min: Position3D,
  max: Position3D,
  target: Position3D,
): Position3D {
  target.x = Math.max(min.x, Math.min(max.x, pos.x));
  target.y = Math.max(min.y, Math.min(max.y, pos.y));
  target.z = Math.max(min.z, Math.min(max.z, pos.z));
  return target;
}

// Direction utilities
export function normalizeDirection(
  dir: Position3D,
  target: Position3D,
): Position3D {
  const length = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
  if (length === 0) {
    target.x = 0;
    target.y = 0;
    target.z = 0;
    return target;
  }
  target.x = dir.x / length;
  target.y = dir.y / length;
  target.z = dir.z / length;
  return target;
}

export function getDirection(
  from: Position3D,
  to: Position3D,
  target: Position3D,
): Position3D {
  target.x = to.x - from.x;
  target.y = to.y - from.y;
  target.z = to.z - from.z;
  return normalizeDirection(target, target);
}

// Angle utilities
export function getYawAngle(from: Position3D, to: Position3D): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return Math.atan2(dz, dx);
}

// Grid utilities
export function snapToGrid(
  pos: Position3D,
  gridSize = 1,
  target: Position3D,
): Position3D {
  target.x = Math.round(pos.x / gridSize) * gridSize;
  target.y = Math.round(pos.y / gridSize) * gridSize;
  target.z = Math.round(pos.z / gridSize) * gridSize;
  return target;
}

// Random position utilities
export function randomPositionInRadius(
  center: Position3D,
  radius: number,
  minRadius = 0,
  target: Position3D,
): Position3D {
  if (radius < minRadius) throw new Error("radius must be >= minRadius");
  const angle = Math.random() * Math.PI * 2;
  const distance = minRadius + Math.random() * (radius - minRadius);
  target.x = center.x + Math.cos(angle) * distance;
  target.y = center.y;
  target.z = center.z + Math.sin(angle) * distance;
  return target;
}

// Bounds checking
export function isInBounds(
  pos: Position3D,
  min: Position3D,
  max: Position3D,
): boolean {
  return (
    pos.x >= min.x &&
    pos.x <= max.x &&
    pos.y >= min.y &&
    pos.y <= max.y &&
    pos.z >= min.z &&
    pos.z <= max.z
  );
}

// Array utilities
export function averagePosition(
  positions: Position3D[],
  target: Position3D,
): Position3D {
  if (positions.length === 0) {
    target.x = 0;
    target.y = 0;
    target.z = 0;
    return target;
  }

  const sum = positions.reduce(
    (acc, pos) => {
      acc.x += pos.x;
      acc.y += pos.y;
      acc.z += pos.z;
      return acc;
    },
    { x: 0, y: 0, z: 0 },
  );

  target.x = sum.x / positions.length;
  target.y = sum.y / positions.length;
  target.z = sum.z / positions.length;
  return target;
}
