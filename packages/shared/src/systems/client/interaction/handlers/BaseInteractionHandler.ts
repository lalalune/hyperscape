/**
 * BaseInteractionHandler
 *
 * Abstract base class for all interaction handlers.
 *
 * Provides common functionality:
 * - Queue-based interaction pattern (walk-then-act)
 * - Walk-if-needed logic
 * - Network send abstraction
 * - Examine action (common to all entities)
 * - Chat message utilities
 *
 * Each entity type (Item, NPC, Mob, etc.) extends this class
 * and implements its specific interaction logic.
 */

import type { World } from "../../../../core/World";
import type { ActionQueueService } from "../services/ActionQueueService";
import type { RaycastTarget, ContextMenuAction } from "../types";
import type { Position3D } from "../../../../types/core/base-types";
import {
  worldToTile,
  tileToWorld,
  tilesWithinRange,
  TILE_SIZE,
  type TileCoord,
} from "../../../shared/movement/TileSystem";
import { ACTION_QUEUE } from "../constants";
import { EventType } from "../../../../types/events/event-types";
import { uuid } from "../../../../utils";

/**
 * Parameters for queueing an interaction
 */
export interface QueueInteractionParams {
  /** The raycast target */
  target: RaycastTarget;
  /** Unique action ID for tracking */
  actionId: string;
  /** Required range in tiles */
  range: number;
  /** Callback when player reaches range */
  onExecute: () => void;
  /** Optional callback if action is cancelled */
  onCancel?: () => void;
}

export abstract class BaseInteractionHandler {
  constructor(
    protected world: World,
    protected actionQueue: ActionQueueService,
  ) {}

  /**
   * Handle left-click on entity (primary action)
   *
   * Implemented by each handler based on entity type.
   * Should determine the primary action and execute it.
   */
  abstract onLeftClick(target: RaycastTarget): void;

  /**
   * Get context menu actions for right-click
   *
   * Returns array of actions sorted by priority (lower = higher in menu).
   * Each handler provides its specific actions.
   */
  abstract getContextMenuActions(target: RaycastTarget): ContextMenuAction[];

  /**
   * Get required range for a specific action
   *
   * Used by action queue for distance checking.
   */
  abstract getActionRange(actionId: string): number;

  /**
   * Queue an interaction with automatic walk-if-needed
   *
   * This is the CORE PATTERN that replaces setTimeout.
   * Used by all handlers for consistent behavior.
   *
   * If player is in range: executes immediately
   * If player is out of range: queues action, sends walk request
   *
   * Detection strategy (hybrid):
   * - Range 0 (items): Event-based via ENTITY_MODIFIED "idle" with server position
   * - Range 1+ (combat): Frame-based polling to track moving targets
   */
  protected queueInteraction(params: QueueInteractionParams): void {
    const player = this.world.getPlayer();
    if (!player) {
      console.warn(
        "[BaseInteractionHandler] queueInteraction: No player found",
      );
      return;
    }

    const playerPos = player.position;
    const targetTile = worldToTile(
      params.target.position.x,
      params.target.position.z,
    );

    // Check if already in range
    // NOTE: For range 0, this uses interpolated position which may be slightly
    // inaccurate. If queued, ActionQueueService.onPlayerIdle() will use
    // server-authoritative position for accurate detection.
    let inRange: boolean;

    if (params.range === 0) {
      // Range 0 (items): Use world-space distance with tolerance
      const dx = Math.abs(playerPos.x - params.target.position.x);
      const dz = Math.abs(playerPos.z - params.target.position.z);
      const worldDist = Math.max(dx, dz);
      const tolerance = TILE_SIZE * ACTION_QUEUE.ITEM_PICKUP_TOLERANCE_TILES;
      inRange = worldDist < tolerance;
    } else {
      // Range 1+ (combat): Use tile-based range check
      const playerTile = worldToTile(playerPos.x, playerPos.z);
      inRange = tilesWithinRange(playerTile, targetTile, params.range);
    }

    if (inRange) {
      // Already in range - execute immediately
      params.onExecute();
    } else {
      // Queue action for execution when player reaches range
      // Detection will be handled by:
      // - Range 0: ActionQueueService.onPlayerIdle() with server position
      // - Range 1+: ActionQueueService.update() frame polling
      this.actionQueue.queueAction({
        targetId: params.target.entityId,
        targetPosition: params.target.position,
        requiredRange: params.range,
        onExecute: params.onExecute,
        onCancel: params.onCancel,
      });

      // Calculate walk destination based on required range
      let walkTarget: Position3D;

      if (params.range === 0) {
        // Range 0 (items): Walk directly TO the target's tile
        // OSRS behavior: Must stand ON item to pick it up
        const targetTileWorld = tileToWorld(targetTile);
        walkTarget = {
          x: targetTileWorld.x,
          y: params.target.position.y,
          z: targetTileWorld.z,
        };
      } else {
        // Range 1+ (combat/resources): Walk to ADJACENT tile
        // OSRS behavior: Can't attack from same tile as target
        walkTarget = this.getAdjacentCombatPosition(
          player.position,
          params.target.position,
          params.range,
        );
      }

      this.sendWalkRequest(walkTarget);
    }
  }

  /**
   * Calculate the best adjacent tile for combat (OSRS-style)
   *
   * Finds a tile that is:
   * 1. Within combat range of the target (but not same tile)
   * 2. Closest to the player's current position
   */
  private getAdjacentCombatPosition(
    playerPos: Position3D,
    targetPos: Position3D,
    range: number = 1,
  ): Position3D {
    const playerTile = worldToTile(playerPos.x, playerPos.z);
    const targetTile = worldToTile(targetPos.x, targetPos.z);
    const effectiveRange = Math.max(1, Math.floor(range));

    // If already within combat range (but not same tile), stay where we are
    if (tilesWithinRange(playerTile, targetTile, effectiveRange)) {
      return playerPos;
    }

    // Generate all valid combat positions around the target
    const validCombatTiles: Array<{
      tile: TileCoord;
      distToTarget: number;
      distToPlayer: number;
    }> = [];

    // Check all tiles in a square around the target up to the combat range
    for (let dx = -effectiveRange; dx <= effectiveRange; dx++) {
      for (let dz = -effectiveRange; dz <= effectiveRange; dz++) {
        const candidateTile: TileCoord = {
          x: targetTile.x + dx,
          z: targetTile.z + dz,
        };

        // Distance from candidate to target (Chebyshev)
        const distToTarget = Math.max(Math.abs(dx), Math.abs(dz));

        // Must be within range AND not on same tile (distance 1 to effectiveRange)
        if (distToTarget >= 1 && distToTarget <= effectiveRange) {
          // Distance from player to this candidate tile
          const playerDx = candidateTile.x - playerTile.x;
          const playerDz = candidateTile.z - playerTile.z;
          const distToPlayer = Math.max(Math.abs(playerDx), Math.abs(playerDz));

          validCombatTiles.push({
            tile: candidateTile,
            distToTarget,
            distToPlayer,
          });
        }
      }
    }

    if (validCombatTiles.length === 0) {
      // Fallback: return a position one tile south of target
      const fallbackWorld = tileToWorld({
        x: targetTile.x,
        z: targetTile.z + 1,
      });
      return { x: fallbackWorld.x, y: targetPos.y, z: fallbackWorld.z };
    }

    // Sort by closest to player (minimize walking)
    validCombatTiles.sort((a, b) => a.distToPlayer - b.distToPlayer);

    const bestTile = validCombatTiles[0].tile;
    const worldPos = tileToWorld(bestTile);
    return { x: worldPos.x, y: targetPos.y, z: worldPos.z };
  }

  /**
   * Send walk request to server
   */
  protected sendWalkRequest(position: Position3D): void {
    if (this.world.network?.send) {
      this.world.network.send("moveRequest", {
        target: [position.x, position.y ?? 0, position.z],
        runMode: true,
        cancel: false,
      });
    }
  }

  /**
   * Send network message
   */
  protected send(type: string, data: unknown): void {
    if (this.world.network?.send) {
      this.world.network.send(type, data);
    }
  }

  /**
   * Show examine message (common to all entities)
   *
   * Displays as toast and adds to chat log (OSRS-style).
   */
  protected showExamineMessage(message: string): void {
    // Show toast notification
    this.world.emit(EventType.UI_TOAST, {
      message,
      type: "info",
    });

    // Add to chat (OSRS-style game message with no sender)
    this.addChatMessage(message);
  }

  /**
   * Add a game message to chat (no sender prefix)
   */
  protected addChatMessage(message: string): void {
    if (this.world.chat?.add) {
      this.world.chat.add({
        id: uuid(),
        from: "", // Empty = no [username] prefix, just game text
        body: message,
        createdAt: new Date().toISOString(),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Create examine action (added to all context menus)
   */
  protected createExamineAction(
    _target: RaycastTarget,
    examineText: string,
  ): ContextMenuAction {
    return {
      id: "examine",
      label: "Examine",
      icon: "👁️",
      enabled: true,
      priority: 100, // Low priority = bottom of menu
      handler: () => this.showExamineMessage(examineText),
    };
  }

  /**
   * Create "Walk here" action (added to most context menus)
   */
  protected createWalkHereAction(target: RaycastTarget): ContextMenuAction {
    return {
      id: "walk_here",
      label: "Walk here",
      icon: "👟",
      enabled: true,
      priority: 99, // Near bottom, above examine
      handler: () => this.sendWalkRequest(target.hitPoint),
    };
  }

  /**
   * Get the local player entity
   */
  protected getPlayer() {
    return this.world.getPlayer();
  }
}
