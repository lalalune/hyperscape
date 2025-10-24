/**
 * Quest Validation Utility
 * 
 * Validates quest data to ensure all references are correct and complete.
 * Checks for:
 * - Valid action handlers that exist in the game
 * - Proper targets for actions that require them
 * - Correct objective quantities and descriptions
 * - Valid reward items from manifests
 * - Quest giver NPCs exist
 * - Prerequisites are reasonable
 * 
 * Returns validation result with errors (blocking) and warnings (informational).
 * 
 * Used by: ContentGenerationPage, QuestTracker
 */

import { ACTION_HANDLERS, actionRequiresTarget } from '../types/action-handlers'
import type { GeneratedQuest } from '../types/content-generation'
import type { QuestValidationResult } from '../types/quest-tracking'

export function validateQuest(quest: GeneratedQuest): QuestValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate quest has a title
  if (!quest.title || quest.title.trim() === '') {
    errors.push('Quest must have a title')
  }
  
  // Validate quest has a description
  if (!quest.description || quest.description.trim() === '') {
    errors.push('Quest must have a description')
  }
  
  // Validate quest has at least one objective
  if (!quest.objectives || quest.objectives.length === 0) {
    errors.push('Quest must have at least one objective')
  }
  
  // Validate each objective
  quest.objectives.forEach((obj, index) => {
    const objPrefix = `Objective ${index + 1} ("${obj.description}")`
    
    // Check if objective has a description
    if (!obj.description || obj.description.trim() === '') {
      errors.push(`${objPrefix}: missing description`)
    }
    
    // Check if objective has an action handler
    if (!obj.actionHandler) {
      errors.push(`${objPrefix}: missing action handler`)
    } else {
      // Validate action handler exists
      if (!ACTION_HANDLERS[obj.actionHandler]) {
        errors.push(`${objPrefix}: invalid action handler "${obj.actionHandler}"`)
      } else {
        const action = ACTION_HANDLERS[obj.actionHandler]
        
        // Validate target exists for objectives that need targets
        if (actionRequiresTarget(obj.actionHandler)) {
          if (action.targetTypes?.includes('mob')) {
            if (!obj.targetMob && !obj.target) {
              errors.push(`${objPrefix}: combat objective missing target mob`)
            }
          }
          
          if (action.targetTypes?.includes('resource')) {
            if (!obj.targetResource && !obj.target) {
              warnings.push(`${objPrefix}: gathering objective missing specific resource type`)
            }
          }
          
          if (action.targetTypes?.includes('npc')) {
            if (!obj.target) {
              warnings.push(`${objPrefix}: social objective missing target NPC`)
            }
          }
        }
        
        // Warn about required items
        if (action.requiredItems && action.requiredItems.length > 0) {
          warnings.push(`${objPrefix}: requires items: ${action.requiredItems.join(', ')}`)
        }
      }
    }
    
    // Validate quantity
    if (obj.quantity !== undefined && obj.quantity <= 0) {
      errors.push(`${objPrefix}: quantity must be greater than 0`)
    }
  })
  
  // Validate rewards
  if (!quest.rewards.experience || quest.rewards.experience <= 0) {
    warnings.push('Quest should provide experience points')
  }
  
  if (!quest.rewards.gold || quest.rewards.gold <= 0) {
    warnings.push('Quest should provide gold reward')
  }
  
  // Validate reward items reference real items
  quest.rewards.items?.forEach((item, index) => {
    if (!item.itemData && item.itemId) {
      warnings.push(`Reward item ${index + 1} (${item.itemId}) not found in manifests`)
    }
    if (item.quantity <= 0) {
      errors.push(`Reward item ${index + 1}: quantity must be greater than 0`)
    }
  })
  
  // Check quest giver exists
  if (quest.questGiver && !quest.questGiverData) {
    warnings.push(`Quest giver "${quest.questGiver}" not found in NPC manifests`)
  }
  
  // Validate prerequisites
  if (quest.prerequisites) {
    if (quest.prerequisites.level !== undefined && quest.prerequisites.level < 1) {
      errors.push('Prerequisite level must be at least 1')
    }
  }
  
  // Validate difficulty
  const validDifficulties = ['trivial', 'easy', 'medium', 'hard', 'epic']
  if (!validDifficulties.includes(quest.difficulty)) {
    errors.push(`Invalid difficulty: ${quest.difficulty}`)
  }
  
  // Validate estimated duration
  if (quest.estimatedDuration <= 0) {
    warnings.push('Estimated duration should be greater than 0 minutes')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

export function validateQuests(quests: GeneratedQuest[]): Map<string, QuestValidationResult> {
  const results = new Map<string, QuestValidationResult>()
  
  quests.forEach(quest => {
    results.set(quest.id, validateQuest(quest))
  })
  
  return results
}

