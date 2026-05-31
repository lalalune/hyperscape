# Component Architecture Overview

This document provides a comprehensive catalog of all 77+ React components in the Asset Forge frontend, organized by feature domain and architectural responsibility.

## Table of Contents

1. [Component Organization](#component-organization)
2. [Common Components (12)](#common-components)
3. [Shared Components (3)](#shared-components)
4. [Generation Components (17)](#generation-components)
5. [Assets Components (11)](#assets-components)
6. [Equipment Components (11)](#equipment-components)
7. [Hand Rigging Components (10)](#hand-rigging-components)
8. [Armor Fitting Components (16)](#armor-fitting-components)
9. [Component Hierarchy Diagram](#component-hierarchy-diagram)
10. [Props Interfaces](#props-interfaces)

---

## Component Organization

Asset Forge follows a domain-driven component organization strategy:

```
src/components/
├── common/          # Reusable UI primitives (12 components)
├── shared/          # Cross-feature shared components (3 components)
├── Generation/      # Asset generation workflow (17 components)
├── Assets/          # Asset browser and management (11 components)
├── Equipment/       # Equipment positioning (11 components)
├── HandRigging/     # Hand rigging workflow (10 components)
└── ArmorFitting/    # Armor fitting workflow (16 components)
    └── MeshFittingDebugger/  # Advanced fitting debugger
```

### Design Principles

1. **Component Purity**: Components are functional and favor composition over inheritance
2. **Single Responsibility**: Each component has one clear purpose
3. **Prop Drilling Minimization**: Uses Zustand stores for complex state
4. **Type Safety**: All components have explicit TypeScript interfaces
5. **Reusability**: Common patterns extracted to `common/` directory

---

## Common Components

These 12 reusable UI primitives provide the foundation for the entire application.

### 1. Button (`Button.tsx`)

A versatile button component with multiple variants and states.

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
}
```

**Usage Example**:
```tsx
<Button
  variant="primary"
  size="lg"
  onClick={handleStartGeneration}
  disabled={isGenerating}
>
  <Sparkles className="w-5 h-5 mr-2" />
  Start Generation
</Button>
```

### 2. Card Components (`Card.tsx`)

Composable card system for content organization.

```typescript
// Main card container
export const Card: React.FC<CardProps>

// Card sub-components
export const CardHeader: React.FC
export const CardTitle: React.FC
export const CardDescription: React.FC
export const CardContent: React.FC
export const CardFooter: React.FC
```

**Usage Example**:
```tsx
<Card className="bg-bg-secondary">
  <CardHeader>
    <CardTitle>Asset Details</CardTitle>
    <CardDescription>Configure your asset properties</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content here */}
  </CardContent>
  <CardFooter>
    <Button>Save</Button>
  </CardFooter>
</Card>
```

### 3. Input Components (`Input.tsx`)

Form input elements with consistent styling.

```typescript
export const Input: React.FC<InputProps>
export const Textarea: React.FC<TextareaProps>
export const Select: React.FC<SelectProps>

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
  helperText?: string
}
```

**Usage Example**:
```tsx
<Input
  label="Asset Name"
  value={assetName}
  onChange={(e) => setAssetName(e.target.value)}
  placeholder="Enter asset name..."
  error={validationError}
/>
```

### 4. Modal System (`Modal.tsx`)

Flexible modal dialog system with composable sections.

```typescript
export const Modal: React.FC<ModalProps>
export const ModalHeader: React.FC<ModalHeaderProps>
export const ModalBody: React.FC<ModalBodyProps>
export const ModalSection: React.FC<ModalSectionProps>
export const ModalFooter: React.FC<ModalFooterProps>

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
}
```

**Usage Example**:
```tsx
<Modal isOpen={showEditModal} onClose={closeModal} size="lg">
  <ModalHeader title="Edit Asset" />
  <ModalBody>
    <ModalSection title="Basic Information">
      {/* Form fields */}
    </ModalSection>
  </ModalBody>
  <ModalFooter>
    <Button onClick={handleSave}>Save Changes</Button>
  </ModalFooter>
</Modal>
```

### 5. Badge (`Badge.tsx`)

Visual tags and status indicators.

```typescript
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}
```

**Usage Example**:
```tsx
<Badge variant="success">Completed</Badge>
<Badge variant="warning">Processing</Badge>
```

### 6. Checkbox (`Checkbox.tsx`)

Styled checkbox with label support.

```typescript
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  description?: string
}
```

### 7. Progress Components (`Progress.tsx`)

Linear and circular progress indicators.

```typescript
export const Progress: React.FC<ProgressProps>
export const CircularProgress: React.FC<CircularProgressProps>

interface ProgressProps {
  value: number // 0-100
  showLabel?: boolean
  variant?: 'default' | 'success' | 'warning'
}
```

### 8. RangeInput (`RangeInput.tsx`)

Slider input with live value display.

```typescript
interface RangeInputProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  unit?: string
}
```

### 9. EmptyState (`EmptyState.tsx`)

Placeholder for empty views.

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}
```

### 10. ErrorNotification (`ErrorNotification.tsx`)

Toast-style error messages.

### 11. ErrorBoundary (`ErrorBoundary.tsx`)

React error boundary for graceful error handling.

### 12. Navigation (`Navigation.tsx`)

Located in `shared/` but functions as a common component.

---

## Shared Components

These 3 components are used across multiple feature domains.

### 1. ThreeViewer (`shared/ThreeViewer.tsx`)

The core 3D model viewer powering all visualization features.

```typescript
interface ThreeViewerProps {
  modelUrl?: string
  isWireframe?: boolean
  showGroundPlane?: boolean
  isLightBackground?: boolean
  lightMode?: boolean
  onModelLoad?: (info: ModelInfo) => void
  assetInfo?: AssetInfo
  isAnimationPlayer?: boolean
}

export interface ThreeViewerRef {
  resetCamera: () => void
  takeScreenshot: () => void
  captureHandViews: () => Promise<HandViewCapture>
  loadAnimation: (url: string, name: string) => Promise<void>
  playAnimation: (name: 'walking' | 'running') => void
  stopAnimation: () => void
  toggleSkeleton: () => void
  exportTPoseModel: () => void
}
```

**Key Features**:
- Three.js scene management
- GLTFLoader for model loading
- OrbitControls for camera manipulation
- Post-processing effects (SSAO, Bloom)
- Animation playback
- Screenshot capture
- Skeleton visualization

**Usage Example**:
```tsx
const viewerRef = useRef<ThreeViewerRef>(null)

<ThreeViewer
  ref={viewerRef}
  modelUrl={`/api/assets/${assetId}/model`}
  isWireframe={showWireframe}
  showGroundPlane={true}
  onModelLoad={(info) => setModelInfo(info)}
  assetInfo={{
    name: asset.name,
    type: asset.type,
    tier: asset.metadata.tier
  }}
/>
```

### 2. AnimationPlayer (`shared/AnimationPlayer.tsx`)

Specialized viewer for character animations with playback controls.

```typescript
interface AnimationPlayerProps {
  modelUrl: string
  animations: Record<string, AnimationConfig>
  riggedModelPath?: string
  characterHeight?: number
  className?: string
}
```

**Features**:
- Animation clip selection
- Playback controls (play/pause/stop)
- Speed adjustment
- Loop toggle
- Camera framing for characters

### 3. NotificationBar (`shared/NotificationBar.tsx`)

Global notification system for user feedback.

```typescript
interface NotificationBarProps {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  onClose: () => void
}
```

---

## Generation Components

17 components managing the AI asset generation workflow.

### Configuration Components

#### 1. GenerationTypeSelector (`GenerationTypeSelector.tsx`)

Initial screen for choosing between item and avatar generation.

```typescript
interface GenerationTypeSelectorProps {
  onSelectType: (type: 'item' | 'avatar') => void
}
```

#### 2. AssetDetailsCard (`AssetDetailsCard.tsx`)

Main form for asset metadata input.

```typescript
interface AssetDetailsCardProps {
  generationType: 'item' | 'avatar'
  assetName: string
  assetType: string
  description: string
  gameStyle: 'runescape' | 'custom'
  customStyle: string
  customAssetTypes: CustomAssetType[]
  customGameStyles: Record<string, GameStyleConfig>
  onAssetNameChange: (name: string) => void
  onAssetTypeChange: (type: string) => void
  onDescriptionChange: (desc: string) => void
  onGameStyleChange: (style: 'runescape' | 'custom') => void
  onCustomStyleChange: (style: string) => void
  onBack: () => void
  onSaveCustomGameStyle: (name: string, config: GameStyleConfig) => void
}
```

**Features**:
- Asset name and description input
- Asset type selection (weapon, armor, character, etc.)
- Game style presets (RuneScape, custom)
- Custom style creation and management

#### 3. PipelineOptionsCard (`PipelineOptionsCard.tsx`)

Configuration for pipeline stages and quality settings.

```typescript
interface PipelineOptionsCardProps {
  generationType: 'item' | 'avatar'
  useGPT4Enhancement: boolean
  enableRetexturing: boolean
  enableSprites: boolean
  enableRigging: boolean
  quality: 'standard' | 'high' | 'ultra'
  onUseGPT4EnhancementChange: (value: boolean) => void
  onEnableRetexturingChange: (value: boolean) => void
  onEnableSpritesChange: (value: boolean) => void
  onEnableRiggingChange: (value: boolean) => void
  onQualityChange: (quality: 'standard' | 'high' | 'ultra') => void
}
```

**Toggles**:
- GPT-4 prompt enhancement
- Material variant generation
- 2D sprite rendering
- Avatar auto-rigging
- Quality presets

#### 4. AdvancedPromptsCard (`AdvancedPromptsCard.tsx`)

Advanced prompt customization for power users.

```typescript
interface AdvancedPromptsCardProps {
  showAdvancedPrompts: boolean
  showAssetTypeEditor: boolean
  generationType: 'item' | 'avatar'
  gameStyle: string
  customStyle: string
  customGamePrompt: string
  customAssetTypePrompt: string
  assetTypePrompts: Record<string, string>
  customAssetTypes: CustomAssetType[]
  currentStylePrompt: string
  gameStylePrompts: GameStylePrompts
  loadedPrompts: {
    avatar?: string
    item?: string
  }
  onToggleAdvancedPrompts: () => void
  onToggleAssetTypeEditor: () => void
  onCustomGamePromptChange: (prompt: string) => void
  onCustomAssetTypePromptChange: (prompt: string) => void
  onAssetTypePromptsChange: (prompts: Record<string, string>) => void
  onCustomAssetTypesChange: (types: CustomAssetType[]) => void
  onAddCustomAssetType: (type: CustomAssetType) => void
  onSaveCustomAssetTypes: () => void
  onSaveCustomGameStyle: (name: string, config: GameStyleConfig) => void
  onDeleteCustomGameStyle: (name: string) => void
  onDeleteCustomAssetType: (typeId: string) => void
}
```

**Features**:
- Direct prompt editing
- Custom asset type creation
- Prompt template management
- Game style customization

#### 5. MaterialVariantsCard (`MaterialVariantsCard.tsx`)

Material preset selection for item retexturing.

```typescript
interface MaterialVariantsCardProps {
  gameStyle: string
  isLoadingMaterials: boolean
  materialPresets: MaterialPreset[]
  selectedMaterials: string[]
  customMaterials: CustomMaterial[]
  materialPromptOverrides: Record<string, string>
  editMaterialPrompts: boolean
  onToggleMaterialSelection: (id: string) => void
  onEditMaterialPromptsToggle: () => void
  onMaterialPromptOverride: (id: string, prompt: string) => void
  onAddCustomMaterial: (material: CustomMaterial) => void
  onUpdateCustomMaterial: (index: number, material: CustomMaterial) => void
  onRemoveCustomMaterial: (index: number) => void
  onSaveCustomMaterials: () => void
  onEditPreset: (preset: MaterialPreset) => void
  onDeletePreset: (id: string) => void
}
```

#### 6. AvatarRiggingOptionsCard (`AvatarRiggingOptionsCard.tsx`)

Avatar-specific rigging configuration.

```typescript
interface AvatarRiggingOptionsCardProps {
  characterHeight: number
  onCharacterHeightChange: (height: number) => void
}
```

#### 7. ReferenceImageCard (`ReferenceImageCard.tsx`)

Reference image upload or URL input for guided generation.

```typescript
interface ReferenceImageCardProps {
  generationType: 'item' | 'avatar'
  mode: 'auto' | 'custom'
  source: 'upload' | 'url' | null
  url: string | null
  dataUrl: string | null
  onModeChange: (mode: 'auto' | 'custom') => void
  onSourceChange: (source: 'upload' | 'url' | null) => void
  onUrlChange: (url: string | null) => void
  onDataUrlChange: (dataUrl: string | null) => void
}
```

### Navigation Components

#### 8. TabNavigation (`TabNavigation.tsx`)

Top-level navigation between config, progress, and results.

```typescript
interface TabNavigationProps {
  activeView: 'config' | 'progress' | 'results'
  generatedAssetsCount: number
  onTabChange: (view: 'config' | 'progress' | 'results') => void
}
```

### Progress Components

#### 9. PipelineProgressCard (`PipelineProgressCard.tsx`)

Real-time pipeline execution visualization.

```typescript
interface PipelineProgressCardProps {
  pipelineStages: PipelineStage[]
  generationType: 'item' | 'avatar'
  isGenerating: boolean
  onBackToConfig: () => void
  onBack: () => void
}
```

**Features**:
- Stage-by-stage progress visualization
- Status indicators (idle/active/completed/failed/skipped)
- Real-time updates via polling
- Error display

#### 10. GenerationTimeline (`GenerationTimeline.tsx`)

Detailed timeline view of generation stages.

### Results Components

#### 11. GeneratedAssetsList (`GeneratedAssetsList.tsx`)

Sidebar list of all generated assets.

```typescript
interface GeneratedAssetsListProps {
  generatedAssets: GeneratedAsset[]
  selectedAsset: GeneratedAsset | null
  onAssetSelect: (asset: GeneratedAsset) => void
  onBack: () => void
}
```

#### 12. AssetPreviewCard (`AssetPreviewCard.tsx`)

3D preview of selected generated asset.

```typescript
interface AssetPreviewCardProps {
  selectedAsset: GeneratedAsset
  generationType: 'item' | 'avatar'
}
```

**Integration**: Embeds `ThreeViewer` component

#### 13. MaterialVariantsDisplay (`MaterialVariantsDisplay.tsx`)

Grid display of material variant thumbnails.

```typescript
interface MaterialVariantsDisplayProps {
  variants: Array<{ name: string; modelUrl: string; id?: string }>
}
```

#### 14. SpritesDisplay (`SpritesDisplay.tsx`)

Display and generation of 2D sprite renders.

```typescript
interface SpritesDisplayProps {
  selectedAsset: GeneratedAsset
  isGeneratingSprites: boolean
  onGenerateSprites: (assetId: string) => void
}
```

#### 15. AssetActionsCard (`AssetActionsCard.tsx`)

Action buttons for completed assets.

#### 16. NoAssetSelected (`NoAssetSelected.tsx`)

Empty state when no asset is selected.

### Modal Components

#### 17. EditMaterialPresetModal (`EditMaterialPresetModal.tsx`)

Edit material preset prompts and properties.

```typescript
interface EditMaterialPresetModalProps {
  editingPreset: MaterialPreset
  onClose: () => void
  onSave: (preset: MaterialPreset) => void
}
```

#### 18. DeleteConfirmationModal (`DeleteConfirmationModal.tsx`)

Confirmation dialog for deleting material presets.

---

## Assets Components

11 components for the asset browser and management interface.

### 1. AssetList (`AssetList.tsx`)

Scrollable list of all assets with thumbnails.

```typescript
interface AssetListProps {
  assets: Asset[]
}
```

**Features**:
- Virtual scrolling for performance
- Thumbnail previews
- Asset metadata display
- Click to select

### 2. AssetFilters (`AssetFilters.tsx`)

Search and filter controls.

```typescript
interface AssetFiltersProps {
  totalAssets: number
  filteredCount: number
}
```

**Filters**:
- Search by name
- Filter by type
- Filter by material (for variants)

### 3. AssetDetailsPanel (`AssetDetailsPanel.tsx`)

Slide-out panel with detailed asset information.

```typescript
interface AssetDetailsPanelProps {
  asset: Asset
  isOpen: boolean
  onClose: () => void
  modelInfo: ModelInfo | null
}
```

**Displays**:
- Asset metadata
- Model statistics (vertices, faces, materials)
- File size
- Generation method
- Timestamps

### 4. ViewerControls (`ViewerControls.tsx`)

Toolbar with viewer control buttons.

```typescript
interface ViewerControlsProps {
  onViewerReset: () => void
  onDownload: () => void
  assetType: string
  canRetexture: boolean
  hasRigging: boolean
}
```

**Actions**:
- Reset camera
- Toggle wireframe
- Toggle ground plane
- Toggle background
- Download/screenshot
- Open retexture modal
- Open sprite modal
- View animations

### 5. EmptyAssetState (`EmptyAssetState.tsx`)

Shown when no asset is selected.

### 6. LoadingState (`LoadingState.tsx`)

Loading spinner during asset list fetch.

### 7. TransitionOverlay (`TransitionOverlay.tsx`)

Smooth transition effect when changing assets.

### 8. AssetEditModal (`AssetEditModal.tsx`)

Full asset metadata editor.

```typescript
interface AssetEditModalProps {
  asset: Asset
  isOpen: boolean
  onClose: () => void
  onSave: (asset: Partial<Asset>) => void
  onDelete: (asset: Asset, includeVariants?: boolean) => void
  hasVariants: boolean
}
```

**Editable Fields**:
- Name
- Description
- Type
- Subtype
- Tier
- Tags

### 9. RetextureModal (`RetextureModal.tsx`)

Generate material variants for existing assets.

```typescript
interface RetextureModalProps {
  asset: Asset
  onClose: () => void
  onComplete: () => void
}
```

### 10. RegenerateModal (`RegenerateModal.tsx`)

Regenerate asset with modified prompts.

```typescript
interface RegenerateModalProps {
  asset: Asset
  onClose: () => void
  onComplete: () => void
}
```

### 11. SpriteGenerationModal (`SpriteGenerationModal.tsx`)

Configure and generate 2D sprite renders.

```typescript
interface SpriteGenerationModalProps {
  asset: Asset
  onClose: () => void
  onComplete: () => void
}
```

**Options**:
- Number of angles (4, 8, 16)
- Resolution
- Background (transparent, solid color)

---

## Equipment Components

11 components for the equipment positioning tool.

### 1. EquipmentViewer (`EquipmentViewer.tsx`)

Main 3D viewer with hand-held item positioning.

```typescript
interface EquipmentViewerProps {
  selectedCreature: Asset | null
  selectedWeapon: Asset | null
  onModelLoad?: (info: ModelInfo) => void
}

export interface EquipmentViewerRef {
  resetCamera: () => void
  resetTransform: () => void
  exportModel: () => Promise<ArrayBuffer>
}
```

### 2. EquipmentControls (`EquipmentControls.tsx`)

Master control panel for equipment positioning.

```typescript
interface EquipmentControlsProps {
  // Configuration props
}
```

### 3. EquipmentSlotSelector (`EquipmentSlotSelector.tsx`)

Choose attachment point (right hand, left hand).

### 4. PositionControls (`PositionControls.tsx`)

X, Y, Z position sliders.

```typescript
interface PositionControlsProps {
  position: { x: number; y: number; z: number }
  onChange: (position: { x: number; y: number; z: number }) => void
}
```

### 5. OrientationControls (`OrientationControls.tsx`)

Rotation controls for weapon orientation.

```typescript
interface OrientationControlsProps {
  rotation: { x: number; y: number; z: number }
  onChange: (rotation: { x: number; y: number; z: number }) => void
}
```

### 6. CreatureSizeControls (`CreatureSizeControls.tsx`)

Scale adjustment for creatures.

### 7. GripDetectionPanel (`GripDetectionPanel.tsx`)

Auto-detect weapon handle position.

### 8. EquipmentList (`EquipmentList.tsx`)

List of available equipment items.

### 9. AssetSelectionPanel (`AssetSelectionPanel.tsx`)

Choose creature and weapon assets.

### 10. ExportOptionsPanel (`ExportOptionsPanel.tsx`)

Export settings for equipped model.

### 11. ViewportSection (`ViewportSection.tsx`)

3D viewport wrapper with controls.

---

## Hand Rigging Components

10 components for the hand rigging workflow.

### 1. HandUploadZone (`HandUploadZone.tsx`)

Drag-and-drop file upload for avatar models.

```typescript
interface HandUploadZoneProps {
  onFileSelect: (file: File) => void
  acceptedFormats: string[]
}
```

### 2. HandAvatarSelector (`HandAvatarSelector.tsx`)

Select from existing avatar assets.

```typescript
interface HandAvatarSelectorProps {
  selectedAvatar: Asset | null
  onSelect: (avatar: Asset) => void
}
```

### 3. ModelViewer (`ModelViewer.tsx`)

3D viewer for hand rigging preview.

```typescript
interface ModelViewerProps {
  modelUrl: string | null
  showSkeleton: boolean
  onSkeletonToggle: () => void
}
```

### 4. HandRiggingControls (`HandRiggingControls.tsx`)

Control panel for rigging operations.

```typescript
interface HandRiggingControlsProps {
  canStartProcessing: boolean
  isProcessing: boolean
  onStartProcessing: () => void
  onReset: () => void
}
```

### 5. HandProcessingSteps (`HandProcessingSteps.tsx`)

Step-by-step progress display.

```typescript
interface HandProcessingStepsProps {
  steps: ProcessingStep[]
  currentStage: ProcessingStage
}
```

**Steps**:
1. Detecting wrist bones
2. Creating finger bones
3. Applying vertex weights

### 6. RiggingResults (`RiggingResults.tsx`)

Display rigging results and statistics.

```typescript
interface RiggingResultsProps {
  leftHandData: HandData | null
  rightHandData: HandData | null
}
```

### 7. ModelStats (`ModelStats.tsx`)

Model information display (vertices, faces).

```typescript
interface ModelStatsProps {
  modelInfo: { vertices: number; faces: number; materials: number } | null
}
```

### 8. DebugImages (`DebugImages.tsx`)

Show hand detection debug visualizations.

```typescript
interface DebugImagesProps {
  debugImages: Record<string, string>
  visible: boolean
}
```

### 9. ExportModal (`ExportModal.tsx`)

Export rigged model with options.

```typescript
interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (options: ExportOptions) => void
}
```

### 10. HelpSection (`HelpSection.tsx`)

Tips and documentation for hand rigging.

---

## Armor Fitting Components

16 components for the armor fitting workflow, including the advanced mesh fitting debugger.

### Main Components

#### 1. ArmorFittingViewer (`ArmorFittingViewer.tsx`)

Core 3D viewer for armor fitting operations.

```typescript
interface ArmorFittingViewerProps {
  // Viewer configuration
}

export interface ArmorFittingViewerRef {
  performFitting: (params: MeshFittingParameters) => void
  transferWeights: () => void
  performHelmetFitting: (params: HelmetFittingParams) => void
  attachHelmetToHead: () => void
  detachHelmetFromHead: () => void
  exportFittedModel: () => Promise<ArrayBuffer>
  resetTransform: () => void
  clearArmor: () => void
  clearHelmet: () => void
}
```

**Capabilities**:
- Shrinkwrap mesh fitting
- Weight transfer
- Helmet auto-fitting
- Real-time preview
- Export fitted armor

#### 2. ArmorFittingControls (`ArmorFittingControls.tsx`)

Main control panel for fitting operations.

```typescript
interface ArmorFittingControlsProps {
  viewerRef: React.RefObject<ArmorFittingViewerRef>
}
```

**Controls**:
- Equipment slot selection (Armor/Helmet)
- Fitting method selection
- Parameter adjustment
- Action buttons (Fit, Bind, Export)

#### 3. ArmorAssetList (`ArmorAssetList.tsx`)

Asset browser filtered by type (avatar/armor/helmet).

```typescript
interface ArmorAssetListProps {
  assets: Asset[]
  assetTypeFilter: 'avatar' | 'armor' | 'helmet'
  selectedAsset: Asset | null
  onAssetSelect: (asset: Asset) => void
  onTypeFilterChange: (type: 'avatar' | 'armor' | 'helmet') => void
}
```

#### 4. FittingProgress (`FittingProgress.tsx`)

Progress bar and status during fitting operations.

```typescript
interface FittingProgressProps {
  progress: number
  isFitting: boolean
  status: string
}
```

#### 5. ViewportControls (`ViewportControls.tsx`)

Viewport-specific controls (wireframe, animation, etc.).

```typescript
interface ViewportControlsProps {
  showWireframe: boolean
  currentAnimation: 'tpose' | 'walking' | 'running'
  isAnimationPlaying: boolean
  onToggleWireframe: () => void
  onAnimationChange: (animation: 'tpose' | 'walking' | 'running') => void
  onToggleAnimation: () => void
}
```

#### 6. UndoRedoControls (`UndoRedoControls.tsx`)

Undo/redo buttons for fitting parameter changes.

```typescript
interface UndoRedoControlsProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}
```

### Mesh Fitting Debugger (10 Components)

Advanced debugging interface for mesh fitting algorithm development.

#### 7. MeshFittingDebugger (`MeshFittingDebugger/index.tsx`)

Main debugger interface orchestrating all debug components.

```typescript
interface MeshFittingDebuggerProps {
  // Debugger configuration
}
```

**Features**:
- Real-time parameter adjustment
- Visual debugging overlays
- Multiple demo modes
- Export configurations

#### 8. BasicDemo (`components/BasicDemo.tsx`)

Simple sphere-to-cube fitting demonstration.

```typescript
interface BasicDemoProps {
  fittingParameters: MeshFittingParameters
  onParametersChange: (params: Partial<MeshFittingParameters>) => void
}
```

#### 9. AvatarArmorDemo (`components/AvatarArmorDemo.tsx`)

Full avatar + armor fitting demo.

```typescript
interface AvatarArmorDemoProps {
  selectedAvatar: ModelOption
  selectedArmor: ModelOption
  fittingParameters: MeshFittingParameters
  showWireframe: boolean
  currentAnimation: 'tpose' | 'walking' | 'running'
  isAnimationPlaying: boolean
}
```

#### 10. HelmetDemo (`components/HelmetDemo.tsx`)

Helmet fitting demonstration.

```typescript
interface HelmetDemoProps {
  selectedAvatar: ModelOption
  selectedHelmet: ModelOption
  helmetFittingMethod: 'auto' | 'manual'
  helmetParameters: HelmetFittingParameters
  showHeadBounds: boolean
  showWireframe: boolean
}
```

#### 11. Scene (`components/Scene.tsx`)

Three.js scene wrapper for debugger demos.

```typescript
interface SceneProps {
  children: React.ReactNode
  showWireframe: boolean
  backgroundColor?: number
}
```

#### 12. RangeInput (`components/RangeInput.tsx`)

Specialized slider for parameter adjustment.

```typescript
interface RangeInputProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  unit?: string
  description?: string
}
```

### Debugger Hooks

#### 13-16. Custom Hooks (`hooks/`)

- `useBasicDemoFitting.ts`: Logic for basic demo
- `useArmorFitting.ts`: Logic for armor fitting demo
- `useHelmetFitting.ts`: Logic for helmet fitting demo
- `useFittingHandlers.ts`: Shared fitting operations
- `useResetHandlers.ts`: Reset functionality
- `useExportHandlers.ts`: Export functionality

---

## Component Hierarchy Diagram

```
App
├── Navigation
│
├── GenerationPage
│   ├── GenerationTypeSelector
│   ├── TabNavigation
│   │
│   ├── [Config View]
│   │   ├── AssetDetailsCard
│   │   │   └── Input, Select, Textarea
│   │   ├── PipelineOptionsCard
│   │   │   └── Checkbox
│   │   ├── AdvancedPromptsCard
│   │   │   └── Textarea, Button
│   │   ├── MaterialVariantsCard
│   │   │   ├── Badge
│   │   │   └── Checkbox
│   │   ├── AvatarRiggingOptionsCard
│   │   │   └── RangeInput
│   │   └── ReferenceImageCard
│   │       └── Input, Button
│   │
│   ├── [Progress View]
│   │   ├── PipelineProgressCard
│   │   │   └── Progress, Badge
│   │   └── GenerationTimeline
│   │
│   ├── [Results View]
│   │   ├── GeneratedAssetsList
│   │   │   └── Card, Badge
│   │   ├── AssetPreviewCard
│   │   │   └── ThreeViewer
│   │   ├── MaterialVariantsDisplay
│   │   ├── SpritesDisplay
│   │   └── AssetActionsCard
│   │
│   └── [Modals]
│       ├── EditMaterialPresetModal
│       └── DeleteConfirmationModal
│
├── AssetsPage
│   ├── AssetFilters
│   │   └── Input, Select
│   ├── AssetList
│   │   └── Card, Badge
│   ├── ThreeViewer
│   ├── AnimationPlayer
│   ├── ViewerControls
│   │   └── Button
│   ├── AssetDetailsPanel
│   │   └── Card
│   └── [Modals]
│       ├── AssetEditModal
│       ├── RetextureModal
│       ├── RegenerateModal
│       └── SpriteGenerationModal
│
├── EquipmentPage
│   ├── AssetSelectionPanel
│   ├── EquipmentViewer
│   ├── EquipmentControls
│   │   ├── EquipmentSlotSelector
│   │   ├── PositionControls
│   │   │   └── RangeInput
│   │   ├── OrientationControls
│   │   │   └── RangeInput
│   │   ├── CreatureSizeControls
│   │   └── GripDetectionPanel
│   └── ExportOptionsPanel
│
├── HandRiggingPage
│   ├── HandUploadZone
│   ├── HandAvatarSelector
│   ├── ModelViewer
│   ├── HandRiggingControls
│   ├── HandProcessingSteps
│   ├── RiggingResults
│   ├── ModelStats
│   ├── DebugImages
│   ├── ExportModal
│   └── HelpSection
│
└── ArmorFittingPage
    ├── ArmorAssetList
    ├── ArmorFittingViewer
    ├── ArmorFittingControls
    ├── FittingProgress
    ├── ViewportControls
    ├── UndoRedoControls
    │
    └── MeshFittingDebugger
        ├── BasicDemo
        │   └── Scene
        ├── AvatarArmorDemo
        │   └── Scene
        ├── HelmetDemo
        │   └── Scene
        └── RangeInput
```

---

## Props Interfaces

### Key Shared Interfaces

```typescript
// Asset metadata
interface Asset {
  id: string
  name: string
  description: string
  type: AssetType
  hasModel: boolean
  metadata: AssetMetadata
  generatedAt?: string
}

// Model information
interface ModelInfo {
  vertices: number
  faces: number
  materials: number
  fileSize?: number
}

// Material preset
interface MaterialPreset {
  id: string
  name: string
  displayName: string
  color: string
  prompt: string
  category?: string
}

// Custom material
interface CustomMaterial {
  name: string
  prompt: string
  color?: string
  displayName?: string
}

// Pipeline stage
interface PipelineStage {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  status: 'idle' | 'active' | 'completed' | 'failed' | 'skipped'
}

// Mesh fitting parameters
interface MeshFittingParameters {
  iterations: number
  stepSize: number
  smoothingRadius: number
  smoothingStrength: number
  targetOffset: number
  sampleRate: number
  preserveFeatures: boolean
  featureAngleThreshold: number
  useImprovedShrinkwrap: boolean
  preserveOpenings: boolean
  pushInteriorVertices: boolean
  showDebugArrows?: boolean
  debugArrowDensity?: number
  debugColorMode?: 'direction' | 'magnitude' | 'sidedness'
}

// Helmet fitting parameters
interface HelmetFittingParameters {
  method: 'auto' | 'manual'
  sizeMultiplier: number
  fitTightness: number
  verticalOffset: number
  forwardOffset: number
  rotation: { x: number; y: number; z: number }
}
```

---

## Usage Patterns

### Pattern 1: Store-Connected Component

Components that need global state access use Zustand stores:

```typescript
import { useGenerationStore } from '@/store'

export const MyComponent: React.FC = () => {
  const {
    stateValue,
    actionMethod
  } = useGenerationStore()

  return (
    <div>
      <span>{stateValue}</span>
      <button onClick={actionMethod}>Action</button>
    </div>
  )
}
```

### Pattern 2: Forwarded Ref Component

Components exposing imperative handles:

```typescript
export interface MyComponentRef {
  doSomething: () => void
}

export const MyComponent = forwardRef<MyComponentRef, MyComponentProps>(
  (props, ref) => {
    useImperativeHandle(ref, () => ({
      doSomething: () => {
        // Implementation
      }
    }))

    return <div>{/* JSX */}</div>
  }
)
```

### Pattern 3: Modal Component

Consistent modal structure:

```typescript
export const MyModal: React.FC<MyModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title="My Modal" />
      <ModalBody>
        {/* Content */}
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose} variant="ghost">Cancel</Button>
        <Button onClick={onSave}>Save</Button>
      </ModalFooter>
    </Modal>
  )
}
```

---

## Component Testing Approach

While Asset Forge prioritizes real gameplay testing, component testing follows these principles:

1. **Integration over Unit**: Test components integrated with their stores
2. **User Interactions**: Simulate real user workflows
3. **Visual Verification**: Screenshot comparison for 3D components
4. **No Mocks**: Use real services and stores

Example test structure:

```typescript
describe('GenerationPage', () => {
  it('completes full generation workflow', async () => {
    // 1. Render page
    const { container } = render(<GenerationPage />)

    // 2. Select generation type
    await userEvent.click(screen.getByText('Item'))

    // 3. Fill form
    await userEvent.type(screen.getByLabelText('Asset Name'), 'Iron Sword')

    // 4. Start generation
    await userEvent.click(screen.getByText('Start Generation'))

    // 5. Verify pipeline stages
    expect(screen.getByText('Image Generation')).toBeInTheDocument()

    // 6. Wait for completion
    await waitFor(() => {
      expect(screen.getByText('View Results')).toBeEnabled()
    })
  })
})
```

---

## Summary

The Asset Forge component architecture demonstrates:

- **Clear separation of concerns**: 77+ components organized by domain
- **Reusable primitives**: 12 common components provide consistency
- **Complex state management**: Zustand stores prevent prop drilling
- **Type safety**: Comprehensive TypeScript interfaces
- **3D integration**: Shared `ThreeViewer` powers all visualization
- **Workflow-oriented**: Components aligned to user tasks

This architecture supports rapid feature development while maintaining code quality and performance across a complex 3D asset pipeline application.
