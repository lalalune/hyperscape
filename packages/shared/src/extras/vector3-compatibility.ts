/**
 * Vector3 Compatibility Utilities
 * 
 * This module provides utilities for handling Vector3 types across the Hyperscape project.
 * 
 * Best Practices:
 * 1. Import THREE from 'three' for standard THREE.js functionality
 * 2. Use ReactiveVector3 when you need change detection (e.g., in Node transforms)
 * 3. Use these utilities when converting between different vector representations
 */

import THREE from './three'

// Re-export for convenience
export { toTHREEVector3 } from './three'

/**
 * Create a Vector3 from components
 */
export function createVector3(x: number = 0, y: number = 0, z: number = 0): THREE.Vector3 {
  return new THREE.Vector3(x, y, z)
}

/**
 * Clone a vector to ensure a new instance
 */
export function cloneVector3(vec: THREE.Vector3 | { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(vec.x, vec.y, vec.z)
}

/**
 * Convert to a plain object (useful for serialization)
 */
export function toVector3Object(vec: THREE.Vector3 | { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return { x: vec.x, y: vec.y, z: vec.z }
}

/**
 * Type guard for vector-like objects
 */
export function isVector3Like(obj: unknown): obj is { x: number; y: number; z: number } {
  if (obj === null || typeof obj !== 'object') return false
  const vec = obj as Record<string, unknown>
  return (
    typeof vec.x === 'number' &&
    typeof vec.y === 'number' &&
    typeof vec.z === 'number'
  )
}

/**
 * Safe vector assignment
 * Use this when you need to assign a vector value to any vector-like target
 */
export function assignVector3(
  target: THREE.Vector3,
  source: THREE.Vector3
): void {
  target.set(source.x, source.y, source.z)
}

/**
 * Usage Guide:
 * 
 * 1. Import THREE.js directly:
 *    import THREE from './three'
 * 
 * 2. For reactive updates (e.g., in Node transforms):
 *    - Use ReactiveVector3 wrapper
 *    - Or manually call update methods after changes
 * 
 * 3. Common patterns:
 *    // Creating a position
 *    const position = new THREE.Vector3(0, 0, 0)
 *    
 *    // Cloning a position
 *    const newPos = position.clone()
 *    
 *    // Safe assignment
 *    assignVector3(target.position, source.position)
 */