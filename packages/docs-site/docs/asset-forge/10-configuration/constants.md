# Application Constants

This comprehensive guide covers all constants, configuration values, and preset definitions used throughout Asset Forge. These constants define application behavior, UI styling, API endpoints, equipment rules, and game mechanics.

## Table of Contents

1. [Overview](#overview)
2. [API Constants](#api-constants)
3. [Material Tier Colors](#material-tier-colors)
4. [UI Constants](#ui-constants)
5. [Three.js Environment Presets](#threejs-environment-presets)
6. [Creature Size Categories](#creature-size-categories)
7. [Equipment System](#equipment-system)
8. [Weapon Configuration](#weapon-configuration)
9. [Hand Rigging Constants](#hand-rigging-constants)
10. [Navigation Constants](#navigation-constants)

---

## Overview

Constants in Asset Forge are organized into logical modules under `/src/constants/` and exported through a central index file for easy access throughout the application.

### Constant Organization

```
/src/constants/
├── index.ts           # Central export hub
├── api.ts             # API endpoints and status codes
├── materials.ts       # Material tier colors
├── ui.ts              # UI breakpoints, animations, z-index
├── three.ts           # Three.js environment presets
├── creatures.ts       # Creature size categories
├── equipment.ts       # Equipment slots and weapon types
├── hand-rigging.ts    # MediaPipe landmarks and bone names
└── navigation.ts      # Navigation view identifiers
```

### Import Pattern

All constants are re-exported from the central index:

```typescript
import {
  API_ENDPOINTS,
  TIER_COLORS,
  BREAKPOINTS,
  EQUIPMENT_SLOTS,
  MIN_WEAPON_SIZES
} from '@/constants'
```

### Type Safety

Constants use TypeScript's `as const` assertion for literal type inference:

```typescript
export const QUALITY_LEVELS = {
  standard: 'standard',
  high: 'high',
  ultra: 'ultra'
} as const

// Type: { readonly standard: 'standard', readonly high: 'high', readonly ultra: 'ultra' }
```

---

## API Constants

API constants define endpoints, status codes, and pagination settings for client-server communication.

### API Endpoints

**File**: `/src/constants/api.ts`

```typescript
export const API_ENDPOINTS = {
  // Assets
  ASSETS: '/api/assets',
  ASSET_BY_ID: (id: string) => `/api/assets/${id}`,
  ASSET_MODEL: (id: string) => `/api/assets/${id}/model`,
  ASSET_FILE: (id: string, filename: string) => `/api/assets/${id}/${filename}`,
  ASSET_SPRITES: (id: string) => `/api/assets/${id}/sprites`,

  // Generation
  GENERATION: '/api/generation',
  GENERATION_STATUS: '/api/generation/status',

  // Materials
  MATERIAL_PRESETS: '/api/material-presets',

  // Equipment
  EQUIPMENT_CONFIG: '/api/equipment/config',
} as const
```

**Usage Examples**:

```typescript
// Static endpoint
const response = await fetch(API_ENDPOINTS.ASSETS)

// Dynamic endpoint with parameter
const assetUrl = API_ENDPOINTS.ASSET_BY_ID('asset-123')
// Result: '/api/assets/asset-123'

// File path builder
const modelUrl = API_ENDPOINTS.ASSET_FILE('asset-123', 'model.glb')
// Result: '/api/assets/asset-123/model.glb'
```

**Endpoint Categories**:

1. **Assets** - CRUD operations for 3D assets
2. **Generation** - Asset creation pipeline
3. **Materials** - Material preset management
4. **Equipment** - Equipment configuration retrieval

### API Status Codes

```typescript
export const API_STATUS = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const
```

**Usage**:

```typescript
if (response.status === API_STATUS.SUCCESS) {
  // Handle successful response
}

if (response.status === API_STATUS.NOT_FOUND) {
  throw new Error('Asset not found')
}
```

**Standard HTTP Status Codes**:
- `200 SUCCESS` - Request completed successfully
- `201 CREATED` - Resource created successfully
- `400 BAD_REQUEST` - Invalid request parameters
- `401 UNAUTHORIZED` - Missing or invalid authentication
- `404 NOT_FOUND` - Resource does not exist
- `500 SERVER_ERROR` - Internal server error

### Pagination

```typescript
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const
```

**Usage**:

```typescript
const pageSize = Math.min(
  requestedPageSize || PAGINATION.DEFAULT_PAGE_SIZE,
  PAGINATION.MAX_PAGE_SIZE
)
```

**Design Decisions**:
- Default 20 items balances UX and performance
- Max 100 items prevents excessive data transfer
- Applies to asset listings and search results

---

## Material Tier Colors

Material tier colors provide consistent theming for different material types throughout the UI.

### Primary Tier Colors

**File**: `/src/constants/materials.ts`

```typescript
export const TIER_COLORS: Record<string, string> = {
  // Metals
  bronze: '#CD7F32',
  iron: '#434B4D',
  steel: '#71797E',
  mithril: '#26619C',
  adamant: '#2D5016',
  rune: '#00FFFF',

  // Woods
  wood: '#8B4513',
  oak: '#654321',
  willow: '#7C4E3E',

  // Leathers
  leather: '#8B4513',
  'hard-leather': '#654321',
  'studded-leather': '#434B4D',
} as const
```

**Color Palette**:

| Material | Hex Color | RGB | Visual |
|----------|-----------|-----|--------|
| Bronze | #CD7F32 | 205, 127, 50 | Copper-brown |
| Iron | #434B4D | 67, 75, 77 | Dark gray |
| Steel | #71797E | 113, 121, 126 | Silver-gray |
| Mithril | #26619C | 38, 97, 156 | Blue-gray |
| Adamant | #2D5016 | 45, 80, 22 | Dark green |
| Rune | #00FFFF | 0, 255, 255 | Cyan |
| Wood | #8B4513 | 139, 69, 19 | Medium brown |
| Oak | #654321 | 101, 67, 33 | Dark brown |
| Willow | #7C4E3E | 124, 78, 62 | Reddish brown |
| Leather | #8B4513 | 139, 69, 19 | Brown |

### Display Colors

Lighter variants for overlays and badges:

```typescript
export const TIER_DISPLAY_COLORS: Record<string, string> = {
  // Metals
  bronze: '#CD7F32',
  iron: '#B0B0B0',
  steel: '#C0C0C0',
  mithril: '#3D5D8F',
  adamant: '#2F4F2F',
  rune: '#4682B4',

  // Woods
  wood: '#DEB887',
  oak: '#BC9A6A',
  willow: '#F5DEB3',

  // Leathers
  leather: '#8B4513',
  'hard-leather': '#654321',
  'studded-leather': '#4A4A4A',

  // Special
  dragon: '#fa0000'
} as const
```

**Usage Contexts**:
- **TIER_COLORS** - Asset cards, badges, icons
- **TIER_DISPLAY_COLORS** - Backgrounds, overlays, hover states

### Helper Function

```typescript
export const getTierColor = (tier?: string): string => {
  if (!tier) return 'var(--color-primary)'
  return TIER_COLORS[tier] || 'var(--color-primary)'
}
```

**Usage**:

```typescript
const color = getTierColor('bronze')  // '#CD7F32'
const fallback = getTierColor()       // 'var(--color-primary)'
const unknown = getTierColor('mythril')  // 'var(--color-primary)' (fallback)
```

---

## UI Constants

UI constants define responsive breakpoints, animation timings, z-index layers, spacing, and layout widths.

**File**: `/src/constants/ui.ts`

### Breakpoints

Responsive design breakpoints matching Tailwind CSS:

```typescript
export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const
```

**Screen Sizes**:
- `xs` (480px) - Extra small phones
- `sm` (640px) - Small phones/large phones portrait
- `md` (768px) - Tablets portrait
- `lg` (1024px) - Tablets landscape/small laptops
- `xl` (1280px) - Laptops/desktops
- `2xl` (1536px) - Large desktops

**Usage**:

```typescript
const isMobile = window.innerWidth < BREAKPOINTS.md
const isTablet = window.innerWidth >= BREAKPOINTS.md && window.innerWidth < BREAKPOINTS.lg
const isDesktop = window.innerWidth >= BREAKPOINTS.lg
```

### Animation Durations

Animation timing constants in milliseconds:

```typescript
export const ANIMATION_DURATION = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  verySlow: 1000,
} as const
```

**Timing Guide**:
- `instant` (0ms) - No animation, immediate state change
- `fast` (150ms) - Quick transitions, hovers, tooltips
- `normal` (300ms) - Standard UI transitions
- `slow` (500ms) - Page transitions, modal animations
- `verySlow` (1000ms) - Loading states, splash screens

**Usage**:

```css
transition: `opacity ${ANIMATION_DURATION.normal}ms ease-in-out`

setTimeout(() => {
  // Do something
}, ANIMATION_DURATION.slow)
```

### Z-Index Layers

Consistent layering for overlapping UI elements:

```typescript
export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  notification: 80,
  critical: 90,
} as const
```

**Layer Hierarchy** (lowest to highest):

1. `base` (0) - Default content layer
2. `dropdown` (10) - Dropdown menus
3. `sticky` (20) - Sticky headers/footers
4. `fixed` (30) - Fixed position elements
5. `modalBackdrop` (40) - Modal background overlay
6. `modal` (50) - Modal dialogs
7. `popover` (60) - Popovers and context menus
8. `tooltip` (70) - Tooltips
9. `notification` (80) - Toast notifications
10. `critical` (90) - Critical alerts, loading overlays

**Usage**:

```typescript
const modalStyle = {
  zIndex: Z_INDEX.modal,
  position: 'fixed'
}

const tooltipStyle = {
  zIndex: Z_INDEX.tooltip,
  position: 'absolute'
}
```

### Spacing

Common spacing values matching Tailwind CSS spacing scale:

```typescript
export const SPACING = {
  xs: '0.5rem',   // 8px
  sm: '1rem',     // 16px
  md: '1.5rem',   // 24px
  lg: '2rem',     // 32px
  xl: '3rem',     // 48px
  '2xl': '4rem',  // 64px
} as const
```

**Spacing Scale**:
- `xs` (8px) - Tight spacing, compact lists
- `sm` (16px) - Default spacing between elements
- `md` (24px) - Section spacing within components
- `lg` (32px) - Component separation
- `xl` (48px) - Major section separation
- `2xl` (64px) - Page-level spacing

**Usage**:

```typescript
const containerStyle = {
  padding: SPACING.md,
  gap: SPACING.sm
}
```

### Max Widths

Content width constraints for readability:

```typescript
export const MAX_WIDTH = {
  content: '1200px',
  narrow: '800px',
  wide: '1600px',
} as const
```

**Width Guidelines**:
- `narrow` (800px) - Text-heavy content, forms
- `content` (1200px) - Standard application content
- `wide` (1600px) - Dashboard layouts, data tables

**Usage**:

```typescript
const pageStyle = {
  maxWidth: MAX_WIDTH.content,
  margin: '0 auto'
}
```

---

## Three.js Environment Presets

Environment presets define lighting and background configurations for the 3D viewer.

**File**: `/src/constants/three.ts`

### Environment Configuration

Each preset includes:
- Background color
- Ambient light (overall scene illumination)
- Key light (main directional light)
- Fill light (softens shadows)
- Rim light (edge highlighting)

### Neutral Environment

```typescript
neutral: {
  name: 'Neutral',
  bgColor: '#0a0a0a',
  ambientColor: '#ffffff',
  ambientIntensity: 0.5,
  keyLightColor: '#ffffff',
  keyLightIntensity: 1,
  fillLightColor: '#4080ff',
  fillLightIntensity: 0.5,
  rimLightColor: '#ffffff',
  rimLightIntensity: 0.3
}
```

**Characteristics**:
- Dark background for contrast
- Balanced white lighting
- Blue fill light for depth
- Subtle rim lighting
- Best for general viewing

### Studio Environment

```typescript
studio: {
  name: 'Studio',
  bgColor: '#1a1a1a',
  ambientColor: '#ffffff',
  ambientIntensity: 0.7,
  keyLightColor: '#fffaf0',
  keyLightIntensity: 1.2,
  fillLightColor: '#e0f0ff',
  fillLightIntensity: 0.6,
  rimLightColor: '#ffffff',
  rimLightIntensity: 0.5
}
```

**Characteristics**:
- Lighter background
- Higher ambient lighting
- Warm key light (floral white)
- Cool blue fill light
- Strong rim lighting for definition
- Best for product showcase

### Sunset Environment

```typescript
sunset: {
  name: 'Sunset',
  bgColor: '#1a0f0a',
  ambientColor: '#ff9060',
  ambientIntensity: 0.6,
  keyLightColor: '#ffb366',
  keyLightIntensity: 1.1,
  fillLightColor: '#4060a0',
  fillLightIntensity: 0.4,
  rimLightColor: '#ff6b35',
  rimLightIntensity: 0.4
}
```

**Characteristics**:
- Dark warm background
- Orange ambient light
- Warm orange key light
- Cool purple-blue fill
- Orange rim light
- Best for dramatic presentation

### Cool Environment

```typescript
cool: {
  name: 'Cool',
  bgColor: '#0a0f1a',
  ambientColor: '#8090ff',
  ambientIntensity: 0.5,
  keyLightColor: '#b0c0ff',
  keyLightIntensity: 1,
  fillLightColor: '#6080ff',
  fillLightIntensity: 0.5,
  rimLightColor: '#a0b0ff',
  rimLightIntensity: 0.3
}
```

**Characteristics**:
- Dark blue background
- Blue ambient light
- Light blue key light
- Medium blue fill
- Light blue rim
- Best for sci-fi/magical themes

### Usage

```typescript
import { ENVIRONMENTS } from '@/constants'

// Select environment
const env = ENVIRONMENTS.studio

// Apply to Three.js scene
scene.background = new THREE.Color(env.bgColor)
const ambientLight = new THREE.AmbientLight(env.ambientColor, env.ambientIntensity)
const keyLight = new THREE.DirectionalLight(env.keyLightColor, env.keyLightIntensity)
```

---

## Creature Size Categories

Creature size categories define scaling rules for weapons and equipment based on creature height.

**File**: `/src/constants/creatures.ts`

### Size Category Definitions

```typescript
export const CREATURE_SIZE_CATEGORIES = {
  tiny: {
    name: 'Tiny',
    minHeight: 0,
    maxHeight: 0.6,
    scaleFactor: 0.5,
  },
  small: {
    name: 'Small',
    minHeight: 0.6,
    maxHeight: 1.2,
    scaleFactor: 0.75,
  },
  medium: {
    name: 'Medium',
    minHeight: 1.2,
    maxHeight: 2.4,
    scaleFactor: 1.0,
  },
  large: {
    name: 'Large',
    minHeight: 2.4,
    maxHeight: 4.0,
    scaleFactor: 1.5,
  },
  huge: {
    name: 'Huge',
    minHeight: 4.0,
    maxHeight: 6.0,
    scaleFactor: 2.0,
  },
  gargantuan: {
    name: 'Gargantuan',
    minHeight: 6.0,
    maxHeight: Infinity,
    scaleFactor: 3.0,
  },
} as const
```

### Size Category Details

| Category | Height Range | Scale Factor | Examples |
|----------|--------------|--------------|----------|
| Tiny | 0m - 0.6m | 0.5× | Fairy, Pixie |
| Small | 0.6m - 1.2m | 0.75× | Gnome, Halfling |
| Medium | 1.2m - 2.4m | 1.0× | Human, Elf, Dwarf |
| Large | 2.4m - 4.0m | 1.5× | Troll, Ogre |
| Huge | 4.0m - 6.0m | 2.0× | Giant, Drake |
| Gargantuan | 6.0m+ | 3.0× | Dragon, Titan |

**Scale Factor Application**:

Weapons are scaled based on creature size:

```typescript
const weaponScale = creatureHeight * baseProportion * scaleFactor
```

### Creature Presets

Pre-defined creatures for quick testing:

```typescript
export const CREATURE_PRESETS = [
  { name: 'Fairy', height: 0.3, category: 'tiny' as const },
  { name: 'Gnome', height: 0.9, category: 'small' as const },
  { name: 'Human', height: 1.83, category: 'medium' as const },
  { name: 'Troll', height: 3.0, category: 'large' as const },
  { name: 'Giant', height: 5.0, category: 'huge' as const },
  { name: 'Dragon', height: 8.0, category: 'gargantuan' as const }
] as const
```

**Usage**:

```typescript
const human = CREATURE_PRESETS.find(p => p.name === 'Human')
console.log(human?.height)  // 1.83 meters
console.log(human?.category)  // 'medium'
```

### Helper Function

```typescript
export function getCreatureCategory(height: number): keyof typeof CREATURE_SIZE_CATEGORIES {
  for (const [category, bounds] of Object.entries(CREATURE_SIZE_CATEGORIES)) {
    if (height >= bounds.minHeight && height < bounds.maxHeight) {
      return category as keyof typeof CREATURE_SIZE_CATEGORIES
    }
  }
  return 'medium' // Default fallback
}
```

**Usage**:

```typescript
const category = getCreatureCategory(1.83)  // 'medium'
const scaleFactor = CREATURE_SIZE_CATEGORIES[category].scaleFactor  // 1.0
```

---

## Equipment System

Equipment constants define attachment points, equipment types, and slot configurations.

**File**: `/src/constants/equipment.ts`

### Equipment Slots

```typescript
export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  {
    id: 'Hand_R',
    name: 'Right Hand',
    icon: Sword,
    bone: 'Hand_R',
    description: 'Weapons, tools, and held items'
  },
  {
    id: 'Hand_L',
    name: 'Left Hand',
    icon: Shield,
    bone: 'Hand_L',
    description: 'Shields and off-hand items'
  },
  {
    id: 'Head',
    name: 'Head',
    icon: HardHat,
    bone: 'Head',
    description: 'Helmets and headgear'
  },
  {
    id: 'Spine2',
    name: 'Chest',
    icon: Shirt,
    bone: 'Spine2',
    description: 'Body armor and clothing'
  },
  {
    id: 'Hips',
    name: 'Legs',
    icon: Box,
    bone: 'Hips',
    description: 'Leg armor and pants'
  },
] as const
```

**Slot Structure**:
- `id` - Unique identifier matching bone name
- `name` - Display name for UI
- `icon` - Lucide icon component
- `bone` - Skeleton bone for attachment
- `description` - Tooltip text

### Equipment Types

```typescript
export const EQUIPMENT_TYPES = {
  weapon: 'weapon',
  armor: 'armor',
  shield: 'shield',
} as const
```

**Type Categories**:
- `weapon` - Offensive equipment (swords, axes, bows)
- `armor` - Defensive equipment (chest, head, legs)
- `shield` - Off-hand defensive item

### Weapon Subtypes

```typescript
export const WEAPON_SUBTYPES = {
  sword: 'sword',
  axe: 'axe',
  mace: 'mace',
  spear: 'spear',
  bow: 'bow',
  staff: 'staff',
  dagger: 'dagger',
  crossbow: 'crossbow',
  shield: 'shield',
  wand: 'wand',
} as const
```

**Weapon Categories**:

| Subtype | Grip Type | Hand Requirement |
|---------|-----------|------------------|
| Sword | One-handed | Right hand |
| Axe | One/Two-handed | Right hand |
| Mace | One-handed | Right hand |
| Spear | Two-handed | Right hand |
| Bow | Two-handed | Right hand |
| Staff | Two-handed | Right hand |
| Dagger | One-handed | Right hand |
| Crossbow | Two-handed | Right hand |
| Shield | One-handed | Left hand |
| Wand | One-handed | Right hand |

---

## Weapon Configuration

Weapon size constraints and proportions ensure balanced, realistic equipment scaling.

### Minimum Weapon Sizes

Minimum sizes in meters to maintain visibility and usability:

```typescript
export const MIN_WEAPON_SIZES: Record<string, number> = {
  sword: 0.5,
  dagger: 0.15,
  axe: 0.3,
  mace: 0.3,
  staff: 0.8,
  spear: 1.0,
  bow: 0.5,
  crossbow: 0.4,
  shield: 0.3,
  wand: 0.1,
} as const
```

**Rationale**:
- Prevents weapons from becoming invisible on small creatures
- Ensures weapons remain recognizable
- Maintains game aesthetics

### Maximum Weapon Sizes

Maximum sizes in meters for game balance:

```typescript
export const MAX_WEAPON_SIZES: Record<string, number> = {
  sword: 3.0,
  dagger: 0.8,
  axe: 2.5,
  mace: 2.0,
  staff: 5.0,
  spear: 7.0,
  bow: 3.0,
  crossbow: 2.0,
  shield: 3.0,
  wand: 1.0,
} as const
```

**Rationale**:
- Prevents oversized weapons on large creatures
- Maintains proportional aesthetics
- Balances visual impact

### Base Weapon Proportions

Percentage of creature height for medium-sized (human) creatures:

```typescript
export const BASE_WEAPON_PROPORTIONS: Record<string, number> = {
  sword: 0.65,      // 65% of height
  dagger: 0.25,     // 25% of height
  axe: 0.5,         // 50% of height
  mace: 0.45,       // 45% of height
  staff: 1.1,       // 110% of height
  spear: 1.2,       // 120% of height
  bow: 0.7,         // 70% of height
  crossbow: 0.5,    // 50% of height
  shield: 0.4,      // 40% of height
  wand: 0.2,        // 20% of height
} as const
```

**Proportion Examples** (1.83m human):

| Weapon | Proportion | Size |
|--------|------------|------|
| Sword | 65% | 1.19m |
| Dagger | 25% | 0.46m |
| Axe | 50% | 0.92m |
| Staff | 110% | 2.01m |
| Spear | 120% | 2.20m |

**Scaling Formula**:

```typescript
const baseProportion = BASE_WEAPON_PROPORTIONS[weaponType.toLowerCase()] || 0.5
const weaponSize = creatureHeight * baseProportion * scaleFactor

// Apply constraints
const finalSize = Math.max(
  MIN_WEAPON_SIZES[weaponType],
  Math.min(MAX_WEAPON_SIZES[weaponType], weaponSize)
)
```

---

## Hand Rigging Constants

Hand rigging constants define MediaPipe hand landmark indices and bone naming conventions for finger animation.

**File**: `/src/constants/hand-rigging.ts`

### MediaPipe Hand Landmarks

MediaPipe provides 21 hand landmarks (0-20):

```typescript
export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20
} as const
```

**Landmark Anatomy**:
- `WRIST` - Hand base
- `CMC` - Carpometacarpal joint (thumb base)
- `MCP` - Metacarpophalangeal joint (knuckle)
- `PIP` - Proximal interphalangeal joint (first finger joint)
- `DIP` - Distal interphalangeal joint (second finger joint)
- `TIP` - Fingertip

### Hand Bone Names

Bone naming follows industry-standard skeleton conventions:

```typescript
export const HAND_BONE_NAMES = {
  left: {
    wrist: 'Hand_L',
    palm: 'Palm_L',
    thumb: ['Thumb_01_L', 'Thumb_02_L', 'Thumb_03_L'],
    index: ['Index_01_L', 'Index_02_L', 'Index_03_L'],
    middle: ['Middle_01_L', 'Middle_02_L', 'Middle_03_L'],
    ring: ['Ring_01_L', 'Ring_02_L', 'Ring_03_L'],
    pinky: ['Pinky_01_L', 'Pinky_02_L', 'Pinky_03_L']
  },
  right: {
    wrist: 'Hand_R',
    palm: 'Palm_R',
    thumb: ['Thumb_01_R', 'Thumb_02_R', 'Thumb_03_R'],
    index: ['Index_01_R', 'Index_02_R', 'Index_03_R'],
    middle: ['Middle_01_R', 'Middle_02_R', 'Middle_03_R'],
    ring: ['Ring_01_R', 'Ring_02_R', 'Ring_03_R'],
    pinky: ['Pinky_01_R', 'Pinky_02_R', 'Pinky_03_R']
  }
} as const
```

**Bone Hierarchy**:
```text
Hand_R (wrist)
└── Palm_R
    ├── Thumb_01_R → Thumb_02_R → Thumb_03_R
    ├── Index_01_R → Index_02_R → Index_03_R
    ├── Middle_01_R → Middle_02_R → Middle_03_R
    ├── Ring_01_R → Ring_02_R → Ring_03_R
    └── Pinky_01_R → Pinky_02_R → Pinky_03_R
```

### Finger Joint Indices

Maps finger names to landmark indices:

```typescript
export const FINGER_JOINTS = {
  thumb: [HAND_LANDMARKS.THUMB_CMC, HAND_LANDMARKS.THUMB_MCP, HAND_LANDMARKS.THUMB_IP, HAND_LANDMARKS.THUMB_TIP],
  index: [HAND_LANDMARKS.INDEX_MCP, HAND_LANDMARKS.INDEX_PIP, HAND_LANDMARKS.INDEX_DIP, HAND_LANDMARKS.INDEX_TIP],
  middle: [HAND_LANDMARKS.MIDDLE_MCP, HAND_LANDMARKS.MIDDLE_PIP, HAND_LANDMARKS.MIDDLE_DIP, HAND_LANDMARKS.MIDDLE_TIP],
  ring: [HAND_LANDMARKS.RING_MCP, HAND_LANDMARKS.RING_PIP, HAND_LANDMARKS.RING_DIP, HAND_LANDMARKS.RING_TIP],
  pinky: [HAND_LANDMARKS.PINKY_MCP, HAND_LANDMARKS.PINKY_PIP, HAND_LANDMARKS.PINKY_DIP, HAND_LANDMARKS.PINKY_TIP]
} as const
```

**Usage**:

```typescript
// Get thumb joint positions
const thumbJoints = FINGER_JOINTS.thumb.map(idx => handLandmarks[idx])

// Create bones for index finger
const indexBones = HAND_BONE_NAMES.right.index
// ['Index_01_R', 'Index_02_R', 'Index_03_R']
```

---

## Navigation Constants

Navigation constants define view identifiers and app styling.

**File**: `/src/constants/navigation.ts`

### Navigation Views

```typescript
export const NAVIGATION_VIEWS = {
  ASSETS: 'assets',
  GENERATION: 'generation',
  EQUIPMENT: 'equipment',
  HAND_RIGGING: 'handRigging',
  ARMOR_FITTING: 'armorFitting'
} as const satisfies Record<string, NavigationView>
```

**View Descriptions**:
- `ASSETS` - Asset library and management
- `GENERATION` - AI asset generation pipeline
- `EQUIPMENT` - Equipment viewer and testing
- `HAND_RIGGING` - Hand rigging for weapons
- `ARMOR_FITTING` - Armor fitting to avatars

**Usage**:

```typescript
import { NAVIGATION_VIEWS } from '@/constants'

function navigateTo(view: NavigationView) {
  setCurrentView(view)
}

navigateTo(NAVIGATION_VIEWS.GENERATION)
```

### App Background Styles

Grid background configuration:

```typescript
export const APP_BACKGROUND_STYLES = {
  gridSize: '50px 50px',
  gridImage: `linear-gradient(to right, var(--color-primary) 1px, transparent 1px),
               linear-gradient(to bottom, var(--color-primary) 1px, transparent 1px)`
} as const
```

**Grid Specifications**:
- 50px × 50px grid cells
- Uses CSS custom property `--color-primary`
- 1px grid lines
- Transparent cell backgrounds

**CSS Usage**:

```css
.app-background {
  background-size: 50px 50px;
  background-image:
    linear-gradient(to right, var(--color-primary) 1px, transparent 1px),
    linear-gradient(to bottom, var(--color-primary) 1px, transparent 1px);
}
```

---

## Summary

Application constants provide centralized configuration for:

1. **API Communication** - Endpoints, status codes, pagination
2. **Material System** - Tier colors and display variants
3. **User Interface** - Responsive breakpoints, animations, z-index
4. **3D Rendering** - Environment presets and lighting
5. **Game Mechanics** - Creature sizes and scaling factors
6. **Equipment System** - Slots, types, and attachment points
7. **Weapon Balancing** - Size constraints and proportions
8. **Hand Rigging** - MediaPipe landmarks and bone hierarchy
9. **Navigation** - View identifiers and app styling

**Best Practices**:

1. **Import from index** - Use central export hub
2. **Use const assertions** - Maintain type safety
3. **Document magic numbers** - Explain proportions and thresholds
4. **Provide helper functions** - Abstract complex logic
5. **Maintain consistency** - Follow established patterns
6. **Type exports** - Export derived types for type safety

**Quick Import Reference**:

```typescript
import {
  // API
  API_ENDPOINTS,
  API_STATUS,
  PAGINATION,

  // Materials
  TIER_COLORS,
  getTierColor,

  // UI
  BREAKPOINTS,
  ANIMATION_DURATION,
  Z_INDEX,
  SPACING,
  MAX_WIDTH,

  // Three.js
  ENVIRONMENTS,

  // Creatures
  CREATURE_SIZE_CATEGORIES,
  CREATURE_PRESETS,
  getCreatureCategory,

  // Equipment
  EQUIPMENT_SLOTS,
  EQUIPMENT_TYPES,
  WEAPON_SUBTYPES,
  MIN_WEAPON_SIZES,
  MAX_WEAPON_SIZES,
  BASE_WEAPON_PROPORTIONS,

  // Hand Rigging
  HAND_LANDMARKS,
  HAND_BONE_NAMES,
  FINGER_JOINTS,

  // Navigation
  NAVIGATION_VIEWS,
  APP_BACKGROUND_STYLES
} from '@/constants'
```
