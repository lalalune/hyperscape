/**
 * Tracks mob combat state and attack timing.
 * First attack delayed one tick after entering range.
 */

export interface CombatStateConfig {
  attackPower: number;
  attackSpeedTicks: number;
  attackRange: number;
}

export class CombatStateManager {
  private inCombat = false;
  private lastAttackTick = -Infinity;
  private nextAttackTick = 0;
  private lastAttackerId: string | null = null;
  private config: CombatStateConfig;

  private _pendingFirstAttack = false;
  private _firstAttackTick = -1;

  private onAttackCallback?: (targetId: string) => void;
  private onCombatStartCallback?: () => void;
  private onCombatEndCallback?: () => void;

  constructor(config: CombatStateConfig) {
    this.config = config;
  }

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

  exitCombat(): void {
    const wasInCombat = this.inCombat;
    this.inCombat = false;
    this.lastAttackTick = -Infinity;
    this.nextAttackTick = 0;
    this.lastAttackerId = null;
    this._pendingFirstAttack = false;
    this._firstAttackTick = -1;

    if (wasInCombat && this.onCombatEndCallback) {
      this.onCombatEndCallback();
    }
  }

  /**
   * First attack happens next tick, not immediately (rules-accurate)
   *
   * Guard: Only sets up timing if NOT already in combat. This is intentional:
   * - Prevents resetting timing on rapid CHASE→ATTACK→CHASE→ATTACK transitions
   * - First-attack delay only applies to fresh combat entries
   * - Re-entry after exitCombat() correctly resets timing
   */
  onEnterCombatRange(currentTick: number): void {
    if (!this.inCombat) {
      this.inCombat = true;
      this._pendingFirstAttack = true;
      this._firstAttackTick = currentTick + 1;

      if (this.onCombatStartCallback) {
        this.onCombatStartCallback();
      }
    }
  }

  isInCombat(): boolean {
    return this.inCombat;
  }

  canAttack(currentTick: number): boolean {
    if (this._pendingFirstAttack) {
      return currentTick >= this._firstAttackTick;
    }
    return currentTick >= this.nextAttackTick;
  }

  /** Returns false if on cooldown */
  performAttack(targetId: string, currentTick: number): boolean {
    if (!this.canAttack(currentTick)) {
      return false;
    }

    if (this._pendingFirstAttack) {
      this._pendingFirstAttack = false;
      this._firstAttackTick = -1;
    }

    this.lastAttackTick = currentTick;
    this.nextAttackTick = currentTick + this.config.attackSpeedTicks;
    this.enterCombat(targetId);

    if (this.onAttackCallback) {
      this.onAttackCallback(targetId);
    }

    return true;
  }

  onReceiveAttack(currentTick: number): void {
    const retaliationDelay = Math.ceil(this.config.attackSpeedTicks / 2) + 1;
    const retaliationTick = currentTick + retaliationDelay;

    if (!this.inCombat || retaliationTick < this.nextAttackTick) {
      this.nextAttackTick = retaliationTick;
    }
  }

  getLastAttackerId(): string | null {
    return this.lastAttackerId;
  }

  getAttackPower(): number {
    return this.config.attackPower;
  }

  getAttackRange(): number {
    return this.config.attackRange;
  }

  getAttackSpeedTicks(): number {
    return this.config.attackSpeedTicks;
  }

  getLastAttackTick(): number {
    return this.lastAttackTick;
  }

  getNextAttackTick(): number {
    return this.nextAttackTick;
  }

  setNextAttackTick(tick: number): void {
    this.nextAttackTick = tick;
  }

  onAttack(callback: (targetId: string) => void): void {
    this.onAttackCallback = callback;
  }

  onCombatStart(callback: () => void): void {
    this.onCombatStartCallback = callback;
  }

  onCombatEnd(callback: () => void): void {
    this.onCombatEndCallback = callback;
  }

  reset(): void {
    this.inCombat = false;
    this.lastAttackTick = -Infinity;
    this.nextAttackTick = 0;
    this.lastAttackerId = null;
    this._pendingFirstAttack = false;
    this._firstAttackTick = -1;
  }

  isPendingFirstAttack(): boolean {
    return this._pendingFirstAttack;
  }

  getFirstAttackTick(): number {
    return this._firstAttackTick;
  }
}
