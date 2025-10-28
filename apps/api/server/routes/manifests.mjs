/**
 * Hyperscape Manifests API Routes
 * Serves actual Hyperscape game manifests for viewing and preview in Asset Forge
 */

import { Hono } from 'hono'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from '../database/db.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = new Hono()

// Path to Hyperscape manifests
// Auto-detect based on environment:
// - Railway/Docker: /app/assets/world/manifests
// - Local dev: {workspace}/assets/world/manifests
function getManifestsPath() {
  // Environment variable takes precedence
  if (process.env.MANIFESTS_PATH) {
    return process.env.MANIFESTS_PATH
  }

  // Check if we're in Railway/Docker (assets at /app/assets)
  const railwayPath = '/app/assets/world/manifests'
  try {
    if (fs.existsSync(railwayPath)) {
      return railwayPath
    }
  } catch (error) {
    // Path doesn't exist, continue
  }

  // Local development - go up to workspace root, then into assets
  // From: /apps/api/server/routes/manifests.mjs
  // To:   /assets/world/manifests
  return path.join(__dirname, '../../../../assets/world/manifests')
}

const MANIFESTS_PATH = getManifestsPath()
console.log('[Manifests API] Using manifests path:', MANIFESTS_PATH)

/**
 * GET /api/manifests
 * Get list of all available manifest files
 */
router.get('/', async (c) => {
  try {
    const files = await fs.readdir(MANIFESTS_PATH)
    const manifestFiles = files.filter(f => f.endsWith('.json'))

    const manifests = await Promise.all(
      manifestFiles.map(async (file) => {
        const filePath = path.join(MANIFESTS_PATH, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const data = JSON.parse(content)

        return {
          type: file.replace('.json', ''),
          fileName: file,
          count: Array.isArray(data) ? data.length : Object.keys(data).length,
          path: `/api/manifests/${file.replace('.json', '')}`
        }
      })
    )

    return c.json({
      count: manifests.length,
      manifests,
      source: 'hyperscape-server',
      basePath: MANIFESTS_PATH
    })
  } catch (error) {
    console.error('[Manifests API] Error listing manifests:', error)
    return c.json({
      error: 'Failed to list manifests',
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/manifests/:type
 * Get specific manifest by type (items, mobs, npcs, etc.)
 * Now uses preview_manifests table with fallback to JSON files
 */
router.get('/:type', async (c) => {
  try {
    const type = c.req.param('type')

    // Try to get from preview_manifests table first (system user's original manifest)
    try {
      const systemUserResult = await query(
        `SELECT id FROM users WHERE privy_user_id = 'system' LIMIT 1`
      )

      if (systemUserResult.rows.length > 0) {
        const systemUserId = systemUserResult.rows[0].id

        const manifestResult = await query(
          `SELECT * FROM preview_manifests
           WHERE user_id = $1 AND manifest_type = $2 AND is_original = true`,
          [systemUserId, type]
        )

        if (manifestResult.rows.length > 0) {
          const manifest = manifestResult.rows[0]

          return c.json({
            type,
            data: manifest.content || [],
            count: Array.isArray(manifest.content) ? manifest.content.length : 0,
            source: 'preview-manifests-db',
            version: manifest.version,
            status: manifest.status,
            updatedAt: manifest.updated_at
          })
        }
      }
    } catch (dbError) {
      console.warn('[Manifests API] Database query failed, falling back to file system:', dbError.message)
    }

    // Fallback to file system if not in database
    const fileName = `${type}.json`
    const filePath = path.join(MANIFESTS_PATH, fileName)

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      const availableFiles = await fs.readdir(MANIFESTS_PATH)
      return c.json({
        error: `Manifest '${type}' not found`,
        availableTypes: availableFiles
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''))
      }, 404)
    }

    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)

    return c.json({
      type,
      data,
      count: Array.isArray(data) ? data.length : Object.keys(data).length,
      source: 'hyperscape-server-filesystem',
      filePath: fileName
    })
  } catch (error) {
    console.error(`[Manifests API] Error reading manifest ${c.req.param('type')}:`, error)
    return c.json({
      error: `Failed to read manifest '${c.req.param('type')}'`,
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/manifests/:type/:id
 * Get specific item from a manifest by ID
 */
router.get('/:type/:id', async (c) => {
  try {
    const type = c.req.param('type')
    const id = c.req.param('id')
    const fileName = `${type}.json`
    const filePath = path.join(MANIFESTS_PATH, fileName)

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      return c.json({
        error: `Manifest '${type}' not found`
      }, 404)
    }

    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)

    // Find item by ID
    let item = null
    if (Array.isArray(data)) {
      item = data.find(i => i.id === id)
    } else if (typeof data === 'object') {
      item = data[id]
    }

    if (!item) {
      return c.json({
        error: `Item '${id}' not found in manifest '${type}'`
      }, 404)
    }

    return c.json({
      type,
      id,
      data: item,
      source: 'hyperscape-server'
    })
  } catch (error) {
    console.error(`[Manifests API] Error reading item ${c.req.param('id')} from ${c.req.param('type')}:`, error)
    return c.json({
      error: `Failed to read item from manifest`,
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/manifests/:type
 * Update a manifest file (for development/testing)
 */
router.post('/:type', async (c) => {
  try {
    const type = c.req.param('type')
    const { data } = await c.req.json()

    if (!data) {
      return c.json({ error: 'Manifest data is required' }, 400)
    }

    const fileName = `${type}.json`
    const filePath = path.join(MANIFESTS_PATH, fileName)

    // Write manifest file
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))

    return c.json({
      success: true,
      message: `Manifest '${type}' updated successfully`,
      type,
      count: Array.isArray(data) ? data.length : Object.keys(data).length
    })
  } catch (error) {
    console.error(`[Manifests API] Error updating manifest ${c.req.param('type')}:`, error)
    return c.json({
      error: `Failed to update manifest '${c.req.param('type')}'`,
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/manifests/:type/item
 * Add a new item to a manifest
 */
router.post('/:type/item', async (c) => {
  try {
    const type = c.req.param('type')
    const { item } = await c.req.json()

    if (!item || !item.id) {
      return c.json({ error: 'Item with id is required' }, 400)
    }

    const fileName = `${type}.json`
    const filePath = path.join(MANIFESTS_PATH, fileName)

    // Read existing manifest
    let data = []
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      data = JSON.parse(content)
    } catch {
      // File doesn't exist, create new array
    }

    // Check if item already exists
    if (Array.isArray(data)) {
      const existingIndex = data.findIndex(i => i.id === item.id)
      if (existingIndex >= 0) {
        return c.json({
          error: `Item '${item.id}' already exists in manifest '${type}'`,
          suggestion: `Use PUT /api/manifests/${type}/${item.id} to update`
        }, 409)
      }

      // Add item
      data.push(item)
    } else {
      data[item.id] = item
    }

    // Save manifest
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))

    return c.json({
      success: true,
      message: `Item '${item.id}' added to manifest '${type}'`,
      item,
      totalCount: Array.isArray(data) ? data.length : Object.keys(data).length
    }, 201)
  } catch (error) {
    console.error(`[Manifests API] Error adding item to manifest ${c.req.param('type')}:`, error)
    return c.json({
      error: `Failed to add item to manifest`,
      details: error.message
    }, 500)
  }
})

/**
 * PUT /api/manifests/:type/:id
 * Update an existing item in a manifest
 */
router.put('/:type/:id', async (c) => {
  try {
    const type = c.req.param('type')
    const id = c.req.param('id')
    const { item } = await c.req.json()

    if (!item) {
      return c.json({ error: 'Item data is required' }, 400)
    }

    const fileName = `${type}.json`
    const filePath = path.join(MANIFESTS_PATH, fileName)

    // Read existing manifest
    const content = await fs.readFile(filePath, 'utf-8')
    let data = JSON.parse(content)

    // Find and update item
    let found = false
    if (Array.isArray(data)) {
      const index = data.findIndex(i => i.id === id)
      if (index >= 0) {
        data[index] = { ...data[index], ...item, id } // Preserve ID
        found = true
      }
    } else if (typeof data === 'object' && data[id]) {
      data[id] = { ...data[id], ...item }
      found = true
    }

    if (!found) {
      return c.json({
        error: `Item '${id}' not found in manifest '${type}'`
      }, 404)
    }

    // Save manifest
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))

    return c.json({
      success: true,
      message: `Item '${id}' updated in manifest '${type}'`,
      item: Array.isArray(data) ? data.find(i => i.id === id) : data[id]
    })
  } catch (error) {
    console.error(`[Manifests API] Error updating item in manifest:`, error)
    return c.json({
      error: `Failed to update item`,
      details: error.message
    }, 500)
  }
})

export default router
