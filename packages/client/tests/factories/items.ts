/**
 * Test Data Factories - Items
 *
 * Provides factory functions for creating test inventory items.
 * Per project rules: Use real data structures, no mocks.
 *
 * @packageDocumentation
 */

/**
 * Item definition for tests
 */
export interface TestItem {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  stackable: boolean;
  equipSlot?: string;
  stats?: Record<string, number>;
  value: number;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

/**
 * Counter for generating unique IDs
 */
let itemCounter = 0;

/**
 * Creates a unique item instance ID
 */
function generateItemInstanceId(): string {
  return `item_${Date.now()}_${++itemCounter}`;
}

/**
 * Creates a basic test item
 */
export function createTestItem(overrides: Partial<TestItem> = {}): TestItem {
  return {
    id: generateItemInstanceId(),
    itemId: "test_item",
    name: "Test Item",
    quantity: 1,
    stackable: false,
    value: 100,
    rarity: "common",
    ...overrides,
  };
}

/**
 * Creates a stackable item (like coins or arrows)
 */
export function createStackableItem(
  quantity: number,
  overrides: Partial<TestItem> = {},
): TestItem {
  return createTestItem({
    itemId: "stackable_item",
    name: "Stackable Item",
    quantity,
    stackable: true,
    value: 1,
    ...overrides,
  });
}

/**
 * Creates a coins item
 */
export function createCoins(amount: number): TestItem {
  return createStackableItem(amount, {
    itemId: "coins",
    name: "Coins",
    value: 1,
  });
}

/**
 * Creates an equipment item
 */
export function createEquipmentItem(
  slot: string,
  overrides: Partial<TestItem> = {},
): TestItem {
  return createTestItem({
    itemId: `${slot}_equipment`,
    name: `${slot.charAt(0).toUpperCase() + slot.slice(1)} Equipment`,
    equipSlot: slot,
    stats: {
      attack: 10,
      defense: 5,
    },
    rarity: "uncommon",
    ...overrides,
  });
}

/**
 * Common equipment items
 */
export const equipmentItems = {
  bronzeSword: (): TestItem =>
    createEquipmentItem("weapon", {
      itemId: "bronze_sword",
      name: "Bronze Sword",
      stats: { attack: 5 },
      value: 50,
    }),

  bronzeShield: (): TestItem =>
    createEquipmentItem("shield", {
      itemId: "bronze_shield",
      name: "Bronze Shield",
      stats: { defense: 5 },
      value: 50,
    }),

  bronzeHelmet: (): TestItem =>
    createEquipmentItem("head", {
      itemId: "bronze_helmet",
      name: "Bronze Helmet",
      stats: { defense: 3 },
      value: 30,
    }),

  bronzeChestplate: (): TestItem =>
    createEquipmentItem("chest", {
      itemId: "bronze_chestplate",
      name: "Bronze Chestplate",
      stats: { defense: 8 },
      value: 80,
    }),

  leatherBoots: (): TestItem =>
    createEquipmentItem("feet", {
      itemId: "leather_boots",
      name: "Leather Boots",
      stats: { defense: 1 },
      value: 20,
    }),
};

/**
 * Common consumable items
 */
export const consumableItems = {
  healthPotion: (): TestItem =>
    createStackableItem(1, {
      itemId: "health_potion",
      name: "Health Potion",
      value: 25,
    }),

  manaPotion: (): TestItem =>
    createStackableItem(1, {
      itemId: "mana_potion",
      name: "Mana Potion",
      value: 30,
    }),

  food: (): TestItem =>
    createStackableItem(1, {
      itemId: "bread",
      name: "Bread",
      value: 5,
    }),

  arrows: (quantity: number = 10): TestItem =>
    createStackableItem(quantity, {
      itemId: "arrows",
      name: "Arrows",
      value: 1,
    }),
};

/**
 * Creates a full inventory of random items
 */
export function createTestInventory(slotCount: number = 28): TestItem[] {
  const items: TestItem[] = [];
  const itemFactories = [
    () => equipmentItems.bronzeSword(),
    () => equipmentItems.bronzeShield(),
    () => consumableItems.healthPotion(),
    () => consumableItems.food(),
    () => consumableItems.arrows(10),
  ];

  for (let i = 0; i < slotCount / 2; i++) {
    const factory = itemFactories[i % itemFactories.length];
    items.push(factory());
  }

  return items;
}

/**
 * Creates an empty inventory array
 */
export function createEmptyInventory(): TestItem[] {
  return [];
}

/**
 * Creates a specific inventory setup for testing
 */
export function createInventorySetup(setup: {
  weapons?: number;
  armor?: number;
  potions?: number;
  coins?: number;
}): TestItem[] {
  const items: TestItem[] = [];

  for (let i = 0; i < (setup.weapons ?? 0); i++) {
    items.push(equipmentItems.bronzeSword());
  }

  for (let i = 0; i < (setup.armor ?? 0); i++) {
    items.push(equipmentItems.bronzeChestplate());
  }

  for (let i = 0; i < (setup.potions ?? 0); i++) {
    items.push(consumableItems.healthPotion());
  }

  if (setup.coins) {
    items.push(createCoins(setup.coins));
  }

  return items;
}
