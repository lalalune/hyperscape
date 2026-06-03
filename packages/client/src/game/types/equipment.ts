/**
 * Equipment Types
 *
 * Type definitions for equipment data structures used in the UI layer.
 * These types represent the raw format received from the server network cache.
 *
 * @packageDocumentation
 */

import type { Item } from "@hyperforge/shared";

/** Raw equipment slot format from server network cache */
export type RawEquipmentSlot = { item: Item | null; itemId?: string } | null;

/** Raw equipment data structure from server network cache */
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

/** Equipment slot names for iteration */
export const EQUIPMENT_SLOT_NAMES = [
  "weapon",
  "shield",
  "helmet",
  "body",
  "legs",
  "boots",
  "gloves",
  "cape",
  "amulet",
  "ring",
  "arrows",
] as const;

/** Type for equipment slot name */
export type EquipmentSlotName = (typeof EQUIPMENT_SLOT_NAMES)[number];
