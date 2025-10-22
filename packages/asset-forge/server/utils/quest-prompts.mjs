/**
 * Quest Prompts (Server-side)
 * Few-shot prompts for complete quest generation
 */

export const makeQuestGenerationPrompt = (questType, userPrompt, context) => {
  return `\
${context ? `${context}\n` : ''}
Generate a complete quest for a Runescape-style MMORPG as a JSON object.

## Quest Type
${questType}

## User Requirements
${userPrompt}

## Example Quest

{
  "id": "goblin_slayer",
  "title": "Goblin Slayer",
  "description": "The village elder needs help dealing with goblins raiding local farms.",
  "difficulty": "easy",
  "type": "combat",
  "objectives": [
    {
      "id": "obj_1",
      "type": "combat",
      "description": "Defeat 5 goblins",
      "actionHandler": "ATTACK_MOB",
      "target": "goblin",
      "targetMob": "goblin",
      "quantity": 5,
      "currentProgress": 0
    }
  ],
  "rewards": {
    "experience": 100,
    "gold": 50,
    "items": [
      {"itemId": "bronze_sword", "quantity": 1}
    ]
  },
  "prerequisites": {
    "level": 1
  },
  "questGiver": "village_elder",
  "loreContext": "Goblins terrorize local farmers."
}

CRITICAL INSTRUCTIONS:
- Use ONLY the item/mob/resource IDs listed in the World Context above
- Ensure rewards match the tier and level range specified
- Avoid duplicating quest types already listed in EXISTING QUESTS
- If items are marked with ★, prioritize using them in rewards or objectives
- Only invent NEW items/mobs if absolutely necessary - clearly mark them as [NEW]

Return ONLY valid JSON, no markdown, no explanation.
`
}

export const parseQuestGenerationResponse = (text) => {
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

