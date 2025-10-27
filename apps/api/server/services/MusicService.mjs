/**
 * Music Generation Service
 *
 * Handles ElevenLabs music generation for game soundtracks and ambient music.
 *
 * Features:
 * - Generate music from text prompts
 * - Stream music generation for real-time playback
 * - Detailed music generation with metadata
 * - Create composition plans for structured music
 * - Support for instrumental and vocal tracks
 *
 * Used by: music.mjs API routes
 */

import { ElevenLabsClient } from 'elevenlabs'
import { asyncPool, retryWithBackoff } from '../utils/concurrency.mjs'
import { createLogger, PerformanceTimer } from '../utils/logger.mjs'

const logger = createLogger('MusicService')

// Concurrency configuration for music generation
const MAX_CONCURRENT_MUSIC_REQUESTS = 2 // Music generation is resource-intensive

// Retry configuration for rate limits and transient errors
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  maxDelayMs: 15000,
  retryableErrors: ['429', 'system_busy', 'rate_limit', 'ECONNRESET', 'ETIMEDOUT', 'quota_exceeded']
}

export class MusicService {
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
      logger.info(`ElevenLabs Music client initialized ${apiKeyOverride ? '(user key)' : '(env var)'}`)
    }

    // Rate limit tracking
    this.rateLimitInfo = {
      currentConcurrentRequests: 0,
      remainingCapacity: 0,
      lastUpdated: null
    }
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return this.client !== null
  }

  /**
   * Generate music from a text prompt
   *
   * @param {Object} options - Generation options
   * @param {string} options.prompt - Text description of desired music
   * @param {number} [options.musicLengthMs] - Length of music in milliseconds
   * @param {string} [options.modelId='music_v1'] - Model to use for generation
   * @param {boolean} [options.forceInstrumental=false] - Force instrumental (no vocals)
   * @param {boolean} [options.respectSectionsDurations=false] - Respect section durations
   * @param {boolean} [options.storeForInpainting=false] - Store for later inpainting
   * @param {Object} [options.compositionPlan] - Detailed composition plan
   * @param {string} [options.outputFormat='mp3_44100_128'] - Output audio format
   * @returns {Promise<Buffer>} - Audio data as buffer
   */
  async generateMusic(options) {
    if (!this.isAvailable()) {
      throw new Error('Music generation service is not available - API key not configured')
    }

    const timer = new PerformanceTimer()
    const {
      prompt,
      musicLengthMs,
      modelId = 'music_v1',
      forceInstrumental = false,
      respectSectionsDurations = false,
      storeForInpainting = false,
      compositionPlan,
      outputFormat = 'mp3_44100_128'
    } = options

    try {
      logger.info('Generating music', {
        promptLength: prompt?.length || 0,
        musicLengthMs,
        forceInstrumental,
        hasCompositionPlan: !!compositionPlan
      })

      // Use retry logic for music generation
      const audioBuffer = await retryWithBackoff(async () => {
        const response = await this.client.music.compose({
          prompt: prompt || undefined,
          compositionPlan: compositionPlan || undefined,
          musicLengthMs: musicLengthMs || undefined,
          modelId,
          forceInstrumental,
          respectSectionsDurations,
          storeForInpainting,
          outputFormat
        })

        // Convert audio stream to buffer
        const chunks = []
        for await (const chunk of response) {
          chunks.push(chunk)
        }
        return Buffer.concat(chunks)
      }, DEFAULT_RETRY_CONFIG)

      const duration = timer.elapsed()
      logger.info('Music generated successfully', {
        durationMs: duration,
        audioSizeKb: Math.round(audioBuffer.length / 1024)
      })

      return audioBuffer
    } catch (error) {
      logger.error('Music generation failed', {
        error: error.message,
        prompt: prompt?.substring(0, 100),
        durationMs: timer.elapsed()
      })
      throw error
    }
  }

  /**
   * Generate music with detailed response (includes metadata)
   *
   * @param {Object} options - Generation options (same as generateMusic)
   * @returns {Promise<Object>} - Object with { audio: Buffer, metadata: Object }
   */
  async generateMusicDetailed(options) {
    if (!this.isAvailable()) {
      throw new Error('Music generation service is not available - API key not configured')
    }

    const timer = new PerformanceTimer()
    const {
      prompt,
      musicLengthMs,
      modelId = 'music_v1',
      forceInstrumental = false,
      storeForInpainting = false,
      compositionPlan,
      outputFormat = 'mp3_44100_128'
    } = options

    try {
      logger.info('Generating detailed music', {
        promptLength: prompt?.length || 0,
        musicLengthMs
      })

      const response = await retryWithBackoff(async () => {
        return await this.client.music.composeDetailed({
          prompt: prompt || undefined,
          compositionPlan: compositionPlan || undefined,
          musicLengthMs: musicLengthMs || undefined,
          modelId,
          forceInstrumental,
          storeForInpainting,
          outputFormat
        })
      }, DEFAULT_RETRY_CONFIG)

      // Convert audio stream to buffer
      const chunks = []
      for await (const chunk of response.audio) {
        chunks.push(chunk)
      }
      const audioBuffer = Buffer.concat(chunks)

      const duration = timer.elapsed()
      logger.info('Detailed music generated successfully', {
        durationMs: duration,
        audioSizeKb: Math.round(audioBuffer.length / 1024)
      })

      return {
        audio: audioBuffer,
        metadata: response.metadata || {}
      }
    } catch (error) {
      logger.error('Detailed music generation failed', {
        error: error.message,
        durationMs: timer.elapsed()
      })
      throw error
    }
  }

  /**
   * Create a composition plan from a prompt
   * This doesn't cost any credits, just generates the plan structure
   *
   * @param {Object} options - Plan options
   * @param {string} options.prompt - Text description of desired music
   * @param {number} [options.musicLengthMs] - Target length in milliseconds
   * @param {Object} [options.sourceCompositionPlan] - Existing plan to modify
   * @param {string} [options.modelId='music_v1'] - Model to use
   * @returns {Promise<Object>} - Composition plan object
   */
  async createCompositionPlan(options) {
    if (!this.isAvailable()) {
      throw new Error('Music generation service is not available - API key not configured')
    }

    const timer = new PerformanceTimer()
    const {
      prompt,
      musicLengthMs,
      sourceCompositionPlan,
      modelId = 'music_v1'
    } = options

    try {
      logger.info('Creating composition plan', {
        promptLength: prompt.length,
        musicLengthMs,
        hasSourcePlan: !!sourceCompositionPlan
      })

      const plan = await retryWithBackoff(async () => {
        return await this.client.music.compositionPlan.create({
          prompt,
          musicLengthMs: musicLengthMs || undefined,
          sourceCompositionPlan: sourceCompositionPlan || undefined,
          modelId
        })
      }, DEFAULT_RETRY_CONFIG)

      const duration = timer.elapsed()
      logger.info('Composition plan created successfully', {
        durationMs: duration,
        sectionsCount: plan.sections?.length || 0
      })

      return plan
    } catch (error) {
      logger.error('Composition plan creation failed', {
        error: error.message,
        durationMs: timer.elapsed()
      })
      throw error
    }
  }

  /**
   * Generate multiple music tracks in parallel with controlled concurrency
   *
   * @param {Array<Object>} requests - Array of generation requests
   * @returns {Promise<Array<Object>>} - Array of results { audio: Buffer, request: Object, error?: Error }
   */
  async generateBatch(requests) {
    if (!this.isAvailable()) {
      throw new Error('Music generation service is not available - API key not configured')
    }

    logger.info(`Starting batch music generation for ${requests.length} tracks`)

    const results = await asyncPool(
      MAX_CONCURRENT_MUSIC_REQUESTS,
      requests,
      async (request, index) => {
        try {
          const audio = await this.generateMusic(request)
          return {
            audio,
            request,
            success: true
          }
        } catch (error) {
          logger.error(`Batch music generation failed for request ${index}`, {
            error: error.message,
            prompt: request.prompt?.substring(0, 100)
          })
          return {
            audio: null,
            request,
            success: false,
            error: error.message
          }
        }
      }
    )

    const successCount = results.filter(r => r.success).length
    logger.info(`Batch music generation complete: ${successCount}/${requests.length} successful`)

    return results
  }

  /**
   * Get service status and rate limit info
   */
  getStatus() {
    return {
      available: this.isAvailable(),
      rateLimit: this.rateLimitInfo
    }
  }
}

// Export singleton instance
// MIGRATION NOTE: Removed global instance to support per-user API keys.
// 
// WHY: Each user can now provide their own OpenAI API key for music generation.
// Services must create isolated instances per request to prevent key leakage between users.
//
// HOW TO USE:
// 1. Create a new MusicService instance per request (not shared/cached)
// 2. Pass the user's API key override via constructor options: { apiKeyOverride: userApiKey }
// 3. Call service methods normally (generateMusic, etc.)
// 4. The instance will use the user's key if provided, falling back to system key
//
// EXAMPLE USAGE (in words):
// In your route handler, instantiate new MusicService with options object containing
// apiKeyOverride field set to the user's OpenAI key (from resolveApiKeys middleware).
// Then call generateMusic() or other methods. Each request gets a fresh instance with
// the appropriate API key context.
