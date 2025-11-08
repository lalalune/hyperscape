/**
 * CombatStateManager - Manages mob combat state and attack logic
 *
 * Responsibilities:
 * - Track combat state (in combat vs peaceful)
 * - Manage attack cooldowns
 * - Validate attack conditions
 * - Prevent teleporting while in combat
 * - Track last attacker
 *
 * Combat state is used to prevent exploits:
 * - Prevents safety teleport while fighting
 * - Prevents mob from resetting mid-combat
 * - Tracks who gets loot/XP credit
 */

export interface CombatStateConfig {
  /** Attack power/damage */
  attackPower: number;
  /** Attack speed in milliseconds (e.g., 2000 = attack every 2 seconds) */
  attackSpeed: number;
  /** Attack range in units */
  attackRange: number;
}

export class CombatStateManager {
  private inCombat = false;
  private lastAttackTime = 0;
  private lastAttackerId: string | null = null;
  private config: CombatStateConfig;

  // Callbacks
  private onAttackCallback?: (targetId: string) => void;
  private onCombatStartCallback?: () => void;
  private onCombatEndCallback?: () => void;

  constructor(config: CombatStateConfig) {
    this.config = config;
  }

  /**
   * Mark as in combat (called when taking damage or attacking)
   */
  enterCombat(attackerId?: string): void {
    const wasInCombat = this.inCombat;
    this.inCombat = true;

    if (attackerId) {
      this.lastAttackerId = attackerId;
    }

    if (!wasInCombat && this.onCombatStartCallback) {
      this.onCombatStartCallback();
    }
  }

  /**
   * Exit combat (called when mob resets or respawns)
   */
  exitCombat(): void {
    const wasInCombat = this.inCombat;
    this.inCombat = false;
    this.lastAttackTime = 0;
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
   * Check if mob can attack (cooldown ready)
   */
  canAttack(currentTime: number): boolean {
    if (this.lastAttackTime === 0) {
      // First attack - always allowed
      return true;
    }

    const timeSinceLastAttack = currentTime - this.lastAttackTime;
    return timeSinceLastAttack >= this.config.attackSpeed;
  }

  /**
   * Perform attack (validates cooldown and marks attack time)
   * Returns true if attack was performed, false if on cooldown
   */
  performAttack(targetId: string, currentTime: number): boolean {
    if (!this.canAttack(currentTime)) {
      return false;
    }

    this.lastAttackTime = currentTime;
    this.enterCombat(targetId);

    if (this.onAttackCallback) {
      this.onAttackCallback(targetId);
    }

    return true;
  }

  /**
   * Get last attacker ID (for death event / loot)
   */
  getLastAttackerId(): string | null {
    return this.lastAttackerId;
  }

  /**
   * Get attack power
   */
  getAttackPower(): number {
    return this.config.attackPower;
  }

  /**
   * Get attack range
   */
  getAttackRange(): number {
    return this.config.attackRange;
  }

  /**
   * Get attack speed (cooldown in ms)
   */
  getAttackSpeed(): number {
    return this.config.attackSpeed;
  }

  /**
   * Get last attack time (for network sync)
   */
  getLastAttackTime(): number {
    return this.lastAttackTime;
  }

  /**
   * Set last attack time (from network sync)
   */
  setLastAttackTime(time: number): void {
    this.lastAttackTime = time;
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
   * Reset to initial state
   */
  reset(): void {
    this.inCombat = false;
    this.lastAttackTime = 0;
    this.lastAttackerId = null;
  }
}
