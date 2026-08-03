/**
 * Pending Firemaking Manager
 *
 * Server-authoritative firemaking request handler.
 * Queues client requests and validates them on the next tick.
 *
 * Flow:
 * 1. Client sends "light fire" request
 * 2. Request is queued (not processed immediately)
 * 3. On next tick, request is validated:
 *    - Player has logs in specified slot
 *    - Player has tinderbox
 *    - Player has required level
 *    - Position is valid for fire placement
 * 4. If valid, creates session in FiremakingSessionManager
 * 5. On success, creates fire and triggers walk-west
 *
 */

import { PROCESSING_CONSTANTS } from "../../../../constants/ProcessingConstants";
import type { PlayerID } from "../../../../types/core/identifiers";
import type { TileCoord } from "../../movement/TileSystem";
import { FireManager } from "./FireManager";
import {
  FiremakingSessionManager,
  type FiremakingCallbacks,
} from "./FiremakingSessionManager";
import { isValidLog, getFiremakingLevelRequired } from "./FiremakingCalculator";
import { DEBUG_PROCESSING } from "./debug";

/**
 * Queued firemaking request.
 */
interface PendingFiremakingRequest {
  playerId: PlayerID;
  logSlot: number;
  logId: string;
  tinderboxSlot: number;
  queuedAtTick: number;
}

/**
 * Callbacks for server integration.
 */
export interface PendingFiremakingCallbacks {
  /** Get player's current world position */
  getPlayerPosition: (
    playerId: PlayerID,
  ) => { x: number; y: number; z: number } | null;

  /** Get player's firemaking level */
  getPlayerLevel: (playerId: PlayerID) => number;

  /** Check if player has item in inventory slot */
  hasItemInSlot: (playerId: PlayerID, slot: number, itemId: string) => boolean;

  /** Remove item from inventory slot */
  removeItemFromSlot: (playerId: PlayerID, slot: number) => boolean;

  /** Check if a tile is walkable (for walk-west) */
  isTileWalkable: (tile: TileCoord) => boolean;

  /** Move player to position (for walk-west after fire) */
  movePlayerToPosition: (
    playerId: PlayerID,
    position: { x: number; y: number; z: number },
  ) => void;

  /** Award XP to player */
  awardXp: (playerId: PlayerID, skill: string, amount: number) => void;

  /** Send message to player */
  sendMessage: (playerId: PlayerID, message: string) => void;

  /** Broadcast fire creation to clients */
  broadcastFireCreated: (
    fireId: string,
    position: { x: number; y: number; z: number },
    playerId: PlayerID,
  ) => void;

  /** Set player's animation/emote */
  setPlayerAnimation: (playerId: PlayerID, animation: string | null) => void;
}

/**
 * Pending Firemaking Manager
 *
 * Server-side manager for firemaking requests.
 * Coordinates FireManager (fire lifecycle) and FiremakingSessionManager (tick processing).
 */
export class PendingFiremakingManager {
  /** Queued requests waiting for next tick */
  private pendingRequests: Map<PlayerID, PendingFiremakingRequest> = new Map();

  /** Rate limiting - last request time per player */
  private rateLimits: Map<PlayerID, number> = new Map();

  /** Fire manager for fire lifecycle */
  private fireManager: FireManager;

  /** Session manager for tick-based processing */
  private sessionManager: FiremakingSessionManager;

  /** Server callbacks */
  private callbacks: PendingFiremakingCallbacks;

  constructor(fireManager: FireManager, callbacks: PendingFiremakingCallbacks) {
    this.fireManager = fireManager;
    this.callbacks = callbacks;

    // Create session manager with callbacks that delegate to our callbacks
    const sessionCallbacks: FiremakingCallbacks = {
      onFireLit: (playerId, logId, xp, position) => {
        this.handleFireLit(playerId, logId, xp, position);
      },
      onAttemptFailed: (playerId, _logId) => {
        // No message on fail (classic MMORPG behavior)
        if (DEBUG_PROCESSING) {
          console.log(`[PendingFiremaking] ${playerId} failed attempt`);
        }
      },
      onSessionCancelled: (playerId, reason) => {
        this.callbacks.setPlayerAnimation(playerId, null);
        if (DEBUG_PROCESSING) {
          console.log(
            `[PendingFiremaking] ${playerId} session cancelled: ${reason}`,
          );
        }
      },
      getPlayerPosition: callbacks.getPlayerPosition,
      getPlayerLevel: callbacks.getPlayerLevel,
      hasItemInSlot: callbacks.hasItemInSlot,
      removeItemFromSlot: callbacks.removeItemFromSlot,
    };

    this.sessionManager = new FiremakingSessionManager(sessionCallbacks);
  }

  /**
   * Queue a firemaking request.
   * Request will be validated and processed on the next tick.
   *
   * @param playerId - Player making the request
   * @param logSlot - Inventory slot containing logs
   * @param logId - Log item ID
   * @param tinderboxSlot - Inventory slot containing tinderbox
   * @param currentTick - Current game tick
   */
  queueFiremaking(
    playerId: PlayerID,
    logSlot: number,
    logId: string,
    tinderboxSlot: number,
    currentTick: number,
  ): void {
    // Rate limiting (anti-spam)
    const now = Date.now();
    const lastRequest = this.rateLimits.get(playerId);
    if (lastRequest && now - lastRequest < PROCESSING_CONSTANTS.RATE_LIMIT_MS) {
      return; // Silently drop
    }
    this.rateLimits.set(playerId, now);

    // Basic validation before queuing
    if (!isValidLog(logId)) {
      this.callbacks.sendMessage(playerId, "You can't light that.");
      return;
    }

    // Queue the request
    this.pendingRequests.set(playerId, {
      playerId,
      logSlot,
      logId,
      tinderboxSlot,
      queuedAtTick: currentTick,
    });

    if (DEBUG_PROCESSING) {
      console.log(
        `[PendingFiremaking] Queued request for ${playerId}: ${logId}`,
      );
    }
  }

  /**
   * Process tick - validate pending requests and process active sessions.
   *
   * @param currentTick - Current game tick
   */
  processTick(currentTick: number): void {
    // Process pending requests first
    this.processPendingRequests(currentTick);

    // Then process active sessions
    this.sessionManager.processTick(currentTick);

    // Process fire expirations
    const expired = this.fireManager.processTick(currentTick);
    if (expired > 0 && DEBUG_PROCESSING) {
      console.log(`[PendingFiremaking] ${expired} fires expired`);
    }
  }

  /**
   * Process all pending requests.
   */
  private processPendingRequests(currentTick: number): void {
    for (const [playerId, request] of this.pendingRequests) {
      this.pendingRequests.delete(playerId);

      // Validate and start session
      const error = this.validateAndStartSession(request, currentTick);
      if (error) {
        this.callbacks.sendMessage(playerId, error);
      }
    }
  }

  /**
   * Validate request and start firemaking session.
   *
   * @returns Error message if validation fails, null on success
   */
  private validateAndStartSession(
    request: PendingFiremakingRequest,
    currentTick: number,
  ): string | null {
    const { playerId, logSlot, logId, tinderboxSlot } = request;

    // Get player position
    const position = this.callbacks.getPlayerPosition(playerId);
    if (!position) {
      return null; // Player disconnected
    }

    // Check if position already has a fire
    const existingFire = this.fireManager.getFireAtPosition(position);
    if (existingFire) {
      return "You can't light a fire here.";
    }

    // Validate inventory items
    if (!this.callbacks.hasItemInSlot(playerId, logSlot, logId)) {
      return "You don't have any logs.";
    }
    if (!this.callbacks.hasItemInSlot(playerId, tinderboxSlot, "tinderbox")) {
      return "You need a tinderbox to light a fire.";
    }

    // Validate level requirement
    const playerLevel = this.callbacks.getPlayerLevel(playerId);
    const levelRequired = getFiremakingLevelRequired(logId);
    if (playerLevel < levelRequired) {
      return `You need a Firemaking level of ${levelRequired} to burn ${logId.replace(/_/g, " ")}.`;
    }

    // Start session
    const sessionError = this.sessionManager.startSession(
      playerId,
      logSlot,
      logId,
      tinderboxSlot,
      position,
      currentTick,
    );

    if (sessionError) {
      return sessionError;
    }

    // Set firemaking animation
    this.callbacks.setPlayerAnimation(playerId, "firemaking");
    this.callbacks.sendMessage(playerId, "You attempt to light the logs.");

    return null;
  }

  /**
   * Handle successful fire lighting.
   */
  private handleFireLit(
    playerId: PlayerID,
    logId: string,
    xp: number,
    position: { x: number; y: number; z: number },
  ): void {
    // Get current tick (approximated - in real impl this would be passed)
    const currentTick = Math.floor(Date.now() / 600);

    // Create the fire
    const fire = this.fireManager.createFire(playerId, position, currentTick);
    if (!fire) {
      // Fire creation failed (position blocked)
      this.callbacks.sendMessage(playerId, "You can't light a fire here.");
      return;
    }

    // Award XP
    this.callbacks.awardXp(playerId, "firemaking", xp);

    // Send success message
    const logName = logId.replace(/_/g, " ");
    this.callbacks.sendMessage(
      playerId,
      `The fire catches and the ${logName} begin to burn.`,
    );

    // Clear animation
    this.callbacks.setPlayerAnimation(playerId, null);

    // Broadcast fire creation
    this.callbacks.broadcastFireCreated(fire.id, fire.position, playerId);

    // Walk-west behavior
    const postFirePosition = this.fireManager.calculatePostFirePosition(
      position,
      this.callbacks.isTileWalkable,
    );

    if (postFirePosition) {
      this.callbacks.movePlayerToPosition(playerId, postFirePosition);
    }

    if (DEBUG_PROCESSING) {
      console.log(
        `[PendingFiremaking] ${playerId} lit fire at (${position.x.toFixed(1)}, ${position.z.toFixed(1)}), ` +
          `awarded ${xp} XP, walk to ${postFirePosition ? `(${postFirePosition.x.toFixed(1)}, ${postFirePosition.z.toFixed(1)})` : "stayed"}`,
      );
    }
  }

  /**
   * Cancel pending request for a player.
   *
   * @param playerId - Player whose request to cancel
   */
  cancelPending(playerId: PlayerID): void {
    this.pendingRequests.delete(playerId);
    this.sessionManager.cancelSession(playerId, "cancelled");
  }

  /**
   * Check if player has pending request or active session.
   */
  hasActiveFiremaking(playerId: PlayerID): boolean {
    return (
      this.pendingRequests.has(playerId) ||
      this.sessionManager.hasActiveSession(playerId)
    );
  }

  /**
   * Get the fire manager (for external access).
   */
  getFireManager(): FireManager {
    return this.fireManager;
  }

  /**
   * Get the session manager (for external access).
   */
  getSessionManager(): FiremakingSessionManager {
    return this.sessionManager;
  }

  /**
   * Clear all state (for testing/reset).
   */
  clearAll(): void {
    this.pendingRequests.clear();
    this.rateLimits.clear();
    this.sessionManager.clearAllSessions();
    this.fireManager.clearAllFires();
  }
}
