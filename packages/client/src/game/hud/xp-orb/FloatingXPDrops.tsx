/**
 * FloatingXPDrops - Floating XP numbers that rise toward orbs
 *
 * RS3-style visual feedback:
 * - Gold text with skill icons
 * - Multiple skills grouped into single floating element (game tick grouping)
 * - Float-up animation with fade-out
 *
 * Extracted from XPProgressOrb for Single Responsibility Principle (SRP)
 */

import React, { useMemo } from "react";
import { useThemeStore } from "@/ui";
import { SKILL_ICONS } from "@hyperforge/shared";
import type { GroupedXPDrop } from "./useXPOrbState";
import { HUD_FRAME, HUD_LAYERS } from "../layout";

// Animation keyframes as CSS string for injection
const keyframesStyle = `
@keyframes floatUpAnimation {
  0% {
    opacity: 1;
    transform: translate(-50%, 132px) scale(0.98);
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, 0) scale(1);
  }
}
`;

// Inject keyframes once
if (typeof document !== "undefined") {
  const styleId = "floating-xp-keyframes";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = keyframesStyle;
    document.head.appendChild(style);
  }
}

interface FloatingXPDropsProps {
  drops: GroupedXPDrop[];
}

export function FloatingXPDrops({ drops }: FloatingXPDropsProps) {
  const theme = useThemeStore((s) => s.theme);

  // Memoize styles to avoid recalculating on every render
  const styles = useMemo(
    () => ({
      floatingXP: {
        position: "fixed" as const,
        left: "50%",
        top: HUD_FRAME.topCenterSecondaryOffset,
        transform: "translate(-50%, 132px)",
        zIndex: HUD_LAYERS.floating,
        pointerEvents: "none" as const,
        animation: "floatUpAnimation 1.5s ease-out forwards",
        display: "flex",
        alignItems: "center",
        gap: 2,
        color: theme.colors.accent.secondary,
        fontSize: 20,
        fontWeight: theme.typography.fontWeight.bold,
        textShadow: `-1px -1px 0 #000,
          1px -1px 0 #000,
          -1px 1px 0 #000,
          1px 1px 0 #000,
          0 0 8px rgba(0, 0, 0, 0.8)`,
        whiteSpace: "nowrap" as const,
      },
      floatingXPIcons: {
        display: "flex",
        alignItems: "center",
        gap: 1,
        fontSize: 18,
      },
      floatingXPAmount: {
        marginLeft: 4,
      },
    }),
    [theme],
  );

  if (drops.length === 0) {
    return null;
  }

  return (
    <>
      {drops.map((drop) => (
        <div key={drop.id} style={styles.floatingXP}>
          <span style={styles.floatingXPIcons}>
            {drop.skills.map((s, i) => {
              const dropIcon = SKILL_ICONS[s.skill.toLowerCase()] || "\u2B50";
              return <span key={`${drop.id}-${s.skill}-${i}`}>{dropIcon}</span>;
            })}
          </span>
          <span style={styles.floatingXPAmount}>
            +{Math.floor(drop.totalAmount)}
          </span>
        </div>
      ))}
    </>
  );
}
