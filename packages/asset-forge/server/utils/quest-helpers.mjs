/**
 * Quest Generation Helper Functions
 * Extracted to reduce cyclomatic complexity
 */

/**
 * Validate quest generation input parameters
 * @param {Object} body - Request body
 * @returns {{ valid: boolean, error?: Object }}
 */
export function validateQuestInput(body) {
  const { questType, prompt, context, customModel } = body

  if (!questType || typeof questType !== 'string' || questType.trim() === '') {
    return {
      valid: false,
      error: { error: "Invalid input: 'questType' must be a non-empty string" }
    }
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return {
      valid: false,
      error: { error: "Invalid input: 'prompt' must be a non-empty string" }
    }
  }

  if (prompt.length > 10000) {
    return {
      valid: false,
      error: { error: "Invalid input: 'prompt' must not exceed 10,000 characters" }
    }
  }

  if (context !== undefined && (typeof context !== 'string' || context.trim() === '')) {
    return {
      valid: false,
      error: { error: "Invalid input: 'context' must be a non-empty string if provided" }
    }
  }

  if (context && context.length > 10000) {
    return {
      valid: false,
      error: { error: "Invalid input: 'context' must not exceed 10,000 characters" }
    }
  }

  if (customModel !== undefined && typeof customModel !== 'string') {
    return {
      valid: false,
      error: { error: "Invalid input: 'model' must be a string if provided" }
    }
  }

  return { valid: true }
}

/**
 * Build quest metadata
 * @param {Object} questData - Generated quest data
 * @param {string} modelIdentifier - Model used for generation
 * @returns {Object} Complete quest with metadata
 */
export function buildQuestMetadata(questData, modelIdentifier) {
  return {
    ...questData,
    id: questData.id || `quest_${Date.now()}`,
    currentProgress: questData.currentProgress || 0,
    status: questData.status || 'not_started',
    metadata: {
      generatedBy: 'AI',
      model: modelIdentifier,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Process manifest gaps and generate suggestions
 * @param {Object} quest - Complete quest object
 * @param {Object} manifests - Available manifests
 * @param {string} difficulty - Quest difficulty
 * @param {Object} selectedModel - AI model for suggestions
 * @param {Function} detectQuestGaps - Gap detection function
 * @param {Function} generateManifestSuggestion - Suggestion generation function
 * @returns {Promise<{ gaps: Array, suggestions: Array }>}
 */
export async function processManifestGaps(
  quest,
  manifests,
  difficulty,
  selectedModel,
  detectQuestGaps,
  generateManifestSuggestion
) {
  if (!manifests) {
    return { gaps: [], suggestions: [] }
  }

  console.log('[Quest Generation] Detecting manifest gaps...')
  const gaps = detectQuestGaps(quest, manifests, difficulty)

  if (gaps.length === 0) {
    return { gaps: [], suggestions: [] }
  }

  console.log(`[Quest Generation] Found ${gaps.length} gaps, generating AI suggestions...`)

  // Generate suggestions for each gap
  // Use Promise.allSettled to prevent one failure from crashing entire suggestion generation
  const suggestionPromises = gaps.map(gap =>
    generateManifestSuggestion(gap, manifests, selectedModel)
  )

  const results = await Promise.allSettled(suggestionPromises)

  // Extract successful suggestions, log failures
  const suggestions = results
    .filter(result => {
      if (result.status === 'rejected') {
        console.error('[Quest Generation] Suggestion generation failed:', result.reason?.message || result.reason)
        return false
      }
      return result.value !== null
    })
    .map(result => result.value)

  console.log(`[Quest Generation] Generated ${suggestions.length} suggestions`)

  return { gaps, suggestions }
}
