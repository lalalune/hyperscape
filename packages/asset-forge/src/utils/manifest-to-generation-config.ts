/**
 * Manifest to Generation Config Converter
 * 
 * Converts game manifest data (items, mobs, NPCs) into GenerationConfig
 * for the 3D asset generation pipeline.
 * 
 * Takes structured game data and creates optimized prompts for:
 * - Image generation (DALL-E, Midjourney, etc.)
 * - 3D model generation (Meshy AI)
 * - Material variants
 * - Character rigging (for mobs/NPCs)
 * 
 * Flow:
 * 1. User clicks "Generate 3D Model" in Game Data page
 * 2. manifestToGenerationConfig() converts manifest → GenerationConfig
 * 3. Form is pre-filled with name, type, description from manifest
 * 4. User navigates to Generation page (auto-filled form)
 * 5. User starts generation → Pipeline runs → Model created
 * 6. Asset is saved with metadata.gameId and metadata.sourceManifest
 * 7. Asset automatically appears in Assets page viewer
 * 8. (Future) Asset modelPath can be updated back to manifest JSON
 * 
 * Used by: ManifestsPage Generate 3D Model button
 */

import type { GenerationConfig } from '../types/generation'
import type { ItemManifest, MobManifest, NPCManifest, ResourceManifest, AnyManifest } from '../types/manifests'

export type ManifestType = ItemManifest | MobManifest | NPCManifest | ResourceManifest

/**
 * Convert any manifest item to generation config
 */
export function manifestToGenerationConfig(
  item: AnyManifest
): GenerationConfig {
  // Detect manifest type
  if ('stats' in item && 'xpReward' in item) {
    return mobToGenerationConfig(item as MobManifest)
  }

  if ('npcType' in item && 'services' in item) {
    return npcToGenerationConfig(item as NPCManifest)
  }

  if ('harvestSkill' in item) {
    return resourceToGenerationConfig(item as ResourceManifest)
  }

  // For unsupported manifest types (WorldArea, Biome, Zone, Bank, Store)
  // Return a generic configuration
  if ('id' in item && 'name' in item) {
    return {
      name: item.name,
      type: 'misc',
      subtype: 'type' in item ? String(item.type) : 'other',
      description: 'description' in item ? String(item.description) : `A ${item.name} from game data`,
      style: 'low-poly runescape style, game asset',
      quality: 'high',
      generationType: 'item',
      enableRetexturing: false,
      enableSprites: true,
      enableGeneration: true,
      metadata: {
        gameId: item.id,
        manifestSource: 'game-data',
      }
    }
  }

  return itemToGenerationConfig(item as ItemManifest)
}

/**
 * Convert item manifest to generation config
 */
function itemToGenerationConfig(item: ItemManifest): GenerationConfig {
  // Determine type and subtype
  const type = getItemType(item.type)
  const subtype = getItemSubtype(item)
  
  // Build description with game context
  const description = buildItemDescription(item)
  
  return {
    name: item.name,
    type,
    subtype,
    description,
    style: 'low-poly runescape style, simple textures, game-ready asset',
    quality: 'high',
    generationType: 'item',
    enableRetexturing: type === 'weapon' || type === 'armor',
    enableSprites: true,
    enableGeneration: true,
    metadata: {
      gameId: item.id,
      itemType: item.type,
      value: item.value,
      rarity: item.rarity,
      manifestSource: 'game-data',
      // This metadata gets saved with the asset and appears in the asset viewer
      sourceManifest: 'items.json',
      canUpdateManifest: true // Flag to indicate this can update the manifest
    }
  }
}

/**
 * Convert mob manifest to generation config
 */
function mobToGenerationConfig(mob: MobManifest): GenerationConfig {
  const description = `${mob.description}. A level ${mob.stats.level} ${mob.type} creature with ${mob.stats.constitution} constitution. ${mob.behavior.aggressive ? 'Aggressive and dangerous' : 'Passive creature'}. Low-poly game character design.`

  return {
    name: mob.name,
    type: 'character',
    subtype: mob.type,
    description,
    style: 'low-poly runescape style, game creature, rigged for animation',
    quality: 'high',
    generationType: 'avatar',
    enableRigging: true,
    enableRetexturing: false,
    enableSprites: true,
    enableGeneration: true,
    riggingOptions: {
      heightMeters: getMobHeight(mob)
    },
    metadata: {
      gameId: mob.id,
      mobType: mob.type,
      level: mob.stats.level,
      constitution: mob.stats.constitution,
      xpReward: mob.xpReward,
      creatureType: 'biped', // Most mobs are biped
      manifestSource: 'game-data',
      sourceManifest: 'characters.json', // Unified character manifest (filtered by characterType: 'mob')
      characterType: 'mob',
      canUpdateManifest: true
    }
  }
}

/**
 * Convert NPC manifest to generation config
 */
function npcToGenerationConfig(npc: NPCManifest): GenerationConfig {
  const npcType = npc.npcType || npc.type || 'generic'
  const description = `${npc.description}. A ${npcType} NPC who provides ${npc.services.join(', ')} services. Friendly humanoid character. Low-poly game character design.`

  return {
    name: npc.name,
    type: 'character',
    subtype: 'npc',
    description,
    style: 'low-poly runescape style, friendly NPC, rigged for animation',
    quality: 'high',
    generationType: 'avatar',
    enableRigging: true,
    enableRetexturing: false,
    enableSprites: true,
    enableGeneration: true,
    riggingOptions: {
      heightMeters: 1.7 // Standard NPC height
    },
    metadata: {
      gameId: npc.id,
      npcType: npcType,
      services: npc.services.join(','),
      creatureType: 'biped',
      manifestSource: 'game-data',
      sourceManifest: 'characters.json', // Unified character manifest (filtered by characterType: 'npc')
      characterType: 'npc',
      canUpdateManifest: true
    }
  }
}

/**
 * Convert resource manifest to generation config
 */
function resourceToGenerationConfig(resource: ResourceManifest): GenerationConfig {
  const description = `A ${resource.name} resource node. ${resource.type === 'tree' ? 'A natural tree with foliage and trunk' : 'A resource gathering point'}. Requires ${resource.harvestSkill} skill level ${resource.requiredLevel} to harvest. Low-poly game environment object.`
  
  return {
    name: resource.name,
    type: 'resource',
    subtype: resource.type,
    description,
    style: 'low-poly runescape style, natural resource, game environment asset',
    quality: 'high',
    generationType: 'item',
    enableRetexturing: false,
    enableSprites: true,
    enableGeneration: true,
    metadata: {
      gameId: resource.id,
      resourceType: resource.type,
      harvestSkill: resource.harvestSkill,
      requiredLevel: resource.requiredLevel,
      manifestSource: 'game-data',
      sourceManifest: 'resources.json',
      canUpdateManifest: true
    }
  }
}

// Helper functions

function getItemType(manifestType: string): string {
  const typeMap: Record<string, string> = {
    'weapon': 'weapon',
    'armor': 'armor',
    'helmet': 'armor',
    'tool': 'tool',
    'consumable': 'consumable',
    'resource': 'resource',
    'currency': 'misc'
  }
  return typeMap[manifestType] || 'misc'
}

function getItemSubtype(item: ItemManifest): string {
  // Try to infer subtype from item name or type
  const nameLower = item.name.toLowerCase()
  
  if (nameLower.includes('sword')) return 'sword'
  if (nameLower.includes('axe')) return 'axe'
  if (nameLower.includes('bow')) return 'bow'
  if (nameLower.includes('staff')) return 'staff'
  if (nameLower.includes('dagger')) return 'dagger'
  if (nameLower.includes('mace')) return 'mace'
  if (nameLower.includes('spear')) return 'spear'
  
  if (nameLower.includes('helmet')) return 'helmet'
  if (nameLower.includes('chest') || nameLower.includes('platebody')) return 'chest'
  if (nameLower.includes('legs') || nameLower.includes('platelegs')) return 'legs'
  if (nameLower.includes('boots')) return 'boots'
  if (nameLower.includes('gloves') || nameLower.includes('gauntlets')) return 'gloves'
  if (nameLower.includes('shield')) return 'shield'
  
  return item.type
}

function buildItemDescription(item: ItemManifest): string {
  let desc = item.description

  // Add rarity information
  if (item.rarity) {
    desc += `. ${item.rarity} rarity`
  }

  // Add value context
  if (item.value && item.value > 0) {
    if (item.value >= 1000) {
      desc += `, valuable item worth ${item.value} gold`
    } else if (item.value >= 100) {
      desc += `, worth ${item.value} gold`
    }
  }

  // Add combat stats if present
  if (item.bonuses && item.bonuses.attack > 0) {
    desc += `. Provides +${item.bonuses.attack} attack bonus`
  }

  if (item.bonuses && item.bonuses.defense > 0) {
    desc += `. Provides +${item.bonuses.defense} defense bonus`
  }

  // Add low-poly style note
  desc += '. Low-poly runescape-style game asset with simple textures.'

  return desc
}

function getMobHeight(mob: MobManifest): number {
  const nameLower = mob.name.toLowerCase()
  
  // Small creatures
  if (nameLower.includes('goblin') || nameLower.includes('imp')) {
    return 1.2
  }
  
  // Medium humanoids
  if (nameLower.includes('bandit') || nameLower.includes('warrior') || 
      nameLower.includes('guard') || nameLower.includes('barbarian')) {
    return 1.7
  }
  
  // Large creatures
  if (nameLower.includes('giant') || nameLower.includes('troll') || 
      nameLower.includes('ogre')) {
    return 2.5
  }
  
  // Default humanoid height
  return 1.7
}

/**
 * Check if manifest item has a valid 3D model
 */
export function hasValidModel(item: AnyManifest): boolean {
  if (!('modelPath' in item) || !item.modelPath) {
    return false
  }

  // Check if it's a placeholder or missing
  if (item.modelPath.includes('default.glb') ||
      item.modelPath.includes('placeholder')) {
    return false
  }

  return true
}

/**
 * Get generation button text based on manifest type
 */
export function getGenerationButtonText(item: AnyManifest): string {
  if ('stats' in item && 'xpReward' in item) {
    return 'Generate Mob Model'
  }

  if ('npcType' in item && 'services' in item) {
    return 'Generate NPC Model'
  }

  if ('harvestSkill' in item) {
    return 'Generate Resource Model'
  }

  return 'Generate 3D Model'
}

