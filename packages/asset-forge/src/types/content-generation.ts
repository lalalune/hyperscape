/**
 * Content Generation Types
 * Types for quest, NPC, and lore generation using real game manifests
 */

import type { ActionHandlerName } from './action-handlers'
import type { ItemManifest, MobManifest, NPCManifest, ResourceManifest } from './manifests'

// Quest Types
export type QuestObjectiveType = 'combat' | 'gathering' | 'processing' | 'economy' | 'social' | 'delivery'

export interface QuestObjective {
  id: string
  type: QuestObjectiveType
  description: string
  
  // Action handler integration
  actionHandler?: ActionHandlerName
  
  // Target references
  target?: string // Item ID, Mob ID, or Resource ID from manifests
  targetData?: ItemManifest | MobManifest | NPCManifest // Real manifest data
  targetMob?: MobManifest // Specific mob target for combat objectives
  targetResource?: ResourceManifest // Specific resource target for gathering objectives
  
  quantity?: number
  location?: string
  optional: boolean
  requiredLevel?: number // Minimum level required for this objective
}

export interface QuestReward {
  experience: number
  gold: number
  items?: Array<{
    itemId: string
    itemData?: ItemManifest // Real item from manifest
    quantity: number
  }>
  reputation?: Record<string, number>
}

export interface GeneratedQuest {
  id: string
  title: string
  description: string
  difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'epic'
  estimatedDuration: number
  questGiver?: string // NPC ID from manifests
  questGiverData?: NPCManifest // Real NPC data
  objectives: QuestObjective[]
  rewards: QuestReward
  loreContext?: string
  storyline?: string // Narrative storyline for quest chain integration
  requirements?: {
    level?: number
    skills?: Record<string, number>
    completedQuests?: string[]
  }
  prerequisites?: {
    level?: number
    completedQuests?: string[]
    items?: string[]
  }
  tags: string[]
  metadata: {
    createdAt: string
    author: string
    version: string
  }
}

// NPC Script Types
export interface NPCDialogue {
  id: string
  text: string
  responses: Array<{
    text: string
    nextNodeId: string
    effects?: Array<{ type: string; value: unknown }>
    questReference?: string // Quest ID to trigger acceptance
  }>
}

export interface NPCPersonality {
  name: string
  archetype: string
  traits: string[]
  goals: string[]
  moralAlignment: string
  backstory?: string
  questsOffered?: string[] // Quest IDs this NPC can give
}

export interface NPCBehavior {
  schedule: Array<{
    time: string
    location: string
    activity: string
  }>
  wanderRadius?: number
  stayInZone?: boolean
}

export interface GeneratedNPC {
  id: string
  personality: NPCPersonality
  dialogues: NPCDialogue[]
  behavior: NPCBehavior
  services?: string[] // 'bank', 'shop', 'quest'
  inventory?: Array<{
    itemId: string
    itemData?: ItemManifest
    stock: number
    price: number
  }>
  metadata: {
    createdAt: string
    author: string
    version: string
  }
}

// Lore Types
export interface LoreEntry {
  id: string
  title: string
  content: string
  category: 'history' | 'faction' | 'character' | 'location' | 'artifact' | 'event'
  tags: string[]
  relatedEntities: Array<{
    type: 'item' | 'mob' | 'npc' | 'zone'
    id: string
    name: string
  }>
  createdAt: string
}

// Content Pack Export
export interface ContentPack {
  id: string
  name: string
  version: string
  description: string
  quests: GeneratedQuest[]
  npcs: GeneratedNPC[]
  lore: LoreEntry[]
  metadata: {
    createdAt: string
    author: string
    manifestVersion: string // Track which manifest version was used
  }
}

// Generation Configuration
export interface ContentGenerationConfig {
  type: 'quest' | 'npc' | 'lore' | 'pack'
  useAI: boolean
  aiModel?: string
  
  // Quest config
  questConfig?: {
    difficulty: GeneratedQuest['difficulty']
    includeSubquests: boolean
    generateLore: boolean
  }
  
  // NPC config
  npcConfig?: {
    archetype: string
    includeDialogues: boolean
    includeShop: boolean
  }
  
  // Lore config
  loreConfig?: {
    category: LoreEntry['category']
    relatedManifests: Array<{
      type: 'items' | 'mobs' | 'npcs'
      ids: string[]
    }>
  }
}

