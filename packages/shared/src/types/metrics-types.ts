/**
 * Metrics and performance tracking types
 * 
 * These types are used for tracking various metrics across the game engine,
 * including performance, visual quality, and system health.
 */

export interface PerformanceMetrics {
  renderTime?: number;
  physicsTime?: number;
  networkLatency?: number;
  memoryUsage?: number;
}

export interface VisualMetrics {
  pixelAccuracy?: number;
  geometryValidation?: number;
  shaderCompliance?: number;
}

export interface SystemMetrics {
  entityCreation?: number;
  componentUpdates?: number;
  systemProcessing?: number;
}

export interface GameplayMetrics {
  combatEvents?: number;
  skillsUsed?: number;
  itemsCollected?: number;
  questsCompleted?: number;
}

export interface GameMetrics {
  performance?: PerformanceMetrics;
  visual?: VisualMetrics;
  gameplay?: GameplayMetrics;
  system?: SystemMetrics;
}

// Game task result pack used by reporters
export type GameTaskResultPack = [id: string, result: unknown, meta: GameTaskMeta]

export interface GameTaskMeta {
  name?: string
  performance?: PerformanceMetrics
  visual?: VisualMetrics
  gameplay?: GameplayMetrics
  system?: SystemMetrics
}

export interface TestMetrics {
  testsPassed: number;
  testsFailed: number;
  duration: number;
  systemRating?: string;
}