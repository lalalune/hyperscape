# Adding New Asset Types

This guide explains how to extend Asset Forge to support new asset types, from defining the type enum to integrating it throughout the generation pipeline.

## Table of Contents

- [Overview](#overview)
- [Adding AssetType Enum Value](#adding-assettype-enum-value)
- [Creating Asset Type Prompts](#creating-asset-type-prompts)
- [Updating Form UI](#updating-form-ui)
- [Adding Normalization Conventions](#adding-normalization-conventions)
- [Pipeline Configuration](#pipeline-configuration)
- [Material Compatibility](#material-compatibility)
- [Testing New Asset Types](#testing-new-asset-types)
- [Documentation Updates](#documentation-updates)

## Overview

Asset Forge's asset type system is distributed across several layers:

1. **Type Definitions** - TypeScript enums and interfaces
2. **Prompt Configuration** - JSON files defining AI prompts
3. **UI Components** - Form dropdowns and selectors
4. **Normalization** - 3D model conventions and standards
5. **Pipeline** - Generation and processing logic
6. **Material System** - Compatible materials and variants

Adding a new asset type requires updating each layer systematically.

## Adding AssetType Enum Value

### Type Definition Files

Asset types are defined in multiple locations for different purposes.

**1. Primary Type Definition**

Edit `/Users/home/hyperscape-1/packages/asset-forge/src/types/index.ts`:

```typescript
// Add to AssetType union
export type AssetType =
  | 'weapon'
  | 'armor'
  | 'consumable'
  | 'tool'
  | 'decoration'
  | 'character'
  | 'building'
  | 'resource'
  | 'vehicle'    // NEW: Add your type here
  | 'misc'
```

**2. Metadata Type Definition**

Edit `/Users/home/hyperscape-1/packages/asset-forge/src/types/AssetMetadata.ts`:

```typescript
// Update AssetType if different from core definition
export type AssetType =
  | 'weapon'
  | 'armor'
  | 'tool'
  | 'resource'
  | 'ammunition'
  | 'character'
  | 'vehicle'    // NEW: Add here too
  | 'misc'
```

**3. Subtype Definitions**

If your asset type has subtypes, add them:

```typescript
// In src/types/index.ts

// Add new subtype union
export type VehicleType =
  | 'cart'
  | 'boat'
  | 'wagon'
  | 'chariot'

// Update GenerationRequest interface to include new subtype
export interface GenerationRequest {
  id: string
  name: string
  description: string
  type: AssetType
  subtype?:
    | WeaponType
    | ArmorSlot
    | BuildingType
    | ToolType
    | ResourceType
    | ConsumableType
    | VehicleType  // NEW: Add to union
  // ... rest of interface
}
```

### Example: Adding "Vehicle" Asset Type

Complete example of adding a vehicle type:

```typescript
// src/types/index.ts

// 1. Add to main AssetType
export type AssetType =
  | 'weapon'
  | 'armor'
  | 'consumable'
  | 'tool'
  | 'decoration'
  | 'character'
  | 'building'
  | 'resource'
  | 'vehicle'    // NEW
  | 'misc'

// 2. Define subtypes
export type VehicleType =
  | 'cart'
  | 'boat'
  | 'wagon'
  | 'chariot'
  | 'sled'

// 3. Update GenerationRequest
export interface GenerationRequest {
  id: string
  name: string
  description: string
  type: AssetType
  subtype?:
    | WeaponType
    | ArmorSlot
    | BuildingType
    | ToolType
    | ResourceType
    | ConsumableType
    | VehicleType  // NEW
  style?: 'realistic' | 'cartoon' | 'low-poly' | 'stylized'
  metadata?: {
    creatureType?: string
    armorSlot?: string
    weaponType?: string
    buildingType?: string
    vehicleType?: string  // NEW
    materialType?: string
    [key: string]: string | number | boolean | undefined
  }
}
```

## Creating Asset Type Prompts

Asset type prompts guide AI generation for each type.

### Prompt Configuration File

**Location:** `/Users/home/hyperscape-1/packages/asset-forge/public/prompts/asset-type-prompts.json`

**Structure:**

```json
{
  "__comment": "Asset type specific prompts - separated by generation type (avatar/item)",
  "version": "2.0.0",
  "avatar": {
    "default": {
      // Avatar types (characters, creatures)
    },
    "custom": {}
  },
  "item": {
    "default": {
      "weapon": {
        "name": "Weapon",
        "prompt": "",
        "placeholder": "Show the full weapon clearly on a neutral background"
      },
      // ... other types

      "vehicle": {
        "name": "Vehicle",
        "prompt": "",
        "placeholder": "Show the vehicle from an isometric view, ready for use"
      }
    },
    "custom": {}
  }
}
```

### Adding Vehicle Type Prompts

**1. Add to Item Category**

Since vehicles are items (not avatars), add to `item.default`:

```json
{
  "item": {
    "default": {
      "weapon": { /* ... */ },
      "armor": { /* ... */ },
      "tool": { /* ... */ },

      "vehicle": {
        "name": "Vehicle",
        "prompt": "A game-ready vehicle asset. Show the complete vehicle from a 3/4 perspective view. Include all structural details like wheels, axles, seats, and decorative elements. The vehicle should be shown at rest on level ground.",
        "placeholder": "Describe your vehicle: type (cart/boat/wagon), size, materials, design features",
        "subtypes": {
          "cart": {
            "name": "Cart",
            "prompt": "A simple two-wheeled cart. Show clearly from the side with both wheels visible. Include details like wooden planks, metal reinforcements, handles or shafts for pulling."
          },
          "boat": {
            "name": "Boat",
            "prompt": "A watercraft vessel. Show from a 3/4 view displaying hull shape, deck, and any masts or oars. Include details like planking, rigging, rudder."
          },
          "wagon": {
            "name": "Wagon",
            "prompt": "A four-wheeled wagon. Show from isometric view with all four wheels visible. Include cargo bed, driver's seat, wheel spokes, and structural beams."
          },
          "chariot": {
            "name": "Chariot",
            "prompt": "A combat or racing chariot. Show from 3/4 perspective highlighting the lightweight frame, large wheels, and standing platform. Include details like shaft attachments and decorative elements."
          }
        }
      }
    }
  }
}
```

**2. Prompt Structure Guidelines**

Each asset type prompt should include:

- **name**: Display name for UI
- **prompt**: AI generation instructions (what to show, perspective, details)
- **placeholder**: User guidance text for input field
- **subtypes** (optional): Specific prompts for each subtype

**Prompt Writing Best Practices:**

```json
{
  "vehicle": {
    "prompt": "
      // 1. Define what it is
      A game-ready vehicle asset.

      // 2. Specify perspective/view
      Show from an isometric 3/4 view.

      // 3. List key components
      Include wheels, chassis, seats, and decorative elements.

      // 4. State the context
      The vehicle should be shown at rest on level ground.

      // 5. Style guidance (if specific to type)
      Use clean geometry suitable for low-poly game assets.
    "
  }
}
```

### Testing Prompts

**Test with GPT-4:**

```bash
# Use OpenAI Playground or API to test prompts
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{
      "role": "user",
      "content": "Generate a detailed description for: A wooden merchant cart"
    }]
  }'
```

## Updating Form UI

Update UI components to include the new asset type.

### Generation Form Dropdown

**File:** `/Users/home/hyperscape-1/packages/asset-forge/src/components/Generation/GenerationTypeSelector.tsx` or similar form component.

**1. Add to Type Options**

```typescript
// src/components/Generation/AssetTypeSelector.tsx

const ASSET_TYPE_OPTIONS = [
  { value: 'weapon', label: 'Weapon', icon: Sword },
  { value: 'armor', label: 'Armor', icon: Shield },
  { value: 'tool', label: 'Tool', icon: Wrench },
  { value: 'building', label: 'Building', icon: Building },
  { value: 'vehicle', label: 'Vehicle', icon: Car },  // NEW
  { value: 'misc', label: 'Miscellaneous', icon: Package }
] as const

export function AssetTypeSelector({ value, onChange }: Props) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {ASSET_TYPE_OPTIONS.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
```

**2. Add Subtype Selector**

Create conditional rendering for subtypes:

```typescript
// src/components/Generation/AssetSubtypeSelector.tsx

interface SubtypeSelectorProps {
  assetType: AssetType
  value: string
  onChange: (subtype: string) => void
}

const SUBTYPE_OPTIONS: Record<AssetType, Array<{ value: string; label: string }>> = {
  weapon: [
    { value: 'sword', label: 'Sword' },
    { value: 'axe', label: 'Axe' },
    // ...
  ],
  vehicle: [
    { value: 'cart', label: 'Cart' },
    { value: 'boat', label: 'Boat' },
    { value: 'wagon', label: 'Wagon' },
    { value: 'chariot', label: 'Chariot' }
  ],
  // ... other types
}

export function AssetSubtypeSelector({ assetType, value, onChange }: SubtypeSelectorProps) {
  const options = SUBTYPE_OPTIONS[assetType] || []

  if (options.length === 0) {
    return null  // No subtypes for this asset type
  }

  return (
    <div className="form-group">
      <label>Type</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
```

**3. Integrate into Main Form**

```typescript
// src/pages/GenerationPage.tsx

export default function GenerationPage() {
  const assetType = useGenerationStore(state => state.assetType)
  const setAssetType = useGenerationStore(state => state.setAssetType)

  const [subtype, setSubtype] = useState('')

  return (
    <div>
      <AssetTypeSelector
        value={assetType}
        onChange={setAssetType}
      />

      {/* Show subtype selector conditionally */}
      <AssetSubtypeSelector
        assetType={assetType}
        value={subtype}
        onChange={setSubtype}
      />
    </div>
  )
}
```

### Icon Selection

**Add appropriate icons:**

```typescript
import {
  Sword,
  Shield,
  Wrench,
  Building,
  Car,      // NEW: Vehicle icon
  Package
} from 'lucide-react'

const ASSET_TYPE_ICONS: Record<AssetType, LucideIcon> = {
  weapon: Sword,
  armor: Shield,
  tool: Wrench,
  building: Building,
  vehicle: Car,        // NEW
  misc: Package
}
```

## Adding Normalization Conventions

Define how 3D models should be normalized for your asset type.

### Normalization Conventions File

**File:** `/Users/home/hyperscape-1/packages/asset-forge/src/types/NormalizationConventions.ts`

**1. Add Convention Definition**

```typescript
export const ASSET_CONVENTIONS: Record<string, AssetConvention> = {
  // ... existing conventions

  // Vehicles
  vehicle: {
    scale: "Real-world size (1 unit = 1 meter)",
    origin: "Center of ground contact at (0,0,0)",
    orientation: "Forward facing +Z, right side facing +X",
    primaryAxis: "Length along Z axis",
    additionalRules: [
      "Wheels touching ground plane (Y=0)",
      "Symmetric along X axis",
      "All moving parts in rest position",
      "Driver position clearly defined"
    ]
  },

  // Specific subtypes (optional)
  cart: {
    scale: "Real-world size (~2m length)",
    origin: "Center between wheels at ground level",
    orientation: "Pulling direction +Z, wheels parallel to X",
    primaryAxis: "Length along Z axis",
    additionalRules: [
      "Handles at -Z (back)",
      "Cargo area centered above origin"
    ]
  },

  boat: {
    scale: "Real-world size (1 unit = 1 meter)",
    origin: "Center of hull at waterline",
    orientation: "Bow (front) pointing +Z, port side facing +X",
    primaryAxis: "Length along Z axis",
    additionalRules: [
      "Waterline at Y=0",
      "Deck above Y=0",
      "Hull below Y=0",
      "Symmetric along X axis"
    ]
  },

  wagon: {
    scale: "Real-world size (~3m length)",
    origin: "Center point between all four wheels",
    orientation: "Forward travel direction +Z",
    primaryAxis: "Length along Z axis",
    additionalRules: [
      "All four wheels touching Y=0",
      "Driver seat at front (+Z)",
      "Cargo bed behind driver"
    ]
  }
}
```

**2. Convention Structure**

Each convention defines:

- **scale**: Size standard (e.g., "1 unit = 1 meter")
- **origin**: Where (0,0,0) should be positioned
- **orientation**: Which way the asset faces
- **primaryAxis**: Main dimension axis
- **additionalRules**: Type-specific requirements

**3. Getter Function**

The existing `getConvention` function automatically handles new types:

```typescript
export function getConvention(assetType: string, subtype?: string): AssetConvention {
  // Try specific subtype first (e.g., "cart")
  if (subtype && ASSET_CONVENTIONS[subtype]) {
    return ASSET_CONVENTIONS[subtype]
  }

  // Fall back to general type (e.g., "vehicle")
  if (ASSET_CONVENTIONS[assetType]) {
    return ASSET_CONVENTIONS[assetType]
  }

  // Default convention
  return {
    scale: "1 unit = 1 meter",
    origin: "Center at (0,0,0)",
    orientation: "Natural orientation"
  }
}
```

### Implementing Normalization Logic

**Service:** `/Users/home/hyperscape-1/packages/asset-forge/src/services/processing/AssetNormalizationService.ts`

Add type-specific normalization if needed:

```typescript
class AssetNormalizationService {
  normalizeAsset(model: GLTF, assetType: string, subtype?: string): NormalizationResult {
    const convention = getConvention(assetType, subtype)

    // Apply general normalization
    const result = this.applyGeneralNormalization(model, convention)

    // Apply type-specific normalization
    if (assetType === 'vehicle') {
      this.normalizeVehicle(model, subtype)
    }

    return result
  }

  private normalizeVehicle(model: GLTF, subtype?: string): void {
    // Vehicle-specific normalization
    // 1. Ensure wheels touch ground
    const wheels = this.findWheels(model)
    const minY = Math.min(...wheels.map(w => w.position.y))

    // Translate entire model so wheels are at Y=0
    model.scene.position.y -= minY

    // 2. Center on X and Z axes
    const bbox = new THREE.Box3().setFromObject(model.scene)
    const center = bbox.getCenter(new THREE.Vector3())
    model.scene.position.x -= center.x
    model.scene.position.z -= center.z

    // 3. Orient forward along +Z
    this.orientForward(model)
  }

  private findWheels(model: GLTF): THREE.Mesh[] {
    const wheels: THREE.Mesh[] = []

    model.scene.traverse((object) => {
      if (object.name.toLowerCase().includes('wheel')) {
        wheels.push(object as THREE.Mesh)
      }
    })

    return wheels
  }
}
```

## Pipeline Configuration

Configure the generation pipeline for your new asset type.

### Generation Service Configuration

**File:** `/Users/home/hyperscape-1/packages/asset-forge/server/services/GenerationService.mjs`

**1. Add Type-Specific Pipeline Logic**

```javascript
class GenerationService {
  async startPipeline(config) {
    // ... existing pipeline setup

    // Type-specific processing
    if (config.type === 'vehicle') {
      return await this.processVehiclePipeline(config)
    }

    // Default pipeline
    return await this.processDefaultPipeline(config)
  }

  async processVehiclePipeline(config) {
    const pipeline = {
      stages: {
        generation: { status: 'pending', progress: 0 },
        normalization: { status: 'pending', progress: 0 }
        // Vehicles don't need retexturing typically
      }
    }

    // Generate base model
    const baseModel = await this.generateBaseModel(config)

    // Apply vehicle-specific normalization
    const normalized = await this.normalizeVehicle(baseModel, config.subtype)

    return {
      id: pipeline.id,
      status: 'completed',
      results: {
        image3D: { modelUrl: normalized.modelUrl }
      }
    }
  }
}
```

**2. Configure Meshy Parameters**

Different asset types may need different Meshy.ai settings:

```javascript
getMeshyConfig(assetType, subtype) {
  const configs = {
    weapon: {
      artStyle: 'realistic',
      negativePrompt: 'blurry, deformed, multiple objects'
    },
    vehicle: {
      artStyle: 'realistic',
      negativePrompt: 'distorted wheels, floating parts, asymmetric',
      topologyQuality: 'high'  // Vehicles benefit from higher topology
    },
    building: {
      artStyle: 'realistic',
      targetPolycount: 50000  // Buildings can have more polys
    }
  }

  return configs[assetType] || configs.default
}
```

## Material Compatibility

Define which materials can be applied to your asset type.

### Material Presets Configuration

**File:** `/Users/home/hyperscape-1/packages/asset-forge/public/prompts/material-presets.json`

**1. Add Compatible Types**

```json
[
  {
    "id": "bronze",
    "name": "bronze",
    "displayName": "Bronze",
    "category": "metal",
    "tier": 1,
    "color": "#CD7F32",
    "stylePrompt": "made of bronze metal",
    "compatibleTypes": ["weapon", "armor", "tool"]  // Vehicles use wood/leather
  },
  {
    "id": "oak",
    "name": "oak",
    "displayName": "Oak Wood",
    "category": "wood",
    "tier": 1,
    "color": "#8B4513",
    "stylePrompt": "made of sturdy oak wood",
    "compatibleTypes": ["tool", "building", "vehicle"]  // NEW: Add vehicle
  },
  {
    "id": "leather",
    "name": "leather",
    "displayName": "Leather",
    "category": "leather",
    "tier": 1,
    "color": "#654321",
    "stylePrompt": "with leather upholstery and details",
    "compatibleTypes": ["armor", "vehicle"]  // NEW: Add vehicle
  }
]
```

**2. Filter Materials in UI**

```typescript
// src/components/Generation/MaterialVariantsCard.tsx

function MaterialVariantsCard({ assetType }: Props) {
  const allPresets = useMaterialPresets()

  // Filter materials compatible with current asset type
  const compatiblePresets = allPresets.filter(preset => {
    if (!preset.compatibleTypes) return true  // No restriction
    return preset.compatibleTypes.includes(assetType)
  })

  return (
    <div>
      {compatiblePresets.map(preset => (
        <MaterialOption key={preset.id} preset={preset} />
      ))}
    </div>
  )
}
```

### Vehicle-Specific Materials

Create vehicle-specific material categories:

```json
[
  {
    "id": "wooden_cart",
    "name": "wooden_cart",
    "displayName": "Wooden Cart",
    "category": "vehicle",
    "tier": 1,
    "color": "#8B4513",
    "stylePrompt": "a simple wooden cart with iron fittings",
    "compatibleTypes": ["vehicle"],
    "subtypeRestriction": ["cart", "wagon"]
  },
  {
    "id": "naval_vessel",
    "name": "naval_vessel",
    "displayName": "Naval Vessel",
    "category": "vehicle",
    "tier": 2,
    "color": "#2C5F7F",
    "stylePrompt": "a seaworthy boat with treated planks and brass details",
    "compatibleTypes": ["vehicle"],
    "subtypeRestriction": ["boat"]
  }
]
```

## Testing New Asset Types

Systematically test your new asset type.

### Test Checklist

```markdown
## Vehicle Asset Type Testing

### Type Selection
- [ ] "Vehicle" appears in asset type dropdown
- [ ] Selecting "Vehicle" shows subtype options
- [ ] Subtypes include: cart, boat, wagon, chariot
- [ ] Type persists after page refresh (if using state persistence)

### Prompt Generation
- [ ] Vehicle prompt loads from JSON correctly
- [ ] Subtype prompts override base prompt when selected
- [ ] Placeholder text guides user input
- [ ] GPT-4 enhancement works with vehicle prompts

### Generation Pipeline
- [ ] Can generate cart model successfully
- [ ] Can generate boat model successfully
- [ ] Can generate wagon model successfully
- [ ] Can generate chariot model successfully
- [ ] Generated models follow vehicle conventions

### Normalization
- [ ] Vehicles are centered at origin correctly
- [ ] Wheels touch ground plane (Y=0)
- [ ] Forward direction is +Z
- [ ] Scale is approximately correct (1 unit = 1 meter)
- [ ] Bounding box is reasonable

### Materials
- [ ] Only compatible materials show for vehicles
- [ ] Wood materials apply correctly
- [ ] Leather materials apply correctly
- [ ] Metal materials excluded (if appropriate)
- [ ] Material variants generate successfully

### UI/UX
- [ ] Icons display correctly
- [ ] Labels are clear and consistent
- [ ] Form validation works
- [ ] Error messages are helpful
- [ ] Loading states display properly

### Integration
- [ ] Assets appear in asset library
- [ ] Can preview vehicle models
- [ ] Can export vehicle models
- [ ] Metadata is correct
- [ ] Can delete vehicle assets
```

### Testing Script

Create automated tests:

```typescript
// tests/assetTypes/vehicle.test.ts

import { describe, it, expect } from 'vitest'
import { getConvention } from '@/types/NormalizationConventions'
import { AssetService } from '@/services/api/AssetService'

describe('Vehicle Asset Type', () => {
  it('should have normalization conventions', () => {
    const convention = getConvention('vehicle')

    expect(convention).toBeDefined()
    expect(convention.origin).toContain('ground')
    expect(convention.orientation).toContain('+Z')
  })

  it('should have subtype conventions', () => {
    const cartConvention = getConvention('vehicle', 'cart')
    const boatConvention = getConvention('vehicle', 'boat')

    expect(cartConvention).toBeDefined()
    expect(boatConvention).toBeDefined()
    expect(boatConvention.additionalRules).toContain('Waterline at Y=0')
  })

  it('should load vehicle prompts', async () => {
    const prompts = await fetch('/prompts/asset-type-prompts.json')
      .then(r => r.json())

    expect(prompts.item.default.vehicle).toBeDefined()
    expect(prompts.item.default.vehicle.subtypes).toBeDefined()
    expect(prompts.item.default.vehicle.subtypes.cart).toBeDefined()
  })
})
```

## Documentation Updates

Document your new asset type for users and developers.

### User Documentation

**File:** `/Users/home/hyperscape-1/packages/asset-forge/README.md`

```markdown
## Supported Asset Types

### Vehicles

Generate various vehicle types for your game:

**Types:**
- **Cart** - Simple two-wheeled carts for hauling
- **Boat** - Watercraft of various sizes
- **Wagon** - Four-wheeled wagons for transport
- **Chariot** - Combat or racing chariots

**Features:**
- Automatic normalization (wheels at ground level)
- Forward-facing orientation (+Z)
- Compatible with wood and leather materials
- Realistic scale (1 unit = 1 meter)

**Example Generation:**
```
Name: Merchant Cart
Type: Vehicle → Cart
Description: A sturdy wooden cart with two large wheels,
reinforced with iron bands, suitable for transporting goods
```

**Materials:**
Compatible with wood-based materials (Oak, Pine, Mahogany)
and leather upholstery options.
```

### Developer Documentation

**File:** `/Users/home/hyperscape-1/packages/asset-forge/dev-book/03-asset-types/vehicle.md` (create if needed)

```markdown
# Vehicle Asset Type

## Overview
The vehicle asset type supports various ground and water vehicles.

## Type Definitions

```typescript
export type VehicleType = 'cart' | 'boat' | 'wagon' | 'chariot'
```

## Conventions

### Scale
All vehicles use real-world scale (1 unit = 1 meter)

### Origin
- **Ground Vehicles**: Center between wheels at ground level
- **Boats**: Center of hull at waterline

### Orientation
- Forward: +Z
- Right: +X
- Up: +Y

## Normalization

Vehicle normalization ensures:
1. Wheels/hull contact Y=0
2. Centered on X/Z axes
3. Forward facing +Z
4. Symmetric design

## Compatible Materials

Vehicles typically use:
- Wood (oak, pine, mahogany)
- Leather (upholstery)
- Metal (fittings, reinforcements)

## Generation Tips

For best results:
- Specify wheel count and size
- Describe cargo/passenger area
- Mention structural details (beams, planks)
- Include decorative elements
```

### Code Comments

Add inline documentation:

```typescript
/**
 * Vehicle Asset Type
 *
 * Supports ground and water vehicles with automatic normalization.
 * Vehicles are oriented with forward direction along +Z axis and
 * wheels/hull touching the ground plane (Y=0).
 *
 * Subtypes:
 * - cart: Two-wheeled pulling cart
 * - boat: Watercraft (hull at waterline)
 * - wagon: Four-wheeled transport wagon
 * - chariot: Combat/racing chariot
 *
 * @see NormalizationConventions.ts for detailed conventions
 * @see asset-type-prompts.json for AI generation prompts
 */
export type VehicleType = 'cart' | 'boat' | 'wagon' | 'chariot'
```

By following this comprehensive process, you can successfully add new asset types to Asset Forge while maintaining consistency across the entire system. Each new type integrates seamlessly with existing features like material variants, normalization, and the generation pipeline.
