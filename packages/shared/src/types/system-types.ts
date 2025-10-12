/**
 * Core World type extensions that reference actual system implementations
 * 
 * These interfaces define debug and monitoring information for various systems.
 * Used for system introspection and performance monitoring.
 */

import type { Position3D, MobAIStateType } from './core';

/**
 * Internal system types
 * 
 * These types represent internal interfaces for systems that are accessed
 * polymorphically across different UI components and need consistent typing.
 */

import type { BankItem, InventorySlotItem, StoreItem, Item } from './core';

/**
 * Internal banking system interface
 */
export interface BankingSystem {
  playerBanks: Map<string, Map<string, { items: BankItem[] }>>;
}

/**
 * Internal inventory system interface
 */
export interface InventorySystem {
  playerInventories: Map<string, { items: InventorySlotItem[]; coins: number }>;
}

/**
 * Internal store system interface
 */
export interface StoreSystem {
  stores: Map<string, { items: StoreItem[] }>;
}

/**
 * Internal equipment system interface
 */
export interface EquipmentSystem {
  playerEquipment: Map<string, Record<string, { item: Item | null; itemId: number | null }>>;
}

// System-specific debug info interfaces
export interface MobAISystemInfo {
  activeMobs: number;
  mobStates: number;
  stateDistribution: Record<MobAIStateType, number>;
  totalCombatTargets: number;
}

export interface ItemPickupSystemInfo {
  totalGroundItems: number;
  itemsByType: Record<string, number>;
  oldestItem: {
    itemId: string;
    position: Position3D;
    droppedAt: number;
  } | null;
  newestItem: {
    itemId: string;
    position: Position3D;
    droppedAt: number;
  } | null;
}

export interface NPCSystemInfo {
  bankAccounts: number;
  totalTransactions: number;
  storeItems: number;
  recentTransactions: Array<{
    timestamp: number;
    type: 'buy' | 'sell' | 'bank_deposit' | 'bank_withdraw';
    playerId: string;
    itemId: string | null;
    quantity: number;
    amount: number;
  }>;
}

export interface PlayerSpawnSystemInfo {
  totalSpawnedPlayers: number;
  playersWithEquipment: number;
  playersWithAggro: number;
  starterEquipmentItems: number;
  playerSpawnData: Record<string, {
    hasStarterEquipment: boolean;
    aggroTriggered: boolean;
    spawnTime: number;
    position: Position3D;
  }>;
}

