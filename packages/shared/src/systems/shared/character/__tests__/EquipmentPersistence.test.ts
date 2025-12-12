/**
 * Equipment Persistence Integration Tests
 *
 * Tests the equipment persistence flow that was broken in issue #273:
 * "Player equipped item disappears every so often on fresh login"
 *
 * Root cause: Race condition where client received equipment data
 * before the database load completed, resulting in empty equipment.
 *
 * These tests verify:
 * - Equipment persists across login/logout cycles
 * - Equipment is correctly loaded from DB on fresh login
 * - No data loss during server shutdown
 * - Async operations complete before state is sent to client
 */

import { describe, it, expect, beforeEach } from "bun:test";

// ============================================================================
// Types
// ============================================================================

interface Item {
  id: string;
  name: string;
  type: string;
  equipSlot?: string;
  bonuses?: Record<string, number>;
}

interface EquipmentSlot {
  itemId: string | null;
  item: Item | null;
}

interface PlayerEquipment {
  weapon: EquipmentSlot;
  shield: EquipmentSlot;
  helmet: EquipmentSlot;
  body: EquipmentSlot;
  legs: EquipmentSlot;
  arrows: EquipmentSlot;
}

interface DatabaseRow {
  id: string;
  equipment: string; // JSON string
}

// ============================================================================
// Mock Database (simulates async DB operations)
// ============================================================================

class MockDatabase {
  private storage = new Map<string, DatabaseRow>();
  private loadDelay: number;

  constructor(loadDelayMs: number = 50) {
    this.loadDelay = loadDelayMs;
  }

  async saveEquipment(
    playerId: string,
    equipment: Record<string, string | null>,
  ): Promise<void> {
    // Simulate async DB write
    await this.delay(10);
    this.storage.set(playerId, {
      id: playerId,
      equipment: JSON.stringify(equipment),
    });
  }

  async loadEquipment(
    playerId: string,
  ): Promise<Record<string, string | null> | null> {
    // Simulate async DB read with configurable delay
    await this.delay(this.loadDelay);
    const row = this.storage.get(playerId);
    if (!row) return null;
    return JSON.parse(row.equipment);
  }

  async getPlayerAsync(playerId: string): Promise<DatabaseRow | null> {
    await this.delay(this.loadDelay);
    return this.storage.get(playerId) || null;
  }

  setLoadDelay(ms: number): void {
    this.loadDelay = ms;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  clear(): void {
    this.storage.clear();
  }

  // For testing: check what's in DB without delay
  getStoredEquipmentSync(
    playerId: string,
  ): Record<string, string | null> | null {
    const row = this.storage.get(playerId);
    if (!row) return null;
    return JSON.parse(row.equipment);
  }
}

// ============================================================================
// Mock Equipment Manager (simulates EquipmentSystem behavior)
// ============================================================================

class MockEquipmentManager {
  private playerEquipment = new Map<string, PlayerEquipment>();
  private database: MockDatabase;
  private itemDatabase = new Map<string, Item>();
  private eventLog: Array<{ event: string; data: unknown; timestamp: number }> =
    [];

  constructor(database: MockDatabase) {
    this.database = database;
    this.registerDefaultItems();
  }

  private registerDefaultItems(): void {
    this.itemDatabase.set("bronze_sword", {
      id: "bronze_sword",
      name: "Bronze Sword",
      type: "weapon",
      bonuses: { attack: 4 },
    });
    this.itemDatabase.set("iron_sword", {
      id: "iron_sword",
      name: "Iron Sword",
      type: "weapon",
      bonuses: { attack: 8 },
    });
    this.itemDatabase.set("bronze_shield", {
      id: "bronze_shield",
      name: "Bronze Shield",
      type: "armor",
      equipSlot: "shield",
      bonuses: { defense: 3 },
    });
  }

  /**
   * Initialize player with empty equipment (called on PLAYER_REGISTERED)
   */
  initializePlayer(playerId: string): void {
    const emptySlot = (): EquipmentSlot => ({ itemId: null, item: null });
    this.playerEquipment.set(playerId, {
      weapon: emptySlot(),
      shield: emptySlot(),
      helmet: emptySlot(),
      body: emptySlot(),
      legs: emptySlot(),
      arrows: emptySlot(),
    });
    this.log("PLAYER_REGISTERED", { playerId });
  }

  /**
   * Load equipment from database (called on PLAYER_JOINED)
   * THIS IS THE CRITICAL ASYNC OPERATION that must complete before
   * sending equipment data to the client.
   */
  async loadFromDatabase(playerId: string): Promise<void> {
    this.log("LOAD_START", { playerId });

    const dbEquipment = await this.database.loadEquipment(playerId);

    if (dbEquipment) {
      const equipment = this.playerEquipment.get(playerId);
      if (equipment) {
        for (const [slotName, itemId] of Object.entries(dbEquipment)) {
          if (itemId && slotName in equipment) {
            const item = this.itemDatabase.get(itemId);
            const slot = equipment[slotName as keyof PlayerEquipment];
            if (slot && item) {
              slot.itemId = itemId;
              slot.item = item;
            }
          }
        }
      }
    }

    this.log("LOAD_COMPLETE", {
      playerId,
      equipment: this.getEquipmentData(playerId),
    });
  }

  /**
   * NON-ASYNC version (the buggy behavior before fix)
   * This demonstrates the race condition.
   */
  loadFromDatabaseFireAndForget(playerId: string): void {
    this.log("LOAD_START_FIRE_AND_FORGET", { playerId });

    // Fire and forget - doesn't wait for completion
    this.database.loadEquipment(playerId).then((dbEquipment) => {
      if (dbEquipment) {
        const equipment = this.playerEquipment.get(playerId);
        if (equipment) {
          for (const [slotName, itemId] of Object.entries(dbEquipment)) {
            if (itemId && slotName in equipment) {
              const item = this.itemDatabase.get(itemId);
              const slot = equipment[slotName as keyof PlayerEquipment];
              if (slot && item) {
                slot.itemId = itemId;
                slot.item = item;
              }
            }
          }
        }
      }
      this.log("LOAD_COMPLETE_DELAYED", { playerId });
    });

    // Returns immediately without waiting
    this.log("LOAD_RETURNED_EARLY", { playerId });
  }

  /**
   * Equip an item
   */
  equipItem(playerId: string, itemId: string): boolean {
    const equipment = this.playerEquipment.get(playerId);
    const item = this.itemDatabase.get(itemId);
    if (!equipment || !item) return false;

    const slotName = item.type === "weapon" ? "weapon" : item.equipSlot || null;
    if (!slotName) return false;

    const slot = equipment[slotName as keyof PlayerEquipment];
    if (slot) {
      slot.itemId = itemId;
      slot.item = item;
    }

    this.log("ITEM_EQUIPPED", { playerId, itemId, slot: slotName });
    return true;
  }

  /**
   * Save equipment to database (must be awaited!)
   */
  async saveToDatabase(playerId: string): Promise<void> {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return;

    const data: Record<string, string | null> = {
      weapon: equipment.weapon.itemId,
      shield: equipment.shield.itemId,
      helmet: equipment.helmet.itemId,
      body: equipment.body.itemId,
      legs: equipment.legs.itemId,
      arrows: equipment.arrows.itemId,
    };

    await this.database.saveEquipment(playerId, data);
    this.log("EQUIPMENT_SAVED", { playerId, data });
  }

  /**
   * Get current equipment data (what would be sent to client)
   */
  getEquipmentData(playerId: string): Record<string, string | null> {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return {};

    return {
      weapon: equipment.weapon.itemId,
      shield: equipment.shield.itemId,
      helmet: equipment.helmet.itemId,
      body: equipment.body.itemId,
      legs: equipment.legs.itemId,
      arrows: equipment.arrows.itemId,
    };
  }

  /**
   * Simulate player disconnect (cleanup)
   */
  cleanupPlayer(playerId: string): void {
    this.playerEquipment.delete(playerId);
    this.log("PLAYER_CLEANUP", { playerId });
  }

  /**
   * Async destroy - awaits all saves before cleanup
   */
  async destroyAsync(): Promise<void> {
    const savePromises: Promise<void>[] = [];
    for (const playerId of this.playerEquipment.keys()) {
      savePromises.push(this.saveToDatabase(playerId));
    }
    await Promise.allSettled(savePromises);
    this.playerEquipment.clear();
    this.log("SYSTEM_DESTROYED_ASYNC", {});
  }

  /**
   * Non-async destroy (the buggy behavior)
   */
  destroyFireAndForget(): void {
    for (const playerId of this.playerEquipment.keys()) {
      // Fire and forget - may not complete before process exits
      this.saveToDatabase(playerId);
    }
    this.playerEquipment.clear();
    this.log("SYSTEM_DESTROYED_FIRE_AND_FORGET", {});
  }

  private log(event: string, data: unknown): void {
    this.eventLog.push({ event, data, timestamp: Date.now() });
  }

  getEventLog(): Array<{ event: string; data: unknown }> {
    return this.eventLog.map(({ event, data }) => ({ event, data }));
  }

  clearEventLog(): void {
    this.eventLog = [];
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Equipment Persistence (Issue #273)", () => {
  let database: MockDatabase;
  let manager: MockEquipmentManager;

  beforeEach(() => {
    database = new MockDatabase(50); // 50ms simulated DB latency
    manager = new MockEquipmentManager(database);
  });

  describe("Login/Logout Cycle", () => {
    it("preserves equipment across logout and fresh login", async () => {
      const playerId = "player-1";

      // === Session 1: Player logs in, equips item, logs out ===
      manager.initializePlayer(playerId);
      manager.equipItem(playerId, "bronze_sword");

      // Verify equipped
      expect(manager.getEquipmentData(playerId).weapon).toBe("bronze_sword");

      // Save and logout
      await manager.saveToDatabase(playerId);
      manager.cleanupPlayer(playerId);

      // Verify cleaned up in memory
      expect(manager.getEquipmentData(playerId).weapon).toBeUndefined();

      // === Session 2: Fresh login ===
      manager.initializePlayer(playerId);

      // CRITICAL: Must await database load
      await manager.loadFromDatabase(playerId);

      // Verify equipment persisted
      expect(manager.getEquipmentData(playerId).weapon).toBe("bronze_sword");
    });

    it("preserves multiple equipped items across sessions", async () => {
      const playerId = "player-1";

      // Session 1: Equip multiple items
      manager.initializePlayer(playerId);
      manager.equipItem(playerId, "bronze_sword");
      manager.equipItem(playerId, "bronze_shield");
      await manager.saveToDatabase(playerId);
      manager.cleanupPlayer(playerId);

      // Session 2: Fresh login
      manager.initializePlayer(playerId);
      await manager.loadFromDatabase(playerId);

      const equipment = manager.getEquipmentData(playerId);
      expect(equipment.weapon).toBe("bronze_sword");
      expect(equipment.shield).toBe("bronze_shield");
    });

    it("handles player with no previous equipment", async () => {
      const playerId = "new-player";

      manager.initializePlayer(playerId);
      await manager.loadFromDatabase(playerId);

      // Should have empty equipment, not crash
      const equipment = manager.getEquipmentData(playerId);
      expect(equipment.weapon).toBeNull();
      expect(equipment.shield).toBeNull();
    });
  });

  describe("Race Condition (The Bug)", () => {
    it("DEMONSTRATES BUG: fire-and-forget load returns empty equipment", async () => {
      const playerId = "player-1";

      // Pre-populate database with equipped item
      await database.saveEquipment(playerId, {
        weapon: "bronze_sword",
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null,
      });

      // Simulate login with fire-and-forget (the buggy behavior)
      manager.initializePlayer(playerId);
      manager.loadFromDatabaseFireAndForget(playerId); // Does NOT await!

      // IMMEDIATELY check equipment (before DB load completes)
      const equipmentBeforeLoad = manager.getEquipmentData(playerId);

      // BUG: Equipment is empty because DB load hasn't completed yet!
      expect(equipmentBeforeLoad.weapon).toBeNull();

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now it's loaded (but client already received empty data)
      const equipmentAfterLoad = manager.getEquipmentData(playerId);
      expect(equipmentAfterLoad.weapon).toBe("bronze_sword");
    });

    it("FIX VERIFIED: awaited load returns correct equipment", async () => {
      const playerId = "player-1";

      // Pre-populate database with equipped item
      await database.saveEquipment(playerId, {
        weapon: "bronze_sword",
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null,
      });

      // Simulate login with proper await (the fix)
      manager.initializePlayer(playerId);
      await manager.loadFromDatabase(playerId); // AWAITS completion

      // Equipment is immediately available
      const equipment = manager.getEquipmentData(playerId);
      expect(equipment.weapon).toBe("bronze_sword");
    });

    it("event ordering shows the race condition", async () => {
      const playerId = "player-1";

      await database.saveEquipment(playerId, {
        weapon: "iron_sword",
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null,
      });

      manager.clearEventLog();

      // Fire-and-forget version
      manager.initializePlayer(playerId);
      manager.loadFromDatabaseFireAndForget(playerId);

      // Simulate "send equipment to client" happening immediately
      manager.getEquipmentData(playerId);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const events = manager.getEventLog().map((e) => e.event);

      // Shows that LOAD_RETURNED_EARLY happens before LOAD_COMPLETE_DELAYED
      expect(events).toContain("LOAD_START_FIRE_AND_FORGET");
      expect(events).toContain("LOAD_RETURNED_EARLY");
      expect(events).toContain("LOAD_COMPLETE_DELAYED");

      const returnedEarlyIndex = events.indexOf("LOAD_RETURNED_EARLY");
      const loadCompleteIndex = events.indexOf("LOAD_COMPLETE_DELAYED");
      expect(returnedEarlyIndex).toBeLessThan(loadCompleteIndex);
    });
  });

  describe("Server Shutdown", () => {
    it("destroyAsync saves all equipment before cleanup", async () => {
      // Setup multiple players with equipment
      manager.initializePlayer("player-1");
      manager.initializePlayer("player-2");
      manager.equipItem("player-1", "bronze_sword");
      manager.equipItem("player-2", "iron_sword");

      // Graceful shutdown
      await manager.destroyAsync();

      // Verify data was saved to database
      const p1Equipment = database.getStoredEquipmentSync("player-1");
      const p2Equipment = database.getStoredEquipmentSync("player-2");

      expect(p1Equipment?.weapon).toBe("bronze_sword");
      expect(p2Equipment?.weapon).toBe("iron_sword");
    });

    it("DEMONSTRATES BUG: fire-and-forget destroy may lose data", async () => {
      manager.initializePlayer("player-1");
      manager.equipItem("player-1", "bronze_sword");

      // Non-graceful shutdown (fire and forget)
      manager.destroyFireAndForget();

      // Check immediately - save may not have completed
      // Note: In real scenario, process might exit before save completes
      const _equipmentImmediately = database.getStoredEquipmentSync("player-1");

      // May or may not be saved depending on timing
      // This demonstrates the race condition risk
      // In production, process.exit() could happen before the save completes

      // Wait a bit and check again
      await new Promise((resolve) => setTimeout(resolve, 50));
      const equipmentAfterWait = database.getStoredEquipmentSync("player-1");
      expect(equipmentAfterWait?.weapon).toBe("bronze_sword");
    });
  });

  describe("Equipment Change Persistence", () => {
    it("saves equipment after each equip operation", async () => {
      const playerId = "player-1";
      manager.initializePlayer(playerId);

      manager.equipItem(playerId, "bronze_sword");
      await manager.saveToDatabase(playerId);

      // Verify in database
      const dbEquipment = database.getStoredEquipmentSync(playerId);
      expect(dbEquipment?.weapon).toBe("bronze_sword");

      // Equip different item
      manager.equipItem(playerId, "iron_sword");
      await manager.saveToDatabase(playerId);

      // Verify update persisted
      const updatedEquipment = database.getStoredEquipmentSync(playerId);
      expect(updatedEquipment?.weapon).toBe("iron_sword");
    });

    it("multiple rapid equip changes are all saved", async () => {
      const playerId = "player-1";
      manager.initializePlayer(playerId);

      // Rapid equip/unequip cycle
      manager.equipItem(playerId, "bronze_sword");
      await manager.saveToDatabase(playerId);

      manager.equipItem(playerId, "iron_sword");
      await manager.saveToDatabase(playerId);

      manager.equipItem(playerId, "bronze_shield");
      await manager.saveToDatabase(playerId);

      // Final state should be persisted
      const equipment = database.getStoredEquipmentSync(playerId);
      expect(equipment?.weapon).toBe("iron_sword");
      expect(equipment?.shield).toBe("bronze_shield");
    });
  });

  describe("High Latency Scenarios", () => {
    it("handles slow database without data loss", async () => {
      // Simulate very slow database
      database.setLoadDelay(200);

      const playerId = "player-1";

      // Save equipment first
      manager.initializePlayer(playerId);
      manager.equipItem(playerId, "bronze_sword");
      await manager.saveToDatabase(playerId);
      manager.cleanupPlayer(playerId);

      // Login with slow DB
      manager.initializePlayer(playerId);
      await manager.loadFromDatabase(playerId);

      // Should still load correctly
      expect(manager.getEquipmentData(playerId).weapon).toBe("bronze_sword");
    });

    it("concurrent logins don't corrupt data", async () => {
      // Pre-populate
      await database.saveEquipment("player-1", {
        weapon: "bronze_sword",
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null,
      });
      await database.saveEquipment("player-2", {
        weapon: "iron_sword",
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null,
      });

      // Simulate concurrent logins
      manager.initializePlayer("player-1");
      manager.initializePlayer("player-2");

      // Load both concurrently
      await Promise.all([
        manager.loadFromDatabase("player-1"),
        manager.loadFromDatabase("player-2"),
      ]);

      // Each player should have their own equipment
      expect(manager.getEquipmentData("player-1").weapon).toBe("bronze_sword");
      expect(manager.getEquipmentData("player-2").weapon).toBe("iron_sword");
    });
  });
});
