/**
 * NPC Script Types
 *
 * Defines executable dialogue trees and behavior scripts for game NPCs.
 * Scripts work both in-game (via DialogueSystem) and provide rich event data
 * for ElizaOS agents through the messaging system.
 *
 * Key Concepts:
 * - Dialogue Trees: Branching conversation paths with conditions
 * - Quest Integration: NPCs can offer/complete quests through dialogue
 * - Event Payloads: Rich structured data sent to ElizaOS agents
 * - Behavior Patterns: Idle, proximity, schedule-based activities
 * - Voice Generation: ElevenLabs TTS for NPC dialogue
 *
 * Used by: NPCScriptBuilder, DialogueSystem, ElizaOS providers
 */

import type { NPCVoiceConfig } from './voice-generation'

// Main NPC Script Interface
export interface NPCScript {
  id: string
  npcId: string // Links to NPC manifest ID
  npcName: string
  version: string
  
  // Dialogue Tree Structure
  dialogueTree: {
    entryNodeId: string // Starting dialogue node ID
    nodes: DialogueNode[]
  }
  
  // Quest Integration
  questsOffered: string[] // Quest IDs this NPC can give
  questRequirements: Record<string, {
    level?: number
    completedQuests?: string[]
  }>
  
  // Services this NPC provides
  services: Array<'bank' | 'shop' | 'quest' | 'training'>
  
  // Shop inventory (if shop NPC)
  shopInventory?: ShopItem[]
  
  // Behavior Patterns
  behaviors: {
    idle: IdleBehavior
    onPlayerNearby?: ProximityBehavior
    schedule: NPCSchedule[]
  }

  // Voice Configuration (optional)
  voice?: NPCVoiceConfig

  // Metadata
  metadata: {
    createdAt: string
    author: string
    version: string
    tags: string[]
  }
}

// Dialogue Node - single point in conversation tree
export interface DialogueNode {
  id: string
  text: string // What NPC says
  conditions?: DialogueCondition[] // When this node is available
  responses: DialogueResponse[] // Player's response options
  effects?: DialogueEffect[] // Side effects when node is shown
}

// Player response option
export interface DialogueResponse {
  id: string
  text: string // What player says
  nextNodeId: string // Which node to show next
  conditions?: DialogueCondition[] // When this response is available
  effects?: DialogueEffect[] // What happens when player selects this
  questReference?: string // Links to quest ID
}

// Condition for showing dialogue/responses
export interface DialogueCondition {
  type: 'HAS_QUEST' | 'QUEST_COMPLETE' | 'LEVEL_REQUIREMENT' | 'HAS_ITEM' | 'FLAG_SET'
  data: {
    questId?: string
    level?: number
    itemId?: string
    flag?: string
  }
}

// Effect triggered by dialogue
export interface DialogueEffect {
  type: 'ACCEPT_QUEST' | 'COMPLETE_QUEST' | 'GIVE_ITEM' | 'TAKE_ITEM' | 'SET_FLAG' | 'GIVE_XP' | 'GIVE_GOLD'
  data: unknown
}

// Shop item definition
export interface ShopItem {
  itemId: string
  itemName: string
  stock: number // -1 for unlimited
  buyPrice: number
  sellPrice: number
}

// Idle behavior
export interface IdleBehavior {
  type: 'stand' | 'wander' | 'patrol'
  wanderRadius?: number
  patrolPoints?: Array<{ x: number; y: number; z: number }>
  animations?: string[] // Animation names to cycle through
}

// Proximity behavior
export interface ProximityBehavior {
  triggerDistance: number
  action: 'greet' | 'wave' | 'turn_to_player'
  greetingText?: string
}

// Daily schedule
export interface NPCSchedule {
  time: string // "08:00"
  location: string // Location name or coordinates
  activity: string // "working", "sleeping", "eating"
  dialogueOverride?: string // Different dialogue during this time
}

// Context passed to dialogue evaluators
export interface DialogueContext {
  playerId: string
  playerLevel: number
  playerGold: number
  completedQuests: string[]
  activeQuests: string[]
  flags: Record<string, boolean>
}

// Event Payload for NPC_DIALOGUE event
// This is what gets emitted and what ElizaOS agents see
export interface NPCEventPayload {
  // Basic NPC info
  npcId: string
  npcName: string
  npcType: string
  
  // Current dialogue state
  dialogue: {
    nodeId: string
    text: string
    responses: Array<{
      id: string
      text: string
      nextNodeId: string
      requiresQuest?: string
      completesQuest?: string
      offersQuest?: string
      requiresLevel?: number
    }>
    voiceClipUrl?: string // Audio file URL for this dialogue
  }
  
  // Quest information (rich data for agents)
  questsAvailable: Array<{
    id: string
    title: string
    description: string
    difficulty: string
    objectives: Array<{
      type: string
      actionHandler?: string
      target?: string
      quantity: number
      description: string
    }>
    rewards: {
      xp: number
      gold: number
      items?: Array<{ itemId: string; quantity: number }>
    }
    requirements?: {
      level?: number
      completedQuests?: string[]
    }
  }>
  
  // Services offered
  services: string[]
  
  // Shop data (if applicable)
  shopInventory?: ShopItem[]

  // Voice data (if available)
  voiceEnabled?: boolean

  // Metadata for ElizaOS agents
  metadata: {
    canAcceptQuests: boolean
    hasActiveDialogue: boolean
    questCount: number
    scriptVersion: string
    interactionCount?: number
    hasVoice?: boolean
  }
}

// Validation result for scripts
export interface ScriptValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// Export format for game integration
export interface GameNPCScript {
  npcId: string
  dialogueTree: {
    entryNodeId: string
    nodes: DialogueNode[]
  }
  questsOffered: string[]
  services: string[]
  shopInventory?: ShopItem[]
  voice?: NPCVoiceConfig // Voice configuration with clips
}

