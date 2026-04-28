/**
 * useHyperBetState — SSE/HTTP-based state hook for the standalone HyperBet page.
 * Replaces useBettingPanel (which requires the game world network).
 */

/* global EventSource */

import { useState, useEffect, useCallback, useRef } from "react";
import { GAME_API_URL } from "../lib/api-config";

// ============================================================================
// Types (mirrors BettingPanel types)
// ============================================================================

export interface HyperBetMarket {
  duelId: string;
  agent1: { id: string; name: string };
  agent2: { id: string; name: string };
  status: "betting" | "locked" | "resolved" | "aborted";
  bettingClosesAt: number;
  createdAt: number;
  winnerId?: string | null;
  winnerSide?: "A" | "B" | null;
  pool: {
    sideATotal: string;
    sideBTotal: string;
    sideACount: number;
    sideBCount: number;
  } | null;
}

export interface HyperBetConfig {
  streamUrl: string;
  bettingEnabled: boolean;
  twitchChannel: string | null;
  youtubeChannelId: string | null;
}

export interface BetRecord {
  id: string;
  roundId: string;
  side: string;
  amount: string;
  walletAddress: string;
  status: string;
  createdAt: number;
}

export interface LeaderboardEntry {
  wallet: string;
  totalBets: number;
  totalWagered: string;
}

export interface HyperBetState {
  config: HyperBetConfig | null;
  markets: HyperBetMarket[];
  myBets: BetRecord[];
  leaderboard: LeaderboardEntry[];
  connected: boolean;
  error: string | null;
}

const API_BASE = GAME_API_URL.replace(/\/$/, "");

// ============================================================================
// Hook
// ============================================================================

export function useHyperBetState(walletAddress: string | null) {
  const [state, setState] = useState<HyperBetState>({
    config: null,
    markets: [],
    myBets: [],
    leaderboard: [],
    connected: false,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial config
  useEffect(() => {
    fetch(`${API_BASE}/api/hyperbet/config`)
      .then((r) => r.json())
      .then((data: HyperBetConfig) => {
        setState((s) => ({ ...s, config: data }));
      })
      .catch((err) => {
        console.error("[HyperBet] Failed to fetch config", err);
      });
  }, []);

  // Fetch markets
  const refreshMarkets = useCallback(() => {
    fetch(`${API_BASE}/api/hyperbet/markets`)
      .then((r) => r.json())
      .then((data: { markets: HyperBetMarket[] }) => {
        setState((s) => ({ ...s, markets: data.markets }));
      })
      .catch((err) => {
        console.error("[HyperBet] Failed to fetch markets", err);
      });
  }, []);

  // Fetch leaderboard
  const refreshLeaderboard = useCallback(() => {
    fetch(`${API_BASE}/api/hyperbet/leaderboard`)
      .then((r) => r.json())
      .then((data: { leaderboard: LeaderboardEntry[] }) => {
        setState((s) => ({ ...s, leaderboard: data.leaderboard }));
      })
      .catch((err) => {
        console.error("[HyperBet] Failed to fetch leaderboard", err);
      });
  }, []);

  // Fetch my bets when wallet changes
  useEffect(() => {
    if (!walletAddress) {
      setState((s) => ({ ...s, myBets: [] }));
      return;
    }

    fetch(`${API_BASE}/api/hyperbet/bets/${walletAddress}`)
      .then((r) => r.json())
      .then((data: { bets: BetRecord[] }) => {
        setState((s) => ({ ...s, myBets: data.bets }));
      })
      .catch((err) => {
        console.error("[HyperBet] Failed to fetch bets", err);
      });
  }, [walletAddress]);

  // SSE connection
  useEffect(() => {
    refreshMarkets();
    refreshLeaderboard();

    const es = new EventSource(`${API_BASE}/api/hyperbet/events`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setState((s) => ({ ...s, connected: true, error: null }));
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string;
          markets?: HyperBetMarket[];
          payload?: Record<string, unknown>;
        };

        if (data.type === "snapshot" && data.markets) {
          setState((s) => ({
            ...s,
            markets: data.markets as HyperBetMarket[],
          }));
        } else {
          // For market events, just refresh the full market list
          refreshMarkets();
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setState((s) => ({ ...s, connected: false }));
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [refreshMarkets, refreshLeaderboard]);

  // Place bet
  const placeBet = useCallback(
    async (
      roundId: string,
      side: "A" | "B",
      amount: string,
      signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!walletAddress)
        return { success: false, error: "Wallet not connected" };

      const nonce = crypto.randomUUID().slice(0, 8);
      const timestamp = Date.now();
      const message = `HyperBet:bet:${nonce}:${timestamp}`;

      let signature: string;
      try {
        const msgBytes = new TextEncoder().encode(message);
        const sigBytes = await signMessage(msgBytes);
        signature = btoa(String.fromCharCode(...sigBytes));
      } catch {
        return { success: false, error: "Wallet signature rejected" };
      }

      try {
        const resp = await fetch(`${API_BASE}/api/hyperbet/bets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roundId,
            side,
            amount,
            walletAddress,
            signature,
            message,
          }),
        });

        const data = (await resp.json()) as {
          success?: boolean;
          error?: string;
        };
        if (!resp.ok) {
          return { success: false, error: data.error || "Bet failed" };
        }

        // Refresh markets and bets
        refreshMarkets();
        if (walletAddress) {
          fetch(`${API_BASE}/api/hyperbet/bets/${walletAddress}`)
            .then((r) => r.json())
            .then((d: { bets: BetRecord[] }) => {
              setState((s) => ({ ...s, myBets: d.bets }));
            })
            .catch(() => {});
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: "Network error" };
      }
    },
    [walletAddress, refreshMarkets],
  );

  // Claim winnings
  const claimWinnings = useCallback(
    async (
      roundId: string,
      signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!walletAddress)
        return { success: false, error: "Wallet not connected" };

      const nonce = crypto.randomUUID().slice(0, 8);
      const timestamp = Date.now();
      const message = `HyperBet:claim:${nonce}:${timestamp}`;

      let signature: string;
      try {
        const msgBytes = new TextEncoder().encode(message);
        const sigBytes = await signMessage(msgBytes);
        signature = btoa(String.fromCharCode(...sigBytes));
      } catch {
        return { success: false, error: "Wallet signature rejected" };
      }

      try {
        const resp = await fetch(`${API_BASE}/api/hyperbet/claims`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roundId, walletAddress, signature, message }),
        });

        const data = (await resp.json()) as {
          success?: boolean;
          error?: string;
        };
        if (!resp.ok) {
          return { success: false, error: data.error || "Claim failed" };
        }

        return { success: true };
      } catch {
        return { success: false, error: "Network error" };
      }
    },
    [walletAddress],
  );

  return { state, placeBet, claimWinnings, refreshMarkets };
}
