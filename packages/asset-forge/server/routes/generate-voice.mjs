/**
 * Voice Generation API Routes
 *
 * Endpoints for ElevenLabs text-to-speech generation
 */

import { VoiceGenerationService } from '../services/VoiceGenerationService.mjs'
import { createLogger } from '../utils/logger.mjs'
import { validateNpcId } from '../utils/validators.mjs'

// Lazy initialization - only create the service when first needed
// This ensures environment variables are loaded before instantiation
let voiceService = null
function getVoiceService() {
  if (!voiceService) {
    voiceService = new VoiceGenerationService()
  }
  return voiceService
}

const logger = createLogger('VoiceGenerationAPI')

/**
 * Map audio output format to MIME content type
 */
function getContentTypeForFormat(outputFormat) {
  if (!outputFormat || outputFormat.startsWith('mp3_')) {
    return 'audio/mpeg'
  }
  if (outputFormat.startsWith('pcm_')) {
    return 'audio/wav' // PCM is typically served as WAV
  }
  if (outputFormat.startsWith('opus_')) {
    return 'audio/ogg' // Opus is typically in OGG container
  }
  if (outputFormat === 'ulaw_8000' || outputFormat === 'alaw_8000') {
    return 'audio/basic'
  }
  // Default fallback
  return 'audio/mpeg'
}

/**
 * GET /api/voice/library
 * Get available voices from ElevenLabs library
 */
export async function GET_library(req, res) {
  try {
    const voiceService = getVoiceService()

    logger.info('GET /api/voice/library')

    if (!voiceService.isAvailable()) {
      logger.warn('Voice service unavailable - API key not configured')
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ELEVENLABS_API_KEY not configured'
      })
    }

    const voices = await voiceService.getAvailableVoices()

    logger.info('Voice library fetched successfully', { count: voices.length })

    return res.json({
      voices,
      count: voices.length
    })
  } catch (error) {
    logger.error('Failed to fetch voice library', error)
    return res.status(500).json({
      error: 'Failed to fetch voice library',
      details: error.message
    })
  }
}

/**
 * POST /api/voice/generate
 * Generate single voice clip from text
 *
 * Body:
 * {
 *   text: string,
 *   voiceId: string,
 *   modelId?: string,
 *   outputFormat?: string,  // Audio format (mp3_44100_128, pcm_24000, opus_48000_128, etc.)
 *   stability?: number,
 *   similarityBoost?: number,
 *   style?: number,
 *   useSpeakerBoost?: boolean
 * }
 */
export async function POST_generate(req, res) {
  try {
    const voiceService = getVoiceService()
    const { text, voiceId, modelId, outputFormat, stability, similarityBoost, style, useSpeakerBoost } = req.body

    logger.info('POST /api/voice/generate', {
      voiceId,
      modelId,
      outputFormat,
      textLength: text?.length
    })

    if (!voiceService.isAvailable()) {
      logger.warn('Voice service unavailable - API key not configured')
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ELEVENLABS_API_KEY not configured'
      })
    }

    // Use validation helpers
    const { validateTextInput, validateVoiceId, validateSpeechSettings } = await import('../utils/voice-validation.mjs')

    const textValidation = validateTextInput(text)
    if (!textValidation.valid) {
      logger.warn('Invalid input: text validation failed', { textType: typeof text })
      return res.status(textValidation.statusCode).json(textValidation.error)
    }

    const voiceIdValidation = validateVoiceId(voiceId)
    if (!voiceIdValidation.valid) {
      logger.warn('Invalid input: voiceId validation failed', { voiceId })
      return res.status(voiceIdValidation.statusCode).json(voiceIdValidation.error)
    }

    const settingsValidation = validateSpeechSettings({ stability, similarityBoost, style })
    if (!settingsValidation.valid) {
      logger.warn('Invalid input: settings validation failed')
      return res.status(settingsValidation.statusCode).json(settingsValidation.error)
    }

    // Generate speech
    const audioBuffer = await voiceService.generateSpeech({
      text,
      voiceId,
      modelId,
      outputFormat,
      stability,
      similarityBoost,
      style,
      useSpeakerBoost
    })

    logger.info('Speech generated successfully', { audioBytes: audioBuffer.length })

    // BUG FIX: Set correct Content-Type based on actual output format
    const contentType = getContentTypeForFormat(outputFormat)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', audioBuffer.length)
    res.send(audioBuffer)
  } catch (error) {
    logger.error('Failed to generate speech', error)
    return res.status(500).json({
      error: 'Failed to generate speech',
      details: error.message
    })
  }
}

/**
 * POST /api/voice/batch
 * Generate voice clips for entire dialogue tree
 *
 * Body:
 * {
 *   npcId: string,
 *   dialogueNodes: Array<{id: string, text: string}>,
 *   voiceId: string,
 *   settings?: {
 *     modelId?: string,
 *     outputFormat?: string,  // Audio format (mp3_44100_128, pcm_24000, opus_48000_128, etc.)
 *     stability?: number,
 *     similarityBoost?: number,
 *     style?: number,
 *     useSpeakerBoost?: boolean
 *   }
 * }
 */
export async function POST_batch(req, res) {
  try {
    const voiceService = getVoiceService()
    const { npcId, dialogueNodes, voiceId, settings } = req.body

    logger.info('POST /api/voice/batch', {
      npcId,
      voiceId,
      nodeCount: dialogueNodes?.length
    })

    if (!voiceService.isAvailable()) {
      logger.warn('Voice service unavailable - API key not configured')
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ELEVENLABS_API_KEY not configured'
      })
    }

    // Use validation helpers
    const {
      validateNpcIdParam,
      validateVoiceId,
      validateDialogueNodesArray,
      validateAllDialogueNodes
    } = await import('../utils/voice-validation.mjs')

    const npcIdValidation = validateNpcIdParam(npcId)
    if (!npcIdValidation.valid) {
      logger.warn('Invalid input: npcId validation failed', { npcId })
      return res.status(npcIdValidation.statusCode).json(npcIdValidation.error)
    }

    // Validate NPC ID to prevent path traversal
    const validatedNpcId = validateNpcId(npcId)

    const arrayValidation = validateDialogueNodesArray(dialogueNodes)
    if (!arrayValidation.valid) {
      logger.warn('Invalid input: dialogueNodes array validation failed')
      return res.status(arrayValidation.statusCode).json(arrayValidation.error)
    }

    const voiceIdValidation = validateVoiceId(voiceId)
    if (!voiceIdValidation.valid) {
      logger.warn('Invalid input: voiceId validation failed', { voiceId })
      return res.status(voiceIdValidation.statusCode).json(voiceIdValidation.error)
    }

    const nodesValidation = validateAllDialogueNodes(dialogueNodes)
    if (!nodesValidation.valid) {
      logger.warn('Invalid input: dialogue node validation failed')
      return res.status(nodesValidation.statusCode).json(nodesValidation.error)
    }

    // Generate all voice clips
    const result = await voiceService.generateDialogueVoices({
      npcId: validatedNpcId,
      dialogueNodes,
      voiceId,
      settings: settings || {}
    })

    logger.info('Batch voice generation completed', {
      npcId: validatedNpcId,
      totalGenerated: result.totalGenerated,
      totalRequested: result.totalRequested
    })

    return res.json({
      success: true,
      ...result
    })
  } catch (error) {
    logger.error('Failed to generate batch voices', error, { npcId: req.body.npcId })
    return res.status(500).json({
      error: 'Failed to generate voice clips',
      details: error.message
    })
  }
}

/**
 * GET /api/voice/profile/:npcId
 * Get voice profile for an NPC
 */
export async function GET_profile(req, res) {
  try {
    const voiceService = getVoiceService()

    const { npcId } = req.params

    if (!npcId) {
      return res.status(400).json({
        error: 'NPC ID is required'
      })
    }

    // Validate NPC ID to prevent path traversal
    const validatedNpcId = validateNpcId(npcId)

    const profile = await voiceService.getVoiceProfile(validatedNpcId)

    if (!profile) {
      return res.status(404).json({
        error: 'Voice profile not found for this NPC'
      })
    }

    return res.json(profile)
  } catch (error) {
    logger.error('[Voice API] Error fetching voice profile:', error)
    return res.status(500).json({
      error: 'Failed to fetch voice profile',
      details: error.message
    })
  }
}

/**
 * DELETE /api/voice/:npcId
 * Delete voice clips for an NPC
 */
export async function DELETE_voice(req, res) {
  try {
    const voiceService = getVoiceService()

    const { npcId } = req.params

    if (!npcId) {
      return res.status(400).json({
        error: 'NPC ID is required'
      })
    }

    // Validate NPC ID to prevent path traversal
    const validatedNpcId = validateNpcId(npcId)

    const success = await voiceService.deleteVoiceClips(validatedNpcId)

    if (success) {
      return res.json({
        success: true,
        message: `Voice clips deleted for NPC ${validatedNpcId}`
      })
    } else {
      return res.status(500).json({
        error: 'Failed to delete voice clips'
      })
    }
  } catch (error) {
    logger.error('[Voice API] Error deleting voice clips:', error)
    return res.status(500).json({
      error: 'Failed to delete voice clips',
      details: error.message
    })
  }
}

/**
 * POST /api/voice/estimate
 * Estimate cost for voice generation
 *
 * Body:
 * {
 *   characterCount: number,
 *   modelId?: string
 * }
 */
export async function POST_estimate(req, res) {
  try {
    const voiceService = getVoiceService()

    const { characterCount, modelId } = req.body

    if (typeof characterCount !== 'number' || characterCount <= 0) {
      return res.status(400).json({
        error: 'Invalid input: "characterCount" must be a positive number'
      })
    }

    const estimate = voiceService.estimateCost(characterCount, modelId)

    return res.json(estimate)
  } catch (error) {
    console.error('[Voice API] Error estimating cost:', error)
    return res.status(500).json({
      error: 'Failed to estimate cost',
      details: error.message
    })
  }
}

/**
 * GET /api/voice/subscription
 * Get user subscription info (quota, usage, tier)
 * Official docs: https://elevenlabs.io/docs/api-reference/get-subscription-info
 */
export async function GET_subscription(req, res) {
  try {
    const voiceService = getVoiceService()

    logger.info('GET /api/voice/subscription')

    if (!voiceService.isAvailable()) {
      logger.warn('Voice service unavailable - API key not configured')
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ELEVENLABS_API_KEY not configured'
      })
    }

    const subscription = await voiceService.getSubscriptionInfo()

    return res.json(subscription)
  } catch (error) {
    logger.error('Failed to fetch subscription info', error)
    return res.status(500).json({
      error: 'Failed to fetch subscription info',
      details: error.message
    })
  }
}

/**
 * GET /api/voice/models
 * Get available TTS models
 * Official docs: https://elevenlabs.io/docs/api-reference/get-models
 */
export async function GET_models(req, res) {
  try {
    const voiceService = getVoiceService()

    logger.info('GET /api/voice/models')

    if (!voiceService.isAvailable()) {
      logger.warn('Voice service unavailable - API key not configured')
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ELEVENLABS_API_KEY not configured'
      })
    }

    const models = await voiceService.getAvailableModels()

    logger.info('Models fetched successfully', { count: models.length })

    return res.json({
      models,
      count: models.length
    })
  } catch (error) {
    logger.error('Failed to fetch models', error)
    return res.status(500).json({
      error: 'Failed to fetch models',
      details: error.message
    })
  }
}

/**
 * GET /api/voice/rate-limit
 * Get current rate limit information
 */
export async function GET_rateLimit(req, res) {
  try {
    const voiceService = getVoiceService()

    logger.info('GET /api/voice/rate-limit')

    if (!voiceService.isAvailable()) {
      logger.warn('Voice service unavailable - API key not configured')
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ELEVENLABS_API_KEY not configured'
      })
    }

    const rateLimitInfo = voiceService.getRateLimitInfo()

    return res.json(rateLimitInfo)
  } catch (error) {
    logger.error('Failed to fetch rate limit info', error)
    return res.status(500).json({
      error: 'Failed to fetch rate limit info',
      details: error.message
    })
  }
}
