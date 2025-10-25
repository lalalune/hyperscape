# AI Prompt Templates

This comprehensive guide covers all AI prompt templates, prompt files, loading systems, template syntax, and custom prompt creation for Asset Forge's AI-powered generation pipeline.

## Table of Contents

1. [Overview](#overview)
2. [Prompt File Structure](#prompt-file-structure)
3. [Asset Type Prompts](#asset-type-prompts)
4. [Generation Prompts](#generation-prompts)
5. [Game Style Prompts](#game-style-prompts)
6. [Weapon Detection Prompts](#weapon-detection-prompts)
7. [Material Prompts](#material-prompts)
8. [GPT-4 Enhancement Prompts](#gpt-4-enhancement-prompts)
9. [Prompt Loading System](#prompt-loading-system)
10. [Template Syntax](#template-syntax)
11. [Custom Prompt Creation](#custom-prompt-creation)

---

## Overview

Asset Forge uses a sophisticated prompt template system to guide AI models (GPT-4, DALL-E, Meshy) in generating consistent, high-quality 3D assets. Prompts are stored as JSON files and loaded dynamically at runtime.

### Prompt System Architecture

```
User Input
    ↓
Asset Type Prompts (avatar/item categories)
    ↓
Game Style Prompts (RuneScape, generic, custom)
    ↓
Generation Prompts (base image generation)
    ↓
GPT-4 Enhancement (prompt optimization)
    ↓
AI Model (DALL-E/Meshy)
    ↓
Generated Asset
```

### Prompt File Locations

All prompt templates are stored in JSON format:

```
/public/prompts/
├── asset-type-prompts.json       # Avatar/item type definitions
├── generation-prompts.json       # Core generation templates
├── game-style-prompts.json       # Art style definitions
├── weapon-detection-prompts.json # Grip detection for weapons
├── material-prompts.json         # Material retexture templates
├── gpt4-enhancement-prompts.json # Prompt optimization rules
└── material-presets.json         # Material definitions (covered separately)
```

### Key Features

- **Modular Design** - Separate concerns (type, style, generation)
- **Template Variables** - Dynamic content insertion with `${variable}` syntax
- **Version Control** - JSON files track version numbers
- **Extensibility** - Easy addition of custom prompts
- **Default + Custom** - Built-in defaults with custom override support
- **Type Safety** - TypeScript interfaces for prompt structures

---

## Prompt File Structure

All prompt files follow a consistent JSON structure with versioning and organization.

### Common Structure

```json
{
  "__comment": "Description of prompt file purpose",
  "version": "1.0.0",
  "default": {
    // Built-in prompts
  },
  "custom": {
    // User-defined prompts
  }
}
```

### Version Field

**Format**: Semantic versioning (MAJOR.MINOR.PATCH)

```json
"version": "1.0.0"
```

**Version Meanings**:
- **MAJOR** - Breaking changes to prompt structure
- **MINOR** - New prompts added, backward compatible
- **PATCH** - Prompt text improvements, bug fixes

### Comment Field

Documentation embedded in JSON:

```json
"__comment": "Asset type specific prompts - separated by generation type (avatar/item)"
```

**Purpose**: Explains file contents without needing external documentation.

### Default vs Custom

**Default Section**: Built-in prompts provided by Asset Forge

```json
"default": {
  "runescape": { ... },
  "generic": { ... }
}
```

**Custom Section**: User-defined additions without modifying defaults

```json
"custom": {
  "myCustomStyle": { ... },
  "experimentalPrompt": { ... }
}
```

---

## Asset Type Prompts

Asset type prompts define categories and descriptions for different asset types.

**File**: `/public/prompts/asset-type-prompts.json`

### File Structure

```json
{
  "__comment": "Asset type specific prompts - separated by generation type (avatar/item)",
  "version": "2.0.0",
  "avatar": {
    "default": { /* avatar types */ },
    "custom": { /* custom avatar types */ }
  },
  "item": {
    "default": { /* item types */ },
    "custom": { /* custom item types */ }
  }
}
```

### Avatar Types

Avatar types define character and creature categories:

#### Character

```json
"character": {
  "name": "Character",
  "prompt": "",
  "placeholder": "Show the full character in T-pose, front view on neutral background"
}
```

**Purpose**: Generic humanoid character
**T-pose Requirement**: Essential for rigging
**Usage**: Player characters, NPCs

#### Humanoid

```json
"humanoid": {
  "name": "Humanoid",
  "prompt": "",
  "placeholder": "Show the humanoid character in T-pose with clear proportions"
}
```

**Purpose**: Human-like creatures with standard proportions
**Key Feature**: Standard skeleton compatibility
**Usage**: Humans, elves, dwarves

#### NPC

```json
"npc": {
  "name": "NPC",
  "prompt": "",
  "placeholder": "Show the NPC character in T-pose, ready for animation"
}
```

**Purpose**: Non-player characters
**Requirements**: T-pose, animation-ready
**Usage**: Quest givers, merchants, enemies

#### Creature

```json
"creature": {
  "name": "Creature",
  "prompt": "",
  "placeholder": "Show the creature in a neutral pose displaying its features"
}
```

**Purpose**: Non-humanoid entities
**Pose**: Neutral standing pose (not T-pose)
**Usage**: Animals, monsters, fantasy creatures

### Item Types

Item types define equipment and object categories:

#### Weapon

```json
"weapon": {
  "name": "Weapon",
  "prompt": "",
  "placeholder": "Show the full weapon clearly on a neutral background"
}
```

**Purpose**: Combat equipment
**Requirements**: Clear view, neutral background
**Usage**: Swords, axes, bows, staffs

#### Armor

```json
"armor": {
  "name": "Armor",
  "prompt": "",
  "placeholder": "Show the armor piece clearly, shaped for T-pose fitting"
}
```

**Purpose**: Protective equipment
**Critical**: Must be shaped for T-pose bodies
**Usage**: Chest plates, helmets, leg armor

#### Tool

```json
"tool": {
  "name": "Tool",
  "prompt": "",
  "placeholder": "Show the tool from a clear angle displaying its functionality"
}
```

**Purpose**: Utility items
**Requirements**: Functional view
**Usage**: Pickaxes, hammers, fishing rods

#### Building

```json
"building": {
  "name": "Building",
  "prompt": "",
  "placeholder": "Show the building structure from an isometric view"
}
```

**Purpose**: Structures and architecture
**View**: Isometric perspective
**Usage**: Houses, shops, landmarks

#### Consumable

```json
"consumable": {
  "name": "Consumable",
  "prompt": "",
  "placeholder": "Show the consumable item clearly with recognizable features"
}
```

**Purpose**: Usable items
**Requirements**: Recognizable features
**Usage**: Potions, food, scrolls

#### Resource

```json
"resource": {
  "name": "Resource",
  "prompt": "",
  "placeholder": "Show the resource material or item in detail"
}
```

**Purpose**: Crafting materials
**Requirements**: Detailed view
**Usage**: Ore, wood, herbs

### Custom Asset Types

Users can define custom types in the `custom` section:

```json
"custom": {
  "test": {
    "name": "test",
    "prompt": "test",
    "placeholder": "test"
  }
}
```

**Adding Custom Types**:

1. Open `asset-type-prompts.json`
2. Add to appropriate `custom` section (avatar or item)
3. Define `name`, `prompt`, and `placeholder` fields
4. Save and reload application

---

## Generation Prompts

Generation prompts provide base templates for image and 3D generation.

**File**: `/public/prompts/generation-prompts.json`

### File Structure

```json
{
  "__comment": "Core generation prompts used in the pipeline",
  "version": "1.0.0",
  "imageGeneration": { /* image generation templates */ },
  "posePrompts": { /* pose-specific prompts */ }
}
```

### Image Generation Templates

Base templates for image generation:

#### Base Template

```json
"base": "${description}. ${style || 'game-ready'} style, ${assetType}, clean geometry suitable for 3D conversion."
```

**Template Variables**:
- `${description}` - User's asset description
- `${style}` - Selected game style (or default 'game-ready')
- `${assetType}` - Asset type (weapon, armor, character, etc.)

**Example Expansion**:
```
Input:
  description: "bronze longsword"
  style: "RuneScape 2007"
  assetType: "weapon"

Output:
  "bronze longsword. RuneScape 2007 style, weapon, clean geometry suitable for 3D conversion."
```

#### Fallback Enhancement

```json
"fallbackEnhancement": "${config.description}. ${config.style || 'game-ready'} style, clean geometry, game-ready 3D asset."
```

**Purpose**: Simpler template when main enhancement fails

**Usage**: Error recovery, simplified generation

### Pose Prompts

Specialized prompts for proper pose generation:

#### Avatar T-Pose

```json
"avatar": {
  "tpose": "standing in T-pose with arms stretched out horizontally"
}
```

**Critical Requirements**:
- Arms straight out at 90° from body
- Legs slightly apart
- Upright standing position
- Empty hands (no held items)

**Why T-Pose**: Required for skeleton rigging and animation

#### Armor Chest Piece

```json
"armor": {
  "chest": "floating chest armor SHAPED FOR T-POSE BODY - shoulder openings must point STRAIGHT OUT SIDEWAYS at 90 degrees like a scarecrow (NOT angled down), wide \"T\" shape when viewed from front, ends at shoulders with no arm extensions, torso-only armor piece, hollow shoulder openings pointing horizontally, no armor stand"
}
```

**Critical Details**:
- Shoulder openings at 90° horizontal
- Wide "T" shape from front view
- Ends at shoulders (no arm coverage)
- Hollow openings for body parts
- No armor stand or mannequin

**Why So Specific**: Armor must fit T-posed body; incorrect shoulder angles cause fitting failures.

#### Armor Generic

```json
"armor": {
  "generic": "floating armor piece shaped for T-pose body fitting, openings positioned at correct angles for T-pose (horizontal for shoulders), hollow openings, no armor stand or mannequin"
}
```

**Purpose**: General armor pieces (legs, head, etc.)

**Key Points**:
- Floating (no stand)
- T-pose compatible
- Hollow openings
- Correct angle positioning

---

## Game Style Prompts

Game style prompts define art style characteristics for consistent generation.

**File**: `/public/prompts/game-style-prompts.json`

### File Structure

```json
{
  "__comment": "Game style prompts - add custom styles in the 'custom' section",
  "version": "1.0.0",
  "default": { /* built-in styles */ },
  "custom": { /* user styles */ }
}
```

### Default Styles

#### RuneScape 2007

```json
"runescape": {
  "name": "RuneScape 2007",
  "base": "Low-poly RuneScape 2007",
  "enhanced": "low-poly RuneScape style",
  "generation": "runescape2007"
}
```

**Characteristics**:
- Low-poly geometry
- Retro MMORPG aesthetic
- Simple textures
- Nostalgic 2007-era graphics

**Fields**:
- `name` - Display name for UI
- `base` - Basic style descriptor
- `enhanced` - GPT-4 enhanced version
- `generation` - Internal identifier

#### Generic Low-Poly

```json
"generic": {
  "name": "Generic Low-Poly",
  "base": "low-poly 3D game asset style",
  "fallback": "Low-poly game asset"
}
```

**Purpose**: Default style without specific game theming

**Characteristics**:
- Low polygon count
- Simple textures
- Mobile-friendly
- Versatile application

### Custom Styles

Users can define custom art styles:

#### Marvel Style

```json
"marvel": {
  "name": "Marvel",
  "base": "Modern Marvel movie styled design and quality, high resolution, yet 3D game like",
  "enhanced": "Modern Marvel movie styled design and quality, high resolution, yet 3D game like"
}
```

**Purpose**: Cinematic superhero aesthetic

#### Skyrim Style

```json
"skyrim-style": {
  "name": "Skyrim Style",
  "base": "Skyrim style quality and design",
  "enhanced": "Skyrim style quality and design"
}
```

**Purpose**: Elder Scrolls fantasy aesthetic

#### Realistic

```json
"realistic": {
  "name": "Realistic",
  "base": "Realistic ",
  "enhanced": "Realistic "
}
```

**Purpose**: Photorealistic rendering

#### Stylized

```json
"stylized": {
  "name": "Stylized",
  "base": "Stylized hand painted game asset",
  "enhanced": "Stylized hand painted game asset"
}
```

**Purpose**: Hand-painted, artistic style

### Creating Custom Styles

**Template**:

```json
"my-custom-style": {
  "name": "Display Name",
  "base": "Brief style description for basic prompts",
  "enhanced": "Detailed style description for GPT-4 enhancement",
  "generation": "optional-internal-id"
}
```

**Best Practices**:
- `base` - 5-10 words, concise
- `enhanced` - 15-30 words, descriptive
- `name` - User-friendly display name
- `generation` - Optional identifier for internal use

---

## Weapon Detection Prompts

Weapon detection prompts guide GPT-4 Vision in identifying weapon grip areas for hand rigging.

**File**: `/public/prompts/weapon-detection-prompts.json`

### File Structure

```json
{
  "__comment": "Weapon handle detection prompts for AI analysis",
  "version": "1.0.0",
  "basePrompt": "...",
  "additionalGuidance": "...",
  "restrictions": "...",
  "responseFormat": "..."
}
```

### Base Prompt

Detailed instructions for weapon analysis:

```json
"basePrompt": "You are analyzing a 3D weapon rendered from the ${angle || 'side'} in a 512x512 pixel image.
The weapon is oriented vertically with the blade/head pointing UP and handle pointing DOWN.

YOUR TASK: Identify ONLY the HANDLE/GRIP area where a human hand would hold this weapon.

CRITICAL DISTINCTIONS:
- HANDLE/GRIP: The narrow cylindrical part designed for holding (usually wrapped, textured, or darker)
- BLADE: The wide, flat, sharp part used for cutting (usually metallic, reflective, lighter)
- GUARD/CROSSGUARD: The horizontal piece between blade and handle
- POMMEL: The weighted end piece at the very bottom of the handle

For a SWORD specifically:
- The HANDLE is the wrapped/textured section BELOW the guard/crossguard
- It's typically 15-25% of the total weapon length
- It's narrower than the blade
- It often has visible wrapping, leather, or grip texture
- The grip is NEVER on the blade itself

VISUAL CUES for the handle:
1. Look for texture changes (wrapped vs smooth metal)
2. Look for width changes (handle is narrower than blade)
3. Look for the crossguard/guard that separates blade from handle
4. The handle is typically in the LOWER portion of the weapon
5. If you see a wide, flat, metallic surface - that's the BLADE, not the handle!"
```

**Key Points**:
- Weapon orientation (blade up, handle down)
- Critical distinctions between parts
- Visual cues for identification
- Common mistakes to avoid

### Additional Guidance

Dynamic hint insertion:

```json
"additionalGuidance": "\n\nAdditional guidance: ${promptHint}"
```

**Purpose**: Inject context-specific hints

**Example**:
```
Additional guidance: This is a spear - the grip is the narrow shaft section, NOT the spearhead
```

### Restrictions

What NOT to select:

```json
"restrictions": "\n\nDO NOT select:\n- The blade (wide, flat, sharp part)\n- The guard/crossguard\n- Decorative elements\n- The pommel alone\n\nONLY select the cylindrical grip area where fingers would wrap around."
```

**Clarifications**:
- Exclude blade
- Exclude crossguard
- Exclude decorative elements
- Exclude pommel by itself
- Focus on actual grip area

### Response Format

Structured JSON output specification:

```json
"responseFormat": "\n\nRespond with ONLY a JSON object in this exact format:\n{\n  \"gripBounds\": {\n    \"minX\": <pixel coordinate 0-512>,\n    \"minY\": <pixel coordinate 0-512>,\n    \"maxX\": <pixel coordinate 0-512>,\n    \"maxY\": <pixel coordinate 0-512>\n  },\n  \"confidence\": <number 0-1>,\n  \"weaponType\": \"<sword|axe|mace|staff|bow|dagger|spear|etc>\",\n  \"gripDescription\": \"<brief description of grip location>\",\n  \"detectedParts\": {\n    \"blade\": \"<describe what you identified as the blade>\",\n    \"handle\": \"<describe what you identified as the handle>\",\n    \"guard\": \"<describe if you see a guard/crossguard>\"\n  }\n}"
```

**Response Structure**:

```typescript
interface GripDetectionResponse {
  gripBounds: {
    minX: number  // 0-512 pixels
    minY: number  // 0-512 pixels
    maxX: number  // 0-512 pixels
    maxY: number  // 0-512 pixels
  }
  confidence: number  // 0.0-1.0
  weaponType: string
  gripDescription: string
  detectedParts: {
    blade: string
    handle: string
    guard?: string
  }
}
```

**Example Response**:

```json
{
  "gripBounds": {
    "minX": 200,
    "minY": 350,
    "maxX": 312,
    "maxY": 480
  },
  "confidence": 0.95,
  "weaponType": "sword",
  "gripDescription": "Leather-wrapped handle below crossguard, lower 25% of weapon",
  "detectedParts": {
    "blade": "Wide flat metallic blade in upper portion with central fuller",
    "handle": "Narrow wrapped grip section below crossguard, brown leather texture",
    "guard": "Horizontal crossguard separating blade from handle at Y=340"
  }
}
```

---

## Material Prompts

Material prompts provide templates for retexturing assets with different materials.

**File**: `/public/prompts/material-prompts.json`

### File Structure

```json
{
  "__comment": "Material generation prompts - templates for material variations",
  "version": "1.0.0",
  "templates": { /* template strings */ },
  "customOverrides": { /* material-specific overrides */ }
}
```

### Templates

Generic templates using variable substitution:

#### RuneScape Template

```json
"runescape": "${materialId} texture, low-poly RuneScape style"
```

**Variables**:
- `${materialId}` - Material identifier (bronze, steel, etc.)

**Example**:
```
materialId: "bronze"
Result: "bronze texture, low-poly RuneScape style"
```

#### Generic Template

```json
"generic": "${materialId} texture"
```

**Purpose**: Minimal template for flexible interpretation

**Example**:
```
materialId: "oak"
Result: "oak texture"
```

### Custom Overrides

Material-specific prompt overrides:

```json
"customOverrides": {
  "dragon": "legendary dragon scale texture, deep crimson red, metallic shimmer, magical aura, RuneScape 2007 style",
  "crystal": "transparent crystal texture, cyan glow, internal facets, magical energy, RuneScape 2007 style"
}
```

**Purpose**: Complex materials need detailed descriptions beyond templates

**When to Use**:
- Special/legendary materials
- Complex visual effects
- Multi-layer textures
- Materials with unique properties

---

## GPT-4 Enhancement Prompts

GPT-4 enhancement prompts guide prompt optimization before image generation.

**File**: `/public/prompts/gpt4-enhancement-prompts.json`

### File Structure

```json
{
  "__comment": "GPT-4 prompt enhancement system prompts",
  "version": "1.0.0",
  "systemPrompt": { /* system-level instructions */ },
  "typeSpecific": { /* asset-type specific rules */ }
}
```

### System Prompt

Base instructions for prompt enhancement:

#### Base Instructions

```json
"base": "You are an expert at optimizing prompts for 3D asset generation. \nYour task is to enhance the user's description to create better results with image generation and 3D conversion."
```

**Role Definition**: Expert prompt optimizer

**Goal**: Improve prompts for better 3D results

#### Focus Points

```json
"focusPoints": [
  "Clear, specific visual details",
  "Material and texture descriptions",
  "Geometric shape and form",
  "Style consistency (especially for ${config.style || 'low-poly RuneScape'} style)"
]
```

**Enhancement Areas**:
1. Visual clarity and specificity
2. Material properties
3. Geometric descriptions
4. Style adherence

#### Closing Instruction

```json
"closingInstruction": "Keep the enhanced prompt concise but detailed."
```

**Balance**: Detailed enough for accuracy, concise enough for processing

### Type-Specific Prompts

Asset-type specific enhancement rules:

#### Avatar Enhancement

```json
"avatar": {
  "critical": "CRITICAL for characters: The character MUST be in a T-pose (arms stretched out horizontally, legs slightly apart) for proper rigging. The character must have EMPTY HANDS - no weapons, tools, or held items. Always add \"standing in T-pose with empty hands\" to the description.",
  "focus": "- T-pose stance with empty hands for rigging compatibility"
}
```

**Critical Requirements**:
- T-pose mandatory
- Empty hands (no held items)
- Explicit pose instruction

**Why Critical**: Rigging failures if not in T-pose

#### Armor Enhancement

```json
"armor": {
  "base": "CRITICAL for armor pieces: The armor must be shown ALONE without any armor stand, mannequin, or body inside.",
  "chest": "EXTRA IMPORTANT for chest/body armor: This MUST be shaped for a SCARECROW POSE (T-POSE) - imagine a scarecrow with arms sticking STRAIGHT OUT SIDEWAYS. The shoulder openings MUST point STRAIGHT OUT HORIZONTALLY at 90 degrees from the body, NOT downward or forward! The chest piece should look like a wide \"T\" or cross shape. From above, the shoulder openings should form a straight line across. The armor should END AT THE SHOULDERS - no arm extensions or sleeves past the shoulder joint.",
  "positioning": "The armor MUST be positioned and SHAPED for a SCARECROW/T-POSE body - shoulder openings pointing STRAIGHT SIDEWAYS, not down. The armor piece must have OPEN HOLES where the body parts go through. Always specify \"floating armor piece shaped for scarecrow/T-pose body, shoulder openings pointing straight sideways at 90 degrees, no extensions, hollow openings, no armor stand\" in the description.",
  "enhancementPrefix": "Enhance this armor piece description for 3D generation. CRITICAL: The armor must be SHAPED FOR A T-POSE BODY - shoulder openings must point STRAIGHT SIDEWAYS at 90 degrees (like a scarecrow), NOT angled downward! Should look like a wide \"T\" shape. Ends at shoulders (no arm extensions), hollow openings, no armor stand: ",
  "focus": [
    "- Armor SHAPED for T-pose body (shoulder openings pointing straight sideways, not down)",
    "- Chest armor should form a \"T\" or cross shape when viewed from above",
    "- Shoulder openings at 180° angle to each other (straight line across)"
  ]
}
```

**Chest Armor Critical Points**:
- Scarecrow/T-pose shape
- Shoulder openings at 90° horizontal
- Wide "T" shape from front
- Ends at shoulders
- No arm extensions
- Hollow openings

**Why So Detailed**: Shoulder angle is the #1 armor fitting failure point

### Enhancement Example

**User Input**:
```
"bronze chest plate"
```

**After Enhancement**:
```
"bronze chest plate armor piece, floating without stand, SHAPED FOR T-POSE BODY with shoulder openings pointing STRAIGHT OUT SIDEWAYS at 90 degrees like a scarecrow, wide T-shape when viewed from front, ends at shoulders with no arm extensions, hollow shoulder openings, bronze metal texture with copper brown color and slightly dull metallic finish, low-poly RuneScape 2007 style"
```

**Improvements**:
- T-pose shaping specified
- Shoulder angle emphasized (90° sideways)
- Geometric shape described ("T" shape)
- Material details added
- Style consistency maintained

---

## Prompt Loading System

How prompts are loaded and accessed in the application.

### Server-Side Loading

**Node.js/Express**:

```javascript
import fs from 'fs'
import path from 'path'

function loadPromptFile(filename) {
  const promptPath = path.join(process.cwd(), 'public/prompts', filename)
  const data = fs.readFileSync(promptPath, 'utf8')
  return JSON.parse(data)
}

// Load specific prompt files
const assetTypePrompts = loadPromptFile('asset-type-prompts.json')
const generationPrompts = loadPromptFile('generation-prompts.json')
const stylePrompts = loadPromptFile('game-style-prompts.json')
```

### Client-Side Loading

**React/Vite**:

```typescript
async function loadPrompts<T>(filename: string): Promise<T> {
  const response = await fetch(`/prompts/${filename}`)
  if (!response.ok) {
    throw new Error(`Failed to load prompts: ${filename}`)
  }
  return response.json()
}

// Usage
const assetPrompts = await loadPrompts<AssetTypePrompts>('asset-type-prompts.json')
const stylePrompts = await loadPrompts<GameStylePrompts>('game-style-prompts.json')
```

### Caching Strategy

**Server-Side Caching**:

```javascript
const promptCache = new Map()

function loadPromptsWithCache(filename) {
  if (promptCache.has(filename)) {
    return promptCache.get(filename)
  }

  const prompts = loadPromptFile(filename)
  promptCache.set(filename, prompts)
  return prompts
}
```

**Client-Side Caching**:

```typescript
const promptCache = new Map<string, any>()

async function getCachedPrompts<T>(filename: string): Promise<T> {
  if (promptCache.has(filename)) {
    return promptCache.get(filename)
  }

  const prompts = await loadPrompts<T>(filename)
  promptCache.set(filename, prompts)
  return prompts
}
```

### Type Definitions

**TypeScript Interfaces**:

```typescript
interface AssetTypePrompts {
  __comment: string
  version: string
  avatar: {
    default: Record<string, AssetTypeDefinition>
    custom: Record<string, AssetTypeDefinition>
  }
  item: {
    default: Record<string, AssetTypeDefinition>
    custom: Record<string, AssetTypeDefinition>
  }
}

interface AssetTypeDefinition {
  name: string
  prompt: string
  placeholder: string
}

interface GameStylePrompts {
  __comment: string
  version: string
  default: Record<string, StyleDefinition>
  custom: Record<string, StyleDefinition>
}

interface StyleDefinition {
  name: string
  base: string
  enhanced?: string
  generation?: string
  fallback?: string
}
```

---

## Template Syntax

Template syntax enables dynamic content insertion into prompts.

### Variable Syntax

**Format**: `${variableName}`

**Examples**:
```
${description}
${style}
${assetType}
${materialId}
${config.description}
${angle || 'side'}
```

### Basic Variables

Simple variable substitution:

```javascript
const template = "${description}. ${style} style."
const values = { description: "bronze sword", style: "RuneScape" }
const result = template.replace(/\$\{(\w+)\}/g, (_, key) => values[key])
// Result: "bronze sword. RuneScape style."
```

### Nested Variables

Accessing nested object properties:

```javascript
const template = "${config.description}. ${config.style} style."
const values = {
  config: {
    description: "steel axe",
    style: "low-poly"
  }
}
```

### Default Values

Using OR operator for fallbacks:

```
${style || 'game-ready'}
${angle || 'side'}
${config.quality || 'standard'}
```

**Behavior**:
- If `style` exists, use it
- If `style` is undefined, use `'game-ready'`

### Template Functions

**Replace Function**:

```javascript
function fillTemplate(template, values) {
  return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
    // Handle "a || b" syntax
    if (path.includes('||')) {
      const [varPath, defaultValue] = path.split('||').map(s => s.trim())
      const value = getNestedValue(values, varPath)
      return value !== undefined ? value : defaultValue.replace(/['"]/g, '')
    }

    // Handle nested paths like "config.style"
    return getNestedValue(values, path) || match
  })
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}
```

**Usage**:

```javascript
const template = "${config.name}. ${config.style || 'default'} style."
const values = { config: { name: "sword" } }
const result = fillTemplate(template, values)
// Result: "sword. default style."
```

---

## Custom Prompt Creation

Guide to creating and managing custom prompts.

### Adding Custom Asset Types

**Step 1: Open File**

Edit `/public/prompts/asset-type-prompts.json`

**Step 2: Add to Custom Section**

```json
"custom": {
  "mount": {
    "name": "Mount",
    "prompt": "rideable creature or vehicle",
    "placeholder": "Show the mount in a standing neutral pose, suitable for rider attachment"
  }
}
```

**Step 3: Use in Application**

Custom types appear automatically in asset type dropdowns.

### Adding Custom Game Styles

**Step 1: Open File**

Edit `/public/prompts/game-style-prompts.json`

**Step 2: Add to Custom Section**

```json
"custom": {
  "pixel-art": {
    "name": "Pixel Art",
    "base": "pixel art style, retro 8-bit aesthetic",
    "enhanced": "pixel art style with clear voxel-like geometry, retro 8-bit color palette, sharp edges"
  }
}
```

**Step 3: Select in UI**

Custom styles appear in style selection dropdown.

### Creating Material Override Prompts

**Step 1: Open File**

Edit `/public/prompts/material-prompts.json`

**Step 2: Add Override**

```json
"customOverrides": {
  "obsidian": "volcanic glass texture, glossy black with purple iridescence, sharp crystalline structure, fantasy game style"
}
```

**Step 3: Use Material**

When "obsidian" material is selected, override prompt is used.

### Custom GPT-4 Enhancement Rules

**Step 1: Open File**

Edit `/public/prompts/gpt4-enhancement-prompts.json`

**Step 2: Add Type-Specific Rule**

```json
"typeSpecific": {
  "building": {
    "critical": "Buildings must be shown from an isometric view at 45 degrees, with clear base and roof structure visible.",
    "focus": "- Isometric perspective\n- Clear structural elements\n- Base foundation visible"
  }
}
```

**Step 3: Enhancement Applied**

When generating buildings, these rules are automatically applied.

### Best Practices

**Naming Conventions**:
- Use kebab-case for IDs: `"pixel-art"`, `"dark-souls-style"`
- Use Title Case for names: `"Pixel Art"`, `"Dark Souls Style"`

**Prompt Writing**:
- Be specific and descriptive
- Include art style references
- Mention geometric requirements
- Specify pose/orientation requirements
- Keep prompts under 500 characters

**Testing**:
- Test prompts with multiple asset types
- Verify AI interpretation
- Check 3D conversion quality
- Iterate based on results

**Documentation**:
- Add comments explaining complex prompts
- Document expected outputs
- Note any special requirements

---

## Summary

The prompt template system provides:

1. **7 Prompt Files** - Organized by purpose (type, style, generation, etc.)
2. **Template Variables** - Dynamic content with `${variable}` syntax
3. **Default + Custom** - Built-in prompts with custom extension support
4. **Type Safety** - TypeScript interfaces for structured data
5. **Versioning** - Semantic versioning for compatibility
6. **Modular Design** - Separate concerns for maintainability
7. **AI Optimization** - GPT-4 enhancement for better results

**Quick Reference**:

**Prompt Files**:
- `asset-type-prompts.json` - Avatar/item categories
- `generation-prompts.json` - Base generation templates
- `game-style-prompts.json` - Art style definitions
- `weapon-detection-prompts.json` - Grip detection rules
- `material-prompts.json` - Retexture templates
- `gpt4-enhancement-prompts.json` - Prompt optimization

**Template Syntax**:
```javascript
${variableName}           // Simple variable
${object.property}        // Nested property
${value || 'default'}     // With fallback
```

**Adding Custom Prompts**:
1. Open appropriate JSON file
2. Add to `custom` section
3. Follow existing structure
4. Test with generation pipeline

**Best Practices**:
- Keep prompts specific and detailed
- Test with multiple asset types
- Use templates for consistency
- Document complex requirements
- Version changes appropriately
