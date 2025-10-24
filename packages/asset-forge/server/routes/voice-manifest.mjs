/**
 * Voice Manifest API Routes
 *
 * Endpoints for managing voice assignments to manifest entities (NPCs and Mobs).
 * These endpoints allow assigning ElevenLabs voices to game entities and managing
 * those assignments.
 *
 * Endpoints:
 * - POST /api/voice/manifest/assign - Assign voice to entity
 * - GET /api/voice/manifest/:manifestType/:entityId - Get voice assignment
 * - GET /api/voice/manifest/bulk - Get all assignments for manifest type
 * - DELETE /api/voice/manifest/:manifestType/:entityId - Delete assignment
 * - POST /api/voice/manifest/bulk-assign - Bulk assign multiple entities
 * - POST /api/voice/manifest/generate-sample - Generate sample dialogue
 */

import { ManifestVoiceService } from '../services/ManifestVoiceService.mjs'
import { VoiceGenerationService } from '../services/VoiceGenerationService.mjs'
import { createLogger } from '../utils/logger.mjs'
import fetch from 'node-fetch'

const manifestVoiceService = new ManifestVoiceService()

// Lazy initialization - only create the service when first needed
// This ensures environment variables are loaded before instantiation
let voiceService = null
function getVoiceService() {
  if (!voiceService) {
    voiceService = new VoiceGenerationService()
  }
  return voiceService
}

const logger = createLogger('VoiceManifestAPI')

/**
 * POST /api/voice/manifest/assign
 * Assign a voice to a manifest entity (NPC or Mob)
 *
 * Request Body:
 * {
 *   manifestType: 'npcs' | 'mobs',
 *   entityId: string,
 *   entityName: string,
 *   voiceId: string,
 *   voiceName: string,
 *   settings: VoiceSettings
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   assignment: ManifestVoiceProfile
 * }
 */
export async function POST_assign(req, res) {
  try {
    const { manifestType, entityId, entityName, voiceId, voiceName, settings } = req.body

    logger.info('POST /api/voice/manifest/assign', {
      manifestType,
      entityId,
      entityName,
      voiceId,
      voiceName
    })

    // Validate required fields
    if (!manifestType) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'manifestType is required',
        field: 'manifestType'
      })
    }

    if (!['npcs', 'mobs'].includes(manifestType)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'manifestType must be "npcs" or "mobs"',
        field: 'manifestType',
        received: manifestType
      })
    }

    if (!entityId || typeof entityId !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'entityId is required and must be a string',
        field: 'entityId',
        received: entityId
      })
    }

    if (!voiceId || typeof voiceId !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'voiceId is required and must be a string',
        field: 'voiceId',
        received: voiceId
      })
    }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'settings is required and must be an object',
        field: 'settings',
        received: typeof settings
      })
    }

    // Assign voice
    const assignment = await manifestVoiceService.assignVoice({
      manifestType,
      entityId,
      entityName: entityName || entityId,
      voiceId,
      voiceName: voiceName || 'Unknown',
      settings
    })

    logger.info('Voice assigned successfully', {
      manifestType,
      entityId,
      voiceId
    })

    return res.json({
      success: true,
      assignment
    })
  } catch (error) {
    logger.error('Failed to assign voice', error)
    return res.status(500).json({
      error: 'Failed to assign voice',
      details: error.message
    })
  }
}

/**
 * GET /api/voice/manifest/:manifestType/:entityId
 * Get voice assignment for a specific manifest entity
 *
 * Path Parameters:
 * - manifestType: 'npcs' | 'mobs'
 * - entityId: Entity ID from manifest
 *
 * Response:
 * ManifestVoiceProfile | null (404 if not found)
 */
export async function GET_assignment(req, res) {
  try {
    const { manifestType, entityId } = req.params

    logger.info('GET /api/voice/manifest/:manifestType/:entityId', {
      manifestType,
      entityId
    })

    // Validate manifest type
    if (!['npcs', 'mobs'].includes(manifestType)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'manifestType must be "npcs" or "mobs"',
        field: 'manifestType',
        received: manifestType
      })
    }

    if (!entityId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'entityId is required',
        field: 'entityId'
      })
    }

    // Get assignment
    const assignment = await manifestVoiceService.getVoiceAssignment(manifestType, entityId)

    if (!assignment) {
      logger.debug('No voice assignment found', { manifestType, entityId })
      return res.status(404).json(null)
    }

    logger.debug('Retrieved voice assignment', { manifestType, entityId })
    return res.json(assignment)
  } catch (error) {
    logger.error('Failed to fetch voice assignment', error)
    return res.status(500).json({
      error: 'Failed to fetch voice assignment',
      details: error.message
    })
  }
}

/**
 * GET /api/voice/manifest/bulk
 * Get all voice assignments for a manifest type
 *
 * Query Parameters:
 * - manifestType: 'npcs' | 'mobs' (required)
 * - limit: number (optional, default: 100)
 * - offset: number (optional, default: 0)
 *
 * Response:
 * {
 *   assignments: ManifestVoiceProfile[],
 *   total: number,
 *   limit: number,
 *   offset: number
 * }
 */
export async function GET_bulk(req, res) {
  try {
    const { manifestType, limit, offset } = req.query

    logger.info('GET /api/voice/manifest/bulk', {
      manifestType,
      limit,
      offset
    })

    // Validate manifest type
    if (!manifestType) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'manifestType query parameter is required',
        field: 'manifestType'
      })
    }

    if (!['npcs', 'mobs'].includes(manifestType)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'manifestType must be "npcs" or "mobs"',
        field: 'manifestType',
        received: manifestType
      })
    }

    // Parse pagination parameters
    const parsedLimit = limit ? parseInt(limit, 10) : 100
    const parsedOffset = offset ? parseInt(offset, 10) : 0

    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'limit must be a number between 1 and 1000',
        field: 'limit',
        received: limit
      })
    }

    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'offset must be a non-negative number',
        field: 'offset',
        received: offset
      })
    }

    // Get bulk assignments
    const result = await manifestVoiceService.getBulkVoiceAssignments(manifestType, {
      limit: parsedLimit,
      offset: parsedOffset
    })

    logger.info('Retrieved bulk voice assignments', {
      manifestType,
      total: result.total,
      returned: result.assignments.length
    })

    return res.json(result)
  } catch (error) {
    logger.error('Failed to fetch bulk assignments', error)
    return res.status(500).json({
      error: 'Failed to fetch bulk assignments',
      details: error.message
    })
  }
}

/**
 * DELETE /api/voice/manifest/:manifestType/:entityId
 * Delete voice assignment for a manifest entity
 *
 * Path Parameters:
 * - manifestType: 'npcs' | 'mobs'
 * - entityId: Entity ID from manifest
 *
 * Response:
 * {
 *   success: boolean,
 *   deleted: boolean
 * }
 */
export async function DELETE_assignment(req, res) {
  try {
    const { manifestType, entityId } = req.params

    logger.info('DELETE /api/voice/manifest/:manifestType/:entityId', {
      manifestType,
      entityId
    })

    // Validate manifest type
    if (!['npcs', 'mobs'].includes(manifestType)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'manifestType must be "npcs" or "mobs"',
        field: 'manifestType',
        received: manifestType
      })
    }

    if (!entityId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'entityId is required',
        field: 'entityId'
      })
    }

    // Delete assignment
    const result = await manifestVoiceService.deleteVoiceAssignment(manifestType, entityId)

    logger.info('Voice assignment deletion result', {
      manifestType,
      entityId,
      deleted: result.deleted
    })

    return res.json(result)
  } catch (error) {
    logger.error('Failed to delete voice assignment', error)
    return res.status(500).json({
      error: 'Failed to delete voice assignment',
      details: error.message
    })
  }
}

/**
 * POST /api/voice/manifest/bulk-assign
 * Bulk assign voices to multiple entities
 *
 * Request Body:
 * {
 *   assignments: Array<{
 *     manifestType: 'npcs' | 'mobs',
 *     entityId: string,
 *     entityName: string,
 *     voiceId: string,
 *     voiceName: string,
 *     settings: VoiceSettings
 *   }>
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   assigned: number,
 *   failed: number,
 *   errors: Array<{entityId: string, error: string}>
 * }
 */
export async function POST_bulkAssign(req, res) {
  try {
    const { assignments } = req.body

    logger.info('POST /api/voice/manifest/bulk-assign', {
      count: assignments?.length
    })

    // Validate assignments array
    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'assignments is required and must be an array',
        field: 'assignments',
        received: typeof assignments
      })
    }

    if (assignments.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'assignments array cannot be empty',
        field: 'assignments'
      })
    }

    if (assignments.length > 100) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Maximum 100 assignments per bulk operation',
        field: 'assignments',
        received: assignments.length,
        maximum: 100
      })
    }

    // Validate each assignment has required fields
    for (const [index, assignment] of assignments.entries()) {
      if (!assignment.manifestType) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Assignment at index ${index} is missing manifestType`,
          field: `assignments[${index}].manifestType`
        })
      }

      if (!assignment.entityId) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Assignment at index ${index} is missing entityId`,
          field: `assignments[${index}].entityId`
        })
      }

      if (!assignment.voiceId) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Assignment at index ${index} is missing voiceId`,
          field: `assignments[${index}].voiceId`
        })
      }

      if (!assignment.settings) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Assignment at index ${index} is missing settings`,
          field: `assignments[${index}].settings`
        })
      }
    }

    // Process bulk assignment
    const result = await manifestVoiceService.bulkAssignVoices(assignments)

    logger.info('Bulk voice assignment completed', {
      total: assignments.length,
      assigned: result.assigned,
      failed: result.failed
    })

    return res.json(result)
  } catch (error) {
    logger.error('Failed to process bulk assignment', error)
    return res.status(500).json({
      error: 'Failed to process bulk assignment',
      details: error.message
    })
  }
}

/**
 * POST /api/voice/manifest/generate-sample
 * Generate sample dialogue for a manifest entity based on type
 *
 * Request Body:
 * {
 *   manifestType: 'npcs' | 'mobs',
 *   entityId: string,
 *   entityType: string,  // e.g., "merchant", "quest_giver", "enemy"
 *   count?: number       // Number of sample lines (default: 3)
 * }
 *
 * Response:
 * {
 *   entityId: string,
 *   entityName: string,
 *   entityType: string,
 *   samples: Array<{
 *     id: string,
 *     text: string,
 *     context: string
 *   }>
 * }
 */
export async function POST_generateSample(req, res) {
  try {
    const { manifestType, entityId, entityType, count = 3 } = req.body

    logger.info('POST /api/voice/manifest/generate-sample', {
      manifestType,
      entityId,
      entityType,
      count
    })

    // Validate required fields
    if (!manifestType) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'manifestType is required',
        field: 'manifestType'
      })
    }

    if (!['npcs', 'mobs'].includes(manifestType)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'manifestType must be "npcs" or "mobs"',
        field: 'manifestType',
        received: manifestType
      })
    }

    if (!entityId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'entityId is required',
        field: 'entityId'
      })
    }

    if (!entityType) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'entityType is required (e.g., "merchant", "quest_giver", "enemy")',
        field: 'entityType'
      })
    }

    const parsedCount = parseInt(count, 10)
    if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 10) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'count must be a number between 1 and 10',
        field: 'count',
        received: count
      })
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'OPENAI_API_KEY not configured'
      })
    }

    // Load manifest to get entity name
    const manifest = await manifestVoiceService.loadManifest(manifestType)
    const entity = manifest[entityId]

    if (!entity) {
      return res.status(404).json({
        error: 'Entity not found',
        message: `Entity ${entityId} not found in ${manifestType} manifest`
      })
    }

    const entityName = entity.name || entityId

    // Generate sample dialogue using GPT-4
    const prompt = `Generate ${parsedCount} contextually appropriate dialogue lines for a ${entityType} named "${entityName}" in a fantasy RPG game.

Entity Type: ${entityType}
Entity Name: ${entityName}
Manifest Type: ${manifestType}

For each line, provide:
1. The dialogue text
2. The context/situation (e.g., "greeting", "quest_accept", "combat_taunt", "shop_welcome", etc.)

Return the response as a JSON array with this structure:
[
  {
    "text": "The actual dialogue line",
    "context": "The context/situation"
  }
]

Make the dialogue feel natural and appropriate for the character type. Consider their personality and role in the game.`

    logger.debug('Generating sample dialogue with GPT-4', {
      entityId,
      entityName,
      entityType,
      count: parsedCount
    })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a creative game dialogue writer. Generate natural, immersive dialogue for RPG characters.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    let samplesData

    try {
      samplesData = JSON.parse(data.choices[0].message.content)
    } catch (parseError) {
      logger.error('Failed to parse GPT response', parseError)
      throw new Error('Failed to parse dialogue samples from GPT-4')
    }

    // Extract samples array (handle different response formats)
    let samplesArray = samplesData.samples || samplesData.dialogues || samplesData
    if (!Array.isArray(samplesArray)) {
      samplesArray = [samplesData]
    }

    // Format samples with IDs
    const samples = samplesArray.slice(0, parsedCount).map((sample, index) => ({
      id: `sample_${Date.now()}_${index}`,
      text: sample.text || sample.dialogue || '',
      context: sample.context || sample.situation || 'general'
    }))

    logger.info('Generated sample dialogue', {
      entityId,
      entityName,
      entityType,
      samplesGenerated: samples.length
    })

    return res.json({
      entityId,
      entityName,
      entityType,
      samples
    })
  } catch (error) {
    logger.error('Failed to generate sample dialogue', error)
    return res.status(500).json({
      error: 'Failed to generate sample dialogue',
      details: error.message
    })
  }
}
