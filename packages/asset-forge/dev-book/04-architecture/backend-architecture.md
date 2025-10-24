# Backend Architecture

## Table of Contents
- [Overview](#overview)
- [Server Structure](#server-structure)
- [API Routing](#api-routing)
- [Service Layer](#service-layer)
- [Middleware Stack](#middleware-stack)
- [AI Service Integration](#ai-service-integration)
- [File System Operations](#file-system-operations)
- [Error Handling](#error-handling)
- [Request/Response Cycle](#requestresponse-cycle)
- [Async Pipeline Management](#async-pipeline-management)

---

## Overview

The Asset Forge backend is a **Node.js/Express server** that orchestrates AI-powered 3D asset generation. It provides REST API endpoints, manages generation pipelines, integrates with multiple AI services, and handles file system operations.

### Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18.0.0+ | JavaScript runtime |
| Express | 4.18.2 | Web framework |
| node-fetch | 3.3.2 | HTTP client for AI APIs |
| dotenv | 16.3.1 | Environment configuration |
| CORS | 2.8.5 | Cross-origin requests |
| Concurrently | 8.2.2 | Run multiple servers |

### Server Instances

```bash
# Development mode runs 2 servers
npm run dev
├── API Server (PORT 3004)      # Main API endpoints
└── Image Server (PORT 8080)    # Static image hosting
```

### Architecture Principles

1. **Stateless API**: No session state on server
2. **Event-Driven**: Pipeline processing with EventEmitter
3. **File-Based Storage**: Assets stored in `gdd-assets/` directory
4. **Async Processing**: Long-running AI tasks with polling
5. **Error Isolation**: Comprehensive error handling

---

## Server Structure

### Entry Point: `server/api.mjs`

```javascript
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

// Initialize Express app
const app = express()

// Middleware
app.use(corsMiddleware)
app.use(express.json({ limit: '25mb' }))
app.use('/assets', express.static(path.join(ROOT_DIR, 'public/assets')))

// Initialize services
const assetService = new AssetService(path.join(ROOT_DIR, 'gdd-assets'))
const retextureService = new RetextureService({
  meshyApiKey: process.env.MESHY_API_KEY,
  imageServerBaseUrl: process.env.IMAGE_SERVER_URL || 'http://localhost:8080'
})
const generationService = new GenerationService()

// Routes
app.use('/api', promptRoutes)
app.get('/api/health', healthCheck)
app.get('/api/assets', listAssets)
app.get('/api/assets/:id/model', getModel)
app.delete('/api/assets/:id', deleteAsset)
app.patch('/api/assets/:id', updateAsset)
app.post('/api/assets/:id/sprites', saveSprites)
app.post('/api/retexture', retexture)
app.post('/api/generation/pipeline', startPipeline)
app.get('/api/generation/pipeline/:pipelineId', getPipelineStatus)

// Error handling
app.use(errorHandler)

// Start server
const PORT = process.env.API_PORT || 3004
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`)
})
```

### Directory Structure

```
server/
├── api.mjs                     # Main server entry point
├── middleware/                 # Express middleware
│   └── errorHandler.mjs        # Global error handler
├── routes/                     # Route handlers
│   └── promptRoutes.mjs        # Prompt-related routes
├── services/                   # Business logic (5 services)
│   ├── AssetService.mjs        # File system operations
│   ├── GenerationService.mjs   # Pipeline orchestration
│   ├── AICreationService.mjs   # AI service coordination
│   ├── RetextureService.mjs    # Material variant generation
│   └── ImageHostingService.mjs # Public image hosting
└── utils/                      # Utility functions
    └── promptLoader.mjs        # Load prompt templates
```

---

## API Routing

### Complete API Endpoints (25+)

#### Health & Status
```http
GET  /api/health
```
Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "meshy": true,
    "openai": true
  }
}
```

#### Asset Management
```http
GET    /api/assets                        # List all assets
GET    /api/assets/:id/model              # Download model file
GET    /api/assets/:id/*                  # Get any file from asset
HEAD   /api/assets/:id/model              # Check model exists
DELETE /api/assets/:id                    # Delete asset
PATCH  /api/assets/:id                    # Update metadata
POST   /api/assets/:id/sprites            # Save sprite sheet
```

#### Material Presets
```http
GET  /api/material-presets                # Get all presets
POST /api/material-presets                # Save presets
```

#### Retexturing
```http
POST /api/retexture                       # Create material variant
POST /api/regenerate-base/:baseAssetId    # Regenerate base model
```

#### Generation Pipeline
```http
POST /api/generation/pipeline             # Start generation
GET  /api/generation/pipeline/:pipelineId # Get pipeline status
```

#### AI Analysis (Weapons)
```http
POST /api/weapon-handle-detect            # Detect grip location
POST /api/weapon-orientation-detect       # Check if upside down
```

#### Prompts
```http
GET  /api/prompts/generation              # Get generation prompts
GET  /api/prompts/gpt4-enhancement        # Get GPT-4 prompts
GET  /api/prompts/weapon-detection        # Get weapon detection prompts
```

### Route Implementation Examples

#### List Assets

```javascript
app.get('/api/assets', async (req, res, next) => {
  try {
    // Set no-cache headers
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })

    const assets = await assetService.listAssets()
    res.json(assets)
  } catch (error) {
    next(error)
  }
})
```

#### Get Model File

```javascript
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
```

#### Delete Asset

```javascript
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
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Asset not found' })
    }
    next(error)
  }
})
```

#### Start Generation Pipeline

```javascript
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
```

#### Get Pipeline Status

```javascript
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
```

---

## Service Layer

### 1. AssetService (File System Operations)

**Purpose**: CRUD operations for assets on file system

```javascript
export class AssetService {
  constructor(assetsDir) {
    this.assetsDir = assetsDir
  }

  /**
   * List all assets in the assets directory
   */
  async listAssets() {
    const dirs = await fs.readdir(this.assetsDir, { withFileTypes: true })

    const assets = []
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue

      const metadataPath = path.join(this.assetsDir, dir.name, 'metadata.json')

      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8')
        const metadata = JSON.parse(metadataContent)

        assets.push({
          id: dir.name,
          name: metadata.name || dir.name,
          type: metadata.type,
          subtype: metadata.subtype,
          metadata: metadata,
          modelUrl: `/api/assets/${dir.name}/model`,
          conceptArtUrl: metadata.hasConceptArt
            ? `/api/assets/${dir.name}/concept-art.png`
            : null
        })
      } catch (error) {
        console.warn(`Failed to load metadata for ${dir.name}:`, error.message)
      }
    }

    return assets
  }

  /**
   * Get path to model file
   */
  async getModelPath(assetId) {
    const assetDir = path.join(this.assetsDir, assetId)

    // Try {assetId}.glb first
    const primaryPath = path.join(assetDir, `${assetId}.glb`)
    if (await this.fileExists(primaryPath)) {
      return primaryPath
    }

    // Fallback: find any .glb file
    const files = await fs.readdir(assetDir)
    const glbFile = files.find(f => f.endsWith('.glb') && !f.includes('_raw'))

    if (!glbFile) {
      throw new Error(`Model not found for asset: ${assetId}`)
    }

    return path.join(assetDir, glbFile)
  }

  /**
   * Delete asset directory
   */
  async deleteAsset(assetId, includeVariants = false) {
    const assetDir = path.join(this.assetsDir, assetId)

    // Check if asset exists
    if (!await this.fileExists(assetDir)) {
      throw new Error(`Asset not found: ${assetId}`)
    }

    // Load metadata to check for variants
    const metadataPath = path.join(assetDir, 'metadata.json')
    let variants = []

    if (await this.fileExists(metadataPath)) {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
      variants = metadata.variants || []
    }

    // Delete main asset
    await fs.rm(assetDir, { recursive: true, force: true })

    // Delete variants if requested
    if (includeVariants && variants.length > 0) {
      for (const variantId of variants) {
        const variantDir = path.join(this.assetsDir, variantId)
        if (await this.fileExists(variantDir)) {
          await fs.rm(variantDir, { recursive: true, force: true })
        }
      }
    }
  }

  /**
   * Update asset metadata
   */
  async updateAsset(assetId, updates) {
    const assetDir = path.join(this.assetsDir, assetId)
    const metadataPath = path.join(assetDir, 'metadata.json')

    if (!await this.fileExists(metadataPath)) {
      return null
    }

    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))

    const updatedMetadata = {
      ...metadata,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    await fs.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2))

    return updatedMetadata
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}
```

---

### 2. GenerationService (Pipeline Orchestration)

**Purpose**: Multi-stage asset generation pipeline

**Key Features**:
- Event-driven pipeline processing
- Stage-by-stage progress tracking
- AI service integration (OpenAI, Meshy)
- Error recovery and fallbacks
- Automatic cleanup of old pipelines

**Pipeline Stages**:
1. **Text Input** - User description
2. **GPT-4 Enhancement** - Optimize prompt (optional)
3. **Image Generation** - DALL-E concept art (or user-provided)
4. **Image-to-3D** - Meshy AI conversion
5. **Material Variants** - Retexturing (optional)
6. **Auto-Rigging** - Skeleton + animations (avatars only)
7. **Sprite Generation** - 2D sprites (optional)

```javascript
export class GenerationService extends EventEmitter {
  constructor() {
    super()

    this.activePipelines = new Map()
    this.aiService = new AICreationService({
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-image-1',
        imageServerBaseUrl: process.env.IMAGE_SERVER_URL
      },
      meshy: {
        apiKey: process.env.MESHY_API_KEY,
        baseUrl: 'https://api.meshy.ai'
      }
    })
  }

  /**
   * Start a new generation pipeline
   */
  async startPipeline(config) {
    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const pipeline = {
      id: pipelineId,
      config,
      status: 'initializing',
      progress: 0,
      stages: {
        textInput: { status: 'completed', progress: 100 },
        promptOptimization: { status: 'pending', progress: 0 },
        imageGeneration: { status: 'pending', progress: 0 },
        image3D: { status: 'pending', progress: 0 },
        textureGeneration: { status: 'pending', progress: 0 }
      },
      results: {},
      createdAt: new Date().toISOString()
    }

    this.activePipelines.set(pipelineId, pipeline)

    // Start processing asynchronously
    this.processPipeline(pipelineId).catch(error => {
      pipeline.status = 'failed'
      pipeline.error = error.message
    })

    return { pipelineId, status: pipeline.status }
  }

  /**
   * Process pipeline through all stages
   */
  async processPipeline(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) return

    try {
      pipeline.status = 'processing'

      // Stage 1: GPT-4 Enhancement (optional)
      let enhancedPrompt = pipeline.config.description
      if (pipeline.config.metadata?.useGPT4Enhancement !== false) {
        enhancedPrompt = await this.enhancePrompt(pipeline)
        pipeline.progress = 10
      }

      // Stage 2: Image Generation (or user-provided)
      let imageUrl = null
      if (pipeline.config.referenceImage) {
        imageUrl = pipeline.config.referenceImage.dataUrl || pipeline.config.referenceImage.url
        pipeline.stages.imageGeneration.status = 'skipped'
      } else {
        imageUrl = await this.generateImage(pipeline, enhancedPrompt)
        pipeline.progress = 25
      }

      // Stage 3: Image-to-3D with Meshy
      const meshyTaskId = await this.convertTo3D(pipeline, imageUrl)
      pipeline.progress = 50

      // Stage 4: Material Variants (optional)
      if (pipeline.config.enableRetexturing) {
        await this.generateVariants(pipeline, meshyTaskId)
        pipeline.progress = 75
      }

      // Stage 5: Auto-Rigging (avatars only)
      if (pipeline.config.generationType === 'avatar' && pipeline.config.enableRigging) {
        await this.rigAvatar(pipeline, meshyTaskId)
        pipeline.progress = 85
      }

      // Complete
      pipeline.status = 'completed'
      pipeline.completedAt = new Date().toISOString()
      pipeline.progress = 100

    } catch (error) {
      pipeline.status = 'failed'
      pipeline.error = error.message
      throw error
    }
  }

  /**
   * Enhance prompt with GPT-4
   */
  async enhancePrompt(pipeline) {
    pipeline.stages.promptOptimization.status = 'processing'

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'Optimize this prompt for 3D asset generation...' },
            { role: 'user', content: pipeline.config.description }
          ],
          temperature: 0.7,
          max_tokens: 200
        })
      })

      const data = await response.json()
      const optimizedPrompt = data.choices[0].message.content.trim()

      pipeline.stages.promptOptimization.status = 'completed'
      pipeline.stages.promptOptimization.result = { optimizedPrompt }

      return optimizedPrompt

    } catch (error) {
      console.warn('GPT-4 enhancement failed:', error)
      pipeline.stages.promptOptimization.status = 'completed'
      return pipeline.config.description // Fallback
    }
  }

  /**
   * Generate image with DALL-E
   */
  async generateImage(pipeline, prompt) {
    pipeline.stages.imageGeneration.status = 'processing'

    const imageResult = await this.aiService.imageService.generateImage(
      prompt,
      pipeline.config.type,
      pipeline.config.style
    )

    pipeline.stages.imageGeneration.status = 'completed'
    pipeline.stages.imageGeneration.result = imageResult

    return imageResult.imageUrl
  }

  /**
   * Convert image to 3D with Meshy
   */
  async convertTo3D(pipeline, imageUrl) {
    pipeline.stages.image3D.status = 'processing'

    // Start Meshy task
    const meshyTaskId = await this.aiService.meshyService.startImageTo3D(imageUrl, {
      enable_pbr: true,
      ai_model: 'meshy-5',
      topology: 'quad',
      targetPolycount: 12000,
      texture_resolution: 2048
    })

    // Poll for completion
    let result = null
    let attempts = 0
    const maxAttempts = 60

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000))

      const status = await this.aiService.meshyService.getTaskStatus(meshyTaskId)

      if (status.status === 'SUCCEEDED') {
        result = status
        break
      } else if (status.status === 'FAILED') {
        throw new Error('Meshy conversion failed')
      }

      attempts++
    }

    if (!result) throw new Error('Meshy conversion timed out')

    // Download and save model
    const modelBuffer = await this.downloadFile(result.model_urls.glb)
    const outputDir = path.join('gdd-assets', pipeline.config.assetId)
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(path.join(outputDir, `${pipeline.config.assetId}.glb`), modelBuffer)

    // Save metadata
    const metadata = {
      name: pipeline.config.assetId,
      type: pipeline.config.type,
      subtype: pipeline.config.subtype,
      description: pipeline.config.description,
      generatedAt: new Date().toISOString(),
      isBaseModel: true,
      hasModel: true,
      meshyTaskId
    }
    await fs.writeFile(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    )

    pipeline.stages.image3D.status = 'completed'
    pipeline.stages.image3D.result = { taskId: meshyTaskId, modelUrl: result.model_urls.glb }

    return meshyTaskId
  }
}
```

---

### 3. RetextureService (Material Variants)

**Purpose**: Create material variants using Meshy retexture API

```javascript
export class RetextureService {
  constructor({ meshyApiKey, imageServerBaseUrl }) {
    this.meshyApiKey = meshyApiKey
    this.imageServerBaseUrl = imageServerBaseUrl
    this.meshyService = new MeshyService(meshyApiKey)
  }

  async retexture({ baseAssetId, materialPreset, outputName, assetsDir }) {
    // Load base model metadata
    const baseMetadataPath = path.join(assetsDir, baseAssetId, 'metadata.json')
    const baseMetadata = JSON.parse(await fs.readFile(baseMetadataPath, 'utf-8'))

    if (!baseMetadata.meshyTaskId) {
      throw new Error('Base model must have meshyTaskId')
    }

    // Start retexture task
    const retextureTaskId = await this.meshyService.startRetextureTask(
      { inputTaskId: baseMetadata.meshyTaskId },
      { textStylePrompt: materialPreset.stylePrompt },
      { artStyle: 'realistic', aiModel: 'meshy-5' }
    )

    // Poll for completion
    let result = null
    let attempts = 0

    while (attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 5000))

      const status = await this.meshyService.getRetextureTaskStatus(retextureTaskId)

      if (status.status === 'SUCCEEDED') {
        result = status
        break
      } else if (status.status === 'FAILED') {
        throw new Error('Retexture failed')
      }

      attempts++
    }

    if (!result) throw new Error('Retexture timed out')

    // Save variant
    const variantId = outputName || `${baseAssetId}-${materialPreset.id}`
    const variantDir = path.join(assetsDir, variantId)
    await fs.mkdir(variantDir, { recursive: true })

    const variantBuffer = await this.downloadFile(result.model_urls.glb)
    await fs.writeFile(path.join(variantDir, `${variantId}.glb`), variantBuffer)

    // Save variant metadata
    const variantMetadata = {
      id: variantId,
      name: variantId,
      type: baseMetadata.type,
      subtype: baseMetadata.subtype,
      isBaseModel: false,
      isVariant: true,
      parentBaseModel: baseAssetId,
      materialPreset: materialPreset,
      retextureTaskId: retextureTaskId,
      generatedAt: new Date().toISOString()
    }

    await fs.writeFile(
      path.join(variantDir, 'metadata.json'),
      JSON.stringify(variantMetadata, null, 2)
    )

    return { variantId, modelUrl: result.model_urls.glb }
  }
}
```

---

## Middleware Stack

### 1. CORS Middleware

```javascript
app.use((req, res, next) => {
  const origin = process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || '*'
    : req.headers.origin || 'http://localhost:3000'

  res.header('Access-Control-Allow-Origin', origin)
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Credentials', 'true')

  // Security headers
  res.header('X-Content-Type-Options', 'nosniff')
  res.header('X-Frame-Options', 'DENY')
  res.header('X-XSS-Protection', '1; mode=block')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }

  next()
})
```

### 2. Body Parser Middleware

```javascript
app.use(express.json({ limit: '25mb' })) // Support large base64 images
```

### 3. Error Handler Middleware

```javascript
// server/middleware/errorHandler.mjs
export function errorHandler(err, req, res, next) {
  console.error('Error:', err.stack)

  const statusCode = err.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}
```

### 4. Static File Middleware

```javascript
app.use('/assets', express.static(path.join(ROOT_DIR, 'public/assets'), {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff')
  }
}))
```

---

## AI Service Integration

### OpenAI API

```javascript
// GPT-4 Completion
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 200
  })
})

// DALL-E Image Generation
const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-image-1',
    prompt: enhancedPrompt,
    size: '1024x1024',
    quality: 'standard',
    n: 1
  })
})
```

### Meshy AI API

```javascript
class MeshyService {
  async startImageTo3D(imageUrl, options) {
    const response = await fetch('https://api.meshy.ai/v2/image-to-3d', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: imageUrl,
        enable_pbr: options.enable_pbr,
        ai_model: options.ai_model,
        topology: options.topology,
        target_polycount: options.targetPolycount,
        texture_resolution: options.texture_resolution
      })
    })

    const data = await response.json()
    return data.result // Task ID
  }

  async getTaskStatus(taskId) {
    const response = await fetch(`https://api.meshy.ai/v2/image-to-3d/${taskId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    })

    return response.json()
  }

  async startRetextureTask(input, style, options) {
    const response = await fetch('https://api.meshy.ai/v2/text-to-texture', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_url: input.inputTaskId,
        text_style_prompt: style.textStylePrompt,
        art_style: options.artStyle,
        ai_model: options.aiModel
      })
    })

    const data = await response.json()
    return data.result
  }
}
```

---

## File System Operations

### Asset Directory Structure

```
gdd-assets/
├── {asset-id}/
│   ├── {asset-id}.glb              # 3D model
│   ├── {asset-id}_raw.glb          # Pre-normalization
│   ├── {asset-id}_rigged.glb       # With skeleton
│   ├── metadata.json               # Asset metadata
│   ├── concept-art.png             # Reference image
│   ├── sprite-metadata.json        # Sprite config
│   ├── animations/
│   │   ├── walking.glb
│   │   └── running.glb
│   └── sprites/
│       ├── 0deg.png
│       ├── 45deg.png
│       └── ...
```

### File Operations

```javascript
// Create directory
await fs.mkdir(outputDir, { recursive: true })

// Write file
await fs.writeFile(filePath, buffer)

// Read file
const content = await fs.readFile(filePath, 'utf-8')

// Check file exists
try {
  await fs.access(filePath)
  return true
} catch {
  return false
}

// Delete directory recursively
await fs.rm(assetDir, { recursive: true, force: true })

// Copy file
await fs.copyFile(sourcePath, destPath)

// List directory
const files = await fs.readdir(dirPath, { withFileTypes: true })
```

---

## Error Handling

### Error Types

```javascript
// 400 Bad Request
if (!config.name || !config.type) {
  return res.status(400).json({ error: 'name and type are required' })
}

// 404 Not Found
if (!asset) {
  return res.status(404).json({ error: 'Asset not found' })
}

// 500 Internal Server Error
try {
  await doSomething()
} catch (error) {
  next(error) // Pass to error handler
}
```

### Global Error Handler

```javascript
app.use((err, req, res, next) => {
  console.error(err.stack)

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  })
})
```

---

## Request/Response Cycle

### Typical Request Flow

```
1. Client sends request
   ↓
2. CORS middleware (check origin)
   ↓
3. Body parser (parse JSON)
   ↓
4. Route handler (match endpoint)
   ↓
5. Service layer (business logic)
   ↓
6. AI API / File system (external call)
   ↓
7. Response sent to client
   ↓
8. Error handler (if error occurred)
```

### Example: Create Material Variant

```
POST /api/retexture
↓
Request body: { baseAssetId, materialPreset, outputName }
↓
RetextureService.retexture()
├── Load base metadata
├── Start Meshy retexture task
├── Poll for completion (60 attempts × 5s)
├── Download textured model
├── Save to file system
└── Update metadata
↓
Response: { variantId, modelUrl }
```

---

## Async Pipeline Management

### Pipeline State Machine

```
┌──────────────────────────────────────────┐
│         Pipeline State Machine            │
└──────────────────────────────────────────┘

initializing
    ↓
processing
    ├── Stage 1: GPT-4 Enhancement
    ├── Stage 2: Image Generation
    ├── Stage 3: Image-to-3D
    ├── Stage 4: Material Variants
    └── Stage 5: Auto-Rigging
    ↓
completed / failed
```

### In-Memory Pipeline Storage

```javascript
class GenerationService {
  constructor() {
    this.activePipelines = new Map()
  }

  async startPipeline(config) {
    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const pipeline = {
      id: pipelineId,
      config,
      status: 'initializing',
      progress: 0,
      stages: { /* ... */ },
      results: {},
      createdAt: new Date().toISOString()
    }

    this.activePipelines.set(pipelineId, pipeline)

    // Process asynchronously (don't await)
    this.processPipeline(pipelineId).catch(error => {
      pipeline.status = 'failed'
      pipeline.error = error.message
    })

    return { pipelineId }
  }

  async getPipelineStatus(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId)

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`)
    }

    return {
      id: pipeline.id,
      status: pipeline.status,
      progress: pipeline.progress,
      stages: pipeline.stages,
      results: pipeline.results
    }
  }
}
```

### Automatic Cleanup

```javascript
// Cleanup old pipelines every 30 minutes
setInterval(() => {
  if (global.generationService) {
    generationService.cleanupOldPipelines()
  }
}, 30 * 60 * 1000)

// In GenerationService
cleanupOldPipelines() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000)

  for (const [id, pipeline] of this.activePipelines.entries()) {
    const createdAt = new Date(pipeline.createdAt).getTime()

    if (createdAt < oneHourAgo && (pipeline.status === 'completed' || pipeline.status === 'failed')) {
      this.activePipelines.delete(id)
    }
  }
}
```

---

## Summary

The Asset Forge backend is a **well-structured Express server** that:

**Strengths**:
- ✅ RESTful API design (25+ endpoints)
- ✅ Service-oriented architecture (5 services)
- ✅ Async pipeline processing with polling
- ✅ Multiple AI service integrations
- ✅ Comprehensive error handling
- ✅ File-based storage with metadata

**Key Services**:
- AssetService (CRUD operations)
- GenerationService (pipeline orchestration)
- RetextureService (material variants)
- AICreationService (AI coordination)
- ImageHostingService (public hosting)

**AI Integrations**:
- OpenAI GPT-4 (prompt enhancement)
- OpenAI DALL-E (concept art)
- Meshy AI (image-to-3D, retexture, rigging)

The backend provides a robust foundation for AI-powered 3D asset generation with clear separation of concerns and scalable architecture.
