import { EventEmitter } from "node:events";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allocateNextBettingClientId,
  normalizeInternalAllowedOrigin,
  parseReplayCursor,
  registerStreamingBettingRoutes,
} from "../../../src/routes/streaming-betting-routes.js";
import type { StreamingDuelCycle } from "../../../src/systems/StreamingDuelScheduler/types.js";

function createRouteCycle(
  overrides: Partial<StreamingDuelCycle> = {},
): StreamingDuelCycle {
  return {
    cycleId: "cycle-1",
    phase: "FIGHTING",
    cycleStartTime: 1_000,
    phaseStartTime: 2_000,
    phaseVersion: 4,
    agent1: null,
    agent2: null,
    duelId: "duel-1",
    duelKeyHex: "0xabcdef",
    arenaId: null,
    betOpenTime: 1_000,
    betCloseTime: 2_000,
    countdownValue: null,
    fightStartTime: 3_000,
    duelEndTime: null,
    arenaPositions: null,
    winnerId: null,
    loserId: null,
    outcome: null,
    winReason: null,
    seed: null,
    replayHash: null,
    ...overrides,
  };
}

function createRouteOptions(
  overrides: Partial<Parameters<typeof registerStreamingBettingRoutes>[0]> = {},
) {
  const world = Object.assign(new EventEmitter(), {
    getSystem: () => null,
  });
  return {
    fastify: Fastify(),
    world: world as never,
    replayBuffer: 16,
    replayMaxBytes: 64 * 1024,
    pushIntervalMs: 250,
    heartbeatMs: 5000,
    maxPendingBytes: 64 * 1024,
    maxClients: 1,
    bootstrapRateLimit: {
      max: 10,
      timeWindow: "1 minute",
    },
    eventsRateLimit: {
      max: 10,
      timeWindow: "1 minute",
    },
    internalAllowedOrigin: null,
    externalStatusFile: null,
    externalStatusMaxAgeMs: 15_000,
    getStreamingDuelScheduler: () => ({
      getCurrentCycle: () => null,
    }),
    getStreamCaptureStats: () => ({
      clientConnected: true,
      ffmpegRunning: true,
    }),
    ...overrides,
  };
}

describe("streaming-betting-routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns bootstrap state for valid authenticated requests", async () => {
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "bet-secret");

    const options = createRouteOptions();
    const routes = registerStreamingBettingRoutes(options);

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/state",
      headers: {
        authorization: "Bearer bet-secret",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: 2,
      sourceEpoch: expect.any(Number),
      replay: expect.objectContaining({
        sourceEpoch: expect.any(Number),
      }),
    });

    routes.close();
    await options.fastify.close();
  });

  it("captures and replays a terminal cancellation before the scheduler clears its cycle", async () => {
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "bet-secret");
    let cycle: StreamingDuelCycle | null = createRouteCycle();
    const options = createRouteOptions({
      getStreamingDuelScheduler: () => ({
        getCurrentCycle: () => cycle,
      }),
    });
    const routes = registerStreamingBettingRoutes(options);
    const world = options.world as unknown as EventEmitter;

    world.emit("streaming:cycle:aborted", {
      cycleId: "cycle-1",
      duelId: "duel-1",
      reason: "combat_engagement_failed",
    });
    cycle = null;

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/state",
      headers: {
        authorization: "Bearer bet-secret",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: 2,
      duelId: "duel-1",
      duelKey: "0xabcdef",
      duelEndTime: expect.any(Number),
      winnerId: null,
      outcome: "cancelled",
      cancellationReason: "combat_engagement_failed",
    });
    expect(routes.getMetrics().replay.size).toBe(1);

    routes.close();
    expect(world.listenerCount("streaming:cycle:aborted")).toBe(0);
    await options.fastify.close();
  });

  it("preserves a draw outcome in the terminal cancellation frame", async () => {
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "bet-secret");
    const cycle = createRouteCycle({
      phase: "RESOLUTION",
      outcome: "draw",
      winReason: "draw",
      duelEndTime: 4_000,
    });
    const options = createRouteOptions({
      getStreamingDuelScheduler: () => ({
        getCurrentCycle: () => cycle,
      }),
    });
    const routes = registerStreamingBettingRoutes(options);
    const world = options.world as unknown as EventEmitter;

    world.emit("streaming:cycle:aborted", {
      cycleId: "cycle-1",
      duelId: "duel-1",
      reason: "draw",
    });

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/state",
      headers: {
        authorization: "Bearer bet-secret",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      outcome: "draw",
      cancellationReason: "draw",
      duelEndTime: 4_000,
    });

    routes.close();
    await options.fastify.close();
  });

  it("rejects query-token auth on the bootstrap route", async () => {
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "bet-secret");

    const options = createRouteOptions();
    const routes = registerStreamingBettingRoutes(options);

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/state?streamToken=bet-secret",
    });

    expect(response.statusCode).toBe(401);
    routes.close();
    await options.fastify.close();
  });

  it("returns 503 once betting SSE capacity is exhausted after auth succeeds", async () => {
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "bet-secret");

    const options = createRouteOptions({
      maxClients: 0,
    });
    const routes = registerStreamingBettingRoutes(options);

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/events",
      headers: {
        authorization: "Bearer bet-secret",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: "Bet sync SSE capacity reached",
    });

    routes.close();
    await options.fastify.close();
  });

  it("fails closed in production when betting-feed auth is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "");

    const options = createRouteOptions();
    const routes = registerStreamingBettingRoutes(options);

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/state",
      headers: {
        authorization: "Bearer whatever",
      },
    });

    expect(response.statusCode).toBe(503);
    routes.close();
    await options.fastify.close();
  });

  it("allows explicit skip-auth only in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "");
    vi.stubEnv("BETTING_FEED_SKIP_AUTH", "true");

    const options = createRouteOptions();
    const routes = registerStreamingBettingRoutes(options);

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/state",
    });

    expect(response.statusCode).toBe(200);
    routes.close();
    await options.fastify.close();
  });

  it("ignores skip-auth in test environments", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "");
    vi.stubEnv("BETTING_FEED_SKIP_AUTH", "true");

    const options = createRouteOptions();
    const routes = registerStreamingBettingRoutes(options);

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/state",
    });

    expect(response.statusCode).toBe(503);
    routes.close();
    await options.fastify.close();
  });

  it("ignores skip-auth in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "");
    vi.stubEnv("BETTING_FEED_SKIP_AUTH", "true");

    const options = createRouteOptions();
    const routes = registerStreamingBettingRoutes(options);

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/state",
    });

    expect(response.statusCode).toBe(503);
    routes.close();
    await options.fastify.close();
  });

  it("does not treat the viewer token as a betting-feed fallback", async () => {
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "");
    vi.stubEnv("STREAMING_VIEWER_ACCESS_TOKEN", "viewer-secret");

    const options = createRouteOptions();
    const routes = registerStreamingBettingRoutes(options);

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/state",
      headers: {
        authorization: "Bearer viewer-secret",
      },
    });

    expect(response.statusCode).toBe(503);
    routes.close();
    await options.fastify.close();
  });

  it("reuses and releases the external status poller across repeated route registration", async () => {
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "bet-secret");
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const firstOptions = createRouteOptions({
      externalStatusFile: "/tmp/nonexistent-betting-status.json",
    });
    const secondOptions = createRouteOptions({
      externalStatusFile: "/tmp/nonexistent-betting-status.json",
    });

    const firstRoutes = registerStreamingBettingRoutes(firstOptions);
    const secondRoutes = registerStreamingBettingRoutes(secondOptions);

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    firstRoutes.close();
    await firstOptions.fastify.close();
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    secondRoutes.close();
    await secondOptions.fastify.close();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("releases the external status poller when Fastify closes even without manual route cleanup", async () => {
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "bet-secret");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const options = createRouteOptions({
      externalStatusFile: "/tmp/nonexistent-betting-status.json",
    });

    registerStreamingBettingRoutes(options);
    await options.fastify.close();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("accepts only one explicit internal betting CORS origin", () => {
    expect(normalizeInternalAllowedOrigin("https://bets.example.com")).toBe(
      "https://bets.example.com",
    );
    expect(normalizeInternalAllowedOrigin("*")).toBeNull();
    expect(normalizeInternalAllowedOrigin("null")).toBeNull();
    expect(
      normalizeInternalAllowedOrigin(
        "https://bets.example.com,https://other.example.com",
      ),
    ).toBeNull();
    expect(
      normalizeInternalAllowedOrigin("https://bets.example.com/path"),
    ).toBeNull();
  });

  it("prefers Last-Event-Id over the initial since query parameter", () => {
    const request = {
      headers: {
        "last-event-id": "55",
      },
      query: {
        since: "12",
      },
    } as never;

    expect(parseReplayCursor(request)).toBe(55);
  });

  it("rejects query-token auth on the events route", async () => {
    vi.stubEnv("BETTING_FEED_ACCESS_TOKEN", "bet-secret");

    const options = createRouteOptions();
    const routes = registerStreamingBettingRoutes(options);

    const response = await options.fastify.inject({
      method: "GET",
      url: "/api/internal/bet-sync/events?streamToken=bet-secret",
    });

    expect(response.statusCode).toBe(401);
    routes.close();
    await options.fastify.close();
  });

  it("allocates betting client ids without colliding after wraparound", () => {
    const allocation = allocateNextBettingClientId(
      Number.MAX_SAFE_INTEGER - 1,
      [1],
    );

    expect(allocation).toEqual({
      clientId: Number.MAX_SAFE_INTEGER - 1,
      nextCursor: 1,
    });

    const wrapped = allocateNextBettingClientId(allocation.nextCursor, [1, 2]);
    expect(wrapped).toEqual({
      clientId: 3,
      nextCursor: 4,
    });
  });
});
