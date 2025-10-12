 
import { LootTable, Equipment, InventoryItem, EquipmentSlot } from '../../types/core';
import { Entity } from '../../entities/Entity';
import { LootDrop } from '../../types/core';
import { ItemRarity } from '../../types/entities';

export class DropCalculator {
  /**
   * Calculate drops from a loot table
   */
  calculateDrops(lootTable: LootTable, _killer?: Entity | null): LootDrop[] {
    const drops: LootDrop[] = [];
    
    // Add always drops
    if (lootTable.drops) {
      for (const drop of lootTable.drops) {
        if (drop.rarity === ItemRarity.ALWAYS) {
          drops.push(this.createDrop(drop));
        }
      }
    }
    
    // Roll for other drops
    const regularDrops = lootTable.drops?.filter(d => d.rarity !== ItemRarity.ALWAYS) || [];
    if (regularDrops.length > 0) {
      // Convert Item[] to LootDrop[]
      const lootDrops: LootDrop[] = regularDrops.map(item => ({
        itemId: item.id,
        quantity: 1, // Item doesn't have quantity, default to 1
        weight: undefined, // Item doesn't have weight
        rarity: item.rarity as 'common' | 'uncommon' | 'rare' | 'very_rare' | undefined,
        rare: false // Item doesn't have rare flag
      }));
      const rolled = this.rollWeightedDrop(lootDrops);
      if (rolled) {
        drops.push(rolled);
      }
    }
    
    // Check for rare drop table access
    if (lootTable.rareDropTable && Math.random() < 0.01) { // 1% chance
      // Would roll on rare drop table here
    }
    
    return drops;
  }
  
  /**
   * Roll for a weighted drop
   */
  private rollWeightedDrop(drops: LootDrop[]): LootDrop | null {
    const totalWeight = drops.reduce((sum, drop) => sum + (drop.weight || 1), 0);
    if (totalWeight === 0) return null;
    
    let roll = Math.random() * totalWeight;
    
    for (const drop of drops) {
      roll -= (drop.weight || 1);
      if (roll <= 0) {
        // Check rarity chance
        if (this.checkRarity(drop.rarity || 'common')) {
          return drop;
        }
        break;
      }
    }
    
    return null;
  }
  
  /**
   * Check if rarity roll succeeds
   */
  private checkRarity(rarity: string): boolean {
    const rarityChances: Record<string, number> = {
      [ItemRarity.ALWAYS]: 1.0,
      [ItemRarity.COMMON]: 1.0,
      [ItemRarity.UNCOMMON]: 0.25,
      [ItemRarity.RARE]: 0.05,
      [ItemRarity.EPIC]: 0.01,
      [ItemRarity.LEGENDARY]: 0.001
    };
    
    const chance = rarityChances[rarity] || 1.0;
    return Math.random() < chance;
  }
  
  /**
   * Create a drop with rolled quantity
   */
  private createDrop(template: {itemId?: string; id?: string; quantity?: number; weight?: number; rarity?: string; rare?: boolean}): LootDrop {
    // Create a simplified drop result
    return {
      itemId: template.itemId || template.id || '',
      quantity: template.quantity || 1,
      ...(template.weight !== undefined && { weight: template.weight }),
      ...(template.rarity !== undefined && { rarity: template.rarity as "common" | "uncommon" | "rare" | "very_rare" }),
      ...(template.rare !== undefined && { rare: template.rare })
    };
  }
  
  /**
   * Roll quantity within range (for future use with range-based drops)
   */
  // private rollQuantity(range: { min: number; max: number }): number {
  //   if (range.min === range.max) return range.min;
  //   return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  // }
  
  /**
   * Apply drop modifiers (e.g., ring of wealth)
   */
  applyModifiers(drops: LootDrop[], killer?: Entity | null): LootDrop[] {
    if (!killer) return drops;
    
    // Check for drop modifiers
    const stats = killer.getComponent('stats');
    if (!stats) return drops;
    
    // Apply drop modifiers including ring of wealth
    return this.applyDropModifiers(drops, killer);
  }
  
  /**
   * Apply drop modifiers (ring of wealth, etc.)
   */
  private applyDropModifiers(drops: LootDrop[], killer?: Entity): LootDrop[] {
    // Check for ring of wealth, etc.
    if (killer) {
      const hasRingOfWealth = this.hasRingOfWealth(killer);
      
      if (hasRingOfWealth) {
        // Ring of wealth effects:
        // 1. Removes empty drops from rare drop table
        drops = drops.filter(drop => drop.itemId !== '0');
        
        // 2. Slightly improves chances for rare drops
        drops = drops.map(drop => {
          // Check if it's a rare drop (you might want to add rarity to ItemDrop)
          const isRareDrop = drop.itemId ? this.isRareDrop(parseInt(drop.itemId)) : false;
          if (isRareDrop) {
            // Add 1-2 extra quantity to rare drops occasionally
            if (Math.random() < 0.1) { // 10% chance
              return {
                ...drop,
                quantity: (drop.quantity || 1) + Math.floor(Math.random() * 2) + 1
              };
            }
          }
          return drop;
        });
      }
      
      // Check for other drop modifiers
      const hasLootingEnchant = this.hasLootingEnchantment(killer);
      if (hasLootingEnchant) {
        // Increase quantity of drops
        drops = drops.map(drop => ({
          ...drop,
          quantity: Math.floor((drop.quantity || 1) * 1.2) // 20% increase
        }));
      }
    }
    
    return drops;
  }
  
  /**
   * Check if player has ring of wealth equipped
   */
  private hasRingOfWealth(entity: Entity): boolean {
    const inventory = entity.getComponent('inventory');
    if (!inventory) return false;
    
    const items = inventory.data.items as InventoryItem[] | undefined;
    if (!items || !Array.isArray(items)) return false;
    const ring = items.find((item) => item.id === 'ring_of_wealth');
    return !!ring;
  }
  
  /**
   * Check if player has looting enchantment
   */
  private hasLootingEnchantment(entity: Entity): boolean {
    const inventory = entity.getComponent('inventory');
    if (!inventory || !inventory.data) return false;
    
    const equipment = inventory.data.equipment as Equipment | undefined;
    const weapon = equipment?.weapon as (EquipmentSlot & { enchantments?: string[] }) | undefined;
    return !!weapon && Array.isArray(weapon.enchantments) && weapon.enchantments.includes('looting');
  }
  
  /**
   * Check if item is considered a rare drop
   */
  private isRareDrop(itemId: number): boolean {
    // Define rare item IDs (you might want to load this from config)
    const rareItems = [
      1249, // Dragon spear
      4087, // Dragon platelegs
      4585, // Dragon plateskirt
      11840, // Dragon boots
      6571, // Uncut onyx
      2577, // Ranger boots
      // Add more rare item IDs
    ];
    
    return rareItems.includes(itemId);
  }
} 