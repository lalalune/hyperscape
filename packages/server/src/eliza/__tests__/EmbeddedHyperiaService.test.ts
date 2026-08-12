import { describe, expect, it, vi } from "vitest";
import {
  EventType,
  getDuelArenaConfig,
  isPositionInsideCombatArena,
} from "@hyperforge/shared";
import { EmbeddedHyperiaService } from "../EmbeddedHyperiaService";

/**
 * Minimal mock of the World event emitter used by EmbeddedHyperiaService.
 * Tracks on/off calls so we can assert cleanup.
 */
function createMockWorld() {
  const listeners: Array<{ event: string; fn: (...args: unknown[]) => void }> =
    [];

  const playerData = {
    type: "player",
    data: {
      health: 10,
      maxHealth: 10,
      alive: true,
      skills: {},
      inventory: [],
      equipment: {},
      position: [0, 10, 0],
    },
    position: { set: vi.fn() },
  };

  // First call returns undefined (entity doesn't exist yet), subsequent calls return entity
  let getCallCount = 0;
  const entityGet = vi.fn((_id: string) => {
    getCallCount++;
    return getCallCount <= 1 ? undefined : playerData;
  });

  return {
    entities: {
      get: entityGet,
      add: vi.fn().mockReturnValue(playerData),
      remove: vi.fn(),
      items: { entries: () => new Map().entries() },
    },
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      listeners.push({ event, fn });
    }),
    off: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      const idx = listeners.findIndex((l) => l.event === event && l.fn === fn);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    emit: vi.fn(),
    getSystem: vi.fn().mockReturnValue({
      getCharactersAsync: vi
        .fn()
        .mockResolvedValue([
          { id: "char-1", name: "TestAgent", avatar: null, wallet: null },
        ]),
      getPlayerAsync: vi.fn().mockResolvedValue({}),
      getHeightAt: vi.fn().mockReturnValue(10),
    }),
    settings: { avatar: { url: "test.vrm" } },
    _listeners: listeners,
  };
}

describe("EmbeddedHyperiaService", () => {
  it("uses an explicit optimized agent avatar when no persisted avatar exists", async () => {
    const world = createMockWorld();
    const avatar = "asset://avatars/duel-candidates/duel-bandit.vrm";
    const service = new EmbeddedHyperiaService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
      avatar,
    );

    await service.initialize();

    expect(world.entities.add).toHaveBeenCalledWith(
      expect.objectContaining({ avatar }),
    );
  });

  it("never restores a persisted embedded agent inside a combat arena", async () => {
    const world = createMockWorld();
    const databaseSystem = world.getSystem();
    const arena = getDuelArenaConfig();
    databaseSystem.getPlayerAsync.mockResolvedValue({
      name: "TestAgent",
      positionX: arena.baseX + arena.arenaWidth / 2,
      positionY: 10,
      positionZ: arena.baseZ + arena.arenaLength / 2,
    });
    const service = new EmbeddedHyperiaService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );

    await service.initialize();

    const added = world.entities.add.mock.calls[0]![0] as {
      position: [number, number, number];
    };
    expect(
      isPositionInsideCombatArena(added.position[0], added.position[2]),
    ).toBe(false);
    expect(added.position).not.toEqual([
      arena.baseX + arena.arenaWidth / 2,
      10,
      arena.baseZ + arena.arenaLength / 2,
    ]);
  });

  it("removes all world event listeners on stop()", async () => {
    const world = createMockWorld();
    const service = new EmbeddedHyperiaService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );

    await service.initialize();

    // After initialize, subscribeToWorldEvents should have added listeners
    const onCallCount = world.on.mock.calls.length;
    expect(onCallCount).toBeGreaterThan(0);

    // Stop the service
    await service.stop();

    // Every on() call should have a matching off() call
    const offCallCount = world.off.mock.calls.length;
    expect(offCallCount).toBe(onCallCount);

    // The internal listener tracking should be empty
    expect(world._listeners.length).toBe(0);
  });

  it("getNearbyEntities returns empty array when no player", () => {
    const world = createMockWorld();
    const service = new EmbeddedHyperiaService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );

    // Not initialized — should return []
    const result = service.getNearbyEntities();
    expect(result).toEqual([]);
  });

  it("getGameState returns null when not active", () => {
    const world = createMockWorld();
    const service = new EmbeddedHyperiaService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );

    const result = service.getGameState();
    expect(result).toBeNull();
  });

  it("waits for the exact gravestone custody result before reporting success", async () => {
    const world = createMockWorld();
    const service = new EmbeddedHyperiaService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );
    await service.initialize();

    const attemptId = "123e4567-e89b-42d3-a456-426614174000";
    let settled = false;
    const resultPromise = service
      .executeLootGravestone("gravestone_char-1_123", attemptId)
      .then((result) => {
        settled = true;
        return result;
      });
    await Promise.resolve();
    expect(settled).toBe(false);

    const request = world.emit.mock.calls.find(
      ([event]) => event === EventType.CORPSE_LOOT_ALL_REQUEST,
    )?.[1] as { transactionId: string };
    expect(request.transactionId).toBe(`agent-grave-loot:${attemptId}`);

    for (const listener of [...world._listeners]) {
      if (listener.event !== EventType.LOOT_RESULT) continue;
      listener.fn({
        playerId: "char-1",
        transactionId: "foreign-operation",
        success: true,
      });
    }
    await Promise.resolve();
    expect(settled).toBe(false);

    for (const listener of [...world._listeners]) {
      if (listener.event !== EventType.LOOT_RESULT) continue;
      listener.fn({
        playerId: "char-1",
        transactionId: request.transactionId,
        success: true,
      });
    }

    await expect(resultPromise).resolves.toBe(true);
    expect(
      world._listeners.filter(
        (listener) => listener.event === EventType.LOOT_RESULT,
      ),
    ).toHaveLength(0);
  });

  it("keeps live coin readiness in a main-process-only accessor", async () => {
    const world = createMockWorld();
    const databaseSystem = world.getSystem();
    const coinPouch = {
      isPlayerInitialized: vi.fn(() => false),
      getCoins: vi.fn(() => 125),
    };
    world.getSystem.mockImplementation((name: string) =>
      name === "coin-pouch" ? coinPouch : databaseSystem,
    );
    const service = new EmbeddedHyperiaService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );
    await service.initialize();

    expect(service.getPrivateCoinBalance()).toBeNull();
    coinPouch.isPlayerInitialized.mockReturnValue(true);
    expect(service.getPrivateCoinBalance()).toBe(125);
    expect(coinPouch.getCoins).toHaveBeenCalledWith("char-1");
    for (const invalidBalance of [-1, 1.5, Number.NaN]) {
      coinPouch.getCoins.mockReturnValue(invalidBalance);
      expect(service.getPrivateCoinBalance()).toBeNull();
    }
  });

  it("updates the live entity and broadcasts a display-name change", async () => {
    const world = createMockWorld();
    const service = new EmbeddedHyperiaService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );
    await service.initialize();

    service.setDisplayName("  Renamed Agent  ");

    const liveEntity = world.entities.get("char-1") as unknown as {
      data: { name?: string };
    };
    expect(liveEntity.data.name).toBe("Renamed Agent");
    expect(world.emit).toHaveBeenCalledWith("entityModified", {
      id: "char-1",
      changes: { name: "Renamed Agent" },
    });
  });

  it("rejects an empty display name", () => {
    const service = new EmbeddedHyperiaService(
      createMockWorld() as any,
      "char-1",
      "account-1",
      "TestAgent",
    );

    expect(() => service.setDisplayName("  ")).toThrow(
      "display name cannot be empty",
    );
  });
});
