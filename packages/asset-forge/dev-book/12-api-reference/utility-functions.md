# Utility Functions Reference

Asset Forge provides a comprehensive set of utility functions for common operations including API calls, notifications, event handling, asset naming, and game-specific helpers. This reference covers all utility modules with detailed examples and best practices.

## Table of Contents

1. [API Utilities](#api-utilities)
2. [Helper Functions](#helper-functions)
3. [Notification System](#notification-system)
4. [Event Emitter](#event-emitter)
5. [Asset Naming](#asset-naming)
6. [Weapon Utilities](#weapon-utilities)
7. [Generation Config Builder](#generation-config-builder)
8. [Sprite Generator Client](#sprite-generator-client)

## API Utilities

### apiFetch

Enhanced fetch wrapper with timeout support and error handling.

**Location:** `src/utils/api.ts`

#### Interface

```typescript
interface RequestOptions extends RequestInit {
  timeoutMs?: number
}

async function apiFetch(
  input: string,
  init?: RequestOptions
): Promise<Response>
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| input | string | - | URL to fetch |
| init | RequestOptions | {} | Fetch options with timeout |
| init.timeoutMs | number | 15000 | Request timeout in milliseconds |

#### Returns

Standard `Response` object from fetch API

#### Example Usage

```typescript
import { apiFetch } from '@/utils/api'

// Basic GET request with default timeout (15s)
const response = await apiFetch('/api/assets')
const data = await response.json()

// POST request with custom timeout
const response = await apiFetch('/api/generation/pipeline', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(config),
  timeoutMs: 30000 // 30 second timeout
})

// Handling errors
try {
  const response = await apiFetch('/api/assets', { timeoutMs: 10000 })
  if (!response.ok) {
    throw new Error('Request failed')
  }
  const data = await response.json()
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('Request timed out')
  } else {
    console.error('Request failed:', error)
  }
}
```

#### Implementation Details

```typescript
export async function apiFetch(
  input: string,
  init: RequestOptions = {}
): Promise<Response> {
  const { timeoutMs = 15000, signal, ...rest } = init
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Timeout', 'AbortError')),
    timeoutMs
  )

  try {
    const response = await fetch(input, {
      ...rest,
      signal: signal ?? controller.signal
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}
```

#### Best Practices

1. **Use appropriate timeouts**: Quick operations (5-10s), generation pipelines (30s+)
2. **Check response.ok**: Always validate HTTP status codes
3. **Handle AbortError**: Catch timeout errors separately
4. **Cleanup**: Timeout is automatically cleared in finally block

## Helper Functions

### generateId

Generate unique identifiers for assets and operations.

**Location:** `src/utils/helpers.ts`

```typescript
function generateId(): string
```

**Example:**
```typescript
import { generateId } from '@/utils/helpers'

const assetId = generateId()
// Returns: "1705318200000-abc123def"

const pipelineId = `pipe_${generateId()}`
// Returns: "pipe_1705318200000-abc123def"
```

**Format:** `{timestamp}-{random9chars}`

### sleep

Async delay utility for testing and rate limiting.

```typescript
function sleep(ms: number): Promise<void>
```

**Example:**
```typescript
import { sleep } from '@/utils/helpers'

// Wait 2 seconds
await sleep(2000)

// Rate limiting
for (const item of items) {
  await processItem(item)
  await sleep(1000) // 1 second between items
}
```

### retry

Retry failed operations with exponential backoff.

```typescript
async function retry<T>(
  fn: () => Promise<T>,
  maxRetries?: number,
  initialDelay?: number
): Promise<T>
```

**Parameters:**
- `fn`: Async function to retry
- `maxRetries`: Maximum attempts (default: 3)
- `initialDelay`: Initial delay in ms (default: 1000)

**Backoff:** Exponential (delay × 2^attempt)

**Example:**
```typescript
import { retry } from '@/utils/helpers'

// Retry API call
const data = await retry(
  async () => {
    const response = await apiFetch('/api/assets')
    if (!response.ok) throw new Error('Failed')
    return response.json()
  },
  3, // Max 3 retries
  1000 // Start with 1s delay
)

// Retry with custom logic
const result = await retry(
  async () => {
    const status = await checkPipelineStatus(pipelineId)
    if (status === 'failed') throw new Error('Pipeline failed')
    if (status !== 'completed') throw new Error('Not ready')
    return status
  },
  5,
  2000
)
```

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: 1s delay
- Attempt 3: 2s delay
- Attempt 4: 4s delay

### formatBytes

Convert byte counts to human-readable strings.

```typescript
function formatBytes(bytes: number): string
```

**Example:**
```typescript
import { formatBytes } from '@/utils/helpers'

formatBytes(1024) // "1 KB"
formatBytes(1048576) // "1 MB"
formatBytes(5242880) // "5 MB"
formatBytes(1073741824) // "1 GB"
```

### createProgressBar

Generate ASCII progress bars for console output.

```typescript
function createProgressBar(
  current: number,
  total: number,
  width?: number
): string
```

**Example:**
```typescript
import { createProgressBar } from '@/utils/helpers'

console.log(createProgressBar(45, 100))
// [=============                 ] 45%

console.log(createProgressBar(75, 100, 50))
// [=====================================             ] 75%

// Usage in progress callback
onProgress: (progress) => {
  console.log(createProgressBar(progress, 100))
}
```

### Asset Type Parsing

#### parseAssetType

Detect asset type from description.

```typescript
function parseAssetType(description: string): string
```

**Returns:** `weapon`, `armor`, `consumable`, `tool`, `building`, `resource`, `character`, or `decoration`

**Example:**
```typescript
import { parseAssetType } from '@/utils/helpers'

parseAssetType('A steel longsword') // "weapon"
parseAssetType('Iron platebody armor') // "armor"
parseAssetType('Health potion') // "consumable"
parseAssetType('Bronze pickaxe') // "tool"
parseAssetType('Bank building') // "building"
parseAssetType('Gold ore') // "resource"
parseAssetType('Goblin warrior') // "character"
parseAssetType('Decorative vase') // "decoration"
```

#### parseBuildingType

Detect specific building type.

```typescript
function parseBuildingType(description: string): string
```

**Returns:** `bank`, `store`, `house`, `temple`, `castle`, `guild`, `inn`, `tower`

**Example:**
```typescript
import { parseBuildingType } from '@/utils/helpers'

parseBuildingType('A medieval bank building') // "bank"
parseBuildingType('General store shop') // "store"
parseBuildingType('Player house') // "house"
```

#### parseWeaponType

Detect specific weapon type.

```typescript
function parseWeaponType(description: string): string | undefined
```

**Returns:** Weapon type or undefined if not detected

**Example:**
```typescript
import { parseWeaponType } from '@/utils/helpers'

parseWeaponType('Steel longsword') // "longsword"
parseWeaponType('Bronze battleaxe') // "battleaxe"
parseWeaponType('Oak shortbow') // "bow"
parseWeaponType('Magic staff') // "staff"
```

### Material Tier System

#### MATERIAL_TIERS

Predefined material tier definitions for RPG items.

```typescript
const MATERIAL_TIERS: {
  bronze: MaterialTier
  steel: MaterialTier
  mithril: MaterialTier
  wood: MaterialTier
  oak: MaterialTier
  willow: MaterialTier
  leather: MaterialTier
}

interface MaterialTier {
  name: string
  level: number
  description: string
  color: string
  rarity: 'common' | 'uncommon' | 'rare'
  adjectives: string[]
}
```

**Example:**
```typescript
import { MATERIAL_TIERS } from '@/utils/helpers'

const bronze = MATERIAL_TIERS.bronze
// {
//   name: 'Bronze',
//   level: 1,
//   description: 'Basic bronze metal with copper-brown coloring',
//   color: '#CD7F32',
//   rarity: 'common',
//   adjectives: ['simple', 'basic', 'crude', 'tarnished']
// }

const mithril = MATERIAL_TIERS.mithril
// {
//   name: 'Mithril',
//   level: 20,
//   description: 'Magical silvery-blue metal with glowing properties',
//   color: '#87CEEB',
//   rarity: 'rare',
//   adjectives: ['magical', 'shimmering', 'ethereal', 'enchanted']
// }
```

#### generateMaterialDescription

Generate material-specific item descriptions.

```typescript
function generateMaterialDescription(
  baseDescription: string,
  materialTier: keyof typeof MATERIAL_TIERS,
  itemType: 'weapon' | 'armor' | 'tool'
): string
```

**Example:**
```typescript
import { generateMaterialDescription, MATERIAL_TIERS } from '@/utils/helpers'

const desc = generateMaterialDescription(
  'A sharp longsword',
  'mithril',
  'weapon'
)
// "A sharp longsword with magical silvery-blue metal with glowing properties and glowing magical runes"

const armorDesc = generateMaterialDescription(
  'A sturdy helmet',
  'steel',
  'armor'
)
// "A sturdy helmet made from strong steel metal with silver-gray finish and professional craftsmanship"
```

#### generateTierBatch

Generate multiple variants of an item across material tiers.

```typescript
function generateTierBatch(
  baseItem: {
    name: string
    description: string
    type: string
    subtype?: string
    style?: string
    metadata?: Record<string, any>
  },
  materialTiers: (keyof typeof MATERIAL_TIERS)[],
  itemType: 'weapon' | 'armor' | 'tool'
): Array<typeof baseItem>
```

**Example:**
```typescript
import { generateTierBatch, MATERIAL_TIERS } from '@/utils/helpers'

const swordVariants = generateTierBatch(
  {
    name: 'Longsword',
    description: 'A sharp longsword',
    type: 'weapon',
    subtype: 'sword'
  },
  ['bronze', 'steel', 'mithril'],
  'weapon'
)

// Returns:
// [
//   {
//     name: 'Bronze Longsword',
//     description: 'A sharp longsword with basic bronze metal...',
//     type: 'weapon',
//     subtype: 'sword',
//     metadata: { tier: 'bronze', level: 1, rarity: 'common', color: '#CD7F32' }
//   },
//   {
//     name: 'Steel Longsword',
//     description: 'A sharp longsword with strong steel metal...',
//     type: 'weapon',
//     subtype: 'sword',
//     metadata: { tier: 'steel', level: 10, rarity: 'uncommon', color: '#C0C0C0' }
//   },
//   // ...
// ]

// Use in pipeline
const pipelineConfigs = swordVariants.map(variant => ({
  ...variant,
  enableRetexturing: true,
  materialPresets: [/* ... */]
}))
```

### Polycount Recommendations

```typescript
function getPolycountForType(type: string): number
```

**Returns:** Recommended polygon count for asset type

**Example:**
```typescript
import { getPolycountForType } from '@/utils/helpers'

getPolycountForType('weapon') // 5000
getPolycountForType('armor') // 8000
getPolycountForType('building') // 30000
getPolycountForType('character') // 15000
getPolycountForType('consumable') // 2000
```

## Notification System

### notify

Display toast notifications to users.

**Location:** `src/utils/notify.ts`

#### Interface

```typescript
interface NotifyOptions {
  durationMs?: number // Default: 3500
}

const notify = {
  info: (message: string, options?: NotifyOptions) => void
  success: (message: string, options?: NotifyOptions) => void
  warning: (message: string, options?: NotifyOptions) => void
  error: (message: string, options?: NotifyOptions) => void
}
```

#### Example Usage

```typescript
import { notify } from '@/utils/notify'

// Success notification
notify.success('Asset generated successfully!')

// Error notification
notify.error('Failed to load assets')

// Custom duration (5 seconds)
notify.info('Processing...', { durationMs: 5000 })

// Warning
notify.warning('Low disk space')

// Usage in async operations
try {
  const result = await generateAsset(config)
  notify.success(`Created ${result.name}`)
} catch (error) {
  notify.error(`Generation failed: ${error.message}`)
}
```

#### Styling

Notifications appear in the top-right corner with color-coded backgrounds:
- **Info**: Blue (#3b82f6)
- **Success**: Green (#10b981)
- **Warning**: Orange (#f59e0b)
- **Error**: Red (#ef4444)

## Event Emitter

### TypedEventEmitter

Type-safe event emitter for service communication.

**Location:** `src/utils/TypedEventEmitter.ts`

#### Interface

```typescript
class TypedEventEmitter<Events extends Record<PropertyKey, any>> {
  on<K extends keyof Events>(
    event: K,
    listener: (data: Events[K]) => void
  ): this

  off<K extends keyof Events>(
    event: K,
    listener: (data: Events[K]) => void
  ): this

  once<K extends keyof Events>(
    event: K,
    listener: (data: Events[K]) => void
  ): this

  emit<K extends keyof Events>(
    event: K,
    data: Events[K]
  ): boolean

  addListener<K extends keyof Events>(
    event: K,
    listener: (data: Events[K]) => void
  ): this

  removeListener<K extends keyof Events>(
    event: K,
    listener: (data: Events[K]) => void
  ): this
}
```

#### Example Usage

```typescript
import { TypedEventEmitter } from '@/utils/TypedEventEmitter'

// Define event types
interface AssetEvents {
  'created': { assetId: string; name: string }
  'updated': { assetId: string; changes: string[] }
  'deleted': { assetId: string }
  'error': { message: string; code?: string }
}

// Create typed emitter
class AssetManager extends TypedEventEmitter<AssetEvents> {
  createAsset(name: string) {
    const assetId = generateId()
    // Create asset...
    this.emit('created', { assetId, name })
  }

  deleteAsset(assetId: string) {
    // Delete asset...
    this.emit('deleted', { assetId })
  }
}

// Usage
const manager = new AssetManager()

// Type-safe event listeners
manager.on('created', ({ assetId, name }) => {
  console.log(`Asset created: ${name} (${assetId})`)
})

manager.on('error', ({ message, code }) => {
  console.error(`Error ${code}: ${message}`)
})

// One-time listener
manager.once('deleted', ({ assetId }) => {
  console.log('Asset deleted:', assetId)
})

// Remove listener
const handler = (data) => console.log(data)
manager.on('updated', handler)
manager.off('updated', handler)
```

## Asset Naming

### formatAssetName

Convert asset IDs to display names.

**Location:** `src/utils/formatAssetName.ts`

```typescript
function formatAssetName(name: string): string
```

**Example:**
```typescript
import { formatAssetName } from '@/utils/formatAssetName'

formatAssetName('bronze-sword-base') // "Bronze Sword (Base)"
formatAssetName('steel-platebody') // "Steel Platebody"
formatAssetName('oak-shortbow') // "Oak Shortbow"
formatAssetName('mithril-scimitar-base') // "Mithril Scimitar (Base)"
formatAssetName('') // "Unnamed Asset"
```

**Formatting Rules:**
1. Split by hyphens
2. Capitalize each word
3. Add "(Base)" suffix if ends with "-base"
4. Return "Unnamed Asset" for empty strings

## Weapon Utilities

### Weapon Constants and Functions

**Location:** `src/utils/weaponUtils.ts`

#### BONE_MAPPING

Bone name mappings for different rigging conventions.

```typescript
const BONE_MAPPING: Record<string, string[]> = {
  'Hand_R': ['Hand_R', 'mixamorig:RightHand', 'RightHand', 'hand_r', 'Bip01_R_Hand'],
  'Hand_L': ['Hand_L', 'mixamorig:LeftHand', 'LeftHand', 'hand_l', 'Bip01_L_Hand'],
  'Head': ['Head', 'mixamorig:Head', 'head', 'Bip01_Head'],
  'Spine2': ['Spine2', 'Spine02', 'mixamorig:Spine2', 'spine2', 'Bip01_Spine2', 'Chest', 'chest'],
  'Hips': ['Hips', 'mixamorig:Hips', 'hips', 'Bip01_Pelvis']
}
```

#### WEAPON_OFFSETS

Default position and rotation offsets for weapon types.

```typescript
const WEAPON_OFFSETS: Record<string, {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
}> = {
  sword: {
    position: { x: 0.076, y: 0.077, z: 0.028 },
    rotation: { x: 92, y: 0, z: 0 }
  },
  bow: {
    position: { x: 0.05, y: 0.1, z: 0 },
    rotation: { x: 0, y: 90, z: 0 }
  },
  // ...
}
```

#### calculateAvatarHeight

Calculate character height from 3D model.

```typescript
function calculateAvatarHeight(avatar: THREE.Object3D): number
```

**Example:**
```typescript
import { calculateAvatarHeight } from '@/utils/weaponUtils'

const height = calculateAvatarHeight(characterMesh)
console.log(`Character height: ${height.toFixed(2)}m`)
// Character height: 1.80m
```

#### calculateWeaponScale

Calculate appropriate weapon scale for character.

```typescript
function calculateWeaponScale(
  weapon: THREE.Object3D,
  avatar: THREE.Object3D,
  weaponType: string,
  avatarHeight: number
): number
```

**Example:**
```typescript
import { calculateWeaponScale } from '@/utils/weaponUtils'

const scale = calculateWeaponScale(
  swordMesh,
  characterMesh,
  'sword',
  1.8
)

swordMesh.scale.setScalar(scale)
```

**Scaling Rules:**
- Daggers: 25% of character height
- Swords/Axes: 55-72% based on character size
- Spears/Staves: 110% of character height
- Bows: 80% of character height

#### findBone

Find a bone in a character skeleton by name.

```typescript
function findBone(
  object: THREE.Object3D,
  boneName: string
): THREE.Bone | null
```

**Example:**
```typescript
import { findBone } from '@/utils/weaponUtils'

const rightHand = findBone(character, 'Hand_R')
if (rightHand) {
  weapon.position.copy(rightHand.position)
}
```

## Generation Config Builder

### buildGenerationConfig

Build complete generation pipeline configuration.

**Location:** `src/utils/generationConfigBuilder.ts`

```typescript
function buildGenerationConfig(
  options: BuildConfigOptions
): GenerationConfig
```

**Parameters:**
```typescript
interface BuildConfigOptions {
  assetName: string
  assetType: string
  description: string
  generationType?: 'item' | 'avatar'
  gameStyle: string
  customStyle?: string
  customGamePrompt?: string
  customAssetTypePrompt?: string
  enableRetexturing: boolean
  enableSprites: boolean
  enableRigging: boolean
  useGPT4Enhancement?: boolean
  characterHeight?: number
  quality?: 'standard' | 'high' | 'ultra'
  selectedMaterials: string[]
  materialPresets: MaterialPreset[]
  materialPromptOverrides: Record<string, string>
  materialPromptTemplates?: {
    runescape: string
    generic: string
  }
  gameStyleConfig?: {
    name: string
    base: string
    generation?: string
    enhanced?: string
  }
  referenceImageMode?: 'auto' | 'custom'
  referenceImageSource?: 'upload' | 'url' | null
  referenceImageUrl?: string | null
  referenceImageDataUrl?: string | null
}
```

**Example:**
```typescript
import { buildGenerationConfig } from '@/utils/generationConfigBuilder'

const config = buildGenerationConfig({
  assetName: 'Steel Longsword',
  assetType: 'weapon',
  description: 'A polished steel longsword',
  generationType: 'item',
  gameStyle: 'runescape',
  enableRetexturing: true,
  enableSprites: true,
  enableRigging: false,
  quality: 'high',
  selectedMaterials: ['bronze', 'steel', 'mithril'],
  materialPresets: [...],
  materialPromptOverrides: {},
  useGPT4Enhancement: true
})

// Start generation pipeline
const pipelineId = await client.startPipeline(config)
```

## Sprite Generator Client

### SpriteGeneratorClient

Client-side sprite generation coordinator.

**Location:** `src/utils/sprite-generator-client.ts`

#### Interface

```typescript
class SpriteGeneratorClient {
  async processPendingSprites(): Promise<void>
  async checkAndGenerateSprites(assetId: string): Promise<boolean>
  async generateSpritesForAsset(
    assetId: string,
    config?: {
      angles?: number
      resolution?: number
      backgroundColor?: string
    }
  ): Promise<Array<{ angle: number; imageUrl: string }>>
}
```

#### Example Usage

```typescript
import { spriteGeneratorClient } from '@/utils/sprite-generator-client'

// Process all pending sprites
await spriteGeneratorClient.processPendingSprites()

// Generate sprites for specific asset
const success = await spriteGeneratorClient.checkAndGenerateSprites(
  'bronze-sword-base'
)

// Generate sprites with custom config
const sprites = await spriteGeneratorClient.generateSpritesForAsset(
  'bronze-sword-base',
  {
    angles: 8,
    resolution: 512,
    backgroundColor: 'transparent'
  }
)

console.log(`Generated ${sprites.length} sprites`)
```

## Best Practices

### Import Organization

```typescript
// Group imports by category
import { apiFetch } from '@/utils/api'
import { generateId, retry, sleep } from '@/utils/helpers'
import { notify } from '@/utils/notify'
import { formatAssetName } from '@/utils/formatAssetName'
```

### Error Handling

```typescript
// Always handle errors in utility calls
try {
  const data = await retry(async () => {
    const response = await apiFetch('/api/assets', { timeoutMs: 10000 })
    if (!response.ok) throw new Error('Request failed')
    return response.json()
  })
  notify.success('Assets loaded')
} catch (error) {
  notify.error('Failed to load assets')
  console.error(error)
}
```

### Type Safety

```typescript
// Use TypedEventEmitter for type-safe events
interface MyEvents {
  'progress': { percent: number }
  'complete': { result: any }
}

class MyService extends TypedEventEmitter<MyEvents> {
  // TypeScript ensures correct event data types
}
```

### Notification Timing

```typescript
// Short notifications for quick operations
notify.success('Asset saved') // 3.5s default

// Longer notifications for important messages
notify.info('Processing large batch...', { durationMs: 10000 })
```

## Conclusion

Asset Forge's utility functions provide a robust foundation for common operations. All utilities follow TypeScript best practices with strong typing, error handling, and comprehensive documentation. Use these utilities to build reliable, maintainable features throughout the application.
