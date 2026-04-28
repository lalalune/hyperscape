import { afterEach, describe, expect, it, vi } from "vitest";

import { RTMPBridge } from "../../../src/streaming/rtmp-bridge.js";

const ENV_KEYS = [
  "FFMPEG_HWACCEL",
  "STREAM_INGEST_PROFILE",
  "STREAM_INGEST_TRANSPORT",
  "STREAM_AUDIO_SAMPLE_RATE",
  "STREAM_GOP_SIZE",
  "STREAM_CLOUDFLARE_PROBE_ONLY",
  "STREAM_FPS",
  "STREAM_CAPTURE_WIDTH",
  "STREAM_CAPTURE_HEIGHT",
  "STREAM_OUTPUT_WIDTH",
  "STREAM_OUTPUT_HEIGHT",
  "STREAM_DELIVERY_MODE",
  "STREAM_DELIVERY_PROVIDER",
  "STREAM_EXTERNAL_DELIVERY_PROVIDER",
  "STREAM_EXTERNAL_INGEST_RTMPS_URL",
  "STREAM_INGEST_RTMPS_URL",
  "STREAM_INGEST_STREAM_KEY",
  "STREAM_ENABLED_DESTINATIONS",
  "DUEL_STREAM_DESTINATIONS",
  "TWITCH_STREAM_KEY",
  "YOUTUBE_STREAM_KEY",
  "KICK_STREAM_KEY",
  "RTMP_DESTINATIONS_JSON",
  "STREAM_AUDIO_ENABLED",
  "PULSE_AUDIO_DEVICE",
  "STREAM_LOW_LATENCY",
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  restoreEnv();
});

function baseEnv(): void {
  // Force silent-audio path so tests never shell out to pactl.
  process.env.STREAM_AUDIO_ENABLED = "false";
  // Single Cloudflare canonical destination. Set the full delivery-config
  // surface (playback + ingest URLs, cloudflare probe-only) so
  // loadDestinationsFromEnv resolves the `external` destination rather than
  // falling back to the null-output placeholder.
  process.env.STREAM_INGEST_PROFILE = "cloudflare_live";
  process.env.STREAM_CLOUDFLARE_PROBE_ONLY = "true";
  process.env.STREAM_DELIVERY_MODE = "external_hls";
  process.env.STREAM_DELIVERY_PROVIDER = "cloudflare_stream";
  process.env.STREAM_PLAYBACK_URL =
    "https://videodelivery.net/test/manifest/video.m3u8?protocol=llhls";
  process.env.STREAM_PLAYBACK_HLS_URL =
    "https://videodelivery.net/test/manifest/video.m3u8";
  process.env.STREAM_PLAYBACK_LLHLS_URL =
    "https://videodelivery.net/test/manifest/video.m3u8?protocol=llhls";
  process.env.STREAM_INGEST_RTMPS_URL = "rtmps://live.cloudflare.com:443/live";
  process.env.STREAM_INGEST_STREAM_KEY = "stream-key-xxxxxxxx";
  // No fanout by default — restrict to the external canonical so tests are
  // deterministic. Individual tests override this to exercise tee muxing.
  process.env.STREAM_ENABLED_DESTINATIONS = "external";
  process.env.STREAM_AUDIO_SAMPLE_RATE = "48000";
  process.env.STREAM_GOP_SIZE = "60";
  process.env.STREAM_FPS = "30";
}

/**
 * Construct a bridge and prime its outputs so buildX11GrabArgsForTest
 * returns a representative args list. Production `startFFmpegX11Grab` does
 * this internally; the test helper does not.
 */
function makeBridge(): RTMPBridge {
  const bridge = new RTMPBridge();
  (bridge as any).initOutputs();
  return bridge;
}

function argIndex(args: string[], flag: string): number {
  return args.indexOf(flag);
}

function argValue(args: string[], flag: string): string | undefined {
  const idx = argIndex(args, flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

describe("RTMPBridge x11grab input", () => {
  it("builds the expected x11grab input at 1920x1080@30 with mouse hidden", () => {
    baseEnv();
    process.env.FFMPEG_HWACCEL = "nvidia";
    const bridge = makeBridge();
    const args = bridge.buildX11GrabArgsForTest({
      display: ":99",
      width: 1920,
      height: 1080,
      fps: 30,
      drawMouse: false,
    });

    expect(argValue(args, "-f")).toBe("x11grab");
    expect(argValue(args, "-video_size")).toBe("1920x1080");
    expect(argValue(args, "-framerate")).toBe("30");
    expect(argValue(args, "-draw_mouse")).toBe("0");
    // x11grab input is the first `-i`, must point at display :99.0+0,0.
    expect(argValue(args, "-i")).toBe(":99.0+0,0");
    // Output frame rate forced to the same value as the x11grab framerate.
    expect(argValue(args, "-r")).toBe("30");
  });

  it("honours drawMouse=true", () => {
    baseEnv();
    process.env.FFMPEG_HWACCEL = "nvidia";
    const bridge = makeBridge();
    const args = bridge.buildX11GrabArgsForTest({
      display: ":99",
      width: 1280,
      height: 720,
      fps: 30,
      drawMouse: true,
    });
    expect(argValue(args, "-draw_mouse")).toBe("1");
  });

  it("accepts alternative display + 60fps + 1280x720", () => {
    baseEnv();
    process.env.FFMPEG_HWACCEL = "nvidia";
    const bridge = makeBridge();
    const args = bridge.buildX11GrabArgsForTest({
      display: ":100",
      width: 1280,
      height: 720,
      fps: 60,
      drawMouse: false,
    });
    expect(argValue(args, "-video_size")).toBe("1280x720");
    expect(argValue(args, "-framerate")).toBe("60");
    expect(argValue(args, "-i")).toBe(":100.0+0,0");
  });

  it("applies the existing Cloudflare-safe NVENC encoder args alongside x11grab input", () => {
    baseEnv();
    process.env.FFMPEG_HWACCEL = "nvidia";
    const bridge = makeBridge();
    const args = bridge.buildX11GrabArgsForTest({
      display: ":99",
      width: 1920,
      height: 1080,
      fps: 30,
      drawMouse: false,
    });

    // NVENC encoder block comes straight from buildVideoEncoderArgs — we just
    // assert the signature values so a regression in the shared builder is
    // caught here as well.
    expect(args).toEqual(
      expect.arrayContaining(["-c:v", "h264_nvenc", "-profile:v", "high"]),
    );
  });

  it("includes silent audio input (anullsrc) and maps 0:v:0 + 1:a:0", () => {
    baseEnv();
    process.env.FFMPEG_HWACCEL = "nvidia";
    const bridge = makeBridge();
    const args = bridge.buildX11GrabArgsForTest({
      display: ":99",
      width: 1920,
      height: 1080,
      fps: 30,
      drawMouse: false,
    });

    // Audio input must come from lavfi/anullsrc in the test environment
    // (STREAM_AUDIO_ENABLED=false forces this path).
    const lavfiIdx = args.findIndex(
      (a, i) => a === "-f" && args[i + 1] === "lavfi",
    );
    expect(lavfiIdx).toBeGreaterThanOrEqual(0);
    expect(args).toEqual(
      expect.arrayContaining(["-map", "0:v:0", "-map", "1:a:0"]),
    );
  });

  it("uses direct flv output with exactly one destination (no tee muxer)", () => {
    baseEnv();
    process.env.FFMPEG_HWACCEL = "nvidia";
    const bridge = makeBridge();
    const args = bridge.buildX11GrabArgsForTest({
      display: ":99",
      width: 1920,
      height: 1080,
      fps: 30,
      drawMouse: false,
    });
    // Direct output → last `-f` should be `flv` (not `tee`).
    const lastFormatIdx = args.lastIndexOf("-f");
    expect(args[lastFormatIdx + 1]).toBe("flv");
    expect(args).not.toContain("tee");
  });

  it("falls back to tee muxer when multiple destinations are enabled", () => {
    baseEnv();
    process.env.FFMPEG_HWACCEL = "nvidia";
    // Adding Twitch + YouTube alongside external gives us three destinations.
    process.env.STREAM_ENABLED_DESTINATIONS = "external,twitch,youtube";
    process.env.TWITCH_STREAM_KEY = "twitch-test-key";
    process.env.YOUTUBE_STREAM_KEY = "youtube-test-key";
    const bridge = makeBridge();
    const args = bridge.buildX11GrabArgsForTest({
      display: ":99",
      width: 1920,
      height: 1080,
      fps: 30,
      drawMouse: false,
    });
    const lastFormatIdx = args.lastIndexOf("-f");
    expect(args[lastFormatIdx + 1]).toBe("tee");
    // Tee muxer string must reference all three RTMP endpoints.
    const teeString = args[lastFormatIdx + 2] ?? "";
    expect(teeString).toContain("rtmps://live.cloudflare.com");
    expect(teeString).toContain("live.twitch.tv");
    expect(teeString).toContain("rtmp.youtube.com");
  });

  it("sets wallclock PTS + low-latency input flags (no buffering)", () => {
    baseEnv();
    process.env.FFMPEG_HWACCEL = "nvidia";
    const bridge = makeBridge();
    const args = bridge.buildX11GrabArgsForTest({
      display: ":99",
      width: 1920,
      height: 1080,
      fps: 30,
      drawMouse: false,
    });
    expect(args).toEqual(
      expect.arrayContaining([
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-use_wallclock_as_timestamps",
        "1",
      ]),
    );
  });
});

describe("RTMPBridge encoder frame parsing", () => {
  it("updates lastEncoderFrameCount and lastEncoderFrameAt from FFmpeg progress lines", () => {
    baseEnv();
    const bridge = new RTMPBridge();

    expect(bridge.getLastEncoderFrameCount()).toBe(0);
    expect(bridge.getLastEncoderFrameAt()).toBeNull();

    const nowBefore = Date.now();
    (bridge as any).parseFFmpegOutput("frame=  120 fps= 30.0 q=28.0");
    const nowAfter = Date.now();
    expect(bridge.getLastEncoderFrameCount()).toBe(120);
    const stampedAt = bridge.getLastEncoderFrameAt();
    expect(stampedAt).not.toBeNull();
    // stampedAt should be within the [nowBefore, nowAfter] wallclock window.
    expect(stampedAt!).toBeGreaterThanOrEqual(nowBefore);
    expect(stampedAt!).toBeLessThanOrEqual(nowAfter);
  });

  it("is monotonic — lower frame counts are ignored", () => {
    baseEnv();
    const bridge = new RTMPBridge();
    (bridge as any).parseFFmpegOutput("frame=  200 fps= 30.0 q=28.0");
    const firstStamp = bridge.getLastEncoderFrameAt();
    expect(bridge.getLastEncoderFrameCount()).toBe(200);

    // A stray earlier progress line (can happen right after FFmpeg restart
    // if stderr reorders) must not rewind the counter.
    (bridge as any).parseFFmpegOutput("frame=   50 fps= 29.9 q=27.5");
    expect(bridge.getLastEncoderFrameCount()).toBe(200);
    expect(bridge.getLastEncoderFrameAt()).toBe(firstStamp);
  });
});
