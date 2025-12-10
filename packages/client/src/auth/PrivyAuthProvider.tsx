/**
 * Privy Authentication Provider
 * 
 * Wraps the application with Privy authentication context.
 * Configured for seamless Web3 UX with:
 * - Embedded wallets for all users (gasless by default)
 * - No popups for signatures when using session keys
 * - Jeju Network integration for smart accounts
 */

import React, { useEffect } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { privyAuthManager } from "./PrivyAuthManager";

// ============ Jeju Chain Configuration ============

const JEJU_CHAIN_ID = parseInt(import.meta.env.PUBLIC_CHAIN_ID || "420691");
const JEJU_RPC_URL = import.meta.env.PUBLIC_JEJU_RPC_URL || "http://localhost:9545";
const JEJU_CHAIN_NAME = import.meta.env.PUBLIC_CHAIN_NAME || "Jeju Network";

/**
 * Jeju Network chain configuration for Privy
 */
const JEJU_CHAIN = {
  id: JEJU_CHAIN_ID,
  name: JEJU_CHAIN_NAME,
  network: "jeju",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [JEJU_RPC_URL] },
    public: { http: [JEJU_RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: "Jeju Explorer",
      url: import.meta.env.PUBLIC_EXPLORER_URL || "https://explorer.jeju.network",
    },
  },
  testnet: JEJU_CHAIN_ID !== 420692, // Only mainnet (420692) is not testnet
};

interface PrivyAuthProviderProps {
  children: React.ReactNode;
}

/**
 * Inner component that handles Privy hooks and state sync
 */
function PrivyAuthHandler({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy();

  useEffect(() => {
    const updateAuth = async () => {
      if (ready && authenticated && user) {
        const token = await getAccessToken();
        if (!token) {
          console.warn("[PrivyAuthProvider] getAccessToken returned null");
          return;
        }
        privyAuthManager.setAuthenticatedUser(user, token);

        // Log wallet info for debugging
        if (user.wallet) {
          console.log("[PrivyAuthProvider] User wallet:", {
            address: user.wallet.address,
            walletClientType: user.wallet.walletClientType,
          });
        }
      } else if (ready && !authenticated) {
        privyAuthManager.clearAuth();
      }
    };

    updateAuth();
  }, [ready, authenticated, user, getAccessToken]);

  // Handle logout
  useEffect(() => {
    const handleLogout = async () => {
      await logout();
      privyAuthManager.clearAuth();
    };

    // Expose logout globally for debugging
    const windowWithLogout = window as typeof window & {
      privyLogout: () => void;
    };
    windowWithLogout.privyLogout = handleLogout;
  }, [logout]);

  return <>{children}</>;
}

/**
 * Main Privy Auth Provider Component
 * 
 * Configured for optimal Jeju Network integration:
 * - All users get embedded wallets (no external wallet needed)
 * - Automatic network switching to Jeju
 * - Minimal signature popups via session keys
 */
export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  const appId = import.meta.env.PUBLIC_PRIVY_APP_ID || "";

  const isValidAppId =
    appId && appId.length > 0 && !appId.includes("your-privy-app-id");

  if (!isValidAppId) {
    console.warn(
      "[PrivyAuthProvider] No valid Privy App ID configured. Authentication disabled.",
    );
    console.warn(
      "[PrivyAuthProvider] To enable authentication, set PUBLIC_PRIVY_APP_ID in your .env file",
    );
    console.warn(
      "[PrivyAuthProvider] Get your App ID from https://dashboard.privy.io/",
    );
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Authentication methods - prioritize social/email for easier onboarding
        loginMethods: ["email", "google", "farcaster", "wallet"],
        
        // Visual customization
        appearance: {
          theme: "dark",
          accentColor: "#d4af37",
          logo: "/images/logo.png",
          // Show embedded wallet option first for better UX
          walletList: [
            "detected_wallets",
            "metamask",
            "coinbase_wallet",
            "rainbow",
            "wallet_connect",
          ],
          // Encourage users to use embedded wallet
          showWalletLoginFirst: false,
        },
        
        // CRITICAL: Embedded wallet configuration for gasless UX
        embeddedWallets: {
          ethereum: {
            // Create embedded wallet for ALL users (not just those without wallets)
            // This ensures everyone can use gasless transactions
            createOnLogin: "all-users",
          },
          // Don't prompt for signature on every action
          // Combined with session keys, this eliminates popups during gameplay
          showWalletUIs: false,
        },
        
        // Default to Jeju Network
        defaultChain: JEJU_CHAIN,
        supportedChains: [JEJU_CHAIN],
        
        // MFA settings
        mfa: {
          noPromptOnMfaRequired: false,
        },
        
        // Legal
        legal: {
          termsAndConditionsUrl: import.meta.env.PUBLIC_TERMS_URL,
          privacyPolicyUrl: import.meta.env.PUBLIC_PRIVACY_URL,
        },
      }}
    >
      <PrivyAuthHandler>{children}</PrivyAuthHandler>
    </PrivyProvider>
  );
}
