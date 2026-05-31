# Frontend Architecture

## Table of Contents
- [Overview](#overview)
- [Component Hierarchy](#component-hierarchy)
- [Page Structure](#page-structure)
- [Service Layer](#service-layer)
- [Three.js Integration](#threejs-integration)
- [State Management Overview](#state-management-overview)
- [Routing and Navigation](#routing-and-navigation)
- [Asset Loading Patterns](#asset-loading-patterns)
- [3D Rendering Pipeline](#3d-rendering-pipeline)
- [Performance Optimization](#performance-optimization)

---

## Overview

The Asset Forge frontend is built with **React 19.2** and **Three.js 0.178**, combining traditional UI components with high-performance 3D rendering. The architecture emphasizes:

- **Component reusability** across 5 major pages
- **Declarative 3D** with @react-three/fiber
- **Type safety** with TypeScript 5.3
- **State isolation** with Zustand stores
- **Performance** through lazy loading and memoization

### Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2.0 | UI framework |
| Three.js | 0.178.0 | 3D rendering engine |
| @react-three/fiber | 9.0.0 | Declarative Three.js |
| @react-three/drei | 10.7.6 | Three.js helpers |
| TensorFlow.js | 4.22.0 | ML (hand detection) |
| TailwindCSS | 3.3.6 | Styling |
| Vite | 6.0.0 | Build tool |

### Project Structure

```
src/
├── App.tsx                      # Root component
├── main.tsx                     # Entry point
├── pages/                       # Top-level pages (5)
├── components/                  # UI components (77)
├── services/                    # Business logic (13)
├── store/                       # Zustand stores (5)
├── hooks/                       # Custom React hooks
├── contexts/                    # React contexts
├── types/                       # TypeScript types
├── utils/                       # Utility functions
├── constants/                   # Constants
└── styles/                      # Global styles
```

---

## Component Hierarchy

### Component Tree

```
App (ErrorBoundary + Providers)
├── AppProvider (Application context)
└── NavigationProvider (Navigation context)
    └── AppContent
        ├── Navigation (Top bar)
        ├── NotificationBar (Toast notifications)
        └── main (Page router)
            ├── GenerationPage
            ├── AssetsPage
            ├── EquipmentPage
            ├── HandRiggingPage
            └── ArmorFittingPage
```

### Component Distribution (77 Total)

```
components/
├── Generation/          (21 components)
│   ├── GenerationForm.tsx
│   ├── AssetTypeSelector.tsx
│   ├── MaterialSelector.tsx
│   ├── PipelineProgress.tsx
│   ├── StageIndicator.tsx
│   ├── GenerationResults.tsx
│   └── ... (15 more)
│
├── Assets/              (15 components)
│   ├── AssetGrid.tsx
│   ├── AssetCard.tsx
│   ├── AssetViewer.tsx
│   ├── ModelViewer.tsx
│   ├── AnimationViewer.tsx
│   ├── FilterControls.tsx
│   └── ... (9 more)
│
├── Equipment/           (8 components)
│   ├── EquipmentGrid.tsx
│   ├── EquipmentCard.tsx
│   ├── WeaponEditor.tsx
│   └── ... (5 more)
│
├── HandRigging/         (12 components)
│   ├── HandRiggingViewer.tsx
│   ├── RiggingControls.tsx
│   ├── ProcessingSteps.tsx
│   ├── SkeletonVisualizer.tsx
│   └── ... (8 more)
│
├── ArmorFitting/        (9 components)
│   ├── ArmorFittingViewer.tsx
│   ├── ArmorFittingControls.tsx
│   ├── ArmorAssetList.tsx
│   ├── FittingProgress.tsx
│   ├── ViewportControls.tsx
│   ├── MeshFittingDebugger/
│   │   └── index.tsx
│   └── ... (3 more)
│
└── shared/              (12 components)
    ├── Navigation.tsx
    ├── NotificationBar.tsx
    ├── Button.tsx
    ├── Modal.tsx
    ├── LoadingSpinner.tsx
    ├── ErrorBoundary.tsx
    └── ... (6 more)
```

### Component Patterns

#### 1. Container/Presentational Pattern

```typescript
// Container Component (Smart)
export function AssetViewerContainer() {
  const selectedAsset = useAssetsStore(state => state.selectedAsset)
  const setShowDetailsPanel = useAssetsStore(state => state.setShowDetailsPanel)

  if (!selectedAsset) {
    return <EmptyState message="No asset selected" />
  }

  return (
    <AssetViewerPresentation
      asset={selectedAsset}
      onShowDetails={() => setShowDetailsPanel(true)}
    />
  )
}

// Presentational Component (Dumb)
interface AssetViewerPresentationProps {
  asset: Asset
  onShowDetails: () => void
}

export function AssetViewerPresentation({ asset, onShowDetails }: AssetViewerPresentationProps) {
  return (
    <div className="asset-viewer">
      <ModelViewer modelUrl={asset.modelUrl} />
      <Button onClick={onShowDetails}>Show Details</Button>
    </div>
  )
}
```

#### 2. Compound Component Pattern

```typescript
// Parent component with child components
export function PipelineProgress() {
  const stages = useGenerationStore(state => state.pipelineStages)

  return (
    <PipelineProgress.Container>
      {stages.map(stage => (
        <PipelineProgress.Stage
          key={stage.id}
          stage={stage}
          icon={<StageIcon type={stage.id} />}
        />
      ))}
    </PipelineProgress.Container>
  )
}

PipelineProgress.Container = ({ children }) => (
  <div className="pipeline-stages">{children}</div>
)

PipelineProgress.Stage = ({ stage, icon }) => (
  <div className={`stage stage-${stage.status}`}>
    {icon}
    <span>{stage.name}</span>
  </div>
)
```

#### 3. Render Props Pattern

```typescript
// Used for Three.js components
function ModelViewer({ modelUrl, children }: ModelViewerProps) {
  const [model, setModel] = useState<GLTF | null>(null)

  useEffect(() => {
    loadModel(modelUrl).then(setModel)
  }, [modelUrl])

  if (!model) return <LoadingSpinner />

  return children({ model })
}

// Usage
<ModelViewer modelUrl={asset.modelUrl}>
  {({ model }) => (
    <Canvas>
      <primitive object={model.scene} />
    </Canvas>
  )}
</ModelViewer>
```

---

## Page Structure

### 1. GenerationPage (Asset Generation)

**Purpose**: Create new 3D assets from text descriptions

**Component Breakdown**:
```typescript
GenerationPage
├── GenerationTypeSelector      // Choose: Item or Avatar
├── GenerationForm              // Asset configuration
│   ├── AssetTypeSelector       // weapon, armor, character, etc.
│   ├── DescriptionInput        // Text description
│   ├── MaterialSelector        // Material variants
│   ├── AdvancedOptions         // GPT-4, quality, etc.
│   └── ReferenceImageUpload    // Optional reference
├── PipelineProgress            // Real-time generation progress
│   ├── StageIndicator[]        // Visual stage progress
│   └── ProgressBar             // Overall progress
└── GenerationResults           // Completed assets
    ├── AssetPreview            // 3D model preview
    ├── VariantGrid             // Material variants
    └── ActionButtons           // View, Download, etc.
```

**Key Features**:
- Multi-stage pipeline visualization
- Real-time progress updates (2s polling)
- Reference image upload/URL support
- Material variant selection
- Avatar-specific rigging options

**State Management**:
```typescript
const GenerationPage = () => {
  const {
    generationType,
    assetName,
    description,
    selectedMaterials,
    isGenerating,
    pipelineStages,
    generatedAssets,
    setGenerationType,
    setAssetName,
    setDescription,
    toggleMaterialSelection
  } = useGenerationStore()

  const handleGenerate = async () => {
    // Start generation pipeline
    const config = buildGenerationConfig({
      name: assetName,
      type: generationType,
      description,
      materials: selectedMaterials
    })

    await startGeneration(config)
  }

  return (
    <div className="generation-page">
      {/* UI implementation */}
    </div>
  )
}
```

---

### 2. AssetsPage (Asset Library)

**Purpose**: Browse, view, and manage generated assets

**Component Breakdown**:
```typescript
AssetsPage
├── FilterControls              // Search and filters
│   ├── SearchBar               // Text search
│   ├── TypeFilter              // Filter by type
│   └── MaterialFilter          // Filter by material
├── AssetGrid                   // Asset gallery
│   └── AssetCard[]             // Individual asset cards
├── AssetViewer                 // Selected asset viewer
│   ├── ModelViewer             // 3D model display
│   │   ├── Canvas (Three.js)   // 3D canvas
│   │   ├── OrbitControls       // Camera controls
│   │   └── Lighting            // Scene lighting
│   ├── AnimationViewer         // For rigged characters
│   │   ├── AnimationControls   // Play/pause/select
│   │   └── AnimationClips[]    // Available animations
│   ├── DetailsPanel            // Asset metadata
│   └── ActionButtons           // Edit, Delete, Export
└── Modals
    ├── RetextureModal          // Create material variant
    ├── RegenerateModal         // Regenerate base model
    ├── EditModal               // Edit metadata
    └── SpriteModal             // Generate sprites
```

**3D Viewer Implementation**:
```typescript
function ModelViewer({ asset }: ModelViewerProps) {
  const [model, setModel] = useState<GLTF | null>(null)
  const { isWireframe, showGroundPlane, isLightBackground } = useAssetsStore()

  useEffect(() => {
    loadGLTF(asset.modelUrl).then(setModel)
  }, [asset.modelUrl])

  return (
    <Canvas camera={{ position: [0, 1, 3], fov: 50 }}>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* Model */}
      {model && (
        <primitive
          object={model.scene}
          wireframe={isWireframe}
        />
      )}

      {/* Ground plane */}
      {showGroundPlane && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      )}

      {/* Camera controls */}
      <OrbitControls />

      {/* Background */}
      <color attach="background" args={[isLightBackground ? '#f0f0f0' : '#1a1a1a']} />
    </Canvas>
  )
}
```

---

### 3. HandRiggingPage (Hand Rigging Tool)

**Purpose**: Add hand bones to character models

**Component Breakdown**:
```typescript
HandRiggingPage
├── AssetSelector               // Select character model
├── ModeSelector                // Simple vs Advanced
├── HandRiggingViewer           // 3D viewer with rigging
│   ├── Canvas (Three.js)
│   ├── CharacterModel          // Original model
│   ├── HandSkeleton            // Generated bones
│   └── SkeletonHelper          // Visual skeleton
├── RiggingControls             // Control panel
│   ├── ProcessingSteps         // Stage progress
│   ├── SkeletonToggle          // Show/hide skeleton
│   └── DebugImages             // Hand detection debug
└── ExportControls              // Export rigged model
```

**TensorFlow.js Integration**:
```typescript
function HandRiggingService() {
  async initializeDetector() {
    this.detector = await handPoseDetection.createDetector(
      handPoseDetection.SupportedModels.MediaPipeHands,
      {
        runtime: 'tfjs',
        maxHands: 2,
        modelType: 'full'
      }
    )
  }

  async detectHandPose(canvas: HTMLCanvasElement) {
    const hands = await this.detector.estimateHands(canvas)

    return hands.map(hand => ({
      handedness: hand.handedness,
      keypoints: hand.keypoints.map(kp => ({
        name: kp.name!,
        position: new Vector3(kp.x, kp.y, kp.z || 0)
      }))
    }))
  }
}
```

---

### 4. ArmorFittingPage (Armor Fitting Tool)

**Purpose**: Fit armor pieces to character models

**Component Breakdown**:
```typescript
ArmorFittingPage
├── AssetSelectors              // Dual selection
│   ├── AvatarSelector          // Select character
│   └── ArmorSelector           // Select armor/helmet
├── EquipmentSlotSelector       // Spine2 (armor) or Head (helmet)
├── ArmorFittingViewer          // 3D fitting viewport
│   ├── Canvas (Three.js)
│   ├── AvatarMesh              // Character model
│   ├── ArmorMesh               // Armor piece
│   ├── SkeletonHelper          // Show skeleton
│   └── DebugVisualizations     // Collision/weights
├── FittingControls             // Fitting parameters
│   ├── MethodSelector          // Shrinkwrap
│   ├── IterationsSlider        // Fitting iterations
│   ├── StepSizeSlider          // Movement per iteration
│   ├── OffsetSlider            // Target offset
│   └── WeightTransferToggle    // Enable skinning
├── AnimationControls           // Test animations
│   ├── AnimationSelector       // T-pose, Walking, Running
│   └── PlaybackControls        // Play/Pause
└── ExportControls              // Export fitted armor
```

**Shrinkwrap Algorithm**:
```typescript
class MeshFittingService {
  performShrinkwrap(
    armorMesh: Mesh,
    avatarMesh: Mesh,
    params: ShrinkwrapParams
  ): void {
    const positions = armorMesh.geometry.getAttribute('position')
    const raycaster = new Raycaster()

    for (let iter = 0; iter < params.iterations; iter++) {
      for (let i = 0; i < positions.count; i++) {
        const vertex = new Vector3().fromBufferAttribute(positions, i)

        // Transform to world space
        vertex.applyMatrix4(armorMesh.matrixWorld)

        // Calculate normal
        const normal = this.calculateVertexNormal(armorMesh, i)

        // Cast ray toward avatar
        raycaster.set(vertex, normal.negate())
        const intersects = raycaster.intersectObject(avatarMesh, true)

        if (intersects.length > 0) {
          const target = intersects[0].point

          // Move vertex toward target
          const direction = target.clone().sub(vertex).normalize()
          vertex.add(direction.multiplyScalar(params.stepSize))

          // Apply offset
          vertex.add(normal.multiplyScalar(params.targetOffset))

          // Transform back to local space
          vertex.applyMatrix4(armorMesh.matrixWorld.clone().invert())

          // Update position
          positions.setXYZ(i, vertex.x, vertex.y, vertex.z)
        }
      }

      positions.needsUpdate = true

      // Apply smoothing
      if (params.smoothingStrength > 0) {
        this.smoothMesh(armorMesh, params.smoothingRadius, params.smoothingStrength)
      }
    }
  }
}
```

---

### 5. EquipmentPage (Equipment Management)

**Purpose**: Manage and edit equipment metadata

**Component Breakdown**:
```typescript
EquipmentPage
├── EquipmentFilters            // Filter equipment
├── EquipmentGrid               // Equipment cards
│   └── EquipmentCard[]         // Individual items
└── EquipmentEditor             // Edit selected item
    ├── MetadataForm            // Name, type, stats
    ├── WeaponEditor            // Weapon-specific (grip detection)
    └── SaveButton              // Save changes
```

---

## Service Layer

### Service Architecture

The frontend has **13 services** organized by domain:

```
services/
├── api/                        # API communication (2)
│   ├── AssetService.ts         # Asset CRUD operations
│   └── PromptService.ts        # Prompt management
│
├── hand-rigging/               # Hand rigging (4)
│   ├── HandRiggingService.ts   # Advanced rigging
│   ├── SimpleHandRiggingService.ts  # Simple rigging
│   ├── HandPoseDetectionService.ts  # TensorFlow.js
│   └── HandSegmentationService.ts   # Mesh segmentation
│
├── fitting/                    # Armor fitting (3)
│   ├── ArmorFittingService.ts  # High-level coordination
│   ├── MeshFittingService.ts   # Shrinkwrap algorithm
│   └── WeightTransferService.ts # Vertex weight transfer
│
└── processing/                 # Asset processing (3)
    ├── AssetNormalizationService.ts  # Scale/position
    ├── CreatureScalingService.ts     # Creature scaling
    └── SpriteGenerationService.ts    # 2D sprite rendering
```

### API Services

#### AssetService (Asset CRUD)

```typescript
export class AssetService {
  private baseUrl = '/api'

  async fetchAssets(): Promise<Asset[]> {
    const response = await fetch(`${this.baseUrl}/assets`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch assets: ${response.status}`)
    }

    return response.json()
  }

  async deleteAsset(id: string, includeVariants: boolean = false): Promise<void> {
    const url = `${this.baseUrl}/assets/${id}?includeVariants=${includeVariants}`

    const response = await fetch(url, { method: 'DELETE' })

    if (!response.ok) {
      throw new Error(`Failed to delete asset: ${response.status}`)
    }
  }

  async updateAssetMetadata(id: string, updates: Partial<Asset>): Promise<Asset> {
    const response = await fetch(`${this.baseUrl}/assets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      throw new Error(`Failed to update asset: ${response.status}`)
    }

    return response.json()
  }

  async saveSprites(
    assetId: string,
    sprites: { angle: number; imageData: string }[],
    config: SpriteConfig
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/assets/${assetId}/sprites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprites, config })
    })

    if (!response.ok) {
      throw new Error(`Failed to save sprites: ${response.status}`)
    }
  }
}

export const assetService = new AssetService()
```

#### PromptService (Prompt Management)

```typescript
export class PromptService {
  private baseUrl = '/api'

  async loadMaterialPresets(): Promise<MaterialPreset[]> {
    const response = await fetch(`${this.baseUrl}/material-presets`)

    if (!response.ok) {
      throw new Error(`Failed to load material presets: ${response.status}`)
    }

    return response.json()
  }

  async saveMaterialPresets(presets: MaterialPreset[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/material-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(presets)
    })

    if (!response.ok) {
      throw new Error(`Failed to save material presets: ${response.status}`)
    }
  }
}

export const promptService = new PromptService()
```

---

## Three.js Integration

### React Three Fiber Usage

**@react-three/fiber** provides a declarative API for Three.js:

```typescript
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei'

function Scene({ model }: { model: GLTF }) {
  return (
    <Canvas>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 1, 3]} fov={50} />

      {/* Lights */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />

      {/* Model */}
      <primitive object={model.scene} />

      {/* Environment */}
      <Environment preset="studio" />

      {/* Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={10}
      />
    </Canvas>
  )
}
```

### Custom Three.js Hooks

```typescript
// Hook for loading GLTF models
export function useGLTF(url: string | null): GLTF | null {
  const [model, setModel] = useState<GLTF | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!url) {
      setModel(null)
      return
    }

    setLoading(true)
    setError(null)

    const loader = new GLTFLoader()

    loader.load(
      url,
      (gltf) => {
        setModel(gltf)
        setLoading(false)
      },
      undefined,
      (err) => {
        setError(err as Error)
        setLoading(false)
      }
    )

    return () => {
      // Cleanup: dispose geometries and materials
      if (model) {
        model.scene.traverse((child) => {
          if (child instanceof Mesh) {
            child.geometry.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose())
            } else {
              child.material.dispose()
            }
          }
        })
      }
    }
  }, [url])

  return model
}

// Hook for frame-based animations
export function useFrame(callback: (delta: number) => void) {
  const requestRef = useRef<number>()
  const previousTimeRef = useRef<number>()

  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const delta = time - previousTimeRef.current
        callback(delta / 1000) // Convert to seconds
      }
      previousTimeRef.current = time
      requestRef.current = requestAnimationFrame(animate)
    }

    requestRef.current = requestAnimationFrame(animate)

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [callback])
}
```

---

## State Management Overview

### Store Integration with Components

```typescript
// Component subscribing to multiple stores
function ArmorFittingPage() {
  // Armor fitting store
  const {
    selectedAvatar,
    selectedArmor,
    fittingConfig,
    isReadyToFit,
    performFitting
  } = useArmorFittingStore()

  // Assets store (for loading assets)
  const assets = useAssetsStore(state => state.getFilteredAssets([]))

  const handleFit = async () => {
    if (!isReadyToFit()) {
      notify('Please select both avatar and armor')
      return
    }

    await performFitting(viewerRef)
  }

  return (
    <div className="armor-fitting-page">
      {/* UI */}
    </div>
  )
}
```

### Derived State with Selectors

```typescript
// Store with computed values
interface AssetsState {
  assets: Asset[]
  searchTerm: string
  typeFilter: string

  // Selector: computed filtered assets
  getFilteredAssets: () => Asset[]
}

const useAssetsStore = create<AssetsState>((set, get) => ({
  assets: [],
  searchTerm: '',
  typeFilter: '',

  getFilteredAssets: () => {
    const { assets, searchTerm, typeFilter } = get()

    return assets.filter(asset => {
      if (searchTerm && !asset.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      if (typeFilter && asset.type !== typeFilter) {
        return false
      }

      return true
    })
  }
}))

// Component uses selector
function AssetGrid() {
  const filteredAssets = useAssetsStore(state => state.getFilteredAssets())

  return (
    <div className="asset-grid">
      {filteredAssets.map(asset => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  )
}
```

---

## Routing and Navigation

### Navigation System

Asset Forge uses a **custom navigation system** with `NavigationContext`:

```typescript
// contexts/NavigationContext.tsx
interface NavigationContextType {
  currentView: string
  navigateTo: (view: string) => void
  navigateToAsset: (assetId: string) => void
  goBack: () => void
}

export const NavigationProvider = ({ children }: PropsWithChildren) => {
  const [currentView, setCurrentView] = useState(NAVIGATION_VIEWS.ASSETS)
  const [history, setHistory] = useState<string[]>([])

  const navigateTo = (view: string) => {
    setHistory([...history, currentView])
    setCurrentView(view)
  }

  const navigateToAsset = (assetId: string) => {
    // Navigate to assets page and select asset
    navigateTo(NAVIGATION_VIEWS.ASSETS)
    useAssetsStore.getState().setSelectedAsset(assetId)
  }

  const goBack = () => {
    const previous = history.pop()
    if (previous) {
      setCurrentView(previous)
      setHistory([...history])
    }
  }

  return (
    <NavigationContext.Provider value={{ currentView, navigateTo, navigateToAsset, goBack }}>
      {children}
    </NavigationContext.Provider>
  )
}

// Hook for navigation
export const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}
```

### Navigation Component

```typescript
// components/shared/Navigation.tsx
export default function Navigation({ currentView, onViewChange }: NavigationProps) {
  const views = [
    { id: NAVIGATION_VIEWS.ASSETS, label: 'Assets', icon: <Folder /> },
    { id: NAVIGATION_VIEWS.GENERATION, label: 'Generate', icon: <Sparkles /> },
    { id: NAVIGATION_VIEWS.EQUIPMENT, label: 'Equipment', icon: <Shield /> },
    { id: NAVIGATION_VIEWS.HAND_RIGGING, label: 'Hand Rigging', icon: <Hand /> },
    { id: NAVIGATION_VIEWS.ARMOR_FITTING, label: 'Armor Fitting', icon: <Box /> }
  ]

  return (
    <nav className="top-navigation">
      {views.map(view => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          className={currentView === view.id ? 'active' : ''}
        >
          {view.icon}
          <span>{view.label}</span>
        </button>
      ))}
    </nav>
  )
}
```

---

## Asset Loading Patterns

### Lazy Loading with Suspense

```typescript
import { lazy, Suspense } from 'react'

// Lazy-loaded page components
const GenerationPage = lazy(() => import('./pages/GenerationPage'))
const AssetsPage = lazy(() => import('./pages/AssetsPage'))
const HandRiggingPage = lazy(() => import('./pages/HandRiggingPage'))
const ArmorFittingPage = lazy(() => import('./pages/ArmorFittingPage'))
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'))

// App with Suspense boundaries
function App() {
  const { currentView } = useNavigation()

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {currentView === NAVIGATION_VIEWS.GENERATION && <GenerationPage />}
      {currentView === NAVIGATION_VIEWS.ASSETS && <AssetsPage />}
      {currentView === NAVIGATION_VIEWS.HAND_RIGGING && <HandRiggingPage />}
      {currentView === NAVIGATION_VIEWS.ARMOR_FITTING && <ArmorFittingPage />}
      {currentView === NAVIGATION_VIEWS.EQUIPMENT && <EquipmentPage />}
    </Suspense>
  )
}
```

### Progressive Model Loading

```typescript
function ModelViewer({ modelUrl }: ModelViewerProps) {
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [model, setModel] = useState<GLTF | null>(null)

  useEffect(() => {
    const loader = new GLTFLoader()

    loader.load(
      modelUrl,
      (gltf) => {
        setModel(gltf)
        setLoadingProgress(100)
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100
        setLoadingProgress(percent)
      },
      (error) => {
        console.error('Failed to load model:', error)
      }
    )
  }, [modelUrl])

  if (!model) {
    return (
      <div className="loading-model">
        <LoadingSpinner />
        <p>Loading model... {loadingProgress.toFixed(0)}%</p>
      </div>
    )
  }

  return <primitive object={model.scene} />
}
```

---

## 3D Rendering Pipeline

### Rendering Flow

```
1. Component Mount
   └── useEffect hook triggered

2. GLTF Loading
   ├── GLTFLoader.load(url)
   ├── Parse GLB binary
   ├── Create Three.js scene graph
   └── Load textures

3. Scene Setup
   ├── Create Camera (PerspectiveCamera)
   ├── Add Lights (Ambient, Directional, Point)
   ├── Position Model
   └── Setup Controls (OrbitControls)

4. Render Loop
   ├── requestAnimationFrame
   ├── Update Controls
   ├── Update Animations (if any)
   ├── Render Scene
   └── Repeat

5. Cleanup
   ├── Dispose Geometries
   ├── Dispose Materials
   ├── Dispose Textures
   └── Remove from Scene
```

### Optimized Rendering

```typescript
function OptimizedModelViewer({ model }: { model: GLTF }) {
  const meshRef = useRef<Mesh>()

  // Memoize expensive computations
  const processedModel = useMemo(() => {
    // Clone model to avoid mutations
    const clone = model.scene.clone()

    // Optimize geometry
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        // Compute vertex normals if missing
        if (!child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals()
        }

        // Enable frustum culling
        child.frustumCulled = true

        // Set render order
        child.renderOrder = 1
      }
    })

    return clone
  }, [model])

  // Animation loop
  useFrame((delta) => {
    if (meshRef.current) {
      // Rotate model slowly
      meshRef.current.rotation.y += delta * 0.1
    }
  })

  return <primitive ref={meshRef} object={processedModel} />
}
```

---

## Performance Optimization

### 1. Code Splitting

```typescript
// Split large components
const MeshFittingDebugger = lazy(() =>
  import('./components/ArmorFitting/MeshFittingDebugger')
)

// Use only when needed
{showDebugger && (
  <Suspense fallback={<LoadingSpinner />}>
    <MeshFittingDebugger />
  </Suspense>
)}
```

### 2. Memoization

```typescript
// Memoize expensive renders
const AssetCard = React.memo(({ asset }: { asset: Asset }) => {
  return (
    <div className="asset-card">
      <img src={asset.thumbnailUrl} alt={asset.name} />
      <h3>{asset.name}</h3>
    </div>
  )
}, (prevProps, nextProps) => {
  // Only re-render if asset ID changed
  return prevProps.asset.id === nextProps.asset.id
})

// Memoize expensive computations
const filteredAssets = useMemo(() => {
  return assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  )
}, [assets, searchTerm])
```

### 3. Virtual Scrolling

```typescript
// For large asset lists
import { FixedSizeGrid } from 'react-window'

function AssetGrid({ assets }: { assets: Asset[] }) {
  const Cell = ({ columnIndex, rowIndex, style }: CellProps) => {
    const index = rowIndex * 4 + columnIndex
    const asset = assets[index]

    if (!asset) return null

    return (
      <div style={style}>
        <AssetCard asset={asset} />
      </div>
    )
  }

  return (
    <FixedSizeGrid
      columnCount={4}
      columnWidth={250}
      height={600}
      rowCount={Math.ceil(assets.length / 4)}
      rowHeight={300}
      width={1000}
    >
      {Cell}
    </FixedSizeGrid>
  )
}
```

### 4. Three.js Optimization

```typescript
// Optimize Three.js rendering
function OptimizedCanvas() {
  return (
    <Canvas
      gl={{
        antialias: false,        // Disable for performance
        alpha: false,            // Opaque background
        powerPreference: 'high-performance'
      }}
      camera={{ position: [0, 1, 3], fov: 50 }}
      frameloop="demand"         // Only render when needed
      dpr={[1, 2]}               // Adaptive pixel ratio
    >
      <Scene />
    </Canvas>
  )
}

// Dispose resources properly
useEffect(() => {
  return () => {
    model.scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }
}, [model])
```

### 5. Image Optimization

```typescript
// Lazy load images with Intersection Observer
function LazyImage({ src, alt }: { src: string; alt: string }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsLoaded(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <img
      ref={imgRef}
      src={isLoaded ? src : '/placeholder.png'}
      alt={alt}
      loading="lazy"
    />
  )
}
```

---

## Summary

The Asset Forge frontend is a **well-architected React application** with:

**Strengths**:
- ✅ Clear component hierarchy (5 pages, 77 components)
- ✅ Strong typing with TypeScript
- ✅ Declarative 3D rendering with @react-three/fiber
- ✅ Service-oriented architecture (13 services)
- ✅ State management with Zustand
- ✅ Performance optimizations (memoization, lazy loading)

**Key Technologies**:
- React 19.2 (UI framework)
- Three.js 0.178 (3D rendering)
- TensorFlow.js 4.22 (ML on client)
- Zustand 5.0 (state management)
- TailwindCSS 3.3 (styling)

**Architecture Patterns**:
- Container/Presentational components
- Service layer for business logic
- Custom hooks for reusable logic
- Zustand stores for centralized state
- React Context for cross-cutting concerns

The frontend provides a robust foundation for AI-powered 3D asset generation and manipulation.
