/**
 * ActionQueueService
 *
 * Hybrid action queue using event-based AND frame-based detection.
 *
 * OSRS-Style Pattern:
 * 1. Player clicks entity far away
 * 2. Action queued with target position and required range
 * 3. Walk request sent to server
 * 4. Detection depends on action type:
 *    - Range 0 (items): EVENT-BASED - wait for ENTITY_MODIFIED "idle" event
 *    - Range 1+ (combat): FRAME-BASED - poll each frame for moving targets
 * 5. When in range, execute action
 * 6. If target moves/despawns, update or cancel
 *
 * WHY HYBRID APPROACH:
 * - Range 0 (items): Player must stand ON the item's tile. The server sends
 *   authoritative position in ENTITY_MODIFIED events when movement completes.
 *   Using event-based detection with server position is 100% accurate.
 *
 * - Range 1+ (combat): Mobs can move while player walks toward them.
 *   Frame-based polling allows us to track the moving target and recalculate
 *   the walk path if needed. Event-based alone would miss mob movement.
 *
 * This matches how OSRS handles interactions - items are picked up on
 * arrival at the tile, while combat continuously tracks moving targets.
 */

import type { World } from "../../../../core/World";
import type { QueuedAction, QueueActionParams } from "../types";
import type { Position3D } from "../../../../types/core/base-types";
import {
  worldToTile,
  tilesWithinRange,
  TILE_SIZE,
} from "../../../shared/movement/TileSystem";
import { ACTION_QUEUE } from "../constants";
import { uuid } from "../../../../utils";

export class ActionQueueService {
  /** Current queued action (only one at a time per player) */
  private currentAction: QueuedAction | null = null;

  /** Debounce tracking: key -> timestamp */
  private debounceMap = new Map<string, number>();

  /** Frame counter (incremented each update) */
  private frameCount = 0;

  constructor(private world: World) {}

  /**
   * Queue an action to execute when player reaches range
   *
   * Replaces any existing queued action (OSRS-style: new click cancels old action).
   *
   * @returns The action ID for tracking
   */
  queueAction(params: QueueActionParams): string {
    // Cancel any existing action
    this.cancelCurrentAction();

    const action: QueuedAction = {
      id: uuid(),
      targetId: params.targetId,
      targetPosition: { ...params.targetPosition },
      requiredRange: params.requiredRange,
      onExecute: params.onExecute,
      onCancel: params.onCancel,
      queuedAtFrame: this.frameCount,
      maxWaitFrames:
        params.maxWaitFrames ?? ACTION_QUEUE.DEFAULT_TIMEOUT_FRAMES,
    };

    this.currentAction = action;
    return action.id;
  }

  /**
   * Check if an interaction type is debounced
   *
   * Use for preventing duplicate requests (e.g., rapid clicking).
   * Automatically records the current time if not debounced.
   *
   * @param key - Unique key for this interaction (e.g., "attack:mob_123")
   * @param debounceMs - Minimum time between requests in milliseconds
   * @returns true if the action should be skipped (still in debounce window)
   */
  isDebounced(key: string, debounceMs: number): boolean {
    const now = Date.now();
    const lastTime = this.debounceMap.get(key);

    if (lastTime && now - lastTime < debounceMs) {
      return true;
    }

    this.debounceMap.set(key, now);
    return false;
  }

  /**
   * Clear debounce for a specific key
   *
   * Use when target dies or action is explicitly cancelled.
   */
  clearDebounce(key: string): void {
    this.debounceMap.delete(key);
  }

  /**
   * Cancel the current queued action
   *
   * Calls onCancel callback if provided.
   */
  cancelCurrentAction(): void {
    if (this.currentAction) {
      try {
        this.currentAction.onCancel?.();
      } catch (error) {
        console.error(
          `[ActionQueue] onCancel error for ${this.currentAction.id}:`,
          error,
        );
      }
      this.currentAction = null;
    }
  }

  /**
   * Handle player becoming idle (movement completed)
   *
   * Called by InteractionRouter when ENTITY_MODIFIED "idle" event fires.
   * Uses server-authoritative position for accurate range checking.
   *
   * This is the PRIMARY detection method for range 0 (item pickup) actions.
   * Range 1+ actions are also checked here as a backup, but primarily use
   * frame-based polling in update() to track moving targets.
   *
   * @param serverPosition - The server-authoritative position from changes.p
   */
  onPlayerIdle(serverPosition: Position3D): void {
    if (!this.currentAction) return;

    const action = this.currentAction;

    // Check if target still exists
    // IMPORTANT: This is checked AGAIN in each handler's onExecute() as a safety net,
    // but we check here first to avoid unnecessary range calculations
    const target = this.world.entities.get(action.targetId);
    if (!target) {
      // Target was picked up/destroyed while we were walking
      // Clear silently - this is expected during spam clicking item piles
      this.currentAction = null;
      return;
    }

    // Update target position (may have moved)
    const currentTargetPos = target.getPosition();
    action.targetPosition = currentTargetPos;

    // Check distance using SERVER-AUTHORITATIVE position
    let inRange: boolean;

    if (action.requiredRange === 0) {
      // Range 0 (items): OSRS-accurate tile matching
      // Use world-space distance with tolerance to handle minor position offsets
      const dx = Math.abs(serverPosition.x - action.targetPosition.x);
      const dz = Math.abs(serverPosition.z - action.targetPosition.z);
      const worldDist = Math.max(dx, dz); // Chebyshev distance
      const tolerance = TILE_SIZE * ACTION_QUEUE.ITEM_PICKUP_TOLERANCE_TILES;
      inRange = worldDist < tolerance;
    } else {
      // Range 1+ (combat/resources): Tile-based range check
      const playerTile = worldToTile(serverPosition.x, serverPosition.z);
      const targetTile = worldToTile(
        action.targetPosition.x,
        action.targetPosition.z,
      );
      inRange = tilesWithinRange(playerTile, targetTile, action.requiredRange);
    }

    if (inRange) {
      // In range - execute action
      // Clear BEFORE executing to prevent re-entry from rapid events
      const onExecute = action.onExecute;
      const actionId = action.id;
      this.currentAction = null;
      try {
        onExecute();
      } catch (error) {
        console.error(`[ActionQueue] onExecute error for ${actionId}:`, error);
      }
    }
    // If not in range, action stays queued for future idle events or update() polling
  }

  /**
   * Check if an action is currently queued
   */
  hasQueuedAction(): boolean {
    return this.currentAction !== null;
  }

  /**
   * Get the current queued action's target ID
   */
  getQueuedTargetId(): string | null {
    return this.currentAction?.targetId ?? null;
  }

  /**
   * Get the current queued action (for debugging/testing)
   */
  getCurrentAction(): QueuedAction | null {
    return this.currentAction;
  }

  /**
   * Update - called each frame from the interaction system
   *
   * PRIMARY PURPOSE: Track moving targets (mobs) for range 1+ actions.
   *
   * For range 0 (items): Detection is primarily handled by onPlayerIdle()
   * which uses server-authoritative position. This update() provides a
   * backup check using interpolated position, but may be less reliable.
   *
   * For range 1+ (combat): Frame-based polling is essential because mobs
   * can wander. We need to continuously track their position and detect
   * when the player enters combat range.
   */
  update(): void {
    this.frameCount++;

    // Periodic cleanup of old debounce entries
    if (this.frameCount % ACTION_QUEUE.DEBOUNCE_CLEANUP_INTERVAL === 0) {
      const now = Date.now();
      for (const [key, timestamp] of this.debounceMap.entries()) {
        if (now - timestamp > ACTION_QUEUE.DEBOUNCE_EXPIRY_MS) {
          this.debounceMap.delete(key);
        }
      }
    }

    // Nothing to do if no action queued
    if (!this.currentAction) return;

    const action = this.currentAction;
    const player = this.world.getPlayer();

    if (!player) {
      this.cancelCurrentAction();
      return;
    }

    // Check timeout
    const framesWaited = this.frameCount - action.queuedAtFrame;
    if (framesWaited > action.maxWaitFrames) {
      console.warn(
        `[ActionQueueService] Action ${action.id} timed out after ${framesWaited} frames`,
      );
      this.cancelCurrentAction();
      return;
    }

    // Check if target still exists
    const target = this.world.entities.get(action.targetId);
    if (!target) {
      // Target despawned - cancel action
      this.cancelCurrentAction();
      return;
    }

    // Update target position (in case target moved - e.g., wandering mob)
    const currentTargetPos = target.getPosition();
    action.targetPosition = currentTargetPos;

    // Skip frame-based check for range 0 - handled by onPlayerIdle()
    // Range 0 requires server-authoritative position for accuracy
    if (action.requiredRange === 0) {
      return;
    }

    // Range 1+ (combat/resources): Use tile-based range check
    // player.position is interpolated but acceptable for combat range checks
    const playerPos = player.position;
    const playerTile = worldToTile(playerPos.x, playerPos.z);
    const targetTile = worldToTile(
      action.targetPosition.x,
      action.targetPosition.z,
    );
    const inRange = tilesWithinRange(
      playerTile,
      targetTile,
      action.requiredRange,
    );

    if (inRange) {
      // In range - execute action
      const onExecute = action.onExecute;
      const actionId = action.id;
      this.currentAction = null; // Clear before executing to prevent re-entry
      try {
        onExecute();
      } catch (error) {
        console.error(`[ActionQueue] onExecute error for ${actionId}:`, error);
      }
    }
  }

  /**
   * Destroy - clean up
   */
  destroy(): void {
    this.cancelCurrentAction();
    this.debounceMap.clear();
  }
}
