/**
 * PendingAttackManager
 *
 * Server-authoritative system for tracking players walking toward mobs to attack.
 * This replaces unreliable client-side tracking with 100% reliable server-side logic.
 *
 * OSRS-style behavior (from wiki):
 * 1. Player clicks mob to attack
 * 2. If not in range, server queues "pending attack" and moves player toward mob
 * 3. Every tick, server re-checks range and re-paths if mob moved
 * 4. When in range, server initiates combat
 * 5. New click or disconnect cancels pending attack
 * 6. NO TIMEOUT - pathfinding recalculates every tick until target found
 *
 * @see https://oldschool.runescape.wiki/w/Pathfinding
 */

import type { World, TileCoord } from "@hyperforge/shared";
import {
  worldToTile,
  worldToTileInto,
  tilesWithinMeleeRange,
  tilesWithinRange,
  hasLineOfSight,
  CollisionMask,
  EventType,
  AttackType,
} from "@hyperforge/shared";
import type { TileMovementManager } from "./tile-movement";

interface PendingAttack {
  playerId: string;
  targetId: string;
  /** Target type: "mob" for PvE, "player" for PvP */
  targetType: "mob" | "player";
  /** Last tile we pathed toward (to detect when target moves) */
  lastTargetTile: { x: number; z: number } | null;
  /** Weapon attack range in tiles (1 = standard melee/unarmed, 2 = halberd, 10 = ranged/magic) */
  attackRange: number;
  /** Attack type: melee uses cardinal-only for range 1, ranged/magic use Chebyshev distance */
  attackType: AttackType;
}

export class PendingAttackManager {
  /** Map of playerId -> pending attack data */
  private pendingAttacks = new Map<string, PendingAttack>();

  // ============================================================================
  // PRE-ALLOCATED BUFFERS (Zero-allocation hot path support)
  // ============================================================================

  /** Pre-allocated player tile for processTick */
  private readonly _playerTile: TileCoord = { x: 0, z: 0 };

  /** Pre-allocated target tile for processTick */
  private readonly _targetTile: TileCoord = { x: 0, z: 0 };

  constructor(
    private world: World,
    private tileMovementManager: TileMovementManager,
    private getMobPosition: (
      mobId: string,
    ) => { x: number; y: number; z: number } | null,
    private isMobAlive: (mobId: string) => boolean,
  ) {}

  /**
   * Queue a pending attack for a player
   * Called when player clicks target but is not in range
   *
   * OSRS: When clicking an NPC/player, pathfinding targets all tiles within attack range
   *
   * @param attackRange - Weapon's attack range (1 = standard melee/unarmed, 2 = halberd, 10 = ranged/magic)
   * @param targetType - "mob" for PvE, "player" for PvP
   * @param attackType - Type of attack: MELEE, RANGED, or MAGIC
   */
  queuePendingAttack(
    playerId: string,
    targetId: string,
    _currentTick: number,
    attackRange: number = 1,
    targetType: "mob" | "player" = "mob",
    attackType: AttackType = AttackType.MELEE,
  ): void {
    // Cancel any existing pending attack
    this.cancelPendingAttack(playerId);

    const targetPos = this.getTargetPosition(targetId);
    if (!targetPos) {
      return;
    }

    const targetTile = worldToTile(targetPos.x, targetPos.z);

    this.pendingAttacks.set(playerId, {
      playerId,
      targetId,
      targetType,
      lastTargetTile: { x: targetTile.x, z: targetTile.z },
      attackRange,
      attackType,
    });

    // Immediately start moving toward target using appropriate pathfinding
    this.tileMovementManager.movePlayerToward(
      playerId,
      targetPos,
      true,
      attackRange,
      attackType,
    );
  }

  /**
   * Get target position - works for both mobs and players
   */
  private getTargetPosition(
    targetId: string,
  ): { x: number; y: number; z: number } | null {
    // Try mob position first (original callback)
    const mobPos = this.getMobPosition(targetId);
    if (mobPos) return mobPos;

    // Try player position
    const player = this.world.entities.players?.get(targetId);
    if (player?.position) {
      return player.position;
    }

    return null;
  }

  /**
   * Check if target is alive - works for both mobs and players
   */
  private isTargetAlive(
    targetId: string,
    targetType: "mob" | "player",
  ): boolean {
    if (targetType === "mob") {
      return this.isMobAlive(targetId);
    }

    // For players, check if they exist and have health > 0
    const player = this.world.entities.players?.get(targetId);
    if (!player) return false;

    const health = player.getHealth?.();
    return typeof health === "number" && health > 0;
  }

  /**
   * Cancel pending attack for a player
   * Called when player clicks elsewhere, disconnects, or attack succeeds
   */
  cancelPendingAttack(playerId: string): void {
    this.pendingAttacks.delete(playerId);
  }

  /**
   * Check if player has a pending attack
   */
  hasPendingAttack(playerId: string): boolean {
    return this.pendingAttacks.has(playerId);
  }

  /**
   * Get the target of a pending attack
   */
  getPendingAttackTarget(playerId: string): string | null {
    return this.pendingAttacks.get(playerId)?.targetId ?? null;
  }

  /**
   * Process all pending attacks - called every tick
   *
   * OSRS behavior (from wiki):
   * - "if the clicked entity is an NPC or player, a new pathfinding attempt
   *    will be started every tick, until a target tile can be found"
   * - NO TIMEOUT - players follow indefinitely until they click elsewhere
   * - Uses OSRS melee range rules (cardinal-only for range 1)
   */
  processTick(_currentTick: number): void {
    for (const [playerId, pending] of this.pendingAttacks) {
      // NO TIMEOUT - OSRS follows indefinitely (removed timeout check)

      // Check if target still exists and is alive (supports both mobs and players)
      if (!this.isTargetAlive(pending.targetId, pending.targetType)) {
        this.pendingAttacks.delete(playerId);
        continue;
      }

      // Get current positions
      const playerEntity = this.world.entities.get(playerId);
      if (!playerEntity) {
        this.pendingAttacks.delete(playerId);
        continue;
      }

      const targetPos = this.getTargetPosition(pending.targetId);
      if (!targetPos) {
        this.pendingAttacks.delete(playerId);
        continue;
      }

      const playerPos = playerEntity.position;
      // Zero-allocation: use pre-allocated tile buffers
      worldToTileInto(playerPos.x, playerPos.z, this._playerTile);
      worldToTileInto(targetPos.x, targetPos.z, this._targetTile);

      // OSRS-accurate range check:
      // - Melee range 1: Cardinal only (N/S/E/W)
      // - Melee range 2+: Allows diagonal (Chebyshev distance)
      // - Ranged/Magic: Chebyshev distance + Line of Sight
      const inRange =
        pending.attackType === AttackType.MELEE
          ? tilesWithinMeleeRange(
              this._playerTile,
              this._targetTile,
              pending.attackRange,
            )
          : tilesWithinRange(
              this._playerTile,
              this._targetTile,
              pending.attackRange,
            ) && this.tileHasLineOfSight(this._playerTile, this._targetTile);

      if (inRange) {
        // Stop remaining walk path — player has arrived at combat position.
        // Without this, onTick() may process leftover path tiles and send
        // a tileMovementEnd/idle before combat takes over.
        this.tileMovementManager.stopPlayer(playerId);

        // In range! Start combat (use correct targetType for PvP/PvE)
        this.world.emit(EventType.COMBAT_ATTACK_REQUEST, {
          attackerId: playerId,
          targetId: pending.targetId,
          attackerType: "player",
          targetType: pending.targetType,
          attackType: pending.attackType,
        });

        // Remove pending attack
        this.pendingAttacks.delete(playerId);
        continue;
      }

      // Not in range - check if target moved and re-path if needed
      // OSRS: recalculates path every tick when target moves
      if (
        !pending.lastTargetTile ||
        pending.lastTargetTile.x !== this._targetTile.x ||
        pending.lastTargetTile.z !== this._targetTile.z
      ) {
        // Target moved - re-path toward target
        this.tileMovementManager.movePlayerToward(
          playerId,
          targetPos,
          true,
          pending.attackRange,
          pending.attackType,
        );
        // Zero-allocation: reuse or create lastTargetTile
        if (!pending.lastTargetTile) {
          pending.lastTargetTile = { x: 0, z: 0 };
        }
        pending.lastTargetTile.x = this._targetTile.x;
        pending.lastTargetTile.z = this._targetTile.z;
      }
    }
  }

  /**
   * Process pending attack for a specific player
   *
   * OSRS-ACCURATE: Called by GameTickProcessor during player phase
   * This processes just one player's pending attack instead of all.
   *
   * @param playerId - The player to process
   * @param currentTick - Current tick number
   */
  processPlayerTick(playerId: string, _currentTick: number): void {
    const pending = this.pendingAttacks.get(playerId);
    if (!pending) return;

    // Check if target still exists and is alive (supports both mobs and players)
    if (!this.isTargetAlive(pending.targetId, pending.targetType)) {
      this.pendingAttacks.delete(playerId);
      return;
    }

    // Get current positions
    const playerEntity = this.world.entities.get(playerId);
    if (!playerEntity) {
      this.pendingAttacks.delete(playerId);
      return;
    }

    const targetPos = this.getTargetPosition(pending.targetId);
    if (!targetPos) {
      this.pendingAttacks.delete(playerId);
      return;
    }

    const playerPos = playerEntity.position;
    // Zero-allocation: use pre-allocated tile buffers
    worldToTileInto(playerPos.x, playerPos.z, this._playerTile);
    worldToTileInto(targetPos.x, targetPos.z, this._targetTile);

    // OSRS-accurate range check based on attack type
    // Ranged/Magic additionally require Line of Sight
    const inRange =
      pending.attackType === AttackType.MELEE
        ? tilesWithinMeleeRange(
            this._playerTile,
            this._targetTile,
            pending.attackRange,
          )
        : tilesWithinRange(
            this._playerTile,
            this._targetTile,
            pending.attackRange,
          ) && this.tileHasLineOfSight(this._playerTile, this._targetTile);

    if (inRange) {
      // Stop remaining walk path — player has arrived at combat position.
      // Without this, onTick() may process leftover path tiles and send
      // a tileMovementEnd/idle before combat takes over.
      this.tileMovementManager.stopPlayer(playerId);

      // In range! Start combat (use correct targetType for PvP/PvE)
      this.world.emit(EventType.COMBAT_ATTACK_REQUEST, {
        attackerId: playerId,
        targetId: pending.targetId,
        attackerType: "player",
        targetType: pending.targetType,
        attackType: pending.attackType,
      });

      // Remove pending attack
      this.pendingAttacks.delete(playerId);
      return;
    }

    // Not in range - check if target moved and re-path if needed
    if (
      !pending.lastTargetTile ||
      pending.lastTargetTile.x !== this._targetTile.x ||
      pending.lastTargetTile.z !== this._targetTile.z
    ) {
      // Target moved - re-path toward target
      this.tileMovementManager.movePlayerToward(
        playerId,
        targetPos,
        true,
        pending.attackRange,
        pending.attackType,
      );
      // Zero-allocation: reuse or create lastTargetTile
      if (!pending.lastTargetTile) {
        pending.lastTargetTile = { x: 0, z: 0 };
      }
      pending.lastTargetTile.x = this._targetTile.x;
      pending.lastTargetTile.z = this._targetTile.z;
    }
  }

  /**
   * Clean up on player disconnect
   */
  onPlayerDisconnect(playerId: string): void {
    this.pendingAttacks.delete(playerId);
  }

  /**
   * Check line of sight between two tiles for ranged/magic combat.
   * Uses BLOCKS_RANGED collision mask (BLOCK_LOS | BLOCKED).
   */
  private tileHasLineOfSight(from: TileCoord, to: TileCoord): boolean {
    return hasLineOfSight(from, to, (x, z) =>
      this.world.collision.hasFlags(x, z, CollisionMask.BLOCKS_RANGED),
    );
  }

  /**
   * Get count of pending attacks (for debugging)
   */
  get size(): number {
    return this.pendingAttacks.size;
  }

  /**
   * Clear all pending attacks (for shutdown)
   */
  destroy(): void {
    this.pendingAttacks.clear();
  }
}
