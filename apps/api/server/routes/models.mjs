/**
 * Models API Routes (User-Facing)
 *
 * Provides endpoints for users to discover and select AI models.
 * Only returns models that admins have enabled.
 *
 * Endpoints:
 * - GET /api/models - Get all enabled models
 * - GET /api/models/:category - Get enabled models by category
 * - GET /api/models/:category/recommended - Get recommended models for a category
 */

import { Hono } from 'hono'
import { query } from '../database/db.mjs'
import { validateParams } from '../middleware/validation-hono.mjs'
import { CategoryParamSchema } from '../validation/model-schemas.mjs'

const router = new Hono()

// Create db object wrapper for compatibility
const db = { query }

// Valid model categories and tiers
const VALID_CATEGORIES = ['text-generation', 'image-generation', 'voice-generation', 'embedding', '3d-generation']
const VALID_TIERS = ['quality', 'speed', 'balanced', 'cost']

/**
 * Format model data from database row
 */
function formatModelData(row) {
  return {
    id: row.model_id,
    provider: row.provider,
    name: row.display_name,
    description: row.description,
    tier: row.tier,
    capabilities: row.capabilities || [],
    contextWindow: row.context_window,
    maxOutputTokens: row.max_output_tokens,
    pricing: row.pricing_input ? {
      input: parseFloat(row.pricing_input),
      output: parseFloat(row.pricing_output),
      currency: row.pricing_currency || 'USD'
    } : null,
    isRecommended: row.is_recommended,
    defaultSettings: {
      temperature: row.default_temperature ? parseFloat(row.default_temperature) : null,
      maxTokens: row.default_max_tokens
    }
  }
}

/**
 * GET /api/models
 * Get all enabled models grouped by category
 */
router.get('/', async (c) => {
  const startTime = Date.now()

  try {
    console.log('[Models API] Fetching all enabled models')

    const result = await db.query(`
      SELECT
        model_id,
        provider,
        category,
        display_name,
        description,
        tier,
        capabilities,
        context_window,
        max_output_tokens,
        pricing_input,
        pricing_output,
        pricing_currency,
        is_recommended,
        default_temperature,
        default_max_tokens
      FROM enabled_models
      WHERE is_enabled = true
      ORDER BY category, tier, display_name
    `)

    console.log(`[Models API] Found ${result.rows.length} enabled models`)

    // Group models by category
    const modelsByCategory = result.rows.reduce((acc, row) => {
      if (!acc[row.category]) {
        acc[row.category] = []
      }
      acc[row.category].push(formatModelData(row))
      return acc
    }, {})

    const duration = Date.now() - startTime
    console.log(`[Models API] Successfully fetched all models (${duration}ms)`)

    return c.json({
      categories: Object.keys(modelsByCategory).sort(),
      models: modelsByCategory,
      totalEnabled: result.rows.length
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Models API] Failed to fetch enabled models (${duration}ms):`, error.message)
    console.error('[Models API] Error stack:', error.stack)

    return c.json({
      error: 'Failed to fetch AI models',
      code: 'MODEL_2104',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500)
  }
})

/**
 * GET /api/models/:category/recommended
 * Get recommended models for a category
 * NOTE: This must come BEFORE /:category route to avoid matching "recommended" as a category
 */
router.get('/:category/recommended', validateParams(CategoryParamSchema), async (c) => {
  const startTime = Date.now()
  const category = c.req.param('category')

  try {

    console.log(`[Models API] Fetching recommended models for category: ${category}`)

    const result = await db.query(`
      SELECT
        model_id,
        provider,
        category,
        display_name,
        description,
        tier,
        capabilities,
        context_window,
        max_output_tokens,
        pricing_input,
        pricing_output,
        pricing_currency,
        default_temperature,
        default_max_tokens
      FROM enabled_models
      WHERE category = $1 AND is_enabled = true AND is_recommended = true
      ORDER BY
        CASE tier
          WHEN 'quality' THEN 1
          WHEN 'balanced' THEN 2
          WHEN 'speed' THEN 3
          WHEN 'cost' THEN 4
          ELSE 5
        END,
        display_name
    `, [category])

    const models = result.rows.map(formatModelData)

    const duration = Date.now() - startTime
    console.log(`[Models API] Found ${models.length} recommended models for "${category}" (${duration}ms)`)

    return c.json({
      category: category,
      count: models.length,
      models: models
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Models API] Failed to fetch recommended models for "${category}" (${duration}ms):`, error.message)
    console.error('[Models API] Error stack:', error.stack)

    return c.json({
      error: 'Failed to fetch recommended models',
      code: 'MODEL_2104',
      category: category,
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500)
  }
})

/**
 * GET /api/models/:category
 * Get enabled models for a specific category
 */
router.get('/:category', validateParams(CategoryParamSchema), async (c) => {
  const startTime = Date.now()
  const category = c.req.param('category')

  try {

    console.log(`[Models API] Fetching models for category: ${category}`)

    const result = await db.query(`
      SELECT
        model_id,
        provider,
        category,
        display_name,
        description,
        tier,
        capabilities,
        context_window,
        max_output_tokens,
        pricing_input,
        pricing_output,
        pricing_currency,
        is_recommended,
        default_temperature,
        default_max_tokens
      FROM enabled_models
      WHERE category = $1 AND is_enabled = true
      ORDER BY
        CASE tier
          WHEN 'quality' THEN 1
          WHEN 'balanced' THEN 2
          WHEN 'speed' THEN 3
          WHEN 'cost' THEN 4
          ELSE 5
        END,
        display_name
    `, [category])

    const models = result.rows.map(formatModelData)

    const duration = Date.now() - startTime
    console.log(`[Models API] Found ${models.length} models for category "${category}" (${duration}ms)`)

    return c.json({
      category: category,
      count: models.length,
      models: models
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Models API] Failed to fetch models for category "${category}" (${duration}ms):`, error.message)
    console.error('[Models API] Error stack:', error.stack)

    return c.json({
      error: 'Failed to fetch models for category',
      code: 'MODEL_2104',
      category: category,
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500)
  }
})

export default router
