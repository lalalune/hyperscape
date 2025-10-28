/**
 * Voice Generation API Routes
 * ElevenLabs text-to-speech integration for NPC dialogue
 */

import { Hono } from 'hono'
import { VoiceGenerationService } from '../services/VoiceGenerationService.mjs'
import { requireAuth } from '../middleware/auth-hono.mjs'
import { resolveElevenLabsKey } from '../middleware/api-key-resolver-hono.mjs'
import { query } from '../database/db.mjs'

const router = new Hono()

/**
 * GET /api/voice/library
 * Get available voices from ElevenLabs library
 */
router.get('/library', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    console.log('[Voice] GET /api/voice/library')

    // Use resolved API key from middleware
    const resolvedApiKeys = c.get('resolvedApiKeys')
    const apiKey = resolvedApiKeys.elevenlabs

    if (!apiKey) {
      console.warn('[Voice] No API key available - neither user key nor env var set')
      return c.json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured. Please add your API key in Profile settings.',
        code: 'VOICE_5030'
      }, 503)
    }

    // Create service instance with user's API key
    const userVoiceService = new VoiceGenerationService(apiKey)
    const voices = await userVoiceService.getAvailableVoices()

    console.log(`[Voice] Voice library fetched: ${voices.length} voices`)

    return c.json({
      voices,
      count: voices.length
    })
  } catch (error) {
    console.error('[Voice] Failed to fetch voice library:', error)
    return c.json({
      error: 'Failed to fetch voice library',
      code: 'VOICE_5000',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice/generate
 * Generate single voice clip from text
 */
router.post('/generate', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    const { text, voiceId, npcId, settings } = await c.req.json()

    // Validation
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return c.json({
        error: "Invalid input: 'text' must be a non-empty string",
        code: 'VOICE_4000'
      }, 400)
    }

    if (!voiceId || typeof voiceId !== 'string') {
      return c.json({
        error: "Invalid input: 'voiceId' must be a string",
        code: 'VOICE_4001'
      }, 400)
    }

    // Use resolved API key from middleware
    const resolvedApiKeys = c.get('resolvedApiKeys')
    const apiKey = resolvedApiKeys.elevenlabs

    console.log(`[Voice] Generating voice for NPC: ${npcId || 'unknown'}`)

    // Create service instance with user's API key
    const userVoiceService = new VoiceGenerationService(apiKey)
    const result = await userVoiceService.generateVoice({
      text,
      voiceId,
      npcId,
      settings
    })

    console.log(`[Voice] Voice generated successfully: ${result.audioPath}`)

    return c.json(result)
  } catch (error) {
    console.error('[Voice] Voice generation failed:', error)
    return c.json({
      error: 'Failed to generate voice',
      code: 'VOICE_5001',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice/batch
 * Batch generate voices for multiple texts
 */
router.post('/batch', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    const { texts, voiceId, npcId, settings } = await c.req.json()

    // Validation
    if (!Array.isArray(texts) || texts.length === 0) {
      return c.json({
        error: "Invalid input: 'texts' must be a non-empty array",
        code: 'VOICE_4010'
      }, 400)
    }

    if (!voiceId || typeof voiceId !== 'string') {
      return c.json({
        error: "Invalid input: 'voiceId' must be a string",
        code: 'VOICE_4011'
      }, 400)
    }

    // Use resolved API key from middleware
    const resolvedApiKeys = c.get('resolvedApiKeys')
    const apiKey = resolvedApiKeys.elevenlabs

    console.log(`[Voice] Batch generating ${texts.length} voices for NPC: ${npcId || 'unknown'}`)

    // Create service instance with user's API key
    const userVoiceService = new VoiceGenerationService(apiKey)
    const results = await userVoiceService.generateVoiceBatch({
      texts,
      voiceId,
      npcId,
      settings
    })

    console.log(`[Voice] Batch generation complete: ${results.successful}/${results.total}`)

    return c.json(results)
  } catch (error) {
    console.error('[Voice] Batch generation failed:', error)
    return c.json({
      error: 'Failed to generate voice batch',
      code: 'VOICE_5011',
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/voice/profile/:npcId
 * Get voice profile for an NPC
 */
router.get('/profile/:npcId', async (c) => {
  try {
    const npcId = c.req.param('npcId')

    if (!voiceService.isAvailable()) {
      return c.json({
        error: 'Voice generation service not available',
        code: 'VOICE_5030'
      }, 503)
    }

    const profile = await voiceService.getVoiceProfile(npcId)

    if (!profile) {
      return c.json({
        error: 'Voice profile not found',
        code: 'VOICE_4040'
      }, 404)
    }

    return c.json(profile)
  } catch (error) {
    console.error('[Voice] Failed to get voice profile:', error)
    return c.json({
      error: 'Failed to get voice profile',
      code: 'VOICE_5020',
      details: error.message
    }, 500)
  }
})

/**
 * DELETE /api/voice/:npcId
 * Delete voice clips for an NPC
 */
router.delete('/:npcId', async (c) => {
  try {
    const npcId = c.req.param('npcId')

    if (!voiceService.isAvailable()) {
      return c.json({
        error: 'Voice generation service not available',
        code: 'VOICE_5030'
      }, 503)
    }

    await voiceService.deleteVoiceClips(npcId)

    return c.json({
      success: true,
      message: `Voice clips deleted for NPC: ${npcId}`
    })
  } catch (error) {
    console.error('[Voice] Failed to delete voice clips:', error)
    return c.json({
      error: 'Failed to delete voice clips',
      code: 'VOICE_5021',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice/estimate
 * Estimate cost for voice generation
 */
router.post('/estimate', async (c) => {
  try {
    const { texts, settings } = await c.req.json()

    if (!Array.isArray(texts) || texts.length === 0) {
      return c.json({
        error: "Invalid input: 'texts' must be a non-empty array",
        code: 'VOICE_4020'
      }, 400)
    }

    const estimate = voiceService.estimateCost(texts, settings)

    return c.json(estimate)
  } catch (error) {
    console.error('[Voice] Failed to estimate cost:', error)
    return c.json({
      error: 'Failed to estimate cost',
      code: 'VOICE_5022',
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/voice/subscription
 * Get ElevenLabs subscription info
 */
router.get('/subscription', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    // Use resolved API key from middleware
    const resolvedApiKeys = c.get('resolvedApiKeys')
    const apiKey = resolvedApiKeys.elevenlabs

    if (!apiKey) {
      return c.json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured',
        code: 'VOICE_5030'
      }, 503)
    }

    const userVoiceService = new VoiceGenerationService(apiKey)
    const subscription = await userVoiceService.getSubscriptionInfo()

    return c.json(subscription)
  } catch (error) {
    console.error('[Voice] Failed to get subscription info:', error)
    return c.json({
      error: 'Failed to get subscription info',
      code: 'VOICE_5023',
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/voice/models
 * Get available ElevenLabs voice models
 */
router.get('/models', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    // Use resolved API key from middleware
    const resolvedApiKeys = c.get('resolvedApiKeys')
    const apiKey = resolvedApiKeys.elevenlabs

    if (!apiKey) {
      return c.json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured',
        code: 'VOICE_5030'
      }, 503)
    }

    const userVoiceService = new VoiceGenerationService(apiKey)
    const models = await userVoiceService.getAvailableModels()

    return c.json({
      models,
      count: models.length
    })
  } catch (error) {
    console.error('[Voice] Failed to get models:', error)
    return c.json({
      error: 'Failed to get voice models',
      code: 'VOICE_5024',
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/voice/rate-limit
 * Get current rate limit status
 */
router.get('/rate-limit', async (c) => {
  try {
    if (!voiceService.isAvailable()) {
      return c.json({
        error: 'Voice generation service not available',
        code: 'VOICE_5030'
      }, 503)
    }

    const rateLimitInfo = voiceService.getRateLimitInfo()

    return c.json(rateLimitInfo)
  } catch (error) {
    console.error('[Voice] Failed to get rate limit:', error)
    return c.json({
      error: 'Failed to get rate limit info',
      code: 'VOICE_5025',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice/speech-to-speech
 * Convert audio from one voice to another (Voice Changer)
 */
router.post('/speech-to-speech', async (c) => {
  try {
    console.log('[Voice] POST /api/voice/speech-to-speech')

    if (!voiceService.isAvailable()) {
      return c.json({
        error: 'Voice generation service not available',
        message: 'ELEVENLABS_API_KEY not configured',
        code: 'VOICE_5030'
      }, 503)
    }

    // Extract audio file from multipart form data
    // Note: This requires multer middleware or similar
    const { audio, voiceId, modelId, outputFormat, stability, similarityBoost, removeBackgroundNoise, seed } = await c.req.json()

    // Validation
    if (!audio) {
      return c.json({
        error: "Invalid input: 'audio' buffer is required",
        code: 'VOICE_4030'
      }, 400)
    }

    if (!voiceId || typeof voiceId !== 'string') {
      return c.json({
        error: "Invalid input: 'voiceId' must be a string",
        code: 'VOICE_4031'
      }, 400)
    }

    console.log(`[Voice] Converting audio to voice: ${voiceId}`)

    const audioBuffer = await voiceService.speechToSpeech({
      audio: Buffer.isBuffer(audio) ? audio : Buffer.from(audio, 'base64'),
      voiceId,
      modelId,
      outputFormat,
      stability,
      similarityBoost,
      removeBackgroundNoise,
      seed
    })

    console.log(`[Voice] Audio converted successfully, size: ${audioBuffer.length} bytes`)

    // Return audio as base64 or binary
    return c.json({
      success: true,
      audio: audioBuffer.toString('base64'),
      size: audioBuffer.length,
      format: outputFormat || 'mp3_44100_128'
    })
  } catch (error) {
    console.error('[Voice] Speech-to-speech conversion failed:', error)
    return c.json({
      error: 'Failed to convert audio',
      code: 'VOICE_5026',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice/speech-to-speech/stream
 * Stream audio conversion (Voice Changer)
 */
router.post('/speech-to-speech/stream', async (c) => {
  try {
    console.log('[Voice] POST /api/voice/speech-to-speech/stream')

    if (!voiceService.isAvailable()) {
      return c.json({
        error: 'Voice generation service not available',
        code: 'VOICE_5030'
      }, 503)
    }

    const { audio, voiceId, modelId, outputFormat, stability, similarityBoost, removeBackgroundNoise } = await c.req.json()

    // Validation
    if (!audio) {
      return c.json({
        error: "Invalid input: 'audio' buffer is required",
        code: 'VOICE_4030'
      }, 400)
    }

    if (!voiceId) {
      return c.json({
        error: "Invalid input: 'voiceId' is required",
        code: 'VOICE_4031'
      }, 400)
    }

    console.log(`[Voice] Streaming audio conversion to voice: ${voiceId}`)

    const audioStream = await voiceService.speechToSpeechStream({
      audio: Buffer.isBuffer(audio) ? audio : Buffer.from(audio, 'base64'),
      voiceId,
      modelId,
      outputFormat,
      stability,
      similarityBoost,
      removeBackgroundNoise
    })

    // Create a readable stream from the async generator
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of audioStream) {
            controller.enqueue(chunk)
          }
          controller.close()
          console.log('[Voice] Audio stream completed')
        } catch (error) {
          controller.error(error)
        }
      }
    })

    c.header('Content-Type', 'audio/mpeg')
    c.header('Transfer-Encoding', 'chunked')
    return c.body(stream)
  } catch (error) {
    console.error('[Voice] Speech-to-speech streaming failed:', error)
    return c.json({
      error: 'Failed to stream audio conversion',
      code: 'VOICE_5027',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice/design
 * Design a voice from text description (Voice Design)
 */
router.post('/design', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    console.log('[Voice] POST /api/voice/design')

    // Use resolved API key from middleware
    const resolvedApiKeys = c.get('resolvedApiKeys')
    const apiKey = resolvedApiKeys.elevenlabs

    if (!apiKey) {
      return c.json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured',
        code: 'VOICE_5030'
      }, 503)
    }

    const userVoiceService = new VoiceGenerationService(apiKey)

    const {
      voiceDescription,
      modelId,
      text,
      autoGenerateText,
      loudness,
      seed,
      guidanceScale,
      outputFormat
    } = await c.req.json()

    // Validation
    if (!voiceDescription || typeof voiceDescription !== 'string' || voiceDescription.trim() === '') {
      return c.json({
        error: "Invalid input: 'voiceDescription' must be a non-empty string",
        code: 'VOICE_4032'
      }, 400)
    }

    console.log(`[Voice] Designing voice: "${voiceDescription}"`)

    const result = await userVoiceService.designVoice({
      voiceDescription,
      modelId,
      text,
      autoGenerateText,
      loudness,
      seed,
      guidanceScale,
      outputFormat
    })

    console.log(`[Voice] Voice design completed: ${result.previews.length} previews generated`)

    return c.json(result)
  } catch (error) {
    console.error('[Voice] Voice design failed:', error)
    return c.json({
      error: 'Failed to design voice',
      code: 'VOICE_5028',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice/create-from-preview
 * Save a designed voice to library
 */
router.post('/create-from-preview', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    console.log('[Voice] POST /api/voice/create-from-preview')

    // Use resolved API key from middleware
    const resolvedApiKeys = c.get('resolvedApiKeys')
    const apiKey = resolvedApiKeys.elevenlabs

    if (!apiKey) {
      return c.json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured',
        code: 'VOICE_5030'
      }, 503)
    }

    const userVoiceService = new VoiceGenerationService(apiKey)

    const { voiceName, voiceDescription, generatedVoiceId, labels, playedNotSelectedVoiceIds } = await c.req.json()

    // Validation
    if (!voiceName || typeof voiceName !== 'string' || voiceName.trim() === '') {
      return c.json({
        error: "Invalid input: 'voiceName' must be a non-empty string",
        code: 'VOICE_4033'
      }, 400)
    }

    if (!voiceDescription || typeof voiceDescription !== 'string' || voiceDescription.trim() === '') {
      return c.json({
        error: "Invalid input: 'voiceDescription' must be a non-empty string",
        code: 'VOICE_4034'
      }, 400)
    }

    if (!generatedVoiceId || typeof generatedVoiceId !== 'string') {
      return c.json({
        error: "Invalid input: 'generatedVoiceId' must be a string",
        code: 'VOICE_4035'
      }, 400)
    }

    console.log(`[Voice] Creating voice from preview: "${voiceName}"`)

    const result = await userVoiceService.createVoiceFromPreview({
      voiceName,
      voiceDescription,
      generatedVoiceId,
      labels,
      playedNotSelectedVoiceIds
    })

    console.log(`[Voice] Voice created successfully: ${result.voiceId}`)

    return c.json(result)
  } catch (error) {
    console.error('[Voice] Voice creation failed:', error)
    return c.json({
      error: 'Failed to create voice from preview',
      code: 'VOICE_5029',
      details: error.message
    }, 500)
  }
})

// =====================================================
// MANIFEST VOICE ASSIGNMENT ENDPOINTS
// =====================================================

/**
 * POST /api/voice/manifest/assign
 * Assign voice to a manifest entity (NPC, Mob, etc.)
 *
 * Body:
 * - manifestType: "npcs" | "mobs" | "items" etc.
 * - entityId: Entity ID from manifest (e.g., "goblin_warrior")
 * - voiceId: ElevenLabs voice ID
 * - voiceName: Voice name for reference
 * - voiceSettings: Optional voice settings object
 * - projectId: Optional project ID
 */
router.post('/manifest/assign', requireAuth, async (c) => {
  try {
    console.log('[Voice Manifest] POST /api/voice/manifest/assign')

    const { manifestType, entityId, voiceId, voiceName, voiceSettings, projectId } = await c.req.json()
    const user = c.get('user')

    // Validation
    if (!manifestType || typeof manifestType !== 'string') {
      return c.json({
        error: "Invalid input: 'manifestType' must be a string",
        code: 'VOICE_MANIFEST_4000'
      }, 400)
    }

    if (!entityId || typeof entityId !== 'string') {
      return c.json({
        error: "Invalid input: 'entityId' must be a string",
        code: 'VOICE_MANIFEST_4001'
      }, 400)
    }

    if (!voiceId || typeof voiceId !== 'string') {
      return c.json({
        error: "Invalid input: 'voiceId' must be a string",
        code: 'VOICE_MANIFEST_4002'
      }, 400)
    }

    if (!voiceName || typeof voiceName !== 'string') {
      return c.json({
        error: "Invalid input: 'voiceName' must be a string",
        code: 'VOICE_MANIFEST_4003'
      }, 400)
    }

    // Check if assignment already exists
    const existing = await query(
      `SELECT * FROM voice_manifests
       WHERE owner_id = $1 AND manifest_data->>'manifestType' = $2 AND manifest_data->>'entityId' = $3`,
      [user.id, manifestType, entityId]
    )

    const assignment = {
      manifestType,
      entityId,
      voiceId,
      voiceName,
      voiceSettings: voiceSettings || {},
      updatedAt: new Date().toISOString()
    }

    let result

    if (existing.rows.length > 0) {
      // Update existing assignment
      result = await query(
        `UPDATE voice_manifests
         SET manifest_data = $1, updated_at = CURRENT_TIMESTAMP, version = version + 1
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(assignment), existing.rows[0].id]
      )
      console.log(`[Voice Manifest] Updated assignment for ${manifestType}/${entityId}`)
    } else {
      // Create new assignment
      result = await query(
        `INSERT INTO voice_manifests (name, description, voice_assignments, manifest_data, project_id, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          `${manifestType}_${entityId}_voice`,
          `Voice assignment for ${manifestType} ${entityId}`,
          JSON.stringify([assignment]),
          JSON.stringify(assignment),
          projectId || null,
          user.id
        ]
      )
      console.log(`[Voice Manifest] Created assignment for ${manifestType}/${entityId}`)
    }

    const manifest = result.rows[0]

    return c.json({
      success: true,
      message: 'Voice assigned to manifest entity',
      assignment: JSON.parse(manifest.manifest_data),
      manifestId: manifest.id,
      version: manifest.version
    }, 201)
  } catch (error) {
    console.error('[Voice Manifest] Failed to assign voice:', error)
    return c.json({
      error: 'Failed to assign voice to manifest entity',
      code: 'VOICE_MANIFEST_5000',
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/voice/manifest/:manifestType/:entityId
 * Get voice assignment for a specific manifest entity
 */
router.get('/manifest/:manifestType/:entityId', requireAuth, async (c) => {
  try {
    const manifestType = c.req.param('manifestType')
    const entityId = c.req.param('entityId')
    const user = c.get('user')

    console.log(`[Voice Manifest] GET /api/voice/manifest/${manifestType}/${entityId}`)

    const result = await query(
      `SELECT * FROM voice_manifests
       WHERE owner_id = $1 AND manifest_data->>'manifestType' = $2 AND manifest_data->>'entityId' = $3`,
      [user.id, manifestType, entityId]
    )

    if (result.rows.length === 0) {
      return c.json({
        error: 'Voice assignment not found',
        manifestType,
        entityId
      }, 404)
    }

    const manifest = result.rows[0]
    const assignment = JSON.parse(manifest.manifest_data)

    return c.json({
      assignment,
      manifestId: manifest.id,
      version: manifest.version,
      updatedAt: manifest.updated_at
    })
  } catch (error) {
    console.error('[Voice Manifest] Failed to get assignment:', error)
    return c.json({
      error: 'Failed to get voice assignment',
      code: 'VOICE_MANIFEST_5001',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice/manifest/bulk
 * Get voice assignments for multiple entities
 *
 * Body:
 * - manifestType: "npcs" | "mobs" etc.
 * - entityIds: Array of entity IDs
 */
router.post('/manifest/bulk', requireAuth, async (c) => {
  try {
    console.log('[Voice Manifest] POST /api/voice/manifest/bulk')

    const { manifestType, entityIds } = await c.req.json()
    const user = c.get('user')

    // Validation
    if (!manifestType || typeof manifestType !== 'string') {
      return c.json({
        error: "Invalid input: 'manifestType' must be a string",
        code: 'VOICE_MANIFEST_4010'
      }, 400)
    }

    if (!Array.isArray(entityIds) || entityIds.length === 0) {
      return c.json({
        error: "Invalid input: 'entityIds' must be a non-empty array",
        code: 'VOICE_MANIFEST_4011'
      }, 400)
    }

    // Get all assignments for the specified entities
    const result = await query(
      `SELECT * FROM voice_manifests
       WHERE owner_id = $1 AND manifest_data->>'manifestType' = $2`,
      [user.id, manifestType]
    )

    const assignments = result.rows
      .map(row => JSON.parse(row.manifest_data))
      .filter(assignment => entityIds.includes(assignment.entityId))

    return c.json({
      assignments,
      count: assignments.length,
      requestedCount: entityIds.length
    })
  } catch (error) {
    console.error('[Voice Manifest] Failed to get bulk assignments:', error)
    return c.json({
      error: 'Failed to get voice assignments',
      code: 'VOICE_MANIFEST_5002',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice/manifest/bulk-assign
 * Bulk assign voices to multiple entities
 *
 * Body:
 * - assignments: Array of { manifestType, entityId, voiceId, voiceName, voiceSettings? }
 * - projectId: Optional project ID
 */
router.post('/manifest/bulk-assign', requireAuth, async (c) => {
  try {
    console.log('[Voice Manifest] POST /api/voice/manifest/bulk-assign')

    const { assignments, projectId } = await c.req.json()
    const user = c.get('user')

    // Validation
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return c.json({
        error: "Invalid input: 'assignments' must be a non-empty array",
        code: 'VOICE_MANIFEST_4020'
      }, 400)
    }

    // Validate each assignment
    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i]
      if (!assignment.manifestType || !assignment.entityId || !assignment.voiceId || !assignment.voiceName) {
        return c.json({
          error: `Invalid assignment at index ${i}: must have manifestType, entityId, voiceId, and voiceName`,
          code: 'VOICE_MANIFEST_4021'
        }, 400)
      }
    }

    const results = []
    const errors = []

    // Process each assignment
    for (const assignment of assignments) {
      try {
        const { manifestType, entityId, voiceId, voiceName, voiceSettings } = assignment

        // Check if assignment exists
        const existing = await query(
          `SELECT * FROM voice_manifests
           WHERE owner_id = $1 AND manifest_data->>'manifestType' = $2 AND manifest_data->>'entityId' = $3`,
          [user.id, manifestType, entityId]
        )

        const assignmentData = {
          manifestType,
          entityId,
          voiceId,
          voiceName,
          voiceSettings: voiceSettings || {},
          updatedAt: new Date().toISOString()
        }

        if (existing.rows.length > 0) {
          // Update existing
          await query(
            `UPDATE voice_manifests
             SET manifest_data = $1, updated_at = CURRENT_TIMESTAMP, version = version + 1
             WHERE id = $2`,
            [JSON.stringify(assignmentData), existing.rows[0].id]
          )
        } else {
          // Create new
          await query(
            `INSERT INTO voice_manifests (name, description, voice_assignments, manifest_data, project_id, owner_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              `${manifestType}_${entityId}_voice`,
              `Voice assignment for ${manifestType} ${entityId}`,
              JSON.stringify([assignmentData]),
              JSON.stringify(assignmentData),
              projectId || null,
              user.id
            ]
          )
        }

        results.push({
          success: true,
          manifestType,
          entityId
        })
      } catch (error) {
        errors.push({
          success: false,
          manifestType: assignment.manifestType,
          entityId: assignment.entityId,
          error: error.message
        })
      }
    }

    console.log(`[Voice Manifest] Bulk assign complete: ${results.length} successful, ${errors.length} failed`)

    return c.json({
      success: true,
      results,
      errors,
      total: assignments.length,
      successful: results.length,
      failed: errors.length
    })
  } catch (error) {
    console.error('[Voice Manifest] Failed to bulk assign:', error)
    return c.json({
      error: 'Failed to bulk assign voices',
      code: 'VOICE_MANIFEST_5003',
      details: error.message
    }, 500)
  }
})

/**
 * DELETE /api/voice/manifest/:manifestType/:entityId
 * Remove voice assignment from manifest entity
 */
router.delete('/manifest/:manifestType/:entityId', requireAuth, async (c) => {
  try {
    const manifestType = c.req.param('manifestType')
    const entityId = c.req.param('entityId')
    const user = c.get('user')

    console.log(`[Voice Manifest] DELETE /api/voice/manifest/${manifestType}/${entityId}`)

    const result = await query(
      `DELETE FROM voice_manifests
       WHERE owner_id = $1 AND manifest_data->>'manifestType' = $2 AND manifest_data->>'entityId' = $3
       RETURNING *`,
      [user.id, manifestType, entityId]
    )

    if (result.rows.length === 0) {
      return c.json({
        error: 'Voice assignment not found',
        manifestType,
        entityId
      }, 404)
    }

    console.log(`[Voice Manifest] Deleted assignment for ${manifestType}/${entityId}`)

    return c.json({
      success: true,
      message: 'Voice assignment deleted',
      manifestType,
      entityId
    })
  } catch (error) {
    console.error('[Voice Manifest] Failed to delete assignment:', error)
    return c.json({
      error: 'Failed to delete voice assignment',
      code: 'VOICE_MANIFEST_5004',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice/manifest/generate-sample
 * Generate audio sample for manifest entity using assigned voice
 *
 * Body:
 * - manifestType: "npcs" | "mobs" etc.
 * - entityId: Entity ID
 * - sampleText: Text to generate (optional, will use default based on entity)
 */
router.post('/manifest/generate-sample', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    console.log('[Voice Manifest] POST /api/voice/manifest/generate-sample')

    const { manifestType, entityId, sampleText } = await c.req.json()
    const user = c.get('user')
    const resolvedApiKeys = c.get('resolvedApiKeys')
    const apiKey = resolvedApiKeys.elevenlabs

    // Validation
    if (!manifestType || typeof manifestType !== 'string') {
      return c.json({
        error: "Invalid input: 'manifestType' must be a string",
        code: 'VOICE_MANIFEST_4030'
      }, 400)
    }

    if (!entityId || typeof entityId !== 'string') {
      return c.json({
        error: "Invalid input: 'entityId' must be a string",
        code: 'VOICE_MANIFEST_4031'
      }, 400)
    }

    if (!apiKey) {
      return c.json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured',
        code: 'VOICE_5030'
      }, 503)
    }

    // Get voice assignment
    const result = await query(
      `SELECT * FROM voice_manifests
       WHERE owner_id = $1 AND manifest_data->>'manifestType' = $2 AND manifest_data->>'entityId' = $3`,
      [user.id, manifestType, entityId]
    )

    if (result.rows.length === 0) {
      return c.json({
        error: 'No voice assignment found for this entity',
        message: `Please assign a voice to ${manifestType}/${entityId} first`,
        code: 'VOICE_MANIFEST_4040'
      }, 404)
    }

    const manifest = result.rows[0]
    const assignment = JSON.parse(manifest.manifest_data)

    // Use provided sample text or generate default
    const text = sampleText || `Greetings! I am ${entityId} from the ${manifestType} manifest.`

    console.log(`[Voice Manifest] Generating sample for ${manifestType}/${entityId} with voice ${assignment.voiceId}`)

    // Generate voice using ElevenLabs
    const userVoiceService = new VoiceGenerationService(apiKey)
    const audioResult = await userVoiceService.generateVoice({
      text,
      voiceId: assignment.voiceId,
      settings: assignment.voiceSettings
    })

    console.log(`[Voice Manifest] Sample generated successfully`)

    return c.json({
      success: true,
      audio: audioResult.audio || audioResult.audioPath,
      text,
      manifestType,
      entityId,
      voiceId: assignment.voiceId,
      voiceName: assignment.voiceName
    })
  } catch (error) {
    console.error('[Voice Manifest] Failed to generate sample:', error)
    return c.json({
      error: 'Failed to generate voice sample',
      code: 'VOICE_MANIFEST_5005',
      details: error.message
    }, 500)
  }
})

export default router
