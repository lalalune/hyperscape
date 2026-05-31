# Custom Hooks Reference

This document provides comprehensive coverage of all custom hooks in Asset Forge, including hook signatures, usage examples, return values, and integration patterns.

## Table of Contents

1. [Hook Architecture](#hook-architecture)
2. [useApi](#useapi)
3. [useThreeScene](#usethreescene)
4. [useAssets](#useassets)
5. [useArmorFitting](#usearmorfitting)
6. [useAssetActions](#useassetactions)
7. [usePipelineStatus](#usepipelinestatus)
8. [usePrompts](#useprompts)
9. [useMaterialPresets](#usematerialpresets)
10. [useArmorExport](#usearmorexport)
11. [useNavigation](#usenavigation)

---

## Hook Architecture

Asset Forge follows React Hooks best practices for extracting and reusing stateful logic.

### Hook Design Principles

1. **Single Responsibility**: Each hook manages one concern
2. **Composability**: Hooks can call other hooks
3. **Type Safety**: Full TypeScript coverage
4. **Clean Dependencies**: Explicit dependency arrays
5. **Error Handling**: Consistent error patterns
6. **Resource Cleanup**: Proper cleanup in return functions

### Hook Organization

```
src/hooks/
├── useApi.ts                 # API request wrapper
├── useThreeScene.ts          # Three.js scene management
├── useAssets.ts              # Asset data fetching
├── useArmorFitting.ts        # Armor fitting operations
├── useAssetActions.ts        # Asset CRUD actions
├── usePipelineStatus.ts      # Pipeline polling
├── usePrompts.ts             # Prompt template loading
├── useMaterialPresets.ts     # Material preset management
├── useArmorExport.ts         # Armor export utilities
├── useNavigation.ts          # Navigation context hook
└── index.ts                  # Barrel export
```

### Common Hook Pattern

```typescript
export function useCustomHook(config: HookConfig) {
  // 1. Local state
  const [state, setState] = useState(initialState)

  // 2. Refs for stable references
  const ref = useRef<Type>(null)

  // 3. Store subscriptions
  const storeValue = useStore((state) => state.value)

  // 4. Effects for side effects
  useEffect(() => {
    // Setup
    const cleanup = doSomething()

    // Cleanup
    return () => cleanup()
  }, [dependencies])

  // 5. Callbacks with useCallback
  const handler = useCallback(() => {
    // Logic
  }, [dependencies])

  // 6. Return public API
  return {
    state,
    handler,
    ref
  }
}
```

---

## useApi

General-purpose API request hook with error handling and loading states.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/hooks/useApi.ts`

### Signature

```typescript
interface ApiOptions extends RequestInit {
  showError?: boolean
  showSuccess?: boolean
  successMessage?: string
}

interface UseApiReturn {
  apiCall: <T>(url: string, options?: ApiOptions) => Promise<T | null>
  loading: boolean
}

export function useApi(): UseApiReturn
```

### Implementation

```typescript
export function useApi() {
  const [loading, setLoading] = useState(false)
  const { showNotification } = useApp()

  const apiCall = useCallback(async <T>(
    url: string,
    options: ApiOptions = {}
  ): Promise<T | null> => {
    const {
      showError = true,
      showSuccess = false,
      successMessage,
      ...fetchOptions
    } = options

    setLoading(true)

    try {
      const response = await apiFetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: { message: `HTTP ${response.status}: ${response.statusText}` }
        }))

        throw new Error(errorData.error?.message || 'Request failed')
      }

      const data = await response.json()

      if (showSuccess) {
        showNotification(successMessage || 'Success', 'success')
      }

      return data
    } catch (error) {
      if (showError) {
        showNotification(
          error instanceof Error ? error.message : 'An error occurred',
          'error'
        )
      }
      console.error('API Error:', error)
      return null
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  return { apiCall, loading }
}
```

### Usage Examples

#### Basic GET Request

```typescript
const MyComponent = () => {
  const { apiCall, loading } = useApi()
  const [data, setData] = useState(null)

  const fetchData = async () => {
    const result = await apiCall('/api/data')
    if (result) {
      setData(result)
    }
  }

  return (
    <button onClick={fetchData} disabled={loading}>
      {loading ? 'Loading...' : 'Fetch Data'}
    </button>
  )
}
```

#### POST with Success Message

```typescript
const saveAsset = async (asset: Asset) => {
  const result = await apiCall('/api/assets', {
    method: 'POST',
    body: JSON.stringify(asset),
    showSuccess: true,
    successMessage: 'Asset saved successfully!'
  })
  return result
}
```

#### Silent Error Handling

```typescript
const checkAvailability = async (name: string) => {
  const result = await apiCall(`/api/check?name=${name}`, {
    showError: false  // Don't show error notification
  })
  return !!result
}
```

### Return Values

- **apiCall**: Async function for making requests
  - Type parameter `<T>` for type-safe responses
  - Returns `Promise<T | null>`
  - `null` indicates error
- **loading**: Boolean indicating request in progress

---

## useThreeScene

Sets up and manages a Three.js scene with camera, renderer, and controls.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/hooks/useThreeScene.ts`

### Signature

```typescript
interface ThreeSceneConfig {
  backgroundColor?: number
  enableShadows?: boolean
  enableGrid?: boolean
  cameraPosition?: [number, number, number]
  cameraTarget?: [number, number, number]
}

interface ThreeSceneRefs {
  scene: THREE.Scene | null
  camera: THREE.PerspectiveCamera | null
  renderer: WebGPURenderer | null
  orbitControls: OrbitControls | null
}

interface UseThreeSceneReturn extends ThreeSceneRefs {
  isInitialized: boolean
}

export function useThreeScene(
  containerRef: React.RefObject<HTMLDivElement>,
  config?: ThreeSceneConfig
): UseThreeSceneReturn
```

### Implementation Highlights

```typescript
export function useThreeScene(
  containerRef: React.RefObject<HTMLDivElement>,
  config: ThreeSceneConfig = {}
) {
  const [isInitialized, setIsInitialized] = useState(false)
  const refs = useRef<ThreeSceneRefs>({
    scene: null,
    camera: null,
    renderer: null,
    orbitControls: null
  })

  const frameIdRef = useRef<number>()

  useEffect(() => {
    const containerEl = containerRef.current
    if (!containerEl) return

    const {
      backgroundColor = 0x1a1a1a,
      enableShadows = true,
      enableGrid = true,
      cameraPosition = [1.5, 1.2, 1.5],
      cameraTarget = [0, 0.8, 0]
    } = config

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(backgroundColor)
    refs.current.scene = scene

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      containerEl.clientWidth / containerEl.clientHeight,
      0.1,
      1000
    )
    camera.position.set(...cameraPosition)
    camera.lookAt(...cameraTarget)
    refs.current.camera = camera

    // Renderer setup
    const renderer = new WebGPURenderer({
      antialias: true,
      alpha: true
    })
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping

    if (enableShadows) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }

    containerEl.appendChild(renderer.domElement)
    refs.current.renderer = renderer

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = enableShadows
    scene.add(directionalLight)

    // Orbit controls
    const orbitControls = new OrbitControls(camera, renderer.domElement)
    orbitControls.target.set(...cameraTarget)
    orbitControls.update()
    refs.current.orbitControls = orbitControls

    // Optional grid
    if (enableGrid) {
      const gridHelper = new THREE.GridHelper(10, 10)
      scene.add(gridHelper)

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({
          color: 0x444444,
          roughness: 0.8,
          metalness: 0.2
        })
      )
      ground.rotation.x = -Math.PI / 2
      ground.receiveShadow = true
      scene.add(ground)
    }

    setIsInitialized(true)

    // Animation loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      orbitControls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!containerEl) return
      camera.aspect = containerEl.clientWidth / containerEl.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerEl.clientWidth, containerEl.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current)
      }
      renderer.dispose()
      containerEl?.removeChild(renderer.domElement)
    }
  }, [containerRef])

  return {
    isInitialized,
    scene: refs.current.scene,
    camera: refs.current.camera,
    renderer: refs.current.renderer,
    orbitControls: refs.current.orbitControls
  }
}
```

### Usage Example

```typescript
const MyViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    isInitialized,
    scene,
    camera,
    renderer,
    orbitControls
  } = useThreeScene(containerRef, {
    backgroundColor: 0x2a2a2a,
    enableShadows: true,
    enableGrid: true,
    cameraPosition: [2, 1.5, 2],
    cameraTarget: [0, 1, 0]
  })

  useEffect(() => {
    if (!isInitialized || !scene) return

    // Add custom objects to scene
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    )
    scene.add(cube)

    return () => {
      scene.remove(cube)
    }
  }, [isInitialized, scene])

  return <div ref={containerRef} className="w-full h-full" />
}
```

### Configuration Options

- **backgroundColor**: Scene background color (default: 0x1a1a1a)
- **enableShadows**: Enable shadow mapping (default: true)
- **enableGrid**: Show grid helper and ground plane (default: true)
- **cameraPosition**: Initial camera position (default: [1.5, 1.2, 1.5])
- **cameraTarget**: Camera look-at target (default: [0, 0.8, 0])

### Return Values

- **isInitialized**: Boolean indicating scene is ready
- **scene**: THREE.Scene instance
- **camera**: THREE.PerspectiveCamera instance
- **renderer**: WebGPURenderer instance
- **orbitControls**: OrbitControls instance

---

## useAssets

Fetches and manages the list of assets with reload capabilities.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/hooks/useAssets.ts`

### Signature

```typescript
interface UseAssetsReturn {
  assets: Asset[]
  loading: boolean
  error: string | null
  reloadAssets: () => Promise<void>
  forceReload: () => Promise<void>
}

export function useAssets(): UseAssetsReturn
```

### Implementation

```typescript
export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAssets = useCallback(async (clearFirst = false) => {
    try {
      if (clearFirst) {
        setAssets([])
      }
      setLoading(true)
      setError(null)

      const data = await AssetService.listAssets()
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets')
      console.error('Failed to load assets:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const reloadAssets = useCallback(async () => {
    await loadAssets(false)
  }, [loadAssets])

  const forceReload = useCallback(async () => {
    await loadAssets(true)
  }, [loadAssets])

  return {
    assets,
    loading,
    error,
    reloadAssets,
    forceReload
  }
}
```

### Usage Example

```typescript
const AssetsPage = () => {
  const { assets, loading, error, reloadAssets, forceReload } = useAssets()

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  const handleDeleteAsset = async (assetId: string) => {
    await AssetService.deleteAsset(assetId)
    await forceReload()  // Clear and reload
  }

  const handleUpdateAsset = async (asset: Asset) => {
    await AssetService.updateAsset(asset)
    await reloadAssets()  // Reload without clearing
  }

  return (
    <div>
      <AssetList assets={assets} />
    </div>
  )
}
```

### Return Values

- **assets**: Array of Asset objects
- **loading**: Boolean indicating initial load
- **error**: Error message string or null
- **reloadAssets**: Refresh assets without clearing list
- **forceReload**: Clear list then reload (for deletions)

---

## useArmorFitting

Orchestrates armor fitting operations with the ArmorFittingViewer.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/hooks/useArmorFitting.ts`

### Signature

```typescript
interface UseArmorFittingOptions {
  viewerRef: React.RefObject<ArmorFittingViewerRef>
}

interface UseArmorFittingReturn {
  handleFit: () => Promise<void>
  handleBind: () => Promise<void>
  handleReset: () => void
  handleExport: () => Promise<void>
  isFitting: boolean
  progress: number
  error: string | null
}

export function useArmorFitting(
  options: UseArmorFittingOptions
): UseArmorFittingReturn
```

### Implementation

```typescript
export function useArmorFitting({ viewerRef }: UseArmorFittingOptions) {
  const {
    selectedAvatar,
    selectedArmor,
    fittingConfig,
    enableWeightTransfer,
    isFitting,
    fittingProgress,
    lastError,
    performFitting,
    bindArmorToSkeleton,
    resetFitting,
    exportFittedArmor
  } = useArmorFittingStore()

  const handleFit = useCallback(async () => {
    if (!selectedAvatar || !selectedArmor) {
      console.warn('Missing avatar or armor')
      return
    }

    await performFitting(viewerRef)
  }, [selectedAvatar, selectedArmor, performFitting, viewerRef])

  const handleBind = useCallback(async () => {
    if (!selectedAvatar || !selectedArmor) return

    await bindArmorToSkeleton(viewerRef)
  }, [selectedAvatar, selectedArmor, bindArmorToSkeleton, viewerRef])

  const handleReset = useCallback(() => {
    resetFitting()
    viewerRef.current?.resetTransform()
  }, [resetFitting, viewerRef])

  const handleExport = useCallback(async () => {
    await exportFittedArmor(viewerRef)
  }, [exportFittedArmor, viewerRef])

  return {
    handleFit,
    handleBind,
    handleReset,
    handleExport,
    isFitting,
    progress: fittingProgress,
    error: lastError
  }
}
```

### Usage Example

```typescript
const ArmorFittingControls = () => {
  const viewerRef = useRef<ArmorFittingViewerRef>(null)

  const {
    handleFit,
    handleBind,
    handleReset,
    handleExport,
    isFitting,
    progress,
    error
  } = useArmorFitting({ viewerRef })

  return (
    <div>
      <Button onClick={handleFit} disabled={isFitting}>
        Fit Armor
      </Button>

      <Button onClick={handleBind} disabled={isFitting}>
        Bind to Skeleton
      </Button>

      <Button onClick={handleReset}>
        Reset
      </Button>

      <Button onClick={handleExport}>
        Export
      </Button>

      {isFitting && <Progress value={progress} />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  )
}
```

---

## useAssetActions

Provides CRUD operations for assets with viewer integration.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/hooks/useAssetActions.ts`

### Signature

```typescript
interface UseAssetActionsOptions {
  viewerRef: React.RefObject<ThreeViewerRef>
  reloadAssets: () => Promise<void>
  forceReload: () => Promise<void>
  assets: Asset[]
}

interface UseAssetActionsReturn {
  handleViewerReset: () => void
  handleDownload: () => void
  handleDeleteAsset: (asset: Asset, includeVariants?: boolean) => Promise<void>
  handleSaveAsset: (updatedAsset: Partial<Asset>) => Promise<Asset>
}

export function useAssetActions(
  options: UseAssetActionsOptions
): UseAssetActionsReturn
```

### Implementation Highlights

```typescript
export function useAssetActions({
  viewerRef,
  reloadAssets,
  forceReload,
  assets
}: UseAssetActionsOptions) {
  const {
    selectedAsset,
    setSelectedAsset,
    setShowEditModal,
    setIsTransitioning,
    clearSelection
  } = useAssetsStore()

  const handleViewerReset = useCallback(() => {
    viewerRef.current?.resetCamera()
  }, [viewerRef])

  const handleDownload = useCallback(() => {
    if (selectedAsset?.hasModel) {
      viewerRef.current?.takeScreenshot()
    }
  }, [selectedAsset, viewerRef])

  const handleDeleteAsset = useCallback(async (
    asset: Asset,
    includeVariants?: boolean
  ) => {
    // Clear selection before delete
    if (selectedAsset?.id === asset.id) {
      clearSelection()
    }

    setShowEditModal(false)

    await apiFetch(
      `${API_ENDPOINTS.ASSETS}/${asset.id}?includeVariants=${includeVariants}`,
      { method: 'DELETE' }
    )

    // Small delay for filesystem
    await new Promise(resolve => setTimeout(resolve, 500))

    await forceReload()
  }, [selectedAsset, clearSelection, setShowEditModal, forceReload])

  const handleSaveAsset = useCallback(async (
    updatedAsset: Partial<Asset>
  ) => {
    const response = await apiFetch(
      `${API_ENDPOINTS.ASSETS}/${updatedAsset.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAsset)
      }
    )

    const savedAsset = await response.json()

    // Handle rename
    if (savedAsset.id !== updatedAsset.id) {
      setIsTransitioning(true)
      setSelectedAsset(savedAsset)
    }

    setShowEditModal(false)
    await reloadAssets()

    if (savedAsset.id !== updatedAsset.id) {
      setTimeout(() => setIsTransitioning(false), 500)
    }

    return savedAsset
  }, [setIsTransitioning, setSelectedAsset, setShowEditModal, reloadAssets])

  return {
    handleViewerReset,
    handleDownload,
    handleDeleteAsset,
    handleSaveAsset
  }
}
```

### Usage Example

```typescript
const AssetsPage = () => {
  const viewerRef = useRef<ThreeViewerRef>(null)
  const { assets, reloadAssets, forceReload } = useAssets()

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

  return (
    <div>
      <ThreeViewer ref={viewerRef} />

      <Button onClick={handleViewerReset}>Reset Camera</Button>
      <Button onClick={handleDownload}>Screenshot</Button>

      <AssetEditModal
        onSave={handleSaveAsset}
        onDelete={handleDeleteAsset}
      />
    </div>
  )
}
```

---

## usePipelineStatus

Polls pipeline status and updates UI in real-time.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/hooks/usePipelineStatus.ts`

### Signature

```typescript
interface UsePipelineStatusOptions {
  apiClient: GenerationAPIClient
  onComplete?: (asset: GeneratedAsset) => void
}

interface UsePipelineStatusReturn {
  intervalRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
}

export function usePipelineStatus(
  options: UsePipelineStatusOptions
): UsePipelineStatusReturn
```

### Implementation

```typescript
export function usePipelineStatus({
  apiClient,
  onComplete
}: UsePipelineStatusOptions) {
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    currentPipelineId,
    useGPT4Enhancement,
    enableRetexturing,
    enableSprites,
    assetName,
    assetType,
    generationType,
    characterHeight,
    generatedAssets,
    setIsGenerating,
    updatePipelineStage,
    setGeneratedAssets,
    setSelectedAsset,
    setActiveView
  } = useGenerationStore()

  useEffect(() => {
    if (!currentPipelineId) return

    const POLL_INTERVAL = 1500

    const stageMapping: Record<string, string> = {
      'textInput': 'text-input',
      'promptOptimization': 'gpt4-enhancement',
      'imageGeneration': 'image-generation',
      'image3D': 'image-to-3d',
      'textureGeneration': 'retexturing',
      'spriteGeneration': 'sprites',
      'rigging': 'rigging'
    }

    intervalRef.current = setInterval(async () => {
      try {
        const status = await apiClient.fetchPipelineStatus(currentPipelineId)

        if (status) {
          // Update stages
          Object.entries(status.stages || {}).forEach(([stageName, stageData]) => {
            const uiStageId = stageMapping[stageName]
            if (uiStageId) {
              let uiStatus = stageData.status === 'processing' ? 'active' : stageData.status

              // Check config overrides
              if (uiStageId === 'gpt4-enhancement' && !useGPT4Enhancement) {
                uiStatus = 'skipped'
              }
              if (uiStageId === 'retexturing' && !enableRetexturing) {
                uiStatus = 'skipped'
              }
              if (uiStageId === 'sprites' && !enableSprites) {
                uiStatus = 'skipped'
              }

              updatePipelineStage(uiStageId, uiStatus)
            }
          })

          // Handle completion
          if (status.status === 'completed') {
            setIsGenerating(false)

            const finalAsset = createAssetFromResults(
              status.results,
              status.config,
              assetName,
              assetType,
              generationType,
              characterHeight,
              currentPipelineId
            )

            const exists = generatedAssets.some(a => a.id === finalAsset.id)
            if (!exists) {
              setGeneratedAssets([...generatedAssets, finalAsset])
            }

            setSelectedAsset(finalAsset)
            setActiveView('results')

            if (onComplete) {
              onComplete(finalAsset)
            }

            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          } else if (status.status === 'failed') {
            setIsGenerating(false)
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          }
        }
      } catch (error) {
        console.error('Failed to get pipeline status:', error)
      }
    }, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [currentPipelineId, /* all dependencies */])

  return { intervalRef }
}
```

### Usage Example

```typescript
const GenerationPage = () => {
  const [apiClient] = useState(() => new GenerationAPIClient())

  usePipelineStatus({
    apiClient,
    onComplete: (asset) => {
      console.log('Generation complete:', asset.name)
      notify.success(`${asset.name} generated successfully!`)
    }
  })

  // Rest of component...
}
```

---

## usePrompts

Loads prompt templates from the backend.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/hooks/usePrompts.ts`

### Signatures

```typescript
// Game style prompts
interface UseGameStylePromptsReturn {
  prompts: GameStylePrompts | null
  loading: boolean
  error: string | null
  saveCustomGameStyle: (name: string, config: GameStyleConfig) => Promise<void>
  deleteCustomGameStyle: (name: string) => Promise<void>
}

export function useGameStylePrompts(): UseGameStylePromptsReturn

// Asset type prompts
interface UseAssetTypePromptsReturn {
  prompts: AssetTypePrompts | null
  loading: boolean
  error: string | null
  saveCustomAssetType: (id: string, config: TypeConfig, generationType: string) => Promise<void>
  deleteCustomAssetType: (id: string) => Promise<void>
  getAllTypes: () => Record<string, TypeConfig>
  getTypesByGeneration: (type: 'item' | 'avatar') => Record<string, TypeConfig>
}

export function useAssetTypePrompts(): UseAssetTypePromptsReturn

// Material prompts
interface UseMaterialPromptTemplatesReturn {
  templates: MaterialPromptTemplates
  loading: boolean
  error: string | null
}

export function useMaterialPromptTemplates(): UseMaterialPromptTemplatesReturn
```

### Usage Example

```typescript
const AdvancedPromptsCard = () => {
  const {
    prompts: gameStylePrompts,
    loading: gameStyleLoading,
    saveCustomGameStyle,
    deleteCustomGameStyle
  } = useGameStylePrompts()

  const {
    prompts: assetTypePrompts,
    getTypesByGeneration
  } = useAssetTypePrompts()

  const {
    templates: materialTemplates
  } = useMaterialPromptTemplates()

  const currentTypes = getTypesByGeneration('item')

  return (
    <div>
      {gameStyleLoading ? (
        <Spinner />
      ) : (
        <GameStyleSelector
          styles={gameStylePrompts}
          onSave={saveCustomGameStyle}
          onDelete={deleteCustomGameStyle}
        />
      )}
    </div>
  )
}
```

---

## useMaterialPresets

Manages material preset CRUD operations.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/hooks/useMaterialPresets.ts`

### Signature

```typescript
interface UseMaterialPresetsReturn {
  handleSaveCustomMaterials: () => Promise<void>
  handleUpdatePreset: (preset: MaterialPreset) => Promise<void>
  handleDeletePreset: (id: string) => Promise<void>
}

export function useMaterialPresets(): UseMaterialPresetsReturn
```

### Usage Example

```typescript
const MaterialVariantsCard = () => {
  const { materialPresets, customMaterials } = useGenerationStore()
  const {
    handleSaveCustomMaterials,
    handleUpdatePreset,
    handleDeletePreset
  } = useMaterialPresets()

  return (
    <div>
      <MaterialList
        presets={materialPresets}
        onEdit={handleUpdatePreset}
        onDelete={handleDeletePreset}
      />

      <CustomMaterialForm
        materials={customMaterials}
        onSave={handleSaveCustomMaterials}
      />
    </div>
  )
}
```

---

## useArmorExport

Utilities for exporting fitted armor models.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/hooks/useArmorExport.ts`

### Signature

```typescript
interface UseArmorExportOptions {
  viewerRef: React.RefObject<ArmorFittingViewerRef>
}

interface UseArmorExportReturn {
  exportFittedArmor: () => Promise<void>
  exportEquippedAvatar: () => Promise<void>
  isExporting: boolean
}

export function useArmorExport(
  options: UseArmorExportOptions
): UseArmorExportReturn
```

### Usage Example

```typescript
const ExportPanel = () => {
  const viewerRef = useRef<ArmorFittingViewerRef>(null)
  const {
    exportFittedArmor,
    exportEquippedAvatar,
    isExporting
  } = useArmorExport({ viewerRef })

  return (
    <div>
      <Button onClick={exportFittedArmor} disabled={isExporting}>
        Export Armor Only
      </Button>

      <Button onClick={exportEquippedAvatar} disabled={isExporting}>
        Export Equipped Avatar
      </Button>
    </div>
  )
}
```

---

## useNavigation

Accesses the navigation context.

### File Location

`/Users/home/hyperscape-1/packages/asset-forge/src/hooks/useNavigation.ts`

### Signature

```typescript
interface NavigationContextValue {
  currentPage: string
  navigateTo: (page: string, params?: Record<string, any>) => void
  goBack: () => void
  navigationHistory: string[]
}

export function useNavigation(): NavigationContextValue
```

### Usage Example

```typescript
const NavigationButton = () => {
  const { currentPage, navigateTo } = useNavigation()

  return (
    <button
      onClick={() => navigateTo('assets')}
      className={currentPage === 'assets' ? 'active' : ''}
    >
      Assets
    </button>
  )
}
```

---

## Hook Composition

Hooks can compose other hooks for complex functionality:

```typescript
export function useAssetWorkflow() {
  const { assets, loading, reloadAssets } = useAssets()
  const { apiCall } = useApi()
  const viewerRef = useRef<ThreeViewerRef>(null)

  const {
    handleDeleteAsset,
    handleSaveAsset
  } = useAssetActions({
    viewerRef,
    reloadAssets,
    forceReload: reloadAssets,
    assets
  })

  const createAndSelectAsset = async (data: AssetData) => {
    const newAsset = await apiCall('/api/assets', {
      method: 'POST',
      body: JSON.stringify(data)
    })

    if (newAsset) {
      await reloadAssets()
      return newAsset
    }
  }

  return {
    assets,
    loading,
    viewerRef,
    createAndSelectAsset,
    deleteAsset: handleDeleteAsset,
    saveAsset: handleSaveAsset
  }
}
```

---

## Best Practices

### 1. Stable References

Use `useCallback` and `useRef` to prevent unnecessary re-renders:

```typescript
const handleAction = useCallback(() => {
  // Logic that doesn't change on every render
}, [/* stable dependencies */])

const stableRef = useRef(expensiveComputation())
```

### 2. Cleanup Functions

Always clean up side effects:

```typescript
useEffect(() => {
  const subscription = subscribe()
  const interval = setInterval(poll, 1000)

  return () => {
    subscription.unsubscribe()
    clearInterval(interval)
  }
}, [])
```

### 3. Error Boundaries

Hooks can't catch errors themselves, wrap components:

```typescript
<ErrorBoundary>
  <ComponentUsingHooks />
</ErrorBoundary>
```

### 4. Dependency Arrays

Be explicit and complete:

```typescript
// ❌ Bad - missing dependency
useEffect(() => {
  doSomething(value)
}, [])

// ✅ Good
useEffect(() => {
  doSomething(value)
}, [value])
```

### 5. Custom Hook Testing

Test hooks with `@testing-library/react-hooks`:

```typescript
import { renderHook, act } from '@testing-library/react-hooks'

test('useAssets loads assets', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useAssets())

  expect(result.current.loading).toBe(true)

  await waitForNextUpdate()

  expect(result.current.loading).toBe(false)
  expect(result.current.assets.length).toBeGreaterThan(0)
})
```

---

## Summary

Asset Forge's custom hooks provide:

- **Clean abstraction**: Complex logic separated from components
- **Reusability**: Shared logic across multiple components
- **Type safety**: Full TypeScript coverage
- **Composability**: Hooks build on other hooks
- **Testability**: Isolated logic easy to test
- **Performance**: Optimized with memoization

The hook architecture enables rapid development while maintaining code quality and developer experience.
