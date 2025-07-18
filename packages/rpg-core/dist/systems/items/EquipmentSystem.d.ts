/**
 * Equipment System - Manages player equipment and gear progression
 * Handles equipping, unequipping, stat bonuses, and equipment validation
 */
import { System } from '@hyperfy/sdk';
import type { World } from '../../../types';
import { EquipmentSlot, ItemStats } from './ItemDefinitions';
export interface EquippedItem {
    itemId: string;
    slot: EquipmentSlot;
    equipped: number;
}
export interface EquipmentComponent {
    type: 'equipment';
    slots: Record<EquipmentSlot, EquippedItem | null>;
    totalWeight: number;
    bonuses: ItemStats;
    combatLevel: number;
}
export interface ItemUseData {
    playerId: string;
    itemId: string;
    quantity?: number;
    targetId?: string;
    position?: {
        x: number;
        y: number;
        z: number;
    };
}
export declare class EquipmentSystem extends System {
    private equipmentUpdates;
    constructor(world: World);
    initialize(): Promise<void>;
    private handlePlayerJoined;
    createEquipmentComponent(entityId: string): EquipmentComponent | null;
    private handleEquipItem;
    private handleUnequipItem;
    private handleUseItem;
    private handleSwapItems;
    private handleAutoEquip;
    equipItem(playerId: string, itemId: string, slot?: EquipmentSlot): boolean;
    unequipItem(playerId: string, slot: EquipmentSlot): boolean;
    useItem(playerId: string, itemId: string, useData: ItemUseData): boolean;
    private consumeItem;
    private applyTemporaryEffect;
    autoEquipItem(playerId: string, itemId: string): boolean;
    swapEquippedItems(playerId: string, fromSlot: EquipmentSlot, toSlot: EquipmentSlot): boolean;
    private canPlayerEquipItem;
    private updateEquipmentBonuses;
    private updateCombatLevel;
    getEquippedItem(playerId: string, slot: EquipmentSlot): EquippedItem | null;
    getAllEquippedItems(playerId: string): Record<EquipmentSlot, EquippedItem | null>;
    getEquipmentBonuses(playerId: string): ItemStats | null;
    getEquipmentComponent(playerId: string): EquipmentComponent | null;
    isItemEquipped(playerId: string, itemId: string): boolean;
    getCombatLevel(playerId: string): number;
    update(deltaTime: number): void;
    serialize(): any;
    deserialize(data: any): void;
}
//# sourceMappingURL=EquipmentSystem.d.ts.map