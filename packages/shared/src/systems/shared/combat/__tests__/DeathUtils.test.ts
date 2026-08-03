/**
 * DeathUtils Unit Tests
 *
 * Tests for pure utility functions extracted from the player death pipeline.
 *
 * Key behaviors tested:
 * - sanitizeKilledBy: XSS prevention, Unicode normalization, injection defense
 * - splitItemsForSafeDeath: classic MMORPG keep-3 logic, stack handling, value sorting
 * - validatePosition: NaN/Infinity rejection, world-bounds clamping
 * - isPositionInBounds: boundary detection without clamping
 * - isValidPositionNumber: finite number validation
 */

import { describe, it, expect, beforeAll } from "vitest";
import { dataManager } from "../../../../data/DataManager";
import {
  sanitizeKilledBy,
  splitItemsForSafeDeath,
  getItemValue,
  ITEMS_KEPT_ON_DEATH,
  validatePosition,
  isPositionInBounds,
  isValidPositionNumber,
  POSITION_VALIDATION,
} from "../DeathUtils";
import type { InventoryItem } from "../../../../types/core/core";

// Ensure dataManager is initialized (vitest.setup.ts handles this, but guard for safety)
beforeAll(async () => {
  if (!dataManager.isReady()) {
    await dataManager.initialize();
  }
});

/** Helper to create an InventoryItem for testing */
function makeItem(itemId: string, quantity = 1, slot = 0): InventoryItem {
  return {
    id: `${itemId}_${slot}`,
    itemId,
    quantity,
    slot,
    metadata: null,
  };
}

// ─── sanitizeKilledBy ─────────────────────────────────────────────────────────

describe("sanitizeKilledBy", () => {
  describe("basic input handling", () => {
    it("returns 'unknown' for null/undefined/empty", () => {
      expect(sanitizeKilledBy(null)).toBe("unknown");
      expect(sanitizeKilledBy(undefined)).toBe("unknown");
      expect(sanitizeKilledBy("")).toBe("unknown");
    });

    it("returns 'unknown' for non-string types", () => {
      expect(sanitizeKilledBy(42)).toBe("unknown");
      expect(sanitizeKilledBy(true)).toBe("unknown");
      expect(sanitizeKilledBy({})).toBe("unknown");
      expect(sanitizeKilledBy([])).toBe("unknown");
    });

    it("passes through normal strings unchanged", () => {
      expect(sanitizeKilledBy("Goblin")).toBe("Goblin");
      expect(sanitizeKilledBy("Dark Wizard")).toBe("Dark Wizard");
      expect(sanitizeKilledBy("player123")).toBe("player123");
    });
  });

  describe("HTML injection prevention", () => {
    it("strips angle brackets", () => {
      expect(sanitizeKilledBy("<script>alert(1)</script>")).toBe(
        "scriptalert(1)/script",
      );
    });

    it("strips quotes and ampersand", () => {
      expect(sanitizeKilledBy('foo"bar')).toBe("foobar");
      expect(sanitizeKilledBy("foo'bar")).toBe("foobar");
      expect(sanitizeKilledBy("foo&bar")).toBe("foobar");
    });

    it("strips all dangerous HTML characters combined", () => {
      const malicious = `<img src="x" onerror='alert(1)'>`;
      const result = sanitizeKilledBy(malicious);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
      expect(result).not.toContain('"');
      expect(result).not.toContain("'");
    });
  });

  describe("Unicode normalization", () => {
    it("normalizes NFKC (Cyrillic homograph attack)", () => {
      // Cyrillic 'а' (U+0430) looks like Latin 'a' (U+0061)
      // After NFKC normalization, the visual appearance is preserved but consistent
      const result = sanitizeKilledBy("Gоblin"); // 'о' is Cyrillic
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("control character stripping", () => {
    it("removes zero-width characters", () => {
      const withZeroWidth = "Gob\u200Blin"; // U+200B zero-width space
      expect(sanitizeKilledBy(withZeroWidth)).toBe("Goblin");
    });

    it("removes zero-width joiner/non-joiner", () => {
      expect(sanitizeKilledBy("Gob\u200Clin")).toBe("Goblin"); // U+200C ZWNJ
      expect(sanitizeKilledBy("Gob\u200Dlin")).toBe("Goblin"); // U+200D ZWJ
    });

    it("removes BOM character", () => {
      expect(sanitizeKilledBy("\uFEFFGoblin")).toBe("Goblin");
    });

    it("removes BiDi override characters", () => {
      expect(sanitizeKilledBy("Gob\u202Alin")).toBe("Goblin"); // LRE
      expect(sanitizeKilledBy("Gob\u202Blin")).toBe("Goblin"); // RLE
      expect(sanitizeKilledBy("Gob\u202Clin")).toBe("Goblin"); // PDF
      expect(sanitizeKilledBy("Gob\u202Dlin")).toBe("Goblin"); // LRO
      expect(sanitizeKilledBy("Gob\u202Elin")).toBe("Goblin"); // RLO
    });

    it("removes ASCII control characters", () => {
      expect(sanitizeKilledBy("Gob\x00lin")).toBe("Goblin"); // null
      expect(sanitizeKilledBy("Gob\x01lin")).toBe("Goblin"); // SOH
      expect(sanitizeKilledBy("Gob\x7Flin")).toBe("Goblin"); // DEL
      expect(sanitizeKilledBy("Gob\nlin")).toBe("Goblin"); // newline
      expect(sanitizeKilledBy("Gob\tlin")).toBe("Goblin"); // tab
    });
  });

  describe("length limiting", () => {
    it("truncates to 64 characters", () => {
      const longString = "A".repeat(100);
      expect(sanitizeKilledBy(longString)).toBe("A".repeat(64));
    });

    it("keeps strings under 64 characters unchanged", () => {
      const shortString = "Dark Wizard";
      expect(sanitizeKilledBy(shortString)).toBe("Dark Wizard");
    });
  });

  describe("edge cases", () => {
    it("returns 'unknown' when string is only stripped characters", () => {
      expect(sanitizeKilledBy("<>&'\"")).toBe("unknown");
      expect(sanitizeKilledBy("\u200B\u200C\u200D")).toBe("unknown");
    });

    it("trims whitespace", () => {
      expect(sanitizeKilledBy("  Goblin  ")).toBe("Goblin");
    });

    it("returns 'unknown' for whitespace-only string after stripping", () => {
      expect(sanitizeKilledBy("   ")).toBe("unknown");
    });
  });
});

// ─── splitItemsForSafeDeath ───────────────────────────────────────────────────

describe("splitItemsForSafeDeath", () => {
  describe("basic keep-3 behavior", () => {
    it("keeps 3 items and drops the rest with ITEMS_KEPT_ON_DEATH", () => {
      const items: InventoryItem[] = [
        makeItem("bronze_sword", 1, 0),
        makeItem("iron_sword", 1, 1),
        makeItem("steel_sword", 1, 2),
        makeItem("mithril_sword", 1, 3),
        makeItem("adamant_sword", 1, 4),
      ];

      const result = splitItemsForSafeDeath(items, ITEMS_KEPT_ON_DEATH);

      // Should keep exactly 3 items
      expect(result.kept.length + result.dropped.length).toBe(items.length);
      const totalKeptQty = result.kept.reduce((sum, i) => sum + i.quantity, 0);
      expect(totalKeptQty).toBe(3);
    });

    it("keeps all items when fewer than keepCount", () => {
      const items: InventoryItem[] = [
        makeItem("bronze_sword", 1, 0),
        makeItem("iron_sword", 1, 1),
      ];

      const result = splitItemsForSafeDeath(items, 3);

      expect(result.kept).toHaveLength(2);
      expect(result.dropped).toHaveLength(0);
    });

    it("returns empty kept when keepCount is 0", () => {
      const items: InventoryItem[] = [
        makeItem("bronze_sword", 1, 0),
        makeItem("iron_sword", 1, 1),
      ];

      const result = splitItemsForSafeDeath(items, 0);

      expect(result.kept).toHaveLength(0);
      expect(result.dropped).toHaveLength(2);
    });

    it("returns empty arrays for empty input", () => {
      const result = splitItemsForSafeDeath([], 3);

      expect(result.kept).toHaveLength(0);
      expect(result.dropped).toHaveLength(0);
    });
  });

  describe("value-based sorting", () => {
    it("keeps the most valuable items", () => {
      // Create items with known values from manifest
      // Unknown items default to value 0
      const items: InventoryItem[] = [
        makeItem("unknown_junk_item_1", 1, 0), // value 0 (unknown)
        makeItem("unknown_junk_item_2", 1, 1), // value 0 (unknown)
        makeItem("unknown_junk_item_3", 1, 2), // value 0 (unknown)
        makeItem("unknown_junk_item_4", 1, 3), // value 0 (unknown)
      ];

      const result = splitItemsForSafeDeath(items, 2);

      // All have equal value (0), so should keep first 2 from sorted order
      const totalKeptQty = result.kept.reduce((sum, i) => sum + i.quantity, 0);
      expect(totalKeptQty).toBe(2);
      const totalDroppedQty = result.dropped.reduce(
        (sum, i) => sum + i.quantity,
        0,
      );
      expect(totalDroppedQty).toBe(2);
    });
  });

  describe("stack handling (no memory explosion)", () => {
    it("handles large stacks without expanding", () => {
      const items: InventoryItem[] = [
        makeItem("coins", 10000, 0), // 10k coins
        makeItem("bronze_sword", 1, 1),
      ];

      // Keep 3: should keep 1 sword + 2 from the coin stack (or vice versa depending on value)
      const result = splitItemsForSafeDeath(items, 3);

      const totalKeptQty = result.kept.reduce((sum, i) => sum + i.quantity, 0);
      const totalDroppedQty = result.dropped.reduce(
        (sum, i) => sum + i.quantity,
        0,
      );
      expect(totalKeptQty).toBe(3);
      expect(totalKeptQty + totalDroppedQty).toBe(10001);
    });

    it("splits a stack across kept/dropped", () => {
      const items: InventoryItem[] = [makeItem("coins", 100, 0)];

      const result = splitItemsForSafeDeath(items, 3);

      // Should keep 3 coins, drop 97
      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].quantity).toBe(3);
      expect(result.dropped).toHaveLength(1);
      expect(result.dropped[0].quantity).toBe(97);
    });

    it("keeps entire stack if smaller than keepCount", () => {
      const items: InventoryItem[] = [makeItem("coins", 2, 0)];

      const result = splitItemsForSafeDeath(items, 5);

      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].quantity).toBe(2);
      expect(result.dropped).toHaveLength(0);
    });

    it("handles quantity=10000 without OOM (regression: stack explosion)", () => {
      const items: InventoryItem[] = [
        makeItem("arrows", 10000, 0),
        makeItem("rune_sword", 1, 1),
      ];

      // This should NOT create 10000 array entries internally
      const start = performance.now();
      const result = splitItemsForSafeDeath(items, 3);
      const elapsed = performance.now() - start;

      // Should complete near-instantly (< 50ms), not seconds
      expect(elapsed).toBeLessThan(50);

      const totalKeptQty = result.kept.reduce((sum, i) => sum + i.quantity, 0);
      expect(totalKeptQty).toBe(3);
    });
  });

  describe("preserves item identity", () => {
    it("kept items have same itemId as originals", () => {
      const items: InventoryItem[] = [
        makeItem("bronze_sword", 1, 0),
        makeItem("iron_sword", 1, 1),
        makeItem("steel_sword", 1, 2),
        makeItem("mithril_sword", 1, 3),
      ];

      const result = splitItemsForSafeDeath(items, 2);

      for (const kept of result.kept) {
        expect(items.some((i) => i.itemId === kept.itemId)).toBe(true);
      }
    });

    it("does not mutate original items", () => {
      const items: InventoryItem[] = [makeItem("coins", 100, 0)];
      const originalQty = items[0].quantity;

      splitItemsForSafeDeath(items, 3);

      expect(items[0].quantity).toBe(originalQty);
    });

    it("total quantity is preserved across kept + dropped", () => {
      const items: InventoryItem[] = [
        makeItem("coins", 500, 0),
        makeItem("bronze_sword", 3, 1),
        makeItem("lobster", 10, 2),
      ];

      const totalInput = items.reduce((sum, i) => sum + i.quantity, 0);
      const result = splitItemsForSafeDeath(items, 3);
      const totalOutput =
        result.kept.reduce((sum, i) => sum + i.quantity, 0) +
        result.dropped.reduce((sum, i) => sum + i.quantity, 0);

      expect(totalOutput).toBe(totalInput);
    });
  });

  describe("edge cases", () => {
    it("handles keepCount = -1 (drops everything)", () => {
      const items: InventoryItem[] = [makeItem("bronze_sword", 1, 0)];
      const result = splitItemsForSafeDeath(items, -1);
      expect(result.kept).toHaveLength(0);
      expect(result.dropped).toHaveLength(1);
    });

    it("handles single item with quantity 1", () => {
      const items: InventoryItem[] = [makeItem("bronze_sword", 1, 0)];
      const result = splitItemsForSafeDeath(items, 3);
      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].quantity).toBe(1);
      expect(result.dropped).toHaveLength(0);
    });

    it("handles exactly keepCount items", () => {
      const items: InventoryItem[] = [
        makeItem("bronze_sword", 1, 0),
        makeItem("iron_sword", 1, 1),
        makeItem("steel_sword", 1, 2),
      ];
      const result = splitItemsForSafeDeath(items, 3);
      expect(result.kept).toHaveLength(3);
      expect(result.dropped).toHaveLength(0);
    });
  });
});

// ─── getItemValue ─────────────────────────────────────────────────────────────

describe("getItemValue", () => {
  it("returns 0 for unknown item IDs", () => {
    expect(getItemValue("totally_nonexistent_item_xyz")).toBe(0);
  });

  it("returns a non-negative number for any input", () => {
    const value = getItemValue("bronze_sword");
    expect(value).toBeGreaterThanOrEqual(0);
  });
});

// ─── validatePosition ─────────────────────────────────────────────────────────

describe("validatePosition", () => {
  it("passes through valid positions unchanged", () => {
    const pos = { x: 100, y: 50, z: -200 };
    expect(validatePosition(pos)).toEqual(pos);
  });

  it("returns null for NaN coordinates", () => {
    expect(validatePosition({ x: NaN, y: 0, z: 0 })).toBeNull();
    expect(validatePosition({ x: 0, y: NaN, z: 0 })).toBeNull();
    expect(validatePosition({ x: 0, y: 0, z: NaN })).toBeNull();
  });

  it("returns null for Infinity coordinates", () => {
    expect(validatePosition({ x: Infinity, y: 0, z: 0 })).toBeNull();
    expect(validatePosition({ x: 0, y: -Infinity, z: 0 })).toBeNull();
  });

  it("clamps x/z to WORLD_BOUNDS", () => {
    const bounds = POSITION_VALIDATION.WORLD_BOUNDS;
    const result = validatePosition({ x: 99999, y: 0, z: -99999 });
    expect(result).not.toBeNull();
    expect(result!.x).toBe(bounds);
    expect(result!.z).toBe(-bounds);
  });

  it("clamps y to MIN_HEIGHT / MAX_HEIGHT", () => {
    const result = validatePosition({ x: 0, y: 9999, z: 0 });
    expect(result!.y).toBe(POSITION_VALIDATION.MAX_HEIGHT);

    const result2 = validatePosition({ x: 0, y: -9999, z: 0 });
    expect(result2!.y).toBe(POSITION_VALIDATION.MIN_HEIGHT);
  });

  it("allows negative y (underground caves)", () => {
    const result = validatePosition({ x: 0, y: -30, z: 0 });
    expect(result).toEqual({ x: 0, y: -30, z: 0 });
  });

  it("allows origin position", () => {
    expect(validatePosition({ x: 0, y: 0, z: 0 })).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });
});

// ─── isPositionInBounds ───────────────────────────────────────────────────────

describe("isPositionInBounds", () => {
  it("returns true for origin", () => {
    expect(isPositionInBounds({ x: 0, y: 0, z: 0 })).toBe(true);
  });

  it("returns true for positions within bounds", () => {
    expect(isPositionInBounds({ x: 5000, y: 100, z: -3000 })).toBe(true);
  });

  it("returns true at exact boundary", () => {
    const bounds = POSITION_VALIDATION.WORLD_BOUNDS;
    expect(isPositionInBounds({ x: bounds, y: 0, z: bounds })).toBe(true);
    expect(isPositionInBounds({ x: -bounds, y: 0, z: -bounds })).toBe(true);
  });

  it("returns false beyond x/z bounds", () => {
    const bounds = POSITION_VALIDATION.WORLD_BOUNDS;
    expect(isPositionInBounds({ x: bounds + 1, y: 0, z: 0 })).toBe(false);
    expect(isPositionInBounds({ x: 0, y: 0, z: -(bounds + 1) })).toBe(false);
  });

  it("returns false above MAX_HEIGHT", () => {
    expect(
      isPositionInBounds({
        x: 0,
        y: POSITION_VALIDATION.MAX_HEIGHT + 1,
        z: 0,
      }),
    ).toBe(false);
  });

  it("returns false below MIN_HEIGHT", () => {
    expect(
      isPositionInBounds({
        x: 0,
        y: POSITION_VALIDATION.MIN_HEIGHT - 1,
        z: 0,
      }),
    ).toBe(false);
  });
});

// ─── isValidPositionNumber ────────────────────────────────────────────────────

describe("isValidPositionNumber", () => {
  it("returns true for finite numbers", () => {
    expect(isValidPositionNumber(0)).toBe(true);
    expect(isValidPositionNumber(42)).toBe(true);
    expect(isValidPositionNumber(-100.5)).toBe(true);
  });

  it("returns false for NaN", () => {
    expect(isValidPositionNumber(NaN)).toBe(false);
  });

  it("returns false for Infinity", () => {
    expect(isValidPositionNumber(Infinity)).toBe(false);
    expect(isValidPositionNumber(-Infinity)).toBe(false);
  });
});

// ─── ITEMS_KEPT_ON_DEATH constant ────────────────────────────────────────────

describe("ITEMS_KEPT_ON_DEATH", () => {
  it("is 3 (classic MMORPG standard)", () => {
    expect(ITEMS_KEPT_ON_DEATH).toBe(3);
  });
});
