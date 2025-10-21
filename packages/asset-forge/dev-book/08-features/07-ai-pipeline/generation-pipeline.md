# Generation Pipeline

[← Back to Index](../README.md)

---

## Complete AI Generation Pipeline

Asset Forge implements a sophisticated 9-stage AI pipeline that transforms text descriptions into production-ready 3D game assets. This pipeline orchestrates multiple AI services, handles error recovery, tracks progress, and manages state across asynchronous operations.

---

## Pipeline Overview

### Architecture

The generation pipeline is a **stateful, event-driven system** that coordinates:

- **OpenAI GPT-4**: Prompt enhancement
- **OpenAI GPT-Image-1**: Concept art generation
- **Meshy.ai**: 3D model conversion
- **Custom Services**: Normalization, rigging, sprite generation

### Pipeline Flow

```text
┌─────────────────┐
│  Text Input     │ ← User provides description
└────────┬────────┘
         ↓
┌─────────────────┐
│  Validation     │ ← Check required fields
└────────┬────────┘
         ↓
┌─────────────────┐
│  GPT-4 Enhance  │ ← Optimize prompt for generation
└────────┬────────┘
         ↓
┌─────────────────┐
│  Image Gen      │ ← Create concept art (1024x1024)
└────────┬────────┘
         ↓
┌─────────────────┐
│  Image Hosting  │ ← Upload to accessible URL
└────────┬────────┘
         ↓
┌─────────────────┐
│  Image-to-3D    │ ← Convert to GLB model
└────────┬────────┘
         ↓
┌─────────────────┐
│  Normalize      │ ← Scale, center, orient
└────────┬────────┘
         ↓
┌─────────────────┐
│  Retexture*     │ ← Generate material variants
└────────┬────────┘
         ↓
┌─────────────────┐
│  Rigging*       │ ← Auto-rig avatars
└────────┬────────┘
         ↓
┌─────────────────┐
│  Sprites*       │ ← Render 2D sprites
└─────────────────┘

* Optional stages based on configuration
```

---

## Stage 1: Text Input Validation

### Purpose

Validate user input before starting the expensive AI generation process.

### Implementation

```typescript
interface GenerationConfig {
  name: string              // Asset name (required)
  type: string              // Asset type: weapon, armor, character
  subtype: string           // Specific category
  description: string       // User description
  style?: string            // Art style (default: runescape)
  quality?: 'standard' | 'high' | 'ultra'

  // Optional configuration
  enableGeneration?: boolean
  enableRetexturing?: boolean
  enableSprites?: boolean
  enableRigging?: boolean

  // Optional reference image (bypass auto generation)
  referenceImage?: {
    source: 'url' | 'data'
    url?: string
    dataUrl?: string
  }
}
```

### Validation Rules

**Required Fields:**
- `name`: Non-empty string
- `type`: Valid asset type (weapon, armor, character, etc.)
- `subtype`: Specific category for the type
- `description`: Meaningful text (min 10 characters)

**Optional Fields:**
- `style`: Defaults to 'runescape' if not provided
- `quality`: Defaults to 'high'
- `metadata`: Additional context (creature type, armor slot, etc.)

### Error Handling

```typescript
// Backend validation
if (!config.name || config.name.trim().length === 0) {
  throw new Error('Asset name is required')
}

if (!config.description || config.description.length < 10) {
  throw new Error('Description must be at least 10 characters')
}

if (!['weapon', 'armor', 'character', 'tool', 'resource'].includes(config.type)) {
  throw new Error('Invalid asset type')
}
```

---

## Stage 2: Prompt Optimization (GPT-4)

### Purpose

Transform user descriptions into optimized prompts that produce better AI-generated images and 3D models.

### Process

1. **Load prompt templates** from configuration files
2. **Determine asset type** (avatar, armor, item)
3. **Apply GPT-4 enhancement** with type-specific instructions
4. **Add critical requirements** (T-pose for characters, armor shape rules)

### GPT-4 Enhancement

**Model**: `gpt-4`
**Temperature**: 0.7 (creative but controlled)
**Max Tokens**: 200 (concise enhancement)

**System Prompt Structure:**
```json
{
  "base": "You are an expert at optimizing prompts for 3D asset generation.",
  "focusPoints": [
    "Clear, specific visual details",
    "Material and texture descriptions",
    "Geometric shape and form",
    "Style consistency"
  ]
}
```

### Type-Specific Enhancement

#### Avatar Enhancement

**Critical Addition**: T-pose requirement
```text
"CRITICAL for characters: The character MUST be in a T-pose
(arms stretched out horizontally, legs slightly apart) for proper rigging.
The character must have EMPTY HANDS - no weapons, tools, or held items."
```

**Focus Areas:**
- T-pose stance verification
- Empty hands confirmation
- Character proportions
- Outfit details

#### Armor Enhancement

**Critical Addition**: Scarecrow pose shaping
```text
"CRITICAL for armor: The armor must be SHAPED FOR A T-POSE BODY -
shoulder openings must point STRAIGHT SIDEWAYS at 90 degrees (like a scarecrow),
NOT angled downward! Should look like a wide 'T' shape.
Ends at shoulders (no arm extensions), hollow openings, no armor stand."
```

**Focus Areas:**
- T-pose body shape
- Shoulder opening angle (90°)
- Hollow interior
- No mannequin/stand

#### Item Enhancement

**Standard Enhancement**: Visual detail addition
```text
"Enhance this item description for 3D generation: ${description}"
```

**Focus Areas:**
- Material properties
- Geometric details
- Functional features
- Style consistency

### Example Enhancement

**Input:**
```text
"iron sword"
```

**Output (GPT-4 Enhanced):**
```text
"Medieval iron sword with a straight double-edged blade.
The blade has a subtle fuller groove running down the center.
Simple cross-guard with slight downward curve.
Leather-wrapped wooden grip with visible wrap texture.
Round pommel with iron finish.
Low-poly RuneScape style with clean edges and minimal polygons.
The sword should have a slightly weathered iron texture with subtle scratches."
```

---

## Stage 3: Image Generation (GPT-Image-1)

### Purpose

Create concept art that will be converted to 3D models.

### OpenAI Configuration

**Model**: `gpt-image-1` (DALL-E 3 via new API)
**Size**: 1024x1024 (required by Meshy.ai)
**Quality**: `high`
**Format**: `b64_json` (base64-encoded)
**Style**: `natural` (realistic rendering)

### Request Format

```typescript
const response = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-image-1',
    prompt: enhancedPrompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
    response_format: 'b64_json'
  })
})
```

### Response Handling

```typescript
interface ImageGenerationResponse {
  created: number
  data: [{
    b64_json: string
    revised_prompt?: string
  }]
}

// Extract base64 data
const imageData = response.data[0].b64_json
const buffer = Buffer.from(imageData, 'base64')
```

### T-Pose Validation

For character assets, the generated image should show:
- Arms extended horizontally (90° from body)
- Legs slightly apart
- Facing forward
- Empty hands
- Full body visible

### Cost Optimization

**Pricing** (as of 2025):
- Standard quality: ~$0.040 per image
- High quality: ~$0.080 per image

**Optimization Strategy:**
- Use high quality only for final assets
- Cache generated images
- Provide reference image option to skip generation

---

## Stage 4: Image Hosting

### Purpose

Make generated images accessible to Meshy.ai via public URL.

### Hosting Options

#### Option 1: Temporary Public URL (Default)

**Implementation:**
```typescript
// Save to public directory
const imagePath = path.join(PUBLIC_DIR, 'temp', `${assetId}.png`)
await fs.writeFile(imagePath, imageBuffer)

// Generate public URL
const imageUrl = `${SERVER_BASE_URL}/temp/${assetId}.png`
```

**Pros:**
- Simple implementation
- No external dependencies
- Fast

**Cons:**
- Not suitable for production
- Limited to single server
- No CDN

#### Option 2: Cloud Storage (Production)

**Services:**
- AWS S3
- Google Cloud Storage
- Azure Blob Storage
- Cloudflare R2

**Example (S3):**
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: 'us-east-1' })
await s3.send(new PutObjectCommand({
  Bucket: 'asset-forge-images',
  Key: `generated/${assetId}.png`,
  Body: imageBuffer,
  ContentType: 'image/png',
  ACL: 'public-read'
}))

const imageUrl = `https://asset-forge-images.s3.amazonaws.com/generated/${assetId}.png`
```

### URL Requirements

Meshy.ai requires:
- **Protocol**: HTTPS (HTTP may work in dev)
- **Accessibility**: Publicly accessible
- **Format**: Direct image URL (not HTML page)
- **Availability**: Must remain accessible during conversion (2-20 minutes)

---

## Stage 5: Image-to-3D Conversion (Meshy)

### Purpose

Convert 2D concept art into textured 3D models using AI.

### Meshy API Configuration

**Endpoint**: `POST https://api.meshy.ai/v2/image-to-3d`
**Model**: `meshy-5` (latest, best quality)
**Topology**: `quad` (game-ready quad mesh)

### Request Parameters

```typescript
interface ImageTo3DRequest {
  image_url: string                           // Public image URL
  enable_pbr: boolean                         // PBR materials
  ai_model: 'meshy-5'                        // Model version
  topology: 'quad' | 'triangle'              // Mesh type
  target_polycount?: number                   // Target faces
  surface_mode?: 'organic' | 'hard-surface'  // Geometry type
}
```

### Quality Tiers

| Tier | Polycount | Texture Res | PBR | Time |
|------|-----------|-------------|-----|------|
| **Standard** | ~6,000 | 1024x1024 | No | 2-5 min |
| **High** | ~12,000 | 2048x2048 | Yes | 5-10 min |
| **Ultra** | ~20,000 | 4096x4096 | Yes | 10-20 min |

### Configuration Mapping

```typescript
const qualityConfig = {
  standard: {
    target_polycount: 6000,
    enable_pbr: false,
    texture_resolution: 1024
  },
  high: {
    target_polycount: 12000,
    enable_pbr: true,
    texture_resolution: 2048
  },
  ultra: {
    target_polycount: 20000,
    enable_pbr: true,
    texture_resolution: 4096
  }
}
```

### API Request

```typescript
const response = await fetch('https://api.meshy.ai/v2/image-to-3d', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${MESHY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    image_url: imageUrl,
    enable_pbr: quality !== 'standard',
    ai_model: 'meshy-5',
    topology: 'quad',
    target_polycount: qualityConfig[quality].target_polycount
  })
})

const { task_id } = await response.json()
```

### Polling for Completion

Meshy.ai uses an asynchronous task model:

```typescript
async function pollTaskStatus(taskId: string): Promise<MeshyResult> {
  const maxAttempts = 120  // 20 minutes at 10s intervals
  const pollInterval = 10000  // 10 seconds

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://api.meshy.ai/v2/image-to-3d/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${MESHY_API_KEY}`
        }
      }
    )

    const task = await response.json()

    switch (task.status) {
      case 'SUCCEEDED':
        return {
          taskId: task.id,
          modelUrl: task.model_url,
          thumbnailUrl: task.thumbnail_url
        }

      case 'FAILED':
        throw new Error(task.error || 'Meshy task failed')

      case 'PENDING':
      case 'IN_PROGRESS':
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        continue

      default:
        throw new Error(`Unknown task status: ${task.status}`)
    }
  }

  throw new Error('Meshy task timeout (20 minutes)')
}
```

### Response Format

```typescript
interface MeshyTaskResponse {
  id: string                    // Task ID (for retexturing/rigging)
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED'
  progress: number              // 0-100
  model_url?: string           // GLB download URL
  thumbnail_url?: string       // Preview image
  texture_urls?: string[]      // PBR texture URLs
  error?: string               // Error message if failed
  created_at: number           // Unix timestamp
  finished_at?: number         // Unix timestamp
}
```

### Downloading the Model

```typescript
// Download GLB file
const modelResponse = await fetch(task.model_url)
const modelBuffer = await modelResponse.arrayBuffer()

// Save to asset directory
const modelPath = path.join(ASSETS_DIR, assetId, 'model.glb')
await fs.writeFile(modelPath, Buffer.from(modelBuffer))
```

---

## Stage 6: Model Normalization

### Purpose

Standardize models for consistency across the asset library.

### Normalization Process

#### 1. Scale Normalization

**Goal**: Consistent relative sizes

```typescript
interface NormalizationRules {
  weapon: { targetSize: 1.0 }      // 1 meter typical weapon
  armor: { targetSize: 1.5 }       // 1.5 meter chest piece
  character: { targetSize: 1.7 }   // 1.7 meter human
  tool: { targetSize: 0.5 }        // 0.5 meter tool
  resource: { targetSize: 0.3 }    // 0.3 meter resource
}
```

**Algorithm:**
```typescript
// Measure current size
const bbox = new THREE.Box3().setFromObject(model)
const size = bbox.getSize(new THREE.Vector3())
const currentSize = Math.max(size.x, size.y, size.z)

// Calculate scale factor
const targetSize = normalizationRules[assetType].targetSize
const scaleFactor = targetSize / currentSize

// Apply scale
model.scale.multiplyScalar(scaleFactor)
```

#### 2. Center on Origin

```typescript
// Calculate center
const bbox = new THREE.Box3().setFromObject(model)
const center = bbox.getCenter(new THREE.Vector3())

// Move to origin
model.position.sub(center)
```

#### 3. Ground Placement

```typescript
// Place bottom of model at Y=0
const bbox = new THREE.Box3().setFromObject(model)
const min = bbox.min

model.position.y -= min.y
```

#### 4. Orientation

**Weapon Orientation:**
- Handle at origin (0, 0, 0)
- Blade pointing +Y (up)
- Cutting edge facing +X (right)

**Character Orientation:**
- Feet at Y=0
- Facing +Z (forward)
- T-pose maintained

**Armor Orientation:**
- Center at origin
- Front facing +Z
- Shoulder openings at ±X

### Metadata Recording

```typescript
interface NormalizationMetadata {
  normalized: boolean
  normalizationDate: string
  dimensions: {
    width: number    // X
    height: number   // Y
    depth: number    // Z
  }
  scale: number      // Applied scale factor
  originalSize: number
  targetSize: number
}
```

---

## Stage 7: Material Variants (Optional)

### Purpose

Generate multiple color/material variations of the base model.

### When to Generate Variants

- **enableRetexturing**: true in config
- **Asset has meshyTaskId**: Required for API
- **materialPresets** provided or defaults used

### Variant Generation

See [retexturing.md](./retexturing.md) for complete details.

**Brief Overview:**
1. Use Meshy retexture API
2. Provide base model task ID
3. Apply material-specific prompts
4. Generate PBR textures
5. Preserve UV mapping

**Example Materials:**
- Bronze, Iron, Steel, Mithril (weapons)
- Leather, Chain, Plate (armor)
- Wood variants (items)

---

## Stage 8: Rigging (Optional)

### Purpose

Auto-rig character models for animation.

### When to Rig

- **enableRigging**: true in config
- **Asset type**: 'character' or 'avatar'
- **Model has T-pose**: Critical requirement

### Rigging Process

See [rigging.md](./rigging.md) for complete details.

**Brief Overview:**
1. Use Meshy rigging API
2. Specify character height
3. Generate humanoid skeleton
4. Create walking animation
5. Create running animation
6. Extract T-pose reference

**Output:**
- Rigged GLB with skeleton
- Walking animation file
- Running animation file
- T-pose base for fitting

---

## Stage 9: Sprite Generation (Optional)

### Purpose

Render 2D sprites for 2D game engines or inventory icons.

### When to Generate Sprites

- **enableSprites**: true in config
- **Model successfully normalized**
- **spriteConfig** provided or defaults used

### Sprite Generation

See [image-generation.md](./image-generation.md) for implementation details.

**Brief Overview:**
1. Load GLB model in Three.js
2. Create orthographic camera
3. Render at multiple angles (0°, 45°, 90°, etc.)
4. Save as PNG with transparency
5. Generate metadata

**Default Angles**: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°

**Output Format:**
```typescript
interface SpriteResult {
  angle: string        // "0deg", "45deg", etc.
  imageUrl: string     // Data URL or hosted URL
  width: number        // 256px default
  height: number       // 256px default
}
```

---

## Pipeline State Management

### State Tracking

```typescript
interface PipelineState {
  id: string                    // Unique pipeline ID
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  progress: number              // 0-100
  stages: PipelineStages
  config: GenerationConfig
  results: PipelineResults
  error?: string
  createdAt: Date
  completedAt?: Date
}

interface PipelineStages {
  generation: PipelineStage
  retexturing: PipelineStage
  sprites: PipelineStage
}

interface PipelineStage {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
  error?: string
}
```

### Progress Calculation

```typescript
function calculateProgress(stages: PipelineStages, config: GenerationConfig): number {
  const weights = {
    generation: 70,      // Main generation is 70% of work
    retexturing: 20,     // Variants are 20%
    sprites: 10          // Sprites are 10%
  }

  let totalWeight = weights.generation
  if (config.enableRetexturing) totalWeight += weights.retexturing
  if (config.enableSprites) totalWeight += weights.sprites

  let weightedProgress = 0

  // Main generation
  weightedProgress += (stages.generation.progress / 100) * weights.generation

  // Optional retexturing
  if (config.enableRetexturing) {
    weightedProgress += (stages.retexturing.progress / 100) * weights.retexturing
  }

  // Optional sprites
  if (config.enableSprites) {
    weightedProgress += (stages.sprites.progress / 100) * weights.sprites
  }

  return Math.round((weightedProgress / totalWeight) * 100)
}
```

### Event System

The pipeline emits events for real-time updates:

```typescript
interface GenerationAPIEvents {
  'pipeline:started': { pipelineId: string }
  'progress': { pipelineId: string; progress: number }
  'statusChange': { pipelineId: string; status: string }
  'update': PipelineResult
  'pipeline:completed': PipelineResult
  'pipeline:failed': { pipelineId: string; error?: string }
  'error': { pipelineId: string; error: Error }
}
```

**Usage Example:**
```typescript
const apiClient = new GenerationAPIClient()

apiClient.on('progress', ({ pipelineId, progress }) => {
  console.log(`Pipeline ${pipelineId}: ${progress}%`)
})

apiClient.on('pipeline:completed', (result) => {
  console.log('Generation complete!', result.baseAsset)
})

apiClient.on('error', ({ pipelineId, error }) => {
  console.error(`Pipeline ${pipelineId} error:`, error)
})

const pipelineId = await apiClient.startPipeline(config)
```

---

## Error Recovery

### Retry Strategy

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) throw error

      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))

      // Exponential backoff
      delay *= 2
    }
  }

  throw new Error('Max retries exceeded')
}
```

### Failure Handling

**Image Generation Failure:**
- Retry with simplified prompt
- Fall back to generic style
- Allow manual image upload

**Meshy Conversion Failure:**
- Retry with lower quality
- Check image URL accessibility
- Verify image format/size

**Normalization Failure:**
- Skip normalization (mark as non-normalized)
- Continue with raw model
- Flag for manual review

**Variant Generation Failure:**
- Skip variants
- Complete with base model only
- Allow retry later

### Partial Success

The pipeline can complete successfully even if optional stages fail:

```typescript
interface PipelineResults {
  image3D?: {
    localPath?: string
    modelUrl?: string
  }
  rigging?: {
    localPath?: string
    modelUrl?: string
  }
  textureGeneration?: {
    variants?: Array<{ name: string; modelUrl: string }>
  }
  spriteGeneration?: {
    status?: string
    sprites?: Array<{ angle: number; imageUrl: string }>
  }
}
```

**Success Criteria:**
- Base model generated ✓
- Model normalized ✓
- Variants: optional
- Rigging: optional
- Sprites: optional

---

## Performance Optimization

### Parallel Processing

Where possible, stages run in parallel:

```typescript
// After base model is generated, run these in parallel:
await Promise.allSettled([
  generateVariants(config, meshyTaskId),
  generateRigging(config, modelUrl),
  generateSprites(config, localModelPath)
])
```

### Caching Strategy

**Image Cache:**
```typescript
// Cache generated images for 24 hours
const cacheKey = `image:${promptHash}`
const cachedImage = await cache.get(cacheKey)

if (cachedImage) {
  return cachedImage
}

const newImage = await generateImage(prompt)
await cache.set(cacheKey, newImage, { ttl: 86400 })
```

**Model Cache:**
```typescript
// Cache Meshy task results
const taskCache = new Map<string, MeshyTaskResponse>()

function getCachedTask(taskId: string): MeshyTaskResponse | undefined {
  return taskCache.get(taskId)
}
```

### Resource Management

**Memory:**
- Load one model at a time
- Dispose Three.js objects after sprite generation
- Clear image buffers after upload

**API Rate Limits:**
- OpenAI: 500 requests/day (tier 1)
- Meshy: Varies by plan
- Implement queue system for high volume

---

## Monitoring & Debugging

### Logging

```typescript
interface PipelineLog {
  timestamp: Date
  pipelineId: string
  stage: string
  level: 'info' | 'warn' | 'error'
  message: string
  data?: unknown
}

function logPipelineEvent(log: PipelineLog): void {
  const formatted = `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()} ` +
                   `[${log.pipelineId}:${log.stage}] ${log.message}`

  console.log(formatted)

  if (log.data) {
    console.log('Data:', JSON.stringify(log.data, null, 2))
  }
}
```

### Metrics

**Track:**
- Total pipelines started
- Success rate (%)
- Average completion time
- Failure reasons
- Cost per asset (API calls)
- Cache hit rate

**Example Metrics:**
```typescript
interface PipelineMetrics {
  total: number
  succeeded: number
  failed: number
  avgDuration: number
  avgCost: number
  failureReasons: Record<string, number>
}
```

---

## API Integration

### Starting a Pipeline

```typescript
// Frontend
import { GenerationAPIClient } from '@/services/api/GenerationAPIClient'

const client = new GenerationAPIClient()

const config: GenerationConfig = {
  name: 'Iron Sword',
  type: 'weapon',
  subtype: 'sword',
  description: 'A basic iron sword',
  style: 'runescape',
  quality: 'high',
  enableRetexturing: true,
  enableSprites: true,
  materialPresets: [
    { id: 'bronze', name: 'Bronze', stylePrompt: 'bronze texture' },
    { id: 'steel', name: 'Steel', stylePrompt: 'steel texture' }
  ]
}

const pipelineId = await client.startPipeline(config)
```

### Monitoring Progress

```typescript
// Subscribe to updates
client.on('update', (result) => {
  console.log(`Progress: ${result.progress}%`)
  console.log(`Status: ${result.status}`)
  console.log('Stages:', result.stages)
})

// Check cached status (synchronous)
const status = client.getPipelineStatus(pipelineId)
```

### Backend Endpoint

```typescript
// POST /api/generation/pipeline
app.post('/api/generation/pipeline', async (req, res) => {
  const config: GenerationConfig = req.body

  // Validate
  if (!config.name || !config.description) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Create pipeline
  const pipelineId = generateId()
  const pipeline = new GenerationPipeline(pipelineId, config)

  // Start async
  pipeline.start().catch(error => {
    console.error('Pipeline error:', error)
  })

  // Return immediately
  res.json({ pipelineId })
})

// GET /api/generation/pipeline/:id
app.get('/api/generation/pipeline/:id', async (req, res) => {
  const pipeline = getPipeline(req.params.id)

  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' })
  }

  res.json({
    id: pipeline.id,
    status: pipeline.status,
    progress: pipeline.progress,
    stages: pipeline.stages,
    results: pipeline.results,
    error: pipeline.error
  })
})
```

---

## Configuration Files

### Pipeline Configuration

**Location**: `/Users/home/hyperscape-1/packages/asset-forge/config/pipeline.json`

```json
{
  "defaults": {
    "quality": "high",
    "style": "runescape",
    "enableRetexturing": false,
    "enableSprites": false,
    "enableRigging": false
  },
  "timeouts": {
    "imageGeneration": 60000,
    "meshyConversion": 1200000,
    "normalization": 30000,
    "retexturing": 600000,
    "rigging": 900000,
    "sprites": 120000
  },
  "retries": {
    "imageGeneration": 3,
    "meshyApi": 5,
    "fileDownload": 3
  },
  "polling": {
    "meshyInterval": 10000,
    "meshyTimeout": 1200000
  }
}
```

---

## Best Practices

### 1. Always Validate Input

```typescript
function validateConfig(config: GenerationConfig): void {
  assert(config.name, 'Name required')
  assert(config.description.length >= 10, 'Description too short')
  assert(validTypes.includes(config.type), 'Invalid type')
}
```

### 2. Use Appropriate Quality

- **Standard**: Testing, prototypes
- **High**: Production assets
- **Ultra**: Hero assets, marketing

### 3. Enable Optional Stages Selectively

- Retexturing: Only for items that need variants
- Rigging: Only for characters
- Sprites: Only for 2D games

### 4. Monitor Costs

Track API usage:
- OpenAI: $0.08 per image
- Meshy: Varies by plan
- Total cost per asset: ~$0.10 - $0.50

### 5. Handle Failures Gracefully

```typescript
try {
  await generateAsset(config)
} catch (error) {
  // Log error
  logError(error)

  // Notify user
  notifyFailure(pipelineId, error.message)

  // Attempt recovery
  if (isRetryable(error)) {
    await retryGeneration(config)
  }
}
```

---

## Troubleshooting

### Common Issues

**Issue**: Image generation fails
**Solution**: Simplify prompt, check API key, verify quota

**Issue**: Meshy conversion timeout
**Solution**: Lower quality setting, check image URL accessibility

**Issue**: T-pose not detected in character
**Solution**: Re-run with enhanced T-pose instructions

**Issue**: Variants not generating
**Solution**: Verify meshyTaskId exists, check material prompts

**Issue**: Sprites are black/empty
**Solution**: Check lighting in Three.js scene, verify model loaded

---

## Next Steps

- [Prompt Engineering](./prompt-engineering.md) - Optimize prompts for better results
- [Image Generation](./image-generation.md) - Deep dive into OpenAI integration
- [3D Conversion](./3d-conversion.md) - Meshy.ai configuration and optimization
- [Retexturing](./retexturing.md) - Material variant generation
- [Rigging](./rigging.md) - Character auto-rigging

---

[← Back to Index](../README.md) | [Next: Prompt Engineering →](./prompt-engineering.md)
