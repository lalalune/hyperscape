import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { IncomingHttpHeaders } from "node:http";
import type { DatabaseSystem } from "../systems/DatabaseSystem/index.js";
import { storage } from "../database/schema.js";
import type {
  StreamCanonicalProvider,
  StreamManifestStatus,
} from "./delivery-config.js";

type StorageDb = ReturnType<DatabaseSystem["getDb"]>;

export const CANONICAL_PROVIDER_STATE_STORAGE_KEY =
  "streaming:canonical-provider-state";
export const CLOUDFLARE_LIFECYCLE_STORAGE_KEY =
  "streaming:cloudflare:lifecycle";
export const CLOUDFLARE_LAST_WEBHOOK_STORAGE_KEY =
  "streaming:cloudflare:last-webhook";
export const CLOUDFLARE_LAST_LIFECYCLE_POLL_STORAGE_KEY =
  "streaming:cloudflare:last-lifecycle-poll";
export const CLOUDFLARE_LAST_PLAYBACK_PROBE_STORAGE_KEY =
  "streaming:cloudflare:last-playback-probe";
export const CLOUDFLARE_RECONCILIATION_STORAGE_KEY =
  "streaming:cloudflare:reconciliation";

export type PersistedCanonicalProviderState = {
  activeProvider: StreamCanonicalProvider | null;
  primaryHealthySince: number | null;
  updatedAt: number;
};

export type PersistedCloudflareLifecycleState = {
  eventType: string | null;
  eventName: string | null;
  liveInputId: string | null;
  videoId: string | null;
  status: "connected" | "disconnected" | "errored" | "unknown";
  errorCode: string | null;
  errorMessage: string | null;
  occurredAt: number | null;
  receivedAt: number;
};

export type PersistedCloudflareWebhookState = {
  eventType: string | null;
  eventName: string | null;
  liveInputId: string | null;
  videoId: string | null;
  occurredAt: number | null;
  receivedAt: number;
};

export type PersistedCloudflareLifecyclePollState = {
  liveInputId: string | null;
  videoUid: string | null;
  status: "connected" | "disconnected" | "errored" | "unknown";
  providerLive: boolean;
  statusSummary: string | null;
  playbackUrl: string | null;
  occurredAt: number | null;
  receivedAt: number;
};

export type PersistedCloudflarePlaybackProbeState = {
  playbackUrl: string | null;
  ready: boolean;
  manifestStatus: StreamManifestStatus;
  statusCode: number | null;
  lastError: string | null;
  updatedAt: number;
};

export type PersistedCloudflareReconciliationState = {
  revision: number;
  decision: "ready" | "blocked";
  reason:
    | "source_unready"
    | "provider_not_live"
    | "probe_unready"
    | "authority_stale"
    | null;
  updatedAt: number;
  liveInputId: string | null;
  videoUid: string | null;
  lifecycleStatus: string | null;
  providerLive: boolean;
  playbackUrl: string | null;
  playbackProbeReady: boolean;
  playbackProbeStatusCode: number | null;
  playbackManifestStatus: StreamManifestStatus;
};

export type PersistedStreamingAuthorityState = {
  canonicalProviderState: PersistedCanonicalProviderState | null;
  cloudflareLifecycle: PersistedCloudflareLifecycleState | null;
  cloudflareLastWebhook: PersistedCloudflareWebhookState | null;
  cloudflareLifecyclePoll: PersistedCloudflareLifecyclePollState | null;
  cloudflarePlaybackProbe: PersistedCloudflarePlaybackProbeState | null;
  cloudflareReconciliation: PersistedCloudflareReconciliationState | null;
};

export type SummarizedCloudflareLiveWebhook = {
  webhook: PersistedCloudflareWebhookState;
  lifecycle: PersistedCloudflareLifecycleState;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readFirstString(
  value: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!value) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function readNestedString(
  payload: Record<string, unknown> | null,
  candidates: string[][],
): string | null {
  for (const path of candidates) {
    let cursor: unknown = payload;
    for (const segment of path) {
      cursor = asRecord(cursor)?.[segment];
    }
    if (typeof cursor === "string" && cursor.trim().length > 0) {
      return cursor.trim();
    }
  }
  return null;
}

function readNestedTimestamp(
  payload: Record<string, unknown> | null,
  candidates: string[][],
): number | null {
  for (const path of candidates) {
    let cursor: unknown = payload;
    for (const segment of path) {
      cursor = asRecord(cursor)?.[segment];
    }
    if (typeof cursor === "number" && Number.isFinite(cursor)) {
      return cursor;
    }
    if (typeof cursor === "string" && cursor.trim().length > 0) {
      const numeric = Number(cursor);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
      const parsed = Date.parse(cursor);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function parseStoredJson<T>(rawValue: string | null | undefined): T | null {
  if (!rawValue) return null;
  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.warn(
      `[CloudflareAuthority] Failed to parse persisted JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function readStoredJson<T>(
  db: StorageDb | null | undefined,
  key: string,
): Promise<T | null> {
  if (!db) return null;
  const rows = await db
    .select()
    .from(storage)
    .where(eq(storage.key, key))
    .limit(1);
  return parseStoredJson<T>(rows[0]?.value);
}

async function writeStoredJson(
  db: StorageDb | null | undefined,
  key: string,
  value: unknown,
): Promise<void> {
  if (!db) return;
  const now = Date.now();
  const payload = JSON.stringify(value);
  await db
    .insert(storage)
    .values({
      key,
      value: payload,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: storage.key,
      set: {
        value: payload,
        updatedAt: now,
      },
    });
}

function deriveLifecycleStatus(eventType: string | null) {
  const normalized = eventType?.trim().toLowerCase() ?? "";
  if (normalized.includes("disconnected")) {
    return "disconnected" as const;
  }
  if (normalized.includes("connected")) {
    return "connected" as const;
  }
  if (normalized.includes("error")) {
    return "errored" as const;
  }
  return "unknown" as const;
}

function isFreshTimestamp(
  updatedAt: number | null | undefined,
  nowMs: number,
  freshnessMs: number,
): boolean {
  return (
    typeof updatedAt === "number" &&
    Number.isFinite(updatedAt) &&
    Math.max(0, nowMs - updatedAt) <= freshnessMs
  );
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableJsonValue(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableJsonValue(entry)]),
    );
  }
  return value;
}

function buildReconciliationComparable(
  state: Omit<PersistedCloudflareReconciliationState, "revision" | "updatedAt">,
): string {
  return JSON.stringify(stableJsonValue(state));
}

type CloudflareProviderEvidence = {
  liveInputId: string | null;
  videoUid: string | null;
  lifecycleStatus: string | null;
  providerLive: boolean;
  updatedAt: number;
};

function resolveCloudflareProviderEvidence(params: {
  lifecycle: PersistedCloudflareLifecycleState | null;
  lifecyclePoll: PersistedCloudflareLifecyclePollState | null;
  nowMs: number;
  freshnessMs: number;
}): CloudflareProviderEvidence | null {
  const candidates: CloudflareProviderEvidence[] = [];

  if (
    params.lifecycle &&
    isFreshTimestamp(
      params.lifecycle.receivedAt,
      params.nowMs,
      params.freshnessMs,
    )
  ) {
    candidates.push({
      liveInputId: params.lifecycle.liveInputId,
      videoUid: params.lifecycle.videoId,
      lifecycleStatus: params.lifecycle.status,
      providerLive: params.lifecycle.status === "connected",
      updatedAt: params.lifecycle.receivedAt,
    });
  }

  if (
    params.lifecyclePoll &&
    isFreshTimestamp(
      params.lifecyclePoll.receivedAt,
      params.nowMs,
      params.freshnessMs,
    )
  ) {
    candidates.push({
      liveInputId: params.lifecyclePoll.liveInputId,
      videoUid: params.lifecyclePoll.videoUid,
      lifecycleStatus: params.lifecyclePoll.status,
      providerLive: params.lifecyclePoll.providerLive,
      updatedAt: params.lifecyclePoll.receivedAt,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => right.updatedAt - left.updatedAt)[0]!;
}

export function verifyCloudflareWebhookSecret(
  headers: IncomingHttpHeaders | Record<string, unknown>,
  secret: string | null | undefined,
): boolean {
  const expectedSecret = secret?.trim() ?? "";
  const rawHeader =
    headers["cf-webhook-auth"] ??
    Object.entries(headers).find(
      ([headerName]) => headerName.toLowerCase() === "cf-webhook-auth",
    )?.[1];
  const receivedSecret = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const normalizedReceived =
    typeof receivedSecret === "string" ? receivedSecret.trim() : "";
  const left = createHash("sha256").update(normalizedReceived).digest();
  const right = createHash("sha256").update(expectedSecret).digest();
  return Boolean(
    expectedSecret && normalizedReceived && timingSafeEqual(left, right),
  );
}

export function summarizeCloudflareLiveWebhook(params: {
  payload: unknown;
  receivedAt?: number;
}): SummarizedCloudflareLiveWebhook {
  const payload = asRecord(params.payload);
  const event = asRecord(payload?.event);
  const receivedAt = params.receivedAt ?? Date.now();
  const eventType =
    readNestedString(payload, [
      ["alert_type"],
      ["event", "type"],
      ["type"],
      ["eventType"],
    ]) ?? null;
  const eventName =
    readNestedString(payload, [["name"], ["event", "name"]]) ?? eventType;
  const liveInputId =
    readNestedString(payload, [
      ["event", "input_id"],
      ["event", "input_uid"],
      ["event", "live_input_id"],
      ["event", "live_input_uid"],
      ["input_id"],
      ["input_uid"],
      ["live_input_id"],
      ["live_input_uid"],
    ]) ?? null;
  const videoId = readNestedString(payload, [
    ["event", "video_id"],
    ["event", "video_uid"],
    ["video_id"],
    ["video_uid"],
  ]);
  const occurredAt = readNestedTimestamp(payload, [
    ["event", "timestamp"],
    ["event", "occurred_at"],
    ["timestamp"],
    ["occurred_at"],
  ]);
  const errorCode =
    readFirstString(event, ["error_code", "code"]) ??
    readFirstString(payload, ["error_code", "code"]);
  const errorMessage =
    readFirstString(event, ["error_message", "message"]) ??
    readFirstString(payload, ["error_message", "message"]);

  const webhook: PersistedCloudflareWebhookState = {
    eventType,
    eventName,
    liveInputId,
    videoId,
    occurredAt,
    receivedAt,
  };

  return {
    webhook,
    lifecycle: {
      ...webhook,
      status: deriveLifecycleStatus(eventType),
      errorCode,
      errorMessage,
    },
  };
}

export function reconcileCloudflareAuthority(params: {
  sourceRuntimeReady: boolean;
  lifecycle: PersistedCloudflareLifecycleState | null;
  lifecyclePoll: PersistedCloudflareLifecyclePollState | null;
  playbackProbe: PersistedCloudflarePlaybackProbeState | null;
  previous: PersistedCloudflareReconciliationState | null;
  nowMs?: number;
  freshnessMs: number;
  playbackUrl?: string | null;
}): PersistedCloudflareReconciliationState {
  const nowMs = params.nowMs ?? Date.now();
  const providerEvidence = resolveCloudflareProviderEvidence({
    lifecycle: params.lifecycle,
    lifecyclePoll: params.lifecyclePoll,
    nowMs,
    freshnessMs: params.freshnessMs,
  });
  const playbackProbeFresh =
    params.playbackProbe &&
    isFreshTimestamp(params.playbackProbe.updatedAt, nowMs, params.freshnessMs)
      ? params.playbackProbe
      : null;
  const providerLive = providerEvidence?.providerLive === true;
  const playbackProbeReady = playbackProbeFresh?.ready === true;

  let reason: PersistedCloudflareReconciliationState["reason"] = null;
  if (!params.sourceRuntimeReady) {
    reason = "source_unready";
  } else if (providerEvidence && !providerLive) {
    reason = "provider_not_live";
  } else if (
    providerEvidence &&
    providerLive &&
    playbackProbeFresh &&
    !playbackProbeReady
  ) {
    reason = "probe_unready";
  } else if (!providerEvidence || !playbackProbeFresh) {
    reason = "authority_stale";
  }

  const comparableState = {
    decision: reason == null ? "ready" : "blocked",
    reason,
    liveInputId:
      providerEvidence?.liveInputId ?? params.lifecycle?.liveInputId ?? null,
    videoUid: providerEvidence?.videoUid ?? params.lifecycle?.videoId ?? null,
    lifecycleStatus: providerEvidence?.lifecycleStatus ?? null,
    providerLive,
    playbackUrl:
      playbackProbeFresh?.playbackUrl ??
      params.playbackUrl?.trim() ??
      params.playbackProbe?.playbackUrl ??
      null,
    playbackProbeReady,
    playbackProbeStatusCode: playbackProbeFresh?.statusCode ?? null,
    playbackManifestStatus:
      playbackProbeFresh?.manifestStatus ??
      ("unknown" satisfies StreamManifestStatus),
  } satisfies Omit<
    PersistedCloudflareReconciliationState,
    "revision" | "updatedAt"
  >;

  const previousComparable =
    params.previous == null
      ? null
      : buildReconciliationComparable({
          decision: params.previous.decision,
          reason: params.previous.reason,
          liveInputId: params.previous.liveInputId,
          videoUid: params.previous.videoUid,
          lifecycleStatus: params.previous.lifecycleStatus,
          providerLive: params.previous.providerLive,
          playbackUrl: params.previous.playbackUrl,
          playbackProbeReady: params.previous.playbackProbeReady,
          playbackProbeStatusCode: params.previous.playbackProbeStatusCode,
          playbackManifestStatus: params.previous.playbackManifestStatus,
        });
  const nextComparable = buildReconciliationComparable(comparableState);

  return {
    revision:
      previousComparable === nextComparable
        ? (params.previous?.revision ?? 1)
        : (params.previous?.revision ?? 0) + 1,
    updatedAt: nowMs,
    ...comparableState,
  };
}

export async function loadPersistedStreamingAuthorityState(
  db: StorageDb | null | undefined,
): Promise<PersistedStreamingAuthorityState> {
  return {
    canonicalProviderState:
      await readStoredJson<PersistedCanonicalProviderState>(
        db,
        CANONICAL_PROVIDER_STATE_STORAGE_KEY,
      ),
    cloudflareLifecycle:
      await readStoredJson<PersistedCloudflareLifecycleState>(
        db,
        CLOUDFLARE_LIFECYCLE_STORAGE_KEY,
      ),
    cloudflareLastWebhook:
      await readStoredJson<PersistedCloudflareWebhookState>(
        db,
        CLOUDFLARE_LAST_WEBHOOK_STORAGE_KEY,
      ),
    cloudflareLifecyclePoll:
      await readStoredJson<PersistedCloudflareLifecyclePollState>(
        db,
        CLOUDFLARE_LAST_LIFECYCLE_POLL_STORAGE_KEY,
      ),
    cloudflarePlaybackProbe:
      await readStoredJson<PersistedCloudflarePlaybackProbeState>(
        db,
        CLOUDFLARE_LAST_PLAYBACK_PROBE_STORAGE_KEY,
      ),
    cloudflareReconciliation:
      await readStoredJson<PersistedCloudflareReconciliationState>(
        db,
        CLOUDFLARE_RECONCILIATION_STORAGE_KEY,
      ),
  };
}

export async function persistCanonicalProviderState(
  db: StorageDb | null | undefined,
  state: PersistedCanonicalProviderState,
): Promise<void> {
  await writeStoredJson(db, CANONICAL_PROVIDER_STATE_STORAGE_KEY, state);
}

export async function persistCloudflareLifecycleState(
  db: StorageDb | null | undefined,
  state: PersistedCloudflareLifecycleState,
): Promise<void> {
  await writeStoredJson(db, CLOUDFLARE_LIFECYCLE_STORAGE_KEY, state);
}

export async function persistCloudflareWebhookState(
  db: StorageDb | null | undefined,
  state: PersistedCloudflareWebhookState,
): Promise<void> {
  await writeStoredJson(db, CLOUDFLARE_LAST_WEBHOOK_STORAGE_KEY, state);
}

export async function persistCloudflareLifecyclePollState(
  db: StorageDb | null | undefined,
  state: PersistedCloudflareLifecyclePollState,
): Promise<void> {
  await writeStoredJson(db, CLOUDFLARE_LAST_LIFECYCLE_POLL_STORAGE_KEY, state);
}

export async function persistCloudflarePlaybackProbeState(
  db: StorageDb | null | undefined,
  state: PersistedCloudflarePlaybackProbeState,
): Promise<void> {
  await writeStoredJson(db, CLOUDFLARE_LAST_PLAYBACK_PROBE_STORAGE_KEY, state);
}

export async function persistCloudflareReconciliationState(
  db: StorageDb | null | undefined,
  state: PersistedCloudflareReconciliationState,
): Promise<void> {
  await writeStoredJson(db, CLOUDFLARE_RECONCILIATION_STORAGE_KEY, state);
}
