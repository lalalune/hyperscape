# Web Workers Module

This module provides Web Worker implementations for expensive mesh processing operations to prevent UI blocking.

## Overview

The workers module includes:

1. **MeshFittingWorker** - Performs mesh-to-mesh fitting calculations
2. **ArmorFittingWorker** - Performs shrinkwrap armor fitting algorithm
3. **AssetNormalizationWorker** - Performs asset normalization transformations
4. **WorkerPool** - Manages a pool of workers for parallel processing
5. **WorkerManager** - High-level API with automatic fallback support

## Architecture

```
┌─────────────────────┐
│  Service Layer      │
│  (Main Thread)      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  WorkerManager      │  ← High-level API
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  WorkerPool         │  ← Pool management
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Web Workers        │  ← Computation
│  (Background)       │
└─────────────────────┘
```

## Usage

### Basic Usage with WorkerManager

```typescript
import { getWorkerManager } from './workers'

// Get global worker manager instance
const workerManager = getWorkerManager()

// Fit mesh to target
const result = await workerManager.fitMeshToTarget(
  sourceMesh,
  targetMesh,
  {
    iterations: 10,
    stepSize: 0.5,
    targetOffset: 0.01,
    smoothingIterations: 3,
    smoothingFactor: 0.5,
  },
  (progress) => {
    console.log(`Progress: ${Math.round(progress * 100)}%`)
  }
)

// Update mesh with result
sourceMesh.geometry.attributes.position.array.set(result.positions)
sourceMesh.geometry.attributes.position.needsUpdate = true
```

### Armor Fitting

```typescript
const result = await workerManager.fitArmorToBody(
  armorMesh,
  bodyMesh,
  {
    iterations: 15,
    stepSize: 0.5,
    targetOffset: 0.02,
    preserveOpenings: true,
    armorType: 'chest',
  },
  (progress) => {
    console.log(`Fitting progress: ${Math.round(progress * 100)}%`)
  }
)

// Apply results
armorMesh.geometry.attributes.position.array.set(result.positions)
if (result.skinIndices && result.skinWeights) {
  // Transfer skin weights
  armorMesh.geometry.attributes.skinIndex.array.set(result.skinIndices)
  armorMesh.geometry.attributes.skinWeight.array.set(result.skinWeights)
}
```

### Asset Normalization

```typescript
const result = await workerManager.normalizeAsset(
  geometry,
  'character',
  undefined,
  { targetHeight: 1.83 },
  (progress) => {
    console.log(`Normalizing: ${Math.round(progress * 100)}%`)
  }
)

// Update geometry
geometry.attributes.position.array.set(result.positions)
if (result.normals) {
  geometry.attributes.normal.array.set(result.normals)
}
```

### Service Integration with Fallback

```typescript
import { executeWithWorkerOrFallback } from './workers/WorkerServiceAdapter'

async function processAsset(mesh: THREE.Mesh) {
  return executeWithWorkerOrFallback(
    'AssetProcessing',
    // Worker task
    async () => {
      const workerManager = getWorkerManager()
      return workerManager.normalizeAsset(mesh.geometry, 'character')
    },
    // Fallback task (main thread)
    async () => {
      // Use existing service method
      return this.existingNormalizationMethod(mesh)
    },
    {
      enabled: true,
      onProgress: (p) => console.log(`Progress: ${p * 100}%`),
    }
  )
}
```

### Performance Tracking

```typescript
import { getPerformanceTracker, getAllPerformanceStats } from './workers/WorkerServiceAdapter'

// Track performance
const tracker = getPerformanceTracker('MeshFitting')
tracker.recordWorker(1234) // Worker took 1234ms
tracker.recordFallback(2500) // Fallback took 2500ms

// Get statistics
const stats = tracker.getStats()
console.log(`Performance improvement: ${stats.improvement}%`)

// Get all stats
const allStats = getAllPerformanceStats()
console.log(allStats)
```

### Worker Pool Statistics

```typescript
const workerManager = getWorkerManager()
const stats = workerManager.getStats()

console.log('Worker Status:', {
  enabled: stats.enabled,
  supported: stats.supported,
  pools: stats.pools,
})
```

## Features

### Automatic Fallback

Workers automatically fall back to main thread execution if:
- Web Workers are not supported by the browser
- Workers are explicitly disabled
- Worker execution fails

### Progress Reporting

All workers support progress reporting:

```typescript
await workerManager.fitMeshToTarget(
  sourceMesh,
  targetMesh,
  parameters,
  (progress) => {
    // Progress from 0.0 to 1.0
    updateProgressBar(progress * 100)
  }
)
```

### Worker Pool Management

Workers are automatically pooled and reused:
- Lazy initialization (created on first use)
- Automatic termination after idle timeout (30s default)
- Hardware concurrency detection
- Per-operation worker limits

### Error Handling

Workers have comprehensive error handling:
- Automatic error propagation to main thread
- Timeout support
- Recovery from worker failures
- Detailed error messages in logs

## Configuration

### Disable Workers Globally

```typescript
import { getWorkerManager } from './workers'

// Disable workers (use main thread only)
const workerManager = getWorkerManager(false)
```

### Configure Worker Pool

```typescript
import { WorkerPool } from './workers'

const pool = new WorkerPool({
  workerScript: '/workers/MeshFittingWorker.js',
  maxWorkers: 4,
  terminateOnIdle: true,
  idleTimeout: 30000,
})
```

## Performance

Expected performance improvements:

- **Mesh Fitting**: 60-80% faster than main thread
- **Armor Fitting**: 65-75% faster than main thread
- **Asset Normalization**: 40-60% faster than main thread

Actual improvements depend on:
- CPU core count
- Mesh complexity
- Iteration count
- Hardware capabilities

## Browser Support

Web Workers are supported in:
- Chrome 4+
- Firefox 3.5+
- Safari 4+
- Edge 12+
- iOS Safari 5+
- Android Browser 4.4+

Automatic fallback ensures compatibility with all browsers.

## Cleanup

Clean up workers when done:

```typescript
import { terminateWorkerManager } from './workers'

// Terminate all workers
terminateWorkerManager()
```

This is typically only needed when:
- Unmounting the application
- Running tests
- Explicitly freeing resources

Workers automatically terminate after idle timeout, so manual cleanup is usually not required.

## Troubleshooting

### Workers Not Running

Check if workers are supported:

```typescript
const workerManager = getWorkerManager()
const stats = workerManager.getStats()

if (!stats.supported) {
  console.error('Web Workers not supported')
} else if (!stats.enabled) {
  console.error('Web Workers disabled')
}
```

### Performance Not Improving

1. Check mesh complexity (workers have overhead for small meshes)
2. Verify hardware concurrency: `navigator.hardwareConcurrency`
3. Check worker pool statistics: `workerManager.getStats()`
4. Review performance metrics: `getAllPerformanceStats()`

### Memory Issues

Workers duplicate data for transfer. For large meshes:

1. Use `Transferable` objects where possible
2. Limit concurrent worker tasks
3. Reduce worker pool size
4. Monitor memory usage

## API Reference

See type definitions in `types.ts` for complete API documentation.

## Related

- See GitHub issue #142 for worker implementation details
- Performance benchmarks in `/docs/performance.md`
- Architecture decisions in `/docs/architecture.md`
