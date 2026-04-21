import { describe, expect, it } from "vitest";
import { parseExternalRtmpStatusSnapshot } from "../../../src/routes/streaming-external-status.js";

describe("parseExternalRtmpStatusSnapshot", () => {
  it("allowlists the additive smoke summary fields", () => {
    const parsed = parseExternalRtmpStatusSnapshot(
      JSON.stringify({
        destinations: [],
        stats: {},
        updatedAt: Date.now(),
        captureMode: "cdp",
        smoke: {
          currentSceneUrl: "https://staging.example/stream",
          activeBundle:
            "https://staging.example/assets/StreamingMode-abc123.js",
          deliveryMode: "external_hls",
          captureFpsP50: 29.5,
          captureFpsP95: 30,
          encodeFpsP50: 28.5,
          encodeFpsP95: 29,
          updatedAt: 1234,
          ingest: {
            profile: "cloudflare_live",
            transport: "rtmps",
            audioSampleRate: 48_000,
            gopFrames: 60,
            probeOnly: true,
          },
        },
        ingest: {
          profile: "cloudflare_live",
          transport: "rtmps",
          audioSampleRate: 48_000,
          gopFrames: 60,
          probeOnly: true,
        },
        sourceRuntime: {
          ready: true,
          statusSource: "external_worker",
          captureMode: "cdp",
          degradedReason: null,
          currentSceneUrl: "https://staging.example/stream",
          activeBundle:
            "https://staging.example/assets/StreamingMode-abc123.js",
          lastFrameAt: 1230,
          lastRenderTickAt: 1231,
          lastVisualChangeAt: 1232,
          lastRecoveryAt: 1000,
          recoveryCount: 2,
          workerHeartbeatAt: 1234,
        },
        captureDiagnostics: {
          recentFrames: [
            {
              at: 1230,
              size: 2048,
              cdpTimestamp: 12.5,
            },
          ],
          recentFrameCadenceMs: [33],
          nonMonotonicCdpTimestampCount: 0,
          backpressureTransitions: [
            {
              at: 1231,
              backpressured: true,
            },
          ],
          firstFatalWriteError: {
            at: 1229,
            message: "Broken pipe",
            frameCount: 4,
            droppedFrames: 1,
            bytesReceived: 8192,
            backpressured: false,
            cdpDirectMode: true,
            uptimeMs: 900,
          },
          lastFatalWriteError: {
            at: 1232,
            message: "Input/output error",
            frameCount: 5,
            droppedFrames: 2,
            bytesReceived: 12288,
            backpressured: true,
            cdpDirectMode: true,
            uptimeMs: 1000,
          },
          pageStallBeforeLastFatalWrite: false,
          lastFrameAgeMs: 4,
          captureSessionGeneration: "capture-123",
          manifestStatus: "ok",
        },
        unexpected: {
          foo: "bar",
        },
      }),
      15_000,
      { allowStale: true },
    );

    expect(parsed?.captureMode).toBe("cdp");
    expect(parsed?.smoke).toEqual({
      currentSceneUrl: "https://staging.example/stream",
      activeBundle: "https://staging.example/assets/StreamingMode-abc123.js",
      deliveryMode: "external_hls",
      captureFpsP50: 29.5,
      captureFpsP95: 30,
      encodeFpsP50: 28.5,
      encodeFpsP95: 29,
      updatedAt: 1234,
      ingest: {
        profile: "cloudflare_live",
        transport: "rtmps",
        audioSampleRate: 48_000,
        gopFrames: 60,
        probeOnly: true,
      },
    });
    expect(parsed?.ingest).toEqual({
      profile: "cloudflare_live",
      transport: "rtmps",
      audioSampleRate: 48_000,
      gopFrames: 60,
      probeOnly: true,
    });
    expect(parsed?.sourceRuntime).toEqual({
      ready: true,
      statusSource: "external_worker",
      captureMode: "cdp",
      degradedReason: null,
      currentSceneUrl: "https://staging.example/stream",
      activeBundle: "https://staging.example/assets/StreamingMode-abc123.js",
      lastFrameAt: 1230,
      lastRenderTickAt: 1231,
      lastVisualChangeAt: 1232,
      lastRecoveryAt: 1000,
      recoveryCount: 2,
      workerHeartbeatAt: 1234,
    });
    expect(parsed?.captureDiagnostics).toEqual({
      recentFrames: [
        {
          at: 1230,
          size: 2048,
          cdpTimestamp: 12.5,
        },
      ],
      recentFrameCadenceMs: [33],
      nonMonotonicCdpTimestampCount: 0,
      backpressureTransitions: [
        {
          at: 1231,
          backpressured: true,
        },
      ],
      firstFatalWriteError: {
        at: 1229,
        message: "Broken pipe",
        frameCount: 4,
        droppedFrames: 1,
        bytesReceived: 8192,
        backpressured: false,
        cdpDirectMode: true,
        uptimeMs: 900,
      },
      lastFatalWriteError: {
        at: 1232,
        message: "Input/output error",
        frameCount: 5,
        droppedFrames: 2,
        bytesReceived: 12288,
        backpressured: true,
        cdpDirectMode: true,
        uptimeMs: 1000,
      },
      pageStallBeforeLastFatalWrite: false,
      lastFrameAgeMs: 4,
      captureSessionGeneration: "capture-123",
      manifestStatus: "ok",
    });
    expect(parsed).not.toHaveProperty("unexpected");
  });

  it("validates stats field-by-field and drops malformed values", () => {
    const parsed = parseExternalRtmpStatusSnapshot(
      JSON.stringify({
        destinations: [],
        stats: {
          bitrate: 4_000,
          fps: "30",
          uptime: 12,
          bytesReceived: 8_192,
          droppedFrames: "2",
          healthy: true,
          injected: "nope",
        },
        updatedAt: Date.now(),
      }),
      15_000,
      { allowStale: true },
    );

    expect(parsed?.stats).toEqual({
      bitrate: 4_000,
      uptime: 12,
      bytesReceived: 8_192,
      healthy: true,
    });
  });

  it("accepts x11_nvenc capture mode from external worker snapshots", () => {
    const parsed = parseExternalRtmpStatusSnapshot(
      JSON.stringify({
        destinations: [],
        stats: {},
        updatedAt: Date.now(),
        captureMode: "x11_nvenc",
        sourceRuntime: {
          ready: true,
          statusSource: "external_worker",
          captureMode: "x11_nvenc",
          degradedReason: null,
        },
      }),
      15_000,
      { allowStale: true },
    );

    expect(parsed?.captureMode).toBe("x11_nvenc");
    expect(parsed?.sourceRuntime?.captureMode).toBe("x11_nvenc");
  });

  it("drops malformed nested fields while preserving valid siblings", () => {
    const parsed = parseExternalRtmpStatusSnapshot(
      JSON.stringify({
        destinations: [],
        stats: {},
        updatedAt: Date.now(),
        rendererHealth: {
          ready: true,
          degradedReason: 123,
          updatedAt: "late",
          phase: "fight",
        },
        delivery: {
          mode: "external_hls",
          provider: "cloudflare_stream",
          playbackUrl: "https://customer.example/live.m3u8",
          ingestUrl: 42,
        },
        sourceRuntime: {
          ready: true,
          captureMode: "cdp",
          recoveryCount: "two",
          workerHeartbeatAt: 5000,
        },
        captureDiagnostics: {
          recentFrames: [
            {
              at: 10,
              size: "bad",
              cdpTimestamp: 11.5,
            },
            "bad-frame",
          ],
          recentFrameCadenceMs: [33, "slow", null],
          lastFatalWriteError: {
            at: 12,
            message: "Broken pipe",
            frameCount: "bad",
            backpressured: false,
          },
          manifestStatus: "ok",
        },
      }),
      15_000,
      { allowStale: true },
    );

    expect(parsed?.rendererHealth).toEqual({
      ready: true,
      degradedReason: null,
      updatedAt: null,
      phase: "fight",
    });
    expect(parsed?.delivery).toEqual({
      mode: "external_hls",
      provider: "cloudflare_stream",
      playbackUrl: "https://customer.example/live.m3u8",
      hlsUrl: null,
      llhlsUrl: null,
      ingestUrl: null,
    });
    expect(parsed?.sourceRuntime).toEqual({
      ready: true,
      statusSource: "none",
      captureMode: "cdp",
      degradedReason: null,
      currentSceneUrl: null,
      activeBundle: null,
      lastFrameAt: null,
      lastRenderTickAt: null,
      lastVisualChangeAt: null,
      lastRecoveryAt: null,
      recoveryCount: 0,
      workerHeartbeatAt: 5000,
    });
    expect(parsed?.captureDiagnostics).toEqual({
      recentFrames: [
        {
          at: 10,
          size: null,
          cdpTimestamp: 11.5,
        },
      ],
      recentFrameCadenceMs: [33, null],
      lastFatalWriteError: {
        at: 12,
        message: "Broken pipe",
        frameCount: null,
        backpressured: false,
      },
      manifestStatus: "ok",
    });
  });
});
