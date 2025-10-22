/**
 * Manifest Voice Service
 *
 * Handles voice assignments for manifest entities (NPCs and Mobs).
 * Uses file-based storage with JSON metadata files.
 *
 * Features:
 * - Assign voices to manifest entities
 * - Retrieve voice assignments
 * - Bulk operations for multiple entities
 * - Sample clip generation and storage
 *
 * Used by: voice-manifest.mjs API routes
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createLogger } from '../utils/logger.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logger = createLogger('ManifestVoiceService')

export class ManifestVoiceService {
  constructor() {
    // Path to root directory for manifest voice profiles
    this.rootDir = path.join(__dirname, '../..')
    this.voiceProfilesDir = path.join(this.rootDir, 'voice-profiles')
    this.manifestsDir = path.join(this.rootDir, '..', 'server', 'world', 'assets', 'manifests')

    // Ensure voice-profiles directory exists
    this.ensureVoiceProfilesDir()
  }

  /**
   * Ensure voice-profiles directory exists
   */
  async ensureVoiceProfilesDir() {
    try {
      await fs.mkdir(this.voiceProfilesDir, { recursive: true })
      logger.debug('Voice profiles directory ready', { path: this.voiceProfilesDir })
    } catch (error) {
      logger.error('Failed to create voice profiles directory', error)
    }
  }

  /**
   * Get path to manifest voice profile file
   * @param {string} manifestType - 'npcs' or 'mobs'
   * @param {string} entityId - Entity ID from manifest
   * @returns {string} Path to profile file
   */
  getProfilePath(manifestType, entityId) {
    this.validateEntityId(entityId);
    // Compose filename in a safe way (manifestType is already validated elsewhere)
    const filename = `${manifestType}_${entityId}.json`;
    const rawPath = path.join(this.voiceProfilesDir, filename);
    // Normalize and check for path traversal
    const profilesDirResolved = path.resolve(this.voiceProfilesDir);
    const profilePathResolved = path.resolve(rawPath);
    if (!profilePathResolved.startsWith(profilesDirResolved + path.sep)) {
      throw new Error('Invalid entityId: path traversal detected');
    }
    return profilePathResolved;
  }

  /**
   * Validate manifest type
   * @param {string} manifestType - Manifest type to validate
   * @throws {Error} If invalid manifest type
   */
  validateManifestType(manifestType) {
    const validTypes = ['npcs', 'mobs']
    if (!validTypes.includes(manifestType)) {
      throw new Error(`Invalid manifest type: ${manifestType}. Must be one of: ${validTypes.join(', ')}`)
    }
  }

  /**
   * Load manifest to validate entity exists
   * @param {string} manifestType - 'npcs' or 'mobs'
   * @returns {Promise<Object>} Manifest data
   */
  async loadManifest(manifestType) {
    try {
      const manifestPath = path.join(this.manifestsDir, `${manifestType}.json`)
      const data = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(data)
      logger.debug('Loaded manifest', { manifestType, entityCount: Object.keys(manifest).length })
      return manifest
    } catch (error) {
      logger.error('Failed to load manifest', error, { manifestType })
      throw new Error(`Failed to load manifest: ${manifestType}`)
    }
  }

  /**
   * Validate entity exists in manifest
   * @param {string} manifestType - 'npcs' or 'mobs'
   * @param {string} entityId - Entity ID to validate
   * @returns {Promise<boolean>} True if entity exists
   */
  async validateEntityExists(manifestType, entityId) {
    const manifest = await this.loadManifest(manifestType)
    const exists = !!manifest[entityId]

    if (!exists) {
      logger.warn('Entity not found in manifest', { manifestType, entityId })
    }

    return exists
  }

  /**
   * Assign voice to manifest entity
   * @param {Object} params - Assignment parameters
   * @param {string} params.manifestType - 'npcs' or 'mobs'
   * @param {string} params.entityId - Entity ID from manifest
   * @param {string} params.entityName - Entity name
   * @param {string} params.voiceId - ElevenLabs voice ID
   * @param {string} params.voiceName - Voice name
   * @param {Object} params.settings - Voice settings
   * @param {Array} [params.sampleClips] - Optional sample clips
   * @returns {Promise<Object>} Created/updated voice profile
   */
  async assignVoice({
    manifestType,
    entityId,
    entityName,
    voiceId,
    voiceName,
    settings,
    sampleClips = []
  }) {
    // Validate inputs
    this.validateManifestType(manifestType)

    if (!entityId || typeof entityId !== 'string') {
      throw new Error('entityId is required and must be a string')
    }

    if (!voiceId || typeof voiceId !== 'string') {
      throw new Error('voiceId is required and must be a string')
    }

    if (!settings || typeof settings !== 'object') {
      throw new Error('settings is required and must be an object')
    }

    // Validate entity exists in manifest (optional - can be disabled for testing)
    const entityExists = await this.validateEntityExists(manifestType, entityId)
    if (!entityExists) {
      logger.warn('Assigning voice to entity not found in manifest', { manifestType, entityId })
    }

    const profilePath = this.getProfilePath(manifestType, entityId)
    const now = new Date().toISOString()

    // Check if profile already exists
    let existingProfile = null
    try {
      const data = await fs.readFile(profilePath, 'utf-8')
      existingProfile = JSON.parse(data)
      logger.debug('Found existing voice profile', { manifestType, entityId })
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to read existing profile', error)
      }
    }

    // Create or update profile
    const profile = {
      id: existingProfile?.id || `${manifestType}_${entityId}`,
      manifestType,
      entityId,
      entityName: entityName || existingProfile?.entityName || entityId,
      voiceId,
      voiceName: voiceName || existingProfile?.voiceName || 'Unknown',
      settings,
      sampleClips: sampleClips.length > 0 ? sampleClips : (existingProfile?.sampleClips || []),
      assignedAt: existingProfile?.assignedAt || now,
      updatedAt: now
    }

    // Save profile
    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2))

    logger.info('Voice assigned to manifest entity', {
      manifestType,
      entityId,
      entityName: profile.entityName,
      voiceId,
      voiceName: profile.voiceName,
      isUpdate: !!existingProfile
    })

    return profile
  }

  /**
   * Get voice assignment for entity
   * @param {string} manifestType - 'npcs' or 'mobs'
   * @param {string} entityId - Entity ID
   * @returns {Promise<Object|null>} Voice profile or null if not found
   */
  async getVoiceAssignment(manifestType, entityId) {
    this.validateManifestType(manifestType)

    const profilePath = this.getProfilePath(manifestType, entityId)

    try {
      const data = await fs.readFile(profilePath, 'utf-8')
      const profile = JSON.parse(data)

      logger.debug('Retrieved voice assignment', { manifestType, entityId })
      return profile
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug('No voice assignment found', { manifestType, entityId })
        return null
      }

      logger.error('Failed to read voice assignment', error, { manifestType, entityId })
      throw error
    }
  }

  /**
   * Get all voice assignments for a manifest type
   * @param {string} manifestType - 'npcs' or 'mobs'
   * @param {Object} options - Pagination options
   * @param {number} [options.limit=100] - Maximum results
   * @param {number} [options.offset=0] - Results offset
   * @returns {Promise<Object>} Paginated results
   */
  async getBulkVoiceAssignments(manifestType, { limit = 100, offset = 0 } = {}) {
    this.validateManifestType(manifestType)

    await this.ensureVoiceProfilesDir()

    try {
      // Get all profile files for this manifest type
      const files = await fs.readdir(this.voiceProfilesDir)
      const profileFiles = files.filter(f =>
        f.startsWith(`${manifestType}_`) && f.endsWith('.json')
      )

      logger.debug('Found voice profile files', {
        manifestType,
        totalFiles: profileFiles.length
      })

      // Load all profiles
      const allProfiles = []
      for (const file of profileFiles) {
        try {
          const filePath = path.join(this.voiceProfilesDir, file)
          const data = await fs.readFile(filePath, 'utf-8')
          const profile = JSON.parse(data)
          allProfiles.push(profile)
        } catch (error) {
          logger.warn('Failed to load profile file', { file, error: error.message })
        }
      }

      // Sort by updatedAt (newest first)
      allProfiles.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )

      // Apply pagination
      const total = allProfiles.length
      const paginatedProfiles = allProfiles.slice(offset, offset + limit)

      logger.info('Retrieved bulk voice assignments', {
        manifestType,
        total,
        returned: paginatedProfiles.length,
        limit,
        offset
      })

      return {
        assignments: paginatedProfiles,
        total,
        limit,
        offset
      }
    } catch (error) {
      logger.error('Failed to retrieve bulk assignments', error, { manifestType })
      throw error
    }
  }

  /**
   * Delete voice assignment for entity
   * @param {string} manifestType - 'npcs' or 'mobs'
   * @param {string} entityId - Entity ID
   * @returns {Promise<Object>} Result object
   */
  async deleteVoiceAssignment(manifestType, entityId) {
    this.validateManifestType(manifestType)

    const profilePath = this.getProfilePath(manifestType, entityId)

    try {
      await fs.unlink(profilePath)

      logger.info('Deleted voice assignment', { manifestType, entityId })

      return {
        success: true,
        deleted: true
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug('No voice assignment to delete', { manifestType, entityId })
        return {
          success: true,
          deleted: false
        }
      }

      logger.error('Failed to delete voice assignment', error, { manifestType, entityId })
      throw error
    }
  }

  /**
   * Bulk assign voices to multiple entities
   * @param {Array} assignments - Array of assignment objects
   * @returns {Promise<Object>} Result summary
   */
  async bulkAssignVoices(assignments) {
    if (!Array.isArray(assignments)) {
      throw new Error('assignments must be an array')
    }

    if (assignments.length === 0) {
      throw new Error('assignments array cannot be empty')
    }

    logger.info('Starting bulk voice assignment', { count: assignments.length })

    const results = {
      success: true,
      assigned: 0,
      failed: 0,
      errors: []
    }

    // Process each assignment
    for (const assignment of assignments) {
      try {
        await this.assignVoice(assignment)
        results.assigned++
      } catch (error) {
        results.failed++
        results.errors.push({
          entityId: assignment.entityId,
          error: error.message
        })

        logger.error('Failed to assign voice in bulk operation', error, {
          entityId: assignment.entityId,
          manifestType: assignment.manifestType
        })
      }
    }

    logger.info('Bulk voice assignment completed', {
      total: assignments.length,
      assigned: results.assigned,
      failed: results.failed
    })

    return results
  }

  /**
   * Add sample clips to voice profile
   * @param {string} manifestType - 'npcs' or 'mobs'
   * @param {string} entityId - Entity ID
   * @param {Array} sampleClips - Array of voice clip objects
   * @returns {Promise<Object>} Updated profile
   */
  async addSampleClips(manifestType, entityId, sampleClips) {
    this.validateManifestType(manifestType)

    if (!Array.isArray(sampleClips)) {
      throw new Error('sampleClips must be an array')
    }

    // Get existing profile
    const profile = await this.getVoiceAssignment(manifestType, entityId)

    if (!profile) {
      throw new Error(`No voice assignment found for ${manifestType}/${entityId}`)
    }

    // Add new sample clips
    profile.sampleClips = [...(profile.sampleClips || []), ...sampleClips]
    profile.updatedAt = new Date().toISOString()

    // Save updated profile
    const profilePath = this.getProfilePath(manifestType, entityId)
    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2))

    logger.info('Added sample clips to voice profile', {
      manifestType,
      entityId,
      newClips: sampleClips.length,
      totalClips: profile.sampleClips.length
    })

    return profile
  }
  /**
   * Validates the entityId to only allow safe, filename-compatible characters.
   * Throws an error if validation fails.
   * @param {string} entityId
   */
  validateEntityId(entityId) {
    // Accept alphanumerics, underscores and dashes
    if (typeof entityId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(entityId)) {
      throw new Error('Invalid entityId: must be alphanumeric, dash or underscore only');
    }
  }
}
