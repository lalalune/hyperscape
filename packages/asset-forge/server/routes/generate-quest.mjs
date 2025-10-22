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
  const tier = getTierForDifficulty(difficulty || 'medium')
  const tierInfo = LEVEL_TIERS[tier]
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
            tier,
            tierLevel: tierInfo.levelRange,
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
            tier,
            tierLevel: tierInfo.levelRange,
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

  const tier = gap.tier || getTierForDifficulty(gap.difficulty || 'medium')
  const tierInfo = LEVEL_TIERS[tier]
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
        tier: tier,
        tierLevel: tierInfo.levelRange
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

    // Input validation
    if (!questType || typeof questType !== 'string' || questType.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'questType' must be a non-empty string"
      })
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'prompt' must be a non-empty string"
      })
    }

    if (context !== undefined && (typeof context !== 'string' || context.trim() === '')) {
      return res.status(400).json({
        error: "Invalid input: 'context' must be a non-empty string if provided"
      })
    }

    if (customModel !== undefined && typeof customModel !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'model' must be a string if provided"
      })
    }

    // Get model for quest generation
    const selectedModel = getModelForTask('quest_generation', customModel, 'quality')
    const modelIdentifier = selectedModel.modelId || customModel || 'default'

    // Build context-aware prompt with manifest data
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
        console.warn('[Quest Generation] Context build failed, using basic context:', error.message)
        worldContext = context || ''
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
      return res.status(500).json({
        error: 'Failed to generate quest from AI service',
        details: error.message
      })
    }

    // Parse AI response
    let questData
    try {
      questData = parseQuestGenerationResponse(text)
    } catch (error) {
      console.error('Parse error:', error)
      return res.status(502).json({
        error: 'Failed to parse AI response',
        rawResponse: text,
        details: error.message
      })
    }

    // Ensure required fields
    const completeQuest = {
      ...questData,
      id: questData.id || `quest_${Date.now()}`,
      currentProgress: questData.currentProgress || 0,
      status: questData.status || 'not_started',
      metadata: {
        generatedBy: 'AI',
        model: modelIdentifier,
        timestamp: new Date().toISOString()
      }
    }

    // Detect manifest gaps and generate suggestions
    let manifestGaps = []
    let manifestSuggestions = []

    if (manifests) {
      console.log('[Quest Generation] Detecting manifest gaps...')
      manifestGaps = detectQuestGaps(completeQuest, manifests, difficulty)

      if (manifestGaps.length > 0) {
        console.log(`[Quest Generation] Found ${manifestGaps.length} gaps, generating AI suggestions...`)

        // Generate suggestions for each gap
        const suggestionPromises = manifestGaps.map(gap =>
          generateManifestSuggestion(gap, manifests, selectedModel)
        )

        const results = await Promise.all(suggestionPromises)
        manifestSuggestions = results.filter(s => s !== null)

        console.log(`[Quest Generation] Generated ${manifestSuggestions.length} suggestions`)
      }
    }

    return res.json({
      quest: completeQuest,
      model: modelIdentifier,
      rawResponse: text,
      manifestGaps,
      manifestSuggestions
    })
  } catch (error) {
    console.error('Quest generation error:', error)
    return res.status(500).json({
      error: 'Failed to generate quest',
      details: error.message
    })
  }
}

