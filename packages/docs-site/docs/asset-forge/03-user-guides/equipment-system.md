# Equipment System Guide

[← Back to Index](../README.md)

---

## Overview

The Equipment System manages the attachment, positioning, and configuration of items on character models. It handles weapons, armor, shields, and accessories across multiple equipment slots with automatic bone attachment and transform management.

**What You'll Learn:**
- Equipment slot system (Head, Chest, Hands, Legs, Feet)
- Bone attachment point configuration
- Loading avatars and equipment items
- Grip offset and rotation configuration
- Animation support and testing
- Creature size scaling and constraints
- Weapon proportion adjustments
- Multi-item management
- Export options for equipped characters
- Common equipment scenarios

**Use Cases**: Character customization, loadout systems, equipment testing, animation preview

---

## Equipment Slot System

### Available Slots

Asset Forge provides 5 main equipment slots mapped to standard humanoid bones:

```typescript
Equipment Slots:
├─ Head (helmet, hood, crown)
│  └─ Bone: Head
├─ Chest (armor, robe, shirt)
│  └─ Bone: Spine2
├─ Hands (gloves, gauntlets, held items)
│  ├─ Left: Hand_L
│  └─ Right: Hand_R
├─ Legs (greaves, pants)
│  └─ Bone: Hips
└─ Feet (boots, shoes)
   ├─ Left: Foot_L
   └─ Right: Foot_R
```

**Slot Details:**

```
┌──────────┬────────────┬────────────────────────┬─────────────┐
│ Slot     │ Bone       │ Supported Items        │ Multi-item  │
├──────────┼────────────┼────────────────────────┼─────────────┤
│ Head     │ Head       │ Helmets, hoods, crowns │ Single      │
│ Chest    │ Spine2     │ Armor, robes, capes    │ Single      │
│ Hand_R   │ Hand_R     │ Weapons, tools, items  │ Single      │
│ Hand_L   │ Hand_L     │ Shields, off-hand      │ Single      │
│ Legs     │ Hips       │ Leg armor, pants       │ Single      │
│ Feet_L   │ Foot_L     │ Left boot              │ Single      │
│ Feet_R   │ Foot_R     │ Right boot             │ Single      │
└──────────┴────────────┴────────────────────────┴─────────────┘
```

### Bone Name Variants

The system supports multiple bone naming conventions:

```
Head Bone:
├─ Head (preferred)
├─ head
├─ mixamorig:Head
└─ Bip01_Head

Hand Bones:
├─ Hand_R, Hand_L (preferred)
├─ RightHand, LeftHand
├─ mixamorig:RightHand, mixamorig:LeftHand
└─ Bip01_R_Hand, Bip01_L_Hand

Spine Bone:
├─ Spine2 (preferred)
├─ Spine1 (fallback)
├─ mixamorig:Spine2
└─ Bip01_Spine2

Hip Bone:
├─ Hips (preferred)
├─ mixamorig:Hips
└─ Bip01_Pelvis

Foot Bones:
├─ Foot_L, Foot_R (preferred)
├─ LeftFoot, RightFoot
├─ mixamorig:LeftFoot, mixamorig:RightFoot
└─ Bip01_L_Foot, Bip01_R_Foot
```

**Auto-Detection:**
The system automatically searches for bones using common naming patterns and selects the first match.

---

## Loading Characters and Equipment

### Step 1: Load Avatar

```
Character Requirements:
├─ Format: GLB with rigged skeleton
├─ Skeleton: Humanoid bones (Head, Spine, Hands, etc.)
├─ Animations: Optional (walk, run, idle)
├─ Height: Any (system handles scaling)
└─ Source: Asset Forge or external

Loading Process:
1. Navigate to Equipment System
2. Click "Load Character"
3. Select from Asset Library OR upload GLB
4. Character loads in 3D viewer
5. Skeleton auto-detected
6. Available slots highlighted
```

**Skeleton Verification:**

```
After loading, check:
✅ "Skeleton detected: 24 bones"
✅ Available slots: 5 (all equipped)
✅ Character height: 1.83m

If issues:
❌ "No skeleton found" → Character not rigged
❌ "Missing bone: Hand_R" → Non-standard naming
❌ "Partial skeleton" → Some slots unavailable
```

### Step 2: Load Equipment Items

**Method 1: From Asset Library**

```
1. Click slot (e.g., "Right Hand")
2. Opens asset selector
3. Filter by type: "weapon"
4. Select item: "bronze-longsword"
5. Click "Equip"
6. Item appears in character's hand
```

**Method 2: Upload File**

```
1. Click slot
2. Click "Upload Item"
3. Select GLB file
4. Item loads and auto-positions
5. Adjust if needed
```

**Method 3: Quick Equip**

```
From Asset Library grid view:
1. Right-click asset
2. Select "Equip on Character"
3. Choose slot (auto-suggested)
4. Item equips immediately
```

### Step 3: Configure Item Transform

Each equipped item has configurable transforms:

```typescript
Transform Configuration:
├─ Position: (x, y, z) offset from bone
├─ Rotation: (x, y, z) euler angles
├─ Scale: (x, y, z) or uniform
└─ Attachment: Bone name

Example - Sword in Right Hand:
{
  position: { x: 0, y: 0, z: 0 },      // Grip at palm
  rotation: { x: 0, y: 0, z: 90 },     // Blade pointing up
  scale: { x: 1, y: 1, z: 1 },         // Original size
  bone: "Hand_R"
}

Example - Shield in Left Hand:
{
  position: { x: 0, y: 0.1, z: -0.05 }, // Forward of hand
  rotation: { x: 0, y: 0, z: 0 },       // Flat orientation
  scale: { x: 1, y: 1, z: 1 },
  bone: "Hand_L"
}
```

**Transform Controls:**

```
UI Controls:
├─ Position sliders: -1.0 to 1.0 meters
├─ Rotation sliders: -180° to 180°
├─ Scale sliders: 0.1x to 5.0x
├─ Reset button: Return to defaults
└─ Preset button: Load saved positions

Keyboard Shortcuts:
├─ G: Grab/move mode
├─ R: Rotate mode
├─ S: Scale mode
├─ X/Y/Z: Constrain to axis
└─ Enter: Confirm transform
```

---

## Grip Offset Configuration

### Understanding Grip Offset

The grip offset determines where the item attaches relative to the bone position:

```
Weapon Grip Offset:
     Blade (tip)
        │
        │
    ────┼────  ← Crossguard
        │
        │ ← Grip/Handle
        ●      ← Grip center (offset point)
        │
     Pommel

Bone Position (Hand_R):
        ◉      ← Palm center (0,0,0 in bone space)

Offset Calculation:
offset = grip_center - bone_position
```

### Automatic vs Manual Offset

**Automatic (From Hand Rigging):**

If weapon was processed through hand rigging:
```
Metadata includes grip offset:
{
  "gripOffset": {
    "x": 0.0,
    "y": -0.15,  // 15cm down from palm
    "z": 0.02    // 2cm forward
  },
  "confidence": 0.91
}

Auto-applied on equip:
└─ No manual adjustment needed
```

**Manual Configuration:**

For items without grip data:
```
1. Equip item
2. Note current position
3. Adjust Position sliders:
   ├─ Y: Move up/down handle
   ├─ X: Move left/right
   └─ Z: Move forward/back
4. Fine-tune until grip looks natural
5. Save as preset
```

### Common Grip Positions

**One-Handed Sword:**
```
Position: (0, -0.15, 0.02)
Rotation: (0, 0, 90)
Notes: Grip below palm, blade up
```

**Two-Handed Sword:**
```
Right Hand:
├─ Position: (0, -0.25, 0.02)
└─ Rotation: (0, 0, 90)

Left Hand:
├─ Position: (0, -0.10, 0.02)
└─ Rotation: (0, 0, 90)

Notes: Right hand lower, left hand upper grip
```

**Staff:**
```
Right Hand:
├─ Position: (0, 0.30, 0.02)
└─ Rotation: (0, 0, 90)

Left Hand:
├─ Position: (0, -0.30, 0.02)
└─ Rotation: (0, 0, 90)

Notes: Hands spread apart on shaft
```

**Shield (Arm Strap):**
```
Position: (0, 0.10, -0.15)
Rotation: (0, 0, 0)
Notes: Forward of forearm, flat against arm
```

**Bow:**
```
Left Hand (holding bow):
├─ Position: (0, 0, 0.05)
└─ Rotation: (90, 0, 0)

Right Hand (pulling string):
├─ Position: (0, 0, 0.25)
└─ Rotation: (0, 0, 0)
└─ Note: Requires custom pose
```

---

## Animation Support

### Loading Animations

```
Animation Sources:
├─ Embedded in character GLB
├─ Separate animation files
└─ Asset Forge generated (walk, run)

Loading:
1. Character with animations loads
2. Animation panel shows available clips
3. Select animation: "Walking"
4. Click "Play"
5. Equipment follows character motion
```

**Animation Panel:**

```
┌──────────────────────────────┐
│ Animations:                  │
│ ☐ Idle        [Preview]      │
│ ☑ Walking     [Playing] 2.0s │
│ ☐ Running     [Preview] 1.5s │
│ ☐ Attacking   [Preview] 1.0s │
├──────────────────────────────┤
│ Speed: ▮▮▮▮▮▮░░░░ 1.0x       │
│ Loop: ☑                      │
│ ▶ Play  ⏸ Pause  ⏹ Stop     │
└──────────────────────────────┘
```

### Verifying Equipment During Animation

**What to Check:**

```
During Animation Playback:
✅ Weapon stays in hand (no detachment)
✅ Grip looks natural through motion
✅ No mesh intersections (clipping)
✅ Shield orientation correct
✅ Armor deforms naturally
✅ All items move with character

Common Issues:
❌ Weapon floating → Wrong bone attachment
❌ Detachment → Missing weight transfer
❌ Clipping → Adjust position offset
❌ Rotation wrong → Adjust rotation offset
```

**Animation Testing Checklist:**

```
For Each Equipment Item:
1. Play idle animation
   └─ Verify static positioning

2. Play walk cycle
   └─ Check arm swing doesn't affect items

3. Play run cycle
   └─ Verify at faster motion

4. Play attack animation (if available)
   └─ Weapon should move naturally

5. Check extreme poses
   └─ Crouching, jumping, etc.
```

### Creating Custom Poses

**Method 1: Bone Manipulation (Advanced)**

```
1. Enable "Bone Edit Mode"
2. Select bone (e.g., Hand_R)
3. Rotate using gizmo controls
4. Equipment follows bone
5. Test equipment positioning
6. Save pose as preset
```

**Method 2: Load Pose File**

```
Pose file format (.pose.json):
{
  "bones": {
    "Hand_R": {
      "rotation": { "x": 0, "y": 45, "z": 90 }
    },
    "Hand_L": {
      "rotation": { "x": 0, "y": -45, "z": -90 }
    }
  }
}

Load:
1. Click "Load Pose"
2. Select .pose.json file
3. Character assumes pose
4. Equipment updates automatically
```

---

## Creature Size Scaling

### Size Categories

```
Creature Sizes (based on height):
├─ Tiny: 0.3-0.6m (fairy, sprite)
├─ Small: 0.6-1.2m (gnome, goblin)
├─ Medium: 1.2-2.4m (human, elf)
├─ Large: 2.4-4.0m (troll, ogre)
├─ Huge: 4.0-6.0m (giant)
└─ Gargantuan: 6.0-8.0m (dragon)

Height Presets:
├─ Fairy: 0.3m
├─ Gnome: 0.9m
├─ Dwarf: 1.3m
├─ Human: 1.83m
├─ Elf: 1.9m
├─ Orc: 2.2m
├─ Troll: 3.0m
├─ Giant: 5.0m
└─ Dragon: 8.0m
```

### Weapon Scaling Based on Creature Size

**Automatic Proportion Scaling:**

```typescript
Base Weapon Proportions (for Medium creatures):
├─ Sword: 65% of creature height
├─ Axe: 50% of creature height
├─ Mace: 45% of creature height
├─ Staff: 110% of creature height
├─ Spear: 120% of creature height
├─ Dagger: 25% of creature height
├─ Bow: 70% of creature height
└─ Shield: 40% of creature height

Example:
Human (1.83m height):
├─ Longsword: 1.83 × 0.65 = 1.19m
├─ Battleaxe: 1.83 × 0.50 = 0.92m
└─ Dagger: 1.83 × 0.25 = 0.46m

Giant (5.0m height):
├─ Longsword: 5.0 × 0.65 = 3.25m
├─ Battleaxe: 5.0 × 0.50 = 2.5m
└─ Dagger: 5.0 × 0.25 = 1.25m
```

**Size Scaling Configuration:**

```
Equipment System Settings:
☑ Auto-scale weapons to creature size
☐ Use absolute weapon sizes (no scaling)

Scale Factor: 1.0x (0.5x - 3.0x)
├─ 0.5x: Half size (oversized creature)
├─ 1.0x: Proportional (recommended)
├─ 1.5x: Larger weapons
└─ 2.0x: Exaggerated fantasy style
```

### Weapon Size Constraints

**Minimum and Maximum Sizes:**

```typescript
Size Limits (in meters):
┌──────────┬─────────┬─────────┐
│ Weapon   │ Min     │ Max     │
├──────────┼─────────┼─────────┤
│ Sword    │ 0.5m    │ 3.0m    │
│ Dagger   │ 0.15m   │ 0.8m    │
│ Axe      │ 0.3m    │ 2.5m    │
│ Mace     │ 0.3m    │ 2.0m    │
│ Staff    │ 0.8m    │ 5.0m    │
│ Spear    │ 1.0m    │ 7.0m    │
│ Bow      │ 0.5m    │ 3.0m    │
│ Shield   │ 0.3m    │ 3.0m    │
└──────────┴─────────┴─────────┘

Example:
Fairy (0.3m) wielding sword:
├─ Proportional: 0.3 × 0.65 = 0.195m
├─ Below minimum (0.5m)
├─ Clamped to: 0.5m
└─ Result: Oversized sword for fairy

Dragon (8.0m) wielding sword:
├─ Proportional: 8.0 × 0.65 = 5.2m
├─ Above maximum (3.0m)
├─ Clamped to: 3.0m
└─ Result: Undersized sword for dragon
```

**Override Constraints:**

```
Advanced Settings:
☑ Apply size constraints
☐ Allow any weapon size

If unchecked:
└─ Fairy can have 0.195m sword
└─ Dragon can have 5.2m sword
└─ May look wrong but allows flexibility
```

---

## Multi-Item Management

### Equipping Complete Sets

**Full Equipment Loadout:**

```
Character: "Human Warrior"
├─ Head: bronze-helmet
├─ Chest: bronze-platebody
├─ Legs: bronze-platelegs
├─ Hands_R: bronze-longsword
├─ Hands_L: bronze-shield
├─ Feet_L: bronze-boot (left)
└─ Feet_R: bronze-boot (right)

Total: 7 equipped items
```

**Loadout Manager:**

```
┌──────────────────────────────┐
│ Current Loadout: "Warrior"   │
├──────────────────────────────┤
│ Head     [Bronze Helmet   ]  │
│ Chest    [Bronze Platebody]  │
│ Legs     [Bronze Platelegs]  │
│ Hand_R   [Bronze Longsword]  │
│ Hand_L   [Bronze Shield   ]  │
│ Feet_L   [Bronze Boot     ]  │
│ Feet_R   [Bronze Boot     ]  │
├──────────────────────────────┤
│ [Save Loadout] [Load] [Clear]│
└──────────────────────────────┘
```

### Saved Loadouts

**Creating Loadouts:**

```
1. Equip all desired items
2. Adjust transforms
3. Click "Save Loadout"
4. Name: "Bronze Melee Set"
5. Loadout saved

Loadout JSON:
{
  "name": "Bronze Melee Set",
  "character": "human-warrior",
  "items": {
    "head": {
      "asset": "bronze-helmet",
      "transform": { ... }
    },
    "chest": {
      "asset": "bronze-platebody",
      "transform": { ... }
    }
    // ... more items
  }
}
```

**Loading Loadouts:**

```
1. Click "Load Loadout"
2. Select: "Bronze Melee Set"
3. System loads character
4. Equips all items
5. Applies saved transforms
6. Ready immediately
```

**Loadout Library:**

```
Saved Loadouts:
├─ Bronze Melee Set (7 items)
├─ Steel Ranger Set (5 items)
├─ Mithril Mage Set (4 items)
├─ Dragon Warrior Full (7 items)
└─ Custom Mix 1 (6 items)

Actions:
├─ Load: Apply to current character
├─ Edit: Modify items/transforms
├─ Duplicate: Create variant
├─ Delete: Remove from library
└─ Export: Save as JSON file
```

### Switching Equipment

**Quick Swap:**

```
Replace Single Item:
1. Click equipped slot
2. Select new item
3. Replaces immediately
4. Preserves other items

Example:
├─ Currently equipped: bronze-longsword
├─ Quick swap to: steel-longsword
├─ Transform preserved
└─ Other equipment unchanged
```

**Tier Upgrade:**

```
Upgrade All Items:
1. Current: Bronze Set
2. Click "Upgrade Tier"
3. Select: Steel
4. All bronze items → steel variants
5. Transforms preserved
6. Instant tier upgrade
```

---

## Export Options

### Export Formats

**1. Export Character with Equipment:**

```
Contents:
├─ Character mesh + skeleton
├─ All equipped items
├─ Proper bone parenting
├─ Animations (if present)
└─ Combined into single GLB

Use Cases:
├─ Import into game engine
├─ Render in Blender
├─ Share complete character
└─ Archive equipped state
```

**2. Export Loadout Data:**

```
Contents:
├─ Character reference
├─ Equipment list
├─ Transform data
└─ Metadata

Format: JSON
Use: Recreate loadout later
```

**3. Export Screenshot:**

```
Options:
├─ Resolution: 512x512 to 4096x4096
├─ Transparent background
├─ Specific pose/animation frame
└─ Multiple angles

Use Cases:
├─ Documentation
├─ Game UI portraits
├─ Promotional images
└─ Reference sheets
```

### Using Exported Characters

**Unity:**

```csharp
// Import GLB
GameObject equipped = Resources.Load<GameObject>(
    "Characters/warrior_full_equipment"
);

// Instantiate
GameObject character = Instantiate(equipped);

// Access equipment
Transform sword = character.transform.Find(
    "Armature/Hips/.../Hand_R/bronze-longsword"
);

// Swap equipment at runtime
Destroy(sword.gameObject);
GameObject newSword = Instantiate(steelSword, handBone);
```

**Unreal:**

```
1. Import GLB as Skeletal Mesh
2. Equipment automatically as child components
3. Access via GetChildComponent
4. Swap equipment using AttachToComponent
```

**Three.js:**

```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const loader = new GLTFLoader()
loader.load('warrior_equipped.glb', (gltf) => {
  const character = gltf.scene
  scene.add(character)

  // Find equipped sword
  const sword = character.getObjectByName('bronze-longsword')

  // Swap sword
  character.remove(sword)
  const newSword = await loadWeapon('steel-longsword')
  const handBone = character.getObjectByName('Hand_R')
  handBone.add(newSword)
})
```

---

## Common Equipment Scenarios

### Scenario 1: Dual Wielding

```
Setup:
├─ Right Hand: bronze-longsword
└─ Left Hand: steel-dagger

Configuration:
Right Hand:
├─ Position: (0, -0.15, 0.02)
└─ Rotation: (0, 0, 90)

Left Hand:
├─ Position: (0, -0.10, 0.02)
└─ Rotation: (0, 0, -90) ← Reversed for left hand

Animation:
└─ Both weapons follow hand motion
```

### Scenario 2: Sword and Shield

```
Setup:
├─ Right Hand: bronze-longsword
└─ Left Hand: bronze-shield

Shield Configuration:
├─ Position: (-0.05, 0.10, -0.15)
│  └─ Slightly forward of forearm
├─ Rotation: (0, 20, 0)
│  └─ Angled outward slightly
└─ Scale: (1, 1, 1)

Result:
└─ Sword in attack position
└─ Shield defensive stance
```

### Scenario 3: Two-Handed Weapon

```
Setup:
├─ Right Hand: steel-greatsword (main grip)
└─ Left Hand: steel-greatsword (secondary grip)

Right Hand:
├─ Position: (0, -0.30, 0.02) ← Lower on handle
└─ Rotation: (0, 0, 90)

Left Hand:
├─ Position: (0, -0.10, 0.02) ← Upper on handle
└─ Rotation: (0, 0, 90)

Notes:
└─ Both hands reference same weapon mesh
└─ Use parent/child relationship
└─ Main weapon parented to right hand
└─ Left hand bone positioned on handle
```

### Scenario 4: Bow and Arrow

```
Setup:
├─ Left Hand: willow-longbow
└─ Right Hand: arrow (optional)

Bow Configuration:
├─ Position: (0, 0, 0.05)
├─ Rotation: (90, 0, 0) ← Vertical orientation
└─ Held in left hand

Custom Pose Required:
├─ Left arm extended forward
├─ Right hand at chest (pulling string)
└─ Use pose presets or custom animation
```

### Scenario 5: Spellcaster

```
Setup:
├─ Right Hand: crystal-staff
├─ Left Hand: spell-book
└─ Chest: mage-robe (fitted)

Staff Configuration:
├─ Position: (0, 0.40, 0.02)
├─ Rotation: (0, 0, 90)
└─ Top of staff extends above head

Book Configuration:
├─ Position: (-0.10, 0, -0.05)
├─ Rotation: (30, 0, 0)
└─ Open book angle
```

---

## Best Practices

### Equipment Setup
✅ Load character first, equipment second
✅ Start with right hand, then left
✅ Test each item before adding more
✅ Save working transforms as presets
✅ Use consistent naming (bronze-set-1, etc.)

### Transform Configuration
✅ Make small adjustments (0.01m increments)
✅ Test transforms with animations
✅ Save presets for reuse
✅ Document unusual configurations
✅ Use bone edit mode for complex poses

### Multi-Item Management
✅ Build loadouts incrementally
✅ Test compatibility between items
✅ Export loadouts for backup
✅ Use tier-consistent equipment sets
✅ Organize loadouts by character type

### Performance
✅ Limit total polycount (all items combined)
✅ Use LOD models when available
✅ Test in target game engine
✅ Export only needed items
✅ Optimize texture sizes

---

## Next Steps

Related workflows:

- **[Hand Rigging Guide](hand-rigging.md)** - Auto-rig weapons to hands
- **[Armor Fitting Guide](armor-fitting.md)** - Fit armor to characters
- **[Material Variants Guide](material-variants.md)** - Create equipment tier sets
- **[Asset Generation Guide](asset-generation.md)** - Generate more equipment

---

[← Back to Index](../README.md) | [Next: Sprite Generation →](sprite-generation.md)
