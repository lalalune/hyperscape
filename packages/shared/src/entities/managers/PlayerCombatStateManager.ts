/**
 * PlayerCombatStateManager - Manages player combat state and attack logic (TICK-BASED)
 *
 * Mirrors CombatStateManager for mobs but with player-specific features:
 * - Auto-retaliate toggle (enabled by default)
 * - AFK detection for auto-retaliate disable
 * - Weapon switching support
 * - Logout prevention tracking
 *
 * Responsibilities:
 * - Track combat state (in combat vs peaceful)
 * - Manage attack cooldowns using game ticks (rules-accurate)
 * - Validate attack conditions
 * - Prevent logout while in combat
 * - Track last attacker for retaliation
 * - Handle rules-accurate retaliation timing
 *
 */

import { COMBAT_CONSTANTS } from "../../constants/CombatConstants";
import type { EntityID } from "../../types/core/identifiers";

export interface PlayerCombatStateConfig {
  /** Attack speed in TICKS (e.g., 4 = attack every 4 ticks / 2.4 seconds) */
  attackSpeedTicks: number;
  /** Attack range in tiles */
  attackRange: number;
}

export class PlayerCombatStateManager {
  private inCombat = false;
  private lastAttackTick = -Infinity;
  private nextAttackTick = 0;
  private targetId: string | null = null;
  private lastAttackerId: string | null = null;
  private config: PlayerCombatStateConfig;

  // Auto-retaliate state (enabled by default in classic MMORPG)
  private autoRetaliateEnabled = true;

  // AFK tracking for auto-retaliate disable
  // @see COMBAT_CONSTANTS.AFK_DISABLE_RETALIATE_TICKS (20 minutes)
  private lastActionTick = 0;

  // Logout prevention tracking
  // @see COMBAT_CONSTANTS.LOGOUT_PREVENTION_TICKS (9.6 seconds)
  private lastDamageTakenTick = -Infinity;

  // Combat timeout tracking
  // @see COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS (8 ticks / 4.8 seconds)
  private combatStartTick = -Infinity;
  private lastCombatActivityTick = -Infinity;

  // Callbacks
  private onAttackCallback?: (targetId: string) => void;
  private onCombatStartCallback?: () => void;
  private onCombatEndCallback?: () => void;
  private onAutoRetaliateCallback?: (attackerId: string) => void;

  constructor(config: PlayerCombatStateConfig) {
    this.config = config;
  }

  /**
   * Mark as in combat (called when taking damage or attacking)
   * @param targetId - Target ID (accepts both EntityID and string for backwards compatibility)
   */
  enterCombat(targetId?: EntityID | string): void {
    const wasInCombat = this.inCombat;
    this.inCombat = true;

    if (targetId) {
      this.targetId = String(targetId);
    }

    if (!wasInCombat) {
      this.combatStartTick = this.lastActionTick;
      if (this.onCombatStartCallback) {
        this.onCombatStartCallback();
      }
    }
  }

  /**
   * Exit combat (called when combat times out or player/target dies)
   */
  exitCombat(): void {
    const wasInCombat = this.inCombat;
    this.inCombat = false;
    this.lastAttackTick = -Infinity;
    this.nextAttackTick = 0;
    this.targetId = null;
    this.lastAttackerId = null;

    if (wasInCombat && this.onCombatEndCallback) {
      this.onCombatEndCallback();
    }
  }

  /**
   * Check if currently in combat
   */
  isInCombat(): boolean {
    return this.inCombat;
  }

  /**
   * Check if player can attack on this tick (TICK-BASED)
   *
   * @param currentTick - Current server tick number
   */
  canAttack(currentTick: number): boolean {
    return currentTick >= this.nextAttackTick;
  }

  /**
   * Perform attack (validates cooldown and sets next attack tick)
   * Returns true if attack was performed, false if on cooldown
   *
   * @param targetId - ID of the target entity (accepts both EntityID and string)
   * @param currentTick - Current server tick number
   */
  performAttack(targetId: EntityID | string, currentTick: number): boolean {
    if (!this.canAttack(currentTick)) {
      return false;
    }

    const targetIdStr = String(targetId);
    this.lastAttackTick = currentTick;
    this.nextAttackTick = currentTick + this.config.attackSpeedTicks;
    this.lastCombatActivityTick = currentTick;
    this.lastActionTick = currentTick;
    this.enterCombat(targetIdStr);

    if (this.onAttackCallback) {
      this.onAttackCallback(targetIdStr);
    }

    return true;
  }

  /**
   * Called when player is attacked - handles retaliation timing
   *
   * rules-accurate retaliation:
   * - If auto-retaliate is enabled and player is not AFK
   * - Retaliation happens after: ceil(attack_speed / 2) + 1 ticks
   *
   *
   * @param attackerId - ID of the attacking entity (accepts both EntityID and string)
   * @param currentTick - Current server tick number
   */
  onReceiveAttack(attackerId: EntityID | string, currentTick: number): void {
    const attackerIdStr = String(attackerId);
    this.lastAttackerId = attackerIdStr;
    this.lastDamageTakenTick = currentTick;
    this.lastCombatActivityTick = currentTick;
    this.enterCombat();

    // Check if auto-retaliate should trigger
    if (this.shouldAutoRetaliate(currentTick)) {
      // Calculate classic MMORPG retaliation delay: ceil(attack_speed / 2) + 1 ticks
      const retaliationDelay = Math.ceil(this.config.attackSpeedTicks / 2) + 1;
      const retaliationTick = currentTick + retaliationDelay;

      // Only set if not already attacking sooner
      if (!this.targetId || retaliationTick < this.nextAttackTick) {
        this.targetId = attackerIdStr;
        this.nextAttackTick = retaliationTick;
      }

      if (this.onAutoRetaliateCallback) {
        this.onAutoRetaliateCallback(attackerIdStr);
      }
    }
  }

  /**
   * Check if auto-retaliate should trigger
   *
   * Conditions:
   * 1. Auto-retaliate is enabled
   * 2. Player is not AFK (> 20 minutes since last action)
   * 3. Player doesn't already have a target
   */
  private shouldAutoRetaliate(currentTick: number): boolean {
    if (!this.autoRetaliateEnabled) {
      return false;
    }

    // Check AFK timeout (20 minutes)
    const ticksSinceAction = currentTick - this.lastActionTick;
    if (ticksSinceAction > COMBAT_CONSTANTS.AFK_DISABLE_RETALIATE_TICKS) {
      return false;
    }

    // Don't interrupt if already attacking
    if (this.targetId && this.inCombat) {
      return false;
    }

    return true;
  }

  /**
   * Toggle auto-retaliate setting
   */
  setAutoRetaliate(enabled: boolean): void {
    this.autoRetaliateEnabled = enabled;
  }

  /**
   * Get auto-retaliate setting
   */
  isAutoRetaliateEnabled(): boolean {
    return this.autoRetaliateEnabled;
  }

  /**
   * Record player action (prevents AFK auto-retaliate disable)
   */
  recordAction(currentTick: number): void {
    this.lastActionTick = currentTick;
  }

  /**
   * Check if player can logout (not prevented by combat)
   *
   * classic MMORPG: Cannot logout for 9.6 seconds (16 ticks) after taking damage
   */
  canLogout(currentTick: number): boolean {
    const ticksSinceDamage = currentTick - this.lastDamageTakenTick;
    return ticksSinceDamage >= COMBAT_CONSTANTS.LOGOUT_PREVENTION_TICKS;
  }

  /**
   * Check if combat has timed out (8 ticks / 4.8 seconds since last activity)
   */
  hasCombatTimedOut(currentTick: number): boolean {
    if (!this.inCombat) {
      return false;
    }

    const ticksSinceActivity = currentTick - this.lastCombatActivityTick;
    return ticksSinceActivity >= COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS;
  }

  /**
   * Update combat state (call each tick)
   * Handles combat timeout
   */
  update(currentTick: number): void {
    if (this.inCombat && this.hasCombatTimedOut(currentTick)) {
      this.exitCombat();
    }
  }

  /**
   * Get current target ID
   */
  getTargetId(): string | null {
    return this.targetId;
  }

  /**
   * Set current target
   * @param targetId - Target ID (accepts both EntityID and string for backwards compatibility)
   */
  setTarget(targetId: EntityID | string | null): void {
    this.targetId = targetId ? String(targetId) : null;
    if (targetId) {
      this.enterCombat(targetId);
    }
  }

  /**
   * Clear current target
   */
  clearTarget(): void {
    this.targetId = null;
  }

  /**
   * Get last attacker ID (for retaliation/death)
   */
  getLastAttackerId(): string | null {
    return this.lastAttackerId;
  }

  /**
   * Get attack range
   */
  getAttackRange(): number {
    return this.config.attackRange;
  }

  /**
   * Get attack speed in ticks
   */
  getAttackSpeedTicks(): number {
    return this.config.attackSpeedTicks;
  }

  /**
   * Update attack speed (when weapon changes)
   */
  setAttackSpeedTicks(ticks: number): void {
    this.config.attackSpeedTicks = ticks;
  }

  /**
   * Update attack range (when weapon changes)
   */
  setAttackRange(range: number): void {
    this.config.attackRange = range;
  }

  /**
   * Get last attack tick (for network sync)
   */
  getLastAttackTick(): number {
    return this.lastAttackTick;
  }

  /**
   * Get next attack tick (for network sync)
   */
  getNextAttackTick(): number {
    return this.nextAttackTick;
  }

  /**
   * Set next attack tick (from network sync)
   */
  setNextAttackTick(tick: number): void {
    this.nextAttackTick = tick;
  }

  /**
   * Register callback for when attack is performed
   */
  onAttack(callback: (targetId: string) => void): void {
    this.onAttackCallback = callback;
  }

  /**
   * Register callback for combat start
   */
  onCombatStart(callback: () => void): void {
    this.onCombatStartCallback = callback;
  }

  /**
   * Register callback for combat end
   */
  onCombatEnd(callback: () => void): void {
    this.onCombatEndCallback = callback;
  }

  /**
   * Register callback for auto-retaliate trigger
   */
  onAutoRetaliate(callback: (attackerId: string) => void): void {
    this.onAutoRetaliateCallback = callback;
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.inCombat = false;
    this.lastAttackTick = -Infinity;
    this.nextAttackTick = 0;
    this.targetId = null;
    this.lastAttackerId = null;
    this.lastDamageTakenTick = -Infinity;
    this.lastCombatActivityTick = -Infinity;
    this.combatStartTick = -Infinity;
    // Keep auto-retaliate setting across resets
  }

  /**
   * Get remaining logout prevention time in ticks
   */
  getLogoutPreventionTicks(currentTick: number): number {
    const ticksSinceDamage = currentTick - this.lastDamageTakenTick;
    return Math.max(
      0,
      COMBAT_CONSTANTS.LOGOUT_PREVENTION_TICKS - ticksSinceDamage,
    );
  }

  /**
   * Check if player is AFK (> 20 minutes since last action)
   */
  isAFK(currentTick: number): boolean {
    const ticksSinceAction = currentTick - this.lastActionTick;
    return ticksSinceAction > COMBAT_CONSTANTS.AFK_DISABLE_RETALIATE_TICKS;
  }
}
