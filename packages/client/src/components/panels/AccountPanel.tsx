/**
 * Account Management Panel
 * Shows login status, user info, and account controls
 */

import React, { useEffect, useState } from "react";
import type { ClientWorld } from "../../types";
import { privyAuthManager } from "../../PrivyAuthManager";

interface AccountPanelProps {
  world: ClientWorld;
}

export function AccountPanel({ world }: AccountPanelProps) {
  const [authState, setAuthState] = useState(privyAuthManager.getState());
  const [playerName, setPlayerName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = privyAuthManager.subscribe(setAuthState);
    return unsubscribe;
  }, []);

  // Get player name from world
  useEffect(() => {
    const player = world.entities?.player;
    if (player?.name) {
      setPlayerName(player.name);
      setTempName(player.name);
    }
  }, [world]);

  const handleLogout = async () => {
    // Use global Privy logout
    const windowWithLogout = window as typeof window & {
      privyLogout: () => void;
    };
    await windowWithLogout.privyLogout();

    // Clear auth state
    privyAuthManager.clearAuth();

    // Reload page after logout
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleNameChange = () => {
    if (tempName && tempName !== playerName) {
      const player = world.entities?.player;
      if (player) {
        player.name = tempName;
        setPlayerName(tempName);
        setIsEditingName(false);

        // Send name update to server
        world.network?.send?.("chat", {
          type: "system",
          message: `Changed name to ${tempName}`,
        });
      }
    } else {
      setIsEditingName(false);
      setTempName(playerName);
    }
  };

  // Get user info from authState (works with or without Privy)
  const authenticated = authState.isAuthenticated;
  const userId = authState.privyUserId;
  const walletAddress = (authState.user as { wallet?: { address?: string } })
    ?.wallet?.address;
  const farcasterFid = authState.farcasterFid;
  const email = (authState.user as { email?: { address?: string } })?.email
    ?.address;

  return (
    <div className="h-full overflow-y-auto noscrollbar p-1">
      {/* Bento Grid Layout */}
      <div
        className="grid gap-1.5 auto-rows-min"
        style={{
          gridTemplateColumns: "repeat(6, 1fr)",
        }}
      >
        {/* Hero Card - Character & Status (Spans 6 columns, tall) */}
        <div
          className="relative overflow-hidden rounded-lg p-2.5"
          style={{
            gridColumn: "span 6",
            background:
              "linear-gradient(135deg, rgba(20, 15, 10, 0.85) 0%, rgba(25, 20, 15, 0.75) 100%)",
            borderColor: authenticated
              ? "rgba(34, 197, 94, 0.4)"
              : "rgba(242, 208, 138, 0.3)",
            border: "1px solid",
            boxShadow: authenticated
              ? "0 0 20px rgba(34, 197, 94, 0.15), inset 0 1px 0 rgba(242, 208, 138, 0.1)"
              : "inset 0 1px 0 rgba(242, 208, 138, 0.1)",
          }}
        >
          {/* Decorative corner accent */}
          <div
            className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-20"
            style={{
              background: authenticated ? "#22c55e" : "#f2d08a",
              transform: "translate(40%, -40%)",
            }}
          />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{
                      backgroundColor: authenticated ? "#22c55e" : "#9ca3af",
                    }}
                  />
                  <span
                    className="text-[8px] uppercase tracking-widest"
                    style={{ color: "rgba(242, 208, 138, 0.5)" }}
                  >
                    {authenticated ? "Connected" : "Guest"}
                  </span>
                </div>
                <div
                  className="text-base font-bold mb-0.5"
                  style={{
                    color: "#f2d08a",
                    textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
                  }}
                >
                  {playerName || "Adventurer"}
                </div>
                {authenticated && email && (
                  <div
                    className="text-[8px] font-mono"
                    style={{ color: "rgba(242, 208, 138, 0.5)" }}
                  >
                    {email}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setIsEditingName(true)}
                  className="rounded px-1.5 py-1 cursor-pointer transition-all text-[9px]"
                  style={{
                    backgroundColor: "rgba(242, 208, 138, 0.1)",
                    border: "1px solid rgba(242, 208, 138, 0.25)",
                    color: "rgba(242, 208, 138, 0.8)",
                  }}
                >
                  ✎ Edit
                </button>
                {authenticated && (
                  <button
                    onClick={handleLogout}
                    className="rounded px-1.5 py-1 cursor-pointer transition-all text-[9px] whitespace-nowrap"
                    style={{
                      backgroundColor: "rgba(220, 38, 38, 0.15)",
                      border: "1px solid rgba(220, 38, 38, 0.35)",
                      color: "#fca5a5",
                    }}
                  >
                    Sign Out
                  </button>
                )}
              </div>
            </div>

            {/* Edit Mode */}
            {isEditingName && (
              <div className="flex gap-1 mt-2">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="flex-1 text-[10px] py-1 px-1.5 bg-white/5 border rounded focus:outline-none"
                  style={{
                    borderColor: "rgba(242, 208, 138, 0.3)",
                    color: "#f2d08a",
                  }}
                  placeholder="Enter name..."
                  maxLength={20}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNameChange();
                    if (e.key === "Escape") {
                      setIsEditingName(false);
                      setTempName(playerName);
                    }
                  }}
                />
                <button
                  onClick={handleNameChange}
                  className="text-[9px] rounded px-2 py-1 cursor-pointer transition-all"
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    color: "#22c55e",
                  }}
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setIsEditingName(false);
                    setTempName(playerName);
                  }}
                  className="text-[9px] rounded px-2 py-1 cursor-pointer transition-all"
                  style={{
                    backgroundColor: "rgba(107, 114, 128, 0.15)",
                    border: "1px solid rgba(107, 114, 128, 0.3)",
                    color: "#9ca3af",
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Account Details Row - User ID & Wallet (2x1 layout) */}
        {authenticated && userId && (
          <div
            className="rounded-lg p-1.5"
            style={{
              gridColumn: "span 3",
              background:
                "linear-gradient(135deg, rgba(242, 208, 138, 0.08) 0%, rgba(139, 69, 19, 0.08) 100%)",
              border: "1px solid rgba(242, 208, 138, 0.2)",
            }}
          >
            <div
              className="text-[7px] uppercase tracking-wide mb-0.5"
              style={{ color: "rgba(242, 208, 138, 0.4)" }}
            >
              User ID
            </div>
            <div
              className="font-mono text-[9px]"
              style={{ color: "rgba(242, 208, 138, 0.85)" }}
            >
              {userId.substring(0, 10)}...
            </div>
          </div>
        )}

        {authenticated && walletAddress && (
          <div
            className="rounded-lg p-1.5"
            style={{
              gridColumn: "span 3",
              background:
                "linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.04) 100%)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
            }}
          >
            <div
              className="text-[7px] uppercase tracking-wide mb-0.5"
              style={{ color: "rgba(34, 197, 94, 0.5)" }}
            >
              💎 Wallet
            </div>
            <div
              className="font-mono text-[9px]"
              style={{ color: "rgba(34, 197, 94, 0.9)" }}
            >
              {walletAddress.substring(0, 8)}...
              {walletAddress.substring(walletAddress.length - 6)}
            </div>
          </div>
        )}

        {/* Farcaster Card */}
        {authenticated && farcasterFid && (
          <div
            className="rounded-lg p-1.5"
            style={{
              gridColumn: "span 6",
              background:
                "linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(168, 85, 247, 0.06) 100%)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
            }}
          >
            <div
              className="text-[7px] uppercase tracking-wide mb-0.5"
              style={{ color: "rgba(168, 85, 247, 0.5)" }}
            >
              🎭 Farcaster
            </div>
            <div
              className="font-mono text-[9px]"
              style={{ color: "rgba(168, 85, 247, 0.95)" }}
            >
              FID {farcasterFid}
            </div>
          </div>
        )}

        {/* Benefits Grid - 2x2 */}
        {[
          { label: "Sync", enabled: authenticated, icon: "🔄", col: "span 3" },
          {
            label: "Persistent",
            enabled: authenticated,
            icon: "💾",
            col: "span 3",
          },
          {
            label: "Recovery",
            enabled: authenticated,
            icon: "🔐",
            col: "span 3",
          },
          {
            label: "Social",
            enabled: !!farcasterFid,
            icon: "🌐",
            col: "span 3",
          },
        ].map((feature, i) => (
          <div
            key={i}
            className="rounded-lg p-1.5 transition-all"
            style={{
              gridColumn: feature.col,
              background: feature.enabled
                ? "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)"
                : "linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.2) 100%)",
              border: `1px solid ${feature.enabled ? "rgba(34, 197, 94, 0.25)" : "rgba(242, 208, 138, 0.1)"}`,
              opacity: feature.enabled ? 1 : 0.5,
            }}
          >
            <div className="flex items-center gap-1">
              <span className="text-[10px]">{feature.icon}</span>
              <span
                className="text-[8px] flex-1"
                style={{
                  color: feature.enabled
                    ? "rgba(242, 208, 138, 0.9)"
                    : "rgba(242, 208, 138, 0.4)",
                }}
              >
                {feature.label}
              </span>
              <span
                className="text-[9px]"
                style={{ color: feature.enabled ? "#22c55e" : "#6b7280" }}
              >
                {feature.enabled ? "✓" : "○"}
              </span>
            </div>
          </div>
        ))}

        {/* Guest Warning */}
        {!authenticated && (
          <div
            className="rounded-lg p-2"
            style={{
              gridColumn: "span 6",
              background:
                "linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(251, 191, 36, 0.06) 100%)",
              border: "1px solid rgba(251, 191, 36, 0.3)",
            }}
          >
            <div className="flex items-start gap-1.5">
              <span className="text-xs">⚠️</span>
              <div className="flex-1">
                <div
                  className="text-[9px] font-semibold mb-0.5"
                  style={{ color: "rgba(251, 191, 36, 0.9)" }}
                >
                  Guest Mode Active
                </div>
                <div
                  className="text-[7px]"
                  style={{ color: "rgba(242, 208, 138, 0.6)" }}
                >
                  Progress won't be saved. Configure Privy in .env for
                  authentication.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
