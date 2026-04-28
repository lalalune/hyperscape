/**
 * Duel Result Modal
 *
 * Modal displayed when a duel ends, showing whether the player
 * won or lost, along with the items they received or lost.
 *
 * Features:
 * - Animated entrance with icon pop and title slide
 * - Victory trophy or defeat skull display
 * - Items won/lost with gold values
 *
 * Uses ModalWindow for consistent styling and behavior.
 */

import { useCallback, useState, useEffect, type CSSProperties } from "react";
import { ModalWindow, useThemeStore } from "@/ui";
import { getPanelSurfaceStyle } from "@/ui/theme/themes";
import { getItem } from "@hyperscape/shared";
import { formatGoldValue } from "../../systems/currency";

// ============================================================================
// Types
// ============================================================================

export interface DuelResultItem {
  itemId: string;
  quantity: number;
  value: number;
}

export interface DuelResultState {
  visible: boolean;
  won: boolean;
  opponentName: string;
  itemsReceived: DuelResultItem[];
  itemsLost: DuelResultItem[];
  totalValueWon: number;
  totalValueLost: number;
  forfeit: boolean;
}

interface DuelResultModalProps {
  state: DuelResultState;
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DuelResultModal({ state, onClose }: DuelResultModalProps) {
  const theme = useThemeStore((s) => s.theme);
  const [buttonHover, setButtonHover] = useState(false);
  const [animPhase, setAnimPhase] = useState<
    "initial" | "icon" | "title" | "content"
  >("initial");

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Entrance animation sequence
  useEffect(() => {
    if (!state.visible) {
      setAnimPhase("initial");
      return;
    }

    // Start animation sequence
    setAnimPhase("initial");

    const iconTimer = setTimeout(() => setAnimPhase("icon"), 100);
    const titleTimer = setTimeout(() => setAnimPhase("title"), 300);
    const contentTimer = setTimeout(() => setAnimPhase("content"), 500);

    return () => {
      clearTimeout(iconTimer);
      clearTimeout(titleTimer);
      clearTimeout(contentTimer);
    };
  }, [state.visible]);

  if (!state.visible) return null;

  const isWinner = state.won;
  const hasItems = state.itemsReceived.length > 0 || state.itemsLost.length > 0;

  // Styles with entrance animations
  const resultHeaderStyle: CSSProperties = {
    textAlign: "center",
    marginBottom: theme.spacing.lg,
  };

  const iconStyle: CSSProperties = {
    fontSize: "64px",
    marginBottom: theme.spacing.sm,
    transform:
      animPhase === "initial"
        ? "scale(0) rotate(-180deg)"
        : animPhase === "icon"
          ? "scale(1.2) rotate(0deg)"
          : "scale(1) rotate(0deg)",
    opacity: animPhase === "initial" ? 0 : 1,
    transition:
      "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out",
    display: "inline-block",
    filter: isWinner
      ? "drop-shadow(0 0 15px rgba(255, 215, 0, 0.8))"
      : "drop-shadow(0 0 15px rgba(255, 100, 100, 0.5))",
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xxl || "28px",
    fontWeight: theme.typography.fontWeight.bold,
    color: isWinner ? theme.colors.state.success : theme.colors.state.danger,
    textShadow: `0 0 20px ${isWinner ? theme.colors.state.success : theme.colors.state.danger}88`,
    marginBottom: theme.spacing.xs,
    transform:
      animPhase === "initial" || animPhase === "icon"
        ? "translateY(20px)"
        : "translateY(0)",
    opacity: animPhase === "initial" || animPhase === "icon" ? 0 : 1,
    transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
  };

  const subtitleStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    transform: animPhase === "content" ? "translateY(0)" : "translateY(10px)",
    opacity: animPhase === "content" ? 1 : 0,
    transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
  };

  const sectionStyle: CSSProperties = {
    ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    transform: animPhase === "content" ? "translateY(0)" : "translateY(15px)",
    opacity: animPhase === "content" ? 1 : 0,
    transition: "transform 0.4s ease-out, opacity 0.4s ease-out",
  };

  const sectionTitleStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border.default}`,
    paddingBottom: theme.spacing.xs,
  };

  const itemListStyle: CSSProperties = {
    maxHeight: "150px",
    overflowY: "auto",
  };

  const itemRowStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${theme.spacing.xs}px 0`,
    fontSize: theme.typography.fontSize.sm,
  };

  const totalRowStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.border.default}`,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  };

  const buttonStyle: CSSProperties = {
    width: "100%",
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    cursor: "pointer",
    transition: "all 0.2s ease",
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
    background: buttonHover
      ? `linear-gradient(135deg, ${theme.colors.state.info} 0%, ${theme.colors.state.info}CC 100%)`
      : `linear-gradient(135deg, ${theme.colors.state.info}CC 0%, ${theme.colors.state.info}AA 100%)`,
    color: "#fff",
    border: `1px solid ${theme.colors.state.info}`,
    transform: buttonHover ? "translateY(-1px)" : "none",
  };

  const renderItemList = (items: DuelResultItem[], colorOverride?: string) => {
    if (items.length === 0) {
      return (
        <p
          style={{
            color: theme.colors.text.muted,
            fontSize: theme.typography.fontSize.xs,
          }}
        >
          No items
        </p>
      );
    }

    return (
      <div style={itemListStyle}>
        {items.map((item, index) => {
          const itemData = getItem(item.itemId);
          const name = itemData?.name || item.itemId;
          const qtyStr =
            item.quantity > 1 ? ` x${item.quantity.toLocaleString()}` : "";

          return (
            <div key={`${item.itemId}-${index}`} style={itemRowStyle}>
              <span
                style={{ color: colorOverride || theme.colors.text.primary }}
              >
                {name}
                {qtyStr}
              </span>
              <span style={{ color: "#ffd700" }}>
                {formatGoldValue(item.value)} gp
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ModalWindow
      visible={state.visible}
      onClose={handleClose}
      title="Duel Complete"
      width={380}
      showCloseButton={false}
    >
      <div
        style={{
          ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
          padding: theme.spacing.sm,
        }}
      >
        {/* Result header */}
        <div style={resultHeaderStyle}>
          <div style={iconStyle}>{isWinner ? "🏆" : "💀"}</div>
          <div style={titleStyle}>{isWinner ? "Victory!" : "Defeat"}</div>
          <div style={subtitleStyle}>
            {isWinner
              ? `You defeated ${state.opponentName}!`
              : `You were defeated by ${state.opponentName}`}
            {state.forfeit && !isWinner && " (forfeit)"}
          </div>
        </div>

        {/* Items section */}
        {hasItems && (
          <>
            {isWinner && state.itemsReceived.length > 0 && (
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Items Won</div>
                {renderItemList(
                  state.itemsReceived,
                  theme.colors.state.success,
                )}
                <div style={totalRowStyle}>
                  <span>Total Value:</span>
                  <span style={{ color: theme.colors.state.success }}>
                    +{formatGoldValue(state.totalValueWon)} gp
                  </span>
                </div>
              </div>
            )}

            {!isWinner && state.itemsLost.length > 0 && (
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Items Lost</div>
                {renderItemList(state.itemsLost, theme.colors.state.danger)}
                <div style={totalRowStyle}>
                  <span>Total Value:</span>
                  <span style={{ color: theme.colors.state.danger }}>
                    -{formatGoldValue(state.totalValueLost)} gp
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* No stakes message */}
        {!hasItems && (
          <div style={{ ...sectionStyle, textAlign: "center" }}>
            <p style={{ color: theme.colors.text.muted }}>
              {isWinner
                ? "No items were staked in this duel."
                : "You didn't lose any items."}
            </p>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={handleClose}
          style={buttonStyle}
          onMouseEnter={() => setButtonHover(true)}
          onMouseLeave={() => setButtonHover(false)}
        >
          Continue
        </button>
      </div>
    </ModalWindow>
  );
}

// ============================================================================
// Default State Factory
// ============================================================================

export function createDefaultDuelResultState(): DuelResultState {
  return {
    visible: false,
    won: false,
    opponentName: "",
    itemsReceived: [],
    itemsLost: [],
    totalValueWon: 0,
    totalValueLost: 0,
    forfeit: false,
  };
}
