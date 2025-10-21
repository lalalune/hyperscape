/**
 * Multi-Agent Collaboration Prompts (Server-side)
 * Helper functions for building prompts and parsing responses
 */

/**
 * Generate initial collaboration prompt based on type
 */
export function makeCollaborationPrompt(type, npcs, context) {
  const npcNames = npcs.map(n => n.name).join(', ')

  switch (type) {
    case 'dialogue':
      return `${npcNames} are meeting for the first time. ${context?.scenario || 'They begin a natural conversation based on their personalities and goals.'}`

    case 'quest':
      return `${npcNames} are discussing a problem in the world that could become a quest. ${context?.questSeed || 'They brainstorm objectives, challenges, and rewards that fit their roles and the world setting.'}`

    case 'lore':
      return `${npcNames} are gathered to share stories and knowledge about ${context?.loreTopic || 'the history and mysteries of their world'}. Each contributes what they know from their unique perspective.`

    case 'relationship':
      return `${npcNames} are interacting in ${context?.location || 'a social setting'}. ${context?.situation || 'Their relationship develops through authentic conversation and shared experiences.'}`

    case 'freeform':
    default:
      return `${npcNames} are ${context?.situation || 'interacting in the world'}. They respond naturally based on their personalities and goals.`
  }
}

/**
 * Build system prompt for NPC agent in collaboration
 */
export function makeNPCAgentPrompt(npc, collaborationType, worldContext) {
  const typeInstructions = {
    dialogue: 'You are engaging in a natural conversation with other NPCs. Speak authentically in character, building on what others say.',
    quest: 'You are collaborating with other NPCs to design a quest. Contribute ideas that fit your character, role, and expertise. Think about objectives, rewards, and challenges from your perspective.',
    lore: 'You are sharing knowledge and stories with other NPCs. Contribute lore that fits your background, experiences, and areas of expertise. Build on what others share.',
    relationship: 'You are building relationships with other NPCs through authentic interaction. React naturally to what others say based on your personality and goals.',
    freeform: 'You are freely interacting with other NPCs. Respond naturally based on your personality, goals, and the situation at hand.'
  }

  return `You are ${npc.name}, an NPC in a fantasy MMORPG world.

PERSONALITY: ${npc.personality}

BACKGROUND: ${npc.background || 'A resident of this world with a unique perspective shaped by your experiences.'}

GOALS: ${npc.goals ? npc.goals.join(', ') : 'To live authentically and interact meaningfully with others.'}

${worldContext ? `WORLD CONTEXT:\n${worldContext}\n` : ''}

COLLABORATION CONTEXT:
${typeInstructions[collaborationType] || typeInstructions.freeform}

IMPORTANT GUIDELINES:
- Stay in character at all times - every word should reflect your personality
- Build on what other NPCs say (collaborative storytelling, not monologues)
- Be authentic to your personality, background, and goals
- Create emergent storylines through your interactions
- If the discussion reaches a natural conclusion, you may include [END_CONVERSATION]
- Keep responses concise (2-4 sentences per turn) to allow others to participate
- React to what others say - acknowledge their contributions

YOUR RESPONSE:`
}

/**
 * Parse quest structure from NPC conversation
 * This is a simplified version - the actual extraction happens in the route
 */
export function extractQuestStructure(conversationText) {
  // This would use an LLM to synthesize the conversation into a structured quest
  // The actual implementation is in generate-npc-collaboration.mjs
  return {
    title: 'Emergent Quest',
    description: 'A quest that emerged from NPC collaboration',
    objectives: [],
    rewards: [],
    involvedNPCs: []
  }
}

/**
 * Extract lore fragments from conversation based on keywords
 */
export function extractLoreKeywords(text) {
  const loreIndicators = [
    /\b(ago|years ago|centuries ago)\b/i,
    /\b(once|once upon a time)\b/i,
    /\b(legend|legendary|myth|mythology)\b/i,
    /\b(history|historical|ancient)\b/i,
    /\b(prophecy|foretold|prophesied)\b/i,
    /\b(artifact|relic|treasure)\b/i
  ]

  return loreIndicators.some(pattern => pattern.test(text))
}

/**
 * Detect sentiment in response for relationship extraction
 */
export function detectSentiment(text) {
  const positiveWords = ['agree', 'yes', 'excellent', 'friend', 'like', 'appreciate', 'thank', 'wonderful', 'great']
  const negativeWords = ['disagree', 'no', 'wrong', 'against', 'dislike', 'enemy', 'hate', 'terrible', 'awful']

  const textLower = text.toLowerCase()

  const positiveCount = positiveWords.filter(word => textLower.includes(word)).length
  const negativeCount = negativeWords.filter(word => textLower.includes(word)).length

  if (positiveCount > negativeCount && positiveCount > 0) {
    return 'positive'
  } else if (negativeCount > positiveCount && negativeCount > 0) {
    return 'negative'
  }
  return 'neutral'
}
