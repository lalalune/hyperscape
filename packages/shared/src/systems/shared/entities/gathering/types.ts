/**
 * Gathering System Types
 *
 * Type definitions for the resource gathering system.
 * Extracted from ResourceSystem.ts for better modularity.
 */

import type { ResourceDrop } from "../../../../types/core/core";
import type { PlayerID, ResourceID } from "../../../../types/core/identifiers";

/**
 * Cached tuning data for a gathering session.
 * Pre-computed at session start to avoid per-tick allocations.
 */
export interface GatheringTuning {
  levelRequired: number;
  xpPerLog: number;
  depleteChance: number;
  respawnTicks: number;
}

/**
 * Debug information for gathering session (only used when DEBUG_GATHERING=true)
 */
export interface GatheringDebugInfo {
  skill: string;
  variant: string;
  toolTier: string | null;
  lowHigh: { low: number; high: number };
}

/**
 * Active gathering session data.
 *
 * Sessions are tick-based (rules-accurate timing):
 * - startTick: When gathering started
 * - nextAttemptTick: Next tick to roll for success
 * - cycleTickInterval: Ticks between attempts (skill-specific)
 *
 * Performance optimization:
 * - All data cached at session start to avoid per-tick allocations
 * - Start position cached for movement detection (cancels gathering)
 */
export interface GatheringSession {
  playerId: PlayerID;
  resourceId: ResourceID;
  startTick: number;
  nextAttemptTick: number;
  cycleTickInterval: number;
  attempts: number;
  successes: number;

  // PERFORMANCE: Cached at session start to avoid per-tick allocations
  cachedTuning: GatheringTuning;
  cachedSuccessRate: number;
  cachedDrops: ResourceDrop[];
  cachedResourceName: string;

  // RULES ACCURACY: Store start position to detect movement (cancels gathering)
  cachedStartPosition: { x: number; y: number; z: number };

  // DEBUG: Cached for logging (only used when DEBUG_GATHERING=true)
  debugInfo?: GatheringDebugInfo;
}

/**
 * Resource timer data for Forestry-style mechanics.
 *
 * classic MMORPG Forestry mechanics:
 * - Timer starts on FIRST LOG (not first interaction)
 * - Counts down while anyone is gathering
 * - Regenerates when no one is gathering
 * - Tree depletes when timer=0 AND player receives a log
 * - Multiple players share the same timer
 */
export interface ResourceTimer {
  currentTicks: number;
  maxTicks: number;
  hasReceivedFirstLog: boolean;
  activeGatherers: Set<PlayerID>;
  lastUpdateTick: number;
}

/**
 * Fishing spot movement timer data.
 *
 * RULES-ACCURATE: Fishing spots don't deplete - they periodically move.
 * Each spot has a random timer (280-530 ticks, ~2.8-5.3 min) that triggers relocation.
 */
export interface FishingSpotTimer {
  moveAtTick: number;
  spawnPoint: { x: number; z: number };
  possiblePositions: Array<{ x: number; z: number }>;
  areaId: string;
}

/**
 * Success rate values for classic MMORPG LERP formula.
 * low = numerator at level 1, high = numerator at level 99
 */
export interface SuccessRateValues {
  low: number;
  high: number;
}

/**
 * Variant tuning data from resource manifest.
 */
export interface VariantTuning {
  levelRequired: number;
  baseCycleTicks: number;
  xpPerLog: number;
  depleteChance: number;
  respawnTicks: number;
}
