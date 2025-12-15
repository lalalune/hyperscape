/**
 * Base type definitions for core game elements
 * These types are shared across the entire system for consistency
 */

// Basic 3D position
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Position2D {
  x: number;
  y: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

// Base entity data for serialization
export interface EntityData {
  id: string;
  type: string;
  name?: string;
  position?: [number, number, number];
  quaternion?: [number, number, number, number];
  scale?: [number, number, number];

  /** Entity owner socket ID for permission checks */
  owner?: string;

  /**
   * Loading state flag (Issue #356)
   * True while client is loading assets - entity is immune to aggro/combat
   * Used for spawn protection to prevent damage before player is ready
   */
  isLoading?: boolean;

  [key: string]: unknown;
}

// Component data interface
export interface ComponentData {
  type: string;
  data: unknown;
}
