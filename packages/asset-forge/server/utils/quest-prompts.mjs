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

