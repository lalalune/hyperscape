/**
 * NPC Generation Prompts
 * 
 * Few-shot prompts for generating complete NPCs with personality, dialogues, quests, and behavior
 */

export const makeNPCGenerationPrompt = (archetype: string, userPrompt: string, context?: string) => {
  return `\
Generate a complete NPC for a Runescape-style MMORPG as a JSON object.

${context ? `## World Context\n${context}\n` : ''}

## NPC Archetype
${archetype}

## User Requirements
${userPrompt}

## Examples of High-Quality NPCs

### Example 1: Merchant NPC
{
  "personality": {
    "name": "Grenda Ironforge",
    "archetype": "merchant",
    "traits": ["shrewd", "greedy", "paranoid", "skilled"],
    "goals": ["amass wealth", "control smithing market", "protect trade secrets"],
    "fears": ["bankruptcy", "being robbed", "losing reputation"],
    "moralAlignment": "lawful-neutral",
    "backstory": "Former adventurer who lost her leg to a dragon. Now runs the town's only smithy, using her knowledge of rare metals to price-gouge desperate heroes."
  },
  "dialogues": [
    {
      "id": "greeting",
      "text": "Back again, are ye? My forge doesn't run on compliments. What do ye need?",
      "responses": [
        {"text": "Show me your wares", "nextNodeId": "shop_open"},
        {"text": "I need a custom weapon", "nextNodeId": "quest_offer"},
        {"text": "Just passing through", "nextNodeId": "farewell"}
      ]
    },
    {
      "id": "shop_open",
      "text": "Aye, these are my finest works. Prices are non-negotiable.",
      "responses": [
        {"text": "I'll take a look", "nextNodeId": "end"},
        {"text": "Too expensive for me", "nextNodeId": "farewell"}
      ]
    },
    {
      "id": "quest_offer",
      "text": "Hmph. My lazy apprentice ran off to the tavern again. Fetch him back and I'll make it worth your while.",
      "responses": [
        {"text": "I'll find him", "nextNodeId": "accept_quest", "effects": [{"type": "ACCEPT_QUEST", "data": {"questId": "blacksmith_apprentice"}}]},
        {"text": "Not my problem", "nextNodeId": "reject_quest"}
      ]
    },
    {
      "id": "farewell",
      "text": "Bah. Come back when ye have coin.",
      "responses": []
    }
  ],
  "services": ["shop"],
  "inventory": [
    {"itemId": "bronze_sword", "itemData": {"name": "Bronze Sword", "value": 50}, "stock": 10, "price": 60},
    {"itemId": "iron_pickaxe", "itemData": {"name": "Iron Pickaxe", "value": 100}, "stock": 5, "price": 120}
  ],
  "behavior": {
    "schedule": [
      {"time": "06:00", "location": "forge", "activity": "heating_furnace"},
      {"time": "08:00", "location": "shop_front", "activity": "opening_shop"},
      {"time": "18:00", "location": "forge", "activity": "crafting"},
      {"time": "22:00", "location": "home", "activity": "resting"}
    ]
  }
}

### Example 2: Quest Giver NPC
{
  "personality": {
    "name": "Brother Aldric",
    "archetype": "mystic",
    "traits": ["wise", "cryptic", "patient", "haunted"],
    "goals": ["preserve forbidden knowledge", "prevent catastrophe", "guide heroes"],
    "fears": ["prophecy coming true", "losing sanity", "knowledge falling into wrong hands"],
    "moralAlignment": "neutral-good",
    "backstory": "A monk who read the Tome of Shadows and saw the end of the world. Now speaks in riddles to guide heroes without breaking his vow."
  },
  "dialogues": [
    {
      "id": "greeting",
      "text": "The threads of fate have brought you here... or perhaps you walk of your own accord?",
      "responses": [
        {"text": "I seek wisdom", "nextNodeId": "wisdom_request"},
        {"text": "Tell me of the prophecy", "nextNodeId": "prophecy_talk"},
        {"text": "Goodbye", "nextNodeId": "farewell"}
      ]
    },
    {
      "id": "prophecy_talk",
      "text": "The darkness stirs... Three relics must be united before the moon turns crimson.",
      "responses": [
        {"text": "How do I stop it?", "nextNodeId": "quest_accept", "effects": [{"type": "ACCEPT_QUEST", "data": {"questId": "prophecy_unfolds"}}]},
        {"text": "This is madness", "nextNodeId": "farewell"}
      ]
    },
    {
      "id": "farewell",
      "text": "May the light guide you...",
      "responses": []
    }
  ],
  "services": ["quest"],
  "behavior": {
    "schedule": [
      {"time": "00:00", "location": "temple", "activity": "meditation"},
      {"time": "06:00", "location": "library", "activity": "studying_prophecies"},
      {"time": "18:00", "location": "courtyard", "activity": "tending_garden"}
    ]
  }
}

### Example 3: Combat Trainer
{
  "personality": {
    "name": "Captain Mira Stormwind",
    "archetype": "warrior",
    "traits": ["brave", "hot-headed", "inspiring", "vengeful"],
    "goals": ["rid seas of pirates", "train warriors", "reclaim her ship"],
    "fears": ["drowning", "mutiny", "dying on land"],
    "moralAlignment": "chaotic-good",
    "backstory": "Naval admiral's daughter who rejected arranged marriage. Lost her ship to pirates, now trains warriors and hunts her betrayers."
  },
  "dialogues": [
    {
      "id": "greeting",
      "text": "You look like you could use some training! Want to learn how to fight like a true warrior?",
      "responses": [
        {"text": "Teach me combat", "nextNodeId": "training_offer"},
        {"text": "Tell me about pirates", "nextNodeId": "pirate_talk"},
        {"text": "Maybe later", "nextNodeId": "farewell"}
      ]
    },
    {
      "id": "training_offer",
      "text": "Good! First lesson: never hesitate. Strike fast, strike hard!",
      "responses": [
        {"text": "I'm ready", "nextNodeId": "end"},
        {"text": "I need to prepare first", "nextNodeId": "farewell"}
      ]
    },
    {
      "id": "farewell",
      "text": "Come back when you're ready to get serious!",
      "responses": []
    }
  ],
  "services": ["training"],
  "behavior": {
    "schedule": [
      {"time": "05:00", "location": "docks", "activity": "inspecting_ships"},
      {"time": "08:00", "location": "training_grounds", "activity": "drilling_recruits"},
      {"time": "20:00", "location": "tavern", "activity": "recruiting_crew"}
    ]
  }
}

---
CRITICAL INSTRUCTIONS:
1. Generate a complete NPC JSON object matching the examples above
2. Include personality with name, archetype, traits (3-5), goals (2-4), fears (2-3), moral alignment, and backstory (2-3 sentences)
3. Create 3-5 dialogue nodes with id, text, and responses (each response needs text and nextNodeId)
4. Add at least one dialogue that offers a quest with proper ACCEPT_QUEST effect
5. Include services array (choose from: shop, bank, quest, training)
6. If shop NPC, include inventory array with 3-5 items
7. Add behavior schedule with 3-5 time slots showing daily routine
8. Make the NPC fit the ${archetype} archetype and "${userPrompt}" requirements
9. Return ONLY valid JSON, no markdown, no explanation, no additional text
10. Ensure all dialogue nodes are reachable and responses link to valid node IDs
---

Generate NPC:
`
}

export const parseNPCGenerationResponse = (text: string) => {
  // Try to extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch?.[0]) {
    throw new Error('No JSON found in response')
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

