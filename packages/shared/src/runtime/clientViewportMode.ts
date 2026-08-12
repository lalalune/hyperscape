interface HyperiaViewportWindow extends Window {
  __HYPERIA_EMBEDDED__?: boolean;
  __HYPERIA_CONFIG__?: {
    mode?: string;
  };
}

function parseTruthy(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

function getWindowRef(win?: Window): HyperiaViewportWindow | undefined {
  if (win) return win as HyperiaViewportWindow;
  if (typeof window === "undefined") return undefined;
  return window as HyperiaViewportWindow;
}

function getSearchParams(win: HyperiaViewportWindow): URLSearchParams | null {
  try {
    return new URLSearchParams(win.location.search);
  } catch {
    return null;
  }
}

export function isStreamPageRoute(win?: Window): boolean {
  const windowRef = getWindowRef(win);
  if (!windowRef) return false;

  const pathname = windowRef.location.pathname.trim().toLowerCase();
  if (pathname.endsWith("/stream.html") || pathname === "/stream.html") {
    return true;
  }

  const params = getSearchParams(windowRef);
  return (params?.get("page") || "").trim().toLowerCase() === "stream";
}

export function isEmbeddedSpectatorViewport(win?: Window): boolean {
  const windowRef = getWindowRef(win);
  if (!windowRef) return false;

  const params = getSearchParams(windowRef);
  const embeddedFromQuery = parseTruthy(params?.get("embedded"));
  const modeFromQuery = (params?.get("mode") || "").trim().toLowerCase();

  const embeddedFromConfig =
    windowRef.__HYPERIA_EMBEDDED__ === true &&
    windowRef.__HYPERIA_CONFIG__?.mode === "spectator";

  return (
    (embeddedFromQuery && modeFromQuery === "spectator") || embeddedFromConfig
  );
}

export function isStreamingLikeViewport(win?: Window): boolean {
  return isStreamPageRoute(win) || isEmbeddedSpectatorViewport(win);
}

export function shouldStreamVegetationBackgroundLods(win?: Window): boolean {
  return !isStreamingLikeViewport(win);
}

export interface ClientViewportRuntimeProfile {
  streamingLike: boolean;
  enableLocalPhysics: boolean;
  enableProceduralExplorationSystems: boolean;
  prewarmTreeCache: boolean;
}

/**
 * Resolve expensive client-world capabilities once, before systems register.
 * Broadcast/spectator viewports render authoritative arena state and never
 * control an exploration character, so they do not need local physics or the
 * world-wide procedural town/POI planning pass. Interactive clients retain the
 * complete exploration runtime.
 */
export function resolveClientViewportRuntimeProfile(
  win?: Window,
): ClientViewportRuntimeProfile {
  const streamingLike = isStreamingLikeViewport(win);
  const interactive = !streamingLike;
  return {
    streamingLike,
    enableLocalPhysics: interactive,
    enableProceduralExplorationSystems: interactive,
    prewarmTreeCache: interactive,
  };
}

export function resolveStreamingRenderFrameRate(
  win?: Window,
  fallback = 30,
): number {
  const safeFallback = Number.isFinite(fallback)
    ? Math.min(60, Math.max(1, Math.round(fallback)))
    : 30;
  const windowRef = getWindowRef(win);
  if (!windowRef) return safeFallback;
  const rawValue = getSearchParams(windowRef)?.get("streamFps") || "";
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return safeFallback;
  return Math.min(60, Math.max(1, parsed));
}
