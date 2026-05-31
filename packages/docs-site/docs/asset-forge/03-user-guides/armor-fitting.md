# Armor Fitting Guide

[← Back to Index](../README.md)

---

## Overview

Armor fitting automatically deforms armor meshes to fit any character model using advanced mesh algorithms and weight transfer. This allows you to create one armor piece and fit it to multiple character types without manual rigging.

**What You'll Learn:**
- Selecting character and armor models
- Understanding fitting methods (shrinkwrap, collision, smooth)
- Configuring parameters for best results
- Weight transfer options and techniques
- Equipment slot targeting
- Helmet and chest plate fitting
- Monitoring fitting progress
- Exporting fitted armor
- Undo/redo functionality
- Troubleshooting common issues

**Time to Complete**: 30 seconds to 2 minutes per armor piece

---

## Fitting Methods Overview

Asset Forge offers three distinct fitting algorithms:

### 1. Shrinkwrap Fitting

**Best For:** Tight-fitting armor (helmets, breastplates, gauntlets)

```
Algorithm:
1. Cast rays from each armor vertex toward character
2. Find closest point on character surface
3. Move vertex toward target (stepSize parameter)
4. Apply Laplacian smoothing to prevent bunching
5. Preserve sharp edges and features
6. Repeat for N iterations

Parameters:
├─ iterations: 10-50 (more = tighter fit)
├─ stepSize: 0.1-1.0 (how much to move per iteration)
├─ smoothingRadius: 0.05-0.2 (smoothing area)
├─ targetOffset: 0.0-0.05 (padding from skin)
├─ preserveFeatures: true/false
└─ featureAngleThreshold: 30-90° (what counts as sharp edge)

Pros:
✅ Excellent conformance to character shape
✅ Handles complex curves well
✅ Preserves armor detail
✅ Consistent results

Cons:
❌ Can cause bunching on complex geometry
❌ Slower than other methods
❌ May smooth out fine details
```

### 2. Collision Fitting

**Best For:** Loose armor (capes, robes, cloth)

```
Algorithm:
1. Detect armor-character intersections
2. Move intersecting vertices away from body
3. Apply stiffness constraints
4. Smooth deformation
5. Repeat until no collisions

Parameters:
├─ collisionIterations: 5-20
├─ stiffness: 0.1-1.0 (resistance to deformation)
├─ margin: 0.01-0.1 (collision distance)
└─ smoothingIterations: 5-15

Pros:
✅ Fast processing
✅ Maintains original shape
✅ Good for flowing garments
✅ Natural draping

Cons:
❌ Loose fit (not skin-tight)
❌ May not conform to all curves
❌ Requires manual adjustment
```

### 3. Smooth Fitting

**Best For:** Flexible armor (leather, chainmail)

```
Algorithm:
1. Compute body region bounds
2. Fit armor to region extents
3. Apply smooth deformation
4. Preserve original topology
5. Blend edges smoothly

Parameters:
├─ smoothingIterations: 5-15
├─ preserveDetails: true/false
└─ blendRadius: 0.05-0.15

Pros:
✅ Preserves armor detail excellently
✅ Natural deformation
✅ Fast processing
✅ Good for mixed materials

Cons:
❌ Less precise fit
❌ May not handle extreme shapes
❌ Requires good initial scale
```

---

## Step-by-Step Workflow

### Step 1: Select Character

```
Character Requirements:
├─ Format: GLB with skeleton
├─ Pose: T-pose (arms extended, legs straight)
├─ Rigging: Humanoid skeleton
├─ Quality: Clean mesh topology
└─ Source: Asset Forge generated (recommended)

Loading Character:
1. Click "Select Character"
2. Choose from Asset Library OR
3. Upload GLB file
4. Preview loads in 3D viewer
5. Verify T-pose
```

**Good T-Pose Checklist:**
- ✅ Arms extended 90° from body
- ✅ Palms facing down
- ✅ Legs straight and together
- ✅ Feet flat on ground
- ✅ Head facing forward
- ✅ Spine straight

### Step 2: Select Armor Piece

```
Armor Requirements:
├─ Format: GLB mesh
├─ Scale: Similar to character
├─ Position: Centered at origin
├─ Orientation: Facing forward (+Z)
└─ Type: Helmet, chest, legs, gloves, boots

Loading Armor:
1. Click "Select Armor"
2. Choose from Asset Library OR
3. Upload GLB file
4. Preview overlays on character
5. Check approximate fit
```

**Armor Types and Slots:**

```
Head Slot:
├─ Helmet, Hood, Crown
├─ Attaches to: Head bone
└─ Covers: Head, sometimes neck

Chest Slot:
├─ Breastplate, Robe, Shirt
├─ Attaches to: Spine2 bone
└─ Covers: Torso, arms (optional)

Legs Slot:
├─ Greaves, Pants, Skirt
├─ Attaches to: Hips bone
└─ Covers: Legs, pelvis

Hands Slot:
├─ Gloves, Gauntlets
├─ Attaches to: Hand_L/Hand_R
└─ Covers: Hands, wrists

Feet Slot:
├─ Boots, Shoes, Sandals
├─ Attaches to: Foot_L/Foot_R
└─ Covers: Feet, ankles
```

### Step 3: Choose Fitting Method

Based on armor type:

**Helmet Fitting:**
```
Recommended: Shrinkwrap
Settings:
├─ iterations: 30
├─ stepSize: 0.5
├─ targetOffset: 0.01 (1cm padding)
├─ preserveFeatures: true
└─ smoothingRadius: 0.08

Why: Helmets need tight fit, preserved details
```

**Chest Plate Fitting:**
```
Recommended: Shrinkwrap or Smooth
Settings (Shrinkwrap):
├─ iterations: 25
├─ stepSize: 0.4
├─ targetOffset: 0.02 (2cm padding)
├─ preserveFeatures: true
└─ smoothingRadius: 0.1

Why: Conformsto torso shape while maintaining detail
```

**Robe/Cape Fitting:**
```
Recommended: Collision
Settings:
├─ collisionIterations: 15
├─ stiffness: 0.6
├─ margin: 0.05
└─ smoothingIterations: 10

Why: Maintains flowing appearance
```

**Leather Armor Fitting:**
```
Recommended: Smooth
Settings:
├─ smoothingIterations: 12
├─ preserveDetails: true
└─ blendRadius: 0.08

Why: Flexible fit with detail preservation
```

### Step 4: Configure Parameters

**Shrinkwrap Parameters:**

```typescript
iterations: number (10-50)
├─ 10-20: Light fit, preserves shape
├─ 20-35: Medium fit (recommended)
└─ 35-50: Tight fit, may lose detail

stepSize: number (0.1-1.0)
├─ 0.1-0.3: Gentle, slow convergence
├─ 0.4-0.6: Balanced (recommended)
└─ 0.7-1.0: Aggressive, fast but risky

smoothingRadius: number (0.05-0.2 meters)
├─ 0.05-0.08: Tight smoothing
├─ 0.08-0.12: Medium smoothing (recommended)
└─ 0.12-0.2: Wide smoothing, softer

targetOffset: number (0.0-0.05 meters)
├─ 0.0: Skin-tight (may intersect)
├─ 0.01-0.02: Comfortable fit (recommended)
└─ 0.03-0.05: Loose fit

preserveFeatures: boolean
├─ true: Keeps sharp edges (helmets, plates)
└─ false: Smooth everything (organic shapes)

featureAngleThreshold: number (30-90 degrees)
├─ 30°: Preserve subtle edges
├─ 45°: Preserve moderate edges (recommended)
└─ 60-90°: Only preserve very sharp edges
```

**Visual Guide:**

```
Low iterations (10):        High iterations (40):
  ╱─────╲                      ╱═══╲
 │  ○   │                     │ ● │
  ╲_____╱                      ╲═══╱
 Loose fit                   Tight fit

Small targetOffset (0.01):  Large targetOffset (0.05):
    │═│                          │  ═  │
    │●│                          │  ●  │
    │═│                          │  ═  │
  Snug                          Loose
```

### Step 5: Select Equipment Slot (Optional)

```
Equipment Slot Configuration:
├─ Auto-detect (recommended): Determines slot from armor shape
├─ Head: Helmets, hoods
├─ Chest: Breastplates, robes
├─ Legs: Greaves, pants
├─ Hands: Gloves, gauntlets
└─ Feet: Boots, shoes

Bone Attachment:
Auto-selected based on slot:
├─ Head → Head bone
├─ Chest → Spine2 bone
├─ Legs → Hips bone
├─ Hands → Hand_L / Hand_R
└─ Feet → Foot_L / Foot_R
```

### Step 6: Configure Weight Transfer

**What is Weight Transfer?**
Transfers skeletal weights from character to armor so armor deforms with animations.

**Transfer Methods:**

```
1. Nearest Point (Fast, Simple)
├─ Find closest character vertex
├─ Copy bone weights exactly
├─ Fast: ~1 second
├─ Use: Simple armor, uniform fit
└─ Quality: Good

2. Projected Surface (Balanced)
├─ Project armor vertex onto character surface
├─ Interpolate weights from nearby vertices
├─ Medium speed: ~2-3 seconds
├─ Use: Most armor types (recommended)
└─ Quality: Excellent

3. Inpainted (Highest Quality)
├─ Fill gaps in weight map
├─ Smooth weight transitions
├─ Preserve discontinuities
├─ Slow: ~5-10 seconds
├─ Use: Complex armor, hero assets
└─ Quality: Best
```

**Weight Smoothing:**

```
Enable Weight Smoothing: ☑

Smoothing Iterations: 3 (1-5)
├─ 1-2: Minimal smoothing, preserves sharpness
├─ 3: Balanced (recommended)
└─ 4-5: Heavy smoothing, very smooth deformation

Why Smooth:
├─ Prevents weight discontinuities
├─ Reduces mesh tearing during animation
├─ Creates natural deformation
└─ Blends weight transitions
```

### Step 7: Start Fitting

```
Click "Fit Armor" button

Progress Display:
┌─────────────────────────────────┐
│ Fitting armor to character...   │
│ ████████████████░░░░░░ 67%      │
│                                 │
│ Stage: Shrinkwrap iteration 20  │
│ Vertices processed: 4,823       │
│ Time elapsed: 12s               │
└─────────────────────────────────┘

Processing Stages:
├─ Preparing meshes (5%)
├─ Computing bounds (10%)
├─ Shrinkwrap iterations (10-80%)
├─ Smoothing (80-90%)
├─ Weight transfer (90-98%)
└─ Finalization (98-100%)
```

**Processing Time:**
```
Helmet (5K polys):
├─ Shrinkwrap: 15-30 seconds
├─ Collision: 5-10 seconds
└─ Smooth: 5-15 seconds

Chest Plate (12K polys):
├─ Shrinkwrap: 30-60 seconds
├─ Collision: 10-20 seconds
└─ Smooth: 10-30 seconds

Full Body (25K polys):
├─ Shrinkwrap: 1-2 minutes
├─ Collision: 20-40 seconds
└─ Smooth: 30-90 seconds
```

### Step 8: Review Results

**3D Viewer Inspection:**

```
Visual Checks:
✅ Armor conforms to character shape
✅ No mesh intersections (clipping)
✅ Details preserved (edges, engravings)
✅ Smooth transitions
✅ No bunching or pinching
✅ Symmetric (left/right sides match)

Animation Testing:
1. Load walk/run animation
2. Play animation
3. Verify armor deforms naturally
4. Check for:
   ├─ No tearing
   ├─ No detachment
   ├─ Natural bending
   └─ Smooth transitions
```

**Weight Painting Visualization:**

```
Enable "Show Weights" mode:
├─ Red: 100% weight (full influence)
├─ Yellow: 75% weight
├─ Green: 50% weight
├─ Blue: 25% weight
└─ Black: 0% weight (no influence)

Good Weight Distribution:
├─ Smooth color transitions
├─ Appropriate bone assignments
├─ No black holes (unweighted areas)
└─ Symmetric patterns
```

### Step 9: Adjust if Needed

**Common Adjustments:**

**Too Loose:**
```
Increase:
├─ iterations (30 → 40)
├─ stepSize (0.4 → 0.6)
Decrease:
└─ targetOffset (0.02 → 0.01)
```

**Too Tight (Intersecting):**
```
Decrease:
├─ iterations (40 → 25)
├─ stepSize (0.6 → 0.4)
Increase:
└─ targetOffset (0.01 → 0.03)
```

**Lost Details:**
```
Enable:
├─ preserveFeatures: true
Adjust:
├─ featureAngleThreshold: 45 → 35
Decrease:
└─ smoothingRadius: 0.1 → 0.06
```

**Bunching/Pinching:**
```
Decrease:
├─ iterations (35 → 20)
├─ stepSize (0.5 → 0.3)
Increase:
└─ smoothingRadius: 0.08 → 0.12
```

### Step 10: Export Fitted Armor

**Export Options:**

```
1. Export Fitted Armor Only
   ├─ Contains: Armor mesh with weights
   ├─ Format: GLB
   ├─ Use: Replace armor on same character
   └─ Size: 1-5 MB

2. Export Character + Armor
   ├─ Contains: Character + fitted armor
   ├─ Format: GLB
   ├─ Use: Complete equipped character
   └─ Size: 5-20 MB

3. Export Metadata
   ├─ Contains: Fitting parameters, stats
   ├─ Format: JSON
   ├─ Use: Documentation, re-fitting
   └─ Size: <1 KB
```

**Metadata Example:**

```json
{
  "characterModel": "goblin-warrior",
  "armorModel": "bronze-helmet",
  "fittingMethod": "shrinkwrap",
  "parameters": {
    "iterations": 30,
    "stepSize": 0.5,
    "targetOffset": 0.01,
    "smoothingRadius": 0.08
  },
  "weightTransfer": {
    "method": "projected-surface",
    "smoothingIterations": 3
  },
  "slot": "head",
  "attachBone": "Head",
  "processingTime": 18500,
  "vertexCount": 4823,
  "triangleCount": 9230
}
```

---

## Advanced Features

### Undo/Redo System

```
Keyboard Shortcuts:
├─ Ctrl+Z (Cmd+Z): Undo last fitting
├─ Ctrl+Y (Cmd+Y): Redo
└─ Ctrl+Shift+Z: Redo (alternate)

History:
├─ Stores up to 10 fitting states
├─ Includes parameters and geometry
├─ Fast switching between states
└─ Clears on new armor load
```

### Batch Fitting

Fit multiple armor pieces at once:

```
Batch Fitting Workflow:
1. Select character
2. Add multiple armor pieces:
   ├─ Helmet
   ├─ Chest plate
   ├─ Greaves
   └─ Boots
3. Configure each piece individually
4. Click "Fit All"
5. Process sequentially
6. Export complete set

Benefits:
├─ Consistent character base
├─ Faster than individual fitting
├─ Guaranteed compatibility
└─ Single export file
```

### Preset Configurations

Save and reuse fitting settings:

```
Save Preset:
1. Configure parameters
2. Click "Save Preset"
3. Name preset: "Tight Helmet Fit"
4. Preset saved to library

Load Preset:
1. Click "Load Preset"
2. Select: "Tight Helmet Fit"
3. Parameters apply automatically
4. Adjust if needed

Built-in Presets:
├─ Helmet - Tight Fit
├─ Chest Plate - Medium Fit
├─ Robe - Loose Fit
├─ Leather Armor - Flexible
└─ Chainmail - Detail Preserving
```

---

## Troubleshooting

### "Armor intersects character mesh"

**Cause:** targetOffset too small or iterations too high

**Solutions:**
```
1. Increase targetOffset:
   └─ 0.01 → 0.02 → 0.03 until no clipping

2. Reduce iterations:
   └─ 40 → 30 → 25

3. Try different method:
   └─ Shrinkwrap → Smooth or Collision

4. Manual offset:
   └─ Scale armor slightly larger (1.02x)
```

### "Armor doesn't fit shape"

**Cause:** Too few iterations or wrong method

**Solutions:**
```
1. Increase iterations:
   └─ 20 → 30 → 40

2. Use shrinkwrap method:
   └─ Better conformance than collision/smooth

3. Check character T-pose:
   └─ Poor T-pose affects fitting

4. Verify armor scale:
   └─ Should be similar size to character
```

### "Lost armor details"

**Cause:** Over-smoothing or feature preservation off

**Solutions:**
```
1. Enable preserveFeatures:
   └─ ☑ Preserve sharp edges

2. Reduce smoothingRadius:
   └─ 0.12 → 0.08 → 0.06

3. Lower featureAngleThreshold:
   └─ 60° → 45° → 30°

4. Decrease iterations:
   └─ Use minimum needed for fit
```

### "Bunching/pinching artifacts"

**Cause:** Aggressive stepSize or vertex bunching

**Solutions:**
```
1. Reduce stepSize:
   └─ 0.7 → 0.5 → 0.3

2. Increase smoothingRadius:
   └─ 0.08 → 0.12 → 0.15

3. Use improved shrinkwrap:
   └─ ☑ Use improved algorithm

4. Try smooth method instead:
   └─ Better for complex shapes
```

### "Weight transfer failed"

**Cause:** Character not rigged or complex topology

**Solutions:**
```
1. Verify character has skeleton:
   └─ Check in 3D viewer bone display

2. Try different transfer method:
   └─ Projected Surface → Nearest Point

3. Disable weight smoothing:
   └─ May cause issues on complex meshes

4. Check for non-manifold geometry:
   └─ Fix in Blender before importing
```

---

## Best Practices

### Armor Preparation
✅ Generate armor in T-pose orientation
✅ Center armor at origin before export
✅ Clean topology (no overlapping faces)
✅ Appropriate polycount (5K-15K for real-time)
✅ Clear equipment slot (head, chest, etc.)

### Character Preparation
✅ Perfect T-pose (critical for fitting)
✅ Clean rigging with proper bone names
✅ Moderate polycount (10K-30K)
✅ Good mesh flow topology
✅ No extreme proportions

### Parameter Selection
✅ Start with presets, then fine-tune
✅ Test with low iterations first
✅ Increase iterations gradually
✅ Use targetOffset for padding
✅ Enable feature preservation for hard surfaces

### Quality Assurance
✅ Always test with animations
✅ Check for intersection in multiple poses
✅ Verify weight painting visualization
✅ Test export in target game engine
✅ Save successful parameter combinations

---

## Next Steps

Continue with related workflows:

- **[Equipment System Guide](equipment-system.md)** - Manage equipped armor on characters
- **[Hand Rigging Guide](hand-rigging.md)** - Add weapons to fitted characters
- **[Material Variants Guide](material-variants.md)** - Create armor tier sets
- **[Asset Generation Guide](asset-generation.md)** - Generate more armor pieces

---

[← Back to Index](../README.md) | [Next: Equipment System →](equipment-system.md)
