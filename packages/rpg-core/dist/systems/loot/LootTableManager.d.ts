import { LootTable } from '../types';
export declare class LootTableManager {
    private lootTables;
    /**
     * Register a loot table
     */
    register(table: LootTable): void;
    /**
     * Get a loot table by ID
     */
    get(id: string): LootTable | undefined;
    /**
     * Check if a loot table exists
     */
    has(id: string): boolean;
    /**
     * Get all registered loot tables
     */
    getAll(): LootTable[];
    /**
     * Remove a loot table
     */
    remove(id: string): boolean;
    /**
     * Clear all loot tables
     */
    clear(): void;
    /**
     * Get the count of registered loot tables
     */
    get size(): number;
}
//# sourceMappingURL=LootTableManager.d.ts.map