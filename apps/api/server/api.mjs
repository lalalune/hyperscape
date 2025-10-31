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
import { requestLogger } from './middleware/requestLogger.mjs'
import { requireAuth } from './middleware/auth.mjs'
import { resolveMeshyKey } from './middleware/api-key-resolver.mjs'
import { AssetService } from './services/AssetService.mjs'
import { RetextureService } from './services/RetextureService.mjs'
import { GenerationService } from './services/GenerationService.mjs'
import { getWeaponDetectionPrompts } from './utils/promptLoader.mjs'
import promptRoutes from './routes/promptRoutes.mjs'
import projectsRoutes from './routes/projects.mjs'
import teamsRoutes from './routes/teams.mjs'
import usersRoutes from './routes/users.mjs'
import assetsRoutes from './routes/assets.mjs'
import adminRoutes from './routes/admin.mjs'
import adminModelsRoutes from './routes/admin-models.mjs'
import adminLogsRoutes from './routes/admin-logs.mjs'
import modelsRoutes from './routes/models.mjs'
import aiGatewayRoutes from './routes/ai-gateway.mjs'
import apiKeysRoutes from './routes/api-keys.mjs'
import manifestsRoutes from './routes/manifests.mjs'
import previewManifestsRoutes from './routes/preview-manifests.mjs'
import submissionsRoutes from './routes/submissions.mjs'
import adminApprovalsRoutes from './routes/admin-approvals.mjs'
import aiContextRoutes from './routes/ai-context.mjs'
import embeddingsRoutes from './routes/embeddings.mjs'
import voiceAssignmentsRoutes from './routes/voice-assignments.mjs'
import questsRoutes from './routes/quests.mjs'
import contentGenerationRoutes from './routes/content-generation.mjs'
import multiAgentRoutes from './routes/multi-agent.mjs'
import voiceGenerationRoutes from './routes/voice-generation.mjs'
import soundEffectsRoutes from './routes/sound-effects.mjs'
import musicRoutes from './routes/music.mjs'
import './database/db.mjs' // Initialize database connection

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

// Initialize Express app with security middleware
const app = express()

// ----- Secure CORS headers -----
// Define whitelist of allowed origins
const allowedOrigins = (
  process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || process.env.ALLOWED_CORS_ORIGINS || '').split(',').map(origin => origin.replace(/\/$/, '').trim())
    : [
        'http://localhost:3000',
        // Add other local/test origins if needed
      ]
)

// Clean up whitelist: remove empty entries, filter out 'null' origin
const sanitizedAllowedOrigins = allowedOrigins
  .filter(Boolean)
  .filter(origin => origin !== 'null')

// Middleware
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin
  let corsOrigin = null

  if (requestOrigin && sanitizedAllowedOrigins.includes(requestOrigin)) {
    corsOrigin = requestOrigin
  } else if (!requestOrigin && process.env.NODE_ENV !== 'production') {
    // default to first dev origin if not set
    corsOrigin = sanitizedAllowedOrigins[0]
  }

  if (corsOrigin) {
    res.header('Access-Control-Allow-Origin', corsOrigin)
    res.header('Access-Control-Allow-Credentials', 'true')
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires, x-user-id, x-wallet-address')
  res.header('Access-Control-Expose-Headers', 'Cache-Control, Pragma, Expires')

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

// Request logging middleware (logs all API calls)
app.use(requestLogger)

// Static file serving with security headers
app.use('/assets', express.static(path.join(ROOT_DIR, 'public/assets'), {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff')
  }
}))

// Serve 3D models from monorepo assets directory
// Using /models path to avoid conflict with /assets route
// For monorepo deployment: Railway deploys entire repo, so assets are at ../../../assets/world
// For local dev: Same monorepo structure
function getAssetsWorldPath() {
  // Environment variable takes precedence
  if (process.env.ASSETS_WORLD_PATH) {
    return process.env.ASSETS_WORLD_PATH
  }

  // Monorepo deployment (Railway deploys entire repo from root)
  // From: /apps/api/server/api.mjs
  // To:   /assets/world
  const monorepoPath = path.resolve(ROOT_DIR, '../../assets/world')
  if (fs.existsSync(monorepoPath)) {
    return monorepoPath
  }

  // Fallback: Check Railway absolute path (in case of custom deployment)
  const railwayPath = '/app/assets/world'
  if (fs.existsSync(railwayPath)) {
    return railwayPath
  }

  // If no path exists, return monorepo path (will log error when accessed)
  console.warn('[Assets] Warning: assets/world directory not found at expected locations')
  return monorepoPath
}

const assetsWorldPath = getAssetsWorldPath()
const modelsPath = path.join(assetsWorldPath, 'models')
console.log(`[Models] Serving 3D models from: ${modelsPath}`)
app.use('/models', express.static(modelsPath, {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff')
  }
}))

// Serve temp images for Meshy.ai concept art (merged from separate image server)
// Ensure temp-images directory exists
await fs.promises.mkdir(path.join(ROOT_DIR, 'temp-images'), { recursive: true })
app.use('/temp-images', express.static(path.join(ROOT_DIR, 'temp-images'), {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Access-Control-Allow-Origin', '*') // Allow Meshy.ai to fetch images
  }
}))

// Initialize services
const assetService = new AssetService(path.join(ROOT_DIR, 'gdd-assets'))
const apiPort = process.env.API_PORT || 3004
const generationService = new GenerationService()

// Use routes
app.use('/api', promptRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/teams', teamsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/models', adminModelsRoutes)
app.use('/api/admin/logs', adminLogsRoutes)
app.use('/api/models', modelsRoutes)
app.use('/api/ai-gateway', aiGatewayRoutes)
app.use('/api/api-keys', apiKeysRoutes)
app.use('/api/manifests', manifestsRoutes)
app.use('/api/preview-manifests', previewManifestsRoutes)
app.use('/api/submissions', submissionsRoutes)
app.use('/api/admin/submissions', adminApprovalsRoutes)
app.use('/api/ai-context', aiContextRoutes)
app.use('/api/embeddings', embeddingsRoutes)
app.use('/api/voice-assignments', voiceAssignmentsRoutes)
app.use('/api/quests', questsRoutes)
app.use('/api', contentGenerationRoutes)
app.use('/api', multiAgentRoutes)
app.use('/api/voice', voiceGenerationRoutes)
app.use('/api/sfx', soundEffectsRoutes)
app.use('/api/music', musicRoutes)

// Database-driven Assets API
// NOTE: This conflicts with the file-based asset endpoints below (lines 101-247)
// Registered at /api/v2/assets to avoid breaking existing file-based functionality
// TODO: Migrate to unified asset management system
app.use('/api/v2/assets', assetsRoutes)

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

// Frontend error logging endpoint
app.post('/api/errors/frontend', (req, res) => {
  try {
    const { error, errorInfo, componentStack, url, timestamp, userAgent } = req.body
    
    console.error('[Frontend Error]', {
      timestamp: timestamp || new Date().toISOString(),
      error: error || 'Unknown error',
      url: url || 'Unknown URL',
      userAgent: userAgent || req.headers['user-agent'],
      errorInfo,
      componentStack: componentStack?.substring(0, 500) // Truncate long stacks
    })
    
    res.status(200).json({ success: true, message: 'Error logged' })
  } catch (err) {
    console.error('[Frontend Error] Failed to log:', err)
    res.status(500).json({ success: false, error: 'Failed to log error' })
  }
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
app.get(/^\/api\/assets\/([^\/]+)\/(.+)$/, async (req, res, next) => {
  try {
    const assetId = req.params[0]
    const filePath = req.params[1] // Gets everything after the asset ID

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

app.post('/api/retexture', requireAuth, resolveMeshyKey, async (req, res, next) => {
  try {
    const { baseAssetId, materialPreset, outputName } = req.body
    
    // Validate input
    if (!baseAssetId || !materialPreset) {
      return res.status(400).json({ 
        error: 'baseAssetId and materialPreset are required' 
      })
    }

    // Use resolved Meshy API key from middleware
    const apiKey = req.resolvedApiKeys.meshy

    // Create service instance with user's API key
    const userRetextureService = new RetextureService(apiKey)
    const result = await userRetextureService.retexture({
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

app.post('/api/regenerate-base/:baseAssetId', requireAuth, resolveMeshyKey, async (req, res, next) => {
  try {
    const { baseAssetId } = req.params
    
    // Use resolved Meshy API key from middleware
    const apiKey = req.resolvedApiKeys.meshy

    // Create service instance with user's API key
    const userRetextureService = new RetextureService(apiKey)
    const result = await userRetextureService.regenerateBase({
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
const PORT = process.env.PORT || process.env.API_PORT || 3004
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'
app.listen(PORT, HOST, () => {
  console.log(`🚀 API Server running on http://${HOST}:${PORT}`)
  console.log(`📊 Health check: http://${HOST}:${PORT}/api/health`)

  // Optional: Warn about missing default API keys
  // Note: Users can provide their own API keys via the UI per-request
  if (!process.env.MESHY_API_KEY) {
    console.log('ℹ️  MESHY_API_KEY not set (users can provide their own keys via UI)')
  }
  if (!process.env.OPENAI_API_KEY) {
    console.log('ℹ️  OPENAI_API_KEY not set (users can provide their own keys via UI)')
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    console.log('ℹ️  ELEVENLABS_API_KEY not set (users can provide their own keys via UI)')
  }
})