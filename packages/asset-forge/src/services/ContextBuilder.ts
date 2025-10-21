/**
 * Context Builder Service
 * 
 * Builds rich context from game manifests to inject into AI prompts
 * Ensures AI generates content that fits existing game world
 * 
 * Key responsibilities:
 * - Filter items/mobs by level tier
 * - List existing NPCs to avoid duplication
 * - Format manifest data for AI prompts
 * - Inject relationships and lore context
 * 
 * Based on pipeline's context-builder.ts
 */

import { manifestService } from './ManifestService'
import type { ItemManifest, MobManifest, NPCManifest, ResourceManifest } from '../types/manifests'
import type { GeneratedQuest, GeneratedNPC, LoreEntry } from '../types/content-generation'
import type { EntityRelationship } from '../types/relationships'
import { getTierForDifficulty, type LevelTier } from '../utils/level-progression'

export interface QuestGenerationContext {
  availableItems: ItemManifest[]
  availableMobs: MobManifest[]
  availableResources: ResourceManifest[]
  existingNPCs: NPCManifest[]
  existingQuests: GeneratedQuest[]
  tier: LevelTier
  relationships?: EntityRelationship[]
  lore?: LoreEntry[]
}

export interface NPCGenerationContext {
  existingNPCs: Array<{ name: string; archetype: string; id: string }>
  generatedNPCs: GeneratedNPC[]
  availableQuests: GeneratedQuest[]
  relationships?: EntityRelationship[]
  lore?: LoreEntry[]
}

export class ContextBuilder {
  /**
   * Build context for quest generation with tier-appropriate content
   */
  async buildQuestContext(params: {
    difficulty: string
    questType: string
    existingQuests: GeneratedQuest[]
    selectedContext?: {
      items?: string[]
      mobs?: string[]
      npcs?: string[]
      lore?: string[]
    }
    relationships?: EntityRelationship[]
  }): Promise<{ context: QuestGenerationContext; formatted: string }> {
    // Get tier for difficulty
    const tier = getTierForDifficulty(params.difficulty)
    
    // Load all manifests
    const manifests = await manifestService.fetchAllManifests()
    
    // Filter by level range
    const availableItems = (manifests.items || []).filter(
      item => {
        const itemLevel = item.level || 1
        return itemLevel >= tier.levelRange.min && itemLevel <= tier.levelRange.max
      }
    )
    
    const availableMobs = (manifests.mobs || []).filter(
      mob => {
        const mobLevel = mob.combatLevel || mob.level || 1
        return mobLevel >= tier.levelRange.min && mobLevel <= tier.levelRange.max
      }
    )
    
    const availableResources = (manifests.resources || []).filter(
      resource => {
        const resourceLevel = resource.level || 1
        return resourceLevel >= tier.levelRange.min && resourceLevel <= tier.levelRange.max
      }
    )
    
    const existingNPCs = manifests.npcs || []
    
    const context: QuestGenerationContext = {
      availableItems,
      availableMobs,
      availableResources,
      existingNPCs,
      existingQuests: params.existingQuests,
      tier,
      relationships: params.relationships,
      lore: params.selectedContext?.lore ? [] : undefined // TODO: load lore by IDs
    }
    
    // Format for AI prompt
    const formatted = this.formatQuestContext(context, params.selectedContext)
    
    return { context, formatted }
  }
  
  /**
   * Build context for NPC generation with existing world data
   */
  async buildNPCContext(params: {
    archetype: string
    generatedNPCs: GeneratedNPC[]
    availableQuests: GeneratedQuest[]
    relationships?: EntityRelationship[]
    lore?: LoreEntry[]
  }): Promise<{ context: NPCGenerationContext; formatted: string }> {
    const manifests = await manifestService.fetchAllManifests()
    
    const context: NPCGenerationContext = {
      existingNPCs: (manifests.npcs || []).map(npc => ({
        name: npc.name,
        archetype: npc.npcType,
        id: npc.id
      })),
      generatedNPCs: params.generatedNPCs,
      availableQuests: params.availableQuests,
      relationships: params.relationships,
      lore: params.lore
    }
    
    const formatted = this.formatNPCContext(context)
    
    return { context, formatted }
  }
  
  /**
   * Format quest context for AI prompt
   */
  private formatQuestContext(
    context: QuestGenerationContext,
    selectedContext?: { items?: string[]; mobs?: string[]; npcs?: string[]; lore?: string[] }
  ): string {
    let prompt = `
WORLD CONTEXT FOR QUEST GENERATION
===================================

TIER: ${context.tier.name} (${context.tier.material})
LEVEL RANGE: ${context.tier.levelRange.min}-${context.tier.levelRange.max}
DIFFICULTY: ${context.tier.difficulty}

`
    
    // Available items
    if (context.availableItems.length > 0) {
      prompt += `\nAVAILABLE ITEMS (use these IDs):\n`
      context.availableItems.slice(0, 15).forEach(item => {
        const isSelected = selectedContext?.items?.includes(item.id)
        prompt += `${isSelected ? '★ ' : '  '}- ${item.id}: ${item.name} (value: ${item.value || 0}g, level: ${item.level || 1})\n`
      })
      if (context.availableItems.length > 15) {
        prompt += `  ... and ${context.availableItems.length - 15} more items\n`
      }
    }
    
    // Available mobs
    if (context.availableMobs.length > 0) {
      prompt += `\nAVAILABLE MOBS (use these IDs for combat objectives):\n`
      context.availableMobs.slice(0, 15).forEach(mob => {
        const isSelected = selectedContext?.mobs?.includes(mob.id)
        const drops = mob.drops && mob.drops.length > 0 ? mob.drops.join(', ') : 'none'
        prompt += `${isSelected ? '★ ' : '  '}- ${mob.id}: ${mob.name} (level: ${mob.combatLevel || mob.level || 1}, xp: ${mob.xp || 0}, drops: ${drops})\n`
      })
      if (context.availableMobs.length > 15) {
        prompt += `  ... and ${context.availableMobs.length - 15} more mobs\n`
      }
    }
    
    // Available resources
    if (context.availableResources.length > 0) {
      prompt += `\nAVAILABLE RESOURCES (for gathering objectives):\n`
      context.availableResources.slice(0, 10).forEach(resource => {
        prompt += `  - ${resource.id}: ${resource.name} (level: ${resource.level || 1}, xp: ${resource.xp || 0})\n`
      })
    }
    
    // Existing NPCs
    if (context.existingNPCs.length > 0) {
      prompt += `\nEXISTING NPCs (potential quest givers):\n`
      context.existingNPCs.slice(0, 10).forEach(npc => {
        const isSelected = selectedContext?.npcs?.includes(npc.id)
        prompt += `${isSelected ? '★ ' : '  '}- ${npc.id}: ${npc.name} (${npc.npcType})\n`
      })
    }
    
    // Existing quests (avoid duplication)
    if (context.existingQuests.length > 0) {
      prompt += `\nEXISTING QUESTS (avoid duplicating these):\n`
      context.existingQuests.forEach(quest => {
        prompt += `  - ${quest.title} (${quest.type || quest.difficulty})\n`
      })
    }
    
    // Relationships
    if (context.relationships && context.relationships.length > 0) {
      prompt += `\nRELATIONSHIPS:\n`
      context.relationships.slice(0, 8).forEach(rel => {
        prompt += `  - ${rel.fromId} → ${rel.toId}: ${rel.type} (strength: ${rel.strength})\n`
      })
    }
    
    prompt += `\n
CRITICAL INSTRUCTIONS:
- Use ONLY the item/mob/resource IDs listed above in rewards and objectives
- Ensure level requirements are within ${context.tier.levelRange.min}-${context.tier.levelRange.max}
- Only suggest NEW items/mobs if absolutely necessary and clearly mark them as [NEW]
- Avoid duplicating existing quest types
- Items marked with ★ are user-selected priorities
`
    
    return prompt
  }
  
  /**
   * Format NPC context for AI prompt
   */
  private formatNPCContext(context: NPCGenerationContext): string {
    let prompt = `
WORLD CONTEXT FOR NPC GENERATION
==================================

`
    
    // Existing manifest NPCs
    if (context.existingNPCs.length > 0) {
      prompt += `\nEXISTING NPCs (avoid duplicating personalities):\n`
      context.existingNPCs.forEach(npc => {
        prompt += `  - ${npc.name} (${npc.archetype})\n`
      })
    }
    
    // Generated NPCs
    if (context.generatedNPCs.length > 0) {
      prompt += `\nGENERATED NPCs (be unique from these):\n`
      context.generatedNPCs.forEach(npc => {
        prompt += `  - ${npc.personality.name} (${npc.personality.archetype})\n`
      })
    }
    
    // Available quests that NPC could reference
    if (context.availableQuests.length > 0) {
      prompt += `\nAVAILABLE QUESTS (NPC can offer these):\n`
      context.availableQuests.forEach(quest => {
        prompt += `  - ${quest.id}: ${quest.title}\n`
      })
    }
    
    // Relationships
    if (context.relationships && context.relationships.length > 0) {
      prompt += `\nEXISTING RELATIONSHIPS:\n`
      context.relationships.forEach(rel => {
        prompt += `  - ${rel.fromId} → ${rel.toId}: ${rel.type} (${rel.strength})\n`
      })
    }
    
    prompt += `\n
CRITICAL INSTRUCTIONS:
- Create a unique personality different from existing NPCs
- Can reference available quests in dialogue
- Can establish relationships with existing NPCs
`
    
    return prompt
  }
  
  /**
   * Get all context as formatted string
   */
  async buildFullContext(params: {
    difficulty?: string
    archetype?: string
    existingQuests?: GeneratedQuest[]
    generatedNPCs?: GeneratedNPC[]
    selectedItems?: string[]
    selectedMobs?: string[]
    selectedNPCs?: string[]
  }): Promise<string> {
    const manifests = await manifestService.fetchAllManifests()
    
    let context = 'GAME WORLD CONTEXT\n==================\n\n'
    
    // Total counts
    context += `WORLD INVENTORY:\n`
    context += `  - ${manifests.items?.length || 0} items\n`
    context += `  - ${manifests.mobs?.length || 0} mobs\n`
    context += `  - ${manifests.npcs?.length || 0} NPCs\n`
    context += `  - ${manifests.resources?.length || 0} resources\n`
    context += `  - ${params.existingQuests?.length || 0} quests\n\n`
    
    return context
  }
}

export const contextBuilder = new ContextBuilder()

