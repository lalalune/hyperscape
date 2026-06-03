/**
 * Solana Wallet Provider
 * Wraps the application with Solana wallet context for Mobile Wallet Adapter (MWA) support
 * on Solana Saga, Seeker, and other Android devices with wallet apps.
 *
 * Uses @solana-mobile/wallet-standard-mobile to register MWA as a Wallet Standard wallet,
 * which is the recommended approach from both Solana Mobile and Privy.
 */

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from "@solana-mobile/wallet-standard-mobile";
import { GAME_API_URL } from "../lib/api-config";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Register Mobile Wallet Adapter as a Wallet Standard wallet.
 * Must be called in a non-SSR context before the wallet provider mounts.
 * Once registered, "Mobile Wallet Adapter" appears as a wallet option on Android
 * (Chrome and MWA-compatible WebViews), connecting to Seed Vault, Phantom, Solflare, etc.
 *
 * Privy's `detected_wallets` config automatically picks up this registration.
 * See: https://docs.solanamobile.com/mobile-wallet-adapter/web-installation
 */
if (typeof window !== "undefined") {
  registerMwa({
    appIdentity: {
      name: "Hyperia",
      uri: `${window.location.protocol}//${window.location.host}`,
      icon: "images/app-icon-192.png",
    },
    authorizationCache: createDefaultAuthorizationCache(),
    chains: ["solana:mainnet", "solana:devnet"],
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
  });
}

type SolanaWalletProviderProps = {
  children: React.ReactNode;
};

/**
 * Get the Solana RPC endpoint.
 * Uses PUBLIC_SOLANA_RPC_URL env var if set, otherwise falls back to mainnet-beta.
 */
function getSolanaNetwork():
  | "mainnet-beta"
  | "devnet"
  | "testnet"
  | "localnet" {
  const raw = (import.meta.env.PUBLIC_SOLANA_NETWORK || "")
    .trim()
    .toLowerCase();
  if (raw === "mainnet" || raw === "mainnet-beta") return "mainnet-beta";
  if (raw === "devnet" || raw === "testnet" || raw === "localnet") return raw;
  return "mainnet-beta";
}

function getRpcEndpoint(): string {
  const customRpc = import.meta.env.PUBLIC_SOLANA_RPC_URL;
  if (customRpc && customRpc.length > 0) {
    return customRpc;
  }

  const network = getSolanaNetwork();
  if (network === "mainnet-beta") {
    return `${GAME_API_URL.replace(/\/$/, "")}/api/proxy/solana/rpc?cluster=mainnet-beta`;
  }
  if (network === "localnet") {
    return "http://127.0.0.1:8899";
  }
  return clusterApiUrl(network);
}

function getWsEndpoint(): string {
  const customWs = import.meta.env.PUBLIC_SOLANA_WS_URL;
  if (customWs && customWs.length > 0) {
    return customWs;
  }

  const network = getSolanaNetwork();
  if (network === "mainnet-beta") {
    return `${GAME_API_URL.replace(/\/$/, "").replace(/^http/, "ws")}/api/proxy/solana/ws?cluster=mainnet-beta`;
  }
  if (network === "localnet") {
    return "ws://127.0.0.1:8900";
  }
  return `wss://api.${network}.solana.com`;
}

/**
 * Solana Wallet Provider Component
 *
 * Sets up:
 * 1. Connection to Solana RPC
 * 2. Wallet adapter with auto-detection for MWA and Wallet Standard wallets
 * 3. Wallet modal UI for wallet selection
 *
 * On Solana Saga/Seeker, this automatically detects:
 * - Seed Vault (built-in hardware wallet)
 * - Phantom, Solflare, and other installed wallet apps
 * - Any Wallet Standard compatible wallet
 *
 * The wallets array is empty to enable auto-detection of all installed wallets
 * via Wallet Standard. MWA is registered via registerMwa() above.
 */
export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  const endpoint = useMemo(() => getRpcEndpoint(), []);
  const wsEndpoint = useMemo(() => getWsEndpoint(), []);
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{ wsEndpoint, commitment: "confirmed" }}
    >
      <WalletProvider
        wallets={wallets}
        autoConnect={true}
        localStorageKey="hyperia-solana-wallet"
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/**
 * Hook to check if running on Android (where MWA is available)
 */
export function useIsAndroid(): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return /Android/i.test(navigator.userAgent);
  }, []);
}

/**
 * Hook to check if running on a Solana Mobile device (Saga or Seeker).
 */
export function useIsSolanaMobile(): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return isSolanaMobileDevice();
  }, []);
}

/**
 * Detect if the current device is a Solana Mobile device (Saga or Seeker).
 * Uses user-agent sniffing as a lightweight detection method.
 * For secure verification, use Seeker Genesis Token on-chain check instead.
 */
export function isSolanaMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return (
    userAgent.includes("saga") ||
    userAgent.includes("seeker") ||
    userAgent.includes("solana mobile")
  );
}
