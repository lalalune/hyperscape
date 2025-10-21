# 3D Conversion

[← Back to Index](../README.md)

---

## Meshy.ai Image-to-3D Integration

Asset Forge uses Meshy.ai's state-of-the-art image-to-3D API to convert 2D concept art into game-ready 3D models. This document covers the complete Meshy integration, API workflow, quality settings, optimization strategies, and troubleshooting.

---

## Overview

### Purpose

Convert 2D images into textured 3D models (GLB format) suitable for game engines.

### Key Features

- **AI-powered conversion**: Advanced neural networks trained on game assets
- **Game-ready topology**: Quad-based mesh with clean geometry
- **PBR materials**: Physically-based rendering textures
- **Multiple quality tiers**: Standard, high, and ultra settings
- **Fast processing**: 2-20 minutes depending on quality
- **Batch processing**: Handle multiple conversions simultaneously

### Technology

**AI Model**: `meshy-5` (latest generation)
**Input**: 2D images (512x512 to 2048x2048)
**Output**: GLB files with embedded textures
**Topology**: Quad-dominant mesh
**Materials**: PBR (Albedo, Normal, Roughness, Metallic)

---

## Meshy API Workflow

### Complete Flow

```
1. Upload/Host Image
         ↓
2. Submit Image-to-3D Task
         ↓
3. Receive Task ID
         ↓
4. Poll Task Status (every 10 seconds)
         ↓
5. Task Completes (SUCCEEDED/FAILED)
         ↓
6. Download GLB Model
         ↓
7. Save to Local Storage
```

### Authentication

```typescript
const MESHY_API_KEY = process.env.MESHY_API_KEY

if (!MESHY_API_KEY) {
  throw new Error('MESHY_API_KEY environment variable required')
}

const headers = {
  'Authorization': `Bearer ${MESHY_API_KEY}`,
  'Content-Type': 'application/json'
}
```

### API Base URL

```
https://api.meshy.ai
```

---

## Image-to-3D API

### Endpoint

```
POST https://api.meshy.ai/v2/image-to-3d
```

### Request Parameters

```typescript
interface ImageTo3DRequest {
  // Required
  image_url: string                           // Public URL to image

  // Model Configuration
  ai_model: 'meshy-5'                        // Latest model version
  topology: 'quad' | 'triangle'              // Mesh type (quad recommended)

  // Quality Settings
  enable_pbr: boolean                         // Generate PBR textures
  target_polycount?: number                   // Target face count
  texture_resolution?: number                 // 1024, 2048, or 4096

  // Geometry Type
  surface_mode?: 'organic' | 'hard-surface'  // Optimization hint

  // Advanced
  seed?: number                               // For reproducibility
  negative_prompt?: string                    // What to avoid (experimental)
}
```

### Asset Forge Configuration

```typescript
interface QualityConfig {
  target_polycount: number
  enable_pbr: boolean
  texture_resolution: number
}

const QUALITY_PRESETS: Record<string, QualityConfig> = {
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

### Example Request

```typescript
async function startImageTo3D(
  imageUrl: string,
  quality: 'standard' | 'high' | 'ultra' = 'high'
): Promise<string> {
  const config = QUALITY_PRESETS[quality]

  const response = await fetch('https://api.meshy.ai/v2/image-to-3d', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MESHY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image_url: imageUrl,
      ai_model: 'meshy-5',
      topology: 'quad',
      enable_pbr: config.enable_pbr,
      target_polycount: config.target_polycount,
      texture_resolution: config.texture_resolution,
      surface_mode: 'hard-surface'  // Most game assets are hard-surface
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Meshy API error: ${error.message || 'Unknown error'}`)
  }

  const data = await response.json()
  return data.id  // Task ID
}
```

### Response Format

```typescript
interface ImageTo3DResponse {
  id: string                    // Task ID (save this!)
  status: 'PENDING'             // Initial status
  created_at: number            // Unix timestamp
}
```

---

## Quality Levels

### Standard Quality

**Configuration:**
```typescript
{
  target_polycount: 6000,
  enable_pbr: false,
  texture_resolution: 1024
}
```

**Characteristics:**
- ~6,000 triangles
- Single albedo texture (1024x1024)
- No PBR materials
- Fastest processing (2-5 minutes)
- Lowest cost

**Use Cases:**
- Prototyping
- Background props
- Low-end mobile games
- Development/testing

**Limitations:**
- Less geometric detail
- Basic materials only
- May lack fine features

### High Quality (Recommended)

**Configuration:**
```typescript
{
  target_polycount: 12000,
  enable_pbr: true,
  texture_resolution: 2048
}
```

**Characteristics:**
- ~12,000 triangles
- Full PBR materials (2048x2048)
- Albedo, Normal, Roughness, Metallic maps
- Medium processing (5-10 minutes)
- Best quality/cost balance

**Use Cases:**
- Production game assets
- PC/console games
- High-quality mobile
- Hero items/characters

**PBR Textures:**
- **Albedo**: Base color
- **Normal**: Surface detail
- **Roughness**: Surface smoothness
- **Metallic**: Metal vs non-metal

### Ultra Quality

**Configuration:**
```typescript
{
  target_polycount: 20000,
  enable_pbr: true,
  texture_resolution: 4096
}
```

**Characteristics:**
- ~20,000 triangles
- Full PBR materials (4096x4096)
- Maximum detail
- Slowest processing (10-20 minutes)
- Highest cost

**Use Cases:**
- Marketing materials
- Cinematic assets
- Close-up hero objects
- High-end PC games

**File Sizes:**
- GLB: 10-50 MB
- Textures: 20-80 MB (uncompressed)

---

## Polycount Targets

### What is Polycount?

**Definition**: Number of triangular faces in the 3D mesh

**Impact:**
- **Lower polycount**: Faster rendering, less memory, simpler geometry
- **Higher polycount**: More detail, smoother curves, slower rendering

### Target Polycounts by Quality

| Quality | Target | Actual Range | Detail Level |
|---------|--------|--------------|--------------|
| Standard | 6,000 | 4,000-8,000 | Basic shapes, minimal detail |
| High | 12,000 | 10,000-15,000 | Good detail, smooth surfaces |
| Ultra | 20,000 | 18,000-25,000 | High detail, complex geometry |

### Asset Type Recommendations

**Weapons:**
- Simple (dagger, club): 4,000-6,000
- Medium (sword, axe): 8,000-12,000
- Complex (ornate sword): 15,000-20,000

**Armor:**
- Helmet: 6,000-10,000
- Chest piece: 10,000-15,000
- Full set: 30,000-50,000

**Characters:**
- Simple humanoid: 15,000-20,000
- Detailed character: 25,000-35,000
- Hero character: 40,000-60,000

**Props:**
- Small item: 2,000-4,000
- Medium prop: 6,000-10,000
- Large building: 20,000-40,000

### Polycount Optimization

Meshy automatically optimizes geometry, but you can influence results:

```typescript
interface PolycountHints {
  complexity: 'low' | 'medium' | 'high'
  detail_areas: string[]  // "handle", "blade", "guard"
  simplify_areas: string[]  // "back", "bottom"
}

// Note: Meshy doesn't currently support this, but it's good practice
// to design prompts with optimization in mind
```

---

## Texture Resolution

### Resolution Options

**Supported Sizes:**
- 1024x1024 (1K)
- 2048x2048 (2K)
- 4096x4096 (4K)

### Resolution by Quality

| Quality | Resolution | File Size | VRAM Usage |
|---------|------------|-----------|------------|
| Standard | 1024 | ~1 MB | ~4 MB |
| High | 2048 | ~4 MB | ~16 MB |
| Ultra | 4096 | ~16 MB | ~64 MB |

### When to Use Each

**1024 (1K):**
- Mobile games
- Background objects
- Far-view assets
- Performance-critical applications

**2048 (2K)** (Recommended):
- PC/console games
- Mid-range graphics
- Most game assets
- Good balance

**4096 (4K):**
- Marketing/promotional
- Close-up screenshots
- Cinematic sequences
- High-end PC only

### Texture Optimization

```typescript
import sharp from 'sharp'

async function optimizeTexture(
  texturePath: string,
  targetSize: number = 2048
): Promise<Buffer> {
  return await sharp(texturePath)
    .resize(targetSize, targetSize, {
      fit: 'cover',
      kernel: 'lanczos3'
    })
    .jpeg({ quality: 90 })
    .toBuffer()
}
```

---

## PBR Material Generation

### What is PBR?

**Physically-Based Rendering**: Realistic material system used in modern game engines.

**Advantages:**
- Looks realistic under any lighting
- Consistent across engines
- Industry standard
- Easier to work with

### PBR Texture Maps

#### 1. Albedo (Base Color)

**Purpose**: The basic color of the material
**Format**: RGB (no lighting information)
**Example**: Red for iron, gray for steel

#### 2. Normal Map

**Purpose**: Simulates surface detail without geometry
**Format**: RGB encoded normals
**Effect**: Bumps, dents, scratches appear 3D

#### 3. Roughness Map

**Purpose**: How rough/smooth the surface is
**Format**: Grayscale (0=smooth/shiny, 1=rough/matte)
**Example**: Polished metal=0.1, leather=0.8

#### 4. Metallic Map

**Purpose**: Is the material metal or not
**Format**: Grayscale (0=non-metal, 1=metal)
**Binary**: Usually 0 or 1, rarely in-between

### PBR in Meshy

**Standard Quality**: Albedo only (no PBR)
**High/Ultra Quality**: Full PBR (Albedo + Normal + Roughness + Metallic)

**Enable PBR:**
```typescript
{
  enable_pbr: true  // Generates all 4 maps
}
```

**Texture URLs:**
```typescript
interface MeshyTextures {
  baseColorTexture: string      // Albedo map
  normalTexture: string          // Normal map
  roughnessTexture: string       // Roughness map
  metallicTexture: string        // Metallic map
}
```

### Using PBR Textures in Three.js

```typescript
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const gltf = await loader.loadAsync('/path/to/model.glb')

// Textures are embedded in GLB
const mesh = gltf.scene.children[0] as THREE.Mesh
const material = mesh.material as THREE.MeshStandardMaterial

console.log('Albedo:', material.map)
console.log('Normal:', material.normalMap)
console.log('Roughness:', material.roughnessMap)
console.log('Metallic:', material.metallicMap)
```

---

## Topology Settings

### Quad vs Triangle

**Quad Topology** (Recommended):
- Cleaner edge loops
- Better for animation
- Easier to edit
- Standard in 3D modeling

**Triangle Topology**:
- Guaranteed planar faces
- Game engine native
- Slightly faster rendering
- Harder to edit

### Asset Forge Default

```typescript
{
  topology: 'quad'  // Always use quad
}
```

**Why Quad?**
1. Better for rigging/animation
2. Easier to edit in Blender/Maya
3. Cleaner normals
4. Industry standard

### Conversion to Triangles

Game engines automatically convert quads to triangles:

```
Quad (4 vertices) → 2 Triangles
```

So a "12,000 poly" quad model becomes ~24,000 triangles in-engine.

---

## AI Model Selection

### meshy-5

**Latest Model**: meshy-5 (2024)
**Improvements over meshy-4:**
- Better detail capture
- Cleaner topology
- Improved PBR generation
- Faster processing
- Better handling of complex shapes

### Asset Forge Configuration

```typescript
{
  ai_model: 'meshy-5'  // Always use latest
}
```

### Model Evolution

| Version | Release | Key Features |
|---------|---------|--------------|
| meshy-3 | 2023-06 | Initial release |
| meshy-4 | 2023-12 | PBR support, better topology |
| meshy-5 | 2024-06 | Improved detail, faster |

---

## Polling Mechanism

### Why Polling?

Meshy uses **asynchronous processing**:
1. Submit task → get task ID
2. Task processes in background (2-20 minutes)
3. Poll status until complete

### Polling Configuration

```typescript
const POLLING_CONFIG = {
  interval: 10000,       // Poll every 10 seconds
  timeout: 1200000,      // 20 minute timeout
  maxAttempts: 120       // 120 attempts × 10s = 20 minutes
}
```

### Implementation

```typescript
async function pollTaskStatus(taskId: string): Promise<MeshyTaskResult> {
  const startTime = Date.now()
  let attempt = 0

  while (attempt < POLLING_CONFIG.maxAttempts) {
    attempt++

    // Check timeout
    if (Date.now() - startTime > POLLING_CONFIG.timeout) {
      throw new Error(`Task timeout after ${POLLING_CONFIG.timeout}ms`)
    }

    // Fetch status
    const response = await fetch(
      `https://api.meshy.ai/v2/image-to-3d/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${MESHY_API_KEY}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch task status: ${response.statusText}`)
    }

    const task = await response.json()

    // Check status
    switch (task.status) {
      case 'SUCCEEDED':
        return {
          taskId: task.id,
          modelUrl: task.model_url,
          thumbnailUrl: task.thumbnail_url,
          textureUrls: task.texture_urls
        }

      case 'FAILED':
        throw new Error(task.error || 'Meshy task failed')

      case 'PENDING':
      case 'IN_PROGRESS':
        console.log(`Task ${taskId} ${task.status} (${task.progress}%)`)
        await sleep(POLLING_CONFIG.interval)
        continue

      default:
        throw new Error(`Unknown task status: ${task.status}`)
    }
  }

  throw new Error('Max polling attempts exceeded')
}
```

### Optimized Polling

```typescript
class AdaptivePoller {
  private baseInterval = 10000
  private maxInterval = 60000

  async poll(taskId: string): Promise<MeshyTaskResult> {
    let interval = this.baseInterval
    let attempt = 0

    while (true) {
      attempt++
      const task = await this.fetchTask(taskId)

      if (task.status === 'SUCCEEDED') {
        return task
      } else if (task.status === 'FAILED') {
        throw new Error(task.error)
      }

      // Adaptive interval: slower polling over time
      if (attempt > 10) {
        interval = Math.min(interval * 1.2, this.maxInterval)
      }

      console.log(`Polling in ${interval}ms (attempt ${attempt})`)
      await sleep(interval)
    }
  }

  private async fetchTask(taskId: string): Promise<MeshyTask> {
    // Implementation
  }
}
```

---

## Timeout Configuration

### Default Timeouts

```typescript
const TIMEOUTS = {
  standard: 300000,    // 5 minutes
  high: 600000,        // 10 minutes
  ultra: 1200000       // 20 minutes
}
```

### Quality-Based Timeout

```typescript
function getTimeout(quality: 'standard' | 'high' | 'ultra'): number {
  return TIMEOUTS[quality]
}

async function convertWithTimeout(
  imageUrl: string,
  quality: 'standard' | 'high' | 'ultra'
): Promise<MeshyTaskResult> {
  const timeout = getTimeout(quality)
  const taskId = await startImageTo3D(imageUrl, quality)

  // Race between polling and timeout
  return await Promise.race([
    pollTaskStatus(taskId),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Conversion timeout')), timeout)
    )
  ])
}
```

### Handling Timeouts

```typescript
async function robustConversion(
  imageUrl: string,
  quality: 'standard' | 'high' | 'ultra'
): Promise<MeshyTaskResult> {
  try {
    return await convertWithTimeout(imageUrl, quality)
  } catch (error) {
    if (error.message.includes('timeout')) {
      // Try lower quality
      if (quality === 'ultra') {
        console.log('Ultra timeout, retrying with high quality')
        return await convertWithTimeout(imageUrl, 'high')
      } else if (quality === 'high') {
        console.log('High timeout, retrying with standard quality')
        return await convertWithTimeout(imageUrl, 'standard')
      }
    }
    throw error
  }
}
```

---

## Task Status Tracking

### Status Types

```typescript
type MeshyTaskStatus =
  | 'PENDING'        // Queued, not started
  | 'IN_PROGRESS'    // Currently processing
  | 'SUCCEEDED'      // Completed successfully
  | 'FAILED'         // Failed with error
  | 'EXPIRED'        // Task expired (rare)
```

### Task Response

```typescript
interface MeshyTask {
  id: string                     // Task ID
  status: MeshyTaskStatus        // Current status
  progress: number               // 0-100
  created_at: number             // Unix timestamp
  started_at?: number            // When processing started
  finished_at?: number           // When completed
  model_url?: string             // GLB download URL (when SUCCEEDED)
  thumbnail_url?: string         // Preview image URL
  texture_urls?: string[]        // Individual texture URLs (if PBR)
  error?: string                 // Error message (if FAILED)
  video_url?: string             // Turntable video (if requested)
}
```

### Progress Tracking

```typescript
class TaskTracker {
  private tasks = new Map<string, MeshyTask>()

  async trackTask(taskId: string): Promise<void> {
    while (true) {
      const task = await this.fetchTask(taskId)
      this.tasks.set(taskId, task)

      // Emit progress event
      this.emit('progress', {
        taskId,
        progress: task.progress,
        status: task.status
      })

      if (task.status === 'SUCCEEDED' || task.status === 'FAILED') {
        break
      }

      await sleep(10000)
    }
  }

  getTask(taskId: string): MeshyTask | undefined {
    return this.tasks.get(taskId)
  }

  getAllTasks(): MeshyTask[] {
    return Array.from(this.tasks.values())
  }
}
```

### UI Integration

```typescript
// React hook for tracking task
function useTaskProgress(taskId: string) {
  const [task, setTask] = useState<MeshyTask | null>(null)

  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/meshy/task/${taskId}`)
      const data = await response.json()
      setTask(data)

      if (data.status === 'SUCCEEDED' || data.status === 'FAILED') {
        clearInterval(interval)
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [taskId])

  return task
}

// Usage
function TaskProgressBar({ taskId }) {
  const task = useTaskProgress(taskId)

  if (!task) return <div>Loading...</div>

  return (
    <div>
      <div>Status: {task.status}</div>
      <div>Progress: {task.progress}%</div>
      <progress value={task.progress} max={100} />
    </div>
  )
}
```

---

## Downloading Models

### GLB Download

```typescript
async function downloadModel(modelUrl: string, outputPath: string): Promise<void> {
  const response = await fetch(modelUrl)

  if (!response.ok) {
    throw new Error(`Failed to download model: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  await fs.writeFile(outputPath, buffer)
}
```

### Complete Flow

```typescript
async function generateAndSave(
  imageUrl: string,
  assetId: string,
  quality: 'standard' | 'high' | 'ultra' = 'high'
): Promise<string> {
  // 1. Start conversion
  const taskId = await startImageTo3D(imageUrl, quality)
  console.log(`Task started: ${taskId}`)

  // 2. Poll for completion
  const result = await pollTaskStatus(taskId)
  console.log(`Task completed: ${result.modelUrl}`)

  // 3. Download GLB
  const modelPath = path.join(ASSETS_DIR, assetId, 'model.glb')
  await downloadModel(result.modelUrl, modelPath)
  console.log(`Model saved: ${modelPath}`)

  // 4. Download thumbnail
  if (result.thumbnailUrl) {
    const thumbnailPath = path.join(ASSETS_DIR, assetId, 'thumbnail.png')
    await downloadModel(result.thumbnailUrl, thumbnailPath)
  }

  // 5. Save metadata
  await saveMetadata(assetId, {
    meshyTaskId: taskId,
    modelUrl: result.modelUrl,
    quality,
    generatedAt: new Date().toISOString()
  })

  return modelPath
}
```

---

## Error Handling

### Common Errors

#### 1. Invalid Image URL

```json
{
  "error": "Image URL is not accessible"
}
```

**Solution**: Ensure image is publicly accessible

```typescript
async function verifyImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok && response.headers.get('content-type')?.startsWith('image/')
  } catch {
    return false
  }
}
```

#### 2. Task Failed

```json
{
  "status": "FAILED",
  "error": "Failed to generate 3D model from image"
}
```

**Causes:**
- Poor image quality
- Image too complex
- Ambiguous subject
- API error

**Solution**: Retry with different image or simplified prompt

#### 3. Rate Limit

```json
{
  "error": "Rate limit exceeded"
}
```

**Solution**: Implement queue system

```typescript
class TaskQueue {
  private queue: Array<() => Promise<void>> = []
  private processing = false
  private delay = 5000  // 5 seconds between tasks

  async add(task: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await task()
          resolve()
        } catch (error) {
          reject(error)
        }
      })

      if (!this.processing) {
        this.process()
      }
    })
  }

  private async process(): Promise<void> {
    this.processing = true

    while (this.queue.length > 0) {
      const task = this.queue.shift()!
      await task()
      await sleep(this.delay)
    }

    this.processing = false
  }
}
```

---

## Best Practices

### 1. Always Store Task ID

```typescript
await saveMetadata(assetId, {
  meshyTaskId: taskId,  // CRITICAL for retexturing/rigging
  // ...
})
```

### 2. Use High Quality for Production

```typescript
const quality = isProd ? 'high' : 'standard'
```

### 3. Implement Robust Error Handling

```typescript
async function robustConversion(imageUrl: string): Promise<string> {
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await convertTo3D(imageUrl)
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error)

      if (attempt === maxRetries) throw error
      await sleep(10000 * attempt)
    }
  }

  throw new Error('Max retries exceeded')
}
```

### 4. Monitor Costs

Meshy pricing varies by plan. Track usage:

```typescript
interface UsageStats {
  totalTasks: number
  byQuality: Record<string, number>
  totalCost: number
}

const usageTracker = new UsageTracker()
usageTracker.trackTask('high')
```

---

## Troubleshooting

### Issue: Models have artifacts

**Solution**: Use higher quality setting or improve input image

### Issue: Conversion timeout

**Solution**: Lower quality or simplify image

### Issue: Poor topology

**Solution**: Ensure image has clear subject with neutral background

### Issue: Missing details

**Solution**: Use higher polycount target or ultra quality

---

## API Reference

```typescript
async function startImageTo3D(imageUrl: string, quality: string): Promise<string>
async function pollTaskStatus(taskId: string): Promise<MeshyTaskResult>
async function downloadModel(modelUrl: string, outputPath: string): Promise<void>
```

---

## Next Steps

- [Retexturing](./retexturing.md) - Generate material variants
- [Rigging](./rigging.md) - Auto-rig characters
- [Generation Pipeline](./generation-pipeline.md) - Complete pipeline

---

[← Back to Image Generation](./image-generation.md) | [Next: Retexturing →](./retexturing.md)
