/**
 * Prompt Augmentation Service for Meshy AI Generation
 * 
 * Provides intelligent prompt enhancement for different item types with specific
 * orientation, positioning, and style requirements for optimal 3D generation.
 */

export interface PromptAugmentationConfig {
  includeStyle?: boolean
  includeOrientation?: boolean
  includeMaterials?: boolean
  includeQuality?: boolean
  artStyle?: 'realistic' | 'cartoon' | 'low-poly' | 'fantasy' | 'pbr'
  targetPolycount?: 'low' | 'medium' | 'high'
}

export interface OrientationRules {
  pose?: string
  cameraAngle?: string
  facing?: string
  position?: string
  additionalConstraints?: string[]
}

export interface WeaponHardpointHints {
  primaryGripLocation: string
  secondaryGripLocation?: string
  projectileDirection?: string
  attachmentPoints?: string[]
  orientationHints: string[]
}

export interface AugmentedPrompt {
  enhancedPrompt: string
  negativePrompt: string
  orientationRules: OrientationRules
  hardpointHints?: WeaponHardpointHints
  expectedDimensions?: { width: number; height: number; depth: number }
  artStyle: string
  metadata: {
    itemType: string
    weaponType?: string
    category: string
    complexity: 'simple' | 'medium' | 'complex'
  }
}

export class PromptAugmentationService {
  private config: PromptAugmentationConfig

  constructor(config: PromptAugmentationConfig = {}) {
    this.config = {
      includeStyle: true,
      includeOrientation: true,
      includeMaterials: true,
      includeQuality: true,
      artStyle: 'realistic',
      targetPolycount: 'medium',
      ...config
    }
  }

  /**
   * Augment prompt for weapons with specific orientation requirements
   */
  augmentWeaponPrompt(
    basePrompt: string,
    weaponType: string,
    itemData?: any
  ): AugmentedPrompt {
    const orientationRules = this.getWeaponOrientationRules(weaponType)
    const hardpointHints = this.getWeaponHardpointHints(weaponType)
    
    let enhancedPrompt = basePrompt

    // Add weapon-specific positioning
    if (this.config.includeOrientation) {
      enhancedPrompt += `, ${orientationRules.pose || ''}`
      enhancedPrompt += `, ${orientationRules.cameraAngle || ''}`
      enhancedPrompt += `, ${orientationRules.facing || ''}`
      enhancedPrompt += `, ${orientationRules.position || ''}`
      
      if (orientationRules.additionalConstraints) {
        enhancedPrompt += `, ${orientationRules.additionalConstraints.join(', ')}`
      }
    }

    // Add material and style enhancements
    if (this.config.includeMaterials) {
      enhancedPrompt += `, ${this.getWeaponMaterials(weaponType)}`
    }

    // Add quality and technical requirements
    if (this.config.includeQuality) {
      enhancedPrompt += `, ${this.getQualityEnhancements()}`
    }

    // Add weapon-specific style
    if (this.config.includeStyle) {
      enhancedPrompt += `, ${this.getWeaponStyleEnhancements(weaponType)}`
    }

    const negativePrompt = this.getWeaponNegativePrompt(weaponType)

    return {
      enhancedPrompt: this.cleanPrompt(enhancedPrompt),
      negativePrompt,
      orientationRules,
      hardpointHints,
      expectedDimensions: this.getWeaponDimensions(weaponType),
      artStyle: this.config.artStyle!,
      metadata: {
        itemType: 'weapon',
        weaponType,
        category: this.getWeaponCategory(weaponType),
        complexity: this.getWeaponComplexity(weaponType)
      }
    }
  }

  /**
   * Augment prompt for characters/mobs with T-pose requirements
   */
  augmentCharacterPrompt(
    basePrompt: string,
    characterType: string,
    itemData?: any
  ): AugmentedPrompt {
    const orientationRules: OrientationRules = {
      pose: 'T-pose with arms extended horizontally',
      cameraAngle: 'orthographic front view',
      facing: 'facing forward toward camera',
      position: 'standing upright on flat ground',
      additionalConstraints: [
        'symmetrical pose',
        'feet shoulder-width apart',
        'neutral facial expression',
        'clear silhouette'
      ]
    }

    let enhancedPrompt = basePrompt

    if (this.config.includeOrientation) {
      enhancedPrompt += `, full body character in T-pose`
      enhancedPrompt += `, arms extended horizontally`
      enhancedPrompt += `, facing forward toward camera`
      enhancedPrompt += `, orthographic view`
      enhancedPrompt += `, standing on flat ground`
      enhancedPrompt += `, symmetrical pose`
      enhancedPrompt += `, clear silhouette`
    }

    if (this.config.includeStyle) {
      enhancedPrompt += `, humanoid proportions`
      enhancedPrompt += `, game-ready character`
      enhancedPrompt += `, clean topology`
    }

    if (this.config.includeQuality) {
      enhancedPrompt += `, ${this.getQualityEnhancements()}`
    }

    const negativePrompt = this.getCharacterNegativePrompt()

    return {
      enhancedPrompt: this.cleanPrompt(enhancedPrompt),
      negativePrompt,
      orientationRules,
      expectedDimensions: { width: 2, height: 6, depth: 1 },
      artStyle: this.config.artStyle!,
      metadata: {
        itemType: 'character',
        category: characterType,
        complexity: 'complex'
      }
    }
  }

  /**
   * Augment prompt for consumables and misc items
   */
  augmentConsumablePrompt(
    basePrompt: string,
    itemType: string,
    itemData?: any
  ): AugmentedPrompt {
    const orientationRules: OrientationRules = {
      cameraAngle: 'isometric 3/4 view',
      position: 'centered on flat surface',
      additionalConstraints: [
        'good lighting',
        'clear details',
        'stable base'
      ]
    }

    let enhancedPrompt = basePrompt

    if (this.config.includeOrientation) {
      enhancedPrompt += `, isometric 3/4 view`
      enhancedPrompt += `, centered on flat surface`
      enhancedPrompt += `, well-lit`
    }

    if (this.config.includeStyle) {
      enhancedPrompt += `, detailed textures`
      enhancedPrompt += `, game asset style`
    }

    if (this.config.includeQuality) {
      enhancedPrompt += `, ${this.getQualityEnhancements()}`
    }

    const negativePrompt = this.getConsumableNegativePrompt()

    return {
      enhancedPrompt: this.cleanPrompt(enhancedPrompt),
      negativePrompt,
      orientationRules,
      expectedDimensions: { width: 1, height: 1, depth: 1 },
      artStyle: this.config.artStyle!,
      metadata: {
        itemType: 'consumable',
        category: itemType,
        complexity: 'simple'
      }
    }
  }

  /**
   * Get orientation rules for specific weapon types
   */
  private getWeaponOrientationRules(weaponType: string): OrientationRules {
    const rules: Record<string, OrientationRules> = {
      sword: {
        pose: 'vertical orientation with blade pointing up',
        cameraAngle: 'side profile view',
        facing: 'blade edge facing left',
        position: 'point upward, hilt at bottom',
        additionalConstraints: [
          'straight blade alignment',
          'handle clearly visible',
          'full weapon in frame'
        ]
      },
      axe: {
        pose: 'vertical orientation with blade up',
        cameraAngle: 'side profile view',
        facing: 'cutting edge facing left',
        position: 'blade up, handle down',
        additionalConstraints: [
          'axe head clearly defined',
          'handle grip visible',
          'balanced composition'
        ]
      },
      bow: {
        pose: 'vertical orientation',
        cameraAngle: 'side profile view',
        facing: 'string facing left, arrow rest visible',
        position: 'upright position',
        additionalConstraints: [
          'bowstring clearly visible',
          'arrow rest on left side',
          'grip section centered',
          'projectile direction leftward'
        ]
      },
      crossbow: {
        pose: 'horizontal orientation',
        cameraAngle: 'top-down view',
        facing: 'bolt channel pointing left',
        position: 'firing direction toward left',
        additionalConstraints: [
          'trigger mechanism visible',
          'bolt rail pointing left',
          'stock extending rightward',
          'sight alignment clear'
        ]
      },
      dagger: {
        pose: 'vertical orientation',
        cameraAngle: 'side profile view',
        facing: 'blade edge facing left',
        position: 'point up, handle down',
        additionalConstraints: [
          'blade clearly defined',
          'handle grip visible',
          'compact design'
        ]
      },
      staff: {
        pose: 'vertical orientation',
        cameraAngle: 'side profile view',
        facing: 'front facing',
        position: 'upright, tip at top',
        additionalConstraints: [
          'full length visible',
          'ornamental details clear',
          'grip section identifiable'
        ]
      },
      shield: {
        pose: 'vertical orientation',
        cameraAngle: 'front view',
        facing: 'shield face toward camera',
        position: 'upright defensive position',
        additionalConstraints: [
          'arm straps visible on back',
          'shield boss centered',
          'heraldic design clear'
        ]
      },
      mace: {
        pose: 'vertical orientation',
        cameraAngle: 'side profile view',
        facing: 'striking surface visible',
        position: 'head up, handle down',
        additionalConstraints: [
          'mace head clearly defined',
          'handle grip visible',
          'weight distribution apparent'
        ]
      }
    }

    return rules[weaponType] || rules.sword
  }

  /**
   * Get hardpoint hints for weapon types
   */
  private getWeaponHardpointHints(weaponType: string): WeaponHardpointHints {
    const hints: Record<string, WeaponHardpointHints> = {
      sword: {
        primaryGripLocation: 'center of handle/hilt area',
        orientationHints: [
          'grip wraps around handle',
          'thumb along blade spine',
          'blade extends upward from grip'
        ]
      },
      axe: {
        primaryGripLocation: 'handle shaft, below axe head',
        secondaryGripLocation: 'end of handle for two-handed grip',
        orientationHints: [
          'dominant hand near axe head',
          'support hand at handle end',
          'swing arc from right to left'
        ]
      },
      bow: {
        primaryGripLocation: 'bow grip/riser section',
        projectileDirection: 'arrows fly leftward from string',
        orientationHints: [
          'grip in center of bow',
          'arrow nocked on left side',
          'draw hand pulls string rightward'
        ]
      },
      crossbow: {
        primaryGripLocation: 'pistol grip or stock',
        projectileDirection: 'bolts fire leftward',
        orientationHints: [
          'trigger hand on grip',
          'support hand on fore-end',
          'bolts loaded from top, fire left'
        ]
      },
      dagger: {
        primaryGripLocation: 'handle grip',
        orientationHints: [
          'reverse or forward grip',
          'blade extends from fist',
          'compact weapon'
        ]
      },
      staff: {
        primaryGripLocation: 'shaft grip area',
        secondaryGripLocation: 'secondary grip for two-handed use',
        orientationHints: [
          'main hand in center',
          'off-hand for balance',
          'tip for striking or casting'
        ]
      },
      shield: {
        primaryGripLocation: 'arm strap attachment point',
        attachmentPoints: ['arm strap', 'handle grip'],
        orientationHints: [
          'forearm through arm strap',
          'hand grips handle',
          'shield face outward'
        ]
      },
      mace: {
        primaryGripLocation: 'handle shaft',
        orientationHints: [
          'grip on handle',
          'mace head for striking',
          'swing with momentum'
        ]
      }
    }

    return hints[weaponType] || hints.sword
  }

  /**
   * Get weapon-specific materials
   */
  private getWeaponMaterials(weaponType: string): string {
    const materials: Record<string, string> = {
      sword: 'steel blade, leather-wrapped handle, metal crossguard',
      axe: 'steel blade, wooden handle, metal bindings',
      bow: 'wood or composite materials, bowstring, leather grip',
      crossbow: 'wood stock, steel prod, metal trigger mechanism',
      dagger: 'steel blade, leather or metal handle',
      staff: 'wood or metal shaft, ornamental head piece',
      shield: 'wood or metal construction, leather straps',
      mace: 'metal head, wooden or metal handle'
    }

    return materials[weaponType] || 'realistic materials'
  }

  /**
   * Get weapon style enhancements
   */
  private getWeaponStyleEnhancements(weaponType: string): string {
    return 'medieval fantasy style, game-ready asset, detailed craftsmanship, battle-worn appearance'
  }

  /**
   * Get quality enhancement terms
   */
  private getQualityEnhancements(): string {
    const quality = {
      low: 'game-ready, optimized topology',
      medium: 'high quality, detailed, game-ready, clean topology',
      high: 'ultra detailed, photorealistic, perfect topology, AAA game quality'
    }

    return quality[this.config.targetPolycount!]
  }

  /**
   * Get weapon-specific negative prompts
   */
  private getWeaponNegativePrompt(weaponType: string): string {
    const base = 'low quality, blurry, distorted, broken, incomplete, deformed, missing parts'
    
    const specific: Record<string, string> = {
      sword: 'bent blade, broken hilt, missing crossguard',
      axe: 'cracked blade, splintered handle, unbalanced',
      bow: 'broken string, cracked limbs, asymmetrical',
      crossbow: 'broken mechanism, misaligned parts',
      dagger: 'dull blade, broken handle',
      staff: 'cracked shaft, unstable structure',
      shield: 'dented face, broken straps, holes',
      mace: 'detached head, splintered handle'
    }

    return `${base}, ${specific[weaponType] || ''}`
  }

  /**
   * Get character negative prompts
   */
  private getCharacterNegativePrompt(): string {
    return 'low quality, blurry, distorted, broken, incomplete, deformed, missing limbs, extra limbs, asymmetrical, not T-pose, arms down, sitting, crouching, side view, back view, multiple characters'
  }

  /**
   * Get consumable negative prompts
   */
  private getConsumableNegativePrompt(): string {
    return 'low quality, blurry, distorted, broken, incomplete, floating, unstable, poor lighting, cluttered background'
  }

  /**
   * Get weapon dimensions
   */
  private getWeaponDimensions(weaponType: string): { width: number; height: number; depth: number } {
    const dimensions: Record<string, { width: number; height: number; depth: number }> = {
      sword: { width: 0.1, height: 3, depth: 0.05 },
      axe: { width: 0.8, height: 2.5, depth: 0.2 },
      bow: { width: 0.1, height: 4, depth: 0.8 },
      crossbow: { width: 2, height: 1, depth: 0.3 },
      dagger: { width: 0.05, height: 1, depth: 0.03 },
      staff: { width: 0.05, height: 5, depth: 0.05 },
      shield: { width: 1.5, height: 2, depth: 0.2 },
      mace: { width: 0.3, height: 2, depth: 0.3 }
    }

    return dimensions[weaponType] || { width: 1, height: 2, depth: 0.1 }
  }

  /**
   * Get weapon category
   */
  private getWeaponCategory(weaponType: string): string {
    const categories: Record<string, string> = {
      sword: 'melee_blade',
      axe: 'melee_blade', 
      bow: 'ranged_projectile',
      crossbow: 'ranged_projectile',
      dagger: 'melee_blade',
      staff: 'melee_magic',
      shield: 'defensive',
      mace: 'melee_blunt'
    }

    return categories[weaponType] || 'melee'
  }

  /**
   * Get weapon complexity
   */
  private getWeaponComplexity(weaponType: string): 'simple' | 'medium' | 'complex' {
    const complexity: Record<string, 'simple' | 'medium' | 'complex'> = {
      sword: 'medium',
      axe: 'medium',
      bow: 'complex',
      crossbow: 'complex',
      dagger: 'simple',
      staff: 'medium',
      shield: 'medium',
      mace: 'simple'
    }

    return complexity[weaponType] || 'medium'
  }

  /**
   * Clean and optimize prompt text
   */
  private cleanPrompt(prompt: string): string {
    return prompt
      .split(',')
      .map(part => part.trim())
      .filter(part => part.length > 0)
      .join(', ')
      .replace(/,\s*,/g, ',')
      .replace(/^\s*,\s*/, '')
  }
}