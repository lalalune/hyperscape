/**
 * Duel Challenge Modal
 *
 * Modal displayed when another player sends a duel challenge.
 * Shows the challenging player's name and combat level with
 * Accept/Decline buttons.
 *
 * Uses ModalWindow for consistent styling and behavior.
 */

import { useCallback, useState, type CSSProperties } from "react";
import { ModalWindow, useThemeStore } from "@/ui";
import { getPanelSurfaceStyle } from "@/ui/theme/themes";

interface DuelChallengeModalState {
  visible: boolean;
  challengeId: string | null;
  fromPlayer: {
    id: string;
    name: string;
    level: number;
  } | null;
}

interface DuelChallengeModalProps {
  state: DuelChallengeModalState;
  onAccept: () => void;
  onDecline: () => void;
}

export function DuelChallengeModal({
  state,
  onAccept,
  onDecline,
}: DuelChallengeModalProps) {
  const theme = useThemeStore((s) => s.theme);
  const [acceptHover, setAcceptHover] = useState(false);
  const [declineHover, setDeclineHover] = useState(false);

  const handleClose = useCallback(() => {
    onDecline();
  }, [onDecline]);

  if (!state.visible || !state.fromPlayer) return null;

  const { name, level } = state.fromPlayer;

  const playerInfoStyle: CSSProperties = {
    ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    textAlign: "center",
    marginBottom: theme.spacing.lg,
  };

  const baseButtonStyle: CSSProperties = {
    flex: 1,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    cursor: "pointer",
    transition: "all 0.2s ease",
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
  };

  const acceptButtonStyle: CSSProperties = {
    ...baseButtonStyle,
    background: acceptHover
      ? `linear-gradient(135deg, ${theme.colors.state.success} 0%, ${theme.colors.state.success}CC 100%)`
      : `linear-gradient(135deg, ${theme.colors.state.success}CC 0%, ${theme.colors.state.success}AA 100%)`,
    color: "#fff",
    border: `1px solid ${theme.colors.state.success}`,
    transform: acceptHover ? "translateY(-1px)" : "none",
  };

  const declineButtonStyle: CSSProperties = {
    ...baseButtonStyle,
    background: declineHover
      ? `linear-gradient(135deg, ${theme.colors.state.danger} 0%, ${theme.colors.state.danger}CC 100%)`
      : `linear-gradient(135deg, ${theme.colors.state.danger}CC 0%, ${theme.colors.state.danger}AA 100%)`,
    color: "#fff",
    border: `1px solid ${theme.colors.state.danger}`,
    transform: declineHover ? "translateY(-1px)" : "none",
  };

  // Combat level color based on classic MMORPG conventions
  const getLevelColor = (_opponentLevel: number): string => {
    // Since we don't know the local player's level here,
    // use a neutral gold color like classic MMORPG's duel interface
    return "#ffd700";
  };

  return (
    <ModalWindow
      visible={state.visible}
      onClose={handleClose}
      title="Duel Challenge"
      width={360}
      showCloseButton={false}
    >
      <div
        style={{
          ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
          padding: theme.spacing.sm,
        }}
      >
        {/* Duel icon/header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: theme.spacing.md,
          }}
        >
          <span
            style={{
              fontSize: "24px",
            }}
          >
            ⚔️
          </span>
        </div>

        {/* Player info */}
        <div style={playerInfoStyle}>
          <p
            style={{
              fontSize: theme.typography.fontSize.base,
              color: theme.colors.text.primary,
              marginBottom: theme.spacing.xs,
            }}
          >
            <span style={{ fontWeight: theme.typography.fontWeight.bold }}>
              {name}
            </span>
            <span style={{ color: theme.colors.text.muted }}> (Level: </span>
            <span
              style={{
                color: getLevelColor(level),
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              {level}
            </span>
            <span style={{ color: theme.colors.text.muted }}>)</span>
          </p>
          <p
            style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.secondary,
            }}
          >
            wishes to duel with you
          </p>
        </div>

        {/* Warning text */}
        <p
          style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.state.warning,
            textAlign: "center",
            marginBottom: theme.spacing.md,
            padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
            background: `${theme.colors.state.warning}22`,
            borderRadius: theme.borderRadius.sm,
            border: `1px solid ${theme.colors.state.warning}33`,
          }}
        >
          You will negotiate rules and stakes before the duel begins.
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: theme.spacing.md }}>
          <button
            onClick={onAccept}
            style={acceptButtonStyle}
            onMouseEnter={() => setAcceptHover(true)}
            onMouseLeave={() => setAcceptHover(false)}
          >
            Accept
          </button>
          <button
            onClick={onDecline}
            style={declineButtonStyle}
            onMouseEnter={() => setDeclineHover(true)}
            onMouseLeave={() => setDeclineHover(false)}
          >
            Decline
          </button>
        </div>

        {/* Timeout hint */}
        <p
          style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.muted,
            textAlign: "center",
            marginTop: theme.spacing.md,
          }}
        >
          Challenge expires in 30 seconds
        </p>
      </div>
    </ModalWindow>
  );
}

export type { DuelChallengeModalState };
