type CaptureReadinessDiagnostics = {
  hasCanvas: boolean;
  hasStreamingBootUi: boolean;
  hasCriticalErrorUi: boolean;
  readyFlag: boolean;
};

export type CaptureRendererHealthSnapshot = {
  ready: boolean;
  degradedReason: string | null;
  diagnostics: CaptureReadinessDiagnostics | null;
};

export const DEFAULT_CAPTURE_GAME_URL = "http://localhost:3333/stream.html";

export function applyCaptureFrameRateToUrl(
  rawUrl: string,
  framesPerSecond: number,
): string {
  try {
    const url = new URL(rawUrl);
    const safeFps = Number.isFinite(framesPerSecond)
      ? Math.min(60, Math.max(1, Math.round(framesPerSecond)))
      : 30;
    url.searchParams.set("streamFps", String(safeFps));
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function resolveCaptureUrlCandidates(params: {
  primaryUrl?: string;
  fallbackUrls?: string;
}): string[] {
  const primaryUrl = params.primaryUrl?.trim() || DEFAULT_CAPTURE_GAME_URL;
  const explicitFallbacks = (params.fallbackUrls ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set([primaryUrl, ...explicitFallbacks])];
}

export function buildDefaultCaptureLaunchArgs(params: {
  angleBackend: string;
  featureFlags: string;
  disableSandbox?: boolean;
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
