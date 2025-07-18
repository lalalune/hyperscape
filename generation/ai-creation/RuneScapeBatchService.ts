/**
 * RuneScape-Specific Batch Generation Service
 * 
 * Handles OSRS-specific batch generation with knowledge of tiers, skills,
 * quest items, holiday items, and RuneScape content organization.
 */

import { MeshyAIService } from './MeshyAIService'
import { RuneScapePromptService, RuneScapeItemData, RuneScapeMobData } from './RuneScapePromptService'
import { RuneScapeHardpointService } from './RuneScapeHardpointService'
import { BatchGenerationService, GenerationResult } from './BatchGenerationService'

export interface RuneScapeGenerationConfig {
  prioritizeByTier: boolean
  prioritizeBySkillLevel: boolean
  prioritizeQuestItems: boolean
  prioritizeHolidayItems: boolean
  generateMissingTiersOnly: boolean
  batchByCategory: boolean
  maxConcurrentPerTier: number
  enableRuneScapeHardpoints: boolean
  enableTierProgression: boolean
}

export interface RuneScapeGenerationResult extends GenerationResult {
  // Additional OSRS-specific metadata
  runescapeMetadata: {
    tier: string
    skillRequirements: { [skill: string]: number }
    questSeries?: string
    holidayEvent?: string
    godAlignment?: string
    combatRole?: string
    specialFeatures: string[]
    osrsItemId: number
    wikiUrl?: string
    releaseDate?: string
    updateHistory?: string[]
  }
  
  // Enhanced hardpoint data
  osrsHardpoints?: any // RuneScapeHardpoints from the other service
  
  // Visual verification
  visualConsistency: {
    osrsStyleScore: number
    tierAccuracy: number
    proportionScore: number
    colorAccuracy: number
    recommendedAdjustments: string[]
  }
}

export interface RuneScapeBatchProgress {
  totalItems: number
  completedByTier: { [tier: string]: number }
  completedBySkill: { [skill: string]: number }
  questItemsCompleted: number
  holidayItemsCompleted: number
  averageOSRSScore: number
  tierProgression: {
    bronze: number
    iron: number
    steel: number
    mithril: number
    adamant: number
    rune: number
    dragon: number
    special: number
  }
  currentPhase: 'tier_analysis' | 'skill_sorting' | 'quest_items' | 'holiday_items' | 'batch_generation' | 'osrs_validation' | 'completed'
}

export class RuneScapeBatchService {
  private meshyService: MeshyAIService
  private osrsPromptService: RuneScapePromptService
  private osrsHardpointService: RuneScapeHardpointService
  private baseBatchService: BatchGenerationService
  private config: RuneScapeGenerationConfig

  constructor(
    meshyService: MeshyAIService,
    config: Partial<RuneScapeGenerationConfig> = {}
  ) {
    this.meshyService = meshyService
    this.osrsPromptService = new RuneScapePromptService({
      visualStyle: 'osrs',
      polyCount: 'low',
      colorPalette: 'authentic',
      includeSkillContext: true,
      includeCombatLevel: true,
      includeQuestContext: true
    })
    this.osrsHardpointService = new RuneScapeHardpointService({
      confidenceThreshold: 0.8
    })
    this.baseBatchService = new BatchGenerationService(meshyService, {
      maxConcurrentTasks: 3,
      enableHardpointDetection: false, // We'll use our OSRS-specific service
      enableRetexturing: true
    })
    
    this.config = {
      prioritizeByTier: true,
      prioritizeBySkillLevel: true,
      prioritizeQuestItems: true,
      prioritizeHolidayItems: true,
      generateMissingTiersOnly: false,
      batchByCategory: true,
      maxConcurrentPerTier: 2,
      enableRuneScapeHardpoints: true,
      enableTierProgression: true,
      ...config
    }
  }

  /**
   * Generate all RuneScape items with OSRS-specific processing
   */
  async generateRuneScapeItems(
    itemsData: RuneScapeItemData[]
  ): Promise<RuneScapeGenerationResult[]> {
    console.log(`🎯 Starting OSRS item generation for ${itemsData.length} items`)

    // Phase 1: Analyze and categorize items
    const categorizedItems = this.categorizeOSRSItems(itemsData)
    
    // Phase 2: Determine generation priority
    const prioritizedBatches = this.prioritizeOSRSBatches(categorizedItems)
    
    // Phase 3: Generate by priority
    const results: RuneScapeGenerationResult[] = []
    
    for (const batch of prioritizedBatches) {
      console.log(`📦 Processing ${batch.category} batch (${batch.items.length} items)`)
      
      const batchResults = await this.processBatch(batch.items, batch.category)
      results.push(...batchResults)
      
      // Phase 4: OSRS-specific validation
      await this.validateOSRSConsistency(batchResults)
    }

    // Phase 5: Generate comprehensive OSRS report
    await this.generateOSRSReport(results)

    return results
  }

  /**
   * Generate RuneScape mobs with creature-specific handling
   */
  async generateRuneScapeMobs(
    mobsData: RuneScapeMobData[]
  ): Promise<RuneScapeGenerationResult[]> {
    console.log(`👹 Starting OSRS mob generation for ${mobsData.length} creatures`)

    // Categorize by combat level and creature type
    const categorizedMobs = this.categorizeMobsByLevel(mobsData)
    
    const results: RuneScapeGenerationResult[] = []
    
    for (const levelGroup of categorizedMobs) {
      console.log(`🏹 Processing combat level ${levelGroup.minLevel}-${levelGroup.maxLevel} (${levelGroup.mobs.length} creatures)`)
      
      const mobResults = await this.processMobBatch(levelGroup.mobs)
      results.push(...mobResults)
    }

    return results
  }

  /**
   * Generate tier progression sets (Bronze → Iron → Steel → etc.)
   */
  async generateTierProgression(
    baseItemName: string,
    tiers: string[] = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'dragon']
  ): Promise<RuneScapeGenerationResult[]> {
    console.log(`⚡ Generating tier progression for ${baseItemName}`)

    const tierItems: RuneScapeItemData[] = tiers.map((tier, index) => ({
      id: 1000 + index,
      name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} ${baseItemName}`,
      examine: `A ${tier} ${baseItemName.toLowerCase()}.`,
      value: Math.pow(2, index) * 10,
      weight: 2.0 + (index * 0.3),
      members: tier === 'dragon',
      tradeable: true,
      skillRequirements: { Attack: index * 10, Strength: index * 10 },
      combatStats: {
        attackSpeed: 4,
        attackStyle: ['accurate', 'aggressive', 'defensive'],
        specialAttack: tier === 'dragon' ? `${tier} special attack` : undefined
      }
    }))

    // Generate in order to maintain visual consistency
    const results: RuneScapeGenerationResult[] = []
    
    for (const tierItem of tierItems) {
      console.log(`🔨 Generating ${tierItem.name}...`)
      
      const tierResult = await this.generateSingleOSRSItem(tierItem)
      results.push(tierResult)
      
      // Use previous tier as reference for consistency
      if (results.length > 1) {
        await this.ensureTierConsistency(results[results.length - 2], tierResult)
      }
    }

    return results
  }

  /**
   * Generate quest item series with story context
   */
  async generateQuestSeries(
    questName: string,
    questItems: RuneScapeItemData[]
  ): Promise<RuneScapeGenerationResult[]> {
    console.log(`📜 Generating quest series: ${questName}`)

    const results: RuneScapeGenerationResult[] = []
    
    for (const questItem of questItems) {
      console.log(`🎯 Generating quest item: ${questItem.name}`)
      
      // Add quest context to item
      const questItemData: RuneScapeItemData = {
        ...questItem,
        questItem: true,
        tradeable: false, // Most quest items aren't tradeable
      }
      
      const result = await this.generateSingleOSRSItem(questItemData)
      
      // Add quest-specific metadata
      result.runescapeMetadata.questSeries = questName
      result.runescapeMetadata.specialFeatures.push('Quest item')
      
      results.push(result)
    }

    return results
  }

  /**
   * Generate single OSRS item with full pipeline
   */
  private async generateSingleOSRSItem(
    itemData: RuneScapeItemData
  ): Promise<RuneScapeGenerationResult> {
    const startTime = Date.now()

    // Phase 1: Generate OSRS-specific prompt
    const weaponType = this.extractWeaponType(itemData.name)
    const promptResult = weaponType 
      ? this.osrsPromptService.generateWeaponPrompt(itemData, weaponType)
      : this.osrsPromptService.generateConsumablePrompt(itemData)

    // Phase 2: Generate 3D model via Meshy
    const meshyTaskId = await this.meshyService.textTo3D({
      prompt: promptResult.enhancedPrompt,
      artStyle: 'low-poly' as any,
      negativePrompt: promptResult.negativePrompt,
      topology: 'quad'
    })

    // Phase 3: Wait for completion
    const meshyResult = await this.meshyService.waitForCompletion(meshyTaskId)

    // Phase 4: Detect OSRS-specific hardpoints
    let osrsHardpoints = undefined
    if (this.config.enableRuneScapeHardpoints && weaponType) {
      const mockGeometry = { vertices: [], triangles: [] } // In practice, parse from meshyResult
      const weaponData = {
        name: itemData.name,
        weaponType,
        attackSpeed: itemData.combatStats?.attackSpeed || 4,
        attackStyles: itemData.combatStats?.attackStyle || ['accurate'],
        specialAttack: itemData.combatStats?.specialAttack ? {
          name: itemData.combatStats.specialAttack,
          description: `${itemData.name} special attack`,
          drainAmount: 50,
          animations: ['special_attack']
        } : undefined,
        combatLevelRequirement: itemData.skillRequirements?.Attack || 1,
        tier: this.extractTier(itemData.name)
      }
      
      osrsHardpoints = await this.osrsHardpointService.detectRuneScapeWeaponHardpoints(
        mockGeometry,
        weaponData
      )
    }

    // Phase 5: Validate OSRS visual consistency
    const visualConsistency = this.validateOSRSVisuals(itemData, promptResult)

    // Phase 6: Create enhanced result
    const result: RuneScapeGenerationResult = {
      id: `osrs_item_${itemData.id}`,
      status: 'completed',
      meshyTaskId,
      modelUrls: meshyResult.model_urls,
      osrsHardpoints,
      metadata: {
        generatedAt: Date.now(),
        processingTime: Date.now() - startTime,
        cacheHit: false,
        retryCount: 0
      },
      runescapeMetadata: {
        tier: this.extractTier(itemData.name),
        skillRequirements: itemData.skillRequirements || {},
        questSeries: itemData.questItem ? 'Unknown Quest' : undefined,
        holidayEvent: itemData.holidayItem ? 'Holiday Event' : undefined,
        godAlignment: itemData.godAlignment,
        combatRole: promptResult.runescapeMetadata?.combatRole,
        specialFeatures: this.extractSpecialFeatures(itemData),
        osrsItemId: itemData.id,
        wikiUrl: `https://oldschool.runescape.wiki/w/${encodeURIComponent(itemData.name)}`,
        releaseDate: '2013-02-22', // OSRS launch date as default
        updateHistory: []
      },
      visualConsistency
    }

    return result
  }

  /**
   * Categorize OSRS items by type and priority
   */
  private categorizeOSRSItems(items: RuneScapeItemData[]): Array<{
    category: string
    items: RuneScapeItemData[]
    priority: number
  }> {
    const categories = new Map<string, RuneScapeItemData[]>()

    for (const item of items) {
      let category = 'misc'
      
      if (item.questItem) {
        category = 'quest_items'
      } else if (item.holidayItem) {
        category = 'holiday_items'
      } else if (item.skillCategory) {
        category = `skill_${item.skillCategory}`
      } else if (this.isWeapon(item)) {
        category = `weapons_${this.extractTier(item.name)}`
      } else if (this.isArmor(item)) {
        category = `armor_${this.extractTier(item.name)}`
      } else if (item.stackable) {
        category = 'consumables'
      }

      if (!categories.has(category)) {
        categories.set(category, [])
      }
      categories.get(category)!.push(item)
    }

    // Convert to prioritized array
    const prioritized = Array.from(categories.entries()).map(([category, items]) => ({
      category,
      items,
      priority: this.getCategoryPriority(category)
    }))

    return prioritized.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Prioritize OSRS batches based on importance
   */
  private prioritizeOSRSBatches(
    categorized: Array<{ category: string; items: RuneScapeItemData[]; priority: number }>
  ): Array<{ category: string; items: RuneScapeItemData[] }> {
    const batches: Array<{ category: string; items: RuneScapeItemData[] }> = []

    // Sort by priority and create smaller batches for high-priority items
    for (const category of categorized) {
      if (category.priority >= 8) {
        // High priority: process individually
        for (const item of category.items) {
          batches.push({
            category: `${category.category}_individual`,
            items: [item]
          })
        }
      } else if (category.priority >= 5) {
        // Medium priority: small batches
        const batchSize = 3
        for (let i = 0; i < category.items.length; i += batchSize) {
          batches.push({
            category: category.category,
            items: category.items.slice(i, i + batchSize)
          })
        }
      } else {
        // Low priority: larger batches
        batches.push(category)
      }
    }

    return batches
  }

  /**
   * Process a batch of items with OSRS-specific handling
   */
  private async processBatch(
    items: RuneScapeItemData[],
    category: string
  ): Promise<RuneScapeGenerationResult[]> {
    const results: RuneScapeGenerationResult[] = []

    // Process items with appropriate concurrency for category
    const concurrency = category.includes('quest') || category.includes('holiday') ? 1 : 2
    
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency)
      const batchPromises = batch.map(item => this.generateSingleOSRSItem(item))
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Process mob batch with creature-specific handling
   */
  private async processMobBatch(mobs: RuneScapeMobData[]): Promise<RuneScapeGenerationResult[]> {
    const results: RuneScapeGenerationResult[] = []

    for (const mob of mobs) {
      const startTime = Date.now()

      // Generate OSRS creature prompt
      const promptResult = this.osrsPromptService.generateMobPrompt(mob)

      // Generate via Meshy
      const meshyTaskId = await this.meshyService.textTo3D({
        prompt: promptResult.enhancedPrompt,
        artStyle: 'low-poly' as any,
        negativePrompt: promptResult.negativePrompt,
        topology: 'quad'
      })

      const meshyResult = await this.meshyService.waitForCompletion(meshyTaskId)

      const result: RuneScapeGenerationResult = {
        id: `osrs_mob_${mob.id}`,
        status: 'completed',
        meshyTaskId,
        modelUrls: meshyResult.model_urls,
        metadata: {
          generatedAt: Date.now(),
          processingTime: Date.now() - startTime,
          cacheHit: false,
          retryCount: 0
        },
        runescapeMetadata: {
          tier: this.getCombatTier(mob.combatLevel),
          skillRequirements: { Slayer: mob.slayerLevel || 1 },
          combatRole: 'monster',
          specialFeatures: this.getMobSpecialFeatures(mob),
          osrsItemId: mob.id,
          wikiUrl: `https://oldschool.runescape.wiki/w/${encodeURIComponent(mob.name)}`,
          releaseDate: '2013-02-22'
        },
        visualConsistency: this.validateMobVisuals(mob, promptResult)
      }

      results.push(result)
    }

    return results
  }

  /**
   * Categorize mobs by combat level for batch processing
   */
  private categorizeMobsByLevel(mobs: RuneScapeMobData[]): Array<{
    minLevel: number
    maxLevel: number
    mobs: RuneScapeMobData[]
  }> {
    const levelGroups = [
      { minLevel: 1, maxLevel: 10, mobs: [] as RuneScapeMobData[] },
      { minLevel: 11, maxLevel: 30, mobs: [] as RuneScapeMobData[] },
      { minLevel: 31, maxLevel: 60, mobs: [] as RuneScapeMobData[] },
      { minLevel: 61, maxLevel: 100, mobs: [] as RuneScapeMobData[] },
      { minLevel: 101, maxLevel: 200, mobs: [] as RuneScapeMobData[] },
      { minLevel: 201, maxLevel: 999, mobs: [] as RuneScapeMobData[] }
    ]

    for (const mob of mobs) {
      const group = levelGroups.find(g => 
        mob.combatLevel >= g.minLevel && mob.combatLevel <= g.maxLevel
      )
      if (group) {
        group.mobs.push(mob)
      }
    }

    return levelGroups.filter(g => g.mobs.length > 0)
  }

  /**
   * Validate OSRS visual consistency
   */
  private validateOSRSVisuals(
    itemData: RuneScapeItemData,
    promptResult: any
  ): {
    osrsStyleScore: number
    tierAccuracy: number
    proportionScore: number
    colorAccuracy: number
    recommendedAdjustments: string[]
  } {
    const osrsStyleScore = this.calculateOSRSStyleScore(promptResult)
    const tierAccuracy = this.calculateTierAccuracy(itemData, promptResult)
    const proportionScore = this.calculateProportionScore(itemData, promptResult)
    const colorAccuracy = this.calculateColorAccuracy(itemData, promptResult)

    const recommendedAdjustments: string[] = []
    
    if (osrsStyleScore < 0.8) recommendedAdjustments.push('Increase low-poly angular geometry')
    if (tierAccuracy < 0.8) recommendedAdjustments.push('Adjust tier-specific materials and colors')
    if (proportionScore < 0.7) recommendedAdjustments.push('Modify proportions for OSRS chunky style')
    if (colorAccuracy < 0.7) recommendedAdjustments.push('Use more authentic OSRS color palette')

    return {
      osrsStyleScore,
      tierAccuracy,
      proportionScore,
      colorAccuracy,
      recommendedAdjustments
    }
  }

  // Helper methods
  private extractWeaponType(itemName: string): string | undefined {
    const name = itemName.toLowerCase()
    if (name.includes('sword') && name.includes('scimitar')) return 'scimitar'
    if (name.includes('sword')) return 'longsword'
    if (name.includes('dagger')) return 'dagger'
    if (name.includes('axe')) return 'battleaxe'
    if (name.includes('mace')) return 'mace'
    if (name.includes('bow')) return 'bow'
    if (name.includes('crossbow')) return 'crossbow'
    if (name.includes('staff')) return 'staff'
    if (name.includes('whip')) return 'whip'
    if (name.includes('shield')) return 'shield'
    return undefined
  }

  private extractTier(itemName: string): string {
    const name = itemName.toLowerCase()
    if (name.includes('bronze')) return 'bronze'
    if (name.includes('iron')) return 'iron'
    if (name.includes('steel')) return 'steel'
    if (name.includes('mithril')) return 'mithril'
    if (name.includes('adamant')) return 'adamant'
    if (name.includes('rune')) return 'rune'
    if (name.includes('dragon')) return 'dragon'
    return 'bronze'
  }

  private isWeapon(item: RuneScapeItemData): boolean {
    return !!this.extractWeaponType(item.name)
  }

  private isArmor(item: RuneScapeItemData): boolean {
    const name = item.name.toLowerCase()
    return ['helmet', 'platebody', 'platelegs', 'boots', 'gloves', 'shield'].some(type => name.includes(type))
  }

  private getCategoryPriority(category: string): number {
    if (category.includes('quest')) return 10
    if (category.includes('holiday')) return 9
    if (category.includes('dragon')) return 8
    if (category.includes('rune')) return 7
    if (category.includes('adamant')) return 6
    if (category.includes('weapon')) return 5
    if (category.includes('armor')) return 4
    return 3
  }

  private getCombatTier(combatLevel: number): string {
    if (combatLevel <= 10) return 'bronze'
    if (combatLevel <= 30) return 'iron'
    if (combatLevel <= 60) return 'steel'
    if (combatLevel <= 90) return 'mithril'
    if (combatLevel <= 120) return 'adamant'
    if (combatLevel <= 150) return 'rune'
    return 'dragon'
  }

  private extractSpecialFeatures(item: RuneScapeItemData): string[] {
    const features: string[] = []
    if (item.questItem) features.push('Quest item')
    if (item.holidayItem) features.push('Holiday item')
    if (item.members) features.push('Members only')
    if (item.combatStats?.specialAttack) features.push('Special attack')
    if (item.godAlignment) features.push(`${item.godAlignment} alignment`)
    return features
  }

  private getMobSpecialFeatures(mob: RuneScapeMobData): string[] {
    const features: string[] = []
    if (mob.isDragon) features.push('Dragon type')
    if (mob.isUndead) features.push('Undead type')
    if (mob.isDemon) features.push('Demon type')
    if (mob.slayerLevel) features.push(`Slayer level ${mob.slayerLevel}`)
    if (mob.aggressive) features.push('Aggressive')
    return features
  }

  // Placeholder validation methods
  private calculateOSRSStyleScore(promptResult: any): number { return 0.85 }
  private calculateTierAccuracy(itemData: RuneScapeItemData, promptResult: any): number { return 0.9 }
  private calculateProportionScore(itemData: RuneScapeItemData, promptResult: any): number { return 0.8 }
  private calculateColorAccuracy(itemData: RuneScapeItemData, promptResult: any): number { return 0.85 }
  private validateMobVisuals(mob: RuneScapeMobData, promptResult: any): any { return { osrsStyleScore: 0.8, tierAccuracy: 0.9, proportionScore: 0.85, colorAccuracy: 0.8, recommendedAdjustments: [] } }
  private async validateOSRSConsistency(results: RuneScapeGenerationResult[]): Promise<void> { /* Validate consistency */ }
  private async ensureTierConsistency(previous: RuneScapeGenerationResult, current: RuneScapeGenerationResult): Promise<void> { /* Ensure tier consistency */ }
  private async generateOSRSReport(results: RuneScapeGenerationResult[]): Promise<void> { /* Generate report */ }
}