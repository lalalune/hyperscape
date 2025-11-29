/**
 * Gathering Calculations
 *
 * OSRS-style tick-based timing utilities for resource gathering.
 * All gathering actions operate on 600ms game ticks.
 */

import { TICK_DURATION_MS } from "../../systems/shared/movement/TileSystem";

/**
 * Convert milliseconds to game ticks
 * Minimum of 2 ticks to prevent instant gathering
 */
export function gatherCycleMsToTicks(ms: number): number {
  return Math.max(2, Math.round(ms / TICK_DURATION_MS));
}

/**
 * Convert game ticks to milliseconds
 * Used for client-side progress bar display
 */
export function gatherCycleTicksToMs(ticks: number): number {
  return ticks * TICK_DURATION_MS;
}

/**
 * Get the tick duration constant
 */
export function getTickDurationMs(): number {
  return TICK_DURATION_MS;
}
