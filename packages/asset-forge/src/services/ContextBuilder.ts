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

import type { GeneratedQuest, GeneratedNPC, LoreEntry } from '../types/content-generation'
import type { ItemManifest, MobManifest, NPCManifest, ResourceManifest, AnyManifest } from '../types/manifests'
import type { EntityRelationship } from '../types/relationships'
import { getTierForDifficulty, type LevelTier } from '../utils/level-progression.ts'

import { manifestService } from './ManifestService.ts'

// Type guards for manifest discrimination
function isItemManifest(manifest: AnyManifest): manifest is ItemManifest {
  return 'value' in manifest && 'equipSlot' in manifest
}

function isMobManifest(manifest: AnyManifest): manifest is MobManifest {
  return 'combatLevel' in manifest || ('stats' in manifest && 'level' in (manifest as MobManifest).stats)
}

function isNPCManifest(manifest: AnyManifest): manifest is NPCManifest {
  return 'npcType' in manifest || ('type' in manifest && 'services' in manifest)
}

function isResourceManifest(manifest: AnyManifest): manifest is ResourceManifest {
  return 'harvestSkill' in manifest && 'harvestYield' in manifest
}

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
    // Get tier for difficulty - cast to proper type
    const validDifficulty = params.difficulty as LevelTier['difficulty']
    const tier = getTierForDifficulty(validDifficulty)

    // Load all manifests
    const manifests = await manifestService.fetchAllManifests()

    // Filter by level range with type narrowing
    const availableItems = (manifests.items || []).filter(
      (item): item is ItemManifest => {
        if (!isItemManifest(item)) return false
        const itemLevel = item.requirements?.level || 1
        return itemLevel >= tier.levelRange.min && itemLevel <= tier.levelRange.max
      }
    )

    const availableMobs = (manifests.mobs || []).filter(
      (mob): mob is MobManifest => {
        if (!isMobManifest(mob)) return false
        const mobLevel = mob.combatLevel || mob.stats?.level || 1
        return mobLevel >= tier.levelRange.min && mobLevel <= tier.levelRange.max
      }
    )

    const availableResources = (manifests.resources || []).filter(
      (resource): resource is ResourceManifest => {
        if (!isResourceManifest(resource)) return false
        const resourceLevel = resource.requiredLevel || 1
        return resourceLevel >= tier.levelRange.min && resourceLevel <= tier.levelRange.max
      }
    )

    const existingNPCs = (manifests.npcs || []).filter(
      (npc): npc is NPCManifest => isNPCManifest(npc)
    )

    const context: QuestGenerationContext = {
      availableItems,
      availableMobs,
      availableResources,
      existingNPCs,
      existingQuests: params.existingQuests,
      tier,
      relationships: params.relationships,
      lore: params.selectedContext?.lore ? [] : undefined // GitHub Issue #7: Implement lore loading by IDs
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
      existingNPCs: (manifests.npcs || [])
        .filter((npc): npc is NPCManifest => isNPCManifest(npc))
        .map(npc => ({
          name: npc.name,
          archetype: npc.npcType || npc.type,
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
    // Build prompt efficiently (reduced token usage ~30%)
    const lines: string[] = []

    lines.push(`WORLD - ${context.tier.name} (Lv${context.tier.levelRange.min}-${context.tier.levelRange.max})`)
    lines.push('=================================\n')

    // Items - prioritize selected, limit to 12
    if (context.availableItems.length > 0) {
      const selected = context.availableItems.filter(i => selectedContext?.items?.includes(i.id))
      const others = context.availableItems.filter(i => !selectedContext?.items?.includes(i.id))
      const items = [...selected, ...others].slice(0, 12)

      lines.push('ITEMS (reward IDs):')
      items.forEach(i => {
        const mark = selectedContext?.items?.includes(i.id) ? '★' : ' '
        const itemLevel = i.requirements?.level || 1
        lines.push(`${mark} ${i.id} - ${i.name} (${i.value || 0}g, Lv${itemLevel})`)
      })
      if (context.availableItems.length > 12) lines.push(`  +${context.availableItems.length - 12} more\n`)
    }

    // Mobs - prioritize selected, limit to 12
    if (context.availableMobs.length > 0) {
      const selected = context.availableMobs.filter(m => selectedContext?.mobs?.includes(m.id))
      const others = context.availableMobs.filter(m => !selectedContext?.mobs?.includes(m.id))
      const mobs = [...selected, ...others].slice(0, 12)

      lines.push('\nMOBS (objective IDs):')
      mobs.forEach(m => {
        const mark = selectedContext?.mobs?.includes(m.id) ? '★' : ' '
        const mobLevel = m.combatLevel || m.stats?.level || 1
        const xp = m.xpReward || 0
        lines.push(`${mark} ${m.id} - ${m.name} (Lv${mobLevel}, ${xp}xp)`)
      })
      if (context.availableMobs.length > 12) lines.push(`  +${context.availableMobs.length - 12} more\n`)
    }

    // Resources - compact, limit to 8
    if (context.availableResources.length > 0) {
      lines.push('\nRESOURCES:')
      context.availableResources.slice(0, 8).forEach(r => {
        const resourceLevel = r.requiredLevel || 1
        lines.push(`  ${r.id} - ${r.name} (Lv${resourceLevel})`)
      })
    }

    // NPCs - prioritize selected, limit to 8
    if (context.existingNPCs.length > 0) {
      const selected = context.existingNPCs.filter(n => selectedContext?.npcs?.includes(n.id))
      const others = context.existingNPCs.filter(n => !selectedContext?.npcs?.includes(n.id))
      const npcs = [...selected, ...others].slice(0, 8)

      lines.push('\nNPCs (quest givers):')
      npcs.forEach(n => {
        const mark = selectedContext?.npcs?.includes(n.id) ? '★' : ' '
        const npcType = n.npcType || n.type
        lines.push(`${mark} ${n.id} - ${n.name} (${npcType})`)
      })
    }

    // Quests - titles only, limit to 6
    if (context.existingQuests.length > 0) {
      lines.push('\nEXISTING (avoid):')
      context.existingQuests.slice(0, 6).forEach(q => {
        lines.push(`  - ${q.title} (${q.difficulty || 'med'})`)
      })
      if (context.existingQuests.length > 6) lines.push(`  +${context.existingQuests.length - 6} more`)
    }

    // Relationships - limit to 5
    if (context.relationships && context.relationships.length > 0) {
      lines.push('\nRELATIONSHIPS:')
      context.relationships.slice(0, 5).forEach(r => {
        lines.push(`  ${r.fromId} → ${r.toId}: ${r.type}`)
      })
    }

    // Rules - concise
    lines.push('\nRULES:')
    lines.push(`• Use ONLY listed IDs`)
    lines.push(`• Lv ${context.tier.levelRange.min}-${context.tier.levelRange.max} range`)
    lines.push(`• Mark new as [NEW]`)
    lines.push(`• ★ = priority`)

    return lines.join('\n')
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

    // Add reuse guardrails
    // Note: ManifestService only has async methods, so we can't get manifests synchronously here
    // We'll use the existing NPCs from context instead
    const existingNPCs = context.existingNPCs || []

    // Determine role from context (if possible)
    const role = {
      archetype: context.generatedNPCs[0]?.personality?.archetype,
      needsQuestGiver: context.availableQuests.length > 0
    }

    // Convert existingNPCs to NPCManifest array
    const npcManifests: NPCManifest[] = existingNPCs.map(npc => ({
      id: npc.id,
      name: npc.name,
      description: '',
      type: npc.archetype,
      npcType: npc.archetype,
      modelPath: '',
      services: []
    }))

    prompt += this.formatReuseGuidelines(npcManifests, context.generatedNPCs, role)

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

  /**
   * Character Reuse Guardrails
   * Helper methods to enforce 80/20 rule (80% reuse, 20% new)
   */

  /**
   * Check if NPC can give quests (has quest giver service)
   */
  canGiveQuests(npc: NPCManifest | GeneratedNPC): boolean {
    // Check manifest NPC
    if ('services' in npc && Array.isArray(npc.services)) {
      return npc.services.some(s => {
        if (typeof s === 'string') {
          return s.toLowerCase().includes('quest')
        }
        // Handle service objects if they exist
        if (typeof s === 'object' && s !== null && 'type' in s) {
          const serviceType = (s as { type?: string }).type
          return serviceType?.toLowerCase().includes('quest') || false
        }
        return false
      })
    }

    // Check generated NPC
    if ('personality' in npc && npc.services) {
      return npc.services.some(s => s.toLowerCase().includes('quest'))
    }

    return false
  }

  /**
   * Get relationship count for NPC
   */
  getRelationshipCount(npcId: string, relationships: EntityRelationship[]): number {
    return relationships.filter(
      rel => rel.fromId === npcId || rel.toId === npcId
    ).length
  }

  /**
   * Calculate reuse score for an NPC given a required role
   * Higher score = better match for reuse
   * @param npc - NPC to evaluate
   * @param role - Required role criteria
   * @param relationships - Optional relationship data
   * @returns Reuse score (0-100+)
   */
  calculateReuseScore(
    npc: NPCManifest | GeneratedNPC,
    role: {
      archetype?: string
      services?: string[]
      needsQuestGiver?: boolean
    },
    relationships?: EntityRelationship[]
  ): number {
    let score = 0

    // Extract NPC data once with type checking
    const npcType = ('personality' in npc ? npc.personality?.archetype : (npc.npcType || npc.type)) || ''
    const npcServices = ('services' in npc ? npc.services : []) as string[]
    const npcId = npc.id || ''

    // Archetype match (50 points)
    if (role.archetype && npcType === role.archetype) {
      score += 50
    }

    // Services match (20 points per service, max 60)
    if (role.services && role.services.length > 0 && npcServices.length > 0) {
      let matchCount = 0
      for (const service of npcServices) {
        const serviceStr = typeof service === 'string' ? service.toLowerCase() : ''
        if (role.services.some(rs => serviceStr.includes(rs.toLowerCase()))) {
          matchCount++
        }
      }
      score += Math.min(matchCount * 20, 60)
    }

    // Quest giver match (30 points)
    if (role.needsQuestGiver && this.canGiveQuests(npc)) {
      score += 30
    }

    // Relationship bonus (5 points per relationship, max 20)
    if (relationships && relationships.length > 0 && npcId) {
      const relCount = relationships.filter(r => r.fromId === npcId || r.toId === npcId).length
      score += Math.min(relCount * 5, 20)
    }

    return score
  }

  /**
   * Find best NPC to reuse for a given role
   * Returns null if no good match (score < 40)
   */
  findBestReuseCandidate(
    role: {
      archetype?: string
      services?: string[]
      needsQuestGiver?: boolean
    },
    existingNPCs: NPCManifest[],
    generatedNPCs: GeneratedNPC[],
    relationships?: EntityRelationship[]
  ): { npc: NPCManifest | GeneratedNPC; score: number; reasons: string[] } | null {
    const allNPCs = [...existingNPCs, ...generatedNPCs]

    const candidates = allNPCs.map(npc => ({
      npc,
      score: this.calculateReuseScore(npc, role, relationships),
      reasons: []
    }))

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score)

    // Return best candidate if score >= 40 (viable threshold)
    if (candidates.length > 0 && candidates[0].score >= 40) {
      return candidates[0]
    }

    return null
  }

  /**
   * Format reuse guardrails into AI prompt instructions
   */
  formatReuseGuidelines(
    existingNPCs: NPCManifest[],
    generatedNPCs: GeneratedNPC[],
    role?: {
      archetype?: string
      services?: string[]
      needsQuestGiver?: boolean
    }
  ): string {
    let prompt = `\nCHARACTER REUSE GUIDELINES (80/20 Rule):\n`
    prompt += `==================================================\n\n`

    prompt += `CRITICAL: Before creating a new NPC, check if an existing one can be reused!\n\n`

    // Find candidates if role specified
    if (role) {
      const candidate = this.findBestReuseCandidate(role, existingNPCs, generatedNPCs)

      if (candidate) {
        const npcName = 'name' in candidate.npc
          ? candidate.npc.name
          : candidate.npc.personality?.name

        prompt += `✅ RECOMMENDATION: REUSE "${npcName}" (match score: ${candidate.score}/100)\n`
        prompt += `   This NPC already exists and can fulfill this role.\n\n`
      } else {
        prompt += `✅ RECOMMENDATION: CREATE NEW NPC\n`
        prompt += `   No existing NPC is a good match for this role (all scores < 40).\n\n`
      }
    }

    prompt += `REUSE RULES:\n`
    prompt += `1. 80% of the time → REUSE existing NPCs\n`
    prompt += `2. 20% of the time → CREATE new NPCs\n\n`

    prompt += `CREATE NEW NPC ONLY IF:\n`
    prompt += `- New geographic area requires local NPCs\n`
    prompt += `- Unique role not filled by existing NPCs\n`
    prompt += `- Story requires a brand new character\n\n`

    prompt += `NEW NPCs MUST:\n`
    prompt += `- Reference at least 2 existing NPCs in backstory\n`
    prompt += `- Have relationships with existing characters\n`
    prompt += `- Fit into the existing world lore\n`

    return prompt
  }
}

export const contextBuilder = new ContextBuilder()

