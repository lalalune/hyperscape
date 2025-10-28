/**
 * Music Generation API Routes
 * ElevenLabs music generation integration for game soundtracks
 */

import { Hono } from 'hono'
import { MusicService } from '../services/MusicService.mjs'
import { requireAuth } from '../middleware/auth-hono.mjs'
import { resolveElevenLabsKey } from '../middleware/api-key-resolver-hono.mjs'

const router = new Hono()

/**
 * POST /api/music/generate
 * Generate music from text prompt
 *
 * Body:
 * - prompt: Text description of desired music (optional if compositionPlan provided)
 * - musicLengthMs: Length of music in milliseconds (optional)
 * - compositionPlan: Detailed composition plan object (optional)
 * - forceInstrumental: Force instrumental (no vocals) - boolean (default: false)
 * - modelId: Model to use (default: 'music_v1')
 * - outputFormat: Audio format (default: 'mp3_44100_128')
 *
 * Returns: Audio file (MP3) as binary data
 */
router.post('/generate', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    const {
      prompt,
      musicLengthMs,
      compositionPlan,
      forceInstrumental,
      respectSectionsDurations,
      storeForInpainting,
      modelId,
      outputFormat
    } = await c.req.json()

    // Validation
    if (!prompt && !compositionPlan) {
      return c.json({
        error: "Invalid input: either 'prompt' or 'compositionPlan' must be provided",
        code: 'MUSIC_4000'
      }, 400)
    }

    if (prompt && (typeof prompt !== 'string' || prompt.trim() === '')) {
      return c.json({
        error: "Invalid input: 'prompt' must be a non-empty string",
        code: 'MUSIC_4001'
      }, 400)
    }

    if (musicLengthMs !== undefined && musicLengthMs !== null) {
      if (typeof musicLengthMs !== 'number' || musicLengthMs < 1000 || musicLengthMs > 300000) {
        return c.json({
          error: "Invalid input: 'musicLengthMs' must be between 1000 and 300000 (1-300 seconds)",
          code: 'MUSIC_4002'
        }, 400)
      }
    }

    // Use resolved API key from middleware
    const apiKey = c.get('resolvedApiKeys').elevenlabs

    console.log(`[Music] Generating music: "${prompt?.substring(0, 50) || 'from composition plan'}..."`)

    // Create service instance with user's API key
    const userMusicService = new MusicService(apiKey)
    const audioBuffer = await userMusicService.generateMusic({
      prompt,
      musicLengthMs,
      compositionPlan,
      forceInstrumental,
      respectSectionsDurations,
      storeForInpainting,
      modelId,
      outputFormat
    })

    // Return audio file directly
    c.header('Content-Type', 'audio/mpeg')
    c.header('Content-Length', audioBuffer.length.toString())
    c.header('Cache-Control', 'public, max-age=31536000')
    c.header('Content-Disposition', `attachment; filename="music-${Date.now()}.mp3"`)

    console.log(`[Music] Music generated successfully: ${audioBuffer.length} bytes`)

    return c.body(audioBuffer)
  } catch (error) {
    console.error('[Music] Music generation failed:', error)
    return c.json({
      error: 'Failed to generate music',
      code: 'MUSIC_5001',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/music/generate-detailed
 * Generate music with detailed metadata response
 *
 * Body: Same as /generate
 *
 * Returns: JSON with { audio: base64, metadata: {...} }
 */
router.post('/generate-detailed', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    const {
      prompt,
      musicLengthMs,
      compositionPlan,
      forceInstrumental,
      storeForInpainting,
      modelId,
      outputFormat
    } = await c.req.json()

    // Validation (same as /generate)
    if (!prompt && !compositionPlan) {
      return c.json({
        error: "Invalid input: either 'prompt' or 'compositionPlan' must be provided",
        code: 'MUSIC_4000'
      }, 400)
    }

    // Use resolved API key from middleware
    const apiKey = c.get('resolvedApiKeys').elevenlabs

    console.log(`[Music] Generating detailed music: "${prompt?.substring(0, 50) || 'from composition plan'}..."`)

    const userMusicService = new MusicService(apiKey)
    const result = await userMusicService.generateMusicDetailed({
      prompt,
      musicLengthMs,
      compositionPlan,
      forceInstrumental,
      storeForInpainting,
      modelId,
      outputFormat
    })

    // Return JSON with base64-encoded audio and metadata
    return c.json({
      audio: result.audio.toString('base64'),
      metadata: result.metadata,
      format: outputFormat || 'mp3_44100_128'
    })
  } catch (error) {
    console.error('[Music] Detailed music generation failed:', error)
    return c.json({
      error: 'Failed to generate detailed music',
      code: 'MUSIC_5002',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/music/plan
 * Create a composition plan from a text prompt
 * This endpoint doesn't cost any credits
 *
 * Body:
 * - prompt: Text description of desired music (required)
 * - musicLengthMs: Target length in milliseconds (optional)
 * - sourceCompositionPlan: Existing plan to modify (optional)
 * - modelId: Model to use (default: 'music_v1')
 *
 * Returns: Composition plan JSON object
 */
router.post('/plan', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    const { prompt, musicLengthMs, sourceCompositionPlan, modelId } = await c.req.json()

    // Validation
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return c.json({
        error: "Invalid input: 'prompt' must be a non-empty string",
        code: 'MUSIC_4003'
      }, 400)
    }

    // Use resolved API key from middleware
    const apiKey = c.get('resolvedApiKeys').elevenlabs

    console.log(`[Music] Creating composition plan: "${prompt.substring(0, 50)}..."`)

    const userMusicService = new MusicService(apiKey)
    const plan = await userMusicService.createCompositionPlan({
      prompt,
      musicLengthMs,
      sourceCompositionPlan,
      modelId
    })

    console.log(`[Music] Composition plan created with ${plan.sections?.length || 0} sections`)

    return c.json(plan)
  } catch (error) {
    console.error('[Music] Composition plan creation failed:', error)
    return c.json({
      error: 'Failed to create composition plan',
      code: 'MUSIC_5003',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/music/batch
 * Batch generate multiple music tracks
 *
 * Body:
 * - tracks: Array of generation requests (same format as /generate)
 *
 * Returns: JSON with results array
 */
router.post('/batch', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    const { tracks } = await c.req.json()

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return c.json({
        error: "Invalid input: 'tracks' must be a non-empty array",
        code: 'MUSIC_4004'
      }, 400)
    }

    if (tracks.length > 10) {
      return c.json({
        error: "Invalid input: maximum 10 tracks per batch",
        code: 'MUSIC_4005'
      }, 400)
    }

    // Use resolved API key from middleware
    const apiKey = c.get('resolvedApiKeys').elevenlabs

    console.log(`[Music] Batch generating ${tracks.length} tracks`)

    const userMusicService = new MusicService(apiKey)
    const results = await userMusicService.generateBatch(tracks)

    // Convert audio buffers to base64 for JSON response
    const jsonResults = results.map(result => ({
      success: result.success,
      audio: result.audio ? result.audio.toString('base64') : null,
      prompt: result.request.prompt,
      error: result.error
    }))

    return c.json({
      results: jsonResults,
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    })
  } catch (error) {
    console.error('[Music] Batch music generation failed:', error)
    return c.json({
      error: 'Failed to batch generate music',
      code: 'MUSIC_5004',
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/music/status
 * Get music generation service status and rate limit info
 *
 * Returns: Service status JSON
 */
router.get('/status', (c) => {
  try {
    // Status endpoint just checks if service key is configured
    const status = {
      available: !!process.env.ELEVENLABS_API_KEY,
      service: 'elevenlabs-music',
      timestamp: new Date().toISOString()
    }
    return c.json(status)
  } catch (error) {
    console.error('[Music] Status check failed:', error)
    return c.json({
      error: 'Failed to get service status',
      code: 'MUSIC_5005',
      details: error.message
    }, 500)
  }
})

export default router
