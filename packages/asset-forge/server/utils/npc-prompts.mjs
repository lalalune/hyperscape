/**
 * NPC Prompts (Server-side)
 * Few-shot prompts for complete NPC generation
 */

export const makeNPCGenerationPrompt = (archetype, userPrompt, context) => {
  return `\
Generate a complete NPC for a Runescape-style MMORPG as a JSON object.

${context ? `## World Context\n${context}\n` : ''}

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

Return ONLY valid JSON, no markdown, no explanation.
`
}

export const parseNPCGenerationResponse = (text) => {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }
  return JSON.parse(jsonMatch[0])
}

