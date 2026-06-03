import "./polyfills/buffer-shim";
import "./index.css";

import { installThreeJSExtensions } from "@hyperforge/shared";
import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import { StreamingMode } from "./screens/StreamingMode";
import { refreshApiConfig } from "./lib/api-config";
import { ensurePublicRuntimeEnv } from "./lib/publicEnv";

type GlobalFlags = typeof globalThis & {
  Buffer?: typeof Buffer;
  isBrowser?: boolean;
  isServer?: boolean;
};

class StreamErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error) {
    console.error("[StreamEntry] React render failed:", error);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          alignItems: "center",
          background: "#000",
          color: "#f5d48c",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          height: "100vh",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          whiteSpace: "pre-wrap",
        }}
      >
        {this.state.error?.message || "Stream bootstrap failed"}
      </div>
    );
  }
}

const globalFlags = globalThis as GlobalFlags;
globalFlags.Buffer = Buffer;
globalFlags.isBrowser = true;
globalFlags.isServer = false;

function syncRuntimeAssetBaseUrls(): void {
  if (typeof window === "undefined") {
    return;
  }

  const windowWithEnv = window as Window & {
    env?: { PUBLIC_CDN_URL?: string };
    __CDN_URL?: string;
    __ASSETS_URL?: string;
  };
  const envCdn = windowWithEnv.env?.PUBLIC_CDN_URL;
  if (envCdn && typeof envCdn === "string" && envCdn !== "undefined") {
    let resolvedCdn = envCdn;
    if (resolvedCdn.includes("127.0.0.1") || resolvedCdn.includes("0.0.0.0")) {
      resolvedCdn = resolvedCdn
        .replace("127.0.0.1", "localhost")
        .replace("0.0.0.0", "localhost");
    }
    windowWithEnv.__CDN_URL = resolvedCdn;
    windowWithEnv.__ASSETS_URL = resolvedCdn;
  }
}

// Early CDN URL initialization to prevent PhysX WASM loading race condition
syncRuntimeAssetBaseUrls();

installThreeJSExtensions();

function mountStreamApp() {
  console.log("[StreamEntry] boot");
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Missing #root element for stream bootstrap");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StreamErrorBoundary>
      <StreamingMode />
    </StreamErrorBoundary>,
  );
  console.log("[StreamEntry] render scheduled");
}

function isTruthyUrlFlag(rawValue: string | null): boolean {
  return ["1", "true", "yes", "on"].includes((rawValue || "").toLowerCase());
}

async function resetLocalStreamingCaches(): Promise<void> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const isInternalCapture = isTruthyUrlFlag(
    searchParams.get("internalCapture"),
  );
  const isLoopbackHost = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(
    window.location.hostname,
  );
  if (!isInternalCapture && !isLoopbackHost) {
    return;
  }

  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );
        console.log(
          `[StreamEntry] Unregistered ${registrations.length} local service worker(s)`,
        );
      }
    } catch (error) {
      console.warn(
        "[StreamEntry] Failed to unregister service workers:",
        error,
      );
    }
  }

  if ("caches" in window) {
    try {
      const cacheKeys = await window.caches.keys();
      const streamingCacheKeys = cacheKeys.filter(
        (cacheKey) =>
          cacheKey.startsWith("workbox") || cacheKey.startsWith("hyperia"),
      );
      if (streamingCacheKeys.length > 0) {
        await Promise.all(
          streamingCacheKeys.map((cacheKey) => window.caches.delete(cacheKey)),
        );
        console.log(
          `[StreamEntry] Cleared ${streamingCacheKeys.length} local cache bucket(s)`,
        );
      }
    } catch (error) {
      console.warn("[StreamEntry] Failed to clear caches:", error);
    }
  }
}

async function bootstrapStreamApp(): Promise<void> {
  await ensurePublicRuntimeEnv();
  refreshApiConfig();
  syncRuntimeAssetBaseUrls();
  await resetLocalStreamingCaches();
  mountStreamApp();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootstrapStreamApp();
  });
} else {
  void bootstrapStreamApp();
}
