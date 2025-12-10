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
import {
  worldToTile,
  tilesWithinRange,
} from "../../systems/shared/movement/TileSystem";

export interface AggroConfig {
  aggroRange: number;
  combatRange: number;
}

export interface PlayerTarget {
  id: string;
  position: Position3D;
}

/** Player entity shape for aggro checks */
interface AggroablePlayer {
  id: string;
  position?: Position3D;
  node?: { position?: Position3D };
  isDead?: () => boolean;
  health?: number | { current?: number };
  alive?: boolean;
}

/** Check if player is dead using multiple indicators */
function isPlayerDead(player: AggroablePlayer): boolean {
  if (player.isDead?.()) return true;
  if (typeof player.health === "number" && player.health <= 0) return true;
  if (typeof player.health === "object" && (player.health?.current ?? 1) <= 0)
    return true;
  if (player.alive === false) return true;
  return false;
}

export class AggroManager {
  private currentTarget: string | null = null;
  private config: AggroConfig;
  // PERFORMANCE: Cached target object to avoid allocation per findNearbyPlayer call
  private readonly _cachedTarget: PlayerTarget = { id: "", position: { x: 0, y: 0, z: 0 } };

  constructor(config: AggroConfig) {
    this.config = config;
  }

  /**
   * Find nearby player within aggro range (RuneScape-style)
   * Returns first player found within range for simplicity
   * PERFORMANCE: Reuses cached target object to avoid allocation
   */
  findNearbyPlayer(
    currentPos: Position3D,
    players: Array<{
      id: string;
      position?: Position3D;
      node?: { position?: Position3D };
    }>,
  ): PlayerTarget | null {
    // Early exit if no players
    if (players.length === 0) return null;

    const aggroRangeSq = this.config.aggroRange * this.config.aggroRange;

    for (const player of players) {
      const playerPos = player.position || player.node?.position;
      if (!playerPos) continue;
      if (isPlayerDead(player as AggroablePlayer)) continue;

      const dx = playerPos.x - currentPos.x;
      const dz = playerPos.z - currentPos.z;
      if (dx * dx + dz * dz <= aggroRangeSq) {
        // PERFORMANCE: Reuse cached object instead of allocating new one
        this._cachedTarget.id = player.id;
        this._cachedTarget.position.x = playerPos.x;
        this._cachedTarget.position.y = playerPos.y;
        this._cachedTarget.position.z = playerPos.z;
        return this._cachedTarget;
      }
    }
    return null;
  }

  /**
   * Get specific player by ID and return their position
   * PERFORMANCE: Reuses cached target object to avoid allocation
   */
  getPlayer(
    playerId: string,
    getPlayerFn: (id: string) => {
      id: string;
      position?: Position3D;
      node?: { position?: Position3D };
    } | null,
  ): PlayerTarget | null {
    const player = getPlayerFn(playerId);
    if (!player) return null;

    const playerPos = player.position || player.node?.position;
    if (!playerPos) return null;
    if (isPlayerDead(player as AggroablePlayer)) return null;

    // PERFORMANCE: Reuse cached object instead of allocating new one
    this._cachedTarget.id = player.id;
    this._cachedTarget.position.x = playerPos.x;
    this._cachedTarget.position.y = playerPos.y;
    this._cachedTarget.position.z = playerPos.z;
    return this._cachedTarget;
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
   * Uses combatRange from config (in tiles, minimum 1)
   */
  isInCombatRange(mobPos: Position3D, targetPos: Position3D): boolean {
    const mobTile = worldToTile(mobPos.x, mobPos.z);
    const targetTile = worldToTile(targetPos.x, targetPos.z);
    const rangeTiles = Math.max(1, Math.floor(this.config.combatRange));
    return tilesWithinRange(mobTile, targetTile, rangeTiles);
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
