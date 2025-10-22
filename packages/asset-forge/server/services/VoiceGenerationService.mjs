/**
 * Voice Generation Service
 *
 * Handles ElevenLabs text-to-speech generation for NPC dialogue.
 *
 * Features:
 * - Browse available voices from ElevenLabs library
 * - Generate speech from text with customizable settings
 * - Batch generation for complete dialogue trees
 * - Save voice clips to NPC asset directories
 *
 * Used by: generate-voice.mjs API routes
 */

import { ElevenLabsClient } from 'elevenlabs'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { asyncPool, retryWithBackoff } from '../utils/concurrency.mjs'
import { createLogger, PerformanceTimer } from '../utils/logger.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logger = createLogger('VoiceGenerationService')

// Concurrency configuration
// Safe limit: 5 concurrent requests works for Creator tier (5) and above
// Free/Starter tiers (2-3) may hit rate limits, but retry logic will handle it
const MAX_CONCURRENT_VOICE_REQUESTS = 5

// Retry configuration for rate limits and transient errors
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['429', 'system_busy', 'rate_limit', 'ECONNRESET', 'ETIMEDOUT', 'quota_exceeded']
}

export class VoiceGenerationService {
  constructor() {
    // Initialize ElevenLabs client
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      logger.warn('ELEVENLABS_API_KEY not found in environment - service unavailable')
      this.client = null
    } else {
      this.client = new ElevenLabsClient({
        apiKey: apiKey
      })
      logger.info('ElevenLabs client initialized successfully')
    }

    // Path to gdd-assets directory
    this.assetsDir = path.join(__dirname, '../../gdd-assets')

    // Rate limit tracking (populated from response headers)
    this.rateLimitInfo = {
      currentConcurrentRequests: 0,
      maximumConcurrentRequests: 0,
      remainingCapacity: 0,
      utilizationPercent: 0,
      tier: null,
      lastUpdated: null
    }
  }

  /**
   * Update rate limit info from response headers
   * ElevenLabs returns: x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset
   * Note: The SDK may not expose headers directly, this is a placeholder for future enhancement
   */
  updateRateLimitInfo(headers = {}) {
    if (!headers || typeof headers !== 'object') {
      return
    }

    const current = parseInt(headers['x-ratelimit-remaining']) || 0
    const max = parseInt(headers['x-ratelimit-limit']) || 0

    if (max > 0) {
      this.rateLimitInfo = {
        currentConcurrentRequests: max - current,
        maximumConcurrentRequests: max,
        remainingCapacity: current,
        utilizationPercent: ((max - current) / max * 100).toFixed(1),
        tier: this.detectTierFromLimit(max),
        lastUpdated: Date.now()
      }

      logger.rateLimit(
        this.rateLimitInfo.currentConcurrentRequests,
        this.rateLimitInfo.maximumConcurrentRequests,
        { tier: this.rateLimitInfo.tier }
      )
    }
  }

  /**
   * Detect ElevenLabs tier from rate limit
   */
  detectTierFromLimit(limit) {
    if (limit <= 2) return 'Free'
    if (limit <= 3) return 'Starter'
    if (limit <= 5) return 'Creator'
    if (limit <= 10) return 'Pro'
    return 'Scale/Business'
  }

  /**
   * Get current rate limit info
   */
  getRateLimitInfo() {
    return { ...this.rateLimitInfo }
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return this.client !== null
  }

  /**
   * Get available voices from ElevenLabs library
   * @returns {Promise<Array>} List of available voices
   */
  async getAvailableVoices() {
    if (!this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    return await logger.time('getAvailableVoices', async () => {
      try {
        const response = await this.client.voices.getAll()

        // Transform to simplified format
        const voices = response.voices.map(voice => ({
          voiceId: voice.voice_id,
          name: voice.name,
          category: voice.category || 'general',
          description: voice.description || '',
          labels: voice.labels || {},
          previewUrl: voice.preview_url,
          samples: voice.samples || []
        }))

        logger.info('Fetched voice library', { voiceCount: voices.length })
        return voices
      } catch (error) {
        logger.error('Failed to fetch voices', error)
        throw new Error(`Failed to fetch voices: ${error.message}`)
      }
    })
  }

  /**
   * Get user subscription info (quota, usage, tier)
   * Official docs: https://elevenlabs.io/docs/api-reference/get-subscription-info
   * @returns {Promise<Object>} Subscription details
   */
  async getSubscriptionInfo() {
    if (!this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    return await logger.time('getSubscriptionInfo', async () => {
      try {
        const subscription = await this.client.user.getSubscription()

        const result = {
          tier: subscription.tier,
          characterCount: subscription.character_count,
          characterLimit: subscription.character_limit,
          canExtendCharacterLimit: subscription.can_extend_character_limit,
          allowedToExtendCharacterLimit: subscription.allowed_to_extend_character_limit,
          nextCharacterCountResetUnix: subscription.next_character_count_reset_unix,
          voiceLimit: subscription.voice_limit,
          professionalVoiceLimit: subscription.professional_voice_limit,
          canExtendVoiceLimit: subscription.can_extend_voice_limit,
          canUseInstantVoiceCloning: subscription.can_use_instant_voice_cloning,
          canUseProfessionalVoiceCloning: subscription.can_use_professional_voice_cloning,
          availableModels: subscription.available_models || [],
          status: subscription.status
        }

        logger.info('Fetched subscription info', {
          tier: result.tier,
          characterUsage: `${result.characterCount}/${result.characterLimit}`,
          status: result.status
        })

        return result
      } catch (error) {
        logger.error('Failed to fetch subscription info', error)
        throw new Error(`Failed to fetch subscription info: ${error.message}`)
      }
    })
  }

  /**
   * Get available models from ElevenLabs
   * Official docs: https://elevenlabs.io/docs/api-reference/get-models
   * @returns {Promise<Array>} List of available models
   */
  async getAvailableModels() {
    if (!this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    return await logger.time('getAvailableModels', async () => {
      try {
        const models = await this.client.models.getAll()

        const result = models.map(model => ({
          modelId: model.model_id,
          name: model.name,
          description: model.description || '',
          canBeFinetuned: model.can_be_finetuned,
          canDoTextToSpeech: model.can_do_text_to_speech,
          canDoVoiceConversion: model.can_do_voice_conversion,
          canUseStyle: model.can_use_style,
          canUseSpeakerBoost: model.can_use_speaker_boost,
          servesProVoices: model.serves_pro_voices,
          tokenCostFactor: model.token_cost_factor,
          languages: model.languages || []
        }))

        logger.info('Fetched available models', { modelCount: result.length })
        return result
      } catch (error) {
        logger.error('Failed to fetch models', error)
        throw new Error(`Failed to fetch models: ${error.message}`)
      }
    })
  }

  /**
   * Generate speech from text
   * Official docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   * @param {Object} params Generation parameters
   * @param {string} params.text Text to convert to speech
   * @param {string} params.voiceId ElevenLabs voice ID
   * @param {string} [params.modelId='eleven_multilingual_v2'] Model to use
   * @param {string} [params.outputFormat='mp3_44100_128'] Audio format (23 formats available)
   * @param {number} [params.stability=0.5] Voice stability (0-1)
   * @param {number} [params.similarityBoost=0.75] Similarity boost (0-1)
   * @param {number} [params.style=0] Style exaggeration (0-1)
   * @param {boolean} [params.useSpeakerBoost=true] Use speaker boost
   * @returns {Promise<Buffer>} Audio buffer in requested format
   */
  async generateSpeech({
    text,
    voiceId,
    modelId = 'eleven_multilingual_v2',
    outputFormat = 'mp3_44100_128',
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0,
    useSpeakerBoost = true
  }) {
    if (!this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    if (!text || text.trim() === '') {
      throw new Error('Text is required for speech generation')
    }

    if (!voiceId) {
      throw new Error('Voice ID is required')
    }

    const context = {
      voiceId,
      modelId,
      outputFormat,
      textLength: text.length,
      stability,
      similarityBoost,
      style,
      useSpeakerBoost
    }

    return await logger.time('generateSpeech', async () => {
      // Retry with exponential backoff for rate limits and transient errors
      let attemptCount = 0

      return await retryWithBackoff(async () => {
        attemptCount++

        logger.debug(`Requesting speech generation (attempt ${attemptCount})`, context)

        const audioStream = await this.client.textToSpeech.convert(voiceId, {
          text: text,
          model_id: modelId,
          voice_settings: {
            stability: stability,
            similarity_boost: similarityBoost,
            style: style,
            use_speaker_boost: useSpeakerBoost
          },
          output_format: outputFormat
        })

        // Convert stream to buffer
        const chunks = []
        for await (const chunk of audioStream) {
          chunks.push(chunk)
        }
        const audioBuffer = Buffer.concat(chunks)

        logger.info('Speech generated successfully', {
          ...context,
          audioBytes: audioBuffer.length,
          attempts: attemptCount
        })

        return audioBuffer
      }, {
        maxAttempts: DEFAULT_RETRY_CONFIG.maxAttempts,
        baseDelayMs: DEFAULT_RETRY_CONFIG.baseDelayMs,
        maxDelayMs: DEFAULT_RETRY_CONFIG.maxDelayMs,
        shouldRetry: (error) => {
          // Check if error is retryable
          return DEFAULT_RETRY_CONFIG.retryableErrors.some(code =>
            error.message?.toLowerCase().includes(code.toLowerCase()) ||
            error.code?.toLowerCase().includes(code.toLowerCase()) ||
            error.status === 429 ||
            error.statusCode === 429
          )
        },
        onRetry: (attempt, delay, error) => {
          logger.retry(attempt, DEFAULT_RETRY_CONFIG.maxAttempts, delay, error.message, context)
        }
      })
    }, context)
  }

  /**
   * Generate voice clips for entire dialogue tree (PARALLEL)
   * Official docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   *
   * Uses parallel processing with concurrency limit to dramatically improve performance:
   * - Sequential: ~30 seconds for 10 clips
   * - Parallel (5 concurrent): ~6-8 seconds for 10 clips (75% faster)
   *
   * @param {Object} params Generation parameters
   * @param {string} params.npcId NPC identifier
   * @param {Array} params.dialogueNodes Dialogue nodes to generate
   * @param {string} params.voiceId ElevenLabs voice ID
   * @param {Object} [params.settings={}] Voice settings
   * @param {Function} [params.onProgress] Progress callback (current, total)
   * @returns {Promise<Object>} Map of nodeId -> clip metadata
   */
  async generateDialogueVoices({
    npcId,
    dialogueNodes,
    voiceId,
    settings = {},
    onProgress = null
  }) {
    if (!this.client) {
      throw new Error('ElevenLabs API key not configured')
    }

    if (!npcId) {
      throw new Error('NPC ID is required')
    }

    if (!Array.isArray(dialogueNodes) || dialogueNodes.length === 0) {
      throw new Error('Dialogue nodes array is required and must not be empty')
    }

    if (!voiceId) {
      throw new Error('Voice ID is required')
    }

    const timer = new PerformanceTimer(logger, 'generateDialogueVoices')

    logger.info('Starting parallel batch voice generation', {
      npcId,
      voiceId,
      nodeCount: dialogueNodes.length,
      concurrencyLimit: MAX_CONCURRENT_VOICE_REQUESTS,
      settings
    })

    // Create voice directory for this NPC
    const npcVoiceDir = path.join(this.assetsDir, npcId, 'voice')
    const resolvedNpcVoiceDir = path.resolve(npcVoiceDir)
    if (!resolvedNpcVoiceDir.startsWith(path.resolve(this.assetsDir))) {
      throw new Error('Invalid NPC ID: Path traversal detected')
    }
    await fs.mkdir(resolvedNpcVoiceDir, { recursive: true })

    timer.checkpoint('directory-created')

    const total = dialogueNodes.length
    let completed = 0

    // Process dialogue nodes in parallel with concurrency limit
    const results = await asyncPool(MAX_CONCURRENT_VOICE_REQUESTS, dialogueNodes, async (node, index) => {
      try {
        // Generate audio
        const audioBuffer = await this.generateSpeech({
          text: node.text,
          voiceId,
          ...settings
        })

        // Save to file
        const filename = `${node.id}.mp3`
        const filepath = path.join(resolvedNpcVoiceDir, filename)
        await fs.writeFile(filepath, audioBuffer)

        // Update progress
        completed++
        if (onProgress) {
          onProgress(completed, total)
        }

        logger.debug('Generated voice clip', {
          nodeId: node.id,
          progress: `${completed}/${total}`,
          fileSize: audioBuffer.length
        })

        return {
          success: true,
          nodeId: node.id,
          clip: {
            nodeId: node.id,
            text: node.text,
            audioUrl: `voice/${filename}`,
            filepath: filepath,
            fileSize: audioBuffer.length,
            generatedAt: new Date().toISOString()
          }
        }
      } catch (error) {
        completed++
        if (onProgress) {
          onProgress(completed, total)
        }

        logger.error('Failed to generate voice clip', error, {
          nodeId: node.id,
          progress: `${completed}/${total}`
        })

        return {
          success: false,
          nodeId: node.id,
          clip: {
            nodeId: node.id,
            text: node.text,
            audioUrl: '', // Empty string to maintain type consistency (failed generation)
            fileSize: 0, // Zero bytes for failed generation
            generatedAt: new Date().toISOString(),
            error: error.message
          }
        }
      }
    })

    timer.checkpoint('clips-generated')

    // Build clips map from results
    const clips = {}
    let successCount = 0
    let failureCount = 0

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { nodeId, clip, success } = result.value
        clips[nodeId] = clip
        if (success) {
          successCount++
        } else {
          failureCount++
        }
      } else {
        // Promise rejected (shouldn't happen with our error handling, but be safe)
        logger.error('Unexpected promise rejection in batch generation', result.reason)
        failureCount++
      }
    }

    timer.checkpoint('results-processed')

    // Get total duration before saving metadata
    const totalDuration = timer.end({
      npcId,
      voiceId,
      nodeCount: total,
      successCount,
      failureCount,
      successRate: `${((successCount / total) * 100).toFixed(1)}%`
    })

    // Save voice profile metadata with actual duration
    const voiceProfilePath = path.join(npcVoiceDir, 'voiceProfile.json')
    const voiceProfile = {
      npcId,
      voiceId,
      voiceName: 'Unknown', // Will be filled in by frontend
      settings: settings,
      clips: successCount,
      generatedAt: new Date().toISOString(),
      metadata: {
        totalRequested: total,
        successCount,
        failureCount,
        durationSeconds: (totalDuration / 1000).toFixed(2),
        concurrencyLimit: MAX_CONCURRENT_VOICE_REQUESTS
      }
    }
    await fs.writeFile(voiceProfilePath, JSON.stringify(voiceProfile, null, 2))

    timer.checkpoint('metadata-saved')

    logger.info('Batch voice generation completed', {
      npcId,
      totalGenerated: successCount,
      totalFailed: failureCount,
      totalRequested: total,
      durationSeconds: voiceProfile.metadata.durationSeconds,
      concurrencyLimit: MAX_CONCURRENT_VOICE_REQUESTS
    })

    return {
      npcId,
      voiceId,
      clips,
      totalGenerated: successCount,
      totalRequested: total,
      metadata: {
        durationSeconds: parseFloat(voiceProfile.metadata.durationSeconds),
        successCount,
        failureCount,
        concurrencyLimit: MAX_CONCURRENT_VOICE_REQUESTS
      }
    }
  }

  /**
   * Get voice clip metadata for an NPC
   * @param {string} npcId NPC identifier
   * @returns {Promise<Object|null>} Voice profile or null
   */
  async getVoiceProfile(npcId) {
    const candidatePath = path.join(this.assetsDir, npcId, 'voice', 'voiceProfile.json')
    const voiceProfilePath = path.resolve(candidatePath)
    // Prevent directory traversal: check normalized path is within assetsDir
    if (!voiceProfilePath.startsWith(this.assetsDir + path.sep)) {
      logger.warn('Blocked attempt to access voice profile outside assetsDir', { npcId, voiceProfilePath })
      throw new Error('Invalid NPC ID or access denied')
    }

    try {
      const data = await fs.readFile(voiceProfilePath, 'utf-8')
      const profile = JSON.parse(data)
      logger.debug('Retrieved voice profile', { npcId, clipCount: profile.clips })
      return profile
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug('No voice profile found', { npcId })
        return null // No voice profile exists
      }
      logger.error('Failed to read voice profile', error, { npcId })
      throw error
    }
  }

  /**
   * Delete voice clips for an NPC
   * @param {string} npcId NPC identifier
   * @returns {Promise<boolean>} Success status
   */
  async deleteVoiceClips(npcId) {
    const candidateDir = path.join(this.assetsDir, npcId, 'voice')
    const npcVoiceDir = path.resolve(candidateDir)
    // Prevent directory traversal: check normalized path is within assetsDir
    if (!npcVoiceDir.startsWith(this.assetsDir + path.sep)) {
      logger.warn('Blocked attempt to delete voice clips outside assetsDir', { npcId, npcVoiceDir })
      return false
    }

    try {
      await fs.rm(npcVoiceDir, { recursive: true, force: true })
      logger.info('Deleted voice clips', { npcId, directory: npcVoiceDir })
      return true
    } catch (error) {
      logger.error('Failed to delete voice clips', error, { npcId })
      return false
    }
  }

  /**
   * Get estimated cost for generation
   * @param {number} characterCount Total characters to generate
   * @param {string} [modelId='eleven_multilingual_v2'] Model ID
   * @returns {Object} Cost estimate
   */
  estimateCost(characterCount, modelId = 'eleven_multilingual_v2') {
    // ElevenLabs pricing (as of 2025):
    // - Multilingual v2: 1 character = 1 credit
    // - Turbo v2.5/Flash v2.5: 0.5 character = 1 credit

    let creditsPerChar = 1
    if (modelId.includes('turbo') || modelId.includes('flash')) {
      creditsPerChar = 0.5
    }

    const totalCredits = Math.ceil(characterCount * creditsPerChar)

    // Approximate cost (varies by plan)
    // Assuming $0.30 per 1000 characters (average rate)
    const estimatedCostUSD = (characterCount / 1000) * 0.30

    const estimate = {
      characterCount,
      modelId,
      creditsRequired: totalCredits,
      estimatedCostUSD: estimatedCostUSD.toFixed(4)
    }

    logger.debug('Cost estimate calculated', estimate)

    return estimate
  }
}
