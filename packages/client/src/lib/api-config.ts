/**
 * API Configuration
 *
 * Centralized configuration for external service URLs.
 * URLs are set via Vite's define feature in vite.config.ts and can be
 * overridden at runtime by /env.js.
 *
 * In production builds (vite build):
 *   - GAME_API_URL = https://hyperia-production.up.railway.app
 *   - GAME_WS_URL = wss://hyperia-production.up.railway.app/ws
 *   - CDN_URL = https://assets.hyperia.club
 *
 * In development (vite dev):
 *   - GAME_API_URL = http://localhost:5555
 *   - GAME_WS_URL = ws://localhost:5556/ws
 *   - CDN_URL = http://localhost:5555/game-assets
 */

type PublicRuntimeEnv = {
  PUBLIC_ELIZAOS_URL?: string;
  PUBLIC_API_URL?: string;
  PUBLIC_WS_URL?: string;
  PUBLIC_CDN_URL?: string;
};

type WindowWithRuntimeEnv = Window & {
  env?: PublicRuntimeEnv;
  __CDN_URL?: string;
  __ASSETS_URL?: string;
};

const LOCAL_DEV_ELIZAOS_URL = "http://localhost:5555";
const LOCAL_DEV_GAME_API_URL = "http://localhost:5555";
const LOCAL_DEV_GAME_WS_URL = "ws://localhost:5556/ws";
const LOCAL_DEV_CDN_URL = "http://localhost:5555/game-assets";
const PRODUCTION_ELIZAOS_URL = "https://hyperia-production.up.railway.app";
const PRODUCTION_GAME_API_URL = "https://hyperia-production.up.railway.app";
const PRODUCTION_GAME_WS_URL = "wss://hyperia-production.up.railway.app/ws";
const PRODUCTION_CDN_URL = "https://assets.hyperia.club";

export type ApiConfigResolutionInput = {
  browserHref?: string;
  browserHostname?: string;
  runtimeEnv?: PublicRuntimeEnv;
  buildEnv?: PublicRuntimeEnv;
  prod?: boolean;
};

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function normalizeBaseUrlString(url: URL): string {
  const normalized = url.toString();
  const isRootBase =
    url.pathname === "/" && url.search.length === 0 && url.hash.length === 0;
  if (!isRootBase) {
    return normalized;
  }

  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

export function normalizeBrowserLoopbackUrl(
  value?: string,
): string | undefined {
  if (!value || value === "undefined" || value === "null") {
    return undefined;
  }

  if (typeof window === "undefined") {
    return value;
  }

  try {
    const currentHost = window.location.hostname;
    const parsed = new URL(value, window.location.href);
    if (!isLoopbackHost(currentHost) || !isLoopbackHost(parsed.hostname)) {
      return normalizeBaseUrlString(parsed);
    }
    if (parsed.hostname === currentHost) {
      return normalizeBaseUrlString(parsed);
    }
    parsed.hostname = currentHost;
    return normalizeBaseUrlString(parsed);
  } catch {
    return value;
  }
}

function normalizeLoopbackUrlForBrowser(
  value: string | undefined,
  browserHref?: string,
  browserHostname?: string,
): string | undefined {
  if (!value || value === "undefined" || value === "null") {
    return undefined;
  }

  if (!browserHref || !browserHostname) {
    return value;
  }

  try {
    const parsed = new URL(value, browserHref);
    if (
      !isLoopbackHost(browserHostname) ||
      !isLoopbackHost(parsed.hostname) ||
      parsed.hostname === browserHostname
    ) {
      return normalizeBaseUrlString(parsed);
    }

    parsed.hostname = browserHostname;
    return normalizeBaseUrlString(parsed);
  } catch {
    return value;
  }
}

export function resolveApiConfig({
  browserHref,
  browserHostname,
  runtimeEnv,
  buildEnv,
  prod,
}: ApiConfigResolutionInput): {
  cdnUrl: string;
  elizaOsUrl: string;
  gameApiUrl: string;
  gameWsUrl: string;
} {
  const normalize = (value?: string): string | undefined =>
    normalizeLoopbackUrlForBrowser(value, browserHref, browserHostname);

  const isProd = prod ?? false;
  const defaultElizaOsUrl = isProd
    ? PRODUCTION_ELIZAOS_URL
    : LOCAL_DEV_ELIZAOS_URL;
  const defaultGameApiUrl = isProd
    ? PRODUCTION_GAME_API_URL
    : LOCAL_DEV_GAME_API_URL;
  const defaultGameWsUrl = isProd
    ? PRODUCTION_GAME_WS_URL
    : LOCAL_DEV_GAME_WS_URL;
  const defaultCdnUrl = isProd ? PRODUCTION_CDN_URL : LOCAL_DEV_CDN_URL;

  const resolvedGameApiUrl =
    normalize(runtimeEnv?.PUBLIC_API_URL) ??
    normalize(buildEnv?.PUBLIC_API_URL) ??
    defaultGameApiUrl;
  const resolvedElizaOsUrl =
    normalize(runtimeEnv?.PUBLIC_ELIZAOS_URL) ??
    normalize(runtimeEnv?.PUBLIC_API_URL) ??
    normalize(buildEnv?.PUBLIC_ELIZAOS_URL) ??
    normalize(buildEnv?.PUBLIC_API_URL) ??
    defaultElizaOsUrl;
  const resolvedGameWsUrl =
    normalize(runtimeEnv?.PUBLIC_WS_URL) ??
    normalize(buildEnv?.PUBLIC_WS_URL) ??
    defaultGameWsUrl;
  const resolvedCdnUrl =
    normalize(runtimeEnv?.PUBLIC_CDN_URL) ??
    normalize(buildEnv?.PUBLIC_CDN_URL) ??
    defaultCdnUrl;

  return {
    cdnUrl: resolvedCdnUrl,
    elizaOsUrl: resolvedElizaOsUrl,
    gameApiUrl: resolvedGameApiUrl,
    gameWsUrl: resolvedGameWsUrl,
  };
}

function getCurrentResolvedApiConfig(): {
  cdnUrl: string;
  elizaOsUrl: string;
  gameApiUrl: string;
  gameWsUrl: string;
} {
  return resolveApiConfig({
    browserHref:
      typeof window !== "undefined" ? window.location.href : undefined,
    browserHostname:
      typeof window !== "undefined" ? window.location.hostname : undefined,
    runtimeEnv:
      typeof window !== "undefined"
        ? (window as WindowWithRuntimeEnv).env
        : undefined,
    buildEnv: {
      PUBLIC_ELIZAOS_URL: import.meta.env.PUBLIC_ELIZAOS_URL,
      PUBLIC_API_URL: import.meta.env.PUBLIC_API_URL,
      PUBLIC_WS_URL: import.meta.env.PUBLIC_WS_URL,
      PUBLIC_CDN_URL: import.meta.env.PUBLIC_CDN_URL,
    },
    prod: import.meta.env.PROD,
  });
}

export function getRuntimeAssetBaseUrl(): string {
  if (typeof window !== "undefined") {
    const windowWithEnv = window as WindowWithRuntimeEnv;
    const authoritativeAssetsUrl = normalizeBrowserLoopbackUrl(
      windowWithEnv.__ASSETS_URL,
    );
    if (authoritativeAssetsUrl) {
      return authoritativeAssetsUrl;
    }

    const runtimeCdnUrl = normalizeBrowserLoopbackUrl(windowWithEnv.__CDN_URL);
    if (runtimeCdnUrl) {
      return runtimeCdnUrl;
    }
  }

  return CDN_URL;
}

export function resolveRuntimeAssetUrl(assetPath: string): string {
  if (!assetPath.startsWith("asset://")) {
    return assetPath;
  }

  const baseUrl = getRuntimeAssetBaseUrl().replace(/\/$/, "");
  return assetPath.replace("asset://", `${baseUrl}/`);
}

// =============================================================================
// ElizaOS AI Agent Server (embedded in Hyperia server)
// =============================================================================
// ElizaOS agent routes are now served directly from the Hyperia game server.
// No separate ElizaOS process needed - routes are at /api/agents, /api/agents/:id, etc.

let resolvedApiConfig = getCurrentResolvedApiConfig();

export let ELIZAOS_URL: string = resolvedApiConfig.elizaOsUrl;

export let ELIZAOS_API: string = `${ELIZAOS_URL}/api`;

// =============================================================================
// Hyperia Game Server
// =============================================================================
// These are replaced at build time by Vite's define feature

export let GAME_API_URL: string = resolvedApiConfig.gameApiUrl;

export let GAME_WS_URL: string = resolvedApiConfig.gameWsUrl;

// =============================================================================
// CDN for Static Assets
// =============================================================================

export let CDN_URL: string = resolvedApiConfig.cdnUrl;

export function refreshApiConfig(): {
  cdnUrl: string;
  elizaOsUrl: string;
  gameApiUrl: string;
  gameWsUrl: string;
} {
  resolvedApiConfig = getCurrentResolvedApiConfig();
  ELIZAOS_URL = resolvedApiConfig.elizaOsUrl;
  ELIZAOS_API = `${ELIZAOS_URL}/api`;
  GAME_API_URL = resolvedApiConfig.gameApiUrl;
  GAME_WS_URL = resolvedApiConfig.gameWsUrl;
  CDN_URL = resolvedApiConfig.cdnUrl;
  return resolvedApiConfig;
}
