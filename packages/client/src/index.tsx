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

// Buffer polyfill for Privy (required for crypto operations in browser)
import { Buffer } from "buffer";
if (!globalThis.Buffer) {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
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

  // Show character selection
  if (showCharacterPage) {
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

  // Show game
  return (
    <div ref={appRef} data-component="app-root">
      <GameClient wsUrl={wsUrl} onSetup={handleSetup} />
    </div>
  );
}

function mountApp() {
  const rootElement = document.getElementById("root")!;
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <ErrorBoundary>
      <PrivyAuthProvider>
        <App />
      </PrivyAuthProvider>
    </ErrorBoundary>,
  );

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
