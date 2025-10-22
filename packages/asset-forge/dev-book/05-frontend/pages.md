# Page Architecture

This document describes the 5 main pages in Asset Forge, their structure, workflows, navigation context, and routing configuration.

## Table of Contents

1. [Overview](#overview)
2. [GenerationPage](#generationpage)
3. [AssetsPage](#assetspage)
4. [EquipmentPage](#equipmentpage)
5. [HandRiggingPage](#handriggingpage)
6. [ArmorFittingPage](#armorfittingpage)
7. [VoiceStandalonePage](#voicestandalonepage)
8. [Navigation System](#navigation-system)
9. [Routing Configuration](#routing-configuration)
10. [Page Transitions](#page-transitions)

---

## Overview

Asset Forge is organized as a single-page application with 6 main feature pages:

```
App (Root)
├── GenerationPage - AI asset generation workflow
├── AssetsPage - Asset library browser
├── EquipmentPage - Equipment positioning tool
├── HandRiggingPage - Hand rigging workflow
├── ArmorFittingPage - Armor fitting workflow
└── VoiceStandalonePage - Voice generation experimentation
```

### Common Page Structure

All pages follow a consistent structure:

```typescript
export const PageName: React.FC<PageProps> = ({
  onClose,
  onNavigateToX
}) => {
  // 1. State management (Zustand stores)
  const { state, actions } = usePageStore()

  // 2. Local state and refs
  const [localState, setLocalState] = useState()
  const viewerRef = useRef<ViewerRef>(null)

  // 3. Custom hooks
  const { hookData } = useCustomHook()

  // 4. Effects
  useEffect(() => {
    // Initialization, subscriptions
  }, [deps])

  // 5. Event handlers
  const handleAction = () => {
    // Logic
  }

  // 6. Render
  return (
    <div className="page-container">
      {/* Page content */}
    </div>
  )
}
```

### Page Container Styling

Standard container classes:

```css
.page-container {
  @apply fixed inset-0 pt-[60px] bg-bg-primary overflow-y-auto;
}

.page-container-no-padding {
  @apply fixed inset-0 pt-[60px] bg-bg-primary flex overflow-hidden;
}
```

---

## GenerationPage

The AI asset generation workflow, supporting both item and avatar creation.

### File Location

`packages/asset-forge/src/pages/GenerationPage.tsx`

### Interface

```typescript
interface GenerationPageProps {
  onClose?: () => void
  onNavigateToAssets?: () => void
  onNavigateToAsset?: (assetId: string) => void
}
```

### Workflow Overview

```
┌─────────────────────┐
│ Type Selection      │ - Choose Item or Avatar
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Configuration View  │ - Form inputs, options
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Progress View       │ - Real-time pipeline status
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Results View        │ - 3D preview, variants, actions
└─────────────────────┘
```

### View States

The page has 3 main views controlled by `activeView` state:

#### 1. Configuration View (`activeView === 'config'`)

**Layout**: Two-column grid

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
  {/* Main Form (2 columns) */}
  <div className="lg:col-span-2 space-y-8">
    <AssetDetailsCard />
    <AdvancedPromptsCard />
  </div>

  {/* Sidebar (1 column) */}
  <div className="space-y-8">
    <PipelineOptionsCard />
    {enableRetexturing && <MaterialVariantsCard />}
    {generationType === 'avatar' && <AvatarRiggingOptionsCard />}
    <ReferenceImageCard />
    <Button onClick={handleStartGeneration}>
      Start Generation
    </Button>
  </div>
</div>
```

**Components**:
- `AssetDetailsCard`: Name, type, description, game style
- `AdvancedPromptsCard`: Custom prompts and asset type editor
- `PipelineOptionsCard`: GPT-4, retexturing, sprites, quality toggles
- `MaterialVariantsCard`: Material preset selection (items only)
- `AvatarRiggingOptionsCard`: Character height (avatars only)
- `ReferenceImageCard`: Reference image upload/URL

**State Management**:
```typescript
const {
  // Form state
  assetName, assetType, description,
  gameStyle, customStyle,

  // Pipeline config
  useGPT4Enhancement, enableRetexturing,
  enableSprites, enableRigging, quality,

  // Materials
  selectedMaterials, customMaterials,
  materialPresets,

  // Actions
  setAssetName, setDescription,
  toggleMaterialSelection,
  handleStartGeneration
} = useGenerationStore()
```

**Validation**:
```typescript
const handleStartGeneration = async () => {
  if (!assetName || !description) {
    notify.warning('Please fill in all required fields')
    return
  }

  // Build configuration
  const config = buildGenerationConfig({
    assetName,
    assetType,
    description,
    generationType,
    // ... other options
  })

  // Start pipeline
  const pipelineId = await apiClient.startPipeline(config)
  setCurrentPipelineId(pipelineId)
  setActiveView('progress')
}
```

#### 2. Progress View (`activeView === 'progress'`)

Real-time visualization of the generation pipeline.

```tsx
<div className="space-y-8">
  <PipelineProgressCard
    pipelineStages={pipelineStages}
    generationType={generationType}
    isGenerating={isGenerating}
    onBackToConfig={() => setActiveView('config')}
  />

  <GenerationTimeline />
</div>
```

**Pipeline Stages**:
```typescript
const stages: PipelineStage[] = [
  {
    id: 'text-input',
    name: 'Text Input',
    status: 'active' | 'completed' | 'failed' | 'skipped'
  },
  {
    id: 'gpt4-enhancement',
    name: 'GPT-4 Enhancement',
    status: useGPT4Enhancement ? 'idle' : 'skipped'
  },
  {
    id: 'image-generation',
    name: 'Image Generation',
    status: 'idle'
  },
  {
    id: 'image-to-3d',
    name: 'Image to 3D',
    status: 'idle'
  }
]
```

**Real-time Updates**:
```typescript
// usePipelineStatus hook polls for status
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await apiClient.fetchPipelineStatus(pipelineId)

    // Map backend stages to UI stages
    Object.entries(status.stages).forEach(([stageName, data]) => {
      updatePipelineStage(mapStageId(stageName), data.status)
    })

    // Handle completion
    if (status.status === 'completed') {
      setIsGenerating(false)
      setActiveView('results')
    }
  }, 1500)

  return () => clearInterval(interval)
}, [pipelineId])
```

#### 3. Results View (`activeView === 'results'`)

Browse and interact with generated assets.

```tsx
<div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
  {/* Asset List (1 column) */}
  <GeneratedAssetsList
    generatedAssets={generatedAssets}
    selectedAsset={selectedAsset}
    onAssetSelect={setSelectedAsset}
  />

  {/* Asset Details (3 columns) */}
  <div className="lg:col-span-3 space-y-8">
    <AssetPreviewCard selectedAsset={selectedAsset} />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Material variants for items */}
      {generationType === 'item' && selectedAsset.variants && (
        <MaterialVariantsDisplay variants={selectedAsset.variants} />
      )}

      {/* Sprite generation for items */}
      {generationType === 'item' && (
        <SpritesDisplay
          selectedAsset={selectedAsset}
          onGenerateSprites={handleGenerateSprites}
        />
      )}
    </div>

    <AssetActionsCard
      onGenerateNew={() => setActiveView('config')}
    />
  </div>
</div>
```

**Loading Existing Assets**:
```typescript
useEffect(() => {
  if (activeView === 'results' && generatedAssets.length === 0) {
    const loadAssets = async () => {
      const assets = await AssetService.listAssets()

      // Transform to expected format
      const transformed = assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        modelUrl: `/api/assets/${asset.id}/model`,
        conceptArtUrl: `/api/assets/${asset.id}/concept-art.png`,
        variants: asset.metadata?.variants,
        // ...
      }))

      setGeneratedAssets(transformed)
    }

    loadAssets()
  }
}, [activeView])
```

### Data Flow

```
User Input (Form)
      ↓
buildGenerationConfig()
      ↓
apiClient.startPipeline(config)
      ↓
Poll Pipeline Status (1.5s interval)
      ↓
Update UI Stages
      ↓
On Completion: Create GeneratedAsset
      ↓
Navigate to Results View
```

### Key Features

1. **Type Selection Guard**: Must choose item/avatar before showing form
2. **Dynamic Form**: Different fields based on generation type
3. **Real-time Progress**: Live pipeline status updates
4. **Asset Persistence**: Results loaded from backend on next visit
5. **Sprite Generation**: On-demand sprite rendering for items
6. **Material Variants**: Multiple texture versions for items

---

## AssetsPage

The asset library browser for viewing and managing all generated assets.

### File Location

`packages/asset-forge/src/pages/AssetsPage.tsx`

### Layout Structure

```tsx
<div className="page-container-no-padding flex-col">
  <div className="flex-1 flex gap-4 p-4 overflow-hidden">
    {/* Sidebar */}
    <div className="flex flex-col gap-3 w-72">
      <AssetFilters />
      <AssetList assets={filteredAssets} />
    </div>

    {/* Main Viewer */}
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex-1 relative rounded-xl border">
        {selectedAsset ? (
          <>
            <ThreeViewer
              modelUrl={`/api/assets/${selectedAsset.id}/model`}
              isWireframe={isWireframe}
              showGroundPlane={showGroundPlane}
            />
            <ViewerControls />
            <AssetDetailsPanel />
          </>
        ) : (
          <EmptyAssetState />
        )}
      </div>
    </div>
  </div>
</div>
```

### Components Breakdown

#### Sidebar (w-72, 18rem)

**AssetFilters**:
```typescript
// Search and filter controls
<div className="card">
  <Input
    placeholder="Search assets..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />

  <Select
    label="Type"
    value={typeFilter}
    onChange={(e) => setTypeFilter(e.target.value)}
  >
    <option value="">All Types</option>
    <option value="weapon">Weapons</option>
    <option value="armor">Armor</option>
    {/* ... */}
  </Select>

  <Select
    label="Material"
    value={materialFilter}
    onChange={(e) => setMaterialFilter(e.target.value)}
  >
    <option value="">All Materials</option>
    {materialPresets.map(preset => (
      <option value={preset.id}>{preset.displayName}</option>
    ))}
  </Select>
</div>
```

**AssetList**:
```typescript
// Scrollable list of asset cards
<div className="flex-1 overflow-y-auto space-y-2">
  {filteredAssets.map(asset => (
    <AssetCard
      key={asset.id}
      asset={asset}
      isSelected={selectedAsset?.id === asset.id}
      onClick={() => handleAssetSelect(asset)}
    >
      {/* Thumbnail, name, type badge, metadata */}
    </AssetCard>
  ))}
</div>
```

#### Main Viewer Area

**ThreeViewer Integration**:
```typescript
const viewerRef = useRef<ThreeViewerRef>(null)

<ThreeViewer
  ref={viewerRef}
  modelUrl={selectedAsset.hasModel ? modelUrl : undefined}
  isWireframe={isWireframe}
  showGroundPlane={showGroundPlane}
  isLightBackground={isLightBackground}
  lightMode={true}
  onModelLoad={(info) => setModelInfo(info)}
  assetInfo={{
    name: selectedAsset.name,
    type: selectedAsset.type,
    tier: selectedAsset.metadata.tier,
    format: selectedAsset.metadata.format
  }}
/>
```

**ViewerControls** (Overlay):
```typescript
// Positioned top-right
<div className="absolute top-4 right-4 flex gap-2">
  {/* Character animation toggle */}
  {asset.type === 'character' && (
    <button onClick={toggleAnimationView}>
      <Activity size={20} />
    </button>
  )}

  {/* Edit */}
  <button onClick={() => setShowEditModal(true)}>
    <Edit3 size={20} />
  </button>

  {/* Details panel */}
  <button onClick={toggleDetailsPanel}>
    <Layers size={20} />
  </button>

  {/* Viewer controls */}
  <button onClick={() => viewerRef.current?.resetCamera()}>
    <RotateCw size={20} />
  </button>

  {/* Download */}
  <button onClick={handleDownload}>
    <Download size={20} />
  </button>

  {/* More options... */}
</div>
```

**AssetDetailsPanel** (Slide-out):
```typescript
<div className={`
  absolute top-0 right-0 h-full w-80
  bg-bg-secondary border-l
  transform transition-transform duration-300
  ${isOpen ? 'translate-x-0' : 'translate-x-full'}
`}>
  <div className="p-4 space-y-4">
    <h3>{asset.name}</h3>

    {/* Metadata */}
    <div>
      <Label>Type</Label>
      <Value>{asset.type}</Value>
    </div>

    {/* Model info */}
    {modelInfo && (
      <div>
        <Label>Vertices</Label>
        <Value>{modelInfo.vertices.toLocaleString()}</Value>
      </div>
    )}

    {/* Actions */}
    <Button onClick={onRetexture}>Retexture</Button>
    <Button onClick={onRegenerate}>Regenerate</Button>
    <Button onClick={onGenerateSprites}>Sprites</Button>
  </div>
</div>
```

### State Management

```typescript
const {
  selectedAsset,
  showGroundPlane,
  isWireframe,
  isLightBackground,
  modelInfo,
  showAnimationView,
  // Filters
  searchTerm,
  typeFilter,
  materialFilter,
  // Actions
  setSelectedAsset,
  toggleGroundPlane,
  toggleWireframe,
  setModelInfo,
  // Computed
  getFilteredAssets
} = useAssetsStore()
```

### Asset Actions Hook

```typescript
const {
  handleViewerReset,
  handleDownload,
  handleDeleteAsset,
  handleSaveAsset
} = useAssetActions({
  viewerRef,
  reloadAssets,
  forceReload,
  assets
})

// Reset camera
const handleViewerReset = () => {
  viewerRef.current?.resetCamera()
}

// Download (actually takes screenshot)
const handleDownload = () => {
  if (selectedAsset?.hasModel) {
    viewerRef.current?.takeScreenshot()
  }
}

// Delete with variants option
const handleDeleteAsset = async (asset, includeVariants) => {
  // Clear selection first
  if (selectedAsset?.id === asset.id) {
    clearSelection()
  }

  // Delete via API
  await apiFetch(`/api/assets/${asset.id}?includeVariants=${includeVariants}`, {
    method: 'DELETE'
  })

  // Reload list
  await forceReload()
}
```

### Modal Workflows

#### Edit Modal
```typescript
<AssetEditModal
  asset={selectedAsset}
  isOpen={showEditModal}
  onClose={() => setShowEditModal(false)}
  onSave={handleSaveAsset}
  onDelete={handleDeleteAsset}
  hasVariants={assets.some(a =>
    a.metadata.isVariant &&
    a.metadata.parentBaseModel === selectedAsset.id
  )}
/>
```

#### Retexture Modal
```typescript
<RetextureModal
  asset={selectedAsset}
  onClose={() => setShowRetextureModal(false)}
  onComplete={() => {
    setShowRetextureModal(false)
    reloadAssets()
  }}
/>
```

#### Sprite Generation Modal
```typescript
<SpriteGenerationModal
  asset={selectedAsset}
  onClose={() => setShowSpriteModal(false)}
  onComplete={() => {
    setShowSpriteModal(false)
    reloadAssets()
  }}
/>
```

### Animation View Toggle

For character assets, toggle between 3D model view and animation playback:

```typescript
const [showAnimationView, setShowAnimationView] = useState(false)

// Render both viewers, fade inactive one
<div className="absolute inset-0">
  {/* 3D Model Viewer */}
  <div className={`
    absolute inset-0 transition-opacity duration-200
    ${showAnimationView ? 'opacity-0 pointer-events-none' : 'opacity-100'}
  `}>
    <ThreeViewer {...props} />
  </div>

  {/* Animation Player */}
  <div className={`
    absolute inset-0 transition-opacity duration-200
    ${showAnimationView ? 'opacity-100' : 'opacity-0 pointer-events-none'}
  `}>
    <AnimationPlayer
      modelUrl={riggedModelPath}
      animations={asset.metadata.animations}
    />
  </div>
</div>
```

---

## EquipmentPage

Tool for positioning hand-held items on creature avatars.

### File Location

`packages/asset-forge/src/pages/EquipmentPage.tsx`

### Layout

```tsx
<div className="page-container">
  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
    {/* Controls Sidebar (1 column) */}
    <div className="space-y-6">
      <AssetSelectionPanel />
      <EquipmentControls />
      <ExportOptionsPanel />
    </div>

    {/* Viewer (3 columns) */}
    <div className="lg:col-span-3">
      <ViewportSection>
        <EquipmentViewer
          ref={viewerRef}
          selectedCreature={selectedCreature}
          selectedWeapon={selectedWeapon}
        />
      </ViewportSection>
    </div>
  </div>
</div>
```

### Equipment Viewer

```typescript
export interface EquipmentViewerRef {
  resetCamera: () => void
  resetTransform: () => void
  exportModel: () => Promise<ArrayBuffer>
}

const EquipmentViewer = forwardRef<EquipmentViewerRef, Props>(
  ({ selectedCreature, selectedWeapon, onModelLoad }, ref) => {
    const sceneRef = useRef<THREE.Scene>(null)
    const creatureMeshRef = useRef<THREE.Object3D>(null)
    const weaponMeshRef = useRef<THREE.Object3D>(null)

    // Load creature
    useEffect(() => {
      if (!selectedCreature) return

      const loader = new GLTFLoader()
      loader.load(creatureModelUrl, (gltf) => {
        creatureMeshRef.current = gltf.scene
        sceneRef.current?.add(gltf.scene)
      })
    }, [selectedCreature])

    // Load weapon
    useEffect(() => {
      if (!selectedWeapon) return

      const loader = new GLTFLoader()
      loader.load(weaponModelUrl, (gltf) => {
        weaponMeshRef.current = gltf.scene

        // Attach to hand bone
        const handBone = findBoneByName(creatureMeshRef.current, 'RightHand')
        handBone?.add(gltf.scene)
      })
    }, [selectedWeapon])

    // Export method
    useImperativeHandle(ref, () => ({
      exportModel: async () => {
        const exporter = new GLTFExporter()
        return new Promise((resolve) => {
          exporter.parse(
            sceneRef.current,
            (result) => resolve(result as ArrayBuffer),
            { binary: true }
          )
        })
      }
    }))

    return <div ref={containerRef} />
  }
)
```

### Equipment Controls

```typescript
<EquipmentControls>
  {/* Slot Selection */}
  <EquipmentSlotSelector
    slot={equipmentSlot}
    onChange={setEquipmentSlot}
    options={['RightHand', 'LeftHand']}
  />

  {/* Position */}
  <PositionControls
    position={weaponPosition}
    onChange={setWeaponPosition}
  />

  {/* Rotation */}
  <OrientationControls
    rotation={weaponRotation}
    onChange={setWeaponRotation}
  />

  {/* Creature Size */}
  <CreatureSizeControls
    scale={creatureScale}
    onChange={setCreatureScale}
  />

  {/* Auto-detect grip */}
  <GripDetectionPanel
    onDetect={handleAutoDetectGrip}
  />
</EquipmentControls>
```

### Workflow

1. **Select Creature**: Choose avatar from asset list
2. **Select Weapon**: Choose weapon from asset list
3. **Auto-Position**: Weapon attached to hand bone
4. **Manual Adjustment**: Fine-tune position, rotation, scale
5. **Export**: Download combined GLB file

---

## HandRiggingPage

Workflow for adding hand bones to avatar models.

### File Location

`packages/asset-forge/src/pages/HandRiggingPage.tsx`

### Layout

```tsx
<div className="page-container">
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Left: Input & Controls */}
    <div className="space-y-6">
      <HandUploadZone onFileSelect={handleFileSelect} />
      <HandAvatarSelector />
      <HandRiggingControls />
      <ModelStats modelInfo={modelInfo} />
      <HelpSection />
    </div>

    {/* Center: 3D Viewer */}
    <div className="lg:col-span-2 space-y-6">
      <ModelViewer
        modelUrl={modelUrl}
        showSkeleton={showSkeleton}
      />

      {processingStage !== 'idle' && (
        <HandProcessingSteps
          steps={getProcessingSteps(useSimpleMode)}
          currentStage={processingStage}
        />
      )}

      {processingStage === 'complete' && (
        <RiggingResults
          leftHandData={leftHandData}
          rightHandData={rightHandData}
        />
      )}

      {showDebugImages && (
        <DebugImages debugImages={debugImages} />
      )}
    </div>
  </div>
</div>
```

### Processing Workflow

```
Upload/Select Avatar
        ↓
Initialize Service
        ↓
┌───────────────────────┐
│ 1. Detect Wrist Bones │
└───────────┬───────────┘
            ↓
┌───────────────────────┐
│ 2. Create Hand Bones  │ - Simple: Palm + Fingers
└───────────┬───────────┘   Advanced: Full finger joints
            ↓
┌───────────────────────┐
│ 3. Apply Weights      │
└───────────┬───────────┘
            ↓
        Complete
```

### State Management

```typescript
const {
  selectedAvatar,
  selectedFile,
  modelUrl,
  processingStage,
  serviceInitialized,
  leftHandData,
  rightHandData,
  riggingResult,
  useSimpleMode,
  showSkeleton,
  showDebugImages,
  debugImages,
  error,
  // Actions
  setSelectedAvatar,
  setProcessingStage,
  setRiggingResult,
  reset,
  toggleSkeleton
} = useHandRiggingStore()
```

### Processing Steps Display

```typescript
<HandProcessingSteps
  steps={[
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
  ]}
/>
```

### Results Display

```typescript
<RiggingResults
  leftHandData={leftHandData}
  rightHandData={rightHandData}
/>

// Displays:
// - Finger count detected
// - Confidence score
// - Bones added count
// - Preview of rigged hands
```

### Export Modal

```typescript
<ExportModal
  isOpen={showExportModal}
  onClose={() => setShowExportModal(false)}
  onExport={(options) => {
    const { format, includeOriginal } = options

    // Export rigged model
    const arrayBuffer = riggingResult.riggedModel
    const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' })
    saveAs(blob, `${asset.name}_rigged.glb`)
  }}
/>
```

---

## ArmorFittingPage

Advanced workflow for fitting armor and helmets to avatars.

### File Location

`packages/asset-forge/src/pages/ArmorFittingPage.tsx`

### Layout

```tsx
<div className="page-container-no-padding">
  <div className="flex gap-4 p-4 h-full">
    {/* Asset List Sidebar */}
    <div className="w-80 flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex gap-2">
            <Button
              variant={assetTypeFilter === 'avatar' ? 'primary' : 'outline'}
              onClick={() => setAssetTypeFilter('avatar')}
            >
              Avatars
            </Button>
            <Button
              variant={assetTypeFilter === 'armor' ? 'primary' : 'outline'}
              onClick={() => setAssetTypeFilter('armor')}
            >
              Armor
            </Button>
            <Button
              variant={assetTypeFilter === 'helmet' ? 'primary' : 'outline'}
              onClick={() => setAssetTypeFilter('helmet')}
            >
              Helmets
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ArmorAssetList assets={filteredAssets} />
        </CardContent>
      </Card>
    </div>

    {/* Viewer */}
    <div className="flex-1 relative">
      <ArmorFittingViewer
        ref={viewerRef}
        selectedAvatar={selectedAvatar}
        selectedArmor={selectedArmor}
        selectedHelmet={selectedHelmet}
      />

      <ViewportControls />
      <FittingProgress />
    </div>

    {/* Controls Sidebar */}
    <div className="w-96 overflow-y-auto">
      <ArmorFittingControls viewerRef={viewerRef} />
    </div>
  </div>
</div>
```

### Equipment Slot Modes

The page supports two equipment slots:

#### Armor Mode (`equipmentSlot === 'Spine2'`)

```typescript
<ArmorFittingControls>
  {/* Fitting Method */}
  <Select value={fittingMethod} onChange={setFittingMethod}>
    <option value="shrinkwrap">Shrinkwrap</option>
  </Select>

  {/* Shrinkwrap Parameters */}
  <RangeInput
    label="Iterations"
    value={fittingConfig.iterations}
    min={1}
    max={20}
    onChange={(value) => updateFittingConfig({ iterations: value })}
  />

  <RangeInput
    label="Step Size"
    value={fittingConfig.stepSize}
    min={0.01}
    max={0.5}
    step={0.01}
    onChange={(value) => updateFittingConfig({ stepSize: value })}
  />

  {/* Actions */}
  <Button
    onClick={() => performFitting(viewerRef)}
    disabled={!isReadyToFit}
  >
    Fit Armor
  </Button>

  <Button
    onClick={() => bindArmorToSkeleton(viewerRef)}
    disabled={!isArmorFitted}
  >
    Bind to Skeleton
  </Button>

  <Button
    onClick={() => exportFittedArmor(viewerRef)}
    disabled={!isArmorBound}
  >
    Export Fitted Armor
  </Button>
</ArmorFittingControls>
```

#### Helmet Mode (`equipmentSlot === 'Head'`)

```typescript
<ArmorFittingControls>
  {/* Fitting Method */}
  <Select value={helmetFittingMethod}>
    <option value="auto">Auto Fit</option>
    <option value="manual">Manual Adjust</option>
  </Select>

  {/* Auto Parameters */}
  {helmetFittingMethod === 'auto' && (
    <>
      <RangeInput
        label="Size Multiplier"
        value={helmetSizeMultiplier}
        min={0.5}
        max={2.0}
        step={0.01}
        onChange={setHelmetSizeMultiplier}
      />

      <RangeInput
        label="Fit Tightness"
        value={helmetFitTightness}
        min={0.5}
        max={1.5}
        step={0.01}
        onChange={setHelmetFitTightness}
      />
    </>
  )}

  {/* Manual Parameters */}
  {helmetFittingMethod === 'manual' && (
    <>
      <RangeInput
        label="Vertical Offset"
        value={helmetVerticalOffset}
        min={-0.2}
        max={0.2}
        step={0.001}
        onChange={setHelmetVerticalOffset}
      />

      <RangeInput
        label="Forward Offset"
        value={helmetForwardOffset}
        min={-0.2}
        max={0.2}
        step={0.001}
        onChange={setHelmetForwardOffset}
      />

      {/* Rotation controls */}
    </>
  )}

  {/* Actions */}
  <Button onClick={() => performHelmetFitting(viewerRef)}>
    Fit Helmet
  </Button>

  <Button
    onClick={() => attachHelmetToHead(viewerRef)}
    disabled={!isHelmetFitted}
  >
    Attach to Head
  </Button>
</ArmorFittingControls>
```

### Fitting Workflow

```
Select Avatar
      ↓
Select Armor/Helmet
      ↓
Adjust Parameters
      ↓
Perform Fitting
      ↓
Preview Result
      ↓
[Armor] Bind to Skeleton
      ↓
Export
```

### Armor Fitting Implementation

```typescript
const performFitting = async (viewerRef) => {
  setIsFitting(true)
  setFittingProgress(0)

  try {
    // Create parameters
    const params = {
      ...fittingConfig,
      iterations: Math.min(fittingConfig.iterations, 10),
      stepSize: fittingConfig.stepSize || 0.1,
      targetOffset: fittingConfig.targetOffset || 0.01
    }

    // Perform fitting
    setFittingProgress(50)
    viewerRef.current?.performFitting(params)

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 1000))
    setFittingProgress(80)

    // Weight transfer if enabled
    if (enableWeightTransfer) {
      setFittingProgress(90)
      viewerRef.current?.transferWeights()
    }

    setFittingProgress(100)
    setIsArmorFitted(true)

    // Save to history
    saveToHistory()
  } catch (error) {
    setLastError(`Fitting failed: ${error.message}`)
  } finally {
    setIsFitting(false)
  }
}
```

### Helmet Fitting Implementation

```typescript
const performHelmetFitting = async (viewerRef) => {
  setIsFitting(true)

  try {
    await viewerRef.current?.performHelmetFitting({
      method: helmetFittingMethod,
      sizeMultiplier: helmetSizeMultiplier,
      fitTightness: helmetFitTightness,
      verticalOffset: helmetVerticalOffset,
      forwardOffset: helmetForwardOffset,
      rotation: {
        x: helmetRotation.x * Math.PI / 180,
        y: helmetRotation.y * Math.PI / 180,
        z: helmetRotation.z * Math.PI / 180
      }
    })

    setIsHelmetFitted(true)
  } catch (error) {
    setLastError(`Helmet fitting failed: ${error.message}`)
  } finally {
    setIsFitting(false)
  }
}
```

### Undo/Redo System

```typescript
// History entry
interface HistoryEntry {
  fittingConfig: FittingConfig
  timestamp: number
}

// Save current state
const saveToHistory = () => {
  const entry = {
    fittingConfig: { ...fittingConfig },
    timestamp: Date.now()
  }

  // Remove future entries
  history = history.slice(0, historyIndex + 1)
  history.push(entry)
  historyIndex = history.length - 1

  // Limit size
  if (history.length > 50) {
    history = history.slice(-50)
    historyIndex = history.length - 1
  }
}

// Undo
const undo = () => {
  if (historyIndex > 0) {
    historyIndex--
    const entry = history[historyIndex]
    fittingConfig = { ...entry.fittingConfig }
  }
}

// Redo
const redo = () => {
  if (historyIndex < history.length - 1) {
    historyIndex++
    const entry = history[historyIndex]
    fittingConfig = { ...entry.fittingConfig }
  }
}
```

---

## VoiceStandalonePage

Standalone voice generation experimentation page for testing ElevenLabs text-to-speech without creating NPCs.

### File Location

`packages/asset-forge/src/pages/VoiceStandalonePage.tsx`

### Layout

```tsx
<div className="w-full h-full overflow-auto" data-testid="voice-standalone-page">
  <div className="max-w-5xl mx-auto p-6 space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold" data-testid="page-title">
        Voice Experimentation
      </h1>
      <SubscriptionWidget />
    </div>

    {/* Main Content */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Input & Controls */}
      <div className="lg:col-span-2 space-y-6">
        {/* Text Input Card */}
        <Card>
          <CardHeader>
            <h2>Text Input</h2>
            {/* Voice Selection */}
            <Button data-testid="voice-browser-toggle">
              Choose Voice
            </Button>
          </CardHeader>
          <CardContent>
            <textarea
              data-testid="voice-input-text"
              maxLength={5000}
              placeholder="Enter text to generate voice..."
            />
            <div className="flex justify-between">
              <span data-testid="character-counter">
                {characterCount} / 5000
              </span>
              {costEstimate && (
                <Badge data-testid="cost-estimate">
                  ${costEstimate.cost}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Generation Controls */}
        <Card>
          <CardHeader>
            <h2>Generation</h2>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGenerate}
              disabled={!inputText || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Voice'}
            </Button>
            {generatedAudio && (
              <div className="flex gap-2">
                <Button onClick={handlePlay}>Play</Button>
                <Button onClick={handleDownload}>Download</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Settings */}
      <div className="space-y-6">
        {/* Presets */}
        <VoicePresets onApplyPreset={applyPreset} />

        {/* Settings */}
        <Card>
          <CardHeader>
            <h2>Voice Settings</h2>
          </CardHeader>
          <CardContent>
            <Select
              label="Model"
              value={currentSettings.modelId}
              onChange={(value) => updateSettings({ modelId: value })}
            >
              <option value="eleven_multilingual_v2">Multilingual v2</option>
              <option value="eleven_turbo_v2_5">Turbo v2.5</option>
              <option value="eleven_flash_v2_5">Flash v2.5</option>
            </Select>

            <RangeInput
              label="Stability"
              value={currentSettings.stability}
              min={0}
              max={1}
              step={0.1}
              onChange={(value) => updateSettings({ stability: value })}
            />

            <RangeInput
              label="Similarity Boost"
              value={currentSettings.similarityBoost}
              min={0}
              max={1}
              step={0.1}
              onChange={(value) => updateSettings({ similarityBoost: value })}
            />

            <RangeInput
              label="Style"
              value={currentSettings.style}
              min={0}
              max={1}
              step={0.1}
              onChange={(value) => updateSettings({ style: value })}
            />
          </CardContent>
        </Card>
      </div>
    </div>

    {/* Voice Browser Modal */}
    {showVoiceLibrary && (
      <VoiceBrowser
        onSelectVoice={handleVoiceSelect}
        onClose={() => setShowVoiceLibrary(false)}
      />
    )}
  </div>
</div>
```

### State Management

Uses `useVoiceGenerationStore` from Zustand:

```typescript
const {
  selectedVoiceId,
  currentSettings,
  setSelectedVoice,
  setCurrentSettings,
  isGenerating,
  setGenerating,
  generationError,
  setGenerationError,
} = useVoiceGenerationStore()
```

### Performance Optimizations

#### Debounced Text Input

Problem: Typing large amounts of text triggers excessive re-renders and cost calculations.

Solution: 100ms debounce separates immediate input from expensive operations.

```typescript
const [inputText, setInputText] = useState('')
const [debouncedText, setDebouncedText] = useState('')

// Debounce effect
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedText(inputText)
  }, 100)
  return () => clearTimeout(timer)
}, [inputText])

// Cost calculation uses debounced text
useEffect(() => {
  if (debouncedText.length === 0) {
    setCostEstimate(null)
    return
  }
  voiceGenerationService.estimateCost(debouncedText.length, currentSettings.modelId)
    .then(estimate => setCostEstimate(estimate))
}, [debouncedText, currentSettings.modelId])
```

**Benefits:**
- 100x fewer re-renders (~45 vs. ~4,500 for 5,000 chars)
- 30x faster text input performance (<2s vs. 60s)
- Smooth typing even with 5,000 characters
- Efficient cost calculations

#### Test Data Attributes

All interactive elements include `data-testid` attributes for stable test selectors:

```typescript
// Page structure
data-testid="voice-standalone-page"        // Main container
data-testid="page-title"                   // Page heading

// Input elements
data-testid="voice-input-text"             // Text textarea
data-testid="character-counter"            // Character count display
data-testid="cost-estimate"                // Cost estimation badge

// Controls
data-testid="voice-browser-toggle"         // Voice browser button
```

### Key Features

#### 1. Character Limit & Counter
- 5,000 character maximum (ElevenLabs limit)
- Real-time character counter
- Color-coded warnings:
  - Green: 0-4,499 characters (safe)
  - Yellow: 4,500-4,999 characters (warning at 90%)
  - Red: 5,000+ characters (at limit)

#### 2. Real-time Cost Estimation
- Calculates cost as you type (debounced)
- Model-aware pricing
- Shows character count and USD estimate

#### 3. Voice Library Browser
- 3,000+ voices from ElevenLabs
- Search and category filters
- Voice preview capability
- Favorite voices management

#### 4. Settings Presets
- Narrator preset (storytelling)
- Character preset (game characters)
- Professional preset (formal content)
- Custom manual configuration

#### 5. Generation Controls
- Generate voice from text
- Play generated audio
- Download MP3 file
- Error handling with clear feedback

### Workflow

```typescript
// 1. User selects voice
const handleVoiceSelect = (voiceId: string, voiceName: string) => {
  setSelectedVoice(voiceId)
  setSelectedVoiceName(voiceName)
  setShowVoiceLibrary(false)
}

// 2. User types or pastes text (debounced)
const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  setInputText(e.target.value)
  // Debounce effect triggers cost calculation after 100ms
}

// 3. User clicks "Generate Voice"
const handleGenerate = async () => {
  if (!inputText || !selectedVoiceId) return

  setGenerating(true)
  setGenerationError(null)

  try {
    const result = await voiceGenerationService.generateVoice({
      text: inputText,
      voiceId: selectedVoiceId,
      settings: currentSettings
    })

    setGeneratedAudio(result.audioBlob)
  } catch (error) {
    setGenerationError(error.message)
  } finally {
    setGenerating(false)
  }
}

// 4. User previews or downloads
const handlePlay = () => {
  if (generatedAudio) {
    const audio = new Audio(URL.createObjectURL(generatedAudio))
    audio.play()
  }
}

const handleDownload = () => {
  if (generatedAudio) {
    const url = URL.createObjectURL(generatedAudio)
    const a = document.createElement('a')
    a.href = url
    a.download = `voice-${Date.now()}.mp3`
    a.click()
  }
}
```

### Use Cases

1. **Voice Testing**: Try different voices without creating NPCs
2. **Prompt Optimization**: Experiment with text formatting for better speech
3. **Settings Calibration**: Find optimal parameters for different voice styles
4. **Cost Planning**: Estimate costs for large scripts before production

---

## Navigation System

Asset Forge uses a context-based navigation system.

### Navigation Context

```typescript
interface NavigationContextValue {
  currentPage: string
  navigateTo: (page: string, params?: Record<string, any>) => void
  goBack: () => void
  navigationHistory: string[]
}

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [currentPage, setCurrentPage] = useState('generation')
  const [history, setHistory] = useState<string[]>([])

  const navigateTo = (page: string, params?: Record<string, any>) => {
    setHistory([...history, currentPage])
    setCurrentPage(page)
  }

  const goBack = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1]
      setHistory(history.slice(0, -1))
      setCurrentPage(previous)
    }
  }

  return (
    <NavigationContext.Provider value={{ currentPage, navigateTo, goBack, navigationHistory: history }}>
      {children}
    </NavigationContext.Provider>
  )
}
```

### Navigation Component

```typescript
export const Navigation: React.FC = () => {
  const { currentPage, navigateTo } = useNavigation()

  return (
    <nav className="fixed top-0 left-0 right-0 h-[60px] bg-bg-secondary border-b z-50">
      <div className="flex items-center justify-between px-6 h-full">
        {/* Logo */}
        <div className="text-xl font-bold">Asset Forge</div>

        {/* Nav Items */}
        <div className="flex gap-4">
          <NavItem
            label="Generation"
            icon={<Sparkles />}
            active={currentPage === 'generation'}
            onClick={() => navigateTo('generation')}
          />

          <NavItem
            label="Assets"
            icon={<Layers />}
            active={currentPage === 'assets'}
            onClick={() => navigateTo('assets')}
          />

          <NavItem
            label="Equipment"
            icon={<Sword />}
            active={currentPage === 'equipment'}
            onClick={() => navigateTo('equipment')}
          />

          <NavItem
            label="Hand Rigging"
            icon={<Hand />}
            active={currentPage === 'hand-rigging'}
            onClick={() => navigateTo('hand-rigging')}
          />

          <NavItem
            label="Armor Fitting"
            icon={<Shield />}
            active={currentPage === 'armor-fitting'}
            onClick={() => navigateTo('armor-fitting')}
          />
        </div>
      </div>
    </nav>
  )
}
```

---

## Routing Configuration

Asset Forge uses a simple state-based router rather than React Router.

### App Component

```typescript
export const App: React.FC = () => {
  const { currentPage } = useNavigation()

  return (
    <ErrorBoundary>
      <AppProvider>
        <div className="app">
          <Navigation />

          {currentPage === 'generation' && <GenerationPage />}
          {currentPage === 'assets' && <AssetsPage />}
          {currentPage === 'equipment' && <EquipmentPage />}
          {currentPage === 'hand-rigging' && <HandRiggingPage />}
          {currentPage === 'armor-fitting' && <ArmorFittingPage />}

          <NotificationBar />
        </div>
      </AppProvider>
    </ErrorBoundary>
  )
}
```

### Why Not React Router?

1. **Simplicity**: No external routing library needed
2. **State Control**: Full control over navigation state
3. **No URL Management**: Single-page app without URL requirements
4. **Easy Testing**: Simpler to test navigation logic

---

## Page Transitions

### Fade-in Animation

All pages use consistent fade-in animations:

```css
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
```

### View Transitions

Within pages (e.g., GenerationPage config/progress/results):

```tsx
{activeView === 'config' && (
  <div className="animate-fade-in">
    {/* Config content */}
  </div>
)}

{activeView === 'progress' && (
  <div className="animate-fade-in">
    {/* Progress content */}
  </div>
)}
```

### Asset Selection Transitions

```typescript
const handleAssetSelect = (asset: Asset) => {
  setIsTransitioning(true)
  setSelectedAsset(asset)

  setTimeout(() => {
    setIsTransitioning(false)
  }, 300)
}

// Overlay during transition
{isTransitioning && (
  <div className="absolute inset-0 bg-bg-primary animate-fade-in" />
)}
```

---

## Summary

Asset Forge's page architecture demonstrates:

- **Workflow-oriented design**: Each page represents a complete user workflow
- **Consistent structure**: All pages follow similar patterns
- **Powerful viewers**: 3D visualization central to every workflow
- **State-driven UI**: Zustand stores manage complex state
- **Smooth transitions**: Polished user experience with animations
- **Modular organization**: Clear separation between layout, logic, and presentation

Each page is a self-contained feature module that can be developed, tested, and maintained independently while sharing common components and services.
