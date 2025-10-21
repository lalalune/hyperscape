/**
 * Quest Prompts (Server-side)
 * Few-shot prompts for complete quest generation
 */

export const makeQuestGenerationPrompt = (questType, userPrompt, context) => {
  return `\
Generate a complete quest for a Runescape-style MMORPG as a JSON object.

${context ? `## World Context\n${context}\n` : ''}

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

Return ONLY valid JSON, no markdown, no explanation.
`
}

export const parseQuestGenerationResponse = (text) => {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }
  return JSON.parse(jsonMatch[0])
}

