/**
 * Interaction System
 *
 * Production-quality interaction handling for OSRS-style gameplay.
 *
 * This module provides a complete replacement for the legacy InteractionSystem:
 * - Frame-based action queue (replaces unreliable setTimeout)
 * - Single raycast implementation (consolidates duplicated code)
 * - Focused handler classes (one per entity type)
 * - Visual feedback service (markers, indicators)
 * - Context menu controller (DOM event integration)
 * - Interaction router (slim coordinator)
 *
 * File structure:
 * - types.ts: All type definitions
 * - constants.ts: All magic numbers centralized
 * - services/: ActionQueueService, RaycastService, VisualFeedbackService
 * - handlers/: BaseInteractionHandler + entity-specific handlers
 * - ContextMenuController.ts: Menu display logic
 * - InteractionRouter.ts: Main coordinator system
 */

// Types
export type {
  InteractableEntityType,
  RaycastTarget,
  QueuedAction,
  ContextMenuAction,
  ClickType,
  InteractionInputEvent,
  QueueActionParams,
} from "./types";

// Constants
export {
  INTERACTION_RANGE,
  TIMING,
  VISUAL,
  INPUT,
  ACTION_QUEUE,
} from "./constants";

// Services
export { ActionQueueService } from "./services/ActionQueueService";
export { RaycastService } from "./services/RaycastService";
export { VisualFeedbackService } from "./services/VisualFeedbackService";

// Handlers
export { BaseInteractionHandler } from "./handlers/BaseInteractionHandler";
export type { QueueInteractionParams } from "./handlers/BaseInteractionHandler";
export { ItemInteractionHandler } from "./handlers/ItemInteractionHandler";
export { NPCInteractionHandler } from "./handlers/NPCInteractionHandler";
export { MobInteractionHandler } from "./handlers/MobInteractionHandler";
export { ResourceInteractionHandler } from "./handlers/ResourceInteractionHandler";
export { BankInteractionHandler } from "./handlers/BankInteractionHandler";
export { CorpseInteractionHandler } from "./handlers/CorpseInteractionHandler";
export { PlayerInteractionHandler } from "./handlers/PlayerInteractionHandler";

// Controllers
export { ContextMenuController } from "./ContextMenuController";

// Main system
export { InteractionRouter } from "./InteractionRouter";
