/**
 * Player Pure Logic Module
 *
 * PURE FUNCTIONS for player operations.
 * No side effects, no system dependencies, fully unit testable.
 */

import {
  ValidationError,
  assertPlayerId,
  assertNonEmptyString,
  assertNonNegativeInteger,
  assertPositiveInteger,
  assertNumber,
  assertDefined,
} from "../../../validation";

// =============================================================================
// TYPES
// =============================================================================

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface PlayerStats {
  attack: number;
  strength: number;
  defense: number;
  ranged: number;
  magic: number;
  hitpoints: number;
  prayer: number;
  mining: number;
  fishing: number;
  woodcutting: number;
  cooking: number;
  crafting: number;
  smithing: number;
  fletching: number;
  firemaking: number;
}

export interface PlayerState {
  id: string;
  name: string;
  position: Position3D;
  health: number;
  maxHealth: number;
  stats: PlayerStats;
  totalLevel: number;
  combatLevel: number;
  isAlive: boolean;
  inCombat: boolean;
  lastActivityTick: number;
}

export interface HealthChange {
  newHealth: number;
  damage?: number;
  healing?: number;
  isDead: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const PLAYER_CONSTANTS = {
  // Stat limits
  MIN_LEVEL: 1,
  MAX_LEVEL: 99,

  // Health
  BASE_HITPOINTS: 10,
  HP_PER_LEVEL: 1,

  // Combat level calculation weights
  COMBAT_MELEE_WEIGHT: 0.325,
  COMBAT_RANGED_WEIGHT: 1.5,
  COMBAT_MAGIC_WEIGHT: 1.5,
  COMBAT_PRAYER_WEIGHT: 0.5,

  // Name constraints
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 12,
  NAME_PATTERN: /^[a-zA-Z0-9_-]+$/,

  // Activity timeout (in ticks)
  AFK_TIMEOUT_TICKS: 500,
  LOGOUT_TIMEOUT_TICKS: 1000,
} as const;

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate player name
 * @throws ValidationError if invalid
 */
export function validatePlayerName(
  name: unknown,
  field: string = "name"
): string {
  assertNonEmptyString(name, field);

  const nameStr = name as string;

  if (nameStr.length < PLAYER_CONSTANTS.MIN_NAME_LENGTH) {
    throw new ValidationError(
      `must be at least ${PLAYER_CONSTANTS.MIN_NAME_LENGTH} character`,
      field,
      name
    );
  }

  if (nameStr.length > PLAYER_CONSTANTS.MAX_NAME_LENGTH) {
    throw new ValidationError(
      `must be at most ${PLAYER_CONSTANTS.MAX_NAME_LENGTH} characters`,
      field,
      name
    );
  }

  if (!PLAYER_CONSTANTS.NAME_PATTERN.test(nameStr)) {
    throw new ValidationError(
      "can only contain letters, numbers, underscores and hyphens",
      field,
      name
    );
  }

  return nameStr;
}

/**
 * Validate player stats
 * @throws ValidationError if invalid
 */
export function validatePlayerStats(
  stats: unknown,
  field: string = "stats"
): PlayerStats {
  if (typeof stats !== "object" || stats === null) {
    throw new ValidationError("must be an object", field, stats);
  }

  const s = stats as Record<string, unknown>;

  const statNames: (keyof PlayerStats)[] = [
    "attack",
    "strength",
    "defense",
    "ranged",
    "magic",
    "hitpoints",
    "prayer",
    "mining",
    "fishing",
    "woodcutting",
    "cooking",
    "crafting",
    "smithing",
    "fletching",
    "firemaking",
  ];

  const validated: Partial<PlayerStats> = {};

  for (const stat of statNames) {
    const value = s[stat] ?? PLAYER_CONSTANTS.MIN_LEVEL;
    assertNonNegativeInteger(value, `${field}.${stat}`);

    const level = value as number;
    if (level < PLAYER_CONSTANTS.MIN_LEVEL) {
      throw new ValidationError(
        `must be at least ${PLAYER_CONSTANTS.MIN_LEVEL}`,
        `${field}.${stat}`,
        level
      );
    }
    if (level > PLAYER_CONSTANTS.MAX_LEVEL) {
      throw new ValidationError(
        `cannot exceed ${PLAYER_CONSTANTS.MAX_LEVEL}`,
        `${field}.${stat}`,
        level
      );
    }

    validated[stat] = level;
  }

  return validated as PlayerStats;
}

/**
 * Validate position
 * @throws ValidationError if invalid
 */
export function validatePosition(
  position: unknown,
  field: string = "position"
): Position3D {
  if (typeof position !== "object" || position === null) {
    throw new ValidationError("must be an object", field, position);
  }

  const pos = position as Record<string, unknown>;

  assertNumber(pos.x, `${field}.x`);
  assertNumber(pos.y, `${field}.y`);
  assertNumber(pos.z, `${field}.z`);

  const MAX_COORD = 10000;
  if (Math.abs(pos.x as number) > MAX_COORD) {
    throw new ValidationError(`x exceeds world bounds ±${MAX_COORD}`, `${field}.x`, pos.x);
  }
  if (Math.abs(pos.z as number) > MAX_COORD) {
    throw new ValidationError(`z exceeds world bounds ±${MAX_COORD}`, `${field}.z`, pos.z);
  }

  return {
    x: pos.x as number,
    y: pos.y as number,
    z: pos.z as number,
  };
}

/**
 * Validate health value
 * @throws ValidationError if invalid
 */
export function validateHealth(
  health: unknown,
  maxHealth: number,
  field: string = "health"
): number {
  assertNonNegativeInteger(health, field);

  const h = health as number;
  if (h > maxHealth) {
    throw new ValidationError(`cannot exceed max health ${maxHealth}`, field, health);
  }

  return h;
}

// =============================================================================
// COMBAT LEVEL CALCULATION (OSRS Formula)
// =============================================================================

/**
 * Calculate OSRS-style combat level
 *
 * OSRS Formula:
 * base = 0.25 * (defense + hitpoints + floor(prayer/2))
 * melee = 0.325 * (attack + strength)
 * ranged = 0.325 * floor(1.5 * ranged)
 * magic = 0.325 * floor(1.5 * magic)
 * combatLevel = base + max(melee, ranged, magic)
 */
export function calculateCombatLevel(stats: PlayerStats): number {
  const base = 0.25 * (stats.defense + stats.hitpoints + Math.floor(stats.prayer / 2));

  const melee = PLAYER_CONSTANTS.COMBAT_MELEE_WEIGHT * (stats.attack + stats.strength);
  const ranged = PLAYER_CONSTANTS.COMBAT_MELEE_WEIGHT * Math.floor(PLAYER_CONSTANTS.COMBAT_RANGED_WEIGHT * stats.ranged);
  const magic = PLAYER_CONSTANTS.COMBAT_MELEE_WEIGHT * Math.floor(PLAYER_CONSTANTS.COMBAT_MAGIC_WEIGHT * stats.magic);

  const combatType = Math.max(melee, ranged, magic);

  return Math.floor(base + combatType);
}

/**
 * Calculate total level (sum of all skills)
 */
export function calculateTotalLevel(stats: PlayerStats): number {
  return Object.values(stats).reduce((sum, level) => sum + level, 0);
}

/**
 * Calculate max health based on hitpoints level
 */
export function calculateMaxHealth(hitpointsLevel: number): number {
  return PLAYER_CONSTANTS.BASE_HITPOINTS + (hitpointsLevel - 1) * PLAYER_CONSTANTS.HP_PER_LEVEL;
}

// =============================================================================
// HEALTH MANAGEMENT
// =============================================================================

/**
 * Apply damage to player
 *
 * PURE FUNCTION - returns health change result
 */
export function applyDamage(
  currentHealth: number,
  damage: number
): HealthChange {
  const newHealth = Math.max(0, currentHealth - damage);

  return {
    newHealth,
    damage,
    isDead: newHealth <= 0,
  };
}

/**
 * Apply healing to player
 *
 * PURE FUNCTION - returns health change result
 */
export function applyHealing(
  currentHealth: number,
  maxHealth: number,
  healing: number
): HealthChange {
  const newHealth = Math.min(maxHealth, currentHealth + healing);

  return {
    newHealth,
    healing: newHealth - currentHealth,
    isDead: false,
  };
}

/**
 * Calculate food healing amount
 *
 * Different food tiers heal different amounts
 */
export function calculateFoodHealing(
  foodId: string,
  hitpointsLevel: number
): number {
  // Food healing values (simplified - would normally use item database)
  const FOOD_HEALING: Record<string, number> = {
    shrimp: 3,
    anchovies: 3,
    trout: 7,
    salmon: 9,
    tuna: 10,
    lobster: 12,
    swordfish: 14,
    monkfish: 16,
    shark: 20,
    manta_ray: 22,
  };

  const baseHealing = FOOD_HEALING[foodId] ?? 0;

  // Some foods scale with hitpoints level
  if (foodId === "anglerfish") {
    // Anglerfish can overheal based on HP level
    return Math.floor(hitpointsLevel / 10) + 13;
  }

  return baseHealing;
}

/**
 * Check if player is at full health
 */
export function isFullHealth(currentHealth: number, maxHealth: number): boolean {
  return currentHealth >= maxHealth;
}

/**
 * Check if player is at low health (below 25%)
 */
export function isLowHealth(currentHealth: number, maxHealth: number): boolean {
  return currentHealth <= maxHealth * 0.25;
}

// =============================================================================
// XP AND LEVELING
// =============================================================================

/**
 * XP required for level (OSRS formula)
 *
 * OSRS uses: floor(sum from i=1 to L-1 of floor(i + 300 * 2^(i/7))) / 4
 */
export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;

  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(i + 300 * Math.pow(2, i / 7));
  }

  return Math.floor(total / 4);
}

/**
 * Calculate level from XP
 */
export function getLevelFromXp(xp: number): number {
  for (let level = PLAYER_CONSTANTS.MAX_LEVEL; level >= 1; level--) {
    if (xp >= getXpForLevel(level)) {
      return level;
    }
  }
  return 1;
}

/**
 * Calculate XP needed for next level
 */
export function getXpToNextLevel(currentXp: number): number {
  const currentLevel = getLevelFromXp(currentXp);

  if (currentLevel >= PLAYER_CONSTANTS.MAX_LEVEL) {
    return 0;
  }

  const nextLevelXp = getXpForLevel(currentLevel + 1);
  return nextLevelXp - currentXp;
}

/**
 * Calculate XP progress percentage to next level
 */
export function getXpProgress(currentXp: number): number {
  const currentLevel = getLevelFromXp(currentXp);

  if (currentLevel >= PLAYER_CONSTANTS.MAX_LEVEL) {
    return 100;
  }

  const currentLevelXp = getXpForLevel(currentLevel);
  const nextLevelXp = getXpForLevel(currentLevel + 1);

  const xpInLevel = currentXp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;

  return Math.floor((xpInLevel / xpNeeded) * 100);
}

// =============================================================================
// ACTIVITY AND STATE
// =============================================================================

/**
 * Check if player is AFK
 */
export function isPlayerAfk(
  lastActivityTick: number,
  currentTick: number
): boolean {
  return currentTick - lastActivityTick >= PLAYER_CONSTANTS.AFK_TIMEOUT_TICKS;
}

/**
 * Check if player should be logged out
 */
export function shouldLogoutPlayer(
  lastActivityTick: number,
  currentTick: number
): boolean {
  return currentTick - lastActivityTick >= PLAYER_CONSTANTS.LOGOUT_TIMEOUT_TICKS;
}

/**
 * Calculate distance between two players
 */
export function calculatePlayerDistance(
  pos1: Position3D,
  pos2: Position3D
): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Check if two players are within interaction range
 */
export function arePlayersInRange(
  pos1: Position3D,
  pos2: Position3D,
  range: number
): boolean {
  return calculatePlayerDistance(pos1, pos2) <= range;
}

// =============================================================================
// PLAYER STATE CREATION
// =============================================================================

/**
 * Create default player stats
 */
export function createDefaultStats(): PlayerStats {
  return {
    attack: 1,
    strength: 1,
    defense: 1,
    ranged: 1,
    magic: 1,
    hitpoints: 10,
    prayer: 1,
    mining: 1,
    fishing: 1,
    woodcutting: 1,
    cooking: 1,
    crafting: 1,
    smithing: 1,
    fletching: 1,
    firemaking: 1,
  };
}

/**
 * Create initial player state
 */
export function createPlayerState(
  id: string,
  name: string,
  position: Position3D,
  stats?: Partial<PlayerStats>
): PlayerState {
  const fullStats: PlayerStats = {
    ...createDefaultStats(),
    ...stats,
  };

  const maxHealth = calculateMaxHealth(fullStats.hitpoints);

  return {
    id,
    name,
    position: { ...position },
    health: maxHealth,
    maxHealth,
    stats: fullStats,
    totalLevel: calculateTotalLevel(fullStats),
    combatLevel: calculateCombatLevel(fullStats),
    isAlive: true,
    inCombat: false,
    lastActivityTick: 0,
  };
}

/**
 * Update player stats
 *
 * PURE FUNCTION - returns new player state
 */
export function updatePlayerStats(
  player: PlayerState,
  newStats: Partial<PlayerStats>
): PlayerState {
  const updatedStats: PlayerStats = {
    ...player.stats,
    ...newStats,
  };

  const maxHealth = calculateMaxHealth(updatedStats.hitpoints);

  return {
    ...player,
    stats: updatedStats,
    maxHealth,
    health: Math.min(player.health, maxHealth),
    totalLevel: calculateTotalLevel(updatedStats),
    combatLevel: calculateCombatLevel(updatedStats),
  };
}

/**
 * Update player position
 *
 * PURE FUNCTION - returns new player state
 */
export function updatePlayerPosition(
  player: PlayerState,
  newPosition: Position3D,
  currentTick: number
): PlayerState {
  return {
    ...player,
    position: { ...newPosition },
    lastActivityTick: currentTick,
  };
}

/**
 * Set player death state
 *
 * PURE FUNCTION - returns new player state
 */
export function setPlayerDead(player: PlayerState): PlayerState {
  return {
    ...player,
    health: 0,
    isAlive: false,
    inCombat: false,
  };
}

/**
 * Respawn player
 *
 * PURE FUNCTION - returns new player state
 */
export function respawnPlayer(
  player: PlayerState,
  spawnPosition: Position3D,
  currentTick: number
): PlayerState {
  return {
    ...player,
    position: { ...spawnPosition },
    health: player.maxHealth,
    isAlive: true,
    inCombat: false,
    lastActivityTick: currentTick,
  };
}
