/**
 * UI Constants
 *
 * Layout dimensions, spacing, and UI configuration.
 */

export const UI = {
  // Z-Index layers
  Z_INDEX: {
    BACKDROP: 999,
    CHAT_COLLAPSED: 35,
    CHAT_EXPANDED: 960,
    MODAL: 1000,
    TOOLTIP: 1100,
  },

  // Fonts
  FONTS: {
    HEADER: "'Cinzel', serif",
    CHAT: "'Inter', system-ui, sans-serif",
    BODY: "'Inter', system-ui, sans-serif",
  },

  // Breakpoints
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1280,
  },

  // Spacing
  SPACING: {
    SAFE_AREA_INSET: "env(safe-area-inset-bottom)",
  },
} as const;
