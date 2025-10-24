/**
 * Asset Forge Service Worker
 *
 * Implements multi-strategy caching for optimal performance and offline support.
 *
 * Cache Strategies:
 * - Cache First: Static assets (JS, CSS, fonts, images)
 * - Network First: API responses with fallback to cache
 * - Stale While Revalidate: Asset metadata and presets
 *
 * Version: 1.0.0
 */

const CACHE_VERSION = 'asset-forge-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const API_CACHE = `${CACHE_VERSION}-api`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
  // Vite will generate hashed assets, so we'll cache them on demand
]

// API routes to cache
const API_ROUTES = [
  '/api/assets',
  '/api/material-presets',
  '/api/voice/library',
  '/api/voice/presets'
]

// Maximum cache sizes
const MAX_CACHE_SIZE = {
  [STATIC_CACHE]: 100,
  [API_CACHE]: 50,
  [DYNAMIC_CACHE]: 200
}

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[Service Worker] Installed successfully')
        return self.skipWaiting() // Activate worker immediately
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error)
      })
  )
})

/**
 * Activate event - cleanup old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old versions
              return cacheName.startsWith('asset-forge-') && cacheName !== CACHE_VERSION
            })
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            })
        )
      })
      .then(() => {
        console.log('[Service Worker] Activated successfully')
        return self.clients.claim() // Take control of all pages
      })
  )
})

/**
 * Fetch event - intercept network requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return
  }

  // API requests - Network First strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE))
    return
  }

  // 3D Models (.glb, .gltf) - Cache First strategy with network fallback
  if (url.pathname.match(/\.(glb|gltf)$/)) {
    event.respondWith(cacheFirstStrategy(request, DYNAMIC_CACHE))
    return
  }

  // Static assets - Cache First strategy
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/) ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE))
    return
  }

  // Default - Network First
  event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE))
})

/**
 * Cache First Strategy
 * Try cache first, fall back to network if not found
 */
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)

    if (cached) {
      console.log('[Service Worker] Cache hit:', request.url)
      return cached
    }

    console.log('[Service Worker] Cache miss, fetching:', request.url)
    const response = await fetch(request)

    // Cache successful responses
    if (response.ok) {
      const responseToCache = response.clone()
      cache.put(request, responseToCache)
      await trimCache(cacheName, MAX_CACHE_SIZE[cacheName])
    }

    return response
  } catch (error) {
    console.error('[Service Worker] Cache first strategy failed:', error)

    // Try to return cached version as last resort
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }

    // Return offline page if available
    return createOfflineResponse()
  }
}

/**
 * Network First Strategy
 * Try network first, fall back to cache if offline
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    console.log('[Service Worker] Network first:', request.url)
    const response = await fetch(request)

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
      await trimCache(cacheName, MAX_CACHE_SIZE[cacheName])
    }

    return response
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url)

    // Fallback to cache
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)

    if (cached) {
      console.log('[Service Worker] Serving from cache:', request.url)
      return cached
    }

    console.error('[Service Worker] Network first strategy failed:', error)

    // Return offline response for API requests
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'Offline',
          message: 'You are currently offline. Please check your connection.'
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return createOfflineResponse()
  }
}

/**
 * Stale While Revalidate Strategy
 * Return cached version immediately, update cache in background
 */
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  // Fetch fresh version in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
        trimCache(cacheName, MAX_CACHE_SIZE[cacheName])
      }
      return response
    })
    .catch((error) => {
      console.error('[Service Worker] Background fetch failed:', error)
    })

  // Return cached version immediately if available
  if (cached) {
    console.log('[Service Worker] Serving stale cache:', request.url)
    return cached
  }

  // Wait for network if no cache
  return fetchPromise
}

/**
 * Trim cache to max size (LRU eviction)
 */
async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()

  if (keys.length > maxSize) {
    const toDelete = keys.length - maxSize
    console.log(`[Service Worker] Trimming ${toDelete} entries from ${cacheName}`)

    // Delete oldest entries (first in the array)
    for (let i = 0; i < toDelete; i++) {
      await cache.delete(keys[i])
    }
  }
}

/**
 * Create offline response
 */
function createOfflineResponse() {
  return new Response(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Offline - Asset Forge</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          h1 {
            font-size: 3rem;
            margin: 0 0 1rem 0;
          }
          p {
            font-size: 1.25rem;
            opacity: 0.9;
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

/**
 * Message event - handle cache invalidation requests from client
 */
self.addEventListener('message', (event) => {
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
      getCacheStats().then((stats) => {
        event.ports[0].postMessage({ stats })
      })
      break

    default:
      console.warn('[Service Worker] Unknown message type:', type)
  }
})

/**
 * Invalidate cache entries matching pattern
 */
async function invalidateCache(pattern) {
  const cacheNames = [STATIC_CACHE, API_CACHE, DYNAMIC_CACHE]
  const regex = new RegExp(pattern)

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()

    for (const request of keys) {
      if (regex.test(request.url)) {
        await cache.delete(request)
        console.log('[Service Worker] Invalidated cache:', request.url)
      }
    }
  }
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys()

  await Promise.all(
    cacheNames.map((cacheName) => {
      console.log('[Service Worker] Clearing cache:', cacheName)
      return caches.delete(cacheName)
    })
  )
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  const stats = {
    caches: {},
    totalSize: 0,
    totalEntries: 0
  }

  const cacheNames = [STATIC_CACHE, API_CACHE, DYNAMIC_CACHE]

  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName)
      const keys = await cache.keys()

      stats.caches[cacheName] = {
        entries: keys.length,
        urls: keys.map(req => req.url)
      }
      stats.totalEntries += keys.length
    } catch (error) {
      console.error(`[Service Worker] Failed to get stats for ${cacheName}:`, error)
    }
  }

  return stats
}

console.log('[Service Worker] Loaded')
