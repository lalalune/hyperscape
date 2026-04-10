/**
 * Special Attack Bar
 *
 * OSRS-style special attack energy bar with clickable toggle.
 * When toggled ON (amber glow), the next auto-attack will be a special.
 * Energy drains on use and recharges 10% every 30 seconds.
 */

import React from "react";
import { getPanelInsetStyle } from "@/ui/theme/themes";
import type { SpecialAttackBarProps } from "./types";

/** Special attack energy bar with toggle button */
export const SpecialAttackBar = React.memo(function SpecialAttackBar({
  specialEnergy,
  isActive,
  onToggle,
  theme,
  compactPanel,
}: SpecialAttackBarProps) {
  // Display as 0-100% (server sends 0-1000 internal units)
  const energyPercent = Math.min(
    100,
    Math.max(0, Math.round(specialEnergy / 10)),
  );
  const hasEnough = energyPercent >= 25;

  return (
    <button
      onClick={onToggle}
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
        cursor: hasEnough ? "pointer" : "not-allowed",
        opacity: hasEnough ? 1 : 0.6,
        border: isActive
          ? "1px solid #f59e0b"
          : `1px solid ${theme.colors.border.default}30`,
        boxShadow: isActive ? "0 0 6px rgba(245, 158, 11, 0.4)" : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
        width: "100%",
        background: "transparent",
      }}
    >
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill={isActive ? "#f59e0b" : "none"}
        stroke={isActive || hasEnough ? "#f59e0b" : theme.colors.text.muted}
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
              background: isActive
                ? "linear-gradient(180deg, #fde68a, #f59e0b)"
                : hasEnough
                  ? "linear-gradient(180deg, #fbbf24, #f59e0b)"
                  : "linear-gradient(180deg, #6b7280, #4b5563)",
            }}
          />
        </div>
      </div>
      <span
        style={{
          fontSize: "10px",
          color: isActive || hasEnough ? "#f59e0b" : theme.colors.text.muted,
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
          color: isActive ? "#f59e0b" : theme.colors.text.muted,
          fontWeight: 600,
        }}
      >
        {isActive ? "Spec ON" : "Spec"}
      </span>
    </button>
  );
});
