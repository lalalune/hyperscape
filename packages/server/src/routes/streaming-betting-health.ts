import type { StreamingGuardrailPhase } from "@hyperscape/shared";
import {
  deriveStreamingGuardrailReason,
  isActiveStreamingGuardrailPhase,
} from "@hyperscape/shared";
import type { StreamingDuelCycle } from "../systems/StreamingDuelScheduler/types.js";
import { getStreamCapture } from "../streaming/stream-capture.js";
import type { HlsManifestSnapshot } from "../streaming/stream-status-artifacts.js";
import type { BettingFeedRendererHealth } from "./streaming-betting-feed.js";
import type {
  ExternalHlsManifestBlob,
  ExternalRendererMetricsBlob,
  ExternalRtmpStatusSnapshot,
} from "./streaming-external-status.js";

// External CDP capture status is sampled out-of-process and can legitimately
// arrive several seconds behind the HLS edge. Keep this above segment cadence
// plus polling jitter so healthy self-HLS playback is not blanked prematurely.
const RENDER_TICK_STALE_MS = 10_000;
const VISUAL_CHANGE_STALE_MS = 5_000;
const VISUAL_CHANGE_GRACE_MS = 8_000;
const DEFAULT_MIN_ENCODE_FPS = 24;
const MIN_ENCODE_FPS_TARGET_RATIO = 0.8;

type NormalizedRendererMetrics = {
  captureFps: number | null;
  encodeFps: number | null;
  latestRenderTickAt: number | null;
  latestVisualChangeAt: number | null;
  visualChangeAgeMs: number | null;
};

type NormalizedHlsManifest = {
  updatedAt: number | null;
  mediaSequence: number | null;
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeRendererHealthSnapshot(
  value: unknown,
): BettingFeedRendererHealth | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  return {
    ready: candidate.ready === true,
    degradedReason: asString(candidate.degradedReason),
    updatedAt: asFiniteNumber(candidate.updatedAt),
  };
}

function normalizeRendererMetrics(
  value: ExternalRendererMetricsBlob | undefined,
): NormalizedRendererMetrics | null {
  if (!value || typeof value !== "object") return null;
  return {
    captureFps: asFiniteNumber(value.captureFps),
    encodeFps: asFiniteNumber(value.encodeFps),
    latestRenderTickAt: asFiniteNumber(value.latestRenderTickAt),
    latestVisualChangeAt: asFiniteNumber(value.latestVisualChangeAt),
    visualChangeAgeMs: asFiniteNumber(value.visualChangeAgeMs),
  };
}

function normalizeHlsManifest(
  value: ExternalHlsManifestBlob | HlsManifestSnapshot | undefined | null,
): NormalizedHlsManifest | null {
  if (!value || typeof value !== "object") return null;
  return {
    updatedAt: asFiniteNumber(value.updatedAt),
    mediaSequence: asFiniteNumber(value.mediaSequence),
  };
}

function resolveTargetEncodeFps(
  externalSnapshot: ExternalRtmpStatusSnapshot | null,
): number | null {
  return (
    asFiniteNumber(externalSnapshot?.ingest?.targetFps) ??
    asFiniteNumber(externalSnapshot?.smoke?.ingest?.targetFps) ??
    null
  );
}

function resolveMinEncodeFps(targetEncodeFps: number | null): number {
  const explicit = Number.parseInt(process.env.STREAM_MIN_ENCODE_FPS || "", 10);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  if (targetEncodeFps != null && targetEncodeFps > 0) {
    return Math.max(
      1,
      Math.floor(targetEncodeFps * MIN_ENCODE_FPS_TARGET_RATIO),
    );
  }
  return DEFAULT_MIN_ENCODE_FPS;
}

function isFreshHlsManifest(params: {
  hlsManifest: NormalizedHlsManifest | null;
  nowMs: number;
  freshnessMs: number;
}): boolean {
  const { hlsManifest, nowMs, freshnessMs } = params;
  if (!hlsManifest) return false;
  if (hlsManifest.mediaSequence == null || hlsManifest.updatedAt == null) {
    return false;
  }
  return Math.max(0, nowMs - hlsManifest.updatedAt) <= freshnessMs;
}

function deriveCycleGuardrailReason(
  cycle: StreamingDuelCycle | null,
): string | null {
  if (!cycle) {
    return null;
  }
  return deriveStreamingGuardrailReason({
    phase: cycle.phase as StreamingGuardrailPhase | null | undefined,
    agent1: cycle.agent1
      ? {
          id: cycle.agent1.characterId,
          name: cycle.agent1.name,
          hp: cycle.agent1.currentHp,
          maxHp: cycle.agent1.maxHp,
        }
      : null,
    agent2: cycle.agent2
      ? {
          id: cycle.agent2.characterId,
          name: cycle.agent2.name,
          hp: cycle.agent2.currentHp,
          maxHp: cycle.agent2.maxHp,
        }
      : null,
    arenaPositions: cycle.arenaPositions,
  });
}

function phaseNeedsLiveRender(cycle: StreamingDuelCycle | null): boolean {
  return cycle?.phase != null && cycle.phase !== "IDLE";
}

function phaseNeedsVisualChange(cycle: StreamingDuelCycle | null): boolean {
  return (
    cycle?.phase === "COUNTDOWN" ||
    cycle?.phase === "FIGHTING" ||
    cycle?.phase === "RESOLUTION"
  );
}

function isWithinVisualChangeGraceWindow(
  cycle: StreamingDuelCycle | null,
  nowMs: number,
): boolean {
  if (!cycle || !phaseNeedsVisualChange(cycle)) {
    return false;
  }

  return Math.max(0, nowMs - cycle.phaseStartTime) < VISUAL_CHANGE_GRACE_MS;
}

function deriveMetricsDegradedReason(params: {
  cycle: StreamingDuelCycle | null;
  metrics: NormalizedRendererMetrics | null;
  hlsManifest: NormalizedHlsManifest | null;
  nowMs: number;
  externalStatusMaxAgeMs: number;
  minEncodeFps: number;
}): string | null {
  const {
    cycle,
    metrics,
    hlsManifest,
    nowMs,
    externalStatusMaxAgeMs,
    minEncodeFps,
  } = params;
  if (!phaseNeedsLiveRender(cycle)) {
    return null;
  }
  if (!metrics && !hlsManifest) {
    return null;
  }
  if (metrics != null) {
    const renderTickAgeMs =
      metrics.latestRenderTickAt != null
        ? Math.max(0, nowMs - metrics.latestRenderTickAt)
        : null;
    if (renderTickAgeMs == null || renderTickAgeMs > RENDER_TICK_STALE_MS) {
      return "render_tick_stale";
    }

    if (!phaseNeedsVisualChange(cycle)) {
      return null;
    }

    const withinVisualChangeGraceWindow = isWithinVisualChangeGraceWindow(
      cycle,
      nowMs,
    );
    if (
      !withinVisualChangeGraceWindow &&
      (metrics.visualChangeAgeMs == null ||
        metrics.visualChangeAgeMs >= VISUAL_CHANGE_STALE_MS)
    ) {
      return "visual_change_stale";
    }
    // captureFps is raw browser compositor ingress. In CDP mode we intentionally
    // throttle source frames and repeat the latest valid frame to keep encoder
    // cadence stable, so content freshness and encodeFps are the hard gates.
    if (metrics.encodeFps != null && metrics.encodeFps < minEncodeFps) {
      return "encoder_fps_low";
    }

    return null;
  }

  const manifestFresh = isFreshHlsManifest({
    hlsManifest,
    nowMs,
    freshnessMs: externalStatusMaxAgeMs,
  });
  if (!manifestFresh) {
    return "manifest_stale";
  }

  return null;
}

export function deriveBettingRendererHealth(
  cycle: StreamingDuelCycle | null,
  options?: {
    externalStatusSnapshot?: ExternalRtmpStatusSnapshot | null;
    externalStatusMaxAgeMs?: number;
    nowMs?: number;
    localHlsManifest?: HlsManifestSnapshot | null;
    captureStats?: {
      clientConnected: boolean;
      ffmpegRunning: boolean;
    };
  },
): BettingFeedRendererHealth {
  const updatedAt = options?.nowMs ?? Date.now();
  const externalStatusMaxAgeMs = options?.externalStatusMaxAgeMs ?? 15_000;
  const guardrailReason = deriveCycleGuardrailReason(cycle);
  if (guardrailReason) {
    return {
      ready: false,
      degradedReason: guardrailReason,
      updatedAt,
    };
  }

  const externalSnapshot = options?.externalStatusSnapshot ?? null;
  const externalRendererHealth = normalizeRendererHealthSnapshot(
    externalSnapshot?.rendererHealth,
  );
  const externalRendererMetrics = normalizeRendererMetrics(
    externalSnapshot?.metrics,
  );
  const externalHlsManifest =
    normalizeHlsManifest(externalSnapshot?.hlsManifest) ??
    normalizeHlsManifest(options?.localHlsManifest);
  const minEncodeFps = resolveMinEncodeFps(
    resolveTargetEncodeFps(externalSnapshot),
  );
  const metricsReason = deriveMetricsDegradedReason({
    cycle,
    metrics: externalRendererMetrics,
    hlsManifest: externalHlsManifest,
    nowMs: updatedAt,
    externalStatusMaxAgeMs,
    minEncodeFps,
  });

  if (externalRendererHealth) {
    const healthSnapshotUpdatedAt =
      asFiniteNumber(externalSnapshot?.updatedAt) ??
      externalRendererHealth.updatedAt;
    const ageMs =
      healthSnapshotUpdatedAt != null
        ? Math.max(0, updatedAt - healthSnapshotUpdatedAt)
        : null;
    if (
      healthSnapshotUpdatedAt != null &&
      ageMs != null &&
      ageMs > externalStatusMaxAgeMs
    ) {
      return {
        ready: false,
        degradedReason: "renderer_health_stale",
        updatedAt,
      };
    }

    if (metricsReason) {
      return {
        ready: false,
        degradedReason: metricsReason,
        updatedAt,
      };
    }

    if (
      !externalRendererHealth.ready &&
      externalRendererHealth.degradedReason &&
      externalRendererHealth.degradedReason !== "renderer_health_stale"
    ) {
      return {
        ...externalRendererHealth,
        updatedAt: healthSnapshotUpdatedAt,
      };
    }

    if (externalRendererHealth.ready || !phaseNeedsVisualChange(cycle)) {
      return {
        ...externalRendererHealth,
        updatedAt: healthSnapshotUpdatedAt,
      };
    }

    if (externalRendererMetrics || externalHlsManifest) {
      return {
        ready: true,
        degradedReason: null,
        updatedAt:
          externalRendererHealth.updatedAt ??
          externalHlsManifest?.updatedAt ??
          updatedAt,
      };
    }
  } else if (metricsReason) {
    return {
      ready: false,
      degradedReason: metricsReason,
      updatedAt,
    };
  }

  if (
    isFreshHlsManifest({
      hlsManifest: externalHlsManifest,
      nowMs: updatedAt,
      freshnessMs: externalStatusMaxAgeMs,
    })
  ) {
    return {
      ready: true,
      degradedReason: null,
      updatedAt: externalHlsManifest?.updatedAt ?? updatedAt,
    };
  }

  const captureStats = options?.captureStats ?? getStreamCapture().getStats();
  if (
    isActiveStreamingGuardrailPhase(cycle?.phase as StreamingGuardrailPhase)
  ) {
    if (!captureStats.clientConnected) {
      return {
        ready: false,
        degradedReason: "capture_client_disconnected",
        updatedAt,
      };
    }
    if (!captureStats.ffmpegRunning) {
      return {
        ready: false,
        degradedReason: "capture_pipeline_inactive",
        updatedAt,
      };
    }
  }

  return {
    ready: true,
    degradedReason: null,
    updatedAt,
  };
}
