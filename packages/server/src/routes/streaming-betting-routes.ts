import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RateLimitOptions } from "@fastify/rate-limit";
import type { DatabaseSystem } from "../systems/DatabaseSystem/index.js";
import type { World } from "@hyperforge/shared";
import { getStreamingDuelScheduler } from "../systems/StreamingDuelScheduler/index.js";
import type { StreamingDuelCycle } from "../systems/StreamingDuelScheduler/types.js";
import { storage } from "../database/schema.js";
import {
  BETTING_FEED_SCHEMA_VERSION,
  BETTING_SOURCE_EPOCH_STORAGE_KEY,
  buildBettingFeedDedupKey,
  buildBettingFeedPayload,
  selectReplayDelivery,
  type BettingFeedFrame,
  type BettingFeedRendererHealth,
} from "./streaming-betting-feed.js";
import {
  extractBettingFeedToken,
  hasValidBettingFeedToken,
  resolveBettingFeedAccessToken,
  shouldSkipBettingFeedAuth,
} from "./streaming-betting-auth.js";
import { trimReplayFrames } from "./streaming-sse-buffer.js";
import { deriveBettingRendererHealth } from "./streaming-betting-health.js";
import { acquireExternalStatusPoller } from "./streaming-external-status.js";

// Re-exports so existing consumers (streaming.ts, tests) don't need import changes.
export { deriveBettingRendererHealth } from "./streaming-betting-health.js";
export {
  loadExternalRtmpStatusSnapshot,
  parseExternalRtmpStatusSnapshot,
} from "./streaming-external-status.js";

type RegisterStreamingBettingRoutesOptions = {
  fastify: FastifyInstance;
  world: World;
  replayBuffer: number;
  replayMaxBytes: number;
  pushIntervalMs: number;
  heartbeatMs: number;
  maxPendingBytes: number;
  maxClients: number;
  bootstrapRateLimit: RateLimitOptions;
  eventsRateLimit: RateLimitOptions;
  internalAllowedOrigin: string | null;
  externalStatusFile: string | null;
  externalStatusMaxAgeMs: number;
  getStreamingDuelScheduler?: typeof getStreamingDuelScheduler;
  getStreamCaptureStats?: () => {
    clientConnected: boolean;
    ffmpegRunning: boolean;
  };
};

type BettingRouteMetrics = {
  schemaVersion: number;
  sourceEpoch: number;
  clients: {
    connected: number;
  };
  replay: {
    size: number;
    totalBytes: number;
    oldestSeq: number | null;
    latestSeq: number | null;
    lastBroadcastSeq: number;
  };
};

type SseSendStatus = "ok" | "closed" | "slow" | "error";

type DatabaseSystemLike = Pick<DatabaseSystem, "getDb">;

type BettingClientIdAllocation = {
  clientId: number;
  nextCursor: number;
};

function formatSseEvent(event: string, data: string, id?: number): string {
  const normalizedData = data.replace(/\n/g, "\ndata: ");
  const idLine = typeof id === "number" ? `id: ${id}\n` : "";
  return `${idLine}event: ${event}\ndata: ${normalizedData}\n\n`;
}

export function normalizeInternalAllowedOrigin(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "*" || trimmed === "null") {
    return null;
  }
  if (trimmed.includes(",")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (
      parsed.pathname !== "/" ||
      parsed.search.length > 0 ||
      parsed.hash.length > 0
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function parseReplayCursor(
  request: FastifyRequest<{ Querystring: { since?: string } }>,
): number {
  const headerLastEventId = request.headers["last-event-id"];
  const normalizedHeaderId = Array.isArray(headerLastEventId)
    ? headerLastEventId[0]
    : headerLastEventId;
  const querySince = Number.parseInt(request.query.since || "", 10);
  const headerSince = Number.parseInt(normalizedHeaderId || "", 10);
  return Number.isFinite(headerSince)
    ? headerSince
    : Number.isFinite(querySince)
      ? querySince
      : 0;
}

export function allocateNextBettingClientId(
  nextCursor: number,
  activeClientIds: Iterable<number>,
): BettingClientIdAllocation {
  const activeIds = new Set(activeClientIds);
  const maxClientId = Number.MAX_SAFE_INTEGER - 1;
  let clientId = nextCursor;
  let wrapped = false;

  while (activeIds.has(clientId)) {
    clientId += 1;
    if (clientId > maxClientId) {
      clientId = 1;
      wrapped = true;
    }
    if (wrapped && clientId === nextCursor) {
      throw new Error("No betting SSE client ids available");
    }
  }

  const nextId = clientId >= maxClientId ? 1 : clientId + 1;
  return {
    clientId,
    nextCursor: nextId,
  };
}

export function registerStreamingBettingRoutes(
  options: RegisterStreamingBettingRoutesOptions,
): {
  close(): void;
  getMetrics(): BettingRouteMetrics;
} {
  const {
    fastify,
    world,
    replayBuffer,
    replayMaxBytes,
    pushIntervalMs,
    heartbeatMs,
    maxPendingBytes,
    maxClients,
    bootstrapRateLimit,
    eventsRateLimit,
    internalAllowedOrigin,
    externalStatusFile,
    externalStatusMaxAgeMs,
    getStreamingDuelScheduler: getStreamingDuelSchedulerOverride,
    getStreamCaptureStats,
  } = options;

  const tokenResolution = resolveBettingFeedAccessToken(process.env);
  const skipAuth = shouldSkipBettingFeedAuth(process.env);
  const allowedOrigin = normalizeInternalAllowedOrigin(internalAllowedOrigin);
  const viewerTokenConfigured = Boolean(
    process.env.STREAMING_VIEWER_ACCESS_TOKEN?.trim(),
  );
  const getScheduler =
    getStreamingDuelSchedulerOverride ?? getStreamingDuelScheduler;
  const externalStatusPoller = acquireExternalStatusPoller(
    externalStatusFile,
    externalStatusMaxAgeMs,
  );
  if (!tokenResolution.token && process.env.NODE_ENV === "production") {
    fastify.log.warn(
      "BETTING_FEED_ACCESS_TOKEN is unset in production; internal betting feed will fail closed",
    );
  } else if (!tokenResolution.token && skipAuth) {
    fastify.log.warn(
      "BETTING_FEED_SKIP_AUTH=true with no betting-feed token configured; internal betting feed auth bypass is enabled for development use only",
    );
  } else if (!tokenResolution.token && viewerTokenConfigured) {
    fastify.log.warn(
      "STREAMING_VIEWER_ACCESS_TOKEN is configured but is no longer accepted for internal betting feed auth; set BETTING_FEED_ACCESS_TOKEN instead",
    );
  } else if (!tokenResolution.token) {
    fastify.log.warn(
      "BETTING_FEED_ACCESS_TOKEN is unset; internal betting feed will fail closed unless BETTING_FEED_SKIP_AUTH=true is set in development",
    );
  } else if (viewerTokenConfigured) {
    fastify.log.info(
      "STREAMING_VIEWER_ACCESS_TOKEN remains separate from internal betting feed auth; BETTING_FEED_ACCESS_TOKEN is the canonical betting secret",
    );
  }
  if (internalAllowedOrigin && !allowedOrigin) {
    fastify.log.warn(
      {
        configuredOrigin: internalAllowedOrigin,
      },
      "Ignoring invalid INTERNAL_BET_SYNC_ALLOWED_ORIGIN; expected one explicit http(s) origin with no path, query, or hash",
    );
  }

  const bettingClients = new Map<number, FastifyReply>();
  const bettingReplayFrames: BettingFeedFrame[] = [];
  let bettingReplayFramesTotalBytes = 0;
  let bettingSequence = 0;
  let lastSerializedBettingState = "";
  let lastBettingBroadcastSeq = 0;
  let bettingPushInterval: ReturnType<typeof setInterval> | null = null;
  let bettingHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let bettingSourceEpoch = Date.now();
  let bettingSourceEpochInit: Promise<number> | null = null;
  let bettingSourceEpochReady = false;
  let nextBettingClientId = 1;
  let closed = false;

  const writeSseMessage = (
    reply: FastifyReply,
    message: string,
  ): SseSendStatus => {
    const raw = reply.raw;
    if (raw.destroyed || raw.writableEnded || !raw.writable) {
      return "closed";
    }
    if (raw.writableLength > maxPendingBytes) {
      return "slow";
    }

    try {
      raw.write(message);
      return "ok";
    } catch {
      return "error";
    }
  };

  const writeSseEvent = (
    reply: FastifyReply,
    event: string,
    data: string,
    id?: number,
  ): SseSendStatus => writeSseMessage(reply, formatSseEvent(event, data, id));

  const clearBettingLoops = (): void => {
    if (bettingPushInterval) {
      clearInterval(bettingPushInterval);
      bettingPushInterval = null;
    }
    if (bettingHeartbeatInterval) {
      clearInterval(bettingHeartbeatInterval);
      bettingHeartbeatInterval = null;
    }
  };

  const closeRoutes = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    clearBettingLoops();
    externalStatusPoller?.release();
    for (const clientId of [...bettingClients.keys()]) {
      removeBettingClient(clientId);
    }
  };

  const removeBettingClient = (clientId: number): void => {
    const clientReply = bettingClients.get(clientId);
    if (!clientReply) return;

    bettingClients.delete(clientId);
    try {
      if (!clientReply.raw.writableEnded) {
        clientReply.raw.end();
      }
    } catch {
      // ignore socket close errors
    }

    if (bettingClients.size === 0) {
      clearBettingLoops();
    }
  };

  const getDatabaseSystem = (): DatabaseSystemLike | null =>
    (world.getSystem("database") ?? null) as DatabaseSystemLike | null;

  const persistBettingSourceEpoch = async (epoch: number): Promise<void> => {
    const db = getDatabaseSystem()?.getDb?.();
    if (!db) return;

    const value = JSON.stringify({
      sourceEpoch: epoch,
      updatedAt: Date.now(),
    });
    try {
      await db
        .insert(storage)
        .values({
          key: BETTING_SOURCE_EPOCH_STORAGE_KEY,
          value,
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: storage.key,
          set: {
            value,
            updatedAt: Date.now(),
          },
        });
    } catch {
      // Best-effort durability only.
    }
  };

  const ensureBettingSourceEpoch = async (): Promise<number> => {
    if (bettingSourceEpochReady) {
      return bettingSourceEpoch;
    }
    if (bettingSourceEpochInit) {
      return bettingSourceEpochInit;
    }

    bettingSourceEpochInit = (async () => {
      const db = getDatabaseSystem()?.getDb?.();
      if (!db) {
        return bettingSourceEpoch;
      }

      try {
        const rows = await db
          .select()
          .from(storage)
          .where(eq(storage.key, BETTING_SOURCE_EPOCH_STORAGE_KEY))
          .limit(1);
        const rawValue = rows[0]?.value ?? "";
        let parsedEpoch = Number.NaN;
        try {
          const parsed = JSON.parse(rawValue) as {
            sourceEpoch?: number;
          };
          parsedEpoch = Number(parsed?.sourceEpoch);
        } catch {
          // Stored value is not valid JSON — fall through to Date.now().
        }

        bettingSourceEpoch = Number.isFinite(parsedEpoch)
          ? Math.max(parsedEpoch + 1, Date.now())
          : Date.now();
        await persistBettingSourceEpoch(bettingSourceEpoch);
      } catch {
        bettingSourceEpoch = Date.now();
      }

      bettingSourceEpochReady = true;
      return bettingSourceEpoch;
    })();

    return bettingSourceEpochInit;
  };

  const currentRendererHealthSnapshot = (
    cycle: StreamingDuelCycle | null,
    nowMs?: number,
  ): BettingFeedRendererHealth =>
    deriveBettingRendererHealth(cycle, {
      externalStatusSnapshot: externalStatusPoller?.getSnapshot() ?? null,
      externalStatusMaxAgeMs,
      nowMs,
      captureStats: getStreamCaptureStats?.() ?? undefined,
    });

  const captureBettingFrame = (
    forceNewFrame = false,
  ): BettingFeedFrame | null => {
    const scheduler = getScheduler();
    const cycle = scheduler?.getCurrentCycle() ?? null;
    const nextSeq = bettingSequence + 1;
    const emittedAt = Date.now();
    const rendererHealth = currentRendererHealthSnapshot(cycle, emittedAt);
    const payload = buildBettingFeedPayload({
      sourceEpoch: bettingSourceEpoch,
      seq: nextSeq,
      emittedAt,
      cycle,
      rendererHealth,
    });
    const dedupKey = buildBettingFeedDedupKey(payload);

    if (
      !forceNewFrame &&
      dedupKey === lastSerializedBettingState &&
      bettingReplayFrames.length > 0
    ) {
      return null;
    }

    lastSerializedBettingState = dedupKey;
    bettingSequence = nextSeq;
    const payloadJson = JSON.stringify(payload);

    const frame: BettingFeedFrame = {
      seq: nextSeq,
      emittedAt: payload.emittedAt,
      payload,
      payloadJson,
      payloadBytes: Buffer.byteLength(payloadJson, "utf8"),
    };

    bettingReplayFrames.push(frame);
    bettingReplayFramesTotalBytes += frame.payloadBytes;
    bettingReplayFramesTotalBytes = trimReplayFrames(
      bettingReplayFrames,
      bettingReplayFramesTotalBytes,
      {
        maxFrames: replayBuffer,
        maxBytes: replayMaxBytes,
      },
    );

    return frame;
  };

  const startBettingLoopsIfNeeded = (): void => {
    if (bettingPushInterval) return;

    lastBettingBroadcastSeq =
      bettingReplayFrames[bettingReplayFrames.length - 1]?.seq ?? 0;

    bettingPushInterval = setInterval(() => {
      const frame = captureBettingFrame(false);
      if (!frame) return;

      for (const [clientId, clientReply] of bettingClients.entries()) {
        const status = writeSseEvent(
          clientReply,
          "betting",
          frame.payloadJson,
          frame.seq,
        );
        if (status !== "ok") {
          removeBettingClient(clientId);
          continue;
        }
      }
      lastBettingBroadcastSeq = frame.seq;
    }, pushIntervalMs);

    bettingHeartbeatInterval = setInterval(() => {
      const heartbeatMessage = `:hb ${Date.now()}\n\n`;
      for (const [clientId, clientReply] of bettingClients.entries()) {
        const status = writeSseMessage(clientReply, heartbeatMessage);
        if (status === "ok") {
          continue;
        }
        removeBettingClient(clientId);
      }
    }, heartbeatMs);
  };

  const assertBettingAuth = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<boolean> => {
    const requiredToken = resolveBettingFeedAccessToken(process.env).token;
    if (!requiredToken) {
      if (process.env.NODE_ENV === "production" || !skipAuth) {
        reply.status(503).send({
          error: "Service unavailable",
          message: "Betting feed auth token is not configured",
        });
        return false;
      }
      return true;
    }

    const token = extractBettingFeedToken({
      authorizationHeader: request.headers.authorization,
    });

    if (hasValidBettingFeedToken(requiredToken, token)) {
      return true;
    }

    reply.status(401).send({
      error: "Unauthorized",
      message: "Missing or invalid betting feed token",
    });
    return false;
  };

  const buildBettingBootstrapResponse = (frame: BettingFeedFrame | null) => {
    const fallbackEmittedAt = Date.now();
    const fallbackPayload = buildBettingFeedPayload({
      sourceEpoch: bettingSourceEpoch,
      seq: bettingSequence,
      emittedAt: fallbackEmittedAt,
      cycle: null,
      rendererHealth: currentRendererHealthSnapshot(null, fallbackEmittedAt),
    });

    return {
      ...(frame?.payload ?? fallbackPayload),
      schemaVersion: BETTING_FEED_SCHEMA_VERSION,
      sourceEpoch: bettingSourceEpoch,
      seq: frame?.seq ?? bettingSequence,
      emittedAt: frame?.emittedAt ?? fallbackEmittedAt,
      replay: {
        sourceEpoch: bettingSourceEpoch,
        latestSeq:
          bettingReplayFrames[bettingReplayFrames.length - 1]?.seq ?? null,
        oldestSeq: bettingReplayFrames[0]?.seq ?? null,
        bufferedFrames: bettingReplayFrames.length,
        bufferedBytes: bettingReplayFramesTotalBytes,
        lastBroadcastSeq: lastBettingBroadcastSeq,
      },
    };
  };

  const bettingBootstrapAuthPreHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!(await assertBettingAuth(request, reply))) {
      return;
    }
  };

  const bettingEventsAuthPreHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!(await assertBettingAuth(request, reply))) {
      return;
    }
  };

  const handleBettingBootstrap = async (
    _request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const scheduler = getScheduler();
    if (!scheduler) {
      return reply.status(503).send({
        error: "Streaming mode not active",
        message: "The streaming duel scheduler is not running",
      });
    }

    await ensureBettingSourceEpoch();
    if (bettingReplayFrames.length === 0) {
      captureBettingFrame(true);
    }

    return reply.send(
      buildBettingBootstrapResponse(
        bettingReplayFrames[bettingReplayFrames.length - 1] ?? null,
      ),
    );
  };

  const handleBettingEvents = async (
    request: FastifyRequest<{ Querystring: { since?: string } }>,
    reply: FastifyReply,
  ) => {
    const scheduler = getScheduler();
    if (!scheduler) {
      return reply.status(503).send({
        error: "Streaming mode not active",
        message: "The streaming duel scheduler is not running",
      });
    }

    await ensureBettingSourceEpoch();
    if (bettingReplayFrames.length === 0) {
      captureBettingFrame(true);
    }

    if (bettingClients.size >= maxClients) {
      return reply.status(503).send({
        error: "Bet sync SSE capacity reached",
        message: "Too many concurrent betting SSE clients",
      });
    }

    const raw = reply.raw;
    reply.hijack();

    raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    raw.setHeader("Cache-Control", "no-cache, no-transform");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("X-Accel-Buffering", "no");
    if (allowedOrigin) {
      raw.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    }
    raw.socket?.setNoDelay?.(true);
    raw.socket?.setKeepAlive?.(true, heartbeatMs * 2);
    raw.flushHeaders?.();
    raw.write("retry: 2000\n\n");

    const allocation = allocateNextBettingClientId(
      nextBettingClientId,
      bettingClients.keys(),
    );
    nextBettingClientId = allocation.nextCursor;
    const clientId = allocation.clientId;
    bettingClients.set(clientId, reply);

    const delivery = selectReplayDelivery(
      bettingReplayFrames,
      parseReplayCursor(request),
    );
    if (delivery.mode === "reset") {
      const status = writeSseEvent(
        reply,
        "reset",
        delivery.latestFrame.payloadJson,
        delivery.latestFrame.seq,
      );
      if (status !== "ok") {
        removeBettingClient(clientId);
        return;
      }
    } else if (delivery.frames.length > 0) {
      for (const frame of delivery.frames) {
        const status = writeSseEvent(
          reply,
          "betting",
          frame.payloadJson,
          frame.seq,
        );
        if (status !== "ok") {
          removeBettingClient(clientId);
          return;
        }
      }
    } else if (delivery.mode === "bootstrap" && delivery.latestFrame) {
      const status = writeSseEvent(
        reply,
        "betting",
        delivery.latestFrame.payloadJson,
        delivery.latestFrame.seq,
      );
      if (status !== "ok") {
        removeBettingClient(clientId);
        return;
      }
    }

    request.raw.on("close", () => {
      removeBettingClient(clientId);
    });

    startBettingLoopsIfNeeded();
  };

  // Legacy compatibility alias. Canonical internal betting bootstrap route:
  // /api/internal/bet-sync/state
  fastify.get(
    "/api/streaming/betting/bootstrap",
    {
      config: { rateLimit: bootstrapRateLimit },
      preHandler: bettingBootstrapAuthPreHandler,
    },
    handleBettingBootstrap,
  );

  // Canonical internal betting bootstrap route.
  fastify.get(
    "/api/internal/bet-sync/state",
    {
      config: { rateLimit: bootstrapRateLimit },
      preHandler: bettingBootstrapAuthPreHandler,
    },
    handleBettingBootstrap,
  );

  // Legacy compatibility alias. Canonical internal betting SSE route:
  // /api/internal/bet-sync/events
  fastify.get<{
    Querystring: { since?: string };
  }>(
    "/api/streaming/betting/events",
    {
      config: { rateLimit: eventsRateLimit },
      preHandler: bettingEventsAuthPreHandler,
    },
    handleBettingEvents,
  );

  // Canonical internal betting SSE route.
  fastify.get<{
    Querystring: { since?: string };
  }>(
    "/api/internal/bet-sync/events",
    {
      config: { rateLimit: eventsRateLimit },
      preHandler: bettingEventsAuthPreHandler,
    },
    handleBettingEvents,
  );

  fastify.addHook("onClose", async () => {
    closeRoutes();
  });

  return {
    close(): void {
      closeRoutes();
    },
    getMetrics(): BettingRouteMetrics {
      return {
        schemaVersion: BETTING_FEED_SCHEMA_VERSION,
        sourceEpoch: bettingSourceEpoch,
        clients: {
          connected: bettingClients.size,
        },
        replay: {
          size: bettingReplayFrames.length,
          totalBytes: bettingReplayFramesTotalBytes,
          oldestSeq: bettingReplayFrames[0]?.seq ?? null,
          latestSeq:
            bettingReplayFrames[bettingReplayFrames.length - 1]?.seq ?? null,
          lastBroadcastSeq: lastBettingBroadcastSeq,
        },
      };
    },
  };
}
