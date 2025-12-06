/**
 * Interaction System Types
 *
 * Centralized type definitions for the interaction system.
 * All interaction-related types are defined here to ensure consistency
 * across handlers, services, and the router.
 */

import type { Entity } from "../../../entities/Entity";
import type { Position3D } from "../../../types/core/base-types";

/**
 * Entity types that can be interacted with
 */
export type InteractableEntityType =
  | "item"
  | "npc"
  | "mob"
  | "resource"
  | "bank"
  | "player"
  | "corpse"
  | "headstone";

/**
 * Result of raycasting to find entity at screen position
 */
export interface RaycastTarget {
  /** Entity instance ID */
  entityId: string;
  /** Type of entity for handler routing */
  entityType: InteractableEntityType;
  /** Reference to the entity */
  entity: Entity;
  /** Display name */
  name: string;
  /** Entity center position (world coordinates) */
  position: Position3D;
  /** Actual click location on entity mesh (for large entities) */
  hitPoint: Position3D;
  /** Distance from camera to hit point */
  distance: number;
}

/**
 * A queued action waiting to execute when player reaches target
 *
 * Used by ActionQueueService for reliable walk-then-act behavior.
 * Replaces the unreliable setTimeout pattern.
 */
export interface QueuedAction {
  /** Unique action ID for tracking */
  id: string;
  /** Target entity ID */
  targetId: string;
  /** Cached target position (updated each frame for moving targets) */
  targetPosition: Position3D;
  /** Required range in tiles (0 = same tile, 1 = adjacent, etc.) */
  requiredRange: number;
  /** Callback when player reaches range */
  onExecute: () => void;
  /** Optional callback if action is cancelled */
  onCancel?: () => void;
  /** Frame count when action was queued (for timeout) */
  queuedAtFrame: number;
  /** Max frames to wait before auto-cancel (default: 600 = ~10 seconds at 60fps) */
  maxWaitFrames: number;
}

/**
 * Context menu action definition
 *
 * Returned by handlers to build context menus.
 * Priority determines position in menu (lower = higher).
 */
export interface ContextMenuAction {
  /** Unique action ID */
  id: string;
  /** Display label (e.g., "Attack Goblin (Lv3)") */
  label: string;
  /** Optional emoji icon */
  icon?: string;
  /** Whether action can be executed (greyed out if false) */
  enabled: boolean;
  /** Menu position (lower = higher in menu, e.g., 1 = top, 100 = bottom) */
  priority: number;
  /** Action handler function */
  handler: () => void;
}

/**
 * Click type for input routing
 */
export type ClickType = "left" | "right" | "long-press";

/**
 * Input event passed from InteractionRouter to handlers
 */
export interface InteractionInputEvent {
  /** Type of click that triggered the interaction */
  clickType: ClickType;
  /** Screen X coordinate */
  screenX: number;
  /** Screen Y coordinate */
  screenY: number;
  /** Raycast result (null if clicked empty space) */
  target: RaycastTarget | null;
  /** Whether shift key was held */
  shiftKey: boolean;
}

/**
 * Parameters for queueing an action
 */
export interface QueueActionParams {
  /** Target entity ID */
  targetId: string;
  /** Target position for distance checking */
  targetPosition: Position3D;
  /** Required range in tiles */
  requiredRange: number;
  /** Callback when player reaches range */
  onExecute: () => void;
  /** Optional callback if action is cancelled */
  onCancel?: () => void;
  /** Optional max frames to wait (default from constants) */
  maxWaitFrames?: number;
}
