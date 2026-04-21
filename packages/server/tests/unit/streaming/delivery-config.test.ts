import { describe, expect, it } from "vitest";
import {
  resolveExternalStreamDeliveryInfo,
  resolveStreamDeliveryInfo,
} from "../../../src/streaming/delivery-config.js";

describe("resolveStreamDeliveryInfo", () => {
  it("does not infer external playback from ingest alone", () => {
    const delivery = resolveStreamDeliveryInfo({
      STREAM_DELIVERY_MODE: "external_hls",
      STREAM_DELIVERY_PROVIDER: "cloudflare_stream",
      STREAM_INGEST_RTMPS_URL: "rtmps://live.cloudflare.com:443/live",
    });

    expect(delivery).toEqual({
      mode: "external_hls",
      provider: "cloudflare_stream",
      playbackUrl: null,
      hlsUrl: null,
      llhlsUrl: null,
      ingestUrl: "rtmps://live.cloudflare.com:443/live",
    });
  });

  it("prefers Cloudflare LL-HLS playback when external playback URLs are configured", () => {
    const delivery = resolveStreamDeliveryInfo({
      STREAM_DELIVERY_MODE: "external_hls",
      STREAM_DELIVERY_PROVIDER: "cloudflare_stream",
      STREAM_INGEST_RTMPS_URL: "rtmps://live.cloudflare.com:443/live",
      STREAM_PLAYBACK_HLS_URL: "https://video.example/live.m3u8",
      STREAM_PLAYBACK_LLHLS_URL:
        "https://video.example/live.m3u8?protocol=llhls",
    });

    expect(delivery).toEqual({
      mode: "external_hls",
      provider: "cloudflare_stream",
      playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
      hlsUrl: "https://video.example/live.m3u8",
      llhlsUrl: "https://video.example/live.m3u8?protocol=llhls",
      ingestUrl: "rtmps://live.cloudflare.com:443/live",
    });
  });

  it("keeps self-HLS playback separate from external playback URLs", () => {
    const delivery = resolveStreamDeliveryInfo({
      STREAM_DELIVERY_MODE: "self_hls",
      STREAM_PLAYBACK_URL: "https://self.example/live/stream.m3u8",
      STREAM_PLAYBACK_HLS_URL: "https://video.example/live.m3u8",
      STREAM_PLAYBACK_LLHLS_URL:
        "https://video.example/live.m3u8?protocol=llhls",
      STREAM_INGEST_RTMPS_URL: "rtmps://live.cloudflare.com:443/live",
    });

    expect(delivery).toEqual({
      mode: "self_hls",
      provider: null,
      playbackUrl: "https://self.example/live/stream.m3u8",
      hlsUrl: null,
      llhlsUrl: null,
      ingestUrl: null,
    });
  });

  it("preserves external playback config even when self-hls is canonical", () => {
    const delivery = resolveExternalStreamDeliveryInfo({
      STREAM_DELIVERY_MODE: "self_hls",
      STREAM_PLAYBACK_URL: "https://self.example/live/stream.m3u8",
      STREAM_PLAYBACK_HLS_URL: "https://video.example/live.m3u8",
      STREAM_PLAYBACK_LLHLS_URL:
        "https://video.example/live.m3u8?protocol=llhls",
      STREAM_INGEST_RTMPS_URL: "rtmps://live.cloudflare.com:443/live",
      STREAM_DELIVERY_PROVIDER: "cloudflare_stream",
    });

    expect(delivery).toEqual({
      provider: "cloudflare_stream",
      playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
      hlsUrl: "https://video.example/live.m3u8",
      llhlsUrl: "https://video.example/live.m3u8?protocol=llhls",
      ingestUrl: "rtmps://live.cloudflare.com:443/live",
    });
  });
});
