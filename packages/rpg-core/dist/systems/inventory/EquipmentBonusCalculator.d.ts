import type { Equipment, StatsComponent, CombatBonuses, ItemDefinition } from '../types';
import { EquipmentSlot } from '../types';
import { ItemRegistry } from './ItemRegistry';
export declare class EquipmentBonusCalculator {
    private itemRegistry;
    constructor(itemRegistry: ItemRegistry);
    /**
     * Calculate total bonuses from all equipped items
     */
    calculateTotalBonuses(equipment: {
        [K in EquipmentSlot]: Equipment | null;
    }): CombatBonuses;
    /**
     * Check if player meets requirements to equip an item
     */
    meetsRequirements(item: ItemDefinition | Equipment, stats: StatsComponent): boolean;
    /**
     * Calculate total weight of equipped items
     */
    getEquipmentWeight(equipment: {
        [K in EquipmentSlot]: Equipment | null;
    }): number;
    /**
     * Create an empty bonuses object with all values set to 0
     */
    createEmptyBonuses(): CombatBonuses;
    /**
     * Get equipment set bonuses (e.g., Barrows sets)
     */
    getSetBonuses(equipment: Record<EquipmentSlot, Equipment | null>): CombatBonuses;
    /**
     * Check if player has a complete armor set
     */
    private hasCompleteSet;
    /**
     * Check for void knight set
     */
    private hasVoidSet;
    /**
     * Calculate weight reduction from equipment
     */
    calculateWeightReduction(equipment: Record<EquipmentSlot, Equipment | null>): number;
    /**
     * Get prayer drain reduction from equipment
     */
    getPrayerDrainReduction(equipment: Record<EquipmentSlot, Equipment | null>): number;
}
//# sourceMappingURL=EquipmentBonusCalculator.d.ts.map