/**
 * Quest Tracking Types
 * 
 * Defines types for tracking quest progress and execution state.
 * Used by QuestTracker component and useQuestTrackingStore.
 * 
 * Key interfaces:
 * - QuestProgress: Tracks active quest state and objective completion
 * - QuestExecutionEvent: Records quest-related events (start, progress, complete)
 * - QuestValidationResult: Validation results for quest data integrity
 * - GameQuestFormat: Simplified format for game integration
 * 
 * Referenced by: QuestTracker, useQuestTrackingStore, quest-exporter
 */

import type { GeneratedQuest } from './content-generation'

export interface QuestObjectiveProgress {
  completed: boolean
  current: number
  required: number
  timestamp?: string
}

export interface QuestProgress {
  questId: string
  quest: GeneratedQuest // Store full quest data for reference
  status: 'not_started' | 'in_progress' | 'completed' | 'failed'
  objectives: Record<string, QuestObjectiveProgress>
  startedAt?: string
  completedAt?: string
  failedAt?: string
  failureReason?: string
}

export type QuestExecutionEventType = 
  | 'objective_progress' 
  | 'objective_complete' 
  | 'quest_started'
  | 'quest_complete'
  | 'quest_failed'

export interface QuestExecutionEvent {
  type: QuestExecutionEventType
  questId: string
  objectiveId?: string
  progress?: { current: number; required: number }
  timestamp: string
  data?: unknown
}

export interface QuestValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// For game integration - simplified quest format
export interface GameQuestFormat {
  id: string
  title: string
  description: string
  questGiver?: string
  objectives: Array<{
    id: string
    type: string
    actionHandler?: string
    target?: string
    targetType: 'mob' | 'resource' | 'item' | 'npc' | 'none'
    quantity: number
    description: string
  }>
  rewards: {
    xp: number
    gold: number
    items?: Array<{
      itemId: string
      quantity: number
    }>
  }
  requirements?: {
    level?: number
    completedQuests?: string[]
    items?: string[]
  }
}

