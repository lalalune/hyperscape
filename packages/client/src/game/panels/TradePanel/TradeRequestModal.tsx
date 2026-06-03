/**
 * Trade Request Modal
 *
 * Modal displayed when another player sends a trade request.
 * Shows the requesting player's name and combat level with
 * Accept/Decline buttons.
 *
 * Uses ModalWindow for consistent styling and behavior.
 */

import { useCallback, useState, type CSSProperties } from "react";
import { ModalWindow, useThemeStore } from "@/ui";
import { getInteractiveTileStyle, getPanelInsetStyle } from "@/ui/theme/themes";
import type { TradeRequestModalState } from "@hyperforge/shared";

interface TradeRequestModalProps {
  state: TradeRequestModalState;
  onAccept: () => void;
  onDecline: () => void;
}

export function TradeRequestModal({
  state,
  onAccept,
  onDecline,
}: TradeRequestModalProps) {
  const theme = useThemeStore((s) => s.theme);
  const [acceptHover, setAcceptHover] = useState(false);
  const [declineHover, setDeclineHover] = useState(false);

  const handleClose = useCallback(() => {
    onDecline();
  }, [onDecline]);

  if (!state.visible || !state.fromPlayer) return null;

  const { name, level } = state.fromPlayer;

  const playerInfoStyle: CSSProperties = {
    ...getPanelInsetStyle(theme, {
      emphasis: "strong",
      radius: theme.borderRadius.md,
      padding: theme.spacing.md,
    }),
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
    ...getInteractiveTileStyle(theme, {
      active: true,
      hovered: acceptHover,
      accentColor: theme.colors.state.success,
      radius: theme.borderRadius.md,
    }),
    color: "#fff",
    transform: acceptHover ? "translateY(-1px)" : "none",
  };

  const declineButtonStyle: CSSProperties = {
    ...baseButtonStyle,
    ...getInteractiveTileStyle(theme, {
      active: true,
      hovered: declineHover,
      accentColor: theme.colors.state.danger,
      radius: theme.borderRadius.md,
    }),
    color: "#fff",
    transform: declineHover ? "translateY(-1px)" : "none",
  };

  return (
    <ModalWindow
      visible={state.visible}
      onClose={handleClose}
      title="Trade Request"
      width={360}
      showCloseButton={false}
    >
      <div style={{ padding: theme.spacing.sm }}>
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
                color: theme.colors.accent.primary,
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
            wishes to trade with you
          </p>
        </div>

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
          Request expires in 30 seconds
        </p>
      </div>
    </ModalWindow>
  );
}
