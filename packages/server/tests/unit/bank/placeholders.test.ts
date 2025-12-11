/**
 * Bank Placeholders Unit Tests
 *
 * Tests for RS3-style placeholder system logic.
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

interface InventorySlot {
  id: number;
  playerId: string;
  itemId: string;
  quantity: number;
  slotIndex: number;
}

// ============================================================================
// Mock Bank Placeholder Manager
// ============================================================================

const MAX_INVENTORY_SLOTS = 28;

/**
 * Mock bank placeholder manager that tests the ALGORITHM logic
 * for RS3-style placeholder operations.
 */
class MockBankPlaceholderManager {
  private bankData: BankSlot[] = [];
  private inventoryData: InventorySlot[] = [];
  private playerSettings: Map<string, { alwaysSetPlaceholder: boolean }> =
    new Map();
  private nextBankId = 1;
  private nextInvId = 1;

  constructor(
    bankData: Omit<BankSlot, "id">[],
    inventoryData: Omit<InventorySlot, "id">[] = [],
    settings: Map<string, { alwaysSetPlaceholder: boolean }> = new Map(),
  ) {
    this.bankData = bankData.map((item) => ({
      ...item,
      id: this.nextBankId++,
    }));
    this.inventoryData = inventoryData.map((item) => ({
      ...item,
      id: this.nextInvId++,
    }));
    this.playerSettings = settings;
  }

  /**
   * Withdraw-placeholder: Withdraw all, leave qty=0 placeholder
   *
   * RS3-style: Withdraws all of an item to inventory and leaves qty=0
   */
  withdrawPlaceholder(
    playerId: string,
    itemId: string,
  ): { success: boolean; error?: string; withdrawnQty?: number } {
    // Find bank item
    const bankItem = this.bankData.find(
      (i) => i.playerId === playerId && i.itemId === itemId,
    );

    if (!bankItem) {
      return { success: false, error: "ITEM_NOT_IN_BANK" };
    }

    if (bankItem.quantity === 0) {
      return { success: false, error: "ALREADY_PLACEHOLDER" };
    }

    // Find free inventory slots
    const usedSlots = new Set(
      this.inventoryData
        .filter((i) => i.playerId === playerId)
        .map((i) => i.slotIndex),
    );

    const freeSlots: number[] = [];
    for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
      if (!usedSlots.has(i)) {
        freeSlots.push(i);
      }
    }

    if (freeSlots.length === 0) {
      return { success: false, error: "INVENTORY_FULL" };
    }

    // Withdraw as many as we can (up to all)
    const withdrawQty = Math.min(bankItem.quantity, freeSlots.length);

    // Set bank qty to 0 (placeholder)
    bankItem.quantity = 0;

    // Create inventory items
    for (let i = 0; i < withdrawQty; i++) {
      this.inventoryData.push({
        id: this.nextInvId++,
        playerId,
        itemId,
        quantity: 1,
        slotIndex: freeSlots[i],
      });
    }

    return { success: true, withdrawnQty: withdrawQty };
  }

  /**
   * Release placeholder: Delete qty=0 row and compact slots
   */
  releasePlaceholder(
    playerId: string,
    tabIndex: number,
    slot: number,
  ): { success: boolean; error?: string } {
    const itemIndex = this.bankData.findIndex(
      (i) =>
        i.playerId === playerId && i.tabIndex === tabIndex && i.slot === slot,
    );

    if (itemIndex === -1) {
      return { success: false, error: "SLOT_EMPTY" };
    }

    const item = this.bankData[itemIndex];

    if (item.quantity > 0) {
      return { success: false, error: "NOT_A_PLACEHOLDER" };
    }

    // Delete placeholder
    this.bankData.splice(itemIndex, 1);

    // Compact slots (shift items above deleted slot down by 1)
    for (const bankItem of this.bankData) {
      if (
        bankItem.playerId === playerId &&
        bankItem.tabIndex === tabIndex &&
        bankItem.slot > slot
      ) {
        bankItem.slot -= 1;
      }
    }

    return { success: true };
  }

  /**
   * Release all placeholders: Delete all qty=0 rows and compact
   */
  releaseAllPlaceholders(playerId: string): {
    success: boolean;
    count: number;
  } {
    // Find all placeholders grouped by tab
    const placeholders = this.bankData.filter(
      (i) => i.playerId === playerId && i.quantity === 0,
    );

    const count = placeholders.length;

    if (count === 0) {
      return { success: true, count: 0 };
    }

    // Group by tab
    const byTab = new Map<number, number[]>();
    for (const ph of placeholders) {
      const slots = byTab.get(ph.tabIndex) || [];
      slots.push(ph.slot);
      byTab.set(ph.tabIndex, slots);
    }

    // Delete all qty=0 rows
    this.bankData = this.bankData.filter(
      (i) => !(i.playerId === playerId && i.quantity === 0),
    );

    // Compact each tab (process highest slot first)
    for (const [tabIndex, slots] of byTab) {
      slots.sort((a, b) => b - a); // Descending
      for (const slot of slots) {
        for (const bankItem of this.bankData) {
          if (
            bankItem.playerId === playerId &&
            bankItem.tabIndex === tabIndex &&
            bankItem.slot > slot
          ) {
            bankItem.slot -= 1;
          }
        }
      }
    }

    return { success: true, count };
  }

  /**
   * Toggle always set placeholder setting
   */
  toggleAlwaysPlaceholder(playerId: string): boolean {
    const current = this.playerSettings.get(playerId);
    const newValue = !(current?.alwaysSetPlaceholder ?? false);
    this.playerSettings.set(playerId, { alwaysSetPlaceholder: newValue });
    return newValue;
  }

  /**
   * Get player setting
   */
  getAlwaysPlaceholder(playerId: string): boolean {
    return this.playerSettings.get(playerId)?.alwaysSetPlaceholder ?? false;
  }

  /**
   * Get bank state
   */
  getBankState(playerId: string, tabIndex: number): BankSlot[] {
    return this.bankData
      .filter((i) => i.playerId === playerId && i.tabIndex === tabIndex)
      .sort((a, b) => a.slot - b.slot);
  }

  /**
   * Get inventory state
   */
  getInventory(playerId: string): InventorySlot[] {
    return this.inventoryData.filter((i) => i.playerId === playerId);
  }

  /**
   * Get placeholders
   */
  getPlaceholders(playerId: string): BankSlot[] {
    return this.bankData.filter(
      (i) => i.playerId === playerId && i.quantity === 0,
    );
  }

  /**
   * Get slots in order
   */
  getSlots(playerId: string, tabIndex: number): number[] {
    return this.bankData
      .filter((i) => i.playerId === playerId && i.tabIndex === tabIndex)
      .map((i) => i.slot)
      .sort((a, b) => a - b);
  }
}

// ============================================================================
// Withdraw-Placeholder Tests
// ============================================================================

describe("Bank Placeholders - Withdraw-Placeholder", () => {
  describe("Basic Withdrawal", () => {
    it("withdraws all items and leaves qty=0 placeholder", () => {
      const manager = new MockBankPlaceholderManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 5,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.withdrawPlaceholder("player-1", "logs");

      expect(result.success).toBe(true);
      expect(result.withdrawnQty).toBe(5);

      // Bank should have placeholder (qty=0)
      const bankState = manager.getBankState("player-1", 0);
      expect(bankState[0].quantity).toBe(0);
      expect(bankState[0].itemId).toBe("logs");

      // Inventory should have items
      const inventory = manager.getInventory("player-1");
      expect(inventory.length).toBe(5);
    });

    it("withdraws up to available inventory space", () => {
      // Start with inventory that has 26 items (2 free slots)
      const existingInventory: Omit<InventorySlot, "id">[] = [];
      for (let i = 0; i < 26; i++) {
        existingInventory.push({
          playerId: "player-1",
          itemId: `item-${i}`,
          quantity: 1,
          slotIndex: i,
        });
      }

      const manager = new MockBankPlaceholderManager(
        [
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 0,
          },
        ],
        existingInventory,
      );

      const result = manager.withdrawPlaceholder("player-1", "logs");

      expect(result.success).toBe(true);
      expect(result.withdrawnQty).toBe(2); // Only 2 free slots

      // Bank should still show placeholder
      const bankState = manager.getBankState("player-1", 0);
      expect(bankState[0].quantity).toBe(0);
    });
  });

  describe("Error Cases", () => {
    it("returns error when item not in bank", () => {
      const manager = new MockBankPlaceholderManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 5,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.withdrawPlaceholder("player-1", "coins");

      expect(result.success).toBe(false);
      expect(result.error).toBe("ITEM_NOT_IN_BANK");
    });

    it("returns error when already a placeholder", () => {
      const manager = new MockBankPlaceholderManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 0, // Already placeholder
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.withdrawPlaceholder("player-1", "logs");

      expect(result.success).toBe(false);
      expect(result.error).toBe("ALREADY_PLACEHOLDER");
    });

    it("returns error when inventory is full", () => {
      const existingInventory: Omit<InventorySlot, "id">[] = [];
      for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
        existingInventory.push({
          playerId: "player-1",
          itemId: `item-${i}`,
          quantity: 1,
          slotIndex: i,
        });
      }

      const manager = new MockBankPlaceholderManager(
        [
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 5,
            slot: 0,
            tabIndex: 0,
          },
        ],
        existingInventory,
      );

      const result = manager.withdrawPlaceholder("player-1", "logs");

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVENTORY_FULL");
    });
  });
});

// ============================================================================
// Release Placeholder Tests
// ============================================================================

describe("Bank Placeholders - Release Placeholder", () => {
  describe("Single Placeholder", () => {
    it("deletes placeholder and compacts slots", () => {
      const manager = new MockBankPlaceholderManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 0, // Placeholder
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

      const result = manager.releasePlaceholder("player-1", 0, 0);

      expect(result.success).toBe(true);

      // Placeholder should be gone, remaining items shifted
      const bankState = manager.getBankState("player-1", 0);
      expect(bankState.length).toBe(2);
      expect(bankState[0].itemId).toBe("coins");
      expect(bankState[0].slot).toBe(0); // Shifted from 1
      expect(bankState[1].itemId).toBe("iron_ore");
      expect(bankState[1].slot).toBe(1); // Shifted from 2
    });

    it("deletes placeholder at end without shifting", () => {
      const manager = new MockBankPlaceholderManager([
        {
          playerId: "player-1",
          itemId: "coins",
          quantity: 100,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 0, // Placeholder at end
          slot: 1,
          tabIndex: 0,
        },
      ]);

      const result = manager.releasePlaceholder("player-1", 0, 1);

      expect(result.success).toBe(true);

      const bankState = manager.getBankState("player-1", 0);
      expect(bankState.length).toBe(1);
      expect(bankState[0].itemId).toBe("coins");
      expect(bankState[0].slot).toBe(0);
    });
  });

  describe("Error Cases", () => {
    it("returns error when slot is empty", () => {
      const manager = new MockBankPlaceholderManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 0,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.releasePlaceholder("player-1", 0, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("SLOT_EMPTY");
    });

    it("returns error when slot has actual items (not placeholder)", () => {
      const manager = new MockBankPlaceholderManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10, // Has items
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.releasePlaceholder("player-1", 0, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("NOT_A_PLACEHOLDER");
    });
  });

  describe("Tab Isolation", () => {
    it("only affects specified tab", () => {
      const manager = new MockBankPlaceholderManager([
        // Tab 0
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 0,
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
          itemId: "iron",
          quantity: 50,
          slot: 0,
          tabIndex: 1,
        },
      ]);

      manager.releasePlaceholder("player-1", 0, 0);

      // Tab 0 should be compacted
      expect(manager.getSlots("player-1", 0)).toEqual([0]);

      // Tab 1 should be unchanged
      expect(manager.getSlots("player-1", 1)).toEqual([0]);
    });
  });
});

// ============================================================================
// Release All Placeholders Tests
// ============================================================================

describe("Bank Placeholders - Release All", () => {
  describe("Multiple Placeholders", () => {
    it("releases all placeholders across tabs", () => {
      const manager = new MockBankPlaceholderManager([
        // Tab 0
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 0,
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
          itemId: "iron",
          quantity: 0,
          slot: 2,
          tabIndex: 0,
        },
        // Tab 1
        {
          playerId: "player-1",
          itemId: "bronze",
          quantity: 0,
          slot: 0,
          tabIndex: 1,
        },
        {
          playerId: "player-1",
          itemId: "steel",
          quantity: 20,
          slot: 1,
          tabIndex: 1,
        },
      ]);

      const result = manager.releaseAllPlaceholders("player-1");

      expect(result.success).toBe(true);
      expect(result.count).toBe(3); // 3 placeholders released

      // No placeholders should remain
      expect(manager.getPlaceholders("player-1").length).toBe(0);

      // Tab 0: only coins remains at slot 0
      const tab0 = manager.getBankState("player-1", 0);
      expect(tab0.length).toBe(1);
      expect(tab0[0].itemId).toBe("coins");
      expect(tab0[0].slot).toBe(0);

      // Tab 1: only steel remains at slot 0
      const tab1 = manager.getBankState("player-1", 1);
      expect(tab1.length).toBe(1);
      expect(tab1[0].itemId).toBe("steel");
      expect(tab1[0].slot).toBe(0);
    });

    it("returns count 0 when no placeholders exist", () => {
      const manager = new MockBankPlaceholderManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.releaseAllPlaceholders("player-1");

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  describe("Player Isolation", () => {
    it("only affects specified player", () => {
      const manager = new MockBankPlaceholderManager([
        // Player 1
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 0,
          slot: 0,
          tabIndex: 0,
        },
        // Player 2
        {
          playerId: "player-2",
          itemId: "coins",
          quantity: 0,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      manager.releaseAllPlaceholders("player-1");

      // Player 1 should have no placeholders
      expect(manager.getPlaceholders("player-1").length).toBe(0);

      // Player 2 should still have placeholder
      expect(manager.getPlaceholders("player-2").length).toBe(1);
    });
  });
});

// ============================================================================
// Always Set Placeholder Toggle Tests
// ============================================================================

describe("Bank Placeholders - Toggle Setting", () => {
  it("toggles setting from off to on", () => {
    const manager = new MockBankPlaceholderManager([]);

    expect(manager.getAlwaysPlaceholder("player-1")).toBe(false);

    const newValue = manager.toggleAlwaysPlaceholder("player-1");

    expect(newValue).toBe(true);
    expect(manager.getAlwaysPlaceholder("player-1")).toBe(true);
  });

  it("toggles setting from on to off", () => {
    const settings = new Map([["player-1", { alwaysSetPlaceholder: true }]]);
    const manager = new MockBankPlaceholderManager([], [], settings);

    expect(manager.getAlwaysPlaceholder("player-1")).toBe(true);

    const newValue = manager.toggleAlwaysPlaceholder("player-1");

    expect(newValue).toBe(false);
    expect(manager.getAlwaysPlaceholder("player-1")).toBe(false);
  });

  it("maintains separate settings per player", () => {
    const settings = new Map([
      ["player-1", { alwaysSetPlaceholder: true }],
      ["player-2", { alwaysSetPlaceholder: false }],
    ]);
    const manager = new MockBankPlaceholderManager([], [], settings);

    manager.toggleAlwaysPlaceholder("player-1");

    expect(manager.getAlwaysPlaceholder("player-1")).toBe(false);
    expect(manager.getAlwaysPlaceholder("player-2")).toBe(false); // Unchanged
  });
});
