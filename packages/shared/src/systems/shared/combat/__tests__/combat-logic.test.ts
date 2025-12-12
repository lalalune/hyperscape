/**
 * Combat Logic Unit Tests
 *
 * Tests all pure combat functions in isolation.
 * Uses deterministic random values for reproducible tests.
 */

import { describe, it, expect } from "bun:test";
import { ValidationError } from "../../../../validation";
import {
  validateAttackRequest,
  validateCombatStats,
  calculateAttackRoll,
  calculateDefenseRoll,
  calculateHitChance,
  doesAttackHit,
  calculateMeleeMaxHit,
  calculateRangedMaxHit,
  rollDamage,
  calculateDamage,
  worldToTile,
  tilesAdjacent,
  distance3D,
  distance2D,
  isInMeleeRange,
  isInRangedRange,
  isInAttackRange,
  isOnCooldown,
  calculateNextAttackTick,
  calculateRetaliationDelay,
  msToTicks,
  ticksToMs,
  createCombatState,
  updateCombatStateAfterAttack,
  hasCombatTimedOut,
  canAttack,
  type CombatStats,
  type EquipmentBonuses,
} from "../combat-logic";
import { COMBAT_CONSTANTS } from "../../../../constants/CombatConstants";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const DEFAULT_STATS: CombatStats = {
  attack: 40,
  strength: 40,
  defense: 40,
  ranged: 40,
  magic: 40,
  hitpoints: 40,
};

const NOOB_STATS: CombatStats = {
  attack: 1,
  strength: 1,
  defense: 1,
  ranged: 1,
  magic: 1,
  hitpoints: 10,
};

const HIGH_STATS: CombatStats = {
  attack: 99,
  strength: 99,
  defense: 99,
  ranged: 99,
  magic: 99,
  hitpoints: 99,
};

const DEFAULT_BONUSES: EquipmentBonuses = {
  attackBonus: 20,
  strengthBonus: 15,
  defenseBonus: 10,
  rangedBonus: 20,
  magicBonus: 5,
};

const NO_BONUSES: EquipmentBonuses = {
  attackBonus: 0,
  strengthBonus: 0,
  defenseBonus: 0,
  rangedBonus: 0,
  magicBonus: 0,
};

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe("validateAttackRequest", () => {
  it("validates correct input", () => {
    const result = validateAttackRequest("player-1", "mob-123", "melee");
    expect(result.attackerId).toBe("player-1");
    expect(result.targetId).toBe("mob-123");
    expect(result.attackType).toBe("melee");
  });

  it("defaults attack type to melee", () => {
    const result = validateAttackRequest("player-1", "mob-123");
    expect(result.attackType).toBe("melee");
  });

  it("accepts ranged and magic attack types", () => {
    expect(validateAttackRequest("p1", "m1", "ranged").attackType).toBe(
      "ranged",
    );
    expect(validateAttackRequest("p1", "m1", "magic").attackType).toBe("magic");
  });

  it("throws for invalid attack type", () => {
    expect(() => validateAttackRequest("p1", "m1", "invalid")).toThrow(
      ValidationError,
    );
  });

  it("throws for empty attackerId", () => {
    expect(() => validateAttackRequest("", "mob-123")).toThrow(ValidationError);
  });

  it("throws for empty targetId", () => {
    expect(() => validateAttackRequest("player-1", "")).toThrow(
      ValidationError,
    );
  });
});

describe("validateCombatStats", () => {
  it("validates correct stats", () => {
    const stats = validateCombatStats({
      attack: 50,
      strength: 50,
      defense: 50,
    });
    expect(stats.attack).toBe(50);
    expect(stats.strength).toBe(50);
    expect(stats.defense).toBe(50);
  });

  it("defaults missing stats to minimum values", () => {
    const stats = validateCombatStats({});
    expect(stats.attack).toBe(1);
    expect(stats.strength).toBe(1);
    expect(stats.defense).toBe(1);
    expect(stats.hitpoints).toBe(10);
  });

  it("throws for non-object input", () => {
    expect(() => validateCombatStats(null)).toThrow(ValidationError);
    expect(() => validateCombatStats("string")).toThrow(ValidationError);
  });

  it("throws for negative stats", () => {
    expect(() => validateCombatStats({ attack: -1 })).toThrow(ValidationError);
  });

  it("throws for non-integer stats", () => {
    expect(() => validateCombatStats({ attack: 5.5 })).toThrow(ValidationError);
  });
});

// =============================================================================
// ACCURACY CALCULATION TESTS
// =============================================================================

describe("calculateAttackRoll", () => {
  it("calculates base attack roll", () => {
    // effectiveLevel = 40 + 8 = 48
    // attackRoll = 48 * (0 + 64) = 3072
    const roll = calculateAttackRoll(40, 0, 0);
    expect(roll).toBe(3072);
  });

  it("applies equipment bonus correctly", () => {
    // effectiveLevel = 40 + 8 = 48
    // attackRoll = 48 * (20 + 64) = 4032
    const roll = calculateAttackRoll(40, 20, 0);
    expect(roll).toBe(4032);
  });

  it("applies style bonus correctly", () => {
    // effectiveLevel = 40 + 8 + 3 = 51
    // attackRoll = 51 * (0 + 64) = 3264
    const roll = calculateAttackRoll(40, 0, 3);
    expect(roll).toBe(3264);
  });

  it("scales with level", () => {
    const lowRoll = calculateAttackRoll(1, 0, 0);
    const highRoll = calculateAttackRoll(99, 0, 0);
    expect(highRoll).toBeGreaterThan(lowRoll);
  });
});

describe("calculateDefenseRoll", () => {
  it("calculates base defense roll", () => {
    // effectiveLevel = 40 + 9 = 49
    // defenseRoll = 49 * (0 + 64) = 3136
    const roll = calculateDefenseRoll(40, 0, 0);
    expect(roll).toBe(3136);
  });

  it("applies equipment bonus correctly", () => {
    // effectiveLevel = 40 + 9 = 49
    // defenseRoll = 49 * (50 + 64) = 5586
    const roll = calculateDefenseRoll(40, 50, 0);
    expect(roll).toBe(5586);
  });
});

describe("calculateHitChance", () => {
  it("returns higher hit chance when attack > defense", () => {
    const hitChance = calculateHitChance(5000, 2000);
    expect(hitChance).toBeGreaterThan(0.5);
    expect(hitChance).toBeLessThan(1);
  });

  it("returns lower hit chance when defense > attack", () => {
    const hitChance = calculateHitChance(2000, 5000);
    expect(hitChance).toBeGreaterThan(0);
    expect(hitChance).toBeLessThan(0.5);
  });

  it("returns about 50% for equal rolls", () => {
    const hitChance = calculateHitChance(3000, 3000);
    expect(hitChance).toBeGreaterThan(0.4);
    expect(hitChance).toBeLessThan(0.6);
  });

  it("never returns negative or > 1", () => {
    const hitChance1 = calculateHitChance(10000, 100);
    const hitChance2 = calculateHitChance(100, 10000);
    expect(hitChance1).toBeGreaterThanOrEqual(0);
    expect(hitChance1).toBeLessThanOrEqual(1);
    expect(hitChance2).toBeGreaterThanOrEqual(0);
    expect(hitChance2).toBeLessThanOrEqual(1);
  });
});

describe("doesAttackHit", () => {
  it("hits when random < hitChance", () => {
    expect(doesAttackHit(0.5, 0.3)).toBe(true);
  });

  it("misses when random >= hitChance", () => {
    expect(doesAttackHit(0.5, 0.5)).toBe(false);
    expect(doesAttackHit(0.5, 0.8)).toBe(false);
  });

  it("always hits with 100% chance", () => {
    expect(doesAttackHit(1.0, 0.0)).toBe(true);
    expect(doesAttackHit(1.0, 0.99)).toBe(true);
  });

  it("never hits with 0% chance", () => {
    expect(doesAttackHit(0.0, 0.0)).toBe(false);
    expect(doesAttackHit(0.0, 0.5)).toBe(false);
  });
});

// =============================================================================
// MAX HIT CALCULATION TESTS
// =============================================================================

describe("calculateMeleeMaxHit", () => {
  it("calculates base max hit", () => {
    // effectiveStrength = 40 + 8 = 48
    // maxHit = floor(0.5 + 48 * 64 / 640) = floor(0.5 + 4.8) = 5
    const maxHit = calculateMeleeMaxHit(40, 0, 0);
    expect(maxHit).toBe(5);
  });

  it("applies strength bonus", () => {
    // effectiveStrength = 40 + 8 = 48
    // maxHit = floor(0.5 + 48 * (50 + 64) / 640) = floor(0.5 + 8.55) = 9
    const maxHit = calculateMeleeMaxHit(40, 50, 0);
    expect(maxHit).toBe(9);
  });

  it("returns at least 1 for very low stats", () => {
    const maxHit = calculateMeleeMaxHit(1, 0, 0);
    expect(maxHit).toBeGreaterThanOrEqual(1);
  });

  it("scales with strength level", () => {
    const lowHit = calculateMeleeMaxHit(1, 20, 0);
    const highHit = calculateMeleeMaxHit(99, 20, 0);
    expect(highHit).toBeGreaterThan(lowHit);
  });
});

describe("calculateRangedMaxHit", () => {
  it("calculates base ranged max hit", () => {
    const maxHit = calculateRangedMaxHit(40, 0, 0);
    expect(maxHit).toBeGreaterThanOrEqual(1);
  });

  it("applies ranged bonus", () => {
    const maxHitNoBonus = calculateRangedMaxHit(40, 0, 0);
    const maxHitWithBonus = calculateRangedMaxHit(40, 50, 0);
    expect(maxHitWithBonus).toBeGreaterThan(maxHitNoBonus);
  });
});

describe("rollDamage", () => {
  it("returns 0 at low end of roll", () => {
    expect(rollDamage(10, 0.0)).toBe(0);
  });

  it("returns maxHit at high end of roll", () => {
    expect(rollDamage(10, 0.99)).toBe(10);
  });

  it("returns values in range [0, maxHit]", () => {
    for (let i = 0; i < 10; i++) {
      const randomValue = i / 10;
      const damage = rollDamage(10, randomValue);
      expect(damage).toBeGreaterThanOrEqual(0);
      expect(damage).toBeLessThanOrEqual(10);
    }
  });
});

// =============================================================================
// COMPLETE DAMAGE CALCULATION TESTS
// =============================================================================

describe("calculateDamage", () => {
  it("calculates damage for melee attack", () => {
    const result = calculateDamage(
      DEFAULT_STATS,
      DEFAULT_STATS,
      "melee",
      DEFAULT_BONUSES,
      DEFAULT_BONUSES,
      0.1, // Guaranteed hit
      0.5, // Mid-range damage
    );

    expect(result.didHit).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
    expect(result.maxHit).toBeGreaterThan(0);
    expect(result.hitChance).toBeGreaterThan(0);
    expect(result.hitChance).toBeLessThan(1);
  });

  it("calculates damage for ranged attack", () => {
    const result = calculateDamage(
      DEFAULT_STATS,
      DEFAULT_STATS,
      "ranged",
      DEFAULT_BONUSES,
      DEFAULT_BONUSES,
      0.1,
      0.5,
    );

    expect(result.didHit).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
  });

  it("calculates damage for magic attack", () => {
    const result = calculateDamage(
      DEFAULT_STATS,
      DEFAULT_STATS,
      "magic",
      DEFAULT_BONUSES,
      DEFAULT_BONUSES,
      0.1,
      0.5,
    );

    expect(result.didHit).toBe(true);
    expect(result.maxHit).toBeGreaterThan(0);
  });

  it("returns 0 damage on miss", () => {
    const result = calculateDamage(
      NOOB_STATS,
      HIGH_STATS,
      "melee",
      NO_BONUSES,
      DEFAULT_BONUSES,
      0.99, // Miss
      0.5,
    );

    expect(result.didHit).toBe(false);
    expect(result.damage).toBe(0);
  });

  it("high stats vs low stats hits more often", () => {
    const goodResult = calculateDamage(
      HIGH_STATS,
      NOOB_STATS,
      "melee",
      DEFAULT_BONUSES,
      NO_BONUSES,
      0.5,
      0.5,
    );

    const badResult = calculateDamage(
      NOOB_STATS,
      HIGH_STATS,
      "melee",
      NO_BONUSES,
      DEFAULT_BONUSES,
      0.5,
      0.5,
    );

    expect(goodResult.hitChance).toBeGreaterThan(badResult.hitChance);
  });
});

// =============================================================================
// RANGE CHECK TESTS
// =============================================================================

describe("worldToTile", () => {
  it("converts world coords to tile coords", () => {
    const tile = worldToTile(5.5, 10.8, 1);
    expect(tile.tileX).toBe(5);
    expect(tile.tileZ).toBe(10);
  });

  it("respects custom tile size", () => {
    const tile = worldToTile(10, 10, 2);
    expect(tile.tileX).toBe(5);
    expect(tile.tileZ).toBe(5);
  });

  it("handles negative coordinates", () => {
    const tile = worldToTile(-5.5, -10.8, 1);
    expect(tile.tileX).toBe(-6);
    expect(tile.tileZ).toBe(-11);
  });
});

describe("tilesAdjacent", () => {
  it("returns true for same tile", () => {
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 5, tileZ: 5 })).toBe(
      true,
    );
  });

  it("returns true for horizontally adjacent tiles", () => {
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 6, tileZ: 5 })).toBe(
      true,
    );
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 4, tileZ: 5 })).toBe(
      true,
    );
  });

  it("returns true for vertically adjacent tiles", () => {
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 5, tileZ: 6 })).toBe(
      true,
    );
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 5, tileZ: 4 })).toBe(
      true,
    );
  });

  it("returns true for diagonally adjacent tiles", () => {
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 6, tileZ: 6 })).toBe(
      true,
    );
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 4, tileZ: 4 })).toBe(
      true,
    );
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 6, tileZ: 4 })).toBe(
      true,
    );
  });

  it("returns false for non-adjacent tiles", () => {
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 7, tileZ: 5 })).toBe(
      false,
    );
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 5, tileZ: 7 })).toBe(
      false,
    );
    expect(tilesAdjacent({ tileX: 5, tileZ: 5 }, { tileX: 7, tileZ: 7 })).toBe(
      false,
    );
  });
});

describe("distance3D", () => {
  it("calculates distance correctly", () => {
    const pos1 = { x: 0, y: 0, z: 0 };
    const pos2 = { x: 3, y: 4, z: 0 };
    expect(distance3D(pos1, pos2)).toBe(5); // 3-4-5 triangle
  });

  it("returns 0 for same position", () => {
    const pos = { x: 10, y: 20, z: 30 };
    expect(distance3D(pos, pos)).toBe(0);
  });

  it("includes Y axis in calculation", () => {
    const pos1 = { x: 0, y: 0, z: 0 };
    const pos2 = { x: 0, y: 10, z: 0 };
    expect(distance3D(pos1, pos2)).toBe(10);
  });
});

describe("distance2D", () => {
  it("calculates 2D distance correctly", () => {
    const pos1 = { x: 0, z: 0 };
    const pos2 = { x: 3, z: 4 };
    expect(distance2D(pos1, pos2)).toBe(5);
  });

  it("ignores Y axis", () => {
    const pos1 = { x: 0, y: 0, z: 0 };
    const pos2 = { x: 3, y: 100, z: 4 };
    expect(distance2D(pos1, pos2)).toBe(5);
  });
});

describe("isInMeleeRange", () => {
  it("returns true for adjacent positions", () => {
    const attacker = { x: 5.5, y: 0, z: 5.5 };
    const target = { x: 6.5, y: 0, z: 5.5 };
    expect(isInMeleeRange(attacker, target)).toBe(true);
  });

  it("returns true for same position", () => {
    const pos = { x: 5.5, y: 0, z: 5.5 };
    expect(isInMeleeRange(pos, pos)).toBe(true);
  });

  it("returns false for distant positions", () => {
    const attacker = { x: 0, y: 0, z: 0 };
    const target = { x: 10, y: 0, z: 10 };
    expect(isInMeleeRange(attacker, target)).toBe(false);
  });
});

describe("isInRangedRange", () => {
  it("returns true within range", () => {
    const attacker = { x: 0, y: 0, z: 0 };
    const target = { x: 5, y: 0, z: 0 };
    expect(isInRangedRange(attacker, target, 10)).toBe(true);
  });

  it("returns false outside range", () => {
    const attacker = { x: 0, y: 0, z: 0 };
    const target = { x: 15, y: 0, z: 0 };
    expect(isInRangedRange(attacker, target, 10)).toBe(false);
  });

  it("returns true at exact range", () => {
    const attacker = { x: 0, y: 0, z: 0 };
    const target = { x: 10, y: 0, z: 0 };
    expect(isInRangedRange(attacker, target, 10)).toBe(true);
  });
});

describe("isInAttackRange", () => {
  it("uses melee range for melee attacks", () => {
    const attacker = { x: 5, y: 0, z: 5 };
    const adjacentTarget = { x: 6, y: 0, z: 5 };
    const distantTarget = { x: 10, y: 0, z: 5 };

    expect(isInAttackRange(attacker, adjacentTarget, "melee")).toBe(true);
    expect(isInAttackRange(attacker, distantTarget, "melee")).toBe(false);
  });

  it("uses ranged range for ranged attacks", () => {
    const attacker = { x: 0, y: 0, z: 0 };
    const target = { x: 5, y: 0, z: 0 };

    expect(isInAttackRange(attacker, target, "ranged")).toBe(true);
    expect(isInAttackRange(attacker, target, "magic")).toBe(true);
  });
});

// =============================================================================
// COOLDOWN TESTS
// =============================================================================

describe("isOnCooldown", () => {
  it("returns true when current tick < next attack tick", () => {
    expect(isOnCooldown(100, 105)).toBe(true);
  });

  it("returns false when current tick >= next attack tick", () => {
    expect(isOnCooldown(100, 100)).toBe(false);
    expect(isOnCooldown(100, 95)).toBe(false);
  });
});

describe("calculateNextAttackTick", () => {
  it("adds attack speed to current tick", () => {
    expect(calculateNextAttackTick(100, 4)).toBe(104);
    expect(calculateNextAttackTick(0, 6)).toBe(6);
  });
});

describe("calculateRetaliationDelay", () => {
  it("uses OSRS formula", () => {
    // ceil(4/2) + 1 = 3
    expect(calculateRetaliationDelay(4)).toBe(3);
    // ceil(5/2) + 1 = 4
    expect(calculateRetaliationDelay(5)).toBe(4);
    // ceil(6/2) + 1 = 4
    expect(calculateRetaliationDelay(6)).toBe(4);
  });
});

describe("msToTicks", () => {
  it("converts milliseconds to ticks", () => {
    // Assuming 600ms ticks
    expect(msToTicks(600, 600)).toBe(1);
    expect(msToTicks(1200, 600)).toBe(2);
    expect(msToTicks(900, 600)).toBe(2); // Rounds
  });

  it("returns at least 1 tick", () => {
    expect(msToTicks(0, 600)).toBe(1);
    expect(msToTicks(100, 600)).toBe(1);
  });
});

describe("ticksToMs", () => {
  it("converts ticks to milliseconds", () => {
    expect(ticksToMs(1, 600)).toBe(600);
    expect(ticksToMs(4, 600)).toBe(2400);
  });
});

// =============================================================================
// COMBAT STATE TESTS
// =============================================================================

describe("createCombatState", () => {
  it("creates initial combat state", () => {
    const state = createCombatState(
      "player-1",
      "mob-123",
      "player",
      "mob",
      "melee",
      100,
      4,
    );

    expect(state.attackerId).toBe("player-1");
    expect(state.targetId).toBe("mob-123");
    expect(state.attackerType).toBe("player");
    expect(state.targetType).toBe("mob");
    expect(state.attackType).toBe("melee");
    expect(state.inCombat).toBe(true);
    expect(state.lastAttackTick).toBe(100);
    expect(state.nextAttackTick).toBe(104);
    expect(state.attackSpeedTicks).toBe(4);
  });
});

describe("updateCombatStateAfterAttack", () => {
  it("updates ticks correctly", () => {
    const initialState = createCombatState(
      "p1",
      "m1",
      "player",
      "mob",
      "melee",
      100,
      4,
    );

    const updatedState = updateCombatStateAfterAttack(initialState, 104);

    expect(updatedState.lastAttackTick).toBe(104);
    expect(updatedState.nextAttackTick).toBe(108);
  });

  it("preserves other state properties", () => {
    const initialState = createCombatState(
      "p1",
      "m1",
      "player",
      "mob",
      "melee",
      100,
      4,
    );

    const updatedState = updateCombatStateAfterAttack(initialState, 104);

    expect(updatedState.attackerId).toBe("p1");
    expect(updatedState.attackType).toBe("melee");
  });
});

describe("hasCombatTimedOut", () => {
  it("returns false when combat is active", () => {
    const state = createCombatState(
      "p1",
      "m1",
      "player",
      "mob",
      "melee",
      100,
      4,
    );

    expect(hasCombatTimedOut(state, 100)).toBe(false);
    expect(hasCombatTimedOut(state, 105)).toBe(false);
  });

  it("returns true when combat has timed out", () => {
    const state = createCombatState("p1", "m1", "player", "mob", "melee", 0, 4);

    expect(hasCombatTimedOut(state, state.combatEndTick)).toBe(true);
    expect(hasCombatTimedOut(state, state.combatEndTick + 100)).toBe(true);
  });
});

describe("canAttack", () => {
  it("returns false during cooldown", () => {
    const state = createCombatState(
      "p1",
      "m1",
      "player",
      "mob",
      "melee",
      100,
      4,
    );

    expect(canAttack(state, 100)).toBe(false);
    expect(canAttack(state, 103)).toBe(false);
  });

  it("returns true when cooldown is over", () => {
    const state = createCombatState(
      "p1",
      "m1",
      "player",
      "mob",
      "melee",
      100,
      4,
    );

    expect(canAttack(state, 104)).toBe(true);
    expect(canAttack(state, 110)).toBe(true);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("edge cases", () => {
  it("handles zero stats gracefully", () => {
    const zeroStats: CombatStats = {
      attack: 0,
      strength: 0,
      defense: 0,
      ranged: 0,
      magic: 0,
      hitpoints: 0,
    };

    const result = calculateDamage(
      zeroStats,
      zeroStats,
      "melee",
      NO_BONUSES,
      NO_BONUSES,
      0.1,
      0.5,
    );

    expect(result.maxHit).toBeGreaterThanOrEqual(1);
  });

  it("handles very high stats", () => {
    const result = calculateDamage(
      HIGH_STATS,
      HIGH_STATS,
      "melee",
      {
        attackBonus: 100,
        strengthBonus: 100,
        defenseBonus: 100,
        rangedBonus: 100,
        magicBonus: 100,
      },
      {
        attackBonus: 100,
        strengthBonus: 100,
        defenseBonus: 100,
        rangedBonus: 100,
        magicBonus: 100,
      },
      0.1,
      0.5,
    );

    expect(result.maxHit).toBeGreaterThan(10);
  });

  it("handles negative coordinates", () => {
    const attacker = { x: -5, y: 0, z: -5 };
    const target = { x: -4, y: 0, z: -5 };
    expect(isInMeleeRange(attacker, target)).toBe(true);
  });
});
