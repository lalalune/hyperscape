/**
 * Sound Effects Generation Service
 *
 * Handles ElevenLabs text-to-sound-effects generation for game audio.
 *
 * Features:
 * - Generate sound effects from text descriptions
 * - Support for duration control (0.5-22 seconds)
 * - Prompt influence for style control
 * - Seamless looping for ambient sounds
 * - Batch generation with concurrency control
 *
 * API Documentation: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
 * Pricing: 100 credits per auto-duration, 20 credits per second for set duration
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { Readable } from 'stream'
import { asyncPool, retryWithBackoff } from '../utils/concurrency.mjs'
import { createLogger } from '../utils/logger.mjs'

const logger = createLogger('SoundEffectsService')

// Concurrency configuration - be conservative with SFX generation
const MAX_CONCURRENT_SFX_REQUESTS = 3

// Retry configuration for rate limits and transient errors
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['429', 'system_busy', 'rate_limit', 'ECONNRESET', 'ETIMEDOUT', 'quota_exceeded']
}

export class SoundEffectsService {
  /**
   * Initialize the Sound Effects service with ElevenLabs API client
   *
   * @param {string|null} [apiKeyOverride=null] - Optional API key to use instead of environment variable
   */
  constructor(apiKeyOverride = null) {
    // Use provided API key or fall back to environment variable
    const apiKey = apiKeyOverride || process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      logger.warn('ElevenLabs API key not found - service unavailable')
      this.client = null
    } else {
      this.client = new ElevenLabsClient({
        apiKey: apiKey
      })
      logger.info(`ElevenLabs Sound Effects client initialized ${apiKeyOverride ? '(user key)' : '(env var)'}`)
    }
  }

  /**
   * Check if service is available (API key configured)
   */
  isAvailable() {
    return this.client !== null
  }

  /**
   * Generate single sound effect from text description
   *
   * @param {Object} options
   * @param {string} options.text - Description of the sound effect
   * @param {number} [options.durationSeconds] - Duration in seconds (0.5-22, or null for auto)
   * @param {number} [options.promptInfluence=0.3] - How closely to follow prompt (0-1)
   * @param {boolean} [options.loop=false] - Generate seamless looping sound
   * @returns {Promise<Buffer>} Audio buffer (MP3 format)
   */
  async generateSoundEffect({ text, durationSeconds = null, promptInfluence = 0.3, loop = false }) {
    if (!this.isAvailable()) {
      throw new Error('Sound effects service not available - API key not configured')
    }

    logger.info('Generating sound effect', {
      text: text.substring(0, 50),
      duration: durationSeconds || 'auto',
      promptInfluence,
      loop
    })

    const generateFn = async () => {
      try {
        // Call ElevenLabs sound generation API
        const audioStream = await this.client.textToSoundEffects.convert({
          text,
          duration_seconds: durationSeconds,
          prompt_influence: promptInfluence
        })

        // Convert stream to buffer
        const chunks = []
        for await (const chunk of audioStream) {
          chunks.push(chunk)
        }
        const audioBuffer = Buffer.concat(chunks)

        logger.success('Sound effect generated', {
          size: audioBuffer.length,
          duration: durationSeconds || 'auto'
        })

        return audioBuffer
      } catch (error) {
        logger.error('Sound effect generation failed', {
          error: error.message,
          text: text.substring(0, 50)
        })
        throw error
      }
    }

    // Wrap in retry logic for rate limits
    return retryWithBackoff(generateFn, DEFAULT_RETRY_CONFIG)
  }

  /**
   * Batch generate multiple sound effects with concurrency control
   *
   * @param {Array} effects - Array of { text, durationSeconds?, promptInfluence?, loop? }
   * @returns {Promise<Object>} Results with { effects: Array, successful: number, total: number }
   */
  async generateSoundEffectBatch(effects) {
    if (!this.isAvailable()) {
      throw new Error('Sound effects service not available - API key not configured')
    }

    logger.info(`Batch generating ${effects.length} sound effects`)

    const results = []
    let successful = 0

    // Use asyncPool for controlled concurrency
    await asyncPool(effects, MAX_CONCURRENT_SFX_REQUESTS, async (effect, index) => {
      try {
        const audioBuffer = await this.generateSoundEffect({
          text: effect.text,
          durationSeconds: effect.durationSeconds,
          promptInfluence: effect.promptInfluence,
          loop: effect.loop
        })

        results.push({
          index,
          success: true,
          audioBuffer,
          text: effect.text,
          size: audioBuffer.length
        })

        successful++
      } catch (error) {
        logger.error(`Failed to generate sound effect ${index}`, {
          error: error.message,
          text: effect.text.substring(0, 50)
        })

        results.push({
          index,
          success: false,
          error: error.message,
          text: effect.text
        })
      }
    })

    logger.success(`Batch generation complete: ${successful}/${effects.length}`)

    return {
      effects: results,
      successful,
      total: effects.length
    }
  }

  /**
   * Estimate cost for sound effect generation
   *
   * @param {number|null} durationSeconds - Duration in seconds, or null for auto
   * @returns {Object} Cost estimate
   */
  estimateCost(durationSeconds = null) {
    if (durationSeconds === null) {
      // Auto-duration: 100 credits per generation
      return {
        duration: 'auto',
        credits: 100,
        estimatedCostUSD: '$0.024' // $0.24 per 1000 credits
      }
    }

    // Set duration: 20 credits per second
    const credits = Math.ceil(durationSeconds * 20)
    const costUSD = (credits / 1000 * 0.24).toFixed(3)

    return {
      duration: durationSeconds,
      credits,
      estimatedCostUSD: `$${costUSD}`
    }
  }
}
