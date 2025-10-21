# Material Variants Guide

[← Back to Index](../README.md)

---

## Overview

The Material Variant System allows you to generate multiple textured versions of a single 3D model instantly. Instead of creating separate assets for bronze, steel, and mithril swords, generate one base model and automatically retexture it for all material tiers.

**What You'll Learn:**
- Understanding the material preset system
- How the tier system works (1-10)
- Selecting and applying materials
- Creating custom materials
- The retexturing process
- Managing and organizing variants
- Editing preset configurations
- Material categories (metals, woods, leathers)
- Writing effective style prompts

**Time Investment**: 30-60 seconds per variant after base model generation

---

## Why Use Material Variants?

### The Problem

Traditional asset creation requires generating each variant separately:

```
Generate bronze-sword    → 5 minutes
Generate steel-sword     → 5 minutes
Generate mithril-sword   → 5 minutes
Generate adamant-sword   → 5 minutes
Generate rune-sword      → 5 minutes
────────────────────────────────────
Total: 25 minutes + 5 API calls
```

### The Solution

Material variants generate from a single base model:

```
Generate base-sword      → 5 minutes (1 API call)
Retexture to bronze      → 30 seconds (1 retexture call)
Retexture to steel       → 30 seconds (1 retexture call)
Retexture to mithril     → 30 seconds (1 retexture call)
Retexture to adamant     → 30 seconds (1 retexture call)
Retexture to rune        → 30 seconds (1 retexture call)
────────────────────────────────────
Total: 7.5 minutes + 6 API calls
```

**Benefits:**
- **3x faster** than separate generation
- **Guaranteed consistency** - same geometry
- **Cost effective** - retexturing cheaper than full generation
- **Easy iteration** - test materials quickly
- **Tier systems** - perfect for RPG progression

---

## Material Preset System

### Built-in Presets

Asset Forge includes 9 pre-configured material presets organized by category:

#### Metals (Weapon & Armor Progression)

```typescript
Bronze (Tier 1)
├─ Color: #CD7F32 (copper brown)
├─ Style: "Bronze metal texture with oxidized patina,
│         copper-brown color, slightly tarnished finish"
├─ Use: Starting tier, beginner equipment
└─ Examples: bronze-sword, bronze-helmet

Iron (Tier 2)
├─ Color: #434B4D (dark gray)
├─ Style: "Iron metal texture, dark gray color,
│         rough matte finish with rust spots"
├─ Use: Early tier, common equipment
└─ Examples: iron-axe, iron-chainmail

Steel (Tier 3)
├─ Color: #71797E (silver gray)
├─ Style: "Polished steel metal texture, silver-gray,
│         smooth reflective finish, professional craftsmanship"
├─ Use: Mid tier, standard equipment
└─ Examples: steel-longsword, steel-plate

Mithril (Tier 4)
├─ Color: #26619C (blue-gray)
├─ Style: "Mithril metal texture, blue-gray shimmer,
│         magical ethereal glow, lightweight appearance"
├─ Use: Advanced tier, rare equipment
└─ Examples: mithril-rapier, mithril-chainmail

Adamant (Tier 5)
├─ Color: #2D5016 (dark green)
├─ Style: "Adamantite metal texture, dark green metallic,
│         extremely durable appearance, dense material"
├─ Use: High tier, elite equipment
└─ Examples: adamant-greatsword, adamant-platebody

Rune (Tier 6)
├─ Color: #00FFFF (cyan)
├─ Style: "Runic metal texture, cyan magical glow,
│         arcane symbols, enchanted appearance"
├─ Use: Top tier, endgame equipment
└─ Examples: rune-scimitar, rune-full-helm
```

#### Woods (Ranged Weapons & Shields)

```typescript
Wood (Tier 1)
├─ Color: #8B4513 (saddle brown)
├─ Style: "Light pine wood texture, natural grain,
│         unfinished appearance, simple craftsmanship"
├─ Use: Basic wooden items
└─ Examples: wood-shield, wood-bow

Oak (Tier 2)
├─ Color: #654321 (dark brown)
├─ Style: "Oak wood texture, medium brown with prominent grain,
│         sturdy appearance, quality craftsmanship"
├─ Use: Improved wooden items
└─ Examples: oak-longbow, oak-shield

Willow (Tier 3)
├─ Color: #7C4E3E (reddish brown)
├─ Style: "Willow wood texture, pale yellow-green,
│         flexible appearance, fine grain, lightweight"
├─ Use: High-quality wooden items
└─ Examples: willow-shortbow, willow-staff
```

#### Leathers (Light Armor)

```typescript
Leather (Tier 1)
├─ Color: #8B4513 (brown)
├─ Style: "Brown cowhide leather texture, worn appearance,
│         soft finish, basic tanning"
├─ Use: Basic light armor
└─ Examples: leather-boots, leather-gloves

Hard-Leather (Tier 2)
├─ Color: #654321 (dark brown)
├─ Style: "Hardened leather texture, dark brown,
│         reinforced appearance, stiff material, boiled treatment"
├─ Use: Reinforced light armor
└─ Examples: hard-leather-body, hard-leather-chaps

Studded-Leather (Tier 3)
├─ Color: #434B4D (brown with metal)
├─ Style: "Studded leather texture, brown leather with metal studs,
│         reinforced with iron rivets, tactical appearance"
├─ Use: Advanced light armor
└─ Examples: studded-chaps, studded-vest
```

#### Special Materials

```typescript
Dragon (Tier 10)
├─ Color: #FA0000 (red)
├─ Style: "Dragon scale texture, deep red matte finish,
│         scale patterns, legendary appearance"
├─ Use: Ultimate tier, legendary equipment
└─ Examples: dragon-longsword, dragon-platebody
```

### Preset Configuration Structure

Each preset follows this structure:

```typescript
interface MaterialPreset {
  id: string              // Unique identifier: "bronze"
  name: string            // Internal name: "bronze"
  displayName: string     // UI display: "Bronze"
  category: string        // "metal" | "wood" | "leather" | "special"
  tier: number           // 1-10 (progression level)
  color: string          // Hex color: "#CD7F32"
  stylePrompt: string    // Detailed material description
}
```

**Example - Bronze Preset:**

```typescript
{
  id: "bronze",
  name: "bronze",
  displayName: "Bronze",
  category: "metal",
  tier: 1,
  color: "#CD7F32",
  stylePrompt: "Bronze metal texture with oxidized patina, \
                copper-brown color, slightly tarnished finish, \
                ancient craftsmanship, weathered appearance"
}
```

---

## Understanding the Tier System

### Tier Progression (1-10)

The tier system represents progression from basic to legendary equipment:

```
Tier 1-2: Starter Equipment
├─ Bronze, Iron, Wood, Leather
├─ Common materials
├─ Widely available
└─ Beginner-friendly

Tier 3-4: Intermediate Equipment
├─ Steel, Mithril, Oak, Hard-Leather
├─ Uncommon materials
├─ Moderate requirements
└─ Solid performance

Tier 5-6: Advanced Equipment
├─ Adamant, Rune, Willow, Studded-Leather
├─ Rare materials
├─ High requirements
└─ Superior performance

Tier 7-9: Elite Equipment
├─ Custom high-tier materials
├─ Very rare
├─ Expert requirements
└─ Exceptional performance

Tier 10: Legendary Equipment
├─ Dragon, Custom legendary
├─ Extremely rare
├─ Maximum requirements
└─ Best-in-slot performance
```

### Tier-Based Gameplay

**RPG Progression Example:**

```
Level 1-10:
├─ Access: Bronze weapons (tier 1)
├─ Stats: 10-20 damage
└─ Cost: 100-500 gold

Level 20-30:
├─ Access: Steel weapons (tier 3)
├─ Stats: 30-45 damage
└─ Cost: 5,000-10,000 gold

Level 40-50:
├─ Access: Mithril weapons (tier 4)
├─ Stats: 55-70 damage
└─ Cost: 50,000-100,000 gold

Level 60+:
├─ Access: Adamant weapons (tier 5)
├─ Stats: 80-95 damage
└─ Cost: 500,000-1M gold

Level 99:
├─ Access: Dragon weapons (tier 10)
├─ Stats: 150-200 damage
└─ Cost: 10M+ gold (rare drops)
```

### Visual Tier Differentiation

Each tier has a distinct color scheme for easy identification:

```
Tier Colors (In-Game UI):
├─ Tier 1 (Bronze): Copper brown #CD7F32
├─ Tier 2 (Iron): Dark gray #434B4D
├─ Tier 3 (Steel): Silver gray #71797E
├─ Tier 4 (Mithril): Blue-gray #26619C
├─ Tier 5 (Adamant): Green #2D5016
├─ Tier 6 (Rune): Cyan #00FFFF
└─ Tier 10 (Dragon): Red #FA0000

Usage:
├─ Item name coloring
├─ Tooltip borders
├─ Inventory highlighting
└─ Rarity indicators
```

---

## Selecting Materials

### During Generation

Enable material variants when creating the base asset:

**Form Configuration:**

```
Asset Generation Form:
├─ Name: longsword
├─ Type: weapon
├─ Subtype: sword
├─ Description: "Medieval longsword with crossguard..."
├─ Quality: high
│
├─ ☑ Enable Material Variants
│
└─ Material Presets:
   ☑ Bronze (tier 1)
   ☑ Iron (tier 2)
   ☑ Steel (tier 3)
   ☑ Mithril (tier 4)
   ☑ Adamant (tier 5)
   ☑ Rune (tier 6)
   ☐ Dragon (tier 10) (optional)
```

**What Happens:**

1. Base model generates first (5-8 minutes)
2. After base completes, retexturing begins
3. Each selected material generates sequentially
4. Progress shows: "Generating bronze variant..." etc.
5. All variants link to base asset

**Output Files:**

```
Assets Library:
├─ longsword (base model)
└─ Variants:
   ├─ bronze-longsword.glb
   ├─ iron-longsword.glb
   ├─ steel-longsword.glb
   ├─ mithril-longsword.glb
   ├─ adamant-longsword.glb
   └─ rune-longsword.glb
```

### After Generation (Retexture Existing)

Add material variants to existing assets:

**Steps:**

1. **Open Asset Library**
   - Navigate to existing asset
   - Click asset to view details

2. **Click "Generate Variants"**
   - Opens material selection modal
   - Shows available presets

3. **Select Materials:**
   ```
   Material Preset Selector:
   ☑ Bronze
   ☑ Steel
   ☑ Mithril
   ☐ Oak (not applicable to metal weapon)
   ☐ Leather (not applicable to metal weapon)
   ```

4. **Confirm Generation**
   - Click "Generate Variants"
   - Progress bar shows retexturing
   - Variants appear in asset card

**Time**: 30-60 seconds per variant

---

## The Retexturing Process

### How Retexturing Works

Retexturing uses Meshy.ai's texture generation API to apply new materials while preserving geometry:

```
Retexturing Pipeline:
1. Load base 3D model
   └─ Original mesh geometry

2. Extract mesh without textures
   └─ Pure geometry (vertices, faces)

3. Submit to Meshy Retexture API
   ├─ Mesh: base model geometry
   ├─ Prompt: material style prompt
   └─ Settings: texture resolution, PBR

4. Meshy generates new textures
   ├─ Base color map
   ├─ Metallic map (if PBR)
   ├─ Roughness map (if PBR)
   └─ Normal map (if PBR)

5. Apply textures to mesh
   └─ Creates new textured GLB

6. Save variant
   ├─ Filename: {material}-{base-name}.glb
   └─ Metadata: links to base, tier info
```

### Material Style Prompts

The `stylePrompt` field is crucial for retexturing quality:

**Anatomy of a Good Style Prompt:**

```
[Material Type] [Texture Description], [Color],
[Finish Type], [Detail Features], [Style/Appearance]

Example - Bronze:
"Bronze metal texture with oxidized patina,
copper-brown color, slightly tarnished finish,
ancient craftsmanship, weathered appearance"

Breakdown:
├─ Material Type: "Bronze metal texture"
├─ Color: "copper-brown color"
├─ Finish: "slightly tarnished finish"
├─ Details: "oxidized patina"
└─ Style: "ancient craftsmanship, weathered"
```

**Effective Prompt Patterns:**

**For Metals:**
```
"[Metal name] metal texture, [color description],
[finish type: polished/matte/rough],
[wear patterns: new/worn/ancient],
[special effects: glow/shimmer/engravings]"

Examples:
"Steel metal texture, silver-gray, polished reflective finish,
clean modern appearance, professional craftsmanship"

"Runic metal texture, cyan magical glow, arcane symbols etched
into surface, enchanted appearance, ethereal shimmer"
```

**For Woods:**
```
"[Wood type] wood texture, [color], [grain description],
[finish: raw/varnished/oiled],
[quality: rough/smooth/fine]"

Examples:
"Oak wood texture, medium brown with prominent grain,
varnished finish, sturdy appearance, quality craftsmanship"

"Willow wood texture, pale yellow-green, fine grain,
natural oil finish, flexible appearance, lightweight"
```

**For Leathers:**
```
"[Leather type] leather texture, [color], [treatment],
[wear level], [surface details: smooth/textured/embossed]"

Examples:
"Hardened leather texture, dark brown, boiled treatment,
reinforced appearance, stiff material, embossed patterns"

"Studded leather texture, brown leather base with iron studs,
riveted reinforcement, tactical appearance, battle-worn"
```

### Retexturing vs. Full Generation

**When to Use Retexturing:**

✅ **Creating tier progressions** - Same item, different materials
✅ **Equipment sets** - Consistent style across tiers
✅ **Testing materials** - Quick material experiments
✅ **Cost optimization** - Cheaper than full generation
✅ **Time efficiency** - 30 seconds vs 5 minutes

**When to Use Full Generation:**

✅ **Different geometry needed** - Bronze sword vs steel greatsword
✅ **Style variations** - Scimitar vs longsword
✅ **Unique models** - Each tier has unique design
✅ **Complex changes** - Shape differs by tier

**Comparison:**

```
Retexturing:
├─ Time: 30-60 seconds
├─ Cost: ~$0.10 per variant
├─ Geometry: Identical
├─ Textures: Completely new
└─ Use: Tier systems, material sets

Full Generation:
├─ Time: 5-8 minutes
├─ Cost: ~$0.40-0.60 per asset
├─ Geometry: Unique
├─ Textures: Unique
└─ Use: Distinct items, unique designs
```

---

## Creating Custom Materials

### Adding New Presets

Create custom materials for unique progression systems:

**Custom Material Structure:**

```typescript
const customMaterial: MaterialPreset = {
  id: "obsidian",
  name: "obsidian",
  displayName: "Obsidian",
  category: "special",
  tier: 8,
  color: "#1A1A1A",
  stylePrompt: "Obsidian volcanic glass texture, deep black \
                with purple shimmer, sharp reflections, smooth \
                polished surface, natural fracture patterns, \
                mysterious dark appearance"
}
```

**Custom Material Examples:**

**Crystal (Tier 7):**
```typescript
{
  id: "crystal",
  name: "crystal",
  displayName: "Crystal",
  category: "special",
  tier: 7,
  color: "#E0F7FF",
  stylePrompt: "Clear crystal texture, transparent with internal \
                reflections, prismatic light scattering, geometric \
                facets, magical glow, ethereal appearance"
}
```

**Demonic (Tier 9):**
```typescript
{
  id: "demonic",
  name: "demonic",
  displayName: "Demonic",
  category: "special",
  tier: 9,
  color: "#8B0000",
  stylePrompt: "Dark demonic metal texture, blood-red with black \
                veins, corrupted appearance, pulsing dark energy, \
                cursed engravings, sinister glow"
}
```

**Elven (Tier 6):**
```typescript
{
  id: "elven",
  name: "elven",
  displayName: "Elven",
  category: "special",
  tier: 6,
  color: "#FFD700",
  stylePrompt: "Elven crafted metal, gold-silver alloy, intricate \
                nature motifs, leaf patterns, elegant curves, \
                pristine finish, masterwork quality"
}
```

**Bone (Tier 2):**
```typescript
{
  id: "bone",
  name: "bone",
  displayName: "Bone",
  category: "organic",
  tier: 2,
  color: "#F5F5DC",
  stylePrompt: "Bone material texture, off-white with yellow aging, \
                porous surface, natural wear patterns, primitive \
                craftsmanship, tribal appearance"
}
```

### Custom Preset Best Practices

**1. Choose Appropriate Tier:**
```
Tier 1-2: Common materials (wood, bone, copper)
Tier 3-4: Uncommon materials (steel, bronze, silver)
Tier 5-6: Rare materials (mithril, elven, crystal)
Tier 7-9: Very rare materials (obsidian, demonic, celestial)
Tier 10: Legendary materials (dragon, divine, void)
```

**2. Select Distinctive Colors:**
```
Avoid color conflicts:
❌ Bronze (#CD7F32) vs Copper (#CD7632) - Too similar
✅ Bronze (#CD7F32) vs Crystal (#E0F7FF) - Distinct
```

**3. Write Detailed Style Prompts:**
```
Include:
├─ Base material type
├─ Primary color
├─ Surface finish (polished, matte, rough)
├─ Unique characteristics
├─ Wear/aging details
└─ Thematic elements
```

**4. Category Organization:**
```
Categories:
├─ metal: Metallic materials
├─ wood: Wooden materials
├─ leather: Leather and hide
├─ organic: Bone, chitin, shell
├─ magical: Enchanted, ethereal
└─ special: Unique, legendary
```

### Applying Custom Materials

**Method 1: Add to Preset List**

Edit material configuration file:

```typescript
// src/constants/materials.ts

export const MATERIAL_PRESETS: MaterialPreset[] = [
  // Built-in presets
  { id: "bronze", name: "bronze", ... },
  { id: "steel", name: "steel", ... },

  // Custom presets
  {
    id: "obsidian",
    name: "obsidian",
    displayName: "Obsidian",
    category: "special",
    tier: 8,
    color: "#1A1A1A",
    stylePrompt: "Obsidian volcanic glass texture..."
  },
  {
    id: "crystal",
    name: "crystal",
    displayName: "Crystal",
    category: "special",
    tier: 7,
    color: "#E0F7FF",
    stylePrompt: "Clear crystal texture..."
  }
]
```

**Method 2: Programmatic Generation**

Use API to apply custom material:

```typescript
import { retextureAsset } from '@/services/api/AssetService'

await retextureAsset({
  baseAssetId: "longsword-123",
  material: {
    name: "obsidian",
    displayName: "Obsidian",
    stylePrompt: "Obsidian volcanic glass texture, deep black..."
  }
})
```

---

## Managing Variants

### Viewing Variants

**Asset Card Display:**

```
┌─────────────────────────────────┐
│     Longsword (Base Model)      │
├─────────────────────────────────┤
│  [3D Preview]                   │
├─────────────────────────────────┤
│ Variants (6):                   │
│ ● Bronze      [View] [Download] │
│ ● Iron        [View] [Download] │
│ ● Steel       [View] [Download] │
│ ● Mithril     [View] [Download] │
│ ● Adamant     [View] [Download] │
│ ● Rune        [View] [Download] │
├─────────────────────────────────┤
│ [Generate More Variants]        │
│ [View All] [Download All]       │
└─────────────────────────────────┘
```

**Variant Details:**

Click any variant to view:
- 3D model preview
- Material information
- Tier level
- Color swatch
- Download button
- Link to base asset
- Metadata

### Organizing Variant Sets

**Best Practices:**

**1. Naming Conventions:**
```
Pattern: {material}-{base-name}

Examples:
✅ bronze-longsword
✅ steel-longsword
✅ mithril-longsword

Avoid:
❌ longsword-bronze (inconsistent)
❌ longsword_bronze (use hyphens)
❌ BronzeLongsword (use lowercase)
```

**2. Complete Tier Sets:**
```
Weapon Set:
├─ bronze-longsword (tier 1)
├─ steel-longsword (tier 3)
├─ mithril-longsword (tier 4)
├─ adamant-longsword (tier 5)
├─ rune-longsword (tier 6)
└─ dragon-longsword (tier 10)

Armor Set:
├─ bronze-helmet, bronze-platebody, bronze-platelegs
├─ steel-helmet, steel-platebody, steel-platelegs
└─ mithril-helmet, mithril-platebody, mithril-platelegs
```

**3. Filtering and Searching:**
```
Search by:
├─ Material name: "bronze"
├─ Tier level: "tier:3"
├─ Base model: "longsword"
└─ Category: "metal"
```

### Deleting Variants

**Individual Deletion:**
```
1. Open variant in viewer
2. Click "Delete" button
3. Confirm deletion
4. Variant removed, base preserved
```

**Cascade Deletion:**
```
When deleting base asset:
├─ Option 1: Delete base only (keep variants as standalone)
├─ Option 2: Delete base + all variants (complete removal)
└─ Recommended: Delete all to avoid orphaned variants
```

---

## Editing Material Presets

### Modifying Existing Presets

**Location:**
```
packages/asset-forge/src/constants/materials.ts
```

**Example - Updating Bronze:**

**Before:**
```typescript
{
  id: "bronze",
  name: "bronze",
  displayName: "Bronze",
  category: "metal",
  tier: 1,
  color: "#CD7F32",
  stylePrompt: "Bronze metal texture with oxidized patina..."
}
```

**After (More Weathered):**
```typescript
{
  id: "bronze",
  name: "bronze",
  displayName: "Bronze",
  category: "metal",
  tier: 1,
  color: "#CD7F32",
  stylePrompt: "Ancient bronze metal texture, heavy green patina, \
                corroded copper-brown base, deeply weathered, \
                centuries old appearance, rough oxidized surface"
}
```

**Regenerate Variants:**

After editing presets:
1. Delete old variants
2. Regenerate with new preset
3. Compare results
4. Adjust stylePrompt as needed

### Preset Categories

Organize presets by category:

```typescript
export const METAL_MATERIALS = [
  { id: "bronze", tier: 1, ... },
  { id: "iron", tier: 2, ... },
  { id: "steel", tier: 3, ... }
]

export const WOOD_MATERIALS = [
  { id: "wood", tier: 1, ... },
  { id: "oak", tier: 2, ... },
  { id: "willow", tier: 3, ... }
]

export const LEATHER_MATERIALS = [
  { id: "leather", tier: 1, ... },
  { id: "hard-leather", tier: 2, ... },
  { id: "studded-leather", tier: 3, ... }
]

export const ALL_MATERIALS = [
  ...METAL_MATERIALS,
  ...WOOD_MATERIALS,
  ...LEATHER_MATERIALS
]
```

---

## Advanced Workflows

### Creating Complete Equipment Sets

**Goal:** Generate full tier progression for melee weapon set

**Step 1: Define Set:**
```
Weapons: sword, axe, mace, dagger
Materials: bronze, steel, mithril, adamant, rune
Total Assets: 4 weapons × 5 tiers = 20 items
```

**Step 2: Generate Base Models:**
```
1. Generate longsword (base)
2. Generate battleaxe (base)
3. Generate mace (base)
4. Generate dagger (base)

Settings for all:
├─ Quality: high
├─ Style: RuneScape 2007
└─ Enable variants: bronze, steel, mithril, adamant, rune
```

**Step 3: Automatic Variants:**
```
Each base generates 5 variants automatically:
├─ Longsword: bronze, steel, mithril, adamant, rune
├─ Battleaxe: bronze, steel, mithril, adamant, rune
├─ Mace: bronze, steel, mithril, adamant, rune
└─ Dagger: bronze, steel, mithril, adamant, rune

Total time: ~35 minutes
Total assets: 24 (4 base + 20 variants)
```

**Step 4: Export Set:**
```
Download all variants as:
weapons/
├─ melee/
│  ├─ tier-1/
│  │  ├─ bronze-longsword.glb
│  │  ├─ bronze-battleaxe.glb
│  │  ├─ bronze-mace.glb
│  │  └─ bronze-dagger.glb
│  ├─ tier-3/
│  │  ├─ steel-longsword.glb
│  │  └─ ...
│  └─ tier-6/
│     └─ rune-longsword.glb
```

### Mixed Material Systems

Combine different material categories:

**Example: Weapon with Mixed Materials**

```
Base Model: Composite Bow
Materials:
├─ Wood (bow limbs): oak, willow, yew
├─ Metal (fittings): bronze, steel, mithril
└─ Leather (grip): leather, hard-leather

Variants:
├─ oak-bow (wood limbs, bronze fittings, leather grip)
├─ willow-bow (willow limbs, steel fittings, hard-leather grip)
└─ yew-bow (yew limbs, mithril fittings, reinforced grip)
```

**Implementation:**

Generate separate components:
```
1. Generate bow-limbs (base)
2. Generate bow-fittings (base)
3. Generate bow-grip (base)

Apply materials:
├─ bow-limbs: wood, oak, willow
├─ bow-fittings: bronze, steel, mithril
└─ bow-grip: leather, hard-leather

Assemble in equipment system (see Equipment Guide)
```

---

## Troubleshooting

### "Retexturing Failed"

**Cause:** Meshy API issue
**Solutions:**
- Verify MESHY_API_KEY in .env
- Check Meshy.ai credits
- Base model too complex (>50K polys)
- Try simpler base geometry
- Contact Meshy support

### "Variant Looks Identical to Base"

**Cause:** Style prompt not specific enough
**Solutions:**
- Add more color description
- Specify finish type (matte, glossy, rough)
- Include distinctive features
- Use stronger material keywords
- Review successful presets for examples

### "Wrong Material Applied"

**Cause:** Prompt interpretation issue
**Solutions:**
- Be explicit about material type
- Avoid ambiguous terms
- Use reference colors (hex codes don't affect prompt)
- Test with simpler prompt first
- Iterate on stylePrompt wording

### "Colors Don't Match Tier System"

**Cause:** Prompt vs. actual texture mismatch
**Solutions:**
- Color field is for UI only (doesn't affect texture)
- Adjust stylePrompt color description
- Include specific color names
- Use reference images if available
- Accept some variation (AI interpretation)

---

## Best Practices Summary

### Material Selection
✅ Choose materials appropriate to asset type (metal for weapons)
✅ Use complete tier sets for progression (1, 3, 4, 5, 6)
✅ Limit variants to needed tiers (don't generate all if unused)
✅ Consider category compatibility (don't apply wood to metal armor)

### Style Prompts
✅ Be specific about colors and finish
✅ Include texture details (grain, patina, wear)
✅ Use 2-3 sentences
✅ Reference existing presets as templates
✅ Test prompt before bulk generation

### Organization
✅ Use consistent naming conventions
✅ Group related variants together
✅ Tag with tiers for filtering
✅ Document custom materials
✅ Export complete sets for backup

### Cost Optimization
✅ Generate base at high quality, variants inherit
✅ Limit variants to actually needed tiers
✅ Test with 1-2 variants before generating all
✅ Reuse base models for multiple variant sets
✅ Delete unused variants to save storage

---

## Next Steps

Explore related systems:

- **[Asset Generation Guide](asset-generation.md)** - Create base models
- **[Sprite Generation Guide](sprite-generation.md)** - Generate tier-colored sprites
- **[Equipment System Guide](equipment-system.md)** - Equip tier-appropriate items
- **[Armor Fitting Guide](armor-fitting.md)** - Fit armor variants to characters

---

[← Back to Index](../README.md) | [Next: Hand Rigging →](hand-rigging.md)
