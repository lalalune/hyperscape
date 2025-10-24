# Optimization Patterns

> **Proven patterns for performance optimization in Asset Forge**

This document catalogs optimization patterns used throughout Asset Forge, providing reusable solutions for common performance challenges.

---

## Table of Contents

- [React Optimization Patterns](#react-optimization-patterns)
- [State Management Patterns](#state-management-patterns)
- [Rendering Optimization Patterns](#rendering-optimization-patterns)
- [Data Loading Patterns](#data-loading-patterns)
- [Memory Optimization Patterns](#memory-optimization-patterns)
- [Bundle Optimization Patterns](#bundle-optimization-patterns)

---

## React Optimization Patterns

### Pattern: Memoized Component

**Problem:** Component re-renders unnecessarily

**Solution:** Use React.memo with custom comparison

```typescript
// Before: Re-renders on every parent update
function AssetCard({ asset }: { asset: Asset }) {
  return <div>{asset.name}</div>
}

// After: Only re-renders when asset changes
const AssetCard = React.memo(
  ({ asset }: { asset: Asset }) => {
    return <div>{asset.name}</div>
  },
  (prevProps, nextProps) => {
    // Custom comparison
    return prevProps.asset.id === nextProps.asset.id &&
           prevProps.asset.updatedAt === nextProps.asset.updatedAt
  }
)
```

### Pattern: Memoized Calculations

**Problem:** Expensive calculations on every render

**Solution:** Use useMemo

```typescript
// Before: Recalculates on every render
function AssetList({ assets }: { assets: Asset[] }) {
  const filtered = assets.filter(a => a.status === 'completed')
  const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt)
  // ...
}

// After: Only recalculates when assets change
function AssetList({ assets }: { assets: Asset[] }) {
  const processedAssets = useMemo(() => {
    const filtered = assets.filter(a => a.status === 'completed')
    return filtered.sort((a, b) => b.createdAt - a.createdAt)
  }, [assets])
  // ...
}
```

### Pattern: Stable Callbacks

**Problem:** New function instance on every render

**Solution:** Use useCallback

```typescript
// Before: New function on every render
function AssetList({ assets }: { assets: Asset[] }) {
  const handleClick = (id: string) => {
    console.log('Clicked:', id)
  }

  return assets.map(asset => (
    <AssetCard key={asset.id} asset={asset} onClick={handleClick} />
  ))
}

// After: Stable function reference
function AssetList({ assets }: { assets: Asset[] }) {
  const handleClick = useCallback((id: string) => {
    console.log('Clicked:', id)
  }, []) // No dependencies = never changes

  return assets.map(asset => (
    <AssetCard key={asset.id} asset={asset} onClick={handleClick} />
  ))
}
```

---

## State Management Patterns

### Pattern: Selective Zustand Subscriptions

**Problem:** Component re-renders on any store change

**Solution:** Use selective subscriptions

```typescript
// Before: Re-renders on ANY assets store change
function AssetCard({ id }: { id: string }) {
  const store = useAssetsStore()
  const asset = store.assets.find(a => a.id === id)
  // ...
}

// After: Only re-renders when this specific asset changes
function AssetCard({ id }: { id: string }) {
  const asset = useAssetsStore(
    state => state.assets.find(a => a.id === id),
    shallow  // Use shallow comparison
  )
  // ...
}

// Even better: Use selector function
const selectAssetById = (id: string) => (state: AssetsState) =>
  state.assets.find(a => a.id === id)

function AssetCard({ id }: { id: string }) {
  const asset = useAssetsStore(selectAssetById(id))
  // ...
}
```

### Pattern: Derived State

**Problem:** Duplicate state causing sync issues

**Solution:** Derive state from single source of truth

```typescript
// Before: Duplicate state
const [assets, setAssets] = useState<Asset[]>([])
const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
const [completedCount, setCompletedCount] = useState(0)

// After: Derive everything from assets
const [assets, setAssets] = useState<Asset[]>([])
const filteredAssets = useMemo(
  () => assets.filter(a => a.status === 'completed'),
  [assets]
)
const completedCount = filteredAssets.length
```

---

## Rendering Optimization Patterns

### Pattern: Virtual Scrolling

**Problem:** Rendering 1000+ items causes lag

**Solution:** Render only visible items

```typescript
// Before: Renders all 1000 items
function AssetList({ assets }: { assets: Asset[] }) {
  return (
    <div className="asset-list">
      {assets.map(asset => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  )
}

// After: Renders only ~10 visible items
import { VirtualList } from 'react-virtual'

function AssetList({ assets }: { assets: Asset[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: assets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Row height
    overscan: 5 // Render 5 extra items above/below
  })

  return (
    <div ref={parentRef} className="asset-list">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map(virtualRow => (
          <AssetCard
            key={assets[virtualRow.index].id}
            asset={assets[virtualRow.index]}
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

### Pattern: Debounced Updates

**Problem:** Too many updates during user input

**Solution:** Debounce updates

```typescript
// Before: Updates on every keystroke
function SearchBar() {
  const setSearchQuery = useAssetsStore(state => state.setSearchQuery)

  return (
    <input
      onChange={e => setSearchQuery(e.target.value)}
    />
  )
}

// After: Updates 300ms after user stops typing
import { useMemo } from 'react'
import { debounce } from '@/utils/helpers'

function SearchBar() {
  const setSearchQuery = useAssetsStore(state => state.setSearchQuery)

  const debouncedSetQuery = useMemo(
    () => debounce(setSearchQuery, 300),
    [setSearchQuery]
  )

  return (
    <input
      onChange={e => debouncedSetQuery(e.target.value)}
    />
  )
}
```

### Pattern: Lazy Loading

**Problem:** Large components slow initial page load

**Solution:** Code split with React.lazy

```typescript
// Before: All imported upfront
import AssetList from './AssetList'
import GenerationPanel from './GenerationPanel'
import ArmorFitting from './ArmorFitting'

// After: Lazy load heavy components
const AssetList = lazy(() => import('./AssetList'))
const GenerationPanel = lazy(() => import('./GenerationPanel'))
const ArmorFitting = lazy(() => import('./ArmorFitting'))

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/assets" element={<AssetList />} />
        <Route path="/generation" element={<GenerationPanel />} />
        <Route path="/armor" element={<ArmorFitting />} />
      </Routes>
    </Suspense>
  )
}
```

---

## Data Loading Patterns

### Pattern: Parallel Loading

**Problem:** Sequential loading is slow

**Solution:** Load in parallel with Promise.all

```typescript
// Before: Sequential (600ms total)
async function loadPageData() {
  const assets = await fetchAssets()      // 200ms
  const presets = await fetchPresets()    // 200ms
  const manifests = await fetchManifests() // 200ms
  return { assets, presets, manifests }
}

// After: Parallel (200ms total)
async function loadPageData() {
  const [assets, presets, manifests] = await Promise.all([
    fetchAssets(),      // All run in parallel
    fetchPresets(),
    fetchManifests()
  ])
  return { assets, presets, manifests }
}
```

### Pattern: Progressive Loading

**Problem:** Waiting for all data before showing UI

**Solution:** Show data as it arrives

```typescript
// Before: Nothing shown until all data loaded
function AssetPage() {
  const [data, setData] = useState(null)

  useEffect(() => {
    Promise.all([fetchAssets(), fetchPresets()]).then(([assets, presets]) => {
      setData({ assets, presets })
    })
  }, [])

  if (!data) return <Loading />
  return <AssetList assets={data.assets} presets={data.presets} />
}

// After: Show assets immediately, presets when ready
function AssetPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAssets().then(data => {
      setAssets(data)
      setLoading(false) // Show assets immediately
    })

    fetchPresets().then(setPresets) // Load presets in background
  }, [])

  if (loading) return <Loading />
  return <AssetList assets={assets} presets={presets} />
}
```

### Pattern: Prefetching

**Problem:** Data not ready when user navigates

**Solution:** Prefetch on hover/focus

```typescript
// Prefetch on link hover
function AssetLink({ id }: { id: string }) {
  const prefetchAsset = useCallback(() => {
    // Trigger prefetch
    AssetService.fetchAsset(id)
  }, [id])

  return (
    <Link
      to={`/assets/${id}`}
      onMouseEnter={prefetchAsset}
      onFocus={prefetchAsset}
    >
      View Asset
    </Link>
  )
}

// Prefetch on route change
function useAssetPrefetch() {
  const location = useLocation()

  useEffect(() => {
    // Prefetch next likely routes
    if (location.pathname === '/assets') {
      // User likely to view generation next
      import('./pages/GenerationPage')
    }
  }, [location])
}
```

---

## Memory Optimization Patterns

### Pattern: Cleanup on Unmount

**Problem:** Memory leaks from timers, listeners, subscriptions

**Solution:** Always cleanup in useEffect

```typescript
// Before: Memory leak
function Component() {
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Tick')
    }, 1000)
    // Missing cleanup!
  }, [])
}

// After: Proper cleanup
function Component() {
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Tick')
    }, 1000)

    return () => {
      clearInterval(interval) // Cleanup
    }
  }, [])
}

// Cleanup patterns
useEffect(() => {
  // Timers
  const timer = setTimeout(() => {}, 1000)
  return () => clearTimeout(timer)
}, [])

useEffect(() => {
  // Event listeners
  const handler = () => {}
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])

useEffect(() => {
  // AbortController for fetch
  const controller = new AbortController()
  fetch('/api/data', { signal: controller.signal })
  return () => controller.abort()
}, [])

useEffect(() => {
  // Blob URLs
  const url = URL.createObjectURL(blob)
  return () => URL.revokeObjectURL(url)
}, [blob])
```

### Pattern: WeakMap for Temporary Data

**Problem:** Manual cleanup of temporary associations

**Solution:** Use WeakMap for auto cleanup

```typescript
// Before: Manual cleanup needed
const cache = new Map<THREE.Object3D, AssetData>()

function addToCache(object: THREE.Object3D, data: AssetData) {
  cache.set(object, data)
}

function cleanup(object: THREE.Object3D) {
  cache.delete(object) // Must remember to call
}

// After: Auto cleanup when object is GC'd
const cache = new WeakMap<THREE.Object3D, AssetData>()

function addToCache(object: THREE.Object3D, data: AssetData) {
  cache.set(object, data)
}

// No cleanup needed - auto removed when object is garbage collected
```

---

## Bundle Optimization Patterns

### Pattern: Dynamic Imports

**Problem:** Large dependencies in main bundle

**Solution:** Load on demand

```typescript
// Before: Three.js in main bundle (+500KB)
import * as THREE from 'three'

function create3DViewer() {
  const scene = new THREE.Scene()
  // ...
}

// After: Load Three.js only when needed
async function create3DViewer() {
  const THREE = await import('three')
  const scene = new THREE.Scene()
  // ...
}
```

### Pattern: Tree Shaking

**Problem:** Importing entire library when only need one function

**Solution:** Import specific exports

```typescript
// Before: Imports entire lodash (+71KB)
import _ from 'lodash'
const result = _.debounce(fn, 300)

// After: Imports only debounce (~1KB)
import debounce from 'lodash/debounce'
const result = debounce(fn, 300)

// Even better: Use native implementation
function debounce(fn: Function, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: any[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
```

---

## Pattern Checklist

Use this checklist when implementing features:

### React Components
- [ ] Use React.memo for expensive components
- [ ] Use useMemo for expensive calculations
- [ ] Use useCallback for stable function references
- [ ] Clean up subscriptions in useEffect
- [ ] Avoid inline object/array creation in render

### State Management
- [ ] Use selective Zustand subscriptions
- [ ] Derive state instead of duplicating
- [ ] Batch related state updates
- [ ] Use shallow comparison where appropriate
- [ ] Avoid unnecessary global state

### Rendering
- [ ] Use virtual scrolling for long lists
- [ ] Implement lazy loading for heavy components
- [ ] Debounce rapid updates
- [ ] Use CSS transforms for animations
- [ ] Minimize DOM manipulations

### Data Loading
- [ ] Load data in parallel when possible
- [ ] Show progressive loading states
- [ ] Implement prefetching for likely routes
- [ ] Use request deduplication
- [ ] Cache frequently-accessed data

### Memory Management
- [ ] Clean up timers and intervals
- [ ] Remove event listeners
- [ ] Revoke blob URLs
- [ ] Abort pending requests
- [ ] Use WeakMap for temporary associations

### Bundle Size
- [ ] Use dynamic imports for large dependencies
- [ ] Import specific exports (tree shaking)
- [ ] Lazy load routes
- [ ] Code split by feature
- [ ] Analyze bundle with webpack-bundle-analyzer

---

## Related Documentation

- [Performance Architecture](./performance-architecture.md)
- [Performance Best Practices](../11-development/performance-best-practices.md)
- [Component Patterns](../11-development/component-patterns.md)
- [State Management](../11-development/state-management.md)

---

**Last Updated:** 2025-10-24
**Version:** 1.0.0
