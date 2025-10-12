/**
 * Ground positioning and terrain types
 * 
 * These types are used for ground detection, terrain interaction,
 * and entity positioning on surfaces.
 */

import type THREE from '../extras/three';

/**
 * Result of a ground position calculation
 */
export interface GroundPositionResult {
  position: THREE.Vector3;
  method: 'terrain' | 'ground-checking' | 'raycast' | 'fallback';
  success: boolean;
  originalHeight?: number;
  groundHeight?: number;
}

/**
 * Result of ground height check
 */
export interface GroundHeightResult {
  groundHeight: number;
  isValid: boolean;
  correction: THREE.Vector3;
}

/**
 * Minimal entity interface for spatial operations
 * Used by systems that only need id and position
 */
export interface SpatialEntity {
  id: string;
  position: THREE.Vector3;
}