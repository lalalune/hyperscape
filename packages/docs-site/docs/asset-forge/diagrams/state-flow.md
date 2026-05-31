# State Management Flow Diagrams

This document provides comprehensive diagrams illustrating Asset Forge's state management architecture using Zustand, including store interactions, middleware flow, and state synchronization patterns.

## Store Architecture Overview

```mermaid
graph TB
    subgraph "Zustand Store Layer"
        GenStore[Generation Store<br/>useGenerationStore]
        AssetStore[Assets Store<br/>useAssetsStore]
        FitStore[Armor Fitting Store<br/>useArmorFittingStore]
        RigStore[Hand Rigging Store<br/>useHandRiggingStore]
        DebugStore[Debugger Store<br/>useDebuggerStore]
    end

    subgraph "Middleware Stack"
        Immer[Immer Middleware<br/>Immutable Updates]
        Persist[Persist Middleware<br/>LocalStorage Sync]
        Subscribe[SubscribeWithSelector<br/>Granular Subscriptions]
        DevTools[DevTools Middleware<br/>Redux DevTools]
    end

    subgraph "Components"
        GenPage[Generation Page]
        AssetPage[Assets Page]
        FitPage[Fitting Page]
        RigPage[Rigging Page]
    end

    subgraph "Services"
        GenAPI[Generation API]
        AssetSvc[Asset Service]
        FitSvc[Fitting Service]
        RigSvc[Rigging Service]
    end

    subgraph "Persistence"
        LocalStorage[Browser LocalStorage]
    end

    GenPage --> GenStore
    AssetPage --> AssetStore
    FitPage --> FitStore
    RigPage --> RigStore

    GenStore --> Immer
    AssetStore --> Immer
    FitStore --> Immer
    RigStore --> Immer
    DebugStore --> Immer

    Immer --> Subscribe
    Subscribe --> Persist
    Persist --> DevTools

    Persist --> LocalStorage

    GenStore --> GenAPI
    AssetStore --> AssetSvc
    FitStore --> FitSvc
    RigStore --> RigSvc

    GenAPI -.->|Updates| GenStore
    AssetSvc -.->|Updates| AssetStore
    FitSvc -.->|Updates| FitStore
    RigSvc -.->|Updates| RigStore

    classDef store fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef middleware fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef component fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef service fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef storage fill:#fce4ec,stroke:#c2185b,stroke-width:2px

    class GenStore,AssetStore,FitStore,RigStore,DebugStore store
    class Immer,Persist,Subscribe,DevTools middleware
    class GenPage,AssetPage,FitPage,RigPage component
    class GenAPI,AssetSvc,FitSvc,RigSvc service
    class LocalStorage storage
```

## Generation Store State Flow

### State Structure

```mermaid
classDiagram
    class GenerationStore {
        +generationType: 'item' | 'avatar'
        +activeView: 'config' | 'progress' | 'results'
        +assetName: string
        +assetType: string
        +description: string
        +quality: 'standard' | 'high' | 'ultra'
        +materialPresets: MaterialPreset[]
        +selectedMaterials: string[]
        +isGenerating: boolean
        +pipelineStages: PipelineStage[]
        +generatedAssets: GeneratedAsset[]

        +setGenerationType(type)
        +setActiveView(view)
        +setAssetName(name)
        +setQuality(q)
        +toggleMaterialSelection(id)
        +setIsGenerating(bool)
        +updatePipelineStage(id, status)
        +addGeneratedAsset(asset)
        +resetForm()
        +resetPipeline()
    }

    class MaterialPreset {
        +id: string
        +name: string
        +displayName: string
        +category: string
        +tier: number
        +color: string
        +stylePrompt: string
    }

    class PipelineStage {
        +id: string
        +name: string
        +status: 'idle' | 'active' | 'completed' | 'failed' | 'skipped'
    }

    class GeneratedAsset {
        +id: string
        +name: string
        +modelUrl: string
        +conceptArtUrl: string
        +variants: Asset[]
        +status: string
    }

    GenerationStore --> MaterialPreset
    GenerationStore --> PipelineStage
    GenerationStore --> GeneratedAsset
```

### Generation Workflow State Transitions

```mermaid
stateDiagram-v2
    [*] --> ConfigView: Page Load

    state ConfigView {
        [*] --> FormEmpty
        FormEmpty --> FormFilled: User Enters Data
        FormFilled --> FormValidating: Click Generate
        FormValidating --> FormEmpty: Validation Failed
        FormValidating --> GenerationStarted: Valid
    }

    GenerationStarted --> ProgressView

    state ProgressView {
        [*] --> TextInput
        TextInput --> GPT4Enhancement
        GPT4Enhancement --> ImageGeneration
        ImageGeneration --> ModelGeneration
        ModelGeneration --> Retexturing
        Retexturing --> Rigging
        Rigging --> Sprites
        Sprites --> Finalizing

        TextInput --> Failed: Error
        GPT4Enhancement --> Failed: Error
        ImageGeneration --> Failed: Error
        ModelGeneration --> Failed: Error
        Retexturing --> Failed: Error
        Rigging --> PartialSuccess: Non-Critical Error
        Sprites --> PartialSuccess: Non-Critical Error

        Finalizing --> [*]: Complete
        Failed --> [*]: Error
        PartialSuccess --> [*]: Partial
    }

    ProgressView --> ResultsView: Generation Complete

    state ResultsView {
        [*] --> ViewingAsset
        ViewingAsset --> ViewingVariant: Select Variant
        ViewingVariant --> ViewingAsset: Back to Base
        ViewingAsset --> ExportingAsset: Export
        ExportingAsset --> ViewingAsset: Export Complete
    }

    ResultsView --> ConfigView: Start New Generation
    ResultsView --> [*]: Navigate Away
```

### Action Flow Example: Starting Generation

```mermaid
sequenceDiagram
    participant User
    participant GenPage as Generation Page
    participant Store as Generation Store
    participant Immer as Immer Middleware
    participant API as API Client
    participant Backend
    participant LocalStorage

    User->>GenPage: Click "Generate"
    GenPage->>Store: setIsGenerating(true)

    Note over Store,Immer: Immer produces<br/>new immutable state

    Store->>Immer: Draft State Update
    Immer->>Immer: state.isGenerating = true
    Immer->>Store: New State Object

    Store->>GenPage: Trigger Re-render
    Store->>LocalStorage: Persist State (async)

    GenPage->>Store: initializePipelineStages()
    Store->>Immer: Update Pipeline Stages
    Immer->>Store: New State with Stages

    GenPage->>API: startPipeline(config)
    API->>Backend: POST /api/generation/pipeline
    Backend-->>API: Pipeline ID

    API->>Store: setCurrentPipelineId(id)
    Store->>Immer: state.currentPipelineId = id
    Immer->>Store: New State
    Store->>GenPage: Re-render with Pipeline ID

    loop Poll Progress
        API->>Backend: GET /api/generation/pipeline/:id
        Backend-->>API: Pipeline Status
        API->>Store: updatePipelineStage(stageId, status)
        Store->>Immer: Update Stage Status
        Immer->>Store: New State
        Store->>GenPage: Re-render Progress
    end

    Backend-->>API: Pipeline Complete
    API->>Store: addGeneratedAsset(asset)
    Store->>Immer: state.generatedAssets.push(asset)
    Immer->>Store: New State

    Store->>Store: setIsGenerating(false)
    Store->>Store: setActiveView('results')
    Store->>GenPage: Final Re-render
```

## Assets Store State Flow

### Asset Management State Structure

```mermaid
classDiagram
    class AssetsStore {
        +assets: Asset[]
        +selectedAsset: Asset | null
        +filterType: string | null
        +filterTier: number | null
        +searchQuery: string
        +viewMode: 'grid' | 'list'
        +isLoading: boolean

        +loadAssets()
        +setAssets(assets)
        +selectAsset(asset)
        +setFilterType(type)
        +setFilterTier(tier)
        +setSearchQuery(query)
        +deleteAsset(id)
        +updateAsset(id, updates)
        +getFilteredAssets()
    }

    class Asset {
        +id: string
        +name: string
        +type: string
        +tier: number
        +modelUrl: string
        +metadata: AssetMetadata
        +createdAt: string
    }

    class AssetMetadata {
        +description: string
        +generationMethod: string
        +hasModel: boolean
        +isRigged: boolean
        +variants: string[]
    }

    AssetsStore --> Asset
    Asset --> AssetMetadata
```

### Asset Loading Flow

```mermaid
flowchart TB
    Start([Component Mount])

    CheckCache{Assets in<br/>Store?}
    UseCache[Use Cached Assets]
    SetLoading[Set isLoading = true]

    FetchAPI[Call AssetService.loadAssets]
    ParseResponse[Parse API Response]
    ValidateAssets{Valid<br/>Asset Data?}

    UpdateStore[Store.setAssets(assets)]
    UpdateLoading[Set isLoading = false]
    TriggerRender[Re-render Components]

    HandleError[Log Error]
    ShowError[Display Error Message]

    Complete([Assets Loaded])

    Start --> CheckCache
    CheckCache -->|Yes| UseCache
    CheckCache -->|No| SetLoading
    UseCache --> Complete

    SetLoading --> FetchAPI
    FetchAPI --> ParseResponse
    ParseResponse --> ValidateAssets

    ValidateAssets -->|Valid| UpdateStore
    ValidateAssets -->|Invalid| HandleError

    UpdateStore --> UpdateLoading
    UpdateLoading --> TriggerRender
    TriggerRender --> Complete

    HandleError --> ShowError
    ShowError --> UpdateLoading

    classDef process fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef decision fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef endpoint fill:#e8f5e9,stroke:#388e3c,stroke-width:2px

    class CheckCache,ValidateAssets decision
    class FetchAPI,ParseResponse,UpdateStore,UpdateLoading,TriggerRender process
    class HandleError,ShowError error
    class Start,Complete endpoint
```

### Asset Filtering State Flow

```mermaid
stateDiagram-v2
    [*] --> AllAssets: Initial Load

    state FilteringLogic {
        AllAssets --> FilterByType: Set Filter Type
        AllAssets --> FilterByTier: Set Filter Tier
        AllAssets --> FilterBySearch: Enter Search

        FilterByType --> MultipleFilters: Add Tier Filter
        FilterByTier --> MultipleFilters: Add Type Filter
        FilterBySearch --> MultipleFilters: Add Other Filters

        MultipleFilters --> FilterByType: Remove Tier
        MultipleFilters --> FilterByTier: Remove Type
        MultipleFilters --> FilterBySearch: Clear Search
    }

    FilterByType --> DisplayFiltered
    FilterByTier --> DisplayFiltered
    FilterBySearch --> DisplayFiltered
    MultipleFilters --> DisplayFiltered

    DisplayFiltered --> AllAssets: Clear All Filters

    note right of MultipleFilters
        Filters are combined with AND logic:
        - Type: "weapon"
        - Tier: 3
        - Search: "sword"
        Result: Tier 3 swords only
    end note
```

## Armor Fitting Store State Flow

### Fitting State Structure

```mermaid
classDiagram
    class ArmorFittingStore {
        +selectedAvatar: AvatarModel | null
        +selectedArmor: ArmorModel | null
        +fittingParameters: FittingParams
        +isProcessing: boolean
        +isFitted: boolean
        +fittedMesh: SkinnedMesh | null
        +showHull: boolean
        +showDebug: boolean

        +setSelectedAvatar(avatar)
        +setSelectedArmor(armor)
        +updateFittingParameters(params)
        +setIsProcessing(bool)
        +setFittedMesh(mesh)
        +toggleHull()
        +toggleDebug()
        +reset()
    }

    class FittingParams {
        +offset: number
        +sampleDensity: number
        +smoothingIterations: number
        +method: 'shrinkwrap' | 'closest'
    }

    class AvatarModel {
        +id: string
        +name: string
        +skeleton: Skeleton
        +mesh: SkinnedMesh
    }

    class ArmorModel {
        +id: string
        +name: string
        +mesh: Mesh
    }

    ArmorFittingStore --> FittingParams
    ArmorFittingStore --> AvatarModel
    ArmorFittingStore --> ArmorModel
```

### Fitting Process State Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Fitting UI
    participant Store as Fitting Store
    participant Service as Fitting Service
    participant Three as Three.js

    User->>UI: Upload Character
    UI->>Three: Load GLB
    Three-->>UI: Parsed Model
    UI->>Store: setSelectedAvatar(model)
    Store->>UI: Re-render with Avatar

    User->>UI: Upload Armor
    UI->>Three: Load GLB
    Three-->>UI: Parsed Armor
    UI->>Store: setSelectedArmor(armor)
    Store->>UI: Re-render with Armor

    User->>UI: Adjust Parameters
    UI->>Store: updateFittingParameters(params)
    Store->>UI: Re-render Preview

    User->>UI: Click "Fit Armor"
    UI->>Store: setIsProcessing(true)
    Store->>UI: Show Processing State

    Store->>Service: performFitting(avatar, armor, params)

    Service->>Service: Analyze Skeleton
    Service->>Service: Deform Mesh (Shrinkwrap)
    Service->>Service: Transfer Weights
    Service->>Service: Create Skinned Mesh

    Service-->>Store: Fitted Mesh
    Store->>Store: setFittedMesh(mesh)
    Store->>Store: setIsFitted(true)
    Store->>Store: setIsProcessing(false)

    Store->>UI: Re-render with Fitted Result
    UI->>User: Display Success

    User->>UI: Toggle Debug View
    UI->>Store: toggleDebug()
    Store->>UI: Re-render with Debug Visuals
```

## Hand Rigging Store State Flow

### Rigging State Structure

```mermaid
classDiagram
    class HandRiggingStore {
        +weaponModel: WeaponModel | null
        +selectedHand: 'left' | 'right'
        +processingStage: RiggingStage
        +detectionResults: HandDetection[]
        +gripPoint: GripPoint | null
        +debugImages: DebugImage[]
        +isProcessing: boolean

        +setWeaponModel(model)
        +setSelectedHand(hand)
        +setProcessingStage(stage)
        +addDetectionResult(result)
        +setGripPoint(point)
        +addDebugImage(image)
        +reset()
    }

    class RiggingStage {
        <<enumeration>>
        HandleDetection
        OrthographicRender
        HandPoseDetection
        GripCalculation
        Complete
    }

    class HandDetection {
        +landmarks: Vector3[]
        +confidence: number
        +angle: number
    }

    class GripPoint {
        +position: Vector3
        +rotation: Euler
        +offset: Vector3
    }

    HandRiggingStore --> RiggingStage
    HandRiggingStore --> HandDetection
    HandRiggingStore --> GripPoint
```

### Rigging Process State Transitions

```mermaid
stateDiagram-v2
    [*] --> AwaitingWeapon: Initial State

    AwaitingWeapon --> WeaponLoaded: User Uploads Weapon
    WeaponLoaded --> HandleDetection: Start Process

    state HandleDetection {
        [*] --> AnalyzingGeometry
        AnalyzingGeometry --> SearchingHandle
        SearchingHandle --> HandleFound: Success
        SearchingHandle --> HandleNotFound: Failure
        HandleFound --> [*]
        HandleNotFound --> ManualSelection
        ManualSelection --> [*]
    }

    HandleDetection --> OrthographicRender: Handle Located

    state OrthographicRender {
        [*] --> SetupCamera
        SetupCamera --> RenderFront
        RenderFront --> RenderSide
        RenderSide --> RenderTop
        RenderTop --> RenderAngles
        RenderAngles --> CaptureImages
        CaptureImages --> [*]
    }

    OrthographicRender --> HandPoseDetection: Images Ready

    state HandPoseDetection {
        [*] --> InitMediaPipe
        InitMediaPipe --> ProcessImages
        ProcessImages --> DetectLandmarks
        DetectLandmarks --> ValidateDetections
        ValidateDetections --> AveragePoses: Valid
        ValidateDetections --> RetryDetection: Invalid
        RetryDetection --> ProcessImages
        AveragePoses --> [*]
    }

    HandPoseDetection --> GripCalculation: Poses Detected

    state GripCalculation {
        [*] --> Calculate3DPosition
        Calculate3DPosition --> CalculateRotation
        CalculateRotation --> ApplyOffsets
        ApplyOffsets --> ValidateGrip
        ValidateGrip --> [*]
    }

    GripCalculation --> Complete: Grip Calculated
    Complete --> ExportReady: Metadata Saved

    HandleDetection --> Failed: Critical Error
    OrthographicRender --> Failed: Render Error
    HandPoseDetection --> Failed: Detection Failed
    GripCalculation --> Failed: Calculation Error

    Failed --> AwaitingWeapon: Reset

    ExportReady --> [*]: Export Weapon
```

## Middleware Flow Details

### Immer Middleware Flow

```mermaid
sequenceDiagram
    participant Component
    participant Store
    participant Immer
    participant State

    Component->>Store: Call Action (e.g., setAssetName)
    Store->>Immer: Invoke Middleware

    Note over Immer: Create Draft State<br/>(Proxy Object)

    Immer->>Immer: Execute Action Function
    Note over Immer: Draft mutations:<br/>draft.assetName = "New Name"

    Immer->>Immer: Produce Immutable State
    Note over Immer: Draft → New Frozen Object

    Immer->>State: Replace State Reference
    State-->>Store: State Updated

    Store->>Store: Notify Subscribers
    Store->>Component: Trigger Re-render

    Component->>Component: Render with New State
```

### Persist Middleware Flow

```mermaid
flowchart TB
    ActionCalled[Action Called<br/>in Store]

    ImmutableState[Immer Produces<br/>New State]

    PersistCheck{Should<br/>Persist?}

    Partialize[Extract Persistable<br/>State Subset]

    Serialize[JSON.stringify<br/>State]

    WriteStorage[Write to<br/>LocalStorage]

    NotifyComponents[Notify<br/>Components]

    Skip[Skip<br/>Persistence]

    Complete([Action Complete])

    ActionCalled --> ImmutableState
    ImmutableState --> PersistCheck

    PersistCheck -->|Yes| Partialize
    PersistCheck -->|No| Skip

    Partialize --> Serialize
    Serialize --> WriteStorage
    WriteStorage --> NotifyComponents

    Skip --> NotifyComponents
    NotifyComponents --> Complete

    classDef process fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef decision fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    classDef storage fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef endpoint fill:#e8f5e9,stroke:#388e3c,stroke-width:2px

    class ActionCalled,ImmutableState,Partialize,Serialize,NotifyComponents process
    class PersistCheck decision
    class WriteStorage storage
    class Complete,Skip endpoint
```

### State Hydration on App Load

```mermaid
sequenceDiagram
    participant Browser
    participant App
    participant Store
    participant Persist as Persist Middleware
    participant LocalStorage

    Browser->>App: Load Application
    App->>Store: Initialize Stores

    Store->>Persist: Setup Persist Middleware
    Persist->>LocalStorage: Read Stored State

    alt State Found
        LocalStorage-->>Persist: JSON String
        Persist->>Persist: JSON.parse(state)
        Persist->>Persist: Validate State Structure

        alt Valid State
            Persist->>Store: Hydrate with Stored State
            Store->>Store: Merge with Default State
            Note over Store: Persisted values override<br/>default values
        else Invalid State
            Persist->>Persist: Log Warning
            Persist->>Store: Use Default State
            Store->>LocalStorage: Clear Invalid Data
        end
    else No Stored State
        LocalStorage-->>Persist: null
        Persist->>Store: Use Default State
    end

    Store->>App: Stores Ready
    App->>Browser: Render Application
```

## Cross-Store Communication

### Store Interaction Patterns

```mermaid
graph TB
    subgraph "Generation Flow"
        GenStore[Generation Store]
        GenComplete[Generation Complete]
        AssetStore[Assets Store]
    end

    subgraph "Fitting Flow"
        AssetStore2[Assets Store]
        SelectAsset[User Selects Asset]
        FitStore[Fitting Store]
    end

    subgraph "Export Flow"
        FitStore2[Fitting Store]
        ExportComplete[Export Complete]
        AssetStore3[Assets Store]
    end

    GenStore -->|addGeneratedAsset| GenComplete
    GenComplete -->|loadAssets| AssetStore

    AssetStore2 -->|selectAsset| SelectAsset
    SelectAsset -->|setSelectedArmor| FitStore

    FitStore2 -->|exportFitted| ExportComplete
    ExportComplete -->|updateAsset| AssetStore3

    classDef store fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef event fill:#fff3e0,stroke:#f57c00,stroke-width:2px

    class GenStore,AssetStore,AssetStore2,FitStore,FitStore2,AssetStore3 store
    class GenComplete,SelectAsset,ExportComplete event
```

### Event-Based Communication Example

```mermaid
sequenceDiagram
    participant GenStore as Generation Store
    participant AssetStore as Assets Store
    participant UI as Assets Page

    Note over GenStore: Generation completes
    GenStore->>GenStore: addGeneratedAsset(asset)

    GenStore->>GenStore: Emit 'asset-created' event
    Note over GenStore: Using custom event system<br/>or callback pattern

    GenStore->>AssetStore: Notify Asset Created
    AssetStore->>AssetStore: loadAssets()

    AssetStore->>AssetStore: Fetch updated asset list
    AssetStore->>UI: Trigger re-render

    UI->>UI: Display new asset in grid
```

## Performance Optimization Patterns

### Selective Subscriptions

```mermaid
flowchart LR
    Component[React Component]

    subgraph "Store State"
        Field1[assetName]
        Field2[description]
        Field3[isGenerating]
        Field4[pipelineStages]
        Field5[generatedAssets]
    end

    Selector[Zustand Selector<br/>state => state.isGenerating]

    ShallowCompare{Shallow<br/>Comparison}

    ReRender[Re-render<br/>Component]
    Skip[Skip<br/>Re-render]

    Component --> Selector
    Selector --> Field3

    Field3 --> ShallowCompare
    ShallowCompare -->|Changed| ReRender
    ShallowCompare -->|Unchanged| Skip

    Field1 -.->|Not subscribed| ShallowCompare
    Field2 -.->|Not subscribed| ShallowCompare
    Field4 -.->|Not subscribed| ShallowCompare
    Field5 -.->|Not subscribed| ShallowCompare

    classDef component fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef state fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef selector fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef decision fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    classDef action fill:#e8f5e9,stroke:#388e3c,stroke-width:2px

    class Component component
    class Field1,Field2,Field3,Field4,Field5 state
    class Selector selector
    class ShallowCompare decision
    class ReRender,Skip action
```

---

## State Management Best Practices

### 1. Single Responsibility
Each store manages a specific domain:
- **GenerationStore**: Pipeline configuration and execution
- **AssetsStore**: Asset library and filtering
- **ArmorFittingStore**: Fitting workflow state
- **HandRiggingStore**: Rigging workflow state
- **DebuggerStore**: Development utilities

### 2. Immutability
All state updates use Immer for guaranteed immutability:
```typescript
set((state) => {
  state.assetName = "New Name" // Looks mutable, actually immutable
})
```

### 3. Selective Subscriptions
Components subscribe only to needed state slices:
```typescript
const isGenerating = useGenerationStore(state => state.isGenerating)
// Only re-renders when isGenerating changes
```

### 4. Persistence Strategy
Only persist user preferences, not transient state:
- ✅ Persist: Configuration, selected materials, UI preferences
- ❌ Don't persist: Loading states, temporary data, large assets

### 5. State Normalization
Keep state flat and normalized:
- Assets stored as array, not nested tree
- Use IDs for relationships
- Compute derived state in selectors

---

This comprehensive state management documentation provides deep insight into Asset Forge's Zustand architecture, middleware stack, and state flow patterns. For implementation details, refer to the `/src/store/` directory.
