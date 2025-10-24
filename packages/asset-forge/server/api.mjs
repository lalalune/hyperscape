/**
 * Generation API Server
 * Provides endpoints for AI-powered 3D asset generation
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'
import { errorHandler } from './middleware/errorHandler.mjs'
import { authenticateUser, optionalAuth } from './middleware/auth.mjs'
import { validatePrivyConfig } from './auth/privy.mjs'
import { AssetService } from './services/AssetService.mjs'
import { RetextureService } from './services/RetextureService.mjs'
import { GenerationService } from './services/GenerationService.mjs'
import { getWeaponDetectionPrompts } from './utils/promptLoader.mjs'
import { validateBase64Image, validateImageBuffer, validateTotalSize, FileValidationError } from './utils/fileValidation.mjs'
import { validateAssetId, validatePipelineId } from './utils/validators.mjs'
import { closeDatabase } from './db/index.mjs'
import promptRoutes from './routes/promptRoutes.mjs'
import { POST as generateDialogue } from './routes/generate-dialogue.mjs'
import { POST as generateNPC } from './routes/generate-npc.mjs'
import { POST as generateQuest } from './routes/generate-quest.mjs'
import { POST as generateNPCCollaboration } from './routes/generate-npc-collaboration.mjs'
import { POST as generatePlaytesterSwarm, GET as getPlaytesterPersonas } from './routes/generate-playtester-swarm.mjs'
import { getSeedContent } from './data/seed-content.mjs'
import {
  GET_library as getVoiceLibrary,
  POST_generate as generateVoice,
  POST_batch as generateVoiceBatch,
  GET_profile as getVoiceProfile,
  DELETE_voice as deleteVoice,
  POST_estimate as estimateVoiceCost,
  GET_subscription as getVoiceSubscription,
  GET_models as getVoiceModels
} from './routes/generate-voice.mjs'
import {
  POST_assign as assignVoiceToManifest,
  GET_assignment as getManifestVoiceAssignment,
  GET_bulk as getBulkManifestVoiceAssignments,
  DELETE_assignment as deleteManifestVoiceAssignment,
  POST_bulkAssign as bulkAssignManifestVoices,
  POST_generateSample as generateManifestSampleDialogue
} from './routes/voice-manifest.mjs'

// Auth routes
import { POST_login, GET_me, POST_logout } from './routes/auth.mjs'

// Admin routes
import {
  POST_addToWhitelist,
  POST_removeFromWhitelist,
  GET_whitelist,
  GET_allUsers,
  GET_stats,
  GET_activity,
  requireAdmin
} from './routes/admin.mjs'

// User routes
import {
  GET_profile,
  PUT_profile,
  GET_usage,
  GET_history,
  DELETE_account,
  POST_export
} from './routes/user.mjs'

// API Keys routes
import {
  POST_addApiKey,
  GET_apiKeys,
  PUT_updateApiKey,
  DELETE_apiKey
} from './routes/api-keys.mjs'

// Projects routes
import {
  POST_createProject,
  GET_projects,
  GET_project,
  PUT_updateProject,
  DELETE_project,
  POST_shareProject
} from './routes/projects.mjs'

// Teams routes
import {
  POST_createTeam,
  GET_teamPreview,
  POST_joinTeam,
  GET_myTeam,
  GET_teamMembers,
  POST_leaveTeam,
  DELETE_team,
  PUT_updateTeam,
  DELETE_removeMember,
  POST_transferOwnership
} from './routes/teams.mjs'

// Import constants
import {
  DEFAULT_API_PORT,
  DEFAULT_IMAGE_SERVER_URL,
  DEFAULT_FRONTEND_URL
} from '../src/constants/network.ts'
import {
  RATE_LIMIT_WINDOW,
  SHUTDOWN_TIMEOUT
} from '../src/constants/timeouts.ts'
import {
  RATE_LIMIT_MAX_REQUESTS,
  MAX_TOKENS_MEDIUM,
  MAX_TOKENS_SHORT
} from '../src/constants/limits.ts'
import {
  MEDIUM_TEMPERATURE,
  LOW_TEMPERATURE
} from '../src/constants/dimensions.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

// Validate critical configuration at startup
try {
  validatePrivyConfig()
} catch (error) {
  console.error('\n' + error.message + '\n')
  process.exit(1)
}

// Rate limiter for manifest download endpoint
const manifestRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
})

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  console.error('FATAL: FRONTEND_URL is required in production for CORS security')
  process.exit(1)
}

// Initialize Express app with security middleware
const app = express()

// CORS configuration - no wildcards in production
app.use((req, res, next) => {
  // In production, FRONTEND_URL is required (validated above)
  // In development, allow localhost origins
  const origin = process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : req.headers.origin || DEFAULT_FRONTEND_URL

  res.header('Access-Control-Allow-Origin', origin)
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
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
  imageServerBaseUrl: process.env.IMAGE_SERVER_URL || DEFAULT_IMAGE_SERVER_URL
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
      openai: !!process.env.OPENAI_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY
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
    // Validate asset ID to prevent path traversal
    const assetId = validateAssetId(req.params.id)
    const modelPath = await assetService.getModelPath(assetId)
    // Just send headers, no body for HEAD request
    res.status(200).end()
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Invalid asset ID')) {
      res.status(404).end()
    } else {
      res.status(500).end()
    }
  }
})

app.get('/api/assets/:id/model', async (req, res, next) => {
  try {
    // Validate asset ID to prevent path traversal
    const assetId = validateAssetId(req.params.id)
    const modelPath = await assetService.getModelPath(assetId)
    res.sendFile(modelPath)
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Invalid asset ID')) {
      res.status(404).json({ error: error.message })
    } else {
      next(error)
    }
  }
})

// Serve manifests from Hyperscape server world/assets/manifests
app.get('/api/manifests/:type.json', manifestRateLimiter, async (req, res, next) => {
  try {
    const manifestType = req.params.type
    
    // Security check - only allow specific manifest types
    const allowedTypes = ['items', 'mobs', 'npcs', 'resources', 'world-areas', 'biomes', 'zones', 'banks', 'stores']
    if (!allowedTypes.includes(manifestType)) {
      return res.status(403).json({ error: 'Invalid manifest type' })
    }
    
    const manifestPath = path.join(ROOT_DIR, '..', 'server', 'world', 'assets', 'manifests', `${manifestType}.json`)

    // Check if file exists
    try {
      await fs.promises.access(manifestPath)
      res.sendFile(manifestPath)
    } catch {
      return res.status(404).json({ error: 'Manifest not found' })
    }
  } catch (error) {
    next(error)
  }
})

// Serve any file from an asset directory (including animations)
app.get('/api/assets/:id/*', async (req, res, next) => {
  try {
    // Validate asset ID to prevent path traversal
    const assetId = validateAssetId(req.params.id)
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
app.delete('/api/assets/:id', authenticateUser, async (req, res, next) => {
  try {
    // Validate asset ID to prevent path traversal
    const assetId = validateAssetId(req.params.id)
    const { includeVariants } = req.query

    await assetService.deleteAsset(assetId, includeVariants === 'true')

    res.json({
      success: true,
      message: `Asset ${assetId} deleted successfully`
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
app.patch('/api/assets/:id', authenticateUser, async (req, res, next) => {
  try {
    // Validate asset ID to prevent path traversal
    const assetId = validateAssetId(req.params.id)
    const updates = req.body

    const updatedAsset = await assetService.updateAsset(assetId, updates)

    if (!updatedAsset) {
      return res.status(404).json({ error: 'Asset not found' })
    }

    res.json(updatedAsset)
  } catch (error) {
    next(error)
  }
})

// Save sprites for an asset
app.post('/api/assets/:id/sprites', authenticateUser, async (req, res, next) => {
  try {
    // Validate asset ID to prevent path traversal
    const assetId = validateAssetId(req.params.id)
    const { sprites, config } = req.body

    console.log(`[Sprites] Saving ${sprites?.length || 0} sprites for asset: ${assetId}`)

    if (!sprites || !Array.isArray(sprites)) {
      return res.status(400).json({ error: 'Invalid sprites data' })
    }

    // Create sprites directory
    const assetDir = path.join(ROOT_DIR, 'gdd-assets', assetId)
    const spritesDir = path.join(assetDir, 'sprites')
    
    console.log(`[Sprites] Creating directory: ${spritesDir}`)
    await fs.promises.mkdir(spritesDir, { recursive: true })
    
    // Save each sprite image
    for (const sprite of sprites) {
      const { angle, imageData } = sprite

      // Validate base64 size before decode (max 20MB)
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
      const estimatedSize = (base64Data.length * 3) / 4 // Base64 decoding size estimate
      const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB

      if (estimatedSize > MAX_IMAGE_SIZE) {
        return res.status(400).json({
          error: `Invalid input: Sprite image at angle ${angle} exceeds maximum size of 20MB`,
          imageSize: `${(estimatedSize / 1024 / 1024).toFixed(2)}MB`
        })
      }

      const buffer = Buffer.from(base64Data, 'base64')

      // Save as PNG file
      const filename = `${angle}deg.png`
      const filepath = path.join(spritesDir, filename)
      await fs.promises.writeFile(filepath, buffer)
      console.log(`[Sprites] Saved: ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`)
    }
    
    // Save sprite metadata
    const spriteMetadata = {
      assetId: assetId,
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
      spritesDir: `gdd-assets/${assetId}/sprites`,
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

app.post('/api/material-presets', authenticateUser, async (req, res, next) => {
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

app.post('/api/retexture', authenticateUser, async (req, res, next) => {
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

app.post('/api/regenerate-base/:baseAssetId', authenticateUser, async (req, res, next) => {
  try {
    // Validate asset ID to prevent path traversal
    const baseAssetId = validateAssetId(req.params.baseAssetId)

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
app.post('/api/generation/pipeline', authenticateUser, async (req, res, next) => {
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

app.get('/api/generation/pipeline/:pipelineId', authenticateUser, async (req, res, next) => {
  try {
    // Validate pipeline ID to prevent injection attacks
    const pipelineId = validatePipelineId(req.params.pipelineId)
    const status = await generationService.getPipelineStatus(pipelineId)
    res.json(status)
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Invalid pipeline ID')) {
      res.status(404).json({ error: error.message })
    } else {
      next(error)
    }
  }
})

// Weapon handle detection endpoint
app.post('/api/weapon-handle-detect', authenticateUser, async (req, res) => {
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
        max_tokens: MAX_TOKENS_MEDIUM,
        temperature: MEDIUM_TEMPERATURE,
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
app.post('/api/weapon-orientation-detect', authenticateUser, async (req, res) => {
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
        max_tokens: MAX_TOKENS_SHORT,
        temperature: LOW_TEMPERATURE,
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

// AI generation routes
app.post('/api/generate-dialogue', authenticateUser, (req, res) => {
  generateDialogue(req, res)
})

app.post('/api/generate-npc', authenticateUser, (req, res) => {
  generateNPC(req, res)
})

app.post('/api/generate-quest', authenticateUser, (req, res) => {
  generateQuest(req, res)
})

// Multi-agent AI routes
app.post('/api/generate-npc-collaboration', authenticateUser, (req, res) => {
  generateNPCCollaboration(req, res)
})

app.post('/api/generate-playtester-swarm', authenticateUser, (req, res) => {
  generatePlaytesterSwarm(req, res)
})

app.get('/api/playtester-personas', authenticateUser, (req, res) => {
  getPlaytesterPersonas(req, res)
})

// Seed content route - pre-generated quests, NPCs, and lore
app.get('/api/seed-content', (req, res) => {
  try {
    const seedData = getSeedContent()
    res.json(seedData)
  } catch (error) {
    console.error('Error loading seed content:', error)
    res.status(500).json({ error: 'Failed to load seed content' })
  }
})

// Voice generation routes
app.get('/api/voice/library', optionalAuth, (req, res) => {
  getVoiceLibrary(req, res)
})

app.post('/api/voice/generate', authenticateUser, (req, res) => {
  generateVoice(req, res)
})

app.post('/api/voice/batch', authenticateUser, (req, res) => {
  generateVoiceBatch(req, res)
})

app.get('/api/voice/profile/:npcId', optionalAuth, (req, res) => {
  getVoiceProfile(req, res)
})

app.delete('/api/voice/:npcId', authenticateUser, (req, res) => {
  deleteVoice(req, res)
})

app.post('/api/voice/estimate', optionalAuth, (req, res) => {
  estimateVoiceCost(req, res)
})

app.get('/api/voice/subscription', authenticateUser, (req, res) => {
  getVoiceSubscription(req, res)
})

app.get('/api/voice/models', optionalAuth, (req, res) => {
  getVoiceModels(req, res)
})

// Voice manifest routes (new endpoints for manifest entity voice assignments)
app.post('/api/voice/manifest/assign', authenticateUser, (req, res) => {
  assignVoiceToManifest(req, res)
})

app.get('/api/voice/manifest/bulk', authenticateUser, (req, res) => {
  getBulkManifestVoiceAssignments(req, res)
})

app.get('/api/voice/manifest/:manifestType/:entityId', authenticateUser, (req, res) => {
  getManifestVoiceAssignment(req, res)
})

app.delete('/api/voice/manifest/:manifestType/:entityId', authenticateUser, (req, res) => {
  deleteManifestVoiceAssignment(req, res)
})

app.post('/api/voice/manifest/bulk-assign', authenticateUser, (req, res) => {
  bulkAssignManifestVoices(req, res)
})

app.post('/api/voice/manifest/generate-sample', authenticateUser, (req, res) => {
  generateManifestSampleDialogue(req, res)
})


// =====================================================================
// AUTHENTICATION ROUTES
// =====================================================================

app.post('/api/auth/login', (req, res) => {
  POST_login(req, res)
})

app.get('/api/auth/me', authenticateUser, (req, res) => {
  GET_me(req, res)
})

app.post('/api/auth/logout', (req, res) => {
  POST_logout(req, res)
})

// =====================================================================
// USER ROUTES
// =====================================================================

app.get('/api/user/profile', authenticateUser, (req, res) => {
  GET_profile(req, res)
})

app.put('/api/user/profile', authenticateUser, (req, res) => {
  PUT_profile(req, res)
})

app.get('/api/user/usage', authenticateUser, (req, res) => {
  GET_usage(req, res)
})

app.get('/api/user/history', authenticateUser, (req, res) => {
  GET_history(req, res)
})

app.delete('/api/user/account', authenticateUser, (req, res) => {
  DELETE_account(req, res)
})

app.post('/api/user/export', authenticateUser, (req, res) => {
  POST_export(req, res)
})

// =====================================================================
// API KEYS ROUTES
// =====================================================================

app.post('/api/user/api-keys', authenticateUser, (req, res) => {
  POST_addApiKey(req, res)
})

app.get('/api/user/api-keys', authenticateUser, (req, res) => {
  GET_apiKeys(req, res)
})

app.put('/api/user/api-keys/:id', authenticateUser, (req, res) => {
  PUT_updateApiKey(req, res)
})

app.delete('/api/user/api-keys/:id', authenticateUser, (req, res) => {
  DELETE_apiKey(req, res)
})

// =====================================================================
// PROJECTS ROUTES
// =====================================================================

app.post('/api/projects', authenticateUser, (req, res) => {
  POST_createProject(req, res)
})

app.get('/api/projects', authenticateUser, (req, res) => {
  GET_projects(req, res)
})

app.get('/api/projects/:id', authenticateUser, (req, res) => {
  GET_project(req, res)
})

app.put('/api/projects/:id', authenticateUser, (req, res) => {
  PUT_updateProject(req, res)
})

app.delete('/api/projects/:id', authenticateUser, (req, res) => {
  DELETE_project(req, res)
})

app.post('/api/projects/:id/share', authenticateUser, (req, res) => {
  POST_shareProject(req, res)
})

// =====================================================================
// TEAMS ROUTES
// =====================================================================

app.post('/api/teams/create', authenticateUser, (req, res) => {
  POST_createTeam(req, res)
})

app.get('/api/teams/preview/:inviteCode', (req, res) => {
  GET_teamPreview(req, res)
})

app.post('/api/teams/join', authenticateUser, (req, res) => {
  POST_joinTeam(req, res)
})

app.get('/api/teams/my-team', authenticateUser, (req, res) => {
  GET_myTeam(req, res)
})

app.get('/api/teams/:teamId/members', authenticateUser, (req, res) => {
  GET_teamMembers(req, res)
})

app.post('/api/teams/:teamId/leave', authenticateUser, (req, res) => {
  POST_leaveTeam(req, res)
})

app.delete('/api/teams/:teamId', authenticateUser, (req, res) => {
  DELETE_team(req, res)
})

app.put('/api/teams/:teamId', authenticateUser, (req, res) => {
  PUT_updateTeam(req, res)
})

app.delete('/api/teams/:teamId/members/:memberId', authenticateUser, (req, res) => {
  DELETE_removeMember(req, res)
})

app.post('/api/teams/:teamId/transfer-ownership', authenticateUser, (req, res) => {
  POST_transferOwnership(req, res)
})

// =====================================================================
// ADMIN ROUTES
// =====================================================================

app.post('/api/admin/whitelist/add', authenticateUser, requireAdmin, (req, res) => {
  POST_addToWhitelist(req, res)
})

app.post('/api/admin/whitelist/remove', authenticateUser, requireAdmin, (req, res) => {
  POST_removeFromWhitelist(req, res)
})

app.get('/api/admin/whitelist', authenticateUser, requireAdmin, (req, res) => {
  GET_whitelist(req, res)
})

app.get('/api/admin/users', authenticateUser, requireAdmin, (req, res) => {
  GET_allUsers(req, res)
})

app.get('/api/admin/stats', authenticateUser, requireAdmin, (req, res) => {
  GET_stats(req, res)
})

app.get('/api/admin/activity', authenticateUser, requireAdmin, (req, res) => {
  GET_activity(req, res)
})

// Error handling middleware
app.use(errorHandler)

// Start server
const PORT = process.env.API_PORT || DEFAULT_API_PORT
const server = app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`)

  if (!process.env.MESHY_API_KEY) {
    console.warn('⚠️  MESHY_API_KEY not found - retexturing will fail')
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not found - base regeneration will fail')
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn('⚠️  ELEVENLABS_API_KEY not found - voice generation will fail')
  }
})

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`)

  const shutdownTimeout = setTimeout(() => {
    console.error('Shutdown timeout exceeded, forcing exit')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT)

  try {
    // Close server to stop accepting new connections
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      console.log('HTTP server closed')
    }

    // Shutdown services
    if (generationService) {
      generationService.shutdown()
      console.log('Generation service shut down')
    }

    // Cleanup retexture service
    if (retextureService) {
      retextureService.destroy()
      console.log('Retexture service cleaned up')
    }

    // Close database connection
    try {
      closeDatabase()
      console.log('Database connection closed')
    } catch (error) {
      console.error('Error closing database:', error)
    }

    clearTimeout(shutdownTimeout)
    console.log('Graceful shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('Error during graceful shutdown:', error)
    clearTimeout(shutdownTimeout)
    process.exit(1)
  }
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')) // nodemon restart

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  gracefulShutdown('UNCAUGHT_EXCEPTION')
})

// Enhanced unhandled rejection handler with detailed logging
process.on('unhandledRejection', (reason, promise) => {
  console.error('='.repeat(80))
  console.error('CRITICAL: Unhandled Promise Rejection Detected')
  console.error('='.repeat(80))
  console.error('Promise:', promise)
  console.error('Reason:', reason)

  // Log stack trace if available
  if (reason && reason.stack) {
    console.error('Stack trace:', reason.stack)
  }

  // Log additional context
  console.error('Time:', new Date().toISOString())
  console.error('Environment:', process.env.NODE_ENV || 'development')
  console.error('='.repeat(80))

  // In production, trigger graceful shutdown to prevent undefined state
  // In development, keep running to aid debugging
  if (process.env.NODE_ENV === 'production') {
    console.error('Initiating graceful shutdown due to unhandled rejection in production')
    gracefulShutdown('UNHANDLED_REJECTION')
  } else {
    console.error('WARNING: Continuing execution in development mode - this would crash in production!')
  }
})

// Export app for Vercel serverless functions
export default app