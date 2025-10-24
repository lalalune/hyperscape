# Frontend Service Layer API

Asset Forge's frontend is built with a comprehensive service layer that encapsulates business logic, state management, and API communication. This document covers all frontend services with method signatures, parameters, return types, and usage examples.

## Table of Contents

1. [Service Architecture Overview](#service-architecture-overview)
2. [Asset Management Services](#asset-management-services)
3. [Generation Services](#generation-services)
4. [Processing Services](#processing-services)
5. [Fitting Services](#fitting-services)
6. [Hand Rigging Services](#hand-rigging-services)
7. [Event System](#event-system)
8. [State Management](#state-management)

## Service Architecture Overview

The frontend service layer follows these principles:

- **Singleton Pattern**: Most services are exported as singleton instances
- **TypeScript Classes**: Strong typing for all methods and parameters
- **Event-Driven**: Services emit events for asynchronous operations
- **Dependency Injection**: Services can be injected for testing
- **Error Handling**: Consistent error handling with typed exceptions

### Service Categories

| Category | Services | Purpose |
|----------|----------|---------|
| API Services | AssetService, GenerationAPIClient, PromptService | Backend communication |
| Generation | SpriteGenerationService | Client-side 3D rendering |
| Processing | AssetNormalizationService, CreatureScalingService, WeaponHandleDetector | Asset processing |
| Fitting | MeshFittingService, ArmorFittingService, ArmorScaleFixer | Armor fitting algorithms |
| Hand Rigging | HandRiggingService, SimpleHandRiggingService, HandPoseDetectionService | Hand attachment |

## Asset Management Services

### AssetService

Manages asset CRUD operations and file access.

**Location:** `src/services/api/AssetService.ts`

#### Interface

```typescript
class AssetServiceClass {
  async listAssets(): Promise<Asset[]>
  async getMaterialPresets(): Promise<MaterialPreset[]>
  async retexture(request: RetextureRequest): Promise<RetextureResponse>
  getModelUrl(assetId: string): string
  getConceptArtUrl(assetId: string): string
}
```

#### listAssets()

Fetches all available assets from the server.

**Signature:**
```typescript
async listAssets(): Promise<Asset[]>
```

**Returns:**
```typescript
interface Asset {
  id: string
  name: string
  description: string
  type: string
  metadata: AssetMetadata
  hasModel: boolean
  modelFile?: string
  generatedAt: string
}
```

**Example:**
```typescript
import { AssetService } from '@/services/api/AssetService'

// Fetch all assets
const assets = await AssetService.listAssets()

console.log(`Found ${assets.length} assets`)
assets.forEach(asset => {
  console.log(`${asset.name} (${asset.type})`)
})
```

**Error Handling:**
```typescript
try {
  const assets = await AssetService.listAssets()
} catch (error) {
  console.error('Failed to fetch assets:', error)
  // Handle error - show notification, retry, etc.
}
```

**Notes:**
- Includes aggressive cache-busting headers (`no-cache`, timestamp query param)
- 15-second timeout configured via `apiFetch`
- Polls server file system for real-time updates

#### getMaterialPresets()

Retrieves available material presets for retexturing.

**Signature:**
```typescript
async getMaterialPresets(): Promise<MaterialPreset[]>
```

**Returns:**
```typescript
interface MaterialPreset {
  id: string
  name: string
  displayName: string
  category: string
  tier: number
  color: string
  stylePrompt: string
  description?: string
}
```

**Example:**
```typescript
const presets = await AssetService.getMaterialPresets()

// Group by category
const byCategory = presets.reduce((acc, preset) => {
  const category = preset.category
  if (!acc[category]) acc[category] = []
  acc[category].push(preset)
  return acc
}, {} as Record<string, MaterialPreset[]>)

console.log('Metal presets:', byCategory.metal)
```

#### retexture()

Apply a material preset to a base model.

**Signature:**
```typescript
async retexture(request: RetextureRequest): Promise<RetextureResponse>
```

**Parameters:**
```typescript
interface RetextureRequest {
  baseAssetId: string
  materialPreset: MaterialPreset
  outputName?: string
}
```

**Returns:**
```typescript
interface RetextureResponse {
  success: boolean
  assetId: string
  message: string
  asset?: Asset
}
```

**Example:**
```typescript
const response = await AssetService.retexture({
  baseAssetId: 'sword-base',
  materialPreset: {
    id: 'steel',
    name: 'steel',
    displayName: 'Steel',
    category: 'metal',
    tier: 2,
    color: '#C0C0C0',
    stylePrompt: 'polished steel texture'
  },
  outputName: 'Steel Sword'
})

console.log('Created asset:', response.assetId)
```

**Error Handling:**
```typescript
try {
  const response = await AssetService.retexture(request)
  if (response.success) {
    notify.success(`Created ${response.asset?.name}`)
  }
} catch (error) {
  notify.error('Retexturing failed: ' + error.message)
}
```

#### getModelUrl()

Generates the URL for downloading an asset's 3D model.

**Signature:**
```typescript
getModelUrl(assetId: string): string
```

**Example:**
```typescript
const modelUrl = AssetService.getModelUrl('bronze-sword-base')
// Returns: "/assets/bronze-sword-base/bronze-sword-base.glb"

// Use with GLTFLoader
const loader = new GLTFLoader()
loader.load(modelUrl, (gltf) => {
  scene.add(gltf.scene)
})
```

#### getConceptArtUrl()

Generates the URL for an asset's concept art image.

**Signature:**
```typescript
getConceptArtUrl(assetId: string): string
```

**Example:**
```typescript
const conceptUrl = AssetService.getConceptArtUrl('bronze-sword-base')
// Returns: "/assets/bronze-sword-base/concept-art.png"

// Use in React component
<img src={conceptUrl} alt="Concept art" />
```

## Generation Services

### GenerationAPIClient

Manages the asset generation pipeline with real-time status updates.

**Location:** `src/services/api/GenerationAPIClient.ts`

#### Interface

```typescript
class GenerationAPIClient extends TypedEventEmitter<GenerationAPIEvents> {
  async startPipeline(config: GenerationConfig): Promise<string>
  async fetchPipelineStatus(pipelineId: string): Promise<PipelineResult>
  async healthCheck(): Promise<boolean>
  getActivePipelines(): PipelineResult[]
  getPipelineStatus(pipelineId: string): PipelineResult | undefined
  clearInactivePipelines(): void
  on<K extends keyof GenerationAPIEvents>(event: K, listener: (data: EventArgs<K>) => void): this
  off<K extends keyof GenerationAPIEvents>(event: K, listener: (data: EventArgs<K>) => void): this
}
```

#### startPipeline()

Initiates a new asset generation pipeline.

**Signature:**
```typescript
async startPipeline(config: GenerationConfig): Promise<string>
```

**Parameters:**
```typescript
interface GenerationConfig {
  name: string
  type: string
  subtype: string
  description: string
  style?: string
  assetId?: string
  generationType?: 'item' | 'avatar'
  quality?: 'standard' | 'high' | 'ultra'
  metadata?: Record<string, any>
  materialPresets?: MaterialPreset[]
  enableGeneration?: boolean
  enableRetexturing?: boolean
  enableSprites?: boolean
  enableRigging?: boolean
  spriteConfig?: SpriteConfig
  riggingOptions?: RiggingOptions
  customPrompts?: {
    gameStyle?: string
    assetType?: string
  }
}
```

**Returns:** Pipeline ID (string)

**Example:**
```typescript
import { GenerationAPIClient } from '@/services/api/GenerationAPIClient'

const client = new GenerationAPIClient()

// Start pipeline
const pipelineId = await client.startPipeline({
  name: 'Steel Longsword',
  type: 'weapon',
  subtype: 'sword',
  description: 'A polished steel longsword',
  style: 'runescape2007',
  enableRetexturing: true,
  enableSprites: true,
  materialPresets: [
    { id: 'bronze', /* ... */ },
    { id: 'steel', /* ... */ }
  ]
})

console.log('Pipeline started:', pipelineId)
```

#### Event Handling

The GenerationAPIClient emits events during pipeline execution.

**Event Types:**
```typescript
interface GenerationAPIEvents {
  'pipeline:started': { pipelineId: string }
  'progress': { pipelineId: string; progress: number }
  'statusChange': { pipelineId: string; status: string }
  'update': PipelineResult
  'pipeline:completed': PipelineResult
  'pipeline:failed': { pipelineId: string; error?: string }
  'error': { pipelineId: string; error: Error | string | { message: string; code?: string } }
}
```

**Example:**
```typescript
const client = new GenerationAPIClient()

// Listen for events
client.on('pipeline:started', ({ pipelineId }) => {
  console.log('Pipeline started:', pipelineId)
})

client.on('progress', ({ pipelineId, progress }) => {
  console.log(`Pipeline ${pipelineId}: ${progress}%`)
})

client.on('pipeline:completed', (result) => {
  console.log('Pipeline completed:', result)
  notify.success('Asset generated successfully!')
})

client.on('pipeline:failed', ({ pipelineId, error }) => {
  console.error('Pipeline failed:', error)
  notify.error('Generation failed')
})

// Start pipeline
const pipelineId = await client.startPipeline(config)

// Cleanup when done
client.off('progress', progressHandler)
```

#### fetchPipelineStatus()

Manually fetch the current status of a pipeline.

**Signature:**
```typescript
async fetchPipelineStatus(pipelineId: string): Promise<PipelineResult>
```

**Returns:**
```typescript
interface PipelineResult {
  id: string
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  progress: number
  stages: {
    generation: PipelineStage
    retexturing: PipelineStage
    sprites: PipelineStage
  }
  config: GenerationConfig
  results: PipelineResults
  error?: string
}
```

**Example:**
```typescript
const status = await client.fetchPipelineStatus('pipe_123')

console.log('Current status:', status.status)
console.log('Overall progress:', status.progress)
console.log('Generation stage:', status.stages.generation.status)
```

### SpriteGenerationService

Generates 2D sprites from 3D models using client-side Three.js rendering.

**Location:** `src/services/generation/SpriteGenerationService.ts`

#### Interface

```typescript
class SpriteGenerationService {
  async generateSprites(options: SpriteGenerationOptions): Promise<SpriteResult[]>
  async generateIsometricSprites(modelPath: string, outputSize?: number): Promise<SpriteResult[]>
  async generateCharacterSprites(modelPath: string, animations?: string[], outputSize?: number): Promise<Record<string, SpriteResult[]>>
  dispose(): void
}
```

#### generateSprites()

Generate sprite images from a 3D model at specified angles.

**Signature:**
```typescript
async generateSprites(options: SpriteGenerationOptions): Promise<SpriteResult[]>
```

**Parameters:**
```typescript
interface SpriteGenerationOptions {
  modelPath: string
  outputSize?: number // Default: 256
  angles?: number[] // Default: [0, 45, 90, 135, 180, 225, 270, 315]
  backgroundColor?: string // Default: 'transparent'
  padding?: number // Default: 0.1 (10%)
}
```

**Returns:**
```typescript
interface SpriteResult {
  angle: string // e.g., "0deg"
  imageUrl: string // Data URL
  width: number
  height: number
}
```

**Example:**
```typescript
import { SpriteGenerationService } from '@/services/generation/SpriteGenerationService'

const service = new SpriteGenerationService()

const sprites = await service.generateSprites({
  modelPath: '/api/assets/bronze-sword-base/model',
  outputSize: 512,
  angles: [0, 45, 90, 135, 180, 225, 270, 315],
  backgroundColor: 'transparent',
  padding: 0.1
})

console.log(`Generated ${sprites.length} sprites`)

// Save sprites to server
const response = await fetch('/api/assets/bronze-sword-base/sprites', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sprites: sprites.map(s => ({
      angle: parseInt(s.angle),
      imageData: s.imageUrl
    })),
    config: {
      angles: 8,
      resolution: 512,
      backgroundColor: 'transparent'
    }
  })
})
```

#### generateIsometricSprites()

Generate 8-directional isometric sprites.

**Signature:**
```typescript
async generateIsometricSprites(
  modelPath: string,
  outputSize?: number
): Promise<SpriteResult[]>
```

**Example:**
```typescript
const isoSprites = await service.generateIsometricSprites(
  '/api/assets/character/model',
  128
)

// Returns sprites at 30-degree isometric angle
// with 8 rotation directions (0, 45, 90, 135, 180, 225, 270, 315)
```

## Processing Services

### AssetNormalizationService

Normalizes 3D models to standard conventions (origin, orientation, scale).

**Location:** `src/services/processing/AssetNormalizationService.ts`

#### Interface

```typescript
class AssetNormalizationService {
  async normalizeWeapon(
    modelPath: string,
    weaponType?: string,
    gripPoint?: THREE.Vector3
  ): Promise<NormalizedAssetResult>

  async normalizeCharacter(
    modelPath: string,
    targetHeight?: number
  ): Promise<NormalizedAssetResult>

  async normalizeBuilding(
    modelPath: string
  ): Promise<NormalizedAssetResult>
}
```

#### normalizeWeapon()

Normalize a weapon model with grip at origin and blade pointing up.

**Signature:**
```typescript
async normalizeWeapon(
  modelPath: string,
  weaponType?: string,
  gripPoint?: THREE.Vector3
): Promise<NormalizedAssetResult>
```

**Returns:**
```typescript
interface NormalizedAssetResult {
  glb: ArrayBuffer
  metadata: {
    originalBounds: THREE.Box3
    normalizedBounds: THREE.Box3
    transformsApplied: {
      translation: THREE.Vector3
      rotation: THREE.Euler
      scale: number
    }
    dimensions: {
      width: number
      height: number
      depth: number
    }
  }
}
```

**Example:**
```typescript
import { AssetNormalizationService } from '@/services/processing/AssetNormalizationService'

const service = new AssetNormalizationService()

const normalized = await service.normalizeWeapon(
  '/api/assets/sword-raw/model',
  'sword',
  new THREE.Vector3(0, 0.2, 0) // Grip point
)

// Save normalized model
const blob = new Blob([normalized.glb], { type: 'model/gltf-binary' })
const formData = new FormData()
formData.append('model', blob, 'normalized.glb')

await fetch('/api/assets/sword-normalized/upload', {
  method: 'POST',
  body: formData
})
```

### WeaponHandleDetector

Detects weapon grip points using AI vision.

**Location:** `src/services/processing/WeaponHandleDetector.ts`

#### Interface

```typescript
class WeaponHandleDetector {
  async detectGripPoint(
    image: string,
    angle?: string,
    promptHint?: string
  ): Promise<GripDetectionResult>

  async detectOrientation(
    image: string
  ): Promise<OrientationDetectionResult>
}
```

#### detectGripPoint()

Use GPT-4 Vision to detect weapon grip location.

**Signature:**
```typescript
async detectGripPoint(
  image: string,
  angle?: string,
  promptHint?: string
): Promise<GripDetectionResult>
```

**Parameters:**
- `image`: Base64-encoded image data URL
- `angle`: View angle (e.g., "side", "front")
- `promptHint`: Additional context for AI

**Returns:**
```typescript
interface GripDetectionResult {
  gripBounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  confidence: number
  weaponType: string
  gripDescription: string
  detectedParts: {
    blade: string
    handle: string
    guard?: string
  }
}
```

**Example:**
```typescript
import { WeaponHandleDetector } from '@/services/processing/WeaponHandleDetector'

const detector = new WeaponHandleDetector()

// Render weapon to canvas
const canvas = renderWeaponToCanvas(weapon)
const imageData = canvas.toDataURL('image/png')

// Detect grip point
const result = await detector.detectGripPoint(
  imageData,
  'side',
  'This is a longsword with leather-wrapped grip'
)

console.log('Grip location:', result.gripBounds)
console.log('Confidence:', result.confidence)
console.log('Weapon type:', result.weaponType)

// Convert pixel coordinates to 3D space
const gripPoint3D = pixelToWorld(result.gripBounds, weapon)
```

## Fitting Services

### MeshFittingService

Advanced mesh deformation for fitting armor to character bodies.

**Location:** `src/services/fitting/MeshFittingService.ts`

#### Interface

```typescript
class MeshFittingService {
  fitMesh(
    sourceMesh: THREE.Mesh,
    targetMesh: THREE.Mesh,
    parameters: MeshFittingParameters
  ): void

  setDebugArrowGroup(group: THREE.Group | null): void
  clearDebugArrows(): void
}
```

#### fitMesh()

Deform source mesh to fit target mesh using shrinkwrap algorithm.

**Signature:**
```typescript
fitMesh(
  sourceMesh: THREE.Mesh,
  targetMesh: THREE.Mesh,
  parameters: MeshFittingParameters
): void
```

**Parameters:**
```typescript
interface MeshFittingParameters {
  iterations: number // Number of fitting iterations
  stepSize: number // 0-1, movement per iteration
  smoothingRadius: number // Radius for gaussian smoothing
  smoothingStrength: number // 0-1, smoothing strength
  targetOffset: number // Distance from target surface
  sampleRate?: number // Percentage of vertices to process
  targetBounds?: THREE.Box3 // Constrain fitting region
  preserveFeatures?: boolean // Preserve sharp edges
  featureAngleThreshold?: number // Angle threshold (degrees)
  useImprovedShrinkwrap?: boolean // Use improved algorithm
  preserveOpenings?: boolean // Preserve openings
  pushInteriorVertices?: boolean // Push interior vertices out
  onProgress?: (progress: number, message?: string) => void
  showDebugArrows?: boolean
  debugArrowDensity?: number
  debugColorMode?: 'direction' | 'magnitude' | 'sidedness'
}
```

**Example:**
```typescript
import { MeshFittingService } from '@/services/fitting/MeshFittingService'

const fittingService = new MeshFittingService()

// Fit armor to character
fittingService.fitMesh(
  armorMesh,
  characterMesh,
  {
    iterations: 50,
    stepSize: 0.5,
    smoothingRadius: 0.05,
    smoothingStrength: 0.3,
    targetOffset: 0.01, // 1cm offset
    preserveFeatures: true,
    featureAngleThreshold: 30,
    useImprovedShrinkwrap: true,
    onProgress: (progress, message) => {
      console.log(`Fitting: ${progress}% - ${message}`)
    }
  }
)

console.log('Armor fitted to character')
```

### ArmorFittingService

High-level service for fitting armor pieces to characters.

**Location:** `src/services/fitting/ArmorFittingService.ts`

#### Interface

```typescript
class ArmorFittingService {
  async fitArmorToCharacter(
    armorMesh: THREE.Mesh,
    characterMesh: THREE.Mesh,
    armorType: ArmorType,
    options?: ArmorFittingOptions
  ): Promise<THREE.Mesh>
}
```

**Example:**
```typescript
import { ArmorFittingService } from '@/services/fitting/ArmorFittingService'

const service = new ArmorFittingService()

const fittedArmor = await service.fitArmorToCharacter(
  helmetMesh,
  characterMesh,
  'helmet',
  {
    preserveDetails: true,
    targetOffset: 0.015, // 1.5cm gap
    smoothingIterations: 3
  }
)

scene.add(fittedArmor)
```

## Hand Rigging Services

### HandRiggingService

Attaches weapons to character hands with proper grip positioning.

**Location:** `src/services/hand-rigging/HandRiggingService.ts`

#### Interface

```typescript
class HandRiggingService {
  async attachWeaponToHand(
    weapon: THREE.Object3D,
    character: THREE.Object3D,
    hand: 'left' | 'right',
    weaponType: string,
    gripPoint?: THREE.Vector3
  ): Promise<void>

  async detectGripPoint(
    weapon: THREE.Object3D,
    weaponType: string
  ): Promise<THREE.Vector3>
}
```

**Example:**
```typescript
import { HandRiggingService } from '@/services/hand-rigging/HandRiggingService'

const service = new HandRiggingService()

// Attach sword to right hand
await service.attachWeaponToHand(
  swordMesh,
  characterMesh,
  'right',
  'sword',
  new THREE.Vector3(0, 0.2, 0) // Grip point
)

console.log('Weapon attached to hand')
```

## Event System

### TypedEventEmitter

Type-safe event emitter used by all services.

**Location:** `src/utils/TypedEventEmitter.ts`

#### Interface

```typescript
class TypedEventEmitter<Events extends Record<PropertyKey, any>> {
  on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this
  off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this
  once<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this
  emit<K extends keyof Events>(event: K, data: Events[K]): boolean
  addListener<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this
  removeListener<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this
}
```

**Example:**
```typescript
interface MyEvents {
  'data': { value: number }
  'error': { message: string }
}

class MyService extends TypedEventEmitter<MyEvents> {
  doSomething() {
    this.emit('data', { value: 42 })
  }
}

const service = new MyService()
service.on('data', ({ value }) => {
  console.log('Value:', value) // Type-safe!
})
```

## State Management

Asset Forge uses Zustand for state management. Service calls are typically wrapped in Zustand stores.

**Example Store:**
```typescript
import { create } from 'zustand'
import { AssetService } from '@/services/api/AssetService'

interface AssetStore {
  assets: Asset[]
  loading: boolean
  error: string | null
  fetchAssets: () => Promise<void>
}

export const useAssetStore = create<AssetStore>((set) => ({
  assets: [],
  loading: false,
  error: null,

  fetchAssets: async () => {
    set({ loading: true, error: null })
    try {
      const assets = await AssetService.listAssets()
      set({ assets, loading: false })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  }
}))
```

**Usage in React:**
```typescript
function AssetList() {
  const { assets, loading, fetchAssets } = useAssetStore()

  useEffect(() => {
    fetchAssets()
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div>
      {assets.map(asset => (
        <div key={asset.id}>{asset.name}</div>
      ))}
    </div>
  )
}
```

### useMultiAgentStore

Multi-agent AI systems store for NPC collaborations and playtester swarms.

**Location:** `src/store/useMultiAgentStore.ts`

#### Interface

```typescript
interface MultiAgentStore {
  // NPC Collaboration State
  collaborations: CollaborationSession[]
  activeCollaboration: CollaborationSession | null
  isCollaborating: boolean
  collaborationError: string | null

  // Playtester Swarm State
  playtestSessions: PlaytestSession[]
  activePlaytest: PlaytestSession | null
  isTesting: boolean
  testError: string | null

  // Playtester Personas (cached)
  availablePersonas: PlaytesterPersonasResponse | null
  loadingPersonas: boolean

  // NPC Collaboration Actions
  addCollaboration: (session: CollaborationSession) => void
  setActiveCollaboration: (session: CollaborationSession | null) => void
  deleteCollaboration: (sessionId: string) => void
  setCollaborating: (isCollaborating: boolean) => void
  setCollaborationError: (error: string | null) => void
  clearCollaborations: () => void

  // Playtester Swarm Actions
  addPlaytestSession: (session: PlaytestSession) => void
  setActivePlaytest: (session: PlaytestSession | null) => void
  deletePlaytestSession: (sessionId: string) => void
  setTesting: (isTesting: boolean) => void
  setTestError: (error: string | null) => void
  clearPlaytestSessions: () => void

  // Persona Actions
  setAvailablePersonas: (personas: PlaytesterPersonasResponse) => void
  setLoadingPersonas: (loading: boolean) => void

  // Utility
  reset: () => void
}
```

#### State Properties

##### NPC Collaboration

**collaborations**
- Type: `CollaborationSession[]`
- Description: Array of all collaboration sessions
- Default: `[]`

**activeCollaboration**
- Type: `CollaborationSession | null`
- Description: Currently displayed collaboration in viewer
- Default: `null`

**isCollaborating**
- Type: `boolean`
- Description: Whether collaboration is currently running
- Default: `false`

**collaborationError**
- Type: `string | null`
- Description: Error message if collaboration fails
- Default: `null`

##### Playtester Swarm

**playtestSessions**
- Type: `PlaytestSession[]`
- Description: Array of all playtest sessions
- Default: `[]`

**activePlaytest**
- Type: `PlaytestSession | null`
- Description: Currently displayed test report
- Default: `null`

**isTesting**
- Type: `boolean`
- Description: Whether playtester swarm is currently running
- Default: `false`

**testError**
- Type: `string | null`
- Description: Error message if test fails
- Default: `null`

##### Personas

**availablePersonas**
- Type: `PlaytesterPersonasResponse | null`
- Description: Cached playtester persona definitions from server
- Default: `null`

**loadingPersonas**
- Type: `boolean`
- Description: Whether personas are being loaded
- Default: `false`

#### Actions

##### addCollaboration()

Add a new collaboration session and set as active.

**Signature:**
```typescript
addCollaboration: (session: CollaborationSession) => void
```

**Example:**
```typescript
import { useMultiAgentStore } from '@/store/useMultiAgentStore'

const { addCollaboration } = useMultiAgentStore()

// After collaboration completes
const handleComplete = (session: CollaborationSession) => {
  addCollaboration(session)  // Adds to list and sets as active
}
```

##### setActiveCollaboration()

Set which collaboration to display in viewer.

**Signature:**
```typescript
setActiveCollaboration: (session: CollaborationSession | null) => void
```

**Example:**
```typescript
// View specific collaboration
setActiveCollaboration(collaborations[0])

// Close viewer
setActiveCollaboration(null)
```

##### addPlaytestSession()

Add a new playtest session and set as active.

**Signature:**
```typescript
addPlaytestSession: (session: PlaytestSession) => void
```

**Example:**
```typescript
import { useMultiAgentStore } from '@/store/useMultiAgentStore'

const { addPlaytestSession } = useMultiAgentStore()

// After test completes
const handleTestComplete = (session: PlaytestSession) => {
  addPlaytestSession(session)  // Adds to list and sets as active
}
```

##### setAvailablePersonas()

Cache playtester persona definitions from server.

**Signature:**
```typescript
setAvailablePersonas: (personas: PlaytesterPersonasResponse) => void
```

**Example:**
```typescript
import { useMultiAgentStore } from '@/store/useMultiAgentStore'
import { API_ENDPOINTS } from '@/config/api'

const { setAvailablePersonas, setLoadingPersonas } = useMultiAgentStore()

const loadPersonas = async () => {
  setLoadingPersonas(true)
  try {
    const response = await fetch(API_ENDPOINTS.playtesterPersonas)
    const data = await response.json()
    setAvailablePersonas(data)
  } finally {
    setLoadingPersonas(false)
  }
}
```

#### Complete Usage Example

```typescript
import { useMultiAgentStore } from '@/store/useMultiAgentStore'
import { API_ENDPOINTS } from '@/config/api'

function NPCCollaborationPanel() {
  const {
    collaborations,
    activeCollaboration,
    isCollaborating,
    collaborationError,
    addCollaboration,
    setActiveCollaboration,
    setCollaborating,
    setCollaborationError
  } = useMultiAgentStore()

  const runCollaboration = async (request: CollaborationRequest) => {
    setCollaborating(true)
    setCollaborationError(null)

    try {
      const response = await fetch(API_ENDPOINTS.npcCollaboration, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error('Collaboration failed')
      }

      const session = await response.json()
      addCollaboration(session)  // Adds and sets as active
    } catch (error) {
      setCollaborationError(error.message)
    } finally {
      setCollaborating(false)
    }
  }

  return (
    <div>
      {/* Configuration Panel */}
      <CollaborationBuilder
        isLoading={isCollaborating}
        error={collaborationError}
        onSubmit={runCollaboration}
      />

      {/* Results Viewer */}
      {activeCollaboration && (
        <CollaborationResultViewer
          session={activeCollaboration}
          onClose={() => setActiveCollaboration(null)}
        />
      )}

      {/* History List */}
      <CollaborationHistory
        sessions={collaborations}
        onSelect={setActiveCollaboration}
      />
    </div>
  )
}
```

#### Type Definitions

```typescript
interface CollaborationSession {
  sessionId: string
  collaborationType: CollaborationType
  npcCount: number
  rounds: number
  conversation: ConversationRound[]
  emergentContent: EmergentContent
  validation?: ValidationResult
  metadata: SessionMetadata
  stats: SessionStats
}

interface PlaytestSession {
  sessionId: string
  contentType: string
  testCount: number
  duration: number
  consensus: ConsensusData
  aggregatedMetrics: AggregatedMetrics
  recommendations: Recommendation[]
  report: TestReport
  stats: PlaytestStats
}

interface PlaytesterPersonasResponse {
  personas: Record<TesterArchetype, PersonaDefinition>
  availablePersonas: TesterArchetype[]
  defaultSwarm: TesterArchetype[]
  description: string
}

type TesterArchetype =
  | 'completionist'
  | 'speedrunner'
  | 'explorer'
  | 'casual'
  | 'minmaxer'
  | 'roleplayer'
  | 'breaker'
```

## Best Practices

### Error Handling

Always wrap service calls in try-catch blocks:

```typescript
try {
  const result = await service.doSomething()
  notify.success('Operation completed')
} catch (error) {
  console.error('Operation failed:', error)
  notify.error(error.message)
}
```

### Memory Management

Dispose of services when done:

```typescript
const spriteService = new SpriteGenerationService()

// Use service...
await spriteService.generateSprites(options)

// Cleanup
spriteService.dispose()
```

### Event Cleanup

Always remove event listeners:

```typescript
const handler = (data) => console.log(data)

client.on('progress', handler)

// Later...
client.off('progress', handler)
```

### Dependency Injection

Services can be injected for testing:

```typescript
class MyComponent {
  constructor(
    private assetService: AssetServiceClass = AssetService
  ) {}

  async loadAssets() {
    return this.assetService.listAssets()
  }
}

// In tests
const mockService = {
  listAssets: async () => [{ id: '1', name: 'Test' }]
}
const component = new MyComponent(mockService)
```

## Conclusion

The Asset Forge frontend service layer provides a comprehensive, type-safe API for all asset operations. Services are designed to be composable, testable, and maintainable, following modern TypeScript best practices.
