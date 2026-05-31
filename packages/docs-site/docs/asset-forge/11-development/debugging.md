# Debugging Guide

This comprehensive guide covers debugging techniques, tools, and best practices for Asset Forge development, from browser DevTools to performance profiling.

## Table of Contents

- [Browser DevTools](#browser-devtools)
- [Redux DevTools for Zustand](#redux-devtools-for-zustand)
- [Three.js Debugging](#threejs-debugging)
- [Backend Debugging](#backend-debugging)
- [Pipeline Debugging](#pipeline-debugging)
- [API Debugging](#api-debugging)
- [Performance Profiling](#performance-profiling)
- [Memory Leak Detection](#memory-leak-detection)
- [Common Debugging Scenarios](#common-debugging-scenarios)
- [Debug Utilities](#debug-utilities)

## Browser DevTools

Modern browser DevTools are your primary debugging interface.

### Console Tab

**Basic Console Usage:**

```typescript
// Strategic logging
console.log('Asset loaded:', asset)
console.log('Selected materials:', selectedMaterials)

// Formatted output
console.table(assets)  // Display array as table

// Grouped logs
console.group('Generation Pipeline')
console.log('Stage 1: Image generation')
console.log('Stage 2: 3D conversion')
console.groupEnd()

// Conditional logging
if (process.env.NODE_ENV === 'development') {
  console.debug('Debug info:', debugData)
}

// Timing operations
console.time('asset-load')
await loadAsset(id)
console.timeEnd('asset-load')  // Outputs: "asset-load: 234.56ms"
```

**Advanced Console Tricks:**

```javascript
// Monitor function calls
monitor(functionName)  // Logs every time function is called
unmonitor(functionName)

// Copy to clipboard
copy(complexObject)  // Copies JSON to clipboard

// Get event listeners
getEventListeners(document.querySelector('#button'))

// Monitor DOM changes
const element = document.querySelector('#asset-list')
monitorEvents(element, 'mouse')  // Logs all mouse events

// Inspect object properties
dir(object)  // Shows interactive property inspector

// Show call stack
console.trace('Execution path')
```

### Network Tab

**Debugging API Requests:**

1. Open DevTools (F12) → Network tab
2. Filter by type: XHR, Fetch, All
3. Click request to see details

**What to Check:**

```
Request:
- URL: http://localhost:3004/api/assets
- Method: GET
- Headers: Content-Type, Authorization
- Payload: (for POST/PUT)

Response:
- Status: 200 OK (or error code)
- Headers: Content-Type, Cache-Control
- Body: JSON response data
- Time: Request duration

Timing:
- Queueing: Time before request sent
- Waiting (TTFB): Time to first byte
- Content Download: Response download time
```

**Common Issues:**

```
404 Not Found
→ Check URL spelling and route configuration

CORS Error
→ Verify backend CORS headers and Vite proxy

500 Internal Server Error
→ Check backend console for error details

Network Error
→ Backend not running, wrong port, or firewall issue
```

**Network Throttling:**

```
1. Open Network tab
2. Select throttling preset:
   - Fast 3G (simulate mobile)
   - Slow 3G (test slow connections)
   - Offline (test offline behavior)
3. Test asset loading, generation pipeline
```

### Sources Tab

**Breakpoint Debugging:**

1. Open Sources tab
2. Navigate to file: `src/components/AssetCard.tsx`
3. Click line number to set breakpoint
4. Trigger code execution
5. Debugger pauses at breakpoint

**Breakpoint Types:**

```javascript
// Line breakpoints - click line number

// Conditional breakpoints - right-click line number
// Condition: asset.id === 'test-asset'

// Logpoint - right-click line number
// Log message: 'Asset:', asset.name

// DOM breakpoints - right-click element in Elements tab
// - Break on: subtree modifications
// - Break on: attribute modifications
// - Break on: node removal
```

**Debugger Controls:**

```
Resume (F8) - Continue execution
Step Over (F10) - Execute current line, don't enter functions
Step Into (F11) - Enter function call
Step Out (Shift+F11) - Exit current function
```

**Call Stack Inspection:**

```
When paused:
1. View call stack (right panel)
2. Click frames to inspect state at each level
3. Hover over variables to see values
4. Use Console to evaluate expressions in current scope
```

### React DevTools

**Component Tree:**

```
1. Open React DevTools tab
2. Select component in tree
3. Inspect props and state

Example: <AssetCard>
  Props:
    asset: { id: '123', name: 'Sword' }
    onSelect: function()

  State: (from hooks)
    isHovered: false

  Hooks:
    useState(false) → isHovered
    useEffect() → load metadata
```

**Component Profiler:**

```
1. Click "Profiler" tab
2. Start recording
3. Perform actions (e.g., load assets)
4. Stop recording
5. Analyze render times

Look for:
- Slow components (yellow/red)
- Unnecessary re-renders
- Render duration > 16ms (causes frame drops)
```

**Component Search:**

```
Cmd/Ctrl + F in Components tab:
- Search by name: "AssetCard"
- Search by prop: "onSelect"
- Search by hook: "useState"
```

### Elements Tab

**DOM Inspection:**

```
1. Right-click element → Inspect
2. View HTML structure
3. Edit attributes/content live
4. View computed styles

Useful for:
- CSS debugging
- Layout issues
- Finding element selectors
- Testing style changes
```

**CSS Debugging:**

```
Styles panel shows:
- Applied styles (blue)
- Overridden styles (strikethrough)
- Inherited styles (lighter)
- Computed values

Tips:
- Toggle checkboxes to disable rules
- Edit values in real-time
- Add new properties
- View box model (margins, padding, borders)
```

## Redux DevTools for Zustand

Asset Forge uses Zustand with Redux DevTools middleware.

### Setup Verification

**Check DevTools Integration:**

```typescript
// In store definition (e.g., useGenerationStore.ts)
export const useGenerationStore = create<GenerationState>()(
  devtools(  // ← DevTools middleware
    persist(
      immer((set, get) => ({
        // Store implementation
      }))
    ),
    { name: 'GenerationStore' }  // ← Store name in DevTools
  )
)
```

### Using Redux DevTools

**1. Access DevTools**

Install Redux DevTools browser extension, then:
- Open browser DevTools
- Select "Redux" tab
- Choose store from dropdown

**2. State Inspector**

```
View current state tree:

GenerationStore
├── generationType: "item"
├── assetType: "weapon"
├── assetName: "Bronze Sword"
├── selectedMaterials: ["bronze", "steel", "mithril"]
├── isGenerating: false
└── pipelineStages: [...]

Click any property to inspect details
```

**3. Action Log**

```
Every state change is logged:

@ setAssetType → "weapon"
  prev state: { assetType: "armor" }
  action: setAssetType("weapon")
  next state: { assetType: "weapon" }

@ toggleMaterialSelection → "mithril"
  prev state: { selectedMaterials: ["bronze", "steel"] }
  action: toggleMaterialSelection("mithril")
  next state: { selectedMaterials: ["bronze", "steel", "mithril"] }
```

**4. Time-Travel Debugging**

```
Slider at bottom of DevTools:
- Drag to any point in action history
- App state updates to that point
- Test different state combinations
- Reproduce bugs by replaying actions

Example workflow:
1. Generate asset → error occurs
2. Drag slider back to before generation
3. Inspect state at each step
4. Identify problematic state change
```

**5. Export/Import State**

```javascript
// Export current state (for bug reports)
const state = useGenerationStore.getState()
console.log(JSON.stringify(state, null, 2))

// Or use DevTools export button

// Import state (to reproduce bugs)
// Paste JSON in import dialog
```

### Debugging State Issues

**Common Patterns:**

```typescript
// 1. State not updating
// Check: Is action being called?
const setAssetName = useGenerationStore(state => state.setAssetName)

// Add logging
const handleChange = (name: string) => {
  console.log('Setting asset name:', name)
  setAssetName(name)
}

// 2. Component not re-rendering
// Check: Selector returns new reference?

// Bad - creates new array every time
const materials = useGenerationStore(state =>
  state.materialPresets.filter(m => m.tier === 1)
)

// Good - use useMemo or selector that checks equality
const materials = useGenerationStore(
  state => state.materialPresets.filter(m => m.tier === 1),
  shallow  // shallow equality check
)

// 3. Stale state in callbacks
// Check: Dependencies in useCallback

const handleExport = useCallback(() => {
  // This sees old selectedAssets
  console.log(selectedAssets)
}, [])  // Missing dependency!

// Fix
const handleExport = useCallback(() => {
  console.log(selectedAssets)
}, [selectedAssets])  // Include dependency
```

## Three.js Debugging

Debugging 3D graphics requires specialized techniques.

### Scene Helpers

**Add visual debugging aids:**

```typescript
import * as THREE from 'three'

// Axes helper (RGB = XYZ)
const axesHelper = new THREE.AxesHelper(5)  // 5 unit axes
scene.add(axesHelper)

// Grid helper
const gridHelper = new THREE.GridHelper(10, 10)  // 10x10 grid
scene.add(gridHelper)

// Box helper (bounding box)
const boxHelper = new THREE.BoxHelper(mesh, 0xffff00)
scene.add(boxHelper)

// Camera helper
const cameraHelper = new THREE.CameraHelper(camera)
scene.add(cameraHelper)

// Directional light helper
const lightHelper = new THREE.DirectionalLightHelper(light, 5)
scene.add(lightHelper)
```

### Stats Monitor

**Display real-time performance stats:**

```typescript
import Stats from 'three/examples/jsm/libs/stats.module'

// Setup stats
const stats = Stats()
stats.showPanel(0)  // 0: fps, 1: ms, 2: mb
document.body.appendChild(stats.dom)

// Update in render loop
function animate() {
  stats.begin()

  // Render scene
  renderer.render(scene, camera)

  stats.end()
  requestAnimationFrame(animate)
}
```

**Stats Panels:**

```
Panel 0: FPS (frames per second)
- 60 FPS = optimal
- 30-60 FPS = acceptable
- <30 FPS = performance issues

Panel 1: Frame Time (milliseconds)
- <16ms = 60 FPS
- 16-33ms = 30-60 FPS
- >33ms = <30 FPS

Panel 2: Memory (MB)
- Monitor for memory leaks
- Should be relatively stable
```

### Scene Inspector

**Inspect scene hierarchy:**

```typescript
// Log entire scene tree
console.log(scene)

// Traverse and log all objects
scene.traverse((object) => {
  console.log(object.name, object.type, object.position)
})

// Find specific objects
const weapons = []
scene.traverse((object) => {
  if (object.name.includes('weapon')) {
    weapons.push(object)
  }
})

// Check material properties
mesh.traverse((object) => {
  if (object instanceof THREE.Mesh) {
    console.log('Material:', object.material)
    console.log('Geometry:', object.geometry)
  }
})
```

### Common Three.js Issues

**1. Model Not Visible**

```typescript
// Debug checklist
console.log('Scene children:', scene.children.length)  // Should be > 0
console.log('Mesh position:', mesh.position)  // Check not at weird coords
console.log('Camera position:', camera.position)  // Check camera can see mesh
console.log('Mesh visible:', mesh.visible)  // Should be true
console.log('Material visible:', mesh.material.visible)  // Should be true

// Check bounding box
const bbox = new THREE.Box3().setFromObject(mesh)
console.log('Bounding box:', bbox)

// Ensure camera looks at object
camera.lookAt(mesh.position)
```

**2. Performance Issues**

```typescript
// Check polygon count
let totalVertices = 0
let totalFaces = 0

scene.traverse((object) => {
  if (object instanceof THREE.Mesh) {
    const geometry = object.geometry
    totalVertices += geometry.attributes.position.count
    totalFaces += geometry.index ? geometry.index.count / 3 : totalVertices / 3
  }
})

console.log('Total vertices:', totalVertices)
console.log('Total faces:', totalFaces)

// Guideline:
// < 100k vertices = good
// 100k-500k = acceptable
// > 500k = may cause issues
```

**3. Memory Leaks**

```typescript
// Proper cleanup
useEffect(() => {
  const geometry = new THREE.BoxGeometry()
  const material = new THREE.MeshStandardMaterial()
  const mesh = new THREE.Mesh(geometry, material)

  scene.add(mesh)

  // CLEANUP IS CRITICAL
  return () => {
    scene.remove(mesh)
    geometry.dispose()
    material.dispose()

    // Dispose textures
    if (material.map) material.map.dispose()
    if (material.normalMap) material.normalMap.dispose()
    // etc...
  }
}, [scene])
```

### Three.js Console Commands

**In browser console:**

```javascript
// Access Three.js objects via window (if exposed)
window.scene  // Scene object
window.camera  // Camera object
window.renderer  // Renderer object

// Inspect renderer info
renderer.info
// {
//   memory: { geometries: 12, textures: 8 },
//   render: { frame: 1234, calls: 45, triangles: 23456 }
// }

// Check WebGPU capabilities
renderer.capabilities
// {
//   maxTextures: 16,
//   maxVertexTextures: 16,
//   maxTextureSize: 16384,
//   ...
// }
```

## Backend Debugging

Debug the Express.js backend server.

### Server Logs

**Enhanced Logging:**

```javascript
// server/api.mjs

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})

// Log specific endpoints
app.post('/api/generation/pipeline', async (req, res) => {
  console.log('[Generation] Starting pipeline with config:', req.body)

  try {
    const result = await generationService.startPipeline(req.body)
    console.log('[Generation] Pipeline started:', result.id)
    res.json(result)
  } catch (error) {
    console.error('[Generation] Pipeline failed:', error)
    next(error)
  }
})
```

**Structured Logging:**

```javascript
// Create logger utility
class Logger {
  constructor(prefix) {
    this.prefix = prefix
  }

  info(message, data) {
    console.log(`[${this.prefix}] ${message}`, data || '')
  }

  error(message, error) {
    console.error(`[${this.prefix}] ERROR: ${message}`, error)
  }

  debug(message, data) {
    if (process.env.DEBUG) {
      console.debug(`[${this.prefix}] DEBUG: ${message}`, data || '')
    }
  }
}

// Usage
const logger = new Logger('AssetService')
logger.info('Loading asset', assetId)
logger.error('Failed to load asset', error)
```

### Node.js Inspector

**Start with Debugging:**

```bash
# Start backend with inspector
node --inspect server/api.mjs

# Or break on first line
node --inspect-brk server/api.mjs
```

**Attach Chrome DevTools:**

```
1. Open chrome://inspect in Chrome
2. Click "inspect" under Remote Target
3. DevTools opens with Node.js debugging
4. Set breakpoints, inspect variables
5. Step through code
```

**VS Code Debugging:**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "program": "${workspaceFolder}/server/api.mjs",
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

**Debugging Workflow:**

1. Set breakpoints in VS Code
2. Press F5 to start debugging
3. Make API request from frontend
4. Debugger pauses at breakpoint
5. Inspect variables, step through code

## Pipeline Debugging

Debug the asset generation pipeline.

### Enable Debug Mode

**Environment Variable:**

```bash
# In .env file
VITE_DEBUG_PIPELINE=true
```

**Check in Code:**

```typescript
// src/store/useGenerationStore.ts

updatePipelineStage: (stageId, status) => set((state) => {
  const DEBUG = (import.meta as any).env?.VITE_DEBUG_PIPELINE === 'true'

  if (DEBUG) {
    console.log('Updating pipeline stage:', stageId, 'to status:', status)
  }

  const stage = state.pipelineStages.find(s => s.id === stageId)
  if (stage) {
    stage.status = status
  } else if (DEBUG) {
    console.warn('Stage not found:', stageId)
  }
})
```

### Pipeline State Inspection

**Track Pipeline Progress:**

```typescript
// In generation page component
const pipelineStages = useGenerationStore(state => state.pipelineStages)

useEffect(() => {
  console.group('Pipeline Stages')
  pipelineStages.forEach(stage => {
    console.log(`${stage.name}: ${stage.status}`)
  })
  console.groupEnd()
}, [pipelineStages])
```

**API Client Events:**

```typescript
// src/services/api/GenerationAPIClient.ts

export class GenerationAPIClient extends TypedEventEmitter {
  async startPipeline(config: GenerationConfig): Promise<string> {
    console.log('[Pipeline] Starting with config:', config)

    const response = await fetch(`${this.apiUrl}/generation/pipeline`, {
      method: 'POST',
      body: JSON.stringify(config)
    })

    const result = await response.json()

    console.log('[Pipeline] Started:', result.id)
    this.emit('pipeline:started', { pipelineId: result.id })

    return result.id
  }

  private pollPipeline(pipelineId: string) {
    console.log('[Pipeline] Polling status for:', pipelineId)

    // Polling logic with logging
  }
}
```

### Common Pipeline Issues

**Issue: Pipeline Stuck**

```typescript
// Debug: Check last known state
const currentPipelineId = useGenerationStore(state => state.currentPipelineId)
const stages = useGenerationStore(state => state.pipelineStages)

console.log('Pipeline ID:', currentPipelineId)
console.log('Current stages:', stages)

// Check backend status
const status = await fetch(`/api/generation/pipeline/${currentPipelineId}`)
const data = await status.json()
console.log('Backend status:', data)
```

**Issue: Stages Not Updating**

```typescript
// Check event listeners
const apiClient = new GenerationAPIClient()

apiClient.on('progress', (event) => {
  console.log('Progress event:', event)
})

apiClient.on('statusChange', (event) => {
  console.log('Status change:', event)
})

apiClient.on('error', (event) => {
  console.error('Error event:', event)
})
```

## API Debugging

Debug API calls and responses.

### Postman / Insomnia

**Setup Collections:**

```json
{
  "name": "Asset Forge API",
  "requests": [
    {
      "name": "List Assets",
      "method": "GET",
      "url": "http://localhost:3004/api/assets"
    },
    {
      "name": "Get Asset",
      "method": "GET",
      "url": "http://localhost:3004/api/assets/:id"
    },
    {
      "name": "Start Pipeline",
      "method": "POST",
      "url": "http://localhost:3004/api/generation/pipeline",
      "body": {
        "name": "Test Sword",
        "type": "weapon",
        "subtype": "sword",
        "description": "A test weapon"
      }
    }
  ]
}
```

### cURL Commands

**Test Endpoints:**

```bash
# Health check
curl http://localhost:3004/api/health

# List assets
curl http://localhost:3004/api/assets

# Get specific asset
curl http://localhost:3004/api/assets/bronze-sword-001

# Start generation (POST with JSON)
curl -X POST http://localhost:3004/api/generation/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Sword",
    "type": "weapon",
    "subtype": "sword",
    "description": "A bronze sword"
  }'

# Retexture asset
curl -X POST http://localhost:3004/api/retexture \
  -H "Content-Type: application/json" \
  -d '{
    "baseAssetId": "sword-base",
    "materialPreset": {
      "id": "steel",
      "stylePrompt": "made of steel"
    }
  }'
```

### Network Mocking

**Mock API Responses (Testing):**

```typescript
// Mock fetch for testing
global.fetch = vi.fn((url: string) => {
  if (url.includes('/api/assets')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { id: '1', name: 'Sword' },
        { id: '2', name: 'Shield' }
      ])
    })
  }

  return Promise.reject(new Error('Unknown endpoint'))
})
```

## Performance Profiling

Identify and fix performance bottlenecks.

### Chrome Performance Tab

**Record Performance:**

```
1. Open DevTools → Performance tab
2. Click Record (circle icon)
3. Perform actions (load assets, generate model)
4. Click Stop
5. Analyze timeline
```

**What to Look For:**

```
Frames Section:
- Green bars = good frame rate
- Yellow/red bars = slow frames
- Look for long tasks (>50ms)

Main Thread:
- Function calls color-coded
- Click to see call stack
- Long yellow blocks = JavaScript execution
- Purple = rendering/painting

Bottom-Up Tab:
- Shows functions by total time
- Identify hotspots
- Optimize heavy functions
```

### React Profiler

**Profile Component Renders:**

```
1. Open React DevTools → Profiler
2. Click Record
3. Interact with app
4. Stop recording
5. View flame graph

Metrics:
- Render duration (ms)
- Number of renders
- Render reason (props change, state change, parent render)
```

**Optimize Slow Renders:**

```typescript
// Before: Slow component
function AssetList({ assets }: Props) {
  // Re-renders on every parent update
  const filtered = assets.filter(a => a.type === 'weapon')

  return (
    <div>
      {filtered.map(asset => <AssetCard key={asset.id} asset={asset} />)}
    </div>
  )
}

// After: Optimized with memoization
const AssetList = memo(function AssetList({ assets }: Props) {
  // Memoize filtered assets
  const filtered = useMemo(
    () => assets.filter(a => a.type === 'weapon'),
    [assets]
  )

  return (
    <div>
      {filtered.map(asset => <AssetCard key={asset.id} asset={asset} />)}
    </div>
  )
})
```

### Lighthouse Audits

**Run Lighthouse:**

```
1. Open DevTools → Lighthouse tab
2. Select categories:
   - Performance
   - Accessibility
   - Best Practices
3. Click "Analyze page load"
4. Review report

Key Metrics:
- First Contentful Paint (FCP): <1.8s
- Largest Contentful Paint (LCP): <2.5s
- Total Blocking Time (TBT): <200ms
- Cumulative Layout Shift (CLS): <0.1
```

## Memory Leak Detection

Prevent and identify memory leaks.

### Heap Snapshots

**Take Heap Snapshots:**

```
1. Open DevTools → Memory tab
2. Select "Heap snapshot"
3. Click "Take snapshot"
4. Perform actions
5. Take another snapshot
6. Compare snapshots

Look for:
- Increasing object counts
- Detached DOM nodes
- Event listener leaks
```

### Performance Monitor

**Real-Time Memory:**

```
1. Open DevTools → Performance Monitor
2. Check "JS heap size"
3. Perform actions
4. Watch memory usage

Indicators:
- Steady increase = memory leak
- Saw-tooth pattern = normal (GC cycles)
- Sudden spike = large allocation
```

### Common Leak Patterns

**1. Event Listener Leak:**

```typescript
// Bad
useEffect(() => {
  window.addEventListener('resize', handleResize)
  // Missing cleanup!
}, [])

// Good
useEffect(() => {
  window.addEventListener('resize', handleResize)

  return () => {
    window.removeEventListener('resize', handleResize)
  }
}, [handleResize])
```

**2. Three.js Resource Leak:**

```typescript
// Bad
function Scene() {
  const geometry = new THREE.BoxGeometry()
  const material = new THREE.MeshBasicMaterial()

  // Resources never disposed!

  return <primitive object={new THREE.Mesh(geometry, material)} />
}

// Good
function Scene() {
  useEffect(() => {
    const geometry = new THREE.BoxGeometry()
    const material = new THREE.MeshBasicMaterial()
    const mesh = new THREE.Mesh(geometry, material)

    scene.add(mesh)

    return () => {
      scene.remove(mesh)
      geometry.dispose()
      material.dispose()
    }
  }, [scene])

  return null
}
```

**3. Closure Leak:**

```typescript
// Bad
function Component() {
  const largeArray = new Array(1000000)

  const handleClick = () => {
    // Closure captures largeArray forever
    console.log(largeArray.length)
  }

  return <button onClick={handleClick}>Click</button>
}

// Good
function Component() {
  const largeArray = new Array(1000000)
  const arrayLength = largeArray.length  // Capture only what you need

  const handleClick = () => {
    console.log(arrayLength)  // Doesn't hold reference to entire array
  }

  return <button onClick={handleClick}>Click</button>
}
```

## Common Debugging Scenarios

### Scenario 1: Asset Not Loading

**Symptom:** Asset doesn't appear in viewer

**Debug Steps:**

```typescript
// 1. Check network request
// Open Network tab, look for asset request
// Should see: GET /api/assets/:id/model → 200 OK

// 2. Check console for errors
console.error('...')  // Look for any error messages

// 3. Verify asset data
const asset = useAssetsStore(state =>
  state.assets.find(a => a.id === selectedId)
)
console.log('Asset data:', asset)

// 4. Check Three.js scene
useEffect(() => {
  if (!asset?.modelUrl) return

  console.log('Loading model from:', asset.modelUrl)

  loader.load(
    asset.modelUrl,
    (gltf) => {
      console.log('Model loaded:', gltf)
      console.log('Scene children:', gltf.scene.children)
      scene.add(gltf.scene)
    },
    (progress) => {
      console.log('Loading progress:', progress)
    },
    (error) => {
      console.error('Load error:', error)
    }
  )
}, [asset])
```

### Scenario 2: Generation Pipeline Fails

**Symptom:** Pipeline starts but fails mid-way

**Debug Steps:**

```typescript
// 1. Check pipeline state
const pipelineId = useGenerationStore(state => state.currentPipelineId)
const stages = useGenerationStore(state => state.pipelineStages)

console.log('Pipeline ID:', pipelineId)
console.table(stages)

// 2. Check backend status
const response = await fetch(`/api/generation/pipeline/${pipelineId}`)
const status = await response.json()
console.log('Backend status:', status)

// 3. Check error state
if (status.status === 'failed') {
  console.error('Pipeline error:', status.error)
  console.error('Failed stage:', status.stages)
}

// 4. Check backend logs
// In backend terminal, look for error messages
```

### Scenario 3: Performance Degradation

**Symptom:** App becomes slow after using for a while

**Debug Steps:**

```typescript
// 1. Check FPS
// Add stats monitor (see Three.js Debugging section)
// FPS dropping over time = memory leak

// 2. Check memory
// Performance Monitor → JS heap size
// Steadily increasing = leak

// 3. Take heap snapshots
// Memory tab → Heap snapshot before and after actions
// Compare to find leaking objects

// 4. Check Three.js resources
console.log(renderer.info)
// {
//   memory: { geometries: 120, textures: 95 },
//   ...
// }
// Numbers increasing = resources not disposed

// 5. Verify cleanup
// Add logging to useEffect cleanup
useEffect(() => {
  // ... setup

  return () => {
    console.log('Cleanup running')  // Should see on unmount
    // dispose resources
  }
}, [])
```

## Debug Utilities

Helpful utilities for debugging.

### Debug Panel Component

**Create Reusable Debug Panel:**

```typescript
// src/components/debug/DebugPanel.tsx

export function DebugPanel() {
  const generationState = useGenerationStore()
  const assetsState = useAssetsStore()

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md max-h-96 overflow-auto">
      <h3 className="font-bold mb-2">Debug Panel</h3>

      <details>
        <summary>Generation State</summary>
        <pre>{JSON.stringify(generationState, null, 2)}</pre>
      </details>

      <details>
        <summary>Assets State</summary>
        <pre>{JSON.stringify(assetsState, null, 2)}</pre>
      </details>

      <details>
        <summary>Environment</summary>
        <pre>{JSON.stringify(import.meta.env, null, 2)}</pre>
      </details>
    </div>
  )
}
```

### Logger Utility

**Conditional Logging:**

```typescript
// src/utils/logger.ts

class Logger {
  private enabled: boolean

  constructor() {
    this.enabled = import.meta.env.DEV
  }

  log(...args: any[]) {
    if (this.enabled) {
      console.log('[APP]', ...args)
    }
  }

  error(...args: any[]) {
    if (this.enabled) {
      console.error('[APP]', ...args)
    }
  }

  group(label: string) {
    if (this.enabled) {
      console.group(label)
    }
  }

  groupEnd() {
    if (this.enabled) {
      console.groupEnd()
    }
  }
}

export const logger = new Logger()

// Usage
import { logger } from '@/utils/logger'

logger.log('Asset loaded:', asset)
logger.error('Failed to load:', error)
```

By mastering these debugging techniques, you'll be able to quickly identify and fix issues in Asset Forge, from simple UI bugs to complex Three.js memory leaks and performance problems.
