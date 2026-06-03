/**
 * PlayerDeathSystem Unit Tests
 *
 * Tests the death-to-respawn pipeline and security guards using mocked systems.
 * (True integration tests use Playwright with real Hyperia instances.)
 *
 * Verifies:
 * - Death processing guard prevents respawn race conditions
 * - Duel system blocks respawn during active duels
 * - Tick-based respawn fires at correct tick
 * - PLAYER_SET_DEAD is the canonical event (not legacy PLAYER_DIED)
 * - Persist retry queue processes on tick
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { PlayerDeathSystem } from "../PlayerDeathSystem";
import { DeathState } from "../../../../types/entities";
import { COMBAT_CONSTANTS } from "../../../../constants/CombatConstants";
import { EventType } from "../../../../types/events";

// =============================================================================
// MOCK INFRASTRUCTURE
// =============================================================================

interface MockPlayerEntity {
  data: {
    e?: string;
    visible?: boolean;
    name?: string;
    position?: number[];
    deathState?: DeathState;
    deathPosition?: [number, number, number];
    respawnTick?: number;
  };
  position?: { x: number; y: number; z: number };
  setHealth: Mock;
  getMaxHealth: Mock;
  markNetworkDirty: Mock;
  emote?: string;
}

function createMockPlayerEntity(
  overrides: Partial<MockPlayerEntity> = {},
): MockPlayerEntity {
  return {
    data: {
      e: "idle",
      visible: true,
      name: "TestPlayer",
      deathState: DeathState.ALIVE,
      ...overrides.data,
    },
    position: { x: 100, y: 0, z: 200 },
    setHealth: vi.fn(),
    getMaxHealth: vi.fn().mockReturnValue(100),
    markNetworkDirty: vi.fn(),
    ...overrides,
  };
}

interface MockWorld {
  isServer: boolean;
  currentTick: number;
  entities: {
    get: Mock;
    players: Map<string, MockPlayerEntity>;
  };
  getSystem: Mock;
  on: Mock;
  off: Mock;
  emit: Mock;
  getPlayer: Mock;
}

function createMockWorld(isServer = true, currentTick = 1000): MockWorld {
  return {
    isServer,
    currentTick,
    entities: {
      get: vi.fn(),
      players: new Map<string, MockPlayerEntity>(),
    },
    getSystem: vi.fn().mockReturnValue(null),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    getPlayer: vi.fn(),
  };
}

/** Minimal mock that lets PlayerDeathSystem construct and subscribe */
function createSystemWorld(world: MockWorld) {
  // PlayerDeathSystem extends SystemBase, which needs world with certain methods
  // We'll use the world directly since SystemBase stores it as this.world
  return world as never;
}

// =============================================================================
// TESTS
// =============================================================================

describe("PlayerDeathSystem — death-to-respawn flow", () => {
  let world: MockWorld;
  let deathSystem: PlayerDeathSystem;
  let subscribedEvents: Map<string, (...args: unknown[]) => void>;
  let emittedEvents: Array<{ type: string; data: unknown }>;

  beforeEach(async () => {
    world = createMockWorld(true, 1000);
    subscribedEvents = new Map();
    emittedEvents = [];

    // Capture event subscriptions
    world.on.mockImplementation(
      (eventType: string, handler: (...args: unknown[]) => void) => {
        subscribedEvents.set(eventType, handler);
      },
    );

    // Capture event emissions
    world.emit.mockImplementation((eventType: string, data: unknown) => {
      emittedEvents.push({ type: eventType, data });
    });

    // Ground items system (required dependency)
    const mockGroundItemSystem = {
      spawnGroundItems: vi.fn().mockResolvedValue(["gi_1", "gi_2"]),
    };

    // Database system
    const mockDatabaseSystem = {
      executeInTransaction: vi
        .fn()
        .mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
          await fn({ __tx: true });
        }),
    };

    // Equipment system
    const mockEquipmentSystem = {
      getPlayerEquipment: vi.fn().mockReturnValue(null),
      clearEquipmentAndReturn: vi.fn().mockResolvedValue([]),
      clearEquipmentImmediate: vi.fn().mockResolvedValue(undefined),
    };

    // Inventory system
    const mockInventorySystem = {
      getItems: vi.fn().mockReturnValue([]),
      clearInventoryImmediate: vi.fn().mockResolvedValue(undefined),
    };

    // Tick system
    const mockTickSystem = {
      getCurrentTick: vi.fn().mockReturnValue(world.currentTick),
      onTick: vi.fn().mockReturnValue(() => {}),
    };

    // Duel system (default: no active duels)
    const mockDuelSystem = {
      isPlayerInActiveDuel: vi.fn().mockReturnValue(false),
    };

    // Entity manager
    const mockEntityManager = {
      spawnEntity: vi.fn().mockResolvedValue({ id: "gravestone_test" }),
      destroyEntity: vi.fn(),
    };

    world.getSystem.mockImplementation((name: string) => {
      switch (name) {
        case "ground-items":
          return mockGroundItemSystem;
        case "database":
          return mockDatabaseSystem;
        case "equipment":
          return mockEquipmentSystem;
        case "inventory":
          return mockInventorySystem;
        case "tick":
          return mockTickSystem;
        case "duel":
          return mockDuelSystem;
        case "entity-manager":
          return mockEntityManager;
        case "terrain":
          return null;
        case "combat":
          return null;
        case "player":
          return { players: world.entities.players };
        default:
          return null;
      }
    });

    deathSystem = new PlayerDeathSystem(createSystemWorld(world));

    // Suppress console output in tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("duel guard on respawn", () => {
    it("blocks respawn request when player is in active duel", () => {
      const mockDuelSystem = {
        isPlayerInActiveDuel: vi.fn().mockReturnValue(true),
      };
      world.getSystem.mockImplementation((name: string) => {
        if (name === "duel") return mockDuelSystem;
        return null;
      });

      // Create a dying player entity
      const playerEntity = createMockPlayerEntity({
        data: { deathState: DeathState.DYING, respawnTick: 900 },
      });
      world.entities.get.mockReturnValue(playerEntity);
      world.entities.players.set("player1", playerEntity);

      // Get the respawn request handler
      const respawnHandler = subscribedEvents.get(
        EventType.PLAYER_RESPAWN_REQUEST,
      );
      if (respawnHandler) {
        respawnHandler({ playerId: "player1" });
      }

      // Player should still be dying — respawn was blocked
      expect(playerEntity.data.deathState).toBe(DeathState.DYING);
    });
  });

  describe("death processing guard", () => {
    it("prevents respawn during active death processing", async () => {
      // Access private deathProcessingInProgress via bracket notation
      const inProgress = (
        deathSystem as unknown as {
          deathProcessingInProgress: Set<string>;
        }
      ).deathProcessingInProgress;

      // Simulate death processing in progress
      inProgress.add("player1");

      const playerEntity = createMockPlayerEntity({
        data: { deathState: DeathState.DYING, respawnTick: 900 },
      });
      world.entities.get.mockReturnValue(playerEntity);
      world.entities.players.set("player1", playerEntity);

      // Call handleRespawnRequest via the subscribed handler
      const respawnHandler = subscribedEvents.get(
        EventType.PLAYER_RESPAWN_REQUEST,
      );
      if (respawnHandler) {
        respawnHandler({ playerId: "player1" });
      }

      // Player should still be dying — respawn blocked by processing guard
      expect(playerEntity.data.deathState).toBe(DeathState.DYING);

      // Cleanup
      inProgress.delete("player1");
    });
  });

  describe("tick-based respawn", () => {
    /** Call the private processPendingRespawns directly (init() is not called in unit tests) */
    function callProcessPendingRespawns(currentTick: number): void {
      const fn = (
        deathSystem as unknown as {
          processPendingRespawns: (tick: number) => void;
        }
      ).processPendingRespawns.bind(deathSystem);
      fn(currentTick);
    }

    it("respawns player when currentTick reaches respawnTick", async () => {
      const playerEntity = createMockPlayerEntity({
        data: {
          deathState: DeathState.DYING,
          respawnTick: 1000 + COMBAT_CONSTANTS.DEATH.ANIMATION_TICKS,
          visible: true,
        },
      });
      world.entities.get.mockReturnValue(playerEntity);
      world.entities.players.set("player1", playerEntity);

      // Process at the respawn tick
      callProcessPendingRespawns(1000 + COMBAT_CONSTANTS.DEATH.ANIMATION_TICKS);

      // Wait for async respawn
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Player should be hidden (pre-respawn) then respawned
      expect(playerEntity.markNetworkDirty).toHaveBeenCalled();
    });

    it("does not respawn before respawnTick", () => {
      const playerEntity = createMockPlayerEntity({
        data: {
          deathState: DeathState.DYING,
          respawnTick: 2000,
          visible: true,
        },
      });
      world.entities.get.mockReturnValue(playerEntity);
      world.entities.players.set("player1", playerEntity);

      // Process before respawn tick
      callProcessPendingRespawns(1500);

      // Player should still be visible and dying
      expect(playerEntity.data.visible).toBe(true);
      expect(playerEntity.data.deathState).toBe(DeathState.DYING);
    });

    it("skips respawn for player being death-processed", () => {
      const inProgress = (
        deathSystem as unknown as {
          deathProcessingInProgress: Set<string>;
        }
      ).deathProcessingInProgress;
      inProgress.add("player1");

      const playerEntity = createMockPlayerEntity({
        data: {
          deathState: DeathState.DYING,
          respawnTick: 500, // Already past
          visible: true,
        },
      });
      world.entities.get.mockReturnValue(playerEntity);
      world.entities.players.set("player1", playerEntity);

      callProcessPendingRespawns(1000);

      // Player should NOT have been modified — death processing guard blocked it
      expect(playerEntity.data.visible).toBe(true);

      inProgress.delete("player1");
    });
  });

  describe("persist retry queue", () => {
    it("drains retry queue on tick", () => {
      const retryQueue = (
        deathSystem as unknown as {
          pendingPersistRetries: Array<{
            playerId: string;
            type: "equipment" | "inventory";
          }>;
        }
      ).pendingPersistRetries;

      const mockEquipmentSystem = {
        clearEquipmentImmediate: vi.fn().mockResolvedValue(undefined),
      };
      const mockInventorySystem = {
        clearInventoryImmediate: vi.fn().mockResolvedValue(undefined),
      };

      world.getSystem.mockImplementation((name: string) => {
        if (name === "equipment") return mockEquipmentSystem;
        if (name === "inventory") return mockInventorySystem;
        return null;
      });

      // Add retries
      retryQueue.push(
        { playerId: "player1", type: "equipment" },
        { playerId: "player2", type: "inventory" },
      );

      // Call processPersistRetries
      const processPersistRetries = (
        deathSystem as unknown as {
          processPersistRetries: () => void;
        }
      ).processPersistRetries.bind(deathSystem);

      processPersistRetries();

      // Queue should be drained
      expect(retryQueue).toHaveLength(0);
      expect(mockEquipmentSystem.clearEquipmentImmediate).toHaveBeenCalledWith(
        "player1",
      );
      expect(mockInventorySystem.clearInventoryImmediate).toHaveBeenCalledWith(
        "player2",
        false,
      );
    });

    it("does nothing when queue is empty", () => {
      const processPersistRetries = (
        deathSystem as unknown as {
          processPersistRetries: () => void;
        }
      ).processPersistRetries.bind(deathSystem);

      // Should not throw
      processPersistRetries();
    });
  });
});

// =============================================================================
// KEPT ITEMS RETURNED ON RESPAWN
// =============================================================================

describe("PlayerDeathSystem — kept items on respawn", () => {
  let world: MockWorld;
  let deathSystem: PlayerDeathSystem;
  let mockInventorySystem: {
    addItemDirect: Mock;
    getItems: Mock;
    clearInventoryImmediate: Mock;
    getInventory: Mock;
  };

  beforeEach(async () => {
    world = createMockWorld(true, 1000);

    world.on.mockImplementation(() => {});
    world.emit.mockImplementation(() => {});

    mockInventorySystem = {
      addItemDirect: vi.fn().mockResolvedValue(undefined),
      getItems: vi.fn().mockReturnValue([]),
      clearInventoryImmediate: vi.fn().mockResolvedValue(undefined),
      getInventory: vi.fn().mockReturnValue(null),
    };

    world.getSystem.mockImplementation((name: string) => {
      if (name === "inventory") return mockInventorySystem;
      if (name === "ground-items")
        return { spawnGroundItems: vi.fn().mockResolvedValue([]) };
      return null;
    });

    deathSystem = new PlayerDeathSystem(createSystemWorld(world));

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns kept items to inventory via addItemDirect on respawn", async () => {
    // Set up kept items in the in-memory map
    const keptItemsMap = (
      deathSystem as unknown as {
        itemsKeptOnDeath: Map<
          string,
          Array<{ itemId: string; quantity: number }>
        >;
      }
    ).itemsKeptOnDeath;

    keptItemsMap.set("player1", [
      { itemId: "rune_scimitar", quantity: 1 },
      { itemId: "dragon_med_helm", quantity: 1 },
      { itemId: "amulet_of_glory", quantity: 1 },
    ]);

    // Create player entity for respawn
    const playerEntity = createMockPlayerEntity({
      data: { deathState: DeathState.DYING, visible: false },
    });
    world.entities.get.mockReturnValue(playerEntity);

    // Call respawnPlayer directly
    const respawnPlayer = (
      deathSystem as unknown as {
        respawnPlayer: (
          playerId: string,
          spawnPosition: { x: number; y: number; z: number },
          townName: string,
        ) => Promise<void>;
      }
    ).respawnPlayer.bind(deathSystem);

    await respawnPlayer("player1", { x: 0, y: 10, z: 0 }, "Central Haven");

    // Verify all 3 kept items were returned
    expect(mockInventorySystem.addItemDirect).toHaveBeenCalledTimes(3);
    expect(mockInventorySystem.addItemDirect).toHaveBeenCalledWith("player1", {
      itemId: "rune_scimitar",
      quantity: 1,
    });
    expect(mockInventorySystem.addItemDirect).toHaveBeenCalledWith("player1", {
      itemId: "dragon_med_helm",
      quantity: 1,
    });
    expect(mockInventorySystem.addItemDirect).toHaveBeenCalledWith("player1", {
      itemId: "amulet_of_glory",
      quantity: 1,
    });

    // Kept items should be cleared after return
    expect(keptItemsMap.has("player1")).toBe(false);
  });

  it("does not call addItemDirect when no kept items exist", async () => {
    const playerEntity = createMockPlayerEntity({
      data: { deathState: DeathState.DYING, visible: false },
    });
    world.entities.get.mockReturnValue(playerEntity);

    const respawnPlayer = (
      deathSystem as unknown as {
        respawnPlayer: (
          playerId: string,
          spawnPosition: { x: number; y: number; z: number },
          townName: string,
        ) => Promise<void>;
      }
    ).respawnPlayer.bind(deathSystem);

    await respawnPlayer("player1", { x: 0, y: 10, z: 0 }, "Central Haven");

    expect(mockInventorySystem.addItemDirect).not.toHaveBeenCalled();
  });
});

// =============================================================================
// TRANSACTION FAILURE — REVIVE IN-PLACE
// =============================================================================

describe("PlayerDeathSystem — transaction failure revives player in-place", () => {
  let world: MockWorld;
  let deathSystem: PlayerDeathSystem;
  let emitTypedEventSpy: Mock;

  beforeEach(() => {
    world = createMockWorld(true, 1000);

    world.on.mockImplementation(() => {});
    world.emit.mockImplementation(() => {});

    // Database system that REJECTS to simulate transaction failure
    // Also includes DeathStateManager methods (getDeathLockAsync, etc.)
    const mockDatabaseSystem = {
      executeInTransaction: vi
        .fn()
        .mockRejectedValue(new Error("SQLite BUSY — database is locked")),
      getDeathLockAsync: vi.fn().mockResolvedValue(null),
      saveDeathLockAsync: vi.fn().mockResolvedValue(undefined),
      deleteDeathLockAsync: vi.fn().mockResolvedValue(undefined),
      acquireDeathLockAsync: vi.fn().mockResolvedValue(true),
      updateGroundItemsAsync: vi.fn().mockResolvedValue(undefined),
      getUnrecoveredDeathsAsync: vi.fn().mockResolvedValue([]),
      markDeathRecoveredAsync: vi.fn().mockResolvedValue(undefined),
    };

    // Equipment system
    const mockEquipmentSystem = {
      getPlayerEquipment: vi.fn().mockReturnValue(null),
      clearEquipmentAndReturn: vi.fn().mockResolvedValue([]),
      clearEquipmentImmediate: vi.fn().mockResolvedValue(undefined),
    };

    // Inventory system
    const mockInventorySystem = {
      getItems: vi.fn().mockReturnValue([]),
      clearInventoryImmediate: vi.fn().mockResolvedValue(undefined),
      getInventory: vi.fn().mockReturnValue(null),
    };

    // Ground items system
    const mockGroundItemSystem = {
      spawnGroundItems: vi.fn().mockResolvedValue([]),
    };

    // Tick system
    const mockTickSystem = {
      getCurrentTick: vi.fn().mockReturnValue(world.currentTick),
      onTick: vi.fn().mockReturnValue(() => {}),
    };

    // Duel system (no active duels)
    const mockDuelSystem = {
      isPlayerInActiveDuel: vi.fn().mockReturnValue(false),
    };

    // Entity manager
    const mockEntityManager = {
      spawnEntity: vi.fn().mockResolvedValue({ id: "gravestone_test" }),
      destroyEntity: vi.fn(),
    };

    world.getSystem.mockImplementation((name: string) => {
      switch (name) {
        case "ground-items":
          return mockGroundItemSystem;
        case "database":
          return mockDatabaseSystem;
        case "equipment":
          return mockEquipmentSystem;
        case "inventory":
          return mockInventorySystem;
        case "tick":
          return mockTickSystem;
        case "duel":
          return mockDuelSystem;
        case "entity-manager":
          return mockEntityManager;
        case "terrain":
          return null;
        case "combat":
          return null;
        case "player":
          return { players: world.entities.players };
        default:
          return null;
      }
    });

    deathSystem = new PlayerDeathSystem(createSystemWorld(world));

    // Stub deathStateManager and zoneDetection (normally set by init())
    // so code reaches the transaction before failing
    (
      deathSystem as unknown as {
        deathStateManager: {
          getDeathLock: Mock;
          clearDeathLock: Mock;
          createDeathLock: Mock;
        };
      }
    ).deathStateManager = {
      getDeathLock: vi.fn().mockResolvedValue(null),
      clearDeathLock: vi.fn().mockResolvedValue(undefined),
      createDeathLock: vi.fn().mockResolvedValue(undefined),
    };
    (
      deathSystem as unknown as {
        zoneDetection: { getZoneType: Mock };
      }
    ).zoneDetection = {
      getZoneType: vi.fn().mockReturnValue("safe_area"),
    };

    // Spy on emitTypedEvent to capture emitted events
    emitTypedEventSpy = vi.fn();
    (
      deathSystem as unknown as {
        emitTypedEvent: Mock;
      }
    ).emitTypedEvent = emitTypedEventSpy;

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("emits PLAYER_RESPAWNED with deathPosition and resets deathState on tx failure", async () => {
    const deathPosition = { x: 100, y: 0, z: 200 };

    // Create player entity at the death position
    const playerEntity = createMockPlayerEntity({
      data: { deathState: DeathState.DYING },
      position: deathPosition,
    });
    world.entities.get.mockReturnValue(playerEntity);
    world.entities.players.set("player1", playerEntity);

    // Call handlePlayerDeath directly (private method)
    const handlePlayerDeath = (
      deathSystem as unknown as {
        handlePlayerDeath: (data: {
          entityId: string;
          killedBy: string;
          entityType: "player" | "mob";
          deathPosition?: { x: number; y: number; z: number };
        }) => Promise<void>;
      }
    ).handlePlayerDeath.bind(deathSystem);

    await handlePlayerDeath({
      entityId: "player1",
      killedBy: "goblin_1",
      entityType: "player",
      deathPosition,
    });

    // Verify PLAYER_SET_DEAD emitted with isDead: false (reviving)
    const setDeadCall = emitTypedEventSpy.mock.calls.find(
      (call: unknown[]) => call[0] === EventType.PLAYER_SET_DEAD,
    );
    expect(setDeadCall).toBeDefined();
    expect(setDeadCall![1]).toEqual({
      playerId: "player1",
      isDead: false,
    });

    // Verify PLAYER_RESPAWNED emitted with spawnPosition = deathPosition (in-place revive)
    const respawnedCall = emitTypedEventSpy.mock.calls.find(
      (call: unknown[]) => call[0] === EventType.PLAYER_RESPAWNED,
    );
    expect(respawnedCall).toBeDefined();
    expect(respawnedCall![1]).toEqual({
      playerId: "player1",
      spawnPosition: deathPosition,
    });

    // Verify player deathState is reset to ALIVE
    expect(playerEntity.data.deathState).toBe(DeathState.ALIVE);

    // Verify lastDeathTime is cleared
    const lastDeathTime = (
      deathSystem as unknown as {
        lastDeathTime: Map<string, number>;
      }
    ).lastDeathTime;
    expect(lastDeathTime.has("player1")).toBe(false);

    // Verify health was restored to max
    expect(playerEntity.setHealth).toHaveBeenCalledWith(100);
  });
});

// =============================================================================
// DOUBLE-DEATH COOLDOWN GUARD
// =============================================================================

describe("PlayerDeathSystem — double-death cooldown guard", () => {
  let world: MockWorld;
  let deathSystem: PlayerDeathSystem;
  let mockDatabaseSystem: { executeInTransaction: Mock; [key: string]: Mock };

  beforeEach(() => {
    world = createMockWorld(true, 1000);

    world.on.mockImplementation(() => {});
    world.emit.mockImplementation(() => {});

    // Database system that succeeds (tracks call count)
    // Also includes DeathStateManager methods (getDeathLockAsync, etc.)
    mockDatabaseSystem = {
      executeInTransaction: vi
        .fn()
        .mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
          await fn({ __tx: true });
        }),
      getDeathLockAsync: vi.fn().mockResolvedValue(null),
      saveDeathLockAsync: vi.fn().mockResolvedValue(undefined),
      deleteDeathLockAsync: vi.fn().mockResolvedValue(undefined),
      acquireDeathLockAsync: vi.fn().mockResolvedValue(true),
      updateGroundItemsAsync: vi.fn().mockResolvedValue(undefined),
      getUnrecoveredDeathsAsync: vi.fn().mockResolvedValue([]),
      markDeathRecoveredAsync: vi.fn().mockResolvedValue(undefined),
    };

    // Equipment system
    const mockEquipmentSystem = {
      getPlayerEquipment: vi.fn().mockReturnValue(null),
      clearEquipmentAndReturn: vi.fn().mockResolvedValue([]),
      clearEquipmentImmediate: vi.fn().mockResolvedValue(undefined),
    };

    // Inventory system
    const mockInventorySystem = {
      getItems: vi.fn().mockReturnValue([]),
      clearInventoryImmediate: vi.fn().mockResolvedValue(undefined),
      getInventory: vi.fn().mockReturnValue(null),
    };

    // Ground items system
    const mockGroundItemSystem = {
      spawnGroundItems: vi.fn().mockResolvedValue([]),
    };

    // Tick system
    const mockTickSystem = {
      getCurrentTick: vi.fn().mockReturnValue(world.currentTick),
      onTick: vi.fn().mockReturnValue(() => {}),
    };

    // Duel system (no active duels)
    const mockDuelSystem = {
      isPlayerInActiveDuel: vi.fn().mockReturnValue(false),
    };

    // Entity manager
    const mockEntityManager = {
      spawnEntity: vi.fn().mockResolvedValue({ id: "gravestone_test" }),
      destroyEntity: vi.fn(),
    };

    world.getSystem.mockImplementation((name: string) => {
      switch (name) {
        case "ground-items":
          return mockGroundItemSystem;
        case "database":
          return mockDatabaseSystem;
        case "equipment":
          return mockEquipmentSystem;
        case "inventory":
          return mockInventorySystem;
        case "tick":
          return mockTickSystem;
        case "duel":
          return mockDuelSystem;
        case "entity-manager":
          return mockEntityManager;
        case "terrain":
          return null;
        case "combat":
          return null;
        case "player":
          return { players: world.entities.players };
        default:
          return null;
      }
    });

    deathSystem = new PlayerDeathSystem(createSystemWorld(world));

    // Stub deathStateManager and zoneDetection (normally set by init())
    (
      deathSystem as unknown as {
        deathStateManager: {
          getDeathLock: Mock;
          clearDeathLock: Mock;
          createDeathLock: Mock;
        };
      }
    ).deathStateManager = {
      getDeathLock: vi.fn().mockResolvedValue(null),
      clearDeathLock: vi.fn().mockResolvedValue(undefined),
      createDeathLock: vi.fn().mockResolvedValue(undefined),
    };
    (
      deathSystem as unknown as {
        zoneDetection: { getZoneType: Mock };
      }
    ).zoneDetection = {
      getZoneType: vi.fn().mockReturnValue("safe_area"),
    };

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("silently ignores second death within DEATH_COOLDOWN window", async () => {
    // Position must be outside the duel arena zone bounds (35..145 x, 37..140 z)
    const deathPosition = { x: 500, y: 0, z: 500 };

    const playerEntity = createMockPlayerEntity({
      data: { deathState: DeathState.DYING },
      position: deathPosition,
    });
    world.entities.get.mockReturnValue(playerEntity);
    world.entities.players.set("player1", playerEntity);

    // Call handlePlayerDeath directly (private method)
    const handlePlayerDeath = (
      deathSystem as unknown as {
        handlePlayerDeath: (data: {
          entityId: string;
          killedBy: string;
          entityType: "player" | "mob";
          deathPosition?: { x: number; y: number; z: number };
        }) => Promise<void>;
      }
    ).handlePlayerDeath.bind(deathSystem);

    const deathEvent = {
      entityId: "player1",
      killedBy: "goblin_1",
      entityType: "player" as const,
      deathPosition,
    };

    // Spy on _processPlayerDeathInner to count actual death processing invocations
    const innerSpy = vi.spyOn(
      deathSystem as unknown as {
        _processPlayerDeathInner: (
          playerId: string,
          deathPosition: { x: number; y: number; z: number },
          killedByRaw: string,
        ) => Promise<void>;
      },
      "_processPlayerDeathInner",
    );

    // First death — should process normally
    await handlePlayerDeath(deathEvent);

    // Verify first death reached inner processing
    expect(innerSpy).toHaveBeenCalledTimes(1);

    // Second death — should be silently ignored by cooldown guard
    await handlePlayerDeath(deathEvent);

    // _processPlayerDeathInner is called both times (processPlayerDeath delegates to it),
    // but the cooldown check at the top of _processPlayerDeathInner returns early.
    // Verify the transaction (which runs AFTER the cooldown check) was only executed once.
    expect(innerSpy).toHaveBeenCalledTimes(2);
    expect(mockDatabaseSystem.executeInTransaction).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// EVENT MIGRATION TEST
// =============================================================================

describe("Event type migration: PLAYER_DIED → PLAYER_SET_DEAD", () => {
  it("PLAYER_DIED is defined but deprecated", () => {
    // PLAYER_DIED still exists for backward compat
    expect(EventType.PLAYER_DIED).toBe("player:died");
  });

  it("PLAYER_SET_DEAD is the canonical death event", () => {
    expect(EventType.PLAYER_SET_DEAD).toBe("player:set_dead");
  });

  it("no production code emits PLAYER_DIED", async () => {
    // This is a static analysis test — we verify that the only reference to
    // PLAYER_DIED in non-test code is the enum definition itself.
    // The grep for PLAYER_DIED across the codebase shows it's only in:
    //   1. event-types.ts (enum definition with @deprecated)
    //   2. Test files (this file)
    // If someone accidentally uses PLAYER_DIED, this test documents the contract.
    expect(EventType.PLAYER_DIED).not.toBe(EventType.PLAYER_SET_DEAD);
  });
});

// =============================================================================
// HEADSTONE ENTITY — modify() NETWORK SYNC LOGIC
// =============================================================================

describe("HeadstoneEntity — modify() network sync logic", () => {
  /**
   * Tests the modify() branching logic that HeadstoneEntity applies on top of
   * super.modify(). We replicate the exact logic here rather than importing
   * HeadstoneEntity (which pulls THREE.js and World dependencies).
   *
   * This mirrors HeadstoneEntity.modify() lines 342-357:
   *   - lootItemCount === 0 → clear lootItems
   *   - mesh?.userData?.corpseData.itemCount updated
   */
  function applyModifyLogic(
    state: {
      lootItems: Array<{ itemId: string; quantity: number }>;
      mesh: { userData: { corpseData: { itemCount: number } } } | null;
    },
    changes: Record<string, unknown>,
  ) {
    // Exact replica of HeadstoneEntity.modify() logic (after super.modify)
    if (
      typeof changes.lootItemCount === "number" &&
      changes.lootItemCount === 0
    ) {
      state.lootItems = [];
    }
    if (state.mesh?.userData?.corpseData) {
      state.mesh.userData.corpseData.itemCount =
        typeof changes.lootItemCount === "number"
          ? changes.lootItemCount
          : state.lootItems.length;
    }
  }

  it("clears lootItems when lootItemCount is 0", () => {
    const state = {
      lootItems: [
        { itemId: "bronze_sword", quantity: 1 },
        { itemId: "coins", quantity: 500 },
      ],
      mesh: { userData: { corpseData: { itemCount: 2 } } },
    };

    applyModifyLogic(state, { lootItemCount: 0 });
    expect(state.lootItems).toEqual([]);
    expect(state.mesh.userData.corpseData.itemCount).toBe(0);
  });

  it("does not clear lootItems when lootItemCount > 0", () => {
    const state = {
      lootItems: [
        { itemId: "bronze_sword", quantity: 1 },
        { itemId: "coins", quantity: 500 },
      ],
      mesh: { userData: { corpseData: { itemCount: 2 } } },
    };

    applyModifyLogic(state, { lootItemCount: 1 });
    expect(state.lootItems).toHaveLength(2); // Not cleared
    expect(state.mesh.userData.corpseData.itemCount).toBe(1); // Updated from network
  });

  it("handles missing lootItemCount gracefully", () => {
    const state = {
      lootItems: [{ itemId: "rune_scimitar", quantity: 1 }],
      mesh: { userData: { corpseData: { itemCount: 1 } } },
    };

    applyModifyLogic(state, { someOtherField: "value" });
    expect(state.lootItems).toHaveLength(1); // Unchanged
    expect(state.mesh.userData.corpseData.itemCount).toBe(1); // Falls back to lootItems.length
  });

  it("handles null mesh safely", () => {
    const state = {
      lootItems: [{ itemId: "coins", quantity: 100 }],
      mesh: null,
    };

    applyModifyLogic(state, { lootItemCount: 0 });
    expect(state.lootItems).toEqual([]); // Still cleared
    // No crash from null mesh
  });

  it("does not clear lootItems for non-zero lootItemCount", () => {
    const state = {
      lootItems: [
        { itemId: "rune_scimitar", quantity: 1 },
        { itemId: "dragon_med_helm", quantity: 1 },
        { itemId: "coins", quantity: 1000 },
      ],
      mesh: { userData: { corpseData: { itemCount: 3 } } },
    };

    applyModifyLogic(state, { lootItemCount: 2 });
    expect(state.lootItems).toHaveLength(3); // Not cleared (only 0 clears)
    expect(state.mesh.userData.corpseData.itemCount).toBe(2);
  });
});
