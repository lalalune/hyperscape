/**
 * Firemaking Session Manager
 *
 * Tick-based firemaking session management.
 * Follows classic tick-based mechanics:
 * - 4-tick roll attempts
 * - Level-based success rate (25.4% at 1, 100% at 43+)
 * - Retry on failure
 * - Movement cancellation
 *
 */

import { PROCESSING_CONSTANTS } from "../../../../constants/ProcessingConstants";
import type { PlayerID } from "../../../../types/core/identifiers";
import type { FiremakingSession } from "./types";
import {
  calculateFiremakingSuccess,
  getFiremakingXP,
  getFiremakingLevelRequired,
  meetsFiremakingLevel,
  isValidLog,
} from "./FiremakingCalculator";
import { DEBUG_PROCESSING } from "./debug";

/**
 * Result of a firemaking attempt.
 */
export interface FiremakingAttemptResult {
  success: boolean;
  playerId: PlayerID;
  logId: string;
  xpAwarded: number;
  fireCreated: boolean;
  message: string;
}

/**
 * Callback for firemaking events.
 */
export interface FiremakingCallbacks {
  /** Called when fire is successfully lit */
  onFireLit: (
    playerId: PlayerID,
    logId: string,
    xp: number,
    position: { x: number; y: number; z: number },
  ) => void;
  /** Called when lighting attempt fails (will retry) */
  onAttemptFailed: (playerId: PlayerID, logId: string) => void;
  /** Called when session is cancelled */
  onSessionCancelled: (playerId: PlayerID, reason: string) => void;
  /** Get player's current position for movement detection */
  getPlayerPosition: (
    playerId: PlayerID,
  ) => { x: number; y: number; z: number } | null;
  /** Get player's firemaking level */
  getPlayerLevel: (playerId: PlayerID) => number;
  /** Check if player has item in inventory slot */
  hasItemInSlot: (playerId: PlayerID, slot: number, itemId: string) => boolean;
  /** Remove item from inventory slot */
  removeItemFromSlot: (playerId: PlayerID, slot: number) => boolean;
}

/**
 * Movement threshold for cancellation (in world units).
 * Small tolerance to account for floating point precision.
 */
const MOVEMENT_THRESHOLD = 0.1;

/**
 * Firemaking Session Manager
 *
 * Manages active firemaking sessions with tick-based processing.
 * One session per player maximum.
 */
export class FiremakingSessionManager {
  /** Active sessions by player ID */
  private sessions: Map<PlayerID, FiremakingSession> = new Map();

  /** Rate limiting - last request time per player */
  private rateLimits: Map<PlayerID, number> = new Map();

  /** Callbacks for game integration */
  private callbacks: FiremakingCallbacks;

  constructor(callbacks: FiremakingCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Start a firemaking session.
   *
   * @param playerId - Player attempting to light fire
   * @param logSlot - Inventory slot containing logs
   * @param logId - Log item ID
   * @param tinderboxSlot - Inventory slot containing tinderbox
   * @param position - Player's current position
   * @param currentTick - Current game tick
   * @returns Error message if validation fails, null on success
   */
  startSession(
    playerId: PlayerID,
    logSlot: number,
    logId: string,
    tinderboxSlot: number,
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

    // Validate log type
    if (!isValidLog(logId)) {
      return `Invalid log type: ${logId}`;
    }

    // Validate level requirement
    const playerLevel = this.callbacks.getPlayerLevel(playerId);
    const levelRequired = getFiremakingLevelRequired(logId);
    if (!meetsFiremakingLevel(playerLevel, logId)) {
      return `You need a Firemaking level of ${levelRequired} to burn ${logId.replace(/_/g, " ")}.`;
    }

    // Validate inventory items
    if (!this.callbacks.hasItemInSlot(playerId, logSlot, logId)) {
      return "You don't have the required logs.";
    }
    if (!this.callbacks.hasItemInSlot(playerId, tinderboxSlot, "tinderbox")) {
      return "You need a tinderbox to light a fire.";
    }

    // Calculate success rate and cache it
    const successRate = calculateFiremakingSuccess(playerLevel);
    const xpAmount = getFiremakingXP(logId);

    // Create session with all cached data
    const session: FiremakingSession = {
      playerId,
      startTick: currentTick,
      nextAttemptTick:
        currentTick +
        PROCESSING_CONSTANTS.SKILL_MECHANICS.firemaking.baseRollTicks,
      attempts: 0,
      cachedLogId: logId,
      cachedLogSlot: logSlot,
      cachedTinderboxSlot: tinderboxSlot,
      cachedSuccessRate: successRate,
      cachedXpAmount: xpAmount,
      cachedStartPosition: { x: position.x, y: position.y, z: position.z },
    };

    // Add debug info if enabled
    if (DEBUG_PROCESSING) {
      session.debugInfo = {
        skill: "firemaking",
        itemType: logId,
      };
      console.log(
        `[Firemaking] Session started for ${playerId}: ${logId}, ` +
          `successRate=${(successRate * 100).toFixed(1)}%, xp=${xpAmount}`,
      );
    }

    this.sessions.set(playerId, session);
    return null;
  }

  /**
   * Process tick for all active firemaking sessions.
   *
   * @param currentTick - Current game tick
   * @returns Array of results from completed attempts
   */
  processTick(currentTick: number): FiremakingAttemptResult[] {
    const results: FiremakingAttemptResult[] = [];
    const toRemove: PlayerID[] = [];

    for (const [playerId, session] of this.sessions) {
      // Check for movement cancellation
      const currentPos = this.callbacks.getPlayerPosition(playerId);
      if (!currentPos) {
        // Player disconnected
        toRemove.push(playerId);
        this.callbacks.onSessionCancelled(playerId, "disconnected");
        continue;
      }

      if (this.hasPlayerMoved(session.cachedStartPosition, currentPos)) {
        toRemove.push(playerId);
        this.callbacks.onSessionCancelled(playerId, "moved");
        continue;
      }

      // Check if it's time for next attempt
      if (currentTick < session.nextAttemptTick) {
        continue;
      }

      // Verify items still exist
      if (
        !this.callbacks.hasItemInSlot(
          playerId,
          session.cachedLogSlot,
          session.cachedLogId,
        )
      ) {
        toRemove.push(playerId);
        this.callbacks.onSessionCancelled(playerId, "no_logs");
        continue;
      }

      // Roll for success
      session.attempts++;
      const roll = Math.random();
      const success = roll < session.cachedSuccessRate;

      if (DEBUG_PROCESSING) {
        console.log(
          `[Firemaking] ${playerId} attempt #${session.attempts}: ` +
            `roll=${roll.toFixed(3)} vs rate=${session.cachedSuccessRate.toFixed(3)} → ${success ? "SUCCESS" : "FAIL"}`,
        );
      }

      if (success) {
        // Remove log from inventory
        this.callbacks.removeItemFromSlot(playerId, session.cachedLogSlot);

        // Fire successfully lit
        results.push({
          success: true,
          playerId,
          logId: session.cachedLogId,
          xpAwarded: session.cachedXpAmount,
          fireCreated: true,
          message: "The fire catches and the logs begin to burn.",
        });

        this.callbacks.onFireLit(
          playerId,
          session.cachedLogId,
          session.cachedXpAmount,
          session.cachedStartPosition,
        );

        // Session complete - fire is lit
        toRemove.push(playerId);
      } else {
        // Failed - retry on next cycle
        session.nextAttemptTick =
          currentTick +
          PROCESSING_CONSTANTS.SKILL_MECHANICS.firemaking.baseRollTicks;

        results.push({
          success: false,
          playerId,
          logId: session.cachedLogId,
          xpAwarded: 0,
          fireCreated: false,
          message: "", // No message on fail (classic MMORPG doesn't show fail messages for firemaking)
        });

        this.callbacks.onAttemptFailed(playerId, session.cachedLogId);
      }
    }

    // Clean up completed/cancelled sessions
    for (const playerId of toRemove) {
      this.sessions.delete(playerId);
    }

    return results;
  }

  /**
   * Cancel a firemaking session.
   *
   * @param playerId - Player whose session to cancel
   * @param reason - Reason for cancellation
   */
  cancelSession(playerId: PlayerID, reason: string): void {
    const session = this.sessions.get(playerId);
    if (session) {
      this.sessions.delete(playerId);
      this.callbacks.onSessionCancelled(playerId, reason);

      if (DEBUG_PROCESSING) {
        console.log(
          `[Firemaking] Session cancelled for ${playerId}: ${reason}`,
        );
      }
    }
  }

  /**
   * Check if player has an active firemaking session.
   */
  hasActiveSession(playerId: PlayerID): boolean {
    return this.sessions.has(playerId);
  }

  /**
   * Get session info for a player (for debugging/UI).
   */
  getSession(playerId: PlayerID): FiremakingSession | null {
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
