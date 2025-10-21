# Rigging

[← Back to Index](../README.md)

---

## Meshy Auto-Rigging System

Asset Forge uses Meshy.ai's auto-rigging API to automatically generate skeletal rigs for character models. This enables animation-ready characters without manual rigging in 3D software, complete with walking and running animations.

---

## Overview

### Purpose

Automatically generate skeletal rigs and animations for humanoid character models.

### Key Features

- **Automatic skeleton generation**: Humanoid rig with standard bone hierarchy
- **Built-in animations**: Walking and running animations included
- **T-pose extraction**: Reference pose for armor fitting
- **Height configuration**: Specify character height in meters
- **Animation-ready**: Compatible with game engines (Unity, Unreal, etc.)

### Requirements

**Critical:**
- Character must be in **T-pose** in source image
- Arms extended horizontally at 90°
- Empty hands (no weapons or items)
- Full body visible (head to feet)
- Humanoid structure (bipedal)

**Not Supported:**
- Non-humanoid characters (quadrupeds, creatures)
- Characters with weapons in hands
- Characters in non-T-pose

---

## Rigging API Workflow

### Complete Flow

```
1. Base Model Generated (T-pose character)
         ↓
2. Verify T-pose Requirements
         ↓
3. Submit Rigging Task
         ↓
4. Meshy Analyzes Geometry
         ↓
5. Generate Skeleton
         ↓
6. Create Animations (walk, run)
         ↓
7. Poll Task Status
         ↓
8. Download Rigged GLB + Animations
         ↓
9. Extract T-pose Reference
         ↓
10. Save as Rigged Asset
```

### Prerequisites

**Required:**
- Base model's `meshyTaskId` or `model_url`
- Character in proper T-pose
- Humanoid structure

**Recommended:**
- Character height specified
- Clean geometry
- Good UV mapping

---

## Rigging Endpoint

### API Endpoint

```
POST https://api.meshy.ai/v2/rigging
```

### Request Parameters

```typescript
interface RiggingRequest {
  // Base Model Reference
  model_url?: string              // GLB URL (option 1)
  input_task_id?: string          // Original task ID (option 2, recommended)

  // Character Configuration
  height?: number                 // Character height in meters (default: 1.7)
  rig_type?: 'humanoid-standard'  // Skeleton type

  // Animations
  include_animations?: boolean    // Generate animations (default: true)
  animation_types?: string[]      // ['walking', 'running'] (default)

  // Advanced
  bind_pose?: 't-pose' | 'a-pose' // Bind pose type (default: t-pose)
}
```

### Asset Forge Configuration

```typescript
interface RiggingConfig {
  baseModelTaskId: string         // meshyTaskId from image-to-3D
  characterHeight?: number        // Height in meters (default 1.7)
  rigType: 'humanoid-standard'   // Always use humanoid-standard
  includeAnimations: true        // Always generate animations
}
```

### Example Request

```typescript
async function rigCharacter(
  baseTaskId: string,
  heightMeters: number = 1.7
): Promise<string> {
  const response = await fetch('https://api.meshy.ai/v2/rigging', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MESHY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input_task_id: baseTaskId,
      height: heightMeters,
      rig_type: 'humanoid-standard',
      include_animations: true,
      animation_types: ['walking', 'running'],
      bind_pose: 't-pose'
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Rigging API error: ${error.message || 'Unknown error'}`)
  }

  const data = await response.json()
  return data.id  // Rigging task ID
}
```

### Response Format

```typescript
interface RiggingResponse {
  id: string                    // Task ID
  status: 'PENDING'             // Initial status
  created_at: number            // Unix timestamp
}
```

---

## Height Configuration

### Purpose

Specify character's real-world height to ensure proper proportions and animation scaling.

### Default Height

```typescript
const DEFAULT_CHARACTER_HEIGHT = 1.7  // meters (average human)
```

### Height by Character Type

**Humans:**
- Average adult: 1.7m (5'7")
- Tall character: 1.9m (6'3")
- Short character: 1.5m (4'11")

**Fantasy Races:**
- Dwarf: 1.2-1.4m
- Elf: 1.8-2.0m
- Halfling: 1.0-1.2m
- Orc: 1.9-2.2m
- Goblin: 0.9-1.1m

**Example Configuration:**
```typescript
const characterHeights = {
  human: 1.7,
  elf: 1.9,
  dwarf: 1.3,
  orc: 2.0,
  goblin: 1.0
}

// Use in rigging
await rigCharacter(taskId, characterHeights.dwarf)
```

### Height Impact

**Animation Speed:**
- Taller characters: Slower animation cycles (longer strides)
- Shorter characters: Faster animation cycles (shorter strides)

**Proportions:**
- Height determines bone lengths
- Affects joint positions
- Influences animation scaling

### Specifying Height

```typescript
interface GenerationConfig {
  riggingOptions?: {
    heightMeters?: number
  }
}

// User specifies height
const config: GenerationConfig = {
  name: 'Orc Warrior',
  type: 'character',
  subtype: 'humanoid',
  description: 'Large orc warrior',
  riggingOptions: {
    heightMeters: 2.0  // 2 meter tall orc
  }
}
```

---

## Humanoid-Standard Rig Type

### Skeleton Structure

**Bone Hierarchy:**
```
Root
├─ Hips
│  ├─ Spine
│  │  ├─ Spine1
│  │  │  ├─ Spine2
│  │  │  │  ├─ Neck
│  │  │  │  │  └─ Head
│  │  │  │  ├─ LeftShoulder
│  │  │  │  │  ├─ LeftArm
│  │  │  │  │  │  ├─ LeftForeArm
│  │  │  │  │  │  │  └─ LeftHand
│  │  │  │  │  │  │     ├─ LeftHandThumb
│  │  │  │  │  │  │     ├─ LeftHandIndex
│  │  │  │  │  │  │     ├─ LeftHandMiddle
│  │  │  │  │  │  │     ├─ LeftHandRing
│  │  │  │  │  │  │     └─ LeftHandPinky
│  │  │  │  └─ RightShoulder
│  │  │  │     ├─ RightArm
│  │  │  │     │  ├─ RightForeArm
│  │  │  │     │  │  └─ RightHand
│  │  │  │     │  │     ├─ RightHandThumb
│  │  │  │     │  │     ├─ RightHandIndex
│  │  │  │     │  │     ├─ RightHandMiddle
│  │  │  │     │  │     ├─ RightHandRing
│  │  │  │     │  │     └─ RightHandPinky
│  ├─ LeftUpLeg
│  │  ├─ LeftLeg
│  │  │  └─ LeftFoot
│  │  │     └─ LeftToeBase
│  └─ RightUpLeg
│     ├─ RightLeg
│     │  └─ RightFoot
│     │     └─ RightToeBase
```

**Total Bones:** ~55 bones (including fingers)

### Standard Bone Names

Compatible with:
- Unity Mecanim
- Unreal Engine Humanoid Rig
- Blender Rigify
- Mixamo animations

### Joint Positions

**Key Joints:**
- **Root**: Origin (0, 0, 0)
- **Hips**: Center of mass
- **Spine**: Lower back
- **Neck**: Base of neck
- **Shoulders**: Clavicle position
- **Elbows**: Mid-arm
- **Wrists**: Hand connection
- **Knees**: Mid-leg
- **Ankles**: Foot connection

### Rig Type Selection

```typescript
{
  rig_type: 'humanoid-standard'  // Only supported type currently
}
```

**Why humanoid-standard?**
1. Industry standard
2. Compatible with animation libraries
3. Works with retargeting systems
4. Supports all major game engines

---

## Animation Generation

### Default Animations

Meshy automatically generates:

1. **Walking Animation**
2. **Running Animation**

### Walking Animation

**Characteristics:**
- Duration: ~1.5 seconds (one complete cycle)
- FPS: 30
- Loopable: Yes
- Frame count: ~45 frames

**Motion:**
- Natural walking gait
- Arms swing opposite to legs
- Weight shift side to side
- Heel-to-toe foot placement

### Running Animation

**Characteristics:**
- Duration: ~1.0 seconds (one complete cycle)
- FPS: 30
- Loopable: Yes
- Frame count: ~30 frames

**Motion:**
- Faster leg movement
- Greater arm swing
- Forward body lean
- Higher knee lift

### Animation Files

**Format:** GLB (separate files)
**Naming:**
- `{assetId}-walking.glb`
- `{assetId}-running.glb`

**Structure:**
```
Each animation file contains:
- Rigged character mesh
- Skeleton
- Animation keyframes
```

### Animation Metadata

```typescript
interface AnimationMetadata {
  name: string              // 'walking' or 'running'
  duration: number          // Seconds
  loop: boolean             // true
  fps: number               // 30
  frameCount: number        // Total frames
  filePath: string          // Path to GLB
}

// Stored in metadata
{
  animations: {
    walking: {
      name: 'Walking',
      duration: 1.5,
      loop: true,
      fps: 30,
      frameCount: 45,
      filePath: '/assets/{id}/animations/walking.glb'
    },
    running: {
      name: 'Running',
      duration: 1.0,
      loop: true,
      fps: 30,
      frameCount: 30,
      filePath: '/assets/{id}/animations/running.glb'
    }
  }
}
```

### Loading Animations in Three.js

```typescript
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

async function loadAnimatedCharacter(modelPath: string, animationPath: string) {
  const loader = new GLTFLoader()

  // Load rigged model
  const modelGltf = await loader.loadAsync(modelPath)
  const model = modelGltf.scene

  // Load animation
  const animGltf = await loader.loadAsync(animationPath)
  const animations = animGltf.animations

  // Create mixer
  const mixer = new THREE.AnimationMixer(model)

  // Play animation
  const action = mixer.clipAction(animations[0])
  action.play()

  return { model, mixer, action }
}

// Usage
const { model, mixer, action } = await loadAnimatedCharacter(
  '/assets/orc-123/rigged-model.glb',
  '/assets/orc-123/animations/walking.glb'
)

// Animate
function animate() {
  requestAnimationFrame(animate)
  mixer.update(0.016)  // 60 FPS
  renderer.render(scene, camera)
}
```

---

## T-Pose Extraction

### Purpose

Extract T-pose mesh for use in armor fitting system.

### What is T-Pose Mesh?

**T-Pose Mesh**: Rigged character in bind pose (T-pose), used as reference for:
- Armor piece generation
- Clothing fitting
- Accessory placement
- Skeleton reference

### Extraction Process

```typescript
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

async function extractTPose(riggedModelPath: string): Promise<Buffer> {
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(riggedModelPath)

  // Get the rigged mesh
  const model = gltf.scene

  // Find the skinned mesh
  let skinnedMesh: THREE.SkinnedMesh | null = null
  model.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && !skinnedMesh) {
      skinnedMesh = child
    }
  })

  if (!skinnedMesh) {
    throw new Error('No skinned mesh found in rigged model')
  }

  // Reset pose to bind pose (T-pose)
  skinnedMesh.skeleton.pose()

  // Update matrices
  skinnedMesh.skeleton.update()

  // Export as GLB
  const exporter = new GLTFExporter()
  const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      model,
      (result) => resolve(result as ArrayBuffer),
      (error) => reject(error),
      { binary: true }
    )
  })

  return Buffer.from(glb)
}
```

### Saving T-Pose Reference

```typescript
async function saveTPoseReference(
  assetId: string,
  riggedModelPath: string
): Promise<string> {
  // Extract T-pose
  const tposeBuffer = await extractTPose(riggedModelPath)

  // Save to file
  const tposePath = path.join(ASSETS_DIR, assetId, 'tpose.glb')
  await fs.writeFile(tposePath, tposeBuffer)

  // Update metadata
  await updateMetadata(assetId, {
    tposeModelPath: tposePath,
    hasTpose: true
  })

  return tposePath
}
```

### Using T-Pose for Fitting

```typescript
import { ArmorFittingService } from '@/services/fitting/ArmorFittingService'

async function fitArmorToCharacter(
  armorModelPath: string,
  characterAssetId: string
): Promise<void> {
  // Load character's T-pose
  const metadata = await loadMetadata(characterAssetId)
  const tposePath = metadata.tposeModelPath

  if (!tposePath) {
    throw new Error('Character has no T-pose reference')
  }

  // Fit armor to T-pose
  const fittingService = new ArmorFittingService()
  const fittedArmor = await fittingService.fitToBody(armorModelPath, tposePath)

  // Save fitted armor
  await saveFittedArmor(fittedArmor)
}
```

---

## Skeleton Structure

### Bone Naming Convention

**Format:** `{Side}{Part}`

**Examples:**
- `LeftArm`, `RightArm`
- `LeftUpLeg`, `RightUpLeg`
- `LeftFoot`, `RightFoot`

**Special Bones:**
- `Root`: Root transform
- `Hips`: Base of spine
- `Spine`, `Spine1`, `Spine2`: Spine segments
- `Neck`: Neck base
- `Head`: Head bone

### Bone Hierarchy Levels

**Level 0 (Root):**
- Root

**Level 1 (Hips):**
- Hips

**Level 2 (Limbs & Spine):**
- Spine
- LeftUpLeg, RightUpLeg

**Level 3 (Extensions):**
- Spine1
- LeftLeg, RightLeg

**Level 4:**
- Spine2
- LeftFoot, RightFoot
- LeftShoulder, RightShoulder

**Level 5:**
- Neck
- LeftArm, RightArm
- LeftToeBase, RightToeBase

**Level 6:**
- Head
- LeftForeArm, RightForeArm

**Level 7:**
- LeftHand, RightHand

**Level 8 (Fingers):**
- Hand finger bones

### Bone Count

**Minimum (no fingers):** 19 bones
**Full (with fingers):** 55 bones
**Asset Forge Default:** 55 bones (full rig)

### Accessing Skeleton in Code

```typescript
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

async function inspectSkeleton(modelPath: string): Promise<void> {
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(modelPath)

  // Find skinned mesh
  let skinnedMesh: THREE.SkinnedMesh | null = null
  gltf.scene.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      skinnedMesh = child
    }
  })

  if (!skinnedMesh) {
    console.log('No skeleton found')
    return
  }

  const skeleton = skinnedMesh.skeleton

  console.log(`Bone count: ${skeleton.bones.length}`)
  console.log('Bone hierarchy:')

  skeleton.bones.forEach((bone, index) => {
    const depth = getDepth(bone)
    const indent = '  '.repeat(depth)
    console.log(`${indent}${index}: ${bone.name}`)
  })
}

function getDepth(bone: THREE.Bone): number {
  let depth = 0
  let current = bone.parent
  while (current && current.type === 'Bone') {
    depth++
    current = current.parent
  }
  return depth
}
```

---

## Animation File Format

### GLB Structure

**Format:** Binary GLTF (.glb)
**Contains:**
- Mesh geometry
- Skeleton (bones)
- Animation keyframes
- Textures (embedded)

### Animation Data

**Keyframe Types:**
- **Translation**: Bone position (Vector3)
- **Rotation**: Bone rotation (Quaternion)
- **Scale**: Bone scale (Vector3)

**Example:**
```javascript
{
  name: 'walking',
  duration: 1.5,
  tracks: [
    {
      name: 'Hips.position',
      times: [0, 0.5, 1.0, 1.5],
      values: [/* Vector3 values */]
    },
    {
      name: 'LeftUpLeg.rotation',
      times: [0, 0.5, 1.0, 1.5],
      values: [/* Quaternion values */]
    }
  ]
}
```

### File Sizes

**Typical Sizes:**
- Rigged model (no animation): 2-5 MB
- Walking animation: 1-2 MB
- Running animation: 1-2 MB
- Total (rigged + 2 animations): 4-9 MB

### Compatibility

**Supported Engines:**
- Three.js (web)
- Unity (import as FBX or GLB)
- Unreal Engine (import as FBX)
- Godot (native GLB support)
- Babylon.js (web)

### Converting to Other Formats

```typescript
// GLB → FBX (for Unity/Unreal)
// Use Blender Python script
const blenderScript = `
import bpy

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import GLB
bpy.ops.import_scene.gltf(filepath='${glbPath}')

# Export FBX
bpy.ops.export_scene.fbx(
  filepath='${fbxPath}',
  use_selection=False,
  add_leaf_bones=False
)
`

// Execute with Blender
await exec(`blender --background --python script.py`)
```

---

## Rigging Status Tracking

### Task Status

```typescript
type RiggingStatus =
  | 'PENDING'        // Queued
  | 'IN_PROGRESS'    // Processing
  | 'SUCCEEDED'      // Completed
  | 'FAILED'         // Failed

interface RiggingTask {
  id: string
  status: RiggingStatus
  progress: number            // 0-100
  created_at: number
  started_at?: number
  finished_at?: number
  rigged_model_url?: string   // Main rigged GLB
  animation_urls?: {
    walking: string
    running: string
  }
  tpose_url?: string          // T-pose reference
  error?: string
}
```

### Polling Implementation

```typescript
async function pollRiggingStatus(taskId: string): Promise<RiggingResult> {
  const maxAttempts = 120  // 20 minutes
  const interval = 10000   // 10 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `https://api.meshy.ai/v2/rigging/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${MESHY_API_KEY}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch rigging status: ${response.statusText}`)
    }

    const task = await response.json()

    switch (task.status) {
      case 'SUCCEEDED':
        return {
          taskId: task.id,
          riggedModelUrl: task.rigged_model_url,
          animationUrls: task.animation_urls,
          tposeUrl: task.tpose_url
        }

      case 'FAILED':
        throw new Error(task.error || 'Rigging failed')

      case 'PENDING':
      case 'IN_PROGRESS':
        console.log(`Rigging ${task.status} (${task.progress}%)`)
        await sleep(interval)
        continue

      default:
        throw new Error(`Unknown status: ${task.status}`)
    }
  }

  throw new Error('Rigging timeout')
}
```

### Progress Updates

```typescript
class RiggingProgressTracker {
  async trackRigging(taskId: string): Promise<RiggingResult> {
    const emitProgress = (progress: number, message: string) => {
      console.log(`[${taskId}] ${progress}%: ${message}`)
      // Emit event for UI
    }

    while (true) {
      const task = await this.fetchTask(taskId)

      emitProgress(task.progress, this.getStatusMessage(task.status))

      if (task.status === 'SUCCEEDED') {
        return this.parseResult(task)
      } else if (task.status === 'FAILED') {
        throw new Error(task.error)
      }

      await sleep(10000)
    }
  }

  private getStatusMessage(status: RiggingStatus): string {
    const messages = {
      PENDING: 'Waiting to start...',
      IN_PROGRESS: 'Generating skeleton and animations...',
      SUCCEEDED: 'Rigging complete!',
      FAILED: 'Rigging failed'
    }
    return messages[status]
  }
}
```

---

## Complete Rigging Workflow

### End-to-End Implementation

```typescript
async function rigCharacterComplete(
  assetId: string,
  baseTaskId: string,
  heightMeters: number = 1.7
): Promise<void> {
  console.log(`Starting rigging for asset ${assetId}`)

  try {
    // 1. Start rigging task
    const riggingTaskId = await rigCharacter(baseTaskId, heightMeters)
    console.log(`Rigging task started: ${riggingTaskId}`)

    // 2. Poll for completion
    const result = await pollRiggingStatus(riggingTaskId)
    console.log('Rigging completed successfully')

    // 3. Download rigged model
    const riggedPath = path.join(ASSETS_DIR, assetId, 'rigged-model.glb')
    await downloadModel(result.riggedModelUrl, riggedPath)
    console.log(`Rigged model saved: ${riggedPath}`)

    // 4. Download animations
    const animationsDir = path.join(ASSETS_DIR, assetId, 'animations')
    await fs.mkdir(animationsDir, { recursive: true })

    const walkingPath = path.join(animationsDir, 'walking.glb')
    await downloadModel(result.animationUrls.walking, walkingPath)

    const runningPath = path.join(animationsDir, 'running.glb')
    await downloadModel(result.animationUrls.running, runningPath)

    console.log('Animations saved')

    // 5. Extract T-pose reference
    const tposePath = await saveTPoseReference(assetId, riggedPath)
    console.log(`T-pose extracted: ${tposePath}`)

    // 6. Update metadata
    await updateMetadata(assetId, {
      isRigged: true,
      riggedModelPath: riggedPath,
      characterHeight: heightMeters,
      animations: {
        walking: {
          name: 'Walking',
          duration: 1.5,
          loop: true,
          fps: 30,
          filePath: walkingPath
        },
        running: {
          name: 'Running',
          duration: 1.0,
          loop: true,
          fps: 30,
          filePath: runningPath
        }
      },
      tposeModelPath: tposePath,
      riggingTaskId: riggingTaskId
    })

    console.log('Rigging complete!')

  } catch (error) {
    console.error('Rigging failed:', error)
    throw error
  }
}
```

---

## Error Handling

### Common Errors

#### 1. Invalid T-Pose

```json
{
  "status": "FAILED",
  "error": "Character not in T-pose"
}
```

**Solution**: Re-generate with stronger T-pose instructions

#### 2. Non-Humanoid Character

```json
{
  "error": "Model is not humanoid"
}
```

**Solution**: Only rig bipedal humanoid characters

#### 3. Arms Not Extended

```json
{
  "error": "Arms not in correct position"
}
```

**Solution**: Ensure arms are horizontal at 90°

### Validation Before Rigging

```typescript
async function validateForRigging(imageBuffer: Buffer): Promise<boolean> {
  // Use GPT-4o-mini to verify T-pose
  const validation = await validateTPose(imageBuffer)

  if (!validation.isTPose) {
    console.error('T-pose validation failed:', validation.issues)
    return false
  }

  return true
}

// Use before rigging
if (!await validateForRigging(conceptArt)) {
  throw new Error('Character not suitable for rigging')
}
```

---

## Best Practices

### 1. Enforce T-Pose in Prompts

```typescript
const RIGGING_PROMPT_REQUIREMENTS =
  "CRITICAL: Character in perfect T-pose. " +
  "Arms stretched HORIZONTALLY at 90 degrees. " +
  "Empty hands. Full body visible. Facing forward."
```

### 2. Specify Accurate Height

```typescript
// Good: Specific height
{ heightMeters: 1.9 }  // Tall elf

// Bad: Default height for all
{ heightMeters: 1.7 }  // Wrong for dwarf!
```

### 3. Extract T-Pose Immediately

```typescript
// After rigging completes
await saveTPoseReference(assetId, riggedModelPath)
```

### 4. Store All Animation Metadata

```typescript
metadata.animations = {
  walking: { /* full metadata */ },
  running: { /* full metadata */ }
}
```

---

## API Reference

```typescript
async function rigCharacter(baseTaskId: string, heightMeters?: number): Promise<string>
async function pollRiggingStatus(taskId: string): Promise<RiggingResult>
async function extractTPose(riggedModelPath: string): Promise<Buffer>
async function rigCharacterComplete(assetId: string, baseTaskId: string, heightMeters?: number): Promise<void>
```

---

## Next Steps

- [Generation Pipeline](./generation-pipeline.md) - Complete pipeline overview
- [3D Conversion](./3d-conversion.md) - Create base models for rigging
- [Retexturing](./retexturing.md) - Generate material variants

---

[← Back to Retexturing](./retexturing.md) | [Back to Index](../README.md)
