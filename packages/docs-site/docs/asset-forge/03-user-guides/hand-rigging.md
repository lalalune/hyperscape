# Hand Rigging Guide

[← Back to Index](../README.md)

---

## Overview

Hand rigging automatically positions weapons in character hands using AI-powered grip detection and hand pose analysis. This eliminates manual bone parenting and positioning, making it easy to equip characters with weapons.

**What You'll Learn:**
- When to use hand rigging vs manual positioning
- Uploading weapon models for rigging
- AI grip detection with GPT-4 Vision
- Multi-angle rendering for accuracy
- Hand pose detection with MediaPipe
- Simple vs advanced rigging modes
- Understanding processing stages
- Viewing and validating results
- Exporting rigged weapons
- Troubleshooting detection issues

**Time to Complete**: 2-5 minutes per weapon

---

## When to Use Hand Rigging

### Hand Rigging vs Manual Positioning

**Use Hand Rigging When:**
- ✅ Equipping weapons on rigged characters
- ✅ Weapons have clear handle/grip areas
- ✅ Need automatic bone creation
- ✅ Want consistent grip positioning
- ✅ Working with humanoid characters

**Use Manual Positioning When:**
- ✅ Items don't have handles (shields, orbs)
- ✅ Attachments to non-hand bones (back, waist)
- ✅ Simple parent-child relationships sufficient
- ✅ Non-humanoid characters
- ✅ Custom positioning requirements

### Supported Weapon Types

Hand rigging works best with weapons that have clear grips:

```text
One-Handed Weapons:
├─ Sword: Handle at bottom, blade pointing up
├─ Axe: Wooden handle, blade at top
├─ Mace: Handle with ball/spikes at top
├─ Dagger: Short grip, blade upward
├─ Wand: Thin handle, magical focus at tip
└─ Shield: Arm strap or handle (advanced)

Two-Handed Weapons:
├─ Greatsword: Long handle, large blade
├─ Battleaxe: Long shaft, wide blade
├─ Staff: Long pole, ornament at top
├─ Spear: Long shaft, pointed tip
└─ Bow: Central grip, curved limbs

Ranged Weapons:
├─ Bow: Grip in center
├─ Crossbow: Stock grip, trigger area
└─ Firearm: Grip and trigger guard
```

**Characteristics of Riggable Weapons:**
- Clear visual distinction between handle and blade
- Handle area accessible and visible
- Consistent orientation (handle down, weapon up)
- Normalized models (from Asset Forge generation)

---

## Part 1: The Hand Rigging Workflow

### Complete Process Overview

```text
Hand Rigging Pipeline:
1. Upload Weapon Model
   └─ Load GLB file into system

2. Detect Wrist Bones
   └─ Find Hand_L and Hand_R bones in character

3. Render Multi-Angle Views
   ├─ Orthographic side view
   ├─ Orthographic top view
   └─ Orthographic front view

4. AI Grip Detection
   ├─ Send renders to GPT-4 Vision
   ├─ Identify handle/grip area
   ├─ Return bounding box coordinates
   └─ Calculate grip center point

5. Capture Hand Images
   ├─ Render character hands close-up
   ├─ Left hand and right hand separately
   └─ High-res orthographic captures

6. MediaPipe Hand Pose Detection
   ├─ Detect 21 hand landmarks per hand
   ├─ Calculate palm center
   ├─ Determine finger positions
   └─ Build hand orientation matrix

7. Create Hand Bones
   ├─ Generate wrist → palm hierarchy
   ├─ Create 5 finger chains (3 bones each)
   └─ Total: 17 bones per hand

8. Position Weapon
   ├─ Align weapon grip to palm center
   ├─ Match weapon orientation to hand
   └─ Apply offset transforms

9. Export Rigged Model
   ├─ Save GLB with hand bones
   ├─ Include weapon positioned in hand
   └─ Generate metadata
```

**Total Time**: 2-5 minutes (depends on model complexity)

---

## Part 2: Uploading Weapon Models

### Weapon Model Requirements

**File Format:**
- GLB (binary GLTF)
- Generated from Asset Forge (recommended)
- Or any normalized 3D model

**Geometry Requirements:**
```text
Polycount: 500 - 50,000 triangles
├─ Minimum: 500 (too low lacks detail)
├─ Recommended: 5,000 - 15,000
└─ Maximum: 50,000 (performance limit)

Normalization:
├─ Centered at origin (0, 0, 0)
├─ Handle/grip at bottom (negative Y)
├─ Blade/tip pointing up (positive Y)
├─ Facing forward (positive Z)
└─ Right-side visible from right (+X)
```

**Asset Forge Models:**
Asset Forge automatically normalizes weapons correctly:
- Grip centered at origin
- Blade pointing up
- Proper scale (meters)
- Clean topology

### Upload Methods

#### Method 1: From Asset Library

```text
1. Navigate to Asset Library
2. Find weapon asset (sword, axe, etc.)
3. Click "Hand Rigging" button
4. Select character model
5. Click "Start Rigging"
   └─ Weapon automatically loaded
```

#### Method 2: Upload Local File

```text
1. Go to Hand Rigging page
2. Click "Upload Weapon Model"
3. Select GLB file from computer
4. Preview loads in 3D viewer
5. Verify orientation:
   ├─ Handle at bottom
   ├─ Blade pointing up
   └─ Visible from all angles
6. Click "Next" to proceed
```

#### Method 3: Use URL

```text
1. Hand Rigging page
2. Enter GLB file URL
3. System downloads and loads
4. Preview in viewer
5. Proceed to rigging
```

### Validating Weapon Orientation

**Correct Orientation:**
```text
     ╱╲        ← Blade (top, +Y)
    ╱  ╲
   ╱────╲
   │    │      ← Guard (middle)
   │    │
   │    │      ← Handle (bottom, -Y, at origin)
   └────┘
```

**Incorrect Orientations:**
```text
❌ Sideways:          ❌ Upside-down:     ❌ Off-center:
   ────╲                 ┌────┐              ╱╲
       ╱                 │    │             ╱  ╲
      ╱                  │    │       →    ╱────╲
     ╲                   │    │              │
```

**Fix Orientation:**
If weapon is incorrectly oriented:
1. Regenerate with proper description
2. Or manually rotate in Blender before upload
3. Re-export as GLB
4. Re-upload to Asset Forge

---

## Part 3: AI Grip Detection

### How Grip Detection Works

Asset Forge uses GPT-4 Vision to intelligently identify weapon handles:

**Detection Process:**

```text
Step 1: Multi-Angle Rendering
├─ Render weapon from 3 angles
│  ├─ Side view (most important)
│  ├─ Top view (verify width)
│  └─ Front view (confirm depth)
├─ Resolution: 512x512px
├─ Background: Dark gray (#1a1a1a)
└─ Lighting: Ambient + directional

Step 2: Image Analysis
├─ Send each render to GPT-4 Vision API
├─ Prompt: "Identify the handle/grip area where
│          a hand would hold this weapon. Return
│          bounding box coordinates."
├─ AI analyzes visual features:
│  ├─ Material differences (wood vs metal)
│  ├─ Geometric transitions (handle vs blade)
│  ├─ Typical weapon patterns
│  └─ Ergonomic grip locations

Step 3: Coordinate Extraction
├─ GPT-4 returns grip bounds:
│  {
│    "minX": 0.35,
│    "minY": 0.60,
│    "maxX": 0.65,
│    "maxY": 0.85,
│    "confidence": 0.92,
│    "description": "wooden handle area"
│  }
└─ Coordinates in normalized space (0-1)

Step 4: Consensus Voting
├─ Compare results from all 3 angles
├─ Use weighted average:
│  ├─ Side view: 50% weight
│  ├─ Top view: 30% weight
│  └─ Front view: 20% weight
├─ Calculate final grip center
└─ Confidence = average of all views
```

**Confidence Levels:**
```text
0.9 - 1.0: Excellent (clear grip, high certainty)
0.7 - 0.9: Good (grip detected reliably)
0.5 - 0.7: Moderate (may need adjustment)
0.0 - 0.5: Poor (detection unreliable, manual review needed)
```

### Viewing Grip Detection Results

After detection completes, Asset Forge displays annotated images:

```text
Grip Detection Visualization:
┌─────────────────────────────┐
│  Side View (Primary)        │
│  ┌───────────────────┐      │
│  │                   │      │
│  │      ╱╲           │      │
│  │     ╱  ╲          │      │
│  │    ╱────╲         │      │
│  │    │┌──┐│  ← Red Box     │
│  │    ││  ││    (Grip)      │
│  │    │└──┘│         │      │
│  │    └────┘         │      │
│  └───────────────────┘      │
│  Confidence: 0.92           │
└─────────────────────────────┘
```

**Red Box = Detected Grip Area**

**Interpreting Results:**

**✅ Good Detection:**
- Red box covers handle area
- Excludes blade completely
- Centered on grip
- Reasonable size (20-40% of weapon)
- High confidence (>0.8)

**⚠️ Questionable Detection:**
- Red box too large/small
- Partially includes blade
- Off-center
- Moderate confidence (0.6-0.8)
- May still work, verify in viewer

**❌ Bad Detection:**
- Red box on blade
- Completely wrong area
- Very large or very small
- Low confidence (\<0.5)
- Requires manual adjustment

### Advanced: Consensus Mode

**Simple Mode (Default):**
- Single side-view render
- Fast (1 detection)
- Good for clear weapons

**Consensus Mode:**
- Three-angle analysis
- More accurate
- Better for complex weapons
- Slower (3 detections)

**Enable Consensus:**
```text
Hand Rigging Options:
☑ Use multi-angle consensus detection
```

**When to Use Consensus:**
- Complex handle geometry
- Ornate weapons with decorations
- Unclear grip boundaries
- Low confidence in simple mode
- Critical accuracy needs

---

## Part 4: Hand Pose Detection

### MediaPipe Hand Landmarks

Asset Forge uses TensorFlow.js with MediaPipe Hands to detect 21 landmarks per hand:

```text
Hand Landmark Points (21 total):
 0: Wrist
 1-4: Thumb (CMC, MCP, IP, Tip)
 5-8: Index (MCP, PIP, DIP, Tip)
 9-12: Middle (MCP, PIP, DIP, Tip)
13-16: Ring (MCP, PIP, DIP, Tip)
17-20: Pinky (MCP, PIP, DIP, Tip)

Landmark Groups:
├─ Wrist (1 point): Base of hand
├─ Palm: Center calculated from wrist + finger bases
├─ Thumb (4 points): 3 joints + tip
├─ Index (4 points): 3 joints + tip
├─ Middle (4 points): 3 joints + tip
├─ Ring (4 points): 3 joints + tip
└─ Pinky (4 points): 3 joints + tip
```

**Visual Representation:**
```text
        20 Pinky Tip
        │
     16 Ring Tip    12 Middle Tip
     │              │
  8 Index Tip   ──┼─┘
  │         ────│
  │    ────     4 Thumb Tip
  │ ───
 0 Wrist (Base)
```

### Hand Capture Process

```text
Step 1: Find Wrist Bones
├─ Search character skeleton for wrist bones
├─ Common names: Hand_L, Hand_R, LeftHand, RightHand
├─ Also try: Wrist_L, Wrist_R, mixamorig:LeftHand
└─ If found, proceed to capture

Step 2: Position Camera
├─ Calculate wrist position in world space
├─ Position orthographic camera facing hand
├─ Distance: 0.3 - 0.5m from hand
├─ Frame hand to fill 70% of canvas
└─ Resolution: 512x512px

Step 3: Render Hand
├─ Render character with hand visible
├─ Clean background (white or green screen)
├─ Good lighting (ambient + directional)
├─ Save as PNG data URL
└─ Separate captures for left and right

Step 4: MediaPipe Detection
├─ Load hand image into MediaPipe
├─ Detect landmarks (21 points)
├─ Convert screen coords to 3D world
├─ Calculate palm center:
│  └─ Average of wrist + 4 finger bases
├─ Determine hand orientation:
│  └─ Vector from wrist to middle finger base
└─ Return HandLandmarks object
```

**Detection Confidence:**

MediaPipe returns confidence per landmark:
```text
Confidence Thresholds:
├─ 0.9 - 1.0: Excellent (landmark clearly visible)
├─ 0.7 - 0.9: Good (landmark detected reliably)
├─ 0.5 - 0.7: Moderate (may have some error)
└─ < 0.5: Poor (landmark occluded or uncertain)

Overall Hand Confidence:
└─ Average of all 21 landmark confidences
```

**Minimum Confidence Setting:**
```text
Default: 0.7 (recommended)

Adjust based on needs:
├─ 0.9: Strict (may fail on partial views)
├─ 0.7: Balanced (good reliability)
├─ 0.5: Lenient (accepts more uncertain poses)
└─ Custom: Set in options
```

### Creating Hand Bones

After detection, Asset Forge creates a full hand skeleton:

**Bone Hierarchy:**
```text
Hand_R (wrist bone - already exists)
└─ Palm_R (new)
   ├─ Thumb_R (new)
   │  ├─ Thumb1_R (CMC joint)
   │  ├─ Thumb2_R (MCP joint)
   │  └─ Thumb3_R (IP joint)
   ├─ Index_R (new)
   │  ├─ Index1_R (MCP)
   │  ├─ Index2_R (PIP)
   │  └─ Index3_R (DIP)
   ├─ Middle_R (new)
   │  ├─ Middle1_R (MCP)
   │  ├─ Middle2_R (PIP)
   │  └─ Middle3_R (DIP)
   ├─ Ring_R (new)
   │  ├─ Ring1_R (MCP)
   │  ├─ Ring2_R (PIP)
   │  └─ Ring3_R (DIP)
   └─ Pinky_R (new)
      ├─ Pinky1_R (MCP)
      ├─ Pinky2_R (PIP)
      └─ Pinky3_R (DIP)

Total Bones Added: 16 per hand
├─ 1 Palm
└─ 15 Finger bones (5 fingers × 3 bones)
```

**Bone Positioning:**
Each bone's position and rotation is calculated from MediaPipe landmarks:
- Position: Landmark 3D coordinates
- Rotation: Vector to next landmark (bone direction)
- Length: Distance to next landmark

---

## Part 5: Simple vs Advanced Mode

### Simple Hand Rigging (Recommended)

**How It Works:**
```text
1. Detect weapon grip center
2. Detect hand palm center
3. Position weapon so grip = palm
4. Align weapon to hand orientation
5. Parent weapon to wrist bone
```

**Pros:**
- ✅ Fast (no bone creation)
- ✅ Works for most weapons
- ✅ Simple bone hierarchy
- ✅ Easy to adjust manually
- ✅ Less processing overhead

**Cons:**
- ❌ No finger articulation
- ❌ Fixed grip position
- ❌ Less realistic for animations
- ❌ Can't adjust individual fingers

**Best For:**
- Static poses
- Simple equipping
- Most one-handed weapons
- Quick workflows
- Low complexity needs

### Advanced Hand Rigging (Full Skeleton)

**How It Works:**
```text
1. Detect weapon grip center
2. Detect all 21 hand landmarks
3. Create 16 hand bones (palm + fingers)
4. Position weapon at grip
5. Calculate finger curl around handle
6. Set bone rotations for natural grip
7. Parent weapon to palm bone
```

**Pros:**
- ✅ Full finger articulation
- ✅ Natural grip appearance
- ✅ Animation-ready
- ✅ Realistic hand poses
- ✅ Fine-grained control

**Cons:**
- ❌ Slower processing
- ❌ More complex hierarchy
- ❌ Harder to manually adjust
- ❌ Requires good hand detection

**Best For:**
- Character animations
- Close-up shots
- Two-handed weapons
- Realistic combat poses
- Production assets

### Choosing the Right Mode

**Use Simple Mode When:**
- Weapon just needs to be "in hand"
- Static character poses
- Background NPCs
- Rapid prototyping
- Simple gameplay needs

**Use Advanced Mode When:**
- Fingers need to grip naturally
- Character animations planned
- Close camera views
- Realistic appearance important
- Two-handed weapon grip

**Comparison:**

```text
┌──────────────┬─────────────┬──────────────┐
│ Feature      │ Simple      │ Advanced     │
├──────────────┼─────────────┼──────────────┤
│ Time         │ 30 seconds  │ 2-3 minutes  │
│ Bones Added  │ 0           │ 16 per hand  │
│ Grip         │ Basic align │ Finger wrap  │
│ Animations   │ Limited     │ Full support │
│ Accuracy     │ Good        │ Excellent    │
│ Complexity   │ Low         │ High         │
└──────────────┴─────────────┴──────────────┘
```

---

## Part 6: Processing Stages

### Stage-by-Stage Breakdown

#### Stage 1: Model Loading
```text
Duration: 1-3 seconds
Status: "Loading weapon model..."

Process:
├─ Parse GLB file
├─ Load into Three.js scene
├─ Verify geometry exists
├─ Check for materials
└─ Display preview

Success:
└─ "Model loaded: 12,453 triangles"

Errors:
├─ "Invalid GLB file"
├─ "No geometry found"
└─ "File too large (>50MB)"
```

#### Stage 2: Wrist Bone Detection
```text
Duration: <1 second
Status: "Finding wrist bones..."

Process:
├─ Search skeleton for wrist bones
├─ Check common names:
│  ├─ Hand_L, Hand_R
│  ├─ LeftHand, RightHand
│  ├─ Wrist_L, Wrist_R
│  └─ mixamorig:LeftHand, etc.
├─ Identify left vs right
└─ Store bone references

Success:
└─ "Found 2 wrist bones: Hand_L, Hand_R"

Errors:
├─ "No wrist bones found" → Model not rigged
└─ "Ambiguous bone names" → Manual selection needed
```

#### Stage 3: Multi-Angle Rendering
```text
Duration: 2-5 seconds
Status: "Rendering weapon angles..."

Process:
├─ Setup orthographic camera
├─ Render side view (512×512)
├─ Render top view (512×512)
├─ Render front view (512×512)
├─ Convert to PNG data URLs
└─ Store for AI analysis

Output:
├─ side_view.png
├─ top_view.png
└─ front_view.png
```

#### Stage 4: GPT-4 Vision Analysis
```text
Duration: 5-15 seconds (per view)
Status: "Detecting weapon grip..."

Process:
├─ Send each render to OpenAI API
├─ Prompt includes:
│  ├─ "Identify the handle/grip area"
│  ├─ "Return bounding box coordinates"
│  └─ "Exclude blade/tip areas"
├─ Parse JSON response
├─ Extract grip bounds
└─ Calculate confidence

API Response Example:
{
  "gripBounds": {
    "minX": 0.40,
    "minY": 0.65,
    "maxX": 0.60,
    "maxY": 0.85
  },
  "confidence": 0.91,
  "description": "Leather-wrapped handle area"
}

Success:
└─ "Grip detected with 91% confidence"

Errors:
├─ "OpenAI API error" → Check API key
├─ "No grip detected" → Weapon unclear
└─ "Low confidence" → Try consensus mode
```

#### Stage 5: Consensus Calculation (If Enabled)
```text
Duration: <1 second
Status: "Calculating consensus grip..."

Process:
├─ Compare 3 grip detections
├─ Weight by view:
│  ├─ Side: 50%
│  ├─ Top: 30%
│  └─ Front: 20%
├─ Average coordinates
├─ Calculate center point
└─ Determine final confidence

Example:
Side:  minX=0.40, minY=0.65, conf=0.92
Top:   minX=0.38, minY=0.67, conf=0.88
Front: minX=0.42, minY=0.63, conf=0.85

Consensus:
minX = 0.40×0.5 + 0.38×0.3 + 0.42×0.2 = 0.398
minY = 0.65×0.5 + 0.67×0.3 + 0.63×0.2 = 0.652
Confidence = avg(0.92, 0.88, 0.85) = 0.883

Result:
└─ "Consensus grip center: (0.40, 0.65) conf: 88%"
```

#### Stage 6: Hand Capture
```text
Duration: 1-2 seconds per hand
Status: "Capturing hand poses..."

Process:
├─ For each wrist bone:
│  ├─ Calculate world position
│  ├─ Position orthographic camera
│  ├─ Render hand close-up
│  ├─ Save as data URL
│  └─ Store for MediaPipe
└─ Return left + right captures

Output:
├─ left_hand_capture.png
└─ right_hand_capture.png
```

#### Stage 7: MediaPipe Detection (Advanced Mode)
```text
Duration: 2-5 seconds per hand
Status: "Detecting hand landmarks..."

Process:
├─ Initialize TensorFlow.js
├─ Load MediaPipe Hands model
├─ Process each hand image
├─ Detect 21 landmarks
├─ Convert to 3D coordinates
├─ Calculate palm center
├─ Determine hand orientation
└─ Return HandLandmarks

Success:
└─ "Detected 21 landmarks, conf: 0.87"

Errors:
├─ "Hand not detected" → Bad capture angle
├─ "Low confidence" → Adjust minConfidence
└─ "Model loading failed" → Network issue
```

#### Stage 8: Bone Creation (Advanced Mode)
```text
Duration: <1 second
Status: "Creating hand bones..."

Process:
├─ Create palm bone
├─ Create 5 finger chains
│  └─ 3 bones per finger
├─ Set positions from landmarks
├─ Calculate rotations
├─ Build hierarchy
├─ Add to skeleton
└─ Update bone count

Added:
└─ "Created 16 hand bones"
```

#### Stage 9: Weapon Positioning
```text
Duration: <1 second
Status: "Positioning weapon..."

Process:
├─ Calculate grip center in 3D
├─ Calculate palm center in 3D
├─ Create transform matrix
├─ Translate weapon to palm
├─ Rotate to match hand orientation
├─ Apply offset (if configured)
└─ Parent to palm/wrist bone

Simple Mode:
└─ Parent to Hand_R bone

Advanced Mode:
└─ Parent to Palm_R bone
```

#### Stage 10: Export
```text
Duration: 2-5 seconds
Status: "Exporting rigged model..."

Process:
├─ Prepare GLTFExporter
├─ Include weapon + character
├─ Include skeleton with new bones
├─ Embed textures
├─ Generate binary GLB
├─ Create metadata
└─ Return download

Output:
├─ character_with_weapon.glb
└─ rigging_metadata.json

Metadata Example:
{
  "originalBoneCount": 24,
  "addedBoneCount": 16,
  "processingTime": 12500,
  "gripConfidence": 0.91,
  "handConfidence": 0.87,
  "mode": "advanced"
}
```

---

## Part 7: Viewing Results

### 3D Preview

After rigging completes, inspect the result:

**Viewer Controls:**
```text
Mouse Controls:
├─ Left Click + Drag: Rotate camera
├─ Right Click + Drag: Pan camera
├─ Scroll Wheel: Zoom in/out
└─ Double Click: Reset camera

Keyboard Shortcuts:
├─ Space: Play/pause animation
├─ R: Reset view
├─ W: Toggle wireframe
└─ G: Toggle grid
```

**What to Check:**

**1. Weapon Position:**
- Weapon in hand (not floating)
- Grip aligned with palm
- Blade pointing correct direction
- Not intersecting character mesh

**2. Hand Pose (Advanced Mode):**
- Fingers curved around handle
- Natural grip appearance
- Palm contacting grip
- Thumb position realistic

**3. Bone Hierarchy:**
- View skeleton in inspector
- Verify hand bones added
- Check parent-child relationships
- Confirm weapon parented correctly

**4. Animations (If Applicable):**
- Play walk/run animations
- Weapon moves with hand
- No detachment during motion
- Smooth transitions

### Debug Visualization

**Enable Debug Mode:**
```text
Hand Rigging Options:
☑ Show debug visualizations
```

**Debug Overlays:**

**Grip Detection Debug:**
```text
├─ Red box on grip area
├─ Confidence percentage
├─ Center point marker
└─ Multiple angle views
```

**Hand Landmarks Debug:**
```text
├─ 21 colored dots on hand
├─ Bone connections (lines)
├─ Palm center (green sphere)
├─ Wrist origin (blue sphere)
└─ Confidence values
```

**Bone Hierarchy Debug:**
```text
├─ Bone axes (RGB arrows)
├─ Joint spheres
├─ Bone names
└─ Transform gizmos
```

---

## Part 8: Exporting Rigged Weapons

### Export Formats

**GLB (Recommended):**
```text
Contains:
├─ Character mesh
├─ Weapon mesh
├─ Complete skeleton (original + hand bones)
├─ Materials and textures
├─ Animations (if present)
└─ Rigging metadata

Size: 2-10 MB (typical)
Compatible: Unity, Unreal, Three.js, Godot
```

**Download Options:**

**1. Download Rigged Model:**
```text
Includes: Character + weapon + skeleton
Use: Import into game engine
Format: .glb
```

**2. Download Weapon Only:**
```text
Includes: Just weapon mesh (no character)
Use: Swap weapons on different characters
Format: .glb
Note: Retains bone parenting
```

**3. Download Metadata:**
```text
Includes: Rigging information JSON
Use: Reference, debugging, re-rigging
Format: .json
```

### Using in Game Engines

**Unity:**
```csharp
// Import GLB
// Drag rigged_character.glb into Assets/Models/

// Instantiate
GameObject character = Instantiate(
    Resources.Load<GameObject>("Models/rigged_character")
);

// Access hand bones
Transform rightHand = character.transform.Find("Armature/Hips/.../Hand_R");
Transform palm = rightHand.Find("Palm_R");

// Weapon is already parented to palm
Transform weapon = palm.Find("sword");
```

**Unreal Engine:**
```text
1. Import GLB via FBX Import
2. Skeleton merges automatically
3. Weapon blueprint attached to Hand_R socket
4. Animations preserve weapon attachment
```

**Three.js:**
```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const loader = new GLTFLoader()
loader.load('rigged_character.glb', (gltf) => {
  const character = gltf.scene
  scene.add(character)

  // Find weapon
  const weapon = character.getObjectByName('sword')

  // Play animations
  const mixer = new THREE.AnimationMixer(character)
  const walkAction = mixer.clipAction(gltf.animations[0])
  walkAction.play()

  // Weapon follows hand automatically
})
```

---

## Part 9: Troubleshooting

### "No wrist bones found"

**Cause:** Character not rigged or non-standard bone names

**Solutions:**
```text
1. Verify character is rigged:
   └─ Open in Blender, check for armature

2. Check bone names:
   └─ Must include "hand", "wrist", or "Hand" in name

3. Rename bones in Blender:
   ├─ Find wrist bones
   ├─ Rename to "Hand_L" and "Hand_R"
   └─ Re-export as GLB

4. Use character from Asset Forge:
   └─ Auto-rigged characters have standard bones
```

### "Grip detection failed"

**Cause:** Weapon grip not visually clear

**Solutions:**
```text
1. Check weapon orientation:
   └─ Handle must be at bottom, blade at top

2. Verify visual distinction:
   └─ Handle should look different from blade
   └─ Material/color contrast helps

3. Enable consensus mode:
   └─ Multi-angle detection more reliable

4. Increase resolution:
   └─ Higher quality renders improve detection

5. Manual adjustment:
   └─ Edit grip bounds in advanced settings
```

### "Hand landmarks not detected"

**Cause:** MediaPipe couldn't find hand in capture

**Solutions:**
```text
1. Check hand visibility:
   └─ Hand must be visible in character model

2. Verify wrist bone position:
   └─ Wrist should be near actual hand mesh

3. Adjust capture settings:
   ├─ Increase captureResolution (512 → 1024)
   └─ Lower minConfidence (0.7 → 0.5)

4. Use simple mode instead:
   └─ Doesn't require landmark detection
```

### "Weapon positioned incorrectly"

**Cause:** Misalignment between grip and palm

**Solutions:**
```text
1. Check grip detection:
   └─ View annotated image, verify red box correct

2. Verify hand detection:
   └─ In debug mode, check palm center position

3. Manual offset adjustment:
   └─ Apply grip offset in settings
   └─ X/Y/Z translation adjustments

4. Re-run with different settings:
   └─ Try consensus mode
   └─ Adjust confidence thresholds
```

### "Low confidence score"

**Cause:** Ambiguous weapon or hand

**Solutions:**
```text
For Weapon Detection:
├─ Use clearer weapon model
├─ Add contrast between handle and blade
├─ Enable consensus mode
└─ Manually verify grip bounds

For Hand Detection:
├─ Ensure hand mesh exists
├─ Check character T-pose quality
├─ Lower minConfidence threshold
└─ Use simple mode (no hand detection needed)
```

---

## Part 10: Best Practices

### Weapon Preparation
✅ Generate weapons through Asset Forge (auto-normalized)
✅ Ensure clear visual grip area (wood handle, leather wrap)
✅ Verify correct orientation (handle down, blade up)
✅ Keep polycount reasonable (5K-15K)
✅ Use descriptive names (bronze-longsword, not sword1)

### Character Requirements
✅ Use rigged characters (from Asset Forge or external)
✅ Verify bone names include "hand" or "wrist"
✅ Ensure T-pose quality (arms extended, hands visible)
✅ Check hand mesh exists and is visible
✅ Confirm skeleton hierarchy is clean

### Mode Selection
✅ Use Simple mode for most cases (fast, reliable)
✅ Use Advanced mode for animations and close-ups
✅ Enable consensus for complex weapons
✅ Enable debug mode while learning
✅ Test both modes and compare results

### Iteration Workflow
✅ Start with simple mode to verify basic positioning
✅ If good, proceed with simple mode
✅ If weapon placement poor, try advanced mode
✅ Adjust confidence thresholds if detection fails
✅ Use debug visualizations to diagnose issues

---

## Next Steps

Continue with related features:

- **[Equipment System Guide](equipment-system.md)** - Equip multiple items on characters
- **[Armor Fitting Guide](armor-fitting.md)** - Fit armor to rigged characters
- **[Asset Generation Guide](asset-generation.md)** - Generate more weapons
- **[Material Variants Guide](material-variants.md)** - Create weapon tier sets

---

[← Back to Index](../README.md) | [Next: Armor Fitting →](armor-fitting.md)
