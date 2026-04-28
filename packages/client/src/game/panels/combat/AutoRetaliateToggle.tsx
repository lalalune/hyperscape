/**
 * Auto-Retaliate Toggle
 *
 * Renders the auto-retaliate on/off button with OSRS-style toggle indicator.
 */

import React from "react";
import { getInteractiveTileStyle } from "@/ui/theme/themes";
import { PANEL_PADDING } from "../../../constants/panelLayout";
import type { AutoRetaliateToggleProps } from "./types";

/** Auto-retaliate toggle button with on/off indicator */
export const AutoRetaliateToggle = React.memo(function AutoRetaliateToggle({
  enabled,
  onToggle,
  theme,
}: AutoRetaliateToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={enabled}
      className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/50"
      style={{
        padding: `${PANEL_PADDING}px 6px`,
        cursor: "pointer",
        transition: "all 0.1s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        touchAction: "manipulation",
        borderRadius: 4,
        ...getInteractiveTileStyle(theme, {
          active: enabled,
          radius: 4,
          accentColor: enabled
            ? theme.colors.state.success
            : theme.colors.accent.secondary,
        }),
        color: enabled ? theme.colors.state.success : theme.colors.text.muted,
        flexShrink: 0,
      }}
    >
      <div className="flex items-center gap-2">
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke={enabled ? "#22c55e" : theme.colors.text.muted}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {enabled ? (
            <>
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </>
          )}
        </svg>
        <span
          style={{
            fontWeight: 600,
            color: theme.colors.text.primary,
            fontSize: "10px",
            lineHeight: 1,
          }}
        >
          Auto-retaliate
        </span>
      </div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "1px",
          padding: "1px",
          borderRadius: "4px",
          fontSize: "9px",
          fontWeight: 700,
          background: "rgba(0,0,0,0.18)",
          border: `1px solid ${theme.colors.border.default}30`,
        }}
      >
        <span
          style={{
            padding: "2px 6px",
            borderRadius: "3px",
            background: enabled ? "rgba(34, 197, 94, 0.18)" : "transparent",
            color: enabled ? "#22c55e" : theme.colors.text.muted,
          }}
        >
          On
        </span>
        <span
          style={{
            padding: "2px 6px",
            borderRadius: "3px",
            background: !enabled ? "rgba(239, 68, 68, 0.12)" : "transparent",
            color: !enabled ? "#ef4444" : theme.colors.text.muted,
          }}
        >
          Off
        </span>
      </span>
    </button>
  );
});
