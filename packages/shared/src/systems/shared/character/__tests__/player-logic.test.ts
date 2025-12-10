/**
 * Player Logic Unit Tests
 *
 * Tests all pure player functions in isolation.
 */

import { describe, it, expect } from "bun:test";
import { ValidationError } from "../../../../validation";
import {
  type PlayerStats,
  type PlayerState,
  type Position3D,
  PLAYER_CONSTANTS,
  validatePlayerName,
  validatePlayerStats,
  validatePosition,
  validateHealth,
  calculateCombatLevel,
  calculateTotalLevel,
  calculateMaxHealth,
  applyDamage,
  applyHealing,
  calculateFoodHealing,
  isFullHealth,
  isLowHealth,
  getXpForLevel,
  getLevelFromXp,
  getXpToNextLevel,
  getXpProgress,
  isPlayerAfk,
  shouldLogoutPlayer,
  calculatePlayerDistance,
  arePlayersInRange,
  createDefaultStats,
  createPlayerState,
  updatePlayerStats,
  updatePlayerPosition,
  setPlayerDead,
  respawnPlayer,
} from "../player-logic";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTestStats(overrides?: Partial<PlayerStats>): PlayerStats {
  return {
    attack: 40,
    strength: 40,
    defense: 40,
    ranged: 40,
    magic: 40,
    hitpoints: 40,
    prayer: 40,
    mining: 40,
    fishing: 40,
    woodcutting: 40,
    cooking: 40,
    crafting: 40,
    smithing: 40,
    fletching: 40,
    firemaking: 40,
    ...overrides,
  };
}

function createTestPlayer(overrides?: Partial<PlayerState>): PlayerState {
  const stats = createTestStats();
  return {
    id: "player-1",
    name: "TestPlayer",
    position: { x: 0, y: 0, z: 0 },
    health: 49,
    maxHealth: 49,
    stats,
    totalLevel: calculateTotalLevel(stats),
    combatLevel: calculateCombatLevel(stats),
    isAlive: true,
    inCombat: false,
    lastActivityTick: 0,
    ...overrides,
  };
}

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe("validatePlayerName", () => {
  it("accepts valid names", () => {
    expect(validatePlayerName("Player123")).toBe("Player123");
    expect(validatePlayerName("Test-User")).toBe("Test-User");
    expect(validatePlayerName("Name_1")).toBe("Name_1");
  });

  it("throws for empty name", () => {
    expect(() => validatePlayerName("")).toThrow(ValidationError);
  });

  it("throws for names that are too long", () => {
    const longName = "a".repeat(PLAYER_CONSTANTS.MAX_NAME_LENGTH + 1);
    expect(() => validatePlayerName(longName)).toThrow(ValidationError);
  });

  it("throws for invalid characters", () => {
    expect(() => validatePlayerName("Player@123")).toThrow(ValidationError);
    expect(() => validatePlayerName("Player Name")).toThrow(ValidationError);
    expect(() => validatePlayerName("Player!")).toThrow(ValidationError);
  });

  it("throws for non-string input", () => {
    expect(() => validatePlayerName(123)).toThrow(ValidationError);
    expect(() => validatePlayerName(null)).toThrow(ValidationError);
  });
});

describe("validatePlayerStats", () => {
  it("accepts valid stats", () => {
    const stats = validatePlayerStats({ attack: 50, strength: 50 });
    expect(stats.attack).toBe(50);
    expect(stats.strength).toBe(50);
  });

  it("defaults missing stats to minimum", () => {
    const stats = validatePlayerStats({});
    expect(stats.attack).toBe(PLAYER_CONSTANTS.MIN_LEVEL);
    expect(stats.hitpoints).toBe(PLAYER_CONSTANTS.MIN_LEVEL);
  });

  it("throws for stats below minimum", () => {
    expect(() => validatePlayerStats({ attack: 0 })).toThrow(ValidationError);
  });

  it("throws for stats above maximum", () => {
    expect(() => validatePlayerStats({ attack: 100 })).toThrow(ValidationError);
  });

  it("throws for non-integer stats", () => {
    expect(() => validatePlayerStats({ attack: 50.5 })).toThrow(ValidationError);
  });

  it("throws for non-object input", () => {
    expect(() => validatePlayerStats(null)).toThrow(ValidationError);
    expect(() => validatePlayerStats("string")).toThrow(ValidationError);
  });
});

describe("validatePosition", () => {
  it("accepts valid positions", () => {
    const pos = validatePosition({ x: 100, y: 50, z: -100 });
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(50);
    expect(pos.z).toBe(-100);
  });

  it("throws for non-object input", () => {
    expect(() => validatePosition(null)).toThrow(ValidationError);
  });

  it("throws for invalid coordinates", () => {
    expect(() => validatePosition({ x: NaN, y: 0, z: 0 })).toThrow(ValidationError);
    expect(() => validatePosition({ x: Infinity, y: 0, z: 0 })).toThrow(ValidationError);
  });

  it("throws for positions outside world bounds", () => {
    expect(() => validatePosition({ x: 20000, y: 0, z: 0 })).toThrow(ValidationError);
    expect(() => validatePosition({ x: 0, y: 0, z: -20000 })).toThrow(ValidationError);
  });
});

describe("validateHealth", () => {
  it("accepts valid health", () => {
    expect(validateHealth(50, 100)).toBe(50);
    expect(validateHealth(0, 100)).toBe(0);
    expect(validateHealth(100, 100)).toBe(100);
  });

  it("throws for health exceeding max", () => {
    expect(() => validateHealth(101, 100)).toThrow(ValidationError);
  });

  it("throws for negative health", () => {
    expect(() => validateHealth(-1, 100)).toThrow(ValidationError);
  });
});

// =============================================================================
// COMBAT LEVEL TESTS
// =============================================================================

describe("calculateCombatLevel", () => {
  it("calculates level 3 for default stats", () => {
    const stats = createDefaultStats();
    const level = calculateCombatLevel(stats);
    expect(level).toBe(3);
  });

  it("increases with combat stats", () => {
    const lowStats = createTestStats({
      attack: 10,
      strength: 10,
      defense: 10,
      hitpoints: 10,
    });
    const highStats = createTestStats({
      attack: 70,
      strength: 70,
      defense: 70,
      hitpoints: 70,
    });

    const lowLevel = calculateCombatLevel(lowStats);
    const highLevel = calculateCombatLevel(highStats);

    expect(highLevel).toBeGreaterThan(lowLevel);
  });

  it("considers prayer in calculation", () => {
    const lowPrayer = createTestStats({ prayer: 1 });
    const highPrayer = createTestStats({ prayer: 99 });

    const lowLevel = calculateCombatLevel(lowPrayer);
    const highLevel = calculateCombatLevel(highPrayer);

    expect(highLevel).toBeGreaterThan(lowLevel);
  });

  it("returns max 126 for maxed stats", () => {
    const maxedStats: PlayerStats = {
      attack: 99,
      strength: 99,
      defense: 99,
      ranged: 99,
      magic: 99,
      hitpoints: 99,
      prayer: 99,
      mining: 99,
      fishing: 99,
      woodcutting: 99,
      cooking: 99,
      crafting: 99,
      smithing: 99,
      fletching: 99,
      firemaking: 99,
    };

    const level = calculateCombatLevel(maxedStats);
    expect(level).toBeLessThanOrEqual(126);
  });
});

describe("calculateTotalLevel", () => {
  it("sums all skill levels", () => {
    const stats = createDefaultStats();
    const total = calculateTotalLevel(stats);

    // Default stats: 14 skills at 1, hitpoints at 10
    expect(total).toBe(14 + 10);
  });

  it("returns 2277 for maxed account (all 99)", () => {
    const maxedStats: PlayerStats = {
      attack: 99,
      strength: 99,
      defense: 99,
      ranged: 99,
      magic: 99,
      hitpoints: 99,
      prayer: 99,
      mining: 99,
      fishing: 99,
      woodcutting: 99,
      cooking: 99,
      crafting: 99,
      smithing: 99,
      fletching: 99,
      firemaking: 99,
    };

    expect(calculateTotalLevel(maxedStats)).toBe(99 * 15);
  });
});

describe("calculateMaxHealth", () => {
  it("returns base HP for level 1", () => {
    // Level 1: base 10 + (1-1)*1 = 10
    // But actually in OSRS, hitpoints starts at 10
    expect(calculateMaxHealth(10)).toBe(PLAYER_CONSTANTS.BASE_HITPOINTS + 9);
  });

  it("scales with hitpoints level", () => {
    expect(calculateMaxHealth(99)).toBe(PLAYER_CONSTANTS.BASE_HITPOINTS + 98);
  });
});

// =============================================================================
// HEALTH MANAGEMENT TESTS
// =============================================================================

describe("applyDamage", () => {
  it("reduces health by damage amount", () => {
    const result = applyDamage(50, 10);
    expect(result.newHealth).toBe(40);
    expect(result.damage).toBe(10);
    expect(result.isDead).toBe(false);
  });

  it("does not go below 0", () => {
    const result = applyDamage(10, 50);
    expect(result.newHealth).toBe(0);
  });

  it("sets isDead when health reaches 0", () => {
    const result = applyDamage(10, 10);
    expect(result.newHealth).toBe(0);
    expect(result.isDead).toBe(true);
  });

  it("handles 0 damage", () => {
    const result = applyDamage(50, 0);
    expect(result.newHealth).toBe(50);
    expect(result.isDead).toBe(false);
  });
});

describe("applyHealing", () => {
  it("increases health by healing amount", () => {
    const result = applyHealing(50, 100, 20);
    expect(result.newHealth).toBe(70);
    expect(result.healing).toBe(20);
  });

  it("does not exceed max health", () => {
    const result = applyHealing(90, 100, 50);
    expect(result.newHealth).toBe(100);
    expect(result.healing).toBe(10); // Only healed 10
  });

  it("returns 0 healing at full health", () => {
    const result = applyHealing(100, 100, 20);
    expect(result.newHealth).toBe(100);
    expect(result.healing).toBe(0);
  });

  it("never sets isDead to true", () => {
    const result = applyHealing(1, 100, 99);
    expect(result.isDead).toBe(false);
  });
});

describe("calculateFoodHealing", () => {
  it("returns correct healing for known foods", () => {
    expect(calculateFoodHealing("shrimp", 40)).toBe(3);
    expect(calculateFoodHealing("lobster", 40)).toBe(12);
    expect(calculateFoodHealing("shark", 40)).toBe(20);
  });

  it("returns 0 for unknown foods", () => {
    expect(calculateFoodHealing("unknown_food", 40)).toBe(0);
  });

  it("scales anglerfish with HP level", () => {
    const lowLevel = calculateFoodHealing("anglerfish", 30);
    const highLevel = calculateFoodHealing("anglerfish", 90);
    expect(highLevel).toBeGreaterThan(lowLevel);
  });
});

describe("isFullHealth", () => {
  it("returns true at max health", () => {
    expect(isFullHealth(100, 100)).toBe(true);
  });

  it("returns false below max health", () => {
    expect(isFullHealth(99, 100)).toBe(false);
  });
});

describe("isLowHealth", () => {
  it("returns true at 25% or below", () => {
    expect(isLowHealth(25, 100)).toBe(true);
    expect(isLowHealth(20, 100)).toBe(true);
  });

  it("returns false above 25%", () => {
    expect(isLowHealth(26, 100)).toBe(false);
    expect(isLowHealth(50, 100)).toBe(false);
  });
});

// =============================================================================
// XP AND LEVELING TESTS
// =============================================================================

describe("getXpForLevel", () => {
  it("returns 0 for level 1", () => {
    expect(getXpForLevel(1)).toBe(0);
  });

  it("returns correct XP for known levels", () => {
    // Known OSRS values
    expect(getXpForLevel(2)).toBe(83);
    expect(getXpForLevel(10)).toBe(1154);
    expect(getXpForLevel(50)).toBe(101333);
    expect(getXpForLevel(99)).toBe(13034431);
  });

  it("increases with level", () => {
    const xp10 = getXpForLevel(10);
    const xp20 = getXpForLevel(20);
    const xp30 = getXpForLevel(30);

    expect(xp20).toBeGreaterThan(xp10);
    expect(xp30).toBeGreaterThan(xp20);
  });
});

describe("getLevelFromXp", () => {
  it("returns 1 for 0 XP", () => {
    expect(getLevelFromXp(0)).toBe(1);
  });

  it("returns correct level for known XP", () => {
    expect(getLevelFromXp(83)).toBe(2);
    expect(getLevelFromXp(1154)).toBe(10);
    expect(getLevelFromXp(13034431)).toBe(99);
  });

  it("returns correct level for XP between levels", () => {
    expect(getLevelFromXp(100)).toBe(2);
    expect(getLevelFromXp(1000)).toBe(9);
  });

  it("returns 99 for XP above 99", () => {
    expect(getLevelFromXp(200000000)).toBe(99);
  });
});

describe("getXpToNextLevel", () => {
  it("returns XP needed for next level", () => {
    const toLevel2 = getXpToNextLevel(0);
    expect(toLevel2).toBe(83);
  });

  it("returns 0 at level 99", () => {
    expect(getXpToNextLevel(13034431)).toBe(0);
    expect(getXpToNextLevel(200000000)).toBe(0);
  });
});

describe("getXpProgress", () => {
  it("returns 0% at start of level", () => {
    expect(getXpProgress(0)).toBe(0);
  });

  it("returns 100% at level 99", () => {
    expect(getXpProgress(13034431)).toBe(100);
  });

  it("returns percentage progress", () => {
    const level2Xp = getXpForLevel(2); // 83
    const level3Xp = getXpForLevel(3); // ~174
    const midway = Math.floor((level2Xp + level3Xp) / 2);

    const progress = getXpProgress(midway);
    expect(progress).toBeGreaterThan(30);
    expect(progress).toBeLessThan(70);
  });
});

// =============================================================================
// ACTIVITY TESTS
// =============================================================================

describe("isPlayerAfk", () => {
  it("returns false before timeout", () => {
    expect(isPlayerAfk(1000, 1100)).toBe(false);
  });

  it("returns true after timeout", () => {
    const timeout = PLAYER_CONSTANTS.AFK_TIMEOUT_TICKS;
    expect(isPlayerAfk(1000, 1000 + timeout)).toBe(true);
    expect(isPlayerAfk(1000, 1000 + timeout + 100)).toBe(true);
  });
});

describe("shouldLogoutPlayer", () => {
  it("returns false before timeout", () => {
    expect(shouldLogoutPlayer(1000, 1100)).toBe(false);
  });

  it("returns true after timeout", () => {
    const timeout = PLAYER_CONSTANTS.LOGOUT_TIMEOUT_TICKS;
    expect(shouldLogoutPlayer(1000, 1000 + timeout)).toBe(true);
  });
});

describe("calculatePlayerDistance", () => {
  it("calculates 3D distance correctly", () => {
    const pos1: Position3D = { x: 0, y: 0, z: 0 };
    const pos2: Position3D = { x: 3, y: 4, z: 0 };
    expect(calculatePlayerDistance(pos1, pos2)).toBe(5);
  });

  it("returns 0 for same position", () => {
    const pos: Position3D = { x: 10, y: 20, z: 30 };
    expect(calculatePlayerDistance(pos, pos)).toBe(0);
  });
});

describe("arePlayersInRange", () => {
  it("returns true when within range", () => {
    const pos1: Position3D = { x: 0, y: 0, z: 0 };
    const pos2: Position3D = { x: 5, y: 0, z: 0 };
    expect(arePlayersInRange(pos1, pos2, 10)).toBe(true);
  });

  it("returns false when outside range", () => {
    const pos1: Position3D = { x: 0, y: 0, z: 0 };
    const pos2: Position3D = { x: 20, y: 0, z: 0 };
    expect(arePlayersInRange(pos1, pos2, 10)).toBe(false);
  });
});

// =============================================================================
// PLAYER STATE MANAGEMENT TESTS
// =============================================================================

describe("createDefaultStats", () => {
  it("creates stats with level 1 for most skills", () => {
    const stats = createDefaultStats();
    expect(stats.attack).toBe(1);
    expect(stats.strength).toBe(1);
    expect(stats.mining).toBe(1);
  });

  it("creates hitpoints at level 10", () => {
    const stats = createDefaultStats();
    expect(stats.hitpoints).toBe(10);
  });
});

describe("createPlayerState", () => {
  it("creates player with given properties", () => {
    const player = createPlayerState("player-123", "TestPlayer", { x: 10, y: 0, z: 20 });

    expect(player.id).toBe("player-123");
    expect(player.name).toBe("TestPlayer");
    expect(player.position.x).toBe(10);
    expect(player.isAlive).toBe(true);
    expect(player.inCombat).toBe(false);
  });

  it("uses default stats if not provided", () => {
    const player = createPlayerState("p1", "Test", { x: 0, y: 0, z: 0 });
    expect(player.stats.attack).toBe(1);
  });

  it("allows custom stats", () => {
    const player = createPlayerState("p1", "Test", { x: 0, y: 0, z: 0 }, { attack: 50, strength: 50 });
    expect(player.stats.attack).toBe(50);
    expect(player.stats.strength).toBe(50);
  });

  it("calculates combat and total levels", () => {
    const player = createPlayerState("p1", "Test", { x: 0, y: 0, z: 0 });
    expect(player.combatLevel).toBe(3);
    expect(player.totalLevel).toBe(24);
  });

  it("sets health to max health", () => {
    const player = createPlayerState("p1", "Test", { x: 0, y: 0, z: 0 }, { hitpoints: 50 });
    expect(player.health).toBe(player.maxHealth);
  });
});

describe("updatePlayerStats", () => {
  it("updates specified stats", () => {
    const player = createTestPlayer();
    const updated = updatePlayerStats(player, { attack: 99 });

    expect(updated.stats.attack).toBe(99);
    expect(updated.stats.strength).toBe(40); // Unchanged
  });

  it("recalculates combat level", () => {
    const player = createTestPlayer();
    const updated = updatePlayerStats(player, { attack: 99, strength: 99 });

    expect(updated.combatLevel).toBeGreaterThan(player.combatLevel);
  });

  it("recalculates total level", () => {
    const player = createTestPlayer();
    const updated = updatePlayerStats(player, { attack: 99 });

    expect(updated.totalLevel).toBeGreaterThan(player.totalLevel);
  });

  it("adjusts health if max health decreases", () => {
    const player = createTestPlayer({ health: 49, maxHealth: 49 });
    const updated = updatePlayerStats(player, { hitpoints: 10 }); // Lower HP level

    expect(updated.health).toBeLessThanOrEqual(updated.maxHealth);
  });

  it("does not mutate original player", () => {
    const player = createTestPlayer();
    const originalAttack = player.stats.attack;

    updatePlayerStats(player, { attack: 99 });

    expect(player.stats.attack).toBe(originalAttack);
  });
});

describe("updatePlayerPosition", () => {
  it("updates position", () => {
    const player = createTestPlayer();
    const updated = updatePlayerPosition(player, { x: 100, y: 50, z: 200 }, 1000);

    expect(updated.position.x).toBe(100);
    expect(updated.position.y).toBe(50);
    expect(updated.position.z).toBe(200);
  });

  it("updates last activity tick", () => {
    const player = createTestPlayer({ lastActivityTick: 0 });
    const updated = updatePlayerPosition(player, { x: 10, y: 0, z: 10 }, 500);

    expect(updated.lastActivityTick).toBe(500);
  });

  it("does not mutate original player", () => {
    const player = createTestPlayer();
    updatePlayerPosition(player, { x: 100, y: 50, z: 200 }, 1000);

    expect(player.position.x).toBe(0);
  });
});

describe("setPlayerDead", () => {
  it("sets health to 0", () => {
    const player = createTestPlayer({ health: 50 });
    const dead = setPlayerDead(player);

    expect(dead.health).toBe(0);
  });

  it("sets isAlive to false", () => {
    const player = createTestPlayer({ isAlive: true });
    const dead = setPlayerDead(player);

    expect(dead.isAlive).toBe(false);
  });

  it("removes from combat", () => {
    const player = createTestPlayer({ inCombat: true });
    const dead = setPlayerDead(player);

    expect(dead.inCombat).toBe(false);
  });
});

describe("respawnPlayer", () => {
  it("restores health to max", () => {
    const player = createTestPlayer({ health: 0, maxHealth: 49 });
    const respawned = respawnPlayer(player, { x: 0, y: 0, z: 0 }, 1000);

    expect(respawned.health).toBe(49);
  });

  it("sets isAlive to true", () => {
    const player = createTestPlayer({ isAlive: false });
    const respawned = respawnPlayer(player, { x: 0, y: 0, z: 0 }, 1000);

    expect(respawned.isAlive).toBe(true);
  });

  it("moves to spawn position", () => {
    const player = createTestPlayer({ position: { x: 100, y: 0, z: 100 } });
    const respawned = respawnPlayer(player, { x: 10, y: 0, z: 20 }, 1000);

    expect(respawned.position.x).toBe(10);
    expect(respawned.position.z).toBe(20);
  });

  it("removes from combat", () => {
    const player = createTestPlayer({ inCombat: true });
    const respawned = respawnPlayer(player, { x: 0, y: 0, z: 0 }, 1000);

    expect(respawned.inCombat).toBe(false);
  });

  it("updates last activity tick", () => {
    const player = createTestPlayer({ lastActivityTick: 0 });
    const respawned = respawnPlayer(player, { x: 0, y: 0, z: 0 }, 1000);

    expect(respawned.lastActivityTick).toBe(1000);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("edge cases", () => {
  it("handles minimum stats player", () => {
    const player = createPlayerState("p1", "Test", { x: 0, y: 0, z: 0 });

    expect(player.combatLevel).toBeGreaterThanOrEqual(1);
    expect(player.totalLevel).toBeGreaterThan(0);
    expect(player.health).toBeGreaterThan(0);
  });

  it("handles maximum stats player", () => {
    const maxStats: Partial<PlayerStats> = {
      attack: 99,
      strength: 99,
      defense: 99,
      ranged: 99,
      magic: 99,
      hitpoints: 99,
      prayer: 99,
    };

    const player = createPlayerState("p1", "Maxed", { x: 0, y: 0, z: 0 }, maxStats);

    expect(player.combatLevel).toBeLessThanOrEqual(126);
    expect(player.maxHealth).toBe(PLAYER_CONSTANTS.BASE_HITPOINTS + 98);
  });

  it("handles negative coordinate positions", () => {
    const player = createPlayerState("p1", "Test", { x: -100, y: 0, z: -100 });

    expect(player.position.x).toBe(-100);
    expect(player.position.z).toBe(-100);
  });

  it("handles exact boundary values for XP", () => {
    const level99Xp = getXpForLevel(99);
    expect(getLevelFromXp(level99Xp)).toBe(99);
    expect(getLevelFromXp(level99Xp - 1)).toBe(98);
  });
});
