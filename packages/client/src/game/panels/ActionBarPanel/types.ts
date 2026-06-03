/**
 * ActionBarPanel - Type definitions
 */

import type { ClientWorld } from "../../../types";

// Re-export shared types for backward compatibility
export type {
  ActionBarSlotContent,
  ActionBarSlotUpdatePayload,
  ActionBarSlotSwapPayload,
} from "@hyperforge/shared";

// Import for local use
import type { ActionBarSlotContent } from "@hyperforge/shared";

// ============================================================================
// Event Payload Types (for proper type safety instead of unknown)
// ============================================================================

/** Payload for prayer state sync events */
export interface PrayerStateSyncEventPayload {
  playerId: string;
  active: string[];
}

/** Payload for prayer toggled events */
export interface PrayerToggledEventPayload {
  playerId: string;
  prayerId: string;
  active: boolean;
}

/** Payload for attack style update events */
export interface AttackStyleUpdateEventPayload {
  playerId: string;
  style: string;
}

/** Payload for attack style changed events */
export interface AttackStyleChangedEventPayload {
  playerId: string;
  newStyle: string;
}

/** Payload for action bar state from server */
export interface ActionBarStatePayload {
  barId: number;
  slotCount: number;
  slots: ActionBarSlotContent[];
}

/** Extended network interface with attack style cache */
export interface ActionBarNetworkExtensions {
  lastAttackStyleByPlayerId?: Record<string, string>;
}

// ============================================================================
// Core Types
// ============================================================================

export interface ActionBarPanelProps {
  world: ClientWorld;
  barId?: number; // 0-4 for multiple action bars
  /** Whether edit mode is unlocked (shows +/- controls) */
  isEditMode?: boolean;
  /** Window ID for dynamic minSize updates */
  windowId?: string;
  /** When true, uses parent DndProvider context (for cross-panel drag-drop) */
  useParentDndContext?: boolean;
  /** Layout orientation - horizontal (default) or vertical */
  orientation?: "horizontal" | "vertical";
  /** Whether to show keyboard shortcuts on slots (default: true) */
  showShortcuts?: boolean;
  /** Whether to show control buttons (+/-, lock) (default: true) */
  showControls?: boolean;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  styledLabel: Array<{ text: string; color?: string }>;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  targetSlot: ActionBarSlotContent | null;
  targetIndex: number;
}

/** Drag data from inventory */
export interface InventoryDragData {
  slot?: ActionBarSlotContent;
  slotIndex?: number;
  source?: string;
  item?: {
    itemId: string;
    quantity: number;
    slot: number;
  };
  prayer?: {
    id: string;
    name: string;
    icon: string;
    level: number;
  };
  skill?: {
    id: string;
    name: string;
    icon: string;
    level: number;
  };
  combatStyle?: {
    id: string;
    label: string;
    color: string;
  };
}

/** Drop target data */
export interface DropTargetData {
  slotIndex?: number;
  target?: string;
}
