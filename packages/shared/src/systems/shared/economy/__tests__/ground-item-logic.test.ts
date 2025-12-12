/**
 * Ground Item Logic Unit Tests
 *
 * Tests all pure ground item functions in isolation.
 */

import { describe, it, expect } from "bun:test";
import { ValidationError } from "../../../../validation";
import {
  type GroundItem,
  type Position3D,
  GROUND_ITEM_CONSTANTS,
  validateDropRequest,
  validatePickupRequest,
  validatePosition,
  generateGroundItemId,
  calculateDistance,
  calculateDistance2D,
  isInPickupRange,
  createGroundItem,
  hasItemDespawned,
  isItemPublic,
  canPickupItem,
  canDropItem,
  countItemsAtTile,
  getItemsAtPosition,
  findGroundItem,
  getVisibleItems,
  getItemsInRange,
  calculateDrop,
  calculatePickup,
  removeExpiredItems,
  updateItemVisibility,
  addGroundItem,
  removeGroundItem,
  getClosestItem,
  sortByDistance,
  sortByDespawnTime,
} from "../ground-item-logic";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTestGroundItem(
  id: string,
  itemId: string = "coins",
  position: Position3D = { x: 10, y: 0, z: 10 },
  droppedAt: number = 1000,
  droppedBy?: string,
): GroundItem {
  return {
    id,
    itemId,
    name: itemId.replace(/_/g, " "),
    quantity: 100,
    position,
    droppedBy,
    droppedAt,
    despawnAt: droppedAt + GROUND_ITEM_CONSTANTS.DEFAULT_DESPAWN_TICKS,
    isPublic: droppedBy === undefined,
    stackable: true,
  };
}

function createTestPosition(
  x: number = 10,
  y: number = 0,
  z: number = 10,
): Position3D {
  return { x, y, z };
}

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe("validateDropRequest", () => {
  it("validates correct input", () => {
    const result = validateDropRequest("player-1", "coins", 100);
    expect(result.playerId).toBe("player-1");
    expect(result.itemId).toBe("coins");
    expect(result.quantity).toBe(100);
  });

  it("throws for empty playerId", () => {
    expect(() => validateDropRequest("", "coins", 100)).toThrow(
      ValidationError,
    );
  });

  it("throws for invalid quantity", () => {
    expect(() => validateDropRequest("player-1", "coins", 0)).toThrow(
      ValidationError,
    );
    expect(() => validateDropRequest("player-1", "coins", -1)).toThrow(
      ValidationError,
    );
  });

  it("validates position when provided", () => {
    const position = { x: 10, y: 0, z: 10 };
    expect(() =>
      validateDropRequest("player-1", "coins", 100, position),
    ).not.toThrow();
  });
});

describe("validatePickupRequest", () => {
  it("validates correct input", () => {
    const result = validatePickupRequest("player-1", "ground_item_1");
    expect(result.playerId).toBe("player-1");
    expect(result.groundItemId).toBe("ground_item_1");
  });

  it("throws for empty playerId", () => {
    expect(() => validatePickupRequest("", "ground_item_1")).toThrow(
      ValidationError,
    );
  });

  it("throws for empty groundItemId", () => {
    expect(() => validatePickupRequest("player-1", "")).toThrow(
      ValidationError,
    );
  });
});

describe("validatePosition", () => {
  it("passes for valid position", () => {
    expect(() => validatePosition({ x: 100, y: 50, z: -100 })).not.toThrow();
  });

  it("throws for non-object", () => {
    expect(() => validatePosition(null as unknown as Position3D)).toThrow(
      ValidationError,
    );
  });

  it("throws for invalid x coordinate", () => {
    expect(() => validatePosition({ x: NaN, y: 0, z: 0 })).toThrow(
      ValidationError,
    );
    expect(() => validatePosition({ x: Infinity, y: 0, z: 0 })).toThrow(
      ValidationError,
    );
  });

  it("throws for position outside world bounds", () => {
    expect(() => validatePosition({ x: 20000, y: 0, z: 0 })).toThrow(
      ValidationError,
    );
    expect(() => validatePosition({ x: 0, y: 0, z: -20000 })).toThrow(
      ValidationError,
    );
  });
});

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe("generateGroundItemId", () => {
  it("generates unique IDs", () => {
    const id1 = generateGroundItemId("coins", { x: 10, y: 0, z: 10 }, 1000);
    const id2 = generateGroundItemId("coins", { x: 10, y: 0, z: 10 }, 1001);
    expect(id1).not.toBe(id2);
  });

  it("includes item ID in generated ID", () => {
    const id = generateGroundItemId("bronze_sword", { x: 5, y: 0, z: 5 }, 100);
    expect(id).toContain("bronze_sword");
  });
});

describe("calculateDistance", () => {
  it("calculates 3D distance correctly", () => {
    const pos1 = { x: 0, y: 0, z: 0 };
    const pos2 = { x: 3, y: 4, z: 0 };
    expect(calculateDistance(pos1, pos2)).toBe(5);
  });

  it("returns 0 for same position", () => {
    const pos = { x: 10, y: 20, z: 30 };
    expect(calculateDistance(pos, pos)).toBe(0);
  });
});

describe("calculateDistance2D", () => {
  it("ignores Y axis", () => {
    const pos1 = { x: 0, y: 100, z: 0 };
    const pos2 = { x: 3, y: 0, z: 4 };
    expect(calculateDistance2D(pos1, pos2)).toBe(5);
  });
});

describe("isInPickupRange", () => {
  it("returns true when within range", () => {
    const player = { x: 10, y: 0, z: 10 };
    const item = { x: 11, y: 0, z: 10 };
    expect(isInPickupRange(player, item)).toBe(true);
  });

  it("returns false when outside range", () => {
    const player = { x: 0, y: 0, z: 0 };
    const item = { x: 100, y: 0, z: 100 };
    expect(isInPickupRange(player, item)).toBe(false);
  });

  it("respects custom range parameter", () => {
    const player = { x: 0, y: 0, z: 0 };
    const item = { x: 5, y: 0, z: 0 };
    expect(isInPickupRange(player, item, 10)).toBe(true);
    expect(isInPickupRange(player, item, 3)).toBe(false);
  });
});

// =============================================================================
// GROUND ITEM CREATION TESTS
// =============================================================================

describe("createGroundItem", () => {
  it("creates ground item with correct properties", () => {
    const item = createGroundItem(
      "coins",
      "Gold Coins",
      1000,
      { x: 10, y: 0, z: 10 },
      "player-1",
      5000,
    );

    expect(item.itemId).toBe("coins");
    expect(item.name).toBe("Gold Coins");
    expect(item.quantity).toBe(1000);
    expect(item.droppedBy).toBe("player-1");
    expect(item.droppedAt).toBe(5000);
    expect(item.isPublic).toBe(false);
  });

  it("creates public item when no owner", () => {
    const item = createGroundItem(
      "coins",
      "Coins",
      100,
      { x: 10, y: 0, z: 10 },
      undefined,
      5000,
    );

    expect(item.isPublic).toBe(true);
    expect(item.droppedBy).toBeUndefined();
  });

  it("generates unique ID", () => {
    const item1 = createGroundItem(
      "coins",
      "Coins",
      100,
      { x: 10, y: 0, z: 10 },
      "p1",
      1000,
    );
    const item2 = createGroundItem(
      "coins",
      "Coins",
      100,
      { x: 10, y: 0, z: 10 },
      "p1",
      1001,
    );
    expect(item1.id).not.toBe(item2.id);
  });

  it("copies position object", () => {
    const position = { x: 10, y: 0, z: 10 };
    const item = createGroundItem("coins", "Coins", 100, position, "p1", 1000);

    position.x = 999;
    expect(item.position.x).toBe(10); // Not affected by mutation
  });
});

// =============================================================================
// ITEM STATE TESTS
// =============================================================================

describe("hasItemDespawned", () => {
  it("returns false before despawn time", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      createTestPosition(),
      1000,
    );
    expect(hasItemDespawned(item, 1100)).toBe(false);
  });

  it("returns true at despawn time", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      createTestPosition(),
      1000,
    );
    expect(hasItemDespawned(item, item.despawnAt)).toBe(true);
  });

  it("returns true after despawn time", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      createTestPosition(),
      1000,
    );
    expect(hasItemDespawned(item, item.despawnAt + 100)).toBe(true);
  });
});

describe("isItemPublic", () => {
  it("returns true for items dropped without owner", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      createTestPosition(),
      1000,
      undefined,
    );
    expect(isItemPublic(item, 1000)).toBe(true);
  });

  it("returns false for owned items before public delay", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      createTestPosition(),
      1000,
      "player-1",
    );
    item.isPublic = false;
    expect(isItemPublic(item, 1050)).toBe(false);
  });

  it("returns true for owned items after public delay", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      createTestPosition(),
      1000,
      "player-1",
    );
    item.isPublic = false;
    const publicTick = 1000 + GROUND_ITEM_CONSTANTS.PUBLIC_DELAY_TICKS;
    expect(isItemPublic(item, publicTick)).toBe(true);
  });
});

// =============================================================================
// CAN PICKUP TESTS
// =============================================================================

describe("canPickupItem", () => {
  it("allows pickup when in range and visible", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      { x: 10, y: 0, z: 10 },
      1000,
      "player-1",
    );
    const result = canPickupItem(
      item,
      "player-1",
      { x: 10, y: 0, z: 10 },
      1050,
    );
    expect(result.canPickup).toBe(true);
  });

  it("rejects pickup for despawned items", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      { x: 10, y: 0, z: 10 },
      1000,
    );
    const result = canPickupItem(
      item,
      "player-1",
      { x: 10, y: 0, z: 10 },
      item.despawnAt + 1,
    );
    expect(result.canPickup).toBe(false);
    expect(result.reason).toBe("Item has despawned");
  });

  it("rejects pickup when out of range", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      { x: 10, y: 0, z: 10 },
      1000,
    );
    const result = canPickupItem(
      item,
      "player-1",
      { x: 100, y: 0, z: 100 },
      1050,
    );
    expect(result.canPickup).toBe(false);
    expect(result.reason).toBe("Too far away");
  });

  it("rejects pickup for non-public items by non-owner", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      { x: 10, y: 0, z: 10 },
      1000,
      "player-1",
    );
    item.isPublic = false;
    const result = canPickupItem(
      item,
      "player-2",
      { x: 10, y: 0, z: 10 },
      1010,
    );
    expect(result.canPickup).toBe(false);
    expect(result.reason).toBe("Item belongs to another player");
  });

  it("allows owner to pickup their item", () => {
    const item = createTestGroundItem(
      "test",
      "coins",
      { x: 10, y: 0, z: 10 },
      1000,
      "player-1",
    );
    item.isPublic = false;
    const result = canPickupItem(
      item,
      "player-1",
      { x: 10, y: 0, z: 10 },
      1010,
    );
    expect(result.canPickup).toBe(true);
  });
});

// =============================================================================
// DROP TESTS
// =============================================================================

describe("canDropItem", () => {
  it("allows drop in empty area", () => {
    const result = canDropItem([], { x: 10, y: 0, z: 10 });
    expect(result.canDrop).toBe(true);
  });

  it("rejects drop when tile is full", () => {
    const items: GroundItem[] = [];
    for (let i = 0; i < GROUND_ITEM_CONSTANTS.MAX_ITEMS_PER_TILE; i++) {
      items.push(
        createTestGroundItem(`item_${i}`, "coins", { x: 10.5, y: 0, z: 10.5 }),
      );
    }
    const result = canDropItem(items, { x: 10.5, y: 0, z: 10.5 });
    expect(result.canDrop).toBe(false);
    expect(result.reason).toContain("Too many items");
  });
});

describe("calculateDrop", () => {
  it("creates ground item on successful drop", () => {
    const result = calculateDrop(
      [],
      "coins",
      "Gold Coins",
      100,
      { x: 10, y: 0, z: 10 },
      "player-1",
      1000,
    );

    expect(result.success).toBe(true);
    expect(result.groundItem).toBeDefined();
    expect(result.groundItem?.itemId).toBe("coins");
    expect(result.groundItem?.quantity).toBe(100);
  });

  it("returns error when tile is full", () => {
    const items: GroundItem[] = [];
    for (let i = 0; i < GROUND_ITEM_CONSTANTS.MAX_ITEMS_PER_TILE; i++) {
      items.push(
        createTestGroundItem(`item_${i}`, "coins", { x: 10, y: 0, z: 10 }),
      );
    }
    const result = calculateDrop(
      items,
      "coins",
      "Coins",
      100,
      { x: 10, y: 0, z: 10 },
      "player-1",
      1000,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many items");
  });
});

// =============================================================================
// PICKUP TESTS
// =============================================================================

describe("calculatePickup", () => {
  it("returns success for valid pickup", () => {
    const items = [
      createTestGroundItem("item_1", "coins", { x: 10, y: 0, z: 10 }, 1000),
    ];
    const result = calculatePickup(
      items,
      "item_1",
      "player-1",
      { x: 10, y: 0, z: 10 },
      1050,
    );

    expect(result.success).toBe(true);
    expect(result.itemId).toBe("coins");
    expect(result.quantity).toBe(100);
  });

  it("returns error for missing item", () => {
    const result = calculatePickup(
      [],
      "nonexistent",
      "player-1",
      { x: 10, y: 0, z: 10 },
      1000,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Item not found");
  });

  it("returns error for out-of-range pickup", () => {
    const items = [
      createTestGroundItem("item_1", "coins", { x: 10, y: 0, z: 10 }, 1000),
    ];
    const result = calculatePickup(
      items,
      "item_1",
      "player-1",
      { x: 100, y: 0, z: 100 },
      1050,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Too far away");
  });
});

// =============================================================================
// COLLECTION MANAGEMENT TESTS
// =============================================================================

describe("countItemsAtTile", () => {
  it("returns 0 for empty area", () => {
    expect(countItemsAtTile([], { x: 10, y: 0, z: 10 })).toBe(0);
  });

  it("counts items at same tile", () => {
    const items = [
      createTestGroundItem("1", "coins", { x: 10.2, y: 0, z: 10.3 }),
      createTestGroundItem("2", "logs", { x: 10.8, y: 0, z: 10.9 }),
    ];
    expect(countItemsAtTile(items, { x: 10.5, y: 0, z: 10.5 })).toBe(2);
  });

  it("ignores items at different tiles", () => {
    const items = [
      createTestGroundItem("1", "coins", { x: 10.5, y: 0, z: 10.5 }),
      createTestGroundItem("2", "logs", { x: 20.5, y: 0, z: 20.5 }),
    ];
    expect(countItemsAtTile(items, { x: 10.5, y: 0, z: 10.5 })).toBe(1);
  });
});

describe("findGroundItem", () => {
  it("finds item by ID", () => {
    const items = [
      createTestGroundItem("item_1", "coins"),
      createTestGroundItem("item_2", "logs"),
    ];
    const found = findGroundItem(items, "item_2");
    expect(found?.itemId).toBe("logs");
  });

  it("returns undefined for missing item", () => {
    const items = [createTestGroundItem("item_1", "coins")];
    expect(findGroundItem(items, "nonexistent")).toBeUndefined();
  });
});

describe("getVisibleItems", () => {
  it("returns public items", () => {
    const items = [
      createTestGroundItem(
        "item_1",
        "coins",
        createTestPosition(),
        1000,
        undefined,
      ),
    ];
    const visible = getVisibleItems(items, "player-1", 1050);
    expect(visible.length).toBe(1);
  });

  it("returns owned items", () => {
    const item = createTestGroundItem(
      "item_1",
      "coins",
      createTestPosition(),
      1000,
      "player-1",
    );
    item.isPublic = false;
    const visible = getVisibleItems([item], "player-1", 1010);
    expect(visible.length).toBe(1);
  });

  it("excludes other players private items", () => {
    const item = createTestGroundItem(
      "item_1",
      "coins",
      createTestPosition(),
      1000,
      "player-1",
    );
    item.isPublic = false;
    const visible = getVisibleItems([item], "player-2", 1010);
    expect(visible.length).toBe(0);
  });

  it("excludes despawned items", () => {
    const item = createTestGroundItem(
      "item_1",
      "coins",
      createTestPosition(),
      1000,
    );
    const visible = getVisibleItems([item], "player-1", item.despawnAt + 100);
    expect(visible.length).toBe(0);
  });
});

describe("removeExpiredItems", () => {
  it("removes despawned items", () => {
    const items = [
      createTestGroundItem("item_1", "coins", createTestPosition(), 1000),
      createTestGroundItem("item_2", "logs", createTestPosition(), 2000),
    ];

    // At tick 1500, item_1 should be despawned but not item_2
    const despawnTick = items[0].despawnAt;
    const filtered = removeExpiredItems(items, despawnTick);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("item_2");
  });

  it("does not mutate original array", () => {
    const items = [
      createTestGroundItem("item_1", "coins", createTestPosition(), 1000),
    ];
    removeExpiredItems(items, items[0].despawnAt + 100);
    expect(items.length).toBe(1);
  });
});

describe("updateItemVisibility", () => {
  it("updates non-public items after delay", () => {
    const item = createTestGroundItem(
      "item_1",
      "coins",
      createTestPosition(),
      1000,
      "player-1",
    );
    item.isPublic = false;

    const publicTick = 1000 + GROUND_ITEM_CONSTANTS.PUBLIC_DELAY_TICKS;
    const updated = updateItemVisibility([item], publicTick);

    expect(updated[0].isPublic).toBe(true);
  });

  it("does not affect already public items", () => {
    const item = createTestGroundItem(
      "item_1",
      "coins",
      createTestPosition(),
      1000,
      undefined,
    );
    const updated = updateItemVisibility([item], 1050);
    expect(updated[0].isPublic).toBe(true);
  });

  it("does not mutate original array", () => {
    const item = createTestGroundItem(
      "item_1",
      "coins",
      createTestPosition(),
      1000,
      "player-1",
    );
    item.isPublic = false;

    const publicTick = 1000 + GROUND_ITEM_CONSTANTS.PUBLIC_DELAY_TICKS;
    updateItemVisibility([item], publicTick);

    expect(item.isPublic).toBe(false); // Original unchanged
  });
});

describe("addGroundItem", () => {
  it("adds item to list", () => {
    const items = [createTestGroundItem("item_1", "coins")];
    const newItem = createTestGroundItem("item_2", "logs");
    const result = addGroundItem(items, newItem);

    expect(result.length).toBe(2);
    expect(result[1].id).toBe("item_2");
  });

  it("does not mutate original array", () => {
    const items = [createTestGroundItem("item_1", "coins")];
    const newItem = createTestGroundItem("item_2", "logs");
    addGroundItem(items, newItem);

    expect(items.length).toBe(1);
  });
});

describe("removeGroundItem", () => {
  it("removes item from list", () => {
    const items = [
      createTestGroundItem("item_1", "coins"),
      createTestGroundItem("item_2", "logs"),
    ];
    const result = removeGroundItem(items, "item_1");

    expect(result.length).toBe(1);
    expect(result[0].id).toBe("item_2");
  });

  it("does not mutate original array", () => {
    const items = [createTestGroundItem("item_1", "coins")];
    removeGroundItem(items, "item_1");

    expect(items.length).toBe(1);
  });
});

// =============================================================================
// SORTING TESTS
// =============================================================================

describe("getClosestItem", () => {
  it("returns closest item", () => {
    const items = [
      createTestGroundItem("far", "coins", { x: 100, y: 0, z: 100 }),
      createTestGroundItem("close", "logs", { x: 11, y: 0, z: 10 }),
      createTestGroundItem("mid", "fish", { x: 20, y: 0, z: 20 }),
    ];

    const closest = getClosestItem(items, { x: 10, y: 0, z: 10 });
    expect(closest?.id).toBe("close");
  });

  it("returns undefined for empty array", () => {
    expect(getClosestItem([], { x: 10, y: 0, z: 10 })).toBeUndefined();
  });
});

describe("sortByDistance", () => {
  it("sorts items by distance", () => {
    const items = [
      createTestGroundItem("far", "coins", { x: 100, y: 0, z: 100 }),
      createTestGroundItem("close", "logs", { x: 11, y: 0, z: 10 }),
      createTestGroundItem("mid", "fish", { x: 20, y: 0, z: 20 }),
    ];

    const sorted = sortByDistance(items, { x: 10, y: 0, z: 10 });
    expect(sorted[0].id).toBe("close");
    expect(sorted[sorted.length - 1].id).toBe("far");
  });

  it("does not mutate original array", () => {
    const items = [
      createTestGroundItem("far", "coins", { x: 100, y: 0, z: 100 }),
      createTestGroundItem("close", "logs", { x: 11, y: 0, z: 10 }),
    ];

    sortByDistance(items, { x: 10, y: 0, z: 10 });
    expect(items[0].id).toBe("far"); // Original unchanged
  });
});

describe("sortByDespawnTime", () => {
  it("sorts items by despawn time", () => {
    const items = [
      createTestGroundItem("later", "coins", createTestPosition(), 2000),
      createTestGroundItem("sooner", "logs", createTestPosition(), 1000),
      createTestGroundItem("mid", "fish", createTestPosition(), 1500),
    ];

    const sorted = sortByDespawnTime(items);
    expect(sorted[0].id).toBe("sooner");
    expect(sorted[sorted.length - 1].id).toBe("later");
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("edge cases", () => {
  it("handles items at position (0, 0, 0)", () => {
    const item = createGroundItem(
      "coins",
      "Coins",
      100,
      { x: 0, y: 0, z: 0 },
      "player-1",
      1000,
    );
    expect(item.position.x).toBe(0);
  });

  it("handles negative coordinates", () => {
    const item = createGroundItem(
      "coins",
      "Coins",
      100,
      { x: -50, y: 0, z: -50 },
      "player-1",
      1000,
    );
    expect(item.position.x).toBe(-50);

    const result = canPickupItem(
      item,
      "player-1",
      { x: -50, y: 0, z: -50 },
      1050,
    );
    expect(result.canPickup).toBe(true);
  });

  it("handles single item operations", () => {
    const item = createTestGroundItem("single", "coins");
    const added = addGroundItem([], item);
    expect(added.length).toBe(1);

    const removed = removeGroundItem(added, "single");
    expect(removed.length).toBe(0);
  });
});
