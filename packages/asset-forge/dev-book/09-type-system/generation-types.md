# Generation Pipeline Types

The Asset Forge generation pipeline provides a comprehensive type system for AI-powered 3D asset creation. This document covers all pipeline-related types including generation configuration, pipeline stages, results, material presets, sprite generation, and service configuration.

## Generation Pipeline Architecture

The generation pipeline follows a multi-stage approach:

```
GenerationConfig → Pipeline → Stages → Results
                     ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
Description     Generation     Post-Processing
  Stage           Stages          Stages
    ↓               ↓               ↓
Enhanced    ├─ Concept Art    ├─ Normalization
Description │  Generation     │
            ├─ 3D Model       ├─ Retexturing
            │  Generation     │
            ├─ Remeshing      ├─ Sprite Generation
            │                 │
            └─ Analysis       └─ Rigging
```

Each stage produces specific results tracked through the pipeline system.

## GenerationConfig Interface

The `GenerationConfig` interface defines all parameters for asset generation.

### Complete Interface Definition

```typescript
export interface GenerationConfig {
  name: string
  type: string  // Flexible to support any game type
  subtype: string
  description: string
  style?: string  // Flexible to support any art style
  quality?: 'standard' | 'high' | 'ultra'
  assetId?: string
  tier?: string
  metadata?: {
    creatureType?: string
    armorSlot?: string
    weaponType?: string
    buildingType?: string
    materialType?: string
    [key: string]: string | number | boolean | undefined
  }

  // Generation type
  generationType?: 'item' | 'avatar'

  // Optional user-provided reference image
  referenceImage?: {
    source: 'url' | 'data'
    url?: string
    dataUrl?: string
  }

  // Pipeline stages control
  enableGeneration?: boolean
  enableRetexturing?: boolean
  enableSprites?: boolean
  enableRigging?: boolean

  // Rigging options
  riggingOptions?: {
    heightMeters?: number
  }

  // Legacy fields for backward compatibility
  generateVariants?: boolean
  variantMaterials?: string[]
  generateSprites?: boolean

  // New configuration options
  materialPresets?: Array<{
    id: string
    name: string
    displayName: string
    category: string
    tier: number
    color: string
    stylePrompt: string
  }>
  spriteConfig?: {
    angles: number
    resolution: number
    backgroundColor: string
  }

  // Custom prompts
  customPrompts?: {
    gameStyle?: string
    assetType?: string
  }
}
```

### Basic Configuration

Minimal configuration for simple asset generation:

```typescript
const basicConfig: GenerationConfig = {
  name: 'Iron Sword',
  type: 'weapon',
  subtype: 'sword',
  description: 'A basic iron sword with leather-wrapped grip',
  style: 'low-poly',
  quality: 'standard'
}
```

### Full Configuration with All Options

```typescript
const fullConfig: GenerationConfig = {
  // Basic info
  name: 'Steel Longsword',
  type: 'weapon',
  subtype: 'longsword',
  description: 'An elegant steel longsword with ornate crossguard',
  style: 'low-poly',
  quality: 'high',
  assetId: 'steel_longsword_001',
  tier: '2',

  // Generation type
  generationType: 'item',

  // Additional metadata
  metadata: {
    weaponType: 'longsword',
    attackLevel: 15,
    strengthLevel: 10,
    materialType: 'steel'
  },

  // Reference image (optional)
  referenceImage: {
    source: 'url',
    url: 'https://example.com/reference/steel-sword.jpg'
  },

  // Pipeline control
  enableGeneration: true,
  enableRetexturing: true,
  enableSprites: true,
  enableRigging: false,

  // Material presets for variants
  materialPresets: [
    {
      id: 'bronze',
      name: 'bronze',
      displayName: 'Bronze',
      category: 'metal',
      tier: 1,
      color: '#CD7F32',
      stylePrompt: 'bronze metal texture, orange-brown color, slightly tarnished'
    },
    {
      id: 'iron',
      name: 'iron',
      displayName: 'Iron',
      category: 'metal',
      tier: 2,
      color: '#808080',
      stylePrompt: 'dark gray iron metal, rough surface, matte finish'
    }
  ],

  // Sprite generation config
  spriteConfig: {
    angles: 8,
    resolution: 512,
    backgroundColor: 'transparent'
  },

  // Custom prompts
  customPrompts: {
    gameStyle: 'fantasy RPG',
    assetType: 'melee weapon'
  }
}
```

### Reference Image Configuration

Provide custom reference images to bypass concept art generation:

```typescript
// URL-based reference
const urlReferenceConfig: GenerationConfig = {
  name: 'Custom Sword',
  type: 'weapon',
  subtype: 'sword',
  description: 'Sword based on reference image',
  referenceImage: {
    source: 'url',
    url: 'https://cdn.example.com/sword-reference.png'
  }
}

// Data URL reference (base64)
const dataReferenceConfig: GenerationConfig = {
  name: 'Custom Armor',
  type: 'armor',
  subtype: 'chest',
  description: 'Armor based on uploaded image',
  referenceImage: {
    source: 'data',
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...'
  }
}
```

### Character Rigging Configuration

Configure character generation with rigging:

```typescript
const characterConfig: GenerationConfig = {
  name: 'Knight Character',
  type: 'character',
  subtype: 'humanoid',
  description: 'A heavily armored knight in full plate armor',
  style: 'low-poly',
  quality: 'high',

  // Enable rigging pipeline
  generationType: 'avatar',
  enableRigging: true,

  // Rigging options
  riggingOptions: {
    heightMeters: 1.83  // Standard humanoid height
  },

  metadata: {
    creatureType: 'biped',
    armorLevel: 'heavy'
  }
}
```

### Pipeline Stage Control

Fine-grained control over which pipeline stages execute:

```typescript
// Full pipeline (default)
const fullPipeline: GenerationConfig = {
  name: 'Complete Asset',
  type: 'weapon',
  subtype: 'sword',
  description: 'Complete generation with all stages',
  enableGeneration: true,    // Generate base model
  enableRetexturing: true,   // Create material variants
  enableSprites: true,       // Generate sprite sheets
  enableRigging: false       // Skip rigging (not applicable)
}

// Base model only (no variants or sprites)
const baseOnly: GenerationConfig = {
  name: 'Base Model Only',
  type: 'weapon',
  subtype: 'axe',
  description: 'Generate base model without variants',
  enableGeneration: true,
  enableRetexturing: false,
  enableSprites: false,
  enableRigging: false
}

// Retexture existing model
const retextureOnly: GenerationConfig = {
  name: 'Retexture Existing',
  type: 'weapon',
  subtype: 'sword',
  description: 'Only retexture an existing base model',
  assetId: 'existing_sword_001',  // Reference existing asset
  enableGeneration: false,
  enableRetexturing: true,
  enableSprites: false,
  enableRigging: false,
  materialPresets: [/* material definitions */]
}
```

## PipelineStage Interface

The `PipelineStage` interface tracks individual stage execution:

```typescript
export interface PipelineStage {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  message?: string
  error?: string
  startTime?: Date
  endTime?: Date
}
```

### Pipeline Stage Types

Common stage IDs and their purposes:

| Stage ID | Name | Purpose |
|----------|------|---------|
| `description` | Description Enhancement | AI-enhanced description generation |
| `image` | Concept Art | DALL-E/Stable Diffusion image generation |
| `model` | 3D Model | Meshy AI 3D model generation |
| `remesh` | Remeshing | Polygon optimization and retopology |
| `analysis` | Asset Analysis | Type-specific analysis (hardpoints, etc.) |
| `normalization` | Normalization | Scale, origin, and orientation standardization |
| `retexturing` | Retexturing | Material variant generation |
| `sprites` | Sprite Generation | Multi-angle sprite rendering |
| `rigging` | Character Rigging | Skeleton and animation setup |

### Stage Status Progression

```typescript
// Initial state
const pendingStage: PipelineStage = {
  id: 'model',
  name: '3D Model Generation',
  status: 'pending',
  progress: 0
}

// Processing
const runningStage: PipelineStage = {
  id: 'model',
  name: '3D Model Generation',
  status: 'running',
  progress: 45,
  message: 'Generating 3D model from concept art...',
  startTime: new Date('2025-10-21T10:00:00Z')
}

// Completed
const completedStage: PipelineStage = {
  id: 'model',
  name: '3D Model Generation',
  status: 'completed',
  progress: 100,
  message: '3D model generated successfully',
  startTime: new Date('2025-10-21T10:00:00Z'),
  endTime: new Date('2025-10-21T10:03:45Z')
}

// Failed
const failedStage: PipelineStage = {
  id: 'model',
  name: '3D Model Generation',
  status: 'failed',
  progress: 65,
  message: 'Model generation failed',
  error: 'Meshy API timeout after 300 seconds',
  startTime: new Date('2025-10-21T10:00:00Z'),
  endTime: new Date('2025-10-21T10:05:00Z')
}
```

### Progress Tracking

Track stage progress with percentage values:

```typescript
function updateStageProgress(
  stage: PipelineStage,
  progress: number,
  message?: string
): PipelineStage {
  return {
    ...stage,
    progress: Math.min(100, Math.max(0, progress)),
    message: message || stage.message,
    status: stage.status === 'pending' ? 'running' : stage.status
  }
}

// Example usage
let stage = pendingStage
stage = updateStageProgress(stage, 25, 'Uploading concept art...')
stage = updateStageProgress(stage, 50, 'Processing 3D generation...')
stage = updateStageProgress(stage, 75, 'Optimizing mesh...')
stage = updateStageProgress(stage, 100, 'Complete')
```

## PipelineResult Interface

The `PipelineResult` interface represents complete pipeline execution:

```typescript
export interface PipelineResult {
  id: string
  config: GenerationConfig
  stages: PipelineStage[]
  baseAsset?: BaseAssetMetadata
  variants?: AssetMetadata[]
  sprites?: SpriteResult[]
  status: 'running' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
}
```

### Complete Pipeline Result Example

```typescript
const pipelineResult: PipelineResult = {
  id: 'pipeline_01945678-9abc-def0-1234-56789abcdef0',
  config: {
    name: 'Iron Sword',
    type: 'weapon',
    subtype: 'sword',
    description: 'A basic iron sword',
    enableGeneration: true,
    enableRetexturing: true,
    enableSprites: true
  },
  stages: [
    {
      id: 'description',
      name: 'Description Enhancement',
      status: 'completed',
      progress: 100,
      startTime: new Date('2025-10-21T10:00:00Z'),
      endTime: new Date('2025-10-21T10:00:15Z')
    },
    {
      id: 'image',
      name: 'Concept Art',
      status: 'completed',
      progress: 100,
      startTime: new Date('2025-10-21T10:00:15Z'),
      endTime: new Date('2025-10-21T10:01:00Z')
    },
    {
      id: 'model',
      name: '3D Model',
      status: 'completed',
      progress: 100,
      startTime: new Date('2025-10-21T10:01:00Z'),
      endTime: new Date('2025-10-21T10:05:00Z')
    }
  ],
  baseAsset: {
    id: 'iron_sword_001',
    name: 'Iron Sword',
    // ... full BaseAssetMetadata
  },
  variants: [
    {
      id: 'iron_sword_001_bronze',
      name: 'Bronze Sword',
      // ... full VariantAssetMetadata
    }
  ],
  sprites: [
    {
      angle: '0',
      imageUrl: '/sprites/iron_sword_001/angle_0.png',
      width: 512,
      height: 512
    },
    {
      angle: '45',
      imageUrl: '/sprites/iron_sword_001/angle_45.png',
      width: 512,
      height: 512
    }
  ],
  status: 'completed',
  createdAt: new Date('2025-10-21T10:00:00Z'),
  completedAt: new Date('2025-10-21T10:15:00Z')
}
```

### Pipeline Status Values

```typescript
export type PipelineStatus = 'running' | 'completed' | 'failed'
```

**running:** Pipeline is currently executing stages
**completed:** All stages completed successfully
**failed:** One or more stages failed

### Accessing Pipeline Results

```typescript
function analyzePipelineResult(result: PipelineResult): void {
  console.log(`Pipeline ${result.id}: ${result.status}`)

  // Check stage progress
  result.stages.forEach(stage => {
    console.log(`  ${stage.name}: ${stage.status} (${stage.progress}%)`)
    if (stage.error) {
      console.error(`    Error: ${stage.error}`)
    }
  })

  // Access generated assets
  if (result.baseAsset) {
    console.log(`Base asset: ${result.baseAsset.name}`)
    console.log(`  Model: ${result.baseAsset.modelPath}`)
  }

  if (result.variants && result.variants.length > 0) {
    console.log(`Variants: ${result.variants.length}`)
    result.variants.forEach(v => {
      console.log(`  - ${v.name}`)
    })
  }

  if (result.sprites && result.sprites.length > 0) {
    console.log(`Sprites: ${result.sprites.length} angles`)
  }

  // Calculate timing
  if (result.completedAt) {
    const duration = result.completedAt.getTime() - result.createdAt.getTime()
    console.log(`Total time: ${duration / 1000}s`)
  }
}
```

## GeneratedAsset Interface

Extended asset interface for UI display:

```typescript
export interface GeneratedAsset extends Asset {
  status: string
  pipelineId?: string
  modelUrl?: string
  conceptArtUrl?: string
  variants?: Asset[] | Array<{ name: string; modelUrl: string; id?: string }>
  hasSpriteMetadata?: boolean
  hasSprites?: boolean
  sprites?: Array<{ angle: number; imageUrl: string }> | null
  createdAt?: string
  modelFile?: string
}
```

### UI Asset Display

```typescript
const uiAsset: GeneratedAsset = {
  // Base Asset properties
  id: 'iron_sword_001',
  name: 'Iron Sword',
  type: 'weapon',
  subtype: 'sword',
  description: 'A basic iron sword',

  // Generation tracking
  status: 'completed',
  pipelineId: 'pipeline_01945678-9abc-def0-1234-56789abcdef0',

  // URLs for display
  modelUrl: '/models/iron_sword_001/model.glb',
  conceptArtUrl: '/models/iron_sword_001/concept.png',

  // Variants
  variants: [
    {
      id: 'iron_sword_001_bronze',
      name: 'Bronze Sword',
      modelUrl: '/models/iron_sword_001_bronze/model.glb'
    },
    {
      id: 'iron_sword_001_steel',
      name: 'Steel Sword',
      modelUrl: '/models/iron_sword_001_steel/model.glb'
    }
  ],

  // Sprites
  hasSprites: true,
  hasSpriteMetadata: true,
  sprites: [
    { angle: 0, imageUrl: '/sprites/iron_sword_001/angle_0.png' },
    { angle: 45, imageUrl: '/sprites/iron_sword_001/angle_45.png' },
    { angle: 90, imageUrl: '/sprites/iron_sword_001/angle_90.png' },
    { angle: 135, imageUrl: '/sprites/iron_sword_001/angle_135.png' },
    { angle: 180, imageUrl: '/sprites/iron_sword_001/angle_180.png' },
    { angle: 225, imageUrl: '/sprites/iron_sword_001/angle_225.png' },
    { angle: 270, imageUrl: '/sprites/iron_sword_001/angle_270.png' },
    { angle: 315, imageUrl: '/sprites/iron_sword_001/angle_315.png' }
  ],

  // Timestamps
  createdAt: '2025-10-21T10:00:00Z',
  modelFile: 'model.glb'
}
```

## CustomMaterial Type

Define custom materials for generation:

```typescript
export interface CustomMaterial {
  name: string
  prompt: string
  color?: string
  displayName?: string
}
```

### Material Examples

```typescript
const bronzeMaterial: CustomMaterial = {
  name: 'bronze',
  displayName: 'Bronze',
  prompt: 'bronze metal texture, orange-brown color, slightly tarnished patina',
  color: '#CD7F32'
}

const steelMaterial: CustomMaterial = {
  name: 'steel',
  displayName: 'Steel',
  prompt: 'polished steel metal, bright silver, highly reflective surface',
  color: '#C0C0C0'
}

const mithrilMaterial: CustomMaterial = {
  name: 'mithril',
  displayName: 'Mithril',
  prompt: 'magical silver-blue metal, ethereal glow, ultra-light appearance',
  color: '#D4F1F4'
}

const woodMaterial: CustomMaterial = {
  name: 'oak',
  displayName: 'Oak Wood',
  prompt: 'rich oak wood grain, deep brown color, natural texture',
  color: '#8B4513'
}
```

### Using Custom Materials

```typescript
const config: GenerationConfig = {
  name: 'Wooden Sword',
  type: 'weapon',
  subtype: 'sword',
  description: 'A training sword made of oak wood',

  // Use custom material in prompt
  customPrompts: {
    gameStyle: 'fantasy RPG',
    assetType: 'wooden training weapon'
  },

  // Or apply to variants
  materialPresets: [
    {
      id: 'oak',
      name: 'oak',
      displayName: 'Oak Wood',
      category: 'wood',
      tier: 0,
      color: '#8B4513',
      stylePrompt: 'rich oak wood grain, deep brown color, natural texture'
    }
  ]
}
```

## CustomAssetType Type

Define custom asset type prompts:

```typescript
export interface CustomAssetType {
  name: string
  prompt: string
}
```

### Custom Asset Type Examples

```typescript
const dragonWeapon: CustomAssetType = {
  name: 'dragon-sword',
  prompt: 'A sword forged from dragon scales and bone, with fire-themed decorations'
}

const magicStaff: CustomAssetType = {
  name: 'elemental-staff',
  prompt: 'A mystical staff channeling elemental magic, with glowing crystal orb'
}

const demonicArmor: CustomAssetType = {
  name: 'demon-plate',
  prompt: 'Dark armor with demonic motifs, spikes, and glowing red runes'
}
```

### Using Custom Asset Types

```typescript
const config: GenerationConfig = {
  name: 'Dragon Blade',
  type: 'weapon',
  subtype: 'sword',
  description: dragonWeapon.prompt,
  customPrompts: {
    gameStyle: 'dark fantasy',
    assetType: dragonWeapon.name
  }
}
```

## SpriteResult Type

Sprite generation results:

```typescript
export interface SpriteResult {
  angle: string
  imageUrl: string
  width: number
  height: number
}
```

### Sprite Configuration

```typescript
const spriteConfig = {
  angles: 8,              // Number of rotation angles
  resolution: 512,        // Image resolution (512x512)
  backgroundColor: 'transparent'  // Background color
}
```

### Complete Sprite Set Example

```typescript
const spriteResults: SpriteResult[] = [
  {
    angle: '0',
    imageUrl: '/sprites/iron_sword_001/angle_0.png',
    width: 512,
    height: 512
  },
  {
    angle: '45',
    imageUrl: '/sprites/iron_sword_001/angle_45.png',
    width: 512,
    height: 512
  },
  {
    angle: '90',
    imageUrl: '/sprites/iron_sword_001/angle_90.png',
    width: 512,
    height: 512
  },
  {
    angle: '135',
    imageUrl: '/sprites/iron_sword_001/angle_135.png',
    width: 512,
    height: 512
  },
  {
    angle: '180',
    imageUrl: '/sprites/iron_sword_001/angle_180.png',
    width: 512,
    height: 512
  },
  {
    angle: '225',
    imageUrl: '/sprites/iron_sword_001/angle_225.png',
    width: 512,
    height: 512
  },
  {
    angle: '270',
    imageUrl: '/sprites/iron_sword_001/angle_270.png',
    width: 512,
    height: 512
  },
  {
    angle: '315',
    imageUrl: '/sprites/iron_sword_001/angle_315.png',
    width: 512,
    height: 512
  }
]
```

### Sprite Usage Patterns

```typescript
// Get sprite for specific angle
function getSpriteForAngle(
  sprites: SpriteResult[],
  targetAngle: number
): SpriteResult | undefined {
  return sprites.find(s => parseInt(s.angle) === targetAngle)
}

// Get nearest sprite for arbitrary angle
function getNearestSprite(
  sprites: SpriteResult[],
  angle: number
): SpriteResult {
  const normalized = ((angle % 360) + 360) % 360
  const sorted = [...sprites].sort((a, b) => {
    const aDiff = Math.abs(parseInt(a.angle) - normalized)
    const bDiff = Math.abs(parseInt(b.angle) - normalized)
    return aDiff - bDiff
  })
  return sorted[0]!
}

// Example usage
const sprite0 = getSpriteForAngle(spriteResults, 0)
const sprite45 = getNearestSprite(spriteResults, 47)  // Gets 45-degree sprite
```

## MaterialPreset Interface

Complete material preset definition:

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

### Material Preset Categories

Common material categories:

- **metal:** Bronze, Iron, Steel, Mithril, Adamantite
- **wood:** Oak, Maple, Ebony, Mahogany
- **stone:** Granite, Marble, Obsidian
- **magical:** Elemental, Enchanted, Corrupted
- **organic:** Leather, Bone, Scale

### Complete Material Preset Examples

```typescript
const materialPresets: MaterialPreset[] = [
  // Tier 1 - Bronze
  {
    id: 'bronze',
    name: 'bronze',
    displayName: 'Bronze',
    category: 'metal',
    tier: 1,
    color: '#CD7F32',
    stylePrompt: 'bronze metal texture, orange-brown color, slightly tarnished',
    description: 'Basic bronze material for low-tier equipment'
  },

  // Tier 2 - Iron
  {
    id: 'iron',
    name: 'iron',
    displayName: 'Iron',
    category: 'metal',
    tier: 2,
    color: '#808080',
    stylePrompt: 'dark gray iron metal, rough surface, matte finish',
    description: 'Standard iron material for mid-tier equipment'
  },

  // Tier 3 - Steel
  {
    id: 'steel',
    name: 'steel',
    displayName: 'Steel',
    category: 'metal',
    tier: 3,
    color: '#C0C0C0',
    stylePrompt: 'polished steel metal, bright silver, reflective surface',
    description: 'High-quality steel for advanced equipment'
  },

  // Tier 4 - Mithril
  {
    id: 'mithril',
    name: 'mithril',
    displayName: 'Mithril',
    category: 'metal',
    tier: 4,
    color: '#D4F1F4',
    stylePrompt: 'magical silver-blue metal, ethereal glow, lightweight appearance',
    description: 'Rare magical metal for elite equipment'
  },

  // Wood materials
  {
    id: 'oak',
    name: 'oak',
    displayName: 'Oak',
    category: 'wood',
    tier: 1,
    color: '#8B4513',
    stylePrompt: 'rich oak wood grain, deep brown color, natural texture',
    description: 'Common oak wood for basic items'
  },

  // Stone materials
  {
    id: 'granite',
    name: 'granite',
    displayName: 'Granite',
    category: 'stone',
    tier: 2,
    color: '#4A4A4A',
    stylePrompt: 'speckled granite stone, gray with black flecks, rough texture',
    description: 'Durable granite stone'
  }
]
```

## PipelineServiceConfig Interface

Service-level configuration:

```typescript
export interface PipelineServiceConfig {
  openaiApiKey?: string
  meshyApiKey?: string
  imageServerBaseUrl?: string
}
```

### Service Configuration Example

```typescript
const serviceConfig: PipelineServiceConfig = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  meshyApiKey: process.env.MESHY_API_KEY,
  imageServerBaseUrl: process.env.IMAGE_SERVER_URL || 'https://api.openai.com/v1'
}

// Initialize service
const pipelineService = new GenerationPipelineService(serviceConfig)
```

## Generation Workflows

### Complete Weapon Generation

```typescript
async function generateWeaponWithVariants(
  weaponSpec: {
    name: string
    description: string
    subtype: WeaponType
  },
  materials: MaterialPreset[]
): Promise<PipelineResult> {
  const config: GenerationConfig = {
    name: weaponSpec.name,
    type: 'weapon',
    subtype: weaponSpec.subtype,
    description: weaponSpec.description,
    style: 'low-poly',
    quality: 'high',

    // Enable all stages
    enableGeneration: true,
    enableRetexturing: true,
    enableSprites: true,

    // Material variants
    materialPresets: materials.map(m => ({
      id: m.id,
      name: m.name,
      displayName: m.displayName,
      category: m.category,
      tier: m.tier,
      color: m.color,
      stylePrompt: m.stylePrompt!
    })),

    // Sprite configuration
    spriteConfig: {
      angles: 8,
      resolution: 512,
      backgroundColor: 'transparent'
    }
  }

  const result = await pipelineService.generateAsset(config)
  return result
}

// Usage
const result = await generateWeaponWithVariants(
  {
    name: 'Longsword',
    description: 'An elegant longsword with ornate crossguard',
    subtype: 'longsword'
  },
  [bronzeMaterial, ironMaterial, steelMaterial, mithrilMaterial]
)
```

### Character Generation with Rigging

```typescript
async function generateRiggedCharacter(
  characterSpec: {
    name: string
    description: string
    height: number
  }
): Promise<PipelineResult> {
  const config: GenerationConfig = {
    name: characterSpec.name,
    type: 'character',
    subtype: 'humanoid',
    description: characterSpec.description,
    style: 'low-poly',
    quality: 'high',
    generationType: 'avatar',

    // Enable rigging
    enableGeneration: true,
    enableRigging: true,

    // Rigging options
    riggingOptions: {
      heightMeters: characterSpec.height
    },

    metadata: {
      creatureType: 'biped'
    }
  }

  const result = await pipelineService.generateAsset(config)
  return result
}

// Usage
const character = await generateRiggedCharacter({
  name: 'Knight',
  description: 'A fully armored knight in plate mail',
  height: 1.83
})
```

### Retexture Existing Asset

```typescript
async function retextureAsset(
  baseAssetId: string,
  materials: MaterialPreset[]
): Promise<PipelineResult> {
  const config: GenerationConfig = {
    name: 'Retextured Variants',
    type: 'weapon',  // Will be inherited from base asset
    subtype: 'sword',
    description: 'Material variants of existing asset',

    // Reference existing asset
    assetId: baseAssetId,

    // Only retexture, don't regenerate
    enableGeneration: false,
    enableRetexturing: true,
    enableSprites: true,

    // New materials
    materialPresets: materials.map(m => ({
      id: m.id,
      name: m.name,
      displayName: m.displayName,
      category: m.category,
      tier: m.tier,
      color: m.color,
      stylePrompt: m.stylePrompt!
    }))
  }

  const result = await pipelineService.generateAsset(config)
  return result
}

// Usage
const variants = await retextureAsset(
  'iron_sword_001',
  [mithrilMaterial, adamantiteMaterial]
)
```

## Pipeline Progress Tracking

### Real-time Progress Updates

```typescript
interface ProgressUpdate {
  pipelineId: string
  stage: PipelineStage
  overallProgress: number
}

function calculateOverallProgress(stages: PipelineStage[]): number {
  const totalWeight = stages.length
  const weightedProgress = stages.reduce(
    (sum, stage) => sum + (stage.progress / 100),
    0
  )
  return (weightedProgress / totalWeight) * 100
}

function trackPipelineProgress(
  result: PipelineResult,
  onProgress: (update: ProgressUpdate) => void
): void {
  const interval = setInterval(() => {
    const currentStage = result.stages.find(s => s.status === 'running')

    if (currentStage) {
      onProgress({
        pipelineId: result.id,
        stage: currentStage,
        overallProgress: calculateOverallProgress(result.stages)
      })
    }

    if (result.status === 'completed' || result.status === 'failed') {
      clearInterval(interval)
    }
  }, 1000)
}
```

### Stage Timing Analysis

```typescript
function analyzeStageTiming(stages: PipelineStage[]): void {
  console.log('Pipeline Stage Timing:')
  console.log('─'.repeat(60))

  let totalDuration = 0

  stages.forEach(stage => {
    if (stage.startTime && stage.endTime) {
      const duration = stage.endTime.getTime() - stage.startTime.getTime()
      totalDuration += duration
      console.log(`${stage.name.padEnd(30)} ${(duration / 1000).toFixed(2)}s`)
    }
  })

  console.log('─'.repeat(60))
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`)
}
```

## Error Handling

### Pipeline Error Types

```typescript
interface PipelineError {
  stage: string
  error: string
  code?: string
  recoverable: boolean
}

function handlePipelineError(error: PipelineError): void {
  console.error(`Pipeline error in ${error.stage}: ${error.error}`)

  if (error.recoverable) {
    console.log('Attempting recovery...')
    // Retry logic
  } else {
    console.error('Fatal error - pipeline cannot continue')
    // Cleanup and abort
  }
}
```

### Common Error Scenarios

```typescript
// Meshy API timeout
const meshyTimeout: PipelineError = {
  stage: 'model',
  error: 'Meshy API timeout after 300 seconds',
  code: 'MESHY_TIMEOUT',
  recoverable: true
}

// Invalid reference image
const invalidImage: PipelineError = {
  stage: 'image',
  error: 'Reference image URL is not accessible',
  code: 'IMAGE_FETCH_ERROR',
  recoverable: false
}

// Rigging failure
const riggingFailed: PipelineError = {
  stage: 'rigging',
  error: 'Unable to detect humanoid skeleton',
  code: 'RIGGING_DETECTION_FAILED',
  recoverable: false
}
```

## Summary

The Asset Forge generation pipeline type system provides:

- **Comprehensive configuration** through GenerationConfig
- **Fine-grained stage tracking** with PipelineStage
- **Complete result representation** via PipelineResult
- **Material preset system** for efficient retexturing
- **Sprite generation** with multi-angle rendering
- **Custom materials and asset types** for flexibility
- **Progress tracking** and error handling
- **Service configuration** for API integration

This type architecture enables sophisticated multi-stage asset generation workflows with full type safety, progress tracking, and error handling throughout the entire pipeline execution.
