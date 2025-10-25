# Type System Overview

The Asset Forge type system provides comprehensive TypeScript definitions for all aspects of 3D asset generation, management, and rendering. This document outlines the complete type architecture, covering 12 type definition files that form the foundation of the system's type safety.

## Type System Organization

Asset Forge's type system is organized into 12 specialized type files, each serving a specific domain:

### Core Type Files

1. **index.ts** - Central type hub and re-exports
2. **AssetMetadata.ts** - Asset metadata structures and discriminated unions
3. **RiggingMetadata.ts** - Rigging and animation metadata
4. **generation.ts** - Generation pipeline and configuration types
5. **three.ts** - Three.js geometry, material, and object types
6. **gltf.ts** - GLTF export format definitions
7. **common.ts** - Common utility types, callbacks, and errors
8. **NormalizationConventions.ts** - Asset normalization standards
9. **hand-rigging.ts** - Hand rigging specific types
10. **navigation.ts** - UI navigation state types
11. **fitting.ts** - Mesh fitting algorithm parameters
12. **service-types.ts** - Service layer interfaces

### Type File Dependencies

```
index.ts (central hub)
├── AssetMetadata.ts
│   └── RiggingMetadata.ts
├── generation.ts
│   └── AssetMetadata.ts
├── three.ts
├── gltf.ts
├── common.ts
├── NormalizationConventions.ts
├── hand-rigging.ts
├── navigation.ts
└── fitting.ts
```

## Core Types

### Vector3

The fundamental 3D coordinate type used throughout the system:

```typescript
export interface Vector3 {
  x: number
  y: number
  z: number
}
```

**Usage:**
- Position coordinates in 3D space
- Scale factors for transformations
- Direction vectors
- Bounding box calculations

**Example:**
```typescript
const weaponGripPosition: Vector3 = {
  x: 0.0,
  y: 0.15,
  z: 0.0
}

const buildingSize: Vector3 = {
  x: 10.0,  // width
  y: 8.0,   // height
  z: 12.0   // depth
}
```

### Quaternion

Represents rotations in 3D space using quaternion mathematics:

```typescript
export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}
```

**Usage:**
- Asset orientation and rotation
- Bone rotations in rigging
- Camera orientation
- Attachment point rotations

**Example:**
```typescript
const weaponRotation: Quaternion = {
  x: 0.0,
  y: 0.0,
  z: 0.0,
  w: 1.0  // Identity rotation (no rotation)
}

const attachmentRotation: Quaternion = {
  x: 0.7071,
  y: 0.0,
  z: 0.0,
  w: 0.7071  // 90-degree rotation around X axis
}
```

### BoundingBox

Defines the spatial bounds of 3D objects:

```typescript
export interface BoundingBox {
  min: Vector3
  max: Vector3
  center: Vector3
  size: Vector3
}
```

**Usage:**
- Collision detection
- Asset normalization
- Spatial queries
- Camera framing

**Example:**
```typescript
const assetBounds: BoundingBox = {
  min: { x: -0.5, y: 0.0, z: -0.3 },
  max: { x: 0.5, y: 1.2, z: 0.3 },
  center: { x: 0.0, y: 0.6, z: 0.0 },
  size: { x: 1.0, y: 1.2, z: 0.6 }
}
```

## Asset Type Enums

### AssetType

Primary categorization of all assets in the system:

```typescript
export type AssetType =
  | 'weapon'
  | 'armor'
  | 'consumable'
  | 'tool'
  | 'decoration'
  | 'character'
  | 'building'
  | 'resource'
  | 'misc'
```

**Usage:** Every asset must have one primary type that determines its behavior, normalization conventions, and processing pipeline.

### WeaponType

Specific weapon subcategories:

```typescript
export type WeaponType =
  | 'sword'
  | 'axe'
  | 'bow'
  | 'staff'
  | 'shield'
  | 'dagger'
  | 'mace'
  | 'spear'
  | 'crossbow'
  | 'wand'
  | 'scimitar'
  | 'battleaxe'
  | 'longsword'
```

**Normalization Impact:** Each weapon type has specific orientation and grip point conventions.

### ArmorSlot

Equipment slot categorization:

```typescript
export type ArmorSlot =
  | 'helmet'
  | 'chest'
  | 'legs'
  | 'boots'
  | 'gloves'
  | 'ring'
  | 'amulet'
  | 'cape'
  | 'shield'
```

**Usage:** Determines attachment points and fitting algorithms for armor pieces.

### CreatureType

Character rig categorization:

```typescript
export type CreatureType =
  | 'biped'
  | 'quadruped'
  | 'flying'
  | 'aquatic'
  | 'other'
```

**Usage:** Determines rigging strategy and animation compatibility.

### BuildingType

Building and structure categorization:

```typescript
export type BuildingType =
  | 'bank'
  | 'store'
  | 'house'
  | 'castle'
  | 'temple'
  | 'guild'
  | 'inn'
  | 'tower'
  | 'dungeon'
```

**Usage:** Determines functional area analysis and NPC placement logic.

### ToolType

Gathering and crafting tool types:

```typescript
export type ToolType =
  | 'pickaxe'
  | 'axe'
  | 'fishing_rod'
  | 'hammer'
  | 'knife'
  | 'tinderbox'
  | 'chisel'
```

### ResourceType

Gatherable resource categorization:

```typescript
export type ResourceType =
  | 'ore'
  | 'bar'
  | 'log'
  | 'plank'
  | 'fish'
  | 'herb'
  | 'gem'
```

### ConsumableType

Usable item categorization:

```typescript
export type ConsumableType =
  | 'food'
  | 'potion'
  | 'rune'
  | 'scroll'
  | 'teleport'
```

## Generation Request Types

### GenerationRequest

The primary interface for requesting asset generation:

```typescript
export interface GenerationRequest {
  id: string
  name: string
  description: string
  type: AssetType
  subtype?: WeaponType | ArmorSlot | BuildingType | ToolType | ResourceType | ConsumableType
  style?: 'realistic' | 'cartoon' | 'low-poly' | 'stylized'
  metadata?: {
    creatureType?: string
    armorSlot?: string
    weaponType?: string
    buildingType?: string
    materialType?: string
    [key: string]: string | number | boolean | undefined
  }
}
```

**Example:**
```typescript
const swordRequest: GenerationRequest = {
  id: 'asset_001',
  name: 'Iron Longsword',
  description: 'A standard iron longsword with leather grip',
  type: 'weapon',
  subtype: 'longsword',
  style: 'low-poly',
  metadata: {
    weaponType: 'longsword',
    tier: '1',
    attackLevel: 5
  }
}
```

### GDDAsset

Game Design Document asset specification:

```typescript
export interface GDDAsset {
  name: string
  description: string
  type: string
  subtype?: string
  style?: string
  metadata?: {
    tier?: string
    level?: number
    gameId?: string
    rarity?: string
    attackLevel?: number
    strengthLevel?: number
    defenseLevel?: number
    [key: string]: string | number | boolean | undefined
  }
}
```

**Usage:** Imported from game design documents for batch generation.

### SimpleGenerationResult

Simplified result format for CLI operations:

```typescript
export interface SimpleGenerationResult {
  success: boolean
  assetId: string
  fileSize?: string
  modelUrl?: string
  error?: string
}
```

## Generation Stage Types

### GenerationStage

Tracks individual stages of the generation pipeline:

```typescript
export interface GenerationStage {
  stage: 'description' | 'image' | 'model' | 'remesh' | 'analysis' | 'final'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  output?: ImageGenerationResult | ModelGenerationResult | RemeshResult |
    HardpointResult | ArmorPlacementResult | RiggingResult | BuildingAnalysisResult |
    { modelUrl: string; metadata: AssetMetadata } | string
  error?: string
  timestamp: Date
}
```

**Pipeline Stages:**
1. **description** - AI-enhanced description generation
2. **image** - Concept art generation via DALL-E or Stable Diffusion
3. **model** - 3D model generation via Meshy AI
4. **remesh** - Polygon optimization and retopology
5. **analysis** - Type-specific analysis (hardpoints, rigging, etc.)
6. **final** - Final asset assembly and metadata generation

### ImageGenerationResult

Result of concept art generation:

```typescript
export interface ImageGenerationResult {
  imageUrl: string
  prompt: string
  metadata: {
    model: string
    resolution: string
    quality?: string
    timestamp: string
  }
}
```

### ModelGenerationResult

Result of 3D model generation:

```typescript
export interface ModelGenerationResult {
  modelUrl: string
  format: 'glb' | 'fbx' | 'obj'
  polycount: number
  textureUrls?: {
    diffuse?: string
    normal?: string
    metallic?: string
    roughness?: string
  }
  metadata: {
    meshyTaskId: string
    processingTime: number
  }
}
```

### RemeshResult

Result of polygon optimization:

```typescript
export interface RemeshResult {
  modelUrl: string
  originalPolycount: number
  remeshedPolycount: number
  targetPolycount: number
}
```

## Analysis Result Types

### HardpointResult

Weapon grip and attachment point detection:

```typescript
export interface HardpointResult {
  weaponType: WeaponType
  primaryGrip: {
    position: Vector3
    rotation: Quaternion
    confidence: number
  }
  secondaryGrip?: {
    position: Vector3
    rotation: Quaternion
    confidence: number
  }
  attachmentPoints: Array<{
    name: string
    position: Vector3
    rotation: Quaternion
  }>
}
```

**Example:**
```typescript
const swordHardpoints: HardpointResult = {
  weaponType: 'longsword',
  primaryGrip: {
    position: { x: 0.0, y: 0.15, z: 0.0 },
    rotation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
    confidence: 0.95
  },
  attachmentPoints: [
    {
      name: 'blade_tip',
      position: { x: 0.0, y: 1.2, z: 0.0 },
      rotation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 }
    }
  ]
}
```

### ArmorPlacementResult

Armor fitting and deformation data:

```typescript
export interface ArmorPlacementResult {
  slot: ArmorSlot
  attachmentPoint: Vector3
  rotation: Quaternion
  scale: Vector3
  deformationWeights?: number[]
}
```

### RiggingResult

Character rigging and bone hierarchy:

```typescript
export interface RiggingResult {
  rigType: CreatureType
  bones: Array<{
    name: string
    position: Vector3
    rotation: Quaternion
    parent?: string
  }>
  animations?: string[]
}
```

### BuildingAnalysisResult

Building structure analysis:

```typescript
export interface BuildingAnalysisResult {
  buildingType: BuildingType
  entryPoints: Array<{
    name: string
    position: Vector3
    rotation: Quaternion
    isMain: boolean
  }>
  interiorSpace?: {
    center: Vector3
    size: Vector3
  }
  functionalAreas: Array<{
    name: string
    type: 'counter' | 'vault' | 'display' | 'seating' | 'storage'
    position: Vector3
    size: Vector3
  }>
  npcPositions?: Array<{
    role: string
    position: Vector3
    rotation: Quaternion
  }>
  metadata?: {
    floors: number
    hasBasement: boolean
    hasRoof: boolean
  }
}
```

## Complete Generation Result

### GenerationResult

Complete pipeline execution result:

```typescript
export interface GenerationResult {
  id: string
  request: GenerationRequest
  stages: GenerationStage[]
  imageResult?: ImageGenerationResult
  modelResult?: ModelGenerationResult
  remeshResult?: RemeshResult
  analysisResult?: HardpointResult | ArmorPlacementResult | RiggingResult | BuildingAnalysisResult
  finalAsset?: {
    modelUrl: string
    metadata: GenerationRequest & {
      analysisResult?: HardpointResult | ArmorPlacementResult | RiggingResult | BuildingAnalysisResult
      generatedAt: Date
      modelPath: string
    }
  }
  createdAt: Date
  updatedAt: Date
}
```

## Common Utility Types

### Callback Types

Standard callback patterns used throughout the system:

```typescript
export type ErrorCallback = (error: Error | string | { message: string; code?: string }) => void
export type SuccessCallback<T = void> = (result: T) => void
export type ProgressCallback = (progress: number) => void
```

**Example:**
```typescript
function generateAsset(
  request: GenerationRequest,
  onProgress: ProgressCallback,
  onSuccess: SuccessCallback<GenerationResult>,
  onError: ErrorCallback
): void {
  onProgress(0.1)
  // ... generation logic
  onProgress(0.5)
  // ... more processing
  onSuccess(result)
}
```

### Error Types

Comprehensive error handling:

```typescript
export interface AppError extends Error {
  code?: string
  statusCode?: number
  details?: Record<string, string | number | boolean> | string | null
}
```

**Example:**
```typescript
const generationError: AppError = {
  name: 'GenerationError',
  message: 'Failed to generate 3D model',
  code: 'MESHY_API_ERROR',
  statusCode: 500,
  details: {
    taskId: 'task_12345',
    attemptCount: 3
  }
}
```

### Detection Types

Computer vision and AI detection results:

```typescript
export interface DetectionData {
  bounds?: { x: number; y: number; width: number; height: number }
  landmarks?: Array<{ x: number; y: number; z?: number }>
  label?: string
  score?: number
  confidence?: number
  class?: string
  id?: string | number
  metadata?: Record<string, string | number | boolean>
}

export interface Detection {
  type: string
  confidence: number
  data: DetectionData
}
```

**Example:**
```typescript
const gripDetection: Detection = {
  type: 'weapon_grip',
  confidence: 0.92,
  data: {
    bounds: { x: 100, y: 200, width: 50, height: 80 },
    label: 'primary_grip',
    score: 0.92,
    metadata: {
      weaponType: 'sword',
      handedness: 'right'
    }
  }
}
```

### Grip Detection Types

Specialized types for weapon grip detection:

```typescript
export interface GripBounds {
  x: number
  y: number
  width: number
  height: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  confidence?: number
}

export interface GripCoordinates {
  centerX: number
  centerY: number
  z: number
  redBox: {
    x: number
    y: number
    width: number
    height: number
  }
  bounds: GripBounds
  gripBounds: GripBounds
  confidence?: number
}

export interface GripDetectionData {
  gripBounds: GripBounds
  confidence: number
  weaponType?: string
  gripDescription?: string
}
```

## Type Guard Patterns

Type guards enable runtime type discrimination and safe type narrowing:

### Asset Type Guards

```typescript
export function isBaseAsset(metadata: AssetMetadata): metadata is BaseAssetMetadata {
  return metadata.isBaseModel === true
}

export function isVariantAsset(metadata: AssetMetadata): metadata is VariantAssetMetadata {
  return metadata.isVariant === true
}

export function hasAnimations(asset: {
  metadata: AssetMetadata | ExtendedAssetMetadata
}): asset is AssetWithAnimations {
  return 'animations' in asset.metadata
}
```

**Usage Example:**
```typescript
function processAsset(metadata: AssetMetadata): void {
  if (isBaseAsset(metadata)) {
    // TypeScript knows metadata is BaseAssetMetadata
    console.log(`Base model with ${metadata.variants.length} variants`)
    console.log(`Meshy task ID: ${metadata.meshyTaskId}`)
  } else if (isVariantAsset(metadata)) {
    // TypeScript knows metadata is VariantAssetMetadata
    console.log(`Variant of ${metadata.parentBaseModel}`)
    console.log(`Material: ${metadata.materialPreset.displayName}`)
  }
}
```

### Validation Guards

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

export function canRetexture(metadata: AssetMetadata): boolean {
  return isBaseAsset(metadata) && !!metadata.meshyTaskId && !metadata.isPlaceholder
}
```

**Usage Example:**
```typescript
async function loadAssetMetadata(filePath: string): Promise<BaseAssetMetadata | null> {
  const data = await readJSON(filePath)

  if (validateBaseAsset(data)) {
    // Safe to use as BaseAssetMetadata
    if (canRetexture(data)) {
      console.log('Asset can be retextured')
    }
    return data
  }

  return null
}
```

## Utility Types

### Generic Function Types

```typescript
export type GenericFunction<TArgs extends readonly unknown[] = readonly unknown[], TReturn = void> =
  (...args: TArgs) => TReturn

export type GenericAsyncFunction<TArgs extends readonly unknown[] = readonly unknown[], TReturn = void> =
  (...args: TArgs) => Promise<TReturn>
```

**Example:**
```typescript
type AssetProcessor = GenericAsyncFunction<[AssetMetadata], boolean>

const processAsset: AssetProcessor = async (metadata) => {
  // Process asset
  return true
}
```

### Event Handler Types

```typescript
export type EventHandler<T = Event> = (event: T) => void
export type ChangeEventHandler<T = HTMLElement> = (event: React.ChangeEvent<T>) => void
```

### Cacheable Types

```typescript
export type CacheableValue = string | number | boolean | null | undefined |
  CacheableValue[] | { [key: string]: CacheableValue }

export interface CacheEvent<T extends CacheableValue = CacheableValue> {
  key: string
  value: T
}
```

### Debounced Function Type

```typescript
export type DebouncedFunction<T extends GenericFunction> = T & {
  cancel: () => void
  flush: () => void
}
```

**Example:**
```typescript
function debounce<T extends GenericFunction>(
  fn: T,
  delay: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  let lastArgs: Parameters<T> | undefined

  const debounced = ((...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    lastArgs = args
    timeoutId = setTimeout(() => fn(...args), delay)
  }) as DebouncedFunction<T>

  debounced.cancel = () => {
    clearTimeout(timeoutId)
    lastArgs = undefined
  }
  debounced.flush = () => {
    clearTimeout(timeoutId)
    if (lastArgs) {
      fn(...(lastArgs || []))
      lastArgs = undefined
    }
  }

  return debounced
}
```

## Import/Export Structure

### Central Export Hub (index.ts)

The `index.ts` file serves as the central type hub, re-exporting all types:

```typescript
// Base types
export interface Vector3 { /* ... */ }
export interface Quaternion { /* ... */ }
export interface BoundingBox { /* ... */ }

// Type enums
export type AssetType = 'weapon' | 'armor' | /* ... */
export type WeaponType = 'sword' | 'axe' | /* ... */

// Re-export type modules
export * from './AssetMetadata'
export * from './RiggingMetadata'
export * from './three'
export * from './common'
export * from './generation'
export * from './hand-rigging'
export * from './navigation'

// Explicitly re-export for isolatedModules compatibility
export type {
  GLTFAnimation,
  GLTFNode,
  GLTFSkin,
} from './gltf'

// Service type re-export
export type { Asset } from '@/services/api/AssetService'
```

### Type Import Patterns

**Named Imports:**
```typescript
import { Vector3, Quaternion, AssetMetadata } from '@/types'
import type { GenerationRequest, GenerationResult } from '@/types'
```

**Type-Only Imports:**
```typescript
import type { BaseAssetMetadata, VariantAssetMetadata } from '@/types/AssetMetadata'
import type { ThreeGeometry, ThreeMaterial } from '@/types/three'
```

**Specific Module Imports:**
```typescript
import { GLTFNode, GLTFSkin, GLTFAnimation } from '@/types/gltf'
import { HandRiggingResult, HandBoneStructure } from '@/types/hand-rigging'
```

## Configuration Types

### AICreationConfig

Complete configuration for AI generation services:

```typescript
export interface AICreationConfig {
  openai: {
    apiKey: string
    model?: string
    imageServerBaseUrl?: string
  }
  meshy: {
    apiKey: string
    baseUrl?: string
  }
  cache: {
    enabled: boolean
    ttl: number
    maxSize: number
  }
  output: {
    directory: string
    format: 'glb' | 'fbx' | 'obj'
  }
}
```

**Example:**
```typescript
const config: AICreationConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4-vision-preview',
    imageServerBaseUrl: 'https://api.openai.com/v1'
  },
  meshy: {
    apiKey: process.env.MESHY_API_KEY!,
    baseUrl: 'https://api.meshy.ai/v1'
  },
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    maxSize: 100
  },
  output: {
    directory: './gdd-assets',
    format: 'glb'
  }
}
```

### MaterialPreset

Material preset definitions for retexturing:

```typescript
export interface MaterialPreset {
  id: string
  name: string
  displayName: string
  category: string
  tier: number
  color: string
  stylePrompt?: string
  description?: string
}
```

**Example:**
```typescript
const ironPreset: MaterialPreset = {
  id: 'iron',
  name: 'iron',
  displayName: 'Iron',
  category: 'metal',
  tier: 1,
  color: '#808080',
  stylePrompt: 'dark gray iron metal texture, slightly rough surface',
  description: 'Basic iron material for tier 1 equipment'
}
```

## Cache Types

### CacheEntry

Generic cache storage structure:

```typescript
export interface CacheEntry<T> {
  key: string
  value: T
  timestamp: Date
  ttl: number
}
```

**Example:**
```typescript
const modelCache: CacheEntry<ModelGenerationResult> = {
  key: 'model_iron_sword',
  value: {
    modelUrl: 'https://cdn.example.com/models/iron_sword.glb',
    format: 'glb',
    polycount: 1500,
    metadata: {
      meshyTaskId: 'task_12345',
      processingTime: 45000
    }
  },
  timestamp: new Date(),
  ttl: 3600000 // 1 hour
}
```

## Environment Types

### EnvironmentVariables

Type-safe environment variable access:

```typescript
export interface EnvironmentVariables {
  VITE_GENERATION_API_URL?: string
  VITE_OPENAI_API_KEY?: string
  VITE_MESHY_API_KEY?: string
  VITE_IMAGE_SERVER_URL?: string
}

export interface ExtendedWindow extends Window {
  env?: EnvironmentVariables
  _rotationLogged?: boolean
  _lastLoggedRotation?: number
  _skeletonUpdateLogged?: boolean
  _lastSkeletonRotation?: number
}

export interface ExtendedImportMeta extends ImportMeta {
  env?: EnvironmentVariables
}
```

**Usage:**
```typescript
const apiUrl = (window as ExtendedWindow).env?.VITE_GENERATION_API_URL
const openaiKey = import.meta.env.VITE_OPENAI_API_KEY
```

## Best Practices

### 1. Always Use Type Imports for Types

```typescript
// Good
import type { AssetMetadata, GenerationRequest } from '@/types'

// Bad
import { AssetMetadata, GenerationRequest } from '@/types'
```

### 2. Leverage Type Guards

```typescript
// Good - Type-safe narrowing
if (isBaseAsset(metadata)) {
  console.log(metadata.meshyTaskId) // TypeScript knows this exists
}

// Bad - Unsafe type assertion
console.log((metadata as BaseAssetMetadata).meshyTaskId)
```

### 3. Use Discriminated Unions

```typescript
// Types already use discriminated unions
type AssetMetadata = BaseAssetMetadata | VariantAssetMetadata

// BaseAssetMetadata has isBaseModel: true
// VariantAssetMetadata has isVariant: true
```

### 4. Validate External Data

```typescript
// Good - Validate before using
if (validateBaseAsset(data)) {
  processBaseAsset(data)
}

// Bad - Assume external data is valid
processBaseAsset(data as BaseAssetMetadata)
```

### 5. Use Specific Types

```typescript
// Good
function processWeapon(weapon: BaseAssetMetadata & { subtype: WeaponType }): void {
  // Specific and type-safe
}

// Bad
function processWeapon(weapon: AssetMetadata): void {
  // Too generic, requires runtime checks
}
```

## Type System Extensions

The type system is designed to be extensible. When adding new asset types or generation methods:

1. **Add enum values** to appropriate type unions
2. **Extend metadata interfaces** with optional properties
3. **Create new analysis result types** if needed
4. **Add type guards** for new discriminated union members
5. **Update normalization conventions** for new asset types
6. **Document new types** in relevant sections

## Summary

The Asset Forge type system provides:

- **12 specialized type files** covering all aspects of the system
- **Strong type safety** with no `any` types
- **Discriminated unions** for safe type narrowing
- **Type guards** for runtime type checking
- **Comprehensive enums** for all categorization
- **Generic utilities** for common patterns
- **Validation helpers** for external data
- **Extensible architecture** for future growth

This type architecture ensures type safety across the entire asset generation pipeline, from initial request through final asset delivery, while maintaining flexibility for future expansion.
