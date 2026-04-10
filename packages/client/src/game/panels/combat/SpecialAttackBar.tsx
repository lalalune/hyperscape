/**
 * Special Attack Bar
 *
 * Displays the special attack energy bar with fill indicator.
 * OSRS-style special attack energy (0-100%) with themed styling.
 */

import React from "react";
import { getPanelInsetStyle } from "@/ui/theme/themes";
import type { SpecialAttackBarProps } from "./types";

/** Special attack energy bar with percentage fill */
export function SpecialAttackBar({
  specialEnergy,
  theme,
  compactPanel,
}: SpecialAttackBarProps) {
  const energyPercent = Math.min(100, Math.max(0, specialEnergy));
  const hasEnough = energyPercent >= 25;

  return (
    <div
      style={{
        ...getPanelInsetStyle(theme, {
          emphasis: "normal",
          radius: 4,
          padding: `${compactPanel ? 4 : 6}px`,
        }),
        display: "flex",
        alignItems: "center",
        gap: "6px",
        flexShrink: 0,
      }}
    >
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke={hasEnough ? "#f59e0b" : theme.colors.text.muted}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: "100%",
            height: "5px",
            background: theme.colors.background.panelPrimary,
            borderRadius: 3,
            overflow: "hidden",
            border: `1px solid ${theme.colors.border.default}30`,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${energyPercent}%`,
              borderRadius: 3,
              transition: "width 0.3s ease",
              background: hasEnough
                ? "linear-gradient(180deg, #fbbf24, #f59e0b)"
                : "linear-gradient(180deg, #6b7280, #4b5563)",
            }}
          />
        </div>
      </div>
      <span
        style={{
          fontSize: "10px",
          color: hasEnough ? "#f59e0b" : theme.colors.text.muted,
          fontWeight: 700,
          fontFamily: "var(--font-mono, monospace)",
          whiteSpace: "nowrap",
        }}
      >
        {energyPercent}%
      </span>
      <span
        style={{
          fontSize: "9px",
          color: theme.colors.text.muted,
          fontWeight: 600,
        }}
      >
        Spec
      </span>
    </div>
  );
}
