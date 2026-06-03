import { describe, it, expect } from "vitest";
import {
  getItemName,
  getItemNames,
  hasItemMatching,
  hasItemMatchingAny,
  hasAxe,
  hasPickaxe,
  hasTinderbox,
  hasFishingEquipment,
  hasWeapon,
  hasCombatCapableItem,
  hasFood,
  hasLogs,
  hasOre,
  hasBars,
  hasRawFood,
  hasBasicTools,
  getEquipmentSummary,
} from "../utils/item-detection";

describe("item-detection", () => {
  describe("getItemName", () => {
    it("returns empty string for null/undefined", () => {
      expect(getItemName(null)).toBe("");
      expect(getItemName(undefined)).toBe("");
    });

    it("extracts name from name field", () => {
      expect(getItemName({ name: "Bronze Hatchet" })).toBe("bronze hatchet");
    });

    it("extracts name from itemId field", () => {
      expect(getItemName({ itemId: "bronze_hatchet" })).toBe("bronze_hatchet");
    });

    it("extracts name from nested item.name", () => {
      expect(getItemName({ item: { name: "Iron Ore" } })).toBe("iron ore");
    });

    it("falls back to id field", () => {
      expect(getItemName({ id: "item_123" })).toBe("item_123");
    });

    it("prioritizes name over itemId", () => {
      expect(getItemName({ name: "Bronze Axe", itemId: "bronze_axe" })).toBe(
        "bronze axe",
      );
    });
  });

  describe("getItemNames", () => {
    it("returns empty array for null/undefined", () => {
      expect(getItemNames(null)).toEqual([]);
      expect(getItemNames(undefined)).toEqual([]);
    });

    it("extracts names from an array of items", () => {
      const items = [
        { name: "Bronze Hatchet" },
        { itemId: "copper_ore" },
        { id: "item_1" },
      ];
      expect(getItemNames(items)).toEqual([
        "bronze hatchet",
        "copper_ore",
        "item_1",
      ]);
    });

    it("filters out empty names", () => {
      const items = [{ name: "Axe" }, {}, { name: "Log" }];
      const names = getItemNames(items);
      expect(names).toEqual(["axe", "log"]);
    });
  });

  describe("hasItemMatching", () => {
    it("returns false for null items", () => {
      expect(hasItemMatching(null, "axe")).toBe(false);
    });

    it("finds items by substring", () => {
      const items = [{ name: "Bronze Hatchet" }, { name: "Copper Ore" }];
      expect(hasItemMatching(items, "hatchet")).toBe(true);
      expect(hasItemMatching(items, "sword")).toBe(false);
    });

    it("is case insensitive", () => {
      const items = [{ name: "Bronze Hatchet" }];
      expect(hasItemMatching(items, "HATCHET")).toBe(true);
      expect(hasItemMatching(items, "Hatchet")).toBe(true);
    });
  });

  describe("hasItemMatchingAny", () => {
    it("matches any of multiple search terms", () => {
      const items = [{ name: "Bronze Sword" }];
      expect(hasItemMatchingAny(items, ["axe", "sword", "mace"])).toBe(true);
      expect(hasItemMatchingAny(items, ["axe", "mace"])).toBe(false);
    });
  });

  describe("hasAxe", () => {
    it("returns false for null player", () => {
      expect(hasAxe(null)).toBe(false);
    });

    it("detects axe in inventory", () => {
      expect(hasAxe({ items: [{ name: "Bronze Axe" }] })).toBe(true);
      expect(hasAxe({ items: [{ name: "Bronze Hatchet" }] })).toBe(true);
    });

    it("detects axe as equipped weapon", () => {
      expect(hasAxe({ items: [], equipment: { weapon: "bronze_axe" } })).toBe(
        true,
      );
    });

    it("returns false without axe", () => {
      expect(hasAxe({ items: [{ name: "Sword" }] })).toBe(false);
    });
  });

  describe("hasPickaxe", () => {
    it("detects pickaxe in inventory", () => {
      expect(hasPickaxe({ items: [{ name: "Bronze Pickaxe" }] })).toBe(true);
    });

    it("detects pickaxe as equipped weapon", () => {
      expect(
        hasPickaxe({ items: [], equipment: { weapon: "iron_pickaxe" } }),
      ).toBe(true);
    });

    it("returns false without pickaxe", () => {
      expect(hasPickaxe({ items: [{ name: "Bronze Axe" }] })).toBe(false);
    });
  });

  describe("hasTinderbox", () => {
    it("detects tinderbox in inventory", () => {
      expect(hasTinderbox({ items: [{ name: "Tinderbox" }] })).toBe(true);
    });

    it("returns false without tinderbox", () => {
      expect(hasTinderbox({ items: [{ name: "Axe" }] })).toBe(false);
    });
  });

  describe("hasFishingEquipment", () => {
    it("detects fishing net", () => {
      expect(
        hasFishingEquipment({ items: [{ name: "Small Fishing Net" }] }),
      ).toBe(true);
    });

    it("detects fishing rod", () => {
      expect(hasFishingEquipment({ items: [{ name: "Fishing Rod" }] })).toBe(
        true,
      );
    });

    it("detects fly fishing rod", () => {
      expect(
        hasFishingEquipment({ items: [{ name: "Fly Fishing Rod" }] }),
      ).toBe(true);
    });

    it("detects harpoon", () => {
      expect(hasFishingEquipment({ items: [{ name: "Harpoon" }] })).toBe(true);
    });

    it("returns false without fishing equipment", () => {
      expect(hasFishingEquipment({ items: [{ name: "Sword" }] })).toBe(false);
    });
  });

  describe("hasWeapon", () => {
    it("detects equipped weapon string", () => {
      expect(
        hasWeapon({ items: [], equipment: { weapon: "bronze_sword" } }),
      ).toBe(true);
    });

    it("detects equipped weapon object", () => {
      expect(
        hasWeapon({
          items: [],
          equipment: { weapon: { itemId: "iron_scimitar" } },
        }),
      ).toBe(true);
    });

    it("returns false with no weapon equipped", () => {
      expect(hasWeapon({ items: [], equipment: { weapon: null } })).toBe(false);
      expect(hasWeapon({ items: [] })).toBe(false);
    });
  });

  describe("hasCombatCapableItem", () => {
    it("detects equipped weapon", () => {
      expect(
        hasCombatCapableItem({ items: [], equipment: { weapon: "sword" } }),
      ).toBe(true);
    });

    it("detects combat items in inventory", () => {
      expect(
        hasCombatCapableItem({ items: [{ name: "Bronze Scimitar" }] }),
      ).toBe(true);
      expect(hasCombatCapableItem({ items: [{ name: "Iron Dagger" }] })).toBe(
        true,
      );
    });

    it("detects tools as combat-capable", () => {
      expect(
        hasCombatCapableItem({ items: [{ name: "Bronze Hatchet" }] }),
      ).toBe(true);
      expect(hasCombatCapableItem({ items: [{ name: "Iron Pickaxe" }] })).toBe(
        true,
      );
    });

    it("returns false with no combat items", () => {
      expect(hasCombatCapableItem({ items: [{ name: "Copper Ore" }] })).toBe(
        false,
      );
    });
  });

  describe("hasFood", () => {
    it("detects food items", () => {
      expect(hasFood({ items: [{ name: "Cooked Shrimp" }] })).toBe(true);
      expect(hasFood({ items: [{ name: "Lobster" }] })).toBe(true);
      expect(hasFood({ items: [{ name: "Bread" }] })).toBe(true);
      expect(hasFood({ items: [{ name: "Meat Pie" }] })).toBe(true);
    });

    it("returns false without food", () => {
      expect(hasFood({ items: [{ name: "Iron Ore" }] })).toBe(false);
    });
  });

  describe("hasLogs", () => {
    it("detects logs", () => {
      expect(hasLogs({ items: [{ name: "Normal Log" }] })).toBe(true);
      expect(hasLogs({ items: [{ name: "Oak Log" }] })).toBe(true);
    });

    it("returns false without logs", () => {
      expect(hasLogs({ items: [{ name: "Iron Bar" }] })).toBe(false);
    });
  });

  describe("hasOre", () => {
    it("detects ore", () => {
      expect(hasOre({ items: [{ name: "Copper Ore" }] })).toBe(true);
      expect(hasOre({ items: [{ name: "Tin Ore" }] })).toBe(true);
    });

    it("returns false without ore", () => {
      expect(hasOre({ items: [{ name: "Bronze Bar" }] })).toBe(false);
    });
  });

  describe("hasBars", () => {
    it("detects bars", () => {
      expect(hasBars({ items: [{ name: "Bronze Bar" }] })).toBe(true);
      expect(hasBars({ items: [{ name: "Iron Bar" }] })).toBe(true);
    });
  });

  describe("hasRawFood", () => {
    it("detects raw food", () => {
      expect(hasRawFood({ items: [{ name: "Raw Shrimp" }] })).toBe(true);
    });

    it("returns false for cooked food", () => {
      expect(hasRawFood({ items: [{ name: "Cooked Shrimp" }] })).toBe(false);
    });
  });

  describe("hasBasicTools", () => {
    it("returns true when both axe and pickaxe present", () => {
      expect(
        hasBasicTools({
          items: [{ name: "Bronze Axe" }, { name: "Bronze Pickaxe" }],
        }),
      ).toBe(true);
    });

    it("returns false when only one tool present", () => {
      expect(hasBasicTools({ items: [{ name: "Bronze Axe" }] })).toBe(false);
    });
  });

  describe("getEquipmentSummary", () => {
    it("returns all false flags for null player", () => {
      const summary = getEquipmentSummary(null);
      expect(summary.hasAxe).toBe(false);
      expect(summary.hasPickaxe).toBe(false);
      expect(summary.hasWeapon).toBe(false);
      expect(summary.hasFood).toBe(false);
    });

    it("correctly summarizes a well-equipped player", () => {
      const player = {
        items: [
          { name: "Bronze Axe" },
          { name: "Bronze Pickaxe" },
          { name: "Tinderbox" },
          { name: "Small Fishing Net" },
          { name: "Cooked Shrimp" },
          { name: "Normal Log" },
          { name: "Copper Ore" },
          { name: "Bronze Bar" },
          { name: "Raw Trout" },
        ],
        equipment: { weapon: "bronze_sword" },
      };

      const summary = getEquipmentSummary(player);
      expect(summary.hasAxe).toBe(true);
      expect(summary.hasPickaxe).toBe(true);
      expect(summary.hasTinderbox).toBe(true);
      expect(summary.hasFishingEquipment).toBe(true);
      expect(summary.hasWeapon).toBe(true);
      expect(summary.hasFood).toBe(true);
      expect(summary.hasLogs).toBe(true);
      expect(summary.hasOre).toBe(true);
      expect(summary.hasBars).toBe(true);
      expect(summary.hasRawFood).toBe(true);
    });
  });
});
