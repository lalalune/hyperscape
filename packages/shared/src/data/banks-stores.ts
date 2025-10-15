/**
 * Banks and Stores - Data-Driven Implementation
 * 
 * ALL bank and store data is loaded from JSON manifests at runtime by DataManager.
 * This keeps commerce definitions data-driven and separate from code.
 * 
 * Data loaded from:
 * - assets/manifests/banks.json
 * - assets/manifests/stores.json
 * 
 * To modify banks or stores:
 * 1. Edit the appropriate JSON file
 * 2. Restart server to reload manifests
 * 
 * DO NOT add bank/store data here - keep it in JSON!
 */

import type {
  BankEntityData,
  StoreData,
} from '../types/core';

/**
 * Banking System - Populated from JSON manifests
 * DataManager loads from assets/manifests/banks.json
 */
export const BANKS: Record<string, BankEntityData> = {};

/**
 * General Store System - Populated from JSON manifests
 * DataManager loads from assets/manifests/stores.json
 */
export const GENERAL_STORES: Record<string, StoreData> = {};

/**
 * Helper Functions
 */
export function getBankById(bankId: string): BankEntityData | null {
  return BANKS[bankId] || null;
}

export function getBanksByZone(zoneId: string): BankEntityData[] {
  return Object.values(BANKS).filter(bank => bank.location.zone === zoneId);
}

export function getAllBanks(): BankEntityData[] {
  return Object.values(BANKS);
}

export function getStoreById(storeId: string): StoreData | null {
  return GENERAL_STORES[storeId] || null;
}

export function getStoresByZone(zoneId: string): StoreData[] {
  return Object.values(GENERAL_STORES).filter(store => store.location.zone === zoneId);
}

export function getAllStores(): StoreData[] {
  return Object.values(GENERAL_STORES);
}

export function getStoreItemPrice(storeId: string, itemId: string): number {
  const store = getStoreById(storeId);
  if (!store) return 0;
  
  const item = store.items.find(item => item.itemId === itemId);
  return item ? item.price : 0;
}

export function isItemAvailableInStore(storeId: string, itemId: string, quantity: number = 1): boolean {
  const store = getStoreById(storeId);
  if (!store) return false;
  
  const item = store.items.find(item => item.itemId === itemId);
  if (!item) return false;
  
  // Unlimited stock
  if (item.stockQuantity === -1) return true;
  
  // Check if enough stock
  return item.stockQuantity >= quantity;
}

export function calculateBuybackPrice(itemValue: number, storeId: string): number {
  const store = getStoreById(storeId);
  if (!store || !store.buyback) return 0;
  
  return Math.floor(itemValue * store.buybackRate);
}

/**
 * Store and Bank Constants per GDD
 */
export const COMMERCE_CONSTANTS = {
  DEFAULT_BUYBACK_RATE: 0.5, // 50% of item value
  BANK_STORAGE_UNLIMITED: -1,
  STORE_UNLIMITED_STOCK: -1,
  INTERACTION_RANGE: 3, // meters to interact with bank/store
} as const;

/**
 * Banking and Store Locations for Quick Reference
 * Computed from loaded data
 */
export function getBankLocations() {
  return Object.values(BANKS).map(bank => ({
    id: bank.id,
    name: bank.name,
    zone: bank.location.zone,
    position: bank.location.position
  }));
}

export function getStoreLocations() {
  return Object.values(GENERAL_STORES).map(store => ({
    id: store.id,
    name: store.name,
    zone: store.location.zone,
    position: store.location.position
  }));
}
