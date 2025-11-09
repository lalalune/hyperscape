/**
 * Item Database
 *
 * Items are loaded from world/assets/manifests/items.json by DataManager.
 * This file provides the empty Map that gets populated at runtime.
 *
 * To add new items:
 * 1. Add entries to world/assets/manifests/items.json
 * 2. Generate 3D models in 3D Asset Forge (optional)
 * 3. Restart the server to reload manifests
 */

import type { Item } from "../types";
import {
  AttackType,
  ItemRequirement,
  ItemType,
  WeaponType,
} from "../types/core";

/**
 * Item Database
 * Populated by DataManager from world/assets/manifests/items.json
 */
export const ITEMS: Map<string, Item> = new Map();

/**
 * Helper Functions
 */

// Get item by ID
export function getItem(itemId: string): Item | null {
  return ITEMS.get(itemId) || null;
}

// Get all items of a specific type
export function getItemsByType(type: ItemType): Item[] {
  return Array.from(ITEMS.values()).filter((item) => item.type === type);
}

// Get all weapons
export function getWeapons(): Item[] {
  return Array.from(ITEMS.values()).filter((item) => item.type === "weapon");
}

// Get all armor
export function getArmor(): Item[] {
  return Array.from(ITEMS.values()).filter((item) => item.type === "armor");
}

// Get all tools
export function getTools(): Item[] {
  return Array.from(ITEMS.values()).filter((item) => item.type === "tool");
}

// Get all consumables
export function getConsumables(): Item[] {
  return Array.from(ITEMS.values()).filter(
    (item) => item.type === "consumable",
  );
}

// Get all resources
export function getResources(): Item[] {
  return Array.from(ITEMS.values()).filter((item) => item.type === "resource");
}

// Get items by skill requirement
export function getItemsBySkill(skill: string): Item[] {
  return Array.from(ITEMS.values()).filter(
    (item) =>
      item.requirements && item.requirements[skill as keyof ItemRequirement],
  );
}

// Get items by level requirement
export function getItemsByLevel(level: number): Item[] {
  return Array.from(ITEMS.values()).filter((item) => {
    if (!item.requirements) return true;

    return Object.values(item.requirements).every((req) =>
      typeof req === "number" ? req <= level : true,
    );
  });
}

/**
 * Shop Items - Available for purchase at general stores
 */
export const SHOP_ITEMS = [
  "bronze_hatchet",
  "fishing_rod",
  "tinderbox",
  "arrows",
];

/**
 * Item Object for compatibility
 * Some systems expect items as an object instead of a Map
 */
export const items: Record<string, Item> = new Proxy(
  {} as Record<string, Item>,
  {
    get(_target, prop: string) {
      return ITEMS.get(prop) || null;
    },
    ownKeys(_target) {
      return Array.from(ITEMS.keys());
    },
    has(_target, prop: string) {
      return ITEMS.has(prop);
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      if (ITEMS.has(prop)) {
        return {
          enumerable: true,
          configurable: true,
          value: ITEMS.get(prop),
        };
      }
      return undefined;
    },
  },
);

// Re-export types for convenience
export type { Item, ItemType, WeaponType, AttackType };
