/**
 * Home Teleport Manager Comprehensive Tests
 *
 * Tests the REAL HomeTeleportManager implementation.
 * Uses minimal mocking - only external dependencies are mocked.
 *
 * Covers:
 * - Happy path flows
 * - Boundary conditions and edge cases
 * - Error handling and invalid inputs
 * - Concurrent/multi-player behavior
 * - Terrain system edge cases
 * - Exact data verification
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { HOME_TELEPORT_CONSTANTS, EventType, Emotes } from "@hyperforge/shared";
import {
  initHomeTeleportManager,
  getHomeTeleportManager,
  handleHomeTeleport,
  handleHomeTeleportCancel,
  formatCooldownRemaining,
} from "../../../src/systems/ServerNetwork/handlers/home-teleport";

// ============================================================================
// Mock Types (minimal - only what's needed for external interfaces)
// ============================================================================

interface MockSocket {
  id?: string;
  player?: MockPlayer;
  send: ReturnType<typeof vi.fn>;
}

interface MockPlayer {
  id: string;
  data: {
    properties?: {
      healthComponent?: {
        isDead?: boolean;
      };
    };
    position?: number[];
  };
  position: {
    x: number;
    y: number;
    z: number;
    set: ReturnType<typeof vi.fn>;
  };
}

interface MockCombatStateService {
  isInCombat: ReturnType<typeof vi.fn>;
}

interface MockWorld {
  getSystem: ReturnType<typeof vi.fn>;
  entities: Map<string, MockPlayer>;
  emit: ReturnType<typeof vi.fn>;
}

interface SpawnData {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

// ============================================================================
// Helper Functions
// ============================================================================

function createMockPlayer(
  id: string,
  overrides: Partial<MockPlayer> = {},
): MockPlayer {
  return {
    id,
    data: {
      properties: { healthComponent: { isDead: false } },
      position: [100, 50, 100],
    },
    position: { x: 100, y: 50, z: 100, set: vi.fn() },
    ...overrides,
  };
}

function createMockSocket(player?: MockPlayer, id?: string): MockSocket {
  return {
    id: id ?? `socket-${player?.id ?? "unknown"}`,
    player,
    send: vi.fn(),
  };
}

// ============================================================================
// Test Suite - Tests the REAL HomeTeleportManager
// ============================================================================

describe("Home Teleport Manager", () => {
  let mockWorld: MockWorld;
  let mockSocket: MockSocket;
  let mockPlayer: MockPlayer;
  let mockSendFn: ReturnType<typeof vi.fn>;
  let mockCombatService: MockCombatStateService;
  let mockTerrainGetHeight: ReturnType<typeof vi.fn>;
  const spawnPoint: SpawnData = {
    position: [0, 50, 0],
    quaternion: [0, 0, 0, 1],
  };

  // Base time for tests
  let currentTime = new Date("2025-01-15T12:00:00Z").getTime();

  beforeEach(() => {
    // Mock Date.now() to return controlled time
    currentTime = new Date("2025-01-15T12:00:00Z").getTime();
    vi.spyOn(Date, "now").mockImplementation(() => currentTime);

    mockCombatService = { isInCombat: vi.fn().mockReturnValue(false) };
    mockTerrainGetHeight = vi.fn().mockReturnValue(50);
    mockPlayer = createMockPlayer("player-123");
    mockSocket = createMockSocket(mockPlayer);

    mockWorld = {
      getSystem: vi.fn((name: string) => {
        if (name === "combat") return { stateService: mockCombatService };
        if (name === "terrain") return { getHeightAt: mockTerrainGetHeight };
        return null;
      }),
      entities: new Map([[mockPlayer.id, mockPlayer]]),
      emit: vi.fn(),
    };

    mockSendFn = vi.fn();

    // Initialize the REAL HomeTeleportManager
    initHomeTeleportManager(mockWorld as never, spawnPoint, mockSendFn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to get the real manager
  function getManager() {
    const manager = getHomeTeleportManager();
    if (!manager) throw new Error("Manager not initialized");
    return manager;
  }

  // ==========================================================================
  // BASIC CASTING (Happy Path)
  // ==========================================================================

  describe("Basic Casting", () => {
    it("starts casting successfully with correct packet data", () => {
      const manager = getManager();
      const error = manager.startCasting(mockSocket as never, 0);

      expect(error).toBeNull();
      expect(manager.isCasting(mockPlayer.id)).toBe(true);
      expect(mockSocket.send).toHaveBeenCalledTimes(1);
      expect(mockSocket.send).toHaveBeenCalledWith("homeTeleportStart", {
        castTimeMs: 10000, // Verify exact value
      });
    });

    it("emits cast start event with correct payload", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 100);

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.HOME_TELEPORT_CAST_START,
        {
          playerId: "player-123",
          castTimeMs: 10000,
        },
      );
    });

    it("does not broadcast a cast emote on teleport start", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);

      expect(mockSendFn).not.toHaveBeenCalledWith(
        "entityModified",
        { id: "player-123", changes: { emote: Emotes.SQUAT } },
        mockSocket.id,
      );
    });

    it("returns specific error when casting twice", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      const error = manager.startCasting(mockSocket as never, 1);
      expect(error).toBe("Already casting home teleport");
    });
  });

  // ==========================================================================
  // INVALID INPUTS & ERROR HANDLING
  // ==========================================================================

  describe("Invalid Inputs", () => {
    it("handles socket without player", () => {
      const manager = getManager();
      const emptySocket = createMockSocket(undefined);
      const error = manager.startCasting(emptySocket as never, 0);

      expect(error).toBe("Player not found");
      expect(emptySocket.send).not.toHaveBeenCalled();
    });

    it("handles player with empty data object", () => {
      const manager = getManager();
      const playerWithEmptyData = createMockPlayer("empty-data", {
        data: {} as MockPlayer["data"],
      });
      const socket = createMockSocket(playerWithEmptyData);
      mockWorld.entities.set(playerWithEmptyData.id, playerWithEmptyData);

      const error = manager.startCasting(socket as never, 0);
      expect(error).toBeNull(); // Should work - no healthComponent means not dead
    });

    it("handles player with null properties", () => {
      const manager = getManager();
      const playerWithNull = createMockPlayer("null-props", {
        data: { properties: undefined },
      });
      const socket = createMockSocket(playerWithNull);
      mockWorld.entities.set(playerWithNull.id, playerWithNull);

      const error = manager.startCasting(socket as never, 0);
      expect(error).toBeNull();
    });

    it("handles undefined healthComponent", () => {
      const manager = getManager();
      const playerNoHealth = createMockPlayer("no-health", {
        data: { properties: {} },
      });
      const socket = createMockSocket(playerNoHealth);
      mockWorld.entities.set(playerNoHealth.id, playerNoHealth);

      const error = manager.startCasting(socket as never, 0);
      expect(error).toBeNull();
    });

    it("handles non-existent player in cancelCasting gracefully", () => {
      const manager = getManager();
      // Should not throw
      expect(() =>
        manager.cancelCasting("non-existent-player", "test"),
      ).not.toThrow();
      expect(mockWorld.emit).not.toHaveBeenCalled();
    });

    it("handles onPlayerMove for non-casting player", () => {
      const manager = getManager();
      expect(() => manager.onPlayerMove("non-existent")).not.toThrow();
      expect(manager.isCasting("non-existent")).toBe(false);
    });
  });

  // ==========================================================================
  // COMBAT BLOCKING
  // ==========================================================================

  describe("Combat Blocking", () => {
    it("blocks casting when in combat", () => {
      const manager = getManager();
      mockCombatService.isInCombat.mockReturnValue(true);
      const error = manager.startCasting(mockSocket as never, 0);

      expect(error).toBe("You can't teleport during combat!");
      expect(manager.isCasting(mockPlayer.id)).toBe(false);
      expect(mockSocket.send).not.toHaveBeenCalled();
    });

    it("cancels cast when entering combat mid-cast", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      mockCombatService.isInCombat.mockReturnValue(true);

      manager.processTick(5, () => mockSocket as never);

      expect(manager.isCasting(mockPlayer.id)).toBe(false);
      expect(mockSocket.send).toHaveBeenCalledWith("homeTeleportFailed", {
        reason: "Interrupted by combat",
      });
    });

    it("handles null combat system gracefully", () => {
      const manager = getManager();
      mockWorld.getSystem = vi.fn().mockReturnValue(null);
      const error = manager.startCasting(mockSocket as never, 0);

      expect(error).toBeNull(); // No combat system = not in combat
    });

    it("handles combat system without stateService", () => {
      const manager = getManager();
      mockWorld.getSystem = vi.fn((name) => {
        if (name === "combat") return {}; // No stateService
        return null;
      });

      const error = manager.startCasting(mockSocket as never, 0);
      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // DEATH BLOCKING
  // ==========================================================================

  describe("Death Blocking", () => {
    it("blocks casting when dead", () => {
      const manager = getManager();
      mockPlayer.data.properties!.healthComponent!.isDead = true;
      const error = manager.startCasting(mockSocket as never, 0);

      expect(error).toBe("You can't teleport while dead!");
    });

    it("allows casting when isDead is false", () => {
      const manager = getManager();
      mockPlayer.data.properties!.healthComponent!.isDead = false;
      const error = manager.startCasting(mockSocket as never, 0);
      expect(error).toBeNull();
    });

    it("allows casting when isDead is undefined", () => {
      const manager = getManager();
      mockPlayer.data.properties!.healthComponent = {};
      const error = manager.startCasting(mockSocket as never, 0);
      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // COOLDOWN SYSTEM (Tested via actual teleport completion)
  // ==========================================================================

  describe("Cooldown System", () => {
    const COOLDOWN_MS = HOME_TELEPORT_CONSTANTS.COOLDOWN_MS;
    const CAST_TICKS = HOME_TELEPORT_CONSTANTS.CAST_TIME_TICKS;

    it("returns false for player with no cooldown", () => {
      const manager = getManager();
      expect(manager.isOnCooldown("new-player")).toBe(false);
      expect(manager.getCooldownRemaining("new-player")).toBe(0);
    });

    it("cooldown activates after successful teleport", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(manager.isOnCooldown(mockPlayer.id)).toBe(true);
    });

    it("blocks casting while on cooldown", () => {
      const manager = getManager();
      // Complete first teleport
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      // Try to cast again immediately
      const error = manager.startCasting(mockSocket as never, CAST_TICKS + 1);
      expect(error).toContain("cooldown");
    });

    it("handleHomeTeleport sends remainingMs when blocked by cooldown", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      mockSocket.send.mockClear();

      handleHomeTeleport(mockSocket as never, {}, mockWorld as never, 999);

      expect(mockSocket.send).toHaveBeenCalledWith(
        "homeTeleportFailed",
        expect.objectContaining({
          reason: expect.stringContaining("cooldown"),
          remainingMs: expect.any(Number),
        }),
      );
    });

    it("cooldown expires after 30 seconds", () => {
      const manager = getManager();
      // Complete first teleport
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      // Advance time past cooldown by updating the mocked Date.now
      currentTime += COOLDOWN_MS + 1;

      expect(manager.isOnCooldown(mockPlayer.id)).toBe(false);
      const error = manager.startCasting(mockSocket as never, 1000);
      expect(error).toBeNull();
    });

    it("cooldown remaining decreases over time", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      const initialRemaining = manager.getCooldownRemaining(mockPlayer.id);
      expect(initialRemaining).toBeGreaterThan(COOLDOWN_MS - 1000);

      // Advance time by updating currentTime (used by mocked Date.now)
      currentTime += COOLDOWN_MS / 2;
      const afterHalf = manager.getCooldownRemaining(mockPlayer.id);
      expect(afterHalf).toBeLessThan(initialRemaining);
      expect(afterHalf).toBeGreaterThan(0); // Still some remaining
    });
  });

  // ==========================================================================
  // MOVEMENT INTERRUPTION
  // ==========================================================================

  describe("Movement Interruption", () => {
    it("cancels cast with correct reason", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.onPlayerMove(mockPlayer.id);

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.HOME_TELEPORT_CAST_CANCEL,
        {
          playerId: mockPlayer.id,
          reason: "Player moved",
        },
      );
    });

    it("resets emote to idle on cancel", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.onPlayerMove(mockPlayer.id);

      expect(mockSendFn).toHaveBeenLastCalledWith("entityModified", {
        id: mockPlayer.id,
        changes: { emote: Emotes.IDLE },
      });
    });

    it("does not emit events when canceling non-casting player", () => {
      const manager = getManager();
      mockWorld.emit.mockClear();
      manager.onPlayerMove("non-caster");
      expect(mockWorld.emit).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CAST COMPLETION (Tick Boundary)
  // ==========================================================================

  describe("Cast Completion", () => {
    const CAST_TICKS = HOME_TELEPORT_CONSTANTS.CAST_TIME_TICKS;

    it("does not complete at tick before endTick", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS - 1, () => mockSocket as never);
      expect(manager.isCasting(mockPlayer.id)).toBe(true);
    });

    it("completes exactly at endTick", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);
      expect(manager.isCasting(mockPlayer.id)).toBe(false);
    });

    it("completes if tick overshoots endTick", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS + 100, () => mockSocket as never);
      expect(manager.isCasting(mockPlayer.id)).toBe(false);
    });

    it("verifies exact teleport coordinates", () => {
      const manager = getManager();
      mockTerrainGetHeight.mockReturnValue(75.5);
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.position.set).toHaveBeenCalledWith(0, 75.6, 0);
    });

    it("sends playerTeleport with exact position array", () => {
      const manager = getManager();
      mockTerrainGetHeight.mockReturnValue(100);
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockSocket.send).toHaveBeenCalledWith("playerTeleport", {
        playerId: mockPlayer.id,
        position: [0, 100.1, 0],
      });
    });

    it("broadcasts entityModified with position and emote", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockSendFn).toHaveBeenCalledWith("entityModified", {
        id: mockPlayer.id,
        changes: { p: [0, 50.1, 0], emote: Emotes.IDLE },
      });
    });

    it("emits completion event with position object", () => {
      const manager = getManager();
      mockTerrainGetHeight.mockReturnValue(25);
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.HOME_TELEPORT_COMPLETE,
        {
          playerId: mockPlayer.id,
          position: { x: 0, y: 25.1, z: 0 },
        },
      );
    });

    it("handles missing socket during completion", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => undefined);

      expect(manager.isCasting(mockPlayer.id)).toBe(false);
      expect(manager.isOnCooldown(mockPlayer.id)).toBe(true);
    });

    it("handles player entity missing during completion", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      mockWorld.entities.delete(mockPlayer.id);

      expect(() =>
        manager.processTick(CAST_TICKS, () => mockSocket as never),
      ).not.toThrow();
      expect(manager.isCasting(mockPlayer.id)).toBe(false);
    });

    it("updates player.data.position array if present", () => {
      const manager = getManager();
      mockPlayer.data.position = [999, 999, 999];
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.data.position).toEqual([0, 50.1, 0]);
    });
  });

  // ==========================================================================
  // TERRAIN SYSTEM EDGE CASES
  // ==========================================================================

  describe("Terrain System", () => {
    const CAST_TICKS = HOME_TELEPORT_CONSTANTS.CAST_TIME_TICKS;

    it("uses terrain height when available", () => {
      const manager = getManager();
      mockTerrainGetHeight.mockReturnValue(200);
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.position.set).toHaveBeenCalledWith(0, 200.1, 0);
    });

    it("falls back to spawn height when terrain returns NaN", () => {
      const manager = getManager();
      mockTerrainGetHeight.mockReturnValue(NaN);
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.position.set).toHaveBeenCalledWith(0, 50, 0);
    });

    it("falls back to spawn height when terrain returns Infinity", () => {
      const manager = getManager();
      mockTerrainGetHeight.mockReturnValue(Infinity);
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.position.set).toHaveBeenCalledWith(0, 50, 0);
    });

    it("falls back to spawn height when terrain returns null", () => {
      const manager = getManager();
      mockTerrainGetHeight.mockReturnValue(null);
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.position.set).toHaveBeenCalledWith(0, 50, 0);
    });

    it("falls back to spawn height when terrain system unavailable", () => {
      const manager = getManager();
      mockWorld.getSystem = vi.fn().mockReturnValue(null);
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.position.set).toHaveBeenCalledWith(0, 50, 0);
    });

    it("handles negative terrain height", () => {
      const manager = getManager();
      mockTerrainGetHeight.mockReturnValue(-10);
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.position.set).toHaveBeenCalledWith(0, -9.9, 0);
    });

    it("handles zero terrain height", () => {
      const manager = getManager();
      mockTerrainGetHeight.mockReturnValue(0);
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.position.set).toHaveBeenCalledWith(0, 0.1, 0);
    });
  });

  // ==========================================================================
  // SPAWN POINT CHANGES
  // ==========================================================================

  describe("Spawn Point Changes", () => {
    const CAST_TICKS = HOME_TELEPORT_CONSTANTS.CAST_TIME_TICKS;

    it("uses new spawn point after setSpawnPoint", () => {
      const manager = getManager();
      const newSpawn: SpawnData = {
        position: [500, 100, 500],
        quaternion: [0, 0, 0, 1],
      };
      manager.setSpawnPoint(newSpawn);
      mockTerrainGetHeight.mockReturnValue(100);

      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.position.set).toHaveBeenCalledWith(500, 100.1, 500);
    });

    it("cast in progress uses spawn point at cast start", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);

      const newSpawn: SpawnData = {
        position: [999, 999, 999],
        quaternion: [0, 0, 0, 1],
      };
      manager.setSpawnPoint(newSpawn);

      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(mockPlayer.position.set).toHaveBeenCalledWith(0, 50.1, 0);
    });
  });

  // ==========================================================================
  // CONCURRENT PLAYERS
  // ==========================================================================

  describe("Concurrent Players", () => {
    let player2: MockPlayer;
    let socket2: MockSocket;
    let player3: MockPlayer;
    let socket3: MockSocket;
    const CAST_TICKS = HOME_TELEPORT_CONSTANTS.CAST_TIME_TICKS;

    beforeEach(() => {
      player2 = createMockPlayer("player-456");
      socket2 = createMockSocket(player2);
      mockWorld.entities.set(player2.id, player2);

      player3 = createMockPlayer("player-789");
      socket3 = createMockSocket(player3);
      mockWorld.entities.set(player3.id, player3);
    });

    it("multiple players can cast simultaneously", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.startCasting(socket2 as never, 1);
      manager.startCasting(socket3 as never, 2);

      expect(manager.isCasting(mockPlayer.id)).toBe(true);
      expect(manager.isCasting(player2.id)).toBe(true);
      expect(manager.isCasting(player3.id)).toBe(true);
    });

    it("canceling one player does not affect others", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.startCasting(socket2 as never, 0);

      manager.onPlayerMove(mockPlayer.id);

      expect(manager.isCasting(mockPlayer.id)).toBe(false);
      expect(manager.isCasting(player2.id)).toBe(true);
    });

    it("players complete at different ticks based on start time", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.startCasting(socket2 as never, 5);

      manager.processTick(
        CAST_TICKS,
        (id) => (id === mockPlayer.id ? mockSocket : socket2) as never,
      );

      expect(manager.isCasting(mockPlayer.id)).toBe(false);
      expect(manager.isCasting(player2.id)).toBe(true);

      manager.processTick(
        CAST_TICKS + 5,
        (id) => (id === mockPlayer.id ? mockSocket : socket2) as never,
      );
      expect(manager.isCasting(player2.id)).toBe(false);
    });

    it("one player entering combat does not cancel others", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.startCasting(socket2 as never, 0);

      mockCombatService.isInCombat.mockImplementation(
        (id: string) => id === mockPlayer.id,
      );

      manager.processTick(
        5,
        (id) => (id === mockPlayer.id ? mockSocket : socket2) as never,
      );

      expect(manager.isCasting(mockPlayer.id)).toBe(false);
      expect(manager.isCasting(player2.id)).toBe(true);
    });

    it("independent cooldowns per player", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      expect(manager.isOnCooldown(mockPlayer.id)).toBe(true);
      expect(manager.isOnCooldown(player2.id)).toBe(false);

      const error = manager.startCasting(socket2 as never, 100);
      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // PLAYER DISCONNECT
  // ==========================================================================

  describe("Player Disconnect", () => {
    const CAST_TICKS = HOME_TELEPORT_CONSTANTS.CAST_TIME_TICKS;

    it("cleans up casting state on disconnect", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.onPlayerDisconnect(mockPlayer.id);

      expect(manager.isCasting(mockPlayer.id)).toBe(false);
    });

    it("preserves cooldown after disconnect", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);
      manager.onPlayerDisconnect(mockPlayer.id);

      expect(manager.isOnCooldown(mockPlayer.id)).toBe(true);
    });

    it("handles disconnect of non-casting player", () => {
      const manager = getManager();
      expect(() => manager.onPlayerDisconnect("never-cast")).not.toThrow();
    });

    it("does not affect other players when one disconnects", () => {
      const manager = getManager();
      const player2 = createMockPlayer("player-456");
      const socket2 = createMockSocket(player2);
      mockWorld.entities.set(player2.id, player2);

      manager.startCasting(mockSocket as never, 0);
      manager.startCasting(socket2 as never, 0);

      manager.onPlayerDisconnect(mockPlayer.id);

      expect(manager.isCasting(mockPlayer.id)).toBe(false);
      expect(manager.isCasting(player2.id)).toBe(true);
    });
  });

  // ==========================================================================
  // CONSTANTS VALIDATION
  // ==========================================================================

  describe("Constants", () => {
    it("cooldown matches HOME_TELEPORT_CONSTANTS", () => {
      // Production value: 30 seconds
      expect(HOME_TELEPORT_CONSTANTS.COOLDOWN_MS).toBe(30 * 1000);
    });

    it("cast time is exactly 10 seconds in milliseconds", () => {
      expect(HOME_TELEPORT_CONSTANTS.CAST_TIME_MS).toBe(10000);
    });

    it("cast time ticks matches 10s / 600ms per tick", () => {
      expect(HOME_TELEPORT_CONSTANTS.CAST_TIME_TICKS).toBe(17);
    });
  });

  describe("formatCooldownRemaining", () => {
    it("rounds sub-second values up to 1s", () => {
      expect(formatCooldownRemaining(0)).toBe("1s");
      expect(formatCooldownRemaining(999)).toBe("1s");
    });

    it("formats exact minutes without seconds", () => {
      expect(formatCooldownRemaining(60_000)).toBe("1m");
    });

    it("formats minutes and seconds when needed", () => {
      expect(formatCooldownRemaining(61_000)).toBe("1m 1s");
      expect(formatCooldownRemaining(90_500)).toBe("1m 31s");
    });
  });

  // ==========================================================================
  // PACKET DATA VERIFICATION
  // ==========================================================================

  describe("Packet Data Verification", () => {
    const CAST_TICKS = HOME_TELEPORT_CONSTANTS.CAST_TIME_TICKS;

    it("homeTeleportStart contains only castTimeMs", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);

      const call = mockSocket.send.mock.calls.find(
        (c: [string, unknown]) => c[0] === "homeTeleportStart",
      );
      expect(call).toBeDefined();
      expect(call![1]).toEqual({ castTimeMs: 10000 });
      expect(Object.keys(call![1] as object)).toHaveLength(1);
    });

    it("playerTeleport contains playerId and position array", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      const call = mockSocket.send.mock.calls.find(
        (c: [string, unknown]) => c[0] === "playerTeleport",
      );
      expect(call).toBeDefined();
      const data = call![1] as { playerId: string; position: number[] };
      expect(data.playerId).toBe("player-123");
      expect(Array.isArray(data.position)).toBe(true);
      expect(data.position).toHaveLength(3);
    });

    it("homeTeleportFailed contains reason string", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      mockCombatService.isInCombat.mockReturnValue(true);
      manager.processTick(5, () => mockSocket as never);

      const call = mockSocket.send.mock.calls.find(
        (c: [string, unknown]) => c[0] === "homeTeleportFailed",
      );
      expect(call).toBeDefined();
      expect(call![1]).toEqual({ reason: "Interrupted by combat" });
    });
  });

  // ==========================================================================
  // EVENT EMISSION VERIFICATION
  // ==========================================================================

  describe("Event Emissions", () => {
    const CAST_TICKS = HOME_TELEPORT_CONSTANTS.CAST_TIME_TICKS;

    it("emits cast_start with correct structure", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.HOME_TELEPORT_CAST_START,
        {
          playerId: "player-123",
          castTimeMs: 10000,
        },
      );
    });

    it("emits cast_cancel with reason", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.cancelCasting(mockPlayer.id, "Test reason");

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.HOME_TELEPORT_CAST_CANCEL,
        {
          playerId: "player-123",
          reason: "Test reason",
        },
      );
    });

    it("emits complete with position object (not array)", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);
      manager.processTick(CAST_TICKS, () => mockSocket as never);

      const completeCall = mockWorld.emit.mock.calls.find(
        (c: [string, unknown]) => c[0] === EventType.HOME_TELEPORT_COMPLETE,
      );
      expect(completeCall).toBeDefined();
      expect(completeCall![1]).toEqual({
        playerId: "player-123",
        position: { x: 0, y: 50.1, z: 0 },
      });
    });
  });

  // ==========================================================================
  // HANDLER FUNCTION TESTS
  // ==========================================================================

  describe("Handler Functions", () => {
    it("handleHomeTeleport sends failed packet on error", () => {
      mockCombatService.isInCombat.mockReturnValue(true);

      handleHomeTeleport(mockSocket as never, {}, mockWorld as never, 0);

      expect(mockSocket.send).toHaveBeenCalledWith("homeTeleportFailed", {
        reason: "You can't teleport during combat!",
      });
      expect(mockSocket.send).toHaveBeenCalledWith("showToast", {
        message: "You can't teleport during combat!",
        type: "error",
      });
    });

    it("handleHomeTeleportCancel sends toast on successful cancel", () => {
      const manager = getManager();
      manager.startCasting(mockSocket as never, 0);

      handleHomeTeleportCancel(mockSocket as never, {});

      expect(mockSocket.send).toHaveBeenCalledWith("showToast", {
        message: "Home teleport canceled",
        type: "info",
      });
    });

    it("handleHomeTeleportCancel does nothing when not casting", () => {
      mockSocket.send.mockClear();

      handleHomeTeleportCancel(mockSocket as never, {});

      expect(mockSocket.send).not.toHaveBeenCalled();
    });
  });
});
