import { describe, expect, it } from "vitest";
import { deriveStreamSourceRuntime } from "../../../src/routes/streaming-source-runtime.js";
import { resolveBrowserCaptureLastFrameAt } from "../../../src/streaming/source-runtime.js";

describe("deriveStreamSourceRuntime", () => {
  it("fails closed when an external worker is required but no snapshot is available", () => {
    const runtime = deriveStreamSourceRuntime({
      externalStatusSnapshot: null,
      externalStatusMaxAgeMs: 15_000,
      rendererHealth: {
        ready: true,
        degradedReason: null,
        updatedAt: 123,
      },
      requireExternalWorker: true,
      nowMs: 1_000,
    });

    expect(runtime).toEqual({
      ready: false,
      statusSource: "external_worker",
      captureMode: "none",
      degradedReason: "worker_missing",
      currentSceneUrl: null,
      activeBundle: null,
      lastFrameAt: null,
      lastRenderTickAt: null,
      lastVisualChangeAt: null,
      lastRecoveryAt: null,
      recoveryCount: 0,
      workerHeartbeatAt: null,
    });
  });

  it("preserves a healthy external worker runtime even when destinations are disconnected", () => {
    const runtime = deriveStreamSourceRuntime({
      externalStatusSnapshot: {
        active: true,
        ffmpegRunning: true,
        clientConnected: true,
        captureMode: "cdp",
        destinations: [
          {
            id: "canonical-cloudflare",
            connected: false,
            error: "delivery_disconnected",
          },
        ],
        stats: {
          healthy: false,
        },
        updatedAt: 1_000,
        sourceRuntime: {
          ready: true,
          statusSource: "external_worker",
          captureMode: "cdp",
          degradedReason: null,
          currentSceneUrl: "https://staging.example/stream",
          activeBundle: "bundle-a",
          lastFrameAt: 999,
          lastRenderTickAt: 998,
          lastVisualChangeAt: 997,
          lastRecoveryAt: 900,
          recoveryCount: 2,
          workerHeartbeatAt: 1_000,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      rendererHealth: {
        ready: true,
        degradedReason: null,
        updatedAt: 1_000,
      },
      requireExternalWorker: true,
      nowMs: 1_500,
    });

    expect(runtime.ready).toBe(true);
    expect(runtime.degradedReason).toBeNull();
    expect(runtime.statusSource).toBe("external_worker");
    expect(runtime.captureMode).toBe("cdp");
  });

  it("preserves x11_nvenc capture mode from the external worker snapshot", () => {
    const runtime = deriveStreamSourceRuntime({
      externalStatusSnapshot: {
        active: true,
        ffmpegRunning: true,
        clientConnected: true,
        captureMode: "x11_nvenc",
        destinations: [],
        stats: {
          healthy: true,
        },
        updatedAt: 1_000,
        sourceRuntime: {
          ready: true,
          statusSource: "external_worker",
          captureMode: "x11_nvenc",
          degradedReason: null,
          currentSceneUrl: "https://staging.example/stream",
          activeBundle: "bundle-a",
          lastFrameAt: 999,
          lastRenderTickAt: 998,
          lastVisualChangeAt: 997,
          lastRecoveryAt: 900,
          recoveryCount: 2,
          workerHeartbeatAt: 1_000,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      rendererHealth: {
        ready: true,
        degradedReason: null,
        updatedAt: 1_000,
      },
      requireExternalWorker: true,
      nowMs: 1_500,
    });

    expect(runtime.ready).toBe(true);
    expect(runtime.captureMode).toBe("x11_nvenc");
  });

  it("does not downgrade source runtime solely because a delivery destination is disconnected", () => {
    const runtime = deriveStreamSourceRuntime({
      externalStatusSnapshot: {
        active: true,
        ffmpegRunning: true,
        clientConnected: true,
        captureMode: "cdp",
        destinations: [
          {
            id: "fallback-cloudflare",
            connected: false,
            error: "delivery_disconnected",
          },
        ],
        stats: {
          healthy: true,
        },
        updatedAt: 1_000,
        delivery: {
          mode: "self_hls",
          provider: "self_hls",
          playbackUrl: "https://self.example/live/stream.m3u8",
          hlsUrl: "https://self.example/live/stream.m3u8",
          llhlsUrl: null,
          ingestUrl: null,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      rendererHealth: {
        ready: true,
        degradedReason: null,
        updatedAt: 1_000,
      },
      captureStats: {
        clientConnected: true,
        ffmpegRunning: true,
      },
      nowMs: 1_500,
    });

    expect(runtime.ready).toBe(true);
    expect(runtime.degradedReason).toBeNull();
    expect(runtime.statusSource).toBe("external_worker");
    expect(runtime.captureMode).toBe("cdp");
  });

  it("fails closed when renderer health reports a scene blocker", () => {
    const runtime = deriveStreamSourceRuntime({
      externalStatusSnapshot: {
        active: true,
        ffmpegRunning: true,
        clientConnected: true,
        captureMode: "cdp",
        destinations: [],
        stats: {
          healthy: true,
        },
        updatedAt: 1_000,
      },
      externalStatusMaxAgeMs: 15_000,
      rendererHealth: {
        ready: false,
        degradedReason: "terrain_not_ready",
        updatedAt: 1_000,
      },
      captureStats: {
        clientConnected: true,
        ffmpegRunning: true,
      },
      nowMs: 1_500,
    });

    expect(runtime.ready).toBe(false);
    expect(runtime.degradedReason).toBe("page_not_ready");
    expect(runtime.statusSource).toBe("external_worker");
    expect(runtime.captureMode).toBe("cdp");
  });
});

describe("resolveBrowserCaptureLastFrameAt", () => {
  it("prefers an absolute lastChunkAt timestamp when present", () => {
    expect(
      resolveBrowserCaptureLastFrameAt(
        {
          lastChunkAt: 9_750,
          lastChunkAgeMs: 250,
          lastChunkMs: 250,
        },
        10_000,
      ),
    ).toBe(9_750);
  });

  it("falls back to lastChunkAgeMs when lastChunkAt is unavailable", () => {
    expect(
      resolveBrowserCaptureLastFrameAt(
        {
          lastChunkAgeMs: 300,
        },
        10_000,
      ),
    ).toBe(9_700);
  });

  it("falls back to legacy lastChunkMs for mixed-version rollouts", () => {
    expect(
      resolveBrowserCaptureLastFrameAt(
        {
          lastChunkMs: 450,
        },
        10_000,
      ),
    ).toBe(9_550);
  });
});
