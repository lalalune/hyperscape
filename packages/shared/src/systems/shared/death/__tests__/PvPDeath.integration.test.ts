/**
 * PvP Death Integration Tests
 *
 * End-to-end tests for the complete PvP death flow:
 * - Player vs Player combat
 * - Death trigger when health reaches 0
 * - Item drops (wilderness: ground items, safe area: gravestone)
 * - Death lock creation for item security
 * - Looting mechanics
 * - Death lock cleanup
 *
 * These tests verify the complete flow from attack to loot collection,
 * ensuring all systems work together correctly.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { WildernessDeathHandler } from "../WildernessDeathHandler";
import { SafeAreaDeathHandler } from "../SafeAreaDeathHandler";
import { DeathStateManager } from "../DeathStateManager";
import { ZoneType } from "../../../../types/death";
import { COMBAT_CONSTANTS } from "../../../../constants/CombatConstants";
import { ticksToMs } from "../../../../utils/game/CombatCalculations";

// =============================================================================
// TEST UTILITIES
// =============================================================================

interface HealthTracker {
  current: number;
  max: number;
  damageHistory: number[];
}

interface MockInventoryItem {
  id: string;
  itemId: string;
  quantity: number;
  slot: number;
  metadata: null;
}

interface MockPlayer {
  id: string;
  type: "player";
  position: { x: number; y: number; z: number };
  health: number;
  healthTracker: HealthTracker;
  inventory: MockInventoryItem[];
  equipment: MockInventoryItem[];
  isDead: () => boolean;
  takeDamage: Mock;
  getHealth: () => number;
}

interface MockGroundItem {
  id: string;
  itemId: string;
  quantity: number;
  position: { x: number; y: number; z: number };
  droppedBy: string;
  despawnTick: number;
  lootProtectionTick: number;
}

/**
 * Create a mock player with inventory and equipment
 */
function createMockPlayer(
  id: string,
  options: {
    health?: number;
    maxHealth?: number;
    position?: { x: number; y: number; z: number };
    inventory?: MockInventoryItem[];
    equipment?: MockInventoryItem[];
  } = {},
): MockPlayer {
  const healthTracker: HealthTracker = {
    current: options.health ?? 100,
    max: options.maxHealth ?? 100,
    damageHistory: [],
  };

  const position = options.position ?? { x: 0, y: 0, z: 0 };
  const inventory = options.inventory ?? [];
  const equipment = options.equipment ?? [];

  return {
    id,
    type: "player",
    position,
    health: healthTracker.current,
    healthTracker,
    inventory,
    equipment,
    isDead: () => healthTracker.current <= 0,
    takeDamage: vi.fn((amount: number) => {
      healthTracker.damageHistory.push(amount);
      healthTracker.current = Math.max(0, healthTracker.current - amount);
      return healthTracker.current;
    }),
    getHealth: () => healthTracker.current,
  };
}

/**
 * Create standard test inventory items
 */
function createTestInventory(): MockInventoryItem[] {
  return [
    {
      id: "inv_1",
      itemId: "rune_scimitar",
      quantity: 1,
      slot: 0,
      metadata: null,
    },
    { id: "inv_2", itemId: "coins", quantity: 10000, slot: 1, metadata: null },
    { id: "inv_3", itemId: "shark", quantity: 20, slot: 2, metadata: null },
    {
      id: "inv_4",
      itemId: "prayer_potion",
      quantity: 4,
      slot: 3,
      metadata: null,
    },
  ];
}

/**
 * Create standard test equipment items
 */
function createTestEquipment(): MockInventoryItem[] {
  return [
    {
      id: "equip_1",
      itemId: "dragon_platebody",
      quantity: 1,
      slot: 0,
      metadata: null,
    },
    {
      id: "equip_2",
      itemId: "dragon_platelegs",
      quantity: 1,
      slot: 1,
      metadata: null,
    },
    {
      id: "equip_3",
      itemId: "amulet_of_fury",
      quantity: 1,
      slot: 2,
      metadata: null,
    },
  ];
}

/**
 * Create a mock world with all necessary systems
 */
function createMockWorld(isServer = true, currentTick = 1000) {
  const players = new Map<string, MockPlayer>();
  const groundItems = new Map<string, MockGroundItem>();
  const gravestones = new Map<string, unknown>();
  const eventHandlers = new Map<string, Function[]>();
  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  let tick = currentTick;

  // Mock systems
  const mockEntityManager = {
    spawnEntity: vi.fn().mockImplementation((config) => {
      if (config.type === "headstone") {
        gravestones.set(config.id, config);
      }
      return { id: config.id };
    }),
    destroyEntity: vi.fn().mockImplementation((id: string) => {
      gravestones.delete(id);
      groundItems.delete(id);
    }),
    getEntity: vi.fn().mockImplementation((id: string) => {
      return groundItems.get(id) || gravestones.get(id);
    }),
  };

  const mockInventorySystem = {
    getInventory: vi.fn().mockImplementation((playerId: string) => {
      const player = players.get(playerId);
      return player ? { items: player.inventory } : null;
    }),
    clearInventoryImmediate: vi.fn().mockResolvedValue(undefined),
    addItem: vi.fn().mockResolvedValue(true),
  };

  const mockEquipmentSystem = {
    getPlayerEquipment: vi.fn().mockImplementation((playerId: string) => {
      const player = players.get(playerId);
      return player ? { items: player.equipment } : null;
    }),
    clearEquipmentImmediate: vi.fn().mockResolvedValue(undefined),
  };

  const mockDatabaseSystem = {
    saveDeathLockAsync: vi.fn().mockResolvedValue(undefined),
    getDeathLockAsync: vi.fn().mockResolvedValue(null),
    deleteDeathLockAsync: vi.fn().mockResolvedValue(undefined),
    updateGroundItemsAsync: vi.fn().mockResolvedValue(undefined),
    acquireDeathLockAsync: vi.fn().mockResolvedValue(true), // Atomic lock acquisition
    getUnrecoveredDeathsAsync: vi.fn().mockResolvedValue([]),
    markDeathRecoveredAsync: vi.fn().mockResolvedValue(undefined),
    executeInTransaction: vi.fn().mockImplementation(async (fn) => {
      const mockTx = { __brand: Symbol() };
      await fn(mockTx);
    }),
  };

  return {
    isServer,
    get currentTick() {
      return tick;
    },
    setTick(newTick: number) {
      tick = newTick;
    },
    advanceTicks(count: number) {
      tick += count;
    },
    players,
    groundItems,
    gravestones,
    emittedEvents,
    entities: {
      players, // Required by SafeAreaDeathHandler.spawnGravestone
    },
    getPlayer: (id: string) => players.get(id),
    getSystem: vi.fn().mockImplementation((name: string) => {
      switch (name) {
        case "entity-manager":
          return mockEntityManager;
        case "inventory":
          return mockInventorySystem;
        case "equipment":
          return mockEquipmentSystem;
        case "database":
          return mockDatabaseSystem;
        default:
          return null;
      }
    }),
    on: (event: string, handler: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event)!.push(handler);
    },
    off: vi.fn(),
    emit: vi.fn((event: string, data: unknown) => {
      emittedEvents.push({ event, data });
      const handlers = eventHandlers.get(event) || [];
      handlers.forEach((h) => h(data));
    }),
    // Direct access to mocks for assertions
    _entityManager: mockEntityManager,
    _inventorySystem: mockInventorySystem,
    _equipmentSystem: mockEquipmentSystem,
    _databaseSystem: mockDatabaseSystem,
  };
}

/**
 * Create a mock GroundItemSystem
 */
function createMockGroundItemSystem(world: ReturnType<typeof createMockWorld>) {
  let groundItemIdCounter = 0;

  return {
    spawnGroundItems: vi.fn().mockImplementation(
      (
        items: MockInventoryItem[],
        position: { x: number; y: number; z: number },
        options: {
          despawnTime: number;
          droppedBy?: string;
          lootProtection?: number;
          scatter?: boolean;
          scatterRadius?: number;
        },
      ) => {
        const ids: string[] = [];
        const despawnTicks = Math.floor(options.despawnTime / 600);
        const protectionTicks = options.lootProtection
          ? Math.floor(options.lootProtection / 600)
          : 0;

        for (const item of items) {
          const groundItemId = `ground_item_${++groundItemIdCounter}`;
          const groundItem: MockGroundItem = {
            id: groundItemId,
            itemId: item.itemId,
            quantity: item.quantity,
            position: { ...position },
            droppedBy: options.droppedBy || "",
            despawnTick: world.currentTick + despawnTicks,
            lootProtectionTick: world.currentTick + protectionTicks,
          };
          world.groundItems.set(groundItemId, groundItem);
          ids.push(groundItemId);
        }
        return Promise.resolve(ids);
      },
    ),
    lootGroundItem: vi
      .fn()
      .mockImplementation((itemId: string, _looterId: string) => {
        const item = world.groundItems.get(itemId);
        if (item) {
          world.groundItems.delete(itemId);
          return Promise.resolve(item);
        }
        return Promise.resolve(null);
      }),
  };
}

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe("PvP Death Integration", () => {
  let world: ReturnType<typeof createMockWorld>;
  let groundItemSystem: ReturnType<typeof createMockGroundItemSystem>;
  let deathStateManager: DeathStateManager;
  let wildernessHandler: WildernessDeathHandler;
  let safeAreaHandler: SafeAreaDeathHandler;

  beforeEach(async () => {
    world = createMockWorld(true, 1000);
    groundItemSystem = createMockGroundItemSystem(world);
    deathStateManager = new DeathStateManager(world as never);
    await deathStateManager.init();

    wildernessHandler = new WildernessDeathHandler(
      world as never,
      groundItemSystem as never,
      deathStateManager,
    );

    safeAreaHandler = new SafeAreaDeathHandler(
      world as never,
      groundItemSystem as never,
      deathStateManager,
    );
  });

  describe("wilderness PvP death flow", () => {
    it("completes full death flow: attack → death → ground items → loot", async () => {
      // Setup: Two players in wilderness
      const attacker = createMockPlayer("attacker", {
        position: { x: 100, y: 0, z: 100 },
        inventory: createTestInventory(),
      });
      const victim = createMockPlayer("victim", {
        health: 50,
        position: { x: 101, y: 0, z: 100 },
        inventory: createTestInventory(),
        equipment: createTestEquipment(),
      });

      world.players.set("attacker", attacker);
      world.players.set("victim", victim);

      // Step 1: Simulate combat damage until death
      let totalDamage = 0;
      while (!victim.isDead()) {
        const damage = Math.min(10, victim.getHealth()); // Deal 10 damage per hit
        victim.takeDamage(damage);
        totalDamage += damage;
      }

      expect(victim.isDead()).toBe(true);
      expect(totalDamage).toBe(50);

      // Step 2: Handle death - items drop to ground
      const allItems = [...victim.inventory, ...victim.equipment];
      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        allItems,
        "attacker",
        ZoneType.WILDERNESS,
      );

      // Step 3: Verify ground items spawned
      expect(groundItemSystem.spawnGroundItems).toHaveBeenCalledTimes(1);
      expect(groundItemSystem.spawnGroundItems).toHaveBeenCalledWith(
        allItems,
        victim.position,
        expect.objectContaining({
          despawnTime: ticksToMs(COMBAT_CONSTANTS.GROUND_ITEM_DESPAWN_TICKS),
          droppedBy: "victim",
          lootProtection: ticksToMs(COMBAT_CONSTANTS.LOOT_PROTECTION_TICKS),
          scatter: true,
          scatterRadius: 3.0,
        }),
        false, // throwOnFailure=false when no transaction
      );

      // Step 4: Verify death lock created
      const deathLock = await deathStateManager.getDeathLock("victim");
      expect(deathLock).not.toBeNull();
      expect(deathLock?.zoneType).toBe(ZoneType.WILDERNESS);
      expect(deathLock?.itemCount).toBe(7); // 4 inventory + 3 equipment
      expect(deathLock?.groundItemIds).toHaveLength(7);

      // Step 5: Verify ground items exist
      expect(world.groundItems.size).toBe(7);

      // Step 6: Simulate looting all items - pass manifest itemIds with full quantity
      const groundItemEntries = Array.from(world.groundItems.entries());
      for (const [_entityId, groundItem] of groundItemEntries) {
        // Pass the manifest itemId and full quantity to fully loot each item
        await deathStateManager.onItemLooted(
          "victim",
          groundItem.itemId,
          groundItem.quantity,
        );
      }

      // Step 7: Verify death lock cleared after all items looted
      const finalLock = await deathStateManager.getDeathLock("victim");
      expect(finalLock).toBeNull();
    });

    it("applies loot protection to ground items (killer gets first access)", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 50, y: 0, z: 50 },
        inventory: [
          {
            id: "i1",
            itemId: "coins",
            quantity: 1000,
            slot: 0,
            metadata: null,
          },
        ],
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "pker",
        ZoneType.WILDERNESS,
      );

      // Verify loot protection timing
      const spawnCall = groundItemSystem.spawnGroundItems.mock.calls[0][2];
      expect(spawnCall.lootProtection).toBe(
        ticksToMs(COMBAT_CONSTANTS.LOOT_PROTECTION_TICKS),
      );

      // Ground item should have protection tick set
      const groundItem = Array.from(world.groundItems.values())[0];
      expect(groundItem.lootProtectionTick).toBe(
        world.currentTick + COMBAT_CONSTANTS.LOOT_PROTECTION_TICKS,
      );
    });

    it("handles PVP_ZONE death same as wilderness", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 25, y: 0, z: 25 },
        inventory: createTestInventory(),
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "rival",
        ZoneType.PVP_ZONE,
      );

      const deathLock = await deathStateManager.getDeathLock("victim");
      expect(deathLock?.zoneType).toBe(ZoneType.PVP_ZONE);
      expect(world.groundItems.size).toBe(4);
    });
  });

  describe("safe area death flow", () => {
    it("spawns gravestone instead of ground items in safe area", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 10, y: 0, z: 10 },
        inventory: createTestInventory(),
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await safeAreaHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "monster",
      );

      // Gravestone should be spawned
      expect(world._entityManager.spawnEntity).toHaveBeenCalledTimes(1);
      const spawnCall = world._entityManager.spawnEntity.mock.calls[0][0];
      expect(spawnCall.id).toMatch(/^gravestone_victim_\d+$/);
      expect(spawnCall.headstoneData.items).toEqual(victim.inventory);

      // No ground items yet (gravestone holds items)
      expect(groundItemSystem.spawnGroundItems).not.toHaveBeenCalled();

      // Death lock created with gravestone ID
      const deathLock = await deathStateManager.getDeathLock("victim");
      expect(deathLock?.gravestoneId).toMatch(/^gravestone_victim_\d+$/);
      expect(deathLock?.zoneType).toBe(ZoneType.SAFE_AREA);
    });

    it("transitions gravestone to ground items after expiration", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 10, y: 0, z: 10 },
        inventory: createTestInventory(),
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await safeAreaHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "monster",
      );

      const gravestoneId = world._entityManager.spawnEntity.mock.calls[0][0].id;

      // Advance time to gravestone expiration
      const expirationTick =
        world.currentTick + COMBAT_CONSTANTS.GRAVESTONE_TICKS;
      world.setTick(expirationTick);

      // Process tick to trigger expiration
      safeAreaHandler.processTick(expirationTick);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Gravestone should be destroyed
      expect(world._entityManager.destroyEntity).toHaveBeenCalledWith(
        gravestoneId,
      );

      // Ground items should now exist
      expect(groundItemSystem.spawnGroundItems).toHaveBeenCalledTimes(1);

      // Death lock should be updated (no gravestone, has ground items)
      const deathLock = await deathStateManager.getDeathLock("victim");
      expect(deathLock?.gravestoneId).toBeUndefined();
      expect(deathLock?.groundItemIds).toBeDefined();
    });
  });

  describe("death lock security", () => {
    it("prevents item duplication by blocking during active death lock", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        inventory: createTestInventory(),
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "pker",
        ZoneType.WILDERNESS,
      );

      // Active death lock should exist
      const hasLock = await deathStateManager.hasActiveDeathLock("victim");
      expect(hasLock).toBe(true);

      // Simulated reconnect check - server should block inventory load
      // when death lock exists
      const deathLock = await deathStateManager.getDeathLock("victim");
      expect(deathLock).not.toBeNull();
      expect(deathLock?.itemCount).toBe(4);

      // Items are on ground, not in inventory
      expect(world.groundItems.size).toBe(4);
    });

    it("persists death lock to database for crash recovery", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        inventory: createTestInventory(),
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "pker",
        ZoneType.WILDERNESS,
      );

      // Database should have been called with atomic acquisition
      expect(world._databaseSystem.acquireDeathLockAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: "victim",
          zoneType: ZoneType.WILDERNESS,
          itemCount: 4,
        }),
        undefined,
      );
    });

    it("clears death lock from database when all items looted", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        inventory: [
          { id: "i1", itemId: "coins", quantity: 100, slot: 0, metadata: null },
        ],
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "pker",
        ZoneType.WILDERNESS,
      );

      // Loot the single item - pass the manifest itemId with full quantity
      const groundItemId = Array.from(world.groundItems.keys())[0];
      const groundItem = world.groundItems.get(groundItemId);
      // Pass the manifest itemId and quantity to fully loot the item
      await deathStateManager.onItemLooted(
        "victim",
        groundItem!.itemId,
        groundItem!.quantity,
      );

      // Database delete should have been called
      expect(world._databaseSystem.deleteDeathLockAsync).toHaveBeenCalledWith(
        "victim",
      );
    });
  });

  describe("multiple deaths scenario", () => {
    it("handles rapid sequential deaths correctly", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        inventory: createTestInventory(),
      });

      world.players.set("victim", victim);

      // First death
      victim.takeDamage(1);
      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "pker1",
        ZoneType.WILDERNESS,
      );

      const firstLock = await deathStateManager.getDeathLock("victim");
      expect(firstLock).not.toBeNull();

      // Clear first death lock (simulating full loot)
      await deathStateManager.clearDeathLock("victim");

      // Reset victim for second death
      victim.healthTracker.current = 1;
      victim.inventory = [
        { id: "i99", itemId: "gold_bar", quantity: 5, slot: 0, metadata: null },
      ];

      // Second death
      victim.takeDamage(1);
      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "pker2",
        ZoneType.WILDERNESS,
      );

      const secondLock = await deathStateManager.getDeathLock("victim");
      expect(secondLock).not.toBeNull();
      expect(secondLock?.itemCount).toBe(1); // Only the new item
    });

    it("handles concurrent deaths of multiple players", async () => {
      const player1 = createMockPlayer("player1", {
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        inventory: [
          {
            id: "p1_i1",
            itemId: "coins",
            quantity: 100,
            slot: 0,
            metadata: null,
          },
        ],
      });
      const player2 = createMockPlayer("player2", {
        health: 1,
        position: { x: 10, y: 0, z: 10 },
        inventory: [
          {
            id: "p2_i1",
            itemId: "gold_bar",
            quantity: 50,
            slot: 0,
            metadata: null,
          },
        ],
      });

      world.players.set("player1", player1);
      world.players.set("player2", player2);

      // Both die "simultaneously"
      player1.takeDamage(1);
      player2.takeDamage(1);

      await Promise.all([
        wildernessHandler.handleDeath(
          "player1",
          player1.position,
          player1.inventory,
          "mob",
          ZoneType.WILDERNESS,
        ),
        wildernessHandler.handleDeath(
          "player2",
          player2.position,
          player2.inventory,
          "mob",
          ZoneType.WILDERNESS,
        ),
      ]);

      // Both should have death locks
      const lock1 = await deathStateManager.getDeathLock("player1");
      const lock2 = await deathStateManager.getDeathLock("player2");

      expect(lock1).not.toBeNull();
      expect(lock2).not.toBeNull();
      expect(lock1?.playerId).toBe("player1");
      expect(lock2?.playerId).toBe("player2");

      // Ground items should be separate
      expect(world.groundItems.size).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("handles death with empty inventory gracefully", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        inventory: [],
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      // Should not throw
      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        [],
        "pker",
        ZoneType.WILDERNESS,
      );

      // No ground items, no death lock
      expect(world.groundItems.size).toBe(0);
      expect(groundItemSystem.spawnGroundItems).not.toHaveBeenCalled();
    });

    it("handles death at world boundaries", async () => {
      const extremePositions = [
        { x: -10000, y: 0, z: -10000 },
        { x: 10000, y: 0, z: 10000 },
        { x: 0, y: 1000, z: 0 },
      ];

      for (const position of extremePositions) {
        const victim = createMockPlayer(`victim_${position.x}`, {
          health: 1,
          position,
          inventory: [
            { id: "i1", itemId: "coins", quantity: 1, slot: 0, metadata: null },
          ],
        });

        world.players.set(victim.id, victim);
        victim.takeDamage(1);

        // Should handle without error
        await wildernessHandler.handleDeath(
          victim.id,
          victim.position,
          victim.inventory,
          "pker",
          ZoneType.WILDERNESS,
        );

        const groundItem = Array.from(world.groundItems.values()).pop();
        expect(groundItem?.position).toEqual(position);

        // Cleanup for next iteration
        await deathStateManager.clearDeathLock(victim.id);
        world.groundItems.clear();
      }
    });

    it("handles high-value inventory (many items)", async () => {
      // Create inventory with 28 items (full classic MMORPG inventory)
      const largeInventory: MockInventoryItem[] = [];
      for (let i = 0; i < 28; i++) {
        largeInventory.push({
          id: `inv_${i}`,
          itemId: `item_type_${i % 5}`,
          quantity: 100 + i,
          slot: i,
          metadata: null,
        });
      }

      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        inventory: largeInventory,
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "pker",
        ZoneType.WILDERNESS,
      );

      // All 28 items should drop
      expect(world.groundItems.size).toBe(28);

      const deathLock = await deathStateManager.getDeathLock("victim");
      expect(deathLock?.itemCount).toBe(28);
      expect(deathLock?.groundItemIds).toHaveLength(28);
    });
  });

  describe("timing accuracy (classic MMORPG compliance)", () => {
    it("uses correct despawn time for ground items (300 ticks = 3 minutes)", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        inventory: [
          { id: "i1", itemId: "coins", quantity: 1, slot: 0, metadata: null },
        ],
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "pker",
        ZoneType.WILDERNESS,
      );

      const groundItem = Array.from(world.groundItems.values())[0];
      const expectedDespawnTick =
        world.currentTick + COMBAT_CONSTANTS.GROUND_ITEM_DESPAWN_TICKS;

      expect(groundItem.despawnTick).toBe(expectedDespawnTick);
    });

    it("uses correct gravestone duration (500 ticks for standard)", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        inventory: createTestInventory(),
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await safeAreaHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "monster",
      );

      const gravestoneId = world._entityManager.spawnEntity.mock.calls[0][0].id;
      const ticksUntilExpiration = safeAreaHandler.getTicksUntilExpiration(
        gravestoneId,
        world.currentTick,
      );

      expect(ticksUntilExpiration).toBe(COMBAT_CONSTANTS.GRAVESTONE_TICKS);
    });

    it("uses correct loot protection duration (100 ticks = 1 minute)", async () => {
      const victim = createMockPlayer("victim", {
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        inventory: [
          { id: "i1", itemId: "coins", quantity: 1, slot: 0, metadata: null },
        ],
      });

      world.players.set("victim", victim);
      victim.takeDamage(1);

      await wildernessHandler.handleDeath(
        "victim",
        victim.position,
        victim.inventory,
        "pker",
        ZoneType.WILDERNESS,
      );

      const groundItem = Array.from(world.groundItems.values())[0];
      const expectedProtectionTick =
        world.currentTick + COMBAT_CONSTANTS.LOOT_PROTECTION_TICKS;

      expect(groundItem.lootProtectionTick).toBe(expectedProtectionTick);
    });
  });
});
