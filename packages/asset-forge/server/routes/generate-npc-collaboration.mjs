/**
 * Multi-Agent NPC Collaboration API Route
 *
 * Enable multiple AI agents to roleplay as different NPCs simultaneously,
 * creating authentic dialogue, relationships, and emergent storylines.
 *
 * Features:
 * - Co-creation: NPCs discuss and create content together
 * - Relationship building: NPCs interact to establish histories
 * - Emergent storylines: Quest generation through multi-NPC discussion
 * - Social simulation: Background NPC interactions
 *
 * Research-based implementation using:
 * - Network-style organization with dynamic agent selection
 * - Role-based team member patterns
 * - Cross-validation to reduce hallucinations
 * - Modular perception → memory → reasoning → planning → execution
 */

import { randomUUID } from 'crypto'
import { MultiAgentOrchestrator } from '../services/MultiAgentOrchestrator.mjs'
import { buildNPCContext } from '../utils/context-builder.mjs'
import { makeCollaborationPrompt, makeNPCAgentPrompt } from '../utils/collaboration-prompts.mjs'

export async function POST(req, res) {
  try {
    const body = req.body
    const {
      npcPersonas,
      collaborationType,
      context,
      rounds,
      model: customModel,
      enableCrossValidation
    } = body

    // Input validation
    if (!Array.isArray(npcPersonas) || npcPersonas.length < 2) {
      return res.status(400).json({
        error: "Invalid input: 'npcPersonas' must be an array with at least 2 NPCs"
      })
    }

    if (!collaborationType || !['dialogue', 'quest', 'lore', 'relationship', 'freeform'].includes(collaborationType)) {
      return res.status(400).json({
        error: "Invalid input: 'collaborationType' must be one of: dialogue, quest, lore, relationship, freeform"
      })
    }

    // Validate each NPC persona
    for (const npc of npcPersonas) {
      if (!npc.name || typeof npc.name !== 'string') {
        return res.status(400).json({
          error: "Invalid input: Each NPC must have a 'name' string"
        })
      }
      if (!npc.personality || typeof npc.personality !== 'string') {
        return res.status(400).json({
          error: "Invalid input: Each NPC must have a 'personality' string"
        })
      }
    }

    if (customModel !== undefined && typeof customModel !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'model' must be a string if provided"
      })
    }

    const sessionId = `collab_${randomUUID()}`
    const modelIdentifier = customModel || 'default'

    console.log(`[NPC Collaboration] Starting session ${sessionId} with ${npcPersonas.length} NPCs, type: ${collaborationType}`)

    // Build world context for NPCs
    let worldContext
    try {
      worldContext = await buildNPCContext({
        archetype: 'multiple',
        generatedNPCs: npcPersonas,
        availableQuests: context?.quests || [],
        relationships: context?.relationships || [],
        lore: context?.lore || []
      })
      console.log('[NPC Collaboration] Using context-aware prompts with world data')
    } catch (error) {
      console.warn('[NPC Collaboration] Context build failed, using minimal context:', error.message)
      worldContext = { formatted: context?.description || '' }
    }

    // Create multi-agent orchestrator
    const orchestrator = new MultiAgentOrchestrator({
      maxRounds: rounds || 5,
      temperature: 0.8,
      enableCrossValidation: enableCrossValidation !== false,
      model: customModel
    })

    // Register each NPC as an agent
    for (const npc of npcPersonas) {
      const systemPrompt = makeNPCAgentPrompt(npc, collaborationType, worldContext.formatted)

      orchestrator.registerAgent({
        id: npc.id || `npc_${randomUUID()}`,
        name: npc.name,
        role: npc.archetype || npc.personality.split(',')[0].trim(),
        systemPrompt,
        persona: {
          personality: npc.personality,
          goals: npc.goals || [],
          specialties: npc.specialties || [],
          background: npc.background || '',
          relationships: npc.relationships || {}
        }
      })
    }

    // Generate initial collaboration prompt based on type
    const initialPrompt = makeCollaborationPrompt(
      collaborationType,
      npcPersonas,
      context
    )

    // Run multi-agent conversation
    console.log('[NPC Collaboration] Running conversation rounds...')
    const result = await orchestrator.runConversationRound(initialPrompt)
    console.log(`[NPC Collaboration] Completed ${result.rounds.length} rounds`)

    // Process results based on collaboration type
    const processedResult = await processCollaborationResult(
      result,
      collaborationType,
      orchestrator
    )

    // Get orchestrator stats
    const stats = orchestrator.getStats()

    return res.json({
      sessionId,
      collaborationType,
      npcCount: npcPersonas.length,
      rounds: result.rounds.length,
      conversation: result.rounds,
      emergentContent: processedResult.content,
      validation: result.validation,
      stats,
      metadata: {
        generatedBy: 'Multi-Agent Collaboration',
        model: modelIdentifier,
        timestamp: new Date().toISOString(),
        crossValidated: enableCrossValidation !== false
      }
    })

  } catch (error) {
    console.error('[NPC Collaboration] Generation error:', error)
    return res.status(500).json({
      error: 'Failed to generate multi-agent NPC collaboration',
      details: error.message
    })
  }
}

/**
 * Process collaboration results into structured content
 */
async function processCollaborationResult(result, type, orchestrator) {
  const content = {
    ...result.emergentContent,
    structuredOutput: null
  }

  // Type-specific processing
  switch (type) {
    case 'quest':
      content.structuredOutput = await extractQuestFromConversation(result, orchestrator)
      break

    case 'lore':
      content.structuredOutput = extractLoreFromConversation(result)
      break

    case 'relationship':
      content.structuredOutput = extractRelationshipsFromConversation(result)
      break

    case 'dialogue':
      content.structuredOutput = extractDialogueTreeFromConversation(result)
      break
  }

  return { content }
}

/**
 * Extract quest structure from NPC conversation
 */
async function extractQuestFromConversation(result, orchestrator) {
  // Synthesize quest from conversation
  const conversationText = result.rounds
    .map(r => `${r.agentName}: ${r.content}`)
    .join('\n')

  // Use first agent to synthesize quest
  const firstAgent = Array.from(orchestrator.agents.values())[0]

  const synthesisPrompt = `Based on this conversation between NPCs, extract a structured quest:

${conversationText}

Generate a quest in this JSON format:
{
  "title": "Quest Title",
  "description": "Quest description",
  "objectives": ["objective 1", "objective 2"],
  "rewards": ["reward 1", "reward 2"],
  "involvedNPCs": ["npc names from conversation"],
  "difficulty": "easy/medium/hard"
}

Output ONLY the JSON, no additional text.`

  try {
    const response = await orchestrator.generateAgentResponse(firstAgent, synthesisPrompt)
    const jsonMatch = response.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('Quest extraction failed:', error)
  }

  return {
    title: 'Emergent Quest',
    description: 'A quest that emerged from NPC collaboration',
    objectives: result.emergentContent.questIdeas || [],
    involvedNPCs: result.rounds.map(r => r.agentName)
  }
}

/**
 * Extract lore fragments from conversation
 */
function extractLoreFromConversation(result) {
  const loreFragments = []

  for (const round of result.rounds) {
    // Look for lore-relevant statements (facts, history, stories)
    const content = round.content

    // Simple heuristic: statements about the past, world facts
    if (
      content.includes('ago') ||
      content.includes('once') ||
      content.includes('legend') ||
      content.includes('history') ||
      content.includes('ancient') ||
      content.match(/\d+\s+years/)
    ) {
      loreFragments.push({
        source: round.agentName,
        content: content,
        type: 'historical',
        timestamp: round.timestamp
      })
    }
  }

  return {
    fragments: loreFragments,
    contributors: [...new Set(loreFragments.map(f => f.source))]
  }
}

/**
 * Extract relationship dynamics from conversation
 */
function extractRelationshipsFromConversation(result) {
  const relationships = []
  const sentiment = new Map() // agentA-agentB -> [positive, neutral, negative counts]

  // Analyze interaction patterns
  for (let i = 1; i < result.rounds.length; i++) {
    const prev = result.rounds[i - 1]
    const curr = result.rounds[i]

    const pairKey = [prev.agentName, curr.agentName].sort().join('-')

    if (!sentiment.has(pairKey)) {
      sentiment.set(pairKey, { positive: 0, neutral: 0, negative: 0, interactions: [] })
    }

    const sentimentData = sentiment.get(pairKey)

    // Simple sentiment analysis based on keywords
    const response = curr.content.toLowerCase()
    if (
      response.includes('agree') ||
      response.includes('yes') ||
      response.includes('excellent') ||
      response.includes('friend')
    ) {
      sentimentData.positive++
    } else if (
      response.includes('disagree') ||
      response.includes('no') ||
      response.includes('wrong') ||
      response.includes('against')
    ) {
      sentimentData.negative++
    } else {
      sentimentData.neutral++
    }

    sentimentData.interactions.push({
      round: i,
      context: `${prev.content.slice(0, 50)}... → ${curr.content.slice(0, 50)}...`
    })
  }

  // Convert to structured relationships
  for (const [pairKey, data] of sentiment) {
    const [agent1, agent2] = pairKey.split('-')
    const total = data.positive + data.neutral + data.negative

    let relationshipType = 'neutral'
    if (data.positive > data.negative && data.positive > total * 0.4) {
      relationshipType = 'friendly'
    } else if (data.negative > data.positive && data.negative > total * 0.3) {
      relationshipType = 'conflicted'
    }

    relationships.push({
      agents: [agent1, agent2],
      type: relationshipType,
      interactionCount: total,
      sentiment: {
        positive: data.positive,
        neutral: data.neutral,
        negative: data.negative
      }
    })
  }

  return { relationships }
}

/**
 * Extract dialogue tree nodes from conversation
 */
function extractDialogueTreeFromConversation(result) {
  const nodes = []

  for (let i = 0; i < result.rounds.length; i++) {
    const round = result.rounds[i]
    const nextRound = result.rounds[i + 1]

    nodes.push({
      id: `node_${i}`,
      speaker: round.agentName,
      text: round.content,
      responses: nextRound ? [
        {
          id: `response_${i}_0`,
          text: `(Continue conversation)`,
          nextNodeId: `node_${i + 1}`
        }
      ] : []
    })
  }

  return {
    nodes,
    startNodeId: nodes.length > 0 ? nodes[0].id : null,
    participants: [...new Set(result.rounds.map(r => r.agentName))]
  }
}
