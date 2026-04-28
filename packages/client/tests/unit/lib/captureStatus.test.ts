import { describe, expect, it, vi } from "vitest";

import { buildCaptureControlStatus } from "../../../src/lib/captureStatus";

describe("buildCaptureControlStatus", () => {
  it("emits absolute and relative last-chunk fields while preserving the legacy age field", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(10_000);
    try {
      expect(
        buildCaptureControlStatus({
          recorderState: "recording",
          wsReadyState: WebSocket.OPEN,
          chunkCount: 4,
          bytesSent: 2048,
          startedAt: 9_000,
          lastChunkAt: 9_750,
          wsBufferedAmount: 256,
          heapUsedBytes: 1024,
          heapLimitBytes: 8192,
        }),
      ).toEqual({
        recording: true,
        wsConnected: true,
        chunkCount: 4,
        bytesSent: 2048,
        uptime: 1000,
        lastChunkAt: 9750,
        lastChunkAgeMs: 250,
        lastChunkMs: 250,
        wsBufferedAmount: 256,
        heapUsedBytes: 1024,
        heapLimitBytes: 8192,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });
});
