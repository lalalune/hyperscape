/**
 * Sound Effects Generation API Routes
 * ElevenLabs text-to-sound-effects integration for game audio
 */

import { Hono } from 'hono'
import { SoundEffectsService } from '../services/SoundEffectsService.mjs'
import { requireAuth } from '../middleware/auth-hono.mjs'
import { resolveElevenLabsKey } from '../middleware/api-key-resolver-hono.mjs'

const router = new Hono()

/**
 * POST /api/sfx/generate
 * Generate sound effect from text description
 *
 * Body:
 * - text: Description of the sound effect (required)
 * - durationSeconds: Optional duration (0.5-22 seconds, default: auto)
 * - promptInfluence: Optional 0-1 value (default: 0.3)
 * - loop: Optional boolean for seamless looping (default: false)
 *
 * Returns: Audio file (MP3) as binary data
 */
router.post('/generate', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    const { text, durationSeconds, promptInfluence, loop } = await c.req.json()

    // Validation
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return c.json({
        error: "Invalid input: 'text' must be a non-empty string",
        code: 'SFX_4000'
      }, 400)
    }

    if (durationSeconds !== undefined && durationSeconds !== null) {
      if (typeof durationSeconds !== 'number' || durationSeconds < 0.5 || durationSeconds > 22) {
        return c.json({
          error: "Invalid input: 'durationSeconds' must be between 0.5 and 22",
          code: 'SFX_4001'
        }, 400)
      }
    }

    if (promptInfluence !== undefined && promptInfluence !== null) {
      if (typeof promptInfluence !== 'number' || promptInfluence < 0 || promptInfluence > 1) {
        return c.json({
          error: "Invalid input: 'promptInfluence' must be between 0 and 1",
          code: 'SFX_4002'
        }, 400)
      }
    }

    // Use resolved API key from middleware
    const apiKey = c.get('resolvedApiKeys').elevenlabs

    console.log(`[SFX] Generating sound effect: "${text.substring(0, 50)}..."`)

    // Create service instance with user's API key
    const userSfxService = new SoundEffectsService(apiKey)
    const audioBuffer = await userSfxService.generateSoundEffect({
      text,
      durationSeconds,
      promptInfluence,
      loop
    })

    // Return audio file directly
    console.log(`[SFX] Sound effect generated successfully: ${audioBuffer.length} bytes`)

    c.header('Content-Type', 'audio/mpeg')
    c.header('Content-Length', String(audioBuffer.length))
    c.header('Cache-Control', 'public, max-age=31536000')
    c.header('Content-Disposition', `attachment; filename="sfx-${Date.now()}.mp3"`)

    return c.body(audioBuffer)
  } catch (error) {
    console.error('[SFX] Sound effect generation failed:', error)
    return c.json({
      error: 'Failed to generate sound effect',
      code: 'SFX_5001',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/sfx/batch
 * Batch generate multiple sound effects
 *
 * Body:
 * - effects: Array of { text, durationSeconds?, promptInfluence?, loop? }
 *
 * Returns: JSON with results array
 */
router.post('/batch', requireAuth, resolveElevenLabsKey, async (c) => {
  try {
    const { effects } = await c.req.json()

    // Validation
    if (!Array.isArray(effects) || effects.length === 0) {
      return c.json({
        error: "Invalid input: 'effects' must be a non-empty array",
        code: 'SFX_4010'
      }, 400)
    }

    if (effects.length > 20) {
      return c.json({
        error: "Invalid input: Maximum 20 effects per batch",
        code: 'SFX_4011'
      }, 400)
    }

    // Validate each effect
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i]
      if (!effect.text || typeof effect.text !== 'string' || effect.text.trim() === '') {
        return c.json({
          error: `Invalid input: effects[${i}].text must be a non-empty string`,
          code: 'SFX_4012'
        }, 400)
      }
    }

    // Use resolved API key from middleware
    const apiKey = c.get('resolvedApiKeys').elevenlabs

    console.log(`[SFX] Batch generating ${effects.length} sound effects`)

    // Create service instance with user's API key
    const userSfxService = new SoundEffectsService(apiKey)
    const results = await userSfxService.generateSoundEffectBatch(effects)

    // Convert audio buffers to base64 for JSON response
    const formattedResults = {
      ...results,
      effects: results.effects.map(effect => ({
        ...effect,
        audioBuffer: effect.audioBuffer ? effect.audioBuffer.toString('base64') : undefined
      }))
    }

    console.log(`[SFX] Batch generation complete: ${results.successful}/${results.total}`)

    return c.json(formattedResults)
  } catch (error) {
    console.error('[SFX] Batch generation failed:', error)
    return c.json({
      error: 'Failed to generate sound effect batch',
      code: 'SFX_5011',
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/sfx/estimate
 * Estimate cost for sound effect generation
 *
 * Query:
 * - duration: Optional duration in seconds (auto if not specified)
 *
 * Returns: { duration, credits, estimatedCostUSD }
 */
router.get('/estimate', async (c) => {
  try {
    const durationStr = c.req.query('duration')
    const duration = durationStr ? parseFloat(durationStr) : null

    if (duration !== null && (isNaN(duration) || duration < 0.5 || duration > 22)) {
      return c.json({
        error: "Invalid input: 'duration' must be between 0.5 and 22 seconds",
        code: 'SFX_4020'
      }, 400)
    }

    // Create a service instance without API key for estimation
    const sfxService = new SoundEffectsService()
    const estimate = sfxService.estimateCost(duration)

    return c.json(estimate)
  } catch (error) {
    console.error('[SFX] Cost estimation failed:', error)
    return c.json({
      error: 'Failed to estimate cost',
      code: 'SFX_5020',
      details: error.message
    }, 500)
  }
})

export default router
