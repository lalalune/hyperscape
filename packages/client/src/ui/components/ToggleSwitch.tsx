/**
 * ToggleSwitch - Reusable toggle switch component for boolean settings
 * Hyperia UI theme styling with gold/brown colors
 */

import React from "react";
import { useThemeStore } from "@/ui";

/** Toggle switch sizing constants */
const TRACK_PADDING = 2; // px - padding inside the track (top-0.5 = 2px in Tailwind)
const KNOB_SIZE = 12; // px - diameter of the knob (w-3 h-3 = 12px)
// Note: Track height is 16px (h-4 in Tailwind), using class-based approach

export interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({
  label,
  checked,
  onChange,
  disabled = false,
}: ToggleSwitchProps) {
  const theme = useThemeStore((s) => s.theme);
  const isActive = checked && !disabled;

  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
      style={{
        background: theme.colors.background.tertiary,
        border: `1px solid ${theme.colors.border.default}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="text-[10px]"
        style={{ color: theme.colors.text.secondary }}
      >
        {label}
      </span>
      <div
        className="w-8 h-4 rounded-full relative transition-all"
        style={{
          background: isActive
            ? `${theme.colors.state.success}4d`
            : "rgba(60, 60, 60, 0.5)",
          border: isActive
            ? `1px solid ${theme.colors.state.success}80`
            : "1px solid rgba(100, 100, 100, 0.3)",
        }}
      >
        <div
          className="absolute w-3 h-3 rounded-full transition-all"
          style={{
            // Using TRACK_PADDING for vertical offset to maintain single source of truth
            // (replaces Tailwind's top-0.5 which equals 2px)
            top: `${TRACK_PADDING}px`,
            background: isActive ? theme.colors.state.success : "#6b7280",
            left: isActive
              ? `calc(100% - ${KNOB_SIZE}px - ${TRACK_PADDING}px)`
              : `${TRACK_PADDING}px`,
          }}
        />
      </div>
    </button>
  );
}
