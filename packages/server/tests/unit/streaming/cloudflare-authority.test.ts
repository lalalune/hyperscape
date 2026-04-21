import { describe, expect, it } from "vitest";
import {
  reconcileCloudflareAuthority,
  summarizeCloudflareLiveWebhook,
  verifyCloudflareWebhookSecret,
} from "../../../src/streaming/cloudflare-authority.js";

describe("cloudflare-authority", () => {
  it("verifies the Cloudflare notification secret header", () => {
    expect(
      verifyCloudflareWebhookSecret(
        {
          "cf-webhook-auth": "super-secret",
        },
        "super-secret",
      ),
    ).toBe(true);
    expect(
      verifyCloudflareWebhookSecret(
        {
          "cf-webhook-auth": "wrong-secret",
        },
        "super-secret",
      ),
    ).toBe(false);
  });

  it("summarizes live webhook payloads into webhook and lifecycle snapshots", () => {
    const summary = summarizeCloudflareLiveWebhook({
      payload: {
        alert_type: "stream_live_input.disconnected",
        name: "Stream Live Input Disconnected",
        event: {
          input_id: "live-input-123",
          video_id: "video-456",
          timestamp: "2026-04-09T02:00:00.000Z",
          error_code: "publish_disconnected",
          error_message: "Publisher disconnected unexpectedly",
        },
      },
      receivedAt: 1_234_567,
    });

    expect(summary.webhook).toEqual({
      eventType: "stream_live_input.disconnected",
      eventName: "Stream Live Input Disconnected",
      liveInputId: "live-input-123",
      videoId: "video-456",
      occurredAt: Date.parse("2026-04-09T02:00:00.000Z"),
      receivedAt: 1_234_567,
    });
    expect(summary.lifecycle).toEqual({
      eventType: "stream_live_input.disconnected",
      eventName: "Stream Live Input Disconnected",
      liveInputId: "live-input-123",
      videoId: "video-456",
      status: "disconnected",
      errorCode: "publish_disconnected",
      errorMessage: "Publisher disconnected unexpectedly",
      occurredAt: Date.parse("2026-04-09T02:00:00.000Z"),
      receivedAt: 1_234_567,
    });
  });

  it("prefers the freshest provider evidence when reconciling readiness", () => {
    const reconciliation = reconcileCloudflareAuthority({
      sourceRuntimeReady: true,
      lifecycle: {
        eventType: "stream_live_input.disconnected",
        eventName: "Disconnected",
        liveInputId: "live-input-123",
        videoId: "video-stale",
        status: "disconnected",
        errorCode: null,
        errorMessage: null,
        occurredAt: 100,
        receivedAt: 100,
      },
      lifecyclePoll: {
        liveInputId: "live-input-456",
        videoUid: "video-fresh",
        status: "connected",
        providerLive: true,
        statusSummary: "connected",
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        occurredAt: 950,
        receivedAt: 950,
      },
      playbackProbe: {
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        ready: true,
        manifestStatus: "ok",
        statusCode: 200,
        lastError: null,
        updatedAt: 960,
      },
      previous: null,
      nowMs: 1_000,
      freshnessMs: 200,
      playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
    });

    expect(reconciliation).toMatchObject({
      revision: 1,
      decision: "ready",
      reason: null,
      liveInputId: "live-input-456",
      videoUid: "video-fresh",
      lifecycleStatus: "connected",
      providerLive: true,
      playbackProbeReady: true,
      playbackProbeStatusCode: 200,
      playbackManifestStatus: "ok",
    });
  });

  it("blocks as authority_stale when provider or probe evidence is stale", () => {
    const reconciliation = reconcileCloudflareAuthority({
      sourceRuntimeReady: true,
      lifecycle: {
        eventType: "stream_live_input.connected",
        eventName: "Connected",
        liveInputId: "live-input-123",
        videoId: "video-456",
        status: "connected",
        errorCode: null,
        errorMessage: null,
        occurredAt: 100,
        receivedAt: 100,
      },
      lifecyclePoll: null,
      playbackProbe: {
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        ready: true,
        manifestStatus: "ok",
        statusCode: 200,
        lastError: null,
        updatedAt: 100,
      },
      previous: null,
      nowMs: 1_000,
      freshnessMs: 200,
      playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
    });

    expect(reconciliation).toMatchObject({
      revision: 1,
      decision: "blocked",
      reason: "authority_stale",
      providerLive: false,
      playbackProbeReady: false,
      playbackManifestStatus: "unknown",
    });
  });

  it("preserves reconciliation revision when the decision is semantically unchanged", () => {
    const previous = reconcileCloudflareAuthority({
      sourceRuntimeReady: true,
      lifecycle: null,
      lifecyclePoll: {
        liveInputId: "live-input-123",
        videoUid: "video-456",
        status: "connected",
        providerLive: true,
        statusSummary: "connected",
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        occurredAt: 950,
        receivedAt: 950,
      },
      playbackProbe: {
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        ready: true,
        manifestStatus: "ok",
        statusCode: 200,
        lastError: null,
        updatedAt: 960,
      },
      previous: null,
      nowMs: 1_000,
      freshnessMs: 200,
      playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
    });

    const next = reconcileCloudflareAuthority({
      sourceRuntimeReady: true,
      lifecycle: null,
      lifecyclePoll: {
        liveInputId: "live-input-123",
        videoUid: "video-456",
        status: "connected",
        providerLive: true,
        statusSummary: "still connected",
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        occurredAt: 1_050,
        receivedAt: 1_050,
      },
      playbackProbe: {
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        ready: true,
        manifestStatus: "ok",
        statusCode: 200,
        lastError: null,
        updatedAt: 1_060,
      },
      previous,
      nowMs: 1_100,
      freshnessMs: 200,
      playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
    });

    expect(previous.revision).toBe(1);
    expect(next.revision).toBe(1);
    expect(next.decision).toBe("ready");
    expect(next.reason).toBeNull();
  });
});
