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
  if (typeof window === "undefined") return undefined;
  return (win ?? window) as HyperiaViewportWindow;
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
