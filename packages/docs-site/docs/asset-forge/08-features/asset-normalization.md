# Asset Normalization Deep Dive

## Overview

Asset normalization is the critical process of standardizing 3D models to meet specific positioning, scaling, and orientation conventions. This ensures that all assets in the Asset Forge ecosystem work seamlessly together, regardless of their origin or how they were originally modeled.

The `AssetNormalizationService` handles this transformation, applying different conventions based on asset type (characters, weapons, armor, buildings) and baking all transformations directly into the geometry for optimal compatibility.

## Table of Contents

- [Normalization Conventions](#normalization-conventions)
- [Service Architecture](#service-architecture)
- [Character Normalization](#character-normalization)
- [Weapon Normalization](#weapon-normalization)
- [Armor Normalization](#armor-normalization)
- [Building Normalization](#building-normalization)
- [Transform Baking](#transform-baking)
- [Validation System](#validation-system)
- [Metadata Tracking](#metadata-tracking)

## Normalization Conventions

Asset Forge follows strict conventions that define how each asset type should be positioned, oriented, and scaled. These conventions ensure predictable behavior when assets are loaded into the game engine.

### General Conventions

All normalized assets share these common properties:

- **Origin Point**: Carefully defined based on asset type
- **Orientation**: Standardized facing direction (+Z forward, +Y up)
- **Scale**: Baked into geometry (no scene-level scaling)
- **Transform Matrix**: Identity matrix at the root node
- **Bounding Box**: Computed and tracked in metadata

### Character Convention

Characters follow humanoid-specific conventions:

```text
Position:
  - Feet at Y=0 (ground level)
  - Centered on X=0, Z=0

Orientation:
  - Facing +Z direction (forward)
  - +Y is up (head direction)
  - +X is right

Scale:
  - Target height: 1.83m (customizable)
  - Proportional scaling applied
  - Range: 0.3m to 10m (validation)
```

### Weapon Convention

Weapons use grip-point positioning:

```text
Position:
  - Grip point at origin (0,0,0)
  - Blade/tip extends in +Y direction
  - Centered on X=0, Z=0

Orientation:
  - Blade points up (+Y)
  - Facing +Z when held
  - Handle aligned with Y-axis

Grip Detection:
  - Default: 20% from bottom of bounding box
  - Can be manually specified
  - Typical range: 10-30% from base
```

### Armor Convention

Armor pieces use attachment-point positioning:

```text
Position:
  - Attachment point at origin
  - Helmet: Bottom center (neck attachment)
  - Other: Geometric center

Orientation:
  - Front faces +Z
  - Up is +Y
  - Symmetric about YZ plane

Special Cases:
  - Helmets: Base at Y=0
  - Chest: Centered at origin
  - Gloves/Boots: Wrist/ankle at origin
```

### Building Convention

Buildings use ground-level positioning:

```text
Position:
  - Ground at Y=0
  - Centered on X=0, Z=0
  - Entrance faces +Z

Orientation:
  - Front entrance faces +Z
  - Up is +Y
  - Symmetric or centered layout

Constraints:
  - Ground must be flat at Y=0
  - No negative Y vertices
  - Centered footprint
```

## Service Architecture

The `AssetNormalizationService` is structured to handle multiple asset types through a unified interface while applying type-specific transformations.

### Class Structure

```typescript
export class AssetNormalizationService {
  private loader: GLTFLoader
  private exporter: GLTFExporter

  constructor() {
    this.loader = new GLTFLoader()
    this.exporter = new GLTFExporter()
  }

  // Main entry point
  async normalizeAsset(
    modelPath: string,
    assetType: string,
    subtype?: string,
    options?: NormalizationOptions
  ): Promise<NormalizedAssetResult>

  // Type-specific methods
  async normalizeCharacter(modelPath: string, targetHeight?: number)
  async normalizeWeapon(modelPath: string, weaponType?: string, gripPoint?: Vector3)
  async normalizeArmor(modelPath: string, armorType?: string)
  async normalizeBuilding(modelPath: string)

  // Validation
  async validateNormalization(modelPath: string, assetType: string)

  // Internal utilities
  private bakeTransforms(model: Object3D): void
  private loadModel(modelPath: string): Promise<GLTF>
  private exportModel(scene: Object3D): Promise<ArrayBuffer>
}
```

### Result Interface

```typescript
export interface NormalizedAssetResult {
  glb: ArrayBuffer                 // Exported binary GLB data
  metadata: {
    originalBounds: Box3           // Pre-normalization bounds
    normalizedBounds: Box3         // Post-normalization bounds
    transformsApplied: {
      translation: Vector3         // Applied translation
      rotation: Euler              // Applied rotation
      scale: number                // Applied uniform scale
    }
    dimensions: {
      width: number                // Final width (X)
      height: number               // Final height (Y)
      depth: number                // Final depth (Z)
    }
  }
}
```

## Character Normalization

Character normalization scales the model to a target height and positions the feet at the origin.

### Algorithm

```typescript
async normalizeCharacter(
  modelPath: string,
  targetHeight: number = 1.83
): Promise<NormalizedAssetResult> {
  // 1. Load model
  const gltf = await this.loadModel(modelPath)
  const model = gltf.scene

  // 2. Measure original bounds
  const originalBounds = new Box3().setFromObject(model)
  const originalSize = originalBounds.getSize(new Vector3())
  const originalHeight = originalSize.y

  // 3. Calculate scale factor
  const scaleFactor = targetHeight / originalHeight
  model.scale.multiplyScalar(scaleFactor)
  model.updateMatrixWorld(true)

  // 4. Position feet at origin
  const scaledBounds = new Box3().setFromObject(model)
  model.position.y = -scaledBounds.min.y
  model.updateMatrixWorld(true)

  // 5. Bake transforms into geometry
  this.bakeTransforms(model)

  // 6. Export
  const glb = await this.exportModel(model)
  return { glb, metadata: {...} }
}
```

### Step-by-Step Process

**Step 1: Load and Measure**
```
Original Model:
  Height: 2.15m (in source units)
  Min Y: -0.05m (feet slightly below origin)
  Max Y: 2.10m

Bounding Box:
  min: (-0.3, -0.05, -0.2)
  max: (0.3, 2.10, 0.2)
```

**Step 2: Scale Calculation**
```
Target Height: 1.83m
Original Height: 2.15m
Scale Factor: 1.83 / 2.15 = 0.851

Applied: model.scale.multiplyScalar(0.851)
```

**Step 3: After Scaling**
```
New Bounds:
  min: (-0.255, -0.043, -0.170)
  max: (0.255, 1.787, 0.170)
  height: 1.83m ✓
```

**Step 4: Feet Positioning**
```
Current min.y: -0.043
Translation needed: +0.043 in Y

Applied: model.position.y = 0.043
```

**Step 5: Final Position**
```
Normalized Bounds:
  min: (-0.255, 0.000, -0.170)
  max: (0.255, 1.830, 0.170)

Feet at origin: ✓
Height correct: ✓
```

### Validation Checks

Character normalization validates:

```typescript
// Height within reasonable range
scaleCorrect = size.y >= 0.3 && size.y <= 10

// Feet at origin (within 1cm tolerance)
originCorrect = Math.abs(bounds.min.y) < 0.01

// No transforms on root node
noTransforms = model.position.length() < 0.01 &&
                model.rotation.x === 0 &&
                model.scale.x === 1
```

## Weapon Normalization

Weapon normalization positions the grip point at the origin with the blade extending upward.

### Grip Point Detection

The service automatically estimates the grip point if not provided:

```typescript
// Automatic grip detection
const center = originalBounds.getCenter(new Vector3())
const gripPoint = new Vector3(
  center.x,
  originalBounds.min.y + originalSize.y * 0.2,  // 20% from bottom
  center.z
)
```

This works for most weapon types:

- **Swords**: Grip typically 15-25% from bottom
- **Axes**: Grip typically 20-30% from bottom
- **Spears**: Grip typically 30-50% from bottom
- **Daggers**: Grip typically 25-35% from bottom

### Algorithm

```typescript
async normalizeWeapon(
  modelPath: string,
  weaponType: string = 'sword',
  gripPoint?: Vector3
): Promise<NormalizedAssetResult> {
  // 1. Load model
  const gltf = await this.loadModel(modelPath)
  const model = gltf.scene

  // 2. Get original bounds
  const originalBounds = new Box3().setFromObject(model)
  const originalSize = originalBounds.getSize(new Vector3())

  // 3. Estimate or use provided grip point
  if (!gripPoint) {
    const center = originalBounds.getCenter(new Vector3())
    gripPoint = new Vector3(
      center.x,
      originalBounds.min.y + originalSize.y * 0.2,
      center.z
    )
  }

  // 4. Move grip to origin
  model.position.sub(gripPoint)
  model.updateMatrixWorld(true)

  // 5. Bake and export
  this.bakeTransforms(model)
  const glb = await this.exportModel(model)

  return { glb, metadata: {...} }
}
```

### Before and After Example

### Before Normalization
```text
Sword Model:
  Bounds: min(-0.05, 0.0, -0.02), max(0.05, 1.2, 0.02)
  Grip: Not at origin
  Orientation: Varies

Visual: Blade may be horizontal or diagonal
```

### After Normalization
```text
Normalized Sword:
  Bounds: min(-0.05, -0.24, -0.02), max(0.05, 0.96, 0.02)
  Grip: (0, 0, 0) - at origin
  Blade: Points up (+Y direction)
  Length: 1.2m total

Visual: Grip at origin, blade vertical
```

### Validation

Weapon validation checks:

```typescript
// Grip near origin (within 10cm tolerance)
const expectedGripY = bounds.min.y + size.y * 0.2
originCorrect = Math.abs(expectedGripY) < 0.1

// Reasonable weapon size
const maxDim = Math.max(size.x, size.y, size.z)
scaleCorrect = maxDim >= 0.1 && maxDim <= 5  // 10cm to 5m
```

## Armor Normalization

Armor normalization centers pieces appropriately based on their attachment requirements.

### Armor Types

Different armor pieces use different attachment strategies:

**Helmet:**
```typescript
// Helmets attach at the neck (bottom center)
model.position.x = -center.x
model.position.y = -originalBounds.min.y  // Bottom at Y=0
model.position.z = -center.z
```

**Chest/Body Armor:**
```typescript
// Centered completely
model.position.sub(center)
```

**Gloves/Boots:**
```typescript
// Attachment point (wrist/ankle) at origin
model.position.x = -center.x
model.position.y = -attachmentPoint.y
model.position.z = -center.z
```

### Algorithm

```typescript
async normalizeArmor(
  modelPath: string,
  armorType: string = 'chest'
): Promise<NormalizedAssetResult> {
  const gltf = await this.loadModel(modelPath)
  const model = gltf.scene

  const originalBounds = new Box3().setFromObject(model)
  const center = originalBounds.getCenter(new Vector3())

  // Type-specific positioning
  if (armorType === 'helmet') {
    model.position.x = -center.x
    model.position.y = -originalBounds.min.y
    model.position.z = -center.z
  } else {
    model.position.sub(center)
  }

  model.updateMatrixWorld(true)
  this.bakeTransforms(model)

  const glb = await this.exportModel(model)
  return { glb, metadata: {...} }
}
```

### Example: Helmet Normalization

**Before:**
```
Helmet:
  Bounds: min(-0.15, 0.2, -0.12), max(0.15, 0.45, 0.12)
  Center: (0, 0.325, 0)
  Height: 0.25m
```

**After:**
```
Normalized Helmet:
  Bounds: min(-0.15, 0.0, -0.12), max(0.15, 0.25, 0.12)
  Attachment: (0, 0, 0) - at neck
  Height: 0.25m

Ready to attach to character neck bone
```

## Building Normalization

Building normalization ensures structures sit on the ground with centered footprints.

### Algorithm

```typescript
async normalizeBuilding(
  modelPath: string
): Promise<NormalizedAssetResult> {
  const gltf = await this.loadModel(modelPath)
  const model = gltf.scene

  const originalBounds = new Box3().setFromObject(model)
  const center = originalBounds.getCenter(new Vector3())

  // Position with ground at Y=0, centered on X/Z
  model.position.x = -center.x
  model.position.y = -originalBounds.min.y
  model.position.z = -center.z
  model.updateMatrixWorld(true)

  this.bakeTransforms(model)
  const glb = await this.exportModel(model)

  return { glb, metadata: {...} }
}
```

### Example: House Normalization

**Before:**
```
House:
  Bounds: min(-5, -0.1, -4), max(5, 3.2, 4)
  Center: (0, 1.55, 0)
  Footprint: 10m x 8m
  Height: 3.3m
```

**After:**
```
Normalized House:
  Bounds: min(-5, 0, -4), max(5, 3.3, 4)
  Ground: Y=0
  Center footprint: X=0, Z=0
  Entrance: Faces +Z

Ready for world placement
```

## Transform Baking

Transform baking is the process of applying all scene-level transformations (position, rotation, scale) directly into the vertex data. This ensures the exported GLB has identity transforms at the root.

### Why Bake Transforms?

**Problems with unbaked transforms:**
- Different engines interpret them differently
- Compound transforms accumulate errors
- Skeleton/skinning conflicts
- Animation compatibility issues

**Benefits of baking:**
- Predictable behavior across engines
- No transform ambiguity
- Skeletal compatibility guaranteed
- Clean export format

### Algorithm

```typescript
private bakeTransforms(model: Object3D): void {
  // Update all world matrices first
  model.updateMatrixWorld(true)

  // Traverse all meshes
  model.traverse((child) => {
    if (child instanceof Mesh && child.geometry) {
      // Clone geometry to avoid modifying shared instances
      child.geometry = child.geometry.clone()

      // Apply world matrix to geometry vertices
      child.geometry.applyMatrix4(child.matrixWorld)

      // Reset transform to identity
      child.position.set(0, 0, 0)
      child.rotation.set(0, 0, 0)
      child.scale.set(1, 1, 1)
      child.updateMatrix()
    }
  })

  // Reset root transform
  model.position.set(0, 0, 0)
  model.rotation.set(0, 0, 0)
  model.scale.set(1, 1, 1)
  model.updateMatrixWorld(true)
}
```

### How It Works

### Step 1: Calculate World Matrix
```text
Model has:
  position: (1, 2, 3)
  rotation: (0, 45°, 0)
  scale: (2, 2, 2)

World Matrix = T * R * S
```

### Step 2: Apply to Vertices
```text
For each vertex V:
  V' = WorldMatrix * V

Original vertex: (0.5, 0, 0)
After transform: (1.414, 2, 3.707)
```

### Step 3: Reset Node Transform
```text
Set:
  position = (0, 0, 0)
  rotation = (0, 0, 0)
  scale = (1, 1, 1)

Result: Identity transform, geometry is in world space
```

### Practical Example

**Before Baking:**
```json
{
  "nodes": [
    {
      "name": "Character",
      "translation": [0, -0.05, 0],
      "rotation": [0, 0, 0, 1],
      "scale": [0.851, 0.851, 0.851],
      "mesh": 0
    }
  ]
}
```

**After Baking:**
```json
{
  "nodes": [
    {
      "name": "Character",
      "mesh": 0
      // No transforms - identity by default
    }
  ]
}
```

## Validation System

The validation system checks if models meet normalization requirements without actually normalizing them.

### Validation Interface

```typescript
async validateNormalization(
  modelPath: string,
  assetType: string,
  subtype?: string
): Promise<NormalizationResult> {
  const convention = getConvention(assetType, subtype)
  const gltf = await this.loadModel(modelPath)
  const model = gltf.scene

  const bounds = new Box3().setFromObject(model)
  const size = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())

  const errors: string[] = []

  // Check origin
  const originCorrect = this.checkOrigin(assetType, bounds, size, errors)

  // Check orientation
  const orientationCorrect = true  // Could add checks

  // Check scale
  const scaleCorrect = this.checkScale(assetType, size, errors)

  // Check transforms
  const hasTransforms = this.checkTransforms(model, errors)

  return {
    success: errors.length === 0,
    normalized: originCorrect && orientationCorrect && scaleCorrect && !hasTransforms,
    conventions: convention,
    validation: {
      originCorrect,
      orientationCorrect,
      scaleCorrect,
      errors
    }
  }
}
```

### Validation Checks

**Origin Check (Character):**
```typescript
// Feet should be at Y=0
originCorrect = Math.abs(bounds.min.y) < 0.01

if (!originCorrect) {
  errors.push(`Feet not at origin. Min Y: ${bounds.min.y.toFixed(3)}`)
}
```

**Scale Check (Character):**
```typescript
// Height between 30cm and 10m
scaleCorrect = size.y >= 0.3 && size.y <= 10

if (!scaleCorrect) {
  errors.push(`Character height out of range: ${size.y.toFixed(3)}m`)
}
```

**Transform Check:**
```typescript
const hasTransforms =
  model.position.length() > 0.01 ||
  model.rotation.x !== 0 || model.rotation.y !== 0 || model.rotation.z !== 0 ||
  model.scale.x !== 1 || model.scale.y !== 1 || model.scale.z !== 1

if (hasTransforms) {
  errors.push('Root node has non-identity transforms')
}
```

## Metadata Tracking

Every normalization operation produces detailed metadata for debugging and verification.

### Metadata Structure

```typescript
metadata: {
  originalBounds: Box3 {
    min: Vector3(-0.3, -0.05, -0.2),
    max: Vector3(0.3, 2.10, 0.2)
  },

  normalizedBounds: Box3 {
    min: Vector3(-0.255, 0.000, -0.170),
    max: Vector3(0.255, 1.830, 0.170)
  },

  transformsApplied: {
    translation: Vector3(0, 0.043, 0),
    rotation: Euler(0, 0, 0),
    scale: 0.851
  },

  dimensions: {
    width: 0.510,   // X extent
    height: 1.830,  // Y extent
    depth: 0.340    // Z extent
  }
}
```

### Using Metadata

**Verify Scale Applied:**
```typescript
const scaleRatio = result.metadata.dimensions.height /
                   result.metadata.transformsApplied.scale
// Should match original height
```

**Check Translation:**
```typescript
const expectedY = -result.metadata.originalBounds.min.y
const actualY = result.metadata.transformsApplied.translation.y
// Should match for character feet positioning
```

**Dimension Tracking:**
```typescript
// Store for later use in game engine
const characterHeight = result.metadata.dimensions.height  // 1.83m
const characterWidth = result.metadata.dimensions.width    // 0.51m
```

## Best Practices

### When to Normalize

**Always normalize:**
- After AI generation (Meshy output)
- Before hand rigging
- Before armor fitting
- Before game engine export

**Don't normalize:**
- Already normalized assets
- Mid-pipeline assets
- Source reference models

### Choosing Target Heights

**Character heights:**
```
Tiny (gnome, child): 0.8m - 1.2m
Small (dwarf, halfling): 1.2m - 1.5m
Medium (human, elf): 1.5m - 2.0m
Large (orc, giant): 2.0m - 3.5m
Huge (monster): 3.5m - 10m
```

### Grip Point Adjustment

For weapons with unusual designs, manually specify the grip:

```typescript
const customGrip = new Vector3(
  0,      // Centered on X
  0.15,   // 15cm from bottom (for an axe)
  0       // Centered on Z
)

await service.normalizeWeapon(modelPath, 'axe', customGrip)
```

## Common Issues and Solutions

### Issue: Character floating above ground

**Symptom:** Model appears above Y=0 after normalization

**Cause:** Feet geometry includes decorative elements below actual feet

**Solution:**
```typescript
// Manually adjust if automatic detection fails
const adjustedBounds = originalBounds.clone()
adjustedBounds.min.y += 0.02  // Ignore bottom 2cm
model.position.y = -adjustedBounds.min.y
```

### Issue: Weapon blade points wrong direction

**Symptom:** Blade horizontal or pointing down

**Cause:** Original model exported with non-standard orientation

**Solution:**
```typescript
// Apply rotation before normalization
model.rotation.z = Math.PI / 2  // Rotate 90° if horizontal
model.updateMatrixWorld(true)
// Then normalize
```

### Issue: Transforms not fully baked

**Symptom:** Exported model has non-identity transforms

**Cause:** Nested nodes with transforms

**Solution:**
```typescript
// Ensure traversal covers all nodes
model.traverse((child) => {
  if (child.type === 'Mesh' || child.type === 'SkinnedMesh') {
    // Bake transforms
  }
})
```

## Performance Considerations

### Model Loading

- **Cached loader**: Reuse GLTFLoader instance
- **Parallel loading**: Load multiple models concurrently
- **Memory cleanup**: Dispose of loaded models after export

### Transform Baking

- **Geometry cloning**: Required to avoid modifying shared geometry
- **Matrix operations**: Relatively fast (O(n) vertices)
- **Update frequency**: Only updateMatrixWorld when needed

### Export Optimization

```typescript
// Export with minimal data
this.exporter.parse(
  scene,
  (result) => resolve(result as ArrayBuffer),
  (error) => reject(error),
  {
    binary: true,           // GLB format (more compact)
    embedImages: true,      // Include textures
    includeCustomExtensions: false
  }
)
```

## Conclusion

Asset normalization is the foundation of a consistent asset pipeline. By standardizing positions, orientations, and scales, and baking all transforms into geometry, we ensure that assets from any source work reliably in the game engine.

The `AssetNormalizationService` handles this complexity automatically while providing validation and metadata tracking for debugging and verification. Understanding these conventions is essential for anyone working with 3D assets in the Asset Forge ecosystem.
