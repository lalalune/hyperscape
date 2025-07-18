import { System } from '@hyperfy/sdk';
import type { World } from '../types';
import { EquipmentSlot, InventoryComponent, ItemStack, RPGEntity } from '../types/index';
export declare class InventorySystem extends System {
    private inventories;
    private itemRegistry;
    private equipmentCalculator;
    private readonly MAX_STACK_SIZE;
    private pendingSaves;
    private saveTimer?;
    constructor(world: World);
    /**
     * Initialize the system
     */
    init(_options: any): Promise<void>;
    /**
     * Start auto-save timer
     */
    private startAutoSave;
    /**
     * Handle player connect event
     */
    private handlePlayerConnect;
    /**
     * Handle player disconnect event
     */
    private handlePlayerDisconnect;
    /**
     * Load player inventory from persistence
     */
    private loadPlayerInventory;
    /**
     * Save player inventory to persistence
     */
    private savePlayerInventory;
    /**
     * Save all pending inventories
     */
    private savePendingInventories;
    /**
     * Mark entity for saving
     */
    private markForSave;
    /**
     * Update method
     */
    update(_delta: number): void;
    /**
     * Add item to entity inventory
     */
    addItem(entityId: string, itemId: number, quantity: number): boolean;
    /**
     * Remove item from inventory by slot
     */
    removeItem(entityId: string, slot: number, quantity?: number): ItemStack | null;
    /**
     * Remove item from inventory by item ID and quantity
     */
    removeItemById(entityId: string, itemId: number, quantity: number): boolean;
    /**
     * Get the total quantity of a specific item in inventory
     */
    getItemQuantity(entityId: string, itemId: number): number;
    /**
     * Move item between slots
     */
    moveItem(entityId: string, fromSlot: number, toSlot: number): boolean;
    /**
     * Equip item to slot
     */
    equipItem(entity: RPGEntity, inventorySlot: number, equipmentSlot: EquipmentSlot): boolean;
    /**
     * Unequip item from slot
     */
    unequipItem(entity: RPGEntity, slot: EquipmentSlot): boolean;
    /**
     * Drop item from inventory
     */
    dropItem(entity: RPGEntity, slotIndex: number, quantity?: number): boolean;
    /**
     * Get total weight
     */
    getWeight(entityId: string): number;
    /**
     * Get number of free slots
     */
    getFreeSlots(entityId: string): number;
    /**
     * Find item in inventory
     */
    findItem(entityId: string, itemId: number): number | null;
    /**
     * Create inventory for entity (private helper)
     */
    private createInventoryInternal;
    /**
     * Find first free slot
     */
    private findFreeSlot;
    /**
     * Update total weight
     */
    private updateWeight;
    /**
     * Update equipment bonuses
     */
    private updateEquipmentBonuses;
    /**
     * Sync inventory to client
     */
    private syncInventory;
    /**
     * Send message to entity
     */
    private sendMessage;
    /**
     * Public method to create inventory for an entity
     */
    createInventory(entityId: string): InventoryComponent | null;
    /**
     * Check if entity should have inventory
     */
    private shouldHaveInventory;
    /**
     * Get entity from world
     */
    private getEntity;
    /**
     * Get entity by inventory component
     */
    private getEntityByInventory;
    /**
     * Create empty combat bonuses
     */
    private createEmptyBonuses;
    /**
     * Register default items
     */
    private registerDefaultItems;
    /**
     * Get entity position from movement component
     */
    private getEntityPosition;
    /**
     * Sync drop item over network
     */
    private syncDropItemNetwork;
    /**
     * Sync equip item over network
     */
    private syncEquipNetwork;
    /**
     * Sync unequip item over network
     */
    private syncUnequipNetwork;
    /**
     * Update combat bonuses
     */
    private updateCombatBonuses;
    /**
     * Remove item from slot
     */
    private removeFromSlot;
    /**
     * Check if item can be equipped to slot
     */
    private canEquipToSlot;
    /**
     * Add item to specific entity
     */
    private addItemToEntity;
}
//# sourceMappingURL=InventorySystem.d.ts.map