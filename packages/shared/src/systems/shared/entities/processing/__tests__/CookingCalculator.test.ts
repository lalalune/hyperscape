/**
 * Cooking Calculator Tests
 *
 * Verifies rules-accurate cooking calculations:
 * - Burn chance formula (linear interpolation)
 * - Stop-burn levels per food type (fire vs range)
 * - XP values per food type
 * - Level requirements
 * - Cooked/burnt item mappings
 *
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  calculateBurnChance,
  getStopBurnLevel,
  getCookingXP,
  getCookingLevelRequired,
  meetsCookingLevel,
  isValidRawFood,
  getCookedItemId,
  getBurntItemId,
  getValidRawFoodIds,
  rollBurn,
} from "../CookingCalculator";
import {
  ProcessingDataProvider,
  type CookingManifest,
} from "../../../../../data/ProcessingDataProvider";

/**
 * Get path to local manifest file for tests
 */
function getLocalManifestPath(): string {
  // From packages/shared/src/systems/shared/entities/processing/__tests__/
  // to packages/server/world/assets/manifests/recipes/
  return path.resolve(
    __dirname,
    "../../../../../../../server/world/assets/manifests/recipes/cooking.json",
  );
}

describe("CookingCalculator", () => {
  beforeAll(async () => {
    try {
      // Load cooking recipes from local file (tests run without network access)
      const manifestPath = getLocalManifestPath();
      const manifestData = fs.readFileSync(manifestPath, "utf8");
      const manifest = JSON.parse(manifestData) as CookingManifest;

      // Load recipes into ProcessingDataProvider
      const provider = ProcessingDataProvider.getInstance();
      provider.loadCookingRecipes(manifest);
      provider.rebuild();

      // Verify data is loaded
      const cookableCount = provider.getCookableItemIds().size;
      if (cookableCount === 0) {
        throw new Error(
          `Manifest loaded from ${manifestPath} but ProcessingDataProvider has 0 cookable items after rebuild`,
        );
      }
    } catch (e) {
      console.warn(`Manifest not found, using minimal mock. Error: ${e}`);
      const mockManifest: CookingManifest = {
        recipes: [
          {
            raw: "raw_shrimp",
            cooked: "shrimp",
            burnt: "burnt_shrimp",
            level: 1,
            xp: 30,
            stopBurnLevel: {
              fire: 34,
              range: 33,
            },
            ticks: 4,
          },
          {
            raw: "raw_trout",
            cooked: "trout",
            burnt: "burnt_trout",
            level: 15,
            xp: 70,
            stopBurnLevel: {
              fire: 49,
              range: 46,
            },
            ticks: 4,
          },
          {
            raw: "raw_lobster",
            cooked: "lobster",
            burnt: "burnt_lobster",
            level: 40,
            xp: 120,
            stopBurnLevel: {
              fire: 74,
              range: 74,
            },
            ticks: 4,
          },
          {
            raw: "raw_swordfish",
            cooked: "swordfish",
            burnt: "burnt_swordfish",
            level: 45,
            xp: 140,
            stopBurnLevel: {
              fire: 86,
              range: 80,
            },
            ticks: 4,
          },
          {
            raw: "raw_shark",
            cooked: "shark",
            burnt: "burnt_shark",
            level: 80,
            xp: 210,
            stopBurnLevel: {
              fire: 99,
              range: 99,
            },
            ticks: 4,
          },
          {
            raw: "raw_monkfish",
            cooked: "monkfish",
            burnt: "burnt_monkfish",
            level: 62,
            xp: 150,
            stopBurnLevel: {
              fire: 92,
              range: 90,
            },
            ticks: 4,
          },
          {
            raw: "raw_herring",
            cooked: "herring",
            burnt: "burnt_herring",
            level: 5,
            xp: 50,
            stopBurnLevel: {
              fire: 41,
              range: 41,
            },
            ticks: 4,
          },
          {
            raw: "raw_salmon",
            cooked: "salmon",
            burnt: "burnt_salmon",
            level: 25,
            xp: 90,
            stopBurnLevel: {
              fire: 58,
              range: 55,
            },
            ticks: 4,
          },
          {
            raw: "raw_anchovies",
            cooked: "anchovies",
            burnt: "burnt_anchovies",
            level: 1,
            xp: 30,
            stopBurnLevel: {
              fire: 34,
              range: 33,
            },
            ticks: 4,
          },
          {
            raw: "raw_sardine",
            cooked: "sardine",
            burnt: "burnt_sardine",
            level: 1,
            xp: 40,
            stopBurnLevel: {
              fire: 38,
              range: 38,
            },
            ticks: 4,
          },
          {
            raw: "raw_pike",
            cooked: "pike",
            burnt: "burnt_pike",
            level: 20,
            xp: 80,
            stopBurnLevel: {
              fire: 53,
              range: 53,
            },
            ticks: 4,
          },
          {
            raw: "raw_beef",
            cooked: "cooked_meat",
            burnt: "burnt_meat",
            level: 1,
            xp: 30,
            stopBurnLevel: {
              fire: 34,
              range: 34,
            },
            ticks: 4,
          },
        ],
      };
      const provider = ProcessingDataProvider.getInstance();
      provider.loadCookingRecipes(mockManifest);
      provider.rebuild();
    }
  });
  describe("getStopBurnLevel", () => {
    it("returns correct fire stop-burn level for shrimp", () => {
      expect(getStopBurnLevel("raw_shrimp", "fire")).toBe(34);
    });

    it("returns correct range stop-burn level for shrimp (lower)", () => {
      expect(getStopBurnLevel("raw_shrimp", "range")).toBe(33);
    });

    it("range usually has lower stop-burn than fire", () => {
      const foods = ["raw_shrimp", "raw_trout", "raw_salmon", "raw_lobster"];
      for (const food of foods) {
        const fireBurn = getStopBurnLevel(food, "fire");
        const rangeBurn = getStopBurnLevel(food, "range");
        expect(rangeBurn).toBeLessThanOrEqual(fireBurn);
      }
    });

    it("returns 99 for invalid food items", () => {
      expect(getStopBurnLevel("invalid_food", "fire")).toBe(99);
      expect(getStopBurnLevel("logs", "fire")).toBe(99);
    });

    it("lobster has same stop-burn on fire and range (74)", () => {
      expect(getStopBurnLevel("raw_lobster", "fire")).toBe(74);
      expect(getStopBurnLevel("raw_lobster", "range")).toBe(74);
    });

    it("shark never stops burning before 99", () => {
      expect(getStopBurnLevel("raw_shark", "fire")).toBe(99);
      expect(getStopBurnLevel("raw_shark", "range")).toBe(99);
    });
  });

  describe("calculateBurnChance", () => {
    it("returns 0 when at or above stop-burn level", () => {
      // Shrimp stops burning at 34 on fire
      expect(calculateBurnChance(34, "raw_shrimp", "fire")).toBe(0);
      expect(calculateBurnChance(50, "raw_shrimp", "fire")).toBe(0);
      expect(calculateBurnChance(99, "raw_shrimp", "fire")).toBe(0);
    });

    it("returns 1 when below level requirement", () => {
      // Lobster requires level 40
      expect(calculateBurnChance(39, "raw_lobster", "fire")).toBe(1);
      expect(calculateBurnChance(1, "raw_lobster", "fire")).toBe(1);
    });

    it("returns value between 0 and 1 at intermediate levels", () => {
      // Shrimp: level 1 required, stops at 34 on fire
      // At level 17 (halfway), should be around 0.5
      const burnChance = calculateBurnChance(17, "raw_shrimp", "fire");
      expect(burnChance).toBeGreaterThan(0);
      expect(burnChance).toBeLessThan(1);
    });

    it("uses linear interpolation correctly", () => {
      // raw_shrimp: required=1, stopBurn(fire)=34
      // range = 34 - 1 = 33
      // At level 17: progress = 16, burnChance = 1 - 16/33 = 0.515...
      const burnChance = calculateBurnChance(17, "raw_shrimp", "fire");
      const expected = 1 - (17 - 1) / (34 - 1);
      expect(burnChance).toBeCloseTo(expected, 5);
    });

    it("burn chance decreases as level increases", () => {
      let previousChance = 1;
      for (let level = 1; level <= 34; level++) {
        const currentChance = calculateBurnChance(level, "raw_shrimp", "fire");
        expect(currentChance).toBeLessThanOrEqual(previousChance);
        previousChance = currentChance;
      }
    });

    it("range gives lower burn chance than fire at same level", () => {
      // Before stop-burn level
      const level = 30;
      const fireChance = calculateBurnChance(level, "raw_trout", "fire");
      const rangeChance = calculateBurnChance(level, "raw_trout", "range");
      expect(rangeChance).toBeLessThanOrEqual(fireChance);
    });

    it("returns MAX_BURN_CHANCE at exact level requirement (highest burn rate)", () => {
      // At exactly level 1 for shrimp, burn chance is capped at MAX_BURN_CHANCE (0.55)
      // (classic MMORPG-like: meeting the requirement guarantees some chance of success)
      expect(calculateBurnChance(1, "raw_shrimp", "fire")).toBe(0.55);
      // Well above requirement, burn chance drops below the cap
      // rawBurn < 0.55 when progress/range > 0.45, i.e. level >= 16 for shrimp
      expect(calculateBurnChance(16, "raw_shrimp", "fire")).toBeLessThan(0.55);
    });
  });

  describe("rollBurn", () => {
    it("never burns at stop-burn level", () => {
      // At level 34, shrimp should never burn on fire
      for (let i = 0; i < 100; i++) {
        expect(rollBurn(34, "raw_shrimp", "fire")).toBe(false);
      }
    });

    it("always burns below level requirement", () => {
      // Level 39 can't cook lobster (requires 40) - always burns
      for (let i = 0; i < 100; i++) {
        expect(rollBurn(39, "raw_lobster", "fire")).toBe(true);
      }
    });

    it("returns boolean", () => {
      const result = rollBurn(20, "raw_shrimp", "fire");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getCookingXP", () => {
    it("returns 30 XP for shrimp", () => {
      expect(getCookingXP("raw_shrimp")).toBe(30);
    });

    it("returns 70 XP for trout", () => {
      expect(getCookingXP("raw_trout")).toBe(70);
    });

    it("returns 120 XP for lobster", () => {
      expect(getCookingXP("raw_lobster")).toBe(120);
    });

    it("returns 140 XP for swordfish", () => {
      expect(getCookingXP("raw_swordfish")).toBe(140);
    });

    it("returns 210 XP for shark", () => {
      expect(getCookingXP("raw_shark")).toBe(210);
    });

    it("returns 0 for invalid items", () => {
      expect(getCookingXP("invalid_item")).toBe(0);
      expect(getCookingXP("logs")).toBe(0);
      expect(getCookingXP("")).toBe(0);
    });

    it("XP increases with food tier", () => {
      const xpValues = [
        getCookingXP("raw_shrimp"),
        getCookingXP("raw_herring"),
        getCookingXP("raw_trout"),
        getCookingXP("raw_salmon"),
        getCookingXP("raw_lobster"),
        getCookingXP("raw_swordfish"),
        getCookingXP("raw_shark"),
      ];

      for (let i = 1; i < xpValues.length; i++) {
        expect(xpValues[i]).toBeGreaterThan(xpValues[i - 1]);
      }
    });
  });

  describe("getCookingLevelRequired", () => {
    it("returns 1 for shrimp", () => {
      expect(getCookingLevelRequired("raw_shrimp")).toBe(1);
    });

    it("returns 5 for herring", () => {
      expect(getCookingLevelRequired("raw_herring")).toBe(5);
    });

    it("returns 15 for trout", () => {
      expect(getCookingLevelRequired("raw_trout")).toBe(15);
    });

    it("returns 40 for lobster", () => {
      expect(getCookingLevelRequired("raw_lobster")).toBe(40);
    });

    it("returns 80 for shark", () => {
      expect(getCookingLevelRequired("raw_shark")).toBe(80);
    });

    it("returns 1 for invalid items", () => {
      expect(getCookingLevelRequired("invalid")).toBe(1);
      expect(getCookingLevelRequired("")).toBe(1);
    });
  });

  describe("meetsCookingLevel", () => {
    it("returns true when level equals requirement", () => {
      expect(meetsCookingLevel(1, "raw_shrimp")).toBe(true);
      expect(meetsCookingLevel(40, "raw_lobster")).toBe(true);
      expect(meetsCookingLevel(80, "raw_shark")).toBe(true);
    });

    it("returns true when level exceeds requirement", () => {
      expect(meetsCookingLevel(99, "raw_shrimp")).toBe(true);
      expect(meetsCookingLevel(50, "raw_lobster")).toBe(true);
    });

    it("returns false when level is below requirement", () => {
      expect(meetsCookingLevel(39, "raw_lobster")).toBe(false);
      expect(meetsCookingLevel(79, "raw_shark")).toBe(false);
      expect(meetsCookingLevel(1, "raw_trout")).toBe(false);
    });
  });

  describe("isValidRawFood", () => {
    it("returns true for all valid raw food types", () => {
      expect(isValidRawFood("raw_shrimp")).toBe(true);
      expect(isValidRawFood("raw_anchovies")).toBe(true);
      expect(isValidRawFood("raw_sardine")).toBe(true);
      expect(isValidRawFood("raw_herring")).toBe(true);
      expect(isValidRawFood("raw_trout")).toBe(true);
      expect(isValidRawFood("raw_pike")).toBe(true);
      expect(isValidRawFood("raw_salmon")).toBe(true);
      expect(isValidRawFood("raw_lobster")).toBe(true);
      expect(isValidRawFood("raw_swordfish")).toBe(true);
      expect(isValidRawFood("raw_monkfish")).toBe(true);
      expect(isValidRawFood("raw_shark")).toBe(true);
    });

    it("returns false for non-food items", () => {
      expect(isValidRawFood("logs")).toBe(false);
      expect(isValidRawFood("tinderbox")).toBe(false);
      expect(isValidRawFood("shrimp")).toBe(false); // Cooked, not raw
      expect(isValidRawFood("burnt_shrimp")).toBe(false);
      expect(isValidRawFood("")).toBe(false);
    });
  });

  describe("getCookedItemId", () => {
    it("returns correct cooked item for raw shrimp", () => {
      expect(getCookedItemId("raw_shrimp")).toBe("shrimp");
    });

    it("returns correct cooked item for raw lobster", () => {
      expect(getCookedItemId("raw_lobster")).toBe("lobster");
    });

    it("returns correct cooked item for raw shark", () => {
      expect(getCookedItemId("raw_shark")).toBe("shark");
    });

    it("returns null for invalid items", () => {
      expect(getCookedItemId("invalid_item")).toBeNull();
      expect(getCookedItemId("logs")).toBeNull();
      expect(getCookedItemId("shrimp")).toBeNull();
    });

    it("maps all raw food to cooked versions", () => {
      const rawFoods = Array.from(getValidRawFoodIds());
      for (const rawFood of rawFoods) {
        const cooked = getCookedItemId(rawFood);
        expect(cooked).not.toBeNull();
        expect(cooked).not.toContain("raw_");
      }
    });
  });

  describe("getBurntItemId", () => {
    it("returns correct burnt item for raw shrimp", () => {
      expect(getBurntItemId("raw_shrimp")).toBe("burnt_shrimp");
    });

    it("returns correct burnt item for raw lobster", () => {
      expect(getBurntItemId("raw_lobster")).toBe("burnt_lobster");
    });

    it("returns correct burnt item for raw shark", () => {
      expect(getBurntItemId("raw_shark")).toBe("burnt_shark");
    });

    it("returns null for invalid items", () => {
      expect(getBurntItemId("invalid_item")).toBeNull();
      expect(getBurntItemId("logs")).toBeNull();
    });

    it("maps all raw food to burnt versions", () => {
      const rawFoods = Array.from(getValidRawFoodIds());
      for (const rawFood of rawFoods) {
        const burnt = getBurntItemId(rawFood);
        expect(burnt).not.toBeNull();
        expect(burnt).toContain("burnt_");
      }
    });
  });

  describe("getValidRawFoodIds", () => {
    it("returns a Set of valid raw food IDs", () => {
      const validIds = getValidRawFoodIds();
      expect(validIds).toBeInstanceOf(Set);
      expect(validIds.size).toBe(12); // 12 food types
    });

    it("contains all expected food types", () => {
      const validIds = getValidRawFoodIds();
      expect(validIds.has("raw_shrimp")).toBe(true);
      expect(validIds.has("raw_anchovies")).toBe(true);
      expect(validIds.has("raw_sardine")).toBe(true);
      expect(validIds.has("raw_herring")).toBe(true);
      expect(validIds.has("raw_trout")).toBe(true);
      expect(validIds.has("raw_pike")).toBe(true);
      expect(validIds.has("raw_salmon")).toBe(true);
      expect(validIds.has("raw_lobster")).toBe(true);
      expect(validIds.has("raw_swordfish")).toBe(true);
      expect(validIds.has("raw_monkfish")).toBe(true);
      expect(validIds.has("raw_shark")).toBe(true);
    });
  });

  describe("reference-rules verification", () => {
    // These tests verify specific values from the reference ruleset

    it("raw_shrimp: level 1, 30 XP, stop burn 34 fire / 33 range", () => {
      expect(getCookingLevelRequired("raw_shrimp")).toBe(1);
      expect(getCookingXP("raw_shrimp")).toBe(30);
      expect(getStopBurnLevel("raw_shrimp", "fire")).toBe(34);
      expect(getStopBurnLevel("raw_shrimp", "range")).toBe(33);
    });

    it("raw_trout: level 15, 70 XP, stop burn 49 fire / 46 range", () => {
      expect(getCookingLevelRequired("raw_trout")).toBe(15);
      expect(getCookingXP("raw_trout")).toBe(70);
      expect(getStopBurnLevel("raw_trout", "fire")).toBe(49);
      expect(getStopBurnLevel("raw_trout", "range")).toBe(46);
    });

    it("raw_lobster: level 40, 120 XP, stop burn 74 fire & range", () => {
      expect(getCookingLevelRequired("raw_lobster")).toBe(40);
      expect(getCookingXP("raw_lobster")).toBe(120);
      expect(getStopBurnLevel("raw_lobster", "fire")).toBe(74);
      expect(getStopBurnLevel("raw_lobster", "range")).toBe(74);
    });

    it("raw_swordfish: level 45, 140 XP, stop burn 86 fire / 80 range", () => {
      expect(getCookingLevelRequired("raw_swordfish")).toBe(45);
      expect(getCookingXP("raw_swordfish")).toBe(140);
      expect(getStopBurnLevel("raw_swordfish", "fire")).toBe(86);
      expect(getStopBurnLevel("raw_swordfish", "range")).toBe(80);
    });

    it("raw_monkfish: level 62, 150 XP, stop burn 92 fire / 90 range", () => {
      expect(getCookingLevelRequired("raw_monkfish")).toBe(62);
      expect(getCookingXP("raw_monkfish")).toBe(150);
      expect(getStopBurnLevel("raw_monkfish", "fire")).toBe(92);
      expect(getStopBurnLevel("raw_monkfish", "range")).toBe(90);
    });

    it("raw_shark: level 80, 210 XP, stop burn 99 fire & range", () => {
      expect(getCookingLevelRequired("raw_shark")).toBe(80);
      expect(getCookingXP("raw_shark")).toBe(210);
      expect(getStopBurnLevel("raw_shark", "fire")).toBe(99);
      expect(getStopBurnLevel("raw_shark", "range")).toBe(99);
    });

    it("all raw foods map to cooked and burnt versions", () => {
      expect(getCookedItemId("raw_shrimp")).toBe("shrimp");
      expect(getBurntItemId("raw_shrimp")).toBe("burnt_shrimp");

      expect(getCookedItemId("raw_lobster")).toBe("lobster");
      expect(getBurntItemId("raw_lobster")).toBe("burnt_lobster");

      expect(getCookedItemId("raw_shark")).toBe("shark");
      expect(getBurntItemId("raw_shark")).toBe("burnt_shark");
    });
  });
});
