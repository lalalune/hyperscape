import fs from "node:fs/promises";
import type {
  StreamDeliveryInfo,
  StreamDeliveryMode,
  StreamManifestStatus,
  StreamDeliveryTransport,
  StreamDestinationProvider,
  StreamDestinationRole,
} from "../streaming/delivery-config.js";
import type {
  StreamSourceCaptureMode,
  StreamSourceRuntime,
} from "../streaming/source-runtime.js";

/** A single RTMP destination entry from the external status file. */
export interface ExternalRtmpDestination {
  id?: string;
  name?: string;
  role?: StreamDestinationRole;
  provider?: StreamDestinationProvider;
  transport?: StreamDeliveryTransport;
  playbackUrl?: string | null;
  ingestUrl?: string | null;
  url?: string;
  status?: string;
  connected?: boolean;
  bytesWritten?: number;
  startedAt?: number;
  error?: string;
  /** External encoders may include additional fields. */
  [key: string]: unknown;
}

/** Aggregate stream statistics from the external RTMP encoder. */
export interface ExternalRtmpStreamStats {
  bitrate?: number;
  fps?: number;
  uptime?: number;
  bytesReceived?: number;
  droppedFrames?: number;
  healthy?: boolean;
  /** External encoders may include additional fields. */
  [key: string]: unknown;
}

/** Renderer health blob written by the capture pipeline. */
export interface ExternalRendererHealthBlob {
  ready?: boolean;
  degradedReason?: string | null;
  updatedAt?: number | null;
  phase?: string | null;
}

export interface ExternalRendererMetricsBlob {
  captureFps?: number | null;
  encodeFps?: number | null;
  droppedFrames?: number | null;
  renderTick?: number | null;
  duelStateTick?: number | null;
  latestFrameAt?: number | null;
  latestRenderTickAt?: number | null;
  latestDuelStateTickAt?: number | null;
  latestVisualChangeAt?: number | null;
  visualChangeAgeMs?: number | null;
}

export interface ExternalHlsManifestBlob {
  updatedAt?: number | null;
  mediaSequence?: number | null;
}

export interface ExternalRendererSmokeBlob {
  currentSceneUrl?: string | null;
  activeBundle?: string | null;
  deliveryMode?: string | null;
  captureFpsP50?: number | null;
  captureFpsP95?: number | null;
  encodeFpsP50?: number | null;
  encodeFpsP95?: number | null;
  updatedAt?: number | null;
  ingest?: ExternalRendererIngestBlob | null;
}

export interface ExternalRendererIngestBlob {
  profile?: string | null;
  transport?: string | null;
  audioSampleRate?: number | null;
  gopFrames?: number | null;
  targetFps?: number | null;
  probeOnly?: boolean | null;
}

export interface ExternalCaptureFrameSampleBlob {
  at?: number | null;
  size?: number | null;
  cdpTimestamp?: number | null;
}

export interface ExternalCaptureBackpressureTransitionBlob {
  at?: number | null;
  backpressured?: boolean | null;
}

export interface ExternalCaptureFatalWriteBlob {
  at?: number | null;
  message?: string | null;
  frameCount?: number | null;
  droppedFrames?: number | null;
  bytesReceived?: number | null;
  backpressured?: boolean | null;
  cdpDirectMode?: boolean | null;
  uptimeMs?: number | null;
}

export interface ExternalCaptureDiagnosticsBlob {
  recentFrames?: ExternalCaptureFrameSampleBlob[] | null;
  recentFrameCadenceMs?: Array<number | null> | null;
  nonMonotonicCdpTimestampCount?: number | null;
  backpressureTransitions?: ExternalCaptureBackpressureTransitionBlob[] | null;
  firstFatalWriteError?: ExternalCaptureFatalWriteBlob | null;
  lastFatalWriteError?: ExternalCaptureFatalWriteBlob | null;
  pageStallBeforeLastFatalWrite?: boolean | null;
  lastFrameAgeMs?: number | null;
  captureSessionGeneration?: string | null;
  manifestStatus?: StreamManifestStatus | null;
}

/**
 * Typed snapshot from the external RTMP status file. Only allowlisted fields
 * are preserved after parsing — unknown keys in the source JSON are stripped
 * to prevent arbitrary data from being forwarded to API consumers.
 */
export interface ExternalRtmpStatusSnapshot {
  active?: boolean;
  ffmpegRunning?: boolean;
  clientConnected?: boolean;
  captureMode?: StreamSourceCaptureMode;
  destinations: ExternalRtmpDestination[];
  stats: ExternalRtmpStreamStats;
  updatedAt: number;
  rendererHealth?: ExternalRendererHealthBlob;
  metrics?: ExternalRendererMetricsBlob;
  hlsManifest?: ExternalHlsManifestBlob;
  delivery?: StreamDeliveryInfo;
  smoke?: ExternalRendererSmokeBlob;
  ingest?: ExternalRendererIngestBlob;
  sourceRuntime?: StreamSourceRuntime;
  captureDiagnostics?: ExternalCaptureDiagnosticsBlob;
}

type ExternalStatusPoller = {
  snapshot: ExternalRtmpStatusSnapshot | null;
  refreshPromise: Promise<void> | null;
  interval: ReturnType<typeof setInterval>;
  refCount: number;
};

const externalStatusPollers = new Map<string, ExternalStatusPoller>();

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

function parseNullableFiniteNumber(
  record: Record<string, unknown>,
  key: string,
): number | null | undefined {
  if (!(key in record)) return undefined;
  if (record[key] === null) return null;
  return asFiniteNumber(record[key]);
}

function parseNullableBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | null | undefined {
  if (!(key in record)) return undefined;
  if (record[key] === null) return null;
  return typeof record[key] === "boolean" ? record[key] : undefined;
}

function parseNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!(key in record)) return undefined;
  if (record[key] === null) return null;
  return asNonEmptyString(record[key]);
}

function hasKeys(value: object): boolean {
  return Object.keys(value).length > 0;
}

function parseExternalDestinations(value: unknown): ExternalRtmpDestination[] {
  if (!Array.isArray(value)) return [];
  const destinations: ExternalRtmpDestination[] = [];
  for (const candidate of value) {
    const record = asRecord(candidate);
    if (!record) {
      continue;
    }
    destinations.push({
      id: asNonEmptyString(record.id) ?? undefined,
      name: asNonEmptyString(record.name) ?? undefined,
      role:
        record.role === "canonical" ||
        record.role === "fallback" ||
        record.role === "mirror"
          ? record.role
          : undefined,
      provider:
        record.provider === "cloudflare_stream" ||
        record.provider === "self_hls" ||
        record.provider === "twitch" ||
        record.provider === "kick" ||
        record.provider === "youtube" ||
        record.provider === "custom"
          ? record.provider
          : undefined,
      transport:
        record.transport === "llhls" ||
        record.transport === "hls" ||
        record.transport === "rtmps" ||
        record.transport === "srt" ||
        record.transport === "unknown"
          ? record.transport
          : undefined,
      playbackUrl: asNonEmptyString(record.playbackUrl),
      ingestUrl: asNonEmptyString(record.ingestUrl),
      url: asNonEmptyString(record.url) ?? undefined,
      status: asNonEmptyString(record.status) ?? undefined,
      connected:
        typeof record.connected === "boolean" ? record.connected : undefined,
      bytesWritten: asFiniteNumber(record.bytesWritten) ?? undefined,
      startedAt: asFiniteNumber(record.startedAt) ?? undefined,
      error: asNonEmptyString(record.error) ?? undefined,
    });
  }
  return destinations;
}

function parseExternalStats(value: unknown): ExternalRtmpStreamStats {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const stats: ExternalRtmpStreamStats = {};
  const bitrate = asFiniteNumber(record.bitrate);
  const fps = asFiniteNumber(record.fps);
  const uptime = asFiniteNumber(record.uptime);
  const bytesReceived = asFiniteNumber(record.bytesReceived);
  const droppedFrames = asFiniteNumber(record.droppedFrames);

  if (bitrate !== null) {
    stats.bitrate = bitrate;
  }
  if (fps !== null) {
    stats.fps = fps;
  }
  if (uptime !== null) {
    stats.uptime = uptime;
  }
  if (bytesReceived !== null) {
    stats.bytesReceived = bytesReceived;
  }
  if (droppedFrames !== null) {
    stats.droppedFrames = droppedFrames;
  }
  if (typeof record.healthy === "boolean") {
    stats.healthy = record.healthy;
  }

  return stats;
}

function parseStreamManifestStatus(
  value: unknown,
): StreamManifestStatus | null {
  return value === "ok" ||
    value === "stale" ||
    value === "missing" ||
    value === "unknown"
    ? value
    : null;
}

function parseStreamDeliveryMode(value: unknown): StreamDeliveryMode | null {
  return value === "self_hls" || value === "external_hls" ? value : null;
}

function parseExternalRendererIngestBlob(
  value: unknown,
): ExternalRendererIngestBlob | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parsed: ExternalRendererIngestBlob = {};
  const profile = parseNullableString(record, "profile");
  const transport = parseNullableString(record, "transport");
  const audioSampleRate = parseNullableFiniteNumber(record, "audioSampleRate");
  const gopFrames = parseNullableFiniteNumber(record, "gopFrames");
  const targetFps = parseNullableFiniteNumber(record, "targetFps");
  const probeOnly = parseNullableBoolean(record, "probeOnly");

  if (profile !== undefined) parsed.profile = profile;
  if (transport !== undefined) parsed.transport = transport;
  if (audioSampleRate !== undefined) parsed.audioSampleRate = audioSampleRate;
  if (gopFrames !== undefined) parsed.gopFrames = gopFrames;
  if (targetFps !== undefined) parsed.targetFps = targetFps;
  if (probeOnly !== undefined) parsed.probeOnly = probeOnly;

  return hasKeys(parsed) ? parsed : undefined;
}

function parseExternalRendererHealthBlob(
  value: unknown,
): ExternalRendererHealthBlob | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parsed: ExternalRendererHealthBlob = {};
  if (typeof record.ready === "boolean") {
    parsed.ready = record.ready;
  }
  const degradedReason = parseNullableString(record, "degradedReason");
  const updatedAt = parseNullableFiniteNumber(record, "updatedAt");
  const phase = parseNullableString(record, "phase");
  if (degradedReason !== undefined) parsed.degradedReason = degradedReason;
  if (updatedAt !== undefined) parsed.updatedAt = updatedAt;
  if (phase !== undefined) parsed.phase = phase;
  return hasKeys(parsed) ? parsed : undefined;
}

function parseExternalRendererMetricsBlob(
  value: unknown,
): ExternalRendererMetricsBlob | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parsed: ExternalRendererMetricsBlob = {};
  for (const key of [
    "captureFps",
    "encodeFps",
    "droppedFrames",
    "renderTick",
    "duelStateTick",
    "latestFrameAt",
    "latestRenderTickAt",
    "latestDuelStateTickAt",
    "latestVisualChangeAt",
    "visualChangeAgeMs",
  ] as const) {
    const valueForKey = parseNullableFiniteNumber(record, key);
    if (valueForKey !== undefined) {
      parsed[key] = valueForKey;
    }
  }
  return hasKeys(parsed) ? parsed : undefined;
}

function parseExternalHlsManifestBlob(
  value: unknown,
): ExternalHlsManifestBlob | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parsed: ExternalHlsManifestBlob = {};
  const updatedAt = parseNullableFiniteNumber(record, "updatedAt");
  const mediaSequence = parseNullableFiniteNumber(record, "mediaSequence");
  if (updatedAt !== undefined) parsed.updatedAt = updatedAt;
  if (mediaSequence !== undefined) parsed.mediaSequence = mediaSequence;
  return hasKeys(parsed) ? parsed : undefined;
}

function parseExternalDeliveryInfo(
  value: unknown,
): StreamDeliveryInfo | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const mode = parseStreamDeliveryMode(record.mode);
  if (!mode) {
    return undefined;
  }

  return {
    mode,
    provider: parseNullableString(record, "provider") ?? null,
    playbackUrl: parseNullableString(record, "playbackUrl") ?? null,
    hlsUrl: parseNullableString(record, "hlsUrl") ?? null,
    llhlsUrl: parseNullableString(record, "llhlsUrl") ?? null,
    ingestUrl: parseNullableString(record, "ingestUrl") ?? null,
  };
}

function parseExternalRendererSmokeBlob(
  value: unknown,
): ExternalRendererSmokeBlob | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parsed: ExternalRendererSmokeBlob = {};
  const currentSceneUrl = parseNullableString(record, "currentSceneUrl");
  const activeBundle = parseNullableString(record, "activeBundle");
  const deliveryMode = parseNullableString(record, "deliveryMode");
  const updatedAt = parseNullableFiniteNumber(record, "updatedAt");
  const ingest = parseExternalRendererIngestBlob(record.ingest);

  if (currentSceneUrl !== undefined) parsed.currentSceneUrl = currentSceneUrl;
  if (activeBundle !== undefined) parsed.activeBundle = activeBundle;
  if (deliveryMode !== undefined) parsed.deliveryMode = deliveryMode;
  if (updatedAt !== undefined) parsed.updatedAt = updatedAt;
  if (ingest) parsed.ingest = ingest;
  for (const key of [
    "captureFpsP50",
    "captureFpsP95",
    "encodeFpsP50",
    "encodeFpsP95",
  ] as const) {
    const valueForKey = parseNullableFiniteNumber(record, key);
    if (valueForKey !== undefined) {
      parsed[key] = valueForKey;
    }
  }

  return hasKeys(parsed) ? parsed : undefined;
}

function parseExternalCaptureFrameSample(
  value: unknown,
): ExternalCaptureFrameSampleBlob | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parsed: ExternalCaptureFrameSampleBlob = {};
  const at = parseNullableFiniteNumber(record, "at");
  const size = parseNullableFiniteNumber(record, "size");
  const cdpTimestamp = parseNullableFiniteNumber(record, "cdpTimestamp");
  if (at !== undefined) parsed.at = at;
  if (size !== undefined) parsed.size = size;
  if (cdpTimestamp !== undefined) parsed.cdpTimestamp = cdpTimestamp;
  return hasKeys(parsed) ? parsed : undefined;
}

function parseExternalCaptureBackpressureTransition(
  value: unknown,
): ExternalCaptureBackpressureTransitionBlob | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parsed: ExternalCaptureBackpressureTransitionBlob = {};
  const at = parseNullableFiniteNumber(record, "at");
  const backpressured = parseNullableBoolean(record, "backpressured");
  if (at !== undefined) parsed.at = at;
  if (backpressured !== undefined) parsed.backpressured = backpressured;
  return hasKeys(parsed) ? parsed : undefined;
}

function parseExternalCaptureFatalWrite(
  value: unknown,
): ExternalCaptureFatalWriteBlob | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parsed: ExternalCaptureFatalWriteBlob = {};
  const message = parseNullableString(record, "message");
  const backpressured = parseNullableBoolean(record, "backpressured");
  const cdpDirectMode = parseNullableBoolean(record, "cdpDirectMode");
  if (message !== undefined) parsed.message = message;
  if (backpressured !== undefined) parsed.backpressured = backpressured;
  if (cdpDirectMode !== undefined) parsed.cdpDirectMode = cdpDirectMode;
  for (const key of [
    "at",
    "frameCount",
    "droppedFrames",
    "bytesReceived",
    "uptimeMs",
  ] as const) {
    const valueForKey = parseNullableFiniteNumber(record, key);
    if (valueForKey !== undefined) {
      parsed[key] = valueForKey;
    }
  }
  return hasKeys(parsed) ? parsed : undefined;
}

function parseExternalCaptureDiagnosticsBlob(
  value: unknown,
): ExternalCaptureDiagnosticsBlob | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parsed: ExternalCaptureDiagnosticsBlob = {};
  const recentFrames = Array.isArray(record.recentFrames)
    ? record.recentFrames
        .map((frame) => parseExternalCaptureFrameSample(frame))
        .filter(
          (frame): frame is ExternalCaptureFrameSampleBlob =>
            frame !== undefined,
        )
    : undefined;
  const recentFrameCadenceMs = Array.isArray(record.recentFrameCadenceMs)
    ? record.recentFrameCadenceMs
        .map((sample) =>
          sample === null ? null : (asFiniteNumber(sample) ?? undefined),
        )
        .filter((sample): sample is number | null => sample !== undefined)
    : undefined;
  const backpressureTransitions = Array.isArray(record.backpressureTransitions)
    ? record.backpressureTransitions
        .map((entry) => parseExternalCaptureBackpressureTransition(entry))
        .filter(
          (entry): entry is ExternalCaptureBackpressureTransitionBlob =>
            entry !== undefined,
        )
    : undefined;
  const firstFatalWriteError = parseExternalCaptureFatalWrite(
    record.firstFatalWriteError,
  );
  const lastFatalWriteError = parseExternalCaptureFatalWrite(
    record.lastFatalWriteError,
  );
  const nonMonotonicCdpTimestampCount = parseNullableFiniteNumber(
    record,
    "nonMonotonicCdpTimestampCount",
  );
  const pageStallBeforeLastFatalWrite = parseNullableBoolean(
    record,
    "pageStallBeforeLastFatalWrite",
  );
  const lastFrameAgeMs = parseNullableFiniteNumber(record, "lastFrameAgeMs");
  const captureSessionGeneration = parseNullableString(
    record,
    "captureSessionGeneration",
  );
  const manifestStatus =
    "manifestStatus" in record
      ? record.manifestStatus === null
        ? null
        : parseStreamManifestStatus(record.manifestStatus)
      : undefined;

  if (recentFrames !== undefined) parsed.recentFrames = recentFrames;
  if (recentFrameCadenceMs !== undefined) {
    parsed.recentFrameCadenceMs = recentFrameCadenceMs;
  }
  if (backpressureTransitions !== undefined) {
    parsed.backpressureTransitions = backpressureTransitions;
  }
  if (firstFatalWriteError) parsed.firstFatalWriteError = firstFatalWriteError;
  if (lastFatalWriteError) parsed.lastFatalWriteError = lastFatalWriteError;
  if (nonMonotonicCdpTimestampCount !== undefined) {
    parsed.nonMonotonicCdpTimestampCount = nonMonotonicCdpTimestampCount;
  }
  if (pageStallBeforeLastFatalWrite !== undefined) {
    parsed.pageStallBeforeLastFatalWrite = pageStallBeforeLastFatalWrite;
  }
  if (lastFrameAgeMs !== undefined) parsed.lastFrameAgeMs = lastFrameAgeMs;
  if (captureSessionGeneration !== undefined) {
    parsed.captureSessionGeneration = captureSessionGeneration;
  }
  if (manifestStatus !== undefined) parsed.manifestStatus = manifestStatus;

  return hasKeys(parsed) ? parsed : undefined;
}

function parseExternalSourceRuntime(
  value: unknown,
): StreamSourceRuntime | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const ready = typeof record.ready === "boolean" ? record.ready : undefined;
  const statusSource =
    record.statusSource === "external_worker" ||
    record.statusSource === "in_process_bridge" ||
    record.statusSource === "none"
      ? record.statusSource
      : undefined;
  const captureMode =
    record.captureMode === "cdp" ||
    record.captureMode === "webcodecs" ||
    record.captureMode === "mediarecorder" ||
    record.captureMode === "x11_nvenc" ||
    record.captureMode === "none"
      ? record.captureMode
      : undefined;
  const degradedReason =
    "degradedReason" in record
      ? record.degradedReason === null
        ? null
        : record.degradedReason === "worker_missing" ||
            record.degradedReason === "browser_missing" ||
            record.degradedReason === "page_not_ready" ||
            record.degradedReason === "unexpected_navigation" ||
            record.degradedReason === "capture_stalled" ||
            record.degradedReason === "encoder_stalled" ||
            record.degradedReason === "manifest_stale" ||
            record.degradedReason === "destination_disconnected" ||
            record.degradedReason === "status_stale" ||
            record.degradedReason === "unknown"
          ? record.degradedReason
          : undefined
      : undefined;
  const currentSceneUrl = parseNullableString(record, "currentSceneUrl");
  const activeBundle = parseNullableString(record, "activeBundle");
  const lastFrameAt = parseNullableFiniteNumber(record, "lastFrameAt");
  const lastRenderTickAt = parseNullableFiniteNumber(
    record,
    "lastRenderTickAt",
  );
  const lastVisualChangeAt = parseNullableFiniteNumber(
    record,
    "lastVisualChangeAt",
  );
  const lastRecoveryAt = parseNullableFiniteNumber(record, "lastRecoveryAt");
  const recoveryCount = parseNullableFiniteNumber(record, "recoveryCount");
  const workerHeartbeatAt = parseNullableFiniteNumber(
    record,
    "workerHeartbeatAt",
  );
  const hasRecognizedField =
    ready !== undefined ||
    statusSource !== undefined ||
    captureMode !== undefined ||
    degradedReason !== undefined ||
    currentSceneUrl !== undefined ||
    activeBundle !== undefined ||
    lastFrameAt !== undefined ||
    lastRenderTickAt !== undefined ||
    lastVisualChangeAt !== undefined ||
    lastRecoveryAt !== undefined ||
    recoveryCount !== undefined ||
    workerHeartbeatAt !== undefined;
  if (!hasRecognizedField) {
    return undefined;
  }

  return {
    ready: ready ?? false,
    statusSource: statusSource ?? "none",
    captureMode: captureMode ?? "none",
    degradedReason: degradedReason ?? null,
    currentSceneUrl: currentSceneUrl ?? null,
    activeBundle: activeBundle ?? null,
    lastFrameAt: lastFrameAt ?? null,
    lastRenderTickAt: lastRenderTickAt ?? null,
    lastVisualChangeAt: lastVisualChangeAt ?? null,
    lastRecoveryAt: lastRecoveryAt ?? null,
    recoveryCount: Math.max(0, recoveryCount ?? 0),
    workerHeartbeatAt: workerHeartbeatAt ?? null,
  };
}

/**
 * Parse and validate the external RTMP status JSON, stripping unknown keys.
 *
 * Only `active`, `ffmpegRunning`, `clientConnected`, `destinations`, `stats`,
 * `updatedAt`, `rendererHealth`, `metrics`, `hlsManifest`, `delivery`, `smoke`,
 * and `ingest`
 * plus additive `sourceRuntime`
 * are
 * forwarded. Any extra keys in the source file are silently dropped so
 * tampered files cannot inject arbitrary data into API responses.
 */
export function parseExternalRtmpStatusSnapshot(
  raw: string,
  externalStatusMaxAgeMs: number,
  options?: { allowStale?: boolean },
): ExternalRtmpStatusSnapshot | null {
  try {
    const normalized = raw.trim();
    if (!normalized) return null;
    const parsed = asRecord(JSON.parse(normalized));
    if (!parsed) return null;
    if (!Array.isArray(parsed.destinations)) return null;
    if (!asRecord(parsed.stats)) return null;

    const updatedAt = asFiniteNumber(Number(parsed.updatedAt || 0)) ?? 0;
    if (
      !options?.allowStale &&
      updatedAt > 0 &&
      Date.now() - updatedAt > externalStatusMaxAgeMs
    ) {
      return null;
    }

    // Allowlist: only forward known fields.
    const snapshot: ExternalRtmpStatusSnapshot = {
      destinations: parseExternalDestinations(parsed.destinations),
      stats: parseExternalStats(parsed.stats),
      updatedAt,
    };
    if (typeof parsed.active === "boolean") {
      snapshot.active = parsed.active;
    }
    if (typeof parsed.ffmpegRunning === "boolean") {
      snapshot.ffmpegRunning = parsed.ffmpegRunning;
    }
    if (typeof parsed.clientConnected === "boolean") {
      snapshot.clientConnected = parsed.clientConnected;
    }
    if (
      parsed.captureMode === "cdp" ||
      parsed.captureMode === "webcodecs" ||
      parsed.captureMode === "mediarecorder" ||
      parsed.captureMode === "x11_nvenc" ||
      parsed.captureMode === "none"
    ) {
      snapshot.captureMode = parsed.captureMode;
    }

    const rendererHealth = parseExternalRendererHealthBlob(
      parsed.rendererHealth,
    );
    const metrics = parseExternalRendererMetricsBlob(parsed.metrics);
    const hlsManifest = parseExternalHlsManifestBlob(parsed.hlsManifest);
    const delivery = parseExternalDeliveryInfo(parsed.delivery);
    const smoke = parseExternalRendererSmokeBlob(parsed.smoke);
    const ingest = parseExternalRendererIngestBlob(parsed.ingest);
    const sourceRuntime = parseExternalSourceRuntime(parsed.sourceRuntime);
    const captureDiagnostics = parseExternalCaptureDiagnosticsBlob(
      parsed.captureDiagnostics,
    );

    if (rendererHealth) snapshot.rendererHealth = rendererHealth;
    if (metrics) snapshot.metrics = metrics;
    if (hlsManifest) snapshot.hlsManifest = hlsManifest;
    if (delivery) snapshot.delivery = delivery;
    if (smoke) snapshot.smoke = smoke;
    if (ingest) snapshot.ingest = ingest;
    if (sourceRuntime) snapshot.sourceRuntime = sourceRuntime;
    if (captureDiagnostics) snapshot.captureDiagnostics = captureDiagnostics;

    return snapshot;
  } catch {
    return null;
  }
}

export async function loadExternalRtmpStatusSnapshot(
  externalStatusFile: string | null,
  externalStatusMaxAgeMs: number,
  options?: { allowStale?: boolean },
): Promise<ExternalRtmpStatusSnapshot | null> {
  if (!externalStatusFile) return null;
  try {
    const raw = await fs.readFile(externalStatusFile, "utf8");
    return parseExternalRtmpStatusSnapshot(
      raw,
      externalStatusMaxAgeMs,
      options,
    );
  } catch (error) {
    console.warn(
      `[ExternalRtmpStatus] Failed to read status file "${externalStatusFile}":`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function getExternalStatusPollerKey(
  externalStatusFile: string,
  externalStatusMaxAgeMs: number,
): string {
  return `${externalStatusFile}::${externalStatusMaxAgeMs}`;
}

async function refreshExternalStatusPoller(
  poller: ExternalStatusPoller,
  externalStatusFile: string,
  externalStatusMaxAgeMs: number,
): Promise<void> {
  if (poller.refreshPromise) {
    return poller.refreshPromise;
  }
  poller.refreshPromise = (async () => {
    const nextSnapshot = await loadExternalRtmpStatusSnapshot(
      externalStatusFile,
      externalStatusMaxAgeMs,
      { allowStale: true },
    );
    if (nextSnapshot) {
      poller.snapshot = nextSnapshot;
    }
  })().finally(() => {
    poller.refreshPromise = null;
  });
  return poller.refreshPromise;
}

export function acquireExternalStatusPoller(
  externalStatusFile: string | null,
  externalStatusMaxAgeMs: number,
): {
  getSnapshot(): ExternalRtmpStatusSnapshot | null;
  refresh(): Promise<void>;
  release(): void;
} | null {
  if (!externalStatusFile) {
    return null;
  }

  const key = getExternalStatusPollerKey(
    externalStatusFile,
    externalStatusMaxAgeMs,
  );
  let poller = externalStatusPollers.get(key);
  if (!poller) {
    const refreshIntervalMs = Math.max(
      1_000,
      Math.min(externalStatusMaxAgeMs, 5_000),
    );
    poller = {
      snapshot: null,
      refreshPromise: null,
      interval: setInterval(() => {
        void refreshExternalStatusPoller(
          poller!,
          externalStatusFile,
          externalStatusMaxAgeMs,
        );
      }, refreshIntervalMs),
      refCount: 0,
    };
    poller.interval.unref?.();
    externalStatusPollers.set(key, poller);
    void refreshExternalStatusPoller(
      poller,
      externalStatusFile,
      externalStatusMaxAgeMs,
    );
  }

  poller.refCount += 1;
  return {
    getSnapshot: () => poller?.snapshot ?? null,
    refresh: () =>
      refreshExternalStatusPoller(
        poller!,
        externalStatusFile,
        externalStatusMaxAgeMs,
      ),
    release: () => {
      if (!poller) {
        return;
      }
      poller.refCount = Math.max(0, poller.refCount - 1);
      if (poller.refCount > 0) {
        return;
      }
      clearInterval(poller.interval);
      externalStatusPollers.delete(key);
    },
  };
}
