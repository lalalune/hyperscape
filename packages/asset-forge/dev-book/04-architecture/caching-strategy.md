# Caching Strategy

> **Comprehensive caching architecture across all layers of Asset Forge**

This document outlines the complete caching strategy, from browser caching to application-level caches, ensuring optimal performance throughout the application.

---

## Table of Contents

- [Overview](#overview)
- [Cache Layers](#cache-layers)
- [Cache Key Design](#cache-key-design)
- [TTL Configuration](#ttl-configuration)
- [Invalidation Strategies](#invalidation-strategies)
- [Cache Coordination](#cache-coordination)
- [Best Practices](#best-practices)

---

## Overview

Asset Forge implements a multi-layer caching strategy:

1. **Browser Cache**: HTTP caching for static assets
2. **Application Cache**: Runtime data caching
3. **Request Deduplication**: In-flight request sharing
4. **Component Cache**: React component memoization

---

## Cache Layers

### Layer 1: Browser Cache (HTTP)

**Handled by:** Server response headers

**Purpose:** Cache static assets (JS, CSS, images)

```javascript
// server/api.mjs
app.use(express.static('public', {
  maxAge: '1y',  // 1 year for static assets
  immutable: true
}))

// Cache-Control headers
'Cache-Control: public, max-age=31536000, immutable'
```

### Layer 2: Application Cache (Memory)

**Handled by:** AssetCacheService

**Purpose:** Cache runtime data (assets, presets, models)

```typescript
const cache = AssetCacheService.getInstance()

cache.set('assets:list', assets, 'metadata')  // 5min TTL
cache.set('model:123', model, 'model')        // 30min TTL
cache.set('preset:bronze', preset, 'preset')  // 60min TTL
```

### Layer 3: Request Deduplication

**Handled by:** RequestDeduplicator

**Purpose:** Share in-flight requests

```typescript
const data = await requestDeduplicator.deduplicate(
  'GET::/api/assets',
  () => fetch('/api/assets')
)
```

### Layer 4: Component Memoization

**Handled by:** React.memo, useMemo, useCallback

**Purpose:** Prevent unnecessary re-renders

```typescript
const MemoizedComponent = React.memo(ExpensiveComponent)

const memoizedValue = useMemo(() => {
  return expensiveCalculation(a, b)
}, [a, b])

const memoizedCallback = useCallback(() => {
  doSomething(a, b)
}, [a, b])
```

---

## Cache Key Design

### Naming Convention

```typescript
// Pattern: {resource}:{operation}:{identifier}
const CACHE_KEYS = {
  // Lists
  'assets:list',
  'presets:list',
  'manifests:list',

  // Individual resources
  'asset:{id}',
  'model:{id}',
  'preset:{id}',
  'manifest:{id}',

  // Filtered lists
  'assets:type:{type}',
  'assets:status:{status}',
  'assets:search:{query}',

  // Related data
  'asset:{id}:sprites',
  'asset:{id}:variants',
  'manifest:{id}:voices'
}
```

### Key Generation Functions

```typescript
// src/utils/cache-keys.ts
export const CacheKeys = {
  // Assets
  assetList: () => 'assets:list',
  asset: (id: string) => `asset:${id}`,
  assetsByType: (type: string) => `assets:type:${type}`,
  assetsByStatus: (status: string) => `assets:status:${status}`,
  assetSearch: (query: string) => `assets:search:${query}`,

  // Models
  model: (id: string) => `model:${id}`,
  modelSprites: (id: string) => `model:${id}:sprites`,
  modelVariants: (id: string) => `model:${id}:variants`,

  // Presets
  presetList: () => 'presets:list',
  preset: (id: string) => `preset:${id}`,
  presetsByMaterial: (material: string) => `presets:material:${material}`,

  // Manifests
  manifestList: () => 'manifests:list',
  manifest: (id: string) => `manifest:${id}`,
  manifestVoices: (id: string) => `manifest:${id}:voices`
}

// Usage
cache.set(CacheKeys.asset('123'), asset, 'metadata')
cache.get(CacheKeys.assetsByType('weapon'))
cache.invalidate(new RegExp(`^${CacheKeys.asset('123')}`))
```

---

## TTL Configuration

### Default TTLs

```typescript
const DEFAULT_TTL = {
  // Short-lived (5 minutes)
  metadata: 5 * 60 * 1000,
  lists: 5 * 60 * 1000,
  search: 5 * 60 * 1000,

  // Medium-lived (30 minutes)
  models: 30 * 60 * 1000,
  images: 30 * 60 * 1000,

  // Long-lived (60 minutes)
  presets: 60 * 60 * 1000,
  configs: 60 * 60 * 1000,
  static: 60 * 60 * 1000
}
```

### TTL Selection Guide

```typescript
// 5 minutes - Frequently changing data
cache.set(CacheKeys.assetList(), assets, 'metadata')
cache.set(CacheKeys.assetSearch(query), results, 'metadata')

// 30 minutes - Rarely changing, large data
cache.set(CacheKeys.model(id), model, 'model')
cache.set(CacheKeys.modelSprites(id), sprites, 'model')

// 60 minutes - Static configuration
cache.set(CacheKeys.presetList(), presets, 'preset')
cache.set(CacheKeys.preset(id), preset, 'preset')
```

---

## Invalidation Strategies

### Strategy 1: Immediate Invalidation

**When:** After mutations (create, update, delete)

```typescript
async function updateAsset(id: string, changes: Partial<Asset>) {
  // 1. Update via API
  await fetch(`/api/assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes)
  })

  // 2. Invalidate specific cache
  cache.delete(CacheKeys.asset(id))

  // 3. Invalidate related caches
  cache.delete(CacheKeys.assetList())
  cache.invalidate(/^assets:type:/)
  cache.invalidate(/^assets:status:/)
}
```

### Strategy 2: Pattern-Based Invalidation

**When:** Need to invalidate multiple related caches

```typescript
// Invalidate all asset-related caches
cache.invalidate(/^asset:/)

// Invalidate all caches for specific asset
cache.invalidate(new RegExp(`^asset:${id}`))

// Invalidate all search results
cache.invalidate(/^assets:search:/)
```

### Strategy 3: Time-Based Invalidation

**When:** Let TTL handle expiration

```typescript
// Cache automatically expires after TTL
cache.set(key, data, 'metadata') // Expires after 5min

// No manual invalidation needed
// Next request after expiration will fetch fresh data
```

### Strategy 4: Event-Based Invalidation

**When:** External events trigger cache invalidation

```typescript
// Listen for WebSocket updates
websocket.on('asset:updated', ({ id }) => {
  cache.delete(CacheKeys.asset(id))
  cache.delete(CacheKeys.assetList())
})

// Listen for user actions
eventBus.on('asset:deleted', ({ id }) => {
  cache.invalidate(new RegExp(`^asset:${id}`))
})
```

---

## Cache Coordination

### Coordinating Multiple Caches

```typescript
// src/services/CacheCoordinator.ts
class CacheCoordinator {
  private assetCache = AssetCacheService.getInstance()
  private deduplicator = requestDeduplicator

  /**
   * Fetch with full cache coordination
   */
  async fetchAsset(id: string): Promise<Asset> {
    const cacheKey = CacheKeys.asset(id)
    const dedupeKey = `GET::/api/assets/${id}`

    // 1. Check asset cache
    const cached = this.assetCache.get<Asset>(cacheKey)
    if (cached) return cached

    // 2. Deduplicate request
    const asset = await this.deduplicator.deduplicate(dedupeKey, async () => {
      const response = await fetch(`/api/assets/${id}`)
      if (!response.ok) throw new Error('Not found')
      return response.json()
    })

    // 3. Store in cache
    this.assetCache.set(cacheKey, asset, 'metadata')

    return asset
  }

  /**
   * Update with cache invalidation
   */
  async updateAsset(id: string, changes: Partial<Asset>): Promise<Asset> {
    // 1. Update via API
    const response = await fetch(`/api/assets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes)
    })
    const updated = await response.json()

    // 2. Invalidate caches
    this.invalidateAsset(id)

    // 3. Update cache with fresh data
    this.assetCache.set(CacheKeys.asset(id), updated, 'metadata')

    return updated
  }

  /**
   * Invalidate asset and related caches
   */
  invalidateAsset(id: string): void {
    this.assetCache.delete(CacheKeys.asset(id))
    this.assetCache.delete(CacheKeys.assetList())
    this.assetCache.invalidate(new RegExp(`^asset:${id}:`))
    this.assetCache.invalidate(/^assets:type:/)
    this.assetCache.invalidate(/^assets:status:/)
    this.deduplicator.clear()
  }
}

export const cacheCoordinator = new CacheCoordinator()
```

### Usage in Services

```typescript
// src/services/api/AssetService.ts
import { cacheCoordinator } from '@/services/CacheCoordinator'

export class AssetService {
  static async fetchAsset(id: string): Promise<Asset> {
    return cacheCoordinator.fetchAsset(id)
  }

  static async updateAsset(id: string, changes: Partial<Asset>): Promise<Asset> {
    return cacheCoordinator.updateAsset(id, changes)
  }

  static async deleteAsset(id: string): Promise<void> {
    await fetch(`/api/assets/${id}`, { method: 'DELETE' })
    cacheCoordinator.invalidateAsset(id)
  }
}
```

---

## Best Practices

### ✅ Do

```typescript
// 1. Use consistent cache keys
const key = CacheKeys.asset(id) // ✓ Good
// Not: `asset-${id}` or `assets/${id}`

// 2. Set appropriate TTLs
cache.set(key, metadata, 'metadata')  // 5min
cache.set(key, model, 'model')        // 30min
cache.set(key, preset, 'preset')      // 60min

// 3. Invalidate on mutations
await updateAsset(id, changes)
cache.delete(CacheKeys.asset(id))

// 4. Use pattern invalidation for related data
cache.invalidate(/^asset:${id}/)

// 5. Coordinate with request deduplication
const cached = cache.get(cacheKey)
if (cached) return cached

const data = await deduplicator.deduplicate(dedupeKey, fetchFn)
cache.set(cacheKey, data)
```

### ❌ Don't

```typescript
// 1. Don't use inconsistent keys
cache.set(`asset-${id}`, data)
cache.get(`assets/${id}`)  // ❌ Won't find it

// 2. Don't cache user-specific data globally
cache.set('current-user', user)  // ❌ Leaks between users

// 3. Don't forget to invalidate
await updateAsset(id, changes)
// ❌ Missing: cache.delete()

// 4. Don't use overly long TTLs for changing data
cache.set(key, realtimeData, 'preset')  // ❌ 60min too long

// 5. Don't cache errors
try {
  const data = await fetchData()
  cache.set(key, data)  // ✓ Only cache on success
} catch (error) {
  // ❌ Don't: cache.set(key, error)
}
```

---

## Related Documentation

- [Request Deduplication](./request-deduplication.md)
- [Asset Caching](./asset-caching.md)
- [Performance Architecture](./performance-architecture.md)
- [State Management](../11-development/state-management.md)

---

**Last Updated:** 2025-10-24
**Version:** 1.0.0
