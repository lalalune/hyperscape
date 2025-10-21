# Asset Metadata Types

Asset metadata is the cornerstone of Asset Forge's data architecture. This document covers the complete metadata type system, including base assets, variants, discriminated unions, rigging metadata, animation sets, type guards, validators, and normalization conventions.

## Metadata Architecture Overview

Asset Forge uses a sophisticated metadata system built on discriminated unions:

```
AssetMetadata (discriminated union)
├── BaseAssetMetadata (isBaseModel: true)
│   ├── RiggingMetadata (mixin)
│   ├── Variant tracking
│   └── Generation metadata
└── VariantAssetMetadata (isVariant: true)
    ├── RiggingMetadata (mixin)
    ├── Parent reference
    └── Material metadata
```

This architecture enables:
- Type-safe discrimination between base models and variants
- Shared rigging and animation metadata
- Complete generation provenance tracking
- Efficient retexturing workflows

## BaseAssetMetadata Interface

The `BaseAssetMetadata` interface represents original base models that can be retextured into variants.

### Complete Interface Definition

```typescript
export interface BaseAssetMetadata extends RiggingMetadata {
  // Identity
  id: string
  gameId: string
  name: string
  description: string
  type: AssetType
  subtype: string

  // Base Model Specific
  isBaseModel: true
  isVariant?: false
  meshyTaskId: string  // REQUIRED for retexturing
  generationMethod: 'gpt-image-meshy' | 'direct-meshy' | 'manual' | 'placeholder'

  // Variant Tracking
  variants: string[]  // IDs of all generated variants
  variantCount: number
  lastVariantGenerated?: string

  // Files
  modelPath: string
  conceptArtPath?: string
  hasModel: boolean
  hasConceptArt: boolean

  // Generation Details
  workflow?: string
  gddCompliant: boolean
  isPlaceholder: boolean

  // Normalization
  normalized?: boolean
  normalizationDate?: string
  dimensions?: {
    width: number
    height: number
    depth: number
  }

  // Timestamps
  createdAt: string
  updatedAt: string
  generatedAt?: string
  completedAt?: string

  // Additional properties used in UI
  tier?: string
  format?: string
  gripDetected?: boolean  // For weapons
  requiresAnimationStrip?: boolean
}
```

### Identity Properties

Every asset must have unique identification:

```typescript
const baseAsset: BaseAssetMetadata = {
  id: 'bronze_sword_001',
  gameId: 'SWORD_BRONZE_01',
  name: 'Bronze Sword',
  description: 'A basic bronze sword suitable for beginners',
  type: 'weapon',
  subtype: 'sword',
  // ... other properties
}
```

**Key Fields:**
- `id`: Unique internal identifier (filesystem-safe)
- `gameId`: Game-facing identifier (used in game data)
- `name`: Display name
- `description`: Asset description
- `type`: Primary asset category
- `subtype`: Specific subcategory within type

### Base Model Discriminator

The discriminated union requires specific flags:

```typescript
interface BaseAssetMetadata {
  isBaseModel: true      // Required - marks as base model
  isVariant?: false      // Optional - explicit non-variant marker
  meshyTaskId: string    // Required - enables retexturing
  generationMethod: 'gpt-image-meshy' | 'direct-meshy' | 'manual' | 'placeholder'
}
```

**Generation Methods:**
- `gpt-image-meshy`: Full pipeline (GPT description → DALL-E image → Meshy 3D)
- `direct-meshy`: Direct 3D generation from text (Meshy text-to-3D)
- `manual`: Manually created asset
- `placeholder`: Temporary placeholder asset

**Example:**
```typescript
const generatedBase: BaseAssetMetadata = {
  // ... identity fields
  isBaseModel: true,
  meshyTaskId: '01912345-6789-abcd-ef01-234567890abc',
  generationMethod: 'gpt-image-meshy',
  // ... other fields
}

const manualBase: BaseAssetMetadata = {
  // ... identity fields
  isBaseModel: true,
  meshyTaskId: 'manual_import_001',
  generationMethod: 'manual',
  // ... other fields
}
```

### Variant Tracking

Base assets track all their generated variants:

```typescript
interface BaseAssetMetadata {
  variants: string[]           // IDs of all variant assets
  variantCount: number         // Total number of variants
  lastVariantGenerated?: string // ID of most recent variant
}
```

**Example:**
```typescript
const baseWithVariants: BaseAssetMetadata = {
  // ... base properties
  variants: [
    'bronze_sword_001_iron',
    'bronze_sword_001_steel',
    'bronze_sword_001_mithril'
  ],
  variantCount: 3,
  lastVariantGenerated: 'bronze_sword_001_mithril',
  // ... other fields
}
```

**Variant Management:**
```typescript
function addVariant(base: BaseAssetMetadata, variantId: string): BaseAssetMetadata {
  return {
    ...base,
    variants: [...base.variants, variantId],
    variantCount: base.variantCount + 1,
    lastVariantGenerated: variantId,
    updatedAt: new Date().toISOString()
  }
}
```

### File References

Track model and concept art files:

```typescript
interface BaseAssetMetadata {
  modelPath: string           // Path to GLB file
  conceptArtPath?: string     // Path to concept art image
  hasModel: boolean          // Model file exists
  hasConceptArt: boolean     // Concept art exists
}
```

**Example:**
```typescript
const assetWithFiles: BaseAssetMetadata = {
  // ... other properties
  modelPath: 'gdd-assets/bronze_sword_001/model.glb',
  conceptArtPath: 'gdd-assets/bronze_sword_001/concept.png',
  hasModel: true,
  hasConceptArt: true,
  format: 'glb'
}
```

### Normalization Metadata

Track asset normalization status and dimensions:

```typescript
interface BaseAssetMetadata {
  normalized?: boolean
  normalizationDate?: string
  dimensions?: {
    width: number   // X dimension in meters
    height: number  // Y dimension in meters
    depth: number   // Z dimension in meters
  }
}
```

**Example:**
```typescript
const normalizedAsset: BaseAssetMetadata = {
  // ... other properties
  normalized: true,
  normalizationDate: '2025-10-21T10:30:00Z',
  dimensions: {
    width: 0.1,    // 10cm wide
    height: 1.2,   // 120cm tall
    depth: 0.05    // 5cm thick
  }
}
```

## VariantAssetMetadata Interface

The `VariantAssetMetadata` interface represents retextured variants of base models.

### Complete Interface Definition

```typescript
export interface VariantAssetMetadata extends RiggingMetadata {
  // Identity
  id: string
  gameId: string
  name: string
  description: string
  type: AssetType
  subtype: string

  // Variant Specific
  isBaseModel: false
  isVariant: true
  parentBaseModel: string  // ID of the base model

  // Material Information
  materialPreset: MaterialPresetInfo
  baseMaterial?: string  // Optional for backwards compatibility

  // Generation Info
  retextureTaskId: string
  retextureMethod: 'meshy-retexture' | 'manual-texture' | 'ai-generated'
  retextureStatus: 'pending' | 'processing' | 'completed' | 'failed'
  retextureError?: string

  // Base Model Reference
  baseModelTaskId: string  // Meshy task ID of the parent

  // Files
  modelPath: string
  conceptArtPath?: string
  hasModel: boolean
  hasConceptArt: boolean

  // Generation Details
  workflow: string
  gddCompliant: boolean
  isPlaceholder: boolean

  // Normalization
  normalized?: boolean
  normalizationDate?: string
  dimensions?: {
    width: number
    height: number
    depth: number
  }

  // Timestamps
  generatedAt: string
  completedAt?: string
  createdAt?: string
  updatedAt?: string

  // Additional properties used in UI
  tier?: string
  format?: string
  gripDetected?: boolean
  requiresAnimationStrip?: boolean
}
```

### Variant Discriminator

Variant assets have opposite discriminator flags:

```typescript
interface VariantAssetMetadata {
  isBaseModel: false         // Not a base model
  isVariant: true           // Explicitly a variant
  parentBaseModel: string   // Required parent reference
  baseModelTaskId: string   // Parent's Meshy task ID
}
```

**Example:**
```typescript
const variantAsset: VariantAssetMetadata = {
  // ... identity
  id: 'bronze_sword_001_iron',
  name: 'Iron Sword',
  isBaseModel: false,
  isVariant: true,
  parentBaseModel: 'bronze_sword_001',
  baseModelTaskId: '01912345-6789-abcd-ef01-234567890abc',
  // ... other properties
}
```

### Material Information

Variants track their material preset:

```typescript
export interface MaterialPresetInfo {
  id: string
  displayName: string
  category: string
  tier: number
  color: string
  stylePrompt?: string
}

interface VariantAssetMetadata {
  materialPreset: MaterialPresetInfo
  baseMaterial?: string  // Legacy field
}
```

**Example:**
```typescript
const ironVariant: VariantAssetMetadata = {
  // ... other properties
  materialPreset: {
    id: 'iron',
    displayName: 'Iron',
    category: 'metal',
    tier: 1,
    color: '#808080',
    stylePrompt: 'dark gray iron metal, slightly rough surface'
  }
}

const steelVariant: VariantAssetMetadata = {
  // ... other properties
  materialPreset: {
    id: 'steel',
    displayName: 'Steel',
    category: 'metal',
    tier: 2,
    color: '#C0C0C0',
    stylePrompt: 'bright silver steel metal, polished and reflective'
  }
}
```

### Retexturing Metadata

Track the retexturing process:

```typescript
interface VariantAssetMetadata {
  retextureTaskId: string
  retextureMethod: 'meshy-retexture' | 'manual-texture' | 'ai-generated'
  retextureStatus: 'pending' | 'processing' | 'completed' | 'failed'
  retextureError?: string
}
```

**Example - Successful Retexture:**
```typescript
const completedVariant: VariantAssetMetadata = {
  // ... other properties
  retextureTaskId: '01923456-789a-bcde-f012-3456789abcde',
  retextureMethod: 'meshy-retexture',
  retextureStatus: 'completed',
  generatedAt: '2025-10-21T11:45:00Z',
  completedAt: '2025-10-21T11:47:30Z'
}
```

**Example - Failed Retexture:**
```typescript
const failedVariant: VariantAssetMetadata = {
  // ... other properties
  retextureTaskId: '01923456-789a-bcde-f012-3456789abcde',
  retextureMethod: 'meshy-retexture',
  retextureStatus: 'failed',
  retextureError: 'Meshy API timeout after 300 seconds',
  generatedAt: '2025-10-21T12:00:00Z'
}
```

## Discriminated Unions

The `AssetMetadata` type is a discriminated union:

```typescript
export type AssetMetadata = BaseAssetMetadata | VariantAssetMetadata
```

### Discriminator Properties

TypeScript uses these properties to discriminate:

| Property | BaseAssetMetadata | VariantAssetMetadata |
|----------|------------------|---------------------|
| isBaseModel | `true` | `false` |
| isVariant | `false` (optional) | `true` |
| meshyTaskId | Required | Not present |
| parentBaseModel | Not present | Required |
| variants | Required array | Not present |
| materialPreset | Not present | Required |

### Type Narrowing

TypeScript automatically narrows types based on discriminators:

```typescript
function processAsset(metadata: AssetMetadata): void {
  if (metadata.isBaseModel) {
    // TypeScript knows metadata is BaseAssetMetadata
    console.log(`Base model with ${metadata.variants.length} variants`)
    console.log(`Meshy task: ${metadata.meshyTaskId}`)
    console.log(`Can retexture: ${!!metadata.meshyTaskId}`)
  } else {
    // TypeScript knows metadata is VariantAssetMetadata
    console.log(`Variant of ${metadata.parentBaseModel}`)
    console.log(`Material: ${metadata.materialPreset.displayName}`)
    console.log(`Status: ${metadata.retextureStatus}`)
  }
}
```

## RiggingMetadata Interface

Both base and variant assets extend `RiggingMetadata`:

```typescript
export interface RiggingMetadata {
  // Rigging status
  isRigged?: boolean
  riggingTaskId?: string
  riggingStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  riggingError?: string
  riggingAttempted?: boolean

  // Rig information
  rigType?: 'humanoid-standard' | 'creature' | 'custom'
  characterHeight?: number
  supportsAnimation?: boolean
  animationCompatibility?: string[]

  // Animation files
  animations?: {
    basic?: AnimationSet
    advanced?: AnimationSet
  }

  // Model paths
  riggedModelPath?: string
  tposeModelPath?: string
}
```

### Rigging Status Tracking

Track the rigging process:

```typescript
const riggedCharacter: BaseAssetMetadata = {
  // ... base properties
  isRigged: true,
  riggingTaskId: 'rig_01934567-89ab-cdef-0123-456789abcdef',
  riggingStatus: 'completed',
  rigType: 'humanoid-standard',
  characterHeight: 1.83,
  supportsAnimation: true,
  animationCompatibility: ['walk', 'run', 'idle', 'attack'],
  riggedModelPath: 'gdd-assets/knight_001/rigged_model.glb',
  tposeModelPath: 'gdd-assets/knight_001/tpose_model.glb'
}
```

**Failed Rigging Example:**
```typescript
const failedRigging: BaseAssetMetadata = {
  // ... base properties
  isRigged: false,
  riggingAttempted: true,
  riggingTaskId: 'rig_01934567-89ab-cdef-0123-456789abcdef',
  riggingStatus: 'failed',
  riggingError: 'Unable to detect humanoid skeleton structure'
}
```

### Rig Type Categories

```typescript
type RigType = 'humanoid-standard' | 'creature' | 'custom'
```

**humanoid-standard:**
- Standard humanoid skeleton (head, torso, arms, legs)
- Compatible with standard animations
- Height normalization to 1.83m

**creature:**
- Non-humanoid skeleton (quadruped, flying, etc.)
- Custom animation set required
- Specialized bone hierarchy

**custom:**
- Completely custom rig
- Unique animation requirements
- Specialized handling needed

## AnimationSet Structure

The `AnimationSet` interface defines available animations:

```typescript
export interface AnimationSet {
  walking?: string
  running?: string
  tpose?: string
  [key: string]: string | undefined  // Allow for additional animations
}
```

### Animation Organization

Animations are organized into tiers:

```typescript
interface RiggingMetadata {
  animations?: {
    basic?: AnimationSet      // Essential animations
    advanced?: AnimationSet   // Advanced animations
  }
}
```

**Example - Complete Animation Set:**
```typescript
const fullyAnimatedCharacter: BaseAssetMetadata = {
  // ... base properties
  isRigged: true,
  animations: {
    basic: {
      walking: 'gdd-assets/knight_001/animations/walk.glb',
      running: 'gdd-assets/knight_001/animations/run.glb',
      tpose: 'gdd-assets/knight_001/animations/tpose.glb',
      idle: 'gdd-assets/knight_001/animations/idle.glb'
    },
    advanced: {
      attack1: 'gdd-assets/knight_001/animations/attack1.glb',
      attack2: 'gdd-assets/knight_001/animations/attack2.glb',
      block: 'gdd-assets/knight_001/animations/block.glb',
      dodge: 'gdd-assets/knight_001/animations/dodge.glb',
      death: 'gdd-assets/knight_001/animations/death.glb'
    }
  }
}
```

### Animation File Paths

Animation files are stored as paths to GLB files containing specific animations:

```typescript
// Extract animation from GLB
async function loadAnimation(animationPath: string): Promise<THREE.AnimationClip> {
  const gltf = await loader.loadAsync(animationPath)
  return gltf.animations[0]
}

// Use animations
if (asset.animations?.basic?.walking) {
  const walkAnim = await loadAnimation(asset.animations.basic.walking)
  mixer.clipAction(walkAnim).play()
}
```

## Type Guards

Type guards enable runtime type checking and discrimination:

### isBaseAsset

Check if metadata represents a base asset:

```typescript
export function isBaseAsset(metadata: AssetMetadata): metadata is BaseAssetMetadata {
  return metadata.isBaseModel === true
}
```

**Usage:**
```typescript
function processAsset(metadata: AssetMetadata): void {
  if (isBaseAsset(metadata)) {
    // TypeScript knows metadata is BaseAssetMetadata
    console.log(`Processing base asset: ${metadata.name}`)
    console.log(`Variants: ${metadata.variantCount}`)

    // Can safely access base-only properties
    const taskId: string = metadata.meshyTaskId
    const variants: string[] = metadata.variants
  }
}
```

### isVariantAsset

Check if metadata represents a variant:

```typescript
export function isVariantAsset(metadata: AssetMetadata): metadata is VariantAssetMetadata {
  return metadata.isVariant === true
}
```

**Usage:**
```typescript
function processAsset(metadata: AssetMetadata): void {
  if (isVariantAsset(metadata)) {
    // TypeScript knows metadata is VariantAssetMetadata
    console.log(`Processing variant: ${metadata.name}`)
    console.log(`Parent: ${metadata.parentBaseModel}`)
    console.log(`Material: ${metadata.materialPreset.displayName}`)

    // Can safely access variant-only properties
    const parent: string = metadata.parentBaseModel
    const material: MaterialPresetInfo = metadata.materialPreset
  }
}
```

### hasAnimations

Check if asset has animation metadata:

```typescript
export type AssetWithAnimations = {
  id: string
  name: string
  description: string
  type: string
  metadata: ExtendedAssetMetadata
  hasModel: boolean
  modelFile?: string
  generatedAt: string
}

export function hasAnimations(asset: {
  metadata: AssetMetadata | ExtendedAssetMetadata
}): asset is AssetWithAnimations {
  return 'animations' in asset.metadata
}
```

**Usage:**
```typescript
function loadAssetAnimations(asset: { metadata: AssetMetadata }): void {
  if (hasAnimations(asset)) {
    // TypeScript knows asset has animations
    const basic = asset.metadata.animations?.basic
    const advanced = asset.metadata.animations?.advanced

    if (basic?.walking) {
      loadAnimation(basic.walking)
    }
  }
}
```

## Validators

Validators provide runtime validation for external data:

### validateBaseAsset

Validate unknown data as BaseAssetMetadata:

```typescript
export function validateBaseAsset(metadata: unknown): metadata is BaseAssetMetadata {
  return (
    metadata !== null &&
    typeof metadata === 'object' &&
    'isBaseModel' in metadata &&
    metadata.isBaseModel === true &&
    'meshyTaskId' in metadata &&
    typeof metadata.meshyTaskId === 'string' &&
    metadata.meshyTaskId.length > 0 &&
    'variants' in metadata &&
    Array.isArray(metadata.variants)
  )
}
```

**Usage:**
```typescript
async function loadBaseAsset(filePath: string): Promise<BaseAssetMetadata | null> {
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(data)

    if (validateBaseAsset(parsed)) {
      // Safe to use as BaseAssetMetadata
      return parsed
    } else {
      console.error('Invalid base asset metadata')
      return null
    }
  } catch (error) {
    console.error('Failed to load base asset:', error)
    return null
  }
}
```

### canRetexture

Check if an asset can be retextured:

```typescript
export function canRetexture(metadata: AssetMetadata): boolean {
  return isBaseAsset(metadata) && !!metadata.meshyTaskId && !metadata.isPlaceholder
}
```

**Usage:**
```typescript
function showRetextureButton(metadata: AssetMetadata): boolean {
  return canRetexture(metadata)
}

async function retextureAsset(
  metadata: AssetMetadata,
  material: MaterialPreset
): Promise<VariantAssetMetadata | null> {
  if (!canRetexture(metadata)) {
    console.error('Asset cannot be retextured')
    return null
  }

  // metadata is guaranteed to be BaseAssetMetadata with meshyTaskId
  const variant = await meshyService.retexture(
    metadata.meshyTaskId,
    material.stylePrompt
  )

  return variant
}
```

## NormalizationConventions

Asset normalization ensures consistent scale, orientation, and origin across all assets.

### AssetConvention Interface

```typescript
export interface AssetConvention {
  scale: string
  origin: string
  orientation: string
  primaryAxis?: string
  additionalRules?: string[]
}
```

### Convention Definitions

Conventions are defined for each asset type and subtype:

```typescript
export const ASSET_CONVENTIONS: Record<string, AssetConvention> = {
  // Characters
  character: {
    scale: "1 unit = 1 meter (exact height baked)",
    origin: "Feet at (0,0,0)",
    orientation: "Facing +Z, T-pose with arms along X axis",
    primaryAxis: "Height along Y axis",
    additionalRules: [
      "No transform nodes above mesh",
      "Skeleton root at character root",
      "All bones in bind pose"
    ]
  },

  // Weapons
  weapon: {
    scale: "Real-world size (1 unit = 1 meter)",
    origin: "Primary grip point at (0,0,0)",
    orientation: "Blade/tip pointing +Y (up)",
    primaryAxis: "Length along Y axis",
    additionalRules: [
      "Handle at bottom (-Y)",
      "Blade/head at top (+Y)",
      "Flat side facing +Z"
    ]
  },

  // Specific weapon types
  sword: {
    scale: "Real-world size (~1.2m total length)",
    origin: "Grip center at (0,0,0)",
    orientation: "Blade pointing +Y, edge facing ±X",
    primaryAxis: "Blade along Y axis"
  },

  axe: {
    scale: "Real-world size (~0.8m total length)",
    origin: "Grip point at (0,0,0)",
    orientation: "Axe head pointing +Y, blade facing +Z",
    primaryAxis: "Handle along Y axis"
  },

  // Armor
  armor: {
    scale: "Sized for 1.83m humanoid",
    origin: "Attachment point at (0,0,0)",
    orientation: "Worn orientation, facing +Z",
    additionalRules: [
      "No deformation in rest pose",
      "Symmetrical on X axis"
    ]
  },

  // Buildings
  building: {
    scale: "1 unit = 1 meter",
    origin: "Center of ground floor at (0,0,0)",
    orientation: "Main entrance facing +Z",
    primaryAxis: "Height along Y axis",
    additionalRules: [
      "Ground plane at Y=0",
      "Doors separate objects",
      "Interior accessible"
    ]
  }
}
```

### getConvention Helper

Retrieve convention for any asset type:

```typescript
export function getConvention(assetType: string, subtype?: string): AssetConvention {
  // Try specific subtype first
  if (subtype && ASSET_CONVENTIONS[subtype]) {
    return ASSET_CONVENTIONS[subtype]
  }

  // Fall back to general type
  if (ASSET_CONVENTIONS[assetType]) {
    return ASSET_CONVENTIONS[assetType]
  }

  // Default convention
  return {
    scale: "1 unit = 1 meter",
    origin: "Center at (0,0,0)",
    orientation: "Natural orientation"
  }
}
```

**Usage:**
```typescript
function normalizeAsset(metadata: AssetMetadata, model: THREE.Object3D): void {
  const convention = getConvention(metadata.type, metadata.subtype)

  console.log(`Normalizing ${metadata.name}`)
  console.log(`Scale: ${convention.scale}`)
  console.log(`Origin: ${convention.origin}`)
  console.log(`Orientation: ${convention.orientation}`)

  if (convention.additionalRules) {
    console.log('Additional rules:')
    convention.additionalRules.forEach(rule => console.log(`  - ${rule}`))
  }

  // Apply normalization transformations
  applyNormalization(model, convention)
}
```

### NormalizationResult Interface

Track normalization results:

```typescript
export interface NormalizationResult {
  success: boolean
  normalized: boolean
  conventions: AssetConvention
  transformsApplied: {
    translation?: { x: number; y: number; z: number }
    rotation?: { x: number; y: number; z: number }
    scale?: number
  }
  validation: {
    originCorrect: boolean
    orientationCorrect: boolean
    scaleCorrect: boolean
    errors: string[]
  }
}
```

**Example:**
```typescript
const normalizationResult: NormalizationResult = {
  success: true,
  normalized: true,
  conventions: ASSET_CONVENTIONS.sword,
  transformsApplied: {
    translation: { x: 0, y: -0.6, z: 0 },
    rotation: { x: 0, y: 0, z: 90 },
    scale: 0.8
  },
  validation: {
    originCorrect: true,
    orientationCorrect: true,
    scaleCorrect: true,
    errors: []
  }
}
```

## Asset Conventions by Type

### Character Conventions

```typescript
{
  scale: "1 unit = 1 meter (exact height baked)",
  origin: "Feet at (0,0,0)",
  orientation: "Facing +Z, T-pose with arms along X axis",
  primaryAxis: "Height along Y axis"
}
```

**Requirements:**
- Character height is baked (e.g., 1.83m character has Y extent of 1.83 units)
- Feet touch ground plane at Y=0
- Character faces positive Z direction
- T-pose with arms extended along X axis
- No transform nodes above mesh (transforms baked into vertices)

### Weapon Conventions

All weapons share common conventions:

```typescript
{
  scale: "Real-world size (1 unit = 1 meter)",
  origin: "Primary grip point at (0,0,0)",
  orientation: "Blade/tip pointing +Y (up)",
  primaryAxis: "Length along Y axis"
}
```

**Specific Weapon Examples:**

**Sword:**
- Length: ~1.0-1.2m
- Grip at origin
- Blade points up (+Y)
- Edge faces ±X
- Flat side faces +Z

**Axe:**
- Length: ~0.6-0.8m
- Grip at origin
- Head points up (+Y)
- Blade faces +Z

**Bow:**
- Height: ~1.4-1.6m
- Grip at origin
- String plane on X axis
- Tips point ±Y

### Armor Conventions

```typescript
{
  scale: "Sized for 1.83m humanoid",
  origin: "Attachment point at (0,0,0)",
  orientation: "Worn orientation, facing +Z"
}
```

**Slot-Specific:**

**Helmet:**
- Origin at neck attachment
- Top points +Y
- Face points +Z

**Chest:**
- Origin at spine attachment
- Front faces +Z
- Sized for torso

**Legs:**
- Origin at waist attachment
- Legs extend -Y

### Building Conventions

```typescript
{
  scale: "1 unit = 1 meter",
  origin: "Center of ground floor at (0,0,0)",
  orientation: "Main entrance facing +Z",
  primaryAxis: "Height along Y axis"
}
```

**Requirements:**
- Ground floor centered at origin
- Main entrance faces +Z
- Floors aligned to Y=0, Y=3, Y=6, etc.
- Doors are separate objects for interaction

## Complete Examples

### Complete Base Asset

```typescript
const completeBaseAsset: BaseAssetMetadata = {
  // Identity
  id: 'iron_sword_001',
  gameId: 'SWORD_IRON_01',
  name: 'Iron Sword',
  description: 'A sturdy iron sword with leather-wrapped grip',
  type: 'weapon',
  subtype: 'sword',

  // Base Model Flags
  isBaseModel: true,
  meshyTaskId: '01912345-6789-abcd-ef01-234567890abc',
  generationMethod: 'gpt-image-meshy',

  // Variant Tracking
  variants: ['iron_sword_001_steel', 'iron_sword_001_bronze'],
  variantCount: 2,
  lastVariantGenerated: 'iron_sword_001_bronze',

  // Files
  modelPath: 'gdd-assets/iron_sword_001/model.glb',
  conceptArtPath: 'gdd-assets/iron_sword_001/concept.png',
  hasModel: true,
  hasConceptArt: true,

  // Generation
  workflow: 'standard-weapon-pipeline',
  gddCompliant: true,
  isPlaceholder: false,

  // Normalization
  normalized: true,
  normalizationDate: '2025-10-21T10:00:00Z',
  dimensions: {
    width: 0.1,
    height: 1.2,
    depth: 0.05
  },

  // Timestamps
  createdAt: '2025-10-21T09:00:00Z',
  updatedAt: '2025-10-21T10:30:00Z',
  generatedAt: '2025-10-21T09:15:00Z',
  completedAt: '2025-10-21T10:00:00Z',

  // UI Properties
  tier: '1',
  format: 'glb',
  gripDetected: true
}
```

### Complete Variant Asset

```typescript
const completeVariant: VariantAssetMetadata = {
  // Identity
  id: 'iron_sword_001_steel',
  gameId: 'SWORD_STEEL_01',
  name: 'Steel Sword',
  description: 'An upgraded steel version of the iron sword',
  type: 'weapon',
  subtype: 'sword',

  // Variant Flags
  isBaseModel: false,
  isVariant: true,
  parentBaseModel: 'iron_sword_001',

  // Material
  materialPreset: {
    id: 'steel',
    displayName: 'Steel',
    category: 'metal',
    tier: 2,
    color: '#C0C0C0',
    stylePrompt: 'polished steel metal, bright silver, reflective surface'
  },

  // Retexture Info
  retextureTaskId: '01923456-789a-bcde-f012-3456789abcde',
  retextureMethod: 'meshy-retexture',
  retextureStatus: 'completed',
  baseModelTaskId: '01912345-6789-abcd-ef01-234567890abc',

  // Files
  modelPath: 'gdd-assets/iron_sword_001_steel/model.glb',
  hasModel: true,
  hasConceptArt: false,

  // Generation
  workflow: 'retexture-pipeline',
  gddCompliant: true,
  isPlaceholder: false,

  // Normalization (inherited from base)
  normalized: true,
  normalizationDate: '2025-10-21T11:00:00Z',
  dimensions: {
    width: 0.1,
    height: 1.2,
    depth: 0.05
  },

  // Timestamps
  generatedAt: '2025-10-21T10:45:00Z',
  completedAt: '2025-10-21T11:00:00Z',
  createdAt: '2025-10-21T10:45:00Z',
  updatedAt: '2025-10-21T11:00:00Z',

  // UI Properties
  tier: '2',
  format: 'glb',
  gripDetected: true
}
```

### Complete Rigged Character

```typescript
const riggedCharacter: BaseAssetMetadata = {
  // Identity
  id: 'knight_001',
  gameId: 'CHAR_KNIGHT_01',
  name: 'Knight',
  description: 'A fully armored knight character',
  type: 'character',
  subtype: 'humanoid',

  // Base Model
  isBaseModel: true,
  meshyTaskId: '01934567-89ab-cdef-0123-456789abcdef',
  generationMethod: 'gpt-image-meshy',

  // Rigging
  isRigged: true,
  riggingTaskId: 'rig_01945678-9abc-def0-1234-56789abcdef0',
  riggingStatus: 'completed',
  rigType: 'humanoid-standard',
  characterHeight: 1.83,
  supportsAnimation: true,
  animationCompatibility: ['walk', 'run', 'idle', 'attack', 'block'],

  // Animations
  animations: {
    basic: {
      walking: 'gdd-assets/knight_001/animations/walk.glb',
      running: 'gdd-assets/knight_001/animations/run.glb',
      tpose: 'gdd-assets/knight_001/animations/tpose.glb',
      idle: 'gdd-assets/knight_001/animations/idle.glb'
    },
    advanced: {
      attack1: 'gdd-assets/knight_001/animations/attack1.glb',
      attack2: 'gdd-assets/knight_001/animations/attack2.glb',
      block: 'gdd-assets/knight_001/animations/block.glb'
    }
  },

  // Model Paths
  riggedModelPath: 'gdd-assets/knight_001/rigged_model.glb',
  tposeModelPath: 'gdd-assets/knight_001/tpose_model.glb',

  // Variants
  variants: [],
  variantCount: 0,

  // Files
  modelPath: 'gdd-assets/knight_001/rigged_model.glb',
  conceptArtPath: 'gdd-assets/knight_001/concept.png',
  hasModel: true,
  hasConceptArt: true,

  // Generation
  workflow: 'character-rigging-pipeline',
  gddCompliant: true,
  isPlaceholder: false,

  // Normalization
  normalized: true,
  normalizationDate: '2025-10-21T12:00:00Z',
  dimensions: {
    width: 0.6,
    height: 1.83,
    depth: 0.3
  },

  // Timestamps
  createdAt: '2025-10-21T11:00:00Z',
  updatedAt: '2025-10-21T12:30:00Z',
  generatedAt: '2025-10-21T11:20:00Z',
  completedAt: '2025-10-21T12:30:00Z',

  // UI
  format: 'glb',
  requiresAnimationStrip: false
}
```

## Summary

The Asset Forge asset metadata system provides:

- **Discriminated unions** for type-safe base/variant distinction
- **Complete metadata tracking** for generation, rigging, and normalization
- **Type guards and validators** for runtime type safety
- **Rigging and animation support** integrated into core metadata
- **Material preset system** for efficient retexturing
- **Normalization conventions** for consistent asset standards
- **Variant tracking** for base model relationships
- **Comprehensive timestamps** for full audit trail

This architecture enables efficient asset generation, retexturing workflows, and type-safe metadata management throughout the entire asset lifecycle.
