/**
 * Privy Authentication Provider for HyperForge
 *
 * Mirrors the game client's PrivyAuthProvider pattern:
 * - Registers getAccessToken as an async token provider for apiFetch()
 * - Privy SDK handles session persistence across refreshes automatically
 * - `ready` gates the app until Privy finishes initialising + token is synced
 */

import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { setAsyncTokenProvider, clearAsyncTokenProvider } from "../utils/api";

// ============== Auth Context ==============

interface ForgeAuthContextValue {
  ready: boolean;
  authenticated: boolean;
  user: ReturnType<typeof usePrivy>["user"];
  login: () => void;
  logout: () => Promise<void>;
}

const ForgeAuthContext = createContext<ForgeAuthContextValue | null>(null);

/** No-auth fallback: treated as always-authenticated so the app works without Privy */
const NO_AUTH_FALLBACK: ForgeAuthContextValue = {
  ready: true,
  authenticated: true,
  user: null,
  login: () => {},
  logout: async () => {},
};

export function useForgeAuth(): ForgeAuthContextValue {
  const ctx = useContext(ForgeAuthContext);
  return ctx ?? NO_AUTH_FALLBACK;
}

// ============== Inner Handler ==============

function ForgeAuthHandler({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();

  const [tokenReady, setTokenReady] = useState(false);

  // Memoize the token provider so it doesn't change on every render
  const tokenProvider = useCallback(async () => {
    try {
      return await getAccessToken();
    } catch {
      return null;
    }
  }, [getAccessToken]);

  // Register the async token provider for apiFetch() — same as game client
  useEffect(() => {
    if (ready && authenticated) {
      setAsyncTokenProvider(tokenProvider);
    }
  }, [ready, authenticated, tokenProvider]);

  // Once Privy SDK is ready, do initial token sync then mark ready
  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    async function init() {
      if (authenticated) {
        // Fetch token once to warm the cache + validate session
        try {
          const token = await getAccessToken();
          if (!cancelled && token) {
            // Also cache for the window fallback path
            (window as unknown as Record<string, unknown>).__PRIVY_TOKEN__ =
              token;
            try {
              localStorage.setItem("forge:auth_token", token);
            } catch {
              // ignored
            }
          }
        } catch {
          // Session may have expired — Privy will handle it
        }
      } else {
        // Not authenticated — clear any stale cached tokens
        (window as unknown as Record<string, unknown>).__PRIVY_TOKEN__ = null;
        try {
          localStorage.removeItem("forge:auth_token");
        } catch {
          // ignored
        }
      }
      if (!cancelled) setTokenReady(true);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  // Refresh cached token periodically (every 4 minutes)
  useEffect(() => {
    if (!ready || !authenticated) return;
    const interval = setInterval(
      async () => {
        try {
          const token = await getAccessToken();
          if (token) {
            (window as unknown as Record<string, unknown>).__PRIVY_TOKEN__ =
              token;
            try {
              localStorage.setItem("forge:auth_token", token);
            } catch {
              // ignored
            }
          }
        } catch {
          // Will retry next interval
        }
      },
      4 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [ready, authenticated, getAccessToken]);

  const handleLogout = useCallback(async () => {
    clearAsyncTokenProvider();
    (window as unknown as Record<string, unknown>).__PRIVY_TOKEN__ = null;
    try {
      localStorage.removeItem("forge:auth_token");
    } catch {
      // ignored
    }
    await logout();
    setTokenReady(false);
  }, [logout]);

  // Only report ready once Privy is ready AND initial token sync is done
  const isReady = ready && tokenReady;

  const value: ForgeAuthContextValue = {
    ready: isReady,
    authenticated: isReady && authenticated,
    user,
    login,
    logout: handleLogout,
  };

  return (
    <ForgeAuthContext.Provider value={value}>
      {children}
    </ForgeAuthContext.Provider>
  );
}

// ============== Provider ==============

export function ForgeAuthProvider({ children }: { children: React.ReactNode }) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID || "";

  // If no Privy App ID, skip auth entirely (dev without Privy)
  if (!appId || appId === "your_privy_app_id") {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: {
          theme: "dark",
          // Forge Gold — the brand-identity accent (primary in tokens.ts).
          // Authentication is a brand-identity moment.
          accentColor: "#D4AF37",
          walletChainType: "ethereum-only",
          walletList: [
            "metamask",
            "coinbase_wallet",
            "rainbow",
            "detected_ethereum_wallets",
          ],
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <ForgeAuthHandler>{children}</ForgeAuthHandler>
    </PrivyProvider>
  );
}
