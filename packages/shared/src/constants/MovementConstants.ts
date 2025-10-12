/**
 * Movement-related constants
 */

export const MOVEMENT_CONSTANTS = {
  // Movement speeds (units per second)
  SPEEDS: {
    WALK: 4,
    RUN: 8,
    SNEAK: 2,
  },
  
  // Distance limits
  MAX_MOVEMENT_DISTANCE: 1000, // Maximum distance for a single movement
  MIN_MOVEMENT_DISTANCE: 0.5,  // Minimum distance to consider movement complete
  
  // Timing
  MOVEMENT_TIMEOUT_BUFFER: 3000, // Extra time buffer for pathfinding
  MIN_MOVEMENT_TIMEOUT: 8000,    // Minimum timeout for complex movements
  
  // Test-specific
  TEST_WAYPOINT_REACH_DISTANCE: 1.5,
  TEST_OBSTACLE_AVOIDANCE_DISTANCE: 3,
  TEST_SPAWN_RADIUS: 10,
  
  // Stamina
  STAMINA: {
    MAX: 100,
    DRAIN_RATE_PER_SECOND: 10, // When running
    REGEN_RATE_PER_SECOND: 5,  // When not running
  },
} as const;

/**
 * Calculate estimated movement duration
 */
export function calculateMovementDuration(
  distance: number, 
  isRunning: boolean = false
): number {
  const speed = isRunning ? MOVEMENT_CONSTANTS.SPEEDS.RUN : MOVEMENT_CONSTANTS.SPEEDS.WALK;
  return (distance / speed) * 1000; // Convert to milliseconds
}

/**
 * Calculate appropriate timeout for movement
 */
export function calculateMovementTimeout(
  distance: number,
  isRunning: boolean = false
): number {
  const estimatedDuration = calculateMovementDuration(distance, isRunning);
  const calculatedTimeout = estimatedDuration + MOVEMENT_CONSTANTS.MOVEMENT_TIMEOUT_BUFFER;
  return Math.max(calculatedTimeout, MOVEMENT_CONSTANTS.MIN_MOVEMENT_TIMEOUT);
}