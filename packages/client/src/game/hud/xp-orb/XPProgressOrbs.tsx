/**
 * XPProgressOrbs - RuneLite-style XP progress orbs
 *
 * Circular progress indicators at top of screen:
 * - One orb per active skill
 * - Progress ring shows XP to next level
 * - Skill icon in center
 * - Hover tooltip with detailed XP info
 * - Level-up celebration animation
 * - Fade-out animation after inactivity
 *
 * Extracted from XPProgressOrb for Single Responsibility Principle (SRP)
 */

import React, { useMemo } from "react";
import { useThemeStore } from "@/ui";
import { ORB_FADE_DURATION_MS } from "./useXPOrbState";
import type { SkillWithProgress } from "./useXPOrbState";
import { HUD_FRAME, HUD_LAYERS } from "../layout";

// Animation keyframes as CSS string for injection
const keyframesStyle = `
@keyframes levelUpCelebration {
  0% { transform: scale(1); filter: brightness(1); }
  25% { transform: scale(1.3); filter: brightness(1.5); }
  50% { transform: scale(1.1); filter: brightness(1.2); }
  100% { transform: scale(1); filter: brightness(1); }
}

@keyframes fadeOutAnimation {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.8); }
}
`;

// Inject keyframes once
if (typeof document !== "undefined") {
  const styleId = "xp-orb-keyframes";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = keyframesStyle;
    document.head.appendChild(style);
  }
}

interface XPProgressOrbsProps {
  skills: SkillWithProgress[];
  levelUpSkill: string | null;
  hoveredSkill: string | null;
  onHoverSkill: (skill: string | null) => void;
}

export function XPProgressOrbs({
  skills,
  levelUpSkill,
  hoveredSkill,
  onHoverSkill,
}: XPProgressOrbsProps) {
  const theme = useThemeStore((s) => s.theme);

  // Memoize styles to avoid recalculating on every render
  const styles = useMemo(
    () => ({
      orbsRow: {
        position: "fixed" as const,
        top: HUD_FRAME.topCenterOffset,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: HUD_LAYERS.floating,
        display: "flex",
        flexDirection: "row" as const,
        alignItems: "flex-start",
        gap: theme.spacing.md,
        pointerEvents: "none" as const,
        padding: "6px 12px",
        borderRadius: theme.borderRadius.full,
        background:
          theme.name === "hyperia"
            ? "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.012) 28%, rgba(0,0,0,0.1) 100%), rgba(15, 18, 24, 0.44)"
            : "transparent",
        boxShadow:
          theme.name === "hyperia"
            ? "0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "none",
        backdropFilter: theme.name === "hyperia" ? "blur(6px)" : undefined,
        WebkitBackdropFilter:
          theme.name === "hyperia" ? "blur(6px)" : undefined,
      },
      singleOrbContainer: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        pointerEvents: "none" as const,
      },
      orbWrapper: {
        position: "relative" as const,
        width: 64,
        height: 64,
        pointerEvents: "auto" as const,
        cursor: "pointer",
      },
      progressRing: {
        transform: "rotate(-90deg)",
        width: "100%",
        height: "100%",
      },
      skillIcon: {
        position: "absolute" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontSize: 24,
        lineHeight: 1,
        textShadow: `0 0 10px ${theme.colors.accent.secondary}80`,
      },
      tooltip: {
        position: "absolute" as const,
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginTop: theme.spacing.sm,
        background: theme.colors.background.primary,
        border: `1px solid ${theme.colors.accent.primary}`,
        borderRadius: theme.borderRadius.md,
        padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
        whiteSpace: "nowrap" as const,
        zIndex: theme.zIndex.tooltip,
        pointerEvents: "none" as const,
        boxShadow: theme.shadows.lg,
        color: theme.colors.text.primary,
        fontSize: theme.typography.fontSize.xs,
        fontFamily: theme.typography.fontFamily.body,
        lineHeight: theme.typography.lineHeight.normal,
      },
      tooltipRow: {
        display: "flex",
        justifyContent: "space-between",
        gap: theme.spacing.lg,
      },
      tooltipLabel: {
        color: theme.colors.text.muted,
      },
      tooltipValue: {
        color: theme.colors.accent.primary,
        fontWeight: theme.typography.fontWeight.bold,
      },
    }),
    [theme],
  );

  if (skills.length === 0) {
    return null;
  }

  return (
    <div style={styles.orbsRow}>
      {skills.map((skill) => {
        const isThisLevelUp = levelUpSkill === skill.skillKey;
        const isHovered = hoveredSkill === skill.skillKey;

        // Calculate stroke dasharray for progress
        const circumference = 2 * Math.PI * 27;
        const filled = (circumference * skill.progress) / 100;
        const strokeDasharray = `${filled} ${circumference}`;

        return (
          <div
            key={`orb-${skill.skillKey}`}
            style={{
              ...styles.singleOrbContainer,
              animation: skill.isFading
                ? `fadeOutAnimation ${ORB_FADE_DURATION_MS}ms ease-out forwards`
                : undefined,
            }}
          >
            <div
              style={{
                ...styles.orbWrapper,
                animation: isThisLevelUp
                  ? "levelUpCelebration 0.6s ease-out"
                  : undefined,
              }}
              onMouseEnter={() => onHoverSkill(skill.skillKey)}
              onMouseLeave={() => onHoverSkill(null)}
            >
              <svg viewBox="0 0 64 64" style={styles.progressRing}>
                {/* Background circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  fill="rgba(0, 0, 0, 0.7)"
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth={3}
                />
                {/* Progress circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  fill="none"
                  stroke={theme.colors.accent.secondary}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={strokeDasharray}
                  style={{ transition: "stroke-dasharray 0.3s ease" }}
                />
              </svg>
              <div style={styles.skillIcon}>{skill.icon}</div>

              {/* Hover tooltip for this specific skill */}
              {isHovered && (
                <div style={styles.tooltip}>
                  <div style={styles.tooltipRow}>
                    <span style={styles.tooltipLabel}>Level:</span>
                    <span style={styles.tooltipValue}>{skill.level}</span>
                  </div>
                  <div style={styles.tooltipRow}>
                    <span style={styles.tooltipLabel}>Current XP:</span>
                    <span style={styles.tooltipValue}>
                      {Math.floor(skill.xp).toLocaleString()}
                    </span>
                  </div>
                  <div style={styles.tooltipRow}>
                    <span style={styles.tooltipLabel}>XP to level:</span>
                    <span style={styles.tooltipValue}>
                      {Math.floor(skill.xpToLevel).toLocaleString()}
                    </span>
                  </div>
                  <div style={styles.tooltipRow}>
                    <span style={styles.tooltipLabel}>Progress:</span>
                    <span style={styles.tooltipValue}>
                      {skill.progress.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
