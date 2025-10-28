/**
 * Material Presets API Routes
 * Manages material preset configurations for asset texturing
 */

import { Hono } from 'hono'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '../..')

const router = new Hono()

// GET /api/material-presets - Get material presets
router.get('/', async (c) => {
  try {
    const presetsPath = path.join(ROOT_DIR, 'public/prompts/material-presets.json')
    const presetsContent = await fs.promises.readFile(presetsPath, 'utf-8')
    const presets = JSON.parse(presetsContent)
    return c.json(presets)
  } catch (error) {
    console.error('[Material Presets] Error reading presets:', error)
    return c.json({ error: 'Failed to load material presets' }, 500)
  }
})

// POST /api/material-presets - Update material presets
router.post('/', async (c) => {
  try {
    const presets = await c.req.json()

    // Validate that presets is an array
    if (!Array.isArray(presets)) {
      return c.json({ error: 'Material presets must be an array' }, 400)
    }

    // Validate each preset has required fields
    for (const preset of presets) {
      if (!preset.id || !preset.name || !preset.displayName || !preset.stylePrompt) {
        return c.json({
          error: 'Each preset must have id, name, displayName, and stylePrompt'
        }, 400)
      }
    }

    // Save to file
    const presetsPath = path.join(ROOT_DIR, 'public/prompts/material-presets.json')
    await fs.promises.writeFile(presetsPath, JSON.stringify(presets, null, 2), 'utf-8')

    return c.json({
      success: true,
      message: 'Material presets saved successfully'
    })
  } catch (error) {
    console.error('[Material Presets] Error saving presets:', error)
    return c.json({ error: 'Failed to save material presets' }, 500)
  }
})

export default router
