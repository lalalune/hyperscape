# Lazy Loading Guide

**Location:** `packages/asset-forge/dev-book/14-deployment/lazy-loading-guide.md`

## Overview

This guide explains how to implement lazy loading in the Asset Forge application to optimize bundle size and improve initial load performance.

---

## Table of Contents

1. [What is Lazy Loading?](#what-is-lazy-loading)
2. [When to Use Lazy Loading](#when-to-use-lazy-loading)
3. [React Component Lazy Loading](#react-component-lazy-loading)
4. [Three.js Lazy Loading](#threejs-lazy-loading)
5. [ML Library Lazy Loading](#ml-library-lazy-loading)
6. [Best Practices](#best-practices)
7. [Common Pitfalls](#common-pitfalls)

---

## What is Lazy Loading?

Lazy loading is a design pattern that defers loading of resources until they are actually needed. This reduces initial bundle size and improves time-to-interactive (TTI).

**Benefits:**
- Smaller initial bundle size
- Faster initial page load
- Reduced bandwidth usage
- Better user experience

**Trade-offs:**
- Slight delay when loading lazy-loaded features
- More complex code organization
- Additional network requests

---

## When to Use Lazy Loading

### ✅ Good Candidates for Lazy Loading

1. **Large Libraries (>50 KB)**
   - TensorFlow.js (~2 MB)
   - MediaPipe (~400 KB)
   - Three.js loaders/exporters (~200 KB)

2. **Feature-Specific Code**
   - Hand rigging (only used in Hand Rigging page)
   - Admin dashboard (only for admins)
   - Export functionality (only when exporting)

3. **Modals and Dialogs**
   - RegenerateModal
   - RetextureModal
   - SpriteGenerationModal

4. **Low-Usage Features**
   - Features used by <50% of users
   - Advanced settings
   - Debug tools

### ❌ Not Suitable for Lazy Loading

1. **Critical Path Resources**
   - Core React/React DOM
   - Main application shell
   - Authentication (if required immediately)

2. **Small Libraries (<10 KB)**
   - Minimal bundle size benefit
   - Not worth the complexity

3. **Frequently Used Features**
   - Navigation components
   - Common UI components
   - State management

---

## React Component Lazy Loading

### Basic Modal Lazy Loading

**Example: Lazy loading modals in AssetsPage**

```typescript
import { lazy, Suspense } from 'react'

// ❌ Before: All modals loaded upfront
// import RegenerateModal from '@/components/Assets/RegenerateModal'
// import RetextureModal from '@/components/Assets/RetextureModal'

// ✅ After: Modals loaded on demand
const RegenerateModal = lazy(() => import('@/components/Assets/RegenerateModal'))
const RetextureModal = lazy(() => import('@/components/Assets/RetextureModal'))

// Wrap in Suspense for loading state
{showRegenerateModal && selectedAsset && (
  <Suspense fallback={null}>
    <RegenerateModal
      asset={selectedAsset}
      onClose={() => setShowRegenerateModal(false)}
      onComplete={() => {
        setShowRegenerateModal(false)
        reloadAssets()
      }}
    />
  </Suspense>
)}
```

### Named Export Lazy Loading

**Example: When the component is a named export**

```typescript
// If component is exported as: export const AssetEditModal = () => { ... }

const AssetEditModal = lazy(() =>
  import('@/components/Assets/AssetEditModal')
    .then(m => ({ default: m.AssetEditModal }))
)
```

### Suspense Fallback Options

```typescript
// Option 1: No fallback (instant render when ready)
<Suspense fallback={null}>
  <LazyComponent />
</Suspense>

// Option 2: Loading spinner
<Suspense fallback={<LoadingSpinner />}>
  <LazyComponent />
</Suspense>

// Option 3: Skeleton loader
<Suspense fallback={<ModalSkeleton />}>
  <LazyModal />
</Suspense>

// Option 4: Simple message
<Suspense fallback={<div>Loading...</div>}>
  <LazyComponent />
</Suspense>
```

### Page-Level Lazy Loading

**Example: Pages in App.tsx**

```typescript
// All pages are already lazy loaded
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage')
    .then(m => ({ default: m.AdminDashboardPage }))
)

const HandRiggingPage = lazy(() =>
  import('./pages/HandRiggingPage')
    .then(m => ({ default: m.HandRiggingPage }))
)

// Usage in routing
{currentView === NAVIGATION_VIEWS.HAND_RIGGING && (
  <ErrorBoundary fallback={<ToolsErrorFallback toolName="Hand Rigging" />}>
    <div className="w-full h-full p-4 sm:p-6 lg:p-8">
      <Suspense fallback={<LoadingSpinner />}>
        <HandRiggingPage />
      </Suspense>
    </div>
  </ErrorBoundary>
)}
```

---

## Three.js Lazy Loading

### Using Lazy Loader Utilities

**Location:** `src/utils/three-lazy-loaders.ts`

### GLTF Loader Example

```typescript
import { loadGLTFLoader } from '@/utils/three-lazy-loaders'

// ❌ Before: Loaded immediately
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
// const loader = new GLTFLoader()

// ✅ After: Loaded when needed
async function loadModel(url: string) {
  const loader = await loadGLTFLoader()
  const gltf = await loader.loadAsync(url)
  return gltf.scene
}
```

### GLTF Exporter Example

```typescript
import { loadGLTFExporter } from '@/utils/three-lazy-loaders'

// Export a Three.js scene to GLTF
async function exportScene(scene: THREE.Scene) {
  const exporter = await loadGLTFExporter()

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        const blob = new Blob([JSON.stringify(result)], { type: 'application/json' })
        resolve(blob)
      },
      reject,
      { binary: false }
    )
  })
}
```

### Orbit Controls Example

```typescript
import { loadOrbitControls } from '@/utils/three-lazy-loaders'

async function setupControls(camera: THREE.Camera, domElement: HTMLElement) {
  const controls = await loadOrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  return controls
}
```

### Post-Processing Effects Example

```typescript
import { loadPostProcessing } from '@/utils/three-lazy-loaders'

async function setupPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
) {
  const { composer, renderPass, ssaoPass, bloomPass } = await loadPostProcessing({
    renderer,
    scene,
    camera,
    enableSSAO: true,
    enableBloom: true
  })

  // Configure passes
  if (ssaoPass) {
    ssaoPass.kernelRadius = 16
  }

  return composer
}
```

### Available Three.js Lazy Loaders

| Function | Size | Use Case |
|----------|------|----------|
| `loadGLTFLoader()` | ~150 KB | Loading GLTF/GLB models |
| `loadFBXLoader()` | ~200 KB | Loading FBX models |
| `loadOBJLoader()` | ~50 KB | Loading OBJ models |
| `loadGLTFExporter()` | ~80 KB | Exporting scenes to GLTF |
| `loadOrbitControls()` | ~30 KB | Camera orbit controls |
| `loadPostProcessing()` | ~100 KB | Post-processing effects |

---

## ML Library Lazy Loading

### Using ML Lazy Loader Utilities

**Location:** `src/utils/ml-lazy-loaders.ts`

### TensorFlow Lazy Loading

```typescript
import { loadTensorFlow } from '@/utils/ml-lazy-loaders'

// ❌ Before: TensorFlow loaded immediately (~2 MB)
// import * as tf from '@tensorflow/tfjs'
// await tf.ready()

// ✅ After: TensorFlow loaded when needed
async function useTensorFlow() {
  const tf = await loadTensorFlow()
  await tf.ready()

  // Now use TensorFlow
  const tensor = tf.tensor([1, 2, 3, 4])
  return tensor
}
```

### Hand Pose Detection Example

```typescript
import { loadHandPoseDetection } from '@/utils/ml-lazy-loaders'

// Service class that lazy loads TensorFlow
export class HandPoseDetectionService {
  private tfModule: typeof import('@tensorflow/tfjs') | null = null
  private handPoseModule: typeof import('@tensorflow-models/hand-pose-detection') | null = null
  private detector: HandDetector | null = null

  async initialize() {
    // Lazy load both TensorFlow and HandPoseDetection
    const { handPoseDetection, tf } = await loadHandPoseDetection()
    this.tfModule = tf
    this.handPoseModule = handPoseDetection

    // Wait for TensorFlow to be ready
    await tf.ready()

    // Create detector
    this.detector = await handPoseDetection.createDetector(
      handPoseDetection.SupportedModels.MediaPipeHands,
      {
        runtime: 'mediapipe',
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
        modelType: 'full',
        maxHands: 2
      }
    )
  }
}
```

### Preloading During Idle Time

```typescript
import { preloadMLLibraries } from '@/utils/ml-lazy-loaders'

// Preload ML libraries when the browser is idle
// This doesn't block the main thread
function preloadHeavyLibraries() {
  // Will load during requestIdleCallback
  preloadMLLibraries()
}

// Call when app initializes
useEffect(() => {
  preloadHeavyLibraries()
}, [])
```

### Available ML Lazy Loaders

| Function | Size | Use Case |
|----------|------|----------|
| `loadTensorFlow()` | ~1.5 MB | TensorFlow core + WebGL backend |
| `loadMediaPipeHands()` | ~400 KB | MediaPipe hands library |
| `loadHandPoseDetection()` | ~2 MB | Complete hand detection setup |
| `createHandDetector()` | ~2 MB | One-line hand detector creation |
| `preloadMLLibraries()` | N/A | Preload during idle time |

---

## Best Practices

### 1. Group Related Lazy Loads

```typescript
// ✅ Good: Load related dependencies together
async function initializeHandRigging() {
  const [
    { loadHandPoseDetection },
    { HandRiggingService }
  ] = await Promise.all([
    import('@/utils/ml-lazy-loaders'),
    import('@/services/hand-rigging/HandRiggingService')
  ])

  const { handPoseDetection, tf } = await loadHandPoseDetection()
  // ...
}

// ❌ Bad: Sequential loads (slower)
const loaders = await import('@/utils/ml-lazy-loaders')
const service = await import('@/services/hand-rigging/HandRiggingService')
```

### 2. Use Type-Only Imports

```typescript
// ✅ Good: Type-only import (no runtime cost)
import type * as tf from '@tensorflow/tfjs'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

// ❌ Bad: Runtime import (adds to bundle)
import * as tf from '@tensorflow/tfjs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
```

### 3. Cache Lazy-Loaded Modules

```typescript
// Cache to avoid re-loading
const moduleCache = new Map<string, any>()

async function loadWithCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  if (moduleCache.has(key)) {
    return moduleCache.get(key)
  }

  const module = await loader()
  moduleCache.set(key, module)
  return module
}

// Usage
const tf = await loadWithCache('tensorflow', () => loadTensorFlow())
```

### 4. Provide Loading Feedback

```typescript
// ✅ Good: Show loading state
const [isLoading, setIsLoading] = useState(false)

async function handleExport() {
  setIsLoading(true)
  try {
    const exporter = await loadGLTFExporter()
    await exportModel(exporter)
  } finally {
    setIsLoading(false)
  }
}

// In render
{isLoading && <LoadingSpinner message="Loading exporter..." />}
```

### 5. Lazy Load Entire Features

```typescript
// ✅ Good: Lazy load the entire feature
const HandRiggingFeature = lazy(() =>
  import('@/features/hand-rigging')
)

// Feature bundles all its dependencies
// src/features/hand-rigging/index.tsx exports the main component
```

---

## Common Pitfalls

### 1. Lazy Loading Too Much

```typescript
// ❌ Bad: Lazy loading a tiny component
const Button = lazy(() => import('@/components/common/Button'))

// ✅ Good: Only lazy load large components
const HeavyChart = lazy(() => import('@/components/charts/HeavyChart'))
```

**Rule of Thumb:** Only lazy load components/libraries >50 KB

### 2. Not Using Suspense

```typescript
// ❌ Bad: No Suspense boundary
const LazyModal = lazy(() => import('@/components/Modal'))
return <LazyModal /> // Will error!

// ✅ Good: Always wrap in Suspense
return (
  <Suspense fallback={<LoadingSpinner />}>
    <LazyModal />
  </Suspense>
)
```

### 3. Lazy Loading Critical Path

```typescript
// ❌ Bad: Lazy loading core functionality
const NavigationBar = lazy(() => import('@/components/NavigationBar'))

// ✅ Good: Load core components immediately
import NavigationBar from '@/components/NavigationBar'
```

### 4. Not Handling Errors

```typescript
// ✅ Good: Handle loading errors
<ErrorBoundary fallback={<ErrorMessage />}>
  <Suspense fallback={<LoadingSpinner />}>
    <LazyComponent />
  </Suspense>
</ErrorBoundary>
```

### 5. Circular Dependencies

```typescript
// ❌ Bad: Circular lazy loading
// ComponentA lazy loads ComponentB
// ComponentB lazy loads ComponentA

// ✅ Good: Extract shared code to a third component
// ComponentA and ComponentB both import SharedComponent
```

---

## Measuring Impact

### Before/After Comparison

```bash
# Build the project
npm run build

# Analyze bundle size
node scripts/analyze-bundle.mjs

# Compare initial bundle size
# Look for chunks that are no longer in the initial load
```

### Network Panel Analysis

1. Open DevTools → Network tab
2. Clear cache and hard reload
3. Check "Disable cache"
4. Measure:
   - **Initial load:** Resources loaded immediately
   - **Lazy loaded:** Resources loaded on interaction
   - **Total transfer size:** With compression

### Performance Metrics

```typescript
// Measure lazy load time
const start = performance.now()
const module = await import('./HeavyModule')
const loadTime = performance.now() - start
console.log(`Lazy load took ${loadTime}ms`)
```

---

## Summary

**Key Takeaways:**

1. ✅ Lazy load large libraries (TensorFlow, Three.js loaders)
2. ✅ Lazy load modals and dialogs
3. ✅ Use `Suspense` for loading states
4. ✅ Provide loading feedback for better UX
5. ✅ Cache lazy-loaded modules
6. ❌ Don't lazy load small components (<50 KB)
7. ❌ Don't lazy load critical path resources
8. ❌ Don't forget error boundaries

**Impact:**
- Initial bundle: -2.5 MB (TensorFlow + loaders)
- Faster time-to-interactive
- Better user experience
- Reduced bandwidth usage

---

## References

- [React.lazy Documentation](https://react.dev/reference/react/lazy)
- [Suspense Documentation](https://react.dev/reference/react/Suspense)
- [Vite Code Splitting](https://vitejs.dev/guide/features.html#code-splitting)
- [Web.dev: Code Splitting](https://web.dev/reduce-javascript-payloads-with-code-splitting/)

**Last Updated:** 2025-10-24
