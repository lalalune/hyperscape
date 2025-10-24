/**
 * Validated Sprite Upload Route
 * Handles sprite uploads with comprehensive validation
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { validateBase64Image, validateImageBuffer, validateTotalSize, FileValidationError } from '../utils/fileValidation.mjs'
import { validateAssetId } from '../utils/validators.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '../../')

/**
 * POST /api/assets/:id/sprites
 * Upload and validate sprite images for an asset
 */
export async function POST_saveSprites(req, res, next) {
  try {
    // Validate asset ID to prevent path traversal
    const assetId = validateAssetId(req.params.id)
    const { sprites, config } = req.body

    console.log(`[Sprites] Saving ${sprites?.length || 0} sprites for asset: ${assetId}`)

    // Validate sprites array
    if (!sprites || !Array.isArray(sprites)) {
      return res.status(400).json({ error: 'sprites must be an array' })
    }

    // Validate sprite count
    if (sprites.length === 0) {
      return res.status(400).json({ error: 'No sprites provided' })
    }

    if (sprites.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 sprites per upload' })
    }

    // Validate each sprite
    const validatedSprites = []
    let totalSize = 0

    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i]

      // Validate sprite has required fields
      if (!sprite.angle || !sprite.imageData) {
        return res.status(400).json({
          error: `Sprite ${i} missing required fields (angle, imageData)`,
          spriteIndex: i
        })
      }

      try {
        // Decode and validate base64
        const buffer = validateBase64Image(sprite.imageData)

        // Validate image format and size
        const validation = await validateImageBuffer(buffer)

        validatedSprites.push({
          index: i,
          angle: sprite.angle,
          buffer,
          size: buffer.length,
          ...validation
        })

        totalSize += buffer.length

      } catch (error) {
        if (error instanceof FileValidationError) {
          return res.status(400).json({
            error: `Sprite ${i} validation failed: ${error.message}`,
            code: error.code,
            spriteIndex: i
          })
        }
        throw error
      }
    }

    // Validate total size
    try {
      validateTotalSize(validatedSprites.map(s => ({ size: s.size })))
    } catch (error) {
      if (error instanceof FileValidationError) {
        return res.status(400).json({ error: error.message, code: error.code })
      }
      throw error
    }

    console.log(`[Sprites] ✅ All ${validatedSprites.length} sprites validated successfully (total: ${formatBytes(totalSize)})`)

    // Create sprites directory
    const assetDir = path.join(ROOT_DIR, 'gdd-assets', assetId)
    const spritesDir = path.join(assetDir, 'sprites')

    console.log(`[Sprites] Creating directory: ${spritesDir}`)
    await fs.mkdir(spritesDir, { recursive: true })

    // Save each validated sprite
    const savedSprites = []

    for (const sprite of validatedSprites) {
      // Save as PNG file
      const filename = `${sprite.angle}deg.png`
      const filepath = path.join(spritesDir, filename)
      await fs.writeFile(filepath, sprite.buffer)
      console.log(`[Sprites] Saved: ${filename} (${formatBytes(sprite.size)})`)

      savedSprites.push({
        angle: sprite.angle,
        filename,
        size: sprite.size,
        mimeType: sprite.mimeType
      })
    }

    // Save sprite metadata
    const spriteMetadata = {
      assetId: assetId,
      config: config || {},
      angles: validatedSprites.map(s => s.angle),
      spriteCount: validatedSprites.length,
      status: 'completed',
      generatedAt: new Date().toISOString(),
      totalSizeBytes: totalSize
    }

    const metadataPath = path.join(assetDir, 'sprite-metadata.json')
    await fs.writeFile(metadataPath, JSON.stringify(spriteMetadata, null, 2))
    console.log(`[Sprites] Saved sprite-metadata.json`)

    // Update asset metadata to indicate sprites are available
    try {
      const assetMetadataPath = path.join(assetDir, 'metadata.json')
      const currentMetadata = JSON.parse(await fs.readFile(assetMetadataPath, 'utf-8'))

      // Update with sprite info
      const updatedMetadata = {
        ...currentMetadata,
        hasSpriteSheet: true,
        spriteCount: validatedSprites.length,
        spriteConfig: config,
        lastSpriteGeneration: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await fs.writeFile(assetMetadataPath, JSON.stringify(updatedMetadata, null, 2))
      console.log(`[Sprites] Updated asset metadata with sprite info`)
    } catch (metadataError) {
      // Non-fatal - metadata update is optional
      console.warn(`[Sprites] Could not update asset metadata:`, metadataError.message)
    }

    res.json({
      success: true,
      message: `${validatedSprites.length} sprites saved successfully`,
      spritesDir: `gdd-assets/${assetId}/sprites`,
      spriteCount: validatedSprites.length,
      totalSize: totalSize,
      sprites: savedSprites
    })
  } catch (error) {
    console.error('[Sprites] Failed to save sprites:', error)
    next(error)
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}
