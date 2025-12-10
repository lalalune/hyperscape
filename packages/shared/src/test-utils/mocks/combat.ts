/**
 * Combat Mock Factories
 *
 * Creates strongly-typed combat mocks that mirror production CombatSystem.
 * Extracts pure combat logic for isolated unit testing.
 */

import { COMBAT_CONSTANTS } from "../../constants/CombatConstants";
import { AttackType } from "../../types/core/core";
import type { TestPosition } from "../validation";
import { expectValidPosition, expectValidDamage, expectValidTick } from "../validation";

/**
 * Combat stats structure matching production CombatStats
 */
export interface MockCombatStats {
  attack: number;
  strength: number;
  defense: number;
  ranged: number;
  hitpoints: number;
}

/**
 * Damage result structure matching production DamageResult
 */
export interface MockDamageResult {
  damage: number;
  isCritical: boolean;
  damageType: AttackType;
  didHit: boolean;
}

/**
 * Combat state tracking
 */
export interface MockCombatState {
  attackerId: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  weaponType: AttackType;
  inCombat: boolean;
  lastAttackTick: number;
  nextAttackTick: number;
  combatEndTick: number;
  attackSpeedTicks: number;
}

/**
 * Default combat stats for testing
 */
export const DEFAULT_COMBAT_STATS: MockCombatStats = {
  attack: 1,
  strength: 1,
  defense: 1,
  ranged: 1,
  hitpoints: 10,
};

/**
 * High-level combat stats for testing
 */
export const HIGH_COMBAT_STATS: MockCombatStats = {
  attack: 99,
  strength: 99,
  defense: 99,
  ranged: 99,
  hitpoints: 99,
};

// =============================================================================
// PURE LOGIC FUNCTIONS (extracted from CombatCalculations.ts for unit testing)
// =============================================================================

/**
 * Calculate OSRS-style accuracy (hit chance)
 * PURE FUNCTION - no side effects, deterministic for same seed
 *
 * @param attackerAttackLevel - Attacker's attack stat
 * @param attackerAttackBonus - Attacker's equipment bonus
 * @param targetDefenseLevel - Target's defense stat
 * @param targetDefenseBonus - Target's equipment bonus
 * @param randomRoll - Random value 0-1 (pass explicitly for deterministic testing)
 */
export function calculateAccuracy(
  attackerAttackLevel: number,
  attackerAttackBonus: number,
  targetDefenseLevel: number,
  targetDefenseBonus: number,
  randomRoll: number
): boolean {
  // OSRS formula for attack roll
  const effectiveAttack = attackerAttackLevel + 8;
  const attackRoll = effectiveAttack * (attackerAttackBonus + 64);

  // OSRS formula for defence roll
  const effectiveDefence = targetDefenseLevel + 9;
  const defenceRoll = effectiveDefence * (targetDefenseBonus + 64);

  // Calculate hit chance
  let hitChance: number;
  if (attackRoll > defenceRoll) {
    hitChance = 1 - (defenceRoll + 2) / (2 * (attackRoll + 1));
  } else {
    hitChance = attackRoll / (2 * (defenceRoll + 1));
  }

  return randomRoll < hitChance;
}

/**
 * Calculate max hit for melee attacks
 * PURE FUNCTION - no side effects
 *
 * @param strengthLevel - Strength stat
 * @param strengthBonus - Equipment strength bonus
 */
export function calculateMeleeMaxHit(
  strengthLevel: number,
  strengthBonus: number
): number {
  const effectiveStrength = strengthLevel + 8;
  const maxHit = Math.floor(
    0.5 + (effectiveStrength * (strengthBonus + 64)) / 640
  );
  return Math.max(1, maxHit);
}

/**
 * Calculate max hit for ranged attacks
 * PURE FUNCTION - no side effects
 *
 * @param rangedLevel - Ranged stat
 * @param rangedBonus - Equipment ranged bonus
 */
export function calculateRangedMaxHit(
  rangedLevel: number,
  rangedBonus: number
): number {
  const effectiveRanged = rangedLevel + 8;
  const maxHit = Math.floor(
    0.5 + (effectiveRanged * (rangedBonus + 64)) / 640
  );
  return Math.max(1, maxHit);
}

/**
 * Calculate damage with deterministic random for testing
 * PURE FUNCTION - same inputs always produce same output
 *
 * @param attacker - Attacker stats
 * @param target - Target stats
 * @param attackType - Melee or ranged
 * @param equipmentBonus - Equipment stat bonuses
 * @param accuracyRoll - Random roll for accuracy (0-1)
 * @param damageRoll - Random roll for damage (0-1)
 */
export function calculateDamageDeterministic(
  attacker: { stats: MockCombatStats },
  target: { stats: MockCombatStats },
  attackType: AttackType,
  equipmentBonus: { attack: number; strength: number; defense: number; ranged: number },
  accuracyRoll: number,
  damageRoll: number
): MockDamageResult {
  let maxHit: number;
  let attackStat: number;
  let attackBonus: number;

  if (attackType === AttackType.MELEE) {
    attackStat = attacker.stats.attack;
    attackBonus = equipmentBonus.attack;
    maxHit = calculateMeleeMaxHit(attacker.stats.strength, equipmentBonus.strength);
  } else {
    attackStat = attacker.stats.ranged;
    attackBonus = equipmentBonus.ranged;
    maxHit = calculateRangedMaxHit(attacker.stats.ranged, equipmentBonus.ranged);
  }

  // Check accuracy
  const didHit = calculateAccuracy(
    attackStat,
    attackBonus,
    target.stats.defense,
    0, // Target defense bonus (equipment)
    accuracyRoll
  );

  if (!didHit) {
    return {
      damage: 0,
      isCritical: false,
      damageType: attackType,
      didHit: false,
    };
  }

  // Roll damage (0 to maxHit)
  const damage = Math.floor(damageRoll * (maxHit + 1));

  return {
    damage,
    isCritical: false, // OSRS has no crit system
    damageType: attackType,
    didHit: true,
  };
}

/**
 * Check if attack is on cooldown (tick-based)
 * PURE FUNCTION
 *
 * @param currentTick - Current game tick
 * @param nextAttackTick - Tick when next attack is allowed
 */
export function isAttackOnCooldown(
  currentTick: number,
  nextAttackTick: number
): boolean {
  expectValidTick(currentTick, "currentTick");
  expectValidTick(nextAttackTick, "nextAttackTick");
  return currentTick < nextAttackTick;
}

/**
 * Check if position is within melee range (tile-based)
 * PURE FUNCTION
 *
 * Uses Chebyshev distance (king's move) for tile adjacency.
 */
export function isInMeleeRange(
  attackerPos: TestPosition,
  targetPos: TestPosition,
  tileSize: number = 1
): boolean {
  expectValidPosition(attackerPos, "attackerPos");
  expectValidPosition(targetPos, "targetPos");

  // Convert to tile coordinates
  const attackerTileX = Math.floor(attackerPos.x / tileSize);
  const attackerTileZ = Math.floor(attackerPos.z / tileSize);
  const targetTileX = Math.floor(targetPos.x / tileSize);
  const targetTileZ = Math.floor(targetPos.z / tileSize);

  // Chebyshev distance (max of axis differences)
  const dx = Math.abs(attackerTileX - targetTileX);
  const dz = Math.abs(attackerTileZ - targetTileZ);
  const chebyshev = Math.max(dx, dz);

  return chebyshev <= 1; // Adjacent = within 1 tile
}

/**
 * Check if position is within ranged range
 * PURE FUNCTION
 */
export function isInRangedRange(
  attackerPos: TestPosition,
  targetPos: TestPosition,
  range: number = COMBAT_CONSTANTS.RANGED_RANGE
): boolean {
  expectValidPosition(attackerPos, "attackerPos");
  expectValidPosition(targetPos, "targetPos");

  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;
  const dz = targetPos.z - attackerPos.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  return distance <= range;
}

/**
 * Calculate retaliation delay (OSRS formula)
 * PURE FUNCTION
 *
 * @param attackSpeedTicks - Defender's weapon attack speed in ticks
 */
export function calculateRetaliationDelay(attackSpeedTicks: number): number {
  return Math.ceil(attackSpeedTicks / 2) + 1;
}

/**
 * Convert milliseconds to game ticks
 * PURE FUNCTION
 */
export function msToTicks(ms: number, tickDuration: number = 600): number {
  return Math.max(1, Math.round(ms / tickDuration));
}

// =============================================================================
// MOCK COMBAT MANAGER
// =============================================================================

/**
 * Mock Combat Manager for testing combat scenarios
 *
 * Tracks combat states and provides methods for simulating
 * combat without requiring the full game infrastructure.
 */
export class MockCombatManager {
  private combatStates = new Map<string, MockCombatState>();
  private currentTick = 0;

  /**
   * Set the current game tick (for testing time-based mechanics)
   */
  setCurrentTick(tick: number): this {
    expectValidTick(tick, "tick");
    this.currentTick = tick;
    return this;
  }

  /**
   * Get current tick
   */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Advance time by N ticks
   */
  advanceTicks(ticks: number): this {
    this.currentTick += ticks;
    return this;
  }

  /**
   * Start combat between two entities
   */
  startCombat(
    attackerId: string,
    targetId: string,
    attackerType: "player" | "mob" = "player",
    targetType: "player" | "mob" = "mob",
    weaponType: AttackType = AttackType.MELEE,
    attackSpeedTicks: number = 4
  ): MockCombatState {
    const state: MockCombatState = {
      attackerId,
      targetId,
      attackerType,
      targetType,
      weaponType,
      inCombat: true,
      lastAttackTick: this.currentTick,
      nextAttackTick: this.currentTick + attackSpeedTicks,
      combatEndTick: this.currentTick + 8, // 8 ticks timeout
      attackSpeedTicks,
    };

    this.combatStates.set(attackerId, state);
    return state;
  }

  /**
   * Get combat state for an entity
   */
  getCombatState(entityId: string): MockCombatState | undefined {
    return this.combatStates.get(entityId);
  }

  /**
   * Check if entity can attack now
   */
  canAttack(entityId: string): boolean {
    const state = this.combatStates.get(entityId);
    if (!state) return true; // Not in combat, can start attacking

    return !isAttackOnCooldown(this.currentTick, state.nextAttackTick);
  }

  /**
   * Process an attack (update state)
   */
  processAttack(
    attackerId: string,
    attackSpeedTicks: number = 4
  ): { success: boolean; nextAttackTick: number } {
    const state = this.combatStates.get(attackerId);
    if (!state) {
      return { success: false, nextAttackTick: 0 };
    }

    if (!this.canAttack(attackerId)) {
      return { success: false, nextAttackTick: state.nextAttackTick };
    }

    // Update attack timing
    state.lastAttackTick = this.currentTick;
    state.nextAttackTick = this.currentTick + attackSpeedTicks;
    state.combatEndTick = this.currentTick + 8;

    return { success: true, nextAttackTick: state.nextAttackTick };
  }

  /**
   * End combat for an entity
   */
  endCombat(entityId: string): void {
    this.combatStates.delete(entityId);
  }

  /**
   * Clear all combat states (reset)
   */
  reset(): void {
    this.combatStates.clear();
    this.currentTick = 0;
  }

  /**
   * Get all active combat states
   */
  getAllCombatStates(): MockCombatState[] {
    return Array.from(this.combatStates.values());
  }

  /**
   * Check if any combats have timed out
   */
  getTimedOutCombats(): string[] {
    const timedOut: string[] = [];
    for (const [entityId, state] of this.combatStates) {
      if (this.currentTick >= state.combatEndTick) {
        timedOut.push(entityId);
      }
    }
    return timedOut;
  }
}

/**
 * Create a pre-configured combat scenario
 */
export function createCombatScenario(
  attackerStats: Partial<MockCombatStats> = {},
  targetStats: Partial<MockCombatStats> = {}
): {
  attacker: { stats: MockCombatStats };
  target: { stats: MockCombatStats };
  equipment: { attack: number; strength: number; defense: number; ranged: number };
} {
  return {
    attacker: {
      stats: { ...DEFAULT_COMBAT_STATS, ...attackerStats },
    },
    target: {
      stats: { ...DEFAULT_COMBAT_STATS, ...targetStats },
    },
    equipment: { attack: 0, strength: 0, defense: 0, ranged: 0 },
  };
}
