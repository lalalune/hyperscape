/**
 * HyperBetScreen — Standalone betting page for external viewers.
 *
 * Features:
 * - HLS live stream player (or Twitch embed link)
 * - Active betting markets with odds and countdown
 * - Solana wallet connect for placing bets
 * - Bet history and leaderboard
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Hls from "hls.js";
import { useHyperBetState, type HyperBetMarket } from "./useHyperBetState";

// ============================================================================
// HLS Player
// ============================================================================

function HlsPlayer({ streamUrl }: { streamUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    // Native HLS support (Safari)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.play().catch(() => {});
      return;
    }

    if (!Hls.isSupported()) {
      setError("HLS not supported in this browser");
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
    });

    hlsRef.current = hls;
    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setError("Stream offline — waiting for next duel...");
          setTimeout(() => hls.startLoad(), 5000);
        } else {
          setError("Stream error");
        }
      }
    });

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        background: "#000",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        controls
        muted
        playsInline
      />
      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.8)",
            color: "#888",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Market Card
// ============================================================================

function MarketCard({
  market,
  onBetA,
  onBetB,
  isPlacingBet,
}: {
  market: HyperBetMarket;
  onBetA: (amount: string) => void;
  onBetB: (amount: string) => void;
  isPlacingBet: boolean;
}) {
  const [betAmount, setBetAmount] = useState("10");
  const isBettingOpen = market.status === "betting";
  const timeLeft = Math.max(0, market.bettingClosesAt - Date.now());

  const poolA = parseFloat(market.pool?.sideATotal || "0");
  const poolB = parseFloat(market.pool?.sideBTotal || "0");
  const total = poolA + poolB;
  const oddsA = total > 0 ? (total / Math.max(poolA, 0.01)).toFixed(2) : "-.--";
  const oddsB = total > 0 ? (total / Math.max(poolB, 0.01)).toFixed(2) : "-.--";

  const statusColors: Record<string, { bg: string; text: string }> = {
    betting: { bg: "#1a3a1a", text: "#4ade80" },
    locked: { bg: "#3a3a1a", text: "#fbbf24" },
    resolved: { bg: "#1a1a3a", text: "#60a5fa" },
    aborted: { bg: "#3a1a1a", text: "#f87171" },
  };
  const statusStyle = statusColors[market.status] || statusColors.betting;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            letterSpacing: 0.5,
          }}
        >
          {market.agent1.name} vs {market.agent2.name}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 4,
            background: statusStyle.bg,
            color: statusStyle.text,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {market.status}
        </span>
      </div>

      {/* Odds display */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(59,130,246,0.1)",
            border: "1px solid rgba(59,130,246,0.2)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>
            {market.agent1.name}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#3b82f6" }}>
            {oddsA}x
          </div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
            {poolA.toFixed(0)} GOLD ({market.pool?.sideACount || 0} bets)
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: "#444",
            fontWeight: 700,
          }}
        >
          VS
        </div>
        <div
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, color: "#fca5a5", marginBottom: 4 }}>
            {market.agent2.name}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444" }}>
            {oddsB}x
          </div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
            {poolB.toFixed(0)} GOLD ({market.pool?.sideBCount || 0} bets)
          </div>
        </div>
      </div>

      {/* Countdown */}
      {isBettingOpen && timeLeft > 0 && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#fbbf24",
            marginBottom: 8,
          }}
        >
          Betting closes in {Math.ceil(timeLeft / 1000)}s
        </div>
      )}

      {/* Bet input */}
      {isBettingOpen && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="Amount"
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={() => onBetA(betAmount)}
            disabled={isPlacingBet}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: isPlacingBet ? "wait" : "pointer",
              opacity: isPlacingBet ? 0.5 : 1,
            }}
          >
            Bet A
          </button>
          <button
            onClick={() => onBetB(betAmount)}
            disabled={isPlacingBet}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "#dc2626",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: isPlacingBet ? "wait" : "pointer",
              opacity: isPlacingBet ? 0.5 : 1,
            }}
          >
            Bet B
          </button>
        </div>
      )}

      {/* Winner */}
      {market.status === "resolved" && market.winnerSide && (
        <div
          style={{
            textAlign: "center",
            padding: 8,
            borderRadius: 6,
            background: "rgba(74,222,128,0.1)",
            color: "#4ade80",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Winner:{" "}
          {market.winnerSide === "A" ? market.agent1.name : market.agent2.name}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Screen
// ============================================================================

export function HyperBetScreen() {
  const { publicKey, signMessage } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const { state, placeBet, claimWinnings } = useHyperBetState(walletAddress);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);

  // Countdown ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleBet = useCallback(
    async (roundId: string, side: "A" | "B", amount: string) => {
      if (!signMessage) {
        setBetError("Connect your wallet to place bets");
        return;
      }
      setIsPlacingBet(true);
      setBetError(null);
      const result = await placeBet(roundId, side, amount, signMessage);
      if (!result.success) {
        setBetError(result.error || "Bet failed");
      }
      setIsPlacingBet(false);
    },
    [placeBet, signMessage],
  );

  const streamUrl = state.config?.streamUrl || "/live/stream.m3u8";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0b0a15 0%, #111827 100%)",
        color: "#e0e0e0",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#fbbf24",
              letterSpacing: -0.5,
            }}
          >
            HYPERBET
          </span>
          <span style={{ fontSize: 12, color: "#666" }}>
            Agent Duel Betting
          </span>
          {state.connected && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#4ade80",
                display: "inline-block",
              }}
              title="Connected"
            />
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {state.config?.twitchChannel && (
            <a
              href={`https://twitch.tv/${state.config.twitchChannel}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: "#9146ff",
                textDecoration: "none",
                padding: "4px 10px",
                borderRadius: 4,
                border: "1px solid rgba(145,70,255,0.3)",
              }}
            >
              Watch on Twitch
            </a>
          )}
          <WalletMultiButton style={{ fontSize: 13, height: 36 }} />
        </div>
      </header>

      {/* Main Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: 20,
          padding: 20,
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* Left: Stream + Markets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Stream Player */}
          <HlsPlayer streamUrl={streamUrl} />

          {/* Active Markets */}
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                margin: "0 0 12px 0",
              }}
            >
              Active Markets
            </h2>

            {betError && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  marginBottom: 8,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#f87171",
                  fontSize: 12,
                }}
              >
                {betError}
              </div>
            )}

            {state.markets.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 40,
                  color: "#555",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 12,
                  border: "1px dashed rgba(255,255,255,0.06)",
                }}
              >
                No active markets — waiting for next duel...
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {state.markets.map((market) => (
                  <MarketCard
                    key={market.duelId}
                    market={market}
                    onBetA={(amount) => handleBet(market.duelId, "A", amount)}
                    onBetB={(amount) => handleBet(market.duelId, "B", amount)}
                    isPlacingBet={isPlacingBet}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: My Bets + Leaderboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* My Bets */}
          {walletAddress && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  margin: "0 0 10px 0",
                }}
              >
                My Bets
              </h3>
              {state.myBets.length === 0 ? (
                <div style={{ color: "#555", fontSize: 12 }}>No bets yet</div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {state.myBets.slice(0, 10).map((bet) => (
                    <div
                      key={bet.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 8px",
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.02)",
                        fontSize: 11,
                      }}
                    >
                      <span
                        style={{
                          color: bet.side === "A" ? "#3b82f6" : "#ef4444",
                        }}
                      >
                        Side {bet.side}
                      </span>
                      <span style={{ color: "#aaa" }}>{bet.amount} GOLD</span>
                      <span style={{ color: "#666" }}>{bet.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Leaderboard */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 16,
              flex: 1,
            }}
          >
            <h3
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#fbbf24",
                margin: "0 0 10px 0",
              }}
            >
              Leaderboard
            </h3>
            {state.leaderboard.length === 0 ? (
              <div style={{ color: "#555", fontSize: 12 }}>
                No bets placed yet
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {state.leaderboard.map((entry, i) => (
                  <div
                    key={entry.wallet}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 8px",
                      borderRadius: 4,
                      background:
                        i < 3 ? "rgba(251,191,36,0.05)" : "transparent",
                      fontSize: 11,
                    }}
                  >
                    <span
                      style={{
                        color: i < 3 ? "#fbbf24" : "#aaa",
                        fontWeight: i < 3 ? 600 : 400,
                      }}
                    >
                      #{i + 1}
                    </span>
                    <span
                      style={{
                        color: "#888",
                        fontFamily: "monospace",
                        fontSize: 10,
                      }}
                    >
                      {entry.wallet.slice(0, 4)}...{entry.wallet.slice(-4)}
                    </span>
                    <span style={{ color: "#aaa" }}>
                      {parseFloat(entry.totalWagered).toFixed(0)} GOLD
                    </span>
                    <span style={{ color: "#666" }}>
                      {entry.totalBets} bets
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connection status */}
          <div style={{ fontSize: 10, color: "#444", textAlign: "center" }}>
            {state.connected ? "Live" : "Connecting..."} |{" "}
            {walletAddress ? `${walletAddress.slice(0, 6)}...` : "No wallet"}
          </div>
        </div>
      </div>
    </div>
  );
}
