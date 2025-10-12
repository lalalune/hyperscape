 
import { dataManager } from '../../data/DataManager';
import type { Item } from '../../types';

export class ItemRegistry {
  private items: Map<number, Item> = new Map();
  private nameIndex: Map<string, Item> = new Map();

  /**
   * Register an item definition
   */
  register(item: Item): void {
    this.items.set(parseInt(item.id), item);
    this.nameIndex.set(item.name, item);
  }

  /**
   * Get item by ID
   */
  get(itemId: number): Item | null {
    return this.items.get(itemId) || null;
  }

  /**
   * Get item by exact name
   */
  getByName(name: string): Item | null {
    return this.nameIndex.get(name) || null;
  }

  /**
   * Check if item is stackable
   */
  isStackable(itemId: number): boolean {
    const item = this.get(itemId);
    return item ? item.stackable : false;
  }

  /**
   * Check if item is equipable
   */
  isEquipable(itemId: number): boolean {
    const item = this.get(itemId);
    return item ? (item.equipable || false) : false;
  }

  /**
   * Check if item is tradeable
   */
  isTradeable(itemId: number): boolean {
    const item = this.get(itemId);
    return item ? (item.tradeable ?? true) : false;
  }

  /**
   * Check if item is members only
   */
  isMembers(itemId: number): boolean {
    const _item = this.get(itemId);
    // For MVP, no members-only items
    return false;
  }

  /**
   * Get all registered items
   */
  getAll(): Item[] {
    return Array.from(this.items.values());
  }

  /**
   * Get items by category (equipment slot)
   */
  getByCategory(category: string): Item[] {
    const results: Item[] = [];
    
    for (const item of this.items.values()) {
      if (item.equipSlot) {
        const slot = item.equipSlot.toLowerCase();
        if (slot === category.toLowerCase()) {
          results.push(item);
        }
      }
    }
    
    return results;
  }

  /**
   * Search items by name (case insensitive partial match)
   */
  search(query: string): Item[] {
    const lowerQuery = query.toLowerCase();
    const results: Item[] = [];
    
    for (const item of this.items.values()) {
      if (item.name.toLowerCase().includes(lowerQuery)) {
        results.push(item);
      }
    }
    
    return results;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items.clear();
    this.nameIndex.clear();
  }

  /**
   * Get number of registered items
   */
  size(): number {
    return this.items.size;
  }

  /**
   * Load default items from centralized DataManager
   */
  loadDefaults(): void {
    // Load all items from centralized DataManager
    const allItems = dataManager.getAllItems();
    for (const [itemId, itemData] of allItems.entries()) {
      // Convert string ID to number for the registry (if needed)
      const numericId = parseInt(itemData.id) || this.stringToHash(itemId);
      
      // Create a copy of the item data with numeric ID
      const registryItem: Item = {
        ...itemData,
        id: numericId.toString()
      };
      
      this.register(registryItem);
    }
    
    console.log(`[ItemRegistry] Loaded ${this.items.size} items from DataManager`);
  }

  /**
   * Convert string to hash for numeric ID
   */
  public stringToHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
} 