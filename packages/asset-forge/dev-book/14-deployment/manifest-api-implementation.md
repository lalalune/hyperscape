# Manifest API Implementation Guide

Reference implementation for serving game manifests from the server package to Asset Forge.

---

## Overview

This guide provides the complete implementation for exposing manifests from the server package via a REST API endpoint that Asset Forge can consume.

---

## Server Package Implementation

### Step 1: Create Manifest Routes File

Create `/packages/server/routes/manifests.mjs`:

```javascript
/**
 * Manifest API Routes
 * Serves game data manifests to Asset Forge and other clients
 */

import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to manifests directory
const MANIFESTS_DIR = path.join(__dirname, '../../.assets-repo/manifests')

const router = express.Router()

// Valid manifest types
const VALID_MANIFEST_TYPES = [
  'items',
  'mobs',
  'npcs',
  'resources',
  'world-areas',
  'biomes',
  'zones',
  'banks',
  'stores'
]

/**
 * In-memory cache for manifests
 * Reduces file system reads
 */
const manifestCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Load and cache a manifest file
 */
async function loadManifest(type) {
  // Check cache
  const cached = manifestCache.get(type)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  // Load from filesystem
  const manifestPath = path.join(MANIFESTS_DIR, `${type}.json`)
  const manifestData = await fs.readFile(manifestPath, 'utf-8')
  const manifest = JSON.parse(manifestData)

  // Update cache
  manifestCache.set(type, {
    data: manifest,
    timestamp: Date.now()
  })

  return manifest
}

/**
 * GET /api/manifests/:type.json
 * Serve a specific manifest file
 *
 * @example GET /api/manifests/items.json
 * @example GET /api/manifests/mobs.json
 */
router.get('/:type.json', async (req, res) => {
  const { type } = req.params

  // Validate manifest type
  if (!VALID_MANIFEST_TYPES.includes(type)) {
    return res.status(400).json({
      error: 'Invalid manifest type',
      message: `Type must be one of: ${VALID_MANIFEST_TYPES.join(', ')}`,
      validTypes: VALID_MANIFEST_TYPES
    })
  }

  try {
    const manifest = await loadManifest(type)

    // Set cache headers for CDN and browser caching
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'Content-Type': 'application/json',
      'X-Manifest-Type': type,
      'X-Manifest-Count': Array.isArray(manifest)
        ? manifest.length
        : Object.keys(manifest).length
    })

    res.json(manifest)
  } catch (error) {
    console.error(`[Manifests] Error loading ${type}:`, error)

    // Return appropriate error
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        error: 'Manifest not found',
        message: `Manifest file for type "${type}" does not exist`
      })
    }

    res.status(500).json({
      error: 'Failed to load manifest',
      message: error.message
    })
  }
})

/**
 * GET /api/manifests/all
 * Return all manifests in a single request
 * Useful for bulk loading
 *
 * @example GET /api/manifests/all
 */
router.get('/all', async (req, res) => {
  try {
    const manifests = {}

    // Load all manifests in parallel
    await Promise.all(
      VALID_MANIFEST_TYPES.map(async (type) => {
        try {
          manifests[type] = await loadManifest(type)
        } catch (error) {
          console.error(`[Manifests] Error loading ${type}:`, error)
          manifests[type] = null // Mark as failed
        }
      })
    )

    // Calculate total count
    const totalCount = Object.values(manifests).reduce((sum, manifest) => {
      if (!manifest) return sum
      return sum + (Array.isArray(manifest) ? manifest.length : Object.keys(manifest).length)
    }, 0)

    // Set cache headers
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'Content-Type': 'application/json',
      'X-Manifest-Total-Count': totalCount,
      'X-Manifest-Types': VALID_MANIFEST_TYPES.length
    })

    res.json({
      manifests,
      metadata: {
        totalCount,
        types: VALID_MANIFEST_TYPES,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Manifests] Error loading all manifests:', error)
    res.status(500).json({
      error: 'Failed to load manifests',
      message: error.message
    })
  }
})

/**
 * GET /api/manifests/metadata
 * Return metadata about available manifests without loading full data
 *
 * @example GET /api/manifests/metadata
 */
router.get('/metadata', async (req, res) => {
  try {
    const metadata = await Promise.all(
      VALID_MANIFEST_TYPES.map(async (type) => {
        try {
          const manifestPath = path.join(MANIFESTS_DIR, `${type}.json`)
          const stats = await fs.stat(manifestPath)
          const manifest = await loadManifest(type)

          return {
            type,
            exists: true,
            size: stats.size,
            modified: stats.mtime,
            count: Array.isArray(manifest)
              ? manifest.length
              : Object.keys(manifest).length
          }
        } catch (error) {
          return {
            type,
            exists: false,
            error: error.message
          }
        }
      })
    )

    res.set({
      'Cache-Control': 'public, max-age=60', // 1 minute
      'Content-Type': 'application/json'
    })

    res.json({
      manifests: metadata,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Manifests] Error getting metadata:', error)
    res.status(500).json({
      error: 'Failed to get manifest metadata',
      message: error.message
    })
  }
})

/**
 * POST /api/manifests/invalidate-cache
 * Clear the manifest cache
 * Useful after updating manifest files
 *
 * @example POST /api/manifests/invalidate-cache
 */
router.post('/invalidate-cache', (req, res) => {
  const previousSize = manifestCache.size
  manifestCache.clear()

  console.log(`[Manifests] Cache cleared (${previousSize} items)`)

  res.json({
    message: 'Manifest cache invalidated',
    clearedCount: previousSize,
    timestamp: new Date().toISOString()
  })
})

export default router
```

---

### Step 2: Register Routes in Server API

Add manifest routes to `/packages/server/api.mjs`:

```javascript
// packages/server/api.mjs

import manifestRoutes from './routes/manifests.mjs'

// ... existing imports ...

const app = express()

// ... existing middleware ...

// Register manifest routes
app.use('/api/manifests', manifestRoutes)

// ... rest of server setup ...
```

---

### Step 3: Configure CORS

Ensure Asset Forge domain is allowed:

```javascript
// packages/server/api.mjs

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL, // Main server frontend
  process.env.ASSET_FORGE_URL, // Asset Forge URL
  'http://localhost:5173', // Local development
  'http://localhost:3000'
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))
```

Add environment variable:

```bash
# packages/server/.env

ASSET_FORGE_URL=https://asset-forge.vercel.app
```

---

## Asset Forge Integration

### Step 1: Update ManifestService

No changes needed! The existing `ManifestService` already supports this:

```typescript
// packages/asset-forge/src/services/ManifestService.ts

const getApiUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // This will now point to server package
    return import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3004/api'
  }
  return process.env.VITE_SERVER_API_URL || 'http://localhost:3004/api'
}

const API_URL = getApiUrl()
const MANIFESTS_BASE_URL = `${API_URL}/manifests`

export class ManifestService {
  async fetchManifest<T extends AnyManifest>(type: ManifestType): Promise<T[]> {
    // Already uses correct endpoint format
    const response = await apiFetch(`${MANIFESTS_BASE_URL}/${type}.json`)
    // ... rest of implementation
  }
}
```

---

### Step 2: Configure Environment Variable

Add to `/packages/asset-forge/.env`:

```bash
# Server API URL for manifest fetching
VITE_SERVER_API_URL=https://your-server-domain.com/api
```

Or in Vercel dashboard:
- Variable: `VITE_SERVER_API_URL`
- Value: `https://your-server-domain.com/api`

---

### Step 3: Optional - Bulk Loading

For better performance, you can load all manifests at once:

```typescript
// packages/asset-forge/src/services/ManifestService.ts

export class ManifestService {
  /**
   * Fetch all manifests in a single request
   * More efficient than individual requests
   */
  async fetchAllManifestsOptimized(): Promise<Record<ManifestType, AnyManifest[]>> {
    try {
      const response = await apiFetch(`${MANIFESTS_BASE_URL}/all`)
      const { manifests } = await response.json()

      // Cache all manifests
      Object.entries(manifests).forEach(([type, data]) => {
        if (data) {
          this.cache.set(type as ManifestType, data as AnyManifest[])
          this.cacheTimestamps.set(type as ManifestType, Date.now())
        }
      })

      return manifests as Record<ManifestType, AnyManifest[]>
    } catch (error) {
      logger.error('Error fetching all manifests', error)
      // Fallback to individual requests
      return this.fetchAllManifests()
    }
  }
}
```

---

## Testing

### Test Server Manifest Endpoint

```bash
# Test individual manifest
curl https://your-server-domain.com/api/manifests/items.json

# Test all manifests
curl https://your-server-domain.com/api/manifests/all

# Test metadata
curl https://your-server-domain.com/api/manifests/metadata

# Clear cache
curl -X POST https://your-server-domain.com/api/manifests/invalidate-cache
```

---

### Test Asset Forge Integration

1. **Set environment variable**:
```bash
# In Asset Forge .env
VITE_SERVER_API_URL=https://your-server-domain.com/api
```

2. **Run Asset Forge locally**:
```bash
cd packages/asset-forge
npm run dev
```

3. **Navigate to Assets page** and check:
   - Network tab shows requests to server domain
   - Manifests load successfully
   - No CORS errors

4. **Check caching**:
   - Refresh page - should use cached manifests
   - Wait 5 minutes - should refetch from server

---

## Performance Optimization

### Server-Side Caching

The implementation includes in-memory caching:

```javascript
const manifestCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function loadManifest(type) {
  const cached = manifestCache.get(type)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data // Return from cache
  }
  // Load from filesystem and cache
}
```

---

### HTTP Caching

Response includes cache headers:

```javascript
res.set({
  'Cache-Control': 'public, max-age=300', // 5 minutes
  'Content-Type': 'application/json'
})
```

This enables:
- **CDN caching** (if using Vercel Edge Network)
- **Browser caching** (reduces requests)
- **Proxy caching** (improves performance)

---

### Client-Side Caching

Asset Forge already implements:
- **In-memory cache** (ManifestService)
- **IndexedDB cache** (5 minutes TTL)
- **Service worker cache** (offline support)

---

## Monitoring

### Server Logs

Monitor manifest API usage:

```javascript
// Add logging middleware
router.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`[Manifests] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`)
  })
  next()
})
```

---

### Vercel Analytics

Monitor in Vercel dashboard:
- Request count per endpoint
- Response times
- Error rates
- Cache hit rates

---

## Cache Invalidation

### Manual Cache Clear

When manifests are updated:

```bash
curl -X POST https://your-server-domain.com/api/manifests/invalidate-cache
```

---

### Automatic Cache Clear

Add to manifest update script:

```javascript
// packages/server/scripts/update-manifests.mjs

async function updateManifests() {
  // Update manifest files
  await fs.writeFile('manifests/items.json', JSON.stringify(items))

  // Clear cache
  await fetch('http://localhost:3004/api/manifests/invalidate-cache', {
    method: 'POST'
  })

  console.log('Manifests updated and cache cleared')
}
```

---

### Asset Forge Cache Refresh

Allow users to manually refresh:

```typescript
// packages/asset-forge/src/components/Assets/AssetFilters.tsx

function RefreshManifestsButton() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await manifestService.refreshAll()
    setIsRefreshing(false)
    // Notify user
  }

  return (
    <button onClick={handleRefresh} disabled={isRefreshing}>
      {isRefreshing ? 'Refreshing...' : 'Refresh Manifests'}
    </button>
  )
}
```

---

## Security Considerations

### Rate Limiting

Add rate limiting to prevent abuse:

```javascript
import rateLimit from 'express-rate-limit'

const manifestRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many manifest requests, please try again later'
})

router.use(manifestRateLimiter)
```

---

### Authentication (Optional)

Require authentication for manifest access:

```javascript
import { optionalAuth } from '../middleware/auth.mjs'

// Allow authenticated and unauthenticated access
router.get('/:type.json', optionalAuth, async (req, res) => {
  // Log user if authenticated
  if (req.user) {
    console.log(`[Manifests] User ${req.user.id} accessed ${req.params.type}`)
  }
  // ... rest of handler
})
```

---

### CORS Protection

Restrict to known origins:

```javascript
const ALLOWED_ORIGINS = [
  process.env.ASSET_FORGE_URL,
  'http://localhost:5173'
]

// Only allow specific origins
app.use('/api/manifests', cors({
  origin: ALLOWED_ORIGINS,
  credentials: false // Public data, no credentials needed
}))
```

---

## Error Handling

### Graceful Degradation

Handle server unavailability:

```typescript
// packages/asset-forge/src/services/ManifestService.ts

async fetchManifest<T extends AnyManifest>(type: ManifestType): Promise<T[]> {
  try {
    const response = await apiFetch(`${MANIFESTS_BASE_URL}/${type}.json`, {
      timeout: 10000 // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`)
    }

    const data = await response.json()
    return Array.isArray(data) ? data : Object.values(data)
  } catch (error) {
    logger.error(`Error fetching ${type} manifest from server`, error)

    // Fallback to cached data if available
    if (this.cache.has(type)) {
      logger.warn(`Using stale cache for ${type} manifest`)
      return this.cache.get(type) as T[]
    }

    // Last resort: return empty array
    logger.error(`No cache available for ${type}, returning empty array`)
    return []
  }
}
```

---

## Deployment Checklist

### Server Package

- [ ] Manifest routes file created (`routes/manifests.mjs`)
- [ ] Routes registered in main API (`api.mjs`)
- [ ] CORS configured for Asset Forge domain
- [ ] Environment variable `ASSET_FORGE_URL` set
- [ ] Deployed to production
- [ ] Test manifest endpoints accessible

### Asset Forge

- [ ] Environment variable `VITE_SERVER_API_URL` set (Vercel dashboard)
- [ ] Test manifest loading in development
- [ ] Deploy to Vercel
- [ ] Verify manifests load from server in production
- [ ] Check cache headers in network tab

---

## Troubleshooting

### Manifests Not Loading

1. Check `VITE_SERVER_API_URL` is correct
2. Verify server endpoint returns 200 OK
3. Check CORS headers allow Asset Forge domain
4. Inspect network tab for error details

### CORS Errors

1. Add Asset Forge URL to `ALLOWED_ORIGINS`
2. Verify `ASSET_FORGE_URL` environment variable
3. Check server CORS middleware configuration
4. Clear browser cache and retry

### Slow Loading

1. Verify cache headers are set (5 minutes)
2. Check CDN caching is enabled
3. Monitor server response times
4. Consider using `/api/manifests/all` for bulk loading

---

**Back to**: [Vercel Deployment Guide](./vercel-deployment-guide.md) | [README](../README.md)
