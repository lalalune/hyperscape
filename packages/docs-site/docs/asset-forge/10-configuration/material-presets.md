# Material Presets

This comprehensive guide covers the material preset system in Asset Forge, including built-in materials, custom material creation, material categories, tier systems, and the JSON configuration format.

## Table of Contents

1. [Overview](#overview)
2. [Built-In Material Presets](#built-in-material-presets)
3. [Material Structure](#material-structure)
4. [Material Categories](#material-categories)
5. [Tier System](#tier-system)
6. [Custom Material Creation](#custom-material-creation)
7. [Material Prompt Templates](#material-prompt-templates)
8. [Preset Management](#preset-management)
9. [JSON File Format](#json-file-format)
10. [Integration with Generation Pipeline](#integration-with-generation-pipeline)

---

## Overview

The material preset system enables automatic retexturing of 3D assets to create material variants. Materials define appearance through colors, texture descriptions, and AI prompt engineering.

### Material System Architecture

```
Material Preset
    ↓
  Material ID + Style Prompt
    ↓
  AI Image Generation (GPT-4 → DALL-E)
    ↓
  3D Retexturing (Meshy API)
    ↓
  Variant Asset
```

### Key Features

- **9 Built-in presets** covering metals, woods, and leathers
- **Custom materials** via JSON configuration
- **Tier-based organization** (1-10 scale)
- **Category system** for logical grouping
- **Color theming** for UI consistency
- **Style prompts** for AI generation
- **RuneScape 2007 aesthetic** by default

### File Locations

```
/public/prompts/material-presets.json   # Material definitions
/src/constants/materials.ts             # Tier colors and helpers
/server/services/RetextureService.mjs   # Retexturing logic
```

---

## Built-In Material Presets

Asset Forge includes 9 pre-configured material presets organized into 4 categories.

### Metal Materials

#### Bronze

```json
{
  "id": "bronze",
  "name": "bronze",
  "displayName": "Bronze",
  "category": "metal",
  "tier": 1,
  "color": "#CD7F32",
  "stylePrompt": "bronze metal texture, copper brown color, slightly dull metallic finish, RuneScape 2007 style",
  "description": "Basic copper-brown metal, entry-level equipment"
}
```

**Characteristics**:
- Copper-brown appearance (#CD7F32)
- Entry-level material (tier 1)
- Slightly dull metallic finish
- Common in early-game equipment

**Visual Style**: Warm brown metal with subtle patina, reminiscent of ancient bronze artifacts.

#### Steel

```json
{
  "id": "steel",
  "name": "steel",
  "displayName": "Steel",
  "category": "metal",
  "tier": 2,
  "color": "#C0C0C0",
  "stylePrompt": "steel metal texture, silver gray color, polished metallic finish, RuneScape 2007 style",
  "description": "Silver-gray metal, intermediate quality equipment"
}
```

**Characteristics**:
- Silver-gray appearance (#C0C0C0)
- Intermediate material (tier 2)
- Polished metallic finish
- Standard mid-game equipment

**Visual Style**: Classic shiny silver metal with reflective surface, clean and professional.

#### Mithril

```json
{
  "id": "mithril",
  "name": "mithril",
  "displayName": "Mithril",
  "category": "metal",
  "tier": 3,
  "color": "#4169E1",
  "stylePrompt": "mithril metal texture, blue-gray color with magical shimmer, fantasy metallic finish, RuneScape 2007 style",
  "description": "Magical blue-gray metal, high-quality equipment"
}
```

**Characteristics**:
- Blue-gray appearance (#4169E1)
- High-quality material (tier 3)
- Magical shimmer effect
- Fantasy-themed equipment

**Visual Style**: Ethereal blue-tinted metal with subtle magical glow, otherworldly and rare.

### Wood Materials

#### Wood (Basic)

```json
{
  "id": "wood",
  "name": "wood",
  "displayName": "Wood",
  "category": "wood",
  "tier": 1,
  "color": "#DEB887",
  "stylePrompt": "light wood texture, natural pine color, basic wooden finish, RuneScape 2007 style",
  "description": "Basic light wood, entry-level equipment"
}
```

**Characteristics**:
- Light tan appearance (#DEB887)
- Entry-level wood (tier 1)
- Natural pine color
- Simple wooden finish

**Visual Style**: Light-colored softwood with visible grain, basic and functional.

#### Oak

```json
{
  "id": "oak",
  "name": "oak",
  "displayName": "Oak",
  "category": "wood",
  "tier": 2,
  "color": "#8B4513",
  "stylePrompt": "oak wood texture, medium brown color, solid wooden finish, RuneScape 2007 style",
  "description": "Strong oak wood, intermediate quality"
}
```

**Characteristics**:
- Medium brown appearance (#8B4513)
- Intermediate wood (tier 2)
- Solid, durable appearance
- Stronger than basic wood

**Visual Style**: Rich brown hardwood with pronounced grain patterns, sturdy and reliable.

#### Willow

```json
{
  "id": "willow",
  "name": "willow",
  "displayName": "Willow",
  "category": "wood",
  "tier": 3,
  "color": "#9ACD32",
  "stylePrompt": "willow wood texture, pale yellow-green color, flexible wooden finish, RuneScape 2007 style",
  "description": "Flexible willow wood, good for bows"
}
```

**Characteristics**:
- Yellow-green appearance (#9ACD32)
- High-quality wood (tier 3)
- Flexible, resilient material
- Ideal for bows and staffs

**Visual Style**: Pale greenish wood with smooth finish, flexible and springy appearance.

### Leather Materials

#### Leather (Basic)

```json
{
  "id": "leather",
  "name": "leather",
  "displayName": "Leather",
  "category": "leather",
  "tier": 1,
  "color": "#8B4513",
  "stylePrompt": "brown leather texture, natural cowhide, worn leather finish, RuneScape 2007 style",
  "description": "Basic brown leather, entry-level armor"
}
```

**Characteristics**:
- Brown appearance (#8B4513)
- Entry-level leather (tier 1)
- Natural cowhide texture
- Worn, practical finish

**Visual Style**: Traditional brown leather with natural texture and slight wear marks.

#### Hard Leather

```json
{
  "id": "hard-leather",
  "name": "hard-leather",
  "displayName": "Hard Leather",
  "category": "leather",
  "tier": 2,
  "color": "#654321",
  "stylePrompt": "hardened brown leather texture, reinforced cowhide, sturdy leather finish, RuneScape 2007 style",
  "description": "Reinforced leather, improved protection"
}
```

**Characteristics**:
- Dark brown appearance (#654321)
- Intermediate leather (tier 2)
- Hardened, reinforced texture
- Better protection than basic

**Visual Style**: Darker, stiffer leather with reinforced appearance, more protective.

#### Studded Leather

```json
{
  "id": "studded-leather",
  "name": "studded-leather",
  "displayName": "Studded Leather",
  "category": "leather",
  "tier": 3,
  "color": "#8B4513",
  "stylePrompt": "studded leather texture, brown leather with metal studs, reinforced leather finish, RuneScape 2007 style",
  "description": "Leather reinforced with metal studs"
}
```

**Characteristics**:
- Brown base with metal accents (#8B4513)
- High-quality leather (tier 3)
- Metal stud reinforcement
- Maximum leather protection

**Visual Style**: Brown leather decorated with metallic studs, combination of leather flexibility and metal strength.

### Special Materials

#### Dragon

```json
{
  "id": "dragon",
  "name": "dragon",
  "displayName": "Dragon",
  "category": "custom",
  "tier": 10,
  "color": "#fa0000",
  "stylePrompt": "Dragon metal texture, red with matte finish, RuneScape 2007 style",
  "description": "Custom material"
}
```

**Characteristics**:
- Bright red appearance (#fa0000)
- Maximum tier (10)
- Custom category
- Legendary/rare material

**Visual Style**: Vibrant red metallic surface with matte finish, iconic end-game material.

---

## Material Structure

Each material preset follows a consistent JSON structure with required and optional fields.

### Required Fields

```typescript
interface MaterialPreset {
  id: string              // Unique identifier (lowercase, kebab-case)
  name: string            // Internal name (matches id)
  displayName: string     // Human-readable name for UI
  category: string        // Material category (metal, wood, leather, custom)
  tier: number           // Tier level 1-10
  color: string          // Hex color code for UI theming
  stylePrompt: string    // AI generation prompt
  description?: string   // Optional user-facing description
}
```

### Field Specifications

#### id

**Type**: String
**Format**: Lowercase kebab-case
**Example**: `"bronze"`, `"hard-leather"`, `"studded-leather"`

**Requirements**:
- Unique across all materials
- No spaces or special characters
- Use hyphens for multi-word names
- Should be URL-safe

**Usage**: Database keys, file naming, API parameters

#### name

**Type**: String
**Format**: Matches `id` field
**Example**: `"bronze"`, `"hard-leather"`

**Purpose**: Legacy compatibility, internal references

#### displayName

**Type**: String
**Format**: Title case, human-readable
**Example**: `"Bronze"`, `"Hard Leather"`, `"Studded Leather"`

**Purpose**: UI display, dropdowns, asset cards

**Guidelines**:
- Proper capitalization
- Can include spaces
- Should be concise (1-3 words)

#### category

**Type**: String
**Values**: `"metal"`, `"wood"`, `"leather"`, `"custom"`, `"special"`
**Example**: `"metal"`

**Purpose**: Logical grouping, filtering, organization

**Categories**:
- `metal` - Metallic materials (bronze, steel, mithril)
- `wood` - Wooden materials (wood, oak, willow)
- `leather` - Leather materials (leather, hard-leather, studded-leather)
- `custom` - User-defined materials
- `special` - Unique/legendary materials (dragon)

#### tier

**Type**: Integer
**Range**: 1-10
**Example**: `1`, `2`, `3`, `10`

**Purpose**: Power level, sorting, progression

**Tier Guidelines**:
- 1-3: Common materials (early game)
- 4-6: Uncommon materials (mid game)
- 7-9: Rare materials (late game)
- 10: Legendary materials (end game)

#### color

**Type**: String (Hex color code)
**Format**: `#RRGGBB`
**Example**: `"#CD7F32"`, `"#4169E1"`

**Purpose**: UI theming, asset cards, badges

**Color Selection**:
- Should represent material visually
- Maintain contrast for readability
- Consider color blindness accessibility
- Test against light and dark backgrounds

#### stylePrompt

**Type**: String
**Format**: Natural language description
**Example**: `"bronze metal texture, copper brown color, slightly dull metallic finish, RuneScape 2007 style"`

**Purpose**: AI prompt for retexturing

**Prompt Structure**:
```
[Material Type] texture, [Color Description], [Finish Type], [Art Style]
```

**Components**:
1. **Material Type**: bronze metal, oak wood, studded leather
2. **Color Description**: copper brown, silver gray, yellow-green
3. **Finish Type**: polished, dull, matte, glossy
4. **Art Style**: RuneScape 2007 style, low-poly, realistic

**Best Practices**:
- Be specific about texture details
- Include color information
- Specify surface finish (matte, glossy, etc.)
- Reference art style for consistency
- Keep under 200 characters

#### description

**Type**: String (Optional)
**Format**: Brief sentence
**Example**: `"Basic copper-brown metal, entry-level equipment"`

**Purpose**: Tooltip text, help documentation

---

## Material Categories

Materials are organized into logical categories for UI organization and filtering.

### Metal Category

**Identifier**: `"metal"`

**Characteristics**:
- Metallic appearance
- Reflective surfaces
- Hard, durable materials
- Used for weapons and armor

**Built-in Metals**:
1. Bronze (tier 1)
2. Steel (tier 2)
3. Mithril (tier 3)

**Potential Additions**:
- Iron (tier 1-2)
- Adamant (tier 4-5)
- Rune (tier 6-7)
- Dragon (tier 10)

### Wood Category

**Identifier**: `"wood"`

**Characteristics**:
- Natural grain patterns
- Warm, organic appearance
- Lighter weight materials
- Used for bows, staffs, shields

**Built-in Woods**:
1. Wood/Pine (tier 1)
2. Oak (tier 2)
3. Willow (tier 3)

**Potential Additions**:
- Maple (tier 4)
- Yew (tier 5)
- Magic wood (tier 6)

### Leather Category

**Identifier**: `"leather"`

**Characteristics**:
- Flexible, organic texture
- Brown/tan color palette
- Natural material appearance
- Used for light armor

**Built-in Leathers**:
1. Leather (tier 1)
2. Hard Leather (tier 2)
3. Studded Leather (tier 3)

**Potential Additions**:
- Green dragonhide (tier 4)
- Red dragonhide (tier 5)
- Black dragonhide (tier 6)

### Custom Category

**Identifier**: `"custom"`

**Characteristics**:
- User-defined materials
- Unique appearances
- Flexible configurations
- Special use cases

**Usage**:
- Experimental materials
- Game-specific additions
- Themed collections
- Special events

### Special Category

**Identifier**: `"special"`

**Characteristics**:
- Legendary materials
- Unique properties
- High tier (8-10)
- Limited availability

**Examples**:
- Dragon materials
- Crystal materials
- Enchanted materials
- Divine materials

---

## Tier System

The tier system organizes materials by power level and progression.

### Tier Scale

**Range**: 1-10

| Tier | Category | Rarity | Use Case |
|------|----------|--------|----------|
| 1 | Basic | Common | Starting equipment |
| 2 | Improved | Common | Early progression |
| 3 | Quality | Uncommon | Mid-early game |
| 4-5 | Advanced | Uncommon | Mid game |
| 6-7 | Superior | Rare | Late game |
| 8-9 | Elite | Very Rare | End game |
| 10 | Legendary | Legendary | Ultimate gear |

### Tier Distribution

**Current Distribution**:
- Tier 1: Bronze, Wood, Leather (3 materials)
- Tier 2: Steel, Oak, Hard Leather (3 materials)
- Tier 3: Mithril, Willow, Studded Leather (3 materials)
- Tier 10: Dragon (1 material)

**Recommended Expansion**:
```
Tier 1-2: 6 materials (basic options)
Tier 3-5: 6 materials (progression)
Tier 6-8: 4 materials (rare)
Tier 9-10: 2 materials (legendary)
Total: ~18 materials
```

### Tier-Based Sorting

Materials should be sortable by tier for UI display:

```typescript
const sortedMaterials = materials.sort((a, b) => a.tier - b.tier)
```

### Tier Filtering

Filter materials by tier range:

```typescript
const earlyGameMaterials = materials.filter(m => m.tier <= 3)
const endGameMaterials = materials.filter(m => m.tier >= 8)
```

### Tier Colors

Tier colors are defined in `/src/constants/materials.ts`:

```typescript
export const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',    // Tier 1 metal
  steel: '#71797E',     // Tier 2 metal
  mithril: '#26619C',   // Tier 3 metal
  // etc.
}
```

**Usage**:

```typescript
import { getTierColor } from '@/constants'

const badgeColor = getTierColor('bronze')  // '#CD7F32'
```

---

## Custom Material Creation

Users can create custom materials by adding entries to `material-presets.json`.

### Creating a Custom Material

**Step 1: Define Material Properties**

```json
{
  "id": "crystal",
  "name": "crystal",
  "displayName": "Crystal",
  "category": "special",
  "tier": 8,
  "color": "#00FFFF",
  "stylePrompt": "crystalline material texture, transparent cyan color, magical shimmer, glowing effect, RuneScape 2007 style",
  "description": "Magical crystalline material with inner glow"
}
```

**Step 2: Add to JSON File**

Open `/public/prompts/material-presets.json` and add the new material to the array.

**Step 3: Test Material**

Generate an asset variant using the new material to verify appearance.

### Custom Material Examples

#### Obsidian Material

```json
{
  "id": "obsidian",
  "name": "obsidian",
  "displayName": "Obsidian",
  "category": "special",
  "tier": 7,
  "color": "#1C1C1C",
  "stylePrompt": "obsidian volcanic glass texture, glossy black color with purple reflections, sharp edges, RuneScape 2007 style",
  "description": "Volcanic glass material, sharp and dark"
}
```

#### Gold Material

```json
{
  "id": "gold",
  "name": "gold",
  "displayName": "Gold",
  "category": "metal",
  "tier": 4,
  "color": "#FFD700",
  "stylePrompt": "gold metal texture, bright yellow-gold color, highly polished metallic finish, RuneScape 2007 style",
  "description": "Precious gold metal, ornamental equipment"
}
```

#### Mahogany Material

```json
{
  "id": "mahogany",
  "name": "mahogany",
  "displayName": "Mahogany",
  "category": "wood",
  "tier": 4,
  "color": "#C04000",
  "stylePrompt": "mahogany wood texture, rich reddish-brown color, fine grain pattern, polished wooden finish, RuneScape 2007 style",
  "description": "Exotic hardwood, deep red-brown color"
}
```

### Custom Material Guidelines

**Naming**:
- Use lowercase kebab-case for `id` and `name`
- Use Title Case for `displayName`
- Keep names concise and descriptive

**Categorization**:
- Choose appropriate category
- Consider creating new categories for themed sets
- Use `custom` for experimental materials

**Tier Assignment**:
- Consider material power/quality
- Maintain balance within category
- Reserve tier 10 for truly legendary materials

**Color Selection**:
- Choose representative hex color
- Test against UI backgrounds
- Ensure sufficient contrast

**Style Prompt**:
- Be specific and descriptive
- Include texture, color, finish, and style
- Reference art direction
- Test prompt with AI generation

---

## Material Prompt Templates

Material prompts can use templates for consistency across game styles.

### Prompt Template System

**File**: `/public/prompts/material-prompts.json`

```json
{
  "version": "1.0.0",
  "templates": {
    "runescape": "${materialId} texture, low-poly RuneScape style",
    "generic": "${materialId} texture"
  },
  "customOverrides": {}
}
```

### Template Variables

**Available Variables**:
- `${materialId}` - Material identifier
- `${materialName}` - Display name
- `${category}` - Material category

**Example Usage**:

```javascript
const template = templates.runescape
const prompt = template.replace('${materialId}', 'bronze')
// Result: "bronze texture, low-poly RuneScape style"
```

### Style-Specific Templates

Different game styles may require different prompt formats:

```json
{
  "templates": {
    "runescape": "${materialId} texture, low-poly RuneScape 2007 style, simple textures",
    "realistic": "${materialId} material, photorealistic PBR textures, 4K resolution",
    "stylized": "${materialId} material, hand-painted stylized art, vibrant colors",
    "lowpoly": "${materialId} texture, flat colors, low-poly game asset style"
  }
}
```

### Custom Overrides

Override templates for specific materials:

```json
{
  "customOverrides": {
    "dragon": "legendary dragon scale texture, deep crimson red, metallic shimmer, magical aura, RuneScape 2007 style",
    "crystal": "transparent crystal texture, cyan glow, internal facets, magical energy, RuneScape 2007 style"
  }
}
```

---

## Preset Management

### Loading Material Presets

**Server-Side Loading**:

```javascript
import fs from 'fs'
import path from 'path'

function loadMaterialPresets() {
  const presetsPath = path.join(process.cwd(), 'public/prompts/material-presets.json')
  const data = fs.readFileSync(presetsPath, 'utf8')
  return JSON.parse(data)
}
```

**Client-Side Loading**:

```typescript
async function fetchMaterialPresets() {
  const response = await fetch('/prompts/material-presets.json')
  return response.json()
}
```

### Filtering Presets

**By Category**:

```typescript
const metalMaterials = presets.filter(m => m.category === 'metal')
```

**By Tier Range**:

```typescript
const midTierMaterials = presets.filter(m => m.tier >= 3 && m.tier <= 6)
```

**By Search Term**:

```typescript
const searchResults = presets.filter(m =>
  m.displayName.toLowerCase().includes(searchTerm.toLowerCase())
)
```

### Sorting Presets

**By Tier**:

```typescript
const sortedByTier = [...presets].sort((a, b) => a.tier - b.tier)
```

**By Name**:

```typescript
const sortedByName = [...presets].sort((a, b) =>
  a.displayName.localeCompare(b.displayName)
)
```

**By Category Then Tier**:

```typescript
const sorted = [...presets].sort((a, b) => {
  if (a.category !== b.category) {
    return a.category.localeCompare(b.category)
  }
  return a.tier - b.tier
})
```

### Validating Presets

```typescript
function validateMaterialPreset(material: any): boolean {
  const required = ['id', 'name', 'displayName', 'category', 'tier', 'color', 'stylePrompt']

  // Check required fields
  for (const field of required) {
    if (!(field in material)) {
      console.error(`Missing required field: ${field}`)
      return false
    }
  }

  // Validate tier range
  if (material.tier < 1 || material.tier > 10) {
    console.error(`Invalid tier: ${material.tier} (must be 1-10)`)
    return false
  }

  // Validate color format
  if (!/^#[0-9A-F]{6}$/i.test(material.color)) {
    console.error(`Invalid color format: ${material.color}`)
    return false
  }

  return true
}
```

---

## JSON File Format

The complete material presets file structure and best practices.

### File Structure

**Location**: `/public/prompts/material-presets.json`

**Format**: JSON array of material objects

```json
[
  {
    "id": "bronze",
    "name": "bronze",
    "displayName": "Bronze",
    "category": "metal",
    "tier": 1,
    "color": "#CD7F32",
    "stylePrompt": "bronze metal texture, copper brown color, slightly dull metallic finish, RuneScape 2007 style",
    "description": "Basic copper-brown metal, entry-level equipment"
  },
  {
    "id": "steel",
    "name": "steel",
    "displayName": "Steel",
    "category": "metal",
    "tier": 2,
    "color": "#C0C0C0",
    "stylePrompt": "steel metal texture, silver gray color, polished metallic finish, RuneScape 2007 style",
    "description": "Silver-gray metal, intermediate quality equipment"
  }
]
```

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "name", "displayName", "category", "tier", "color", "stylePrompt"],
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[a-z0-9-]+$"
      },
      "name": {
        "type": "string"
      },
      "displayName": {
        "type": "string",
        "minLength": 1
      },
      "category": {
        "type": "string",
        "enum": ["metal", "wood", "leather", "custom", "special"]
      },
      "tier": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10
      },
      "color": {
        "type": "string",
        "pattern": "^#[0-9A-Fa-f]{6}$"
      },
      "stylePrompt": {
        "type": "string",
        "minLength": 10,
        "maxLength": 500
      },
      "description": {
        "type": "string"
      }
    }
  }
}
```

### Formatting Best Practices

**Indentation**: 2 spaces

**Ordering**: Group by category, then tier

**Line Length**: Keep under 120 characters

**Consistency**: Maintain uniform field order

**Example Organization**:

```json
[
  // Metals (tier 1-3)
  { "id": "bronze", ... },
  { "id": "steel", ... },
  { "id": "mithril", ... },

  // Woods (tier 1-3)
  { "id": "wood", ... },
  { "id": "oak", ... },
  { "id": "willow", ... },

  // Leathers (tier 1-3)
  { "id": "leather", ... },
  { "id": "hard-leather", ... },
  { "id": "studded-leather", ... },

  // Special (tier 10)
  { "id": "dragon", ... }
]
```

---

## Integration with Generation Pipeline

Material presets integrate with the generation pipeline for automatic variant creation.

### Variant Generation Flow

1. **Base Asset Generation** - Create original asset
2. **Material Selection** - Choose material presets
3. **Prompt Enhancement** - Combine base + material prompts
4. **Retexturing** - Generate variant via Meshy API
5. **Asset Storage** - Save variant with material metadata

### Retexturing Service

**File**: `/server/services/RetextureService.mjs`

```javascript
async retexture(modelPath, materialPreset, options) {
  // Load base model
  const model = await this.loadModel(modelPath)

  // Build retexture prompt
  const prompt = this.buildRetexturePrompt(model, materialPreset)

  // Submit to Meshy API
  const taskId = await this.meshyClient.createRetextureTask({
    model_url: modelPath,
    prompt: prompt,
    ai_model: options.aiModel || 'meshy-5'
  })

  // Poll for completion
  const result = await this.pollRetextureStatus(taskId)

  return result
}
```

### Material Prompt Building

```javascript
function buildRetexturePrompt(baseAsset, materialPreset) {
  const baseDescription = baseAsset.description || ''
  const materialStyle = materialPreset.stylePrompt

  return `${baseDescription}. Retextured with ${materialStyle}`
}
```

**Example**:
```
Base: "Iron longsword with crossguard"
Material: "bronze metal texture, copper brown color, slightly dull metallic finish"
Result: "Iron longsword with crossguard. Retextured with bronze metal texture, copper brown color, slightly dull metallic finish"
```

### Batch Variant Creation

```javascript
async function createMaterialVariants(baseAssetId, materialIds) {
  const variants = []

  for (const materialId of materialIds) {
    const material = await loadMaterialPreset(materialId)
    const variant = await retextureService.retexture(
      baseAssetId,
      material,
      { quality: 'high' }
    )
    variants.push(variant)
  }

  return variants
}
```

### Metadata Association

Variants store material information in metadata:

```typescript
interface VariantMetadata extends AssetMetadata {
  baseAssetId: string       // Original asset ID
  materialId: string        // Material preset ID
  materialName: string      // Display name
  materialTier: number      // Tier level
  materialColor: string     // Hex color
}
```

---

## Summary

The material preset system provides:

1. **9 Built-in Materials** - Metals, woods, leathers covering tiers 1-3 and 10
2. **Flexible Structure** - JSON-based configuration with required and optional fields
3. **Category Organization** - Logical grouping by material type
4. **Tier Progression** - 1-10 scale for power/quality levels
5. **Custom Materials** - Easy addition of new materials via JSON
6. **AI Integration** - Style prompts for consistent retexturing
7. **Template System** - Reusable prompt templates by game style
8. **Pipeline Integration** - Automatic variant generation

**Quick Reference**:

**Built-in Materials**:
- Metals: Bronze (1), Steel (2), Mithril (3)
- Woods: Wood (1), Oak (2), Willow (3)
- Leathers: Leather (1), Hard Leather (2), Studded Leather (3)
- Special: Dragon (10)

**File Locations**:
- Material definitions: `/public/prompts/material-presets.json`
- Tier colors: `/src/constants/materials.ts`
- Retexturing logic: `/server/services/RetextureService.mjs`

**Creating Custom Material**:
1. Define JSON object with required fields
2. Add to `material-presets.json`
3. Test with generation pipeline
4. Add tier color to `materials.ts` (optional)

**Best Practices**:
- Use descriptive style prompts
- Maintain tier balance
- Test materials across asset types
- Keep JSON properly formatted
- Document custom additions
