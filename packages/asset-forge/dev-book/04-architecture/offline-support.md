# Offline Support

## Overview

Asset Forge provides comprehensive offline support, allowing users to continue working even when their internet connection is lost. This is achieved through a combination of Service Worker caching, IndexedDB persistence, and intelligent fallback mechanisms.

## Offline Capabilities

### What Works Offline

1. **Viewing Cached Assets**
   - Browse previously loaded assets
   - View asset details and metadata
   - Inspect 3D models (if previously loaded)
   - View concept art

2. **UI Navigation**
   - Switch between views
   - Access cached pages
   - Use navigation menus

3. **Reading Cached Data**
   - Material presets
   - Voice profiles
   - Manifest data
   - Generation history

### What Doesn't Work Offline

1. **Creating New Assets**
   - Asset generation requires server
   - AI model inference is server-side

2. **Mutations**
   - Cannot update existing assets
   - Cannot delete assets
   - Cannot modify presets

3. **Real-time Updates**
   - No live collaboration
   - No automatic syncing

## Implementation

### 1. Offline Detection

Use the `useOfflineStatus` hook to detect connection status:

```typescript
import { useOfflineStatus } from '@/hooks/useOfflineStatus'

function MyComponent() {
  const {
    isOnline,
    isOffline,
    connectionType,
    effectiveType,
    wasOffline
  } = useOfflineStatus()

  if (isOffline) {
    return <OfflineIndicator />
  }

  return <NormalContent />
}
```

### 2. Offline Indicator

Display connection status to users:

```typescript
function OfflineIndicator() {
  const { isOffline, wasOffline } = useOfflineStatus()

  if (!isOffline && !wasOffline) {
    return null
  }

  return (
    <div className="offline-banner">
      {isOffline ? (
        <span>You are currently offline</span>
      ) : (
        <span>Back online!</span>
      )}
    </div>
  )
}
```

### 3. Graceful Degradation

Disable features that require network:

```typescript
function AssetActions({ assetId }) {
  const { isOnline } = useOfflineStatus()

  return (
    <div>
      {/* Always available */}
      <button onClick={() => viewAsset(assetId)}>
        View
      </button>

      {/* Only when online */}
      <button
        disabled={!isOnline}
        onClick={() => regenerateAsset(assetId)}
      >
        Regenerate {!isOnline && '(offline)'}
      </button>
    </div>
  )
}
```

### 4. Offline Error Handling

Handle offline errors gracefully:

```typescript
async function fetchAssets() {
  try {
    const response = await fetch('/api/assets')

    if (!response.ok && response.status === 503) {
      // Service worker returned offline response
      showOfflineMessage()
      return getCachedAssets()
    }

    return await response.json()
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      // Network error
      showOfflineMessage()
      return getCachedAssets()
    }
    throw error
  }
}
```

## Service Worker Offline Handling

### Offline Page

The service worker serves a custom offline page when no cache is available:

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
            font-family: system-ui;
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
        <div class="container">
          <h1>You're Offline</h1>
          <p>Please check your internet connection and try again.</p>
        </div>
      </body>
    </html>
    `,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html' }
    }
  )
}
```

### API Offline Response

API requests return structured JSON errors when offline:

```javascript
if (request.url.includes('/api/')) {
  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: 'You are currently offline. Please check your connection.',
      cached: true
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    }
  )
}
```

## IndexedDB Persistence

### Storing Data for Offline

Persist data in IndexedDB for offline access:

```typescript
import { IndexedDBCache } from '@/services/IndexedDBCache'

// Store assets with long TTL (30 days)
const cache = await IndexedDBCache.getInstance()
await cache.set('assets:list', assets, 30 * 24 * 60 * 60 * 1000)

// Store individual asset
await cache.set(`asset:${id}`, asset, 30 * 24 * 60 * 60 * 1000)

// Store 3D model data
await cache.set(`model:${id}`, modelData, 7 * 24 * 60 * 60 * 1000)
```

### Retrieving Offline Data

Retrieve from IndexedDB when network fails:

```typescript
async function getAssets() {
  try {
    // Try network first
    return await fetchFromAPI()
  } catch (error) {
    // Fallback to IndexedDB
    const cache = await IndexedDBCache.getInstance()
    const cached = await cache.get('assets:list')

    if (cached) {
      logger.info('Serving assets from IndexedDB (offline)')
      return cached
    }

    throw new Error('No offline data available')
  }
}
```

## Connection Quality

### Network Information API

Access connection information:

```typescript
const { connectionType, effectiveType, downlink, rtt, saveData } = useOfflineStatus()

// Adapt behavior based on connection
if (effectiveType === 'slow-2g' || effectiveType === '2g') {
  // Disable auto-loading large assets
  disableAutoPreview()
}

if (saveData) {
  // User has data saver enabled
  disablePrefetching()
  loadLowResImages()
}
```

### Adaptive Loading

Adjust loading strategies based on connection:

```typescript
function shouldLoadHighResAssets(connectionInfo) {
  // Don't load high-res on slow connections
  if (connectionInfo.effectiveType === 'slow-2g' || connectionInfo.effectiveType === '2g') {
    return false
  }

  // Don't load high-res when data saver is on
  if (connectionInfo.saveData) {
    return false
  }

  return true
}
```

## Offline Sync

### Queue Mutations

Queue mutations for later sync:

```typescript
class OfflineSyncQueue {
  private queue: MutationRequest[] = []

  async addToQueue(mutation: MutationRequest) {
    this.queue.push(mutation)
    await this.persistQueue()

    // Try to sync if we're back online
    if (navigator.onLine) {
      await this.sync()
    }
  }

  async sync() {
    while (this.queue.length > 0 && navigator.onLine) {
      const mutation = this.queue[0]

      try {
        await this.executeMutation(mutation)
        this.queue.shift() // Remove successful mutation
        await this.persistQueue()
      } catch (error) {
        logger.error('Sync failed', error)
        break // Stop syncing on error
      }
    }
  }

  private async persistQueue() {
    localStorage.setItem('sync-queue', JSON.stringify(this.queue))
  }
}
```

### Background Sync

Use Background Sync API when available:

```typescript
// Register background sync
if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
  navigator.serviceWorker.ready.then(registration => {
    return registration.sync.register('sync-mutations')
  })
}

// Handle sync in service worker
self.addEventListener('sync', event => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(syncMutations())
  }
})
```

## User Experience

### Offline Notifications

Show notifications when going offline/online:

```typescript
function OfflineNotification() {
  const { isOffline, wasOffline } = useOfflineStatus()
  const [showNotification, setShowNotification] = useState(false)

  useEffect(() => {
    if (isOffline) {
      setShowNotification(true)
    } else if (wasOffline) {
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 3000)
    }
  }, [isOffline, wasOffline])

  if (!showNotification) return null

  return (
    <div className={`notification ${isOffline ? 'offline' : 'online'}`}>
      {isOffline ? (
        <>You're offline. Some features are unavailable.</>
      ) : (
        <>You're back online!</>
      )}
    </div>
  )
}
```

### Disabled State Styling

Visual feedback for disabled features:

```css
.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button:disabled::after {
  content: ' (offline)';
  font-size: 0.875rem;
  color: #ef4444;
}
```

### Loading States

Show appropriate loading states:

```typescript
function AssetList() {
  const { isOffline } = useOfflineStatus()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchAssets()
        setAssets(data)
      } catch (error) {
        if (isOffline) {
          // Try to load from cache
          const cached = await getCachedAssets()
          setAssets(cached)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOffline])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <>
      {isOffline && assets.length > 0 && (
        <div className="warning">
          Showing cached assets (offline)
        </div>
      )}
      <AssetGrid assets={assets} />
    </>
  )
}
```

## Testing Offline Functionality

### Chrome DevTools

1. Open DevTools → Network
2. Select "Offline" from throttling dropdown
3. Test offline behavior

### Service Worker Bypass

Bypass service worker during development:

1. DevTools → Application → Service Workers
2. Check "Bypass for network"

### Simulate Slow Connection

Test on slow connections:

1. DevTools → Network
2. Select "Slow 3G" or "Fast 3G"
3. Verify adaptive loading works

## Best Practices

### 1. Always Cache Critical Assets

```javascript
// In service worker install event
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.js',
  '/assets/index.css'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(CRITICAL_ASSETS)
    })
  )
})
```

### 2. Provide Offline Feedback

Always inform users when they're offline:

```typescript
const { isOffline } = useOfflineStatus()

return (
  <div>
    {isOffline && <OfflineBanner />}
    <MainContent />
  </div>
)
```

### 3. Graceful Degradation

Disable features gracefully:

```typescript
<button
  disabled={!isOnline}
  onClick={handleAction}
  title={isOffline ? 'Requires internet connection' : ''}
>
  {actionLabel}
</button>
```

### 4. Use Optimistic Updates

Show immediate feedback, sync later:

```typescript
async function updateAsset(id, changes) {
  // Update UI immediately
  updateLocalState(id, changes)

  if (!navigator.onLine) {
    // Queue for later sync
    await offlineSyncQueue.add({ type: 'update', id, changes })
    showNotification('Changes saved locally, will sync when online')
    return
  }

  // Sync to server
  try {
    await api.updateAsset(id, changes)
  } catch (error) {
    // Rollback on error
    rollbackLocalState(id)
    showError('Failed to save changes')
  }
}
```

### 5. Monitor Connection Changes

React to connection changes:

```typescript
useEffect(() => {
  function handleOnline() {
    // Sync queued mutations
    offlineSyncQueue.sync()
    // Refresh data
    refreshAssets()
  }

  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}, [])
```

## Troubleshooting

### Assets Not Available Offline

**Problem**: Assets not showing when offline

**Solutions**:
1. Verify assets were cached during online session
2. Check IndexedDB contains asset data
3. Ensure service worker is active
4. Check cache size limits not exceeded

### Stale Data When Back Online

**Problem**: Old cached data shown after reconnecting

**Solutions**:
1. Implement cache revalidation on reconnect
2. Use Network-First strategy for critical data
3. Add manual refresh button
4. Show "last updated" timestamp

### Offline Queue Not Syncing

**Problem**: Queued mutations not syncing when online

**Solutions**:
1. Verify 'online' event listener is registered
2. Check sync queue persistence
3. Ensure mutations are retryable
4. Handle sync errors gracefully

## Related Documentation

- [Caching Architecture](./caching-architecture.md)
- [Service Worker Guide](./service-worker.md)
- [Performance Optimization](../performance/optimization.md)

## Code References

- **Offline Hook**: `/src/hooks/useOfflineStatus.ts`
- **Service Worker**: `/public/sw.js`
- **IndexedDB Cache**: `/src/services/IndexedDBCache.ts`
- **Asset Service**: `/src/services/api/AssetService.ts`
