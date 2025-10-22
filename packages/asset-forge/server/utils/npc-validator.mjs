/**
 * NPC Validator
 *
 * Validates NPC suggestions with strong emphasis on character reuse
 * Ensures deep lore integration through relationship enforcement
 */

/**
 * Find existing NPCs that could fill the role
 */
export function findReuseableNPCs(role, existingNPCs, generatedNPCs) {
  const allNPCs = [...existingNPCs, ...generatedNPCs]
  const candidates = []

  allNPCs.forEach(npc => {
    let score = 0
    const reasons = []

    // Check archetype match
    const npcType = npc.type || npc.npcType || npc.personality?.archetype
    if (npcType === role.archetype) {
      score += 50
      reasons.push(`Same archetype: ${npcType}`)
    }

    // Check service capabilities
    const npcServices = npc.services || npc.personality?.services || []
    const roleServices = role.services || []

    const matchingServices = npcServices.filter(s => roleServices.includes(s))
    if (matchingServices.length > 0) {
      score += matchingServices.length * 20
      reasons.push(`Provides services: ${matchingServices.join(', ')}`)
    }

    // Check if NPC can give quests
    if (role.needsQuestGiver) {
      const canGiveQuests = npcServices.includes('quest') ||
                           npcType === 'quest_giver' ||
                           npcType === 'quest-giver'
      if (canGiveQuests) {
        score += 30
        reasons.push('Can give quests')
      }
    }

    // Bonus if NPC already has established relationships
    const hasRelationships = npc.relationships && npc.relationships.length > 0
    if (hasRelationships) {
      score += 15
      reasons.push(`Has ${npc.relationships.length} existing relationships`)
    }

    if (score > 40) { // Threshold for viable candidate
      candidates.push({
        npc,
        score,
        reasons,
        canReuse: score > 60 // Strong match
      })
    }
  })

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score)

  return candidates
}

/**
 * Validate NPC suggestion against character reuse rules
 */
export async function validateNPCSuggestion(suggestedNPC, context) {
  const validation = {
    shouldReuse: false,
    canReuse: null, // Best existing NPC that could work
    reuseScore: 0, // 0-100 how well existing NPC matches
    conflicts: [],
    loreConsistency: {
      score: 0, // 0-100
      referencesExistingCharacters: [],
      referencesExistingEvents: [],
      relationshipCount: 0,
      minimumRelationships: 2,
      violations: []
    },
    recommendation: '', // 'reuse' or 'create_new'
    justification: '' // Why recommendation was made
  }

  // 1. Check for reuseable NPCs (80% preference)
  const role = {
    archetype: suggestedNPC.type || suggestedNPC.npcType,
    services: suggestedNPC.services || [],
    needsQuestGiver: context.isQuestGiver
  }

  const reuseCandidates = findReuseableNPCs(
    role,
    context.existingNPCs || [],
    context.generatedNPCs || []
  )

  if (reuseCandidates.length > 0) {
    const bestMatch = reuseCandidates[0]
    validation.canReuse = bestMatch.npc
    validation.reuseScore = bestMatch.score

    if (bestMatch.canReuse) {
      validation.shouldReuse = true
      validation.recommendation = 'reuse'
      validation.justification = `Existing NPC "${bestMatch.npc.name}" can fill this role: ${bestMatch.reasons.join(', ')}`
    }
  }

  // 2. If creating new NPC, check lore consistency
  if (!validation.shouldReuse) {
    validation.recommendation = 'create_new'

    // Extract character references from backstory
    const backstory = suggestedNPC.description || suggestedNPC.personality?.backstory || ''
    const allNPCs = [...(context.existingNPCs || []), ...(context.generatedNPCs || [])]

    allNPCs.forEach(npc => {
      const npcName = npc.name || npc.personality?.name
      if (backstory.includes(npcName)) {
        validation.loreConsistency.referencesExistingCharacters.push(npcName)
      }
    })

    // Check for event references (lore entries)
    if (context.lore) {
      context.lore.forEach(entry => {
        if (backstory.includes(entry.title)) {
          validation.loreConsistency.referencesExistingEvents.push(entry.title)
        }
      })
    }

    // Count relationships
    const relationships = suggestedNPC.relationships || []
    validation.loreConsistency.relationshipCount = relationships.length

    // Calculate lore consistency score
    let loreScore = 0

    // +50 points for each existing character referenced (max 100)
    loreScore += Math.min(100, validation.loreConsistency.referencesExistingCharacters.length * 50)

    // +25 points for each event referenced (max 50)
    loreScore += Math.min(50, validation.loreConsistency.referencesExistingEvents.length * 25)

    // +50 points if minimum relationships met
    if (validation.loreConsistency.relationshipCount >= validation.loreConsistency.minimumRelationships) {
      loreScore += 50
    }

    validation.loreConsistency.score = Math.min(100, loreScore / 2) // Average it out

    // Check for violations
    if (validation.loreConsistency.referencesExistingCharacters.length === 0) {
      validation.loreConsistency.violations.push('Backstory does not reference any existing characters')
    }

    if (validation.loreConsistency.relationshipCount < validation.loreConsistency.minimumRelationships) {
      validation.loreConsistency.violations.push(
        `Only ${validation.loreConsistency.relationshipCount} relationships defined, need at least ${validation.loreConsistency.minimumRelationships}`
      )
    }

    if (validation.loreConsistency.score < 40) {
      validation.loreConsistency.violations.push('Low lore consistency - NPC feels disconnected from world')
    }

    // Justification for new NPC
    if (validation.loreConsistency.score >= 60 && validation.loreConsistency.relationshipCount >= 2) {
      validation.justification = `New NPC is well-integrated: ${validation.loreConsistency.referencesExistingCharacters.length} character refs, ${validation.loreConsistency.relationshipCount} relationships, ${Math.round(validation.loreConsistency.score)}% lore consistency`
    } else {
      validation.justification = `New NPC needs improvement: ${validation.loreConsistency.violations.join(', ')}`
    }
  }

  // 3. Name conflicts
  const nameLower = (suggestedNPC.name || suggestedNPC.personality?.name || '').toLowerCase()
  const allNPCs = [...(context.existingNPCs || []), ...(context.generatedNPCs || [])]

  allNPCs.forEach(npc => {
    const existingNameLower = (npc.name || npc.personality?.name || '').toLowerCase()
    if (nameLower === existingNameLower) {
      validation.conflicts.push({
        type: 'name_collision',
        severity: 'blocker',
        existingId: npc.id,
        existingName: npc.name || npc.personality?.name,
        message: `Name "${suggestedNPC.name}" already exists`,
        autoResolution: 'rename'
      })
    }
  })

  return validation
}

/**
 * Generate forced relationships for new NPCs
 * Ensures every new NPC has at least 2 connections to existing characters
 */
export async function generateForcedRelationships(newNPC, existingNPCs, minRelationships = 2) {
  const relationships = newNPC.relationships || []

  if (relationships.length >= minRelationships) {
    return relationships // Already has enough
  }

  // Need to generate more relationships
  const needed = minRelationships - relationships.length
  const suggestions = []

  // Pick random existing NPCs to create relationships with using Fisher-Yates shuffle
  const shuffled = [...existingNPCs]
  // BUG FIX: Only shuffle enough elements as we need (partial Fisher-Yates)
  // This avoids unnecessary iterations and is more efficient when needed << array.length
  const shuffleCount = Math.min(needed, shuffled.length)
  for (let i = 0; i < shuffleCount; i++) {
    const j = i + Math.floor(Math.random() * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const selected = shuffled.slice(0, needed)

  selected.forEach((targetNPC, index) => {
    // Determine relationship type based on archetypes
    const relationshipType = determineRelationshipType(
      newNPC.type || newNPC.npcType,
      targetNPC.type || targetNPC.npcType
    )

    suggestions.push({
      npcId: targetNPC.id,
      npcName: targetNPC.name,
      type: relationshipType,
      strength: Math.floor(Math.random() * 60) + 20, // 20-80
      history: `Generated relationship with ${targetNPC.name} (needs elaboration)`,
      suggestedHistory: `[AI should elaborate] ${newNPC.name} and ${targetNPC.name} are ${relationshipType}s because...`
    })
  })

  return [...relationships, ...suggestions]
}

/**
 * Determine appropriate relationship type based on NPC archetypes
 */
function determineRelationshipType(archetype1, archetype2) {
  const competitiveTypes = ['merchant', 'banker', 'guard']
  const cooperativeTypes = ['quest_giver', 'hermit']

  // Merchants compete
  if (archetype1 === 'merchant' && archetype2 === 'merchant') {
    return 'rival'
  }

  // Guards are allies
  if (archetype1 === 'guard' && archetype2 === 'guard') {
    return 'ally'
  }

  // Quest givers mentor
  if (archetype1 === 'quest_giver' || archetype2 === 'quest_giver') {
    return 'mentor'
  }

  // Default to neutral
  return 'neutral'
}

/**
 * Check if NPC backstory references existing world lore
 */
export function checkLoreReferences(backstory, existingNPCs, loreEntries) {
  const references = {
    characters: [],
    events: [],
    locations: []
  }

  // Check for NPC name references
  existingNPCs.forEach(npc => {
    const npcName = npc.name || npc.personality?.name
    if (backstory.includes(npcName)) {
      references.characters.push(npcName)
    }
  })

  // Check for lore entry references
  if (loreEntries) {
    loreEntries.forEach(entry => {
      if (backstory.includes(entry.title)) {
        references.events.push(entry.title)
      }

      // Check for related entities
      entry.relatedEntities?.forEach(entity => {
        if (backstory.includes(entity.name)) {
          if (entity.type === 'npc') {
            references.characters.push(entity.name)
          } else {
            references.locations.push(entity.name)
          }
        }
      })
    })
  }

  return references
}
