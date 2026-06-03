/**
 * PendingDuelChallengeManager
 *
 * Server-authoritative system for tracking players walking toward other players to duel.
 * When a player requests a duel with someone out of range, they walk up first.
 *
 * Behavior:
 * 1. Player clicks another player to challenge
 * 2. If not in range, server queues "pending challenge" and moves player toward target
 * 3. Every tick, server re-checks range and re-paths if target moved
 * 4. When in range, server sends the duel challenge
 * 5. New click or disconnect cancels pending challenge
 */

import type { World, TileCoord } from "@hyperforge/shared";
import { worldToTileInto, tilesWithinMeleeRange } from "@hyperforge/shared";
import type { TileMovementManager } from "./tile-movement";

/** Duel challenge interaction range in tiles (1 = adjacent, like trading) */
const DUEL_CHALLENGE_RANGE = 1;

interface PendingChallenge {
  playerId: string;
  targetId: string;
  /** Last tile we pathed toward (to detect when target moves) */
  lastTargetTile: { x: number; z: number } | null;
  /** Callback to execute when in range */
  onInRange: () => void;
}

export class PendingDuelChallengeManager {
  /** Map of playerId -> pending challenge data */
  private pendingChallenges = new Map<string, PendingChallenge>();

  // Pre-allocated buffers for zero-allocation hot path
  private readonly _playerTile: TileCoord = { x: 0, z: 0 };
  private readonly _targetTile: TileCoord = { x: 0, z: 0 };

  constructor(
    private world: World,
    private tileMovementManager: TileMovementManager,
  ) {}

  /**
   * Queue a pending duel challenge
   * Called when player requests duel but is not in range
   *
   * @param playerId - The player initiating the challenge
   * @param targetId - The target player to challenge
   * @param onInRange - Callback to execute when player reaches target
   */
  queuePendingChallenge(
    playerId: string,
    targetId: string,
    onInRange: () => void,
  ): void {
    // Cancel any existing pending challenge
    this.cancelPendingChallenge(playerId);

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
          DUEL_CHALLENGE_RANGE,
        )
      ) {
        // Already in range - execute immediately
        onInRange();
        return;
      }
    }

    this.pendingChallenges.set(playerId, {
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
      DUEL_CHALLENGE_RANGE,
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
   * Cancel pending challenge for a player
   * Called when player clicks elsewhere, disconnects, or challenge is sent
   */
  cancelPendingChallenge(playerId: string): void {
    this.pendingChallenges.delete(playerId);
  }

  /**
   * Check if player has a pending challenge
   */
  hasPendingChallenge(playerId: string): boolean {
    return this.pendingChallenges.has(playerId);
  }

  /**
   * Process all pending challenges - called every tick
   */
  processTick(): void {
    for (const [playerId, pending] of this.pendingChallenges) {
      // Check if target still exists (connected)
      const targetEntity = this.world.entities.players?.get(pending.targetId);
      if (!targetEntity) {
        this.pendingChallenges.delete(playerId);
        continue;
      }

      // Check if initiator still exists
      const playerEntity = this.world.entities.get(playerId);
      if (!playerEntity) {
        this.pendingChallenges.delete(playerId);
        continue;
      }

      const targetPos = targetEntity.position;
      if (!targetPos) {
        this.pendingChallenges.delete(playerId);
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
          DUEL_CHALLENGE_RANGE,
        )
      ) {
        // In range! Send the duel challenge
        pending.onInRange();
        this.pendingChallenges.delete(playerId);
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
          DUEL_CHALLENGE_RANGE,
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
    // Remove this player's pending challenge
    this.pendingChallenges.delete(playerId);

    // Also cancel any challenges targeting this player
    for (const [initiatorId, pending] of this.pendingChallenges) {
      if (pending.targetId === playerId) {
        this.pendingChallenges.delete(initiatorId);
      }
    }
  }

  /**
   * Get count of pending challenges (for debugging)
   */
  get size(): number {
    return this.pendingChallenges.size;
  }

  /**
   * Clear all pending challenges (for shutdown)
   */
  destroy(): void {
    this.pendingChallenges.clear();
  }
}
