/**
 * Inventory Mock Factories
 *
 * Creates strongly-typed inventory mocks that match production InventorySystem.
 * Implements the same logic patterns for consistent test/production behavior.
 */

import { INPUT_LIMITS } from "../../constants";
import {
  expectValidSlot,
  expectValidQuantity,
  expectValidItemId,
  expectValidPlayerId,
} from "../validation";

/**
 * Inventory item structure matching production
 */
export interface MockInventoryItem {
  slot: number;
  itemId: string;
  quantity: number;
  item: {
    id: string;
    name: string;
    type: string;
    stackable: boolean;
    weight: number;
  };
}

/**
 * Inventory state matching production PlayerInventory
 */
export interface MockInventory {
  playerId: string;
  items: MockInventoryItem[];
  coins: number;
  maxSlots: number;
}

/**
 * Move item result (used for testing swap logic)
 */
export interface MoveItemResult {
  success: boolean;
  error?: string;
  inventoryChanged: boolean;
}

/**
 * Mock Inventory Manager
 *
 * Implements the EXACT same logic as production InventorySystem.moveItem()
 * for accurate unit testing. Changes here should mirror production changes.
 */
export class MockInventoryManager {
  private items = new Map<number, MockInventoryItem>();
  private readonly MAX_SLOTS: number;
  private errors: string[] = [];
  private updateEmitted = false;
  private persistScheduled = false;

  constructor(maxSlots: number = INPUT_LIMITS.MAX_INVENTORY_SLOTS) {
    this.MAX_SLOTS = maxSlots;
  }

  /**
   * Add an item to a specific slot for test setup
   */
  setupItem(slot: number, itemId: string, quantity: number = 1): this {
    expectValidSlot(slot, "setupItem.slot");
    expectValidItemId(itemId, "setupItem.itemId");
    expectValidQuantity(quantity, "setupItem.quantity");

    this.items.set(slot, {
      slot,
      itemId,
      quantity,
      item: {
        id: itemId,
        name: itemId.replace(/_/g, " "),
        type: "equipment",
        stackable: false,
        weight: 1.0,
      },
    });

    return this; // Allow chaining
  }

  /**
   * Setup a stackable item
   */
  setupStackableItem(
    slot: number,
    itemId: string,
    quantity: number
  ): this {
    expectValidSlot(slot, "setupStackableItem.slot");
    expectValidItemId(itemId, "setupStackableItem.itemId");
    expectValidQuantity(quantity, "setupStackableItem.quantity");

    this.items.set(slot, {
      slot,
      itemId,
      quantity,
      item: {
        id: itemId,
        name: itemId.replace(/_/g, " "),
        type: "resource",
        stackable: true,
        weight: 0.01,
      },
    });

    return this;
  }

  /**
   * Get item at slot (for assertions)
   */
  getItem(slot: number): MockInventoryItem | undefined {
    return this.items.get(slot);
  }

  /**
   * Get all items (for assertions)
   */
  getAllItems(): MockInventoryItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get logged errors (for assertions)
   */
  getErrors(): string[] {
    return [...this.errors];
  }

  /**
   * Get last error
   */
  getLastError(): string | undefined {
    return this.errors[this.errors.length - 1];
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
   * Move/swap items between slots
   *
   * MIRRORS PRODUCTION InventorySystem.moveItem() EXACTLY
   *
   * @returns MoveItemResult for detailed assertions
   */
  moveItem(data: {
    playerId: string;
    fromSlot?: number;
    toSlot?: number;
    sourceSlot?: number;
    targetSlot?: number;
  }): MoveItemResult {
    // Validate playerId
    if (!data.playerId) {
      const error = "Cannot move item: playerId is undefined";
      this.errors.push(error);
      return { success: false, error, inventoryChanged: false };
    }

    // Handle parameter name variations (production compatibility)
    const fromSlot = data.fromSlot ?? data.sourceSlot;
    const toSlot = data.toSlot ?? data.targetSlot;

    // Validate slot presence
    if (fromSlot === undefined || toSlot === undefined) {
      const error = "Cannot move item: slot numbers are undefined";
      this.errors.push(error);
      return { success: false, error, inventoryChanged: false };
    }

    // Validate fromSlot bounds
    if (
      !Number.isInteger(fromSlot) ||
      fromSlot < 0 ||
      fromSlot >= this.MAX_SLOTS
    ) {
      const error = `Cannot move item: fromSlot ${fromSlot} out of bounds [0, ${this.MAX_SLOTS})`;
      this.errors.push(error);
      return { success: false, error, inventoryChanged: false };
    }

    // Validate toSlot bounds
    if (!Number.isInteger(toSlot) || toSlot < 0 || toSlot >= this.MAX_SLOTS) {
      const error = `Cannot move item: toSlot ${toSlot} out of bounds [0, ${this.MAX_SLOTS})`;
      this.errors.push(error);
      return { success: false, error, inventoryChanged: false };
    }

    // Same slot - no-op (not an error, just nothing to do)
    if (fromSlot === toSlot) {
      return { success: true, inventoryChanged: false };
    }

    const fromItem = this.items.get(fromSlot);
    const toItem = this.items.get(toSlot);

    // Can't move from empty slot
    if (!fromItem) {
      const error = `moveItem: source slot ${fromSlot} is empty`;
      this.errors.push(error);
      return { success: false, error, inventoryChanged: false };
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

    return { success: true, inventoryChanged: true };
  }

  /**
   * Find first empty slot
   */
  findEmptySlot(): number {
    for (let i = 0; i < this.MAX_SLOTS; i++) {
      if (!this.items.has(i)) {
        return i;
      }
    }
    return -1; // Inventory full
  }

  /**
   * Check if inventory is full
   */
  isFull(): boolean {
    return this.items.size >= this.MAX_SLOTS;
  }

  /**
   * Get current item count
   */
  getItemCount(): number {
    return this.items.size;
  }

  /**
   * Check if player has a specific item
   */
  hasItem(itemId: string, quantity: number = 1): boolean {
    let total = 0;
    for (const item of this.items.values()) {
      if (item.itemId === itemId) {
        total += item.quantity;
      }
    }
    return total >= quantity;
  }

  /**
   * Get total quantity of a specific item
   */
  getItemQuantity(itemId: string): number {
    let total = 0;
    for (const item of this.items.values()) {
      if (item.itemId === itemId) {
        total += item.quantity;
      }
    }
    return total;
  }
}

/**
 * Create a pre-configured inventory manager for common test scenarios
 */
export function createMockInventoryWithItems(
  items: Array<{ slot: number; itemId: string; quantity?: number }>
): MockInventoryManager {
  const manager = new MockInventoryManager();
  for (const item of items) {
    manager.setupItem(item.slot, item.itemId, item.quantity ?? 1);
  }
  return manager;
}
