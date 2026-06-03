/**
 * Equipment Utilities
 *
 * Shared utilities for processing equipment data.
 *
 * @packageDocumentation
 */

import { getItem } from "@hyperforge/shared";
import type { PlayerEquipmentItems } from "@hyperforge/shared";
import type { RawEquipmentData } from "../types";

/**
 * Process raw equipment data from the server into PlayerEquipmentItems.
 *
 * Handles both cases:
 * - slotData.item exists (full item object)
 * - slotData.itemId exists (need to lookup via getItem)
 *
 * @param rawEquipment - Raw equipment data from server/network cache
 * @returns Processed equipment items for UI display
 */
export function processRawEquipment(
  rawEquipment: RawEquipmentData,
): PlayerEquipmentItems {
  const processedEquipment: PlayerEquipmentItems = {
    weapon: null,
    shield: null,
    helmet: null,
    body: null,
    legs: null,
    boots: null,
    gloves: null,
    cape: null,
    amulet: null,
    ring: null,
    arrows: null,
  };

  for (const [slot, slotData] of Object.entries(rawEquipment)) {
    if (slotData?.item) {
      // Copy item and include quantity from slot data (for stackable items like arrows)
      const item = { ...slotData.item };
      if (slotData.quantity !== undefined && slotData.quantity > 1) {
        item.quantity = slotData.quantity;
      }
      processedEquipment[slot as keyof PlayerEquipmentItems] = item;
    } else if (slotData?.itemId) {
      const baseItem = getItem(slotData.itemId);
      if (baseItem) {
        // Copy item and include quantity from slot data (for stackable items like arrows)
        const item = { ...baseItem };
        if (slotData.quantity !== undefined && slotData.quantity > 1) {
          item.quantity = slotData.quantity;
        }
        processedEquipment[slot as keyof PlayerEquipmentItems] = item;
      }
    }
  }

  return processedEquipment;
}
