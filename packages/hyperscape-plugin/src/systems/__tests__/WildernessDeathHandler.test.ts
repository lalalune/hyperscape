/**
 * WildernessDeathHandler Unit Tests
 *
 * Tests the wilderness/PvP death handling system.
 *
 * Key behaviors tested:
 * - Server authority: Client cannot spawn ground items
 * - Immediate ground item spawning (no gravestone)
 * - Correct loot protection timing
 * - Death lock creation for item security
 * - Transaction support for atomic operations
 * - Edge cases: empty items, spawn failures
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { WildernessDeathHandler } from "../WildernessDeathHandler";
import { ZoneType } from "@hyperforge/shared";
import { COMBAT_CONSTANTS } from "@hyperforge/shared";
import { ticksToMs } from "@hyperforge/shared";

// Mock types
interface MockWorld {
  isServer: boolean;
}

interface MockGroundItemSystem {
  spawnGroundItems: Mock;
}

interface MockDeathStateManager {
  createDeathLock: Mock;
  onItemLooted: Mock;
}

// Factory functions for mocks
function createMockWorld(isServer = true): MockWorld {
  return {
    isServer,
  };
}

function createMockGroundItemSystem(): MockGroundItemSystem {
  return {
    spawnGroundItems: vi
      .fn()
      .mockResolvedValue(["ground_item_1", "ground_item_2", "ground_item_3"]),
  };
}

function createMockDeathStateManager(): MockDeathStateManager {
  return {
    createDeathLock: vi.fn().mockResolvedValue(undefined),
    onItemLooted: vi.fn().mockResolvedValue(undefined),
  };
}

function createTestItems() {
  return [
    {
      id: "item_1",
      itemId: "dragon_scimitar",
      quantity: 1,
      slot: 0,
      metadata: null,
    },
    { id: "item_2", itemId: "coins", quantity: 50000, slot: 1, metadata: null },
    { id: "item_3", itemId: "shark", quantity: 10, slot: 2, metadata: null },
  ];
}

const TEST_POSITION = { x: 300, y: 50, z: 400 };

describe("WildernessDeathHandler", () => {
  let world: MockWorld;
  let groundItemSystem: MockGroundItemSystem;
  let deathStateManager: MockDeathStateManager;
  let handler: WildernessDeathHandler;

  beforeEach(() => {
    world = createMockWorld(true);
    groundItemSystem = createMockGroundItemSystem();
    deathStateManager = createMockDeathStateManager();

    handler = new WildernessDeathHandler(
      world as never,
      groundItemSystem as never,
      deathStateManager as never,
    );
  });

  describe("handleDeath", () => {
    it("blocks client-side death handling (server authority)", async () => {
      const clientWorld = createMockWorld(false);
      const clientHandler = new WildernessDeathHandler(
        clientWorld as never,
        groundItemSystem as never,
        deathStateManager as never,
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await clientHandler.handleDeath(
        "player1",
        TEST_POSITION,
        createTestItems(),
        "pker",
        ZoneType.WILDERNESS,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Client attempted server-only"),
      );
      expect(groundItemSystem.spawnGroundItems).not.toHaveBeenCalled();
      expect(deathStateManager.createDeathLock).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("returns early when no items to drop", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await handler.handleDeath(
        "player1",
        TEST_POSITION,
        [],
        "pker",
        ZoneType.WILDERNESS,
      );

      expect(groundItemSystem.spawnGroundItems).not.toHaveBeenCalled();
      expect(deathStateManager.createDeathLock).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No items to drop"),
      );

      consoleSpy.mockRestore();
    });

    it("spawns ground items immediately with correct options", async () => {
      const items = createTestItems();

      await handler.handleDeath(
        "player1",
        TEST_POSITION,
        items,
        "pker",
        ZoneType.WILDERNESS,
      );

      expect(groundItemSystem.spawnGroundItems).toHaveBeenCalledWith(
        items,
        TEST_POSITION,
        expect.objectContaining({
          despawnTime: ticksToMs(COMBAT_CONSTANTS.GROUND_ITEM_DESPAWN_TICKS),
          droppedBy: "player1",
          lootProtection: ticksToMs(COMBAT_CONSTANTS.LOOT_PROTECTION_TICKS),
          scatter: true,
          scatterRadius: 3.0,
        }),
        false, // throwOnFailure=false when no transaction
      );
    });

    it("uses wider scatter radius than safe area (3.0 vs 2.0)", async () => {
      await handler.handleDeath(
        "player1",
        TEST_POSITION,
        createTestItems(),
        "pker",
        ZoneType.WILDERNESS,
      );

      const spawnCall = groundItemSystem.spawnGroundItems.mock.calls[0][2];
      expect(spawnCall.scatterRadius).toBe(3.0);
    });

    it("creates death lock with ground item IDs", async () => {
      const items = createTestItems();

      await handler.handleDeath(
        "player1",
        TEST_POSITION,
        items,
        "pker",
        ZoneType.WILDERNESS,
      );

      expect(deathStateManager.createDeathLock).toHaveBeenCalledWith(
        "player1",
        expect.objectContaining({
          groundItemIds: ["ground_item_1", "ground_item_2", "ground_item_3"],
          position: TEST_POSITION,
          zoneType: ZoneType.WILDERNESS,
          itemCount: 3,
        }),
        undefined, // no transaction
      );
    });

    it("handles PVP_ZONE type correctly", async () => {
      await handler.handleDeath(
        "player1",
        TEST_POSITION,
        createTestItems(),
        "rival",
        ZoneType.PVP_ZONE,
      );

      expect(deathStateManager.createDeathLock).toHaveBeenCalledWith(
        "player1",
        expect.objectContaining({
          zoneType: ZoneType.PVP_ZONE,
        }),
        undefined,
      );
    });

    it("passes transaction context through to death lock creation", async () => {
      const mockTx = { __brand: Symbol() } as never;

      await handler.handleDeath(
        "player1",
        TEST_POSITION,
        createTestItems(),
        "pker",
        ZoneType.WILDERNESS,
        mockTx,
      );

      expect(deathStateManager.createDeathLock).toHaveBeenCalledWith(
        "player1",
        expect.any(Object),
        mockTx,
      );
    });

    it("throws error in transaction when ground item spawn fails", async () => {
      groundItemSystem.spawnGroundItems.mockResolvedValue([]);
      const mockTx = { __brand: Symbol() } as never;

      await expect(
        handler.handleDeath(
          "player1",
          TEST_POSITION,
          createTestItems(),
          "pker",
          ZoneType.WILDERNESS,
          mockTx,
        ),
      ).rejects.toThrow("Failed to spawn ground items");
    });

    it("returns silently when ground item spawn fails without transaction", async () => {
      groundItemSystem.spawnGroundItems.mockResolvedValue([]);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Should not throw
      await handler.handleDeath(
        "player1",
        TEST_POSITION,
        createTestItems(),
        "pker",
        ZoneType.WILDERNESS,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to spawn ground items"),
      );
      expect(deathStateManager.createDeathLock).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("logs death details correctly", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const items = createTestItems();

      await handler.handleDeath(
        "player1",
        TEST_POSITION,
        items,
        "pker",
        ZoneType.WILDERNESS,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Handling wilderness death for player1"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Spawned 3 ground items"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("onItemLooted", () => {
    it("delegates to death state manager", async () => {
      await handler.onItemLooted("player1", "item_456");

      expect(deathStateManager.onItemLooted).toHaveBeenCalledWith(
        "player1",
        "item_456",
      );
    });
  });

  describe("destroy", () => {
    it("completes without error (no cleanup needed)", () => {
      // Should not throw
      handler.destroy();
    });
  });

  describe("timing constants", () => {
    it("uses configured ground item despawn time from COMBAT_CONSTANTS", async () => {
      await handler.handleDeath(
        "player1",
        TEST_POSITION,
        createTestItems(),
        "pker",
        ZoneType.WILDERNESS,
      );

      const spawnCall = groundItemSystem.spawnGroundItems.mock.calls[0][2];
      const expectedMs = ticksToMs(COMBAT_CONSTANTS.GROUND_ITEM_DESPAWN_TICKS);

      expect(spawnCall.despawnTime).toBe(expectedMs);
      // 6000 ticks * 600ms = 3600000ms = 60 minutes (tile-based-MMORPG-accurate)
      expect(expectedMs).toBe(3600000);
    });

    it("uses configured loot protection from COMBAT_CONSTANTS (100 ticks = 1 minute)", async () => {
      await handler.handleDeath(
        "player1",
        TEST_POSITION,
        createTestItems(),
        "pker",
        ZoneType.WILDERNESS,
      );

      const spawnCall = groundItemSystem.spawnGroundItems.mock.calls[0][2];
      const expectedMs = ticksToMs(COMBAT_CONSTANTS.LOOT_PROTECTION_TICKS);

      expect(spawnCall.lootProtection).toBe(expectedMs);
      // 100 ticks * 600ms = 60000ms = 1 minute
      expect(expectedMs).toBe(60000);
    });
  });
});
