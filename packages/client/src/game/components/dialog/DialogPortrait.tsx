/**
 * DialogPortrait Component
 *
 * NPC portrait display with mood/emotion support.
 * Displays different expressions based on the current mood.
 *
 * @packageDocumentation
 */

import React, { memo, type CSSProperties, type ReactNode } from "react";
import { useTheme } from "@/ui";
import type { DialogMood } from "@/game/systems";

// ============================================================================
// Types
// ============================================================================

/** Portrait source configuration */
export interface PortraitSource {
  /** Base portrait URL (used when no mood-specific image available) */
  default: string;
  /** Mood-specific portrait URLs */
  moods?: Partial<Record<DialogMood, string>>;
}

/** Props for DialogPortrait component */
export interface DialogPortraitProps {
  /** Portrait source - can be URL string or source config with moods */
  source: string | PortraitSource;
  /** Current mood/emotion */
  mood?: DialogMood;
  /** NPC name (for alt text) */
  name?: string;
  /** Size in pixels */
  size?: number;
  /** Whether to show mood indicator badge */
  showMoodIndicator?: boolean;
  /** Custom fallback when image fails to load */
  fallback?: ReactNode;
  /** Whether portrait is speaking (shows animation) */
  isSpeaking?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

// ============================================================================
// Component
// ============================================================================

/** Mood emoji indicators */
const MOOD_INDICATORS: Record<DialogMood, string> = {
  neutral: "",
  happy: "",
  sad: "",
  angry: "",
  surprised: "",
  thinking: "",
  worried: "",
  laughing: "",
  confused: "",
  serious: "",
};

/** Mood border colors */
const MOOD_COLORS: Partial<Record<DialogMood, string>> = {
  happy: "#4ade80",
  sad: "#60a5fa",
  angry: "#f87171",
  surprised: "#fbbf24",
  worried: "#818cf8",
  laughing: "#34d399",
};

/**
 * NPC portrait component with mood support
 *
 * @example
 * ```tsx
 * // Simple usage with single image
 * <DialogPortrait
 *   source="/portraits/npc_guard.png"
 *   name="Town Guard"
 *   mood="neutral"
 * />
 *
 * // With mood-specific images
 * <DialogPortrait
 *   source={{
 *     default: "/portraits/npc_guard.png",
 *     moods: {
 *       happy: "/portraits/npc_guard_happy.png",
 *       angry: "/portraits/npc_guard_angry.png",
 *     }
 *   }}
 *   name="Town Guard"
 *   mood={dialog.state.mood}
 *   showMoodIndicator
 *   isSpeaking={!dialog.state.isTypingComplete}
 * />
 * ```
 */
export const DialogPortrait = memo(function DialogPortrait({
  source,
  mood = "neutral",
  name = "NPC",
  size = 80,
  showMoodIndicator = false,
  fallback,
  isSpeaking = false,
  className,
  style,
}: DialogPortraitProps): React.ReactElement {
  const theme = useTheme();
  const [hasError, setHasError] = React.useState(false);

  // Determine the portrait URL
  const getPortraitUrl = (): string => {
    if (typeof source === "string") {
      return source;
    }
    return source.moods?.[mood] || source.default;
  };

  const portraitUrl = getPortraitUrl();

  // Reset error state when URL changes
  React.useEffect(() => {
    setHasError(false);
  }, [portraitUrl]);

  // Get mood-based border color
  const getMoodBorderColor = (): string => {
    return MOOD_COLORS[mood] || theme.colors.border.decorative;
  };

  // Container style
  const containerStyle: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    borderRadius: theme.borderRadius.md,
    border: `2px solid ${getMoodBorderColor()}`,
    overflow: "hidden",
    backgroundColor: theme.colors.background.tertiary,
    boxShadow:
      theme.name === "hyperia"
        ? `0 0 10px ${getMoodBorderColor()}40`
        : theme.shadows.sm,
    transition: theme.transitions.normal,
    ...style,
  };

  // Image style
  const imageStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transition: theme.transitions.normal,
    // Subtle scale animation when speaking
    transform: isSpeaking ? "scale(1.02)" : "scale(1)",
  };

  // Speaking animation style
  const speakingOverlayStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    border: `2px solid ${theme.colors.accent.primary}`,
    borderRadius: theme.borderRadius.md,
    animation: isSpeaking ? "speaking-pulse 1s ease-in-out infinite" : "none",
    pointerEvents: "none",
  };

  // Mood indicator style
  const moodIndicatorStyle: CSSProperties = {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: "50%",
    backgroundColor: theme.colors.background.primary,
    border: `2px solid ${getMoodBorderColor()}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    zIndex: 1,
  };

  // Fallback style
  const fallbackStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background.tertiary,
    color: theme.colors.text.muted,
    fontSize: size * 0.4,
    fontWeight: theme.typography.fontWeight.bold,
    textTransform: "uppercase",
  };

  // Get initials for fallback
  const getInitials = (): string => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2);
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Keyframe animation */}
      <style>{`
        @keyframes speaking-pulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
      `}</style>

      {/* Portrait image or fallback */}
      {hasError || !portraitUrl ? (
        fallback || <div style={fallbackStyle}>{getInitials()}</div>
      ) : (
        <img
          src={portraitUrl}
          alt={`${name} portrait`}
          style={imageStyle}
          onError={() => setHasError(true)}
          draggable={false}
        />
      )}

      {/* Speaking animation overlay */}
      {isSpeaking && <div style={speakingOverlayStyle} />}

      {/* Mood indicator badge */}
      {showMoodIndicator && mood !== "neutral" && (
        <div style={moodIndicatorStyle} title={mood}>
          {MOOD_INDICATORS[mood]}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Portrait Frame Variants
// ============================================================================

/** Props for PortraitFrame component */
export interface PortraitFrameProps {
  /** Child content (typically DialogPortrait) */
  children: ReactNode;
  /** Frame variant */
  variant?: "simple" | "ornate" | "gold" | "silver" | "bronze";
  /** Size in pixels */
  size?: number;
  /** Whether the portrait is highlighted (important NPC) */
  highlighted?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Decorative frame for portraits
 *
 * @example
 * ```tsx
 * <PortraitFrame variant="gold" highlighted>
 *   <DialogPortrait source="/portraits/king.png" name="King Roald" />
 * </PortraitFrame>
 * ```
 */
export const PortraitFrame = memo(function PortraitFrame({
  children,
  variant = "simple",
  size = 80,
  highlighted = false,
  className,
  style,
}: PortraitFrameProps): React.ReactElement {
  const theme = useTheme();

  // Frame colors by variant
  const frameColors: Record<string, { border: string; glow: string }> = {
    simple: {
      border: theme.colors.border.default,
      glow: "transparent",
    },
    ornate: {
      border: theme.colors.border.decorative,
      glow: "rgba(139, 90, 43, 0.3)",
    },
    gold: {
      border: "#c9a54a",
      glow: "rgba(201, 165, 74, 0.4)",
    },
    silver: {
      border: "#a8a8a8",
      glow: "rgba(168, 168, 168, 0.3)",
    },
    bronze: {
      border: "#8b5a2b",
      glow: "rgba(139, 90, 43, 0.4)",
    },
  };

  const colors = frameColors[variant] || frameColors.simple;

  const frameStyle: CSSProperties = {
    position: "relative",
    width: size + 16,
    height: size + 16,
    padding: 8,
    borderRadius: theme.borderRadius.lg,
    border: `3px solid ${colors.border}`,
    boxShadow: highlighted
      ? `0 0 20px ${colors.glow}, inset 0 0 10px ${colors.glow}`
      : `0 0 10px ${colors.glow}`,
    backgroundColor: theme.colors.background.secondary,
    ...style,
  };

  // Corner decorations for ornate frame
  const renderCornerDecorations = () => {
    if (variant !== "ornate" && variant !== "gold") return null;

    const cornerStyle: CSSProperties = {
      position: "absolute",
      width: 8,
      height: 8,
      borderColor: colors.border,
      borderStyle: "solid",
    };

    return (
      <>
        <div
          style={{
            ...cornerStyle,
            top: -1,
            left: -1,
            borderWidth: "2px 0 0 2px",
          }}
        />
        <div
          style={{
            ...cornerStyle,
            top: -1,
            right: -1,
            borderWidth: "2px 2px 0 0",
          }}
        />
        <div
          style={{
            ...cornerStyle,
            bottom: -1,
            left: -1,
            borderWidth: "0 0 2px 2px",
          }}
        />
        <div
          style={{
            ...cornerStyle,
            bottom: -1,
            right: -1,
            borderWidth: "0 2px 2px 0",
          }}
        />
      </>
    );
  };

  return (
    <div className={className} style={frameStyle}>
      {renderCornerDecorations()}
      {children}
    </div>
  );
});

export default DialogPortrait;
