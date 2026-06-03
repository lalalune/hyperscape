/**
 * ActionBarPanel - Utility functions
 */

import { getSkillIcon } from "@hyperforge/shared";
import { gameUI, parseTokenToNumber } from "../../../constants";
import { getItemIcon } from "../../../utils/itemUtils";
import type { ActionBarSlotContent } from "./types";

// Action bar configuration from design tokens
export const {
  minSlots: MIN_SLOT_COUNT,
  maxSlots: MAX_SLOT_COUNT,
  defaultSlots: DEFAULT_SLOT_COUNT,
  slotSize: SLOT_SIZE_TOKEN,
  slotGap: SLOT_GAP_TOKEN,
  padding: PADDING_TOKEN,
  controlButtonSize: CONTROL_BUTTON_SIZE_TOKEN,
} = gameUI.actionBar;

// Parse token values to numbers for calculations
export const SLOT_SIZE = parseTokenToNumber(SLOT_SIZE_TOKEN); // 36
export const SLOT_GAP = parseTokenToNumber(SLOT_GAP_TOKEN); // 3
export const PADDING = parseTokenToNumber(PADDING_TOKEN); // 4
export const CONTROL_BUTTON_SIZE = parseTokenToNumber(
  CONTROL_BUTTON_SIZE_TOKEN,
); // 20
export const CONTROL_BUTTON_GAP = 4; // Gap between control button and slots
export const SLOTS_CONTAINER_BORDER = 2; // 1px border on each side of slots container

// Default keyboard shortcuts for up to 12 slots (RS3-style: 1-9, 0, -, =)
export const DEFAULT_KEYBOARD_SHORTCUTS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
  "-",
  "=",
];

// Storage keys
export const getStorageKey = (barId: number) => `actionbar-slots-${barId}`;
export const getSlotCountKey = (barId: number) =>
  `actionbar-slotcount-${barId}`;
export const getLockStorageKey = (barId: number) => `actionbar-locked-${barId}`;

/** Calculate dimensions for horizontal layout (slotCount x 1) based on visible controls */
export function calcHorizontalDimensions(
  slotCount: number,
  options: {
    isEditMode?: boolean;
    isLocked?: boolean;
  } = {},
): { width: number; height: number } {
  const { isEditMode = false, isLocked = false } = options;

  // Slots grid width: slots + gaps + padding + border (1px each side)
  const slotsWidth =
    slotCount * SLOT_SIZE +
    (slotCount - 1) * SLOT_GAP +
    PADDING * 2 +
    SLOTS_CONTAINER_BORDER;

  // Left side: - button only in edit mode
  const leftWidth = isEditMode ? CONTROL_BUTTON_SIZE + CONTROL_BUTTON_GAP : 0;

  // Right side: rubbish bin (only when unlocked) + lock button + (+ button only in edit mode)
  const rubbishWidth = !isLocked ? SLOT_SIZE + CONTROL_BUTTON_GAP : 0;
  const lockWidth = CONTROL_BUTTON_SIZE;
  const plusWidth = isEditMode ? CONTROL_BUTTON_GAP + CONTROL_BUTTON_SIZE : 0;
  // Add trailing gap after the rightmost button to prevent clipping
  const trailingGap = CONTROL_BUTTON_GAP;
  const rightWidth = rubbishWidth + lockWidth + plusWidth + trailingGap;

  // Total width with gap between sections
  const totalGap =
    (leftWidth > 0 ? CONTROL_BUTTON_GAP : 0) + CONTROL_BUTTON_GAP;

  return {
    width: leftWidth + slotsWidth + totalGap + rightWidth,
    height: SLOT_SIZE + PADDING * 2,
  };
}

/** Calculate dimensions for vertical layout (1 x slotCount) - compact, no controls */
export function calcVerticalDimensions(
  slotCount: number,
  options: {
    showControls?: boolean;
  } = {},
): { width: number; height: number } {
  const { showControls = false } = options;

  // Slots grid height: slots + gaps + padding
  const slotsHeight =
    slotCount * SLOT_SIZE + (slotCount - 1) * SLOT_GAP + PADDING * 2;

  // Control buttons at bottom (lock only for vertical)
  const controlsHeight = showControls
    ? CONTROL_BUTTON_SIZE + CONTROL_BUTTON_GAP
    : 0;

  return {
    width: SLOT_SIZE + PADDING * 2,
    height: slotsHeight + controlsHeight,
  };
}

// Default dimensions based on default slot count (7) - locked state (most common)
const defaultDims = calcHorizontalDimensions(DEFAULT_SLOT_COUNT, {
  isLocked: true,
});
export const HORIZONTAL_WIDTH = defaultDims.width;
export const HORIZONTAL_HEIGHT = defaultDims.height;

// Maximum size: 9-slot horizontal layout with all controls visible (edit mode, unlocked)
const maxHorizontalDims = calcHorizontalDimensions(MAX_SLOT_COUNT, {
  isEditMode: true,
  isLocked: false,
});
export const MAX_WIDTH = maxHorizontalDims.width;
export const MAX_HEIGHT = maxHorizontalDims.height;

// Minimum size: smallest valid layout (4-slot horizontal) - locked state
const minHorizontalDims = calcHorizontalDimensions(MIN_SLOT_COUNT, {
  isLocked: true,
});
// Add buffer for borders (1px each side = 2px) and box-shadow visual expansion
export const BORDER_BUFFER = 4;
export const MIN_WIDTH = minHorizontalDims.width + BORDER_BUFFER;
export const MIN_HEIGHT = minHorizontalDims.height + BORDER_BUFFER;

/** Export dimensions for window configuration */
export const ACTION_BAR_DIMENSIONS = {
  // Minimum size (4-slot horizontal)
  minWidth: MIN_WIDTH,
  minHeight: MIN_HEIGHT,
  // Maximum size (9-slot horizontal)
  maxWidth: MAX_WIDTH,
  maxHeight: MAX_HEIGHT,
  // Default to horizontal layout (all 7 in a row)
  defaultWidth: HORIZONTAL_WIDTH,
  defaultHeight: HORIZONTAL_HEIGHT,
  // Slot count configuration
  minSlotCount: MIN_SLOT_COUNT,
  maxSlotCount: MAX_SLOT_COUNT,
  defaultSlotCount: DEFAULT_SLOT_COUNT,
  slotSize: SLOT_SIZE,
  slotGap: SLOT_GAP,
  padding: PADDING,
  controlButtonSize: CONTROL_BUTTON_SIZE,
};

// Create empty slots array
export function createEmptySlots(slotCount: number): ActionBarSlotContent[] {
  return Array.from({ length: slotCount }, (_, i) => ({
    type: "empty" as const,
    id: `empty-${i}`,
  }));
}

/**
 * Get icon for an action bar slot
 *
 * Uses centralized icon functions from itemUtils and shared skill-icons
 * to ensure consistency across all panels.
 */
export function getSlotIcon(slot: ActionBarSlotContent): string {
  // Use custom icon if provided
  if (slot.icon) return slot.icon;
  if (slot.type === "empty") return "";

  // Items - use centralized getItemIcon for consistency with inventory/bank panels
  if (slot.type === "item" && slot.itemId) {
    return getItemIcon(slot.itemId);
  }

  // Skills - use shared getSkillIcon for consistency with skills panel
  if (slot.type === "skill" && slot.skillId) {
    return getSkillIcon(slot.skillId);
  }

  // Spells
  if (slot.type === "spell") return "✨";

  // Prayers - use custom icon if provided, otherwise default
  if (slot.type === "prayer") return slot.icon || "🙏";

  // Combat styles
  if (slot.type === "combatstyle" && slot.combatStyleId) {
    const styleId = slot.combatStyleId.toLowerCase();
    if (styleId === "accurate") return "🎯";
    if (styleId === "aggressive") return "⚔️";
    if (styleId === "defensive") return "🛡️";
    if (styleId === "controlled") return "⚖️";
    return "⚔️";
  }

  return "?";
}

// Load slot count from localStorage
export function loadSlotCount(barId: number): number {
  if (typeof window === "undefined") return DEFAULT_SLOT_COUNT;
  try {
    const saved = localStorage.getItem(getSlotCountKey(barId));
    if (saved) {
      const count = parseInt(saved, 10);
      if (count >= MIN_SLOT_COUNT && count <= MAX_SLOT_COUNT) {
        return count;
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(
        "[ActionBar] Failed to load slot count from localStorage:",
        error,
      );
    }
  }
  return DEFAULT_SLOT_COUNT;
}

// Save slot count to localStorage
export function saveSlotCount(barId: number, count: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getSlotCountKey(barId), String(count));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(
        "[ActionBar] Failed to save slot count to localStorage:",
        error,
      );
    }
  }
}

// Load slots from localStorage
export function loadSlots(
  barId: number,
  slotCount: number,
): ActionBarSlotContent[] {
  if (typeof window === "undefined") return createEmptySlots(slotCount);
  try {
    const saved = localStorage.getItem(getStorageKey(barId));
    if (saved) {
      const parsed = JSON.parse(saved) as ActionBarSlotContent[];
      // Ensure we have exactly slotCount slots
      while (parsed.length < slotCount) {
        parsed.push({ type: "empty", id: `empty-${parsed.length}` });
      }
      return parsed.slice(0, slotCount);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(
        "[ActionBar] Failed to load slots from localStorage:",
        error,
      );
    }
  }
  return createEmptySlots(slotCount);
}

// Save slots to localStorage (local cache)
export function saveSlots(barId: number, slots: ActionBarSlotContent[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(barId), JSON.stringify(slots));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[ActionBar] Failed to save slots to localStorage:", error);
    }
  }
}

// Load lock state from localStorage
export function loadLockState(barId: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = localStorage.getItem(getLockStorageKey(barId));
    return saved === "true";
  } catch {
    return false;
  }
}

// Save lock state to localStorage
export function saveLockState(barId: number, locked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getLockStorageKey(barId), String(locked));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Format a keybind string for compact display on action bar slots
 *
 * Converts modifier combinations to abbreviated symbols:
 * - "Ctrl+1" -> "^1"
 * - "Shift+2" -> "⇧2"
 * - "Alt+3" -> "⌥3"
 *
 * Simple keys are returned as-is.
 */
export function formatKeybindForDisplay(keybind: string): string {
  // Keep simple keys as-is
  if (!keybind.includes("+")) return keybind;

  // Abbreviate modifiers for compact display
  return keybind
    .replace("Ctrl+", "^")
    .replace("Shift+", "⇧")
    .replace("Alt+", "⌥");
}
