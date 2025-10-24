# Memory Leak Prevention Guide

> **Migration Guide**: Prevent memory leaks with proper blob URL cleanup and resource management

## Why Migrate?

Memory leaks cause significant problems in long-running applications:

- **Memory Exhaustion**: Leaks accumulate over time, causing browser slowdowns
- **Browser Crashes**: Uncleaned resources can crash tabs or entire browsers
- **Poor Performance**: Memory pressure degrades UI responsiveness
- **Blob URL Leaks**: Each createObjectURL() consumes memory until revoked
- **Event Listener Leaks**: Unremoved listeners keep components in memory

## When to Use

Apply memory cleanup for:
- Blob URLs (model downloads, exports, images)
- Object URLs for file downloads
- Three.js scenes, geometries, materials, textures
- Event listeners (DOM, custom events)
- Timers and intervals
- WebGL contexts and renderers
- React component cleanup (useEffect cleanup)

## Migration Steps

### Step 1: Identify Resource Creation

Find locations where resources are created:

```typescript
// Resources that need cleanup
const blobUrl = URL.createObjectURL(blob)
const scene = new THREE.Scene()
const material = new THREE.MeshStandardMaterial()
window.addEventListener('resize', handler)
const interval = setInterval(poll, 1000)
```

### Step 2: Implement Cleanup

Add cleanup code using proper patterns:

```typescript
// Blob URL cleanup
const url = URL.createObjectURL(blob)
// ... use url ...
URL.revokeObjectURL(url)

// React cleanup
useEffect(() => {
  const handler = () => { /* ... */ }
  window.addEventListener('resize', handler)

  return () => {
    window.removeEventListener('resize', handler)
  }
}, [])
```

### Step 3: Track Resources

Keep track of resources that need cleanup:

```typescript
// Store URLs for cleanup
const [blobUrls, setBlobUrls] = useState<string[]>([])

// Cleanup on unmount
useEffect(() => {
  return () => {
    blobUrls.forEach(url => URL.revokeObjectURL(url))
  }
}, [blobUrls])
```

## Complete Examples

### Before Migration - Blob URL Leak

```typescript
// useHandRiggingStore.ts - Before (MEMORY LEAK)
export const useHandRiggingStore = create<HandRiggingStore>((set) => ({
  modelUrl: null,

  setModelUrl: (url) => set({ modelUrl: url }),

  exportModel: async (blob) => {
    const url = URL.createObjectURL(blob)  // LEAK: Never revoked!
    const a = document.createElement('a')
    a.href = url
    a.download = 'model.glb'
    a.click()
    // Missing: URL.revokeObjectURL(url)
  },

  reset: () => set({ modelUrl: null })
  // Missing: Revoke old blob URL before resetting
}))
```

### After Migration - Proper Cleanup

```typescript
// useHandRiggingStore.ts - After (NO LEAK)
import { createLogger } from '@/utils/logger'

const logger = createLogger('HandRiggingStore')

export const useHandRiggingStore = create<HandRiggingStore>((set) => ({
  modelUrl: null,

  setModelUrl: (url) => set((state) => {
    // Revoke old blob URL if it exists
    if (state.modelUrl && state.modelUrl.startsWith('blob:')) {
      URL.revokeObjectURL(state.modelUrl)
      logger.debug('Revoked old blob URL', { url: state.modelUrl })
    }

    return { modelUrl: url }
  }),

  exportModel: async (blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'model.glb'
    a.click()

    // Clean up blob URL after download
    URL.revokeObjectURL(url)
    logger.debug('Revoked blob URL after export', { url })
  },

  reset: () => set((state) => {
    // Revoke blob URL before resetting
    if (state.modelUrl && state.modelUrl.startsWith('blob:')) {
      URL.revokeObjectURL(state.modelUrl)
      logger.debug('Revoked blob URL on reset', { url: state.modelUrl })
    }

    return {
      modelUrl: null,
      selectedAvatar: null,
      // ... other reset state
    }
  })
}))
```

### Before Migration - React Component Leak

```typescript
// AssetViewer.tsx - Before (MEMORY LEAK)
function AssetViewer({ assetUrl }: Props) {
  const [scene] = useState(() => new THREE.Scene())
  const [material] = useState(() => new THREE.MeshStandardMaterial())

  useEffect(() => {
    const handleResize = () => {
      // Update viewport
    }

    window.addEventListener('resize', handleResize)
    // Missing cleanup!
  }, [])

  useEffect(() => {
    loadModel(assetUrl, scene)
    // Missing: Cleanup old model
  }, [assetUrl])

  // Missing: Component cleanup on unmount

  return <canvas ref={canvasRef} />
}
```

### After Migration - Proper React Cleanup

```typescript
// AssetViewer.tsx - After (NO LEAK)
import { createLogger } from '@/utils/logger'

const logger = createLogger('AssetViewer')

function AssetViewer({ assetUrl }: Props) {
  const sceneRef = useRef<THREE.Scene>()
  const materialRef = useRef<THREE.Material>()

  // Initialize scene
  useEffect(() => {
    sceneRef.current = new THREE.Scene()
    materialRef.current = new THREE.MeshStandardMaterial()

    return () => {
      // Cleanup on unmount
      if (sceneRef.current) {
        sceneRef.current.clear()
        sceneRef.current = undefined
        logger.debug('Scene cleared')
      }

      if (materialRef.current) {
        materialRef.current.dispose()
        materialRef.current = undefined
        logger.debug('Material disposed')
      }
    }
  }, [])

  // Handle resize with cleanup
  useEffect(() => {
    const handleResize = () => {
      logger.debug('Viewport resized')
      // Update viewport
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      logger.debug('Resize listener removed')
    }
  }, [])

  // Load model with cleanup
  useEffect(() => {
    if (!sceneRef.current || !assetUrl) return

    const controller = new AbortController()

    loadModel(assetUrl, sceneRef.current, controller.signal)
      .catch(error => {
        if (error.name !== 'AbortError') {
          logger.error('Failed to load model', { error: error.message })
        }
      })

    return () => {
      // Abort loading and cleanup old model
      controller.abort()

      if (sceneRef.current) {
        // Remove old models from scene
        const objectsToRemove = sceneRef.current.children.filter(
          child => child.type === 'Mesh' || child.type === 'Group'
        )

        objectsToRemove.forEach(obj => {
          sceneRef.current?.remove(obj)

          // Dispose geometries and materials
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => mat.dispose())
            } else {
              obj.material?.dispose()
            }
          }
        })

        logger.debug('Old model cleaned up', { count: objectsToRemove.length })
      }
    }
  }, [assetUrl])

  return <canvas ref={canvasRef} />
}
```

## Cleanup Patterns

### Pattern 1: Blob URL Cleanup (Immediate)

For temporary downloads, revoke immediately after use:

```typescript
// Export file with immediate cleanup
function exportData(data: object) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'data.json'
  a.click()

  // Revoke immediately - download is triggered
  URL.revokeObjectURL(url)

  logger.debug('Data exported and blob URL cleaned up')
}
```

### Pattern 2: Blob URL Cleanup (Stored)

For stored URLs, revoke when replacing or unmounting:

```typescript
// Store blob URL with cleanup
const [previewUrl, setPreviewUrl] = useState<string | null>(null)

function updatePreview(blob: Blob) {
  // Revoke old URL if exists
  if (previewUrl && previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl)
  }

  // Create and store new URL
  const newUrl = URL.createObjectURL(blob)
  setPreviewUrl(newUrl)
}

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
      logger.debug('Preview URL cleaned up on unmount')
    }
  }
}, [previewUrl])
```

### Pattern 3: Three.js Resource Cleanup

Dispose Three.js resources properly:

```typescript
useEffect(() => {
  const geometry = new THREE.BoxGeometry()
  const material = new THREE.MeshBasicMaterial()
  const mesh = new THREE.Mesh(geometry, material)

  scene.add(mesh)

  return () => {
    // Remove from scene
    scene.remove(mesh)

    // Dispose resources
    geometry.dispose()
    material.dispose()

    // Dispose textures if present
    if (material.map) material.map.dispose()
    if (material.normalMap) material.normalMap.dispose()
    if (material.roughnessMap) material.roughnessMap.dispose()

    logger.debug('Three.js resources disposed')
  }
}, [])
```

### Pattern 4: Event Listener Cleanup

Remove all event listeners:

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Handle key press
  }

  const handleMouseMove = (e: MouseEvent) => {
    // Handle mouse move
  }

  // Add listeners
  window.addEventListener('keypress', handleKeyPress)
  document.addEventListener('mousemove', handleMouseMove)

  return () => {
    // Remove listeners
    window.removeEventListener('keypress', handleKeyPress)
    document.removeEventListener('mousemove', handleMouseMove)

    logger.debug('Event listeners removed')
  }
}, [])
```

### Pattern 5: Timer Cleanup

Clear intervals and timeouts:

```typescript
useEffect(() => {
  // Set up polling
  const intervalId = setInterval(() => {
    pollStatus()
  }, 1000)

  // Set up timeout
  const timeoutId = setTimeout(() => {
    handleTimeout()
  }, 30000)

  return () => {
    // Clear both
    clearInterval(intervalId)
    clearTimeout(timeoutId)

    logger.debug('Timers cleared')
  }
}, [])
```

### Pattern 6: Multiple Resource Tracking

Track multiple resources for cleanup:

```typescript
function ModelViewer() {
  const resourcesRef = useRef<{
    geometries: THREE.Geometry[]
    materials: THREE.Material[]
    textures: THREE.Texture[]
    blobUrls: string[]
  }>({
    geometries: [],
    materials: [],
    textures: [],
    blobUrls: []
  })

  function addMaterial(material: THREE.Material) {
    resourcesRef.current.materials.push(material)
    return material
  }

  function addBlobUrl(url: string) {
    resourcesRef.current.blobUrls.push(url)
    return url
  }

  // Cleanup all resources
  useEffect(() => {
    return () => {
      const resources = resourcesRef.current

      // Dispose all geometries
      resources.geometries.forEach(geo => geo.dispose())

      // Dispose all materials
      resources.materials.forEach(mat => mat.dispose())

      // Dispose all textures
      resources.textures.forEach(tex => tex.dispose())

      // Revoke all blob URLs
      resources.blobUrls.forEach(url => URL.revokeObjectURL(url))

      logger.info('All resources cleaned up', {
        geometries: resources.geometries.length,
        materials: resources.materials.length,
        textures: resources.textures.length,
        blobUrls: resources.blobUrls.length
      })
    }
  }, [])

  return <div>...</div>
}
```

## Best Practices

### 1. Always Check Before Revoking

Check if URL is a blob URL before revoking:

```typescript
// GOOD - Checks if blob URL
if (url && url.startsWith('blob:')) {
  URL.revokeObjectURL(url)
}

// BAD - Tries to revoke non-blob URLs
URL.revokeObjectURL(url) // Fails for http:// URLs
```

### 2. Revoke in Correct Order

Revoke blob URLs after they're no longer needed:

```typescript
// GOOD - Revoke after download triggered
const url = URL.createObjectURL(blob)
downloadLink.href = url
downloadLink.click()
URL.revokeObjectURL(url) // Safe - download already triggered

// BAD - Revoke before use
const url = URL.createObjectURL(blob)
URL.revokeObjectURL(url)
downloadLink.href = url // Broken - URL already revoked!
downloadLink.click()
```

### 3. Use useEffect Cleanup

Always return cleanup function from useEffect:

```typescript
// GOOD - Cleanup function
useEffect(() => {
  const resource = createResource()

  return () => {
    cleanupResource(resource)
  }
}, [])

// BAD - No cleanup
useEffect(() => {
  const resource = createResource()
  // Memory leak!
}, [])
```

### 4. Dispose Three.js Resources

Dispose geometry, materials, and textures:

```typescript
// GOOD - Complete disposal
geometry.dispose()
material.dispose()
if (material.map) material.map.dispose()

// BAD - Only removes from scene
scene.remove(mesh) // Geometry and material still in memory!
```

### 5. Track Nested Resources

Dispose resources in child objects:

```typescript
// GOOD - Recursive disposal
function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry?.dispose()

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach(mat => mat.dispose())
  } else {
    mesh.material?.dispose()
  }

  // Dispose children
  mesh.children.forEach(child => {
    if (child instanceof THREE.Mesh) {
      disposeMesh(child)
    }
  })
}
```

## Common Pitfalls

### Pitfall 1: Revoking Too Early

```typescript
// BAD - Revoked before image loads
const url = URL.createObjectURL(blob)
img.src = url
URL.revokeObjectURL(url) // Image may not load!

// GOOD - Revoke after image loads
const url = URL.createObjectURL(blob)
img.onload = () => {
  URL.revokeObjectURL(url)
}
img.src = url
```

### Pitfall 2: Not Tracking All Blob URLs

```typescript
// BAD - Loses track of URLs
function createPreview(blob: Blob) {
  return URL.createObjectURL(blob) // Returned but never tracked!
}

// GOOD - Track all created URLs
const urlsRef = useRef<string[]>([])

function createPreview(blob: Blob) {
  const url = URL.createObjectURL(blob)
  urlsRef.current.push(url)
  return url
}

useEffect(() => {
  return () => {
    urlsRef.current.forEach(URL.revokeObjectURL)
  }
}, [])
```

### Pitfall 3: Forgetting Event Listener Cleanup

```typescript
// BAD - Listener never removed
useEffect(() => {
  window.addEventListener('resize', handleResize)
}, []) // Missing cleanup!

// GOOD - Listener removed on unmount
useEffect(() => {
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])
```

### Pitfall 4: Partial Three.js Cleanup

```typescript
// BAD - Only disposes geometry
useEffect(() => {
  const mesh = createMesh()
  return () => {
    mesh.geometry.dispose() // Material and textures leak!
  }
}, [])

// GOOD - Complete cleanup
useEffect(() => {
  const mesh = createMesh()
  return () => {
    mesh.geometry.dispose()
    mesh.material.dispose()
    mesh.material.map?.dispose()
  }
}, [])
```

## Troubleshooting

### Issue: Memory keeps growing

**Cause**: Blob URLs or Three.js resources not being disposed

**Solution**: Use Chrome DevTools Memory profiler:
1. Open DevTools → Memory
2. Take heap snapshot
3. Perform action (load model, export, etc)
4. Take another snapshot
5. Compare - look for growing arrays of objects

### Issue: Images not loading after revoke

**Cause**: Revoking blob URL before image finishes loading

**Solution**: Revoke in image.onload callback:

```typescript
const url = URL.createObjectURL(blob)
image.onload = () => {
  URL.revokeObjectURL(url)
}
image.src = url
```

### Issue: Components remain in memory

**Cause**: Event listeners or timers preventing garbage collection

**Solution**: Ensure all cleanup in useEffect return:

```typescript
useEffect(() => {
  const interval = setInterval(poll, 1000)
  const listener = () => {}
  window.addEventListener('event', listener)

  return () => {
    clearInterval(interval)
    window.removeEventListener('event', listener)
  }
}, [])
```

## Migration Checklist

Use this checklist to prevent memory leaks:

### Blob URLs
- [ ] Check all URL.createObjectURL() calls
- [ ] Add URL.revokeObjectURL() cleanup
- [ ] Revoke old URLs when replacing
- [ ] Revoke on component unmount
- [ ] Check if URL is blob before revoking
- [ ] Track blob URLs in refs or state

### React Components
- [ ] Return cleanup function from all useEffect
- [ ] Remove event listeners on unmount
- [ ] Clear intervals and timeouts
- [ ] Dispose Three.js resources
- [ ] Cancel pending async operations
- [ ] Cleanup refs and state

### Three.js
- [ ] Dispose geometries
- [ ] Dispose materials
- [ ] Dispose textures (map, normalMap, etc)
- [ ] Remove objects from scene
- [ ] Dispose renderer on unmount
- [ ] Clear scene on unmount

### Testing
- [ ] Test component mount/unmount cycles
- [ ] Monitor memory in Chrome DevTools
- [ ] Verify no console errors about disposed resources
- [ ] Check for orphaned blob URLs in DevTools
- [ ] Test rapid state changes (URL replacements)

## Related Documentation

- [React useEffect Cleanup](https://react.dev/reference/react/useEffect#cleanup-function)
- [Three.js Memory Management](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects)
- [URL.createObjectURL MDN](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL)
- [Logger Migration Guide](/Users/home/hyperscape-1/packages/asset-forge/dev-book/11-development/migrations/console-to-logger.md)

## Examples in Codebase

See these files for real-world examples:

- `/Users/home/hyperscape-1/packages/asset-forge/src/store/useHandRiggingStore.ts`
- `/Users/home/hyperscape-1/packages/asset-forge/src/store/useArmorFittingStore.ts`
- `/Users/home/hyperscape-1/packages/asset-forge/src/store/useContentGenerationStore.ts`
- `/Users/home/hyperscape-1/packages/asset-forge/src/hooks/useAssets.ts`

---

**Last Updated**: 2025-10-24
**Migration Priority**: High
**Estimated Time**: 10-20 minutes per component
