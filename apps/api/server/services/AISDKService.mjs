/**
 * AI SDK Service
 * Unified AI service using Vercel AI SDK v5
 * Replaces direct OpenAI API calls with the AI SDK
 *
 * Supports:
 * - Direct provider access (OpenAI, Anthropic)
 * - Vercel AI Gateway for unified access to all providers
 * - Usage tracking and analytics
 * - Cost optimization
 */

import { generateText, experimental_generateImage as generateImage, gateway } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { getGenerationPrompts, getGPT4EnhancementPrompts } from '../utils/promptLoader.mjs'

export class AISDKService {
  constructor(config = {}) {
    this.config = config
    this.useGateway = this.shouldUseGateway()
    this.modelConfigCache = new Map() // Cache for model configurations
    this.cacheExpiry = 5 * 60 * 1000 // 5 minutes

    // Store API key overrides (for per-user keys)
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY
    this.anthropicApiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY

    // Check for required API keys
    if (!this.useGateway && !this.openaiApiKey) {
      console.warn('[AISDKService] Missing OpenAI API key - some features will be limited')
    }

    if (this.useGateway) {
      console.log('[AISDKService] Using Vercel AI Gateway for model access')
    } else {
      console.log(`[AISDKService] Using direct provider access ${config.openaiApiKey ? '(user key)' : '(env var)'}`)
    }
  }

  /**
   * Get configured model for a specific task type
   * Falls back to default if not configured
   * @param {string} taskType - Type of task (e.g., 'prompt-enhancement', 'image-generation')
   * @param {string} defaultModelId - Default model to use if not configured
   * @param {string} defaultProvider - Default provider
   */
  async getConfiguredModel(taskType, defaultModelId, defaultProvider = 'openai') {
    try {
      // Check cache first
      const cacheKey = `model_${taskType}`
      const cached = this.modelConfigCache.get(cacheKey)

      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return this.getModel(cached.modelId, cached.provider)
      }

      // Fetch from database
      const { db } = await import('../database/db.mjs')
      const result = await db.query(`
        SELECT model_id, provider, temperature, max_tokens
        FROM model_configurations
        WHERE task_type = $1 AND is_active = true
        LIMIT 1
      `, [taskType])

      if (result.rows.length > 0) {
        const config = result.rows[0]

        // Cache the result
        this.modelConfigCache.set(cacheKey, {
          modelId: config.model_id,
          provider: config.provider,
          temperature: parseFloat(config.temperature),
          maxTokens: config.max_tokens,
          timestamp: Date.now()
        })

        return this.getModel(config.model_id, config.provider)
      }
    } catch (error) {
      console.warn(`Failed to fetch configured model for ${taskType}:`, error.message)
    }

    // Fall back to default
    return this.getModel(defaultModelId, defaultProvider)
  }

  /**
   * Get model configuration settings (temperature, maxTokens)
   * @param {string} taskType - Type of task
   */
  async getModelSettings(taskType) {
    try {
      const cacheKey = `model_${taskType}`
      const cached = this.modelConfigCache.get(cacheKey)

      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return {
          temperature: cached.temperature,
          maxTokens: cached.maxTokens
        }
      }

      const { db } = await import('../database/db.mjs')
      const result = await db.query(`
        SELECT temperature, max_tokens
        FROM model_configurations
        WHERE task_type = $1 AND is_active = true
        LIMIT 1
      `, [taskType])

      if (result.rows.length > 0) {
        return {
          temperature: parseFloat(result.rows[0].temperature),
          maxTokens: result.rows[0].max_tokens
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch model settings for ${taskType}:`, error.message)
    }

    // Return defaults
    return {
      temperature: 0.7,
      maxTokens: null
    }
  }

  /**
   * Clear model configuration cache
   */
  clearModelCache() {
    this.modelConfigCache.clear()
  }

  /**
   * Determine if we should use the AI Gateway
   * Gateway is used if AI_GATEWAY_API_KEY is set or running on Vercel (OIDC)
   */
  shouldUseGateway() {
    return !!(
      process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_ENV // Deployed on Vercel with OIDC
    )
  }

  /**
   * Get the appropriate model based on gateway availability
   * @param {string} modelId - Model identifier (e.g., 'gpt-4', 'openai/gpt-4')
   * @param {string} provider - Provider name (e.g., 'openai', 'anthropic')
   */
  getModel(modelId, provider = 'openai') {
    if (this.useGateway) {
      // Use gateway format: creator/model-name
      const gatewayModelId = modelId.includes('/') ? modelId : `${provider}/${modelId}`
      return gateway(gatewayModelId)
    }

    // Direct provider access with user API keys
    if (provider === 'openai') {
      // Create openai provider with custom API key if available
      const providerInstance = this.openaiApiKey 
        ? openai.with({ apiKey: this.openaiApiKey })
        : openai
      return providerInstance(modelId.replace('openai/', ''))
    } else if (provider === 'anthropic') {
      // Create anthropic provider with custom API key if available
      const providerInstance = this.anthropicApiKey
        ? anthropic.with({ apiKey: this.anthropicApiKey })
        : anthropic
      return providerInstance(modelId.replace('anthropic/', ''))
    }

    throw new Error(`Unsupported provider: ${provider}`)
  }

  /**
   * Get usage tracking options for requests
   * @param {string} userId - User identifier for tracking
   * @param {Array<string>} tags - Tags for categorizing usage
   */
  getProviderOptions(userId, tags = []) {
    if (!this.useGateway) {
      return {}
    }

    return {
      gateway: {
        user: userId,
        tags: tags
      }
    }
  }

  /**
   * Enhance prompt using GPT-4 with AI SDK
   * @param {string} description - Original asset description
   * @param {object} assetConfig - Asset configuration
   * @param {string} userId - Optional user ID for tracking
   */
  async enhancePromptWithGPT4(description, assetConfig, userId = null) {
    if (!this.useGateway && !process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY or AI_GATEWAY_API_KEY required for GPT-4 enhancement')
    }

    // Load GPT-4 enhancement prompts
    const gpt4Prompts = await getGPT4EnhancementPrompts()

    const isAvatar = assetConfig.generationType === 'avatar' || assetConfig.type === 'character'
    const isArmor = assetConfig.type === 'armor'
    const isChestArmor = isArmor && (assetConfig.subtype?.toLowerCase().includes('chest') || assetConfig.subtype?.toLowerCase().includes('body'))

    // Build system prompt from loaded prompts
    let systemPrompt = gpt4Prompts?.systemPrompt?.base || `You are an expert at optimizing prompts for 3D asset generation.
Your task is to enhance the user's description to create better results with image generation and 3D conversion.`

    if (isAvatar) {
      systemPrompt += '\n' + (gpt4Prompts?.typeSpecific?.avatar?.critical || `CRITICAL for characters: The character MUST be in a T-pose (arms stretched out horizontally, legs slightly apart) for proper rigging. The character must have EMPTY HANDS - no weapons, tools, or held items. Always add "standing in T-pose with empty hands" to the description.`)
    }

    if (isArmor) {
      systemPrompt += '\n' + (gpt4Prompts?.typeSpecific?.armor?.base || `CRITICAL for armor pieces: The armor must be shown ALONE without any armor stand, mannequin, or body inside.`)
      if (isChestArmor) {
        systemPrompt += ' ' + (gpt4Prompts?.typeSpecific?.armor?.chest || 'EXTRA IMPORTANT for chest/body armor: This MUST be shaped for a SCARECROW POSE (T-POSE)...')
      }
      systemPrompt += ' ' + (gpt4Prompts?.typeSpecific?.armor?.positioning || 'The armor MUST be positioned and SHAPED for a SCARECROW/T-POSE body...')
    }

    // Add focus points
    const focusPoints = gpt4Prompts?.systemPrompt?.focusPoints || [
      'Clear, specific visual details',
      'Material and texture descriptions',
      'Geometric shape and form',
      `Style consistency (especially for ${assetConfig.style || 'low-poly RuneScape'} style)`
    ]

    systemPrompt += '\nFocus on:\n' + focusPoints.map(point => '- ' + point.replace('${config.style || \'low-poly RuneScape\'}', assetConfig.style || 'low-poly RuneScape')).join('\n')

    if (isAvatar) {
      systemPrompt += '\n' + (gpt4Prompts?.typeSpecific?.avatar?.focus || '- T-pose stance with empty hands for rigging compatibility')
    }

    if (isArmor) {
      const armorFocus = gpt4Prompts?.typeSpecific?.armor?.focus || [
        '- Armor SHAPED for T-pose body (shoulder openings pointing straight sideways, not down)',
        '- Chest armor should form a "T" or cross shape when viewed from above',
        '- Shoulder openings at 180° angle to each other (straight line across)'
      ]
      systemPrompt += '\n' + armorFocus.join('\n')
    }

    systemPrompt += '\n' + (gpt4Prompts?.systemPrompt?.closingInstruction || 'Keep the enhanced prompt concise but detailed.')

    // Include custom game style text
    const stylePrefix = assetConfig.customPrompts?.gameStyle ? `${assetConfig.customPrompts.gameStyle} — ` : ''
    const baseDescription = `${stylePrefix}${description}`
    const userPrompt = isArmor
      ? (gpt4Prompts?.typeSpecific?.armor?.enhancementPrefix || `Enhance this armor piece description for 3D generation...`) + `"${baseDescription}"`
      : `Enhance this ${assetConfig.type} asset description for 3D generation: "${baseDescription}"`

    try {
      // Get configured model and settings for this task
      const model = await this.getConfiguredModel('prompt-enhancement', 'gpt-4', 'openai')
      const settings = await this.getModelSettings('prompt-enhancement')

      // Use AI SDK v5 generateText with gateway support
      const requestOptions = {
        model: model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens || 200,
      }

      // Add usage tracking if using gateway
      if (this.useGateway && userId) {
        requestOptions.providerOptions = this.getProviderOptions(userId, [
          'prompt-enhancement',
          assetConfig.type || 'asset',
          'gpt-4'
        ])
      }

      const { text } = await generateText(requestOptions)

      return {
        originalPrompt: description,
        optimizedPrompt: text.trim(),
        model: this.useGateway ? 'openai/gpt-4' : 'gpt-4',
        keywords: this.extractKeywords(text)
      }
    } catch (error) {
      console.error('GPT-4 enhancement failed:', error)

      // Load generation prompts for fallback
      const generationPrompts = await getGenerationPrompts()
      const fallbackTemplate = generationPrompts?.imageGeneration?.fallbackEnhancement ||
        '${config.description}. ${config.style || "game-ready"} style, clean geometry, game-ready 3D asset.'

      // Replace template variables
      const fallbackPrompt = fallbackTemplate
        .replace('${config.description}', description)
        .replace('${config.style || "game-ready"}', assetConfig.style || 'game-ready')

      return {
        originalPrompt: description,
        optimizedPrompt: fallbackPrompt,
        error: error.message
      }
    }
  }

  /**
   * Generate image using AI SDK v5
   * @param {string} description - Image description
   * @param {string} assetType - Type of asset
   * @param {string} style - Style for generation
   * @param {string} userId - Optional user ID for tracking
   */
  async generateImage(description, assetType, style, userId = null) {
    if (!this.useGateway && !process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY or AI_GATEWAY_API_KEY required for image generation')
    }

    // Load generation prompts
    const generationPrompts = await getGenerationPrompts()
    const promptTemplate = generationPrompts?.imageGeneration?.base ||
      '${description}. ${style || "game-ready"} style, ${assetType}, clean geometry suitable for 3D conversion.'

    // Replace template variables
    const prompt = promptTemplate
      .replace('${description}', description)
      .replace('${style || "game-ready"}', style || 'game-ready')
      .replace('${assetType}', assetType)

    try {
      // Get configured model for image generation
      // Note: For image models, we need special handling as they use .image() method
      let imageModel
      try {
        const configResult = await import('../database/db.mjs')
        const result = await configResult.db.query(`
          SELECT model_id FROM model_configurations
          WHERE task_type = 'image-generation' AND is_active = true
          LIMIT 1
        `)

        if (result.rows.length > 0) {
          const modelId = result.rows[0].model_id
          imageModel = this.useGateway ? gateway(modelId) : openai.image(modelId.replace('openai/', ''))
        } else {
          imageModel = this.useGateway ? gateway('openai/gpt-image-1') : openai.image('gpt-image-1')
        }
      } catch (error) {
        console.warn('Failed to fetch configured image model:', error.message)
        imageModel = this.useGateway ? gateway('openai/gpt-image-1') : openai.image('gpt-image-1')
      }

      // Use AI SDK v5 experimental_generateImage
      const requestOptions = {
        model: imageModel,
        prompt: prompt,
        size: '1024x1024',
        providerOptions: {
          openai: {
            quality: 'high'
          }
        }
      }

      // Add usage tracking if using gateway
      if (this.useGateway && userId) {
        requestOptions.providerOptions.gateway = this.getProviderOptions(userId, [
          'image-generation',
          assetType,
          style,
          'gpt-image-1'
        ]).gateway
      }

      const { image } = await generateImage(requestOptions)

      // Convert image to base64 data URL
      const base64Data = image.base64
      const imageUrl = `data:image/png;base64,${base64Data}`

      return {
        imageUrl: imageUrl,
        prompt: prompt,
        metadata: {
          model: this.useGateway ? 'openai/gpt-image-1' : 'gpt-image-1',
          resolution: '1024x1024',
          quality: 'high',
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('Image generation failed:', error)
      throw new Error(`Image generation failed: ${error.message}`)
    }
  }

  /**
   * Extract keywords from prompt
   */
  extractKeywords(prompt) {
    const keywords = []
    const patterns = [
      /\b(bronze|steel|iron|mithril|adamant|rune)\b/gi,
      /\b(sword|shield|bow|staff|armor|helmet)\b/gi,
      /\b(leather|metal|wood|crystal|bone)\b/gi,
      /\b(low-poly|high-poly|realistic|stylized)\b/gi
    ]

    patterns.forEach(pattern => {
      const matches = prompt.match(pattern)
      if (matches) {
        keywords.push(...matches.map(m => m.toLowerCase()))
      }
    })

    return [...new Set(keywords)]
  }

  /**
   * Generate text with Claude (for lore, dialogue, etc.)
   * @param {string} prompt - User prompt
   * @param {string} systemPrompt - System instructions
   * @param {object} options - Generation options
   * @param {string} userId - Optional user ID for tracking
   */
  async generateWithClaude(prompt, systemPrompt, options = {}, userId = null) {
    if (!this.useGateway && !process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required for Claude generation')
    }

    // Get configured model and settings for text generation
    const taskType = options.taskType || 'text-generation'
    const model = await this.getConfiguredModel(taskType, 'claude-sonnet-4', 'anthropic')
    const settings = await this.getModelSettings(taskType)

    const requestOptions = {
      model: model,
      system: systemPrompt,
      prompt: prompt,
      temperature: options.temperature || settings.temperature,
      maxTokens: options.maxTokens || settings.maxTokens || 1000,
    }

    // Add usage tracking if using gateway
    if (this.useGateway && userId) {
      requestOptions.providerOptions = this.getProviderOptions(userId, [
        options.tags || taskType,
        'claude-sonnet-4'
      ])
    }

    const { text } = await generateText(requestOptions)

    return text
  }

  /**
   * Get available models from AI Gateway
   * Only works when using gateway
   */
  async getAvailableModels() {
    if (!this.useGateway) {
      throw new Error('getAvailableModels() only works with AI Gateway')
    }

    try {
      const models = await gateway.getAvailableModels()

      // Handle case where gateway returns undefined or null
      if (!models || !Array.isArray(models)) {
        console.warn('[AISDKService] gateway.getAvailableModels() returned non-array:', models)
        return []
      }

      return models.map(model => ({
        id: model.id,
        name: model.name,
        description: model.description,
        pricing: model.pricing ? {
          input: model.pricing.input,
          output: model.pricing.output,
          cachedInput: model.pricing.cachedInputTokens,
          cacheCreation: model.pricing.cacheCreationInputTokens
        } : null
      }))
    } catch (error) {
      console.error('Failed to fetch available models:', error)
      throw error
    }
  }

  /**
   * Get credit balance and usage from AI Gateway
   * Only works when using gateway
   */
  async getCredits() {
    if (!this.useGateway) {
      throw new Error('getCredits() only works with AI Gateway')
    }

    try {
      const credits = await gateway.getCredits()
      return {
        balance: credits.balance,
        totalUsed: credits.total_used
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error)
      throw error
    }
  }

  /**
   * Get pricing information for a specific model
   * @param {string} modelId - Model identifier (e.g., 'openai/gpt-4')
   */
  async getModelPricing(modelId) {
    if (!this.useGateway) {
      throw new Error('getModelPricing() only works with AI Gateway')
    }

    const models = await this.getAvailableModels()
    const model = models.find(m => m.id === modelId)

    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }

    return model.pricing
  }
}
