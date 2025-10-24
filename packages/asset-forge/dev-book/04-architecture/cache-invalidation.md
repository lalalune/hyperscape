# Cache Invalidation Strategies

## Overview

Cache invalidation is one of the hardest problems in computer science. Asset Forge implements a sophisticated multi-layer cache invalidation system that ensures data consistency while maintaining performance.

> "There are only two hard things in Computer Science: cache invalidation and naming things." - Phil Karlton

## Invalidation Strategies

### 1. Time-Based Invalidation (TTL)

**Strategy**: Entries expire after a specified time period.

**Use Cases**: All cached data has a TTL as a safety net.

**Implementation**:
```typescript
// Memory cache - short TTL
cache.set('assets:list', data, 'metadata') // 5 min TTL

// IndexedDB - long TTL
await indexedDBCache.set('asset:123', data, 30 * 24 * 60 * 60 * 1000) // 30 days
```

**TTL Guidelines**:
| Data Type | Memory TTL | IndexedDB TTL |
|-----------|-----------|---------------|
| Asset Lists | 5 minutes | 7 days |
| Individual Assets | 5 minutes | 30 days |
| Material Presets | 60 minutes | 30 days |
| Voice Profiles | 60 minutes | 30 days |
| 3D Models | 30 minutes | 7 days |

### 2. Mutation-Based Invalidation

**Strategy**: Invalidate caches when data is created, updated, or deleted.

**Use Cases**: Ensure fresh data after mutations.

**Implementation**:
```typescript
import { CacheInvalidationService } from '@/services/CacheInvalidationService'

const invalidation = CacheInvalidationService.getInstance()

// After creating asset
await invalidation.invalidateOnCreate(assetId)

// After updating asset
await invalidation.invalidateOnUpdate(assetId)

// After deleting asset
await invalidation.invalidateOnDelete(assetId)
```

**Flow**:
```
Mutation (Create/Update/Delete)
  ↓
CacheInvalidationService.invalidate()
  ↓
Invalidate across all layers:
  - Memory Cache: Clear entries
  - IndexedDB: Delete entries
  - Service Worker: Send invalidation message
  ↓
Invalidate dependent caches:
  - Asset lists
  - Related assets
  - Prefetch queue
```

### 3. Pattern-Based Invalidation

**Strategy**: Invalidate all entries matching a pattern.

**Use Cases**: Bulk invalidation, category updates.

**Implementation**:
```typescript
// Invalidate all assets
await invalidation.invalidatePattern(/^asset:/)

// Invalidate all presets
await invalidation.invalidatePattern(/^preset:/)

// Invalidate specific category
await invalidation.invalidatePattern(/^asset:weapon-/)
```

### 4. Dependency-Based Invalidation

**Strategy**: Invalidate related data when primary data changes.

**Use Cases**: Maintaining consistency across related entities.

**Implementation**:
```typescript
// Define invalidation rule
invalidation.addRule('asset-update', {
  pattern: /^asset:/,
  dependencies: ['assets:list', 'prefetch:']
})

// When asset updates, dependencies are invalidated automatically
await invalidation.invalidateAsset('asset-123')
// Also invalidates: 'assets:list', 'prefetch:*'
```

### 5. Stale-While-Revalidate

**Strategy**: Serve cached data immediately, update in background.

**Use Cases**: Non-critical data that changes infrequently.

**Implementation**:
```typescript
async function getAssets() {
  // Return cached immediately
  const cached = await cache.get('assets:list')

  // Fetch fresh data in background
  fetch('/api/assets').then(response => {
    cache.set('assets:list', response.data)
  })

  return cached
}
```

## CacheInvalidationService

### Architecture

```typescript
class CacheInvalidationService {
  - memoryCache: AssetCacheService
  - indexedDBCache: IndexedDBCache
  - invalidationRules: Map<string, InvalidationRule>
  - invalidationHistory: InvalidationEvent[]

  + invalidateAsset(id: string): Promise<void>
  + invalidatePattern(pattern: RegExp): Promise<void>
  + invalidateExpired(): Promise<void>
  + invalidateAll(): Promise<void>
  + invalidateOnCreate(id: string): Promise<void>
  + invalidateOnUpdate(id: string): Promise<void>
  + invalidateOnDelete(id: string): Promise<void>
}
```

### Default Rules

The service includes pre-configured invalidation rules:

```typescript
// Asset updates invalidate lists and prefetch
{
  pattern: /^asset:/,
  dependencies: ['assets:list', 'prefetch:']
}

// Preset updates invalidate preset list
{
  pattern: /^preset:/,
  dependencies: ['presets:material']
}

// Voice updates invalidate voice library
{
  pattern: /^voice:/,
  dependencies: ['voice:library', 'voice:presets']
}

// Manifest updates invalidate manifest list
{
  pattern: /^manifest:/,
  dependencies: ['manifests:list']
}
```

### Usage Examples

#### Invalidate Specific Asset

```typescript
const invalidation = CacheInvalidationService.getInstance()

// Invalidate asset across all cache layers
await invalidation.invalidateAsset('asset-123')

// This invalidates:
// - Memory: 'asset:asset-123', 'assets:list'
// - IndexedDB: 'asset:asset-123', 'assets:list'
// - Service Worker: '/assets/asset-123/*'
```

#### Invalidate by Pattern

```typescript
// Invalidate all weapon assets
await invalidation.invalidatePattern(/^asset:weapon-/)

// Invalidate all caches
await invalidation.invalidateAll()
```

#### Custom Invalidation Rules

```typescript
// Add custom rule
invalidation.addRule('category-update', {
  pattern: /^category:/,
  dependencies: ['categories:list', 'assets:by-category']
})

// Rule is applied automatically
await invalidation.invalidatePattern(/^category:/)
// Also invalidates dependencies
```

## Multi-Layer Invalidation

### Memory Cache Invalidation

**Speed**: Instant (< 1ms)

**Method**: Delete entries from Map

```typescript
class AssetCacheService {
  invalidate(pattern: RegExp): number {
    let count = 0
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.delete(key)
        count++
      }
    }
    return count
  }
}
```

### IndexedDB Invalidation

**Speed**: Fast (5-10ms)

**Method**: Delete entries from object store

```typescript
class IndexedDBCache {
  async deletePattern(pattern: RegExp): Promise<number> {
    const keys = await this.keys(pattern)
    await Promise.all(keys.map(key => this.delete(key)))
    return keys.length
  }
}
```

### Service Worker Invalidation

**Speed**: Depends on message passing (10-50ms)

**Method**: Send message to service worker

```typescript
async function invalidateServiceWorkerCache(pattern: string) {
  if (!navigator.serviceWorker.controller) return

  const messageChannel = new MessageChannel()

  await new Promise((resolve, reject) => {
    messageChannel.port1.onmessage = event => {
      event.data.success ? resolve() : reject()
    }

    navigator.serviceWorker.controller.postMessage(
      {
        type: 'INVALIDATE_CACHE',
        payload: { pattern }
      },
      [messageChannel.port2]
    )
  })
}
```

## Invalidation Timing

### Immediate Invalidation

Invalidate immediately after mutation:

```typescript
async function updateAsset(id: string, changes: Partial<Asset>) {
  // Update asset
  await api.updateAsset(id, changes)

  // Invalidate immediately
  await invalidation.invalidateOnUpdate(id)
}
```

### Batched Invalidation

Batch multiple invalidations for efficiency:

```typescript
async function bulkUpdateAssets(updates: AssetUpdate[]) {
  // Perform all updates
  await Promise.all(updates.map(u => api.updateAsset(u.id, u.changes)))

  // Invalidate once at the end
  await invalidation.invalidatePattern(/^asset:/)
}
```

### Deferred Invalidation

Defer invalidation for non-critical updates:

```typescript
const deferredInvalidations = new Set<string>()

function scheduleInvalidation(key: string) {
  deferredInvalidations.add(key)

  // Flush after 1 second
  setTimeout(() => {
    for (const key of deferredInvalidations) {
      invalidation.invalidatePattern(new RegExp(key))
    }
    deferredInvalidations.clear()
  }, 1000)
}
```

## Invalidation Events

### Tracking Invalidations

The service tracks all invalidation events:

```typescript
interface InvalidationEvent {
  type: 'asset' | 'preset' | 'voice' | 'manifest' | 'custom'
  id?: string
  pattern?: RegExp
  timestamp: number
}

// Get invalidation history
const history = invalidation.getHistory()

// Get statistics
const stats = invalidation.getStats()
/*
{
  totalInvalidations: 150,
  byType: {
    asset: 100,
    preset: 30,
    voice: 15,
    custom: 5
  },
  recentInvalidations: [...]
}
*/
```

### Debugging Invalidations

Monitor invalidations in development:

```typescript
if (import.meta.env.DEV) {
  const original = invalidation.invalidateAsset
  invalidation.invalidateAsset = async function(id: string) {
    console.log('[Cache Invalidation]', {
      type: 'asset',
      id,
      timestamp: Date.now(),
      stack: new Error().stack
    })
    return original.call(this, id)
  }
}
```

## Best Practices

### 1. Always Invalidate After Mutations

```typescript
// ❌ BAD: No invalidation
async function updateAsset(id, changes) {
  await api.updateAsset(id, changes)
  // Cache now stale!
}

// ✅ GOOD: Immediate invalidation
async function updateAsset(id, changes) {
  await api.updateAsset(id, changes)
  await invalidation.invalidateOnUpdate(id)
}
```

### 2. Use Appropriate TTLs

```typescript
// ❌ BAD: Same TTL for everything
cache.set('assets:list', data, 'metadata') // 5 min
cache.set('presets', data, 'metadata')     // 5 min - too short!

// ✅ GOOD: Different TTLs
cache.set('assets:list', data, 'metadata')  // 5 min
cache.set('presets', data, 'preset')        // 60 min
```

### 3. Invalidate Dependencies

```typescript
// ❌ BAD: Only invalidate specific asset
await invalidation.invalidatePattern(/^asset:123$/)
// Asset list still contains old data!

// ✅ GOOD: Use proper invalidation method
await invalidation.invalidateAsset('asset-123')
// Invalidates asset + dependencies (list, prefetch, etc.)
```

### 4. Handle Invalidation Errors

```typescript
// ❌ BAD: Ignore invalidation errors
await api.updateAsset(id, changes)
invalidation.invalidateOnUpdate(id) // Fire and forget

// ✅ GOOD: Handle errors
try {
  await api.updateAsset(id, changes)
  await invalidation.invalidateOnUpdate(id)
} catch (error) {
  logger.error('Failed to update or invalidate', error)
  // Rollback or retry
}
```

### 5. Use Pattern Invalidation Carefully

```typescript
// ❌ BAD: Too broad pattern
await invalidation.invalidatePattern(/.*/) // Clears everything!

// ✅ GOOD: Specific pattern
await invalidation.invalidatePattern(/^asset:weapon-/)
```

## Testing Cache Invalidation

### Unit Tests

```typescript
describe('CacheInvalidationService', () => {
  it('should invalidate asset across all layers', async () => {
    const invalidation = CacheInvalidationService.getInstance()

    // Set up caches
    cache.set('asset:123', asset1)
    await indexedDBCache.set('asset:123', asset1)

    // Invalidate
    await invalidation.invalidateAsset('asset-123')

    // Verify cleared
    expect(cache.get('asset:123')).toBeNull()
    expect(await indexedDBCache.get('asset:123')).toBeNull()
  })

  it('should invalidate dependencies', async () => {
    cache.set('assets:list', [asset1, asset2])
    await invalidation.invalidateAsset('asset-123')

    // List should be invalidated too
    expect(cache.get('assets:list')).toBeNull()
  })
})
```

### Integration Tests

```typescript
describe('Asset mutations', () => {
  it('should invalidate cache after update', async () => {
    // Load assets (caches them)
    const assets = await AssetService.listAssets()

    // Update asset
    await AssetService.updateAsset('asset-123', { name: 'New Name' })

    // Force cache bypass
    const fresh = await AssetService.listAssets(true)

    // Should reflect update
    expect(fresh.find(a => a.id === 'asset-123').name).toBe('New Name')
  })
})
```

## Troubleshooting

### Stale Data Persisting

**Problem**: Data not updating despite invalidation

**Solutions**:
1. Check invalidation is actually called
2. Verify cache keys match exactly
3. Check TTLs aren't too long
4. Review invalidation patterns

### Over-Invalidation

**Problem**: Too many cache invalidations, poor performance

**Solutions**:
1. Use more specific patterns
2. Batch invalidations
3. Increase TTLs for stable data
4. Review invalidation rules

### Invalidation Not Reaching Service Worker

**Problem**: Service worker cache not cleared

**Solutions**:
1. Verify service worker is active
2. Check message channel communication
3. Review service worker message handler
4. Check browser console for errors

## Related Documentation

- [Caching Architecture](./caching-architecture.md)
- [Service Worker Guide](./service-worker.md)
- [Offline Support](./offline-support.md)

## Code References

- **Invalidation Service**: `/src/services/CacheInvalidationService.ts`
- **Memory Cache**: `/src/services/AssetCacheService.ts`
- **IndexedDB Cache**: `/src/services/IndexedDBCache.ts`
- **Asset Service**: `/src/services/api/AssetService.ts`
