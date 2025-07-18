import type { ItemDefinition } from '../types';
export declare class ItemRegistry {
    private items;
    private nameIndex;
    /**
     * Register an item definition
     */
    register(item: ItemDefinition): void;
    /**
     * Get item by ID
     */
    get(itemId: number): ItemDefinition | null;
    /**
     * Get item by exact name
     */
    getByName(name: string): ItemDefinition | null;
    /**
     * Check if item is stackable
     */
    isStackable(itemId: number): boolean;
    /**
     * Check if item is equipable
     */
    isEquipable(itemId: number): boolean;
    /**
     * Check if item is tradeable
     */
    isTradeable(itemId: number): boolean;
    /**
     * Check if item can be noted
     */
    isNoteable(itemId: number): boolean;
    /**
     * Check if item is noted
     */
    isNoted(itemId: number): boolean;
    /**
     * Get unnoted version ID
     */
    getUnnoted(itemId: number): number | null;
    /**
     * Get noted version ID
     */
    getNoted(itemId: number): number | null;
    /**
     * Check if item is members only
     */
    isMembers(itemId: number): boolean;
    /**
     * Get all registered items
     */
    getAll(): ItemDefinition[];
    /**
     * Get items by category (equipment slot)
     */
    getByCategory(category: string): ItemDefinition[];
    /**
     * Search items by name (case insensitive partial match)
     */
    search(query: string): ItemDefinition[];
    /**
     * Clear all items
     */
    clear(): void;
    /**
     * Get number of registered items
     */
    size(): number;
    /**
     * Load default items (called by InventorySystem)
     */
    loadDefaults(): void;
}
//# sourceMappingURL=ItemRegistry.d.ts.map