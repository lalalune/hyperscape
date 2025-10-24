/**
 * Voice Generation Validation Helpers
 * Extracted validation logic to reduce cyclomatic complexity
 */

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {number} statusCode - HTTP status code if invalid
 * @property {Object} error - Error object if invalid
 */

/**
 * Validate text input for speech generation
 * @param {string} text - Text to validate
 * @returns {ValidationResult}
 */
export function validateTextInput(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: '"text" is required and must be a non-empty string',
        field: 'text',
        received: typeof text
      }
    }
  }

  if (text.length > 5000) {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: 'Text is too long. Maximum is 5000 characters.',
        field: 'text',
        received: text.length,
        maximum: 5000
      }
    }
  }

  return { valid: true }
}

/**
 * Validate voice ID parameter
 * @param {string} voiceId - Voice ID to validate
 * @returns {ValidationResult}
 */
export function validateVoiceId(voiceId) {
  if (!voiceId || typeof voiceId !== 'string') {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: '"voiceId" is required and must be a non-empty string',
        field: 'voiceId',
        received: voiceId
      }
    }
  }

  return { valid: true }
}

/**
 * Validate numeric parameter within range
 * @param {number} value - Value to validate
 * @param {string} fieldName - Name of the field
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {ValidationResult}
 */
export function validateNumericRange(value, fieldName, min, max) {
  if (value !== undefined && (typeof value !== 'number' || value < min || value > max)) {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: `"${fieldName}" must be a number between ${min} and ${max}`,
        field: fieldName,
        received: value,
        range: `${min}-${max}`
      }
    }
  }

  return { valid: true }
}

/**
 * Validate NPC ID parameter
 * @param {string} npcId - NPC ID to validate
 * @returns {ValidationResult}
 */
export function validateNpcIdParam(npcId) {
  if (!npcId || typeof npcId !== 'string') {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: '"npcId" is required and must be a non-empty string',
        field: 'npcId',
        received: npcId
      }
    }
  }

  return { valid: true }
}

/**
 * Validate dialogue nodes array
 * @param {Array} dialogueNodes - Array of dialogue nodes
 * @returns {ValidationResult}
 */
export function validateDialogueNodesArray(dialogueNodes) {
  if (!Array.isArray(dialogueNodes)) {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: '"dialogueNodes" must be an array',
        field: 'dialogueNodes',
        received: typeof dialogueNodes
      }
    }
  }

  if (dialogueNodes.length === 0) {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: '"dialogueNodes" array cannot be empty',
        field: 'dialogueNodes',
        received: 'empty array'
      }
    }
  }

  if (dialogueNodes.length > 100) {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: 'Too many dialogue nodes. Maximum is 100 per batch.',
        field: 'dialogueNodes',
        received: dialogueNodes.length,
        maximum: 100
      }
    }
  }

  return { valid: true }
}

/**
 * Validate individual dialogue node structure
 * @param {Object} node - Dialogue node to validate
 * @param {number} index - Index of node in array
 * @returns {ValidationResult}
 */
export function validateDialogueNode(node, index) {
  if (!node.id || typeof node.id !== 'string') {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: `Dialogue node at index ${index} is missing "id" property or id is not a string`,
        field: `dialogueNodes[${index}].id`,
        received: node.id
      }
    }
  }

  if (!node.text || typeof node.text !== 'string' || node.text.trim() === '') {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: `Dialogue node at index ${index} (id: ${node.id}) is missing "text" property or text is empty`,
        field: `dialogueNodes[${index}].text`,
        received: node.text
      }
    }
  }

  if (node.text.length > 5000) {
    return {
      valid: false,
      statusCode: 400,
      error: {
        error: 'Validation Error',
        message: `Dialogue node at index ${index} (id: ${node.id}) has text that is too long. Maximum is 5000 characters.`,
        field: `dialogueNodes[${index}].text`,
        received: node.text.length,
        maximum: 5000
      }
    }
  }

  return { valid: true }
}

/**
 * Validate all dialogue nodes in batch
 * @param {Array} dialogueNodes - Array of dialogue nodes
 * @returns {ValidationResult}
 */
export function validateAllDialogueNodes(dialogueNodes) {
  for (const [index, node] of dialogueNodes.entries()) {
    const result = validateDialogueNode(node, index)
    if (!result.valid) {
      return result
    }
  }

  return { valid: true }
}

/**
 * Validate speech generation settings
 * @param {Object} settings - Settings object
 * @returns {ValidationResult}
 */
export function validateSpeechSettings(settings) {
  const { stability, similarityBoost, style } = settings

  const stabilityResult = validateNumericRange(stability, 'stability', 0, 1)
  if (!stabilityResult.valid) return stabilityResult

  const similarityResult = validateNumericRange(similarityBoost, 'similarityBoost', 0, 1)
  if (!similarityResult.valid) return similarityResult

  const styleResult = validateNumericRange(style, 'style', 0, 1)
  if (!styleResult.valid) return styleResult

  return { valid: true }
}
