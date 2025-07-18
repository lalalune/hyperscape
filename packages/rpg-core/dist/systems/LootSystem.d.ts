import { System } from '@hyperfy/sdk';
import type { World } from '../types';
import { LootTable, ItemDrop } from '../types/index';
import { LootTableManager } from './loot/LootTableManager';
export declare class LootSystem extends System {
    private lootDrops;
    private lootTableManager;
    private dropCalculator;
    private itemRegistry;
    private readonly LOOT_DESPAWN_TIME;
    private readonly LOOT_VISIBLE_TIME;
    private readonly MAX_DROPS_PER_AREA;
    constructor(world: World);
    /**
     * Initialize the system
     */
    init(_options: any): Promise<void>;
    /**
     * Update method
     */
    update(_delta: number): void;
    /**
     * Handle entity death and generate loot
     */
    private handleEntityDeath;
    /**
     * Handle manual item drop
     */
    private handleItemDrop;
    /**
     * Create loot drop in world
     */
    private createLootDrop;
    /**
     * Handle pickup attempt
     */
    private handlePickupAttempt;
    /**
     * Despawn loot
     */
    private despawnLoot;
    /**
     * Stack similar items
     */
    private stackItems;
    /**
     * Get loot table ID for entity
     */
    private getLootTableId;
    /**
     * Get loot model based on items
     */
    /**
     * Get item name
     */
    private getItemName;
    /**
     * Enforce drop limit per area
     */
    private enforceDropLimit;
    /**
     * Sync loot state to clients
     */
    private syncLoot;
    /**
     * Calculate distance between entities
     */
    private calculateDistance;
    /**
     * Get entity from world
     */
    private getEntity;
    /**
     * Get inventory system
     */
    private getInventorySystem;
    /**
     * Send message to player
     */
    private sendMessage;
    /**
     * Register default loot tables
     */
    private registerDefaultLootTables;
    /**
     * Register a loot table
     */
    registerLootTable(table: LootTable): void;
    /**
     * Register the rare drop table
     */
    registerRareDropTable(table: LootTable): void;
    /**
     * Generate drops for an entity
     */
    generateDrops(entityId: string): ItemDrop[];
    /**
     * Roll from loot entries
     */
    private rollFromEntries;
    /**
     * Roll quantity within range
     */
    private rollQuantity;
    /**
     * Get loot tables for testing
     */
    get lootTables(): LootTableManager;
    /**
     * Get rare drop table for testing
     */
    get rareDropTable(): any;
    /**
     * Calculate drop value
     */
    calculateDropValue(drops: ItemDrop[]): number;
    /**
     * Get total value of drops
     */
    private getDropsValue;
}
//# sourceMappingURL=LootSystem.d.ts.map