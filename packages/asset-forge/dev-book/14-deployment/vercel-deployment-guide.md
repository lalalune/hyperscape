# Vercel Deployment Guide

Complete guide for deploying Asset Forge to Vercel while maintaining access to in-game manifests and shared authentication.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Options](#architecture-options)
3. [Recommended Solution](#recommended-solution)
4. [Implementation Steps](#implementation-steps)
5. [Environment Configuration](#environment-configuration)
6. [Manifest Access Strategy](#manifest-access-strategy)
7. [Authentication Setup](#authentication-setup)
8. [Data Persistence](#data-persistence)
9. [Deployment Checklist](#deployment-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Asset Forge deployment to Vercel requires addressing three critical challenges:

### Current Architecture

- **Database**: SQLite (`data/asset-forge.db` locally, `/tmp/asset-forge.db` on Vercel)
- **Manifests**: Stored in `/packages/server/.assets-repo/manifests/`
- **Authentication**: Privy (requires `PRIVY_APP_ID` and `PRIVY_APP_SECRET`)
- **Build**: Static frontend (`dist/`) + serverless backend (`api/index.mjs`)

### Deployment Challenges

1. **Manifest Access**: Manifests are in separate `server` package
2. **Data Persistence**: SQLite `/tmp/` storage is ephemeral on Vercel
3. **Authentication**: Need to share Privy credentials between packages

---

## Architecture Options

### Option A: Manifest API Proxy (Recommended)

**Description**: Create API endpoint in server package that serves manifests to Asset Forge

**Pros**:
- ✅ Single source of truth for manifests
- ✅ Always uses current in-game data
- ✅ No duplication or sync issues
- ✅ Easy to update manifests (one location)
- ✅ Server can cache manifests for performance

**Cons**:
- ⚠️ Requires network calls to server package
- ⚠️ Asset Forge depends on server availability
- ⚠️ Potential latency for manifest fetching

**Use Case**: When Asset Forge must always use current in-game manifests

---

### Option B: Build-Time Manifest Copy

**Description**: Copy manifests to Asset Forge during build process

**Pros**:
- ✅ No runtime dependencies on server package
- ✅ Fast manifest access (local files)
- ✅ Works offline after initial load
- ✅ Simple implementation

**Cons**:
- ❌ Manifests can become stale (requires rebuild)
- ❌ Data duplication between packages
- ❌ Must rebuild Asset Forge when manifests change

**Use Case**: When manifests are relatively static and infrequent updates are acceptable

---

### Option C: Shared Vercel Blob Storage

**Description**: Store manifests in Vercel Blob, accessible by both packages

**Pros**:
- ✅ Single source of truth
- ✅ No duplication
- ✅ CDN-backed (fast access)
- ✅ Version control possible

**Cons**:
- ⚠️ Additional infrastructure (Blob storage)
- ⚠️ Upload process for manifest updates
- ⚠️ Potential cost for storage/bandwidth

**Use Case**: When both packages are deployed to Vercel and need real-time manifest access

---

## Recommended Solution

**Option A: Manifest API Proxy** is recommended because:

1. Ensures Asset Forge always uses current in-game manifests
2. Single source of truth (no sync issues)
3. Server package already deployed and available
4. Simple implementation with caching

### Architecture Diagram

```
┌─────────────────────┐
│   Asset Forge       │
│   (Vercel)          │
│                     │
│  ┌───────────────┐  │
│  │  Frontend     │  │
│  │  (React)      │  │
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │  API Handler  │  │
│  │  (Serverless) │  │
│  └───────┬───────┘  │
└──────────┼──────────┘
           │
           │ HTTP Request
           │ GET /api/manifests/{type}.json
           │
           ▼
┌─────────────────────┐
│   Server Package    │
│   (Deployed)        │
│                     │
│  ┌───────────────┐  │
│  │  Manifest API │  │
│  │  Endpoint     │  │
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │  Manifests    │  │
│  │  .assets-repo │  │
│  └───────────────┘  │
└─────────────────────┘
```

---

## Implementation Steps

### Step 1: Add Manifest API Endpoint to Server Package

Create a new endpoint in the server package to serve manifests:

```javascript
// packages/server/routes/manifests.mjs

import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MANIFESTS_DIR = path.join(__dirname, '../../.assets-repo/manifests')

const router = express.Router()

/**
 * GET /api/manifests/:type.json
 * Serve manifest files from .assets-repo
 */
router.get('/:type.json', async (req, res) => {
  const { type } = req.params

  // Validate manifest type
  const validTypes = [
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

  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid manifest type: ${type}` })
  }

  try {
    const manifestPath = path.join(MANIFESTS_DIR, `${type}.json`)
    const manifestData = await fs.readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(manifestData)

    // Set cache headers (5 minutes)
    res.set({
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/json'
    })

    res.json(manifest)
  } catch (error) {
    console.error(`Error loading manifest ${type}:`, error)
    res.status(500).json({ error: 'Failed to load manifest' })
  }
})

/**
 * GET /api/manifests/all
 * Return all manifests in a single request
 */
router.get('/all', async (req, res) => {
  const validTypes = [
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

  try {
    const manifests = {}

    await Promise.all(
      validTypes.map(async (type) => {
        const manifestPath = path.join(MANIFESTS_DIR, `${type}.json`)
        const manifestData = await fs.readFile(manifestPath, 'utf-8')
        manifests[type] = JSON.parse(manifestData)
      })
    )

    // Set cache headers (5 minutes)
    res.set({
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/json'
    })

    res.json(manifests)
  } catch (error) {
    console.error('Error loading manifests:', error)
    res.status(500).json({ error: 'Failed to load manifests' })
  }
})

export default router
```

Add to server's main API file:

```javascript
// packages/server/api.mjs

import manifestRoutes from './routes/manifests.mjs'

// ... existing imports ...

app.use('/api/manifests', manifestRoutes)
```

---

### Step 2: Configure Asset Forge ManifestService

The existing `ManifestService` is already configured to fetch from `/api/manifests/`, but we need to update the API URL to point to the server package:

```typescript
// packages/asset-forge/src/services/ManifestService.ts

const getApiUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // Use server package URL in production
    return import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3004/api'
  }
  return process.env.VITE_SERVER_API_URL || 'http://localhost:3004/api'
}

const API_URL = getApiUrl()
const MANIFESTS_BASE_URL = `${API_URL}/manifests`
```

---

### Step 3: Update Environment Variables

Add new environment variable for server API URL:

```bash
# packages/asset-forge/.env

# Server API URL (for manifests)
VITE_SERVER_API_URL=https://your-server-domain.com/api

# OR if server is on same Vercel account
VITE_SERVER_API_URL=https://server.vercel.app/api
```

---

## Environment Configuration

### Required Environment Variables for Vercel

Configure these in Vercel dashboard (Project → Settings → Environment Variables):

#### Authentication (Required)
```bash
# Privy credentials (same as server package)
PRIVY_APP_ID=priv_xxxxx
PRIVY_APP_SECRET=priv_secret_xxxxx

# Public Privy ID (frontend)
VITE_PUBLIC_PRIVY_APP_ID=priv_xxxxx
```

#### Security (Required)
```bash
# JWT and encryption (generate with: openssl rand -base64 32)
JWT_SECRET=your_32_char_minimum_secret_here
ENCRYPTION_KEY=your_32_char_minimum_secret_here

# Cron job security
CRON_SECRET=your_cron_secret_here
```

#### AI Services (Required for generation features)
```bash
# Server-side only - NO VITE_ prefix
MESHY_API_KEY=msy_xxxxx
OPENAI_API_KEY=sk-xxxxx
ELEVENLABS_API_KEY=xi_xxxxx  # Optional, for voice
```

#### Storage (Required)
```bash
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxx
USE_BLOB_STORAGE=true
```

#### API URLs
```bash
# Server package URL (for manifests)
VITE_SERVER_API_URL=https://your-server-domain.com/api

# Frontend URL (for CORS)
FRONTEND_URL=https://asset-forge.vercel.app

# Asset Forge internal API
VITE_API_URL=/api
VITE_GENERATION_API_URL=/api
```

#### Optional Configuration
```bash
# Database (ephemeral on Vercel)
DATABASE_PATH=/tmp/asset-forge.db

# AI model settings
MESHY_MODEL_DEFAULT=meshy-5
IMAGE_MODEL=dall-e-3

# Node environment
NODE_ENV=production
```

---

## Manifest Access Strategy

### How It Works

1. **Asset Forge ManifestService** calls `/api/manifests/{type}.json`
2. **Request is routed** to Asset Forge's serverless function
3. **Serverless function proxies** request to server package API
4. **Server package** reads manifest from `.assets-repo/manifests/`
5. **Response is cached** (5 minutes) for performance
6. **Asset Forge receives** current in-game manifest data

### Caching Strategy

**Client-Side (Asset Forge)**:
- ManifestService already has in-memory cache
- IndexedDB cache for offline support (5 minutes TTL)
- Service worker cache for performance

**Server-Side (Server Package)**:
- HTTP `Cache-Control: public, max-age=300` (5 minutes)
- CDN edge caching (if using Vercel Edge Network)

### Performance Optimization

```typescript
// packages/asset-forge/src/services/ManifestService.ts

export class ManifestService {
  private cache: Map<ManifestType, AnyManifest[]> = new Map()
  private cacheTimestamps: Map<ManifestType, number> = new Map()
  private cacheTTL = 5 * 60 * 1000 // 5 minutes

  async fetchManifest<T extends AnyManifest>(type: ManifestType): Promise<T[]> {
    // Check cache validity
    const cachedTime = this.cacheTimestamps.get(type)
    if (this.cache.has(type) && cachedTime) {
      const age = Date.now() - cachedTime
      if (age < this.cacheTTL) {
        return this.cache.get(type) as T[]
      }
    }

    // Fetch from server (with request deduplication)
    const response = await apiFetch(`${MANIFESTS_BASE_URL}/${type}.json`)
    const data = await response.json()
    const manifestData = Array.isArray(data) ? data : Object.values(data)

    // Update cache
    this.cache.set(type, manifestData as AnyManifest[])
    this.cacheTimestamps.set(type, Date.now())

    return manifestData as T[]
  }

  /**
   * Force refresh all manifests
   */
  async refreshAll(): Promise<void> {
    this.cache.clear()
    this.cacheTimestamps.clear()
    await this.fetchAllManifests()
  }
}
```

---

## Authentication Setup

### Shared Privy Configuration

Both Asset Forge and server package can use the **same Privy app credentials**:

1. **Create Privy App** (if not already created):
   - Go to [https://privy.io](https://privy.io)
   - Create account and new app
   - Note your `PRIVY_APP_ID` and `PRIVY_APP_SECRET`

2. **Configure Privy App**:
   - Add both domains to allowed origins:
     - `https://asset-forge.vercel.app`
     - `https://your-server-domain.com`
   - Enable desired auth methods (wallet, email, social)

3. **Set Environment Variables**:
   - Both packages use same `PRIVY_APP_ID` and `PRIVY_APP_SECRET`
   - Users authenticated in either package are recognized in both

### Authentication Flow

```
┌─────────────────┐
│  User visits    │
│  Asset Forge    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Privy Login    │
│  (Frontend)     │
└────────┬────────┘
         │
         │ Access Token
         │
         ▼
┌─────────────────┐
│  Asset Forge    │
│  Serverless     │
│  Function       │
└────────┬────────┘
         │
         │ verifyPrivyToken()
         │
         ▼
┌─────────────────┐
│  Privy API      │
│  Verification   │
└────────┬────────┘
         │
         │ User Info
         │
         ▼
┌─────────────────┐
│  SQLite DB      │
│  (Asset Forge)  │
└─────────────────┘
```

### Important Notes

- **User data is isolated**: Each package maintains its own user database
- **Same Privy ID**: Users have same `privyUserId` across both packages
- **Session management**: Each package handles its own sessions/JWTs
- **Admin whitelist**: Admin whitelist is package-specific (can sync if needed)

---

## Data Persistence

### Challenge: Ephemeral SQLite on Vercel

Vercel serverless functions have ephemeral `/tmp/` storage that **resets on each deployment**.

### Solutions

#### Option 1: Accept Ephemeral Nature (Recommended for MVP)

**Use Case**: Session data, temporary generation state

**Implementation**:
- Keep SQLite for session storage and temporary data
- Use Vercel Blob for persistent assets (already implemented)
- User accounts stored in SQLite are recreated on first login after deploy

**Pros**:
- ✅ No migration needed
- ✅ Simple architecture
- ✅ Blob storage already handles persistent assets

**Cons**:
- ❌ User preferences lost on redeploy
- ❌ Generation history lost on redeploy
- ❌ API keys lost on redeploy

---

#### Option 2: Migrate to Vercel Postgres

**Use Case**: Production deployment with persistent user data

**Implementation**:

1. **Provision Vercel Postgres**:
```bash
vercel postgres create
```

2. **Update database configuration**:
```javascript
// packages/asset-forge/server/db/index.mjs

import { drizzle } from 'drizzle-orm/vercel-postgres'
import { sql } from '@vercel/postgres'

// Use Postgres in production, SQLite in development
const isProd = process.env.NODE_ENV === 'production'

export const db = isProd
  ? drizzle(sql)
  : drizzle(new Database(DB_PATH))
```

3. **Run migrations**:
```bash
npx drizzle-kit push:pg
```

**Pros**:
- ✅ Persistent data across deployments
- ✅ Better concurrency than SQLite
- ✅ Integrated with Vercel

**Cons**:
- ⚠️ Additional cost (Vercel Postgres pricing)
- ⚠️ Migration effort required
- ⚠️ Different local vs production databases

---

#### Option 3: Use Server Package's PostgreSQL

**Use Case**: Shared user accounts and data between packages

**Implementation**:

1. **Expose user API from server package**:
```javascript
// packages/server/routes/users.mjs

router.get('/users/:privyUserId', async (req, res) => {
  const user = await getUserByPrivyId(req.params.privyUserId)
  res.json(user)
})

router.post('/users', async (req, res) => {
  const user = await createUser(req.body)
  res.json(user)
})
```

2. **Asset Forge calls server package for user data**:
```typescript
// packages/asset-forge/server/services/UserService.mjs

export async function getOrCreateUser(privyUserInfo) {
  const response = await fetch(
    `${process.env.SERVER_API_URL}/users/${privyUserInfo.privyUserId}`
  )

  if (response.ok) {
    return await response.json()
  }

  // Create new user
  const createResponse = await fetch(
    `${process.env.SERVER_API_URL}/users`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(privyUserInfo)
    }
  )

  return await createResponse.json()
}
```

**Pros**:
- ✅ Shared user accounts across packages
- ✅ Single source of truth for user data
- ✅ No additional database needed

**Cons**:
- ⚠️ Asset Forge depends on server availability
- ⚠️ Increased coupling between packages
- ⚠️ More complex error handling

---

### Recommended Data Strategy

**Hybrid Approach**:
1. **Ephemeral SQLite**: For session storage and temporary generation state
2. **Vercel Blob**: For persistent assets (already implemented)
3. **Server Package API**: For shared manifest data
4. **Optional Vercel Postgres**: If persistent user data needed later

---

## Deployment Checklist

### Pre-Deployment

- [ ] **Environment Variables Configured**
  - [ ] `PRIVY_APP_ID` and `PRIVY_APP_SECRET`
  - [ ] `VITE_PUBLIC_PRIVY_APP_ID`
  - [ ] `JWT_SECRET` and `ENCRYPTION_KEY` (32+ chars)
  - [ ] `BLOB_READ_WRITE_TOKEN`
  - [ ] `MESHY_API_KEY` and `OPENAI_API_KEY`
  - [ ] `VITE_SERVER_API_URL` (points to server package)
  - [ ] `FRONTEND_URL` (Asset Forge domain)

- [ ] **Server Package API**
  - [ ] Manifest endpoint deployed (`/api/manifests/:type.json`)
  - [ ] CORS configured to allow Asset Forge domain
  - [ ] Cache headers configured (5 minutes)

- [ ] **Privy Configuration**
  - [ ] Asset Forge domain added to allowed origins
  - [ ] Auth methods enabled (wallet, email, etc.)
  - [ ] Redirect URLs configured

- [ ] **Build Configuration**
  - [ ] `vercel.json` configured correctly
  - [ ] Build command: `npm run build`
  - [ ] Output directory: `dist`
  - [ ] Functions configuration (memory, timeout)

### Deployment

1. **Install Vercel CLI** (if not already):
```bash
npm i -g vercel
```

2. **Link Project**:
```bash
cd packages/asset-forge
vercel link
```

3. **Set Environment Variables**:
```bash
# Add all environment variables via Vercel dashboard
# OR use Vercel CLI:
vercel env add PRIVY_APP_ID
vercel env add PRIVY_APP_SECRET
# ... etc
```

4. **Deploy**:
```bash
vercel --prod
```

### Post-Deployment

- [ ] **Test Manifest Access**
  - [ ] Navigate to Assets page
  - [ ] Verify manifests load from server package
  - [ ] Check network tab for manifest API calls

- [ ] **Test Authentication**
  - [ ] Log in with Privy
  - [ ] Verify JWT token issued
  - [ ] Check user created in database

- [ ] **Test Generation**
  - [ ] Generate test asset
  - [ ] Verify AI APIs work
  - [ ] Check asset saved to Blob storage

- [ ] **Monitor Performance**
  - [ ] Check Vercel Analytics
  - [ ] Monitor API response times
  - [ ] Check error logs

---

## Troubleshooting

### Issue: Manifests Not Loading

**Symptoms**:
- Assets page shows "Failed to load manifests"
- Network tab shows 404 or 500 errors

**Solutions**:
1. Verify `VITE_SERVER_API_URL` is correct
2. Check server package manifest endpoint is deployed
3. Verify CORS headers allow Asset Forge domain
4. Check server package logs for errors

---

### Issue: Authentication Fails

**Symptoms**:
- Privy login redirects fail
- "Invalid token" errors
- User not created in database

**Solutions**:
1. Verify `PRIVY_APP_ID` and `PRIVY_APP_SECRET` match
2. Check Privy dashboard for allowed origins
3. Verify `VITE_PUBLIC_PRIVY_APP_ID` matches backend
4. Check JWT_SECRET is set and valid

---

### Issue: Generation Fails

**Symptoms**:
- "Missing API key" errors
- AI generation returns 500 errors

**Solutions**:
1. Verify `MESHY_API_KEY` and `OPENAI_API_KEY` are set
2. Check API keys are valid and have credits
3. Ensure keys DO NOT have `VITE_` prefix (server-side only)
4. Check serverless function logs for errors

---

### Issue: Data Lost on Redeploy

**Symptoms**:
- User accounts disappear after deployment
- Generation history lost
- API keys reset

**Expected Behavior**:
- SQLite `/tmp/` storage is ephemeral on Vercel
- Users will need to log in again (Privy will recreate account)
- Generate new API keys after deployment

**Long-term Solution**:
- Migrate to Vercel Postgres (see [Option 2](#option-2-migrate-to-vercel-postgres))

---

### Issue: Slow Manifest Loading

**Symptoms**:
- Assets page takes 5+ seconds to load
- Manifest API calls are slow

**Solutions**:
1. Enable caching on server package manifest endpoint
2. Use Vercel Edge Network for CDN caching
3. Implement prefetching in Asset Forge
4. Consider `/api/manifests/all` endpoint for single request

---

## Additional Resources

- [Vercel Deployment Documentation](https://vercel.com/docs/deployments/overview)
- [Privy Authentication Guide](https://docs.privy.io/guide/quickstart)
- [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Asset Forge Architecture](../04-architecture/system-overview.md)

---

**Back to**: [README](../README.md) | **Previous**: [Environment Setup](./environment-setup.md) | **Next**: [Monitoring](./monitoring.md)
