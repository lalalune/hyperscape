/**
 * Combat Pure Logic Module
 *
 * PURE FUNCTIONS for combat calculations.
 * No side effects, no system dependencies, fully unit testable.
 *
 * OSRS-accurate formulas for:
 * - Accuracy calculations
 * - Max hit calculations
 * - Damage rolls
 * - Range checks
 * - Cooldown management
 */

import {
  ValidationError,
  assertPlayerId,
  assertEntityId,
  assertNonNegativeInteger,
  assertNumber,
  assertPosition,
} from "../../../validation";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";

// =============================================================================
// TYPES
// =============================================================================

export type AttackTypeName = "melee" | "ranged" | "magic";

export interface CombatStats {
  attack: number;
  strength: number;
  defense: number;
  ranged: number;
  magic: number;
  hitpoints: number;
}

export interface EquipmentBonuses {
  attackBonus: number;
  strengthBonus: number;
  defenseBonus: number;
  rangedBonus: number;
  magicBonus: number;
}

export interface DamageResult {
  damage: number;
  didHit: boolean;
  maxHit: number;
  hitChance: number;
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface CombatState {
  attackerId: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  attackType: AttackTypeName;
  inCombat: boolean;
  lastAttackTick: number;
  nextAttackTick: number;
  combatEndTick: number;
  attackSpeedTicks: number;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate an attack request
 * @throws ValidationError if invalid
 */
export function validateAttackRequest(
  attackerId: unknown,
  targetId: unknown,
  attackType?: unknown,
): { attackerId: string; targetId: string; attackType: AttackTypeName } {
  assertPlayerId(attackerId, "attackerId");
  assertEntityId(targetId, "targetId");

  let validatedAttackType: AttackTypeName = "melee";
  if (attackType !== undefined) {
    if (
      attackType !== "melee" &&
      attackType !== "ranged" &&
      attackType !== "magic"
    ) {
      throw new ValidationError(
        "must be melee, ranged, or magic",
        "attackType",
        attackType,
      );
    }
    validatedAttackType = attackType as AttackTypeName;
  }

  return {
    attackerId: attackerId as string,
    targetId: targetId as string,
    attackType: validatedAttackType,
  };
}

/**
 * Validate combat stats
 * @throws ValidationError if invalid
 */
export function validateCombatStats(
  stats: unknown,
  field: string = "stats",
): CombatStats {
  if (typeof stats !== "object" || stats === null) {
    throw new ValidationError("must be an object", field, stats);
  }

  const s = stats as Record<string, unknown>;

  // All stats default to 1 if not provided, but must be valid if provided
  const attack = s.attack ?? 1;
  const strength = s.strength ?? 1;
  const defense = s.defense ?? 1;
  const ranged = s.ranged ?? 1;
  const magic = s.magic ?? 1;
  const hitpoints = s.hitpoints ?? 10;

  assertNonNegativeInteger(attack, `${field}.attack`);
  assertNonNegativeInteger(strength, `${field}.strength`);
  assertNonNegativeInteger(defense, `${field}.defense`);
  assertNonNegativeInteger(ranged, `${field}.ranged`);
  assertNonNegativeInteger(magic, `${field}.magic`);
  assertNonNegativeInteger(hitpoints, `${field}.hitpoints`);

  return {
    attack: attack as number,
    strength: strength as number,
    defense: defense as number,
    ranged: ranged as number,
    magic: magic as number,
    hitpoints: hitpoints as number,
  };
}

// =============================================================================
// ACCURACY CALCULATIONS (OSRS Formula)
// =============================================================================

/**
 * Calculate OSRS-style attack roll
 *
 * OSRS Formula: attackRoll = effectiveLevel * (equipmentBonus + 64)
 * where effectiveLevel = level + 8 (base) + style bonus
 *
 * @param attackLevel - Player's attack/ranged level
 * @param equipmentBonus - Weapon's attack bonus
 * @param styleBonus - Combat style bonus (0-3)
 */
export function calculateAttackRoll(
  attackLevel: number,
  equipmentBonus: number,
  styleBonus: number = 0,
): number {
  const effectiveLevel = attackLevel + 8 + styleBonus;
  return effectiveLevel * (equipmentBonus + 64);
}

/**
 * Calculate OSRS-style defense roll
 *
 * @param defenseLevel - Target's defense level
 * @param equipmentBonus - Target's defense bonus
 * @param styleBonus - Combat style bonus (0-3)
 */
export function calculateDefenseRoll(
  defenseLevel: number,
  equipmentBonus: number,
  styleBonus: number = 0,
): number {
  const effectiveLevel = defenseLevel + 9 + styleBonus;
  return effectiveLevel * (equipmentBonus + 64);
}

/**
 * Calculate hit chance based on attack and defense rolls
 *
 * OSRS Formula:
 * If attackRoll > defenseRoll: hitChance = 1 - (defenseRoll + 2) / (2 * (attackRoll + 1))
 * Else: hitChance = attackRoll / (2 * (defenseRoll + 1))
 *
 * @returns Hit chance as decimal 0-1
 */
export function calculateHitChance(
  attackRoll: number,
  defenseRoll: number,
): number {
  if (attackRoll > defenseRoll) {
    return 1 - (defenseRoll + 2) / (2 * (attackRoll + 1));
  }
  return attackRoll / (2 * (defenseRoll + 1));
}

/**
 * Determine if an attack hits based on hit chance
 *
 * PURE FUNCTION - pass random value for deterministic testing
 *
 * @param hitChance - Probability of hitting (0-1)
 * @param randomValue - Random value 0-1 (for testing, use Math.random() in production)
 */
export function doesAttackHit(hitChance: number, randomValue: number): boolean {
  return randomValue < hitChance;
}

// =============================================================================
// MAX HIT CALCULATIONS (OSRS Formula)
// =============================================================================

/**
 * Calculate melee max hit
 *
 * OSRS Formula: maxHit = floor(0.5 + effectiveStrength * (strengthBonus + 64) / 640)
 * where effectiveStrength = level + 8 + styleBonus
 *
 * @param strengthLevel - Player's strength level
 * @param strengthBonus - Weapon's strength bonus
 * @param styleBonus - Combat style bonus (0-3)
 */
export function calculateMeleeMaxHit(
  strengthLevel: number,
  strengthBonus: number,
  styleBonus: number = 0,
): number {
  const effectiveStrength = strengthLevel + 8 + styleBonus;
  const maxHit = Math.floor(
    0.5 + (effectiveStrength * (strengthBonus + 64)) / 640,
  );
  return Math.max(1, maxHit);
}

/**
 * Calculate ranged max hit
 *
 * @param rangedLevel - Player's ranged level
 * @param rangedBonus - Weapon's ranged strength bonus
 * @param styleBonus - Combat style bonus (0-3)
 */
export function calculateRangedMaxHit(
  rangedLevel: number,
  rangedBonus: number,
  styleBonus: number = 0,
): number {
  const effectiveRanged = rangedLevel + 8 + styleBonus;
  const maxHit = Math.floor(0.5 + (effectiveRanged * (rangedBonus + 64)) / 640);
  return Math.max(1, maxHit);
}

/**
 * Roll damage between 0 and maxHit (inclusive)
 *
 * PURE FUNCTION - pass random value for deterministic testing
 *
 * @param maxHit - Maximum damage
 * @param randomValue - Random value 0-1 (for testing)
 */
export function rollDamage(maxHit: number, randomValue: number): number {
  return Math.floor(randomValue * (maxHit + 1));
}

// =============================================================================
// COMPLETE DAMAGE CALCULATION
// =============================================================================

/**
 * Calculate complete damage for an attack
 *
 * PURE FUNCTION - all randomness passed in for testing
 *
 * @param attacker - Attacker's combat stats
 * @param target - Target's combat stats
 * @param attackType - Type of attack
 * @param attackerBonuses - Attacker's equipment bonuses
 * @param targetBonuses - Target's equipment bonuses
 * @param accuracyRoll - Random value for accuracy (0-1)
 * @param damageRoll - Random value for damage (0-1)
 */
export function calculateDamage(
  attacker: CombatStats,
  target: CombatStats,
  attackType: AttackTypeName,
  attackerBonuses: EquipmentBonuses,
  targetBonuses: EquipmentBonuses,
  accuracyRoll: number,
  damageRoll: number,
): DamageResult {
  let attackStat: number;
  let attackBonus: number;
  let maxHit: number;

  if (attackType === "melee") {
    attackStat = attacker.attack;
    attackBonus = attackerBonuses.attackBonus;
    maxHit = calculateMeleeMaxHit(
      attacker.strength,
      attackerBonuses.strengthBonus,
    );
  } else if (attackType === "ranged") {
    attackStat = attacker.ranged;
    attackBonus = attackerBonuses.rangedBonus;
    maxHit = calculateRangedMaxHit(
      attacker.ranged,
      attackerBonuses.rangedBonus,
    );
  } else {
    attackStat = attacker.magic;
    attackBonus = attackerBonuses.magicBonus;
    maxHit = Math.max(1, Math.floor(attacker.magic / 10)); // Simplified magic
  }

  const attackRollValue = calculateAttackRoll(attackStat, attackBonus);
  const defenseRollValue = calculateDefenseRoll(
    target.defense,
    targetBonuses.defenseBonus,
  );
  const hitChance = calculateHitChance(attackRollValue, defenseRollValue);

  if (!doesAttackHit(hitChance, accuracyRoll)) {
    return {
      damage: 0,
      didHit: false,
      maxHit,
      hitChance,
    };
  }

  const damage = rollDamage(maxHit, damageRoll);

  return {
    damage,
    didHit: true,
    maxHit,
    hitChance,
  };
}

// =============================================================================
// RANGE CHECKS
// =============================================================================

/**
 * Convert world position to tile coordinates
 */
export function worldToTile(
  worldX: number,
  worldZ: number,
  tileSize: number = 1,
): { tileX: number; tileZ: number } {
  return {
    tileX: Math.floor(worldX / tileSize),
    tileZ: Math.floor(worldZ / tileSize),
  };
}

/**
 * Check if two tiles are adjacent (Chebyshev distance = 1)
 *
 * OSRS uses Chebyshev distance (max of axis differences)
 * for melee range checks.
 */
export function tilesAdjacent(
  tile1: { tileX: number; tileZ: number },
  tile2: { tileX: number; tileZ: number },
): boolean {
  const dx = Math.abs(tile1.tileX - tile2.tileX);
  const dz = Math.abs(tile1.tileZ - tile2.tileZ);
  return Math.max(dx, dz) <= 1;
}

/**
 * Calculate 3D Euclidean distance
 */
export function distance3D(pos1: Position3D, pos2: Position3D): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate 2D distance (ignoring Y)
 */
export function distance2D(
  pos1: { x: number; z: number },
  pos2: { x: number; z: number },
): number {
  const dx = pos2.x - pos1.x;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Check if attacker is in melee range of target
 *
 * Uses tile-based adjacency (OSRS-style)
 */
export function isInMeleeRange(
  attackerPos: Position3D,
  targetPos: Position3D,
  tileSize: number = 1,
): boolean {
  const attackerTile = worldToTile(attackerPos.x, attackerPos.z, tileSize);
  const targetTile = worldToTile(targetPos.x, targetPos.z, tileSize);
  return tilesAdjacent(attackerTile, targetTile);
}

/**
 * Check if attacker is in ranged range of target
 */
export function isInRangedRange(
  attackerPos: Position3D,
  targetPos: Position3D,
  maxRange: number = COMBAT_CONSTANTS.RANGED_RANGE,
): boolean {
  return distance3D(attackerPos, targetPos) <= maxRange;
}

/**
 * Check if attack is in range based on attack type
 */
export function isInAttackRange(
  attackerPos: Position3D,
  targetPos: Position3D,
  attackType: AttackTypeName,
  tileSize: number = 1,
): boolean {
  if (attackType === "melee") {
    return isInMeleeRange(attackerPos, targetPos, tileSize);
  }
  return isInRangedRange(attackerPos, targetPos);
}

// =============================================================================
// COOLDOWN MANAGEMENT
// =============================================================================

/**
 * Check if attack is on cooldown
 *
 * @param currentTick - Current game tick
 * @param nextAttackTick - Tick when next attack is allowed
 */
export function isOnCooldown(
  currentTick: number,
  nextAttackTick: number,
): boolean {
  return currentTick < nextAttackTick;
}

/**
 * Calculate next attack tick after attacking
 *
 * @param currentTick - Current game tick
 * @param attackSpeedTicks - Weapon's attack speed in ticks
 */
export function calculateNextAttackTick(
  currentTick: number,
  attackSpeedTicks: number,
): number {
  return currentTick + attackSpeedTicks;
}

/**
 * Calculate retaliation delay (OSRS formula)
 *
 * When attacked, defender retaliates after ceil(attack_speed / 2) + 1 ticks
 *
 * @param attackSpeedTicks - Defender's weapon attack speed in ticks
 */
export function calculateRetaliationDelay(attackSpeedTicks: number): number {
  return Math.ceil(attackSpeedTicks / 2) + 1;
}

/**
 * Convert milliseconds to ticks
 */
export function msToTicks(
  ms: number,
  tickDuration: number = COMBAT_CONSTANTS.TICK_DURATION_MS,
): number {
  return Math.max(1, Math.round(ms / tickDuration));
}

/**
 * Convert ticks to milliseconds
 */
export function ticksToMs(
  ticks: number,
  tickDuration: number = COMBAT_CONSTANTS.TICK_DURATION_MS,
): number {
  return ticks * tickDuration;
}

// =============================================================================
// COMBAT STATE MANAGEMENT
// =============================================================================

/**
 * Create initial combat state
 */
export function createCombatState(
  attackerId: string,
  targetId: string,
  attackerType: "player" | "mob",
  targetType: "player" | "mob",
  attackType: AttackTypeName,
  currentTick: number,
  attackSpeedTicks: number,
): CombatState {
  return {
    attackerId,
    targetId,
    attackerType,
    targetType,
    attackType,
    inCombat: true,
    lastAttackTick: currentTick,
    nextAttackTick: currentTick + attackSpeedTicks,
    combatEndTick: currentTick + COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS,
    attackSpeedTicks,
  };
}

/**
 * Update combat state after an attack
 */
export function updateCombatStateAfterAttack(
  state: CombatState,
  currentTick: number,
): CombatState {
  return {
    ...state,
    lastAttackTick: currentTick,
    nextAttackTick: currentTick + state.attackSpeedTicks,
    combatEndTick: currentTick + COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS,
  };
}

/**
 * Check if combat has timed out
 */
export function hasCombatTimedOut(
  state: CombatState,
  currentTick: number,
): boolean {
  return currentTick >= state.combatEndTick;
}

/**
 * Check if entity can attack now
 */
export function canAttack(state: CombatState, currentTick: number): boolean {
  return !isOnCooldown(currentTick, state.nextAttackTick);
}
