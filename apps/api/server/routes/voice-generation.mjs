/**
 * Voice Generation API Routes
 * ElevenLabs text-to-speech integration for NPC dialogue
 */

import { Hono } from 'hono'
import { VoiceGenerationService } from '../services/VoiceGenerationService.mjs'
import { requireAuth } from '../middleware/auth-hono.mjs'
import { resolveElevenLabsKey } from '../middleware/api-key-resolver-hono.mjs'

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

export default router
