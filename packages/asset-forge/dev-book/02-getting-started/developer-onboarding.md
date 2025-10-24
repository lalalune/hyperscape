# Developer Onboarding Guide

> **Get up and running with Asset Forge development in 30 minutes**

Welcome to Asset Forge! This guide will help you set up your development environment, understand the codebase, and make your first contribution.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Key Concepts](#key-concepts)
- [Making Your First Change](#making-your-first-change)
- [Common Tasks](#common-tasks)
- [Getting Help](#getting-help)

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** or **Bun runtime**
- **Git** for version control
- **VS Code** (recommended) or your preferred IDE
- **OpenAI API key** (for AI features)
- **Meshy.ai API key** (for 3D model generation)

---

## Environment Setup

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/hyperscape.git
cd hyperscape

# Navigate to asset-forge
cd packages/asset-forge

# Install dependencies
npm install
# or
bun install
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your API keys
OPENAI_API_KEY=sk-...
MESHY_API_KEY=msy_...
```

Required environment variables:

```env
# AI Services
OPENAI_API_KEY=sk-your-openai-key
MESHY_API_KEY=msy-your-meshy-key

# Server Configuration
PORT=3004
IMAGE_SERVER_PORT=8081

# Optional
NODE_ENV=development
LOG_LEVEL=debug
```

### Step 3: Start Development Server

```bash
# Start both frontend and backend
npm run dev

# Or start separately:
npm run dev:frontend  # Port 3000
npm run dev:backend   # Port 3004 + 8081
```

Visit [http://localhost:3000](http://localhost:3000) to verify everything works.

---

## Project Structure

### High-Level Overview

```
packages/asset-forge/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom hooks
│   ├── store/              # Zustand state stores
│   ├── services/           # Business logic layer
│   ├── utils/              # Utility functions
│   └── types/              # TypeScript type definitions
├── server/                 # Backend source code
│   ├── routes/             # API routes
│   ├── services/           # Backend services
│   ├── middleware/         # Express middleware
│   └── utils/              # Server utilities
├── public/                 # Static assets
│   ├── prompts/            # AI prompt templates
│   └── assets/             # Generated assets storage
├── dev-book/               # Developer documentation
└── tests/                  # Test files
```

### Key Directories

**Frontend:**
- `src/components/` - Reusable UI components
- `src/pages/` - Route-specific page components
- `src/store/` - Global state management
- `src/services/` - Frontend services (API clients, etc.)

**Backend:**
- `server/routes/` - Express route handlers
- `server/services/` - Business logic (AI, asset management)

---

## Development Workflow

### Daily Workflow

1. **Pull latest changes**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```

3. **Make changes**
   - Edit code
   - Test locally
   - Run linter: `npm run lint`

4. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/my-new-feature
   # Create PR on GitHub
   ```

### Code Quality Checks

Before committing:

```bash
# Run linter
npm run lint

# Run type checking
npm run type-check

# Run tests
npm run test

# Build to verify
npm run build
```

---

## Key Concepts

### 1. Request Deduplication

Prevents duplicate concurrent API requests:

```typescript
import { requestDeduplicator } from '@/utils/request-deduplication'

// Automatic deduplication
const data = await requestDeduplicator.deduplicate(
  'assets-list',
  () => fetch('/api/assets')
)
```

**Learn More:** [Request Deduplication](../04-architecture/request-deduplication.md)

### 2. Asset Caching

LRU cache with TTL for frequently-accessed data:

```typescript
import { AssetCacheService } from '@/services/AssetCacheService'

const cache = AssetCacheService.getInstance()

// Check cache first
const cached = cache.get<Asset>('asset-123')
if (cached) return cached

// Fetch and cache
const asset = await fetchAsset('123')
cache.set('asset-123', asset, 'metadata')
```

**Learn More:** [Asset Caching](../04-architecture/asset-caching.md)

### 3. WebGL Renderer Pooling

Share WebGL renderers to avoid context limits:

```typescript
import { useRendererPool } from '@/hooks/useRendererPool'

function ThreeViewer() {
  const { renderer } = useRendererPool({ antialias: true })

  // Use renderer for 3D rendering
  // Automatically released on unmount
}
```

**Learn More:** [Renderer Pooling](../04-architecture/renderer-pooling.md)

### 4. Zustand State Management

Global state with selective subscriptions:

```typescript
import { useAssetsStore } from '@/store/useAssetsStore'

// Only re-render when this specific asset changes
const asset = useAssetsStore(
  state => state.assets.find(a => a.id === id)
)
```

**Learn More:** [State Management](../11-development/state-management.md)

---

## Making Your First Change

Let's add a simple feature to understand the workflow.

### Example: Add Asset Type Filter

**1. Update Store** (`src/store/useAssetsStore.ts`)

```typescript
interface AssetsState {
  // ... existing state
  typeFilter: string | null
  setTypeFilter: (type: string | null) => void
}

export const useAssetsStore = create<AssetsState>((set) => ({
  // ... existing state
  typeFilter: null,
  setTypeFilter: (type) => set({ typeFilter: type })
}))
```

**2. Create Component** (`src/components/Assets/TypeFilter.tsx`)

```typescript
import { useAssetsStore } from '@/store/useAssetsStore'

export function TypeFilter() {
  const { typeFilter, setTypeFilter } = useAssetsStore()

  return (
    <select value={typeFilter || ''} onChange={e => setTypeFilter(e.target.value || null)}>
      <option value="">All Types</option>
      <option value="weapon">Weapons</option>
      <option value="armor">Armor</option>
    </select>
  )
}
```

**3. Use in Page** (`src/pages/AssetsPage.tsx`)

```typescript
import { TypeFilter } from '@/components/Assets/TypeFilter'

export function AssetsPage() {
  const { assets, typeFilter } = useAssetsStore()

  const filteredAssets = typeFilter
    ? assets.filter(a => a.type === typeFilter)
    : assets

  return (
    <div>
      <TypeFilter />
      {filteredAssets.map(asset => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  )
}
```

**4. Test Your Changes**

```bash
# Start dev server
npm run dev

# Visit http://localhost:3000/assets
# Test the filter
```

**5. Commit**

```bash
git add .
git commit -m "feat: add asset type filter"
```

---

## Common Tasks

### Adding a New API Endpoint

**1. Create Route** (`server/routes/myFeature.mjs`)

```javascript
import express from 'express'

const router = express.Router()

router.get('/my-feature', async (req, res) => {
  try {
    const data = await myService.getData()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
```

**2. Register Route** (`server/api.mjs`)

```javascript
import myFeatureRoutes from './routes/myFeature.mjs'

app.use('/api/my-feature', myFeatureRoutes)
```

### Adding a New Component

**1. Create Component** (`src/components/MyFeature/MyComponent.tsx`)

```typescript
import React from 'react'

export function MyComponent({ data }: { data: any }) {
  return (
    <div className="my-component">
      <h2>{data.title}</h2>
      <p>{data.description}</p>
    </div>
  )
}
```

**2. Add Tests** (`src/components/MyFeature/__tests__/MyComponent.test.tsx`)

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  it('renders title and description', () => {
    const data = { title: 'Test', description: 'Description' }
    render(<MyComponent data={data} />)

    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
  })
})
```

### Adding a Custom Hook

**1. Create Hook** (`src/hooks/useMyFeature.ts`)

```typescript
import { useState, useEffect } from 'react'

export function useMyFeature(id: string) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData(id)
      .then(setData)
      .finally(() => setLoading(false))
  }, [id])

  return { data, loading }
}
```

**2. Document Hook** (in `dev-book/12-api-reference/hooks-reference.md`)

---

## Code Style Guide

### TypeScript

```typescript
// ✅ Good
interface AssetData {
  id: string
  name: string
  type: AssetType
}

function processAsset(asset: AssetData): ProcessedAsset {
  // ...
}

// ❌ Bad
function processAsset(asset: any): any {
  // ...
}
```

### React Components

```typescript
// ✅ Good: Named export, typed props
interface AssetCardProps {
  asset: Asset
  onClick?: () => void
}

export function AssetCard({ asset, onClick }: AssetCardProps) {
  return <div onClick={onClick}>{asset.name}</div>
}

// ❌ Bad: Default export, untyped props
export default function AssetCard(props) {
  return <div>{props.asset.name}</div>
}
```

### Logging

```typescript
// ✅ Good: Use logger utility
import { createLogger } from '@/utils/logger'

const logger = createLogger('MyComponent')
logger.info('Action performed', { id: asset.id })

// ❌ Bad: Use console directly
console.log('Action performed')
```

---

## Getting Help

### Documentation

- **Architecture:** [Architecture Overview](../04-architecture/system-overview.md)
- **API Reference:** [REST API](../12-api-reference/rest-api.md)
- **Testing:** [Testing Strategy](../13-testing/testing-strategy.md)

### Common Issues

**Issue: WebGL Context Errors**
- Solution: Use `useRendererPool` hook instead of creating renderers manually
- See: [Renderer Pooling](../04-architecture/renderer-pooling.md)

**Issue: Slow Page Loads**
- Solution: Check cache hit rates and request deduplication stats
- See: [Performance Architecture](../04-architecture/performance-architecture.md)

**Issue: TypeScript Errors**
- Solution: Run `npm run type-check` and fix reported errors
- Avoid using `any` types

### Getting Support

1. **Check Documentation** - Search dev-book for answers
2. **Ask in Slack** - #asset-forge-dev channel
3. **Create GitHub Issue** - For bugs or feature requests
4. **Pair Programming** - Ask senior devs for pairing session

---

## Next Steps

After completing this guide:

1. **Read Architecture Docs** - Understand core systems
2. **Review Existing Code** - Study well-written components
3. **Pick a Good First Issue** - Look for "good first issue" label
4. **Ask Questions** - Don't hesitate to ask for help!

### Recommended Reading

- [Performance Best Practices](../11-development/performance-best-practices.md)
- [Code Quality Standards](../11-development/code-quality-standards.md)
- [Component Patterns](../11-development/component-patterns.md)
- [Testing Guide](../13-testing/testing-strategy.md)

---

Welcome to the team! 🎉

---

**Last Updated:** 2025-10-24
**Version:** 1.0.0
