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
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch (error) {
      console.error('Failed to parse code block JSON:', error.message)
      console.error('Code block content:', codeBlockMatch[1])
    }
  }

  // Try to find complete JSON object by balancing braces
  const firstBrace = text.indexOf('{')
  if (firstBrace === -1) {
    throw new Error('No JSON object found in response')
  }

  // Extract JSON by counting braces to find the matching closing brace
  let braceCount = 0
  let jsonStart = firstBrace
  let jsonEnd = -1

  for (let i = firstBrace; i < text.length; i++) {
    if (text[i] === '{') {
      braceCount++
    } else if (text[i] === '}') {
      braceCount--
      if (braceCount === 0) {
        jsonEnd = i + 1
        break
      }
    }
  }

  if (jsonEnd === -1) {
    throw new Error('Incomplete JSON object - missing closing brace')
  }

  const jsonText = text.substring(jsonStart, jsonEnd)

  try {
    return JSON.parse(jsonText)
  } catch (error) {
    console.error('JSON parse error:', error.message)
    console.error('Attempted to parse:', jsonText.substring(0, 500))
    throw new Error(`Failed to parse JSON: ${error.message}`)
  }
}

