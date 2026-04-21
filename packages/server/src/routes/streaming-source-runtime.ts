import type { HlsManifestSnapshot } from "../streaming/stream-status-artifacts.js";
import {
  buildUnavailableStreamSourceRuntime,
  normalizeStreamSourceCaptureMode,
  normalizeStreamSourceRuntime,
  type StreamSourceDegradedReason,
  type StreamSourceRuntime,
} from "../streaming/source-runtime.js";
import type { BettingFeedRendererHealth } from "./streaming-betting-feed.js";
import type { ExternalRtmpStatusSnapshot } from "./streaming-external-status.js";

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isFreshTimestamp(
  timestampMs: number | null,
  nowMs: number,
  maxAgeMs: number,
): boolean {
  return (
    timestampMs != null &&
    Number.isFinite(timestampMs) &&
    Math.max(0, nowMs - timestampMs) <= maxAgeMs
  );
}

function mapRendererDegradedReasonToSourceReason(
  degradedReason: string | null | undefined,
): StreamSourceDegradedReason | null {
  const normalized = (degradedReason ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "manifest_stale") return "manifest_stale";
  if (
    normalized === "capture_pipeline_inactive" ||
    normalized === "ffmpeg_not_running" ||
    normalized === "encoder_fps_low"
  ) {
    return "encoder_stalled";
  }
  if (
    normalized === "capture_client_disconnected" ||
    normalized === "bridge_inactive" ||
    normalized === "render_tick_stale" ||
    normalized === "visual_change_stale" ||
    normalized === "capture_fps_low"
  ) {
    return "capture_stalled";
  }
  if (
    normalized === "capture_page_missing" ||
    normalized === "loading_overlay_active" ||
    normalized === "canvas_missing" ||
    normalized === "initialization_failed" ||
    normalized === "asset_origin_incomplete" ||
    normalized === "socket_disconnected" ||
    normalized === "stream_state_missing" ||
    normalized === "waiting_for_duel_data" ||
    normalized === "world_not_ready" ||
    normalized === "terrain_not_ready" ||
    normalized === "camera_target_unresolved" ||
    normalized === "avatar_not_ready" ||
    normalized === "initializing" ||
    normalized === "agents_missing" ||
    normalized === "invalid_agent_hp" ||
    normalized === "arena_positions_invalid"
  ) {
    return "page_not_ready";
  }
  if (normalized.startsWith("probe_failed:")) {
    return "page_not_ready";
  }
  return null;
}

function resolveFallbackSourceReason(params: {
  rendererHealth: BettingFeedRendererHealth | null;
  externalSnapshot: ExternalRtmpStatusSnapshot | null;
  localHlsManifest?: HlsManifestSnapshot | null;
  captureStats?:
    | {
        clientConnected: boolean;
        ffmpegRunning: boolean;
      }
    | null
    | undefined;
  nowMs: number;
  externalStatusMaxAgeMs: number;
}): StreamSourceDegradedReason | null {
  const { rendererHealth, externalSnapshot, localHlsManifest, captureStats } =
    params;
  const rendererReason = mapRendererDegradedReasonToSourceReason(
    rendererHealth?.degradedReason,
  );
  if (rendererReason) {
    return rendererReason;
  }

  const ffmpegRunning =
    externalSnapshot?.ffmpegRunning === true ||
    captureStats?.ffmpegRunning === true;
  if (!ffmpegRunning) {
    return "encoder_stalled";
  }

  const clientConnected =
    externalSnapshot?.clientConnected === true ||
    captureStats?.clientConnected === true;
  if (!clientConnected) {
    return "capture_stalled";
  }

  const probeOnly = externalSnapshot?.ingest?.probeOnly === true;
  const manifestUpdatedAt =
    asFiniteNumber(externalSnapshot?.hlsManifest?.updatedAt) ??
    asFiniteNumber(localHlsManifest?.updatedAt);
  if (
    !probeOnly &&
    manifestUpdatedAt != null &&
    !isFreshTimestamp(
      manifestUpdatedAt,
      params.nowMs,
      params.externalStatusMaxAgeMs,
    )
  ) {
    return "manifest_stale";
  }

  return null;
}

export function deriveStreamSourceRuntime(params: {
  externalStatusSnapshot?: ExternalRtmpStatusSnapshot | null;
  externalStatusMaxAgeMs: number;
  rendererHealth?: BettingFeedRendererHealth | null;
  localHlsManifest?: HlsManifestSnapshot | null;
  captureStats?:
    | {
        clientConnected: boolean;
        ffmpegRunning: boolean;
      }
    | null
    | undefined;
  nowMs?: number;
  requireExternalWorker?: boolean;
}): StreamSourceRuntime {
  const nowMs = params.nowMs ?? Date.now();
  const externalSnapshot = params.externalStatusSnapshot ?? null;
  const normalizedExternalRuntime = normalizeStreamSourceRuntime(
    externalSnapshot?.sourceRuntime,
  );
  const snapshotHeartbeatAt =
    normalizedExternalRuntime?.workerHeartbeatAt ??
    asFiniteNumber(externalSnapshot?.updatedAt);
  const requireExternalWorker = params.requireExternalWorker === true;

  if (requireExternalWorker && !externalSnapshot) {
    return buildUnavailableStreamSourceRuntime({
      statusSource: "external_worker",
      degradedReason: "worker_missing",
      workerHeartbeatAt: null,
    });
  }

  if (
    requireExternalWorker &&
    externalSnapshot &&
    !isFreshTimestamp(snapshotHeartbeatAt, nowMs, params.externalStatusMaxAgeMs)
  ) {
    return buildUnavailableStreamSourceRuntime({
      statusSource: "external_worker",
      captureMode: normalizedExternalRuntime?.captureMode ?? "none",
      degradedReason: "status_stale",
      currentSceneUrl: normalizedExternalRuntime?.currentSceneUrl ?? null,
      activeBundle: normalizedExternalRuntime?.activeBundle ?? null,
      lastFrameAt: normalizedExternalRuntime?.lastFrameAt ?? null,
      lastRenderTickAt: normalizedExternalRuntime?.lastRenderTickAt ?? null,
      lastVisualChangeAt: normalizedExternalRuntime?.lastVisualChangeAt ?? null,
      lastRecoveryAt: normalizedExternalRuntime?.lastRecoveryAt ?? null,
      recoveryCount: normalizedExternalRuntime?.recoveryCount ?? 0,
      workerHeartbeatAt: snapshotHeartbeatAt,
    });
  }

  if (normalizedExternalRuntime) {
    return normalizedExternalRuntime;
  }

  const degradedReason = resolveFallbackSourceReason({
    rendererHealth: params.rendererHealth ?? null,
    externalSnapshot,
    localHlsManifest: params.localHlsManifest,
    captureStats: params.captureStats,
    nowMs,
    externalStatusMaxAgeMs: params.externalStatusMaxAgeMs,
  });

  return {
    ready: degradedReason == null,
    statusSource: externalSnapshot ? "external_worker" : "in_process_bridge",
    captureMode:
      normalizeStreamSourceCaptureMode(externalSnapshot?.captureMode) ?? "none",
    degradedReason,
    currentSceneUrl: externalSnapshot?.smoke?.currentSceneUrl ?? null,
    activeBundle: externalSnapshot?.smoke?.activeBundle ?? null,
    lastFrameAt: asFiniteNumber(externalSnapshot?.metrics?.latestFrameAt),
    lastRenderTickAt: asFiniteNumber(
      externalSnapshot?.metrics?.latestRenderTickAt,
    ),
    lastVisualChangeAt: asFiniteNumber(
      externalSnapshot?.metrics?.latestVisualChangeAt,
    ),
    lastRecoveryAt: null,
    recoveryCount: 0,
    workerHeartbeatAt: snapshotHeartbeatAt,
  };
}
