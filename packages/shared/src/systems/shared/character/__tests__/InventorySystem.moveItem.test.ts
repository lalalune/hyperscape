/**
 * InventorySystem.moveItem Unit Tests
 *
 * Tests the OSRS-style slot swap functionality:
 * - Basic swap between two occupied slots
 * - Move to empty slot
 * - Same-slot no-op
 * - Empty source slot rejection
 * - Out-of-bounds slot rejection
 * - Invalid slot type rejection
 *
 * NOTE: Uses mocked system logic to avoid circular dependency issues.
 */

import { describe, it, expect, beforeEach } from "bun:test";

// ============================================================================
// Types
// ============================================================================

interface InventoryItem {
  itemId: string;
  quantity: number;
  slot: number;
}

interface MoveItemData {
  playerId: string;
  fromSlot?: number;
  toSlot?: number;
  sourceSlot?: number;
  targetSlot?: number;
}

// ============================================================================
// Mock Inventory Manager (core moveItem logic)
// ============================================================================

class MockInventoryManager {
  private items = new Map<number, InventoryItem>();
  private readonly MAX_SLOTS = 28;
  private errors: string[] = [];
  private updateEmitted = false;
  private persistScheduled = false;

  /**
   * Add an item to a specific slot for test setup
   */
  setupItem(slot: number, itemId: string, quantity: number = 1): void {
    this.items.set(slot, { slot, itemId, quantity });
  }

  /**
   * Get item at slot (for assertions)
   */
  getItem(slot: number): InventoryItem | undefined {
    return this.items.get(slot);
  }

  /**
   * Get all items (for assertions)
   */
  getAllItems(): InventoryItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get logged errors (for assertions)
   */
  getErrors(): string[] {
    return this.errors;
  }

  /**
   * Check if update was emitted
   */
  wasUpdateEmitted(): boolean {
    return this.updateEmitted;
  }

  /**
   * Check if persist was scheduled
   */
  wasPersistScheduled(): boolean {
    return this.persistScheduled;
  }

  /**
   * Reset state between tests
   */
  reset(): void {
    this.items.clear();
    this.errors = [];
    this.updateEmitted = false;
    this.persistScheduled = false;
  }

  /**
   * Move/swap items between slots (mirrors InventorySystem.moveItem)
   */
  moveItem(data: MoveItemData): void {
    // Validate playerId
    if (!data.playerId) {
      this.errors.push("Cannot move item: playerId is undefined");
      return;
    }

    // Handle parameter name variations
    const fromSlot = data.fromSlot ?? data.sourceSlot;
    const toSlot = data.toSlot ?? data.targetSlot;

    // Validate slot presence
    if (fromSlot === undefined || toSlot === undefined) {
      this.errors.push("Cannot move item: slot numbers are undefined");
      return;
    }

    // Validate fromSlot bounds
    if (
      !Number.isInteger(fromSlot) ||
      fromSlot < 0 ||
      fromSlot >= this.MAX_SLOTS
    ) {
      this.errors.push(
        `Cannot move item: fromSlot ${fromSlot} out of bounds [0, ${this.MAX_SLOTS})`,
      );
      return;
    }

    // Validate toSlot bounds
    if (!Number.isInteger(toSlot) || toSlot < 0 || toSlot >= this.MAX_SLOTS) {
      this.errors.push(
        `Cannot move item: toSlot ${toSlot} out of bounds [0, ${this.MAX_SLOTS})`,
      );
      return;
    }

    // Same slot - no-op
    if (fromSlot === toSlot) {
      return;
    }

    const fromItem = this.items.get(fromSlot);
    const toItem = this.items.get(toSlot);

    // Can't move from empty slot
    if (!fromItem) {
      this.errors.push(`moveItem: source slot ${fromSlot} is empty`);
      return;
    }

    // OSRS-style swap
    if (toItem) {
      // Both slots occupied - swap
      fromItem.slot = toSlot;
      toItem.slot = fromSlot;
      this.items.set(toSlot, fromItem);
      this.items.set(fromSlot, toItem);
    } else {
      // Only source occupied - move to empty destination
      fromItem.slot = toSlot;
      this.items.delete(fromSlot);
      this.items.set(toSlot, fromItem);
    }

    // Mark that we would emit update and schedule persist
    this.updateEmitted = true;
    this.persistScheduled = true;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("InventorySystem.moveItem", () => {
  let manager: MockInventoryManager;

  beforeEach(() => {
    manager = new MockInventoryManager();
    manager.reset();
  });

  describe("Basic swap between two occupied slots", () => {
    it("swaps sword in slot 0 with shield in slot 5", () => {
      manager.setupItem(0, "bronze_sword", 1);
      manager.setupItem(5, "bronze_shield", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: 5,
      });

      expect(manager.getItem(0)?.itemId).toBe("bronze_shield");
      expect(manager.getItem(5)?.itemId).toBe("bronze_sword");
      expect(manager.wasUpdateEmitted()).toBe(true);
      expect(manager.wasPersistScheduled()).toBe(true);
    });

    it("swaps items with quantities preserved", () => {
      manager.setupItem(0, "coins", 1000);
      manager.setupItem(10, "arrows", 50);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: 10,
      });

      expect(manager.getItem(0)?.itemId).toBe("arrows");
      expect(manager.getItem(0)?.quantity).toBe(50);
      expect(manager.getItem(10)?.itemId).toBe("coins");
      expect(manager.getItem(10)?.quantity).toBe(1000);
    });

    it("updates slot property on swapped items", () => {
      manager.setupItem(3, "item_a", 1);
      manager.setupItem(7, "item_b", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 3,
        toSlot: 7,
      });

      expect(manager.getItem(3)?.slot).toBe(3);
      expect(manager.getItem(7)?.slot).toBe(7);
    });
  });

  describe("Move to empty slot", () => {
    it("moves item from slot 0 to empty slot 10", () => {
      manager.setupItem(0, "bronze_sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: 10,
      });

      expect(manager.getItem(0)).toBeUndefined();
      expect(manager.getItem(10)?.itemId).toBe("bronze_sword");
      expect(manager.wasUpdateEmitted()).toBe(true);
    });

    it("moves item to last slot (27)", () => {
      manager.setupItem(0, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: 27,
      });

      expect(manager.getItem(0)).toBeUndefined();
      expect(manager.getItem(27)?.itemId).toBe("sword");
    });
  });

  describe("Same-slot no-op", () => {
    it("does nothing when fromSlot equals toSlot", () => {
      manager.setupItem(5, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 5,
        toSlot: 5,
      });

      expect(manager.getItem(5)?.itemId).toBe("sword");
      expect(manager.wasUpdateEmitted()).toBe(false);
      expect(manager.wasPersistScheduled()).toBe(false);
      expect(manager.getErrors()).toHaveLength(0);
    });
  });

  describe("Empty source slot rejection", () => {
    it("rejects move from empty slot and logs error", () => {
      manager.setupItem(5, "sword", 1); // Item in slot 5, slot 0 is empty

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0, // Empty
        toSlot: 5,
      });

      // Item should not have moved
      expect(manager.getItem(5)?.itemId).toBe("sword");
      expect(manager.getItem(0)).toBeUndefined();
      expect(manager.wasUpdateEmitted()).toBe(false);
      expect(manager.getErrors()).toContain("moveItem: source slot 0 is empty");
    });
  });

  describe("Out-of-bounds slot rejection", () => {
    it("rejects negative fromSlot", () => {
      manager.setupItem(0, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: -1,
        toSlot: 5,
      });

      expect(manager.getItem(0)?.itemId).toBe("sword");
      expect(manager.wasUpdateEmitted()).toBe(false);
      expect(manager.getErrors()[0]).toContain("fromSlot -1 out of bounds");
    });

    it("rejects fromSlot >= 28", () => {
      manager.setupItem(0, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 28,
        toSlot: 5,
      });

      expect(manager.wasUpdateEmitted()).toBe(false);
      expect(manager.getErrors()[0]).toContain("fromSlot 28 out of bounds");
    });

    it("rejects negative toSlot", () => {
      manager.setupItem(0, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: -5,
      });

      expect(manager.getItem(0)?.itemId).toBe("sword");
      expect(manager.wasUpdateEmitted()).toBe(false);
      expect(manager.getErrors()[0]).toContain("toSlot -5 out of bounds");
    });

    it("rejects toSlot >= 28", () => {
      manager.setupItem(0, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: 100,
      });

      expect(manager.getItem(0)?.itemId).toBe("sword");
      expect(manager.wasUpdateEmitted()).toBe(false);
      expect(manager.getErrors()[0]).toContain("toSlot 100 out of bounds");
    });
  });

  describe("Invalid slot type rejection", () => {
    it("rejects non-integer fromSlot", () => {
      manager.setupItem(0, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 1.5,
        toSlot: 5,
      });

      expect(manager.wasUpdateEmitted()).toBe(false);
      expect(manager.getErrors()[0]).toContain("fromSlot 1.5 out of bounds");
    });

    it("rejects NaN slots", () => {
      manager.setupItem(0, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: NaN,
        toSlot: 5,
      });

      expect(manager.wasUpdateEmitted()).toBe(false);
      expect(manager.getErrors().length).toBeGreaterThan(0);
    });

    it("rejects undefined slots", () => {
      manager.setupItem(0, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        // fromSlot and toSlot undefined
      });

      expect(manager.wasUpdateEmitted()).toBe(false);
      expect(manager.getErrors()).toContain(
        "Cannot move item: slot numbers are undefined",
      );
    });
  });

  describe("PlayerId validation", () => {
    it("rejects empty playerId", () => {
      manager.setupItem(0, "sword", 1);

      manager.moveItem({
        playerId: "",
        fromSlot: 0,
        toSlot: 5,
      });

      expect(manager.getItem(0)?.itemId).toBe("sword");
      expect(manager.wasUpdateEmitted()).toBe(false);
      expect(manager.getErrors()).toContain(
        "Cannot move item: playerId is undefined",
      );
    });
  });

  describe("Parameter name variations", () => {
    it("accepts sourceSlot/targetSlot instead of fromSlot/toSlot", () => {
      manager.setupItem(0, "sword", 1);
      manager.setupItem(5, "shield", 1);

      manager.moveItem({
        playerId: "player-123",
        sourceSlot: 0,
        targetSlot: 5,
      });

      expect(manager.getItem(0)?.itemId).toBe("shield");
      expect(manager.getItem(5)?.itemId).toBe("sword");
      expect(manager.wasUpdateEmitted()).toBe(true);
    });

    it("prefers fromSlot/toSlot over sourceSlot/targetSlot", () => {
      manager.setupItem(0, "sword", 1);
      manager.setupItem(5, "shield", 1);
      manager.setupItem(10, "helmet", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: 5,
        sourceSlot: 0,
        targetSlot: 10, // Should be ignored
      });

      // Should use fromSlot/toSlot
      expect(manager.getItem(0)?.itemId).toBe("shield");
      expect(manager.getItem(5)?.itemId).toBe("sword");
      expect(manager.getItem(10)?.itemId).toBe("helmet"); // Unchanged
    });
  });

  describe("Item count preservation", () => {
    it("never creates or destroys items during swap", () => {
      manager.setupItem(0, "sword", 1);
      manager.setupItem(5, "shield", 1);
      manager.setupItem(10, "helmet", 1);

      const initialCount = manager.getAllItems().length;

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: 5,
      });

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 5,
        toSlot: 10,
      });

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 10,
        toSlot: 0,
      });

      expect(manager.getAllItems().length).toBe(initialCount);
    });

    it("maintains correct count when moving to empty slot", () => {
      manager.setupItem(0, "sword", 1);

      const initialCount = manager.getAllItems().length;

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: 15,
      });

      expect(manager.getAllItems().length).toBe(initialCount);
    });
  });

  describe("Boundary values", () => {
    it("accepts slot 0", () => {
      manager.setupItem(0, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: 1,
      });

      expect(manager.getItem(1)?.itemId).toBe("sword");
      expect(manager.wasUpdateEmitted()).toBe(true);
    });

    it("accepts slot 27", () => {
      manager.setupItem(27, "sword", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 27,
        toSlot: 0,
      });

      expect(manager.getItem(0)?.itemId).toBe("sword");
      expect(manager.wasUpdateEmitted()).toBe(true);
    });

    it("allows swap between first and last slots", () => {
      manager.setupItem(0, "first", 1);
      manager.setupItem(27, "last", 1);

      manager.moveItem({
        playerId: "player-123",
        fromSlot: 0,
        toSlot: 27,
      });

      expect(manager.getItem(0)?.itemId).toBe("last");
      expect(manager.getItem(27)?.itemId).toBe("first");
    });
  });
});
