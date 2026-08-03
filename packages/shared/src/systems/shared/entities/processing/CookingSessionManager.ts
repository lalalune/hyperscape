/**
 * Cooking Session Manager
 *
 * Tick-based cooking session management.
 * Follows classic tick-based mechanics:
 * - 4-tick per item
 * - Level-based burn chance (linear interpolation)
 * - "Cook All" support with quantity tracking
 * - Fire vs Range burn rates
 * - Movement cancellation
 *
 */

import { PROCESSING_CONSTANTS } from "../../../../constants/ProcessingConstants";
import type { PlayerID } from "../../../../types/core/identifiers";
import type { CookingSession, CookingSource } from "./types";
import {
  calculateBurnChance,
  getCookingXP,
  getCookingLevelRequired,
  meetsCookingLevel,
  isValidRawFood,
  getCookedItemId,
  getBurntItemId,
} from "./CookingCalculator";
import { DEBUG_PROCESSING } from "./debug";

/**
 * Result of a cooking attempt.
 */
export interface CookingAttemptResult {
  success: boolean;
  burned: boolean;
  playerId: PlayerID;
  rawFoodId: string;
  resultItemId: string;
  xpAwarded: number;
  message: string;
  /** Current progress in "Cook All" */
  progress: {
    cooked: number;
    burnt: number;
    remaining: number;
    total: number;
  };
}

/**
 * Session completion result.
 */
export interface CookingSessionComplete {
  playerId: PlayerID;
  rawFoodId: string;
  totalCooked: number;
  totalBurnt: number;
  totalXp: number;
  reason: "completed" | "cancelled" | "no_food" | "moved" | "disconnected";
}

/**
 * Callback for cooking events.
 */
export interface CookingCallbacks {
  /** Called when item is successfully cooked */
  onItemCooked: (
    playerId: PlayerID,
    rawFoodId: string,
    cookedId: string,
    xp: number,
  ) => void;
  /** Called when item is burnt */
  onItemBurnt: (playerId: PlayerID, rawFoodId: string, burntId: string) => void;
  /** Called when session completes (all items done or cancelled) */
  onSessionComplete: (result: CookingSessionComplete) => void;
  /** Get player's current position for movement detection */
  getPlayerPosition: (
    playerId: PlayerID,
  ) => { x: number; y: number; z: number } | null;
  /** Get player's cooking level */
  getPlayerLevel: (playerId: PlayerID) => number;
  /** Count items of type in player's inventory */
  countItemsInInventory: (playerId: PlayerID, itemId: string) => number;
  /** Remove item from inventory (returns slot it was in, or -1 if not found) */
  removeItemFromInventory: (playerId: PlayerID, itemId: string) => number;
  /** Add item to inventory */
  addItemToInventory: (playerId: PlayerID, itemId: string) => boolean;
  /** Check if cooking source is still valid (fire active, range exists) */
  isCookingSourceValid: (sourceId: string) => boolean;
}

/**
 * Movement threshold for cancellation (in world units).
 */
const MOVEMENT_THRESHOLD = 0.1;

/**
 * Cooking Session Manager
 *
 * Manages active cooking sessions with tick-based processing.
 * Supports "Cook All" with quantity tracking.
 * One session per player maximum.
 */
export class CookingSessionManager {
  /** Active sessions by player ID */
  private sessions: Map<PlayerID, CookingSession> = new Map();

  /** Rate limiting - last request time per player */
  private rateLimits: Map<PlayerID, number> = new Map();

  /** Callbacks for game integration */
  private callbacks: CookingCallbacks;

  constructor(callbacks: CookingCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Start a cooking session.
   *
   * @param playerId - Player attempting to cook
   * @param rawFoodId - Raw food item ID
   * @param source - Cooking source (fire or range)
   * @param quantity - Number of items to cook (1 for single, -1 for all)
   * @param position - Player's current position
   * @param currentTick - Current game tick
   * @returns Error message if validation fails, null on success
   */
  startSession(
    playerId: PlayerID,
    rawFoodId: string,
    source: CookingSource,
    quantity: number,
    position: { x: number; y: number; z: number },
    currentTick: number,
  ): string | null {
    // Rate limiting
    const now = Date.now();
    const lastRequest = this.rateLimits.get(playerId);
    if (lastRequest && now - lastRequest < PROCESSING_CONSTANTS.RATE_LIMIT_MS) {
      return null; // Silently drop (classic MMORPG behavior)
    }
    this.rateLimits.set(playerId, now);

    // Cancel existing session if any
    if (this.sessions.has(playerId)) {
      this.cancelSession(playerId, "started_new_action");
    }

    // Validate food type
    if (!isValidRawFood(rawFoodId)) {
      return `Invalid food type: ${rawFoodId}`;
    }

    // Validate level requirement
    const playerLevel = this.callbacks.getPlayerLevel(playerId);
    const levelRequired = getCookingLevelRequired(rawFoodId);
    if (!meetsCookingLevel(playerLevel, rawFoodId)) {
      const foodName = rawFoodId.replace(/^raw_/, "").replace(/_/g, " ");
      return `You need a Cooking level of ${levelRequired} to cook ${foodName}.`;
    }

    // Validate cooking source
    if (!this.callbacks.isCookingSourceValid(source.id)) {
      return source.type === "fire"
        ? "The fire has gone out."
        : "You can't cook on that.";
    }

    // Count available raw food
    const availableCount = this.callbacks.countItemsInInventory(
      playerId,
      rawFoodId,
    );
    if (availableCount === 0) {
      return "You don't have any food to cook.";
    }

    // Determine actual quantity
    const totalQuantity =
      quantity === -1 || quantity > availableCount ? availableCount : quantity;

    // Get cooking results
    const cookedId = getCookedItemId(rawFoodId);
    const burntId = getBurntItemId(rawFoodId);
    if (!cookedId || !burntId) {
      return "This item cannot be cooked.";
    }

    // Calculate burn chance
    const burnChance = calculateBurnChance(playerLevel, rawFoodId, source.type);
    const xpAmount = getCookingXP(rawFoodId);

    // Create session with cached data
    const session: CookingSession = {
      playerId,
      startTick: currentTick,
      nextCookTick:
        currentTick + PROCESSING_CONSTANTS.SKILL_MECHANICS.cooking.ticksPerItem,
      totalQuantity,
      cookedCount: 0,
      burntCount: 0,
      cachedFoodId: rawFoodId,
      cachedCookedId: cookedId,
      cachedBurntId: burntId,
      cachedSourceId: source.id,
      cachedSourceType: source.type,
      cachedBurnChance: burnChance,
      cachedXpAmount: xpAmount,
      cachedStartPosition: { x: position.x, y: position.y, z: position.z },
    };

    // Add debug info if enabled
    if (DEBUG_PROCESSING) {
      session.debugInfo = {
        skill: "cooking",
        itemType: rawFoodId,
        sourceType: source.type,
      };
      console.log(
        `[Cooking] Session started for ${playerId}: ${rawFoodId} x${totalQuantity}, ` +
          `burnChance=${(burnChance * 100).toFixed(1)}%, source=${source.type}`,
      );
    }

    this.sessions.set(playerId, session);
    return null;
  }

  /**
   * Process tick for all active cooking sessions.
   *
   * @param currentTick - Current game tick
   * @returns Array of results from completed cooking attempts
   */
  processTick(currentTick: number): CookingAttemptResult[] {
    const results: CookingAttemptResult[] = [];
    const toRemove: PlayerID[] = [];

    for (const [playerId, session] of this.sessions) {
      // Check for movement cancellation
      const currentPos = this.callbacks.getPlayerPosition(playerId);
      if (!currentPos) {
        // Player disconnected
        toRemove.push(playerId);
        this.emitSessionComplete(session, "disconnected");
        continue;
      }

      if (this.hasPlayerMoved(session.cachedStartPosition, currentPos)) {
        toRemove.push(playerId);
        this.emitSessionComplete(session, "moved");
        continue;
      }

      // Check if cooking source is still valid
      if (!this.callbacks.isCookingSourceValid(session.cachedSourceId)) {
        toRemove.push(playerId);
        this.emitSessionComplete(session, "cancelled");
        continue;
      }

      // Check if it's time for next cook
      if (currentTick < session.nextCookTick) {
        continue;
      }

      // Check if we have food to cook
      const availableCount = this.callbacks.countItemsInInventory(
        playerId,
        session.cachedFoodId,
      );
      if (availableCount === 0) {
        toRemove.push(playerId);
        this.emitSessionComplete(session, "no_food");
        continue;
      }

      // Remove raw food from inventory
      this.callbacks.removeItemFromInventory(playerId, session.cachedFoodId);

      // Roll for burn
      const roll = Math.random();
      const burned = roll < session.cachedBurnChance;

      if (burned) {
        // Item burnt
        session.burntCount++;
        this.callbacks.addItemToInventory(playerId, session.cachedBurntId);
        this.callbacks.onItemBurnt(
          playerId,
          session.cachedFoodId,
          session.cachedBurntId,
        );

        const foodName = session.cachedFoodId
          .replace(/^raw_/, "")
          .replace(/_/g, " ");
        results.push({
          success: true,
          burned: true,
          playerId,
          rawFoodId: session.cachedFoodId,
          resultItemId: session.cachedBurntId,
          xpAwarded: 0,
          message: `You accidentally burn the ${foodName}.`,
          progress: {
            cooked: session.cookedCount,
            burnt: session.burntCount,
            remaining:
              session.totalQuantity - session.cookedCount - session.burntCount,
            total: session.totalQuantity,
          },
        });

        if (DEBUG_PROCESSING) {
          console.log(
            `[Cooking] ${playerId} BURNT ${session.cachedFoodId} ` +
              `(roll=${roll.toFixed(3)} < ${session.cachedBurnChance.toFixed(3)})`,
          );
        }
      } else {
        // Successfully cooked
        session.cookedCount++;
        this.callbacks.addItemToInventory(playerId, session.cachedCookedId);
        this.callbacks.onItemCooked(
          playerId,
          session.cachedFoodId,
          session.cachedCookedId,
          session.cachedXpAmount,
        );

        const foodName = session.cachedCookedId.replace(/_/g, " ");
        results.push({
          success: true,
          burned: false,
          playerId,
          rawFoodId: session.cachedFoodId,
          resultItemId: session.cachedCookedId,
          xpAwarded: session.cachedXpAmount,
          message: `You successfully cook the ${foodName}.`,
          progress: {
            cooked: session.cookedCount,
            burnt: session.burntCount,
            remaining:
              session.totalQuantity - session.cookedCount - session.burntCount,
            total: session.totalQuantity,
          },
        });

        if (DEBUG_PROCESSING) {
          console.log(
            `[Cooking] ${playerId} COOKED ${session.cachedFoodId} → ${session.cachedCookedId} ` +
              `(roll=${roll.toFixed(3)} >= ${session.cachedBurnChance.toFixed(3)})`,
          );
        }
      }

      // Check if session is complete
      const processed = session.cookedCount + session.burntCount;
      if (processed >= session.totalQuantity) {
        toRemove.push(playerId);
        this.emitSessionComplete(session, "completed");
      } else {
        // Schedule next cook
        session.nextCookTick =
          currentTick +
          PROCESSING_CONSTANTS.SKILL_MECHANICS.cooking.ticksPerItem;
      }
    }

    // Clean up completed/cancelled sessions
    for (const playerId of toRemove) {
      this.sessions.delete(playerId);
    }

    return results;
  }

  /**
   * Cancel a cooking session.
   *
   * @param playerId - Player whose session to cancel
   * @param reason - Reason for cancellation
   */
  cancelSession(playerId: PlayerID, reason: string): void {
    const session = this.sessions.get(playerId);
    if (session) {
      this.sessions.delete(playerId);
      this.emitSessionComplete(
        session,
        reason as CookingSessionComplete["reason"],
      );

      if (DEBUG_PROCESSING) {
        console.log(`[Cooking] Session cancelled for ${playerId}: ${reason}`);
      }
    }
  }

  /**
   * Check if player has an active cooking session.
   */
  hasActiveSession(playerId: PlayerID): boolean {
    return this.sessions.has(playerId);
  }

  /**
   * Get session info for a player (for debugging/UI).
   */
  getSession(playerId: PlayerID): CookingSession | null {
    return this.sessions.get(playerId) ?? null;
  }

  /**
   * Get count of active sessions.
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clear all sessions (for testing/reset).
   */
  clearAllSessions(): void {
    this.sessions.clear();
    this.rateLimits.clear();
  }

  /**
   * Emit session complete callback.
   */
  private emitSessionComplete(
    session: CookingSession,
    reason: CookingSessionComplete["reason"],
  ): void {
    this.callbacks.onSessionComplete({
      playerId: session.playerId,
      rawFoodId: session.cachedFoodId,
      totalCooked: session.cookedCount,
      totalBurnt: session.burntCount,
      totalXp: session.cookedCount * session.cachedXpAmount,
      reason,
    });
  }

  /**
   * Check if player has moved from start position.
   */
  private hasPlayerMoved(
    startPos: { x: number; y: number; z: number },
    currentPos: { x: number; y: number; z: number },
  ): boolean {
    const dx = Math.abs(currentPos.x - startPos.x);
    const dy = Math.abs(currentPos.y - startPos.y);
    const dz = Math.abs(currentPos.z - startPos.z);
    return (
      dx > MOVEMENT_THRESHOLD ||
      dy > MOVEMENT_THRESHOLD ||
      dz > MOVEMENT_THRESHOLD
    );
  }
}
