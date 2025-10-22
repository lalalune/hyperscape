/**
 * Context Builder Server Wrapper
 *
 * ES Module wrapper for TypeScript ContextBuilder service
 * Provides manifest-aware context for AI content generation
 */

import { ContextBuilder } from '../../src/services/ContextBuilder.ts'

// Create singleton instance
const contextBuilder = new ContextBuilder()

/**
 * Build quest generation context with tier-appropriate content
 *
 * @param {Object} params - Quest context parameters
 * @param {string} params.difficulty - Quest difficulty (easy, medium, hard, epic)
 * @param {string} params.questType - Type of quest (combat, gathering, etc.)
 * @param {Array} params.existingQuests - Previously generated quests
 * @param {Object} params.selectedContext - User-selected context items
 * @param {Array} params.relationships - Entity relationships
 * @returns {Promise<{context: Object, formatted: string}>} Context object and formatted prompt string
 */
export async function buildQuestContext(params) {
  try {
    const result = await contextBuilder.buildQuestContext({
      difficulty: params.difficulty || 'medium',
      questType: params.questType || 'combat',
      existingQuests: params.existingQuests || [],
      selectedContext: params.selectedContext || {},
      relationships: params.relationships || []
    })

    return result
  } catch (error) {
    console.error('[ContextBuilder] Failed to build quest context:', error)

    // Return minimal fallback context
    return {
      context: {
        availableItems: [],
        availableMobs: [],
        availableResources: [],
        existingNPCs: [],
        existingQuests: params.existingQuests || [],
        tier: { name: 'Bronze', material: 'bronze', levelRange: { min: 1, max: 10 } }
      },
      formatted: `WORLD CONTEXT: Unable to load manifest data. Generating with minimal context.\n`
    }
  }
}

/**
 * Build NPC generation context with existing world data
 *
 * @param {Object} params - NPC context parameters
 * @param {string} params.archetype - NPC archetype (merchant, guard, etc.)
 * @param {Array} params.generatedNPCs - Previously generated NPCs
 * @param {Array} params.availableQuests - Available quests NPC can offer
 * @param {Array} params.relationships - Entity relationships
 * @param {Array} params.lore - Lore entries
 * @returns {Promise<{context: Object, formatted: string}>} Context object and formatted prompt string
 */
export async function buildNPCContext(params) {
  try {
    const result = await contextBuilder.buildNPCContext({
      archetype: params.archetype || 'merchant',
      generatedNPCs: params.generatedNPCs || [],
      availableQuests: params.availableQuests || [],
      relationships: params.relationships || [],
      lore: params.lore || []
    })

    return result
  } catch (error) {
    console.error('[ContextBuilder] Failed to build NPC context:', error)

    // Return minimal fallback context
    return {
      context: {
        existingNPCs: [],
        generatedNPCs: params.generatedNPCs || [],
        availableQuests: params.availableQuests || []
      },
      formatted: `WORLD CONTEXT: Unable to load manifest data. Generating with minimal context.\n`
    }
  }
}

/**
 * Build full world context for general use
 *
 * @param {Object} params - Context parameters
 * @returns {Promise<string>} Formatted world context
 */
export async function buildFullContext(params = {}) {
  try {
    return await contextBuilder.buildFullContext(params)
  } catch (error) {
    console.error('[ContextBuilder] Failed to build full context:', error)
    return 'WORLD CONTEXT: Unable to load manifest data.\n'
  }
}
