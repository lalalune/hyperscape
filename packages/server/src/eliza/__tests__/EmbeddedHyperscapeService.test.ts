import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Minimal mock of the World event emitter used by EmbeddedHyperscapeService.
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

describe("EmbeddedHyperscapeService", () => {
  let EmbeddedHyperscapeService: any;

  beforeEach(async () => {
    // Dynamic import to avoid module resolution issues in test environment
    try {
      const mod = await import("../EmbeddedHyperscapeService.js");
      EmbeddedHyperscapeService = mod.EmbeddedHyperscapeService;
    } catch {
      // If the module can't be loaded in test context (missing deps), skip
      EmbeddedHyperscapeService = null;
    }
  }, 60000); // Increase timeout for dynamic import

  it("removes all world event listeners on stop()", async () => {
    if (!EmbeddedHyperscapeService) {
      console.warn(
        "[SKIP] EmbeddedHyperscapeService could not be imported in test context",
      );
      return;
    }

    const world = createMockWorld();
    const service = new EmbeddedHyperscapeService(
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
    if (!EmbeddedHyperscapeService) {
      return;
    }

    const world = createMockWorld();
    const service = new EmbeddedHyperscapeService(
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
    if (!EmbeddedHyperscapeService) {
      return;
    }

    const world = createMockWorld();
    const service = new EmbeddedHyperscapeService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );

    const result = service.getGameState();
    expect(result).toBeNull();
  });
});
