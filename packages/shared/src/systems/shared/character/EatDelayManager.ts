/**
 * EatDelayManager - Manages eating cooldowns per player
 *
 * Single Responsibility: Track and enforce eat delay timing (rules-accurate)
 *
 * classic MMORPG Mechanics:
 * - Standard food has 3-tick (1.8s) eat delay
 * - Player cannot eat again until delay expires
 * - Delay is per-player, not global
 *
 * Memory: Uses Map with automatic cleanup on player disconnect/death
 */

import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";

export class EatDelayManager {
  /** Map of playerId → last eat tick */
  private lastEatTick = new Map<string, number>();

  /**
   * Check if player can eat (not on cooldown)
   * @param playerId - Player to check
   * @param currentTick - Current game tick
   * @returns true if player can eat, false if still on cooldown
   */
  canEat(playerId: string, currentTick: number): boolean {
    const lastTick = this.lastEatTick.get(playerId) ?? 0;
    return currentTick - lastTick >= COMBAT_CONSTANTS.EAT_DELAY_TICKS;
  }

  /**
   * Get remaining cooldown ticks
   * @param playerId - Player to check
   * @param currentTick - Current game tick
   * @returns 0 if ready to eat, otherwise ticks remaining
   */
  getRemainingCooldown(playerId: string, currentTick: number): number {
    const lastTick = this.lastEatTick.get(playerId) ?? 0;
    const elapsed = currentTick - lastTick;
    return Math.max(0, COMBAT_CONSTANTS.EAT_DELAY_TICKS - elapsed);
  }

  /**
   * Record that player just ate
   * @param playerId - Player who ate
   * @param currentTick - Current game tick
   */
  recordEat(playerId: string, currentTick: number): void {
    this.lastEatTick.set(playerId, currentTick);
  }

  /**
   * Clear player's eat cooldown (on death, disconnect)
   * @param playerId - Player to clear
   */
  clearPlayer(playerId: string): void {
    this.lastEatTick.delete(playerId);
  }

  /**
   * Clear all state (for testing or server reset)
   */
  clear(): void {
    this.lastEatTick.clear();
  }

  /**
   * Get the number of tracked players (for debugging/monitoring)
   */
  getTrackedCount(): number {
    return this.lastEatTick.size;
  }
}
