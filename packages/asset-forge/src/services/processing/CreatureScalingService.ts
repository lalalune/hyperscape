/**
 * Creature Scaling Service
 * Handles runtime scaling calculations for weapons based on creature size
 */

import { MIN_WEAPON_SIZES, MAX_WEAPON_SIZES, BASE_WEAPON_PROPORTIONS } from '../../constants'
import { CREATURE_SIZE_CATEGORIES, getCreatureCategory } from '../../types/NormalizationConventions'
import { safeScale } from '../../utils/safe-math'

export interface WeaponScaleResult {
  scaleFactor: number
  category: string
  reasoning: string
  constraints: {
    min: number
    max: number
    applied: boolean
  }
}

export class CreatureScalingService {

  /**
   * Get weapon scale factor for a creature
   */
  static getWeaponScaleForCreature(
    creatureHeight: number,
    weaponType: string,
    currentWeaponLength: number
  ): WeaponScaleResult {
    const category = getCreatureCategory(creatureHeight)
    const baseProportion = BASE_WEAPON_PROPORTIONS[weaponType.toLowerCase()] || 0.5
    
    // Calculate adaptive proportion based on creature size
    const adaptiveProportion = this.calculateAdaptiveProportion(
      creatureHeight,
      weaponType,
      baseProportion
    )
    
    // Calculate ideal weapon length
    const idealWeaponLength = creatureHeight * adaptiveProportion

    // Calculate scale factor (protected against division by zero)
    let scaleFactor = safeScale(idealWeaponLength, currentWeaponLength, 1)

    // Apply constraints
    const minSize = MIN_WEAPON_SIZES[weaponType.toLowerCase()] || 0.1
    const maxSize = MAX_WEAPON_SIZES[weaponType.toLowerCase()] || 5.0

    const scaledLength = currentWeaponLength * scaleFactor
    let constraintApplied = false

    if (scaledLength < minSize) {
      scaleFactor = safeScale(minSize, currentWeaponLength, 1)
      constraintApplied = true
    } else if (scaledLength > maxSize) {
      scaleFactor = safeScale(maxSize, currentWeaponLength, 1)
      constraintApplied = true
    }
    
    // Generate reasoning
    const reasoning = this.generateScalingReasoning(
      creatureHeight,
      category,
      weaponType,
      adaptiveProportion,
      constraintApplied
    )
    
    return {
      scaleFactor,
      category,
      reasoning,
      constraints: {
        min: safeScale(minSize, currentWeaponLength, 1),
        max: safeScale(maxSize, currentWeaponLength, 1),
        applied: constraintApplied
      }
    }
  }
  
  /**
   * Calculate adaptive proportion based on creature size
   */
  private static calculateAdaptiveProportion(
    creatureHeight: number,
    weaponType: string,
    baseProportion: number
  ): number {
    const category = getCreatureCategory(creatureHeight)
    
    // Scaling curves for different size categories
    switch (category) {
      case 'tiny':
        // Tiny creatures need proportionally larger weapons
        return this.getTinyCreatureWeaponProportion(weaponType, baseProportion)
        
      case 'small':
        // Small creatures use slightly larger proportions
        return baseProportion * 1.1
        
      case 'medium':
        // Medium creatures use base proportions
        return baseProportion
        
      case 'large':
        // Large creatures use slightly smaller proportions
        return baseProportion * 0.9
        
      case 'huge':
        // Huge creatures use smaller proportions
        return this.getHugeCreatureWeaponProportion(weaponType, baseProportion)
        
      case 'gargantuan':
        // Gargantuan creatures use much smaller proportions
        return this.getGargantuanWeaponProportion(weaponType, baseProportion)
        
      default:
        return baseProportion
    }
  }
  
  /**
   * Get weapon proportion for tiny creatures
   */
  private static getTinyCreatureWeaponProportion(
    weaponType: string,
    baseProportion: number
  ): number {
    // Tiny creatures need weapons that are visible
    const tinyMultipliers: Record<string, number> = {
      sword: 1.5,      // 150% of base
      dagger: 1.8,     // Daggers become like swords
      staff: 1.2,      // Staves stay relatively large
      wand: 2.0,       // Wands need to be visible
    }
    
    const multiplier = tinyMultipliers[weaponType.toLowerCase()] || 1.4
    return baseProportion * multiplier
  }
  
  /**
   * Get weapon proportion for huge creatures
   */
  private static getHugeCreatureWeaponProportion(
    weaponType: string,
    baseProportion: number
  ): number {
    // Huge creatures use smaller proportions to avoid absurd sizes
    const hugeMultipliers: Record<string, number> = {
      sword: 0.7,      // 70% of base
      staff: 0.6,      // Staves don't need to be huge
      spear: 0.5,      // Spears scale down more
    }
    
    const multiplier = hugeMultipliers[weaponType.toLowerCase()] || 0.7
    return baseProportion * multiplier
  }
  
  /**
   * Get weapon proportion for gargantuan creatures
   */
  private static getGargantuanWeaponProportion(
    weaponType: string,
    baseProportion: number
  ): number {
    // Gargantuan creatures use much smaller proportions
    const gargMultipliers: Record<string, number> = {
      sword: 0.5,      // 50% of base
      staff: 0.4,      // Even smaller for polearms
      spear: 0.35,     // Spears become relatively tiny
    }
    
    const multiplier = gargMultipliers[weaponType.toLowerCase()] || 0.5
    return baseProportion * multiplier
  }
  
  /**
   * Generate human-readable reasoning for scaling
   */
  private static generateScalingReasoning(
    creatureHeight: number,
    category: string,
    weaponType: string,
    proportion: number,
    constraintApplied: boolean
  ): string {
    const categoryInfo = CREATURE_SIZE_CATEGORIES[category as keyof typeof CREATURE_SIZE_CATEGORIES]
    
    let reasoning = `${categoryInfo.name} creature (${creatureHeight.toFixed(1)}m) `
    reasoning += `using ${weaponType} with ${(proportion * 100).toFixed(0)}% height proportion. `
    
    if (constraintApplied) {
      reasoning += `Scale limited by ${weaponType} size constraints.`
    }
    
    return reasoning
  }
  
  /**
   * Get recommended weapon types for creature size
   */
  static getRecommendedWeapons(creatureHeight: number): string[] {
    const category = getCreatureCategory(creatureHeight)
    
    switch (category) {
      case 'tiny':
        return ['dagger', 'wand', 'shortbow', 'dart']
        
      case 'small':
        return ['shortsword', 'dagger', 'shortbow', 'mace']
        
      case 'medium':
        return ['sword', 'axe', 'bow', 'staff', 'shield']
        
      case 'large':
        return ['greatsword', 'battleaxe', 'spear', 'tower shield']
        
      case 'huge':
        return ['giant sword', 'tree trunk club', 'massive spear']
        
      case 'gargantuan':
        return ['colossal blade', 'siege weapon', 'monument weapon']
        
      default:
        return ['sword', 'axe', 'bow']
    }
  }
  
  /**
   * Calculate visual thickness multiplier for large weapons
   */
  static getThicknessMultiplier(creatureHeight: number): number {
    const category = getCreatureCategory(creatureHeight)
    
    switch (category) {
      case 'tiny':
        return 0.8  // Slightly thinner for visibility
        
      case 'small':
        return 1.0
        
      case 'medium':
        return 1.0
        
      case 'large':
        return 1.2
        
      case 'huge':
        return 1.5  // Thicker for visual weight
        
      case 'gargantuan':
        return 2.0  // Much thicker for massive feel
        
      default:
        return 1.0
    }
  }
} 