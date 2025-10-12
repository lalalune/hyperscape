/**
 * GDD-Compliant Banks and Stores
 * Banking system and General Store data per Game Design Document
 */

import type {
  BankEntityData,
  StoreData,
} from '../types/core';

/**
 * Banking System per GDD
 * - Location: One per starter town
 * - Storage: Unlimited slots
 * - Independence: Each bank separate (no shared storage)
 */
export const BANKS: Record<string, BankEntityData> = {
  central_bank: {
    id: 'central_bank',
    name: 'Central Bank',
    location: {
      zone: 'town_central',
      position: { x: 5, y: 0, z: 8 } // Y will be grounded to terrain
    },
    isShared: false,
    maxSlots: -1, // Unlimited per GDD
    description: 'The main banking facility in Central Haven, offering secure storage for your items.',
    },

  eastern_bank: {
    id: 'eastern_bank', 
    name: 'Eastern Bank',
    location: {
      zone: 'town_eastern',
      position: { x: 105, y: 0, z: 8 } // Y will be grounded to terrain
    },
    isShared: false,
    maxSlots: -1,
    description: 'Banking services for adventurers in the eastern territories.',
  },

  western_bank: {
    id: 'western_bank',
    name: 'Western Bank', 
    location: {
      zone: 'town_western',
      position: { x: -95, y: 0, z: 8 } // Y will be grounded to terrain
    },
    isShared: false,
    maxSlots: -1,
    description: 'Secure storage facility serving the western settlement.',
  },

  northern_bank: {
    id: 'northern_bank',
    name: 'Northern Bank',
    location: {
      zone: 'town_northern', 
      position: { x: 5, y: 0, z: 108 } // Y will be grounded to terrain
    },
    isShared: false,
    maxSlots: -1,
    description: 'Banking services for the northern village community.',
  },

  southern_bank: {
    id: 'southern_bank',
    name: 'Southern Bank',
    location: {
      zone: 'town_southern',
      position: { x: 5, y: 0, z: -92 } // Y will be grounded to terrain
    },
    isShared: false,
    maxSlots: -1,
    description: 'Safe storage for items at the southern frontier camp.',
  }
};

/**
 * General Store System per GDD
 * Available Items: Hatchet (Bronze), Fishing Rod, Tinderbox, Arrows
 */
export const GENERAL_STORES: Record<string, StoreData> = {
  central_store: {
    id: 'central_store',
    name: 'Central General Store',
    location: {
      zone: 'town_central',
      position: { x: -5, y: 0, z: 8 } // Y will be grounded to terrain
    },
    buyback: true,
    buybackRate: 0.5, // 50% of item value
    description: 'General supplies and tools for adventurers starting their journey.',
    items: [
      {
        id: 'bronze_hatchet',
        itemId: 'bronze_hatchet',
        name: 'Bronze Hatchet',
        price: 50,
        stockQuantity: -1, // Unlimited per GDD
        restockTime: 0,
        description: 'A basic bronze hatchet for woodcutting',
        category: 'tools'
      },
      {
        id: 'fishing_rod',
        itemId: 'fishing_rod',
        name: 'Fishing Rod',
        price: 30,
        stockQuantity: -1,
        restockTime: 0,
        description: 'A simple fishing rod for catching fish',
        category: 'tools'
      },
      {
        id: 'tinderbox',
        itemId: 'tinderbox',
        name: 'Tinderbox',
        price: 10,
        stockQuantity: -1,
        restockTime: 0,
        description: 'Used to light fires',
        category: 'tools'
      },
      {
        id: 'arrows',
        itemId: 'arrows',
        name: 'Arrows',
        price: 1, // 1 coin per arrow per GDD
        stockQuantity: -1,
        restockTime: 0,
        description: 'Ammunition for ranged weapons',
        category: 'ammunition'
      }
    ]
  },

  eastern_store: {
    id: 'eastern_store',
    name: 'Eastern General Store',
    location: {
      zone: 'town_eastern',
      position: { x: 95, y: 0, z: 8 } // Y will be grounded to terrain
    },
    buyback: true,
    buybackRate: 0.5,
    description: 'Essential supplies for eastern territory explorers.',
    items: [
      {
        id: 'bronze_hatchet',
        itemId: 'bronze_hatchet',
        name: 'Bronze Hatchet', 
        price: 50,
        stockQuantity: -1,
        restockTime: 0,
        description: 'A basic bronze hatchet for woodcutting',
        category: 'tools'
      },
      {
        id: 'fishing_rod',
        itemId: 'fishing_rod',
        name: 'Fishing Rod',
        price: 30,
        stockQuantity: -1,
        restockTime: 0,
        description: 'A simple fishing rod for catching fish',
        category: 'tools'
      },
      {
        id: 'tinderbox',
        itemId: 'tinderbox',
        name: 'Tinderbox',
        price: 10,
        stockQuantity: -1,
        restockTime: 0,
        description: 'Used to light fires',
        category: 'tools'
      },
      {
        id: 'arrows',
        itemId: 'arrows',
        name: 'Arrows',
        price: 1,
        stockQuantity: -1,
        restockTime: 0,
        description: 'Ammunition for ranged weapons',
        category: 'ammunition'
      }
    ]
  },

  western_store: {
    id: 'western_store',
    name: 'Western General Store',
    location: {
      zone: 'town_western',
      position: { x: -105, y: 0, z: 8 } // Y will be grounded to terrain
    },
    buyback: true,
    buybackRate: 0.5,
    description: 'Basic equipment and supplies for western frontier life.',
    items: [
      {
        id: 'bronze_hatchet',
        itemId: 'bronze_hatchet',
        name: 'Bronze Hatchet',
        price: 50,
        stockQuantity: -1,
        restockTime: 0,
        description: 'A basic bronze hatchet for woodcutting',
        category: 'tools'
      },
      {
        id: 'fishing_rod',
        itemId: 'fishing_rod',
        name: 'Fishing Rod',
        price: 30,
        stockQuantity: -1,
        restockTime: 0,
        description: 'A simple fishing rod for catching fish',
        category: 'tools'
      },
      {
        id: 'tinderbox',
        itemId: 'tinderbox',
        name: 'Tinderbox',
        price: 10,
        stockQuantity: -1,
        restockTime: 0,
        description: 'Used to light fires',
        category: 'tools'
      },
      {
        id: 'arrows',
        itemId: 'arrows',
        name: 'Arrows',
        price: 1,
        stockQuantity: -1,
        restockTime: 0,
        description: 'Ammunition for ranged weapons',
        category: 'ammunition'
      }
    ]
  },

  northern_store: {
    id: 'northern_store',
    name: 'Northern General Store',
    location: {
      zone: 'town_northern',
      position: { x: -5, y: 0, z: 108 } // Y will be grounded to terrain
    },
    buyback: true,
    buybackRate: 0.5,
    description: 'Tools and supplies for the harsh northern environment.',
    items: [
      {
        id: 'bronze_hatchet',
        itemId: 'bronze_hatchet',
        name: 'Bronze Hatchet',
        price: 50,
        stockQuantity: -1,
        restockTime: 0,
        description: 'A basic bronze hatchet for woodcutting',
        category: 'tools'
      },
      {
        id: 'fishing_rod',
        itemId: 'fishing_rod',
        name: 'Fishing Rod',
        price: 30,
        stockQuantity: -1,
        restockTime: 0,
        description: 'A simple fishing rod for catching fish',
        category: 'tools'
      },
      {
        id: 'tinderbox',
        itemId: 'tinderbox',
        name: 'Tinderbox',
        price: 10,
        stockQuantity: -1,
        restockTime: 0,
        description: 'Used to light fires',
        category: 'tools'
      },
      {
        id: 'arrows',
        itemId: 'arrows',
        name: 'Arrows',
        price: 1,
        stockQuantity: -1,
        restockTime: 0,
        description: 'Ammunition for ranged weapons',
        category: 'ammunition'
      }
    ]
  },

  southern_store: {
    id: 'southern_store',
    name: 'Southern General Store',
    location: {
      zone: 'town_southern',
      position: { x: -5, y: 0, z: -92 } // Y will be grounded to terrain
    },
    buyback: true,
    buybackRate: 0.5,
    description: 'Essential gear for southern frontier adventures.',
    items: [
      {
        id: 'bronze_hatchet',
        itemId: 'bronze_hatchet',
        name: 'Bronze Hatchet',
        price: 50,
        stockQuantity: -1,
        restockTime: 0,
        description: 'A basic bronze hatchet for woodcutting',
        category: 'tools'
      },
      {
        id: 'fishing_rod',
        itemId: 'fishing_rod',
        name: 'Fishing Rod',
        price: 30,
        stockQuantity: -1,
        restockTime: 0,
        description: 'A simple fishing rod for catching fish',
        category: 'tools'
      },
      {
        id: 'tinderbox',
        itemId: 'tinderbox',
        name: 'Tinderbox',
        price: 10,
        stockQuantity: -1,
        restockTime: 0,
        description: 'Used to light fires',
        category: 'tools'
      },
      {
        id: 'arrows',
        itemId: 'arrows',
        name: 'Arrows',
        price: 1,
        stockQuantity: -1,
        restockTime: 0,
        description: 'Ammunition for ranged weapons',
        category: 'ammunition'
      }
    ]
  }
};

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
 */
export const BANK_LOCATIONS = Object.values(BANKS).map(bank => ({
  id: bank.id,
  name: bank.name,
  zone: bank.location.zone,
  position: bank.location.position
}));

export const STORE_LOCATIONS = Object.values(GENERAL_STORES).map(store => ({
  id: store.id,
  name: store.name,
  zone: store.location.zone,
  position: store.location.position
}));