import { describe, expect, it, vi } from "vitest";
import { EmbeddedHyperscapeService } from "../EmbeddedHyperscapeService";

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

  const characterSystem = {
    getCharactersAsync: vi
      .fn()
      .mockResolvedValue([
        { id: "char-1", name: "TestAgent", avatar: null, wallet: null },
      ]),
    getPlayerAsync: vi.fn().mockResolvedValue({}),
    getHeightAt: vi.fn().mockReturnValue(10),
  };

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
    getSystem: vi.fn().mockReturnValue(characterSystem),
    settings: { avatar: { url: "test.vrm" } },
    _characterSystem: characterSystem,
    _listeners: listeners,
  };
}

describe("EmbeddedHyperscapeService", () => {
  it("removes all world event listeners on stop()", async () => {
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

  it("normalizes stale saved avatar LOD URLs before spawning the entity", async () => {
    const world = createMockWorld();
    world._characterSystem.getPlayerAsync.mockResolvedValue({
      id: "char-1",
      name: "TestAgent",
      avatar: "asset://avatars/avatar-female-01_lod2.vrm",
      wallet: null,
    });

    const service = new EmbeddedHyperscapeService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );

    await service.initialize();

    expect(world.entities.add).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar: "asset://avatars/avatar-female-01.vrm",
      }),
    );
  });

  it("normalizes world-settings avatar URLs before spawning the entity", async () => {
    const world = createMockWorld();
    world.settings.avatar.url = "avatars/avatar-female-02_lod1.vrm?cache=1";

    const service = new EmbeddedHyperscapeService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );

    await service.initialize();

    expect(world.entities.add).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar: "asset://avatars/avatar-female-02.vrm?cache=1",
      }),
    );
  });

  it("falls back to the default stock avatar when no avatar is configured", async () => {
    const world = createMockWorld();
    // Intentionally clearing avatar to exercise the fallback path; the
    // production code treats the settings shape as partial.
    (world as { settings: Record<string, unknown> }).settings = {};

    const service = new EmbeddedHyperscapeService(
      world as any,
      "char-1",
      "account-1",
      "TestAgent",
    );

    await service.initialize();

    expect(world.entities.add).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar: "asset://avatars/avatar-male-01.vrm",
      }),
    );
  });
});
