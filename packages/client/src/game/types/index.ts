/**
 * Game Types
 *
 * Barrel export for game-specific type definitions.
 *
 * @packageDocumentation
 */

// Equipment types
export type {
  RawEquipmentSlot,
  RawEquipmentData,
  EquipmentSlotName,
} from "./equipment";
export { EQUIPMENT_SLOT_NAMES } from "./equipment";

// UI types
export type { InventorySlotViewItem, StatusValue, PanelState } from "./ui";

// Network event types
export { NetworkEvents } from "./events";
export type { NetworkEventName } from "./events";
