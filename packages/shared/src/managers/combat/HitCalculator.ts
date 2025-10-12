 
import { CombatStyle, AttackType, StatsComponent } from '../../types/core';
import { EntityCombatComponent, PlayerCombatStyle } from '../../types/entities';

export class HitCalculator {
  /**
   * Convert PlayerCombatStyle to CombatStyle for defense calculations
   */
  private mapPlayerCombatStyleToCombatStyle(playerStyle: PlayerCombatStyle): CombatStyle {
    switch (playerStyle) {
      case PlayerCombatStyle.DEFENSE:
        return CombatStyle.DEFENSIVE;
      case PlayerCombatStyle.ATTACK:
        return CombatStyle.ACCURATE; // Focused/accurate attacks
      case PlayerCombatStyle.STRENGTH:
        return CombatStyle.AGGRESSIVE; // Power-focused
      case PlayerCombatStyle.RANGED:
        return CombatStyle.LONGRANGE; // Ranged combat
      default:
        return CombatStyle.CONTROLLED; // Balanced approach
    }
  }

  /**
   * Calculate attack roll based on stats and combat style
   */
  calculateAttackRoll(
    attacker: StatsComponent,
    style: CombatStyle,
    attackType: AttackType
  ): number {
    // Get effective level based on attack type
    const effectiveLevel = this.getEffectiveAttackLevel(attacker, style, attackType);
    
    // Get equipment bonus based on attack type
    const equipmentBonus = this.getAttackBonus(attacker, attackType);
    
    // RuneScape formula: effectiveLevel * (equipmentBonus + 64)
    return effectiveLevel * (equipmentBonus + 64);
  }

  /**
   * Calculate defense roll
   */
  calculateDefenseRoll(
    defender: StatsComponent,
    incomingAttackType: AttackType,
    defenderCombatComponent?: EntityCombatComponent
  ): number {
    // Get effective defense level
    const defenderStyle = defenderCombatComponent?.combatStyle 
      ? this.mapPlayerCombatStyleToCombatStyle(defenderCombatComponent.combatStyle)
      : CombatStyle.DEFENSIVE;
    const effectiveDefense = this.getEffectiveDefenseLevel(defender, defenderStyle);
    
    // Get equipment defense bonus against attack type
    const defenseBonus = this.getDefenseBonus(defender, incomingAttackType);
    
    // Defense roll = effective level * (bonus + 64)
    return effectiveDefense * (defenseBonus + 64);
  }

  /**
   * Calculate hit chance from attack and defense rolls
   */
  calculateHitChance(attackRoll: number, defenseRoll: number): number {
    // Handle extreme cases
    if (attackRoll >= defenseRoll * 10) {
      return 1; // 100% hit chance when attack is 10x higher
    }
    if (defenseRoll >= attackRoll * 10) {
      return 0; // 0% hit chance when defense is 10x higher
    }
    
    // Standard RuneScape formula
    if (attackRoll > defenseRoll) {
      return 1 - (defenseRoll + 2) / (2 * (attackRoll + 1));
    } else {
      return attackRoll / (2 * (defenseRoll + 1));
    }
  }

  /**
   * Get effective attack level with style bonuses
   */
  private getEffectiveAttackLevel(
    attacker: StatsComponent,
    style: CombatStyle,
    attackType: AttackType
  ): number {
    let level = 0;
    let styleBonus = 0;
    
    // Get base level based on attack type
    switch (attackType) {
      case AttackType.MELEE:
        level = typeof attacker.attack === 'object' && attacker.attack !== null 
          ? attacker.attack.level || 1 
          : typeof attacker.attack === 'number' ? attacker.attack : 1;
        break;
      case AttackType.RANGED:
        level = typeof attacker.ranged === 'object' && attacker.ranged !== null
          ? attacker.ranged.level || 1 
          : typeof attacker.ranged === 'number' ? attacker.ranged : 1;
        break;
      case AttackType.MAGIC:
        level = attacker.magic 
          ? (typeof attacker.magic === 'object' && attacker.magic !== null 
              ? attacker.magic.level || 1 
              : typeof attacker.magic === 'number' ? attacker.magic : 1)
          : 1;
        break;
    }
    
    // Apply style bonuses
    switch (style) {
      case CombatStyle.ACCURATE:
        styleBonus = 3; // +3 attack levels
        break;
      case CombatStyle.CONTROLLED:
        styleBonus = 1; // +1 to all
        break;
    }
    
    // Effective level = level + style bonus + 8
    return level + styleBonus + 8;
  }

  /**
   * Get effective defense level with style bonuses
   */
  private getEffectiveDefenseLevel(defender: StatsComponent, style: CombatStyle): number {
    const defenseLevel = typeof defender.defense === 'object' && defender.defense !== null
      ? defender.defense.level || 1
      : typeof defender.defense === 'number' ? defender.defense : 1;
    const styleBonus = this.getDefenderStyleBonus(style);
    
    // Include prayer bonus
    const prayerBonus = this.getDefencePrayerBonus(defender);
    
    // Effective level = (level + style bonus) * prayer bonus + 8
    return Math.floor((defenseLevel + styleBonus) * prayerBonus) + 8;
  }

  /**
   * Get defender style bonus
   */
  private getDefenderStyleBonus(style: CombatStyle): number {
    switch (style) {
      case CombatStyle.DEFENSIVE:
        return 3; // +3 defence levels
      case CombatStyle.CONTROLLED:
        return 1; // +1 to all combat skills
      case CombatStyle.LONGRANGE:
        return 3; // +3 defence levels for ranged
      default:
        return 0; // No defence bonus
    }
  }
  
  /**
   * Get defence prayer bonus multiplier
   */
  private getDefencePrayerBonus(defender: StatsComponent): number {
    const prayers = defender.activePrayers;
    
    if (!prayers) return 1.0;
    
    // Defence prayers
    if (prayers.piety) return 1.25; // 25% defence bonus
    if (prayers.rigour) return 1.25; // 25% defence bonus
    if (prayers.augury) return 1.25; // 25% defence bonus
    if (prayers.chivalry) return 1.20; // 20% defence bonus
    
    return 1.0;
  }

  /**
   * Get attack bonus based on attack type
   */
  private getAttackBonus(attacker: StatsComponent, attackType: AttackType): number {
    const bonuses = attacker.combatBonuses;
    
    switch (attackType) {
      case AttackType.MELEE:
        // For melee, we'd need to know the attack style (stab/slash/crush)
        // For now, use the highest
        return Math.max(
          bonuses?.attackStab ?? 0,
          bonuses?.attackSlash ?? 0,
          bonuses?.attackCrush ?? 0
        );
      case AttackType.RANGED:
        return bonuses?.attackRanged ?? 0;
      case AttackType.MAGIC:
        return bonuses?.attackMagic ?? 0;
      default:
        return 0;
    }
  }

  /**
   * Get defense bonus against attack type
   */
  private getDefenseBonus(defender: StatsComponent, attackType: AttackType): number {
    const bonuses = defender.combatBonuses;
    
    switch (attackType) {
      case AttackType.MELEE:
        // For melee, we'd need to know the specific style
        // For now, average the defenses
        return Math.floor(
          ((bonuses?.defenseStab ?? 0) + (bonuses?.defenseSlash ?? 0) + (bonuses?.defenseCrush ?? 0)) / 3
        );
      case AttackType.RANGED:
        return bonuses?.defenseRanged ?? 0;
      case AttackType.MAGIC:
        return bonuses?.defenseMagic ?? 0;
      default:
        return 0;
    }
  }
} 