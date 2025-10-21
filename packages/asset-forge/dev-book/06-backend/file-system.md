# File System Architecture

Asset Forge uses a structured file system to organize generated 3D assets, metadata, animations, sprites, and dependencies. This document details the directory structure, file formats, naming conventions, and file operations used throughout the backend.

## Table of Contents

- [Overview](#overview)
- [Directory Structure](#directory-structure)
- [Asset Directory Layout](#asset-directory-layout)
- [Metadata Format](#metadata-format)
- [File Naming Conventions](#file-naming-conventions)
- [Variant Organization](#variant-organization)
- [Animation Storage](#animation-storage)
- [Sprite Storage](#sprite-storage)
- [Dependency Tracking](#dependency-tracking)
- [File Operations](#file-operations)

## Overview

### Root Directory

The `gdd-assets/` directory serves as the central repository for all generated assets. It is located at:

```
packages/asset-forge/gdd-assets/
```

### Design Principles

1. **Self-Contained Assets**: Each asset lives in its own directory with all related files
2. **Flat Structure**: No deep nesting; one level for assets, one for internal organization
3. **Metadata-Driven**: All asset information stored in standardized metadata.json
4. **Convention Over Configuration**: Predictable file names and locations
5. **Dependency Tracking**: Central .dependencies.json for relationships

### File System Guarantees

- **Atomic Operations**: File writes use temporary files + rename for atomicity
- **Consistent Naming**: Strict kebab-case for asset IDs and file names
- **No External References**: All asset files stored locally (except temporary URLs)
- **Version Control Ready**: Text-based metadata, binary files in separate directories

## Directory Structure

### Top-Level Layout

```
gdd-assets/
├── .dependencies.json           # Dependency graph (optional)
├── asset-name-base/             # Base model directory
│   ├── asset-name-base.glb     # Main 3D model
│   ├── metadata.json           # Asset metadata
│   ├── concept-art.png         # Concept art image
│   ├── animations/             # Animation files (optional)
│   └── sprites/                # Sprite renders (optional)
├── asset-name-variant/         # Material variant directory
│   ├── asset-name-variant.glb  # Retextured model
│   ├── metadata.json           # Variant metadata
│   └── concept-art.png         # Inherited concept art
└── another-asset-base/         # Another base asset
    └── ...
```

### Asset Type Examples

**Character Asset:**
```
goblin-warrior-base/
├── goblin-warrior-base.glb          # Unrigged T-pose model
├── goblin-warrior-base_rigged.glb   # Rigged model with skeleton
├── goblin-warrior-base_raw.glb      # Original Meshy output
├── t-pose.glb                       # Extracted T-pose (optional)
├── metadata.json
├── concept-art.png
├── animations/
│   ├── walking.glb
│   └── running.glb
└── sprites/
    ├── 0deg.png
    ├── 45deg.png
    └── sprite-metadata.json
```

**Weapon Asset:**
```
steel-sword-base/
├── steel-sword-base.glb        # Normalized (grip at origin)
├── steel-sword-base_raw.glb    # Original Meshy output
├── metadata.json
└── concept-art.png
```

**Armor Asset:**
```
bronze-chestplate-base/
├── bronze-chestplate-base.glb
├── bronze-chestplate-base_raw.glb
├── metadata.json
└── concept-art.png
```

### Hidden Files

```
gdd-assets/
├── .dependencies.json          # Dependency graph
├── .gitkeep                    # Keep empty directory in git
└── .DS_Store                   # macOS metadata (gitignored)
```

## Asset Directory Layout

### Base Model Structure

A base model is the original generated asset before any variants.

**Directory Name:** `{asset-id}-base` or `{asset-id}`

**Required Files:**
- `{asset-id}.glb` - Primary 3D model (normalized)
- `metadata.json` - Asset metadata

**Optional Files:**
- `{asset-id}_raw.glb` - Original Meshy output (before normalization)
- `{asset-id}_rigged.glb` - Rigged version for characters
- `concept-art.png` - Generated concept art image
- `t-pose.glb` - Extracted T-pose model

**Optional Directories:**
- `animations/` - Character animations
- `sprites/` - Isometric sprite renders

### Variant Structure

A variant is a material/texture variation of a base model.

**Directory Name:** `{base-id}-{material-id}`

**Example:** `steel-sword-bronze` (bronze variant of steel-sword-base)

**Required Files:**
- `{variant-id}.glb` - Retextured 3D model
- `metadata.json` - Variant metadata

**Optional Files:**
- `concept-art.png` - Copied from base model

**Note:** Variants do NOT have animations or sprites (inherit from base)

## Metadata Format

### Base Model Metadata

The `metadata.json` file contains all information about an asset.

**File Location:** `gdd-assets/{asset-id}/metadata.json`

**Structure:**
```json
{
  "name": "goblin-warrior-base",
  "gameId": "goblin-warrior-base",
  "type": "character",
  "subtype": "humanoid",
  "description": "A fierce goblin warrior with leather armor",
  "detailedPrompt": "A menacing goblin warrior character standing in T-pose...",

  "generatedAt": "2025-10-21T10:30:00.000Z",
  "completedAt": "2025-10-21T10:35:00.000Z",
  "updatedAt": "2025-10-21T10:35:00.000Z",

  "isBaseModel": true,
  "isVariant": false,
  "isPlaceholder": false,
  "hasModel": true,
  "hasConceptArt": true,
  "gddCompliant": true,

  "modelPath": "gdd-assets/goblin-warrior-base/goblin-warrior-base.glb",
  "conceptArtUrl": "./concept-art.png",

  "workflow": "GPT-4 → GPT-Image-1 → Meshy Image-to-3D (Base Model)",
  "meshyTaskId": "img3d_abc123def456",
  "meshyStatus": "completed",

  "materialVariants": ["bronze", "steel"],
  "variants": ["goblin-warrior-bronze", "goblin-warrior-steel"],
  "variantCount": 2,
  "lastVariantGenerated": "goblin-warrior-steel",

  "isRigged": true,
  "riggingTaskId": "rig_xyz789abc123",
  "riggingStatus": "completed",
  "rigType": "humanoid-standard",
  "characterHeight": 1.83,
  "riggedModelPath": "goblin-warrior-base_rigged.glb",
  "tposeModelPath": "t-pose.glb",
  "supportsAnimation": true,
  "animationCompatibility": ["mixamo", "unity", "unreal"],

  "animations": {
    "basic": {
      "walking": "animations/walking.glb",
      "running": "animations/running.glb",
      "tpose": "t-pose.glb"
    }
  },

  "normalized": true,
  "normalizationDate": "2025-10-21T10:32:00.000Z",
  "dimensions": {
    "height": 1.83,
    "width": 0.6,
    "depth": 0.4
  },

  "hasSpriteSheet": true,
  "spriteCount": 8,
  "spriteConfig": {
    "size": 128,
    "angles": [0, 45, 90, 135, 180, 225, 270, 315],
    "cameraDistance": 5,
    "backgroundColor": "transparent"
  },
  "lastSpriteGeneration": "2025-10-21T10:36:00.000Z"
}
```

### Variant Metadata

**File Location:** `gdd-assets/{variant-id}/metadata.json`

**Structure:**
```json
{
  "id": "steel-sword-bronze",
  "gameId": "steel-sword-bronze",
  "name": "steel-sword-bronze",
  "type": "weapon",
  "subtype": "sword",

  "isBaseModel": false,
  "isVariant": true,
  "parentBaseModel": "steel-sword-base",

  "materialPreset": {
    "id": "bronze",
    "displayName": "Bronze",
    "category": "metal",
    "tier": 1,
    "color": "#CD7F32",
    "stylePrompt": "bronze metal texture with oxidized patina, warm copper-brown tones, slightly weathered, game-ready PBR materials"
  },

  "workflow": "Meshy AI Retexture",
  "baseModelTaskId": "img3d_abc123",
  "retextureTaskId": "ret_xyz789",
  "retextureStatus": "completed",

  "modelPath": "steel-sword-bronze.glb",
  "conceptArtPath": "concept-art.png",
  "hasModel": true,
  "hasConceptArt": true,

  "generatedAt": "2025-10-21T11:00:00.000Z",
  "completedAt": "2025-10-21T11:03:00.000Z",

  "description": "A steel sword with bronze finish",
  "isPlaceholder": false,
  "gddCompliant": true
}
```

### Metadata Field Descriptions

**Identity Fields:**
- `name` (string): Asset identifier (same as directory name)
- `gameId` (string): In-game identifier (usually same as name)
- `type` (string): Asset category (character, weapon, armor, prop, etc.)
- `subtype` (string): Asset subcategory (humanoid, sword, chest, etc.)
- `description` (string): User-provided description
- `detailedPrompt` (string): AI-enhanced prompt used for generation

**Status Fields:**
- `isBaseModel` (boolean): True for original generated assets
- `isVariant` (boolean): True for material variants
- `isPlaceholder` (boolean): True for placeholder/template assets
- `hasModel` (boolean): 3D model file exists
- `hasConceptArt` (boolean): Concept art image exists
- `gddCompliant` (boolean): Meets GDD quality standards

**Generation Tracking:**
- `workflow` (string): Generation pipeline used
- `meshyTaskId` (string): Meshy Image-to-3D task ID
- `meshyStatus` (string): Task completion status
- `generatedAt` (ISO 8601): Pipeline start timestamp
- `completedAt` (ISO 8601): Pipeline completion timestamp
- `updatedAt` (ISO 8601): Last modification timestamp

**Variant Tracking (Base Models Only):**
- `materialVariants` (array): Material preset IDs
- `variants` (array): Variant asset IDs
- `variantCount` (number): Total variant count
- `lastVariantGenerated` (string): Most recent variant ID

**Rigging Info (Characters Only):**
- `isRigged` (boolean): Has skeleton and animations
- `riggingTaskId` (string): Meshy rigging task ID
- `riggingStatus` (string): Rigging completion status
- `rigType` (string): Skeleton type (humanoid-standard, etc.)
- `characterHeight` (number): Height in meters
- `riggedModelPath` (string): Path to rigged GLB
- `tposeModelPath` (string): Path to T-pose GLB
- `supportsAnimation` (boolean): Can be animated
- `animationCompatibility` (array): Compatible animation systems

**Normalization Info:**
- `normalized` (boolean): Model has been normalized
- `normalizationDate` (ISO 8601): Normalization timestamp
- `dimensions` (object): Normalized dimensions (height, width, depth)

**Sprite Info:**
- `hasSpriteSheet` (boolean): Sprites have been generated
- `spriteCount` (number): Number of sprite angles
- `spriteConfig` (object): Sprite generation configuration
- `lastSpriteGeneration` (ISO 8601): Last sprite generation time

## File Naming Conventions

### Asset IDs

**Format:** Lowercase kebab-case
**Pattern:** `{primary-name}-{modifier}*-{suffix}`

**Examples:**
```
goblin-warrior-base
goblin-warrior-bronze
steel-sword-base
steel-sword-iron
bronze-chestplate-base
bronze-chestplate-steel
magic-staff-base
```

**Rules:**
1. Use hyphens (`-`) to separate words, never underscores or spaces
2. Use lowercase only, no capitals
3. Base models end with `-base` (recommended but optional)
4. Variants format: `{base-name-without-base}-{material}`
5. Avoid special characters except hyphens
6. Keep names concise but descriptive

### Model Files

**Primary Model:**
```
{asset-id}.glb
```

**Raw Model (Before Normalization):**
```
{asset-id}_raw.glb
```

**Rigged Model (Characters):**
```
{asset-id}_rigged.glb
```

**T-Pose Model:**
```
t-pose.glb
```

### Image Files

**Concept Art:**
```
concept-art.png
```

**Sprites:**
```
sprites/0deg.png
sprites/45deg.png
sprites/90deg.png
...
```

### Animation Files

**Animation Naming:**
```
animations/walking.glb
animations/running.glb
animations/idle.glb
animations/attack.glb
```

### Metadata Files

**Asset Metadata:**
```
metadata.json
```

**Sprite Metadata:**
```
sprite-metadata.json
```

**Dependencies:**
```
.dependencies.json
```

## Variant Organization

### Variant Naming Strategy

Variants follow the pattern: `{base-id}-{material-id}`

**Base Asset:** `steel-sword-base`

**Variants:**
- `steel-sword-bronze` (bronze material)
- `steel-sword-iron` (iron material)
- `steel-sword-mithril` (mithril material)
- `steel-sword-crystal` (crystal material)

### Parent-Child Relationship

**Base Metadata:**
```json
{
  "name": "steel-sword-base",
  "isBaseModel": true,
  "variants": [
    "steel-sword-bronze",
    "steel-sword-iron",
    "steel-sword-mithril"
  ],
  "variantCount": 3
}
```

**Variant Metadata:**
```json
{
  "name": "steel-sword-bronze",
  "isBaseModel": false,
  "isVariant": true,
  "parentBaseModel": "steel-sword-base"
}
```

### Variant Inheritance

**Inherited from Base:**
- Asset type and subtype
- Original description
- Concept art image
- Dimensions and normalization data

**Unique to Variant:**
- Material preset information
- Retexture task ID
- GLB model file (retextured)
- Generation timestamp

**Not Inherited:**
- Animations (use base model's rigged version)
- Sprites (use base model's sprites)
- Material variants list (variants don't have sub-variants)

## Animation Storage

### Animation Directory

**Location:** `gdd-assets/{asset-id}/animations/`

**Structure:**
```
animations/
├── walking.glb      # Walking animation
├── running.glb      # Running animation
├── idle.glb         # Idle animation (future)
└── attack.glb       # Attack animation (future)
```

### Animation File Format

**Format:** GLB (Binary glTF 2.0)

**Contents:**
- Rigged character model (with skeleton)
- Animation clip data
- Embedded textures

### Animation Metadata

**Stored in Asset metadata.json:**
```json
{
  "animations": {
    "basic": {
      "walking": "animations/walking.glb",
      "running": "animations/running.glb"
    }
  }
}
```

### Animation Lifecycle

1. **Generation:**
   - Meshy rigging API generates walking.glb and running.glb
   - Each contains rigged model + animation clip

2. **T-Pose Extraction:**
   - Walking.glb frame 0 contains T-pose
   - Extract to separate t-pose.glb for reference

3. **Storage:**
   - Save rigged model as `{asset-id}_rigged.glb`
   - Save animations in `animations/` directory
   - Update metadata with animation paths

4. **Usage:**
   - Static viewer: Use unrigged `{asset-id}.glb`
   - Animation player: Use `{asset-id}_rigged.glb`
   - Load animation clips from `animations/` directory

## Sprite Storage

### Sprite Directory

**Location:** `gdd-assets/{asset-id}/sprites/`

**Structure:**
```
sprites/
├── 0deg.png         # Front view
├── 45deg.png        # Front-right view
├── 90deg.png        # Right side view
├── 135deg.png       # Back-right view
├── 180deg.png       # Back view
├── 225deg.png       # Back-left view
├── 270deg.png       # Left side view
└── 315deg.png       # Front-left view
```

### Sprite File Format

**Format:** PNG (Portable Network Graphics)
**Resolution:** Configurable (default 128x128)
**Background:** Transparent (RGBA)

### Sprite Metadata

**File:** `gdd-assets/{asset-id}/sprite-metadata.json`

**Structure:**
```json
{
  "assetId": "goblin-warrior-base",
  "config": {
    "size": 128,
    "angles": [0, 45, 90, 135, 180, 225, 270, 315],
    "cameraDistance": 5,
    "backgroundColor": "transparent"
  },
  "angles": [0, 45, 90, 135, 180, 225, 270, 315],
  "spriteCount": 8,
  "status": "completed",
  "generatedAt": "2025-10-21T10:36:00.000Z"
}
```

### Sprite Generation Process

1. **Render:**
   - Load 3D model into Three.js scene
   - Position camera at each angle
   - Render to canvas with transparent background

2. **Encode:**
   - Convert canvas to base64 PNG data URI
   - Extract base64 data from data URI

3. **Save:**
   - Create `sprites/` directory
   - Write each angle as `{angle}deg.png`
   - Create `sprite-metadata.json`

4. **Update Metadata:**
   - Set `hasSpriteSheet: true`
   - Set `spriteCount: 8`
   - Add `spriteConfig` object
   - Set `lastSpriteGeneration` timestamp

## Dependency Tracking

### Dependencies File

**File:** `gdd-assets/.dependencies.json`

**Purpose:** Track relationships between base models and variants

**Structure:**
```json
{
  "steel-sword-base": {
    "type": "base",
    "variants": [
      "steel-sword-bronze",
      "steel-sword-iron",
      "steel-sword-mithril"
    ],
    "createdAt": "2025-10-21T10:00:00.000Z",
    "lastUpdated": "2025-10-21T11:30:00.000Z"
  },
  "steel-sword-bronze": {
    "type": "variant",
    "parentBaseModel": "steel-sword-base",
    "materialPreset": "bronze",
    "createdAt": "2025-10-21T11:00:00.000Z"
  },
  "steel-sword-iron": {
    "type": "variant",
    "parentBaseModel": "steel-sword-base",
    "materialPreset": "iron",
    "createdAt": "2025-10-21T11:15:00.000Z"
  }
}
```

### Dependency Operations

**Add Variant:**
```javascript
// When creating variant
dependencies['steel-sword-base'].variants.push('steel-sword-bronze')
dependencies['steel-sword-base'].lastUpdated = new Date().toISOString()

dependencies['steel-sword-bronze'] = {
  type: 'variant',
  parentBaseModel: 'steel-sword-base',
  materialPreset: 'bronze',
  createdAt: new Date().toISOString()
}
```

**Delete Asset:**
```javascript
// Remove asset entry
delete dependencies['steel-sword-bronze']

// Remove from parent's variants list
dependencies['steel-sword-base'].variants =
  dependencies['steel-sword-base'].variants.filter(id => id !== 'steel-sword-bronze')
```

**Rename Asset:**
```javascript
// Update key
dependencies['steel-sword-v2'] = dependencies['steel-sword-base']
delete dependencies['steel-sword-base']

// Update all references
for (const [id, data] of Object.entries(dependencies)) {
  if (data.parentBaseModel === 'steel-sword-base') {
    data.parentBaseModel = 'steel-sword-v2'
  }
  if (data.variants?.includes('steel-sword-base')) {
    data.variants = data.variants.map(v =>
      v === 'steel-sword-base' ? 'steel-sword-v2' : v
    )
  }
}
```

### Dependency Graph Queries

**Find all variants of a base:**
```javascript
const variants = dependencies[baseId]?.variants || []
```

**Find parent of a variant:**
```javascript
const parent = dependencies[variantId]?.parentBaseModel
```

**Find orphaned variants:**
```javascript
const orphans = Object.entries(dependencies)
  .filter(([id, data]) =>
    data.type === 'variant' && !dependencies[data.parentBaseModel]
  )
  .map(([id]) => id)
```

## File Operations

### Creating Asset Directory

```javascript
import fs from 'fs/promises'
import path from 'path'

async function createAssetDirectory(assetId, assetsDir) {
  const assetPath = path.join(assetsDir, assetId)
  await fs.mkdir(assetPath, { recursive: true })
  return assetPath
}
```

### Writing Metadata

```javascript
async function writeMetadata(assetId, metadata, assetsDir) {
  const metadataPath = path.join(assetsDir, assetId, 'metadata.json')
  await fs.writeFile(
    metadataPath,
    JSON.stringify(metadata, null, 2),
    'utf-8'
  )
}
```

### Reading Metadata

```javascript
async function readMetadata(assetId, assetsDir) {
  const metadataPath = path.join(assetsDir, assetId, 'metadata.json')
  const content = await fs.readFile(metadataPath, 'utf-8')
  return JSON.parse(content)
}
```

### Saving Binary Files

```javascript
async function saveModel(assetId, modelBuffer, assetsDir) {
  const modelPath = path.join(assetsDir, assetId, `${assetId}.glb`)
  await fs.writeFile(modelPath, modelBuffer)
  return modelPath
}
```

### Saving Images

```javascript
async function saveConceptArt(assetId, imageUrl, assetsDir) {
  // Extract base64 data from data URI
  const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

  const imagePath = path.join(assetsDir, assetId, 'concept-art.png')
  await fs.writeFile(imagePath, buffer)
  return imagePath
}
```

### Copying Files

```javascript
async function copyConceptArt(sourceAssetId, targetAssetId, assetsDir) {
  const sourcePath = path.join(assetsDir, sourceAssetId, 'concept-art.png')
  const targetPath = path.join(assetsDir, targetAssetId, 'concept-art.png')

  try {
    await fs.copyFile(sourcePath, targetPath)
  } catch (error) {
    // Ignore if source doesn't exist
    console.warn('Concept art not found, skipping copy')
  }
}
```

### Deleting Assets

```javascript
async function deleteAsset(assetId, assetsDir) {
  const assetPath = path.join(assetsDir, assetId)
  await fs.rm(assetPath, { recursive: true, force: true })
}
```

### Renaming Assets

```javascript
async function renameAsset(oldId, newId, assetsDir) {
  const oldPath = path.join(assetsDir, oldId)
  const newPath = path.join(assetsDir, newId)

  // Check new path doesn't exist
  try {
    await fs.access(newPath)
    throw new Error(`Asset ${newId} already exists`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  // Rename directory
  await fs.rename(oldPath, newPath)

  // Update metadata
  const metadata = await readMetadata(newId, assetsDir)
  metadata.name = newId
  metadata.gameId = newId
  await writeMetadata(newId, metadata, assetsDir)
}
```

### Listing Assets

```javascript
async function listAssets(assetsDir) {
  const entries = await fs.readdir(assetsDir)
  const assets = []

  for (const entry of entries) {
    // Skip hidden files and non-directories
    if (entry.startsWith('.')) continue

    const assetPath = path.join(assetsDir, entry)
    const stats = await fs.stat(assetPath)
    if (!stats.isDirectory()) continue

    // Read metadata
    try {
      const metadata = await readMetadata(entry, assetsDir)
      assets.push({
        id: entry,
        ...metadata
      })
    } catch (error) {
      console.warn(`Failed to load asset ${entry}:`, error.message)
    }
  }

  return assets
}
```

### Atomic File Operations

For critical operations, use atomic writes:

```javascript
async function atomicWriteMetadata(assetId, metadata, assetsDir) {
  const metadataPath = path.join(assetsDir, assetId, 'metadata.json')
  const tempPath = `${metadataPath}.tmp`

  // Write to temp file
  await fs.writeFile(tempPath, JSON.stringify(metadata, null, 2))

  // Atomic rename
  await fs.rename(tempPath, metadataPath)
}
```

### Path Security

Prevent directory traversal attacks:

```javascript
function validateAssetPath(assetId, assetsDir) {
  const assetPath = path.join(assetsDir, assetId)
  const normalizedPath = path.normalize(assetPath)

  // Ensure path is within assetsDir
  if (!normalizedPath.startsWith(assetsDir)) {
    throw new Error('Invalid asset path: directory traversal detected')
  }

  return normalizedPath
}
```

### Error Handling

```javascript
async function safeReadMetadata(assetId, assetsDir) {
  try {
    return await readMetadata(assetId, assetsDir)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Asset ${assetId} not found`)
    }
    throw new Error(`Failed to read metadata: ${error.message}`)
  }
}
```

### Backup Strategy

**Before Destructive Operations:**
```javascript
async function backupAsset(assetId, assetsDir) {
  const assetPath = path.join(assetsDir, assetId)
  const backupPath = `${assetPath}.backup.${Date.now()}`

  await fs.cp(assetPath, backupPath, { recursive: true })
  return backupPath
}

async function deleteWithBackup(assetId, assetsDir) {
  // Create backup
  const backupPath = await backupAsset(assetId, assetsDir)

  try {
    // Delete asset
    await deleteAsset(assetId, assetsDir)
  } catch (error) {
    // Restore from backup on failure
    console.error('Delete failed, restoring from backup')
    await fs.cp(backupPath, path.join(assetsDir, assetId), { recursive: true })
    throw error
  } finally {
    // Clean up backup after 24 hours
    setTimeout(() => {
      fs.rm(backupPath, { recursive: true, force: true })
    }, 24 * 60 * 60 * 1000)
  }
}
```

---

**Total Word Count: 3,900 words**

This comprehensive file system documentation covers the complete directory structure, metadata formats, naming conventions, variant organization, and all file operations used in the Asset Forge backend for managing 3D assets, animations, sprites, and dependencies.
