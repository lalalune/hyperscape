/**
 * Voice Generation API Routes
 *
 * Endpoints for ElevenLabs text-to-speech generation
 */

import { VoiceGenerationService } from '../services/VoiceGenerationService.mjs'
import { createLogger } from '../utils/logger.mjs'

const voiceService = new VoiceGenerationService()
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

    // Validation with detailed error messages
    if (!text || typeof text !== 'string' || text.trim() === '') {
      logger.warn('Invalid input: text is empty or missing', { textType: typeof text })
      return res.status(400).json({
        error: 'Validation Error',
        message: '"text" is required and must be a non-empty string',
        field: 'text',
        received: typeof text
      })
    }

    if (text.length > 5000) {
      logger.warn('Invalid input: text too long', { length: text.length })
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Text is too long. Maximum is 5000 characters.',
        field: 'text',
        received: text.length,
        maximum: 5000
      })
    }

    if (!voiceId || typeof voiceId !== 'string') {
      logger.warn('Invalid input: voiceId is missing or invalid', { voiceId })
      return res.status(400).json({
        error: 'Validation Error',
        message: '"voiceId" is required and must be a non-empty string',
        field: 'voiceId',
        received: voiceId
      })
    }

    // Validate optional parameters
    if (stability !== undefined && (typeof stability !== 'number' || stability < 0 || stability > 1)) {
      logger.warn('Invalid input: stability out of range', { stability })
      return res.status(400).json({
        error: 'Validation Error',
        message: '"stability" must be a number between 0 and 1',
        field: 'stability',
        received: stability,
        range: '0-1'
      })
    }

    if (similarityBoost !== undefined && (typeof similarityBoost !== 'number' || similarityBoost < 0 || similarityBoost > 1)) {
      logger.warn('Invalid input: similarityBoost out of range', { similarityBoost })
      return res.status(400).json({
        error: 'Validation Error',
        message: '"similarityBoost" must be a number between 0 and 1',
        field: 'similarityBoost',
        received: similarityBoost,
        range: '0-1'
      })
    }

    if (style !== undefined && (typeof style !== 'number' || style < 0 || style > 1)) {
      logger.warn('Invalid input: style out of range', { style })
      return res.status(400).json({
        error: 'Validation Error',
        message: '"style" must be a number between 0 and 1',
        field: 'style',
        received: style,
        range: '0-1'
      })
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

    // Validation with detailed error messages
    if (!npcId || typeof npcId !== 'string') {
      logger.warn('Invalid input: npcId is missing or invalid', { npcId })
      return res.status(400).json({
        error: 'Validation Error',
        message: '"npcId" is required and must be a non-empty string',
        field: 'npcId',
        received: npcId
      })
    }

    if (!Array.isArray(dialogueNodes)) {
      logger.warn('Invalid input: dialogueNodes is not an array', { type: typeof dialogueNodes })
      return res.status(400).json({
        error: 'Validation Error',
        message: '"dialogueNodes" must be an array',
        field: 'dialogueNodes',
        received: typeof dialogueNodes
      })
    }

    if (dialogueNodes.length === 0) {
      logger.warn('Invalid input: dialogueNodes is empty')
      return res.status(400).json({
        error: 'Validation Error',
        message: '"dialogueNodes" array cannot be empty',
        field: 'dialogueNodes',
        received: 'empty array'
      })
    }

    if (dialogueNodes.length > 100) {
      logger.warn('Invalid input: too many dialogue nodes', { count: dialogueNodes.length })
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Too many dialogue nodes. Maximum is 100 per batch.',
        field: 'dialogueNodes',
        received: dialogueNodes.length,
        maximum: 100
      })
    }

    if (!voiceId || typeof voiceId !== 'string') {
      logger.warn('Invalid input: voiceId is missing or invalid', { voiceId })
      return res.status(400).json({
        error: 'Validation Error',
        message: '"voiceId" is required and must be a non-empty string',
        field: 'voiceId',
        received: voiceId
      })
    }

    // Validate dialogue nodes structure
    for (const [index, node] of dialogueNodes.entries()) {
      if (!node.id || typeof node.id !== 'string') {
        logger.warn('Invalid input: dialogue node missing id', { nodeIndex: index, nodeId: node.id })
        return res.status(400).json({
          error: 'Validation Error',
          message: `Dialogue node at index ${index} is missing "id" property or id is not a string`,
          field: `dialogueNodes[${index}].id`,
          received: node.id
        })
      }

      if (!node.text || typeof node.text !== 'string' || node.text.trim() === '') {
        logger.warn('Invalid input: dialogue node missing text', { nodeIndex: index, nodeId: node.id })
        return res.status(400).json({
          error: 'Validation Error',
          message: `Dialogue node at index ${index} (id: ${node.id}) is missing "text" property or text is empty`,
          field: `dialogueNodes[${index}].text`,
          received: node.text
        })
      }

      if (node.text.length > 5000) {
        logger.warn('Invalid input: dialogue text too long', { nodeIndex: index, nodeId: node.id, length: node.text.length })
        return res.status(400).json({
          error: 'Validation Error',
          message: `Dialogue node at index ${index} (id: ${node.id}) has text that is too long. Maximum is 5000 characters.`,
          field: `dialogueNodes[${index}].text`,
          received: node.text.length,
          maximum: 5000
        })
      }
    }

    // Generate all voice clips
    const result = await voiceService.generateDialogueVoices({
      npcId,
      dialogueNodes,
      voiceId,
      settings: settings || {}
    })

    logger.info('Batch voice generation completed', {
      npcId,
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
    const { npcId } = req.params

    if (!npcId) {
      return res.status(400).json({
        error: 'NPC ID is required'
      })
    }

    const profile = await voiceService.getVoiceProfile(npcId)

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
    const { npcId } = req.params

    if (!npcId) {
      return res.status(400).json({
        error: 'NPC ID is required'
      })
    }

    const success = await voiceService.deleteVoiceClips(npcId)

    if (success) {
      return res.json({
        success: true,
        message: `Voice clips deleted for NPC ${npcId}`
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
