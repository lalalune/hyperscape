 
import type {
  CombatBonuses,
  Item,
  StatsComponent
} from '../../types';
import { ItemRegistry } from './ItemRegistry';

export class EquipmentBonusCalculator {
  constructor(private itemRegistry: ItemRegistry) {}

  /**
   * Calculate total bonuses from all equipped items
   */
  calculateTotalBonuses(equipment: Record<string, Item | null>): CombatBonuses {
    const totalBonuses = this.createEmptyBonuses();

    for (const slot in equipment) {
      const item = equipment[slot];
      if (item && item.bonuses) {
        const bonuses = item.bonuses;
        
        // Add each bonus - use specific bonus properties or fall back to 0
        totalBonuses.attackStab! += bonuses.attackStab || 0;
        totalBonuses.attackSlash! += bonuses.attackSlash || 0;
        totalBonuses.attackCrush! += bonuses.attackCrush || 0;
        totalBonuses.attackMagic! += bonuses.attackMagic || 0;
        totalBonuses.attackRanged! += bonuses.attackRanged || 0;
        
        totalBonuses.defenseStab! += bonuses.defenseStab || 0;
        totalBonuses.defenseSlash! += bonuses.defenseSlash || 0;
        totalBonuses.defenseCrush! += bonuses.defenseCrush || 0;
        totalBonuses.defenseMagic! += bonuses.defenseMagic || 0;
        totalBonuses.defenseRanged! += bonuses.defenseRanged || 0;
        
        totalBonuses.meleeStrength! += bonuses.meleeStrength || 0;
        totalBonuses.rangedStrength! += bonuses.rangedStrength || 0;
        totalBonuses.magicDamage! += bonuses.magicDamage || 0;
        totalBonuses.prayerBonus! += bonuses.prayerBonus || 0;
      }
    }

    return totalBonuses;
  }

  /**
   * Check if player meets requirements to equip an item
   */
  meetsRequirements(item: Item, stats: StatsComponent): boolean {
    // Non-equipable items have no requirements
    if (!item.requirements) {
      return true;
    }

    const requirements = item.requirements;
    
    // Check if requirements has skills nested
    if (requirements.skills) {
      const skillRequirements = requirements.skills;
      
      // Check each skill requirement
      for (const skill in skillRequirements) {
        const required = skillRequirements[skill as keyof typeof skillRequirements];
        if (typeof required !== 'number') continue; // Skip if no requirement for this skill
        
        const playerSkill = stats[skill as keyof StatsComponent];
        
        // Handle different types that playerSkill could be
        let skillLevel = 0;
        if (playerSkill && typeof playerSkill === 'object' && 'level' in playerSkill) {
          const skillWithLevel = playerSkill as { level: number };
          skillLevel = skillWithLevel.level;
        } else if (typeof playerSkill === 'number') {
          skillLevel = playerSkill;
        }

        if (skillLevel < required) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculate total weight of equipped items
   */
  getEquipmentWeight(equipment: Record<string, Item | null>): number {
    let totalWeight = 0;

    for (const slot in equipment) {
      const item = equipment[slot];
      if (item) {
        totalWeight += item.weight || 0;
      }
    }

    return totalWeight;
  }

  /**
   * Create an empty bonuses object with all values set to 0
   */
  createEmptyBonuses(): CombatBonuses {
    return {
      attackStab: 0,
      attackSlash: 0,
      attackCrush: 0,
      attackMagic: 0,
      attackRanged: 0,
      defenseStab: 0,
      defenseSlash: 0,
      defenseCrush: 0,
      defenseMagic: 0,
      defenseRanged: 0,
      meleeStrength: 0,
      rangedStrength: 0,
      magicDamage: 0,
      prayerBonus: 0
    };
  }

  /**
   * Get equipment set bonuses (e.g., Barrows sets)
   */
  getSetBonuses(equipment: Record<string, Item | null>): CombatBonuses {
    // Initialize empty bonuses
    const setBonuses: CombatBonuses = {
      attackStab: 0,
      attackSlash: 0,
      attackCrush: 0,
      attackMagic: 0,
      attackRanged: 0,
      defenseStab: 0,
      defenseSlash: 0,
      defenseCrush: 0,
      defenseMagic: 0,
      defenseRanged: 0,
      meleeStrength: 0,
      rangedStrength: 0,
      magicDamage: 0,
      prayerBonus: 0
    };

    // Check for complete sets
    const equippedItems = Object.values(equipment).filter(item => item !== null) as Item[];
    
    // Example: Dharok's set
    if (this.hasCompleteSet(equippedItems, 'dharok')) {
      // Dharok's set effect is handled separately in combat
      // No direct stat bonuses
    }
    
    // Example: Void knight set
    if (this.hasVoidSet(equippedItems)) {
      // Void provides accuracy and damage bonuses
      // These are percentage-based and handled in combat calculations
    }
    
    return setBonuses;
  }

  /**
   * Check if player has a complete armor set
   */
  private hasCompleteSet(items: Item[], setName: string): boolean {
    const setItems = items.filter(item => 
      item.name.toLowerCase().includes(setName)
    );
    
    // Most sets require 4 pieces (helm, body, legs, weapon/shield)
    return setItems.length >= 4;
  }

  /**
   * Check for void knight set
   */
  private hasVoidSet(items: Item[]): boolean {
    const voidItems = items.filter(item => 
      item.name.toLowerCase().includes('void')
    );
    
    // Void requires: top, bottom, gloves, and helm
    const hasTop = voidItems.some(item => item.name.includes('top'));
    const hasBottom = voidItems.some(item => item.name.includes('robe'));
    const hasGloves = voidItems.some(item => item.name.includes('gloves'));
    const hasHelm = voidItems.some(item => 
      item.name.includes('helm') || 
      item.name.includes('hood')
    );
    
    return hasTop && hasBottom && hasGloves && hasHelm;
  }

  /**
   * Calculate weight reduction from equipment
   */
  calculateWeightReduction(equipment: Record<string, Item | null>): number {
    let reduction = 0;
    
    // Graceful outfit pieces
    const gracefulPieces = Object.values(equipment).filter(item => 
      item && item.name.toLowerCase().includes('graceful')
    ).length;
    
    // Each graceful piece reduces weight by 3kg, full set gives extra 3kg
    reduction += gracefulPieces * 3;
    if (gracefulPieces >= 6) {
      reduction += 3; // Full set bonus
    }
    
    // Spotted/spottier cape
    const cape = equipment['cape'];
    if (cape) {
      if (cape.name.toLowerCase().includes('spottier')) {
        reduction += 5;
      } else if (cape.name.toLowerCase().includes('spotted')) {
        reduction += 3;
      }
    }
    
    // Boots of lightness
    const boots = equipment['boots'];
    if (boots && boots.name.toLowerCase().includes('lightness')) {
      reduction += 4;
    }
    
    return reduction;
  }

  /**
   * Get prayer drain reduction from equipment
   */
  getPrayerDrainReduction(equipment: Record<string, Item | null>): number {
    let reduction = 0;
    
    // Check for prayer bonus items
    for (const slot in equipment) {
      const item = equipment[slot];
      if (item && item.bonuses?.prayer) {
        // Each prayer bonus point reduces drain by 3.33%
        reduction += (item.bonuses.prayer * 3.33) / 100;
      }
    }
    
    return Math.min(reduction, 0.5); // Cap at 50% reduction
  }
} 