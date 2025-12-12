/**
 * inventory-types.ts - Strong Inventory Type Definitions
 *
 * Type-safe inventory structures and operations.
 */

/**
 * Inventory item as stored in the inventory system
 */
export interface InventoryItemData {
  itemId: string;
  quantity: number;
  slot: number;
}

/**
 * Full inventory data structure
 */
export interface InventoryData {
  items: InventoryItemData[];
  coins: number;
  maxSlots: number;
}

/**
 * Inventory system data interface
 */
export interface InventorySystemData {
  getInventoryData(playerId: string): InventoryData;
  getItemQuantity?(playerId: string, itemId: string): number;
  isFull?(playerId: string): boolean;
  hasItem?(playerId: string, itemId: string, quantity?: number): boolean;
  getCoins?(playerId: string): number;
}

/**
 * Type guard to check if items array has proper structure
 */
export function isInventoryItemData(item: unknown): item is InventoryItemData {
  return (
    typeof item === "object" &&
    item !== null &&
    "itemId" in item &&
    "quantity" in item &&
    "slot" in item
  );
}
