# Hooks Reference

> **Complete reference for all custom React hooks in Asset Forge**

This document provides detailed documentation for all custom hooks used throughout the application.

---

## Table of Contents

- [Data Fetching Hooks](#data-fetching-hooks)
- [State Management Hooks](#state-management-hooks)
- [Three.js Hooks](#threejs-hooks)
- [Utility Hooks](#utility-hooks)
- [Form Hooks](#form-hooks)

---

## Data Fetching Hooks

### useAssets

Fetch and manage asset list with caching and filtering.

**Location:** `src/hooks/useAssets.ts`

```typescript
function useAssets(filters?: AssetFilters): {
  assets: Asset[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  fromCache: boolean
}
```

**Parameters:**
- `filters` (optional): Filter criteria for assets
  - `type?: string` - Asset type (weapon, armor, etc.)
  - `status?: string` - Asset status (pending, completed, etc.)
  - `search?: string` - Search query

**Returns:**
- `assets`: Array of filtered assets
- `loading`: Loading state
- `error`: Error object if request failed
- `refetch`: Function to refresh data
- `fromCache`: Whether data came from cache

**Example:**
```typescript
function AssetList() {
  const { assets, loading, error, refetch } = useAssets({
    type: 'weapon',
    status: 'completed'
  })

  if (loading) return <Loading />
  if (error) return <Error message={error.message} />

  return (
    <div>
      {assets.map(asset => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
      <button onClick={refetch}>Refresh</button>
    </div>
  )
}
```

### useAssetActions

Perform actions on assets (update, delete, regenerate).

**Location:** `src/hooks/useAssetActions.ts`

```typescript
function useAssetActions(): {
  updateAsset: (id: string, updates: Partial<Asset>) => Promise<Asset>
  deleteAsset: (id: string) => Promise<void>
  regenerateAsset: (id: string, config: GenerationConfig) => Promise<string>
  loading: boolean
  error: Error | null
}
```

**Example:**
```typescript
function AssetCard({ asset }: { asset: Asset }) {
  const { updateAsset, deleteAsset, loading } = useAssetActions()

  const handleRename = async (newName: string) => {
    await updateAsset(asset.id, { name: newName })
  }

  const handleDelete = async () => {
    if (confirm('Delete asset?')) {
      await deleteAsset(asset.id)
    }
  }

  return (
    <div>
      <h3>{asset.name}</h3>
      <button onClick={() => handleRename('New Name')} disabled={loading}>
        Rename
      </button>
      <button onClick={handleDelete} disabled={loading}>
        Delete
      </button>
    </div>
  )
}
```

### useDataFetch

Generic data fetching hook with caching and error handling.

**Location:** `src/hooks/useDataFetch.ts`

```typescript
function useDataFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: {
    enabled?: boolean
    cacheTime?: number
    refetchOnMount?: boolean
  }
): {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}
```

**Example:**
```typescript
function PresetList() {
  const { data: presets, loading } = useDataFetch(
    'material-presets',
    () => fetch('/api/presets').then(r => r.json()),
    { cacheTime: 60 * 60 * 1000 } // 1 hour cache
  )

  if (loading) return <Loading />
  return <div>{presets.map(p => p.name).join(', ')}</div>
}
```

---

## State Management Hooks

### useApi

Access API client for making requests.

**Location:** `src/hooks/useApi.ts`

```typescript
function useApi(): {
  get: <T>(url: string) => Promise<T>
  post: <T>(url: string, data: any) => Promise<T>
  put: <T>(url: string, data: any) => Promise<T>
  delete: <T>(url: string) => Promise<T>
}
```

**Example:**
```typescript
function GenerationPanel() {
  const api = useApi()

  const startGeneration = async (config: GenerationConfig) => {
    const result = await api.post('/api/generation/pipeline', config)
    console.log('Pipeline started:', result.pipelineId)
  }

  return <button onClick={() => startGeneration(config)}>Start</button>
}
```

### useModalState

Manage modal open/close state.

**Location:** `src/hooks/useModalState.ts`

```typescript
function useModalState(initialState = false): {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}
```

**Example:**
```typescript
function AssetActions() {
  const deleteModal = useModalState()
  const regenerateModal = useModalState()

  return (
    <div>
      <button onClick={deleteModal.open}>Delete</button>
      <button onClick={regenerateModal.open}>Regenerate</button>

      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.close}>
        <DeleteConfirmation />
      </Modal>

      <Modal isOpen={regenerateModal.isOpen} onClose={regenerateModal.close}>
        <RegenerateForm />
      </Modal>
    </div>
  )
}
```

### useAsyncOperation

Handle async operations with loading and error states.

**Location:** `src/hooks/useAsyncOperation.ts`

```typescript
function useAsyncOperation<T>(): {
  execute: (fn: () => Promise<T>) => Promise<T>
  loading: boolean
  error: Error | null
  reset: () => void
}
```

**Example:**
```typescript
function UploadForm() {
  const { execute, loading, error } = useAsyncOperation()

  const handleSubmit = async (file: File) => {
    await execute(async () => {
      const formData = new FormData()
      formData.append('file', file)
      await fetch('/api/upload', { method: 'POST', body: formData })
    })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); handleSubmit(fileInput.files[0]) }}>
      <input type="file" ref={fileInput} />
      <button type="submit" disabled={loading}>
        {loading ? 'Uploading...' : 'Upload'}
      </button>
      {error && <div className="error">{error.message}</div>}
    </form>
  )
}
```

---

## Three.js Hooks

### useThreeScene

Setup and manage a Three.js scene.

**Location:** `src/hooks/useThreeScene.ts`

```typescript
function useThreeScene(options?: {
  antialias?: boolean
  alpha?: boolean
  cameraPosition?: [number, number, number]
}): {
  sceneRef: RefObject<HTMLDivElement>
  scene: THREE.Scene | null
  camera: THREE.Camera | null
  renderer: THREE.WebGLRenderer | null
  loadModel: (url: string) => Promise<THREE.Object3D>
}
```

**Example:**
```typescript
function ModelViewer({ modelUrl }: { modelUrl: string }) {
  const { sceneRef, scene, camera, renderer, loadModel } = useThreeScene({
    antialias: true,
    cameraPosition: [0, 2, 5]
  })

  useEffect(() => {
    if (!scene) return

    loadModel(modelUrl).then(model => {
      scene.add(model)
    })
  }, [scene, modelUrl])

  return <div ref={sceneRef} className="model-viewer" />
}
```

### useRendererPool

Use WebGL renderer from pool.

**Location:** `src/hooks/useRendererPool.ts`

```typescript
function useRendererPool(options?: RendererOptions): {
  rendererId: string | null
  renderer: THREE.WebGLRenderer | null
}
```

**Example:**
```typescript
function ThreeViewer({ modelUrl }: { modelUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { renderer } = useRendererPool({ antialias: true })

  useEffect(() => {
    if (!renderer || !containerRef.current) return

    containerRef.current.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

    function animate() {
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    return () => {
      if (renderer.domElement.parentNode === containerRef.current) {
        containerRef.current?.removeChild(renderer.domElement)
      }
    }
  }, [renderer])

  return <div ref={containerRef} />
}
```

### useArmorFitting

Handle armor fitting operations.

**Location:** `src/hooks/useArmorFitting.ts`

```typescript
function useArmorFitting(): {
  fitArmor: (armor: THREE.Object3D, avatar: THREE.Object3D) => Promise<void>
  exportFitted: () => Promise<Blob>
  progress: number
  status: string
}
```

**Example:**
```typescript
function ArmorFittingPanel() {
  const { fitArmor, exportFitted, progress, status } = useArmorFitting()
  const [armor, setArmor] = useState<THREE.Object3D | null>(null)
  const [avatar, setAvatar] = useState<THREE.Object3D | null>(null)

  const handleFit = async () => {
    if (!armor || !avatar) return
    await fitArmor(armor, avatar)
  }

  const handleExport = async () => {
    const blob = await exportFitted()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fitted-armor.glb'
    a.click()
  }

  return (
    <div>
      <button onClick={handleFit}>Fit Armor</button>
      <button onClick={handleExport}>Export</button>
      <div>Progress: {progress}%</div>
      <div>Status: {status}</div>
    </div>
  )
}
```

---

## Utility Hooks

### useIsMounted

Check if component is still mounted (prevent state updates after unmount).

**Location:** `src/hooks/useIsMounted.ts`

```typescript
function useIsMounted(): () => boolean
```

**Example:**
```typescript
function DataLoader() {
  const isMounted = useIsMounted()
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchData().then(result => {
      // Only update state if component still mounted
      if (isMounted()) {
        setData(result)
      }
    })
  }, [])

  return <div>{data ? JSON.stringify(data) : 'Loading...'}</div>
}
```

### useNavigation

Access navigation utilities.

**Location:** `src/hooks/useNavigation.ts`

```typescript
function useNavigation(): {
  navigate: (path: string) => void
  goBack: () => void
  currentPath: string
  params: Record<string, string>
}
```

**Example:**
```typescript
function AssetCard({ asset }: { asset: Asset }) {
  const { navigate, params } = useNavigation()

  const handleClick = () => {
    navigate(`/assets/${asset.id}`)
  }

  return (
    <div onClick={handleClick} className="asset-card">
      <h3>{asset.name}</h3>
      <p>Click to view details</p>
    </div>
  )
}
```

### usePipelineStatus

Monitor generation pipeline status.

**Location:** `src/hooks/usePipelineStatus.ts`

```typescript
function usePipelineStatus(pipelineId: string): {
  status: PipelineStatus | null
  progress: number
  error: string | null
  completed: boolean
}
```

**Example:**
```typescript
function PipelineMonitor({ pipelineId }: { pipelineId: string }) {
  const { status, progress, error, completed } = usePipelineStatus(pipelineId)

  if (error) return <div className="error">{error}</div>
  if (completed) return <div className="success">Pipeline completed!</div>

  return (
    <div>
      <div>Status: {status}</div>
      <div>Progress: {progress}%</div>
      <ProgressBar value={progress} />
    </div>
  )
}
```

### useCacheStats

Monitor cache performance.

**Location:** `src/hooks/useCacheStats.ts`

```typescript
function useCacheStats(): {
  stats: CacheStats
  refresh: () => void
}
```

**Example:**
```typescript
function CacheDebugPanel() {
  const { stats, refresh } = useCacheStats()

  return (
    <div className="cache-stats">
      <h3>Cache Statistics</h3>
      <div>Hit Rate: {stats.hitRate.toFixed(1)}%</div>
      <div>Total Requests: {stats.hits + stats.misses}</div>
      <div>Hits: {stats.hits}</div>
      <div>Misses: {stats.misses}</div>
      <button onClick={refresh}>Refresh</button>
    </div>
  )
}
```

---

## Form Hooks

### useMaterialPresets

Manage material preset selection and configuration.

**Location:** `src/hooks/useMaterialPresets.ts`

```typescript
function useMaterialPresets(): {
  presets: MaterialPreset[]
  selectedPresets: MaterialPreset[]
  togglePreset: (id: string) => void
  resetSelection: () => void
}
```

**Example:**
```typescript
function MaterialSelector() {
  const { presets, selectedPresets, togglePreset } = useMaterialPresets()

  return (
    <div>
      <h3>Select Materials</h3>
      {presets.map(preset => (
        <label key={preset.id}>
          <input
            type="checkbox"
            checked={selectedPresets.some(p => p.id === preset.id)}
            onChange={() => togglePreset(preset.id)}
          />
          {preset.name}
        </label>
      ))}
      <div>Selected: {selectedPresets.length}</div>
    </div>
  )
}
```

### usePrompts

Manage AI prompt templates.

**Location:** `src/hooks/usePrompts.ts`

```typescript
function usePrompts(): {
  prompts: Record<string, string>
  getPrompt: (key: string) => string
  updatePrompt: (key: string, value: string) => void
}
```

**Example:**
```typescript
function PromptEditor() {
  const { prompts, getPrompt, updatePrompt } = usePrompts()

  return (
    <div>
      {Object.keys(prompts).map(key => (
        <div key={key}>
          <label>{key}</label>
          <textarea
            value={getPrompt(key)}
            onChange={e => updatePrompt(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  )
}
```

---

## Hook Composition Patterns

### Combining Multiple Hooks

```typescript
// Compose multiple hooks for complex features
function useAssetDetails(id: string) {
  const { data: asset, loading, error } = useDataFetch(
    `asset-${id}`,
    () => AssetService.fetchAsset(id)
  )

  const { updateAsset, deleteAsset } = useAssetActions()
  const { navigate } = useNavigation()
  const deleteModal = useModalState()

  const handleUpdate = async (updates: Partial<Asset>) => {
    await updateAsset(id, updates)
  }

  const handleDelete = async () => {
    await deleteAsset(id)
    navigate('/assets')
  }

  return {
    asset,
    loading,
    error,
    updateAsset: handleUpdate,
    deleteAsset: handleDelete,
    deleteModal
  }
}

// Usage
function AssetDetailsPage({ id }: { id: string }) {
  const {
    asset,
    loading,
    updateAsset,
    deleteAsset,
    deleteModal
  } = useAssetDetails(id)

  if (loading) return <Loading />

  return (
    <div>
      <h1>{asset.name}</h1>
      <button onClick={() => updateAsset({ name: 'New Name' })}>
        Rename
      </button>
      <button onClick={deleteModal.open}>Delete</button>

      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.close}>
        <div>
          <p>Delete {asset.name}?</p>
          <button onClick={deleteAsset}>Confirm</button>
          <button onClick={deleteModal.close}>Cancel</button>
        </div>
      </Modal>
    </div>
  )
}
```

---

## Best Practices

### Hook Naming

```typescript
// ✅ Good: Descriptive names starting with "use"
useAssets()
useAssetActions()
useThreeScene()

// ❌ Bad: Generic or non-descriptive
getData()
assetHook()
scene()
```

### Dependency Arrays

```typescript
// ✅ Good: Include all dependencies
const data = useMemo(() => {
  return processAssets(assets, filters)
}, [assets, filters]) // All dependencies listed

// ❌ Bad: Missing dependencies
const data = useMemo(() => {
  return processAssets(assets, filters)
}, [assets]) // filters missing!
```

### Cleanup

```typescript
// ✅ Good: Always cleanup side effects
useEffect(() => {
  const timer = setTimeout(() => {}, 1000)
  return () => clearTimeout(timer)
}, [])

// ❌ Bad: No cleanup
useEffect(() => {
  setTimeout(() => {}, 1000)
  // Missing cleanup!
}, [])
```

---

## Related Documentation

- [Frontend API](./frontend-api.md) - Frontend service APIs
- [Component Patterns](../11-development/component-patterns.md) - React patterns
- [State Management](../11-development/state-management.md) - Zustand stores

---

**Last Updated:** 2025-10-24
**Version:** 1.0.0
