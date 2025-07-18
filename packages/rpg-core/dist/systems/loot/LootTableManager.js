"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LootTableManager = void 0;
class LootTableManager {
    constructor() {
        this.lootTables = new Map();
    }
    /**
     * Register a loot table
     */
    register(table) {
        this.lootTables.set(table.id, table);
        console.log(`[LootTableManager] Registered loot table: ${table.name}`);
    }
    /**
     * Get a loot table by ID
     */
    get(id) {
        return this.lootTables.get(id);
    }
    /**
     * Check if a loot table exists
     */
    has(id) {
        return this.lootTables.has(id);
    }
    /**
     * Get all registered loot tables
     */
    getAll() {
        return Array.from(this.lootTables.values());
    }
    /**
     * Remove a loot table
     */
    remove(id) {
        return this.lootTables.delete(id);
    }
    /**
     * Clear all loot tables
     */
    clear() {
        this.lootTables.clear();
    }
    /**
     * Get the count of registered loot tables
     */
    get size() {
        return this.lootTables.size;
    }
}
exports.LootTableManager = LootTableManager;
//# sourceMappingURL=LootTableManager.js.map