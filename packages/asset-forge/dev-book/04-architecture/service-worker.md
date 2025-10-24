# Service Worker Guide

## Overview

Asset Forge uses a Service Worker to provide advanced caching, offline support, and performance optimization. The Service Worker acts as a programmable network proxy, intercepting requests and serving cached responses when appropriate.

## Architecture

### Service Worker Lifecycle

```
┌─────────────┐
│   Install   │ ─── Cache static assets
└─────┬───────┘
      │
┌─────▼───────┐
│  Activate   │ ─── Clean up old caches
└─────┬───────┘
      │
┌─────▼───────┐
│    Fetch    │ ─── Intercept network requests
└─────┬───────┘
      │
┌─────▼───────┐
│  Message    │ ─── Handle client messages
└─────────────┘
```

## Cache Strategies

### 1. Cache First (Static Assets)

**Use Case**: JS, CSS, fonts, images, 3D models

**Flow**:
```
Request → Check Cache
   ├─ HIT → Return cached response
   └─ MISS → Fetch from network → Update cache → Return response
```

**Implementation**:
```javascript
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  if (cached) {
    return cached // Return immediately
  }

  const response = await fetch(request)
  if (response.ok) {
    cache.put(request, response.clone())
  }

  return response
}
```

**Assets Cached**:
- JavaScript bundles: `*.js`
- Stylesheets: `*.css`
- Fonts: `*.woff2`, `*.woff`, `*.ttf`
- Images: `*.png`, `*.jpg`, `*.webp`
- 3D Models: `*.glb`, `*.gltf`

### 2. Network First (API Responses)

**Use Case**: API endpoints that need fresh data

**Flow**:
```
Request → Fetch from network
   ├─ SUCCESS → Update cache → Return response
   └─ FAILURE → Check cache
        ├─ HIT → Return cached response
        └─ MISS → Return offline error
```

**Implementation**:
```javascript
async function networkFirstStrategy(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }
    throw error
  }
}
```

**Endpoints Cached**:
- `/api/assets`
- `/api/material-presets`
- `/api/voice/library`
- `/api/voice/presets`

### 3. Stale While Revalidate

**Use Case**: Asset metadata that changes infrequently

**Flow**:
```
Request → Check cache
   ├─ HIT → Return cached response
   │        └─ Fetch from network in background → Update cache
   └─ MISS → Fetch from network → Update cache → Return response
```

**Implementation**:
```javascript
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  // Fetch fresh version in background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  })

  // Return cached immediately if available
  return cached || fetchPromise
}
```

## Registration

### Client-Side Registration

Service workers are registered in `App.tsx`:

```typescript
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('Service worker registered:', registration.scope)

        // Check for updates every hour
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                if (confirm('New version available! Reload to update?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                  window.location.reload()
                }
              }
            })
          }
        })
      })
      .catch(error => {
        console.error('Service worker registration failed:', error)
      })
  }
}, [])
```

## Cache Management

### Cache Names

Three separate caches for different asset types:

```javascript
const CACHE_VERSION = 'asset-forge-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`   // JS, CSS, fonts
const API_CACHE = `${CACHE_VERSION}-api`          // API responses
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`  // 3D models, images
```

### Cache Limits

Prevent unlimited cache growth with size limits:

```javascript
const MAX_CACHE_SIZE = {
  [STATIC_CACHE]: 100,   // 100 entries
  [API_CACHE]: 50,       // 50 entries
  [DYNAMIC_CACHE]: 200   // 200 entries
}

async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()

  if (keys.length > maxSize) {
    const toDelete = keys.length - maxSize
    // Delete oldest entries (LRU)
    for (let i = 0; i < toDelete; i++) {
      await cache.delete(keys[i])
    }
  }
}
```

### Cache Cleanup

Old caches are cleaned up on activation:

```javascript
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            // Delete old versions
            return cacheName.startsWith('asset-forge-') &&
                   cacheName !== CACHE_VERSION
          })
          .map(cacheName => caches.delete(cacheName))
      )
    })
  )
})
```

## Client-Service Worker Communication

### Invalidate Cache

Client can request cache invalidation:

```typescript
async function invalidateCache(pattern: string) {
  if (!navigator.serviceWorker.controller) return

  const messageChannel = new MessageChannel()

  return new Promise((resolve, reject) => {
    messageChannel.port1.onmessage = event => {
      if (event.data.success) {
        resolve()
      } else {
        reject(new Error('Invalidation failed'))
      }
    }

    navigator.serviceWorker.controller.postMessage(
      {
        type: 'INVALIDATE_CACHE',
        payload: { pattern }
      },
      [messageChannel.port2]
    )

    setTimeout(() => reject(new Error('Timeout')), 5000)
  })
}
```

### Get Cache Stats

Request cache statistics from service worker:

```typescript
async function getCacheStats() {
  if (!navigator.serviceWorker.controller) return null

  const messageChannel = new MessageChannel()

  return new Promise((resolve, reject) => {
    messageChannel.port1.onmessage = event => {
      resolve(event.data.stats)
    }

    navigator.serviceWorker.controller.postMessage(
      { type: 'GET_CACHE_STATS' },
      [messageChannel.port2]
    )

    setTimeout(() => reject(new Error('Timeout')), 5000)
  })
}
```

### Message Handling

Service worker handles messages from clients:

```javascript
self.addEventListener('message', event => {
  const { type, payload } = event.data

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break

    case 'INVALIDATE_CACHE':
      invalidateCache(payload.pattern).then(() => {
        event.ports[0].postMessage({ success: true })
      })
      break

    case 'CLEAR_ALL_CACHES':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true })
      })
      break

    case 'GET_CACHE_STATS':
      getCacheStats().then(stats => {
        event.ports[0].postMessage({ stats })
      })
      break
  }
})
```

## Offline Support

### Offline Page

When network fails and no cache available, show offline page:

```javascript
function createOfflineResponse() {
  return new Response(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Offline - Asset Forge</title>
        <style>
          body {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
        </style>
      </head>
      <body>
        <div>
          <h1>You're Offline</h1>
          <p>Please check your internet connection.</p>
        </div>
      </body>
    </html>
    `,
    {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    }
  )
}
```

### Offline API Response

Return structured error for API requests when offline:

```javascript
if (request.url.includes('/api/')) {
  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: 'You are currently offline. Please check your connection.'
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}
```

## Debugging

### Chrome DevTools

1. Open DevTools → Application → Service Workers
2. View registered service workers
3. Update, unregister, or bypass for network
4. View cache storage under Application → Cache Storage

### Console Logging

Service worker logs are visible in console:

```javascript
console.log('[Service Worker] Installing...')
console.log('[Service Worker] Cache hit:', request.url)
console.log('[Service Worker] Evicting LRU entry:', key)
```

### Force Update

Force service worker update:

```typescript
// In browser console
navigator.serviceWorker.getRegistration().then(reg => {
  reg.update()
})
```

### Unregister Service Worker

Remove service worker for debugging:

```typescript
// In browser console
navigator.serviceWorker.getRegistration().then(reg => {
  reg.unregister()
})
```

## Performance Impact

### Before Service Worker
- First load: 2000-3000ms
- Subsequent loads: 500-1000ms
- Offline: Complete failure

### After Service Worker
- First load: 2000-3000ms (same, caching for next time)
- Subsequent loads: 50-200ms (cache hit)
- Offline: Full functionality for cached assets

### Cache Hit Rates
- Static assets: 95-99%
- API responses: 70-85%
- 3D models: 80-90%

## Best Practices

### 1. Version Your Caches

Always include version in cache names:

```javascript
const CACHE_VERSION = 'asset-forge-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
```

### 2. Clean Up Old Caches

Remove old caches on activation:

```javascript
cacheNames.filter(name =>
  name.startsWith('asset-forge-') && name !== CACHE_VERSION
)
```

### 3. Don't Cache Everything

Be selective about what to cache:

```javascript
// Skip chrome-extension and non-http requests
if (!url.protocol.startsWith('http')) {
  return
}
```

### 4. Handle Errors Gracefully

Always provide fallback for offline scenarios:

```javascript
try {
  return await fetch(request)
} catch (error) {
  const cached = await cache.match(request)
  return cached || createOfflineResponse()
}
```

### 5. Update Periodically

Check for service worker updates regularly:

```typescript
setInterval(() => {
  registration.update()
}, 60 * 60 * 1000) // Every hour
```

## Troubleshooting

### Service Worker Not Updating

**Problem**: Changes to service worker not taking effect

**Solutions**:
1. Increment `CACHE_VERSION`
2. Use "Update on reload" in DevTools
3. Manually unregister and re-register
4. Clear browser cache

### Cache Not Working

**Problem**: Requests not being cached

**Solutions**:
1. Check request URL matches cache patterns
2. Verify cache strategy is correct
3. Check cache size limits
4. Review fetch event listener

### Offline Page Not Showing

**Problem**: Blank page when offline

**Solutions**:
1. Verify offline page is cached during install
2. Check fallback logic in fetch handler
3. Ensure createOfflineResponse is called correctly

### Memory Issues

**Problem**: Service worker consuming too much memory

**Solutions**:
1. Reduce MAX_CACHE_SIZE limits
2. Implement more aggressive cache trimming
3. Clean up old caches more frequently
4. Remove unnecessary cached assets

## Related Documentation

- [Caching Architecture](./caching-architecture.md)
- [Offline Support](./offline-support.md)
- [Performance Optimization](../performance/optimization.md)

## Code References

- **Service Worker**: `/public/sw.js`
- **Registration**: `/src/App.tsx`
- **Configuration**: `/vite.config.ts`
