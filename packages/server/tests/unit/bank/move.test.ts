/**
 * Bank Move Unit Tests
 *
 * Tests for swap and insert mode reorganization logic.
 * Uses mock classes following the existing codebase pattern.
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Types
// ============================================================================

interface BankSlot {
  id: number;
  playerId: string;
  itemId: string;
  quantity: number;
  slot: number;
  tabIndex: number;
}

// ============================================================================
// Mock Bank Move Manager
// ============================================================================

/**
 * Mock bank move manager that tests the ALGORITHM logic
 * for swap and insert mode operations.
 */
class MockBankMoveManager {
  private bankData: BankSlot[] = [];
  private nextId = 1;

  constructor(initialData: Omit<BankSlot, "id">[]) {
    this.bankData = initialData.map((item) => ({
      ...item,
      id: this.nextId++,
    }));
  }

  /**
   * Swap mode: Exchange positions of two items
   *
   * If destination is empty, just moves the item.
   * If destination has item, swaps positions.
   */
  swapItems(
    playerId: string,
    tabIndex: number,
    fromSlot: number,
    toSlot: number,
  ): { success: boolean; error?: string } {
    // No-op if same slot
    if (fromSlot === toSlot) {
      return { success: true };
    }

    const fromItem = this.bankData.find(
      (i) =>
        i.playerId === playerId &&
        i.tabIndex === tabIndex &&
        i.slot === fromSlot,
    );

    if (!fromItem) {
      return { success: false, error: "SLOT_EMPTY" };
    }

    const toItem = this.bankData.find(
      (i) =>
        i.playerId === playerId && i.tabIndex === tabIndex && i.slot === toSlot,
    );

    if (toItem) {
      // Both slots have items - swap them
      toItem.slot = fromSlot;
      fromItem.slot = toSlot;
    } else {
      // Destination empty - just move
      fromItem.slot = toSlot;
    }

    return { success: true };
  }

  /**
   * Insert mode: Insert at position, shift others
   *
   * When moving right: items between fromSlot+1 and toSlot shift LEFT by 1
   * When moving left: items between toSlot and fromSlot-1 shift RIGHT by 1
   */
  insertItem(
    playerId: string,
    tabIndex: number,
    fromSlot: number,
    toSlot: number,
  ): { success: boolean; error?: string } {
    // No-op if same slot
    if (fromSlot === toSlot) {
      return { success: true };
    }

    const fromItem = this.bankData.find(
      (i) =>
        i.playerId === playerId &&
        i.tabIndex === tabIndex &&
        i.slot === fromSlot,
    );

    if (!fromItem) {
      return { success: false, error: "SLOT_EMPTY" };
    }

    // Temporarily mark fromItem as "moving"
    const tempSlot = -1000;
    fromItem.slot = tempSlot;

    if (fromSlot < toSlot) {
      // Moving right: shift items in range left by 1
      for (const item of this.bankData) {
        if (
          item.playerId === playerId &&
          item.tabIndex === tabIndex &&
          item.slot > fromSlot &&
          item.slot <= toSlot
        ) {
          item.slot -= 1;
        }
      }
    } else {
      // Moving left: shift items in range right by 1
      for (const item of this.bankData) {
        if (
          item.playerId === playerId &&
          item.tabIndex === tabIndex &&
          item.slot >= toSlot &&
          item.slot < fromSlot
        ) {
          item.slot += 1;
        }
      }
    }

    // Place item at destination
    fromItem.slot = toSlot;

    return { success: true };
  }

  /**
   * Get current bank state for assertions
   */
  getBankState(): BankSlot[] {
    return [...this.bankData].sort((a, b) => a.slot - b.slot);
  }

  /**
   * Get slots for a specific player and tab
   */
  getSlots(playerId: string, tabIndex: number): number[] {
    return this.bankData
      .filter(
        (item) => item.playerId === playerId && item.tabIndex === tabIndex,
      )
      .map((item) => item.slot)
      .sort((a, b) => a - b);
  }

  /**
   * Get item at specific slot
   */
  getItemAtSlot(
    playerId: string,
    tabIndex: number,
    slot: number,
  ): BankSlot | undefined {
    return this.bankData.find(
      (item) =>
        item.playerId === playerId &&
        item.tabIndex === tabIndex &&
        item.slot === slot,
    );
  }

  /**
   * Get item order (item IDs in slot order)
   */
  getItemOrder(playerId: string, tabIndex: number): string[] {
    return this.bankData
      .filter(
        (item) => item.playerId === playerId && item.tabIndex === tabIndex,
      )
      .sort((a, b) => a.slot - b.slot)
      .map((item) => item.itemId);
  }
}

// ============================================================================
// Swap Mode Tests
// ============================================================================

describe("Bank Move - Swap Mode", () => {
  describe("Basic Swaps", () => {
    it("swaps two adjacent items", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "coins",
          quantity: 100,
          slot: 1,
          tabIndex: 0,
        },
      ]);

      manager.swapItems("player-1", 0, 0, 1);

      const order = manager.getItemOrder("player-1", 0);
      expect(order).toEqual(["coins", "logs"]);
    });

    it("swaps items with a gap between them", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "coins",
          quantity: 100,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "iron_ore",
          quantity: 5,
          slot: 2,
          tabIndex: 0,
        },
      ]);

      manager.swapItems("player-1", 0, 0, 2);

      const order = manager.getItemOrder("player-1", 0);
      expect(order).toEqual(["iron_ore", "coins", "logs"]);
    });

    it("moves item to empty slot", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "coins",
          quantity: 100,
          slot: 1,
          tabIndex: 0,
        },
      ]);

      // Move logs to slot 3 (empty)
      manager.swapItems("player-1", 0, 0, 3);

      const logs = manager.getItemAtSlot("player-1", 0, 3);
      expect(logs?.itemId).toBe("logs");
      expect(manager.getItemAtSlot("player-1", 0, 0)).toBeUndefined();
    });

    it("returns error when source slot is empty", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.swapItems("player-1", 0, 5, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("SLOT_EMPTY");
    });

    it("no-op when swapping same slot", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.swapItems("player-1", 0, 0, 0);

      expect(result.success).toBe(true);
      expect(manager.getItemAtSlot("player-1", 0, 0)?.itemId).toBe("logs");
    });
  });

  describe("Tab Isolation", () => {
    it("swap only affects specified tab", () => {
      const manager = new MockBankMoveManager([
        // Tab 0
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "coins",
          quantity: 100,
          slot: 1,
          tabIndex: 0,
        },
        // Tab 1
        {
          playerId: "player-1",
          itemId: "iron_ore",
          quantity: 5,
          slot: 0,
          tabIndex: 1,
        },
        {
          playerId: "player-1",
          itemId: "bronze",
          quantity: 1,
          slot: 1,
          tabIndex: 1,
        },
      ]);

      manager.swapItems("player-1", 0, 0, 1);

      // Tab 0 should be swapped
      expect(manager.getItemOrder("player-1", 0)).toEqual(["coins", "logs"]);
      // Tab 1 should be unchanged
      expect(manager.getItemOrder("player-1", 1)).toEqual([
        "iron_ore",
        "bronze",
      ]);
    });
  });

  describe("Player Isolation", () => {
    it("swap only affects specified player", () => {
      const manager = new MockBankMoveManager([
        // Player 1
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "coins",
          quantity: 100,
          slot: 1,
          tabIndex: 0,
        },
        // Player 2
        {
          playerId: "player-2",
          itemId: "iron_ore",
          quantity: 5,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-2",
          itemId: "bronze",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
      ]);

      manager.swapItems("player-1", 0, 0, 1);

      // Player 1 should be swapped
      expect(manager.getItemOrder("player-1", 0)).toEqual(["coins", "logs"]);
      // Player 2 should be unchanged
      expect(manager.getItemOrder("player-2", 0)).toEqual([
        "iron_ore",
        "bronze",
      ]);
    });
  });
});

// ============================================================================
// Insert Mode Tests
// ============================================================================

describe("Bank Move - Insert Mode", () => {
  describe("Moving Right (shift left)", () => {
    it("inserts item one position right", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "A",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "B",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "C",
          quantity: 1,
          slot: 2,
          tabIndex: 0,
        },
      ]);

      // Insert A after B (at position 1)
      manager.insertItem("player-1", 0, 0, 1);

      // B shifts left, A takes position 1
      expect(manager.getItemOrder("player-1", 0)).toEqual(["B", "A", "C"]);
    });

    it("inserts item multiple positions right", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "A",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "B",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "C",
          quantity: 1,
          slot: 2,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "D",
          quantity: 1,
          slot: 3,
          tabIndex: 0,
        },
      ]);

      // Insert A after C (at position 2)
      manager.insertItem("player-1", 0, 0, 2);

      // B and C shift left, A takes position 2
      expect(manager.getItemOrder("player-1", 0)).toEqual(["B", "C", "A", "D"]);
    });

    it("inserts item to end", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "A",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "B",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "C",
          quantity: 1,
          slot: 2,
          tabIndex: 0,
        },
      ]);

      // Insert A at end (position 2)
      manager.insertItem("player-1", 0, 0, 2);

      expect(manager.getItemOrder("player-1", 0)).toEqual(["B", "C", "A"]);
    });
  });

  describe("Moving Left (shift right)", () => {
    it("inserts item one position left", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "A",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "B",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "C",
          quantity: 1,
          slot: 2,
          tabIndex: 0,
        },
      ]);

      // Insert C before B (at position 1)
      manager.insertItem("player-1", 0, 2, 1);

      // B shifts right, C takes position 1
      expect(manager.getItemOrder("player-1", 0)).toEqual(["A", "C", "B"]);
    });

    it("inserts item multiple positions left", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "A",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "B",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "C",
          quantity: 1,
          slot: 2,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "D",
          quantity: 1,
          slot: 3,
          tabIndex: 0,
        },
      ]);

      // Insert D before B (at position 1)
      manager.insertItem("player-1", 0, 3, 1);

      // B and C shift right, D takes position 1
      expect(manager.getItemOrder("player-1", 0)).toEqual(["A", "D", "B", "C"]);
    });

    it("inserts item to beginning", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "A",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "B",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "C",
          quantity: 1,
          slot: 2,
          tabIndex: 0,
        },
      ]);

      // Insert C at beginning (position 0)
      manager.insertItem("player-1", 0, 2, 0);

      expect(manager.getItemOrder("player-1", 0)).toEqual(["C", "A", "B"]);
    });
  });

  describe("Error Cases", () => {
    it("returns error when source slot is empty", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.insertItem("player-1", 0, 5, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("SLOT_EMPTY");
    });

    it("no-op when inserting at same slot", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.insertItem("player-1", 0, 0, 0);

      expect(result.success).toBe(true);
      expect(manager.getItemAtSlot("player-1", 0, 0)?.itemId).toBe("logs");
    });
  });

  describe("Tab Isolation", () => {
    it("insert only affects specified tab", () => {
      const manager = new MockBankMoveManager([
        // Tab 0
        {
          playerId: "player-1",
          itemId: "A",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "B",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "C",
          quantity: 1,
          slot: 2,
          tabIndex: 0,
        },
        // Tab 1
        {
          playerId: "player-1",
          itemId: "X",
          quantity: 1,
          slot: 0,
          tabIndex: 1,
        },
        {
          playerId: "player-1",
          itemId: "Y",
          quantity: 1,
          slot: 1,
          tabIndex: 1,
        },
      ]);

      manager.insertItem("player-1", 0, 0, 2);

      // Tab 0 should be reorganized
      expect(manager.getItemOrder("player-1", 0)).toEqual(["B", "C", "A"]);
      // Tab 1 should be unchanged
      expect(manager.getItemOrder("player-1", 1)).toEqual(["X", "Y"]);
    });
  });

  describe("Player Isolation", () => {
    it("insert only affects specified player", () => {
      const manager = new MockBankMoveManager([
        // Player 1
        {
          playerId: "player-1",
          itemId: "A",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "B",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        // Player 2
        {
          playerId: "player-2",
          itemId: "X",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-2",
          itemId: "Y",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
      ]);

      manager.insertItem("player-1", 0, 0, 1);

      // Player 1 should be reorganized
      expect(manager.getItemOrder("player-1", 0)).toEqual(["B", "A"]);
      // Player 2 should be unchanged
      expect(manager.getItemOrder("player-2", 0)).toEqual(["X", "Y"]);
    });
  });

  describe("Complex Scenarios", () => {
    it("handles full bank reorganization", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "A",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "B",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "C",
          quantity: 1,
          slot: 2,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "D",
          quantity: 1,
          slot: 3,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "E",
          quantity: 1,
          slot: 4,
          tabIndex: 0,
        },
      ]);

      // Reverse the order by sequential inserts
      manager.insertItem("player-1", 0, 4, 0); // E to start
      manager.insertItem("player-1", 0, 4, 1); // D after E
      manager.insertItem("player-1", 0, 4, 2); // C after D
      manager.insertItem("player-1", 0, 4, 3); // B after C

      expect(manager.getItemOrder("player-1", 0)).toEqual([
        "E",
        "D",
        "C",
        "B",
        "A",
      ]);
    });

    it("maintains slot uniqueness during insert", () => {
      const manager = new MockBankMoveManager([
        {
          playerId: "player-1",
          itemId: "A",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "B",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "C",
          quantity: 1,
          slot: 2,
          tabIndex: 0,
        },
      ]);

      manager.insertItem("player-1", 0, 0, 2);

      // All slots should be unique
      const slots = manager.getSlots("player-1", 0);
      const uniqueSlots = new Set(slots);
      expect(uniqueSlots.size).toBe(slots.length);
    });
  });
});
