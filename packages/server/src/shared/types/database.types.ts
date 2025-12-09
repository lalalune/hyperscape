/**
 * Database Types - Database row types and persistence interfaces
 *
 * Contains TypeScript types for database operations, row structures,
 * and persistence-related data models. These types match the Drizzle
 * schema structure defined in database/schema.ts.
 *
 * **Type Categories**:
 * - Database row types (PlayerRow, ItemRow, etc.)
 * - Save operation types (InventorySaveItem, EquipmentSaveItem)
 * - Database system interfaces
 *
 * **Referenced by**: DatabaseSystem, repositories, save managers
 */

// Re-export database utilities from shared
export { dbHelpers, isDatabaseInstance } from "@hyperscape/shared";
export type { SystemDatabase } from "@hyperscape/shared";

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================
// These types match the structure of rows returned from Drizzle queries.
// They correspond to the tables defined in database/schema.ts.

/**
 * Player data row from the characters table
 *
 * Contains all persistent character data including stats, position, and progress.
 * Used by DatabaseSystem for loading/saving player state.
 */
export interface PlayerRow {
  playerId: string;
  id: string;
  accountId: string;
  name: string;
  combatLevel: number;
  attackLevel: number;
  strengthLevel: number;
  defenseLevel: number;
  constitutionLevel: number;
  rangedLevel: number;
  woodcuttingLevel: number;
  fishingLevel: number;
  firemakingLevel: number;
  cookingLevel: number;
  attackXp: number;
  strengthXp: number;
  defenseXp: number;
  constitutionXp: number;
  rangedXp: number;
  woodcuttingXp: number;
  fishingXp: number;
  firemakingXp: number;
  cookingXp: number;
  health: number;
  maxHealth: number;
  coins: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  attackStyle?: string; // Combat style preference (accurate, aggressive, defensive)
  createdAt: number;
  lastLogin: number;
}

/** World item row (dropped items, resource nodes) */
export interface ItemRow {
  id: string;
  chunkX: number;
  chunkZ: number;
  itemId: string;
  quantity: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  createdAt: number;
}

/** Inventory item row - items in player's 28-slot inventory */
export interface InventoryRow {
  playerId: string;
  itemId: string;
  quantity: number;
  slotIndex: number;
  metadata: string | null;
}

/** Equipment item row - items equipped in player's equipment slots */
export interface EquipmentRow {
  playerId: string;
  slotType: string;
  itemId: string | null;
  quantity: number;
}

/** Player session tracking row */
export interface PlayerSessionRow {
  id: string;
  sessionId: string;
  playerId: string;
  sessionStart: number;
  sessionEnd: number | null;
  playtimeMinutes: number;
  lastActivity: number;
  reason: string | null;
}

/** World chunk persistence row */
export interface WorldChunkRow {
  chunkX: number;
  chunkZ: number;
  data: string;
  lastActive: number;
  playerCount: number;
  needsReset: number;
}

// ============================================================================
// SAVE OPERATION TYPES
// ============================================================================

/** Inventory save data - for savePlayerInventoryAsync() */
export interface InventorySaveItem {
  itemId: string;
  quantity: number;
  slotIndex: number | null;
  metadata: Record<string, unknown> | null;
}

/** Equipment save data - for savePlayerEquipmentAsync() */
export interface EquipmentSaveItem {
  slotType: string;
  itemId: string | null;
  quantity: number;
}

// ============================================================================
// DATABASE SYSTEM INTERFACES
// ============================================================================

/**
 * Database system operation signatures
 *
 * Defines the async methods available on DatabaseSystem for
 * querying and persisting game data.
 */
export interface DatabaseSystemOperations {
  getPlayerInventoryAsync?: (playerId: string) => Promise<
    Array<{
      itemId: string | number;
      quantity: number;
      slotIndex: number | null;
    }>
  >;
  getPlayerEquipmentAsync?: (playerId: string) => Promise<EquipmentRow[]>;
  getPlayerAsync?: (playerId: string) => Promise<{ coins?: number } | null>;
}
