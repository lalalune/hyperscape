import { createServer, type ServerResponse } from "node:http";
import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { createPostgresClientDatabase } from "../src/database/postgres-transaction.js";
import * as schema from "../src/database/schema.js";
import {
  buildBettingFeedPayload,
  type BettingFeedPayload,
  type BettingFeedTerminalOverride,
} from "../src/routes/streaming-betting-feed.js";
import { StreamingDuelScheduler } from "../src/systems/StreamingDuelScheduler/index.js";
import {
  AGENT_IDS,
  openPersistedCycle,
  seedAgents,
  startWorkerRuntime,
  stopWorkerRuntime,
  waitFor,
  waitForPostgres,
  type WorkerRuntime,
} from "./test-agent-duel-cycle-process-kill.js";

const databaseUrl = process.env.AGENT_DUEL_BET_SYNC_DATABASE_URL?.trim() || "";
const bettingToken = process.env.BETTING_FEED_ACCESS_TOKEN?.trim() || "";
const port = Number.parseInt(
  process.env.AGENT_DUEL_BET_SYNC_PORT?.trim() || "",
  10,
);

if (!databaseUrl) {
  throw new Error("AGENT_DUEL_BET_SYNC_DATABASE_URL is required");
}
if (!bettingToken) {
  throw new Error("BETTING_FEED_ACCESS_TOKEN is required");
}
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("AGENT_DUEL_BET_SYNC_PORT must be a valid TCP port");
}

type RetainedFrame = {
  seq: number;
  payload: BettingFeedPayload;
  json: string;
};

let runtime: WorkerRuntime | null = null;
let scheduler: StreamingDuelScheduler | null = null;
let shuttingDown = false;
const sourceEpoch = Date.now();
let sequence = 0;
const retainedFrames: RetainedFrame[] = [];

type AuthoritativeBettingSource = {
  cycle: NonNullable<ReturnType<StreamingDuelScheduler["getCurrentCycle"]>>;
  terminal: BettingFeedTerminalOverride | null;
};

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "cache-control": "no-store",
    connection: "close",
    "content-length": Buffer.byteLength(payload),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(payload);
}

function isAuthorized(authorization: string | undefined): boolean {
  return authorization === `Bearer ${bettingToken}`;
}

function getAuthoritativeBettingSource(): AuthoritativeBettingSource | null {
  if (!scheduler) return null;
  const cycle = scheduler.getCurrentCycle();
  if (cycle) return { cycle, terminal: null };
  return scheduler.getDurableBettingTerminal();
}

function captureFrame(): RetainedFrame {
  const source = getAuthoritativeBettingSource();
  if (!source) throw new Error("competitive cycle is not ready");
  const emittedAt = Date.now();
  const payload = buildBettingFeedPayload({
    sourceEpoch,
    seq: sequence + 1,
    emittedAt,
    cycle: source.cycle,
    terminal: source.terminal,
    rendererHealth: {
      ready: true,
      degradedReason: null,
      updatedAt: emittedAt,
    },
  });
  sequence += 1;
  const frame = { seq: sequence, payload, json: JSON.stringify(payload) };
  retainedFrames.push(frame);
  if (retainedFrames.length > 128) retainedFrames.shift();
  return frame;
}

async function initializeDatabase(): Promise<void> {
  const pool = await waitForPostgres(databaseUrl);
  try {
    const migrationClient = await pool.connect();
    try {
      await migrate(createPostgresClientDatabase(migrationClient), {
        migrationsFolder: path.resolve(
          import.meta.dirname,
          "../src/database/migrations",
        ),
      });
    } finally {
      migrationClient.release();
    }

    const existing = await pool.query<{ id: string }>(
      `SELECT id
         FROM characters
        WHERE id = ANY($1::text[])
        ORDER BY id`,
      [[...AGENT_IDS]],
    );
    if (existing.rows.length === 0) {
      await seedAgents(drizzle(pool, { schema }));
    } else if (
      existing.rows.length !== AGENT_IDS.length ||
      existing.rows.some((row) => !AGENT_IDS.includes(row.id as never))
    ) {
      throw new Error("persisted Hyperia E2E contestant set is incomplete");
    }
  } finally {
    await pool.end();
  }
}

async function nextFencingToken(): Promise<string> {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const result = await pool.query<{ maximum: string }>(
      `SELECT COALESCE(MAX("fencingToken"), 0)::text AS maximum
         FROM streaming_duel_preparations`,
    );
    return (BigInt(result.rows[0]?.maximum || "0") + 1n).toString();
  } finally {
    await pool.end();
  }
}

async function hasRecoverableCycle(): Promise<boolean> {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const result = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM streaming_duel_competitive_snapshots
        WHERE "lifecycleStatus" = 'frozen'`,
    );
    return result.rows[0]?.count === "1";
  } finally {
    await pool.end();
  }
}

async function initializeRuntime(): Promise<void> {
  await initializeDatabase();
  const recoverableCycle = await hasRecoverableCycle();
  runtime = await startWorkerRuntime(databaseUrl);
  scheduler = new StreamingDuelScheduler(runtime.world, {
    fencingToken: await nextFencingToken(),
  });
  scheduler.init();

  if (recoverableCycle) {
    await waitFor(
      () => {
        const source = getAuthoritativeBettingSource();
        return Boolean(
          source &&
          (source.cycle.phase === "ANNOUNCEMENT" ||
            source.terminal?.outcome === "cancelled"),
        );
      },
      "persisted Hyperia betting cycle or terminal recovery",
      60_000,
    );
  } else {
    await openPersistedCycle(runtime, scheduler);
  }

  await waitFor(() => {
    const source = getAuthoritativeBettingSource();
    const cycle = source?.cycle;
    const activeAnnouncementReady =
      cycle?.phase === "ANNOUNCEMENT" && Boolean(cycle.arenaPositions);
    const terminalCancellationReady = source?.terminal?.outcome === "cancelled";
    return Boolean(
      cycle &&
      (activeAnnouncementReady || terminalCancellationReady) &&
      cycle.competitiveSnapshot?.persisted === true &&
      cycle.competitiveSnapshot.diagnostic === false &&
      cycle.competitiveSnapshotDigest &&
      cycle.duelId &&
      cycle.duelKeyHex,
    );
  }, "production-owned Hyperia betting feed readiness");
}

await initializeRuntime();

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${port}`);

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    const source = getAuthoritativeBettingSource();
    const cycle = scheduler?.getCurrentCycle() ?? null;
    const authoritativeCycle = source?.cycle ?? null;
    sendJson(response, authoritativeCycle ? 200 : 503, {
      ready: Boolean(authoritativeCycle),
      sourceEpoch,
      duelId: authoritativeCycle?.duelId ?? null,
      duelKeyHex: authoritativeCycle?.duelKeyHex ?? null,
      snapshotDigest: authoritativeCycle?.competitiveSnapshotDigest ?? null,
      phase: cycle?.phase ?? null,
      outcome: source?.terminal?.outcome ?? cycle?.outcome ?? null,
      cancellationReason: source?.terminal?.cancellationReason ?? null,
      competitiveSnapshotPersisted:
        authoritativeCycle?.competitiveSnapshot?.persisted ?? false,
      competitiveSnapshotDiagnostic:
        authoritativeCycle?.competitiveSnapshot?.diagnostic ?? null,
    });
    return;
  }

  if (
    request.method === "GET" &&
    requestUrl.pathname === "/api/streaming/state"
  ) {
    sendJson(response, 200, {
      cycle: scheduler?.getStreamingState().cycle ?? null,
    });
    return;
  }

  if (
    request.method === "GET" &&
    requestUrl.pathname === "/api/internal/bet-sync/state"
  ) {
    if (!isAuthorized(request.headers.authorization)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    try {
      sendJson(response, 200, captureFrame().payload);
    } catch {
      sendJson(response, 503, { error: "Betting feed unavailable" });
    }
    return;
  }

  if (
    request.method === "GET" &&
    requestUrl.pathname === "/api/internal/bet-sync/events"
  ) {
    if (!isAuthorized(request.headers.authorization)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    const since = Number.parseInt(
      requestUrl.searchParams.get("since") || "0",
      10,
    );
    const oldest = retainedFrames[0]?.seq ?? sequence;
    const frames = retainedFrames.filter((frame) => frame.seq > since);
    response.writeHead(200, {
      "cache-control": "no-cache, no-transform",
      connection: "close",
      "content-type": "text/event-stream; charset=utf-8",
    });
    if (since > 0 && since < oldest - 1 && retainedFrames.length > 0) {
      const latest = retainedFrames[retainedFrames.length - 1]!;
      response.write(
        `id: ${latest.seq}\nevent: reset\ndata: ${latest.json}\n\n`,
      );
    } else {
      for (const frame of frames) {
        response.write(
          `id: ${frame.seq}\nevent: betting\ndata: ${frame.json}\n\n`,
        );
      }
    }
    response.end();
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () => {
  const cycle = getAuthoritativeBettingSource()?.cycle;
  process.stdout.write(
    `${JSON.stringify({
      event: "ready",
      port,
      sourceEpoch,
      duelId: cycle?.duelId,
      duelKeyHex: cycle?.duelKeyHex,
      snapshotDigest: cycle?.competitiveSnapshotDigest,
    })}\n`,
  );
});

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (scheduler) {
    scheduler.destroy("scheduler_shutdown");
    await scheduler.waitForShutdownCleanup().catch(() => undefined);
  }
  if (runtime) await stopWorkerRuntime(runtime).catch(() => undefined);
}

process.once("SIGINT", () => void shutdown().then(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown().then(() => process.exit(0)));
