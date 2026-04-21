import { afterEach, describe, expect, it } from "vitest";
import { buildStreamingStatusPayload } from "../../../src/routes/streaming.js";

const ORIGINAL_ENV = {
  STREAM_DELIVERY_MODE: process.env.STREAM_DELIVERY_MODE,
  STREAM_DELIVERY_PROVIDER: process.env.STREAM_DELIVERY_PROVIDER,
  STREAM_PLAYBACK_URL: process.env.STREAM_PLAYBACK_URL,
  STREAM_PLAYBACK_HLS_URL: process.env.STREAM_PLAYBACK_HLS_URL,
  STREAM_PLAYBACK_LLHLS_URL: process.env.STREAM_PLAYBACK_LLHLS_URL,
  STREAM_INGEST_PROFILE: process.env.STREAM_INGEST_PROFILE,
  STREAM_INGEST_TRANSPORT: process.env.STREAM_INGEST_TRANSPORT,
  STREAM_AUDIO_SAMPLE_RATE: process.env.STREAM_AUDIO_SAMPLE_RATE,
  STREAM_GOP_SIZE: process.env.STREAM_GOP_SIZE,
  STREAM_CLOUDFLARE_PROBE_ONLY: process.env.STREAM_CLOUDFLARE_PROBE_ONLY,
  STREAM_FPS: process.env.STREAM_FPS,
};

function restoreEnv(
  key: keyof typeof ORIGINAL_ENV,
  value: string | undefined,
): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    restoreEnv(key as keyof typeof ORIGINAL_ENV, value);
  }
});

describe("buildStreamingStatusPayload", () => {
  it("mirrors authoritative external metrics and ingest state at nested fields", () => {
    const payload = buildStreamingStatusPayload({
      base: { running: true },
      externalSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: 1_000,
        metrics: {
          captureFps: 30,
          encodeFps: 29,
          droppedFrames: 2,
          latestFrameAt: 900,
          latestRenderTickAt: 901,
          latestVisualChangeAt: 902,
          visualChangeAgeMs: 120,
        },
        hlsManifest: {
          updatedAt: 950,
          mediaSequence: 77,
        },
        delivery: {
          mode: "external_hls",
          provider: "cloudflare_stream",
          playbackUrl: "https://customer.example/live.m3u8",
          hlsUrl: "https://customer.example/live.m3u8",
          llhlsUrl: "https://customer.example/live.m3u8?protocol=llhls",
          ingestUrl: "rtmps://live.cloudflare.example/input",
        },
        ingest: {
          profile: "cloudflare_live",
          transport: "rtmps",
          audioSampleRate: 48_000,
          gopFrames: 60,
          probeOnly: true,
        },
        smoke: {
          currentSceneUrl: "https://staging.example/stream",
          activeBundle: "https://staging.example/assets/StreamingMode-abc123.js",
          deliveryMode: "external_hls",
          captureFpsP50: 29.5,
          captureFpsP95: 30,
          encodeFpsP50: 28.5,
          encodeFpsP95: 29,
          updatedAt: 998,
          ingest: {
            profile: "cloudflare_live",
            transport: "rtmps",
            audioSampleRate: 48_000,
            gopFrames: 60,
            probeOnly: true,
          },
        },
        sourceRuntime: {
          ready: true,
          statusSource: "external_worker",
          captureMode: "cdp",
          degradedReason: null,
          currentSceneUrl: "https://staging.example/stream",
          activeBundle: "https://staging.example/assets/StreamingMode-abc123.js",
          lastFrameAt: 997,
          lastRenderTickAt: 996,
          lastVisualChangeAt: 995,
          lastRecoveryAt: 900,
          recoveryCount: 2,
          workerHeartbeatAt: 1_000,
        },
      },
      bridgeStats: {
        encoderFps: 12,
        droppedFrames: 99,
      },
      rendererHealth: {
        ready: true,
        degradedReason: null,
        updatedAt: 999,
      },
    });

    expect(payload.metrics).toMatchObject({
      captureFps: 30,
      encodeFps: 29,
      droppedFrames: 2,
      latestFrameAt: 900,
      latestRenderTickAt: 901,
      latestVisualChangeAt: 902,
      visualChangeAgeMs: 120,
    });
    expect(payload.captureFps).toBe(30);
    expect(payload.encodeFps).toBe(29);
    expect(payload.droppedFrames).toBe(2);
    expect(payload.hlsManifest).toEqual({
      updatedAt: 950,
      mediaSequence: 77,
    });
    expect(payload.deliveryMode).toBe("external_hls");
    expect(payload.deliveryProvider).toBe("cloudflare_stream");
    expect(payload.playbackUrl).toBe("https://customer.example/live.m3u8");
    expect(payload.delivery).toMatchObject({
      mode: "external_hls",
      provider: "cloudflare_stream",
      playbackUrl: "https://customer.example/live.m3u8",
      hlsUrl: "https://customer.example/live.m3u8",
      llhlsUrl: "https://customer.example/live.m3u8?protocol=llhls",
      ingestUrl: null,
    });
    expect(payload.destinations).toEqual([]);
    expect(payload.ingest).toEqual({
      profile: "cloudflare_live",
      transport: "rtmps",
      audioSampleRate: 48_000,
      gopFrames: 60,
      probeOnly: true,
    });
    expect(payload.sourceRuntime).toEqual({
      ready: true,
      statusSource: "external_worker",
      captureMode: "cdp",
      degradedReason: null,
      currentSceneUrl: "https://staging.example/stream",
      activeBundle: "https://staging.example/assets/StreamingMode-abc123.js",
      lastFrameAt: 997,
      lastRenderTickAt: 996,
      lastVisualChangeAt: 995,
      lastRecoveryAt: 900,
      recoveryCount: 2,
      workerHeartbeatAt: 1_000,
    });
    expect(payload.smoke).toEqual({
      currentSceneUrl: "https://staging.example/stream",
      activeBundle: "https://staging.example/assets/StreamingMode-abc123.js",
      deliveryMode: "external_hls",
      captureFpsP50: 29.5,
      captureFpsP95: 30,
      encodeFpsP50: 28.5,
      encodeFpsP95: 29,
      updatedAt: 998,
      ingest: {
        profile: "cloudflare_live",
        transport: "rtmps",
        audioSampleRate: 48_000,
        gopFrames: 60,
        probeOnly: true,
      },
    });
  });

  it("falls back to configured delivery and ingest info when the external snapshot is unavailable", () => {
    process.env.STREAM_DELIVERY_MODE = "external_hls";
    process.env.STREAM_DELIVERY_PROVIDER = "cloudflare_stream";
    process.env.STREAM_PLAYBACK_URL = "https://env.example/live.m3u8";
    process.env.STREAM_PLAYBACK_HLS_URL = "https://env.example/live.m3u8";
    process.env.STREAM_PLAYBACK_LLHLS_URL =
      "https://env.example/live.m3u8?protocol=llhls";
    process.env.STREAM_INGEST_PROFILE = "cloudflare_live";
    process.env.STREAM_INGEST_TRANSPORT = "rtmps";
    process.env.STREAM_AUDIO_SAMPLE_RATE = "48000";
    process.env.STREAM_GOP_SIZE = "60";
    process.env.STREAM_CLOUDFLARE_PROBE_ONLY = "true";
    process.env.STREAM_FPS = "30";

    const payload = buildStreamingStatusPayload({
      base: { running: true },
      externalSnapshot: null,
      bridgeStats: null,
      rendererHealth: {
        ready: false,
        degradedReason: "renderer_health_stale",
        updatedAt: 123,
      },
    });

    expect(payload.delivery).toMatchObject({
      mode: "external_hls",
      provider: "cloudflare_stream",
      playbackUrl: "https://env.example/live.m3u8?protocol=llhls",
      hlsUrl: "https://env.example/live.m3u8",
      llhlsUrl: "https://env.example/live.m3u8?protocol=llhls",
      ingestUrl: null,
    });
    expect(payload.ingest).toEqual({
      profile: "cloudflare_live",
      transport: "rtmps",
      audioSampleRate: 48_000,
      gopFrames: 60,
      probeOnly: true,
    });
    expect(payload.smoke).toMatchObject({
      currentSceneUrl: null,
      activeBundle: null,
      deliveryMode: "external_hls",
      captureFpsP50: null,
      captureFpsP95: null,
      encodeFpsP50: null,
      encodeFpsP95: null,
      ingest: {
        profile: "cloudflare_live",
        transport: "rtmps",
        audioSampleRate: 48_000,
        gopFrames: 60,
        probeOnly: true,
      },
    });
    expect(payload.sourceRuntime).toMatchObject({
      ready: false,
      statusSource: "in_process_bridge",
      captureMode: "none",
      degradedReason: "encoder_stalled",
    });
  });

  it("falls back to the local HLS manifest when the external snapshot is unavailable", () => {
    const payload = buildStreamingStatusPayload({
      base: { running: false },
      externalSnapshot: null,
      localHlsManifest: {
        updatedAt: 4_321,
        mediaSequence: 88,
      },
      bridgeStats: null,
      rendererHealth: {
        ready: false,
        degradedReason: "capture_client_disconnected",
        updatedAt: 123,
      },
    });

    expect(payload.hlsManifest).toEqual({
      updatedAt: 4_321,
      mediaSequence: 88,
    });
    expect(payload.hlsManifestUpdatedAt).toBe(4_321);
    expect(payload.hlsMediaSequence).toBe(88);
  });

  it("prefers external runtime booleans over local base capture flags", () => {
    const payload = buildStreamingStatusPayload({
      base: {
        running: false,
        bridgeActive: false,
        ffmpegRunning: false,
        clientConnected: false,
      },
      externalSnapshot: {
        active: true,
        ffmpegRunning: true,
        clientConnected: true,
        destinations: [],
        stats: {},
        updatedAt: 2_000,
      },
      bridgeStats: null,
      rendererHealth: {
        ready: true,
        degradedReason: null,
        updatedAt: 1_999,
      },
    });

    expect(payload.running).toBe(true);
    expect(payload.bridgeActive).toBe(true);
    expect(payload.ffmpegRunning).toBe(true);
    expect(payload.clientConnected).toBe(true);
  });

  it("treats a fresh canonical playback probe as authoritative over stale worker flags", () => {
    const payload = buildStreamingStatusPayload({
      base: { running: true, bridgeActive: true },
      externalSnapshot: {
        active: true,
        ffmpegRunning: true,
        clientConnected: true,
        destinations: [
          {
            id: "canonical-cloudflare",
            role: "canonical",
            provider: "cloudflare_stream",
            name: "External Delivery",
            transport: "srt",
            playbackUrl: "https://customer.example/live.m3u8",
            connected: false,
            error: "All tee outputs failed",
            startedAt: 3_000,
          },
        ],
        stats: {
          healthy: true,
        },
        updatedAt: 4_000,
        delivery: {
          mode: "external_hls",
          provider: "cloudflare_stream",
          playbackUrl: "https://customer.example/live.m3u8",
          hlsUrl: "https://customer.example/live.m3u8",
          llhlsUrl: "https://customer.example/live.m3u8?protocol=llhls",
          ingestUrl: "srt://live.cloudflare.example/input",
        },
        captureDiagnostics: {
          lastFatalWriteError: {
            at: 3_100,
            message: "All tee outputs failed",
            frameCount: 12,
            droppedFrames: 1,
            bytesReceived: 2_048,
            backpressured: false,
            cdpDirectMode: true,
            uptimeMs: 500,
          },
        },
        sourceRuntime: {
          ready: true,
          statusSource: "external_worker",
          captureMode: "cdp",
          degradedReason: null,
          currentSceneUrl: "https://staging.example/stream",
          activeBundle: "https://staging.example/assets/StreamingMode-abc123.js",
          lastFrameAt: 4_050,
          lastRenderTickAt: 4_040,
          lastVisualChangeAt: 4_030,
          lastRecoveryAt: 3_500,
          recoveryCount: 1,
          workerHeartbeatAt: 4_100,
        },
      },
      canonicalProbeSnapshot: {
        playbackUrl: "https://customer.example/live.m3u8",
        ready: true,
        manifestStatus: "ok",
        statusCode: 200,
        lastError: null,
        updatedAt: 4_200,
      },
      bridgeStats: null,
      rendererHealth: {
        ready: true,
        degradedReason: null,
        updatedAt: 4_199,
      },
    });

    expect(payload.canonicalStatus).toEqual({
      sourceReady: true,
      canonicalTransportConnected: true,
      canonicalPlaybackReady: true,
      manifestStatus: "ok",
      lastError: null,
      updatedAt: 4_200,
    });
    expect(payload.destinations).toHaveLength(1);
    expect(payload.destinations[0]).toMatchObject({
      id: "canonical-cloudflare",
      ingestUrl: null,
      connected: true,
      transportHealthy: true,
      playbackReady: true,
      manifestStatus: "ok",
      lastError: null,
    });
    expect(payload.captureDiagnostics).toBeNull();
  });

  it("keeps canonical playback visible but marks transport unhealthy after a fresher source incident", () => {
    const payload = buildStreamingStatusPayload({
      base: { running: false, bridgeActive: false },
      externalSnapshot: {
        active: false,
        ffmpegRunning: false,
        clientConnected: true,
        destinations: [
          {
            id: "canonical-cloudflare",
            role: "canonical",
            provider: "cloudflare_stream",
            name: "External Delivery",
            transport: "srt",
            playbackUrl: "https://customer.example/live.m3u8",
            connected: false,
            error: "encoder_stalled",
            startedAt: 3_000,
          },
        ],
        stats: {
          healthy: false,
        },
        updatedAt: 5_100,
        delivery: {
          mode: "external_hls",
          provider: "cloudflare_stream",
          playbackUrl: "https://customer.example/live.m3u8",
          hlsUrl: "https://customer.example/live.m3u8",
          llhlsUrl: "https://customer.example/live.m3u8?protocol=llhls",
          ingestUrl: "srt://live.cloudflare.example/input",
        },
        captureDiagnostics: {
          lastFatalWriteError: {
            at: 5_050,
            message: "av_interleaved_write_frame(): Input/output error",
            frameCount: 42,
            droppedFrames: 3,
            bytesReceived: 8_192,
            backpressured: true,
            cdpDirectMode: true,
            uptimeMs: 4_000,
          },
        },
        sourceRuntime: {
          ready: false,
          statusSource: "external_worker",
          captureMode: "cdp",
          degradedReason: "encoder_stalled",
          currentSceneUrl: "https://staging.example/stream",
          activeBundle: "https://staging.example/assets/StreamingMode-abc123.js",
          lastFrameAt: 5_000,
          lastRenderTickAt: 4_990,
          lastVisualChangeAt: 4_980,
          lastRecoveryAt: 4_500,
          recoveryCount: 2,
          workerHeartbeatAt: 5_100,
        },
      },
      canonicalProbeSnapshot: {
        playbackUrl: "https://customer.example/live.m3u8",
        ready: true,
        manifestStatus: "ok",
        statusCode: 200,
        lastError: null,
        updatedAt: 4_900,
      },
      bridgeStats: null,
      rendererHealth: {
        ready: false,
        degradedReason: "encoder_stalled",
        updatedAt: 5_100,
      },
    });

    expect(payload.canonicalStatus).toEqual({
      sourceReady: false,
      canonicalTransportConnected: false,
      canonicalPlaybackReady: true,
      manifestStatus: "ok",
      lastError: "encoder_stalled",
      updatedAt: 4_900,
    });
    expect(payload.destinations[0]).toMatchObject({
      ingestUrl: null,
      connected: true,
      transportHealthy: false,
      playbackReady: true,
      manifestStatus: "ok",
      lastError: "encoder_stalled",
    });
  });

  it("synthesizes canonical self-hls status from a fresh local manifest", () => {
    process.env.STREAM_DELIVERY_MODE = "self_hls";
    process.env.STREAM_PLAYBACK_URL = "https://stream.example/live/stream.m3u8";

    const payload = buildStreamingStatusPayload({
      base: { running: true, bridgeActive: true },
      externalSnapshot: {
        active: true,
        ffmpegRunning: true,
        clientConnected: true,
        destinations: [],
        stats: {
          healthy: true,
        },
        updatedAt: 10_000,
        delivery: {
          mode: "self_hls",
          provider: null,
          playbackUrl: "https://stream.example/live/stream.m3u8",
          hlsUrl: null,
          llhlsUrl: null,
          ingestUrl: null,
        },
        sourceRuntime: {
          ready: true,
          statusSource: "external_worker",
          captureMode: "cdp",
          degradedReason: null,
          currentSceneUrl: "https://staging.example/stream",
          activeBundle: null,
          lastFrameAt: 9_980,
          lastRenderTickAt: 9_970,
          lastVisualChangeAt: 9_960,
          lastRecoveryAt: null,
          recoveryCount: 0,
          workerHeartbeatAt: 10_000,
        },
      },
      localHlsManifest: {
        updatedAt: Date.now(),
        mediaSequence: 321,
      },
      bridgeStats: null,
      rendererHealth: {
        ready: true,
        degradedReason: null,
        updatedAt: 10_000,
      },
    });

    expect(payload.canonicalStatus).toMatchObject({
      sourceReady: true,
      canonicalTransportConnected: true,
      canonicalPlaybackReady: true,
      manifestStatus: "ok",
      lastError: null,
    });
    expect(payload.destinations).toContainEqual(
      expect.objectContaining({
        id: "canonical-self-hls",
        provider: "self_hls",
        role: "canonical",
        transport: "hls",
        playbackUrl: "https://stream.example/live/stream.m3u8",
        connected: true,
        transportHealthy: true,
        playbackReady: true,
        manifestStatus: "ok",
        lastError: null,
      }),
    );
  });

  it("includes persisted authority and Cloudflare diagnostics when available", () => {
    const payload = buildStreamingStatusPayload({
      base: { running: true },
      externalSnapshot: null,
      canonicalProbeSnapshot: {
        ready: false,
        manifestStatus: "missing",
        lastError: "playback_unconfigured",
        updatedAt: 4_200,
      },
      bridgeStats: null,
      rendererHealth: {
        ready: false,
        degradedReason: "encoder_stalled",
        updatedAt: 123,
      },
      persistedAuthorityState: {
        canonicalProviderState: {
          activeProvider: "self_hls",
          primaryHealthySince: 3_000,
          updatedAt: 3_500,
        },
        cloudflareLifecycle: {
          eventType: "stream_live_input.disconnected",
          eventName: "Stream Live Input Disconnected",
          liveInputId: "live-input-123",
          videoId: "video-456",
          status: "disconnected",
          errorCode: "publish_disconnected",
          errorMessage: "Publisher disconnected unexpectedly",
          occurredAt: 4_000,
          receivedAt: 4_100,
        },
        cloudflareLastWebhook: {
          eventType: "stream_live_input.disconnected",
          eventName: "Stream Live Input Disconnected",
          liveInputId: "live-input-123",
          videoId: "video-456",
          occurredAt: 4_000,
          receivedAt: 4_100,
        },
      },
      cloudflareLiveInputId: "live-input-123",
    });

    expect(payload.authority).toEqual({
      activeCanonicalProvider: "self_hls",
      primaryHealthySince: 3_000,
      updatedAt: 3_500,
    });
    expect(payload.cloudflare).toEqual({
      liveInputId: null,
      lifecycle: null,
      lastWebhook: null,
      lastPlaybackProbe: null,
      lastExternalTransportError: null,
    });
  });
});
