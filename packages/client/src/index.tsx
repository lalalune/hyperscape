/**
 * index.tsx - Hyperscape Client Entry Point
 *
 * Main entry point for the Hyperscape browser client. Initializes the React application,
 * authentication, and 3D game world. Handles the complete client lifecycle from login
 * to world connection.
 */

import {
  CircularSpawnArea,
  installThreeJSExtensions,
  THREE,
  World,
} from "@hyperscape/shared";
import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "./lib/ErrorBoundary";
import "./index.css";
import { PrivyAuthProvider } from "./auth/PrivyAuthProvider";
import { playerTokenManager } from "./auth/PlayerTokenManager";
import { privyAuthManager } from "./auth/PrivyAuthManager";
import { injectFarcasterMetaTags } from "./lib/farcaster-frame-config";
import { GameClient } from "./screens/GameClient";
import { LoginScreen } from "./screens/LoginScreen";
import { CharacterSelectScreen } from "./screens/CharacterSelectScreen";
import { EmbeddedGameClient } from "./components/EmbeddedGameClient";
import { isEmbeddedMode } from "./types/embeddedConfig";

// Buffer polyfill for Privy (required for crypto operations in browser)
import { Buffer } from "buffer";
if (!globalThis.Buffer) {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

// setImmediate polyfill for Privy/Viem
if (!globalThis.setImmediate) {
  (globalThis as any).setImmediate = (
    cb: (...args: any[]) => void,
    ...args: any[]
  ) => setTimeout(cb, 0, ...args);
}

// Parse URL parameters for embedded configuration
const urlParams = new URLSearchParams(window.location.search);
const isEmbedded = urlParams.get("embedded") === "true";

if (isEmbedded) {
  (window as any).__HYPERSCAPE_EMBEDDED__ = true;

  // Construct config from URL params
  const config = {
    agentId: urlParams.get("agentId") || "",
    authToken: urlParams.get("authToken") || "",
    characterId: urlParams.get("characterId") || undefined,
    wsUrl: urlParams.get("wsUrl") || "ws://localhost:5555/ws",
    mode: (urlParams.get("mode") as any) || "spectator",
    followEntity: urlParams.get("followEntity") || undefined,
    hiddenUI: urlParams.get("hiddenUI")
      ? urlParams.get("hiddenUI")?.split(",")
      : undefined,
    quality: (urlParams.get("quality") as any) || "medium",
    sessionToken: urlParams.get("sessionToken") || "",
  };

  (window as any).__HYPERSCAPE_CONFIG__ = config;
  console.log("[Hyperscape] Configured from URL params:", config);
}

// Set global environment flags
(
  globalThis as typeof globalThis & { isBrowser?: boolean; isServer?: boolean }
).isBrowser = true;
(
  globalThis as typeof globalThis & { isBrowser?: boolean; isServer?: boolean }
).isServer = false;

// Global window extensions
declare global {
  interface Window {
    THREE?: typeof THREE;
    world?: InstanceType<typeof World>;
    testChat?: () => void;
    Hyperscape?: {
      CircularSpawnArea: typeof CircularSpawnArea;
    };
    privyLogout?: () => Promise<void> | void;
  }
}

// Vite environment variables
interface ImportMetaEnv {
  readonly PUBLIC_PRIVY_APP_ID?: string;
  readonly PUBLIC_WS_URL?: string;
  readonly PUBLIC_CDN_URL?: string;
  readonly PUBLIC_ENABLE_FARCASTER?: string;
  readonly PUBLIC_APP_URL?: string;
  readonly PUBLIC_API_URL?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Install Three.js extensions
installThreeJSExtensions();

function App() {
  // Determine Privy availability
  const appId = import.meta.env.PUBLIC_PRIVY_APP_ID || "";
  const privyEnabled = appId.length > 0 && !appId.includes("your-privy-app-id");

  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [authState, setAuthState] = React.useState(privyAuthManager.getState());
  const [showCharacterPage, setShowCharacterPage] =
    React.useState<boolean>(privyEnabled);

  // Subscribe to auth state changes
  React.useEffect(() => {
    const unsubscribe = privyAuthManager.subscribe(setAuthState);
    privyAuthManager.restoreFromStorage();
    injectFarcasterMetaTags();
    return unsubscribe;
  }, []);

  // Show character page when authenticated
  React.useEffect(() => {
    if (authState.isAuthenticated) setShowCharacterPage(true);
  }, [authState.isAuthenticated]);

  // Initialize player token
  React.useEffect(() => {
    playerTokenManager.getOrCreatePlayerToken("Player");
    playerTokenManager.startSession();
    return () => {
      playerTokenManager.endSession();
    };
  }, []);

  const wsUrl = import.meta.env.PUBLIC_WS_URL || "ws://localhost:5555/ws";
  const appRef = React.useRef<HTMLDivElement>(null);

  const handleAuthenticated = React.useCallback(() => {
    setIsAuthenticated(true);
    setShowCharacterPage(true);
  }, []);

  const handleLogout = React.useCallback(() => {
    privyAuthManager.clearAuth();
    setIsAuthenticated(false);
    setShowCharacterPage(false);
    window.privyLogout?.();
  }, []);

  const handleSetup = React.useCallback(
    (world: InstanceType<typeof World>, _config: unknown) => {
      // Extend window with debug utilities
      window.world = world;
      window.THREE = THREE;
      window.Hyperscape = {
        CircularSpawnArea,
      };

      window.testChat = () => {
        const chat = world.getSystem("chat") as {
          send?: (msg: string) => void;
        } | null;
        chat?.send?.(
          "Test message from console at " + new Date().toLocaleTimeString(),
        );
      };
    },
    [],
  );

  // Show login screen if Privy enabled and not authenticated
  if (privyEnabled && !isAuthenticated && !authState.isAuthenticated) {
    return (
      <div ref={appRef} data-component="app-root">
        <LoginScreen onAuthenticated={handleAuthenticated} />
      </div>
    );
  }

  // Show character selection (only if Privy enabled)
  if (showCharacterPage && privyEnabled) {
    return (
      <div ref={appRef} data-component="app-root">
        <CharacterSelectScreen
          wsUrl={wsUrl}
          onPlay={(id) => {
            if (id) {
              localStorage.setItem("selectedCharacterId", id);
            }
            setShowCharacterPage(false);
          }}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  // Show game (when Privy disabled, skip character selection and go straight to game)
  // The client will automatically send enterWorld without characterId for dev mode
  return (
    <div ref={appRef} data-component="app-root">
      <GameClient wsUrl={wsUrl} onSetup={handleSetup} />
    </div>
  );
}

import { DashboardScreen } from "./screens/DashboardScreen";
import { CharacterEditorScreen } from "./screens/CharacterEditorScreen";

function mountApp() {
  const rootElement = document.getElementById("root")!;
  const root = ReactDOM.createRoot(rootElement);

  // Check if running in embedded viewport mode
  if (isEmbeddedMode()) {
    console.log(
      "[Hyperscape] Embedded mode detected - rendering EmbeddedGameClient",
    );

    // Render embedded game client directly (no auth screens)
    root.render(
      <ErrorBoundary>
        <EmbeddedGameClient />
      </ErrorBoundary>,
    );
  } else {
    // Check for special page modes
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get("page");

    if (page === "dashboard") {
      console.log(
        "[Hyperscape] Dashboard mode detected - rendering DashboardScreen",
      );
      root.render(
        <ErrorBoundary>
          <DashboardScreen />
        </ErrorBoundary>,
      );
    } else if (page === "character-editor") {
      console.log(
        "[Hyperscape] Character editor mode detected - rendering CharacterEditorScreen",
      );
      root.render(
        <ErrorBoundary>
          <CharacterEditorScreen />
        </ErrorBoundary>,
      );
    } else {
      // Normal mode - render full app with auth
      root.render(
        <ErrorBoundary>
          <PrivyAuthProvider>
            <App />
          </PrivyAuthProvider>
        </ErrorBoundary>,
      );
    }
  }

  // Verify render completion
  const verifyRender = (attempts = 0) => {
    const maxAttempts = 10;
    const hasContent = rootElement.innerHTML.length > 0;

    if (hasContent) {
      return;
    }

    if (attempts < maxAttempts) {
      requestAnimationFrame(() => verifyRender(attempts + 1));
      return;
    }

    // Should never reach here - React render failed
    throw new Error(
      "React app mounted but no content rendered after multiple attempts",
    );
  };

  setTimeout(() => {
    requestAnimationFrame(() => verifyRender(0));
  }, 0);
}

// Ensure DOM is ready before mounting
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    mountApp();
  });
} else {
  mountApp();
}
