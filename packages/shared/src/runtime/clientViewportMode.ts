interface HyperscapeViewportWindow extends Window {
  __HYPERSCAPE_EMBEDDED__?: boolean;
  __HYPERSCAPE_CONFIG__?: {
    mode?: string;
  };
}

export type HyperscapeViewportMode = "spectator" | "stream" | "free";

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

function getWindowRef(win?: Window): HyperscapeViewportWindow | undefined {
  if (win) {
    return win as HyperscapeViewportWindow;
  }
  if (typeof window === "undefined") return undefined;
  return window as HyperscapeViewportWindow;
}

function getSearchParams(
  win: HyperscapeViewportWindow,
): URLSearchParams | null {
  try {
    return new URLSearchParams(win.location.search);
  } catch {
    return null;
  }
}

function normalizeViewportMode(
  value: unknown,
): HyperscapeViewportMode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "spectator" ||
    normalized === "stream" ||
    normalized === "free"
    ? normalized
    : null;
}

function isStreamPath(pathname: string): boolean {
  return /\/stream(?:\.html)?\/?$/.test(pathname);
}

export function getViewportMode(
  win?: Window,
): HyperscapeViewportMode | null {
  const windowRef = getWindowRef(win);
  if (!windowRef) return null;

  const params = getSearchParams(windowRef);
  const queryMode = normalizeViewportMode(params?.get("mode"));
  if (queryMode) {
    return queryMode;
  }

  return normalizeViewportMode(windowRef.__HYPERSCAPE_CONFIG__?.mode);
}

export function isStreamPageRoute(win?: Window): boolean {
  const windowRef = getWindowRef(win);
  if (!windowRef) return false;

  const pathname = windowRef.location.pathname.trim().toLowerCase();
  if (isStreamPath(pathname)) {
    return true;
  }

  const params = getSearchParams(windowRef);
  return (params?.get("page") || "").trim().toLowerCase() === "stream";
}

export function isDedicatedStreamViewport(win?: Window): boolean {
  return isStreamPageRoute(win) || getViewportMode(win) === "stream";
}

export function isEmbeddedSpectatorViewport(win?: Window): boolean {
  const windowRef = getWindowRef(win);
  if (!windowRef) return false;

  const params = getSearchParams(windowRef);
  const embeddedFromQuery = parseTruthy(params?.get("embedded"));
  const modeFromQuery = normalizeViewportMode(params?.get("mode"));

  const embeddedFromConfig =
    windowRef.__HYPERSCAPE_EMBEDDED__ === true &&
    windowRef.__HYPERSCAPE_CONFIG__?.mode === "spectator";

  return (
    (embeddedFromQuery && modeFromQuery === "spectator") || embeddedFromConfig
  );
}

export function isStreamingLikeViewport(win?: Window): boolean {
  return isDedicatedStreamViewport(win) || isEmbeddedSpectatorViewport(win);
}

export function isStreamDebugEnabled(win?: Window): boolean {
  const windowRef = getWindowRef(win);
  if (!windowRef) return false;
  const params = getSearchParams(windowRef);
  return (
    parseTruthy(params?.get("streamDebug")) ||
    parseTruthy(params?.get("traceInit"))
  );
}
