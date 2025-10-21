/**
 * NPC Generation API Route
 * 
 * AI-powered complete NPC generation with personality, dialogues, and behavior
 */

import { generateText } from 'ai'
import { getModelForTask } from '../utils/ai-router.mjs'
import { makeNPCGenerationPrompt, parseNPCGenerationResponse } from '../utils/npc-prompts.mjs'

export async function POST(req, res) {
  try {
    const body = req.body
    const { archetype, prompt, context, model: customModel } = body

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

    if (customModel !== undefined && typeof customModel !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'model' must be a string if provided"
      })
    }

    // Get model for NPC generation
    const selectedModel = getModelForTask('npc_dialogue', customModel, 'quality')

    // Generate prompt with examples
    const aiPrompt = makeNPCGenerationPrompt(archetype, prompt, context)

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
      return res.status(500).json({
        error: 'Failed to generate NPC from AI service',
        details: error.message
      })
    }

    // Parse AI response
    let npcData
    try {
      npcData = parseNPCGenerationResponse(text)
    } catch (error) {
      console.error('Parse error:', error)
      return res.status(502).json({
        error: 'Failed to parse AI response',
        rawResponse: text,
        details: error.message
      })
    }

    // Add metadata
    const completeNPC = {
      id: `npc_${Date.now()}`,
      ...npcData,
      metadata: {
        generatedBy: 'AI',
        model: customModel || 'default',
        timestamp: new Date().toISOString()
      }
    }

    return res.json({
      npc: completeNPC,
      model: customModel || 'default',
      rawResponse: text
    })
  } catch (error) {
    console.error('NPC generation error:', error)
    return res.status(500).json({
      error: 'Failed to generate NPC',
      details: error.message
    })
  }
}

