/**
 * Achievement Popup Component
 *
 * A reusable centered popup for achievements, level-ups, rewards, and other
 * celebratory notifications. Features animated entrance, glow effects, and
 * auto-dismiss functionality.
 *
 * Variants:
 * - levelUp: Gold theme with pulsing glow (skill level ups)
 * - achievement: Purple theme (achievements unlocked)
 * - reward: Green theme (quest rewards, loot)
 * - warning: Orange theme (important alerts)
 * - info: Blue theme (general information)
 *
 * @packageDocumentation
 */

import React, {
  memo,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from "react";
import { useTheme } from "../stores/themeStore";
import { FireworksEffect } from "./FireworksEffect";
import { zIndex as layerTokens } from "../../constants/tokens";

/** Popup variant determining color scheme */
export type AchievementVariant =
  | "levelUp"
  | "achievement"
  | "reward"
  | "warning"
  | "info";

/** Celebration effect type */
export type CelebrationEffectType = "simple" | "fireworks" | "none";

/** Achievement popup props */
export interface AchievementPopupProps {
  /** Whether the popup is visible */
  visible: boolean;
  /** Called when popup should close */
  onClose: () => void;
  /** Popup variant for styling */
  variant?: AchievementVariant;
  /** Large icon/emoji displayed at top */
  icon?: ReactNode;
  /** Main title text (e.g., "Congratulations!") */
  title: string;
  /** Subtitle text (e.g., "You've advanced a Woodcutting level!") */
  subtitle?: string;
  /** Badge content (e.g., "Level 7" or "500 XP") */
  badge?: ReactNode;
  /** Additional content below badge */
  children?: ReactNode;
  /** Auto-dismiss after this many milliseconds (0 = no auto-dismiss) */
  autoDismissMs?: number;
  /** Show "Click anywhere to continue" hint (default: true) */
  showDismissHint?: boolean;
  /** Dismiss hint text override */
  dismissHintText?: string;
  /** Show fireworks/particle effect (default: true for levelUp/achievement) */
  showCelebration?: boolean;
  /** Type of celebration effect: "simple" (particles), "fireworks" (elaborate), "none" */
  celebrationType?: CelebrationEffectType;
  /** Custom z-index (default: critical overlay layer) */
  zIndex?: number;
  /** Additional style for popup container */
  style?: CSSProperties;
}

/** Get variant colors */
function getVariantColors(variant: AchievementVariant): {
  primary: string;
  glow: string;
  badgeBg: string;
  badgeBorder: string;
} {
  switch (variant) {
    case "levelUp":
      return {
        primary: "#f2d08a", // Gold (Hyperia primary)
        glow: "rgba(201, 165, 74, 0.4)",
        badgeBg: "linear-gradient(180deg, #4a90d9 0%, #2c5aa0 100%)",
        badgeBorder: "#6ab0ff",
      };
    case "achievement":
      return {
        primary: "#a855f7", // Purple
        glow: "rgba(168, 85, 247, 0.4)",
        badgeBg: "linear-gradient(180deg, #9333ea 0%, #7c3aed 100%)",
        badgeBorder: "#c084fc",
      };
    case "reward":
      return {
        primary: "#22c55e", // Green
        glow: "rgba(34, 197, 94, 0.4)",
        badgeBg: "linear-gradient(180deg, #16a34a 0%, #15803d 100%)",
        badgeBorder: "#4ade80",
      };
    case "warning":
      return {
        primary: "#f97316", // Orange
        glow: "rgba(249, 115, 22, 0.4)",
        badgeBg: "linear-gradient(180deg, #ea580c 0%, #c2410c 100%)",
        badgeBorder: "#fb923c",
      };
    case "info":
    default:
      return {
        primary: "#3b82f6", // Blue
        glow: "rgba(59, 130, 246, 0.4)",
        badgeBg: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
        badgeBorder: "#60a5fa",
      };
  }
}

/** CSS keyframes for animations (injected once) */
const KEYFRAMES_ID = "hs-achievement-popup-keyframes";

function ensureKeyframes(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAMES_ID)) return;

  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes hs-achievement-fadeIn {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    @keyframes hs-achievement-pulseGlow {
      0%, 100% {
        filter: drop-shadow(0 0 20px var(--glow-color, rgba(255, 215, 0, 0.4)))
                drop-shadow(0 0 40px var(--glow-color, rgba(255, 215, 0, 0.2)));
      }
      50% {
        filter: drop-shadow(0 0 30px var(--glow-color, rgba(255, 215, 0, 0.6)))
                drop-shadow(0 0 60px var(--glow-color, rgba(255, 215, 0, 0.3)));
      }
    }

    @keyframes hs-achievement-iconBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    @keyframes hs-achievement-particle {
      0% {
        opacity: 1;
        transform: translate(0, 0) scale(1);
      }
      100% {
        opacity: 0;
        transform: translate(var(--dx, 50px), var(--dy, -80px)) scale(0);
      }
    }
  `;
  document.head.appendChild(style);
}

/** Celebration particles */
const CelebrationEffect = memo(function CelebrationEffect({
  color,
}: {
  color: string;
}) {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const distance = 80 + Math.random() * 40;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 20; // Bias upward
    const delay = Math.random() * 0.3;
    const size = 6 + Math.random() * 6;

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: "50%",
          backgroundColor: color,
          opacity: 0,
          animation: `hs-achievement-particle 1s ${delay}s ease-out forwards`,
          ["--dx" as string]: `${dx}px`,
          ["--dy" as string]: `${dy}px`,
        }}
      />
    );
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {particles}
    </div>
  );
});

/**
 * Achievement Popup component
 *
 * @example
 * ```tsx
 * // Level up popup
 * <AchievementPopup
 *   visible={showLevelUp}
 *   onClose={() => setShowLevelUp(false)}
 *   variant="levelUp"
 *   icon="🏃"
 *   title="Congratulations!"
 *   subtitle="You've advanced a Agility level!"
 *   badge={<span>Level 7</span>}
 *   autoDismissMs={5000}
 * />
 *
 * // Achievement unlocked
 * <AchievementPopup
 *   visible={showAchievement}
 *   onClose={() => setShowAchievement(false)}
 *   variant="achievement"
 *   icon="🏆"
 *   title="Achievement Unlocked!"
 *   subtitle="First Blood"
 *   badge={<span>+50 XP</span>}
 * />
 * ```
 */
export const AchievementPopup = memo(function AchievementPopup({
  visible,
  onClose,
  variant = "levelUp",
  icon,
  title,
  subtitle,
  badge,
  children,
  autoDismissMs = 5000,
  showDismissHint = true,
  dismissHintText = "Click anywhere to continue",
  showCelebration,
  celebrationType = "simple",
  zIndex = layerTokens.critical,
  style,
}: AchievementPopupProps): React.ReactElement | null {
  const theme = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);

  // Determine if we show celebration (default true for levelUp/achievement)
  const shouldShowCelebration =
    showCelebration ?? (variant === "levelUp" || variant === "achievement");

  // Determine which celebration type to use
  const effectiveCelebrationType: CelebrationEffectType = shouldShowCelebration
    ? celebrationType
    : "none";

  const colors = getVariantColors(variant);

  // Ensure keyframes are injected
  useEffect(() => {
    ensureKeyframes();
  }, []);

  // Handle entrance animation
  useEffect(() => {
    if (visible) {
      setIsAnimating(true);
    }
  }, [visible]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!visible || autoDismissMs <= 0) return;

    const timer = setTimeout(onClose, autoDismissMs);
    return () => clearTimeout(timer);
  }, [visible, autoDismissMs, onClose]);

  // Handle click to dismiss
  const handleClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle native event to mark as UI interaction
  const handleNativeEvent = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      const nativeEvent = e.nativeEvent as PointerEvent & {
        isCoreUI?: boolean;
      };
      nativeEvent.isCoreUI = true;
      e.stopPropagation();
    },
    [],
  );

  if (!visible) return null;

  // Styles
  const overlayStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex,
    pointerEvents: "auto",
    cursor: "pointer",
  };

  const containerStyle: CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: zIndex + 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: `${theme.spacing.xl}px ${theme.spacing.xxl}px`,
    background: `linear-gradient(180deg, ${theme.colors.background.secondary} 0%, ${theme.colors.background.primary} 100%)`,
    border: `2px solid ${colors.primary}`,
    borderRadius: theme.borderRadius.lg,
    minWidth: 280,
    maxWidth: 400,
    overflow: "visible",
    animation: isAnimating ? "hs-achievement-fadeIn 0.3s ease-out" : undefined,
    boxShadow: `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow.replace("0.4", "0.2")}, ${theme.shadows.xl}`,
    ["--glow-color" as string]: colors.glow,
    ...style,
  };

  const iconStyle: CSSProperties = {
    fontSize: 64,
    lineHeight: 1,
    animation: "hs-achievement-iconBounce 1s ease-in-out infinite",
    filter: `drop-shadow(0 0 10px ${colors.glow})`,
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.primary,
    textShadow: `0 0 10px ${colors.glow}, 2px 2px 4px rgba(0, 0, 0, 0.8)`,
    textAlign: "center",
    margin: 0,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.primary,
    textShadow: "1px 1px 2px rgba(0, 0, 0, 0.8)",
    textAlign: "center",
    margin: 0,
  };

  const badgeStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    background: colors.badgeBg,
    padding: `${theme.spacing.sm}px ${theme.spacing.xl}px`,
    borderRadius: theme.borderRadius.md,
    border: `2px solid ${colors.badgeBorder}`,
    boxShadow: `0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
    textShadow: "1px 1px 2px rgba(0, 0, 0, 0.5)",
  };

  const hintStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.muted,
    marginTop: theme.spacing.sm,
    fontStyle: "italic",
  };

  return (
    <>
      <div
        style={overlayStyle}
        onClick={handleClick}
        onMouseDown={handleNativeEvent}
        onPointerDown={handleNativeEvent}
        role="presentation"
      />
      <div
        style={containerStyle}
        onClick={handleClick}
        onMouseDown={handleNativeEvent}
        onPointerDown={handleNativeEvent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-title"
      >
        {effectiveCelebrationType === "simple" && (
          <CelebrationEffect color={colors.primary} />
        )}
        {effectiveCelebrationType === "fireworks" && (
          <FireworksEffect colors={[colors.primary, colors.badgeBorder]} />
        )}

        {icon && <div style={iconStyle}>{icon}</div>}

        <h2 id="achievement-title" style={titleStyle}>
          {title}
        </h2>

        {subtitle && <p style={subtitleStyle}>{subtitle}</p>}

        {badge && <div style={badgeStyle}>{badge}</div>}

        {children}

        {showDismissHint && <div style={hintStyle}>{dismissHintText}</div>}
      </div>
    </>
  );
});

export default AchievementPopup;
