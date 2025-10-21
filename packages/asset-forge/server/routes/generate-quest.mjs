/**
 * Quest Generation API Route
 * 
 * AI-powered complete quest generation with objectives and rewards
 */

import { generateText } from 'ai'
import { getModelForTask } from '../utils/ai-router.mjs'
import { makeQuestGenerationPrompt, parseQuestGenerationResponse } from '../utils/quest-prompts.mjs'

export async function POST(req, res) {
  try {
    const body = req.body
    const { questType, prompt, context, model: customModel } = body

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

    if (customModel !== undefined && typeof customModel !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'model' must be a string if provided"
      })
    }

    // Get model for quest generation
    const selectedModel = getModelForTask('quest_generation', customModel, 'quality')

    // Generate prompt with examples
    const aiPrompt = makeQuestGenerationPrompt(questType, prompt, context)

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
        model: customModel || 'default',
        timestamp: new Date().toISOString()
      }
    }

    return res.json({
      quest: completeQuest,
      model: customModel || 'default',
      rawResponse: text
    })
  } catch (error) {
    console.error('Quest generation error:', error)
    return res.status(500).json({
      error: 'Failed to generate quest',
      details: error.message
    })
  }
}

