/**
 * Dialogue Generation API Route
 *
 * AI-powered dialogue tree node generation using few-shot prompting
 */

import { generateText } from 'ai'
import { getModelForTask } from '../utils/ai-router.mjs'
import { makeDialogueNodePrompt, parseDialogueResponse } from '../utils/dialogue-prompts.mjs'
import { standardErrors } from '../utils/errorResponse.mjs'

export async function POST(req, res) {
  try {
    const body = req.body
    const { npcName, npcPersonality, context, existingNodes, model: customModel } = body

    // Input validation
    if (!npcName || typeof npcName !== 'string' || npcName.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'npcName' must be a non-empty string"
      })
    }

    if (!npcPersonality || typeof npcPersonality !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'npcPersonality' must be a string"
      })
    }

    if (npcName.length > 10000) {
      return res.status(400).json({
        error: "Invalid input: 'npcName' must not exceed 10,000 characters"
      })
    }

    if (npcPersonality.length > 10000) {
      return res.status(400).json({
        error: "Invalid input: 'npcPersonality' must not exceed 10,000 characters"
      })
    }

    if (context && typeof context === 'string' && context.length > 10000) {
      return res.status(400).json({
        error: "Invalid input: 'context' must not exceed 10,000 characters"
      })
    }

    if (!Array.isArray(existingNodes)) {
      return res.status(400).json({
        error: "Invalid input: 'existingNodes' must be an array"
      })
    }

    if (customModel !== undefined && typeof customModel !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'model' must be a string if provided"
      })
    }

    // Get model for dialogue generation
    const selectedModel = getModelForTask('dialogue_tree', customModel, 'cost')
    const modelIdentifier = selectedModel.modelId || customModel || 'default'

    // Generate prompt with few-shot examples
    const prompt = makeDialogueNodePrompt(npcName, npcPersonality, context || '', existingNodes)

    // Generate dialogue with AI
    let text
    try {
      const result = await generateText({
        model: selectedModel,
        prompt,
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
    let nodes
    try {
      nodes = parseDialogueResponse(text)
    } catch (error) {
      console.error('Parse error:', error)
      return res.status(502).json(standardErrors.parseError(text, error))
    }

    return res.json({
      nodes,
      model: modelIdentifier,
      rawResponse: text
    })
  } catch (error) {
    console.error('Dialogue generation error:', error)
    return res.status(500).json(standardErrors.internalError('Failed to generate dialogue', {
      errorMessage: error.message,
      stack: error.stack
    }))
  }
}

