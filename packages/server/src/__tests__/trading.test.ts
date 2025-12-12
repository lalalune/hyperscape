/**
 * Trading System Integration Tests
 * Tests the full trading flow between two players
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { ServerNetwork } from "../ServerNetwork";
import type { ServerSocket } from "../types";

describe("Trading System", () => {
  let network: ServerNetwork;
  let player1Socket: Partial<ServerSocket>;
  let player2Socket: Partial<ServerSocket>;
  let player1Messages: Array<{ type: string; data: unknown }> = [];
  let player2Messages: Array<{ type: string; data: unknown }> = [];

  beforeEach(() => {
    // Reset for each test
    player1Messages = [];
    player2Messages = [];

    // Create a minimal mock world with proper typing
    type MockWorld = {
      getSystem: (name: string) => unknown;
      entities: {
        get: (id: string) => unknown;
      };
      emit: () => void;
    };

    const mockWorld: MockWorld = {
      getSystem: (name: string) => {
        if (name === "inventory") {
          return {
            getInventoryData: (playerId: string) => {
              if (playerId === "player1") {
                return {
                  items: [{ itemId: "bronze_sword", quantity: 1, slot: 0 }],
                  coins: 500,
                  maxSlots: 28,
                };
              } else if (playerId === "player2") {
                return {
                  items: [{ itemId: "steel_shield", quantity: 1, slot: 0 }],
                  coins: 300,
                  maxSlots: 28,
                };
              }
              return { items: [], coins: 0, maxSlots: 28 };
            },
          };
        }
        return undefined;
      },
      entities: {
        get: (id: string) => {
          if (id === "player1") {
            return { id, position: { set: () => {}, x: 0, y: 0, z: 0 } };
          } else if (id === "player2") {
            return { id, position: { set: () => {}, x: 1, y: 0, z: 1 } };
          }
          return undefined;
        },
      },
      emit: () => {},
    };

    // Initialize network with mock world - cast through unknown for test mocking
    network = new ServerNetwork(
      mockWorld as unknown as Parameters<typeof ServerNetwork>[0],
    );

    // Create mock player entities with proper types
    type MockPlayerEntity = {
      id: string;
      position: { x: number; y: number; z: number; set?: () => void };
      data: { id: string; name: string };
    };

    const player1Entity: MockPlayerEntity = {
      id: "player1",
      position: { x: 0, y: 0, z: 0 },
      data: { id: "player1", name: "Alice" },
    };

    const player2Entity: MockPlayerEntity = {
      id: "player2",
      position: { x: 1, y: 0, z: 1 }, // Within 5 unit range
      data: { id: "player2", name: "Bob" },
    };

    // Create mock sockets with proper typing
    player1Socket = {
      id: "socket1",
      player: player1Entity as unknown as ServerSocket["player"],
      send: (type: string, data: unknown) => {
        player1Messages.push({ type, data });
      },
    };

    player2Socket = {
      id: "socket2",
      player: player2Entity as unknown as ServerSocket["player"],
      send: (type: string, data: unknown) => {
        player2Messages.push({ type, data });
      },
    };

    // Register sockets
    network.sockets.set("socket1", player1Socket as ServerSocket);
    network.sockets.set("socket2", player2Socket as ServerSocket);
  });

  test("should initiate trade request", async () => {
    player1Messages = [];
    player2Messages = [];

    // Player 1 requests trade with Player 2
    await network["onTradeRequest"](player1Socket as ServerSocket, {
      targetPlayerId: "player2",
    });

    // Player 2 should receive trade request
    const tradeRequest = player2Messages.find((m) => m.type === "tradeRequest");
    expect(tradeRequest).toBeDefined();
    expect((tradeRequest!.data as { fromPlayerId: string }).fromPlayerId).toBe(
      "player1",
    );
    expect(
      (tradeRequest!.data as { fromPlayerName: string }).fromPlayerName,
    ).toBe("Alice");
  });

  test("should reject trade if players too far apart", async () => {
    player1Messages = [];

    // Move player 2 far away temporarily
    const originalPos = {
      ...(
        player2Socket.player as {
          position: { x: number; y: number; z: number };
        }
      ).position,
    };
    (
      player2Socket.player as { position: { x: number; y: number; z: number } }
    ).position = { x: 100, y: 0, z: 100 };

    await network["onTradeRequest"](player1Socket as ServerSocket, {
      targetPlayerId: "player2",
    });

    // Player 1 should receive error
    const error = player1Messages.find((m) => m.type === "tradeError");
    expect(error).toBeDefined();
    expect((error!.data as { message: string }).message).toContain(
      "too far away",
    );

    // Move player 2 back
    (
      player2Socket.player as { position: { x: number; y: number; z: number } }
    ).position = originalPos;
  });

  test("should accept trade and open trade window", async () => {
    player1Messages = [];
    player2Messages = [];

    // First initiate trade
    await network["onTradeRequest"](player1Socket as ServerSocket, {
      targetPlayerId: "player2",
    });

    const tradeRequest = player2Messages.find((m) => m.type === "tradeRequest");
    const tradeId = (tradeRequest!.data as { tradeId: string }).tradeId;

    // Player 2 accepts
    await network["onTradeResponse"](player2Socket as ServerSocket, {
      tradeId,
      accepted: true,
      fromPlayerId: "player1",
    });

    // Both players should receive tradeStarted
    const p1Started = player1Messages.find((m) => m.type === "tradeStarted");
    const p2Started = player2Messages.find((m) => m.type === "tradeStarted");

    expect(p1Started).toBeDefined();
    expect(p2Started).toBeDefined();
    expect((p1Started!.data as { tradeId: string }).tradeId).toBe(tradeId);
  });

  test("should reject trade", async () => {
    player1Messages = [];
    player2Messages = [];

    // Initiate trade
    await network["onTradeRequest"](player1Socket as ServerSocket, {
      targetPlayerId: "player2",
    });

    const tradeRequest = player2Messages.find((m) => m.type === "tradeRequest");
    const tradeId = (tradeRequest!.data as { tradeId: string }).tradeId;

    // Player 2 rejects
    await network["onTradeResponse"](player2Socket as ServerSocket, {
      tradeId,
      accepted: false,
      fromPlayerId: "player1",
    });

    // Player 1 should receive cancellation
    const cancelled = player1Messages.find((m) => m.type === "tradeCancelled");
    expect(cancelled).toBeDefined();
  });

  test("should update trade offers", async () => {
    player1Messages = [];
    player2Messages = [];

    // Initiate and accept trade
    await network["onTradeRequest"](player1Socket as ServerSocket, {
      targetPlayerId: "player2",
    });

    const tradeRequest = player2Messages.find((m) => m.type === "tradeRequest");
    const tradeId = (tradeRequest!.data as { tradeId: string }).tradeId;

    await network["onTradeResponse"](player2Socket as ServerSocket, {
      tradeId,
      accepted: true,
      fromPlayerId: "player1",
    });

    player1Messages = [];
    player2Messages = [];

    // Player 1 offers items and coins
    await network["onTradeOffer"](player1Socket as ServerSocket, {
      tradeId,
      items: [{ itemId: "bronze_sword", quantity: 1, slot: 0 }],
      coins: 100,
    });

    // Both players should receive update
    const p1Update = player1Messages.find((m) => m.type === "tradeUpdated");
    const p2Update = player2Messages.find((m) => m.type === "tradeUpdated");

    expect(p1Update).toBeDefined();
    expect(p2Update).toBeDefined();

    const p1Data = p1Update!.data as { initiatorOffer: { coins: number } };
    expect(p1Data.initiatorOffer.coins).toBe(100);
  });

  test("should complete trade when both confirm", async () => {
    player1Messages = [];
    player2Messages = [];

    // Full trade flow
    await network["onTradeRequest"](player1Socket as ServerSocket, {
      targetPlayerId: "player2",
    });

    const tradeRequest = player2Messages.find((m) => m.type === "tradeRequest");
    const tradeId = (tradeRequest!.data as { tradeId: string }).tradeId;

    await network["onTradeResponse"](player2Socket as ServerSocket, {
      tradeId,
      accepted: true,
      fromPlayerId: "player1",
    });

    // Set offers
    await network["onTradeOffer"](player1Socket as ServerSocket, {
      tradeId,
      items: [{ itemId: "bronze_sword", quantity: 1, slot: 0 }],
      coins: 50,
    });

    await network["onTradeOffer"](player2Socket as ServerSocket, {
      tradeId,
      items: [{ itemId: "steel_shield", quantity: 1, slot: 0 }],
      coins: 30,
    });

    player1Messages = [];
    player2Messages = [];

    // Both confirm
    await network["onTradeConfirm"](player1Socket as ServerSocket, { tradeId });
    await network["onTradeConfirm"](player2Socket as ServerSocket, { tradeId });

    // Both should receive tradeCompleted
    const p1Complete = player1Messages.find((m) => m.type === "tradeCompleted");
    const p2Complete = player2Messages.find((m) => m.type === "tradeCompleted");

    expect(p1Complete).toBeDefined();
    expect(p2Complete).toBeDefined();
  });

  test("should cancel trade", async () => {
    player1Messages = [];
    player2Messages = [];

    // Start trade
    await network["onTradeRequest"](player1Socket as ServerSocket, {
      targetPlayerId: "player2",
    });

    const tradeRequest = player2Messages.find((m) => m.type === "tradeRequest");
    const tradeId = (tradeRequest!.data as { tradeId: string }).tradeId;

    await network["onTradeResponse"](player2Socket as ServerSocket, {
      tradeId,
      accepted: true,
      fromPlayerId: "player1",
    });

    player1Messages = [];
    player2Messages = [];

    // Player 1 cancels
    await network["onTradeCancel"](player1Socket as ServerSocket, { tradeId });

    // Both should receive cancellation
    const p1Cancel = player1Messages.find((m) => m.type === "tradeCancelled");
    const p2Cancel = player2Messages.find((m) => m.type === "tradeCancelled");

    expect(p1Cancel).toBeDefined();
    expect(p2Cancel).toBeDefined();
  });
});
