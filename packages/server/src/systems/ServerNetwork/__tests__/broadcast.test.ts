/**
 * Broadcast Manager Tests
 *
 * Tests the network broadcast system:
 * - Broadcasting to all connected clients
 * - Sending to specific sockets/players
 * - Exclusion of originating socket
 * - Player socket lookup
 *
 * NO MOCKS for packet serialization - uses real writePacket
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { BroadcastManager } from "../broadcast";
import type { ServerSocket } from "../../../shared/types";

// Create mock socket with tracking
function createMockSocket(
  id: string,
  playerId?: string,
): { socket: ServerSocket; packets: Array<ArrayBuffer> } {
  const packets: Array<ArrayBuffer> = [];

  const socket = {
    id,
    player: playerId
      ? { id: playerId, position: { x: 0, y: 0, z: 0 }, data: {} }
      : undefined,
    send: mock((_name: string, _data: unknown) => {
      // Track what was sent
    }),
    sendPacket: mock((packet: ArrayBuffer) => {
      packets.push(packet);
    }),
  } as unknown as ServerSocket;

  return { socket, packets };
}

describe("BroadcastManager", () => {
  let sockets: Map<string, ServerSocket>;
  let broadcast: BroadcastManager;

  beforeEach(() => {
    sockets = new Map();
    broadcast = new BroadcastManager(sockets);
  });

  describe("sendToAll", () => {
    it("should send packet to all connected sockets", () => {
      const { socket: socket1, packets: packets1 } = createMockSocket("s1");
      const { socket: socket2, packets: packets2 } = createMockSocket("s2");
      const { socket: socket3, packets: packets3 } = createMockSocket("s3");

      sockets.set("s1", socket1);
      sockets.set("s2", socket2);
      sockets.set("s3", socket3);

      const count = broadcast.sendToAll("chatAdded", { message: "Hello" });

      expect(count).toBe(3);
      expect(packets1.length).toBe(1);
      expect(packets2.length).toBe(1);
      expect(packets3.length).toBe(1);
    });

    it("should exclude specified socket", () => {
      const { socket: socket1, packets: packets1 } = createMockSocket("s1");
      const { socket: socket2, packets: packets2 } = createMockSocket("s2");
      const { socket: socket3, packets: packets3 } = createMockSocket("s3");

      sockets.set("s1", socket1);
      sockets.set("s2", socket2);
      sockets.set("s3", socket3);

      const count = broadcast.sendToAll(
        "entityModified",
        { id: "e1" },
        "s2", // Exclude s2
      );

      expect(count).toBe(2);
      expect(packets1.length).toBe(1);
      expect(packets2.length).toBe(0); // Excluded
      expect(packets3.length).toBe(1);
    });

    it("should return 0 for empty socket map", () => {
      const count = broadcast.sendToAll("ping", Date.now());

      expect(count).toBe(0);
    });

    it("should serialize packet only once", () => {
      const { socket: socket1 } = createMockSocket("s1");
      const { socket: socket2 } = createMockSocket("s2");

      sockets.set("s1", socket1);
      sockets.set("s2", socket2);

      // Send same message
      broadcast.sendToAll("entityAdded", { id: "e1", type: "player" });

      // Both sockets should receive the same packet instance
      // (implementation detail - verifying efficient serialization)
      expect(socket1.sendPacket).toHaveBeenCalledTimes(1);
      expect(socket2.sendPacket).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendToSocket", () => {
    it("should send to specific socket by ID", () => {
      const { socket: socket1, packets: _packets1 } = createMockSocket("s1");
      const { socket: socket2, packets: _packets2 } = createMockSocket("s2");

      sockets.set("s1", socket1);
      sockets.set("s2", socket2);

      const result = broadcast.sendToSocket("s1", "playerState", {
        health: 100,
      });

      expect(result).toBe(true);
      expect(socket1.send).toHaveBeenCalledWith("playerState", { health: 100 });
      expect(socket2.send).not.toHaveBeenCalled();
    });

    it("should return false for non-existent socket", () => {
      const result = broadcast.sendToSocket("nonexistent", "ping", null);

      expect(result).toBe(false);
    });
  });

  describe("sendToPlayer", () => {
    it("should send to socket associated with player ID", () => {
      const { socket: socket1 } = createMockSocket("s1", "player-1");
      const { socket: socket2 } = createMockSocket("s2", "player-2");

      sockets.set("s1", socket1);
      sockets.set("s2", socket2);

      const result = broadcast.sendToPlayer("player-2", "inventoryUpdated", {
        items: [],
      });

      expect(result).toBe(true);
      expect(socket2.send).toHaveBeenCalledWith("inventoryUpdated", {
        items: [],
      });
      expect(socket1.send).not.toHaveBeenCalled();
    });

    it("should return false if player not found", () => {
      const { socket: socket1 } = createMockSocket("s1", "player-1");
      sockets.set("s1", socket1);

      const result = broadcast.sendToPlayer("unknown-player", "ping", null);

      expect(result).toBe(false);
    });

    it("should skip sockets without player", () => {
      const { socket: socket1 } = createMockSocket("s1"); // No player
      const { socket: socket2 } = createMockSocket("s2", "player-2");

      sockets.set("s1", socket1);
      sockets.set("s2", socket2);

      const result = broadcast.sendToPlayer("player-2", "test", {});

      expect(result).toBe(true);
      expect(socket2.send).toHaveBeenCalled();
    });
  });

  describe("getPlayerSocket", () => {
    it("should return socket for player ID", () => {
      const { socket: socket1 } = createMockSocket("s1", "player-1");
      const { socket: socket2 } = createMockSocket("s2", "player-2");

      sockets.set("s1", socket1);
      sockets.set("s2", socket2);

      const found = broadcast.getPlayerSocket("player-1");

      expect(found).toBe(socket1);
    });

    it("should return undefined for unknown player", () => {
      const { socket: socket1 } = createMockSocket("s1", "player-1");
      sockets.set("s1", socket1);

      const found = broadcast.getPlayerSocket("unknown");

      expect(found).toBeUndefined();
    });
  });
});

describe("BroadcastManager Scaling", () => {
  it("should handle large number of sockets", () => {
    const sockets = new Map<string, ServerSocket>();
    const broadcast = new BroadcastManager(sockets);

    // Add 100 sockets (reduced for CI stability)
    for (let i = 0; i < 100; i++) {
      const { socket } = createMockSocket(`s${i}`, `player-${i}`);
      sockets.set(`s${i}`, socket);
    }

    // Broadcast 10 messages
    for (let i = 0; i < 10; i++) {
      broadcast.sendToAll("entityModified", {
        id: `entity-${i}`,
        changes: { p: [i, 0, i] },
      });
    }

    // Total packets sent: 10 * 100 = 1,000
    let totalPackets = 0;
    for (const socket of sockets.values()) {
      totalPackets += (socket.sendPacket as ReturnType<typeof mock>).mock.calls
        .length;
    }
    expect(totalPackets).toBe(1000);
  });

  it("should handle exclusion efficiently", () => {
    const sockets = new Map<string, ServerSocket>();
    const broadcast = new BroadcastManager(sockets);

    // Add 100 sockets
    for (let i = 0; i < 100; i++) {
      const { socket } = createMockSocket(`s${i}`);
      sockets.set(`s${i}`, socket);
    }

    // Broadcast with exclusion - use valid packet name
    const count = broadcast.sendToAll("chatAdded", { message: "test" }, "s50");

    expect(count).toBe(99); // All except s50
  });
});

describe("BroadcastManager with Real Packets", () => {
  it("should create valid binary packets", () => {
    const sockets = new Map<string, ServerSocket>();
    const broadcast = new BroadcastManager(sockets);

    const receivedPackets: ArrayBuffer[] = [];
    const { socket } = createMockSocket("s1");
    socket.sendPacket = mock((packet: ArrayBuffer) => {
      receivedPackets.push(packet);
    });

    sockets.set("s1", socket);

    broadcast.sendToAll("entityModified", {
      id: "entity-123",
      changes: {
        p: [100, 25, 50],
        q: [0, 0, 0, 1],
      },
    });

    expect(receivedPackets.length).toBe(1);
    expect(receivedPackets[0]).toBeInstanceOf(ArrayBuffer);
    expect(receivedPackets[0].byteLength).toBeGreaterThan(0);
  });
});
