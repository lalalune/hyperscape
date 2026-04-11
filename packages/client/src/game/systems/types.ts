/**
 * Shared types for game systems
 * @packageDocumentation
 */

// ============================================================================
// Geometry Types
// ============================================================================

/** 2D point coordinates */
export interface Point {
  x: number;
  y: number;
}

/** 2D size dimensions */
export interface Size {
  width: number;
  height: number;
}

/** Rectangle combining position and size */
export interface Rect extends Point, Size {}
