/**
 * Input Validation Utilities
 *
 * Prevents path traversal attacks and validates user inputs
 * Used by: GenerationService, VoiceGenerationService, AssetService, RetextureService
 */

import { createLogger } from './logger.mjs'

const logger = createLogger('validators')

/**
 * Validate asset ID to prevent path traversal attacks
 * @param {string} assetId - The asset ID to validate
 * @returns {string} The validated asset ID
 * @throws {Error} If the asset ID is invalid
 */
export function validateAssetId(assetId) {
  if (!assetId || typeof assetId !== 'string') {
    throw new Error('Invalid asset ID: must be a string')
  }

  // Only allow alphanumeric characters, hyphens, and underscores
  // This prevents directory traversal and special characters
  if (!/^[a-zA-Z0-9_-]+$/.test(assetId)) {
    logger.warn('Invalid asset ID format detected', { assetId })
    throw new Error(`Invalid asset ID format: ${assetId}. Only alphanumeric, hyphens, and underscores allowed.`)
  }

  // Prevent traversal attempts (defense in depth)
  if (assetId.includes('..') || assetId.includes('/') || assetId.includes('\\')) {
    logger.warn('Path traversal attempt detected in asset ID', { assetId })
    throw new Error('Invalid asset ID: path traversal detected')
  }

  // Reasonable length limit to prevent abuse
  if (assetId.length > 100) {
    logger.warn('Asset ID too long', { assetId, length: assetId.length })
    throw new Error('Invalid asset ID: too long (max 100 characters)')
  }

  // Don't allow IDs that start with dots (hidden files)
  if (assetId.startsWith('.')) {
    logger.warn('Asset ID starts with dot', { assetId })
    throw new Error('Invalid asset ID: cannot start with a dot')
  }

  return assetId
}

/**
 * Validate NPC ID to prevent path traversal attacks
 * @param {string} npcId - The NPC ID to validate
 * @returns {string} The validated NPC ID
 * @throws {Error} If the NPC ID is invalid
 */
export function validateNpcId(npcId) {
  if (!npcId || typeof npcId !== 'string') {
    throw new Error('Invalid NPC ID: must be a string')
  }

  // Same validation as asset ID
  if (!/^[a-zA-Z0-9_-]+$/.test(npcId)) {
    logger.warn('Invalid NPC ID format detected', { npcId })
    throw new Error(`Invalid NPC ID format: ${npcId}. Only alphanumeric, hyphens, and underscores allowed.`)
  }

  if (npcId.includes('..') || npcId.includes('/') || npcId.includes('\\')) {
    logger.warn('Path traversal attempt detected in NPC ID', { npcId })
    throw new Error('Invalid NPC ID: path traversal detected')
  }

  if (npcId.length > 100) {
    logger.warn('NPC ID too long', { npcId, length: npcId.length })
    throw new Error('Invalid NPC ID: too long (max 100 characters)')
  }

  if (npcId.startsWith('.')) {
    logger.warn('NPC ID starts with dot', { npcId })
    throw new Error('Invalid NPC ID: cannot start with a dot')
  }

  return npcId
}

/**
 * Validate filename to prevent path traversal attacks
 * @param {string} filename - The filename to validate
 * @returns {string} The validated filename
 * @throws {Error} If the filename is invalid
 */
export function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename: must be a string')
  }

  // Allow safe characters for filenames (including dots for extensions)
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    logger.warn('Invalid filename format detected', { filename })
    throw new Error('Invalid filename format: only alphanumeric, dots, hyphens, and underscores allowed')
  }

  // Prevent traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    logger.warn('Path traversal attempt detected in filename', { filename })
    throw new Error('Path traversal detected in filename')
  }

  // Reasonable length limit
  if (filename.length > 255) {
    logger.warn('Filename too long', { filename, length: filename.length })
    throw new Error('Filename too long (max 255 characters)')
  }

  // Don't allow filenames that start with dots (hidden files)
  if (filename.startsWith('.')) {
    logger.warn('Filename starts with dot', { filename })
    throw new Error('Invalid filename: cannot start with a dot')
  }

  return filename
}

/**
 * Validate directory name to prevent path traversal attacks
 * @param {string} dirName - The directory name to validate
 * @returns {string} The validated directory name
 * @throws {Error} If the directory name is invalid
 */
export function validateDirectoryName(dirName) {
  if (!dirName || typeof dirName !== 'string') {
    throw new Error('Invalid directory name: must be a string')
  }

  // Same validation as asset ID
  if (!/^[a-zA-Z0-9_-]+$/.test(dirName)) {
    logger.warn('Invalid directory name format detected', { dirName })
    throw new Error('Invalid directory name format: only alphanumeric, hyphens, and underscores allowed')
  }

  if (dirName.includes('..') || dirName.includes('/') || dirName.includes('\\')) {
    logger.warn('Path traversal attempt detected in directory name', { dirName })
    throw new Error('Path traversal detected in directory name')
  }

  if (dirName.length > 100) {
    logger.warn('Directory name too long', { dirName, length: dirName.length })
    throw new Error('Directory name too long (max 100 characters)')
  }

  if (dirName.startsWith('.')) {
    logger.warn('Directory name starts with dot', { dirName })
    throw new Error('Invalid directory name: cannot start with a dot')
  }

  return dirName
}

/**
 * Validate pipeline ID to prevent attacks
 * @param {string} pipelineId - The pipeline ID to validate
 * @returns {string} The validated pipeline ID
 * @throws {Error} If the pipeline ID is invalid
 */
export function validatePipelineId(pipelineId) {
  if (!pipelineId || typeof pipelineId !== 'string') {
    throw new Error('Invalid pipeline ID: must be a string')
  }

  // Pipeline IDs should match the format: pipeline-{timestamp}-{random}
  if (!/^pipeline-\d+-[a-z0-9]+$/.test(pipelineId)) {
    logger.warn('Invalid pipeline ID format detected', { pipelineId })
    throw new Error('Invalid pipeline ID format')
  }

  return pipelineId
}

/**
 * Validate task ID (for Meshy tasks, etc.)
 * @param {string} taskId - The task ID to validate
 * @returns {string} The validated task ID
 * @throws {Error} If the task ID is invalid
 */
export function validateTaskId(taskId) {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Invalid task ID: must be a string')
  }

  // Task IDs from external services may have different formats
  // Allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(taskId)) {
    logger.warn('Invalid task ID format detected', { taskId })
    throw new Error('Invalid task ID format')
  }

  if (taskId.length > 200) {
    logger.warn('Task ID too long', { taskId, length: taskId.length })
    throw new Error('Task ID too long (max 200 characters)')
  }

  return taskId
}
