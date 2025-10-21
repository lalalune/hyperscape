# Retexturing

[← Back to Index](../README.md)

---

## Meshy Retexture API

Asset Forge uses Meshy.ai's retexture API to generate material variants of base models. This enables rapid creation of multiple versions (bronze sword, iron sword, steel sword) from a single 3D model, maintaining geometry while changing materials and textures.

---

## Overview

### Purpose

Generate multiple material variants from a single base 3D model without re-running the complete generation pipeline.

### Key Benefits

1. **Speed**: 5-10 minutes vs 20+ minutes for full generation
2. **Cost**: Lower than full image-to-3D
3. **Consistency**: Identical geometry across variants
4. **Quality**: PBR materials with style consistency

### Use Cases

- **Weapon tiers**: Bronze → Iron → Steel → Mithril
- **Armor materials**: Leather → Chain → Plate
- **Color variants**: Red potion → Blue potion → Green potion
- **Material types**: Wood → Stone → Metal versions

---

## Retexture API Workflow

### Complete Flow

```
1. Base Model Generated
         ↓
2. Save meshyTaskId
         ↓
3. Define Material Variants
         ↓
4. Submit Retexture Task (per variant)
         ↓
5. Poll Task Status
         ↓
6. Download Retextured GLB
         ↓
7. Save as Variant Asset
```

### Prerequisites

**Required:**
- Base model's `meshyTaskId` (from image-to-3D)
- Material preset or custom style prompt
- Original model successfully generated

**Not Required:**
- New image generation
- New concept art
- New 3D conversion

---

## Retexture Endpoint

### API Endpoint

```
POST https://api.meshy.ai/v2/retexture
```

### Request Parameters

```typescript
interface RetextureRequest {
  // Base Model Reference
  model_url?: string              // GLB URL (option 1)
  input_task_id?: string          // Original task ID (option 2, recommended)

  // Material Configuration
  text_style_prompt: string       // Material description
  art_style?: 'realistic' | 'anime' | 'low-poly' | 'hand-painted'

  // Quality (inherits from base model)
  enable_pbr?: boolean            // Generate PBR textures
  texture_resolution?: number     // 1024, 2048, or 4096

  // Advanced
  seed?: number                   // For reproducibility
  negative_prompt?: string        // What to avoid
}
```

### Asset Forge Configuration

```typescript
interface RetextureConfig {
  baseModelTaskId: string         // CRITICAL: Original meshyTaskId
  materialPreset: MaterialPreset   // Material definition
  artStyle: 'realistic'           // Asset Forge always uses realistic
}

interface MaterialPreset {
  id: string                      // "bronze", "iron", "steel"
  name: string                    // Display name
  displayName: string             // UI display
  category: string                // "metal", "wood", "cloth"
  tier: number                    // 1-10 progression
  color: string                   // UI color
  stylePrompt: string             // Meshy prompt
}
```

### Example Request

```typescript
async function retextureModel(
  baseTaskId: string,
  material: MaterialPreset
): Promise<string> {
  const response = await fetch('https://api.meshy.ai/v2/retexture', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MESHY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input_task_id: baseTaskId,
      text_style_prompt: material.stylePrompt,
      art_style: 'realistic',
      enable_pbr: true
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Retexture API error: ${error.message || 'Unknown error'}`)
  }

  const data = await response.json()
  return data.id  // Retexture task ID
}
```

### Response Format

```typescript
interface RetextureResponse {
  id: string                    // Task ID
  status: 'PENDING'             // Initial status
  created_at: number            // Unix timestamp
}
```

---

## Style Prompt Application

### Material Prompt Structure

**Template:**
```
"${materialName} texture, ${additionalDetails}, ${styleGuide}"
```

**Example Templates:**

**RuneScape Style:**
```typescript
const runescapeTemplate = (material: string) =>
  `${material} texture, low-poly RuneScape style, vibrant colors, simple shading`
```

**Generic Style:**
```typescript
const genericTemplate = (material: string) =>
  `${material} texture, game asset quality, PBR materials`
```

**Realistic Style:**
```typescript
const realisticTemplate = (material: string) =>
  `${material} texture, realistic PBR materials, high detail, photorealistic`
```

### Material-Specific Prompts

#### Metals

**Bronze:**
```
"Bronze texture, low-poly RuneScape style,
warm orange-brown metal with slight patina,
simple shading, game asset quality"
```

**Iron:**
```
"Iron texture, low-poly RuneScape style,
dark gray metallic surface with minimal rust,
simple shading, game asset quality"
```

**Steel:**
```
"Steel texture, low-poly RuneScape style,
bright silver-gray polished metal,
simple shading, game asset quality"
```

**Mithril:**
```
"Mithril texture, low-poly RuneScape style,
light blue-silver magical metal with subtle glow,
simple shading, game asset quality"
```

**Adamant:**
```
"Adamant texture, low-poly RuneScape style,
dark green metallic surface,
simple shading, game asset quality"
```

**Rune:**
```
"Rune texture, low-poly RuneScape style,
cyan-blue magical metal with mystical appearance,
simple shading, game asset quality"
```

#### Armor Materials

**Leather:**
```
"Leather armor texture, brown leather with visible texture,
worn and weathered, game asset quality"
```

**Chainmail:**
```
"Chainmail armor texture, interlocking metal rings,
silver-gray metallic, detailed chain pattern"
```

**Plate:**
```
"Plate armor texture, solid metal plates,
polished steel with slight wear, heavy armor appearance"
```

#### Wood Types

**Oak:**
```
"Oak wood texture, medium brown with visible grain,
natural wood finish, game asset quality"
```

**Pine:**
```
"Pine wood texture, light yellow-brown with knots,
soft wood appearance, natural finish"
```

**Mahogany:**
```
"Mahogany wood texture, rich reddish-brown,
fine grain, polished finish"
```

### Prompt Best Practices

**DO:**
- Be specific about material type
- Include color description
- Mention texture characteristics
- Specify style (RuneScape, realistic, etc.)
- Keep prompts concise (< 200 characters)

**DON'T:**
- Change geometry ("add spikes", "make bigger")
- Request new features ("add gems", "add engravings")
- Be too vague ("make it cool", "better looking")
- Use negative prompts extensively

---

## Material Preset System

### Default Material Presets

**Location**: `/Users/home/hyperscape-1/packages/asset-forge/public/prompts/material-presets.json`

### Preset Structure

```typescript
interface MaterialPreset {
  id: string                    // Unique identifier
  name: string                  // Internal name
  displayName: string           // UI display name
  category: string              // "metal", "wood", "cloth", "stone"
  tier: number                  // 1-10 (progression order)
  color: string                 // Hex color for UI
  stylePrompt: string           // Meshy retexture prompt
  icon?: string                 // Optional icon
  rarity?: string               // "common", "rare", "legendary"
}
```

### Example Presets

```json
{
  "weapon_metals": [
    {
      "id": "bronze",
      "name": "Bronze",
      "displayName": "Bronze",
      "category": "metal",
      "tier": 1,
      "color": "#CD7F32",
      "stylePrompt": "Bronze texture, low-poly RuneScape style, warm orange-brown metal"
    },
    {
      "id": "iron",
      "name": "Iron",
      "displayName": "Iron",
      "category": "metal",
      "tier": 2,
      "color": "#7F7F7F",
      "stylePrompt": "Iron texture, low-poly RuneScape style, dark gray metallic surface"
    },
    {
      "id": "steel",
      "name": "Steel",
      "displayName": "Steel",
      "category": "metal",
      "tier": 3,
      "color": "#C0C0C0",
      "stylePrompt": "Steel texture, low-poly RuneScape style, bright silver-gray polished metal"
    }
  ]
}
```

### Loading Presets

```typescript
import { PromptService } from '@/services/api/PromptService'

async function loadMaterialPresets(): Promise<MaterialPreset[]> {
  const templates = await PromptService.getMaterialPrompts()

  // Convert templates to presets
  const presets: MaterialPreset[] = []

  for (const [id, template] of Object.entries(templates.templates)) {
    if (id === 'runescape' || id === 'generic') continue

    presets.push({
      id,
      name: capitalize(id),
      displayName: capitalize(id),
      category: getCategoryFromId(id),
      tier: getTierFromId(id),
      color: getColorFromId(id),
      stylePrompt: template
    })
  }

  return presets
}
```

### Custom Presets

```typescript
async function createCustomPreset(preset: MaterialPreset): Promise<void> {
  const templates = await PromptService.getMaterialPrompts()

  templates.customOverrides[preset.id] = preset.stylePrompt

  await PromptService.saveMaterialPrompts(templates)
}

// Example
await createCustomPreset({
  id: 'dragon',
  name: 'Dragon',
  displayName: 'Dragon Scale',
  category: 'exotic',
  tier: 10,
  color: '#8B0000',
  stylePrompt: 'Dragon scale texture with iridescent sheen, dark red with green highlights, RuneScape style'
})
```

---

## Variant Creation Process

### Single Variant

```typescript
async function createVariant(
  baseAssetId: string,
  baseTaskId: string,
  material: MaterialPreset
): Promise<string> {
  // 1. Start retexture task
  const taskId = await retextureModel(baseTaskId, material)
  console.log(`Retexture task started: ${taskId}`)

  // 2. Poll for completion
  const result = await pollRetextureStatus(taskId)
  console.log(`Retexture completed: ${result.modelUrl}`)

  // 3. Generate variant ID
  const variantId = `${baseAssetId}-${material.id}`

  // 4. Download variant model
  const variantPath = path.join(ASSETS_DIR, variantId, 'model.glb')
  await downloadModel(result.modelUrl, variantPath)

  // 5. Save variant metadata
  await saveVariantMetadata(variantId, {
    parentBaseModel: baseAssetId,
    baseModelTaskId: baseTaskId,
    retextureTaskId: taskId,
    materialPreset: material,
    retextureMethod: 'meshy-retexture',
    retextureStatus: 'completed',
    isVariant: true,
    isBaseModel: false,
    modelPath: variantPath,
    generatedAt: new Date().toISOString()
  })

  // 6. Update base model's variant list
  await addVariantToBase(baseAssetId, variantId)

  return variantId
}
```

### Batch Variant Generation

```typescript
async function createAllVariants(
  baseAssetId: string,
  baseTaskId: string,
  materials: MaterialPreset[]
): Promise<string[]> {
  const variantIds: string[] = []

  for (const material of materials) {
    try {
      console.log(`Creating ${material.name} variant...`)

      const variantId = await createVariant(baseAssetId, baseTaskId, material)
      variantIds.push(variantId)

      console.log(`✓ ${material.name} variant created: ${variantId}`)

      // Rate limiting: wait between variants
      await sleep(5000)

    } catch (error) {
      console.error(`✗ Failed to create ${material.name} variant:`, error)
      // Continue with other variants
    }
  }

  return variantIds
}

// Usage
const weaponMaterials = [
  bronzePreset,
  ironPreset,
  steelPreset,
  mithrilPreset
]

const variants = await createAllVariants(
  'sword-base-123',
  'meshy-task-456',
  weaponMaterials
)

console.log(`Created ${variants.length} variants`)
```

### Parallel Variant Generation

```typescript
async function createVariantsParallel(
  baseAssetId: string,
  baseTaskId: string,
  materials: MaterialPreset[],
  concurrency: number = 3
): Promise<string[]> {
  const results: string[] = []

  // Process in batches
  for (let i = 0; i < materials.length; i += concurrency) {
    const batch = materials.slice(i, i + concurrency)

    const batchResults = await Promise.allSettled(
      batch.map(material =>
        createVariant(baseAssetId, baseTaskId, material)
      )
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        console.error('Variant creation failed:', result.reason)
      }
    }

    // Wait between batches
    if (i + concurrency < materials.length) {
      await sleep(5000)
    }
  }

  return results
}
```

---

## UV Preservation

### What is UV Mapping?

**UV Mapping**: 2D coordinate system that maps 3D model surface to 2D texture image.

**Importance:**
- Determines how textures wrap around model
- Critical for proper material application
- Must be preserved across retextures

### How Meshy Preserves UVs

When using `input_task_id`:
1. Original UV layout is maintained
2. New textures map to same coordinates
3. Geometry remains identical
4. Only pixel data changes

### Why This Matters

**Consistent UVs enable:**
- Predictable material application
- No seams or stretching differences
- Identical appearance except color/material
- Easier to create texture packs

### UV Layout Example

```
Original Model UV Layout:
┌─────────────┐
│   Head      │  0.0-0.5, 0.5-1.0
├─────────────┤
│   Body      │  0.0-1.0, 0.0-0.5
├──────┬──────┤
│ Arm  │ Arm  │  Left: 0.0-0.25, 0.5-0.75
└──────┴──────┘  Right: 0.75-1.0, 0.5-0.75

All variants use SAME layout
Only texture pixels change
```

### Verifying UV Preservation

```typescript
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

async function compareUVs(
  basePath: string,
  variantPath: string
): Promise<boolean> {
  const loader = new GLTFLoader()

  const baseGltf = await loader.loadAsync(basePath)
  const variantGltf = await loader.loadAsync(variantPath)

  const baseMesh = baseGltf.scene.children[0] as THREE.Mesh
  const variantMesh = variantGltf.scene.children[0] as THREE.Mesh

  const baseUV = baseMesh.geometry.attributes.uv
  const variantUV = variantMesh.geometry.attributes.uv

  // Compare UV arrays
  if (baseUV.count !== variantUV.count) return false

  for (let i = 0; i < baseUV.count; i++) {
    if (
      Math.abs(baseUV.getX(i) - variantUV.getX(i)) > 0.001 ||
      Math.abs(baseUV.getY(i) - variantUV.getY(i)) > 0.001
    ) {
      return false
    }
  }

  return true
}
```

---

## Art Style

### Supported Art Styles

```typescript
type ArtStyle =
  | 'realistic'      // Photorealistic PBR (default)
  | 'anime'          // Anime/cel-shaded
  | 'low-poly'       // Stylized low-poly
  | 'hand-painted'   // Hand-painted textures
```

### Asset Forge Default

```typescript
{
  art_style: 'realistic'  // Always use realistic
}
```

**Why realistic?**
1. Best PBR generation
2. Most versatile
3. Works with all game engines
4. Consistent results

### Style Comparison

**Realistic:**
- Photorealistic materials
- Accurate lighting response
- PBR workflow
- Industry standard

**Anime:**
- Cel-shaded appearance
- Flat colors with outlines
- Stylized highlights
- Less realistic lighting

**Low-Poly:**
- Simplified textures
- Flat shading
- Minimal detail
- Stylized aesthetic

**Hand-Painted:**
- Artistic brush strokes
- Stylized details
- WoW-like appearance
- Manual art feel

### Custom Style Application

```typescript
async function retextureWithCustomStyle(
  baseTaskId: string,
  material: MaterialPreset,
  artStyle: ArtStyle = 'realistic'
): Promise<string> {
  const response = await fetch('https://api.meshy.ai/v2/retexture', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MESHY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input_task_id: baseTaskId,
      text_style_prompt: material.stylePrompt,
      art_style: artStyle,
      enable_pbr: artStyle === 'realistic'  // PBR only for realistic
    })
  })

  const data = await response.json()
  return data.id
}
```

---

## Base Model Requirements

### meshyTaskId Requirement

**CRITICAL**: Must save `meshyTaskId` from original image-to-3D conversion.

```typescript
interface BaseAssetMetadata {
  id: string
  meshyTaskId: string        // REQUIRED for retexturing
  isBaseModel: true
  variants: string[]         // List of variant IDs
  // ...
}
```

### Why meshyTaskId?

1. **UV preservation**: Meshy uses original UVs
2. **Faster processing**: No need to re-analyze geometry
3. **Consistency**: Guaranteed identical geometry
4. **Cost efficiency**: Cheaper than full conversion

### Verifying Base Model

```typescript
function canRetexture(metadata: AssetMetadata): boolean {
  return (
    isBaseAsset(metadata) &&           // Is a base model
    !!metadata.meshyTaskId &&          // Has task ID
    !metadata.isPlaceholder &&         // Not a placeholder
    metadata.hasModel                   // Model file exists
  )
}

// Usage
if (!canRetexture(baseMetadata)) {
  throw new Error('Base model cannot be retextured (missing meshyTaskId)')
}
```

### Storing meshyTaskId

```typescript
async function saveBaseModel(
  assetId: string,
  meshyTaskId: string,
  modelPath: string
): Promise<void> {
  const metadata: BaseAssetMetadata = {
    id: assetId,
    gameId: 'default',
    name: assetName,
    description: assetDescription,
    type: assetType,
    subtype: assetSubtype,

    // CRITICAL: Save task ID
    meshyTaskId: meshyTaskId,

    isBaseModel: true,
    generationMethod: 'gpt-image-meshy',
    variants: [],  // Will be populated as variants are created
    variantCount: 0,
    modelPath: modelPath,
    hasModel: true,
    hasConceptArt: false,
    gddCompliant: false,
    isPlaceholder: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await fs.writeFile(
    path.join(ASSETS_DIR, assetId, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  )
}
```

---

## Batch Variant Generation

### Generation Workflow

```typescript
class VariantGenerator {
  private queue: MaterialPreset[] = []
  private processing = false
  private delay = 5000  // 5 seconds between variants

  async generateAll(
    baseAssetId: string,
    baseTaskId: string,
    materials: MaterialPreset[]
  ): Promise<string[]> {
    this.queue = [...materials]
    const variantIds: string[] = []

    this.processing = true

    while (this.queue.length > 0) {
      const material = this.queue.shift()!

      try {
        const variantId = await this.generateOne(baseAssetId, baseTaskId, material)
        variantIds.push(variantId)
        console.log(`✓ Generated ${material.name} variant`)
      } catch (error) {
        console.error(`✗ Failed ${material.name}:`, error)
      }

      if (this.queue.length > 0) {
        await sleep(this.delay)
      }
    }

    this.processing = false
    return variantIds
  }

  private async generateOne(
    baseAssetId: string,
    baseTaskId: string,
    material: MaterialPreset
  ): Promise<string> {
    // Start retexture
    const taskId = await retextureModel(baseTaskId, material)

    // Poll completion
    const result = await pollRetextureStatus(taskId)

    // Create variant
    const variantId = `${baseAssetId}-${material.id}`
    await saveVariant(variantId, baseAssetId, material, result)

    return variantId
  }
}
```

### Progress Tracking

```typescript
interface GenerationProgress {
  total: number
  completed: number
  failed: number
  current?: string
  percentage: number
}

class VariantGeneratorWithProgress extends VariantGenerator {
  private progress: GenerationProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    percentage: 0
  }

  async generateAll(
    baseAssetId: string,
    baseTaskId: string,
    materials: MaterialPreset[]
  ): Promise<string[]> {
    this.progress = {
      total: materials.length,
      completed: 0,
      failed: 0,
      percentage: 0
    }

    const variantIds: string[] = []

    for (const material of materials) {
      this.progress.current = material.name

      try {
        const variantId = await this.generateOne(baseAssetId, baseTaskId, material)
        variantIds.push(variantId)
        this.progress.completed++
      } catch (error) {
        this.progress.failed++
        console.error(`Failed ${material.name}:`, error)
      }

      this.progress.percentage = Math.round(
        ((this.progress.completed + this.progress.failed) / this.progress.total) * 100
      )

      this.emitProgress()
    }

    return variantIds
  }

  getProgress(): GenerationProgress {
    return { ...this.progress }
  }

  private emitProgress(): void {
    console.log(`Progress: ${this.progress.percentage}% (${this.progress.completed}/${this.progress.total})`)
  }
}
```

---

## Variant Metadata

### Variant Metadata Structure

```typescript
interface VariantAssetMetadata {
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
  parentBaseModel: string      // ID of base model

  // Material Information
  materialPreset: MaterialPresetInfo
  baseMaterial?: string        // Legacy compatibility

  // Generation Info
  retextureTaskId: string
  retextureMethod: 'meshy-retexture'
  retextureStatus: 'completed' | 'pending' | 'processing' | 'failed'
  retextureError?: string

  // Base Model Reference
  baseModelTaskId: string      // Original meshyTaskId

  // Files
  modelPath: string
  hasModel: boolean

  // Timestamps
  generatedAt: string
  createdAt: string
  updatedAt: string
}
```

### Example Variant Metadata

```json
{
  "id": "sword-base-123-bronze",
  "gameId": "default",
  "name": "Bronze Sword",
  "description": "A bronze sword",
  "type": "weapon",
  "subtype": "sword",

  "isBaseModel": false,
  "isVariant": true,
  "parentBaseModel": "sword-base-123",

  "materialPreset": {
    "id": "bronze",
    "displayName": "Bronze",
    "category": "metal",
    "tier": 1,
    "color": "#CD7F32",
    "stylePrompt": "Bronze texture, low-poly RuneScape style"
  },

  "retextureTaskId": "meshy-retexture-789",
  "retextureMethod": "meshy-retexture",
  "retextureStatus": "completed",
  "baseModelTaskId": "meshy-task-456",

  "modelPath": "/assets/sword-base-123-bronze/model.glb",
  "hasModel": true,

  "generatedAt": "2025-01-21T10:30:00Z",
  "createdAt": "2025-01-21T10:30:00Z",
  "updatedAt": "2025-01-21T10:30:00Z"
}
```

### Saving Variant Metadata

```typescript
async function saveVariantMetadata(
  variantId: string,
  baseAssetId: string,
  material: MaterialPreset,
  retextureResult: MeshyTaskResult
): Promise<void> {
  const baseMetadata = await loadMetadata(baseAssetId)

  const variantMetadata: VariantAssetMetadata = {
    id: variantId,
    gameId: baseMetadata.gameId,
    name: `${baseMetadata.name} (${material.displayName})`,
    description: `${baseMetadata.description} - ${material.displayName} variant`,
    type: baseMetadata.type,
    subtype: baseMetadata.subtype,

    isBaseModel: false,
    isVariant: true,
    parentBaseModel: baseAssetId,

    materialPreset: {
      id: material.id,
      displayName: material.displayName,
      category: material.category,
      tier: material.tier,
      color: material.color,
      stylePrompt: material.stylePrompt
    },

    retextureTaskId: retextureResult.taskId,
    retextureMethod: 'meshy-retexture',
    retextureStatus: 'completed',
    baseModelTaskId: baseMetadata.meshyTaskId,

    modelPath: path.join('/assets', variantId, 'model.glb'),
    hasModel: true,
    hasConceptArt: false,
    gddCompliant: false,
    isPlaceholder: false,

    generatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const metadataPath = path.join(ASSETS_DIR, variantId, 'metadata.json')
  await fs.writeFile(metadataPath, JSON.stringify(variantMetadata, null, 2))
}
```

---

## Error Handling

### Common Errors

#### 1. Missing meshyTaskId

```typescript
if (!baseMetadata.meshyTaskId) {
  throw new Error('Base model missing meshyTaskId - cannot retexture')
}
```

#### 2. Invalid Task ID

```json
{
  "error": "Task not found"
}
```

**Solution**: Verify task ID exists and is accessible

#### 3. Rate Limiting

**Solution**: Implement queue with delays

```typescript
const queue = new VariantQueue({ delayBetweenTasks: 5000 })
```

#### 4. Retexture Failed

```json
{
  "status": "FAILED",
  "error": "Failed to apply texture"
}
```

**Solution**: Retry with simplified prompt or different material

### Robust Retexturing

```typescript
async function robustRetexture(
  baseTaskId: string,
  material: MaterialPreset,
  maxRetries: number = 3
): Promise<MeshyTaskResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const taskId = await retextureModel(baseTaskId, material)
      return await pollRetextureStatus(taskId)
    } catch (error) {
      console.error(`Retexture attempt ${attempt} failed:`, error)

      if (attempt === maxRetries) throw error
      await sleep(5000 * attempt)
    }
  }

  throw new Error('Max retries exceeded')
}
```

---

## Best Practices

### 1. Always Save meshyTaskId

```typescript
// CRITICAL: Save during base model generation
metadata.meshyTaskId = taskId
```

### 2. Use Material Presets

```typescript
// Good: Use presets for consistency
const materials = await loadMaterialPresets()

// Bad: Manual prompts for each variant
const prompt = 'bronze texture'  // Inconsistent
```

### 3. Batch Efficiently

```typescript
// Process with delays to avoid rate limits
for (const material of materials) {
  await createVariant(...)
  await sleep(5000)
}
```

### 4. Track Variant Relationships

```typescript
// Update base model's variant list
baseMetadata.variants.push(variantId)
baseMetadata.variantCount++
await saveMetadata(baseAssetId, baseMetadata)
```

---

## API Reference

```typescript
async function retextureModel(baseTaskId: string, material: MaterialPreset): Promise<string>
async function createVariant(baseAssetId: string, baseTaskId: string, material: MaterialPreset): Promise<string>
async function createAllVariants(baseAssetId: string, baseTaskId: string, materials: MaterialPreset[]): Promise<string[]>
```

---

## Next Steps

- [Rigging](./rigging.md) - Auto-rig characters
- [Generation Pipeline](./generation-pipeline.md) - Complete pipeline
- [3D Conversion](./3d-conversion.md) - Create base models

---

[← Back to 3D Conversion](./3d-conversion.md) | [Next: Rigging →](./rigging.md)
