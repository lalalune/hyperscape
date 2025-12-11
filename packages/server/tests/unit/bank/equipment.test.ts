/**
 * Bank Equipment Unit Tests
 *
 * Tests for RS3-style bank equipment tab operations:
 * - Withdraw to equipment (equip directly from bank)
 * - Deposit from equipment (unequip directly to bank)
 * - Deposit all equipment (one-click unequip all)
 *
 * Uses mock classes following the existing codebase pattern.
 */

import { describe, it, expect, beforeEach } from "vitest";

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

interface EquipmentSlots {
  weapon: string | null;
  shield: string | null;
  helmet: string | null;
  body: string | null;
  legs: string | null;
  arrows: string | null;
}

type EquipmentSlotName = keyof EquipmentSlots;

interface ItemDefinition {
  id: string;
  name: string;
  equipSlot?: EquipmentSlotName;
  isTwoHanded?: boolean;
  levelRequirement?: number;
}

// ============================================================================
// Mock Item Database
// ============================================================================

const MOCK_ITEMS: Record<string, ItemDefinition> = {
  bronze_sword: {
    id: "bronze_sword",
    name: "Bronze sword",
    equipSlot: "weapon",
    levelRequirement: 1,
  },
  iron_sword: {
    id: "iron_sword",
    name: "Iron sword",
    equipSlot: "weapon",
    levelRequirement: 1,
  },
  dragon_sword: {
    id: "dragon_sword",
    name: "Dragon sword",
    equipSlot: "weapon",
    levelRequirement: 60,
  },
  bronze_2h: {
    id: "bronze_2h",
    name: "Bronze 2h sword",
    equipSlot: "weapon",
    isTwoHanded: true,
    levelRequirement: 1,
  },
  wooden_shield: {
    id: "wooden_shield",
    name: "Wooden shield",
    equipSlot: "shield",
    levelRequirement: 1,
  },
  iron_shield: {
    id: "iron_shield",
    name: "Iron shield",
    equipSlot: "shield",
    levelRequirement: 1,
  },
  bronze_helm: {
    id: "bronze_helm",
    name: "Bronze helm",
    equipSlot: "helmet",
    levelRequirement: 1,
  },
  bronze_platebody: {
    id: "bronze_platebody",
    name: "Bronze platebody",
    equipSlot: "body",
    levelRequirement: 1,
  },
  bronze_platelegs: {
    id: "bronze_platelegs",
    name: "Bronze platelegs",
    equipSlot: "legs",
    levelRequirement: 1,
  },
  bronze_arrows: {
    id: "bronze_arrows",
    name: "Bronze arrows",
    equipSlot: "arrows",
    levelRequirement: 1,
  },
  logs: { id: "logs", name: "Logs" }, // Not equipable
  coins: { id: "coins", name: "Coins" }, // Not equipable
};

const MAX_BANK_SLOTS = 800;

// ============================================================================
// Mock Equipment Bank Manager
// ============================================================================

/**
 * Mock equipment bank manager that tests the ALGORITHM logic
 * for equipment-related bank operations.
 */
class MockEquipmentBankManager {
  private bankData: BankSlot[] = [];
  private equipment: Map<string, EquipmentSlots> = new Map();
  private playerLevels: Map<string, number> = new Map();
  private playerSettings: Map<string, { alwaysSetPlaceholder: boolean }> =
    new Map();
  private nextBankId = 1;

  constructor(
    bankData: Omit<BankSlot, "id">[],
    equipment: Map<string, Partial<EquipmentSlots>> = new Map(),
    playerLevels: Map<string, number> = new Map(),
    playerSettings: Map<string, { alwaysSetPlaceholder: boolean }> = new Map(),
  ) {
    this.bankData = bankData.map((item) => ({
      ...item,
      id: this.nextBankId++,
    }));

    // Initialize equipment for players
    for (const [playerId, slots] of equipment) {
      this.equipment.set(playerId, {
        weapon: slots.weapon ?? null,
        shield: slots.shield ?? null,
        helmet: slots.helmet ?? null,
        body: slots.body ?? null,
        legs: slots.legs ?? null,
        arrows: slots.arrows ?? null,
      });
    }

    this.playerLevels = playerLevels;
    this.playerSettings = playerSettings;
  }

  /**
   * Get equipment slot for an item
   */
  getEquipmentSlotForItem(itemId: string): EquipmentSlotName | null {
    const item = MOCK_ITEMS[itemId];
    return item?.equipSlot ?? null;
  }

  /**
   * Check if player can equip item (level requirements)
   */
  canPlayerEquipItem(playerId: string, itemId: string): boolean {
    const item = MOCK_ITEMS[itemId];
    if (!item || !item.equipSlot) return false;

    const playerLevel = this.playerLevels.get(playerId) ?? 1;
    const requiredLevel = item.levelRequirement ?? 1;

    return playerLevel >= requiredLevel;
  }

  /**
   * Withdraw item from bank directly to equipment
   */
  withdrawToEquipment(
    playerId: string,
    itemId: string,
    tabIndex: number,
    slot: number,
  ): {
    success: boolean;
    error?: string;
    equippedSlot?: EquipmentSlotName;
    displacedItems?: Array<{ itemId: string; quantity: number }>;
  } {
    // Find bank item at specific slot
    const bankItem = this.bankData.find(
      (i) =>
        i.playerId === playerId &&
        i.itemId === itemId &&
        i.tabIndex === tabIndex &&
        i.slot === slot,
    );

    if (!bankItem) {
      return { success: false, error: "ITEM_NOT_IN_BANK" };
    }

    if (bankItem.quantity < 1) {
      return { success: false, error: "INSUFFICIENT_QUANTITY" };
    }

    // Check if item is equipable
    const targetSlot = this.getEquipmentSlotForItem(itemId);
    if (!targetSlot) {
      return { success: false, error: "NOT_EQUIPABLE" };
    }

    // Check level requirements
    if (!this.canPlayerEquipItem(playerId, itemId)) {
      return { success: false, error: "REQUIREMENTS_NOT_MET" };
    }

    // Get or create equipment for player
    if (!this.equipment.has(playerId)) {
      this.equipment.set(playerId, {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null,
      });
    }
    const equip = this.equipment.get(playerId)!;

    // Collect displaced items
    const displacedItems: Array<{ itemId: string; quantity: number }> = [];
    const item = MOCK_ITEMS[itemId];

    // Handle 2h weapon displacing shield
    if (item?.isTwoHanded && equip.shield) {
      displacedItems.push({ itemId: equip.shield, quantity: 1 });
      equip.shield = null;
    }

    // Handle replacing existing item in slot
    if (equip[targetSlot]) {
      displacedItems.push({ itemId: equip[targetSlot]!, quantity: 1 });
    }

    // Equip the item
    equip[targetSlot] = itemId;

    // Update bank quantity
    bankItem.quantity -= 1;

    const alwaysSetPlaceholder =
      this.playerSettings.get(playerId)?.alwaysSetPlaceholder ?? false;

    if (bankItem.quantity <= 0) {
      if (alwaysSetPlaceholder) {
        // Keep as placeholder (qty = 0)
        bankItem.quantity = 0;
      } else {
        // Delete and compact
        const bankIndex = this.bankData.indexOf(bankItem);
        this.bankData.splice(bankIndex, 1);
        this.compactSlots(playerId, slot, tabIndex);
      }
    }

    // Add displaced items back to bank
    for (const displaced of displacedItems) {
      const addResult = this.addItemToBank(
        playerId,
        displaced.itemId,
        displaced.quantity,
      );
      if (!addResult.success) {
        return { success: false, error: "BANK_FULL" };
      }
    }

    return { success: true, equippedSlot: targetSlot, displacedItems };
  }

  /**
   * Deposit single equipment slot to bank
   */
  depositEquipment(
    playerId: string,
    slotName: string,
  ): { success: boolean; error?: string; depositedItemId?: string } {
    // Validate slot name
    const validSlots = ["weapon", "shield", "helmet", "body", "legs", "arrows"];
    if (!validSlots.includes(slotName)) {
      return { success: false, error: "INVALID_SLOT" };
    }

    const slot = slotName as EquipmentSlotName;

    // Get equipment
    const equip = this.equipment.get(playerId);
    if (!equip || !equip[slot]) {
      return { success: false, error: "SLOT_EMPTY" };
    }

    const itemId = equip[slot]!;

    // Add to bank
    const addResult = this.addItemToBank(playerId, itemId, 1);
    if (!addResult.success) {
      return { success: false, error: "BANK_FULL" };
    }

    // Clear equipment slot
    equip[slot] = null;

    return { success: true, depositedItemId: itemId };
  }

  /**
   * Deposit all worn equipment to bank
   */
  depositAllEquipment(playerId: string): {
    success: boolean;
    error?: string;
    depositedCount: number;
  } {
    const equip = this.equipment.get(playerId);
    if (!equip) {
      return { success: true, depositedCount: 0 };
    }

    // Get all equipped items
    const equippedSlots: Array<{ slot: EquipmentSlotName; itemId: string }> =
      [];
    for (const slot of [
      "weapon",
      "shield",
      "helmet",
      "body",
      "legs",
      "arrows",
    ] as EquipmentSlotName[]) {
      if (equip[slot]) {
        equippedSlots.push({ slot, itemId: equip[slot]! });
      }
    }

    if (equippedSlots.length === 0) {
      return { success: true, depositedCount: 0 };
    }

    let depositedCount = 0;

    for (const { slot, itemId } of equippedSlots) {
      // Add to bank
      const addResult = this.addItemToBank(playerId, itemId, 1);
      if (!addResult.success) {
        return { success: false, error: "BANK_FULL", depositedCount };
      }

      // Clear equipment slot
      equip[slot] = null;
      depositedCount++;
    }

    return { success: true, depositedCount };
  }

  /**
   * Add item to bank (stack or new slot)
   */
  private addItemToBank(
    playerId: string,
    itemId: string,
    quantity: number,
  ): { success: boolean; slot?: number } {
    // Check if item already exists in bank
    const existing = this.bankData.find(
      (i) => i.playerId === playerId && i.itemId === itemId,
    );

    if (existing) {
      // Add to existing stack
      existing.quantity += quantity;
      return { success: true, slot: existing.slot };
    }

    // Find next available slot in tab 0
    const usedSlots = new Set(
      this.bankData
        .filter((i) => i.playerId === playerId && i.tabIndex === 0)
        .map((i) => i.slot),
    );

    let nextSlot = 0;
    while (usedSlots.has(nextSlot) && nextSlot < MAX_BANK_SLOTS) {
      nextSlot++;
    }

    if (nextSlot >= MAX_BANK_SLOTS) {
      return { success: false };
    }

    // Create new bank slot
    this.bankData.push({
      id: this.nextBankId++,
      playerId,
      itemId,
      quantity,
      slot: nextSlot,
      tabIndex: 0,
    });

    return { success: true, slot: nextSlot };
  }

  /**
   * Compact slots after deletion
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
   * Get bank state for a player
   */
  getBankState(playerId: string): BankSlot[] {
    return this.bankData
      .filter((i) => i.playerId === playerId)
      .sort((a, b) => a.tabIndex - b.tabIndex || a.slot - b.slot);
  }

  /**
   * Get equipment state for a player
   */
  getEquipment(playerId: string): EquipmentSlots | undefined {
    return this.equipment.get(playerId);
  }

  /**
   * Get bank item by itemId
   */
  getBankItem(playerId: string, itemId: string): BankSlot | undefined {
    return this.bankData.find(
      (i) => i.playerId === playerId && i.itemId === itemId,
    );
  }

  /**
   * Get count of items in bank
   */
  getBankItemCount(playerId: string): number {
    return this.bankData.filter(
      (i) => i.playerId === playerId && i.quantity > 0,
    ).length;
  }
}

// ============================================================================
// Withdraw to Equipment Tests
// ============================================================================

describe("Bank Equipment - Withdraw to Equipment", () => {
  describe("Basic Equipping", () => {
    it("equips item from bank to correct slot", () => {
      const manager = new MockEquipmentBankManager([
        {
          playerId: "player-1",
          itemId: "bronze_sword",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.withdrawToEquipment(
        "player-1",
        "bronze_sword",
        0,
        0,
      );

      expect(result.success).toBe(true);
      expect(result.equippedSlot).toBe("weapon");

      const equipment = manager.getEquipment("player-1");
      expect(equipment?.weapon).toBe("bronze_sword");
    });

    it("removes item from bank after equipping", () => {
      const manager = new MockEquipmentBankManager([
        {
          playerId: "player-1",
          itemId: "bronze_sword",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      manager.withdrawToEquipment("player-1", "bronze_sword", 0, 0);

      const bankState = manager.getBankState("player-1");
      expect(bankState.length).toBe(0);
    });

    it("decrements quantity for stacked items", () => {
      const manager = new MockEquipmentBankManager([
        {
          playerId: "player-1",
          itemId: "bronze_arrows",
          quantity: 100,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      manager.withdrawToEquipment("player-1", "bronze_arrows", 0, 0);

      const bankItem = manager.getBankItem("player-1", "bronze_arrows");
      expect(bankItem?.quantity).toBe(99);

      const equipment = manager.getEquipment("player-1");
      expect(equipment?.arrows).toBe("bronze_arrows");
    });

    it("equips different equipment types to correct slots", () => {
      const manager = new MockEquipmentBankManager([
        {
          playerId: "player-1",
          itemId: "bronze_helm",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "bronze_platebody",
          quantity: 1,
          slot: 1,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "bronze_platelegs",
          quantity: 1,
          slot: 2,
          tabIndex: 0,
        },
        {
          playerId: "player-1",
          itemId: "wooden_shield",
          quantity: 1,
          slot: 3,
          tabIndex: 0,
        },
      ]);

      manager.withdrawToEquipment("player-1", "bronze_helm", 0, 0);
      manager.withdrawToEquipment("player-1", "bronze_platebody", 0, 0);
      manager.withdrawToEquipment("player-1", "bronze_platelegs", 0, 0);
      manager.withdrawToEquipment("player-1", "wooden_shield", 0, 0);

      const equipment = manager.getEquipment("player-1");
      expect(equipment?.helmet).toBe("bronze_helm");
      expect(equipment?.body).toBe("bronze_platebody");
      expect(equipment?.legs).toBe("bronze_platelegs");
      expect(equipment?.shield).toBe("wooden_shield");
    });
  });

  describe("Level Requirements", () => {
    it("rejects item when player doesn't meet requirements", () => {
      const playerLevels = new Map([["player-1", 30]]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "dragon_sword",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
        ],
        new Map(),
        playerLevels,
      );

      const result = manager.withdrawToEquipment(
        "player-1",
        "dragon_sword",
        0,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("REQUIREMENTS_NOT_MET");
    });

    it("allows item when player meets requirements", () => {
      const playerLevels = new Map([["player-1", 60]]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "dragon_sword",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
        ],
        new Map(),
        playerLevels,
      );

      const result = manager.withdrawToEquipment(
        "player-1",
        "dragon_sword",
        0,
        0,
      );

      expect(result.success).toBe(true);
      expect(result.equippedSlot).toBe("weapon");
    });
  });

  describe("Displaced Items", () => {
    it("returns existing weapon to bank when equipping new weapon", () => {
      const equipment = new Map([["player-1", { weapon: "bronze_sword" }]]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "iron_sword",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
        ],
        equipment,
      );

      const result = manager.withdrawToEquipment(
        "player-1",
        "iron_sword",
        0,
        0,
      );

      expect(result.success).toBe(true);
      expect(result.displacedItems).toHaveLength(1);
      expect(result.displacedItems![0].itemId).toBe("bronze_sword");

      // Old weapon should be in bank
      const bankItem = manager.getBankItem("player-1", "bronze_sword");
      expect(bankItem).toBeDefined();
      expect(bankItem?.quantity).toBe(1);

      // New weapon should be equipped
      const equip = manager.getEquipment("player-1");
      expect(equip?.weapon).toBe("iron_sword");
    });

    it("returns shield to bank when equipping 2h weapon", () => {
      const equipment = new Map([["player-1", { shield: "wooden_shield" }]]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "bronze_2h",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
        ],
        equipment,
      );

      const result = manager.withdrawToEquipment("player-1", "bronze_2h", 0, 0);

      expect(result.success).toBe(true);
      expect(result.displacedItems).toHaveLength(1);
      expect(result.displacedItems![0].itemId).toBe("wooden_shield");

      // Shield should be in bank
      const bankItem = manager.getBankItem("player-1", "wooden_shield");
      expect(bankItem).toBeDefined();

      // Shield slot should be empty
      const equip = manager.getEquipment("player-1");
      expect(equip?.shield).toBeNull();
      expect(equip?.weapon).toBe("bronze_2h");
    });

    it("returns both weapon and shield when equipping 2h with both equipped", () => {
      const equipment = new Map([
        ["player-1", { weapon: "bronze_sword", shield: "wooden_shield" }],
      ]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "bronze_2h",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
        ],
        equipment,
      );

      const result = manager.withdrawToEquipment("player-1", "bronze_2h", 0, 0);

      expect(result.success).toBe(true);
      expect(result.displacedItems).toHaveLength(2);

      const displacedIds = result.displacedItems!.map((d) => d.itemId);
      expect(displacedIds).toContain("bronze_sword");
      expect(displacedIds).toContain("wooden_shield");
    });

    it("adds displaced item to existing bank stack", () => {
      const equipment = new Map([["player-1", { weapon: "bronze_sword" }]]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "iron_sword",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
          {
            playerId: "player-1",
            itemId: "bronze_sword",
            quantity: 5,
            slot: 1,
            tabIndex: 0,
          },
        ],
        equipment,
      );

      manager.withdrawToEquipment("player-1", "iron_sword", 0, 0);

      // Bronze sword should have qty increased
      const bankItem = manager.getBankItem("player-1", "bronze_sword");
      expect(bankItem?.quantity).toBe(6);
    });
  });

  describe("Placeholder Behavior", () => {
    it("leaves placeholder when alwaysSetPlaceholder is enabled", () => {
      const settings = new Map([["player-1", { alwaysSetPlaceholder: true }]]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "bronze_sword",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
        ],
        new Map(),
        new Map(),
        settings,
      );

      manager.withdrawToEquipment("player-1", "bronze_sword", 0, 0);

      const bankItem = manager.getBankItem("player-1", "bronze_sword");
      expect(bankItem).toBeDefined();
      expect(bankItem?.quantity).toBe(0); // Placeholder
    });

    it("deletes bank row when alwaysSetPlaceholder is disabled", () => {
      const settings = new Map([["player-1", { alwaysSetPlaceholder: false }]]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "bronze_sword",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
        ],
        new Map(),
        new Map(),
        settings,
      );

      manager.withdrawToEquipment("player-1", "bronze_sword", 0, 0);

      const bankItem = manager.getBankItem("player-1", "bronze_sword");
      expect(bankItem).toBeUndefined();
    });
  });

  describe("Error Cases", () => {
    it("returns error when item not in bank", () => {
      const manager = new MockEquipmentBankManager([
        {
          playerId: "player-1",
          itemId: "bronze_sword",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.withdrawToEquipment(
        "player-1",
        "iron_sword",
        0,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("ITEM_NOT_IN_BANK");
    });

    it("returns error when item is a placeholder (qty=0)", () => {
      const manager = new MockEquipmentBankManager([
        {
          playerId: "player-1",
          itemId: "bronze_sword",
          quantity: 0,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.withdrawToEquipment(
        "player-1",
        "bronze_sword",
        0,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_QUANTITY");
    });

    it("returns error when item is not equipable", () => {
      const manager = new MockEquipmentBankManager([
        {
          playerId: "player-1",
          itemId: "logs",
          quantity: 10,
          slot: 0,
          tabIndex: 0,
        },
      ]);

      const result = manager.withdrawToEquipment("player-1", "logs", 0, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("NOT_EQUIPABLE");
    });
  });
});

// ============================================================================
// Deposit from Equipment Tests
// ============================================================================

describe("Bank Equipment - Deposit from Equipment", () => {
  describe("Basic Deposit", () => {
    it("deposits equipped item to bank", () => {
      const equipment = new Map([["player-1", { weapon: "bronze_sword" }]]);
      const manager = new MockEquipmentBankManager([], equipment);

      const result = manager.depositEquipment("player-1", "weapon");

      expect(result.success).toBe(true);
      expect(result.depositedItemId).toBe("bronze_sword");

      // Item should be in bank
      const bankItem = manager.getBankItem("player-1", "bronze_sword");
      expect(bankItem).toBeDefined();
      expect(bankItem?.quantity).toBe(1);

      // Equipment slot should be empty
      const equip = manager.getEquipment("player-1");
      expect(equip?.weapon).toBeNull();
    });

    it("clears equipment slot after deposit", () => {
      const equipment = new Map([
        ["player-1", { weapon: "bronze_sword", shield: "wooden_shield" }],
      ]);
      const manager = new MockEquipmentBankManager([], equipment);

      manager.depositEquipment("player-1", "weapon");

      const equip = manager.getEquipment("player-1");
      expect(equip?.weapon).toBeNull();
      expect(equip?.shield).toBe("wooden_shield"); // Unchanged
    });

    it("adds to existing bank stack if item exists", () => {
      const equipment = new Map([["player-1", { weapon: "bronze_sword" }]]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "bronze_sword",
            quantity: 5,
            slot: 0,
            tabIndex: 0,
          },
        ],
        equipment,
      );

      manager.depositEquipment("player-1", "weapon");

      const bankItem = manager.getBankItem("player-1", "bronze_sword");
      expect(bankItem?.quantity).toBe(6);
    });

    it("creates new bank slot if item doesn't exist", () => {
      const equipment = new Map([["player-1", { weapon: "bronze_sword" }]]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "logs",
            quantity: 10,
            slot: 0,
            tabIndex: 0,
          },
        ],
        equipment,
      );

      manager.depositEquipment("player-1", "weapon");

      const bankItem = manager.getBankItem("player-1", "bronze_sword");
      expect(bankItem).toBeDefined();
      expect(bankItem?.slot).toBe(1); // Next available slot
    });
  });

  describe("All Equipment Slots", () => {
    it("deposits from all valid equipment slots", () => {
      const equipment = new Map([
        [
          "player-1",
          {
            weapon: "bronze_sword",
            shield: "wooden_shield",
            helmet: "bronze_helm",
            body: "bronze_platebody",
            legs: "bronze_platelegs",
            arrows: "bronze_arrows",
          },
        ],
      ]);
      const manager = new MockEquipmentBankManager([], equipment);

      for (const slot of [
        "weapon",
        "shield",
        "helmet",
        "body",
        "legs",
        "arrows",
      ]) {
        const result = manager.depositEquipment("player-1", slot);
        expect(result.success).toBe(true);
      }

      // All slots should be empty
      const equip = manager.getEquipment("player-1");
      expect(equip?.weapon).toBeNull();
      expect(equip?.shield).toBeNull();
      expect(equip?.helmet).toBeNull();
      expect(equip?.body).toBeNull();
      expect(equip?.legs).toBeNull();
      expect(equip?.arrows).toBeNull();

      // All items should be in bank
      expect(manager.getBankItemCount("player-1")).toBe(6);
    });
  });

  describe("Error Cases", () => {
    it("returns error when equipment slot is empty", () => {
      const equipment = new Map([["player-1", {}]]);
      const manager = new MockEquipmentBankManager([], equipment);

      const result = manager.depositEquipment("player-1", "weapon");

      expect(result.success).toBe(false);
      expect(result.error).toBe("SLOT_EMPTY");
    });

    it("returns error for invalid slot name", () => {
      const equipment = new Map([["player-1", { weapon: "bronze_sword" }]]);
      const manager = new MockEquipmentBankManager([], equipment);

      const result = manager.depositEquipment("player-1", "invalid_slot");

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_SLOT");
    });

    it("returns error when player has no equipment data", () => {
      const manager = new MockEquipmentBankManager([]);

      const result = manager.depositEquipment("player-1", "weapon");

      expect(result.success).toBe(false);
      expect(result.error).toBe("SLOT_EMPTY");
    });
  });
});

// ============================================================================
// Deposit All Equipment Tests
// ============================================================================

describe("Bank Equipment - Deposit All Equipment", () => {
  describe("Full Deposit", () => {
    it("deposits all equipped items to bank", () => {
      const equipment = new Map([
        [
          "player-1",
          {
            weapon: "bronze_sword",
            shield: "wooden_shield",
            helmet: "bronze_helm",
          },
        ],
      ]);
      const manager = new MockEquipmentBankManager([], equipment);

      const result = manager.depositAllEquipment("player-1");

      expect(result.success).toBe(true);
      expect(result.depositedCount).toBe(3);

      // All slots should be empty
      const equip = manager.getEquipment("player-1");
      expect(equip?.weapon).toBeNull();
      expect(equip?.shield).toBeNull();
      expect(equip?.helmet).toBeNull();

      // All items should be in bank
      expect(manager.getBankItem("player-1", "bronze_sword")).toBeDefined();
      expect(manager.getBankItem("player-1", "wooden_shield")).toBeDefined();
      expect(manager.getBankItem("player-1", "bronze_helm")).toBeDefined();
    });

    it("clears all equipment slots", () => {
      const equipment = new Map([
        [
          "player-1",
          {
            weapon: "bronze_sword",
            shield: "wooden_shield",
            helmet: "bronze_helm",
            body: "bronze_platebody",
            legs: "bronze_platelegs",
            arrows: "bronze_arrows",
          },
        ],
      ]);
      const manager = new MockEquipmentBankManager([], equipment);

      manager.depositAllEquipment("player-1");

      const equip = manager.getEquipment("player-1");
      for (const slot of [
        "weapon",
        "shield",
        "helmet",
        "body",
        "legs",
        "arrows",
      ]) {
        expect(equip?.[slot as EquipmentSlotName]).toBeNull();
      }
    });

    it("handles multiple items going to same bank stack", () => {
      // Two bronze swords equipped (hypothetically, weapon and spare)
      // Actually, same item can't be in multiple slots, but if depositing
      // an item that already exists in bank, it should stack
      const equipment = new Map([["player-1", { weapon: "bronze_sword" }]]);
      const manager = new MockEquipmentBankManager(
        [
          {
            playerId: "player-1",
            itemId: "bronze_sword",
            quantity: 5,
            slot: 0,
            tabIndex: 0,
          },
        ],
        equipment,
      );

      manager.depositAllEquipment("player-1");

      const bankItem = manager.getBankItem("player-1", "bronze_sword");
      expect(bankItem?.quantity).toBe(6);
    });
  });

  describe("Partial Scenarios", () => {
    it("handles empty equipment (nothing to deposit)", () => {
      const equipment = new Map([["player-1", {}]]);
      const manager = new MockEquipmentBankManager([], equipment);

      const result = manager.depositAllEquipment("player-1");

      expect(result.success).toBe(true);
      expect(result.depositedCount).toBe(0);
    });

    it("handles player with no equipment data", () => {
      const manager = new MockEquipmentBankManager([]);

      const result = manager.depositAllEquipment("player-1");

      expect(result.success).toBe(true);
      expect(result.depositedCount).toBe(0);
    });

    it("deposits only occupied slots", () => {
      const equipment = new Map([
        ["player-1", { weapon: "bronze_sword", body: "bronze_platebody" }],
      ]);
      const manager = new MockEquipmentBankManager([], equipment);

      const result = manager.depositAllEquipment("player-1");

      expect(result.success).toBe(true);
      expect(result.depositedCount).toBe(2);

      expect(manager.getBankItemCount("player-1")).toBe(2);
    });
  });

  describe("Player Isolation", () => {
    it("only deposits equipment for specified player", () => {
      const equipment = new Map([
        ["player-1", { weapon: "bronze_sword" }],
        ["player-2", { weapon: "iron_sword" }],
      ]);
      const manager = new MockEquipmentBankManager([], equipment);

      manager.depositAllEquipment("player-1");

      // Player 1 should have deposited
      expect(manager.getEquipment("player-1")?.weapon).toBeNull();
      expect(manager.getBankItem("player-1", "bronze_sword")).toBeDefined();

      // Player 2 should be unchanged
      expect(manager.getEquipment("player-2")?.weapon).toBe("iron_sword");
      expect(manager.getBankItem("player-2", "iron_sword")).toBeUndefined();
    });
  });
});
