/**
 * Quest Tracking Store
 * 
 * Zustand store for managing quest execution state and progress tracking.
 * 
 * State:
 * - activeQuests: Map of in-progress quests with objective tracking
 * - completedQuests: Set of completed quest IDs
 * - failedQuests: Set of failed quest IDs
 * - events: Chronological log of all quest events
 * 
 * Actions:
 * - startQuest: Initialize quest with progress tracking
 * - updateObjectiveProgress: Update objective completion (1/5 → 2/5)
 * - completeObjective: Mark objective as done
 * - completeQuest: Mark entire quest as complete
 * - failQuest: Mark quest as failed with reason
 * - abandonQuest: Remove quest from active tracking
 * 
 * Queries:
 * - getQuestProgress: Get current progress for a quest
 * - canAcceptQuest: Check if player meets prerequisites
 * 
 * Used by: QuestTracker component
 */

import { create } from 'zustand'

import type { GeneratedQuest } from '../types/content-generation'
import type { QuestProgress, QuestExecutionEvent, QuestObjectiveProgress } from '../types/quest-tracking'

interface QuestTrackingState {
  // Data
  activeQuests: Map<string, QuestProgress>
  completedQuests: Set<string>
  failedQuests: Set<string>
  events: QuestExecutionEvent[]
  
  // Actions
  startQuest: (quest: GeneratedQuest) => void
  updateObjectiveProgress: (questId: string, objectiveId: string, current: number) => void
  completeObjective: (questId: string, objectiveId: string) => void
  completeQuest: (questId: string) => void
  failQuest: (questId: string, reason: string) => void
  abandonQuest: (questId: string) => void
  resetTracking: () => void
  
  // Queries
  getQuestProgress: (questId: string) => QuestProgress | undefined
  canAcceptQuest: (quest: GeneratedQuest, playerLevel: number, completedQuests: string[]) => boolean
  getActiveQuestCount: () => number
  getCompletedQuestCount: () => number
}

export const useQuestTrackingStore = create<QuestTrackingState>((set, get) => ({
  // Initial state
  activeQuests: new Map(),
  completedQuests: new Set(),
  failedQuests: new Set(),
  events: [],
  
  // Actions
  startQuest: (quest) => set((state) => {
    const activeQuests = new Map(state.activeQuests)

    // Initialize objective progress
    const objectives: Record<string, QuestObjectiveProgress> = {}
    quest.objectives.forEach(obj => {
      objectives[obj.id] = {
        completed: false,
        current: 0,
        required: obj.quantity || 1,
        timestamp: undefined
      }
    })
    
    const progress: QuestProgress = {
      questId: quest.id,
      quest,
      status: 'in_progress',
      objectives,
      startedAt: new Date().toISOString()
    }
    
    activeQuests.set(quest.id, progress)
    
    const event: QuestExecutionEvent = {
      type: 'quest_started',
      questId: quest.id,
      timestamp: new Date().toISOString()
    }
    
    return {
      activeQuests,
      events: [...state.events, event]
    }
  }),
  
  updateObjectiveProgress: (questId, objectiveId, current) => set((state) => {
    const activeQuests = new Map(state.activeQuests)
    const progress = activeQuests.get(questId)
    
    if (!progress || !progress.objectives[objectiveId]) {
      return state
    }
    
    const objective = progress.objectives[objectiveId]
    objective.current = current
    
    // Check if objective is complete
    if (current >= objective.required && !objective.completed) {
      objective.completed = true
      objective.timestamp = new Date().toISOString()
      
      const event: QuestExecutionEvent = {
        type: 'objective_complete',
        questId,
        objectiveId,
        progress: { current, required: objective.required },
        timestamp: new Date().toISOString()
      }
      
      // Check if all objectives are complete
      const allComplete = Object.values(progress.objectives).every(obj => obj.completed)
      if (allComplete) {
        progress.status = 'completed'
        progress.completedAt = new Date().toISOString()
        
        // Move to completed quests
        const completedQuests = new Set(state.completedQuests)
        completedQuests.add(questId)
        activeQuests.delete(questId)
        
        const completeEvent: QuestExecutionEvent = {
          type: 'quest_complete',
          questId,
          timestamp: new Date().toISOString()
        }
        
        return {
          activeQuests,
          completedQuests,
          events: [...state.events, event, completeEvent]
        }
      }
      
      return {
        activeQuests,
        events: [...state.events, event]
      }
    }
    
    const event: QuestExecutionEvent = {
      type: 'objective_progress',
      questId,
      objectiveId,
      progress: { current, required: objective.required },
      timestamp: new Date().toISOString()
    }
    
    return {
      activeQuests,
      events: [...state.events, event]
    }
  }),
  
  completeObjective: (questId, objectiveId) => {
    const state = get()
    const progress = state.activeQuests.get(questId)
    if (!progress || !progress.objectives[objectiveId]) {
      return
    }
    const required = progress.objectives[objectiveId].required
    state.updateObjectiveProgress(questId, objectiveId, required)
  },
  
  completeQuest: (questId) => set((state) => {
    const activeQuests = new Map(state.activeQuests)
    const progress = activeQuests.get(questId)
    
    if (!progress) {
      return state
    }
    
    // Mark all objectives as complete
    Object.values(progress.objectives).forEach(obj => {
      obj.completed = true
      obj.current = obj.required
    })
    
    progress.status = 'completed'
    progress.completedAt = new Date().toISOString()
    
    const completedQuests = new Set(state.completedQuests)
    completedQuests.add(questId)
    activeQuests.delete(questId)
    
    const event: QuestExecutionEvent = {
      type: 'quest_complete',
      questId,
      timestamp: new Date().toISOString()
    }
    
    return {
      activeQuests,
      completedQuests,
      events: [...state.events, event]
    }
  }),
  
  failQuest: (questId, reason) => set((state) => {
    const activeQuests = new Map(state.activeQuests)
    const progress = activeQuests.get(questId)
    
    if (!progress) {
      return state
    }
    
    progress.status = 'failed'
    progress.failedAt = new Date().toISOString()
    progress.failureReason = reason
    
    const failedQuests = new Set(state.failedQuests)
    failedQuests.add(questId)
    activeQuests.delete(questId)
    
    const event: QuestExecutionEvent = {
      type: 'quest_failed',
      questId,
      timestamp: new Date().toISOString(),
      data: { reason }
    }
    
    return {
      activeQuests,
      failedQuests,
      events: [...state.events, event]
    }
  }),
  
  abandonQuest: (questId) => set((state) => {
    const activeQuests = new Map(state.activeQuests)
    activeQuests.delete(questId)
    
    return { activeQuests }
  }),
  
  resetTracking: () => set({
    activeQuests: new Map(),
    completedQuests: new Set(),
    failedQuests: new Set(),
    events: []
  }),
  
  // Queries
  getQuestProgress: (questId) => {
    return get().activeQuests.get(questId)
  },
  
  canAcceptQuest: (quest, playerLevel, completedQuests) => {
    const state = get()
    
    // Check if already active
    if (state.activeQuests.has(quest.id)) {
      return false
    }
    
    // Check if already completed
    if (state.completedQuests.has(quest.id)) {
      return false
    }
    
    // Check prerequisites
    if (quest.prerequisites) {
      if (quest.prerequisites.level && playerLevel < quest.prerequisites.level) {
        return false
      }
      
      if (quest.prerequisites.completedQuests) {
        const hasAllPrereqs = quest.prerequisites.completedQuests.every(
          prereqId => completedQuests.includes(prereqId) || state.completedQuests.has(prereqId)
        )
        if (!hasAllPrereqs) {
          return false
        }
      }
    }
    
    return true
  },
  
  getActiveQuestCount: () => {
    return get().activeQuests.size
  },
  
  getCompletedQuestCount: () => {
    return get().completedQuests.size
  }
}))

