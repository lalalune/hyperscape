# Asset Forge Features

[← Back to Index](../README.md)

---

## Complete Feature List

Asset Forge provides a comprehensive suite of features for AI-powered 3D asset generation and management.

---

## 🎨 Asset Generation Features

### Text-to-3D Conversion

Convert natural language descriptions into 3D models:

```text
Input Examples:
├─ "A bronze medieval sword with leather-wrapped grip"
├─ "Goblin warrior in T-pose, wearing torn leather armor"
├─ "Stone bank building with wooden door and iron bars"
└─ "Glowing red ruby gemstone with facets"

Output:
├─ GLB 3D model
├─ Concept art (PNG)
├─ Metadata (JSON)
└─ Normalized dimensions
```

**Supported Asset Categories:**
- Characters (humanoid, creatures)
- Weapons (melee, ranged, magic)
- Armor (helmet, chest, legs, accessories)
- Buildings (banks, stores, temples)
- Resources (ores, bars, gems)
- Tools (pickaxe, axe, fishing rod)
- Consumables (potions, food, runes)

### Quality Levels

Three quality tiers for different use cases:

| Feature | Standard | High | Ultra |
|---------|----------|------|-------|
| **Polycount** | 6,000 | 12,000 | 20,000 |
| **Texture Size** | 1024px | 2048px | 4096px |
| **PBR Materials** | ❌ | ✅ | ✅ |
| **Generation Time** | 2-4 min | 5-8 min | 10-20 min |
| **Use Case** | Placeholder | Production | Hero assets |
| **AI Model** | meshy-5 | meshy-5 | meshy-5 |

### GPT-4 Prompt Enhancement

Automatically enhance user descriptions for better results:

```text
Original: "bronze sword"

Enhanced: "Medieval bronze sword with leather-wrapped grip,
detailed crossguard, ornate engravings on blade, low-poly
game-ready style, clean geometry suitable for 3D conversion,
straight blade pointing upward, handle at bottom"
```

**Enhancement Types:**
- **Visual Details**: Adds specific visual elements
- **Material Descriptions**: Enhances texture prompts
- **Geometric Clarity**: Ensures clean 3D conversion
- **Style Consistency**: Maintains art direction
- **Pose Requirements**: Enforces T-pose for characters

### Reference Image Support

Generate from custom reference images:

```text
Upload Methods:
├─ File Upload: Drag & drop or browse
├─ URL Input: Paste image URL
└─ Auto-Generate: AI creates concept art

Supported Formats:
├─ PNG (recommended)
├─ JPG/JPEG
└─ WebP
```

---

## 🔄 Material Variant System

### Automatic Retexturing

Generate material variants from a single base model:

```text
Base Model: "steel_longsword"

Material Variants:
├─ bronze_longsword    (tier 1, copper brown)
├─ steel_longsword     (tier 2, silver gray)
├─ mithril_longsword   (tier 3, blue-gray shimmer)
├─ adamant_longsword   (tier 4, green metallic)
└─ rune_longsword      (tier 5, cyan glow)

Each Variant Includes:
✓ Retextured 3D model
✓ Material-specific metadata
✓ Tier information
✓ Link to base model
✓ Style consistency
```

### Material Presets

9 built-in material presets + custom materials:

**Metals:**
- Bronze (tier 1): Copper brown, oxidized patina
- Steel (tier 2): Silver gray, polished
- Mithril (tier 3): Blue-gray, magical shimmer

**Leathers:**
- Leather (tier 1): Brown cowhide, worn
- Hard-leather (tier 2): Reinforced, sturdy
- Studded-leather (tier 3): Metal studs

**Woods:**
- Wood (tier 1): Light pine
- Oak (tier 2): Medium brown
- Willow (tier 3): Pale yellow-green

**Special:**
- Dragon (tier 10): Red matte finish

### Custom Materials

Create unlimited custom materials:

```typescript
interface CustomMaterial {
  name: string              // "obsidian"
  displayName: string       // "Obsidian"
  prompt: string            // "black volcanic glass texture"
  color?: string            // "#1a1a1a"
  category?: string         // "special"
}
```

---

## 🦴 Character Rigging

### Auto-Rigging System

Automatically rig characters with full skeleton:

```text
Input:
└─ Character model in T-pose

Rigging Process:
├─ 1. Submit to Meshy rigging API
├─ 2. Generate humanoid skeleton
├─ 3. Create basic animations
├─ 4. Extract T-pose model
└─ 5. Save rigged + unrigged versions

Output:
├─ character_rigged.glb      # With skeleton
├─ t-pose.glb                # T-pose only
├─ animations/
│   ├─ walking.glb
│   └─ running.glb
└─ metadata.json
```

**Rig Types:**
- humanoid-standard (bipedal characters)
- creature (quadrupeds, dragons)
- custom (specialized rigs)

### Animation Support

Generated animations include:

| Animation | Duration | Use Case |
|-----------|----------|----------|
| **Walking** | ~2s loop | Standard movement |
| **Running** | ~1.5s loop | Fast movement |
| **T-pose** | Static | Armor fitting, reference |

**Animation Features:**
- Looping animations
- Smooth transitions
- Compatible with Three.js
- Extractable as separate files

### Height Normalization

Characters normalized to consistent scale:

```text
Configuration:
├─ Target Height: 1.7m (default)
├─ Height Range: 0.3m - 8.0m
└─ Scaling Method: Proportional

Size Categories:
├─ Tiny: 0-0.6m (0.5x scale)
├─ Small: 0.6-1.2m (0.75x scale)
├─ Medium: 1.2-2.4m (1.0x scale)
├─ Large: 2.4-4.0m (1.5x scale)
├─ Huge: 4.0-6.0m (2.0x scale)
└─ Gargantuan: 6.0m+ (3.0x scale)

Presets:
├─ Fairy: 0.3m
├─ Gnome: 0.9m
├─ Human: 1.83m
├─ Troll: 3.0m
├─ Giant: 5.0m
└─ Dragon: 8.0m
```

---

## 🤲 Hand Rigging for Weapons

### AI-Powered Grip Detection

Automatically detect weapon handle using computer vision:

```text
Detection Workflow:
1. Render weapon from multiple angles
   ├─ Front view
   ├─ Side view
   └─ Top view

2. Send each render to GPT-4 Vision
   └─ Prompt: "Identify the handle/grip area"

3. AI returns grip bounding box
   └─ { minX, minY, maxX, maxY, confidence }

4. Calculate grip center point
   └─ Consensus from multi-angle views

5. Position weapon at origin
   └─ Grip center at (0, 0, 0)
```

**Grip Detection Features:**
- Multi-angle consensus voting
- Confidence scoring
- Weapon type classification
- Part identification (blade, guard, pommel)

### Hand Pose Detection

Use MediaPipe to detect hand poses:

```text
MediaPipe Hand Landmarks:
├─ 21 3D keypoints per hand
├─ Finger joint positions
├─ Palm center
├─ Wrist position
└─ Handedness (left/right)

Detection Process:
1. Initialize TensorFlow.js + MediaPipe
2. Capture hand image from model
3. Detect 21 landmarks
4. Map to finger bones
5. Calculate grip alignment
6. Position weapon to hand
```

**Hand Rigging Options:**

| Option | Description | Default |
|--------|-------------|---------|
| **smoothingIterations** | Smooth hand pose | 3 |
| **minConfidence** | Detection threshold | 0.7 |
| **debugMode** | Show debug images | false |
| **captureResolution** | Hand capture size | 512px |

### Bone Creation

Automatically create hand bones:

```text
Hand Bone Hierarchy:
wrist
├─ palm
│  ├─ thumb (3 bones)
│  │  ├─ CMC
│  │  ├─ MCP
│  │  └─ IP
│  ├─ index (3 bones)
│  ├─ middle (3 bones)
│  ├─ ring (3 bones)
│  └─ pinky (3 bones)

Total: 1 wrist + 1 palm + 15 finger bones = 17 bones per hand
```

---

## 🛡️ Armor Fitting System

### Multi-Method Fitting

Three fitting algorithms for different use cases:

#### 1. Shrinkwrap Fitting

Advanced mesh deformation to character surface:

```text
Algorithm:
1. Cast rays from armor vertices
2. Find closest character surface point
3. Move vertex toward target (stepSize)
4. Apply Laplacian smoothing
5. Preserve features (edges, corners)
6. Repeat for N iterations

Parameters:
├─ iterations: 10-50
├─ stepSize: 0.1-1.0
├─ smoothingRadius: 0.05-0.2
├─ targetOffset: 0.0-0.05 (padding)
├─ preserveFeatures: true/false
└─ featureAngleThreshold: 30-90°
```

**Best For**: Tight-fitting armor (helmets, breastplates)

#### 2. Collision Fitting

Physics-based collision detection:

```text
Algorithm:
1. Detect armor-character intersections
2. Move intersecting vertices away
3. Smooth deformation
4. Repeat until no collisions

Parameters:
├─ collisionIterations: 5-20
├─ stiffness: 0.1-1.0
└─ margin: 0.01-0.1
```

**Best For**: Loose armor (capes, robes)

#### 3. Smooth Fitting

Smooth deformation with detail preservation:

```text
Algorithm:
1. Compute body regions
2. Fit armor to region bounds
3. Apply smooth deformation
4. Preserve original topology

Parameters:
├─ smoothingIterations: 5-15
└─ preserveDetails: true/false
```

**Best For**: Flexible armor (leather, cloth)

### Weight Transfer

Transfer skeleton weights from character to armor:

```text
Transfer Methods:

1. Nearest Point:
   ├─ Find closest character vertex
   └─ Copy bone weights

2. Projected Surface:
   ├─ Project armor vertex onto character
   └─ Interpolate weights from nearby vertices

3. Inpainted:
   ├─ Fill gaps in weight map
   └─ Smooth weight transitions

Weight Smoothing:
├─ Build vertex neighbor graph
├─ Average weights with neighbors
├─ Normalize (sum to 1.0)
└─ Clamp to valid range [0, 1]
```

**Output**: Armor mesh with skeletal weights for deformation

### Equipment Slots

Pre-configured attachment points:

| Slot | Bone | Supported Items |
|------|------|-----------------|
| **Right Hand** | Hand_R | Weapons, tools |
| **Left Hand** | Hand_L | Shields, off-hand |
| **Head** | Head | Helmets, hoods |
| **Chest** | Spine2 | Body armor, robes |
| **Legs** | Hips | Leg armor, pants |

**Slot Features:**
- Automatic bone detection
- Multi-name fallback
- Transform offsets
- Scale adjustments

---

## 🖼️ Sprite Generation

### Multi-Angle Rendering

Generate 2D sprites from 3D models:

```text
Default Configuration:
├─ Angles: 8-direction
│  ├─ 0° (front)
│  ├─ 45° (front-right)
│  ├─ 90° (right)
│  ├─ 135° (back-right)
│  ├─ 180° (back)
│  ├─ 225° (back-left)
│  ├─ 270° (left)
│  └─ 315° (front-left)
├─ Resolution: 512x512px
├─ Background: Transparent
└─ Camera: Orthographic

Lighting Setup:
├─ Ambient: 0.5 intensity
├─ Directional: 1.0 intensity
└─ Position: (5, 5, 5)
```

### Sprite Modes

Multiple sprite generation modes:

**1. Standard Sprites:**
- Fixed angles
- Consistent scale
- Transparent background

**2. Isometric Sprites:**
- 45° camera angle
- Top-down perspective
- 8 cardinal directions

**3. Character Sprites:**
- Multiple poses (idle, walk, attack)
- Animation frames
- Shadow layers

### Sprite Export

Sprites saved with metadata:

```json
{
  "baseModel": "steel-sword",
  "modelPath": "steel-sword.glb",
  "config": {
    "angles": 8,
    "resolution": 512,
    "backgroundColor": "transparent"
  },
  "status": "completed",
  "angles": [0, 45, 90, 135, 180, 225, 270, 315],
  "generatedAt": "2025-01-21T12:00:00Z"
}
```

**File Structure:**
```text
asset-id/
├─ sprites/
│  ├─ 0deg.png
│  ├─ 45deg.png
│  ├─ 90deg.png
│  └─ ...
└─ sprite-metadata.json
```

---

## 📚 Asset Management

### Asset Library

Browse and manage all generated assets:

```text
Features:
├─ Grid/3D view toggle
├─ Search by name
├─ Filter by type
├─ Filter by material
├─ Sort by date
├─ Variant grouping
└─ Metadata viewing
```

### Asset Actions

Available operations per asset:

| Action | Description |
|--------|-------------|
| **View** | 3D preview with OrbitControls |
| **Download** | Export as GLB |
| **Edit** | Update metadata |
| **Delete** | Remove (with variants) |
| **Retexture** | Generate material variant |
| **Regenerate** | Create new base model |
| **Sprites** | Generate sprite sheet |

### Metadata Tracking

Comprehensive metadata for each asset:

```json
{
  "name": "steel-sword",
  "type": "weapon",
  "subtype": "sword",
  "description": "...",
  "detailedPrompt": "...",
  "generatedAt": "2025-01-21T12:00:00Z",
  "workflow": "GPT-4 → GPT-Image-1 → Meshy",
  "meshyTaskId": "...",
  "isBaseModel": true,
  "materialVariants": ["bronze", "steel", "mithril"],
  "hasModel": true,
  "hasConceptArt": true,
  "normalized": true,
  "dimensions": {
    "width": 0.1,
    "height": 1.2,
    "depth": 0.05
  }
}
```

---

## 🎛️ Configuration & Customization

### Material Presets

Customize material presets:

```typescript
{
  id: "obsidian",
  name: "obsidian",
  displayName: "Obsidian",
  category: "special",
  tier: 8,
  color: "#1a1a1a",
  stylePrompt: "black volcanic glass texture, sharp reflections, ..."
}
```

### AI Prompts

Customize generation prompts:

**Game Style Prompts:**
- RuneScape 2007: "Low-poly RuneScape style..."
- Generic: "Game-ready 3D asset..."
- Custom: User-defined styles

**Asset Type Prompts:**
- Character: "Standing in T-pose..."
- Armor: "Shaped for T-pose body..."
- Weapon: "Handle at bottom, blade up..."

### Pipeline Options

Fine-tune generation pipeline:

```text
Options:
├─ useGPT4Enhancement: true/false
├─ enableRetexturing: true/false
├─ enableSprites: true/false
├─ enableRigging: true/false (avatars)
├─ quality: standard/high/ultra
├─ characterHeight: 0.3-8.0m
└─ materialPresets: array
```

---

## 🔧 Developer Features

### API Access

Full REST API for programmatic access:

```bash
# Generate asset
POST /api/generation/pipeline

# Check status
GET /api/generation/pipeline/:id

# List assets
GET /api/assets

# Retexture
POST /api/retexture
```

See [REST API Reference](../12-api-reference/rest-api.md) for details.

### TypeScript Support

Fully typed with TypeScript:

```typescript
import type {
  Asset,
  GenerationConfig,
  PipelineStatus,
  MaterialPreset
} from './types'
```

### Extensibility

Easy to extend:

- Add new asset types
- Create custom materials
- Modify prompts
- Add fitting methods
- Create custom pipelines

---

## 🎯 Performance Features

### Optimization

- **Concurrent Generation**: Multiple assets in parallel
- **Progress Tracking**: Real-time pipeline updates
- **Caching**: Prompt template caching
- **Lazy Loading**: On-demand 3D model loading
- **Debouncing**: Search/filter optimization

### Resource Management

- **Blob URL Cleanup**: Automatic memory management
- **3D Disposal**: Three.js resource cleanup
- **File Streaming**: Efficient large file handling
- **Compression**: GLB binary format

---

## Next Steps

Explore specific features in detail:

- [Architecture](architecture.md) - System design
- [User Guides](../03-user-guides/) - Feature tutorials
- [API Reference](../12-api-reference/) - Programmatic access

---

[← Back to Introduction](introduction.md) | [Next: Architecture →](architecture.md)
