export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

// Get API base URL from environment variable, fallback to relative path for dev
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Prepend API base URL to paths starting with /api
 */
export function getFullUrl(input: string): string {
  if (API_BASE_URL && input.startsWith("/api")) {
    return `${API_BASE_URL}${input}`;
  }
  return input;
}

/**
 * Get the full URL for an asset's model
 */
export function getAssetModelUrl(assetId: string): string {
  return getFullUrl(`/api/assets/${assetId}/model`);
}

/**
 * Get the full URL for an asset's file
 */
export function getAssetFileUrl(assetId: string, filename: string): string {
  return getFullUrl(`/api/assets/${assetId}/${filename}`);
}

/**
 * Get the full URL for an asset's concept art
 */
export function getAssetConceptArtUrl(assetId: string): string {
  return getFullUrl(`/api/assets/${assetId}/concept-art.png`);
}

/**
 * Get the full URL for an asset's sprites
 */
export function getAssetSpritesUrl(assetId: string): string {
  return getFullUrl(`/api/assets/${assetId}/sprites`);
}

// ============== Async Token Provider ==============
// Same pattern as the game client's api-client.ts.
// ForgeAuthHandler registers Privy's getAccessToken() so apiFetch
// can get a *fresh* token on every request instead of reading a
// stale window variable.

type AsyncTokenProvider = () => Promise<string | null>;

let asyncTokenProvider: AsyncTokenProvider | null = null;

/**
 * Register Privy's getAccessToken as the token provider.
 * Called from ForgeAuthHandler once the SDK is ready.
 */
export function setAsyncTokenProvider(provider: AsyncTokenProvider): void {
  asyncTokenProvider = provider;
}

/** Clear the token provider on logout. */
export function clearAsyncTokenProvider(): void {
  asyncTokenProvider = null;
}

/** Get a fresh auth token — tries the async provider first, then cached fallbacks. */
async function getAuthToken(): Promise<string | null> {
  // 1. Ask Privy for a fresh token (handles refresh automatically)
  if (asyncTokenProvider) {
    try {
      const token = await asyncTokenProvider();
      if (token) return token;
    } catch {
      // Fall through to cached
    }
  }

  // 2. Fallback: cached values
  try {
    const win = window as unknown as Record<string, unknown>;
    if (typeof win.__PRIVY_TOKEN__ === "string" && win.__PRIVY_TOKEN__) {
      return win.__PRIVY_TOKEN__;
    }
    const stored = localStorage.getItem("forge:auth_token");
    if (stored) return stored;
  } catch {
    // SSR or restricted storage
  }

  return null;
}

export async function apiFetch(
  input: string,
  init: RequestOptions = {},
): Promise<Response> {
  const { timeoutMs = 15000, signal, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Timeout", "AbortError")),
    timeoutMs,
  );

  const url = getFullUrl(input);

  // Inject auth token for API requests
  const headers = new Headers(rest.headers);
  if (url.includes("/api/") && !headers.has("Authorization")) {
    const token = await getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // Auto-set Content-Type for JSON string bodies. fetch() defaults to
  // text/plain otherwise, which Elysia rejects when the route declares
  // a TypeBox `body` schema (it can't parse the body as JSON).
  if (
    typeof rest.body === "string" &&
    rest.body.length > 0 &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      ...rest,
      headers,
      signal: signal ?? controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
