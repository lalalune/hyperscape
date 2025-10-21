/**
 * Manifest Suggestion Prompts
 *
 * AI prompts for generating manifest suggestions when gaps are detected
 */

/**
 * Generate AI prompt for item suggestion
 */
export const makeItemSuggestionPrompt = (gap, tier, existingItems) => {
  // Validate inputs
  if (!gap || typeof gap !== 'object') {
    throw new Error('makeItemSuggestionPrompt: gap must be an object')
  }
  if (!tier || typeof tier !== 'object') {
    throw new Error('makeItemSuggestionPrompt: tier must be an object')
  }
  if (!Array.isArray(existingItems)) {
    existingItems = []
  }

  const minLevel = Number(tier?.levelRange?.min) ?? 1
  const maxLevel = Number(tier?.levelRange?.max) ?? minLevel

  return `\
DETECTED GAP: Quest "${gap.requiredBy || 'unknown'}" needs item "${gap.suggestedId || 'unknown'}" but it doesn't exist.

TIER: ${tier.name || 'unknown'} (${tier.material || 'basic'}, level ${minLevel}-${maxLevel})
REASON: ${gap.reason || 'Item is required but does not exist'}

EXISTING ITEMS IN THIS TIER:
${existingItems.slice(0, 10).map(item => `  - ${item.id}: ${item.name} (${item.type}, level ${item.level || item.requirements?.level || 1})`).join('\n')}
${existingItems.length > 10 ? `  ... and ${existingItems.length - 10} more items` : ''}

CRITICAL: FIRST check if ANY existing item could work instead!

If an existing item can work:
{
  "useExisting": true,
  "existingId": "item_id_here",
  "reason": "Why this existing item works"
}

If you MUST create a new item:
{
  "useExisting": false,
  "item": {
    "id": "${gap.suggestedId}",
    "name": "Display Name",
    "type": "weapon|armor|tool|resource|consumable",
    "quantity": 1,
    "stackable": false,
    "maxStackSize": 1,
    "value": 50,
    "weight": 1.0,
    "equipSlot": null,
    "weaponType": null,
    "equipable": false,
    "attackType": null,
    "description": "Brief description",
    "examine": "Examine text",
    "tradeable": true,
    "rarity": "common",
    "modelPath": null,
    "iconPath": null,
    "healAmount": 0,
    "stats": {
      "attack": 0,
      "defense": 0,
      "strength": 0
    },
    "bonuses": {
      "attack": 0,
      "strength": 0,
      "defense": 0,
      "ranged": 0
    },
    "requirements": {
      "level": ${minLevel},
      "skills": {}
    }
  },
  "confidence": 85,
  "reason": "Why a new item is necessary"
}

NAMING CONVENTION: ${tier.material || 'basic'}_itemtype (e.g., bronze_sword, iron_axe)

Return ONLY valid JSON, no markdown, no explanation.
`
}

/**
 * Generate AI prompt for mob suggestion
 */
export const makeMobSuggestionPrompt = (gap, tier, existingMobs) => {
  // Validate inputs
  if (!tier || typeof tier !== 'object') {
    throw new Error('makeMobSuggestionPrompt: tier must be an object')
  }
  const minLevel = Number(tier?.levelRange?.min) ?? 1
  const maxLevel = Number(tier?.levelRange?.max) ?? minLevel

  return `\
DETECTED GAP: Quest "${gap.requiredBy || 'unknown'}" needs mob "${gap.suggestedId || 'unknown'}" but it doesn't exist.

TIER: ${tier.name || 'unknown'} (${tier.material || 'basic'}, level ${minLevel}-${maxLevel})
REASON: ${gap.reason || 'Mob is required but does not exist'}

EXISTING MOBS IN THIS TIER:
${existingMobs.slice(0, 10).map(mob => `  - ${mob.id}: ${mob.name} (level ${mob.stats?.level || mob.level || mob.combatLevel || 1}, ${mob.type})`).join('\n')}
${existingMobs.length > 10 ? `  ... and ${existingMobs.length - 10} more mobs` : ''}

CRITICAL: FIRST check if ANY existing mob could work instead!

If an existing mob can work:
{
  "useExisting": true,
  "existingId": "mob_id_here",
  "reason": "Why this existing mob works"
}

If you MUST create a new mob:
{
  "useExisting": false,
  "mob": {
    "id": "${gap.suggestedId}",
    "name": "Mob Display Name",
    "description": "Brief description",
    "difficultyLevel": 1,
    "mobType": "creature",
    "type": "creature",
    "stats": {
      "level": ${Math.floor((minLevel + maxLevel) / 2)},
      "attack": ${minLevel * 2},
      "strength": ${minLevel * 2},
      "defense": ${minLevel * 2},
      "constitution": ${minLevel * 10},
      "ranged": 1,
      "magic": 1
    },
    "behavior": {
      "aggressive": false,
      "aggroRange": 3,
      "wanderRadius": 10,
      "respawnTime": 30
    },
    "drops": [],
    "spawnBiomes": ["grassland"],
    "modelPath": "/models/mobs/${gap.suggestedId || 'unknown'}.glb",
    "respawnTime": 30,
    "xpReward": ${minLevel * 5}
  },
  "confidence": 80,
  "reason": "Why a new mob is necessary"
}

Return ONLY valid JSON, no markdown, no explanation.
`
}

/**
 * Generate AI prompt for NPC suggestion with character reuse emphasis
 */
export const makeNPCSuggestionPrompt = (gap, existingNPCs, availableQuests, context) => {
  return `\
DETECTED GAP: Quest/dialogue needs NPC "${gap.suggestedId}" but it doesn't exist.

REASON: ${gap.reason}

EXISTING NPCs (STRONGLY PREFER REUSING THESE):
${existingNPCs.slice(0, 15).map(npc => `  - ${npc.id}: ${npc.name} (${npc.type || npc.npcType})
    Services: ${npc.services?.join(', ') || 'none'}
    Can offer quests: ${availableQuests.filter(q => !q.questGiver || q.questGiver === 'pending').length > 0 ? 'YES' : 'maybe'}`).join('\n')}

AVAILABLE QUESTS NEEDING GIVERS:
${availableQuests.filter(q => !q.questGiver || q.questGiver === 'pending').map(q => `  - ${q.title} (${q.difficulty})`).join('\n') || 'None'}

CRITICAL CHARACTER REUSE RULES:
1. If quest needs a merchant → REUSE an existing merchant NPC (80% preference)
2. If quest needs a quest-giver → CHECK if existing NPC can give it (80% preference)
3. Only create NEW NPC if:
   - New geographic area requires local NPC
   - Unique role not filled by existing NPCs
   - Story specifically requires a new character (20% cases)

4. NEW NPCs MUST:
   - Reference at least 2 existing NPCs in backstory
   - Have relationships with existing characters
   - Fit into existing faction/location structure

If an existing NPC can work (PREFERRED 80% OF THE TIME):
{
  "useExisting": true,
  "existingId": "npc_id_here",
  "existingName": "NPC Name",
  "reason": "Why this existing NPC can handle the role",
  "modifications": "Any dialogue/quest modifications needed"
}

If you MUST create a new NPC (20% OF THE TIME - JUSTIFY!):
{
  "useExisting": false,
  "npc": {
    "id": "${gap.suggestedId}",
    "name": "NPC Display Name",
    "description": "Brief description that references existing NPCs and world events",
    "type": "merchant|guard|quest_giver|banker|hermit",
    "npcType": "merchant",
    "modelPath": "/models/npcs/${gap.suggestedId}.glb",
    "services": ["shop", "quest"]
  },
  "loreIntegration": {
    "referencedNPCs": ["npc_id_1", "npc_id_2"],
    "referencedEvents": ["event_name"],
    "backstoryConnections": "How backstory ties to existing lore",
    "relationships": [
      {
        "npcId": "existing_npc_id",
        "type": "ally|rival|family|mentor",
        "strength": 50,
        "history": "Relationship history"
      }
    ]
  },
  "confidence": 60,
  "reason": "Strong justification why NEW NPC is absolutely necessary"
}

Return ONLY valid JSON, no markdown, no explanation.
`
}

/**
 * Generate AI prompt for resource suggestion
 */
export const makeResourceSuggestionPrompt = (gap, tier, existingResources) => {
  // Validate inputs with safe defaults
  if (!gap || typeof gap !== 'object') {
    gap = { requiredBy: 'unknown', suggestedId: 'unknown', reason: 'Resource is required' }
  }
  if (!tier || typeof tier !== 'object') {
    tier = { name: 'unknown', material: 'basic', levelRange: { min: 1, max: 1 } }
  }
  if (!Array.isArray(existingResources)) {
    existingResources = []
  }

  const minLevel = Number(tier?.levelRange?.min) ?? 1
  const maxLevel = Number(tier?.levelRange?.max) ?? minLevel

  return `\
DETECTED GAP: Quest "${gap.requiredBy || 'unknown'}" needs resource "${gap.suggestedId || 'unknown'}" but it doesn't exist.

TIER: ${tier.name || 'unknown'} (${tier.material || 'basic'}, level ${minLevel}-${maxLevel})
REASON: ${gap.reason || 'Resource is required but does not exist'}

EXISTING RESOURCES IN THIS TIER:
${existingResources.slice(0, 10).map(res => `  - ${res.id}: ${res.name} (${res.type}, level ${res.level || 1})`).join('\n')}
${existingResources.length > 10 ? `  ... and ${existingResources.length - 10} more resources` : ''}

CRITICAL: FIRST check if ANY existing resource could work instead!

If an existing resource can work:
{
  "useExisting": true,
  "existingId": "resource_id_here",
  "reason": "Why this existing resource works"
}

If you MUST create a new resource:
{
  "useExisting": false,
  "resource": {
    "id": "${gap.suggestedId}",
    "name": "Resource Display Name",
    "type": "tree|rock|fish|plant",
    "modelPath": "/models/resources/${gap.suggestedId || 'unknown'}.glb",
    "level": ${minLevel},
    "xp": ${minLevel * 5},
    "respawnTime": 30,
    "harvestYield": {
      "itemId": "item_from_resource",
      "quantity": 1
    },
    "requirements": {
      "level": ${minLevel},
      "tool": null
    }
  },
  "confidence": 75,
  "reason": "Why a new resource is necessary"
}

Return ONLY valid JSON, no markdown, no explanation.
`
}

/**
 * Parse manifest suggestion response from AI
 * Handles nested objects properly with depth counter
 */
export const parseManifestSuggestionResponse = (text) => {
  // First try to find a fenced JSON code block
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1])
  }

  // Find first opening brace
  const startIndex = text.indexOf('{')
  if (startIndex === -1) {
    throw new Error('No JSON object found in AI response')
  }

  // Use depth counter to find matching closing brace
  let depth = 0
  let inString = false
  let escapeNext = false

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        // Found matching closing brace
        const jsonString = text.substring(startIndex, i + 1)
        return JSON.parse(jsonString)
      }
    }
  }

  throw new Error('No complete JSON object found in AI response')
}
