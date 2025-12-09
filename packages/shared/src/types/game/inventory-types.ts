/**
 * Inventory and Equipment Types
 * All inventory, equipment, banking, and item storage related type definitions
 */

import THREE from "../../extras/three/three";
import type { Position3D } from "../core/base-types";
import type {
  Item,
  EquipmentSlotName,
  StoreItemCategory,
  EquipmentSlot,
  Equipment,
  InventorySlotItem,
  StoreItem,
  Store,
  BankItem,
  StartingItem,
  LevelRequirement,
  EquipmentDataJSON,
  StarterEquipmentItem,
  ItemAction,
  ItemContextMenu,
  GroundItem,
} from "../game/item-types";
import type {
  Skills,
  InventoryItem,
  InventoryComponent,
  EquipmentComponent,
  Inventory,
  InventoryDataState,
} from "../entities/entity-types";
import type {
  PlayerInventory,
  PlayerInventoryState,
  PlayerBankStorage,
  PlayerEquipment,
} from "../entities/player-types";

// Re-export types from item-types.ts for convenience
export type {
  EquipmentSlot,
  Equipment,
  InventorySlotItem,
  StoreItem,
  Store,
  BankItem,
  StartingItem,
  LevelRequirement,
  EquipmentDataJSON,
  StarterEquipmentItem,
  ItemAction,
  ItemContextMenu,
  GroundItem,
};

// Re-export ECS component types from entity-types.ts
export type {
  InventoryItem,
  InventoryComponent,
  EquipmentComponent,
  Inventory,
  InventoryDataState,
};

// Re-export player-related inventory types from player-types.ts
export type {
  PlayerInventory,
  PlayerInventoryState,
  PlayerBankStorage,
  PlayerEquipment,
};

// ============== INVENTORY TYPES ==============
// Note: Most inventory types are defined in entity-types.ts, item-types.ts, or player-types.ts and re-exported above

// ============== EQUIPMENT TYPES ==============
// Note: Equipment types are defined in entity-types.ts, item-types.ts, and player-types.ts and re-exported above

// ============== BANKING TYPES ==============
// Note: BankItem is defined in item-types.ts and re-exported above

/**
 * Bank data structure
 */
export interface BankData {
  items: BankItem[];
  maxSlots: number; // Unlimited per GDD, but we'll use a high number
}

/**
 * Bank entity data - represents a bank in the world
 */
export interface BankEntityData {
  id: string;
  name: string;
  location: {
    zone: string;
    position: { x: number; y: number; z: number };
  };
  isShared: boolean; // Per GDD: Each bank is separate (no shared storage)
  maxSlots: number; // Unlimited per GDD
  description: string;
}

/**
 * Simple bank interface
 */
export interface Bank {
  id: string;
  name: string;
  position: Position3D;
  capacity: number;
}

// PlayerBankStorage is defined in player-types.ts and re-exported above

/**
 * Bank transaction
 */
export interface BankTransaction {
  type: "bank_deposit" | "bank_withdraw";
  itemId: string;
  quantity: number;
  playerId: string;
  timestamp: number;
}

/**
 * Bank open event data
 */
export interface BankOpenData {
  playerId: string;
  bankId: string;
  playerPosition: Position3D;
}

/**
 * Bank close event data
 */
export interface BankCloseData {
  playerId: string;
  bankId: string;
}

/**
 * Bank deposit event data
 */
export interface BankDepositData {
  playerId: string;
  itemId: string;
  quantity: number;
  slotIndex: number;
}

/**
 * Bank withdraw event data
 */
export interface BankWithdrawData {
  playerId: string;
  itemId: string;
  quantity: number;
  slotIndex: number;
}

/**
 * Bank deposit all event data
 */
export interface BankDepositAllData {
  playerId: string;
}

// ============== STORE TYPES ==============
// Note: StoreItem and Store are defined in item-types.ts and re-exported above

/**
 * Store data - represents a store definition (abstract, no position)
 * Position comes from the shopkeeper NPC that references this store via storeId
 */
export interface StoreData {
  id: string;
  name: string;
  /** @deprecated Stores are abstract - position comes from the NPC entity */
  location?: {
    zone: string;
    position: { x: number; y: number; z: number };
  };
  items: StoreItem[];
  buyback: boolean; // Whether store buys items from players
  buybackRate: number; // Percentage of item value (0-1)
  description: string;
}

/**
 * Store transaction
 */
export interface StoreTransaction {
  type: "buy" | "sell";
  itemId: string;
  quantity: number;
  totalPrice: number;
  playerId: string;
  timestamp: number;
}

// ============== ITEM INTERACTION TYPES ==============
// Note: ItemAction, ItemContextMenu are defined in item-types.ts and re-exported above

/**
 * Drag data for inventory/equipment drag and drop
 */
export interface DragData {
  sourceType: "inventory" | "equipment" | "ground";
  sourceSlot: number;
  itemId: string;
  itemData: Item;
  dragElement?: HTMLElement;
  originalPosition?: { x: number; y: number };
}

/**
 * Drop target for drag and drop
 */
export interface DropTarget {
  type: "inventory" | "equipment";
  slot: number | string;
  element: HTMLElement;
  accepts: string[]; // Item types this slot accepts
}

// ============== GROUND ITEM TYPES ==============
// Note: GroundItem is defined in item-types.ts and re-exported above

// ============== LOOT TYPES ==============

/**
 * Loot drop - single item drop
 */
export interface LootDrop {
  itemId: string;
  quantity: number;
  weight?: number;
  rarity?: "common" | "uncommon" | "rare" | "very_rare";
  rare?: boolean;
}

/**
 * Loot entry - entry in a loot table
 */
export interface LootEntry {
  itemId: string;
  quantity: number;
  chance: number;
  rarity?: "common" | "uncommon" | "rare" | "very_rare";
  weight?: number;
}

/**
 * Loot table - defines what items an entity drops
 */
export interface LootTable {
  id: string;
  mobType: string; // Mob ID from mobs.json
  guaranteedDrops: LootEntry[];
  commonDrops: LootEntry[];
  uncommonDrops: LootEntry[];
  rareDrops: LootEntry[];
  drops?: Item[];
  rareDropTable?: boolean;
}

// ============== UI STATE TYPES ==============

/**
 * Player UI state (player-specific UI data)
 * Note: Different from UISystemState which is system-level state
 */
export interface PlayerUIState {
  playerId: string;
  health: { current: number; max: number };
  skills: Skills;
  inventory: Inventory;
  equipment: Equipment;
  combatLevel: number;
  inCombat: boolean;
  minimapData: { position: Position3D };
}
