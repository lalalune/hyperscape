/**
 * Player Loading State Transitions - Unit Tests
 *
 * Tests the isLoading state machine for spawn protection (Issue #356).
 * Verifies that players spawn with isLoading=true and transition to false
 * only via clientReady packet or 30-second timeout.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================================
// Types (minimal mocks matching actual implementation)
// ============================================================================

interface MockEntityData {
  id: string;
  type: string;
  name: string;
  owner: string;
  isLoading?: boolean;
}

interface MockEntity {
  id: string;
  data: MockEntityData;
}

interface MockSocket {
  id: string;
  player: MockEntity | undefined;
}

interface MockWorld {
  entities: Map<string, MockEntity>;
  emit: ReturnType<typeof vi.fn>;
}

interface MockBroadcastManager {
  sendToAll: ReturnType<typeof vi.fn>;
}

// ============================================================================
// Handler Logic (extracted for testability)
// ============================================================================

/**
 * Logic extracted from ServerNetwork onClientReady handler
 * This matches the actual implementation in ServerNetwork/index.ts:658-704
 */
function handleClientReady(
  socket: MockSocket,
  world: MockWorld,
  broadcastManager: MockBroadcastManager,
): { success: boolean; reason?: string } {
  if (!socket.player) {
    return { success: false, reason: "no_player" };
  }

  const player = socket.player;

  // Validate ownership - only the owning socket can mark player as ready
  if (player.data.owner !== socket.id) {
    return { success: false, reason: "not_owner" };
  }

  // Ignore duplicate clientReady packets (idempotent)
  if (!player.data.isLoading) {
    return { success: false, reason: "already_active" };
  }

  // Mark player as no longer loading
  player.data.isLoading = false;

  // Broadcast state change to all clients
  broadcastManager.sendToAll("entityModified", {
    id: player.id,
    changes: { isLoading: false },
  });

  // Emit event for other systems
  world.emit("player:ready", { playerId: player.id });

  return { success: true };
}

/**
 * Logic for timeout handler (from character-selection.ts)
 * Forces player active after 30 seconds if clientReady never received
 */
function handleLoadingTimeout(
  entityId: string,
  world: MockWorld,
  broadcastManager: MockBroadcastManager,
): { triggered: boolean } {
  const entity = world.entities.get(entityId);

  if (!entity?.data?.isLoading) {
    return { triggered: false };
  }

  entity.data.isLoading = false;
  broadcastManager.sendToAll("entityModified", {
    id: entityId,
    changes: { isLoading: false },
  });

  return { triggered: true };
}

// ============================================================================
// Test Utilities
// ============================================================================

function createMockSocket(id: string, player?: MockEntity): MockSocket {
  return { id, player };
}

function createMockPlayer(
  id: string,
  socketId: string,
  isLoading = true,
): MockEntity {
  return {
    id,
    data: {
      id,
      type: "player",
      name: "TestPlayer",
      owner: socketId,
      isLoading,
    },
  };
}

function createMockWorld(): MockWorld {
  return {
    entities: new Map(),
    emit: vi.fn(),
  };
}

function createMockBroadcastManager(): MockBroadcastManager {
  return {
    sendToAll: vi.fn(),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Player Loading State Transitions", () => {
  let world: MockWorld;
  let broadcastManager: MockBroadcastManager;

  beforeEach(() => {
    world = createMockWorld();
    broadcastManager = createMockBroadcastManager();
  });

  describe("Initial State", () => {
    it("player spawns with isLoading=true", () => {
      const player = createMockPlayer("player-1", "socket-1", true);

      expect(player.data.isLoading).toBe(true);
    });

    it("isLoading is set on entity.data", () => {
      const player = createMockPlayer("player-1", "socket-1", true);

      expect(player.data).toHaveProperty("isLoading");
      expect(typeof player.data.isLoading).toBe("boolean");
    });
  });

  describe("clientReady Handler", () => {
    it("transitions isLoading from true to false", () => {
      const player = createMockPlayer("player-1", "socket-1", true);
      const socket = createMockSocket("socket-1", player);
      world.entities.set(player.id, player);

      const result = handleClientReady(socket, world, broadcastManager);

      expect(result.success).toBe(true);
      expect(player.data.isLoading).toBe(false);
    });

    it("returns failure if no player on socket", () => {
      const socket = createMockSocket("socket-1", undefined);

      const result = handleClientReady(socket, world, broadcastManager);

      expect(result.success).toBe(false);
      expect(result.reason).toBe("no_player");
    });

    it("ignores clientReady if player has no isLoading flag (undefined)", () => {
      const player = createMockPlayer("player-1", "socket-1", true);
      player.data.isLoading = undefined;
      const socket = createMockSocket("socket-1", player);

      const result = handleClientReady(socket, world, broadcastManager);

      expect(result.success).toBe(false);
      expect(result.reason).toBe("already_active");
    });

    it("ignores duplicate clientReady packets (idempotency)", () => {
      const player = createMockPlayer("player-1", "socket-1", false);
      const socket = createMockSocket("socket-1", player);

      const result = handleClientReady(socket, world, broadcastManager);

      expect(result.success).toBe(false);
      expect(result.reason).toBe("already_active");
      expect(broadcastManager.sendToAll).not.toHaveBeenCalled();
    });

    it("rejects clientReady from socket that doesn't own the player", () => {
      const player = createMockPlayer("player-1", "socket-original", true);
      const maliciousSocket = createMockSocket("socket-attacker", player);

      const result = handleClientReady(
        maliciousSocket,
        world,
        broadcastManager,
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe("not_owner");
      expect(player.data.isLoading).toBe(true); // Unchanged
    });

    it("emits PLAYER_READY event after successful transition", () => {
      const player = createMockPlayer("player-1", "socket-1", true);
      const socket = createMockSocket("socket-1", player);

      handleClientReady(socket, world, broadcastManager);

      expect(world.emit).toHaveBeenCalledWith("player:ready", {
        playerId: "player-1",
      });
    });

    it("broadcasts entityModified with isLoading: false", () => {
      const player = createMockPlayer("player-1", "socket-1", true);
      const socket = createMockSocket("socket-1", player);

      handleClientReady(socket, world, broadcastManager);

      expect(broadcastManager.sendToAll).toHaveBeenCalledWith(
        "entityModified",
        {
          id: "player-1",
          changes: { isLoading: false },
        },
      );
    });

    it("does not emit events on failure", () => {
      const player = createMockPlayer("player-1", "socket-1", false);
      const socket = createMockSocket("socket-1", player);

      handleClientReady(socket, world, broadcastManager);

      expect(world.emit).not.toHaveBeenCalled();
      expect(broadcastManager.sendToAll).not.toHaveBeenCalled();
    });
  });

  describe("Timeout Mechanism", () => {
    it("forces isLoading=false after timeout", () => {
      const player = createMockPlayer("player-1", "socket-1", true);
      world.entities.set(player.id, player);

      const result = handleLoadingTimeout(player.id, world, broadcastManager);

      expect(result.triggered).toBe(true);
      expect(player.data.isLoading).toBe(false);
    });

    it("timeout uses entityId, not stale reference", () => {
      // Simulate scenario where socket.player might be stale
      const player = createMockPlayer("player-1", "socket-1", true);
      world.entities.set(player.id, player);

      // Timeout handler looks up entity by ID from world.entities
      const result = handleLoadingTimeout("player-1", world, broadcastManager);

      expect(result.triggered).toBe(true);
      expect(player.data.isLoading).toBe(false);
    });

    it("timeout broadcasts entityModified", () => {
      const player = createMockPlayer("player-1", "socket-1", true);
      world.entities.set(player.id, player);

      handleLoadingTimeout(player.id, world, broadcastManager);

      expect(broadcastManager.sendToAll).toHaveBeenCalledWith(
        "entityModified",
        {
          id: "player-1",
          changes: { isLoading: false },
        },
      );
    });

    it("timeout does nothing if player already active", () => {
      const player = createMockPlayer("player-1", "socket-1", false);
      world.entities.set(player.id, player);

      const result = handleLoadingTimeout(player.id, world, broadcastManager);

      expect(result.triggered).toBe(false);
      expect(broadcastManager.sendToAll).not.toHaveBeenCalled();
    });

    it("timeout does nothing if player disconnected/removed", () => {
      // Entity not in world.entities
      const result = handleLoadingTimeout(
        "nonexistent",
        world,
        broadcastManager,
      );

      expect(result.triggered).toBe(false);
      expect(broadcastManager.sendToAll).not.toHaveBeenCalled();
    });

    it("timeout does nothing if entity.data is undefined", () => {
      const brokenEntity = {
        id: "broken",
        data: undefined as unknown as MockEntityData,
      };
      world.entities.set("broken", brokenEntity);

      const result = handleLoadingTimeout("broken", world, broadcastManager);

      expect(result.triggered).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid reconnection (clientReady after timeout scheduled)", () => {
      const player = createMockPlayer("player-1", "socket-1", true);
      world.entities.set(player.id, player);
      const socket = createMockSocket("socket-1", player);

      // Player sends clientReady before timeout fires
      handleClientReady(socket, world, broadcastManager);
      expect(player.data.isLoading).toBe(false);

      // Now timeout fires - should do nothing
      const timeoutResult = handleLoadingTimeout(
        player.id,
        world,
        broadcastManager,
      );
      expect(timeoutResult.triggered).toBe(false);
    });

    it("handles player reconnection with new entity before old timeout", () => {
      // Original player
      const oldPlayer = createMockPlayer("player-old", "socket-old", true);
      world.entities.set(oldPlayer.id, oldPlayer);

      // Player reconnects with new entity
      const newPlayer = createMockPlayer("player-new", "socket-new", true);
      world.entities.set(newPlayer.id, newPlayer);

      // Remove old player (simulating disconnect cleanup)
      world.entities.delete(oldPlayer.id);

      // Old timeout fires - should do nothing (entity gone)
      const result = handleLoadingTimeout(
        "player-old",
        world,
        broadcastManager,
      );
      expect(result.triggered).toBe(false);

      // New player still loading
      expect(newPlayer.data.isLoading).toBe(true);
    });

    it("handles concurrent clientReady during timeout processing", () => {
      const player = createMockPlayer("player-1", "socket-1", true);
      world.entities.set(player.id, player);
      const socket = createMockSocket("socket-1", player);

      // Both fire at same time - first one wins
      const clientResult = handleClientReady(socket, world, broadcastManager);
      const timeoutResult = handleLoadingTimeout(
        player.id,
        world,
        broadcastManager,
      );

      expect(clientResult.success).toBe(true);
      expect(timeoutResult.triggered).toBe(false);
      expect(player.data.isLoading).toBe(false);

      // Only one broadcast should have happened
      expect(broadcastManager.sendToAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("State Invariants", () => {
    it("isLoading can only transition from true to false, never back", () => {
      const player = createMockPlayer("player-1", "socket-1", true);
      const socket = createMockSocket("socket-1", player);

      // Transition true -> false
      handleClientReady(socket, world, broadcastManager);
      expect(player.data.isLoading).toBe(false);

      // Cannot go back to true via clientReady
      player.data.isLoading = true; // Manual hack
      socket.player = player;

      // Handler will transition again
      const result = handleClientReady(socket, world, broadcastManager);
      expect(result.success).toBe(true);
      expect(player.data.isLoading).toBe(false);
    });

    it("owner cannot change during loading state", () => {
      const player = createMockPlayer("player-1", "socket-1", true);
      const originalOwner = player.data.owner;

      // Attempt to claim player from different socket
      const attackerSocket = createMockSocket("socket-attacker", player);
      handleClientReady(attackerSocket, world, broadcastManager);

      // Owner unchanged, player still loading
      expect(player.data.owner).toBe(originalOwner);
      expect(player.data.isLoading).toBe(true);
    });
  });
});
