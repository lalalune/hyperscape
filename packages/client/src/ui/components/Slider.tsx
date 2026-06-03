/**
 * Slider - Reusable slider component for range settings
 * Hyperia UI theme styling with gold accent colors
 */

import React from "react";
import { useThemeStore } from "@/ui";

export interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  /** Custom value formatter for display (e.g., "50%" or "1.5x") */
  formatValue?: (value: number) => string;
  /** Optional icon to display before the label */
  icon?: string;
}

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled = false,
  formatValue,
  icon,
}: SliderProps) {
  const theme = useThemeStore((s) => s.theme);

  // Guard against division by zero when min === max
  const percentage =
    max > min
      ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
      : 0;

  /**
   * Display value formatting.
   * If formatValue is provided, use it for custom display (e.g., "1.5x", "High").
   * Otherwise, compute percentage relative to (value - min) / (max - min) for non-normalized ranges.
   *
   * @param formatValue - Supply a custom formatter when:
   *   - The value has special units (e.g., "1.5x" for multipliers)
   *   - The value should display as something other than percentage
   *   - The range is non-linear or needs special formatting
   */
  const displayValue = formatValue
    ? formatValue(value)
    : `${Math.round(percentage)}%`;

  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-[12px]">{icon}</span>}
          <span
            className="text-[10px]"
            style={{ color: theme.colors.text.secondary }}
          >
            {label}
          </span>
        </div>
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 rounded"
          style={{
            background: theme.colors.background.tertiary,
            border: `1px solid ${theme.colors.border.default}`,
            color: theme.colors.accent.primary,
          }}
        >
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
        className="w-full h-1.5 rounded-full appearance-none slider-thumb"
        style={{
          background: `linear-gradient(to right, ${theme.colors.accent.primary} 0%, ${theme.colors.accent.primary} ${percentage}%, ${theme.colors.background.tertiary} ${percentage}%, ${theme.colors.background.tertiary} 100%)`,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
      {/* Cross-browser thumb styling - inline styles for self-contained component */}
      <style>{`
        .slider-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${theme.colors.accent.primary};
          border: 2px solid ${theme.colors.border.decorative};
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .slider-thumb::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 8px ${theme.colors.accent.primary}66;
        }
        .slider-thumb::-webkit-slider-thumb:active {
          transform: scale(0.95);
        }
        .slider-thumb:focus::-webkit-slider-thumb {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 0 3px ${theme.colors.accent.primary}66;
        }
        .slider-thumb:disabled::-webkit-slider-thumb {
          background: ${theme.colors.text.disabled};
          cursor: not-allowed;
          transform: none;
        }
        .slider-thumb::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${theme.colors.accent.primary};
          border: 2px solid ${theme.colors.border.decorative};
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .slider-thumb::-moz-range-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 8px ${theme.colors.accent.primary}66;
        }
        .slider-thumb:disabled::-moz-range-thumb {
          background: ${theme.colors.text.disabled};
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
