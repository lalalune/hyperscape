# Debugging Tools and DevTools Usage

Asset Forge provides comprehensive debugging capabilities through browser DevTools, custom visualization tools, and performance profilers. This guide covers essential debugging techniques for 3D asset development.

## Table of Contents

1. [Browser DevTools](#browser-devtools)
2. [React DevTools](#react-devtools)
3. [Redux DevTools](#redux-devtools)
4. [Three.js Inspector](#threejs-inspector)
5. [Network Debugging](#network-debugging)
6. [Performance Profiling](#performance-profiling)
7. [Custom Debug Visualizations](#custom-debug-visualizations)
8. [Logging Strategies](#logging-strategies)

## Browser DevTools

### Console API

```typescript
// Log levels
console.log('Info message')
console.warn('Warning message')
console.error('Error message')
console.info('Detailed info')

// Grouping
console.group('Asset Generation')
console.log('Step 1: Create base model')
console.log('Step 2: Apply textures')
console.groupEnd()

// Tables
const assets = [
  { id: 1, name: 'Sword', type: 'weapon' },
  { id: 2, name: 'Helmet', type: 'armor' }
]
console.table(assets)

// Timing
console.time('Generation')
await generateAsset(config)
console.timeEnd('Generation') // Generation: 2345.67ms

// Performance marks
performance.mark('start-generation')
// ... code ...
performance.mark('end-generation')
performance.measure('generation-duration', 'start-generation', 'end-generation')
```

### Breakpoints and Debugging

```typescript
// Debugger statement
function processAsset(asset) {
  debugger // Pauses execution here
  return transform(asset)
}

// Conditional breakpoints in DevTools:
// Right-click line number → "Add conditional breakpoint"
// Condition: asset.type === 'weapon'

// Logpoints (Chrome):
// Right-click line number → "Add logpoint"
// Message: 'Processing asset:', asset.name
```

### Sources Panel

Key features:
- **Pause on exceptions**: Catch errors immediately
- **Watch expressions**: Monitor variable values
- **Call stack**: Trace execution flow
- **Local/Closure variables**: Inspect scope
- **Blackbox scripts**: Hide library code

## React DevTools

### Component Inspector

```typescript
// In Chrome/Firefox DevTools → React tab

// Inspect component tree
// - View props and state
// - See component hooks
// - Identify re-render causes

// Example: AssetViewer component
// Props:
//   - assetId: "bronze-sword-base"
//   - showControls: true
// State:
//   - loading: false
//   - model: THREE.Group
// Hooks:
//   - useState (loading)
//   - useEffect (model loading)
```

### Profiler

```typescript
// Profile component performance
// DevTools → Profiler tab → Start recording

// Analyze:
// - Render duration
// - Commit phases
// - Component update causes
// - Props/state changes

// Example results:
// AssetList rendered in 12.3ms
//   - Props changed: assets (200 items → 201 items)
//   - Children: 201 AssetCard components
//   - Committed: 15.8ms
```

### Common Issues

```typescript
// Debug re-render loops
function AssetCard({ asset }) {
  // Bad: Creates new object every render
  const style = { width: '100px' }

  // Good: Memoize
  const style = useMemo(() => ({ width: '100px' }), [])

  return <div style={style}>{asset.name}</div>
}

// Debug stale closures
function AssetList() {
  const [assets, setAssets] = useState([])

  useEffect(() => {
    // Bad: Stale closure
    const interval = setInterval(() => {
      console.log(assets.length) // Always 0
    }, 1000)

    return () => clearInterval(interval)
  }, []) // Missing dependency

  // Good: Include dependencies
  useEffect(() => {
    const interval = setInterval(() => {
      console.log(assets.length) // Updates correctly
    }, 1000)

    return () => clearInterval(interval)
  }, [assets])
}
```

## Redux DevTools

Asset Forge uses Zustand for state management, which integrates with Redux DevTools.

### Enable Redux DevTools

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AssetStore {
  assets: Asset[]
  addAsset: (asset: Asset) => void
}

export const useAssetStore = create<AssetStore>()(
  devtools(
    (set) => ({
      assets: [],
      addAsset: (asset) => set((state) => ({
        assets: [...state.assets, asset]
      }))
    }),
    { name: 'AssetStore' }
  )
)
```

### Using Redux DevTools

```typescript
// Chrome Extension: Redux DevTools
// Features:
// - Time-travel debugging
// - Action history
// - State diff viewer
// - Action dispatch

// Example action trace:
// Action: addAsset
// Payload: { id: '123', name: 'Steel Sword', type: 'weapon' }
// Previous state: { assets: [] }
// Next state: { assets: [{ id: '123', ... }] }
// Diff: + assets[0]
```

## Three.js Inspector

### Scene Hierarchy

```typescript
// Access scene from console
window.scene // THREE.Scene

// Inspect hierarchy
console.dir(scene)
// Scene
//   ├─ PerspectiveCamera
//   ├─ DirectionalLight
//   ├─ AmbientLight
//   └─ Group (character)
//       ├─ SkinnedMesh (body)
//       └─ Group (rightHand)
//           └─ Mesh (weapon)

// Helper functions
function printSceneHierarchy(object, depth = 0) {
  console.log('  '.repeat(depth) + object.type + ': ' + object.name)
  object.children.forEach(child => printSceneHierarchy(child, depth + 1))
}

printSceneHierarchy(scene)
```

### Object Inspector

```typescript
// Inspect specific object
const weapon = scene.getObjectByName('weapon')

console.log({
  type: weapon.type,
  position: weapon.position,
  rotation: weapon.rotation,
  scale: weapon.scale,
  visible: weapon.visible,
  matrixWorld: weapon.matrixWorld,
  material: weapon.material,
  geometry: weapon.geometry
})

// Material properties
const material = weapon.material as THREE.MeshStandardMaterial
console.log({
  color: material.color.getHex(),
  metalness: material.metalness,
  roughness: material.roughness,
  map: material.map?.image.src,
  normalMap: material.normalMap?.image.src
})
```

### Debug Helpers

```typescript
import * as THREE from 'three'

// Axes helper (RGB = XYZ)
const axesHelper = new THREE.AxesHelper(5)
scene.add(axesHelper)

// Grid helper
const gridHelper = new THREE.GridHelper(10, 10)
scene.add(gridHelper)

// Box helper (object bounds)
const boxHelper = new THREE.BoxHelper(weapon, 0xff0000)
scene.add(boxHelper)

// Skeleton helper (for rigged characters)
const skeletonHelper = new THREE.SkeletonHelper(character)
scene.add(skeletonHelper)

// Camera helper
const cameraHelper = new THREE.CameraHelper(camera)
scene.add(cameraHelper)

// Arrow helper (direction visualization)
const direction = new THREE.Vector3(1, 0, 0)
const origin = weapon.position
const arrowHelper = new THREE.ArrowHelper(direction, origin, 1, 0x00ff00)
scene.add(arrowHelper)
```

## Network Debugging

### Network Panel

Monitor API requests:

```typescript
// Chrome DevTools → Network tab

// Filter by type:
// - XHR: API requests
// - Fetch: apiFetch calls
// - Img: Textures and images
// - Media: GLB files

// Inspect request:
// Headers → Request Headers
//   - Content-Type: application/json
//   - X-Api-Key: ***
// Response → Preview/Response
// Timing → Request timing breakdown
```

### API Call Debugging

```typescript
// Wrap apiFetch for debugging
const originalApiFetch = apiFetch

window.debugApi = true

global.apiFetch = async (url, options) => {
  if (window.debugApi) {
    console.group(`API: ${options?.method || 'GET'} ${url}`)
    console.log('Options:', options)
  }

  try {
    const response = await originalApiFetch(url, options)

    if (window.debugApi) {
      console.log('Status:', response.status)
      console.log('Headers:', Object.fromEntries(response.headers.entries()))
    }

    return response
  } catch (error) {
    if (window.debugApi) {
      console.error('Error:', error)
    }
    throw error
  } finally {
    if (window.debugApi) {
      console.groupEnd()
    }
  }
}
```

## Performance Profiling

### Performance Panel

```typescript
// Chrome DevTools → Performance tab

// Record profile:
// 1. Click record button
// 2. Perform action (e.g., load asset)
// 3. Stop recording

// Analyze:
// - Main thread activity
// - JavaScript execution
// - Rendering/painting
// - Memory usage
// - FPS graph

// Example bottleneck:
// Function: fitMesh (MeshFittingService)
// Duration: 1,234ms
// Self time: 892ms
// Calls: 1
// → Optimize shrinkwrap algorithm
```

### Memory Profiler

```typescript
// Chrome DevTools → Memory tab

// Heap snapshot:
// - Take snapshot
// - Load asset
// - Take snapshot
// - Compare snapshots

// Look for:
// - Retained objects
// - Detached DOM nodes
// - Large arrays/objects
// - Memory leaks

// Example leak:
// Object: THREE.Mesh
// Retained size: 45MB
// Retainer: oldWeapons array
// → Clear array after use
```

### Custom Performance Marks

```typescript
// Mark critical paths
function generateAsset(config) {
  performance.mark('asset-gen-start')

  // Generate 3D model
  performance.mark('model-gen-start')
  const model = await generateModel(config)
  performance.mark('model-gen-end')

  // Apply textures
  performance.mark('texture-gen-start')
  await applyTextures(model, config)
  performance.mark('texture-gen-end')

  performance.mark('asset-gen-end')

  // Measure
  performance.measure('model-generation', 'model-gen-start', 'model-gen-end')
  performance.measure('texture-generation', 'texture-gen-start', 'texture-gen-end')
  performance.measure('total-generation', 'asset-gen-start', 'asset-gen-end')

  // Log results
  const measures = performance.getEntriesByType('measure')
  console.table(measures.map(m => ({
    name: m.name,
    duration: `${m.duration.toFixed(2)}ms`
  })))
}
```

## Custom Debug Visualizations

### Debug Overlays

```typescript
// Create debug overlay
function createDebugOverlay() {
  const overlay = document.createElement('div')
  overlay.id = 'debug-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #00ff00;
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
  `
  document.body.appendChild(overlay)

  // Update every frame
  function update() {
    const stats = {
      FPS: Math.round(1000 / lastFrameTime),
      Objects: scene.children.length,
      Triangles: renderer.info.render.triangles,
      Calls: renderer.info.render.calls,
      Memory: `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)}MB`
    }

    overlay.innerHTML = Object.entries(stats)
      .map(([key, value]) => `${key}: ${value}`)
      .join('<br>')

    requestAnimationFrame(update)
  }

  update()
}
```

### Wireframe Mode

```typescript
// Toggle wireframe rendering
function toggleWireframe() {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.material.wireframe = !object.material.wireframe
    }
  })
}

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
  if (e.key === 'w') toggleWireframe()
})
```

## Logging Strategies

### Structured Logging

```typescript
class Logger {
  private context: string

  constructor(context: string) {
    this.context = context
  }

  debug(message: string, data?: any) {
    console.log(`[${this.context}] ${message}`, data || '')
  }

  info(message: string, data?: any) {
    console.info(`[${this.context}] ${message}`, data || '')
  }

  warn(message: string, data?: any) {
    console.warn(`[${this.context}] ${message}`, data || '')
  }

  error(message: string, error?: Error | any) {
    console.error(`[${this.context}] ${message}`, error)

    // Send to error tracking service
    if (error instanceof Error) {
      this.reportError(error, message)
    }
  }

  private reportError(error: Error, context: string) {
    // Send to Sentry, LogRocket, etc.
    if (window.errorTracking) {
      window.errorTracking.captureException(error, {
        tags: { context: this.context },
        extra: { message: context }
      })
    }
  }
}

// Usage
const logger = new Logger('AssetService')
logger.info('Loading asset', { assetId: '123' })
logger.error('Failed to load asset', new Error('Network timeout'))
```

### Debug Flags

```typescript
// Environment-based debugging
const DEBUG = {
  api: process.env.DEBUG_API === 'true',
  rendering: process.env.DEBUG_RENDERING === 'true',
  performance: process.env.DEBUG_PERFORMANCE === 'true',
  all: process.env.DEBUG === 'true'
}

// Conditional logging
function loadAsset(id: string) {
  if (DEBUG.api || DEBUG.all) {
    console.log('[API] Loading asset:', id)
  }

  // ... load asset ...

  if (DEBUG.rendering || DEBUG.all) {
    console.log('[Render] Asset vertices:', model.geometry.attributes.position.count)
  }
}
```

## Conclusion

Effective debugging is essential for 3D development. Use browser DevTools for general debugging, React/Redux DevTools for state management, Three.js helpers for 3D visualization, and custom overlays for real-time monitoring. Combined with structured logging and performance profiling, these tools enable rapid issue identification and resolution.

**Key Takeaways:**
- Use console groups for organized logging
- Enable React/Redux DevTools for state debugging
- Add Three.js helpers for 3D visualization
- Profile performance regularly
- Create custom debug overlays for monitoring
- Implement structured logging with context
