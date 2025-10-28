/**
 * Context Builder Service
 *
 * Builds rich context from game manifests to inject into AI prompts
 * Ensures AI generates content that fits existing game world
 *
 * Converted from TypeScript version in asset-forge frontend
 */

import fetch from 'node-fetch'

const API_URL = process.env.IMAGE_SERVER_URL || process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:3004'

// Type guards for manifest discrimination
function isItemManifest(manifest) {
  return manifest && 'value' in manifest && 'equipSlot' in manifest
}

function isMobManifest(manifest) {
  return manifest && ('combatLevel' in manifest || (manifest.stats && 'level' in manifest.stats))
}

function isNPCManifest(manifest) {
  return manifest && ('npcType' in manifest || (manifest.type && 'services' in manifest))
}

function isResourceManifest(manifest) {
  return manifest && 'harvestSkill' in manifest && 'harvestYield' in manifest
}

function getTierForDifficulty(difficulty) {
  const tiers = {
    easy: { name: 'Bronze', material: 'bronze', levelRange: { min: 1, max: 10 }, difficulty: 'easy' },
    medium: { name: 'Silver', material: 'silver', levelRange: { min: 11, max: 25 }, difficulty: 'medium' },
    hard: { name: 'Gold', material: 'gold', levelRange: { min: 26, max: 40 }, difficulty: 'hard' },
    epic: { name: 'Platinum', material: 'platinum', levelRange: { min: 41, max: 60 }, difficulty: 'epic' }
  }
  return tiers[difficulty] || tiers.medium
}

export class ContextBuilder {
  constructor() {
    this.manifestCache = null
    this.cacheTimestamp = null
    this.CACHE_TTL = 60000 // 1 minute cache
  }

  /**
   * Fetch all manifests from API with caching
   */
  async fetchManifests() {
    const now = Date.now()
    if (this.manifestCache && this.cacheTimestamp && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.manifestCache
    }

    try {
      const response = await fetch(`${API_URL}/api/manifests`)
      if (!response.ok) {
        throw new Error(`Failed to fetch manifests: ${response.statusText}`)
      }
      const data = await response.json()
      this.manifestCache = data
      this.cacheTimestamp = now
      return data
    } catch (error) {
      console.error('[ContextBuilder] Failed to fetch manifests:', error)
      return { items: [], npcs: [], resources: [] }
    }
  }

  /**
   * Build context for quest generation with tier-appropriate content
   */
  async buildQuestContext(params) {
    const { difficulty = 'medium', questType, existingQuests = [], selectedContext, relationships } = params

    // Get tier for difficulty
    const tier = getTierForDifficulty(difficulty)

    // Load all manifests
    const manifests = await this.fetchManifests()

    // Filter by level range
    const availableItems = (manifests.items || []).filter(item => {
      if (!isItemManifest(item)) return false
      const itemLevel = item.requirements?.level || 1
      return itemLevel >= tier.levelRange.min && itemLevel <= tier.levelRange.max
    })

    const availableMobs = (manifests.npcs || []).filter(mob => {
      if (!isMobManifest(mob)) return false
      const mobLevel = mob.combatLevel || mob.stats?.level || 1
      return mobLevel >= tier.levelRange.min && mobLevel <= tier.levelRange.max
    })

    const availableResources = (manifests.resources || []).filter(resource => {
      if (!isResourceManifest(resource)) return false
      const resourceLevel = resource.requiredLevel || 1
      return resourceLevel >= tier.levelRange.min && resourceLevel <= tier.levelRange.max
    })

    const existingNPCs = (manifests.npcs || []).filter(npc => isNPCManifest(npc))

    const context = {
      availableItems,
      availableMobs,
      availableResources,
      existingNPCs,
      existingQuests,
      tier,
      relationships,
      lore: selectedContext?.lore ? [] : undefined
    }

    // Format for AI prompt
    const formatted = this.formatQuestContext(context, selectedContext)

    return { context, formatted }
  }

  /**
   * Build context for NPC generation with existing world data
   */
  async buildNPCContext(params) {
    const { archetype = 'merchant', generatedNPCs = [], availableQuests = [], relationships, lore } = params

    const manifests = await this.fetchManifests()

    const context = {
      existingNPCs: (manifests.npcs || [])
        .filter(npc => isNPCManifest(npc))
        .map(npc => ({
          name: npc.name,
          archetype: npc.npcType || npc.type,
          id: npc.id
        })),
      generatedNPCs,
      availableQuests,
      relationships,
      lore
    }

    const formatted = this.formatNPCContext(context)

    return { context, formatted }
  }

  /**
   * Format quest context for AI prompt
   */
  formatQuestContext(context, selectedContext) {
    const lines = []

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
  formatNPCContext(context) {
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
  async buildFullContext(params = {}) {
    const manifests = await this.fetchManifests()

    let context = 'GAME WORLD CONTEXT\n==================\n\n'

    // Total counts
    context += `WORLD INVENTORY:\n`
    context += `  - ${manifests.items?.length || 0} items\n`
    context += `  - ${manifests.npcs?.length || 0} NPCs\n`
    context += `  - ${manifests.resources?.length || 0} resources\n`
    context += `  - ${params.existingQuests?.length || 0} quests\n\n`

    return context
  }
}

// Export singleton instance
export const contextBuilder = new ContextBuilder()
