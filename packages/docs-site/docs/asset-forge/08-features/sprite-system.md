# Sprite Generation System Deep Dive

## Overview

The sprite generation system renders 2D sprites from 3D models for use in isometric, top-down, or 2D game views. Using Three.js rendering with orthographic cameras and optimized lighting, the system can capture multiple angles, poses, and resolutions to create complete sprite sheets for characters, items, and environment objects.

This deep dive explores the sprite generation pipeline from camera setup to multi-angle rendering and export.

## Table of Contents

- [System Architecture](#system-architecture)
- [SpriteGenerationService](#spritegenerationservice)
- [Camera Configuration](#camera-configuration)
- [Lighting Setup](#lighting-setup)
- [Multi-Angle Rendering](#multi-angle-rendering)
- [Orthographic Projection](#orthographic-projection)
- [Isometric Sprites](#isometric-sprites)
- [Character Sprite Mode](#character-sprite-mode)
- [Resolution Options](#resolution-options)
- [Background Transparency](#background-transparency)
- [Sprite Metadata](#sprite-metadata)
- [File Organization](#file-organization)

## System Architecture

The sprite generation system centers around the `SpriteGenerationService`:

```
┌────────────────────────────────────┐
│   SpriteGenerationService          │
├────────────────────────────────────┤
│ - WebGPURenderer                   │
│ - Scene                            │
│ - OrthographicCamera               │
│ - Lighting Setup                   │
│ - GLTFLoader                       │
└────────┬───────────────────────────┘
         │
    ┌────┴─────┬──────────┬────────┐
    │          │          │        │
    ▼          ▼          ▼        ▼
┌────────┐ ┌──────┐ ┌────────┐ ┌──────┐
│Load    │ │Setup │ │Render  │ │Export│
│Model   │ │Camera│ │Angles  │ │Images│
└────────┘ └──────┘ └────────┘ └──────┘
```

### Core Components

**WebGPURenderer**
- Renders 3D scenes to 2D images
- Supports transparency (alpha channel)
- Antialiasing for smooth edges
- Shadow mapping for depth

**Scene**
- Contains the 3D model
- Manages lighting
- Background configuration

**OrthographicCamera**
- No perspective distortion
- Consistent object size
- Ideal for sprites

**Lighting**
- Ambient light for base illumination
- Directional light for shadows
- Shadow mapping for depth cues

## SpriteGenerationService

The main service class manages the entire sprite generation pipeline.

### Class Structure

```typescript
export class SpriteGenerationService {
  private renderer: WebGPURenderer
  private scene: Scene
  private camera: OrthographicCamera
  private loader: GLTFLoader

  constructor() {
    // Create renderer
    this.renderer = new WebGPURenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    })
    this.renderer.setSize(512, 512)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap

    // Create scene
    this.scene = new Scene()

    // Create orthographic camera
    const frustumSize = 5
    this.camera = new OrthographicCamera(
      frustumSize * -0.5,  // left
      frustumSize * 0.5,   // right
      frustumSize * 0.5,   // top
      frustumSize * -0.5,  // bottom
      0.1,                 // near
      1000                 // far
    )

    // Setup lighting
    this.setupLights()

    // Create loader
    this.loader = new GLTFLoader()
  }

  private setupLights(): void {
    // Ambient light (60% brightness)
    const ambientLight = new AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    // Main directional light (80% brightness)
    const directionalLight = new DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 10, 5)
    directionalLight.castShadow = true

    // Shadow camera setup
    directionalLight.shadow.camera.near = 0.1
    directionalLight.shadow.camera.far = 50
    directionalLight.shadow.camera.left = -10
    directionalLight.shadow.camera.right = 10
    directionalLight.shadow.camera.top = 10
    directionalLight.shadow.camera.bottom = -10

    this.scene.add(directionalLight)
  }

  async generateSprites(
    options: SpriteGenerationOptions
  ): Promise<SpriteResult[]> {
    // Implementation details...
  }
}
```

### Initialization

The renderer is configured for optimal sprite quality:

```typescript
constructor() {
  this.renderer = new WebGPURenderer({
    antialias: true,              // Smooth edges
    alpha: true,                  // Transparency support
    preserveDrawingBuffer: true   // Allow canvas readback
  })

  // Enable shadows
  this.renderer.shadowMap.enabled = true
  this.renderer.shadowMap.type = PCFSoftShadowMap  // Soft shadows
}
```

## Camera Configuration

The orthographic camera is carefully configured to provide consistent sprite rendering.

### Orthographic Setup

```typescript
const aspect = 1  // Square aspect ratio
const frustumSize = 5  // Scene units visible

this.camera = new OrthographicCamera(
  frustumSize * aspect / -2,  // left: -2.5
  frustumSize * aspect / 2,   // right: 2.5
  frustumSize / 2,            // top: 2.5
  frustumSize / -2,           // bottom: -2.5
  0.1,                        // near plane
  1000                        // far plane
)
```

### Frustum Visualization

```
         top (2.5)
           │
    left ──┼── right
   (-2.5)  │  (2.5)
           │
        bottom (-2.5)

Everything within this box is rendered
Objects outside are clipped
```

### Camera Positioning

The camera is positioned at a 45-degree angle for a typical 3D view:

```typescript
// Position camera
this.camera.position.set(5, 5, 5)  // 45° angle from X, Y, Z axes
this.camera.lookAt(0, 0, 0)        // Look at origin
```

### Camera Positioning Diagram

```
                Y (up)
                │
                │
              Camera (5, 5, 5)
               /│\
              / │ \
             /  │  \
            /   │   \
           /    │    \
          /     │     \
         /      │      \
        /       │       \
       /    Model (0,0,0)\
      /         │         \
     /──────────┼──────────\── X
   Z            │
```

## Lighting Setup

Lighting is configured to provide even illumination without harsh shadows.

### Three-Point Lighting

```typescript
// 1. Ambient Light (base illumination)
const ambientLight = new AmbientLight(0xffffff, 0.6)
this.scene.add(ambientLight)

// 2. Main Directional Light (key light)
const directionalLight = new DirectionalLight(0xffffff, 0.8)
directionalLight.position.set(5, 10, 5)  // From above-right-front
directionalLight.castShadow = true
this.scene.add(directionalLight)
```

### Light Positioning

```
         │  Key Light (5, 10, 5)
         │  /
         │ /
         │/
        Model
         │
      Ground Plane
```

### Shadow Configuration

```typescript
// Configure shadow camera
directionalLight.shadow.camera.near = 0.1
directionalLight.shadow.camera.far = 50
directionalLight.shadow.camera.left = -10
directionalLight.shadow.camera.right = 10
directionalLight.shadow.camera.top = 10
directionalLight.shadow.camera.bottom = -10

// Shadow map quality
this.renderer.shadowMap.type = PCFSoftShadowMap  // Soft edges
```

### Shadow Quality Comparison

```
No Shadows:           Hard Shadows:         Soft Shadows (PCF):
   ┌───┐                ┌───┐                  ┌───┐
   │   │                │   │                  │   │
   └───┘                └───┘                  └───┘
                        ■■■■                    ░░▒▒
   No depth             Sharp edge              Gradient edge
```

## Multi-Angle Rendering

Sprites are typically rendered from 8 cardinal directions for full coverage.

### Standard Angles

```typescript
const angles = [
  0,     // North (front)
  45,    // Northeast
  90,    // East (right)
  135,   // Southeast
  180,   // South (back)
  225,   // Southwest
  270,   // West (left)
  315    // Northwest
]
```

### Angle Diagram (Top View)

```
           0° (N)
           │
      315° │ 45°
          \│/
    270° ──●── 90°
          /│\
      225° │ 135°
           │
          180° (S)

● = Model center
Arrows = Camera positions
```

### Rendering Loop

```typescript
async generateSprites(
  options: SpriteGenerationOptions
): Promise<SpriteResult[]> {
  const {
    modelPath,
    outputSize = 256,
    angles = [0, 45, 90, 135, 180, 225, 270, 315],
    backgroundColor = 'transparent',
    padding = 0.1
  } = options

  // Load model
  const gltf = await this.loadModel(modelPath)
  const model = gltf.scene

  // Center and scale model
  this.prepareModel(model, padding)

  // Add to scene
  this.scene.add(model)

  const sprites: SpriteResult[] = []

  // Render each angle
  for (const angle of angles) {
    // Position camera around Y axis
    const radian = (angle * Math.PI) / 180
    const distance = 7

    this.camera.position.x = Math.sin(radian) * distance
    this.camera.position.z = Math.cos(radian) * distance
    this.camera.position.y = 5  // Elevated view
    this.camera.lookAt(0, 0, 0)

    // Render
    this.renderer.render(this.scene, this.camera)

    // Get image data
    const imageUrl = this.renderer.domElement.toDataURL('image/png')

    sprites.push({
      angle: `${angle}deg`,
      imageUrl,
      width: outputSize,
      height: outputSize
    })
  }

  // Cleanup
  this.scene.remove(model)

  return sprites
}
```

### Camera Path Visualization

```
Camera moves in a circle around the model:

    5 ──────● (angle=0°)
    │      /
    │     /  radius=7
    │    /
    │   /
    │  /
    │ /
    ●────────── X
    │ \
  Z │  \
    │   \
    │    ● (angle=90°)
```

## Orthographic Projection

Orthographic projection is essential for sprite generation because it eliminates perspective distortion.

### Perspective vs Orthographic

```
Perspective:              Orthographic:
   Far objects smaller    All same size

    ╱─╲                      ┌─┐
   ╱   ╲                     │ │
  ╱     ╲                    │ │
 ╱ ┌─┐   ╲                   │ │
╱  │ │    ╲                  │ │
───┴─┴─────                  └─┘

 Camera                     Camera

Sprites need orthographic!
```

### Frustum Adjustment

The frustum size determines how much of the scene is visible:

```typescript
// Model bounds
const box = new Box3().setFromObject(model)
const size = box.getSize(new Vector3())

// Scale model to fit in frustum with padding
const maxDim = Math.max(size.x, size.y, size.z)
const frustumSize = this.camera.right - this.camera.left
const scale = frustumSize * (1 - padding) / maxDim
model.scale.multiplyScalar(scale)
```

### Frustum Fitting

```
Frustum (5 units):        Model (3 units):      Scaled Model:

┌─────────────┐           ┌───────┐             ┌─────────┐
│             │           │       │             │         │
│             │           │   ●   │     →       │    ●    │
│             │           │       │             │         │
└─────────────┘           └───────┘             └─────────┘

  Too small                 Correct size
```

## Isometric Sprites

Isometric sprites use a specific camera angle (typically 30°) for a classic isometric look.

### Isometric Camera Setup

```typescript
async generateIsometricSprites(
  modelPath: string,
  outputSize: number = 128
): Promise<SpriteResult[]> {
  // Set isometric angle (30°)
  const angle = Math.PI / 6  // 30 degrees

  this.camera.position.set(
    5,                        // X offset
    5 * Math.tan(angle),      // Y height for 30° angle
    5                         // Z offset
  )
  this.camera.lookAt(0, 0, 0)

  // Generate sprites at 8 directions
  return this.generateSprites({
    modelPath,
    outputSize,
    angles: [0, 45, 90, 135, 180, 225, 270, 315],
    backgroundColor: 'transparent'
  })
}
```

### Isometric Angle Diagram

```
Side View:

    Camera
      ●
      │\
      │ \   30°
      │  \  /
    Y │   \/
      │   Model
      │    ●
      └────────── Ground
```

### Isometric Projection Math

```
Height = Distance × tan(30°)
       = 5 × 0.577
       = 2.887 units

Angle = arctan(Height / Distance)
      = arctan(2.887 / 5)
      = 30°
```

## Character Sprite Mode

Character sprites typically need multiple poses (idle, walk, attack, etc.).

### Animation Frame Extraction

```typescript
async generateCharacterSprites(
  modelPath: string,
  animations?: string[],
  outputSize: number = 256
): Promise<Record<string, SpriteResult[]>> {
  const gltf = await this.loadModel(modelPath)
  const model = gltf.scene

  const spritesByAnimation: Record<string, SpriteResult[]> = {}

  // Extract T-pose (idle)
  const idleSprites = await this.generateSprites({
    modelPath,
    outputSize,
    angles: [0, 90, 180, 270],  // 4 directions
    backgroundColor: 'transparent'
  })

  spritesByAnimation['idle'] = idleSprites

  // TODO: Extract other animation frames
  // For each animation:
  //   - Load animation clip
  //   - Sample key frames
  //   - Render each frame at each angle
  //   - Store in spritesByAnimation[animName]

  return spritesByAnimation
}
```

### Animation Sampling

For animated sprites, key frames are sampled:

```
Walking Animation (1 second):

Frame: 0     0.25    0.5     0.75    1.0
       │      │       │       │       │
       ╱      │       ╱       │      ╱
      ╱       ╱      ╱       ╱      ╱
     ─        ─      ─       ─      ─

Sample at 0.25s intervals for 4 walking frames
```

### Sprite Sheet Layout

```
Character Sprite Sheet:

┌─────────────────────────────────┐
│ Idle   Idle   Idle   Idle       │  4 directions
│  0°     90°    180°   270°      │
├─────────────────────────────────┤
│ Walk1  Walk1  Walk1  Walk1      │  4 directions
│  0°     90°    180°   270°      │
├─────────────────────────────────┤
│ Walk2  Walk2  Walk2  Walk2      │  4 directions
│  0°     90°    180°   270°      │
└─────────────────────────────────┘
```

## Resolution Options

Different use cases require different resolutions.

### Standard Resolutions

```typescript
const resolutions = {
  thumbnail: 64,      // Quick preview
  icon: 128,          // UI icons
  sprite: 256,        // Standard game sprites
  billboard: 512,     // Large objects
  hires: 1024         // High detail
}
```

### Resolution vs Quality

```
64x64 (Icon):         256x256 (Standard):   512x512 (High):

  ┌──┐                  ┌────────┐            ┌──────────────┐
  │░▒│  Pixelated       │  ░░▒▒  │  Smooth    │    ░░░▒▒▒    │
  └──┘                  └────────┘            └──────────────┘

  Fast, small          Good quality          Best quality
  ~4 KB                ~50 KB                ~200 KB
```

### Resolution Configuration

```typescript
// Update renderer size
this.renderer.setSize(outputSize, outputSize)

// Update camera aspect (stays square)
const aspect = 1
const frustumSize = 5

this.camera.left = frustumSize * aspect / -2
this.camera.right = frustumSize * aspect / 2
this.camera.top = frustumSize / 2
this.camera.bottom = frustumSize / -2
this.camera.updateProjectionMatrix()
```

## Background Transparency

Transparent backgrounds allow sprites to be composited onto any scene.

### Alpha Channel Setup

```typescript
// Set transparent background
if (backgroundColor === 'transparent') {
  this.renderer.setClearColor(0x000000, 0)  // Black, 0 alpha
} else {
  this.renderer.setClearColor(backgroundColor)
}
```

### PNG Export with Alpha

```typescript
// Export canvas as PNG with alpha
const imageUrl = this.renderer.domElement.toDataURL('image/png')

// Result:
// - RGB channels: sprite color
// - Alpha channel: transparency mask
```

### Transparency Example

```
Model on Transparent:    Model on Color:

    ┌──────┐                ┌──────┐
    │ ░▒▓█ │                │▓▓▓▓▓▓│
    │ ▒▓██ │                │▓░▒▓█▓│
    │ ▓███ │                │▓▒▓██▓│
    └──────┘                └──────┘

  Transparent BG          Solid BG
  Composites well         Fixed color
```

## Sprite Metadata

Each sprite includes metadata for organization and usage.

### Sprite Result Format

```typescript
export interface SpriteResult {
  angle: string        // "0deg", "45deg", etc.
  imageUrl: string     // Base64 data URL
  width: number        // Image width in pixels
  height: number       // Image height in pixels
}
```

### Example Result

```typescript
{
  angle: "0deg",
  imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANS...",
  width: 256,
  height: 256
}
```

### Extended Metadata

For production use, additional metadata can be included:

```typescript
export interface ExtendedSpriteResult extends SpriteResult {
  modelName: string           // Source model name
  renderTime: number          // Time to render (ms)
  fileSize: number            // Estimated file size (bytes)
  bounds: {
    minX: number              // Sprite bounds
    minY: number
    maxX: number
    maxY: number
  }
  pivot: {                    // Pivot point for placement
    x: number
    y: number
  }
}
```

## File Organization

Sprites are organized by model, angle, and resolution.

### Directory Structure

```
sprites/
├── characters/
│   ├── warrior/
│   │   ├── idle/
│   │   │   ├── 000deg_256px.png
│   │   │   ├── 045deg_256px.png
│   │   │   ├── 090deg_256px.png
│   │   │   └── ...
│   │   └── walk/
│   │       ├── frame1/
│   │       │   ├── 000deg_256px.png
│   │       │   └── ...
│   │       └── frame2/
│   │           └── ...
│   └── mage/
│       └── ...
├── items/
│   ├── sword/
│   │   ├── 000deg_128px.png
│   │   └── ...
│   └── potion/
│       └── ...
└── buildings/
    └── house/
        ├── 000deg_512px.png
        └── ...
```

### Naming Convention

```
Format: {angle}deg_{resolution}px.png

Examples:
  000deg_256px.png  - Front view, 256x256
  090deg_128px.png  - Right view, 128x128
  180deg_512px.png  - Back view, 512x512
```

### Sprite Sheet Generation

Multiple sprites can be combined into a single sprite sheet:

```typescript
function createSpriteSheet(
  sprites: SpriteResult[],
  layout: 'horizontal' | 'vertical' | 'grid'
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  if (layout === 'horizontal') {
    // Arrange sprites horizontally
    canvas.width = sprites[0].width * sprites.length
    canvas.height = sprites[0].height

    sprites.forEach((sprite, i) => {
      const img = new Image()
      img.src = sprite.imageUrl
      img.onload = () => {
        ctx.drawImage(img, i * sprite.width, 0)
      }
    })
  } else if (layout === 'grid') {
    // Arrange in grid (4x2 for 8 sprites)
    const cols = Math.ceil(Math.sqrt(sprites.length))
    const rows = Math.ceil(sprites.length / cols)

    canvas.width = sprites[0].width * cols
    canvas.height = sprites[0].height * rows

    sprites.forEach((sprite, i) => {
      const img = new Image()
      img.src = sprite.imageUrl
      img.onload = () => {
        const col = i % cols
        const row = Math.floor(i / cols)
        ctx.drawImage(
          img,
          col * sprite.width,
          row * sprite.height
        )
      }
    })
  }

  return canvas
}
```

### Sprite Sheet Example

```
8-Direction Sprite Sheet (4x2 grid):

┌────┬────┬────┬────┐
│ 0° │45° │90° │135°│
├────┼────┼────┼────┤
│180°│225°│270°│315°│
└────┴────┴────┴────┘

Single file, multiple views
Efficient for game engines
```

## Model Preparation

Models must be properly prepared before sprite generation.

### Centering and Scaling

```typescript
private prepareModel(
  model: Object3D,
  padding: number
): void {
  // 1. Calculate bounding box
  const box = new Box3().setFromObject(model)
  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())

  // 2. Move model to origin
  model.position.sub(center)

  // 3. Scale to fit in camera frustum
  const maxDim = Math.max(size.x, size.y, size.z)
  const frustumSize = this.camera.right - this.camera.left
  const scale = frustumSize * (1 - padding) / maxDim
  model.scale.multiplyScalar(scale)

  // 4. Update matrices
  model.updateMatrixWorld(true)
}
```

### Before and After

```
Before Preparation:         After Preparation:

   ┌─────────┐                ┌──────┐
   │         │                │      │
   │    ●    │    →           │  ●   │
   │ (off)   │                │(0,0) │
   └─────────┘                └──────┘

  Not centered              Centered, scaled
  Wrong size                Fits in view
```

## Performance Optimization

### Batch Rendering

Render multiple angles in one pass:

```typescript
async batchGenerateSprites(
  modelPaths: string[],
  options: SpriteGenerationOptions
): Promise<Map<string, SpriteResult[]>> {
  const results = new Map<string, SpriteResult[]>()

  for (const modelPath of modelPaths) {
    const sprites = await this.generateSprites({
      ...options,
      modelPath
    })
    results.set(modelPath, sprites)
  }

  return results
}
```

### Renderer Reuse

Reuse the same renderer for all sprites:

```typescript
// Good: Single renderer for all sprites
const service = new SpriteGenerationService()
for (const model of models) {
  await service.generateSprites({ modelPath: model })
}

// Bad: New renderer for each sprite
for (const model of models) {
  const service = new SpriteGenerationService()  // Creates new WebGPU context
  await service.generateSprites({ modelPath: model })
  service.dispose()  // Cleanup
}
```

### Caching

Cache generated sprites to avoid re-rendering:

```typescript
class SpriteCache {
  private cache = new Map<string, SpriteResult[]>()

  getCacheKey(modelPath: string, options: SpriteGenerationOptions): string {
    return `${modelPath}_${options.outputSize}_${options.angles?.join(',')}`
  }

  get(modelPath: string, options: SpriteGenerationOptions): SpriteResult[] | null {
    const key = this.getCacheKey(modelPath, options)
    return this.cache.get(key) || null
  }

  set(modelPath: string, options: SpriteGenerationOptions, sprites: SpriteResult[]): void {
    const key = this.getCacheKey(modelPath, options)
    this.cache.set(key, sprites)
  }
}
```

## Use Cases

### Top-Down Games

```typescript
// 8-direction sprites for top-down view
const sprites = await service.generateSprites({
  modelPath: 'character.glb',
  outputSize: 128,
  angles: [0, 45, 90, 135, 180, 225, 270, 315],
  backgroundColor: 'transparent'
})
```

### Item Icons

```typescript
// Single front-facing icon
const icon = await service.generateSprites({
  modelPath: 'sword.glb',
  outputSize: 64,
  angles: [45],  // Single 45° angle
  backgroundColor: '#1a1a1a'  // Dark background
})
```

### Isometric Strategy Games

```typescript
// Isometric sprites for strategy game
const sprites = await service.generateIsometricSprites(
  'building.glb',
  256
)
```

### Billboard Sprites

```typescript
// High-res billboard for 3D world
const billboard = await service.generateSprites({
  modelPath: 'tree.glb',
  outputSize: 512,
  angles: [0],  // Single front view
  backgroundColor: 'transparent'
})
```

## Common Issues and Solutions

### Issue: Sprite too small in output

**Cause:** Model not scaled to fit frustum

**Solution:**
```typescript
// Adjust padding
const sprites = await service.generateSprites({
  modelPath: 'character.glb',
  padding: 0.05  // Less padding = larger sprite (default: 0.1)
})
```

### Issue: Sprite clipped at edges

**Cause:** Model extends beyond frustum

**Solution:**
```typescript
// Increase frustum size or padding
const sprites = await service.generateSprites({
  modelPath: 'character.glb',
  padding: 0.2  // More padding = smaller sprite but no clipping
})
```

### Issue: Dark sprites

**Cause:** Insufficient lighting

**Solution:**
```typescript
// Increase ambient light
const ambientLight = new AmbientLight(0xffffff, 0.8)  // Was 0.6
```

### Issue: Jagged edges

**Cause:** Antialiasing disabled or low resolution

**Solution:**
```typescript
// Ensure antialiasing and use higher resolution
this.renderer = new WebGPURenderer({
  antialias: true,
  // ...
})

const sprites = await service.generateSprites({
  modelPath: 'character.glb',
  outputSize: 512  // Higher resolution
})
```

## Advanced Features

### Custom Camera Angles

```typescript
// Custom camera positions for specific views
const customAngles = [
  { angle: 30, elevation: 20 },   // Low angle
  { angle: 45, elevation: 45 },   // Standard isometric
  { angle: 60, elevation: 60 }    // High angle
]

for (const { angle, elevation } of customAngles) {
  const radian = (angle * Math.PI) / 180
  const elevRadian = (elevation * Math.PI) / 180

  this.camera.position.set(
    Math.sin(radian) * Math.cos(elevRadian) * 7,
    Math.sin(elevRadian) * 7,
    Math.cos(radian) * Math.cos(elevRadian) * 7
  )
  this.camera.lookAt(0, 0, 0)

  // Render...
}
```

### Outline Effect

```typescript
// Add outline shader for better visibility
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass'

const composer = new EffectComposer(this.renderer)
const outlinePass = new OutlinePass(
  new Vector2(outputSize, outputSize),
  this.scene,
  this.camera
)
outlinePass.edgeStrength = 3
outlinePass.edgeThickness = 1
composer.addPass(outlinePass)
```

### Shadow Ground Plane

```typescript
// Add ground plane for shadows
const groundGeometry = new PlaneGeometry(10, 10)
const groundMaterial = new MeshStandardMaterial({
  color: 0x808080,
  transparent: true,
  opacity: 0
})
const ground = new Mesh(groundGeometry, groundMaterial)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
this.scene.add(ground)
```

## Conclusion

The Asset Forge sprite generation system provides a powerful and flexible way to create 2D sprites from 3D models. By leveraging Three.js rendering with orthographic cameras, optimized lighting, and multi-angle capture, the system can generate production-quality sprites for any game genre.

Key takeaways:

1. **Orthographic projection** eliminates perspective distortion
2. **Multi-angle rendering** provides complete coverage
3. **Proper lighting** ensures even illumination
4. **Transparent backgrounds** enable compositing
5. **Flexible resolutions** support various use cases
6. **Batch processing** optimizes performance

This sprite generation pipeline integrates seamlessly with the rest of the Asset Forge ecosystem to provide a complete asset production solution.
