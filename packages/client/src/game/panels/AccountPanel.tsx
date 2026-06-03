/**
 * Account Management Panel
 * Compact account status card - full management in Settings > Account tab
 * Integrates Solana wallet via useSolanaWallet for balance display and MWA detection
 */

import React, { useEffect, useState, useCallback } from "react";
import { useThemeStore } from "@/ui";
import {
  getInteractiveTileStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
} from "@/ui/theme/themes";
import { EventType } from "@hyperforge/shared";
import type { ClientWorld } from "../../types";
import { privyAuthManager } from "../../auth/PrivyAuthManager";
import { useSolanaWallet } from "../../hooks/useSolanaWallet";

type AccountPanelProps = {
  world: ClientWorld;
};

export function AccountPanel({ world }: AccountPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const [authState, setAuthState] = useState(privyAuthManager.getState());
  const [playerName, setPlayerName] = useState("");
  const [characterWallet, setCharacterWallet] = useState<string | undefined>();
  const [solBalance, setSolBalance] = useState<number | null>(null);

  // Solana wallet from @solana/wallet-adapter (includes MWA detection)
  const {
    address: solanaAddress,
    connected: solanaConnected,
    isMWA,
    getBalance,
  } = useSolanaWallet();

  useEffect(() => {
    const unsubscribe = privyAuthManager.subscribe(setAuthState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const player = world.entities?.player;
    if (player?.name) {
      setPlayerName(player.name);
    }
    if (player?.data?.wallet) {
      setCharacterWallet(player.data.wallet as string);
    }
  }, [world]);

  // Fetch SOL balance when Solana wallet connects
  const fetchBalance = useCallback(async () => {
    if (!solanaConnected) {
      setSolBalance(null);
      return;
    }
    const balance = await getBalance();
    setSolBalance(balance);
  }, [solanaConnected, getBalance]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const authenticated = authState.isAuthenticated;
  const mainWalletAddress = (
    authState.user as { wallet?: { address?: string } }
  )?.wallet?.address;
  // Prefer Solana wallet adapter address (connected via MWA) over Privy wallet
  const displayWallet = solanaAddress || characterWallet || mainWalletAddress;
  const farcasterFid = authState.farcasterFid;

  const truncate = (str: string, startLen: number, endLen: number) => {
    if (str.length <= startLen + endLen + 3) return str;
    return `${str.substring(0, startLen)}...${str.slice(-endLen)}`;
  };

  // Cloud feature count for summary
  const cloudFeatures = [
    { enabled: authenticated },
    { enabled: authenticated },
    { enabled: authenticated },
  ];
  const enabledCount = cloudFeatures.filter((f) => f.enabled).length;

  return (
    <div
      className="h-full overflow-y-auto noscrollbar"
      style={{
        ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
        padding: "4px",
      }}
    >
      <div className="flex flex-col gap-3">
        {/* Profile Summary Card */}
        <div
          className="rounded-lg relative overflow-hidden"
          style={{
            ...getPanelInsetStyle(theme, {
              emphasis: "strong",
              radius: theme.borderRadius.md,
            }),
            border: authenticated
              ? `1px solid ${theme.colors.state.success}40`
              : `1px solid ${theme.colors.border.decorative}`,
            boxShadow:
              "inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -16px 20px rgba(0,0,0,0.12)",
          }}
        >
          {/* Status glow */}
          {authenticated && (
            <div
              className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl"
              style={{
                background: theme.colors.state.success,
                opacity: 0.1,
                transform: "translate(30%, -30%)",
              }}
            />
          )}

          <div className="relative z-10 p-3">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              {/* Avatar */}
              <div
                className="w-12 h-12 flex items-center justify-center"
                style={{
                  ...getInteractiveTileStyle(theme, {
                    active: authenticated,
                    radius: theme.borderRadius.md,
                    accentColor: authenticated
                      ? theme.colors.state.success
                      : theme.colors.accent.secondary,
                  }),
                  border: authenticated
                    ? `2px solid ${theme.colors.state.success}50`
                    : `2px solid ${theme.colors.border.decorative}`,
                }}
              >
                <span style={{ fontSize: "22px" }}>
                  {authenticated ? "👤" : "👻"}
                </span>
              </div>

              <div className="flex-1">
                {/* Status */}
                <div className="flex items-center gap-1.5 mb-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: authenticated
                        ? theme.colors.state.success
                        : theme.colors.state.warning,
                      boxShadow: authenticated
                        ? `0 0 8px ${theme.colors.state.success}80`
                        : `0 0 8px ${theme.colors.state.warning}80`,
                    }}
                  />
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color: authenticated
                        ? theme.colors.state.success
                        : theme.colors.state.warning,
                    }}
                  >
                    {authenticated ? "Connected" : "Guest Mode"}
                  </span>
                </div>

                {/* Name */}
                <div
                  className="text-[15px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: theme.colors.text.primary }}
                >
                  {playerName || "Adventurer"}
                </div>
              </div>
            </div>

            {/* Wallet Info */}
            {authenticated && displayWallet && (
              <div
                className="p-2 rounded space-y-1"
                style={{
                  ...getPanelInsetStyle(theme, {
                    emphasis: "normal",
                    radius: theme.borderRadius.sm,
                    padding: "0.5rem",
                  }),
                  border: `1px solid ${theme.colors.border.default}52`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[9px]"
                      style={{ color: `${theme.colors.state.success}80` }}
                    >
                      Wallet
                    </span>
                    {isMWA && (
                      <span
                        className="text-[7px] px-1 py-0.5 rounded-full font-medium"
                        style={{
                          background: "rgba(148, 103, 255, 0.2)",
                          border: "1px solid rgba(148, 103, 255, 0.4)",
                          color: "rgba(148, 103, 255, 0.9)",
                        }}
                      >
                        MWA
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: `${theme.colors.state.success}CC` }}
                  >
                    {truncate(displayWallet, 6, 4)}
                  </span>
                </div>
                {solBalance !== null && (
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[9px]"
                      style={{ color: theme.colors.text.muted }}
                    >
                      Balance
                    </span>
                    <span
                      className="text-[10px] font-mono font-medium"
                      style={{ color: theme.colors.accent.primary }}
                    >
                      {solBalance.toFixed(4)} SOL
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cloud Status Summary */}
        <div
          className="rounded-lg p-3"
          style={{
            background:
              theme.name === "hyperia"
                ? "linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(0, 0, 0, 0.14) 100%)"
                : theme.colors.background.panelSecondary,
            border: `1px solid ${theme.colors.border.default}40`,
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[10px] font-semibold"
              style={{ color: theme.colors.accent.primary }}
            >
              Cloud Features
            </span>
            <span
              className="text-[9px] px-2 py-0.5 rounded-full"
              style={{
                background: authenticated
                  ? `${theme.colors.state.success}20`
                  : theme.colors.background.tertiary,
                border: authenticated
                  ? `1px solid ${theme.colors.state.success}40`
                  : `1px solid ${theme.colors.border.default}`,
                color: authenticated
                  ? theme.colors.state.success
                  : theme.colors.text.muted,
              }}
            >
              {enabledCount}/3 Active
            </span>
          </div>

          <div className="flex gap-2">
            {[
              { icon: "🔄", label: "Sync" },
              { icon: "☁️", label: "Backup" },
              { icon: "🔐", label: "Recovery" },
            ].map((feature) => (
              <div
                key={feature.label}
                className="flex-1 flex flex-col items-center py-2 rounded"
                style={{
                  background: authenticated
                    ? `${theme.colors.state.success}10`
                    : theme.colors.background.tertiary,
                  border: authenticated
                    ? `1px solid ${theme.colors.state.success}25`
                    : `1px solid ${theme.colors.border.default}`,
                  opacity: authenticated ? 1 : 0.5,
                }}
              >
                <span style={{ fontSize: "14px" }}>{feature.icon}</span>
                <span
                  className="text-[8px] mt-1"
                  style={{
                    color: authenticated
                      ? theme.colors.accent.primary
                      : theme.colors.text.muted,
                  }}
                >
                  {feature.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Social Badge */}
        {farcasterFid && (
          <div
            className="flex items-center gap-2 p-2.5 rounded-lg"
            style={{
              background:
                "linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(168, 85, 247, 0.06) 100%)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(168, 85, 247, 0.2)",
                border: "1px solid rgba(168, 85, 247, 0.4)",
              }}
            >
              <span style={{ fontSize: "12px" }}>🟣</span>
            </div>
            <div className="flex-1">
              <div
                className="text-[10px] font-medium"
                style={{ color: "#c084fc" }}
              >
                Farcaster Connected
              </div>
              <div
                className="text-[8px]"
                style={{ color: "rgba(168, 85, 247, 0.7)" }}
              >
                FID #{farcasterFid}
              </div>
            </div>
          </div>
        )}

        {/* Guest Warning */}
        {!authenticated && (
          <div
            className="rounded-lg p-3 flex items-start gap-2.5"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.state.warning}12 0%, ${theme.colors.state.warning}06 100%)`,
              border: `1px solid ${theme.colors.state.warning}30`,
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: `${theme.colors.state.warning}20`,
                border: `1px solid ${theme.colors.state.warning}35`,
              }}
            >
              <span style={{ fontSize: "12px" }}>⚠️</span>
            </div>
            <div>
              <div
                className="text-[10px] font-semibold mb-0.5"
                style={{ color: theme.colors.state.warning }}
              >
                Playing as Guest
              </div>
              <div
                className="text-[8px] leading-relaxed"
                style={{ color: `${theme.colors.state.warning}BB` }}
              >
                Progress not saved. Sign in for cloud sync and recovery.
              </div>
            </div>
          </div>
        )}

        {/* Settings Link */}
        <div
          className="rounded-lg p-2.5 flex items-center justify-between cursor-pointer transition-all hover:opacity-90"
          style={{
            background:
              theme.name === "hyperia"
                ? "linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(0, 0, 0, 0.14) 100%)"
                : theme.colors.background.panelSecondary,
            border: `1px solid ${theme.colors.border.default}40`,
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
          }}
          onClick={() => {
            // Set pending tab for SettingsPanel to pick up
            sessionStorage.setItem("settings-initial-tab", "account");
            // Open settings panel using the proper event
            world.emit?.(EventType.UI_OPEN_PANE, { pane: "settings" });
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "12px" }}>⚙️</span>
            <span
              className="text-[10px]"
              style={{ color: theme.colors.text.secondary }}
            >
              Full Account Settings
            </span>
          </div>
          <span
            className="text-[10px]"
            style={{ color: theme.colors.text.muted }}
          >
            →
          </span>
        </div>
      </div>
    </div>
  );
}
