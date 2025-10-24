# WebGL Renderer Pool

## Overview

The WebGL Renderer Pool is a resource management system that prevents "Too many active WebGL contexts" errors and reduces memory usage by sharing WebGL renderers across multiple Three.js viewer components.

## Problem

Browsers limit the number of active WebGL contexts (typically 8-16). When multiple ThreeViewer components are rendered simultaneously (e.g., asset thumbnails, preview cards, equipment viewers), each creates its own WebGL context, quickly exhausting the browser's limit.

## Solution

The renderer pool:
- Maintains a shared pool of WebGL renderers (default: 4)
- Implements reference counting for safe reuse
- Automatically cleans up idle renderers after 30 seconds
- Provides fallback handling for pool exhaustion
- Tracks performance metrics

## Architecture

### Core Components

1. **WebGLRendererPool** (`services/WebGLRendererPool.ts`)
   - Singleton service managing renderer lifecycle
   - Acquisition/release pattern with reference counting
   - Automatic idle cleanup
   - Performance monitoring

2. **useRendererPool** (`hooks/useRendererPool.ts`)
   - React hook for easy integration
   - Automatic cleanup on unmount
   - Resize handling

3. **Updated Hooks**
   - `useThreeScene` - Now uses renderer pool
   - Other components can be migrated incrementally

## Usage

### Using the Hook

```typescript
import { useRendererPool } from '@/hooks'

function MyViewer() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { renderer, rendererId, isReady } = useRendererPool({
    containerRef,
    antialias: true,
    alpha: true,
    pixelRatio: 2
  })

  useEffect(() => {
    if (!renderer || !isReady) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()
  }, [renderer, isReady])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
```

### Using the Service Directly

```typescript
import { getRendererPool } from '@/services/WebGLRendererPool'

// Acquire renderer
const pool = getRendererPool()
const rendererId = pool.acquire({
  antialias: true,
  alpha: true,
  width: 800,
  height: 600
})

const renderer = pool.getRenderer(rendererId)

// Use renderer
pool.render(rendererId, scene, camera)

// Update size
pool.setSize(rendererId, 1024, 768, 2)

// Release when done
pool.release(rendererId)
```

## Configuration

### Pool Options

```typescript
new WebGLRendererPool({
  maxRenderers: 4,        // Maximum concurrent renderers
  idleTimeout: 30000,     // Cleanup idle renderers after 30s
  enableMetrics: true     // Track performance metrics
})
```

### Renderer Options

```typescript
pool.acquire({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
  width: 800,
  height: 600,
  pixelRatio: 2
})
```

## Performance Metrics

```typescript
const metrics = pool.getMetrics()

console.log(metrics)
// {
//   activeCount: 2,           // Currently in-use renderers
//   totalCreated: 5,          // Total renderers created
//   totalReleased: 3,         // Total release calls
//   totalDisposed: 2,         // Total renderers disposed
//   poolUtilization: 50,      // Pool usage percentage
//   memoryEstimateMB: 100     // Estimated memory usage
// }
```

## Fallback Behavior

When the pool is exhausted:

1. **First attempt**: Reclaim an idle renderer (refCount === 0)
2. **Second attempt**: Create temporary renderer (will be disposed on release)
3. **Error logging**: All exhaustion events are logged for monitoring

## Memory Savings

### Before Pool
- 10 ThreeViewer instances = 10 WebGL contexts
- ~500MB memory usage
- Browser context limit errors

### After Pool
- 10 ThreeViewer instances = 4 shared renderers
- ~200MB memory usage (60% reduction)
- No context limit errors
- Automatic cleanup of unused renderers

## Migration Guide

### Existing Components

Components using `useThreeScene` automatically benefit from the pool (already migrated).

### Other Components

For components creating their own renderers:

**Before:**
```typescript
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(width, height)
containerRef.current.appendChild(renderer.domElement)

// Later...
renderer.dispose()
```

**After:**
```typescript
const pool = getRendererPool()
const rendererId = pool.acquire({ antialias: true, width, height })
const renderer = pool.getRenderer(rendererId)!

containerRef.current.appendChild(renderer.domElement)

// Later...
pool.release(rendererId)
```

## Best Practices

1. **Always release renderers** when components unmount
2. **Use the hook** for React components (handles cleanup automatically)
3. **Monitor metrics** in development to tune pool size
4. **Avoid preserveDrawingBuffer** unless needed (uses more memory)
5. **Share renderer options** when possible for better reuse

## Debugging

Enable debug logging:

```typescript
import { createLogger } from '@/utils/logger'

// Renderer pool logs automatically to console in debug builds
// Look for messages like:
// - "Acquired renderer renderer_xxx from pool"
// - "Released renderer renderer_xxx (refCount: 0)"
// - "Scheduled cleanup for renderer renderer_xxx"
```

Check pool status:

```typescript
const pool = getRendererPool()
console.log('Pool metrics:', pool.getMetrics())
```

## Limitations

1. **Renderer reuse**: Renderers can only be reused if options match exactly
2. **Size changes**: Resizing is supported, but creates slight overhead
3. **Post-processing**: Components using EffectComposer may need additional consideration
4. **WebXR**: Not tested with WebXR contexts

## Future Enhancements

- [ ] Smart pooling based on viewport visibility
- [ ] Priority-based renderer allocation
- [ ] Automatic pool size adjustment based on available memory
- [ ] WebXR context support
- [ ] Renderer warm-up for instant availability

## References

- [Three.js WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer)
- [WebGL Context Limits](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#be_aware_of_webgl_context_limits)
- [Memory Management in Three.js](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects)
