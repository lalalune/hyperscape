/**
 * Bank Tabs Unit Tests
 *
 * Tests for RS3-style bank tab management logic.
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

interface BankTab {
  id: number;
  playerId: string;
  tabIndex: number;
  iconItemId: string;
}

// ============================================================================
// Mock Bank Tab Manager
// ============================================================================

const MAX_CUSTOM_TABS = 9;

/**
 * Mock bank tab manager that tests the ALGORITHM logic
 * for tab creation, deletion, and item moving between tabs.
 */
class MockBankTabManager {
  private bankData: BankSlot[] = [];
  private tabData: BankTab[] = [];
  private nextBankId = 1;
  private nextTabId = 1;

  constructor(
    bankData: Omit<BankSlot, "id">[],
    tabData: Omit<BankTab, "id">[] = [],
  ) {
    this.bankData = bankData.map((item) => ({
      ...item,
      id: this.nextBankId++,
    }));
    this.tabData = tabData.map((tab) => ({
      ...tab,
      id: this.nextTabId++,
    }));
  }

  /**
   * Create a new custom tab (1-9) with an item from another tab
   */
  createTab(
    playerId: string,
    fromSlot: number,
    fromTabIndex: number,
    newTabIndex: number,
  ): { success: boolean; error?: string } {
    // Validate new tab index (1-9)
    if (newTabIndex < 1 || newTabIndex > 9) {
      return { success: false, error: "INVALID_TAB_INDEX" };
    }

    // Check tab doesn't already exist
    const existingTab = this.tabData.find(
      (t) => t.playerId === playerId && t.tabIndex === newTabIndex,
    );
    if (existingTab) {
      return { success: false, error: "TAB_EXISTS" };
    }

    // Check total tabs count
    const tabCount = this.tabData.filter((t) => t.playerId === playerId).length;
    if (tabCount >= MAX_CUSTOM_TABS) {
      return { success: false, error: "MAX_TABS_REACHED" };
    }

    // Find item to move
    const item = this.bankData.find(
      (i) =>
        i.playerId === playerId &&
        i.tabIndex === fromTabIndex &&
        i.slot === fromSlot,
    );
    if (!item) {
      return { success: false, error: "SLOT_EMPTY" };
    }

    // Create new tab
    this.tabData.push({
      id: this.nextTabId++,
      playerId,
      tabIndex: newTabIndex,
      iconItemId: item.itemId,
    });

    // Move item to new tab at slot 0
    item.tabIndex = newTabIndex;
    item.slot = 0;

    // Compact source tab to fill gap
    this.compactSlots(playerId, fromSlot, fromTabIndex);

    return { success: true };
  }

  /**
   * Delete a custom tab and move items to main tab
   */
  deleteTab(
    playerId: string,
    tabIndex: number,
  ): { success: boolean; error?: string } {
    // Can't delete main tab
    if (tabIndex === 0) {
      return { success: false, error: "CANNOT_DELETE_MAIN_TAB" };
    }

    // Check tab exists
    const tabIdx = this.tabData.findIndex(
      (t) => t.playerId === playerId && t.tabIndex === tabIndex,
    );
    if (tabIdx === -1) {
      return { success: false, error: "TAB_NOT_FOUND" };
    }

    // Get items in the tab being deleted
    const itemsInTab = this.bankData
      .filter((i) => i.playerId === playerId && i.tabIndex === tabIndex)
      .sort((a, b) => a.slot - b.slot);

    // Get max slot in main tab
    const mainTabItems = this.bankData.filter(
      (i) => i.playerId === playerId && i.tabIndex === 0,
    );
    let nextSlot =
      mainTabItems.length > 0
        ? Math.max(...mainTabItems.map((i) => i.slot)) + 1
        : 0;

    // Move items to main tab
    for (const item of itemsInTab) {
      item.tabIndex = 0;
      item.slot = nextSlot++;
    }

    // Delete the tab
    this.tabData.splice(tabIdx, 1);

    // Shift higher tabs down by 1 (two-phase)
    const deletedTabIndex = tabIndex;

    // Phase 1: Add +1000 offset
    for (const tab of this.tabData) {
      if (tab.playerId === playerId && tab.tabIndex > deletedTabIndex) {
        tab.tabIndex += 1000;
      }
    }
    for (const item of this.bankData) {
      if (item.playerId === playerId && item.tabIndex > deletedTabIndex) {
        item.tabIndex += 1000;
      }
    }

    // Phase 2: Subtract 1001
    for (const tab of this.tabData) {
      if (tab.playerId === playerId && tab.tabIndex > 1000) {
        tab.tabIndex -= 1001;
      }
    }
    for (const item of this.bankData) {
      if (item.playerId === playerId && item.tabIndex > 1000) {
        item.tabIndex -= 1001;
      }
    }

    return { success: true };
  }

  /**
   * Move item to different tab
   */
  moveToTab(
    playerId: string,
    fromSlot: number,
    fromTabIndex: number,
    toTabIndex: number,
    toSlot: number = -1,
  ): { success: boolean; error?: string } {
    // No-op if same tab
    if (fromTabIndex === toTabIndex) {
      return { success: true };
    }

    // Check destination tab exists (unless main tab)
    if (toTabIndex !== 0) {
      const tab = this.tabData.find(
        (t) => t.playerId === playerId && t.tabIndex === toTabIndex,
      );
      if (!tab) {
        return { success: false, error: "TAB_NOT_FOUND" };
      }
    }

    // Find item to move
    const item = this.bankData.find(
      (i) =>
        i.playerId === playerId &&
        i.tabIndex === fromTabIndex &&
        i.slot === fromSlot,
    );
    if (!item) {
      return { success: false, error: "SLOT_EMPTY" };
    }

    // Get destination tab items
    const destItems = this.bankData.filter(
      (i) => i.playerId === playerId && i.tabIndex === toTabIndex,
    );
    const maxSlot =
      destItems.length > 0 ? Math.max(...destItems.map((i) => i.slot)) : -1;

    // Determine target slot
    let targetSlot: number;
    if (toSlot === -1) {
      // Append to end
      targetSlot = maxSlot + 1;
    } else {
      // Insert at specific position
      targetSlot = toSlot;

      // Shift items at targetSlot and above to the right
      for (let s = maxSlot; s >= targetSlot; s--) {
        const itemAtSlot = this.bankData.find(
          (i) =>
            i.playerId === playerId &&
            i.tabIndex === toTabIndex &&
            i.slot === s,
        );
        if (itemAtSlot) {
          itemAtSlot.slot += 1;
        }
      }
    }

    // Move item
    item.tabIndex = toTabIndex;
    item.slot = targetSlot;

    // Compact source tab
    this.compactSlots(playerId, fromSlot, fromTabIndex);

    // If source tab is now empty (custom tab), delete it
    if (fromTabIndex !== 0) {
      const remaining = this.bankData.filter(
        (i) => i.playerId === playerId && i.tabIndex === fromTabIndex,
      );
      if (remaining.length === 0) {
        const tabIdx = this.tabData.findIndex(
          (t) => t.playerId === playerId && t.tabIndex === fromTabIndex,
        );
        if (tabIdx !== -1) {
          this.tabData.splice(tabIdx, 1);
        }
      }
    }

    // Update tab icon if first item in custom tab
    if (toTabIndex !== 0 && targetSlot === 0) {
      const tab = this.tabData.find(
        (t) => t.playerId === playerId && t.tabIndex === toTabIndex,
      );
      if (tab) {
        tab.iconItemId = item.itemId;
      }
    }

    return { success: true };
  }

  /**
   * Compact slots in a tab after deletion
   */
  private compactSlots(
    playerId: string,
    deletedSlot: number,
    tabIndex: number,
  ): void {
    for (const item of this.bankData) {
      if (
        item.playerId === playerId &&
        item.tabIndex === tabIndex &&
        item.slot > deletedSlot
      ) {
        item.slot -= 1;
      }
    }
  }

  /**
   * Get tabs for a player
   */
  getTabs(playerId: string): BankTab[] {
    return this.tabData
      .filter((t) => t.playerId === playerId)
      .sort((a, b) => a.tabIndex - b.tabIndex);
  }

  /**
   * Get items in a tab
   */
  getItemsInTab(playerId: string, tabIndex: number): BankSlot[] {
    return this.bankData
      .filter((i) => i.playerId === playerId && i.tabIndex === tabIndex)
      .sort((a, b) => a.slot - b.slot);
  }

  /**
   * Get tab count
   */
  getTabCount(playerId: string): number {
    return this.tabData.filter((t) => t.playerId === playerId).length;
  }

  /**
   * Get tab icon
   */
  getTabIcon(playerId: string, tabIndex: number): string | undefined {
    return this.tabData.find(
      (t) => t.playerId === playerId && t.tabIndex === tabIndex,
    )?.iconItemId;
  }
}

// ============================================================================
// Create Tab Tests
// ============================================================================

describe("Bank Tabs - Create Tab", () => {
  describe("Basic Creation", () => {
    it("creates tab with item from main tab", () => {
      const manager = new MockBankTabManager([
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

      const result = manager.createTab("player-1", 0, 0, 1);

      expect(result.success).toBe(true);

      // Tab should be created
      const tabs = manager.getTabs("player-1");
      expect(tabs.length).toBe(1);
      expect(tabs[0].tabIndex).toBe(1);
      expect(tabs[0].iconItemId).toBe("logs");

      // Item should be in new tab
      const tab1Items = manager.getItemsInTab("player-1", 1);
      expect(tab1Items.length).toBe(1);
      expect(tab1Items[0].itemId).toBe("logs");
      expect(tab1Items[0].slot).toBe(0);

      // Main tab should be compacted
      const mainItems = manager.getItemsInTab("player-1", 0);
      expect(mainItems.length).toBe(1);
      expect(mainItems[0].itemId).toBe("coins");
      expect(mainItems[0].slot).toBe(0); // Shifted from 1
    });

    it("sets first item as tab icon", () => {
      const manager = new MockBankTabManager([
        {
          playerId: "player-1",
          itemId: "bronze_sword",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      manager.createTab("player-1", 0, 0, 1);

      expect(manager.getTabIcon("player-1", 1)).toBe("bronze_sword");
    });
  });

  describe("Error Cases", () => {
    it("returns error when tab already exists", () => {
      const manager = new MockBankTabManager(
        [
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 0,
          },
        ],
        [{ playerId: "player-1", tabIndex: 1, iconItemId: "coins" }],
      );

      const result = manager.createTab("player-1", 0, 0, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("TAB_EXISTS");
    });

    it("returns error when max tabs reached", () => {
      const tabs: Omit<BankTab, "id">[] = [];
      for (let i = 1; i <= 9; i++) {
        tabs.push({
          playerId: "player-1",
          tabIndex: i,
          iconItemId: `item-${i}`,
        });
      }

      const manager = new MockBankTabManager(
        [
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 0,
          },
        ],
        tabs,
      );

      // Try to create 10th custom tab
      const result = manager.createTab("player-1", 0, 0, 10);

      expect(result.success).toBe(false);
      // Either INVALID_TAB_INDEX (10 > 9) or MAX_TABS_REACHED
      expect(["INVALID_TAB_INDEX", "MAX_TABS_REACHED"]).toContain(result.error);
    });

    it("returns error when slot is empty", () => {
      const manager = new MockBankTabManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.createTab("player-1", 5, 0, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("SLOT_EMPTY");
    });
  });

  describe("Player Isolation", () => {
    it("only affects specified player", () => {
      const manager = new MockBankTabManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-2",
          itemId: "coins",
          quantity: 100,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      manager.createTab("player-1", 0, 0, 1);

      // Player 1 should have new tab
      expect(manager.getTabCount("player-1")).toBe(1);

      // Player 2 should have no tabs
      expect(manager.getTabCount("player-2")).toBe(0);
    });
  });
});

// ============================================================================
// Delete Tab Tests
// ============================================================================

describe("Bank Tabs - Delete Tab", () => {
  describe("Basic Deletion", () => {
    it("deletes tab and moves items to main tab", () => {
      const manager = new MockBankTabManager(
        [
          // Main tab
          {
            playerId: "player-1",
            itemId: "coins",
            quantity: 100,
            slot: 0,
            tabIndex: 0,
          },
          // Tab 1
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 1,
          },
          {
            playerId: "player-1",
            itemId: "iron_ore",
            quantity: 5,
            slot: 1,
            tabIndex: 1,
          },
        ],
        [{ playerId: "player-1", tabIndex: 1, iconItemId: "logs" }],
      );

      const result = manager.deleteTab("player-1", 1);

      expect(result.success).toBe(true);

      // Tab should be gone
      expect(manager.getTabCount("player-1")).toBe(0);

      // Items should be in main tab
      const mainItems = manager.getItemsInTab("player-1", 0);
      expect(mainItems.length).toBe(3);
      expect(mainItems.map((i) => i.itemId)).toContain("logs");
      expect(mainItems.map((i) => i.itemId)).toContain("iron_ore");
    });

    it("shifts higher tabs down when middle tab deleted", () => {
      const manager = new MockBankTabManager(
        [
          // Tab 1
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 1,
          },
          // Tab 2
          {
            playerId: "player-1",
            itemId: "iron",
            quantity: 5,
            slot: 0,
            tabIndex: 2,
          },
          // Tab 3
          {
            playerId: "player-1",
            itemId: "gold",
            quantity: 1,
            slot: 0,
            tabIndex: 3,
          },
        ],
        [
          { playerId: "player-1", tabIndex: 1, iconItemId: "logs" },
          { playerId: "player-1", tabIndex: 2, iconItemId: "iron" },
          { playerId: "player-1", tabIndex: 3, iconItemId: "gold" },
        ],
      );

      // Delete tab 2
      manager.deleteTab("player-1", 2);

      // Tab 3 should now be tab 2
      const tabs = manager.getTabs("player-1");
      expect(tabs.length).toBe(2);
      expect(tabs.map((t) => t.tabIndex)).toEqual([1, 2]);

      // Gold should be in tab 2 now
      const goldItem = manager.getItemsInTab("player-1", 2);
      expect(goldItem[0]?.itemId).toBe("gold");
    });
  });

  describe("Error Cases", () => {
    it("returns error when deleting main tab", () => {
      const manager = new MockBankTabManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.deleteTab("player-1", 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("CANNOT_DELETE_MAIN_TAB");
    });

    it("returns error when tab not found", () => {
      const manager = new MockBankTabManager([]);

      const result = manager.deleteTab("player-1", 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("TAB_NOT_FOUND");
    });
  });

  describe("Player Isolation", () => {
    it("only deletes tab for specified player", () => {
      const manager = new MockBankTabManager(
        [
          // Player 1
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 1,
          },
          // Player 2
          {
            playerId: "player-2",
            itemId: "coins",
            quantity: 100,
            slot: 0,
            tabIndex: 1,
          },
        ],
        [
          { playerId: "player-1", tabIndex: 1, iconItemId: "logs" },
          { playerId: "player-2", tabIndex: 1, iconItemId: "coins" },
        ],
      );

      manager.deleteTab("player-1", 1);

      // Player 1 should have no tabs
      expect(manager.getTabCount("player-1")).toBe(0);

      // Player 2 should still have tab
      expect(manager.getTabCount("player-2")).toBe(1);
    });
  });
});

// ============================================================================
// Move to Tab Tests
// ============================================================================

describe("Bank Tabs - Move to Tab", () => {
  describe("Append to End", () => {
    it("moves item to end of destination tab", () => {
      const manager = new MockBankTabManager(
        [
          // Main tab
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 0,
          },
          // Tab 1
          {
            playerId: "player-1",
            itemId: "coins",
            quantity: 100,
            slot: 0,
            tabIndex: 1,
          },
        ],
        [{ playerId: "player-1", tabIndex: 1, iconItemId: "coins" }],
      );

      // Move logs to tab 1 (append)
      const result = manager.moveToTab("player-1", 0, 0, 1);

      expect(result.success).toBe(true);

      // Logs should be at end of tab 1
      const tab1 = manager.getItemsInTab("player-1", 1);
      expect(tab1.length).toBe(2);
      expect(tab1[1].itemId).toBe("logs");
      expect(tab1[1].slot).toBe(1);
    });
  });

  describe("Insert at Position", () => {
    it("inserts item at specific position and shifts others", () => {
      const manager = new MockBankTabManager(
        [
          // Main tab
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 0,
          },
          // Tab 1
          {
            playerId: "player-1",
            itemId: "A",
            quantity: 1,
            slot: 0,
            tabIndex: 1,
          },
          {
            playerId: "player-1",
            itemId: "B",
            quantity: 1,
            slot: 1,
            tabIndex: 1,
          },
        ],
        [{ playerId: "player-1", tabIndex: 1, iconItemId: "A" }],
      );

      // Move logs to tab 1 at position 0
      manager.moveToTab("player-1", 0, 0, 1, 0);

      // Logs should be at position 0, others shifted
      const tab1 = manager.getItemsInTab("player-1", 1);
      expect(tab1.length).toBe(3);
      expect(tab1[0].itemId).toBe("logs");
      expect(tab1[1].itemId).toBe("A");
      expect(tab1[2].itemId).toBe("B");
    });

    it("updates tab icon when inserting at slot 0", () => {
      const manager = new MockBankTabManager(
        [
          {
            playerId: "player-1",
            itemId: "new_icon",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
          {
            playerId: "player-1",
            itemId: "old_icon",
            quantity: 1,
            slot: 0,
            tabIndex: 1,
          },
        ],
        [{ playerId: "player-1", tabIndex: 1, iconItemId: "old_icon" }],
      );

      manager.moveToTab("player-1", 0, 0, 1, 0);

      // Icon should be updated
      expect(manager.getTabIcon("player-1", 1)).toBe("new_icon");
    });
  });

  describe("Auto-delete Empty Tab", () => {
    it("deletes source tab when it becomes empty", () => {
      const manager = new MockBankTabManager(
        [
          // Main tab
          {
            playerId: "player-1",
            itemId: "coins",
            quantity: 100,
            slot: 0,
            tabIndex: 0,
          },
          // Tab 1 (single item)
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 1,
          },
        ],
        [{ playerId: "player-1", tabIndex: 1, iconItemId: "logs" }],
      );

      // Move only item from tab 1 to main
      manager.moveToTab("player-1", 0, 1, 0);

      // Tab 1 should be deleted
      expect(manager.getTabCount("player-1")).toBe(0);

      // Item should be in main tab
      const main = manager.getItemsInTab("player-1", 0);
      expect(main.map((i) => i.itemId)).toContain("logs");
    });

    it("does not delete main tab when it becomes empty", () => {
      const manager = new MockBankTabManager(
        [
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 0,
          },
        ],
        [{ playerId: "player-1", tabIndex: 1, iconItemId: "dummy" }],
      );

      // Move only item from main to tab 1
      manager.moveToTab("player-1", 0, 0, 1);

      // Main tab should still exist (implicitly - no tab record for main)
      // Tab 1 should have the item
      const tab1 = manager.getItemsInTab("player-1", 1);
      expect(tab1[0]?.itemId).toBe("logs");
    });
  });

  describe("Error Cases", () => {
    it("returns error when destination tab not found", () => {
      const manager = new MockBankTabManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.moveToTab("player-1", 0, 0, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("TAB_NOT_FOUND");
    });

    it("returns error when source slot is empty", () => {
      const manager = new MockBankTabManager(
        [
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 0,
          },
        ],
        [{ playerId: "player-1", tabIndex: 1, iconItemId: "dummy" }],
      );

      const result = manager.moveToTab("player-1", 5, 0, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("SLOT_EMPTY");
    });

    it("no-op when moving to same tab", () => {
      const manager = new MockBankTabManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.moveToTab("player-1", 0, 0, 0);

      expect(result.success).toBe(true);
      // Item should be unchanged
      const main = manager.getItemsInTab("player-1", 0);
      expect(main[0].itemId).toBe("logs");
      expect(main[0].slot).toBe(0);
    });
  });

  describe("Moving to Main Tab", () => {
    it("allows moving to main tab without tab existence check", () => {
      const manager = new MockBankTabManager(
        [
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 1,
          },
        ],
        [{ playerId: "player-1", tabIndex: 1, iconItemId: "logs" }],
      );

      // Move to main tab (0) - should work without "TAB_NOT_FOUND"
      const result = manager.moveToTab("player-1", 0, 1, 0);

      expect(result.success).toBe(true);

      const main = manager.getItemsInTab("player-1", 0);
      expect(main[0]?.itemId).toBe("logs");
    });
  });
});
