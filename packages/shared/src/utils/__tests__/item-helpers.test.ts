/**
 * Item Helpers Unit Tests
 *
 * Tests for rules-accurate item type detection helpers used for
 * context menu ordering and left-click default actions.
 */

import { describe, it, expect } from "vitest";
import {
  isFood,
  isPotion,
  isBone,
  isWeapon,
  isShield,
  usesWield,
  usesWear,
  isNotedItem,
  getPrimaryAction,
  getPrimaryActionFromManifest,
  HANDLED_INVENTORY_ACTIONS,
} from "../item-helpers";
import type { Item } from "../../types/game/item-types";

// Helper to create partial items for testing
function createItem(overrides: Partial<Item>): Item {
  return {
    id: "test_item",
    name: "Test Item",
    ...overrides,
  } as Item;
}

describe("Item Helpers", () => {
  // ===========================================================================
  // isFood
  // ===========================================================================

  describe("isFood", () => {
    it("returns true for consumable with healAmount", () => {
      const food = createItem({
        id: "shrimp",
        type: "consumable",
        healAmount: 10,
      });
      expect(isFood(food)).toBe(true);
    });

    it("returns false for potions", () => {
      const potion = createItem({
        id: "strength_potion",
        type: "consumable",
        healAmount: 10,
      });
      expect(isFood(potion)).toBe(false);
    });

    it("returns false for consumable without healAmount", () => {
      const item = createItem({
        id: "scroll",
        type: "consumable",
      });
      expect(isFood(item)).toBe(false);
    });

    it("returns false for consumable with zero healAmount", () => {
      const item = createItem({
        id: "burnt_fish",
        type: "consumable",
        healAmount: 0,
      });
      expect(isFood(item)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isFood(null)).toBe(false);
    });

    it("returns false for non-consumable", () => {
      const weapon = createItem({
        id: "bronze_shortsword",
        type: "weapon",
        healAmount: 5,
      });
      expect(isFood(weapon)).toBe(false);
    });
  });

  // ===========================================================================
  // isPotion
  // ===========================================================================

  describe("isPotion", () => {
    it("returns true for consumable with potion in id", () => {
      const potion = createItem({
        id: "strength_potion",
        type: "consumable",
      });
      expect(isPotion(potion)).toBe(true);
    });

    it("returns true for super_attack_potion", () => {
      const potion = createItem({
        id: "super_attack_potion",
        type: "consumable",
      });
      expect(isPotion(potion)).toBe(true);
    });

    it("returns false for food", () => {
      const food = createItem({
        id: "lobster",
        type: "consumable",
        healAmount: 12,
      });
      expect(isPotion(food)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isPotion(null)).toBe(false);
    });

    it("returns false for non-consumable with potion in id", () => {
      const item = createItem({
        id: "empty_potion_vial",
        type: "misc",
      });
      expect(isPotion(item)).toBe(false);
    });
  });

  // ===========================================================================
  // isBone
  // ===========================================================================

  describe("isBone", () => {
    it("returns true for bones", () => {
      const bones = createItem({ id: "bones" });
      expect(isBone(bones)).toBe(true);
    });

    it("returns true for big_bones", () => {
      const bones = createItem({ id: "big_bones" });
      expect(isBone(bones)).toBe(true);
    });

    it("returns true for dragon_bones", () => {
      const bones = createItem({ id: "dragon_bones" });
      expect(isBone(bones)).toBe(true);
    });

    it("returns false for bone-like items", () => {
      const item = createItem({ id: "bonesaw" });
      expect(isBone(item)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isBone(null)).toBe(false);
    });
  });

  // ===========================================================================
  // isWeapon
  // ===========================================================================

  describe("isWeapon", () => {
    it("returns true for equipSlot weapon", () => {
      const weapon = createItem({
        id: "bronze_shortsword",
        equipSlot: "weapon",
      });
      expect(isWeapon(weapon)).toBe(true);
    });

    it("returns true for equipSlot 2h", () => {
      const weapon = createItem({
        id: "rune_2h_sword",
        equipSlot: "2h",
      });
      expect(isWeapon(weapon)).toBe(true);
    });

    it("returns true for is2h flag", () => {
      const weapon = createItem({
        id: "godsword",
        is2h: true,
      });
      expect(isWeapon(weapon)).toBe(true);
    });

    it("returns true for weaponType defined", () => {
      const weapon = createItem({
        id: "bronze_dagger",
        weaponType: "stab",
      });
      expect(isWeapon(weapon)).toBe(true);
    });

    it("returns false for armor", () => {
      const armor = createItem({
        id: "bronze_platebody",
        equipSlot: "body",
      });
      expect(isWeapon(armor)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isWeapon(null)).toBe(false);
    });
  });

  // ===========================================================================
  // isShield
  // ===========================================================================

  describe("isShield", () => {
    it("returns true for equipSlot shield", () => {
      const shield = createItem({
        id: "bronze_shield",
        equipSlot: "shield",
      });
      expect(isShield(shield)).toBe(true);
    });

    it("returns false for weapon", () => {
      const weapon = createItem({
        id: "bronze_shortsword",
        equipSlot: "weapon",
      });
      expect(isShield(weapon)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isShield(null)).toBe(false);
    });
  });

  // ===========================================================================
  // usesWield
  // ===========================================================================

  describe("usesWield", () => {
    it("returns true for weapons", () => {
      const weapon = createItem({
        id: "bronze_shortsword",
        equipSlot: "weapon",
      });
      expect(usesWield(weapon)).toBe(true);
    });

    it("returns true for shields", () => {
      const shield = createItem({
        id: "bronze_shield",
        equipSlot: "shield",
      });
      expect(usesWield(shield)).toBe(true);
    });

    it("returns false for armor", () => {
      const armor = createItem({
        id: "bronze_platebody",
        equipSlot: "body",
      });
      expect(usesWield(armor)).toBe(false);
    });

    it("returns false for null", () => {
      expect(usesWield(null)).toBe(false);
    });
  });

  // ===========================================================================
  // usesWear
  // ===========================================================================

  describe("usesWear", () => {
    it("returns true for body armor", () => {
      const armor = createItem({
        id: "bronze_platebody",
        equipSlot: "body",
        equipable: true,
      });
      expect(usesWear(armor)).toBe(true);
    });

    it("returns true for helmet", () => {
      const helmet = createItem({
        id: "bronze_full_helm",
        equipSlot: "head",
        equipable: true,
      });
      expect(usesWear(helmet)).toBe(true);
    });

    it("returns false for weapon", () => {
      const weapon = createItem({
        id: "bronze_shortsword",
        equipSlot: "weapon",
        equipable: true,
      });
      expect(usesWear(weapon)).toBe(false);
    });

    it("returns false for shield", () => {
      const shield = createItem({
        id: "bronze_shield",
        equipSlot: "shield",
        equipable: true,
      });
      expect(usesWear(shield)).toBe(false);
    });

    it("returns false for non-equipable items", () => {
      const item = createItem({ id: "coins" });
      expect(usesWear(item)).toBe(false);
    });

    it("returns false for null", () => {
      expect(usesWear(null)).toBe(false);
    });
  });

  // ===========================================================================
  // isNotedItem
  // ===========================================================================

  describe("isNotedItem", () => {
    it("returns true for isNoted flag", () => {
      const noted = createItem({
        id: "bronze_bar",
        isNoted: true,
      });
      expect(isNotedItem(noted)).toBe(true);
    });

    it("returns true for _noted suffix", () => {
      const noted = createItem({
        id: "bronze_bar_noted",
      });
      expect(isNotedItem(noted)).toBe(true);
    });

    it("returns false for regular items", () => {
      const item = createItem({ id: "bronze_bar" });
      expect(isNotedItem(item)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isNotedItem(null)).toBe(false);
    });
  });

  // ===========================================================================
  // getPrimaryActionFromManifest
  // ===========================================================================

  describe("getPrimaryActionFromManifest", () => {
    it("returns eat for Eat action", () => {
      const item = createItem({
        inventoryActions: ["Eat", "Use", "Drop"],
      });
      expect(getPrimaryActionFromManifest(item)).toBe("eat");
    });

    it("returns drink for Drink action", () => {
      const item = createItem({
        inventoryActions: ["Drink", "Use", "Drop"],
      });
      expect(getPrimaryActionFromManifest(item)).toBe("drink");
    });

    it("returns wield for Wield action", () => {
      const item = createItem({
        inventoryActions: ["Wield", "Use", "Drop"],
      });
      expect(getPrimaryActionFromManifest(item)).toBe("wield");
    });

    it("returns wear for Wear action", () => {
      const item = createItem({
        inventoryActions: ["Wear", "Use", "Drop"],
      });
      expect(getPrimaryActionFromManifest(item)).toBe("wear");
    });

    it("returns bury for Bury action", () => {
      const item = createItem({
        inventoryActions: ["Bury", "Use", "Drop"],
      });
      expect(getPrimaryActionFromManifest(item)).toBe("bury");
    });

    it("returns use for unknown action", () => {
      const item = createItem({
        inventoryActions: ["Light", "Use", "Drop"],
      });
      expect(getPrimaryActionFromManifest(item)).toBe("use");
    });

    it("is case-insensitive", () => {
      const item = createItem({
        inventoryActions: ["EAT", "USE", "DROP"],
      });
      expect(getPrimaryActionFromManifest(item)).toBe("eat");
    });

    it("returns null for empty inventoryActions", () => {
      const item = createItem({
        inventoryActions: [],
      });
      expect(getPrimaryActionFromManifest(item)).toBe(null);
    });

    it("returns null for no inventoryActions", () => {
      const item = createItem({});
      expect(getPrimaryActionFromManifest(item)).toBe(null);
    });

    it("returns null for null item", () => {
      expect(getPrimaryActionFromManifest(null)).toBe(null);
    });
  });

  // ===========================================================================
  // getPrimaryAction
  // ===========================================================================

  describe("getPrimaryAction", () => {
    it("returns use for noted items regardless of other properties", () => {
      const noted = createItem({
        id: "lobster_noted",
        type: "consumable",
        healAmount: 12,
        inventoryActions: ["Eat", "Use", "Drop"],
      });
      expect(getPrimaryAction(noted, true)).toBe("use");
    });

    it("uses manifest action when available", () => {
      const item = createItem({
        inventoryActions: ["Wield", "Use", "Drop"],
      });
      expect(getPrimaryAction(item, false)).toBe("wield");
    });

    it("falls back to heuristic for food without manifest", () => {
      const food = createItem({
        id: "shrimp",
        type: "consumable",
        healAmount: 10,
      });
      expect(getPrimaryAction(food, false)).toBe("eat");
    });

    it("falls back to heuristic for potion without manifest", () => {
      const potion = createItem({
        id: "strength_potion",
        type: "consumable",
      });
      expect(getPrimaryAction(potion, false)).toBe("drink");
    });

    it("falls back to heuristic for bone without manifest", () => {
      const bones = createItem({ id: "bones" });
      expect(getPrimaryAction(bones, false)).toBe("bury");
    });

    it("falls back to heuristic for weapon without manifest", () => {
      const weapon = createItem({
        id: "bronze_shortsword",
        equipSlot: "weapon",
      });
      expect(getPrimaryAction(weapon, false)).toBe("wield");
    });

    it("falls back to heuristic for armor without manifest", () => {
      const armor = createItem({
        id: "bronze_platebody",
        equipSlot: "body",
        equipable: true,
      });
      expect(getPrimaryAction(armor, false)).toBe("wear");
    });

    it("returns use as final fallback", () => {
      const misc = createItem({ id: "coins" });
      expect(getPrimaryAction(misc, false)).toBe("use");
    });
  });

  // ===========================================================================
  // HANDLED_INVENTORY_ACTIONS
  // ===========================================================================

  describe("HANDLED_INVENTORY_ACTIONS", () => {
    it("contains all expected actions", () => {
      expect(HANDLED_INVENTORY_ACTIONS.has("eat")).toBe(true);
      expect(HANDLED_INVENTORY_ACTIONS.has("drink")).toBe(true);
      expect(HANDLED_INVENTORY_ACTIONS.has("bury")).toBe(true);
      expect(HANDLED_INVENTORY_ACTIONS.has("wield")).toBe(true);
      expect(HANDLED_INVENTORY_ACTIONS.has("wear")).toBe(true);
      expect(HANDLED_INVENTORY_ACTIONS.has("drop")).toBe(true);
      expect(HANDLED_INVENTORY_ACTIONS.has("examine")).toBe(true);
      expect(HANDLED_INVENTORY_ACTIONS.has("use")).toBe(true);
    });

    it("has exactly 8 actions", () => {
      expect(HANDLED_INVENTORY_ACTIONS.size).toBe(8);
    });
  });
});
