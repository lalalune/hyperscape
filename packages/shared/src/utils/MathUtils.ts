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
  // Add null/undefined checks to prevent crashes
  if (!pos1 || !pos2) {
    console.warn('[MathUtils] calculateDistance called with null/undefined position');
    return Infinity; // Return large distance for null positions
  }
  
  // Handle empty objects or malformed positions
  if (typeof pos1 !== 'object' || typeof pos2 !== 'object') {
    console.warn('[MathUtils] calculateDistance called with non-object positions', { pos1, pos2 });
    return Infinity;
  }
  
  // Check if positions have the required properties
  if (typeof pos1.x !== 'number' || typeof pos1.y !== 'number' || typeof pos1.z !== 'number' ||
      typeof pos2.x !== 'number' || typeof pos2.y !== 'number' || typeof pos2.z !== 'number') {
    
    // Check if these are empty objects (common case for uninitialized entities)
    const isPos1Empty = Object.keys(pos1 || {}).length === 0;
    const isPos2Empty = Object.keys(pos2 || {}).length === 0;
    
    // Only log detailed warnings for non-empty objects with invalid coordinates
    // This reduces spam for common uninitialized entity cases
    if (!isPos1Empty || !isPos2Empty) {
      // Get stack trace to help identify where invalid positions come from
      const stack = new Error().stack?.split('\n').slice(1, 4).join(' | ') || 'No stack available';
      
      console.warn('[MathUtils] calculateDistance called with invalid position coordinates', { 
        pos1: { x: pos1?.x, y: pos1?.y, z: pos1?.z, type: typeof pos1 }, 
        pos2: { x: pos2?.x, y: pos2?.y, z: pos2?.z, type: typeof pos2 }
      });
      console.warn('[MathUtils] Stack trace:', stack);
    }
    
    return Infinity;
  }
  
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate 2D distance (ignoring Y axis)
 */
export function calculateDistance2D(pos1: Vector3, pos2: Vector3): number {
  // Add null/undefined checks to prevent crashes
  if (!pos1 || !pos2) {
    console.warn('[MathUtils] calculateDistance2D called with null/undefined position');
    return Infinity;
  }
  
  if (typeof pos1.x !== 'number' || typeof pos1.z !== 'number' ||
      typeof pos2.x !== 'number' || typeof pos2.z !== 'number') {
    // Check if these are empty objects (common case for uninitialized entities)
    const isPos1Empty = Object.keys(pos1 || {}).length === 0;
    const isPos2Empty = Object.keys(pos2 || {}).length === 0;
    
    // Only log warnings for non-empty objects with invalid coordinates
    if (!isPos1Empty || !isPos2Empty) {
      console.warn('[MathUtils] calculateDistance2D called with invalid position coordinates', { pos1, pos2 });
    }
    return Infinity;
  }
  
  const dx = pos2.x - pos1.x;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Clamp a value between min and max
 * Handles reversed min/max gracefully by ensuring correct order
 */
export function clamp(value: number, min: number, max: number): number {
  // Ensure min is actually the minimum and max is the maximum
  const actualMin = Math.min(min, max);
  const actualMax = Math.max(min, max);
  return Math.max(actualMin, Math.min(actualMax, value));
}