/**
 * Sound Effects Generation API Routes
 * ElevenLabs text-to-sound-effects integration for game audio
 */

import express from 'express'
import { SoundEffectsService } from '../services/SoundEffectsService.mjs'
import { requireAuth } from '../middleware/auth.mjs'
import { resolveElevenLabsKey } from '../middleware/api-key-resolver.mjs'

const router = express.Router()

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
router.post('/generate', requireAuth, resolveElevenLabsKey, async (req, res) => {
  try {
    const { text, durationSeconds, promptInfluence, loop } = req.body

    // Validation
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({
        error: "Invalid input: 'text' must be a non-empty string",
        code: 'SFX_4000'
      })
    }

    if (durationSeconds !== undefined && durationSeconds !== null) {
      if (typeof durationSeconds !== 'number' || durationSeconds < 0.5 || durationSeconds > 22) {
        return res.status(400).json({
          error: "Invalid input: 'durationSeconds' must be between 0.5 and 22",
          code: 'SFX_4001'
        })
      }
    }

    if (promptInfluence !== undefined && promptInfluence !== null) {
      if (typeof promptInfluence !== 'number' || promptInfluence < 0 || promptInfluence > 1) {
        return res.status(400).json({
          error: "Invalid input: 'promptInfluence' must be between 0 and 1",
          code: 'SFX_4002'
        })
      }
    }

    // Use resolved API key from middleware
    const apiKey = req.resolvedApiKeys.elevenlabs

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
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'Content-Disposition': `attachment; filename="sfx-${Date.now()}.mp3"`
    })

    console.log(`[SFX] Sound effect generated successfully: ${audioBuffer.length} bytes`)

    return res.send(audioBuffer)
  } catch (error) {
    console.error('[SFX] Sound effect generation failed:', error)
    return res.status(500).json({
      error: 'Failed to generate sound effect',
      code: 'SFX_5001',
      details: error.message
    })
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
router.post('/batch', requireAuth, resolveElevenLabsKey, async (req, res) => {
  try {
    const { effects } = req.body

    // Validation
    if (!Array.isArray(effects) || effects.length === 0) {
      return res.status(400).json({
        error: "Invalid input: 'effects' must be a non-empty array",
        code: 'SFX_4010'
      })
    }

    if (effects.length > 20) {
      return res.status(400).json({
        error: "Invalid input: Maximum 20 effects per batch",
        code: 'SFX_4011'
      })
    }

    // Validate each effect
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i]
      if (!effect.text || typeof effect.text !== 'string' || effect.text.trim() === '') {
        return res.status(400).json({
          error: `Invalid input: effects[${i}].text must be a non-empty string`,
          code: 'SFX_4012'
        })
      }
    }

    // Use resolved API key from middleware
    const apiKey = req.resolvedApiKeys.elevenlabs

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

    return res.json(formattedResults)
  } catch (error) {
    console.error('[SFX] Batch generation failed:', error)
    return res.status(500).json({
      error: 'Failed to generate sound effect batch',
      code: 'SFX_5011',
      details: error.message
    })
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
router.get('/estimate', async (req, res) => {
  try {
    const duration = req.query.duration ? parseFloat(req.query.duration) : null

    if (duration !== null && (isNaN(duration) || duration < 0.5 || duration > 22)) {
      return res.status(400).json({
        error: "Invalid input: 'duration' must be between 0.5 and 22 seconds",
        code: 'SFX_4020'
      })
    }

    const estimate = sfxService.estimateCost(duration)

    return res.json(estimate)
  } catch (error) {
    console.error('[SFX] Cost estimation failed:', error)
    return res.status(500).json({
      error: 'Failed to estimate cost',
      code: 'SFX_5020',
      details: error.message
    })
  }
})

export default router
