# Sprite Generation Guide

[← Back to Index](../README.md)

---

## Overview

Sprite generation converts 3D models into 2D images suitable for use in 2D games, UI systems, and documentation. Asset Forge renders models from multiple angles with consistent lighting and transparent backgrounds.

**What You'll Learn:**
- When to generate sprites vs using 3D models
- Configuration options (angles, resolution, background)
- Isometric vs standard perspective
- Multi-angle rendering process
- Viewing and managing sprite sheets
- Sprite metadata and organization
- Export formats and usage
- Integrating sprites into 2D games
- Batch sprite generation
- Optimization techniques

**Use Cases**: 2D games, inventory icons, UI thumbnails, documentation, reference sheets

---

## When to Generate Sprites

### Sprites vs 3D Models

**Use Sprites When:**
- ✅ Building 2D games (top-down, side-scrolling, isometric)
- ✅ Creating UI inventory icons
- ✅ Generating character portraits
- ✅ Documenting assets (reference images)
- ✅ Targeting low-power devices
- ✅ Reducing file size requirements
- ✅ Creating sprite-based animations

**Use 3D Models When:**
- ✅ Building 3D games (first-person, third-person, VR)
- ✅ Need dynamic lighting and shadows
- ✅ Require continuous rotation/viewing angles
- ✅ Want real-time animations
- ✅ Need interactive object manipulation
- ✅ Using modern game engines (Unity, Unreal)

### Common Sprite Use Cases

**2D RPG Games:**
```
Character Sprites:
├─ 8-direction movement (N, NE, E, SE, S, SW, W, NW)
├─ Multiple animation frames (walk cycle)
├─ Idle poses
└─ Attack animations

Item Sprites:
├─ Inventory icons (single angle, square)
├─ Equipment preview (rotated view)
└─ Loot drops (ground items)

Building Sprites:
├─ Isometric perspective
├─ 4 cardinal directions (for rotation)
└─ Interior/exterior views
```

**UI Systems:**
```
Icons:
├─ Inventory slots (64x64, 128x128)
├─ Skill buttons (square format)
├─ Equipment preview (character paper doll)
└─ Crafting materials

Thumbnails:
├─ Asset library previews
├─ Character selection screens
├─ Achievement icons
└─ Tooltip images
```

**Documentation:**
```
Reference Sheets:
├─ Asset catalog images
├─ Style guide illustrations
├─ Technical specifications
└─ Marketing materials
```

---

## Sprite Configuration

### Basic Settings

```typescript
Sprite Generation Config:
{
  modelPath: "bronze-longsword.glb",    // 3D model to render
  outputSize: 512,                       // 512x512px (or custom)
  angles: [0, 45, 90, 135, 180, 225, 270, 315], // 8 directions
  backgroundColor: "transparent",        // or color hex
  padding: 0.1,                         // 10% margin around object
  isometric: false                       // Standard vs isometric camera
}
```

### Resolution Options

**Recommended Sizes:**

```
┌────────────┬─────────────────┬──────────────┬─────────┐
│ Size       │ Use Case        │ File Size    │ Quality │
├────────────┼─────────────────┼──────────────┼─────────┤
│ 128x128    │ Small icons     │ 5-15 KB      │ Low     │
│ 256x256    │ Inventory icons │ 15-40 KB     │ Medium  │
│ 512x512    │ Character views │ 40-100 KB    │ High    │
│ 1024x1024  │ High detail     │ 100-300 KB   │ Very High│
│ 2048x2048  │ Promotional     │ 300-800 KB   │ Ultra   │
└────────────┴─────────────────┴──────────────┴─────────┘

Default: 512x512 (recommended)
```

**Choosing Resolution:**

**128x128 - Use When:**
- Mobile UI icons
- Small inventory slots
- Performance-critical applications
- Large sprite atlases (100+ sprites)

**256x256 - Use When:**
- Desktop inventory icons
- Standard UI elements
- Character portraits
- Item thumbnails

**512x512 - Use When:**
- Character sprites (main)
- Featured items
- Equipment preview
- High-quality icons

**1024x1024+ - Use When:**
- Hero characters
- Marketing materials
- Detailed inspection views
- Print documentation

### Angle Configuration

**8-Direction Standard:**
```
Default angles (degrees):
├─ 0°   : Front
├─ 45°  : Front-right
├─ 90°  : Right
├─ 135° : Back-right
├─ 180° : Back
├─ 225° : Back-left
├─ 270° : Left
└─ 315° : Front-left

Use: Top-down games, isometric RPGs
```

**4-Direction Simple:**
```
Cardinal angles:
├─ 0°   : Front
├─ 90°  : Right
├─ 180° : Back
└─ 270° : Left

Use: Simple 2D games, side-scrollers
```

**Single Angle:**
```
Front view only:
└─ 0° : Front

Use: UI icons, inventory items, static objects
```

**Custom Angles:**
```
Example - 3/4 view emphasis:
├─ 0°   : Front
├─ 30°  : Front-right (closer)
├─ 90°  : Right
├─ 150° : Back-right (closer)
└─ 180° : Back

Use: Specific game perspectives
```

**Animation Frames:**
```
Character walk cycle (per direction):
├─ Frame 1: Left foot forward
├─ Frame 2: Mid-stride
├─ Frame 3: Right foot forward
├─ Frame 4: Mid-stride
└─ Repeat

Total: 4 frames × 8 directions = 32 sprites
```

### Background Options

**Transparent (Default):**
```
backgroundColor: "transparent"

Output:
├─ PNG with alpha channel
├─ No background visible
├─ Composite over game backgrounds
└─ Ideal for most use cases
```

**Solid Color:**
```
backgroundColor: "#1a1a1a"  // Dark gray

Output:
├─ PNG with solid background
├─ Useful for testing
└─ Can be made transparent later
```

**Green Screen:**
```
backgroundColor: "#00FF00"  // Chroma green

Output:
├─ Easy chroma-key removal
├─ Compatible with video editing tools
└─ Use when post-processing sprites
```

**Gradient:**
```
Custom gradient backgrounds (advanced):
└─ Requires shader customization
```

### Padding Configuration

```
Padding controls margin around object:

padding: 0.0 (0%)        padding: 0.1 (10%)
┌────────────┐           ┌────────────┐
│  ╱╲        │           │            │
│ ╱  ╲       │           │    ╱╲      │
│╱────╲      │           │   ╱  ╲     │
│                        │  ╱────╲    │
└────────────┘           └────────────┘
Tight fit, may clip      Comfortable margin

padding: 0.2 (20%)       padding: 0.3 (30%)
┌────────────┐           ┌────────────┐
│            │           │            │
│      ╱╲    │           │            │
│     ╱  ╲   │           │     ╱╲     │
│    ╱────╲  │           │    ╱  ╲    │
│            │           │   ╱────╲   │
└────────────┘           └────────────┘
Good for icons           Too much space

Recommended: 0.1 (10%)
```

---

## Rendering Process

### Standard Perspective

**Camera Setup:**

```typescript
Camera Type: Orthographic
├─ Frustum: 5 units
├─ Aspect: 1:1 (square)
├─ Position: (5, 5, 5)
├─ Look At: (0, 0, 0)
└─ No perspective distortion

Lighting:
├─ Ambient Light: 0.6 intensity (soft fill)
├─ Directional Light: 0.8 intensity (main light)
│  ├─ Position: (5, 10, 5)
│  ├─ Cast shadows: true
│  └─ Shadow quality: soft PCF

Scene:
├─ Background: Transparent or colored
├─ Grid: Hidden
└─ Anti-aliasing: Enabled
```

**Rendering Pipeline:**

```
For Each Angle:
1. Load 3D model into scene
   └─ Parse GLB, add to Three.js scene

2. Calculate bounding box
   ├─ Measure model dimensions
   ├─ Find center point
   └─ Determine scale factor

3. Center and scale model
   ├─ Move to origin (0, 0, 0)
   ├─ Scale to fit in frame with padding
   └─ Update transform matrix

4. Position camera
   ├─ Calculate angle in radians
   ├─ Set camera position on circle
   │  └─ radius = 7 units from center
   ├─ Camera height: 5 units up (Y axis)
   └─ Look at center

5. Render frame
   ├─ WebGPU render call
   ├─ Apply anti-aliasing
   └─ Generate image buffer

6. Capture image
   ├─ Canvas.toDataURL('image/png')
   ├─ Save as blob
   └─ Store with angle metadata

7. Rotate to next angle
   └─ Repeat steps 4-6
```

**Time Estimate:**

```
Per Sprite:
├─ Model load: 0.5s
├─ Setup: 0.1s
├─ Render per angle: 0.2s
└─ Capture: 0.1s

Total (8 angles):
└─ ~3-5 seconds
```

### Isometric Perspective

**Isometric Camera:**

```typescript
Camera Configuration:
├─ Type: Orthographic (no perspective)
├─ Angle: 30° elevation
├─ Rotation: 45° horizontal
├─ Position calculation:
│  └─ angle = PI / 6 (30 degrees)
│  └─ x = 5 * cos(45°)
│  └─ y = 5 * tan(30°)
│  └─ z = 5 * sin(45°)
└─ Result: (3.54, 2.89, 3.54)

Isometric Grid:
     ╱╲
    ╱  ╲
   ╱────╲
   │    │
   └────┘

Use: Strategy games, isometric RPGs
```

**Isometric vs Standard:**

```
Standard (orthographic):      Isometric (30° elevation):
      ╱╲                           ╱‾‾╲
     ╱  ╲                         │    │
    ╱────╲                        │    │
    │    │                         ╲__╱
    │    │
    └────┘
Side-on view                    3/4 perspective

Use: Most 2D games              Use: Isometric games
```

**Enabling Isometric:**

```
Sprite Config:
☑ Use isometric perspective

Result:
└─ All angles rendered with 30° tilt
└─ Suitable for isometric game engines
```

---

## Viewing Generated Sprites

### Sprite Sheet Preview

After generation, Asset Forge displays all sprites:

```
┌──────────────────────────────────────┐
│ Sprite Sheet: bronze-longsword       │
├──────────────────────────────────────┤
│  0°     45°    90°    135°           │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐            │
│ │ ╱ │ │ ╱ │ │ │ │ │ ╲ │            │
│ │╱  │ │╱  │ │ │ │ │  ╲│            │
│ └───┘ └───┘ └───┘ └───┘            │
│ 180°   225°   270°   315°           │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐            │
│ │ ╲ │ │  ╲│ │ │ │ │╱  │            │
│ │  ╲│ │   │ │ │ │ │   │            │
│ └───┘ └───┘ └───┘ └───┘            │
├──────────────────────────────────────┤
│ Resolution: 512x512                  │
│ Format: PNG (transparent)            │
│ Total Size: 420 KB (8 images)        │
│ [Download All] [Download Individual] │
└──────────────────────────────────────┘
```

### Individual Sprite View

Click any sprite for detailed preview:

```
┌─────────────────────────────┐
│ Angle: 90° (Right side)     │
├─────────────────────────────┤
│                             │
│         ┌───┐               │
│         │   │               │
│         │   │               │
│         │ ╱ │               │
│         │╱  │               │
│         └───┘               │
│                             │
├─────────────────────────────┤
│ File: 90deg.png             │
│ Size: 512x512px             │
│ File Size: 52 KB            │
│ Transparent: Yes            │
│ [Download] [Copy] [Zoom]    │
└─────────────────────────────┘
```

**Inspection Tools:**

```
Zoom Levels:
├─ 50%: See full sprite
├─ 100%: Actual size
├─ 200%: Inspect details
└─ 400%: Check anti-aliasing

Grid Overlay:
├─ Pixel grid (1px intervals)
├─ 8x8 grid (for pixel alignment)
└─ Center markers

Transparency Check:
├─ Checkerboard background
├─ Solid color preview
└─ Edge highlighting
```

---

## Sprite Metadata

### Metadata Structure

```json
{
  "baseModel": "bronze-longsword",
  "modelPath": "bronze-longsword.glb",
  "config": {
    "angles": [0, 45, 90, 135, 180, 225, 270, 315],
    "resolution": 512,
    "backgroundColor": "transparent",
    "padding": 0.1,
    "isometric": false
  },
  "status": "completed",
  "sprites": [
    {
      "angle": 0,
      "angleDegrees": "0deg",
      "fileName": "0deg.png",
      "imageUrl": "data:image/png;base64,...",
      "fileSize": 52480,
      "dimensions": { "width": 512, "height": 512 }
    },
    // ... 7 more sprites
  ],
  "generatedAt": "2025-01-21T14:30:00Z",
  "processingTime": 4200,
  "totalFileSize": 419840
}
```

### File Organization

**Directory Structure:**

```
gdd-assets/
└─ bronze-longsword/
   ├─ bronze-longsword.glb          # 3D model
   ├─ metadata.json                  # Asset metadata
   ├─ sprites/                       # Sprite directory
   │  ├─ 0deg.png                   # Front
   │  ├─ 45deg.png                  # Front-right
   │  ├─ 90deg.png                  # Right
   │  ├─ 135deg.png                 # Back-right
   │  ├─ 180deg.png                 # Back
   │  ├─ 225deg.png                 # Back-left
   │  ├─ 270deg.png                 # Left
   │  ├─ 315deg.png                 # Front-left
   │  └─ sprite-metadata.json       # Sprite metadata
   └─ concept-art.png                # Original concept
```

**Sprite-Specific Metadata:**

```json
{
  "angles": [0, 45, 90, 135, 180, 225, 270, 315],
  "resolution": 512,
  "format": "png",
  "transparent": true,
  "spriteSheet": false,
  "frameSequence": false
}
```

---

## Export and Usage

### Download Options

**1. Download All Sprites (ZIP):**

```
Contents:
├─ 0deg.png
├─ 45deg.png
├─ 90deg.png
├─ 135deg.png
├─ 180deg.png
├─ 225deg.png
├─ 270deg.png
├─ 315deg.png
└─ sprite-metadata.json

Total Size: ~420 KB
Format: PNG with transparency
```

**2. Download Individual Sprites:**

```
Select specific angles:
☑ 0deg.png (front)
☐ 45deg.png
☑ 90deg.png (right)
☐ 135deg.png
☑ 180deg.png (back)
☐ 225deg.png
☑ 270deg.png (left)
☐ 315deg.png

Downloads: 4 selected sprites
```

**3. Download Sprite Atlas:**

```
Combined image format:
┌────────┬────────┬────────┬────────┐
│ 0deg   │ 45deg  │ 90deg  │ 135deg │
├────────┼────────┼────────┼────────┤
│ 180deg │ 225deg │ 270deg │ 315deg │
└────────┴────────┴────────┴────────┘

Output:
├─ Single 2048x1024 image (8 sprites)
├─ Includes UV mapping data
└─ Optimized for game engines
```

### Using Sprites in 2D Games

**Unity (2D):**

```csharp
// Import sprites
// Drag PNG files into Assets/Sprites/

// Create sprite array
public Sprite[] walkSprites; // 8 directions

// Assign in inspector or code
walkSprites[0] = Resources.Load<Sprite>("Sprites/0deg");
walkSprites[1] = Resources.Load<Sprite>("Sprites/45deg");
// ... etc

// Use in game
void Update() {
    float angle = Vector2.SignedAngle(Vector2.up, moveDirection);
    int spriteIndex = GetSpriteIndexFromAngle(angle);
    spriteRenderer.sprite = walkSprites[spriteIndex];
}

int GetSpriteIndexFromAngle(float angle) {
    // Convert angle (-180 to 180) to sprite index (0-7)
    float normalized = (angle + 180) / 360;  // 0 to 1
    int index = Mathf.RoundToInt(normalized * 8) % 8;
    return index;
}
```

**Godot:**

```gdscript
# Load sprites
var sprites = []
for i in range(8):
    var angle = i * 45
    sprites.append(load("res://sprites/%ddeg.png" % angle))

# Apply sprite based on direction
func update_sprite(direction: Vector2):
    var angle = direction.angle_to(Vector2.UP)
    var sprite_index = int((angle + PI) / (PI / 4)) % 8
    $Sprite.texture = sprites[sprite_index]
```

**Phaser (JavaScript):**

```javascript
// Preload sprites
function preload() {
    for (let angle = 0; angle < 360; angle += 45) {
        this.load.image(`sprite_${angle}`, `sprites/${angle}deg.png`)
    }
}

// Create sprite
function create() {
    this.player = this.add.sprite(400, 300, 'sprite_0')
}

// Update sprite based on movement
function update() {
    const angle = Phaser.Math.Angle.Between(
        player.x, player.y,
        target.x, target.y
    )
    const spriteDeg = Math.round(angle * 180 / Math.PI / 45) * 45
    this.player.setTexture(`sprite_${spriteDeg}`)
}
```

**CSS (UI Icons):**

```css
.inventory-item {
    width: 64px;
    height: 64px;
    background-image: url('sprites/0deg.png');
    background-size: contain;
    background-repeat: no-repeat;
}

.inventory-item:hover {
    transform: scale(1.2);
    cursor: pointer;
}
```

---

## Advanced Features

### Batch Sprite Generation

Generate sprites for multiple assets at once:

```
Batch Generation Workflow:
1. Select multiple assets
   ├─ All bronze weapons
   └─ 12 items selected

2. Configure shared settings
   ├─ Resolution: 512x512
   ├─ Angles: 8-direction
   └─ Background: Transparent

3. Click "Generate All Sprites"
   └─ Processes sequentially

4. Monitor progress
   ├─ bronze-sword: 100% (3.2s)
   ├─ bronze-axe: 100% (3.5s)
   └─ bronze-mace: 67% (processing...)

5. Download all
   └─ Combined ZIP with folders per asset
```

**Batch Output Structure:**

```
sprites_batch_2025-01-21.zip
├─ bronze-sword/
│  ├─ 0deg.png
│  ├─ 45deg.png
│  └─ ...
├─ bronze-axe/
│  ├─ 0deg.png
│  └─ ...
└─ bronze-mace/
   └─ ...
```

### Animation Frame Sequences

Generate sprite sheets from animations:

```
Animation to Sprites:
1. Load character with walk animation
2. Select animation: "Walking"
3. Configure frame extraction:
   ├─ Frames per second: 8
   ├─ Directions: 8
   └─ Total frames: 8 directions × 8 frames = 64 sprites

4. Generate sprite sheet
   └─ 64 individual frames

5. Use in sprite animation
   └─ Frame-by-frame playback
```

**Frame Naming:**

```
walk_north_frame1.png
walk_north_frame2.png
walk_northeast_frame1.png
walk_east_frame1.png
... (64 total)
```

### Sprite Atlas Generation

Combine sprites into optimized texture atlas:

```
Atlas Configuration:
├─ Max Atlas Size: 2048x2048
├─ Spacing: 2px between sprites
├─ Padding: 1px extrusion (prevent bleeding)
├─ Power-of-two: Yes (GPU optimization)
└─ Format: PNG or JSON

Output:
├─ atlas.png (combined image)
└─ atlas.json (sprite coordinates)

JSON Format:
{
  "frames": {
    "bronze-sword-0deg": {
      "frame": { "x": 0, "y": 0, "w": 512, "h": 512 },
      "sourceSize": { "w": 512, "h": 512 }
    },
    "bronze-sword-45deg": {
      "frame": { "x": 512, "y": 0, "w": 512, "h": 512 },
      "sourceSize": { "w": 512, "h": 512 }
    }
    // ... more sprites
  }
}
```

---

## Optimization Techniques

### File Size Reduction

**PNG Compression:**

```
Tool: pngquant, TinyPNG, or ImageOptim

Before: 52 KB per sprite
After: 18 KB per sprite
Savings: ~65% reduction

Command (pngquant):
pngquant --quality=65-80 sprites/*.png
```

**Resolution Scaling:**

```
For UI Icons:
├─ Generate at 1024x1024
├─ Downscale to 256x256 (display size)
└─ Result: Crisp on high-DPI screens

For Gameplay Sprites:
├─ Generate at 512x512
├─ Use as-is
└─ Scale in-engine if needed
```

**Sprite Culling:**

```
Only generate needed angles:
├─ Top-down game → 8 directions needed
├─ Side-scroller → 2 directions (left, right)
├─ UI icon → 1 direction (front)
└─ Saves 50-87% sprite count
```

### Performance Best Practices

**Loading:**
- ✅ Load sprite atlases, not individual files
- ✅ Use sprite pooling for repeated objects
- ✅ Lazy-load sprites off-screen
- ✅ Compress with GPU-friendly formats

**Rendering:**
- ✅ Batch sprites with same texture
- ✅ Use sprite batching in engine
- ✅ Limit active sprites on screen
- ✅ Use LOD sprites for distance

**Memory:**
- ✅ Unload unused sprite sets
- ✅ Share sprites between similar objects
- ✅ Use texture compression (ETC, ASTC)
- ✅ Limit sprite dimensions to power-of-two

---

## Troubleshooting

### "Sprites have jagged edges"

**Cause:** Anti-aliasing disabled or low resolution

**Solutions:**
```
1. Increase resolution:
   └─ 256 → 512 → 1024

2. Enable anti-aliasing:
   └─ Check renderer settings

3. Add slight padding:
   └─ padding: 0.1 → 0.15
```

### "Background not transparent"

**Cause:** Background setting or PNG export issue

**Solutions:**
```
1. Verify config:
   └─ backgroundColor: "transparent"

2. Check file format:
   └─ Must be PNG (not JPG)

3. Re-generate sprites
   └─ Clear cache, regenerate
```

### "Object clipped/cut off"

**Cause:** Insufficient padding or incorrect centering

**Solutions:**
```
1. Increase padding:
   └─ 0.1 → 0.15 → 0.2

2. Check model bounds:
   └─ Verify model centered at origin

3. Adjust camera distance:
   └─ Increase frustum size
```

### "Sprites too small/large"

**Cause:** Model scale inconsistency

**Solutions:**
```
1. Normalize model first:
   └─ Use Asset Forge normalization

2. Adjust padding:
   └─ Smaller padding = larger sprite

3. Manual scale:
   └─ Scale model before sprite generation
```

---

## Best Practices Summary

### Generation
✅ Use 512x512 for most sprites
✅ Enable transparency for compositing
✅ Add 10% padding to prevent clipping
✅ Generate only needed angles
✅ Batch process related assets

### Organization
✅ Use consistent file naming (0deg.png, not north.png)
✅ Store sprites in dedicated folder structure
✅ Include metadata.json with each set
✅ Archive source 3D models
✅ Document sprite usage

### Optimization
✅ Compress PNGs after generation
✅ Use sprite atlases for performance
✅ Remove unused sprites
✅ Scale to appropriate resolution
✅ Test in target game engine

---

## Next Steps

Related workflows:

- **[Asset Generation Guide](asset-generation.md)** - Generate 3D models for sprite conversion
- **[Material Variants Guide](material-variants.md)** - Generate sprites for each material tier
- **[Equipment System Guide](equipment-system.md)** - Preview equipped characters before sprite generation

---

[← Back to Index](../README.md) | [Previous: Equipment System ←](equipment-system.md)
