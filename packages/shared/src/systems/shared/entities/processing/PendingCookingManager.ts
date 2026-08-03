/**
 * Pending Cooking Manager
 *
 * Server-authoritative cooking request handler.
 * Queues client requests and validates them on the next tick.
 *
 * Flow:
 * 1. Client sends "cook food" request
 * 2. Request is queued (not processed immediately)
 * 3. On next tick, request is validated:
 *    - Player has raw food in inventory
 *    - Player has required level
 *    - Cooking source is valid and in range
 * 4. If valid, creates session in CookingSessionManager
 * 5. Session processes cooking with burn chance
 *
 */

import { PROCESSING_CONSTANTS } from "../../../../constants/ProcessingConstants";
import type { PlayerID } from "../../../../types/core/identifiers";
import type { CookingSource } from "./types";
import { FireManager } from "./FireManager";
import {
  CookingSessionManager,
  type CookingCallbacks,
  type CookingSessionComplete,
} from "./CookingSessionManager";
import { isValidRawFood, getCookingLevelRequired } from "./CookingCalculator";
import { DEBUG_PROCESSING } from "./debug";

/**
 * Queued cooking request.
 */
interface PendingCookingRequest {
  playerId: PlayerID;
  rawFoodId: string;
  cookingSourceId: string;
  cookingSourceType: "fire" | "range";
  quantity: number; // -1 for "cook all"
  queuedAtTick: number;
}

/**
 * Callbacks for server integration.
 */
export interface PendingCookingCallbacks {
  /** Get player's current world position */
  getPlayerPosition: (
    playerId: PlayerID,
  ) => { x: number; y: number; z: number } | null;

  /** Get player's cooking level */
  getPlayerLevel: (playerId: PlayerID) => number;

  /** Count items of type in player's inventory */
  countItemsInInventory: (playerId: PlayerID, itemId: string) => number;

  /** Remove item from inventory (returns slot, or -1 if not found) */
  removeItemFromInventory: (playerId: PlayerID, itemId: string) => number;

  /** Add item to player's inventory */
  addItemToInventory: (playerId: PlayerID, itemId: string) => boolean;

  /** Award XP to player */
  awardXp: (playerId: PlayerID, skill: string, amount: number) => void;

  /** Send message to player */
  sendMessage: (playerId: PlayerID, message: string) => void;

  /** Set player's animation/emote */
  setPlayerAnimation: (playerId: PlayerID, animation: string | null) => void;

  /** Get range entity by ID (for static ranges) */
  getRangeById: (
    rangeId: string,
  ) => { position: { x: number; y: number; z: number } } | null;
}

/**
 * Pending Cooking Manager
 *
 * Server-side manager for cooking requests.
 * Coordinates FireManager (for fire-based cooking) and CookingSessionManager.
 */
export class PendingCookingManager {
  /** Queued requests waiting for next tick */
  private pendingRequests: Map<PlayerID, PendingCookingRequest> = new Map();

  /** Rate limiting - last request time per player */
  private rateLimits: Map<PlayerID, number> = new Map();

  /** Fire manager for fire validation */
  private fireManager: FireManager;

  /** Session manager for tick-based processing */
  private sessionManager: CookingSessionManager;

  /** Server callbacks */
  private callbacks: PendingCookingCallbacks;

  constructor(fireManager: FireManager, callbacks: PendingCookingCallbacks) {
    this.fireManager = fireManager;
    this.callbacks = callbacks;

    // Create session manager with callbacks
    const sessionCallbacks: CookingCallbacks = {
      onItemCooked: (playerId, _rawFoodId, cookedId, xp) => {
        this.callbacks.awardXp(playerId, "cooking", xp);
        const foodName = cookedId.replace(/_/g, " ");
        this.callbacks.sendMessage(
          playerId,
          `You successfully cook the ${foodName}.`,
        );
      },
      onItemBurnt: (playerId, rawFoodId, _burntId) => {
        const foodName = rawFoodId.replace(/^raw_/, "").replace(/_/g, " ");
        this.callbacks.sendMessage(
          playerId,
          `You accidentally burn the ${foodName}.`,
        );
      },
      onSessionComplete: (result: CookingSessionComplete) => {
        this.handleSessionComplete(result);
      },
      getPlayerPosition: callbacks.getPlayerPosition,
      getPlayerLevel: callbacks.getPlayerLevel,
      countItemsInInventory: callbacks.countItemsInInventory,
      removeItemFromInventory: callbacks.removeItemFromInventory,
      addItemToInventory: callbacks.addItemToInventory,
      isCookingSourceValid: (sourceId: string) => {
        return this.isCookingSourceValid(sourceId);
      },
    };

    this.sessionManager = new CookingSessionManager(sessionCallbacks);
  }

  /**
   * Queue a cooking request.
   * Request will be validated and processed on the next tick.
   *
   * @param playerId - Player making the request
   * @param rawFoodId - Raw food item ID
   * @param cookingSourceId - Fire or range ID
   * @param cookingSourceType - "fire" or "range"
   * @param quantity - Number to cook (-1 for all)
   * @param currentTick - Current game tick
   */
  queueCooking(
    playerId: PlayerID,
    rawFoodId: string,
    cookingSourceId: string,
    cookingSourceType: "fire" | "range",
    quantity: number,
    currentTick: number,
  ): void {
    // Rate limiting
    const now = Date.now();
    const lastRequest = this.rateLimits.get(playerId);
    if (lastRequest && now - lastRequest < PROCESSING_CONSTANTS.RATE_LIMIT_MS) {
      return; // Silently drop
    }
    this.rateLimits.set(playerId, now);

    // Basic validation before queuing
    if (!isValidRawFood(rawFoodId)) {
      this.callbacks.sendMessage(playerId, "You can't cook that.");
      return;
    }

    // Queue the request
    this.pendingRequests.set(playerId, {
      playerId,
      rawFoodId,
      cookingSourceId,
      cookingSourceType,
      quantity,
      queuedAtTick: currentTick,
    });

    if (DEBUG_PROCESSING) {
      console.log(
        `[PendingCooking] Queued request for ${playerId}: ${rawFoodId} x${quantity} on ${cookingSourceType}`,
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
   * Validate request and start cooking session.
   *
   * @returns Error message if validation fails, null on success
   */
  private validateAndStartSession(
    request: PendingCookingRequest,
    currentTick: number,
  ): string | null {
    const {
      playerId,
      rawFoodId,
      cookingSourceId,
      cookingSourceType,
      quantity,
    } = request;

    // Get player position
    const position = this.callbacks.getPlayerPosition(playerId);
    if (!position) {
      return null; // Player disconnected
    }

    // Validate cooking source exists and is in range
    const sourceValidation = this.validateCookingSource(
      cookingSourceId,
      cookingSourceType,
      position,
    );
    if (sourceValidation.error) {
      return sourceValidation.error;
    }

    // Validate player has raw food
    const foodCount = this.callbacks.countItemsInInventory(playerId, rawFoodId);
    if (foodCount === 0) {
      return "You don't have any food to cook.";
    }

    // Validate level requirement
    const playerLevel = this.callbacks.getPlayerLevel(playerId);
    const levelRequired = getCookingLevelRequired(rawFoodId);
    if (playerLevel < levelRequired) {
      const foodName = rawFoodId.replace(/^raw_/, "").replace(/_/g, " ");
      return `You need a Cooking level of ${levelRequired} to cook ${foodName}.`;
    }

    // Create cooking source object
    const source: CookingSource = {
      id: cookingSourceId,
      type: cookingSourceType,
      position: sourceValidation.position!,
      tile: {
        x: Math.floor(sourceValidation.position!.x),
        z: Math.floor(sourceValidation.position!.z),
      },
    };

    // Start session
    const sessionError = this.sessionManager.startSession(
      playerId,
      rawFoodId,
      source,
      quantity,
      position,
      currentTick,
    );

    if (sessionError) {
      return sessionError;
    }

    // Set cooking animation
    this.callbacks.setPlayerAnimation(playerId, "cooking");

    const foodName = rawFoodId.replace(/^raw_/, "").replace(/_/g, " ");
    const actualQuantity =
      quantity === -1 ? foodCount : Math.min(quantity, foodCount);
    if (actualQuantity > 1) {
      this.callbacks.sendMessage(
        playerId,
        `You cook the ${foodName}. (${actualQuantity} remaining)`,
      );
    } else {
      this.callbacks.sendMessage(playerId, `You cook the ${foodName}.`);
    }

    return null;
  }

  /**
   * Validate cooking source exists and is in range.
   */
  private validateCookingSource(
    sourceId: string,
    sourceType: "fire" | "range",
    playerPosition: { x: number; y: number; z: number },
  ): {
    error: string | null;
    position: { x: number; y: number; z: number } | null;
  } {
    let sourcePosition: { x: number; y: number; z: number } | null = null;

    if (sourceType === "fire") {
      const fire = this.fireManager.getFireById(sourceId);
      if (!fire || !fire.isActive) {
        return { error: "The fire has gone out.", position: null };
      }
      sourcePosition = fire.position;
    } else {
      // Range - check with callback
      const range = this.callbacks.getRangeById(sourceId);
      if (!range) {
        return { error: "You can't cook on that.", position: null };
      }
      sourcePosition = range.position;
    }

    // Check proximity (within interaction range)
    const dx = Math.abs(playerPosition.x - sourcePosition.x);
    const dz = Math.abs(playerPosition.z - sourcePosition.z);
    const distance = Math.max(dx, dz); // Chebyshev distance

    if (distance > PROCESSING_CONSTANTS.FIRE.interactionRange) {
      return { error: "You need to be closer to cook.", position: null };
    }

    return { error: null, position: sourcePosition };
  }

  /**
   * Check if a cooking source is still valid.
   */
  private isCookingSourceValid(sourceId: string): boolean {
    // Check if it's a fire
    const fire = this.fireManager.getFireById(sourceId);
    if (fire) {
      return fire.isActive;
    }

    // Check if it's a range
    const range = this.callbacks.getRangeById(sourceId);
    return range !== null;
  }

  /**
   * Handle session completion.
   */
  private handleSessionComplete(result: CookingSessionComplete): void {
    const { playerId, totalCooked, totalBurnt, reason } = result;

    // Clear animation
    this.callbacks.setPlayerAnimation(playerId, null);

    // Send summary message
    if (reason === "completed" && totalCooked + totalBurnt > 1) {
      this.callbacks.sendMessage(
        playerId,
        `You finish cooking. Cooked: ${totalCooked}, Burnt: ${totalBurnt}`,
      );
    } else if (reason === "no_food") {
      this.callbacks.sendMessage(playerId, "You have run out of food to cook.");
    } else if (reason === "moved") {
      // No message - classic MMORPG doesn't show a message for moving
    }

    if (DEBUG_PROCESSING) {
      console.log(
        `[PendingCooking] ${playerId} session complete: ${reason}, ` +
          `cooked=${totalCooked}, burnt=${totalBurnt}`,
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
  hasActiveCooking(playerId: PlayerID): boolean {
    return (
      this.pendingRequests.has(playerId) ||
      this.sessionManager.hasActiveSession(playerId)
    );
  }

  /**
   * Get the session manager (for external access).
   */
  getSessionManager(): CookingSessionManager {
    return this.sessionManager;
  }

  /**
   * Clear all state (for testing/reset).
   */
  clearAll(): void {
    this.pendingRequests.clear();
    this.rateLimits.clear();
    this.sessionManager.clearAllSessions();
  }
}
