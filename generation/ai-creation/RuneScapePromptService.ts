/**
 * RuneScape-Specific Prompt Augmentation Service
 * 
 * Generates prompts that create authentic OSRS-style models with proper
 * visual identity, proportions, and RuneScape-specific characteristics.
 */

export interface RuneScapeConfig {
  visualStyle: 'osrs' | 'rs3' | 'classic'
  polyCount: 'ultra_low' | 'low' | 'medium'
  colorPalette: 'authentic' | 'enhanced' | 'modern'
  includeSkillContext: boolean
  includeCombatLevel: boolean
  includeQuestContext: boolean
}

export interface RuneScapeItemData {
  id: number
  name: string
  examine: string
  value: number
  weight: number
  members: boolean
  tradeable: boolean
  
  // RuneScape-specific fields
  skillRequirements?: { [skill: string]: number }
  combatStats?: {
    attackSpeed: number
    attackStyle: string[]
    specialAttack?: string
  }
  questItem?: boolean
  holidayItem?: boolean
  godAlignment?: 'saradomin' | 'zamorak' | 'guthix' | 'armadyl' | 'bandos' | 'ancient'
  skillCategory?: 'combat' | 'mining' | 'woodcutting' | 'fishing' | 'cooking' | 'magic' | 'prayer'
}

export interface RuneScapeMobData {
  id: number
  name: string
  examine: string
  combatLevel: number
  maxHitpoints: number
  
  // RuneScape-specific fields
  slayerLevel?: number
  location: string[]
  weaknesses?: string[]
  immunities?: string[]
  drops: string[]
  isUndead?: boolean
  isDragon?: boolean
  isDemon?: boolean
  aggressive: boolean
  size: 'tiny' | 'small' | 'medium' | 'large' | 'giant'
  animations: {
    idle: string
    walk: string
    attack: string
    death: string
  }
}

export interface RuneScapePromptResult {
  enhancedPrompt: string
  negativePrompt: string
  artStyleDirectives: string[]
  geometryConstraints: string[]
  colorPaletteHints: string[]
  animationHints: string[]
  runescapeMetadata: {
    itemTier: 'bronze' | 'iron' | 'steel' | 'mithril' | 'adamant' | 'rune' | 'dragon' | 'barrows' | 'godsword'
    skillLevel: number
    questSeries?: string
    combatRole?: 'melee' | 'ranged' | 'magic' | 'defense'
    uniqueFeatures: string[]
  }
}

export class RuneScapePromptService {
  private config: RuneScapeConfig

  constructor(config: Partial<RuneScapeConfig> = {}) {
    this.config = {
      visualStyle: 'osrs',
      polyCount: 'low',
      colorPalette: 'authentic',
      includeSkillContext: true,
      includeCombatLevel: true,
      includeQuestContext: true,
      ...config
    }
  }

  /**
   * Generate RuneScape-specific weapon prompts
   */
  generateWeaponPrompt(
    itemData: RuneScapeItemData,
    weaponType: string
  ): RuneScapePromptResult {
    const tier = this.extractTier(itemData.name)
    const skillLevel = this.getRequiredSkillLevel(itemData, 'Attack')
    
    // Base RuneScape visual style
    let prompt = `${itemData.name}, RuneScape OSRS style`
    
    // Add tier-specific materials and colors
    prompt += `, ${this.getTierMaterials(tier)}`
    prompt += `, ${this.getTierColors(tier)}`
    
    // Add weapon-specific RuneScape orientation
    prompt += `, ${this.getRuneScapeWeaponOrientation(weaponType)}`
    
    // Add chunky, angular geometry requirements
    prompt += `, low-poly angular geometry, chunky proportions`
    prompt += `, simple flat textures, bold color blocks`
    prompt += `, minimal gradients, clean edges`
    
    // Add weapon-specific details
    if (weaponType === 'scimitar') {
      prompt += `, curved blade, distinctive RuneScape scimitar shape`
      prompt += `, ornate hilt design, ${tier} scimitar proportions`
    } else if (weaponType === 'longsword') {
      prompt += `, straight double-edged blade, classic longsword shape`
      prompt += `, cruciform crossguard, ${tier} longsword styling`
    } else if (weaponType === 'dagger') {
      prompt += `, short pointed blade, compact design`
      if (itemData.name.includes('poisoned')) {
        prompt += `, green poison coating, toxic appearance`
      }
    } else if (weaponType === 'battleaxe') {
      prompt += `, heavy double-bladed head, thick wooden handle`
      prompt += `, intimidating design, ${tier} battleaxe proportions`
    } else if (weaponType === 'bow') {
      prompt += `, traditional longbow shape, curved wooden limbs`
      prompt += `, hemp bowstring, ${this.getBowMaterials(tier)}`
    } else if (weaponType === 'crossbow') {
      prompt += `, mechanical crossbow design, steel prod`
      prompt += `, wooden stock, trigger mechanism visible`
    }
    
    // Add special weapon features
    if (itemData.combatStats?.specialAttack) {
      prompt += `, ${this.getSpecialAttackVisuals(itemData.name, itemData.combatStats.specialAttack)}`
    }
    
    // Add god alignment visuals
    if (itemData.godAlignment) {
      prompt += `, ${this.getGodAlignmentVisuals(itemData.godAlignment)}`
    }
    
    // Add quest item styling
    if (itemData.questItem) {
      prompt += `, unique quest item appearance, distinctive design`
    }
    
    const negativePrompt = this.getRuneScapeNegativePrompt('weapon')
    
    return {
      enhancedPrompt: prompt,
      negativePrompt,
      artStyleDirectives: this.getArtStyleDirectives(),
      geometryConstraints: this.getGeometryConstraints(weaponType),
      colorPaletteHints: this.getColorPaletteHints(tier),
      animationHints: this.getWeaponAnimationHints(weaponType),
      runescapeMetadata: {
        itemTier: tier,
        skillLevel,
        combatRole: this.getCombatRole(weaponType),
        uniqueFeatures: this.getUniqueFeatures(itemData)
      }
    }
  }

  /**
   * Generate RuneScape-specific character/mob prompts
   */
  generateMobPrompt(
    mobData: RuneScapeMobData
  ): RuneScapePromptResult {
    let prompt = `${mobData.name}, RuneScape OSRS creature`
    
    // Add creature-specific styling
    const creatureType = this.getCreatureType(mobData.name)
    prompt += `, ${this.getCreatureVisuals(creatureType, mobData)}`
    
    // Add size-based proportions
    prompt += `, ${this.getSizeProportions(mobData.size, mobData.combatLevel)}`
    
    // Add RuneScape creature characteristics
    prompt += `, chunky angular design, simple flat textures`
    prompt += `, bold primary colors, minimal detail`
    prompt += `, characteristic RuneScape creature proportions`
    
    // Add combat level visual indicators
    if (this.config.includeCombatLevel) {
      prompt += `, ${this.getCombatLevelVisuals(mobData.combatLevel)}`
    }
    
    // Add special creature features
    if (mobData.isDragon) {
      prompt += `, dragon wings, long tail, reptilian features`
      prompt += `, ${this.getDragonTypeVisuals(mobData.name)}`
    } else if (mobData.isUndead) {
      prompt += `, skeletal features, glowing eye sockets`
      prompt += `, bone and metal construction, undead appearance`
    } else if (mobData.isDemon) {
      prompt += `, demonic features, menacing appearance`
      prompt += `, dark coloration, supernatural elements`
    }
    
    // Add location-specific adaptations
    if (mobData.location.includes('wilderness')) {
      prompt += `, battle-scarred appearance, aggressive stance`
    } else if (mobData.location.includes('dungeon')) {
      prompt += `, adapted to dark environments, pale coloration`
    }
    
    // T-pose for rigging
    prompt += `, full body in T-pose, arms extended horizontally`
    prompt += `, facing forward, orthographic front view`
    prompt += `, clear silhouette, symmetrical pose`
    
    const negativePrompt = this.getRuneScapeNegativePrompt('creature')
    
    return {
      enhancedPrompt: prompt,
      negativePrompt,
      artStyleDirectives: this.getArtStyleDirectives(),
      geometryConstraints: this.getCreatureGeometryConstraints(mobData.size),
      colorPaletteHints: this.getCreatureColorHints(creatureType),
      animationHints: this.getCreatureAnimationHints(mobData.animations),
      runescapeMetadata: {
        itemTier: this.getCombatTier(mobData.combatLevel),
        skillLevel: mobData.slayerLevel || 1,
        uniqueFeatures: this.getCreatureUniqueFeatures(mobData)
      }
    }
  }

  /**
   * Generate prompts for RuneScape skill tools
   */
  generateSkillToolPrompt(
    itemData: RuneScapeItemData,
    skillType: string
  ): RuneScapePromptResult {
    const tier = this.extractTier(itemData.name)
    const skillLevel = this.getRequiredSkillLevel(itemData, skillType)
    
    let prompt = `${itemData.name}, RuneScape ${skillType} tool`
    
    // Add skill-specific visual characteristics
    if (skillType === 'Mining') {
      prompt += `, pickaxe design, pointed metal head`
      prompt += `, sturdy wooden handle, ${tier} pickaxe styling`
      prompt += `, mining tool proportions, functional design`
    } else if (skillType === 'Woodcutting') {
      prompt += `, axe design, sharp metal blade`
      prompt += `, wooden handle, ${tier} hatchet styling`
      prompt += `, woodcutting tool proportions, efficient cutting edge`
    } else if (skillType === 'Fishing') {
      prompt += `, fishing equipment design`
      if (itemData.name.includes('Net')) {
        prompt += `, fishing net, rope mesh construction`
      } else if (itemData.name.includes('Rod')) {
        prompt += `, fishing rod, long flexible shaft`
      } else if (itemData.name.includes('Harpoon')) {
        prompt += `, harpoon design, barbed spear tip`
      }
    }
    
    // Add tier materials and colors
    prompt += `, ${this.getTierMaterials(tier)}`
    prompt += `, ${this.getTierColors(tier)}`
    
    // Add RuneScape styling
    prompt += `, RuneScape OSRS style, low-poly design`
    prompt += `, chunky proportions, simple textures`
    
    // Add tool-specific hardpoint hints
    prompt += `, ${this.getSkillToolHardpoints(skillType)}`
    
    const negativePrompt = this.getRuneScapeNegativePrompt('tool')
    
    return {
      enhancedPrompt: prompt,
      negativePrompt,
      artStyleDirectives: this.getArtStyleDirectives(),
      geometryConstraints: this.getToolGeometryConstraints(skillType),
      colorPaletteHints: this.getColorPaletteHints(tier),
      animationHints: this.getSkillToolAnimationHints(skillType),
      runescapeMetadata: {
        itemTier: tier,
        skillLevel,
        combatRole: undefined,
        uniqueFeatures: this.getSkillToolFeatures(itemData, skillType)
      }
    }
  }

  /**
   * Generate prompts for RuneScape consumables
   */
  generateConsumablePrompt(
    itemData: RuneScapeItemData
  ): RuneScapePromptResult {
    let prompt = `${itemData.name}, RuneScape OSRS consumable`
    
    const consumableType = this.getConsumableType(itemData.name)
    
    if (consumableType === 'food') {
      prompt += `, ${this.getFoodVisuals(itemData.name)}`
    } else if (consumableType === 'potion') {
      prompt += `, ${this.getPotionVisuals(itemData.name)}`
    } else if (consumableType === 'rune') {
      prompt += `, ${this.getRuneVisuals(itemData.name)}`
    }
    
    // Add RuneScape styling
    prompt += `, RuneScape OSRS style, simple design`
    prompt += `, bold colors, clean shapes, iconic appearance`
    
    // Add viewing angle
    prompt += `, isometric 3/4 view, centered on surface`
    prompt += `, good lighting, clear details`
    
    const negativePrompt = this.getRuneScapeNegativePrompt('consumable')
    
    return {
      enhancedPrompt: prompt,
      negativePrompt,
      artStyleDirectives: this.getArtStyleDirectives(),
      geometryConstraints: this.getConsumableGeometryConstraints(consumableType),
      colorPaletteHints: this.getConsumableColorHints(consumableType),
      animationHints: [],
      runescapeMetadata: {
        itemTier: 'bronze', // Consumables don't have tiers
        skillLevel: 1,
        uniqueFeatures: this.getConsumableFeatures(itemData)
      }
    }
  }

  // Helper methods for RuneScape-specific content

  private extractTier(itemName: string): 'bronze' | 'iron' | 'steel' | 'mithril' | 'adamant' | 'rune' | 'dragon' | 'barrows' | 'godsword' {
    const name = itemName.toLowerCase()
    if (name.includes('bronze')) return 'bronze'
    if (name.includes('iron')) return 'iron'
    if (name.includes('steel')) return 'steel'
    if (name.includes('mithril')) return 'mithril'
    if (name.includes('adamant')) return 'adamant'
    if (name.includes('rune')) return 'rune'
    if (name.includes('dragon')) return 'dragon'
    if (name.includes('abyssal') || name.includes('whip')) return 'barrows'
    if (name.includes('godsword')) return 'godsword'
    return 'bronze'
  }

  private getTierMaterials(tier: string): string {
    const materials = {
      bronze: 'bronze metal, copper-tin alloy, dull metallic finish',
      iron: 'iron metal, gray steel, matte metallic surface',
      steel: 'polished steel, bright metal, refined finish',
      mithril: 'mithril metal, blue-tinted steel, magical sheen',
      adamant: 'green adamantite, emerald-tinted metal, crystalline structure',
      rune: 'cyan runite, magical blue metal, enchanted surface',
      dragon: 'red dragon metal, crimson steel, ornate design',
      barrows: 'dark corrupted metal, purple-black finish, ancient patina',
      godsword: 'divine metal, golden accents, godly radiance'
    }
    return materials[tier as keyof typeof materials] || materials.bronze
  }

  private getTierColors(tier: string): string {
    const colors = {
      bronze: 'orange-brown bronze color, copper tones',
      iron: 'dark gray iron color, metallic gray',
      steel: 'bright silver steel color, polished metal',
      mithril: 'blue-tinted silver, magical blue highlights',
      adamant: 'green metal color, emerald adamant tones',
      rune: 'cyan blue color, magical blue glow',
      dragon: 'red dragon color, crimson and gold accents',
      barrows: 'dark purple-black, corrupted metal tones',
      godsword: 'golden divine color, radiant metallic finish'
    }
    return colors[tier as keyof typeof colors] || colors.bronze
  }

  private getRuneScapeWeaponOrientation(weaponType: string): string {
    const orientations = {
      scimitar: 'vertical orientation, curved blade upward, handle down',
      longsword: 'vertical orientation, blade pointing up, straight alignment',
      dagger: 'vertical orientation, point up, compact size',
      battleaxe: 'vertical orientation, axe head up, handle down',
      bow: 'vertical orientation, bowstring facing left, arrow nocking point visible',
      crossbow: 'horizontal orientation, bolt channel pointing left, top-down view',
      staff: 'vertical orientation, magical head up, staff length visible',
      shield: 'vertical front view, shield face toward camera, arm grips visible'
    }
    return orientations[weaponType as keyof typeof orientations] || 'vertical orientation, functional position'
  }

  private getSpecialAttackVisuals(weaponName: string, specialAttack: string): string {
    if (weaponName.includes('Dragon Dagger')) {
      return 'twin curved blades, poison coating capability, special attack design'
    } else if (weaponName.includes('Granite Maul')) {
      return 'massive stone head, devastating crushing design, special attack weight'
    } else if (weaponName.includes('Abyssal Whip')) {
      return 'demonic whip design, dark tentacle-like appearance, abyssal energy'
    }
    return 'special attack enhancement, unique combat features'
  }

  private getGodAlignmentVisuals(alignment: string): string {
    const alignments = {
      saradomin: 'blue and white color scheme, holy symbols, divine radiance',
      zamorak: 'red and black color scheme, demonic features, dark energy',
      guthix: 'green and brown color scheme, natural elements, balanced design',
      armadyl: 'yellow and white color scheme, avian motifs, wind elements',
      bandos: 'brown and gray color scheme, orcish design, brutal appearance',
      ancient: 'purple and gold color scheme, mystical runes, ancient power'
    }
    return alignments[alignment as keyof typeof alignments] || 'neutral divine design'
  }

  private getCreatureVisuals(creatureType: string, mobData: RuneScapeMobData): string {
    if (creatureType === 'goblin') {
      return 'green skin, pointed ears, small humanoid, crude armor'
    } else if (creatureType === 'skeleton') {
      return 'bone structure, glowing eyes, ancient armor, undead appearance'
    } else if (creatureType === 'cow') {
      return 'black and white cow pattern, peaceful farm animal, simple design'
    } else if (creatureType === 'rat') {
      return 'brown fur, long tail, rodent features, appropriate size scaling'
    } else if (creatureType === 'dragon') {
      return 'reptilian scales, wings, long neck, breath weapon capability'
    }
    return 'characteristic RuneScape creature design'
  }

  private getSizeProportions(size: string, combatLevel: number): string {
    const sizeMultiplier = Math.max(1, Math.floor(combatLevel / 10))
    
    const proportions = {
      tiny: `very small size, ${0.5 * sizeMultiplier}x normal proportions`,
      small: `small size, ${0.8 * sizeMultiplier}x normal proportions`,
      medium: `normal size, ${1.0 * sizeMultiplier}x standard proportions`,
      large: `large size, ${1.5 * sizeMultiplier}x increased proportions`,
      giant: `giant size, ${2.0 * sizeMultiplier}x massive proportions`
    }
    
    return proportions[size as keyof typeof proportions] || proportions.medium
  }

  private getRuneScapeNegativePrompt(type: string): string {
    const base = 'high detail, realistic textures, smooth gradients, complex geometry, modern graphics'
    
    const specific = {
      weapon: 'bent blade, broken handle, unrealistic proportions, generic fantasy design',
      creature: 'realistic animal features, complex textures, non-OSRS proportions',
      tool: 'modern tool design, complex mechanisms, realistic wear patterns',
      consumable: 'photorealistic food, complex packaging, modern design elements'
    }
    
    return `${base}, ${specific[type as keyof typeof specific] || ''}`
  }

  private getArtStyleDirectives(): string[] {
    return [
      'RuneScape OSRS visual style',
      'Low-poly angular geometry',
      'Chunky exaggerated proportions',
      'Simple flat textures',
      'Bold primary colors',
      'Minimal detail complexity',
      'Clean geometric edges',
      'Iconic game asset appearance'
    ]
  }

  private getGeometryConstraints(weaponType: string): string[] {
    return [
      'Low polygon count (under 1000 triangles)',
      'Angular geometric shapes',
      'No complex curves or smooth surfaces',
      'Clear distinct edges',
      'Simple primitive-based construction',
      'Optimized for game engine rendering'
    ]
  }

  private getColorPaletteHints(tier: string): string[] {
    const palettes = {
      bronze: ['#CD7F32', '#8B4513', '#D2691E'],
      iron: ['#708090', '#2F4F4F', '#696969'],
      steel: ['#C0C0C0', '#A9A9A9', '#DCDCDC'],
      mithril: ['#4169E1', '#6495ED', '#87CEEB'],
      adamant: ['#228B22', '#32CD32', '#98FB98'],
      rune: ['#00BFFF', '#1E90FF', '#87CEFA'],
      dragon: ['#DC143C', '#FF6347', '#FFD700']
    }
    return palettes[tier as keyof typeof palettes] || palettes.bronze
  }

  private getUniqueFeatures(itemData: RuneScapeItemData): string[] {
    const features: string[] = []
    
    if (itemData.questItem) features.push('Quest item styling')
    if (itemData.holidayItem) features.push('Holiday event design')
    if (itemData.godAlignment) features.push(`${itemData.godAlignment} god alignment`)
    if (itemData.combatStats?.specialAttack) features.push('Special attack capability')
    if (itemData.members) features.push('Members-only design elements')
    
    return features
  }

  // Additional helper methods would continue here...
  // (Implementing all the remaining private methods for complete functionality)

  private getRequiredSkillLevel(itemData: RuneScapeItemData, skill: string): number {
    return itemData.skillRequirements?.[skill] || 1
  }

  private getCombatRole(weaponType: string): 'melee' | 'ranged' | 'magic' | 'defense' {
    if (['bow', 'crossbow'].includes(weaponType)) return 'ranged'
    if (['staff', 'wand'].includes(weaponType)) return 'magic'
    if (weaponType === 'shield') return 'defense'
    return 'melee'
  }

  private getCreatureType(name: string): string {
    const lowerName = name.toLowerCase()
    if (lowerName.includes('goblin')) return 'goblin'
    if (lowerName.includes('skeleton')) return 'skeleton'
    if (lowerName.includes('cow')) return 'cow'
    if (lowerName.includes('rat')) return 'rat'
    if (lowerName.includes('dragon')) return 'dragon'
    return 'generic'
  }

  private getCombatTier(combatLevel: number): 'bronze' | 'iron' | 'steel' | 'mithril' | 'adamant' | 'rune' | 'dragon' | 'barrows' | 'godsword' {
    if (combatLevel <= 10) return 'bronze'
    if (combatLevel <= 30) return 'iron'
    if (combatLevel <= 60) return 'steel'
    if (combatLevel <= 90) return 'mithril'
    if (combatLevel <= 120) return 'adamant'
    if (combatLevel <= 150) return 'rune'
    if (combatLevel <= 200) return 'dragon'
    return 'barrows'
  }

  private getCombatLevelVisuals(combatLevel: number): string {
    if (combatLevel < 20) return 'weak enemy appearance, basic design'
    if (combatLevel < 50) return 'moderate threat appearance, enhanced features'
    if (combatLevel < 100) return 'strong enemy appearance, intimidating design'
    return 'boss-level appearance, epic proportions, legendary design'
  }

  private getDragonTypeVisuals(name: string): string {
    if (name.includes('Green')) return 'green scales, poison breath capability'
    if (name.includes('Red')) return 'red scales, fire breath design'
    if (name.includes('Blue')) return 'blue scales, magical energy aura'
    if (name.includes('Black')) return 'black scales, dark energy emanation'
    return 'classic dragon features, powerful presence'
  }

  private getCreatureGeometryConstraints(size: string): string[] {
    const baseTris = {
      tiny: 300,
      small: 500,
      medium: 800,
      large: 1200,
      giant: 1500
    }
    
    const triangles = baseTris[size as keyof typeof baseTris] || 800
    
    return [
      `Low polygon count (under ${triangles} triangles)`,
      'Chunky creature proportions',
      'Simple geometric features',
      'Clear silhouette definition',
      'Optimized for T-pose rigging'
    ]
  }

  private getCreatureColorHints(creatureType: string): string[] {
    const colors = {
      goblin: ['#228B22', '#32CD32', '#8B4513'],
      skeleton: ['#F5F5DC', '#DCDCDC', '#696969'],
      cow: ['#000000', '#FFFFFF', '#DEB887'],
      rat: ['#8B4513', '#A0522D', '#D2691E'],
      dragon: ['#DC143C', '#228B22', '#4169E1']
    }
    return colors[creatureType as keyof typeof colors] || ['#808080', '#A9A9A9', '#DCDCDC']
  }

  private getCreatureAnimationHints(animations: any): string[] {
    return [
      'Simple keyframe animations',
      'Characteristic RuneScape movement style',
      'Exaggerated gesture animations',
      'Combat stance variations',
      'Death animation compatibility'
    ]
  }

  private getCreatureUniqueFeatures(mobData: RuneScapeMobData): string[] {
    const features: string[] = []
    
    if (mobData.isDragon) features.push('Dragon creature type')
    if (mobData.isUndead) features.push('Undead creature type')
    if (mobData.isDemon) features.push('Demonic creature type')
    if (mobData.slayerLevel) features.push(`Slayer level ${mobData.slayerLevel} requirement`)
    if (mobData.aggressive) features.push('Aggressive behavior')
    
    return features
  }

  // Placeholder implementations for remaining methods
  private getBowMaterials(tier: string): string { return `${tier} bow materials` }
  private getSkillToolHardpoints(skillType: string): string { return `${skillType} tool grip points` }
  private getToolGeometryConstraints(skillType: string): string[] { return [`${skillType} tool constraints`] }
  private getSkillToolAnimationHints(skillType: string): string[] { return [`${skillType} animations`] }
  private getSkillToolFeatures(itemData: RuneScapeItemData, skillType: string): string[] { return [`${skillType} features`] }
  private getWeaponAnimationHints(weaponType: string): string[] { return [`${weaponType} combat animations`] }
  private getConsumableType(name: string): string { return 'food' }
  private getFoodVisuals(name: string): string { return 'food appearance' }
  private getPotionVisuals(name: string): string { return 'potion bottle design' }
  private getRuneVisuals(name: string): string { return 'magical rune design' }
  private getConsumableGeometryConstraints(type: string): string[] { return [`${type} constraints`] }
  private getConsumableColorHints(type: string): string[] { return [`${type} colors`] }
  private getConsumableFeatures(itemData: RuneScapeItemData): string[] { return ['consumable features'] }
}