/**
 * GDD-Compliant Starting Items
 * Defines what every new player starts with per Game Design Document
 */

import { StartingItem, EquipmentSlotName } from '../types/core';

/**
 * Starting Conditions per GDD:
 * - Equipment: Bronze sword (equipped)
 * - Location: Random starter town  
 * - Stats: Base level 1 in all skills (Constitution starts at level 10)
 */
export const STARTING_ITEMS: StartingItem[] = [
  {
    id: 'bronze_sword',
    name: 'Bronze Sword',
    quantity: 1,
    stackable: false,
    equipped: true,
    slot: EquipmentSlotName.WEAPON
  }
];

/**
 * Alternative starting item sets for testing or special scenarios
 */
export const STARTING_ITEM_SETS = {
  // Default GDD-compliant start
  default: STARTING_ITEMS,
  
  // Testing set with additional items
  testing: [
    ...STARTING_ITEMS,
    {
      id: 'coins',
      name: 'Coins',
      quantity: 100,
      stackable: true,
      equipped: false,
      slot: null
    },
    {
      id: 'bronze_hatchet',
      name: 'Bronze Hatchet',
      quantity: 1,
      stackable: false,
      equipped: false,
      slot: EquipmentSlotName.WEAPON
    },
    {
      id: 'fishing_rod',
      name: 'Fishing Rod',
      quantity: 1,
      stackable: false,
      equipped: false,
      slot: null
    },
    {
      id: 'tinderbox',
      name: 'Tinderbox',
      quantity: 1,
      stackable: false,
      equipped: false,
      slot: null
    },
    {
      id: 'arrows',
      name: 'Arrows',
      quantity: 50,
      stackable: true,
      equipped: false,
      slot: EquipmentSlotName.ARROWS
    }
  ],
  
  // Ranged combat focused start
  ranged: [
    {
      id: 'wood_bow',
      name: 'Wood Bow',
      quantity: 1,
      stackable: false,
      equipped: true,
      slot: EquipmentSlotName.WEAPON
    },
    {
      id: 'arrows',
      name: 'Arrows',
      quantity: 100,
      stackable: true,
      equipped: true,
      slot: EquipmentSlotName.ARROWS
    }
  ],
  
  // Armored start for testing
  armored: [
    ...STARTING_ITEMS,
    {
      id: 'bronze_helmet',
      name: 'Bronze Helmet',
      quantity: 1,
      stackable: false,
      equipped: true,
      slot: EquipmentSlotName.HELMET
    },
    {
      id: 'bronze_body',
      name: 'Bronze Body',
      quantity: 1,
      stackable: false,
      equipped: true,
      slot: EquipmentSlotName.BODY
    },
    {
      id: 'bronze_legs',
      name: 'Bronze Legs',
      quantity: 1,
      stackable: false,
      equipped: true,
      slot: EquipmentSlotName.LEGS
    },
    {
      id: 'bronze_shield',
      name: 'Bronze Shield',
      quantity: 1,
      stackable: false,
      equipped: true,
      slot: EquipmentSlotName.SHIELD
    }
  ]
} as const;

/**
 * Player Starting Stats per GDD
 * All skills start at level 1 except Constitution which starts at level 10 (like RuneScape)
 */
export const STARTING_STATS = {
  attack: { level: 1, xp: 0 },
  strength: { level: 1, xp: 0 },
  defense: { level: 1, xp: 0 },
  constitution: { level: 10, xp: 1154 }, // Level 10 per GDD (1154 XP required)
  ranged: { level: 1, xp: 0 },
  woodcutting: { level: 1, xp: 0 },
  fishing: { level: 1, xp: 0 },
  firemaking: { level: 1, xp: 0 },
  cooking: { level: 1, xp: 0 }
} as const;

/**
 * Starting Health and Other Attributes per GDD
 */
export const STARTING_ATTRIBUTES = {
  health: 100, // Based on Constitution level 10
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  coins: 0, // No starting coins per GDD - must earn through combat/activities
  combatLevel: 3 // Calculated from starting stats
} as const;

/**
 * Get starting items based on configuration
 */
export function getStartingItems(setName: keyof typeof STARTING_ITEM_SETS = 'default'): StartingItem[] {
  return [...(STARTING_ITEM_SETS[setName] || STARTING_ITEM_SETS.default)];
}

/**
 * Validate starting item set for consistency
 */
export function validateStartingItems(items: StartingItem[]): boolean {
  // Ensure only one item per equipment slot
  const equippedSlots = new Set<string>();
  
  for (const item of items) {
    if (item.equipped && item.slot) {
      if (equippedSlots.has(item.slot)) {
        console.error(`Multiple items equipped in slot: ${item.slot}`);
        return false;
      }
      equippedSlots.add(item.slot);
    }
  }
  
  return true;
}

/**
 * Calculate starting combat level from stats
 */
export function calculateStartingCombatLevel(): number {
  const stats = STARTING_STATS;
  const attack = stats.attack.level;
  const strength = stats.strength.level;
  const defense = stats.defense.level;
  const constitution = stats.constitution.level;
  const ranged = stats.ranged.level * 1.5;
  
  const combatLevel = Math.floor(
    (defense + constitution + Math.floor(ranged / 2)) * 0.25 +
    Math.max(attack + strength, ranged * 2 / 3) * 0.325
  );
  
  return Math.max(3, combatLevel);
}

/**
 * Starting item IDs for quick reference
 */
export const STARTING_ITEM_IDS = {
  WEAPON: 'bronze_sword',
  BOW: 'wood_bow',
  ARROWS: 'arrows',
  HELMET: 'bronze_helmet',
  BODY: 'bronze_body',
  LEGS: 'bronze_legs',
  SHIELD: 'bronze_shield',
  HATCHET: 'bronze_hatchet',
  FISHING_ROD: 'fishing_rod',
  TINDERBOX: 'tinderbox',
  COINS: 'coins'
} as const;