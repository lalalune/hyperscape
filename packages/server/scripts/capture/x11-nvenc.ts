/**
 * x11grab + NVENC capture path.
 *
 * Replaces Chromium CDP screencast as the canonical capture path on the
 * gpu-server. Chromium renders the scene to Xvfb as a pure renderer; FFmpeg
 * grabs the X display directly and encodes with h264_nvenc, eliminating the
 * in-browser JPEG screencast and the stdin-pipe marshal entirely.
 *
 * Hard-requires h264_nvenc (FFMPEG_HWACCEL=nvidia). No libx264 fallback — the
 * whole point of this path is to avoid the visual-quality ceiling of the other
 * modes, and silently falling back to software encode would reintroduce it.
 */
import { execSync, spawnSync } from "node:child_process";

import type { RTMPBridge } from "../../src/streaming/rtmp-bridge.js";

const X11_NVENC_PROBE_CACHE = {
  displayChecked: false,
  displayOk: false,
  nvencChecked: false,
  nvencOk: false,
};

function resolveDisplay(): string {
  const value = (process.env.DISPLAY ?? "").trim();
  return value.length > 0 ? value : ":99";
}

function parseEnvInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value.trim().replace(/_/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assertXdpyInfo(display: string): void {
  if (X11_NVENC_PROBE_CACHE.displayChecked) {
    if (!X11_NVENC_PROBE_CACHE.displayOk) {
      throw new Error(
        `[x11_nvenc] DISPLAY=${display} failed xdpyinfo preflight (cached). Refusing to start.`,
      );
    }
    return;
  }
  X11_NVENC_PROBE_CACHE.displayChecked = true;
  const result = spawnSync("xdpyinfo", ["-display", display], {
    timeout: 5000,
    stdio: "pipe",
  });
  if (result.status !== 0) {
    X11_NVENC_PROBE_CACHE.displayOk = false;
    const stderr = (result.stderr ?? "").toString().trim().slice(0, 400);
    throw new Error(
      `[x11_nvenc] xdpyinfo -display ${display} exit=${result.status}: ${stderr || "no stderr"}`,
    );
  }
  X11_NVENC_PROBE_CACHE.displayOk = true;
}

function assertNvencAvailable(): void {
  if (X11_NVENC_PROBE_CACHE.nvencChecked) {
    if (!X11_NVENC_PROBE_CACHE.nvencOk) {
      throw new Error(
        `[x11_nvenc] h264_nvenc unavailable on this host (cached). Refusing to start.`,
      );
    }
    return;
  }
  X11_NVENC_PROBE_CACHE.nvencChecked = true;
  const hwAccel = (process.env.FFMPEG_HWACCEL ?? "").trim().toLowerCase();
  if (hwAccel !== "nvidia") {
    X11_NVENC_PROBE_CACHE.nvencOk = false;
    throw new Error(
      `[x11_nvenc] FFMPEG_HWACCEL=${hwAccel || "(unset)"} — x11_nvenc mode requires FFMPEG_HWACCEL=nvidia.`,
    );
  }
  try {
    const output = execSync("ffmpeg -hide_banner -encoders 2>&1", {
      timeout: 5000,
      stdio: "pipe",
    }).toString();
    if (!/\bh264_nvenc\b/.test(output)) {
      X11_NVENC_PROBE_CACHE.nvencOk = false;
      throw new Error(
        `[x11_nvenc] h264_nvenc not listed in 'ffmpeg -encoders' output.`,
      );
    }
    X11_NVENC_PROBE_CACHE.nvencOk = true;
  } catch (err) {
    X11_NVENC_PROBE_CACHE.nvencOk = false;
    throw err instanceof Error
      ? err
      : new Error(`[x11_nvenc] ffmpeg -encoders probe failed: ${String(err)}`);
  }
}

/**
 * Start the x11grab + NVENC capture path.
 *
 * Returns `null` intentionally — unlike the WebCodecs path which returns a
 * setInterval handle to re-inject its in-page capture script, x11_nvenc has
 * no in-page script to maintain. Liveness is tracked by the supervisor loop
 * in `stream-to-rtmp.ts` using `bridge.getLastEncoderFrame{Count,At}()`.
 */
export async function startX11NvencCapture(bridge: RTMPBridge): Promise<null> {
  const display = resolveDisplay();
  const width = parseEnvInt(process.env.STREAM_CAPTURE_WIDTH, 1920);
  const height = parseEnvInt(process.env.STREAM_CAPTURE_HEIGHT, 1080);
  const fps = parseEnvInt(process.env.STREAM_FPS, 30);

  assertXdpyInfo(display);
  assertNvencAvailable();

  console.log(
    `[x11_nvenc] Starting capture: display=${display} ${width}x${height}@${fps}`,
  );

  bridge.startFFmpegX11Grab({
    display,
    width,
    height,
    fps,
    drawMouse: false,
  });

  return null;
}

/** Exposed for unit tests so the preflight cache can be reset between runs. */
export function __resetX11NvencProbeCacheForTest(): void {
  X11_NVENC_PROBE_CACHE.displayChecked = false;
  X11_NVENC_PROBE_CACHE.displayOk = false;
  X11_NVENC_PROBE_CACHE.nvencChecked = false;
  X11_NVENC_PROBE_CACHE.nvencOk = false;
}
