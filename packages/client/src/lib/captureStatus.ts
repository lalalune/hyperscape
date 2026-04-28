/* global MediaRecorder */

import type { CaptureControlStatus } from "./streamingWindow";

export function buildCaptureControlStatus(params: {
  recorderState: MediaRecorder["state"] | null | undefined;
  wsReadyState: number | null | undefined;
  chunkCount: number;
  bytesSent: number;
  startedAt: number;
  lastChunkAt: number;
  wsBufferedAmount: number | null | undefined;
  heapUsedBytes: number | null | undefined;
  heapLimitBytes: number | null | undefined;
}): CaptureControlStatus {
  const nowMs = Date.now();
  const lastChunkAt =
    params.lastChunkAt > 0 && Number.isFinite(params.lastChunkAt)
      ? params.lastChunkAt
      : null;
  const lastChunkAgeMs =
    lastChunkAt != null ? Math.max(0, nowMs - lastChunkAt) : null;

  return {
    recording: params.recorderState === "recording",
    wsConnected: params.wsReadyState === WebSocket.OPEN,
    chunkCount: params.chunkCount,
    bytesSent: params.bytesSent,
    uptime:
      params.startedAt > 0 && Number.isFinite(params.startedAt)
        ? Math.max(0, nowMs - params.startedAt)
        : 0,
    lastChunkAt,
    lastChunkAgeMs,
    // Legacy field kept temporarily for mixed-version rollouts.
    lastChunkMs: lastChunkAgeMs,
    wsBufferedAmount: params.wsBufferedAmount ?? 0,
    heapUsedBytes: params.heapUsedBytes ?? null,
    heapLimitBytes: params.heapLimitBytes ?? null,
  };
}
