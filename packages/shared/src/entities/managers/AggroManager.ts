/**
 * AggroManager - Manages mob targeting and aggro behavior
 *
 * Responsibilities:
 * - Target acquisition (scanning for nearby players)
 * - Target validation (checking if target exists and is in range)
 * - Range checking (aggro range vs combat range)
 * - Aggro-on-damage behavior (auto-target attacker)
 * - Target clearing on death/respawn
 *
 * RuneScape-style Aggro Flow:
 * 1. Mob scans for players within aggro range
 * 2. First player found becomes target
 * 3. If attacked while idle, attacker becomes target
 * 4. Target is cleared on death or when out of range
 */

import type { Position3D } from "../../types";

export interface AggroConfig {
  /** Range at which mob detects and chases players */
  aggroRange: number;
  /** Range at which mob can attack target */
  combatRange: number;
}

export interface PlayerTarget {
  id: string;
  position: Position3D;
}

export class AggroManager {
  private currentTarget: string | null = null;
  private config: AggroConfig;

  constructor(config: AggroConfig) {
    this.config = config;
  }

  /**
   * Find nearby player within aggro range (RuneScape-style)
   * Returns first player found within range for simplicity
   */
  findNearbyPlayer(
    currentPos: Position3D,
    players: Array<{ id: string; node?: { position?: Position3D } }>,
  ): PlayerTarget | null {
    // Early exit if no players
    if (players.length === 0) return null;

    for (const player of players) {
      const playerPos = player.node?.position;
      if (!playerPos) continue;

      // CRITICAL: Skip dead players (RuneScape-style: mobs don't aggro on corpses)
      const playerObj = player as any;
      if (
        playerObj.health?.current !== undefined &&
        playerObj.health.current <= 0
      ) {
        continue; // Dead player, skip
      }
      if (playerObj.alive === false) {
        continue; // Dead player, skip
      }

      // Quick distance check (RuneScape-style: first player in range)
      const dx = playerPos.x - currentPos.x;
      const dz = playerPos.z - currentPos.z;
      const distSquared = dx * dx + dz * dz;
      const aggroRangeSquared = this.config.aggroRange * this.config.aggroRange;

      if (distSquared <= aggroRangeSquared) {
        return {
          id: player.id,
          position: {
            x: playerPos.x,
            y: playerPos.y,
            z: playerPos.z,
          },
        };
      }
    }
    return null;
  }

  /**
   * Get specific player by ID and return their position
   */
  getPlayer(
    playerId: string,
    getPlayerFn: (
      id: string,
    ) => { id: string; node?: { position?: Position3D } } | null,
  ): PlayerTarget | null {
    const player = getPlayerFn(playerId);
    if (!player || !player.node?.position) return null;

    // CRITICAL: Return null if player is dead (RuneScape-style: clear target when player dies)
    const playerObj = player as any;
    if (
      playerObj.health?.current !== undefined &&
      playerObj.health.current <= 0
    ) {
      return null; // Dead player
    }
    if (playerObj.alive === false) {
      return null; // Dead player
    }

    return {
      id: player.id,
      position: {
        x: player.node.position.x,
        y: player.node.position.y,
        z: player.node.position.z,
      },
    };
  }

  /**
   * Check if target is within aggro range
   */
  isInAggroRange(mobPos: Position3D, targetPos: Position3D): boolean {
    const dx = targetPos.x - mobPos.x;
    const dz = targetPos.z - mobPos.z;
    const distSquared = dx * dx + dz * dz;
    return distSquared <= this.config.aggroRange * this.config.aggroRange;
  }

  /**
   * Check if target is within combat range
   */
  isInCombatRange(mobPos: Position3D, targetPos: Position3D): boolean {
    const dx = targetPos.x - mobPos.x;
    const dz = targetPos.z - mobPos.z;
    const distSquared = dx * dx + dz * dz;
    return distSquared <= this.config.combatRange * this.config.combatRange;
  }

  /**
   * Set current target
   */
  setTarget(playerId: string): void {
    this.currentTarget = playerId;
  }

  /**
   * Get current target
   */
  getTarget(): string | null {
    return this.currentTarget;
  }

  /**
   * Clear current target
   */
  clearTarget(): void {
    this.currentTarget = null;
  }

  /**
   * Set target if none is currently set (used for aggro-on-damage)
   */
  setTargetIfNone(playerId: string): void {
    if (!this.currentTarget) {
      this.currentTarget = playerId;
    }
  }

  /**
   * Reset to initial state (for cleanup/respawn)
   */
  reset(): void {
    this.currentTarget = null;
  }

  /**
   * Get aggro range for external use
   */
  getAggroRange(): number {
    return this.config.aggroRange;
  }

  /**
   * Get combat range for external use
   */
  getCombatRange(): number {
    return this.config.combatRange;
  }
}
