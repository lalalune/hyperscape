/**
 * BuryDelayManager - Manages bone burying cooldowns per player
 *
 * Single Responsibility: Track and enforce bury delay timing (rules-accurate)
 *
 * classic MMORPG Mechanics:
 * - Bone burying has 2-tick (1.2s) delay
 * - Player cannot bury again until delay expires
 * - Delay is per-player, not global
 *
 * Memory: Uses Map with automatic cleanup on player disconnect/death
 *
 */

/** rules-accurate bury delay: 2 ticks = 1.2 seconds */
const BURY_DELAY_TICKS = 2;

export class BuryDelayManager {
  /** Map of playerId → last bury tick */
  private lastBuryTick = new Map<string, number>();

  /**
   * Check if player can bury bones (not on cooldown)
   * @param playerId - Player to check
   * @param currentTick - Current game tick
   * @returns true if player can bury, false if still on cooldown
   */
  canBury(playerId: string, currentTick: number): boolean {
    const lastTick = this.lastBuryTick.get(playerId) ?? 0;
    return currentTick - lastTick >= BURY_DELAY_TICKS;
  }

  /**
   * Get remaining cooldown ticks
   * @param playerId - Player to check
   * @param currentTick - Current game tick
   * @returns 0 if ready to bury, otherwise ticks remaining
   */
  getRemainingCooldown(playerId: string, currentTick: number): number {
    const lastTick = this.lastBuryTick.get(playerId) ?? 0;
    const elapsed = currentTick - lastTick;
    return Math.max(0, BURY_DELAY_TICKS - elapsed);
  }

  /**
   * Record that player just buried bones
   * @param playerId - Player who buried bones
   * @param currentTick - Current game tick
   */
  recordBury(playerId: string, currentTick: number): void {
    this.lastBuryTick.set(playerId, currentTick);
  }

  /**
   * Clear player's bury cooldown (on death, disconnect)
   * @param playerId - Player to clear
   */
  clearPlayer(playerId: string): void {
    this.lastBuryTick.delete(playerId);
  }

  /**
   * Clear all state (for testing or server reset)
   */
  clear(): void {
    this.lastBuryTick.clear();
  }

  /**
   * Get the number of tracked players (for debugging/monitoring)
   */
  getTrackedCount(): number {
    return this.lastBuryTick.size;
  }
}
