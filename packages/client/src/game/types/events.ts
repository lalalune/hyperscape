/**
 * Network Event Names
 *
 * Canonical event name constants for server→client network events
 * used by UI components to subscribe to game state changes.
 *
 * @packageDocumentation
 */

/** Network event names for UI interactions */
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
  CRAFTING_CLOSE: "craftingClose",
  TANNING_CLOSE: "tanningClose",
  FLETCHING_CLOSE: "fletchingClose",
  QUEST_START_SCREEN: "questStartScreen",
  QUEST_COMPLETE_SCREEN: "questCompleteScreen",
  XP_LAMP_USE: "xpLampUse",
  DUEL_ERROR: "duelError",
} as const;

export type NetworkEventName =
  (typeof NetworkEvents)[keyof typeof NetworkEvents];
