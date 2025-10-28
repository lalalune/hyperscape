/**
 * Admin Model Configuration Routes
 * Allows admins to configure which AI models are used for different tasks
 */

import { Hono } from 'hono'
import { query } from '../database/db.mjs'
import { AISDKService } from '../services/AISDKService.mjs'
import { validateBody, validateParams } from '../middleware/validation-hono.mjs'
import {
  EnableModelBodySchema,
  UpdateModelBodySchema,
  ModelIdParamSchema
} from '../validation/model-schemas.mjs'

const router = new Hono()
const aiService = new AISDKService()

// Create db object wrapper for compatibility
const db = { query }

/**
 * GET /api/admin/models
 * Get all model configurations
 */
router.get('/', async (c) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        task_type,
        model_id,
        provider,
        temperature,
        max_tokens,
        display_name,
        description,
        pricing_input,
        pricing_output,
        is_active,
        updated_at
      FROM model_configurations
      ORDER BY task_type
    `)

    return c.json({
      count: result.rows.length,
      models: result.rows.map(row => ({
        id: row.id,
        taskType: row.task_type,
        modelId: row.model_id,
        provider: row.provider,
        temperature: parseFloat(row.temperature),
        maxTokens: row.max_tokens,
        displayName: row.display_name,
        description: row.description,
        pricing: row.pricing_input ? {
          input: parseFloat(row.pricing_input),
          output: parseFloat(row.pricing_output)
        } : null,
        isActive: row.is_active,
        updatedAt: row.updated_at
      }))
    })
  } catch (error) {
    console.error('Failed to fetch model configurations:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/admin/models/available
 * Get available models from AI Gateway
 */
router.get('/available', async (c) => {
  try {
    if (!aiService.useGateway) {
      return c.json({
        error: 'AI Gateway not enabled. Set AI_GATEWAY_API_KEY to use this feature.'
      }, 400)
    }

    const models = await aiService.getAvailableModels()

    return c.json({
      count: models.length,
      models: models.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        provider: m.id.split('/')[0],
        pricing: m.pricing
      }))
    })
  } catch (error) {
    console.error('Failed to fetch available models:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/admin/models/:taskType
 * Get model configuration for a specific task
 */
router.get('/:taskType', async (c) => {
  try {
    const taskType = c.req.param('taskType')

    const result = await db.query(`
      SELECT
        id,
        task_type,
        model_id,
        provider,
        temperature,
        max_tokens,
        display_name,
        description,
        pricing_input,
        pricing_output,
        is_active,
        updated_at
      FROM model_configurations
      WHERE task_type = $1
    `, [taskType])

    if (result.rows.length === 0) {
      return c.json({ error: 'Model configuration not found' }, 404)
    }

    const row = result.rows[0]
    return c.json({
      id: row.id,
      taskType: row.task_type,
      modelId: row.model_id,
      provider: row.provider,
      temperature: parseFloat(row.temperature),
      maxTokens: row.max_tokens,
      displayName: row.display_name,
      description: row.description,
      pricing: row.pricing_input ? {
        input: parseFloat(row.pricing_input),
        output: parseFloat(row.pricing_output)
      } : null,
      isActive: row.is_active,
      updatedAt: row.updated_at
    })
  } catch (error) {
    console.error('Failed to fetch model configuration:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * PUT /api/admin/models/:taskType
 * Update model configuration for a specific task
 */
router.put('/:taskType', async (c) => {
  try {
    const taskType = c.req.param('taskType')
    const { modelId, temperature, maxTokens, isActive } = await c.req.json()
    const userId = c.req.header('x-user-id')

    if (!modelId) {
      return c.json({ error: 'modelId is required' }, 400)
    }

    // Extract provider from modelId (e.g., 'openai/gpt-4' -> 'openai')
    const provider = modelId.split('/')[0]

    // Fetch pricing if using gateway
    let pricingInput = null
    let pricingOutput = null

    if (aiService.useGateway) {
      try {
        const pricing = await aiService.getModelPricing(modelId)
        pricingInput = pricing.input
        pricingOutput = pricing.output
      } catch (error) {
        console.warn('Failed to fetch pricing for model:', modelId, error.message)
      }
    }

    // Update or insert configuration
    const result = await db.query(`
      INSERT INTO model_configurations (
        task_type,
        model_id,
        provider,
        temperature,
        max_tokens,
        pricing_input,
        pricing_output,
        is_active,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (task_type) DO UPDATE SET
        model_id = EXCLUDED.model_id,
        provider = EXCLUDED.provider,
        temperature = EXCLUDED.temperature,
        max_tokens = EXCLUDED.max_tokens,
        pricing_input = EXCLUDED.pricing_input,
        pricing_output = EXCLUDED.pricing_output,
        is_active = EXCLUDED.is_active,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      taskType,
      modelId,
      provider,
      temperature || 0.7,
      maxTokens || null,
      pricingInput,
      pricingOutput,
      isActive !== undefined ? isActive : true,
      userId || null
    ])

    const row = result.rows[0]
    return c.json({
      id: row.id,
      taskType: row.task_type,
      modelId: row.model_id,
      provider: row.provider,
      temperature: parseFloat(row.temperature),
      maxTokens: row.max_tokens,
      pricing: row.pricing_input ? {
        input: parseFloat(row.pricing_input),
        output: parseFloat(row.pricing_output)
      } : null,
      isActive: row.is_active,
      updatedAt: row.updated_at
    })
  } catch (error) {
    console.error('Failed to update model configuration:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * DELETE /api/admin/models/:taskType
 * Delete model configuration (reset to default)
 */
router.delete('/:taskType', async (c) => {
  try {
    const taskType = c.req.param('taskType')

    const result = await db.query(`
      DELETE FROM model_configurations
      WHERE task_type = $1
      RETURNING task_type
    `, [taskType])

    if (result.rows.length === 0) {
      return c.json({ error: 'Model configuration not found' }, 404)
    }

    return c.json({
      message: 'Model configuration deleted',
      taskType: result.rows[0].task_type
    })
  } catch (error) {
    console.error('Failed to delete model configuration:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/admin/settings
 * Get system settings
 */
router.get('/settings/all', async (c) => {
  try {
    const result = await db.query(`
      SELECT
        setting_key,
        setting_value,
        description,
        updated_at
      FROM system_settings
      ORDER BY setting_key
    `)

    const settings = {}
    result.rows.forEach(row => {
      settings[row.setting_key] = {
        value: row.setting_value,
        description: row.description,
        updatedAt: row.updated_at
      }
    })

    return c.json({ settings })
  } catch (error) {
    console.error('Failed to fetch system settings:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * PUT /api/admin/settings/:key
 * Update a system setting
 */
router.put('/settings/:key', async (c) => {
  try {
    const key = c.req.param('key')
    const { value } = await c.req.json()
    const userId = c.req.header('x-user-id')

    if (value === undefined) {
      return c.json({ error: 'value is required' }, 400)
    }

    const result = await db.query(`
      UPDATE system_settings
      SET
        setting_value = $1,
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = $3
      RETURNING *
    `, [JSON.stringify(value), userId || null, key])

    if (result.rows.length === 0) {
      return c.json({ error: 'Setting not found' }, 404)
    }

    const row = result.rows[0]
    return c.json({
      key: row.setting_key,
      value: row.setting_value,
      description: row.description,
      updatedAt: row.updated_at
    })
  } catch (error) {
    console.error('Failed to update system setting:', error)
    return c.json({ error: error.message }, 500)
  }
})

// =============================================================================
// ENABLED MODELS MANAGEMENT
// Admin endpoints for managing which models are enabled platform-wide
// =============================================================================

// Valid model categories and tiers for validation
const VALID_CATEGORIES = ['text-generation', 'image-generation', 'voice-generation', 'embedding', '3d-generation']
const VALID_TIERS = ['quality', 'speed', 'balanced', 'cost']

/**
 * Validate model configuration data
 */
function validateModelConfig(data) {
  const errors = []

  if (!data.modelId) {
    errors.push('modelId is required')
  }

  if (!data.provider) {
    errors.push('provider is required')
  }

  if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
    errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`)
  }

  if (data.tier && !VALID_TIERS.includes(data.tier)) {
    errors.push(`tier must be one of: ${VALID_TIERS.join(', ')}`)
  }

  if (data.pricing && (!data.pricing.input || !data.pricing.output)) {
    errors.push('pricing must include both input and output values')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * GET /api/admin/models/enabled
 * Get all enabled models
 */
router.get('/enabled/all', async (c) => {
  const startTime = Date.now()

  try {
    console.log('[Admin Models] Fetching all enabled models')

    const result = await db.query(`
      SELECT
        id,
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
        is_enabled,
        is_recommended,
        default_temperature,
        default_max_tokens,
        created_at,
        updated_at
      FROM enabled_models
      ORDER BY category, tier, display_name
    `)

    const duration = Date.now() - startTime
    console.log(`[Admin Models] Fetched ${result.rows.length} enabled models (${duration}ms)`)

    return c.json({
      count: result.rows.length,
      models: result.rows.map(row => ({
        id: row.id,
        modelId: row.model_id,
        provider: row.provider,
        category: row.category,
        displayName: row.display_name,
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
        isEnabled: row.is_enabled,
        isRecommended: row.is_recommended,
        defaultSettings: {
          temperature: row.default_temperature ? parseFloat(row.default_temperature) : null,
          maxTokens: row.default_max_tokens
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Admin Models] Failed to fetch enabled models (${duration}ms):`, error.message)
    console.error('[Admin Models] Error stack:', error.stack)

    return c.json({
      error: 'Failed to fetch enabled models',
      code: 'MODEL_2104',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500)
  }
})

/**
 * POST /api/admin/models/enabled
 * Enable a new model or update existing
 */
router.post('/enabled', validateBody(EnableModelBodySchema), async (c) => {
  const startTime = Date.now()

  try {
    const {
      modelId,
      provider,
      category,
      displayName,
      description,
      tier,
      capabilities,
      contextWindow,
      maxOutputTokens,
      pricing,
      isRecommended,
      defaultTemperature,
      defaultMaxTokens
    } = await c.req.json()

    console.log(`[Admin Models] Enabling model: ${modelId}`)

    // Validate input
    const validation = validateModelConfig({
      modelId,
      provider,
      category,
      tier,
      pricing
    })

    if (!validation.valid) {
      console.warn(`[Admin Models] Validation failed for ${modelId}:`, validation.errors)
      return c.json({
        error: 'Validation failed',
        code: 'MODEL_2105',
        errors: validation.errors,
        timestamp: new Date().toISOString()
      }, 400)
    }

    const userId = c.req.header('x-user-id')

    const result = await db.query(`
      INSERT INTO enabled_models (
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
        is_enabled,
        is_recommended,
        default_temperature,
        default_max_tokens,
        created_by,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (model_id) DO UPDATE SET
        provider = EXCLUDED.provider,
        category = EXCLUDED.category,
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        tier = EXCLUDED.tier,
        capabilities = EXCLUDED.capabilities,
        context_window = EXCLUDED.context_window,
        max_output_tokens = EXCLUDED.max_output_tokens,
        pricing_input = EXCLUDED.pricing_input,
        pricing_output = EXCLUDED.pricing_output,
        pricing_currency = EXCLUDED.pricing_currency,
        is_enabled = true,
        is_recommended = EXCLUDED.is_recommended,
        default_temperature = EXCLUDED.default_temperature,
        default_max_tokens = EXCLUDED.default_max_tokens,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      modelId,
      provider,
      category,
      displayName || modelId,
      description || null,
      tier || 'balanced',
      capabilities ? JSON.stringify(capabilities) : null,
      contextWindow || null,
      maxOutputTokens || null,
      pricing?.input || null,
      pricing?.output || null,
      pricing?.currency || 'USD',
      true, // is_enabled
      isRecommended || false,
      defaultTemperature || 0.7,
      defaultMaxTokens || null,
      userId || null,
      userId || null
    ])

    const duration = Date.now() - startTime
    console.log(`[Admin Models] Successfully enabled model ${modelId} (${duration}ms)`)

    const row = result.rows[0]
    return c.json({
      id: row.id,
      modelId: row.model_id,
      provider: row.provider,
      category: row.category,
      displayName: row.display_name,
      isEnabled: row.is_enabled,
      isRecommended: row.is_recommended,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })
  } catch (error) {
    const duration = Date.now() - startTime

    // Check for duplicate key constraint
    if (error.code === '23505') {
      const body = await c.req.json()
      console.warn(`[Admin Models] Model already exists: ${body.modelId}`)
      return c.json({
        error: 'Model already enabled',
        code: 'MODEL_2103',
        message: error.message,
        timestamp: new Date().toISOString()
      }, 409)
    }

    console.error(`[Admin Models] Failed to enable model (${duration}ms):`, error.message)
    console.error('[Admin Models] Error stack:', error.stack)

    return c.json({
      error: 'Failed to enable model',
      code: 'MODEL_2106',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500)
  }
})

/**
 * PATCH /api/admin/models/enabled/:modelId
 * Update an enabled model's settings
 */
router.patch('/enabled/:modelId', validateParams(ModelIdParamSchema), validateBody(UpdateModelBodySchema), async (c) => {
  const startTime = Date.now()
  const modelId = c.req.param('modelId')

  try {
    console.log(`[Admin Models] Updating model: ${modelId}`)

    const {
      isEnabled,
      isRecommended,
      displayName,
      description,
      tier,
      defaultTemperature,
      defaultMaxTokens,
      pricing
    } = await c.req.json()

    const userId = c.req.header('x-user-id')

    // Build dynamic UPDATE query
    const updates = []
    const values = []
    let paramCount = 1

    if (isEnabled !== undefined) {
      updates.push(`is_enabled = $${paramCount++}`)
      values.push(isEnabled)
    }
    if (isRecommended !== undefined) {
      updates.push(`is_recommended = $${paramCount++}`)
      values.push(isRecommended)
    }
    if (displayName) {
      updates.push(`display_name = $${paramCount++}`)
      values.push(displayName)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`)
      values.push(description)
    }
    if (tier && VALID_TIERS.includes(tier)) {
      updates.push(`tier = $${paramCount++}`)
      values.push(tier)
    }
    if (defaultTemperature !== undefined) {
      updates.push(`default_temperature = $${paramCount++}`)
      values.push(defaultTemperature)
    }
    if (defaultMaxTokens !== undefined) {
      updates.push(`default_max_tokens = $${paramCount++}`)
      values.push(defaultMaxTokens)
    }
    if (pricing) {
      if (pricing.input !== undefined) {
        updates.push(`pricing_input = $${paramCount++}`)
        values.push(pricing.input)
      }
      if (pricing.output !== undefined) {
        updates.push(`pricing_output = $${paramCount++}`)
        values.push(pricing.output)
      }
    }

    if (updates.length === 0) {
      return c.json({
        error: 'No valid fields to update',
        code: 'MODEL_2105',
        timestamp: new Date().toISOString()
      }, 400)
    }

    updates.push(`updated_by = $${paramCount++}`)
    values.push(userId || null)
    updates.push(`updated_at = CURRENT_TIMESTAMP`)

    values.push(modelId)
    const modelIdParam = `$${paramCount}`

    const result = await db.query(`
      UPDATE enabled_models
      SET ${updates.join(', ')}
      WHERE model_id = ${modelIdParam}
      RETURNING *
    `, values)

    if (result.rows.length === 0) {
      console.warn(`[Admin Models] Model not found: ${modelId}`)
      return c.json({
        error: 'Model not found',
        code: 'MODEL_2100',
        modelId: modelId,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const duration = Date.now() - startTime
    console.log(`[Admin Models] Successfully updated model ${modelId} (${duration}ms)`)

    const row = result.rows[0]
    return c.json({
      id: row.id,
      modelId: row.model_id,
      provider: row.provider,
      category: row.category,
      displayName: row.display_name,
      tier: row.tier,
      isEnabled: row.is_enabled,
      isRecommended: row.is_recommended,
      updatedAt: row.updated_at
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Admin Models] Failed to update model ${modelId} (${duration}ms):`, error.message)
    console.error('[Admin Models] Error stack:', error.stack)

    return c.json({
      error: 'Failed to update model',
      code: 'MODEL_2106',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500)
  }
})

/**
 * DELETE /api/admin/models/enabled/:modelId
 * Disable a model (sets is_enabled = false)
 */
router.delete('/enabled/:modelId', validateParams(ModelIdParamSchema), async (c) => {
  const startTime = Date.now()
  const modelId = c.req.param('modelId')

  try {
    console.log(`[Admin Models] Disabling model: ${modelId}`)

    const userId = c.req.header('x-user-id')

    const result = await db.query(`
      UPDATE enabled_models
      SET
        is_enabled = false,
        updated_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE model_id = $2
      RETURNING model_id, display_name
    `, [userId || null, modelId])

    if (result.rows.length === 0) {
      console.warn(`[Admin Models] Model not found: ${modelId}`)
      return c.json({
        error: 'Model not found',
        code: 'MODEL_2100',
        modelId: modelId,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const duration = Date.now() - startTime
    console.log(`[Admin Models] Successfully disabled model ${modelId} (${duration}ms)`)

    return c.json({
      message: 'Model disabled successfully',
      modelId: result.rows[0].model_id,
      displayName: result.rows[0].display_name
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Admin Models] Failed to disable model ${modelId} (${duration}ms):`, error.message)
    console.error('[Admin Models] Error stack:', error.stack)

    return c.json({
      error: 'Failed to disable model',
      code: 'MODEL_2107',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500)
  }
})

export default router
