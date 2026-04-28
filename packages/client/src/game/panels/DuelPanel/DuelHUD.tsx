/**
 * Duel HUD Overlay
 *
 * In-combat overlay shown during active duels with:
 * - Opponent health bar (large, prominent)
 * - Forfeit button (if allowed by rules)
 * - Active rule indicators
 * - Opponent disconnect status with countdown
 *
 * Positioned at top center of screen, above the game world.
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import { useThemeStore } from "@/ui";
import { getHpPercent, getHpColor } from "@hyperscape/shared";
import { UI } from "@/ui/core";
import type { DuelRules } from "@hyperscape/shared";

// ============================================================================
// Types
// ============================================================================

export interface DuelHUDState {
  /** Whether the HUD is visible (only during FIGHTING state) */
  visible: boolean;
  /** Opponent's display name */
  opponentName: string;
  /** Opponent's current health */
  opponentHealth: number;
  /** Opponent's max health */
  opponentMaxHealth: number;
  /** Active duel rules */
  rules: DuelRules;
  /** Whether opponent is currently disconnected */
  opponentDisconnected: boolean;
  /** Seconds remaining before auto-forfeit (if opponent disconnected) */
  disconnectCountdown: number;
}

interface DuelHUDProps {
  state: DuelHUDState;
  onForfeit: () => void;
}

// ============================================================================
// Rule Icons
// ============================================================================

const RULE_ICONS: Partial<
  Record<keyof DuelRules, { icon: string; label: string }>
> = {
  noRanged: { icon: "🏹", label: "No Ranged" },
  noMelee: { icon: "⚔️", label: "No Melee" },
  noMagic: { icon: "✨", label: "No Magic" },
  noSpecialAttack: { icon: "💥", label: "No Special" },
  noPrayer: { icon: "🙏", label: "No Prayer" },
  noPotions: { icon: "🧪", label: "No Potions" },
  noFood: { icon: "🍖", label: "No Food" },
  noMovement: { icon: "🚫", label: "No Movement" },
  noForfeit: { icon: "🏳️", label: "No Forfeit" },
};

// ============================================================================
// Component
// ============================================================================

const FORFEIT_CONFIRM_TIMEOUT = 3000;

export function DuelHUD({ state, onForfeit }: DuelHUDProps) {
  const theme = useThemeStore((s) => s.theme);
  const [forfeitHover, setForfeitHover] = useState(false);
  const [forfeitConfirm, setForfeitConfirm] = useState(false);
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Clean up forfeit timer on unmount
  useEffect(() => {
    return () => {
      if (forfeitTimerRef.current) clearTimeout(forfeitTimerRef.current);
    };
  }, []);

  // Reset confirm state when HUD hides
  useEffect(() => {
    if (!state.visible) {
      setForfeitConfirm(false);
      if (forfeitTimerRef.current) {
        clearTimeout(forfeitTimerRef.current);
        forfeitTimerRef.current = undefined;
      }
    }
  }, [state.visible]);

  const handleForfeitClick = useCallback(() => {
    if (forfeitConfirm) {
      onForfeit();
      setForfeitConfirm(false);
      if (forfeitTimerRef.current) {
        clearTimeout(forfeitTimerRef.current);
        forfeitTimerRef.current = undefined;
      }
    } else {
      setForfeitConfirm(true);
      // Auto-reset after timeout
      forfeitTimerRef.current = setTimeout(
        () => setForfeitConfirm(false),
        FORFEIT_CONFIRM_TIMEOUT,
      );
    }
  }, [forfeitConfirm, onForfeit]);

  if (!state.visible) return null;

  const healthPercent = getHpPercent(
    state.opponentHealth,
    state.opponentMaxHealth,
  );

  // Get active rules for display
  const activeRules = Object.entries(state.rules)
    .filter(([key, value]) => value && RULE_ICONS[key as keyof DuelRules])
    .map(([key]) => ({
      key,
      ...RULE_ICONS[key as keyof DuelRules]!,
    }));

  // Can forfeit?
  const canForfeit = !state.rules.noForfeit;

  // Map OSRS HP color to theme semantic colors
  const hpColorToTheme: Record<string, string> = {
    "#22c55e": theme.colors.state.success,
    "#eab308": theme.colors.state.warning,
    "#ef4444": theme.colors.state.danger,
  };
  const getHealthColor = (percent: number): string =>
    hpColorToTheme[getHpColor(percent)] ?? theme.colors.state.danger;

  // Styles
  const containerStyle: CSSProperties = {
    position: "fixed",
    top: theme.spacing.lg,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing.sm,
    zIndex: UI.Z_INDEX.OVERLAY,
    pointerEvents: "auto",
  };

  const healthContainerStyle: CSSProperties = {
    background: "rgba(0, 0, 0, 0.8)",
    border: `2px solid ${theme.colors.border.default}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    minWidth: "280px",
  };

  const opponentNameStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: "center",
    marginBottom: theme.spacing.xs,
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
  };

  const healthBarContainerStyle: CSSProperties = {
    width: "100%",
    height: "24px",
    background: "rgba(0, 0, 0, 0.6)",
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    position: "relative",
    border: `1px solid ${theme.colors.border.default}`,
  };

  const healthBarFillStyle: CSSProperties = {
    width: `${healthPercent}%`,
    height: "100%",
    background: `linear-gradient(180deg, ${getHealthColor(healthPercent)}, ${getHealthColor(healthPercent)}99)`,
    transition: "width 0.3s ease-out",
    boxShadow: `0 0 10px ${getHealthColor(healthPercent)}66`,
  };

  const healthTextStyle: CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    color: "#fff",
    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
    zIndex: 1,
  };

  const rulesContainerStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    flexWrap: "wrap",
  };

  const ruleIconStyle: CSSProperties = {
    fontSize: "16px",
    padding: "4px",
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: theme.borderRadius.sm,
    cursor: "default",
  };

  const forfeitButtonStyle: CSSProperties = {
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    cursor: canForfeit ? "pointer" : "not-allowed",
    transition: "all 0.2s ease",
    background: forfeitConfirm
      ? theme.colors.state.danger
      : forfeitHover && canForfeit
        ? `${theme.colors.state.warning}cc`
        : "rgba(100, 100, 100, 0.8)",
    color: canForfeit ? "#fff" : theme.colors.text.muted,
    border: `1px solid ${forfeitConfirm ? theme.colors.state.danger : theme.colors.border.default}`,
    opacity: canForfeit ? 1 : 0.5,
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
  };

  const disconnectOverlayStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(255, 165, 0, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.lg,
  };

  const disconnectTextStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.state.warning,
    fontWeight: theme.typography.fontWeight.bold,
    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
  };

  return (
    <div style={containerStyle}>
      <div style={{ ...healthContainerStyle, position: "relative" }}>
        {/* Opponent name */}
        <div style={opponentNameStyle}>{state.opponentName}</div>

        {/* Health bar */}
        <div style={healthBarContainerStyle}>
          <div style={healthBarFillStyle} />
          <div style={healthTextStyle}>
            {state.opponentHealth} / {state.opponentMaxHealth}
          </div>
        </div>

        {/* Active rules indicators */}
        {activeRules.length > 0 && (
          <div style={rulesContainerStyle}>
            {activeRules.map(({ key, icon, label }) => (
              <span key={key} style={ruleIconStyle} title={label}>
                {icon}
              </span>
            ))}
          </div>
        )}

        {/* Disconnect overlay */}
        {state.opponentDisconnected && (
          <div style={disconnectOverlayStyle}>
            <span style={disconnectTextStyle}>
              Disconnected ({state.disconnectCountdown}s)
            </span>
          </div>
        )}
      </div>

      {/* Forfeit button */}
      <button
        onClick={canForfeit ? handleForfeitClick : undefined}
        style={forfeitButtonStyle}
        onMouseEnter={() => setForfeitHover(true)}
        onMouseLeave={() => setForfeitHover(false)}
        disabled={!canForfeit}
        title={canForfeit ? "Forfeit the duel" : "Forfeit disabled by rules"}
      >
        {forfeitConfirm ? "Click again to confirm" : "Forfeit"}
      </button>
    </div>
  );
}

// ============================================================================
// Default State Factory
// ============================================================================

export function createDefaultDuelHUDState(): DuelHUDState {
  return {
    visible: false,
    opponentName: "",
    opponentHealth: 100,
    opponentMaxHealth: 100,
    rules: {
      noRanged: false,
      noMelee: false,
      noMagic: false,
      noSpecialAttack: false,
      noPrayer: false,
      noPotions: false,
      noFood: false,
      noMovement: false,
      noForfeit: false,
      funWeapons: false,
    },
    opponentDisconnected: false,
    disconnectCountdown: 0,
  };
}
