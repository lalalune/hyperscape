# Prompt Engineering

[← Back to Index](../README.md)

---

## AI Prompt System

Asset Forge uses a sophisticated prompt engineering system to generate high-quality 3D assets. The system combines game style prompts, asset type prompts, material prompts, and GPT-4 enhancement to create optimized descriptions for image generation and 3D conversion.

---

## Prompt Architecture

### Layered Prompt System

```
┌─────────────────────────────────────┐
│   User Description                  │
│   "iron sword"                      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   Asset Type Prompt                 │
│   + Weapon-specific requirements    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   Game Style Prompt                 │
│   + "low-poly RuneScape style"      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   GPT-4 Enhancement                 │
│   + Visual details, materials       │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   Final Optimized Prompt            │
│   Ready for image generation        │
└─────────────────────────────────────┘
```

### Prompt Components

1. **Base Description**: User's input text
2. **Asset Type Context**: Type-specific requirements (T-pose, armor shape, etc.)
3. **Style Modifier**: Game art style (RuneScape, realistic, stylized)
4. **Enhancement**: GPT-4 added visual details
5. **Critical Requirements**: Hard constraints (pose, orientation)

---

## Game Style Prompts

### Purpose

Define the visual style and art direction for generated assets.

### Configuration File

**Location**: `/Users/home/hyperscape-1/packages/asset-forge/public/prompts/game-style-prompts.json`

### Default Styles

#### RuneScape 2007

```json
{
  "runescape": {
    "name": "RuneScape 2007",
    "base": "Low-poly RuneScape 2007",
    "enhanced": "low-poly RuneScape style",
    "generation": "runescape2007"
  }
}
```

**Characteristics:**
- Low polygon count (< 1000 triangles)
- Simple, flat shading
- Vibrant, saturated colors
- Minimal texture detail
- Chunky, readable silhouettes
- Nostalgic early 2000s aesthetic

**Example Enhanced Prompt:**
```
"Iron sword with straight blade and crossguard,
low-poly RuneScape style with simple geometry and vibrant metallic sheen"
```

#### Generic Low-Poly

```json
{
  "generic": {
    "name": "Generic Low-Poly",
    "base": "low-poly 3D game asset style",
    "fallback": "Low-poly game asset"
  }
}
```

**Characteristics:**
- Modern low-poly aesthetic
- Clean geometry
- Simple materials
- Game-ready optimization
- Neutral art direction

### Custom Styles

Users can define custom game styles for different art directions:

#### Marvel Style

```json
{
  "marvel": {
    "name": "Marvel",
    "base": "Modern Marvel movie styled design and quality, high resolution, yet 3D game like",
    "enhanced": "Modern Marvel movie styled design and quality, high resolution, yet 3D game like"
  }
}
```

**Use Case**: High-quality superhero assets

#### Skyrim Style

```json
{
  "skyrim-style": {
    "name": "Skyrim Style",
    "base": "Skyrim style quality and design",
    "enhanced": "Skyrim style quality and design"
  }
}
```

**Use Case**: Fantasy RPG assets with realistic medieval aesthetic

#### Realistic

```json
{
  "realistic": {
    "name": "Realistic",
    "base": "Realistic",
    "enhanced": "Realistic"
  }
}
```

**Use Case**: Photorealistic game assets

#### Stylized

```json
{
  "stylized": {
    "name": "Stylized",
    "base": "Stylized hand painted game asset",
    "enhanced": "Stylized hand painted game asset"
  }
}
```

**Use Case**: Cartoon or painterly art styles

### Creating Custom Styles

```typescript
import { PromptService } from '@/services/api/PromptService'

// Load current styles
const styles = await PromptService.getGameStylePrompts()

// Add custom style
styles.custom['my-style'] = {
  name: 'My Custom Style',
  base: 'Description used in base prompts',
  enhanced: 'Description used after GPT-4 enhancement',
  generation: 'optional-tag-for-tracking'
}

// Save
await PromptService.saveGameStylePrompts(styles)
```

### Style Application

```typescript
function buildStylePrompt(userDescription: string, style: string): string {
  const styleConfig = gameStyles[style] || gameStyles.generic

  // Combine user description with style
  return `${userDescription}, ${styleConfig.enhanced || styleConfig.base}`
}

// Example:
buildStylePrompt('iron sword', 'runescape')
// → "iron sword, low-poly RuneScape style"
```

---

## Asset Type Prompts

### Purpose

Provide asset-type-specific requirements and constraints.

### Configuration File

**Location**: `/Users/home/hyperscape-1/packages/asset-forge/public/prompts/asset-type-prompts.json`

### Structure

Prompts are separated by **generation type**:

```json
{
  "avatar": {
    "default": { /* Avatar types */ },
    "custom": { /* User-defined */ }
  },
  "item": {
    "default": { /* Item types */ },
    "custom": { /* User-defined */ }
  }
}
```

### Avatar Type Prompts

#### Character

```json
{
  "character": {
    "name": "Character",
    "prompt": "",
    "placeholder": "Show the full character in T-pose, front view on neutral background"
  }
}
```

**Critical Requirements:**
- **T-pose**: Arms extended horizontally at 90°
- **Empty hands**: No weapons or held items
- **Full body**: Head to feet visible
- **Front view**: Facing camera
- **Neutral background**: No distracting elements

**Example Usage:**
```
"Medieval knight, show the full character in T-pose,
front view on neutral background, low-poly RuneScape style"
```

#### Humanoid

```json
{
  "humanoid": {
    "name": "Humanoid",
    "prompt": "",
    "placeholder": "Show the humanoid character in T-pose with clear proportions"
  }
}
```

**Use Case**: Non-human characters (elves, orcs, aliens) that use humanoid skeleton

#### NPC

```json
{
  "npc": {
    "name": "NPC",
    "prompt": "",
    "placeholder": "Show the NPC character in T-pose, ready for animation"
  }
}
```

**Use Case**: Non-player characters, shopkeepers, quest givers

#### Creature

```json
{
  "creature": {
    "name": "Creature",
    "prompt": "",
    "placeholder": "Show the creature in a neutral pose displaying its features"
  }
}
```

**Use Case**: Animals, monsters, non-humanoid entities
**Note**: May not use T-pose due to different skeleton structure

### Item Type Prompts

#### Weapon

```json
{
  "weapon": {
    "name": "Weapon",
    "prompt": "",
    "placeholder": "Show the full weapon clearly on a neutral background"
  }
}
```

**Requirements:**
- Full weapon visible
- Handle/grip clearly identifiable
- Vertical orientation (blade up, handle down) preferred
- No hands holding it
- Neutral background

**Example:**
```
"Bronze sword, show the full weapon clearly on neutral background,
low-poly RuneScape style with simple crossguard and leather-wrapped handle"
```

#### Armor

```json
{
  "armor": {
    "name": "Armor",
    "prompt": "",
    "placeholder": "Show the armor piece clearly, shaped for T-pose fitting"
  }
}
```

**Critical Requirements:**
- **Shaped for T-pose body**
- **Shoulder openings at 90° (for chest armor)**
- **Hollow interior** (no mannequin)
- **No armor stand**
- **Floating in space**

**Example:**
```
"Iron chest plate, show armor piece shaped for T-pose fitting,
shoulder openings pointing straight sideways,
hollow interior, no armor stand, low-poly RuneScape style"
```

#### Tool

```json
{
  "tool": {
    "name": "Tool",
    "prompt": "",
    "placeholder": "Show the tool from a clear angle displaying its functionality"
  }
}
```

**Use Case**: Pickaxes, hammers, fishing rods, etc.

#### Building

```json
{
  "building": {
    "name": "Building",
    "prompt": "",
    "placeholder": "Show the building structure from an isometric view"
  }
}
```

**Recommended View**: Isometric (45° angle) for clarity

#### Consumable

```json
{
  "consumable": {
    "name": "Consumable",
    "prompt": "",
    "placeholder": "Show the consumable item clearly with recognizable features"
  }
}
```

**Use Case**: Potions, food, scrolls

#### Resource

```json
{
  "resource": {
    "name": "Resource",
    "prompt": "",
    "placeholder": "Show the resource material or item in detail"
  }
}
```

**Use Case**: Ore, wood, cloth, raw materials

---

## Material Prompt Templates

### Purpose

Generate material-specific variations during retexturing.

### Configuration File

**Location**: `/Users/home/hyperscape-1/packages/asset-forge/public/prompts/material-prompts.json`

### Template Structure

```json
{
  "templates": {
    "runescape": "${materialId} texture, low-poly RuneScape style",
    "generic": "${materialId} texture"
  },
  "customOverrides": {}
}
```

### Template Variables

- **${materialId}**: Material name (bronze, iron, steel, etc.)
- **${style}**: Game style (auto-populated)
- **${assetName}**: Original asset name

### Example Materials

**Weapon Materials:**
```typescript
const weaponMaterials = [
  { id: 'bronze', name: 'Bronze', stylePrompt: 'bronze texture, low-poly RuneScape style' },
  { id: 'iron', name: 'Iron', stylePrompt: 'iron texture, low-poly RuneScape style' },
  { id: 'steel', name: 'Steel', stylePrompt: 'steel texture, low-poly RuneScape style' },
  { id: 'mithril', name: 'Mithril', stylePrompt: 'mithril texture, low-poly RuneScape style' },
  { id: 'adamant', name: 'Adamant', stylePrompt: 'adamant texture, low-poly RuneScape style' },
  { id: 'rune', name: 'Rune', stylePrompt: 'rune texture, low-poly RuneScape style' }
]
```

**Armor Materials:**
```typescript
const armorMaterials = [
  { id: 'leather', name: 'Leather', stylePrompt: 'leather armor texture' },
  { id: 'chainmail', name: 'Chainmail', stylePrompt: 'chainmail armor texture' },
  { id: 'plate', name: 'Plate', stylePrompt: 'plate armor texture' }
]
```

### Custom Overrides

Override specific material prompts:

```json
{
  "customOverrides": {
    "mithril": "Mithril texture with blue-silver sheen and magical glow, RuneScape style"
  }
}
```

---

## GPT-4 Enhancement Prompts

### Purpose

Use GPT-4 to intelligently enhance user descriptions with visual details.

### Configuration File

**Location**: `/Users/home/hyperscape-1/packages/asset-forge/public/prompts/gpt4-enhancement-prompts.json`

### System Prompt

```json
{
  "base": "You are an expert at optimizing prompts for 3D asset generation. Your task is to enhance the user's description to create better results with image generation and 3D conversion.",
  "focusPoints": [
    "Clear, specific visual details",
    "Material and texture descriptions",
    "Geometric shape and form",
    "Style consistency"
  ],
  "closingInstruction": "Keep the enhanced prompt concise but detailed."
}
```

### Type-Specific Enhancement

#### Avatar Enhancement

```json
{
  "critical": "CRITICAL for characters: The character MUST be in a T-pose (arms stretched out horizontally, legs slightly apart) for proper rigging. The character must have EMPTY HANDS - no weapons, tools, or held items. Always add \"standing in T-pose with empty hands\" to the description.",
  "focus": "- T-pose stance with empty hands for rigging compatibility"
}
```

**Enhancement Process:**
1. Verify T-pose instruction present
2. Add "empty hands" if missing
3. Add visual details (outfit, features)
4. Maintain style consistency

**Example:**

**Input**: "Orc warrior"

**Enhanced**:
```
"Muscular orc warrior with green skin and tusks,
wearing leather armor and fur accessories.
Standing in T-pose with arms stretched horizontally and empty hands.
Legs slightly apart, facing forward.
Low-poly RuneScape style with simple geometry and vibrant colors."
```

#### Armor Enhancement

```json
{
  "base": "CRITICAL for armor pieces: The armor must be shown ALONE without any armor stand, mannequin, or body inside.",
  "chest": "EXTRA IMPORTANT for chest/body armor: This MUST be shaped for a SCARECROW POSE (T-POSE) - imagine a scarecrow with arms sticking STRAIGHT OUT SIDEWAYS. The shoulder openings MUST point STRAIGHT OUT HORIZONTALLY at 90 degrees from the body, NOT downward or forward!",
  "positioning": "The armor MUST be positioned and SHAPED for a SCARECROW/T-POSE body - shoulder openings pointing STRAIGHT SIDEWAYS, not down.",
  "enhancementPrefix": "Enhance this armor piece description for 3D generation. CRITICAL: The armor must be SHAPED FOR A T-POSE BODY - shoulder openings must point STRAIGHT SIDEWAYS at 90 degrees (like a scarecrow), NOT angled downward!",
  "focus": [
    "- Armor SHAPED for T-pose body (shoulder openings pointing straight sideways, not down)",
    "- Chest armor should form a \"T\" or cross shape when viewed from above",
    "- Shoulder openings at 180° angle to each other (straight line across)"
  ]
}
```

**Enhancement Process:**
1. Verify "no armor stand" instruction
2. Add "shaped for T-pose" requirement
3. Specify shoulder opening angle (90°)
4. Add material/visual details
5. Ensure hollow interior

**Example:**

**Input**: "Bronze chest plate"

**Enhanced**:
```
"Bronze chest plate armor piece shaped for T-pose body.
Shoulder openings pointing straight sideways at 90 degrees from center,
forming a wide T-shape when viewed from above.
Hollow interior with no mannequin or armor stand.
Simple bronze plates with rivets and leather straps.
Ends at shoulders with no arm extensions.
Low-poly RuneScape style with clean geometry."
```

#### Item Enhancement

**Enhancement Process:**
1. Add material details
2. Specify geometric features
3. Add functional elements
4. Maintain style

**Example:**

**Input**: "Health potion"

**Enhanced**:
```
"Small glass potion bottle filled with glowing red liquid.
Cork stopper at the top with wax seal.
Cylindrical bottle with rounded bottom.
Red liquid has subtle glow effect.
Simple label with health symbol.
Low-poly RuneScape style with vibrant red color and minimal geometry."
```

### GPT-4 API Call

```typescript
async function enhancePrompt(
  description: string,
  assetType: string,
  style: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(assetType)
  const userPrompt = `Enhance this ${assetType} description for 3D generation: ${description}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 200
    })
  })

  const data = await response.json()
  return data.choices[0].message.content
}
```

---

## Weapon Detection Prompts

### Purpose

Use GPT-4o-mini (vision) to detect weapon handle/grip locations for rigging.

### Configuration File

**Location**: `/Users/home/hyperscape-1/packages/asset-forge/public/prompts/weapon-detection-prompts.json`

### Base Prompt

```json
{
  "basePrompt": "You are analyzing a 3D weapon rendered from the ${angle || 'side'} in a 512x512 pixel image.\nThe weapon is oriented vertically with the blade/head pointing UP and handle pointing DOWN.\n\nYOUR TASK: Identify ONLY the HANDLE/GRIP area where a human hand would hold this weapon.\n\nCRITICAL DISTINCTIONS:\n- HANDLE/GRIP: The narrow cylindrical part designed for holding (usually wrapped, textured, or darker)\n- BLADE: The wide, flat, sharp part used for cutting (usually metallic, reflective, lighter)\n- GUARD/CROSSGUARD: The horizontal piece between blade and handle\n- POMMEL: The weighted end piece at the very bottom of the handle"
}
```

### Visual Cues

The prompt guides GPT-4o-mini to identify:

1. **Texture changes**: Wrapped leather vs. smooth metal
2. **Width changes**: Handle is narrower than blade
3. **Crossguard location**: Separates blade from handle
4. **Position**: Handle is in LOWER portion
5. **Material**: Handle is usually non-metallic

### Response Format

```json
{
  "responseFormat": "{\n  \"gripBounds\": {\n    \"minX\": <pixel coordinate 0-512>,\n    \"minY\": <pixel coordinate 0-512>,\n    \"maxX\": <pixel coordinate 0-512>,\n    \"maxY\": <pixel coordinate 0-512>\n  },\n  \"confidence\": <number 0-1>,\n  \"weaponType\": \"<sword|axe|mace|staff|bow|dagger|spear|etc>\",\n  \"gripDescription\": \"<brief description of grip location>\"\n}"
}
```

### Example Detection

**Input**: Image of iron sword (512x512px)

**GPT-4o-mini Response**:
```json
{
  "gripBounds": {
    "minX": 220,
    "minY": 320,
    "maxX": 292,
    "maxY": 450
  },
  "confidence": 0.95,
  "weaponType": "sword",
  "gripDescription": "Leather-wrapped cylindrical handle between crossguard and pommel",
  "detectedParts": {
    "blade": "Wide metallic blade from Y=50 to Y=280",
    "handle": "Narrow wrapped section from Y=320 to Y=450",
    "guard": "Horizontal crossguard at Y=280-320"
  }
}
```

---

## Generation Prompts

### Purpose

Final prompts sent to image generation after all enhancements.

### Configuration File

**Location**: `/Users/home/hyperscape-1/packages/asset-forge/public/prompts/generation-prompts.json`

### Prompt Construction

```typescript
function buildFinalPrompt(config: GenerationConfig, enhanced: string): string {
  const parts: string[] = []

  // Enhanced description (from GPT-4)
  parts.push(enhanced)

  // Asset type requirements
  if (config.type === 'character') {
    parts.push('standing in T-pose with arms extended horizontally and empty hands')
  } else if (config.type === 'armor') {
    parts.push('armor piece shaped for T-pose body, no armor stand, hollow interior')
  }

  // Style
  if (config.style) {
    const stylePrompt = getStylePrompt(config.style)
    parts.push(stylePrompt)
  }

  // Background
  parts.push('on neutral background')

  // Lighting
  parts.push('evenly lit from multiple angles')

  // View
  if (config.type === 'building') {
    parts.push('isometric view')
  } else {
    parts.push('front view')
  }

  return parts.join(', ')
}
```

### Example Final Prompts

#### Character Example

```
"Muscular orc warrior with green skin, leather armor, and fur accessories,
standing in T-pose with arms extended horizontally and empty hands,
legs slightly apart, facing forward,
low-poly RuneScape style with simple geometry and vibrant colors,
on neutral background, evenly lit from multiple angles, front view"
```

#### Weapon Example

```
"Iron sword with straight double-edged blade, fuller groove down the center,
simple crossguard with slight downward curve,
leather-wrapped wooden grip with visible wrap texture,
round iron pommel, slightly weathered with subtle scratches,
low-poly RuneScape style with clean edges and minimal polygons,
on neutral background, evenly lit from multiple angles, front view"
```

#### Armor Example

```
"Bronze chest plate armor piece shaped for T-pose body,
shoulder openings pointing straight sideways at 90 degrees,
forming wide T-shape when viewed from above,
hollow interior with no mannequin or armor stand,
bronze plates with rivets and leather straps,
ends at shoulders with no arm extensions,
low-poly RuneScape style with clean geometry,
on neutral background, evenly lit from multiple angles, front view"
```

---

## Prompt Loading System

### Service Interface

```typescript
class PromptServiceClass {
  async getGameStylePrompts(): Promise<PromptsResponse<Record<string, GameStylePrompt>>>
  async saveGameStylePrompts(prompts: PromptsResponse<Record<string, GameStylePrompt>>): Promise<void>
  async deleteGameStyle(styleId: string): Promise<boolean>

  async getAssetTypePrompts(): Promise<AssetTypePromptsByCategory>
  async saveAssetTypePrompts(prompts: AssetTypePromptsByCategory): Promise<void>
  async deleteAssetType(typeId: string, category: 'avatar' | 'item'): Promise<boolean>

  async getMaterialPrompts(): Promise<MaterialPromptTemplate>
  async saveMaterialPrompts(prompts: MaterialPromptTemplate): Promise<void>

  mergePrompts<T extends Record<string, unknown>>(defaults: T, custom: T): T
}

export const PromptService = new PromptServiceClass()
```

### Loading Prompts

```typescript
// Load all prompt types
const [gameStyles, assetTypes, materials] = await Promise.all([
  PromptService.getGameStylePrompts(),
  PromptService.getAssetTypePrompts(),
  PromptService.getMaterialPrompts()
])

// Merge default and custom
const allGameStyles = PromptService.mergePrompts(
  gameStyles.default,
  gameStyles.custom
)

// Get specific style
const runescapeStyle = allGameStyles.runescape
```

### Caching Strategy

```typescript
class PromptCache {
  private cache = new Map<string, { data: unknown; timestamp: number }>()
  private ttl = 5 * 60 * 1000  // 5 minutes

  get<T>(key: string): T | undefined {
    const cached = this.cache.get(key)
    if (!cached) return undefined

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }

    return cached.data as T
  }

  set(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }
}
```

---

## Custom Prompt Creation

### Creating Custom Game Style

```typescript
import { PromptService } from '@/services/api/PromptService'

async function createCustomStyle(
  id: string,
  name: string,
  basePrompt: string,
  enhancedPrompt?: string
) {
  const styles = await PromptService.getGameStylePrompts()

  styles.custom[id] = {
    name,
    base: basePrompt,
    enhanced: enhancedPrompt || basePrompt
  }

  await PromptService.saveGameStylePrompts(styles)
}

// Example
await createCustomStyle(
  'pixel-art',
  'Pixel Art',
  '8-bit pixel art style',
  'retro pixel art game asset with vibrant colors'
)
```

### Creating Custom Asset Type

```typescript
async function createCustomAssetType(
  id: string,
  name: string,
  category: 'avatar' | 'item',
  prompt: string,
  placeholder: string
) {
  const types = await PromptService.getAssetTypePrompts()

  types[category].custom[id] = {
    name,
    prompt,
    placeholder
  }

  await PromptService.saveAssetTypePrompts(types)
}

// Example
await createCustomAssetType(
  'vehicle',
  'Vehicle',
  'item',
  'Show vehicle from isometric view',
  'Show the vehicle clearly with all features visible'
)
```

### Creating Material Override

```typescript
async function createMaterialOverride(
  materialId: string,
  customPrompt: string
) {
  const materials = await PromptService.getMaterialPrompts()

  materials.customOverrides[materialId] = customPrompt

  await PromptService.saveMaterialPrompts(materials)
}

// Example
await createMaterialOverride(
  'dragon',
  'Dragon scale texture with iridescent sheen and mystical glow, RuneScape style'
)
```

---

## Prompt Best Practices

### 1. Be Specific

**Bad**: "A sword"
**Good**: "Medieval iron longsword with leather-wrapped handle and simple crossguard"

### 2. Include Materials

**Bad**: "A shield"
**Good**: "Wooden round shield with iron boss and leather straps"

### 3. Specify Pose for Characters

**Bad**: "Knight character"
**Good**: "Knight character in T-pose with arms extended horizontally and empty hands"

### 4. Describe Geometry

**Bad**: "A helmet"
**Good**: "Conical helmet with nasal guard and chainmail neck protection"

### 5. Add Style Consistently

**Bad**: "Wooden bow"
**Good**: "Wooden longbow, low-poly RuneScape style with simple geometry"

### 6. Use Visual References

**Good Pattern**: "Like a [reference], but [modification]"
**Example**: "Like a claymore, but shorter with a curved crossguard"

### 7. Avoid Ambiguity

**Bad**: "Cool magic staff"
**Good**: "Gnarled wooden staff with glowing blue crystal at the top"

### 8. Consider Final Use

**For rigging**: Always specify T-pose and empty hands
**For fitting**: Specify armor shape for T-pose body
**For weapons**: Describe handle/grip clearly
**For items**: Focus on recognizable silhouette

---

## Prompt Testing

### A/B Testing Prompts

```typescript
async function testPromptVariants(
  baseDescription: string,
  variants: string[]
): Promise<TestResult[]> {
  const results: TestResult[] = []

  for (const variant of variants) {
    const start = Date.now()

    // Generate with variant
    const asset = await generateAsset({
      name: 'Test',
      description: variant,
      type: 'weapon',
      subtype: 'sword',
      style: 'runescape'
    })

    results.push({
      prompt: variant,
      generationTime: Date.now() - start,
      quality: await evaluateQuality(asset),
      usability: await evaluateUsability(asset)
    })
  }

  return results
}
```

### Quality Metrics

**Evaluate:**
1. **Visual accuracy**: Does it match description?
2. **Geometry quality**: Clean topology? No artifacts?
3. **Pose correctness**: T-pose accurate (characters)?
4. **Fitting compatibility**: Armor shaped correctly?
5. **Style consistency**: Matches requested style?

### Prompt Optimization Loop

```
1. Write initial prompt
2. Generate asset
3. Evaluate results
4. Identify issues (wrong pose, bad geometry, etc.)
5. Adjust prompt (add constraints, clarify details)
6. Re-generate
7. Compare results
8. Iterate until satisfied
```

---

## Advanced Techniques

### Negative Prompting

While OpenAI doesn't support explicit negative prompts, you can add exclusions:

```
"Iron sword with simple design, NO ornate decorations, NO gems or engravings,
NO complex details, just clean metal blade and leather handle"
```

### Contextual Enhancement

```typescript
function addContextFromMetadata(description: string, metadata: Record<string, unknown>): string {
  const context: string[] = [description]

  if (metadata.tier) {
    context.push(`${metadata.tier} tier quality`)
  }

  if (metadata.weaponType) {
    context.push(`${metadata.weaponType} weapon type`)
  }

  if (metadata.armorSlot) {
    context.push(`worn on ${metadata.armorSlot}`)
  }

  return context.join(', ')
}
```

### Multi-Stage Enhancement

```typescript
async function multiStageEnhancement(description: string): Promise<string> {
  // Stage 1: Add technical details
  let enhanced = await enhanceWithTechnicalDetails(description)

  // Stage 2: Add visual details
  enhanced = await enhanceWithVisualDetails(enhanced)

  // Stage 3: Add style constraints
  enhanced = await enhanceWithStyleConstraints(enhanced)

  return enhanced
}
```

---

## Troubleshooting

### Issue: Character not in T-pose

**Solution**: Strengthen T-pose language
```
"CRITICAL: Character MUST be in perfect T-pose with arms stretched
STRAIGHT OUT HORIZONTALLY at exactly 90 degrees from body.
Arms should form a straight horizontal line across.
Empty hands, no weapons or items."
```

### Issue: Armor has mannequin inside

**Solution**: Add explicit exclusions
```
"Armor piece ONLY, floating in space, NO body, NO mannequin,
NO armor stand, completely hollow interior, you can see through the openings"
```

### Issue: Shoulder openings angled wrong

**Solution**: Emphasize scarecrow metaphor
```
"Shaped like a SCARECROW with arms sticking STRAIGHT OUT to the sides.
Shoulder openings point HORIZONTALLY at 90 degrees, forming a STRAIGHT LINE
across when viewed from above, like the letter T, NOT angled downward"
```

### Issue: Generated style doesn't match

**Solution**: Be more explicit about style
```
"Low-poly RuneScape 2007 style with SIMPLE GEOMETRY (under 500 polygons),
FLAT SHADING, VIBRANT COLORS, chunky proportions, early 2000s game aesthetic"
```

---

## API Reference

### Types

```typescript
interface GameStylePrompt {
  id?: string
  name: string
  base: string
  enhanced?: string
  generation?: string
  fallback?: string
}

interface AssetTypePrompt {
  name: string
  prompt: string
  placeholder?: string
}

interface MaterialPromptTemplate {
  templates: { runescape: string; generic: string } & Record<string, string>
  customOverrides: Record<string, string>
}

interface PromptsResponse<T> {
  version: string
  default: T
  custom: T
}
```

---

## Next Steps

- [Image Generation](./image-generation.md) - Use enhanced prompts with OpenAI
- [3D Conversion](./3d-conversion.md) - Convert images to 3D models
- [Generation Pipeline](./generation-pipeline.md) - Complete pipeline flow

---

[← Back to Generation Pipeline](./generation-pipeline.md) | [Next: Image Generation →](./image-generation.md)
