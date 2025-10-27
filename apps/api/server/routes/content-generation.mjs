/**
 * Content Generation API Routes
 * AI-powered content generation for NPCs, quests, dialogue, and lore
 *
 * Integrated with embeddings for memory-augmented generation
 */

import express from 'express'
import { generateText } from 'ai'
import { AISDKService } from '../services/AISDKService.mjs'
import ContentEmbedder from '../services/ContentEmbedder.mjs'
import { getUserApiKey } from './users.mjs'
import db from '../database/db.mjs'

const router = express.Router()
const embedder = new ContentEmbedder(db)

/**
 * Get AISDKService instance with user's API key if available
 */
async function getAIService(req) {
  const userId = req.headers['x-user-id']
  const openaiKey = userId ? await getUserApiKey(userId, 'openai') : null
  
  return new AISDKService({
    openaiApiKey: openaiKey || process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY
  })
}

/**
 * POST /api/generate-dialogue
 * Generate NPC dialogue tree nodes
 */
router.post('/generate-dialogue', async (req, res) => {
  try {
    const { npcName, npcPersonality, context, existingNodes, model: customModel } = req.body

    // Input validation
    if (!npcName || typeof npcName !== 'string' || npcName.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'npcName' must be a non-empty string",
        code: 'CONTENT_4000'
      })
    }

    if (!npcPersonality || typeof npcPersonality !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'npcPersonality' must be a string",
        code: 'CONTENT_4001'
      })
    }

    if (!Array.isArray(existingNodes)) {
      return res.status(400).json({
        error: "Invalid input: 'existingNodes' must be an array",
        code: 'CONTENT_4002'
      })
    }

    // Get AI service with user's API key
    const aiService = await getAIService(req)

    // Get configured model for dialogue generation
    const aiModel = await aiService.getConfiguredModel(
      'dialogue-generation',
      customModel || 'gpt-4o-mini',
      'openai'
    )

    // Build context from similar NPCs for dialogue inspiration
    let embeddingContext = ''
    try {
      const searchQuery = `${npcName} ${npcPersonality} dialogue conversation`
      console.log(`[Content Generation] Building context from similar NPCs/dialogue: "${searchQuery}"`)

      const { context: similarContext, hasContext } = await embedder.buildContext(searchQuery, {
        contentType: 'npc',
        limit: 2,
        threshold: 0.75
      })

      if (hasContext) {
        embeddingContext = `\n\n--- SIMILAR NPC DIALOGUE EXAMPLES ---\n${similarContext}\n--- END EXAMPLES ---\n\nCreate dialogue that matches the personality but is unique.\n\n`
        console.log(`[Content Generation] Found similar NPCs for dialogue inspiration`)
      } else {
        console.log(`[Content Generation] No similar NPCs found, generating dialogue without context`)
      }
    } catch (error) {
      console.warn(`[Content Generation] Failed to build embedding context (continuing without it):`, error.message)
      // Continue without embeddings - they enhance but aren't required
    }

    // Build prompt with embedding context
    const prompt = buildDialoguePrompt(npcName, npcPersonality, context || '', existingNodes) + embeddingContext

    // Generate dialogue with AI
    console.log(`[Content Generation] Generating dialogue for NPC: ${npcName}`)
    const result = await generateText({
      model: aiModel,
      prompt,
      temperature: 0.8,
      maxTokens: 2000
    })

    // Parse AI response
    const nodes = parseDialogueResponse(result.text)

    console.log(`[Content Generation] Generated ${nodes.length} dialogue nodes`)

    return res.json({
      nodes,
      model: customModel || 'gpt-4o-mini',
      rawResponse: result.text
    })
  } catch (error) {
    console.error('[Content Generation] Dialogue generation error:', error)
    return res.status(500).json({
      error: 'Failed to generate dialogue',
      code: 'CONTENT_5000',
      details: error.message
    })
  }
})

/**
 * POST /api/generate-npc
 * Generate complete NPC character
 */
router.post('/generate-npc', async (req, res) => {
  try {
    const { archetype, prompt, context, model: customModel } = req.body

    // Input validation
    if (!archetype || typeof archetype !== 'string' || archetype.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'archetype' must be a non-empty string",
        code: 'CONTENT_4010'
      })
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'prompt' must be a non-empty string",
        code: 'CONTENT_4011'
      })
    }

    // Get AI service with user's API key
    const aiService = await getAIService(req)

    // Get configured model
    const aiModel = await aiService.getConfiguredModel(
      'npc-generation',
      customModel || 'gpt-4o',
      'openai'
    )

    // Build context from similar NPCs (memory-augmented generation)
    let embeddingContext = ''
    try {
      const searchQuery = prompt || `${archetype} NPC character`
      console.log(`[Content Generation] Building context from similar NPCs: "${searchQuery}"`)

      const { context: similarContext, hasContext } = await embedder.buildContext(searchQuery, {
        contentType: 'npc',
        limit: 3,
        threshold: 0.7
      })

      if (hasContext) {
        embeddingContext = `\n\n--- SIMILAR NPCs FOR INSPIRATION ---\n${similarContext}\n--- END SIMILAR NPCs ---\n\nCreate a UNIQUE NPC that is different from the examples above.\n\n`
        console.log(`[Content Generation] Found ${similarContext.split('[NPC').length - 1} similar NPCs for context`)
      } else {
        console.log(`[Content Generation] No similar NPCs found, generating without context`)
      }
    } catch (error) {
      console.warn(`[Content Generation] Failed to build embedding context (continuing without it):`, error.message)
      // Continue without embeddings - they enhance but aren't required
    }

    // Build prompt with embedding context
    const aiPrompt = buildNPCPrompt(archetype, prompt, context) + embeddingContext

    // Generate NPC with AI
    console.log(`[Content Generation] Generating NPC with archetype: ${archetype}`)
    const result = await generateText({
      model: aiModel,
      prompt: aiPrompt,
      temperature: 0.8,
      maxTokens: 3000
    })

    // Parse AI response
    const npcData = parseNPCResponse(result.text)

    // Add metadata
    const completeNPC = {
      id: `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...npcData,
      metadata: {
        generatedBy: 'AI',
        model: customModel || 'gpt-4o',
        timestamp: new Date().toISOString(),
        archetype
      }
    }

    console.log(`[Content Generation] Generated NPC: ${completeNPC.name}`)

    // Auto-embed the generated NPC for future context
    try {
      await embedder.embedNPC(completeNPC.id, completeNPC)
      console.log(`[Content Generation] Embedded NPC: ${completeNPC.id}`)
    } catch (error) {
      console.warn(`[Content Generation] Failed to embed NPC (continuing):`, error.message)
      // Don't fail the request if embedding fails
    }

    return res.json({
      npc: completeNPC,
      model: customModel || 'gpt-4o',
      rawResponse: result.text
    })
  } catch (error) {
    console.error('[Content Generation] NPC generation error:', error)
    return res.status(500).json({
      error: 'Failed to generate NPC',
      code: 'CONTENT_5010',
      details: error.message
    })
  }
})

/**
 * POST /api/generate-quest
 * Generate game quest
 */
router.post('/generate-quest', async (req, res) => {
  try {
    const { questType, difficulty, theme, context, model: customModel } = req.body

    // Input validation
    if (!questType || typeof questType !== 'string' || questType.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'questType' must be a non-empty string",
        code: 'CONTENT_4020'
      })
    }

    if (!difficulty || typeof difficulty !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'difficulty' must be a string",
        code: 'CONTENT_4021'
      })
    }

    // Get AI service with user's API key
    const aiService = await getAIService(req)

    // Get configured model
    const aiModel = await aiService.getConfiguredModel(
      'quest-generation',
      customModel || 'gpt-4o',
      'openai'
    )

    // Build context from similar quests (memory-augmented generation)
    let embeddingContext = ''
    try {
      const searchQuery = theme || `${difficulty} ${questType} quest`
      console.log(`[Content Generation] Building context from similar quests: "${searchQuery}"`)

      const { context: similarContext, hasContext } = await embedder.buildContext(searchQuery, {
        contentType: 'quest',
        limit: 3,
        threshold: 0.7
      })

      if (hasContext) {
        embeddingContext = `\n\n--- SIMILAR QUESTS FOR INSPIRATION ---\n${similarContext}\n--- END SIMILAR QUESTS ---\n\n`
        console.log(`[Content Generation] Found ${similarContext.split('[QUEST').length - 1} similar quests for context`)
      } else {
        console.log(`[Content Generation] No similar quests found, generating without context`)
      }
    } catch (error) {
      console.warn(`[Content Generation] Failed to build embedding context (continuing without it):`, error.message)
      // Continue without embeddings - they enhance but aren't required
    }

    // Build prompt with embedding context
    const aiPrompt = buildQuestPrompt(questType, difficulty, theme, context) + embeddingContext

    // Generate quest with AI
    console.log(`[Content Generation] Generating ${difficulty} ${questType} quest`)
    const result = await generateText({
      model: aiModel,
      prompt: aiPrompt,
      temperature: 0.7,
      maxTokens: 3000
    })

    // Parse AI response
    const questData = parseQuestResponse(result.text)

    // Add metadata
    const completeQuest = {
      id: `quest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...questData,
      difficulty,
      questType,
      metadata: {
        generatedBy: 'AI',
        model: customModel || 'gpt-4o',
        timestamp: new Date().toISOString()
      }
    }

    console.log(`[Content Generation] Generated quest: ${completeQuest.title}`)

    // Auto-embed the generated quest for future context
    try {
      await embedder.embedQuest(completeQuest.id, completeQuest)
      console.log(`[Content Generation] Embedded quest: ${completeQuest.id}`)
    } catch (error) {
      console.warn(`[Content Generation] Failed to embed quest (continuing):`, error.message)
      // Don't fail the request if embedding fails
    }

    return res.json({
      quest: completeQuest,
      model: customModel || 'gpt-4o',
      rawResponse: result.text
    })
  } catch (error) {
    console.error('[Content Generation] Quest generation error:', error)
    return res.status(500).json({
      error: 'Failed to generate quest',
      code: 'CONTENT_5020',
      details: error.message
    })
  }
})

// ============================================================================
// Helper Functions - Prompt Building
// ============================================================================

function buildDialoguePrompt(npcName, personality, context, existingNodes) {
  return `You are a dialogue writer for an RPG game. Generate dialogue tree nodes for an NPC.

NPC Name: ${npcName}
Personality: ${personality}
${context ? `Context: ${context}` : ''}
${existingNodes.length > 0 ? `Existing Nodes: ${JSON.stringify(existingNodes, null, 2)}` : ''}

Generate 3-5 dialogue nodes in JSON format:
[
  {
    "id": "unique_id",
    "text": "dialogue text",
    "responses": [
      {"text": "player response", "nextNodeId": "next_node_id"}
    ]
  }
]

Return ONLY the JSON array, no explanation.`
}

function buildNPCPrompt(archetype, userPrompt, context) {
  return `You are an NPC character designer for an RPG game. Generate a complete NPC character.

Archetype: ${archetype}
Requirements: ${userPrompt}
${context ? `Context: ${context}` : ''}

Generate a complete NPC in JSON format:
{
  "name": "NPC Name",
  "archetype": "${archetype}",
  "personality": {
    "traits": ["trait1", "trait2", "trait3"],
    "background": "background story",
    "motivations": ["motivation1", "motivation2"]
  },
  "appearance": {
    "description": "physical description",
    "equipment": ["item1", "item2"]
  },
  "dialogue": {
    "greeting": "greeting text",
    "farewell": "farewell text",
    "idle": ["idle line 1", "idle line 2"]
  },
  "behavior": {
    "role": "their role in the world",
    "schedule": "daily routine",
    "relationships": []
  }
}

Return ONLY the JSON object, no explanation.`
}

function buildQuestPrompt(questType, difficulty, theme, context) {
  return `You are a quest designer for an RPG game. Generate a complete quest.

Quest Type: ${questType}
Difficulty: ${difficulty}
${theme ? `Theme: ${theme}` : ''}
${context ? `Context: ${context}` : ''}

Generate a quest in JSON format:
{
  "title": "Quest Title",
  "description": "Quest description",
  "objectives": [
    {"description": "objective 1", "type": "kill|collect|talk|explore", "target": "target", "count": 1}
  ],
  "rewards": {
    "experience": 100,
    "gold": 50,
    "items": ["item1"]
  },
  "requirements": {
    "level": 1,
    "previousQuests": []
  },
  "npcs": ["NPC Name"],
  "location": "Location Name",
  "story": "Quest narrative"
}

Return ONLY the JSON object, no explanation.`
}

// ============================================================================
// Helper Functions - Response Parsing
// ============================================================================

function parseDialogueResponse(text) {
  try {
    // Remove markdown code blocks if present
    let cleaned = text.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7)
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3)
    }
    cleaned = cleaned.trim()

    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (error) {
    console.error('[Parse Error] Failed to parse dialogue response:', error.message)
    throw new Error('Invalid JSON response from AI')
  }
}

function parseNPCResponse(text) {
  try {
    let cleaned = text.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7)
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3)
    }
    cleaned = cleaned.trim()

    return JSON.parse(cleaned)
  } catch (error) {
    console.error('[Parse Error] Failed to parse NPC response:', error.message)
    throw new Error('Invalid JSON response from AI')
  }
}

function parseQuestResponse(text) {
  try {
    let cleaned = text.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7)
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3)
    }
    cleaned = cleaned.trim()

    return JSON.parse(cleaned)
  } catch (error) {
    console.error('[Parse Error] Failed to parse quest response:', error.message)
    throw new Error('Invalid JSON response from AI')
  }
}

export default router
