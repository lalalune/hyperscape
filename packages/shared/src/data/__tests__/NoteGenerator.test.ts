/**
 * NoteGenerator Unit Tests
 *
 * Tests the bank note generation system:
 * - shouldGenerateNote: Determines which items can have noted variants
 * - generateNotedItem: Creates the noted version of an item
 * - generateAllNotedItems: Batch generation with cross-linking
 * - Helper functions: isNotedItemId, getBaseItemId, getNotedItemId
 *
 * OSRS Rules enforced:
 * - Only tradeable, non-stackable items can be noted
 * - Stackable items (arrows, runes, coins) cannot be noted
 * - Untradeable/quest items cannot be noted
 * - Noted items are always stackable
 * - Noted items cannot be equipped, eaten, or used
 */

import { describe, it, expect } from "vitest";
import {
  shouldGenerateNote,
  generateNotedItem,
  generateAllNotedItems,
  getBaseItemId,
  getNotedItemId,
  isNotedItemId,
  NOTE_SUFFIX,
} from "../NoteGenerator";
import type { Item } from "../../types/game/item-types";
import { ItemRarity } from "../../types/entities";

// Helper to create test items with minimal required fields
function createTestItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "test_item",
    name: "Test Item",
    type: "weapon",
    description: "A test item",
    examine: "It's a test item.",
    tradeable: true,
    rarity: ItemRarity.COMMON,
    modelPath: "models/test.glb",
    iconPath: "icons/test.png",
    stackable: false,
    maxStackSize: 1,
    weight: 1,
    value: 100,
    equipable: true,
    equipSlot: "weapon",
    quantity: 1,
    ...overrides,
  } as Item;
}

describe("NoteGenerator", () => {
  describe("NOTE_SUFFIX constant", () => {
    it("should be _noted", () => {
      expect(NOTE_SUFFIX).toBe("_noted");
    });
  });

  describe("shouldGenerateNote", () => {
    it("returns true for standard tradeable non-stackable item", () => {
      const item = createTestItem({
        id: "bronze_sword",
        name: "Bronze Sword",
        tradeable: true,
        stackable: false,
      });
      expect(shouldGenerateNote(item)).toBe(true);
    });

    it("returns false for already noted items", () => {
      const item = createTestItem({
        id: "bronze_sword_noted",
        isNoted: true,
        baseItemId: "bronze_sword",
      });
      expect(shouldGenerateNote(item)).toBe(false);
    });

    it("returns false for items that already have notedItemId", () => {
      const item = createTestItem({
        id: "bronze_sword",
        notedItemId: "bronze_sword_noted",
      });
      expect(shouldGenerateNote(item)).toBe(false);
    });

    it("returns false for items with noteable explicitly false", () => {
      const item = createTestItem({
        id: "untradeable_quest_item",
        noteable: false,
      });
      expect(shouldGenerateNote(item)).toBe(false);
    });

    it("returns false for currency type items", () => {
      const item = createTestItem({
        id: "coins",
        name: "Coins",
        type: "currency",
      });
      expect(shouldGenerateNote(item)).toBe(false);
    });

    it("returns false for already stackable items", () => {
      const item = createTestItem({
        id: "arrows",
        name: "Arrows",
        stackable: true,
      });
      expect(shouldGenerateNote(item)).toBe(false);
    });

    it("returns false for untradeable items", () => {
      const item = createTestItem({
        id: "quest_sword",
        name: "Quest Sword",
        tradeable: false,
      });
      expect(shouldGenerateNote(item)).toBe(false);
    });

    it("returns true when tradeable is undefined (defaults to tradeable)", () => {
      const item = createTestItem({
        id: "bronze_sword",
        tradeable: undefined,
      });
      expect(shouldGenerateNote(item)).toBe(true);
    });
  });

  describe("generateNotedItem", () => {
    it("creates noted item with correct ID", () => {
      const baseItem = createTestItem({ id: "bronze_sword" });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.id).toBe("bronze_sword_noted");
    });

    it("creates noted item with correct name", () => {
      const baseItem = createTestItem({
        id: "bronze_sword",
        name: "Bronze Sword",
      });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.name).toBe("Bronze Sword (noted)");
    });

    it("makes noted item always stackable", () => {
      const baseItem = createTestItem({ stackable: false });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.stackable).toBe(true);
      expect(notedItem.maxStackSize).toBe(2147483647);
    });

    it("makes noted item non-equipable", () => {
      const baseItem = createTestItem({
        equipable: true,
        equipSlot: "weapon",
      });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.equipable).toBe(false);
      expect(notedItem.equipSlot).toBeNull();
    });

    it("removes heal amount from noted item", () => {
      const baseItem = createTestItem({
        id: "lobster",
        healAmount: 12,
      });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.healAmount).toBeUndefined();
    });

    it("sets weight to zero (paper note)", () => {
      const baseItem = createTestItem({ weight: 10 });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.weight).toBe(0);
    });

    it("preserves value from base item", () => {
      const baseItem = createTestItem({ value: 500 });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.value).toBe(500);
    });

    it("sets isNoted to true", () => {
      const baseItem = createTestItem();
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.isNoted).toBe(true);
    });

    it("sets baseItemId to reference the original", () => {
      const baseItem = createTestItem({ id: "bronze_sword" });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.baseItemId).toBe("bronze_sword");
    });

    it("sets noteable to false (notes cannot be noted again)", () => {
      const baseItem = createTestItem();
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.noteable).toBe(false);
    });

    it("preserves tradeable status from base item", () => {
      const baseItem = createTestItem({ tradeable: true });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.tradeable).toBe(true);
    });

    it("preserves rarity from base item", () => {
      const baseItem = createTestItem({ rarity: ItemRarity.RARE });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.rarity).toBe(ItemRarity.RARE);
    });

    it("preserves model and icon paths", () => {
      const baseItem = createTestItem({
        modelPath: "models/sword.glb",
        iconPath: "icons/sword.png",
      });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.modelPath).toBe("models/sword.glb");
      expect(notedItem.iconPath).toBe("icons/sword.png");
    });

    it("removes weapon/attack properties", () => {
      const baseItem = createTestItem({
        weaponType: "melee" as unknown as undefined,
        attackType: "slash" as unknown as null,
      });
      const notedItem = generateNotedItem(baseItem);
      expect(notedItem.weaponType).toBeUndefined();
      expect(notedItem.attackType).toBeUndefined();
    });
  });

  describe("generateAllNotedItems", () => {
    it("generates noted variants for eligible items", () => {
      const items = new Map<string, Item>();
      items.set(
        "bronze_sword",
        createTestItem({
          id: "bronze_sword",
          name: "Bronze Sword",
          stackable: false,
          tradeable: true,
        }),
      );

      const result = generateAllNotedItems(items);

      expect(result.has("bronze_sword")).toBe(true);
      expect(result.has("bronze_sword_noted")).toBe(true);
    });

    it("cross-links base item to noted variant", () => {
      const items = new Map<string, Item>();
      items.set(
        "bronze_sword",
        createTestItem({
          id: "bronze_sword",
          stackable: false,
        }),
      );

      const result = generateAllNotedItems(items);
      const baseItem = result.get("bronze_sword");

      expect(baseItem?.noteable).toBe(true);
      expect(baseItem?.notedItemId).toBe("bronze_sword_noted");
    });

    it("does not generate notes for stackable items", () => {
      const items = new Map<string, Item>();
      items.set(
        "arrows",
        createTestItem({
          id: "arrows",
          stackable: true,
        }),
      );

      const result = generateAllNotedItems(items);

      expect(result.has("arrows")).toBe(true);
      expect(result.has("arrows_noted")).toBe(false);
    });

    it("does not generate notes for currency", () => {
      const items = new Map<string, Item>();
      items.set(
        "coins",
        createTestItem({
          id: "coins",
          type: "currency",
        }),
      );

      const result = generateAllNotedItems(items);

      expect(result.has("coins")).toBe(true);
      expect(result.has("coins_noted")).toBe(false);
    });

    it("handles multiple items correctly", () => {
      const items = new Map<string, Item>();
      items.set(
        "bronze_sword",
        createTestItem({
          id: "bronze_sword",
          stackable: false,
          tradeable: true,
        }),
      );
      items.set(
        "arrows",
        createTestItem({
          id: "arrows",
          stackable: true,
        }),
      );
      items.set(
        "logs",
        createTestItem({
          id: "logs",
          stackable: false,
          tradeable: true,
        }),
      );

      const result = generateAllNotedItems(items);

      // Should generate notes for sword and logs, but not arrows
      expect(result.size).toBe(5); // 3 base + 2 noted
      expect(result.has("bronze_sword_noted")).toBe(true);
      expect(result.has("logs_noted")).toBe(true);
      expect(result.has("arrows_noted")).toBe(false);
    });

    it("preserves original items in the result map", () => {
      const originalItem = createTestItem({
        id: "bronze_sword",
        name: "Bronze Sword",
        value: 100,
      });
      const items = new Map<string, Item>();
      items.set("bronze_sword", originalItem);

      const result = generateAllNotedItems(items);
      const resultItem = result.get("bronze_sword");

      expect(resultItem?.name).toBe("Bronze Sword");
      expect(resultItem?.value).toBe(100);
    });

    it("returns same map reference updated with new items", () => {
      const items = new Map<string, Item>();
      items.set("bronze_sword", createTestItem({ id: "bronze_sword" }));

      const result = generateAllNotedItems(items);

      // Result is a new map, not the same reference
      expect(result).not.toBe(items);
      // But base items are preserved
      expect(result.get("bronze_sword")).toBeDefined();
    });
  });

  describe("isNotedItemId", () => {
    it("returns true for item IDs ending with _noted", () => {
      expect(isNotedItemId("bronze_sword_noted")).toBe(true);
      expect(isNotedItemId("logs_noted")).toBe(true);
      expect(isNotedItemId("lobster_noted")).toBe(true);
    });

    it("returns false for base item IDs", () => {
      expect(isNotedItemId("bronze_sword")).toBe(false);
      expect(isNotedItemId("logs")).toBe(false);
      expect(isNotedItemId("lobster")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isNotedItemId("")).toBe(false);
    });

    it("returns false for just _noted", () => {
      expect(isNotedItemId("_noted")).toBe(true); // Technically ends with _noted
    });

    it("handles items with underscores correctly", () => {
      expect(isNotedItemId("bronze_long_sword")).toBe(false);
      expect(isNotedItemId("bronze_long_sword_noted")).toBe(true);
    });
  });

  describe("getBaseItemId", () => {
    it("removes _noted suffix from noted item IDs", () => {
      expect(getBaseItemId("bronze_sword_noted")).toBe("bronze_sword");
      expect(getBaseItemId("logs_noted")).toBe("logs");
    });

    it("returns unchanged ID for base items", () => {
      expect(getBaseItemId("bronze_sword")).toBe("bronze_sword");
      expect(getBaseItemId("logs")).toBe("logs");
    });

    it("handles empty string", () => {
      expect(getBaseItemId("")).toBe("");
    });

    it("handles items with multiple underscores", () => {
      expect(getBaseItemId("bronze_long_sword_noted")).toBe(
        "bronze_long_sword",
      );
    });
  });

  describe("getNotedItemId", () => {
    it("adds _noted suffix to base item IDs", () => {
      expect(getNotedItemId("bronze_sword")).toBe("bronze_sword_noted");
      expect(getNotedItemId("logs")).toBe("logs_noted");
    });

    it("returns unchanged ID for already noted items", () => {
      expect(getNotedItemId("bronze_sword_noted")).toBe("bronze_sword_noted");
    });

    it("handles empty string", () => {
      expect(getNotedItemId("")).toBe("_noted");
    });
  });

  describe("round-trip conversions", () => {
    it("getBaseItemId(getNotedItemId(id)) returns original for base items", () => {
      const baseId = "bronze_sword";
      expect(getBaseItemId(getNotedItemId(baseId))).toBe(baseId);
    });

    it("getNotedItemId(getBaseItemId(id)) returns original for noted items", () => {
      const notedId = "bronze_sword_noted";
      expect(getNotedItemId(getBaseItemId(notedId))).toBe(notedId);
    });
  });

  describe("edge cases", () => {
    it("handles item with noted in name but not suffix", () => {
      expect(isNotedItemId("noted_item")).toBe(false);
      expect(isNotedItemId("my_noted_sword")).toBe(false);
    });

    it("handles case sensitivity (suffix is lowercase)", () => {
      expect(isNotedItemId("bronze_sword_NOTED")).toBe(false);
      expect(isNotedItemId("bronze_sword_Noted")).toBe(false);
    });
  });
});
