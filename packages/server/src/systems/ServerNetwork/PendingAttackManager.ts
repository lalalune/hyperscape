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

import type { World } from "@hyperscape/shared";
import {
  worldToTile,
  tilesWithinMeleeRange,
  EventType,
} from "@hyperscape/shared";
import type { TileMovementManager } from "./tile-movement";

interface PendingAttack {
  playerId: string;
  targetId: string;
  /** Last tile we pathed toward (to detect when mob moves) */
  lastTargetTile: { x: number; z: number } | null;
  /** Weapon melee range in tiles (1 = standard melee/unarmed, 2 = halberd) */
  meleeRange: number;
}

export class PendingAttackManager {
  /** Map of playerId -> pending attack data */
  private pendingAttacks = new Map<string, PendingAttack>();

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
   * Called when player clicks mob but is not in range
   *
   * OSRS: When clicking an NPC, pathfinding targets all tiles within melee range
   *
   * @param meleeRange - Weapon's melee range (1 = standard/unarmed, 2 = halberd)
   */
  queuePendingAttack(
    playerId: string,
    targetId: string,
    _currentTick: number,
    meleeRange: number = 1,
  ): void {
    // Cancel any existing pending attack
    this.cancelPendingAttack(playerId);

    const targetPos = this.getMobPosition(targetId);
    if (!targetPos) {
      return;
    }

    const targetTile = worldToTile(targetPos.x, targetPos.z);

    this.pendingAttacks.set(playerId, {
      playerId,
      targetId,
      lastTargetTile: { x: targetTile.x, z: targetTile.z },
      meleeRange,
    });

    // Immediately start moving toward target using OSRS melee pathfinding
    this.tileMovementManager.movePlayerToward(
      playerId,
      targetPos,
      true,
      meleeRange,
    );
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

      // Check if target still exists and is alive
      if (!this.isMobAlive(pending.targetId)) {
        this.pendingAttacks.delete(playerId);
        continue;
      }

      // Get current positions
      const playerEntity = this.world.entities.get(playerId);
      if (!playerEntity) {
        this.pendingAttacks.delete(playerId);
        continue;
      }

      const targetPos = this.getMobPosition(pending.targetId);
      if (!targetPos) {
        this.pendingAttacks.delete(playerId);
        continue;
      }

      const playerPos = playerEntity.position;
      const playerTile = worldToTile(playerPos.x, playerPos.z);
      const targetTile = worldToTile(targetPos.x, targetPos.z);

      // OSRS-accurate melee range check:
      // - Range 1: Cardinal only (N/S/E/W)
      // - Range 2+: Allows diagonal (Chebyshev distance)
      if (tilesWithinMeleeRange(playerTile, targetTile, pending.meleeRange)) {
        // In range! Start combat
        this.world.emit(EventType.COMBAT_ATTACK_REQUEST, {
          playerId,
          targetId: pending.targetId,
          attackerType: "player",
          targetType: "mob",
          attackType: "melee",
        });

        // Remove pending attack
        this.pendingAttacks.delete(playerId);
        continue;
      }

      // Not in range - check if target moved and re-path if needed
      // OSRS: recalculates path every tick when target moves
      if (
        !pending.lastTargetTile ||
        pending.lastTargetTile.x !== targetTile.x ||
        pending.lastTargetTile.z !== targetTile.z
      ) {
        // Target moved - re-path using OSRS melee pathfinding
        this.tileMovementManager.movePlayerToward(
          playerId,
          targetPos,
          true,
          pending.meleeRange,
        );
        pending.lastTargetTile = { x: targetTile.x, z: targetTile.z };
      }
    }
  }

  /**
   * Clean up on player disconnect
   */
  onPlayerDisconnect(playerId: string): void {
    this.pendingAttacks.delete(playerId);
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
