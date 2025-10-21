# Asset Generation Guide

[← Back to Index](../README.md)

---

## Overview

Asset generation is the core feature of Asset Forge, transforming simple text descriptions into production-ready 3D models. This comprehensive guide walks you through the complete workflow, from selecting generation parameters to downloading your finished assets.

**What You'll Learn:**
- How to choose between item and avatar generation
- Understanding form fields and configuration options
- Asset type categories and quality levels
- Using GPT-4 enhancement for better results
- Working with reference images
- Monitoring pipeline progress
- Viewing and downloading generated assets
- Best practices for writing effective descriptions

**Time to Complete**: First asset in 5-10 minutes

---

## Generation Workflow Overview

The asset generation process follows a multi-stage pipeline:

```
1. Configure Generation
   ├─ Select generation type (item/avatar)
   ├─ Choose asset category
   ├─ Write description
   └─ Set quality and options

2. AI Enhancement (Optional)
   ├─ GPT-4 enhances description
   └─ Generates detailed prompts

3. Concept Art Generation
   ├─ Reference image (if provided), OR
   └─ GPT-Image-1 creates concept art

4. 3D Model Generation
   ├─ Meshy.ai converts image to 3D
   ├─ Generates mesh and textures
   └─ Creates GLB file

5. Post-Processing
   ├─ Normalization (centering, scaling)
   ├─ Rigging (avatars only)
   └─ Metadata generation

6. Optional Stages
   ├─ Material variants (retexturing)
   └─ Sprite generation (2D renders)
```

**Total Time**: 2-20 minutes depending on quality level

---

## Part 1: Selecting Generation Type

### Item vs Avatar Generation

Asset Forge supports two primary generation modes, each optimized for different use cases:

#### Item Generation

**Use For:**
- Weapons (swords, axes, bows, staffs)
- Armor pieces (helmets, chest plates, boots)
- Resources (ores, gems, logs, herbs)
- Buildings (banks, stores, temples)
- Tools (pickaxes, hammers, fishing rods)
- Consumables (potions, food items, scrolls)

**Characteristics:**
- Fast generation (2-8 minutes)
- No rigging required
- Optimized for static objects
- Lower polycount options available
- Ideal for inventory items

**Pipeline Stages:**
```
Description → GPT-4 Enhancement → Concept Art →
3D Generation → Normalization → Done
```

#### Avatar Generation

**Use For:**
- Characters (humans, elves, dwarves)
- Creatures (goblins, dragons, animals)
- NPCs (shopkeepers, guards, villagers)
- Bosses (large enemies, monsters)

**Characteristics:**
- Longer generation (10-20 minutes)
- Automatic rigging with skeleton
- T-pose requirement
- Includes animations (walk, run)
- Height normalization
- Higher polycount requirements

**Pipeline Stages:**
```
Description → GPT-4 Enhancement → T-pose Art →
3D Generation → Height Normalization → Auto-Rigging →
Animation Generation → T-pose Extraction → Done
```

**Key Difference**: Avatar generation automatically adds "standing in T-pose" to your description to ensure proper rigging. Item generation does not modify pose requirements.

---

## Part 2: Understanding Form Fields

### Basic Fields

#### 1. Asset Name
```
Field: name
Type: Text (required)
Pattern: lowercase-with-hyphens

Examples:
✅ bronze-longsword
✅ goblin-warrior
✅ iron-ore
❌ Bronze Longsword (use hyphens, not spaces)
❌ bronze_longsword (use hyphens, not underscores)
```

**Best Practices:**
- Use descriptive names
- Include material/tier if applicable
- Keep names short but clear
- Follow naming conventions for consistency

#### 2. Asset Type
```
Field: type
Type: Dropdown (required)
Options: weapon, armor, character, building, resource, tool, consumable

Category Descriptions:
├─ weapon: Melee, ranged, and magic weapons
├─ armor: Wearable equipment for protection
├─ character: Humanoid and creature models
├─ building: Structures and environments
├─ resource: Gatherable materials
├─ tool: Harvesting and crafting tools
└─ consumable: Single-use items
```

**Choosing the Right Type:**
- **Weapon**: Anything held for combat (sword, bow, staff)
- **Armor**: Wearable gear (helmet, boots, gloves)
- **Character**: Living entities with animations
- **Building**: Structures with interiors
- **Resource**: Raw materials (ore, logs, gems)
- **Tool**: Non-combat equipment (pickaxe, hammer)
- **Consumable**: Items that disappear on use (potions, food)

#### 3. Asset Subtype
```
Field: subtype
Type: Text (required)

Weapon Subtypes:
├─ sword, axe, mace, spear, dagger
├─ bow, crossbow
├─ staff, wand
└─ shield

Armor Subtypes:
├─ helmet, hood, crown
├─ chest-plate, robe
├─ greaves, pants
├─ gloves, gauntlets
└─ cape, amulet, ring

Character Subtypes:
├─ human, elf, dwarf, orc
├─ goblin, troll, giant
└─ dragon, wolf, bear

Building Subtypes:
├─ bank, store, guild-hall
├─ house, inn
├─ temple, shrine
└─ castle, tower, dungeon

Resource Subtypes:
├─ ore, bar, gem
├─ log, plank
└─ herb, fish

Tool Subtypes:
├─ pickaxe, axe
├─ hammer, chisel
└─ fishing-rod
```

#### 4. Description
```
Field: description
Type: Textarea (required)
Length: 10-500 characters

Purpose:
- Primary input for AI generation
- Describes visual appearance
- Specifies materials and style
- Adds unique characteristics
```

**Writing Effective Descriptions:**

**For Weapons:**
```
Good: "A bronze medieval sword with ornate crossguard,
leather-wrapped grip, and straight double-edged blade"

Better: "Medieval longsword with bronze blade featuring
central fuller, ornate steel crossguard with curved quillons,
dark leather-wrapped grip with copper wire binding,
bronze pommel with geometric engravings"

Avoid: "sword" (too minimal)
Avoid: "The most powerful legendary mythical sword ever forged
by ancient gods with infinite power" (too narrative)
```

**For Characters:**
```
Good: "Goblin warrior with green skin, wearing torn leather
armor, holding rusty sword, sharp teeth, yellow eyes"

Better: "Muscular goblin warrior, lime-green warty skin,
pointed ears, yellow cat-like eyes, sharp fangs, wearing
tattered brown leather armor with metal studs, barefoot,
aggressive stance"

Avoid: "goblin" (needs more detail)
Avoid: Including pose descriptions (system adds T-pose automatically)
```

**For Buildings:**
```
Good: "Medieval stone bank with wooden reinforced door,
iron bars on windows, tiled roof"

Better: "Two-story medieval bank, gray stone walls with
mortar, heavy oak door with iron bands and lock, barred
windows on ground floor, red clay tile roof, stone steps
at entrance, wooden sign hanging from iron bracket"
```

**Description Tips:**
- Be specific about materials (bronze, steel, leather)
- Include colors and textures (dark, weathered, polished)
- Mention key features (crossguard, studs, windows)
- Avoid narrative elements ("legendary", "ancient prophecy")
- Don't include scale/size (handled by normalization)
- Skip pose descriptions for avatars (added automatically)

---

### Advanced Fields

#### 5. Style
```
Field: style
Type: Dropdown (optional)
Default: "RuneScape 2007"

Options:
├─ RuneScape 2007: Low-poly nostalgic MMORPG style
└─ Generic: Standard game-ready 3D asset style

Custom Style:
Enter custom art direction as freeform text
Example: "High fantasy painted texture style like World of Warcraft"
```

**When to Use Custom Styles:**
- Matching existing game art style
- Creating specific aesthetic (realistic, cartoon, sci-fi)
- Following brand guidelines
- Experimenting with different looks

#### 6. Quality Level
```
Field: quality
Type: Dropdown (required)
Default: "high"

Quality Comparison:
┌──────────┬───────────┬─────────┬─────┬──────────┬──────────┐
│ Quality  │ Polycount │ Texture │ PBR │ Time     │ Use Case │
├──────────┼───────────┼─────────┼─────┼──────────┼──────────┤
│ Standard │ 6,000     │ 1024px  │ No  │ 2-4 min  │ Placeholder │
│ High     │ 12,000    │ 2048px  │ Yes │ 5-8 min  │ Production │
│ Ultra    │ 20,000    │ 4096px  │ Yes │ 10-20min │ Hero assets │
└──────────┴───────────┴─────────┴─────┴──────────┴──────────┘

PBR = Physically-Based Rendering materials
```

**Choosing Quality:**

**Standard Quality - When to Use:**
- Rapid prototyping
- Testing descriptions
- Background/distant objects
- Mobile game assets
- High quantity needs

**High Quality - When to Use:**
- Production game assets (recommended default)
- Main character equipment
- Featured items in UI
- PC/console games
- Balance of quality and speed

**Ultra Quality - When to Use:**
- Hero characters
- Promotional screenshots
- Main menu showcases
- VR applications
- Maximum detail requirements

**Cost Consideration:**
Each quality level uses Meshy.ai credits:
- Standard: ~200 credits
- High: ~400 credits
- Ultra: ~600 credits

#### 7. GPT-4 Enhancement
```
Field: enableGPT4
Type: Checkbox (optional)
Default: Enabled

When Enabled:
Your description → GPT-4 analysis → Enhanced prompt

Enhancement Adds:
├─ Visual details and specificity
├─ Material descriptions
├─ Geometric clarity for 3D conversion
├─ Style consistency keywords
└─ Pose requirements (avatars)
```

**Example Enhancement:**

**Original Description:**
```
"bronze sword"
```

**GPT-4 Enhanced:**
```
"Medieval bronze sword with leather-wrapped grip, detailed
crossguard with curved quillons, ornate engravings along the
fuller, low-poly game-ready style suitable for 3D conversion.
Clean geometry, straight blade pointing upward, handle at
bottom. Bronze material with slight patina and wear marks."
```

**When to Disable:**
- You've already written a very detailed description
- You want exact control over prompts
- Testing specific prompt formulas
- Cost saving (uses OpenAI API credits)

**Recommendation**: Keep enabled unless you're experienced with prompt engineering.

#### 8. Reference Image
```
Field: referenceImage
Type: Upload or URL (optional)

Supported Methods:
1. File Upload
   ├─ Drag & drop
   ├─ Click to browse
   └─ Formats: PNG, JPG, JPEG, WebP

2. URL Input
   └─ Paste publicly accessible image URL

If No Reference:
└─ AI generates concept art automatically
```

**Using Reference Images:**

**Upload Local File:**
```
1. Click "Upload Reference Image" button
2. Select file from computer
3. Preview shows image
4. Adjust if needed
```

**Use Image URL:**
```
1. Find publicly accessible image
2. Right-click → Copy Image Address
3. Paste URL into field
4. Preview confirms loading
```

**Best Reference Images:**
- Clear view of subject
- Good lighting
- Minimal background clutter
- Matches desired angle/pose
- High resolution (512px+)

**For Characters:**
- T-pose preferred
- Full body visible
- Front-facing angle
- Neutral lighting

**For Items:**
- Single item, isolated
- Clear silhouette
- All important features visible
- Professional product shot style

**When Reference Skips Concept Art:**
If you provide a reference image, the pipeline skips the GPT-Image-1 concept art generation stage and uses your image directly for 3D conversion.

---

### Generation Options

#### 9. Enable Material Variants
```
Field: enableRetexturing
Type: Checkbox (optional)
Default: Disabled

When Enabled:
Generates material variants after base model

Variants Created:
├─ Bronze (tier 1)
├─ Steel (tier 2)
├─ Mithril (tier 3)
└─ ... up to 9 preset materials

Cost Impact: +1 retexture API call per variant
Time Impact: +30-60 seconds per variant
```

**Use Cases:**
- Creating tier progression (bronze → steel → mithril)
- Equipment sets with multiple tiers
- Testing different materials quickly
- Building asset libraries

**See Also**: [Material Variants Guide](material-variants.md) for detailed information.

#### 10. Enable Sprite Generation
```
Field: enableSprites
Type: Checkbox (optional)
Default: Disabled

When Enabled:
Generates 2D sprites from 3D model

Sprite Configuration:
├─ Angles: 8 directions (0°, 45°, 90°, etc.)
├─ Resolution: 512x512px
├─ Background: Transparent PNG
└─ Camera: Orthographic

Time Impact: +2-5 minutes
```

**Use Cases:**
- 2D game assets
- UI icons
- Inventory thumbnails
- Mini-map sprites
- Documentation images

**See Also**: [Sprite Generation Guide](sprite-generation.md) for details.

#### 11. Enable Rigging (Avatars Only)
```
Field: enableRigging
Type: Checkbox (automatic for avatars)
Default: Enabled for avatar generation type

Rigging Pipeline:
├─ Meshy auto-rigging API
├─ Generates humanoid skeleton
├─ Creates animations (walk, run)
├─ Extracts T-pose model
└─ Saves rigged + unrigged versions

Time Impact: +5-10 minutes
Required for: Character animation
```

#### 12. Character Height (Avatars Only)
```
Field: characterHeight
Type: Number (meters)
Range: 0.3 - 8.0m
Default: 1.7m (human average)

Size Categories:
├─ Tiny: 0.3-0.6m (fairy, sprite)
├─ Small: 0.6-1.2m (gnome, halfling)
├─ Medium: 1.2-2.4m (human, elf)
├─ Large: 2.4-4.0m (troll, ogre)
├─ Huge: 4.0-6.0m (giant)
└─ Gargantuan: 6.0-8.0m (dragon, titan)

Common Presets:
├─ Fairy: 0.3m
├─ Gnome: 0.9m
├─ Dwarf: 1.3m
├─ Human: 1.83m
├─ Troll: 3.0m
├─ Giant: 5.0m
└─ Dragon: 8.0m
```

---

## Part 3: Pipeline Stages Explained

### Understanding the Progress Monitor

When you submit a generation, Asset Forge displays real-time progress through multiple pipeline stages:

```
Pipeline Progress Display:
┌─────────────────────────────────────┐
│ [✓] Prompt Enhancement    Completed │
│ [►] Concept Art           Running   │
│ [ ] 3D Generation         Pending   │
│ [ ] Normalization         Pending   │
│ [ ] Rigging (if avatar)   Pending   │
│ [ ] Variants (if enabled) Pending   │
│ [ ] Sprites (if enabled)  Pending   │
└─────────────────────────────────────┘
```

### Stage 1: Prompt Enhancement
```
Duration: 5-15 seconds
API: OpenAI GPT-4
Status Messages:
├─ "Enhancing description..."
├─ "Generating detailed prompts..."
└─ "Enhancement complete"

What Happens:
1. Sends your description to GPT-4
2. AI adds visual details and clarity
3. Ensures 3D conversion compatibility
4. Adds pose requirements (avatars)
5. Returns enhanced prompt

Possible Issues:
├─ OpenAI API key invalid → Check .env file
├─ API rate limit → Wait and retry
└─ Description too short → Add more detail
```

### Stage 2: Concept Art Generation
```
Duration: 30-90 seconds
API: OpenAI DALL-E 3 (GPT-Image-1)
Status Messages:
├─ "Generating concept art..."
├─ "Creating reference image..."
└─ "Concept art ready"

What Happens:
1. Uses enhanced prompt for image generation
2. Creates 1024x1024px concept art
3. Applies art style (RuneScape/Generic/Custom)
4. Uploads image to server
5. Displays preview

Skipped When:
└─ Reference image provided by user

Quality Tips:
├─ Check concept art preview
├─ Verify pose (T-pose for avatars)
├─ Confirm visual details match intent
└─ Regenerate if needed (before proceeding)
```

### Stage 3: 3D Model Generation
```
Duration: 2-15 minutes (quality dependent)
API: Meshy.ai Image-to-3D
Status Messages:
├─ "Submitting to Meshy..."
├─ "3D generation in progress..." (with progress %)
├─ "Processing model..."
└─ "3D model ready"

What Happens:
1. Uploads concept art to Meshy.ai
2. Meshy converts image to 3D mesh
3. Generates PBR textures (high/ultra quality)
4. Creates GLB file with embedded textures
5. Downloads completed model

Progress Updates:
├─ 0-25%: Mesh generation
├─ 25-50%: Topology optimization
├─ 50-75%: Texture generation
├─ 75-100%: Finalization
└─ 100%: Download and save

Possible Issues:
├─ Meshy API key invalid → Check .env
├─ Generation failed → Image quality issue, retry
├─ Timeout → Meshy server busy, try later
└─ Unsupported concept → Complex/abstract images fail
```

### Stage 4: Normalization
```
Duration: 1-5 seconds
Processing: Local (Asset Forge)
Status Messages:
├─ "Normalizing asset..."
├─ "Centering and scaling..."
└─ "Normalization complete"

What Happens:
1. Loads GLB into Three.js
2. Calculates bounding box
3. Centers model at origin (0,0,0)
4. Scales to standard size
5. Saves normalized GLB
6. Generates metadata with dimensions

Normalization Rules:
├─ Weapons: Grip at origin, blade pointing up
├─ Characters: Feet at Y=0, centered on XZ
├─ Buildings: Entry at origin, facing +Z
└─ Resources: Centered completely

Output:
├─ asset-name.glb (normalized)
└─ metadata.json (dimensions, orientation)
```

### Stage 5: Rigging (Avatars Only)
```
Duration: 5-10 minutes
API: Meshy.ai Auto-Rigging
Status Messages:
├─ "Submitting for rigging..."
├─ "Creating skeleton..." (progress %)
├─ "Generating animations..."
├─ "Extracting T-pose..."
└─ "Rigging complete"

What Happens:
1. Submits normalized model to Meshy rigging API
2. AI detects body parts and joints
3. Generates humanoid skeleton (standard rig)
4. Creates animations:
   ├─ Walking (2-second loop)
   └─ Running (1.5-second loop)
5. Extracts static T-pose
6. Saves multiple versions

Output Files:
├─ asset-name_rigged.glb (with skeleton + animations)
├─ t-pose.glb (static T-pose for armor fitting)
├─ animations/walking.glb
├─ animations/running.glb
└─ metadata.json (rig info, animation data)

Rig Structure:
Hips
├─ Spine
│  ├─ Spine1
│  ├─ Spine2
│  │  ├─ Neck
│  │  │  └─ Head
│  │  ├─ Shoulder_L → Arm_L → ForeArm_L → Hand_L
│  │  └─ Shoulder_R → Arm_R → ForeArm_R → Hand_R
├─ UpLeg_L → Leg_L → Foot_L
└─ UpLeg_R → Leg_R → Foot_R

Total: ~20 bones (humanoid standard)
```

### Stage 6: Material Variants (Optional)
```
Duration: 30-60 seconds per variant
API: Meshy.ai Retexture
Status Messages:
├─ "Generating bronze variant..."
├─ "Generating steel variant..."
└─ "All variants complete"

What Happens:
1. For each material preset:
   ├─ Submits base model
   ├─ Applies material style prompt
   ├─ Generates new textures
   ├─ Downloads retextured GLB
   └─ Saves with material name
2. Links variants to base asset
3. Updates metadata

Default Materials Generated:
├─ bronze (tier 1)
├─ steel (tier 2)
├─ mithril (tier 3)
├─ leather (tier 1, if applicable)
└─ ... (configurable)

See Also: [Material Variants Guide](material-variants.md)
```

### Stage 7: Sprite Generation (Optional)
```
Duration: 2-5 minutes
Processing: Local (Three.js rendering)
Status Messages:
├─ "Rendering sprites..."
├─ "Angle 0°, 45°, 90°..." (progress)
└─ "Sprites complete"

What Happens:
1. Loads 3D model into Three.js scene
2. Sets up orthographic camera
3. Adds consistent lighting
4. For each angle (0°, 45°, 90°, etc.):
   ├─ Rotates camera
   ├─ Renders frame
   ├─ Captures PNG with transparency
   └─ Saves sprite
5. Generates sprite metadata

Output:
├─ sprites/0deg.png
├─ sprites/45deg.png
├─ sprites/90deg.png
├─ ... (8 total)
└─ sprite-metadata.json

See Also: [Sprite Generation Guide](sprite-generation.md)
```

---

## Part 4: Viewing Results

### 3D Model Viewer

When generation completes, Asset Forge displays your asset in an interactive 3D viewer:

```
3D Viewer Controls:
├─ Left Mouse: Rotate camera (orbit)
├─ Right Mouse: Pan camera
├─ Scroll Wheel: Zoom in/out
├─ Double-click: Reset camera
└─ Touch: Pinch to zoom, drag to rotate

Viewer Features:
├─ Automatic centering and framing
├─ Grid floor for reference
├─ Directional lighting (shadows)
├─ Ambient lighting (soft fill)
├─ Background (gradient or solid)
└─ Wireframe toggle (optional)
```

**Inspecting Quality:**

**Check Mesh Quality:**
- Rotate to view all angles
- Look for:
  - Smooth surfaces (no faceting)
  - Clean edges
  - Proper topology
  - No holes or gaps
  - Correct proportions

**Check Textures:**
- Zoom in close
- Verify:
  - Texture resolution (sharp details)
  - PBR materials (metallic, roughness)
  - Color accuracy
  - No stretching or seams
  - Proper UV mapping

**Check Rigging (Avatars):**
- Load animations in viewer
- Play walk/run cycles
- Verify:
  - Smooth joint deformation
  - No mesh tearing
  - Natural movement
  - Proper bone weights

### Metadata Panel

View detailed information about your generated asset:

```json
{
  "name": "bronze-longsword",
  "type": "weapon",
  "subtype": "sword",
  "description": "Bronze medieval sword...",
  "generatedAt": "2025-01-21T12:00:00Z",
  "workflow": "GPT-4 → GPT-Image-1 → Meshy",
  "meshyTaskId": "abc123...",
  "quality": "high",
  "polycount": 12453,
  "textureResolution": 2048,
  "dimensions": {
    "width": 0.08,
    "height": 1.15,
    "depth": 0.02
  },
  "normalized": true,
  "isBaseModel": true,
  "materialVariants": ["bronze", "steel", "mithril"],
  "hasSprites": true,
  "hasModel": true,
  "hasConceptArt": true
}
```

**Key Metadata Fields:**

- **workflow**: Shows generation pipeline used
- **polycount**: Triangle count (6K/12K/20K target)
- **dimensions**: Size in meters (post-normalization)
- **normalized**: Confirms centering/scaling applied
- **materialVariants**: List of available retextures
- **hasSprites**: Whether sprite images exist

---

## Part 5: Downloading Assets

### Download Options

Asset Forge provides multiple download formats:

```
Download Menu:
├─ Download 3D Model (.glb)
│  ├─ Base model (normalized)
│  ├─ Rigged model (if avatar)
│  └─ T-pose model (if avatar)
│
├─ Download Concept Art (.png)
│
├─ Download Metadata (.json)
│
├─ Download Sprites (.zip)
│  └─ Contains all 8 angle PNGs
│
└─ Download All (.zip)
   └─ Complete asset package
```

**Download All Contents:**
```
bronze-longsword.zip
├─ bronze-longsword.glb (3D model)
├─ concept-art.png
├─ metadata.json
├─ sprites/
│  ├─ 0deg.png
│  ├─ 45deg.png
│  └─ ... (8 total)
└─ variants/
   ├─ steel-longsword.glb
   └─ mithril-longsword.glb
```

### Using Downloaded Assets

**In Game Engines:**

**Unity:**
```csharp
// Import GLB
// Drag bronze-longsword.glb into Assets/Models/

// Load at runtime
GameObject sword = Instantiate(
    Resources.Load<GameObject>("Models/bronze-longsword")
);
```

**Godot:**
```gdscript
# Import GLB into res://assets/models/
# Load in script
var sword = load("res://assets/models/bronze-longsword.glb")
var instance = sword.instance()
add_child(instance)
```

**Three.js (Web):**
```typescript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const loader = new GLTFLoader()
loader.load('bronze-longsword.glb', (gltf) => {
  scene.add(gltf.scene)
})
```

**Reading Metadata:**
```typescript
import metadata from './bronze-longsword/metadata.json'

console.log(metadata.dimensions)
// { width: 0.08, height: 1.15, depth: 0.02 }

console.log(metadata.type, metadata.subtype)
// "weapon" "sword"
```

---

## Part 6: Best Practices

### Writing Effective Descriptions

**Be Specific About Materials:**
```
❌ "metal sword"
✅ "bronze sword with steel crossguard"
✅ "weathered iron blade with brass pommel"
```

**Include Visual Details:**
```
❌ "sword"
✅ "straight double-edged blade with central fuller"
✅ "curved scimitar with decorated guard and jeweled pommel"
```

**Describe Textures:**
```
❌ "leather grip"
✅ "dark brown leather-wrapped grip with copper wire binding"
✅ "worn leather handle showing age and use"
```

**Specify Colors:**
```
❌ "goblin"
✅ "goblin with pale green skin and yellow eyes"
✅ "dark green scaled goblin with red warpaint"
```

**Mention Key Features:**
```
❌ "helmet"
✅ "steel helmet with nose guard and cheek plates"
✅ "bronze helmet with red plume and detailed engravings"
```

### Optimizing for Quality

**Standard Quality - Best For:**
- Testing new descriptions
- Placeholder assets during prototyping
- Background/distant objects
- High-volume asset needs (100+ items)
- Quick iteration on designs

**High Quality - Best For:**
- Production game assets (default choice)
- Character equipment and items
- Anything visible in gameplay
- Marketing screenshots
- PC and console games

**Ultra Quality - Best For:**
- Main character models
- Boss enemies
- Promotional/marketing materials
- VR applications (close viewing)
- Hero items (legendary weapons)

### Managing Costs

**OpenAI API (GPT-4 + DALL-E):**
```
Per Asset:
├─ GPT-4 Enhancement: ~$0.01-0.03
└─ DALL-E 3 Image: ~$0.04

Cost-Saving Tips:
├─ Disable GPT-4 enhancement if you write detailed prompts
├─ Provide reference images to skip DALL-E
└─ Use GPT-4 for hero assets only
```

**Meshy.ai Credits:**
```
Per Asset:
├─ Standard (6K poly): ~200 credits ($0.20)
├─ High (12K poly): ~400 credits ($0.40)
├─ Ultra (20K poly): ~600 credits ($0.60)
├─ Rigging: ~300 credits ($0.30)
└─ Retexture (per variant): ~100 credits ($0.10)

Cost-Saving Tips:
├─ Use Standard for testing/prototyping
├─ Reserve Ultra for hero assets only
├─ Limit material variants to needed tiers
├─ Batch similar assets together
```

**Total Cost Examples:**
```
Simple Weapon (Standard, no variants):
└─ $0.05 + $0.20 = ~$0.25

Production Weapon (High, 3 variants):
└─ $0.05 + $0.40 + $0.30 = ~$0.75

Hero Character (Ultra, rigged):
└─ $0.05 + $0.60 + $0.30 = ~$0.95
```

### Common Mistakes to Avoid

**1. Vague Descriptions:**
```
❌ "cool sword" → Undefined visual style
✅ "ornate bronze longsword with Celtic knotwork engravings"
```

**2. Narrative Descriptions:**
```
❌ "legendary sword wielded by ancient kings in the great war"
✅ "ornate golden sword with jeweled crossguard and rune inscriptions"
```

**3. Pose Instructions for Items:**
```
❌ "sword held upright" → Normalization handles orientation
✅ "straight blade, curved crossguard, leather grip"
```

**4. Size Specifications:**
```
❌ "6-foot tall character" → Use characterHeight field instead
✅ Just describe appearance, set height = 1.83m in form
```

**5. Including Multiples:**
```
❌ "sword and shield" → Generate separately
✅ Generate "bronze-sword" and "iron-shield" as two assets
```

**6. Extremely Complex Descriptions:**
```
❌ 500-word essay about sword history and lore
✅ 2-3 sentences focused on visual appearance
```

**7. Wrong Generation Type:**
```
❌ Using "item" for character → No rigging, wrong pipeline
✅ Use "avatar" for any animated character
```

---

## Part 7: Troubleshooting

### Generation Fails

**"Prompt Enhancement Failed"**
```
Cause: OpenAI API issue
Solutions:
├─ Verify OPENAI_API_KEY in .env
├─ Check API key is valid and active
├─ Verify billing/credits available
├─ Check OpenAI service status
└─ Try disabling GPT-4 enhancement
```

**"Concept Art Generation Failed"**
```
Cause: DALL-E generation issue
Solutions:
├─ Description may violate content policy
├─ Try rephrasing description
├─ Upload custom reference image instead
└─ Check OpenAI API status
```

**"3D Generation Failed"**
```
Cause: Meshy.ai conversion issue
Solutions:
├─ Verify MESHY_API_KEY in .env
├─ Check Meshy.ai credits available
├─ Concept art too complex/abstract
├─ Try simpler description
├─ Use different reference image
└─ Retry with "high" instead of "ultra"
```

**"Rigging Failed"**
```
Cause: Meshy rigging API issue
Solutions:
├─ Model not in proper T-pose
├─ Regenerate with emphasis on "T-pose"
├─ Use reference image showing T-pose
├─ Complex topology (tentacles, etc.)
└─ Check Meshy.ai credits
```

### Quality Issues

**"Model looks low quality"**
```
Solutions:
├─ Increase quality level (standard → high → ultra)
├─ Add more detail to description
├─ Use reference image for better accuracy
└─ Regenerate with GPT-4 enhancement enabled
```

**"Textures are blurry"**
```
Cause: Low texture resolution
Solutions:
├─ Use "high" or "ultra" quality
├─ Standard quality = 1024px (lower detail)
├─ High/Ultra = 2048px/4096px (sharper)
└─ Check concept art quality before 3D gen
```

**"Wrong colors/materials"**
```
Solutions:
├─ Be explicit about colors in description
├─ Specify material types clearly
├─ Review concept art preview before proceeding
├─ Use reference image with correct colors
└─ Regenerate with adjusted description
```

**"Model proportions off"**
```
Solutions:
├─ Normalization should fix most issues
├─ For characters, verify characterHeight setting
├─ Regenerate with clearer description
└─ Use reference image with correct proportions
```

### Performance Issues

**"Generation taking very long"**
```
Normal Times:
├─ Standard: 2-4 minutes
├─ High: 5-8 minutes
├─ Ultra: 10-20 minutes
├─ + Rigging: +5-10 minutes
└─ + Variants: +30-60 sec each

If Exceeding:
├─ Check Meshy.ai server status
├─ High traffic times may be slower
├─ Retry during off-peak hours
└─ Contact Meshy support if stuck >30min
```

**"Browser freezing during generation"**
```
Solutions:
├─ Close other browser tabs
├─ Disable browser extensions
├─ Use Chrome/Firefox (best performance)
├─ Increase RAM if possible (4GB+ recommended)
└─ Pipeline runs server-side, UI should stay responsive
```

---

## Part 8: Advanced Workflows

### Batch Generation

Generate multiple related assets efficiently:

**1. Create Base Asset:**
```
Name: bronze-sword
Type: weapon
Subtype: sword
Quality: high
Enable Variants: YES (bronze, steel, mithril)
Enable Sprites: NO (add later if needed)
```

**2. Generate Related Items:**
```
bronze-axe, bronze-mace, bronze-dagger
└─ All with same material variants
└─ Consistent style and quality
└─ Forms equipment set
```

**3. Add Sprites After:**
```
Generate sprites for final versions only
Saves time during iteration
```

### Iterative Refinement

**First Pass - Quick Test:**
```
Quality: standard
GPT-4: enabled
Variants: disabled
Sprites: disabled

Purpose: Test description and concept
```

**Second Pass - Refine:**
```
Adjust description based on first result
Maybe provide reference image
Still use standard quality
```

**Final Pass - Production:**
```
Quality: high or ultra
Enable variants
Enable sprites
Generate final asset
```

### Creating Equipment Sets

**Consistent Style Across Set:**

**1. Define Style Guide:**
```
Material: Bronze with copper accents
Style: Medieval fantasy, worn appearance
Details: Celtic knotwork engravings, leather grips
```

**2. Apply to All Pieces:**
```
bronze-longsword: "Bronze longsword with Celtic engravings..."
bronze-shield: "Round bronze shield with Celtic knotwork..."
bronze-helmet: "Bronze helmet with Celtic patterns..."
bronze-boots: "Bronze-reinforced leather boots..."
```

**3. Use Same Settings:**
```
All at "high" quality
Same material variants enabled
Consistent characterHeight for armor fitting
```

---

## Next Steps

Now that you understand asset generation, explore related features:

- **[Material Variants Guide](material-variants.md)** - Create tier progression systems
- **[Hand Rigging Guide](hand-rigging.md)** - Attach weapons to character hands
- **[Armor Fitting Guide](armor-fitting.md)** - Fit armor to any character
- **[Sprite Generation Guide](sprite-generation.md)** - Generate 2D game sprites
- **[Equipment System Guide](equipment-system.md)** - Equip items on characters

### Quick Reference

**Essential Fields:**
- Name (lowercase-with-hyphens)
- Type (weapon/armor/character/etc.)
- Subtype (sword/helmet/human/etc.)
- Description (2-3 detailed sentences)
- Quality (high recommended)

**Recommended Settings:**
- GPT-4 Enhancement: Enabled
- Quality: High (production)
- Variants: Only if needed for tier system
- Sprites: Only if using in 2D

**Description Formula:**
```
[Material] [Asset Type] with [Key Features],
[Secondary Details], [Style/Finish]

Example:
"Bronze medieval longsword with ornate crossguard,
leather-wrapped grip, weathered appearance"
```

---

[← Back to Index](../README.md) | [Next: Material Variants →](material-variants.md)
