/**
 * Legacy File-Based Assets API Routes
 * Handles file-based asset operations using AssetService
 * These routes maintain backward compatibility with the old asset management system
 */

import { Hono } from 'hono'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { AssetService } from '../services/AssetService.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '../..')

const router = new Hono()

// Initialize AssetService
const assetService = new AssetService(path.join(ROOT_DIR, 'gdd-assets'))

// GET /api/assets - List file-based assets
router.get('/', async (c) => {
  try {
    // Set no-cache headers
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    c.header('Pragma', 'no-cache')
    c.header('Expires', '0')

    const assets = await assetService.listAssets()
    return c.json(assets)
  } catch (error) {
    console.error('[Legacy Assets] Error listing assets:', error)
    return c.json({ error: 'Failed to list assets' }, 500)
  }
})

// GET/HEAD /api/assets/:id/model - Download model file or check existence
router.get('/:id/model', async (c) => {
  try {
    const id = c.req.param('id')
    const modelPath = await assetService.getModelPath(id)

    // Handle HEAD request (just check existence)
    if (c.req.method === 'HEAD') {
      return c.body(null, 200)
    }

    // Read file and send it
    const fileBuffer = await fs.promises.readFile(modelPath)
    const ext = path.extname(modelPath).toLowerCase()

    // Set appropriate content type
    const contentTypes = {
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.fbx': 'application/octet-stream'
    }

    c.header('Content-Type', contentTypes[ext] || 'application/octet-stream')
    c.header('Content-Disposition', `inline; filename="${id}${ext}"`)

    return c.body(fileBuffer)
  } catch (error) {
    if (error.message.includes('not found')) {
      return c.req.method === 'HEAD' ? c.body(null, 404) : c.json({ error: error.message }, 404)
    }
    console.error('[Legacy Assets] Error serving model:', error)
    return c.req.method === 'HEAD' ? c.body(null, 500) : c.json({ error: 'Failed to serve model' }, 500)
  }
})

// GET /api/assets/:id/* - Serve any file from asset directory (including animations)
router.get('/:id/*', async (c) => {
  try {
    const assetId = c.req.param('id')
    const filePath = c.req.param('*') // Everything after the asset ID

    const fullPath = path.join(ROOT_DIR, 'gdd-assets', assetId, filePath)

    // Security check to prevent directory traversal
    const normalizedPath = path.normalize(fullPath)
    const assetDir = path.join(ROOT_DIR, 'gdd-assets', assetId)
    if (!normalizedPath.startsWith(assetDir)) {
      return c.json({ error: 'Access denied' }, 403)
    }

    // Check if file exists
    try {
      await fs.promises.access(fullPath)
    } catch {
      return c.json({ error: 'File not found' }, 404)
    }

    // Read and serve the file
    const fileBuffer = await fs.promises.readFile(fullPath)
    const ext = path.extname(fullPath).toLowerCase()

    // Set content type based on extension
    const contentTypes = {
      '.json': 'application/json',
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    }

    c.header('Content-Type', contentTypes[ext] || 'application/octet-stream')
    return c.body(fileBuffer)
  } catch (error) {
    console.error('[Legacy Assets] Error serving file:', error)
    return c.json({ error: 'Failed to serve file' }, 500)
  }
})

// DELETE /api/assets/:id - Delete asset from filesystem
router.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const includeVariants = c.req.query('includeVariants') === 'true'

    await assetService.deleteAsset(id, includeVariants)

    return c.json({
      success: true,
      message: `Asset ${id} deleted successfully`
    })
  } catch (error) {
    if (error.message && error.message.includes('not found')) {
      return c.json({ error: 'Asset not found' }, 404)
    }
    console.error('[Legacy Assets] Error deleting asset:', error)
    return c.json({ error: 'Failed to delete asset' }, 500)
  }
})

// PATCH /api/assets/:id - Update asset metadata
router.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const updates = await c.req.json()

    const updatedAsset = await assetService.updateAsset(id, updates)

    if (!updatedAsset) {
      return c.json({ error: 'Asset not found' }, 404)
    }

    return c.json(updatedAsset)
  } catch (error) {
    console.error('[Legacy Assets] Error updating asset:', error)
    return c.json({ error: 'Failed to update asset' }, 500)
  }
})

// POST /api/assets/:id/sprites - Save sprite sheet for asset
router.post('/:id/sprites', async (c) => {
  try {
    const id = c.req.param('id')
    const { sprites, config } = await c.req.json()

    console.log(`[Sprites] Saving ${sprites?.length || 0} sprites for asset: ${id}`)

    if (!sprites || !Array.isArray(sprites)) {
      return c.json({ error: 'Invalid sprites data' }, 400)
    }

    // Create sprites directory
    const assetDir = path.join(ROOT_DIR, 'gdd-assets', id)
    const spritesDir = path.join(assetDir, 'sprites')

    console.log(`[Sprites] Creating directory: ${spritesDir}`)
    await fs.promises.mkdir(spritesDir, { recursive: true })

    // Save each sprite image
    for (const sprite of sprites) {
      const { angle, imageData } = sprite

      // Extract base64 data from data URL
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')

      // Save as PNG file
      const filename = `${angle}deg.png`
      const filepath = path.join(spritesDir, filename)
      await fs.promises.writeFile(filepath, buffer)
      console.log(`[Sprites] Saved: ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`)
    }

    // Save sprite metadata
    const spriteMetadata = {
      assetId: id,
      config: config || {},
      angles: sprites.map(s => s.angle),
      spriteCount: sprites.length,
      status: 'completed',
      generatedAt: new Date().toISOString()
    }

    const metadataPath = path.join(assetDir, 'sprite-metadata.json')
    await fs.promises.writeFile(metadataPath, JSON.stringify(spriteMetadata, null, 2))
    console.log(`[Sprites] Saved sprite-metadata.json`)

    // Update asset metadata to indicate sprites are available
    const assetMetadataPath = path.join(assetDir, 'metadata.json')
    const currentMetadata = JSON.parse(await fs.promises.readFile(assetMetadataPath, 'utf-8'))

    // Update with sprite info
    const updatedMetadata = {
      ...currentMetadata,
      hasSpriteSheet: true,
      spriteCount: sprites.length,
      spriteConfig: config,
      lastSpriteGeneration: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await fs.promises.writeFile(assetMetadataPath, JSON.stringify(updatedMetadata, null, 2))
    console.log(`[Sprites] Updated asset metadata with sprite info`)

    return c.json({
      success: true,
      message: `${sprites.length} sprites saved successfully`,
      spritesDir: `gdd-assets/${id}/sprites`,
      spriteFiles: sprites.map(s => `${s.angle}deg.png`)
    })
  } catch (error) {
    console.error('[Sprites] Failed to save sprites:', error)
    return c.json({ error: 'Failed to save sprites' }, 500)
  }
})

export default router
