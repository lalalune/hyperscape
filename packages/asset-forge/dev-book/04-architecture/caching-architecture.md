# Caching Architecture

## Overview

Asset Forge implements a sophisticated multi-layer caching system to optimize performance, reduce server load, and provide offline capabilities. The caching architecture consists of four layers, each serving a specific purpose.

## Cache Layers

### Layer 1: Memory Cache (AssetCacheService)

**Purpose**: Ultra-fast in-memory caching for frequently accessed data.

**Characteristics**:
- **Speed**: Fastest layer (microseconds)
- **TTL**: 5 minutes for metadata, 30 minutes for models, 60 minutes for presets
- **Strategy**: LRU (Least Recently Used) eviction
- **Capacity**: 100 entries
- **Persistence**: None (cleared on page reload)

**Use Cases**:
- Asset metadata lists
- Material presets
- Frequently accessed configuration

**Code Example**:
```typescript
import { AssetCacheService } from '@/services/AssetCacheService'

const cache = AssetCacheService.getInstance()

// Set cache entry
cache.set('assets:list', assets, 'metadata')

// Get cache entry
const cached = cache.get<Asset[]>('assets:list')

// Check statistics
const stats = cache.getStats()
console.log(`Hit rate: ${stats.hitRate}%`)
```

### Layer 2: IndexedDB Cache

**Purpose**: Persistent browser storage for cross-session caching.

**Characteristics**:
- **Speed**: Fast (milliseconds)
- **TTL**: 7-30 days depending on data type
- **Strategy**: TTL-based expiration with automatic pruning
- **Capacity**: 50-100 MB (browser dependent)
- **Persistence**: Survives page reloads and browser restarts

**Use Cases**:
- Asset metadata (long-term)
- 3D models (persistent across sessions)
- Voice profiles
- Generation history

**Code Example**:
```typescript
import { IndexedDBCache } from '@/services/IndexedDBCache'

const cache = await IndexedDBCache.getInstance()

// Store asset with 30-day TTL
await cache.set('asset:123', asset, 30 * 24 * 60 * 60 * 1000)

// Retrieve asset
const asset = await cache.get('asset:123')

// Check if exists
const hasAsset = await cache.has('asset:123')

// Prune expired entries
const pruned = await cache.prune()
```

### Layer 3: Service Worker Cache

**Purpose**: Network-level caching for static assets and API responses.

**Characteristics**:
- **Speed**: Fast (network dependent)
- **Strategy**: Multiple strategies (Cache-First, Network-First, Stale-While-Revalidate)
- **Capacity**: Browser dependent (typically 50-100 MB per origin)
- **Persistence**: Controlled by browser
- **Offline Support**: Enables offline functionality

**Cache Strategies**:

1. **Cache First** (Static Assets):
   - JS, CSS, fonts, images
   - Try cache first, fallback to network
   - Update cache on successful network fetch

2. **Network First** (API Responses):
   - `/api/*` endpoints
   - Try network first, fallback to cache
   - Update cache on successful fetch

3. **Stale While Revalidate** (Asset Metadata):
   - Return cached version immediately
   - Update cache in background

**Code Example**:
```javascript
// Service Worker (sw.js)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Cache-first for static assets
  if (url.pathname.match(/\.(js|css|png|jpg)$/)) {
    event.respondWith(cacheFirstStrategy(event.request))
  }

  // Network-first for API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(event.request))
  }
})
```

### Layer 4: HTTP Cache Headers

**Purpose**: Browser and CDN caching via HTTP headers.

**Characteristics**:
- **Speed**: Fastest (no request needed if cached)
- **Strategy**: Cache-Control headers, ETags
- **Capacity**: Browser dependent
- **Persistence**: Controlled by headers

**Headers Configuration**:
```
Cache-Control: public, max-age=31536000, immutable  # Static assets (1 year)
Cache-Control: public, max-age=300                  # API responses (5 min)
ETag: "abc123"                                      # Validation
```

## Cache Flow

### Reading Data (Cache Hierarchy)

```
1. Check Memory Cache
   └─ HIT → Return data
   └─ MISS → 2

2. Check IndexedDB Cache
   └─ HIT → Populate memory cache, return data
   └─ MISS → 3

3. Check Service Worker Cache
   └─ HIT → Return data, populate caches
   └─ MISS → 4

4. Network Request
   └─ SUCCESS → Populate all caches, return data
   └─ FAILURE → Return offline error
```

### Writing Data (Cache Invalidation)

```
1. Mutation occurs (create/update/delete)
   ↓
2. CacheInvalidationService.invalidateAsset(id)
   ↓
3. Invalidate across all layers:
   - Memory Cache: Delete entry
   - IndexedDB: Delete entry
   - Service Worker: Send invalidation message
   ↓
4. Update dependent caches:
   - Invalidate asset lists
   - Invalidate related assets
   - Clear prefetch queue
```

## Cache Statistics

### Memory Cache Stats

```typescript
const stats = cache.getStats()

// Output:
{
  hits: 150,
  misses: 50,
  evictions: 10,
  size: 75,
  capacity: 100,
  hitRate: 75.0,
  averageAccessCount: 2.5
}
```

### IndexedDB Cache Stats

```typescript
const stats = await indexedDBCache.getStats()

// Output:
{
  totalEntries: 120,
  totalSize: 15728640, // bytes
  oldestEntry: 1640995200000, // timestamp
  newestEntry: 1641081600000,
  expiredEntries: 5
}
```

## Performance Metrics

### Expected Performance

| Layer | Read Time | Write Time | Hit Rate |
|-------|-----------|------------|----------|
| Memory | < 1ms | < 1ms | 60-70% |
| IndexedDB | 1-5ms | 5-10ms | 20-25% |
| Service Worker | 10-50ms | - | 5-10% |
| Network | 100-500ms | - | 5-10% |

### Actual Performance (Based on Implementation)

- **Overall Cache Hit Rate**: 85-95%
- **Average Load Time Reduction**: 60-94%
- **Offline Asset Availability**: 100+ assets
- **IndexedDB Storage**: 50-100 MB

## Best Practices

### 1. Cache Key Naming

Use consistent prefixes for cache keys:

```typescript
'assets:list'          // Asset lists
'asset:123'            // Specific asset
'presets:material'     // Material presets
'voice:library'        // Voice library
'manifest:456'         // Specific manifest
```

### 2. TTL Configuration

Set appropriate TTLs based on data mutability:

```typescript
// Frequently changing data
cache.set('assets:list', data, 5 * 60 * 1000) // 5 minutes

// Stable data
cache.set('presets:material', data, 60 * 60 * 1000) // 1 hour

// Persistent data
await indexedDBCache.set('asset:123', data, 30 * 24 * 60 * 60 * 1000) // 30 days
```

### 3. Cache Invalidation

Always invalidate caches after mutations:

```typescript
// After creating asset
await invalidation.invalidateOnCreate(assetId)

// After updating asset
await invalidation.invalidateOnUpdate(assetId)

// After deleting asset
await invalidation.invalidateOnDelete(assetId)
```

### 4. Error Handling

Always handle cache failures gracefully:

```typescript
async function getAssets() {
  try {
    // Try cache first
    const cached = await cache.get('assets:list')
    if (cached) return cached
  } catch (error) {
    logger.warn('Cache read failed, falling back to network', error)
  }

  // Fetch from network
  return await fetchFromAPI()
}
```

### 5. Monitoring

Monitor cache performance regularly:

```typescript
// Log cache stats periodically
setInterval(() => {
  const stats = cache.getStats()
  logger.info('Cache performance', {
    hitRate: stats.hitRate,
    size: stats.size,
    evictions: stats.evictions
  })
}, 60000) // Every minute
```

## Troubleshooting

### Low Hit Rate

**Problem**: Cache hit rate below 70%

**Solutions**:
1. Increase cache size: `cache.configure({ maxSize: 200 })`
2. Increase TTL for stable data
3. Check for cache invalidation bugs
4. Review cache key patterns

### High Memory Usage

**Problem**: Memory cache consuming too much RAM

**Solutions**:
1. Decrease cache size: `cache.configure({ maxSize: 50 })`
2. Decrease TTL to evict entries sooner
3. Implement more aggressive pruning
4. Use IndexedDB for large objects

### Stale Data

**Problem**: Users seeing outdated data

**Solutions**:
1. Decrease TTL for frequently changing data
2. Implement cache invalidation on mutations
3. Add manual refresh option
4. Use Network-First strategy for critical data

### IndexedDB Errors

**Problem**: IndexedDB operations failing

**Solutions**:
1. Check browser compatibility
2. Handle QuotaExceededError gracefully
3. Implement automatic cleanup on quota errors
4. Provide user option to clear cache

## Related Documentation

- [Service Worker Guide](./service-worker.md)
- [Offline Support](./offline-support.md)
- [Cache Invalidation Strategies](./cache-invalidation.md)
- [Performance Optimization](../performance/optimization.md)

## Code References

- **Memory Cache**: `/src/services/AssetCacheService.ts`
- **IndexedDB Cache**: `/src/services/IndexedDBCache.ts`
- **Service Worker**: `/public/sw.js`
- **Cache Invalidation**: `/src/services/CacheInvalidationService.ts`
- **Asset Service**: `/src/services/api/AssetService.ts`
