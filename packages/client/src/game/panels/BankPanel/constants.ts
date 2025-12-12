/**
 * BankPanel Constants
 *
 * All layout dimensions, theme values, and magic numbers.
 */

// ============================================================================
// LAYOUT DIMENSIONS
// ============================================================================

export const BANK_SLOTS_PER_ROW = 10;
export const BANK_VISIBLE_ROWS = 8;
export const BANK_SLOT_SIZE = 42; // Comfortable slot size
export const BANK_GAP = 8; // gap-2 = 0.5rem = 8px
export const BANK_SCROLL_HEIGHT =
  BANK_VISIBLE_ROWS * (BANK_SLOT_SIZE + BANK_GAP); // slot + gap

export const INV_SLOTS_PER_ROW = 4;
export const INV_ROWS = 7;
export const INV_SLOT_SIZE = 40;

// ============================================================================
// MAGIC INDICES
// ============================================================================

/** Special slot index for the "append zone" at end of grid */
export const SLOT_INDEX_APPEND_ZONE = -100;

/** Hover state when dragging over the "+" new tab button */
export const TAB_INDEX_NEW_TAB_HOVER = -2;

/** "All" tab view - shows items from all tabs */
export const TAB_INDEX_ALL = -1;

// ============================================================================
// PERFORMANCE
// ============================================================================

/** Drag state update throttle interval (60fps = 16.67ms) */
export const DRAG_THROTTLE_MS = 16;

// ============================================================================
// THEME
// ============================================================================

/** Hyperscape Black & Gold Theme */
export const BANK_THEME = Object.freeze({
  // Panel backgrounds - deep black with slight warmth
  PANEL_BG: "rgba(15, 12, 8, 0.98)",
  PANEL_BG_DARK: "rgba(10, 8, 5, 0.98)",
  PANEL_BORDER: "rgba(139, 69, 19, 0.7)",
  PANEL_BORDER_LIGHT: "rgba(242, 208, 138, 0.3)",

  // Item slot colors - dark with gold accents
  SLOT_BG: "rgba(20, 15, 10, 0.9)",
  SLOT_BG_HOVER: "rgba(40, 30, 20, 0.9)",
  SLOT_BORDER: "rgba(242, 208, 138, 0.25)",
  SLOT_BORDER_HIGHLIGHT: "rgba(242, 208, 138, 0.5)",

  // Tab colors
  TAB_BG: "rgba(30, 25, 18, 0.9)",
  TAB_BG_SELECTED: "rgba(139, 69, 19, 0.6)",
  TAB_BORDER: "rgba(139, 69, 19, 0.5)",

  // Text colors - gold theme with OSRS quantity colors
  TEXT_GOLD: "#f2d08a", // Primary gold
  TEXT_GOLD_DIM: "rgba(242, 208, 138, 0.7)",
  TEXT_YELLOW: "#ffff00", // Quantity < 100K
  TEXT_WHITE: "#ffffff", // Quantity 100K - 9.99M
  TEXT_GREEN: "#00ff80", // Quantity 10M+

  // Button colors
  BUTTON_BG: "rgba(139, 69, 19, 0.5)",
  BUTTON_BG_HOVER: "rgba(139, 69, 19, 0.7)",
});

// ============================================================================
// SCROLLBAR STYLES (injected via <style> tag)
// ============================================================================

export const BANK_SCROLLBAR_STYLES = `
  .bank-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .bank-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }
  .bank-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(139, 69, 19, 0.6);
    border-radius: 4px;
  }
  .bank-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(139, 69, 19, 0.8);
  }
`;
