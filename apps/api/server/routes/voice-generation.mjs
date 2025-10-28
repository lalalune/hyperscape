/**
 * Voice Generation API Routes
 * ElevenLabs text-to-speech integration for NPC dialogue
 */

import express from 'express'
import { VoiceGenerationService } from '../services/VoiceGenerationService.mjs'
import { requireAuth } from '../middleware/auth.mjs'
import { resolveElevenLabsKey } from '../middleware/api-key-resolver.mjs'

const router = express.Router()

/**
 * GET /api/voice/library
 * Get available voices from ElevenLabs library
 */
router.get('/library', requireAuth, resolveElevenLabsKey, async (req, res) => {
  try {
    console.log('[Voice] GET /api/voice/library')

    // Use resolved API key from middleware
    const apiKey = req.resolvedApiKeys.elevenlabs
    
    if (!apiKey) {
      console.warn('[Voice] No API key available - neither user key nor env var set')
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured. Please add your API key in Profile settings.',
        code: 'VOICE_5030'
      })
    }

    // Create service instance with user's API key
    const userVoiceService = new VoiceGenerationService(apiKey)
    const voices = await userVoiceService.getAvailableVoices()

    console.log(`[Voice] Voice library fetched: ${voices.length} voices`)

    return res.json({
      voices,
      count: voices.length
    })
  } catch (error) {
    console.error('[Voice] Failed to fetch voice library:', error)
    return res.status(500).json({
      error: 'Failed to fetch voice library',
      code: 'VOICE_5000',
      details: error.message
    })
  }
})

/**
 * POST /api/voice/generate
 * Generate single voice clip from text
 */
router.post('/generate', requireAuth, resolveElevenLabsKey, async (req, res) => {
  try {
    const { text, voiceId, npcId, settings } = req.body

    // Validation
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'text' must be a non-empty string",
        code: 'VOICE_4000'
      })
    }

    if (!voiceId || typeof voiceId !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'voiceId' must be a string",
        code: 'VOICE_4001'
      })
    }

    // Use resolved API key from middleware
    const apiKey = req.resolvedApiKeys.elevenlabs

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

    return res.json(result)
  } catch (error) {
    console.error('[Voice] Voice generation failed:', error)
    return res.status(500).json({
      error: 'Failed to generate voice',
      code: 'VOICE_5001',
      details: error.message
    })
  }
})

/**
 * POST /api/voice/batch
 * Batch generate voices for multiple texts
 */
router.post('/batch', requireAuth, resolveElevenLabsKey, async (req, res) => {
  try {
    const { texts, voiceId, npcId, settings } = req.body

    // Validation
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: "Invalid input: 'texts' must be a non-empty array",
        code: 'VOICE_4010'
      })
    }

    if (!voiceId || typeof voiceId !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'voiceId' must be a string",
        code: 'VOICE_4011'
      })
    }

    // Use resolved API key from middleware
    const apiKey = req.resolvedApiKeys.elevenlabs

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

    return res.json(results)
  } catch (error) {
    console.error('[Voice] Batch generation failed:', error)
    return res.status(500).json({
      error: 'Failed to generate voice batch',
      code: 'VOICE_5011',
      details: error.message
    })
  }
})

/**
 * GET /api/voice/profile/:npcId
 * Get voice profile for an NPC
 */
router.get('/profile/:npcId', async (req, res) => {
  try {
    const { npcId } = req.params

    if (!voiceService.isAvailable()) {
      return res.status(503).json({
        error: 'Voice generation service not available',
        code: 'VOICE_5030'
      })
    }

    const profile = await voiceService.getVoiceProfile(npcId)

    if (!profile) {
      return res.status(404).json({
        error: 'Voice profile not found',
        code: 'VOICE_4040'
      })
    }

    return res.json(profile)
  } catch (error) {
    console.error('[Voice] Failed to get voice profile:', error)
    return res.status(500).json({
      error: 'Failed to get voice profile',
      code: 'VOICE_5020',
      details: error.message
    })
  }
})

/**
 * DELETE /api/voice/:npcId
 * Delete voice clips for an NPC
 */
router.delete('/:npcId', async (req, res) => {
  try {
    const { npcId } = req.params

    if (!voiceService.isAvailable()) {
      return res.status(503).json({
        error: 'Voice generation service not available',
        code: 'VOICE_5030'
      })
    }

    await voiceService.deleteVoiceClips(npcId)

    return res.json({
      success: true,
      message: `Voice clips deleted for NPC: ${npcId}`
    })
  } catch (error) {
    console.error('[Voice] Failed to delete voice clips:', error)
    return res.status(500).json({
      error: 'Failed to delete voice clips',
      code: 'VOICE_5021',
      details: error.message
    })
  }
})

/**
 * POST /api/voice/estimate
 * Estimate cost for voice generation
 */
router.post('/estimate', async (req, res) => {
  try {
    const { texts, settings } = req.body

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: "Invalid input: 'texts' must be a non-empty array",
        code: 'VOICE_4020'
      })
    }

    const estimate = voiceService.estimateCost(texts, settings)

    return res.json(estimate)
  } catch (error) {
    console.error('[Voice] Failed to estimate cost:', error)
    return res.status(500).json({
      error: 'Failed to estimate cost',
      code: 'VOICE_5022',
      details: error.message
    })
  }
})

/**
 * GET /api/voice/subscription
 * Get ElevenLabs subscription info
 */
router.get('/subscription', requireAuth, resolveElevenLabsKey, async (req, res) => {
  try {
    // Use resolved API key from middleware
    const apiKey = req.resolvedApiKeys.elevenlabs
    
    if (!apiKey) {
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured',
        code: 'VOICE_5030'
      })
    }

    const userVoiceService = new VoiceGenerationService(apiKey)
    const subscription = await userVoiceService.getSubscriptionInfo()

    return res.json(subscription)
  } catch (error) {
    console.error('[Voice] Failed to get subscription info:', error)
    return res.status(500).json({
      error: 'Failed to get subscription info',
      code: 'VOICE_5023',
      details: error.message
    })
  }
})

/**
 * GET /api/voice/models
 * Get available ElevenLabs voice models
 */
router.get('/models', requireAuth, resolveElevenLabsKey, async (req, res) => {
  try {
    // Use resolved API key from middleware
    const apiKey = req.resolvedApiKeys.elevenlabs
    
    if (!apiKey) {
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured',
        code: 'VOICE_5030'
      })
    }

    const userVoiceService = new VoiceGenerationService(apiKey)
    const models = await userVoiceService.getAvailableModels()

    return res.json({
      models,
      count: models.length
    })
  } catch (error) {
    console.error('[Voice] Failed to get models:', error)
    return res.status(500).json({
      error: 'Failed to get voice models',
      code: 'VOICE_5024',
      details: error.message
    })
  }
})

/**
 * GET /api/voice/rate-limit
 * Get current rate limit status
 */
router.get('/rate-limit', async (req, res) => {
  try {
    if (!voiceService.isAvailable()) {
      return res.status(503).json({
        error: 'Voice generation service not available',
        code: 'VOICE_5030'
      })
    }

    const rateLimitInfo = voiceService.getRateLimitInfo()

    return res.json(rateLimitInfo)
  } catch (error) {
    console.error('[Voice] Failed to get rate limit:', error)
    return res.status(500).json({
      error: 'Failed to get rate limit info',
      code: 'VOICE_5025',
      details: error.message
    })
  }
})

/**
 * POST /api/voice/speech-to-speech
 * Convert audio from one voice to another (Voice Changer)
 */
router.post('/speech-to-speech', async (req, res) => {
  try {
    console.log('[Voice] POST /api/voice/speech-to-speech')

    if (!voiceService.isAvailable()) {
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ELEVENLABS_API_KEY not configured',
        code: 'VOICE_5030'
      })
    }

    // Extract audio file from multipart form data
    // Note: This requires multer middleware or similar
    const { audio, voiceId, modelId, outputFormat, stability, similarityBoost, removeBackgroundNoise, seed } = req.body

    // Validation
    if (!audio) {
      return res.status(400).json({
        error: "Invalid input: 'audio' buffer is required",
        code: 'VOICE_4030'
      })
    }

    if (!voiceId || typeof voiceId !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'voiceId' must be a string",
        code: 'VOICE_4031'
      })
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
    return res.json({
      success: true,
      audio: audioBuffer.toString('base64'),
      size: audioBuffer.length,
      format: outputFormat || 'mp3_44100_128'
    })
  } catch (error) {
    console.error('[Voice] Speech-to-speech conversion failed:', error)
    return res.status(500).json({
      error: 'Failed to convert audio',
      code: 'VOICE_5026',
      details: error.message
    })
  }
})

/**
 * POST /api/voice/speech-to-speech/stream
 * Stream audio conversion (Voice Changer)
 */
router.post('/speech-to-speech/stream', async (req, res) => {
  try {
    console.log('[Voice] POST /api/voice/speech-to-speech/stream')

    if (!voiceService.isAvailable()) {
      return res.status(503).json({
        error: 'Voice generation service not available',
        code: 'VOICE_5030'
      })
    }

    const { audio, voiceId, modelId, outputFormat, stability, similarityBoost, removeBackgroundNoise } = req.body

    // Validation
    if (!audio) {
      return res.status(400).json({
        error: "Invalid input: 'audio' buffer is required",
        code: 'VOICE_4030'
      })
    }

    if (!voiceId) {
      return res.status(400).json({
        error: "Invalid input: 'voiceId' is required",
        code: 'VOICE_4031'
      })
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

    // Set appropriate headers for streaming
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Transfer-Encoding', 'chunked')

    // Pipe the stream to response
    for await (const chunk of audioStream) {
      res.write(chunk)
    }

    res.end()
    console.log('[Voice] Audio stream completed')
  } catch (error) {
    console.error('[Voice] Speech-to-speech streaming failed:', error)
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to stream audio conversion',
        code: 'VOICE_5027',
        details: error.message
      })
    }
  }
})

/**
 * POST /api/voice/design
 * Design a voice from text description (Voice Design)
 */
router.post('/design', requireAuth, resolveElevenLabsKey, async (req, res) => {
  try {
    console.log('[Voice] POST /api/voice/design')

    // Use resolved API key from middleware
    const apiKey = req.resolvedApiKeys.elevenlabs
    
    if (!apiKey) {
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured',
        code: 'VOICE_5030'
      })
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
    } = req.body

    // Validation
    if (!voiceDescription || typeof voiceDescription !== 'string' || voiceDescription.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'voiceDescription' must be a non-empty string",
        code: 'VOICE_4032'
      })
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

    return res.json(result)
  } catch (error) {
    console.error('[Voice] Voice design failed:', error)
    return res.status(500).json({
      error: 'Failed to design voice',
      code: 'VOICE_5028',
      details: error.message
    })
  }
})

/**
 * POST /api/voice/create-from-preview
 * Save a designed voice to library
 */
router.post('/create-from-preview', requireAuth, resolveElevenLabsKey, async (req, res) => {
  try {
    console.log('[Voice] POST /api/voice/create-from-preview')

    // Use resolved API key from middleware
    const apiKey = req.resolvedApiKeys.elevenlabs
    
    if (!apiKey) {
      return res.status(503).json({
        error: 'Voice generation service not available',
        message: 'ElevenLabs API key not configured',
        code: 'VOICE_5030'
      })
    }

    const userVoiceService = new VoiceGenerationService(apiKey)

    const { voiceName, voiceDescription, generatedVoiceId, labels, playedNotSelectedVoiceIds } = req.body

    // Validation
    if (!voiceName || typeof voiceName !== 'string' || voiceName.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'voiceName' must be a non-empty string",
        code: 'VOICE_4033'
      })
    }

    if (!voiceDescription || typeof voiceDescription !== 'string' || voiceDescription.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'voiceDescription' must be a non-empty string",
        code: 'VOICE_4034'
      })
    }

    if (!generatedVoiceId || typeof generatedVoiceId !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'generatedVoiceId' must be a string",
        code: 'VOICE_4035'
      })
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

    return res.json(result)
  } catch (error) {
    console.error('[Voice] Voice creation failed:', error)
    return res.status(500).json({
      error: 'Failed to create voice from preview',
      code: 'VOICE_5029',
      details: error.message
    })
  }
})

export default router
