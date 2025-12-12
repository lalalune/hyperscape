/**
 * Test Fixtures - Players
 *
 * Pre-defined player configurations for common test scenarios.
 */

import type { CreateMockPlayerOptions } from "../mocks/player";
import { STARTER_EQUIPMENT } from "./items";
import { SPAWN_POINT, SPAWN_POINT_2, SAFE_ZONE_SPAWN } from "./positions";

// =============================================================================
// PLAYER CONFIGURATIONS
// =============================================================================

/**
 * Default new player configuration
 */
export const NEW_PLAYER_CONFIG: CreateMockPlayerOptions = {
  id: "player-new",
  visibleName: "NewPlayer",
  position: SPAWN_POINT,
  health: { current: 100, max: 100 },
  stats: {
    attack: 1,
    strength: 1,
    defense: 1,
    ranged: 1,
    hitpoints: 10,
  },
};

/**
 * Mid-level player configuration
 */
export const MID_LEVEL_PLAYER_CONFIG: CreateMockPlayerOptions = {
  id: "player-mid",
  visibleName: "MidPlayer",
  position: SPAWN_POINT,
  health: { current: 500, max: 500 },
  stats: {
    attack: 50,
    strength: 50,
    defense: 50,
    ranged: 50,
    hitpoints: 50,
  },
};

/**
 * High-level player configuration
 */
export const HIGH_LEVEL_PLAYER_CONFIG: CreateMockPlayerOptions = {
  id: "player-high",
  visibleName: "ProPlayer",
  position: SPAWN_POINT,
  health: { current: 990, max: 990 },
  stats: {
    attack: 99,
    strength: 99,
    defense: 99,
    ranged: 99,
    hitpoints: 99,
  },
};

/**
 * Player with starter equipment
 */
export const EQUIPPED_PLAYER_CONFIG: CreateMockPlayerOptions = {
  ...NEW_PLAYER_CONFIG,
  id: "player-equipped",
  visibleName: "EquippedPlayer",
  inventory: STARTER_EQUIPMENT.map((item, index) => ({
    slot: index,
    itemId: item.id,
    quantity: item.stackable ? 100 : 1,
  })),
  equipment: [
    { slot: "weapon", itemId: "bronze_sword" },
    { slot: "shield", itemId: "bronze_shield" },
    { slot: "head", itemId: "bronze_helmet" },
    { slot: "body", itemId: "bronze_body" },
    { slot: "legs", itemId: "bronze_legs" },
  ],
};

/**
 * Injured player configuration
 */
export const INJURED_PLAYER_CONFIG: CreateMockPlayerOptions = {
  ...NEW_PLAYER_CONFIG,
  id: "player-injured",
  visibleName: "InjuredPlayer",
  health: { current: 10, max: 100 },
};

/**
 * Dead player configuration
 */
export const DEAD_PLAYER_CONFIG: CreateMockPlayerOptions = {
  ...NEW_PLAYER_CONFIG,
  id: "player-dead",
  visibleName: "DeadPlayer",
  health: { current: 0, max: 100 },
};

/**
 * Player at bank
 */
export const PLAYER_AT_BANK_CONFIG: CreateMockPlayerOptions = {
  ...NEW_PLAYER_CONFIG,
  id: "player-at-bank",
  visibleName: "BankPlayer",
  position: { x: 101, y: 0, z: 100 }, // Near bank
};

/**
 * Player in wilderness
 */
export const WILDERNESS_PLAYER_CONFIG: CreateMockPlayerOptions = {
  ...MID_LEVEL_PLAYER_CONFIG,
  id: "player-wilderness",
  visibleName: "WildPlayer",
  position: { x: 300, y: 0, z: 300 },
};

// =============================================================================
// MULTIPLAYER TEST CONFIGURATIONS
// =============================================================================

/**
 * Two players for trading test
 */
export const TRADING_PLAYERS: [
  CreateMockPlayerOptions,
  CreateMockPlayerOptions,
] = [
  {
    ...MID_LEVEL_PLAYER_CONFIG,
    id: "trader-1",
    visibleName: "Trader1",
    position: SPAWN_POINT,
    inventory: [
      { slot: 0, itemId: "coins", quantity: 10000 },
      { slot: 1, itemId: "bronze_sword", quantity: 1 },
    ],
  },
  {
    ...MID_LEVEL_PLAYER_CONFIG,
    id: "trader-2",
    visibleName: "Trader2",
    position: SPAWN_POINT_2,
    inventory: [
      { slot: 0, itemId: "coins", quantity: 5000 },
      { slot: 1, itemId: "iron_sword", quantity: 1 },
    ],
  },
];

/**
 * Two players for PvP combat test
 */
export const PVP_PLAYERS: [CreateMockPlayerOptions, CreateMockPlayerOptions] = [
  {
    ...HIGH_LEVEL_PLAYER_CONFIG,
    id: "pvp-attacker",
    visibleName: "Attacker",
    position: { x: 50, y: 0, z: 50 },
    equipment: [{ slot: "weapon", itemId: "steel_sword" }],
  },
  {
    ...HIGH_LEVEL_PLAYER_CONFIG,
    id: "pvp-defender",
    visibleName: "Defender",
    position: { x: 51, y: 0, z: 50 },
    equipment: [
      { slot: "weapon", itemId: "steel_sword" },
      { slot: "shield", itemId: "bronze_shield" },
    ],
  },
];

/**
 * Multiple players for stress testing
 */
export function createStressTestPlayers(
  count: number,
): CreateMockPlayerOptions[] {
  const players: CreateMockPlayerOptions[] = [];
  for (let i = 0; i < count; i++) {
    players.push({
      id: `stress-player-${i}`,
      visibleName: `StressPlayer${i}`,
      position: {
        x: SAFE_ZONE_SPAWN.x + (i % 10) * 5,
        y: 0,
        z: SAFE_ZONE_SPAWN.z + Math.floor(i / 10) * 5,
      },
      health: { current: 100, max: 100 },
      stats: {
        attack: 1 + Math.floor(i / 10),
        strength: 1 + Math.floor(i / 10),
        defense: 1 + Math.floor(i / 10),
        ranged: 1 + Math.floor(i / 10),
        hitpoints: 10 + Math.floor(i / 10),
      },
    });
  }
  return players;
}
