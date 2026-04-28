import { describe, expect, it } from "vitest";
import {
  assertValidStreamIngestSettings,
  resolveStreamIngestSettings,
  validateStreamIngestSettings,
} from "../../../src/streaming/ingest-config.js";

describe("resolveStreamIngestSettings", () => {
  it("defaults cloudflare_live to 2-second GOP and 48k audio", () => {
    const settings = resolveStreamIngestSettings({
      STREAM_INGEST_PROFILE: "cloudflare_live",
      STREAM_FPS: "30",
    });

    expect(settings).toMatchObject({
      profile: "cloudflare_live",
      transport: "rtmps",
      audioSampleRate: 48_000,
      gopFrames: 60,
      probeOnly: false,
    });
  });

  it("resolves explicit SRT transport settings", () => {
    const settings = resolveStreamIngestSettings({
      STREAM_INGEST_PROFILE: "cloudflare_live",
      STREAM_INGEST_TRANSPORT: "srt",
      STREAM_INGEST_SRT_URL: "srt://live.cloudflare.com:778",
      STREAM_INGEST_SRT_STREAM_ID: "abc123",
      STREAM_INGEST_SRT_PASSPHRASE: "secret",
      STREAM_CLOUDFLARE_PROBE_ONLY: "true",
      STREAM_AUDIO_SAMPLE_RATE: "48000",
      STREAM_GOP_SIZE: "60",
    });

    expect(settings).toMatchObject({
      profile: "cloudflare_live",
      transport: "srt",
      audioSampleRate: 48_000,
      gopFrames: 60,
      probeOnly: true,
      srtUrl: "srt://live.cloudflare.com:778",
      srtStreamId: "abc123",
      srtPassphrase: "secret",
    });
  });

  it("reports invalid external RTMPS ingest configuration", () => {
    const issues = validateStreamIngestSettings({
      STREAM_DELIVERY_MODE: "external_hls",
      STREAM_INGEST_TRANSPORT: "rtmps",
      STREAM_INGEST_RTMPS_URL: "not-a-url",
    });

    expect(issues).toEqual([
      "STREAM_INGEST_RTMPS_URL or STREAM_EXTERNAL_INGEST_RTMPS_URL must be a valid rtmp:// or rtmps:// URL",
      "STREAM_INGEST_STREAM_KEY is required when STREAM_INGEST_TRANSPORT=rtmps",
    ]);
  });

  it("accepts the legacy external-prefixed RTMPS ingest URL", () => {
    const issues = validateStreamIngestSettings({
      STREAM_DELIVERY_MODE: "external_hls",
      STREAM_INGEST_TRANSPORT: "rtmps",
      STREAM_EXTERNAL_INGEST_RTMPS_URL: "rtmps://live.cloudflare.com:443/live",
      STREAM_INGEST_STREAM_KEY: "stream-key",
    });

    expect(issues).toEqual([]);
  });

  it("throws when SRT external ingest settings are malformed", () => {
    expect(() =>
      assertValidStreamIngestSettings({
        STREAM_DELIVERY_MODE: "external_hls",
        STREAM_INGEST_TRANSPORT: "srt",
        STREAM_INGEST_SRT_URL: "https://example.com/not-srt",
        STREAM_INGEST_SRT_STREAM_ID: "",
        STREAM_INGEST_SRT_PASSPHRASE: "short",
      }),
    ).toThrowError(
      /Invalid stream ingest configuration: STREAM_INGEST_SRT_URL must be a valid srt:\/\/ URL; STREAM_INGEST_SRT_STREAM_ID is required when STREAM_INGEST_TRANSPORT=srt; STREAM_INGEST_SRT_PASSPHRASE must be at least 10 characters/,
    );
  });
});
