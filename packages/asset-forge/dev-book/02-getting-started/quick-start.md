# Quick Start Guide

[← Back to Index](../README.md)

---

## Generate Your First Asset in 5 Minutes

This tutorial will walk you through generating your first 3D asset from a text description.

---

## Before You Begin

Make sure you have:
- ✅ Completed [Installation](installation.md)
- ✅ Configured API keys in `.env`
- ✅ Started the development server (`npm run dev`)
- ✅ Opened [http://localhost:3003](http://localhost:3003)

---

## Tutorial: Generate a Bronze Sword

### Step 1: Navigate to Generation Page

Click the **Generate** button in the navigation bar at the top of the screen.

You should see the Generation Type Selector with two options:
- **Items** - Weapons, armor, tools, buildings
- **Avatars** - Characters, NPCs, creatures

**For this tutorial, select Items.**

### Step 2: Fill in Asset Details

You'll see a form with several fields. Fill them in:

#### Basic Information

**Asset Name:**
```
bronze-sword
```
*This will be the file name (use kebab-case)*

**Asset Type:**
```
Select: weapon
```
*Choose from dropdown*

**Subtype:**
```
Select: sword
```
*Automatically filtered based on type*

**Description:**
```
A medieval bronze sword with leather-wrapped grip and ornate crossguard
```
*Be descriptive but concise*

#### Style Settings

**Game Style:**
```
Select: RuneScape 2007
```
*Or choose "Custom" and write your own style*

Keep the default style for now.

### Step 3: Configure Generation Options

#### Quality Level

**Select: High**

Quality options:
- Standard: 6,000 polys, 1024px textures (fast, 2-4 min)
- **High**: 12,000 polys, 2048px textures (balanced, 5-8 min) ← Recommended
- Ultra: 20,000 polys, 4096px textures (slow, 10-20 min)

#### Advanced Options

**Enable these options:**
- ✅ **Use GPT-4 Enhancement** - Improves description quality
- ✅ **Enable Material Variants** - Generate bronze, steel, mithril versions
- ❌ **Enable Sprites** - Skip for now (adds time)
- ❌ **Enable Rigging** - N/A for weapons

#### Material Variants

If you enabled Material Variants, select which materials to generate:

**Select:**
- ✅ Bronze (tier 1)
- ✅ Steel (tier 2)
- ✅ Mithril (tier 3)

This will create 3 versions of the sword with different textures.

### Step 4: Start Generation

Click the large **Start Generation** button at the bottom of the form.

You should see:
- Form disappears
- Progress view appears
- Pipeline status starts updating

### Step 5: Watch the Progress

The pipeline goes through several stages:

#### Stage 1: Text Input ✅
*Instant - Your description is validated*

#### Stage 2: GPT-4 Enhancement ⏳
*5-10 seconds - AI improves your description*

**Enhanced Description Example:**
```
"Medieval bronze sword with leather-wrapped grip, detailed ornate
crossguard with Celtic patterns, straight double-edged blade,
pommel for balance, low-poly RuneScape 2007 style, game-ready
geometry, handle at bottom, blade pointing upward"
```

#### Stage 3: Image Generation ⏳
*15-30 seconds - DALL-E creates concept art*

You'll see the concept art appear once generated.

#### Stage 4: Image-to-3D Conversion ⏳
*3-6 minutes - Meshy converts image to 3D*

**Progress indicators:**
- Initializing...
- Processing geometry...
- Generating textures...
- Finalizing model...

#### Stage 5: Material Variants ⏳
*2-4 minutes per variant - Generating bronze, steel, mithril*

Each variant shows individual progress.

#### Complete! ✅
*Total time: ~8-15 minutes for high quality with variants*

### Step 6: View Your Generated Assets

Once complete, you'll see:

**Base Model:**
- `bronze-sword`
- 3D preview
- Concept art thumbnail
- Download button

**Variants:**
- `bronze-sword-bronze`
- `bronze-sword-steel`
- `bronze-sword-mithril`

Click **View in Assets** button or navigate to the **Assets** tab.

### Step 7: Explore Your Assets

In the Assets tab:

#### 3D Viewer Controls

**Mouse:**
- Left Click + Drag: Rotate camera
- Right Click + Drag: Pan camera
- Scroll Wheel: Zoom in/out

**Keyboard:**
- R: Reset camera
- W: Toggle wireframe
- G: Toggle ground plane
- L: Toggle light/dark background

#### Asset Actions

Click on the asset card to see options:

- **View**: 3D preview (already open)
- **Download**: Export as GLB
- **Edit**: Update metadata
- **Delete**: Remove asset
- **Regenerate**: Create new base model
- **Sprites**: Generate 2D sprites

#### View Metadata

Click the info icon to see:
```json
{
  "name": "bronze-sword",
  "type": "weapon",
  "subtype": "sword",
  "polycount": 12000,
  "textureSize": 2048,
  "dimensions": {
    "width": 0.1,
    "height": 1.2,
    "depth": 0.05
  },
  "variants": ["bronze-sword-bronze", "bronze-sword-steel", "bronze-sword-mithril"],
  "generatedAt": "2025-01-21T12:34:56Z"
}
```

### Step 8: Download Your Asset

To use in your game:

1. Click the asset card
2. Click **Download** button
3. Save `bronze-sword.glb` file
4. Import into your game engine

**File Format**: GLB (binary GLTF)

**Compatibility**:
- Unity (with GLTF importer)
- Unreal Engine (with plugin)
- Three.js (native)
- Blender (native)
- Hyperscape (native)

---

## Next Steps

### Generate a Character

Try generating a rigged character:

1. Go to **Generate** tab
2. Select **Avatars**
3. Fill in:
   - Name: `goblin-warrior`
   - Type: `character`
   - Subtype: `creature`
   - Description: `Goblin warrior in T-pose wearing torn leather armor`
4. Enable:
   - ✅ GPT-4 Enhancement
   - ✅ Enable Rigging
   - ❌ Material Variants (characters don't use material variants)
5. Start Generation

**Note**: Character generation takes longer (15-25 minutes) due to rigging.

**Output:**
- `goblin-warrior.glb` - Normalized character
- `goblin-warrior_rigged.glb` - With skeleton
- `t-pose.glb` - T-pose extraction
- `animations/walking.glb` - Walking animation
- `animations/running.glb` - Running animation

### Try Hand Rigging

Rig a weapon to a hand pose:

1. Navigate to **Hand Rigging** tab
2. Upload a weapon model (or use generated sword)
3. Click **Detect Grip**
4. AI finds the handle area
5. Upload hand model (or use avatar)
6. Click **Rig Hands**
7. MediaPipe detects hand pose
8. Weapon positioned at grip
9. Download rigged weapon

See [Hand Rigging Guide](../03-user-guides/hand-rigging.md) for details.

### Try Armor Fitting

Fit armor to a character:

1. Navigate to **Armor Fitting** tab
2. Select character model
3. Select armor piece
4. Configure fitting method (Shrinkwrap recommended)
5. Click **Fit Armor**
6. Adjust parameters if needed
7. Enable weight transfer
8. Download fitted armor

See [Armor Fitting Guide](../03-user-guides/armor-fitting.md) for details.

---

## Common Issues & Solutions

### Generation Takes Too Long

**Problem**: Generation stuck at "Processing..."

**Solutions:**
- Wait longer (ultra quality can take 20+ minutes)
- Check [http://localhost:3004/api/health](http://localhost:3004/api/health) - should return JSON
- Check browser console for errors
- Check backend terminal for errors
- Try lower quality (standard)

### Low Quality Results

**Problem**: Model looks different from description

**Solutions:**
- Enable GPT-4 Enhancement
- Be more specific in description
- Add style keywords ("low-poly", "game-ready")
- Include pose requirements for characters ("T-pose", "arms stretched")
- Try regenerating with tweaked description

### Concept Art Different from 3D Model

**Problem**: Image looks great, but 3D model is different

**Why**: Meshy.ai interprets the image, may not capture all details

**Solutions:**
- Add more specific visual cues in image
- Mention geometric shapes explicitly
- Avoid complex details in concept art
- Use simpler descriptions for better 3D conversion

### Material Variants Look Wrong

**Problem**: Variants don't look like different materials

**Solutions:**
- Edit material prompt in settings
- Add more descriptive style prompts
- Increase quality level
- Try custom materials with detailed prompts

---

## Best Practices

### Writing Good Descriptions

**Good:**
```
"Bronze medieval sword, straight double-edged blade, leather-wrapped
grip, crossguard with Celtic patterns, pommel for balance,
low-poly game-ready style"
```

**Bad:**
```
"sword" ❌ Too vague
"A super amazing epic legendary sword of ultimate power" ❌ Too flowery
"sword with blade and handle" ❌ Too obvious
```

**Tips:**
- Be specific about materials (bronze, steel, wood)
- Mention key visual features (patterns, engravings, wear)
- Specify style (low-poly, realistic, stylized)
- Keep it concise (2-3 sentences)
- For characters: ALWAYS mention "T-pose"

### Choosing Quality Levels

| Use Case | Quality | Notes |
|----------|---------|-------|
| **Prototyping** | Standard | Fast iteration |
| **Placeholders** | Standard | Replace later |
| **Production** | High | Balanced |
| **Hero Assets** | Ultra | Main characters, featured items |
| **Testing** | Standard | Quick feedback |

### Managing Costs

**Minimize costs:**
- Use Standard quality for testing
- Disable GPT-4 Enhancement for simple assets
- Generate fewer material variants initially
- Batch generate assets in one session
- Review concept art before 3D conversion (cancel if needed)

**Cost Estimates:**
- Standard asset: ~$0.15 (OpenAI + Meshy)
- High quality with 3 variants: ~$0.40
- Ultra quality with rigging: ~$0.80

---

## Keyboard Shortcuts

### Global Shortcuts

| Key | Action |
|-----|--------|
| **G** | Navigate to Generate |
| **A** | Navigate to Assets |
| **Esc** | Close modal/dialog |

### 3D Viewer Shortcuts

| Key | Action |
|-----|--------|
| **R** | Reset camera |
| **W** | Toggle wireframe |
| **P** | Toggle ground plane |
| **L** | Toggle background |

---

## Next Tutorials

- [Asset Generation Deep Dive](../03-user-guides/asset-generation.md)
- [Material Variants](../03-user-guides/material-variants.md)
- [Hand Rigging](../03-user-guides/hand-rigging.md)
- [Armor Fitting](../03-user-guides/armor-fitting.md)

---

[← Back to Installation](installation.md) | [Next: Configuration →](configuration.md)
