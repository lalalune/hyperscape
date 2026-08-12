import { afterEach, describe, expect, it, vi } from "vitest";

import { registerDuelEventListeners } from "../duel-events";

type Handler = (payload: unknown) => void;

function createHarness(
  entities: Map<string, { data: Record<string, unknown> }>,
) {
  const handlers = new Map<string, Set<Handler>>();
  const world = {
    entities: {
      get: (id: string) => entities.get(id),
    },
    on: (event: string, handler: Handler) => {
      const eventHandlers = handlers.get(event) ?? new Set<Handler>();
      eventHandlers.add(handler);
      handlers.set(event, eventHandlers);
    },
    off: (event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
    },
  };
  const emit = (event: string, payload: unknown) => {
    for (const handler of handlers.get(event) ?? []) {
      handler(payload);
    }
  };

  const cleanup = registerDuelEventListeners({
    world: world as never,
    broadcastManager: {} as never,
    getSocketByPlayerId: () => undefined,
    processedDuelSettlements: new Set(),
    executeDuelStakeTransferWithRetry: vi.fn(async () => undefined),
  });

  return { cleanup, emit };
}

const sessionPayload = {
  duelId: "duel-1",
  challengerId: "agent-a",
  challengerName: "Agent A",
  targetId: "agent-b",
  targetName: "Agent B",
};

const fightPayload = {
  duelId: "duel-1",
  arenaId: 1,
  challengerId: "agent-a",
  targetId: "agent-b",
  bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("duel socket delivery", () => {
  it("does not report missing sockets for server-owned agents", () => {
    const entities = new Map([
      ["agent-a", { data: { isAgent: true } }],
      ["agent-b", { data: { owner: "embedded-agent:agent-b" } }],
    ]);
    const harness = createHarness(entities);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    harness.emit("duel:session:created", sessionPayload);
    harness.emit("duel:fight:start", fightPayload);

    expect(warn).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("still reports missing sockets for client-owned contestants", () => {
    const entities = new Map([
      ["agent-a", { data: { isAgent: false } }],
      ["agent-b", { data: {} }],
    ]);
    const harness = createHarness(entities);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    harness.emit("duel:session:created", sessionPayload);
    harness.emit("duel:fight:start", fightPayload);

    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      expect.stringContaining("challenger agent-a"),
      expect.stringContaining("target agent-b"),
      expect.stringContaining("challenger agent-a"),
      expect.stringContaining("target agent-b"),
    ]);
    harness.cleanup();
  });
});
