/**
 * Inventory Logic Unit Tests
 *
 * Tests all pure inventory functions in isolation.
 * No mocks, no system dependencies - just pure logic.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { ValidationError } from "../../../../validation";
import {
  type InventorySlot,
  validateMoveRequest,
  validateAddRequest,
  validateRemoveRequest,
  findEmptySlot,
  countEmptySlots,
  isInventoryFull,
  findExistingStack,
  getItemAtSlot,
  canAddItem,
  calculateMoveResult,
  applyMove,
  getTotalQuantity,
  calculateTotalWeight,
  hasItem,
  getItemsByType,
  validateSlotIndices,
} from "../inventory-logic";
import { INPUT_LIMITS } from "../../../../constants";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTestItem(
  slot: number,
  itemId: string,
  quantity: number = 1,
  stackable: boolean = false
): InventorySlot {
  return {
    slot,
    itemId,
    quantity,
    item: {
      id: itemId,
      name: itemId.replace(/_/g, " "),
      type: stackable ? "resource" : "equipment",
      stackable,
      weight: 1.0,
    },
  };
}

function createEmptyInventory(): InventorySlot[] {
  return [];
}

function createPartialInventory(): InventorySlot[] {
  return [
    createTestItem(0, "bronze_sword"),
    createTestItem(5, "bronze_shield"),
    createTestItem(10, "coins", 1000, true),
  ];
}

function createFullInventory(): InventorySlot[] {
  const items: InventorySlot[] = [];
  for (let i = 0; i < INPUT_LIMITS.MAX_INVENTORY_SLOTS; i++) {
    items.push(createTestItem(i, `item_${i}`));
  }
  return items;
}

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe("validateMoveRequest", () => {
  it("passes for valid input", () => {
    const result = validateMoveRequest("player-1", 0, 5);
    expect(result.playerId).toBe("player-1");
    expect(result.fromSlot).toBe(0);
    expect(result.toSlot).toBe(5);
  });

  it("throws for empty playerId", () => {
    expect(() => validateMoveRequest("", 0, 5)).toThrow(ValidationError);
  });

  it("throws for invalid fromSlot", () => {
    expect(() => validateMoveRequest("player-1", -1, 5)).toThrow(ValidationError);
    expect(() => validateMoveRequest("player-1", 28, 5)).toThrow(ValidationError);
    expect(() => validateMoveRequest("player-1", 0.5, 5)).toThrow(ValidationError);
    expect(() => validateMoveRequest("player-1", NaN, 5)).toThrow(ValidationError);
  });

  it("throws for invalid toSlot", () => {
    expect(() => validateMoveRequest("player-1", 0, -1)).toThrow(ValidationError);
    expect(() => validateMoveRequest("player-1", 0, 28)).toThrow(ValidationError);
    expect(() => validateMoveRequest("player-1", 0, 1.5)).toThrow(ValidationError);
  });

  it("throws for null/undefined", () => {
    expect(() => validateMoveRequest(null, 0, 5)).toThrow(ValidationError);
    expect(() => validateMoveRequest("player-1", undefined, 5)).toThrow(ValidationError);
  });
});

describe("validateAddRequest", () => {
  it("passes for valid input", () => {
    const result = validateAddRequest("player-1", "bronze_sword", 1);
    expect(result.playerId).toBe("player-1");
    expect(result.itemId).toBe("bronze_sword");
    expect(result.quantity).toBe(1);
  });

  it("accepts optional slot", () => {
    const result = validateAddRequest("player-1", "bronze_sword", 1, 5);
    expect(result.slot).toBe(5);
  });

  it("throws for invalid quantity", () => {
    expect(() => validateAddRequest("player-1", "bronze_sword", 0)).toThrow(ValidationError);
    expect(() => validateAddRequest("player-1", "bronze_sword", -1)).toThrow(ValidationError);
    expect(() =>
      validateAddRequest("player-1", "bronze_sword", INPUT_LIMITS.MAX_QUANTITY + 1)
    ).toThrow(ValidationError);
  });

  it("throws for control characters in itemId", () => {
    expect(() => validateAddRequest("player-1", "item\x00id", 1)).toThrow(ValidationError);
  });
});

describe("validateRemoveRequest", () => {
  it("passes for valid input", () => {
    const result = validateRemoveRequest("player-1", "bronze_sword", 1);
    expect(result.playerId).toBe("player-1");
    expect(result.itemId).toBe("bronze_sword");
    expect(result.quantity).toBe(1);
  });

  it("accepts optional slot", () => {
    const result = validateRemoveRequest("player-1", "bronze_sword", 1, 3);
    expect(result.slot).toBe(3);
  });
});

// =============================================================================
// SLOT FINDING TESTS
// =============================================================================

describe("findEmptySlot", () => {
  it("returns 0 for empty inventory", () => {
    expect(findEmptySlot([])).toBe(0);
  });

  it("finds first empty slot in partial inventory", () => {
    const items = createPartialInventory();
    expect(findEmptySlot(items)).toBe(1); // Slot 0 occupied, 1 is first empty
  });

  it("finds gaps in inventory", () => {
    const items = [
      createTestItem(0, "item1"),
      createTestItem(2, "item2"), // Gap at slot 1
    ];
    expect(findEmptySlot(items)).toBe(1);
  });

  it("returns -1 for full inventory", () => {
    const items = createFullInventory();
    expect(findEmptySlot(items)).toBe(-1);
  });

  it("respects custom maxSlots", () => {
    const items: InventorySlot[] = [];
    for (let i = 0; i < 5; i++) {
      items.push(createTestItem(i, `item_${i}`));
    }
    expect(findEmptySlot(items, 5)).toBe(-1);
    expect(findEmptySlot(items, 10)).toBe(5);
  });
});

describe("countEmptySlots", () => {
  it("returns max for empty inventory", () => {
    expect(countEmptySlots([])).toBe(INPUT_LIMITS.MAX_INVENTORY_SLOTS);
  });

  it("counts correctly for partial inventory", () => {
    const items = createPartialInventory();
    expect(countEmptySlots(items)).toBe(INPUT_LIMITS.MAX_INVENTORY_SLOTS - 3);
  });

  it("returns 0 for full inventory", () => {
    const items = createFullInventory();
    expect(countEmptySlots(items)).toBe(0);
  });
});

describe("isInventoryFull", () => {
  it("returns false for empty inventory", () => {
    expect(isInventoryFull([])).toBe(false);
  });

  it("returns false for partial inventory", () => {
    expect(isInventoryFull(createPartialInventory())).toBe(false);
  });

  it("returns true for full inventory", () => {
    expect(isInventoryFull(createFullInventory())).toBe(true);
  });
});

describe("findExistingStack", () => {
  it("finds existing item", () => {
    const items = createPartialInventory();
    const found = findExistingStack(items, "coins");
    expect(found).toBeDefined();
    expect(found?.quantity).toBe(1000);
  });

  it("returns undefined for missing item", () => {
    const items = createPartialInventory();
    expect(findExistingStack(items, "nonexistent")).toBeUndefined();
  });
});

describe("getItemAtSlot", () => {
  it("finds item at slot", () => {
    const items = createPartialInventory();
    const item = getItemAtSlot(items, 0);
    expect(item?.itemId).toBe("bronze_sword");
  });

  it("returns undefined for empty slot", () => {
    const items = createPartialInventory();
    expect(getItemAtSlot(items, 1)).toBeUndefined();
  });
});

// =============================================================================
// CAN ADD ITEM TESTS
// =============================================================================

describe("canAddItem", () => {
  describe("stackable items", () => {
    it("allows adding to empty inventory", () => {
      const result = canAddItem([], "coins", 100, true);
      expect(result.canAdd).toBe(true);
      expect(result.slotsNeeded).toBe(1);
    });

    it("allows adding to existing stack", () => {
      const items = [createTestItem(0, "coins", 500, true)];
      const result = canAddItem(items, "coins", 100, true);
      expect(result.canAdd).toBe(true);
      expect(result.slotsNeeded).toBe(0);
    });

    it("rejects if would exceed max stack", () => {
      const items = [createTestItem(0, "coins", INPUT_LIMITS.MAX_QUANTITY - 10, true)];
      const result = canAddItem(items, "coins", 20, true);
      expect(result.canAdd).toBe(false);
      expect(result.reason).toContain("max stack");
    });

    it("rejects if inventory full and no existing stack", () => {
      const items = createFullInventory();
      const result = canAddItem(items, "coins", 100, true);
      expect(result.canAdd).toBe(false);
      expect(result.reason).toBe("Inventory full");
    });
  });

  describe("non-stackable items", () => {
    it("allows adding single item to empty inventory", () => {
      const result = canAddItem([], "bronze_sword", 1, false);
      expect(result.canAdd).toBe(true);
      expect(result.slotsNeeded).toBe(1);
    });

    it("allows adding multiple items if enough space", () => {
      const result = canAddItem([], "bronze_sword", 5, false);
      expect(result.canAdd).toBe(true);
      expect(result.slotsNeeded).toBe(5);
    });

    it("rejects if not enough slots", () => {
      const items = createPartialInventory();
      const emptySlots = countEmptySlots(items);
      const result = canAddItem(items, "bronze_sword", emptySlots + 1, false);
      expect(result.canAdd).toBe(false);
      expect(result.reason).toContain("Need");
    });
  });
});

// =============================================================================
// MOVE CALCULATION TESTS
// =============================================================================

describe("calculateMoveResult", () => {
  it("handles same-slot move (no-op)", () => {
    const items = createPartialInventory();
    const result = calculateMoveResult(items, 0, 0);
    expect(result.success).toBe(true);
    expect(result.fromSlot?.itemId).toBe("bronze_sword");
    expect(result.toSlot?.itemId).toBe("bronze_sword");
  });

  it("handles move from empty slot", () => {
    const items = createPartialInventory();
    const result = calculateMoveResult(items, 1, 5); // Slot 1 is empty
    expect(result.success).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("swaps two occupied slots", () => {
    const items = createPartialInventory();
    const result = calculateMoveResult(items, 0, 5); // sword <-> shield
    expect(result.success).toBe(true);
    expect(result.fromSlot?.itemId).toBe("bronze_shield");
    expect(result.fromSlot?.slot).toBe(0);
    expect(result.toSlot?.itemId).toBe("bronze_sword");
    expect(result.toSlot?.slot).toBe(5);
  });

  it("moves item to empty slot", () => {
    const items = createPartialInventory();
    const result = calculateMoveResult(items, 0, 1); // sword to empty slot 1
    expect(result.success).toBe(true);
    expect(result.fromSlot).toBeNull(); // Source now empty
    expect(result.toSlot?.itemId).toBe("bronze_sword");
    expect(result.toSlot?.slot).toBe(1);
  });
});

describe("applyMove", () => {
  it("returns unchanged array for same-slot move", () => {
    const items = createPartialInventory();
    const result = applyMove(items, 0, 0);
    expect(result.length).toBe(items.length);
    expect(getItemAtSlot(result, 0)?.itemId).toBe("bronze_sword");
  });

  it("returns unchanged array for invalid move", () => {
    const items = createPartialInventory();
    const result = applyMove(items, 1, 5); // Slot 1 is empty
    expect(result.length).toBe(items.length);
  });

  it("swaps items correctly", () => {
    const items = createPartialInventory();
    const result = applyMove(items, 0, 5);

    expect(result.length).toBe(items.length);
    expect(getItemAtSlot(result, 0)?.itemId).toBe("bronze_shield");
    expect(getItemAtSlot(result, 5)?.itemId).toBe("bronze_sword");
  });

  it("moves item to empty slot correctly", () => {
    const items = createPartialInventory();
    const result = applyMove(items, 0, 1);

    expect(result.length).toBe(items.length);
    expect(getItemAtSlot(result, 0)).toBeUndefined();
    expect(getItemAtSlot(result, 1)?.itemId).toBe("bronze_sword");
  });

  it("does not mutate original array", () => {
    const items = createPartialInventory();
    const originalLength = items.length;
    const originalSlot0 = getItemAtSlot(items, 0)?.itemId;

    applyMove(items, 0, 1);

    expect(items.length).toBe(originalLength);
    expect(getItemAtSlot(items, 0)?.itemId).toBe(originalSlot0);
  });
});

// =============================================================================
// QUANTITY TESTS
// =============================================================================

describe("getTotalQuantity", () => {
  it("returns 0 for empty inventory", () => {
    expect(getTotalQuantity([], "coins")).toBe(0);
  });

  it("returns 0 for missing item", () => {
    const items = createPartialInventory();
    expect(getTotalQuantity(items, "nonexistent")).toBe(0);
  });

  it("returns correct quantity for existing item", () => {
    const items = createPartialInventory();
    expect(getTotalQuantity(items, "coins")).toBe(1000);
  });

  it("sums quantities across multiple stacks", () => {
    const items = [
      createTestItem(0, "coins", 500, true),
      createTestItem(1, "coins", 300, true),
      createTestItem(2, "coins", 200, true),
    ];
    expect(getTotalQuantity(items, "coins")).toBe(1000);
  });
});

describe("hasItem", () => {
  it("returns false for empty inventory", () => {
    expect(hasItem([], "bronze_sword")).toBe(false);
  });

  it("returns true for existing item", () => {
    const items = createPartialInventory();
    expect(hasItem(items, "bronze_sword")).toBe(true);
  });

  it("returns false for missing item", () => {
    const items = createPartialInventory();
    expect(hasItem(items, "nonexistent")).toBe(false);
  });

  it("checks quantity correctly", () => {
    const items = createPartialInventory();
    expect(hasItem(items, "coins", 500)).toBe(true);
    expect(hasItem(items, "coins", 1000)).toBe(true);
    expect(hasItem(items, "coins", 1001)).toBe(false);
  });
});

// =============================================================================
// WEIGHT TESTS
// =============================================================================

describe("calculateTotalWeight", () => {
  it("returns 0 for empty inventory", () => {
    expect(calculateTotalWeight([])).toBe(0);
  });

  it("calculates weight correctly", () => {
    const items = [
      createTestItem(0, "sword"), // weight 1.0
      createTestItem(1, "shield"), // weight 1.0
    ];
    expect(calculateTotalWeight(items)).toBe(2.0);
  });

  it("multiplies by quantity", () => {
    const items = [createTestItem(0, "arrows", 100)]; // weight 1.0 * 100
    expect(calculateTotalWeight(items)).toBe(100.0);
  });
});

// =============================================================================
// TYPE FILTERING TESTS
// =============================================================================

describe("getItemsByType", () => {
  it("returns empty array for empty inventory", () => {
    expect(getItemsByType([], "equipment")).toEqual([]);
  });

  it("filters by type correctly", () => {
    const items = createPartialInventory();
    const equipment = getItemsByType(items, "equipment");
    expect(equipment.length).toBe(2);
    expect(equipment.map((i) => i.itemId)).toContain("bronze_sword");
    expect(equipment.map((i) => i.itemId)).toContain("bronze_shield");
  });

  it("returns empty array for non-matching type", () => {
    const items = createPartialInventory();
    expect(getItemsByType(items, "nonexistent")).toEqual([]);
  });
});

// =============================================================================
// SLOT INDEX VALIDATION TESTS
// =============================================================================

describe("validateSlotIndices", () => {
  it("passes for valid slots", () => {
    expect(() => validateSlotIndices(0, 27)).not.toThrow();
  });

  it("throws for negative fromSlot", () => {
    expect(() => validateSlotIndices(-1, 5)).toThrow(ValidationError);
  });

  it("throws for out-of-bounds toSlot", () => {
    expect(() => validateSlotIndices(0, 28)).toThrow(ValidationError);
  });

  it("respects custom maxSlots", () => {
    expect(() => validateSlotIndices(5, 6, 5)).toThrow(ValidationError);
    expect(() => validateSlotIndices(4, 4, 5)).not.toThrow();
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("edge cases", () => {
  it("handles boundary slot values", () => {
    const items = [
      createTestItem(0, "first"),
      createTestItem(27, "last"),
    ];

    const result = applyMove(items, 0, 27);
    expect(getItemAtSlot(result, 0)?.itemId).toBe("last");
    expect(getItemAtSlot(result, 27)?.itemId).toBe("first");
  });

  it("handles single-item inventory", () => {
    const items = [createTestItem(5, "item")];

    expect(findEmptySlot(items)).toBe(0);
    expect(isInventoryFull(items)).toBe(false);

    const result = applyMove(items, 5, 0);
    expect(getItemAtSlot(result, 0)?.itemId).toBe("item");
    expect(getItemAtSlot(result, 5)).toBeUndefined();
  });

  it("preserves item data during moves", () => {
    const items = [
      {
        slot: 0,
        itemId: "bronze_sword",
        quantity: 1,
        item: {
          id: "bronze_sword",
          name: "Bronze Sword",
          type: "weapon",
          stackable: false,
          weight: 1.8,
        },
      },
    ];

    const result = applyMove(items, 0, 5);
    const movedItem = getItemAtSlot(result, 5);

    expect(movedItem?.item.name).toBe("Bronze Sword");
    expect(movedItem?.item.weight).toBe(1.8);
    expect(movedItem?.item.type).toBe("weapon");
  });
});
