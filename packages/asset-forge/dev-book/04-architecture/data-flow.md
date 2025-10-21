# Data Flow

## Table of Contents
- [Overview](#overview)
- [Generation Pipeline Flow](#generation-pipeline-flow)
- [Material Variant Flow](#material-variant-flow)
- [Hand Rigging Flow](#hand-rigging-flow)
- [Armor Fitting Flow](#armor-fitting-flow)
- [API Communication Patterns](#api-communication-patterns)
- [State Update Patterns](#state-update-patterns)
- [Event Flow](#event-flow)
- [Error Propagation](#error-propagation)
- [Progress Tracking](#progress-tracking)

---

## Overview

Asset Forge follows a **unidirectional data flow** pattern where data moves in a predictable cycle from user actions through state updates to view re-renders. This document details the complete data flow for all major workflows.

### Data Flow Principles

1. **Unidirectional Flow**: User Action → State Update → View Re-render
2. **Single Source of Truth**: Zustand stores hold all application state
3. **Immutable Updates**: State changes produce new state objects
4. **Async Pipeline**: Long-running operations use polling
5. **Event-Driven**: Backend uses EventEmitter for pipeline events

### Flow Categories

```text
┌─────────────────────────────────────────────────────────────┐
│                      DATA FLOW TYPES                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Generation Pipeline Flow                                │
│     User Input → GPT-4 → DALL-E → Meshy → File System     │
│                                                             │
│  2. Material Variant Flow                                   │
│     Select Base → Configure Material → Meshy Retexture     │
│                                                             │
│  3. Hand Rigging Flow                                       │
│     Select Model → TensorFlow.js → Create Bones → Weights  │
│                                                             │
│  4. Armor Fitting Flow                                      │
│     Select Avatar + Armor → Shrinkwrap → Weight Transfer   │
│                                                             │
│  5. Asset Loading Flow                                      │
│     Request → Fetch Assets → Parse → Store → Render        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Generation Pipeline Flow

### Complete Pipeline Diagram

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    GENERATION PIPELINE FLOW                          │
└──────────────────────────────────────────────────────────────────────┘

1. USER INPUT (GenerationPage)
   ├── Fill form: assetName, description, type
   ├── Select materials: bronze, steel, mithril
   ├── Configure: useGPT4Enhancement = true, enableRetexturing = true
   └── Click: [Generate Asset]

2. FRONTEND STATE UPDATE (useGenerationStore)
   ├── setIsGenerating(true)
   ├── initializePipelineStages()
   │   ├── Stage: text-input → 'completed'
   │   ├── Stage: gpt4-enhancement → 'idle'
   │   ├── Stage: image-generation → 'idle'
   │   ├── Stage: image-to-3d → 'idle'
   │   └── Stage: retexturing → 'idle'
   └── setActiveView('progress')

3. API REQUEST (POST /api/generation/pipeline)
   Request Body:
   {
     "name": "bronze-sword",
     "type": "weapon",
     "subtype": "sword",
     "description": "A sturdy bronze sword with ornate handle",
     "assetId": "bronze-sword-1704835200000",
     "materialPresets": [
       { "id": "bronze", "stylePrompt": "bronze metal with patina" },
       { "id": "steel", "stylePrompt": "polished steel metal" },
       { "id": "mithril", "stylePrompt": "shimmering silver mithril" }
     ],
     "useGPT4Enhancement": true,
     "enableRetexturing": true,
     "quality": "high"
   }

4. BACKEND PROCESSING (GenerationService)
   ├── Create pipeline ID: "pipeline-1704835200000-a7b3c9d"
   ├── Initialize pipeline object
   ├── Store in activePipelines Map
   └── Return: { pipelineId: "pipeline-1704835200000-a7b3c9d", status: "processing" }

5. ASYNC PIPELINE PROCESSING (GenerationService.processPipeline)

   STAGE 1: GPT-4 ENHANCEMENT (10s)
   ├── Update: stages.promptOptimization.status = 'processing'
   ├── POST https://api.openai.com/v1/chat/completions
   │   Model: gpt-4
   │   Prompt: "Optimize this weapon description for 3D generation: 'A sturdy bronze sword...'"
   ├── Receive: "A sturdy bronze sword with ornate Celtic knotwork handle..."
   ├── Update: stages.promptOptimization.status = 'completed'
   └── Progress: 10%

   STAGE 2: IMAGE GENERATION (30s)
   ├── Update: stages.imageGeneration.status = 'processing'
   ├── POST https://api.openai.com/v1/images/generations
   │   Model: gpt-image-1
   │   Prompt: "A sturdy bronze sword with ornate Celtic knotwork handle..."
   ├── Receive: { url: "https://openai.com/images/abc123.png" }
   ├── Download image → Save to temp-images/bronze-sword-concept.png
   ├── Upload to image hosting (ImgBB) → Get public URL
   ├── Update: stages.imageGeneration.status = 'completed'
   └── Progress: 25%

   STAGE 3: IMAGE-TO-3D (120-180s)
   ├── Update: stages.image3D.status = 'processing'
   ├── POST https://api.meshy.ai/v2/image-to-3d
   │   {
   │     "image_url": "https://i.ibb.co/abc123/bronze-sword.png",
   │     "enable_pbr": true,
   │     "ai_model": "meshy-5",
   │     "topology": "quad",
   │     "target_polycount": 12000,
   │     "texture_resolution": 2048
   │   }
   ├── Receive: { result: "meshy-task-xyz789" }
   ├── POLLING LOOP (every 5s, max 60 attempts):
   │   ├── GET https://api.meshy.ai/v2/image-to-3d/meshy-task-xyz789
   │   ├── Status: PROCESSING → progress: 15%
   │   ├── Status: PROCESSING → progress: 45%
   │   ├── Status: PROCESSING → progress: 78%
   │   └── Status: SUCCEEDED → model_urls.glb: "https://..."
   ├── Download GLB → Save to gdd-assets/bronze-sword-base/bronze-sword-base.glb
   ├── Save concept art → gdd-assets/bronze-sword-base/concept-art.png
   ├── Save metadata → gdd-assets/bronze-sword-base/metadata.json
   ├── Update: stages.image3D.status = 'completed'
   └── Progress: 50%

   STAGE 4: MATERIAL VARIANTS (3 × 120s each)
   ├── Update: stages.textureGeneration.status = 'processing'
   ├── FOR EACH material (bronze, steel, mithril):
   │   ├── POST https://api.meshy.ai/v2/text-to-texture
   │   │   {
   │   │     "model_url": "meshy-task-xyz789",
   │   │     "text_style_prompt": "bronze metal with patina",
   │   │     "art_style": "realistic",
   │   │     "ai_model": "meshy-5"
   │   │   }
   │   ├── Receive: { result: "retexture-task-abc123" }
   │   ├── POLLING LOOP (every 5s, max 60 attempts):
   │   │   └── Status: SUCCEEDED → model_urls.glb: "https://..."
   │   ├── Download GLB → gdd-assets/bronze-sword-bronze/bronze-sword-bronze.glb
   │   ├── Save variant metadata → gdd-assets/bronze-sword-bronze/metadata.json
   │   └── Progress: 50% → 75%
   ├── Update base metadata: variants = ["bronze-sword-bronze", "bronze-sword-steel", "bronze-sword-mithril"]
   ├── Update: stages.textureGeneration.status = 'completed'
   └── Progress: 75%

   PIPELINE COMPLETE
   ├── pipeline.status = 'completed'
   ├── pipeline.completedAt = "2024-01-09T12:35:00.000Z"
   └── Progress: 100%

6. FRONTEND POLLING (every 2s)
   ├── GET /api/generation/pipeline/pipeline-1704835200000-a7b3c9d
   ├── Receive:
   │   {
   │     "id": "pipeline-1704835200000-a7b3c9d",
   │     "status": "completed",
   │     "progress": 100,
   │     "stages": { ... },
   │     "results": { ... }
   │   }
   ├── Update store:
   │   ├── updatePipelineStage('gpt4-enhancement', 'completed')
   │   ├── updatePipelineStage('image-generation', 'completed')
   │   ├── updatePipelineStage('image-to-3d', 'completed')
   │   ├── updatePipelineStage('retexturing', 'completed')
   │   └── setIsGenerating(false)
   └── Navigate to results view

7. FETCH ASSETS (AssetsPage)
   ├── GET /api/assets
   ├── Receive: [{ id: "bronze-sword-base", ... }, { id: "bronze-sword-bronze", ... }]
   ├── Update: generatedAssets
   └── Auto-select first asset

8. RENDER 3D MODEL (ModelViewer)
   ├── Load: /api/assets/bronze-sword-base/model
   ├── GLTFLoader.load()
   ├── Parse GLB → Three.js scene
   ├── Add to Canvas
   └── Render with OrbitControls
```

### Timeline

```
Total Duration: ~6-8 minutes

00:00 - User submits form
00:01 - API request sent
00:02 - GPT-4 enhancement complete (10s)
00:32 - Image generation complete (30s)
03:32 - Image-to-3D complete (180s)
09:32 - Material variants complete (3 × 120s)
09:33 - Fetch assets
09:34 - Render 3D model
```

---

## Material Variant Flow

### Retexture Workflow

```text
┌──────────────────────────────────────────────────────────────────────┐
│                   MATERIAL VARIANT FLOW                              │
└──────────────────────────────────────────────────────────────────────┘

1. USER SELECTS BASE MODEL (AssetsPage)
   ├── User clicks asset card: "bronze-sword-base"
   ├── useAssetsStore.setSelectedAsset(asset)
   └── ModelViewer renders base model

2. USER OPENS RETEXTURE MODAL
   ├── Click: [Create Variant] button
   ├── useAssetsStore.setShowRetextureModal(true)
   └── Modal renders with material presets

3. USER SELECTS MATERIAL
   ├── Select: "Mithril" from dropdown
   ├── stylePrompt: "shimmering silver mithril with magical glow"
   └── Click: [Generate Variant]

4. API REQUEST (POST /api/retexture)
   Request:
   {
     "baseAssetId": "bronze-sword-base",
     "materialPreset": {
       "id": "mithril",
       "displayName": "Mithril",
       "stylePrompt": "shimmering silver mithril with magical glow"
     },
     "outputName": "bronze-sword-mithril"
   }

5. BACKEND PROCESSING (RetextureService)
   ├── Load base metadata → Get meshyTaskId
   ├── POST https://api.meshy.ai/v2/text-to-texture
   │   {
   │     "model_url": "meshy-task-xyz789",
   │     "text_style_prompt": "shimmering silver mithril with magical glow"
   │   }
   ├── Receive: { result: "retexture-task-def456" }
   ├── POLLING LOOP:
   │   ├── Attempt 1: Status = PROCESSING (15%)
   │   ├── Attempt 5: Status = PROCESSING (45%)
   │   ├── Attempt 12: Status = PROCESSING (78%)
   │   └── Attempt 18: Status = SUCCEEDED
   ├── Download GLB
   ├── Save to: gdd-assets/bronze-sword-mithril/bronze-sword-mithril.glb
   ├── Save metadata with materialPreset info
   ├── Update base model metadata: variants.push("bronze-sword-mithril")
   └── Return: { variantId: "bronze-sword-mithril", modelUrl: "https://..." }

6. FRONTEND RESPONSE HANDLING
   ├── Receive: { variantId: "bronze-sword-mithril" }
   ├── Close modal
   ├── Refresh assets list (GET /api/assets)
   ├── Auto-select new variant
   └── ModelViewer renders mithril variant
```

---

## Hand Rigging Flow

### TensorFlow.js Hand Detection

```text
┌──────────────────────────────────────────────────────────────────────┐
│                     HAND RIGGING FLOW                                │
└──────────────────────────────────────────────────────────────────────┘

1. USER SELECTS CHARACTER (HandRiggingPage)
   ├── Select: "character-001" from asset selector
   ├── useHandRiggingStore.setSelectedAvatar(asset)
   └── Load model: /api/assets/character-001/model

2. INITIALIZE SERVICE (useEffect)
   ├── Check: useSimpleMode = false (advanced mode)
   ├── service = new HandRiggingService()
   ├── await service.initializeDetector()
   │   ├── Load TensorFlow.js models
   │   ├── handPoseDetection.createDetector(MediaPipeHands)
   │   └── detector ready
   └── useHandRiggingStore.setServiceInitialized(true)

3. USER STARTS RIGGING
   ├── Click: [Start Rigging] button
   ├── Check: canStartProcessing() → true
   └── Call: await service.rigHandsForModel(gltf)

4. STAGE 1: DETECT WRIST BONES (Client-side)
   ├── Update: setProcessingStage('detecting-wrists')
   ├── Traverse skeleton:
   │   └── Find: Left_Wrist, Right_Wrist bones
   ├── Validate bones exist
   └── Duration: 100ms

5. STAGE 2: AI HAND POSE DETECTION (Client-side)
   ├── Update: setProcessingStage('creating-bones')
   ├── FOR EACH hand (left, right):
   │   ├── Create temporary scene with hand mesh only
   │   ├── Render to 512×512 canvas
   │   ├── await detector.estimateHands(canvas)
   │   ├── Receive: {
   │   │     handedness: "Left",
   │   │     keypoints: [
   │   │       { name: "wrist", x: 256, y: 384, z: 0 },
   │   │       { name: "thumb_cmc", x: 220, y: 350, z: 2 },
   │   │       { name: "thumb_mcp", x: 200, y: 320, z: 4 },
   │   │       { name: "thumb_ip", x: 180, y: 290, z: 6 },
   │   │       { name: "thumb_tip", x: 160, y: 260, z: 8 },
   │   │       // ... 16 more keypoints (21 total)
   │   │     ]
   │   │   }
   │   ├── Convert 2D keypoints → 3D positions (ray casting)
   │   ├── Create bone hierarchy:
   │   │   ├── Palm bone (wrist → palm center)
   │   │   ├── Thumb: [CMC, MCP, IP, TIP] (4 bones)
   │   │   ├── Index: [MCP, PIP, DIP, TIP] (4 bones)
   │   │   ├── Middle: [MCP, PIP, DIP, TIP] (4 bones)
   │   │   ├── Ring: [MCP, PIP, DIP, TIP] (4 bones)
   │   │   └── Pinky: [MCP, PIP, DIP, TIP] (4 bones)
   │   └── Total: 21 bones per hand
   └── Duration: 500ms per hand

6. STAGE 3: APPLY VERTEX WEIGHTS (Client-side)
   ├── Update: setProcessingStage('applying-weights')
   ├── FOR EACH vertex in hand mesh:
   │   ├── Find nearest bone
   │   ├── Calculate distance to bone
   │   ├── Calculate weight (1.0 / distance)
   │   ├── Normalize weights (sum = 1.0)
   │   └── Assign to skinWeights array
   ├── Create SkinnedMesh with new skeleton
   └── Duration: 200ms per hand

7. COMPLETE
   ├── Update: setProcessingStage('complete')
   ├── Store rigging result:
   │   {
   │     riggedModel: gltf,
   │     leftHandBones: Bone[],
   │     rightHandBones: Bone[],
   │     skeletonHelper: SkeletonHelper
   │   }
   └── Enable export button

8. USER EXPORTS (Optional)
   ├── Click: [Export Rigged Model]
   ├── GLTFExporter.parse(scene)
   ├── Convert to ArrayBuffer
   ├── Create Blob → Download as character-001_rigged.glb
   └── Duration: 1s
```

---

## Armor Fitting Flow

### Shrinkwrap Algorithm

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    ARMOR FITTING FLOW                                │
└──────────────────────────────────────────────────────────────────────┘

1. USER SELECTS AVATAR + ARMOR
   ├── Select avatar: "character-001"
   │   └── useArmorFittingStore.setSelectedAvatar(asset)
   ├── Switch to armor filter
   │   └── useArmorFittingStore.setAssetTypeFilter('armor')
   ├── Select armor: "bronze-chestplate"
   │   └── useArmorFittingStore.setSelectedArmor(asset)
   └── Both models load in scene

2. USER CONFIGURES FITTING
   ├── fittingConfig.method = 'shrinkwrap'
   ├── fittingConfig.iterations = 8
   ├── fittingConfig.stepSize = 0.15
   ├── fittingConfig.targetOffset = 0.05
   ├── fittingConfig.smoothingRadius = 0.2
   ├── enableWeightTransfer = true
   └── Click: [Fit Armor]

3. PERFORM FITTING (ArmorFittingService)
   ├── Check: isReadyToFit() → true
   ├── setIsFitting(true)
   ├── setFittingProgress(0)
   └── Call: viewerRef.current.performFitting(params)

4. SHRINKWRAP ALGORITHM (MeshFittingService)
   ├── Get armor geometry
   ├── Get avatar geometry (target)
   ├── Create BVH accelerator for avatar
   ├── FOR iteration in [1..8]:
   │   ├── FOR EACH vertex in armor:
   │   │   ├── Get vertex position (world space)
   │   │   ├── Calculate vertex normal
   │   │   ├── Cast ray: vertex → -normal (toward avatar)
   │   │   ├── Find closest intersection with avatar BVH
   │   │   ├── IF intersection found:
   │   │   │   ├── target = intersection.point
   │   │   │   ├── direction = (target - vertex).normalize()
   │   │   │   ├── vertex += direction × stepSize (0.15)
   │   │   │   └── vertex += normal × targetOffset (0.05)
   │   │   └── Update vertex position
   │   ├── Update geometry: positions.needsUpdate = true
   │   ├── Apply Laplacian smoothing:
   │   │   ├── FOR EACH vertex:
   │   │   │   ├── Find neighbors within radius (0.2)
   │   │   │   ├── average = mean(neighbor positions)
   │   │   │   └── vertex = lerp(vertex, average, 0.3)
   │   │   └── Update geometry
   │   ├── Update progress: (iteration / 8) × 50%
   │   └── Render frame (show progress)
   └── Duration: 8 iterations × 100ms = 800ms

5. WEIGHT TRANSFER (Optional)
   ├── IF enableWeightTransfer:
   │   ├── Get avatar skeleton
   │   ├── Get avatar skin weights
   │   ├── FOR EACH vertex in armor:
   │   │   ├── Find nearest vertex on avatar
   │   │   ├── Copy bone weights from avatar vertex
   │   │   └── Assign to armor vertex
   │   ├── Create SkinnedMesh:
   │   │   ├── geometry = fitted armor
   │   │   ├── skeleton = avatar skeleton (shared)
   │   │   └── skinWeights = transferred weights
   │   └── Replace armor mesh in scene
   └── Duration: 200ms

6. COMPLETE
   ├── setFittingProgress(100)
   ├── setIsArmorFitted(true)
   ├── setIsFitting(false)
   └── Enable [Bind to Skeleton] button

7. USER BINDS TO SKELETON
   ├── Click: [Bind to Skeleton]
   ├── Call: viewerRef.current.transferWeights()
   ├── Armor becomes SkinnedMesh with avatar's skeleton
   ├── setIsArmorBound(true)
   └── Enable animation testing

8. USER TESTS ANIMATION
   ├── Select: currentAnimation = 'walking'
   ├── Load: /api/assets/character-001/animations/walking.glb
   ├── AnimationMixer.clipAction(walkingClip).play()
   ├── Armor deforms with skeleton (weight-based)
   └── Verify: No clipping, smooth deformation

9. USER EXPORTS
   ├── Click: [Export Fitted Armor]
   ├── GLTFExporter.parse(armorMesh)
   ├── Download: fitted_armor_1704835200000.glb
   └── Duration: 500ms
```

---

## API Communication Patterns

### Request/Response Cycle

```text
┌──────────────────────────────────────────────────────────────────────┐
│                  API COMMUNICATION PATTERN                           │
└──────────────────────────────────────────────────────────────────────┘

CLIENT                          SERVER
  │                               │
  │  POST /api/generation/pipeline│
  │  {config}                     │
  ├─────────────────────────────>│
  │                               │ Create pipeline
  │                               │ Start async processing
  │                               │ Return pipelineId
  │  { pipelineId, status }       │
  │<─────────────────────────────┤
  │                               │
  │  Start polling (2s interval)  │
  │                               │
  │  GET /api/generation/pipeline/:id
  ├─────────────────────────────>│
  │                               │ Lookup pipeline
  │  { status: "processing",      │
  │    progress: 25,               │
  │    stages: {...} }            │
  │<─────────────────────────────┤
  │                               │
  │  Wait 2s                      │
  │                               │
  │  GET /api/generation/pipeline/:id
  ├─────────────────────────────>│
  │                               │
  │  { status: "processing",      │
  │    progress: 50,               │
  │    stages: {...} }            │
  │<─────────────────────────────┤
  │                               │
  │  Wait 2s                      │
  │                               │
  │  GET /api/generation/pipeline/:id
  ├─────────────────────────────>│
  │                               │
  │  { status: "completed",       │
  │    progress: 100,              │
  │    results: {...} }           │
  │<─────────────────────────────┤
  │                               │
  │  Stop polling                 │
  │  Fetch assets                 │
  │                               │
  │  GET /api/assets              │
  ├─────────────────────────────>│
  │                               │ List assets
  │  [assets]                     │
  │<─────────────────────────────┤
  │                               │
  │  GET /api/assets/:id/model    │
  ├─────────────────────────────>│
  │                               │ Send GLB file
  │  <Binary GLB data>            │
  │<─────────────────────────────┤
  │                               │
  │  Render 3D model              │
  │                               │
```

### Polling Strategy

```typescript
// Frontend polling implementation
const pollPipeline = async (pipelineId: string) => {
  const pollInterval = 2000 // 2 seconds
  const maxAttempts = 300   // 10 minutes max

  let attempts = 0

  const poll = async () => {
    try {
      const response = await fetch(`/api/generation/pipeline/${pipelineId}`)
      const status = await response.json()

      // Update store
      useGenerationStore.getState().setPipelineProgress(status.progress)

      Object.entries(status.stages).forEach(([stageId, stage]) => {
        useGenerationStore.getState().updatePipelineStage(stageId, stage.status)
      })

      // Check if complete
      if (status.status === 'completed' || status.status === 'failed') {
        return status
      }

      // Continue polling
      attempts++
      if (attempts >= maxAttempts) {
        throw new Error('Pipeline timed out')
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
      return poll()

    } catch (error) {
      console.error('Polling error:', error)
      throw error
    }
  }

  return poll()
}
```

---

## State Update Patterns

### Optimistic Updates

```typescript
// Delete asset with optimistic update
const deleteAsset = async (assetId: string) => {
  const previousAssets = useAssetsStore.getState().assets

  try {
    // Optimistic: Remove from UI immediately
    useAssetsStore.getState().setAssets(
      previousAssets.filter(a => a.id !== assetId)
    )

    // API call
    await fetch(`/api/assets/${assetId}`, { method: 'DELETE' })

    // Success: No action needed (already removed)

  } catch (error) {
    // Rollback on error
    useAssetsStore.getState().setAssets(previousAssets)
    notify('Failed to delete asset', 'error')
  }
}
```

### Progressive State Updates

```typescript
// Update state as data loads
const loadAssetWithProgress = async (assetId: string) => {
  // 1. Start loading
  useAssetsStore.getState().setIsLoading(true)
  useAssetsStore.getState().setLoadingProgress(0)

  try {
    // 2. Load metadata (fast)
    const metadata = await fetch(`/api/assets/${assetId}`).then(r => r.json())
    useAssetsStore.getState().setSelectedAsset({ ...metadata, model: null })
    useAssetsStore.getState().setLoadingProgress(25)

    // 3. Load model (slow)
    const modelUrl = `/api/assets/${assetId}/model`
    const gltf = await new Promise((resolve, reject) => {
      const loader = new GLTFLoader()
      loader.load(
        modelUrl,
        (gltf) => {
          useAssetsStore.getState().setLoadingProgress(75)
          resolve(gltf)
        },
        (progress) => {
          const percent = 25 + (progress.loaded / progress.total) * 50
          useAssetsStore.getState().setLoadingProgress(percent)
        },
        reject
      )
    })

    // 4. Complete
    useAssetsStore.getState().setSelectedAsset({ ...metadata, model: gltf })
    useAssetsStore.getState().setLoadingProgress(100)

  } finally {
    useAssetsStore.getState().setIsLoading(false)
  }
}
```

---

## Event Flow

### Component Event Handling

```typescript
// Event flow through component hierarchy

// 1. User clicks button in child component
function MaterialSelector() {
  const toggleMaterialSelection = useGenerationStore(
    state => state.toggleMaterialSelection
  )

  return (
    <button onClick={() => toggleMaterialSelection('bronze')}>
      Bronze
    </button>
  )
}

// 2. Store action updates state
toggleMaterialSelection: (materialId) => set((state) => {
  const index = state.selectedMaterials.indexOf(materialId)
  if (index > -1) {
    state.selectedMaterials.splice(index, 1) // Remove
  } else {
    state.selectedMaterials.push(materialId) // Add
  }
}),

// 3. Parent component re-renders (subscribed to selectedMaterials)
function GenerationForm() {
  const selectedMaterials = useGenerationStore(state => state.selectedMaterials)

  return (
    <div>
      <p>Selected: {selectedMaterials.join(', ')}</p>
      <MaterialSelector />
    </div>
  )
}
```

### Three.js Event Loop

```typescript
// React Three Fiber render loop

function AnimatedModel({ model }: { model: GLTF }) {
  const meshRef = useRef<Mesh>()
  const mixerRef = useRef<AnimationMixer>()

  // Setup animation on mount
  useEffect(() => {
    if (model.animations.length > 0) {
      const mixer = new AnimationMixer(model.scene)
      const clip = model.animations[0]
      const action = mixer.clipAction(clip)
      action.play()
      mixerRef.current = mixer
    }

    return () => {
      mixerRef.current?.stopAllAction()
    }
  }, [model])

  // Animation loop (60fps)
  useFrame((state, delta) => {
    // Update animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }

    // Rotate model slowly
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.1
    }
  })

  return <primitive ref={meshRef} object={model.scene} />
}
```

---

## Error Propagation

### Error Handling Flow

```text
┌──────────────────────────────────────────────────────────────────────┐
│                     ERROR PROPAGATION                                │
└──────────────────────────────────────────────────────────────────────┘

1. API Error
   fetch('/api/generation/pipeline')
   ├── Network error → fetch throws
   ├── HTTP 400/404/500 → response.ok === false
   └── Backend error → response.json().error

2. Try/Catch in Frontend
   try {
     const response = await fetch('/api/...')
     if (!response.ok) {
       throw new Error(`API error: ${response.status}`)
     }
     const data = await response.json()
   } catch (error) {
     // Handle error...
   }

3. Store Error State
   useGenerationStore.getState().setError(error.message)
   useGenerationStore.getState().setIsGenerating(false)

4. Component Displays Error
   function ErrorDisplay() {
     const error = useGenerationStore(state => state.error)

     if (!error) return null

     return (
       <div className="error">
         <XCircle />
         <p>{error}</p>
         <button onClick={() => clearError()}>Dismiss</button>
       </div>
     )
   }

5. Error Boundary (React)
   class ErrorBoundary extends React.Component {
     componentDidCatch(error, errorInfo) {
       console.error('React error:', error, errorInfo)
       // Log to error tracking service (Sentry, etc.)
     }

     render() {
       if (this.state.hasError) {
         return <h1>Something went wrong.</h1>
       }
       return this.props.children
     }
   }
```

### Backend Error Handling

```javascript
// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack)

  const statusCode = err.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// Usage in route
app.post('/api/generation/pipeline', async (req, res, next) => {
  try {
    const result = await generationService.startPipeline(req.body)
    res.json(result)
  } catch (error) {
    next(error) // Pass to error handler
  }
})
```

---

## Progress Tracking

### Multi-Stage Progress

```typescript
// Track progress across multiple stages

interface PipelineProgress {
  stage: string
  progress: number
  totalStages: number
}

const calculateOverallProgress = (stages: Record<string, StageStatus>): number => {
  const stageWeights = {
    'gpt4-enhancement': 10,   // 0-10%
    'image-generation': 15,   // 10-25%
    'image-to-3d': 25,        // 25-50%
    'retexturing': 25,        // 50-75%
    'rigging': 10,            // 75-85%
    'sprites': 15             // 85-100%
  }

  let totalProgress = 0

  Object.entries(stages).forEach(([stageId, stage]) => {
    const weight = stageWeights[stageId] || 0

    if (stage.status === 'completed') {
      totalProgress += weight
    } else if (stage.status === 'active' && stage.progress) {
      totalProgress += weight * (stage.progress / 100)
    }
  })

  return totalProgress
}

// Usage
const overallProgress = calculateOverallProgress(pipeline.stages)
// 0-100%
```

### Visual Progress Indicators

```typescript
// Progress bar component
function PipelineProgressBar() {
  const pipelineStages = useGenerationStore(state => state.pipelineStages)

  const overallProgress = pipelineStages.reduce((sum, stage) => {
    if (stage.status === 'completed') return sum + 1
    if (stage.status === 'active') return sum + 0.5
    return sum
  }, 0) / pipelineStages.length * 100

  return (
    <div className="progress-container">
      <div className="progress-bar" style={{ width: `${overallProgress}%` }} />
      <span>{overallProgress.toFixed(0)}%</span>

      <div className="stage-indicators">
        {pipelineStages.map(stage => (
          <div
            key={stage.id}
            className={`stage stage-${stage.status}`}
            title={stage.description}
          >
            {stage.icon}
            <span>{stage.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Summary

Asset Forge implements **well-defined data flow patterns** across all workflows:

**Key Patterns**:
- ✅ Unidirectional data flow (User → Store → View)
- ✅ Async pipelines with polling (2s intervals)
- ✅ Progressive state updates (load metadata → model → complete)
- ✅ Optimistic updates with rollback
- ✅ Comprehensive error handling
- ✅ Multi-stage progress tracking

**Workflows Documented**:
1. Generation Pipeline (7 stages, 6-8 minutes)
2. Material Variant (retexturing, 2 minutes)
3. Hand Rigging (TensorFlow.js, client-side, 1s)
4. Armor Fitting (shrinkwrap algorithm, client-side, 1s)

**Communication**:
- REST API for CRUD operations
- Polling for long-running tasks
- WebSocket potential for real-time updates (future enhancement)

**State Management**:
- Zustand stores as single source of truth
- Granular subscriptions for performance
- Middleware for persistence and debugging

The data flow architecture provides a robust foundation for complex, multi-stage AI workflows with excellent user feedback and error handling.
