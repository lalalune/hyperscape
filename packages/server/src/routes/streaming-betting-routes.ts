import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RateLimitOptions } from "@fastify/rate-limit";
import type { DatabaseSystem } from "../systems/DatabaseSystem/index.js";
import type { World } from "@hyperscape/shared";
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
  type BettingFeedRendererMetrics,
  type BettingFeedRendererHealth,
} from "./streaming-betting-feed.js";
import {
  assertSafeBettingFeedAuthConfig,
  extractBettingFeedToken,
  hasValidBettingFeedToken,
  resolveBettingFeedAccessToken,
  shouldSkipBettingFeedAuth,
} from "./streaming-betting-auth.js";
import { trimReplayFrames } from "./streaming-sse-buffer.js";
import { deriveBettingRendererHealth } from "./streaming-betting-health.js";
import {
  acquireExternalStatusPoller,
  type ExternalRtmpDestination,
  type ExternalRtmpStatusSnapshot,
} from "./streaming-external-status.js";
import { deriveStreamSourceRuntime } from "./streaming-source-runtime.js";
import { acquirePlaybackProbePoller } from "../streaming/destination-probe.js";
import {
  buildStreamDestinationId,
  inferStreamDeliveryTransport,
  normalizeStreamDestinationProvider,
  resolveExternalStreamDeliveryInfo,
  resolveSelfHostedStreamPlaybackUrl,
  resolveStreamCanonicalProviderPriority,
  resolveStreamDeliveryInfo,
  resolveStreamFailbackSoakMs,
  resolveStreamPresentationDelayMs,
  type StreamCanonicalProvider,
  type StreamChannelState,
  type StreamDestinationState,
  type StreamManifestStatus,
  type StreamPublicReadiness,
} from "../streaming/delivery-config.js";
import type { StreamSourceRuntime } from "../streaming/source-runtime.js";
import { readLocalHlsManifestSnapshot } from "../streaming/stream-status-artifacts.js";
import {
  loadPersistedStreamingAuthorityState,
  persistCloudflareLifecyclePollState,
  persistCloudflarePlaybackProbeState,
  persistCloudflareReconciliationState,
  persistCanonicalProviderState,
  persistCloudflareLifecycleState,
  persistCloudflareWebhookState,
  reconcileCloudflareAuthority,
  summarizeCloudflareLiveWebhook,
  verifyCloudflareWebhookSecret,
  type PersistedCanonicalProviderState,
  type PersistedCloudflareLifecyclePollState,
  type PersistedCloudflarePlaybackProbeState,
  type PersistedCloudflareReconciliationState,
  type PersistedStreamingAuthorityState,
} from "../streaming/cloudflare-authority.js";

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

type CanonicalCandidateState = {
  provider: StreamCanonicalProvider;
  destination: StreamDestinationState;
  publicReadiness: StreamPublicReadiness;
  ready: boolean;
};

type CurrentChannelSnapshot = {
  channel: StreamChannelState;
  canonicalAuthority: PersistedCloudflareReconciliationState | null;
};

type CanonicalProviderSelectionState = {
  activeProvider: StreamCanonicalProvider | null;
  primaryHealthySince: number | null;
};

const REQUIRE_EXTERNAL_SOURCE_RUNTIME =
  process.env.STREAM_SOURCE_RUNTIME_REQUIRE_EXTERNAL === "true" ||
  process.env.NODE_ENV === "production";
const CLOUDFLARE_WEBHOOK_RATE_LIMIT: RateLimitOptions = {
  max: 180,
  timeWindow: "1 minute",
};
type SseSendStatus = "ok" | "closed" | "slow" | "error";
type RateLimitedFastify = FastifyInstance & {
  rateLimit: NonNullable<FastifyInstance["rateLimit"]>;
};

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

function automaticFailoverEnabled(): boolean {
  return process.env.STREAM_ENABLE_AUTOMATIC_FAILOVER === "true";
}

function ensureRateLimitDecorator(
  fastify: FastifyInstance,
): asserts fastify is RateLimitedFastify {
  if (typeof fastify.rateLimit === "function") {
    return;
  }
  throw new Error(
    "Streaming betting routes require @fastify/rate-limit to be registered before route setup",
  );
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
  let clientId =
    Number.isSafeInteger(nextCursor) &&
    nextCursor >= 1 &&
    nextCursor <= maxClientId
      ? nextCursor
      : 1;
  let wrapped = false;
  let attempts = 0;
  const maxAttempts = activeIds.size + 1;

  while (activeIds.has(clientId)) {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error("No betting SSE client ids available");
    }
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
  ensureRateLimitDecorator(fastify);
  assertSafeBettingFeedAuthConfig(process.env);

  const tokenResolution = resolveBettingFeedAccessToken(process.env);
  const skipAuth = shouldSkipBettingFeedAuth(process.env);
  const allowedOrigin = normalizeInternalAllowedOrigin(internalAllowedOrigin);
  const viewerTokenConfigured = Boolean(
    process.env.STREAMING_VIEWER_ACCESS_TOKEN?.trim(),
  );
  const cloudflareLiveInputId =
    process.env.STREAM_CLOUDFLARE_LIVE_INPUT_ID?.trim() || null;
  const getScheduler =
    getStreamingDuelSchedulerOverride ?? getStreamingDuelScheduler;
  const externalStatusPoller = acquireExternalStatusPoller(
    externalStatusFile,
    externalStatusMaxAgeMs,
  );
  const configuredDelivery = resolveStreamDeliveryInfo(process.env);
  const configuredProviderPriority = resolveStreamCanonicalProviderPriority(
    process.env,
  );
  const configuredFailbackSoakMs = resolveStreamFailbackSoakMs(process.env);
  const configuredPresentationDelayMs = resolveStreamPresentationDelayMs(
    process.env,
    configuredDelivery.mode,
  );
  const configuredSelfHostedPlaybackUrl = resolveSelfHostedStreamPlaybackUrl(
    process.env,
  );
  const configuredCanonicalProvider = normalizeStreamDestinationProvider(
    configuredDelivery.provider,
    "Cloudflare",
  );
  const configuredCanonicalDestinationId = buildStreamDestinationId({
    role: "canonical",
    provider: configuredCanonicalProvider,
    name: "External Delivery",
  });
  const configuredExternalPlaybackUrl = resolveExternalStreamDeliveryInfo(
    process.env,
  ).playbackUrl;
  const externalPlaybackProbePoller = acquirePlaybackProbePoller(
    configuredExternalPlaybackUrl,
    {
      intervalMs: Math.max(2_000, Math.min(externalStatusMaxAgeMs, 5_000)),
      timeoutMs: Math.min(externalStatusMaxAgeMs, 4_000),
    },
  );
  if (!tokenResolution.token && process.env.NODE_ENV === "production") {
    fastify.log.warn(
      "BETTING_FEED_ACCESS_TOKEN is unset in production; internal betting feed will fail closed",
    );
  } else if (!tokenResolution.token && skipAuth) {
    // Log at error severity so the auth-bypass state is impossible to miss
    // even during normal startup log volume.
    fastify.log.error(
      "BETTING_FEED_SKIP_AUTH=true AND NODE_ENV=development — internal betting feed is serving UNAUTHENTICATED. This must never land in production.",
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
  const canonicalProviderSelectionState: CanonicalProviderSelectionState = {
    activeProvider: null,
    primaryHealthySince: null,
  };
  let canonicalProviderSelectionHydrated = false;
  let canonicalProviderSelectionHydration: Promise<void> | null = null;
  // Exponential backoff for failed hydration attempts. Without this, a failing
  // DB causes every betting-feed tick to retry immediately, hammering the
  // backend. Start at 1s and double up to 60s; reset on success.
  let canonicalProviderHydrationFailures = 0;
  let canonicalProviderHydrationNextAttemptAt = 0;
  const HYDRATION_MIN_BACKOFF_MS = 1_000;
  const HYDRATION_MAX_BACKOFF_MS = 60_000;
  let persistedAuthorityStateCache: PersistedStreamingAuthorityState | null =
    null;
  let lastPersistedCanonicalProviderStateJson: string | null = null;
  let lastPersistedCloudflareLifecyclePollJson: string | null = null;
  let lastPersistedCloudflarePlaybackProbeJson: string | null = null;
  let lastPersistedCloudflareReconciliationJson: string | null = null;
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
    externalPlaybackProbePoller?.release();
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

  const getStorageDb = () => getDatabaseSystem()?.getDb?.();

  const persistCanonicalProviderSelection = (): void => {
    if (!canonicalProviderSelectionHydrated) {
      return;
    }
    const activeProvider =
      canonicalProviderSelectionState.activeProvider === "cloudflare_stream" ||
      canonicalProviderSelectionState.activeProvider === "self_hls"
        ? canonicalProviderSelectionState.activeProvider
        : null;
    const comparisonPayload = JSON.stringify({
      activeProvider,
      primaryHealthySince: canonicalProviderSelectionState.primaryHealthySince,
    });
    if (comparisonPayload === lastPersistedCanonicalProviderStateJson) {
      return;
    }
    lastPersistedCanonicalProviderStateJson = comparisonPayload;
    const state: PersistedCanonicalProviderState = {
      activeProvider,
      primaryHealthySince: canonicalProviderSelectionState.primaryHealthySince,
      updatedAt: Date.now(),
    };
    getPersistedAuthorityState().canonicalProviderState = state;
    void persistCanonicalProviderState(getStorageDb(), state).catch((error) => {
      lastPersistedCanonicalProviderStateJson = null;
      fastify.log.warn(
        {
          err: error,
          activeProvider: state.activeProvider,
        },
        "[streaming-betting] Failed to persist canonical provider state",
      );
    });
  };

  const ensureCanonicalProviderSelectionHydrated = async (): Promise<void> => {
    if (canonicalProviderSelectionHydrated) {
      return;
    }
    if (canonicalProviderSelectionHydration) {
      return canonicalProviderSelectionHydration;
    }
    if (Date.now() < canonicalProviderHydrationNextAttemptAt) {
      // Backoff window from a prior failure is still active; callers see
      // unhydrated state and will retry on their next tick.
      return;
    }

    canonicalProviderSelectionHydration = (async () => {
      try {
        const persisted =
          await loadPersistedStreamingAuthorityState(getStorageDb());
        persistedAuthorityStateCache = persisted;
        const state = persisted.canonicalProviderState;
        if (state) {
          canonicalProviderSelectionState.activeProvider =
            state.activeProvider === "cloudflare_stream" ||
            state.activeProvider === "self_hls"
              ? state.activeProvider
              : null;
          canonicalProviderSelectionState.primaryHealthySince =
            typeof state.primaryHealthySince === "number" &&
            Number.isFinite(state.primaryHealthySince)
              ? state.primaryHealthySince
              : null;
          lastPersistedCanonicalProviderStateJson = JSON.stringify({
            activeProvider: canonicalProviderSelectionState.activeProvider,
            primaryHealthySince:
              canonicalProviderSelectionState.primaryHealthySince,
          });
        }
        lastPersistedCloudflareLifecyclePollJson =
          persisted.cloudflareLifecyclePoll
            ? JSON.stringify(persisted.cloudflareLifecyclePoll)
            : null;
        lastPersistedCloudflarePlaybackProbeJson =
          persisted.cloudflarePlaybackProbe
            ? JSON.stringify(persisted.cloudflarePlaybackProbe)
            : null;
        lastPersistedCloudflareReconciliationJson =
          persisted.cloudflareReconciliation
            ? JSON.stringify(persisted.cloudflareReconciliation)
            : null;
        canonicalProviderSelectionHydrated = true;
        canonicalProviderHydrationFailures = 0;
        canonicalProviderHydrationNextAttemptAt = 0;
      } catch (error) {
        canonicalProviderHydrationFailures += 1;
        const backoff = Math.min(
          HYDRATION_MAX_BACKOFF_MS,
          HYDRATION_MIN_BACKOFF_MS *
            2 ** (canonicalProviderHydrationFailures - 1),
        );
        canonicalProviderHydrationNextAttemptAt = Date.now() + backoff;
        console.warn(
          `[streaming-betting] Failed to hydrate canonical provider selection; retrying in ${backoff}ms (failures=${canonicalProviderHydrationFailures})`,
          error,
        );
      } finally {
        canonicalProviderSelectionHydration = null;
      }
    })();

    return canonicalProviderSelectionHydration;
  };

  void ensureCanonicalProviderSelectionHydrated();

  const getPersistedAuthorityState = (): PersistedStreamingAuthorityState => {
    if (persistedAuthorityStateCache) {
      return persistedAuthorityStateCache;
    }
    persistedAuthorityStateCache = {
      canonicalProviderState: null,
      cloudflareLifecycle: null,
      cloudflareLastWebhook: null,
      cloudflareLifecyclePoll: null,
      cloudflarePlaybackProbe: null,
      cloudflareReconciliation: null,
    };
    return persistedAuthorityStateCache;
  };

  const persistCloudflareLifecyclePollSnapshot = (
    state: PersistedCloudflareLifecyclePollState | null,
  ): void => {
    if (!state) {
      return;
    }
    const comparisonPayload = JSON.stringify(state);
    if (comparisonPayload === lastPersistedCloudflareLifecyclePollJson) {
      return;
    }
    lastPersistedCloudflareLifecyclePollJson = comparisonPayload;
    getPersistedAuthorityState().cloudflareLifecyclePoll = state;
    void persistCloudflareLifecyclePollState(getStorageDb(), state).catch(
      (error) => {
        lastPersistedCloudflareLifecyclePollJson = null;
        fastify.log.warn(
          { err: error },
          "[streaming-betting] Failed to persist Cloudflare lifecycle poll state",
        );
      },
    );
  };

  const persistCloudflarePlaybackProbeSnapshot = (
    state: PersistedCloudflarePlaybackProbeState | null,
  ): void => {
    if (!state) {
      return;
    }
    const comparisonPayload = JSON.stringify(state);
    if (comparisonPayload === lastPersistedCloudflarePlaybackProbeJson) {
      return;
    }
    lastPersistedCloudflarePlaybackProbeJson = comparisonPayload;
    getPersistedAuthorityState().cloudflarePlaybackProbe = state;
    void persistCloudflarePlaybackProbeState(getStorageDb(), state).catch(
      (error) => {
        lastPersistedCloudflarePlaybackProbeJson = null;
        fastify.log.warn(
          { err: error },
          "[streaming-betting] Failed to persist Cloudflare playback probe state",
        );
      },
    );
  };

  const persistCloudflareReconciliationSnapshot = (
    state: PersistedCloudflareReconciliationState,
  ): void => {
    const comparisonPayload = JSON.stringify(state);
    if (comparisonPayload === lastPersistedCloudflareReconciliationJson) {
      return;
    }
    lastPersistedCloudflareReconciliationJson = comparisonPayload;
    getPersistedAuthorityState().cloudflareReconciliation = state;
    void persistCloudflareReconciliationState(getStorageDb(), state).catch(
      (error) => {
        lastPersistedCloudflareReconciliationJson = null;
        fastify.log.warn(
          { err: error },
          "[streaming-betting] Failed to persist Cloudflare reconciliation state",
        );
      },
    );
  };

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
  ): BettingFeedRendererHealth => {
    const localHlsManifest = readLocalHlsManifestSnapshot(process.env);
    return deriveBettingRendererHealth(cycle, {
      externalStatusSnapshot: externalStatusPoller?.getSnapshot() ?? null,
      externalStatusMaxAgeMs,
      nowMs,
      localHlsManifest,
      captureStats: getStreamCaptureStats?.() ?? undefined,
    });
  };

  const currentRendererMetricsSnapshot =
    (): BettingFeedRendererMetrics | null => {
      const metrics = externalStatusPoller?.getSnapshot()?.metrics;
      const hlsManifest =
        externalStatusPoller?.getSnapshot()?.hlsManifest ??
        readLocalHlsManifestSnapshot(process.env);
      const hasHlsManifest =
        typeof hlsManifest?.updatedAt === "number" ||
        typeof hlsManifest?.mediaSequence === "number";
      if (!metrics && !hasHlsManifest) {
        return null;
      }
      return {
        captureFps:
          typeof metrics?.captureFps === "number" ? metrics.captureFps : null,
        encodeFps:
          typeof metrics?.encodeFps === "number" ? metrics.encodeFps : null,
        droppedFrames:
          typeof metrics?.droppedFrames === "number"
            ? metrics.droppedFrames
            : null,
        renderTick:
          typeof metrics?.renderTick === "number" ? metrics.renderTick : null,
        duelStateTick:
          typeof metrics?.duelStateTick === "number"
            ? metrics.duelStateTick
            : null,
        latestFrameAt:
          typeof metrics?.latestFrameAt === "number"
            ? metrics.latestFrameAt
            : null,
        latestRenderTickAt:
          typeof metrics?.latestRenderTickAt === "number"
            ? metrics.latestRenderTickAt
            : null,
        latestDuelStateTickAt:
          typeof metrics?.latestDuelStateTickAt === "number"
            ? metrics.latestDuelStateTickAt
            : null,
        latestVisualChangeAt:
          typeof metrics?.latestVisualChangeAt === "number"
            ? metrics.latestVisualChangeAt
            : null,
        visualChangeAgeMs:
          typeof metrics?.visualChangeAgeMs === "number"
            ? metrics.visualChangeAgeMs
            : null,
        hlsManifest: hasHlsManifest
          ? {
              updatedAt:
                typeof hlsManifest.updatedAt === "number"
                  ? hlsManifest.updatedAt
                  : null,
              mediaSequence:
                typeof hlsManifest.mediaSequence === "number"
                  ? hlsManifest.mediaSequence
                  : null,
            }
          : null,
      };
    };

  const currentSourceRuntimeSnapshot = (
    cycle: StreamingDuelCycle | null,
    nowMs?: number,
    rendererHealth?: BettingFeedRendererHealth | null,
  ): StreamSourceRuntime => {
    const localHlsManifest = readLocalHlsManifestSnapshot(process.env);
    return deriveStreamSourceRuntime({
      externalStatusSnapshot: externalStatusPoller?.getSnapshot() ?? null,
      externalStatusMaxAgeMs,
      rendererHealth:
        rendererHealth ?? currentRendererHealthSnapshot(cycle, nowMs),
      localHlsManifest,
      captureStats: getStreamCaptureStats?.() ?? undefined,
      nowMs,
      requireExternalWorker: REQUIRE_EXTERNAL_SOURCE_RUNTIME,
    });
  };

  const resolveSnapshotUpdatedAt = (
    value: number | null | undefined,
    fallbackUpdatedAt: number,
  ): number => {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : fallbackUpdatedAt;
  };

  const isSnapshotFresh = (
    updatedAt: number | null | undefined,
    nowMs: number,
  ): boolean => {
    return (
      typeof updatedAt === "number" &&
      Number.isFinite(updatedAt) &&
      Math.max(0, nowMs - updatedAt) <= externalStatusMaxAgeMs
    );
  };

  const resolveManifestStatusFromUpdatedAt = (
    updatedAt: number | null | undefined,
    nowMs: number,
  ): StreamManifestStatus => {
    if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) {
      return "missing";
    }
    return isSnapshotFresh(updatedAt, nowMs) ? "ok" : "stale";
  };

  const resolveExternalDeliveryReason = (params: {
    nowMs: number;
    externalSnapshot: ExternalRtmpStatusSnapshot | null;
    destination: ExternalRtmpDestination | null;
    playbackUrl: string | null;
  }): string | null => {
    const probeSnapshot = externalPlaybackProbePoller?.getSnapshot() ?? null;

    if (!params.playbackUrl) {
      return "playback_unconfigured";
    }
    if (!params.externalSnapshot) {
      return "delivery_status_unavailable";
    }

    const snapshotUpdatedAt = resolveSnapshotUpdatedAt(
      params.externalSnapshot.updatedAt,
      params.nowMs,
    );
    if (!isSnapshotFresh(snapshotUpdatedAt, params.nowMs)) {
      return "delivery_status_stale";
    }
    if (
      params.externalSnapshot.active !== true ||
      params.externalSnapshot.ffmpegRunning !== true
    ) {
      return "delivery_pipeline_inactive";
    }
    if (!params.destination) {
      return "delivery_destination_missing";
    }
    if (probeSnapshot?.ready === true) {
      return null;
    }
    if (params.destination.connected !== true) {
      return "delivery_disconnected";
    }
    if (
      params.externalSnapshot.stats?.healthy === false ||
      (typeof params.destination.error === "string" &&
        params.destination.error.trim().length > 0)
    ) {
      return "delivery_unhealthy";
    }
    if (!probeSnapshot) {
      return "delivery_status_unavailable";
    }
    if (probeSnapshot.ready) {
      return null;
    }
    if (probeSnapshot.manifestStatus === "missing") {
      return "manifest_not_ready";
    }
    if (probeSnapshot.manifestStatus === "stale") {
      return "manifest_stale";
    }
    return "delivery_unhealthy";
  };

  const findCanonicalExternalDestination = (
    externalSnapshot: ExternalRtmpStatusSnapshot | null,
  ): ExternalRtmpDestination | null => {
    if (!externalSnapshot) {
      return null;
    }

    const destinations = Array.isArray(externalSnapshot.destinations)
      ? externalSnapshot.destinations
      : [];
    return (
      destinations.find((destination) => destination.role === "canonical") ??
      destinations.find(
        (destination) => destination.id === configuredCanonicalDestinationId,
      ) ??
      destinations.find(
        (destination) =>
          normalizeStreamDestinationProvider(
            destination.provider ?? null,
            destination.name ?? null,
          ) === configuredCanonicalProvider,
      ) ??
      destinations.find((destination) =>
        (destination.name ?? "")
          .trim()
          .toLowerCase()
          .includes("external delivery"),
      ) ??
      null
    );
  };

  const buildSelfHostedDestination = (params: {
    role: "canonical" | "fallback";
    nowMs: number;
  }): StreamDestinationState => {
    const localManifest =
      externalStatusPoller?.getSnapshot()?.hlsManifest ??
      readLocalHlsManifestSnapshot(process.env);
    const manifestUpdatedAt =
      typeof localManifest?.updatedAt === "number" &&
      Number.isFinite(localManifest.updatedAt)
        ? localManifest.updatedAt
        : null;
    const manifestStatus = resolveManifestStatusFromUpdatedAt(
      manifestUpdatedAt,
      params.nowMs,
    );
    const playbackReady = manifestStatus === "ok";

    return {
      id: buildStreamDestinationId({
        role: params.role,
        provider: "self_hls",
        name: "Self-HLS",
      }),
      name: "Self-HLS",
      role: params.role,
      provider: "self_hls",
      transport: "hls",
      playbackUrl: configuredSelfHostedPlaybackUrl,
      ingestUrl: null,
      connected: playbackReady,
      transportHealthy: playbackReady,
      playbackReady,
      manifestStatus,
      lastError: playbackReady
        ? null
        : manifestStatus === "stale"
          ? "manifest_stale"
          : "manifest_not_ready",
      updatedAt: manifestUpdatedAt,
    };
  };

  const buildExternalDeliveryCandidate = (params: {
    role: "canonical" | "fallback";
    nowMs: number;
    sourceRuntime: StreamSourceRuntime;
  }): CanonicalCandidateState | null => {
    if (
      !configuredExternalPlaybackUrl &&
      configuredDelivery.mode !== "external_hls"
    ) {
      return null;
    }
    const externalSnapshot = externalStatusPoller?.getSnapshot() ?? null;
    const externalDestination =
      findCanonicalExternalDestination(externalSnapshot);
    const probeSnapshot = externalPlaybackProbePoller?.getSnapshot() ?? null;
    const playbackUrl =
      externalDestination?.playbackUrl ??
      configuredDelivery.playbackUrl ??
      configuredDelivery.llhlsUrl ??
      configuredDelivery.hlsUrl ??
      null;
    const ingestUrl =
      externalDestination?.ingestUrl ?? configuredDelivery.ingestUrl ?? null;
    const snapshotUpdatedAt = externalSnapshot
      ? resolveSnapshotUpdatedAt(externalSnapshot.updatedAt, params.nowMs)
      : params.nowMs;
    const probeReady = probeSnapshot?.ready === true;
    const destinationConnected =
      externalDestination?.connected === true || probeReady;
    const destinationError =
      typeof externalDestination?.error === "string"
        ? externalDestination.error.trim()
        : null;
    const updatedAt = resolveSnapshotUpdatedAt(
      probeSnapshot?.updatedAt ??
        externalDestination?.startedAt ??
        externalSnapshot?.updatedAt,
      params.nowMs,
    );
    const lastFatalWriteAt =
      typeof externalSnapshot?.captureDiagnostics?.lastFatalWriteError?.at ===
        "number" &&
      Number.isFinite(
        externalSnapshot.captureDiagnostics.lastFatalWriteError.at,
      )
        ? externalSnapshot.captureDiagnostics.lastFatalWriteError.at
        : null;
    const freshestSourceIncidentAt = Math.max(
      lastFatalWriteAt ?? Number.NEGATIVE_INFINITY,
      params.sourceRuntime.workerHeartbeatAt ?? Number.NEGATIVE_INFINITY,
    );
    const contradictorySourceError =
      probeReady &&
      params.sourceRuntime.ready !== true &&
      (!Number.isFinite(freshestSourceIncidentAt) ||
        freshestSourceIncidentAt >= updatedAt);
    const transportHealthy =
      params.sourceRuntime.ready === true &&
      externalSnapshot != null &&
      isSnapshotFresh(snapshotUpdatedAt, params.nowMs) &&
      externalSnapshot.active === true &&
      externalSnapshot.ffmpegRunning === true &&
      externalSnapshot.stats?.healthy !== false &&
      destinationConnected &&
      probeReady &&
      !contradictorySourceError;
    const reason = resolveExternalDeliveryReason({
      nowMs: params.nowMs,
      externalSnapshot,
      destination: externalDestination,
      playbackUrl,
    });

    const publicReadiness: StreamPublicReadiness = {
      ready: reason == null,
      reason,
      updatedAt,
    };

    return {
      provider: "cloudflare_stream",
      destination: {
        id: buildStreamDestinationId({
          role: params.role,
          provider: "cloudflare_stream",
          name: externalDestination?.name ?? "Cloudflare Stream",
        }),
        name: externalDestination?.name ?? "Cloudflare Stream",
        role: params.role,
        provider: externalDestination
          ? normalizeStreamDestinationProvider(
              externalDestination.provider ?? configuredDelivery.provider,
              externalDestination.name ?? "External Delivery",
            )
          : configuredCanonicalProvider,
        transport:
          externalDestination?.transport ??
          inferStreamDeliveryTransport({
            playbackUrl,
            ingestUrl,
          }),
        playbackUrl,
        ingestUrl,
        connected: destinationConnected,
        transportHealthy,
        playbackReady: probeReady,
        manifestStatus:
          probeSnapshot?.manifestStatus ??
          (playbackUrl ? "unknown" : "missing"),
        lastError: probeReady
          ? contradictorySourceError
            ? (params.sourceRuntime.degradedReason ??
              destinationError ??
              reason)
            : null
          : (destinationError ?? probeSnapshot?.lastError ?? reason),
        updatedAt,
      },
      publicReadiness,
      ready: publicReadiness.ready === true,
    };
  };

  const buildSelfHostedCandidate = (params: {
    role: "canonical" | "fallback";
    nowMs: number;
    sourceRuntime: StreamSourceRuntime;
  }): CanonicalCandidateState => {
    const destination = buildSelfHostedDestination({
      role: params.role,
      nowMs: params.nowMs,
    });
    const publicReadiness =
      params.sourceRuntime.ready === true
        ? {
            ready: destination.playbackReady,
            reason: destination.lastError,
            updatedAt: destination.updatedAt,
          }
        : {
            ready: false,
            reason: params.sourceRuntime.degradedReason,
            updatedAt:
              params.sourceRuntime.workerHeartbeatAt ?? destination.updatedAt,
          };

    return {
      provider: "self_hls",
      destination,
      publicReadiness,
      ready: publicReadiness.ready === true,
    };
  };

  const buildCloudflareLifecyclePollSnapshot = (params: {
    nowMs: number;
    externalSnapshot: ExternalRtmpStatusSnapshot | null;
    destination: ExternalRtmpDestination | null;
    playbackUrl: string | null;
  }): PersistedCloudflareLifecyclePollState | null => {
    const persistedAuthority = getPersistedAuthorityState();
    const snapshotUpdatedAt = params.externalSnapshot
      ? resolveSnapshotUpdatedAt(
          params.externalSnapshot.updatedAt,
          params.nowMs,
        )
      : null;
    const probeSnapshot = externalPlaybackProbePoller?.getSnapshot() ?? null;
    const probeUpdatedAt =
      probeSnapshot != null
        ? resolveSnapshotUpdatedAt(probeSnapshot.updatedAt, params.nowMs)
        : null;
    const playbackProbeFresh =
      probeUpdatedAt != null && isSnapshotFresh(probeUpdatedAt, params.nowMs);
    const localIngestHealthy =
      params.externalSnapshot != null &&
      snapshotUpdatedAt != null &&
      isSnapshotFresh(snapshotUpdatedAt, params.nowMs) &&
      params.externalSnapshot.active === true &&
      params.externalSnapshot.ffmpegRunning === true &&
      params.externalSnapshot.stats?.healthy !== false;
    const providerLive = playbackProbeFresh && probeSnapshot?.ready === true;
    let status: PersistedCloudflareLifecyclePollState["status"] = "unknown";
    if (providerLive) {
      status = "connected";
    } else if (playbackProbeFresh && probeSnapshot?.ready === false) {
      status = "disconnected";
    } else if (
      params.externalSnapshot?.stats?.healthy === false ||
      (typeof params.destination?.error === "string" &&
        params.destination.error.trim().length > 0)
    ) {
      status = "errored";
    } else if (params.destination?.connected === false) {
      status = "disconnected";
    } else if (localIngestHealthy) {
      status = "unknown";
    }
    const receivedAt = Math.max(snapshotUpdatedAt ?? 0, probeUpdatedAt ?? 0, 0);
    const normalizedReceivedAt = receivedAt > 0 ? receivedAt : params.nowMs;
    const liveInputId =
      cloudflareLiveInputId ??
      persistedAuthority.cloudflareLifecycle?.liveInputId ??
      persistedAuthority.cloudflareLastWebhook?.liveInputId ??
      null;
    const videoUid =
      persistedAuthority.cloudflareLifecycle?.videoId ??
      persistedAuthority.cloudflareLastWebhook?.videoId ??
      null;

    if (!liveInputId && !params.playbackUrl) {
      return null;
    }

    return {
      liveInputId,
      videoUid,
      status,
      providerLive,
      statusSummary:
        status === "connected"
          ? "connected"
          : playbackProbeFresh && probeSnapshot?.ready === false
            ? (probeSnapshot.lastError ?? probeSnapshot.manifestStatus)
            : typeof params.destination?.error === "string" &&
                params.destination.error.trim().length > 0
              ? params.destination.error.trim()
              : params.externalSnapshot == null
                ? "delivery_status_unavailable"
                : !isSnapshotFresh(normalizedReceivedAt, params.nowMs)
                  ? "delivery_status_stale"
                  : status,
      playbackUrl: params.playbackUrl,
      occurredAt: normalizedReceivedAt,
      receivedAt: normalizedReceivedAt,
    };
  };

  const currentCanonicalAuthoritySnapshot = (params: {
    nowMs: number;
    sourceRuntime: StreamSourceRuntime;
    externalSnapshot: ExternalRtmpStatusSnapshot | null;
    destination: ExternalRtmpDestination | null;
    playbackUrl: string | null;
  }): PersistedCloudflareReconciliationState | null => {
    const lifecyclePollSnapshot = buildCloudflareLifecyclePollSnapshot(params);
    const probeSnapshot = externalPlaybackProbePoller?.getSnapshot() ?? null;
    const playbackProbeSnapshot: PersistedCloudflarePlaybackProbeState | null =
      probeSnapshot
        ? {
            playbackUrl: probeSnapshot.playbackUrl,
            ready: probeSnapshot.ready,
            manifestStatus: probeSnapshot.manifestStatus,
            statusCode: probeSnapshot.statusCode,
            lastError: probeSnapshot.lastError,
            updatedAt: probeSnapshot.updatedAt,
          }
        : null;

    persistCloudflareLifecyclePollSnapshot(lifecyclePollSnapshot);
    persistCloudflarePlaybackProbeSnapshot(playbackProbeSnapshot);

    const persistedAuthority = getPersistedAuthorityState();
    if (
      lifecyclePollSnapshot == null &&
      playbackProbeSnapshot == null &&
      persistedAuthority.cloudflareLifecycle == null &&
      persistedAuthority.cloudflareLifecyclePoll == null &&
      persistedAuthority.cloudflarePlaybackProbe == null
    ) {
      return null;
    }

    const reconciliation = reconcileCloudflareAuthority({
      sourceRuntimeReady: params.sourceRuntime.ready === true,
      lifecycle: persistedAuthority.cloudflareLifecycle,
      lifecyclePoll:
        lifecyclePollSnapshot ?? persistedAuthority.cloudflareLifecyclePoll,
      playbackProbe:
        playbackProbeSnapshot ?? persistedAuthority.cloudflarePlaybackProbe,
      previous: persistedAuthority.cloudflareReconciliation,
      nowMs: params.nowMs,
      freshnessMs: externalStatusMaxAgeMs,
      playbackUrl: params.playbackUrl,
    });
    persistCloudflareReconciliationSnapshot(reconciliation);
    return reconciliation;
  };

  const selectCanonicalCandidate = (params: {
    nowMs: number;
    candidates: CanonicalCandidateState[];
  }): {
    canonical: CanonicalCandidateState;
    fallback: CanonicalCandidateState | null;
  } => {
    if (params.candidates.length === 0) {
      const provider: StreamCanonicalProvider =
        configuredCanonicalProvider === "self_hls"
          ? "self_hls"
          : "cloudflare_stream";
      return {
        canonical: {
          provider,
          destination: {
            id: buildStreamDestinationId({
              role: "canonical",
              provider,
              name: provider === "self_hls" ? "Self-HLS" : "Cloudflare Stream",
            }),
            name: provider === "self_hls" ? "Self-HLS" : "Cloudflare Stream",
            role: "canonical",
            provider,
            transport: inferStreamDeliveryTransport({
              playbackUrl: null,
              ingestUrl: null,
            }),
            playbackUrl: null,
            ingestUrl: null,
            connected: false,
            transportHealthy: false,
            playbackReady: false,
            manifestStatus: "missing",
            lastError: "no_delivery_candidate",
            updatedAt: params.nowMs,
          },
          publicReadiness: {
            ready: false,
            reason: "no_delivery_candidate",
            updatedAt: params.nowMs,
          },
          ready: false,
        },
        fallback: null,
      };
    }

    const candidatesByProvider = new Map(
      params.candidates.map((candidate) => [candidate.provider, candidate]),
    );
    const priority = configuredProviderPriority.filter((provider) =>
      candidatesByProvider.has(provider),
    );
    const primaryProvider = priority[0] ?? null;
    const primaryCandidate =
      primaryProvider != null
        ? (candidatesByProvider.get(primaryProvider) ?? null)
        : null;
    const activeCandidate =
      canonicalProviderSelectionState.activeProvider != null
        ? (candidatesByProvider.get(
            canonicalProviderSelectionState.activeProvider,
          ) ?? null)
        : null;
    const firstReadyCandidate =
      priority
        .map((provider) => candidatesByProvider.get(provider) ?? null)
        .find((candidate) => candidate?.ready === true) ?? null;

    if (!automaticFailoverEnabled()) {
      const cloudflareCandidate =
        candidatesByProvider.get("cloudflare_stream") ?? null;
      const nextCanonical =
        cloudflareCandidate ?? primaryCandidate ?? params.candidates[0];
      canonicalProviderSelectionState.activeProvider = nextCanonical.provider;
      canonicalProviderSelectionState.primaryHealthySince =
        nextCanonical.provider === primaryProvider &&
        nextCanonical.ready === true
          ? params.nowMs
          : null;
      persistCanonicalProviderSelection();

      const fallback =
        priority
          .map((provider) => candidatesByProvider.get(provider) ?? null)
          .find(
            (candidate) =>
              candidate && candidate.provider !== nextCanonical.provider,
          ) ?? null;

      return {
        canonical: nextCanonical,
        fallback,
      };
    }

    let nextCanonical =
      activeCandidate ??
      firstReadyCandidate ??
      primaryCandidate ??
      params.candidates[0];

    if (primaryCandidate?.ready === true) {
      canonicalProviderSelectionState.primaryHealthySince ??= params.nowMs;
    } else {
      canonicalProviderSelectionState.primaryHealthySince = null;
    }

    if (nextCanonical.provider === primaryProvider) {
      if (nextCanonical.ready !== true && firstReadyCandidate) {
        nextCanonical = firstReadyCandidate;
      }
    } else {
      const primaryHealthyForMs =
        canonicalProviderSelectionState.primaryHealthySince == null
          ? 0
          : Math.max(
              0,
              params.nowMs -
                canonicalProviderSelectionState.primaryHealthySince,
            );
      if (
        primaryCandidate?.ready === true &&
        primaryHealthyForMs >= configuredFailbackSoakMs
      ) {
        nextCanonical = primaryCandidate;
      } else if (nextCanonical.ready !== true && firstReadyCandidate) {
        nextCanonical = firstReadyCandidate;
      }
    }

    canonicalProviderSelectionState.activeProvider = nextCanonical.provider;
    persistCanonicalProviderSelection();

    const fallback =
      priority
        .map((provider) => candidatesByProvider.get(provider) ?? null)
        .find(
          (candidate) =>
            candidate && candidate.provider !== nextCanonical.provider,
        ) ?? null;

    return {
      canonical: nextCanonical,
      fallback,
    };
  };

  const buildMirrorDestinations = (params: {
    nowMs: number;
    canonicalDestinationId: string | null;
  }): StreamDestinationState[] => {
    const externalSnapshot = externalStatusPoller?.getSnapshot() ?? null;
    if (!externalSnapshot) {
      return [];
    }

    const snapshotUpdatedAt = resolveSnapshotUpdatedAt(
      externalSnapshot.updatedAt,
      params.nowMs,
    );
    const snapshotFresh = isSnapshotFresh(snapshotUpdatedAt, params.nowMs);
    const baseTransportHealthy =
      snapshotFresh &&
      externalSnapshot.active === true &&
      externalSnapshot.ffmpegRunning === true &&
      externalSnapshot.stats?.healthy !== false;
    const seen = new Set<string>();

    return externalSnapshot.destinations.flatMap((destination) => {
      const provider = normalizeStreamDestinationProvider(
        destination.provider ?? null,
        destination.name ?? null,
      );
      if (
        destination.id === params.canonicalDestinationId ||
        destination.role === "canonical" ||
        (params.canonicalDestinationId != null &&
          provider === configuredCanonicalProvider &&
          ((destination.name ?? "")
            .trim()
            .toLowerCase()
            .includes("external delivery") ||
            destination.id == null))
      ) {
        return [];
      }
      if (destination.role === "fallback" || provider === "self_hls") {
        return [];
      }

      const id =
        destination.id ??
        buildStreamDestinationId({
          role: "mirror",
          provider,
          name: destination.name ?? provider,
        });
      if (seen.has(id)) {
        return [];
      }
      seen.add(id);

      const transportHealthy =
        baseTransportHealthy &&
        destination.connected === true &&
        !(
          typeof destination.error === "string" &&
          destination.error.trim().length > 0
        );
      return [
        {
          id,
          name: destination.name ?? provider,
          role: "mirror",
          provider,
          transport:
            destination.transport ??
            inferStreamDeliveryTransport({
              playbackUrl: destination.playbackUrl ?? null,
              ingestUrl: destination.ingestUrl ?? destination.url ?? null,
            }),
          playbackUrl: destination.playbackUrl ?? null,
          ingestUrl: destination.ingestUrl ?? destination.url ?? null,
          connected: destination.connected === true,
          transportHealthy,
          playbackReady: transportHealthy,
          manifestStatus: "unknown",
          lastError:
            typeof destination.error === "string" &&
            destination.error.trim().length > 0
              ? destination.error.trim()
              : snapshotFresh
                ? null
                : "delivery_status_stale",
          updatedAt: resolveSnapshotUpdatedAt(
            destination.startedAt ?? externalSnapshot.updatedAt,
            params.nowMs,
          ),
        } satisfies StreamDestinationState,
      ];
    });
  };

  const currentChannelSnapshot = (
    cycle: StreamingDuelCycle | null,
    nowMs?: number,
    sourceRuntime?: StreamSourceRuntime,
  ): CurrentChannelSnapshot => {
    const updatedAt = nowMs ?? Date.now();
    const resolvedSourceRuntime =
      sourceRuntime ?? currentSourceRuntimeSnapshot(cycle, updatedAt);
    const externalSnapshot = externalStatusPoller?.getSnapshot() ?? null;
    const externalDestination =
      findCanonicalExternalDestination(externalSnapshot);
    const candidatePool: CanonicalCandidateState[] = [];
    const selfHostedPublicCandidateEnabled =
      configuredDelivery.mode !== "external_hls" ||
      process.env.STREAM_PUBLIC_SELF_HLS_FALLBACK_ENABLED === "true";
    if (selfHostedPublicCandidateEnabled) {
      candidatePool.push(
        buildSelfHostedCandidate({
          role: "canonical",
          nowMs: updatedAt,
          sourceRuntime: resolvedSourceRuntime,
        }),
      );
    }
    const externalCandidate = buildExternalDeliveryCandidate({
      role: "canonical",
      nowMs: updatedAt,
      sourceRuntime: resolvedSourceRuntime,
    });
    if (externalCandidate) {
      candidatePool.push(externalCandidate);
    }
    const { canonical, fallback } = selectCanonicalCandidate({
      nowMs: updatedAt,
      candidates: candidatePool,
    });
    const canonicalAuthority =
      canonical.provider === "cloudflare_stream"
        ? currentCanonicalAuthoritySnapshot({
            nowMs: updatedAt,
            sourceRuntime: resolvedSourceRuntime,
            externalSnapshot,
            destination: externalDestination,
            playbackUrl:
              externalCandidate?.destination.playbackUrl ??
              configuredExternalPlaybackUrl,
          })
        : null;
    const canonicalDestination = canonical.destination;
    const fallbackDestination =
      fallback == null
        ? null
        : fallback.provider === "self_hls"
          ? buildSelfHostedDestination({
              role: "fallback",
              nowMs: updatedAt,
            })
          : (buildExternalDeliveryCandidate({
              role: "fallback",
              nowMs: updatedAt,
              sourceRuntime: resolvedSourceRuntime,
            })?.destination ?? {
              ...fallback.destination,
              id: buildStreamDestinationId({
                role: "fallback",
                provider: "cloudflare_stream",
                name: "Cloudflare Stream",
              }),
              role: "fallback",
            });
    const mirrors = buildMirrorDestinations({
      nowMs: updatedAt,
      canonicalDestinationId: canonicalDestination.id,
    });
    const publicReadiness =
      canonicalAuthority == null
        ? canonical.publicReadiness
        : {
            ready: canonicalAuthority.decision === "ready",
            reason: canonicalAuthority.reason,
            updatedAt: canonicalAuthority.updatedAt,
          };

    return {
      channel: {
        id: "hyperscapes-broadcast-channel",
        mode: "always_on",
        presentationDelayMs: configuredPresentationDelayMs,
        activeDuelId: cycle?.duelId ?? null,
        activeDuelKey: null,
        canonicalDestinationId: canonicalDestination.id,
        fallbackDestinationId: fallbackDestination?.id ?? null,
        publicPlaybackUrl: canonicalDestination.playbackUrl,
        publicReadiness,
        destinations: [
          canonicalDestination,
          ...(fallbackDestination ? [fallbackDestination] : []),
          ...mirrors,
        ],
      },
      canonicalAuthority,
    };
  };

  const buildSerializedBettingFrame = (params: {
    seq: number;
    emittedAt: number;
    cycle: StreamingDuelCycle | null;
  }): BettingFeedFrame => {
    const rendererHealth = currentRendererHealthSnapshot(
      params.cycle,
      params.emittedAt,
    );
    const sourceRuntime = currentSourceRuntimeSnapshot(
      params.cycle,
      params.emittedAt,
      rendererHealth,
    );
    const channelSnapshot = currentChannelSnapshot(
      params.cycle,
      params.emittedAt,
      sourceRuntime,
    );
    const payload = buildBettingFeedPayload({
      sourceEpoch: bettingSourceEpoch,
      seq: params.seq,
      emittedAt: params.emittedAt,
      cycle: params.cycle,
      rendererHealth,
      channel: channelSnapshot.channel,
      canonicalAuthority: channelSnapshot.canonicalAuthority,
      sourceRuntime,
      rendererMetrics: currentRendererMetricsSnapshot(),
    });
    const payloadJson = JSON.stringify(payload);

    return {
      seq: params.seq,
      emittedAt: payload.emittedAt,
      payload,
      payloadJson,
      payloadBytes: Buffer.byteLength(payloadJson, "utf8"),
    };
  };

  const buildCurrentBettingFrame = (params: {
    seq: number;
    emittedAt?: number;
  }): BettingFeedFrame | null => {
    const scheduler = getScheduler();
    if (!scheduler) {
      return null;
    }
    return buildSerializedBettingFrame({
      seq: params.seq,
      emittedAt: params.emittedAt ?? Date.now(),
      cycle: scheduler.getCurrentCycle() ?? null,
    });
  };

  const captureBettingFrame = (
    forceNewFrame = false,
  ): BettingFeedFrame | null => {
    const nextSeq = bettingSequence + 1;
    const frame = buildCurrentBettingFrame({
      seq: nextSeq,
      emittedAt: Date.now(),
    });
    if (!frame) {
      return null;
    }
    const payload = frame.payload;
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
    const currentFrame =
      frame ??
      buildCurrentBettingFrame({
        seq: Math.max(1, bettingSequence),
        emittedAt: Date.now(),
      });
    const fallbackEmittedAt = Date.now();
    const fallbackRendererHealth = currentRendererHealthSnapshot(
      null,
      fallbackEmittedAt,
    );
    const fallbackSourceRuntime = currentSourceRuntimeSnapshot(
      null,
      fallbackEmittedAt,
      fallbackRendererHealth,
    );
    const fallbackPayload = buildBettingFeedPayload({
      sourceEpoch: bettingSourceEpoch,
      seq: bettingSequence,
      emittedAt: fallbackEmittedAt,
      cycle: null,
      rendererHealth: fallbackRendererHealth,
      ...currentChannelSnapshot(null, fallbackEmittedAt, fallbackSourceRuntime),
      sourceRuntime: fallbackSourceRuntime,
      rendererMetrics: currentRendererMetricsSnapshot(),
    });

    return {
      ...(currentFrame?.payload ?? fallbackPayload),
      schemaVersion: BETTING_FEED_SCHEMA_VERSION,
      sourceEpoch: bettingSourceEpoch,
      seq: currentFrame?.seq ?? bettingSequence,
      emittedAt: currentFrame?.emittedAt ?? fallbackEmittedAt,
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
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    if (reply.sent || reply.raw.writableEnded || reply.raw.destroyed) {
      return;
    }

    const scheduler = getScheduler();
    if (!scheduler) {
      return reply.status(503).send({
        error: "Streaming mode not active",
        message: "The streaming duel scheduler is not running",
      });
    }

    await ensureCanonicalProviderSelectionHydrated();
    await ensureBettingSourceEpoch();
    await externalStatusPoller?.refresh();
    await externalPlaybackProbePoller?.refresh();
    const latestFrame =
      captureBettingFrame(false) ??
      buildCurrentBettingFrame({
        seq: Math.max(1, bettingSequence),
        emittedAt: Date.now(),
      }) ??
      bettingReplayFrames[bettingReplayFrames.length - 1] ??
      captureBettingFrame(true);

    if (!latestFrame) {
      request.log.warn(
        {
          bettingSourceEpoch,
          replayFrames: bettingReplayFrames.length,
          bettingSequence,
        },
        "null_bootstrap_frame",
      );
    } else if (
      latestFrame.payload.cycle == null &&
      bettingReplayFrames.length === 0
    ) {
      request.log.warn(
        {
          bettingSourceEpoch,
          replayFrames: bettingReplayFrames.length,
          bettingSequence,
          phase: latestFrame.payload.phase,
        },
        "null_bootstrap_frame",
      );
    }

    return reply.send(buildBettingBootstrapResponse(latestFrame ?? null));
  };

  const handleBettingEvents = async (
    request: FastifyRequest<{ Querystring: { since?: string } }>,
    reply: FastifyReply,
  ) => {
    if (reply.sent || reply.raw.writableEnded || reply.raw.destroyed) {
      return;
    }

    const scheduler = getScheduler();
    if (!scheduler) {
      return reply.status(503).send({
        error: "Streaming mode not active",
        message: "The streaming duel scheduler is not running",
      });
    }

    await ensureCanonicalProviderSelectionHydrated();
    await ensureBettingSourceEpoch();
    await externalStatusPoller?.refresh();
    await externalPlaybackProbePoller?.refresh();
    captureBettingFrame(false);
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

  const handleCloudflareWebhook = async (
    request: FastifyRequest<{ Body: Record<string, unknown> }>,
    reply: FastifyReply,
  ) => {
    const receivedAt = Date.now();
    const summary = summarizeCloudflareLiveWebhook({
      payload: request.body,
      receivedAt,
    });
    if (!summary.webhook.liveInputId) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Cloudflare webhook payload is missing a live input id",
      });
    }
    if (
      cloudflareLiveInputId &&
      summary.webhook.liveInputId !== cloudflareLiveInputId
    ) {
      return reply.status(202).send({
        ok: true,
        ignored: true,
        eventType: summary.webhook.eventType,
        liveInputId: summary.webhook.liveInputId,
        receivedAt,
      });
    }

    try {
      const authorityState = getPersistedAuthorityState();
      authorityState.cloudflareLastWebhook = summary.webhook;
      authorityState.cloudflareLifecycle = summary.lifecycle;
      await Promise.all([
        persistCloudflareWebhookState(getStorageDb(), summary.webhook),
        persistCloudflareLifecycleState(getStorageDb(), summary.lifecycle),
      ]);
    } catch {
      // Best-effort durability only.
    }

    return reply.status(202).send({
      ok: true,
      eventType: summary.webhook.eventType,
      liveInputId: summary.webhook.liveInputId,
      receivedAt,
    });
  };

  const authorizeCloudflareWebhook = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const webhookSecret =
      process.env.STREAM_CLOUDFLARE_WEBHOOK_SECRET?.trim() || null;
    if (!webhookSecret) {
      return reply.status(503).send({
        error: "Cloudflare webhook secret not configured",
        message:
          "Set STREAM_CLOUDFLARE_WEBHOOK_SECRET before enabling the webhook route",
      });
    }

    if (verifyCloudflareWebhookSecret(request.headers, webhookSecret)) {
      return;
    }

    return reply.status(401).send({
      error: "Unauthorized",
      message: "Missing or invalid Cloudflare webhook secret",
    });
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

  // Cloudflare webhook bodies are small JSON events (live-input lifecycle +
  // recording metadata). Cap at 32 KiB and require an object-shaped body.
  // We keep `additionalProperties: true` because Cloudflare evolves the
  // webhook schema on their side and a closed allowlist would break on
  // format updates. Defense-in-depth against injection already happens at:
  //   1. timingSafeEqual shared-secret verification (authorizeCloudflareWebhook)
  //   2. bodyLimit (here)
  //   3. summarizeCloudflareLiveWebhook() — field-by-field allowlist parsing,
  //      so unknown fields never reach downstream persistence
  fastify.post<{
    Body: Record<string, unknown>;
  }>(
    "/api/streaming/cloudflare/webhook",
    {
      bodyLimit: 32 * 1024,
      config: { rateLimit: CLOUDFLARE_WEBHOOK_RATE_LIMIT },
      schema: {
        body: {
          type: "object",
          additionalProperties: true,
        },
      },
      preHandler: authorizeCloudflareWebhook,
    },
    handleCloudflareWebhook,
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
