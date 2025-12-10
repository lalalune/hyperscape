/**
 * Generation API Server
 * Provides endpoints for AI-powered 3D asset generation
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { errorHandler } from './middleware/errorHandler.mjs'
import { AssetService } from './services/AssetService.mjs'
import { RetextureService } from './services/RetextureService.mjs'
import { GenerationService } from './services/GenerationService.mjs'
import { getWeaponDetectionPrompts } from './utils/promptLoader.mjs'
import promptRoutes from './routes/promptRoutes.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

// Initialize Express app with security middleware
const app = express()

// Basic CORS headers (simplified without cors package)
app.use((req, res, next) => {
  const origin = process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || '*'
    : req.headers.origin || 'http://localhost:3003'
  
  res.header('Access-Control-Allow-Origin', origin)
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Credentials', 'true')
  
  // Security headers (basic OWASP without helmet)
  res.header('X-Content-Type-Options', 'nosniff')
  res.header('X-Frame-Options', 'DENY')
  res.header('X-XSS-Protection', '1; mode=block')
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  
  next()
})

// Body parsing (allow larger payloads for base64 images)
app.use(express.json({ limit: '25mb' }))

// Static file serving with security headers
app.use('/assets', express.static(path.join(ROOT_DIR, 'public/assets'), {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff')
  }
}))

// Initialize services
const assetService = new AssetService(path.join(ROOT_DIR, 'gdd-assets'))
const retextureService = new RetextureService({
  meshyApiKey: process.env.MESHY_API_KEY || '',
  imageServerBaseUrl: process.env.IMAGE_SERVER_URL || 'http://localhost:8080'
})
const generationService = new GenerationService()

// Use prompt routes
app.use('/api', promptRoutes)

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      meshy: !!process.env.MESHY_API_KEY,
      openai: !!process.env.OPENAI_API_KEY
    }
  })
})

app.get('/api/assets', async (req, res, next) => {
  try {
    // Set no-cache headers
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })
    
    const assets = await assetService.listAssets()
    res.json(assets)
  } catch (error) {
    next(error)
  }
})

app.head('/api/assets/:id/model', async (req, res, next) => {
  try {
    const modelPath = await assetService.getModelPath(req.params.id)
    // Just send headers, no body for HEAD request
    res.status(200).end()
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).end()
    } else {
      res.status(500).end()
    }
  }
})

app.get('/api/assets/:id/model', async (req, res, next) => {
  try {
    const modelPath = await assetService.getModelPath(req.params.id)
    res.sendFile(modelPath)
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message })
    } else {
      next(error)
    }
  }
})

// Serve any file from an asset directory (including animations)
app.get('/api/assets/:id/*', async (req, res, next) => {
  try {
    const assetId = req.params.id
    const filePath = req.params[0] // Gets everything after the asset ID
    
    const fullPath = path.join(ROOT_DIR, 'gdd-assets', assetId, filePath)
    
    // Security check to prevent directory traversal
    const normalizedPath = path.normalize(fullPath)
    const assetDir = path.join(ROOT_DIR, 'gdd-assets', assetId)
    if (!normalizedPath.startsWith(assetDir)) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    // Check if file exists
    try {
      await fs.promises.access(fullPath)
    } catch {
      return res.status(404).json({ error: 'File not found' })
    }
    
    res.sendFile(fullPath)
  } catch (error) {
    next(error)
  }
})

// Get sprite metadata - COMMENTED OUT AS UNUSED
/*
app.get('/api/assets/:id/sprite-metadata.json', async (req, res, next) => {
  try {
    const assetDir = path.join(process.cwd(), 'gdd-assets', req.params.id)
    const spritePath = path.join(assetDir, 'sprite-metadata.json')
    
    if (fs.existsSync(spritePath)) {
      res.sendFile(spritePath)
    } else {
      res.status(404).json({ error: 'Sprite metadata not found' })
    }
  } catch (error) {
    next(error)
  }
})
*/

// Get vertex colors
/* Vertex colors endpoint disabled
app.get('/api/assets/:id/vertex-colors.json', async (req, res, next) => {
  try {
    const assetDir = path.join(ROOT_DIR, 'gdd-assets', req.params.id)
    const vertexPath = path.join(assetDir, 'vertex-colors.json')
    const exists = await fs.access(vertexPath).then(() => true).catch(() => false)
    
    if (!exists) {
      return res.status(404).json({ error: 'Vertex colors not found' })
    }
    
    const data = await fs.readFile(vertexPath, 'utf-8')
    res.json(JSON.parse(data))
  } catch (error) {
    next(error)
  }
})
*/

// DELETE endpoint
app.delete('/api/assets/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { includeVariants } = req.query
    
    await assetService.deleteAsset(id, includeVariants === 'true')
    
    res.json({ 
      success: true, 
      message: `Asset ${id} deleted successfully` 
    })
  } catch (error) {
    // If the error is "Asset not found", return 404
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ error: 'Asset not found' })
    }
    next(error)
  }
})

// Update asset metadata
app.patch('/api/assets/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    const updatedAsset = await assetService.updateAsset(id, updates)
    
    if (!updatedAsset) {
      return res.status(404).json({ error: 'Asset not found' })
    }
    
    res.json(updatedAsset)
  } catch (error) {
    next(error)
  }
})

// Save sprites for an asset
app.post('/api/assets/:id/sprites', async (req, res, next) => {
  try {
    const { id } = req.params
    const { sprites, config } = req.body
    
    console.log(`[Sprites] Saving ${sprites?.length || 0} sprites for asset: ${id}`)
    
    if (!sprites || !Array.isArray(sprites)) {
      return res.status(400).json({ error: 'Invalid sprites data' })
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
    // Read current metadata
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
    
    res.json({ 
      success: true, 
      message: `${sprites.length} sprites saved successfully`,
      spritesDir: `gdd-assets/${id}/sprites`,
      spriteFiles: sprites.map(s => `${s.angle}deg.png`)
    })
  } catch (error) {
    console.error('[Sprites] Failed to save sprites:', error)
    next(error)
  }
})

app.get('/api/material-presets', async (req, res, next) => {
  try {
    const presetsPath = path.join(ROOT_DIR, 'public/prompts/material-presets.json')
    const presets = JSON.parse(await fs.promises.readFile(presetsPath, 'utf-8'))
    res.json(presets)
  } catch (error) {
    next(error)
  }
})

app.post('/api/material-presets', async (req, res, next) => {
  try {
    const presets = req.body
    
    // Validate that presets is an array
    if (!Array.isArray(presets)) {
      return res.status(400).json({ error: 'Material presets must be an array' })
    }
    
    // Validate each preset has required fields
    for (const preset of presets) {
      if (!preset.id || !preset.name || !preset.displayName || !preset.stylePrompt) {
        return res.status(400).json({ error: 'Each preset must have id, name, displayName, and stylePrompt' })
      }
    }
    
    // Save to file
    const presetsPath = path.join(ROOT_DIR, 'public/prompts/material-presets.json')
    await fs.promises.writeFile(presetsPath, JSON.stringify(presets, null, 2), 'utf-8')
    
    res.json({ success: true, message: 'Material presets saved successfully' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/retexture', async (req, res, next) => {
  try {
    const { baseAssetId, materialPreset, outputName } = req.body
    
    // Validate input
    if (!baseAssetId || !materialPreset) {
      return res.status(400).json({ 
        error: 'baseAssetId and materialPreset are required' 
      })
    }

    const result = await retextureService.retexture({
      baseAssetId,
      materialPreset,
      outputName,
      assetsDir: path.join(ROOT_DIR, 'gdd-assets')
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/regenerate-base/:baseAssetId', async (req, res, next) => {
  try {
    const { baseAssetId } = req.params
    
    const result = await retextureService.regenerateBase({
      baseAssetId,
      assetsDir: path.join(ROOT_DIR, 'gdd-assets')
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

// Generation pipeline endpoints
app.post('/api/generation/pipeline', async (req, res, next) => {
  try {
    const config = req.body
    
    // Validate required fields
    if (!config.name || !config.type || !config.subtype) {
      return res.status(400).json({
        error: 'name, type, and subtype are required'
      })
    }
    
    const result = await generationService.startPipeline(config)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.get('/api/generation/pipeline/:pipelineId', async (req, res, next) => {
  try {
    const { pipelineId } = req.params
    const status = await generationService.getPipelineStatus(pipelineId)
    res.json(status)
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message })
    } else {
      next(error)
    }
  }
})

// Weapon handle detection endpoint
app.post('/api/weapon-handle-detect', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    const { image, angle, promptHint } = req.body // Base64 image, angle info, and prompt hint

    if (!image) {
      throw new Error('No image provided')
    }

    // Load weapon detection prompts
    const weaponPrompts = await getWeaponDetectionPrompts()
    
    // Build the prompt with optional hint
    const basePromptTemplate = weaponPrompts?.basePrompt || 
      `You are analyzing a 3D weapon rendered from the \${angle || 'side'} in a 512x512 pixel image.
The weapon is oriented vertically with the blade/head pointing UP and handle pointing DOWN.

YOUR TASK: Identify ONLY the HANDLE/GRIP area where a human hand would hold this weapon.

CRITICAL DISTINCTIONS:
- HANDLE/GRIP: The narrow cylindrical part designed for holding (usually wrapped, textured, or darker)
- BLADE: The wide, flat, sharp part used for cutting (usually metallic, reflective, lighter)
- GUARD/CROSSGUARD: The horizontal piece between blade and handle
- POMMEL: The weighted end piece at the very bottom of the handle

For a SWORD specifically:
- The HANDLE is the wrapped/textured section BELOW the guard/crossguard
- It's typically 15-25% of the total weapon length
- It's narrower than the blade
- It often has visible wrapping, leather, or grip texture
- The grip is NEVER on the blade itself

VISUAL CUES for the handle:
1. Look for texture changes (wrapped vs smooth metal)
2. Look for width changes (handle is narrower than blade)
3. Look for the crossguard/guard that separates blade from handle
4. The handle is typically in the LOWER portion of the weapon
5. If you see a wide, flat, metallic surface - that's the BLADE, not the handle!`
    
    // Replace template variables
    let promptText = basePromptTemplate.replace('${angle || \'side\'}', angle || 'side')

    if (promptHint) {
      const additionalGuidance = weaponPrompts?.additionalGuidance || '\n\nAdditional guidance: ${promptHint}'
      promptText += additionalGuidance.replace('${promptHint}', promptHint)
    }

    // Add restrictions
    const restrictions = weaponPrompts?.restrictions || 
      `\n\nDO NOT select:
- The blade (wide, flat, sharp part)
- The guard/crossguard
- Decorative elements
- The pommel alone

ONLY select the cylindrical grip area where fingers would wrap around.`
    
    promptText += restrictions
    
    // Add response format
    const responseFormat = weaponPrompts?.responseFormat ||
      `\n\nRespond with ONLY a JSON object in this exact format:
{
  "gripBounds": {
    "minX": <pixel coordinate 0-512>,
    "minY": <pixel coordinate 0-512>,
    "maxX": <pixel coordinate 0-512>,
    "maxY": <pixel coordinate 0-512>
  },
  "confidence": <number 0-1>,
  "weaponType": "<sword|axe|mace|staff|bow|dagger|spear|etc>",
  "gripDescription": "<brief description of grip location>",
  "detectedParts": {
    "blade": "<describe what you identified as the blade>",
    "handle": "<describe what you identified as the handle>",
    "guard": "<describe if you see a guard/crossguard>"
  }
}`
    
    promptText += responseFormat

    // Use GPT-4 Vision to analyze the weapon and identify grip location
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptText
              },
              { type: "image_url", image_url: { url: image, detail: "high" } }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.3, // Lower temperature for more consistent results
        response_format: { type: "json_object" }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    let gripData

    try {
      gripData = JSON.parse(data.choices[0].message.content)
    } catch (parseError) {
      // If parsing fails, return default values
      gripData = {
        gripBounds: { minX: 200, minY: 350, maxX: 300, maxY: 450 },
        confidence: 0.5,
        weaponType: "unknown",
        gripDescription: "Unable to parse AI response",
        orientation: "vertical"
      }
    }

    res.json({
      success: true,
      gripData,
      originalImage: image
    })
  } catch (error) {
    console.error('Weapon handle detection error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Weapon orientation detection endpoint
app.post('/api/weapon-orientation-detect', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    const { image } = req.body

    if (!image) {
      throw new Error('No image provided')
    }

    const promptText = `You are analyzing a 3D weapon that should be oriented vertically.

CRITICAL TASK: Determine if this weapon is upside down and needs to be flipped 180 degrees.

CORRECT ORIENTATION:
- The HANDLE/GRIP should be at the BOTTOM
- The BLADE/HEAD/BUSINESS END should be at the TOP

For different weapons:
- SWORD: Blade should point UP, handle/grip DOWN  
- AXE: Axe head UP, wooden handle DOWN  
- MACE: Heavy spiked head UP, shaft/handle DOWN
- HAMMER: Hammer head UP, handle DOWN
- STAFF: Usually symmetrical but decorative end UP
- SPEAR: Pointed tip UP, shaft DOWN
- DAGGER: Blade UP, handle DOWN

Look for these visual cues:
1. Handles are usually narrower, wrapped, or textured
2. Blades/heads are usually wider, metallic, or decorative
3. The "heavy" or "dangerous" end should be UP
4. The "holding" end should be DOWN

Respond with ONLY a JSON object:
{
  "needsFlip": <true if weapon is upside down, false if correctly oriented>,
  "currentOrientation": "<describe what you see at top and bottom>",
  "reason": "<brief explanation of your decision>"
}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "image_url", image_url: { url: image, detail: "high" } }
            ]
          }
        ],
        max_tokens: 200,
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    let orientationData

    try {
      orientationData = JSON.parse(data.choices[0].message.content)
    } catch (parseError) {
      orientationData = {
        needsFlip: false,
        currentOrientation: "Unable to parse AI response",
        reason: "Parse error - assuming correct orientation"
      }
    }

    res.json({
      success: true,
      ...orientationData
    })
  } catch (error) {
    console.error('Weapon orientation detection error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Error handling middleware
app.use(errorHandler)

// Start server
const PORT = process.env.API_PORT || 5004
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
  
  if (!process.env.MESHY_API_KEY) {
    console.warn('⚠️  MESHY_API_KEY not found - retexturing will fail')
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not found - base regeneration will fail')
  }
})