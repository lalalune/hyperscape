export type StreamSourceStatusSource =
  | "external_worker"
  | "in_process_bridge"
  | "none";

export type StreamSourceCaptureMode =
  | "cdp"
  | "webcodecs"
  | "mediarecorder"
  | "x11_nvenc"
  | "none";

export type StreamSourceDegradedReason =
  | "worker_missing"
  | "browser_missing"
  | "page_not_ready"
  | "unexpected_navigation"
  | "capture_stalled"
  | "encoder_stalled"
  | "manifest_stale"
  | "destination_disconnected"
  | "status_stale"
  | "unknown";

export type StreamSourceRuntime = {
  ready: boolean;
  statusSource: StreamSourceStatusSource;
  captureMode: StreamSourceCaptureMode;
  degradedReason: StreamSourceDegradedReason | null;
  currentSceneUrl: string | null;
  activeBundle: string | null;
  lastFrameAt: number | null;
  lastRenderTickAt: number | null;
  lastVisualChangeAt: number | null;
  lastRecoveryAt: number | null;
  recoveryCount: number;
  workerHeartbeatAt: number | null;
};

export type BrowserCaptureStatusSnapshot = {
  lastChunkAt?: number | null;
  lastChunkAgeMs?: number | null;
  lastChunkMs?: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeNonNegativeFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : null;
}

export function normalizeStreamSourceStatusSource(
  value: unknown,
): StreamSourceStatusSource | null {
  return value === "external_worker" ||
    value === "in_process_bridge" ||
    value === "none"
    ? value
    : null;
}

export function normalizeStreamSourceCaptureMode(
  value: unknown,
): StreamSourceCaptureMode | null {
  return value === "cdp" ||
    value === "webcodecs" ||
    value === "mediarecorder" ||
    value === "x11_nvenc" ||
    value === "none"
    ? value
    : null;
}

export function normalizeStreamSourceDegradedReason(
  value: unknown,
): StreamSourceDegradedReason | null {
  return value === "worker_missing" ||
    value === "browser_missing" ||
    value === "page_not_ready" ||
    value === "unexpected_navigation" ||
    value === "capture_stalled" ||
    value === "encoder_stalled" ||
    value === "manifest_stale" ||
    value === "destination_disconnected" ||
    value === "status_stale" ||
    value === "unknown"
    ? value
    : null;
}

export function normalizeStreamSourceRuntime(
  value: unknown,
): StreamSourceRuntime | null {
  const candidate = asRecord(value);
  if (!candidate) return null;

  return {
    ready: candidate.ready === true,
    statusSource:
      normalizeStreamSourceStatusSource(candidate.statusSource) ?? "none",
    captureMode:
      normalizeStreamSourceCaptureMode(candidate.captureMode) ?? "none",
    degradedReason: normalizeStreamSourceDegradedReason(
      candidate.degradedReason,
    ),
    currentSceneUrl: asNonEmptyString(candidate.currentSceneUrl),
    activeBundle: asNonEmptyString(candidate.activeBundle),
    lastFrameAt: asFiniteNumber(candidate.lastFrameAt),
    lastRenderTickAt: asFiniteNumber(candidate.lastRenderTickAt),
    lastVisualChangeAt: asFiniteNumber(candidate.lastVisualChangeAt),
    lastRecoveryAt: asFiniteNumber(candidate.lastRecoveryAt),
    recoveryCount: Math.max(0, asFiniteNumber(candidate.recoveryCount) ?? 0),
    workerHeartbeatAt: asFiniteNumber(candidate.workerHeartbeatAt),
  };
}

export function resolveBrowserCaptureLastFrameAt(
  status: BrowserCaptureStatusSnapshot | null | undefined,
  nowMs: number,
): number | null {
  const lastChunkAt = normalizeNonNegativeFiniteNumber(status?.lastChunkAt);
  if (lastChunkAt != null && lastChunkAt > 0) {
    return lastChunkAt;
  }

  const lastChunkAgeMs =
    normalizeNonNegativeFiniteNumber(status?.lastChunkAgeMs) ??
    normalizeNonNegativeFiniteNumber(status?.lastChunkMs);
  if (lastChunkAgeMs == null) {
    return null;
  }

  return Math.max(0, nowMs - lastChunkAgeMs);
}

export function buildUnavailableStreamSourceRuntime(params?: {
  statusSource?: StreamSourceStatusSource;
  captureMode?: StreamSourceCaptureMode;
  degradedReason?: StreamSourceDegradedReason | null;
  currentSceneUrl?: string | null;
  activeBundle?: string | null;
  lastFrameAt?: number | null;
  lastRenderTickAt?: number | null;
  lastVisualChangeAt?: number | null;
  lastRecoveryAt?: number | null;
  recoveryCount?: number;
  workerHeartbeatAt?: number | null;
}): StreamSourceRuntime {
  return {
    ready: false,
    statusSource: params?.statusSource ?? "none",
    captureMode: params?.captureMode ?? "none",
    degradedReason: params?.degradedReason ?? "unknown",
    currentSceneUrl: params?.currentSceneUrl ?? null,
    activeBundle: params?.activeBundle ?? null,
    lastFrameAt: params?.lastFrameAt ?? null,
    lastRenderTickAt: params?.lastRenderTickAt ?? null,
    lastVisualChangeAt: params?.lastVisualChangeAt ?? null,
    lastRecoveryAt: params?.lastRecoveryAt ?? null,
    recoveryCount: Math.max(0, params?.recoveryCount ?? 0),
    workerHeartbeatAt: params?.workerHeartbeatAt ?? null,
  };
}
