# System Overview

## Table of Contents
- [Introduction](#introduction)
- [Architecture Diagram](#architecture-diagram)
- [Layer Responsibilities](#layer-responsibilities)
- [Component Interactions](#component-interactions)
- [Data Flow Overview](#data-flow-overview)
- [Technology Choices](#technology-choices)
- [Design Patterns](#design-patterns)
- [Scalability Approach](#scalability-approach)
- [Security Model](#security-model)

---

## Introduction

Asset Forge is an **AI-powered 3D asset generation system** designed to create game-ready assets for RPG games like Hyperscape. It combines multiple AI services (OpenAI GPT-4, DALL-E, Meshy AI) with sophisticated 3D processing capabilities to generate, texture, rig, and fit 3D models.

### System Goals
1. **Automated 3D Asset Creation**: Generate complete 3D assets from text descriptions
2. **Material Variant Generation**: Create multiple texture variants from base models
3. **Advanced Rigging**: Automatic hand rigging and armor fitting capabilities
4. **Browser-Based Workflow**: Complete pipeline accessible through web interface
5. **Real-Time Preview**: Interactive 3D viewport with Three.js rendering

### Architecture Philosophy
The system follows a **layered monolithic architecture** with clear separation between:
- **Presentation Layer**: React UI components + Three.js 3D rendering
- **State Management Layer**: Zustand stores with middleware
- **Service Layer**: Frontend services for 3D processing + Backend API services
- **Integration Layer**: AI service integrations (OpenAI, Meshy)
- **Persistence Layer**: File system-based asset storage

---

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Client)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              PRESENTATION LAYER (React)                     │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  Pages (5):                                                 │    │
│  │  • GenerationPage    • AssetsPage    • EquipmentPage       │    │
│  │  • HandRiggingPage   • ArmorFittingPage                     │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  Components (77):                                           │    │
│  │  • Generation/ (21)  • Assets/ (15)  • Equipment/ (8)      │    │
│  │  • HandRigging/ (12) • ArmorFitting/ (9) • shared/ (12)    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              ↕                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │           STATE MANAGEMENT (Zustand + Middleware)           │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  Stores (5):                                                │    │
│  │  • useGenerationStore    • useAssetsStore                   │    │
│  │  • useHandRiggingStore   • useArmorFittingStore             │    │
│  │  • useDebuggerStore                                         │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  Middleware: immer, persist, devtools, subscribeWithSelector│    │
│  └────────────────────────────────────────────────────────────┘    │
│                              ↕                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │            FRONTEND SERVICE LAYER (13 Services)             │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  API Services (2):                                          │    │
│  │  • AssetService      • PromptService                        │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  Hand Rigging Services (4):                                 │    │
│  │  • HandRiggingService        • SimpleHandRiggingService     │    │
│  │  • HandPoseDetectionService  • HandSegmentationService      │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  Fitting Services (3):                                      │    │
│  │  • ArmorFittingService  • MeshFittingService               │    │
│  │  • WeightTransferService                                    │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  Processing Services (3):                                   │    │
│  │  • AssetNormalizationService                               │    │
│  │  • CreatureScalingService                                   │    │
│  │  • SpriteGenerationService                                  │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  3D Rendering: Three.js + @react-three/fiber + drei        │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              ↕                                        │
│                         HTTP/REST API                                 │
└─────────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────────┐
│                      NODE.JS SERVER (Backend)                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              BACKEND API LAYER (Express)                    │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  Routes: /api/*                                             │    │
│  │  • /health           • /assets/*        • /material-presets │    │
│  │  • /retexture        • /regenerate-base                     │    │
│  │  • /generation/pipeline/*                                   │    │
│  │  • /weapon-handle-detect  • /weapon-orientation-detect      │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  Middleware Stack:                                          │    │
│  │  • CORS              • Body Parser (25MB limit)             │    │
│  │  • Security Headers  • Error Handler                        │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              ↕                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │           BACKEND SERVICE LAYER (5 Services)                │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  • AssetService           - File system asset management    │    │
│  │  • GenerationService      - Pipeline orchestration          │    │
│  │  • AICreationService      - AI service coordination         │    │
│  │  • RetextureService       - Material variant generation     │    │
│  │  • ImageHostingService    - Public image hosting            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              ↕                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │            AI INTEGRATION LAYER (External APIs)             │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  • OpenAI API (GPT-4, DALL-E)                              │    │
│  │    - Prompt enhancement                                     │    │
│  │    - Concept art generation                                 │    │
│  │    - Weapon handle detection                                │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  • Meshy AI API                                             │    │
│  │    - Image-to-3D conversion                                 │    │
│  │    - Retexturing (material variants)                        │    │
│  │    - Auto-rigging (skeleton + animations)                   │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  • TensorFlow.js (Client-side ML)                          │    │
│  │    - Hand pose detection                                    │    │
│  │    - Hand segmentation                                      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              ↕                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              PERSISTENCE LAYER (File System)                │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  gdd-assets/                                                │    │
│  │  ├── {asset-id}/                                            │    │
│  │  │   ├── {asset-id}.glb           (3D model)               │    │
│  │  │   ├── {asset-id}_rigged.glb    (rigged model)           │    │
│  │  │   ├── metadata.json             (asset metadata)         │    │
│  │  │   ├── concept-art.png           (reference image)        │    │
│  │  │   ├── sprite-metadata.json      (sprite config)          │    │
│  │  │   ├── animations/                (animation files)       │    │
│  │  │   │   ├── walking.glb                                    │    │
│  │  │   │   └── running.glb                                    │    │
│  │  │   └── sprites/                   (sprite sheets)         │    │
│  │  │       └── {angle}deg.png                                 │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### 1. Presentation Layer (React Components)

**Responsibility**: User interface rendering and user interaction handling.

**Key Responsibilities**:
- Render UI elements and 3D viewports
- Handle user input (clicks, forms, file uploads)
- Display real-time generation progress
- Show 3D models with Three.js
- Provide visual feedback and notifications

**Structure**:
```text
src/
├── pages/                    # Top-level page components (5 pages)
│   ├── GenerationPage.tsx   # Asset generation interface
│   ├── AssetsPage.tsx        # Asset library browser
│   ├── EquipmentPage.tsx     # Equipment management
│   ├── HandRiggingPage.tsx   # Hand rigging tool
│   └── ArmorFittingPage.tsx  # Armor fitting tool
└── components/               # Reusable UI components (77 total)
    ├── Generation/           # Generation workflow components (21)
    ├── Assets/               # Asset viewing components (15)
    ├── Equipment/            # Equipment components (8)
    ├── HandRigging/          # Hand rigging UI (12)
    ├── ArmorFitting/         # Armor fitting UI (9)
    └── shared/               # Shared components (12)
```

**Technologies**:
- React 19.2.0 (UI framework)
- Three.js 0.178.0 (3D rendering)
- @react-three/fiber 9.0.0 (React-Three.js bridge)
- @react-three/drei 10.7.6 (Three.js helpers)
- TailwindCSS (styling)
- Lucide React (icons)

---

### 2. State Management Layer (Zustand Stores)

**Responsibility**: Centralized application state with persistence and middleware.

**Key Responsibilities**:
- Manage application state across components
- Persist user preferences to localStorage
- Enable time-travel debugging
- Provide immutable state updates
- Expose selectors for derived state

**Store Architecture**:

```typescript
// Store Structure
interface Store {
  // State
  data: StateData

  // Actions (mutators)
  setData: (data: StateData) => void
  updateData: (updates: Partial<StateData>) => void

  // Complex actions
  performOperation: () => Promise<void>

  // Selectors (computed values)
  getComputedValue: () => DerivedValue
}
```

**5 Stores**:
1. **useGenerationStore** (608 LOC) - Generation pipeline state
2. **useAssetsStore** (245 LOC) - Asset library state
3. **useHandRiggingStore** (298 LOC) - Hand rigging state
4. **useArmorFittingStore** (936 LOC) - Armor fitting state
5. **useDebuggerStore** (574 LOC) - Mesh fitting debugger state

**Middleware Stack**:
```typescript
create<Store>()(
  devtools(              // Redux DevTools integration
    persist(             // localStorage persistence
      subscribeWithSelector( // Granular subscriptions
        immer((set, get) => ({ // Immutable updates
          // Store implementation
        }))
      ),
      { name: 'store-name', partialize: (state) => ({ /* ... */ }) }
    ),
    { name: 'StoreName' }
  )
)
```

**Benefits**:
- **Immer**: Write mutable-looking code that's immutable
- **Persist**: Automatic localStorage sync
- **DevTools**: Time-travel debugging
- **SubscribeWithSelector**: Performance optimization

---

### 3. Frontend Service Layer (13 Services)

**Responsibility**: Business logic and 3D processing operations.

**API Services (2)**:
```typescript
// AssetService - Asset API communication
class AssetService {
  async fetchAssets(): Promise<Asset[]>
  async deleteAsset(id: string, includeVariants: boolean): Promise<void>
  async updateAssetMetadata(id: string, updates: Partial<Asset>): Promise<Asset>
  async saveSprites(assetId: string, sprites: Sprite[], config: SpriteConfig): Promise<void>
}

// PromptService - Prompt management
class PromptService {
  async loadMaterialPresets(): Promise<MaterialPreset[]>
  async saveMaterialPresets(presets: MaterialPreset[]): Promise<void>
  async getPromptTemplates(): Promise<PromptTemplates>
}
```

**Hand Rigging Services (4)**:
```typescript
// HandRiggingService - Advanced hand rigging with AI pose detection
// SimpleHandRiggingService - Simple palm + finger bones
// HandPoseDetectionService - TensorFlow.js hand detection
// HandSegmentationService - Hand mesh segmentation
```

**Fitting Services (3)**:
```typescript
// ArmorFittingService - High-level armor fitting coordination
// MeshFittingService - Shrinkwrap algorithm implementation
// WeightTransferService - Vertex weight transfer from skeleton
```

**Processing Services (3)**:
```typescript
// AssetNormalizationService - Scale/position normalization
// CreatureScalingService - Creature-specific scaling
// SpriteGenerationService - 2D sprite rendering from 3D
```

---

### 4. Backend API Layer (Express Server)

**Responsibility**: HTTP API endpoints and request handling.

**Server Structure**:
```javascript
// server/api.mjs
const app = express()

// Middleware
app.use(cors())
app.use(express.json({ limit: '25mb' }))
app.use(errorHandler)

// Routes (25+ endpoints)
app.get('/api/health')                          // Health check
app.get('/api/assets')                          // List assets
app.get('/api/assets/:id/model')                // Get model file
app.delete('/api/assets/:id')                   // Delete asset
app.patch('/api/assets/:id')                    // Update metadata
app.post('/api/assets/:id/sprites')             // Save sprites

app.get('/api/material-presets')                // Get material presets
app.post('/api/material-presets')               // Save material presets

app.post('/api/retexture')                      // Create material variant
app.post('/api/regenerate-base/:baseAssetId')   // Regenerate base model

app.post('/api/generation/pipeline')            // Start generation
app.get('/api/generation/pipeline/:pipelineId') // Get pipeline status

app.post('/api/weapon-handle-detect')           // AI grip detection
app.post('/api/weapon-orientation-detect')      // AI orientation check
```

**Security Middleware**:
```javascript
// CORS configuration
res.header('Access-Control-Allow-Origin', origin)
res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')

// Security headers (OWASP)
res.header('X-Content-Type-Options', 'nosniff')
res.header('X-Frame-Options', 'DENY')
res.header('X-XSS-Protection', '1; mode=block')
```

---

### 5. Backend Service Layer (5 Services)

**Responsibility**: Backend business logic and AI orchestration.

**Service Architecture**:

```javascript
// 1. AssetService - File system operations
class AssetService {
  constructor(assetsDir) {
    this.assetsDir = assetsDir
  }

  async listAssets() {
    // Scan filesystem for asset metadata
  }

  async deleteAsset(id, includeVariants) {
    // Delete asset directory + variants
  }

  async updateAsset(id, updates) {
    // Update metadata.json
  }
}

// 2. GenerationService - Pipeline orchestration
class GenerationService extends EventEmitter {
  async startPipeline(config) {
    // Create pipeline
    // Start async processing
    return { pipelineId, status }
  }

  async processPipeline(pipelineId) {
    // Stage 1: GPT-4 prompt enhancement
    // Stage 2: Image generation (DALL-E)
    // Stage 3: Image-to-3D (Meshy)
    // Stage 4: Material variants (retexture)
    // Stage 5: Auto-rigging (optional)
    // Stage 6: Sprite generation (optional)
  }
}

// 3. AICreationService - AI service coordination
class AICreationService {
  constructor(config) {
    this.imageService = new ImageService(config.openai)
    this.meshyService = new MeshyService(config.meshy)
  }
}

// 4. RetextureService - Material variant generation
class RetextureService {
  async retexture({ baseAssetId, materialPreset, outputName }) {
    // Load base model metadata
    // Start Meshy retexture task
    // Poll for completion
    // Save variant
  }
}

// 5. ImageHostingService - Public image hosting
class ImageHostingService {
  async uploadImage(imageDataOrUrl) {
    // Upload to public host (ImgBB, Imgur, etc.)
    // Return public URL for Meshy API
  }
}
```

---

### 6. AI Integration Layer (External APIs)

**Responsibility**: Integration with third-party AI services.

**OpenAI Integration**:
```javascript
// GPT-4 for prompt enhancement
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })
})

// DALL-E for concept art
const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  body: JSON.stringify({
    model: 'gpt-image-1',
    prompt: enhancedPrompt,
    size: '1024x1024'
  })
})
```

**Meshy AI Integration**:
```javascript
// Image-to-3D conversion
const taskId = await meshyService.startImageTo3D(imageUrl, {
  enable_pbr: true,
  ai_model: 'meshy-5',
  topology: 'quad',
  targetPolycount: 12000,
  texture_resolution: 2048
})

// Retexturing for material variants
const retextureTaskId = await meshyService.startRetextureTask(
  { inputTaskId: baseTaskId },
  { textStylePrompt: 'bronze metal with patina' },
  { artStyle: 'realistic', aiModel: 'meshy-5' }
)

// Auto-rigging for avatars
const riggingTaskId = await meshyService.startRiggingTask(
  { inputTaskId: baseTaskId },
  { heightMeters: 1.7 }
)
```

**TensorFlow.js Integration (Client-side)**:
```typescript
// Hand pose detection
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection'

const detector = await handPoseDetection.createDetector(
  handPoseDetection.SupportedModels.MediaPipeHands,
  {
    runtime: 'tfjs',
    maxHands: 2
  }
)

const hands = await detector.estimateHands(canvas)
```

---

### 7. Persistence Layer (File System)

**Responsibility**: Asset storage and metadata management.

**Directory Structure**:
```text
gdd-assets/
├── arrows-base/                    # Base model
│   ├── arrows-base.glb            # 3D model
│   ├── metadata.json               # Asset metadata
│   ├── concept-art.png             # Reference image
│   └── sprite-metadata.json        # Sprite configuration
│
├── arrows-bronze/                  # Material variant
│   ├── arrows-bronze.glb          # Textured model
│   ├── metadata.json               # Variant metadata
│   └── concept-art.png             # Copied from base
│
├── character-001/                  # Rigged character
│   ├── character-001.glb          # Unrigged base model
│   ├── character-001_rigged.glb   # Rigged model
│   ├── t-pose.glb                  # Extracted T-pose
│   ├── metadata.json               # Character metadata
│   ├── concept-art.png             # Reference
│   └── animations/                 # Animation files
│       ├── walking.glb
│       └── running.glb
│
└── helmet-001/                     # Helmet asset
    ├── helmet-001.glb
    ├── metadata.json
    ├── concept-art.png
    └── sprites/                    # Generated sprites
        ├── 0deg.png
        ├── 45deg.png
        ├── 90deg.png
        └── ...
```

**Metadata Schema**:
```json
{
  "name": "arrows-base",
  "gameId": "arrows-base",
  "type": "weapon",
  "subtype": "arrows",
  "description": "Bronze-tipped arrows",
  "detailedPrompt": "Enhanced prompt...",
  "generatedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:05:00.000Z",

  "isBaseModel": true,
  "isVariant": false,
  "materialVariants": ["bronze", "steel", "mithril"],
  "variants": ["arrows-bronze", "arrows-steel"],
  "variantCount": 2,

  "hasModel": true,
  "hasConceptArt": true,
  "modelPath": "arrows-base.glb",
  "conceptArtUrl": "./concept-art.png",

  "isRigged": false,
  "riggingStatus": "not-applicable",

  "workflow": "GPT-4 → GPT-Image-1 → Meshy Image-to-3D",
  "meshyTaskId": "task-123",
  "meshyStatus": "completed",

  "gddCompliant": true,
  "isPlaceholder": false,
  "normalized": true,
  "dimensions": { "width": 0.05, "height": 0.8, "depth": 0.05 }
}
```

---

## Component Interactions

### Generation Pipeline Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      GENERATION WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────┘

1. USER INPUT
   GenerationPage
   ├── GenerationForm (user fills out)
   │   ├── assetName: "Bronze Sword"
   │   ├── assetType: "weapon"
   │   ├── description: "A sturdy bronze sword..."
   │   ├── selectedMaterials: ["bronze", "steel", "mithril"]
   │   └── enableRetexturing: true
   └── [Generate Button] clicked

2. STATE UPDATE
   useGenerationStore.setIsGenerating(true)
   useGenerationStore.initializePipelineStages()

3. API CALL
   POST /api/generation/pipeline
   {
     "name": "bronze-sword",
     "type": "weapon",
     "subtype": "sword",
     "description": "A sturdy bronze sword...",
     "materialPresets": [...],
     "enableRetexturing": true,
     "useGPT4Enhancement": true,
     "quality": "high"
   }

4. BACKEND PROCESSING
   GenerationService.startPipeline(config)
   ├── Stage 1: GPT-4 Enhancement
   │   └── "A sturdy bronze sword..." → Enhanced prompt
   ├── Stage 2: DALL-E Image Generation
   │   └── Enhanced prompt → concept-art.png
   ├── Stage 3: Meshy Image-to-3D
   │   └── concept-art.png → bronze-sword-base.glb
   ├── Stage 4: Material Variants (Retexture)
   │   ├── bronze-sword-base → bronze-sword-bronze.glb
   │   ├── bronze-sword-base → bronze-sword-steel.glb
   │   └── bronze-sword-base → bronze-sword-mithril.glb
   └── Returns: { pipelineId, status: "processing" }

5. PROGRESS POLLING
   setInterval(() => {
     GET /api/generation/pipeline/:pipelineId
     ← { status, progress, stages, results }

     useGenerationStore.updatePipelineStage(stageId, status)
   }, 2000)

6. COMPLETION
   Pipeline status: "completed"
   ├── useGenerationStore.setIsGenerating(false)
   ├── useGenerationStore.addGeneratedAsset(asset)
   └── navigateToAsset(assetId)

7. ASSET VIEWING
   AssetsPage
   └── AssetViewer
       └── ModelViewer (Three.js)
           └── Renders bronze-sword-base.glb
```

### Hand Rigging Workflow

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     HAND RIGGING WORKFLOW                            │
└─────────────────────────────────────────────────────────────────────┘

1. ASSET SELECTION
   HandRiggingPage
   └── AssetSelector (filter: type='character')
       └── User selects avatar asset

2. SERVICE INITIALIZATION
   useEffect(() => {
     if (useSimpleMode) {
       service = new SimpleHandRiggingService()
     } else {
       service = new HandRiggingService()
       await service.initializeDetector() // Load TensorFlow models
     }
     setServiceInitialized(true)
   }, [useSimpleMode])

3. START RIGGING
   [Start Rigging] button clicked
   ├── useHandRiggingStore.setProcessingStage('detecting-wrists')
   └── await service.rigHandsForModel(gltf)

4. RIGGING STAGES (Advanced Mode)
   HandRiggingService.rigHandsForModel(gltf)
   ├── Stage 1: Detect Wrist Bones
   │   └── Find Left_Wrist and Right_Wrist in skeleton
   ├── Stage 2: AI Hand Pose Detection
   │   ├── Render hand meshes to canvas
   │   ├── TensorFlow detects hand landmarks (21 points)
   │   └── Calculate bone positions from landmarks
   ├── Stage 3: Create Hand Bones
   │   ├── Palm bone
   │   ├── Thumb (3 bones)
   │   ├── Index finger (3 bones)
   │   ├── Middle finger (3 bones)
   │   ├── Ring finger (3 bones)
   │   └── Pinky finger (3 bones)
   └── Stage 4: Apply Vertex Weights
       └── WeightTransferService.assignWeights()

5. VISUALIZATION
   HandRiggingViewer (Three.js)
   ├── Show original model
   ├── Show rigged model with skeleton
   └── Toggle skeleton helper (showSkeleton state)

6. EXPORT
   [Export Rigged Model] button
   └── HandRiggingService.exportRiggedModel()
       └── Downloads {asset-name}_rigged.glb
```

### Armor Fitting Workflow

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    ARMOR FITTING WORKFLOW                            │
└─────────────────────────────────────────────────────────────────────┘

1. DUAL SELECTION
   ArmorFittingPage
   ├── AssetSelector (assetTypeFilter: 'avatar')
   │   └── User selects avatar
   └── AssetSelector (assetTypeFilter: 'armor')
       └── User selects armor

2. LOAD MODELS
   ArmorFittingViewer
   ├── Load avatar GLB → avatarGltf
   ├── Load armor GLB → armorGltf
   └── Position both in scene

3. CONFIGURE FITTING
   ArmorFittingControls
   ├── fittingConfig.method: 'shrinkwrap'
   ├── fittingConfig.iterations: 8
   ├── fittingConfig.stepSize: 0.15
   ├── fittingConfig.targetOffset: 0.05
   └── enableWeightTransfer: true

4. PERFORM FITTING
   [Fit Armor] button clicked
   └── ArmorFittingService.performFitting()
       ├── Stage 1: Initial Positioning
       │   └── Center armor on avatar
       ├── Stage 2: Shrinkwrap Algorithm
       │   ├── For each vertex in armor:
       │   │   ├── Cast ray toward avatar
       │   │   ├── Find collision point
       │   │   ├── Move vertex toward collision
       │   │   └── Apply smoothing
       │   └── Repeat for N iterations
       ├── Stage 3: Collision Detection
       │   └── Detect penetrations/gaps
       └── Stage 4: Weight Transfer (optional)
           └── Transfer bone weights from avatar to armor

5. BIND TO SKELETON
   [Bind to Skeleton] button
   └── ArmorFittingService.bindArmorToSkeleton()
       └── Armor becomes SkinnedMesh with avatar's skeleton

6. ANIMATION TEST
   AnimationControls
   ├── currentAnimation: 'walking'
   ├── isAnimationPlaying: true
   └── Armor deforms with skeleton

7. EXPORT
   [Export Fitted Armor] button
   └── Downloads fitted_armor_{timestamp}.glb
```

---

## Data Flow Overview

### Unidirectional Data Flow

Asset Forge follows a **unidirectional data flow** pattern:

```text
USER ACTION → STATE UPDATE → VIEW RE-RENDER
     ↓              ↓              ↓
  Events      Zustand Store    React
```

### State Flow Diagram

```text
┌──────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                 │
└──────────────────────────────────────────────────────────────────┘

1. USER INTERACTION
   User clicks button / submits form / uploads file
   ↓

2. EVENT HANDLER (React Component)
   onClick={() => handleGenerateAsset()}
   ↓

3. STORE ACTION (Zustand)
   useGenerationStore.getState().setIsGenerating(true)
   ↓

4. SERVICE CALL (Frontend/Backend)
   await GenerationService.startPipeline(config)
   ↓

5. API REQUEST (HTTP)
   POST /api/generation/pipeline
   ↓

6. BACKEND PROCESSING
   GenerationService processes pipeline
   ↓

7. STORE UPDATE (Zustand)
   useGenerationStore.getState().addGeneratedAsset(asset)
   ↓

8. COMPONENT RE-RENDER (React)
   Component subscribes to store → receives new state → re-renders
   ↓

9. VIEW UPDATE
   User sees updated UI with new asset
```

### State Subscription Pattern

Components subscribe to specific state slices for optimal performance:

```typescript
// Bad: Re-renders on any store change
const state = useGenerationStore()

// Good: Re-renders only when isGenerating changes
const isGenerating = useGenerationStore(state => state.isGenerating)

// Best: Re-renders only when computed value changes
const canGenerate = useGenerationStore(state =>
  !!state.assetName && !!state.description && !state.isGenerating
)
```

### Store Communication

Stores are **independent** but can read from each other:

```typescript
// ArmorFittingStore reading from AssetsStore
const performFitting = async () => {
  const { selectedAsset: avatar } = useAssetsStore.getState()
  const { selectedArmor } = get()

  if (!avatar || !selectedArmor) {
    throw new Error('Missing selections')
  }

  // Perform fitting...
}
```

---

## Technology Choices

### Frontend Stack

| Technology | Version | Purpose | Rationale |
|-----------|---------|---------|-----------|
| **React** | 19.2.0 | UI Framework | Industry standard, component reusability, hooks API |
| **Three.js** | 0.178.0 | 3D Rendering | Most mature WebGL library, extensive community |
| **@react-three/fiber** | 9.0.0 | React-Three Bridge | Declarative Three.js in React, better integration |
| **@react-three/drei** | 10.7.6 | Three.js Helpers | Pre-built components (OrbitControls, etc.) |
| **Zustand** | 5.0.6 | State Management | Lightweight, simple API, middleware support |
| **TailwindCSS** | 3.3.6 | Styling | Utility-first, rapid development, small bundle |
| **TensorFlow.js** | 4.22.0 | Client ML | Hand pose detection without server |
| **Vite** | 6.0.0 | Build Tool | Fast dev server, optimized builds, ESM support |

### Backend Stack

| Technology | Version | Purpose | Rationale |
|-----------|---------|---------|-----------|
| **Node.js** | 18.0.0+ | Runtime | JavaScript full-stack, async I/O |
| **Express** | 4.18.2 | Web Framework | Simple, flexible, middleware-based |
| **dotenv** | 16.3.1 | Config | Environment variable management |
| **node-fetch** | 3.3.2 | HTTP Client | Fetch API for Node.js |
| **CORS** | 2.8.5 | Security | Cross-origin request handling |

### AI Services

| Service | Purpose | Pricing Model |
|---------|---------|---------------|
| **OpenAI GPT-4** | Prompt enhancement | Pay-per-token |
| **OpenAI DALL-E** | Concept art generation | Pay-per-image |
| **Meshy AI** | Image-to-3D, retexturing, rigging | Credit-based |
| **TensorFlow.js** | Hand pose detection | Free (client-side) |

### File Formats

| Format | Purpose | Details |
|--------|---------|---------|
| **GLB** | 3D models | Binary glTF, self-contained |
| **PNG** | Images | Concept art, sprites |
| **JSON** | Metadata | Asset configuration, prompts |

---

## Design Patterns

### 1. Service Pattern

Services encapsulate business logic and external integrations:

```typescript
// Example: AssetService
class AssetService {
  private baseUrl: string

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl
  }

  async fetchAssets(): Promise<Asset[]> {
    const response = await fetch(`${this.baseUrl}/assets`)
    return response.json()
  }

  async deleteAsset(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/assets/${id}`, { method: 'DELETE' })
  }
}

export const assetService = new AssetService()
```

### 2. Store Pattern (Zustand)

Centralized state with actions and selectors:

```typescript
interface State {
  // Data
  count: number

  // Actions
  increment: () => void
  decrement: () => void
  reset: () => void

  // Selectors
  isPositive: () => boolean
}

const useStore = create<State>()(
  immer((set, get) => ({
    count: 0,

    increment: () => set(state => { state.count++ }),
    decrement: () => set(state => { state.count-- }),
    reset: () => set({ count: 0 }),

    isPositive: () => get().count > 0
  }))
)
```

### 3. Pipeline Pattern

Multi-stage async processing:

```javascript
class GenerationService {
  async processPipeline(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId)

    try {
      // Stage 1
      await this.runStage('gpt4-enhancement', pipeline)

      // Stage 2
      await this.runStage('image-generation', pipeline)

      // Stage 3
      await this.runStage('image-to-3d', pipeline)

      pipeline.status = 'completed'
    } catch (error) {
      pipeline.status = 'failed'
      pipeline.error = error.message
    }
  }

  async runStage(stageId, pipeline) {
    pipeline.stages[stageId].status = 'processing'

    // Execute stage logic
    const result = await this.stageHandlers[stageId](pipeline)

    pipeline.stages[stageId].status = 'completed'
    pipeline.stages[stageId].result = result
  }
}
```

### 4. Factory Pattern

Object creation abstraction:

```typescript
// Example: Service factory based on mode
function createRiggingService(mode: 'simple' | 'advanced') {
  if (mode === 'simple') {
    return new SimpleHandRiggingService()
  } else {
    return new HandRiggingService()
  }
}
```

### 5. Observer Pattern

Event-driven updates:

```javascript
class GenerationService extends EventEmitter {
  async processPipeline(pipelineId) {
    this.emit('pipeline:started', { pipelineId })

    // ... processing ...

    this.emit('pipeline:stage-complete', { pipelineId, stage: 'image-generation' })

    // ... more processing ...

    this.emit('pipeline:completed', { pipelineId, result })
  }
}

// Usage
generationService.on('pipeline:stage-complete', ({ stage }) => {
  console.log(`Stage ${stage} completed`)
})
```

### 6. Middleware Pattern

Request/response interceptors:

```javascript
// Express middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
})

app.use(errorHandler) // Error handling middleware

// Zustand middleware
const store = create(
  devtools(           // Middleware 1: DevTools
    persist(          // Middleware 2: Persistence
      immer(          // Middleware 3: Immer
        (set, get) => ({ /* state */ })
      )
    )
  )
)
```

---

## Scalability Approach

### Current Architecture (Single-User)

The system is currently optimized for **single-user local development**:

- **No database**: File system storage
- **No authentication**: Local access only
- **No caching layer**: Direct API calls
- **No load balancing**: Single server instance

### Scalability Considerations

For multi-user production deployment, consider:

#### 1. Database Layer
```text
File System → PostgreSQL/MongoDB
└── Asset metadata → Database records
└── Files → Object storage (S3, CloudFlare R2)
```

#### 2. Authentication & Authorization
```text
Add authentication layer:
├── User accounts (Privy, Auth0)
├── API key management
├── Usage tracking & quotas
└── Team/workspace support
```

#### 3. Caching Strategy
```text
Redis Cache Layer:
├── Asset metadata cache
├── Pipeline status cache
├── Material preset cache
└── Generated prompt cache
```

#### 4. Queue System
```text
Replace in-memory pipeline with job queue:
├── BullMQ / RabbitMQ
├── Persistent job storage
├── Retry logic
├── Job prioritization
└── Worker scaling
```

#### 5. CDN & Asset Delivery
```text
CloudFlare CDN:
├── Static asset delivery
├── GLB file caching
├── Image optimization
└── Global distribution
```

#### 6. Horizontal Scaling
```text
Load Balancer
├── API Server 1 (stateless)
├── API Server 2 (stateless)
└── API Server N (stateless)
    └── Share Redis + Database
```

#### 7. Monitoring & Observability
```text
Observability Stack:
├── Application metrics (Prometheus)
├── Logging (Winston → ELK)
├── Error tracking (Sentry)
├── Performance monitoring (New Relic)
└── Cost tracking (per-user AI usage)
```

---

## Security Model

### Current Security Measures

#### 1. API Security
```javascript
// CORS configuration
app.use((req, res, next) => {
  const origin = process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : req.headers.origin || 'http://localhost:3000'

  res.header('Access-Control-Allow-Origin', origin)
  res.header('Access-Control-Allow-Credentials', 'true')
  next()
})

// Security headers (OWASP)
res.header('X-Content-Type-Options', 'nosniff')
res.header('X-Frame-Options', 'DENY')
res.header('X-XSS-Protection', '1; mode=block')
```

#### 2. Input Validation
```javascript
// File path validation (prevent directory traversal)
const normalizedPath = path.normalize(fullPath)
const assetDir = path.join(ROOT_DIR, 'gdd-assets', assetId)

if (!normalizedPath.startsWith(assetDir)) {
  return res.status(403).json({ error: 'Access denied' })
}

// Payload size limits
app.use(express.json({ limit: '25mb' }))
```

#### 3. Environment Variables
```bash
# .env file (never committed)
OPENAI_API_KEY=sk-...
MESHY_API_KEY=meshy_...
IMAGE_SERVER_URL=http://localhost:8080
API_PORT=3004
NODE_ENV=development
```

#### 4. Error Handling
```javascript
// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack)

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  })
})
```

### Security Recommendations for Production

#### 1. Authentication & Authorization
```typescript
// Add JWT authentication
app.use('/api/*', authenticateJWT)

function authenticateJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' })
    req.user = user
    next()
  })
}
```

#### 2. Rate Limiting
```javascript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})

app.use('/api/', limiter)
```

#### 3. Content Security Policy
```javascript
import helmet from 'helmet'

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https://api.openai.com', 'https://api.meshy.ai']
  }
}))
```

#### 4. SQL Injection Prevention (if using database)
```typescript
// Use parameterized queries
const result = await db.query(
  'SELECT * FROM assets WHERE id = $1',
  [assetId]
)
```

#### 5. API Key Rotation
```javascript
// Support multiple API keys for rotation
const API_KEYS = process.env.API_KEYS?.split(',') || []

function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key']

  if (!API_KEYS.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' })
  }

  next()
}
```

---

## Summary

Asset Forge is a **layered monolithic application** that combines:

1. **React frontend** with Three.js 3D rendering
2. **Zustand state management** with middleware
3. **Frontend services** for 3D processing (rigging, fitting)
4. **Express backend** for API endpoints
5. **Backend services** for AI orchestration
6. **External AI APIs** (OpenAI, Meshy)
7. **File system storage** for assets

**Key Strengths**:
- Clear separation of concerns
- Unidirectional data flow
- Service-oriented architecture
- Middleware-based extensibility
- Real-time 3D preview

**Scalability Path**:
- Add database layer
- Implement job queue
- Add caching (Redis)
- Horizontal scaling with load balancer
- CDN for asset delivery

**Security Considerations**:
- Input validation
- Environment variables for secrets
- CORS + security headers
- Error handling without leak
- Rate limiting for production

The architecture is well-suited for rapid development and can scale to multi-user production with the recommended enhancements.
