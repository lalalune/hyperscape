/**
 * NPC Prompts (Server-side)
 * Few-shot prompts for complete NPC generation
 */

export const makeNPCGenerationPrompt = (archetype, userPrompt, context) => {
  return `\
${context ? `${context}\n` : ''}
Generate a complete NPC for a Runescape-style MMORPG as a JSON object.

## NPC Archetype
${archetype}

## User Requirements
${userPrompt}

## Examples of High-Quality NPCs

{
  "personality": {
    "name": "Grenda Ironforge",
    "archetype": "merchant",
    "traits": ["shrewd", "greedy", "paranoid"],
    "goals": ["amass wealth", "control market"],
    "fears": ["bankruptcy", "being robbed"],
    "moralAlignment": "lawful-neutral",
    "backstory": "Former adventurer who lost her leg to a dragon. Now runs the town's only smithy."
  },
  "dialogues": [
    {
      "id": "greeting",
      "text": "Back again? What do ye need?",
      "responses": [
        {"text": "Show me your wares", "nextNodeId": "shop_open"},
        {"text": "I need a custom weapon", "nextNodeId": "quest_offer"}
      ]
    }
  ],
  "services": ["shop"],
  "behavior": {
    "schedule": [
      {"time": "08:00", "location": "shop", "activity": "opening_shop"}
    ]
  }
}

CRITICAL INSTRUCTIONS:
- Create a personality DIFFERENT from the existing NPCs listed in World Context
- Avoid duplicate names, archetypes, or personality traits
- Can reference AVAILABLE QUESTS in dialogue if appropriate for the archetype
- Can establish relationships with EXISTING NPCs if it makes sense narratively
- Be creative but stay consistent with existing world lore

Return ONLY valid JSON, no markdown, no explanation.
`
}

export const parseNPCGenerationResponse = (text) => {
  // First try to find a fenced JSON code block
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1])
  }

  // Fall back to non-greedy regex for a single JSON object
  const jsonMatch = text.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }
  return JSON.parse(jsonMatch[0])
}

