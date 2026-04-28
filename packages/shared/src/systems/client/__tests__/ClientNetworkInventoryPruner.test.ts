import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientNetwork } from "../ClientNetwork";
import type { World } from "../../../types";

type ClientNetworkHarness = ClientNetwork & {
  inventoryPrunerInterval: ReturnType<typeof setInterval> | null;
  lastInventoryByPlayerId: Record<
    string,
    {
      playerId: string;
      items: Array<{ slot: number; itemId: string; quantity: number }>;
      coins: number;
      maxSlots: number;
    }
  >;
};

const createWorld = () =>
  ({
    emit: vi.fn(),
  }) as unknown as World;

describe("ClientNetwork inventory pruner", () => {
  let nowMs = 0;

  beforeEach(() => {
    nowMs = 0;
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stops polling once no optimistic inventory actions remain pending", () => {
    const world = createWorld();
    const network = new ClientNetwork(world) as ClientNetworkHarness;

    network.lastInventoryByPlayerId.player = {
      playerId: "player",
      items: [{ slot: 1, itemId: "logs", quantity: 2 }],
      coins: 0,
      maxSlots: 28,
    };

    network.applyOptimisticRemoval("player", 1, 1);

    expect(network.inventoryPrunerInterval).not.toBeNull();

    nowMs = 6_000;
    vi.advanceTimersByTime(1_000);

    expect(network.inventoryPrunerInterval).toBeNull();
  });
});
