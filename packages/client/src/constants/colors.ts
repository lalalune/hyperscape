/**
 * Color Constants
 *
 * Centralized color definitions for the UI theme.
 */

export const COLORS = {
  // Primary theme colors
  ACCENT: "#f2d08a", // Gold/tan accent
  CHAT_ACCENT: "#f7d98c", // Chat-specific accent

  // Background colors
  BG_PRIMARY: "rgba(20, 15, 10, 0.75)",
  BG_SECONDARY: "rgba(15, 10, 5, 0.85)",
  BG_TERTIARY: "rgba(30, 20, 10, 0.9)",

  // Border colors
  BORDER_PRIMARY: "rgba(139, 69, 19, 0.6)",
  BORDER_SECONDARY: "rgba(139, 69, 19, 0.3)",

  // Text colors
  TEXT_PRIMARY: "rgba(232, 235, 244, 0.92)",
  TEXT_SECONDARY: "rgba(232, 235, 244, 0.75)",
  TEXT_MUTED: "rgba(205, 212, 230, 0.5)",

  // Status colors
  SUCCESS: "#22c55e",
  ERROR: "#dc2626",
  WARNING: "#fbbf24",
  INFO: "#3b82f6",
} as const;

export const GRADIENTS = {
  PANEL:
    "linear-gradient(135deg, rgba(20, 15, 10, 0.75) 0%, rgba(15, 10, 5, 0.85) 50%, rgba(20, 15, 10, 0.75) 100%)",
  HEADER:
    "linear-gradient(180deg, rgba(30, 20, 10, 0.9) 0%, rgba(20, 15, 10, 0.7) 100%)",
  BUTTON:
    "linear-gradient(135deg, rgba(139, 69, 19, 0.9) 0%, rgba(101, 50, 15, 0.95) 100%)",
  DIVIDER:
    "linear-gradient(90deg, rgba(242,208,138,0), rgba(242,208,138,0.4) 14%, rgba(255,215,128,0.95) 50%, rgba(242,208,138,0.4) 86%, rgba(242,208,138,0))",
} as const;
