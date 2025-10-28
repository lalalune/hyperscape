/**
 * Generation Pipeline API Routes
 * Handles asset generation pipeline operations
 */

import { Hono } from 'hono'
import { GenerationService } from '../services/GenerationService.mjs'

const router = new Hono()

// Initialize GenerationService
const generationService = new GenerationService()

// POST /api/generation/pipeline - Start asset generation pipeline
router.post('/pipeline', async (c) => {
  try {
    const config = await c.req.json()

    // Validate required fields
    if (!config.name || !config.type || !config.subtype) {
      return c.json({
        error: 'name, type, and subtype are required'
      }, 400)
    }

    const result = await generationService.startPipeline(config)
    return c.json(result)
  } catch (error) {
    console.error('[Generation Pipeline] Error starting pipeline:', error)
    return c.json({ error: error.message || 'Failed to start generation pipeline' }, 500)
  }
})

// GET /api/generation/pipeline/:pipelineId - Get pipeline status
router.get('/pipeline/:pipelineId', async (c) => {
  try {
    const pipelineId = c.req.param('pipelineId')
    const status = await generationService.getPipelineStatus(pipelineId)
    return c.json(status)
  } catch (error) {
    if (error.message.includes('not found')) {
      return c.json({ error: error.message }, 404)
    }
    console.error('[Generation Pipeline] Error getting status:', error)
    return c.json({ error: error.message || 'Failed to get pipeline status' }, 500)
  }
})

export default router
