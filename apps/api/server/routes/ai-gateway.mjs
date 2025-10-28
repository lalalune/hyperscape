/**
 * AI Gateway API Routes
 * Provides endpoints for AI Gateway features:
 * - Available models and pricing
 * - Credit balance and usage
 * - Model selection helpers
 */

import { Hono } from 'hono'
import { AISDKService } from '../services/AISDKService.mjs'

const router = new Hono()
const aiService = new AISDKService()

/**
 * GET /api/ai-gateway/status
 * Check if AI Gateway is enabled
 */
router.get('/status', async (c) => {
  try {
    return c.json({
      enabled: aiService.useGateway,
      provider: aiService.useGateway ? 'ai-gateway' : 'direct',
      message: aiService.useGateway
        ? 'Using Vercel AI Gateway for unified model access'
        : 'Using direct provider access (OpenAI, Anthropic)'
    })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/ai-gateway/models
 * Get all available models with pricing
 */
router.get('/models', async (c) => {
  try {
    if (!aiService.useGateway) {
      return c.json({
        error: 'AI Gateway not enabled. Set AI_GATEWAY_API_KEY to use this endpoint.'
      }, 400)
    }

    const models = await aiService.getAvailableModels()
    return c.json({
      count: models.length,
      models: models
    })
  } catch (error) {
    console.error('Failed to fetch models:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/ai-gateway/models/:modelId/pricing
 * Get pricing for a specific model
 */
router.get('/models/:modelId/pricing', async (c) => {
  try {
    if (!aiService.useGateway) {
      return c.json({
        error: 'AI Gateway not enabled. Set AI_GATEWAY_API_KEY to use this endpoint.'
      }, 400)
    }

    // Replace - with / in model ID (URL encoding)
    const modelId = c.req.param('modelId').replace('-', '/')
    const pricing = await aiService.getModelPricing(modelId)

    return c.json({
      modelId: modelId,
      pricing: pricing
    })
  } catch (error) {
    console.error('Failed to fetch model pricing:', error)
    return c.json({ error: error.message }, 404)
  }
})

/**
 * GET /api/ai-gateway/credits
 * Get team credit balance and usage
 */
router.get('/credits', async (c) => {
  try {
    if (!aiService.useGateway) {
      return c.json({
        error: 'AI Gateway not enabled. Set AI_GATEWAY_API_KEY to use this endpoint.'
      }, 400)
    }

    const credits = await aiService.getCredits()
    return c.json({
      balance: credits.balance,
      totalUsed: credits.totalUsed,
      unit: 'USD'
    })
  } catch (error) {
    console.error('Failed to fetch credits:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/ai-gateway/providers
 * Get list of supported providers
 */
router.get('/providers', async (c) => {
  try {
    if (!aiService.useGateway) {
      return c.json({
        error: 'AI Gateway not enabled. Set AI_GATEWAY_API_KEY to use this endpoint.'
      }, 400)
    }

    const models = await aiService.getAvailableModels()

    // Extract unique providers
    const providers = [...new Set(models.map(m => m.id.split('/')[0]))]

    return c.json({
      count: providers.length,
      providers: providers.sort()
    })
  } catch (error) {
    console.error('Failed to fetch providers:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * POST /api/ai-gateway/estimate
 * Estimate cost for a generation request
 *
 * Body:
 * {
 *   "model": "openai/gpt-4",
 *   "inputTokens": 1000,
 *   "outputTokens": 500
 * }
 */
router.post('/estimate', async (c) => {
  try {
    if (!aiService.useGateway) {
      return c.json({
        error: 'AI Gateway not enabled. Set AI_GATEWAY_API_KEY to use this endpoint.'
      }, 400)
    }

    const { model, inputTokens, outputTokens } = await c.req.json()

    if (!model || !inputTokens || !outputTokens) {
      return c.json({
        error: 'Missing required fields: model, inputTokens, outputTokens'
      }, 400)
    }

    const pricing = await aiService.getModelPricing(model)

    if (!pricing) {
      return c.json({
        error: `Pricing not available for model: ${model}`
      }, 404)
    }

    const cost = {
      input: (inputTokens / 1000000) * pricing.input,
      output: (outputTokens / 1000000) * pricing.output,
      total: 0
    }
    cost.total = cost.input + cost.output

    return c.json({
      model: model,
      estimate: {
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        costs: {
          input: cost.input.toFixed(6),
          output: cost.output.toFixed(6),
          total: cost.total.toFixed(6)
        },
        unit: 'USD'
      },
      pricing: pricing
    })
  } catch (error) {
    console.error('Failed to estimate cost:', error)
    return c.json({ error: error.message }, 500)
  }
})

export default router
