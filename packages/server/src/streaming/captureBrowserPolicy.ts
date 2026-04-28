type CaptureReadinessDiagnostics = {
  hasCanvas: boolean;
  hasStreamingBootUi: boolean;
  hasCriticalErrorUi: boolean;
  readyFlag: boolean;
  bootDiagnostics?: unknown;
};

export type CaptureRendererHealthSnapshot = {
  ready: boolean;
  degradedReason: string | null;
  diagnostics: CaptureReadinessDiagnostics | null;
};

export function buildDefaultCaptureLaunchArgs(params: {
  angleBackend: string;
  featureFlags: string;
  disableSandbox?: boolean;
  /**
   * When set, pins the Chromium window to exactly these dimensions at the
   * top-left of the display (via --kiosk + --window-size + --window-position).
   * This is required by the x11_nvenc capture mode so FFmpeg's x11grab reads
   * the canvas region exactly and not stray Chromium chrome or surrounding
   * screen pixels.
   */
  fullScreenPin?: { width: number; height: number };
}): string[] {
  return [
    "--use-gl=angle",
    `--use-angle=${params.angleBackend}`,
    "--enable-webgl",
    "--enable-unsafe-webgpu",
    params.featureFlags,
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization",
    ...(params.disableSandbox ? ["--no-sandbox"] : []),
    "--disable-dev-shm-usage",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-hang-monitor",
    ...(params.fullScreenPin
      ? [
          "--kiosk",
          `--window-size=${params.fullScreenPin.width},${params.fullScreenPin.height}`,
          "--window-position=0,0",
          "--hide-scrollbars",
          "--disable-infobars",
        ]
      : []),
    // NOTE: --user-data-dir is NOT passed here because Playwright
    // requires launchPersistentContext() for that. IndexedDB persistence
    // across Tier-3 browser restarts is a future improvement.
    // NOTE: --disable-frame-rate-limit was tested and regressed the
    // pipeline (353 dropped frames, encoder stall). The Xvfb 60Hz
    // modeline applied in stream-to-rtmp.ts startup is the correct fix
    // for the compositor rate — it keeps Chrome V-sync locked to 60Hz
    // without overwhelming the CDP screencast/FFmpeg pipeline.
  ];
}

export function resolveAllowedCaptureOrigins(
  rawUrls: readonly string[],
): string[] {
  const origins = new Set<string>();
  for (const rawUrl of rawUrls) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        origins.add(parsed.origin);
      }
    } catch {
      // Ignore malformed candidate URLs here; startup will fail when it tries
      // to navigate to them.
    }
  }
  return [...origins];
}

export function resolveUnexpectedCaptureOrigin(
  rawUrl: string,
  allowedOrigins: readonly string[],
): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return parsed.origin;
    }
    return allowedOrigins.includes(parsed.origin) ? null : parsed.origin;
  } catch {
    return rawUrl;
  }
}

export function shouldAcceptCaptureReadiness(params: {
  snapshot: CaptureRendererHealthSnapshot;
  startedAt: number;
  nowMs: number;
  bootUiGraceMs?: number;
}): boolean {
  const { snapshot, startedAt, nowMs } = params;
  if (snapshot.ready) {
    return true;
  }

  if (snapshot.diagnostics?.hasCriticalErrorUi) {
    return false;
  }

  if (
    snapshot.degradedReason &&
    snapshot.degradedReason !== "loading_overlay_active"
  ) {
    return false;
  }

  return (
    snapshot.diagnostics?.hasStreamingBootUi === true &&
    nowMs - startedAt >= (params.bootUiGraceMs ?? 180_000)
  );
}
