/**
 * Quest Generation Prompts
 * 
 * Few-shot prompts for generating complete quest lines with objectives and rewards
 */

export const makeQuestGenerationPrompt = (questType: string, userPrompt: string, context?: string) => {
  return `\
Generate a complete quest for a Runescape-style MMORPG as a JSON object.

${context ? `## World Context\n${context}\n` : ''}

## Quest Type
${questType}

## User Requirements
${userPrompt}

## Examples of High-Quality Quests

### Example 1: Combat Quest
{
  "id": "goblin_slayer",
  "title": "Goblin Slayer",
  "description": "The village elder needs help dealing with goblins that have been raiding local farms. Clear out their camp and restore peace to the area.",
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
  "loreContext": "Goblins have been terrorizing local farmers, stealing livestock and burning crops. The village needs a hero to deal with this threat."
}

### Example 2: Gathering Quest
{
  "id": "herbalist_request",
  "title": "The Herbalist's Request",
  "description": "Maven Blackwood needs rare herbs for her research. Gather moonflowers from the haunted forest and return them to her.",
  "difficulty": "medium",
  "type": "gathering",
  "objectives": [
    {
      "id": "obj_1",
      "type": "gathering",
      "description": "Collect 10 Moonflowers",
      "actionHandler": "GATHER_RESOURCE",
      "target": "moonflower",
      "targetResource": "moonflower",
      "quantity": 10,
      "currentProgress": 0
    },
    {
      "id": "obj_2",
      "type": "delivery",
      "description": "Return herbs to Maven Blackwood",
      "actionHandler": "TALK_TO_NPC",
      "target": "maven_blackwood",
      "quantity": 1,
      "currentProgress": 0
    }
  ],
  "rewards": {
    "experience": 250,
    "gold": 75,
    "items": [
      {"itemId": "healing_potion", "quantity": 3}
    ]
  },
  "prerequisites": {
    "level": 5
  },
  "questGiver": "maven_blackwood",
  "loreContext": "Maven's research into ancient remedies requires rare moonflowers that only bloom in the haunted forest at night."
}

### Example 3: Chain Quest
{
  "id": "prophecy_unfolds",
  "title": "The Prophecy Unfolds",
  "description": "Brother Aldric has foreseen a great darkness. You must gather three sacred relics to prevent catastrophe.",
  "difficulty": "hard",
  "type": "epic_chain",
  "objectives": [
    {
      "id": "obj_1",
      "type": "exploration",
      "description": "Find the Relic of Light in the Ancient Temple",
      "actionHandler": "EXPLORE_LOCATION",
      "target": "ancient_temple",
      "quantity": 1,
      "currentProgress": 0
    },
    {
      "id": "obj_2",
      "type": "combat",
      "description": "Defeat the Shadow Guardian",
      "actionHandler": "ATTACK_MOB",
      "target": "shadow_guardian",
      "targetMob": "shadow_guardian",
      "quantity": 1,
      "currentProgress": 0
    },
    {
      "id": "obj_3",
      "type": "gathering",
      "description": "Collect the Tears of the Moon",
      "actionHandler": "GATHER_RESOURCE",
      "target": "moon_tears",
      "targetResource": "moon_tears",
      "quantity": 1,
      "currentProgress": 0
    },
    {
      "id": "obj_4",
      "type": "ritual",
      "description": "Perform the ritual at dawn",
      "actionHandler": "PERFORM_RITUAL",
      "target": "ritual_circle",
      "quantity": 1,
      "currentProgress": 0
    }
  ],
  "rewards": {
    "experience": 1000,
    "gold": 500,
    "items": [
      {"itemId": "blessing_of_light", "quantity": 1}
    ]
  },
  "prerequisites": {
    "level": 20,
    "completedQuests": ["shadows_rising"]
  },
  "questGiver": "brother_aldric",
  "loreContext": "Ancient prophecies speak of a darkness that will consume the world. Only the three sacred relics, united at the ritual circle, can prevent this fate."
}

### Example 4: Social/Investigation Quest
{
  "id": "missing_merchant",
  "title": "The Missing Merchant",
  "description": "A wealthy merchant has disappeared. Investigate his last known whereabouts and uncover what happened.",
  "difficulty": "medium",
  "type": "investigation",
  "objectives": [
    {
      "id": "obj_1",
      "type": "social",
      "description": "Question the tavern keeper",
      "actionHandler": "TALK_TO_NPC",
      "target": "tavern_keeper",
      "quantity": 1,
      "currentProgress": 0
    },
    {
      "id": "obj_2",
      "type": "exploration",
      "description": "Search the merchant's house for clues",
      "actionHandler": "EXPLORE_LOCATION",
      "target": "merchant_house",
      "quantity": 1,
      "currentProgress": 0
    },
    {
      "id": "obj_3",
      "type": "social",
      "description": "Confront the suspect",
      "actionHandler": "TALK_TO_NPC",
      "target": "suspicious_guard",
      "quantity": 1,
      "currentProgress": 0
    }
  ],
  "rewards": {
    "experience": 300,
    "gold": 150,
    "reputation": {
      "faction": "merchants_guild",
      "amount": 25
    }
  },
  "prerequisites": {
    "level": 10
  },
  "questGiver": "merchants_guild_master",
  "loreContext": "The merchant was investigating corruption in the city guard before he vanished. Uncovering the truth may reveal a conspiracy."
}

### Example 5: Crafting/Skills Quest
{
  "id": "master_craftsman",
  "title": "The Master Craftsman",
  "description": "Prove your smithing skills by crafting a masterwork weapon for the guild master.",
  "difficulty": "medium",
  "type": "crafting",
  "objectives": [
    {
      "id": "obj_1",
      "type": "gathering",
      "description": "Mine 10 Iron Ore",
      "actionHandler": "MINE_RESOURCE",
      "target": "iron_ore",
      "targetResource": "iron_ore",
      "quantity": 10,
      "currentProgress": 0
    },
    {
      "id": "obj_2",
      "type": "crafting",
      "description": "Smelt 5 Iron Bars",
      "actionHandler": "SMELT_ORE",
      "target": "iron_bar",
      "quantity": 5,
      "currentProgress": 0
    },
    {
      "id": "obj_3",
      "type": "crafting",
      "description": "Craft a Masterwork Iron Sword",
      "actionHandler": "SMITH_ITEM",
      "target": "masterwork_iron_sword",
      "quantity": 1,
      "currentProgress": 0
    }
  ],
  "rewards": {
    "experience": 500,
    "gold": 200,
    "items": [
      {"itemId": "smithing_hammer_rare", "quantity": 1}
    ],
    "skillXp": {
      "skill": "smithing",
      "amount": 100
    }
  },
  "prerequisites": {
    "level": 15,
    "skills": {
      "smithing": 20,
      "mining": 15
    }
  },
  "questGiver": "guild_master_forge",
  "loreContext": "The smithing guild seeks talented craftsmen. Creating a masterwork weapon will prove your dedication to the craft."
}

---
CRITICAL INSTRUCTIONS:
1. Generate a complete quest JSON object matching the examples above
2. Include a unique id (lowercase, underscores)
3. Create a compelling title and description (2-3 sentences)
4. Set difficulty: easy, medium, hard, or epic
5. Choose type: combat, gathering, crafting, exploration, social, investigation, or epic_chain
6. Create 1-5 objectives with:
   - Unique id
   - Type (combat, gathering, crafting, exploration, social, delivery, ritual)
   - Description
   - actionHandler (from available handlers)
   - target (what mob/resource/npc/location)
   - quantity
   - currentProgress: 0
7. Include rewards with experience (50-1000), gold (25-500), and optional items array
8. Add prerequisites if needed (level, completedQuests, skills)
9. Set questGiver (NPC who gives the quest)
10. Add loreContext (1-2 sentences explaining quest's place in world)
11. Make quest fit ${questType} type and "${userPrompt}" requirements
12. Return ONLY valid JSON, no markdown, no explanation
---

Generate Quest:
`
}

export const parseQuestGenerationResponse = (text: string) => {
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

