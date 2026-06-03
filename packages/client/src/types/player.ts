/**
 * Player State Types
 *
 * Shared type definitions for player state management.
 * Used by InterfaceManager, MobileInterfaceManager, and related hooks.
 *
 * @packageDocumentation
 */

import type { Item } from "@hyperforge/shared";

/**
 * Raw equipment slot format from server network cache
 */
export type RawEquipmentSlot = {
  item: Item | null;
  itemId?: string;
  quantity?: number; // For stackable items like arrows
} | null;

/**
 * Raw equipment data structure from server network cache
 */
export type RawEquipmentData = {
  weapon?: RawEquipmentSlot;
  shield?: RawEquipmentSlot;
  helmet?: RawEquipmentSlot;
  body?: RawEquipmentSlot;
  legs?: RawEquipmentSlot;
  boots?: RawEquipmentSlot;
  gloves?: RawEquipmentSlot;
  cape?: RawEquipmentSlot;
  amulet?: RawEquipmentSlot;
  ring?: RawEquipmentSlot;
  arrows?: RawEquipmentSlot;
};

/**
 * Inventory slot view item (simplified for UI display)
 */
export type InventorySlotViewItem = {
  slot: number;
  itemId: string;
  quantity: number;
};

/**
 * Network event names for UI interactions
 */
export const NetworkEvents = {
  INVENTORY_UPDATE: "inventoryUpdate",
  EQUIPMENT_UPDATE: "equipmentUpdate",
  STATS_UPDATE: "statsUpdate",
  BANK_OPEN: "bankOpen",
  BANK_CLOSE: "bankClose",
  STORE_OPEN: "storeOpen",
  STORE_CLOSE: "storeClose",
  DIALOGUE_START: "dialogueStart",
  DIALOGUE_END: "dialogueEnd",
  SMELTING_OPEN: "smeltingOpen",
  SMELTING_CLOSE: "smeltingClose",
  SMITHING_OPEN: "smithingOpen",
  SMITHING_CLOSE: "smithingClose",
  QUEST_START_SCREEN: "questStartScreen",
  QUEST_COMPLETE_SCREEN: "questCompleteScreen",
  XP_LAMP_USE: "xpLampUse",
} as const;

export type NetworkEventName =
  (typeof NetworkEvents)[keyof typeof NetworkEvents];
