/**
 * NPC Generation API Route
 *
 * AI-powered complete NPC generation with personality, dialogues, and behavior
 */

import { standardErrors } from '../utils/errorResponse.mjs'
import { randomUUID } from 'crypto'
import { generateText } from 'ai'
import { getModelForTask } from '../utils/ai-router.mjs'
import { makeNPCGenerationPrompt, parseNPCGenerationResponse } from '../utils/npc-prompts.mjs'
import { buildNPCContext } from '../utils/context-builder.mjs'
import { validateNPCSuggestion, findReuseableNPCs } from '../utils/npc-validator.mjs'

export async function POST(req, res) {
  try {
    const body = req.body
    const { archetype, prompt, context, generatedNPCs, availableQuests, relationships, lore, model: customModel } = body

    // Input validation
    if (!archetype || typeof archetype !== 'string' || archetype.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'archetype' must be a non-empty string"
      })
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'prompt' must be a non-empty string"
      })
    }

    if (prompt.length > 10000) {
      return res.status(400).json({
        error: "Invalid input: 'prompt' must not exceed 10,000 characters"
      })
    }

    if (context && typeof context === 'string' && context.length > 10000) {
      return res.status(400).json({
        error: "Invalid input: 'context' must not exceed 10,000 characters"
      })
    }

    if (customModel !== undefined && typeof customModel !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'model' must be a string if provided"
      })
    }

    // Get model for NPC generation
    const selectedModel = getModelForTask('npc_dialogue', customModel, 'quality')
    const modelIdentifier = selectedModel.modelId || customModel || 'default'

    // Build context-aware prompt with existing NPCs and quests
    let worldContext = context || ''

    if (generatedNPCs || availableQuests || relationships) {
      try {
        const { formatted } = await buildNPCContext({
          archetype,
          generatedNPCs: generatedNPCs || [],
          availableQuests: availableQuests || [],
          relationships: relationships || [],
          lore: lore || []
        })
        worldContext = formatted
        console.log('[NPC Generation] Using context-aware prompt with existing NPCs')
      } catch (error) {
        console.warn('[NPC Generation] Context build failed, using basic context:', error.message)
        worldContext = context || ''
      }
    }

    // Generate prompt with examples
    const aiPrompt = makeNPCGenerationPrompt(archetype, prompt, worldContext)
    console.log('[NPC Generation] Context includes', (generatedNPCs?.length || 0), 'existing NPCs,', (availableQuests?.length || 0), 'quests')

    // Generate NPC with AI
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
    let npcData
    try {
      npcData = parseNPCGenerationResponse(text)
    } catch (error) {
      console.error('Parse error:', error)
      return res.status(502).json(standardErrors.parseError(text, error))
    }

    // Add metadata
    const completeNPC = {
      id: `npc_${randomUUID()}`,
      ...npcData,
      metadata: {
        generatedBy: 'AI',
        model: modelIdentifier,
        timestamp: new Date().toISOString()
      }
    }

    // Validate NPC and check for reuse opportunities
    let reuseValidation = null

    if (generatedNPCs || availableQuests) {
      console.log('[NPC Generation] Validating NPC for character reuse...')

      const context = {
        existingNPCs: generatedNPCs || [],
        generatedNPCs: [],
        lore: lore || [],
        isQuestGiver: availableQuests && availableQuests.length > 0
      }

      reuseValidation = await validateNPCSuggestion(completeNPC, context)

      if (reuseValidation.shouldReuse) {
        console.log(`[NPC Generation] REUSE RECOMMENDED: ${reuseValidation.justification}`)
      } else {
        console.log(`[NPC Generation] New NPC justified: ${reuseValidation.justification}`)
      }

      // Also find top reuseable candidates for UI display
      const role = {
        archetype: completeNPC.type || completeNPC.npcType,
        services: completeNPC.services || [],
        needsQuestGiver: context.isQuestGiver
      }

      const reuseCandidates = findReuseableNPCs(role, generatedNPCs || [], [])

      reuseValidation.topCandidates = reuseCandidates.slice(0, 3) // Top 3 alternatives
    }

    return res.json({
      npc: completeNPC,
      model: modelIdentifier,
      rawResponse: text,
      reuseValidation
    })
  } catch (error) {
    console.error('NPC generation error:', error)
    return res.status(500).json(standardErrors.internalError('Failed to generate NPC', {
      errorMessage: error.message,
      stack: error.stack
    }))
  }
}

