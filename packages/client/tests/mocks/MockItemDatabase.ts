/**
 * MockItemDatabase - Mock item data for testing
 *
 * Provides mock item definitions matching @hyperscape/shared structure.
 */

export interface MockItemData {
  id: string;
  name: string;
  equipSlot?: string;
  equipable?: boolean;
  stackable?: boolean;
}

/**
 * Pre-defined mock items for testing
 */
export const MOCK_ITEMS: Record<string, MockItemData> = {
  // Weapons
  bronze_sword: {
    id: "bronze_sword",
    name: "Bronze Sword",
    equipSlot: "weapon",
    equipable: true,
    stackable: false,
  },
  iron_dagger: {
    id: "iron_dagger",
    name: "Iron Dagger",
    equipSlot: "weapon",
    equipable: true,
    stackable: false,
  },
  rune_scimitar: {
    id: "rune_scimitar",
    name: "Rune Scimitar",
    equipSlot: "weapon",
    equipable: true,
    stackable: false,
  },

  // Armor
  iron_helmet: {
    id: "iron_helmet",
    name: "Iron Helmet",
    equipSlot: "helmet",
    equipable: true,
    stackable: false,
  },
  rune_platebody: {
    id: "rune_platebody",
    name: "Rune Platebody",
    equipSlot: "body",
    equipable: true,
    stackable: false,
  },
  dragon_legs: {
    id: "dragon_legs",
    name: "Dragon Platelegs",
    equipSlot: "legs",
    equipable: true,
    stackable: false,
  },
  dragon_shield: {
    id: "dragon_shield",
    name: "Dragon Shield",
    equipSlot: "shield",
    equipable: true,
    stackable: false,
  },

  // Resources
  oak_logs: {
    id: "oak_logs",
    name: "Oak Logs",
    stackable: true,
  },
  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    stackable: true,
  },
  lobster: {
    id: "lobster",
    name: "Lobster",
    stackable: true,
  },

  // Currency
  coins: {
    id: "coins",
    name: "Coins",
    stackable: true,
  },

  // Noted items
  oak_logs_noted: {
    id: "oak_logs_noted",
    name: "Oak Logs (noted)",
    stackable: true,
  },
  lobster_noted: {
    id: "lobster_noted",
    name: "Lobster (noted)",
    stackable: true,
  },

  // Potions and runes
  strength_potion: {
    id: "strength_potion",
    name: "Strength Potion",
    stackable: false,
  },
  fire_rune: {
    id: "fire_rune",
    name: "Fire Rune",
    stackable: true,
  },

  // Arrows
  iron_arrow: {
    id: "iron_arrow",
    name: "Iron Arrow",
    equipSlot: "arrows",
    equipable: true,
    stackable: true,
  },
};

/**
 * Get mock item data by ID
 */
export function getMockItem(itemId: string): MockItemData | undefined {
  return MOCK_ITEMS[itemId];
}

/**
 * Check if an item is equipable
 */
export function isEquipable(itemId: string): boolean {
  const item = MOCK_ITEMS[itemId];
  return item?.equipable ?? false;
}

/**
 * Get the equipment slot for an item
 */
export function getEquipSlot(itemId: string): string | undefined {
  return MOCK_ITEMS[itemId]?.equipSlot;
}
