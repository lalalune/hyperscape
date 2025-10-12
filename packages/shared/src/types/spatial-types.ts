/**
 * Spatial indexing types
 * 
 * These types are used for spatial queries, collision detection,
 * and entity positioning across various systems.
 */

import type THREE from '../extras/three';
import type { Entity } from '../entities/Entity';

/**
 * Spatial cell containing entities
 */
export interface SpatialCell {
  entities: Set<Entity>;
}

/**
 * Query parameters for spatial searches
 */
export interface SpatialQuery {
  position: THREE.Vector3;
  radius: number;
  filter?: (entity: Entity) => boolean;
  maxResults?: number;
}