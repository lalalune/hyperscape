/**
 * Processing System Types
 *
 * Type definitions for firemaking and cooking systems.
 * Matches GatheringSession pattern for consistency.
 */

import type { PlayerID } from "../../../../types/core/identifiers";

/**
 * Cached tuning data for a processing session.
 * Pre-computed at session start to avoid per-tick allocations.
 */
export interface ProcessingTuning {
  levelRequired: number;
  xpAmount: number;
  tickDuration: number;
}

/**
 * Debug information (only used when DEBUG_PROCESSING=true)
 */
export interface ProcessingDebugInfo {
  skill: "firemaking" | "cooking";
  itemType: string;
  sourceType?: "fire" | "range";
}

/**
 * Active firemaking session data.
 *
 * PERFORMANCE: All data cached at session start to avoid per-tick allocations.
 * RULES ACCURACY: Start position cached for movement detection (cancels action).
 */
export interface FiremakingSession {
  playerId: PlayerID;
  startTick: number;
  nextAttemptTick: number;
  attempts: number;

  // PERFORMANCE: Cached at session start
  cachedLogId: string;
  cachedLogSlot: number;
  cachedTinderboxSlot: number;
  cachedSuccessRate: number;
  cachedXpAmount: number;
  cachedStartPosition: { x: number; y: number; z: number };

  // DEBUG: Only populated when DEBUG_PROCESSING=true
  debugInfo?: ProcessingDebugInfo;
}

/**
 * Active cooking session data.
 *
 * Supports "Cook All" with quantity tracking.
 */
export interface CookingSession {
  playerId: PlayerID;
  startTick: number;
  nextCookTick: number;

  // Quantity tracking for "Cook All"
  totalQuantity: number;
  cookedCount: number;
  burntCount: number;

  // PERFORMANCE: Cached at session start
  cachedFoodId: string;
  cachedCookedId: string;
  cachedBurntId: string;
  cachedSourceId: string;
  cachedSourceType: "fire" | "range";
  cachedBurnChance: number;
  cachedXpAmount: number;
  cachedStartPosition: { x: number; y: number; z: number };

  // FUTURE: Equipment flags (checked at session start)
  // hasGauntlets: boolean;
  // hasCookingCape: boolean;

  // DEBUG
  debugInfo?: ProcessingDebugInfo;
}

/**
 * Fire object data.
 */
export interface Fire {
  id: string;
  position: { x: number; y: number; z: number };
  tile: { x: number; z: number };
  playerId: PlayerID;
  createdAtTick: number;
  expiresAtTick: number;
  isActive: boolean;
}

/**
 * Cooking source (fire or range).
 */
export interface CookingSource {
  id: string;
  type: "fire" | "range";
  position: { x: number; y: number; z: number };
  tile: { x: number; z: number };
}
