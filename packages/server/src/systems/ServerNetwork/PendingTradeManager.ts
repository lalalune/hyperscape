/**
 * PendingTradeManager
 *
 * Server-authoritative system for tracking players walking toward other players to trade.
 * When a player requests a trade with someone out of range, they walk up first.
 *
 * Behavior:
 * 1. Player clicks another player to trade
 * 2. If not in range, server queues "pending trade" and moves player toward target
 * 3. Every tick, server re-checks range and re-paths if target moved
 * 4. When in range, server sends the trade request
 * 5. New click or disconnect cancels pending trade
 */

import type { World, TileCoord } from "@hyperforge/shared";
import { worldToTileInto, tilesWithinMeleeRange } from "@hyperforge/shared";
import type { TileMovementManager } from "./tile-movement";

/** Trade interaction range in tiles (1 = adjacent, like talking to NPCs) */
const TRADE_INTERACTION_RANGE = 1;

interface PendingTrade {
  playerId: string;
  targetId: string;
  /** Last tile we pathed toward (to detect when target moves) */
  lastTargetTile: { x: number; z: number } | null;
  /** Callback to execute when in range */
  onInRange: () => void;
}

export class PendingTradeManager {
  /** Map of playerId -> pending trade data */
  private pendingTrades = new Map<string, PendingTrade>();

  // Pre-allocated buffers for zero-allocation hot path
  private readonly _playerTile: TileCoord = { x: 0, z: 0 };
  private readonly _targetTile: TileCoord = { x: 0, z: 0 };

  constructor(
    private world: World,
    private tileMovementManager: TileMovementManager,
  ) {}

  /**
   * Queue a pending trade request
   * Called when player requests trade but is not in range
   *
   * @param playerId - The player initiating the trade
   * @param targetId - The target player to trade with
   * @param onInRange - Callback to execute when player reaches target
   */
  queuePendingTrade(
    playerId: string,
    targetId: string,
    onInRange: () => void,
  ): void {
    // Cancel any existing pending trade
    this.cancelPendingTrade(playerId);

    const targetPos = this.getTargetPosition(targetId);
    if (!targetPos) {
      return;
    }

    // Check if already in range - if so, execute immediately
    const playerEntity = this.world.entities.get(playerId);
    if (playerEntity?.position) {
      worldToTileInto(
        playerEntity.position.x,
        playerEntity.position.z,
        this._playerTile,
      );
      worldToTileInto(targetPos.x, targetPos.z, this._targetTile);

      if (
        tilesWithinMeleeRange(
          this._playerTile,
          this._targetTile,
          TRADE_INTERACTION_RANGE,
        )
      ) {
        // Already in range - execute immediately
        onInRange();
        return;
      }
    }

    this.pendingTrades.set(playerId, {
      playerId,
      targetId,
      lastTargetTile: { x: this._targetTile.x, z: this._targetTile.z },
      onInRange,
    });

    // Start moving toward target
    this.tileMovementManager.movePlayerToward(
      playerId,
      targetPos,
      true, // running
      TRADE_INTERACTION_RANGE,
    );
  }

  /**
   * Get target player position
   */
  private getTargetPosition(
    targetId: string,
  ): { x: number; y: number; z: number } | null {
    const player = this.world.entities.players?.get(targetId);
    if (player?.position) {
      return player.position;
    }
    return null;
  }

  /**
   * Cancel pending trade for a player
   * Called when player clicks elsewhere, disconnects, or trade is sent
   */
  cancelPendingTrade(playerId: string): void {
    this.pendingTrades.delete(playerId);
  }

  /**
   * Check if player has a pending trade
   */
  hasPendingTrade(playerId: string): boolean {
    return this.pendingTrades.has(playerId);
  }

  /**
   * Process all pending trades - called every tick
   */
  processTick(): void {
    for (const [playerId, pending] of this.pendingTrades) {
      // Check if target still exists (connected)
      const targetEntity = this.world.entities.players?.get(pending.targetId);
      if (!targetEntity) {
        this.pendingTrades.delete(playerId);
        continue;
      }

      // Check if initiator still exists
      const playerEntity = this.world.entities.get(playerId);
      if (!playerEntity) {
        this.pendingTrades.delete(playerId);
        continue;
      }

      const targetPos = targetEntity.position;
      if (!targetPos) {
        this.pendingTrades.delete(playerId);
        continue;
      }

      const playerPos = playerEntity.position;
      worldToTileInto(playerPos.x, playerPos.z, this._playerTile);
      worldToTileInto(targetPos.x, targetPos.z, this._targetTile);

      // Check if in range
      if (
        tilesWithinMeleeRange(
          this._playerTile,
          this._targetTile,
          TRADE_INTERACTION_RANGE,
        )
      ) {
        // In range! Send the trade request
        pending.onInRange();
        this.pendingTrades.delete(playerId);
        continue;
      }

      // Not in range - check if target moved and re-path if needed
      if (
        !pending.lastTargetTile ||
        pending.lastTargetTile.x !== this._targetTile.x ||
        pending.lastTargetTile.z !== this._targetTile.z
      ) {
        // Target moved - re-path
        this.tileMovementManager.movePlayerToward(
          playerId,
          targetPos,
          true,
          TRADE_INTERACTION_RANGE,
        );
        if (!pending.lastTargetTile) {
          pending.lastTargetTile = { x: 0, z: 0 };
        }
        pending.lastTargetTile.x = this._targetTile.x;
        pending.lastTargetTile.z = this._targetTile.z;
      }
    }
  }

  /**
   * Clean up on player disconnect
   */
  onPlayerDisconnect(playerId: string): void {
    // Remove this player's pending trade
    this.pendingTrades.delete(playerId);

    // Also cancel any trades targeting this player
    for (const [initiatorId, pending] of this.pendingTrades) {
      if (pending.targetId === playerId) {
        this.pendingTrades.delete(initiatorId);
      }
    }
  }

  /**
   * Get count of pending trades (for debugging)
   */
  get size(): number {
    return this.pendingTrades.size;
  }

  /**
   * Clear all pending trades (for shutdown)
   */
  destroy(): void {
    this.pendingTrades.clear();
  }
}
