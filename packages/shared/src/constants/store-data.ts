/**
 * Centralized store data to ensure consistency between the store system and tests
 * This prevents hardcoded values from getting out of sync
 */

import { StoreItem } from '../types/core';

// Store item definitions - single source of truth
export const STORE_ITEMS: Record<string, Omit<StoreItem, 'stockQuantity'>> = {
  bronze_hatchet: {
    id: 'bronze_hatchet',
    itemId: 'bronze_hatchet',
    name: 'Bronze Hatchet',
    price: 1,
    category: 'tools',
    description: 'A basic hatchet for chopping trees.',
    restockTime: 0 // No restock needed - unlimited
  },
  fishing_rod: {
    id: 'fishing_rod',
    itemId: 'fishing_rod',
    name: 'Fishing Rod',
    price: 5,
    category: 'tools',
    description: 'A simple fishing rod for catching fish.',
    restockTime: 0 // No restock needed - unlimited
  },
  tinderbox: {
    id: 'tinderbox',
    itemId: 'tinderbox',
    name: 'Tinderbox',
    price: 2,
    category: 'tools',
    description: 'Essential for making fires from logs.',
    restockTime: 0 // No restock needed - unlimited
  },
  arrows: {
    id: 'arrows',
    itemId: 'arrows',
    name: 'Arrows',
    price: 1,
    category: 'ammunition',
    description: 'Basic arrows for ranged combat. Required for bows.',
    restockTime: 0 // No restock needed - unlimited
  },
  logs: {
    id: 'logs',
    itemId: 'logs',
    name: 'Logs',
    price: 5,
    category: 'consumables',
    description: 'Logs cut from a tree. Useful for firemaking.',
    restockTime: 0 // No restock needed - unlimited
  },
  // Test-only items
  steel_sword: {
    id: 'steel_sword',
    itemId: 'steel_sword',
    name: 'Steel Sword',
    price: 500,
    category: 'weapons',
    description: 'A powerful steel sword.',
    restockTime: 0 // No restock needed - unlimited
  }
};

// Helper function to get store item with stock
export function getStoreItem(itemId: string, stockQuantity: number = -1): StoreItem {
  const item = STORE_ITEMS[itemId];
  if (!item) {
    throw new Error(`Store item not found: ${itemId}`);
  }
  return {
    ...item,
    stockQuantity
  };
}

// Helper function to get item price
export function getItemPrice(itemId: string): number {
  const item = STORE_ITEMS[itemId];
  if (!item) {
    throw new Error(`Store item not found: ${itemId}`);
  }
  return item.price;
}

// Store configurations
export const DEFAULT_STORE_ITEMS = [
  'bronze_hatchet',
  'fishing_rod', 
  'tinderbox',
  'arrows'
];

export const BUYBACK_RATE = 0.5; // 50% of original price when selling back