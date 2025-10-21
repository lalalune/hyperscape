# Animation System Deep Dive

## Overview

The Asset Forge animation system handles the extraction, playback, and management of skeletal animations for 3D character models. Using Three.js animation mixers and GLTF animation clips, the system provides smooth animation playback, T-pose extraction, and frame-by-frame control for both preview and production use.

This deep dive explores the animation pipeline from GLB loading to playback control and T-pose extraction.

## Table of Contents

- [System Architecture](#system-architecture)
- [Animation Storage](#animation-storage)
- [GLB Animation Structure](#glb-animation-structure)
- [AnimationPlayer Component](#animationplayer-component)
- [Animation Mixer](#animation-mixer)
- [Clock Management](#clock-management)
- [T-Pose Extraction](#t-pose-extraction)
- [Animation Blending](#animation-blending)
- [Skeleton Compatibility](#skeleton-compatibility)
- [GLTFLoader Integration](#gltfloader-integration)
- [Export Pipeline](#export-pipeline)

## System Architecture

The animation system consists of React components and Three.js animation utilities:

```
┌──────────────────────────────────────┐
│      AnimationPlayer Component       │
│  (React + Three.js integration)      │
└────────────┬─────────────────────────┘
             │
      ┌──────┴──────┬───────────┬──────────┐
      │             │           │          │
      ▼             ▼           ▼          ▼
┌──────────┐  ┌─────────┐  ┌───────┐  ┌──────┐
│ThreeViewer│ │Animation│  │Clock  │  │GLTF  │
│           │ │Mixer    │  │       │  │Loader│
└──────────┘  └─────────┘  └───────┘  └──────┘
      │             │
      │             └─────────┐
      │                       │
      ▼                       ▼
┌──────────────┐      ┌───────────────┐
│Scene/Camera  │      │Animation Clips│
│Controls      │      │Walking/Running│
└──────────────┘      └───────────────┘
```

### Core Components

**AnimationPlayer (React)**
- User interface for animation control
- Play/pause/reset functionality
- Animation selection
- Model switching

**ThreeViewer (React + Three.js)**
- 3D scene rendering
- Camera controls
- Model loading
- Animation playback

**AnimationMixer (Three.js)**
- Animation clip playback
- Weight blending
- Time control
- Action management

**Clock (Three.js)**
- Delta time calculation
- Frame-independent animation
- Playback speed control

## Animation Storage

Animations are stored in separate GLB files to keep models modular and allow for easy swapping.

### File Structure

```
assets/
├── {assetId}/
│   ├── model.glb              # Base model (no animations)
│   ├── t-pose.glb             # Extracted T-pose
│   ├── walking.glb            # Walking animation
│   ├── running.glb            # Running animation
│   └── metadata.json          # Asset metadata
```

### Metadata Format

```json
{
  "id": "char_001",
  "name": "Warrior Character",
  "type": "character",
  "height": 1.83,
  "animations": {
    "basic": {
      "tpose": "t-pose.glb",
      "walking": "walking.glb",
      "running": "running.glb"
    }
  },
  "skeleton": {
    "boneCount": 52,
    "rootBone": "Hips"
  }
}
```

### Why Separate Files?

**Advantages:**
- **Modularity**: Swap animations without reloading model
- **Performance**: Load only needed animations
- **Storage**: Avoid duplicating mesh data
- **Flexibility**: Mix animations from different sources

**Disadvantages:**
- **File count**: More files to manage
- **Loading**: Multiple network requests
- **Sync**: Must ensure skeleton compatibility

## GLB Animation Structure

GLB files contain animations as GLTF animation clips.

### GLTF Animation Format

```json
{
  "animations": [
    {
      "name": "Walking",
      "channels": [
        {
          "sampler": 0,
          "target": {
            "node": 5,
            "path": "translation"
          }
        },
        {
          "sampler": 1,
          "target": {
            "node": 5,
            "path": "rotation"
          }
        }
      ],
      "samplers": [
        {
          "input": 0,    // Time accessor
          "output": 1,   // Value accessor
          "interpolation": "LINEAR"
        }
      ]
    }
  ]
}
```

### Animation Components

**Channels:**
- Define which bone is animated
- Specify transform type (translation, rotation, scale)

**Samplers:**
- Define keyframe timing
- Specify interpolation method
- Link to accessor data

**Accessors:**
- Store actual keyframe data
- Input: time values (seconds)
- Output: transform values (vec3, quat, etc.)

### Loading Animations

```typescript
const loader = new GLTFLoader()

// Load model with animations
loader.load('walking.glb', (gltf) => {
  const model = gltf.scene
  const animations = gltf.animations

  console.log(`Loaded ${animations.length} animation(s)`)
  animations.forEach(clip => {
    console.log(`  - ${clip.name}: ${clip.duration}s`)
  })

  // Setup animation mixer
  const mixer = new AnimationMixer(model)
  const action = mixer.clipAction(animations[0])
  action.play()
})
```

## AnimationPlayer Component

The `AnimationPlayer` component provides a React interface for animation control.

### Component Structure

```typescript
interface AnimationPlayerProps {
  modelUrl: string
  animations?: {
    basic?: {
      walking?: string
      running?: string
      tpose?: string
    }
  }
  characterHeight?: number
  assetId?: string
}

export const AnimationPlayer: React.FC<AnimationPlayerProps> = ({
  modelUrl,
  animations,
  characterHeight,
  assetId
}) => {
  const viewerRef = useRef<ThreeViewerRef>(null)
  const [currentAnimation, setCurrentAnimation] = useState<'tpose' | 'walking' | 'running'>('tpose')
  const [isPlaying, setIsPlaying] = useState(false)

  // Component logic...
}
```

### State Management

```typescript
// Animation state
const [currentAnimation, setCurrentAnimation] = useState('tpose')
const [isPlaying, setIsPlaying] = useState(false)
const [primaryModelUrl, setPrimaryModelUrl] = useState('')

// Determine which model to load
useEffect(() => {
  if (animations?.basic?.tpose) {
    setPrimaryModelUrl(`/api/assets/${assetId}/${animations.basic.tpose}`)
  } else if (animations?.basic?.walking) {
    setPrimaryModelUrl(`/api/assets/${assetId}/${animations.basic.walking}`)
  }
}, [animations, assetId])
```

### Animation Switching

```typescript
const handlePlayAnimation = async (
  animId: 'tpose' | 'walking' | 'running'
) => {
  if (!viewerRef.current) return

  // T-pose is static
  if (animId === 'tpose') {
    viewerRef.current.stopAnimation()
    setCurrentAnimation('tpose')
    setIsPlaying(false)
    return
  }

  // Load appropriate model file
  let newModelUrl = ''
  if (animId === 'walking' && animations?.basic?.walking) {
    newModelUrl = `/api/assets/${assetId}/${animations.basic.walking}`
  } else if (animId === 'running' && animations?.basic?.running) {
    newModelUrl = `/api/assets/${assetId}/${animations.basic.running}`
  }

  if (newModelUrl) {
    setPrimaryModelUrl(newModelUrl)
    setCurrentAnimation(animId)
    setIsPlaying(true)
  }
}
```

### UI Controls

```typescript
<div className="animation-controls">
  {availableAnimations.map(anim => (
    <Button
      key={anim.id}
      onClick={() => handlePlayAnimation(anim.id)}
      variant={currentAnimation === anim.id ? 'primary' : 'secondary'}
    >
      {anim.id === 'tpose' ? (
        <RotateCcw />  // T-pose icon
      ) : currentAnimation === anim.id && isPlaying ? (
        <Pause />      // Pause icon
      ) : (
        <Play />       // Play icon
      )}
      <span>{anim.name}</span>
    </Button>
  ))}
</div>
```

## Animation Mixer

The `AnimationMixer` manages animation playback for a model.

### Mixer Setup

```typescript
class ThreeViewer {
  private mixer: AnimationMixer | null = null
  private clock: Clock = new Clock()
  private currentAction: AnimationAction | null = null

  loadModel(url: string) {
    this.loader.load(url, (gltf) => {
      const model = gltf.scene
      const animations = gltf.animations

      // Create mixer
      this.mixer = new AnimationMixer(model)

      // Play first animation
      if (animations.length > 0) {
        this.currentAction = this.mixer.clipAction(animations[0])
        this.currentAction.play()
      }

      // Add model to scene
      this.scene.add(model)
    })
  }
}
```

### Animation Loop

```typescript
private animate = () => {
  requestAnimationFrame(this.animate)

  // Update animation
  if (this.mixer) {
    const delta = this.clock.getDelta()
    this.mixer.update(delta)
  }

  // Render scene
  this.renderer.render(this.scene, this.camera)
}
```

### Multiple Animations

```typescript
// Load multiple animation clips
const animations = gltf.animations

// Create actions for each clip
const actions = {
  idle: this.mixer.clipAction(animations[0]),
  walk: this.mixer.clipAction(animations[1]),
  run: this.mixer.clipAction(animations[2])
}

// Play specific animation
actions.walk.play()

// Switch animations with crossfade
actions.walk.crossFadeTo(actions.run, 0.5)  // 0.5s transition
```

### Action Control

```typescript
// Play animation
action.play()

// Pause animation
action.paused = true

// Stop and reset animation
action.stop()

// Set playback speed
action.timeScale = 0.5  // Half speed
action.timeScale = 2.0  // Double speed

// Loop settings
action.loop = LoopRepeat      // Loop forever
action.loop = LoopOnce        // Play once
action.loop = LoopPingPong    // Back and forth
```

## Clock Management

The `Clock` provides frame-independent timing for animations.

### Clock Usage

```typescript
private clock: Clock = new Clock()

private animate = () => {
  requestAnimationFrame(this.animate)

  // Get time since last frame
  const delta = this.clock.getDelta()

  // Update animations (frame-independent)
  if (this.mixer) {
    this.mixer.update(delta)
  }

  this.renderer.render(this.scene, this.camera)
}
```

### Delta Time Explanation

```
Frame 1:  delta = 0.016s  (60 FPS)
Frame 2:  delta = 0.016s  (60 FPS)
Frame 3:  delta = 0.033s  (30 FPS - slow frame)
Frame 4:  delta = 0.016s  (60 FPS)

Animation progresses by delta each frame:
  Frame 1: time += 0.016  (total: 0.016s)
  Frame 2: time += 0.016  (total: 0.032s)
  Frame 3: time += 0.033  (total: 0.065s)  <- Caught up
  Frame 4: time += 0.016  (total: 0.081s)

Result: Smooth animation regardless of frame rate
```

### Manual Time Control

```typescript
// Get elapsed time since clock started
const elapsed = this.clock.getElapsedTime()

// Stop clock
this.clock.stop()

// Start clock
this.clock.start()

// Get current delta without auto-update
const delta = this.clock.getDelta()
```

## T-Pose Extraction

T-pose extraction creates a static mesh from the first frame of an animation.

### Extraction Algorithm

```typescript
extractTPose(gltf: GLTF): GLTF {
  const model = gltf.scene
  const animations = gltf.animations

  if (animations.length === 0) {
    // Already in T-pose (no animations)
    return gltf
  }

  // Create temporary mixer
  const mixer = new AnimationMixer(model)

  // Play first animation
  const action = mixer.clipAction(animations[0])
  action.play()

  // Update to first frame (time = 0)
  mixer.setTime(0)
  mixer.update(0)

  // Stop and remove animation
  action.stop()

  // Model is now posed at first frame
  // Clone the scene to preserve pose
  const tPoseModel = model.clone(true)

  // Remove animations from clone
  return {
    ...gltf,
    scene: tPoseModel,
    animations: []  // No animations in T-pose file
  }
}
```

### Why Extract T-Pose?

**Benefits:**
- **Reference pose** for rigging tools
- **Bind pose** for skinning operations
- **Default pose** for static display
- **Skeleton validation** easier in T-pose

**T-Pose Characteristics:**
```
    Arms extended horizontally
         ╱   │   ╲
        ╱    │    ╲
       ╱     │     ╲
      ─      │      ─
             │
             │
            ╱ ╲
           ╱   ╲
          ╱     ╲
```

### Export T-Pose

```typescript
exportTPoseModel() {
  if (!this.currentModel) return

  // Extract T-pose
  const tPoseGltf = this.extractTPose({
    scene: this.currentModel,
    animations: this.animations
  })

  // Export as GLB
  const exporter = new GLTFExporter()
  exporter.parse(
    tPoseGltf.scene,
    (result) => {
      const blob = new Blob([result as ArrayBuffer], {
        type: 'model/gltf-binary'
      })

      // Download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 't-pose.glb'
      link.click()
    },
    { binary: true }
  )
}
```

## Animation Blending

Animation blending smoothly transitions between different animations.

### Crossfade Transition

```typescript
crossfadeToAnimation(
  fromAction: AnimationAction,
  toAction: AnimationAction,
  duration: number = 0.5
) {
  // Fade out current animation
  fromAction.fadeOut(duration)

  // Fade in new animation
  toAction
    .reset()
    .setEffectiveTimeScale(1)
    .setEffectiveWeight(1)
    .fadeIn(duration)
    .play()
}
```

### Crossfade Visualization

```
Walk → Run transition (0.5s):

Walk weight:  1.0 ────╲
                      ╲
                       ╲
                        ╲
                         ────  0.0

Run weight:   0.0 ────╱
                     ╱
                    ╱
                   ╱
                  ────  1.0

Time:         0    0.25   0.5s

Smooth blend between animations
```

### Weight Blending

```typescript
// Blend between idle and walk based on speed
const speed = 0.7  // 70% of max speed

actions.idle.setEffectiveWeight(1 - speed)  // 30%
actions.walk.setEffectiveWeight(speed)      // 70%

// Both animations play simultaneously
// Result: 30% idle + 70% walk
```

### Additive Blending

```typescript
// Base animation (walk)
actions.walk.play()

// Additive animation (wave)
actions.wave.blendMode = AdditiveAnimationBlendMode
actions.wave.play()

// Result: Walking + waving
```

## Skeleton Compatibility

Animations can only be applied to skeletons with matching bone structure.

### Skeleton Comparison

```typescript
function skeletonsMatch(
  skeleton1: Skeleton,
  skeleton2: Skeleton
): boolean {
  // Check bone count
  if (skeleton1.bones.length !== skeleton2.bones.length) {
    return false
  }

  // Check bone names
  for (let i = 0; i < skeleton1.bones.length; i++) {
    const bone1 = skeleton1.bones[i]
    const bone2 = skeleton2.bones[i]

    if (bone1.name !== bone2.name) {
      return false
    }
  }

  return true
}
```

### Bone Mapping

When skeletons don't match exactly, bone mapping can be used:

```typescript
function createBoneMap(
  sourceSkeleton: Skeleton,
  targetSkeleton: Skeleton
): Map<string, string> {
  const map = new Map<string, string>()

  // Common bone name variations
  const aliases = {
    'Hips': ['pelvis', 'root', 'hip'],
    'Spine': ['spine1', 'spine01', 'back'],
    'LeftArm': ['l_arm', 'arm_l', 'leftarm'],
    // ...etc
  }

  sourceSkeleton.bones.forEach(sourceBone => {
    // Find matching bone in target
    const targetBone = targetSkeleton.bones.find(tb =>
      tb.name === sourceBone.name ||
      aliases[sourceBone.name]?.includes(tb.name.toLowerCase())
    )

    if (targetBone) {
      map.set(sourceBone.name, targetBone.name)
    }
  })

  return map
}
```

### Retargeting

Animation retargeting adapts animations to different skeletons:

```typescript
function retargetAnimation(
  animation: AnimationClip,
  sourceSkeleton: Skeleton,
  targetSkeleton: Skeleton
): AnimationClip {
  const boneMap = createBoneMap(sourceSkeleton, targetSkeleton)

  // Clone animation
  const retargeted = animation.clone()

  // Remap bone references in tracks
  retargeted.tracks.forEach(track => {
    const boneName = track.name.split('.')[0]
    const targetBoneName = boneMap.get(boneName)

    if (targetBoneName) {
      track.name = track.name.replace(boneName, targetBoneName)
    }
  })

  return retargeted
}
```

## GLTFLoader Integration

The GLTF loader handles animation import automatically.

### Loading with Animations

```typescript
const loader = new GLTFLoader()

loader.load('character.glb', (gltf) => {
  const model = gltf.scene
  const animations = gltf.animations

  console.log(`Model loaded with ${animations.length} animations:`)
  animations.forEach(clip => {
    console.log(`  ${clip.name}:`)
    console.log(`    Duration: ${clip.duration}s`)
    console.log(`    Tracks: ${clip.tracks.length}`)
    console.log(`    FPS: ${1 / clip.tracks[0].times[1]} (approx)`)
  })

  // Setup mixer
  const mixer = new AnimationMixer(model)

  // Create action for each animation
  const actions = animations.map(clip =>
    mixer.clipAction(clip)
  )

  // Play first animation
  if (actions.length > 0) {
    actions[0].play()
  }
})
```

### Animation Tracks

Each animation clip contains multiple tracks:

```typescript
// Walking animation structure
clip.tracks = [
  // Hips translation (root motion)
  {
    name: 'Hips.position',
    times: [0, 0.5, 1.0],
    values: [
      0, 1.0, 0,     // t=0
      0, 1.0, 0.5,   // t=0.5
      0, 1.0, 1.0    // t=1.0
    ]
  },

  // Hips rotation
  {
    name: 'Hips.quaternion',
    times: [0, 0.5, 1.0],
    values: [
      0, 0, 0, 1,    // t=0 (quat)
      0, 0, 0, 1,    // t=0.5
      0, 0, 0, 1     // t=1.0
    ]
  },

  // LeftLeg rotation
  {
    name: 'LeftLeg.quaternion',
    times: [0, 0.5, 1.0],
    values: [
      0.7, 0, 0, 0.7,  // t=0 (leg forward)
      0, 0, 0, 1,      // t=0.5 (neutral)
      -0.7, 0, 0, 0.7  // t=1.0 (leg back)
    ]
  },

  // ...more tracks for other bones
]
```

## Export Pipeline

The export pipeline saves animated models for use in games or other applications.

### Export Options

```typescript
interface ExportOptions {
  format: 'glb' | 'gltf'
  embedImages: boolean
  embedAnimations: boolean
  optimizeSize: boolean
  maxTextureSize: number
}
```

### GLB Export

```typescript
async exportAnimatedModel(
  model: Object3D,
  animations: AnimationClip[],
  options: ExportOptions = { format: 'glb' }
): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter()

  return new Promise((resolve, reject) => {
    exporter.parse(
      model,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result)
        } else {
          // JSON format - convert to binary
          const json = JSON.stringify(result)
          const buffer = new TextEncoder().encode(json)
          resolve(buffer.buffer)
        }
      },
      (error) => reject(error),
      {
        binary: options.format === 'glb',
        embedImages: options.embedImages ?? true,
        animations: animations,
        maxTextureSize: options.maxTextureSize ?? 4096
      }
    )
  })
}
```

### Separate Animation Export

```typescript
// Export model without animations
const modelGlb = await exportAnimatedModel(model, [], {
  format: 'glb',
  embedAnimations: false
})

// Export each animation separately
for (const animation of animations) {
  const animGlb = await exportAnimatedModel(model, [animation], {
    format: 'glb',
    embedAnimations: true
  })

  saveFile(animGlb, `${animation.name}.glb`)
}
```

## Performance Optimization

### Animation LOD

Use simpler animations at distance:

```typescript
const distance = camera.position.distanceTo(character.position)

if (distance > 50) {
  // Far away - use low detail animation
  character.mixer.clipAction(animations.walk_low).play()
} else if (distance > 20) {
  // Medium distance - use medium detail
  character.mixer.clipAction(animations.walk_med).play()
} else {
  // Close - use high detail
  character.mixer.clipAction(animations.walk_high).play()
}
```

### Update Rate Throttling

```typescript
private lastUpdate = 0
private updateInterval = 1000 / 30  // 30 FPS for animations

private animate = () => {
  requestAnimationFrame(this.animate)

  const now = performance.now()
  const delta = this.clock.getDelta()

  // Throttle animation updates
  if (now - this.lastUpdate > this.updateInterval) {
    if (this.mixer) {
      this.mixer.update(delta)
    }
    this.lastUpdate = now
  }

  // Always render at full frame rate
  this.renderer.render(this.scene, this.camera)
}
```

### Action Pooling

Reuse animation actions:

```typescript
class AnimationPool {
  private pool = new Map<string, AnimationAction>()

  getAction(mixer: AnimationMixer, clip: AnimationClip): AnimationAction {
    const key = clip.uuid

    if (!this.pool.has(key)) {
      this.pool.set(key, mixer.clipAction(clip))
    }

    return this.pool.get(key)!
  }

  dispose() {
    this.pool.forEach(action => action.stop())
    this.pool.clear()
  }
}
```

## Common Issues and Solutions

### Issue: Animation plays too fast/slow

**Cause:** Incorrect time scale or FPS mismatch

**Solution:**
```typescript
// Adjust time scale
action.timeScale = 0.5  // Play at half speed

// Or adjust mixer time scale
mixer.timeScale = 2.0   // Play all animations at 2x speed
```

### Issue: Animation pops/jumps at start

**Cause:** Starting from wrong pose

**Solution:**
```typescript
// Reset to bind pose before playing
action.reset()
action.play()

// Or use crossfade
previousAction.crossFadeTo(newAction, 0.3)
```

### Issue: Skeleton doesn't match animation

**Cause:** Animation created for different rig

**Solution:**
```typescript
// Check skeleton compatibility
if (!skeletonsMatch(modelSkeleton, animationSkeleton)) {
  console.warn('Skeleton mismatch!')
  // Use retargeting or bone mapping
  const retargeted = retargetAnimation(animation, animationSkeleton, modelSkeleton)
}
```

### Issue: Root motion not working

**Cause:** Root bone not being updated

**Solution:**
```typescript
// Ensure root bone is in animation
const hasRootMotion = animation.tracks.some(track =>
  track.name.startsWith('Hips.position')
)

if (hasRootMotion) {
  // Root motion animation - update object position
  const rootDelta = extractRootMotion(animation, delta)
  character.position.add(rootDelta)
}
```

## Advanced Features

### Animation Events

Trigger events at specific animation times:

```typescript
mixer.addEventListener('loop', (e) => {
  console.log('Animation looped!')
})

mixer.addEventListener('finished', (e) => {
  console.log('Animation finished!')
})

// Custom events at specific times
function addAnimationEvent(action: AnimationAction, time: number, callback: () => void) {
  const originalUpdate = action.update
  action.update = function(deltaTime: number) {
    const oldTime = action.time
    originalUpdate.call(this, deltaTime)
    const newTime = action.time

    if (oldTime < time && newTime >= time) {
      callback()
    }
  }
}
```

### IK (Inverse Kinematics)

Procedural foot placement:

```typescript
function applyFootIK(
  character: Object3D,
  leftFoot: Bone,
  rightFoot: Bone,
  ground: Mesh
) {
  const raycaster = new Raycaster()

  // Cast rays from feet
  [leftFoot, rightFoot].forEach(foot => {
    const footPos = new Vector3()
    foot.getWorldPosition(footPos)

    raycaster.set(footPos, new Vector3(0, -1, 0))
    const hits = raycaster.intersectObject(ground)

    if (hits.length > 0) {
      // Adjust foot to ground level
      const targetY = hits[0].point.y
      foot.position.y += (targetY - footPos.y)
    }
  })
}
```

### Animation Compression

Reduce file size by quantizing keyframes:

```typescript
function compressAnimation(animation: AnimationClip): AnimationClip {
  const compressed = animation.clone()

  compressed.tracks.forEach(track => {
    // Reduce keyframe precision
    if (track instanceof VectorKeyframeTrack) {
      track.values = track.values.map(v =>
        Math.round(v * 1000) / 1000  // 3 decimal places
      )
    }

    // Remove redundant keyframes
    const simplified = simplifyTrack(track, 0.001)  // 1mm tolerance
    track.times = simplified.times
    track.values = simplified.values
  })

  return compressed
}
```

## Conclusion

The Asset Forge animation system provides a complete solution for skeletal animation playback, from GLB loading to smooth transitions and T-pose extraction. By leveraging Three.js AnimationMixer, Clock management, and proper component architecture, the system delivers production-quality animation preview and control.

Key takeaways:

1. **Separate animation files** enable modularity
2. **AnimationMixer** handles playback and blending
3. **Clock-based updates** ensure frame-independent animation
4. **T-pose extraction** provides reference poses
5. **Skeleton compatibility** is critical for retargeting
6. **Crossfading** creates smooth transitions

This animation pipeline integrates seamlessly with the Asset Forge ecosystem to provide complete character animation support from creation to playback.
