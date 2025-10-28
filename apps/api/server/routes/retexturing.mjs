/**
 * Retexturing API Routes
 * Handles asset retexturing using Meshy API
 */

import { Hono } from 'hono'
import path from 'path'
import { fileURLToPath } from 'url'
import { requireAuth } from '../middleware/auth-hono.mjs'
import { resolveMeshyKey } from '../middleware/api-key-resolver-hono.mjs'
import { RetextureService } from '../services/RetextureService.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '../..')

const router = new Hono()

// POST /api/retexture - Retexture an existing asset
router.post('/', requireAuth, resolveMeshyKey, async (c) => {
  try {
    const { baseAssetId, materialPreset, outputName } = await c.req.json()

    // Validate input
    if (!baseAssetId || !materialPreset) {
      return c.json({
        error: 'baseAssetId and materialPreset are required'
      }, 400)
    }

    // Use resolved Meshy API key from middleware
    const apiKey = c.get('resolvedApiKeys').meshy

    // Create service instance with user's API key
    const userRetextureService = new RetextureService(apiKey)
    const result = await userRetextureService.retexture({
      baseAssetId,
      materialPreset,
      outputName,
      assetsDir: path.join(ROOT_DIR, 'gdd-assets')
    })

    return c.json(result)
  } catch (error) {
    console.error('[Retexturing] Error retexturing asset:', error)
    return c.json({ error: error.message || 'Failed to retexture asset' }, 500)
  }
})

// POST /api/regenerate-base/:baseAssetId - Regenerate base model
router.post('/regenerate-base/:baseAssetId', requireAuth, resolveMeshyKey, async (c) => {
  try {
    const baseAssetId = c.req.param('baseAssetId')

    // Use resolved Meshy API key from middleware
    const apiKey = c.get('resolvedApiKeys').meshy

    // Create service instance with user's API key
    const userRetextureService = new RetextureService(apiKey)
    const result = await userRetextureService.regenerateBase({
      baseAssetId,
      assetsDir: path.join(ROOT_DIR, 'gdd-assets')
    })

    return c.json(result)
  } catch (error) {
    console.error('[Retexturing] Error regenerating base:', error)
    return c.json({ error: error.message || 'Failed to regenerate base' }, 500)
  }
})

export default router
