/**
 * Test Fixtures - Items
 *
 * Pre-defined item configurations for consistent testing.
 * These match the production item definitions.
 */

/**
 * Item definition matching production Item interface
 */
export interface TestItem {
  id: string;
  name: string;
  type: string;
  stackable: boolean;
  weight: number;
  attackSpeed?: number;
  attackRange?: number;
  attackBonus?: number;
  strengthBonus?: number;
  defenseBonus?: number;
  rangedBonus?: number;
}

// =============================================================================
// WEAPONS
// =============================================================================

export const BRONZE_SWORD: TestItem = {
  id: "bronze_sword",
  name: "Bronze Sword",
  type: "weapon",
  stackable: false,
  weight: 1.8,
  attackSpeed: 2400,
  attackRange: 1,
  attackBonus: 4,
  strengthBonus: 5,
};

export const IRON_SWORD: TestItem = {
  id: "iron_sword",
  name: "Iron Sword",
  type: "weapon",
  stackable: false,
  weight: 2.0,
  attackSpeed: 2400,
  attackRange: 1,
  attackBonus: 10,
  strengthBonus: 9,
};

export const STEEL_SWORD: TestItem = {
  id: "steel_sword",
  name: "Steel Sword",
  type: "weapon",
  stackable: false,
  weight: 2.2,
  attackSpeed: 2400,
  attackRange: 1,
  attackBonus: 16,
  strengthBonus: 14,
};

export const WOOD_BOW: TestItem = {
  id: "wood_bow",
  name: "Wooden Bow",
  type: "weapon",
  stackable: false,
  weight: 0.9,
  attackSpeed: 3000,
  attackRange: 10,
  rangedBonus: 8,
};

export const OAK_BOW: TestItem = {
  id: "oak_bow",
  name: "Oak Bow",
  type: "weapon",
  stackable: false,
  weight: 1.1,
  attackSpeed: 3000,
  attackRange: 10,
  rangedBonus: 14,
};

// =============================================================================
// ARMOR
// =============================================================================

export const BRONZE_HELMET: TestItem = {
  id: "bronze_helmet",
  name: "Bronze Full Helm",
  type: "head",
  stackable: false,
  weight: 2.7,
  defenseBonus: 4,
};

export const BRONZE_BODY: TestItem = {
  id: "bronze_body",
  name: "Bronze Platebody",
  type: "body",
  stackable: false,
  weight: 9.0,
  defenseBonus: 15,
};

export const BRONZE_LEGS: TestItem = {
  id: "bronze_legs",
  name: "Bronze Platelegs",
  type: "legs",
  stackable: false,
  weight: 8.1,
  defenseBonus: 10,
};

export const BRONZE_SHIELD: TestItem = {
  id: "bronze_shield",
  name: "Bronze Kiteshield",
  type: "shield",
  stackable: false,
  weight: 5.4,
  defenseBonus: 8,
};

// =============================================================================
// STACKABLE ITEMS
// =============================================================================

export const COINS: TestItem = {
  id: "coins",
  name: "Coins",
  type: "currency",
  stackable: true,
  weight: 0,
};

export const ARROWS: TestItem = {
  id: "arrows",
  name: "Bronze Arrows",
  type: "ammo",
  stackable: true,
  weight: 0.01,
  rangedBonus: 1,
};

export const LOGS: TestItem = {
  id: "logs",
  name: "Logs",
  type: "resource",
  stackable: false,
  weight: 2.0,
};

export const OAK_LOGS: TestItem = {
  id: "oak_logs",
  name: "Oak Logs",
  type: "resource",
  stackable: false,
  weight: 2.0,
};

export const RAW_SHRIMP: TestItem = {
  id: "raw_shrimp",
  name: "Raw Shrimp",
  type: "resource",
  stackable: false,
  weight: 0.5,
};

export const COOKED_SHRIMP: TestItem = {
  id: "cooked_shrimp",
  name: "Cooked Shrimp",
  type: "consumable",
  stackable: false,
  weight: 0.5,
};

// =============================================================================
// TOOLS
// =============================================================================

export const BRONZE_HATCHET: TestItem = {
  id: "bronze_hatchet",
  name: "Bronze Hatchet",
  type: "tool",
  stackable: false,
  weight: 1.8,
};

export const BRONZE_PICKAXE: TestItem = {
  id: "bronze_pickaxe",
  name: "Bronze Pickaxe",
  type: "tool",
  stackable: false,
  weight: 2.2,
};

export const FISHING_ROD: TestItem = {
  id: "fishing_rod",
  name: "Fishing Rod",
  type: "tool",
  stackable: false,
  weight: 0.5,
};

export const TINDERBOX: TestItem = {
  id: "tinderbox",
  name: "Tinderbox",
  type: "tool",
  stackable: false,
  weight: 0.1,
};

// =============================================================================
// ITEM COLLECTIONS
// =============================================================================

/**
 * All melee weapons
 */
export const MELEE_WEAPONS: TestItem[] = [
  BRONZE_SWORD,
  IRON_SWORD,
  STEEL_SWORD,
];

/**
 * All ranged weapons
 */
export const RANGED_WEAPONS: TestItem[] = [WOOD_BOW, OAK_BOW];

/**
 * All armor pieces
 */
export const ARMOR: TestItem[] = [
  BRONZE_HELMET,
  BRONZE_BODY,
  BRONZE_LEGS,
  BRONZE_SHIELD,
];

/**
 * Starter equipment set
 */
export const STARTER_EQUIPMENT: TestItem[] = [
  BRONZE_SWORD,
  BRONZE_SHIELD,
  BRONZE_HELMET,
  BRONZE_BODY,
  BRONZE_LEGS,
  WOOD_BOW,
  ARROWS,
  TINDERBOX,
  BRONZE_HATCHET,
  FISHING_ROD,
];

/**
 * All stackable items
 */
export const STACKABLE_ITEMS: TestItem[] = [COINS, ARROWS];

/**
 * All tools
 */
export const TOOLS: TestItem[] = [
  BRONZE_HATCHET,
  BRONZE_PICKAXE,
  FISHING_ROD,
  TINDERBOX,
];

/**
 * Get an item by ID
 */
export function getTestItem(itemId: string): TestItem | undefined {
  const allItems: TestItem[] = [
    ...MELEE_WEAPONS,
    ...RANGED_WEAPONS,
    ...ARMOR,
    ...STACKABLE_ITEMS,
    ...TOOLS,
    LOGS,
    OAK_LOGS,
    RAW_SHRIMP,
    COOKED_SHRIMP,
  ];

  return allItems.find((item) => item.id === itemId);
}
