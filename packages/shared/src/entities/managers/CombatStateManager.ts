/**
 * CombatStateManager - Manages mob combat state and attack logic (TICK-BASED)
 *
 * Responsibilities:
 * - Track combat state (in combat vs peaceful)
 * - Manage attack cooldowns using game ticks (OSRS-accurate)
 * - Validate attack conditions
 * - Prevent teleporting while in combat
 * - Track last attacker
 *
 * Combat state is used to prevent exploits:
 * - Prevents safety teleport while fighting
 * - Prevents mob from resetting mid-combat
 * - Tracks who gets loot/XP credit
 *
 * @see https://oldschool.runescape.wiki/w/Attack_speed
 */

export interface CombatStateConfig {
  /** Attack power/damage */
  attackPower: number;
  /** Attack speed in TICKS (e.g., 4 = attack every 4 ticks / 2.4 seconds) */
  attackSpeedTicks: number;
  /** Attack range in units */
  attackRange: number;
}

export class CombatStateManager {
  private inCombat = false;
  private lastAttackTick = -Infinity;
  private nextAttackTick = 0;
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
    this.lastAttackTick = -Infinity;
    this.nextAttackTick = 0;
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
   * Check if mob can attack on this tick (TICK-BASED)
   * @param currentTick - Current server tick number
   */
  canAttack(currentTick: number): boolean {
    return currentTick >= this.nextAttackTick;
  }

  /**
   * Perform attack (validates cooldown and sets next attack tick)
   * Returns true if attack was performed, false if on cooldown
   * @param targetId - ID of the target entity
   * @param currentTick - Current server tick number
   */
  performAttack(targetId: string, currentTick: number): boolean {
    if (!this.canAttack(currentTick)) {
      return false;
    }

    this.lastAttackTick = currentTick;
    this.nextAttackTick = currentTick + this.config.attackSpeedTicks;
    this.enterCombat(targetId);

    if (this.onAttackCallback) {
      this.onAttackCallback(targetId);
    }

    return true;
  }

  /**
   * Called when mob is attacked - sets OSRS retaliation timing
   * Formula: ceil(attack_speed / 2) + 1 ticks after being hit
   * @see https://oldschool.runescape.wiki/w/Auto_Retaliate
   *
   * @param currentTick - Current server tick number
   */
  onReceiveAttack(currentTick: number): void {
    const retaliationDelay = Math.ceil(this.config.attackSpeedTicks / 2) + 1;
    const retaliationTick = currentTick + retaliationDelay;

    // Only set if not already attacking sooner
    if (!this.inCombat || retaliationTick < this.nextAttackTick) {
      this.nextAttackTick = retaliationTick;
    }
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
   * Get attack speed in ticks
   */
  getAttackSpeedTicks(): number {
    return this.config.attackSpeedTicks;
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
   * Reset to initial state
   */
  reset(): void {
    this.inCombat = false;
    this.lastAttackTick = -Infinity;
    this.nextAttackTick = 0;
    this.lastAttackerId = null;
  }
}
