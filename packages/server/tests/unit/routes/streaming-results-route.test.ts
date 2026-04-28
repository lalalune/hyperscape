import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerStreamingRoutes } from "../../../src/routes/streaming.js";

const ORIGINAL_ENV = { ...process.env };

type StreamingHistoryRow = {
  cycleId: string;
  damageLoser: number | null;
  damageWinner: number | null;
  duelEndTime: number | null;
  duelId: string;
  duelKeyHex: string | null;
  finishedAt: Date | null;
  loserId: string | null;
  loserName: string | null;
  replayHash: string | null;
  seed: string | null;
  winReason: string | null;
  winnerId: string | null;
  winnerName: string | null;
};

function createHistoryDb(rows: StreamingHistoryRow[]) {
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    db: { select },
    spies: { from, limit, select, where },
  };
}

function createApp(rows: StreamingHistoryRow[]) {
  const app = Fastify();
  app.decorate("rateLimit", (() =>
    async () => {}) as FastifyInstance["rateLimit"]);

  const { db, spies } = createHistoryDb(rows);
  const world = {
    getSystem: (name: string) =>
      name === "database"
        ? {
            getDb: () => db,
          }
        : null,
  };

  registerStreamingRoutes(app, world as never);
  return { app, spies };
}

describe("streaming results route", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("requires the oracle proof bearer token", async () => {
    process.env.HYPERSCAPES_RESULT_LOOKUP_BEARER_TOKEN = "result-secret";
    const { app } = createApp([]);

    const response = await app.inject({
      method: "GET",
      url: "/api/streaming/results/streaming-1",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "Unauthorized",
    });
    await app.close();
  });

  it("does not serve oracle proof material unauthenticated in dev mode", async () => {
    process.env.NODE_ENV = "development";
    process.env.BETTING_FEED_SKIP_AUTH = "true";
    process.env.ALLOW_UNAUTHENTICATED_ORACLE_PROOF = "true";
    const { app } = createApp([]);

    const response = await app.inject({
      method: "GET",
      url: "/api/streaming/results/streaming-1",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: "Service unavailable",
      message: "Oracle proof auth token is not configured",
    });
    await app.close();
  });

  it("rejects malformed duel ids", async () => {
    process.env.HYPERSCAPES_RESULT_LOOKUP_BEARER_TOKEN = "result-secret";
    const { app } = createApp([]);

    const response = await app.inject({
      method: "GET",
      url: "/api/streaming/results/streaming%201",
      headers: {
        authorization: "Bearer result-secret",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Bad request",
      message: "Invalid duelId format",
    });
    await app.close();
  });

  it("returns oracle proof material for authenticated resolved duels", async () => {
    process.env.HYPERSCAPES_RESULT_LOOKUP_BEARER_TOKEN = "result-secret";
    const finishedAt = new Date("2026-04-20T00:00:00.000Z");
    const row: StreamingHistoryRow = {
      cycleId: "cycle-1",
      damageLoser: 4,
      damageWinner: 9,
      duelEndTime: 1776643200000,
      duelId: "streaming-1",
      duelKeyHex: "a".repeat(64),
      finishedAt,
      loserId: "agent-b",
      loserName: "Agent B",
      replayHash: "b".repeat(64),
      seed: "c".repeat(64),
      winReason: "KO",
      winnerId: "agent-a",
      winnerName: "Agent A",
    };
    const { app } = createApp([row]);

    const response = await app.inject({
      method: "GET",
      url: "/api/streaming/results/streaming-1",
      headers: {
        authorization: "Bearer result-secret",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      cycleId: "cycle-1",
      duelId: "streaming-1",
      duelKeyHex: "a".repeat(64),
      replayHash: "b".repeat(64),
      seed: "c".repeat(64),
      winnerId: "agent-a",
    });
    await app.close();
  });
});
