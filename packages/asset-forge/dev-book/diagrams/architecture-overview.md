# Architecture Overview

This document provides comprehensive architectural diagrams illustrating the structure, layers, and component relationships within Asset Forge.

## System Architecture Layers

Asset Forge follows a layered architecture pattern with clear separation of concerns:

```mermaid
graph TB
    subgraph "Presentation Layer"
        UI[React UI Components]
        Pages[Page Components]
        Navigation[Navigation System]
    end

    subgraph "State Management Layer"
        GenStore[Generation Store]
        AssetStore[Assets Store]
        FittingStore[Armor Fitting Store]
        RiggingStore[Hand Rigging Store]
        DebugStore[Debugger Store]
    end

    subgraph "Business Logic Layer"
        GenAPI[Generation API Client]
        AssetService[Asset Service]
        PromptService[Prompt Service]
        FittingService[Armor Fitting Service]
        RiggingService[Hand Rigging Service]
        SpriteService[Sprite Generation Service]
    end

    subgraph "Backend Layer"
        API[Express API Server]
        Pipeline[Pipeline Manager]
        FileServer[File Server]
    end

    subgraph "External Services Layer"
        OpenAI[OpenAI API<br/>GPT-4 & DALL-E]
        Meshy[Meshy.ai API<br/>3D Generation]
        MediaPipe[MediaPipe<br/>Hand Detection]
    end

    subgraph "Data Layer"
        Assets[Asset Files<br/>GLB/PNG/JSON]
        LocalStorage[Browser LocalStorage]
    end

    UI --> GenStore
    UI --> AssetStore
    UI --> FittingStore
    UI --> RiggingStore
    Pages --> UI
    Navigation --> Pages

    GenStore --> GenAPI
    AssetStore --> AssetService
    FittingStore --> FittingService
    RiggingStore --> RiggingService

    GenAPI --> API
    AssetService --> API
    PromptService --> OpenAI

    API --> Pipeline
    API --> FileServer
    Pipeline --> OpenAI
    Pipeline --> Meshy

    FittingService --> Assets
    RiggingService --> MediaPipe
    SpriteService --> Assets

    GenStore --> LocalStorage
    AssetStore --> Assets
    FileServer --> Assets

    classDef presentation fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef state fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef logic fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef backend fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef external fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef data fill:#e0f2f1,stroke:#00796b,stroke-width:2px

    class UI,Pages,Navigation presentation
    class GenStore,AssetStore,FittingStore,RiggingStore,DebugStore state
    class GenAPI,AssetService,PromptService,FittingService,RiggingService,SpriteService logic
    class API,Pipeline,FileServer backend
    class OpenAI,Meshy,MediaPipe external
    class Assets,LocalStorage data
```

## Frontend Architecture

### Component Hierarchy

```mermaid
graph TB
    App[App.tsx]
    AppProvider[AppProvider Context]
    NavProvider[NavigationProvider Context]
    ErrorBoundary[ErrorBoundary]

    Nav[Navigation Component]
    NotificationBar[NotificationBar]

    subgraph "Pages"
        GenPage[GenerationPage]
        AssetsPage[AssetsPage]
        ArmorPage[ArmorFittingPage]
        HandPage[HandRiggingPage]
        EquipPage[EquipmentPage]
    end

    subgraph "Generation Components"
        GenConfig[GenerationConfig]
        GenProgress[GenerationProgress]
        GenResults[GenerationResults]
        MaterialSelector[MaterialSelector]
        AssetTypeEditor[AssetTypeEditor]
    end

    subgraph "Asset Components"
        AssetGrid[AssetGrid]
        AssetCard[AssetCard]
        AssetViewer[AssetViewer]
        AssetFilters[AssetFilters]
        ModelViewer3D[ModelViewer3D]
    end

    subgraph "Armor Fitting Components"
        FittingViewer[ArmorFittingViewer]
        FittingControls[ArmorFittingControls]
        FittingProgress[FittingProgress]
        ArmorAssetList[ArmorAssetList]
        MeshDebugger[MeshFittingDebugger]
    end

    subgraph "Hand Rigging Components"
        HandModelViewer[ModelViewer]
        HandResults[RiggingResults]
        HandSteps[HandProcessingSteps]
        HandDebug[DebugImages]
        HandStats[ModelStats]
    end

    App --> AppProvider
    AppProvider --> NavProvider
    NavProvider --> ErrorBoundary
    ErrorBoundary --> Nav
    ErrorBoundary --> NotificationBar
    ErrorBoundary --> GenPage
    ErrorBoundary --> AssetsPage
    ErrorBoundary --> ArmorPage
    ErrorBoundary --> HandPage
    ErrorBoundary --> EquipPage

    GenPage --> GenConfig
    GenPage --> GenProgress
    GenPage --> GenResults
    GenConfig --> MaterialSelector
    GenConfig --> AssetTypeEditor

    AssetsPage --> AssetGrid
    AssetsPage --> AssetFilters
    AssetGrid --> AssetCard
    AssetCard --> AssetViewer
    AssetViewer --> ModelViewer3D

    ArmorPage --> FittingViewer
    ArmorPage --> FittingControls
    ArmorPage --> FittingProgress
    ArmorPage --> ArmorAssetList
    FittingViewer --> MeshDebugger

    HandPage --> HandModelViewer
    HandPage --> HandResults
    HandPage --> HandSteps
    HandPage --> HandDebug
    HandPage --> HandStats

    classDef root fill:#ffebee,stroke:#c62828,stroke-width:3px
    classDef page fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef component fill:#fff3e0,stroke:#f57c00,stroke-width:2px

    class App root
    class GenPage,AssetsPage,ArmorPage,HandPage,EquipPage page
    class GenConfig,GenProgress,GenResults,MaterialSelector,AssetGrid,AssetCard,FittingViewer,HandModelViewer component
```

### Service Layer Architecture

```mermaid
graph LR
    subgraph "API Services"
        GenAPIClient[GenerationAPIClient]
        AssetSvc[AssetService]
        PromptSvc[PromptService]
    end

    subgraph "Processing Services"
        FittingSvc[ArmorFittingService]
        MeshFitSvc[MeshFittingService]
        WeightTransferSvc[WeightTransferService]
        ScaleFixer[ArmorScaleFixer]
        BoneDiag[BoneDiagnostics]
    end

    subgraph "Rigging Services"
        HandRiggingSvc[HandRiggingService]
        SimpleRiggingSvc[SimpleHandRiggingService]
        PoseDetectionSvc[HandPoseDetectionService]
        SegmentationSvc[HandSegmentationService]
        OrthoRenderer[OrthographicHandRenderer]
        HandleDetector[WeaponHandleDetector]
    end

    subgraph "Generation Services"
        SpriteSvc[SpriteGenerationService]
        NormalizationSvc[AssetNormalizationService]
        CreatureScalingSvc[CreatureScalingService]
    end

    subgraph "External Dependencies"
        ThreeJS[Three.js]
        MediaPipeLib[MediaPipe]
        TensorFlow[TensorFlow.js]
    end

    GenAPIClient --> PromptSvc

    FittingSvc --> MeshFitSvc
    FittingSvc --> WeightTransferSvc
    FittingSvc --> ScaleFixer
    FittingSvc --> BoneDiag

    HandRiggingSvc --> SimpleRiggingSvc
    HandRiggingSvc --> PoseDetectionSvc
    HandRiggingSvc --> SegmentationSvc
    HandRiggingSvc --> OrthoRenderer
    SimpleRiggingSvc --> HandleDetector

    SpriteSvc --> ThreeJS
    NormalizationSvc --> ThreeJS
    CreatureScalingSvc --> ThreeJS

    MeshFitSvc --> ThreeJS
    WeightTransferSvc --> ThreeJS
    ScaleFixer --> ThreeJS

    PoseDetectionSvc --> MediaPipeLib
    PoseDetectionSvc --> TensorFlow
    SegmentationSvc --> MediaPipeLib
    OrthoRenderer --> ThreeJS
    HandleDetector --> ThreeJS

    classDef api fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef processing fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef rigging fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef generation fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef external fill:#fce4ec,stroke:#c2185b,stroke-width:2px

    class GenAPIClient,AssetSvc,PromptSvc api
    class FittingSvc,MeshFitSvc,WeightTransferSvc,ScaleFixer,BoneDiag processing
    class HandRiggingSvc,SimpleRiggingSvc,PoseDetectionSvc,SegmentationSvc,OrthoRenderer,HandleDetector rigging
    class SpriteSvc,NormalizationSvc,CreatureScalingSvc generation
    class ThreeJS,MediaPipeLib,TensorFlow external
```

## Backend Architecture

### API Server Structure

```mermaid
graph TB
    Client[React Frontend]

    subgraph "Express API Server"
        Router[API Router]

        subgraph "Endpoints"
            AssetsAPI[/api/assets/*]
            GenAPI[/api/generation/*]
            RetexAPI[/api/retexture/*]
            FittingAPI[/api/fitting/*]
            RiggingAPI[/api/hand-rigging/*]
        end

        subgraph "Middleware"
            CORS[CORS Middleware]
            JSON[JSON Parser]
            ErrorHandler[Error Handler]
        end

        subgraph "Services"
            PipelineMgr[Pipeline Manager]
            FileHandler[File Handler]
            ImageServer[Image Server]
        end
    end

    subgraph "External APIs"
        OpenAIAPI[OpenAI API]
        MeshyAPI[Meshy.ai API]
    end

    subgraph "File System"
        AssetDir[gdd-assets/]
        TempDir[temp/]
    end

    Client -->|HTTP Request| Router
    Router --> CORS
    CORS --> JSON
    JSON --> AssetsAPI
    JSON --> GenAPI
    JSON --> RetexAPI
    JSON --> FittingAPI
    JSON --> RiggingAPI

    AssetsAPI --> FileHandler
    GenAPI --> PipelineMgr
    RetexAPI --> PipelineMgr

    PipelineMgr --> OpenAIAPI
    PipelineMgr --> MeshyAPI

    FileHandler --> AssetDir
    PipelineMgr --> AssetDir
    PipelineMgr --> TempDir
    ImageServer --> AssetDir

    ErrorHandler --> Client

    classDef client fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef server fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef endpoint fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef middleware fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef service fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef external fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef storage fill:#e0f2f1,stroke:#00796b,stroke-width:2px

    class Client client
    class Router server
    class AssetsAPI,GenAPI,RetexAPI,FittingAPI,RiggingAPI endpoint
    class CORS,JSON,ErrorHandler middleware
    class PipelineMgr,FileHandler,ImageServer service
    class OpenAIAPI,MeshyAPI external
    class AssetDir,TempDir storage
```

## Data Flow Architecture

### Asset Generation Data Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant Store as Zustand Store
    participant APIClient as API Client
    participant Backend as Express Backend
    participant OpenAI as OpenAI API
    participant Meshy as Meshy.ai API
    participant FS as File System

    User->>UI: Configure Generation
    UI->>Store: Update Config State
    User->>UI: Start Generation
    UI->>Store: Set isGenerating=true
    Store->>APIClient: startPipeline(config)
    APIClient->>Backend: POST /api/generation/pipeline

    Backend->>OpenAI: Enhance Prompt (GPT-4)
    OpenAI-->>Backend: Enhanced Description
    Backend->>OpenAI: Generate Image (DALL-E)
    OpenAI-->>Backend: Concept Art URL
    Backend->>Meshy: Create 3D Model
    Meshy-->>Backend: Task ID

    loop Polling
        Backend->>Meshy: Check Task Status
        Meshy-->>Backend: Status Update
        Backend-->>APIClient: Progress Update
        APIClient->>Store: Update Pipeline Stage
        Store->>UI: Re-render Progress
    end

    Meshy-->>Backend: Model Complete
    Backend->>FS: Download & Save GLB
    Backend->>FS: Save Metadata JSON
    Backend-->>APIClient: Pipeline Complete
    APIClient->>Store: Add Generated Asset
    Store->>UI: Update Asset List
    UI->>User: Show Completed Asset
```

### Armor Fitting Data Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Fitting UI
    participant Store as Fitting Store
    participant Service as Fitting Service
    participant MeshService as Mesh Fitting
    participant WeightService as Weight Transfer
    participant Three as Three.js

    User->>UI: Upload Character & Armor
    UI->>Three: Load GLB Models
    Three-->>UI: Scene Objects
    UI->>Store: Set Models

    User->>UI: Adjust Parameters
    UI->>Store: Update Parameters
    User->>UI: Start Fitting

    Store->>Service: performFitting(char, armor, params)
    Service->>Three: Analyze Skeleton
    Three-->>Service: Bone Structure

    Service->>MeshService: deformMesh(armor, character)
    MeshService->>Three: Raycast Projection
    Three-->>MeshService: Surface Points
    MeshService->>Three: Update Vertices
    MeshService-->>Service: Deformed Mesh

    Service->>WeightService: transferWeights(char, armor)
    WeightService->>Three: Find Nearest Vertices
    Three-->>WeightService: Vertex Mapping
    WeightService->>Three: Copy Skin Weights
    WeightService-->>Service: Weighted Mesh

    Service->>Three: Create SkinnedMesh
    Service->>Three: Bind to Skeleton
    Service-->>Store: Fitted Armor
    Store->>UI: Update Preview
    UI->>User: Show Fitted Result

    User->>UI: Export
    UI->>Three: Export GLB
    Three-->>UI: Binary Data
    UI->>User: Download File
```

## Technology Stack Integration

```mermaid
graph TB
    subgraph "Frontend Stack"
        React[React 19.2<br/>UI Framework]
        TypeScript[TypeScript 5.3<br/>Type Safety]
        Vite[Vite 6.0<br/>Build Tool]
        Tailwind[Tailwind CSS 3.3<br/>Styling]
    end

    subgraph "3D Graphics Stack"
        Three[Three.js 0.178<br/>WebGL Rendering]
        R3F[React Three Fiber 9.0<br/>React Integration]
        Drei[Drei 10.7<br/>Helper Components]
        BVH[three-mesh-bvh 0.9<br/>Optimization]
    end

    subgraph "State Management Stack"
        Zustand[Zustand 5.0<br/>State Stores]
        Immer[Immer 10.1<br/>Immutability]
        Persist[Persist Middleware<br/>LocalStorage]
        DevTools[DevTools Middleware<br/>Debugging]
    end

    subgraph "AI/ML Stack"
        MediaPipe[MediaPipe Hands 0.4<br/>Pose Detection]
        TensorFlow[TensorFlow.js 4.22<br/>ML Runtime]
        HandPose[Hand Pose Detection 2.0<br/>Model]
    end

    subgraph "Backend Stack"
        Node[Node.js 18+<br/>Runtime]
        Express[Express 4.18<br/>Web Server]
        Fetch[node-fetch 3.3<br/>HTTP Client]
        dotenv[dotenv 16.3<br/>Config]
    end

    subgraph "External APIs"
        OpenAIAPI[OpenAI API<br/>GPT-4 & DALL-E]
        MeshyAPI[Meshy.ai API<br/>3D Generation]
    end

    React --> TypeScript
    React --> Vite
    React --> Tailwind
    React --> Zustand
    React --> R3F

    R3F --> Three
    R3F --> Drei
    Three --> BVH

    Zustand --> Immer
    Zustand --> Persist
    Zustand --> DevTools

    MediaPipe --> TensorFlow
    HandPose --> TensorFlow

    Express --> Node
    Express --> Fetch
    Express --> dotenv

    Fetch --> OpenAIAPI
    Fetch --> MeshyAPI

    classDef frontend fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef graphics fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef state fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef ml fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef backend fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef external fill:#ffebee,stroke:#c62828,stroke-width:2px

    class React,TypeScript,Vite,Tailwind frontend
    class Three,R3F,Drei,BVH graphics
    class Zustand,Immer,Persist,DevTools state
    class MediaPipe,TensorFlow,HandPose ml
    class Node,Express,Fetch,dotenv backend
    class OpenAIAPI,MeshyAPI external
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        DevFrontend[Vite Dev Server<br/>Port 3000]
        DevBackend[Express API<br/>Port 3001]
        DevImages[Image Server<br/>Port 3004]
    end

    subgraph "Production Environment"
        Proxy[Reverse Proxy<br/>Nginx/Caddy]
        StaticFiles[Static Files<br/>Vite Build]
        ProdBackend[Express API<br/>Production Mode]
        ProdImages[Image Server<br/>Production Mode]
    end

    subgraph "External Services"
        OpenAI[OpenAI API]
        Meshy[Meshy.ai API]
        CDN[CDN<br/>Optional]
    end

    subgraph "Storage"
        LocalFS[Local File System<br/>gdd-assets/]
        CloudStorage[Cloud Storage<br/>Optional S3/GCS]
    end

    Browser[Web Browser]

    Browser -->|Dev Mode| DevFrontend
    DevFrontend -->|Proxy API| DevBackend
    DevFrontend -->|Proxy Images| DevImages

    Browser -->|Production| Proxy
    Proxy -->|Static Assets| StaticFiles
    Proxy -->|API Requests| ProdBackend
    Proxy -->|Image Requests| ProdImages

    DevBackend --> OpenAI
    DevBackend --> Meshy
    ProdBackend --> OpenAI
    ProdBackend --> Meshy

    DevBackend --> LocalFS
    DevImages --> LocalFS
    ProdBackend --> LocalFS
    ProdBackend -.->|Optional| CloudStorage
    ProdImages --> LocalFS
    ProdImages -.->|Optional| CloudStorage

    StaticFiles -.->|Optional| CDN

    classDef dev fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef prod fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef storage fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef client fill:#fce4ec,stroke:#c2185b,stroke-width:2px

    class DevFrontend,DevBackend,DevImages dev
    class Proxy,StaticFiles,ProdBackend,ProdImages prod
    class OpenAI,Meshy,CDN external
    class LocalFS,CloudStorage storage
    class Browser client
```

## Security Architecture

```mermaid
graph TB
    subgraph "Client Security"
        EnvVars[Environment Variables<br/>.env file]
        HTTPS[HTTPS Transport]
        CSP[Content Security Policy]
    end

    subgraph "API Security"
        CORS[CORS Configuration]
        RateLimit[Rate Limiting<br/>Optional]
        InputValid[Input Validation]
        ErrorHandling[Error Sanitization]
    end

    subgraph "External API Security"
        APIKeys[API Key Management]
        SecureStorage[Secure Key Storage]
        KeyRotation[Key Rotation<br/>Manual]
    end

    subgraph "Data Security"
        FileAccess[File Access Control]
        PathValidation[Path Traversal Prevention]
        TempCleanup[Temporary File Cleanup]
    end

    Browser[Web Browser]
    Frontend[React Frontend]
    Backend[Express Backend]
    External[External APIs]
    FS[File System]

    Browser --> HTTPS
    HTTPS --> Frontend
    Frontend --> EnvVars
    Frontend --> CSP

    Frontend --> CORS
    CORS --> Backend
    Backend --> RateLimit
    Backend --> InputValid
    Backend --> ErrorHandling

    Backend --> APIKeys
    APIKeys --> SecureStorage
    SecureStorage --> External

    Backend --> FileAccess
    Backend --> PathValidation
    Backend --> TempCleanup
    FileAccess --> FS

    classDef client fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef api fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef data fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef actor fill:#fce4ec,stroke:#c2185b,stroke-width:2px

    class EnvVars,HTTPS,CSP client
    class CORS,RateLimit,InputValid,ErrorHandling api
    class APIKeys,SecureStorage,KeyRotation external
    class FileAccess,PathValidation,TempCleanup data
    class Browser,Frontend,Backend,External,FS actor
```

## Performance Optimization Architecture

```mermaid
graph LR
    subgraph "Frontend Optimization"
        CodeSplit[Code Splitting<br/>Route-based]
        LazyLoad[Lazy Loading<br/>Components]
        Memoization[React.memo<br/>useMemo]
        Virtualization[Virtual Scrolling<br/>Large Lists]
    end

    subgraph "3D Optimization"
        LOD[Level of Detail<br/>Quality Settings]
        TexCompression[Texture Compression<br/>Optional KTX2]
        GeomCache[Geometry Caching]
        RenderOpt[Render Optimization<br/>Frustum Culling]
    end

    subgraph "State Optimization"
        Selectors[Selective Subscriptions]
        Partitioning[State Partitioning<br/>Multiple Stores]
        Persistence[Smart Persistence<br/>Partial State]
    end

    subgraph "Network Optimization"
        Caching[HTTP Caching<br/>ETags]
        Compression[Response Compression<br/>gzip/brotli]
        Bundling[Asset Bundling<br/>GLB Format]
    end

    subgraph "Build Optimization"
        TreeShake[Tree Shaking]
        Minification[Code Minification]
        AssetOpt[Asset Optimization<br/>Images, Fonts]
    end

    User[User Experience]

    CodeSplit --> User
    LazyLoad --> User
    Memoization --> User
    Virtualization --> User

    LOD --> User
    TexCompression --> User
    GeomCache --> User
    RenderOpt --> User

    Selectors --> User
    Partitioning --> User
    Persistence --> User

    Caching --> User
    Compression --> User
    Bundling --> User

    TreeShake --> User
    Minification --> User
    AssetOpt --> User

    classDef frontend fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef graphics fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef state fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef network fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef build fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef user fill:#ffebee,stroke:#c62828,stroke-width:2px

    class CodeSplit,LazyLoad,Memoization,Virtualization frontend
    class LOD,TexCompression,GeomCache,RenderOpt graphics
    class Selectors,Partitioning,Persistence state
    class Caching,Compression,Bundling network
    class TreeShake,Minification,AssetOpt build
    class User user
```

---

## Architecture Principles

### Separation of Concerns
- **Presentation Layer**: Handles UI rendering and user interactions
- **State Management Layer**: Manages application state with Zustand
- **Business Logic Layer**: Implements core functionality in services
- **Backend Layer**: Provides APIs and orchestrates external services
- **Data Layer**: Persists assets and configuration

### Modularity
- Services are self-contained and focused on specific responsibilities
- Components are composable and reusable
- Stores are domain-specific (generation, assets, fitting, rigging)
- Clear interfaces between layers

### Scalability
- Asynchronous operations for non-blocking UX
- Lazy loading reduces initial bundle size
- State partitioning prevents bottlenecks
- File-based storage scales horizontally

### Maintainability
- TypeScript provides type safety and documentation
- Consistent naming conventions and folder structure
- Comprehensive error handling
- Extensive logging for debugging

### Extensibility
- Plugin-ready architecture for future extensions
- Abstract interfaces for swappable implementations
- Configuration-driven behavior
- Event-based communication for loose coupling

---

This architectural overview provides a comprehensive understanding of Asset Forge's structure, dependencies, and design patterns. For detailed information about specific components, refer to the relevant sections of the documentation.
