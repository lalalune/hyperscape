/**
 * EquipmentSystem Unit Tests
 *
 * Tests the equipment functionality:
 * - Level requirements validation
 * - 2-handed weapon logic
 * - Equip/unequip flow
 * - Stats calculation
 * - Persistence operations
 * - Death handling
 *
 * NOTE: Uses mocked system logic to avoid circular dependency issues.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// Types (mirrors actual types)
// ============================================================================

interface Item {
  id: string;
  name: string;
  type: string;
  equipSlot?: string;
  is2h?: boolean;
  bonuses?: Record<string, number>;
  requirements?: {
    skills?: Record<string, number>;
  };
}

interface EquipmentSlot {
  id: string;
  name: string;
  slot: string;
  itemId: string | null;
  item: Item | null;
  quantity?: number;
}

interface PlayerEquipment {
  playerId: string;
  weapon: EquipmentSlot;
  shield: EquipmentSlot;
  helmet: EquipmentSlot;
  body: EquipmentSlot;
  legs: EquipmentSlot;
  boots: EquipmentSlot;
  gloves: EquipmentSlot;
  cape: EquipmentSlot;
  amulet: EquipmentSlot;
  ring: EquipmentSlot;
  arrows: EquipmentSlot;
  totalStats: Record<string, number>;
}

// ============================================================================
// Mock Equipment Manager (core equipment logic)
// ============================================================================

class MockEquipmentManager {
  private playerEquipment = new Map<string, PlayerEquipment>();
  private playerSkills = new Map<string, Record<string, number>>();
  private inventoryItems = new Map<string, Map<string, number>>(); // playerId -> itemId -> quantity
  private playerTradeState = new Map<string, boolean>(); // playerId -> in trade
  private playerDeathState = new Map<string, "alive" | "dying" | "dead">();
  private savedEquipment: Array<{
    playerId: string;
    slots: Record<string, string | null>;
    quantities?: Record<string, number | null>;
  }> = [];
  private messages: Array<{ playerId: string; message: string; type: string }> =
    [];

  // Mock item database
  private itemDatabase: Map<string, Item> = new Map();

  /**
   * Register an item in the mock database
   */
  registerItem(item: Item): void {
    this.itemDatabase.set(item.id, item);
  }

  /**
   * Initialize equipment for a player
   */
  initializePlayer(playerId: string): void {
    const equipment: PlayerEquipment = {
      playerId,
      weapon: {
        id: `${playerId}_weapon`,
        name: "Weapon Slot",
        slot: "weapon",
        itemId: null,
        item: null,
      },
      shield: {
        id: `${playerId}_shield`,
        name: "Shield Slot",
        slot: "shield",
        itemId: null,
        item: null,
      },
      helmet: {
        id: `${playerId}_helmet`,
        name: "Helmet Slot",
        slot: "helmet",
        itemId: null,
        item: null,
      },
      body: {
        id: `${playerId}_body`,
        name: "Body Slot",
        slot: "body",
        itemId: null,
        item: null,
      },
      legs: {
        id: `${playerId}_legs`,
        name: "Legs Slot",
        slot: "legs",
        itemId: null,
        item: null,
      },
      boots: {
        id: `${playerId}_boots`,
        name: "Boots Slot",
        slot: "boots",
        itemId: null,
        item: null,
      },
      gloves: {
        id: `${playerId}_gloves`,
        name: "Gloves Slot",
        slot: "gloves",
        itemId: null,
        item: null,
      },
      cape: {
        id: `${playerId}_cape`,
        name: "Cape Slot",
        slot: "cape",
        itemId: null,
        item: null,
      },
      amulet: {
        id: `${playerId}_amulet`,
        name: "Amulet Slot",
        slot: "amulet",
        itemId: null,
        item: null,
      },
      ring: {
        id: `${playerId}_ring`,
        name: "Ring Slot",
        slot: "ring",
        itemId: null,
        item: null,
      },
      arrows: {
        id: `${playerId}_arrows`,
        name: "Arrow Slot",
        slot: "arrows",
        itemId: null,
        item: null,
      },
      totalStats: {
        attack: 0,
        strength: 0,
        defense: 0,
        ranged: 0,
        constitution: 0,
      },
    };
    this.playerEquipment.set(playerId, equipment);
    this.playerSkills.set(playerId, {
      attack: 1,
      strength: 1,
      defense: 1,
      ranged: 1,
    });
    this.inventoryItems.set(playerId, new Map());
  }

  /**
   * Set player skill levels
   */
  setSkills(playerId: string, skills: Record<string, number>): void {
    this.playerSkills.set(playerId, skills);
  }

  /**
   * Add item to player's inventory
   */
  addToInventory(playerId: string, itemId: string, quantity: number = 1): void {
    const inv = this.inventoryItems.get(playerId) || new Map();
    inv.set(itemId, (inv.get(itemId) || 0) + quantity);
    this.inventoryItems.set(playerId, inv);
  }

  /**
   * Remove item from inventory
   */
  removeFromInventory(
    playerId: string,
    itemId: string,
    quantity: number = 1,
  ): boolean {
    const inv = this.inventoryItems.get(playerId);
    if (!inv) return false;
    const current = inv.get(itemId) || 0;
    if (current < quantity) return false;
    if (current === quantity) {
      inv.delete(itemId);
    } else {
      inv.set(itemId, current - quantity);
    }
    return true;
  }

  /**
   * Check if player has item in inventory
   */
  hasItem(playerId: string, itemId: string): boolean {
    const inv = this.inventoryItems.get(playerId);
    return inv ? (inv.get(itemId) || 0) > 0 : false;
  }

  /**
   * Get inventory count (for full inventory checks)
   */
  getInventoryCount(playerId: string): number {
    const inv = this.inventoryItems.get(playerId);
    return inv ? inv.size : 0;
  }

  /**
   * Set inventory to full (28 unique items)
   */
  fillInventory(playerId: string): void {
    const inv = this.inventoryItems.get(playerId) || new Map();
    for (let i = 0; i < 28; i++) {
      inv.set(`filler_${i}`, 1);
    }
    this.inventoryItems.set(playerId, inv);
  }

  /**
   * Set player trade state (for guard tests)
   */
  setInTrade(playerId: string, inTrade: boolean): void {
    this.playerTradeState.set(playerId, inTrade);
  }

  /**
   * Set player death state (for guard tests)
   */
  setDeathState(playerId: string, state: "alive" | "dying" | "dead"): void {
    this.playerDeathState.set(playerId, state);
  }

  /**
   * Check if player is in active trade
   */
  isPlayerInTrade(playerId: string): boolean {
    return this.playerTradeState.get(playerId) === true;
  }

  /**
   * Check if player is dead or dying
   */
  isPlayerDead(playerId: string): boolean {
    const state = this.playerDeathState.get(playerId);
    return state === "dying" || state === "dead";
  }

  /**
   * Check level requirements for an item
   */
  meetsLevelRequirements(playerId: string, item: Item): boolean {
    const playerSkills = this.playerSkills.get(playerId);
    if (!playerSkills) return false;

    const requirements = item.requirements?.skills;
    if (!requirements) return true;

    for (const [skill, required] of Object.entries(requirements)) {
      const playerLevel = playerSkills[skill] || 1;
      if (playerLevel < required) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get requirement text for an item
   */
  getRequirementText(item: Item): string {
    const reqs = item.requirements?.skills;
    if (!reqs) return "";
    return Object.entries(reqs)
      .filter(([, level]) => level > 0)
      .map(
        ([skill, level]) =>
          `level ${level} ${skill.charAt(0).toUpperCase() + skill.slice(1)}`,
      )
      .join(" and ");
  }

  /**
   * Check if item is 2-handed weapon
   */
  is2hWeapon(item: Item): boolean {
    return item.equipSlot === "2h" || item.is2h === true;
  }

  /**
   * Get equipment slot type for an item
   */
  getEquipmentSlot(item: Item): string | null {
    if (this.is2hWeapon(item)) {
      return "weapon";
    }
    switch (item.type) {
      case "weapon":
        return "weapon";
      case "armor":
        return item.equipSlot || null;
      case "ammunition":
        return "arrows";
      default:
        return null;
    }
  }

  /**
   * Try to equip an item
   */
  tryEquipItem(
    playerId: string,
    itemId: string,
  ): { success: boolean; message?: string } {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      return { success: false, message: "Player not found" };
    }

    const item = this.itemDatabase.get(itemId);
    if (!item) {
      return { success: false, message: "Item not found" };
    }

    // Guard: block equip during active trade
    if (this.isPlayerInTrade(playerId)) {
      const msg = "You can't change equipment during a trade.";
      this.messages.push({ playerId, message: msg, type: "warning" });
      return { success: false, message: msg };
    }

    // Guard: block equip while dead
    if (this.isPlayerDead(playerId)) {
      const msg = "You can't change equipment while dead.";
      this.messages.push({ playerId, message: msg, type: "warning" });
      return { success: false, message: msg };
    }

    // Check if player has item
    if (!this.hasItem(playerId, itemId)) {
      return { success: false, message: "Item not in inventory" };
    }

    const slotName = this.getEquipmentSlot(item);
    if (!slotName) {
      const msg = `${item.name} cannot be equipped.`;
      this.messages.push({ playerId, message: msg, type: "warning" });
      return { success: false, message: msg };
    }

    // Check level requirements
    if (!this.meetsLevelRequirements(playerId, item)) {
      const reqText = this.getRequirementText(item);
      const msg = `You need at least ${reqText} to equip ${item.name}.`;
      this.messages.push({ playerId, message: msg, type: "warning" });
      return { success: false, message: msg };
    }

    // Handle 2h weapon + shield conflict
    if (this.is2hWeapon(item) && slotName === "weapon") {
      const shieldSlot = equipment.shield;
      if (shieldSlot.itemId) {
        // Auto-unequip shield
        this.unequipSlot(playerId, "shield");
        this.messages.push({
          playerId,
          message: "Shield unequipped (2-handed weapon equipped).",
          type: "info",
        });
      }
    }

    // Check if trying to equip shield while 2h equipped
    if (slotName === "shield") {
      const currentWeapon = equipment.weapon.item;
      if (currentWeapon && this.is2hWeapon(currentWeapon)) {
        const msg = "Cannot equip shield while wielding a 2-handed weapon.";
        this.messages.push({ playerId, message: msg, type: "warning" });
        return { success: false, message: msg };
      }
    }

    // Perform equip
    return this.equipItem(playerId, itemId, slotName);
  }

  /**
   * Equip item to specific slot
   */
  equipItem(
    playerId: string,
    itemId: string,
    slotName: string,
  ): { success: boolean; message?: string } {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return { success: false, message: "Player not found" };

    const item = this.itemDatabase.get(itemId);
    if (!item) return { success: false, message: "Item not found" };

    const slot = equipment[slotName as keyof PlayerEquipment] as EquipmentSlot;
    if (!slot || typeof slot === "string" || !("itemId" in slot)) {
      return { success: false, message: "Invalid slot" };
    }

    // Unequip current item if any
    if (slot.itemId) {
      this.unequipSlot(playerId, slotName);
    }

    // Remove from inventory and equip (track quantity for stackable items)
    const inv = this.inventoryItems.get(playerId);
    const currentQuantity = inv?.get(itemId) || 0;
    if (!this.removeFromInventory(playerId, itemId, currentQuantity)) {
      return { success: false, message: "Failed to remove from inventory" };
    }

    slot.itemId = itemId;
    slot.item = item;
    if (item.type === "ammunition") {
      slot.quantity = currentQuantity;
    }

    // Recalculate stats
    this.recalculateStats(playerId);

    this.messages.push({
      playerId,
      message: `Equipped ${item.name}.`,
      type: "info",
    });
    return { success: true };
  }

  /**
   * Unequip slot
   */
  unequipSlot(
    playerId: string,
    slotName: string,
  ): { success: boolean; message?: string } {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return { success: false, message: "Player not found" };

    // Guard: block unequip during active trade
    if (this.isPlayerInTrade(playerId)) {
      const msg = "You can't change equipment during a trade.";
      this.messages.push({ playerId, message: msg, type: "warning" });
      return { success: false, message: msg };
    }

    // Guard: block unequip while dead
    if (this.isPlayerDead(playerId)) {
      const msg = "You can't change equipment while dead.";
      this.messages.push({ playerId, message: msg, type: "warning" });
      return { success: false, message: msg };
    }

    const slot = equipment[slotName as keyof PlayerEquipment] as EquipmentSlot;
    if (!slot || typeof slot === "string" || !("itemId" in slot)) {
      return { success: false, message: "Invalid slot" };
    }

    if (!slot.itemId || !slot.item) {
      return { success: false, message: "Slot is empty" };
    }

    // Check inventory space (simulate 28 slot limit)
    if (this.getInventoryCount(playerId) >= 28) {
      this.messages.push({
        playerId,
        message: "Inventory is full.",
        type: "warning",
      });
      return { success: false, message: "Inventory is full" };
    }

    const itemName = slot.item.name;
    const itemId = slot.itemId;

    // Add back to inventory
    this.addToInventory(playerId, itemId);

    // Clear slot
    slot.itemId = null;
    slot.item = null;

    // Recalculate stats
    this.recalculateStats(playerId);

    this.messages.push({
      playerId,
      message: `Unequipped ${itemName}.`,
      type: "info",
    });
    return { success: true };
  }

  /**
   * Recalculate total stats from equipped items
   */
  recalculateStats(playerId: string): void {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return;

    // Reset stats
    equipment.totalStats = {
      attack: 0,
      strength: 0,
      defense: 0,
      ranged: 0,
      constitution: 0,
    };

    // Sum bonuses from all equipped items
    const slots: EquipmentSlot[] = [
      equipment.weapon,
      equipment.shield,
      equipment.helmet,
      equipment.body,
      equipment.legs,
      equipment.boots,
      equipment.gloves,
      equipment.cape,
      equipment.amulet,
      equipment.ring,
      equipment.arrows,
    ];

    for (const slot of slots) {
      if (slot.item?.bonuses) {
        for (const [stat, bonus] of Object.entries(slot.item.bonuses)) {
          if (stat in equipment.totalStats) {
            equipment.totalStats[stat] += bonus;
          }
        }
      }
    }
  }

  /**
   * Get player equipment
   */
  getEquipment(playerId: string): PlayerEquipment | undefined {
    return this.playerEquipment.get(playerId);
  }

  /**
   * Get total stats
   */
  getTotalStats(playerId: string): Record<string, number> {
    return (
      this.playerEquipment.get(playerId)?.totalStats || {
        attack: 0,
        strength: 0,
        defense: 0,
        ranged: 0,
        constitution: 0,
      }
    );
  }

  /**
   * Clear all equipment (death handling)
   */
  clearEquipmentImmediate(playerId: string): number {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return 0;

    let clearedCount = 0;
    const slotNames = [
      "weapon",
      "shield",
      "helmet",
      "body",
      "legs",
      "boots",
      "gloves",
      "cape",
      "amulet",
      "ring",
      "arrows",
    ] as const;

    for (const slotName of slotNames) {
      const slot = equipment[slotName];
      if (slot.item) {
        clearedCount++;
        slot.itemId = null;
        slot.item = null;
      }
    }

    // Reset stats
    equipment.totalStats = {
      attack: 0,
      strength: 0,
      defense: 0,
      ranged: 0,
      constitution: 0,
    };

    // Simulate immediate save
    this.savedEquipment.push({
      playerId,
      slots: {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        boots: null,
        gloves: null,
        cape: null,
        amulet: null,
        ring: null,
        arrows: null,
      },
    });

    return clearedCount;
  }

  /**
   * Save equipment to database (simulated)
   */
  saveEquipment(playerId: string): void {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return;

    this.savedEquipment.push({
      playerId,
      slots: {
        weapon: equipment.weapon.itemId,
        shield: equipment.shield.itemId,
        helmet: equipment.helmet.itemId,
        body: equipment.body.itemId,
        legs: equipment.legs.itemId,
        boots: equipment.boots.itemId,
        gloves: equipment.gloves.itemId,
        cape: equipment.cape.itemId,
        amulet: equipment.amulet.itemId,
        ring: equipment.ring.itemId,
        arrows: equipment.arrows.itemId,
      },
      quantities: {
        arrows: equipment.arrows.quantity ?? null,
      },
    });
  }

  /**
   * Load equipment from database (simulated)
   */
  loadEquipment(
    playerId: string,
    slots: Record<string, string | null>,
    quantities?: Record<string, number | null>,
  ): void {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return;

    for (const [slotName, itemId] of Object.entries(slots)) {
      if (itemId) {
        const item = this.itemDatabase.get(itemId);
        const slot = equipment[
          slotName as keyof PlayerEquipment
        ] as EquipmentSlot;
        if (slot && item && typeof slot !== "string" && "itemId" in slot) {
          slot.itemId = itemId;
          slot.item = item;
          if (quantities?.[slotName]) {
            slot.quantity = quantities[slotName]!;
          }
        }
      }
    }

    this.recalculateStats(playerId);
  }

  /**
   * Get saved equipment calls
   */
  getSavedEquipment(): Array<{
    playerId: string;
    slots: Record<string, string | null>;
    quantities?: Record<string, number | null>;
  }> {
    return this.savedEquipment;
  }

  /**
   * Get messages
   */
  getMessages(): Array<{ playerId: string; message: string; type: string }> {
    return this.messages;
  }

  /**
   * Reset state
   */
  reset(): void {
    this.playerEquipment.clear();
    this.playerSkills.clear();
    this.inventoryItems.clear();
    this.savedEquipment = [];
    this.messages = [];
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestItems(): Map<string, Item> {
  const items = new Map<string, Item>();

  // Bronze tier (level 1)
  items.set("bronze_shortsword", {
    id: "bronze_shortsword",
    name: "Bronze Sword",
    type: "weapon",
    bonuses: { attack: 4, strength: 3 },
    requirements: { skills: { attack: 1 } },
  });

  items.set("bronze_shield", {
    id: "bronze_shield",
    name: "Bronze Shield",
    type: "armor",
    equipSlot: "shield",
    bonuses: { defense: 3 },
    requirements: { skills: { defense: 1 } },
  });

  // Steel tier (level 10)
  items.set("steel_shortsword", {
    id: "steel_shortsword",
    name: "Steel Sword",
    type: "weapon",
    bonuses: { attack: 12, strength: 10 },
    requirements: { skills: { attack: 10 } },
  });

  items.set("steel_platebody", {
    id: "steel_platebody",
    name: "Steel Platebody",
    type: "armor",
    equipSlot: "body",
    bonuses: { defense: 15 },
    requirements: { skills: { defense: 10 } },
  });

  // Mithril tier (level 20)
  items.set("mithril_2h", {
    id: "mithril_2h",
    name: "Mithril 2H Sword",
    type: "weapon",
    is2h: true,
    bonuses: { attack: 25, strength: 23 },
    requirements: { skills: { attack: 20 } },
  });

  // Items with no bonuses
  items.set("basic_helmet", {
    id: "basic_helmet",
    name: "Basic Helmet",
    type: "armor",
    equipSlot: "helmet",
  });

  // Non-equippable item
  items.set("coins", {
    id: "coins",
    name: "Coins",
    type: "currency",
  });

  // Boots
  items.set("leather_boots", {
    id: "leather_boots",
    name: "Leather Boots",
    type: "armor",
    equipSlot: "boots",
    bonuses: { defense: 2 },
  });

  // Gloves
  items.set("leather_gloves", {
    id: "leather_gloves",
    name: "Leather Gloves",
    type: "armor",
    equipSlot: "gloves",
    bonuses: { attack: 1, defense: 1 },
  });

  // Cape
  items.set("cape", {
    id: "cape",
    name: "Cape",
    type: "armor",
    equipSlot: "cape",
    bonuses: { defense: 1 },
  });

  // Amulet
  items.set("amulet_of_strength", {
    id: "amulet_of_strength",
    name: "Amulet of Strength",
    type: "armor",
    equipSlot: "amulet",
    bonuses: { strength: 6 },
  });

  // Ring
  items.set("berserker_ring", {
    id: "berserker_ring",
    name: "Berserker Ring",
    type: "armor",
    equipSlot: "ring",
    bonuses: { strength: 4 },
  });

  // Arrows
  items.set("bronze_arrows", {
    id: "bronze_arrows",
    name: "Bronze Arrows",
    type: "ammunition",
    bonuses: { ranged: 2 },
  });

  return items;
}

// ============================================================================
// Tests
// ============================================================================

describe("EquipmentSystem", () => {
  let manager: MockEquipmentManager;
  let testItems: Map<string, Item>;

  beforeEach(() => {
    manager = new MockEquipmentManager();
    testItems = createTestItems();

    // Register all test items
    for (const item of testItems.values()) {
      manager.registerItem(item);
    }

    // Initialize a test player
    manager.initializePlayer("player-1");
  });

  describe("Level Requirements", () => {
    it("allows equipping items when level requirements met", () => {
      manager.setSkills("player-1", { attack: 10, defense: 1 });
      manager.addToInventory("player-1", "steel_shortsword");

      const result = manager.tryEquipItem("player-1", "steel_shortsword");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "steel_shortsword",
      );
    });

    it("blocks equipping items when level requirements not met", () => {
      manager.setSkills("player-1", { attack: 5, defense: 1 }); // Level 5, needs 10
      manager.addToInventory("player-1", "steel_shortsword");

      const result = manager.tryEquipItem("player-1", "steel_shortsword");

      expect(result.success).toBe(false);
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBeNull();
      expect(manager.hasItem("player-1", "steel_shortsword")).toBe(true); // Still in inventory
    });

    it("returns correct requirement message for blocked items", () => {
      manager.setSkills("player-1", { attack: 5, defense: 1 });
      manager.addToInventory("player-1", "steel_shortsword");

      manager.tryEquipItem("player-1", "steel_shortsword");

      const messages = manager.getMessages();
      expect(messages.some((m) => m.message.includes("level 10 Attack"))).toBe(
        true,
      );
    });

    it("allows items with no requirements", () => {
      manager.addToInventory("player-1", "basic_helmet");

      const result = manager.tryEquipItem("player-1", "basic_helmet");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.helmet.itemId).toBe(
        "basic_helmet",
      );
    });
  });

  describe("2-Handed Weapons", () => {
    it("auto-unequips shield when equipping 2h weapon", () => {
      manager.setSkills("player-1", { attack: 20, defense: 1 });
      manager.addToInventory("player-1", "bronze_shield");
      manager.addToInventory("player-1", "mithril_2h");

      // First equip shield
      manager.tryEquipItem("player-1", "bronze_shield");
      expect(manager.getEquipment("player-1")?.shield.itemId).toBe(
        "bronze_shield",
      );

      // Then equip 2h weapon
      const result = manager.tryEquipItem("player-1", "mithril_2h");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "mithril_2h",
      );
      expect(manager.getEquipment("player-1")?.shield.itemId).toBeNull();
      expect(manager.hasItem("player-1", "bronze_shield")).toBe(true); // Back in inventory
    });

    it("blocks shield equip when 2h weapon equipped", () => {
      manager.setSkills("player-1", { attack: 20, defense: 1 });
      manager.addToInventory("player-1", "mithril_2h");
      manager.addToInventory("player-1", "bronze_shield");

      // First equip 2h weapon
      manager.tryEquipItem("player-1", "mithril_2h");
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "mithril_2h",
      );

      // Try to equip shield
      const result = manager.tryEquipItem("player-1", "bronze_shield");

      expect(result.success).toBe(false);
      expect(manager.getEquipment("player-1")?.shield.itemId).toBeNull();
      expect(manager.hasItem("player-1", "bronze_shield")).toBe(true);
    });

    it("allows 1h weapon + shield combination", () => {
      manager.setSkills("player-1", { attack: 1, defense: 1 });
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.addToInventory("player-1", "bronze_shield");

      manager.tryEquipItem("player-1", "bronze_shortsword");
      const result = manager.tryEquipItem("player-1", "bronze_shield");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "bronze_shortsword",
      );
      expect(manager.getEquipment("player-1")?.shield.itemId).toBe(
        "bronze_shield",
      );
    });
  });

  describe("Equip/Unequip Flow", () => {
    it("moves item from inventory to equipment slot", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      expect(manager.hasItem("player-1", "bronze_shortsword")).toBe(true);

      manager.tryEquipItem("player-1", "bronze_shortsword");

      expect(manager.hasItem("player-1", "bronze_shortsword")).toBe(false);
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "bronze_shortsword",
      );
    });

    it("moves item from equipment slot to inventory", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shortsword");

      const result = manager.unequipSlot("player-1", "weapon");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBeNull();
      expect(manager.hasItem("player-1", "bronze_shortsword")).toBe(true);
    });

    it("swaps items when equipping to occupied slot", () => {
      manager.setSkills("player-1", { attack: 10, defense: 1 });
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.addToInventory("player-1", "steel_shortsword");

      // Equip bronze sword first
      manager.tryEquipItem("player-1", "bronze_shortsword");
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "bronze_shortsword",
      );

      // Equip steel sword (should swap)
      manager.tryEquipItem("player-1", "steel_shortsword");

      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "steel_shortsword",
      );
      expect(manager.hasItem("player-1", "bronze_shortsword")).toBe(true);
      expect(manager.hasItem("player-1", "steel_shortsword")).toBe(false);
    });

    it("fails gracefully when inventory full on unequip", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shortsword");

      // Fill inventory
      manager.fillInventory("player-1");

      const result = manager.unequipSlot("player-1", "weapon");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Inventory is full");
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "bronze_shortsword",
      );
    });

    it("rejects equipping non-equippable items", () => {
      manager.addToInventory("player-1", "coins");

      const result = manager.tryEquipItem("player-1", "coins");

      expect(result.success).toBe(false);
      expect(
        manager
          .getMessages()
          .some((m) => m.message.includes("cannot be equipped")),
      ).toBe(true);
    });

    it("equips boots to the boots slot", () => {
      manager.addToInventory("player-1", "leather_boots");

      const result = manager.tryEquipItem("player-1", "leather_boots");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.boots.itemId).toBe(
        "leather_boots",
      );
    });

    it("equips gloves to the gloves slot", () => {
      manager.addToInventory("player-1", "leather_gloves");

      const result = manager.tryEquipItem("player-1", "leather_gloves");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.gloves.itemId).toBe(
        "leather_gloves",
      );
    });

    it("equips cape to the cape slot", () => {
      manager.addToInventory("player-1", "cape");

      const result = manager.tryEquipItem("player-1", "cape");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.cape.itemId).toBe("cape");
    });

    it("equips amulet to the amulet slot", () => {
      manager.addToInventory("player-1", "amulet_of_strength");

      const result = manager.tryEquipItem("player-1", "amulet_of_strength");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.amulet.itemId).toBe(
        "amulet_of_strength",
      );
    });

    it("equips ring to the ring slot", () => {
      manager.addToInventory("player-1", "berserker_ring");

      const result = manager.tryEquipItem("player-1", "berserker_ring");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.ring.itemId).toBe(
        "berserker_ring",
      );
    });
  });

  describe("Stats Calculation", () => {
    it("sums bonuses from all equipped items", () => {
      manager.setSkills("player-1", { attack: 10, defense: 10 });
      manager.addToInventory("player-1", "steel_shortsword"); // attack: 12, strength: 10
      manager.addToInventory("player-1", "steel_platebody"); // defense: 15
      manager.addToInventory("player-1", "bronze_arrows"); // ranged: 2

      manager.tryEquipItem("player-1", "steel_shortsword");
      manager.tryEquipItem("player-1", "steel_platebody");
      manager.tryEquipItem("player-1", "bronze_arrows");

      const stats = manager.getTotalStats("player-1");

      expect(stats.attack).toBe(12);
      expect(stats.strength).toBe(10);
      expect(stats.defense).toBe(15);
      expect(stats.ranged).toBe(2);
    });

    it("recalculates on equip", () => {
      manager.addToInventory("player-1", "bronze_shortsword");

      const statsBefore = manager.getTotalStats("player-1");
      expect(statsBefore.attack).toBe(0);

      manager.tryEquipItem("player-1", "bronze_shortsword");

      const statsAfter = manager.getTotalStats("player-1");
      expect(statsAfter.attack).toBe(4);
      expect(statsAfter.strength).toBe(3);
    });

    it("recalculates on unequip", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shortsword");

      expect(manager.getTotalStats("player-1").attack).toBe(4);

      manager.unequipSlot("player-1", "weapon");

      expect(manager.getTotalStats("player-1").attack).toBe(0);
    });

    it("handles items with no bonuses", () => {
      manager.addToInventory("player-1", "basic_helmet");

      manager.tryEquipItem("player-1", "basic_helmet");

      const stats = manager.getTotalStats("player-1");
      expect(stats.attack).toBe(0);
      expect(stats.defense).toBe(0);
      expect(manager.getEquipment("player-1")?.helmet.itemId).toBe(
        "basic_helmet",
      );
    });

    it("sums bonuses from all 11 slots including new accessory slots", () => {
      manager.setSkills("player-1", { attack: 10, defense: 10 });
      manager.addToInventory("player-1", "steel_shortsword"); // attack: 12, strength: 10
      manager.addToInventory("player-1", "steel_platebody"); // defense: 15
      manager.addToInventory("player-1", "leather_boots"); // defense: 2
      manager.addToInventory("player-1", "leather_gloves"); // attack: 1, defense: 1
      manager.addToInventory("player-1", "cape"); // defense: 1
      manager.addToInventory("player-1", "amulet_of_strength"); // strength: 6
      manager.addToInventory("player-1", "berserker_ring"); // strength: 4
      manager.addToInventory("player-1", "bronze_arrows"); // ranged: 2

      manager.tryEquipItem("player-1", "steel_shortsword");
      manager.tryEquipItem("player-1", "steel_platebody");
      manager.tryEquipItem("player-1", "leather_boots");
      manager.tryEquipItem("player-1", "leather_gloves");
      manager.tryEquipItem("player-1", "cape");
      manager.tryEquipItem("player-1", "amulet_of_strength");
      manager.tryEquipItem("player-1", "berserker_ring");
      manager.tryEquipItem("player-1", "bronze_arrows");

      const stats = manager.getTotalStats("player-1");

      expect(stats.attack).toBe(12 + 1); // sword + gloves
      expect(stats.strength).toBe(10 + 6 + 4); // sword + amulet + ring
      expect(stats.defense).toBe(15 + 2 + 1 + 1); // body + boots + gloves + cape
      expect(stats.ranged).toBe(2); // arrows
    });
  });

  describe("Persistence", () => {
    it("saves equipment to database on request", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shortsword");

      manager.saveEquipment("player-1");

      const saved = manager.getSavedEquipment();
      expect(saved.length).toBe(1);
      expect(saved[0].slots.weapon).toBe("bronze_shortsword");
    });

    it("loads equipment from database", () => {
      // Simulate loading from database
      manager.loadEquipment("player-1", {
        weapon: "bronze_shortsword",
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        boots: null,
        gloves: null,
        cape: null,
        amulet: null,
        ring: null,
        arrows: null,
      });

      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "bronze_shortsword",
      );
      expect(manager.getEquipment("player-1")?.weapon.item?.name).toBe(
        "Bronze Sword",
      );
    });

    it("preserves arrow quantity across save and load", () => {
      manager.addToInventory("player-1", "bronze_arrows", 150);

      manager.tryEquipItem("player-1", "bronze_arrows");

      // Verify quantity is tracked on the slot
      const equipment = manager.getEquipment("player-1");
      expect(equipment?.arrows.itemId).toBe("bronze_arrows");
      expect(equipment?.arrows.quantity).toBe(150);

      // Save
      manager.saveEquipment("player-1");
      const saved = manager.getSavedEquipment();
      expect(saved[0].slots.arrows).toBe("bronze_arrows");
      expect(saved[0].quantities?.arrows).toBe(150);

      // Simulate reload: re-initialize and load from saved data
      manager.initializePlayer("player-reload");
      manager.loadEquipment(
        "player-reload",
        saved[0].slots,
        saved[0].quantities,
      );

      const reloaded = manager.getEquipment("player-reload");
      expect(reloaded?.arrows.itemId).toBe("bronze_arrows");
      expect(reloaded?.arrows.quantity).toBe(150);
    });

    it("recalculates stats after loading", () => {
      manager.loadEquipment("player-1", {
        weapon: "bronze_shortsword",
        shield: "bronze_shield",
        helmet: null,
        body: null,
        legs: null,
        boots: null,
        gloves: null,
        cape: null,
        amulet: null,
        ring: null,
        arrows: null,
      });

      const stats = manager.getTotalStats("player-1");
      expect(stats.attack).toBe(4);
      expect(stats.strength).toBe(3);
      expect(stats.defense).toBe(3);
    });
  });

  describe("Death Handling", () => {
    it("clears all equipment on death via clearEquipmentImmediate", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.addToInventory("player-1", "bronze_shield");
      manager.tryEquipItem("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shield");

      const clearedCount = manager.clearEquipmentImmediate("player-1");

      expect(clearedCount).toBe(2);
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBeNull();
      expect(manager.getEquipment("player-1")?.shield.itemId).toBeNull();
    });

    it("persists empty equipment immediately on death", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shortsword");

      manager.clearEquipmentImmediate("player-1");

      const saved = manager.getSavedEquipment();
      expect(saved.length).toBe(1);
      expect(saved[0].slots.weapon).toBeNull();
    });

    it("resets stats on death", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shortsword");

      expect(manager.getTotalStats("player-1").attack).toBe(4);

      manager.clearEquipmentImmediate("player-1");

      expect(manager.getTotalStats("player-1").attack).toBe(0);
    });

    it("clears all 11 equipment slots on death", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.addToInventory("player-1", "bronze_shield");
      manager.addToInventory("player-1", "basic_helmet");
      manager.addToInventory("player-1", "leather_boots");
      manager.addToInventory("player-1", "leather_gloves");
      manager.addToInventory("player-1", "cape");
      manager.addToInventory("player-1", "amulet_of_strength");
      manager.addToInventory("player-1", "berserker_ring");
      manager.addToInventory("player-1", "bronze_arrows");
      manager.tryEquipItem("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shield");
      manager.tryEquipItem("player-1", "basic_helmet");
      manager.tryEquipItem("player-1", "leather_boots");
      manager.tryEquipItem("player-1", "leather_gloves");
      manager.tryEquipItem("player-1", "cape");
      manager.tryEquipItem("player-1", "amulet_of_strength");
      manager.tryEquipItem("player-1", "berserker_ring");
      manager.tryEquipItem("player-1", "bronze_arrows");

      const clearedCount = manager.clearEquipmentImmediate("player-1");

      expect(clearedCount).toBe(9); // 9 items equipped (body + legs empty)
      expect(manager.getEquipment("player-1")?.boots.itemId).toBeNull();
      expect(manager.getEquipment("player-1")?.gloves.itemId).toBeNull();
      expect(manager.getEquipment("player-1")?.cape.itemId).toBeNull();
      expect(manager.getEquipment("player-1")?.amulet.itemId).toBeNull();
      expect(manager.getEquipment("player-1")?.ring.itemId).toBeNull();
    });

    it("can re-equip after respawn", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shortsword");

      // Death clears equipment
      manager.clearEquipmentImmediate("player-1");
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBeNull();

      // Simulate respawn - reload from database
      manager.loadEquipment("player-1", {
        weapon: "bronze_shortsword",
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        boots: null,
        gloves: null,
        cape: null,
        amulet: null,
        ring: null,
        arrows: null,
      });

      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "bronze_shortsword",
      );
    });
  });

  describe("Trade + Equip Guard", () => {
    it("blocks equip when player is in active trade", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.setInTrade("player-1", true);

      const result = manager.tryEquipItem("player-1", "bronze_shortsword");

      expect(result.success).toBe(false);
      expect(result.message).toBe("You can't change equipment during a trade.");
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBeNull();
      expect(manager.hasItem("player-1", "bronze_shortsword")).toBe(true);
    });

    it("blocks unequip when player is in active trade", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shortsword");
      manager.setInTrade("player-1", true);

      const result = manager.unequipSlot("player-1", "weapon");

      expect(result.success).toBe(false);
      expect(result.message).toBe("You can't change equipment during a trade.");
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "bronze_shortsword",
      );
    });

    it("allows equip after trade ends", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.setInTrade("player-1", true);

      // Blocked during trade
      expect(
        manager.tryEquipItem("player-1", "bronze_shortsword").success,
      ).toBe(false);

      // Trade ends
      manager.setInTrade("player-1", false);

      // Now allowed
      const result = manager.tryEquipItem("player-1", "bronze_shortsword");
      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "bronze_shortsword",
      );
    });
  });

  describe("Death + Equip Guard", () => {
    it("blocks equip when player is dying", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.setDeathState("player-1", "dying");

      const result = manager.tryEquipItem("player-1", "bronze_shortsword");

      expect(result.success).toBe(false);
      expect(result.message).toBe("You can't change equipment while dead.");
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBeNull();
    });

    it("blocks equip when player is dead", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.setDeathState("player-1", "dead");

      const result = manager.tryEquipItem("player-1", "bronze_shortsword");

      expect(result.success).toBe(false);
      expect(result.message).toBe("You can't change equipment while dead.");
    });

    it("blocks unequip when player is dead", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.tryEquipItem("player-1", "bronze_shortsword");
      manager.setDeathState("player-1", "dead");

      const result = manager.unequipSlot("player-1", "weapon");

      expect(result.success).toBe(false);
      expect(result.message).toBe("You can't change equipment while dead.");
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "bronze_shortsword",
      );
    });

    it("allows equip after respawn", () => {
      manager.addToInventory("player-1", "bronze_shortsword");
      manager.setDeathState("player-1", "dead");

      // Blocked while dead
      expect(
        manager.tryEquipItem("player-1", "bronze_shortsword").success,
      ).toBe(false);

      // Respawn
      manager.setDeathState("player-1", "alive");

      // Now allowed
      const result = manager.tryEquipItem("player-1", "bronze_shortsword");
      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.weapon.itemId).toBe(
        "bronze_shortsword",
      );
    });
  });

  describe("Edge Cases", () => {
    it("handles player not initialized", () => {
      const result = manager.tryEquipItem(
        "unknown-player",
        "bronze_shortsword",
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("Player not found");
    });

    it("handles unknown item", () => {
      manager.addToInventory("player-1", "nonexistent_item");

      const result = manager.tryEquipItem("player-1", "nonexistent_item");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Item not found");
    });

    it("handles item not in inventory", () => {
      const result = manager.tryEquipItem("player-1", "bronze_shortsword");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Item not in inventory");
    });

    it("handles unequipping empty slot", () => {
      const result = manager.unequipSlot("player-1", "weapon");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Slot is empty");
    });
  });
});
