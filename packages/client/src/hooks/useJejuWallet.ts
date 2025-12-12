/**
 * useJejuWallet - React hook for Jeju Network wallet integration
 *
 * Provides seamless wallet access using Privy embedded wallets.
 * All game transactions are gasless via server-side sponsorship.
 *
 * Features:
 * - Automatic embedded wallet creation for new users
 * - Session key management for gasless gameplay
 * - Smart account integration for advanced operations
 * - No wallet popups for normal gameplay
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  type Address,
  type Hash,
  type Hex,
} from "viem";

// ============ Types ============

export interface JejuWalletState {
  /** Whether the wallet is ready to use */
  isReady: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** User's wallet address (embedded or connected) */
  address: Address | null;
  /** Smart account address (if using AA) */
  smartAccountAddress: Address | null;
  /** Whether this is an embedded wallet */
  isEmbedded: boolean;
  /** Whether a session key is active for gasless gameplay */
  hasActiveSession: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

export interface JejuWalletActions {
  /** Sign a message (requires user approval for external wallets) */
  signMessage: (message: string) => Promise<Hex>;
  /** Sign typed data (EIP-712) */
  signTypedData: (data: {
    domain: Record<string, unknown>;
    types: Record<string, unknown[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<Hex>;
  /** Request a session key for gasless gameplay */
  requestSessionKey: (permissions: string[]) => Promise<void>;
  /** Revoke active session key */
  revokeSessionKey: () => Promise<void>;
  /** Get wallet balance */
  getBalance: () => Promise<bigint>;
  /** Check if user can afford a transaction */
  canAfford: (amount: bigint) => Promise<boolean>;
}

export type UseJejuWalletResult = JejuWalletState & JejuWalletActions;

// ============ Chain Configuration ============

const JEJU_CHAIN = {
  id: parseInt(import.meta.env.PUBLIC_CHAIN_ID || "420691"),
  name: import.meta.env.PUBLIC_CHAIN_NAME || "Jeju Network",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [import.meta.env.PUBLIC_JEJU_RPC_URL || "http://localhost:9545"],
    },
  },
};

// ============ Hook Implementation ============

export function useJejuWallet(): UseJejuWalletResult {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();

  const [state, setState] = useState<JejuWalletState>({
    isReady: false,
    isAuthenticated: false,
    address: null,
    smartAccountAddress: null,
    isEmbedded: false,
    hasActiveSession: false,
    isLoading: true,
    error: null,
  });

  // Find the best wallet to use (prefer embedded)
  const activeWallet = useMemo(() => {
    if (!wallets || wallets.length === 0) return null;

    // Prefer Privy embedded wallet
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    if (embedded) return embedded;

    // Fall back to first connected wallet
    return wallets[0];
  }, [wallets]);

  // Update state when auth or wallets change
  useEffect(() => {
    if (!ready) {
      setState((s) => ({ ...s, isLoading: true }));
      return;
    }

    if (!authenticated || !user) {
      setState({
        isReady: false,
        isAuthenticated: false,
        address: null,
        smartAccountAddress: null,
        isEmbedded: false,
        hasActiveSession: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    // Get wallet address
    const walletAddress = activeWallet?.address || user.wallet?.address;

    setState({
      isReady: !!walletAddress,
      isAuthenticated: true,
      address: walletAddress as Address | null,
      smartAccountAddress: null, // TODO: Compute smart account address
      isEmbedded: activeWallet?.walletClientType === "privy",
      hasActiveSession: false, // TODO: Check session status
      isLoading: false,
      error: null,
    });
  }, [ready, authenticated, user, activeWallet]);

  // Create viem client for the wallet
  const getWalletClient = useCallback(async () => {
    if (!activeWallet) {
      throw new Error("No wallet available");
    }

    // Get EIP-1193 provider from Privy wallet
    const provider = await activeWallet.getEthereumProvider();

    return createWalletClient({
      account: activeWallet.address as Address,
      chain: JEJU_CHAIN,
      transport: custom(provider),
    });
  }, [activeWallet]);

  // Create public client for read operations
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: JEJU_CHAIN,
        transport: http(JEJU_CHAIN.rpcUrls.default.http[0]),
      }),
    [],
  );

  // Sign a message
  const signMessage = useCallback(
    async (message: string): Promise<Hex> => {
      const client = await getWalletClient();
      return client.signMessage({
        message,
        account: activeWallet!.address as Address,
      });
    },
    [getWalletClient, activeWallet],
  );

  // Sign typed data (EIP-712)
  const signTypedData = useCallback(
    async (data: {
      domain: Record<string, unknown>;
      types: Record<string, unknown[]>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<Hex> => {
      const client = await getWalletClient();
      return client.signTypedData({
        account: activeWallet!.address as Address,
        domain: data.domain as Parameters<
          typeof client.signTypedData
        >[0]["domain"],
        types: data.types as Parameters<
          typeof client.signTypedData
        >[0]["types"],
        primaryType: data.primaryType,
        message: data.message,
      });
    },
    [getWalletClient, activeWallet],
  );

  // Request session key for gasless gameplay
  const requestSessionKey = useCallback(
    async (permissions: string[]): Promise<void> => {
      if (!state.address) {
        throw new Error("Wallet not connected");
      }

      // Get server URL
      const serverUrl =
        import.meta.env.PUBLIC_SERVER_URL || "http://localhost:5555";

      // Request session key from server
      const response = await fetch(`${serverUrl}/api/session/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          walletAddress: state.address,
          permissions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create session key");
      }

      const { sessionKeyAddress, message } = await response.json();

      // Sign the session authorization message
      const signature = await signMessage(message);

      // Confirm session key with signature
      const confirmResponse = await fetch(`${serverUrl}/api/session/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          walletAddress: state.address,
          sessionKeyAddress,
          signature,
        }),
      });

      if (!confirmResponse.ok) {
        const error = await confirmResponse.json();
        throw new Error(error.message || "Failed to confirm session key");
      }

      setState((s) => ({ ...s, hasActiveSession: true }));
    },
    [state.address, getAccessToken, signMessage],
  );

  // Revoke session key
  const revokeSessionKey = useCallback(async (): Promise<void> => {
    if (!state.address) return;

    const serverUrl =
      import.meta.env.PUBLIC_SERVER_URL || "http://localhost:5555";

    await fetch(`${serverUrl}/api/session/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getAccessToken()}`,
      },
      body: JSON.stringify({
        walletAddress: state.address,
      }),
    });

    setState((s) => ({ ...s, hasActiveSession: false }));
  }, [state.address, getAccessToken]);

  // Get wallet balance
  const getBalance = useCallback(async (): Promise<bigint> => {
    if (!state.address) return 0n;
    return publicClient.getBalance({ address: state.address });
  }, [state.address, publicClient]);

  // Check if user can afford a transaction
  const canAfford = useCallback(
    async (amount: bigint): Promise<boolean> => {
      const balance = await getBalance();
      return balance >= amount;
    },
    [getBalance],
  );

  return {
    ...state,
    signMessage,
    signTypedData,
    requestSessionKey,
    revokeSessionKey,
    getBalance,
    canAfford,
  };
}

// ============ Additional Hooks ============

/**
 * Hook to check if gameplay actions are gasless
 */
export function useGaslessGameplay(): {
  isGasless: boolean;
  requestGaslessMode: () => Promise<void>;
} {
  const { hasActiveSession, requestSessionKey } = useJejuWallet();

  const requestGaslessMode = useCallback(async () => {
    await requestSessionKey(["gameplay", "inventory", "equipment", "combat"]);
  }, [requestSessionKey]);

  return {
    isGasless: hasActiveSession,
    requestGaslessMode,
  };
}

/**
 * Hook for game transaction submission
 */
export function useGameTransaction(): {
  submitAction: (
    action: string,
    params: Record<string, unknown>,
  ) => Promise<Hash>;
  isPending: boolean;
  error: string | null;
} {
  const { address } = useJejuWallet();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitAction = useCallback(
    async (action: string, params: Record<string, unknown>): Promise<Hash> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      setIsPending(true);
      setError(null);

      const serverUrl =
        import.meta.env.PUBLIC_SERVER_URL || "http://localhost:5555";

      let response: Response;
      try {
        response = await fetch(`${serverUrl}/api/game/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player: address,
            action,
            params,
          }),
        });
      } catch (fetchError) {
        setIsPending(false);
        const message =
          fetchError instanceof Error ? fetchError.message : "Network error";
        setError(message);
        throw new Error(message);
      }

      setIsPending(false);

      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ message: "Transaction failed" }));
        setError(err.message || "Transaction failed");
        throw new Error(err.message || "Transaction failed");
      }

      const result = await response.json();
      return result.hash as Hash;
    },
    [address],
  );

  return { submitAction, isPending, error };
}

export default useJejuWallet;
