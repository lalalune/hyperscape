import { describe, expect, it, vi } from "vitest";

vi.mock("@elizaos/core", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { requestTradeAction } from "../actions/trading";

function createMockRuntime(hasNearbyPlayer = true) {
  const service = {
    isConnected: vi.fn().mockReturnValue(true),
    getPlayerEntity: vi.fn().mockReturnValue({
      position: [100, 10, 100] as [number, number, number],
    }),
    getNearbyEntities: vi.fn().mockReturnValue(
      hasNearbyPlayer
        ? [
            {
              id: "player-1",
              name: "Alice",
              type: "player",
              entityType: "player",
              playerId: "player-1",
              position: [102, 10, 100] as [number, number, number],
            },
          ]
        : [],
    ),
    executeMove: vi.fn().mockResolvedValue(undefined),
    interactWithEntity: vi.fn(),
  };

  return {
    getService: vi.fn().mockReturnValue(service),
    service,
  };
}

describe("trading actions", () => {
  describe("requestTradeAction", () => {
    it("validates when a player is nearby", async () => {
      const runtime = createMockRuntime(true);
      const result = await requestTradeAction.validate(runtime as never);
      expect(result).toBe(true);
    });

    it("fails validation when no players nearby", async () => {
      const runtime = createMockRuntime(false);
      const result = await requestTradeAction.validate(runtime as never);
      expect(result).toBe(false);
    });

    it("handler interacts with nearest player", async () => {
      const runtime = createMockRuntime(true);
      const callback = vi.fn();

      await requestTradeAction.handler(
        runtime as never,
        { content: { text: "trade" } } as never,
        undefined,
        undefined,
        callback,
      );

      expect(runtime.service.interactWithEntity).toHaveBeenCalledWith(
        "player-1",
        "trade",
      );
      expect(callback).toHaveBeenCalled();
    });

    it("handler returns error when no players nearby", async () => {
      const runtime = createMockRuntime(false);

      const result = await requestTradeAction.handler(
        runtime as never,
        { content: { text: "trade" } } as never,
      );

      expect((result as Record<string, unknown>).success).toBe(false);
    });
  });
});
