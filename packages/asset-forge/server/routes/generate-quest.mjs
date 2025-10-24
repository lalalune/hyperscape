/**
 * Quest Generation API Route
 *
 * AI-powered complete quest generation with objectives and rewards
 */

import { generateText } from 'ai'
import { getModelForTask } from '../utils/ai-router.mjs'
import { makeQuestGenerationPrompt, parseQuestGenerationResponse } from '../utils/quest-prompts.mjs'
import { buildQuestContext } from '../utils/context-builder.mjs'
import { makeItemSuggestionPrompt, makeMobSuggestionPrompt, parseManifestSuggestionResponse } from '../utils/manifest-prompts.mjs'
import { detectConflicts } from '../utils/manifest-validator.mjs'
import { getTierForDifficulty, LEVEL_TIERS } from '../../src/utils/level-progression.ts'
import { standardErrors, sendErrorResponse } from '../utils/errorResponse.mjs'

/**
 * Detect manifest gaps in quest data
 * Checks objectives and rewards for references to non-existent items/mobs
 * @param {Object} quest - Generated quest data
 * @param {Object} manifests - Available manifests (items, mobs, npcs, resources)
 * @param {string} difficulty - Quest difficulty level
 * @returns {Array} Array of detected gaps
 */
function detectQuestGaps(quest, manifests, difficulty) {
  if (!quest || !manifests) return []

  const gaps = []
  const tierInfo = getTierForDifficulty(difficulty || 'medium')
  const tierName = tierInfo.material // The material name (bronze, iron, steel, etc.) is the key in LEVEL_TIERS
  const timestamp = Date.now()

  // Validate manifests structure
  const items = manifests.items || []
  const mobs = manifests.mobs || []

  // Check objectives for missing mobs
  if (Array.isArray(quest.objectives)) {
    quest.objectives.forEach((objective, index) => {
      if (objective?.targetMobId) {
        const mobExists = mobs.some(m => m.id === objective.targetMobId)
        if (!mobExists) {
          gaps.push({
            id: `gap_${timestamp}_mob_${index}`,
            type: 'mob',
            reason: `Quest objective requires mob "${objective.targetMobId}" but it doesn't exist`,
            suggestedId: objective.targetMobId,
            suggestedName: formatSuggestedName(objective.targetMobId),
            tier: tierName,
            difficulty: difficulty || 'medium',
            requiredBy: quest.id,
            requiredByType: 'quest',
            priority: 'high',
            detectedAt: new Date().toISOString()
          })
        }
      }
    })
  }

  // Check rewards for missing items
  if (Array.isArray(quest.rewards?.items)) {
    quest.rewards.items.forEach((rewardItem, index) => {
      const itemId = rewardItem?.itemId || rewardItem?.id
      if (itemId) {
        const itemExists = items.some(i => i.id === itemId)
        if (!itemExists) {
          gaps.push({
            id: `gap_${timestamp}_item_${index}`,
            type: 'item',
            reason: `Quest reward includes item "${itemId}" but it doesn't exist`,
            suggestedId: itemId,
            suggestedName: formatSuggestedName(itemId),
            tier: tierName,
            difficulty: difficulty || 'medium',
            requiredBy: quest.id,
            requiredByType: 'quest',
            priority: 'medium',
            detectedAt: new Date().toISOString()
          })
        }
      }
    })
  }

  return gaps
}

/**
 * Format suggested name from ID (convert snake_case to Title Case)
 * @param {string} id - Manifest ID
 * @returns {string} Formatted name
 */
function formatSuggestedName(id) {
  if (!id) return 'Unknown'
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Generate AI suggestion for missing manifest item
 * @param {Object} gap - Detected gap information
 * @param {Object} manifests - Available manifests
 * @param {Object} selectedModel - AI model to use
 * @returns {Promise<Object|null>} Suggestion or null if failed
 */
async function generateManifestSuggestion(gap, manifests, selectedModel) {
  if (!gap || !manifests || !selectedModel) {
    console.warn('[Gap Detection] Invalid parameters for suggestion generation')
    return null
  }

  // If gap.tier is a string (tier name like 'bronze'), look it up. Otherwise get from difficulty
  const tierInfo = typeof gap.tier === 'string' && LEVEL_TIERS[gap.tier]
    ? LEVEL_TIERS[gap.tier]
    : getTierForDifficulty(gap.difficulty || 'medium')
  const timestamp = Date.now()

  let prompt
  let existingManifests = []
  const manifestType = gap.type === 'item' ? 'items' : gap.type === 'mob' ? 'mobs' : null

  if (!manifestType) {
    console.warn(`[Gap Detection] Unsupported gap type: ${gap.type}`)
    return null
  }

  // Filter existing manifests by tier
  if (gap.type === 'item') {
    existingManifests = (manifests.items || []).filter(item => {
      const itemLevel = item.level || item.requirements?.level || 1
      return itemLevel >= tierInfo.levelRange.min && itemLevel <= tierInfo.levelRange.max
    })
    prompt = makeItemSuggestionPrompt(gap, tierInfo, existingManifests)
  } else if (gap.type === 'mob') {
    existingManifests = (manifests.mobs || []).filter(mob => {
      const mobLevel = mob.stats?.level || mob.level || mob.combatLevel || 1
      return mobLevel >= tierInfo.levelRange.min && mobLevel <= tierInfo.levelRange.max
    })
    prompt = makeMobSuggestionPrompt(gap, tierInfo, existingManifests)
  }

  try {
    const result = await generateText({
      model: selectedModel,
      prompt,
      temperature: 0.7,
    })

    const suggestion = parseManifestSuggestionResponse(result.text)

    // If AI suggests using existing manifest
    if (suggestion.useExisting && suggestion.existingId) {
      return {
        id: `suggestion_${timestamp}_${gap.type}`,
        state: 'preview',
        manifestType,
        suggestedBy: 'ai',
        reason: suggestion.reason || 'AI recommends reusing existing manifest',
        requiredBy: [gap.requiredBy],
        conflicts: [],
        aiConfidence: Math.min(Math.max(suggestion.confidence || 80, 0), 100),
        validationScore: 100,
        canUseExisting: true,
        suggestedExistingId: suggestion.existingId,
        data: null,
        metadata: {
          createdAt: new Date().toISOString(),
          source: 'ai_gap_detection',
          gapId: gap.id
        }
      }
    }

    // AI suggests creating new manifest
    const newManifest = suggestion.item || suggestion.mob
    if (!newManifest) {
      console.warn('[Gap Detection] AI response missing manifest data')
      return null
    }

    const conflicts = detectConflicts(newManifest, existingManifests, manifestType)
    const conflictPenalty = Math.min(conflicts.length * 10, 50)

    return {
      id: `suggestion_${timestamp}_${gap.type}`,
      state: 'preview',
      manifestType,
      data: newManifest,
      suggestedBy: 'ai',
      reason: suggestion.reason || `Generated to fill gap in quest ${gap.requiredBy}`,
      requiredBy: [gap.requiredBy],
      conflicts,
      aiConfidence: Math.min(Math.max(suggestion.confidence || 70, 0), 100),
      validationScore: Math.max(100 - conflictPenalty, 0),
      canUseExisting: false,
      metadata: {
        createdAt: new Date().toISOString(),
        source: 'ai_gap_detection',
        gapId: gap.id,
        tier: gap.tier || tierInfo.material
      }
    }
  } catch (error) {
    console.error('[Gap Detection] Failed to generate suggestion:', error.message)
    return null
  }
}

export async function POST(req, res) {
  try {
    const body = req.body
    const { questType, prompt, context, difficulty, selectedContext, existingQuests, relationships, manifests, model: customModel } = body

    // Use validation helper
    const { validateQuestInput, buildQuestMetadata, processManifestGaps } = await import('../utils/quest-helpers.mjs')

    const validation = validateQuestInput(body)
    if (!validation.valid) {
      return res.status(400).json(validation.error)
    }

    // Get model for quest generation
    const selectedModel = getModelForTask('quest_generation', customModel, 'quality')
    const modelIdentifier = selectedModel.modelId || customModel || 'default'

    // Build context-aware prompt
    let worldContext = context || ''

    if (difficulty || selectedContext || existingQuests) {
      try {
        const { formatted } = await buildQuestContext({
          difficulty: difficulty || 'medium',
          questType,
          existingQuests: existingQuests || [],
          selectedContext: selectedContext || {},
          relationships: relationships || []
        })
        worldContext = formatted
        console.log('[Quest Generation] Using context-aware prompt with tier-based filtering')
      } catch (error) {
        console.error('[Quest Generation] Context build failed:', error)
        return res.status(500).json(standardErrors.contextBuildFailed(error.message))
      }
    }

    // Generate prompt with examples
    const aiPrompt = makeQuestGenerationPrompt(questType, prompt, worldContext)
    console.log('[Quest Generation] Prompt length:', aiPrompt.length, 'characters')

    // Generate quest with AI
    let text
    try {
      const result = await generateText({
        model: selectedModel,
        prompt: aiPrompt,
        temperature: 0.8,
      })
      text = result.text
    } catch (error) {
      console.error('AI generation error:', error)
      return res.status(500).json(standardErrors.generationFailed('AI', {
        errorMessage: error.message,
        stack: error.stack
      }))
    }

    // Parse AI response
    let questData
    try {
      questData = parseQuestGenerationResponse(text)
    } catch (error) {
      console.error('Parse error:', error)
      return res.status(502).json(standardErrors.parseError(text, error))
    }

    // Ensure required fields
    const completeQuest = buildQuestMetadata(questData, modelIdentifier)

    // Detect manifest gaps and generate suggestions
    const { gaps: manifestGaps, suggestions: manifestSuggestions } = await processManifestGaps(
      completeQuest,
      manifests,
      difficulty,
      selectedModel,
      detectQuestGaps,
      generateManifestSuggestion
    )

    return res.json({
      quest: completeQuest,
      model: modelIdentifier,
      rawResponse: text,
      manifestGaps,
      manifestSuggestions
    })
  } catch (error) {
    console.error('Quest generation error:', error)
    return res.status(500).json(standardErrors.internalError('Failed to generate quest', {
      errorMessage: error.message,
      stack: error.stack
    }))
  }
}

