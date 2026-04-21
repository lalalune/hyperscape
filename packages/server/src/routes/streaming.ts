/**
 * Streaming Mode API Routes
 *
 * Provides endpoints for streaming mode functionality:
 * - Leaderboard data
 * - Current duel state
 * - Streaming configuration
 * - RTMP bridge status
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { RateLimitOptions } from "@fastify/rate-limit";
import type { World } from "@hyperscape/shared";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { createHash } from "node:crypto";
import type { DatabaseSystem } from "../systems/DatabaseSystem/index.js";
import { getStreamingDuelScheduler } from "../systems/StreamingDuelScheduler/index.js";
import {
  STREAMING_TIMING,
  type StreamingPhase,
  type StreamingSourceTimeline,
  type StreamingStateUpdate,
} from "../systems/StreamingDuelScheduler/types.js";
import { peekRTMPBridge } from "../streaming/index.js";
import { getStreamCapture } from "../streaming/stream-capture.js";
import {
  buildStreamDestinationId,
  normalizeStreamDestinationProvider,
  resolveStreamDeliveryInfo,
  type StreamManifestStatus,
} from "../streaming/delivery-config.js";
import type { StreamSourceRuntime } from "../streaming/source-runtime.js";
import { resolveStreamIngestSettings } from "../streaming/ingest-config.js";
import {
  acquirePlaybackProbePoller,
  type StreamPlaybackProbeResult,
} from "../streaming/destination-probe.js";
import {
  loadPersistedStreamingAuthorityState,
  type PersistedStreamingAuthorityState,
} from "../streaming/cloudflare-authority.js";
import {
  extractBettingFeedToken,
  hasValidBettingFeedToken,
  resolveBettingFeedAccessToken,
  resolveOracleProofAccessToken,
} from "./streaming-betting-auth.js";
import {
  readLocalHlsManifestSnapshot,
  resolveExternalStatusFile,
  type HlsManifestSnapshot,
} from "../streaming/stream-status-artifacts.js";
import {
  STREAMING_CANONICAL_PLATFORM,
  STREAMING_PUBLIC_DELAY_DEFAULT_MS,
  STREAMING_PUBLIC_DELAY_MS,
  STREAMING_PUBLIC_DELAY_OVERRIDDEN,
} from "../streaming/streaming-policy.js";
import {
  deriveBettingRendererHealth,
  loadExternalRtmpStatusSnapshot,
  registerStreamingBettingRoutes,
} from "./streaming-betting-routes.js";
import type {
  ExternalCaptureDiagnosticsBlob,
  ExternalRtmpDestination,
  ExternalRtmpStatusSnapshot,
} from "./streaming-external-status.js";
import { deriveStreamSourceRuntime } from "./streaming-source-runtime.js";
import { trimReplayFrames } from "./streaming-sse-buffer.js";
type InventorySnapshotItem = {
  slot: number;
  itemId: string;
  quantity: number;
};

type ThoughtSnapshot = {
  id: string;
  type: string;
  content: string;
  timestamp: number;
};

type StreamingSseFrame = {
  seq: number;
  emittedAt: number;
  payload: string;
  payloadBytes: number;
};

type SseSendStatus = "ok" | "closed" | "slow" | "error";
type SseDropReason =
  | "client-close"
  | "shutdown"
  | "slow-consumer"
  | "write-failed"
  | "closed-socket";

const STREAMING_SSE_REPLAY_BUFFER = Math.max(
  128,
  Math.min(
    8192,
    Number.parseInt(process.env.STREAMING_SSE_REPLAY_BUFFER || "2048", 10),
  ),
);
const STREAMING_SSE_PUSH_INTERVAL_MS = Math.max(
  250,
  Number.parseInt(process.env.STREAMING_SSE_PUSH_INTERVAL_MS || "500", 10),
);
const STREAMING_SSE_HEARTBEAT_MS = Math.max(
  5000,
  Number.parseInt(process.env.STREAMING_SSE_HEARTBEAT_MS || "15000", 10),
);
const STREAMING_SSE_MAX_PENDING_BYTES = Math.max(
  128 * 1024,
  Math.min(
    16 * 1024 * 1024,
    Number.parseInt(
      process.env.STREAMING_SSE_MAX_PENDING_BYTES || "1048576",
      10,
    ),
  ),
);
const STREAMING_SSE_REPLAY_MAX_BYTES = Math.max(
  512 * 1024,
  Math.min(
    64 * 1024 * 1024,
    Number.parseInt(
      process.env.STREAMING_SSE_REPLAY_MAX_BYTES || `${32 * 1024 * 1024}`,
      10,
    ),
  ),
);
const STREAMING_SSE_MAX_CLIENTS = Math.max(
  4,
  Math.min(
    256,
    Number.parseInt(process.env.STREAMING_SSE_MAX_CLIENTS || "64", 10),
  ),
);
const EXTERNAL_RTMP_STATUS_FILE = resolveExternalStatusFile(process.env);
const EXTERNAL_RTMP_STATUS_MAX_AGE_MS = Math.max(
  5000,
  Number.parseInt(process.env.RTMP_STATUS_MAX_AGE_MS || "15000", 10),
);
const REQUIRE_EXTERNAL_SOURCE_RUNTIME =
  process.env.STREAM_SOURCE_RUNTIME_REQUIRE_EXTERNAL === "true" ||
  process.env.NODE_ENV === "production";
const BETTING_BOOTSTRAP_RATE_LIMIT: RateLimitOptions = {
  max: 240,
  timeWindow: "1 minute",
};
const BETTING_EVENTS_RATE_LIMIT: RateLimitOptions = {
  max: 60,
  timeWindow: "1 minute",
};
const AUTHENTICATED_RESULTS_RATE_LIMIT: RateLimitOptions = {
  max: 120,
  timeWindow: "1 minute",
};
const STREAMING_STATUS_RATE_LIMIT: RateLimitOptions = {
  max: 120,
  timeWindow: "1 minute",
};
const STREAMING_RESULT_DUEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const STREAMING_STATUS_CODEQL_LIMITER = new RateLimiterMemory({
  points: 120,
  duration: 60,
});

/**
 * Opt-in additive contract for raw source-time fields on the canonical
 * stream state. When false (default) the wire shape is unchanged and every
 * existing consumer keeps working. When true the server also emits:
 *   - `cycle.sourceTimeline` — raw phase + timing fields (unprojected)
 *   - `emittedAt` on REST responses (SSE frames stamp this independently)
 * Commit 1 of the viewer-aligned-bet-state rollout; see
 * `docs/frontier_duel_bet_stream_sync_prd_sow.md` for the cross-rail plan.
 */
export function isRawSourceTimeEmissionEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    (env.STREAMING_EMIT_RAW_SOURCE_TIME ?? "").trim().toLowerCase() === "true"
  );
}

/**
 * Build a raw `sourceTimeline` projection of the given cycle. Every field
 * mirrors the scheduler's underlying wall-clock value without any
 * presentation-delay or replay-offset shift applied. `updatedAt` is the
 * source-emission timestamp of the frame the cycle was pulled from —
 * distinct from any downstream delivery time.
 */
export function buildSourceTimeline(
  cycle: StreamingStateUpdate["cycle"],
  updatedAt: number,
): StreamingSourceTimeline {
  return {
    phase: cycle.phase,
    betOpenTime: cycle.betOpenTime ?? null,
    betCloseTime: cycle.betCloseTime ?? null,
    fightStartTime: cycle.fightStartTime ?? null,
    duelEndTime: cycle.duelEndTime ?? null,
    updatedAt,
  };
}

/**
 * Attach raw source-time metadata to a streaming-state object, subject to
 * the `STREAMING_EMIT_RAW_SOURCE_TIME` flag (resolved via `enabled`). When
 * disabled, the wire shape is unchanged and every existing consumer keeps
 * working. When enabled:
 *   - `cycle.sourceTimeline` is populated with raw scheduler timings
 *   - `emittedAt` is attached at the envelope root when `stampEmittedAt`
 *     is true (REST responses want this; SSE frames already stamp
 *     `emittedAt` from their own envelope construction upstream).
 */
export function attachRawSourceTime<
  T extends { cycle: StreamingStateUpdate["cycle"] },
>(
  state: T,
  sourceEmittedAt: number,
  options: {
    stampEmittedAt: boolean;
    enabled: boolean;
    sourceCycle?: StreamingStateUpdate["cycle"] | null;
  },
): T {
  if (!options.enabled) return state;
  const sourceTimeline =
    state.cycle.sourceTimeline ??
    buildSourceTimeline(options.sourceCycle ?? state.cycle, sourceEmittedAt);
  const withTimeline: T = {
    ...state,
    cycle: {
      ...state.cycle,
      sourceTimeline,
    },
  };
  if (!options.stampEmittedAt) return withTimeline;
  return { ...withTimeline, emittedAt: sourceEmittedAt } as T & {
    emittedAt: number;
  };
}

/**
 * Standalone preHandler implementing the exact pattern CodeQL's
 * RouteHandlerLimitedByRateLimiterFlexible class recognizes: a function taking
 * a request parameter that calls `.consume(request.<prop>)` on an instance of
 * a `RateLimiter*` class from `rate-limiter-flexible`. Extracted to module
 * scope so the middleware is a separate routing-tree node that guards the
 * handler, which is what CodeQL's `isGuardedByNode` check requires.
 *
 * Using this preHandler satisfies `js/missing-rate-limiting` WITHOUT relying
 * on the `config.rateLimit` shorthand, which CodeQL's `FastifyPerRouteRateLimit`
 * class only recognizes when the rate-limiter plugin is imported under the
 * old unscoped name `fastify-rate-limit` (this repo uses `@fastify/rate-limit`).
 */
async function codeqlStatusRateLimitPreHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await STREAMING_STATUS_CODEQL_LIMITER.consume(request.ip);
  } catch {
    await reply.code(429).send({ error: "Too Many Requests" });
  }
}
type RateLimitedFastify = FastifyInstance & {
  rateLimit: NonNullable<FastifyInstance["rateLimit"]>;
};
type StreamingStatusMetricsSnapshot = {
  captureFps: number | null;
  encodeFps: number | null;
  droppedFrames: number | null;
  renderTick: number | null;
  duelStateTick: number | null;
  latestFrameAt: number | null;
  latestRenderTickAt: number | null;
  latestDuelStateTickAt: number | null;
  latestVisualChangeAt: number | null;
  visualChangeAgeMs: number | null;
};

type StreamingStatusManifestSnapshot = {
  updatedAt: number | null;
  mediaSequence: number | null;
};

type StreamingStatusSmokeSnapshot = {
  currentSceneUrl: string | null;
  activeBundle: string | null;
  deliveryMode: string | null;
  captureFpsP50: number | null;
  captureFpsP95: number | null;
  encodeFpsP50: number | null;
  encodeFpsP95: number | null;
  updatedAt: number | null;
  ingest: StreamingStatusIngestSnapshot;
};

type StreamingStatusIngestSnapshot = {
  profile: string | null;
  transport: string | null;
  audioSampleRate: number | null;
  gopFrames: number | null;
  probeOnly: boolean | null;
};

type StreamingCanonicalStatusSnapshot = {
  sourceReady: boolean;
  canonicalTransportConnected: boolean;
  canonicalPlaybackReady: boolean;
  manifestStatus: StreamManifestStatus;
  lastError: string | null;
  updatedAt: number | null;
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function hashAuditValue(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function redactIngestUrlFromDestination<T>(destination: T): T {
  if (!destination || typeof destination !== "object") {
    return destination;
  }
  return {
    ...destination,
    ingestUrl: null,
  };
}

function redactIngestUrlsFromDestinations<T>(destinations: readonly T[]): T[] {
  return destinations.map((destination) =>
    redactIngestUrlFromDestination(destination),
  );
}

function redactIngestUrlFromDelivery<T>(delivery: T): T {
  if (!delivery || typeof delivery !== "object") {
    return delivery;
  }
  if (!("ingestUrl" in delivery)) {
    return delivery;
  }
  return {
    ...delivery,
    ingestUrl: null,
  };
}

function ensureRateLimitDecorator(
  fastify: FastifyInstance,
): asserts fastify is RateLimitedFastify {
  if (typeof fastify.rateLimit === "function") {
    return;
  }
  throw new Error(
    "Streaming routes require @fastify/rate-limit to be registered before route setup",
  );
}

export function normalizeStreamingStatusMetrics(params: {
  externalSnapshot: ExternalRtmpStatusSnapshot | null;
  bridgeStats?:
    | {
        encoderFps?: number;
        droppedFrames?: number;
      }
    | null
    | undefined;
}): StreamingStatusMetricsSnapshot {
  const metrics = params.externalSnapshot?.metrics;
  const bridgeStats = params.bridgeStats;

  return {
    captureFps: asFiniteNumber(metrics?.captureFps),
    encodeFps:
      asFiniteNumber(metrics?.encodeFps) ??
      asFiniteNumber(bridgeStats?.encoderFps),
    droppedFrames:
      asFiniteNumber(metrics?.droppedFrames) ??
      asFiniteNumber(bridgeStats?.droppedFrames),
    renderTick: asFiniteNumber(metrics?.renderTick),
    duelStateTick: asFiniteNumber(metrics?.duelStateTick),
    latestFrameAt: asFiniteNumber(metrics?.latestFrameAt),
    latestRenderTickAt: asFiniteNumber(metrics?.latestRenderTickAt),
    latestDuelStateTickAt: asFiniteNumber(metrics?.latestDuelStateTickAt),
    latestVisualChangeAt: asFiniteNumber(metrics?.latestVisualChangeAt),
    visualChangeAgeMs: asFiniteNumber(metrics?.visualChangeAgeMs),
  };
}

export function normalizeStreamingStatusManifest(params: {
  externalSnapshot: ExternalRtmpStatusSnapshot | null;
  localHlsManifest?: HlsManifestSnapshot | null;
}): StreamingStatusManifestSnapshot {
  const externalManifest = params.externalSnapshot?.hlsManifest;
  const localManifest = params.localHlsManifest;
  return {
    updatedAt:
      asFiniteNumber(externalManifest?.updatedAt) ??
      asFiniteNumber(localManifest?.updatedAt),
    mediaSequence:
      asFiniteNumber(externalManifest?.mediaSequence) ??
      asFiniteNumber(localManifest?.mediaSequence),
  };
}

export function normalizeStreamingStatusSmoke(params: {
  externalSnapshot: ExternalRtmpStatusSnapshot | null;
  deliveryModeFallback: string | null;
}): StreamingStatusSmokeSnapshot {
  const smoke = params.externalSnapshot?.smoke;
  const ingest =
    smoke?.ingest && typeof smoke.ingest === "object"
      ? smoke.ingest
      : params.externalSnapshot?.ingest;
  const fallbackIngest = resolveStreamIngestSettings(process.env);
  return {
    currentSceneUrl:
      typeof smoke?.currentSceneUrl === "string" &&
      smoke.currentSceneUrl.trim().length > 0
        ? smoke.currentSceneUrl.trim()
        : null,
    activeBundle:
      typeof smoke?.activeBundle === "string" &&
      smoke.activeBundle.trim().length > 0
        ? smoke.activeBundle.trim()
        : null,
    deliveryMode:
      typeof smoke?.deliveryMode === "string" &&
      smoke.deliveryMode.trim().length > 0
        ? smoke.deliveryMode.trim()
        : params.deliveryModeFallback,
    captureFpsP50: asFiniteNumber(smoke?.captureFpsP50),
    captureFpsP95: asFiniteNumber(smoke?.captureFpsP95),
    encodeFpsP50: asFiniteNumber(smoke?.encodeFpsP50),
    encodeFpsP95: asFiniteNumber(smoke?.encodeFpsP95),
    updatedAt: asFiniteNumber(smoke?.updatedAt),
    ingest: {
      profile:
        typeof ingest?.profile === "string" && ingest.profile.trim().length > 0
          ? ingest.profile.trim()
          : fallbackIngest.profile,
      transport:
        typeof ingest?.transport === "string" &&
        ingest.transport.trim().length > 0
          ? ingest.transport.trim()
          : fallbackIngest.transport,
      audioSampleRate:
        asFiniteNumber(ingest?.audioSampleRate) ??
        fallbackIngest.audioSampleRate,
      gopFrames: asFiniteNumber(ingest?.gopFrames) ?? fallbackIngest.gopFrames,
      probeOnly:
        asBoolean(ingest?.probeOnly) ??
        (fallbackIngest.probeOnly ? true : false),
    },
  };
}

function findCanonicalStreamingDestination(params: {
  externalSnapshot: ExternalRtmpStatusSnapshot | null;
  delivery: ReturnType<typeof resolveStreamDeliveryInfo>;
}): {
  index: number;
  destination: ExternalRtmpDestination | null;
} {
  const destinations = Array.isArray(params.externalSnapshot?.destinations)
    ? params.externalSnapshot!.destinations
    : [];
  const canonicalProvider = normalizeStreamDestinationProvider(
    params.delivery.provider,
    "Cloudflare",
  );
  const canonicalDestinationId = buildStreamDestinationId({
    role: "canonical",
    provider: canonicalProvider,
    name: "External Delivery",
  });

  const index = destinations.findIndex(
    (destination) => destination.role === "canonical",
  );
  if (index >= 0) {
    return {
      index,
      destination: destinations[index] ?? null,
    };
  }

  const idIndex = destinations.findIndex(
    (destination) => destination.id === canonicalDestinationId,
  );
  if (idIndex >= 0) {
    return {
      index: idIndex,
      destination: destinations[idIndex] ?? null,
    };
  }

  const providerIndex = destinations.findIndex(
    (destination) =>
      normalizeStreamDestinationProvider(
        destination.provider ?? null,
        destination.name ?? null,
      ) === canonicalProvider,
  );
  if (providerIndex >= 0) {
    return {
      index: providerIndex,
      destination: destinations[providerIndex] ?? null,
    };
  }

  return {
    index: -1,
    destination: null,
  };
}

function isFreshStreamingSnapshot(
  updatedAt: number | null | undefined,
  nowMs: number,
): boolean {
  return (
    typeof updatedAt === "number" &&
    Number.isFinite(updatedAt) &&
    Math.max(0, nowMs - updatedAt) <= EXTERNAL_RTMP_STATUS_MAX_AGE_MS
  );
}

function resolveStreamingManifestStatusFromUpdatedAt(
  updatedAt: number | null | undefined,
  nowMs: number,
): StreamManifestStatus {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) {
    return "missing";
  }
  return isFreshStreamingSnapshot(updatedAt, nowMs) ? "ok" : "stale";
}

function resolveCanonicalPlaybackUrl(params: {
  destination: ExternalRtmpDestination | null;
  delivery: ReturnType<typeof resolveStreamDeliveryInfo>;
}): string | null {
  return (
    params.destination?.playbackUrl ??
    params.delivery.playbackUrl ??
    params.delivery.llhlsUrl ??
    params.delivery.hlsUrl ??
    null
  );
}

function hasFreshContradictorySourceError(params: {
  sourceRuntime: StreamSourceRuntime;
  captureDiagnostics?: ExternalCaptureDiagnosticsBlob | null;
  canonicalProbeSnapshot?: StreamPlaybackProbeResult | null;
}): boolean {
  if (params.sourceRuntime.ready === true) {
    return false;
  }

  const probeUpdatedAt = asFiniteNumber(
    params.canonicalProbeSnapshot?.updatedAt,
  );
  const fatalWriteAt = asFiniteNumber(
    params.captureDiagnostics?.lastFatalWriteError?.at,
  );
  const workerHeartbeatAt = asFiniteNumber(
    params.sourceRuntime.workerHeartbeatAt,
  );
  const freshestSourceIncidentAt = Math.max(
    fatalWriteAt ?? Number.NEGATIVE_INFINITY,
    workerHeartbeatAt ?? Number.NEGATIVE_INFINITY,
  );

  if (!Number.isFinite(freshestSourceIncidentAt)) {
    return true;
  }
  if (probeUpdatedAt == null) {
    return true;
  }

  return freshestSourceIncidentAt >= probeUpdatedAt;
}

function normalizeCanonicalStreamingTruth(params: {
  externalSnapshot: ExternalRtmpStatusSnapshot | null;
  delivery: ReturnType<typeof resolveStreamDeliveryInfo>;
  canonicalProbeSnapshot?: StreamPlaybackProbeResult | null;
  sourceRuntime: StreamSourceRuntime;
  localHlsManifest?: HlsManifestSnapshot | null;
}): {
  externalSnapshot: ExternalRtmpStatusSnapshot | null;
  canonicalStatus: StreamingCanonicalStatusSnapshot;
} {
  if (params.delivery.mode === "self_hls") {
    const playbackUrl = params.delivery.playbackUrl ?? null;
    const externalManifestUpdatedAt = asFiniteNumber(
      params.externalSnapshot?.hlsManifest?.updatedAt,
    );
    const localManifestUpdatedAt = asFiniteNumber(
      params.localHlsManifest?.updatedAt,
    );
    const manifestUpdatedAt =
      externalManifestUpdatedAt != null && localManifestUpdatedAt != null
        ? Math.max(externalManifestUpdatedAt, localManifestUpdatedAt)
        : (externalManifestUpdatedAt ?? localManifestUpdatedAt ?? null);
    const nowMs = Date.now();
    const manifestStatus = resolveStreamingManifestStatusFromUpdatedAt(
      manifestUpdatedAt,
      nowMs,
    );
    const sourceReady = params.sourceRuntime.ready === true;
    const canonicalPlaybackReady = manifestStatus === "ok";
    const canonicalTransportConnected = sourceReady && canonicalPlaybackReady;
    const lastError = sourceReady
      ? canonicalPlaybackReady
        ? null
        : manifestStatus === "stale"
          ? "manifest_stale"
          : playbackUrl
            ? "manifest_not_ready"
            : "playback_unconfigured"
      : (params.sourceRuntime.degradedReason ?? "source_unavailable");

    const selfHostedDestination = {
      id: buildStreamDestinationId({
        role: "canonical",
        provider: "self_hls",
        name: "Self-HLS",
      }),
      name: "Self-HLS",
      role: "canonical" as const,
      provider: "self_hls" as const,
      transport: "hls" as const,
      playbackUrl,
      ingestUrl: null,
      connected: canonicalPlaybackReady,
      transportHealthy: canonicalTransportConnected,
      playbackReady: canonicalPlaybackReady,
      manifestStatus,
      lastError,
      error: lastError ?? undefined,
      updatedAt: manifestUpdatedAt ?? undefined,
    };

    const destinations = Array.isArray(params.externalSnapshot?.destinations)
      ? params.externalSnapshot!.destinations
      : [];
    const normalizedIndex = destinations.findIndex((candidate) => {
      if (candidate.role === "canonical") return true;
      if (candidate.id === selfHostedDestination.id) return true;
      return (
        normalizeStreamDestinationProvider(
          candidate.provider ?? null,
          candidate.name ?? null,
        ) === "self_hls"
      );
    });

    const normalizedSnapshot = params.externalSnapshot
      ? {
          ...params.externalSnapshot,
          destinations:
            normalizedIndex >= 0
              ? params.externalSnapshot.destinations.map((candidate, index) =>
                  index === normalizedIndex
                    ? { ...candidate, ...selfHostedDestination }
                    : candidate,
                )
              : [
                  ...params.externalSnapshot.destinations,
                  selfHostedDestination,
                ],
        }
      : {
          active: canonicalTransportConnected,
          ffmpegRunning: sourceReady,
          clientConnected: sourceReady,
          destinations: [selfHostedDestination],
          stats: {},
          updatedAt: manifestUpdatedAt ?? nowMs,
          hlsManifest: {
            updatedAt: manifestUpdatedAt,
            mediaSequence:
              asFiniteNumber(params.localHlsManifest?.mediaSequence) ?? null,
          },
          delivery: params.delivery,
        };

    return {
      externalSnapshot: normalizedSnapshot,
      canonicalStatus: {
        sourceReady,
        canonicalTransportConnected,
        canonicalPlaybackReady,
        manifestStatus,
        lastError,
        updatedAt: manifestUpdatedAt,
      },
    };
  }

  const { index, destination } = findCanonicalStreamingDestination({
    externalSnapshot: params.externalSnapshot,
    delivery: params.delivery,
  });
  const playbackUrl = resolveCanonicalPlaybackUrl({
    destination,
    delivery: params.delivery,
  });
  const probeReady = params.canonicalProbeSnapshot?.ready === true;
  const sourceReady = params.sourceRuntime.ready === true;
  const contradictorySourceError = hasFreshContradictorySourceError({
    sourceRuntime: params.sourceRuntime,
    captureDiagnostics: params.externalSnapshot?.captureDiagnostics ?? null,
    canonicalProbeSnapshot: params.canonicalProbeSnapshot ?? null,
  });
  const destinationError =
    typeof destination?.error === "string" &&
    destination.error.trim().length > 0
      ? destination.error.trim()
      : null;
  const canonicalDestinationConnected =
    probeReady || destination?.connected === true;
  const canonicalTransportConnected =
    sourceReady && canonicalDestinationConnected && !contradictorySourceError;
  const canonicalPlaybackReady = probeReady;
  const manifestStatus =
    params.canonicalProbeSnapshot?.manifestStatus ??
    (playbackUrl ? "unknown" : "missing");
  const updatedAt =
    params.canonicalProbeSnapshot?.updatedAt ??
    destination?.startedAt ??
    params.externalSnapshot?.updatedAt ??
    null;
  const lastError =
    probeReady && !contradictorySourceError
      ? null
      : params.sourceRuntime.ready
        ? (destinationError ??
          params.canonicalProbeSnapshot?.lastError ??
          (playbackUrl ? "delivery_disconnected" : "playback_unconfigured"))
        : (params.sourceRuntime.degradedReason ??
          destinationError ??
          "source_unavailable");

  if (!params.externalSnapshot || index < 0) {
    return {
      externalSnapshot: params.externalSnapshot,
      canonicalStatus: {
        sourceReady,
        canonicalTransportConnected,
        canonicalPlaybackReady,
        manifestStatus,
        lastError,
        updatedAt,
      },
    };
  }

  const normalizedDestinations = params.externalSnapshot.destinations.map(
    (candidate, candidateIndex) => {
      if (candidateIndex !== index) {
        return candidate;
      }
      return {
        ...candidate,
        connected: canonicalDestinationConnected,
        transportHealthy:
          sourceReady && probeReady && !contradictorySourceError,
        playbackReady: canonicalPlaybackReady,
        manifestStatus,
        lastError,
        error: lastError ?? undefined,
        updatedAt: updatedAt ?? undefined,
      };
    },
  );

  return {
    externalSnapshot: {
      ...params.externalSnapshot,
      destinations: normalizedDestinations,
    },
    canonicalStatus: {
      sourceReady,
      canonicalTransportConnected,
      canonicalPlaybackReady,
      manifestStatus,
      lastError,
      updatedAt,
    },
  };
}

export function buildStreamingStatusPayload(params: {
  base: Record<string, unknown>;
  externalSnapshot: ExternalRtmpStatusSnapshot | null;
  canonicalProbeSnapshot?: StreamPlaybackProbeResult | null;
  localHlsManifest?: HlsManifestSnapshot | null;
  bridgeStats?:
    | {
        encoderFps?: number;
        droppedFrames?: number;
      }
    | null
    | undefined;
  rendererHealth: ReturnType<typeof deriveBettingRendererHealth>;
  captureStats?:
    | {
        clientConnected: boolean;
        ffmpegRunning: boolean;
      }
    | null
    | undefined;
  persistedAuthorityState?: PersistedStreamingAuthorityState | null;
  cloudflareLiveInputId?: string | null;
}) {
  const delivery =
    params.externalSnapshot?.delivery ?? resolveStreamDeliveryInfo(process.env);
  const sourceRuntime: StreamSourceRuntime = deriveStreamSourceRuntime({
    externalStatusSnapshot: params.externalSnapshot,
    externalStatusMaxAgeMs: EXTERNAL_RTMP_STATUS_MAX_AGE_MS,
    rendererHealth: params.rendererHealth,
    localHlsManifest: params.localHlsManifest,
    captureStats: params.captureStats,
    requireExternalWorker: REQUIRE_EXTERNAL_SOURCE_RUNTIME,
  });
  const normalizedCanonicalTruth = normalizeCanonicalStreamingTruth({
    externalSnapshot: params.externalSnapshot,
    delivery,
    canonicalProbeSnapshot: params.canonicalProbeSnapshot ?? null,
    sourceRuntime,
    localHlsManifest: params.localHlsManifest,
  });
  const effectiveExternalSnapshot = normalizedCanonicalTruth.externalSnapshot;
  const persistedAuthority = params.persistedAuthorityState ?? null;
  const metrics = normalizeStreamingStatusMetrics({
    externalSnapshot: effectiveExternalSnapshot,
    bridgeStats: params.bridgeStats,
  });
  const hlsManifest = normalizeStreamingStatusManifest({
    externalSnapshot: effectiveExternalSnapshot,
    localHlsManifest: params.localHlsManifest,
  });
  const smoke = normalizeStreamingStatusSmoke({
    externalSnapshot: effectiveExternalSnapshot,
    deliveryModeFallback: delivery.mode,
  });
  const externalActive = asBoolean(effectiveExternalSnapshot?.active);
  const externalFfmpegRunning = asBoolean(
    effectiveExternalSnapshot?.ffmpegRunning,
  );
  const externalClientConnected = asBoolean(
    effectiveExternalSnapshot?.clientConnected,
  );
  const activeCanonicalProvider =
    persistedAuthority?.canonicalProviderState?.activeProvider ??
    (delivery.mode === "self_hls"
      ? "self_hls"
      : normalizeStreamDestinationProvider(delivery.provider, "Cloudflare"));
  const publicDestinations = redactIngestUrlsFromDestinations(
    (effectiveExternalSnapshot?.destinations ??
      params.base.destinations ??
      []) as readonly unknown[],
  );
  const publicDelivery = redactIngestUrlFromDelivery(delivery);
  const cloudflarePlaybackProbe =
    activeCanonicalProvider === "cloudflare_stream" &&
    params.canonicalProbeSnapshot
      ? {
          ready: params.canonicalProbeSnapshot.ready,
          manifestStatus: params.canonicalProbeSnapshot.manifestStatus,
          lastError: params.canonicalProbeSnapshot.lastError,
          updatedAt: params.canonicalProbeSnapshot.updatedAt,
        }
      : null;
  const publicCloudflareStatus = {
    liveInputId: null,
    lifecycle: null,
    lastWebhook: null,
    lastPlaybackProbe: cloudflarePlaybackProbe,
    lastExternalTransportError: null,
  };

  return {
    ...params.base,
    running: externalActive ?? params.base.running,
    bridgeActive: externalActive ?? params.base.bridgeActive,
    ffmpegRunning: externalFfmpegRunning ?? params.base.ffmpegRunning,
    clientConnected: externalClientConnected ?? params.base.clientConnected,
    destinations: publicDestinations,
    metrics,
    captureFps: metrics.captureFps,
    encodeFps: metrics.encodeFps,
    droppedFrames: metrics.droppedFrames,
    renderTick: metrics.renderTick,
    duelStateTick: metrics.duelStateTick,
    latestFrameAt: metrics.latestFrameAt,
    latestRenderTickAt: metrics.latestRenderTickAt,
    latestDuelStateTickAt: metrics.latestDuelStateTickAt,
    latestVisualChangeAt: metrics.latestVisualChangeAt,
    visualChangeAgeMs: metrics.visualChangeAgeMs,
    hlsManifest,
    hlsManifestUpdatedAt: hlsManifest.updatedAt,
    hlsMediaSequence: hlsManifest.mediaSequence,
    delivery: publicDelivery,
    ingest: smoke.ingest,
    smoke,
    deliveryMode: publicDelivery.mode,
    deliveryProvider: publicDelivery.provider ?? null,
    playbackUrl: publicDelivery.playbackUrl ?? null,
    rendererHealth: params.rendererHealth,
    sourceRuntime,
    canonicalStatus: normalizedCanonicalTruth.canonicalStatus,
    authority: {
      activeCanonicalProvider,
      primaryHealthySince:
        persistedAuthority?.canonicalProviderState?.primaryHealthySince ?? null,
      updatedAt: persistedAuthority?.canonicalProviderState?.updatedAt ?? null,
    },
    cloudflare: publicCloudflareStatus,
    captureDiagnostics: null,
  };
}

function getInventorySnapshot(
  world: World,
  characterId: string,
): InventorySnapshotItem[] {
  const inventorySystem = world.getSystem("inventory") as
    | {
        getInventoryData?: (id: string) => {
          items: Array<{
            slot?: number;
            itemId?: string;
            quantity?: number;
          }>;
        };
        getInventory?: (id: string) => {
          items: Array<{
            slot?: number;
            itemId?: string;
            quantity?: number;
          }>;
        };
      }
    | undefined;

  const sourceItems =
    inventorySystem?.getInventoryData?.(characterId)?.items ??
    inventorySystem?.getInventory?.(characterId)?.items ??
    [];

  return sourceItems
    .map((item, index) => ({
      slot: item.slot ?? index,
      itemId: item.itemId ?? "unknown",
      quantity: item.quantity ?? 1,
    }))
    .sort((a, b) => a.slot - b.slot);
}

async function getThoughtsSnapshot(
  characterId: string,
  limit: number = 10,
): Promise<ThoughtSnapshot[]> {
  const { ServerNetwork } = await import("../systems/ServerNetwork/index.js");
  const thoughts =
    (
      ServerNetwork as {
        agentThoughts?: Map<string, ThoughtSnapshot[]>;
      }
    ).agentThoughts?.get(characterId) || [];

  return thoughts.slice(0, Math.max(1, Math.min(limit, 50)));
}

export function normalizeStreamingThoughtLimit(
  rawLimit: string | undefined,
): number {
  const parsed = Number.parseInt(rawLimit || "20", 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.max(1, Math.min(parsed, 50));
}

export function allocateNextStreamingSseClientId(
  currentNextClientId: number,
  clients: ReadonlyMap<number, unknown>,
): { clientId: number; nextClientId: number } {
  const maxClientId = Number.MAX_SAFE_INTEGER;
  let candidate = currentNextClientId;

  for (let attempts = 0; attempts <= maxClientId; attempts += 1) {
    if (!Number.isSafeInteger(candidate) || candidate <= 0) {
      candidate = 1;
    }
    if (!clients.has(candidate)) {
      const nextClientId = candidate >= maxClientId ? 1 : candidate + 1;
      return { clientId: candidate, nextClientId };
    }
    candidate = candidate >= maxClientId ? 1 : candidate + 1;
  }

  throw new Error("Streaming SSE client id space exhausted");
}

export function buildStreamingResultNotFoundPayload(): {
  error: "Not found";
  message: "Resolved duel not found";
} {
  return {
    error: "Not found",
    message: "Resolved duel not found",
  };
}

export function isValidStreamingResultDuelId(duelId: string): boolean {
  return STREAMING_RESULT_DUEL_ID_PATTERN.test(duelId);
}

/**
 * Register streaming routes
 */
export function registerStreamingRoutes(
  fastify: FastifyInstance,
  world: World,
): void {
  ensureRateLimitDecorator(fastify);
  const sseClients = new Map<number, FastifyReply>();
  const replayFrames: StreamingSseFrame[] = [];
  let replayFramesTotalBytes = 0;
  const sseMetrics = {
    startedAt: Date.now(),
    totalConnected: 0,
    totalDisconnected: 0,
    peakConnected: 0,
    droppedSlowConsumers: 0,
    droppedWriteFailures: 0,
    droppedClosedSockets: 0,
    generatedFrames: 0,
    broadcastBatches: 0,
    deliveredLiveStateEvents: 0,
    deliveredReplayStateEvents: 0,
    deliveredBootstrapStateEvents: 0,
    deliveredReplayResetEvents: 0,
    deliveredUnavailableEvents: 0,
    heartbeatsSent: 0,
    heartbeatFailures: 0,
    lastFanoutDurationMs: 0,
    averageFanoutDurationMs: 0,
    maxFanoutDurationMs: 0,
    fanoutOver50Ms: 0,
    fanoutOver100Ms: 0,
  };
  let nextClientId = 1;
  let sequence = 0;
  let lastSerializedState = "";
  let lastBroadcastSeq = 0;
  let statePushInterval: ReturnType<typeof setInterval> | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  const configuredStreamingDelivery = resolveStreamDeliveryInfo(process.env);
  const canonicalPlaybackProbePoller = acquirePlaybackProbePoller(
    configuredStreamingDelivery.mode === "external_hls"
      ? (configuredStreamingDelivery.playbackUrl ??
          configuredStreamingDelivery.llhlsUrl ??
          configuredStreamingDelivery.hlsUrl)
      : null,
    {
      intervalMs: Math.max(
        2_000,
        Math.min(EXTERNAL_RTMP_STATUS_MAX_AGE_MS, 5_000),
      ),
      timeoutMs: Math.min(EXTERNAL_RTMP_STATUS_MAX_AGE_MS, 4_000),
    },
  );
  const bettingRoutes = registerStreamingBettingRoutes({
    fastify,
    world,
    replayBuffer: STREAMING_SSE_REPLAY_BUFFER,
    replayMaxBytes: STREAMING_SSE_REPLAY_MAX_BYTES,
    pushIntervalMs: STREAMING_SSE_PUSH_INTERVAL_MS,
    heartbeatMs: STREAMING_SSE_HEARTBEAT_MS,
    maxPendingBytes: STREAMING_SSE_MAX_PENDING_BYTES,
    maxClients: Math.max(
      4,
      Math.min(
        128,
        Number.parseInt(process.env.BETTING_SSE_MAX_CLIENTS || "32", 10),
      ),
    ),
    bootstrapRateLimit: BETTING_BOOTSTRAP_RATE_LIMIT,
    eventsRateLimit: BETTING_EVENTS_RATE_LIMIT,
    internalAllowedOrigin:
      process.env.INTERNAL_BET_SYNC_ALLOWED_ORIGIN?.trim() || null,
    externalStatusFile: EXTERNAL_RTMP_STATUS_FILE || null,
    externalStatusMaxAgeMs: EXTERNAL_RTMP_STATUS_MAX_AGE_MS,
  });
  const cloudflareLiveInputId =
    process.env.STREAM_CLOUDFLARE_LIVE_INPUT_ID?.trim() || null;
  const getStorageDb = () =>
    (
      world.getSystem("database") as
        | {
            getDb?: () => ReturnType<DatabaseSystem["getDb"]>;
          }
        | null
        | undefined
    )?.getDb?.() ?? null;
  const loadPersistedStreamState = () =>
    loadPersistedStreamingAuthorityState(getStorageDb());
  const loadPersistedStreamStateSafely = async () => {
    try {
      return await loadPersistedStreamState();
    } catch {
      return null;
    }
  };

  const formatSseEvent = (event: string, data: string, id?: number): string => {
    const normalizedData = data.replace(/\n/g, "\ndata: ");
    const idLine = typeof id === "number" ? `id: ${id}\n` : "";
    return `${idLine}event: ${event}\ndata: ${normalizedData}\n\n`;
  };

  const writeSseMessage = (
    reply: FastifyReply,
    message: string,
  ): SseSendStatus => {
    const raw = reply.raw;
    if (raw.destroyed || raw.writableEnded) {
      return "closed";
    }
    if (raw.writableLength > STREAMING_SSE_MAX_PENDING_BYTES) {
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

  const removeSseClient = (
    clientId: number,
    reason: SseDropReason = "client-close",
  ): void => {
    const clientReply = sseClients.get(clientId);
    if (!clientReply) return;

    sseClients.delete(clientId);
    sseMetrics.totalDisconnected += 1;
    if (reason === "slow-consumer") sseMetrics.droppedSlowConsumers += 1;
    if (reason === "write-failed") sseMetrics.droppedWriteFailures += 1;
    if (reason === "closed-socket") sseMetrics.droppedClosedSockets += 1;

    try {
      if (!clientReply.raw.writableEnded) {
        clientReply.raw.end();
      }
    } catch {
      // ignore socket close errors
    }
    if (sseClients.size === 0) {
      if (statePushInterval) {
        clearInterval(statePushInterval);
        statePushInterval = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      // When delayed mode is disabled, replay is only needed for active SSE
      // clients; drop it aggressively to keep dev memory bounded.
      if (STREAMING_PUBLIC_DELAY_MS <= 0 && replayFrames.length > 0) {
        replayFrames.length = 0;
        replayFramesTotalBytes = 0;
      }
    }
  };

  const removeSseClientForStatus = (
    clientId: number,
    status: SseSendStatus,
  ): void => {
    if (status === "slow") {
      removeSseClient(clientId, "slow-consumer");
      return;
    }
    if (status === "error") {
      removeSseClient(clientId, "write-failed");
      return;
    }
    removeSseClient(clientId, "closed-socket");
  };

  const recordFanoutDuration = (durationMs: number): void => {
    sseMetrics.lastFanoutDurationMs = durationMs;
    sseMetrics.maxFanoutDurationMs = Math.max(
      sseMetrics.maxFanoutDurationMs,
      durationMs,
    );
    const batches = sseMetrics.broadcastBatches;
    sseMetrics.averageFanoutDurationMs =
      batches <= 1
        ? durationMs
        : (sseMetrics.averageFanoutDurationMs * (batches - 1) + durationMs) /
          batches;
    if (durationMs >= 50) sseMetrics.fanoutOver50Ms += 1;
    if (durationMs >= 100) sseMetrics.fanoutOver100Ms += 1;
  };

  const pushFrame = (event: string, frame: StreamingSseFrame): void => {
    const startedAt = Date.now();
    const message = formatSseEvent(event, frame.payload, frame.seq);
    sseMetrics.broadcastBatches += 1;
    let delivered = 0;
    for (const [clientId, clientReply] of sseClients.entries()) {
      const status = writeSseMessage(clientReply, message);
      if (status !== "ok") {
        removeSseClientForStatus(clientId, status);
        continue;
      }
      delivered += 1;
    }
    sseMetrics.deliveredLiveStateEvents += delivered;
    recordFanoutDuration(Date.now() - startedAt);
  };

  const getFirstReplayIndexAfter = (seqValue: number): number => {
    let low = 0;
    let high = replayFrames.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (replayFrames[mid].seq <= seqValue) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  };

  const getOldestEligibleReplayFrame = (
    nowMs: number = Date.now(),
  ): StreamingSseFrame | null => {
    if (replayFrames.length === 0) return null;
    if (STREAMING_PUBLIC_DELAY_MS <= 0) return replayFrames[0];

    const cutoff = nowMs - STREAMING_PUBLIC_DELAY_MS;
    for (let index = 0; index < replayFrames.length; index += 1) {
      const frame = replayFrames[index];
      if (frame.emittedAt <= cutoff) return frame;
    }
    return null;
  };

  const getLatestEligibleReplayFrame = (
    nowMs: number = Date.now(),
  ): StreamingSseFrame | null => {
    if (replayFrames.length === 0) return null;
    if (STREAMING_PUBLIC_DELAY_MS <= 0)
      return replayFrames[replayFrames.length - 1];

    const cutoff = nowMs - STREAMING_PUBLIC_DELAY_MS;
    for (let index = replayFrames.length - 1; index >= 0; index -= 1) {
      const frame = replayFrames[index];
      if (frame.emittedAt <= cutoff) return frame;
    }
    return null;
  };

  const getEligibleReplayFramesAfter = (
    seqValue: number,
    nowMs: number = Date.now(),
  ): StreamingSseFrame[] => {
    const startIndex = getFirstReplayIndexAfter(seqValue);
    if (startIndex >= replayFrames.length) return [];
    if (STREAMING_PUBLIC_DELAY_MS <= 0) {
      return replayFrames.slice(startIndex);
    }

    const cutoff = nowMs - STREAMING_PUBLIC_DELAY_MS;
    const frames: StreamingSseFrame[] = [];
    for (let index = startIndex; index < replayFrames.length; index += 1) {
      const frame = replayFrames[index];
      if (frame.emittedAt > cutoff) break;
      frames.push(frame);
    }
    return frames;
  };

  const parseReplayFrameState = (
    frame: StreamingSseFrame | null,
  ): {
    cycle: unknown;
    leaderboard: unknown;
    cameraTarget: unknown;
  } | null => {
    if (!frame) return null;
    try {
      const parsed = JSON.parse(frame.payload) as {
        cycle?: unknown;
        leaderboard?: unknown;
        cameraTarget?: unknown;
      };
      if (!parsed || typeof parsed !== "object") return null;
      if (!parsed.cycle || !Array.isArray(parsed.leaderboard)) return null;
      return {
        cycle: parsed.cycle,
        leaderboard: parsed.leaderboard,
        cameraTarget: parsed.cameraTarget ?? null,
      };
    } catch {
      return null;
    }
  };

  const redactOracleProofFromCycle = (cycle: unknown): unknown => {
    if (!cycle || typeof cycle !== "object") {
      return cycle;
    }

    const {
      duelKeyHex: _k,
      duelEndTime: _e,
      seed: _s,
      replayHash: _r,
      ...publicCycle
    } = cycle as Record<string, unknown>;

    return publicCycle;
  };

  const redactOracleProofFromState = <T extends { cycle: unknown }>(
    state: T,
  ): T =>
    ({
      ...state,
      cycle: redactOracleProofFromCycle(state.cycle),
    }) as T;

  const rawSourceTimeEnabled = isRawSourceTimeEmissionEnabled();

  const getPublicStreamingState = (
    scheduler: NonNullable<ReturnType<typeof getStreamingDuelScheduler>>,
  ): ReturnType<typeof scheduler.getStreamingState> | null => {
    if (STREAMING_PUBLIC_DELAY_MS <= 0) {
      const rawState = scheduler.getStreamingState();
      const live = redactOracleProofFromState(rawState);
      return attachRawSourceTime(live, Date.now(), {
        stampEmittedAt: true,
        enabled: rawSourceTimeEnabled,
        sourceCycle: rawState.cycle,
      });
    }

    // Keep delayed replay frames fresh for REST polling consumers
    // even when no SSE clients are connected.
    if (!statePushInterval) {
      captureStreamingFrame(false);
    }

    if (replayFrames.length === 0) {
      captureStreamingFrame(true);
    }

    const delayedFrame = getLatestEligibleReplayFrame();
    const delayed = parseReplayFrameState(delayedFrame);
    if (!delayed) return null;

    const base = {
      type: "STREAMING_STATE_UPDATE" as const,
      cycle: redactOracleProofFromCycle(delayed.cycle) as ReturnType<
        typeof scheduler.getStreamingState
      >["cycle"],
      leaderboard: delayed.leaderboard as ReturnType<
        typeof scheduler.getStreamingState
      >["leaderboard"],
      cameraTarget:
        typeof delayed.cameraTarget === "string" ||
        delayed.cameraTarget === null
          ? delayed.cameraTarget
          : null,
    };
    // For REST polling consumers the source-emission anchor is the
    // replay frame's original `emittedAt` — the raw time at which the
    // frame was captured upstream, not the time of this REST response.
    return attachRawSourceTime(base, delayedFrame?.emittedAt ?? Date.now(), {
      stampEmittedAt: true,
      enabled: rawSourceTimeEnabled,
    });
  };

  const captureStreamingFrame = (
    forceNewFrame = false,
  ): StreamingSseFrame | null => {
    const scheduler = getStreamingDuelScheduler();
    if (!scheduler) return null;

    const rawState = scheduler.getStreamingState();
    const state = redactOracleProofFromState(rawState);
    const serialized = JSON.stringify(state);
    if (
      !forceNewFrame &&
      serialized === lastSerializedState &&
      replayFrames.length > 0
    ) {
      return null;
    }

    lastSerializedState = serialized;
    sequence += 1;

    const emittedAt = Date.now();
    // When the raw-source-time contract is enabled, inject `sourceTimeline`
    // into the cycle BEFORE serialization so SSE consumers see it inside
    // `cycle` alongside the existing fields. `emittedAt` at the envelope
    // root stays unconditional — it's part of the long-standing SSE
    // envelope contract, so `stampEmittedAt: false` here.
    const stateWithTimeline = attachRawSourceTime(state, emittedAt, {
      stampEmittedAt: false,
      enabled: rawSourceTimeEnabled,
      sourceCycle: rawState.cycle,
    });
    const payload = JSON.stringify({
      ...stateWithTimeline,
      type: "STREAMING_STATE_UPDATE",
      seq: sequence,
      emittedAt,
    });
    const frame: StreamingSseFrame = {
      seq: sequence,
      emittedAt,
      payload,
      payloadBytes: Buffer.byteLength(payload, "utf8"),
    };

    replayFrames.push(frame);
    replayFramesTotalBytes += frame.payloadBytes;
    sseMetrics.generatedFrames += 1;

    replayFramesTotalBytes = trimReplayFrames(
      replayFrames,
      replayFramesTotalBytes,
      {
        maxFrames: STREAMING_SSE_REPLAY_BUFFER,
        maxBytes: STREAMING_SSE_REPLAY_MAX_BYTES,
      },
    );

    return frame;
  };

  const startSseLoopsIfNeeded = (): void => {
    if (statePushInterval) return;

    lastBroadcastSeq = getLatestEligibleReplayFrame()?.seq ?? 0;

    statePushInterval = setInterval(() => {
      const frame = captureStreamingFrame(false);
      if (STREAMING_PUBLIC_DELAY_MS <= 0) {
        if (frame) {
          pushFrame("state", frame);
          lastBroadcastSeq = frame.seq;
        }
        return;
      }

      const eligibleFrames = getEligibleReplayFramesAfter(lastBroadcastSeq);
      for (const eligibleFrame of eligibleFrames) {
        pushFrame("state", eligibleFrame);
        lastBroadcastSeq = eligibleFrame.seq;
      }
    }, STREAMING_SSE_PUSH_INTERVAL_MS);

    heartbeatInterval = setInterval(() => {
      const heartbeatMessage = `:hb ${Date.now()}\n\n`;
      for (const [clientId, clientReply] of sseClients.entries()) {
        const status = writeSseMessage(clientReply, heartbeatMessage);
        if (status === "ok") {
          sseMetrics.heartbeatsSent += 1;
          continue;
        }
        sseMetrics.heartbeatFailures += 1;
        removeSseClientForStatus(clientId, status);
      }
    }, STREAMING_SSE_HEARTBEAT_MS);
  };

  fastify.addHook("onClose", (_instance, done) => {
    if (statePushInterval) {
      clearInterval(statePushInterval);
      statePushInterval = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    for (const clientId of [...sseClients.keys()]) {
      removeSseClient(clientId, "shutdown");
    }
    canonicalPlaybackProbePoller?.release();
    bettingRoutes.close();
    done();
  });

  // Get current streaming state
  fastify.get(
    "/api/streaming/state",
    {
      config: { rateLimit: STREAMING_STATUS_RATE_LIMIT },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const scheduler = getStreamingDuelScheduler();

      if (!scheduler) {
        return reply.status(503).send({
          error: "Streaming mode not active",
          message: "The streaming duel scheduler is not running",
        });
      }

      const state = getPublicStreamingState(scheduler);
      if (!state) {
        return reply.status(503).send({
          error: "Streaming delay warmup",
          message: `Delayed streaming state is not yet available (${STREAMING_PUBLIC_DELAY_MS}ms delay window)`,
        });
      }
      return reply.send(state);
    },
  );

  fastify.get(
    "/api/streaming/metrics",
    {
      config: { rateLimit: STREAMING_STATUS_RATE_LIMIT },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const bettingMetrics = bettingRoutes.getMetrics();
      return reply.send({
        type: "STREAMING_METRICS",
        emittedAt: Date.now(),
        uptimeMs: Date.now() - sseMetrics.startedAt,
        sse: {
          config: {
            replayBuffer: STREAMING_SSE_REPLAY_BUFFER,
            pushIntervalMs: STREAMING_SSE_PUSH_INTERVAL_MS,
            heartbeatMs: STREAMING_SSE_HEARTBEAT_MS,
            maxPendingBytes: STREAMING_SSE_MAX_PENDING_BYTES,
            publicDelayMs: STREAMING_PUBLIC_DELAY_MS,
            canonicalPlatform: STREAMING_CANONICAL_PLATFORM,
            publicDelayDefaultMs: STREAMING_PUBLIC_DELAY_DEFAULT_MS,
            publicDelayOverridden: STREAMING_PUBLIC_DELAY_OVERRIDDEN,
          },
          clients: {
            connected: sseClients.size,
            peakConnected: sseMetrics.peakConnected,
            totalConnected: sseMetrics.totalConnected,
            totalDisconnected: sseMetrics.totalDisconnected,
            droppedSlowConsumers: sseMetrics.droppedSlowConsumers,
            droppedWriteFailures: sseMetrics.droppedWriteFailures,
            droppedClosedSockets: sseMetrics.droppedClosedSockets,
          },
          replay: {
            size: replayFrames.length,
            totalBytes: replayFramesTotalBytes,
            oldestSeq: replayFrames[0]?.seq ?? null,
            latestSeq: replayFrames[replayFrames.length - 1]?.seq ?? null,
          },
          events: {
            generatedFrames: sseMetrics.generatedFrames,
            broadcastBatches: sseMetrics.broadcastBatches,
            deliveredLiveStateEvents: sseMetrics.deliveredLiveStateEvents,
            deliveredReplayStateEvents: sseMetrics.deliveredReplayStateEvents,
            deliveredBootstrapStateEvents:
              sseMetrics.deliveredBootstrapStateEvents,
            deliveredReplayResetEvents: sseMetrics.deliveredReplayResetEvents,
            deliveredUnavailableEvents: sseMetrics.deliveredUnavailableEvents,
            heartbeatsSent: sseMetrics.heartbeatsSent,
            heartbeatFailures: sseMetrics.heartbeatFailures,
          },
          fanout: {
            lastDurationMs: sseMetrics.lastFanoutDurationMs,
            averageDurationMs: Number(
              sseMetrics.averageFanoutDurationMs.toFixed(3),
            ),
            maxDurationMs: sseMetrics.maxFanoutDurationMs,
            batchesOver50Ms: sseMetrics.fanoutOver50Ms,
            batchesOver100Ms: sseMetrics.fanoutOver100Ms,
          },
        },
        betting: {
          schemaVersion: bettingMetrics.schemaVersion,
          sourceEpoch: bettingMetrics.sourceEpoch,
          clients: bettingMetrics.clients,
          replay: bettingMetrics.replay,
        },
      });
    },
  );

  // SSE push endpoint with replay support (Last-Event-ID / ?since=)
  fastify.get<{
    Querystring: { since?: string };
  }>(
    "/api/streaming/state/events",
    {
      config: { rateLimit: STREAMING_STATUS_RATE_LIMIT },
    },
    async (request, reply) => {
      if (sseClients.size >= STREAMING_SSE_MAX_CLIENTS) {
        return reply.status(503).send({
          error: "Streaming SSE capacity reached",
          message: "Too many concurrent streaming SSE clients",
        });
      }

      const raw = reply.raw;
      reply.hijack();

      raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      raw.setHeader("Cache-Control", "no-cache, no-transform");
      raw.setHeader("Connection", "keep-alive");
      raw.setHeader("X-Accel-Buffering", "no");
      raw.setHeader("Access-Control-Allow-Origin", "*");
      raw.socket?.setNoDelay?.(true);
      raw.socket?.setKeepAlive?.(true, STREAMING_SSE_HEARTBEAT_MS * 2);
      raw.flushHeaders?.();
      raw.write("retry: 2000\n\n");

      const allocation = allocateNextStreamingSseClientId(
        nextClientId,
        sseClients,
      );
      const clientId = allocation.clientId;
      nextClientId = allocation.nextClientId;
      sseClients.set(clientId, reply);
      sseMetrics.totalConnected += 1;
      sseMetrics.peakConnected = Math.max(
        sseMetrics.peakConnected,
        sseClients.size,
      );

      const headerLastEventId = request.headers["last-event-id"];
      const normalizedHeaderId = Array.isArray(headerLastEventId)
        ? headerLastEventId[0]
        : headerLastEventId;
      const querySince = Number.parseInt(request.query.since || "", 10);
      const headerSince = Number.parseInt(normalizedHeaderId || "", 10);
      const lastSeenSeq = Number.isFinite(querySince)
        ? querySince
        : Number.isFinite(headerSince)
          ? headerSince
          : 0;

      if (replayFrames.length === 0) {
        captureStreamingFrame(true);
      }

      const oldestSeq = getOldestEligibleReplayFrame()?.seq ?? 0;
      const latestFrame = getLatestEligibleReplayFrame();

      if (lastSeenSeq > 0 && latestFrame) {
        if (lastSeenSeq < oldestSeq) {
          // Gap beyond replay window: send a reset snapshot so client can resync.
          const status = writeSseEvent(
            reply,
            "reset",
            latestFrame.payload,
            latestFrame.seq,
          );
          if (status !== "ok") {
            removeSseClientForStatus(clientId, status);
            return;
          }
          sseMetrics.deliveredReplayResetEvents += 1;
        } else {
          let deliveredReplayFrames = 0;
          const replayFramesForClient =
            getEligibleReplayFramesAfter(lastSeenSeq);
          for (const frame of replayFramesForClient) {
            const status = writeSseEvent(
              reply,
              "state",
              frame.payload,
              frame.seq,
            );
            if (status !== "ok") {
              removeSseClientForStatus(clientId, status);
              return;
            }
            deliveredReplayFrames += 1;
          }
          sseMetrics.deliveredReplayStateEvents += deliveredReplayFrames;
        }
      } else if (latestFrame) {
        const status = writeSseEvent(
          reply,
          "state",
          latestFrame.payload,
          latestFrame.seq,
        );
        if (status !== "ok") {
          removeSseClientForStatus(clientId, status);
          return;
        }
        sseMetrics.deliveredBootstrapStateEvents += 1;
      } else {
        const status = writeSseEvent(
          reply,
          "unavailable",
          JSON.stringify({
            error:
              STREAMING_PUBLIC_DELAY_MS > 0
                ? "Delayed stream warming up"
                : "Streaming mode not active",
            message:
              STREAMING_PUBLIC_DELAY_MS > 0
                ? `No delayed frame available yet (${STREAMING_PUBLIC_DELAY_MS}ms delay window)`
                : "The streaming duel scheduler is not running",
            emittedAt: Date.now(),
          }),
        );
        if (status !== "ok") {
          removeSseClientForStatus(clientId, status);
          return;
        }
        sseMetrics.deliveredUnavailableEvents += 1;
      }

      request.raw.on("close", () => {
        removeSseClient(clientId, "client-close");
      });

      startSseLoopsIfNeeded();
    },
  );

  // Get enriched duel context (state + inventories + internal monologues)
  fastify.get(
    "/api/streaming/duel-context",
    {
      config: { rateLimit: STREAMING_STATUS_RATE_LIMIT },
      preHandler: fastify.rateLimit(STREAMING_STATUS_RATE_LIMIT),
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        await STREAMING_STATUS_CODEQL_LIMITER.consume(_request.ip);
      } catch {
        return reply.code(429).send({ error: "Too Many Requests" });
      }
      const scheduler = getStreamingDuelScheduler();
      if (!scheduler) {
        return reply.status(503).send({
          error: "Streaming mode not active",
          message: "The streaming duel scheduler is not running",
        });
      }

      const state = getPublicStreamingState(scheduler);
      if (!state) {
        return reply.status(503).send({
          error: "Streaming delay warmup",
          message: `Delayed duel context is not yet available (${STREAMING_PUBLIC_DELAY_MS}ms delay window)`,
        });
      }
      const includeDetailedAgentTelemetry = STREAMING_PUBLIC_DELAY_MS <= 0;
      const enrichAgent = async (
        agent: {
          id: string;
          name: string;
          provider: string;
          model: string;
          hp: number;
          maxHp: number;
          combatLevel: number;
          wins: number;
          losses: number;
          damageDealtThisFight: number;
        } | null,
      ) => {
        if (!agent) return null;
        return {
          ...agent,
          inventory: includeDetailedAgentTelemetry
            ? getInventorySnapshot(world, agent.id)
            : [],
          monologues: includeDetailedAgentTelemetry
            ? await getThoughtsSnapshot(agent.id, 10)
            : [],
        };
      };

      return reply.send({
        type: "STREAMING_DUEL_CONTEXT",
        cycle: {
          ...state.cycle,
          agent1: await enrichAgent(state.cycle.agent1),
          agent2: await enrichAgent(state.cycle.agent2),
        },
        leaderboard: state.leaderboard,
        cameraTarget: state.cameraTarget,
      });
    },
  );

  fastify.get<{
    Params: { characterId: string };
    Querystring: { limit?: string };
  }>(
    "/api/streaming/agent/:characterId/monologues",
    {
      config: { rateLimit: STREAMING_STATUS_RATE_LIMIT },
      preHandler: fastify.rateLimit(STREAMING_STATUS_RATE_LIMIT),
    },
    async (request, reply) => {
      try {
        await STREAMING_STATUS_CODEQL_LIMITER.consume(request.ip);
      } catch {
        return reply.code(429).send({ error: "Too Many Requests" });
      }
      if (STREAMING_PUBLIC_DELAY_MS > 0) {
        return reply.send({
          characterId: request.params.characterId,
          thoughts: [],
          count: 0,
          delayed: true,
        });
      }
      const limit = normalizeStreamingThoughtLimit(request.query.limit);
      const thoughts = await getThoughtsSnapshot(
        request.params.characterId,
        limit,
      );
      return reply.send({
        characterId: request.params.characterId,
        thoughts,
        count: thoughts.length,
      });
    },
  );

  fastify.get<{
    Params: { characterId: string };
  }>(
    "/api/streaming/agent/:characterId/inventory",
    {
      config: { rateLimit: STREAMING_STATUS_RATE_LIMIT },
      preHandler: fastify.rateLimit(STREAMING_STATUS_RATE_LIMIT),
    },
    async (request, reply) => {
      try {
        await STREAMING_STATUS_CODEQL_LIMITER.consume(request.ip);
      } catch {
        return reply.code(429).send({ error: "Too Many Requests" });
      }
      if (STREAMING_PUBLIC_DELAY_MS > 0) {
        return reply.send({
          characterId: request.params.characterId,
          inventory: [],
          count: 0,
          delayed: true,
        });
      }
      const inventory = getInventorySnapshot(world, request.params.characterId);
      return reply.send({
        characterId: request.params.characterId,
        inventory,
        count: inventory.length,
      });
    },
  );

  // Get leaderboard
  fastify.get(
    "/api/streaming/leaderboard",
    {
      config: { rateLimit: STREAMING_STATUS_RATE_LIMIT },
      preHandler: fastify.rateLimit(STREAMING_STATUS_RATE_LIMIT),
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        await STREAMING_STATUS_CODEQL_LIMITER.consume(_request.ip);
      } catch {
        return reply.code(429).send({ error: "Too Many Requests" });
      }
      const scheduler = getStreamingDuelScheduler();

      if (!scheduler) {
        return reply.status(503).send({
          error: "Streaming mode not active",
          message: "The streaming duel scheduler is not running",
        });
      }

      const state = getPublicStreamingState(scheduler);
      if (!state) {
        return reply.status(503).send({
          error: "Streaming delay warmup",
          message: `Delayed leaderboard is not yet available (${STREAMING_PUBLIC_DELAY_MS}ms delay window)`,
        });
      }

      return reply.send({ leaderboard: state.leaderboard });
    },
  );

  // Get leaderboard + current duel cycle + recent duel history
  fastify.get<{
    Querystring: { historyLimit?: string };
  }>(
    "/api/streaming/leaderboard/details",
    {
      config: { rateLimit: STREAMING_STATUS_RATE_LIMIT },
      preHandler: fastify.rateLimit(STREAMING_STATUS_RATE_LIMIT),
    },
    async (request, reply) => {
      try {
        await STREAMING_STATUS_CODEQL_LIMITER.consume(request.ip);
      } catch {
        return reply.code(429).send({ error: "Too Many Requests" });
      }
      const scheduler = getStreamingDuelScheduler();

      if (!scheduler) {
        return reply.status(503).send({
          error: "Streaming mode not active",
          message: "The streaming duel scheduler is not running",
        });
      }

      const parsedLimit = Number.parseInt(
        request.query.historyLimit || "40",
        10,
      );
      const historyLimit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(parsedLimit, 200))
        : 40;

      const state = getPublicStreamingState(scheduler);
      if (!state) {
        return reply.status(503).send({
          error: "Streaming delay warmup",
          message: `Delayed leaderboard details are not yet available (${STREAMING_PUBLIC_DELAY_MS}ms delay window)`,
        });
      }

      const cutoff =
        STREAMING_PUBLIC_DELAY_MS > 0
          ? Date.now() - STREAMING_PUBLIC_DELAY_MS
          : Number.POSITIVE_INFINITY;
      const recentDuels = scheduler
        .getRecentDuels(historyLimit)
        .filter((duel) => duel.finishedAt <= cutoff)
        // Strip oracle-proof fields. They are persisted on RecentDuelEntry
        // for the keeper-only /api/streaming/results/:duelId catch-up path
        // (bearer-auth). Leaking them on this public, unauthenticated handler
        // would defeat that auth boundary — a caller could harvest proofs
        // from this endpoint and skip the bearer check entirely.
        .map(
          ({
            duelKeyHex: _k,
            duelEndTime: _e,
            seed: _s,
            replayHash: _r,
            ...publicEntry
          }) => publicEntry,
        );
      const delayedUpdatedAt =
        STREAMING_PUBLIC_DELAY_MS > 0
          ? (getLatestEligibleReplayFrame()?.emittedAt ?? Date.now())
          : Date.now();

      return reply.send({
        leaderboard: state.leaderboard,
        cycle: state.cycle,
        recentDuels,
        updatedAt: delayedUpdatedAt,
      });
    },
  );

  // Authoritative per-duel oracle result lookup for the hyperbet keeper.
  //
  // When the keeper misses a live `duel_ended` event (for example a restart
  // window), the bundle is stuck at LOCKED with no path forward because
  // Solana resolution requires the deterministic proof material
  // (duelKeyHex + seed + replayHash) that only arrive on that event. This
  // endpoint lets the keeper reconstruct the same authorized report payload
  // from the durable streaming_duel_history row.
  //
  // Bearer-auth requires HYPERSCAPES_RESULT_LOOKUP_BEARER_TOKEN (matches the
  // hyperbet keeper). The endpoint intentionally never falls back to the
  // general betting feed token because it returns settlement proof material.
  const authorizeResultsLookup = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const env = process.env as Record<string, string | undefined>;
    const resolution = resolveOracleProofAccessToken(env);
    const requiredToken = resolution.token;

    if (!requiredToken) {
      return reply.status(503).send({
        error: "Service unavailable",
        message: "Oracle proof auth token is not configured",
      });
    }

    const token = extractBettingFeedToken({
      authorizationHeader: request.headers.authorization,
    });
    if (hasValidBettingFeedToken(requiredToken, token)) {
      return;
    }

    return reply.status(401).send({
      error: "Unauthorized",
      message: "Missing or invalid oracle proof token",
    });
  };

  fastify.get<{
    Params: { duelId: string };
  }>(
    "/api/streaming/results/:duelId",
    {
      config: { rateLimit: AUTHENTICATED_RESULTS_RATE_LIMIT },
      preHandler: authorizeResultsLookup,
    },
    async (request, reply) => {
      const duelId = request.params.duelId?.trim();
      if (!duelId) {
        return reply.status(400).send({
          error: "Bad request",
          message: "duelId is required",
        });
      }
      if (!isValidStreamingResultDuelId(duelId)) {
        return reply.status(400).send({
          error: "Bad request",
          message: "Invalid duelId format",
        });
      }

      const db = getStorageDb();
      if (!db) {
        return reply.status(503).send({
          error: "Service unavailable",
          message: "Database is not available",
        });
      }

      const { streamingDuelHistory } = await import("../database/schema.js");
      const { eq } = await import("drizzle-orm");

      const rows = await db
        .select()
        .from(streamingDuelHistory)
        .where(eq(streamingDuelHistory.duelId, duelId))
        .limit(1);
      const row = rows[0];

      if (!row) {
        return reply.status(404).send(buildStreamingResultNotFoundPayload());
      }

      // Audit trail: oracle-proof material (duelKeyHex, seed, replayHash) is
      // settlement-grade data. Hash the caller IP so logs can correlate access
      // patterns without storing direct keeper network identifiers.
      fastify.log.info(
        {
          duelId: row.duelId,
          cycleId: row.cycleId,
          callerIpHash: hashAuditValue(request.ip),
        },
        "[streaming] oracle-proof retrieval",
      );

      // Legacy rows written before migration 0055 may not carry the oracle
      // proof fields. Callers must handle this by waiting and retrying —
      // the current live duel will write fresh rows with the full proof.
      // The 409 response intentionally does NOT leak the schema-migration
      // number; that's an internal detail.
      if (!row.seed || !row.replayHash || !row.duelKeyHex) {
        return reply.status(409).send({
          error: "Incomplete proof",
          message: "Oracle proof is not available for this duel.",
          duelId: row.duelId,
          cycleId: row.cycleId,
        });
      }

      return reply.send({
        duelId: row.duelId,
        cycleId: row.cycleId,
        duelKeyHex: row.duelKeyHex,
        duelEndTime: row.duelEndTime,
        seed: row.seed,
        replayHash: row.replayHash,
        winnerId: row.winnerId,
        winnerName: row.winnerName,
        loserId: row.loserId,
        loserName: row.loserName,
        winReason: row.winReason,
        damageWinner: row.damageWinner,
        damageLoser: row.damageLoser,
        finishedAt: row.finishedAt,
      });
    },
  );

  // Get streaming configuration
  fastify.get(
    "/api/streaming/config",
    {
      config: { rateLimit: STREAMING_STATUS_RATE_LIMIT },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        enabled: process.env.STREAMING_DUEL_ENABLED !== "false",
        cycleDuration: STREAMING_TIMING.CYCLE_DURATION,
        announcementDuration: STREAMING_TIMING.ANNOUNCEMENT_DURATION,
        fightDuration: STREAMING_TIMING.FIGHTING_DURATION,
        endWarningDuration: STREAMING_TIMING.END_WARNING_DURATION,
        resolutionDuration: STREAMING_TIMING.RESOLUTION_DURATION,
        canonicalPlatform: STREAMING_CANONICAL_PLATFORM,
        publicDelayMs: STREAMING_PUBLIC_DELAY_MS,
        publicDelayDefaultMs: STREAMING_PUBLIC_DELAY_DEFAULT_MS,
        publicDelayOverridden: STREAMING_PUBLIC_DELAY_OVERRIDDEN,
        wsUrl: process.env.PUBLIC_WS_URL || "ws://localhost:5555/ws",
      });
    },
  );

  // Get RTMP bridge status
  //
  // Rate limiting layers: global @fastify/rate-limit plugin (100/min per IP,
  // http-server.ts), per-route config.rateLimit (120/min), and
  // codeqlStatusRateLimitPreHandler which invokes rate-limiter-flexible in
  // the exact pattern CodeQL's RouteHandlerLimitedByRateLimiterFlexible
  // class recognizes.
  fastify.get(
    "/api/streaming/rtmp/status",
    {
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
      preHandler: codeqlStatusRateLimitPreHandler,
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const persistedAuthorityState = await loadPersistedStreamStateSafely();
      const externalSnapshot = await loadExternalRtmpStatusSnapshot(
        EXTERNAL_RTMP_STATUS_FILE || null,
        EXTERNAL_RTMP_STATUS_MAX_AGE_MS,
      );
      const canonicalProbeSnapshot = canonicalPlaybackProbePoller
        ? await canonicalPlaybackProbePoller
            .refresh()
            .then(() => canonicalPlaybackProbePoller.getSnapshot())
        : null;
      const localHlsManifest = readLocalHlsManifestSnapshot(process.env);
      if (externalSnapshot) {
        const rendererHealth = deriveBettingRendererHealth(
          getStreamingDuelScheduler()?.getCurrentCycle() ?? null,
          {
            externalStatusSnapshot: externalSnapshot,
            externalStatusMaxAgeMs: EXTERNAL_RTMP_STATUS_MAX_AGE_MS,
            localHlsManifest,
            captureStats: {
              clientConnected: externalSnapshot.clientConnected === true,
              ffmpegRunning: externalSnapshot.ffmpegRunning === true,
            },
          },
        );

        return reply.send(
          buildStreamingStatusPayload({
            base: {
              running: externalSnapshot.active === true,
              bridgeActive: externalSnapshot.active === true,
              ffmpegRunning: externalSnapshot.ffmpegRunning === true,
              clientConnected: externalSnapshot.clientConnected === true,
              destinations: externalSnapshot.destinations,
              stats: externalSnapshot.stats,
            },
            externalSnapshot,
            canonicalProbeSnapshot,
            localHlsManifest,
            rendererHealth,
            persistedAuthorityState,
            cloudflareLiveInputId,
            captureStats: {
              clientConnected: externalSnapshot.clientConnected === true,
              ffmpegRunning: externalSnapshot.ffmpegRunning === true,
            },
          }),
        );
      }

      try {
        const bridge = peekRTMPBridge();
        if (!bridge) {
          return reply.status(503).send({
            error: "RTMP bridge unavailable",
            message: "The RTMP streaming bridge has not been started",
          });
        }
        const status = bridge.getStatus();
        const stats = bridge.getStats();
        const rendererHealth = deriveBettingRendererHealth(
          getStreamingDuelScheduler()?.getCurrentCycle() ?? null,
          {
            externalStatusSnapshot: externalSnapshot,
            externalStatusMaxAgeMs: EXTERNAL_RTMP_STATUS_MAX_AGE_MS,
            localHlsManifest,
          },
        );

        return reply.send(
          buildStreamingStatusPayload({
            base: {
              ...status,
              stats: {
                bytesReceived: stats.bytesReceived,
                bytesReceivedMB: (stats.bytesReceived / 1024 / 1024).toFixed(2),
                uptimeSeconds: Math.floor(stats.uptime / 1000),
                destinations: stats.destinations,
                healthy: stats.healthy,
                droppedFrames: stats.droppedFrames,
                encoderFps: null,
                backpressured: stats.backpressured,
                spectators: stats.spectators,
                processMemory: stats.processMemory,
              },
            },
            externalSnapshot,
            canonicalProbeSnapshot,
            localHlsManifest,
            bridgeStats: stats,
            rendererHealth,
            persistedAuthorityState,
            cloudflareLiveInputId,
            captureStats: {
              clientConnected: status.clientConnected,
              ffmpegRunning: status.ffmpegRunning,
            },
          }),
        );
      } catch {
        return reply.status(503).send({
          error: "RTMP bridge not initialized",
          message: "The RTMP streaming bridge has not been started",
        });
      }
    },
  );

  // Get stream capture status (headless browser → HLS pipeline)
  // Same CodeQL-visible rate-limiter-flexible preHandler as /rtmp/status;
  // see comment there for the rationale.
  fastify.get(
    "/api/streaming/capture/status",
    {
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
      preHandler: codeqlStatusRateLimitPreHandler,
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const persistedAuthorityState = await loadPersistedStreamStateSafely();
        const capture = getStreamCapture();
        const localHlsManifest = readLocalHlsManifestSnapshot(process.env);
        const externalSnapshot = await loadExternalRtmpStatusSnapshot(
          EXTERNAL_RTMP_STATUS_FILE || null,
          EXTERNAL_RTMP_STATUS_MAX_AGE_MS,
          { allowStale: true },
        );
        const canonicalProbeSnapshot = canonicalPlaybackProbePoller
          ? await canonicalPlaybackProbePoller
              .refresh()
              .then(() => canonicalPlaybackProbePoller.getSnapshot())
          : null;
        const captureStats = capture.getStats();
        const rendererHealth = deriveBettingRendererHealth(
          getStreamingDuelScheduler()?.getCurrentCycle() ?? null,
          {
            externalStatusSnapshot: externalSnapshot,
            externalStatusMaxAgeMs: EXTERNAL_RTMP_STATUS_MAX_AGE_MS,
            localHlsManifest,
            captureStats,
          },
        );
        return reply.send(
          buildStreamingStatusPayload({
            base: captureStats,
            externalSnapshot,
            canonicalProbeSnapshot,
            localHlsManifest,
            rendererHealth,
            persistedAuthorityState,
            cloudflareLiveInputId,
            captureStats,
          }),
        );
      } catch {
        return reply.status(503).send({
          error: "Stream capture not initialized",
          message: "The stream capture pipeline has not been started",
        });
      }
    },
  );

  fastify.get(
    "/api/streaming/capture/smoke",
    {
      preHandler: fastify.rateLimit(STREAMING_STATUS_RATE_LIMIT),
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const externalSnapshot = await loadExternalRtmpStatusSnapshot(
          EXTERNAL_RTMP_STATUS_FILE || null,
          EXTERNAL_RTMP_STATUS_MAX_AGE_MS,
          { allowStale: true },
        );
        const delivery =
          externalSnapshot?.delivery ?? resolveStreamDeliveryInfo(process.env);
        return reply.send({
          ...normalizeStreamingStatusSmoke({
            externalSnapshot,
            deliveryModeFallback: delivery.mode,
          }),
          sourceRuntime: deriveStreamSourceRuntime({
            externalStatusSnapshot: externalSnapshot,
            externalStatusMaxAgeMs: EXTERNAL_RTMP_STATUS_MAX_AGE_MS,
            rendererHealth: deriveBettingRendererHealth(
              getStreamingDuelScheduler()?.getCurrentCycle() ?? null,
              {
                externalStatusSnapshot: externalSnapshot,
                externalStatusMaxAgeMs: EXTERNAL_RTMP_STATUS_MAX_AGE_MS,
                localHlsManifest: readLocalHlsManifestSnapshot(process.env),
                captureStats: getStreamCapture().getStats(),
              },
            ),
            localHlsManifest: readLocalHlsManifestSnapshot(process.env),
            captureStats: getStreamCapture().getStats(),
            requireExternalWorker: REQUIRE_EXTERNAL_SOURCE_RUNTIME,
          }),
        });
      } catch {
        return reply.status(503).send({
          error: "Stream capture smoke unavailable",
          message:
            "The stream capture smoke summary is not available right now",
        });
      }
    },
  );
}
