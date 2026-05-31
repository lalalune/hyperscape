# State Management with Zustand

This document comprehensively covers all 5 Zustand stores powering Asset Forge's state management, including complete state shapes, action documentation, persistence configuration, and middleware setup.

## Table of Contents

1. [Store Architecture](#store-architecture)
2. [useGenerationStore](#usegenerationstore)
3. [useAssetsStore](#useassetsstore)
4. [useHandRiggingStore](#usehandriggingstore)
5. [useArmorFittingStore](#usearmorefittingstore)
6. [useDebuggerStore](#usedebuggerstore)
7. [Middleware Configuration](#middleware-configuration)
8. [Best Practices](#best-practices)

---

## Store Architecture

Asset Forge uses [Zustand](https://github.com/pmndrs/zustand) for state management, chosen for its simplicity, TypeScript support, and lack of boilerplate compared to Redux.

### Why Zustand?

1. **Minimal Boilerplate**: No actions, reducers, or dispatch
2. **TypeScript First**: Excellent type inference
3. **Hooks-based**: Natural React integration
4. **DevTools Support**: Redux DevTools compatibility
5. **Middleware**: Built-in persist, immer, and devtools middleware
6. **No Provider**: Works without context providers

### Store Structure

All stores follow a consistent pattern:

```typescript
import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface State {
  // State properties
}

interface Actions {
  // Action methods
}

type Store = State & Actions

export const useStore = create<Store>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          property: initialValue,

          // Actions
          action: () => set((state) => {
            state.property = newValue
          })
        }))
      ),
      {
        name: 'store-name',
        partialize: (state) => ({ /* persisted fields */ })
      }
    ),
    { name: 'StoreName' }
  )
)
```

### Middleware Stack

1. **immer**: Immutable updates with mutable syntax
2. **subscribeWithSelector**: Selective re-renders
3. **persist**: LocalStorage persistence
4. **devtools**: Redux DevTools integration

---

## useGenerationStore

Manages the entire AI asset generation workflow.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/store/useGenerationStore.ts`

### State Shape (51 Properties)

```typescript
interface GenerationState {
  // UI State (6 properties)
  generationType: 'item' | 'avatar' | undefined
  activeView: 'config' | 'progress' | 'results'
  showAdvancedPrompts: boolean
  showAssetTypeEditor: boolean
  editMaterialPrompts: boolean
  showDeleteConfirm: string | null

  // Material State (3 properties)
  materialPresets: MaterialPreset[]
  isLoadingMaterials: boolean
  editingPreset: MaterialPreset | null

  // Form State (5 properties)
  assetName: string
  assetType: string
  description: string
  gameStyle: 'runescape' | 'custom'
  customStyle: string

  // Reference Image Input (4 properties)
  referenceImageMode: 'auto' | 'custom'
  referenceImageSource: 'upload' | 'url' | null
  referenceImageUrl: string | null
  referenceImageDataUrl: string | null

  // Custom Prompts (2 properties)
  customGamePrompt: string
  customAssetTypePrompt: string

  // Asset Type Management (2 properties)
  customAssetTypes: CustomAssetType[]
  assetTypePrompts: Record<string, string>

  // Pipeline Configuration (4 properties)
  useGPT4Enhancement: boolean
  enableRetexturing: boolean
  enableSprites: boolean
  quality: 'standard' | 'high' | 'ultra'

  // Avatar Configuration (2 properties)
  enableRigging: boolean
  characterHeight: number

  // Material Configuration (3 properties)
  selectedMaterials: string[]
  customMaterials: CustomMaterial[]
  materialPromptOverrides: Record<string, string>

  // Pipeline Execution State (6 properties)
  isGenerating: boolean
  currentPipelineId: string | null
  isGeneratingSprites: boolean
  modelLoadError: string | null
  isModelLoading: boolean
  pipelineStages: PipelineStage[]

  // Results State (3 properties)
  generatedAssets: GeneratedAsset[]
  selectedAsset: GeneratedAsset | null
  selectedStageResult: StageResult | null
}
```

### Actions (50+ Methods)

#### UI Actions (6)
```typescript
setGenerationType: (type: 'item' | 'avatar' | undefined) => void
setActiveView: (view: 'config' | 'progress' | 'results') => void
setShowAdvancedPrompts: (show: boolean) => void
setShowAssetTypeEditor: (show: boolean) => void
setEditMaterialPrompts: (edit: boolean) => void
setShowDeleteConfirm: (id: string | null) => void
```

#### Reference Image Actions (4)
```typescript
setReferenceImageMode: (mode: 'auto' | 'custom') => void
setReferenceImageSource: (source: 'upload' | 'url' | null) => void
setReferenceImageUrl: (url: string | null) => void
setReferenceImageDataUrl: (dataUrl: string | null) => void
```

#### Material Actions (3)
```typescript
setMaterialPresets: (presets: MaterialPreset[]) => void
setIsLoadingMaterials: (loading: boolean) => void
setEditingPreset: (preset: MaterialPreset | null) => void
```

#### Form Actions (5)
```typescript
setAssetName: (name: string) => void
setAssetType: (type: string) => void
setDescription: (desc: string) => void
setGameStyle: (style: 'runescape' | 'custom') => void
setCustomStyle: (style: string) => void
```

#### Custom Prompt Actions (2)
```typescript
setCustomGamePrompt: (prompt: string) => void
setCustomAssetTypePrompt: (prompt: string) => void
```

#### Asset Type Actions (4)
```typescript
setCustomAssetTypes: (types: CustomAssetType[]) => void
setAssetTypePrompts: (prompts: Record<string, string>) => void
addCustomAssetType: (type: CustomAssetType) => void
removeCustomAssetType: (name: string) => void
```

#### Pipeline Configuration Actions (4)
```typescript
setUseGPT4Enhancement: (use: boolean) => void
setEnableRetexturing: (enable: boolean) => void
setEnableSprites: (enable: boolean) => void
setQuality: (q: 'standard' | 'high' | 'ultra') => void
```

#### Avatar Configuration Actions (2)
```typescript
setEnableRigging: (enable: boolean) => void
setCharacterHeight: (height: number) => void
```

#### Material Configuration Actions (6)
```typescript
setSelectedMaterials: (materials: string[]) => void
setCustomMaterials: (materials: CustomMaterial[]) => void
setMaterialPromptOverrides: (overrides: Record<string, string>) => void
addCustomMaterial: (material: CustomMaterial) => void
removeCustomMaterial: (name: string) => void
toggleMaterialSelection: (materialId: string) => void
```

#### Pipeline Execution Actions (6)
```typescript
setIsGenerating: (generating: boolean) => void
setCurrentPipelineId: (id: string | null) => void
setIsGeneratingSprites: (generating: boolean) => void
setModelLoadError: (error: string | null) => void
setIsModelLoading: (loading: boolean) => void
setPipelineStages: (stages: PipelineStage[]) => void
updatePipelineStage: (stageId: string, status: PipelineStage['status']) => void
```

#### Results Actions (5)
```typescript
setGeneratedAssets: (assets: GeneratedAsset[]) => void
setSelectedAsset: (asset: GeneratedAsset | null) => void
setSelectedStageResult: (result: StageResult | null) => void
addGeneratedAsset: (asset: GeneratedAsset) => void
updateGeneratedAsset: (id: string, updates: Partial<GeneratedAsset>) => void
```

#### Complex Actions (3)
```typescript
resetForm: () => void
resetPipeline: () => void
initializePipelineStages: () => void
```

### Key Implementation Details

#### Toggle Material Selection
```typescript
toggleMaterialSelection: (materialId) => set((state) => {
  const index = state.selectedMaterials.indexOf(materialId)
  if (index > -1) {
    state.selectedMaterials.splice(index, 1)
  } else {
    state.selectedMaterials.push(materialId)
  }
})
```

#### Update Pipeline Stage
```typescript
updatePipelineStage: (stageId, status) => set((state) => {
  const stage = state.pipelineStages.find(s => s.id === stageId)
  if (stage) {
    stage.status = status
  }
})
```

#### Initialize Pipeline Stages
```typescript
initializePipelineStages: () => {
  const { generationType, useGPT4Enhancement, enableRetexturing, enableSprites, enableRigging } = get()

  const stages: PipelineStage[] = [
    {
      id: 'text-input',
      name: 'Text Input',
      description: 'Process asset description',
      status: 'idle'
    },
    {
      id: 'gpt4-enhancement',
      name: 'Prompt Enhancement',
      description: 'Enhance prompt with AI',
      status: useGPT4Enhancement ? 'idle' : 'skipped'
    },
    {
      id: 'image-generation',
      name: 'Image Generation',
      description: 'Generate concept art',
      status: 'idle'
    },
    {
      id: 'image-to-3d',
      name: 'Image to 3D',
      description: 'Convert to 3D model',
      status: 'idle'
    }
  ]

  // Add conditional stages
  if (generationType === 'avatar' && enableRigging) {
    stages.push({
      id: 'rigging',
      name: 'Auto-Rigging',
      description: 'Add skeleton & animations',
      status: 'idle'
    })
  }

  if (generationType === 'item' && enableRetexturing) {
    stages.push({
      id: 'retexturing',
      name: 'Material Variants',
      description: 'Create material variations',
      status: 'idle'
    })
  }

  if (enableSprites) {
    stages.push({
      id: 'sprites',
      name: '2D Sprites',
      description: 'Render sprites from multiple angles',
      status: 'idle'
    })
  }

  set((state) => {
    state.pipelineStages = stages
  })
}
```

#### Reset Form
```typescript
resetForm: () => set((state) => {
  state.assetName = ''
  state.description = ''
  state.customAssetTypePrompt = ''
  state.referenceImageMode = 'auto'
  state.referenceImageSource = null
  state.referenceImageUrl = null
  state.referenceImageDataUrl = null
})
```

### Persistence Configuration

```typescript
{
  name: 'generation-store',
  partialize: (state) => ({
    // User preferences
    generationType: state.generationType,
    gameStyle: state.gameStyle,
    customStyle: state.customStyle,
    customGamePrompt: state.customGamePrompt,
    customAssetTypes: state.customAssetTypes,
    assetTypePrompts: state.assetTypePrompts,

    // Pipeline config
    useGPT4Enhancement: state.useGPT4Enhancement,
    enableRetexturing: state.enableRetexturing,
    enableSprites: state.enableSprites,
    quality: state.quality,

    // Avatar config
    enableRigging: state.enableRigging,
    characterHeight: state.characterHeight,

    // Materials
    selectedMaterials: state.selectedMaterials,
    customMaterials: state.customMaterials,
    materialPromptOverrides: state.materialPromptOverrides,

    // UI preferences
    showAdvancedPrompts: state.showAdvancedPrompts,

    // Reference image (URL only, not data URL)
    referenceImageMode: state.referenceImageMode,
    referenceImageSource: state.referenceImageSource,
    referenceImageUrl: state.referenceImageUrl
  })
}
```

---

## useAssetsStore

Manages the asset browser UI state.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/store/useAssetsStore.ts`

### State Shape (14 Properties)

```typescript
interface AssetsState {
  // Selected Asset (1)
  selectedAsset: Asset | null

  // Filter States (3)
  searchTerm: string
  typeFilter: string
  materialFilter: string

  // Viewer States (10)
  showGroundPlane: boolean
  isWireframe: boolean
  isLightBackground: boolean
  showRetextureModal: boolean
  showRegenerateModal: boolean
  showDetailsPanel: boolean
  showEditModal: boolean
  showSpriteModal: boolean
  isTransitioning: boolean
  modelInfo: ModelInfo | null
  showAnimationView: boolean
}
```

### Actions (20 Methods)

#### Basic Setters (11)
```typescript
setSelectedAsset: (asset: Asset | null) => void
setSearchTerm: (term: string) => void
setTypeFilter: (type: string) => void
setMaterialFilter: (material: string) => void
setShowGroundPlane: (show: boolean) => void
setIsWireframe: (wireframe: boolean) => void
setIsLightBackground: (light: boolean) => void
setShowRetextureModal: (show: boolean) => void
setShowRegenerateModal: (show: boolean) => void
setShowDetailsPanel: (show: boolean) => void
setShowEditModal: (show: boolean) => void
setShowSpriteModal: (show: boolean) => void
setIsTransitioning: (transitioning: boolean) => void
setModelInfo: (info: ModelInfo | null) => void
setShowAnimationView: (show: boolean) => void
```

#### Toggle Actions (5)
```typescript
toggleGroundPlane: () => void
toggleWireframe: () => void
toggleBackground: () => void
toggleDetailsPanel: () => void
toggleAnimationView: () => void
```

#### Complex Actions (4)
```typescript
handleAssetSelect: (asset: Asset) => void
clearSelection: () => void
resetViewerSettings: () => void
closeAllModals: () => void
```

### Key Implementations

#### Handle Asset Select
```typescript
handleAssetSelect: (asset) => set((state) => {
  state.selectedAsset = asset
  state.modelInfo = null
  state.showAnimationView = false
})
```

#### Clear Selection
```typescript
clearSelection: () => set((state) => {
  state.selectedAsset = null
  state.modelInfo = null
  state.showAnimationView = false
})
```

#### Close All Modals
```typescript
closeAllModals: () => set((state) => {
  state.showRetextureModal = false
  state.showRegenerateModal = false
  state.showDetailsPanel = false
  state.showEditModal = false
  state.showSpriteModal = false
})
```

#### Get Filtered Assets (Computed)
```typescript
getFilteredAssets: (assets: Asset[]) => {
  const state = get()
  return assets.filter(asset => {
    // Search filter
    if (state.searchTerm && !asset.name.toLowerCase().includes(state.searchTerm.toLowerCase())) {
      return false
    }

    // Type filter
    if (state.typeFilter && asset.type !== state.typeFilter) {
      return false
    }

    // Material filter
    if (state.materialFilter) {
      // For variant assets
      if (asset.metadata.isVariant && asset.metadata.materialPreset) {
        if (asset.metadata.materialPreset.id !== state.materialFilter) {
          return false
        }
      }
      // Base assets don't have materials
      else if (asset.metadata.isBaseModel) {
        return false
      }
    }

    return true
  })
}
```

### Persistence Configuration

```typescript
{
  name: 'assets-store',
  partialize: (state) => ({
    // Only UI preferences
    showGroundPlane: state.showGroundPlane,
    isWireframe: state.isWireframe,
    isLightBackground: state.isLightBackground,
    searchTerm: state.searchTerm,
    typeFilter: state.typeFilter,
    materialFilter: state.materialFilter
  })
}
```

---

## useHandRiggingStore

Manages the hand rigging workflow state.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/store/useHandRiggingStore.ts`

### State Shape (16 Properties)

```typescript
interface HandRiggingState {
  // Asset management (3)
  selectedAvatar: Asset | null
  selectedFile: File | null
  modelUrl: string | null

  // Processing state (3)
  processingStage: ProcessingStage
  serviceInitialized: boolean
  isFitting: boolean

  // Hand data (2)
  leftHandData: HandData | null
  rightHandData: HandData | null

  // Results (2)
  riggingResult: HandRiggingResult | SimpleHandRiggingResult | null
  modelInfo: { vertices: number; faces: number; materials: number } | null

  // Configuration (1)
  useSimpleMode: boolean

  // Visualization (3)
  showSkeleton: boolean
  showDebugImages: boolean
  debugImages: Record<string, string>

  // UI state (1)
  showExportModal: boolean

  // Error handling (1)
  error: string | null
}
```

### Actions (28 Methods)

#### Basic Setters (16)
```typescript
setSelectedAvatar: (asset: Asset | null) => void
setSelectedFile: (file: File | null) => void
setModelUrl: (url: string | null) => void
setProcessingStage: (stage: ProcessingStage) => void
setServiceInitialized: (initialized: boolean) => void
setIsFitting: (fitting: boolean) => void
setLeftHandData: (data: HandData | null) => void
setRightHandData: (data: HandData | null) => void
setRiggingResult: (result: HandRiggingResult | SimpleHandRiggingResult | null) => void
setModelInfo: (info: ModelInfo | null) => void
setUseSimpleMode: (simple: boolean) => void
setShowSkeleton: (show: boolean) => void
setShowDebugImages: (show: boolean) => void
setDebugImages: (images: Record<string, string>) => void
setShowExportModal: (show: boolean) => void
setError: (error: string | null) => void
```

#### Complex Actions (6)
```typescript
reset: () => void
updateProcessingProgress: (stage: ProcessingStage, leftHand?: HandData, rightHand?: HandData) => void
toggleSkeleton: () => void
toggleDebugImages: () => void
```

#### Computed Values (4)
```typescript
getProcessingSteps: (useSimpleMode: boolean) => ProcessingStep[]
isProcessing: () => boolean
canStartProcessing: () => boolean
canExport: () => boolean
```

### Key Implementations

#### Set Model URL (with cleanup)
```typescript
setModelUrl: (url) => set((state) => {
  // Revoke old blob URL if it exists
  if (state.modelUrl && state.modelUrl.startsWith('blob:')) {
    URL.revokeObjectURL(state.modelUrl)
  }
  state.modelUrl = url
})
```

#### Reset
```typescript
reset: () => set((state) => {
  // Revoke blob URL
  if (state.modelUrl && state.modelUrl.startsWith('blob:')) {
    URL.revokeObjectURL(state.modelUrl)
  }

  state.selectedAvatar = null
  state.selectedFile = null
  state.modelUrl = null
  state.processingStage = 'idle'
  state.leftHandData = null
  state.rightHandData = null
  state.error = null
  state.showSkeleton = false
  state.riggingResult = null
  state.debugImages = {}
  state.modelInfo = null
  state.isFitting = false
})
```

#### Get Processing Steps
```typescript
getProcessingSteps: (useSimpleMode) => {
  const { processingStage } = get()

  return [
    {
      id: 'detecting-wrists',
      name: 'Detecting Wrist Bones',
      description: 'Finding existing wrist bones in the model',
      status: processingStage === 'detecting-wrists' ? 'active' :
              ['creating-bones', 'applying-weights', 'complete'].includes(processingStage)
                ? 'complete' : 'pending'
    },
    {
      id: 'creating-bones',
      name: useSimpleMode ? 'Creating Simple Hand Bones' : 'Detecting Hand Poses',
      description: useSimpleMode
        ? 'Adding palm and finger bones for basic grabbing'
        : 'Using AI to detect finger positions',
      status: processingStage === 'creating-bones' ? 'active' :
              ['applying-weights', 'complete'].includes(processingStage)
                ? 'complete' : 'pending'
    },
    {
      id: 'applying-weights',
      name: 'Applying Vertex Weights',
      description: 'Distributing weights for smooth deformation',
      status: processingStage === 'applying-weights' ? 'active' :
              processingStage === 'complete' ? 'complete' : 'pending'
    }
  ]
}
```

#### Can Export
```typescript
canExport: () => {
  const { processingStage, riggingResult } = get()
  return processingStage === 'complete' &&
         !!riggingResult &&
         !!riggingResult.riggedModel
}
```

### Persistence Configuration

```typescript
{
  name: 'hand-rigging-store',
  partialize: (state) => ({
    useSimpleMode: state.useSimpleMode,
    showDebugImages: state.showDebugImages
  })
}
```

---

## useArmorFittingStore

Manages armor and helmet fitting state, the most complex store.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/store/useArmorFittingStore.ts`

### State Shape (23 Properties)

```typescript
interface ArmorFittingState {
  // Selected items (4)
  selectedAvatar: Asset | null
  selectedArmor: Asset | null
  selectedHelmet: Asset | null
  assetTypeFilter: 'avatar' | 'armor' | 'helmet'

  // Fitting configuration (1)
  fittingConfig: FittingConfig

  // Helmet fitting parameters (6)
  helmetFittingMethod: 'auto' | 'manual'
  helmetSizeMultiplier: number
  helmetFitTightness: number
  helmetVerticalOffset: number
  helmetForwardOffset: number
  helmetRotation: { x: number; y: number; z: number }

  // Additional options (2)
  enableWeightTransfer: boolean
  equipmentSlot: string

  // Visualization (3)
  visualizationMode: 'none' | 'regions' | 'collisions' | 'weights' | 'hull'
  selectedBone: number
  showWireframe: boolean

  // Animation (2)
  currentAnimation: 'tpose' | 'walking' | 'running'
  isAnimationPlaying: boolean

  // Fitting results (7)
  bodyRegions: Map<string, BodyRegion> | null
  collisions: CollisionPoint[] | null
  isFitting: boolean
  fittingProgress: number
  isArmorFitted: boolean
  isArmorBound: boolean
  isHelmetFitted: boolean
  isHelmetAttached: boolean

  // UI state (1)
  showDebugger: boolean

  // Error handling (1)
  lastError: string | null

  // History (2)
  history: HistoryEntry[]
  historyIndex: number

  // Loading states (2)
  isExporting: boolean
  isSavingConfig: boolean
}
```

### Actions (40+ Methods)

#### Asset Selection (5)
```typescript
setSelectedAvatar: (avatar: Asset | null) => void
setSelectedArmor: (armor: Asset | null) => void
setSelectedHelmet: (helmet: Asset | null) => void
setAssetTypeFilter: (type: 'avatar' | 'armor' | 'helmet') => void
handleAssetSelect: (asset: Asset) => void
```

#### Fitting Configuration (2)
```typescript
setFittingConfig: (config: FittingConfig) => void
updateFittingConfig: (updates: Partial<FittingConfig>) => void
```

#### Helmet Fitting Parameters (7)
```typescript
setHelmetFittingMethod: (method: 'auto' | 'manual') => void
setHelmetSizeMultiplier: (multiplier: number) => void
setHelmetFitTightness: (tightness: number) => void
setHelmetVerticalOffset: (offset: number) => void
setHelmetForwardOffset: (offset: number) => void
setHelmetRotation: (rotation: { x: number; y: number; z: number }) => void
updateHelmetRotation: (axis: 'x' | 'y' | 'z', value: number) => void
resetHelmetSettings: () => void
```

#### Options (2)
```typescript
setEnableWeightTransfer: (enabled: boolean) => void
setEquipmentSlot: (slot: string, viewerRef?: React.RefObject<ViewerRef>) => void
```

#### Visualization (3)
```typescript
setVisualizationMode: (mode: VisualizationMode) => void
setSelectedBone: (bone: number) => void
setShowWireframe: (show: boolean) => void
```

#### Animation (3)
```typescript
setCurrentAnimation: (animation: Animation) => void
setIsAnimationPlaying: (playing: boolean) => void
toggleAnimation: () => void
```

#### Fitting Results (5)
```typescript
setBodyRegions: (regions: Map<string, BodyRegion> | null) => void
setCollisions: (collisions: CollisionPoint[] | null) => void
setIsFitting: (fitting: boolean) => void
setFittingProgress: (progress: number) => void
setIsHelmetFitted: (fitted: boolean) => void
setIsHelmetAttached: (attached: boolean) => void
```

#### UI State (1)
```typescript
setShowDebugger: (show: boolean) => void
```

#### Error Handling (2)
```typescript
setLastError: (error: string | null) => void
clearError: () => void
```

#### History Management (4)
```typescript
saveToHistory: () => void
undo: () => void
redo: () => void
canUndo: () => boolean
canRedo: () => boolean
```

#### Complex Actions (10)
```typescript
performFitting: (viewerRef: React.RefObject<ViewerRef>) => Promise<void>
bindArmorToSkeleton: (viewerRef: React.RefObject<ViewerRef>) => Promise<void>
resetFitting: () => void
performHelmetFitting: (viewerRef: React.RefObject<ViewerRef>) => Promise<void>
attachHelmetToHead: (viewerRef: React.RefObject<ViewerRef>) => Promise<void>
detachHelmetFromHead: (viewerRef: React.RefObject<ViewerRef>) => Promise<void>
exportFittedArmor: (viewerRef: React.RefObject<ViewerRef>) => Promise<void>
exportEquippedAvatar: (viewerRef: React.RefObject<ViewerRef>) => Promise<void>
resetScene: (viewerRef: React.RefObject<ViewerRef>) => void
saveConfiguration: () => Promise<void>
loadConfiguration: (file: File) => Promise<void>
resetAll: () => void
```

#### Selectors (4)
```typescript
isReadyToFit: () => boolean
hasUnsavedChanges: () => boolean
fittingMethod: () => FittingConfig['method']
currentProgress: () => string
```

### Key Implementations

#### Set Equipment Slot (Complex)
```typescript
setEquipmentSlot: (slot, viewerRef) => {
  const prevSlot = get().equipmentSlot

  // Clear meshes from scene
  if (viewerRef?.current && prevSlot !== slot) {
    if (prevSlot === 'Head' && slot !== 'Head') {
      viewerRef.current.clearHelmet()
    } else if (prevSlot === 'Spine2' && slot !== 'Spine2') {
      viewerRef.current.clearArmor()
    }
  }

  set((state) => {
    state.equipmentSlot = slot

    // Reset selection states
    if (slot === 'Head') {
      state.selectedArmor = null
      state.isArmorFitted = false
      state.isArmorBound = false
    } else if (slot === 'Spine2') {
      state.selectedHelmet = null
      state.isHelmetFitted = false
      state.isHelmetAttached = false
    }

    // Reset common states
    state.fittingProgress = 0
    state.isFitting = false
    state.lastError = null
    state.currentAnimation = 'tpose'
    state.isAnimationPlaying = false
    state.showWireframe = false

    // Update asset type filter
    if (state.selectedAvatar) {
      if (slot === 'Head') {
        state.assetTypeFilter = 'helmet'
      } else if (slot === 'Spine2') {
        state.assetTypeFilter = 'armor'
      }
    }
  })
}
```

#### Perform Fitting
```typescript
performFitting: async (viewerRef) => {
  const { selectedAvatar, selectedArmor, fittingConfig, enableWeightTransfer, isFitting } = get()

  if (!viewerRef.current || !selectedAvatar || !selectedArmor || isFitting) return

  set((state) => {
    state.isFitting = true
    state.fittingProgress = 0
    state.lastError = null
  })

  try {
    // Create parameters
    const params = {
      ...fittingConfig,
      iterations: Math.min(fittingConfig.iterations, 10),
      stepSize: fittingConfig.stepSize || 0.1,
      targetOffset: fittingConfig.targetOffset || 0.01
    }

    // Perform fitting
    set((state) => { state.fittingProgress = 50 })
    viewerRef.current.performFitting(params)

    await new Promise(resolve => setTimeout(resolve, 1000))
    set((state) => { state.fittingProgress = 80 })

    // Weight transfer if enabled
    if (enableWeightTransfer) {
      set((state) => { state.fittingProgress = 90 })
      viewerRef.current.transferWeights()
      await new Promise(resolve => setTimeout(resolve, 800))
    }

    set((state) => {
      state.fittingProgress = 100
      if (state.equipmentSlot === 'Spine2') {
        state.isArmorFitted = true
      }
    })

    get().saveToHistory()
  } catch (error) {
    set((state) => {
      state.lastError = `Fitting failed: ${error.message}`
    })
  } finally {
    setTimeout(() => {
      set((state) => { state.isFitting = false })
    }, 100)
  }
}
```

#### Save to History
```typescript
saveToHistory: () => set((state) => {
  const entry: HistoryEntry = {
    fittingConfig: { ...state.fittingConfig },
    timestamp: Date.now()
  }

  // Remove future entries
  state.history = state.history.slice(0, state.historyIndex + 1)
  state.history.push(entry)
  state.historyIndex = state.history.length - 1

  // Limit size
  if (state.history.length > 50) {
    state.history = state.history.slice(-50)
    state.historyIndex = state.history.length - 1
  }
})
```

#### Reset Scene
```typescript
resetScene: (viewerRef) => {
  const { equipmentSlot } = get()

  if (!viewerRef?.current) return

  // Reset transforms
  viewerRef.current.resetTransform()

  set((state) => {
    // Reset common states
    state.fittingProgress = 0
    state.isFitting = false
    state.lastError = null
    state.showWireframe = false
    state.currentAnimation = 'tpose'
    state.isAnimationPlaying = false

    // Reset based on equipment slot
    if (equipmentSlot === 'Head') {
      state.isHelmetFitted = false
      state.isHelmetAttached = false
      state.helmetFittingMethod = 'auto'
      state.helmetSizeMultiplier = 1.0
      state.helmetFitTightness = 1.0
      state.helmetVerticalOffset = 0
      state.helmetForwardOffset = 0
      state.helmetRotation = { x: 0, y: 0, z: 0 }
    } else if (equipmentSlot === 'Spine2') {
      state.isArmorFitted = false
      state.isArmorBound = false
      state.bodyRegions = null
      state.collisions = null
      // Reset to default config
      state.fittingConfig = defaultFittingConfig
    }
  })
}
```

### Convenience Selectors

Exported for easier component usage:

```typescript
export const useIsReadyToFit = () =>
  useArmorFittingStore((state) => state.isReadyToFit())

export const useHasUnsavedChanges = () =>
  useArmorFittingStore((state) => state.hasUnsavedChanges())

export const useFittingMethod = () =>
  useArmorFittingStore((state) => state.fittingMethod())

export const useCurrentProgress = () =>
  useArmorFittingStore((state) => state.currentProgress())
```

### Persistence Configuration

```typescript
{
  name: 'armor-fitting-storage',
  partialize: (state) => ({
    fittingConfig: state.fittingConfig,
    enableWeightTransfer: state.enableWeightTransfer,
    equipmentSlot: state.equipmentSlot,
    visualizationMode: state.visualizationMode,
    showWireframe: state.showWireframe
  })
}
```

---

## useDebuggerStore

Manages the mesh fitting debugger state.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/store/useDebuggerStore.ts`

### State Shape (27 Properties)

```typescript
interface DebuggerState {
  // View and Demo Settings (3)
  activeDemo: string
  viewMode: 'sphereCube' | 'avatarArmor' | 'helmetFitting'
  showWireframe: boolean

  // Model Selection (6)
  selectedAvatar: ModelOption
  selectedArmor: ModelOption
  selectedHelmet: ModelOption
  selectedAvatarPath: string
  selectedArmorPath: string
  selectedHelmetPath: string

  // Animation Settings (2)
  currentAnimation: 'tpose' | 'walking' | 'running'
  isAnimationPlaying: boolean

  // Fitting Parameters (1)
  fittingParameters: MeshFittingParameters

  // Helmet Fitting Settings (6)
  helmetFittingMethod: 'auto' | 'manual'
  helmetSizeMultiplier: number
  helmetFitTightness: number
  helmetVerticalOffset: number
  helmetForwardOffset: number
  helmetRotation: { x: number; y: number; z: number }

  // Debug Visualization (6)
  showHeadBounds: boolean
  showCollisionDebug: boolean
  showHull: boolean
  showDebugArrows: boolean
  debugArrowDensity: number
  debugColorMode: 'direction' | 'magnitude' | 'sidedness'

  // Processing States (6)
  isProcessing: boolean
  isArmorFitted: boolean
  isArmorBound: boolean
  isHelmetFitted: boolean
  isHelmetAttached: boolean
  boundArmorMesh: THREE.SkinnedMesh | null

  // Error Handling (1)
  lastError: string | null

  // History (2)
  canUndo: boolean
  canRedo: boolean
}
```

### Actions (40+ Methods)

The debugger store mirrors many armor fitting actions but adds debugging-specific features.

#### View and Demo (4)
```typescript
setActiveDemo: (demo: string) => void
setViewMode: (mode: 'sphereCube' | 'avatarArmor' | 'helmetFitting') => void
toggleWireframe: () => void
setShowWireframe: (show: boolean) => void
```

#### Model Selection (4)
```typescript
setSelectedAvatar: (avatar: ModelOption) => void
setSelectedArmor: (armor: ModelOption) => void
setSelectedHelmet: (helmet: ModelOption) => void
updateModelPaths: () => void
```

#### Animation (3)
```typescript
setCurrentAnimation: (animation: Animation) => void
setIsAnimationPlaying: (playing: boolean) => void
toggleAnimation: () => void
```

#### Fitting Parameters (2)
```typescript
updateFittingParameters: (params: Partial<MeshFittingParameters>) => void
resetFittingParameters: () => void
```

#### Helmet Fitting (7)
```typescript
setHelmetFittingMethod: (method: 'auto' | 'manual') => void
setHelmetSizeMultiplier: (multiplier: number) => void
setHelmetFitTightness: (tightness: number) => void
setHelmetVerticalOffset: (offset: number) => void
setHelmetForwardOffset: (offset: number) => void
setHelmetRotation: (rotation: Partial<HelmetRotation>) => void
resetHelmetSettings: () => void
```

#### Debug Visualization (7)
```typescript
setShowHeadBounds: (show: boolean) => void
setShowCollisionDebug: (show: boolean) => void
setShowHull: (show: boolean) => void
setShowDebugArrows: (show: boolean) => void
setDebugArrowDensity: (density: number) => void
setDebugColorMode: (mode: ColorMode) => void
toggleDebugVisualization: (type: VisualizationType) => void
```

#### Processing States (6)
```typescript
setIsProcessing: (processing: boolean) => void
setIsArmorFitted: (fitted: boolean) => void
setIsArmorBound: (bound: boolean) => void
setIsHelmetFitted: (fitted: boolean) => void
setIsHelmetAttached: (attached: boolean) => void
setBoundArmorMesh: (mesh: THREE.SkinnedMesh | null) => void
resetProcessingStates: () => void
```

#### Error Handling (2)
```typescript
setError: (error: string | null) => void
clearError: () => void
```

#### Complex Actions (3)
```typescript
resetDebugger: () => void
saveDebugConfiguration: () => void
loadDebugConfiguration: (config: DebugConfiguration) => void
```

#### Selectors (3)
```typescript
isReadyToFit: () => boolean
getActiveModelName: () => string
getCurrentDebugInfo: () => string
```

### Persistence Configuration

```typescript
{
  name: 'mesh-fitting-debugger',
  partialize: (state) => ({
    showWireframe: state.showWireframe,
    fittingParameters: state.fittingParameters,
    helmetFittingMethod: state.helmetFittingMethod,
    helmetSizeMultiplier: state.helmetSizeMultiplier,
    helmetFitTightness: state.helmetFitTightness,
    helmetVerticalOffset: state.helmetVerticalOffset,
    helmetForwardOffset: state.helmetForwardOffset,
    helmetRotation: state.helmetRotation,
    showHeadBounds: state.showHeadBounds,
    showCollisionDebug: state.showCollisionDebug,
    showHull: state.showHull,
    showDebugArrows: state.showDebugArrows,
    debugArrowDensity: state.debugArrowDensity,
    debugColorMode: state.debugColorMode
  })
}
```

---

## Middleware Configuration

### Immer Middleware

Allows writing mutable-style updates that are converted to immutable:

```typescript
import { immer } from 'zustand/middleware/immer'

// Without immer
set((state) => ({ count: state.count + 1 }))

// With immer
set((state) => {
  state.count += 1
})

// Complex nested updates
set((state) => {
  state.pipelineStages[0].status = 'active'
  state.selectedMaterials.push('bronze')
})
```

### Subscribe with Selector

Enables fine-grained subscriptions for performance:

```typescript
import { subscribeWithSelector } from 'zustand/middleware'

// Subscribe to specific field
useStore.subscribe(
  (state) => state.isGenerating,
  (isGenerating) => {
    console.log('Generation state changed:', isGenerating)
  }
)

// Multiple selectors
useStore.subscribe(
  (state) => [state.assetName, state.assetType],
  ([name, type]) => {
    console.log(`Asset: ${name} (${type})`)
  }
)
```

### Persist Middleware

Automatic localStorage persistence:

```typescript
import { persist } from 'zustand/middleware'

persist(
  storeCreator,
  {
    name: 'store-key', // localStorage key

    // Select fields to persist
    partialize: (state) => ({
      userPreferences: state.userPreferences,
      recentItems: state.recentItems
    }),

    // Custom storage (default: localStorage)
    storage: createJSONStorage(() => sessionStorage),

    // Version for migrations
    version: 1,
    migrate: (persistedState, version) => {
      if (version === 0) {
        // Migrate from v0 to v1
        return { ...persistedState, newField: 'default' }
      }
      return persistedState
    }
  }
)
```

### DevTools Middleware

Redux DevTools integration:

```typescript
import { devtools } from 'zustand/middleware'

devtools(
  storeCreator,
  {
    name: 'StoreName', // DevTools label
    enabled: process.env.NODE_ENV === 'development'
  }
)
```

---

## Best Practices

### 1. Selector Pattern

Avoid unnecessary re-renders by selecting specific fields:

```typescript
// ❌ Bad - re-renders on any state change
const { assetName, assetType, description, ... } = useGenerationStore()

// ✅ Good - re-renders only when specific fields change
const assetName = useGenerationStore((state) => state.assetName)
const assetType = useGenerationStore((state) => state.assetType)
```

### 2. Computed Values

Use getter methods for derived state:

```typescript
// In store
interface State {
  assets: Asset[]
  searchTerm: string

  // Computed
  getFilteredAssets: () => Asset[]
}

// Implementation
getFilteredAssets: () => {
  const { assets, searchTerm } = get()
  return assets.filter(a => a.name.includes(searchTerm))
}

// Usage
const filteredAssets = useAssetsStore((state) =>
  state.getFilteredAssets()
)
```

### 3. Action Composition

Compose complex actions from simpler ones:

```typescript
// Simple actions
setAssetName: (name) => set({ assetName: name })
setAssetType: (type) => set({ assetType: type })

// Composite action
resetForm: () => {
  get().setAssetName('')
  get().setAssetType('weapon')
  // ... other resets
}
```

### 4. Async Actions

Handle async operations in actions:

```typescript
loadAssets: async () => {
  set({ isLoading: true, error: null })

  try {
    const assets = await AssetService.listAssets()
    set({ assets, isLoading: false })
  } catch (error) {
    set({
      error: error.message,
      isLoading: false
    })
  }
}
```

### 5. Transient Updates

Use `setState` without subscription for transient state:

```typescript
// Won't trigger subscribers
useStore.setState({ tempValue: 123 }, true)
```

### 6. Store Slices

For very large stores, consider splitting into slices:

```typescript
const createUserSlice = (set, get) => ({
  user: null,
  setUser: (user) => set({ user })
})

const createSettingsSlice = (set, get) => ({
  theme: 'dark',
  setTheme: (theme) => set({ theme })
})

const useStore = create((set, get) => ({
  ...createUserSlice(set, get),
  ...createSettingsSlice(set, get)
}))
```

### 7. Performance Optimization

```typescript
// Use shallow equality for object selectors
import { shallow } from 'zustand/shallow'

const { assetName, assetType } = useGenerationStore(
  (state) => ({ assetName: state.assetName, assetType: state.assetType }),
  shallow
)
```

---

## Summary

Asset Forge's Zustand stores provide:

- **Type-safe state**: Full TypeScript coverage
- **Modular design**: 5 domain-specific stores
- **Rich functionality**: 150+ actions across all stores
- **Persistence**: Automatic localStorage sync
- **DevTools**: Full debugging support
- **Performance**: Selective subscriptions minimize re-renders
- **Immutability**: Immer middleware for clean updates

The store architecture enables complex workflows while maintaining clean separation of concerns and excellent developer experience.
