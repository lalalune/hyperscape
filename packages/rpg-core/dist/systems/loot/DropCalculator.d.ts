import { LootTable, LootDrop, RPGEntity } from '../../types/index';
export declare class DropCalculator {
    /**
     * Calculate drops from a loot table
     */
    calculateDrops(lootTable: LootTable, _killer?: RPGEntity | null): LootDrop[];
    /**
     * Roll for a weighted drop
     */
    private rollWeightedDrop;
    /**
     * Check if rarity roll succeeds
     */
    private checkRarity;
    /**
     * Create a drop with rolled quantity
     */
    private createDrop;
    /**
     * Roll quantity within range (for future use with range-based drops)
     */
    /**
     * Apply drop modifiers (e.g., ring of wealth)
     */
    applyModifiers(drops: LootDrop[], killer?: RPGEntity | null): LootDrop[];
    /**
     * Apply drop modifiers (ring of wealth, etc.)
     */
    private applyDropModifiers;
    /**
     * Check if player has ring of wealth equipped
     */
    private hasRingOfWealth;
    /**
     * Check if player has looting enchantment
     */
    private hasLootingEnchantment;
    /**
     * Check if item is considered a rare drop
     */
    private isRareDrop;
}
//# sourceMappingURL=DropCalculator.d.ts.map