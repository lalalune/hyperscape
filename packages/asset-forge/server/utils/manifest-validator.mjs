/**
 * Manifest Validator
 *
 * Detects conflicts between suggested manifests and existing ones
 * Provides auto-resolution recommendations
 */

/**
 * Calculate Levenshtein distance for string similarity
 */
function levenshteinDistance(str1, str2) {
  const matrix = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; i <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

/**
 * Calculate string similarity (0-1)
 */
function stringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1.0

  const distance = levenshteinDistance(longer, shorter)
  return (longer.length - distance) / longer.length
}

/**
 * Detect conflicts for item manifest
 */
export function detectItemConflicts(suggestedItem, existingItems) {
  const conflicts = []

  existingItems.forEach(existing => {
    // ID collision (blocker)
    if (existing.id === suggestedItem.id) {
      conflicts.push({
        type: 'id_collision',
        severity: 'blocker',
        existingId: existing.id,
        existingName: existing.name,
        message: `ID "${suggestedItem.id}" already exists as "${existing.name}"`,
        autoResolution: 'rename'
      })
    }

    // Name similarity (high)
    const similarity = stringSimilarity(
      suggestedItem.name.toLowerCase(),
      existing.name.toLowerCase()
    )

    if (similarity > 0.8) {
      conflicts.push({
        type: 'name_similar',
        severity: similarity > 0.95 ? 'high' : 'medium',
        existingId: existing.id,
        existingName: existing.name,
        message: `Name "${suggestedItem.name}" is ${Math.round(similarity * 100)}% similar to existing "${existing.name}"`,
        similarity,
        autoResolution: similarity > 0.95 ? 'use_existing' : undefined
      })
    }

    // Stats duplicate (medium) - for weapons/armor
    if (suggestedItem.type === existing.type &&
        suggestedItem.equipSlot === existing.equipSlot) {
      const statsSimilar =
        suggestedItem.stats.attack === existing.stats.attack &&
        suggestedItem.stats.defense === existing.stats.defense &&
        suggestedItem.stats.strength === existing.stats.strength

      if (statsSimilar) {
        conflicts.push({
          type: 'stats_duplicate',
          severity: 'medium',
          existingId: existing.id,
          existingName: existing.name,
          message: `Stats identical to existing "${existing.name}"`,
          autoResolution: 'use_existing'
        })
      }
    }

    // Tier mismatch (low) - suggested item doesn't fit tier
    const suggestedLevel = suggestedItem.requirements?.level || suggestedItem.level || 1
    const existingLevel = existing.requirements?.level || existing.level || 1

    if (Math.abs(suggestedLevel - existingLevel) < 3 &&
        suggestedItem.type === existing.type &&
        suggestedItem.value &&
        existing.value &&
        Math.abs(suggestedItem.value - existing.value) < existing.value * 0.2) {
      conflicts.push({
        type: 'already_exists',
        severity: 'low',
        existingId: existing.id,
        existingName: existing.name,
        message: `Very similar ${existing.type} already exists: "${existing.name}"`,
        autoResolution: 'use_existing'
      })
    }
  })

  return conflicts
}

/**
 * Detect conflicts for mob manifest
 */
export function detectMobConflicts(suggestedMob, existingMobs) {
  const conflicts = []

  existingMobs.forEach(existing => {
    // ID collision
    if (existing.id === suggestedMob.id) {
      conflicts.push({
        type: 'id_collision',
        severity: 'blocker',
        existingId: existing.id,
        existingName: existing.name,
        message: `ID "${suggestedMob.id}" already exists as "${existing.name}"`,
        autoResolution: 'rename'
      })
    }

    // Name similarity
    const similarity = stringSimilarity(
      suggestedMob.name.toLowerCase(),
      existing.name.toLowerCase()
    )

    if (similarity > 0.8) {
      conflicts.push({
        type: 'name_similar',
        severity: similarity > 0.95 ? 'high' : 'medium',
        existingId: existing.id,
        existingName: existing.name,
        message: `Name "${suggestedMob.name}" is ${Math.round(similarity * 100)}% similar to existing "${existing.name}"`,
        similarity,
        autoResolution: similarity > 0.95 ? 'use_existing' : undefined
      })
    }

    // Combat level duplicate
    const suggestedLevel = suggestedMob.stats?.level || suggestedMob.level || suggestedMob.combatLevel || 1
    const existingLevel = existing.stats?.level || existing.level || existing.combatLevel || 1

    if (suggestedLevel === existingLevel && suggestedMob.type === existing.type) {
      conflicts.push({
        type: 'stats_duplicate',
        severity: 'low',
        existingId: existing.id,
        existingName: existing.name,
        message: `Similar level ${existing.type} already exists: "${existing.name}" (level ${existingLevel})`,
        autoResolution: 'use_existing'
      })
    }
  })

  return conflicts
}

/**
 * Detect conflicts for NPC manifest
 */
export function detectNPCConflicts(suggestedNPC, existingNPCs) {
  const conflicts = []

  existingNPCs.forEach(existing => {
    // ID collision
    if (existing.id === suggestedNPC.id) {
      conflicts.push({
        type: 'id_collision',
        severity: 'blocker',
        existingId: existing.id,
        existingName: existing.name,
        message: `ID "${suggestedNPC.id}" already exists as "${existing.name}"`,
        autoResolution: 'rename'
      })
    }

    // Name similarity
    const similarity = stringSimilarity(
      suggestedNPC.name.toLowerCase(),
      existing.name.toLowerCase()
    )

    if (similarity > 0.8) {
      conflicts.push({
        type: 'name_similar',
        severity: similarity > 0.95 ? 'blocker' : 'high',
        existingId: existing.id,
        existingName: existing.name,
        message: `Name "${suggestedNPC.name}" is ${Math.round(similarity * 100)}% similar to existing "${existing.name}"`,
        similarity,
        autoResolution: similarity > 0.95 ? 'use_existing' : undefined
      })
    }

    // Same archetype and services (suggests reuse)
    const suggestedType = suggestedNPC.type || suggestedNPC.npcType
    const existingType = existing.type || existing.npcType

    if (suggestedType === existingType) {
      const sharedServices = (suggestedNPC.services || []).filter(s =>
        (existing.services || []).includes(s)
      )

      if (sharedServices.length > 0) {
        conflicts.push({
          type: 'already_exists',
          severity: 'medium',
          existingId: existing.id,
          existingName: existing.name,
          message: `Existing ${existingType} "${existing.name}" already provides: ${sharedServices.join(', ')}`,
          autoResolution: 'use_existing'
        })
      }
    }
  })

  return conflicts
}

/**
 * Detect conflicts for resource manifest
 */
export function detectResourceConflicts(suggestedResource, existingResources) {
  const conflicts = []

  existingResources.forEach(existing => {
    // ID collision
    if (existing.id === suggestedResource.id) {
      conflicts.push({
        type: 'id_collision',
        severity: 'blocker',
        existingId: existing.id,
        existingName: existing.name,
        message: `ID "${suggestedResource.id}" already exists as "${existing.name}"`,
        autoResolution: 'rename'
      })
    }

    // Name similarity
    const similarity = stringSimilarity(
      suggestedResource.name.toLowerCase(),
      existing.name.toLowerCase()
    )

    if (similarity > 0.8) {
      conflicts.push({
        type: 'name_similar',
        severity: similarity > 0.95 ? 'high' : 'medium',
        existingId: existing.id,
        existingName: existing.name,
        message: `Name "${suggestedResource.name}" is ${Math.round(similarity * 100)}% similar to existing "${existing.name}"`,
        similarity,
        autoResolution: similarity > 0.95 ? 'use_existing' : undefined
      })
    }

    // Same type and level
    if (suggestedResource.type === existing.type &&
        suggestedResource.level === existing.level) {
      conflicts.push({
        type: 'already_exists',
        severity: 'low',
        existingId: existing.id,
        existingName: existing.name,
        message: `Similar ${existing.type} resource already exists: "${existing.name}"`,
        autoResolution: 'use_existing'
      })
    }
  })

  return conflicts
}

/**
 * Main conflict detection dispatcher
 */
export function detectConflicts(suggestedManifest, existingManifests, manifestType) {
  switch (manifestType) {
    case 'items':
      return detectItemConflicts(suggestedManifest, existingManifests)
    case 'mobs':
      return detectMobConflicts(suggestedManifest, existingManifests)
    case 'npcs':
      return detectNPCConflicts(suggestedManifest, existingManifests)
    case 'resources':
      return detectResourceConflicts(suggestedManifest, existingManifests)
    default:
      return []
  }
}

/**
 * Calculate validation score based on conflicts
 */
export function calculateValidationScore(conflicts) {
  if (conflicts.length === 0) return 100

  let score = 100

  conflicts.forEach(conflict => {
    switch (conflict.severity) {
      case 'blocker':
        score -= 50
        break
      case 'high':
        score -= 20
        break
      case 'medium':
        score -= 10
        break
      case 'low':
        score -= 5
        break
    }
  })

  return Math.max(0, score)
}

/**
 * Auto-resolve conflicts where possible
 */
export function autoResolveConflicts(conflicts) {
  const resolutions = []

  conflicts.forEach(conflict => {
    if (conflict.autoResolution) {
      resolutions.push({
        conflictType: conflict.type,
        resolution: conflict.autoResolution,
        existingId: conflict.existingId,
        message: `Auto-resolved: ${conflict.autoResolution} - ${conflict.message}`
      })
    }
  })

  return resolutions
}
