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
import { UsernameSelectionScreen } from "./screens/UsernameSelectionScreen";
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
    privyUserId: urlParams.get("privyUserId") || undefined,
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
  readonly PUBLIC_ELIZAOS_URL?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Install Three.js extensions
installThreeJSExtensions();

/**
 * Clean up corrupted Privy localStorage data
 * Prevents JSON parse errors from malformed data
 */
function cleanupCorruptedPrivyData(): void {
  try {
    const corruptedKeys: string[] = [];

    // Our custom keys that store plain strings (not JSON)
    const plainStringKeys = new Set([
      "privy_user_id",
      "privy_auth_token",
      "farcaster_fid",
    ]);

    // Check each localStorage key for corruption
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Only check Privy SDK keys (not our custom plain string keys)
      if (key.startsWith("privy:") && !plainStringKeys.has(key)) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            // Try to parse as JSON - if it fails, it's corrupted
            JSON.parse(value);
          }
        } catch (parseError) {
          // Found corrupted data
          const errorStr =
            parseError instanceof Error
              ? parseError.message
              : String(parseError);
          if (
            errorStr.includes("setImmedia") ||
            errorStr.includes("Unexpected token")
          ) {
            console.warn(`[App] 🧹 Found corrupted localStorage key: ${key}`);
            corruptedKeys.push(key);
          }
        }
      }
    }

    // Remove corrupted keys
    if (corruptedKeys.length > 0) {
      console.log(
        `[App] 🧹 Cleaning up ${corruptedKeys.length} corrupted Privy keys`,
      );
      corruptedKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`[App] Failed to remove corrupted key ${key}:`, e);
        }
      });
    }
  } catch (error) {
    console.error("[App] Error during localStorage cleanup:", error);
  }
}

// Run cleanup on app load
cleanupCorruptedPrivyData();

function App() {
  // Determine Privy availability
  const appId = import.meta.env.PUBLIC_PRIVY_APP_ID || "";
  const privyEnabled = appId.length > 0 && !appId.includes("your-privy-app-id");

  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [authState, setAuthState] = React.useState(privyAuthManager.getState());
  const [showCharacterPage, setShowCharacterPage] =
    React.useState<boolean>(privyEnabled);
  const [hasUsername, setHasUsername] = React.useState<boolean | null>(null); // null = checking, true/false = result
  const [isCheckingUsername, setIsCheckingUsername] = React.useState(false);

  // Subscribe to auth state changes
  React.useEffect(() => {
    const unsubscribe = privyAuthManager.subscribe(setAuthState);
    privyAuthManager.restoreFromStorage();
    injectFarcasterMetaTags();
    return unsubscribe;
  }, []);

  // Check if user has a username when authenticated
  React.useEffect(() => {
    const checkUsername = async () => {
      if (!authState.isAuthenticated) {
        setHasUsername(null);
        return;
      }

      const accountId = localStorage.getItem("privy_user_id");
      if (!accountId) {
        console.warn("[App] No privy_user_id found in localStorage");
        setHasUsername(false);
        return;
      }

      setIsCheckingUsername(true);

      try {
        // Check if user exists in database
        const response = await fetch(
          `http://localhost:5555/api/users/check?accountId=${encodeURIComponent(accountId)}`,
        );

        if (response.ok) {
          const data = await response.json();
          setHasUsername(data.exists);
          console.log(
            `[App] User ${accountId} ${data.exists ? "has" : "does not have"} username`,
          );
        } else {
          console.error("[App] Failed to check username:", response.statusText);
          setHasUsername(false);
        }
      } catch (error) {
        console.error("[App] Error checking username:", error);
        setHasUsername(false);
      } finally {
        setIsCheckingUsername(false);
      }
    };

    checkUsername();
  }, [authState.isAuthenticated]);

  // Show character page when authenticated and has username
  React.useEffect(() => {
    if (authState.isAuthenticated && hasUsername === true) {
      setShowCharacterPage(true);
    }
  }, [authState.isAuthenticated, hasUsername]);

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
  }, []);

  const handleUsernameSelected = React.useCallback((username: string) => {
    console.log(`[App] Username selected: ${username}`);
    setHasUsername(true);
    setShowCharacterPage(true);
  }, []);

  const handleLogout = React.useCallback(() => {
    console.log("[App] 🚪 Logging out...");

    try {
      // Clear Privy auth manager first
      privyAuthManager.clearAuth();

      // Clear potentially corrupted Privy localStorage keys
      // This prevents JSON parse errors from corrupted data
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith("privy:") ||
            key.startsWith("privy_") ||
            key.includes("privy") ||
            key.includes("wallet"))
        ) {
          keysToRemove.push(key);
        }
      }

      console.log(
        `[App] 🧹 Clearing ${keysToRemove.length} Privy localStorage keys`,
      );
      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`[App] Failed to remove key ${key}:`, e);
        }
      });

      // Update React state
      setIsAuthenticated(false);
      setShowCharacterPage(false);
      setHasUsername(null);

      // Attempt Privy logout (wrapped in try-catch to handle errors gracefully)
      try {
        window.privyLogout?.();
      } catch (privyError) {
        console.warn(
          "[App] ⚠️ Privy logout error (safe to ignore):",
          privyError,
        );
      }

      console.log("[App] ✅ Logout complete - reloading page for clean state");

      // Force reload to ensure completely clean state
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
    } catch (error) {
      console.error("[App] ❌ Error during logout:", error);
      // Even if logout fails, force reload for clean state
      window.location.href = "/";
    }
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

  // Show username selection for new users (authenticated but no username yet)
  if (
    privyEnabled &&
    authState.isAuthenticated &&
    hasUsername === false &&
    !isCheckingUsername
  ) {
    return (
      <div ref={appRef} data-component="app-root">
        <UsernameSelectionScreen onUsernameSelected={handleUsernameSelected} />
      </div>
    );
  }

  // Show character selection (only if Privy enabled and user has username)
  if (showCharacterPage && privyEnabled && hasUsername === true) {
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

  // Show loading screen while checking auth status (prevent GameClient from loading prematurely)
  if (privyEnabled && (hasUsername === null || isCheckingUsername)) {
    return (
      <div
        ref={appRef}
        data-component="app-root"
        className="flex items-center justify-center h-screen bg-black"
      >
        <div className="text-[#f2d08a] text-xl">Loading...</div>
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
          <PrivyAuthProvider>
            <DashboardScreen />
          </PrivyAuthProvider>
        </ErrorBoundary>,
      );
    } else if (page === "character-editor") {
      console.log(
        "[Hyperscape] Character editor mode detected - rendering CharacterEditorScreen",
      );
      root.render(
        <ErrorBoundary>
          <PrivyAuthProvider>
            <CharacterEditorScreen />
          </PrivyAuthProvider>
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
