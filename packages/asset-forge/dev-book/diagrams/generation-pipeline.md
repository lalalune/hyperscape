# Generation Pipeline Flowcharts

This document provides comprehensive flowcharts and sequence diagrams illustrating the Asset Forge generation pipeline, from initial user input to completed 3D assets.

## Pipeline Overview

### Complete Generation Pipeline

```mermaid
graph TB
    Start([User Starts Generation])

    subgraph "Configuration Phase"
        Input[User Input<br/>Name, Type, Description]
        Config[Configure Options<br/>Quality, Materials, Sprites]
        Validate{Configuration<br/>Valid?}
    end

    subgraph "Text Processing Phase"
        GPT4Check{GPT-4<br/>Enhancement<br/>Enabled?}
        EnhancePrompt[Enhance Prompt<br/>with GPT-4]
        UseOriginal[Use Original<br/>Description]
        MergePrompt[Merge with<br/>Style Prompts]
    end

    subgraph "Image Generation Phase"
        CustomImage{Custom<br/>Reference<br/>Image?}
        GenerateImage[Generate Concept Art<br/>DALL-E 3]
        UseCustom[Use Custom Image]
        ImageReady[Concept Art Ready]
    end

    subgraph "3D Generation Phase"
        Submit3D[Submit to Meshy<br/>Image-to-3D]
        Poll3D[Poll Meshy Status<br/>Every 2-3 seconds]
        Check3D{Status?}
        Download3D[Download GLB Model]
        Save3D[Save to File System]
    end

    subgraph "Retexturing Phase"
        RetexCheck{Retexturing<br/>Enabled?}
        ForEachMaterial[For Each Material<br/>Variant]
        SubmitRetex[Submit Retexture<br/>Request to Meshy]
        PollRetex[Poll Retexture<br/>Status]
        CheckRetex{Status?}
        DownloadRetex[Download Variant<br/>GLB]
        SaveRetex[Save Variant]
        NextMaterial{More<br/>Materials?}
    end

    subgraph "Rigging Phase"
        RigCheck{Avatar +<br/>Rigging<br/>Enabled?}
        SubmitRig[Submit Auto-Rigging<br/>Request to Meshy]
        PollRig[Poll Rigging<br/>Status]
        CheckRig{Status?}
        DownloadRig[Download Rigged<br/>Model]
        SaveRig[Save Rigged Model]
    end

    subgraph "Sprite Generation Phase"
        SpriteCheck{Sprite<br/>Generation<br/>Enabled?}
        RenderAngles[Render Model<br/>at Multiple Angles]
        CaptureFrames[Capture PNG<br/>Screenshots]
        SaveSprites[Save Sprite<br/>Images]
    end

    subgraph "Finalization Phase"
        CreateMeta[Create Metadata<br/>JSON File]
        UpdateLibrary[Update Asset<br/>Library]
        NotifyUser[Notify User<br/>Generation Complete]
    end

    Complete([Pipeline Complete])
    Error([Error Handler])

    Start --> Input
    Input --> Config
    Config --> Validate
    Validate -->|Invalid| Input
    Validate -->|Valid| GPT4Check

    GPT4Check -->|Yes| EnhancePrompt
    GPT4Check -->|No| UseOriginal
    EnhancePrompt --> MergePrompt
    UseOriginal --> MergePrompt

    MergePrompt --> CustomImage
    CustomImage -->|No| GenerateImage
    CustomImage -->|Yes| UseCustom
    GenerateImage --> ImageReady
    UseCustom --> ImageReady

    ImageReady --> Submit3D
    Submit3D --> Poll3D
    Poll3D --> Check3D
    Check3D -->|Processing| Poll3D
    Check3D -->|Success| Download3D
    Check3D -->|Failed| Error
    Check3D -->|Timeout| Error
    Download3D --> Save3D

    Save3D --> RetexCheck
    RetexCheck -->|No| RigCheck
    RetexCheck -->|Yes| ForEachMaterial
    ForEachMaterial --> SubmitRetex
    SubmitRetex --> PollRetex
    PollRetex --> CheckRetex
    CheckRetex -->|Processing| PollRetex
    CheckRetex -->|Success| DownloadRetex
    CheckRetex -->|Failed| Error
    DownloadRetex --> SaveRetex
    SaveRetex --> NextMaterial
    NextMaterial -->|Yes| ForEachMaterial
    NextMaterial -->|No| RigCheck

    RigCheck -->|No| SpriteCheck
    RigCheck -->|Yes| SubmitRig
    SubmitRig --> PollRig
    PollRig --> CheckRig
    CheckRig -->|Processing| PollRig
    CheckRig -->|Success| DownloadRig
    CheckRig -->|Failed| Error
    DownloadRig --> SaveRig
    SaveRig --> SpriteCheck

    SpriteCheck -->|No| CreateMeta
    SpriteCheck -->|Yes| RenderAngles
    RenderAngles --> CaptureFrames
    CaptureFrames --> SaveSprites
    SaveSprites --> CreateMeta

    CreateMeta --> UpdateLibrary
    UpdateLibrary --> NotifyUser
    NotifyUser --> Complete

    Error --> NotifyUser

    classDef config fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef text fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef image fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef model fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef retex fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef rig fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef sprite fill:#f1f8e9,stroke:#558b2f,stroke-width:2px
    classDef final fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef decision fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    classDef endpoint fill:#ffebee,stroke:#c62828,stroke-width:3px

    class Input,Config,Validate config
    class GPT4Check,EnhancePrompt,UseOriginal,MergePrompt text
    class CustomImage,GenerateImage,UseCustom,ImageReady image
    class Submit3D,Poll3D,Check3D,Download3D,Save3D model
    class RetexCheck,ForEachMaterial,SubmitRetex,PollRetex,CheckRetex,DownloadRetex,SaveRetex,NextMaterial retex
    class RigCheck,SubmitRig,PollRig,CheckRig,DownloadRig,SaveRig rig
    class SpriteCheck,RenderAngles,CaptureFrames,SaveSprites sprite
    class CreateMeta,UpdateLibrary,NotifyUser final
    class Validate,GPT4Check,CustomImage,Check3D,RetexCheck,CheckRetex,NextMaterial,RigCheck,CheckRig,SpriteCheck decision
    class Start,Complete,Error endpoint
```

## Detailed Phase Diagrams

### Phase 1: Prompt Enhancement

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Store
    participant PromptSvc as Prompt Service
    participant GPT4 as GPT-4 API

    User->>UI: Enter Description
    UI->>Store: Update Description State

    User->>UI: Click Generate
    UI->>Store: Start Pipeline
    Store->>PromptSvc: enhancePrompt(description, config)

    Note over PromptSvc: Build Enhancement Prompt<br/>with Style Context

    PromptSvc->>GPT4: POST /chat/completions
    Note over GPT4: Process Prompt<br/>Add Technical Details

    alt Success
        GPT4-->>PromptSvc: Enhanced Description
        PromptSvc->>PromptSvc: Merge with Style Prompts
        PromptSvc-->>Store: Enhanced Prompt
        Store->>UI: Update Stage Status
        UI->>User: Show Enhanced Text
    else API Error
        GPT4-->>PromptSvc: Error Response
        PromptSvc-->>Store: Fall Back to Original
        Store->>UI: Warning: Using Original
        UI->>User: Show Warning
    else Rate Limited
        GPT4-->>PromptSvc: 429 Too Many Requests
        PromptSvc->>PromptSvc: Wait & Retry (3 attempts)
        PromptSvc->>GPT4: Retry Request
    end
```

### Phase 2: Concept Art Generation

```mermaid
sequenceDiagram
    participant Pipeline
    participant DALLE as DALL-E 3 API
    participant Storage

    Pipeline->>Pipeline: Check for Custom Image

    alt Custom Image Provided
        Pipeline->>Pipeline: Validate Image Format
        Note over Pipeline: Skip DALL-E<br/>Use Custom Reference
    else Generate with DALL-E
        Pipeline->>Pipeline: Build Image Prompt
        Note over Pipeline: Format: "[Asset Description]<br/>professional concept art<br/>[style guide]"

        Pipeline->>DALLE: POST /images/generations
        Note over Pipeline,DALLE: Request Parameters:<br/>model: dall-e-3<br/>size: 1024x1024<br/>quality: standard

        alt Success
            DALLE-->>Pipeline: Image URL
            Pipeline->>Storage: Download Image
            Storage-->>Pipeline: Image Data
            Pipeline->>Storage: Save as concept-art.png
        else Content Policy Violation
            DALLE-->>Pipeline: Error: Unsafe Content
            Pipeline->>Pipeline: Sanitize Prompt
            Pipeline->>DALLE: Retry with Cleaned Prompt
        else Service Error
            DALLE-->>Pipeline: Error: Service Unavailable
            Pipeline->>Pipeline: Exponential Backoff
            Pipeline->>DALLE: Retry (max 3 attempts)
        end
    end

    Pipeline->>Pipeline: Proceed to 3D Generation
```

### Phase 3: 3D Model Generation

```mermaid
flowchart TB
    Start([Start 3D Generation])

    PrepareRequest[Prepare Meshy Request<br/>Image URL + Prompts]
    Submit[POST /v2/image-to-3d]
    GetTaskID[Receive Task ID]

    subgraph "Polling Loop"
        Wait[Wait 2-3 Seconds]
        Poll[GET /v2/image-to-3d/:taskId]
        CheckStatus{Task Status?}
    end

    ProcessingState[Status: Processing<br/>Update Progress Bar]
    SuccessState[Status: Success<br/>Model URL Available]
    FailedState[Status: Failed<br/>Error Message]

    DownloadModel[Download GLB<br/>from Model URL]
    ValidateGLB{Valid GLB<br/>Format?}
    SaveModel[Save to<br/>gdd-assets/[id]/model.glb]
    ExtractMeta[Extract Model<br/>Metadata]
    UpdateMeta[Update metadata.json]

    Timeout{Timeout<br/>Exceeded?}
    RetryLogic{Retry<br/>Count < 3?}

    Complete([3D Generation Complete])
    Error([Error: Generation Failed])

    Start --> PrepareRequest
    PrepareRequest --> Submit
    Submit --> GetTaskID
    GetTaskID --> Wait

    Wait --> Poll
    Poll --> CheckStatus

    CheckStatus -->|Processing| ProcessingState
    ProcessingState --> Timeout
    Timeout -->|No| Wait
    Timeout -->|Yes| RetryLogic
    RetryLogic -->|Yes| Submit
    RetryLogic -->|No| Error

    CheckStatus -->|Success| SuccessState
    SuccessState --> DownloadModel
    DownloadModel --> ValidateGLB
    ValidateGLB -->|Valid| SaveModel
    ValidateGLB -->|Invalid| Error
    SaveModel --> ExtractMeta
    ExtractMeta --> UpdateMeta
    UpdateMeta --> Complete

    CheckStatus -->|Failed| FailedState
    FailedState --> Error

    classDef process fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef loop fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef state fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef decision fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    classDef endpoint fill:#ffebee,stroke:#c62828,stroke-width:3px

    class PrepareRequest,Submit,GetTaskID,DownloadModel,SaveModel,ExtractMeta,UpdateMeta process
    class Wait,Poll loop
    class ProcessingState,SuccessState,FailedState state
    class CheckStatus,ValidateGLB,Timeout,RetryLogic decision
    class Start,Complete,Error endpoint
```

### Phase 4: Material Variant Generation

```mermaid
stateDiagram-v2
    [*] --> CheckRetexturingEnabled

    CheckRetexturingEnabled --> SelectMaterials: Enabled
    CheckRetexturingEnabled --> SkipRetexturing: Disabled

    SelectMaterials --> InitializeQueue: Materials Selected
    InitializeQueue --> ProcessNextMaterial

    ProcessNextMaterial --> BuildRetextureRequest
    BuildRetextureRequest --> SubmitToMeshy

    SubmitToMeshy --> WaitForCompletion
    WaitForCompletion --> PollStatus

    PollStatus --> CheckTaskStatus

    CheckTaskStatus --> WaitForCompletion: Processing
    CheckTaskStatus --> DownloadVariant: Success
    CheckTaskStatus --> HandleError: Failed
    CheckTaskStatus --> HandleTimeout: Timeout

    DownloadVariant --> SaveVariantGLB
    SaveVariantGLB --> AddToMetadata
    AddToMetadata --> CheckMoreMaterials

    CheckMoreMaterials --> ProcessNextMaterial: More Materials
    CheckMoreMaterials --> CompleteRetexturing: Done

    HandleError --> LogError
    LogError --> CheckMoreMaterials

    HandleTimeout --> IncrementRetryCount
    IncrementRetryCount --> CheckRetryLimit
    CheckRetryLimit --> SubmitToMeshy: Retry < 3
    CheckRetryLimit --> LogError: Retry >= 3

    SkipRetexturing --> [*]
    CompleteRetexturing --> [*]

    note right of BuildRetextureRequest
        Request includes:
        - Base model reference
        - Material style prompt
        - Quality settings
    end note

    note right of PollStatus
        Poll every 2-3 seconds
        Update UI progress
        Track elapsed time
    end note
```

### Phase 5: Auto-Rigging (Avatars Only)

```mermaid
sequenceDiagram
    participant Pipeline
    participant TypeCheck as Type Checker
    participant Meshy as Meshy Rigging API
    participant Validator as GLB Validator
    participant Storage

    Pipeline->>TypeCheck: Check Generation Type

    alt Avatar Type
        TypeCheck-->>Pipeline: Is Avatar
        Pipeline->>Pipeline: Check Rigging Enabled

        alt Rigging Enabled
            Pipeline->>Meshy: POST /v2/rigging
            Note over Pipeline,Meshy: Submit GLB for rigging<br/>heightMeters: config value

            Meshy-->>Pipeline: Task ID

            loop Poll Until Complete
                Pipeline->>Pipeline: Wait 3 seconds
                Pipeline->>Meshy: GET /v2/rigging/:taskId
                Meshy-->>Pipeline: Status Update

                alt Processing
                    Pipeline->>Pipeline: Update Progress (10-90%)
                else Success
                    Meshy-->>Pipeline: Rigged Model URL
                    Note over Pipeline: Exit Loop
                else Failed
                    Meshy-->>Pipeline: Error Message
                    Pipeline->>Pipeline: Log Error & Continue
                    Note over Pipeline: Rigging is optional<br/>Failure doesn't stop pipeline
                end
            end

            alt Rigging Successful
                Pipeline->>Storage: Download Rigged GLB
                Storage-->>Pipeline: Rigged Model Data
                Pipeline->>Validator: Validate Rigged GLB

                alt Valid
                    Validator-->>Pipeline: Valid Skeleton
                    Pipeline->>Storage: Save as rigged-model.glb
                    Pipeline->>Storage: Update Metadata
                    Note over Storage: metadata.isRigged = true<br/>metadata.animations = {...}
                else Invalid
                    Validator-->>Pipeline: Invalid/Corrupted
                    Pipeline->>Pipeline: Keep Original Model
                    Pipeline->>Pipeline: Log Warning
                end
            end
        else Rigging Disabled
            Pipeline->>Pipeline: Skip Rigging
            Note over Pipeline: Continue with static model
        end
    else Item Type
        TypeCheck-->>Pipeline: Is Item
        Pipeline->>Pipeline: Skip Rigging Phase
        Note over Pipeline: Items don't need rigging
    end

    Pipeline->>Pipeline: Proceed to Next Phase
```

### Phase 6: Sprite Generation

```mermaid
flowchart TB
    Start([Start Sprite Generation])

    CheckEnabled{Sprite<br/>Generation<br/>Enabled?}
    LoadModel[Load 3D Model<br/>into Three.js Scene]
    SetupCamera[Setup Orthographic<br/>Camera]
    SetupLighting[Setup Three-Point<br/>Lighting]
    SetupRenderer[Setup Renderer<br/>with Transparent BG]

    CalculateAngles[Calculate Camera<br/>Positions for Angles]
    InitLoop[Initialize Angle Loop<br/>angles: 0°, 45°, 90°, 135°,<br/>180°, 225°, 270°, 315°]

    subgraph "For Each Angle"
        PositionCamera[Position Camera<br/>at Calculated Angle]
        FrameModel[Frame Model<br/>in View]
        Render[Render Scene<br/>to Canvas]
        Capture[Capture Canvas<br/>as PNG Data URL]
        CreateSprite[Create Sprite Object<br/>angle, imageUrl]
        SaveSprite[Save PNG File<br/>sprite-[angle].png]
    end

    NextAngle{More<br/>Angles?}
    SaveMetadata[Save Sprite Metadata<br/>to sprites.json]
    UpdateAsset[Update Asset<br/>Metadata]

    Skip[Skip Sprite<br/>Generation]
    Complete([Sprite Generation Complete])

    Start --> CheckEnabled
    CheckEnabled -->|Yes| LoadModel
    CheckEnabled -->|No| Skip
    LoadModel --> SetupCamera
    SetupCamera --> SetupLighting
    SetupLighting --> SetupRenderer
    SetupRenderer --> CalculateAngles
    CalculateAngles --> InitLoop

    InitLoop --> PositionCamera
    PositionCamera --> FrameModel
    FrameModel --> Render
    Render --> Capture
    Capture --> CreateSprite
    CreateSprite --> SaveSprite
    SaveSprite --> NextAngle

    NextAngle -->|Yes| PositionCamera
    NextAngle -->|No| SaveMetadata
    SaveMetadata --> UpdateAsset
    UpdateAsset --> Complete

    Skip --> Complete

    classDef config fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef setup fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef process fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef decision fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    classDef endpoint fill:#ffebee,stroke:#c62828,stroke-width:3px

    class CheckEnabled decision
    class LoadModel,SetupCamera,SetupLighting,SetupRenderer,CalculateAngles setup
    class InitLoop,PositionCamera,FrameModel,Render,Capture,CreateSprite,SaveSprite,SaveMetadata,UpdateAsset process
    class NextAngle decision
    class Start,Complete,Skip endpoint
```

## Error Handling Flow

### Comprehensive Error Handling

```mermaid
flowchart TB
    Error([Error Detected])

    ClassifyError{Error<br/>Type?}

    subgraph "Network Errors"
        NetworkError[Network/Timeout Error]
        CheckRetry{Retry<br/>Count < 3?}
        Backoff[Exponential Backoff<br/>2^n seconds]
        RetryRequest[Retry Request]
    end

    subgraph "API Errors"
        APIError[API Error Response]
        Check400{Status<br/>Code?}
        BadRequest[400: Bad Request<br/>Invalid Configuration]
        Unauthorized[401: Invalid API Key]
        RateLimit[429: Rate Limited]
        ServerError[500: Server Error]
    end

    subgraph "Validation Errors"
        ValidationError[Data Validation Error]
        InvalidGLB[Invalid GLB Format]
        MissingData[Missing Required Data]
        CorruptFile[Corrupted File]
    end

    subgraph "Service Errors"
        ServiceError[External Service Error]
        OpenAIDown[OpenAI Unavailable]
        MeshyDown[Meshy Unavailable]
        CheckServiceStatus[Check Service Status]
    end

    LogError[Log Error Details<br/>to Console]
    NotifyUser[Display User-Friendly<br/>Error Message]
    UpdateState[Update Pipeline<br/>Status to Failed]
    CleanupTemp[Cleanup Temporary<br/>Files]
    OfferRetry[Offer Manual<br/>Retry Option]

    Abort([Pipeline Aborted])
    Retry([Retry Operation])

    Error --> ClassifyError

    ClassifyError -->|Network| NetworkError
    NetworkError --> CheckRetry
    CheckRetry -->|Yes| Backoff
    Backoff --> RetryRequest
    RetryRequest --> Retry
    CheckRetry -->|No| LogError

    ClassifyError -->|API| APIError
    APIError --> Check400
    Check400 -->|400| BadRequest
    Check400 -->|401| Unauthorized
    Check400 -->|429| RateLimit
    Check400 -->|500+| ServerError
    BadRequest --> LogError
    Unauthorized --> LogError
    RateLimit --> Backoff
    ServerError --> CheckRetry

    ClassifyError -->|Validation| ValidationError
    ValidationError --> InvalidGLB
    ValidationError --> MissingData
    ValidationError --> CorruptFile
    InvalidGLB --> LogError
    MissingData --> LogError
    CorruptFile --> LogError

    ClassifyError -->|Service| ServiceError
    ServiceError --> CheckServiceStatus
    CheckServiceStatus --> OpenAIDown
    CheckServiceStatus --> MeshyDown
    OpenAIDown --> LogError
    MeshyDown --> LogError

    LogError --> NotifyUser
    NotifyUser --> UpdateState
    UpdateState --> CleanupTemp
    CleanupTemp --> OfferRetry
    OfferRetry --> Abort

    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef network fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef api fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef validation fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef service fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef handling fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef endpoint fill:#ffebee,stroke:#c62828,stroke-width:3px

    class Error,ClassifyError,Check400,CheckRetry,CheckServiceStatus error
    class NetworkError,Backoff,RetryRequest network
    class APIError,BadRequest,Unauthorized,RateLimit,ServerError api
    class ValidationError,InvalidGLB,MissingData,CorruptFile validation
    class ServiceError,OpenAIDown,MeshyDown service
    class LogError,NotifyUser,UpdateState,CleanupTemp,OfferRetry handling
    class Abort,Retry endpoint
```

## Pipeline State Transitions

```mermaid
stateDiagram-v2
    [*] --> Idle: Initial State

    Idle --> Configuring: User Opens Generation Page

    Configuring --> Validating: User Clicks Generate
    Validating --> Configuring: Validation Failed
    Validating --> TextProcessing: Validation Passed

    TextProcessing --> ImageGeneration: Prompt Enhanced
    ImageGeneration --> ModelGeneration: Concept Art Ready
    ModelGeneration --> Retexturing: Base Model Complete
    ModelGeneration --> Rigging: Base Model Complete (Avatar)

    Retexturing --> Rigging: Variants Complete (Avatar)
    Retexturing --> SpriteGeneration: Variants Complete (Item)
    Rigging --> SpriteGeneration: Rigging Complete

    SpriteGeneration --> Finalizing: Sprites Complete
    ModelGeneration --> Finalizing: No Additional Stages

    Finalizing --> Completed: Success
    Finalizing --> Failed: Error Occurred

    TextProcessing --> Failed: GPT-4 Error
    ImageGeneration --> Failed: DALL-E Error
    ModelGeneration --> Failed: Meshy Error
    Retexturing --> Failed: Critical Error
    Rigging --> PartialSuccess: Rigging Failed
    SpriteGeneration --> PartialSuccess: Sprite Error

    Failed --> Idle: User Resets
    Completed --> Idle: User Starts New
    PartialSuccess --> Idle: User Continues
    PartialSuccess --> Completed: Accept Partial

    note right of TextProcessing
        Stages:
        - Validate input
        - Enhance with GPT-4
        - Merge prompts
    end note

    note right of ModelGeneration
        Longest stage
        Can take 2-20 minutes
        depending on quality
    end note

    note right of PartialSuccess
        Some features completed
        but non-critical failures
        occurred (e.g., rigging)
    end note
```

## Progress Tracking Flow

```mermaid
sequenceDiagram
    participant UI
    participant Store as Generation Store
    participant Client as API Client
    participant Backend
    participant External as External APIs

    UI->>Store: Initialize Pipeline Stages
    Store->>Store: Set All Stages to 'idle'

    UI->>Client: Start Pipeline
    Client->>Backend: POST /api/generation/pipeline

    Backend->>Store: Update Stage: text-input = 'active'
    Backend->>External: Call GPT-4
    External-->>Backend: Enhanced Prompt
    Backend->>Store: Update Stage: text-input = 'completed'

    Backend->>Store: Update Stage: image-generation = 'active'
    Backend->>External: Call DALL-E
    External-->>Backend: Image URL
    Backend->>Store: Update Stage: image-generation = 'completed'

    Backend->>Store: Update Stage: image-to-3d = 'active'
    Backend->>External: Submit to Meshy

    loop Polling Loop
        Backend->>External: Poll Meshy Status
        External-->>Backend: Progress Update
        Backend->>Store: Update Progress (0-100%)
        Store->>UI: Re-render Progress Bar
    end

    External-->>Backend: Model Complete
    Backend->>Store: Update Stage: image-to-3d = 'completed'

    alt Retexturing Enabled
        Backend->>Store: Update Stage: retexturing = 'active'
        loop For Each Material
            Backend->>External: Submit Retexture
            Backend->>External: Poll Status
            External-->>Backend: Variant Ready
            Store->>UI: Update Variant Count
        end
        Backend->>Store: Update Stage: retexturing = 'completed'
    else Retexturing Skipped
        Backend->>Store: Update Stage: retexturing = 'skipped'
    end

    alt Avatar with Rigging
        Backend->>Store: Update Stage: rigging = 'active'
        Backend->>External: Submit Rigging
        loop Poll Rigging
            Backend->>External: Check Status
            External-->>Backend: Progress
        end
        External-->>Backend: Rigged Model
        Backend->>Store: Update Stage: rigging = 'completed'
    else No Rigging
        Backend->>Store: Update Stage: rigging = 'skipped'
    end

    Backend->>Store: Set Overall Status: 'completed'
    Store->>UI: Display Success Message
    UI->>UI: Navigate to Results View
```

---

## Pipeline Performance Metrics

### Typical Stage Timings

| Stage | Min Time | Typical Time | Max Time | Failure Rate |
|-------|----------|--------------|----------|--------------|
| Text Input | 1s | 5s | 15s | < 1% |
| GPT-4 Enhancement | 2s | 8s | 20s | ~2% |
| Image Generation | 10s | 15s | 45s | ~3% |
| 3D Generation (Standard) | 2min | 4min | 8min | ~5% |
| 3D Generation (High) | 5min | 8min | 15min | ~5% |
| 3D Generation (Ultra) | 10min | 15min | 30min | ~8% |
| Retexturing (per variant) | 3min | 6min | 12min | ~4% |
| Auto-Rigging | 5min | 10min | 20min | ~10% |
| Sprite Generation | 30s | 2min | 5min | < 1% |
| Finalization | 5s | 10s | 30s | < 1% |

### Total Pipeline Duration Examples

- **Minimal** (Standard quality, no variants, no sprites): ~3-7 minutes
- **Typical** (High quality, 3 variants): ~25-45 minutes
- **Maximum** (Ultra quality, 5 variants, rigging, sprites): ~90-150 minutes

---

This comprehensive pipeline documentation provides detailed understanding of Asset Forge's generation workflow, from initial configuration through final asset delivery. For implementation details, refer to the source code in `/src/services/` and `/server/`.
